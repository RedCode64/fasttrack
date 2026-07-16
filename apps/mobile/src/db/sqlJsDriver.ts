import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import type { SqlDriver, SqlRow, SqlValue } from "./driver";

/**
 * SqlDriver over a sql.js (wasm) database. Used by vitest on Node and by the
 * Expo web preview — device builds use the expo-sqlite driver instead.
 */
export function createSqlJsDriver(db: Database): SqlDriver {
  let inTransaction = false;

  async function exec(sql: string, params: readonly SqlValue[] = []): Promise<SqlRow[]> {
    const stmt = db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params as SqlValue[]);
      }
      const rows: SqlRow[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as SqlRow);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async function execBatch(sql: string): Promise<void> {
    db.exec(sql);
  }

  async function transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (inTransaction) {
      throw new Error("Nested transactions are not supported — flatten the caller");
    }
    inTransaction = true;
    await exec("BEGIN IMMEDIATE");
    try {
      const result = await fn();
      await exec("COMMIT");
      return result;
    } catch (error: unknown) {
      await exec("ROLLBACK");
      throw error;
    } finally {
      inTransaction = false;
    }
  }

  return { exec, execBatch, transaction };
}

let sqlJsInit: Promise<SqlJsStatic> | null = null;

/** sql.js wasm module, initialized once per process. */
export function getSqlJs(): Promise<SqlJsStatic> {
  sqlJsInit ??= initSqlJs();
  return sqlJsInit;
}

/** Fresh in-memory database — one per test. */
export async function createTestDriver(): Promise<SqlDriver> {
  const SQL = await getSqlJs();
  return createSqlJsDriver(new SQL.Database());
}
