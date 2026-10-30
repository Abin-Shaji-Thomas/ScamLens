import { connection } from "next/server";
import { dbFromEnv } from "@/lib/reports/db";
import { statsResponse } from "@/lib/graph/stats";
import { logEvent } from "@/lib/log";
import { guardRequest, usageStore } from "@/lib/usage";

// Live size of the link graph for /about (counts only). Cached 5 minutes here and at the edge; counts against
// the daily graph limit; 404 when no graph answers, so the page simply omits the sentence.
export async function GET(request: Request) {
  await connection();
  const res = await statsResponse(request, { env: process.env, db: dbFromEnv(process.env) }, (h) =>
    guardRequest("graph", h, false, { store: usageStore(), env: process.env }),
  );
  logEvent("graph_stats", { status: res.status });
  return res;
}
