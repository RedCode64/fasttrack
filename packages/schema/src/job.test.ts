import { describe, expect, it } from "vitest";
import { jobSchema } from "./job.js";

const validJob = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  client_id: "2d0f7d2b-3a4c-4e6f-9b8c-0d1e2f3a4b5c",
  title: "Panel upgrade",
  address: "88 Cedar Ave",
  scheduled_at: null,
  status: "quoted",
  notes: null,
  created_at: "2026-07-16T12:00:00+00:00",
  updated_at: "2026-07-16T12:00:00+00:00",
  deleted_at: null,
};

describe("jobSchema", () => {
  it("parses the job an estimate implicitly creates: client + title (decision 7)", () => {
    const parsed = jobSchema.parse(validJob);
    expect(parsed.title).toBe("Panel upgrade");
    expect(parsed.status).toBe("quoted");
  });

  it("accepts in_progress — the dashboard renders it", () => {
    expect(jobSchema.parse({ ...validJob, status: "in_progress" }).status).toBe("in_progress");
  });

  it("rejects an empty title — the implicit-creation rule requires one", () => {
    expect(() => jobSchema.parse({ ...validJob, title: "" })).toThrow();
  });
});
