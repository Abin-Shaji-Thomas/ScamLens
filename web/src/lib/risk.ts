import { z } from "zod";

export const RiskLevel = z.enum(["low", "elevated", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const RISK_LABEL: Record<RiskLevel, string> = {
  high: "High signals",
  elevated: "Elevated signals",
  low: "Low signals - not a safety guarantee",
};
export const NO_REPORTS_MESSAGE = "No known reports. This does not mean safe.";

export const Risk = z.object({
  level: RiskLevel,
  label: z.string(),
  reasons: z.array(z.string()),
  reportedMessage: z.string().optional(),
});
export type Risk = z.infer<typeof Risk>;

export interface RiskInput {
  /** Verified-tier results with status "match" (OFAC, ScamSniffer, GoPlus flag). */
  verifiedMatches: number;
  /** Identifiers with >= 2 independent, non-contested reports in the last 90 days. */
  reportedIdentifiers: number;
  /** Distinct rule ids among suspected signals (rule pass or validated AI pass). */
  suspectedRules: number;
  /** Sources that could not be checked. */
  unavailableSources: number;
}

/**
 * Tier rules (docs/SPEC.md):
 * High     = >= 1 verified match, OR (>= 1 reported identifier AND >= 1 suspected signal).
 * Elevated = any suspected signal or reported identifier that does not reach High.
 * Low      = nothing found; never presented as safe.
 * Suspected signals alone (including any number of AI signals) can never produce High.
 */
export function assessRisk(i: RiskInput): Risk {
  const reasons: string[] = [];
  if (i.verifiedMatches > 0) reasons.push(`${i.verifiedMatches} verified match(es) from independent sources`);
  if (i.reportedIdentifiers > 0) reasons.push(`${i.reportedIdentifiers} identifier(s) reported by 2+ independent people`);
  if (i.suspectedRules > 0) reasons.push(`${i.suspectedRules} suspected pattern(s) in the text`);
  if (i.unavailableSources > 0) reasons.push(`${i.unavailableSources} source(s) unavailable - result is incomplete`);

  const level: RiskLevel =
    i.verifiedMatches > 0 || (i.reportedIdentifiers > 0 && i.suspectedRules > 0)
      ? "high"
      : i.suspectedRules > 0 || i.reportedIdentifiers > 0
        ? "elevated"
        : "low";

  return {
    level,
    label: RISK_LABEL[level],
    reasons,
    reportedMessage: i.reportedIdentifiers === 0 ? NO_REPORTS_MESSAGE : undefined,
  };
}
