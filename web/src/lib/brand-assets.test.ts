import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("brand assets (P7b)", () => {
  const png = (p: string) => {
    const b = readFileSync(join(WEB, "..", p));
    return { sig: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  it("are exported at the stated sizes from icon.svg, and the READMEs show the logo with alt text", () => {
    expect(readFileSync(join(WEB, "..", "docs/assets/logo.svg"), "utf8")).toBe(readFileSync(join(WEB, "src/app/icon.svg"), "utf8"));
    expect(png("docs/assets/logo-512.png")).toEqual({ sig: "PNG", w: 512, h: 512 });
    expect(png("docs/assets/logo-192.png")).toEqual({ sig: "PNG", w: 192, h: 192 });
    expect(png("docs/assets/social-1200x630.png")).toEqual({ sig: "PNG", w: 1200, h: 630 });
    expect(png("web/src/app/apple-icon.png")).toEqual({ sig: "PNG", w: 180, h: 180 });
    expect(readFileSync(join(WEB, "..", "README.md"), "utf8").split("\n")[0]).toBe('<p align="center"><img src="docs/assets/logo-512.png" width="120" alt="ScamLens logo"></p>');
    expect(readFileSync(join(WEB, "..", "docs/knowledge/README.md"), "utf8")).toContain('alt="ScamLens logo"');
  });
});
