import { describe, expect, it } from "vitest";

import { createOrg } from "./orgRepo";
import { listPriceBookItems } from "./priceBookRepo";
import { createTestCtx } from "./testUtils";

describe("listPriceBookItems", () => {
  it("returns the org's items grouped by kind then name", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });

    const items = await listPriceBookItems(ctx, org.id);
    expect(items).toHaveLength(9);
    // labor sorts after material; names alphabetical within kind
    const kinds = items.map((i) => i.kind);
    expect(kinds.slice(0, 6).every((k) => k === "material")).toBe(true);
    expect(kinds.slice(6).every((k) => k === "labor")).toBe(true);
    const materialNames = items.slice(0, 6).map((i) => i.name);
    expect([...materialNames].sort((a, b) => a.localeCompare(b))).toEqual(materialNames);
  });

  it("excludes soft-deleted items", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "handyman",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const before = await listPriceBookItems(ctx, org.id);
    expect(before).toHaveLength(2);
    const doomed = before[0];
    if (!doomed) throw new Error("missing item");
    await ctx.driver.exec("UPDATE price_book_items SET deleted_at = ? WHERE id = ?", [
      ctx.now(),
      doomed.id,
    ]);
    expect(await listPriceBookItems(ctx, org.id)).toHaveLength(1);
  });
});
