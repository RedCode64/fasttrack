import { describe, expect, it } from "vitest";

import {
  addCustomLine,
  createDraft,
  markAccepted,
  sendEstimate,
} from "./estimateRepo";
import {
  convertFromEstimate,
  getInvoice,
  listInvoices,
  recordPayment,
  sendInvoice,
} from "./invoiceRepo";
import { createOrg } from "./orgRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

interface Scenario {
  t: TestCtx;
  orgId: string;
  estimateId: string;
}

/** Org + accepted two-line estimate (total 222578 at 8.25% tax). */
async function acceptedEstimate(): Promise<Scenario> {
  const t = await createTestCtx();
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 825,
  });
  const est = await createDraft(t.ctx, org.id, {
    newClientName: "Novak",
    jobTitle: "Panel upgrade",
  });
  await addCustomLine(t.ctx, est.id, {
    kind: "material",
    description: "200A panel — Square D QO",
    quantity: 1,
    unit: "ea",
    unitCostCents: 42000,
    markupPct: 3500,
    isTaxable: true,
  });
  await addCustomLine(t.ctx, est.id, {
    kind: "labor",
    description: "Labor — service change",
    quantity: 16,
    unit: "hr",
    unitCostCents: 6500,
    markupPct: 5500,
    isTaxable: false,
  });
  await sendEstimate(t.ctx, est.id);
  await markAccepted(t.ctx, est.id);
  return { t, orgId: org.id, estimateId: est.id };
}

describe("convertFromEstimate", () => {
  it("copies active lines, backlinks, and mirrors totals into a draft invoice", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);

    expect(invoice.status).toBe("draft");
    expect(invoice.number).toBe(1001); // invoice counter independent of estimates
    expect(invoice.converted_from_estimate_id).toBe(estimateId);
    expect(invoice.total_cents).toBe(222578);
    expect(invoice.balance_cents).toBe(222578);
    expect(invoice.issued_at).toBeNull();

    const detail = await getInvoice(t.ctx, invoice.id);
    expect(detail.lines).toHaveLength(2);
    expect(detail.lines.map((l) => l.description)).toEqual([
      "200A panel — Square D QO",
      "Labor — service change",
    ]);
    // New ids, not the estimate line ids.
    const estLineIds = await t.ctx.driver.exec(
      "SELECT id FROM estimate_lines WHERE estimate_id = ?",
      [estimateId],
    );
    const copiedIds = new Set(detail.lines.map((l) => l.id));
    for (const row of estLineIds) {
      expect(copiedIds.has(String(row.id))).toBe(false);
    }
  });

  it("refuses non-accepted estimates and double conversion", async () => {
    const t = await createTestCtx();
    const org = await createOrg(t.ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    const draft = await createDraft(t.ctx, org.id, {
      newClientName: "Chen",
      jobTitle: "Sub-panel add",
    });
    await expect(convertFromEstimate(t.ctx, draft.id)).rejects.toThrow(/accepted/i);

    const { t: t2, estimateId } = await acceptedEstimate();
    await convertFromEstimate(t2.ctx, estimateId);
    await expect(convertFromEstimate(t2.ctx, estimateId)).rejects.toThrow(/already/i);
  });
});

describe("sendInvoice", () => {
  it("stamps issued/due (+14d) and moves the job to in_progress", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);
    t.setNow("2026-07-16T15:00:00.000Z");

    await sendInvoice(t.ctx, invoice.id);

    const detail = await getInvoice(t.ctx, invoice.id);
    expect(detail.invoice.status).toBe("sent");
    expect(detail.invoice.issued_at).toBe("2026-07-16T15:00:00.000Z");
    expect(detail.invoice.due_at).toBe("2026-07-30T15:00:00.000Z");

    const jobs = await t.ctx.driver.exec("SELECT status FROM jobs");
    expect(jobs[0]?.status).toBe("in_progress");
  });

  it("only drafts can be sent", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);
    await sendInvoice(t.ctx, invoice.id);
    await expect(sendInvoice(t.ctx, invoice.id)).rejects.toThrow(/draft/i);
  });
});

