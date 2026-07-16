import type { DbCtx } from "../driver";

/** First document renders as EST-1001 / INV-1001, matching the design's era. */
const DOCUMENT_NUMBER_BASE = 1000;

/**
 * Per-org, per-table counter (spec §7: client-side numbering is an accepted
 * single-device risk). MAX includes soft-deleted rows so numbers never reuse.
 * Call inside the same transaction as the insert.
 */
export async function nextDocumentNumber(
  ctx: DbCtx,
  table: "estimates" | "invoices",
  orgId: string,
): Promise<number> {
  const rows = await ctx.driver.exec(
    `SELECT COALESCE(MAX(number), ${DOCUMENT_NUMBER_BASE}) AS n FROM ${table} WHERE org_id = ?`,
    [orgId],
  );
  return Number(rows[0]?.n ?? DOCUMENT_NUMBER_BASE) + 1;
}
