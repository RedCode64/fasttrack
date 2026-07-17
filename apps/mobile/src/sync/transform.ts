import type { SqlRow, SqlValue } from "../db/driver";

export type PgValue = SqlValue | boolean | Record<string, unknown>;
export type PgRow = Record<string, PgValue>;

/** SQLite stores booleans as 0/1 — these columns are `boolean` in Postgres. */
const BOOL_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  estimate_lines: ["is_taxable"],
  invoice_lines: ["is_taxable"],
  expenses: ["is_billable"],
};

/** SQLite stores JSON as TEXT — these columns are `jsonb` in Postgres. */
const JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  organizations: ["tax_config"],
  expenses: ["ocr_extracted"],
};

/** One local row → one PostgREST-ready row. Column names never change (Plan 1 rule). */
export function toPgRow(table: string, row: SqlRow): PgRow {
  const out: PgRow = { ...row };
  for (const column of BOOL_COLUMNS[table] ?? []) {
    if (column in out) out[column] = out[column] === 1;
  }
  for (const column of JSON_COLUMNS[table] ?? []) {
    const value = out[column];
    if (typeof value === "string") {
      try {
        out[column] = JSON.parse(value) as Record<string, unknown>;
      } catch {
        throw new Error(`Sync: ${table}.${column} holds malformed JSON`);
      }
    }
  }
  return out;
}
