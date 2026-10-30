"use client";

import { useEffect, useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { DEMO_LABEL } from "@/lib/demo";
import { hintSentence, hintTargets, runLinkHints, type LinkHint } from "@/lib/graph/link-hints";

/** Presentational part: nothing at all when there are no hints. */
export function LinkHintsView({ hints }: { hints: LinkHint[] }) {
  if (!hints.length) return null;
  return (
    <div className="flex flex-col gap-2" data-link-hints>
      {hints.map((h) => (
        <p key={`${h.type}|${h.display}`} className="text-swiss-black">
          {hintSentence(h)}
        </p>
      ))}
      <p className="t-small text-swiss-text">
        A link is not proof of wrongdoing.{hints.some((h) => h.synthetic) ? ` ${DEMO_LABEL}` : ""}
      </p>
    </div>
  );
}

/** Background lookups after a result is shown; never blocks or delays the card. Uses the daily graph limit. */
export function LinkHints({ result }: { result: CheckResponse }) {
  const [hints, setHints] = useState<{ at: string; list: LinkHint[] } | null>(null);
  useEffect(() => {
    const targets = hintTargets(result);
    if (!targets.length) return;
    const ctl = new AbortController();
    void runLinkHints(targets, fetch, ctl.signal).then((list) => {
      if (!ctl.signal.aborted) setHints({ at: result.checkedAt, list });
    });
    return () => ctl.abort();
  }, [result]);
  return <LinkHintsView hints={hints && hints.at === result.checkedAt ? hints.list : []} />;
}
