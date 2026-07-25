import {
  basisPoints,
  cents,
  documentProfit,
  healthScore,
  roundHalfUp,
  type BasisPoints,
  type Cents,
  type HealthInputs,
  type HealthScore,
  type ProfitLine,
} from "@fasttrack/core";
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

/** Invoice statuses that still have money to collect. */
const OPEN_STATUSES = new Set(["sent", "viewed", "partial", "overdue"]);
const HEALTH_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-07" bucketing key — must stay in lockstep with web's format.monthKey. */
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function withinDays(iso: string | null, now: Date, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t <= now.getTime() && now.getTime() - t <= days * DAY_MS;
}

/** Schema rows are snake_case DB shapes; core math takes camelCase ProfitLines. */
function toProfitLines(lines: readonly EstimateLine[]): ProfitLine[] {
  return lines.map((line) => ({
    unitCostCents: line.unit_cost_cents,
    unitPriceCents: line.unit_price_cents,
    quantity: line.quantity,
  }));
}

function linesByEstimate(lines: readonly EstimateLine[]): Map<string, EstimateLine[]> {
  const map = new Map<string, EstimateLine[]>();
  for (const line of lines) {
    const bucket = map.get(line.estimate_id);
    if (bucket) {
      bucket.push(line);
    } else {
      map.set(line.estimate_id, [line]);
    }
  }
  return map;
}

export interface HealthResult {
  health: HealthScore;
  inputs: HealthInputs;
}

/**
 * Derives decision B's inputs from raw rows, then scores them.
 * Margin evidence comes from accepted estimates in the window (R1's realized-
 * margin proxy); with no evidence the margin reads neutral, matching
 * healthScore's "empty books are healthy" stance.
 */
export function computeHealth(
  data: {
    estimates: readonly Estimate[];
    estimateLines: readonly EstimateLine[];
    invoices: readonly Invoice[];
    payments: readonly Payment[];
    expenses: readonly Expense[];
  },
  targetMarginBps: BasisPoints,
  now: Date,
): HealthResult {
  const lineMap = linesByEstimate(data.estimateLines);

  let profitSum = 0;
  let revenueSum = 0;
  for (const estimate of data.estimates) {
    if (estimate.status !== "accepted") continue;
    if (!withinDays(estimate.issued_at ?? estimate.created_at, now, HEALTH_WINDOW_DAYS)) continue;
    const lines = lineMap.get(estimate.id) ?? [];
    const profit = documentProfit(toProfitLines(lines), estimate.discount_cents);
    profitSum += profit.profitCents;
    revenueSum += profit.revenueCents;
  }

  // Overhead the line-item margins never see — fuel, tools, permits, office. A
  // gauge that ignores it can read "good" while the business bleeds cash, so we
  // net in-window expenses against realized profit to get a true margin.
  //
  // Billable receipts are skipped: those are job costs, and the estimate line's
  // unit_cost_cents already subtracted them inside profitSum. Counting them here
  // too would charge the business twice for a single purchase and sink the gauge
  // for anyone who diligently logs their material receipts.
  let expenseSum = 0;
  for (const expense of data.expenses) {
    if (expense.is_billable) continue;
    if (withinDays(expense.spent_at, now, HEALTH_WINDOW_DAYS)) {
      expenseSum += expense.amount_cents;
    }
  }
  const netProfit = profitSum - expenseSum;

  const marginBps =
    revenueSum === 0
      ? targetMarginBps // no revenue evidence → neutral, not alarming
      : basisPoints(roundHalfUp((netProfit * 10_000) / revenueSum));

  let outstanding = 0;
  let overdue = 0;
  let invoiced = 0;
  for (const invoice of data.invoices) {
    if (invoice.status !== "draft" && withinDays(invoice.issued_at, now, HEALTH_WINDOW_DAYS)) {
      invoiced += invoice.total_cents;
    }
    if (OPEN_STATUSES.has(invoice.status)) {
      const balance = Math.max(0, invoice.balance_cents);
      outstanding += balance;
      if (invoice.due_at && new Date(invoice.due_at).getTime() < now.getTime()) {
        overdue += balance;
      }
    }
  }

  let collected = 0;
  for (const payment of data.payments) {
    if (withinDays(payment.paid_at, now, HEALTH_WINDOW_DAYS)) {
      collected += payment.amount_cents;
    }
  }

  const inputs: HealthInputs = {
    marginBps,
    targetMarginBps,
    overdueCents: cents(overdue),
    outstandingCents: cents(outstanding),
    collectedCents: cents(collected),
    invoicedCents: cents(invoiced),
  };
  return { health: healthScore(inputs), inputs };
}