describe("recordPayment", () => {
  it("walks partial → paid with an exact balance ledger", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);
    await sendInvoice(t.ctx, invoice.id);

    await recordPayment(t.ctx, invoice.id, { amountCents: 100000, method: "check" });
    let detail = await getInvoice(t.ctx, invoice.id);
    expect(detail.invoice.status).toBe("partial");
    expect(detail.invoice.balance_cents).toBe(122578);

    await recordPayment(t.ctx, invoice.id, { amountCents: 122578, method: "zelle" });
    detail = await getInvoice(t.ctx, invoice.id);
    expect(detail.invoice.status).toBe("paid");
    expect(detail.invoice.balance_cents).toBe(0);
    expect(detail.payments).toHaveLength(2);
  });

  it("overpayment drives the balance negative but still reads paid", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);
    await sendInvoice(t.ctx, invoice.id);
    await recordPayment(t.ctx, invoice.id, { amountCents: 222578 + 1000, method: "cash" });
    const detail = await getInvoice(t.ctx, invoice.id);
    expect(detail.invoice.balance_cents).toBe(-1000);
    expect(detail.invoice.status).toBe("paid");
  });

  it("rejects drafts and non-positive amounts", async () => {
    const { t, estimateId } = await acceptedEstimate();
    const invoice = await convertFromEstimate(t.ctx, estimateId);
    await expect(
      recordPayment(t.ctx, invoice.id, { amountCents: 100, method: "cash" }),
    ).rejects.toThrow(/draft/i);
    await sendInvoice(t.ctx, invoice.id);
    await expect(
      recordPayment(t.ctx, invoice.id, { amountCents: 0, method: "cash" }),
    ).rejects.toThrow(/positive/i);
  });
});

describe("listInvoices — derived overdue (never stored)", () => {
  async function threeInvoices(): Promise<{ t: TestCtx; orgId: string }> {
    const { t, orgId, estimateId } = await acceptedEstimate();
    // Invoice 1: sent, due in the future → displays sent.
    const inv1 = await convertFromEstimate(t.ctx, estimateId);
    t.setNow("2026-07-16T12:00:00.000Z");
    await sendInvoice(t.ctx, inv1.id);

    // Invoice 2: sent long ago, past due, unpaid → displays overdue.
    const est2 = await createDraft(t.ctx, orgId, {
      newClientName: "Hartley",
      jobTitle: "Deck lighting",
    });
    await addCustomLine(t.ctx, est2.id, {
      kind: "labor",
      description: "Labor",
      quantity: 4,
      unit: "hr",
      unitCostCents: 6000,
      markupPct: 5500,
      isTaxable: false,
    });
    await sendEstimate(t.ctx, est2.id);
    await markAccepted(t.ctx, est2.id);
    const inv2 = await convertFromEstimate(t.ctx, est2.id);
    t.setNow("2026-06-01T12:00:00.000Z");
    await sendInvoice(t.ctx, inv2.id); // due 2026-06-15, long past

    // Invoice 3: past due but fully paid → displays paid.
    const est3 = await createDraft(t.ctx, orgId, {
      newClientName: "Delgado",
      jobTitle: "Fan install",
    });
    await addCustomLine(t.ctx, est3.id, {
      kind: "labor",
      description: "Labor",
      quantity: 2,
      unit: "hr",
      unitCostCents: 6000,
      markupPct: 5000,
      isTaxable: false,
    });
    await sendEstimate(t.ctx, est3.id);
    await markAccepted(t.ctx, est3.id);
    const inv3 = await convertFromEstimate(t.ctx, est3.id);
    await sendInvoice(t.ctx, inv3.id);
    const paidDetail = await getInvoice(t.ctx, inv3.id);
    await recordPayment(t.ctx, inv3.id, {
      amountCents: paidDetail.invoice.total_cents,
      method: "bank_transfer",
    });

    t.setNow("2026-07-16T12:00:00.000Z");
    return { t, orgId };
  }

  it("derives overdue from due date + open balance without writing it", async () => {
    const { t, orgId } = await threeInvoices();
    const rows = await listInvoices(t.ctx, orgId, "all");
    const byClient = new Map(rows.map((r) => [r.clientName, r.displayStatus]));
    expect(byClient.get("Novak")).toBe("sent");
    expect(byClient.get("Hartley")).toBe("overdue");
    expect(byClient.get("Delgado")).toBe("paid");

    const stored = await t.ctx.driver.exec("SELECT DISTINCT status FROM invoices");
    expect(stored.map((r) => r.status)).not.toContain("overdue");
  });

  it("filters map to derived statuses", async () => {
    const { t, orgId } = await threeInvoices();
    expect((await listInvoices(t.ctx, orgId, "overdue")).map((r) => r.clientName)).toEqual([
      "Hartley",
    ]);
    expect((await listInvoices(t.ctx, orgId, "sent")).map((r) => r.clientName)).toEqual([
      "Novak",
    ]);
    expect((await listInvoices(t.ctx, orgId, "paid")).map((r) => r.clientName)).toEqual([
      "Delgado",
    ]);
    expect(await listInvoices(t.ctx, orgId, "all")).toHaveLength(3);
  });

  it("detail carries the derived display status too", async () => {
    const { t, orgId } = await threeInvoices();
    const overdueRow = (await listInvoices(t.ctx, orgId, "overdue"))[0];
    if (!overdueRow) throw new Error("expected an overdue invoice");
    const detail = await getInvoice(t.ctx, overdueRow.invoice.id);
    expect(detail.displayStatus).toBe("overdue");
    expect(detail.invoice.status).toBe("sent");
  });
});
