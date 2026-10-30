// Request/response schemas for /api/check. Kept free of server-only imports so
// client components can validate responses without bundling list data.
import { z } from "zod";
import { Identifier } from "./extract/types";
import { MAX_TEXT_CHARS } from "./limits";
import { Receipt } from "./receipt-format";
import { ReportedTier } from "./reports/schema";
import { Risk } from "./risk";
import { AiStatus, Signal } from "./signals/types";
import { Trail } from "./trail/schema";
import { SourceResult } from "./verified/types";

/** @deprecated use MAX_TEXT_CHARS from ./limits */
export const MAX_INPUT_CHARS = MAX_TEXT_CHARS;

export const CheckRequest = z.object({
  text: z.string().trim().min(1, "Please paste some text to check.").max(MAX_TEXT_CHARS, `Please paste at most ${MAX_TEXT_CHARS} characters.`),
});
export type CheckRequest = z.infer<typeof CheckRequest>;

export const CheckResponse = z.object({
  identifiers: z.array(Identifier),
  verified: z.array(SourceResult),
  reported: ReportedTier,
  suspected: z.array(Signal),
  ai: AiStatus,
  risk: Risk,
  /** Plain-language notices about limits or skipped steps (never contain user text). */
  notices: z.array(z.string()).default([]),
  checkedAt: z.string(),
  /** Signed receipt (receipt-format.ts); absent when RECEIPT_SIGNING_KEY is not configured. */
  receipt: Receipt.optional(),
  /** Scam trail (links to other reported identifiers), counts only; absent when the check skipped it. */
  trail: Trail.optional(),
});
export type CheckResponse = z.infer<typeof CheckResponse>;
