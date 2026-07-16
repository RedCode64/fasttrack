import { describe, expect, it } from "vitest";
import { photoSchema, signatureSchema } from "./media.js";

const validPhoto = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  estimate_id: null,
  invoice_id: null,
  storage_path: "org/1c9e6c1a/photos/p-001.jpg",
  caption: "Before — corroded panel",
  taken_at: "2026-07-14T10:00:00+00:00",
  created_at: "2026-07-14T10:00:00+00:00",
  updated_at: "2026-07-14T10:00:00+00:00",
  deleted_at: null,
};

describe("photoSchema", () => {
  it("parses a job photo not attached to any document", () => {
    expect(photoSchema.parse(validPhoto).job_id).toBe("4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e");
  });

  it("parses a photo attached to an estimate", () => {
    const parsed = photoSchema.parse({
      ...validPhoto,
      estimate_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
    });
    expect(parsed.estimate_id).not.toBeNull();
  });
});

describe("signatureSchema", () => {
  const validSignature = {
    id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
    org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
    estimate_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
    invoice_id: null,
    storage_path: "org/1c9e6c1a/signatures/s-001.png",
    signed_by: "R. Novak",
    signed_at: "2026-07-14T10:00:00+00:00",
  };

  it("parses an estimate acceptance signature", () => {
    expect(signatureSchema.parse(validSignature).signed_by).toBe("R. Novak");
  });

  it("rejects a signature attached to neither document — it must witness something", () => {
    expect(() =>
      signatureSchema.parse({ ...validSignature, estimate_id: null, invoice_id: null }),
    ).toThrow();
  });
});
