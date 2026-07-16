import {
  basisPoints,
  cents,
  documentProfit,
  healthScore,
  roundHalfUp,
  type HealthInputs,
  type HealthScore,
} from "@fasttrack/core";

import type { DbCtx } from "../driver";
import { rowToEstimate, rowToEstimateLine, rowToOrganization } from "../mappers";

/**
 * MIRROR of `apps/web/src/lib/rollups.ts` computeHealth — decision B's inputs
 * derived the same way on both surfaces so the two gauges always agree.
 * Change that file and this one together (Plan 5 consolidates them).
 */

const HEALTH_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["sent", "viewed", "partial", "overdue"]);

function withinDays(iso: string | null, now: Date, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t <= now.getTime() && now.getTime() - t <= days * DAY_MS;
}

export interface HealthResult {
  readonly health: HealthScore;
  readonly inputs: HealthInputs;
}

export async function healthForOrg(ctx: DbCtx, orgId: string): Promise<HealthResult> {
  const now = new Date(ctx.now());

  const orgRows = await ctx.driver.exec("SELECT * FROM organizations WHERE id = ?", [orgId]);
  const orgRow = orgRows[0];
  if (!orgRow) throw new Error("Organization not found");
  const org = rowToOrganization(orgRow);

  // Margin evidence: accepted estimates in the window (R1 realized-margin proxy).
  const estimateRows = await ctx.driver.exec(
    "SELECT * FROM estimates WHERE org_id = ? AND deleted_at IS NULL AND status = 'accepted'",
    [orgId],
  );
  let profitSum = 0;
  let revenueSum = 0;
  for (const row of estimateRows) {
    const estimate = rowToEstimate(row);
    if (!withinDays(estimate.issued_at ?? estimate.created_at, now, HEALTH_WINDOW_DAYS)) {
      continue;
    }
    const lineRows = await ctx.driver.exec(
      "SELECT * FROM estimate_lines WHERE estimate_id = ? AND deleted_at IS NULL",
      [estimate.id],
    );
    const profit = documentProfit(
      lineRows.map(rowToEstimateLine).map((l) => ({
        unitCostCents: l.unit_cost_cents,
        unitPriceCents: l.unit_price_cents,
        quantity: l.quantity,
      })),
      estimate.discount_cents,
    );
    profitSum += profit.profitCents;
    revenueSum += profit.revenueCents;
  }
  const marginBps =
    revenueSum === 0
      ? basisPoints(org.target_margin_bps) // no evidence → neutral, not alarming
      : basisPoints(roundHalfUp((profitSum * 10_000) / revenueSum));

  const invoiceRows = await ctx.driver.exec(
    "SELECT status, issued_at, due_at, total_cents, balance_cents FROM invoices WHERE org_id = ? AND deleted_at IS NULL",
    [orgId],
  );
  let outstanding = 0;
  let overdue = 0;
  let invoiced = 0;
  for (const row of invoiceRows) {
    const status = String(row.status);
    const issuedAt = row.issued_at === null ? null : String(row.issued_at);
    if (status !== "draft" && withinDays(issuedAt, now, HEALTH_WINDOW_DAYS)) {
      invoiced += Number(row.total_cents);
    }
    if (OPEN_STATUSES.has(status)) {
      const balance = Math.max(0, Number(row.balance_cents));
      outstanding += balance;
      if (row.due_at !== null && new Date(String(row.due_at)).getTime() < now.getTime()) {
        overdue += balance;
      }
    }
  }

  const paymentRows = await ctx.driver.exec(
    "SELECT paid_at, amount_cents FROM payments WHERE org_id = ? AND deleted_at IS NULL",
    [orgId],
  );
  let collected = 0;
  for (const row of paymentRows) {
    if (withinDays(String(row.paid_at), now, HEALTH_WINDOW_DAYS)) {
      collected += Number(row.amount_cents);
    }
  }

  const inputs: HealthInputs = {
    marginBps,
    targetMarginBps: basisPoints(org.target_margin_bps),
    overdueCents: cents(overdue),
    outstandingCents: cents(outstanding),
    collectedCents: cents(collected),
    invoicedCents: cents(invoiced),
  };
  return { health: healthScore(inputs), inputs };
}

export interface MonthKpis {
  readonly month: string;
  readonly revenueCents: number;
  readonly prevRevenueCents: number;
  readonly revenueDeltaPct: number | null;
  readonly spendCents: number;
  readonly prevSpendCents: number;
  readonly spendDeltaPct: number | null;
  readonly netProfitCents: number;
  /** Net profit ÷ revenue, plain bps (may be negative). */
  readonly marginBps: number;
  readonly outstandingCents: number;
  readonly overdueCents: number;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const d = new Date(Date.UTC(year, mon - 2, 1));
  return d.toISOString().slice(0, 7);
}

