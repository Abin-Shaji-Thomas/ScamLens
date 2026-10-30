import { z } from "zod";

export const RiskLevel = z.enum(["low", "elevated", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const RISK_LABEL: Record<RiskLevel, string> = {
  high: "High signals",
  elevated: "Elevated signals",
  low: "Low signals - not a safety guarantee",
};
export const NO_REPORTS_MESSAGE = "No known reports. This does not mean safe.";

/** Plain-language explanation shown under the risk header. Describes evidence, never a person. */
export const RISK_EXPLANATION: Record<RiskLevel, string> = {
  high: "Strong evidence needs your attention: an address or website matched a checked list, or a reported identifier appears together with warning signs. Stop and verify before you pay or share anything.",
  elevated: "Warning signs or community reports were found. That is not proof, but pause and verify the other person through an official channel before you pay.",
  low: "We found nothing in the sources we checked. This does not mean safe: new numbers, UPI IDs and wallets are not on any list yet.",
};
/** Why an unreported scam usually shows Elevated, not High (shown on the card under "What the levels mean"). */
export const RISK_CEILING_NOTE =
  "Warning patterns in the text can raise the level to Elevated, never to High. High needs a verified fact (an address or website on a checked list) or community reports from independent people together with warning signs, so a new scam that nobody has reported yet usually shows Elevated.";
/** The large word on the card and the scale "Low signals · Elevated · High" (G4). The full label stays in RISK_LABEL. */
export const RISK_SHORT: Record<RiskLevel, string> = { low: "Low signals", elevated: "Elevated", high: "High" };

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
  /** Reported identifiers someone contested (G2): shown, but only a weak signal; they never count toward High. */
  contestedIdentifiers?: number;
  /** Distinct rule ids among suspected signals (rule pass or validated AI pass). */
  suspectedRules: number;
  /** Distinct rules found ONLY inside warning, news or awareness sentences (G3): shown, never counted. */
  warningOnlyRules?: number;
  /** Sources that could not be checked. */
  unavailableSources: number;
  /** False when the reports database could not be queried: then we must not claim "no known reports". */
  reportsAvailable?: boolean;
}

/**
 * Tier rules (docs/SPEC.md):
 * High     = >= 1 verified match, OR (>= 1 reported identifier AND >= 1 suspected signal).
 * Elevated = any suspected signal or reported identifier that does not reach High.
 * Low      = nothing found; never presented as safe.
 * Contested reports (G2) can raise Low to Elevated at most; they never count toward High.
 * Suspected signals alone (including any number of AI signals) can never produce High.
 */
export function assessRisk(i: RiskInput): Risk {
  const reasons: string[] = [];
  if (i.verifiedMatches > 0) reasons.push(`${i.verifiedMatches} verified match(es) from independent sources`);
  if (i.reportedIdentifiers > 0) reasons.push(`${i.reportedIdentifiers} identifier(s) reported by 2+ independent people`);
  const contested = i.contestedIdentifiers ?? 0;
  if (contested > 0) reasons.push(`${contested} reported identifier(s) contested, under review (not counted toward High)`);
  if (i.suspectedRules > 0) reasons.push(`${i.suspectedRules} suspected pattern(s) in the text`);
  if ((i.warningOnlyRules ?? 0) > 0) {
    reasons.push(
      `${i.warningOnlyRules} pattern(s) appear only in warning or news-style text (for example "never share your OTP"), so they are shown but not counted`,
    );
  }
  if (i.unavailableSources > 0) reasons.push(`${i.unavailableSources} source(s) unavailable - result is incomplete`);

  const level: RiskLevel =
    i.verifiedMatches > 0 || (i.reportedIdentifiers > 0 && i.suspectedRules > 0)
      ? "high"
      : i.suspectedRules > 0 || i.reportedIdentifiers > 0 || contested > 0
        ? "elevated"
        : "low";

  return {
    level,
    label: RISK_LABEL[level],
    reasons,
    reportedMessage: i.reportedIdentifiers === 0 && contested === 0 && i.reportsAvailable !== false ? NO_REPORTS_MESSAGE : undefined,
  };
}
