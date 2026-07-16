import { z } from "zod";
import { syncColumns, timestampField, uuidField } from "./common.js";

/** Job-site photos. Always on a job; optionally pinned to a document. */
export const photoSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  estimate_id: uuidField.nullable(),
  invoice_id: uuidField.nullable(),
  storage_path: z.string().min(1),
  caption: z.string().nullable(),
  taken_at: timestampField.nullable(),
  ...syncColumns,
});

/** Signatures are evidence: immutable once captured, so no update/delete columns. */
export const signatureSchema = z
  .strictObject({
    id: uuidField,
    org_id: uuidField,
    estimate_id: uuidField.nullable(),
    invoice_id: uuidField.nullable(),
    storage_path: z.string().min(1),
    signed_by: z.string().min(1),
    signed_at: timestampField,
  })
  .refine((row) => row.estimate_id !== null || row.invoice_id !== null, {
    message: "A signature must reference an estimate or an invoice",
  });

export type Photo = z.infer<typeof photoSchema>;
export type Signature = z.infer<typeof signatureSchema>;
