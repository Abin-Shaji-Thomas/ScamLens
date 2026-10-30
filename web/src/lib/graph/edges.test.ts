import { describe, expect, it } from "vitest";
import { edgeKey, onEvidencePath } from "./edges";

describe("evidence-path links by node id (H4)", () => {
  it("edgeKey ignores direction", () => {
    expect(edgeKey("a", "b")).toBe(edgeKey("b", "a"));
    expect(edgeKey("a", "b")).not.toBe(edgeKey("a", "c"));
  });

  it("two nodes with the same masked label: only the link on the path is highlighted", () => {
    // B and C mask to the same label; the old label matching highlighted A-C as well.
    const view = {
      nodes: [
        { id: "aaaa", label: "zzde***@okdemo" },
        { id: "bbbb", label: "0xfB69...d359" },
        { id: "cccc", label: "0xfB69...d359" },
      ],
      paths: [{ text: "zzde***@okdemo is linked to Telegram @zz***ne only through shared wallet 0xfB69...d359.", edges: [["aaaa", "bbbb"]] as [string, string][] }],
    };
    const on = onEvidencePath(view);
    expect(on({ source: "aaaa", target: "bbbb" })).toBe(true);
    expect(on({ source: "bbbb", target: "aaaa" })).toBe(true);
    expect(on({ source: "aaaa", target: "cccc" })).toBe(false);
  });

  it("handles link ends that the graph library replaced with node objects, and no view", () => {
    const on = onEvidencePath({ paths: [{ edges: [["x1", "y2"]] }] });
    expect(on({ source: { id: "x1" }, target: { id: "y2" } })).toBe(true);
    expect(on({ source: { id: "x1" }, target: { id: "z3" } })).toBe(false);
    expect(onEvidencePath(null)({ source: "x1", target: "y2" })).toBe(false);
  });

  it("GraphPanel no longer reads labels to decide; it uses onEvidencePath", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("../../components/GraphPanel.tsx", import.meta.url), "utf8");
    expect(src).toContain("onEvidencePath(view)");
    expect(src).not.toMatch(/p\.text\.includes/);
  });
});
