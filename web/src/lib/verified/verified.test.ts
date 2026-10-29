import { describe, expect, it } from "vitest";
import ofacJson from "../../../data/ofac-sdn-addresses.json";
import ssJson from "../../../data/scamsniffer-addresses.json";
import { POST } from "../../app/api/check/route";
import { runCheck } from "../check";
import { extractIdentifiers } from "../identifiers";
import { runVerifiedChecks } from "./index";
import type { CheckDeps, SourceResult } from "./types";

const OFAC_ETH = ofacJson.addresses.find((a) => a.currency === "ETH")!.address;
const OFAC_TRX = ofacJson.addresses.find((a) => a.currency === "TRX")!.address;
const SS_ADDR = ssJson.addresses[0];
// EIP-55 test vector; asserted below not to be on either list.
const CLEAN = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Route = (url: string) => Response | Promise<Response>;

function deps(route: Route, env: Record<string, string> = {}, timeoutMs = 200): CheckDeps {
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    // Honour the abort signal like real fetch does.
    return await new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      Promise.resolve(route(url)).then(resolve, reject);
    });
  }) as typeof fetch;
  return { fetch: fetchMock, timeoutMs, now: () => new Date("2026-10-29T00:00:00Z"), env: { ETHERSCAN_RPS: "1000", ...env } };
}

const GOPLUS_CLEAN = { code: 1, message: "ok", result: { stealing_attack: "0", sanctioned: "0", contract_address: "0", data_source: "" } };
const GOPLUS_FLAGGED = {
  code: 1,
  message: "ok",
  result: { stealing_attack: "1", sanctioned: "0", contract_address: "1", data_source: "SlowMist" },
};
const never: Route = () => new Promise<Response>(() => {});
const by = (results: SourceResult[], source: string) => results.filter((r) => r.source === source);
const ids = (t: string) => extractIdentifiers(t);

function etherscanRoute(url: string): Response {
  if (url.includes("action=balance")) return json({ status: "1", message: "OK", result: "1500000000000000000" });
  if (url.includes("eth_getTransactionCount")) return json({ jsonrpc: "2.0", id: 1, result: "0x2a" });
  if (url.includes("eth_getCode")) return json({ jsonrpc: "2.0", id: 1, result: "0x" });
  if (url.includes("sort=asc")) return json({ status: "1", message: "OK", result: [{ timeStamp: "1600000000" }] });
  if (url.includes("sort=desc")) return json({ status: "1", message: "OK", result: [{ timeStamp: "1700000000" }] });
  return json({}, 404);
}

describe("fixtures", () => {
  it("clean address is on neither list", () => {
    expect(ofacJson.addresses.some((a) => a.address.toLowerCase() === CLEAN.toLowerCase())).toBe(false);
    expect(ssJson.addresses.includes(CLEAN.toLowerCase())).toBe(false);
  });
});

describe("OFAC (local snapshot)", () => {
  it("matches an address taken from the downloaded SDN file", async () => {
    const r = by(await runVerifiedChecks(ids(OFAC_ETH), deps(() => json(GOPLUS_CLEAN))), "ofac")[0];
    expect(r.status).toBe("match");
    expect(r.link).toMatch(/^https:\/\/sanctionssearch\.ofac\.treas\.gov\/Details\.aspx\?id=\d+$/);
    expect(r.dataAsOf).toBe(ofacJson.publish_date);
  });
  it("matches a TRON address from the SDN file (case-sensitive base58)", async () => {
    const r = by(await runVerifiedChecks(ids(OFAC_TRX), deps(() => json(GOPLUS_CLEAN))), "ofac")[0];
    expect(r.status).toBe("match");
  });
  it("clean address is no_match with the list date", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => json(GOPLUS_CLEAN))), "ofac")[0];
    expect(r.status).toBe("no_match");
    expect(r.summary).toContain(ofacJson.publish_date);
  });
});

describe("ScamSniffer (local snapshot)", () => {
  it("matches a listed address and carries the delay note", async () => {
    const r = by(await runVerifiedChecks(ids(SS_ADDR), deps(() => json(GOPLUS_CLEAN))), "scamsniffer")[0];
    expect(r.status).toBe("match");
    expect(r.note).toMatch(/7 days delayed/);
  });
});

describe("GoPlus", () => {
  it("flags map to match with the flag names", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => json(GOPLUS_FLAGGED))), "goplus")[0];
    expect(r.status).toBe("match");
    expect(r.summary).toContain("stealing attack");
    expect(r.summary).not.toContain("contract address");
  });
  it("non-1 code is unavailable", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => json({ code: 4029, message: "rate" }))), "goplus")[0];
    expect(r.status).toBe("unavailable");
  });
  it("HTTP 500 is unavailable", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => json({}, 500))), "goplus")[0];
    expect(r).toMatchObject({ status: "unavailable", reason: "HTTP 500" });
  });
});

