/**
 * Generates the demo dataset ("Reyes Electric") as SQL.
 *
 * Every price comes from priceFromCost and every document total from
 * documentTotals — the BUILT engine, imported from dist — so the dashboard's
 * numbers reconcile with the packages the apps use. Run:
 *
 *   node apps/web/scripts/generate-demo-sql.mjs > demo.sql
 *
 * The demo login is demo@fasttrack.app / FastTrack-Demo-2026! (synthetic).
 */
import { documentTotals, priceFromCost } from "../../../packages/core/dist/index.js";

const TAX_BPS = 825;
const sql = [];
const esc = (s) => String(s).replaceAll("'", "''");
const q = (s) => (s === null || s === undefined ? "null" : `'${esc(s)}'`);

// Deterministic ids. UUIDs must be pure hex, so each entity gets a hex code.
const HEX_PREFIX = {
  de30memb: "de301111",
  de30clnt: "de302222",
  de30jobs: "de303333",
  de30esti: "de304444",
  de30elin: "de305555",
  de30invo: "de306666",
  de30paym: "de307777",
  de30expn: "de308888",
  de30budg: "de309999",
};
let idCounter = 0;
const uuid = (prefix) => {
  const hex = HEX_PREFIX[prefix];
  if (!hex) throw new Error(`No hex code for id prefix ${prefix}`);
  return `${hex}-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`;
};

const USER_ID = "de300000-0000-4000-8000-000000000001";
const ORG_ID = "de300000-0000-4000-8000-000000000002";

// ---------------------------------------------------------------- identity
sql.push(`
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '${USER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'demo@fasttrack.app', extensions.crypt('FastTrack-Demo-2026!', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
insert into public.users (id, email, name) values ('${USER_ID}', 'demo@fasttrack.app', 'Marcus Reyes');
insert into public.organizations (id, name, logo_url, address, license_no, trade, tax_config, target_margin_bps)
values ('${ORG_ID}', 'Reyes Electric', null, '412 Alder St, Portland, OR', 'C-10 884213', 'electrical',
        '{"name":"Sales Tax","rate_bps":${TAX_BPS}}', 3000);
insert into public.memberships (id, org_id, user_id, role)
values ('${uuid("de30memb")}', '${ORG_ID}', '${USER_ID}', 'owner');
select public.seed_price_book('${ORG_ID}');
select public.seed_expense_categories('${ORG_ID}');
`);

// ---------------------------------------------------------------- clients
const CLIENTS = [
  ["R. Novak", "novak@example.com", "503-555-0142", "88 Cedar Ave"],
  ["Dana Chen", "dchen@example.com", "503-555-0187", "1420 SE Pine St"],
  ["Luis Alvarez", "lalvarez@example.com", "503-555-0119", "77 Willamette Dr"],
  ["Grace Whitfield", "gwhitfield@example.com", "503-555-0230", "301 Hawthorne Blvd"],
  ["Sam Okafor", "sokafor@example.com", "503-555-0166", "952 NW Irving St"],
  ["Pat Brennan", "pbrennan@example.com", "503-555-0201", "18 Overlook Rd"],
  ["Simran Kaur", "skaur@example.com", "503-555-0244", "640 Division St"],
  ["Elena Delgado", "edelgado@example.com", "503-555-0158", "23 Fremont Way"],
].map(([name, email, phone, address]) => ({ id: uuid("de30clnt"), name, email, phone, address }));

for (const c of CLIENTS) {
  sql.push(
    `insert into public.clients (id, org_id, name, email, phone, address, notes) values ('${c.id}', '${ORG_ID}', ${q(c.name)}, ${q(c.email)}, ${q(c.phone)}, ${q(c.address)}, null);`,
  );
}

