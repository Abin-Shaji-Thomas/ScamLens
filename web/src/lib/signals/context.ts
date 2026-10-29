import type { Signal } from "./types";

// Warning / news / awareness context (round 2, G3).
// A rule hit inside a sentence that WARNS about scams ("Police never ask you to stay on a video call",
// "guaranteed returns are a red flag") is still shown, but carries no weight toward Elevated or High.
//
// Deliberately narrow, so a scam cannot switch itself off with a decoy sentence:
// - markers are protective phrases (never share, do not trust, red flag, awareness, news:, police said...),
//   not bare words like "warning" (scams say "Final warning: your account will be blocked");
// - the marker must be in the SAME sentence as the hit, or in the previous sentence of the same message
//   (no line break between) AND the hit's sentence continues it ("They...", "Such messages...", a quote);
// - "do not" / "never" only count when followed by protective advice (share, trust, pay, click, install...).

const ADVICE = String.raw`(share|trust|believe|pay|click|install|download|give|send|transfer|respond|reply|fall\s+for|ask|asks|call|put|conduct)`;

export const WARNING_MARKERS: readonly RegExp[] = [
  /\bbeware\b/i,
  /\bawareness\b/i,
  /\bred\s+flags?\b/i,
  /\badvisory\b/i,
  /\bwarn(s|ed|ing)?\s+(people|residents|users|citizens|customers|the\s+public|that|about|against)\b/i,
  /\b(warning|alert)\s+(about|against|from\s+(the\s+)?(police|bank|rbi|government|cyber))\b/i,
  new RegExp(String.raw`\b(never|do\s+not|don'?t|does\s+not|doesn'?t|will\s+not|won'?t)\s+(ever\s+)?${ADVICE}\b`, "i"),
  /\bno\s+such\s+thing\s+as\b/i,
  /^\s*news\s*[:\-]/i,
  /\b(reported\s+that|according\s+to\s+(the\s+)?police)\b/i,
  /\b(police|officials?|authorities|the\s+bank|rbi|experts?)\s+(say|says|said|warn|warned|advise|advised)\b/i,
  /\bsuch\s+(messages?|calls?|sms)\b/i,
  // Hinglish
  /\b(savdhan|saavdhan|sawdhan|satark|jagrukta|dhyan\s+rahe|dhyaan\s+rakhein)\b/i,
  /\bkabhi\s+(bhi\s+)?(share|mat|na|nahi)\b/i,
];

const CONTINUATION = /^\s*["“'‘(]?\s*(they|these|such|this\s+(message|call)|for\s+example|e\.g\.|examples?|officials?|police|for\s+instance|like)\b/i;

interface Sentence {
  start: number;
  end: number;
  newlineBefore: boolean; // a line break separates this sentence from the previous one (different message)
}

function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+[.!?]*|\n+/g;
  let newline = false;
  for (const m of text.matchAll(re)) {
    if (m[0].startsWith("\n")) {
      newline = true;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, newlineBefore: newline });
    newline = false;
  }
  return out;
}

const hasMarker = (s: string) => WARNING_MARKERS.some((re) => re.test(s));

function insideQuotes(sentence: string, offset: number): boolean {
  const before = sentence.slice(0, offset);
  return (before.match(/["“”]/g)?.length ?? 0) % 2 === 1;
}

/** True when the hit at [start, end) sits in a warning, news or awareness sentence (see header). */
export function inWarningContext(text: string, start: number): boolean {
  const list = sentences(text);
  const i = list.findIndex((s) => start >= s.start && start < s.end);
  if (i < 0) return false;
  const cur = list[i];
  const curText = text.slice(cur.start, cur.end);
  if (hasMarker(curText)) return true;
  if (i === 0 || cur.newlineBefore) return false;
  const prev = text.slice(list[i - 1].start, list[i - 1].end);
  const continues = CONTINUATION.test(curText) || insideQuotes(curText, start - cur.start) || /:\s*$/.test(prev);
  return continues && hasMarker(prev);
}

/** Marks each signal found in warning context. Marked signals stay visible but do not count toward the level. */
export function markWarningContext(text: string, signals: Signal[]): Signal[] {
  return signals.map((s) => (inWarningContext(text, s.start) ? { ...s, context: "warning" as const } : s));
}
