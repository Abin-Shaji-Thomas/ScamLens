"use client";

import { useId, useState } from "react";
import { buildComplaintDraft, copyComplaintDraft, EMPTY_FIELDS, PAID_PLAN, PAID_PLAN_NOTE, type PaidFields } from "@/lib/complaint-draft";

const FIELDS: { key: keyof PaidFields; label: string }[] = [
  { key: "amount", label: "Amount" },
  { key: "when", label: "Date and time" },
  { key: "method", label: "Payment method" },
  { key: "transactionId", label: "Transaction ID" },
];

/**
 * "I already paid": an ordered plan plus optional fields and a complaint draft. Everything stays in this page:
 * the fields are browser memory only and the draft is built here from the text already checked.
 */
export function PaidPlan({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [fields, setFields] = useState<PaidFields>(EMPTY_FIELDS);
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");

  return (
    <div className="flex flex-col print:hidden">
      <div>
        <button type="button" className="button button--outline" aria-expanded={open} aria-controls={`${id}-plan`} onClick={() => setOpen(!open)}>
          I already paid
        </button>
      </div>
      {open && (
        <div id={`${id}-plan`} className="mt-8 flex flex-col">
          <ol className="steps flex flex-col gap-4">
            {PAID_PLAN.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="t-small mt-6 text-swiss-text">{PAID_PLAN_NOTE}</p>
          <fieldset className="mt-8 flex flex-col gap-4">
            <legend className="eyebrow">For your complaint (optional, kept only in this page)</legend>
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col">
                <span className="t-small text-swiss-text">{f.label}</span>
                <input
                  className="field"
                  value={fields[f.key]}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  autoComplete="off"
                />
              </label>
            ))}
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="button"
              onClick={async () => setState((await copyComplaintDraft(text, fields, navigator.clipboard)) ? "copied" : "shown")}
            >
              {state === "copied" ? "Copied" : "Copy complaint draft"}
            </button>
            <button type="button" className="btn-link" aria-expanded={state === "shown"} onClick={() => setState(state === "shown" ? "idle" : "shown")}>
              {state === "shown" ? "Hide draft" : "Show draft"}
            </button>
          </div>
          <p className="t-small mt-3 text-swiss-text">The draft is built in your browser. Nothing is sent to ScamLens.</p>
          {state === "shown" && <pre className="t-small mt-4 whitespace-pre-wrap font-sans">{buildComplaintDraft(text, fields)}</pre>}
        </div>
      )}
    </div>
  );
}
