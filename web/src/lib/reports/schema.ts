import { z } from "zod";
import { IdentifierType } from "../extract/types";

export const REPORT_CATEGORIES = [
  "investment",
  "task_job",
  "digital_arrest",
  "kyc_refund",
  "romance",
  "lottery",
  "impersonation",
  "account_hacked",
  "other",
] as const;

const IdRef = z.object({ type: IdentifierType, value: z.string().trim().min(3).max(200) });

export const ReportRequest = z.object({
  identifiers: z.array(IdRef).min(1).max(10),
  category: z.enum(REPORT_CATEGORIES),
  consent: z.literal(true, { error: "Consent is required" }),
});
export type ReportRequest = z.infer<typeof ReportRequest>;

export const ContestRequest = z.object({ identifier: IdRef, reason: z.string().trim().min(10).max(500) });
export type ContestRequest = z.infer<typeof ContestRequest>;

export const ReportedEntry = z.object({
  type: IdentifierType,
  display: z.string(), // masked
  reporters: z.number().int(),
  categories: z.array(z.string()),
  firstReported: z.string(),
  lastReported: z.string(),
  synthetic: z.boolean(),
  /** Someone contested this entry; it stays visible, labelled, and never counts toward High (G2). */
  contested: z.boolean().default(false),
});
export type ReportedEntry = z.infer<typeof ReportedEntry>;

export const ReportedTier = z.object({
  status: z.enum(["ok", "unavailable"]),
  entries: z.array(ReportedEntry),
  reason: z.string().optional(),
  /** false when the database predates migration 002: contested entries are then hidden (old policy). */
  contestPolicy: z.enum(["visible", "legacy_hidden"]).optional(),
});
export type ReportedTier = z.infer<typeof ReportedTier>;
