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
