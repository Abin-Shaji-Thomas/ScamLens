// Scores the ScamLens text-signal engine on eval/chats.json (synthetic).
// A chat is predicted "scam" when the engine yields at least one suspected signal,
// i.e. the risk card would show Elevated or higher from text alone.
// Run from web/: npm run eval
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectSignals } from "../web/src/lib/signals";

// This file lives outside web/, so it imports only web/src modules (whose packages resolve from web/node_modules).
type Chat = { id: string; label: "scam" | "normal"; type: string; text: string; hard_negative?: boolean };
function parseChats(raw: unknown): { chats: Chat[] } {
  const d = raw as { synthetic?: unknown; chats?: unknown };
  if (d.synthetic !== true || !Array.isArray(d.chats)) throw new Error("chats.json must be {synthetic:true, chats:[...]}");
  for (const c of d.chats as Chat[]) {
    if (typeof c.id !== "string" || typeof c.text !== "string" || (c.label !== "scam" && c.label !== "normal")) {
      throw new Error(`bad chat entry: ${JSON.stringify(c).slice(0, 80)}`);
    }
  }
  return { chats: d.chats as Chat[] };
}

async function main() {
  const envFile = join(import.meta.dirname, "..", "web", ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const { chats } = parseChats(JSON.parse(readFileSync(join(import.meta.dirname, "chats.json"), "utf8")));

  let tp = 0, fp = 0, tn = 0, fn = 0;
  const falsePos: string[] = [];
  const falseNeg: string[] = [];
  let model = "rules only";
  for (const c of chats) {
    const { signals, ai } = await detectSignals(c.text, { env: process.env });
    if (ai.status === "ok") model = `rules + ${ai.model}`;
    else if (process.env.OPENAI_API_KEY) model = `rules only (LLM unavailable: ${ai.reason})`;
    const predicted = signals.length > 0;
    const rules = [...new Set(signals.map((s) => s.rule_id))].join(",");
    if (c.label === "scam" && predicted) tp++;
    else if (c.label === "scam") (fn++, falseNeg.push(c.id));
    else if (predicted) (fp++, falsePos.push(`${c.id} (${c.type}) <- ${rules}`));
    else tn++;
  }
  const n = chats.length;
  const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : "n/a");
  console.log("ScamLens eval - SYNTHETIC dataset (Illustrative - not a real investigation)");
  console.log(`date: ${new Date().toISOString()}   model: ${model}   chats: ${n} (${chats.filter((c) => c.label === "scam").length} scam / ${chats.filter((c) => c.label === "normal").length} normal)`);
  console.log("");
  console.log("| metric          | value |");
  console.log("|-----------------|-------|");
  console.log(`| accuracy        | ${pct((tp + tn) / n)} |`);
  console.log(`| precision       | ${pct(tp / (tp + fp))} |`);
  console.log(`| recall          | ${pct(tp / (tp + fn))} |`);
  console.log(`| false positives | ${fp} of ${tn + fp} normal |`);
  console.log(`| false negatives | ${fn} of ${tp + fn} scam |`);
  console.log(`| TP / FP / TN / FN | ${tp} / ${fp} / ${tn} / ${fn} |`);
  console.log("");
  console.log(`false positives: ${falsePos.length ? falsePos.join("; ") : "none"}`);
  console.log(`false negatives: ${falseNeg.length ? falseNeg.join(", ") : "none"}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
