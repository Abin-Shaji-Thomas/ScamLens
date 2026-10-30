// Shapes for contributed cases and "Was this right?" feedback (migration 004). Client-safe: no server imports.
import { z } from "zod";
import { IdentifierType } from "../extract/types";
import { REPORT_CATEGORIES } from "../reports/schema";

export const CASE_CHANNELS = ["call", "sms", "whatsapp", "telegram", "email", "website", "app", "other"] as const;
export const LOSS_BANDS = ["none", "lt_10k", "10k_1l", "gt_1l", "unknown"] as const;
export const VERDICTS = ["scam", "genuine", "unsure"] as const;
export const FEEDBACK_REASONS = ["own_id_or_business", "know_the_person", "company_confirmed", "asked_to_pay", "lost_money", "other"] as const;
export const MAX_EXCERPT_CHARS = 500;
/** Raw excerpt the browser may send before the server redacts it again; the stored text is capped at 500. */
export const MAX_EXCERPT_INPUT_CHARS = 2000;

export const CHANNEL_LABEL: Record<(typeof CASE_CHANNELS)[number], string> = {
  call: "Phone call",
  sms: "SMS",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  website: "Website",
  app: "App",
  other: "Other",
};
export const LOSS_LABEL: Record<(typeof LOSS_BANDS)[number], string> = {
  none: "No money lost",
  lt_10k: "Less than Rs 10,000",
  "10k_1l": "Rs 10,000 to 1 lakh",
  gt_1l: "More than 1 lakh",
  unknown: "Prefer not to say",
};
export const REASON_LABEL: Record<(typeof FEEDBACK_REASONS)[number], string> = {
  own_id_or_business: "It is my own ID or business",
  know_the_person: "I know the person",
  company_confirmed: "The company confirmed it",
  asked_to_pay: "They asked me to pay",
  lost_money: "I lost money",
  other: "Other",
};

const IdRef = z.object({ type: IdentifierType, value: z.string().trim().min(3).max(200) });
const RuleIds = z.array(z.string().regex(/^[a-z_]{3,40}$/)).max(20).default([]);

export const CaseRequest = z
  .object({
    identifiers: z.array(IdRef).min(1).max(10),
    category: z.enum(REPORT_CATEGORIES),
    channel: z.enum(CASE_CHANNELS),
    lossBand: z.enum(LOSS_BANDS).default("unknown"),
    ruleIds: RuleIds,
    excerpt: z.string().max(MAX_EXCERPT_INPUT_CHARS).optional(),
    excerptConsent: z.boolean().default(false),
    consent: z.literal(true, { error: "Consent is required" }),
  })
  .refine((c) => !c.excerpt?.trim() || c.excerptConsent, { message: "Tick the box to save the excerpt, or remove it" });
export type CaseRequest = z.infer<typeof CaseRequest>;

export const DeleteCaseRequest = z.object({
  code: z.string().trim().min(16).max(64),
  removeReports: z.boolean().default(false),
});
export type DeleteCaseRequest = z.infer<typeof DeleteCaseRequest>;

export const FeedbackRequest = z.object({
  identifiers: z.array(IdRef).max(10).default([]),
  verdict: z.enum(VERDICTS),
  reasons: z.array(z.enum(FEEDBACK_REASONS)).max(FEEDBACK_REASONS.length).default([]),
  ruleIds: RuleIds,
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

export const FeedbackCount = z.object({
  display: z.string(), // masked
  scam: z.number().int(),
  genuine: z.number().int(),
  unsure: z.number().int(),
  genuineReasons: z.array(z.enum(FEEDBACK_REASONS)),
});
export type FeedbackCount = z.infer<typeof FeedbackCount>;

export const CASES_UNAVAILABLE = "Contributing is not available right now.";
