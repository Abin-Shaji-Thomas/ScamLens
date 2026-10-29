"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Identifier } from "@/lib/extract/types";
import type { GraphView } from "@/lib/graph/view";
import { DEMO_LABEL } from "@/lib/demo";
import { MAX_GRAPH_LOOKUPS } from "@/lib/limits";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Grayscale only (G4): the checked identifier is a filled ink circle, others hollow with a 1px ink stroke.
const INK = "#111111";
const MUTED = "#767676";
const PAPER = "#ffffff";
const R_FOCUS = 6;
const R_NODE = 4.5;
const WAKING_AFTER_MS = 3000;
const REDUCED = "(prefers-reduced-motion: reduce)";
const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
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
  // No layout animation when the user asks for reduced motion: settle the layout before the first paint.
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

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
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-x-6 gap-y-2 print:hidden">
        {linkable.map((id, i) => (
          <button key={i} type="button" onClick={() => load(id)} disabled={loading !== null} className="btn-link break-id text-left">
            {loading === id.value ? "Loading links..." : `Show links for ${id.type} ${id.value.slice(0, 14)}`}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-3">
        {waking && <p className="text-muted">The graph database is waking up. This can take up to a minute the first time.</p>}
        {error && <p>Note: {error}</p>}
        {view?.status === "unavailable" && <p>Note: Link graph unavailable ({view.reason}). This is not a clean result.</p>}
      </div>
      {view?.status === "ok" && (
        <>
          {view.synthetic && <p className="t-small mt-4 text-muted">{DEMO_LABEL}</p>}
          {view.nodes.length === 0 ? (
            <p className="mt-4 text-muted">No linked identifiers in reports. This does not mean safe.</p>
          ) : (
            <div ref={box} role="img" aria-label="Link graph; the same links are listed as text below." className="mt-4 w-full overflow-hidden print:hidden">
              <ForceGraph2D
                graphData={{ nodes: view.nodes.map((n) => ({ ...n })), links: view.links.map((l) => ({ ...l })) }}
                width={width}
                height={Math.min(300, Math.round(width * 0.75))}
                backgroundColor={PAPER}
                warmupTicks={reduceMotion ? 120 : 0}
                cooldownTicks={reduceMotion ? 0 : Infinity}
                enableNodeDrag={!reduceMotion}
                nodeLabel={(n) => `${(n as Node).type}: ${(n as Node).label}`}
                nodeVal={(n) => ((n as Node).focus ? 6 : 2)}
                linkLabel={(l) => (l as Link).evidence}
                linkColor={() => MUTED}
                linkWidth={1}
                linkDirectionalArrowLength={(l) => ((l as Link).relation === "payment" ? 4 : 0)}
                linkDirectionalArrowColor={() => MUTED}
                nodeCanvasObjectMode={() => "replace"}
                nodeCanvasObject={(n, ctx, scale) => {
                  const node = n as Node & { x?: number; y?: number };
                  if (node.x === undefined || node.y === undefined) return;
                  const r = node.focus ? R_FOCUS : R_NODE;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
                  ctx.fillStyle = node.focus ? INK : PAPER;
                  ctx.fill();
                  ctx.lineWidth = 1 / scale;
                  ctx.strokeStyle = INK;
                  ctx.stroke();
                  ctx.font = `${12 / scale}px ui-sans-serif, system-ui, sans-serif`;
                  ctx.fillStyle = INK;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillText(node.label, node.x, node.y + r + 4 / scale);
                }}
                nodePointerAreaPaint={(n, color, ctx) => {
                  const node = n as Node & { x?: number; y?: number };
                  if (node.x === undefined || node.y === undefined) return;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, (node.focus ? R_FOCUS : R_NODE) + 2, 0, 2 * Math.PI);
                  ctx.fill();
                }}
              />
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {view.paths.map((p, i) => (
              <li key={i}>
                <span className="font-semibold">{p.query}</span> {p.text}
                {p.evidence.length > 0 && <span className="text-muted"> Evidence: {p.evidence.join("; ")}.</span>}
              </li>
            ))}
          </ul>
          <p className="t-small mt-4 text-muted">
            Graph backend: {view.backend}. Links come from community reports and on-chain transfers; a link is not proof of
            wrongdoing. Exchange and high-traffic addresses are excluded so unrelated people are not linked.
          </p>
        </>
      )}
    </div>
  );
}
