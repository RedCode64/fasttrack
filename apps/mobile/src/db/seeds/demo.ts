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
  const at = (msAgo: number) => {
    clock = Date.now() - msAgo;
  };

  at(60 * DAY_MS);
  const org = await createOrg(ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
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

  /** Estimate → accepted → invoice → sent (sentDaysAgo), optionally paid. */
  async function invoiceFlow(
    spec: DocSpec,
    sentDaysAgo: number,
    pay?: { readonly fractionBps: number; readonly hoursAgo: number },
  ): Promise<void> {
    at(sentDaysAgo * DAY_MS + 2 * HOUR_MS);
    const estimateId = await estimateWith(spec);
    await sendEstimate(ctx, estimateId);
    await markAccepted(ctx, estimateId);
    const invoice = await convertFromEstimate(ctx, estimateId);
    at(sentDaysAgo * DAY_MS);
    await sendInvoice(ctx, invoice.id);
    if (pay) {
      at(pay.hoursAgo * HOUR_MS);
      const detail = await getInvoice(ctx, invoice.id);
      const amount = Math.round((detail.invoice.total_cents * pay.fractionBps) / 10_000);
      await recordPayment(ctx, invoice.id, { amountCents: amount, method: "check" });
    }
  }

  // Invoice list from the mock: paid / sent / overdue / partial / paid / overdue.
  await invoiceFlow(
    { client: "Novak", title: "Panel upgrade — 200A service", kind: "material", costCents: 800000, markupBps: 5500 },
    2,
    { fractionBps: 10_000, hoursAgo: 26 },
  ); // $12,400 paid
  await invoiceFlow(
    { client: "Okafor Café", title: "Lighting retrofit", kind: "material", costCents: 350000, markupBps: 6000 },
    1,
  ); // $5,600 sent, due in 13d
  await invoiceFlow(
    { client: "Hartley", title: "Deck lighting", kind: "material", costCents: 115000, markupBps: 6000 },
    17,
  ); // $1,840 — due 3d ago → derived overdue
  await invoiceFlow(
    { client: "Whitfield", title: "Garage subpanel", kind: "material", costCents: 40000, markupBps: 6000 },
    12,
    { fractionBps: 5_000, hoursAgo: 120 },
  ); // $640, half paid, due in 2d → partial
  await invoiceFlow(
    { client: "Delgado", title: "Ceiling fan install", kind: "labor", costCents: 73750, markupBps: 6000 },
    8,
    { fractionBps: 10_000, hoursAgo: 2 },
  ); // $1,180 paid 2h ago
  await invoiceFlow(
    { client: "Ramos", title: "Outlet repairs", kind: "labor", costCents: 87500, markupBps: 6000 },
    49,
  ); // $1,400 — long overdue

  // Open pipeline from the mock (estimates without invoices).
  at(12 * DAY_MS);
  const salazar = await estimateWith({
    client: "Salazar", title: "Standby generator hookup", kind: "material", costCents: 110000, markupBps: 5000,
  });
  await sendEstimate(ctx, salazar);
  at(10 * DAY_MS);
  const chen = await estimateWith({
    client: "Chen", title: "Sub-panel add", kind: "labor", costCents: 25750, markupBps: 10_000,
  });
  await sendEstimate(ctx, chen);
  at(10 * DAY_MS);
  const nguyen = await estimateWith({
    client: "Nguyen", title: "Landscape lighting", kind: "material", costCents: 27000, markupBps: 10_000,
  });
  await sendEstimate(ctx, nguyen);
  at(4 * DAY_MS);
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

  const spendDate = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);
  const expense = async (
    msAgo: number,
    vendor: string,
    category: string,
    amountCents: number,
    jobId?: string,
    isBillable = false,
  ) => {
    at(msAgo);
    await createExpense(ctx, org.id, {
      categoryId: categoryId(category),
      amountCents,
      spentAt: spendDate(msAgo),
      vendor,
      jobId,
      isBillable,
    });
  };

  await expense(1 * DAY_MS, "City Electric Supply", "Materials", 41200, novakJob, true);
  await expense(3 * DAY_MS, "Shell", "Fuel", 8600);
  await expense(6 * DAY_MS, "Graybar", "Materials", 184000, hartleyJob, true);
  await expense(7 * DAY_MS, "County Permits", "Permits", 21000, novakJob, true);
  await expense(35 * DAY_MS, "Home Depot", "Tools", 24800, okaforJob);
  await expense(40 * DAY_MS, "Staples", "Office", 6400);
}
