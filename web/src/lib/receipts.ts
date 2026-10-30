// Signed check receipts (server only). Ed25519 via node:crypto; the key comes from RECEIPT_SIGNING_KEY
// (base64 PKCS8 DER, one line). Missing or invalid key = feature off: no receipt, no crash.
import { createHash, createHmac, createPrivateKey, createPublicKey, hkdfSync, sign, verify, type KeyObject } from "node:crypto";
import type { CheckResponse } from "./api-schema";
import { buildCoverage, receiptGraphRow } from "./coverage";
import { maskIdentifier } from "./reports/mask";
import { RECEIPT_VERSION, Receipt, ReceiptBody, signedBytes, type ReceiptKey } from "./receipt-format";

export interface ReceiptSigner {
  privateKey: KeyObject;
  publicKey: KeyObject;
  keyId: string;
  digestKey: Buffer;
}

/** Parses the key once per value. Returns null (feature off) for a missing, malformed or non-Ed25519 key. */
export function loadSigner(env: Record<string, string | undefined>): ReceiptSigner | null {
  const b64 = (env.RECEIPT_SIGNING_KEY ?? "").trim();
  if (!b64) return null;
  try {
    const der = Buffer.from(b64, "base64");
    const privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    const publicKey = createPublicKey(privateKey);
    const spki = publicKey.export({ format: "der", type: "spki" });
    const keyId = createHash("sha256").update(spki).digest("hex").slice(0, 16);
    // A separate key for the text digest, derived from the signing key (HKDF-SHA256), so the digest reveals nothing.
    const digestKey = Buffer.from(hkdfSync("sha256", der, Buffer.from("scamlens-receipt"), Buffer.from("text-digest v1"), 32));
    return { privateKey, publicKey, keyId, digestKey };
  } catch {
    return null;
  }
}

export const receiptsConfigured = (env: Record<string, string | undefined>) => loadSigner(env) !== null;

/** Same normalisation as the check input (trimmed), plus Unicode NFC and collapsed whitespace. */
export const normaliseForDigest = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

export function textDigest(text: string, signer: ReceiptSigner): string {
  return createHmac("sha256", signer.digestKey).update(normaliseForDigest(text)).digest("hex");
}

/** Links without the identifier in them (explorer links carry the full address). */
const sourceLink = (link: string) => {
  try {
    const u = new URL(link);
    return /\/(address|#\/address)\//.test(u.pathname + u.hash) ? u.origin : link;
  } catch {
    return "";
  }
};

const STATUS = { match: "match", no_match: "not listed", info: "on-chain facts", unavailable: "unavailable" } as const;

export function buildReceiptBody(r: CheckResponse, text: string, signer: ReceiptSigner, opts: { build: string; issuedAt: string }): ReceiptBody {
  const verified = r.verified.map((v) => ({
    tier: "verified" as const,
    kind: STATUS[v.status],
    title: `${STATUS[v.status]} · ${v.sourceName} · ${v.identifier.type} ${maskIdentifier(v.identifier.type, v.identifier.value)}`,
    source: v.sourceName,
    asOf: v.dataAsOf ?? v.checkedAt,
    link: sourceLink(v.link),
  }));
  const reported = r.reported.entries.map((e) => ({
    tier: "reported" as const,
    kind: e.contested ? "reported (contested, under review)" : "reported",
    title: `${e.display} reported by ${e.reporters} independent people`,
    source: "ScamLens community reports",
    asOf: e.lastReported,
    link: "/about#reports",
  }));
  // Suspected findings name the rule only: quotes are the user's own words and are never put in a receipt.
  const suspected = r.suspected.map((s) => ({
    tier: "suspected" as const,
    kind: s.context === "warning" ? `${s.rule_id} (warning context, not counted)` : s.rule_id,
    title: s.label,
    source: s.source === "ai" ? "AI, quote verified" : "fixed pattern",
    asOf: r.checkedAt,
    link: `/patterns#${s.rule_id}`,
  }));
  return ReceiptBody.parse({
    version: RECEIPT_VERSION,
    keyId: signer.keyId,
    issuedAt: opts.issuedAt,
    build: opts.build,
    riskLevel: r.risk.level,
    mode: r.ai.status === "ok" ? "rules+AI" : "rules-only",
    tiers: { verified, reported, suspected },
    notices: r.notices,
    coverage: buildCoverage(r).rows.map((c) => ({ source: c.name, status: c.status, when: c.when ?? "" })),
    identifiers: r.identifiers.map((i) => ({ type: i.type, display: maskIdentifier(i.type, i.value) })),
    graph: receiptGraphRow(r),
    textDigest: textDigest(text, signer),
  });
}

export function signReceipt(body: ReceiptBody, signer: ReceiptSigner): Receipt {
  const signature = sign(null, signedBytes(body), signer.privateKey).toString("base64url");
  return Receipt.parse({ ...body, signature });
}

/** Builds and signs; null when the feature is off. Never throws into the check. */
export function receiptFor(r: CheckResponse, text: string, env: Record<string, string | undefined>, build: string): Receipt | null {
  const signer = loadSigner(env);
  if (!signer) return null;
  try {
    return signReceipt(buildReceiptBody(r, text, signer, { build, issuedAt: r.checkedAt }), signer);
  } catch {
    return null;
  }
}

export type VerifyResult = { valid: true; issuedAt: string; textMatches?: boolean } | { valid: false; reason: "malformed" | "wrong key" | "bad signature" | "receipts off" };

export function verifyReceipt(input: unknown, env: Record<string, string | undefined>, originalText?: string): VerifyResult {
  const signer = loadSigner(env);
  if (!signer) return { valid: false, reason: "receipts off" };
  const parsed = Receipt.safeParse(input);
  if (!parsed.success) return { valid: false, reason: "malformed" };
  const r = parsed.data;
  if (r.keyId !== signer.keyId) return { valid: false, reason: "wrong key" };
  const ok = verify(null, signedBytes(r), signer.publicKey, Buffer.from(r.signature, "base64url"));
  if (!ok) return { valid: false, reason: "bad signature" };
  return originalText === undefined ? { valid: true, issuedAt: r.issuedAt } : { valid: true, issuedAt: r.issuedAt, textMatches: textDigest(originalText, signer) === r.textDigest };
}

/** The published public key (raw 32 bytes, base64url) with its id; null when receipts are off. */
export function publicKeyDoc(env: Record<string, string | undefined>): ReceiptKey | null {
  const signer = loadSigner(env);
  if (!signer) return null;
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  return { keyId: signer.keyId, alg: "Ed25519", publicKey: spki.subarray(spki.length - 32).toString("base64url"), format: "raw-base64url" };
}

/** Response for /.well-known/scamlens-receipt-key.json (404 when receipts are off). */
export function keyResponse(env: Record<string, string | undefined>): Response {
  const doc = publicKeyDoc(env);
  if (!doc) return Response.json({ ok: false, error: "Receipts are not enabled on this deployment." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(doc, { headers: { "Cache-Control": "public, max-age=300" } });
}
