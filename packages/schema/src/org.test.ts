import { describe, expect, it } from "vitest";
import { membershipSchema, organizationSchema, userSchema } from "./org.js";

const validOrg = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  name: "Pagan Electric LLC",
  logo_url: null,
  address: "12 Main St, Springfield",
  license_no: "EC-13445",
  trade: "electrical",
  tax_config: { name: "Sales Tax", rate_bps: 825 },
  target_margin_bps: 3_000,
  created_at: "2026-07-16T12:00:00+00:00",
};

describe("organizationSchema", () => {
  it("parses a valid organization", () => {
    const parsed = organizationSchema.parse(validOrg);
    expect(parsed.tax_config.rate_bps).toBe(825);
    expect(parsed.target_margin_bps).toBe(3_000);
  });

  it("rejects unknown columns — strict objects catch schema drift", () => {
    expect(() => organizationSchema.parse({ ...validOrg, stripe_id: "x" })).toThrow();
  });

  it("rejects a target margin of zero or 100%+ — healthScore requires positive", () => {
    expect(() => organizationSchema.parse({ ...validOrg, target_margin_bps: 0 })).toThrow();
    expect(() => organizationSchema.parse({ ...validOrg, target_margin_bps: 10_000 })).toThrow();
  });
});

describe("userSchema", () => {
  it("validates email", () => {
    expect(() =>
      userSchema.parse({
        id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
        email: "not-an-email",
        name: "Sam",
      }),
    ).toThrow();
  });
});

describe("membershipSchema", () => {
  it("parses an owner membership — the R1 tenancy row for a solo operator", () => {
    const parsed = membershipSchema.parse({
      id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      user_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
      role: "owner",
    });
    expect(parsed.role).toBe("owner");
  });
});
