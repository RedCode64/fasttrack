import { describe, expect, it } from "vitest";

import { isProEntitlement, PRO_ENTITLEMENT_ID } from "./entitlement";

describe("isProEntitlement", () => {
  it("is true when the pro entitlement is active", () => {
    const info = { entitlements: { active: { [PRO_ENTITLEMENT_ID]: { isActive: true } } } };
    expect(isProEntitlement(info)).toBe(true);
  });
  it("is false when no entitlements are active", () => {
    expect(isProEntitlement({ entitlements: { active: {} } })).toBe(false);
  });
  it("is false when only a different entitlement is active", () => {
    expect(isProEntitlement({ entitlements: { active: { other: {} } } })).toBe(false);
  });
});
