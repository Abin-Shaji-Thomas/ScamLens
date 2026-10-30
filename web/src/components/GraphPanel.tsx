"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Identifier } from "@/lib/extract/types";
import { onEvidencePath } from "@/lib/graph/edges";
import type { GraphView } from "@/lib/graph/view";
import { DEMO_LABEL } from "@/lib/demo";
import { MAX_GRAPH_LOOKUPS } from "@/lib/limits";
import type { GraphCoverage } from "@/lib/coverage";

// The canvas (FitGraph) is browser-only; it holds the graph ref so the drawing can be zoomed to fit.
const FitGraph = dynamic(() => import("./FitGraph"), { ssr: false });

const WAKING_AFTER_MS = 3000;
const REDUCED = "(prefers-reduced-motion: reduce)";
const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
type Link = GraphView["links"][number];

/** "tigergraph (12 ms)" for a direct answer; the fallback keeps its plain label "postgres (TigerGraph unavailable)". */
export function graphBackendLabel(v: Pick<GraphView, "backend" | "elapsedMs">): string {
  const name = v.backend ?? "none";
  return v.elapsedMs !== undefined && !/unavailable/.test(name) ? `${name} (${v.elapsedMs} ms)` : name;
}

/** `onLookup` tells the result card what the last lookup returned (for the coverage ledger's Link graph row). */
export function GraphPanel({ identifiers, onLookup }: { identifiers: Identifier[]; onLookup?: (g: NonNullable<GraphCoverage>) => void }) {
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
  // Evidence-path links are matched by node id, never by masked label (lib/graph/edges.ts).
  const onPath: (l: Link) => boolean = onEvidencePath(view);

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
        onLookup?.({ status: "unavailable" });
      } else {
        setView(body);
        onLookup?.({ status: body.status, backend: body.backend, elapsedMs: body.elapsedMs });
      }
    } catch {
      setView(null);
      setError("The link graph could not be loaded. Check your connection and try again.");
      onLookup?.({ status: "unavailable" });
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
              <FitGraph view={view} width={width} reduceMotion={reduceMotion} onPath={onPath} />
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
            Graph backend: {graphBackendLabel(view)}. Links come from community reports and on-chain transfers; a link is not proof of
            wrongdoing. Exchange and high-traffic addresses are excluded so unrelated people are not linked.
          </p>
        </>
      )}
    </div>
  );
}
