import { priceBookKindSchema, tradeSchema } from "@fasttrack/schema";
import { describe, expect, it } from "vitest";

import { DEFAULT_EXPENSE_CATEGORIES } from "./categories";
import { PRICE_BOOK_TEMPLATES } from "./priceBookTemplates";

describe("PRICE_BOOK_TEMPLATES", () => {
  it("ports all 31 rows from the live price_book_templates table", () => {
    expect(PRICE_BOOK_TEMPLATES).toHaveLength(31);
  });

  it("matches the per-trade counts of the Plan 2 seed", () => {
    const byTrade = new Map<string, number>();
    for (const t of PRICE_BOOK_TEMPLATES) {
      byTrade.set(t.trade, (byTrade.get(t.trade) ?? 0) + 1);
    }
    expect(Object.fromEntries(byTrade)).toEqual({
      electrical: 9,
      plumbing: 8,
      hvac: 6,
      general_contracting: 5,
      handyman: 2,
      other: 1,
    });
  });

  it("only contains valid trades, kinds, and money values", () => {
    for (const t of PRICE_BOOK_TEMPLATES) {
      expect(() => tradeSchema.parse(t.trade)).not.toThrow();
      expect(() => priceBookKindSchema.parse(t.kind)).not.toThrow();
      expect(Number.isInteger(t.unitCostCents)).toBe(true);
      expect(t.unitCostCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(t.defaultMarkupPct)).toBe(true);
      expect(t.defaultMarkupPct).toBeGreaterThanOrEqual(-10_000);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.unit.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_EXPENSE_CATEGORIES", () => {
  it("is the 8 defaults in the Plan 2 seed order", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toEqual([
      "Materials",
      "Fuel",
      "Permits",
      "Tools",
      "Insurance",
      "Office",
      "Subcontractors",
      "Other",
    ]);
  });
});
