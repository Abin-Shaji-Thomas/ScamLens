import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as keyRoute } from "../app/.well-known/scamlens-receipt-key.json/route";
import { POST as verifyRoute } from "../app/api/verify-receipt/route";
import { CheckResponse } from "./api-schema";
import { runCheck, type RunDeps } from "./check";
import { buildEvidencePack } from "./evidence-pack";
import { getHealth } from "./health";
import { canonicalJson, INVALID_MESSAGE, Receipt, receiptCode, signedBytes, validMessage } from "./receipt-format";
import { buildReceiptBody, keyResponse, loadSigner, publicKeyDoc, receiptFor, signReceipt, textDigest, verifyReceipt } from "./receipts";
import { SAMPLES } from "./samples";

// Tests generate throwaway keys; no real signing key is ever created, read or printed here.
const ephemeralKey = () => generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const offline: RunDeps = {
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-30T10:00:00Z"),
  env: {},
  db: null,
};
const CHAT = "Inspector Rao here: pay the clearance fee to zzdemo.refund@okdemo within 2 hours or face digital arrest. Wallet 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359.";

let env: Record<string, string>;
let receipt: Receipt;
beforeEach(async () => {
  env = { RECEIPT_SIGNING_KEY: ephemeralKey() };
  const r = await runCheck({ text: CHAT }, offline);
  receipt = receiptFor(r, CHAT, env, "abc1234")!;
});

