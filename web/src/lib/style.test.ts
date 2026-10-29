import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { cssRules, PALETTE } from "../test-support/style";

// Swiss-style rules (UI round; replaces the G4 four-colour palette on purpose), enforced over every non-test
// .ts, .tsx and .css file in src.
const SRC = join(import.meta.dirname, "..");
const CSS_PATH = join(SRC, "app", "globals.css");
const ALLOWED_HEX = new Set<string>(Object.values(PALETTE));
// Tailwind's own palette, including black and white: only the CSS-variable tokens (text-swiss-black etc.) are allowed.
const PALETTE_NAMES = "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const COLOR_UTILITY = new RegExp(
  String.raw`(?<![\w-])(?:[a-z0-9-]+:)*(?:text|bg|border(?:-[trblxyse])?|outline|ring|ring-offset|fill|stroke|decoration|from|to|via|accent|caret|divide|placeholder|shadow)-(?:${PALETTE_NAMES})(?:-\d{2,3})?(?:\/\d+)?(?![\w-])`,
  "g",
);

function files(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "test-support" ? [] : files(p);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

function offenders(re: RegExp, allow: (m: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const f of files()) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
        if (!allow(m[0])) out.push(`${relative(SRC, f)}:${i + 1} ${m[0]}`);
      }
    });
  }
  return out;
}

describe("Swiss style rules", () => {
  it("no drop shadows", () => expect(offenders(/(?<![\w-])shadow(-[\w/[\]-]+)?(?![\w-])/)).toEqual([]));
  it("no rounded corners (rounded-none is allowed)", () =>
    expect(offenders(/(?<![\w-])(?:[a-z]+:)*rounded(-[\w-]+)?(?![\w-])/, (m) => /rounded-none$/.test(m))).toEqual([]));
  it("no gradients", () => expect(offenders(/gradient/i)).toEqual([]));
  it("no dark mode classes or media queries", () => {
    expect(offenders(/(?<![\w-])dark:/)).toEqual([]);
    expect(offenders(/prefers-color-scheme:\s*dark/)).toEqual([]);
  });
  it("no Tailwind palette colours (only the CSS-variable tokens text-swiss-*, bg-swiss-*, border-swiss-*)", () =>
    expect(offenders(COLOR_UTILITY)).toEqual([]));
  it("no arbitrary colour utilities like text-[#123456] or bg-[rgb(...)]", () =>
    expect(offenders(/(?:text|bg|border|fill|stroke|outline|ring|decoration|accent)-\[(?:#|rgb|hsl|oklch|var)/)).toEqual([]));
  it("every hex colour is one of the ten palette values", () =>
    expect(offenders(/(?<![&\w/])#[0-9a-fA-F]{3,8}(?![\w-])/, (m) => ALLOWED_HEX.has(m.toLowerCase()))).toEqual([]));
  it("the palette is defined once, as CSS variables in globals.css, light only", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    for (const [name, hex] of Object.entries(PALETTE)) expect(css).toContain(`${name}: ${hex};`);
    expect(css).toMatch(/color-scheme:\s*only light/);
    expect(css).toMatch(/border-radius:\s*0/);
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--swiss-black\);\s*outline-offset:\s*3px/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*transition: none !important/);
  });
  it("system font stack only: no next/font, no web font imports", () => {
    expect(offenders(/next\/font|fonts\.googleapis|@font-face/)).toEqual([]);
    expect(readFileSync(CSS_PATH, "utf8")).toContain('--font: "Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif;');
  });
  it("motion: transitions are 200ms and only on color, background-color or border-color; no keyframe animation", () => {
    const bad: string[] = [];
    for (const { selector, body } of cssRules(readFileSync(CSS_PATH, "utf8"))) {
      for (const m of body.matchAll(/transition(?:-property)?:\s*([^;]+);/g)) {
        if (m[1].trim() === "none !important") continue;
        for (const part of m[1].split(",")) {
          if (!/^\s*(color|background-color|border-color|border-top-color|border-bottom-color) 200ms ease\s*$/.test(part)) bad.push(`${selector}: ${part}`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(offenders(/@keyframes|(?<![\w-])animate-[\w-]+|(?<![\w-])transition-(?:all|transform)\b/)).toEqual([]);
  });
  it("the scanner itself catches violations", () => {
    expect("text-red-700 dark:bg-neutral-900 border-sky-600 hover:text-amber-500/50 text-white bg-black".match(COLOR_UTILITY)).toHaveLength(6);
    expect("bg-transparent text-swiss-black border-swiss-rule text-swiss-text bg-swiss-paper".match(COLOR_UTILITY)).toBeNull();
  });
});
