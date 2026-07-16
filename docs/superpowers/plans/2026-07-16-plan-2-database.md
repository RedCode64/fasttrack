# Plan 2 — Supabase Database Implementation Plan

> **For agentic workers:** Executed inline via Supabase MCP (`apply_migration` per migration below, in order). Project: `fasttrack` (`sxmazpcygbkyclmclexw`, us-east-1, Roberto's Org, $0/mo free tier — cost confirmed 2026-07-16).

**Goal:** The one Postgres both apps share: every `@fasttrack/schema` entity as DDL, RLS tenant isolation through `memberships`, storage buckets, and trade price-book templates.

**Source of truth:** `packages/schema/src/*.ts` — same names, same enums (as CHECK constraints), same nullability. Money is `bigint` cents; rates are `integer` basis points; quantity is `double precision` (floats are quantities, never money); enums are `text + CHECK` so evolving them is an `ALTER ... DROP/ADD CONSTRAINT`, not an enum-type migration.

**Design decisions:**
- **RLS before data.** Every table gets RLS in the same plan that creates it; the security advisor gate runs before anything else touches the DB.
- **Data API posture (spec §7 risk):** exposure is explicit, not assumed. RLS-on-everything is the defense; exposure state is verified empirically on the live project after migration (see Verification).
- **The membership bootstrap hole is closed:** users may only insert a membership for *themselves*, as *owner*, into an org that has *no members yet* (the org they just created). Joining an existing org is impossible until team invites ship (R2+).
- **No `updated_at` triggers.** Offline clients own `updated_at` for last-write-wins (spec §4: no server-generated values the client displays). Defaults exist for server-side convenience only.
- **Demo data moved to Plan 3** — seeded via a TS script using `@fasttrack/core`, so seeded totals are computed by the same engine the apps use, not hand-typed SQL.

---

## Migration 1 — `core_tenancy`

```sql
create table public.organizations (
  id uuid primary key,
  name text not null,
  logo_url text,
  address text,
  license_no text,
  trade text not null check (trade in ('electrical','plumbing','hvac','general_contracting','handyman','other')),
  tax_config jsonb not null default jsonb_build_object('name','Sales Tax','rate_bps',0),
  target_margin_bps integer not null default 3000 check (target_margin_bps between 1 and 9999),
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null
);

create table public.memberships (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner','member')),
  unique (org_id, user_id)
);

-- The RLS backbone: which orgs can the calling user see?
create or replace function public.user_org_ids()
returns setof uuid
language sql security definer set search_path = ''
stable
as $$
  select org_id from public.memberships where user_id = (select auth.uid())
$$;

-- Bootstrap guard: an org with members cannot be self-joined.
create or replace function public.org_has_members(org uuid)
returns boolean
language sql security definer set search_path = ''
stable
as $$
  select exists (select 1 from public.memberships where org_id = org)
$$;
```

## Migration 2 — `domain_tables`

```sql
create table public.clients (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.jobs (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  title text not null,
  address text,
  scheduled_at timestamptz,
  status text not null default 'lead' check (status in ('lead','quoted','in_progress','complete','lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.price_book_items (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('material','labor')),
  name text not null,
  unit text not null,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  default_markup_pct integer not null check (default_markup_pct >= -10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.estimates (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id),
  number integer not null check (number >= 1),
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','declined','expired')),
  issued_at timestamptz,
  expires_at timestamptz,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  terms text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, number)
);

create table public.estimate_lines (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  kind text not null check (kind in ('material','labor','other')),
  description text not null,
  quantity double precision not null check (quantity >= 0),
  unit text not null,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  markup_pct integer not null check (markup_pct >= -10000),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  is_taxable boolean not null,
  price_book_item_id uuid references public.price_book_items (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.invoices (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id),
  converted_from_estimate_id uuid references public.estimates (id),
  number integer not null check (number >= 1),
  status text not null default 'draft' check (status in ('draft','sent','viewed','partial','paid','overdue')),
  issued_at timestamptz,
  due_at timestamptz,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  balance_cents bigint not null default 0,
  notes text,
  terms text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, number)
);

create table public.invoice_lines (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  kind text not null check (kind in ('material','labor','other')),
  description text not null,
  quantity double precision not null check (quantity >= 0),
  unit text not null,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  markup_pct integer not null check (markup_pct >= -10000),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  is_taxable boolean not null,
  price_book_item_id uuid references public.price_book_items (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.payments (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 1),
  method text not null check (method in ('check','cash','zelle','bank_transfer','card_other')),
  paid_at timestamptz not null,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.expense_categories (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.expenses (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid references public.jobs (id),
  category_id uuid not null references public.expense_categories (id),
  vendor text,
  description text,
  amount_cents bigint not null check (amount_cents >= 1),
  spent_at date not null,
  is_billable boolean not null default false,
  receipt_storage_path text,
  ocr_extracted jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budgets (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id),
  month date not null check (date_trunc('month', month)::date = month),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, category_id, month)
);

create table public.photos (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id),
  estimate_id uuid references public.estimates (id),
  invoice_id uuid references public.invoices (id),
  storage_path text not null,
  caption text,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.signatures (
  id uuid primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  estimate_id uuid references public.estimates (id),
  invoice_id uuid references public.invoices (id),
  storage_path text not null,
  signed_by text not null,
  signed_at timestamptz not null,
  check (estimate_id is not null or invoice_id is not null)
);
```

## Migration 3 — `row_level_security`

```sql
-- Tenancy tables -----------------------------------------------------------
alter table public.organizations enable row level security;
create policy "members read their orgs" on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));
create policy "any authed user may create an org" on public.organizations
  for insert to authenticated
  with check (true);
create policy "members update their orgs" on public.organizations
  for update to authenticated
  using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));

alter table public.users enable row level security;
create policy "own user row" on public.users
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table public.memberships enable row level security;
create policy "read own memberships" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "bootstrap owner membership only" on public.memberships
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and not public.org_has_members(org_id)
  );

-- Org-scoped tables: one FOR ALL policy each -------------------------------
alter table public.clients enable row level security;
create policy "org members" on public.clients for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.jobs enable row level security;
create policy "org members" on public.jobs for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.price_book_items enable row level security;
create policy "org members" on public.price_book_items for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.estimates enable row level security;
create policy "org members" on public.estimates for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.estimate_lines enable row level security;
create policy "org members" on public.estimate_lines for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.invoices enable row level security;
create policy "org members" on public.invoices for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.invoice_lines enable row level security;
create policy "org members" on public.invoice_lines for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.payments enable row level security;
create policy "org members" on public.payments for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.expense_categories enable row level security;
create policy "org members" on public.expense_categories for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.expenses enable row level security;
create policy "org members" on public.expenses for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.budgets enable row level security;
create policy "org members" on public.budgets for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.photos enable row level security;
create policy "org members" on public.photos for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.signatures enable row level security;
create policy "org members" on public.signatures for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));
```

## Migration 4 — `indexes`

```sql
create index clients_org_idx on public.clients (org_id);
create index jobs_org_idx on public.jobs (org_id, status);
create index jobs_client_idx on public.jobs (client_id);
create index price_book_items_org_idx on public.price_book_items (org_id, kind);
create index estimates_org_idx on public.estimates (org_id, status);
create index estimates_job_idx on public.estimates (job_id);
create index estimate_lines_estimate_idx on public.estimate_lines (estimate_id);
create index estimate_lines_org_idx on public.estimate_lines (org_id);
create index invoices_org_idx on public.invoices (org_id, status);
create index invoices_job_idx on public.invoices (job_id);
create index invoices_due_idx on public.invoices (org_id, due_at);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index invoice_lines_org_idx on public.invoice_lines (org_id);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_org_idx on public.payments (org_id, paid_at);
create index expense_categories_org_idx on public.expense_categories (org_id);
create index expenses_org_spent_idx on public.expenses (org_id, spent_at desc);
create index expenses_job_idx on public.expenses (job_id);
create index expenses_category_idx on public.expenses (category_id);
create index budgets_org_idx on public.budgets (org_id, month);
create index photos_org_idx on public.photos (org_id);
create index photos_job_idx on public.photos (job_id);
create index signatures_org_idx on public.signatures (org_id);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_org_idx on public.memberships (org_id);
```

## Migration 5 — `storage_buckets`

```sql
insert into storage.buckets (id, name, public)
values ('photos','photos',false), ('receipts','receipts',false),
       ('logos','logos',false), ('pdfs','pdfs',false);

-- Objects live under <org_id>/... ; membership gates every operation.
create policy "org members manage photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o))
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o));

create policy "org members manage receipts" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o))
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o));

create policy "org members manage logos" on storage.objects
  for all to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o))
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o));

create policy "org members manage pdfs" on storage.objects
  for all to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o))
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] in (select o::text from public.user_org_ids() o));
```

## Migration 6 — `price_book_templates`

Global read-only catalog; onboarding copies the caller's trade into their org via `seed_price_book`. `seed_expense_categories` creates the 8 defaults. Both run under the caller's rights — RLS's `with check` still applies.

```sql
create table public.price_book_templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null check (trade in ('electrical','plumbing','hvac','general_contracting','handyman','other')),
  kind text not null check (kind in ('material','labor')),
  name text not null,
  unit text not null,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  default_markup_pct integer not null check (default_markup_pct >= -10000)
);

alter table public.price_book_templates enable row level security;
create policy "templates are readable" on public.price_book_templates
  for select to authenticated using (true);

insert into public.price_book_templates (trade, kind, name, unit, unit_cost_cents, default_markup_pct) values
  ('electrical','material','200A panel — Square D QO','ea',42000,3500),
  ('electrical','material','SER 4/0 aluminum cable','ft',1200,4000),
  ('electrical','material','AFCI breaker 20A','ea',4900,4500),
  ('electrical','material','12/2 Romex NM-B','ft',95,5000),
  ('electrical','material','Duplex receptacle, TR','ea',380,6000),
  ('electrical','material','LED recessed light 6in','ea',2400,4500),
  ('electrical','labor','Service change labor','hr',6500,5500),
  ('electrical','labor','Rough-in labor','hr',6000,5500),
  ('electrical','labor','Troubleshooting','hr',7500,5000),
  ('plumbing','material','40gal gas water heater','ea',68000,3500),
  ('plumbing','material','3/4in copper pipe type L','ft',890,4500),
  ('plumbing','material','PEX-A 1/2in','ft',110,5000),
  ('plumbing','material','Kitchen faucet, mid-grade','ea',18500,4000),
  ('plumbing','material','Wax ring + bolts','ea',650,6000),
  ('plumbing','labor','Water heater swap labor','hr',7000,5500),
  ('plumbing','labor','Drain clearing','hr',6500,5000),
  ('plumbing','labor','Fixture install labor','hr',6000,5500),
  ('hvac','material','3-ton 16 SEER condenser','ea',210000,3000),
  ('hvac','material','Evaporator coil','ea',85000,3500),
  ('hvac','material','R-410A refrigerant','lb',1800,5000),
  ('hvac','material','Programmable thermostat','ea',9500,4500),
  ('hvac','labor','Changeout labor','hr',8500,5000),
  ('hvac','labor','Maintenance visit','hr',7000,5500),
  ('general_contracting','material','2x4x8 stud','ea',450,4000),
  ('general_contracting','material','1/2in drywall 4x8','sheet',1400,4000),
  ('general_contracting','material','Interior paint, gallon','gal',3800,4500),
  ('general_contracting','labor','Carpentry labor','hr',5500,5500),
  ('general_contracting','labor','Demo labor','hr',4500,5000),
  ('handyman','material','Misc fasteners/consumables','job',1500,6000),
  ('handyman','labor','Handyman labor','hr',5500,5500),
  ('other','labor','Labor','hr',6000,5500);

create or replace function public.seed_price_book(target_org uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.price_book_items
    (id, org_id, kind, name, unit, unit_cost_cents, default_markup_pct)
  select gen_random_uuid(), target_org, t.kind, t.name, t.unit, t.unit_cost_cents, t.default_markup_pct
  from public.price_book_templates t
  join public.organizations o on o.id = target_org
  where t.trade = o.trade;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.seed_expense_categories(target_org uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.expense_categories (id, org_id, name, sort_order)
  values
    (gen_random_uuid(), target_org, 'Materials', 0),
    (gen_random_uuid(), target_org, 'Fuel', 1),
    (gen_random_uuid(), target_org, 'Permits', 2),
    (gen_random_uuid(), target_org, 'Tools', 3),
    (gen_random_uuid(), target_org, 'Insurance', 4),
    (gen_random_uuid(), target_org, 'Office', 5),
    (gen_random_uuid(), target_org, 'Subcontractors', 6),
    (gen_random_uuid(), target_org, 'Other', 7);
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
```

## Verification (after all migrations)

1. `list_tables` — 17 tables present (16 public + templates), all with `rls_enabled: true`.
2. `get_advisors(security)` — **hard gate**: zero unresolved errors; every WARN triaged in this doc or fixed.
3. Empirical RLS probe via `execute_sql`: anon/authenticated role sees zero rows in org-scoped tables without membership.
4. Data API exposure check (spec §7): confirm whether `public` is in the exposed schemas on this new project; record the result and the consequence for Plan 3's client config.
5. `generate_typescript_types` — snapshot for Plan 3/4 reference (schema package remains the source of truth).

## What this unblocks

Plan 3 (web) gets a live authenticated database with templates; Plan 4 (mobile) pushes rows that already satisfy CHECK constraints because both share `@fasttrack/schema`. Demo data ships with Plan 3's seed script (uses `@fasttrack/core` math).

---

## Execution record — 2026-07-16

Applied to `fasttrack` (`sxmazpcygbkyclmclexw`): migrations `core_tenancy`, `domain_tables`, `row_level_security`, `indexes`, `storage_buckets`, `price_book_templates`, plus `lock_down_helper_functions` (advisor response — revoked anon/public EXECUTE on both RLS helpers).

**Security advisor triage (0 errors; 3 WARNs accepted):**
1. `organizations` INSERT `with check (true)` — deliberate SaaS bootstrap: any signed-in user may create an org; orphan orgs are unreadable (SELECT requires membership) and the membership policy prevents joining any org that already has members.
2. `user_org_ids()` authenticated-callable via RPC — required: RLS policy expressions run with the caller's privileges. Returns only the caller's own org ids; no cross-tenant data.
3. `org_has_members(uuid)` authenticated-callable via RPC — required by the membership bootstrap policy. Boolean oracle over unguessable v4 UUIDs; accepted. Revisit if org ids ever appear in URLs.

**Empirical RLS probes:** `anon` → 0 rows in `clients`; `authenticated` with no membership → 0 rows in `clients`, 31 rows in `price_book_templates` (read-only catalog, as designed).

**Deferred to Plan 3 (first client wiring):** Data API exposure state on this new project (spec §7 default change) — the web client's first authenticated query verifies it empirically; `generate_typescript_types` snapshot pulled then too if useful.
