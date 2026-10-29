// Independent in-memory implementation of Q1-Q3 over a seed Scenario. Used only to
// cross-check that the database backend (Postgres CTE or TigerGraph) gives the same answers.
import type { Scenario } from "./seed";

type Edge = { a: string; b: string; submission: number };

function coEdges(s: Scenario): Edge[] {
  const out: Edge[] = [];
  for (const r of s.reports) {
    for (const x of r.items) for (const y of r.items) if (x.hash !== y.hash) out.push({ a: x.hash, b: y.hash, submission: r.reporter });
  }
  return out;
}

function hubs(s: Scenario, hubMax: number): Set<string> {
  const nbrs = new Map<string, Set<string>>();
  const add = (a: string, b: string) => nbrs.set(a, (nbrs.get(a) ?? new Set()).add(b));
  for (const e of coEdges(s)) add(e.a, e.b);
  for (const [x, y] of s.payments) {
    add(x.hash, y.hash);
    add(y.hash, x.hash);
  }
  const out = new Set(s.exchanges);
  for (const [n, set] of nbrs) if (set.size > hubMax) out.add(n);
  return out;
}

const display = (s: Scenario, hash: string) => Object.values(s.nodes).find((n) => n.hash === hash)?.display ?? hash;
const typeOf = (s: Scenario, hash: string) => Object.values(s.nodes).find((n) => n.hash === hash)?.type;

/** Q1 -> sorted "wallet -> telegram" strings. */
export function refQ1(s: Scenario, upiHash: string, hubMax: number): string[] {
  const edges = coEdges(s);
  const h = hubs(s, hubMax);
  const out = new Set<string>();
  for (const uw of edges.filter((e) => e.a === upiHash && ["evm", "tron", "btc"].includes(typeOf(s, e.b) ?? ""))) {
    if (h.has(uw.b)) continue;
    for (const wt of edges.filter((e) => e.a === uw.b && typeOf(s, e.b) === "telegram" && e.submission !== uw.submission)) {
      if (edges.some((d) => d.a === upiHash && d.b === wt.b)) continue;
      out.add(`${display(s, uw.b)} -> ${display(s, wt.b)}`);
    }
  }
  return [...out].sort();
}

/** Q2 -> sorted "a -> b -> c" path strings ending at a flagged address. */
export function refQ2(s: Scenario, walletHash: string, hubMax: number): string[] {
  const h = hubs(s, hubMax);
  const out: string[] = [];
  const walk = (path: string[]) => {
    const node = path[path.length - 1];
    if (path.length > 1 && s.flagged.has(node)) out.push(path.map((p) => display(s, p)).join(" -> "));
    if (path.length > 2) return; // max 2 hops
    if (path.length > 1 && h.has(node)) return; // never pass through a hub
    for (const [x, y] of s.payments) if (x.hash === node && !path.includes(y.hash)) walk([...path, y.hash]);
  };
  walk([walletHash]);
  return out.sort();
}

/** Q3 -> sorted "wallet: n handles" strings. */
export function refQ3(s: Scenario, minSize: number, hubMax: number): string[] {
  const handles = new Map<string, Set<string>>();
  for (const e of coEdges(s)) {
    if (["evm", "tron", "btc"].includes(typeOf(s, e.a) ?? "") && typeOf(s, e.b) === "telegram" && !s.exchanges.has(e.a)) {
      handles.set(e.a, (handles.get(e.a) ?? new Set()).add(e.b));
    }
  }
  return [...handles]
    .filter(([, set]) => set.size >= minSize && set.size <= hubMax)
    .map(([w, set]) => `${display(s, w)}: ${set.size} handles`)
    .sort();
}
