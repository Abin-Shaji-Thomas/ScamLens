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
    return Response.json({ ok: true, stored: r.stored });
  } catch {
    return Response.json({ ok: false, error: "Reports unavailable (database error)" }, { status: 503 });
  }
}
