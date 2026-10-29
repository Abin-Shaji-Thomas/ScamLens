import { parse } from "tldts";
import { make, stripTrailingPunct, type Identifier } from "./types";

// handle@something. Classified as email if the part after @ has a dot, else UPI.
const AT_RE = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*/g;
const UPI_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9]{1,63}$/;
const PHONE_RE = /(?<![\w+])(?:\+91[\s-]?|0091[\s-]?|91[\s-]|0)?([6-9]\d{4})[\s-]?(\d{5})(?!\d)/g;
const TG_HANDLE_RE = /(?<![A-Za-z0-9._%+-])@([A-Za-z][A-Za-z0-9_]{4,31})(?![A-Za-z0-9_])/g;
const TG_LINK_RE =
  /(?<![A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{4,31})(?![A-Za-z0-9_])/gi;
const DOMAIN_RE =
  /(?<![A-Za-z0-9@._%+-])(?:https?:\/\/)?(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?![A-Za-z0-9@-])(?::\d{2,5})?(?:\/[^\s<>"']*)?/g;

function icannHost(input: string): string | null {
  const r = parse(input);
  return r.isIcann && r.domain && r.hostname ? r.hostname.toLowerCase() : null;
}

export function extractUpiAndEmail(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(AT_RE)) {
    const raw = stripTrailingPunct(m[0]);
    const after = raw.slice(raw.indexOf("@") + 1);
    if (after.includes(".")) {
      if (icannHost(after)) out.push(make("email", raw.toLowerCase(), raw, m.index, "format"));
    } else if (UPI_RE.test(raw)) {
      out.push(make("upi", raw.toLowerCase(), raw, m.index, "format"));
    }
  }
  return out;
}

export function extractPhone(text: string): Identifier[] {
  return [...text.matchAll(PHONE_RE)].map((m) => make("phone", `+91${m[1]}${m[2]}`, m[0], m.index, "format"));
}

export function extractTelegram(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(TG_HANDLE_RE)) {
    out.push(make("telegram", `@${m[1].toLowerCase()}`, m[0], m.index, "format"));
  }
  for (const m of text.matchAll(TG_LINK_RE)) {
    out.push(make("telegram", `@${m[1].toLowerCase()}`, m[0], m.index, "format"));
  }
  return out;
}

export function extractDomains(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(DOMAIN_RE)) {
    const raw = stripTrailingPunct(m[0]);
    const host = icannHost(raw);
    if (host) out.push(make("domain", host, raw, m.index, "format"));
  }
  return out;
}
