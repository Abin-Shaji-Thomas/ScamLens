import { CheckRequest } from "@/lib/api-schema";
import { readJsonBody } from "@/lib/body";
import { runCheck } from "@/lib/check";
import { logEvent } from "@/lib/log";
import { guardRequest, llmConfigured, usageStore } from "@/lib/usage";
import { defaultDeps } from "@/lib/verified/types";

// Etherscan lookups are rate-limited (~8 s for one wallet); leave headroom.
export const maxDuration = 30;

export async function POST(request: Request) {
  const t0 = Date.now();
  const body = await readJsonBody(request, CheckRequest);
  if (!body.ok) return body.response;
  // Limits run before any external or LLM call; over the limit nothing else happens.
  const guard = await guardRequest("check", request.headers, llmConfigured(process.env), { store: usageStore(), env: process.env });
  if (!guard.ok) return guard.response;
  try {
    const result = await runCheck(body.data, { ...defaultDeps(), skipAi: guard.aiNotice });
    logEvent("check", { status: result.risk.level, durationMs: Date.now() - t0 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logEvent("check", { status: "error", durationMs: Date.now() - t0 });
    return Response.json({ ok: false, error: "The check failed. Please try again." }, { status: 500 });
  }
}
