import { describe, expect, it } from "vitest";
import { apply, checkDocs, checkExtraDocs, EXTRA_DOCS, facts, generators, HISTORY_DOCS, loadDocs, loadExtraDocs, loadStalePhrases, manifestProblems, migrationList, REQUIRED_FILES, SECTIONS, staleProblems, WEB } from "../../scripts/docs-lib";
import { smokeExpectationCount } from "../../scripts/smoke-expectations";

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

describe("docs outside the knowledge base, and stale phrases (H6)", () => {
  const gens = generators();
  const fx = facts();
  const kb = loadDocs();
  const extra = loadExtraDocs();

  it("README, DEPLOY, HUMAN_TASKS and UI_CHECKLIST facts, blocks and links are current", () => {
    expect(extra.map((d) => d.name)).toEqual(EXTRA_DOCS);
    expect(checkExtraDocs(extra, gens, fx)).toEqual([]);
  });

  it("each extra doc quotes the facts a person relies on", () => {
    const text = (n: string) => extra.find((d) => d.name === n)!.text;
    expect(text("README.md")).toContain("<!-- FACT:rule_count -->");
    expect(text("docs/DEPLOY.md")).toContain("<!-- FACT:smoke_expectations -->");
    for (const f of ["smoke_expectations", "db_migrations", "graph_migrations", "rule_count"]) expect(text("docs/HUMAN_TASKS.md"), f).toContain(`<!-- FACT:${f} -->`);
    expect(text("docs/UI_CHECKLIST.md")).toContain("<!-- FACT:rule_count -->");
  });

  it("new facts come from the code: smoke count, migration lists", () => {
    expect(fx.smoke_expectations).toBe(String(smokeExpectationCount(true)));
    expect(smokeExpectationCount(true) - smokeExpectationCount(false)).toBe(3); // one receipt check per sample
    expect(fx.db_migrations).toBe(migrationList(`${WEB}/db/migrations`, ".sql"));
    expect(fx.db_migrations).toMatch(/^`002_contest_policy\.sql`, `003_contest_retention\.sql`/);
    expect(fx.graph_migrations).toContain("`001_report_reporter_key.gsql`");
  });

  it("the checker catches a stale fact and a broken link in an extra doc", () => {
    const d = { name: "docs/DEPLOY.md", text: "x <!-- FACT:smoke_expectations -->12<!-- /FACT --> [gone](no-such.md) [ok](HUMAN_TASKS.md)" };
    const p = checkExtraDocs([d], gens, fx).join("\n");
    expect(p).toContain('fact "smoke_expectations" says "12"');
    expect(p).toContain("broken link no-such.md");
    expect(p).not.toContain("HUMAN_TASKS.md");
  });

  it("no checked doc repeats a stale phrase; history docs and allowIn are exempt; matching ignores case", () => {
    const phrases = loadStalePhrases();
    expect(phrases.length).toBeGreaterThan(5);
    for (const p of phrases) expect(p.phrase.length >= 8 && p.why.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.since), p.phrase).toBe(true);
    expect(staleProblems([...kb, ...extra], phrases)).toEqual([]);
    const probe = [
      { name: "02-HOW-IT-WORKS.md", text: "line one\nwebsite DOMAINS ARE NOT CHECKED here" },
      { name: HISTORY_DOCS[0], text: "Domains are not checked (history)" },
    ];
    const found = staleProblems(probe, phrases);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^02-HOW-IT-WORKS\.md:2: stale phrase "Domains are not checked"/);
    expect(staleProblems([{ name: "16-KNOWN-GAPS-AND-ROADMAP.md", text: "Segoe UI Light" }], phrases)).toEqual([]);
  });
});

