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
