import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VerifyPage from "../app/verify/page";
import { runCheck, type RunDeps } from "./check";
import { Receipt } from "./receipt-format";
import { receiptFor, verifyReceipt } from "./receipts";
import { SAMPLES } from "./samples";
import { EXAMPLE_COST_NOTE, EXAMPLE_SAMPLE, fetchExampleReceipt, NO_RECEIPTS_MESSAGE } from "./verify-example";

// Throwaway key only; no real signing key is read or printed.
const env = { RECEIPT_SIGNING_KEY: generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") };
const offline: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date("2026-10-30T10:00:00Z"), env: {}, db: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("/verify Try an example (H2e)", () => {
  it("uses sample 3 and says it costs one daily check", () => {
    expect(EXAMPLE_SAMPLE).toBe(SAMPLES[2]);
    expect(EXAMPLE_COST_NOTE).toBe("This runs a real check on sample 3 and uses 1 of today's checks.");
  });

  it("posts sample 3 to /api/check and returns the receipt as the pretty JSON of a downloaded file, which verifies", async () => {
    const r = await runCheck({ text: EXAMPLE_SAMPLE.text }, offline);
    const receipt = receiptFor(r, EXAMPLE_SAMPLE.text, env, "abc1234")!;
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return json({ ...r, receipt });
    }) as typeof fetch;
    const got = await fetchExampleReceipt(fake);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/check");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ text: EXAMPLE_SAMPLE.text });
    expect(got).toEqual({ json: JSON.stringify(receipt, null, 2) });
    const parsed = Receipt.parse(JSON.parse((got as { json: string }).json));
    expect(verifyReceipt(parsed, env)).toEqual({ valid: true, issuedAt: receipt.issuedAt });
  });

  it("says so plainly when there is no receipt, when the limit is hit, and when the server cannot be reached", async () => {
    const r = await runCheck({ text: EXAMPLE_SAMPLE.text }, offline);
    expect(await fetchExampleReceipt((async () => json(r)) as typeof fetch)).toEqual({ error: NO_RECEIPTS_MESSAGE });
    expect(await fetchExampleReceipt((async () => json({ error: "Daily limit reached." }, 429)) as typeof fetch)).toEqual({ error: "Daily limit reached." });
    expect(await fetchExampleReceipt((async () => new Response("x", { status: 500 })) as typeof fetch)).toEqual({ error: "The example check failed (HTTP 500)." });
    expect(await fetchExampleReceipt((async () => json({ nope: 1 })) as typeof fetch)).toEqual({ error: "The example check returned an unexpected answer." });
    expect(await fetchExampleReceipt((() => Promise.reject(new Error("down"))) as typeof fetch)).toEqual({ error: "The example check could not reach the server." });
  });

  it("the empty page shows How to get a receipt, a link home, the button and the cost note", () => {
    const html = renderToStaticMarkup(createElement(VerifyPage));
    const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    expect(html).toContain("data-verify-empty");
    expect(html).toMatch(/<h2 class="font-semibold text-swiss-black">How to get a receipt<\/h2>/);
    expect(html).toMatch(/<a (?=[^>]*href="\/")(?=[^>]*class="tap")[^>]*>home page<\/a>/);
    expect(html).toMatch(/<button type="button" class="button button--outline">Try an example<\/button>/);
    expect(text).toContain(EXAMPLE_COST_NOTE);
    expect(text).toContain("under Share proof");
  });

  it("filling the example never verifies by itself: only the Verify button calls run()", () => {
    const src = readFileSync(new URL("../components/VerifyReceipt.tsx", import.meta.url), "utf8");
    const tryBody = src.slice(src.indexOf("async function tryExample"), src.indexOf("async function run"));
    expect(tryBody).toContain("setJson(got.json)");
    expect(tryBody).not.toMatch(/\brun\(|verifyInBrowser|verify-receipt/);
    expect(src.match(/void run\(\)/g)).toHaveLength(1);
  });
});
