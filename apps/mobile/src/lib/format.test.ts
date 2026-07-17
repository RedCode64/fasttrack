import { describe, expect, it } from "vitest";

import {
  deltaLabel,
  docNumber,
  greeting,
  money,
  moneyK,
  monthLabel,
  pctFromBps,
  relativeTime,
  shortDate,
} from "./format";

describe("money", () => {
  it("renders whole dollars with separators", () => {
    expect(money(2840000)).toBe("$28,400");
    expect(money(0)).toBe("$0");
    expect(money(-100000)).toBe("-$1,000");
  });

  it("renders cents in capture style", () => {
    expect(money(41200, { showCents: true })).toBe("$412.00");
    expect(money(41207, { showCents: true })).toBe("$412.07");
  });
});

describe("moneyK", () => {
  it("abbreviates thousands and passes small values through", () => {
    expect(moneyK(420000)).toBe("$4.2k");
    expect(moneyK(1840000)).toBe("$18.4k");
    expect(moneyK(64000)).toBe("$640");
  });
});

describe("pctFromBps / deltaLabel", () => {
  it("rounds bps to whole percent", () => {
    expect(pctFromBps(3300)).toBe("33%");
    expect(pctFromBps(2593)).toBe("26%");
  });

  it("labels deltas with direction arrows", () => {
    expect(deltaLabel(6.2)).toBe("▲ 6.2%");
    expect(deltaLabel(-25)).toBe("▼ 25%");
    expect(deltaLabel(null)).toBe("—");
  });
});

describe("dates", () => {
  it("relativeTime buckets minutes, hours, days", () => {
    const now = "2026-07-16T12:00:00.000Z";
    expect(relativeTime("2026-07-16T11:55:00.000Z", now)).toBe("5m");
    expect(relativeTime("2026-07-16T10:00:00.000Z", now)).toBe("2h");
    expect(relativeTime("2026-07-13T12:00:00.000Z", now)).toBe("3d");
  });

  it("shortDate and monthLabel match the design notation", () => {
    expect(shortDate("2026-07-08T10:00:00.000Z")).toBe("Jul 8");
    expect(monthLabel("2026-07-16T12:00:00.000Z")).toBe("JULY 2026");
  });
});

describe("docNumber / greeting", () => {
  it("prefixes document numbers", () => {
    expect(docNumber("INV", 1042)).toBe("INV-1042");
    expect(docNumber("EST", 1001)).toBe("EST-1001");
  });

  it("greets by hour", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
  });
});
