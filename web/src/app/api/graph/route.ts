import { readJsonBody } from "@/lib/body";
import { buildGraphView, GraphRequest } from "@/lib/graph/view";
import { logEvent } from "@/lib/log";
import { dbFromEnv } from "@/lib/reports/db";

export async function POST(request: Request) {
  const t0 = Date.now();
  const body = await readJsonBody(request, GraphRequest);
  if (!body.ok) return body.response;
  const view = await buildGraphView(body.data, process.env, dbFromEnv(process.env));
  logEvent("graph", { status: `${view.status}:${view.backend ?? "none"}`.replace(/[^A-Za-z0-9_.:-]/g, "_"), durationMs: Date.now() - t0 });
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
