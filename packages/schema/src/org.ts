import { z } from "zod";
import { rateBpsField, timestampField, uuidField } from "./common.js";
import { membershipRoleSchema, tradeSchema } from "./enums.js";

/** Org-level tax config: one default rate applied to taxable lines. */
export const taxConfigSchema = z.strictObject({
  name: z.string().min(1),
  rate_bps: rateBpsField,
});

export const organizationSchema = z.strictObject({
  id: uuidField,
  name: z.string().min(1),
  logo_url: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  license_no: z.string().min(1).nullable(),
  trade: tradeSchema,
  tax_config: taxConfigSchema,
  // Margin target the health score measures against. 1–9999 bps: zero would
  // give healthScore nothing to divide by, and a 100% margin is not a target.
  target_margin_bps: z.number().int().min(1).max(9_999),
  created_at: timestampField,
});

/** Mirrors auth.users — id equals the Supabase auth uid. */
export const userSchema = z.strictObject({
  id: uuidField,
  email: z.email(),
  name: z.string().min(1),
});

/**
 * The tenancy model (spec §5 note): RLS resolves org_id through memberships,
 * so this ships in R1 even though team management UI does not.
 */
export const membershipSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  user_id: uuidField,
  role: membershipRoleSchema,
});

export type TaxConfig = z.infer<typeof taxConfigSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
