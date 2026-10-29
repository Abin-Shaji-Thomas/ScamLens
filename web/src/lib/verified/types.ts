import { z } from "zod";
import { IdentifierType } from "../extract/types";

export const SourceId = z.enum(["ofac", "scamsniffer", "goplus", "etherscan", "trongrid"]);
export type SourceId = z.infer<typeof SourceId>;

// There is deliberately no "safe" status: a source either matched, did not match
// (as of a date), returned facts, or was unavailable.
export const CheckStatus = z.enum(["match", "no_match", "info", "unavailable"]);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const SourceResult = z.object({
  source: SourceId,
  sourceName: z.string(),
  identifier: z.object({ type: IdentifierType, value: z.string() }),
  status: CheckStatus,
  summary: z.string(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })),
  link: z.string(),
  checkedAt: z.string(),
  dataAsOf: z.string().optional(), // snapshot date for downloaded lists
  note: z.string().optional(),
  reason: z.string().optional(), // why a source was unavailable
});
export type SourceResult = z.infer<typeof SourceResult>;

export interface CheckDeps {
  fetch: typeof fetch;
  timeoutMs: number;
  now: () => Date;
  env: Record<string, string | undefined>;
}

export function defaultDeps(): CheckDeps {
  return { fetch: globalThis.fetch, timeoutMs: 5000, now: () => new Date(), env: process.env };
}

export type ResultBase = Omit<SourceResult, "status" | "summary" | "facts">;

export function unavailable(base: ResultBase, reason: string): SourceResult {
  return { ...base, status: "unavailable", summary: `${base.sourceName}: unavailable (${reason})`, facts: [], reason };
}
