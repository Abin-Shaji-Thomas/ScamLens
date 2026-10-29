import { buildGraphView, GraphRequest } from "@/lib/graph/view";
import { dbFromEnv } from "@/lib/reports/db";

export async function POST(request: Request) {
  const parsed = GraphRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const view = await buildGraphView(parsed.data, process.env, dbFromEnv(process.env));
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
