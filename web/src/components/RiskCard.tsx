"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import type { GraphCoverage } from "@/lib/coverage";
import { DEMO_LABEL } from "@/lib/demo";
import { newLineText } from "@/lib/new-line";
import { TIERS } from "@/lib/tiers";
import { CoverageLedger } from "./CoverageLedger";
import { EvidencePackButton } from "./EvidencePackButton";
import { GraphPanel } from "./GraphPanel";
import { LinkHints } from "./LinkHints";
import { ReportedList } from "./ReportedList";
import { ReportForm } from "./ReportForm";
import { RiskBadge } from "./RiskBadge";
import { SuspectedList } from "./SuspectedList";
import { TierSection } from "./TierSection";
import { VerifiedList } from "./VerifiedList";
import { ContributePanel } from "./ContributePanel";
import { FeedbackPanel } from "./FeedbackPanel";
import { ScamTrail } from "./ScamTrail";
import { WhatToDoNow } from "./WhatToDoNow";

function Identifiers({ ids }: { ids: CheckResponse["identifiers"] }) {
  if (!ids.length) return <p className="text-swiss-text">No wallet, UPI, phone, Telegram, email or link found.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((i, k) => (
        <li key={k} className="break-id">
          <span className="font-semibold text-swiss-black">{i.value}</span>
          <span className="t-small text-swiss-text">
            {" "}
            · {i.type} · {i.check === "checksum" ? "checksum valid" : "format valid"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** `text` is the text that was checked; it stays in the browser (used only for the "I already paid" draft). */
export function RiskCard({
  result,
  demo = false,
  text = "",
  showNew = false,
}: {
  result: CheckResponse | null;
  demo?: boolean;
  text?: string;
  /** The one-time "New: ..." line (CheckForm decides; first result in a browser session). */
  showNew?: boolean;
}) {
  // The last link-graph lookup for THIS result (keyed by checkedAt, so a new check starts at "not looked up").
  const [lookup, setLookup] = useState<{ at: string; g: GraphCoverage } | null>(null);
  const graph = result && lookup && lookup.at === result.checkedAt ? lookup.g : null;
  const [verified, reported, suspected] = TIERS;
  return (
    <>
      <section aria-labelledby="risk-card-title">
        <div className="grid">
          <div className="col-span-full flex flex-col lg:col-span-8">
            <h2 id="risk-card-title" tabIndex={-1} className="eyebrow self-start">
              Risk card
            </h2>
            {!result && <p className="mt-4 text-swiss-text">Paste something and press Check</p>}
            {result && (
              <div className="mt-6 flex flex-col">
                {demo && <p className="t-small mb-4 text-swiss-text">{DEMO_LABEL}</p>}
                <RiskBadge risk={result.risk} />
                {showNew && (
                  <p className="t-small mt-4 text-swiss-text print:hidden" data-new-line>
                    {newLineText(Boolean(result.receipt))}
                  </p>
                )}
                {result.notices.map((n, i) => (
                  <p key={i} className="mt-4 text-swiss-text">
                    Note: {n}
                  </p>
                ))}
              </div>
            )}
          </div>
          {result && (
            <section aria-labelledby="ids-found" className="col-span-full mt-12 border-t-2 border-swiss-black pt-6 lg:col-span-3 lg:col-start-10 lg:mt-0">
              <h3 id="ids-found" className="eyebrow">
                Identifiers found
              </h3>
              <div className="mt-4">
                <Identifiers ids={result.identifiers} />
              </div>
            </section>
          )}
        </div>
      </section>
      {result && <CoverageLedger result={result} graph={graph} />}
      <section aria-label="Evidence tiers">
        <div className="grid gap-y-16">
          <TierSection tier={verified}>
            {result && result.verified.length > 0 ? <VerifiedList results={result.verified} /> : undefined}
          </TierSection>
          <TierSection tier={reported}>
            {result ? (
              <div className="flex flex-col gap-6">
                {result.risk.reportedMessage && <p className="text-swiss-text">{result.risk.reportedMessage}</p>}
                <ReportedList tier={result.reported} identifiers={result.identifiers} feedback={result.feedback?.entries} />
                <LinkHints result={result} />
              </div>
            ) : undefined}
          </TierSection>
          <TierSection tier={suspected}>{result ? <SuspectedList signals={result.suspected} ai={result.ai} /> : undefined}</TierSection>
          {result && (
            <div className="col-span-full">
              <GraphPanel identifiers={result.identifiers} onLookup={(g) => setLookup({ at: result.checkedAt, g })} />
            </div>
          )}
        </div>
      </section>
      {result && <ScamTrail trail={result.trail} />}
      {result && <WhatToDoNow text={text} />}
      {result && (
        <section aria-label="Evidence pack and reporting">
          <div className="grid gap-y-12">
            <div className="col-span-full lg:col-span-6">
              <EvidencePackButton result={result} demo={demo} />
            </div>
            {!demo && (
              <div className="col-span-full lg:col-span-5 lg:col-start-8">
                <div className="flex flex-col gap-10">
                  <FeedbackPanel key={`f-${result.checkedAt}`} result={result} />
                  <ReportForm key={result.checkedAt} identifiers={result.identifiers} />
                  <ContributePanel key={`c-${result.checkedAt}`} result={result} text={text} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
