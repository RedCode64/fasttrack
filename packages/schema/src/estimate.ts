import { z } from "zod";
import { centsField, syncColumns, timestampField, uuidField } from "./common.js";
import { estimateStatusSchema } from "./enums.js";
import { documentLineFields } from "./lines.js";

export const estimateLineSchema = z.strictObject({
  ...documentLineFields,
  estimate_id: uuidField,
});

export const estimateSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  // Client-assigned per-org counter (spec §7 risk: single-device only in R1).
  number: z.number().int().min(1),
  status: estimateStatusSchema,
  issued_at: timestampField.nullable(),
  expires_at: timestampField.nullable(),
  subtotal_cents: centsField,
  tax_cents: centsField,
  discount_cents: centsField,
  total_cents: centsField,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  pdf_url: z.string().min(1).nullable(),
  ...syncColumns,
});

export type EstimateLine = z.infer<typeof estimateLineSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
