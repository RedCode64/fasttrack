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
    expect(await count("estimates")).toBe(10);
    expect(await count("invoices")).toBe(6);
    expect(await count("payments")).toBe(3);
    expect(await count("expenses")).toBe(6);
    expect(await count("price_book_items")).toBe(9); // electrical slice
    expect(await count("expense_categories")).toBe(8);
  });

  it("produces the design's derived statuses and live health inputs", async () => {
    const { ctx } = await createTestCtx();
    await seedDemo(ctx);
    const org = await getOrg(ctx);
    if (!org) throw new Error("demo org missing");

    // Use the real clock: the demo data is offset from Date.now().
    const liveCtx = { ...ctx, now: () => new Date().toISOString() };

    const overdue = await listInvoices(liveCtx, org.id, "overdue");
    expect(overdue.map((r) => r.clientName).sort()).toEqual(["Hartley", "Ramos"]);
    const paid = await listInvoices(liveCtx, org.id, "paid");
    expect(paid.map((r) => r.clientName).sort()).toEqual(["Delgado", "Novak"]);

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
