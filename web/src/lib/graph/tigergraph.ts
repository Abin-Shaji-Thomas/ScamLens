// TigerGraph 4.x / Savanna REST client (endpoints per docs.tigergraph.com, TigerGraph Server 4.x):
//   POST /gsql/v1/tokens {secret}         -> bearer token (falls back to "Authorization: GSQL-Secret")
//   GET  /restpp/query/{graph}/{query}    -> run an installed query
//   POST /restpp/graph/{graph}            -> upsert vertices/edges
//   POST /gsql/v1/statements (text/plain) -> run GSQL (schema)   ; POST /gsql/v1/queries, GET /gsql/v1/queries/install
import { z } from "zod";
import { Q1Row, Q2Row, Q3Row, Q4Edge, VERTEX_TYPE, type GraphBackend, type LinkQuery, type LinkResult } from "./types";

export interface TgConfig {
  host: string; // https://<workspace>.i.tgcloud.io (port 443 on Savanna)
  graph: string;
  secret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class TigerGraphError extends Error {}

const QUERY_NAMES: Record<LinkQuery["kind"], string> = {
  q1: "q1_upi_wallet_telegram",
  q2: "q2_payment_to_flagged",
  q3: "q3_telegram_clusters",
  q4: "q4_neighbourhood",
};

const Envelope = z.object({ error: z.boolean().optional(), message: z.string().optional(), results: z.unknown().optional() });
const TokenResp = z.union([
  z.object({ token: z.string() }),
  z.object({ results: z.object({ token: z.string() }) }),
]);

// Raw TigerGraph row shapes (tuples cannot hold lists, so Q2 paths and Q3 handles are flattened).
const Q2Flat = z.object({
  hops: z.number().int(),
  p0: z.string(), p1: z.string(), p2: z.string(),
  d0: z.string(), d1: z.string(), d2: z.string(),
  flagged_source: z.string(),
  e1: z.string(), e2: z.string(),
});
const Q3Flat = z.object({ wallet: z.string(), wallet_hash: z.string(), cluster_size: z.number().int(), reports: z.number().int() });
const Q3Result = z.object({ rows: z.array(Q3Flat), handles: z.record(z.string(), z.array(z.string())).optional() });
const RowsResult = z.object({ rows: z.array(z.unknown()) });

export function tigerGraphClient(cfg: TgConfig) {
  const f = cfg.fetch ?? fetch;
  const timeout = cfg.timeoutMs ?? 8000;
  let auth: { header: string; at: number } | undefined;

  async function authHeader(): Promise<string> {
    if (auth && Date.now() - auth.at < 6 * 24 * 3600 * 1000) return auth.header;
    let header = `GSQL-Secret ${cfg.secret}`;
    try {
      const res = await f(`${cfg.host}/gsql/v1/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: cfg.secret, graph: cfg.graph }),
        signal: AbortSignal.timeout(timeout),
      });
      const parsed = res.ok ? TokenResp.safeParse(await res.json()) : null;
      if (parsed?.success) header = `Bearer ${"token" in parsed.data ? parsed.data.token : parsed.data.results.token}`;
    } catch {
      // Token endpoint unavailable: the secret itself is accepted as "GSQL-Secret" on 4.x.
    }
    auth = { header, at: Date.now() };
    return header;
  }

  async function request(path: string, init: RequestInit = {}, timeoutMs = timeout): Promise<unknown> {
    const res = await f(`${cfg.host}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: await authHeader() },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: !res.ok, message: text.slice(0, 300), results: text };
    }
    const env = Envelope.safeParse(body);
    if (!res.ok || (env.success && env.data.error)) {
      const msg = env.success ? env.data.message : undefined;
      throw new TigerGraphError(`TigerGraph ${path.split("?")[0]} failed (HTTP ${res.status})${msg ? `: ${msg.slice(0, 200)}` : ""}`);
    }
    return body;
  }

