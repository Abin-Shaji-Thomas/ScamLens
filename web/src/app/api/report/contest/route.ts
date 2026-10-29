import { readJsonBody } from "@/lib/body";
import { logEvent } from "@/lib/log";
import { ContestRequest } from "@/lib/reports/schema";
import { contestIdentifier, reportsConfig } from "@/lib/reports/service";
import { guardRequest, usageStore } from "@/lib/usage";

// Contesting hides an identifier from public "Reported" badges until a human reviews it.
export async function POST(request: Request) {
  const body = await readJsonBody(request, ContestRequest);
  if (!body.ok) return body.response;
  // Contesting hides a badge for everyone, so it is capped per fingerprint per day.
  const guard = await guardRequest("contest", request.headers, false, { store: usageStore(), env: process.env });
  if (!guard.ok) return guard.response;
  const cfg = reportsConfig(process.env);
  if (typeof cfg === "string") return Response.json({ ok: false, error: `Reports unavailable (${cfg})` }, { status: 503 });
  try {
    const r = await contestIdentifier(body.data, cfg);
    if (!r.ok) return Response.json({ ok: false, error: r.reason }, { status: 400 });
    logEvent("contest", { status: "ok" });
    return Response.json({ ok: true, message: "Thank you. This entry is hidden from public badges until reviewed." });
  } catch {
    logEvent("contest", { status: "db_error" });
    return Response.json({ ok: false, error: "Reports unavailable (database error)" }, { status: 503 });
  }
}
