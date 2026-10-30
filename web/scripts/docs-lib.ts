// Knowledge-base sync: generated blocks and facts come from the code, and the checker fails on drift.
// Pure functions over file contents so the vitest test can run them offline (no git); the CLI scripts
// (docs-generate.ts, docs-check.ts) add the file writes and the git-based MANIFEST check.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DEFAULT_HUB_MAX } from "../src/lib/graph";
import * as LIMITS from "../src/lib/limits";
import { RULES } from "../src/lib/signals/rules";
import { usageLimits } from "../src/lib/usage";
import { EVM_CHAINS } from "../src/lib/verified/etherscan";
import { ETHERSCAN_MAX_ADDRESSES, MAX_ADDRESSES } from "../src/lib/verified/index";

export const WEB = join(import.meta.dirname, "..");
export const ROOT = join(WEB, "..");
export const KB = join(ROOT, "docs", "knowledge");

export const REQUIRED_FILES = [
  "README.md", "00-START-HERE.md", "01-PROBLEM-AND-SOLUTION.md", "02-HOW-IT-WORKS.md", "03-ARCHITECTURE.md",
  "04-TECH-STACK.md", "05-DATA-SOURCES.md", "06-SIGNAL-RULES.md", "07-RISK-ENGINE.md", "08-REPORTS-AND-PRIVACY.md",
  "09-GRAPH.md", "10-SECURITY-AND-ABUSE.md", "11-UI-DESIGN-SYSTEM.md", "12-TESTING-AND-EVAL.md", "13-OPERATIONS.md",
  "14-DEMO-AND-JUDGING.md", "15-DECISIONS-LOG.md", "16-KNOWN-GAPS-AND-ROADMAP.md", "17-CHANGELOG.md",
  "18-RELEASE-READINESS.md", "19-DISTINCTIVE-FEATURES.md", "20-LAUNCH-KIT.md",
];
export const SECTIONS = ["In plain words", "Details", "Where in the code", "How to change it safely", "How it is tested", "Known limits"];
// User-facing quotes in the docs must not contain these (the list itself is written on lines marked banned-list).
export const BANNED = ["scammer", "fraudster", "criminal", "guilty", "confirmed scam"];

const read = (p: string) => readFileSync(p, "utf8");
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c).replaceAll("|", "\\|")).join(" | ")} |`)].join("\n");

// ---------- sources read from the repo ----------

export function envVars(): { name: string; group: string; note: string }[] {
  const out: { name: string; group: string; note: string }[] = [];
  let group = "";
  let note: string[] = [];
  for (const line of read(join(WEB, ".env.example")).split(/\r?\n/)) {
    const g = line.match(/^#\s*---\s*(.+?)\s*---/);
    if (g) { group = g[1]; note = []; continue; }
    const c = line.match(/^#\s?(.*)$/);
    if (c) { note.push(c[1]); continue; }
    const v = line.match(/^([A-Z][A-Z0-9_]+)=/);
    if (v) { out.push({ name: v[1], group, note: note.join(" ").trim() }); note = []; }
    if (!line.trim()) note = [];
  }
  return out;
}

export function routes(): string[] {
  const app = join(WEB, "src", "app");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^(page|route)\.tsx?$/.test(name) || /^(opengraph-image|icon)\.(tsx|svg)$/.test(name)) {
        const url = "/" + relative(app, dir).replaceAll("\\", "/");
        const kind = name.startsWith("route") ? "API route" : name.startsWith("page") ? "page" : "image";
        out.push(`${url === "/" ? "/" : url}${kind === "image" ? `/${name.replace(/\.(tsx|svg)$/, "")}` : ""} (${kind}, \`web/src/app/${relative(app, p).replaceAll("\\", "/")}\`)`);
      }
    }
  };
  walk(app);
  return out;
}

export function dbObjects(): { file: string; kind: string; name: string }[] {
  const files = [join(WEB, "db", "schema.sql"), ...readdirSync(join(WEB, "db", "migrations")).sort().map((f) => join(WEB, "db", "migrations", f))];
  const out: { file: string; kind: string; name: string }[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/create\s+(?:or\s+replace\s+)?(table|view|function|index|unique\s+index)\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)/gi)) {
      out.push({ file: relative(ROOT, f).replaceAll("\\", "/"), kind: m[1].toLowerCase().replace(/\s+/, " "), name: m[2] });
    }
  }
  return out;
}

