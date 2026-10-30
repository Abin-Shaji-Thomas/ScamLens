import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import NotFound from "../app/not-found";
import { CheckForm } from "../components/CheckForm";
import { GraphPanel } from "../components/GraphPanel";
import { ReportedList } from "../components/ReportedList";
import { ReportForm } from "../components/ReportForm";
import { RiskBadge } from "../components/RiskBadge";
import { RiskCard } from "../components/RiskCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { extractIdentifiers } from "./identifiers";
import { runCheck, type RunDeps } from "./check";
import { DEMO_LABEL } from "./demo";
import { WHAT_TO_DO_NOW } from "./next-steps";
import { assessRisk, NO_REPORTS_MESSAGE, RISK_EXPLANATION } from "./risk";
import { SAMPLES } from "./samples";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localDb } from "../test-support/pglite";
import { cssRules } from "../test-support/style";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

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
    expect(html).toMatch(/class="t-risk risk-word" data-level="(low|elevated|high)"/);
    expect(strip(html)).toMatch(/Low signals · Elevated · High/);
    expect(html).toMatch(/aria-current="true"[^>]*>(Low signals|Elevated|High)</);
    expect(html).not.toMatch(/<mark(?![^>]*class="quote")/); // quotes use underline + weight, no background
  });

  it("notices are plain paragraphs starting with 'Note'", async () => {
    const r = await runCheck({ text: "Claim your bonus at zz-demo-bonus-claim.example.com today" }, offline);
    expect(render(createElement(RiskCard, { result: r }))).toMatch(/<p class="mt-4 text-swiss-text">Note: /);
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

  it("the check form shows the ruled text box, the black Check button and the outline screenshot button", () => {
    const html = render(createElement(CheckForm, { screenshots: true }));
    expect(html).toMatch(/<textarea[^>]*class="textarea mt-4"/);
    expect(html).toMatch(/<button type="submit"[^>]*class="button"/);
    expect(html).toMatch(/<button type="button" class="button button--outline"[^>]*>Upload a screenshot instead<\/button>/);
    expect(strip(html)).toContain("Upload a screenshot instead");
    expect(html).toMatch(/<label[^>]*for="input"/);
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

describe("Swiss grid layout (server-rendered)", () => {
  const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
  const tags = (html: string, cls: RegExp) => [...html.matchAll(/<(\w+)[^>]*class="([^"]*)"/g)].filter((m) => cls.test(m[2]));

  it("hero: h1 spans columns 1-9 and the lead 1-6 at >= 1024px, inside a 12-column .grid", () => {
    const html = render(createElement(Home));
    expect(html).toMatch(/<div class="grid"><h1 id="page-title" class="t-title col-span-full lg:col-span-9">/);
    expect(html).toMatch(/<p class="lead col-span-full mt-6 lg:col-span-6">/);
  });

  it("form: left columns 1-8, right columns 10-12 with a 2px black top rule (together the full width)", () => {
    const html = render(createElement(CheckForm));
    expect(html).toMatch(/<div class="col-span-full flex flex-col lg:col-span-8">\s*<form/);
    expect(html).toMatch(/<aside class="[^"]*border-t-2 border-swiss-black[^"]*lg:col-span-3 lg:col-start-10/);
    expect(html).toMatch(/<label id="input-label" for="input" class="eyebrow">/);
  });

  it("tiers: three cards of 4 columns each, numbered 01-03 (decorative, aria-hidden) with real h2 headings", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const html = render(createElement(RiskCard, { result: r, demo: true }));
    const cards = tags(html, /(^| )card( |$)/);
    expect(cards).toHaveLength(3);
    for (const c of cards) expect(c[2]).toContain("lg:col-span-4");
    for (const n of ["01", "02", "03"]) expect(html).toContain(`<p class="eyebrow" aria-hidden="true">${n}</p>`);
    for (const t of ["Verified", "Reported", "Suspected"]) expect(html).toMatch(new RegExp(`<h2 id="tier-${t.toLowerCase()}"[^>]*>${t}</h2>`));
  });

  it("What to do now is a paper band with the heading in columns 1-4 and the steps in 5-12", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const html = render(createElement(RiskCard, { result: r }));
    expect(html).toMatch(/<section aria-labelledby="what-to-do" class="band"><div class="grid"><h2 id="what-to-do" class="t-h2 col-span-full lg:col-span-4">/);
    expect(html).toMatch(/<ol class="steps [^"]*lg:col-span-8 lg:col-start-5/);
  });

  it("risk meter: 1, 2 or 3 filled segments for Low, Elevated, High; the bold-underlined word marks the level", () => {
    const cases = [
      ["low", assessRisk({ verifiedMatches: 0, reportedIdentifiers: 0, suspectedRules: 0, unavailableSources: 0 }), 1],
      ["elevated", assessRisk({ verifiedMatches: 0, reportedIdentifiers: 0, suspectedRules: 2, unavailableSources: 0 }), 2],
      ["high", assessRisk({ verifiedMatches: 1, reportedIdentifiers: 0, suspectedRules: 0, unavailableSources: 0 }), 3],
    ] as const;
    for (const [level, risk, filled] of cases) {
      const html = render(createElement(RiskBadge, { risk }));
      expect(risk.level).toBe(level);
      expect(html).toContain(`<div class="meter mt-3 max-w-xs" data-level="${level}" aria-hidden="true">`);
      expect(html.match(/data-filled="true"/g)).toHaveLength(filled);
      expect(html.match(/class="meter__seg"/g)).toHaveLength(3);
      expect(html).toMatch(/class="font-semibold text-swiss-black underline underline-offset-4" aria-current="true"/);
      expect(html).toContain(`data-level="${level}">`);
    }
  });

  it("header and footer sit on the same grid; footer has a 2px black top rule", () => {
    expect(render(createElement(SiteHeader))).toMatch(/<div class="grid grid--bar">/);
    expect(render(createElement(SiteFooter))).toMatch(/border-t-2 border-swiss-black/);
  });
});

describe("Swiss controls (server-rendered)", () => {
  const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it("CSS: buttons, outline buttons, text links, text box and fields follow the spec", () => {
    const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
    const rule = (sel: string) => cssRules(css).find((r) => r.selector === sel)?.body ?? "";
    expect(rule(".button")).toMatch(/min-height: 44px;[\s\S]*padding: 1rem 2rem;[\s\S]*border: 1px solid var\(--swiss-black\);[\s\S]*border-radius: 0;[\s\S]*background: var\(--swiss-black\);[\s\S]*color: var\(--swiss-white\);[\s\S]*font-size: 0.875rem;[\s\S]*letter-spacing: 0.1em;[\s\S]*text-transform: uppercase;/);
    expect(rule(".button:hover")).toContain("background: var(--swiss-black-hover)");
    expect(rule(".button--outline")).toMatch(/background: transparent;\s*color: var\(--swiss-black\);/);
    expect(rule(".button--outline:hover")).toMatch(/background: var\(--swiss-black\);\s*color: var\(--swiss-white\);/);
    expect(rule(".btn-link")).toContain("min-height: 44px");
    expect(rule(".textarea")).toMatch(/min-height: 12rem;[\s\S]*border: 0;[\s\S]*border-top: 2px solid var\(--swiss-black\);[\s\S]*border-bottom: 1px solid var\(--swiss-rule\);[\s\S]*padding: 1.25rem 0;/);
    expect(rule(".field")).toContain("border-bottom: 1px solid var(--swiss-black)");
    // no control hides the focus outline any more
    expect(css).not.toMatch(/:focus(-visible)?\s*\{[^}]*outline:\s*none/);
  });

  it("open report form: inline, underline select, visible labels, 44px checkbox rows, black submit button", async () => {
    const r = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, offline);
    // Render the open state by rendering the form after a click is not possible here; assert via the component source instead.
    const src = readFileSync(join(import.meta.dirname, "..", "components", "ReportForm.tsx"), "utf8");
    expect(src).toMatch(/className="break-id flex min-h-11 items-center gap-3"/);
    expect(src).toMatch(/<legend className="eyebrow">Identifiers to include<\/legend>/);
    expect(src).toMatch(/className="field mt-2 self-start"/);
    expect(src).toMatch(/<button type="submit"[^>]*className="button">\s*Submit report/);
    expect(r.identifiers.length).toBeGreaterThan(0);
  });

  it("contested label is plain 600-weight clay text", () => {
    const html = render(
      createElement(ReportedList, {
        tier: { status: "ok", entries: [{ type: "upi", display: "zz***d@okdemo", reporters: 2, categories: ["investment"], firstReported: "2026-10-01", lastReported: "2026-10-02", synthetic: true, contested: true }] },
        identifiers: [],
      }),
    );
    expect(html).toContain('<span class="font-semibold text-swiss-clay">Contested, under review.</span>');
  });
});

describe("Swiss tiers and risk header (server-rendered)", () => {
  const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it("finding rows: 1px rules between rows, 600-weight black title, secondary detail, small source line with a link", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline); // sanctioned wallet: the local OFAC list matches offline
    expect(r.verified.some((v) => v.status === "match")).toBe(true);
    const html = render(createElement(RiskCard, { result: r, demo: true }));
    expect(html).toMatch(/<ul class="mt-2 flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule"><li class="flex flex-col py-4"><p class="font-semibold text-swiss-black">Match · /);
    expect(html).toMatch(/<p class="t-small mt-2 text-swiss-text">[^<]*· checked [^<]*<a href="[^"]+" target="_blank" rel="noreferrer" class="tap">source<\/a>/);
    expect(html).toMatch(/<span class="uppercase tracking-\[0.1em\]">evm<\/span> 0x/); // uppercase by CSS, string unchanged
  });

  it("High: the word carries data-level=high (alert colour by CSS) and the scale still names the level in words", async () => {
    const r = await runCheck({ text: SAMPLES[1].text }, offline);
    expect(r.risk.level).toBe("high");
    const html = render(createElement(RiskCard, { result: r, demo: true }));
    expect(html).toContain('<p class="t-risk risk-word" data-level="high">High</p>');
    expect(html).toMatch(/aria-current="true">High</);
    expect(html.match(/data-filled="true"/g)).toHaveLength(3);
  });

  it("suspected quotes are underlined 600-weight marks in black, rows divided by 1px rules", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const html = render(createElement(RiskCard, { result: r }));
    expect(html).toMatch(/<li class="flex flex-col py-4"><p class="font-semibold text-swiss-black">[^<]+<\/p><p class="mt-1 break-id text-swiss-black">“<mark class="quote">/);
    const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
    expect(cssRules(css).find((x) => x.selector === "mark.quote")?.body).toMatch(/background: transparent;[\s\S]*color: var\(--swiss-black\);[\s\S]*font-weight: 600;[\s\S]*text-decoration: underline;/);
  });

  it("empty and unavailable states keep their sentences (no-reports never claimed when the DB is down)", async () => {
    const empty = strip(render(createElement(RiskCard, { result: null })));
    for (const t of ["Paste something and press Check", "No verified matches.", "No known reports. This does not mean safe.", "No pattern signals yet."]) expect(empty).toContain(t);
    const r = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, offline);
    const text = strip(render(createElement(RiskCard, { result: r })));
    expect(text).toContain("Note: Reports database unavailable");
    expect(text).toContain("This is not a clean result.");
  });
});

