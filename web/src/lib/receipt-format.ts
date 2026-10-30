// Signed check receipt: the format, canonical JSON and wording. Client-safe (used by /verify in the browser).
// A receipt records what ScamLens reported for one check. It contains no raw text: identifiers are masked,
// findings carry no quotes, and the checked text appears only as an HMAC digest (see receipts.ts).
import { z } from "zod";

export const RECEIPT_VERSION = 1;
export const RECEIPT_KEY_PATH = "/.well-known/scamlens-receipt-key.json";
export const MAX_RECEIPT_BODY_CHARS = 20_000;

const Finding = z.object({
  tier: z.enum(["verified", "reported", "suspected"]),
  kind: z.string().max(80),
  title: z.string().max(300),
  source: z.string().max(120),
  asOf: z.string().max(40),
  link: z.string().max(300),
});

export const ReceiptBody = z.object({
  version: z.literal(RECEIPT_VERSION),
  keyId: z.string().regex(/^[0-9a-f]{16}$/),
  issuedAt: z.string().max(40),
  build: z.string().max(16),
  riskLevel: z.enum(["low", "elevated", "high"]),
  mode: z.enum(["rules-only", "rules+AI"]),
  tiers: z.object({ verified: z.array(Finding), reported: z.array(Finding), suspected: z.array(Finding) }),
  notices: z.array(z.string().max(400)),
  coverage: z.array(z.object({ source: z.string().max(80), status: z.string().max(40), when: z.string().max(60) })),
  identifiers: z.array(z.object({ type: z.string().max(20), display: z.string().max(80) })),
  /** Link graph row from the check's scam trail (final round P5). Optional and additive: receipts issued before it
   * have no such field and still verify, because canonical JSON leaves absent fields out of the signed bytes. */
  graph: z.object({ status: z.string().max(60), when: z.string().max(80) }).optional(),
  textDigest: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ReceiptBody = z.infer<typeof ReceiptBody>;

export const Receipt = ReceiptBody.extend({ signature: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/) });
export type Receipt = z.infer<typeof Receipt>;

export const ReceiptKey = z.object({ keyId: z.string(), alg: z.literal("Ed25519"), publicKey: z.string(), format: z.literal("raw-base64url") });
export type ReceiptKey = z.infer<typeof ReceiptKey>;

/** Deterministic JSON: object keys sorted at every level, arrays kept in order, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** The bytes that are signed: the canonical JSON of the receipt without its signature. */
export function signedBytes(r: ReceiptBody | Receipt): Uint8Array {
  const { signature: _omit, ...body } = r as Receipt;
  void _omit;
  return new TextEncoder().encode(canonicalJson(body));
}

/** Short code printed in the evidence pack: the first 12 characters of the signature. */
export const receiptCode = (r: Pick<Receipt, "signature">) => r.signature.slice(0, 12);

export const validMessage = (issuedAt: string) =>
  `Signature valid: ScamLens produced this receipt at ${issuedAt} and it has not been altered. It shows what ScamLens reported then, not that the chat was genuine.`;
export const INVALID_MESSAGE = "Signature not valid: this receipt was not produced by ScamLens with the published key, or it has been changed.";
