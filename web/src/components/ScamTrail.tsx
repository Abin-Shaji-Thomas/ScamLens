import { CATEGORY_LABEL, CHANNEL_LABEL, LOSS_LABEL } from "@/lib/cases/schema";
import { DEMO_LABEL } from "@/lib/demo";
import type { IdentifierType } from "@/lib/extract/types";
import type { Trail, TrailSummary } from "@/lib/trail/schema";

const TYPE_NAME: Record<IdentifierType, string> = {
  evm: "wallet",
  tron: "TRON wallet",
  btc: "Bitcoin address",
  upi: "UPI ID",
  telegram: "Telegram handle",
  phone: "phone number",
  email: "email address",
  domain: "website",
};

const list = (rows: { key: string; n: number }[], label: Record<string, string> = {}) => rows.slice(0, 4).map((r) => `${label[r.key] ?? r.key} ${r.n}`).join(", ");

function casesSentence(s: TrailSummary): string {
  if (s.source === "reports") {
    const all = s.syntheticCases > 0 && s.realCases === 0;
    return `${s.syntheticCases + s.realCases} linked identifier(s) are reported by 2 or more independent people${all ? ", all illustrative demo data" : s.syntheticCases ? ` (${s.realCases} real, ${s.syntheticCases} illustrative demo data)` : ""}.`;
  }
  const kind = s.realCases === 0 ? ", all illustrative demo data" : s.syntheticCases === 0 ? "" : ` (${s.realCases} real, ${s.syntheticCases} illustrative demo data)`;
  return `${s.cases} linked case(s) from ${s.reporters} independent people${kind}.`;
}

/** "Scam trail": plain sentences and counts about links to other reported identifiers. Only when links exist. */
export function ScamTrail({ trail }: { trail?: Trail }) {
  if (!trail || trail.status !== "ok" || !trail.entries.some((e) => e.linked > 0)) return null;
  const s = trail.summary;
  const demo = s ? s.syntheticCases > 0 : false;
  return (
    <section aria-labelledby="trail-title" data-trail>
      <div className="grid">
        <h2 id="trail-title" className="t-h2 col-span-full lg:col-span-4">
          Scam trail
        </h2>
        <div className="col-span-full mt-6 flex flex-col gap-4 lg:col-span-8 lg:col-start-5 lg:mt-0">
          {demo && <p className="t-small text-swiss-text">{DEMO_LABEL}</p>}
          <ul className="flex flex-col gap-2">
            {trail.entries
              .filter((e) => e.linked > 0)
              .map((e, i) => (
                <li key={i} data-trail-entry={e.type}>
                  This {TYPE_NAME[e.type]} ({e.display}) is linked to {e.linked} other identifier(s)
                  {e.reportedLinks > 0
                    ? `; ${e.reportedLinks} of them reported by 2 or more independent people (up to ${e.maxLinkedReporters}).`
                    : ", none of them reported by 2 or more independent people."}
                  {e.touchesFlagged && " The links reach an address on a verified list."}
                </li>
              ))}
          </ul>
          {s && (
            <div className="flex flex-col gap-1" data-trail-summary={s.source}>
              <h3 className="font-semibold text-swiss-black">How many others got this and what happened</h3>
              <p>{casesSentence(s)}</p>
              {s.categories.length > 0 && <p className="t-small text-swiss-text">Types: {list(s.categories, CATEGORY_LABEL)}</p>}
              {s.channels.length > 0 && <p className="t-small text-swiss-text">Came by: {list(s.channels, CHANNEL_LABEL)}</p>}
              {s.lossBands.length > 0 && <p className="t-small text-swiss-text">Money lost: {list(s.lossBands, LOSS_LABEL)}</p>}
              {s.months.length > 0 && <p className="t-small text-swiss-text">Months: {list([...s.months].sort((a, b) => a.key.localeCompare(b.key)))}</p>}
              {s.firstSeen && s.lastSeen && (
                <p className="t-small text-swiss-text">
                  First seen {s.firstSeen}, last seen {s.lastSeen}.
                </p>
              )}
            </div>
          )}
          <p className="t-small text-swiss-text">
            A link is not proof of wrongdoing. Press &ldquo;Show links&rdquo; above to see the graph. Checked with {trail.backend}
            {trail.elapsedMs !== undefined ? ` in ${trail.elapsedMs} ms` : ""}.
          </p>
        </div>
      </div>
    </section>
  );
}
