import { roundHalfUp, type BasisPoints, type Cents } from "./money.js";

export interface HealthInputs {
  /** Realized margin over the reporting window (profit ÷ revenue, in bps). */
  readonly marginBps: BasisPoints;
  /** The org's target margin (default 3000 = 30.00%). Must be positive. */
  readonly targetMarginBps: BasisPoints;
  /** The overdue portion of outstanding receivables. Subset of outstanding. */
  readonly overdueCents: Cents;
  /** Total outstanding receivables (unpaid invoice balances). */
  readonly outstandingCents: Cents;
  /** Cash collected during the window. */
  readonly collectedCents: Cents;
  /** Total invoiced during the window. */
  readonly invoicedCents: Cents;
}

export type HealthBand = "good" | "watch" | "risk";

export interface HealthScore {
  readonly score: number;
  readonly marginComponent: number;
  readonly receivablesComponent: number;
  readonly collectionComponent: number;
  readonly band: HealthBand;
  readonly summary: string;
}

// Bands match the design gauge: ≥70 green, ≥55 amber, below that red.
const GOOD_THRESHOLD = 70;
const WATCH_THRESHOLD = 55;

// Decision B weights. Margin leads — it is the product's differentiator.
const MARGIN_WEIGHT = 40;
const RECEIVABLES_WEIGHT = 30;
const COLLECTION_WEIGHT = 30;

const BAND_PHRASES: Record<HealthBand, string> = {
  good: "Good",
  watch: "Watch",
  risk: "At risk",
};

const WEAKEST_PHRASES = {
  margin: "margins below target",
  receivables: "overdue receivables piling up",
  collection: "collections lagging invoicing",
} as const;

function clampComponent(value: number): number {
  return Math.min(100, Math.max(0, roundHalfUp(value)));
}

/**
 * The dashboard's headline number, defined (decision B in the roadmap):
 * 40% margin health + 30% receivables health + 30% collection health.
 *
 * Empty books score 100 on receivables and collection — no receivables means
 * nothing is overdue, not that something is wrong. The summary names the
 * weakest component so the gauge explains itself.
 */
export function healthScore(inputs: HealthInputs): HealthScore {
  if (inputs.targetMarginBps <= 0) {
    throw new RangeError(`Target margin must be positive, received ${inputs.targetMarginBps}`);
  }
  const moneyInputs = [
    inputs.overdueCents,
    inputs.outstandingCents,
    inputs.collectedCents,
    inputs.invoicedCents,
  ];
  for (const value of moneyInputs) {
    if (value < 0) {
      throw new RangeError(`Health inputs must be non-negative, received ${value}`);
    }
  }
  if (inputs.overdueCents > inputs.outstandingCents) {
    throw new RangeError(
      `Overdue ${inputs.overdueCents} exceeds outstanding ${inputs.outstandingCents}`,
    );
  }

  const marginComponent = clampComponent((inputs.marginBps * 100) / inputs.targetMarginBps);
  const receivablesComponent =
    inputs.outstandingCents === 0
      ? 100
      : clampComponent(100 - (inputs.overdueCents * 100) / inputs.outstandingCents);
  const collectionComponent =
    inputs.invoicedCents === 0
      ? 100
      : clampComponent((inputs.collectedCents * 100) / inputs.invoicedCents);

  const score = roundHalfUp(
    (MARGIN_WEIGHT * marginComponent +
      RECEIVABLES_WEIGHT * receivablesComponent +
      COLLECTION_WEIGHT * collectionComponent) /
      100,
  );
  const band: HealthBand =
    score >= GOOD_THRESHOLD ? "good" : score >= WATCH_THRESHOLD ? "watch" : "risk";

  let weakestKey: keyof typeof WEAKEST_PHRASES = "margin";
  let weakestValue = marginComponent;
  if (receivablesComponent < weakestValue) {
    weakestKey = "receivables";
    weakestValue = receivablesComponent;
  }
  if (collectionComponent < weakestValue) {
    weakestKey = "collection";
    weakestValue = collectionComponent;
  }

  const summary =
    marginComponent === 100 && receivablesComponent === 100 && collectionComponent === 100
      ? "Good — all systems healthy."
      : `${BAND_PHRASES[band]} — ${WEAKEST_PHRASES[weakestKey]}.`;

  return { score, marginComponent, receivablesComponent, collectionComponent, band, summary };
}
