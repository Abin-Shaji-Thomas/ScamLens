import { CheckResponse, type CheckRequest } from "./api-schema";
import { extractIdentifiers } from "./identifiers";
import { assessRisk } from "./risk";
import { detectSignals } from "./signals";
import type { Completer } from "./signals/llm";
import { runVerifiedChecks } from "./verified";
import { defaultDeps, type CheckDeps } from "./verified/types";

export { CheckRequest, CheckResponse, MAX_INPUT_CHARS } from "./api-schema";

export type RunDeps = CheckDeps & { complete?: Completer };

/** Runs every check on `text` in memory. Nothing here stores or logs the input. */
export async function runCheck({ text }: CheckRequest, deps: RunDeps = defaultDeps()): Promise<CheckResponse> {
  const identifiers = extractIdentifiers(text);
  const [verified, { signals, ai }] = await Promise.all([
    runVerifiedChecks(identifiers, deps),
    detectSignals(text, { env: deps.env, complete: deps.complete }),
  ]);
  const risk = assessRisk({
    verifiedMatches: verified.filter((v) => v.status === "match").length,
    reportedIdentifiers: 0, // filled in by the reports tier (M5)
    suspectedRules: new Set(signals.map((s) => s.rule_id)).size,
    unavailableSources: verified.filter((v) => v.status === "unavailable").length + (ai.status === "unavailable" ? 1 : 0),
  });
  return CheckResponse.parse({
    identifiers,
    verified,
    reported: [],
    suspected: signals,
    ai,
    risk,
    checkedAt: deps.now().toISOString(),
  });
}
