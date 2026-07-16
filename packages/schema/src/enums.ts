import { z } from "zod";

export const jobStatusSchema = z.enum(["lead", "quoted", "in_progress", "complete", "lost"]);
export const estimateStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
]);
export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
]);
export const paymentMethodSchema = z.enum([
  "check",
  "cash",
  "zelle",
  "bank_transfer",
  "card_other",
]);
export const lineKindSchema = z.enum(["material", "labor", "other"]);
export const priceBookKindSchema = z.enum(["material", "labor"]);
export const membershipRoleSchema = z.enum(["owner", "member"]);
export const tradeSchema = z.enum([
  "electrical",
  "plumbing",
  "hvac",
  "general_contracting",
  "handyman",
  "other",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type EstimateStatus = z.infer<typeof estimateStatusSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type LineKind = z.infer<typeof lineKindSchema>;
export type PriceBookKind = z.infer<typeof priceBookKindSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Trade = z.infer<typeof tradeSchema>;
