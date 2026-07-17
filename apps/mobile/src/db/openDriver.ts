import * as SQLite from "expo-sqlite";

import type { SqlDriver, SqlRow, SqlValue } from "./driver";

/**
 * Device driver over expo-sqlite (persistent `fasttrack.db`). The web preview
 * resolves openDriver.web.ts instead (Metro platform extensions).
 */
export async function openAppDriver(): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync("fasttrack.db");
  let inTransaction = false;

  async function exec(sql: string, params: readonly SqlValue[] = []): Promise<SqlRow[]> {
    return (await db.getAllAsync(sql, [...params])) as SqlRow[];
  }

  async function execBatch(sql: string): Promise<void> {
    await db.execAsync(sql);
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
