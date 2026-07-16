import {
  basisPoints,
  cents,
  documentProfit,
  documentTotals,
  priceFromCost,
} from "@fasttrack/core";
import { describe, expect, it } from "vitest";

import { createClient } from "./clientRepo";
import {
  addCustomLine,
  addLineFromPriceBook,
  createDraft,
  estimateProfit,
  getEstimate,
  listEstimates,
  markAccepted,
  markDeclined,
  removeLine,
  sendEstimate,
  updateLine,
} from "./estimateRepo";
import { createOrg } from "./orgRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

async function setup(taxRateBps = 825): Promise<{ t: TestCtx; orgId: string }> {
  const t = await createTestCtx();
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps,
  });
  return { t, orgId: org.id };
}

describe("createDraft (decision 7 — implicit job)", () => {
  it("creates client + quoted job + draft estimate numbered 1001", async () => {
    const { t, orgId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Novak",
      jobTitle: "Panel upgrade",
    });

    expect(est.number).toBe(1001);
    expect(est.status).toBe("draft");
    expect(est.total_cents).toBe(0);

    const jobs = await t.ctx.driver.exec("SELECT title, status, client_id FROM jobs");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe("Panel upgrade");
    expect(jobs[0]?.status).toBe("quoted");

    const clients = await t.ctx.driver.exec("SELECT name FROM clients");
    expect(clients.map((c) => c.name)).toEqual(["Novak"]);
  });

  it("numbers sequentially per org and reuses an existing client", async () => {
    const { t, orgId } = await setup();
    const client = await createClient(t.ctx, orgId, { name: "Okafor Café" });
    const first = await createDraft(t.ctx, orgId, {
      clientId: client.id,
      jobTitle: "Lighting retrofit",
    });
    const second = await createDraft(t.ctx, orgId, {
      clientId: client.id,
      jobTitle: "Patio circuits",
    });
    expect([first.number, second.number]).toEqual([1001, 1002]);

    const clients = await t.ctx.driver.exec("SELECT id FROM clients");
    expect(clients).toHaveLength(1);
  });
});

describe("lines and totals", () => {
  it("price-book lines snapshot cost, markup, and priceFromCost price", async () => {
    const { t, orgId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Novak",
      jobTitle: "Panel upgrade",
    });
    const items = await t.ctx.driver.exec(
      "SELECT id FROM price_book_items WHERE org_id = ? AND name = ?",
      [orgId, "200A panel — Square D QO"],
    );
    const itemId = String(items[0]?.id);

    await addLineFromPriceBook(t.ctx, est.id, itemId, 1);

    const detail = await getEstimate(t.ctx, est.id);
    expect(detail.lines).toHaveLength(1);
    const line = detail.lines[0];
    if (!line) throw new Error("line missing");
    expect(line.unit_cost_cents).toBe(42000);
    expect(line.markup_pct).toBe(3500);
    expect(line.unit_price_cents).toBe(priceFromCost(cents(42000), basisPoints(3500)));
    expect(line.unit_price_cents).toBe(56700);
    expect(line.price_book_item_id).toBe(itemId);
  });

  it("persists documentTotals over active lines with the org tax rate", async () => {
    const { t, orgId } = await setup(825);
    const est = await createDraft(t.ctx, orgId, {
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

    const detail = await getEstimate(t.ctx, est.id);
    const expected = documentTotals(
      detail.lines.map((l) => ({
        unitPriceCents: l.unit_price_cents,
        quantity: l.quantity,
        isTaxable: l.is_taxable,
      })),
      cents(0),
      basisPoints(825),
    );
    expect(detail.estimate.subtotal_cents).toBe(expected.subtotalCents);
    expect(detail.estimate.tax_cents).toBe(expected.taxCents);
    expect(detail.estimate.total_cents).toBe(expected.totalCents);
    // Pin the arithmetic: 56700 + 161200 subtotal, 8.25% tax on 56700.
    expect(detail.estimate.subtotal_cents).toBe(217900);
    expect(detail.estimate.tax_cents).toBe(4678);
    expect(detail.estimate.total_cents).toBe(222578);
  });

  it("updateLine reprices from merged cost/markup and recomputes totals", async () => {
    const { t, orgId } = await setup(0);
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Chen",
      jobTitle: "Sub-panel add",
    });
    await addCustomLine(t.ctx, est.id, {
      kind: "material",
      description: "Breakers",
      quantity: 2,
      unit: "ea",
      unitCostCents: 1000,
      markupPct: 5000,
      isTaxable: true,
    });
    let detail = await getEstimate(t.ctx, est.id);
    const lineId = detail.lines[0]?.id;
    if (!lineId) throw new Error("line missing");

    await updateLine(t.ctx, lineId, { unitCostCents: 2000, quantity: 3 });

    detail = await getEstimate(t.ctx, est.id);
    expect(detail.lines[0]?.unit_price_cents).toBe(3000); // 2000 × 1.5
    expect(detail.estimate.subtotal_cents).toBe(9000); // 3000 × 3
    expect(detail.estimate.total_cents).toBe(9000);
  });

  it("removeLine soft-deletes and shrinks totals", async () => {
    const { t, orgId } = await setup(0);
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Chen",
      jobTitle: "Sub-panel add",
    });
    await addCustomLine(t.ctx, est.id, {
      kind: "material",
      description: "Keep",
      quantity: 1,
      unit: "ea",
      unitCostCents: 1000,
      markupPct: 0,
      isTaxable: false,
    });
    await addCustomLine(t.ctx, est.id, {
      kind: "material",
      description: "Drop",
      quantity: 1,
      unit: "ea",
      unitCostCents: 2000,
      markupPct: 0,
      isTaxable: false,
    });
    let detail = await getEstimate(t.ctx, est.id);
    const dropId = detail.lines.find((l) => l.description === "Drop")?.id;
    if (!dropId) throw new Error("line missing");

    await removeLine(t.ctx, dropId);

    detail = await getEstimate(t.ctx, est.id);
    expect(detail.lines.map((l) => l.description)).toEqual(["Keep"]);
    expect(detail.estimate.total_cents).toBe(1000);
    const raw = await t.ctx.driver.exec(
      "SELECT deleted_at FROM estimate_lines WHERE id = ?",
      [dropId],
    );
    expect(raw[0]?.deleted_at).not.toBeNull();
  });

  it("estimateProfit equals documentProfit over the same lines", async () => {
    const { t, orgId } = await setup(825);
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Novak",
      jobTitle: "Panel upgrade",
    });
    await addCustomLine(t.ctx, est.id, {
      kind: "material",
      description: "Panel",
      quantity: 1,
      unit: "ea",
      unitCostCents: 42000,
      markupPct: 3500,
      isTaxable: true,
    });
    const detail = await getEstimate(t.ctx, est.id);
    const profit = estimateProfit(detail);
    const expected = documentProfit(
      detail.lines.map((l) => ({
        unitCostCents: l.unit_cost_cents,
        unitPriceCents: l.unit_price_cents,
        quantity: l.quantity,
      })),
      detail.estimate.discount_cents,
    );
    expect(profit).toEqual(expected);
    expect(profit.marginBps).toBe(2593); // 14700 / 56700
  });
});

