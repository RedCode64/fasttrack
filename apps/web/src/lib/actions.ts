"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const JOB_STATUSES = ["lead", "quoted", "in_progress", "complete", "lost"] as const;
type JobStatusValue = (typeof JOB_STATUSES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
    const message = /duplicate key/i.test(error.message)
      ? "A budget for that category and month already exists."
      : error.message;
    return { ok: false, error: message };
  }
  revalidatePath("/budgets");
  return { ok: true };
}
