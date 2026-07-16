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
