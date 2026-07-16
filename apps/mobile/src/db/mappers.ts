import {
  clientSchema,
  estimateLineSchema,
  estimateSchema,
  expenseCategorySchema,
  expenseSchema,
  invoiceLineSchema,
  invoiceSchema,
  jobSchema,
  organizationSchema,
  paymentSchema,
  priceBookItemSchema,
  type Client,
  type Estimate,
  type EstimateLine,
  type Expense,
  type ExpenseCategory,
  type Invoice,
  type InvoiceLine,
  type Job,
  type Organization,
  type Payment,
  type PriceBookItem,
} from "@fasttrack/schema";

import type { SqlRow, SqlValue } from "./driver";

/**
 * The read boundary: every row leaving the database passes its shared row
 * schema, so screens and core math only ever see branded, validated shapes.
 * SQLite differences are normalized here — 0/1 booleans, JSON-in-TEXT.
 */

type Shape = Record<string, unknown>;

/** Project a (possibly joined) row down to a schema's own columns. */
function pickShape(shape: Shape, row: SqlRow): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {};
  for (const key of Object.keys(shape)) {
    if (Object.hasOwn(row, key)) {
      out[key] = row[key] ?? null;
    }
  }
  return out;
}

function parseJsonColumn(value: SqlValue): unknown {
  if (value === null) return null;
  return JSON.parse(String(value)) as unknown;
}

export function rowToOrganization(row: SqlRow): Organization {
  return organizationSchema.parse({
    ...pickShape(organizationSchema.shape, row),
    tax_config: parseJsonColumn(row.tax_config ?? null),
  });
}

export function rowToClient(row: SqlRow): Client {
  return clientSchema.parse(pickShape(clientSchema.shape, row));
}

export function rowToJob(row: SqlRow): Job {
  return jobSchema.parse(pickShape(jobSchema.shape, row));
}

export function rowToPriceBookItem(row: SqlRow): PriceBookItem {
  return priceBookItemSchema.parse(pickShape(priceBookItemSchema.shape, row));
}

export function rowToEstimate(row: SqlRow): Estimate {
  return estimateSchema.parse(pickShape(estimateSchema.shape, row));
}

export function rowToEstimateLine(row: SqlRow): EstimateLine {
  return estimateLineSchema.parse({
    ...pickShape(estimateLineSchema.shape, row),
    is_taxable: row.is_taxable === 1,
  });
}

export function rowToInvoice(row: SqlRow): Invoice {
  return invoiceSchema.parse(pickShape(invoiceSchema.shape, row));
}

export function rowToInvoiceLine(row: SqlRow): InvoiceLine {
  return invoiceLineSchema.parse({
    ...pickShape(invoiceLineSchema.shape, row),
    is_taxable: row.is_taxable === 1,
  });
}

export function rowToPayment(row: SqlRow): Payment {
  return paymentSchema.parse(pickShape(paymentSchema.shape, row));
}

export function rowToExpenseCategory(row: SqlRow): ExpenseCategory {
  return expenseCategorySchema.parse(pickShape(expenseCategorySchema.shape, row));
}

export function rowToExpense(row: SqlRow): Expense {
  return expenseSchema.parse({
    ...pickShape(expenseSchema.shape, row),
    is_billable: row.is_billable === 1,
    ocr_extracted: parseJsonColumn(row.ocr_extracted ?? null),
  });
}
