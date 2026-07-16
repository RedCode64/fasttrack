import type {
  Client,
  Invoice,
  InvoiceLine,
  Job,
  Payment,
  PaymentMethod,
} from "@fasttrack/schema";

import type { DbCtx, SqlRow } from "../driver";
import {
  rowToClient,
  rowToInvoice,
  rowToInvoiceLine,
  rowToJob,
  rowToPayment,
} from "../mappers";
import { nextDocumentNumber } from "./numbering";

const DUE_IN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Stored statuses that still owe money — 'overdue' is display-only, derived. */
const OPEN_STATUSES = ["sent", "viewed", "partial"] as const;

export type InvoiceFilter = "all" | "overdue" | "sent" | "paid";

/** Stored status plus the derived 'overdue'. */
export type DisplayStatus = Invoice["status"] | "overdue";

export interface InvoiceListRow {
  readonly invoice: Invoice;
  readonly clientName: string;
  readonly displayStatus: DisplayStatus;
}

export interface InvoiceDetail {
  readonly invoice: Invoice;
  readonly lines: InvoiceLine[];
  readonly payments: Payment[];
  readonly client: Client;
  readonly job: Job;
  readonly displayStatus: DisplayStatus;
}

export interface RecordPaymentInput {
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly paidAt?: string;
  readonly reference?: string;
  readonly notes?: string;
}

async function readInvoice(ctx: DbCtx, id: string): Promise<Invoice> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  const first = rows[0];
  if (!first) throw new Error("Invoice not found");
  return rowToInvoice(first);
}

function deriveDisplayStatus(invoice: Invoice, nowIso: string): DisplayStatus {
  const open = (OPEN_STATUSES as readonly string[]).includes(invoice.status);
  if (open && invoice.due_at !== null && invoice.due_at < nowIso && invoice.balance_cents > 0) {
    return "overdue";
  }
  return invoice.status;
}

/**
 * Accepted estimate → draft invoice: totals mirrored, active lines copied
 * under new ids, backlink recorded. Sending is a separate, explicit step.
 */
