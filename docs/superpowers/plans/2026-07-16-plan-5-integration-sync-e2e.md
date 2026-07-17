# Plan 5 — Integration: Sync Push, Shared Rollups, E2E

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile pushes its offline books to the shared Supabase Postgres behind an email auth link; the health math and price-book templates stop being duplicated; the web dashboard gets Playwright E2E coverage; the branch finishes into a PR.

**Architecture:** A new `@fasttrack/rollups` package owns the pure dashboard math (moved from `apps/web/src/lib/rollups.ts`, consumed by mobile `kpis.ts` so the two gauges share one implementation). Price-book templates move into `@fasttrack/schema` as the single source. Mobile sync is a full idempotent push — collect all local rows per table in FK order, transform SQLite shapes to Postgres shapes (booleans, JSON), upsert on `id` through a thin `SyncTarget` seam so everything except the last inch is testable offline with sql.js. Bootstrap mirrors web onboarding: `users` upsert → `organizations` upsert → owner `memberships` (the RLS bootstrap policy admits the first member of a memberless org — no RPC needed, and we do NOT call `seed_price_book`/`seed_expense_categories`, which would duplicate rows under fresh ids).

**Tech Stack:** pnpm + turbo monorepo, TypeScript, vitest (+ sql.js driver for mobile DB tests), `@supabase/supabase-js` on mobile (`persistSession: false` — no AsyncStorage dep, Expo Go safe), `@playwright/test` for web E2E against the live demo org.

**Decisions locked for this plan:**
1. **Sync v1 = rows only, full push, no pull.** Receipt image files stay on device; `receipt_storage_path`/`pdf_url` strings push as-is (web may show dead links — accepted, noted for the PowerSync revisit). Soft-deleted rows push too, so deletes propagate.
2. **No session persistence on mobile.** Sign in per sync session; keeps deps zero and Expo Go happy.
3. **Test the auth link with a fresh account, not `demo@fasttrack.app`** — pushing under the demo user would attach a second org to it and the web dashboard picks the first membership.
4. **E2E is a separate script (`pnpm --filter web e2e`), not in the turbo `test` gate** — it needs a browser install and the live DB.

---

### Task 1: Price-book templates move to `@fasttrack/schema`

Kills the duplication flagged in `apps/mobile/src/db/seeds/priceBookTemplates.ts` ("keep row-for-row identical until then" — *then* is now). The schema package already owns `Trade`/`PriceBookKind`.

**Files:**
- Create: `packages/schema/src/priceBookTemplates.ts`
- Create: `packages/schema/src/priceBookTemplates.test.ts`
- Modify: `packages/schema/src/index.ts` (add export)
- Modify: `apps/mobile/src/db/seeds/priceBookTemplates.ts` (becomes a re-export)

- [ ] **Step 1: Write the failing test**

