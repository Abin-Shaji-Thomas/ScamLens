import type { SourceResult } from "@/lib/verified/types";

const BADGE: Record<SourceResult["status"], { text: string; cls: string }> = {
  match: { text: "Match", cls: "bg-red-600 text-white" },
  no_match: { text: "Not listed", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100" },
  info: { text: "On-chain", cls: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" },
  unavailable: { text: "Unavailable", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100" },
};

function Line({ r }: { r: SourceResult }) {
  const b = BADGE[r.status];
  return (
    <li className="flex flex-col gap-1 border-t border-neutral-200 py-2 first:border-t-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.text}</span>
        <span className="font-medium">{r.sourceName}</span>
      </div>
      <p className="text-sm">{r.summary}</p>
      {r.facts.length > 0 && r.status !== "unavailable" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-neutral-600 dark:text-neutral-400">
          {r.facts.map((f, i) => (
            <div key={i} className="contents">
              <dt>{f.label}</dt>
              <dd className="break-all">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-neutral-500">
        {r.dataAsOf ? `List dated ${r.dataAsOf} · ` : ""}checked {r.checkedAt.slice(0, 16).replace("T", " ")} UTC ·{" "}
        <a href={r.link} target="_blank" rel="noreferrer" className="underline">
          source
        </a>
        {r.note ? ` · ${r.note}` : ""}
      </p>
    </li>
  );
}

export function VerifiedList({ results }: { results: SourceResult[] }) {
  const groups = new Map<string, SourceResult[]>();
  for (const r of results) {
    const key = `${r.identifier.type}:${r.identifier.value}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([key, rs]) => (
        <div key={key}>
          <p className="break-all font-mono text-xs font-semibold">
            {rs[0].identifier.type.toUpperCase()} {rs[0].identifier.value}
          </p>
          <ul>
            {rs.map((r, i) => (
              <Line key={i} r={r} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