export async function convertFromEstimate(ctx: DbCtx, estimateId: string): Promise<Invoice> {
  return ctx.driver.transaction(async () => {
    const estRows = await ctx.driver.exec(
      "SELECT * FROM estimates WHERE id = ? AND deleted_at IS NULL",
      [estimateId],
    );
    const est = estRows[0];
    if (!est) throw new Error("Estimate not found");
    if (est.status !== "accepted") {
      throw new Error("Only accepted estimates can be converted");
    }

    const existing = await ctx.driver.exec(
      "SELECT id FROM invoices WHERE converted_from_estimate_id = ? AND deleted_at IS NULL",
      [estimateId],
    );
    if (existing.length > 0) {
      throw new Error("Estimate is already converted to an invoice");
    }

    const orgId = String(est.org_id);
    const number = await nextDocumentNumber(ctx, "invoices", orgId);
    const invoiceId = ctx.newId();
    const now = ctx.now();

    await ctx.driver.exec(
      `INSERT INTO invoices (id, org_id, job_id, converted_from_estimate_id, number, status,
         issued_at, due_at, subtotal_cents, tax_cents, discount_cents, total_cents,
         balance_cents, notes, terms, pdf_url, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 'draft', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      [
        invoiceId,
        orgId,
        est.job_id,
        estimateId,
        number,
        est.subtotal_cents,
        est.tax_cents,
        est.discount_cents,
        est.total_cents,
        est.total_cents, // opening balance
        est.notes,
        est.terms,
        now,
        now,
      ],
    );

    const lines = await ctx.driver.exec(
      `SELECT * FROM estimate_lines
       WHERE estimate_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
      [estimateId],
    );
    for (const line of lines) {
      await ctx.driver.exec(
        `INSERT INTO invoice_lines (id, org_id, invoice_id, sort_order, kind, description,
           quantity, unit, unit_cost_cents, markup_pct, unit_price_cents, is_taxable,
           price_book_item_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          ctx.newId(),
          orgId,
          invoiceId,
          line.sort_order,
          line.kind,
          line.description,
          line.quantity,
          line.unit,
          line.unit_cost_cents,
          line.markup_pct,
          line.unit_price_cents,
          line.is_taxable,
          line.price_book_item_id,
          now,
          now,
        ],
      );
    }

    return readInvoice(ctx, invoiceId);
  });
}

/** Draft → sent: stamps issue/due dates and moves the job into progress. */
export async function sendInvoice(ctx: DbCtx, id: string): Promise<void> {
  await ctx.driver.transaction(async () => {
    const invoice = await readInvoice(ctx, id);
    if (invoice.status !== "draft") {
      throw new Error("Only draft invoices can be sent");
    }
    const nowIso = ctx.now();
    const dueIso = new Date(new Date(nowIso).getTime() + DUE_IN_DAYS * DAY_MS).toISOString();
    await ctx.driver.exec(
      "UPDATE invoices SET status = 'sent', issued_at = ?, due_at = ?, updated_at = ? WHERE id = ?",
      [nowIso, dueIso, nowIso, id],
    );
    await ctx.driver.exec(
      `UPDATE jobs SET status = 'in_progress', updated_at = ?
       WHERE id = ? AND status IN ('lead', 'quoted')`,
      [nowIso, invoice.job_id],
    );
  });
}

/**
 * Records money received (R1 records only — no card processing). Balance is
 * recomputed from the full payment ledger, never incremented.
 */
export async function recordPayment(
  ctx: DbCtx,
  invoiceId: string,
  input: RecordPaymentInput,
): Promise<void> {
  await ctx.driver.transaction(async () => {
    const invoice = await readInvoice(ctx, invoiceId);
    if (invoice.status === "draft") {
      throw new Error("Draft invoices can't take payments — send it first");
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error("Payment amount must be positive");
    }

    const now = ctx.now();
    await ctx.driver.exec(
      `INSERT INTO payments (id, org_id, invoice_id, amount_cents, method, paid_at,
         reference, notes, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        ctx.newId(),
        invoice.org_id,
        invoiceId,
        input.amountCents,
        input.method,
        input.paidAt ?? now,
        input.reference ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    );

    const sums = await ctx.driver.exec(
      "SELECT COALESCE(SUM(amount_cents), 0) AS paid FROM payments WHERE invoice_id = ? AND deleted_at IS NULL",
      [invoiceId],
    );
    const paid = Number(sums[0]?.paid ?? 0);
    const balance = invoice.total_cents - paid;
    const status = balance <= 0 ? "paid" : "partial";
    await ctx.driver.exec(
      "UPDATE invoices SET balance_cents = ?, status = ?, updated_at = ? WHERE id = ?",
      [balance, status, now, invoiceId],
    );
  });
}

const LIST_BASE = `
  SELECT i.*, c.name AS __client_name,
    CASE WHEN i.status IN ('sent', 'viewed', 'partial')
              AND i.due_at IS NOT NULL AND i.due_at < ? AND i.balance_cents > 0
         THEN 'overdue' ELSE i.status END AS __display_status
  FROM invoices i
  JOIN jobs j ON j.id = i.job_id
  JOIN clients c ON c.id = j.client_id
  WHERE i.org_id = ? AND i.deleted_at IS NULL`;

const FILTER_SQL: Record<InvoiceFilter, string> = {
  all: "",
  overdue: "WHERE sub.__display_status = 'overdue'",
  sent: "WHERE sub.__display_status IN ('sent', 'viewed')",
  paid: "WHERE sub.__display_status = 'paid'",
};

export async function listInvoices(
  ctx: DbCtx,
  orgId: string,
  filter: InvoiceFilter,
): Promise<InvoiceListRow[]> {
  const rows = await ctx.driver.exec(
    `SELECT sub.* FROM (${LIST_BASE}) AS sub
     ${FILTER_SQL[filter]}
     ORDER BY sub.created_at DESC, sub.number DESC`,
    [ctx.now(), orgId],
  );
  return rows.map((row: SqlRow) => ({
    invoice: rowToInvoice(row),
    clientName: String(row.__client_name),
    displayStatus: String(row.__display_status) as DisplayStatus,
  }));
}

export async function getInvoice(ctx: DbCtx, id: string): Promise<InvoiceDetail> {
  const invoice = await readInvoice(ctx, id);
  const lineRows = await ctx.driver.exec(
    `SELECT * FROM invoice_lines
     WHERE invoice_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    [id],
  );
  const paymentRows = await ctx.driver.exec(
    `SELECT * FROM payments
     WHERE invoice_id = ? AND deleted_at IS NULL ORDER BY paid_at`,
    [id],
  );
  const jobRows = await ctx.driver.exec("SELECT * FROM jobs WHERE id = ?", [invoice.job_id]);
  const jobRow = jobRows[0];
  if (!jobRow) throw new Error("Invoice job missing");
  const job = rowToJob(jobRow);
  const clientRows = await ctx.driver.exec("SELECT * FROM clients WHERE id = ?", [
    job.client_id,
  ]);
  const clientRow = clientRows[0];
  if (!clientRow) throw new Error("Invoice client missing");

  return {
    invoice,
    lines: lineRows.map(rowToInvoiceLine),
    payments: paymentRows.map(rowToPayment),
    client: rowToClient(clientRow),
    job,
    displayStatus: deriveDisplayStatus(invoice, ctx.now()),
  };
}
