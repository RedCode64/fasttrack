import { z } from "zod";
import { centsField, markupBpsField, syncColumns, uuidField } from "./common.js";
import { priceBookKindSchema } from "./enums.js";

/**
 * Reusable catalog rows, pre-seeded by trade at onboarding. Lines snapshot
 * cost and markup at write time — editing an item never rewrites a sent
 * document (spec §4, "snapshotted, not computed").
 */
export const priceBookItemSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  kind: priceBookKindSchema,
  name: z.string().min(1),
  unit: z.string().min(1),
  unit_cost_cents: centsField,
  default_markup_pct: markupBpsField,
  ...syncColumns,
});

export type PriceBookItem = z.infer<typeof priceBookItemSchema>;
