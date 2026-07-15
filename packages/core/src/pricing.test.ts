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