export interface EvalSummary { date: string; commit: string; cases: string; accuracy: string; precision: string; recall: string; fp: string; fn: string; fpList: string }
export function evalSummary(): EvalSummary {
  const s = read(join(ROOT, "eval", "RESULTS.md"));
  const get = (re: RegExp) => s.match(re)?.[1]?.trim() ?? "UNKNOWN";
  return {
    date: get(/- Date: (\S+)/),
    commit: get(/- Git commit: (.+)/),
    cases: get(/- Cases: (\d+)/),
    accuracy: get(/\| accuracy \| ([^|]+) \|/),
    precision: get(/\| precision \| ([^|]+) \|/),
    recall: get(/\| recall \| ([^|]+) \|/),
    fp: get(/\| false positives \| (\d+) of/),
    fn: get(/\| false negatives \| (\d+) of/),
    fpList: get(/False positives: (.+)/),
  };
}

/** Test files and how many it()/it.each() declarations each has (it.each expands to several tests when run). */
export function testInventory(): { file: string; count: number }[] {
  const out: { file: string; count: number }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".test.ts")) out.push({ file: relative(ROOT, p).replaceAll("\\", "/"), count: (read(p).match(/(?<![\w.])it(?:\.each\([\s\S]*?\))?\(/g) ?? []).length });
    }
  };
  walk(join(WEB, "src"));
  return out;
}

// ---------- generated blocks ----------

export function generators(opts: { gitLog?: string } = {}): Record<string, string> {
  const limits = usageLimits({});
  const ev = evalSummary();
  const pkg = JSON.parse(read(join(WEB, "package.json"))) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const gens: Record<string, string> = {
    rules: table(
      ["#", "id", "label", "patterns", "guards"],
      RULES.map((r, i) => [
        i + 1, `\`${r.id}\``, r.label, r.patterns.length,
        [r.negatable && "drops negated hits", r.adjacentNegation && "drops a negator right before", r.negation && "rule-specific negation", r.unlessFollowedBy && "ignores a code right after", r.needsCorroboration && "needs a second rule"].filter(Boolean).join("; ") || "none",
      ]),
    ),
    env: table(["name", "group", "what it is (from .env.example)"], envVars().map((e) => [`\`${e.name}\``, e.group, e.note || "-"])),
    limits: table(["limit", "value", "source"], [
      ["Text characters per check", LIMITS.MAX_TEXT_CHARS, "`MAX_TEXT_CHARS`"],
      ["Image data URL characters", LIMITS.MAX_IMAGE_DATAURL_CHARS, "`MAX_IMAGE_DATAURL_CHARS`"],
      ["Identifiers per check", LIMITS.MAX_IDENTIFIERS, "`MAX_IDENTIFIERS`"],
      ["Graph lookups per result", LIMITS.MAX_GRAPH_LOOKUPS, "`MAX_GRAPH_LOOKUPS`"],
      ["JSON body characters (check)", LIMITS.MAX_JSON_BODY_CHARS, "`MAX_JSON_BODY_CHARS`"],
      ["Independent reporters before Reported shows", LIMITS.MIN_INDEPENDENT_REPORTERS, "`MIN_INDEPENDENT_REPORTERS`"],
      ["Report retention (days)", LIMITS.REPORT_RETENTION_DAYS, "`REPORT_RETENTION_DAYS`"],
      ["Reports per network per day (default)", LIMITS.DEFAULT_REPORTS_MAX_PER_DAY, "`DEFAULT_REPORTS_MAX_PER_DAY` / `REPORTS_MAX_PER_DAY`"],
      ["Usage counter retention (days)", LIMITS.USAGE_COUNTER_RETENTION_DAYS, "`USAGE_COUNTER_RETENTION_DAYS`"],
      ["Contest reason retention (days, after migration 003)", LIMITS.CONTEST_RETENTION_DAYS, "`CONTEST_RETENTION_DAYS`"],
      ["Checks per network per day (default)", limits.check, "`usageLimits` / `USAGE_CHECK_PER_DAY`"],
      ["Screenshot readings per network per day (default)", limits.transcribe, "`usageLimits` / `USAGE_TRANSCRIBE_PER_DAY`"],
      ["Graph lookups per network per day (default)", limits.graph, "`usageLimits` / `USAGE_GRAPH_PER_DAY`"],
      ["Contests per network per day (default)", limits.contest, "`usageLimits` / `USAGE_CONTEST_PER_DAY`"],
      ["Server-side receipt checks per network per day (default)", limits.verify, "`usageLimits` / `USAGE_VERIFY_PER_DAY`"],
      ["AI calls per day, all users (default)", limits.globalLlm, "`usageLimits` / `USAGE_GLOBAL_LLM_PER_DAY`"],
      ["Crypto addresses checked per message", MAX_ADDRESSES, "`MAX_ADDRESSES`"],
      ["Wallets with Etherscan history per message", ETHERSCAN_MAX_ADDRESSES, "`ETHERSCAN_MAX_ADDRESSES`"],
      ["Graph hub filter (max counterparties)", DEFAULT_HUB_MAX, "`DEFAULT_HUB_MAX` / `GRAPH_HUB_MAX`"],
    ]),
    chains: table(["chain", "chain id", "checked on the free Etherscan plan"], EVM_CHAINS.map((c) => [c.name, c.id, c.freeTier ? "yes" : "no (needs ETHERSCAN_PLAN=paid)"])),
    routes: routes().map((r) => `- ${r}`).join("\n"),
    deps: table(["package", "version", "kind"], [
      ...Object.entries(pkg.dependencies).map(([k, v]) => [`\`${k}\``, v, "runtime"]),
      ...Object.entries(pkg.devDependencies).map(([k, v]) => [`\`${k}\``, v, "dev only"]),
    ]),
    db: table(["object", "kind", "file"], dbObjects().map((o) => [`\`${o.name}\``, o.kind, `\`${o.file}\``])),
    eval: table(["metric (rules only)", "value"], [
      ["cases", ev.cases], ["accuracy", ev.accuracy], ["precision", ev.precision], ["recall", ev.recall],
      ["false positives", ev.fp], ["false negatives", ev.fn], ["false positive cases", ev.fpList], ["run date", ev.date], ["commit", ev.commit],
    ]),
  };
  gens.tests = table(["test file", "it / it.each declarations"], testInventory().map((t) => [`\`${t.file}\``, t.count]));
  if (opts.gitLog !== undefined) gens.commits = commitSummary(opts.gitLog);
  return gens;
}

