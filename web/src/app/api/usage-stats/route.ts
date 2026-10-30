import { connection } from "next/server";
import { logEvent } from "@/lib/log";
import { dbFromEnv } from "@/lib/reports/db";
import { usageStatsResponse } from "@/lib/usage-stats";

// 7-day check total for /about (one number, no keys). Cached 5 minutes here and at the edge, so it adds at most one
// database read per instance every 5 minutes; 404 when there is no total, so the page simply omits the sentence.
export async function GET() {
  await connection();
  const res = await usageStatsResponse({ db: dbFromEnv(process.env) });
  logEvent("usage_stats", { status: res.status });
  return res;
}
