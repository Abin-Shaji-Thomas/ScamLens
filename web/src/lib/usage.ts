import { createHash, randomBytes } from "node:crypto";
import { positiveIntEnv } from "./env";
import { logEvent } from "./log";
import { dbFromEnv, type Db } from "./reports/db";
import { fingerprintHash } from "./reports/privacy";
import { requestIp } from "./reports/service";

// Abuse guard without accounts: daily counters per request fingerprint plus a global cap on LLM calls.

export interface UsageResult {
  allowed: boolean;
  remaining: number;
  /** true when the shared store failed and this answer came from the per-instance memory fallback. */
  degraded?: boolean;
}

export interface UsageStore {
  consume(key: string, limit: number): Promise<UsageResult>;
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Per-instance counters. Used in tests, locally, and whenever the Supabase function is missing. */
export class MemoryUsageStore implements UsageStore {
  private counts = new Map<string, number>();
  constructor(private now: () => Date = () => new Date()) {}
  async consume(key: string, limit: number): Promise<UsageResult> {
    const k = `${utcDay(this.now())}|${key}`;
    const c = this.counts.get(k) ?? 0;
    if (c >= limit) return { allowed: false, remaining: 0 };
    this.counts.set(k, c + 1);
    if (this.counts.size > 50_000) this.prune();
    return { allowed: true, remaining: limit - c - 1 };
  }
  private prune() {
    const today = utcDay(this.now());
    for (const k of this.counts.keys()) if (!k.startsWith(today)) this.counts.delete(k);
  }
}

/** Shared counters in Postgres (db/schema.sql increment_usage). Throws when the call fails. */
export function sqlUsageStore(db: Db): UsageStore {
  return {
    async consume(key, limit) {
      const [row] = await db.call<{ allowed: boolean; remaining: number }>("increment_usage", { p_key: key, p_limit: limit });
      if (!row) throw new Error("increment_usage returned no row");
      return { allowed: row.allowed, remaining: row.remaining };
    },
  };
}

/** Tries the shared store; on any failure answers from memory and marks the result degraded. */
export function withFallback(primary: UsageStore, fallback: UsageStore = new MemoryUsageStore()): UsageStore {
  return {
    async consume(key, limit) {
      try {
        return await primary.consume(key, limit);
      } catch {
        logEvent("usage_store_fallback", { status: "memory" });
        return { ...(await fallback.consume(key, limit)), degraded: true };
      }
    },
  };
}

let store: UsageStore | null = null;

/** Supabase-backed store with memory fallback, or memory only when Supabase is not configured. */
export function usageStore(env: Record<string, string | undefined> = process.env): UsageStore {
  if (!store) {
    const db = dbFromEnv(env);
    store = db ? withFallback(sqlUsageStore(db)) : new MemoryUsageStore();
  }
  return store;
}
export const setUsageStoreForTests = (s: UsageStore | null) => (store = s);

export type GuardedRoute = "check" | "transcribe" | "graph" | "contest";

export function usageLimits(env: Record<string, string | undefined>) {
  return {
    check: positiveIntEnv(env.USAGE_CHECK_PER_DAY, 40),
    transcribe: positiveIntEnv(env.USAGE_TRANSCRIBE_PER_DAY, 10),
    graph: positiveIntEnv(env.USAGE_GRAPH_PER_DAY, 100),
    contest: positiveIntEnv(env.USAGE_CONTEST_PER_DAY, 3),
    globalLlm: positiveIntEnv(env.USAGE_GLOBAL_LLM_PER_DAY, 1500),
  };
}

// Without a pepper the key is still a one-way hash, salted per server instance (memory store only in practice).
const EPHEMERAL_PEPPER = randomBytes(32).toString("hex");

/** "fp:<hash>": a hash of the existing request fingerprint (HMAC of the client IP), never the IP itself. */
export function fingerprintKey(headers: Headers, env: Record<string, string | undefined>): string {
  const pepper = env.REPORT_HASH_PEPPER || EPHEMERAL_PEPPER;
  const fp = fingerprintHash(pepper, requestIp(headers));
  return `fp:${createHash("sha256").update(`usage:${fp}`).digest("hex").slice(0, 32)}`;
}

/** Seconds until the next UTC midnight, when the daily counters reset. */
export function secondsUntilReset(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function tooManyRequests(message: string, now: Date = new Date()): Response {
  return Response.json(
    { ok: false, error: message },
    { status: 429, headers: { "Retry-After": String(secondsUntilReset(now)), "Cache-Control": "no-store" } },
  );
}

const PER_FP_MESSAGE: Record<GuardedRoute, string> = {
  check: "You have reached today's limit for checks from this network. Please try again tomorrow.",
  transcribe: "You have reached today's limit for reading screenshots. Please paste the text instead, or try again tomorrow.",
  graph: "You have reached today's limit for link lookups. Please try again tomorrow.",
  contest: "You have reached today's limit for contesting entries. Please try again tomorrow.",
};

export const AI_SKIPPED_GLOBAL = "The AI pass is paused for today (daily limit reached). Only the fixed rule checks ran.";
export const AI_SKIPPED_STORE = "The AI pass was skipped because the usage limiter is unavailable. Only the fixed rule checks ran.";

export interface GuardDeps {
  store: UsageStore;
  env: Record<string, string | undefined>;
  now?: () => Date;
}

export type GuardResult =
  | { ok: false; response: Response }
  /** aiAllowed=false comes with a notice explaining why the AI pass will not run. */
  | { ok: true; aiAllowed: boolean; aiNotice?: string };

/**
 * Runs before any external or LLM call. Order: per-fingerprint daily limit (429 when exceeded),
 * then, only if the request would use the LLM, the global daily LLM cap.
 */
export async function guardRequest(route: GuardedRoute, headers: Headers, usesLlm: boolean, deps: GuardDeps): Promise<GuardResult> {
  const now = deps.now?.() ?? new Date();
  const limits = usageLimits(deps.env);
  const fp = await deps.store.consume(`${fingerprintKey(headers, deps.env)}:${route}`, limits[route]);
  if (!fp.allowed) {
    logEvent("rate_limited", { status: route });
    return { ok: false, response: tooManyRequests(PER_FP_MESSAGE[route], now) };
  }
  if (!usesLlm) return { ok: true, aiAllowed: false };
  // A memory fallback cannot enforce a cap shared by all instances, so a degraded store disables the LLM.
  if (fp.degraded) return { ok: true, aiAllowed: false, aiNotice: AI_SKIPPED_STORE };
  const global = await deps.store.consume("global:llm", limits.globalLlm);
  if (global.degraded) return { ok: true, aiAllowed: false, aiNotice: AI_SKIPPED_STORE };
  if (!global.allowed) {
    logEvent("global_llm_cap", { status: route });
    return { ok: true, aiAllowed: false, aiNotice: AI_SKIPPED_GLOBAL };
  }
  return { ok: true, aiAllowed: true };
}

export const llmConfigured = (env: Record<string, string | undefined>) => Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL);
