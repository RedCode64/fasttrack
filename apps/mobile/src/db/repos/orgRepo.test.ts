import { basisPoints, cents, healthScore } from "@fasttrack/core";
import { describe, expect, it } from "vitest";

import { createOrg, getOrg } from "./orgRepo";
import { createTestCtx } from "./testUtils";

describe("createOrg", () => {
  it("creates the org row with parsed tax config", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 825,
    });

    expect(org.name).toBe("Reyes Electric");
    expect(org.trade).toBe("electrical");
    expect(org.target_margin_bps).toBe(3000);
    expect(org.tax_config).toEqual({ name: "Sales tax", rate_bps: 825 });
  });

  it("leaves the price book empty — it fills from the user's own saved lines", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const rows = await ctx.driver.exec(
      "SELECT kind, name FROM price_book_items WHERE org_id = ?",
      [org.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("seeds all 8 default expense categories in order", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Plumb Co",
      trade: "plumbing",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const rows = await ctx.driver.exec(
      "SELECT name, sort_order FROM expense_categories WHERE org_id = ? ORDER BY sort_order",
      [org.id],
    );
    expect(rows.map((r) => r.name)).toEqual([
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

  it("getOrg round-trips a row whose branded fields feed core math", async () => {
    const { ctx } = await createTestCtx();
    await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 825,
    });
    const org = await getOrg(ctx);
    expect(org).not.toBeNull();
    if (org === null) throw new Error("unreachable");

    // Parsed org values feed core math through the branded constructors.
    const health = healthScore({
      marginBps: basisPoints(org.target_margin_bps),
      targetMarginBps: basisPoints(org.target_margin_bps),
      overdueCents: cents(0),
      outstandingCents: cents(0),
      collectedCents: cents(0),
      invoicedCents: cents(0),
    });
    expect(health.score).toBe(100); // margin on target, empty books
    expect(org.tax_config.rate_bps).toBe(825);
  });

  it("returns null before onboarding", async () => {
    const { ctx } = await createTestCtx();
    expect(await getOrg(ctx)).toBeNull();
  });
});
