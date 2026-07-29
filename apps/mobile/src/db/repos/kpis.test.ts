import { healthScore } from "@fasttrack/core";
import { describe, expect, it } from "vitest";

import { addCustomLine, createDraft, markAccepted, sendEstimate } from "./estimateRepo";
import { convertFromEstimate, recordPayment, sendInvoice } from "./invoiceRepo";
import { activity, healthForOrg, ledgerForExport, monthKpis } from "./kpis";
import { createOrg } from "./orgRepo";
import { createExpense, listCategories } from "./expenseRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

const NOW = "2026-07-16T12:00:00.000Z";

interface World {
  t: TestCtx;
  orgId: string;
  /** Overdue July invoice (Novak). */
  invA: string;
  /** Paid June invoice (Delgado) — the one the payment row hangs off. */
  invB: string;
}

/**
 * One accepted estimate (margin evidence), one open current invoice, one
 * overdue invoice with a partial payment, one paid June invoice, expenses in
 * June + July. Every figure below is engine-computed by the repos themselves.
 */
async function world(): Promise<World> {
  const t = await createTestCtx(NOW);
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 0,
  });

  // Accepted estimate: cost 100000, price 150000 → margin 3333 bps.
  t.setNow("2026-06-01T10:00:00.000Z");
  const est = await createDraft(t.ctx, org.id, {
    newClientName: "Novak",
    jobTitle: "Panel upgrade",
  });
  await addCustomLine(t.ctx, est.id, {
    kind: "material",
    description: "Evidence",
    quantity: 1,
    unit: "ea",
    unitCostCents: 100000,
    markupPct: 5000,
    isTaxable: false,
  });
  await sendEstimate(t.ctx, est.id);
  await markAccepted(t.ctx, est.id);

  // Invoice A from it: sent 2026-07-01 (due 07-15 → 1 day overdue at NOW).
  const invA = await convertFromEstimate(t.ctx, est.id);
  t.setNow("2026-07-01T10:00:00.000Z");
  await sendInvoice(t.ctx, invA.id); // total 150000

  // Invoice B: June work, paid in June.
  t.setNow("2026-06-05T10:00:00.000Z");
  const estB = await createDraft(t.ctx, org.id, {
    newClientName: "Delgado",
    jobTitle: "Fan install",
  });
  await addCustomLine(t.ctx, estB.id, {
    kind: "labor",
    description: "Labor",
    quantity: 1,
    unit: "hr",
    unitCostCents: 80000,
    markupPct: 5000,
    isTaxable: false,
  });
  await sendEstimate(t.ctx, estB.id);
  await markAccepted(t.ctx, estB.id);
  const invB = await convertFromEstimate(t.ctx, estB.id);
  await sendInvoice(t.ctx, invB.id); // total 120000, issued 2026-06-05
  t.setNow("2026-06-20T10:00:00.000Z");
  await recordPayment(t.ctx, invB.id, { amountCents: 120000, method: "check" });

  // Expenses: July 60000 across two rows, June 80000.
  const categories = await listCategories(t.ctx, org.id);
  const materials = categories.find((c) => c.name === "Materials");
  if (!materials) throw new Error("category missing");
  t.setNow("2026-07-14T10:00:00.000Z");
  await createExpense(t.ctx, org.id, {
    categoryId: materials.id,
    amountCents: 41200,
    spentAt: "2026-07-14",
    vendor: "City Electric Supply",
    isBillable: true,
  });
  t.setNow("2026-07-15T10:00:00.000Z");
  await createExpense(t.ctx, org.id, {
    categoryId: materials.id,
    amountCents: 18800,
    spentAt: "2026-07-15",
    vendor: "Graybar",
    isBillable: false,
  });
  t.setNow("2026-06-10T10:00:00.000Z");
  await createExpense(t.ctx, org.id, {
    categoryId: materials.id,
    amountCents: 80000,
    spentAt: "2026-06-10",
    vendor: "Home Depot",
    isBillable: false,
  });

  t.setNow(NOW);
  return { t, orgId: org.id, invA: invA.id, invB: invB.id };
}

