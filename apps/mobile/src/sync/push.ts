import type { Organization } from "@fasttrack/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DbCtx } from "../db/driver";
import { toPgRow, type PgRow } from "./transform";

/** FK-safe order: parents before children. organizations is pushed in the bootstrap. */
export const PUSH_TABLES = [
  "organizations",
  "clients",
  "jobs",
  "price_book_items",
  "estimates",
  "estimate_lines",
  "invoices",
  "invoice_lines",
  "payments",
  "expense_categories",
  "expenses",
] as const;

export type PushTable = (typeof PUSH_TABLES)[number];

export interface PushBatch {
  readonly table: PushTable;
  readonly rows: readonly PgRow[];
}

export interface UpsertOptions {
  readonly onConflict: string;
  readonly ignoreDuplicates?: boolean;
}

/** The last inch of network — implemented by supabaseTarget, faked in tests. */
export interface SyncTarget {
  upsert(table: string, rows: readonly PgRow[], opts: UpsertOptions): Promise<void>;
}

export interface LinkedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface PushSummaryEntry {
  readonly table: string;
  readonly count: number;
}

/** Read every row (soft-deleted included — deletes must propagate) for one org. */
export async function collectPush(ctx: DbCtx, orgId: string): Promise<PushBatch[]> {
  const batches: PushBatch[] = [];
  for (const table of PUSH_TABLES) {
    const rows =
      table === "organizations"
        ? await ctx.driver.exec("SELECT * FROM organizations WHERE id = ?", [orgId])
        : await ctx.driver.exec(`SELECT * FROM ${table} WHERE org_id = ?`, [orgId]);
    batches.push({ table, rows: rows.map((row) => toPgRow(table, row)) });
  }
  return batches;
}

/**
 * Full idempotent push. Bootstrap mirrors web onboarding (users → org →
 * owner membership; the RLS bootstrap policy admits the first member) and
 * then upserts every data table on id. Never calls seed_price_book /
 * seed_expense_categories — the local rows ARE the seed.
 */
export async function pushAll(
  target: SyncTarget,
  ctx: DbCtx,
  org: Organization,
  user: LinkedUser,
): Promise<PushSummaryEntry[]> {
  const batches = await collectPush(ctx, org.id);
  const orgBatch = batches.find((b) => b.table === "organizations");
  if (!orgBatch || orgBatch.rows.length === 0) {
    throw new Error("Nothing to push: no organization row");
  }

  await target.upsert("users", [{ id: user.id, email: user.email, name: user.name }], {
    onConflict: "id",
  });
  await target.upsert("organizations", orgBatch.rows, { onConflict: "id" });
  await target.upsert(
    "memberships",
    [{ id: ctx.newId(), org_id: org.id, user_id: user.id, role: "owner" }],
    { onConflict: "org_id,user_id", ignoreDuplicates: true },
  );

  const summary: PushSummaryEntry[] = [{ table: "organizations", count: orgBatch.rows.length }];
  for (const batch of batches) {
    if (batch.table === "organizations" || batch.rows.length === 0) continue;
    await target.upsert(batch.table, batch.rows, { onConflict: "id" });
    summary.push({ table: batch.table, count: batch.rows.length });
  }
  return summary;
}

/** Production SyncTarget: PostgREST upserts under the signed-in user's RLS. */
export function supabaseTarget(client: SupabaseClient): SyncTarget {
  return {
    async upsert(table, rows, opts) {
      const { error } = await client.from(table).upsert(rows as Record<string, unknown>[], {
        onConflict: opts.onConflict,
        ignoreDuplicates: opts.ignoreDuplicates ?? false,
      });
      if (error) throw new Error(`Sync failed on ${table}: ${error.message}`);
    },
  };
}
