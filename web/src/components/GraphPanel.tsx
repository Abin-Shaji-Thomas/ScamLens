"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Identifier } from "@/lib/extract/types";
import type { GraphView } from "@/lib/graph/view";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const COLORS: Record<string, string> = { upi: "#d97706", telegram: "#0284c7", evm: "#7c3aed", tron: "#dc2626", btc: "#ea580c" };

export function GraphPanel({ identifiers }: { identifiers: Identifier[] }) {
  const linkable = identifiers.filter((i) => i.type === "upi" || i.type === "evm");
  const [view, setView] = useState<GraphView | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  if (!linkable.length) return null;

  async function load(id: Identifier) {
    setLoading(id.value);
    const res = await fetch("/api/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: id.type, value: id.raw }),
    });
    setView((await res.json()) as GraphView);
    setLoading(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {linkable.map((id, i) => (
          <button key={i} type="button" onClick={() => load(id)} className="rounded border px-2 py-0.5 font-mono text-xs">
            {loading === id.value ? "Loading..." : `Show links for ${id.type} ${id.value.slice(0, 14)}`}
          </button>
        ))}
      </div>
      {view?.status === "unavailable" && <p className="text-xs text-amber-700">Link graph unavailable ({view.reason}).</p>}
      {view?.status === "ok" && (
        <>
          {view.nodes.length === 0 ? (
            <p className="text-xs text-neutral-500">No linked identifiers in reports. This does not mean safe.</p>
          ) : (
            <div className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
              <ForceGraph2D
                graphData={{ nodes: view.nodes.map((n) => ({ ...n })), links: view.links.map((l) => ({ ...l })) }}
                width={600}
                height={300}
                nodeLabel={(n) => `${(n as GraphView["nodes"][number]).type}: ${(n as GraphView["nodes"][number]).label}`}
                nodeColor={(n) => COLORS[(n as GraphView["nodes"][number]).type] ?? "#737373"}
                nodeVal={(n) => ((n as GraphView["nodes"][number]).focus ? 6 : 2)}
                linkLabel={(l) => (l as GraphView["links"][number]).evidence}
                linkDirectionalArrowLength={(l) => ((l as GraphView["links"][number]).relation === "payment" ? 4 : 0)}
              />
            </div>
          )}
          <ul className="flex flex-col gap-1 text-xs">
            {view.paths.map((p, i) => (
              <li key={i}>
                <span className="font-semibold">{p.query}</span> {p.text}
                {p.evidence.length > 0 && <span className="text-neutral-500"> Evidence: {p.evidence.join("; ")}.</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-neutral-500">
            Graph backend: {view.backend}. Links come from community reports and on-chain transfers; a link is not proof of
            wrongdoing. Exchange and high-traffic addresses are excluded so unrelated people are not linked.
          </p>
        </>
      )}
    </div>
  );
}
