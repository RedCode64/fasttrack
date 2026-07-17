/** Display formatting — matches the notation used throughout the mobile design. */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
const MONTHS_LONG = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
] as const;

/** "$28,400" — or "$412.00" with showCents (the expense capture style). */
export function money(centsValue: number, opts?: { readonly showCents?: boolean }): string {
  const sign = centsValue < 0 ? "-" : "";
  const abs = Math.abs(centsValue);
  if (opts?.showCents) {
    const dollars = Math.floor(abs / 100);
    const remainder = String(abs % 100).padStart(2, "0");
    return `${sign}$${dollars.toLocaleString("en-US")}.${remainder}`;
  }
  return `${sign}$${Math.round(abs / 100).toLocaleString("en-US")}`;
}

/** "$4.2k" for thousands, otherwise plain money — the KPI sub-line style. */
export function moneyK(centsValue: number): string {
  const abs = Math.abs(centsValue);
  if (abs >= 100_000) {
    const sign = centsValue < 0 ? "-" : "";
    const thousands = Math.round(abs / 10_000) / 10;
    return `${sign}$${thousands}k`;
  }
  return money(centsValue);
}

/** Basis points → whole-percent label: 3300 → "33%". */
export function pctFromBps(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/** Signed one-decimal delta: 6.2 → "▲ 6.2%", -25 → "▼ 25%", null → "—". */
export function deltaLabel(pct: number | null): string {
  if (pct === null) return "—";
  const arrow = pct >= 0 ? "▲" : "▼";
  const abs = Math.abs(pct);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${arrow} ${text}%`;
}

/** Compact age for the activity feed: "5m", "2h", "3d". */
export function relativeTime(iso: string, nowIso: string): string {
  const diffMs = new Date(nowIso).getTime() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "Jul 8" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Header kicker: "JULY 2026" */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "EST-1001" / "INV-1042" */
export function docNumber(prefix: "EST" | "INV", n: number): string {
  return `${prefix}-${n}`;
}

/** Time-of-day greeting (device-local hour). */
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
