import { describe, expect, it } from "vitest";

import { healthForOrg, monthKpis } from "../repos/kpis";
import { listInvoices } from "../repos/invoiceRepo";
import { getOrg } from "../repos/orgRepo";
import { createTestCtx } from "../repos/testUtils";
import { seedDemo } from "./demo";

/** Date-independent assertions only — the demo clock is relative to Date.now(). */
describe("seedDemo", () => {
  it("builds the mock dataset entirely through the repos", async () => {
    const { ctx } = await createTestCtx();
    await seedDemo(ctx);

    const count = async (table: string): Promise<number> => {
      const rows = await ctx.driver.exec(`SELECT COUNT(*) AS n FROM ${table}`);
      return Number(rows[0]?.n ?? 0);
    };

    expect(await count("organizations")).toBe(1);
    expect(await count("estimates")).toBe(14); // 10 won + 4 open pipeline
    expect(await count("invoices")).toBe(10); // 6 this month, 4 last
    expect(await count("payments")).toBe(6);
    expect(await count("expenses")).toBe(21);
    expect(await count("price_book_items")).toBe(9); // electrical slice
    expect(await count("expense_categories")).toBe(8);
  });

  /**
   * The cohorts are pinned to calendar-month boundaries, so these totals hold
   * whatever day the demo is seeded. They exist to stop the dataset drifting
   * back into fantasy margins — the numbers go in App Store screenshots, and a
   * contractor who sees an 88% net margin knows the app is lying to them.
   */
  it("reports a believable contractor P&L for the current month", async () => {
    const { ctx } = await createTestCtx();
    await seedDemo(ctx);
    const org = await getOrg(ctx);
    if (!org) throw new Error("demo org missing");
    const liveCtx = { ...ctx, now: () => new Date().toISOString() };

    const kpis = await monthKpis(liveCtx, org.id);
    expect(kpis.revenueCents).toBe(2_398_500); // $23,985 invoiced
    expect(kpis.spendCents).toBe(1_968_500); // $19,685 out the door
    expect(kpis.netProfitCents).toBe(430_000); // $4,300
    expect(kpis.marginBps).toBe(1793); // 17.9% net — a real electrician's number

    // Both months are real trading months, so the header deltas stay readable
    // instead of exploding off a near-zero prior month and hitting the 999% cap.
    expect(kpis.prevRevenueCents).toBe(2_148_500);
    expect(kpis.revenueDeltaPct).toBe(11.6);
    expect(kpis.prevSpendCents).toBe(1_810_000);
    expect(kpis.spendDeltaPct).toBe(8.8);
  });

  it("produces the design's derived statuses and live health inputs", async () => {
    const { ctx } = await createTestCtx();
    await seedDemo(ctx);
    const org = await getOrg(ctx);
    if (!org) throw new Error("demo org missing");

    // Use the real clock: the demo data is offset from Date.now().
    const liveCtx = { ...ctx, now: () => new Date().toISOString() };

    // Ramos is last month's unpaid invoice, so it is overdue on any seed date.
    // Hartley is only overdue once this month is older than its 14-day terms,
    // which is not true if the demo is seeded in the first fortnight.
    const overdue = await listInvoices(liveCtx, org.id, "overdue");
    expect(overdue.map((r) => r.clientName)).toContain("Ramos");
    const paid = await listInvoices(liveCtx, org.id, "paid");
    expect(paid.map((r) => r.clientName).sort()).toEqual([
      "Alvarez",
      "Delgado",
      "Novak",
      "Pike",
      "Sorenson",
    ]);

    const { inputs, health } = await healthForOrg(liveCtx, org.id);
    expect(inputs.invoicedCents).toBeGreaterThan(0);
    expect(inputs.outstandingCents).toBeGreaterThan(0);
    expect(inputs.overdueCents).toBeGreaterThan(0);
    expect(health.score).toBeGreaterThan(0);
    expect(health.score).toBeLessThanOrEqual(100);

    const kpis = await monthKpis(liveCtx, org.id);
    expect(kpis.outstandingCents).toBe(inputs.outstandingCents);
  });
});
