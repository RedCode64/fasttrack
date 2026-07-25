import type { DbCtx } from "../driver";
import {
  addCustomLine,
  createDraft,
  markAccepted,
  sendEstimate,
} from "../repos/estimateRepo";
import { getInvoice, convertFromEstimate, recordPayment, sendInvoice } from "../repos/invoiceRepo";
import { createExpense, listCategories } from "../repos/expenseRepo";
import { createOrg } from "../repos/orgRepo";
import { createPriceBookItem } from "../repos/priceBookRepo";
import { PRICE_BOOK_TEMPLATES } from "./priceBookTemplates";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * __DEV__ dataset shaped after the design mock (Reyes Electric, July-2026
 * era) with every figure computed by the repos + core engine — nothing is
 * written directly. Dates are relative to the real clock so "2h ago" style
 * activity reads naturally whenever it's seeded.
 */
export async function seedDemo(base: DbCtx): Promise<void> {
  let clock = Date.now();
  const ctx: DbCtx = {
    driver: base.driver,
    newId: base.newId,
    now: () => new Date(clock).toISOString(),
  };
  const atAbs = (ms: number) => {
    clock = ms;
  };

  // The Home KPIs bucket by *calendar* month (substr(issued_at, 1, 7)), so
  // placing everything by "days ago" made the month split depend on the day the
  // demo happened to be seeded — seed it on the 3rd and this month looked empty
  // while last month held the whole business. Anchor to UTC month boundaries
  // instead, matching the SQL, so the dashboard reads the same on any date.
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  // No Math.max(1, …) here on purpose: on the 1st of the month elapsed is 0 and
  // every event collapses onto "now", which is correct. Forcing a minimum of 1
  // would push the whole cohort back into the previous month.
  const elapsedDays = Math.floor((Date.now() - Date.UTC(utcYear, utcMonth, 1)) / DAY_MS);
  /** Days back, clamped so the event cannot fall out of the current month. */
  const thisMonth = (daysAgo: number) => Date.now() - Math.min(daysAgo, elapsedDays) * DAY_MS;
  /** A fixed day of the previous calendar month (day <= 28 keeps it safe). */
  const lastMonth = (day: number) => Date.UTC(utcYear, utcMonth - 1, day, 15, 0, 0);
  /** A payment somewhere between the invoice going out and now — always ordered. */
  const payAfter = (issuedMs: number, frac: number) =>
    issuedMs + Math.round((Date.now() - issuedMs) * frac);

  atAbs(lastMonth(1) - 30 * DAY_MS);
  const org = await createOrg(ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    // A 20% net target is what a small electrical shop actually aims for once
    // overhead is paid — 30% flattered the gauge rather than informing it.
    targetMarginBps: 2000,
    taxRateBps: 0,
  });

  // Signing up for real leaves the price book empty — it fills from the lines
  // you save. The demo is a showcase of a business already in motion, so it
  // gets the trade's starter slice explicitly.
  for (const template of PRICE_BOOK_TEMPLATES) {
    if (template.trade !== "electrical") continue;
    await createPriceBookItem(ctx, org.id, {
      kind: template.kind,
      name: template.name,
      unit: template.unit,
      unitCostCents: template.unitCostCents,
      defaultMarkupPct: template.defaultMarkupPct,
    });
  }

  const categories = await listCategories(ctx, org.id);
  const categoryId = (name: string): string => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Missing demo category ${name}`);
    return found.id;
  };

  interface DocSpec {
    readonly client: string;
    readonly title: string;
    readonly kind: "labor" | "material";
    readonly costCents: number;
    readonly markupBps: number;
  }

  async function estimateWith(spec: DocSpec): Promise<string> {
    const est = await createDraft(ctx, org.id, {
      newClientName: spec.client,
      jobTitle: spec.title,
    });
    await addCustomLine(ctx, est.id, {
      kind: spec.kind,
      description: spec.title,
      quantity: 1,
      unit: "job",
      unitCostCents: spec.costCents,
      markupPct: spec.markupBps,
      isTaxable: false,
    });
    return est.id;
  }

  /** Estimate → accepted → invoice → sent at `issuedMs`, optionally paid. */
  async function invoiceFlow(
    spec: DocSpec,
    issuedMs: number,
    pay?: { readonly fractionBps: number; readonly paidMs: number },
  ): Promise<void> {
    atAbs(issuedMs - 2 * HOUR_MS);
    const estimateId = await estimateWith(spec);
    await sendEstimate(ctx, estimateId);
    await markAccepted(ctx, estimateId);
    const invoice = await convertFromEstimate(ctx, estimateId);
    atAbs(issuedMs);
    await sendInvoice(ctx, invoice.id);
    if (pay) {
      atAbs(pay.paidMs);
      const detail = await getInvoice(ctx, invoice.id);
      const amount = Math.round((detail.invoice.total_cents * pay.fractionBps) / 10_000);
      await recordPayment(ctx, invoice.id, { amountCents: amount, method: "check" });
    }
  }

  // ---------------------------------------------------------------------------
  // This month — $23,985 invoiced against $15,287.50 of line cost.
  // ---------------------------------------------------------------------------
  const novakIssued = thisMonth(2);
  await invoiceFlow(
    { client: "Novak", title: "Panel upgrade — 200A service", kind: "material", costCents: 800000, markupBps: 5500 },
    novakIssued,
    { fractionBps: 10_000, paidMs: payAfter(novakIssued, 0.55) },
  ); // $12,400 paid
  await invoiceFlow(
    { client: "Okafor Café", title: "Lighting retrofit", kind: "material", costCents: 350000, markupBps: 6000 },
    thisMonth(1),
  ); // $5,600 sent, still inside terms
  await invoiceFlow(
    { client: "Bhatt", title: "EV charger circuit — 60A", kind: "labor", costCents: 150000, markupBps: 5500 },
    thisMonth(5),
  ); // $2,325 sent
  await invoiceFlow(
    { client: "Hartley", title: "Deck lighting", kind: "material", costCents: 115000, markupBps: 6000 },
    thisMonth(17),
  ); // $1,840 — past its 14d terms → derived overdue
  const delgadoIssued = thisMonth(8);
  await invoiceFlow(
    { client: "Delgado", title: "Ceiling fan install", kind: "labor", costCents: 73750, markupBps: 6000 },
    delgadoIssued,
    { fractionBps: 10_000, paidMs: payAfter(delgadoIssued, 0.99) },
  ); // $1,180 paid moments ago → tops the activity feed
  const whitfieldIssued = thisMonth(12);
  await invoiceFlow(
    { client: "Whitfield", title: "Garage subpanel", kind: "material", costCents: 40000, markupBps: 6000 },
    whitfieldIssued,
    { fractionBps: 5_000, paidMs: payAfter(whitfieldIssued, 0.6) },
  ); // $640, half paid → partial

  // ---------------------------------------------------------------------------
  // Last month — $21,485 invoiced against $13,775 of line cost, so the header
  // deltas compare two real trading months instead of exploding off ~zero.
  // ---------------------------------------------------------------------------
  await invoiceFlow(
    { client: "Alvarez", title: "Kitchen remodel rough-in", kind: "material", costCents: 720000, markupBps: 5500 },
    lastMonth(6),
    { fractionBps: 10_000, paidMs: lastMonth(20) },
  ); // $11,160 paid
  await invoiceFlow(
    { client: "Pike", title: "Panel + meter base", kind: "material", costCents: 390000, markupBps: 5500 },
    lastMonth(12),
    { fractionBps: 10_000, paidMs: lastMonth(26) },
  ); // $6,045 paid
  await invoiceFlow(
    { client: "Sorenson", title: "Recessed lighting — 12 cans", kind: "labor", costCents: 180000, markupBps: 6000 },
    lastMonth(18),
    { fractionBps: 10_000, paidMs: lastMonth(28) },
  ); // $2,880 paid
  await invoiceFlow(
    { client: "Ramos", title: "Outlet repairs", kind: "labor", costCents: 87500, markupBps: 6000 },
    lastMonth(24),
  ); // $1,400 — still unpaid, long overdue

  // Open pipeline (estimates without invoices) — quoted but not yet won, so
  // these never touch revenue or the health margin.
  atAbs(thisMonth(12));
  const salazar = await estimateWith({
    client: "Salazar", title: "Standby generator hookup", kind: "material", costCents: 110000, markupBps: 5000,
  });
  await sendEstimate(ctx, salazar);
  atAbs(thisMonth(10));
  const chen = await estimateWith({
    client: "Chen", title: "Sub-panel add", kind: "labor", costCents: 25750, markupBps: 10_000,
  });
  await sendEstimate(ctx, chen);
  atAbs(thisMonth(9));
  const nguyen = await estimateWith({
    client: "Nguyen", title: "Landscape lighting", kind: "material", costCents: 27000, markupBps: 10_000,
  });
  await sendEstimate(ctx, nguyen);
  atAbs(thisMonth(4));
  await estimateWith({
    client: "Whitfield", title: "Smoke detector wiring", kind: "labor", costCents: 12000, markupBps: 10_000,
  }); // stays draft

  // Expenses (mock rows). jobId lookup by title keeps attribution honest.
  async function jobIdByTitle(title: string): Promise<string> {
    const rows = await ctx.driver.exec("SELECT id FROM jobs WHERE title = ? LIMIT 1", [title]);
    const first = rows[0];
    if (!first) throw new Error(`Missing demo job ${title}`);
    return String(first.id);
  }
  const novakJob = await jobIdByTitle("Panel upgrade — 200A service");
  const hartleyJob = await jobIdByTitle("Deck lighting");
  const okaforJob = await jobIdByTitle("Lighting retrofit");
  const alvarezJob = await jobIdByTitle("Kitchen remodel rough-in");
  const pikeJob = await jobIdByTitle("Panel + meter base");

  /**
   * `spentAt` follows the clock we just set rather than being computed
   * separately, so an expense's date can never drift from the row it writes.
   */
  const expense = async (
    whenMs: number,
    vendor: string,
    category: string,
    amountCents: number,
    jobId?: string,
    isBillable = false,
  ) => {
    atAbs(whenMs);
    await createExpense(ctx, org.id, {
      categoryId: categoryId(category),
      amountCents,
      spentAt: new Date(whenMs).toISOString().slice(0, 10),
      vendor,
      jobId,
      isBillable,
    });
  };

  // Billable receipts are the job costs behind the accepted work — they mirror
  // the line costs above ($15,287.50 quoted this month, $13,775 last), which is
  // why computeHealth skips them: the line margin already accounted for them.
  await expense(thisMonth(2), "City Electric Supply", "Materials", 624000, novakJob, true);
  await expense(thisMonth(4), "Sandoval Electric", "Subcontractors", 340000, novakJob, true);
  await expense(thisMonth(6), "Graybar", "Materials", 318000, okaforJob, true);
  await expense(thisMonth(11), "Rexel", "Materials", 186500, hartleyJob, true);
  await expense(thisMonth(7), "County Permits", "Permits", 60000, novakJob, true);

  // Overhead — the spend no job line ever sees. This is what the gauge nets out.
  await expense(thisMonth(3), "Shell", "Fuel", 61200);
  await expense(thisMonth(9), "State Farm", "Insurance", 84000);
  await expense(thisMonth(14), "Ford Credit", "Other", 74800);
  await expense(thisMonth(16), "Advance Auto Parts", "Other", 134200);
  await expense(thisMonth(13), "Home Depot", "Tools", 48600);
  await expense(thisMonth(18), "Verizon", "Office", 37200);

  await expense(lastMonth(5), "City Electric Supply", "Materials", 582000, alvarezJob, true);
  await expense(lastMonth(8), "Sandoval Electric", "Subcontractors", 390000, alvarezJob, true);
  await expense(lastMonth(11), "Graybar", "Materials", 364000, pikeJob, true);
  await expense(lastMonth(13), "County Permits", "Permits", 41500, pikeJob, true);

  await expense(lastMonth(4), "Shell", "Fuel", 55700);
  await expense(lastMonth(9), "State Farm", "Insurance", 84000);
  await expense(lastMonth(14), "Ford Credit", "Other", 74800);
  await expense(lastMonth(17), "Home Depot", "Tools", 69400);
  await expense(lastMonth(21), "Northwest Safety", "Other", 111400);
  await expense(lastMonth(23), "Verizon", "Office", 37200);
}
