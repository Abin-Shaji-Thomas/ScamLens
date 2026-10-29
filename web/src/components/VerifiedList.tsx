import type { SourceResult } from "@/lib/verified/types";

// Status as a word, never only as a colour.
const STATUS: Record<SourceResult["status"], string> = {
  match: "Match",
  no_match: "Not listed",
  info: "On-chain facts",
  unavailable: "Unavailable",
};

function Row({ r }: { r: SourceResult }) {
  return (
    <li className="flex flex-col py-4">
      <p className="font-semibold text-swiss-black">
        {STATUS[r.status]} · {r.sourceName}
      </p>
      <p className="mt-1 text-swiss-text">{r.summary}</p>
      {r.facts.length > 0 && r.status !== "unavailable" && (
        <dl className="facts t-small mt-2 text-swiss-text">
          {r.facts.map((f, i) => (
            <div key={i} className="contents">
              <dt>{f.label}</dt>
              <dd className="break-id">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="t-small mt-2 text-swiss-text">
        {r.sourceName}
        {r.dataAsOf ? ` · list dated ${r.dataAsOf}` : ""} · checked {r.checkedAt.slice(0, 16).replace("T", " ")} UTC ·{" "}
        <a href={r.link} target="_blank" rel="noreferrer">
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
    <div className="flex flex-col gap-8">
      {[...groups.entries()].map(([key, rs]) => (
        <div key={key}>
          <p className="t-small break-id text-swiss-text">
            <span className="uppercase tracking-[0.1em]">{rs[0].identifier.type}</span> {rs[0].identifier.value}
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule">
            {rs.map((r, i) => (
              <Row key={i} r={r} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
