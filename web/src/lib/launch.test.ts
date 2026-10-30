import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metadata, siteUrl } from "../app/layout";
import { alt, contentType, size } from "../app/opengraph-image";

const ALLOWED = new Set(["#000000", "#ffffff", "#f5f1e8", "#4b5563", "#e5e7eb", "#808080", "#b38b6d", "#7a4f32", "#b00020", "#1f2937"]);

describe("share preview", () => {
  it("metadata: title, description, Open Graph and a large Twitter card", () => {
    expect(metadata.title).toBe("ScamLens");
    expect(metadata.description).toMatch(/^Evidence-linked scam check for India/);
    expect(metadata.openGraph).toMatchObject({ title: "ScamLens", siteName: "ScamLens", type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
  it("metadataBase comes from the optional NEXT_PUBLIC_SITE_URL and ignores a bad value", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://scam-lens-two.vercel.app" })?.origin).toBe("https://scam-lens-two.vercel.app");
    expect(siteUrl({})).toBeUndefined();
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "not a url" })).toBeUndefined();
  });
  it("the share image is 1200x630 PNG with the wordmark and line, in palette colours only", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toBe("ScamLens: evidence-linked scam check for India");
    const src = readFileSync(new URL("../app/opengraph-image.tsx", import.meta.url), "utf8");
    expect(src).toContain(">ScamLens<");
    expect(src).toContain("Evidence-linked scam check for India");
    for (const hex of src.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(ALLOWED.has(hex.toLowerCase()), hex).toBe(true);
    expect(src).not.toMatch(/fonts:|readFile|fetch\(/); // no web font loaded
  });
  it("the icon is a monochrome SVG in palette colours", () => {
    const svg = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");
    for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(ALLOWED.has(hex.toLowerCase()), hex).toBe(true);
    expect(new Set(svg.match(/#[0-9a-fA-F]{6}\b/g)).size).toBeLessThanOrEqual(2);
  });
});
