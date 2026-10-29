import { readJsonBody } from "@/lib/body";
import { MAX_IMAGE_BODY_CHARS } from "@/lib/limits";
import { logEvent } from "@/lib/log";
import { PASTE_INSTEAD, SCREENSHOT_OFF, transcribeImage, TranscribeRequest, visionConfigured } from "@/lib/transcribe";
import { AI_SKIPPED_GLOBAL, guardRequest, secondsUntilReset, usageStore } from "@/lib/usage";

export const maxDuration = 30;

const fail = (status: number, error: string, headers: Record<string, string> = {}) =>
  Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

// Reads the text in a screenshot. The image and the transcript are never stored or logged.
export async function POST(request: Request) {
  const t0 = Date.now();
  const body = await readJsonBody(request, TranscribeRequest, MAX_IMAGE_BODY_CHARS, "That image is too large. Please use a smaller screenshot.");
  if (!body.ok) return body.response;
  if (!visionConfigured(process.env)) return fail(503, SCREENSHOT_OFF);

  const guard = await guardRequest("transcribe", request.headers, true, { store: usageStore(), env: process.env });
  if (!guard.ok) return guard.response;
  if (!guard.aiAllowed) {
    logEvent("transcribe", { status: "ai_skipped" });
    return guard.aiNotice === AI_SKIPPED_GLOBAL
      ? fail(429, "Screenshot reading is paused for today. Please paste the text instead.", { "Retry-After": String(secondsUntilReset()) })
      : fail(503, PASTE_INSTEAD);
  }

  const r = await transcribeImage(body.data, { env: process.env });
  logEvent("transcribe", { status: r.ok ? "ok" : r.status, durationMs: Date.now() - t0 });
  if (!r.ok) return fail(r.status, r.error);
  return Response.json({ ok: true, text: r.text, truncated: r.truncated }, { headers: { "Cache-Control": "no-store" } });
}
