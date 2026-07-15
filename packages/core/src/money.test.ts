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
