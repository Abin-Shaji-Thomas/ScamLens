import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STORAGE_PROMISE } from "./privacy-copy";

const repo = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

describe("storage promise (final round P3)", () => {
  it("is the owner's exact sentence", () => {
    expect(STORAGE_PROMISE).toBe(
      "Your check is never stored. If you choose to contribute a case, we store structured facts and, only if you tick it, a redacted excerpt you reviewed, visible only to the moderator, deleted with your delete code or after 90 days.",
    );
  });
  it("/about shows it in the privacy section, and docs/PRIVACY.md opens with it word for word", () => {
    const about = repo("web/src/app/about/page.tsx");
    const privacy = about.slice(about.indexOf('<Section id="privacy"'), about.indexOf('<Section id="graph"'));
    expect(privacy).toContain("<li>{STORAGE_PROMISE}</li>");
    expect(repo("docs/PRIVACY.md").split("\n")[2]).toBe(STORAGE_PROMISE);
  });
  it("no current doc keeps the old absolute claim that nothing a user writes is ever stored", () => {
    for (const p of ["docs/knowledge/01-PROBLEM-AND-SOLUTION.md", "docs/knowledge/10-SECURITY-AND-ABUSE.md", "docs/knowledge/08-REPORTS-AND-PRIVACY.md"]) {
      expect(repo(p), p).not.toMatch(/Raw chats, transcripts, quotes and screenshots are never stored/);
    }
    expect(repo("docs/knowledge/01-PROBLEM-AND-SOLUTION.md")).toContain(STORAGE_PROMISE);
  });
});
