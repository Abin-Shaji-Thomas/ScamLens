import { beforeEach, describe, expect, it } from "vitest";
import ofacJson from "../../../data/ofac-sdn-addresses.json";
import ssJson from "../../../data/scamsniffer-addresses.json";
import { POST } from "../../app/api/check/route";
import { runCheck } from "../check";
import { extractIdentifiers } from "../identifiers";
import { clearEtherscanCache, etherscanInFlight, EVM_CHAINS, MAX_ETHERSCAN_CHAINS_IN_FLIGHT, setRetryPauseForTests } from "./etherscan";
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

beforeEach(() => clearEtherscanCache());

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
    // Free plan: BNB (index 1) and Base (index 3) are not called at all.
    expect(r[1]).toMatchObject({ status: "unavailable", reason: "BNB Chain is not included in the Etherscan free API plan" });
    expect(r[3].reason).toMatch(/Base is not included/);
    expect(Object.fromEntries(r[0].facts.map((f) => [f.label, f.value]))).toEqual({
      Type: "Wallet (EOA)",
      Balance: "1.5 ETH",
      "Outgoing transactions (nonce)": "42",
      "First transaction": "2020-09-13",
      "Last transaction": "2023-11-14",
    });
    expect(r[2].facts.find((f) => f.label === "Balance")?.value).toBe("1.5 POL");
  });
  it("paid plan queries BNB and Base too", async () => {
    const d = deps((url) => (url.includes("etherscan") ? etherscanRoute(url) : json(GOPLUS_CLEAN)), { ETHERSCAN_API_KEY: "k", ETHERSCAN_PLAN: "paid" });
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "etherscan");
    expect(r.every((x) => x.status === "info")).toBe(true);
  });
  it("F2: at most 2 Etherscan chains are looked up at the same time", async () => {
    let peak = 0;
    const route = async (url: string) => {
      if (!url.includes("etherscan")) return json(GOPLUS_CLEAN);
      peak = Math.max(peak, etherscanInFlight());
      await new Promise((r) => setTimeout(r, 5));
      return etherscanRoute(url);
    };
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(route, { ETHERSCAN_API_KEY: "k", ETHERSCAN_PLAN: "paid" }, 2000)), "etherscan");
    expect(r.every((x) => x.status === "info")).toBe(true);
    expect(MAX_ETHERSCAN_CHAINS_IN_FLIGHT).toBe(2);
    expect(peak).toBe(2);
    expect(etherscanInFlight()).toBe(0);
  });
  it("only the first EVM wallet gets on-chain lookups", async () => {
    const two = `0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb 0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB`;
    const d = deps((url) => (url.includes("etherscan") ? etherscanRoute(url) : json(GOPLUS_CLEAN)), { ETHERSCAN_API_KEY: "k" });
    const r = by(await runVerifiedChecks(ids(two), d), "etherscan");
    const second = r.filter((x) => x.identifier.value === "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB");
    expect(second.every((x) => x.status === "unavailable" && /first 1 wallet/.test(x.reason ?? ""))).toBe(true);
    expect(r.filter((x) => x.status === "info")).toHaveLength(3);
  });
  it("a rate-limit answer is retried once and then succeeds", async () => {
    setRetryPauseForTests(5);
    let limited = 0;
    const route = (url: string) => {
      if (url.includes("etherscan") && url.includes("sort=asc") && limited === 0) {
        limited++;
        return json({ status: "0", message: "NOTOK", result: "Max calls per sec rate limit reached (3/sec)" });
      }
      return url.includes("etherscan") ? etherscanRoute(url) : json(GOPLUS_CLEAN);
    };
    const r = by(await runVerifiedChecks(ids(CLEAN), deps(route, { ETHERSCAN_API_KEY: "k" })), "etherscan");
    expect(limited).toBe(1);
    expect(r[0].status).toBe("info");
  });
  it("successful lookups are cached: a repeat check makes no Etherscan calls", async () => {
    let calls = 0;
    const route = (url: string) => (url.includes("etherscan") ? (calls++, etherscanRoute(url)) : json(GOPLUS_CLEAN));
    const addr = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    await runVerifiedChecks(ids(addr), deps(route, { ETHERSCAN_API_KEY: "k" }));
    const first = calls;
    await runVerifiedChecks(ids(addr), deps(route, { ETHERSCAN_API_KEY: "k" }));
    expect(first).toBe(15);
    expect(calls).toBe(first);
  });
  it("API error text becomes unavailable and never leaks the key", async () => {
    const d = deps(
      (url) => (url.includes("etherscan") ? json({ status: "0", message: "NOTOK", result: "Missing/Invalid API Key" }) : json(GOPLUS_CLEAN)),
      { ETHERSCAN_API_KEY: "SECRET123" },
    );
    const r = by(await runVerifiedChecks(ids(CLEAN), d), "etherscan");
    for (const x of r.filter((_, i) => EVM_CHAINS[i].freeTier)) expect(x).toMatchObject({ status: "unavailable", reason: "Missing/Invalid API Key" });
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
    const called = remote.filter((x) => !/free API plan/.test(x.reason ?? "")); // BNB/Base are never called on the free plan
    expect(called.length).toBe(1 + 3 + 1 + 1);
    for (const x of called) expect(x).toMatchObject({ status: "unavailable", reason: "timed out" });
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

describe("F6: verified findings are checkable; domains only against GoPlus phishing sites", () => {
  it("every result (match, no match, info or unavailable) names its source, a date and an https link", async () => {
    const text = `${OFAC_ETH} ${CLEAN} ${OFAC_TRX}`;
    for (const route of [(url: string) => (url.includes("etherscan") ? etherscanRoute(url) : json(GOPLUS_CLEAN)), (() => json({}, 500)) as Route]) {
      const results = await runVerifiedChecks(ids(text), deps(route, { ETHERSCAN_API_KEY: "k" }));
      expect(results.length).toBeGreaterThan(5);
      for (const r of results) {
        expect(r.sourceName.length, r.source).toBeGreaterThan(0);
        expect(r.link, `${r.source} ${r.status}`).toMatch(/^https:\/\//);
        expect(r.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        if (r.source === "ofac" || r.source === "scamsniffer") if (r.status !== "unavailable") expect(r.dataAsOf).toBeTruthy();
      }
    }
  });
  it("domain list was probed over budget, so it is not loaded", async () => {
    const { DOMAIN_LIST_BUDGET_BYTES, SCAMSNIFFER_DOMAINS_PROBED_BYTES } = await import("./index");
    expect(SCAMSNIFFER_DOMAINS_PROBED_BYTES).toBeGreaterThan(DOMAIN_LIST_BUDGET_BYTES);
  });
  it("a domain is looked up in GoPlus phishing sites: listed is a match, unlisted is no_match (never 'safe'), with the notice", async () => {
    const { DOMAIN_NOTICE } = await import("./index");
    const seen: string[] = [];
    const route: Route = (url) => {
      seen.push(url);
      if (url.includes("/phishing_site")) return json({ code: 1, message: "OK", result: { website_contract_security: [], phishing_site: url.endsWith("=zzdemo-bonus-claim.co.in") ? 1 : 0 } });
      return json({}, 500);
    };
    // Test-only names (fetch is mocked); the subdomain and path never leave the server.
    const r = await runCheck({ text: "Claim your bonus at https://login.zzdemo-bonus-claim.co.in/claim?id=7 or see www.other-demo.example.org today" }, { ...deps(route), db: null });
    const rows = r.verified.filter((v) => v.source === "goplus_phishing");
    expect(rows.map((v) => [v.identifier.value, v.status])).toEqual([
      ["login.zzdemo-bonus-claim.co.in", "match"],
      ["www.other-demo.example.org", "no_match"],
    ]);
    expect(rows[0].summary).toBe("GoPlus lists this website as a phishing site.");
    expect(rows[1].summary).toBe("GoPlus does not list this website as a phishing site.");
    expect(rows.map((v) => v.summary).join(" ")).not.toMatch(/\bsafe\b|\bclean\b/i);
    expect(seen.filter((u) => u.includes("/phishing_site"))).toEqual([
      "https://api.gopluslabs.io/api/v1/phishing_site?url=zzdemo-bonus-claim.co.in", // registrable domain only
      "https://api.gopluslabs.io/api/v1/phishing_site?url=example.org",
    ]);
    expect(seen.join(" ")).not.toMatch(/Claim your bonus|login\.zzdemo|\/claim\?id/); // no text, subdomain or path is sent
    expect(r.risk.level).toBe("high"); // a phishing listing is a verified match
    expect(r.notices).toContain(DOMAIN_NOTICE);
  });
  it("GoPlus phishing failures are unavailable, never a pass", async () => {
    for (const route of [() => json({}, 500), () => json({ code: 4029, message: "rate" }), () => new Response("<html>", { status: 200 }), never] as Route[]) {
      const r = by(await runVerifiedChecks(ids("see zz-demo-bonus-claim.example.com"), deps(route, {}, 30)), "goplus_phishing");
      expect(r).toHaveLength(1);
      expect(r[0].status).toBe("unavailable");
      expect(r[0].link).toBe("https://gopluslabs.io/");
    }
  });
  it("at most MAX_DOMAINS domains are looked up", async () => {
    const { MAX_DOMAINS } = await import("./index");
    const text = Array.from({ length: MAX_DOMAINS + 2 }, (_, i) => `site${i}-demo.example.com`).join(" ");
    const r = by(await runVerifiedChecks(ids(text), deps(() => json({ code: 1, result: { phishing_site: 0 } }))), "goplus_phishing");
    expect(r).toHaveLength(MAX_DOMAINS);
  });
  it("no domain in the text: no domain notice and no phishing lookup", async () => {
    const { DOMAIN_NOTICE } = await import("./index");
    const r = await runCheck({ text: "pay the fee now" }, { ...deps(() => json({}, 500)), db: null });
    expect(r.notices).not.toContain(DOMAIN_NOTICE);
    expect(by(r.verified, "goplus_phishing")).toEqual([]);
  });
});
