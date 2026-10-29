"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Identifier } from "@/lib/extract/types";
import type { GraphView } from "@/lib/graph/view";
import { DEMO_LABEL } from "@/lib/demo";
import { MAX_GRAPH_LOOKUPS } from "@/lib/limits";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Swiss graph: the checked identifier is a filled black circle, others hollow with a 1.5px black stroke;
// links are 1px grey, the evidence-path link 2.5px alert; labels are black below the nodes.
const INK = "#000000";
const GREY = "#808080";
const ALERT = "#b00020"; // only the evidence-path link
const WHITE = "#ffffff";
const R_FOCUS = 6;
const R_NODE = 4.5;
const FONT = '"Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif';
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
  // A link is on an evidence path when both of its end labels appear in the same listed path (Q1-Q3).
  // The graph library replaces link ends with node objects after layout, so both shapes are handled.
  const labels = new Map(view?.nodes.map((n) => [n.id, n.label]) ?? []);
  const end = (x: unknown) => (typeof x === "object" && x !== null ? (x as { id: string }).id : String(x));
  const onPath = (l: Link) => {
    const a = labels.get(end(l.source));
    const z = labels.get(end(l.target));
    return Boolean(a && z && view?.paths.some((p) => p.text.includes(a) && p.text.includes(z)));
  };

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
    <div className="flex flex-col border-t-2 border-swiss-black pt-4 print:border-t-0">
      <div className="flex flex-wrap gap-x-8 print:hidden">
        {linkable.map((id, i) => (
          <button key={i} type="button" onClick={() => load(id)} disabled={loading !== null} className="btn-link break-id text-left">
            {loading === id.value ? "Loading links..." : `Show links for ${id.type} ${id.value.slice(0, 14)}`}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-3">
        {waking && <p className="text-swiss-text">The graph database is waking up. This can take up to a minute the first time.</p>}
        {error && <p className="text-swiss-text">Note: {error}</p>}
        {view?.status === "unavailable" && <p className="text-swiss-text">Note: Link graph unavailable ({view.reason}). This is not a clean result.</p>}
      </div>
      {view?.status === "ok" && (
        <>
          {view.synthetic && <p className="t-small mt-4 text-swiss-text">{DEMO_LABEL}</p>}
          {view.nodes.length === 0 ? (
            <p className="mt-4 text-swiss-text">No linked identifiers in reports. This does not mean safe.</p>
          ) : (
            <div ref={box} role="img" aria-label="Link graph; the same links are listed as text below." className="mt-4 w-full overflow-hidden print:hidden">
              <ForceGraph2D
                graphData={{ nodes: view.nodes.map((n) => ({ ...n })), links: view.links.map((l) => ({ ...l })) }}
                width={width}
                height={Math.min(420, Math.round(width * 0.75))}
                backgroundColor={WHITE}
                warmupTicks={reduceMotion ? 120 : 0}
                cooldownTicks={reduceMotion ? 0 : Infinity}
                enableNodeDrag={!reduceMotion}
                nodeLabel={(n) => `${(n as Node).type}: ${(n as Node).label}`}
                nodeVal={(n) => ((n as Node).focus ? 6 : 2)}
                linkLabel={(l) => (l as Link).evidence}
                linkColor={(l) => (onPath(l as Link) ? ALERT : GREY)}
                linkWidth={(l) => (onPath(l as Link) ? 2.5 : 1)}
                linkDirectionalArrowLength={(l) => ((l as Link).relation === "payment" ? 4 : 0)}
                linkDirectionalArrowColor={(l) => (onPath(l as Link) ? ALERT : GREY)}
                nodeCanvasObjectMode={() => "replace"}
                nodeCanvasObject={(n, ctx, scale) => {
                  const node = n as Node & { x?: number; y?: number };
                  if (node.x === undefined || node.y === undefined) return;
                  const r = node.focus ? R_FOCUS : R_NODE;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
                  ctx.fillStyle = node.focus ? INK : WHITE;
                  ctx.fill();
                  ctx.lineWidth = 1.5 / scale;
                  ctx.strokeStyle = INK;
                  ctx.stroke();
                  ctx.font = `${12 / scale}px ${FONT}`;
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
          <ul className="mt-6 flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule">
            {view.paths.map((p, i) => (
              <li key={i} className="py-3">
                <span className="font-semibold">{p.query}</span> {p.text}
                {p.evidence.length > 0 && <span className="text-swiss-text"> Evidence: {p.evidence.join("; ")}.</span>}
              </li>
            ))}
          </ul>
          <p className="t-small mt-4 text-swiss-text">
            Graph backend: {view.backend}. Links come from community reports and on-chain transfers; a link is not proof of
            wrongdoing. Exchange and high-traffic addresses are excluded so unrelated people are not linked.
          </p>
        </>
      )}
    </div>
  );
}
