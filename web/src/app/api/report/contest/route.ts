import { ContestRequest } from "@/lib/reports/schema";
import { contestIdentifier, reportsConfig } from "@/lib/reports/service";

// Contesting hides an identifier from public "Reported" badges until a human reviews it.
export async function POST(request: Request) {
  const parsed = ContestRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const cfg = reportsConfig(process.env);
  if (typeof cfg === "string") return Response.json({ ok: false, error: `Reports unavailable (${cfg})` }, { status: 503 });
  try {
    const r = await contestIdentifier(parsed.data, cfg);
    if (!r.ok) return Response.json({ ok: false, error: r.reason }, { status: 400 });
    return Response.json({ ok: true, message: "Thank you. This entry is hidden from public badges until reviewed." });
  } catch {
    return Response.json({ ok: false, error: "Reports unavailable (database error)" }, { status: 503 });
  }
}
