// Shared by the server (graph view) and the browser (GraphPanel): no server imports here.

/** Key for an undirected link between two node ids. */
export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type PathLike = { paths: { edges: [string, string][] }[] };
type LinkEnd = string | { id: string };

/**
 * Predicate for "this link is on an evidence path" (Q1-Q3): true when its two node ids are a step of a listed path.
 * Matching is by id only: masked labels can repeat (two wallets can mask the same), so they never decide it. The
 * graph library replaces link ends with node objects after layout, so both shapes are handled.
 */
export function onEvidencePath(view: PathLike | null): (l: { source: unknown; target: unknown }) => boolean {
  const keys = new Set(view?.paths.flatMap((p) => p.edges.map(([a, b]) => edgeKey(a, b))) ?? []);
  const end = (x: unknown) => (typeof x === "object" && x !== null ? (x as Exclude<LinkEnd, string>).id : String(x));
  return (l) => keys.has(edgeKey(end(l.source), end(l.target)));
}
