// Scores the ScamLens text-signal engine and identifier extractor on eval/chats.json (synthetic)
// and writes eval/RESULTS.md. A chat is predicted "scam" when the engine yields at least one
// suspected signal, i.e. the risk card would show Elevated or higher from text alone.
// Modes: regex-only always; with-AI too when OPENAI_API_KEY (+ OPENAI_MODEL) is set.
// Run from web/: npm run eval
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractIdentifiers, uniqueIdentifiers } from "../web/src/lib/identifiers";
import { detectSignals } from "../web/src/lib/signals";
import { RULES } from "../web/src/lib/signals/rules";

// This file lives outside web/, so it imports only web/src modules (whose packages resolve from web/node_modules).
type Id = { type: string; value: string };
type Chat = {
  id: string;
  label: "scam" | "normal";
  type: string;
  text: string;
  expected_rules: string[];
  identifiers: Id[];
  hard_negative?: boolean;
  obfuscation?: string;
};

function parseChats(raw: unknown): Chat[] {
  const d = raw as { synthetic?: unknown; chats?: unknown };
  if (d.synthetic !== true || !Array.isArray(d.chats)) throw new Error("chats.json must be {synthetic:true, chats:[...]}");
  const known = new Set(RULES.map((r) => r.id));
  for (const c of d.chats as Chat[]) {
    if (typeof c.id !== "string" || typeof c.text !== "string" || (c.label !== "scam" && c.label !== "normal")) {
      throw new Error(`bad chat entry: ${String(c.id)}`);
    }
    if (!Array.isArray(c.expected_rules) || !Array.isArray(c.identifiers)) throw new Error(`${c.id}: expected_rules and identifiers are required`);
    for (const r of c.expected_rules) if (!known.has(r)) throw new Error(`${c.id}: unknown rule ${r}`);
    if (c.label === "normal" && c.expected_rules.length) throw new Error(`${c.id}: normal chats expect no rules`);
  }
  return d.chats as Chat[];
}

const pct = (num: number, den: number) => (den === 0 ? "n/a" : `${((100 * num) / den).toFixed(1)}%`);
const idKey = (i: Id) => `${i.type}:${i.value.toLowerCase()}`;

type ModeResult = {
  mode: string;
  tp: number; fp: number; tn: number; fn: number;
  falsePos: string[]; falseNeg: string[];
  perRule: Map<string, { tp: number; fp: number; fn: number }>;
};

async function score(chats: Chat[], env: Record<string, string | undefined>, mode: string): Promise<ModeResult> {
  const r: ModeResult = { mode, tp: 0, fp: 0, tn: 0, fn: 0, falsePos: [], falseNeg: [], perRule: new Map(RULES.map((x) => [x.id, { tp: 0, fp: 0, fn: 0 }])) };
  for (const c of chats) {
    const { signals, ai } = await detectSignals(c.text, { env });
    if (mode !== "regex-only" && ai.status !== "ok") r.mode = `${mode} (AI unavailable on some cases: ${ai.reason ?? "error"})`;
    // Hits in warning/news-style context (G3) are shown but not counted, exactly as in the risk level.
    const fired = new Set(signals.filter((s) => s.context !== "warning").map((s) => s.rule_id));
    const predicted = fired.size > 0;
    const rules = [...fired].join(", ");
    if (c.label === "scam" && predicted) r.tp++;
    else if (c.label === "scam") (r.fn++, r.falseNeg.push(`${c.id} (${c.type}${c.obfuscation ? `, ${c.obfuscation}` : ""})`));
    else if (predicted) (r.fp++, r.falsePos.push(`${c.id} (${c.type}) <- ${rules}`));
    else r.tn++;
    const expected = new Set(c.expected_rules);
    for (const [id, m] of r.perRule) {
      if (fired.has(id) && expected.has(id)) m.tp++;
      else if (fired.has(id)) m.fp++;
      else if (expected.has(id)) m.fn++;
    }
  }
  return r;
}

