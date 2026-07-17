import { describe, expect, it } from "vitest";

import { priceBookKindSchema, tradeSchema } from "./enums.js";
import { PRICE_BOOK_TEMPLATES } from "./priceBookTemplates.js";

describe("PRICE_BOOK_TEMPLATES", () => {
  it("matches the live price_book_templates row count (31, Plan 2 migration 6)", () => {
    expect(PRICE_BOOK_TEMPLATES).toHaveLength(31);
  });

  it("every row passes the enum schemas and money invariants", () => {
    for (const t of PRICE_BOOK_TEMPLATES) {
      expect(() => tradeSchema.parse(t.trade)).not.toThrow();
      expect(() => priceBookKindSchema.parse(t.kind)).not.toThrow();
      expect(Number.isInteger(t.unitCostCents)).toBe(true);
      expect(t.unitCostCents).toBeGreaterThan(0);
      expect(t.defaultMarkupPct).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.unit.length).toBeGreaterThan(0);
    }
  });

  it("every trade has at least one labor line (onboarding never seeds an empty book)", () => {
    for (const trade of tradeSchema.options) {
      expect(
        PRICE_BOOK_TEMPLATES.some((t) => t.trade === trade && t.kind === "labor"),
      ).toBe(true);
    }
  });
});