describe("signed check receipts", () => {
  it("sign and verify: a fresh receipt is valid, with the agreed wording", () => {
    expect(receipt).toBeTruthy();
    expect(Receipt.parse(receipt)).toEqual(receipt);
    expect(verifyReceipt(receipt, env)).toEqual({ valid: true, issuedAt: receipt.issuedAt });
    expect(validMessage(receipt.issuedAt)).toBe(
      `Signature valid: ScamLens produced this receipt at ${receipt.issuedAt} and it has not been altered. It shows what ScamLens reported then, not that the chat was genuine.`,
    );
    expect(receipt).toMatchObject({ version: 1, build: "abc1234", mode: "rules-only", riskLevel: expect.any(String) });
  });

  it("tamper detection on every field (each top-level field, and a nested finding)", () => {
    const fields = Object.keys(receipt).filter((k) => k !== "signature") as (keyof Receipt)[];
    expect(fields.length).toBeGreaterThanOrEqual(11);
    for (const k of fields) {
      const t = structuredClone(receipt) as Record<string, unknown>;
      const v = t[k];
      t[k] = typeof v === "number" ? v + 1 : typeof v === "string" ? (k === "riskLevel" ? (v === "high" ? "low" : "high") : k === "textDigest" ? "0".repeat(64) : k === "keyId" ? v : `${v}x`) : Array.isArray(v) ? [...v, v[0] ?? { source: "x", status: "checked", when: "" }] : { ...(v as object), verified: [] };
      if (k === "keyId") continue; // a changed keyId is "wrong key", tested below
      expect(verifyReceipt(t, env).valid, k).toBe(false);
    }
    const nested = structuredClone(receipt);
    nested.tiers.suspected[0].title = "Something else";
    expect(verifyReceipt(nested, env)).toEqual({ valid: false, reason: "bad signature" });
    const sig = structuredClone(receipt);
    sig.signature = (sig.signature[0] === "A" ? "B" : "A") + sig.signature.slice(1);
    expect(verifyReceipt(sig, env).valid).toBe(false);
  });

  it("wrong key: a receipt from another key is rejected", () => {
    expect(verifyReceipt(receipt, { RECEIPT_SIGNING_KEY: ephemeralKey() })).toEqual({ valid: false, reason: "wrong key" });
  });

  it("missing or invalid key: the feature is off cleanly (no receipt, no crash, health false)", async () => {
    const r = await runCheck({ text: CHAT }, offline);
    for (const bad of [{}, { RECEIPT_SIGNING_KEY: "" }, { RECEIPT_SIGNING_KEY: "not-base64!!" }, { RECEIPT_SIGNING_KEY: generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") }]) {
      expect(loadSigner(bad)).toBeNull();
      expect(receiptFor(r, CHAT, bad, "local")).toBeNull();
      expect(getHealth(bad).receipts).toBe(false);
      expect(publicKeyDoc(bad)).toBeNull();
    }
    expect(getHealth(env).receipts).toBe(true);
    expect(CheckResponse.parse(r).receipt).toBeUndefined(); // the response schema accepts it absent
    expect(CheckResponse.parse({ ...r, receipt }).receipt).toEqual(receipt); // and present
  });

  it("no raw text anywhere in a receipt: no quote, no chat words, no full identifier", async () => {
    const r = await runCheck({ text: CHAT }, offline);
    const json = JSON.stringify(receipt);
    for (const s of r.suspected) expect(json).not.toContain(s.quote);
    for (const w of ["Inspector Rao", "clearance fee to", "zzdemo.refund@okdemo", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "face digital arrest"]) expect(json).not.toContain(w);
    expect(receipt.identifiers.map((i) => i.display)).toEqual(expect.arrayContaining(["zz***d@okdemo"]));
    expect(receipt.tiers.verified.every((f) => !/\/address\//.test(f.link))).toBe(true);
  });

  it("text digest: same text (whitespace normalised) matches, any other text does not; keyed, not a plain hash", () => {
    const signer = loadSigner(env)!;
    expect(receipt.textDigest).toBe(textDigest(CHAT, signer));
    expect(textDigest(`  ${CHAT.replace(/ /g, "  ")}\n`, signer)).toBe(receipt.textDigest);
    expect(verifyReceipt(receipt, env, CHAT)).toMatchObject({ valid: true, textMatches: true });
    expect(verifyReceipt(receipt, env, CHAT + " extra")).toMatchObject({ valid: true, textMatches: false });
    expect(textDigest(CHAT, loadSigner({ RECEIPT_SIGNING_KEY: ephemeralKey() })!)).not.toBe(receipt.textDigest);
  });

  it("deterministic canonicalisation: key order does not change the signed bytes", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" } })).toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
    const reordered = Object.fromEntries(Object.entries(receipt).reverse()) as Receipt;
    expect(Buffer.from(signedBytes(reordered)).equals(Buffer.from(signedBytes(receipt)))).toBe(true);
  });

  it("building and signing the same result twice gives the identical receipt (Ed25519 is deterministic)", async () => {
    const r = await runCheck({ text: CHAT }, offline);
    const signer = loadSigner(env)!;
    const a = signReceipt(buildReceiptBody(r, CHAT, signer, { build: "abc1234", issuedAt: r.checkedAt }), signer);
    const b = signReceipt(buildReceiptBody(r, CHAT, signer, { build: "abc1234", issuedAt: r.checkedAt }), signer);
    expect(a).toEqual(b);
    expect(a).toEqual(receipt);
  });

  it("the published key verifies the receipt with WebCrypto Ed25519 (the browser path on /verify)", async () => {
    const doc = publicKeyDoc(env)!;
    expect(doc).toMatchObject({ keyId: receipt.keyId, alg: "Ed25519", format: "raw-base64url" });
    const key = await crypto.subtle.importKey("raw", Buffer.from(doc.publicKey, "base64url"), { name: "Ed25519" }, false, ["verify"]);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, key, Buffer.from(receipt.signature, "base64url"), signedBytes(receipt) as BufferSource)).toBe(true);
    const t = { ...receipt, riskLevel: receipt.riskLevel === "high" ? "low" : "high" } as Receipt;
    expect(await crypto.subtle.verify({ name: "Ed25519" }, key, Buffer.from(t.signature, "base64url"), signedBytes(t) as BufferSource)).toBe(false);
  });

  it("evidence pack shows the 12-character receipt code", async () => {
    const r = await runCheck({ text: CHAT }, offline);
    expect(receiptCode(receipt)).toHaveLength(12);
    expect(buildEvidencePack({ ...r, receipt })).toContain(`Receipt code: ${receiptCode(receipt)}`);
    expect(buildEvidencePack(r)).not.toContain("Receipt code");
  });
});

describe("receipt routes", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const post = (body: unknown, ip = "10.9.9.1") =>
    verifyRoute(new Request("http://x/api/verify-receipt", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

  it("/.well-known/scamlens-receipt-key.json publishes the key, or 404 when receipts are off", async () => {
    const on = keyResponse(env);
    expect(on.status).toBe(200);
    expect(await on.json()).toEqual(publicKeyDoc(env));
    const off = keyResponse({});
    expect(off.status).toBe(404);
    expect(await off.json()).toEqual({ ok: false, error: "Receipts are not enabled on this deployment." });
    expect(typeof keyRoute).toBe("function"); // the route only adds connection() and calls keyResponse(process.env)
  });

  it("POST /api/verify-receipt: valid, tampered, original text, oversize (413) and rate limit (429)", async () => {
    process.env.RECEIPT_SIGNING_KEY = env.RECEIPT_SIGNING_KEY;
    process.env.USAGE_VERIFY_PER_DAY = "3";
    expect(await (await post({ receipt })).json()).toEqual({ valid: true, issuedAt: receipt.issuedAt });
    expect(await (await post({ receipt: { ...receipt, build: "zzz9999" } })).json()).toEqual({ valid: false, reason: "bad signature" });
    expect(await (await post({ receipt, text: CHAT })).json()).toMatchObject({ valid: true, textMatches: true });
    expect((await post({ receipt })).status).toBe(429); // 4th call from the same network today
    const big = await post({ receipt: { ...receipt, notices: ["x".repeat(30_000)] } }, "10.9.9.2");
    expect(big.status).toBe(413);
    expect(JSON.stringify(await big.json())).not.toContain("xxxxxxxx");
    expect(INVALID_MESSAGE).toMatch(/^Signature not valid/);
  });

  it("sample checks sign cleanly for all three samples", async () => {
    for (const s of SAMPLES) expect(receiptFor(await runCheck({ text: s.text }, offline), s.text, env, "local")).toBeTruthy();
  });
});

describe("evidence pack receipt line (browser fix)", () => {
  it("the /verify link inside the sentence has a 44px tap area", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../components/EvidencePackButton.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/<a href="\/verify" className="tap">/);
  });
});
