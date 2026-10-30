import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../app/page";
import { ExampleCheckForm } from "../components/ExampleCheckForm";
import PatternsPage from "../app/patterns/page";
import { exampleHref, patternExample } from "./pattern-example";
import { DEMO_LABEL } from "./demo";
import { PATTERN_GUIDE } from "./signals/pattern-guide";
import { RULES } from "./signals/rules";

const home = async (q: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup(await ExampleCheckForm({ searchParams: Promise.resolve(q), screenshots: false }));
const textarea = (html: string) => html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? null;
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("?example=<rule_id> (H2d)", () => {
  it("accepts every rule id with a guide entry and returns that rule's own example", () => {
    for (const r of RULES) expect(patternExample(r.id)).toEqual({ ruleId: r.id, name: PATTERN_GUIDE[r.id].name, text: PATTERN_GUIDE[r.id].example });
  });

  it("rejects missing, repeated, unknown and inherited keys", () => {
    for (const bad of [undefined, "", "nope", "GUARANTEED_RETURNS", " guaranteed_returns", "constructor", "__proto__", "toString", "<script>"]) {
      expect(patternExample(bad), String(bad)).toBeNull();
    }
    expect(patternExample(["guaranteed_returns", "withdrawal_fee"])).toBeNull();
  });

  it("valid: the home page pre-fills the box with the example and labels it, but does not run the check", async () => {
    const id = RULES[0].id;
    const html = await home({ example: id });
    expect(unescape(textarea(html) ?? "")).toBe(PATTERN_GUIDE[id].example);
    expect(html).toContain(`data-example="${id}"`);
    expect(unescape(html)).toContain(`Example from the pattern library: ${PATTERN_GUIDE[id].name}. Edit it or press Check.`);
    expect(html).toContain(DEMO_LABEL); // invented text: marked as illustrative, like the samples
    expect(html).not.toContain("Checking...");
    expect(html).not.toMatch(/data-status=/); // no result card content
    expect(html).toMatch(/<button type="submit" class="button">Check<\/button>/); // enabled, waiting for the user
  });

  it("invalid or missing: an empty box with no example note", async () => {
    for (const q of [{}, { example: "nope" }, { example: ["a", "b"] }]) {
      const html = await home(q);
      expect(textarea(html)).toBe("");
      expect(html).not.toContain("data-example");
      expect(html).not.toContain(DEMO_LABEL);
      expect(html).toMatch(/<button type="submit" disabled="" class="button">Check<\/button>/);
    }
  });

  it("the home page keeps a prerendered shell: the param is read only inside <Suspense>, with the empty form as fallback", () => {
    const html = renderToStaticMarkup(Home({ searchParams: new Promise(() => {}) }));
    expect(html).toContain("Evidence-linked scam check for India.");
    expect(textarea(html)).toBe("");
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/<Suspense fallback=\{<CheckForm screenshots=\{screenshots\} \/>\}>\s*<ExampleCheckForm/);
    expect(page).not.toMatch(/await searchParams/);
  });

  it("/patterns has a Check a message link at the top and one Try this example link per rule", () => {
    const html = renderToStaticMarkup(createElement(PatternsPage));
    const check = html.match(/<a [^>]*data-check-link="true"[^>]*>Check a message<\/a>/)?.[0] ?? "";
    expect(check).toContain('href="/"');
    expect(check).toContain('class="button"');
    expect(html.indexOf("data-check-link")).toBeLessThan(html.indexOf(`<section id="${RULES[0].id}"`));
    expect(html.match(/>Try this example</g)).toHaveLength(RULES.length);
    for (const r of RULES) {
      const tag = html.match(new RegExp(`<a [^>]*data-try="${r.id}"[^>]*>Try this example</a>`))?.[0] ?? "";
      expect(tag, r.id).toContain(`href="${exampleHref(r.id)}"`);
      expect(tag, r.id).toContain('class="inline-flex min-h-11 items-center"');
      expect(patternExample(new URL(exampleHref(r.id), "http://x").searchParams.get("example") ?? undefined)?.ruleId).toBe(r.id);
    }
  });
});
