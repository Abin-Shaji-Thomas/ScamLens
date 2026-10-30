// Bodies of POST /api/case, /api/case/delete and /api/feedback (the route files add nothing else), kept here so tests
// can call them with a database and environment of their choosing. Responses never echo the input or the excerpt.
import { readJsonBody } from "../body";
import { tgConfig } from "../graph";
import { PayloadBuilder, reportEvidence } from "../graph/tg-sync";
import { tigerGraphClient } from "../graph/tigergraph";
import { logEvent } from "../log";
import type { Db } from "../reports/db";
import { fingerprintHash } from "../reports/privacy";
import { reportsConfig, requestIp } from "../reports/service";
import { guardRequest, usageStore, type GuardDeps } from "../usage";
import { CASES_UNAVAILABLE, CaseRequest, DeleteCaseRequest, FeedbackRequest } from "./schema";
import { deleteCase, submitCase, submitFeedback } from "./service";

export const CASE_BODY_MAX_CHARS = 8_000;
const TOO_LARGE = "That is too long. Please keep the excerpt short.";

export interface RouteDeps {
  env: Record<string, string | undefined>;
  db?: Db | null;
  guard?: GuardDeps;
  now?: () => Date;
}

const unavailable = () => Response.json({ ok: false, error: CASES_UNAVAILABLE }, { status: 503, headers: { "Cache-Control": "no-store" } });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function caseResponse(request: Request, deps: RouteDeps): Promise<Response> {
  const g = await guardRequest("case", request.headers, false, deps.guard ?? { store: usageStore(deps.env), env: deps.env });
  if (!g.ok) return g.response;
  const body = await readJsonBody(request, CaseRequest, CASE_BODY_MAX_CHARS, TOO_LARGE);
  if (!body.ok) return body.response;
  const cfg = reportsConfig(deps.env, deps.db);
  if (typeof cfg === "string") return unavailable();
  const r = await submitCase(body.data, fingerprintHash(cfg.pepper, requestIp(request.headers)), cfg, { now: deps.now?.() });
  if (!r.ok) {
    logEvent("case", { status: r.reason === "cases_unavailable" ? "unavailable" : r.reason === "rate_limited" ? "rate_limited" : "rejected" });
    if (r.reason === "cases_unavailable") return unavailable();
    return json({ ok: false, error: r.reason }, r.reason === "rate_limited" ? 429 : 400);
  }
  // Same TigerGraph mirror as a report; Postgres stays the source of truth.
  let graph: "synced" | "not configured" | "sync failed" = "not configured";
  const tg = tgConfig(deps.env);
  if (tg && r.nodes.length >= 2) {
    const b = new PayloadBuilder();
    b.report(r.submissionId, reportEvidence(body.data.category, new Date()), false, r.nodes, r.reporterKey);
    graph = await tigerGraphClient({ ...tg, timeoutMs: 4000 })
      .upsert(b.p)
      .then(() => "synced" as const)
      .catch(() => "sync failed" as const);
  }
  logEvent("case", { status: `ok_${graph.replace(" ", "_")}` });
  // The delete code is returned exactly once; only its HMAC is stored.
  return json({ ok: true, stored: r.stored, graph, deleteCode: r.deleteCode });
}

export async function deleteCaseResponse(request: Request, deps: RouteDeps): Promise<Response> {
  const g = await guardRequest("case", request.headers, false, deps.guard ?? { store: usageStore(deps.env), env: deps.env });
  if (!g.ok) return g.response;
  const body = await readJsonBody(request, DeleteCaseRequest, 500, TOO_LARGE);
  if (!body.ok) return body.response;
  const cfg = reportsConfig(deps.env, deps.db);
  if (typeof cfg === "string") return unavailable();
  const r = await deleteCase(body.data, cfg);
  logEvent("case_delete", { status: r.ok ? (r.deleted ? "deleted" : "no_match") : "unavailable" });
  if (!r.ok) return unavailable();
  return json({ ok: true, deleted: r.deleted, reportsRemoved: r.reportsRemoved });
}

export async function feedbackResponse(request: Request, deps: RouteDeps): Promise<Response> {
  const g = await guardRequest("feedback", request.headers, false, deps.guard ?? { store: usageStore(deps.env), env: deps.env });
  if (!g.ok) return g.response;
  const body = await readJsonBody(request, FeedbackRequest, 4_000, TOO_LARGE);
  if (!body.ok) return body.response;
  const cfg = reportsConfig(deps.env, deps.db);
  if (typeof cfg === "string") return unavailable();
  const r = await submitFeedback(body.data, fingerprintHash(cfg.pepper, requestIp(request.headers)), cfg);
  logEvent("feedback", { status: r.ok ? "ok" : r.reason === "cases_unavailable" ? "unavailable" : "rejected" });
  if (!r.ok) return r.reason === "cases_unavailable" ? unavailable() : json({ ok: false, error: r.reason }, 400);
  return json({ ok: true, stored: r.stored });
}
