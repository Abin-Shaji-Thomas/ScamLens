"use client";

import { useId, useState } from "react";
import { CASES_UNAVAILABLE } from "@/lib/cases/schema";

/** Delete a contributed case with the code shown when it was saved. Says the same thing for a wrong code and none. */
export function DeleteCaseForm() {
  const id = useId();
  const [code, setCode] = useState("");
  const [removeReports, setRemoveReports] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col"
      data-delete-case
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/case/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, removeReports }) });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; deleted?: number; reportsRemoved?: number; error?: string };
          if (res.status === 503) setMsg(CASES_UNAVAILABLE);
          else if (!body.ok) setMsg(body.error ?? `Failed (HTTP ${res.status})`);
          else if (body.deleted) setMsg(`Deleted.${removeReports ? ` ${body.reportsRemoved ?? 0} report(s) removed too.` : ""}`);
          else setMsg("No case matches that code. Check it and try again.");
          setCode("");
        } catch {
          setMsg("The request could not be sent. Check your connection and try again.");
        }
      }}
    >
      <label htmlFor={id} className="eyebrow">
        Delete code
      </label>
      <input id={id} className="field mt-2" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} placeholder="xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx" />
      <label className="mt-4 flex min-h-11 items-start gap-3">
        <input type="checkbox" className="checkbox mt-1" checked={removeReports} onChange={(e) => setRemoveReports(e.target.checked)} />
        <span>Also remove my reports and links from this case</span>
      </label>
      <div className="mt-4">
        <button type="submit" className="button" disabled={code.trim().length < 16}>
          Delete the case
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
