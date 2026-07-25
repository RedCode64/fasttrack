import { organizationSchema, type Organization, type Trade } from "@fasttrack/schema";

import type { DbCtx } from "../driver";
import { rowToOrganization } from "../mappers";
import { DEFAULT_EXPENSE_CATEGORIES } from "../seeds/categories";

export interface CreateOrgInput {
  readonly name: string;
  readonly trade: Trade;
  readonly targetMarginBps: number;
  readonly taxRateBps: number;
  readonly taxName?: string;
}

/**
 * Onboarding in one transaction: the org row and the 8 default expense
 * categories.
 *
 * The price book deliberately starts empty. Pre-seeding a trade's template
 * slice meant a new user's first "add line item" screen was a wall of someone
 * else's parts and prices; instead the book fills from the lines they actually
 * save (see `createPriceBookItem`).
 */
export async function createOrg(ctx: DbCtx, input: CreateOrgInput): Promise<Organization> {
  const org = organizationSchema.parse({
    id: ctx.newId(),
    name: input.name,
    logo_url: null,
    address: null,
    license_no: null,
    trade: input.trade,
    tax_config: { name: input.taxName ?? "Sales tax", rate_bps: input.taxRateBps },
    target_margin_bps: input.targetMarginBps,
    created_at: ctx.now(),
  });

  await ctx.driver.transaction(async () => {
    await ctx.driver.exec(
      `INSERT INTO organizations
         (id, name, logo_url, address, license_no, trade, tax_config, target_margin_bps, created_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
      [
        org.id,
        org.name,
        org.trade,
        JSON.stringify(org.tax_config),
        org.target_margin_bps,
        org.created_at,
      ],
    );

    const now = ctx.now();
    for (const [index, name] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
      await ctx.driver.exec(
        `INSERT INTO expense_categories
           (id, org_id, name, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [ctx.newId(), org.id, name, index, now, now],
      );
    }
  });

  return org;
}

/** The single local org (solo-operator app), or null before onboarding. */
export async function getOrg(ctx: DbCtx): Promise<Organization | null> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM organizations ORDER BY created_at LIMIT 1",
  );
  const first = rows[0];
  return first ? rowToOrganization(first) : null;
}
