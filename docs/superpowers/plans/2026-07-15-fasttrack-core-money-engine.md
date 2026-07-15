# FastTrack Core Money Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/core`, the tested money engine both the iOS app and the web dashboard import — cost, markup, line totals, and document totals — with correctness proven by tests before anything else in the product exists.

**Architecture:** A pnpm/Turborepo monorepo whose first package is pure TypeScript with zero runtime dependencies. All money is integer cents; all markup is integer basis points. Every multiplication rounds to cents immediately, and sums are integer-only — that ordering is what prevents float drift from reaching a customer's invoice. No infrastructure, no accounts, no native code: this plan runs entirely on Windows.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Turborepo, Vitest.

**Why this is plan 1 of N:** This is the highest-consequence surface in FastTrack and the only one that fails *silently* — a wrong total doesn't crash, it just quietly bills the wrong amount. It's also the one part with no dependency on a Supabase project or an Apple Developer account, so it's unblocked today. Later plans (database + schema, Expo + PowerSync, estimates, PDF, invoices, subscriptions) each get their own document.

**Spec:** `docs/superpowers/specs/2026-07-15-fasttrack-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` | Workspace root — tooling only, no logic |
| `packages/core/src/money.ts` | Money primitives: branded types, constructors, rounding |
| `packages/core/src/pricing.ts` | Cost + markup → price; price × quantity → line total |
| `packages/core/src/totals.ts` | Line totals → subtotal, discount, tax, total |
| `packages/core/src/index.ts` | Public surface of the package |

Split by responsibility, not layer. `money.ts` knows nothing about estimates; `totals.ts` knows nothing about SQL. Each file is small enough to hold in context whole.

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`

- [ ] **Step 1: Initialize the repository**

```bash
cd "C:/Users/pagan/Claude/App"
git init
git checkout -b feat/core-money-engine
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
coverage/
*.tsbuildinfo
.env
.env.local
.DS_Store
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "fasttrack",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.1.3",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 5: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 6: Create `tsconfig.base.json`**

`strict` alone is not enough. `noUncheckedIndexedAccess` is what stops `lines[0]` from being typed as present when the array is empty, and `exactOptionalPropertyTypes` stops `undefined` sneaking into optional money fields.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 7: Create `packages/core/package.json`**

```json
{
  "name": "@fasttrack/core",
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
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 8: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 9: Create `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] },
  },
});
```

- [ ] **Step 10: Install and verify the toolchain**

Run: `pnpm install`
Expected: completes without error; `node_modules/` and `pnpm-lock.yaml` appear.

- [ ] **Step 11: Commit**

```bash
git add .gitignore package.json pnpm-workspace.yaml turbo.json tsconfig.base.json packages/core pnpm-lock.yaml
git commit -m "chore: scaffold monorepo with core package"
```

---

## Task 2: Money primitives

**Files:**
- Create: `packages/core/src/money.ts`
- Test: `packages/core/src/money.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { basisPoints, BASIS_POINTS_SCALE, cents, roundHalfUp } from "./money.js";