export interface MonthPoint {
  key: string;
  label: string;
  invoicedCents: number;
  collectedCents: number;
}

/** Oldest→newest series for the revenue bars. */
export function monthlySeries(
  invoices: readonly Invoice[],
  payments: readonly Payment[],
  now: Date,
  monthsBack = 6,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    points.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      invoicedCents: 0,
      collectedCents: 0,
    });
  }
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const invoice of invoices) {
    if (invoice.status === "draft" || !invoice.issued_at) continue;
    const point = byKey.get(invoice.issued_at.slice(0, 7));
    if (point) point.invoicedCents += invoice.total_cents;
  }
  for (const payment of payments) {
    const point = byKey.get(payment.paid_at.slice(0, 7));
    if (point) point.collectedCents += payment.amount_cents;
  }
  return points;
}

export interface AgingBuckets {
  notDueCents: number;
  d1to30Cents: number;
  d31to60Cents: number;
  d61plusCents: number;
  overdueCount: number;
}

export function agingBuckets(invoices: readonly Invoice[], now: Date): AgingBuckets {
  const buckets: AgingBuckets = {
    notDueCents: 0,
    d1to30Cents: 0,
    d31to60Cents: 0,
    d61plusCents: 0,
    overdueCount: 0,
  };
  for (const invoice of invoices) {
    if (!OPEN_STATUSES.has(invoice.status)) continue;
    const balance = Math.max(0, invoice.balance_cents);
    if (balance === 0) continue;
    const due = invoice.due_at ? new Date(invoice.due_at).getTime() : null;
    const daysPast = due === null ? 0 : Math.floor((now.getTime() - due) / DAY_MS);
    if (due === null || daysPast <= 0) {
      buckets.notDueCents += balance;
    } else {
      buckets.overdueCount += 1;
      if (daysPast <= 30) buckets.d1to30Cents += balance;
      else if (daysPast <= 60) buckets.d31to60Cents += balance;
      else buckets.d61plusCents += balance;
    }
  }
  return buckets;
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  cents: number;
}

/** Spend grouped by category for one month ("2026-07"), sorted descending. */
export function spendByCategory(
  expenses: readonly Expense[],
  categories: readonly ExpenseCategory[],
  month: string,
): { rows: CategorySpend[]; totalCents: number } {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sums = new Map<string, number>();
  let total = 0;
  for (const expense of expenses) {
    if (!expense.spent_at.startsWith(month)) continue;
    sums.set(expense.category_id, (sums.get(expense.category_id) ?? 0) + expense.amount_cents);
    total += expense.amount_cents;
  }
  const rows = [...sums.entries()]
    .map(([categoryId, centsSum]) => ({
      categoryId,
      name: names.get(categoryId) ?? "Uncategorized",
      cents: centsSum,
    }))
    .sort((a, b) => b.cents - a.cents);
  return { rows, totalCents: total };
}

export interface BudgetLine {
  categoryId: string;
  name: string;
  budgetCents: number;
  actualCents: number;
}

export function budgetVsActual(
  budgets: readonly { category_id: string; month: string; amount_cents: Cents }[],
  expenses: readonly Expense[],
  categories: readonly ExpenseCategory[],
  month: string,
): BudgetLine[] {
  const { rows } = spendByCategory(expenses, categories, month);
  const actuals = new Map(rows.map((r) => [r.categoryId, r.cents]));
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const lines = new Map<string, BudgetLine>();

  for (const budget of budgets) {
    if (!budget.month.startsWith(month)) continue;
    lines.set(budget.category_id, {
      categoryId: budget.category_id,
      name: names.get(budget.category_id) ?? "Uncategorized",
      budgetCents: budget.amount_cents,
      actualCents: actuals.get(budget.category_id) ?? 0,
    });
  }
  for (const row of rows) {
    if (!lines.has(row.categoryId)) {
      lines.set(row.categoryId, {
        categoryId: row.categoryId,
        name: row.name,
        budgetCents: 0,
        actualCents: row.cents,
      });
    }
  }
  return [...lines.values()].sort((a, b) => b.actualCents - a.actualCents);
}

export interface JobProfitRow {
  jobId: string;
  title: string;
  clientName: string;
  status: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginBps: number;
}

