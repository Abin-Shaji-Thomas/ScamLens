// Scam trail job for a check: runs next to the other sources, with a hard deadline, and never blocks the card.
// TigerGraph first, the Postgres copy as the labelled fallback. Counts only: no full identifier leaves the server.
import type { Identifier } from "../extract/types";
import { hubMax, tgConfig } from "../graph";
import { postgresBackend } from "../graph/postgres";
import { tigerGraphBackend } from "../graph/tigergraph";
import type { GraphBackend, Q4Edge } from "../graph/types";
import type { Db } from "../reports/db";
import { identifierHash, maskIdentifier } from "../reports/privacy";
import { uniqueIdentifiers } from "../identifiers";
import { withTimeout } from "../verified/http";
import { MAX_TRAIL_IDENTIFIERS, TRAIL_CONCURRENCY, TRAIL_TIMEOUT_MS, TRAIL_TYPES, type Trail, type TrailEntry, type TrailSummary } from "./schema";

export interface TrailDeps {
  env: Record<string, string | undefined>;
  db: Db | null;
  timeoutMs?: number;
  /** Tests: a backend to use instead of TigerGraph (the Postgres fallback still applies on failure). */
  backend?: GraphBackend;
  now?: () => number;
}

type CountRow = { identifier_hash: string; reporters: number; contested?: boolean; synthetic: boolean; categories: string[]; first_reported: string | Date; last_reported: string | Date };
type ClusterRow = { cases: number; reporters: number; synthetic_cases: number; real_cases: number; categories: Record<string, number>; channels: Record<string, number>; loss_bands: Record<string, number>; months: Record<string, number>; first_seen: string | Date | null; last_seen: string | Date | null };

/** Wallets first, then the other graph types, at most 5 (the rest are not looked up). */
export function pickTrailIdentifiers(ids: Identifier[]): Identifier[] {
  const order = (i: Identifier) => TRAIL_TYPES.indexOf(i.type);
  return uniqueIdentifiers(ids)
    .filter((i) => order(i) >= 0)
    .sort((a, b) => order(a) - order(b))
    .slice(0, MAX_TRAIL_IDENTIFIERS);
}

async function mapLimit<T, R>(items: T[], limit: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]);
      }
    }),
  );
  return out;
}