// ---------------------------------------------------------------- jobs
const JOBS = [
  ["Panel upgrade", 0, "in_progress"],
  ["EV charger install", 1, "complete"],
  ["Kitchen remodel wiring", 2, "in_progress"],
  ["Service call — flickering lights", 3, "complete"],
  ["Detached garage subpanel", 4, "quoted"],
  ["Recessed lighting, whole floor", 5, "complete"],
  ["Hot tub circuit", 6, "quoted"],
  ["Bathroom fan + GFCI retrofit", 7, "complete"],
  ["Backyard studio feed", 1, "lead"],
  ["Generator inlet + interlock", 3, "quoted"],
  ["200A service change", 2, "in_progress"],
  ["Basement code corrections", 5, "lost"],
].map(([title, clientIndex, status]) => ({
  id: uuid("de30jobs"),
  title,
  client: CLIENTS[clientIndex],
  status,
}));

for (const j of JOBS) {
  sql.push(
    `insert into public.jobs (id, org_id, client_id, title, address, scheduled_at, status, notes) values ('${j.id}', '${ORG_ID}', '${j.client.id}', ${q(j.title)}, ${q(j.client.address)}, null, '${j.status}', null);`,
  );
}

// ------------------------------------------------------- estimate factory
// Electrical catalog (mirrors seeded templates): [desc, kind, unit, costCents, markupBps, taxable]
const CAT = {
  panel: ["200A panel — Square D QO", "material", "ea", 42000, 3500, true],
  ser: ["SER 4/0 aluminum cable", "material", "ft", 1200, 4000, true],
  afci: ["AFCI breaker 20A", "material", "ea", 4900, 4500, true],
  romex: ["12/2 Romex NM-B", "material", "ft", 95, 5000, true],
  recep: ["Duplex receptacle, TR", "material", "ea", 380, 6000, true],
  led: ["LED recessed light 6in", "material", "ea", 2400, 4500, true],
  laborSvc: ["Service change labor", "labor", "hr", 6500, 5500, false],
  laborRough: ["Rough-in labor", "labor", "hr", 6000, 5500, false],
  laborTrouble: ["Troubleshooting", "labor", "hr", 7500, 5000, false],
  permit: ["County electrical permit", "other", "ea", 21000, 0, false],
};

function buildLines(spec) {
  return spec.map(([key, qty], index) => {
    const [description, kind, unit, cost, markup, taxable] = CAT[key];
    const price = priceFromCost(cost, markup);
    return {
      id: uuid("de30elin"),
      sort_order: index,
      kind,
      description,
      quantity: qty,
      unit,
      unit_cost_cents: cost,
      markup_pct: markup,
      unit_price_cents: price,
      is_taxable: taxable,
    };
  });
}

let estimateNumber = 1040;
let invoiceNumber = 2000;
const estimates = [];
const invoices = [];
const payments = [];

function addEstimate({ job, spec, status, issued, discount = 0 }) {
  const lines = buildLines(spec);
  const totals = documentTotals(
    lines.map((l) => ({
      unitPriceCents: l.unit_price_cents,
      quantity: l.quantity,
      isTaxable: l.is_taxable,
    })),
    discount,
    TAX_BPS,
  );
  const est = {
    id: uuid("de30esti"),
    job,
    number: ++estimateNumber,
    status,
    issued,
    discount,
    totals,
    lines,
  };
  estimates.push(est);
  return est;
}

function addInvoice({ estimate, status, issued, due, paymentsSpec = [] }) {
  const inv = {
    id: uuid("de30invo"),
    job: estimate.job,
    converted: estimate.id,
    number: ++invoiceNumber,
    status,
    issued,
    due,
    totals: estimate.totals,
  };
  let paid = 0;
  for (const [amount, method, paidAt] of paymentsSpec) {
    paid += amount;
    payments.push({
      id: uuid("de30paym"),
      invoice: inv,
      amount_cents: amount,
      method,
      paid_at: paidAt,
    });
  }
  inv.balance = inv.totals.totalCents - paid;
  invoices.push(inv);
  return inv;
}

