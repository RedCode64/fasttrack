# Plan 1 — Shared Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish `packages/core` (estimate-level profitability + the health score) and build `packages/schema` (Zod row schemas for every entity) — the contracts both apps and the database plan inherit.

**Architecture:** `packages/core` stays dependency-free integer math on branded `Cents`/`BasisPoints`. `packages/schema` models **database rows exactly as Postgres/Supabase returns them** (snake_case keys), depends on core so parsed money fields come out branded and feed core math without casts. Strict objects everywhere — an unknown column is a bug, not data.

**Tech Stack:** TypeScript 5.6, Zod v4, Vitest 2, pnpm workspaces + Turborepo. Mirrors `packages/core`'s existing config exactly.

**Branch:** Execute on the current `feat/core-money-engine` branch — this plan *is* core+schema foundation work. Branch finishing strategy is decided at the end via superpowers:finishing-a-development-branch.

**Conventions the executor must know:**
- ESM with NodeNext resolution: **relative imports need the `.js` extension** (`./money.js`), exactly like the existing core files.
- Money rules (spec §4): integer cents, basis points for rates, `roundHalfUp` = half away from zero.
- Run tests from the repo root with `pnpm --filter <pkg> test`. All commands run in `C:\Users\pagan\Claude\App`.
- Commit messages: conventional commits, no attribution footer (user config).
- One deliberate deviation from spec §4: **`created_at` exists on every synced table**, not just `organizations`. List screens sort drafts whose `issued_at` is still null; LWW still keys on `updated_at`. Additive and harmless — carried into Plan 2's migrations.

---

## File structure

```
packages/core/src/
  profitability.ts        documentProfit — cost/revenue/profit/margin per document
  profitability.test.ts
  health.ts               healthScore — decision B formula, bands, summary text
  health.test.ts
  index.ts                (modify) export the new surface

packages/schema/
  package.json            @fasttrack/schema — deps: @fasttrack/core, zod
  tsconfig.json           copy of core's
  vitest.config.ts        copy of core's
  src/
    common.ts             field primitives: centsField, markupBpsField, uuid, timestamps, syncColumns
    enums.ts              status/kind/method/role/trade enums
    org.ts                organization, user, membership, tax_config
    client.ts             client
    job.ts                job
    priceBook.ts          price_book_item
    lines.ts              documentLineFields — the shape estimate/invoice lines share
    estimate.ts           estimate, estimate_line
    invoice.ts            invoice, invoice_line, payment
    expense.ts            expense, expense_category, budget
    media.ts              photo, signature
    index.ts              public barrel
    *.test.ts             one test file per module above
```

---

### Task 1: `documentProfit` in packages/core

The estimate screen leads with **Your cost · Profit · Margin** (reconciliation item 9 moved this into scope). Margin is **profit ÷ revenue** — not markup-on-cost — per the reconciliation's confirmed definition, with the zero-revenue guard the design mock lacks.

**Files:**
- Create: `packages/core/src/profitability.ts`
- Create: `packages/core/src/profitability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/profitability.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { cents } from "./money.js";
import { documentProfit } from "./profitability.js";

const line = (unitCostCents: number, unitPriceCents: number, quantity: number) => ({
  unitCostCents: cents(unitCostCents),
  unitPriceCents: cents(unitPriceCents),
  quantity,
});

describe("documentProfit", () => {
  it("computes cost, revenue, profit, and margin for the design's sample estimate", () => {
    // The four rows from FastTrack Mobile.dc.html, validated in the reconciliation doc.
    const lines = [
      line(42_000, 56_700, 1), // 200A panel — Square D QO, +35%
      line(31_000, 43_400, 1), // SER 4/0 aluminum cable, +40%
      line(34_000, 49_300, 1), // AFCI breakers, +45%
      line(104_000, 161_200, 1), // Labor — service change, +55%
    ];
    const result = documentProfit(lines, cents(0));
    expect(result.costCents).toBe(211_000);
    expect(result.revenueCents).toBe(310_600);
    expect(result.profitCents).toBe(99_600);
    expect(result.marginBps).toBe(3_207); // 99600/310600 = 32.067% → 3207 bps
  });

  it("treats a discount as reducing revenue and margin", () => {
    const result = documentProfit([line(50_000, 100_000, 1)], cents(20_000));
    expect(result.revenueCents).toBe(80_000);
    expect(result.profitCents).toBe(30_000);
    expect(result.marginBps).toBe(3_750);
  });

  it("rounds each line before summing, matching lineTotal's discipline", () => {
    // cost 3333 × 2.5 = 8332.5 → 8333; price 6666 × 2.5 = 16665
    const result = documentProfit([line(3_333, 6_666, 2.5)], cents(0));
    expect(result.costCents).toBe(8_333);
    expect(result.revenueCents).toBe(16_665);
    expect(result.profitCents).toBe(8_332);
  });

  it("returns zero margin for an empty document instead of NaN", () => {
    const result = documentProfit([], cents(0));
    expect(result.costCents).toBe(0);
    expect(result.revenueCents).toBe(0);
    expect(result.profitCents).toBe(0);
    expect(result.marginBps).toBe(0);
  });

  it("reports negative profit and margin when priced below cost", () => {
    const result = documentProfit([line(10_000, 8_000, 1)], cents(0));
    expect(result.profitCents).toBe(-2_000);
    expect(result.marginBps).toBe(-2_500);
  });

  it("rejects a negative discount", () => {
    expect(() => documentProfit([line(100, 200, 1)], cents(-1))).toThrow(RangeError);
  });

  it("rejects a discount exceeding the price subtotal", () => {
    expect(() => documentProfit([line(100, 200, 1)], cents(201))).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/core test -- profitability`
Expected: FAIL — cannot resolve `./profitability.js`

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/profitability.ts`:

```typescript
import {
  BASIS_POINTS_SCALE,
  basisPoints,
  cents,
  roundHalfUp,
  type BasisPoints,
  type Cents,
} from "./money.js";
import { lineTotal } from "./pricing.js";

export interface ProfitLine {
  readonly unitCostCents: Cents;
  readonly unitPriceCents: Cents;
  readonly quantity: number;
}

export interface DocumentProfit {
  readonly costCents: Cents;
  readonly revenueCents: Cents;
  readonly profitCents: Cents;
  readonly marginBps: BasisPoints;
}

/**
 * Computes what a document earns: cost, revenue, profit, and margin.
 *
 * Margin is profit ÷ revenue (not markup-on-cost), in basis points. Revenue is
 * the pre-tax, post-discount subtotal — tax passes through to the state and is
 * nobody's profit. A zero-revenue document has zero margin, never NaN.
 */
