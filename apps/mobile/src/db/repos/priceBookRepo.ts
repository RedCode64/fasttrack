import type { LineKind, PriceBookItem } from "@fasttrack/schema";

import type { DbCtx } from "../driver";
import { rowToPriceBookItem } from "../mappers";

export interface CreatePriceBookItemInput {
  readonly kind: LineKind;
  readonly name: string;
  readonly unit: string;
  readonly unitCostCents: number;
  readonly defaultMarkupPct: number;
}

/** Picker order: materials first, then labor, names A→Z inside each. */
export async function listPriceBookItems(
  ctx: DbCtx,
  orgId: string,
): Promise<PriceBookItem[]> {
  const rows = await ctx.driver.exec(
    `SELECT * FROM price_book_items
     WHERE org_id = ? AND deleted_at IS NULL
     ORDER BY CASE kind WHEN 'material' THEN 0 ELSE 1 END, name COLLATE NOCASE`,
    [orgId],
  );
  return rows.map(rowToPriceBookItem);
}

/**
 * Remember a line the user just priced so it can be reused later.
 *
 * Keyed on the item name (case-insensitive) rather than inserting blindly:
 * saving "Sub-panel install" a second time at a new cost should move the price
 * forward, not leave two near-identical rows in the picker.
 */
export async function createPriceBookItem(
  ctx: DbCtx,
  orgId: string,
  input: CreatePriceBookItemInput,
): Promise<PriceBookItem> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("A price book item needs a name");

  const now = ctx.now();
  const existing = await ctx.driver.exec(
    `SELECT * FROM price_book_items
     WHERE org_id = ? AND deleted_at IS NULL AND name = ? COLLATE NOCASE
     LIMIT 1`,
    [orgId, name],
  );

  const current = existing[0];
  if (current) {
    await ctx.driver.exec(
      `UPDATE price_book_items
       SET kind = ?, unit = ?, unit_cost_cents = ?, default_markup_pct = ?, updated_at = ?
       WHERE id = ?`,
      [input.kind, input.unit, input.unitCostCents, input.defaultMarkupPct, now, String(current.id)],
    );
    const updated = await ctx.driver.exec("SELECT * FROM price_book_items WHERE id = ?", [
      String(current.id),
    ]);
    const row = updated[0];
    if (!row) throw new Error("Price book item vanished mid-update");
    return rowToPriceBookItem(row);
  }

  const id = ctx.newId();
  await ctx.driver.exec(
    `INSERT INTO price_book_items
       (id, org_id, kind, name, unit, unit_cost_cents, default_markup_pct,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, orgId, input.kind, name, input.unit, input.unitCostCents, input.defaultMarkupPct, now, now],
  );
  const inserted = await ctx.driver.exec("SELECT * FROM price_book_items WHERE id = ?", [id]);
  const row = inserted[0];
  if (!row) throw new Error("Price book item failed to save");
  return rowToPriceBookItem(row);
}
