"use client";

import { useId, useState } from "react";
import type { Identifier } from "@/lib/extract/types";
import { REPORT_CATEGORIES } from "@/lib/reports/schema";

/** Expands inline (no modal). */
export function ReportForm({ identifiers }: { identifiers: Identifier[] }) {
  const unique = identifiers.filter((id, i) => identifiers.findIndex((x) => x.type === id.type && x.value === id.value) === i);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set(unique.map((_, i) => i)));
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>("investment");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const categoryId = useId();
  if (!unique.length) return null;

  if (!open) {
    return (
      <div className="print:hidden">
        <button type="button" className="btn-link" aria-expanded="false" onClick={() => setOpen(true)}>
          Report these identifiers
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col print:hidden"
      aria-labelledby={`${categoryId}-title`}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifiers: unique.filter((_, i) => picked.has(i)).map((id) => ({ type: id.type, value: id.raw })),
              category,
              consent,
            }),
          });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          setMsg(body.ok ? "Report saved. It becomes public only after a second independent report." : (body.error ?? `Failed (HTTP ${res.status})`));
        } catch {
          setMsg("The report could not be sent. Check your connection and try again.");
        }
      }}
    >
      <h3 id={`${categoryId}-title`} className="t-h2">
        Report these identifiers
      </h3>
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="t-small text-swiss-text">Identifiers to include</legend>
        {unique.map((id, i) => (
          <label key={i} className="break-id flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1.5 accent-swiss-black"
              checked={picked.has(i)}
              onChange={() => setPicked((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])))}
            />
            <span>
              {id.value} <span className="t-small text-swiss-text">· {id.type}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={categoryId} className="t-small mt-6 text-swiss-text">
        Scam type
      </label>
      <select id={categoryId} value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="field mt-1 self-start">
        {REPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ")}
          </option>
        ))}
      </select>
      <label className="mt-6 flex items-start gap-3">
        <input type="checkbox" className="mt-1.5 accent-swiss-black" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>
          I confirm these identifiers were used against me or someone I know. Only a hash and a masked form are stored, not my chat.
          Reports expire after 90 days.
        </span>
      </label>
      <div className="mt-6 flex items-center gap-6">
        <button type="submit" disabled={!consent || picked.size === 0} className="btn-primary">
          Submit report
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg && (
        <p className="mt-4" role="status">
          {msg}
        </p>
      )}
    </form>
  );
}
