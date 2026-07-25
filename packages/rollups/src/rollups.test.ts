import { basisPoints, cents } from "@fasttrack/core";
import type {
  Client,
  Estimate,
  EstimateLine,
  Expense,
  ExpenseCategory,
  Invoice,
  Job,
  Payment,
} from "@fasttrack/schema";
import { describe, expect, it } from "vitest";

import {
  agingBuckets,
  budgetVsActual,
  buildTips,
  computeHealth,
  jobProfitability,
  monthlySeries,
  spendByCategory,
} from "./rollups.js";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const ORG = "org-1";
const T = "2026-07-01T00:00:00.000Z";

let seq = 0;
const id = () => `id-${++seq}`;

function estimate(p: Partial<Estimate>): Estimate {
  return {
    id: id(), org_id: ORG, job_id: "job-1", number: 1, status: "accepted",
    issued_at: T, expires_at: null, subtotal_cents: 0, tax_cents: 0,
    discount_cents: 0, total_cents: 0, notes: null, terms: null, pdf_url: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Estimate;
}
function line(p: Partial<EstimateLine>): EstimateLine {
  return {
    id: id(), org_id: ORG, estimate_id: "e-1", sort_order: 0, kind: "labor",
    description: "work", quantity: 1, unit: "hr", unit_cost_cents: 0,
    markup_pct: 0, unit_price_cents: 0, is_taxable: false,
    price_book_item_id: null, created_at: T, updated_at: T, deleted_at: null, ...p,
  } as EstimateLine;
}
function invoice(p: Partial<Invoice>): Invoice {
  return {
    id: id(), org_id: ORG, job_id: "job-1", converted_from_estimate_id: null,
    number: 1, status: "sent", issued_at: T, due_at: "2026-07-30T00:00:00.000Z",
    subtotal_cents: 0, tax_cents: 0, discount_cents: 0, total_cents: 0,
    balance_cents: 0, notes: null, terms: null, pdf_url: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Invoice;
}
function payment(p: Partial<Payment>): Payment {
  return {
    id: id(), org_id: ORG, invoice_id: "i-1", amount_cents: 0, method: "cash",
    paid_at: T, reference: null, notes: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Payment;
}
function expense(p: Partial<Expense>): Expense {
  return {
    id: id(), org_id: ORG, job_id: null, category_id: "cat-1", vendor: null,
    description: null, amount_cents: 100, spent_at: "2026-07-10",
    is_billable: false, receipt_storage_path: null, ocr_extracted: null,
    created_at: T, updated_at: T, deleted_at: null, ...p,
  } as Expense;
}
const CATS = [
  { id: "cat-1", org_id: ORG, name: "Materials", sort_order: 0, created_at: T, updated_at: T, deleted_at: null },
  { id: "cat-2", org_id: ORG, name: "Fuel", sort_order: 1, created_at: T, updated_at: T, deleted_at: null },
] as ExpenseCategory[];

describe("computeHealth", () => {
  it("reads neutral margin when there is no accepted-estimate evidence", () => {
    const { inputs } = computeHealth(
      { estimates: [], estimateLines: [], invoices: [], payments: [], expenses: [] },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.marginBps).toBe(3000);
    expect(inputs.outstandingCents).toBe(0);
  });

  it("derives margin from accepted estimates inside the 90d window only", () => {
    const inWindow = estimate({ id: "e-in" });
    const stale = estimate({ id: "e-old", issued_at: "2025-01-01T00:00:00.000Z" });
    const lines = [
      line({ estimate_id: "e-in", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
      line({ estimate_id: "e-old", quantity: 1, unit_cost_cents: 9999, unit_price_cents: 10000 }),
    ];
    const { inputs } = computeHealth(
      { estimates: [inWindow, stale], estimateLines: lines, invoices: [], payments: [], expenses: [] },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.marginBps).toBe(5000); // only the in-window 50% line counts
  });

  it("nets in-window expenses against realized profit for the margin component", () => {
    // One accepted estimate: revenue 10000, cost 5000 → 5000 profit (50% gross).
    const est = estimate({ id: "e-1" });
    const lines = [
      line({ estimate_id: "e-1", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
    ];
    // 3000 of overhead expenses in-window → net profit 2000 → 20% net margin.
    const expenses = [
      expense({ amount_cents: 2000, spent_at: "2026-07-10" }),
      expense({ amount_cents: 1000, spent_at: "2026-07-05" }),
    ];
    const { inputs } = computeHealth(
      { estimates: [est], estimateLines: lines, invoices: [], payments: [], expenses },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.marginBps).toBe(2000);
  });

  it("excludes billable job costs from the margin, since line costs already net them out", () => {
    // Revenue 10000, cost 5000 → 5000 gross profit. The 3000 billable receipt IS
    // that job's material spend, already subtracted inside the line cost —
    // counting it again would charge the business twice for one purchase.
    const est = estimate({ id: "e-1" });
    const lines = [
      line({ estimate_id: "e-1", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
    ];
    const expenses = [
      expense({ amount_cents: 3000, is_billable: true, job_id: "j-1" }),
      expense({ amount_cents: 1000, is_billable: false }),
    ];
    const { inputs } = computeHealth(
      { estimates: [est], estimateLines: lines, invoices: [], payments: [], expenses },
      basisPoints(3000),
      NOW,
    );
    // Only the 1000 of overhead lands: 5000 - 1000 = 4000 on 10000 revenue.
    expect(inputs.marginBps).toBe(4000);
  });

  it("drives the margin negative when expenses swamp realized profit", () => {
    const est = estimate({ id: "e-1" });
    const lines = [
      line({ estimate_id: "e-1", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
    ];
    const expenses = [expense({ amount_cents: 900000, spent_at: "2026-07-10" })];
    const { inputs, health } = computeHealth(
      { estimates: [est], estimateLines: lines, invoices: [], payments: [], expenses },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.marginBps).toBeLessThan(0);
    // A business bleeding cash on overhead must not read "good".
    expect(health.marginComponent).toBe(0);
    expect(health.band).not.toBe("good");
  });

  it("ignores expenses outside the 90-day window", () => {
    const est = estimate({ id: "e-1" });
    const lines = [
      line({ estimate_id: "e-1", quantity: 1, unit_cost_cents: 5000, unit_price_cents: 10000 }),
    ];
    const expenses = [expense({ amount_cents: 900000, spent_at: "2025-01-01" })];
    const { inputs } = computeHealth(
      { estimates: [est], estimateLines: lines, invoices: [], payments: [], expenses },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.marginBps).toBe(5000); // stale overhead does not touch this window
  });

  it("splits outstanding into overdue by due date and sums collections", () => {
    const invoices = [
      invoice({ status: "sent", total_cents: 10000, balance_cents: 10000, due_at: "2026-07-01T00:00:00.000Z" }),
      invoice({ status: "partial", total_cents: 20000, balance_cents: 5000, due_at: "2026-08-01T00:00:00.000Z" }),
      invoice({ status: "paid", total_cents: 7000, balance_cents: 0 }),
    ];
    const { inputs } = computeHealth(
      { estimates: [], estimateLines: [], invoices, payments: [payment({ amount_cents: 15000 })], expenses: [] },
      basisPoints(3000),
      NOW,
    );
    expect(inputs.outstandingCents).toBe(15000);
    expect(inputs.overdueCents).toBe(10000);
    expect(inputs.collectedCents).toBe(15000);
    expect(inputs.invoicedCents).toBe(37000);
  });
});

describe("monthlySeries", () => {
  it("buckets issued invoices and payments into the right months, oldest first", () => {
    const points = monthlySeries(
      [
        invoice({ issued_at: "2026-05-10T00:00:00.000Z", total_cents: 800 }),
        invoice({ status: "draft", issued_at: "2026-05-11T00:00:00.000Z", total_cents: 999 }),
      ],
      [payment({ paid_at: "2026-07-02T00:00:00.000Z", amount_cents: 300 })],
      NOW,
      6,
    );
    expect(points).toHaveLength(6);
    expect(points[0]?.key).toBe("2026-02");
    expect(points.find((p) => p.key === "2026-05")?.invoicedCents).toBe(800); // draft excluded
    expect(points.at(-1)?.collectedCents).toBe(300);
  });
});

describe("agingBuckets", () => {
  it("places balances on the 30/60 day boundaries correctly", () => {
    const mk = (daysPast: number) =>
      invoice({
        balance_cents: 100,
        due_at: new Date(NOW.getTime() - daysPast * 86_400_000).toISOString(),
      });
    const b = agingBuckets([mk(-5), mk(15), mk(45), mk(90)], NOW);
    expect(b.notDueCents).toBe(100);
    expect(b.d1to30Cents).toBe(100);
    expect(b.d31to60Cents).toBe(100);
    expect(b.d61plusCents).toBe(100);
    expect(b.overdueCount).toBe(3);
  });
});

describe("spendByCategory / budgetVsActual", () => {
  it("filters to the month, groups, sorts descending, merges budgets", () => {
    const expenses = [
      expense({ category_id: "cat-1", amount_cents: 500 }),
      expense({ category_id: "cat-2", amount_cents: 900 }),
      expense({ category_id: "cat-1", amount_cents: 100, spent_at: "2026-06-01" }),
    ];
    const spend = spendByCategory(expenses, CATS, "2026-07");
    expect(spend.totalCents).toBe(1400);
    expect(spend.rows[0]?.name).toBe("Fuel");

    const lines = budgetVsActual(
      [{ category_id: "cat-1", month: "2026-07-01", amount_cents: cents(300) }],
      expenses,
      CATS,
      "2026-07",
    );
    const materials = lines.find((l) => l.categoryId === "cat-1");
    expect(materials?.budgetCents).toBe(300);
    expect(materials?.actualCents).toBe(500);
    expect(lines.find((l) => l.categoryId === "cat-2")?.budgetCents).toBe(0);
  });
});

describe("jobProfitability", () => {
  it("counts accepted-estimate economics plus expenses, omits evidence-free jobs", () => {
    const jobs = [
      { id: "job-1", org_id: ORG, client_id: "c-1", title: "Panel", address: null, scheduled_at: null, status: "in_progress", notes: null, created_at: T, updated_at: T, deleted_at: null },
      { id: "job-2", org_id: ORG, client_id: "c-1", title: "Idle", address: null, scheduled_at: null, status: "lead", notes: null, created_at: T, updated_at: T, deleted_at: null },
    ] as Job[];
    const clients = [
      { id: "c-1", org_id: ORG, name: "Dana", email: null, phone: null, address: null, notes: null, created_at: T, updated_at: T, deleted_at: null },
    ] as Client[];
    const rows = jobProfitability({
      jobs,
      clients,
      estimates: [estimate({ id: "e-1", job_id: "job-1" })],
      estimateLines: [line({ estimate_id: "e-1", quantity: 2, unit_cost_cents: 1000, unit_price_cents: 3000 })],
      expenses: [expense({ job_id: "job-1", amount_cents: 500 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      jobId: "job-1",
      clientName: "Dana",
      revenueCents: 6000,
      costCents: 2500,
      profitCents: 3500,
    });
  });
});

describe("buildTips", () => {
  it("fires over-budget, overdue, and unbilled rules; all-clear otherwise", () => {
    const health = computeHealth(
      { estimates: [], estimateLines: [], invoices: [], payments: [], expenses: [] },
      basisPoints(3000),
      NOW,
    );
    const quiet = buildTips({
      budgetLines: [],
      aging: agingBuckets([], NOW),
      health,
      estimates: [],
      invoices: [],
    });
    expect(quiet).toHaveLength(1);
    expect(quiet[0]?.id).toBe("all-clear");

    const noisy = buildTips({
      budgetLines: [{ categoryId: "cat-1", name: "Materials", budgetCents: 100, actualCents: 500 }],
      aging: agingBuckets([invoice({ balance_cents: 900, due_at: "2026-07-01T00:00:00.000Z" })], NOW),
      health,
      estimates: [estimate({ id: "e-9", total_cents: 4200 })],
      invoices: [],
    });
    const ids = noisy.map((t) => t.id);
    expect(ids).toContain("over-budget-cat-1");
    expect(ids).toContain("overdue-receivables");
    expect(ids).toContain("accepted-not-invoiced");
  });
});
