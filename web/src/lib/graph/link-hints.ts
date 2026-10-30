// "Linked to N other identifiers" hints: after a result is shown, look up the graph for a few reported identifiers
// in the background, one at a time. Client-safe. Any failure or rate limit simply yields no hint.
import type { CheckResponse } from "../api-schema";
import type { Identifier, IdentifierType } from "../extract/types";
import { maskIdentifier } from "../reports/mask";

export const HINT_TYPES: readonly IdentifierType[] = ["upi", "evm", "tron", "telegram"];
export const MAX_HINTS = 3;

const NAMES: Partial<Record<IdentifierType, string>> = { upi: "UPI ID", evm: "wallet", tron: "TRON wallet", telegram: "Telegram handle" };

export interface LinkHint {
  type: IdentifierType;
  display: string;
  linked: number;
  synthetic: boolean;
}

/** Up to 3 identifiers of a supported type that have a Reported entry (matched by masked display, as ReportedList does). */
export function hintTargets(r: CheckResponse): Identifier[] {
  if (r.reported.status !== "ok") return [];
  const reported = new Set(r.reported.entries.map((e) => `${e.type}|${e.display}`));
  return r.identifiers.filter((i) => HINT_TYPES.includes(i.type) && reported.has(`${i.type}|${maskIdentifier(i.type, i.value)}`)).slice(0, MAX_HINTS);
}

/** One plain sentence; only for identifiers that have links. */
export function hintSentence(h: LinkHint): string {
  const n = h.linked === 1 ? "1 other identifier" : `${h.linked} other identifiers`;
  return `This ${NAMES[h.type] ?? "identifier"} is linked to ${n} in community reports. Show links to see how.`;
}

type GraphAnswer = { status?: string; nodes?: { focus?: boolean }[]; synthetic?: boolean };

/** Sequential lookups. Stops at the first rate limit; a failed lookup is skipped; returns hints with links only. */
export async function runLinkHints(targets: Identifier[], fetchFn: typeof fetch, signal?: AbortSignal): Promise<LinkHint[]> {
  const out: LinkHint[] = [];
  for (const id of targets) {
    if (signal?.aborted) break;
    try {
      const res = await fetchFn("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: id.type, value: id.raw }),
        signal,
      });
      if (res.status === 429) break; // daily graph limit: show nothing more
      if (!res.ok) continue;
      const body = (await res.json()) as GraphAnswer;
      const linked = body.status === "ok" ? (body.nodes ?? []).filter((n) => !n.focus).length : 0;
      if (linked > 0) out.push({ type: id.type, display: maskIdentifier(id.type, id.value), linked, synthetic: Boolean(body.synthetic) });
    } catch {
      if (signal?.aborted) break;
    }
  }
  return out;
}
