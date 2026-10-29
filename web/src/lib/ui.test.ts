import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiskCard } from "../components/RiskCard";
import { runCheck, type RunDeps } from "./check";
import { DEMO_LABEL } from "./demo";
import { WHAT_TO_DO_NOW } from "./next-steps";
import { NO_REPORTS_MESSAGE, RISK_EXPLANATION } from "./risk";
import { SAMPLES } from "./samples";
import { localDb } from "../test-support/pglite";

const offline: RunDeps = {
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-29T00:00:00Z"),
  env: {},
  db: null,
};
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("risk card (server-rendered, no browser)", () => {
  it("empty state invites a check and still shows the three labelled tiers", () => {
    const html = renderToStaticMarkup(createElement(RiskCard, { result: null }));
    expect(html).toContain("Paste something and press Check");
    for (const t of ["Tier 1 of 3", "Tier 2 of 3", "Tier 3 of 3", "Verified", "Reported", "Suspected"]) expect(strip(html)).toContain(t);
    expect(html).not.toContain("What to do now");
  });

  it("a result shows the risk explanation, notices, highlighted quotes and the What to do now steps", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const html = renderToStaticMarkup(createElement(RiskCard, { result: r, demo: true }));
    const text = strip(html);
    expect(text).toContain(RISK_EXPLANATION[r.risk.level]);
    expect(html).toContain('id="risk-card-title"');
    expect(text).toContain("What to do now");
    for (const step of WHAT_TO_DO_NOW) expect(text).toContain(step);
    expect(text).toContain("1930");
    expect(html).toMatch(/<mark[^>]*>[^<]+<\/mark>/);
    expect(text).toContain(DEMO_LABEL); // the sample is synthetic
    // The reports DB is not configured in this test, so the card must say "unavailable", not "no reports".
    expect(text).not.toContain(NO_REPORTS_MESSAGE);
    expect(text).toMatch(/unavailable/i);
  });

  it("with a working reports DB and nothing found, 'No known reports. This does not mean safe.' is shown", async () => {
    const { db } = await localDb();
    const r = await runCheck({ text: "Meeting moved to 4 pm" }, { ...offline, db, env: { REPORT_HASH_PEPPER: "test-pepper-0123456789" } });
    expect(strip(renderToStaticMarkup(createElement(RiskCard, { result: r })))).toContain(NO_REPORTS_MESSAGE);
  });

  it("notices from the server are shown on the card", async () => {
    const r = await runCheck({ text: "Claim your bonus at zz-demo-bonus-claim.example.com today" }, offline);
    expect(r.notices.length).toBeGreaterThan(0);
    const text = strip(renderToStaticMarkup(createElement(RiskCard, { result: r })));
    for (const n of r.notices) expect(text).toContain(n);
  });

  it("not a demo: no demo label", async () => {
    const r = await runCheck({ text: "Meeting moved to 4 pm" }, offline);
    expect(renderToStaticMarkup(createElement(RiskCard, { result: r }))).not.toContain(DEMO_LABEL);
  });
});