async function sumOne(ctx: DbCtx, sql: string, params: readonly (string | number)[]): Promise<number> {
  const rows = await ctx.driver.exec(sql, params);
  return Number(rows[0]?.total ?? 0);
}

/** The Home 2×2: revenue, net profit, spend, outstanding — all SQL aggregates. */
export async function monthKpis(ctx: DbCtx, orgId: string): Promise<MonthKpis> {
  const nowIso = ctx.now();
  const month = nowIso.slice(0, 7);
  const prev = previousMonth(month);

  const revenueSql = `SELECT COALESCE(SUM(total_cents), 0) AS total FROM invoices
    WHERE org_id = ? AND deleted_at IS NULL AND status != 'draft'
      AND issued_at IS NOT NULL AND substr(issued_at, 1, 7) = ?`;
  const spendSql = `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
    WHERE org_id = ? AND deleted_at IS NULL AND substr(spent_at, 1, 7) = ?`;

  const revenueCents = await sumOne(ctx, revenueSql, [orgId, month]);
  const prevRevenueCents = await sumOne(ctx, revenueSql, [orgId, prev]);
  const spendCents = await sumOne(ctx, spendSql, [orgId, month]);
  const prevSpendCents = await sumOne(ctx, spendSql, [orgId, prev]);

  const outstandingCents = await sumOne(
    ctx,
    `SELECT COALESCE(SUM(MAX(balance_cents, 0)), 0) AS total FROM invoices
     WHERE org_id = ? AND deleted_at IS NULL AND status IN ('sent', 'viewed', 'partial')`,
    [orgId],
  );
  const overdueCents = await sumOne(
    ctx,
    `SELECT COALESCE(SUM(MAX(balance_cents, 0)), 0) AS total FROM invoices
     WHERE org_id = ? AND deleted_at IS NULL AND status IN ('sent', 'viewed', 'partial')
       AND due_at IS NOT NULL AND due_at < ? AND balance_cents > 0`,
    [orgId, nowIso],
  );

  const netProfitCents = revenueCents - spendCents;
  return {
    month,
    revenueCents,
    prevRevenueCents,
    revenueDeltaPct: deltaPct(revenueCents, prevRevenueCents),
    spendCents,
    prevSpendCents,
    spendDeltaPct: deltaPct(spendCents, prevSpendCents),
    netProfitCents,
    marginBps: revenueCents === 0 ? 0 : roundHalfUp((netProfitCents * 10_000) / revenueCents),
    outstandingCents,
    overdueCents,
  };
}

export type ActivityKind =
  | "payment_received"
  | "invoice_sent"
  | "invoice_overdue"
  | "expense_logged";

export interface ActivityItem {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly amountCents: number;
  readonly counterparty: string;
  /** Event instant (ISO) — paid_at / issued_at / due_at / created_at. */
  readonly at: string;
}

/** The Home feed: the design's four event kinds, newest first. */
export async function activity(
  ctx: DbCtx,
  orgId: string,
  limit: number,
): Promise<ActivityItem[]> {
  const rows = await ctx.driver.exec(
    `SELECT p.id AS id, 'payment_received' AS kind, p.amount_cents AS amount_cents,
            c.name AS counterparty, p.paid_at AS at
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE p.org_id = ? AND p.deleted_at IS NULL
     UNION ALL
     SELECT i.id, 'invoice_sent', i.total_cents, c.name, i.issued_at
     FROM invoices i
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE i.org_id = ? AND i.deleted_at IS NULL
       AND i.status != 'draft' AND i.issued_at IS NOT NULL
     UNION ALL
     SELECT i.id, 'invoice_overdue', i.balance_cents, c.name, i.due_at
     FROM invoices i
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE i.org_id = ? AND i.deleted_at IS NULL
       AND i.status IN ('sent', 'viewed', 'partial')
       AND i.due_at IS NOT NULL AND i.due_at < ? AND i.balance_cents > 0
     UNION ALL
     SELECT e.id, 'expense_logged', e.amount_cents,
            COALESCE(e.vendor, cat.name), e.created_at
     FROM expenses e
     JOIN expense_categories cat ON cat.id = e.category_id
     WHERE e.org_id = ? AND e.deleted_at IS NULL
     ORDER BY at DESC, kind ASC
     LIMIT ?`,
    [orgId, orgId, orgId, ctx.now(), orgId, limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind) as ActivityKind,
    amountCents: Number(row.amount_cents),
    counterparty: String(row.counterparty),
    at: String(row.at),
  }));
}
