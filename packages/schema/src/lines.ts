import { z } from "zod";
import {
  centsField,
  markupBpsField,
  quantityField,
  syncColumns,
  uuidField,
} from "./common.js";
import { lineKindSchema } from "./enums.js";

/**
 * The line shape estimates and invoices share (spec §4: the shared shape lives
 * in packages, not in a polymorphic table). Cost AND price are snapshotted at
 * write time: price books mutate, a sent document never does.
 */
export const documentLineFields = {
  id: uuidField,
  org_id: uuidField,
  sort_order: z.number().int().min(0),
  kind: lineKindSchema,
  description: z.string().min(1),
  quantity: quantityField,
  unit: z.string().min(1),
  unit_cost_cents: centsField,
  markup_pct: markupBpsField,
  unit_price_cents: centsField,
  is_taxable: z.boolean(),
  price_book_item_id: uuidField.nullable(),
  ...syncColumns,
};