// Accepted + fully paid (history: May/June)
const e1 = addEstimate({
  job: JOBS[1],
  spec: [["romex", 120], ["recep", 2], ["laborRough", 6]],
  status: "accepted",
  issued: "2026-05-06T16:00:00Z",
});
addInvoice({
  estimate: e1,
  status: "paid",
  issued: "2026-05-12T16:00:00Z",
  due: "2026-06-11T16:00:00Z",
  paymentsSpec: [[e1.totals.totalCents, "check", "2026-06-02T16:00:00Z"]],
});

const e2 = addEstimate({
  job: JOBS[3],
  spec: [["laborTrouble", 3], ["afci", 1]],
  status: "accepted",
  issued: "2026-05-20T16:00:00Z",
});
addInvoice({
  estimate: e2,
  status: "paid",
  issued: "2026-05-21T16:00:00Z",
  due: "2026-06-20T16:00:00Z",
  paymentsSpec: [[e2.totals.totalCents, "zelle", "2026-05-28T16:00:00Z"]],
});

const e3 = addEstimate({
  job: JOBS[5],
  spec: [["led", 14], ["romex", 220], ["laborRough", 12]],
  status: "accepted",
  issued: "2026-06-03T16:00:00Z",
});
addInvoice({
  estimate: e3,
  status: "paid",
  issued: "2026-06-10T16:00:00Z",
  due: "2026-07-10T16:00:00Z",
  paymentsSpec: [[e3.totals.totalCents, "bank_transfer", "2026-07-01T16:00:00Z"]],
});

const e4 = addEstimate({
  job: JOBS[7],
  spec: [["recep", 6], ["romex", 60], ["laborRough", 5]],
  status: "accepted",
  issued: "2026-06-14T16:00:00Z",
});
addInvoice({
  estimate: e4,
  status: "paid",
  issued: "2026-06-16T16:00:00Z",
  due: "2026-07-16T16:00:00Z",
  paymentsSpec: [[e4.totals.totalCents, "cash", "2026-06-30T16:00:00Z"]],
});

// The design's flagship: panel upgrade, accepted, invoiced, PARTIALLY paid.
const e5 = addEstimate({
  job: JOBS[0],
  spec: [["panel", 1], ["ser", 60], ["afci", 7], ["laborSvc", 16]],
  status: "accepted",
  issued: "2026-06-24T16:00:00Z",
});
addInvoice({
  estimate: e5,
  status: "partial",
  issued: "2026-06-30T16:00:00Z",
  due: "2026-07-30T16:00:00Z",
  paymentsSpec: [[200000, "bank_transfer", "2026-07-14T16:00:00Z"]],
});

// Accepted, invoiced, OVERDUE (drives the aging + tips screens).
const e6 = addEstimate({
  job: JOBS[10],
  spec: [["panel", 1], ["ser", 45], ["laborSvc", 14]],
  status: "accepted",
  issued: "2026-05-28T16:00:00Z",
});
addInvoice({
  estimate: e6,
  status: "overdue",
  issued: "2026-06-02T16:00:00Z",
  due: "2026-07-02T16:00:00Z",
  paymentsSpec: [[150000, "check", "2026-06-20T16:00:00Z"]],
});

const e7 = addEstimate({
  job: JOBS[2],
  spec: [["romex", 340], ["recep", 14], ["afci", 4], ["laborRough", 22]],
  status: "accepted",
  issued: "2026-06-08T16:00:00Z",
  discount: 25000,
});
addInvoice({
  estimate: e7,
  status: "overdue",
  issued: "2026-06-12T16:00:00Z",
  due: "2026-06-26T16:00:00Z",
});