/** `git log --format=%ad|%s --date=short` grouped by day (newest first). */
export function commitSummary(log: string): string {
  const days = new Map<string, string[]>();
  for (const line of log.split(/\r?\n/).filter(Boolean)) {
    const [d, ...s] = line.split("|");
    days.set(d, [...(days.get(d) ?? []), s.join("|")]);
  }
  return [...days.entries()].map(([d, subs]) => `- **${d}** (${subs.length} commits): ${subs.map((s) => s.replaceAll("|", "/")).join("; ")}`).join("\n");
}

// ---------- facts embedded in prose ----------

export function facts(): Record<string, string> {
  const ev = evalSummary();
  const l = usageLimits({});
  const en = (n: number) => n.toLocaleString("en-IN");
  return {
    rule_count: String(RULES.length),
    max_text_chars: en(LIMITS.MAX_TEXT_CHARS),
    max_identifiers: String(LIMITS.MAX_IDENTIFIERS),
    min_reporters: String(LIMITS.MIN_INDEPENDENT_REPORTERS),
    report_retention_days: String(LIMITS.REPORT_RETENTION_DAYS),
    checks_per_day: String(l.check),
    contests_per_day: String(l.contest),
    contest_retention_days: String(LIMITS.CONTEST_RETENTION_DAYS),
    hub_max: String(DEFAULT_HUB_MAX),
    free_chains: EVM_CHAINS.filter((c) => c.freeTier).map((c) => c.name).join(", "),
    eval_cases: ev.cases,
    eval_accuracy: ev.accuracy,
    eval_precision: ev.precision,
    eval_recall: ev.recall,
    eval_fp: ev.fp,
    eval_fn: ev.fn,
  };
}

// ---------- apply and check ----------

