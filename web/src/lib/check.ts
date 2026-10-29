import { CheckResponse, type CheckRequest } from "./api-schema";
import { extractIdentifiers, uniqueIdentifiers } from "./identifiers";
import type { Db } from "./reports/db";
import { reportedFor, reportsConfig } from "./reports/service";
import { assessRisk } from "./risk";
import { detectSignals } from "./signals";
import type { Completer } from "./signals/llm";
import { runVerifiedChecks } from "./verified";
import { defaultDeps, type CheckDeps } from "./verified/types";

export { CheckRequest, CheckResponse, MAX_INPUT_CHARS } from "./api-schema";

/** `db` overrides the Supabase client (tests and local runs); undefined = use env. */
export type RunDeps = CheckDeps & { complete?: Completer; db?: Db | null };

/** Runs every check on `text` in memory. Nothing here stores or logs the input. */
export async function runCheck({ text }: CheckRequest, deps: RunDeps = defaultDeps()): Promise<CheckResponse> {
  const identifiers = extractIdentifiers(text);
  const [verified, { signals, ai }, reported] = await Promise.all([
    runVerifiedChecks(identifiers, deps),
    detectSignals(text, { env: deps.env, complete: deps.complete }),
    reportedFor(uniqueIdentifiers(identifiers), reportsConfig(deps.env, deps.db)),
  ]);
  const risk = assessRisk({
    verifiedMatches: verified.filter((v) => v.status === "match").length,
    reportedIdentifiers: reported.entries.length,
    suspectedRules: new Set(signals.map((s) => s.rule_id)).size,
    unavailableSources:
      verified.filter((v) => v.status === "unavailable").length +
      (ai.status === "unavailable" ? 1 : 0) +
      (reported.status === "unavailable" ? 1 : 0),
    reportsAvailable: reported.status === "ok",
  });
  return CheckResponse.parse({
    identifiers,
    verified,
    reported,
    suspected: signals,
    ai,
    risk,
    checkedAt: deps.now().toISOString(),
  });
}
