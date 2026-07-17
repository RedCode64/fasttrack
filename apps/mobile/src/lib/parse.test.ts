import { describe, expect, it } from "vitest";

import { dollarsToCents, parseQuantity, pctToBps } from "./parse";

describe("dollarsToCents", () => {
  it("parses plain, decimal, and formatted amounts", () => {
    expect(dollarsToCents("412")).toBe(41200);
    expect(dollarsToCents("412.5")).toBe(41250);
    expect(dollarsToCents("$1,240.00")).toBe(124000);
  });

  it("rejects junk and negatives", () => {
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("")).toBeNull();
  });
});

describe("pctToBps", () => {
  it("parses whole and fractional percents", () => {
    expect(pctToBps("30")).toBe(3000);
    expect(pctToBps("8.25")).toBe(825);
    expect(pctToBps("55%")).toBe(5500);
  });

  it("rejects junk", () => {
    expect(pctToBps("x")).toBeNull();
  });
});

describe("parseQuantity", () => {
  it("parses fractional quantities and rejects negatives", () => {
    expect(parseQuantity("2.5")).toBe(2.5);
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});