describe("Swiss graph panel", () => {
  // G3: the drawing moved from GraphPanel.tsx into FitGraph.tsx (it needs the graph ref to zoom to fit).
  const panel = readFileSync(join(import.meta.dirname, "..", "components", "GraphPanel.tsx"), "utf8");
  const src = readFileSync(join(import.meta.dirname, "..", "components", "FitGraph.tsx"), "utf8");

  it("canvas drawing follows the spec (the canvas itself needs a browser; this pins the drawing code)", () => {
    expect(src).toContain('const INK = "#000000";');
    expect(src).toContain('const GREY = "#808080";');
    expect(src).toMatch(/ctx\.fillStyle = n\.focus \? INK : WHITE;/); // checked = filled black, others hollow
    expect(src).toContain("ctx.lineWidth = 1.5 / scale;");
    expect(src).toContain("linkColor={(l) => (onPath(l as Link) ? ALERT : GREY)}");
    expect(src).toContain("linkWidth={(l) => (onPath(l as Link) ? 2.5 : 1)}");
    expect(panel).toContain("p.text.includes(a) && p.text.includes(z)"); // both ends named in one listed path
    // labels black, centred below the circle, drawn over a white halo
    expect(src).toMatch(/ctx\.textAlign = "center";\s*ctx\.textBaseline = "top";\s*const y = n\.y \+ r \+ 3 \/ scale;/);
    expect(src).toMatch(/ctx\.strokeStyle = WHITE;\s*ctx\.strokeText\(n\.label, n\.x, y\);\s*ctx\.fillStyle = INK;\s*ctx\.fillText\(n\.label, n\.x, y\);/);
    // reduced motion kept: layout settled before first paint (no animation), no drag
    expect(src).toContain("warmupTicks={reduceMotion ? 160 : 0}");
    expect(src).toContain("cooldownTicks={reduceMotion ? 0 : 160}");
    expect(src).toContain("enableNodeDrag={!reduceMotion}");
  });

  it("G3: the graph zooms to fit with padding when the layout settles (instantly with reduced motion), on stable data", () => {
    expect(src).toContain("onEngineStop={fit}");
    expect(src).toContain("fg.current?.zoomToFit(reduceMotion ? 0 : 400, FIT_PADDING_PX)");
    expect(src).toMatch(/useMemo\(\(\) => \(\{ nodes: view\.nodes/);
    expect(src).not.toContain("Infinity"); // a never-ending cooldown never fires onEngineStop
    expect(src).toMatch(/zoomToFit\(0, FIT_PADDING_PX\), 50\);\s*return \(\) => clearTimeout\(t\);\s*\}, \[width, height\]\);/); // refit on resize
  });

  it("server render: full-width panel with a 2px top rule and text-link buttons, no canvas yet", () => {
    const html = renderToStaticMarkup(createElement(GraphPanel, { identifiers: extractIdentifiers("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359") }));
    expect(html).toMatch(/^<div class="flex flex-col border-t-2 border-swiss-black pt-4 print:border-t-0">/);
    expect(html).not.toContain("<canvas");
  });
});