describe("Etherscan V2", () => {
  it("missing key -> all five chains unavailable, no request sent", async () => {
    let calls = 0;
    const d = deps((url) => {
      if (url.includes("etherscan")) calls++;
      return json(GOPLUS_CLEAN);
    });
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "etherscan");
    expect(r).toHaveLength(5);
    for (const x of r) expect(x).toMatchObject({ status: "unavailable", reason: "ETHERSCAN_API_KEY not configured" });
    expect(calls).toBe(0);
  });
  it("returns balance, nonce, type and first/last tx per chain", async () => {
    const d = deps((url) => (url.includes("etherscan") ? etherscanRoute(url) : json(GOPLUS_CLEAN)), { ETHERSCAN_API_KEY: "test" });
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "etherscan");
    expect(r.map((x) => x.sourceName)).toEqual([
      "Etherscan V2 (Ethereum)",
      "Etherscan V2 (BNB Chain)",
      "Etherscan V2 (Polygon)",
      "Etherscan V2 (Base)",
      "Etherscan V2 (Arbitrum One)",
    ]);
    expect(r[0].status).toBe("info");
    expect(Object.fromEntries(r[0].facts.map((f) => [f.label, f.value]))).toEqual({
      Type: "Wallet (EOA)",
      Balance: "1.5 ETH",
      "Outgoing transactions (nonce)": "42",
      "First transaction": "2020-09-13",
      "Last transaction": "2023-11-14",
    });
    expect(r[2].facts.find((f) => f.label === "Balance")?.value).toBe("1.5 POL");
  });
  it("API error text becomes unavailable and never leaks the key", async () => {
    const d = deps(
      (url) => (url.includes("etherscan") ? json({ status: "0", message: "NOTOK", result: "Missing/Invalid API Key" }) : json(GOPLUS_CLEAN)),
      { ETHERSCAN_API_KEY: "SECRET123" },
    );
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "etherscan");
    for (const x of r) expect(x).toMatchObject({ status: "unavailable", reason: "Missing/Invalid API Key" });
    expect(JSON.stringify(r)).not.toContain("SECRET123");
  });
});

describe("TronGrid", () => {
  it("account facts", async () => {
    const d = deps((url) =>
      url.includes("trongrid")
        ? json({ success: true, data: [{ balance: 9407033, create_time: 1595918034000, latest_opration_time: 1700000000000 }] })
        : json(GOPLUS_CLEAN),
    );
    const r = by(await runVerifiedChecks(ids("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"), d), "trongrid")[0];
    expect(r.status).toBe("info");
    expect(r.facts).toContainEqual({ label: "Balance", value: "9.407033 TRX" });
    expect(r.facts).toContainEqual({ label: "Created", value: "2020-07-28" });
  });
  it("empty data is 'not activated', not a clean bill", async () => {
    const d = deps((url) => (url.includes("trongrid") ? json({ success: true, data: [] }) : json(GOPLUS_CLEAN)));
    const r = by(await runVerifiedChecks(ids("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"), d), "trongrid")[0];
    expect(r).toMatchObject({ status: "info", summary: "TRON: account not activated on-chain (no history)." });
  });
});

describe("failure rule: unavailable, never safe", () => {
  it("timeout (fetch hangs, honours abort) -> unavailable 'timed out'", async () => {
    const r = await runVerifiedChecks(ids(`${CLEAN} TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`), deps(never, { ETHERSCAN_API_KEY: "k" }, 50));
    const remote = r.filter((x) => x.source !== "ofac" && x.source !== "scamsniffer");
    expect(remote.length).toBe(1 + 5 + 1 + 1); // goplus evm, 5 etherscan, goplus tron, trongrid
    for (const x of remote) expect(x).toMatchObject({ status: "unavailable", reason: "timed out" });
  });
  it("fetch that ignores abort is still cut off by the outer guard", async () => {
    const d: CheckDeps = { ...deps(never), fetch: (() => new Promise<Response>(() => {})) as typeof fetch, timeoutMs: 30 };
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "goplus")[0];
    expect(r).toMatchObject({ status: "unavailable", reason: "timed out" });
  });
  it("network error -> unavailable", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => Promise.reject(new TypeError("fetch failed")))), "goplus")[0];
    expect(r).toMatchObject({ status: "unavailable", reason: "network error" });
  });
  it("malformed JSON body -> unavailable", async () => {
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(() => new Response("<html>", { status: 200 }))), "goplus")[0];
    expect(r).toMatchObject({ status: "unavailable", reason: "invalid response" });
  });
  it("no result anywhere uses the word 'safe'", async () => {
    const r = await runVerifiedChecks(ids(`${CLEAN} ${OFAC_ETH}`), deps(never, {}, 20));
    expect(JSON.stringify(r)).not.toMatch(/\bsafe\b/i);
    for (const x of r) expect(["match", "no_match", "info", "unavailable"]).toContain(x.status);
  });
});

describe("runCheck / POST /api/check", () => {
  it("non-crypto identifiers get no verified lines (UPI is never verified)", async () => {
    const r = await runCheck({ text: "pay rahul@okaxis or call 9876543210" }, deps(never));
    expect(r.identifiers.map((i) => i.type)).toEqual(["upi", "phone"]);
    expect(r.verified).toEqual([]);
  });
  it("rejects empty and non-JSON bodies with 400", async () => {
    const empty = await POST(new Request("http://x/api/check", { method: "POST", body: JSON.stringify({ text: "  " }) }));
    expect(empty.status).toBe(400);
    const bad = await POST(new Request("http://x/api/check", { method: "POST", body: "not json" }));
    expect(bad.status).toBe(400);
  });
  it("returns the tier objects for valid input", async () => {
    const res = await POST(new Request("http://x/api/check", { method: "POST", body: JSON.stringify({ text: "hello there" }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ identifiers: [], verified: [], reported: { status: "unavailable" }, suspected: [] });
  });
});
