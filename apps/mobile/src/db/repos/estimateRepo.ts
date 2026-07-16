import {
  basisPoints,
  cents,
  documentProfit,
  documentTotals,
  priceFromCost,
  type DocumentProfit,
} from "@fasttrack/core";
import type { Client, Estimate, EstimateLine, Job, LineKind } from "@fasttrack/schema";

import type { DbCtx, SqlRow } from "../driver";
import { rowToClient, rowToEstimate, rowToEstimateLine, rowToJob } from "../mappers";
import { createClient } from "./clientRepo";
import { nextDocumentNumber } from "./numbering";

export interface CreateDraftInput {
  /** Exactly one of clientId / newClientName. */
  readonly clientId?: string;
  readonly newClientName?: string;
  readonly jobTitle: string;
}

export interface LineInput {
  readonly kind: LineKind;
  readonly description: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitCostCents: number;
  readonly markupPct: number;
  readonly isTaxable: boolean;
}

export interface UpdateLinePatch {
  readonly kind?: LineKind;
  readonly description?: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly unitCostCents?: number;
  readonly markupPct?: number;
  readonly isTaxable?: boolean;
}

export interface EstimateDetail {
  readonly estimate: Estimate;
  readonly lines: EstimateLine[];
  readonly client: Client;
  readonly job: Job;
}

export interface EstimateListRow {
  readonly estimate: Estimate;
  readonly clientName: string;
  readonly jobTitle: string;
}

/**
 * Decision 7: drafting an estimate is what creates the job (status `quoted`).
 * The client is resolved (or created) in the same transaction.
 */
export async function createDraft(
  ctx: DbCtx,
  orgId: string,
  input: CreateDraftInput,
): Promise<Estimate> {
  if ((input.clientId === undefined) === (input.newClientName === undefined)) {
    throw new Error("Provide exactly one of clientId or newClientName");
  }

  return ctx.driver.transaction(async () => {
    let clientId = input.clientId;
    if (clientId === undefined) {
      const client = await createClient(ctx, orgId, {
        name: input.newClientName ?? "",
      });
      clientId = client.id;
    } else {
      const existing = await ctx.driver.exec(
        "SELECT id FROM clients WHERE id = ? AND org_id = ? AND deleted_at IS NULL",
        [clientId, orgId],
      );
      if (existing.length === 0) {
        throw new Error("Client not found");
      }
    }

    const now = ctx.now();
    const jobId = ctx.newId();
    await ctx.driver.exec(
      `INSERT INTO jobs (id, org_id, client_id, title, address, scheduled_at, status,
         notes, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 'quoted', NULL, ?, ?, NULL)`,
      [jobId, orgId, clientId, input.jobTitle, now, now],
    );

    const number = await nextDocumentNumber(ctx, "estimates", orgId);
    const estimateId = ctx.newId();
    await ctx.driver.exec(
      `INSERT INTO estimates (id, org_id, job_id, number, status, issued_at, expires_at,
         subtotal_cents, tax_cents, discount_cents, total_cents, notes, terms, pdf_url,
         created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 'draft', NULL, NULL, 0, 0, 0, 0, NULL, NULL, NULL, ?, ?, NULL)`,
      [estimateId, orgId, jobId, number, now, now],
    );

    return readEstimate(ctx, estimateId);
  });
}

async function readEstimate(ctx: DbCtx, id: string): Promise<Estimate> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM estimates WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  const first = rows[0];
  if (!first) throw new Error("Estimate not found");
  return rowToEstimate(first);
}