const sorted = (o: Record<string, number> | undefined) =>
  Object.entries(o ?? {})
    .map(([key, n]) => ({ key, n: Number(n) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
const day = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

let flaggedCache: { at: number; set: Set<string> } | null = null;
export const resetTrailCacheForTests = () => {
  flaggedCache = null;
  tgShared = null;
};

// One TigerGraph client per server instance, so its token is fetched once, not on every check.
let tgShared: { key: string; backend: GraphBackend } | null = null;
function sharedTigerGraph(tg: NonNullable<ReturnType<typeof tgConfig>>, timeoutMs: number): GraphBackend {
  const key = [tg.host, tg.graph, timeoutMs].join("|");
  if (tgShared?.key !== key) tgShared = { key, backend: tigerGraphBackend({ ...tg, timeoutMs }) };
  return tgShared.backend;
}
async function flaggedSet(db: Db, now: number): Promise<Set<string>> {
  if (flaggedCache && now - flaggedCache.at < 5 * 60_000) return flaggedCache.set;
  const set = new Set((await db.selectAll<{ address_hash: string }>("flagged_addresses")).map((r) => r.address_hash));
  flaggedCache = { at: now, set };
  return set;
}

async function reportedCounts(db: Db, hashes: string[]): Promise<CountRow[]> {
  if (!hashes.length) return [];
  try {
    return await db.call<CountRow>("reported_counts_v2", { p_hashes: hashes });
  } catch {
    return await db.call<CountRow>("reported_counts", { p_hashes: hashes });
  }
}

/** The trail for the identifiers in a check. Never throws; a failure or the deadline gives status "unavailable". */
export async function runScamTrail(ids: Identifier[], deps: TrailDeps): Promise<Trail> {
  const pepper = deps.env.REPORT_HASH_PEPPER ?? "";
  if (!deps.db || pepper.length < 16) return { status: "off", entries: [] };
  const db = deps.db;
  const picked = pickTrailIdentifiers(ids);
  if (!picked.length) return { status: "ok", entries: [] };
  const clock = deps.now ?? (() => performance.now());
  const t0 = clock();
  const tg = tgConfig(deps.env);
  const primary = deps.backend ?? (tg ? sharedTigerGraph(tg, deps.timeoutMs ?? TRAIL_TIMEOUT_MS) : postgresBackend(db));
  let backendName: string = primary.name;
  const N = hubMax(deps.env);
  const work = async (): Promise<Trail> => {
    const hashed = picked.map((i) => ({ id: i, hash: identifierHash(pepper, i.type, i.value) }));
    // In parallel with the graph queries. If it fails, only the "reaches a verified address" sentence is lost.
    const flaggedP = flaggedSet(db, Date.now()).catch(() => new Set<string>());
    const neighbourhood = (b: GraphBackend) => mapLimit(hashed, TRAIL_CONCURRENCY, (h) => b.run({ kind: "q4", hash: h.hash, depth: 2, idType: h.id.type }, N));
    let edges: Q4Edge[][];
    try {
      edges = await neighbourhood(primary);
    } catch (e) {
      if (primary.name !== "tigergraph") throw e;
      backendName = "postgres (TigerGraph unavailable)";
      edges = await neighbourhood(postgresBackend(db));
    }
    const mine = new Set(hashed.map((h) => h.hash));
    const neighbours = hashed.map((h, i) => new Set(edges[i].flatMap((e) => [e.src, e.dst]).filter((x) => x !== h.hash)));
    const all = [...new Set([...mine, ...neighbours.flatMap((s) => [...s])])];
    const clusterP = clusterRow(db, all); // in parallel with the reported counts
    const [counts, flagged, cluster] = await Promise.all([reportedCounts(db, all), flaggedP, clusterP]);
    const byHash = new Map(counts.map((c) => [c.identifier_hash, c]));
    const entries: TrailEntry[] = hashed.map((h, i) => {
      const linked = [...neighbours[i]];
      const reported = linked.map((x) => byHash.get(x)).filter((c): c is CountRow => !!c && c.reporters >= 2 && !c.contested);
      return {
        type: h.id.type,
        display: maskIdentifier(h.id.type, h.id.value),
        linked: linked.length,
        reportedLinks: reported.length,
        maxLinkedReporters: Math.max(0, ...reported.map((c) => c.reporters)),
        touchesFlagged: [h.hash, ...linked].some((x) => flagged.has(x)),
      };
    });
    const summary = trailSummary(cluster, counts);
    return { status: "ok", backend: backendName, entries, summary };
  };
  try {
    const t = await withTimeout(work(), deps.timeoutMs ?? TRAIL_TIMEOUT_MS);
    return { ...t, elapsedMs: Math.max(0, Math.round(clock() - t0)) };
  } catch (e) {
    return { status: "unavailable", backend: backendName, reason: e instanceof Error && /timed out/.test(e.message) ? "timed out" : "graph query failed", entries: [], elapsedMs: Math.max(0, Math.round(clock() - t0)) };
  }
}

/** Case counts for the whole trail (migration 004); null before the migration or on any error. */
async function clusterRow(db: Db, hashes: string[]): Promise<ClusterRow | null> {
  try {
    const [c] = await db.call<ClusterRow>("case_trail_cluster", { p_hashes: hashes });
    return c ?? null;
  } catch {
    return null;
  }
}

/** Case counts once migration 004 holds cases (each case once); otherwise counts from the reports alone. */
function trailSummary(c: ClusterRow | null, counts: CountRow[]): TrailSummary | undefined {
  {
    if (c && c.cases > 0) {
      return {
        source: "cases", cases: c.cases, reporters: c.reporters, syntheticCases: c.synthetic_cases, realCases: c.real_cases,
        categories: sorted(c.categories), channels: sorted(c.channels), lossBands: sorted(c.loss_bands), months: sorted(c.months),
        firstSeen: day(c.first_seen), lastSeen: day(c.last_seen),
      };
    }
  }
  const shown = counts.filter((c) => c.reporters >= 2);
  if (!shown.length) return undefined;
  const cats: Record<string, number> = {};
  for (const c of shown) for (const k of c.categories) cats[k] = (cats[k] ?? 0) + 1;
  const synthetic = shown.filter((c) => c.synthetic).length;
  const dates = shown.flatMap((c) => [new Date(c.first_reported).getTime(), new Date(c.last_reported).getTime()]);
  return {
    source: "reports", cases: 0, reporters: Math.max(...shown.map((c) => c.reporters)), syntheticCases: synthetic, realCases: shown.length - synthetic,
    categories: sorted(cats), channels: [], lossBands: [], months: [],
    firstSeen: day(new Date(Math.min(...dates))), lastSeen: day(new Date(Math.max(...dates))),
  };
}
