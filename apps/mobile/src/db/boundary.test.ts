import { clientSchema, timestampField } from "@fasttrack/schema";
import { describe, expect, it } from "vitest";

import { defaultNow } from "./driver";

describe("schema boundary formats", () => {
  it("timestampField accepts what defaultNow() writes", () => {
    expect(() => timestampField.parse(defaultNow())).not.toThrow();
  });

  it("a repo-shaped row parses through the shared row schema", () => {
    const now = defaultNow();
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      org_id: "22222222-2222-4222-8222-222222222222",
      name: "Boundary Test Client",
      email: null,
      phone: null,
      address: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(() => clientSchema.parse(row)).not.toThrow();
  });
});
