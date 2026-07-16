import { z } from "zod";
import { syncColumns, timestampField, uuidField } from "./common.js";
import { jobStatusSchema } from "./enums.js";

/**
 * The spine of the data model (spec decision 5). Created implicitly by the
 * first estimate drafted for a client + title (decision 7) — there is no Jobs
 * tab on mobile, but every document and expense hangs off one of these rows.
 */
export const jobSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  client_id: uuidField,
  title: z.string().min(1),
  address: z.string().min(1).nullable(),
  scheduled_at: timestampField.nullable(),
  status: jobStatusSchema,
  notes: z.string().nullable(),
  ...syncColumns,
});

export type Job = z.infer<typeof jobSchema>;