async function activeLines(ctx: DbCtx, estimateId: string): Promise<EstimateLine[]> {
  const rows = await ctx.driver.exec(
    `SELECT * FROM estimate_lines
     WHERE estimate_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    [estimateId],
  );
  return rows.map(rowToEstimateLine);
}

/** Org tax rate for a document, read through its own org row. */
async function orgTaxRateBps(ctx: DbCtx, estimateId: string): Promise<number> {
  const rows = await ctx.driver.exec(
    `SELECT o.tax_config AS tax_config FROM organizations o
     JOIN estimates e ON e.org_id = o.id WHERE e.id = ?`,
    [estimateId],
  );
  const raw = rows[0]?.tax_config;
  if (raw === undefined || raw === null) throw new Error("Estimate has no organization");
  const parsed = JSON.parse(String(raw)) as { rate_bps?: number };
  return parsed.rate_bps ?? 0;
}

/**
 * Snapshotting rule (spec §4): totals are recomputed from lines on every line
 * write and persisted — a sent document never recomputes.
 */
async function recomputeTotals(ctx: DbCtx, estimateId: string): Promise<void> {
  const estimate = await readEstimate(ctx, estimateId);
  const lines = await activeLines(ctx, estimateId);
  const rate = await orgTaxRateBps(ctx, estimateId);
  const totals = documentTotals(
    lines.map((l) => ({
      unitPriceCents: l.unit_price_cents,
      quantity: l.quantity,
      isTaxable: l.is_taxable,
    })),
    estimate.discount_cents,
    basisPoints(rate),
  );
  await ctx.driver.exec(
    `UPDATE estimates SET subtotal_cents = ?, tax_cents = ?, total_cents = ?, updated_at = ?
     WHERE id = ?`,
    [totals.subtotalCents, totals.taxCents, totals.totalCents, ctx.now(), estimateId],
  );
}

async function insertLine(
  ctx: DbCtx,
  estimateId: string,
  input: LineInput,
  priceBookItemId: string | null,
): Promise<void> {
  const estimate = await readEstimate(ctx, estimateId);
  const unitPrice = priceFromCost(cents(input.unitCostCents), basisPoints(input.markupPct));
  const sortRows = await ctx.driver.exec(
    "SELECT COALESCE(MAX(sort_order), -1) AS s FROM estimate_lines WHERE estimate_id = ?",
    [estimateId],
  );
  const sortOrder = Number(sortRows[0]?.s ?? -1) + 1;
  const now = ctx.now();

  await ctx.driver.exec(
    `INSERT INTO estimate_lines (id, org_id, estimate_id, sort_order, kind, description,
       quantity, unit, unit_cost_cents, markup_pct, unit_price_cents, is_taxable,
       price_book_item_id, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      ctx.newId(),
      estimate.org_id,
      estimateId,
      sortOrder,
      input.kind,
      input.description,
      input.quantity,
      input.unit,
      input.unitCostCents,
      input.markupPct,
      unitPrice,
      input.isTaxable ? 1 : 0,
      priceBookItemId,
      now,
      now,
    ],
  );
  await recomputeTotals(ctx, estimateId);
}

export async function addCustomLine(
  ctx: DbCtx,
  estimateId: string,
  input: LineInput,
): Promise<void> {
  await insertLine(ctx, estimateId, input, null);
}

/** Copies the catalog item's cost + markup onto the line (snapshot, not link). */
export async function addLineFromPriceBook(
  ctx: DbCtx,
  estimateId: string,
  priceBookItemId: string,
  quantity: number,
): Promise<void> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM price_book_items WHERE id = ? AND deleted_at IS NULL",
    [priceBookItemId],
  );
  const first = rows[0];
  if (!first) throw new Error("Price book item not found");

  const kind: LineKind = first.kind === "labor" ? "labor" : "material";
  await insertLine(
    ctx,
    estimateId,
    {
      kind,
      description: String(first.name),
      quantity,
      unit: String(first.unit),
      unitCostCents: Number(first.unit_cost_cents),
      markupPct: Number(first.default_markup_pct),
      // Materials get taxed, labor doesn't — editable per line in the sheet.
      isTaxable: kind === "material",
    },
    priceBookItemId,
  );
}

