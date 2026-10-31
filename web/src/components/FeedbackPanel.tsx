"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { feedbackBody } from "@/lib/cases/client";
import { CASES_UNAVAILABLE, FEEDBACK_REASONS, REASON_LABEL, VERDICTS, type FeedbackRequest } from "@/lib/cases/schema";

const VERDICT_LABEL: Record<(typeof VERDICTS)[number], string> = { scam: "It was a scam", genuine: "It was genuine", unsure: "Not sure" };

/** "Was this right?": a verdict and fixed reasons, sent once. It never changes the level of this or any check. */
export function FeedbackPanel({ result }: { result: CheckResponse }) {
  const [verdict, setVerdict] = useState<FeedbackRequest["verdict"] | null>(null);
  const [reasons, setReasons] = useState<FeedbackRequest["reasons"]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) {
    return (
      <p className="t-small text-swiss-text print:hidden" role="status" data-feedback-done>
        {msg}
      </p>
    );
  }
  return (
    <form
      className="flex flex-col print:hidden"
      data-feedback
      onSubmit={async (e) => {
        e.preventDefault();
        if (!verdict) return;
        try {
          const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feedbackBody(result, verdict, reasons)) });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          setMsg(body.ok ? "Thank you. Your answer is counted once and is shown only as a number next to reported entries." : res.status === 503 ? CASES_UNAVAILABLE : (body.error ?? `Failed (HTTP ${res.status})`));
        } catch {
          setMsg("Your answer could not be sent. Check your connection and try again.");
        }
      }}
    >
      <fieldset className="flex flex-col">
        <legend className="font-semibold text-swiss-black">Was this right?</legend>
        <div className="mt-2 flex flex-wrap gap-x-6">
          {VERDICTS.map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="verdict" className="checkbox" checked={verdict === v} onChange={() => setVerdict(v)} />
              <span>{VERDICT_LABEL[v]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {verdict && (
        <fieldset className="mt-4 flex flex-col">
          <legend className="eyebrow">Why? (optional)</legend>
          {FEEDBACK_REASONS.map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={reasons.includes(r)}
                onChange={() => setReasons((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))}
              />
              <span>{REASON_LABEL[r]}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="t-small mt-3 text-swiss-text">No free text. Your answer is counted once per network and never changes a risk level.</p>
      <div className="mt-4">
        <button type="submit" className="button button--outline" disabled={!verdict}>
          Send answer
        </button>
      </div>
    </form>
  );
}