describe("Swiss /about and 404 (server-rendered)", () => {
  it("/about: light h1, two-column sections (heading 1-4, text 5-11), alternate paper bands, sources as ruled rows", async () => {
    const { default: AboutPage } = await import("../app/about/page");
    const html = renderToStaticMarkup(createElement(AboutPage));
    expect(html).toMatch(/<h1 id="about-title" class="t-title col-span-full mt-4 lg:col-span-9">About ScamLens<\/h1>/);
    const sections = [...html.matchAll(/<section id="(\w+)" aria-labelledby="\w+-h"( class="band")?>/g)].map((m) => [m[1], Boolean(m[2])]);
    // G4d added the "Link graph" section before "Demo data" (bands still alternate).
    expect(sections.map(([id]) => id)).toEqual(["emergency", "what", "tiers", "reports", "contest", "sources", "privacy", "graph", "demo"]);
    sections.forEach(([, band], i) => expect(band).toBe(i % 2 === 1)); // white, paper, white, paper...
    expect(html.match(/<h2 id="\w+-h" class="t-h2 col-span-full lg:col-span-4">/g)).toHaveLength(9);
    expect(html.match(/class="col-span-full mt-6 flex flex-col gap-4 lg:col-span-7 lg:col-start-5 lg:mt-0"/g)).toHaveLength(9);
    expect(html).toMatch(/<ul class="flex flex-col divide-y divide-swiss-rule border-y border-swiss-rule"><li class="py-4">/);
  });

  it("404: an oversized decorative 404 (aria-hidden), the existing heading and the link back", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    expect(html).toContain('<p class="t-404 col-span-full" aria-hidden="true">404</p>');
    expect(strip(html)).toContain("Page not found");
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>Go to the check<\/a>/);
    const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
    expect(cssRules(css).find((r) => r.selector === ".t-404")?.body).toMatch(/font-size: clamp\(6rem, 20vw, 16rem\);[\s\S]*font-weight: 400;/); // finish round: regular, never light
  });
});

