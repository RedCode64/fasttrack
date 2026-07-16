import type { SqlDriver } from "./driver";
import { SCHEMA_V1 } from "./schema";

/** Ordered migration batches; index n upgrades user_version n → n+1. */
const MIGRATIONS: readonly string[] = [SCHEMA_V1];

/**
 * Brings a connection to the current schema version. Also flips on foreign
 * keys, which SQLite scopes per-connection — call this on every open.
 */
export async function migrate(driver: SqlDriver): Promise<void> {
  await driver.exec("PRAGMA foreign_keys = ON");
  const rows = await driver.exec("PRAGMA user_version");
  const version = Number(rows[0]?.user_version ?? 0);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Unreadable user_version: ${String(rows[0]?.user_version)}`);
  }

  for (let next = version; next < MIGRATIONS.length; next += 1) {
    const batch = MIGRATIONS[next];
    if (batch === undefined) {
      throw new Error(`Migration ${next} is missing`);
    }
    await driver.transaction(async () => {
      await driver.execBatch(batch);
      // PRAGMA does not accept bound parameters; next is a loop counter.
      await driver.exec(`PRAGMA user_version = ${next + 1}`);
    });
  }
}
