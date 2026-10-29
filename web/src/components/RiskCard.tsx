import type { CheckResponse } from "@/lib/api-schema";
import { DEMO_LABEL } from "@/lib/demo";
import { TIERS } from "@/lib/tiers";
import { EvidencePackButton } from "./EvidencePackButton";
import { GraphPanel } from "./GraphPanel";
import { ReportedList } from "./ReportedList";
import { ReportForm } from "./ReportForm";
import { RiskBadge } from "./RiskBadge";
import { SuspectedList } from "./SuspectedList";
import { TierSection } from "./TierSection";
import { VerifiedList } from "./VerifiedList";
import { WhatToDoNow } from "./WhatToDoNow";

function Identifiers({ ids }: { ids: CheckResponse["identifiers"] }) {
  if (!ids.length) return <p className="text-swiss-text">No wallet, UPI, phone, Telegram, email or link found.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((i, k) => (
        <li key={k} className="break-id">
          <span className="font-semibold">{i.value}</span>
          <span className="t-small text-swiss-text">
            {" "}
            · {i.type} · {i.check === "checksum" ? "checksum valid" : "format valid"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RiskCard({ result, demo = false }: { result: CheckResponse | null; demo?: boolean }) {
  const [verified, reported, suspected] = TIERS;
  return (
    <div className="flex flex-col">
      <h2 id="risk-card-title" tabIndex={-1} className="t-small text-swiss-text outline-none">
        Risk card
      </h2>
      {!result && <p className="mt-2 text-swiss-text">Paste something and press Check</p>}
      {result && (
        <div className="mt-4 flex flex-col">
          {demo && <p className="t-small mb-4 text-swiss-text">{DEMO_LABEL}</p>}
          <RiskBadge risk={result.risk} />
          {result.notices.map((n, i) => (
            <p key={i} className="t-small mt-4 text-swiss-text">
              Note: {n}
            </p>
          ))}
          <div className="mt-12 sm:mt-16">
            <WhatToDoNow />
          </div>
          <section aria-labelledby="ids-found" className="mt-12 sm:mt-16">
            <h3 id="ids-found" className="t-h2">
              Identifiers found
            </h3>
            <div className="mt-4">
              <Identifiers ids={result.identifiers} />
            </div>
          </section>
        </div>
      )}
      <div className="mt-12 flex flex-col gap-12 sm:mt-16 sm:gap-16">
        <TierSection tier={verified}>
          {result && result.verified.length > 0 ? <VerifiedList results={result.verified} /> : undefined}
        </TierSection>
        <TierSection tier={reported}>
          {result ? (
            <div className="flex flex-col gap-6">
              {result.risk.reportedMessage && <p className="text-swiss-text">{result.risk.reportedMessage}</p>}
              <ReportedList tier={result.reported} identifiers={result.identifiers} />
              <GraphPanel identifiers={result.identifiers} />
            </div>
          ) : undefined}
        </TierSection>
        <TierSection tier={suspected}>{result ? <SuspectedList signals={result.suspected} ai={result.ai} /> : undefined}</TierSection>
        {result && (
          <div className="flex flex-col gap-8 border-t border-swiss-rule pt-8">
            <EvidencePackButton result={result} demo={demo} />
            {!demo && <ReportForm key={result.checkedAt} identifiers={result.identifiers} />}
          </div>
        )}
      </div>
    </div>
  );
}