export async function updateLine(
  ctx: DbCtx,
  lineId: string,
  patch: UpdateLinePatch,
): Promise<void> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM estimate_lines WHERE id = ? AND deleted_at IS NULL",
    [lineId],
  );
  const first = rows[0];
  if (!first) throw new Error("Line not found");
  const current = rowToEstimateLine(first);

  const merged = {
    kind: patch.kind ?? current.kind,
    description: patch.description ?? current.description,
    quantity: patch.quantity ?? current.quantity,
    unit: patch.unit ?? current.unit,
    unitCostCents: patch.unitCostCents ?? current.unit_cost_cents,
    markupPct: patch.markupPct ?? current.markup_pct,
    isTaxable: patch.isTaxable ?? current.is_taxable,
  };
  const unitPrice = priceFromCost(cents(merged.unitCostCents), basisPoints(merged.markupPct));

  await ctx.driver.exec(
    `UPDATE estimate_lines SET kind = ?, description = ?, quantity = ?, unit = ?,
       unit_cost_cents = ?, markup_pct = ?, unit_price_cents = ?, is_taxable = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.kind,
      merged.description,
      merged.quantity,
      merged.unit,
      merged.unitCostCents,
      merged.markupPct,
      unitPrice,
      merged.isTaxable ? 1 : 0,
      ctx.now(),
      lineId,
    ],
  );
  await recomputeTotals(ctx, current.estimate_id);
}

export async function removeLine(ctx: DbCtx, lineId: string): Promise<void> {
  const rows = await ctx.driver.exec(
    "SELECT estimate_id FROM estimate_lines WHERE id = ? AND deleted_at IS NULL",
    [lineId],
  );
  const first = rows[0];
  if (!first) throw new Error("Line not found");

  const now = ctx.now();
  await ctx.driver.exec(
    "UPDATE estimate_lines SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now, now, lineId],
  );
  await recomputeTotals(ctx, String(first.estimate_id));
}

export async function getEstimate(ctx: DbCtx, id: string): Promise<EstimateDetail> {
  const estimate = await readEstimate(ctx, id);
  const lines = await activeLines(ctx, id);
  const jobRows = await ctx.driver.exec("SELECT * FROM jobs WHERE id = ?", [estimate.job_id]);
  const jobRow = jobRows[0];
  if (!jobRow) throw new Error("Estimate job missing");
  const job = rowToJob(jobRow);
  const clientRows = await ctx.driver.exec("SELECT * FROM clients WHERE id = ?", [
    job.client_id,
  ]);
  const clientRow = clientRows[0];
  if (!clientRow) throw new Error("Estimate client missing");
  return { estimate, lines, client: rowToClient(clientRow), job };
}

export async function listEstimates(ctx: DbCtx, orgId: string): Promise<EstimateListRow[]> {
  const rows = await ctx.driver.exec(
    `SELECT e.*, c.name AS __client_name, j.title AS __job_title
     FROM estimates e
     JOIN jobs j ON j.id = e.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE e.org_id = ? AND e.deleted_at IS NULL
     ORDER BY e.created_at DESC, e.number DESC`,
    [orgId],
  );
  return rows.map((row: SqlRow) => ({
    estimate: rowToEstimate(row),
    clientName: String(row.__client_name),
    jobTitle: String(row.__job_title),
  }));
}

/** The builder hero card: cost / profit / margin for the current lines. */
export function estimateProfit(detail: EstimateDetail): DocumentProfit {
  return documentProfit(
    detail.lines.map((l) => ({
      unitCostCents: l.unit_cost_cents,
      unitPriceCents: l.unit_price_cents,
      quantity: l.quantity,
    })),
    detail.estimate.discount_cents,
  );
}

async function transition(
  ctx: DbCtx,
  id: string,
  allowedFrom: readonly string[],
  to: string,
  errorMessage: string,
  extra?: { issued_at?: string },
): Promise<void> {
  const estimate = await readEstimate(ctx, id);
  if (!allowedFrom.includes(estimate.status)) {
    throw new Error(errorMessage);
  }
  const now = ctx.now();
  await ctx.driver.exec(
    "UPDATE estimates SET status = ?, issued_at = COALESCE(?, issued_at), updated_at = ? WHERE id = ?",
    [to, extra?.issued_at ?? null, now, id],
  );
}

/** PDF sharing happens in the UI first; this stamps the send. */
export async function sendEstimate(ctx: DbCtx, id: string): Promise<void> {
  await transition(ctx, id, ["draft"], "sent", "Only draft estimates can be sent", {
    issued_at: ctx.now(),
  });
}

export async function markAccepted(ctx: DbCtx, id: string): Promise<void> {
  await transition(
    ctx,
    id,
    ["sent", "viewed"],
    "accepted",
    "Only sent estimates can be accepted",
  );
}

export async function markDeclined(ctx: DbCtx, id: string): Promise<void> {
  await transition(
    ctx,
    id,
    ["sent", "viewed"],
    "declined",
    "Only sent estimates can be declined",
  );
}
