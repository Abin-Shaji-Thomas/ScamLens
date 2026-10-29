"use client";

import { useState } from "react";
import type { Identifier } from "@/lib/extract/types";
import { maskIdentifier } from "@/lib/reports/mask";
import type { ReportedTier } from "@/lib/reports/schema";
import { DEMO_LABEL as WATERMARK } from "@/lib/demo";

function Contest({ id }: { id: Identifier }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p className="text-xs text-neutral-600">{msg}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs underline">
        Contest this entry
      </button>
    );
  return (
    <form
      className="mt-1 flex flex-col gap-1"
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
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this entry wrong? (10-500 characters)"
        minLength={10}
        maxLength={500}
        required
        rows={2}
        className="rounded border border-neutral-300 bg-transparent p-1 text-xs dark:border-neutral-700"
      />
      <button type="submit" className="self-start rounded bg-neutral-800 px-2 py-0.5 text-xs text-white">
        Send
      </button>
    </form>
  );
}

export function ReportedList({ tier, identifiers }: { tier: ReportedTier; identifiers: Identifier[] }) {
  if (tier.status === "unavailable") {
    return <p className="text-sm text-amber-700 dark:text-amber-400">Reports database unavailable ({tier.reason}). This is not a clean result.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {tier.entries.map((e, i) => {
        const own = identifiers.find((id) => id.type === e.type && maskIdentifier(id.type, id.value) === e.display);
        return (
          <li key={i} className="text-sm">
            {e.synthetic && <p className="text-xs font-semibold uppercase text-fuchsia-700">{WATERMARK}</p>}
            <p>
              <span className="font-mono">{e.display}</span> was <strong>reported</strong> by {e.reporters} independent people
              ({e.categories.join(", ")}), {e.firstReported} to {e.lastReported}.
            </p>
            {own && <Contest id={own} />}
          </li>
        );
      })}
    </ul>
  );
}
