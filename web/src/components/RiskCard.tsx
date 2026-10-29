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
  if (!ids.length) return <p className="text-sm text-neutral-500">No wallet, UPI, phone, Telegram, email or link found.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map((i, k) => (
        <li key={k} className="max-w-full break-all rounded border border-neutral-300 px-2 py-0.5 font-mono text-xs dark:border-neutral-700">
          <span className="text-neutral-500">{i.type}</span> {i.value}
          <span className="text-neutral-500"> ({i.check === "checksum" ? "checksum valid" : "format valid"})</span>
        </li>
      ))}
    </ul>
  );
}

export function RiskCard({ result, demo = false }: { result: CheckResponse | null; demo?: boolean }) {
  const [verified, reported, suspected] = TIERS;
  return (
    <div className="rounded-lg border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
      {demo && result && <p className="mb-2 text-xs font-semibold uppercase text-fuchsia-700 dark:text-fuchsia-400">{DEMO_LABEL}</p>}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="risk-card-title" tabIndex={-1} className="text-lg font-semibold outline-none">
          Risk card
        </h2>
        {!result && <span className="text-sm text-neutral-500">Paste something and press Check</span>}
      </div>
      {result && (
        <div className="mt-3 flex flex-col gap-3">
          <RiskBadge risk={result.risk} />
          {result.notices.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              {result.notices.map((n, i) => (
                <li key={i}>
                  <span className="font-semibold">Note: </span>
                  {n}
                </li>
              ))}
            </ul>
          )}
          <WhatToDoNow />
          <div>
            <h3 className="text-sm font-medium">Identifiers found</h3>
            <div className="mt-1">
              <Identifiers ids={result.identifiers} />
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <TierSection tier={verified}>
          {result && result.verified.length > 0 ? <VerifiedList results={result.verified} /> : undefined}
        </TierSection>
        <TierSection tier={reported}>
          {result ? (
            <div className="flex flex-col gap-2">
              {result.risk.reportedMessage && <p className="text-sm italic text-neutral-500">{result.risk.reportedMessage}</p>}
              <ReportedList tier={result.reported} identifiers={result.identifiers} />
              <GraphPanel identifiers={result.identifiers} />
            </div>
          ) : undefined}
        </TierSection>
        <TierSection tier={suspected}>{result ? <SuspectedList signals={result.suspected} ai={result.ai} /> : undefined}</TierSection>
        {result && <EvidencePackButton result={result} demo={demo} />}
        {result && !demo && <ReportForm key={result.checkedAt} identifiers={result.identifiers} />}
      </div>
    </div>
  );
}
