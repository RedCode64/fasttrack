import { clientSchema, type Client } from "@fasttrack/schema";

import type { DbCtx } from "../driver";
import { rowToClient } from "../mappers";

export interface CreateClientInput {
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly notes?: string;
}

export async function createClient(
  ctx: DbCtx,
  orgId: string,
  input: CreateClientInput,
): Promise<Client> {
  const now = ctx.now();
  const client = clientSchema.parse({
    id: ctx.newId(),
    org_id: orgId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  await ctx.driver.exec(
    `INSERT INTO clients (id, org_id, name, email, phone, address, notes,
       created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      client.id,
      client.org_id,
      client.name,
      client.email,
      client.phone,
      client.address,
      client.notes,
      client.created_at,
      client.updated_at,
    ],
  );
  return client;
}

export async function getClient(ctx: DbCtx, id: string): Promise<Client | null> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  const first = rows[0];
  return first ? rowToClient(first) : null;
}

export async function listClients(ctx: DbCtx, orgId: string): Promise<Client[]> {
  const rows = await ctx.driver.exec(
    "SELECT * FROM clients WHERE org_id = ? AND deleted_at IS NULL ORDER BY name",
    [orgId],
  );
  return rows.map(rowToClient);
}
