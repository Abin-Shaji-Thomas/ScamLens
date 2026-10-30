// Smoke test against a running deployment: /api/health and /api/check with the 3 built-in samples.
// Prints PASS/FAIL per expectation and exits 1 on any FAIL. Uses 3 of the day's checks for your network.
// Run from web/: npx tsx scripts/smoke-live.ts http://localhost:3000   (or the live URL)
import { CheckResponse } from "../src/lib/api-schema";
import { HealthResponse } from "../src/lib/health";
import { RECEIPT_KEY_PATH, ReceiptKey, signedBytes, type Receipt } from "../src/lib/receipt-format";
import { SAMPLES } from "../src/lib/samples";
import { PER_SAMPLE, smokeExpectationCount, tiersPresent, type Expect } from "./smoke-expectations";

async function receiptVerifies(base: string, r: Receipt): Promise<Expect> {
  try {
    const k = ReceiptKey.parse(await (await fetch(`${base}${RECEIPT_KEY_PATH}`, { signal: AbortSignal.timeout(20000) })).json());
    const key = await crypto.subtle.importKey("raw", Buffer.from(k.publicKey, "base64url"), { name: "Ed25519" }, false, ["verify"]);
    const ok = k.keyId === r.keyId && (await crypto.subtle.verify({ name: "Ed25519" }, key, Buffer.from(r.signature, "base64url"), signedBytes(r) as BufferSource));
    return { name: "signed receipt verifies with the published key", ok, detail: `code ${r.signature.slice(0, 12)}` };
  } catch (e) {
    return { name: "signed receipt verifies with the published key", ok: false, detail: e instanceof Error ? e.name : "error" };
  }
}

/**
 * Warm-up, not counted as an expectation: right after a deploy the first requests can hit a cold start (seen on
 * 2026-10-30: two samples timed out, the re-run passed). Poll /api/health for up to 60 s, then send one harmless
 * check (60 s timeout, one retry). The warm-up check uses 1 of the network's 40 daily checks.
 */
async function warmUp(base: string): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    const ok = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) }).then((r) => r.ok, () => false);
    if (ok || Date.now() - t0 > 60_000) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ok = await fetch(`${base}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Warm-up: meeting moved to 4 pm." }),
      signal: AbortSignal.timeout(60_000),
    }).then((r) => r.ok, () => false);
    console.log(`      warm-up check ${attempt}: ${ok ? "ok" : "no answer"} (${Math.round((Date.now() - t0) / 1000)} s)`);
    if (ok) return;
  }
}

async function main() {
  const base = (process.argv[2] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    console.error("usage: npx tsx scripts/smoke-live.ts <base-url>");
    process.exit(2);
  }
  await warmUp(base);
  const results: Expect[] = [];
  const add = (scope: string, xs: Expect[]) => {
    for (const x of xs) {
      results.push(x);
      console.log(`${x.ok ? "PASS" : "FAIL"}  [${scope}] ${x.name}${x.detail ? ` (${x.detail})` : ""}`);
    }
  };

  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(20000) });
    const h = HealthResponse.safeParse(await res.json());
    add("health", [
      { name: "HTTP 200", ok: res.ok, detail: String(res.status) },
      { name: "schema (booleans/short statuses only)", ok: h.success },
    ]);
    if (h.success) console.log(`      health: ${JSON.stringify(h.data)}`);
  } catch (e) {
    add("health", [{ name: "reachable", ok: false, detail: e instanceof Error ? e.name : "error" }]);
  }

  for (const s of SAMPLES) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: s.text }),
        signal: AbortSignal.timeout(45000),
      });
      const body: unknown = await res.json();
      const parsed = CheckResponse.safeParse(body);
      add(s.id, [
        { name: "HTTP 200", ok: res.ok, detail: `${res.status}, ${Date.now() - t0} ms` },
        { name: "response schema", ok: parsed.success },
      ]);
      if (parsed.success) add(s.id, [...tiersPresent(parsed.data), ...PER_SAMPLE[s.id](parsed.data)]);
      // Receipts are optional (off without RECEIPT_SIGNING_KEY); when present, the published key must verify them.
      if (parsed.success && parsed.data.receipt) add(s.id, [await receiptVerifies(base, parsed.data.receipt)]);
      else if (parsed.success) console.log(`      [${s.id}] receipt: none (receipts off)`);
    } catch (e) {
      add(s.id, [{ name: "request completed", ok: false, detail: e instanceof Error ? e.name : "error" }]);
    }
  }

  // A full run has a fixed number of expectations (the docs quote it as a FACT); fewer means a step was skipped.
  const receipts = results.some((r) => r.name === "signed receipt verifies with the published key");
  const expected = smokeExpectationCount(receipts);
  if (results.length !== expected) results.push({ name: `all ${expected} expectations ran`, ok: false, detail: `${results.length} ran` });
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAIL`} (${results.length} expectations)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
