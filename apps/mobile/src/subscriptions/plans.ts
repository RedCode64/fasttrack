/**
 * Pure paywall presentation rules — turns RevenueCat packages into the rows the
 * paywall renders. Kept free of `react-native-purchases` so it unit-tests in
 * node; `PackageLike` is the structural subset of `PurchasesPackage` we read.
 *
 * Prices themselves are never hardcoded here: they come from App Store Connect
 * via RevenueCat, so a price change is a store-side edit. The ladder we ship
 * with is documented in `docs/appstore/pricing.md`.
 */

/** Below this, a "save X%" badge is noise rather than a reason to upgrade. */
const MIN_BADGE_SAVING_PERCENT = 5;

export interface ProductLike {
  readonly title: string;
  readonly priceString: string;
  readonly pricePerMonth: number | null;
  readonly pricePerMonthString: string | null;
}

export interface PackageLike {
  readonly identifier: string;
  /** RevenueCat `PACKAGE_TYPE` — "WEEKLY" | "MONTHLY" | "ANNUAL" | … */
  readonly packageType: string;
  readonly product: ProductLike;
}

export interface PlanView {
  readonly identifier: string;
  /** "Weekly" / "Monthly" / "Annual", or the store product title if unrecognised. */
  readonly label: string;
  readonly priceString: string;
  /** "per week" / "per month" / "per year", or null for non-recurring products. */
  readonly cadence: string | null;
  /** e.g. "$8.33/mo" — omitted for the monthly plan, where it just repeats the price. */
  readonly perMonthNote: string | null;
  /** e.g. "Best value · save 61%" — only ever on the cheapest per-month plan. */
  readonly badge: string | null;
}

interface Cadence {
  readonly label: string;
  readonly cadence: string;
  readonly order: number;
  /** Whether a per-month equivalent adds information beyond `priceString`. */
  readonly showsPerMonth: boolean;
}

const CADENCES: Readonly<Record<string, Cadence>> = {
  WEEKLY: { label: "Weekly", cadence: "per week", order: 0, showsPerMonth: true },
  MONTHLY: { label: "Monthly", cadence: "per month", order: 1, showsPerMonth: false },
  ANNUAL: { label: "Annual", cadence: "per year", order: 2, showsPerMonth: true },
};

/** Unknown package types sort after the three we design for, in their given order. */
const UNKNOWN_ORDER = 99;

function savingPercent(perMonth: number, dearestPerMonth: number): number {
  return Math.round((1 - perMonth / dearestPerMonth) * 100);
}

/**
 * Orders the offering weekly → monthly → annual and badges the cheapest
 * per-month plan with how much it saves against the priciest one.
 */
export function buildPlanViews(packages: readonly PackageLike[]): readonly PlanView[] {
  const sorted = [...packages].sort(
    (a, b) =>
      (CADENCES[a.packageType]?.order ?? UNKNOWN_ORDER) -
      (CADENCES[b.packageType]?.order ?? UNKNOWN_ORDER),
  );

  const perMonths = sorted
    .map((p) => p.product.pricePerMonth)
    .filter((price): price is number => price !== null);
  const cheapest = perMonths.length > 1 ? Math.min(...perMonths) : null;
  const dearest = perMonths.length > 1 ? Math.max(...perMonths) : null;

  return sorted.map((pkg) => {
    const cadence = CADENCES[pkg.packageType];
    const { pricePerMonth, pricePerMonthString } = pkg.product;

    const saving =
      cheapest !== null && dearest !== null && pricePerMonth === cheapest
        ? savingPercent(pricePerMonth, dearest)
        : 0;

    return {
      identifier: pkg.identifier,
      label: cadence?.label ?? pkg.product.title,
      priceString: pkg.product.priceString,
      cadence: cadence?.cadence ?? null,
      perMonthNote:
        cadence?.showsPerMonth && pricePerMonthString ? `${pricePerMonthString}/mo` : null,
      badge: saving >= MIN_BADGE_SAVING_PERCENT ? `Best value · save ${saving}%` : null,
    };
  });
}

/** The plan the paywall preselects: the badged one, else the first on offer. */
export function recommendedPlanIdentifier(views: readonly PlanView[]): string | null {
  return views.find((v) => v.badge !== null)?.identifier ?? views[0]?.identifier ?? null;
}
