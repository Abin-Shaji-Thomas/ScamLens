"use client";

import { useId, useState } from "react";
import { DEMO_LABEL as WATERMARK } from "@/lib/demo";
import type { Identifier } from "@/lib/extract/types";
import { maskIdentifier } from "@/lib/reports/mask";
import type { ReportedTier } from "@/lib/reports/schema";
import { CONTESTED_LABEL, CONTESTED_NOTE } from "@/lib/tiers";

/** Inline contest form. The reason is sent as plain JSON and never rendered back. */
function Contest({ id }: { id: Identifier }) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="t-small mt-2 text-muted" role="status">{msg}</p>;
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
      <label htmlFor={reasonId} className="t-small text-muted">
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
      <div className="mt-4 flex items-center gap-6">
        <button type="submit" className="btn-primary">
          Send
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReportedList({ tier, identifiers }: { tier: ReportedTier; identifiers: Identifier[] }) {
  if (tier.status === "unavailable") {
    return <p className="text-muted">Note: Reports database unavailable ({tier.reason}). This is not a clean result.</p>;
  }
  return (
    <ul className="flex flex-col gap-6">
      {tier.entries.map((e, i) => {
        const own = identifiers.find((id) => id.type === e.type && maskIdentifier(id.type, id.value) === e.display);
        return (
          <li key={i} className="flex flex-col">
            {e.synthetic && <p className="t-small text-muted">{WATERMARK}</p>}
            <p className="break-id font-semibold">
              {e.display} was reported by {e.reporters} independent people
            </p>
            <p className="mt-1 text-muted">
              {e.categories.join(", ").replaceAll("_", " ")} · {e.firstReported} to {e.lastReported}
            </p>
            {e.contested && (
              <p className="mt-2">
                <span className="font-semibold">{CONTESTED_LABEL}.</span> <span className="text-muted">{CONTESTED_NOTE}</span>
              </p>
            )}
            {own && !e.contested && <Contest id={own} />}
          </li>
        );
      })}
    </ul>
  );
}
