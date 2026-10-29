// Shared by the style and contrast tests: the Swiss palette and a tiny CSS rule splitter.
export const PALETTE = {
  "--swiss-black": "#000000",
  "--swiss-white": "#ffffff",
  "--swiss-paper": "#f5f1e8",
  "--swiss-text": "#4b5563",
  "--swiss-rule": "#e5e7eb",
  "--swiss-grey": "#808080",
  "--swiss-tan": "#b38b6d",
  "--swiss-clay": "#7a4f32",
  "--swiss-alert": "#b00020",
  "--swiss-black-hover": "#1f2937",
} as const;

/** Innermost CSS rules as {selector, body}; @media wrappers are dropped, which is enough for these checks. */
export function cssRules(css: string): { selector: string; body: string }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}
