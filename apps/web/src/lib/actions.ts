"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { DELETE_CONFIRMATION } from "@/lib/constants";
import { dbErrorMessage } from "@/lib/errors";
import { getOrgContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const JOB_STATUSES = ["lead", "quoted", "in_progress", "complete", "lost"] as const;
type JobStatusValue = (typeof JOB_STATUSES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TRADES = [
  "electrical",
  "plumbing",
  "hvac",
  "general_contracting",
  "handyman",
  "other",
] as const;
type TradeValue = (typeof TRADES)[number];

/**
 * Length caps for free-text columns. Postgres `text` has no bound of its own,
 * so without these a single request could store a megabyte in a business name.
 * The `maxLength` on the inputs is the courtesy; this is the enforcement.
 */
const LIMITS = {
  name: 120,
  title: 160,
  address: 240,
  license: 60,
  email: 254,
  phone: 40,
  vendor: 120,
  description: 500,
  notes: 2_000,
} as const;

/** Sales tax is capped at 30%, matching the onboarding and settings inputs. */
const MAX_TAX_BPS = 3_000;
/** Mirrors organizations_target_margin_bps_check. */
const MIN_MARGIN_BPS = 1;
const MAX_MARGIN_BPS = 9_999;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Returns the first over-length field as a message, or null when all fit. */
function tooLong(
  fields: ReadonlyArray<readonly [label: string, value: string, max: number]>,
): string | null {
  for (const [label, value, max] of fields) {
    if (value.length > max) return `${label} is too long (max ${max} characters).`;
  }
  return null;
}

/** Parses a percentage string into basis points inside an inclusive range. */
function parseBps(raw: string, min: number, max: number): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const bps = Math.round(value * 100);
  if (bps < min || bps > max) return null;
  return bps;
}

/** Empty string -> NULL so optional columns stay clean. */
function nullify(value: string): string | null {
  return value.length > 0 ? value : null;
}

/** "$1,200.50" -> 120050 integer cents, or null when not a positive amount. */
function parseCents(raw: string): number | null {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export async function createClientRecord(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const name = str(data, "name");
  if (!name) return { ok: false, error: "Name is required" };
  const email = str(data, "email");
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email" };

  const overflow = tooLong([
    ["Name", name, LIMITS.name],
    ["Email", email, LIMITS.email],
    ["Phone", str(data, "phone"), LIMITS.phone],
    ["Address", str(data, "address"), LIMITS.address],
    ["Notes", str(data, "notes"), LIMITS.notes],
  ]);
  if (overflow) return { ok: false, error: overflow };

  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    id: randomUUID(),
    org_id: orgId,
    name,
    email: nullify(email),
    phone: nullify(str(data, "phone")),
    address: nullify(str(data, "address")),
    notes: nullify(str(data, "notes")),
  });
  if (error) return { ok: false, error: dbErrorMessage("createClientRecord", error) };
  revalidatePath("/clients");
  return { ok: true };
}

export async function createJob(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const title = str(data, "title");
  if (!title) return { ok: false, error: "Title is required" };
  const clientId = str(data, "client_id");
  if (!clientId) return { ok: false, error: "Pick a client" };

  const statusRaw = str(data, "status") || "lead";
  const status: JobStatusValue = (JOB_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as JobStatusValue)
    : "lead";
  const scheduled = nullify(str(data, "scheduled_at"));

  const overflow = tooLong([
    ["Title", title, LIMITS.title],
    ["Address", str(data, "address"), LIMITS.address],
    ["Notes", str(data, "notes"), LIMITS.notes],
  ]);
  if (overflow) return { ok: false, error: overflow };

  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    id: randomUUID(),
    org_id: orgId,
    client_id: clientId,
    title,
    status,
    address: nullify(str(data, "address")),
    scheduled_at: scheduled ? new Date(`${scheduled}T00:00:00.000Z`).toISOString() : null,
    notes: nullify(str(data, "notes")),
  });
  if (error) return { ok: false, error: dbErrorMessage("createJob", error) };
  revalidatePath("/jobs");
  revalidatePath("/profit");
  return { ok: true };
}

export async function createExpense(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const categoryId = str(data, "category_id");
  if (!categoryId) return { ok: false, error: "Pick a category" };
  const cents = parseCents(str(data, "amount"));
  if (cents === null) return { ok: false, error: "Enter an amount greater than 0" };
  const spentAt = str(data, "spent_at");
  if (!spentAt) return { ok: false, error: "Date is required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) return { ok: false, error: "Pick a valid date" };

  const overflow = tooLong([
    ["Vendor", str(data, "vendor"), LIMITS.vendor],
    ["Description", str(data, "description"), LIMITS.description],
  ]);
  if (overflow) return { ok: false, error: overflow };

  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    id: randomUUID(),
    org_id: orgId,
    category_id: categoryId,
    amount_cents: cents,
    spent_at: spentAt,
    vendor: nullify(str(data, "vendor")),
    description: nullify(str(data, "description")),
    is_billable: data.is_billable === true,
    job_id: null,
  });
  if (error) return { ok: false, error: dbErrorMessage("createExpense", error) };
  revalidatePath("/expenses");
  revalidatePath("/spend");
  revalidatePath("/");
  return { ok: true };
}

export async function createBudget(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const categoryId = str(data, "category_id");
  if (!categoryId) return { ok: false, error: "Pick a category" };
  const month = str(data, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Pick a month" };
  const cents = parseCents(str(data, "amount"));
  if (cents === null) return { ok: false, error: "Enter an amount greater than 0" };

  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").insert({
    id: randomUUID(),
    org_id: orgId,
    category_id: categoryId,
    month: `${month}-01`,
    amount_cents: cents,
  });
  if (error) {
    // A repeat category+month is the one collision users hit, and naming it
    // saves them a support mail; everything else stays generic.
    const message =
      error.code === "23505"
        ? "A budget for that category and month already exists."
        : dbErrorMessage("createBudget", error);
    return { ok: false, error: message };
  }
  revalidatePath("/budgets");
  return { ok: true };
}

