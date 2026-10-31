// 7-day total of checks for /about, summed from the abuse guard's daily counters (db/schema.sql usage_counters).
// Only allowed checks are counted there (a denied call is not), and only the total leaves the server.
import type { Db, UsageRow } from "./reports/db";
import { USAGE_STATS_DAYS, type UsageStats } from "./usage-stats-schema";

export { UsageStats, usageStatsSentence, USAGE_STATS_DAYS } from "./usage-stats-schema";

export const USAGE_STATS_CACHE_MS = 10 * 60 * 1000;
const CHECK_KEY = /^fp:[0-9a-f]+:check$/; // per-fingerprint check counters; "global:llm" and other routes are excluded

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** First UTC day of the window: today and the 6 days before it. */
export function windowStart(now: Date): string {
  return utcDay(new Date(now.getTime() - (USAGE_STATS_DAYS - 1) * 86_400_000));
}

export function sumChecks(rows: UsageRow[], now: Date): number {
  const from = windowStart(now);
  const to = utcDay(now);
  return rows.filter((r) => CHECK_KEY.test(r.key) && r.day >= from && r.day <= to).reduce((n, r) => n + Math.max(0, Number(r.count) || 0), 0);
}

export interface UsageStatsDeps {
  db: Db | null;
  now?: () => Date;
}

let cache: { at: number; value: UsageStats | null } | null = null;
export const resetUsageStatsCacheForTests = () => (cache = null);

/** Null when there is no database or the read fails. Cached for 10 minutes (including a null). */
export async function usageStats(deps: UsageStatsDeps): Promise<UsageStats | null> {
  const now = deps.now?.() ?? new Date();
  if (cache && now.getTime() - cache.at < USAGE_STATS_CACHE_MS) return cache.value;
  let value: UsageStats | null = null;
  if (deps.db) {
    try {
      value = { checks: sumChecks(await deps.db.usageRowsSince(windowStart(now)), now), days: USAGE_STATS_DAYS };
    } catch {
      value = null;
    }
  }
  cache = { at: now.getTime(), value };
  return value;
}

/** Body of GET /api/usage-stats (the route adds connection()). 404 when there is no total, so /about omits the line. */
export async function usageStatsResponse(deps: UsageStatsDeps): Promise<Response> {
  const stats = await usageStats(deps);
  if (!stats) return Response.json({ ok: false, error: "Usage statistics are not available right now." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(stats, { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } });
}
