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
