import { priceFromCost } from "@fasttrack/core";
import { describe, expect, it } from "vitest";
import { estimateLineSchema, estimateSchema } from "./estimate.js";

const validLine = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  estimate_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
  sort_order: 0,
  kind: "material",
  description: "200A panel — Square D QO",
  quantity: 1,
  unit: "ea",
  unit_cost_cents: 42_000,
  markup_pct: 3_500,
  unit_price_cents: 56_700,
  is_taxable: true,
  price_book_item_id: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

const validEstimate = {
  id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  number: 1042,
  status: "draft",
  issued_at: null,
  expires_at: null,
  subtotal_cents: 310_600,
  tax_cents: 0,
  discount_cents: 0,
  total_cents: 310_600,
  notes: null,
  terms: null,
  pdf_url: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("estimateLineSchema", () => {
  it("parses the design's sample line, and its snapshotted price agrees with priceFromCost", () => {
    const parsed = estimateLineSchema.parse(validLine);
    expect(priceFromCost(parsed.unit_cost_cents, parsed.markup_pct)).toBe(
      parsed.unit_price_cents,
    );
  });

  it("stores both cost and price — snapshotted, not computed (spec §4)", () => {
    const parsed = estimateLineSchema.parse(validLine);
    expect(parsed.unit_cost_cents).toBe(42_000);
    expect(parsed.unit_price_cents).toBe(56_700);
  });

  it("accepts fractional quantities on labor", () => {
    const parsed = estimateLineSchema.parse({
      ...validLine,
      kind: "labor",
      description: "Service change",
      quantity: 2.5,
      unit: "hr",
    });
    expect(parsed.quantity).toBe(2.5);
  });

  it("rejects a line missing its estimate_id", () => {
    const { estimate_id: _omitted, ...withoutParent } = validLine;
    expect(() => estimateLineSchema.parse(withoutParent)).toThrow();
  });
});

describe("estimateSchema", () => {
  it("parses a draft with nothing issued yet", () => {
    const parsed = estimateSchema.parse(validEstimate);
    expect(parsed.status).toBe("draft");
    expect(parsed.issued_at).toBeNull();
  });

  it("rejects a zero or negative document number", () => {
    expect(() => estimateSchema.parse({ ...validEstimate, number: 0 })).toThrow();
  });

  it("rejects unknown columns", () => {
    expect(() => estimateSchema.parse({ ...validEstimate, margin_cents: 1 })).toThrow();
  });
});
