import type { Job } from "@fasttrack/schema";

import type { DbCtx, SqlRow } from "../driver";
import { rowToJob } from "../mappers";

export interface JobListRow {
  readonly job: Job;
  readonly clientName: string;
}

/** Job picker rows (expenses attribution) — active jobs, newest first. */
export async function listJobs(ctx: DbCtx, orgId: string): Promise<JobListRow[]> {
  const rows = await ctx.driver.exec(
    `SELECT j.*, c.name AS __client_name
     FROM jobs j
     JOIN clients c ON c.id = j.client_id
     WHERE j.org_id = ? AND j.deleted_at IS NULL
     ORDER BY j.created_at DESC`,
    [orgId],
  );
  return rows.map((row: SqlRow) => ({
    job: rowToJob(row),
    clientName: String(row.__client_name),
  }));
}
