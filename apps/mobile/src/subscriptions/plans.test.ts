import { describe, expect, it } from "vitest";

import { buildPlanViews, recommendedPlanIdentifier, type PackageLike } from "./plans";

const pkg = (
  identifier: string,
  packageType: string,
  priceString: string,
  pricePerMonth: number | null,
  pricePerMonthString: string | null = null,
): PackageLike => ({
  identifier,
  packageType,
  product: { title: `Pro ${identifier}`, priceString, pricePerMonth, pricePerMonthString },
});

const WEEKLY = pkg("$rc_weekly", "WEEKLY", "$4.99", 21.63, "$21.63");
const MONTHLY = pkg("$rc_monthly", "MONTHLY", "$14.99", 14.99, "$14.99");
const ANNUAL = pkg("$rc_annual", "ANNUAL", "$99.99", 8.33, "$8.33");

describe("buildPlanViews", () => {
  it("orders weekly, then monthly, then annual regardless of input order", () => {
    const views = buildPlanViews([ANNUAL, WEEKLY, MONTHLY]);
    expect(views.map((v) => v.label)).toEqual(["Weekly", "Monthly", "Annual"]);
  });

  it("labels each plan with its billing cadence", () => {
    const views = buildPlanViews([WEEKLY, MONTHLY, ANNUAL]);
    expect(views.map((v) => v.cadence)).toEqual(["per week", "per month", "per year"]);
  });

  it("shows a per-month equivalent for plans not billed monthly", () => {
    const views = buildPlanViews([WEEKLY, MONTHLY, ANNUAL]);
    expect(views.map((v) => v.perMonthNote)).toEqual(["$21.63/mo", null, "$8.33/mo"]);
  });

  it("badges the cheapest per-month plan with its saving against the priciest", () => {
    const views = buildPlanViews([WEEKLY, MONTHLY, ANNUAL]);
    expect(views.map((v) => v.badge)).toEqual([null, null, "Best value · save 61%"]);
  });

  it("does not badge anything when only one plan is offered", () => {
    expect(buildPlanViews([MONTHLY]).map((v) => v.badge)).toEqual([null]);
  });

  it("does not badge when the saving is negligible", () => {
    const nearlyEqual = pkg("$rc_annual", "ANNUAL", "$179.99", 14.5, "$14.50");
    expect(buildPlanViews([MONTHLY, nearlyEqual]).map((v) => v.badge)).toEqual([null, null]);
  });

  it("falls back to the store product title for unrecognised package types", () => {
    const lifetime = pkg("$rc_lifetime", "LIFETIME", "$299.99", null);
    const [view] = buildPlanViews([lifetime]);
    expect(view.label).toBe("Pro $rc_lifetime");
    expect(view.cadence).toBeNull();
    expect(view.perMonthNote).toBeNull();
  });

  it("omits the per-month note when the store did not supply one", () => {
    const [view] = buildPlanViews([pkg("$rc_annual", "ANNUAL", "$99.99", 8.33, null)]);
    expect(view.perMonthNote).toBeNull();
  });

  it("keeps the package identifier and price string for purchase and display", () => {
    const [view] = buildPlanViews([ANNUAL]);
    expect(view.identifier).toBe("$rc_annual");
    expect(view.priceString).toBe("$99.99");
  });
});

describe("recommendedPlanIdentifier", () => {
  it("preselects the cheapest per-month plan", () => {
    expect(recommendedPlanIdentifier(buildPlanViews([WEEKLY, MONTHLY, ANNUAL]))).toBe("$rc_annual");
  });

  it("falls back to the first plan when no plan prices per month", () => {
    const lifetime = pkg("$rc_lifetime", "LIFETIME", "$299.99", null);
    expect(recommendedPlanIdentifier(buildPlanViews([lifetime]))).toBe("$rc_lifetime");
  });

  it("is null when there are no plans", () => {
    expect(recommendedPlanIdentifier([])).toBeNull();
  });
});
