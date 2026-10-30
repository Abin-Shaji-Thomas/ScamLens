"use client";

import { useEffect, useState } from "react";
import { GraphStats } from "@/lib/graph/stats-schema";

/** "The graph currently holds ..." fetched after the page loads; nothing at all on any failure. */
export function GraphStatsLine() {
  const [s, setS] = useState<GraphStats | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/graph/stats", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = GraphStats.safeParse(j);
        if (p.success) setS(p.data);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  return s ? <p data-graph-stats>{graphStatsSentence(s)}</p> : null;
}

export function graphStatsSentence(s: GraphStats): string {
  const by = s.backend === "tigergraph" ? "TigerGraph" : "the Postgres copy (TigerGraph is unavailable right now)";
  return `Right now the graph holds ${s.vertices.toLocaleString("en-IN")} vertices (identifiers and reports) and ${s.edges.toLocaleString("en-IN")} links, counted by ${by}.`;
}
