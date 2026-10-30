// Live size of the link graph for /about: TigerGraph's built-in statistics for graph ScamLens, or the same counts
// from the Postgres copy (the payload tg-setup loads) when TigerGraph is unavailable. Counts only: no ids, no labels.
import { z } from "zod";
import type { Db } from "../reports/db";
import { tgConfig } from "./index";
import { buildFullPayload } from "./tg-sync";
import { tigerGraphClient } from "./tigergraph";

import { GraphStats } from "./stats-schema";

export { GraphStats } from "./stats-schema";

const StatRows = z.object({ results: z.array(z.object({ count: z.number().int().nonnegative() })) });
export const STATS_CACHE_MS = 5 * 60 * 1000;

export interface StatsDeps {
  env: Record<string, string | undefined>;
  db: Db | null;
  now?: () => Date;
  fetch?: typeof fetch;
}

async function fromTigerGraph(deps: StatsDeps): Promise<Omit<GraphStats, "asOf">> {
  const cfg = tgConfig(deps.env);
  if (!cfg) throw new Error("TigerGraph not configured");
  const c = tigerGraphClient({ ...cfg, timeoutMs: 8000, fetch: deps.fetch });
  const stat = async (fn: string) =>
    StatRows.parse(await c.request(`/restpp/builtins/${encodeURIComponent(cfg.graph)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ function: fn, type: "*" }) })).results.reduce((n, r) => n + r.count, 0);
  return { backend: "tigergraph", vertices: await stat("stat_vertex_number"), edges: await stat("stat_edge_number") };
}

async function fromPostgres(deps: StatsDeps): Promise<Omit<GraphStats, "asOf">> {
  if (!deps.db) throw new Error("database not configured");
  const counts = (await buildFullPayload(deps.db)).counts();
  return { backend: "postgres", vertices: counts.vertices, edges: counts.edges };
}

/** Body of GET /api/graph/stats (the route adds connection()). Graph daily limit, 404 when nothing answers. */
export async function statsResponse(
  request: Request,
  deps: StatsDeps,
  guard: (headers: Headers) => Promise<{ ok: true } | { ok: false; response: Response }>,
): Promise<Response> {
  const g = await guard(request.headers);
  if (!g.ok) return g.response;
  const stats = await graphStats(deps);
  if (!stats) return Response.json({ ok: false, error: "Graph statistics are not available right now." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(stats, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}

let cache: { at: number; value: GraphStats | null } | null = null;
export const resetGraphStatsCacheForTests = () => (cache = null);

/** TigerGraph first, Postgres on failure, null when neither answers. Cached for 5 minutes (including a null). */
export async function graphStats(deps: StatsDeps): Promise<GraphStats | null> {
  const now = deps.now?.() ?? new Date();
  if (cache && now.getTime() - cache.at < STATS_CACHE_MS) return cache.value;
  let value: GraphStats | null = null;
  for (const source of [fromTigerGraph, fromPostgres]) {
    try {
      value = GraphStats.parse({ ...(await source(deps)), asOf: now.toISOString() });
      break;
    } catch {
      /* try the next source */
    }
  }
  cache = { at: now.getTime(), value };
  return value;
}
