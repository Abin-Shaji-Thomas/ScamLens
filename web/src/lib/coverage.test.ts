import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CoverageLedger } from "../components/CoverageLedger";
import { runCheck, type RunDeps } from "./check";
import { buildCoverage } from "./coverage";
import { SAMPLES } from "./samples";
import { localDb } from "../test-support/pglite";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const offline: RunDeps = {
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-29T00:00:00Z"),
  env: { ETHERSCAN_API_KEY: "test", ETHERSCAN_RPS: "1000" },
  db: null,
};
const status = (c: ReturnType<typeof buildCoverage>, id: string) => c.rows.find((r) => r.id === id)?.status;
const html = (r: Awaited<ReturnType<typeof runCheck>>) => renderToStaticMarkup(createElement(CoverageLedger, { result: r }));

describe("coverage ledger ('What was checked')", () => {
  it("EVM wallet offline: lists checked (local lists, with their list date), unavailable (live APIs), skipped and not-enabled chains", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    const c = buildCoverage(r);
    expect(status(c, "ofac")).toBe("checked");
    expect(c.rows.find((x) => x.id === "ofac")?.when).toBe(`list dated ${r.verified.find((v) => v.source === "ofac")!.dataAsOf}`);
    expect(status(c, "scamsniffer")).toBe("checked");
    expect(status(c, "goplus")).toBe("unavailable");
    expect(status(c, "etherscan")).toBe("unavailable");
    expect(status(c, "trongrid")).toBe("not applicable");
    expect(status(c, "reports")).toBe("unavailable");
    expect(status(c, "rules")).toBe("checked");
    expect(c.rows.some((x) => x.id === "ai")).toBe(false); // AI off: no row claiming an AI check
    expect(c.notChecked.join(" ")).toMatch(/Etherscan history on BNB Chain, Base is not enabled on this plan\./);
  });

  it("limits: a second EVM wallet is reported as skipped because of the rate limit; all-skipped is 'skipped (limit)'", async () => {
    const r = await runCheck({ text: "Pay 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 or " + SAMPLES[1].text }, offline);
    const eth = buildCoverage(r).rows.find((x) => x.id === "etherscan")!;
    expect(eth.detail).toMatch(/1 more wallet\(s\) skipped because of the rate limit/);
    const allSkipped = { ...r, verified: r.verified.map((v) => (v.source === "etherscan" ? { ...v, status: "unavailable" as const, reason: "skipped: rate limit" } : v)) };
    expect(status(buildCoverage(allSkipped), "etherscan")).toBe("skipped (limit)");
  });

  it("UPI only, with a working reports DB: reports checked, address sources not applicable, a UPI 'not checked' line", async () => {
    const { db } = await localDb();
    const r = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, { ...offline, db, env: { REPORT_HASH_PEPPER: "test-pepper-0123456789" } });
    const c = buildCoverage(r);
    expect(status(c, "reports")).toBe("checked");
    for (const id of ["ofac", "scamsniffer", "goplus", "etherscan", "trongrid"]) expect(status(c, id)).toBe("not applicable");
    expect(c.notChecked).toContain("UPI IDs have no public database here; only community reports are used.");
  });

  it("TRON wallet: says which sources were not looked up; domains say they were not checked", async () => {
    const r = await runCheck({ text: "Send USDT to TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL and see zz-demo-bonus-claim.example.com" }, offline);
    const c = buildCoverage(r);
    expect(status(c, "trongrid")).not.toBe("not applicable");
    expect(c.notChecked.join(" ")).toMatch(/TRON wallet TNPeeaaFB7\.\.\.: not looked up in ScamSniffer open blacklist, Etherscan V2\./);
    expect(c.notChecked).toContain("Website domains were not checked against a blocklist.");
  });

  it("renders every status as a word, never 'clean' or 'safe', and no date is typed in the component", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    const out = html(r).replace(/<[^>]+>/g, " ");
    for (const w of ["checked", "unavailable", "not applicable"]) expect(out).toContain(w);
    expect(out).not.toMatch(/\bclean\b|\bsafe\b/i);
    expect(out).toContain("What was checked");
    const src = (await import("node:fs")).readFileSync(new URL("../components/CoverageLedger.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/20\d\d-\d\d-\d\d/);
    const lib = (await import("node:fs")).readFileSync(new URL("./coverage.ts", import.meta.url), "utf8");
    expect(lib).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it("an unavailable source appears as unavailable with its reason, and the ledger sits on the result card", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    const goplus = buildCoverage(r).rows.find((x) => x.id === "goplus")!;
    expect(goplus.status).toBe("unavailable");
    expect(goplus.detail).toBeTruthy();
    const { RiskCard } = await import("../components/RiskCard");
    expect(renderToStaticMarkup(createElement(RiskCard, { result: r }))).toContain('aria-labelledby="coverage-title"');
  });
});

