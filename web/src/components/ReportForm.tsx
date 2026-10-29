"use client";

import { useState } from "react";
import type { Identifier } from "@/lib/extract/types";
import { REPORT_CATEGORIES } from "@/lib/reports/schema";

export function ReportForm({ identifiers }: { identifiers: Identifier[] }) {
  const unique = identifiers.filter((id, i) => identifiers.findIndex((x) => x.type === id.type && x.value === id.value) === i);
  const [picked, setPicked] = useState<Set<number>>(new Set(unique.map((_, i) => i)));
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>("investment");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!unique.length) return null;

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
      onSubmit={async (e) => {
        e.preventDefault();
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
      }}
    >
      <p className="font-medium">Report these identifiers</p>
      {unique.map((id, i) => (
        <label key={i} className="flex items-center gap-2 font-mono text-xs">
          <input
            type="checkbox"
            checked={picked.has(i)}
            onChange={() => setPicked((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])))}
          />
          {id.type} {id.value}
        </label>
      ))}
      <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="self-start rounded border bg-transparent p-1 text-xs">
        {REPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ")}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        I confirm these identifiers were used against me or someone I know. Only a hash and a masked form are stored, not my chat.
        Reports expire after 90 days.
      </label>
      <button type="submit" disabled={!consent || picked.size === 0} className="self-start rounded bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-40">
        Submit report
      </button>
      {msg && <p className="text-xs">{msg}</p>}
    </form>
  );
}
