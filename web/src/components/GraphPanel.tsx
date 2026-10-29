"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Identifier } from "@/lib/extract/types";
import type { GraphView } from "@/lib/graph/view";
import { DEMO_LABEL } from "@/lib/demo";
import { MAX_GRAPH_LOOKUPS } from "@/lib/limits";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const COLORS: Record<string, string> = { upi: "#d97706", telegram: "#0284c7", evm: "#7c3aed", tron: "#dc2626", btc: "#ea580c" };
const WAKING_AFTER_MS = 3000;
type Node = GraphView["nodes"][number];
type Link = GraphView["links"][number];

export function GraphPanel({ identifiers }: { identifiers: Identifier[] }) {
  const linkable = identifiers.filter((i) => i.type === "upi" || i.type === "evm").slice(0, MAX_GRAPH_LOOKUPS);
  const [view, setView] = useState<GraphView | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  if (!linkable.length) return null;

  async function load(id: Identifier) {
    setLoading(id.value);
    setError(null);
    setWaking(false);
    const timer = setTimeout(() => setWaking(true), WAKING_AFTER_MS);
    try {
      const res = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: id.type, value: id.raw }),
      });
      const body = (await res.json().catch(() => null)) as (GraphView & { error?: string }) | null;
      if (!res.ok || !body || !Array.isArray(body.nodes)) {
        setView(null);
        setError(body?.error ?? `The link graph could not be loaded (HTTP ${res.status}).`);
      } else setView(body);
    } catch {
      setView(null);
      setError("The link graph could not be loaded. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
      setLoading(null);
      setWaking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 print:hidden">
        {linkable.map((id, i) => (
          <button
            key={i}
            type="button"
            onClick={() => load(id)}
            disabled={loading !== null}
            className="rounded border px-2 py-1 font-mono text-xs disabled:opacity-50"
          >
            {loading === id.value ? "Loading..." : `Show links for ${id.type} ${id.value.slice(0, 14)}`}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-xs">
        {waking && <p className="text-neutral-500">The graph database is waking up. This can take up to a minute the first time.</p>}
        {error && <p className="text-amber-700 dark:text-amber-400">{error}</p>}
        {view?.status === "unavailable" && <p className="text-amber-700 dark:text-amber-400">Link graph unavailable ({view.reason}). This is not a clean result.</p>}
      </div>
      {view?.status === "ok" && (
        <>
          {view.synthetic && <p className="text-xs font-semibold uppercase text-fuchsia-700 dark:text-fuchsia-400">{DEMO_LABEL}</p>}
          {view.nodes.length === 0 ? (
            <p className="text-xs text-neutral-500">No linked identifiers in reports. This does not mean safe.</p>
          ) : (
            <div ref={box} role="img" aria-label="Link graph; the same links are listed as text below." className="w-full overflow-hidden rounded border border-neutral-200 dark:border-neutral-800 print:hidden">
              <ForceGraph2D
                graphData={{ nodes: view.nodes.map((n) => ({ ...n })), links: view.links.map((l) => ({ ...l })) }}
                width={width}
                height={Math.min(300, Math.round(width * 0.75))}
                nodeLabel={(n) => `${(n as Node).type}: ${(n as Node).label}`}
                nodeColor={(n) => COLORS[(n as Node).type] ?? "#737373"}
                nodeVal={(n) => ((n as Node).focus ? 6 : 2)}
                linkLabel={(l) => (l as Link).evidence}
                linkColor={(l) => ((l as Link).relation === "payment" ? "#f59e0b" : "#a3a3a3")}
                linkWidth={1.5}
                nodeCanvasObjectMode={() => "after"}
                nodeCanvasObject={(n, ctx, scale) => {
                  const node = n as Node & { x?: number; y?: number };
                  if (node.x === undefined || node.y === undefined) return;
                  ctx.font = `${11 / scale}px sans-serif`;
                  ctx.fillStyle = "#a3a3a3";
                  ctx.textAlign = "center";
                  // react-force-graph draws a node with radius sqrt(val) * 4; put the label just below it.
                  const radius = Math.sqrt(node.focus ? 6 : 2) * 4;
                  ctx.fillText(node.label, node.x, node.y + radius + 10 / scale);
                }}
                linkDirectionalArrowLength={(l) => ((l as Link).relation === "payment" ? 4 : 0)}
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