describe("status transitions", () => {
  it("sendEstimate stamps issued_at and flips draft → sent", async () => {
    const { t, orgId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Salazar",
      jobTitle: "Standby generator hookup",
    });
    t.setNow("2026-07-16T15:00:00.000Z");
    await sendEstimate(t.ctx, est.id);
    const detail = await getEstimate(t.ctx, est.id);
    expect(detail.estimate.status).toBe("sent");
    expect(detail.estimate.issued_at).toBe("2026-07-16T15:00:00.000Z");
  });

  it("rejects sending a non-draft estimate", async () => {
    const { t, orgId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Salazar",
      jobTitle: "Standby generator hookup",
    });
    await sendEstimate(t.ctx, est.id);
    await expect(sendEstimate(t.ctx, est.id)).rejects.toThrow(/draft/i);
  });

  it("accepts and declines only from sent/viewed", async () => {
    const { t, orgId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Nguyen",
      jobTitle: "Landscape lighting",
    });
    await expect(markAccepted(t.ctx, est.id)).rejects.toThrow(/sent/i);
    await sendEstimate(t.ctx, est.id);
    await markAccepted(t.ctx, est.id);
    const detail = await getEstimate(t.ctx, est.id);
    expect(detail.estimate.status).toBe("accepted");

    const other = await createDraft(t.ctx, orgId, {
      newClientName: "Whitfield",
      jobTitle: "Smoke detector wiring",
    });
    await sendEstimate(t.ctx, other.id);
    await markDeclined(t.ctx, other.id);
    expect((await getEstimate(t.ctx, other.id)).estimate.status).toBe("declined");
  });
});

describe("listEstimates", () => {
  it("returns newest-first rows joined with client and job names", async () => {
    const { t, orgId } = await setup();
    t.setNow("2026-07-01T10:00:00.000Z");
    await createDraft(t.ctx, orgId, { newClientName: "Okafor Café", jobTitle: "Lighting retrofit" });
    t.setNow("2026-07-08T10:00:00.000Z");
    await createDraft(t.ctx, orgId, { newClientName: "Salazar", jobTitle: "Generator hookup" });

    const rows = await listEstimates(t.ctx, orgId);
    expect(rows.map((r) => r.clientName)).toEqual(["Salazar", "Okafor Café"]);
    expect(rows.map((r) => r.jobTitle)).toEqual(["Generator hookup", "Lighting retrofit"]);
    expect(rows[0]?.estimate.number).toBe(1002);
  });
});
