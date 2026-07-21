/**
 * Accountant/bookkeeper export — the pragmatic stand-in for the QuickBooks sync
 * the bigger apps charge for. Produces a plain cash ledger (money in from
 * payments, money out from expenses) as RFC-4180 CSV that imports cleanly into
 * QuickBooks, Xero, or a spreadsheet. Pure and unit-tested; the device layer
 * only writes and shares the string.
 */

export interface LedgerPayment {
  readonly paidAtIso: string;
  readonly clientName: string;
  readonly invoiceNumber: number;
  readonly amountCents: number;
  readonly method: string;
}

export interface LedgerExpense {
  readonly spentAtIso: string;
  readonly party: string;
  readonly category: string;
  readonly amountCents: number;
}

interface LedgerRow {
  readonly date: string;
  readonly type: "Payment" | "Expense";
  readonly name: string;
  readonly detail: string;
  /** Signed dollars: cash in is positive, cash out negative. */
  readonly amountCents: number;
}

const HEADERS = ["Date", "Type", "Name", "Detail", "Amount"] as const;

/** RFC-4180 quoting: wrap in quotes and double any embedded quote when needed. */
export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Cents → signed plain-decimal dollars, no thousands separators (import-safe). */
function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** ISO instant/date → "YYYY-MM-DD" (accounting software wants a bare date). */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function buildLedgerCsv(data: {
  payments: readonly LedgerPayment[];
  expenses: readonly LedgerExpense[];
}): string {
  const rows: LedgerRow[] = [];
  for (const p of data.payments) {
    rows.push({
      date: dateOnly(p.paidAtIso),
      type: "Payment",
      name: p.clientName,
      detail: `INV-${p.invoiceNumber} · ${p.method}`,
      amountCents: p.amountCents,
    });
  }
  for (const e of data.expenses) {
    rows.push({
      date: dateOnly(e.spentAtIso),
      type: "Expense",
      name: e.party,
      detail: e.category,
      amountCents: -Math.abs(e.amountCents),
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const body = rows.map((r) =>
    [r.date, r.type, r.name, r.detail, dollars(r.amountCents)].map(csvEscape).join(","),
  );
  return [HEADERS.join(","), ...body].join("\r\n");
}
