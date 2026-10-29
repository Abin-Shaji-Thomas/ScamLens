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
  // Not after "if/unless you": "If you do not pay, ..." is a conditional threat, not advice (final round).
  new RegExp(String.raw`(?<!\b(?:if|unless|agar)\s+(?:you|u|aap)\s+)\b(never|do\s+not|don'?t|does\s+not|doesn'?t|will\s+not|won'?t)\s+(ever\s+)?${ADVICE}\b`, "i"),
  /\bno\s+such\s+thing\s+as\b/i,
  /^\s*news\s*[:\-]/i,
  /\b(reported\s+that|according\s+to\s+(the\s+)?police)\b/i,
  /\b(police|officials?|authorities|the\s+bank|rbi|experts?)\s+(say|says|said|warn|warned|advise|advised)\b/i,
  /\bsuch\s+(messages?|calls?|sms)\b/i,
  // Hinglish
  /\b(savdhan|saavdhan|sawdhan|satark|jagrukta|dhyan\s+rahe|dhyaan\s+rakhein)\b/i,
  /\bkabhi\s+(bhi\s+)?(share|mat|na|nahi)\b/i,
  // Conditional awareness (final round): "If someone says ..., it is a fraud call." A threat such as
  // "If you do not pay, police will arrest you" does not match: the sentence must call the situation a fraud/scam.
  /\bif\s+(someone|anyone|somebody|any\s*one|a\s+caller|any\s+caller|they|you\s+(get|receive))\b[^.\n]{0,120}\b(it|that|this)(\s+is|'s)\s+(a\s+|an\s+)?(fraud|scam|fake)\b/i,
  /\bagar\s+koi\b[^.\n]{0,120}\b(to|toh)\s+(yeh|ye|woh|wo|vo)\s+(fraud|scam|dhokha|fake)\s+(hai|h)\b/i,
];

// Solicitation aimed at the reader (final round): "Beware of fake sites, send 5000 USDT now" must not hide the hit.
// Checked per clause (commas, semicolons, colons, "but"/"lekin"/"par"); a negator earlier in the same clause cancels it
// ("Never send money to strangers"). Descriptions such as "such messages ask people to pay" are not solicitations:
// the verb must open the clause (an imperative, optionally after please/just/now/and/then) or follow "you must/should".
const VERB = String.raw`(?:send|pay|transfer|deposit|invest|join|click|download|share\s+your)`;
const SOLICIT_EN = new RegExp(
  String.raw`^(?:(?:please|kindly|just|now|immediately|quickly|so|and|then|also)\s+)*${VERB}\b|\b(?:and|then)\s+(?:just\s+|now\s+|quickly\s+)?${VERB}\b|\b(?:you|u)\s+(?:must|should|need\s+to|have\s+to|can)\s+(?:now\s+|just\s+)?${VERB}\b`,
  "i",
);
const SOLICIT_ME = /\b(?:contact|dm|text|message|whatsapp|call)\s+(?:me|us)\b/i;
const SOLICIT_HI = /\b(?:bhejo|bhejiye|bhej\s+do|jama\s+(?:karo|kijiye|karein)|(?:transfer|pay|invest|join|click|download)\s+(?:karo|kijiye|karein)|mujhe\s+(?:call|message|whatsapp)\s+karo)\b/i;
const NEGATOR = /\b(?:never|not|don'?t|do\s+not|no\s+one|nobody|mat|na|nahi|nahin)\b/i;

/** True when some clause of the sentence asks the reader to pay, send, join, click... and is not negated. */
export function solicitsReader(sentence: string): boolean {
  return sentence.split(/[,;:]|\s+(?:but|lekin|par)\s+/i).some((raw) => {
    const clause = raw.trim();
    for (const re of [SOLICIT_EN, SOLICIT_ME, SOLICIT_HI]) {
      const m = re.exec(clause);
      if (m && !NEGATOR.test(clause.slice(0, m.index))) return true;
    }
    return false;
  });
}

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
  // A sentence that asks the reader to act is never "just a warning", whatever protective words it also contains.
  if (solicitsReader(curText)) return false;
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
