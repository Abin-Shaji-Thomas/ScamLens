import { SCAM_TYPE_LABEL, SCAM_TYPES } from "@/lib/scam-types";

/** "Common scams in India": five invented examples of commonly reported scam types. A click only fills the box. */
export function CommonScams({ onPick }: { onPick: (id: string, text: string) => void }) {
  return (
    <section aria-labelledby="common-scams-title" className="print:hidden" data-common-scams>
      <div className="grid gap-y-6">
        <div className="col-span-full flex flex-col lg:col-span-4">
          <h2 id="common-scams-title" className="t-h2">
            Common scams in India
          </h2>
          <p className="t-small mt-2 text-swiss-text">
            {SCAM_TYPE_LABEL}. Press one to put it in the box, then press Check. <a href="/about#scam-types" className="tap">Where these come from</a>
          </p>
        </div>
        <ul className="col-span-full flex flex-col divide-y divide-swiss-rule border-y border-swiss-rule lg:col-span-8 lg:col-start-5">
          {SCAM_TYPES.map((s) => (
            <li key={s.id} className="flex flex-col py-3" data-scam-type={s.id}>
              <button type="button" className="btn-link self-start text-left" onClick={() => onPick(s.id, s.example)}>
                {s.name}
              </button>
              <p className="t-small text-swiss-text">{s.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