const BLOCK = /<!-- GENERATED:START ([\w-]+) -->\n?([\s\S]*?)<!-- GENERATED:END \1 -->/g;
const FACT = /<!-- FACT:([\w-]+) -->([\s\S]*?)<!-- \/FACT -->/g;

export function apply(md: string, gens: Record<string, string>, fx: Record<string, string>): string {
  return md
    .replace(BLOCK, (all, name: string) => (name in gens ? `<!-- GENERATED:START ${name} -->\n${gens[name]}\n<!-- GENERATED:END ${name} -->` : all))
    .replace(FACT, (all, name: string) => (name in fx ? `<!-- FACT:${name} -->${fx[name]}<!-- /FACT -->` : all));
}

export interface Doc { name: string; text: string }
export const loadDocs = (): Doc[] =>
  readdirSync(KB).filter((f) => f.endsWith(".md")).sort().map((name) => ({ name, text: read(join(KB, name)) }));

/** Every problem with the knowledge base, as readable strings. Empty = in sync. */
export function checkDocs(docs: Doc[], gens: Record<string, string>, fx: Record<string, string>, exists: (repoPath: string) => boolean = (p) => existsSync(join(ROOT, p))): string[] {
  const problems: string[] = [];
  const names = new Set(docs.map((d) => d.name));
  for (const f of REQUIRED_FILES) if (!names.has(f)) problems.push(`missing file docs/knowledge/${f}`);
  for (const d of docs) {
    for (const s of SECTIONS) if (!new RegExp(`^## ${s}\\s*$`, "m").test(d.text)) problems.push(`${d.name}: missing section "## ${s}"`);
    for (const m of d.text.matchAll(BLOCK)) {
      const name = m[1];
      if (!(name in gens)) { if (name !== "commits") problems.push(`${d.name}: unknown generated block "${name}"`); continue; }
      if (m[2].trim() !== gens[name].trim()) problems.push(`${d.name}: generated block "${name}" is stale (run npm run docs:generate)`);
    }
    for (const m of d.text.matchAll(FACT)) {
      if (!(m[1] in fx)) problems.push(`${d.name}: unknown fact "${m[1]}"`);
      else if (m[2] !== fx[m[1]]) problems.push(`${d.name}: fact "${m[1]}" says "${m[2]}" but the code says "${fx[m[1]]}"`);
    }
    // internal links
    for (const m of d.text.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (!target) continue;
      const repoPath = relative(ROOT, join(KB, target)).replaceAll("\\", "/");
      if (!exists(repoPath)) problems.push(`${d.name}: broken link ${m[1]}`);
    }
    // paths under "Where in the code"
    const where = d.text.match(/^## Where in the code\s*$([\s\S]*?)(?=^## )/m)?.[1] ?? "";
    for (const m of where.matchAll(/`((?:web|graph|eval|docs)\/[^`\s*]+)`/g)) {
      if (!exists(m[1].replace(/\/$/, ""))) problems.push(`${d.name}: "Where in the code" path does not exist: ${m[1]}`);
    }
    // banned words inside quoted UI strings (lines that list the banned words are marked banned-list)
    d.text.split("\n").forEach((line, i) => {
      if (line.includes("banned-list")) return;
      for (const q of line.matchAll(/"([^"]{2,200})"/g)) {
        const hit = BANNED.find((w) => q[1].toLowerCase().includes(w));
        if (hit) problems.push(`${d.name}:${i + 1}: quoted text contains banned word "${hit}"`);
      }
    });
  }
  return problems;
}

/** MANIFEST: doc -> source paths. A changed source needs its doc and the changelog changed too. */
export function manifestProblems(manifest: Record<string, string[]>, changed: string[]): string[] {
  const set = new Set(changed);
  const problems: string[] = [];
  const changelog = "docs/knowledge/17-CHANGELOG.md";
  for (const [doc, sources] of Object.entries(manifest)) {
    const touched = changed.filter((c) => sources.some((s) => (s.endsWith("/") ? c.startsWith(s) : c === s)));
    if (!touched.length) continue;
    const docPath = `docs/knowledge/${doc}`;
    if (!set.has(docPath)) problems.push(`${touched.join(", ")} changed but ${docPath} did not`);
    if (!set.has(changelog)) problems.push(`${touched.join(", ")} changed but ${changelog} did not`);
  }
  return [...new Set(problems)];
}
