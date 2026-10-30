import { CheckResponse, type CheckRequest } from "./api-schema";
import { extractIdentifiers, uniqueIdentifiers } from "./identifiers";
import { MAX_IDENTIFIERS } from "./limits";
import type { Db } from "./reports/db";
import { reportedFor, reportsConfig } from "./reports/service";
import { assessRisk } from "./risk";
import { detectSignals } from "./signals";
import { TRAIL_UNAVAILABLE_NOTICE, trailLinkedReporters } from "./trail/schema";
import { runScamTrail, type TrailDeps } from "./trail/trail";
import type { Completer } from "./signals/llm";
import { DOMAIN_NOTICE, runVerifiedChecks } from "./verified";
import { dbFromEnv } from "./reports/db";
import { defaultDeps, type CheckDeps } from "./verified/types";

export { CheckRequest, CheckResponse, MAX_INPUT_CHARS } from "./api-schema";

/** `db` overrides the Supabase client (tests and local runs); undefined = use env. */
export type RunDeps = CheckDeps & { complete?: Completer; db?: Db | null; skipAi?: string; trail?: Partial<TrailDeps> | false };

/** Runs every check on `text` in memory. Nothing here stores or logs the input. */
export async function runCheck({ text }: CheckRequest, deps: RunDeps = defaultDeps()): Promise<CheckResponse> {
  const notices: string[] = [];
  const all = uniqueIdentifiers(extractIdentifiers(text));
  const identifiers = all.slice(0, MAX_IDENTIFIERS);
  if (all.length > MAX_IDENTIFIERS) notices.push(`Only the first ${MAX_IDENTIFIERS} identifiers were checked.`);
  if (deps.skipAi) notices.push(deps.skipAi);
  if (identifiers.some((i) => i.type === "domain")) notices.push(DOMAIN_NOTICE);

  const db = deps.db === undefined ? dbFromEnv(deps.env) : deps.db;
  const [verified, { signals, ai: aiResult }, reported, trail] = await Promise.all([
    runVerifiedChecks(identifiers, deps),
    detectSignals(text, { env: deps.skipAi ? {} : deps.env, complete: deps.skipAi ? undefined : deps.complete }),
    reportedFor(identifiers, reportsConfig(deps.env, db)),
    // Scam trail (P5): hard 2.5 s deadline inside, never throws; off without a graph database.
    deps.trail === false ? undefined : runScamTrail(identifiers, { env: deps.env, db, ...deps.trail }),
  ]);
  if (trail?.status === "unavailable") notices.push(TRAIL_UNAVAILABLE_NOTICE);
  // A configured AI pass that was skipped (daily cap, limiter down) is unavailable; no key at all is "off" (rules only).
  const ai = deps.skipAi ? { status: "unavailable" as const, reason: "skipped today", dropped: 0 } : aiResult;
  const risk = assessRisk({
    verifiedMatches: verified.filter((v) => v.status === "match").length,
    reportedIdentifiers: reported.entries.filter((e) => !e.contested).length,
    contestedIdentifiers: reported.entries.filter((e) => e.contested).length,
    // Hits inside warning/news-style sentences are shown but carry no weight (G3).
    suspectedRules: new Set(signals.filter((s) => s.context !== "warning").map((s) => s.rule_id)).size,
    warningOnlyRules: new Set(signals.filter((s) => s.context === "warning").map((s) => s.rule_id)).size,
    unavailableSources:
      verified.filter((v) => v.status === "unavailable").length +
      (ai.status === "unavailable" ? 1 : 0) +
      (reported.status === "unavailable" ? 1 : 0),
    reportsAvailable: reported.status === "ok",
    trailLinkedReporters: trailLinkedReporters(trail),
  });
  return CheckResponse.parse({
    identifiers,
    verified,
    reported,
    suspected: signals,
    ai,
    risk,
    notices,
    checkedAt: deps.now().toISOString(),
    trail,
  });
}
