import { describe, expect, it } from "vitest";

import { createClient, getClient, listClients } from "./clientRepo";
import { createOrg } from "./orgRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

async function withOrg(): Promise<{ t: TestCtx; orgId: string }> {
  const t = await createTestCtx();
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 0,
  });
  return { t, orgId: org.id };
}

describe("clientRepo", () => {
  it("creates and fetches a client with optional fields null", async () => {
    const { t, orgId } = await withOrg();
    const created = await createClient(t.ctx, orgId, { name: "Novak" });
    const fetched = await getClient(t.ctx, created.id);
    expect(fetched?.name).toBe("Novak");
    expect(fetched?.email).toBeNull();
    expect(fetched?.org_id).toBe(orgId);
  });

  it("lists active clients sorted by name", async () => {
    const { t, orgId } = await withOrg();
    await createClient(t.ctx, orgId, { name: "Whitfield" });
    await createClient(t.ctx, orgId, { name: "Chen" });
    await createClient(t.ctx, orgId, { name: "Okafor Café" });
    const names = (await listClients(t.ctx, orgId)).map((c) => c.name);
    expect(names).toEqual(["Chen", "Okafor Café", "Whitfield"]);
  });

  it("excludes soft-deleted clients from lists", async () => {
    const { t, orgId } = await withOrg();
    const keep = await createClient(t.ctx, orgId, { name: "Keeper" });
    const gone = await createClient(t.ctx, orgId, { name: "Gone" });
    await t.ctx.driver.exec("UPDATE clients SET deleted_at = ? WHERE id = ?", [
      t.ctx.now(),
      gone.id,
    ]);
    const names = (await listClients(t.ctx, orgId)).map((c) => c.name);
    expect(names).toEqual([keep.name]);
  });
});
