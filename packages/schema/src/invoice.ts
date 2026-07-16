import { z } from "zod";
import {
  centsField,
  positiveCentsField,
  signedCentsField,
  syncColumns,
  timestampField,
  uuidField,
} from "./common.js";
import { invoiceStatusSchema, paymentMethodSchema } from "./enums.js";
import { documentLineFields } from "./lines.js";

export const invoiceLineSchema = z.strictObject({
  ...documentLineFields,
  invoice_id: uuidField,
});

export const invoiceSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField,
  /** Set when converted from an estimate; null when drafted directly. */
  converted_from_estimate_id: uuidField.nullable(),
  number: z.number().int().min(1),
  status: invoiceStatusSchema,
  issued_at: timestampField.nullable(),
  due_at: timestampField.nullable(),
  subtotal_cents: centsField,
  tax_cents: centsField,
  discount_cents: centsField,
  total_cents: centsField,
  /** total − payments. Signed: overpayment drives it negative. */
  balance_cents: signedCentsField,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  pdf_url: z.string().min(1).nullable(),
  ...syncColumns,
});

/** Recorded payments only in R1 — processing cards is R5 (spec decision 3). */
export const paymentSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  invoice_id: uuidField,
  amount_cents: positiveCentsField,
  method: paymentMethodSchema,
  paid_at: timestampField,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  ...syncColumns,
});

export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Payment = z.infer<typeof paymentSchema>;
