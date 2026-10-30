import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { cssRules, PALETTE } from "../test-support/style";

// WCAG 2.x contrast of every text/background and UI pair the design declares, computed from the CSS variables
// as written in globals.css (not from a copy), plus the rules for where grey, tan and alert may appear.
const SRC = join(import.meta.dirname, "..");
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const rootBlock = CSS.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
const vars = Object.fromEntries([...rootBlock.matchAll(/(--swiss-[a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2].toLowerCase()]));
type Var = keyof typeof PALETTE;
const v = (name: Var) => vars[name];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum, where it is used]
const TEXT: [Var, Var, number, string][] = [
  ["--swiss-black", "--swiss-white", 4.5, "body text"],
  ["--swiss-black", "--swiss-paper", 4.5, "body text on a band"],
  ["--swiss-text", "--swiss-white", 4.5, "secondary text"],
  ["--swiss-text", "--swiss-paper", 4.5, "secondary text on a band"],
  ["--swiss-white", "--swiss-black", 4.5, "button label"],
  ["--swiss-white", "--swiss-black-hover", 4.5, "button label on hover"],
  ["--swiss-clay", "--swiss-white", 4.5, "link hover, contested label"],
  ["--swiss-clay", "--swiss-paper", 4.5, "link hover on a band"],
  ["--swiss-alert", "--swiss-white", 4.5, "the word High (large, but held to the normal-text bar)"],
];
const UI: [Var, Var, number, string][] = [
  ["--swiss-black", "--swiss-white", 3, "focus outline, 2px card rule, filled meter segment"],
  ["--swiss-black", "--swiss-paper", 3, "focus outline and card rule on a band"],
  ["--swiss-alert", "--swiss-white", 3, "High meter segments, evidence-path link"],
  ["--swiss-grey", "--swiss-white", 3, "graph links, empty meter segment outline, disabled border"],
  ["--swiss-tan", "--swiss-white", 3, "card hover rule (white only)"],
  ["--swiss-clay", "--swiss-paper", 3, "card hover rule on a band"],
];

function srcFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "test-support" ? [] : srcFiles(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

describe("contrast (WCAG, from the CSS variables)", () => {
  it("globals.css defines all ten palette values", () => expect(vars).toEqual(PALETTE));
  it.each(TEXT)("text %s on %s >= %d:1 (%s)", (fg, bg, min) => expect(contrast(v(fg), v(bg))).toBeGreaterThanOrEqual(min));
  it.each(UI)("UI %s on %s >= %d:1 (%s)", (fg, bg, min) => expect(contrast(v(fg), v(bg))).toBeGreaterThanOrEqual(min));
  it("tan fails on paper, which is why it is never used there", () => expect(contrast(v("--swiss-tan"), v("--swiss-paper"))).toBeLessThan(3));
  it("grey would fail as text, which is why it never carries text", () => expect(contrast(v("--swiss-grey"), v("--swiss-white"))).toBeLessThan(4.5));
});

describe("where grey, tan and alert may appear", () => {
  const rules = cssRules(CSS);

  it("grey and tan are never a text colour (CSS color/fill, Tailwind text-*, canvas text)", () => {
    const bad: string[] = [];
    for (const { selector, body } of rules)
      if (/(?<![-\w])(?:color|fill|-webkit-text-fill-color):\s*var\(--swiss-(?:grey|tan)\)/.test(body)) bad.push(selector);
    for (const f of srcFiles()) {
      const s = readFileSync(f, "utf8");
      if (/(?:text|placeholder|decoration)-swiss-(?:grey|tan)|--color-swiss-(?:grey|tan)/.test(s)) bad.push(relative(SRC, f));
      // On a canvas, text is drawn with fillStyle; grey and tan must never be assigned to it.
      if (/fillStyle\s*=\s*(?:GREY|TAN|"#808080"|"#b38b6d")/i.test(s)) bad.push(`${relative(SRC, f)} fillStyle`);
    }
    expect(bad).toEqual([]);
  });

  it("tan is never used on a paper band", () => {
    const bad = rules.filter((r) => /\.band/.test(r.selector) && /--swiss-tan/.test(r.body)).map((r) => r.selector);
    expect(bad).toEqual([]);
    // and the band rule exists, switching the card hover to clay
    expect(rules.some((r) => /\.band\s+\.card:hover/.test(r.selector) && /--swiss-clay/.test(r.body))).toBe(true);
  });

  it("alert is used only for High in the risk header (word and meter) and the graph's evidence-path link", () => {
    const cssUses = rules.filter((r) => /var\(--swiss-alert\)/.test(r.body)).map((r) => r.selector);
    expect(cssUses.length).toBeGreaterThan(0);
    for (const sel of cssUses) expect(sel).toMatch(/data-level="high"/);
    const fileUses = srcFiles()
      .filter((f) => !f.endsWith("globals.css"))
      .filter((f) => /swiss-alert|#b00020/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f).replaceAll("\\", "/"));
    // The graph drawing (the only alert use outside the CSS) moved from GraphPanel.tsx to FitGraph.tsx in G3.
    expect(fileUses).toEqual(["components/FitGraph.tsx"]);
  });
});
