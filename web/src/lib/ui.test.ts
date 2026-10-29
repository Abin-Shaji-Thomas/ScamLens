import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "../app/not-found";
import { CheckForm } from "../components/CheckForm";
import { GraphPanel } from "../components/GraphPanel";
import { ReportedList } from "../components/ReportedList";
import { ReportForm } from "../components/ReportForm";
import { RiskCard } from "../components/RiskCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { extractIdentifiers } from "./identifiers";
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
    for (const t of ["01 Verified", "02 Reported", "03 Suspected"]) expect(strip(html)).toContain(t);
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

describe("G4 minimalist states (server-rendered)", () => {
  const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it("risk level: large word, one sentence, and the scale with the current level marked (not colour)", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const html = render(createElement(RiskCard, { result: r }));
    expect(html).toContain('class="t-risk"');
    expect(strip(html)).toMatch(/Low signals · Elevated · High/);
    expect(html).toMatch(/aria-current="true"[^>]*>(Low signals|Elevated|High)</);
    expect(html).not.toMatch(/<mark(?![^>]*class="quote")/); // quotes use underline + weight, no background
  });

  it("notices are plain paragraphs starting with 'Note'", async () => {
    const r = await runCheck({ text: "Claim your bonus at zz-demo-bonus-claim.example.com today" }, offline);
    expect(render(createElement(RiskCard, { result: r }))).toMatch(/<p class="t-small mt-4 text-swiss-text">Note: /);
  });

  it("contested entry: visible with the label", () => {
    const html = render(
      createElement(ReportedList, {
        tier: { status: "ok", entries: [{ type: "upi", display: "zz***d@okdemo", reporters: 2, categories: ["investment"], firstReported: "2026-10-01", lastReported: "2026-10-02", synthetic: true, contested: true }] },
        identifiers: [],
      }),
    );
    expect(strip(html)).toContain("Contested, under review.");
    expect(strip(html)).toContain(DEMO_LABEL);
  });

  it("warning-context hits sit in a collapsed <details> group", async () => {
    const r = await runCheck({ text: "I read that guaranteed returns are a red flag, so I only do a monthly SIP in an index fund." }, offline);
    const html = render(createElement(RiskCard, { result: r }));
    expect(html).toMatch(/<details><summary[^>]*>Mentioned in a warning or news-style text/);
    expect(html).not.toMatch(/<details open/);
  });

  it("report form starts collapsed as a text link (expands inline, no modal)", async () => {
    const r = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, offline);
    const html = render(createElement(ReportForm, { identifiers: r.identifiers }));
    expect(html).toMatch(/<button[^>]*class="btn-link"[^>]*aria-expanded="false"[^>]*>Report these identifiers<\/button>/);
    expect(html).not.toMatch(/role="dialog"/);
  });

  it("graph panel starts with plain text-link buttons and no canvas", () => {
    const html = render(createElement(GraphPanel, { identifiers: extractIdentifiers("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359") }));
    expect(html).toMatch(/class="btn-link[^"]*"[^>]*>Show links for evm/);
    expect(html).not.toContain("<canvas");
  });

  it("header, footer and 404 page", () => {
    const header = strip(render(createElement(SiteHeader)));
    expect(header).toMatch(/ScamLens .*About/);
    const footer = strip(render(createElement(SiteFooter)));
    expect(footer).toContain("About");
    expect(footer).toContain("Not legal advice");
    expect(strip(render(createElement(NotFound)))).toContain("Page not found");
  });

  it("the check form shows the underline field, primary button and the screenshot text link", () => {
    const html = render(createElement(CheckForm));
    expect(html).toMatch(/<textarea[^>]*class="field mt-2"/);
    expect(html).toMatch(/<button type="submit"[^>]*class="btn-primary"/);
    expect(strip(html)).toContain("Upload a screenshot instead");
    expect(html).toMatch(/<label for="input"/);
    expect(html).toMatch(/role="status" aria-live="polite"/);
  });

  it("no rendered state carries a Tailwind palette colour or dark: class", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    const html = [render(createElement(RiskCard, { result: r, demo: true })), render(createElement(CheckForm)), render(createElement(NotFound))].join("");
    expect(html).not.toMatch(/(?:text|bg|border)-(?:red|amber|sky|emerald|fuchsia|neutral|yellow)-\d/);
    expect(html).not.toContain("dark:");
    expect(html).not.toMatch(/rounded(?!-none)/);
  });
});
