/**
 * The thin database seam (roadmap decision D): repos speak this interface and
 * nothing else, so the storage engine can change — expo-sqlite on device,
 * sql.js on Node/web today, PowerSync later — without touching domain code.
 */

export type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;

export interface SqlDriver {
  /** Run one parameterized statement; returns result rows ([] for writes). */
  exec(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>;
  /** Run a multi-statement batch without parameters (DDL, seeds). */
  execBatch(sql: string): Promise<void>;
  /** BEGIN IMMEDIATE / COMMIT / ROLLBACK bracket. Nesting is a programming error. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /**
   * Flush the database to durable storage. Only the web (sql.js) driver
   * implements this — expo-sqlite writes through on its own, and the in-memory
   * test driver has nothing to persist. Callers should treat it as optional.
   */
  persist?(): Promise<void>;
}

/**
 * Everything a repo needs. Ids and the clock are injected so tests are
 * deterministic and the app wires real generators exactly once.
 */
export interface DbCtx {
  readonly driver: SqlDriver;
  readonly newId: () => string;
  readonly now: () => string;
}

/** ISO-8601 UTC timestamp — the format every `*_at` column stores. */
export function defaultNow(): string {
  return new Date().toISOString();
}
