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
