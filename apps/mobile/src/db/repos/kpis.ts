import { basisPoints, roundHalfUp } from "@fasttrack/core";
import { computeHealth, type HealthResult } from "@fasttrack/rollups";

import type { DbCtx } from "../driver";
import {
  rowToEstimate,
  rowToEstimateLine,
  rowToExpense,
  rowToInvoice,
  rowToOrganization,
  rowToPayment,
} from "../mappers";

export type { HealthResult };

/** Same inputs as the web gauge, sourced from local SQLite — one implementation, two surfaces. */
export async function healthForOrg(ctx: DbCtx, orgId: string): Promise<HealthResult> {
  const orgRows = await ctx.driver.exec("SELECT * FROM organizations WHERE id = ?", [orgId]);
  const orgRow = orgRows[0];
  if (!orgRow) throw new Error("Organization not found");
  const org = rowToOrganization(orgRow);

  const [estimates, estimateLines, invoices, payments, expenses] = await Promise.all([
    ctx.driver.exec("SELECT * FROM estimates WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM estimate_lines WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM invoices WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM payments WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
    ctx.driver.exec("SELECT * FROM expenses WHERE org_id = ? AND deleted_at IS NULL", [orgId]),
  ]);

  return computeHealth(
    {
      estimates: estimates.map(rowToEstimate),
      estimateLines: estimateLines.map(rowToEstimateLine),
      invoices: invoices.map(rowToInvoice),
      payments: payments.map(rowToPayment),
      expenses: expenses.map(rowToExpense),
    },
    basisPoints(org.target_margin_bps),
    new Date(ctx.now()),
  );
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

import type { LedgerExpense, LedgerPayment } from "../../lib/csvExport";

/** Cash-ledger rows for the accountant CSV export: money in, money out. */
export async function ledgerForExport(
  ctx: DbCtx,
  orgId: string,
): Promise<{ payments: LedgerPayment[]; expenses: LedgerExpense[] }> {
  const paymentRows = await ctx.driver.exec(
    `SELECT p.paid_at AS paid_at, p.amount_cents AS amount_cents, p.method AS method,
            i.number AS invoice_number, c.name AS client_name
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE p.org_id = ? AND p.deleted_at IS NULL
     ORDER BY p.paid_at ASC`,
    [orgId],
  );
  const expenseRows = await ctx.driver.exec(
    `SELECT e.spent_at AS spent_at, e.amount_cents AS amount_cents,
            COALESCE(e.vendor, cat.name) AS party, cat.name AS category
     FROM expenses e
     JOIN expense_categories cat ON cat.id = e.category_id
     WHERE e.org_id = ? AND e.deleted_at IS NULL
     ORDER BY e.spent_at ASC`,
    [orgId],
  );
  return {
    payments: paymentRows.map((row) => ({
      paidAtIso: String(row.paid_at),
      clientName: String(row.client_name),
      invoiceNumber: Number(row.invoice_number),
      amountCents: Number(row.amount_cents),
      method: String(row.method),
    })),
    expenses: expenseRows.map((row) => ({
      spentAtIso: String(row.spent_at),
      party: String(row.party),
      category: String(row.category),
      amountCents: Number(row.amount_cents),
    })),
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