describe("cents", () => {
  it("accepts an integer", () => {
    expect(cents(1999)).toBe(1999);
  });

  it("accepts zero", () => {
    expect(cents(0)).toBe(0);
  });

  it("rejects a fractional value", () => {
    expect(() => cents(19.99)).toThrow(RangeError);
  });

  it("rejects a value outside the safe integer range", () => {
    expect(() => cents(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });

  it("rejects NaN", () => {
    expect(() => cents(Number.NaN)).toThrow(RangeError);
  });
});

describe("basisPoints", () => {
  it("treats 2500 as 25%", () => {
    expect(basisPoints(2500)).toBe(2500);
    expect(BASIS_POINTS_SCALE).toBe(10_000);
  });

  it("rejects a fractional value", () => {
    expect(() => basisPoints(25.5)).toThrow(RangeError);
  });
});

describe("roundHalfUp", () => {
  it("rounds a half up", () => {
    expect(roundHalfUp(2.5)).toBe(3);
  });

  it("rounds below a half down", () => {
    expect(roundHalfUp(2.4)).toBe(2);
  });

  // Math.round(-2.5) is -2, because it rounds half toward +Infinity.
  // Money must round half away from zero, so a refund line of -2.5 owes -3.
  it("rounds a negative half away from zero", () => {
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it("leaves integers untouched", () => {
    expect(roundHalfUp(7)).toBe(7);
  });

  // Math.sign(-0) * Math.round(0) is -0, and Object.is(-0, 0) is false,
  // so an unnormalized -0 fails toBe(0) and leaks into stored totals.
  it("normalizes negative zero", () => {
    expect(Object.is(roundHalfUp(-0.4), 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fasttrack/core test`
Expected: FAIL — `Failed to resolve import "./money.js"`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/money.ts`:

```ts
/** An integer count of cents. Never a float — see the spec's money rules. */
export type Cents = number & { readonly __cents: true };

/** An integer count of basis points. 2500 = 25.00%. */
export type BasisPoints = number & { readonly __basisPoints: true };

export const BASIS_POINTS_SCALE = 10_000;

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a safe integer, received ${value}`);
  }
  return value as Cents;
}

export function basisPoints(value: number): BasisPoints {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`BasisPoints must be a safe integer, received ${value}`);
  }
  return value as BasisPoints;
}

/**
 * Rounds half away from zero, normalizing -0 to 0.
 *
 * Math.round rounds half toward +Infinity (Math.round(-2.5) === -2), which is
 * wrong for money: a -2.5 cent adjustment owes -3, not -2.
 */
export function roundHalfUp(value: number): number {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fasttrack/core test`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/money.ts packages/core/src/money.test.ts
git commit -m "feat(core): add money primitives with half-away-from-zero rounding"
```

---

## Task 3: Price from cost and markup

**Files:**
- Create: `packages/core/src/pricing.ts`
- Test: `packages/core/src/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { basisPoints, cents } from "./money.js";
import { priceFromCost } from "./pricing.js";

describe("priceFromCost", () => {
  it("applies a 25% markup to a round cost", () => {
    expect(priceFromCost(cents(10_000), basisPoints(2500))).toBe(12_500);
  });

  // 1999 * 1.25 = 2498.75, which must round to 2499 — not truncate to 2498.
  it("rounds a fractional result half up", () => {
    expect(priceFromCost(cents(1999), basisPoints(2500))).toBe(2499);
  });

  it("returns the cost unchanged at zero markup", () => {
    expect(priceFromCost(cents(4321), basisPoints(0))).toBe(4321);
  });

  it("supports a negative markup (a discount off cost)", () => {
    expect(priceFromCost(cents(10_000), basisPoints(-1000))).toBe(9000);
  });

  it("returns zero at exactly -100% markup", () => {
    expect(priceFromCost(cents(10_000), basisPoints(-10_000))).toBe(0);
  });

  // Below -100% the price goes negative, which means the line pays the customer.
  it("rejects a markup below -100%", () => {
    expect(() => priceFromCost(cents(10_000), basisPoints(-10_001))).toThrow(RangeError);
  });

  it("handles a large cost without losing precision", () => {
    expect(priceFromCost(cents(1_000_000), basisPoints(2500))).toBe(1_250_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fasttrack/core test`
Expected: FAIL — `Failed to resolve import "./pricing.js"`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/pricing.ts`:

```ts
import { BASIS_POINTS_SCALE, cents, roundHalfUp, type BasisPoints, type Cents } from "./money.js";

/**
 * Applies a markup to a unit cost to produce the unit price a customer is charged.
 *
 * The result is snapshotted onto the line at write time and never recomputed:
 * price books and markups change, but a sent estimate must show the price as
 * sent, forever.
 */
export function priceFromCost(unitCost: Cents, markup: BasisPoints): Cents {
  if (markup < -BASIS_POINTS_SCALE) {
    throw new RangeError(
      `Markup below -100% produces a negative price: received ${markup} basis points`,
    );
  }
  return cents(roundHalfUp((unitCost * (BASIS_POINTS_SCALE + markup)) / BASIS_POINTS_SCALE));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fasttrack/core test`
Expected: PASS — 19 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pricing.ts packages/core/src/pricing.test.ts
git commit -m "feat(core): add priceFromCost with markup in basis points"
```

---

## Task 4: Line totals

**Files:**
- Modify: `packages/core/src/pricing.ts`
- Modify: `packages/core/src/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/pricing.test.ts`, and extend the existing import from `./pricing.js` to `import { lineTotal, priceFromCost } from "./pricing.js";`:

```ts
describe("lineTotal", () => {
  it("multiplies price by a whole quantity", () => {
    expect(lineTotal(cents(2500), 2)).toBe(5000);
  });

  it("supports a fractional quantity", () => {
    expect(lineTotal(cents(2500), 2.5)).toBe(6250);
  });

  it("returns zero for a zero quantity", () => {
    expect(lineTotal(cents(2500), 0)).toBe(0);
  });

  // 2000 * 0.1 is 200.00000000000003 in float64. Rounding at the multiplication
  // is what stops that drift from ever reaching a stored total.
  it("absorbs float drift from a fractional quantity", () => {
    expect(lineTotal(cents(2000), 0.1)).toBe(200);
  });

  it("rejects a negative quantity", () => {
    expect(() => lineTotal(cents(2500), -1)).toThrow(RangeError);
  });

  it("rejects a non-finite quantity", () => {
    expect(() => lineTotal(cents(2500), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fasttrack/core test`
Expected: FAIL — `lineTotal is not exported by ./pricing.js`.

- [ ] **Step 3: Write the implementation**

Append to `packages/core/src/pricing.ts`:

```ts
/**
 * Extends a unit price across a quantity.
 *
 * Quantity is a float because trades bill in fractions — 2.5 hours, 13.75 feet.
 * The rounding here is load-bearing: it is what keeps float drift out of the
 * integer sums performed by documentTotals.
 */
export function lineTotal(unitPrice: Cents, quantity: number): Cents {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative finite number, received ${quantity}`);
  }
  return cents(roundHalfUp(unitPrice * quantity));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fasttrack/core test`
Expected: PASS — 25 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pricing.ts packages/core/src/pricing.test.ts
git commit -m "feat(core): add lineTotal with float-drift-safe rounding"
```

---

## Task 5: Document totals

**Files:**
- Create: `packages/core/src/totals.ts`
- Test: `packages/core/src/totals.test.ts`

**Business rule this task settles (the spec left it open):** a discount reduces the taxable base *proportionally*. If half a document's value is taxable, half the discount comes off the taxable base. The alternative — taxing the pre-discount base — charges the customer tax on money they never paid.

- [ ] **Step 1: Write the failing test**

`packages/core/src/totals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { basisPoints, cents } from "./money.js";
import { documentTotals, type TotalsLine } from "./totals.js";

const taxable = (unitPriceCents: number, quantity: number): TotalsLine => ({
  unitPriceCents: cents(unitPriceCents),
  quantity,
  isTaxable: true,
});

const exempt = (unitPriceCents: number, quantity: number): TotalsLine => ({
  unitPriceCents: cents(unitPriceCents),
  quantity,
  isTaxable: false,
});

describe("documentTotals", () => {
  // An empty draft divides by a zero subtotal when apportioning the discount.
  it("returns zeros for an empty document without dividing by zero", () => {
    expect(documentTotals([], cents(0), basisPoints(875))).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("taxes a single taxable line", () => {
    // 10000 subtotal, 8.75% tax = 875
    expect(documentTotals([taxable(10_000, 1)], cents(0), basisPoints(875))).toEqual({
      subtotalCents: 10_000,
      discountCents: 0,
      taxCents: 875,
      totalCents: 10_875,
    });
  });

  it("excludes exempt lines from the taxable base", () => {
    // Materials 10000 taxable, labor 20000 exempt. Tax applies to 10000 only.
    expect(documentTotals([taxable(10_000, 1), exempt(20_000, 1)], cents(0), basisPoints(875)))
      .toEqual({
        subtotalCents: 30_000,
        discountCents: 0,
        taxCents: 875,
        totalCents: 30_875,
      });
  });

  it("sums lines as integers after rounding each", () => {
    // Each line rounds to 333 first; summing rounded integers avoids drift.
    expect(documentTotals([taxable(333, 1), taxable(333, 1), taxable(333, 1)], cents(0), basisPoints(0)))
      .toEqual({
        subtotalCents: 999,
        discountCents: 0,
        taxCents: 0,
        totalCents: 999,
      });
  });

  it("apportions a discount across the taxable base proportionally", () => {
    // Subtotal 30000, of which 10000 (one third) is taxable.
    // A 3000 discount removes 1000 from the taxable base, leaving 9000.
    // Tax = 9000 * 8.75% = 787.5 -> 788.
    expect(documentTotals([taxable(10_000, 1), exempt(20_000, 1)], cents(3000), basisPoints(875)))
      .toEqual({
        subtotalCents: 30_000,
        discountCents: 3000,
        taxCents: 788,
        totalCents: 27_788,
      });
  });

  it("rejects a negative discount", () => {
    expect(() => documentTotals([taxable(10_000, 1)], cents(-1), basisPoints(0))).toThrow(RangeError);
  });

  it("rejects a discount larger than the subtotal", () => {
    expect(() => documentTotals([taxable(10_000, 1)], cents(10_001), basisPoints(0))).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fasttrack/core test`
Expected: FAIL — `Failed to resolve import "./totals.js"`.

- [ ] **Step 3: Write the implementation**

`packages/core/src/totals.ts`:

```ts
import { BASIS_POINTS_SCALE, cents, roundHalfUp, type BasisPoints, type Cents } from "./money.js";
import { lineTotal } from "./pricing.js";

export interface TotalsLine {
  readonly unitPriceCents: Cents;
  readonly quantity: number;
  readonly isTaxable: boolean;
}

export interface DocumentTotals {
  readonly subtotalCents: Cents;
  readonly discountCents: Cents;
  readonly taxCents: Cents;
  readonly totalCents: Cents;
}

/**
 * Computes the totals shown on an estimate or invoice.
 *
 * Each line is rounded to cents before it is summed, so the subtotal is an
 * exact integer sum rather than a float accumulation.
 */
export function documentTotals(
  lines: readonly TotalsLine[],
  discount: Cents,
  taxRate: BasisPoints,
): DocumentTotals {
  let subtotal = 0;
  let taxableSubtotal = 0;

  for (const line of lines) {
    const total = lineTotal(line.unitPriceCents, line.quantity);
    subtotal += total;
    if (line.isTaxable) {
      taxableSubtotal += total;
    }
  }

  if (discount < 0) {
    throw new RangeError(`Discount must be non-negative, received ${discount}`);
  }
  if (discount > subtotal) {
    throw new RangeError(`Discount ${discount} exceeds subtotal ${subtotal}`);
  }

  // The discount comes off the taxable base in proportion to how much of the
  // document is taxable — otherwise the customer pays tax on money they didn't
  // spend. An empty document has a zero subtotal, so guard the divide.
  const taxableDiscount =
    subtotal === 0 ? 0 : roundHalfUp((discount * taxableSubtotal) / subtotal);
  const discountedTaxableBase = taxableSubtotal - taxableDiscount;
  const tax = roundHalfUp((discountedTaxableBase * taxRate) / BASIS_POINTS_SCALE);

  return {
    subtotalCents: cents(subtotal),
    discountCents: discount,
    taxCents: cents(tax),
    totalCents: cents(subtotal - discount + tax),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fasttrack/core test`
Expected: PASS — 32 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/totals.ts packages/core/src/totals.test.ts
git commit -m "feat(core): add documentTotals with proportional discount apportioning"
```

---

## Task 6: Public surface and verification

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Write the public surface**

`packages/core/src/index.ts`:

```ts
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
```

- [ ] **Step 2: Verify the build produces type declarations**

Run: `pnpm --filter @fasttrack/core build`
Expected: PASS. `packages/core/dist/index.d.ts` exists and exports `Cents`.

- [ ] **Step 3: Verify the whole workspace typechecks**

Run: `pnpm typecheck`
Expected: PASS, zero errors.

- [ ] **Step 4: Verify the full suite passes**

Run: `pnpm test`
Expected: PASS — 32 tests across 3 files.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): expose public money engine surface"
```

---

## Definition of done

- [ ] `pnpm test` passes, 32 tests green
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` emits `packages/core/dist/index.d.ts`
- [ ] No `any`, no `@ts-ignore`, no `as` casts outside the two branded-type constructors in `money.ts`
- [ ] Every commit above is present on `feat/core-money-engine`

## What this plan deliberately does not do

No database, no Supabase, no Expo, no PowerSync, no Zod schemas, no UI. `packages/schema` is intentionally deferred to the database plan — it pairs with the migration that defines the same shapes, and splitting them across two plans would let them drift.

## Next plan

`packages/schema` + Supabase migrations + RLS policies. **Blocked on:** a decision to create a Supabase project (bills the account) and the outcome of the security review gate (Phase 2) before any real data lands.