// Open pipeline: sent/viewed/draft/declined estimates (no invoices).
addEstimate({
  job: JOBS[4],
  spec: [["ser", 80], ["afci", 2], ["laborSvc", 10]],
  status: "sent",
  issued: "2026-07-08T16:00:00Z",
});
addEstimate({
  job: JOBS[6],
  spec: [["romex", 90], ["laborRough", 8]],
  status: "viewed",
  issued: "2026-07-11T16:00:00Z",
});
addEstimate({
  job: JOBS[9],
  spec: [["laborSvc", 6], ["afci", 1]],
  status: "draft",
  issued: null,
});
addEstimate({
  job: JOBS[11],
  spec: [["laborTrouble", 10], ["romex", 150]],
  status: "declined",
  issued: "2026-05-15T16:00:00Z",
});

// One July invoice, sent and current (not yet due).
const e8 = addEstimate({
  job: JOBS[8],
  spec: [["ser", 35], ["laborSvc", 6]],
  status: "accepted",
  issued: "2026-07-05T16:00:00Z",
});
addInvoice({
  estimate: e8,
  status: "sent",
  issued: "2026-07-12T16:00:00Z",
  due: "2026-08-11T16:00:00Z",
});

for (const e of estimates) {
  sql.push(
    `insert into public.estimates (id, org_id, job_id, number, status, issued_at, expires_at, subtotal_cents, tax_cents, discount_cents, total_cents, notes, terms) values ('${e.id}', '${ORG_ID}', '${e.job.id}', ${e.number}, '${e.status}', ${q(e.issued)}, null, ${e.totals.subtotalCents}, ${e.totals.taxCents}, ${e.discount}, ${e.totals.totalCents}, null, 'Valid 30 days');`,
  );
  for (const l of e.lines) {
    sql.push(
      `insert into public.estimate_lines (id, org_id, estimate_id, sort_order, kind, description, quantity, unit, unit_cost_cents, markup_pct, unit_price_cents, is_taxable, price_book_item_id) values ('${l.id}', '${ORG_ID}', '${e.id}', ${l.sort_order}, '${l.kind}', ${q(l.description)}, ${l.quantity}, ${q(l.unit)}, ${l.unit_cost_cents}, ${l.markup_pct}, ${l.unit_price_cents}, ${l.is_taxable}, null);`,
    );
  }
}

for (const inv of invoices) {
  sql.push(
    `insert into public.invoices (id, org_id, job_id, converted_from_estimate_id, number, status, issued_at, due_at, subtotal_cents, tax_cents, discount_cents, total_cents, balance_cents, notes, terms) values ('${inv.id}', '${ORG_ID}', '${inv.job.id}', '${inv.converted}', ${inv.number}, '${inv.status}', ${q(inv.issued)}, ${q(inv.due)}, ${inv.totals.subtotalCents}, ${inv.totals.taxCents}, ${inv.totals.discountCents}, ${inv.totals.totalCents}, ${inv.balance}, null, 'Net 30');`,
  );
}
for (const p of payments) {
  sql.push(
    `insert into public.payments (id, org_id, invoice_id, amount_cents, method, paid_at, reference, notes) values ('${p.id}', '${ORG_ID}', '${p.invoice.id}', ${p.amount_cents}, '${p.method}', ${q(p.paid_at)}, null, null);`,
  );
}

