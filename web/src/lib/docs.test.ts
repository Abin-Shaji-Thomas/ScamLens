import { describe, expect, it } from "vitest";
import { apply, checkDocs, facts, generators, loadDocs, manifestProblems, REQUIRED_FILES, SECTIONS } from "../../scripts/docs-lib";

// The knowledge base must stay in sync with the code (offline part of `npm run docs:check`; no git calls).
describe("docs/knowledge is in sync with the code", () => {
  const docs = loadDocs();
  const gens = generators();
  const fx = facts();

  it("every required file exists and has the six template sections, every generated block and fact is current", () => {
    expect(checkDocs(docs, gens, fx)).toEqual([]);
    expect(docs.map((d) => d.name)).toEqual(expect.arrayContaining(REQUIRED_FILES));
    expect(SECTIONS).toHaveLength(6);
  });

  it("the checker catches a stale fact, a stale block, a missing section, a broken link, a bad path and a banned quote", () => {
    const d = docs.find((x) => x.name === "06-SIGNAL-RULES.md")!;
    const broken = [
      { name: d.name, text: d.text.replace(/<!-- FACT:rule_count -->\d+<!-- \/FACT -->/, "<!-- FACT:rule_count -->17<!-- /FACT -->") },
      { name: "x1.md", text: "## In plain words\n<!-- GENERATED:START rules -->\nold\n<!-- GENERATED:END rules -->" },
      { name: "x2.md", text: "## Details\n[gone](missing-file.md)\n## Where in the code\n`web/src/lib/no-such-file.ts`\n## How to change it safely\n## How it is tested\n## Known limits\n" },
      { name: "x3.md", text: 'The card said "you are a scammer" here.' },
    ];
    const problems = checkDocs([...docs.filter((x) => x.name !== d.name), ...broken], gens, fx).join("\n");
    expect(problems).toContain('fact "rule_count" says "17"');
    expect(problems).toContain('generated block "rules" is stale');
    expect(problems).toContain('x2.md: missing section "## In plain words"');
    expect(problems).toContain("broken link missing-file.md");
    expect(problems).toContain("path does not exist: web/src/lib/no-such-file.ts");
    expect(problems).toContain('banned word "scammer"');
  });

  it("apply() rewrites blocks and facts and is idempotent", () => {
    const md = "a <!-- FACT:rule_count -->0<!-- /FACT --> b\n<!-- GENERATED:START chains -->\nx\n<!-- GENERATED:END chains -->";
    const once = apply(md, gens, fx);
    expect(once).toContain(`<!-- FACT:rule_count -->${fx.rule_count}<!-- /FACT -->`);
    expect(apply(once, gens, fx)).toBe(once);
  });

  it("MANIFEST rule: a changed source needs its doc and the changelog", () => {
    const m = { "06-SIGNAL-RULES.md": ["web/src/lib/signals/"] };
    expect(manifestProblems(m, ["web/src/lib/signals/rules.ts"])).toHaveLength(2);
    expect(manifestProblems(m, ["web/src/lib/signals/rules.ts", "docs/knowledge/06-SIGNAL-RULES.md", "docs/knowledge/17-CHANGELOG.md"])).toEqual([]);
    expect(manifestProblems(m, ["README.md"])).toEqual([]);
  });
});
