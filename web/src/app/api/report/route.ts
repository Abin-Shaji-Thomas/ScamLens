import { tgConfig } from "@/lib/graph";
import { PayloadBuilder, reportEvidence } from "@/lib/graph/tg-sync";
import { tigerGraphClient } from "@/lib/graph/tigergraph";
import { fingerprintHash } from "@/lib/reports/privacy";
import { ReportRequest } from "@/lib/reports/schema";
import { reportsConfig, requestFingerprintParts, submitReport } from "@/lib/reports/service";

export async function POST(request: Request) {
  const parsed = ReportRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid report", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const cfg = reportsConfig(process.env);
  if (typeof cfg === "string") return Response.json({ ok: false, error: `Reports unavailable (${cfg})` }, { status: 503 });

  const { ip, ua } = requestFingerprintParts(request.headers);
  try {
    const r = await submitReport(parsed.data, fingerprintHash(cfg.pepper, ip, ua), cfg);
    if (!r.ok) return Response.json({ ok: false, error: r.reason }, { status: r.reason === "rate_limited" ? 429 : 400 });

    // Mirror the new links into TigerGraph right away. Postgres stays the source of truth, so a
    // failure here only delays the graph until the next `scripts/tg-setup.ts --load`.
    let graph: "synced" | "not configured" | "sync failed" = "not configured";
    const tg = tgConfig(process.env);
    if (tg && r.nodes.length >= 2) {
      const b = new PayloadBuilder();
      b.report(r.submissionId, reportEvidence(parsed.data.category, new Date()), false, r.nodes);
      graph = await tigerGraphClient({ ...tg, timeoutMs: 4000 })
        .upsert(b.p)
        .then(() => "synced" as const)
        .catch(() => "sync failed" as const);
    }
    return Response.json({ ok: true, stored: r.stored, graph });
  } catch {
    return Response.json({ ok: false, error: "Reports unavailable (database error)" }, { status: 503 });
  }
}
