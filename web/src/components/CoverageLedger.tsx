import type { CheckResponse } from "@/lib/api-schema";
import { buildCoverage, type GraphCoverage } from "@/lib/coverage";

/** "What was checked": every source with its status and date, built from this result only. Never says "clean". */
export function CoverageLedger({ result, graph = null }: { result: CheckResponse; graph?: GraphCoverage }) {
  const { rows, notChecked } = buildCoverage(result, { graph });
  return (
    <section aria-labelledby="coverage-title">
      <div className="grid">
        <h2 id="coverage-title" className="t-h2 col-span-full lg:col-span-4">
          What was checked
        </h2>
        <div className="col-span-full mt-6 flex flex-col lg:col-span-8 lg:col-start-5 lg:mt-0">
          <ul className="flex flex-col divide-y divide-swiss-rule border-y border-swiss-rule">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-x-6 py-3 md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,12rem)]" data-coverage={r.id} data-status={r.status}>
                <p className="font-semibold text-swiss-black">{r.name}</p>
                <p className="t-small text-swiss-text">
                  {r.covers}
                  {r.detail ? ` (${r.detail})` : ""}
                </p>
                <p className="t-small">
                  <span className="font-semibold text-swiss-black">{r.status}</span>
                  {r.when && <span className="text-swiss-text"> · {r.when}</span>}
                </p>
              </li>
            ))}
          </ul>
          {notChecked.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow">Not checked</p>
              <ul className="mt-2 flex flex-col gap-1">
                {notChecked.map((n, i) => (
                  <li key={i} className="text-swiss-text">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