describe("Swiss fixes found in the browser", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
  const rule = (sel: string) => cssRules(css).find((r) => r.selector === sel)?.body ?? "";
  it("step numerals do not split a step's sentence into grid cells (a <strong> inside a step stays inline)", () => {
    expect(rule(".steps > li")).not.toContain("display: grid");
    expect(rule(".steps > li::before")).toMatch(/position: absolute;[\s\S]*font-size: 2rem;[\s\S]*font-weight: 400;/); // finish round: regular numerals
  });
  it("links inside sentences get a 44px tap area without a visible gap", () => {
    expect(rule(".tap")).toMatch(/padding: max\(0px, calc\(\(44px - 1\.1em\) \/ 2\)\) 0\.25rem;\s*margin-inline: -0\.25rem;/);
  });
});

describe("AI off (no key): rules only, screenshot reading hidden, no AI claims", () => {
  const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
  const AI_WORDS = /\bAI\b|provider|openai|model/i;

  it("check form without a vision model: no upload control, no provider note, the paste-instead line instead", () => {
    const html = render(createElement(CheckForm, { screenshots: false }));
    expect(strip(html)).not.toContain("Upload a screenshot instead");
    expect(html).not.toContain('type="file"');
    expect(strip(html)).toContain("Screenshot reading is off. Paste the text instead.");
    expect(strip(html)).not.toMatch(AI_WORDS);
  });

  it("check form with a vision model: the upload control and its privacy note are back", () => {
    const html = strip(render(createElement(CheckForm, { screenshots: true })));
    expect(html).toContain("Upload a screenshot instead");
    expect(html).toContain("sent once to our AI provider");
    expect(html).not.toContain("Screenshot reading is off");
  });

  it("home page decides from the same server check /api/health reports (vision)", async () => {
    const saved = { k: process.env.OPENAI_API_KEY, m: process.env.OPENAI_MODEL };
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_MODEL;
      expect(strip(render(createElement(Home)))).toContain("Screenshot reading is off");
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.OPENAI_MODEL = "test-model";
      expect(strip(render(createElement(Home)))).toContain("Upload a screenshot instead");
    } finally {
      if (saved.k === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.k;
      if (saved.m === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = saved.m;
    }
  });

  it("a result with AI off says rules only, never mentions AI, and does not count AI as an unavailable source", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    expect(r.ai.status).toBe("off");
    const text = strip(render(createElement(RiskCard, { result: r, demo: true })));
    expect(text).toContain("Suspected signals come from fixed pattern rules only.");
    expect(text).not.toMatch(AI_WORDS);
    // offline: only the reports DB is unavailable here (the sample has a UPI ID, no wallet)
    expect(r.risk.reasons).toContain("1 source(s) unavailable - result is incomplete");
  });

  it("a configured AI pass that was skipped is 'unavailable' and is named as such", async () => {
    const r = await runCheck({ text: "hello" }, { ...offline, skipAi: "The AI pass is paused for today (daily limit reached). Only the fixed rule checks ran." });
    expect(r.ai.status).toBe("unavailable");
    expect(strip(render(createElement(RiskCard, { result: r })))).toContain("AI pass: unavailable");
  });

  it("/about with AI off: one calm sentence, no screenshot provider; with a key the AI wording returns", async () => {
    const { default: AboutPage } = await import("../app/about/page");
    const saved = { k: process.env.OPENAI_API_KEY, m: process.env.OPENAI_MODEL };
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_MODEL;
      const off = strip(render(createElement(AboutPage)));
      expect(off).toContain("AI assistance is optional and currently off.");
      expect(off).toContain("Screenshots: Screenshot reading is off. Paste the text instead.");
      expect(off).not.toContain("AI provider");
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.OPENAI_MODEL = "test-model";
      const on = strip(render(createElement(AboutPage)));
      expect(on).toContain("sent once to our AI provider");
      expect(on).not.toContain("currently off");
    } finally {
      if (saved.k === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.k;
      if (saved.m === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = saved.m;
    }
  });
});

describe("report form is never offered on the synthetic samples (G5.2)", () => {
  it.each([0, 1, 2])("sample %i: no 'Report these identifiers' when the card is a demo", async (i) => {
    const r = await runCheck({ text: SAMPLES[i].text }, offline);
    expect(renderToStaticMarkup(createElement(RiskCard, { result: r, demo: true }))).not.toContain("Report these identifiers");
  });
  it("the same text typed by a person (not a demo) does offer the form when it has identifiers", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    expect(r.identifiers.length).toBeGreaterThan(0);
    expect(renderToStaticMarkup(createElement(RiskCard, { result: r, demo: false }))).toContain("Report these identifiers");
  });
});