describe("coverage ledger: Link graph row (G4b)", () => {
  const row = (c: ReturnType<typeof buildCoverage>) => c.rows.find((r) => r.id === "graph");
  it("statuses: not looked up, checked (backend and ms), unavailable, not applicable", async () => {
    const upi = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, offline);
    expect(row(buildCoverage(upi, { graph: null }))).toMatchObject({ name: "Link graph", status: "not looked up (press Show links)" });
    expect(row(buildCoverage(upi, { graph: { status: "ok", backend: "tigergraph", elapsedMs: 412 } }))).toMatchObject({ status: "checked", when: "tigergraph, 412 ms" });
    expect(row(buildCoverage(upi, { graph: { status: "ok", backend: "postgres (TigerGraph unavailable)", elapsedMs: 20 } }))?.when).toBe("postgres (TigerGraph unavailable), 20 ms");
    expect(row(buildCoverage(upi, { graph: { status: "unavailable", backend: "tigergraph" } }))).toMatchObject({ status: "unavailable" });
    const phone = await runCheck({ text: "+91 98765 43210" }, offline);
    expect(row(buildCoverage(phone, { graph: null }))).toMatchObject({ status: "not applicable" });
  });
  it("the signed receipt's coverage is unchanged: without the graph argument there is no Link graph row", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    expect(row(buildCoverage(r))).toBeUndefined();
    expect(buildCoverage(r).rows.map((x) => x.id)).toEqual(["ofac", "scamsniffer", "goplus", "etherscan", "trongrid", "reports", "rules"]);
  });
  it("the ledger on the card shows the row as not looked up, and never says clean or safe", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const out = html(r).replace(/<[^>]+>/g, " ");
    expect(out).toContain("Link graph");
    expect(out).toContain("not looked up (press Show links)");
    expect(out).not.toMatch(/\bclean\b|\bsafe\b/i);
  });
});

describe("coverage ledger: Why? links (H2c)", () => {
  it("each 'not applicable' row and the Not checked list link to /about#sources, which exists", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    const out = html(r);
    const rows = out.match(/<li[^>]*data-status="not applicable"[^>]*>[\s\S]*?<\/li>/g) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toMatch(/<a href="\/about#sources" class="tap" data-why="true">Why\?<\/a>/);
    const other = out.match(/<li[^>]*data-status="checked"[^>]*>[\s\S]*?<\/li>/g) ?? [];
    for (const row of other) expect(row).not.toContain("data-why");
    expect(out).toMatch(/Each source covers only some kinds of identifier\. <a href="\/about#sources"/);
    const about = (await import("node:fs")).readFileSync(new URL("../app/about/page.tsx", import.meta.url), "utf8");
    expect(about).toContain('<Section id="sources"');
  });

  it("no Not checked list means no extra Why? line", async () => {
    const r = await runCheck({ text: "Meeting moved to 4 pm" }, offline);
    expect(buildCoverage(r).notChecked).toEqual([]);
    const bare = html(r);
    expect(bare).not.toContain("Not checked");
    expect(bare).not.toContain("Each source covers only some kinds of identifier.");
  });
});
