import { describe, expect, it } from "vitest";

import { rangeFilenameSlug, rangeFor, rangeLabel } from "./dateRange";

/** Local noon, so the range never straddles a day boundary via UTC drift. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("rangeFor", () => {
  it("bounds this month inclusively on both ends", () => {
    expect(rangeFor("this_month", at(2026, 7, 29))).toEqual({
      preset: "this_month",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("bounds last month inclusively, landing on its true final day", () => {
    expect(rangeFor("last_month", at(2026, 7, 29))).toEqual({
      preset: "last_month",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });

  it("walks last month back across a year boundary", () => {
    expect(rangeFor("last_month", at(2026, 1, 15))).toEqual({
      preset: "last_month",
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });

  it("ends February on the 29th in a leap year", () => {
    expect(rangeFor("this_month", at(2028, 2, 10)).endDate).toBe("2028-02-29");
    expect(rangeFor("this_month", at(2027, 2, 10)).endDate).toBe("2027-02-28");
  });

  it("bounds this year to the whole calendar year", () => {
    expect(rangeFor("this_year", at(2026, 7, 29))).toEqual({
      preset: "this_year",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
  });

  it("leaves all-time unbounded so nothing is filtered out", () => {
    expect(rangeFor("all", at(2026, 7, 29))).toEqual({
      preset: "all",
      startDate: null,
      endDate: null,
    });
  });

  it("still bounds the month correctly on its first and last day", () => {
    expect(rangeFor("this_month", at(2026, 7, 1)).startDate).toBe("2026-07-01");
    expect(rangeFor("this_month", at(2026, 7, 31)).endDate).toBe("2026-07-31");
  });
});

describe("rangeLabel", () => {
  it("names each range the way it reads on the button", () => {
    expect(rangeLabel(rangeFor("this_month", at(2026, 7, 29)))).toBe("July 2026");
    expect(rangeLabel(rangeFor("last_month", at(2026, 7, 29)))).toBe("June 2026");
    expect(rangeLabel(rangeFor("this_year", at(2026, 7, 29)))).toBe("2026");
    expect(rangeLabel(rangeFor("all", at(2026, 7, 29)))).toBe("All time");
  });
});

describe("rangeFilenameSlug", () => {
  it("puts both bounds in the filename so re-exports are distinguishable", () => {
    expect(rangeFilenameSlug(rangeFor("this_month", at(2026, 7, 29)))).toBe(
      "2026-07-01-to-2026-07-31",
    );
  });

  it("marks an unbounded export as all-time", () => {
    expect(rangeFilenameSlug(rangeFor("all", at(2026, 7, 29)))).toBe("all-time");
  });
});