  return {
    request,
    /** Run GSQL text (e.g. the schema) through the GSQL server. */
    statements: (gsql: string) => request("/gsql/v1/statements", { method: "POST", headers: { "Content-Type": "text/plain" }, body: gsql }, 600_000),
    createQuery: (gsql: string) =>
      request(`/gsql/v1/queries?graph=${encodeURIComponent(cfg.graph)}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: gsql }, 120_000),
    installQueries: (names: string[]) =>
      request(`/gsql/v1/queries/install?graph=${encodeURIComponent(cfg.graph)}&queries=${names.map(encodeURIComponent).join(",")}`, { method: "GET" }, 900_000),
    upsert: (payload: unknown) =>
      request(`/restpp/graph/${encodeURIComponent(cfg.graph)}?vertex_must_exist=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 60_000),
    runQuery: (name: string, params: URLSearchParams) =>
      request(`/restpp/query/${encodeURIComponent(cfg.graph)}/${name}?${params}`, { method: "GET" }),
    echo: () => request("/restpp/echo", { method: "GET" }),
  };
}

export function queryParams(q: LinkQuery, hubMax: number): URLSearchParams {
  const p = new URLSearchParams({ hub_max: String(hubMax) });
  if (q.kind === "q1") p.set("upi", q.upiHash);
  if (q.kind === "q2") p.set("wallet", q.walletHash);
  if (q.kind === "q3") p.set("min_size", String(q.minSize));
  if (q.kind === "q4") {
    p.set("center", q.hash);
    p.set("center.type", VERTEX_TYPE[q.idType]); // untyped VERTEX parameter: id + type
    p.set("depth", String(q.depth));
  }
  return p;
}

/** Map a TigerGraph query response to the same row shapes the Postgres backend returns. */
export function mapResult<Q extends LinkQuery>(q: Q, body: unknown): LinkResult<Q> {
  const results = z.array(z.unknown()).parse(Envelope.parse(body).results);
  const first = results[0] ?? { rows: [] };
  switch (q.kind) {
    case "q1":
      return z.array(Q1Row).parse(RowsResult.parse(first).rows) as LinkResult<Q>;
    case "q2":
      return z
        .array(Q2Flat)
        .parse(RowsResult.parse(first).rows)
        .map((r) =>
          Q2Row.parse({
            hops: r.hops,
            path: [r.p0, r.p1, r.p2].slice(0, r.hops + 1),
            path_display: [r.d0, r.d1, r.d2].slice(0, r.hops + 1),
            flagged_source: r.flagged_source,
            evidence: [r.e1, r.e2].slice(0, r.hops),
          }),
        ) as LinkResult<Q>;
    case "q3": {
      const r = Q3Result.parse(first);
      return r.rows.map((x) =>
        Q3Row.parse({ ...x, handles: [...(r.handles?.[x.wallet_hash] ?? [])].sort() }),
      ) as LinkResult<Q>;
    }
    default:
      return z.array(Q4Edge).parse(RowsResult.parse(first).rows) as LinkResult<Q>;
  }
}

// A vertex id that was never loaded is "no links", not an outage. This is TigerGraph's exact wording
// (observed on Savanna 2026-10-29). Keep it narrow: "Endpoint is not found" (wrong graph name, query
// not installed) must stay an error so the view falls back to Postgres instead of showing no links.
const MISSING_VERTEX = /Failed to convert user vertex id for parameter/;

export function tigerGraphBackend(cfg: TgConfig): GraphBackend {
  const client = tigerGraphClient(cfg);
  return {
    name: "tigergraph",
    async run<Q extends LinkQuery>(q: Q, hubMax: number): Promise<LinkResult<Q>> {
      try {
        return mapResult(q, await client.runQuery(QUERY_NAMES[q.kind], queryParams(q, hubMax)));
      } catch (e) {
        if (e instanceof TigerGraphError && MISSING_VERTEX.test(e.message)) return [] as unknown as LinkResult<Q>;
        throw e;
      }
    },
  };
}

export { QUERY_NAMES };
