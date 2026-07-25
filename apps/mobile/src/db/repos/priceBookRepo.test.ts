import { describe, expect, it } from "vitest";

import { createOrg } from "./orgRepo";
import {
  createPriceBookItem,
  listPriceBookItems,
  type CreatePriceBookItemInput,
} from "./priceBookRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

async function orgCtx(): Promise<{ t: TestCtx; orgId: string }> {
  const t = await createTestCtx();
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 0,
  });
  return { t, orgId: org.id };
}

function item(overrides: Partial<CreatePriceBookItemInput> = {}): CreatePriceBookItemInput {
  return {
    kind: "material",
    name: "Sub-panel install",
    unit: "ea",
    unitCostCents: 42000,
    defaultMarkupPct: 5000,
    ...overrides,
  };
}

describe("listPriceBookItems", () => {
  it("starts empty for a new org", async () => {
    const { t, orgId } = await orgCtx();
    expect(await listPriceBookItems(t.ctx, orgId)).toHaveLength(0);
  });

  it("returns the org's items grouped by kind then name", async () => {
    const { t, orgId } = await orgCtx();
    // Inserted out of order on purpose — ordering is the query's job.
    await createPriceBookItem(t.ctx, orgId, item({ kind: "labor", name: "Rough-in" }));
    await createPriceBookItem(t.ctx, orgId, item({ kind: "material", name: "Wire spool" }));
    await createPriceBookItem(t.ctx, orgId, item({ kind: "labor", name: "Finish work" }));
    await createPriceBookItem(t.ctx, orgId, item({ kind: "material", name: "Breaker" }));

    const items = await listPriceBookItems(t.ctx, orgId);
    expect(items.map((i) => i.kind)).toEqual(["material", "material", "labor", "labor"]);
    expect(items.map((i) => i.name)).toEqual([
      "Breaker",
      "Wire spool",
      "Finish work",
      "Rough-in",
    ]);
  });

  it("excludes soft-deleted items", async () => {
    const { t, orgId } = await orgCtx();
    await createPriceBookItem(t.ctx, orgId, item({ name: "Keeper" }));
    await createPriceBookItem(t.ctx, orgId, item({ name: "Doomed" }));

    const before = await listPriceBookItems(t.ctx, orgId);
    expect(before).toHaveLength(2);
    const doomed = before.find((i) => i.name === "Doomed");
    if (!doomed) throw new Error("missing item");
    await t.ctx.driver.exec("UPDATE price_book_items SET deleted_at = ? WHERE id = ?", [
      t.ctx.now(),
      doomed.id,
    ]);

    const after = await listPriceBookItems(t.ctx, orgId);
    expect(after.map((i) => i.name)).toEqual(["Keeper"]);
  });
});

describe("createPriceBookItem", () => {
  it("saves a line so it shows up in the picker next time", async () => {
    const { t, orgId } = await orgCtx();
    await createPriceBookItem(t.ctx, orgId, item());

    const items = await listPriceBookItems(t.ctx, orgId);
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Sub-panel install");
    expect(items[0]?.unit_cost_cents).toBe(42000);
    expect(items[0]?.default_markup_pct).toBe(5000);
  });

  it("moves the price forward instead of duplicating a repeated name", async () => {
    const { t, orgId } = await orgCtx();
    await createPriceBookItem(t.ctx, orgId, item());
    await createPriceBookItem(t.ctx, orgId, item({ unitCostCents: 45500 }));

    const items = await listPriceBookItems(t.ctx, orgId);
    expect(items).toHaveLength(1);
    expect(items[0]?.unit_cost_cents).toBe(45500);
  });

  it("treats a differently-cased name as the same item", async () => {
    const { t, orgId } = await orgCtx();
    await createPriceBookItem(t.ctx, orgId, item({ name: "Service call" }));
    await createPriceBookItem(t.ctx, orgId, item({ name: "SERVICE CALL" }));

    expect(await listPriceBookItems(t.ctx, orgId)).toHaveLength(1);
  });

  it("trims the name and rejects a blank one", async () => {
    const { t, orgId } = await orgCtx();
    await createPriceBookItem(t.ctx, orgId, item({ name: "  Permit fee  " }));
    const items = await listPriceBookItems(t.ctx, orgId);
    expect(items[0]?.name).toBe("Permit fee");

    await expect(createPriceBookItem(t.ctx, orgId, item({ name: "   " }))).rejects.toThrow(
      /needs a name/,
    );
  });
});