describe("healthForOrg (mirrors web rollups computeHealth)", () => {
  it("derives decision-B inputs from live rows and scores them", async () => {
    const { t, orgId } = await world();
    const { health, inputs } = await healthForOrg(t.ctx, orgId);

    // Realized profit from both accepted estimates is 90000 on 270000 revenue
    // (33.33% gross), but in-window *overhead* nets it down. The 41200 City
    // Electric row is billable — a job cost the estimate line already priced in
    // — so only 18800 + 80000 = 98800 counts, leaving -8800 → -326 bps. The
    // gauge still sees past line markups; it just doesn't bill materials twice.
    expect(inputs.marginBps).toBe(-326);
    expect(inputs.targetMarginBps).toBe(3000);
    // Invoice A is open with balance 150000, one day past due at NOW.
    expect(inputs.outstandingCents).toBe(150000);
    expect(inputs.overdueCents).toBe(150000);
    // Both invoices issued inside the 90d window.
    expect(inputs.invoicedCents).toBe(270000);
    expect(inputs.collectedCents).toBe(120000);

    expect(health).toEqual(healthScore(inputs));
  });

  it("reads neutral margin with no accepted evidence", async () => {
    const t = await createTestCtx(NOW);
    const org = await createOrg(t.ctx, {
      name: "Fresh Org",
      trade: "handyman",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const { inputs, health } = await healthForOrg(t.ctx, org.id);
    expect(inputs.marginBps).toBe(3000);
    expect(health.score).toBe(100); // empty books are healthy
  });
});

describe("monthKpis", () => {
  it("sums the calendar month with deltas against the previous month", async () => {
    const { t, orgId } = await world();
    const kpis = await monthKpis(t.ctx, orgId);

    expect(kpis.revenueCents).toBe(150000); // invoice A issued in July
    expect(kpis.prevRevenueCents).toBe(120000); // invoice B issued in June
    expect(kpis.revenueDeltaPct).toBe(25);
    expect(kpis.spendCents).toBe(60000);
    expect(kpis.prevSpendCents).toBe(80000);
    expect(kpis.spendDeltaPct).toBe(-25);
    expect(kpis.netProfitCents).toBe(90000);
    expect(kpis.marginBps).toBe(6000);
    expect(kpis.outstandingCents).toBe(150000);
    expect(kpis.overdueCents).toBe(150000);
  });

  it("returns null deltas when the previous month is empty", async () => {
    const t = await createTestCtx(NOW);
    const org = await createOrg(t.ctx, {
      name: "Fresh Org",
      trade: "other",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const kpis = await monthKpis(t.ctx, org.id);
    expect(kpis.revenueDeltaPct).toBeNull();
    expect(kpis.spendDeltaPct).toBeNull();
    expect(kpis.revenueCents).toBe(0);
  });
});

describe("activity", () => {
  it("interleaves the four design event kinds newest-first", async () => {
    const { t, orgId } = await world();
    const items = await activity(t.ctx, orgId, 10);

    const kinds = items.map((i) => i.kind);
    expect(kinds[0]).toBe("expense_logged"); // 07-15 Graybar
    expect(kinds).toContain("payment_received");
    expect(kinds).toContain("invoice_sent");
    expect(kinds).toContain("invoice_overdue");

    const overdue = items.find((i) => i.kind === "invoice_overdue");
    expect(overdue?.counterparty).toBe("Novak");
    expect(overdue?.amountCents).toBe(150000);

    const payment = items.find((i) => i.kind === "payment_received");
    expect(payment?.counterparty).toBe("Delgado");
    expect(payment?.amountCents).toBe(120000);
  });

  it("honors the limit", async () => {
    const { t, orgId } = await world();
    const items = await activity(t.ctx, orgId, 2);
    expect(items).toHaveLength(2);
  });

  it("targets a payment row at its invoice, not at the payment itself", async () => {
    const { t, orgId, invB } = await world();
    const items = await activity(t.ctx, orgId, 10);

    const payment = items.find((i) => i.kind === "payment_received");
    // The row is keyed by the payment, but tapping it must open the invoice —
    // a payment id addresses no screen in the app.
    expect(payment?.targetId).toBe(invB);
    expect(payment?.id).not.toBe(invB);
  });

  it("targets invoice and expense rows at their own document", async () => {
    const { t, orgId, invA } = await world();
    const items = await activity(t.ctx, orgId, 10);

    const overdue = items.find((i) => i.kind === "invoice_overdue");
    expect(overdue?.targetId).toBe(invA);

    const expense = items.find((i) => i.kind === "expense_logged");
    expect(expense?.targetId).toBe(expense?.id);
  });
});

/**
 * A ledger with one payment on the *final* day of June and expenses either side
 * of the month boundary. The June payment carries a time component while the
 * expenses are date-only, which is the mix the range filter has to survive.
 */
async function ledgerWorld(): Promise<{ t: TestCtx; orgId: string }> {
  const t = await createTestCtx(NOW);
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 0,
  });

  t.setNow("2026-06-02T10:00:00.000Z");
  const est = await createDraft(t.ctx, org.id, {
    newClientName: "Hartley",
    jobTitle: "Deck lighting",
  });
  await addCustomLine(t.ctx, est.id, {
    kind: "material",
    description: "Fixtures",
    quantity: 1,
    unit: "ea",
    unitCostCents: 50000,
    markupPct: 5000,
    isTaxable: false,
  });
  await sendEstimate(t.ctx, est.id);
  await markAccepted(t.ctx, est.id);
  const inv = await convertFromEstimate(t.ctx, est.id);
  await sendInvoice(t.ctx, inv.id);

  // Paid at 10:00 on 30 June — the last day the June range admits.
  t.setNow("2026-06-30T10:00:00.000Z");
  await recordPayment(t.ctx, inv.id, { amountCents: 75000, method: "check" });

  const categories = await listCategories(t.ctx, org.id);
  const materials = categories.find((c) => c.name === "Materials");
  if (!materials) throw new Error("category missing");
  for (const [spentAt, amountCents] of [
    ["2026-05-31", 1100],
    ["2026-06-01", 2200],
    ["2026-06-30", 3300],
    ["2026-07-01", 4400],
  ] as const) {
    await createExpense(t.ctx, org.id, {
      categoryId: materials.id,
      amountCents,
      spentAt,
      vendor: `V-${spentAt}`,
      isBillable: false,
    });
  }

  t.setNow(NOW);
  return { t, orgId: org.id };
}

describe("ledgerForExport date range", () => {
  const JUNE = { preset: "this_month", startDate: "2026-06-01", endDate: "2026-06-30" } as const;

  it("exports everything when no range is given", async () => {
    const { t, orgId } = await ledgerWorld();
    const all = await ledgerForExport(t.ctx, orgId);
    expect(all.payments).toHaveLength(1);
    expect(all.expenses).toHaveLength(4);
  });

  it("keeps only rows inside the range, excluding the days either side", async () => {
    const { t, orgId } = await ledgerWorld();
    const june = await ledgerForExport(t.ctx, orgId, JUNE);
    expect(june.expenses.map((e) => e.spentAtIso)).toEqual(["2026-06-01", "2026-06-30"]);
  });

  it("includes a payment timestamped on the final day of the range", async () => {
    // Regression: comparing the raw column would make
    // "2026-06-30T10:00:00.000Z" > "2026-06-30" and silently drop it.
    const { t, orgId } = await ledgerWorld();
    const june = await ledgerForExport(t.ctx, orgId, JUNE);
    expect(june.payments).toHaveLength(1);
    expect(june.payments[0]?.amountCents).toBe(75000);
  });

  it("returns nothing for a range with no activity", async () => {
    const { t, orgId } = await ledgerWorld();
    const empty = await ledgerForExport(t.ctx, orgId, {
      preset: "this_month",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
    expect(empty.payments).toHaveLength(0);
    expect(empty.expenses).toHaveLength(0);
  });

  it("treats a null-bounded range as unfiltered", async () => {
    const { t, orgId } = await ledgerWorld();
    const unbounded = await ledgerForExport(t.ctx, orgId, {
      preset: "all",
      startDate: null,
      endDate: null,
    });
    expect(unbounded.expenses).toHaveLength(4);
  });
});
