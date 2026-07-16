import { expenseSchema, type Expense, type ExpenseCategory } from "@fasttrack/schema";

import type { DbCtx, SqlRow } from "../driver";
import { rowToExpense, rowToExpenseCategory } from "../mappers";

export interface CreateExpenseInput {
  readonly categoryId: string;
  readonly amountCents: number;
  /** Calendar date, YYYY-MM-DD. */
  readonly spentAt: string;
  readonly vendor?: string;
  readonly description?: string;
  readonly jobId?: string;
  readonly isBillable: boolean;
  readonly receiptPath?: string;
}

export interface UpdateExpensePatch {
  readonly categoryId?: string;
  readonly amountCents?: number;
  readonly spentAt?: string;
  readonly vendor?: string | null;
  readonly description?: string | null;
  /** null clears the job (makes it overhead). */
  readonly jobId?: string | null;
  readonly isBillable?: boolean;
  readonly receiptPath?: string | null;
}

export interface ExpenseListRow {
  readonly expense: Expense;
  readonly categoryName: string;
  readonly jobTitle: string | null;
}

export interface MonthSummary {
  /** Calendar-month total for the month containing now(). */
  readonly monthCents: number;
  /** Trailing 7 days including today. */
  readonly weekCents: number;
}

export async function listCategories(ctx: DbCtx, orgId: string): Promise<ExpenseCategory[]> {
  const rows = await ctx.driver.exec(
    `SELECT * FROM expense_categories
     WHERE org_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    [orgId],
  );
  return rows.map(rowToExpenseCategory);
}

export async function createExpense(
  ctx: DbCtx,
  orgId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  const now = ctx.now();
  const expense = expenseSchema.parse({
    id: ctx.newId(),
    org_id: orgId,
    job_id: input.jobId ?? null,
    category_id: input.categoryId,
    vendor: input.vendor ?? null,
    description: input.description ?? null,
    amount_cents: input.amountCents,
    spent_at: input.spentAt,
    is_billable: input.isBillable,
    receipt_storage_path: input.receiptPath ?? null,
    ocr_extracted: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  await ctx.driver.exec(
    `INSERT INTO expenses (id, org_id, job_id, category_id, vendor, description,
       amount_cents, spent_at, is_billable, receipt_storage_path, ocr_extracted,
       created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    [
      expense.id,
      expense.org_id,
      expense.job_id,
      expense.category_id,
      expense.vendor,
      expense.description,
      expense.amount_cents,
      expense.spent_at,
      expense.is_billable ? 1 : 0,
      expense.receipt_storage_path,
      expense.created_at,
      expense.updated_at,
    ],
  );
  return expense;
}

export async function getExpense(ctx: DbCtx, id: string): Promise<Expense | null> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  const first = rows[0];
  return first ? rowToExpense(first) : null;
}

export async function updateExpense(
  ctx: DbCtx,
  id: string,
  patch: UpdateExpensePatch,
): Promise<void> {
  const current = await getExpense(ctx, id);
  if (!current) throw new Error("Expense not found");

  const merged = expenseSchema.parse({
    ...current,
    category_id: patch.categoryId ?? current.category_id,
    amount_cents: patch.amountCents ?? current.amount_cents,
    spent_at: patch.spentAt ?? current.spent_at,
    vendor: patch.vendor === undefined ? current.vendor : patch.vendor,
    description: patch.description === undefined ? current.description : patch.description,
    job_id: patch.jobId === undefined ? current.job_id : patch.jobId,
    is_billable: patch.isBillable ?? current.is_billable,
    receipt_storage_path:
      patch.receiptPath === undefined ? current.receipt_storage_path : patch.receiptPath,
    updated_at: ctx.now(),
  });

  await ctx.driver.exec(
    `UPDATE expenses SET category_id = ?, amount_cents = ?, spent_at = ?, vendor = ?,
       description = ?, job_id = ?, is_billable = ?, receipt_storage_path = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.category_id,
      merged.amount_cents,
      merged.spent_at,
      merged.vendor,
      merged.description,
      merged.job_id,
      merged.is_billable ? 1 : 0,
      merged.receipt_storage_path,
      merged.updated_at,
      id,
    ],
  );
}

export async function listExpenses(ctx: DbCtx, orgId: string): Promise<ExpenseListRow[]> {
  const rows = await ctx.driver.exec(
    `SELECT e.*, cat.name AS __category_name, j.title AS __job_title
     FROM expenses e
     JOIN expense_categories cat ON cat.id = e.category_id
     LEFT JOIN jobs j ON j.id = e.job_id
     WHERE e.org_id = ? AND e.deleted_at IS NULL
     ORDER BY e.spent_at DESC, e.created_at DESC`,
    [orgId],
  );
  return rows.map((row: SqlRow) => ({
    expense: rowToExpense(row),
    categoryName: String(row.__category_name),
    jobTitle: row.__job_title === null ? null : String(row.__job_title),
  }));
}

export async function monthSummary(ctx: DbCtx, orgId: string): Promise<MonthSummary> {
  const today = ctx.now().slice(0, 10);
  const month = today.slice(0, 7);
  const monthRows = await ctx.driver.exec(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
     WHERE org_id = ? AND deleted_at IS NULL AND substr(spent_at, 1, 7) = ?`,
    [orgId, month],
  );
  const weekRows = await ctx.driver.exec(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
     WHERE org_id = ? AND deleted_at IS NULL
       AND spent_at >= date(?, '-6 days') AND spent_at <= ?`,
    [orgId, today, today],
  );
  return {
    monthCents: Number(monthRows[0]?.total ?? 0),
    weekCents: Number(weekRows[0]?.total ?? 0),
  };
}
