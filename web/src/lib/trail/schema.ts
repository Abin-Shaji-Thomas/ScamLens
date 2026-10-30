// Scam trail on the result (final round P5): links from the identifiers in a check to others in community reports and
// on-chain transfers, as counts only. Client-safe: no server imports.
import { z } from "zod";
import { IdentifierType } from "../extract/types";

/** Identifier types the trail looks up (graph vertex types), wallets first. */
export const TRAIL_TYPES: readonly IdentifierType[] = ["evm", "tron", "btc", "upi", "telegram", "phone", "email", "domain"];
export const MAX_TRAIL_IDENTIFIERS = 5;
export const TRAIL_TIMEOUT_MS = 2_500;
export const TRAIL_CONCURRENCY = 3;
export const TRAIL_UNAVAILABLE_NOTICE = "The scam trail (links to other reported identifiers) could not be checked this time, so it is missing from this result.";

const Count = z.object({ key: z.string(), n: z.number().int() });

export const TrailEntry = z.object({
  type: IdentifierType,
  display: z.string(), // masked
  /** Distinct identifiers linked within 2 steps (reports naming them together, or on-chain transfers). */
  linked: z.number().int(),
  /** Linked identifiers that are themselves reported by >= 2 independent people (not contested). */
  reportedLinks: z.number().int(),
  /** Most independent reporters behind any one linked identifier. */
  maxLinkedReporters: z.number().int(),
  /** The cluster reaches an address on a verified list (within 2 steps). */
  touchesFlagged: z.boolean(),
});
export type TrailEntry = z.infer<typeof TrailEntry>;

export const TrailSummary = z.object({
  /** "cases" once migration 004 holds contributed cases; otherwise counts come from the reports alone. */
  source: z.enum(["cases", "reports"]),
  cases: z.number().int(),
  reporters: z.number().int(),
  syntheticCases: z.number().int(),
  realCases: z.number().int(),
  categories: z.array(Count),
  channels: z.array(Count),
  lossBands: z.array(Count),
  months: z.array(Count),
  firstSeen: z.string().optional(),
  lastSeen: z.string().optional(),
});
export type TrailSummary = z.infer<typeof TrailSummary>;

export const Trail = z.object({
  /** off = no graph database configured (local runs); unavailable = configured but failed or timed out. */
  status: z.enum(["ok", "unavailable", "off"]),
  backend: z.string().optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
  entries: z.array(TrailEntry),
  summary: TrailSummary.optional(),
});
export type Trail = z.infer<typeof Trail>;

/** The level input: the most independent reporters behind any linked identifier in the trail. */
export const trailLinkedReporters = (t: Trail | undefined) => (t?.status === "ok" ? Math.max(0, ...t.entries.map((e) => e.maxLinkedReporters)) : 0);
