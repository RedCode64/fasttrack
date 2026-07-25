import type { DbCtx } from "./driver";

/**
 * Empties every table the app owns, returning the device to its pre-onboarding
 * state. The schema itself (and `user_version`) is left in place, so the next
 * write goes through the same migrated connection rather than reopening one.
 *
 * Table names are read from `sqlite_master` instead of being listed here so a
 * future migration cannot leave a table silently un-wiped.
 */
export async function resetAllData(ctx: DbCtx): Promise<void> {
  const rows = await ctx.driver.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const tables = rows.map((row) => String(row.name));

  // SQLite ignores `PRAGMA foreign_keys` changes issued inside a transaction,
  // so the toggle has to bracket it. Without it the deletes would have to run
  // in an order mirroring the schema's dependency graph.
  await ctx.driver.exec("PRAGMA foreign_keys = OFF");
  try {
    await ctx.driver.transaction(async () => {
      for (const table of tables) {
        // Interpolated because SQLite cannot bind an identifier; the names come
        // from our own schema catalogue, never from user input.
        await ctx.driver.exec(`DELETE FROM ${table}`);
      }
    });
  } finally {
    await ctx.driver.exec("PRAGMA foreign_keys = ON");
  }
}