function section(r: ModeResult, n: number): string[] {
  const out = [
    `### Mode: ${r.mode}`,
    "",
    "| metric | value |",
    "|---|---|",
    `| accuracy | ${pct(r.tp + r.tn, n)} |`,
    `| precision | ${pct(r.tp, r.tp + r.fp)} |`,
    `| recall | ${pct(r.tp, r.tp + r.fn)} |`,
    `| false positives | ${r.fp} of ${r.tn + r.fp} normal |`,
    `| false negatives | ${r.fn} of ${r.tp + r.fn} scam |`,
    `| TP / FP / TN / FN | ${r.tp} / ${r.fp} / ${r.tn} / ${r.fn} |`,
    "",
    `False positives: ${r.falsePos.length ? r.falsePos.join("; ") : "none"}`,
    "",
    `False negatives: ${r.falseNeg.length ? r.falseNeg.join("; ") : "none"}`,
    "",
    "Per rule (a hit counts when the rule fired on a chat whose hand label includes it; precision = correct firings / all firings, recall = correct firings / chats labelled with the rule):",
    "",
    "| rule | labelled | fired | correct | precision | recall |",
    "|---|---|---|---|---|---|",
  ];
  for (const [id, m] of r.perRule) {
    out.push(`| ${id} | ${m.tp + m.fn} | ${m.tp + m.fp} | ${m.tp} | ${pct(m.tp, m.tp + m.fp)} | ${pct(m.tp, m.tp + m.fn)} |`);
  }
  return [...out, ""];
}

function gitCommit(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim() ? " (with uncommitted changes)" : "";
    return sha + dirty;
  } catch {
    return "unknown";
  }
}

async function main() {
  const envFile = join(import.meta.dirname, "..", "web", ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const chats = parseChats(JSON.parse(readFileSync(join(import.meta.dirname, "chats.json"), "utf8")));
  const n = chats.length;
  const scam = chats.filter((c) => c.label === "scam").length;

  const modes = [await score(chats, {}, "regex-only")];
  const aiOn = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  if (aiOn) modes.push(await score(chats, process.env, `with-AI (${process.env.OPENAI_MODEL})`));

  // Identifier extraction, scored against the hand-listed identifiers.
  let itp = 0, ifp = 0, ifn = 0;
  const idErrors: string[] = [];
  for (const c of chats) {
    const got = new Set(uniqueIdentifiers(extractIdentifiers(c.text)).map(idKey));
    const want = new Set(c.identifiers.map(idKey));
    for (const k of got) if (want.has(k)) itp++; else (ifp++, idErrors.push(`${c.id}: extra ${k.split(":")[0]}`));
    for (const k of want) if (!got.has(k)) (ifn++, idErrors.push(`${c.id}: missed ${k.split(":")[0]}`));
  }

  const lines = [
    "# ScamLens evaluation results",
    "",
    "**Illustrative demo data**: every chat in `eval/chats.json` is synthetic and hand-written for this project.",
    "",
    `- Date: ${new Date().toISOString()}`,
    `- Git commit: ${gitCommit()}`,
    `- Cases: ${n} (${scam} scam / ${n - scam} normal; ${chats.filter((c) => c.hard_negative).length} normal cases are deliberately tricky)`,
    `- Modes run: ${modes.map((m) => m.mode).join("; ")}${aiOn ? "" : ". with-AI: not run (OPENAI_API_KEY / OPENAI_MODEL not set)"}`,
    `- Command: \`cd web && npm run eval\``,
    "",
    "## Text signals",
    "",
    ...modes.flatMap((m) => section(m, n)),
    "## Identifier extraction",
    "",
    "| metric | value |",
    "|---|---|",
    `| hand-listed identifiers | ${itp + ifn} |`,
    `| extracted | ${itp + ifp} |`,
    `| precision | ${pct(itp, itp + ifp)} |`,
    `| recall | ${pct(itp, itp + ifn)} |`,
    "",
    `Errors: ${idErrors.length ? idErrors.join("; ") : "none"}`,
    "",
    "## What this evaluation is NOT",
    "",
    "These are hand-written synthetic cases, many written by the same person who wrote the rules, so the numbers",
    "are optimistic and say little about real-world performance. This is not a benchmark of real scams: there are",
    "no real chats, no real victims' messages and no independent labelling. The set is small (a few dozen cases),",
    "English-first with a handful of Hinglish lines, and the per-rule numbers rest on two to six examples each.",
    "Use it as a regression check (did a change break a known case?), not as evidence that ScamLens catches a",
    "given share of scams.",
    "",
  ];
  writeFileSync(join(import.meta.dirname, "RESULTS.md"), lines.join("\n"));
  for (const m of modes) {
    console.log(`${m.mode}: precision ${pct(m.tp, m.tp + m.fp)}, recall ${pct(m.tp, m.tp + m.fn)}, FP ${m.fp}, FN ${m.fn}`);
  }
  console.log(`identifiers: precision ${pct(itp, itp + ifp)}, recall ${pct(itp, itp + ifn)}`);
  console.log("wrote eval/RESULTS.md");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
