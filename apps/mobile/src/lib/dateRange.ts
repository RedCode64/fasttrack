/**
 * Date ranges for the accountant export.
 *
 * The export used to emit the whole history every time, so a bookkeeper running
 * it monthly received overlapping files and risked double-entering the overlap.
 * Bounding it is what makes repeat exports safe.
 *
 * Bounds are plain local `YYYY-MM-DD`, inclusive at both ends. They are compared
 * against the first 10 characters of the stored timestamp, which is why they
 * carry no time or zone: `paid_at` is a full ISO instant while `spent_at` can be
 * date-only, and a bare date prefix is the one form both share.
 */

export type RangePreset = "this_month" | "last_month" | "this_year" | "all";

export interface LedgerRange {
  readonly preset: RangePreset;
  /** Inclusive lower bound, or null for unbounded. */
  readonly startDate: string | null;
  /** Inclusive upper bound, or null for unbounded. */
  readonly endDate: string | null;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Day 0 of the next month is the last day of this one — leap years included. */
const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export function rangeFor(preset: RangePreset, now: Date = new Date()): LedgerRange {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  switch (preset) {
    case "this_month":
      return {
        preset,
        startDate: ymd(year, month, 1),
        endDate: ymd(year, month, lastDayOfMonth(year, month)),
      };
    case "last_month": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { preset, startDate: ymd(y, m, 1), endDate: ymd(y, m, lastDayOfMonth(y, m)) };
    }
    case "this_year":
      return { preset, startDate: ymd(year, 1, 1), endDate: ymd(year, 12, 31) };
    case "all":
      return { preset, startDate: null, endDate: null };
  }
}

/** Human label for the range, e.g. "July 2026". */
export function rangeLabel(range: LedgerRange): string {
  if (range.preset === "all" || !range.startDate) return "All time";
  const [y, m] = range.startDate.split("-");
  if (range.preset === "this_year") return y;
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Filename fragment, so two exports of different months never collide. */
export function rangeFilenameSlug(range: LedgerRange): string {
  if (!range.startDate || !range.endDate) return "all-time";
  return `${range.startDate}-to-${range.endDate}`;
}

/** Short label for the range picker. */
export const PRESET_LABELS: Record<RangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_year: "This year",
  all: "All time",
};

export const PRESET_ORDER: readonly RangePreset[] = [
  "this_month",
  "last_month",
  "this_year",
  "all",
];