// ---------------------------------------------------------------- expenses
// Categories are looked up by name at insert time (ids were seeded server-side).
const EXP = [
  // July (dashboard month): materials-heavy, echoing the design's vendors.
  ["Materials", "City Electric Supply", 412550, "2026-07-02", JOBS[0], true],
  ["Materials", "Graybar", 268900, "2026-07-03", JOBS[10], true],
  ["Materials", "Home Depot", 84210, "2026-07-05", JOBS[2], false],
  ["Materials", "City Electric Supply", 152075, "2026-07-08", JOBS[2], true],
  ["Materials", "Platt Electric", 96140, "2026-07-10", JOBS[0], false],
  ["Materials", "Home Depot", 31580, "2026-07-12", null, false],
  ["Materials", "Graybar", 187600, "2026-07-14", JOBS[10], true],
  ["Permits", "County Permits", 42000, "2026-07-07", JOBS[0], true],
  ["Permits", "County Permits", 21000, "2026-07-11", JOBS[10], true],
  ["Fuel", "Shell", 9860, "2026-07-03", null, false],
  ["Fuel", "Chevron", 11240, "2026-07-09", null, false],
  ["Fuel", "Shell", 10470, "2026-07-15", null, false],
  ["Tools", "Milwaukee Tool", 38950, "2026-07-06", null, false],
  ["Tools", "Home Depot", 12780, "2026-07-13", null, false],
  ["Insurance", "State Fund", 89500, "2026-07-01", null, false],
  ["Office", "Staples", 8420, "2026-07-04", null, false],
  ["Subcontractors", "Drywall Pros LLC", 260000, "2026-07-09", JOBS[2], true],
  ["Other", "Parking — downtown", 2600, "2026-07-10", null, false],
  // June history (feeds 6-month spend + profitability)
  ["Materials", "City Electric Supply", 389200, "2026-06-04", JOBS[5], true],
  ["Materials", "Graybar", 210400, "2026-06-09", JOBS[10], true],
  ["Materials", "Home Depot", 65890, "2026-06-15", JOBS[7], false],
  ["Permits", "County Permits", 21000, "2026-06-05", JOBS[5], true],
  ["Fuel", "Shell", 11830, "2026-06-06", null, false],
  ["Fuel", "Chevron", 9920, "2026-06-18", null, false],
  ["Tools", "Milwaukee Tool", 21450, "2026-06-12", null, false],
  ["Insurance", "State Fund", 89500, "2026-06-01", null, false],
  ["Office", "Staples", 6110, "2026-06-08", null, false],
  ["Subcontractors", "Trench Right", 145000, "2026-06-20", JOBS[10], false],
  // May history
  ["Materials", "City Electric Supply", 298450, "2026-05-07", JOBS[1], true],
  ["Materials", "Platt Electric", 112300, "2026-05-14", JOBS[3], false],
  ["Fuel", "Shell", 10650, "2026-05-09", null, false],
  ["Insurance", "State Fund", 89500, "2026-05-01", null, false],
  ["Tools", "Home Depot", 18760, "2026-05-16", null, false],
];

for (const [category, vendor, amount, spentAt, job, billable] of EXP) {
  sql.push(
    `insert into public.expenses (id, org_id, job_id, category_id, vendor, description, amount_cents, spent_at, is_billable, receipt_storage_path, ocr_extracted)
     select '${uuid("de30expn")}', '${ORG_ID}', ${job ? `'${job.id}'` : "null"}, id, ${q(vendor)}, null, ${amount}, '${spentAt}', ${billable}, null, null
     from public.expense_categories where org_id = '${ORG_ID}' and name = ${q(category)};`,
  );
}

// ---------------------------------------------------------------- budgets
const BUDGETS = [
  ["Materials", 900000],
  ["Fuel", 40000],
  ["Permits", 120000],
  ["Tools", 60000],
  ["Insurance", 95000],
  ["Office", 30000],
  ["Subcontractors", 500000],
  ["Other", 50000],
];
for (const [category, amount] of BUDGETS) {
  sql.push(
    `insert into public.budgets (id, org_id, category_id, month, amount_cents)
     select '${uuid("de30budg")}', '${ORG_ID}', id, '2026-07-01', ${amount}
     from public.expense_categories where org_id = '${ORG_ID}' and name = ${q(category)};`,
  );
}

process.stdout.write(sql.join("\n"));
process.stderr.write(
  `\nDemo dataset: ${CLIENTS.length} clients, ${JOBS.length} jobs, ${estimates.length} estimates, ${invoices.length} invoices, ${payments.length} payments, ${EXP.length} expenses.\nLogin: demo@fasttrack.app / FastTrack-Demo-2026!\n`,
);
