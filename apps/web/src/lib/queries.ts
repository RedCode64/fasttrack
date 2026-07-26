import { cache } from "react";
import { redirect } from "next/navigation";
import {
  budgetSchema,
  clientSchema,
  estimateLineSchema,
  estimateSchema,
  expenseCategorySchema,
  expenseSchema,
  invoiceSchema,
  jobSchema,
  organizationSchema,
  paymentSchema,
  type Budget,
  type Client,
  type Estimate,
  type EstimateLine,
  type Expense,
  type ExpenseCategory,
  type Invoice,
  type Job,
  type Organization,
  type Payment,
} from "@fasttrack/schema";
import { logServerError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

interface RowSchema<T> {
  parse(value: unknown): T;
}

/** Dashboard queries are bounded; a solo operator's books fit comfortably. */
const ROW_LIMIT = 2000;

async function selectRows<T>(
  supabase: SupabaseServer,
  table: string,
  schema: RowSchema<T>,
  orgId: string,
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .limit(ROW_LIMIT);
  if (error) {
    // Next hides thrown server-component messages behind a digest in
    // production, but log the detail deliberately rather than relying on that.
    logServerError(`load ${table}`, error);
    throw new Error("Could not load your dashboard data.");
  }
  return (data ?? []).map((row) => schema.parse(row));
}

export interface OrgContext {
  orgId: string;
  org: Organization;
  userName: string;
}

/**
 * Resolves the signed-in user's org, or routes them to auth/onboarding.
 * Memoized per request so the layout and page share one round-trip instead of two.
 */
export const getOrgContext = cache(async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .single();
  if (orgError) {
    throw new Error(`Failed to load organization: ${orgError.message}`);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    orgId: membership.org_id as string,
    org: organizationSchema.parse(orgRow),
    userName: (userRow?.name as string | undefined) ?? user.email ?? "Owner",
  };
});

export interface DashboardData {
  clients: Client[];
  jobs: Job[];
  estimates: Estimate[];
  estimateLines: EstimateLine[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  categories: ExpenseCategory[];
  budgets: Budget[];
}

/** Everything the analytic screens derive from, fetched in parallel under RLS. */
export async function loadDashboardData(orgId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const [
    clients,
    jobs,
    estimates,
    estimateLines,
    invoices,
    payments,
    expenses,
    categories,
    budgets,
  ] = await Promise.all([
    selectRows(supabase, "clients", clientSchema, orgId),
    selectRows(supabase, "jobs", jobSchema, orgId),
    selectRows(supabase, "estimates", estimateSchema, orgId),
    selectRows(supabase, "estimate_lines", estimateLineSchema, orgId),
    selectRows(supabase, "invoices", invoiceSchema, orgId),
    selectRows(supabase, "payments", paymentSchema, orgId),
    selectRows(supabase, "expenses", expenseSchema, orgId),
    selectRows(supabase, "expense_categories", expenseCategorySchema, orgId),
    selectRows(supabase, "budgets", budgetSchema, orgId),
  ]);
  return {
    clients,
    jobs,
    estimates,
    estimateLines,
    invoices,
    payments,
    expenses,
    categories,
    budgets,
  };
}

export interface NamedOption {
  id: string;
  name: string;
}

export interface CreateOptions {
  clients: NamedOption[];
  categories: NamedOption[];
}

/** Lightweight picker data for the sidebar quick-create forms. */
export async function loadCreateOptions(orgId: string): Promise<CreateOptions> {
  const supabase = await createClient();
  const [clientsRes, categoriesRes] = await Promise.all([
    supabase.from("clients").select("id,name").eq("org_id", orgId).is("deleted_at", null).order("name"),
    supabase
      .from("expense_categories")
      .select("id,name")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);
  return {
    clients: (clientsRes.data ?? []) as NamedOption[],
    categories: (categoriesRes.data ?? []) as NamedOption[],
  };
}

/** Sidebar badge: open (collectible) invoices. */
export async function countOpenInvoices(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .in("status", ["sent", "viewed", "partial", "overdue"]);
  return count ?? 0;
}
