import { describe, expect, it } from "vitest";

import { createDraft } from "./estimateRepo";
import { listJobs } from "./jobRepo";
import { createOrg } from "./orgRepo";
import { createTestCtx } from "./testUtils";

describe("listJobs", () => {
  it("lists active jobs newest-first with client names", async () => {
    const { ctx, setNow } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "electrical",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    setNow("2026-07-10T10:00:00.000Z");
    await createDraft(ctx, org.id, { newClientName: "Novak", jobTitle: "Panel upgrade" });
    setNow("2026-07-12T10:00:00.000Z");
    await createDraft(ctx, org.id, { newClientName: "Chen", jobTitle: "Sub-panel add" });

    const rows = await listJobs(ctx, org.id);
    expect(rows.map((r) => r.job.title)).toEqual(["Sub-panel add", "Panel upgrade"]);
    expect(rows.map((r) => r.clientName)).toEqual(["Chen", "Novak"]);
  });

  it("excludes soft-deleted jobs", async () => {
    const { ctx } = await createTestCtx();
    const org = await createOrg(ctx, {
      name: "Reyes Electric",
      trade: "handyman",
      targetMarginBps: 3000,
      taxRateBps: 0,
    });
    await createDraft(ctx, org.id, { newClientName: "Novak", jobTitle: "Gate repair" });
    await ctx.driver.exec("UPDATE jobs SET deleted_at = ?", [ctx.now()]);
    expect(await listJobs(ctx, org.id)).toHaveLength(0);
  });
});
