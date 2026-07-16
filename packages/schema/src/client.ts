import { z } from "zod";
import { syncColumns, uuidField } from "./common.js";

export const clientSchema = z.strictObject({
  id: uuidField,
  org_id: uuidField,
  name: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  notes: z.string().nullable(),
  ...syncColumns,
});

export type Client = z.infer<typeof clientSchema>;