/**
 * Per-job economics: revenue and line costs from ACCEPTED estimates (the R1
 * proxy), plus attributable expenses. Jobs with neither are omitted.
 */
export function jobProfitability(data: {
  jobs: readonly Job[];
  clients: readonly Client[];
  estimates: readonly Estimate[];
  estimateLines: readonly EstimateLine[];
  expenses: readonly Expense[];
}): JobProfitRow[] {
  const clientNames = new Map(data.clients.map((c) => [c.id, c.name]));
  const lineMap = linesByEstimate(data.estimateLines);

  const rows: JobProfitRow[] = [];
  for (const job of data.jobs) {
    let revenue = 0;
    let cost = 0;
    let hasEvidence = false;

    for (const estimate of data.estimates) {
      if (estimate.job_id !== job.id || estimate.status !== "accepted") continue;
      const profit = documentProfit(
        toProfitLines(lineMap.get(estimate.id) ?? []),
        estimate.discount_cents,
      );
      revenue += profit.revenueCents;
      cost += profit.costCents;
      hasEvidence = true;
    }
    for (const expense of data.expenses) {
      if (expense.job_id !== job.id) continue;
      cost += expense.amount_cents;
      hasEvidence = true;
    }
    if (!hasEvidence) continue;

    const profit = revenue - cost;
    rows.push({
      jobId: job.id,
      title: job.title,
      clientName: clientNames.get(job.client_id) ?? "—",
      status: job.status,
      revenueCents: revenue,
      costCents: cost,
      profitCents: profit,
      marginBps: revenue === 0 ? 0 : roundHalfUp((profit * 10_000) / revenue),
    });
  }
  return rows.sort((a, b) => b.revenueCents - a.revenueCents);
}

export interface Tip {
  id: string;
  severity: "warn" | "info";
  title: string;
  detail: string;
}

/** Rule-based v1 of Optimization Tips — every rule reads from data on screen. */
export function buildTips(context: {
  budgetLines: readonly BudgetLine[];
  aging: AgingBuckets;
  health: HealthResult;
  estimates: readonly Estimate[];
  invoices: readonly Invoice[];
}): Tip[] {
  const tips: Tip[] = [];
  const { inputs } = context.health;

  for (const line of context.budgetLines) {
    if (line.budgetCents > 0 && line.actualCents > line.budgetCents) {
      const overCents = line.actualCents - line.budgetCents;
      tips.push({
        id: `over-budget-${line.categoryId}`,
        severity: "warn",
        title: `${line.name} is over budget`,
        detail: `Spending is $${Math.round(overCents / 100).toLocaleString("en-US")} past this month's budget — review recent purchases before month end.`,
      });
    }
  }

  const overdueCents =
    context.aging.d1to30Cents + context.aging.d31to60Cents + context.aging.d61plusCents;
  if (overdueCents > 0) {
    tips.push({
      id: "overdue-receivables",
      severity: "warn",
      title: "Overdue invoices need a nudge",
      detail: `$${Math.round(overdueCents / 100).toLocaleString("en-US")} across ${context.aging.overdueCount} invoice${context.aging.overdueCount === 1 ? "" : "s"} is past due — send reminders today.`,
    });
  }

  if (inputs.marginBps < inputs.targetMarginBps) {
    tips.push({
      id: "margin-below-target",
      severity: "warn",
      title: "Margins are running below target",
      detail: `Realized margin is ${(inputs.marginBps / 100).toFixed(1)}% against a ${(inputs.targetMarginBps / 100).toFixed(1)}% target — check markups on labor lines first.`,
    });
  }

  const invoicedEstimates = new Set(
    context.invoices.map((i) => i.converted_from_estimate_id).filter(Boolean),
  );
  const unbilled = context.estimates.filter(
    (e) => e.status === "accepted" && !invoicedEstimates.has(e.id),
  );
  if (unbilled.length > 0) {
    const waiting = unbilled.reduce((sum, e) => sum + e.total_cents, 0);
    tips.push({
      id: "accepted-not-invoiced",
      severity: "warn",
      title: "Accepted work isn't invoiced yet",
      detail: `${unbilled.length} accepted estimate${unbilled.length === 1 ? "" : "s"} worth $${Math.round(waiting / 100).toLocaleString("en-US")} can be converted to invoices right now.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: "all-clear",
      severity: "info",
      title: "No open optimizations",
      detail: "Budgets, receivables, and margins all look healthy this month.",
    });
  }
  return tips;
}
