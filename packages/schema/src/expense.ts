import { z } from "zod";
import {
  centsField,
  dateField,
  positiveCentsField,
  syncColumns,
  uuidField,
} from "./common.js";

/** Seeded defaults per org (Materials, Fuel, Permits, …); user-editable. */
export const expenseCategorySchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  name: z.string().min(1),
  sort_order: z.number().int().min(0),
  ...syncColumns,
});

/**
 * job_id answers "whose profitability does this cost reduce" (null = overhead);
 * is_billable answers "does this get passed through onto the client's invoice".
 * A permit is billable; the fuel driven to that job usually is not.
 * (Reconciliation item 4 — these are independent axes.)
 */
export const expenseSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  job_id: uuidField.nullable(),
  category_id: uuidField,
  vendor: z.string().min(1).nullable(),
  description: z.string().nullable(),
  amount_cents: positiveCentsField,
  spent_at: dateField,
  is_billable: z.boolean(),
  receipt_storage_path: z.string().min(1).nullable(),
  /**
   * Raw OCR extraction, kept verbatim when receipt scanning lands (roadmap
   * decision A: schema-ready now, feature later). Canonical values live in the
   * real columns; comparing against this shows what the user corrected.
   */
  ocr_extracted: z.record(z.string(), z.unknown()).nullable(),
  ...syncColumns,
});

/** One row per org × category × month. month is always the first of the month. */
export const budgetSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  category_id: uuidField,
  month: dateField.refine((d) => d.endsWith("-01"), {
    message: "Budget month must be the first of the month",
  }),
  amount_cents: centsField,
  ...syncColumns,
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Budget = z.infer<typeof budgetSchema>;
