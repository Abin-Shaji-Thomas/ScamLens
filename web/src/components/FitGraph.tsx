"use client";

import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { GraphView } from "@/lib/graph/view";
import { graphHeight, labelFontPx, FIT_PADDING_PX } from "@/lib/graph/drawing";

// Swiss graph: the checked identifier is a filled black circle, others hollow with a 1.5px black stroke;
// links are 1px grey, the evidence-path link 2.5px alert; labels are black below the nodes, on a white halo.
const INK = "#000000";
const GREY = "#808080";
const ALERT = "#b00020"; // only the evidence-path link
const WHITE = "#ffffff";
const R_FOCUS = 6;
const R_NODE = 4.5;
const FONT = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif';

type Node = GraphView["nodes"][number];
type Link = GraphView["links"][number];
type FNode = NodeObject<Node>;

export interface FitGraphProps {
  view: GraphView;
  width: number;
  reduceMotion: boolean;
  onPath: (l: Link) => boolean;
}

/** The canvas itself. Loaded only in the browser (GraphPanel imports it dynamically). */
export default function FitGraph({ view, width, reduceMotion, onPath }: FitGraphProps) {
  const fg = useRef<ForceGraphMethods<FNode, LinkObject<FNode, Link>> | undefined>(undefined);
  // Stable data: rebuilding it on every render would restart the layout.
  const data = useMemo(() => ({ nodes: view.nodes.map((n) => ({ ...n })), links: view.links.map((l) => ({ ...l })) }), [view]);
  const height = graphHeight(width);

  // Spread nodes enough that labels below them rarely collide.
  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-160);
    (g.d3Force("link") as unknown as { distance?: (d: number) => void } | undefined)?.distance?.(70);
    g.d3ReheatSimulation();
  }, [data]);

  const fit = () => fg.current?.zoomToFit(reduceMotion ? 0 : 400, FIT_PADDING_PX);

  // A new canvas size (window resize, rotation) does not restart the layout, so fit again ourselves.
  useEffect(() => {
    const t = setTimeout(() => fg.current?.zoomToFit(0, FIT_PADDING_PX), 50);
    return () => clearTimeout(t);
  }, [width, height]);

  return (
    <ForceGraph2D<Node, Link>
      ref={fg}
      graphData={data}
      width={width}
      height={height}
      backgroundColor={WHITE}
      warmupTicks={reduceMotion ? 160 : 0}
      cooldownTicks={reduceMotion ? 0 : 160}
      onEngineStop={fit}
      enableNodeDrag={!reduceMotion}
      nodeLabel={(n) => `${n.type}: ${n.label}`}
      nodeVal={(n) => (n.focus ? 6 : 2)}
      linkLabel={(l) => l.evidence}
      linkColor={(l) => (onPath(l as Link) ? ALERT : GREY)}
      linkWidth={(l) => (onPath(l as Link) ? 2.5 : 1)}
      linkDirectionalArrowLength={(l) => (l.relation === "payment" ? 4 : 0)}
      linkDirectionalArrowColor={(l) => (onPath(l as Link) ? ALERT : GREY)}
      nodeCanvasObjectMode={() => "replace"}
      nodeCanvasObject={(n, ctx, scale) => {
        if (n.x === undefined || n.y === undefined) return;
        const r = n.focus ? R_FOCUS : R_NODE;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = n.focus ? INK : WHITE;
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = INK;
        ctx.stroke();
        // Label below the circle, never over it, with a white halo so crossing links stay readable.
        const px = labelFontPx(scale);
        ctx.font = `${px}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const y = n.y + r + 3 / scale;
        ctx.lineJoin = "round";
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = WHITE;
        ctx.strokeText(n.label, n.x, y);
        ctx.fillStyle = INK;
        ctx.fillText(n.label, n.x, y);
      }}
      nodePointerAreaPaint={(n, color, ctx) => {
        if (n.x === undefined || n.y === undefined) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, (n.focus ? R_FOCUS : R_NODE) + 2, 0, 2 * Math.PI);
        ctx.fill();
      }}
    />
  );
}
