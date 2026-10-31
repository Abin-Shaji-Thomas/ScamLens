"use client";

import { useId, useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { caseBody, excerptPreview, type CaseForm } from "@/lib/cases/client";
import { CASE_CHANNELS, CASES_UNAVAILABLE, CATEGORY_LABEL, CHANNEL_LABEL, LOSS_BANDS, LOSS_LABEL } from "@/lib/cases/schema";
import { ContactHelp } from "./ContactHelp";
import { REPORT_CATEGORIES } from "@/lib/reports/schema";

/**
 * "This was a real scam, add it to the map": structured facts with consent, and only if ticked twice a redacted
 * excerpt the person has read. The delete code is shown once. Expands inline (no modal); hidden in print.
 */
export function ContributePanel({ result, text }: { result: CheckResponse; text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CaseForm>({ category: "other", channel: "other", lossBand: "unknown", consent: false, includeExcerpt: false, excerptConsent: false });
  const [state, setState] = useState<{ kind: "idle" } | { kind: "saved"; code: string } | { kind: "error"; msg: string }>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const set = (p: Partial<CaseForm>) => setForm((f) => ({ ...f, ...p }));
  if (!result.identifiers.length) return null;

  if (state.kind === "saved") {
    return (
      <div className="flex flex-col print:hidden" data-case-saved role="status">
        <h3 className="t-h2 border-t-2 border-swiss-black pt-6">Added to the map</h3>
        <p className="mt-2">It counts only after a second, independent person reports the same identifier.</p>
        <p className="mt-4 font-semibold text-swiss-black">Your delete code (shown once; we keep only a keyed hash of it):</p>
        <p className="break-id mt-2 font-semibold text-swiss-black" data-delete-code>
          {state.code}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            className="button button--outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.code);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy delete code"}
          </button>
          <a href="/privacy#delete" className="inline-flex min-h-11 items-center">
            Delete a case
          </a>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="print:hidden">
        <button type="button" className="btn-link" aria-expanded="false" onClick={() => setOpen(true)}>
          This was a real scam, add it to the map
        </button>
      </div>
    );
  }

  const preview = excerptPreview(text);
  return (
    <form
      className="flex flex-col print:hidden"
      aria-labelledby={`${id}-title`}
      data-contribute
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(caseBody(result, text, form)) });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; deleteCode?: string };
          if (body.ok && body.deleteCode) setState({ kind: "saved", code: body.deleteCode });
          else setState({ kind: "error", msg: res.status === 503 ? CASES_UNAVAILABLE : (body.error ?? `Failed (HTTP ${res.status})`) });
        } catch {
          setState({ kind: "error", msg: "The case could not be sent. Check your connection and try again." });
        }
      }}
    >
      <h3 id={`${id}-title`} className="t-h2 border-t-2 border-swiss-black pt-6">
        This was a real scam, add it to the map
      </h3>
      <p className="mt-2 text-swiss-text">
        Saves the identifiers (as keyed hashes and masked forms) and the facts below, so others who get the same message can see the trail. Your
        check itself is not saved. <a href="/privacy" className="tap">Privacy</a>
      </p>
      <div className="mt-6 flex flex-wrap gap-6">
        <label className="flex flex-col">
          <span className="eyebrow">Scam type</span>
          <select className="field mt-2" value={form.category} onChange={(e) => set({ category: e.target.value as CaseForm["category"] })}>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="eyebrow">How it came</span>
          <select className="field mt-2" value={form.channel} onChange={(e) => set({ channel: e.target.value as CaseForm["channel"] })}>
            {CASE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="eyebrow">Money lost (optional)</span>
          <select className="field mt-2" value={form.lossBand} onChange={(e) => set({ lossBand: e.target.value as CaseForm["lossBand"] })}>
            {LOSS_BANDS.map((c) => (
              <option key={c} value={c}>
                {LOSS_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-6 flex min-h-11 items-start gap-3">
        <input type="checkbox" className="checkbox mt-1" checked={form.includeExcerpt} onChange={(e) => set({ includeExcerpt: e.target.checked, excerptConsent: false })} />
        <span>Also save a short redacted excerpt for the moderator (optional)</span>
      </label>
      {form.includeExcerpt && (
        <div className="mt-2 flex flex-col" data-excerpt-preview>
          <p className="t-small text-swiss-text">This exact text would be saved (identifiers and long numbers removed, at most 500 characters). Only the moderator can read it.</p>
          <pre className="t-small mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-swiss-rule p-3 font-sans">{preview || "(nothing to save)"}</pre>
          <label className="mt-2 flex min-h-11 items-start gap-3">
            <input type="checkbox" className="checkbox mt-1" checked={form.excerptConsent} onChange={(e) => set({ excerptConsent: e.target.checked })} />
            <span>I have read the text above; save it for the moderator only</span>
          </label>
        </div>
      )}
      <label className="mt-6 flex items-start gap-3">
        <input type="checkbox" className="checkbox mt-1" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} required />
        <span>I confirm this happened to me or someone I know. It is deleted after 90 days, or earlier with the delete code I will get.</span>
      </label>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button type="submit" className="button" disabled={!form.consent || (form.includeExcerpt && !form.excerptConsent)}>
          Add it to the map
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <ContactHelp />
      {state.kind === "error" && (
        <p className="mt-4" role="status">
          {state.msg}
        </p>
      )}
    </form>
  );
}
