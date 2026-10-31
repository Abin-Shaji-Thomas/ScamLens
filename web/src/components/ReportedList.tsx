"use client";

import { useId, useState } from "react";
import { DEMO_LABEL as WATERMARK } from "@/lib/demo";
import type { Identifier } from "@/lib/extract/types";
import { maskIdentifier } from "@/lib/reports/mask";
import type { ReportedTier } from "@/lib/reports/schema";
import { CONTESTED_LABEL, CONTESTED_NOTE } from "@/lib/tiers";
import { ContactHelp } from "./ContactHelp";
import { REASON_LABEL, type FeedbackCount } from "@/lib/cases/schema";

/** Inline contest form. The reason is sent as plain JSON and never rendered back. */
function Contest({ id }: { id: Identifier }) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="t-small mt-2 text-swiss-text" role="status">{msg}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-link t-small mt-2 self-start" aria-expanded="false">
        Contest this entry
      </button>
    );
  return (
    <form
      className="mt-4 flex flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/report/contest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: { type: id.type, value: id.raw }, reason }),
          });
          const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          setMsg(body.message ?? body.error ?? `Failed (HTTP ${res.status})`);
        } catch {
          setMsg("The request could not be sent. Check your connection and try again.");
        }
      }}
    >
      <label htmlFor={reasonId} className="eyebrow">
        Why is this entry wrong? (10 to 500 characters)
      </label>
      <textarea
        id={reasonId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        minLength={10}
        maxLength={500}
        required
        rows={2}
        className="field mt-2"
      />
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <button type="submit" className="button">
          Send
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <ContactHelp />
    </form>
  );
}

/** "N reported, M marked genuine (reasons)": information only; it never changes the level. */
export function feedbackLine(e: { reporters: number }, f: FeedbackCount | undefined): string | null {
  if (!f || f.genuine + f.scam + f.unsure === 0) return null;
  const reasons = f.genuineReasons.map((r) => REASON_LABEL[r].toLowerCase()).join("; ");
  return `${e.reporters} reported, ${f.genuine} marked genuine${reasons ? ` (${reasons})` : ""}${f.scam ? `, ${f.scam} marked scam` : ""}${f.unsure ? `, ${f.unsure} not sure` : ""}. Shown for information; it does not change the level.`;
}

export function ReportedList({ tier, identifiers, feedback = [] }: { tier: ReportedTier; identifiers: Identifier[]; feedback?: FeedbackCount[] }) {
  if (tier.status === "unavailable") {
    return <p className="text-swiss-text">Note: Reports database unavailable ({tier.reason}). This is not a clean result.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule">
      {tier.entries.map((e, i) => {
        const own = identifiers.find((id) => id.type === e.type && maskIdentifier(id.type, id.value) === e.display);
        return (
          <li key={i} className="flex flex-col py-4">
            {e.synthetic && <p className="t-small text-swiss-text">{WATERMARK}</p>}
            <p className="break-id font-semibold text-swiss-black">
              {e.display} was reported by {e.reporters} independent people
            </p>
            <p className="mt-1 text-swiss-text">
              {e.categories.join(", ").replaceAll("_", " ")} · {e.firstReported} to {e.lastReported}
            </p>
            {feedbackLine(e, feedback.find((f) => f.display === e.display)) && (
              <p className="t-small mt-1 text-swiss-text" data-feedback-line>
                {feedbackLine(e, feedback.find((f) => f.display === e.display))}
              </p>
            )}
            {e.contested && (
              <p className="mt-2">
                <span className="font-semibold text-swiss-clay">{CONTESTED_LABEL}.</span> <span className="text-swiss-text">{CONTESTED_NOTE}</span>
              </p>
            )}
            {own && !e.contested && <Contest id={own} />}
          </li>
        );
      })}
    </ul>
  );
}
