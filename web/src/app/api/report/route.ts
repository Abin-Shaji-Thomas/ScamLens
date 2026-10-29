import { readJsonBody } from "@/lib/body";
import { tgConfig } from "@/lib/graph";
import { PayloadBuilder, reportEvidence } from "@/lib/graph/tg-sync";
import { tigerGraphClient } from "@/lib/graph/tigergraph";
import { logEvent } from "@/lib/log";
import { fingerprintHash } from "@/lib/reports/privacy";
import { ReportRequest } from "@/lib/reports/schema";
import { reportsConfig, requestIp, submitReport } from "@/lib/reports/service";

export async function POST(request: Request) {
  const body = await readJsonBody(request, ReportRequest);
  if (!body.ok) return body.response;
  const cfg = reportsConfig(process.env);
  if (typeof cfg === "string") return Response.json({ ok: false, error: `Reports unavailable (${cfg})` }, { status: 503 });

  try {
    const r = await submitReport(body.data, fingerprintHash(cfg.pepper, requestIp(request.headers)), cfg);
    if (!r.ok) {
      logEvent("report", { status: r.reason === "rate_limited" ? "rate_limited" : "rejected" });
      return Response.json({ ok: false, error: r.reason }, { status: r.reason === "rate_limited" ? 429 : 400 });
    }

    // Mirror the new links into TigerGraph right away. Postgres stays the source of truth, so a
    // failure here only delays the graph until the next `scripts/tg-setup.ts --load`.
    let graph: "synced" | "not configured" | "sync failed" = "not configured";
    const tg = tgConfig(process.env);
    if (tg && r.nodes.length >= 2) {
      const b = new PayloadBuilder();
      b.report(r.submissionId, reportEvidence(body.data.category, new Date()), false, r.nodes, r.reporterKey);
      graph = await tigerGraphClient({ ...tg, timeoutMs: 4000 })
        .upsert(b.p)
        .then(() => "synced" as const)
        .catch(() => "sync failed" as const);
    }
    logEvent("report", { status: `ok_${graph.replace(" ", "_")}` });
    return Response.json({ ok: true, stored: r.stored, graph });
  } catch {
    logEvent("report", { status: "db_error" });
    return Response.json({ ok: false, error: "Reports unavailable (database error)" }, { status: 503 });
  }
}
