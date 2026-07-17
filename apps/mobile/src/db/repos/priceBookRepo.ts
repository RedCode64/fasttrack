import type { PriceBookItem } from "@fasttrack/schema";

import type { DbCtx } from "../driver";
import { rowToPriceBookItem } from "../mappers";

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
