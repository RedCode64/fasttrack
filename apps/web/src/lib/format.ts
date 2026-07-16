import type { BasisPoints, Cents } from "@fasttrack/core";

/** Whole-dollar display, like the design: 1234567 cents → "$12,346". */
export function money(centsValue: Cents | number): string {
  return "$" + Math.round(centsValue / 100).toLocaleString("en-US");
}

/** Exact display for document rows: 1234567 cents → "$12,345.67". */
export function moneyExact(centsValue: Cents | number): string {
  return (centsValue / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** 3207 bps → "32.1%" */
export function pct(bps: BasisPoints | number, digits = 1): string {
  return (bps / 100).toFixed(digits) + "%";
}

/** ISO timestamp/date → "Jul 14" */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ISO timestamp/date → "Jul 14, 2026" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Date → "2026-07" (grouping key for months). */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** "2026-07" → "July 2026" */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
