import { z } from "zod";
import { readJsonBody } from "@/lib/body";
import { MAX_TEXT_CHARS } from "@/lib/limits";
import { logEvent } from "@/lib/log";
import { MAX_RECEIPT_BODY_CHARS } from "@/lib/receipt-format";
import { verifyReceipt } from "@/lib/receipts";
import { guardRequest, usageStore } from "@/lib/usage";

// Fallback for browsers without WebCrypto Ed25519, and the only way to check the optional original text
// against the receipt's digest. Size-capped and rate-limited; nothing is stored or logged.
const VerifyRequest = z.object({ receipt: z.unknown(), text: z.string().max(MAX_TEXT_CHARS).optional() });

export async function POST(request: Request) {
  const body = await readJsonBody(request, VerifyRequest, MAX_RECEIPT_BODY_CHARS + MAX_TEXT_CHARS * 2, "That receipt is too large (at most 20 KB).");
  if (!body.ok) return body.response;
  const guard = await guardRequest("verify", request.headers, false, { store: usageStore(), env: process.env });
  if (!guard.ok) return guard.response;
  if (JSON.stringify(body.data.receipt ?? null).length > MAX_RECEIPT_BODY_CHARS) {
    return Response.json({ ok: false, error: "That receipt is too large (at most 20 KB)." }, { status: 413 });
  }
  const r = verifyReceipt(body.data.receipt, process.env, body.data.text);
  logEvent("verify_receipt", { status: r.valid ? "valid" : r.reason.replaceAll(" ", "_") });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
