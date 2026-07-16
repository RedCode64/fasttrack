/**
 * Local SQLite DDL. Column names and nullability mirror `@fasttrack/schema`
 * row schemas exactly (Plan 1 rule: the schema package is the single source
 * of column names) so rows sync to Postgres in Plan 5 without renaming.
 *
 * Type mapping: uuid/timestamptz/date/json → TEXT · cents/bps/counters/bool →
 * INTEGER · quantity → REAL. Statements are idempotent (IF NOT EXISTS) as a
 * second line of defense behind the user_version gate.
 */
export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  license_no TEXT,
  trade TEXT NOT NULL,
  tax_config TEXT NOT NULL,
  target_margin_bps INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  title TEXT NOT NULL,
  address TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS price_book_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  default_markup_pct INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  number INTEGER NOT NULL,
  status TEXT NOT NULL,
  issued_at TEXT,
  expires_at TEXT,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  notes TEXT,
  terms TEXT,
  pdf_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (org_id, number)
);

CREATE TABLE IF NOT EXISTS estimate_lines (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  estimate_id TEXT NOT NULL REFERENCES estimates(id),
  sort_order INTEGER NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  markup_pct INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  is_taxable INTEGER NOT NULL,
  price_book_item_id TEXT REFERENCES price_book_items(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  converted_from_estimate_id TEXT REFERENCES estimates(id),
  number INTEGER NOT NULL,
  status TEXT NOT NULL,
  issued_at TEXT,
  due_at TEXT,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  balance_cents INTEGER NOT NULL,
  notes TEXT,
  terms TEXT,
  pdf_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (org_id, number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  sort_order INTEGER NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  markup_pct INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  is_taxable INTEGER NOT NULL,
  price_book_item_id TEXT REFERENCES price_book_items(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  job_id TEXT REFERENCES jobs(id),
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  vendor TEXT,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  is_billable INTEGER NOT NULL,
  receipt_storage_path TEXT,
  ocr_extracted TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_price_book_org ON price_book_items(org_id, kind);
CREATE INDEX IF NOT EXISTS idx_estimates_org_status ON estimates(org_id, status);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_parent ON estimate_lines(estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_at);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_parent ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(org_id, spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
`;