export function documentProfit(lines: readonly ProfitLine[], discount: Cents): DocumentProfit {
  let cost = 0;
  let subtotal = 0;
  for (const line of lines) {
    cost += lineTotal(line.unitCostCents, line.quantity);
    subtotal += lineTotal(line.unitPriceCents, line.quantity);
  }

  if (discount < 0) {
    throw new RangeError(`Discount must be non-negative, received ${discount}`);
  }
  if (discount > subtotal) {
    throw new RangeError(`Discount ${discount} exceeds subtotal ${subtotal}`);
  }

  const revenue = subtotal - discount;
  const profit = revenue - cost;
  const margin = revenue === 0 ? 0 : roundHalfUp((profit * BASIS_POINTS_SCALE) / revenue);

  return {
    costCents: cents(cost),
    revenueCents: cents(revenue),
    profitCents: cents(profit),
    marginBps: basisPoints(margin),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/core test -- profitability`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/profitability.ts packages/core/src/profitability.test.ts
git commit -m "feat(core): add documentProfit with profit-over-revenue margin"
```

---

### Task 2: `healthScore` in packages/core

Decision B. Replaces the design's hardcoded `SCORE = 72` with a defined, tested formula. Bands match the design gauge exactly (≥70 green, ≥55 amber, else red).

**Files:**
- Create: `packages/core/src/health.ts`
- Create: `packages/core/src/health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/health.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { basisPoints, cents } from "./money.js";
import { healthScore, type HealthInputs } from "./health.js";

const inputs = (overrides: Partial<HealthInputs> = {}): HealthInputs => ({
  marginBps: basisPoints(3_000),
  targetMarginBps: basisPoints(3_000),
  overdueCents: cents(0),
  outstandingCents: cents(0),
  collectedCents: cents(0),
  invoicedCents: cents(0),
  ...overrides,
});

describe("healthScore", () => {
  it("scores perfect books at 100 with the all-healthy summary", () => {
    const result = healthScore(inputs());
    expect(result.score).toBe(100);
    expect(result.marginComponent).toBe(100);
    expect(result.receivablesComponent).toBe(100);
    expect(result.collectionComponent).toBe(100);
    expect(result.band).toBe("good");
    expect(result.summary).toBe("Good — all systems healthy.");
  });

  it("blends the three components 40/30/30", () => {
    const result = healthScore(
      inputs({
        marginBps: basisPoints(2_400), // 2400/3000 → 80
        overdueCents: cents(2_210), // 100 − 2210×100/12450 = 82.25 → 82
        outstandingCents: cents(12_450),
        collectedCents: cents(9_800), // 9800×100/14200 = 69.01 → 69
        invoicedCents: cents(14_200),
      }),
    );
    expect(result.marginComponent).toBe(80);
    expect(result.receivablesComponent).toBe(82);
    expect(result.collectionComponent).toBe(69);
    expect(result.score).toBe(77); // (40×80 + 30×82 + 30×69)/100 = 77.3 → 77
    expect(result.band).toBe("good");
    expect(result.summary).toBe("Good — collections lagging invoicing.");
  });

  it("bands 55–69 as watch and names the weakest component, margin winning ties", () => {
    const result = healthScore(
      inputs({
        marginBps: basisPoints(1_500), // 50
        collectedCents: cents(5_000), // 50
        invoicedCents: cents(10_000),
      }),
    );
    expect(result.score).toBe(65); // (40×50 + 30×100 + 30×50)/100
    expect(result.band).toBe("watch");
    expect(result.summary).toBe("Watch — margins below target.");
  });

  it("bands below 55 as risk", () => {
    const result = healthScore(
      inputs({
        marginBps: basisPoints(0),
        overdueCents: cents(10_000),
        outstandingCents: cents(10_000),
        collectedCents: cents(0),
        invoicedCents: cents(10_000),
      }),
    );
    expect(result.score).toBe(0);
    expect(result.band).toBe("risk");
    expect(result.summary).toBe("At risk — margins below target.");
  });

  it("clamps components: margin above target and collection above invoiced cap at 100", () => {
    const result = healthScore(
      inputs({
        marginBps: basisPoints(5_000),
        collectedCents: cents(20_000), // collected last month's invoices too
        invoicedCents: cents(10_000),
      }),
    );
    expect(result.marginComponent).toBe(100);
    expect(result.collectionComponent).toBe(100);
  });

  it("clamps a negative margin to a zero component instead of going below zero", () => {
    const result = healthScore(inputs({ marginBps: basisPoints(-1_000) }));
    expect(result.marginComponent).toBe(0);
  });

  it("rejects a non-positive margin target", () => {
    expect(() => healthScore(inputs({ targetMarginBps: basisPoints(0) }))).toThrow(RangeError);
  });

  it("rejects negative money inputs", () => {
    expect(() => healthScore(inputs({ overdueCents: cents(-1) }))).toThrow(RangeError);
    expect(() => healthScore(inputs({ outstandingCents: cents(-1) }))).toThrow(RangeError);
    expect(() => healthScore(inputs({ collectedCents: cents(-1) }))).toThrow(RangeError);
    expect(() => healthScore(inputs({ invoicedCents: cents(-1) }))).toThrow(RangeError);
  });

  it("rejects overdue exceeding outstanding — overdue is a subset of outstanding", () => {
    expect(() =>
      healthScore(inputs({ overdueCents: cents(2), outstandingCents: cents(1) })),
    ).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/core test -- health`
Expected: FAIL — cannot resolve `./health.js`

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/health.ts`:

```typescript
import { roundHalfUp, type BasisPoints, type Cents } from "./money.js";

export interface HealthInputs {
  /** Realized margin over the reporting window (profit ÷ revenue, in bps). */
  readonly marginBps: BasisPoints;
  /** The org's target margin (default 3000 = 30.00%). Must be positive. */
  readonly targetMarginBps: BasisPoints;
  /** The overdue portion of outstanding receivables. Subset of outstanding. */
  readonly overdueCents: Cents;
  /** Total outstanding receivables (unpaid invoice balances). */
  readonly outstandingCents: Cents;
  /** Cash collected during the window. */
  readonly collectedCents: Cents;
  /** Total invoiced during the window. */
  readonly invoicedCents: Cents;
}

export type HealthBand = "good" | "watch" | "risk";

export interface HealthScore {
  readonly score: number;
  readonly marginComponent: number;
  readonly receivablesComponent: number;
  readonly collectionComponent: number;
  readonly band: HealthBand;
  readonly summary: string;
}

// Bands match the design gauge: ≥70 green, ≥55 amber, below that red.
const GOOD_THRESHOLD = 70;
const WATCH_THRESHOLD = 55;

// Decision B weights. Margin leads — it is the product's differentiator.
const MARGIN_WEIGHT = 40;
const RECEIVABLES_WEIGHT = 30;
const COLLECTION_WEIGHT = 30;

const BAND_PHRASES: Record<HealthBand, string> = {
  good: "Good",
  watch: "Watch",
  risk: "At risk",
};

const WEAKEST_PHRASES = {
  margin: "margins below target",
  receivables: "overdue receivables piling up",
  collection: "collections lagging invoicing",
} as const;

function clampComponent(value: number): number {
  return Math.min(100, Math.max(0, roundHalfUp(value)));
}

/**
 * The dashboard's headline number, defined (decision B in the roadmap):
 * 40% margin health + 30% receivables health + 30% collection health.
 *
 * Empty books score 100 on receivables and collection — no receivables means
 * nothing is overdue, not that something is wrong. The summary names the
 * weakest component so the gauge explains itself.
 */
export function healthScore(inputs: HealthInputs): HealthScore {
  if (inputs.targetMarginBps <= 0) {
    throw new RangeError(`Target margin must be positive, received ${inputs.targetMarginBps}`);
  }
  const moneyInputs = [
    inputs.overdueCents,
    inputs.outstandingCents,
    inputs.collectedCents,
    inputs.invoicedCents,
  ];
  for (const value of moneyInputs) {
    if (value < 0) {
      throw new RangeError(`Health inputs must be non-negative, received ${value}`);
    }
  }
  if (inputs.overdueCents > inputs.outstandingCents) {
    throw new RangeError(
      `Overdue ${inputs.overdueCents} exceeds outstanding ${inputs.outstandingCents}`,
    );
  }

  const marginComponent = clampComponent((inputs.marginBps * 100) / inputs.targetMarginBps);
  const receivablesComponent =
    inputs.outstandingCents === 0
      ? 100
      : clampComponent(100 - (inputs.overdueCents * 100) / inputs.outstandingCents);
  const collectionComponent =
    inputs.invoicedCents === 0
      ? 100
      : clampComponent((inputs.collectedCents * 100) / inputs.invoicedCents);

  const score = roundHalfUp(
    (MARGIN_WEIGHT * marginComponent +
      RECEIVABLES_WEIGHT * receivablesComponent +
      COLLECTION_WEIGHT * collectionComponent) /
      100,
  );
  const band: HealthBand =
    score >= GOOD_THRESHOLD ? "good" : score >= WATCH_THRESHOLD ? "watch" : "risk";

  let weakestKey: keyof typeof WEAKEST_PHRASES = "margin";
  let weakestValue = marginComponent;
  if (receivablesComponent < weakestValue) {
    weakestKey = "receivables";
    weakestValue = receivablesComponent;
  }
  if (collectionComponent < weakestValue) {
    weakestKey = "collection";
    weakestValue = collectionComponent;
  }

  const summary =
    marginComponent === 100 && receivablesComponent === 100 && collectionComponent === 100
      ? "Good — all systems healthy."
      : `${BAND_PHRASES[band]} — ${WEAKEST_PHRASES[weakestKey]}.`;

  return { score, marginComponent, receivablesComponent, collectionComponent, band, summary };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/core test -- health`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/health.ts packages/core/src/health.test.ts
git commit -m "feat(core): add healthScore with 40/30/30 margin/receivables/collection blend"
```

---

### Task 3: Export the new core surface

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Replace the file contents**

`packages/core/src/index.ts` becomes:

```typescript
export {
  BASIS_POINTS_SCALE,
  basisPoints,
  cents,
  roundHalfUp,
  type BasisPoints,
  type Cents,
} from "./money.js";
export { lineTotal, priceFromCost } from "./pricing.js";
export { documentTotals, type DocumentTotals, type TotalsLine } from "./totals.js";
export { documentProfit, type DocumentProfit, type ProfitLine } from "./profitability.js";
export { healthScore, type HealthBand, type HealthInputs, type HealthScore } from "./health.js";
```

- [ ] **Step 2: Verify the whole package**

Run: `pnpm --filter @fasttrack/core test && pnpm --filter @fasttrack/core build`
Expected: all tests PASS (existing modules + 16 new tests), build emits `dist/` cleanly

- [ ] **Step 3: Commit**

```bash
git add -A packages/core
git commit -m "feat(core): export profitability and health score surface"
```

---

### Task 4: Scaffold `packages/schema`

**Files:**
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/vitest.config.ts`
- Create: `packages/schema/src/index.ts`

- [ ] **Step 1: Create `packages/schema/package.json`**

```json
{
  "name": "@fasttrack/schema",
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
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/schema/tsconfig.json`** (identical shape to core's)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Create `packages/schema/vitest.config.ts`** (identical to core's)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] },
  },
});
```

- [ ] **Step 4: Create `packages/schema/src/index.ts`** with placeholder content (replaced in Task 14):

```typescript
export {};
```

- [ ] **Step 5: Install and verify**

Run: `pnpm install && pnpm --filter @fasttrack/core build && pnpm --filter @fasttrack/schema typecheck`
Expected: install resolves zod 4.x, core builds (schema's tests import its dist), typecheck passes

- [ ] **Step 6: Commit**

```bash
git add packages/schema pnpm-lock.yaml
git commit -m "chore(schema): scaffold @fasttrack/schema package"
```

---

### Task 5: Field primitives — `common.ts`

Every money/id/time column in every table parses through these. Money fields **transform to core's branded types**, so a parsed row feeds `priceFromCost`/`documentTotals` with no casting.

**Files:**
- Create: `packages/schema/src/common.ts`
- Create: `packages/schema/src/common.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/common.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  centsField,
  markupBpsField,
  positiveCentsField,
  quantityField,
  timestampField,
  uuidField,
} from "./common.js";

describe("centsField", () => {
  it("accepts zero and integer cents", () => {
    expect(centsField.parse(0)).toBe(0);
    expect(centsField.parse(56_700)).toBe(56_700);
  });
  it("rejects floats", () => {
    expect(() => centsField.parse(12.5)).toThrow();
  });
  it("rejects negatives", () => {
    expect(() => centsField.parse(-1)).toThrow();
  });
});

describe("positiveCentsField", () => {
  it("rejects zero — a zero-cent payment or expense is meaningless", () => {
    expect(() => positiveCentsField.parse(0)).toThrow();
    expect(positiveCentsField.parse(1)).toBe(1);
  });
});

describe("markupBpsField", () => {
  it("accepts markdowns down to -100%, the floor priceFromCost accepts", () => {
    expect(markupBpsField.parse(-10_000)).toBe(-10_000);
    expect(markupBpsField.parse(3_500)).toBe(3_500);
  });
  it("rejects below -100%", () => {
    expect(() => markupBpsField.parse(-10_001)).toThrow();
  });
});

describe("quantityField", () => {
  it("accepts fractional quantities — 2.5 hours, 13.75 feet", () => {
    expect(quantityField.parse(2.5)).toBe(2.5);
  });
  it("rejects Infinity and negatives", () => {
    expect(() => quantityField.parse(Infinity)).toThrow();
    expect(() => quantityField.parse(-1)).toThrow();
  });
});

describe("timestampField", () => {
  it("accepts Supabase timestamptz output", () => {
    expect(timestampField.parse("2026-07-16T12:34:56.789+00:00")).toBe(
      "2026-07-16T12:34:56.789+00:00",
    );
  });
  it("accepts Zulu timestamps", () => {
    expect(timestampField.parse("2026-07-16T12:34:56Z")).toBe("2026-07-16T12:34:56Z");
  });
  it("rejects bare dates", () => {
    expect(() => timestampField.parse("2026-07-16")).toThrow();
  });
});

describe("uuidField", () => {
  it("accepts v4 uuids", () => {
    expect(uuidField.parse("8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b")).toBe(
      "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
    );
  });
  it("rejects non-uuids", () => {
    expect(() => uuidField.parse("not-a-uuid")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test`
Expected: FAIL — cannot resolve `./common.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/common.ts`:

```typescript
import { basisPoints, cents, type BasisPoints, type Cents } from "@fasttrack/core";
import { z } from "zod";

/** Integer cents, never negative. Brands to Cents so rows feed core math directly. */
export const centsField = z
  .number()
  .int()
  .min(0)
  .transform((n): Cents => cents(n));

/** Integer cents, strictly positive — payments and expenses can't be zero. */
export const positiveCentsField = z
  .number()
  .int()
  .min(1)
  .transform((n): Cents => cents(n));

/** Integer cents that may go negative (an overpaid invoice balance). */
export const signedCentsField = z
  .number()
  .int()
  .transform((n): Cents => cents(n));

/** Markup in basis points. -10000 (a 100% markdown) is the floor priceFromCost accepts. */
export const markupBpsField = z
  .number()
  .int()
  .min(-10_000)
  .transform((n): BasisPoints => basisPoints(n));

/** Non-negative rate in basis points (tax rates, target margins). */
export const rateBpsField = z
  .number()
  .int()
  .min(0)
  .transform((n): BasisPoints => basisPoints(n));

/** Quantities are floats — trades bill 2.5 hours, 13.75 feet. */
export const quantityField = z.number().finite().nonnegative();

export const uuidField = z.uuid();

/** Postgres timestamptz as Supabase returns it, e.g. 2026-07-16T12:34:56.789+00:00 */
export const timestampField = z.iso.datetime({ offset: true });

/** Calendar date, e.g. 2026-07-16 */
export const dateField = z.iso.date();

/**
 * Columns every synced row carries (spec §4 rules): created_at for stable list
 * ordering, updated_at for last-write-wins, deleted_at because hard deletes
 * do not sync.
 */
export const syncColumns = {
  created_at: timestampField,
  updated_at: timestampField,
  deleted_at: timestampField.nullable(),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/common.ts packages/schema/src/common.test.ts
git commit -m "feat(schema): add branded field primitives and sync columns"
```

---

### Task 6: Enums — `enums.ts`

**Files:**
- Create: `packages/schema/src/enums.ts`
- Create: `packages/schema/src/enums.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/enums.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  estimateStatusSchema,
  invoiceStatusSchema,
  jobStatusSchema,
  lineKindSchema,
  membershipRoleSchema,
  paymentMethodSchema,
  priceBookKindSchema,
  tradeSchema,
} from "./enums.js";

describe("status enums", () => {
  it("job status includes in_progress — the dashboard renders it (reconciliation)", () => {
    expect(jobStatusSchema.parse("in_progress")).toBe("in_progress");
    expect(() => jobStatusSchema.parse("cancelled")).toThrow();
  });

  it("estimate status covers the full spec lifecycle", () => {
    for (const s of ["draft", "sent", "viewed", "accepted", "declined", "expired"]) {
      expect(estimateStatusSchema.parse(s)).toBe(s);
    }
  });

  it("invoice status includes partial", () => {
    expect(invoiceStatusSchema.parse("partial")).toBe("partial");
    expect(() => invoiceStatusSchema.parse("accepted")).toThrow();
  });
});

describe("payment methods", () => {
  it("includes bank_transfer (reconciliation item 7)", () => {
    expect(paymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer");
  });
  it("rejects raw card — card processing is R5", () => {
    expect(() => paymentMethodSchema.parse("card")).toThrow();
  });
});

describe("kinds and roles", () => {
  it("lines can be material, labor, or other; price book only material or labor", () => {
    expect(lineKindSchema.parse("other")).toBe("other");
    expect(() => priceBookKindSchema.parse("other")).toThrow();
  });
  it("membership roles are owner and member", () => {
    expect(membershipRoleSchema.parse("owner")).toBe("owner");
    expect(() => membershipRoleSchema.parse("admin")).toThrow();
  });
  it("trades cover the launch verticals", () => {
    expect(tradeSchema.parse("electrical")).toBe("electrical");
    expect(tradeSchema.parse("other")).toBe("other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- enums`
Expected: FAIL — cannot resolve `./enums.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/enums.ts`:

```typescript
import { z } from "zod";

export const jobStatusSchema = z.enum(["lead", "quoted", "in_progress", "complete", "lost"]);
export const estimateStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
]);
export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
]);
export const paymentMethodSchema = z.enum([
  "check",
  "cash",
  "zelle",
  "bank_transfer",
  "card_other",
]);
export const lineKindSchema = z.enum(["material", "labor", "other"]);
export const priceBookKindSchema = z.enum(["material", "labor"]);
export const membershipRoleSchema = z.enum(["owner", "member"]);
export const tradeSchema = z.enum([
  "electrical",
  "plumbing",
  "hvac",
  "general_contracting",
  "handyman",
  "other",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type EstimateStatus = z.infer<typeof estimateStatusSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type LineKind = z.infer<typeof lineKindSchema>;
export type PriceBookKind = z.infer<typeof priceBookKindSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Trade = z.infer<typeof tradeSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- enums`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/enums.ts packages/schema/src/enums.test.ts
git commit -m "feat(schema): add status, kind, method, role, and trade enums"
```

---

### Task 7: Organization, user, membership — `org.ts`

**Files:**
- Create: `packages/schema/src/org.ts`
- Create: `packages/schema/src/org.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/org.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { membershipSchema, organizationSchema, userSchema } from "./org.js";

const validOrg = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  name: "Pagan Electric LLC",
  logo_url: null,
  address: "12 Main St, Springfield",
  license_no: "EC-13445",
  trade: "electrical",
  tax_config: { name: "Sales Tax", rate_bps: 825 },
  target_margin_bps: 3_000,
  created_at: "2026-07-16T12:00:00+00:00",
};

describe("organizationSchema", () => {
  it("parses a valid organization", () => {
    const parsed = organizationSchema.parse(validOrg);
    expect(parsed.tax_config.rate_bps).toBe(825);
    expect(parsed.target_margin_bps).toBe(3_000);
  });

  it("rejects unknown columns — strict objects catch schema drift", () => {
    expect(() => organizationSchema.parse({ ...validOrg, stripe_id: "x" })).toThrow();
  });

  it("rejects a target margin of zero or 100%+ — healthScore requires positive", () => {
    expect(() => organizationSchema.parse({ ...validOrg, target_margin_bps: 0 })).toThrow();
    expect(() => organizationSchema.parse({ ...validOrg, target_margin_bps: 10_000 })).toThrow();
  });
});

describe("userSchema", () => {
  it("validates email", () => {
    expect(() =>
      userSchema.parse({
        id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
        email: "not-an-email",
        name: "Sam",
      }),
    ).toThrow();
  });
});

describe("membershipSchema", () => {
  it("parses an owner membership — the R1 tenancy row for a solo operator", () => {
    const parsed = membershipSchema.parse({
      id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      user_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
      role: "owner",
    });
    expect(parsed.role).toBe("owner");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- org`
Expected: FAIL — cannot resolve `./org.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/org.ts`:

```typescript
import { z } from "zod";
import { rateBpsField, timestampField, uuidField } from "./common.js";
import { membershipRoleSchema, tradeSchema } from "./enums.js";

/** Org-level tax config: one default rate applied to taxable lines. */
export const taxConfigSchema = z.strictObject({
  name: z.string().min(1),
  rate_bps: rateBpsField,
});

export const organizationSchema = z.strictObject({
  id: uuidField,
  name: z.string().min(1),
  logo_url: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  license_no: z.string().min(1).nullable(),
  trade: tradeSchema,
  tax_config: taxConfigSchema,
  // Margin target the health score measures against. 1–9999 bps: zero would
  // give healthScore nothing to divide by, and a 100% margin is not a target.
  target_margin_bps: z.number().int().min(1).max(9_999),
  created_at: timestampField,
});

/** Mirrors auth.users — id equals the Supabase auth uid. */
export const userSchema = z.strictObject({
  id: uuidField,
  email: z.email(),
  name: z.string().min(1),
});

/**
 * The tenancy model (spec §5 note): RLS resolves org_id through memberships,
 * so this ships in R1 even though team management UI does not.
 */
export const membershipSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  user_id: uuidField,
  role: membershipRoleSchema,
});

export type TaxConfig = z.infer<typeof taxConfigSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- org`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/org.ts packages/schema/src/org.test.ts
git commit -m "feat(schema): add organization, user, and membership schemas"
```

---

### Task 8: Clients and jobs — `client.ts`, `job.ts`

**Files:**
- Create: `packages/schema/src/client.ts`
- Create: `packages/schema/src/client.test.ts`
- Create: `packages/schema/src/job.ts`
- Create: `packages/schema/src/job.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/schema/src/client.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { clientSchema } from "./client.js";

const validClient = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  name: "R. Novak",
  email: "novak@example.com",
  phone: "555-0142",
  address: "88 Cedar Ave",
  notes: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("clientSchema", () => {
  it("parses a valid client", () => {
    expect(clientSchema.parse(validClient).name).toBe("R. Novak");
  });

  it("parses a soft-deleted client — deletes sync, they don't disappear", () => {
    const parsed = clientSchema.parse({
      ...validClient,
      deleted_at: "2026-07-16T13:00:00+00:00",
    });
    expect(parsed.deleted_at).toBe("2026-07-16T13:00:00+00:00");
  });

  it("rejects a client without org_id — every table carries the tenant key", () => {
    const { org_id: _omitted, ...withoutOrg } = validClient;
    expect(() => clientSchema.parse(withoutOrg)).toThrow();
  });
});
```

Create `packages/schema/src/job.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { jobSchema } from "./job.js";

const validJob = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  client_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
  title: "Panel upgrade",
  address: "88 Cedar Ave",
  scheduled_at: null,
  status: "quoted",
  notes: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("jobSchema", () => {
  it("parses the job an estimate implicitly creates: client + title (decision 7)", () => {
    const parsed = jobSchema.parse(validJob);
    expect(parsed.title).toBe("Panel upgrade");
    expect(parsed.status).toBe("quoted");
  });

  it("accepts in_progress — the dashboard renders it", () => {
    expect(jobSchema.parse({ ...validJob, status: "in_progress" }).status).toBe("in_progress");
  });

  it("rejects an empty title — the implicit-creation rule requires one", () => {
    expect(() => jobSchema.parse({ ...validJob, title: "" })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @fasttrack/schema test`
Expected: FAIL — cannot resolve `./client.js` and `./job.js`

- [ ] **Step 3: Write the implementations**

Create `packages/schema/src/client.ts`:

```typescript
import { z } from "zod";
import { syncColumns, uuidField } from "./common.js";

export const clientSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  name: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  notes: z.string().nullable(),
  ...syncColumns,
});

export type Client = z.infer<typeof clientSchema>;
```

Create `packages/schema/src/job.ts`:

```typescript
import { z } from "zod";
import { syncColumns, timestampField, uuidField } from "./common.js";
import { jobStatusSchema } from "./enums.js";

/**
 * The spine of the data model (spec decision 5). Created implicitly by the
 * first estimate drafted for a client + title (decision 7) — there is no Jobs
 * tab on mobile, but every document and expense hangs off one of these rows.
 */
export const jobSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  client_id: uuidField,
  title: z.string().min(1),
  address: z.string().min(1).nullable(),
  scheduled_at: timestampField.nullable(),
  status: jobStatusSchema,
  notes: z.string().nullable(),
  ...syncColumns,
});

export type Job = z.infer<typeof jobSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @fasttrack/schema test`
Expected: PASS — client 3 tests, job 3 tests, plus all prior

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/client.ts packages/schema/src/client.test.ts packages/schema/src/job.ts packages/schema/src/job.test.ts
git commit -m "feat(schema): add client and job schemas"
```

---

### Task 9: Price book — `priceBook.ts`

**Files:**
- Create: `packages/schema/src/priceBook.ts`
- Create: `packages/schema/src/priceBook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/priceBook.test.ts`:

```typescript
import { priceFromCost } from "@fasttrack/core";
import { describe, expect, it } from "vitest";
import { priceBookItemSchema } from "./priceBook.js";

const validItem = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  kind: "material",
  name: "200A panel — Square D QO",
  unit: "ea",
  unit_cost_cents: 42_000,
  default_markup_pct: 3_500,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("priceBookItemSchema", () => {
  it("parses an item whose branded fields feed core math directly", () => {
    const parsed = priceBookItemSchema.parse(validItem);
    // No casts: parse output is Cents/BasisPoints — the design's $420 +35% → $567.
    expect(priceFromCost(parsed.unit_cost_cents, parsed.default_markup_pct)).toBe(56_700);
  });

  it("rejects float cents — money is integer cents, never floats", () => {
    expect(() => priceBookItemSchema.parse({ ...validItem, unit_cost_cents: 420.5 })).toThrow();
  });

  it("rejects kind other — the price book holds materials and labor only", () => {
    expect(() => priceBookItemSchema.parse({ ...validItem, kind: "other" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- priceBook`
Expected: FAIL — cannot resolve `./priceBook.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/priceBook.ts`:

```typescript
import { z } from "zod";
import { centsField, markupBpsField, syncColumns, uuidField } from "./common.js";
import { priceBookKindSchema } from "./enums.js";

/**
 * Reusable catalog rows, pre-seeded by trade at onboarding. Lines snapshot
 * cost and markup at write time — editing an item never rewrites a sent
 * document (spec §4, "snapshotted, not computed").
 */
export const priceBookItemSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  kind: priceBookKindSchema,
  name: z.string().min(1),
  unit: z.string().min(1),
  unit_cost_cents: centsField,
  default_markup_pct: markupBpsField,
  ...syncColumns,
});

export type PriceBookItem = z.infer<typeof priceBookItemSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- priceBook`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/priceBook.ts packages/schema/src/priceBook.test.ts
git commit -m "feat(schema): add price book item schema"
```

---

### Task 10: Shared line shape and estimates — `lines.ts`, `estimate.ts`

**Files:**
- Create: `packages/schema/src/lines.ts`
- Create: `packages/schema/src/estimate.ts`
- Create: `packages/schema/src/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/estimate.test.ts`:

```typescript
import { priceFromCost } from "@fasttrack/core";
import { describe, expect, it } from "vitest";
import { estimateLineSchema, estimateSchema } from "./estimate.js";

const validLine = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  estimate_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
  sort_order: 0,
  kind: "material",
  description: "200A panel — Square D QO",
  quantity: 1,
  unit: "ea",
  unit_cost_cents: 42_000,
  markup_pct: 3_500,
  unit_price_cents: 56_700,
  is_taxable: true,
  price_book_item_id: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

const validEstimate = {
  id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  number: 1042,
  status: "draft",
  issued_at: null,
  expires_at: null,
  subtotal_cents: 310_600,
  tax_cents: 0,
  discount_cents: 0,
  total_cents: 310_600,
  notes: null,
  terms: null,
  pdf_url: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("estimateLineSchema", () => {
  it("parses the design's sample line, and its snapshotted price agrees with priceFromCost", () => {
    const parsed = estimateLineSchema.parse(validLine);
    expect(priceFromCost(parsed.unit_cost_cents, parsed.markup_pct)).toBe(
      parsed.unit_price_cents,
    );
  });

  it("stores both cost and price — snapshotted, not computed (spec §4)", () => {
    const parsed = estimateLineSchema.parse(validLine);
    expect(parsed.unit_cost_cents).toBe(42_000);
    expect(parsed.unit_price_cents).toBe(56_700);
  });

  it("accepts fractional quantities on labor", () => {
    const parsed = estimateLineSchema.parse({
      ...validLine,
      kind: "labor",
      description: "Service change",
      quantity: 2.5,
      unit: "hr",
    });
    expect(parsed.quantity).toBe(2.5);
  });

  it("rejects a line missing its estimate_id", () => {
    const { estimate_id: _omitted, ...withoutParent } = validLine;
    expect(() => estimateLineSchema.parse(withoutParent)).toThrow();
  });
});

describe("estimateSchema", () => {
  it("parses a draft with nothing issued yet", () => {
    const parsed = estimateSchema.parse(validEstimate);
    expect(parsed.status).toBe("draft");
    expect(parsed.issued_at).toBeNull();
  });

  it("rejects a zero or negative document number", () => {
    expect(() => estimateSchema.parse({ ...validEstimate, number: 0 })).toThrow();
  });

  it("rejects unknown columns", () => {
    expect(() => estimateSchema.parse({ ...validEstimate, margin_cents: 1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- estimate`
Expected: FAIL — cannot resolve `./estimate.js`

- [ ] **Step 3: Write the implementations**

Create `packages/schema/src/lines.ts`:

```typescript
import { z } from "zod";
import {
  centsField,
  markupBpsField,
  quantityField,
  syncColumns,
  uuidField,
} from "./common.js";
import { lineKindSchema } from "./enums.js";

/**
 * The line shape estimates and invoices share (spec §4: the shared shape lives
 * in packages, not in a polymorphic table). Cost AND price are snapshotted at
 * write time: price books mutate, a sent document never does.
 */
export const documentLineFields = {
  id: uuidField,
  org_id: uuidField,
  sort_order: z.number().int().min(0),
  kind: lineKindSchema,
  description: z.string().min(1),
  quantity: quantityField,
  unit: z.string().min(1),
  unit_cost_cents: centsField,
  markup_pct: markupBpsField,
  unit_price_cents: centsField,
  is_taxable: z.boolean(),
  price_book_item_id: uuidField.nullable(),
  ...syncColumns,
};
```

Create `packages/schema/src/estimate.ts`:

```typescript
import { z } from "zod";
import { centsField, syncColumns, timestampField, uuidField } from "./common.js";
import { estimateStatusSchema } from "./enums.js";
import { documentLineFields } from "./lines.js";

export const estimateLineSchema = z.strictObject({
  ...documentLineFields,
  estimate_id: uuidField,
});

export const estimateSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  // Client-assigned per-org counter (spec §7 risk: single-device only in R1).
  number: z.number().int().min(1),
  status: estimateStatusSchema,
  issued_at: timestampField.nullable(),
  expires_at: timestampField.nullable(),
  subtotal_cents: centsField,
  tax_cents: centsField,
  discount_cents: centsField,
  total_cents: centsField,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  pdf_url: z.string().min(1).nullable(),
  ...syncColumns,
});

export type EstimateLine = z.infer<typeof estimateLineSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- estimate`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/lines.ts packages/schema/src/estimate.ts packages/schema/src/estimate.test.ts
git commit -m "feat(schema): add estimate schemas with shared document line shape"
```

---

### Task 11: Invoices and payments — `invoice.ts`

**Files:**
- Create: `packages/schema/src/invoice.ts`
- Create: `packages/schema/src/invoice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/invoice.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { invoiceLineSchema, invoiceSchema, paymentSchema } from "./invoice.js";

const validInvoice = {
  id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  converted_from_estimate_id: "5a3c0a5e-6d7f-4b9c-8e1f-3a4b5c6d7e8f",
  number: 2001,
  status: "partial",
  issued_at: "2026-07-10T09:00:00+00:00",
  due_at: "2026-08-09T09:00:00+00:00",
  subtotal_cents: 310_600,
  tax_cents: 0,
  discount_cents: 0,
  total_cents: 310_600,
  balance_cents: 110_600,
  notes: null,
  terms: "Net 30",
  pdf_url: null,
  created_at: "2026-07-10T09:00:00+00:00",
  updated_at: "2026-07-14T09:00:00+00:00",
  deleted_at: null,
};

const validPayment = {
  id: "6b4d1b6f-7e8a-4c0d-9f2a-4b5c6d7e8f9a",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  invoice_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  amount_cents: 200_000,
  method: "bank_transfer",
  paid_at: "2026-07-14T09:00:00+00:00",
  reference: null,
  notes: null,
  created_at: "2026-07-14T09:00:00+00:00",
  updated_at: "2026-07-14T09:00:00+00:00",
  deleted_at: null,
};

describe("invoiceSchema", () => {
  it("parses a partially-paid converted invoice with a link back to its estimate", () => {
    const parsed = invoiceSchema.parse(validInvoice);
    expect(parsed.converted_from_estimate_id).toBe("5a3c0a5e-6d7f-4b9c-8e1f-3a4b5c6d7e8f");
    expect(parsed.balance_cents).toBe(110_600);
  });

  it("allows a negative balance — overpayment happens in the real world", () => {
    expect(invoiceSchema.parse({ ...validInvoice, balance_cents: -5_000 }).balance_cents).toBe(
      -5_000,
    );
  });

  it("parses an invoice created from scratch — conversion link is nullable", () => {
    expect(
      invoiceSchema.parse({ ...validInvoice, converted_from_estimate_id: null })
        .converted_from_estimate_id,
    ).toBeNull();
  });
});

describe("invoiceLineSchema", () => {
  it("carries invoice_id instead of estimate_id, same shape otherwise", () => {
    const parsed = invoiceLineSchema.parse({
      id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      invoice_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
      sort_order: 0,
      kind: "labor",
      description: "Service change",
      quantity: 16,
      unit: "hr",
      unit_cost_cents: 6_500,
      markup_pct: 5_500,
      unit_price_cents: 10_075,
      is_taxable: false,
      price_book_item_id: null,
      created_at: "2026-07-10T09:00:00+00:00",
      updated_at: "2026-07-10T09:00:00+00:00",
      deleted_at: null,
    });
    expect(parsed.invoice_id).toBe("3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d");
  });
});

describe("paymentSchema", () => {
  it("parses the design's bank transfer payment", () => {
    expect(paymentSchema.parse(validPayment).method).toBe("bank_transfer");
  });

  it("rejects a zero-amount payment", () => {
    expect(() => paymentSchema.parse({ ...validPayment, amount_cents: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- invoice`
Expected: FAIL — cannot resolve `./invoice.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/invoice.ts`:

```typescript
import { z } from "zod";
import {
  centsField,
  positiveCentsField,
  signedCentsField,
  syncColumns,
  timestampField,
  uuidField,
} from "./common.js";
import { invoiceStatusSchema, paymentMethodSchema } from "./enums.js";
import { documentLineFields } from "./lines.js";

export const invoiceLineSchema = z.strictObject({
  ...documentLineFields,
  invoice_id: uuidField,
});

export const invoiceSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  /** Set when converted from an estimate; null when drafted directly. */
  converted_from_estimate_id: uuidField.nullable(),
  number: z.number().int().min(1),
  status: invoiceStatusSchema,
  issued_at: timestampField.nullable(),
  due_at: timestampField.nullable(),
  subtotal_cents: centsField,
  tax_cents: centsField,
  discount_cents: centsField,
  total_cents: centsField,
  /** total − payments. Signed: overpayment drives it negative. */
  balance_cents: signedCentsField,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  pdf_url: z.string().min(1).nullable(),
  ...syncColumns,
});

/** Recorded payments only in R1 — processing cards is R5 (spec decision 3). */
export const paymentSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  invoice_id: uuidField,
  amount_cents: positiveCentsField,
  method: paymentMethodSchema,
  paid_at: timestampField,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  ...syncColumns,
});

export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Payment = z.infer<typeof paymentSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- invoice`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/invoice.ts packages/schema/src/invoice.test.ts
git commit -m "feat(schema): add invoice, invoice line, and payment schemas"
```

---

### Task 12: Expenses and budgets — `expense.ts`

Decision A pulls these forward from R2, with the reconciliation's additions: `vendor`, `is_billable` distinct from `job_id`, OCR-ready receipt fields.

**Files:**
- Create: `packages/schema/src/expense.ts`
- Create: `packages/schema/src/expense.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/expense.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { budgetSchema, expenseCategorySchema, expenseSchema } from "./expense.js";

const validExpense = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  category_id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
  vendor: "City Electric Supply",
  description: "Breakers and wire",
  amount_cents: 21_050,
  spent_at: "2026-07-14",
  is_billable: true,
  receipt_storage_path: "org/1c9e6c1a/receipts/r-001.jpg",
  ocr_extracted: null,
  created_at: "2026-07-14T15:00:00+00:00",
  updated_at: "2026-07-14T15:00:00+00:00",
  deleted_at: null,
};

describe("expenseSchema", () => {
  it("parses a billable job expense — a permit gets passed through to the client", () => {
    const parsed = expenseSchema.parse(validExpense);
    expect(parsed.is_billable).toBe(true);
    expect(parsed.job_id).not.toBeNull();
  });

  it("parses overhead: null job, not billable — the fuel tank scenario", () => {
    const parsed = expenseSchema.parse({
      ...validExpense,
      job_id: null,
      is_billable: false,
      vendor: "Shell",
    });
    expect(parsed.job_id).toBeNull();
  });

  it("keeps job attribution and billability independent (reconciliation item 4)", () => {
    // Attributable to the job but NOT billable — the distinction the old spec couldn't express.
    const parsed = expenseSchema.parse({ ...validExpense, is_billable: false });
    expect(parsed.job_id).not.toBeNull();
    expect(parsed.is_billable).toBe(false);
  });

  it("accepts OCR extraction payloads for later receipt scanning", () => {
    const parsed = expenseSchema.parse({
      ...validExpense,
      ocr_extracted: { vendor: "City Electric Supply", total_cents: 21050, confidence: 0.94 },
    });
    expect(parsed.ocr_extracted).not.toBeNull();
  });

  it("rejects a zero-amount expense", () => {
    expect(() => expenseSchema.parse({ ...validExpense, amount_cents: 0 })).toThrow();
  });
});

describe("expenseCategorySchema", () => {
  it("parses a category", () => {
    const parsed = expenseCategorySchema.parse({
      id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      name: "Materials",
      sort_order: 0,
      created_at: "2026-07-16T12:00:00+00:00",
      updated_at: "2026-07-16T12:00:00+00:00",
      deleted_at: null,
    });
    expect(parsed.name).toBe("Materials");
  });
});

describe("budgetSchema", () => {
  const validBudget = {
    id: "9d6f3d9c-0a1b-4e2f-b14c-6d7e8f9a0b1c",
    org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
    category_id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
    month: "2026-07-01",
    amount_cents: 500_000,
    created_at: "2026-07-01T00:00:00+00:00",
    updated_at: "2026-07-01T00:00:00+00:00",
    deleted_at: null,
  };

  it("parses a monthly category budget", () => {
    expect(budgetSchema.parse(validBudget).month).toBe("2026-07-01");
  });

  it("rejects a month that isn't the first of the month", () => {
    expect(() => budgetSchema.parse({ ...validBudget, month: "2026-07-15" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- expense`
Expected: FAIL — cannot resolve `./expense.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/expense.ts`:

```typescript
import { z } from "zod";
import {
  centsField,
  dateField,
  positiveCentsField,
  syncColumns,
  uuidField,
} from "./common.js";

/** Seeded defaults per org (Materials, Fuel, Permits, …); user-editable. */
export const expenseCategorySchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  name: z.string().min(1),
  sort_order: z.number().int().min(0),
  ...syncColumns,
});

/**
 * job_id answers "whose profitability does this cost reduce" (null = overhead);
 * is_billable answers "does this get passed through onto the client's invoice".
 * A permit is billable; the fuel driven to that job usually is not.
 * (Reconciliation item 4 — these are independent axes.)
 */
export const expenseSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField.nullable(),
  category_id: uuidField,
  vendor: z.string().min(1).nullable(),
  description: z.string().nullable(),
  amount_cents: positiveCentsField,
  spent_at: dateField,
  is_billable: z.boolean(),
  receipt_storage_path: z.string().min(1).nullable(),
  /**
   * Raw OCR extraction, kept verbatim when receipt scanning lands (roadmap
   * decision A: schema-ready now, feature later). Canonical values live in the
   * real columns; comparing against this shows what the user corrected.
   */
  ocr_extracted: z.record(z.string(), z.unknown()).nullable(),
  ...syncColumns,
});

/** One row per org × category × month. month is always the first of the month. */
export const budgetSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  category_id: uuidField,
  month: dateField.refine((d) => d.endsWith("-01"), {
    message: "Budget month must be the first of the month",
  }),
  amount_cents: centsField,
  ...syncColumns,
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Budget = z.infer<typeof budgetSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- expense`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/expense.ts packages/schema/src/expense.test.ts
git commit -m "feat(schema): add expense, category, and budget schemas with billable/job split"
```

---

### Task 13: Photos and signatures — `media.ts`

**Files:**
- Create: `packages/schema/src/media.ts`
- Create: `packages/schema/src/media.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/media.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { photoSchema, signatureSchema } from "./media.js";

const validPhoto = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  estimate_id: null,
  invoice_id: null,
  storage_path: "org/1c9e6c1a/photos/p-001.jpg",
  caption: "Before — corroded panel",
  taken_at: "2026-07-14T10:00:00+00:00",
  created_at: "2026-07-14T10:00:00+00:00",
  updated_at: "2026-07-14T10:00:00+00:00",
  deleted_at: null,
};

describe("photoSchema", () => {
  it("parses a job photo not attached to any document", () => {
    expect(photoSchema.parse(validPhoto).job_id).toBe("4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e");
  });

  it("parses a photo attached to an estimate", () => {
    const parsed = photoSchema.parse({
      ...validPhoto,
      estimate_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
    });
    expect(parsed.estimate_id).not.toBeNull();
  });
});

describe("signatureSchema", () => {
  const validSignature = {
    id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
    org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
    estimate_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
    invoice_id: null,
    storage_path: "org/1c9e6c1a/signatures/s-001.png",
    signed_by: "R. Novak",
    signed_at: "2026-07-14T10:00:00+00:00",
  };

  it("parses an estimate acceptance signature", () => {
    expect(signatureSchema.parse(validSignature).signed_by).toBe("R. Novak");
  });

  it("rejects a signature attached to neither document — it must witness something", () => {
    expect(() =>
      signatureSchema.parse({ ...validSignature, estimate_id: null, invoice_id: null }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fasttrack/schema test -- media`
Expected: FAIL — cannot resolve `./media.js`

- [ ] **Step 3: Write the implementation**

Create `packages/schema/src/media.ts`:

```typescript
import { z } from "zod";
import { syncColumns, timestampField, uuidField } from "./common.js";

/** Job-site photos. Always on a job; optionally pinned to a document. */
export const photoSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  estimate_id: uuidField.nullable(),
  invoice_id: uuidField.nullable(),
  storage_path: z.string().min(1),
  caption: z.string().nullable(),
  taken_at: timestampField.nullable(),
  ...syncColumns,
});

/** Signatures are evidence: immutable once captured, so no update/delete columns. */
export const signatureSchema = z
  .strictObject({
    id: uuidField,
    org_id: uuidField,
    estimate_id: uuidField.nullable(),
    invoice_id: uuidField.nullable(),
    storage_path: z.string().min(1),
    signed_by: z.string().min(1),
    signed_at: timestampField,
  })
  .refine((row) => row.estimate_id !== null || row.invoice_id !== null, {
    message: "A signature must reference an estimate or an invoice",
  });

export type Photo = z.infer<typeof photoSchema>;
export type Signature = z.infer<typeof signatureSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fasttrack/schema test -- media`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/media.ts packages/schema/src/media.test.ts
git commit -m "feat(schema): add photo and signature schemas"
```

---

### Task 14: Public barrel and full verification

**Files:**
- Modify: `packages/schema/src/index.ts` (replace the `export {}` placeholder)

- [ ] **Step 1: Replace `packages/schema/src/index.ts`**

```typescript
export {
  centsField,
  dateField,
  markupBpsField,
  positiveCentsField,
  quantityField,
  rateBpsField,
  signedCentsField,
  syncColumns,
  timestampField,
  uuidField,
} from "./common.js";
export {
  estimateStatusSchema,
  invoiceStatusSchema,
  jobStatusSchema,
  lineKindSchema,
  membershipRoleSchema,
  paymentMethodSchema,
  priceBookKindSchema,
  tradeSchema,
  type EstimateStatus,
  type InvoiceStatus,
  type JobStatus,
  type LineKind,
  type MembershipRole,
  type PaymentMethod,
  type PriceBookKind,
  type Trade,
} from "./enums.js";
export {
  membershipSchema,
  organizationSchema,
  taxConfigSchema,
  userSchema,
  type Membership,
  type Organization,
  type TaxConfig,
  type User,
} from "./org.js";
export { clientSchema, type Client } from "./client.js";
export { jobSchema, type Job } from "./job.js";
export { priceBookItemSchema, type PriceBookItem } from "./priceBook.js";
export { documentLineFields } from "./lines.js";
export {
  estimateLineSchema,
  estimateSchema,
  type Estimate,
  type EstimateLine,
} from "./estimate.js";
export {
  invoiceLineSchema,
  invoiceSchema,
  paymentSchema,
  type Invoice,
  type InvoiceLine,
  type Payment,
} from "./invoice.js";
export {
  budgetSchema,
  expenseCategorySchema,
  expenseSchema,
  type Budget,
  type Expense,
  type ExpenseCategory,
} from "./expense.js";
export { photoSchema, signatureSchema, type Photo, type Signature } from "./media.js";
```

- [ ] **Step 2: Full verification**

Run: `pnpm --filter @fasttrack/schema test && pnpm --filter @fasttrack/schema build && pnpm --filter @fasttrack/schema typecheck && pnpm --filter @fasttrack/core test`
Expected: schema ~53 tests PASS, build emits dist, typecheck clean, core still green

- [ ] **Step 3: Commit**

```bash
git add -A packages/schema
git commit -m "feat(schema): expose public schema surface"
```

---

## Self-review (run after Task 14)

1. **Spec coverage:** every §4 entity has a schema (organizations/users/memberships → T7, clients → T8, jobs → T8, price_book_items → T9, estimates + lines → T10, invoices + lines + payments → T11, photos/signatures → T13) plus roadmap decision A's expenses/categories/budgets → T12. Estimate-level margin (reconciliation 9) → T1. Health score (decision B) → T2. `bank_transfer` (reconciliation 7) → T6. `in_progress` job status → T6. `is_billable`/`vendor`/OCR fields (reconciliation 4–6) → T12.
2. **Placeholder scan:** none — every step carries full code.
3. **Type consistency:** `documentLineFields` defined once (T10), spread by estimate and invoice lines; `positiveCentsField` defined T5, consumed T11/T12; branded `Cents`/`BasisPoints` flow from `common.ts` transforms into core functions (proven by the `priceFromCost` assertions in T9/T10 tests).

## What this unblocks

Plan 2 (database) translates these schemas 1:1 into Postgres DDL — same names, same enums, same nullability — then RLS, storage, and seeds.