`packages/schema/src/priceBookTemplates.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { priceBookKindSchema, tradeSchema } from "./enums";
import { PRICE_BOOK_TEMPLATES } from "./priceBookTemplates";

describe("PRICE_BOOK_TEMPLATES", () => {
  it("matches the live price_book_templates row count (31, Plan 2 migration 6)", () => {
    expect(PRICE_BOOK_TEMPLATES).toHaveLength(31);
  });

  it("every row passes the enum schemas and money invariants", () => {
    for (const t of PRICE_BOOK_TEMPLATES) {
      expect(() => tradeSchema.parse(t.trade)).not.toThrow();
      expect(() => priceBookKindSchema.parse(t.kind)).not.toThrow();
      expect(Number.isInteger(t.unitCostCents)).toBe(true);
      expect(t.unitCostCents).toBeGreaterThan(0);
      expect(t.defaultMarkupPct).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.unit.length).toBeGreaterThan(0);
    }
  });

  it("every trade has at least one labor line (onboarding never seeds an empty book)", () => {
    for (const trade of tradeSchema.options) {
      expect(
        PRICE_BOOK_TEMPLATES.some((t) => t.trade === trade && t.kind === "labor"),
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it — must fail (module doesn't exist)**

Run: `pnpm --filter @fasttrack/schema test`
Expected: FAIL — cannot resolve `./priceBookTemplates`

- [ ] **Step 3: Move the data**

Create `packages/schema/src/priceBookTemplates.ts` with the ENTIRE contents of `apps/mobile/src/db/seeds/priceBookTemplates.ts`, changing only the import line to local:

```ts
import type { PriceBookKind, Trade } from "./enums";
```

Update the doc comment: it is now the single source; the live `price_book_templates` table mirrors it (Task 9 verifies).

Append to `packages/schema/src/index.ts`:

```ts
export * from "./priceBookTemplates";
```

Replace `apps/mobile/src/db/seeds/priceBookTemplates.ts` body entirely with:

```ts
/** Single source moved to @fasttrack/schema in Plan 5; this re-export keeps call sites stable. */
export { PRICE_BOOK_TEMPLATES, type PriceBookTemplate } from "@fasttrack/schema";
```

- [ ] **Step 4: Run schema + mobile tests**

Run: `pnpm --filter @fasttrack/schema build && pnpm --filter @fasttrack/schema test && pnpm --filter mobile test`
Expected: PASS (mobile `seeds.test.ts` and `orgRepo.test.ts` unchanged and green)

- [ ] **Step 5: Commit**

```bash
git add packages/schema apps/mobile/src/db/seeds/priceBookTemplates.ts
git commit -m "refactor(schema): price-book templates become the single source, mobile re-exports"
```

---

### Task 2: `@fasttrack/rollups` — shared dashboard math with real unit tests

Moves `apps/web/src/lib/rollups.ts` (pure functions, zero I/O) into a package and finally gives it the unit tests the web app never had (`--passWithNoTests` dies in Task 3's wake).

**Files:**
- Create: `packages/rollups/package.json`, `packages/rollups/tsconfig.json`, `packages/rollups/vitest.config.ts`
- Create: `packages/rollups/src/rollups.ts`, `packages/rollups/src/index.ts`
- Create: `packages/rollups/src/rollups.test.ts`
- Modify: `apps/web/src/lib/rollups.ts` (becomes a re-export), `apps/web/package.json` (dep)

- [ ] **Step 1: Scaffold the package (mirror `packages/core` exactly)**

`packages/rollups/package.json`:

```json
{
  "name": "@fasttrack/rollups",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fasttrack/core": "workspace:*",
    "@fasttrack/schema": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

`packages/rollups/tsconfig.json` and `vitest.config.ts`: copy from `packages/core` verbatim (tsconfig extends `../../tsconfig.base.json`, outDir dist, rootDir src, excludes tests).

- [ ] **Step 2: Move the code**

`packages/rollups/src/rollups.ts` = the ENTIRE current contents of `apps/web/src/lib/rollups.ts` with ONE change — replace `import { monthKey } from "@/lib/format";` with a local copy (web keeps its own for display code):

```ts
/** "2026-07" bucketing key — must stay in lockstep with web's format.monthKey. */
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}
```

`packages/rollups/src/index.ts`:

```ts
export * from "./rollups";
```

- [ ] **Step 3: Write the unit tests (failing only until `pnpm install` wires the workspace)**

`packages/rollups/src/rollups.test.ts` — use row factories so tests read as scenarios:

```ts
import { basisPoints } from "@fasttrack/core";
import type {
  Client, Estimate, EstimateLine, Expense, ExpenseCategory, Invoice, Job, Payment,
} from "@fasttrack/schema";
import { describe, expect, it } from "vitest";

import {
  agingBuckets, budgetVsActual, buildTips, computeHealth, jobProfitability,
  monthlySeries, spendByCategory,
} from "./rollups";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const ORG = "org-1";
const T = "2026-07-01T00:00:00.000Z";

let seq = 0;
const id = () => `id-${++seq}`;

function estimate(p: Partial<Estimate>): Estimate {
  return {
    id: id(), org_id: ORG, job_id: "job-1", number: 1, status: "accepted",
    issued_at: T, expires_at: null, subtotal_cents: 0, tax_cents: 0,
    discount_cents: 0, total_cents: 0, notes: null, terms: null, pdf_url: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Estimate;
}
function line(p: Partial<EstimateLine>): EstimateLine {
  return {
    id: id(), org_id: ORG, estimate_id: "e-1", sort_order: 0, kind: "labor",
    description: "work", quantity: 1, unit: "hr", unit_cost_cents: 0,
    markup_pct: 0, unit_price_cents: 0, is_taxable: false,
    price_book_item_id: null, created_at: T, updated_at: T, deleted_at: null, ...p,
  } as EstimateLine;
}
function invoice(p: Partial<Invoice>): Invoice {
  return {
    id: id(), org_id: ORG, job_id: "job-1", converted_from_estimate_id: null,
    number: 1, status: "sent", issued_at: T, due_at: "2026-07-30T00:00:00.000Z",
    subtotal_cents: 0, tax_cents: 0, discount_cents: 0, total_cents: 0,
    balance_cents: 0, notes: null, terms: null, pdf_url: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Invoice;
}
function payment(p: Partial<Payment>): Payment {
  return {
    id: id(), org_id: ORG, invoice_id: "i-1", amount_cents: 0, method: "cash",
    paid_at: T, reference: null, notes: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Payment;
}
function expense(p: Partial<Expense>): Expense {
  return {
    id: id(), org_id: ORG, job_id: null, category_id: "cat-1", vendor: null,
    description: null, amount_cents: 100, spent_at: "2026-07-10",
    is_billable: false, receipt_storage_path: null, ocr_extracted: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Expense;
}
const CATS: ExpenseCategory[] = [
  { id: "cat-1", org_id: ORG, name: "Materials", sort_order: 0, created_at: T, updated_at: T, deleted_at: null } as ExpenseCategory,
  { id: "cat-2", org_id: ORG, name: "Fuel", sort_order: 1, created_at: T, updated_at: T, deleted_at: null } as ExpenseCategory,
];

describe("computeHealth", () => {
  it("reads neutral margin when there is no accepted-estimate evidence", () => {
    const { inputs } = computeHealth(
      { estimates: [], estimateLines: [], invoices: [], payments: [] },
      basisPoints(3000), NOW,
    );
    expect(inputs.marginBps).toBe(3000);
    expect(inputs.outstandingCents).toBe(0);
  });

  it("derives margin from accepted estimates inside the 90d window only", () => {
    const inWindow = estimate({ id: "e-in" });
    const stale = estimate({ id: "e-old", issued_at: "2025-01-01T00:00:00.000Z" });
    const lines = [
      line({ estimate_id: "e-in", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
      line({ estimate_id: "e-old", quantity: 1, unit_cost_cents: 9999, unit_price_cents: 10000 }),
    ];
    const { inputs } = computeHealth(
      { estimates: [inWindow, stale], estimateLines: lines, invoices: [], payments: [] },
      basisPoints(3000), NOW,
    );
    expect(inputs.marginBps).toBe(5000); // only the in-window 50% line counts
  });

  it("splits outstanding into overdue by due date and sums collections", () => {
    const invoices = [
      invoice({ status: "sent", total_cents: 10000, balance_cents: 10000, due_at: "2026-07-01T00:00:00.000Z" }),
      invoice({ status: "partial", total_cents: 20000, balance_cents: 5000, due_at: "2026-08-01T00:00:00.000Z" }),
      invoice({ status: "paid", total_cents: 7000, balance_cents: 0 }),
    ];
    const { inputs } = computeHealth(
      { estimates: [], estimateLines: [], invoices, payments: [payment({ amount_cents: 15000 })] },
      basisPoints(3000), NOW,
    );
    expect(inputs.outstandingCents).toBe(15000);
    expect(inputs.overdueCents).toBe(10000);
    expect(inputs.collectedCents).toBe(15000);
    expect(inputs.invoicedCents).toBe(37000);
  });
});

describe("monthlySeries", () => {
  it("buckets issued invoices and payments into the right months, oldest first", () => {
    const points = monthlySeries(
      [invoice({ issued_at: "2026-05-10T00:00:00.000Z", total_cents: 800 }),
       invoice({ status: "draft", issued_at: "2026-05-11T00:00:00.000Z", total_cents: 999 })],
      [payment({ paid_at: "2026-07-02T00:00:00.000Z", amount_cents: 300 })],
      NOW, 6,
    );
    expect(points).toHaveLength(6);
    expect(points[0]?.key).toBe("2026-02");
    expect(points.find((p) => p.key === "2026-05")?.invoicedCents).toBe(800); // draft excluded
    expect(points.at(-1)?.collectedCents).toBe(300);
  });
});

describe("agingBuckets", () => {
  it("places balances on the 30/60 day boundaries correctly", () => {
    const mk = (daysPast: number) =>
      invoice({ balance_cents: 100, due_at: new Date(NOW.getTime() - daysPast * 86_400_000).toISOString() });
    const b = agingBuckets([mk(-5), mk(15), mk(45), mk(90)], NOW);
    expect(b.notDueCents).toBe(100);
    expect(b.d1to30Cents).toBe(100);
    expect(b.d31to60Cents).toBe(100);
    expect(b.d61plusCents).toBe(100);
    expect(b.overdueCount).toBe(3);
  });
});

describe("spendByCategory / budgetVsActual", () => {
  it("filters to the month, groups, sorts descending, merges budgets", () => {
    const expenses = [
      expense({ category_id: "cat-1", amount_cents: 500 }),
      expense({ category_id: "cat-2", amount_cents: 900 }),
      expense({ category_id: "cat-1", amount_cents: 100, spent_at: "2026-06-01" }),
    ];
    const spend = spendByCategory(expenses, CATS, "2026-07");
    expect(spend.totalCents).toBe(1400);
    expect(spend.rows[0]?.name).toBe("Fuel");

    const lines = budgetVsActual(
      [{ category_id: "cat-1", month: "2026-07-01", amount_cents: 300 as never }],
      expenses, CATS, "2026-07",
    );
    const materials = lines.find((l) => l.categoryId === "cat-1");
    expect(materials?.budgetCents).toBe(300);
    expect(materials?.actualCents).toBe(500);
    expect(lines.find((l) => l.categoryId === "cat-2")?.budgetCents).toBe(0);
  });
});

describe("jobProfitability", () => {
  it("counts accepted-estimate economics plus expenses, omits evidence-free jobs", () => {
    const jobs = [
      { id: "job-1", org_id: ORG, client_id: "c-1", title: "Panel", address: null, scheduled_at: null, status: "in_progress", notes: null, created_at: T, updated_at: T, deleted_at: null } as Job,
      { id: "job-2", org_id: ORG, client_id: "c-1", title: "Idle", address: null, scheduled_at: null, status: "lead", notes: null, created_at: T, updated_at: T, deleted_at: null } as Job,
    ];
    const clients = [{ id: "c-1", org_id: ORG, name: "Dana", email: null, phone: null, address: null, notes: null, created_at: T, updated_at: T, deleted_at: null } as Client];
    const rows = jobProfitability({
      jobs, clients,
      estimates: [estimate({ id: "e-1", job_id: "job-1" })],
      estimateLines: [line({ estimate_id: "e-1", quantity: 2, unit_cost_cents: 1000, unit_price_cents: 3000 })],
      expenses: [expense({ job_id: "job-1", amount_cents: 500 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ jobId: "job-1", clientName: "Dana", revenueCents: 6000, costCents: 2500, profitCents: 3500 });
  });
});

describe("buildTips", () => {
  it("fires over-budget, overdue, low-margin, and unbilled rules; all-clear otherwise", () => {
    const health = computeHealth(
      { estimates: [], estimateLines: [], invoices: [], payments: [] },
      basisPoints(3000), NOW,
    );
    const quiet = buildTips({ budgetLines: [], aging: agingBuckets([], NOW), health, estimates: [], invoices: [] });
    expect(quiet).toHaveLength(1);
    expect(quiet[0]?.id).toBe("all-clear");

    const noisy = buildTips({
      budgetLines: [{ categoryId: "cat-1", name: "Materials", budgetCents: 100, actualCents: 500 }],
      aging: agingBuckets([invoice({ balance_cents: 900, due_at: "2026-07-01T00:00:00.000Z" })], NOW),
      health,
      estimates: [estimate({ id: "e-9", total_cents: 4200 })],
      invoices: [],
    });
    const ids = noisy.map((t) => t.id);
    expect(ids).toContain("over-budget-cat-1");
    expect(ids).toContain("overdue-receivables");
    expect(ids).toContain("accepted-not-invoiced");
  });
});
```

Note: factories use `as` casts against branded Zod types — that is test scaffolding, not production code weakening. If `@fasttrack/schema` row types accept plain literals directly, drop the casts.

- [ ] **Step 4: Wire and run**

Run: `pnpm install && pnpm --filter @fasttrack/rollups build && pnpm --filter @fasttrack/rollups test`
Expected: PASS (fix any factory/type mismatches by reading `packages/schema/src/*.ts` — never by loosening the schema)

- [ ] **Step 5: Point web at the package**

Add `"@fasttrack/rollups": "workspace:*"` to `apps/web/package.json` dependencies. Replace `apps/web/src/lib/rollups.ts` body entirely with:

```ts
/** Moved to @fasttrack/rollups in Plan 5 so web and mobile share one implementation. */
export * from "@fasttrack/rollups";
```

Run: `pnpm install && pnpm --filter web build && pnpm --filter web typecheck`
Expected: PASS — no page imports change (`@/lib/rollups` still resolves)

- [ ] **Step 6: Commit**

```bash
git add packages/rollups apps/web/package.json apps/web/src/lib/rollups.ts pnpm-lock.yaml
git commit -m "feat(rollups): shared dashboard math package with unit tests; web re-exports"
```

---

### Task 3: Mobile health gauge uses the shared `computeHealth`

Deletes the mirror the kpis.ts comment promised Plan 5 would remove. `monthKpis` and `activity` stay as SQL aggregates (they are mobile-specific and already tested).

**Files:**
- Modify: `apps/mobile/package.json` (add `"@fasttrack/rollups": "workspace:*"`)
- Modify: `apps/mobile/src/db/repos/kpis.ts:1-117` (replace `healthForOrg` + mirror block)

- [ ] **Step 1: Confirm the safety net exists**

`apps/mobile/src/db/repos/kpis.test.ts` already asserts `healthForOrg` outputs. Run: `pnpm --filter mobile test -- kpis`
Expected: PASS (baseline)

- [ ] **Step 2: Replace the mirror**

In `kpis.ts`, delete the mirror comment block, `withinDays`, `OPEN_STATUSES`, `HEALTH_WINDOW_DAYS`, `DAY_MS`, the local `HealthResult`, and the body of `healthForOrg`. Replace with:

```ts
import { computeHealth, type HealthResult } from "@fasttrack/rollups";
import { basisPoints, roundHalfUp } from "@fasttrack/core";

import type { DbCtx } from "../driver";
import {
  rowToEstimate, rowToEstimateLine, rowToInvoice, rowToOrganization, rowToPayment,
} from "../mappers";

export type { HealthResult };

/** Same inputs as the web gauge, sourced from local SQLite — one implementation, two surfaces. */
export async function healthForOrg(ctx: DbCtx, orgId: string): Promise<HealthResult> {
  const orgRows = await ctx.driver.exec("SELECT * FROM organizations WHERE id = ?", [orgId]);
  const orgRow = orgRows[0];
  if (!orgRow) throw new Error("Organization not found");
  const org = rowToOrganization(orgRow);

  const [estimates, estimateLines, invoices, payments] = await Promise.all([
    ctx.driver.exec("SELECT * FROM estimates WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM estimate_lines WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM invoices WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM payments WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
  ]);

  return computeHealth(
    {
      estimates: estimates.map(rowToEstimate),
      estimateLines: estimateLines.map(rowToEstimateLine),
      invoices: invoices.map(rowToInvoice),
      payments: payments.map(rowToPayment),
    },
    basisPoints(org.target_margin_bps),
    new Date(ctx.now()),
  );
}
```

Keep `roundHalfUp` only if `monthKpis` still uses it (it does — margin line). Remove now-unused imports (`cents`, `documentProfit`, `healthScore`, `HealthInputs`, `HealthScore`).

Note: sql.js `transaction` is not involved; `Promise.all` over reads is safe on both drivers because each `exec` is independent — if the expo-sqlite driver serializes, behavior is identical.

- [ ] **Step 3: Run mobile tests**

Run: `pnpm install && pnpm --filter mobile test`
Expected: PASS — `kpis.test.ts` green proves the shared implementation agrees with the old mirror

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/db/repos/kpis.ts pnpm-lock.yaml
git commit -m "refactor(mobile): health gauge consumes shared @fasttrack/rollups computeHealth"
```

---

### Task 4: Mobile Supabase client + env

**Files:**
- Modify: `apps/mobile/package.json` (add `"@supabase/supabase-js": "^2.58.0"`)
- Create: `apps/mobile/src/sync/supabaseClient.ts`
- Create: `apps/mobile/.env.example`; create `apps/mobile/.env` locally (gitignored)
- Modify: `.gitignore` (ensure `apps/mobile/.env`)

- [ ] **Step 1: Install and configure**

Add the dependency, then `pnpm install`.

`apps/mobile/src/sync/supabaseClient.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Push-only client: no persisted session (no AsyncStorage dep, Expo Go safe),
 * the user signs in per sync session. EXPO_PUBLIC_ vars come from apps/mobile/.env.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Cloud sync is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
```

`apps/mobile/.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://sxmazpcygbkyclmclexw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key — copy from apps/web/.env.local or MCP get_publishable_keys>
```

Create `apps/mobile/.env` with the real values (same ones the web app uses). Add `apps/mobile/.env` to `.gitignore` if `.env` is not already covered.

- [ ] **Step 2: Verify typecheck + Expo still exports**

Run: `pnpm --filter mobile typecheck && pnpm --filter mobile exec expo export --platform web`
Expected: both clean. (Expo SDK 57 provides `URL`/`fetch` natively — no polyfills.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/.env.example .gitignore pnpm-lock.yaml apps/mobile/src/sync/supabaseClient.ts
git commit -m "feat(mobile): supabase client for cloud sync, env template"
```

---### Task 5: Sync transforms — SQLite shapes → Postgres shapes (TDD)

The local DDL mirrors Postgres column-for-column (schema.ts's Plan-1 rule), so only three shape gaps exist: INTEGER booleans (`is_taxable`, `is_billable`), TEXT JSON (`tax_config`, `ocr_extracted`), and nothing else.

**Files:**
- Create: `apps/mobile/src/sync/transform.test.ts`
- Create: `apps/mobile/src/sync/transform.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/sync/transform.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toPgRow } from "./transform";

describe("toPgRow", () => {
  it("converts INTEGER booleans on the three boolean columns", () => {
    expect(toPgRow("estimate_lines", { id: "a", is_taxable: 1 })).toEqual({ id: "a", is_taxable: true });
    expect(toPgRow("invoice_lines", { id: "b", is_taxable: 0 })).toEqual({ id: "b", is_taxable: false });
    expect(toPgRow("expenses", { id: "c", is_billable: 1, ocr_extracted: null }))
      .toEqual({ id: "c", is_billable: true, ocr_extracted: null });
  });

  it("parses TEXT JSON columns into objects (null stays null)", () => {
    expect(toPgRow("organizations", { id: "o", tax_config: '{"name":"Sales tax","rate_bps":825}' }))
      .toEqual({ id: "o", tax_config: { name: "Sales tax", rate_bps: 825 } });
    expect(toPgRow("expenses", { id: "e", is_billable: 0, ocr_extracted: '{"total":12}' }))
      .toEqual({ id: "e", is_billable: false, ocr_extracted: { total: 12 } });
  });

  it("passes untouched tables/columns through unchanged", () => {
    const row = { id: "x", org_id: "o", name: "Dana", created_at: "2026-07-01T00:00:00.000Z" };
    expect(toPgRow("clients", row)).toEqual(row);
  });

  it("throws on malformed JSON rather than pushing garbage", () => {
    expect(() => toPgRow("organizations", { id: "o", tax_config: "{nope" })).toThrow(/tax_config/);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm --filter mobile test -- transform`
Expected: FAIL — `./transform` not found

- [ ] **Step 3: Implement**

`apps/mobile/src/sync/transform.ts`:

```ts
import type { SqlRow, SqlValue } from "../db/driver";

export type PgValue = SqlValue | boolean | Record<string, unknown>;
export type PgRow = Record<string, PgValue>;

/** SQLite stores booleans as 0/1 — these columns are `boolean` in Postgres. */
const BOOL_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  estimate_lines: ["is_taxable"],
  invoice_lines: ["is_taxable"],
  expenses: ["is_billable"],
};

/** SQLite stores JSON as TEXT — these columns are `jsonb` in Postgres. */
const JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  organizations: ["tax_config"],
  expenses: ["ocr_extracted"],
};

/** One local row → one PostgREST-ready row. Column names never change (Plan 1 rule). */
export function toPgRow(table: string, row: SqlRow): PgRow {
  const out: PgRow = { ...row };
  for (const column of BOOL_COLUMNS[table] ?? []) {
    if (column in out) out[column] = out[column] === 1;
  }
  for (const column of JSON_COLUMNS[table] ?? []) {
    const value = out[column];
    if (typeof value === "string") {
      try {
        out[column] = JSON.parse(value) as Record<string, unknown>;
      } catch {
        throw new Error(`Sync: ${table}.${column} holds malformed JSON`);
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests — pass**

Run: `pnpm --filter mobile test -- transform`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/transform.ts apps/mobile/src/sync/transform.test.ts
git commit -m "feat(mobile): sync row transforms for boolean and json columns"
```

---

### Task 6: Sync collect + push (TDD against a fake target)

Everything except the network is exercised with the sql.js driver. The `SyncTarget` seam keeps `@supabase/supabase-js` out of the tests.

**Files:**
- Create: `apps/mobile/src/sync/push.test.ts`
- Create: `apps/mobile/src/sync/push.ts`

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/sync/push.test.ts` (reuse the repo test harness — see `apps/mobile/src/db/repos/testUtils.ts` for how existing tests build a seeded ctx; use the same helper):

```ts
import { describe, expect, it } from "vitest";

import { createOrg } from "../db/repos/orgRepo";
import { makeTestCtx } from "../db/repos/testUtils"; // adjust to the actual helper name/exports
import { collectPush, pushAll, PUSH_TABLES, type SyncTarget } from "./push";

async function seededCtx() {
  const ctx = await makeTestCtx();
  const org = await createOrg(ctx, {
    name: "Test Electric", trade: "electrical", targetMarginBps: 3000, taxRateBps: 825,
  });
  return { ctx, org };
}

function fakeTarget() {
  const calls: { table: string; rows: readonly Record<string, unknown>[]; onConflict: string; ignoreDuplicates: boolean }[] = [];
  const target: SyncTarget = {
    async upsert(table, rows, opts) {
      calls.push({ table, rows, onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates ?? false });
    },
  };
  return { target, calls };
}

describe("collectPush", () => {
  it("returns batches in FK-safe order with only this org's rows", async () => {
    const { ctx, org } = await seededCtx();
    const batches = await collectPush(ctx, org.id);
    expect(batches.map((b) => b.table)).toEqual([...PUSH_TABLES]);
    const orgBatch = batches.find((b) => b.table === "organizations");
    expect(orgBatch?.rows).toHaveLength(1);
    expect(orgBatch?.rows[0]?.tax_config).toEqual({ name: "Sales tax", rate_bps: 825 });
    const pb = batches.find((b) => b.table === "price_book_items");
    expect(pb?.rows.length).toBeGreaterThan(0); // electrical slice seeded by createOrg
  });

  it("includes soft-deleted rows so deletes propagate", async () => {
    const { ctx, org } = await seededCtx();
    const item = (await ctx.driver.exec(
      "SELECT id FROM price_book_items LIMIT 1",
    ))[0];
    await ctx.driver.exec("UPDATE price_book_items SET deleted_at = ? WHERE id = ?", [ctx.now(), String(item?.id)]);
    const batches = await collectPush(ctx, org.id);
    const rows = batches.find((b) => b.table === "price_book_items")?.rows ?? [];
    expect(rows.some((r) => r.deleted_at !== null)).toBe(true);
  });
});

describe("pushAll", () => {
  it("bootstraps users → organizations → memberships before data tables", async () => {
    const { ctx, org } = await seededCtx();
    const { target, calls } = fakeTarget();
    const summary = await pushAll(target, ctx, org, {
      id: "user-1", email: "a@b.c", name: "Ana",
    });
    expect(calls[0]?.table).toBe("users");
    expect(calls[1]?.table).toBe("organizations");
    expect(calls[2]?.table).toBe("memberships");
    expect(calls[2]?.onConflict).toBe("org_id,user_id");
    expect(calls[2]?.ignoreDuplicates).toBe(true);
    // A fresh org has rows only in the two seeded tables; empty tables are skipped.
    expect(calls.map((c) => c.table).slice(3)).toEqual(["price_book_items", "expense_categories"]);
    expect(summary.find((s) => s.table === "expense_categories")?.count).toBe(8);
  });

  it("skips empty tables instead of issuing empty upserts", async () => {
    const { ctx, org } = await seededCtx();
    const { target, calls } = fakeTarget();
    await pushAll(target, ctx, org, { id: "u", email: "a@b.c", name: "A" });
    expect(calls.every((c) => c.rows.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — must fail**

Run: `pnpm --filter mobile test -- push`
Expected: FAIL — `./push` not found

- [ ] **Step 3: Implement**

`apps/mobile/src/sync/push.ts`:

```ts
import type { Organization } from "@fasttrack/schema";

import type { DbCtx } from "../db/driver";
import { toPgRow, type PgRow } from "./transform";

/** FK-safe order: parents before children. organizations is pushed in the bootstrap. */
export const PUSH_TABLES = [
  "organizations",
  "clients",
  "jobs",
  "price_book_items",
  "estimates",
  "estimate_lines",
  "invoices",
  "invoice_lines",
  "payments",
  "expense_categories",
  "expenses",
] as const;

export type PushTable = (typeof PUSH_TABLES)[number];

export interface PushBatch {
  readonly table: PushTable;
  readonly rows: readonly PgRow[];
}

export interface UpsertOptions {
  readonly onConflict: string;
  readonly ignoreDuplicates?: boolean;
}

/** The last inch of network — implemented by supabaseTarget, faked in tests. */
export interface SyncTarget {
  upsert(table: string, rows: readonly PgRow[], opts: UpsertOptions): Promise<void>;
}

export interface LinkedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface PushSummaryEntry {
  readonly table: string;
  readonly count: number;
}

/** Read every row (soft-deleted included — deletes must propagate) for one org. */
export async function collectPush(ctx: DbCtx, orgId: string): Promise<PushBatch[]> {
  const batches: PushBatch[] = [];
  for (const table of PUSH_TABLES) {
    const rows =
      table === "organizations"
        ? await ctx.driver.exec("SELECT * FROM organizations WHERE id = ?", [orgId])
        : await ctx.driver.exec(`SELECT * FROM ${table} WHERE org_id = ?`, [orgId]);
    batches.push({ table, rows: rows.map((row) => toPgRow(table, row)) });
  }
  return batches;
}

/**
 * Full idempotent push. Bootstrap mirrors web onboarding (users → org →
 * owner membership; RLS bootstrap policy admits the first member) and then
 * upserts every data table on id. Never calls seed_price_book /
 * seed_expense_categories — local rows ARE the seed.
 */
export async function pushAll(
  target: SyncTarget,
  ctx: DbCtx,
  org: Organization,
  user: LinkedUser,
): Promise<PushSummaryEntry[]> {
  const batches = await collectPush(ctx, org.id);
  const orgBatch = batches.find((b) => b.table === "organizations");
  if (!orgBatch || orgBatch.rows.length === 0) throw new Error("Nothing to push: no organization row");

  await target.upsert("users", [{ id: user.id, email: user.email, name: user.name }], { onConflict: "id" });
  await target.upsert("organizations", orgBatch.rows, { onConflict: "id" });
  await target.upsert(
    "memberships",
    [{ id: ctx.newId(), org_id: org.id, user_id: user.id, role: "owner" }],
    { onConflict: "org_id,user_id", ignoreDuplicates: true },
  );

  const summary: PushSummaryEntry[] = [{ table: "organizations", count: orgBatch.rows.length }];
  for (const batch of batches) {
    if (batch.table === "organizations" || batch.rows.length === 0) continue;
    await target.upsert(batch.table, batch.rows, { onConflict: "id" });
    summary.push({ table: batch.table, count: batch.rows.length });
  }
  return summary;
}
```

Add the Supabase adapter at the bottom of the same file (kept beside the seam so the mapping is visible):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseTarget(client: SupabaseClient): SyncTarget {
  return {
    async upsert(table, rows, opts) {
      const { error } = await client
        .from(table)
        .upsert(rows as Record<string, unknown>[], {
          onConflict: opts.onConflict,
          ignoreDuplicates: opts.ignoreDuplicates ?? false,
        });
      if (error) throw new Error(`Sync failed on ${table}: ${error.message}`);
    },
  };
}
```

(Move the import to the top of the file with the others.)

- [ ] **Step 4: Run — pass, and the whole mobile suite stays green**

Run: `pnpm --filter mobile test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/push.ts apps/mobile/src/sync/push.test.ts
git commit -m "feat(mobile): offline-testable sync push - collect, transform, FK-ordered upserts"
```

---

### Task 7: Sync screen — auth link + push button

**Files:**
- Create: `apps/mobile/src/app/sync.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (register the route IF the Stack enumerates screens explicitly; expo-router auto-registers otherwise)
- Modify: `apps/mobile/src/app/(tabs)/index.tsx` (Home header cloud button)

- [ ] **Step 1: Build the screen**

`apps/mobile/src/app/sync.tsx` — follow the app's existing form styling (crib field/button styles from `onboarding.tsx` / `ExpenseForm.tsx`; use `colors` from `@/theme`):

```tsx
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/ui/Buttons"; // use the actual exported button component
import { useDb } from "@/db/DbProvider";
import { pushAll, supabaseTarget, type PushSummaryEntry } from "@/sync/push";
import { getSupabase } from "@/sync/supabaseClient";
import { colors } from "@/theme";

type Phase = "idle" | "authing" | "pushing" | "done" | "error";

export default function SyncScreen() {
  const { ctx, org } = useDb();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<readonly PushSummaryEntry[] | null>(null);

  async function linkAndPush() {
    if (!org) {
      setMessage("Finish onboarding first.");
      return;
    }
    setPhase("authing");
    setMessage(null);
    setSummary(null);
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        setPhase("idle");
        setMessage("Check your email to confirm the account, then sign in here.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user?.email) throw new Error("Sign-in returned no user");

      setPhase("pushing");
      const result = await pushAll(supabaseTarget(supabase), ctx, org, {
        id: user.id,
        email: user.email,
        name: org.name,
      });
      await supabase.auth.signOut();
      setSummary(result);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  const isBusy = phase === "authing" || phase === "pushing";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.screenBg }} contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Stack.Screen options={{ title: "Cloud sync", presentation: "modal" }} />
      <Text style={{ fontSize: 14, color: colors.muted }}>
        Push this device's books to your FastTrack cloud account. Everything stays on the phone;
        the dashboard at fasttrack.app reads the copy.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        accessibilityLabel="Password"
      />
      <PrimaryButton
        label={isBusy ? "Working…" : mode === "signin" ? "Sign in & push" : "Create account"}
        onPress={linkAndPush}
        disabled={isBusy}
      />
      <Text
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}
      >
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </Text>
      {isBusy && <ActivityIndicator />}
      {message && <Text style={{ color: phase === "error" ? colors.red : colors.muted }}>{message}</Text>}
      {summary && (
        <View style={{ gap: 4 }}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>Pushed to cloud ✓</Text>
          {summary.map((s) => (
            <Text key={s.table} style={{ fontSize: 13, color: colors.muted }}>
              {s.table}: {s.count}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
```

Adjust to reality while building: the actual button component export, TextInput styling wrapper if one exists, theme color names (`colors.green`/`red`/`ink`/`muted`/`screenBg` — read `src/theme.ts` and use what's there). Keep inputs styled like `onboarding.tsx`.

- [ ] **Step 2: Home entry point**

In `apps/mobile/src/app/(tabs)/index.tsx`, add a header/link affordance navigating to `/sync` (e.g. a cloud `Icon` in the existing header row):

```tsx
import { Link } from "expo-router";
// inside the header row JSX:
<Link href="/sync" accessibilityLabel="Cloud sync">
  <Icon name="cloud" size={22} color={colors.muted} />
</Link>
```

Use the app's actual `Icon` API (`src/components/ui/Icon.tsx`) — if there is no cloud glyph, add one there following the existing SVG pattern.

- [ ] **Step 3: Verify**

Run: `pnpm --filter mobile typecheck && pnpm --filter mobile test && pnpm --filter mobile exec expo export --platform web`
Expected: all clean.

Runtime check (browser pane, launch.json "mobile", port 8082): open the app, navigate Home → cloud icon → sync screen renders. Verify with `get_page_text`/`read_page`, NOT screenshots (known timeout with this app). Full end-to-end push happens in Task 9 against the live DB.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/sync.tsx apps/mobile/src/app/_layout.tsx "apps/mobile/src/app/(tabs)/index.tsx" apps/mobile/src/components/ui/Icon.tsx
git commit -m "feat(mobile): cloud sync screen - email auth link and one-tap push"
```

---

### Task 8: Playwright E2E for the web dashboard

**Files:**
- Modify: `apps/web/package.json` (devDep `"@playwright/test": "^1.48.0"`, script `"e2e": "playwright test"`)
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/auth.setup.ts`, `apps/web/e2e/dashboard.spec.ts`
- Modify: `.gitignore` (`apps/web/e2e/.auth/`, `apps/web/playwright-report/`, `apps/web/test-results/`)

- [ ] **Step 1: Install**

```bash
pnpm --filter web add -D @playwright/test
pnpm --filter web exec playwright install chromium
```

- [ ] **Step 2: Config**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL: "http://localhost:3400" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev -p 3400",
    url: "http://localhost:3400/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Auth setup (logs in once, saves cookies)**

`apps/web/e2e/auth.setup.ts`:

```ts
import { expect, test as setup } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@fasttrack.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "FastTrack-Demo-2026!";

setup("authenticate as the demo org", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  await expect(page.locator("h1")).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
```

- [ ] **Step 4: Dashboard smoke — all 12 screens + auth redirect**

`apps/web/e2e/dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

/** route → a string that must appear once the screen rendered with data. */
const SCREENS: ReadonlyArray<readonly [string, RegExp]> = [
  ["/", /./],
  ["/spend", /./],
  ["/budgets", /./],
  ["/tips", /./],
  ["/revenue", /./],
  ["/profit", /./],
  ["/jobs", /./],
  ["/clients", /./],
  ["/invoices", /./],
  ["/expenses", /./],
  ["/reports", /./],
  ["/settings", /./],
];

for (const [route, heading] of SCREENS) {
  test(`renders ${route} without a crash`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("h1").first()).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test("home shows the live health gauge, not the old hardcoded 72", async ({ page }) => {
  await page.goto("/");
  // The gauge renders a numeric score; assert a number is present in the hero region.
  await expect(page.locator("main")).toContainText(/\d+/);
});

test("invoices screen lists the demo org's invoices", async ({ page }) => {
  await page.goto("/invoices");
  await expect(page.locator("table tbody tr, [role=row]").first()).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("dashboard redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
```

While implementing, STRENGTHEN the per-screen assertion: open each page component under `apps/web/src/app/(dash)/`, lift its real `<h1>` text into the `SCREENS` regex (e.g. `/Financial Position/i` for `/`), replacing the `/./` placeholders — the table above is scaffolding, the commit must carry real headings. E2E must be read-only: no clicks that mutate demo data.

- [ ] **Step 5: Run**

Run: `pnpm --filter web e2e`
Expected: 16 passed (12 screens + gauge + invoices + redirect + setup). Requires `apps/web/.env.local` (already present from Plan 3).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts apps/web/e2e .gitignore pnpm-lock.yaml
git commit -m "test(web): playwright e2e - auth, 12-screen smoke, live gauge, invoice list"
```

---

### Task 9: Live verification — reconciliation check, real push, advisors

No code; MCP + device checklist. (Supabase MCP tools load via ToolSearch.)

- [ ] **Step 1: Template reconciliation probe**

Via MCP `execute_sql` against `sxmazpcygbkyclmclexw`:

```sql
select trade, kind, name, unit, unit_cost_cents, default_markup_pct
from public.price_book_templates
order by trade, kind, name;
```

Compare field-for-field against `packages/schema/src/priceBookTemplates.ts` (31 rows). If drifted: the TS module is now canonical — write a new migration `reconcile_price_book_templates` updating the table to match, apply via MCP `apply_migration`. If identical: record "verified identical" in the execution notes, no migration.

- [ ] **Step 2: Real end-to-end push (fresh account, NOT demo)**

On the Expo Go device (or web export): create a throwaway account via the sync screen's sign-up (use a real inbox — Supabase sends a confirmation email), confirm, sign in, push. Then verify via MCP:

```sql
select o.name, (select count(*) from clients c where c.org_id = o.id) as clients,
       (select count(*) from price_book_items p where p.org_id = o.id) as price_book,
       (select count(*) from expense_categories e where e.org_id = o.id) as categories
from organizations o
join memberships m on m.org_id = o.id
join users u on u.id = m.user_id
where u.email = '<throwaway email>';
```

Expected: the mobile org row with its price-book slice and 8 categories. Re-run the push — second run must succeed (idempotent) with identical counts. Sign into the web dashboard with the throwaway account: the mobile org's numbers render.

- [ ] **Step 3: Security gate**

MCP `get_advisors` (security + performance) — no new CRITICAL/HIGH findings beyond the three accepted notes recorded in the Plan 2 doc. New findings: stop, fix, re-run.

- [ ] **Step 4: Record**

Append an execution-record section to this plan doc (what was verified, throwaway account org id, advisor results).

```bash
git add docs/superpowers/plans/2026-07-16-plan-5-integration-sync-e2e.md
git commit -m "docs: plan 5 live verification record"
```

---

### Task 10: Full gates, then finish the branch

- [ ] **Step 1: Root gates**

Run: `pnpm build && pnpm test && pnpm typecheck`
Expected: all green across core, schema, rollups, web, mobile. Note: `apps/web` test script may now drop `--passWithNoTests` ONLY if a web unit test exists; otherwise leave it — the rollup tests live in `packages/rollups` by design.

- [ ] **Step 2: Mobile export regression**

Run: `pnpm --filter mobile exec expo export`
Expected: clean bundle, all platforms.

- [ ] **Step 3: E2E once more (fresh state)**

Run: `pnpm --filter web e2e`
Expected: all passing.

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` — full-history PR of `feat/core-money-engine` → `main` per the git-workflow rules (analyze all commits, `git diff main...HEAD`, comprehensive summary, test plan). Also update the FastTrack build-state memory: Plan 5 done, branch state, PowerSync/receipt-upload/pull-sync listed as the known deferred work.

---

## Execution record — 2026-07-17

Tasks 1–8 implemented and committed (`3e29ccc` → Task 8 commit). Commit chain:
`3e29ccc` templates→schema · `bf382a6` @fasttrack/rollups · `a987346` mobile shared health · `3fafbdb` mobile supabase client · `c453a3c` sync transforms · `f15a200` sync push · `d8188c0` sync screen · Task 8 e2e commit.

**Test/gate results**
- `@fasttrack/schema`: 63 tests pass (incl. new 31-row template guard).
- `@fasttrack/rollups`: 8 tests pass (computeHealth, monthlySeries, agingBuckets, spend/budget, jobProfitability, buildTips).
- `mobile`: 95 tests pass (incl. transform ×4, push/collect ×4). typecheck clean. `expo export --platform web` clean.
- `web`: typecheck + build clean. **Playwright e2e: 16/16 pass** (auth setup, 12 screens by heading, live gauge via `role=img` "Health score N", invoice list, signed-out redirect).

**Bug fixed en route (surfaced by e2e):** the web *browser* Supabase client read `NEXT_PUBLIC_*` through a dynamic `process.env[name]` (`requireEnv`), which Next.js does not inline into the client bundle → sign-in threw "not configured". Fixed to literal static access in `apps/web/src/lib/supabase/client.ts`; server client keeps `requireEnv`. Without this, browser login never worked (latent since Plan 3).

**Task 9 — live verification**
- **Reconciliation (Step 1): VERIFIED IDENTICAL.** `price_book_templates` (31 rows) matches `packages/schema/src/priceBookTemplates.ts` field-for-field (trade, kind, name, unit, unit_cost_cents, default_markup_pct). No reconciliation migration written.
- **Advisors (Step 3): PASS — no new CRITICAL/HIGH.** Plan 5 added zero DDL, so findings are the Plan 2 baseline, all WARN/INFO and by-design:
  - Security (WARN): `organizations` INSERT bootstrap policy `WITH CHECK (true)` (the deliberate first-org onboarding path); `user_org_ids()` + `org_has_members()` SECURITY DEFINER RLS helpers callable by `authenticated` (the RLS backbone); project-level leaked-password protection disabled (auth setting, not schema).
  - Performance (INFO): unindexed FKs on media/budgets/line price_book refs; unused indexes on a low-traffic demo DB.
- **Real end-to-end push (Step 2): NOT RUN — needs the user.** Requires creating a fresh Supabase account + email confirmation + Expo Go on a device; account creation and email handling are outside what the agent performs. Everything up to the network round-trip is covered by offline tests (`push.test.ts` exercises collect/transform/bootstrap-order against the real migrated schema via sql.js). Residual unverified surface: the live RLS bootstrap INSERT under a real JWT and PostgREST accepting the row shapes. **User action:** on a device, open Home → cloud icon → Cloud sync → create a throwaway account (real inbox), confirm the email, sign in & push; then verify with the Step-2 SQL and sign into the web dashboard with that account.

**Deferred (known, carried to PowerSync revisit):** receipt/PDF *files* don't sync (only the path/URL strings); no pull/merge (push-only, last-writer-wins on `id`); invoice numbering stays a client-side per-org counter.
