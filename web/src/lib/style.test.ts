import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// G4 style rules, enforced over every non-test .ts, .tsx and .css file in src.
const SRC = join(import.meta.dirname, "..");
const ALLOWED_HEX = new Set(["#ffffff", "#111111", "#767676", "#eeeeee"]);
const PALETTE_NAMES = "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black";
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

describe("G4 minimalist style rules", () => {
  it("no drop shadows", () => expect(offenders(/(?<![\w-])shadow(-[\w/[\]-]+)?(?![\w-])/)).toEqual([]));
  it("no rounded corners (rounded-none is allowed)", () =>
    expect(offenders(/(?<![\w-])(?:[a-z]+:)*rounded(-[\w-]+)?(?![\w-])/, (m) => /rounded-none$/.test(m))).toEqual([]));
  it("no gradients", () => expect(offenders(/gradient/i)).toEqual([]));
  it("no dark mode classes or media queries", () => {
    expect(offenders(/(?<![\w-])dark:/)).toEqual([]);
    expect(offenders(/prefers-color-scheme:\s*dark/)).toEqual([]);
  });
  it("no Tailwind palette colours (only white, transparent and the CSS-variable tokens ink/muted/hairline/paper)", () =>
    expect(offenders(COLOR_UTILITY)).toEqual([]));
  it("no arbitrary colour utilities like text-[#123456] or bg-[rgb(...)]", () =>
    expect(offenders(/(?:text|bg|border|fill|stroke|outline|ring|decoration|accent)-\[(?:#|rgb|hsl|oklch)/)).toEqual([]));
  it("every hex colour is one of #ffffff, #111111, #767676, #eeeeee", () =>
    expect(offenders(/(?<![&\w/])#[0-9a-fA-F]{3,8}(?![\w-])/, (m) => ALLOWED_HEX.has(m.toLowerCase()))).toEqual([]));
  it("the palette is defined once, as CSS variables in globals.css", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const v of ["--paper: #ffffff", "--ink: #111111", "--muted: #767676", "--hairline: #eeeeee"]) expect(css).toContain(v);
    expect(css).toMatch(/border-radius:\s*0/);
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--ink\);\s*outline-offset:\s*2px/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
  it("system font stack only: no next/font, no web font imports", () => {
    expect(offenders(/next\/font|fonts\.googleapis|@font-face/)).toEqual([]);
    expect(readFileSync(join(SRC, "app", "globals.css"), "utf8")).toContain('ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
  });
  it("the scanner itself catches violations", () => {
    expect("text-red-700 dark:bg-neutral-900 border-sky-600 hover:text-amber-500/50".match(COLOR_UTILITY)).toHaveLength(4);
    expect("text-white bg-transparent text-ink border-hairline text-muted bg-ink".match(COLOR_UTILITY)).toBeNull();
  });
});

// WCAG contrast of the palette (4.5:1 needed for normal text).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("G4 contrast", () => {
  it("ink and muted text on white both pass 4.5:1", () => {
    expect(contrast("#111111", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
