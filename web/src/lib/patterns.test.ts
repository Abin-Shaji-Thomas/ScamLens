import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PatternsPage from "../app/patterns/page";
import { RiskCard } from "../components/RiskCard";
import { SiteFooter } from "../components/SiteFooter";
import { runCheck, type RunDeps } from "./check";
import { SAMPLES } from "./samples";
import { PATTERN_GUIDE } from "./signals/pattern-guide";
import { runRules } from "./signals/regex";
import { RULES } from "./signals/rules";

const BANNED = /\b(scammer|fraudster|criminal|guilty|confirmed scam)\b/i;
const html = renderToStaticMarkup(createElement(PatternsPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const offline: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date(), env: {}, db: null };

describe("pattern library (/patterns)", () => {
  it("is generated from rules.ts: every rule appears once, with an anchor, and the guide has no extra entries", () => {
    for (const r of RULES) {
      expect(html.match(new RegExp(`<section id="${r.id}"`, "g")), r.id).toHaveLength(1);
      expect(PATTERN_GUIDE[r.id], r.id).toBeTruthy();
    }
    expect(Object.keys(PATTERN_GUIDE).sort()).toEqual(RULES.map((r) => r.id).sort());
  });

  it("each rule has a plain name, what it looks like, why, what to do, an illustrative example, exclusions and how it counts", () => {
    for (const label of ["What it looks like", "Why such messages use it", "What to do", "Illustrative example", "When it is not a signal", "How it counts"]) {
      expect(text.split(label).length - 1, label).toBe(RULES.length);
    }
    expect(text).toContain("These are patterns, not verdicts.");
  });

  it("every synthetic example actually triggers its own rule in the real engine", () => {
    for (const r of RULES) expect(runRules(PATTERN_GUIDE[r.id].example).map((s) => s.rule_id), r.id).toContain(r.id);
  });

  it("exclusions come from the rule's own guards (negation, corroboration) plus warning context", () => {
    const sectionOf = (id: string) => text.split(`rule ${id}`)[1]?.split("How it counts")[0] ?? "";
    expect(sectionOf("move_platform")).toContain("It counts only when a second, different pattern is also found.");
    expect(sectionOf("otp_pin_request")).toContain("A negation earlier in the same sentence cancels it");
    expect(sectionOf("guaranteed_returns")).toContain("A negation right before it cancels it");
    expect(sectionOf("withdrawal_fee")).not.toContain("second, different pattern");
    for (const r of RULES) expect(sectionOf(r.id)).toContain("shown but not counted");
  });

  it("uses no accusation words (banned-words rule)", () => {
    expect(text).not.toMatch(BANNED);
    for (const g of Object.values(PATTERN_GUIDE)) expect(Object.values(g).join(" ")).not.toMatch(BANNED);
  });

  it("the footer links to /patterns and each Suspected finding links to its rule's anchor", async () => {
    expect(renderToStaticMarkup(createElement(SiteFooter))).toContain('href="/patterns"');
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const card = renderToStaticMarkup(createElement(RiskCard, { result: r }));
    for (const s of r.suspected) expect(card).toContain(`href="/patterns#${s.rule_id}"`);
  });
});