describe("header links (H2a)", () => {
  it("ScamLens at left; Patterns, Verify a receipt and About at right, each with a 44 px tap area", async () => {
    const { NavLinks } = await import("../components/NavLinks");
    const html = renderToStaticMarkup(createElement(NavLinks, { current: null }));
    const links = [...html.matchAll(/<a ([^>]*)>([^<]+)<\/a>/g)].map((m) => [m[1].match(/href="([^"]+)"/)?.[1], m[2], m[1].match(/class="([^"]*)"/)?.[1] ?? ""]);
    expect(links.map(([h, t]) => [h, t])).toEqual([["/patterns", "Patterns"], ["/verify", "Verify a receipt"], ["/about", "About"]]);
    for (const [, , cls] of links) expect(cls).toMatch(/min-h-11 min-w-11/);
    expect(html).not.toContain("aria-current");
    expect(html).toMatch(/<ul class="flex flex-wrap/); // wraps instead of overflowing at 375 px
  });
  it("marks the current page with aria-current", async () => {
    const { NavLinks } = await import("../components/NavLinks");
    const html = renderToStaticMarkup(createElement(NavLinks, { current: "/verify" }));
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/verify"|<a [^>]*href="\/verify"[^>]*aria-current="page"/);
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });
  it("the footer keeps its links", () => {
    const footer = renderToStaticMarkup(createElement(SiteFooter));
    for (const h of ["/about", "/patterns", "/verify"]) expect(footer).toContain(`href="${h}"`);
  });
});
