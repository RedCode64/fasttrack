import { describe, expect, it } from "vitest";
import { basisPoints, cents } from "./money.js";
import { lineTotal, priceFromCost } from "./pricing.js";

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