/**
 * Creates the org, the owner membership, and the seeded price book.
 *
 * Runs server-side rather than as five browser calls so the values are checked
 * somewhere the user cannot edit, and so a half-finished bootstrap reports one
 * message instead of a raw Postgres string. RLS still applies — the cookie-bound
 * client carries the user's own JWT, not an elevated key.
 */
export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const businessName = str(data, "business_name");
  if (!businessName) return { ok: false, error: "Business name is required" };
  const yourName = str(data, "your_name");
  if (!yourName) return { ok: false, error: "Your name is required" };

  const tradeRaw = str(data, "trade");
  if (!(TRADES as readonly string[]).includes(tradeRaw)) {
    return { ok: false, error: "Pick a trade" };
  }
  const trade = tradeRaw as TradeValue;

  const taxRateBps = parseBps(str(data, "tax_rate_pct"), 0, MAX_TAX_BPS);
  if (taxRateBps === null) return { ok: false, error: "Sales tax must be between 0 and 30%" };
  const targetMarginBps = parseBps(str(data, "target_margin_pct"), MIN_MARGIN_BPS, MAX_MARGIN_BPS);
  if (targetMarginBps === null) {
    return { ok: false, error: "Target margin must be between 1 and 99%" };
  }

  const overflow = tooLong([
    ["Business name", businessName, LIMITS.name],
    ["Your name", yourName, LIMITS.name],
  ]);
  if (overflow) return { ok: false, error: overflow };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Your session expired — sign in again." };

  const orgId = randomUUID();

  // Order matters: the users row (RLS: own id), then the org, then the owner
  // membership, and only then the two seeders that copy this trade's defaults.
  const steps: ReadonlyArray<readonly [string, () => Promise<{ error: unknown }>]> = [
    [
      "onboarding.user",
      async () => supabase.from("users").upsert({ id: user.id, email: user.email, name: yourName }),
    ],
    [
      "onboarding.organization",
      async () =>
        supabase.from("organizations").insert({
          id: orgId,
          name: businessName,
          logo_url: null,
          address: null,
          license_no: null,
          trade,
          tax_config: { name: "Sales Tax", rate_bps: taxRateBps },
          target_margin_bps: targetMarginBps,
        }),
    ],
    [
      "onboarding.membership",
      async () =>
        supabase.from("memberships").insert({
          id: randomUUID(),
          org_id: orgId,
          user_id: user.id,
          role: "owner",
        }),
    ],
    ["onboarding.seedPriceBook", async () => supabase.rpc("seed_price_book", { target_org: orgId })],
    [
      "onboarding.seedCategories",
      async () => supabase.rpc("seed_expense_categories", { target_org: orgId }),
    ],
  ];

  for (const [context, run] of steps) {
    const { error } = await run();
    if (error) return { ok: false, error: dbErrorMessage(context, error) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Updates the org profile and money settings.
 *
 * The old browser-side write let an unparseable percentage reach the database
 * as `rate_bps: null` inside the `tax_config` JSON — valid to Postgres, fatal to
 * the strict schema that reads it back. Parsing here means the column only ever
 * receives a number in range.
 */
export async function updateOrgSettings(input: unknown): Promise<ActionResult> {
  const data = asRecord(input);
  const name = str(data, "name");
  if (!name) return { ok: false, error: "Business name is required" };
  const taxName = str(data, "tax_name");
  if (!taxName) return { ok: false, error: "Tax name is required" };

  const address = str(data, "address");
  const licenseNo = str(data, "license_no");

  const rateBps = parseBps(str(data, "tax_rate_pct"), 0, MAX_TAX_BPS);
  if (rateBps === null) return { ok: false, error: "Sales tax must be between 0 and 30%" };
  const targetMarginBps = parseBps(str(data, "target_margin_pct"), MIN_MARGIN_BPS, MAX_MARGIN_BPS);
  if (targetMarginBps === null) {
    return { ok: false, error: "Target margin must be between 1 and 99%" };
  }

  const overflow = tooLong([
    ["Business name", name, LIMITS.name],
    ["Tax name", taxName, LIMITS.name],
    ["Address", address, LIMITS.address],
    ["License #", licenseNo, LIMITS.license],
  ]);
  if (overflow) return { ok: false, error: overflow };

  const { orgId } = await getOrgContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      address: nullify(address),
      license_no: nullify(licenseNo),
      tax_config: { name: taxName, rate_bps: rateBps },
      target_margin_bps: targetMarginBps,
    })
    .eq("id", orgId);
  if (error) return { ok: false, error: dbErrorMessage("updateOrgSettings", error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Erases the signed-in user's account and every record synced with it.
 *
 * The work happens in the `delete_own_account()` database function, which takes
 * no arguments and resolves its target from `auth.uid()` — there is no version
 * of this call that deletes somebody else. Required by App Store guideline
 * 5.1.1(v) and by the erasure right under GDPR/CCPA.
 */
export async function deleteOwnAccount(confirmation: unknown): Promise<ActionResult> {
  const typed = typeof confirmation === "string" ? confirmation.trim().toUpperCase() : "";
  if (typed !== DELETE_CONFIRMATION) {
    return { ok: false, error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: dbErrorMessage("deleteOwnAccount", error) };

  // scope:"local" — the session points at a user that no longer exists, so a
  // server-side logout is guaranteed to 403 and would leave the dead cookies
  // in the browser, which then reads as a broken half-signed-in state.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  return { ok: true };
}
