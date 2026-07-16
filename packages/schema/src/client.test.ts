import { describe, expect, it } from "vitest";
import { clientSchema } from "./client.js";

const validClient = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  name: "R. Novak",
  email: "novak@example.com",
  phone: "555-0142",
  address: "88 Cedar Ave",
  notes: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("clientSchema", () => {
  it("parses a valid client", () => {
    expect(clientSchema.parse(validClient).name).toBe("R. Novak");
  });

  it("parses a soft-deleted client — deletes sync, they don't disappear", () => {
    const parsed = clientSchema.parse({
      ...validClient,
      deleted_at: "2026-07-16T13:00:00+00:00",
    });
    expect(parsed.deleted_at).toBe("2026-07-16T13:00:00+00:00");
  });

  it("rejects a client without org_id — every table carries the tenant key", () => {
    const { org_id: _omitted, ...withoutOrg } = validClient;
    expect(() => clientSchema.parse(withoutOrg)).toThrow();
  });
});
