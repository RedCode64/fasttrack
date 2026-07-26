-- Security hardening pass (2026-07-26).
--
-- Three unrelated gaps found in the launch-checklist audit, applied together
-- because they are all schema-level guards:
--   1. Unbounded `text` columns — Postgres puts no ceiling on them, so a direct
--      PostgREST call could store a megabyte in a business name.
--   2. `organizations.tax_config` accepted any JSON shape. A write of
--      `rate_bps: null` is valid to Postgres and fatal to the strict Zod schema
--      that reads it back, which 500s that org's dashboard until fixed by hand.
--   3. Any authenticated user could create unlimited organizations.
--
-- It also adds `delete_own_account()`, the erasure path GDPR/CCPA expect and
-- App Store guideline 5.1.1(v) requires of any app that creates accounts.

-- ---------------------------------------------------------------------------
-- 1. Length caps on free-text columns
-- ---------------------------------------------------------------------------
-- Limits match apps/web/src/lib/actions.ts LIMITS. Every existing row is well
-- inside them (longest value in the live data is a 32-character job title).

alter table public.organizations
  add constraint organizations_name_len check (length(name) between 1 and 120),
  add constraint organizations_address_len check (address is null or length(address) <= 240),
  add constraint organizations_license_no_len check (license_no is null or length(license_no) <= 60),
  add constraint organizations_logo_url_len check (logo_url is null or length(logo_url) <= 500);

alter table public.users
  add constraint users_name_len check (length(name) between 1 and 120),
  add constraint users_email_len check (length(email) between 3 and 254);

alter table public.clients
  add constraint clients_name_len check (length(name) between 1 and 120),
  add constraint clients_email_len check (email is null or length(email) <= 254),
  add constraint clients_phone_len check (phone is null or length(phone) <= 40),
  add constraint clients_address_len check (address is null or length(address) <= 240),
  add constraint clients_notes_len check (notes is null or length(notes) <= 2000);

alter table public.jobs
  add constraint jobs_title_len check (length(title) between 1 and 160),
  add constraint jobs_address_len check (address is null or length(address) <= 240),
  add constraint jobs_notes_len check (notes is null or length(notes) <= 2000);

alter table public.expenses
  add constraint expenses_vendor_len check (vendor is null or length(vendor) <= 120),
  add constraint expenses_description_len check (description is null or length(description) <= 500),
  add constraint expenses_receipt_path_len
    check (receipt_storage_path is null or length(receipt_storage_path) <= 500);

alter table public.expense_categories
  add constraint expense_categories_name_len check (length(name) between 1 and 120);

alter table public.price_book_items
  add constraint price_book_items_name_len check (length(name) between 1 and 160),
  add constraint price_book_items_unit_len check (length(unit) between 1 and 40);

alter table public.payments
  add constraint payments_reference_len check (reference is null or length(reference) <= 120),
  add constraint payments_notes_len check (notes is null or length(notes) <= 2000);

alter table public.estimates
  add constraint estimates_notes_len check (notes is null or length(notes) <= 4000),
  add constraint estimates_terms_len check (terms is null or length(terms) <= 4000),
  add constraint estimates_pdf_url_len check (pdf_url is null or length(pdf_url) <= 500);

alter table public.invoices
  add constraint invoices_notes_len check (notes is null or length(notes) <= 4000),
  add constraint invoices_terms_len check (terms is null or length(terms) <= 4000),
  add constraint invoices_pdf_url_len check (pdf_url is null or length(pdf_url) <= 500);

-- ---------------------------------------------------------------------------
-- 2. tax_config must be the shape the app reads back
-- ---------------------------------------------------------------------------
-- Compared as jsonb rather than cast to numeric: a cast on a non-number would
-- raise instead of failing the check, and AND short-circuiting is not
-- guaranteed inside a constraint.

alter table public.organizations
  add constraint organizations_tax_config_shape check (
    jsonb_typeof(tax_config->'name') = 'string'
    and length(tax_config->>'name') between 1 and 120
    and jsonb_typeof(tax_config->'rate_bps') = 'number'
    and tax_config->'rate_bps' >= '0'::jsonb
    and tax_config->'rate_bps' <= '3000'::jsonb
  );

-- ---------------------------------------------------------------------------
-- 3. Bound organization creation
-- ---------------------------------------------------------------------------
-- The old policy was WITH CHECK (true): one account could mint organizations
-- forever, each seeding a price book and category set. Bootstrap still works
-- because the count is of memberships that already exist, and a first-time user
-- has none. Five is far above what a tradesperson needs and far below abuse.

drop policy if exists "any authed user may create an org" on public.organizations;

create policy "authed users may create up to five orgs"
  on public.organizations for insert to authenticated
  with check (
    (select count(*) from public.memberships m where m.user_id = (select auth.uid())) < 5
  );

-- ---------------------------------------------------------------------------
-- 4. Self-service account deletion
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because it must reach auth.users, but it takes no arguments
-- and derives its target solely from auth.uid() — a caller can only ever delete
-- themselves. search_path is pinned so the body cannot be redirected by a
-- caller-controlled path.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Orgs where this user is the last member go entirely; every domain table
  -- cascades from organizations. Orgs with other members survive, minus this
  -- membership, so a co-owner does not lose the books.
  delete from public.organizations o
  where o.id in (select m.org_id from public.memberships m where m.user_id = uid)
    and not exists (
      select 1 from public.memberships m2
      where m2.org_id = o.id and m2.user_id <> uid
    );

  delete from public.memberships where user_id = uid;
  delete from public.users where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Seed helpers should never have been callable by anon
-- ---------------------------------------------------------------------------
-- Both are SECURITY INVOKER, so RLS already stopped an anonymous caller from
-- writing anything. Revoking is tidiness: no reason to expose the endpoint.

revoke all on function public.seed_price_book(uuid) from anon;
revoke all on function public.seed_expense_categories(uuid) from anon;
