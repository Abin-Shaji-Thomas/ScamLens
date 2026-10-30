import { RISK_CEILING_NOTE, RISK_EXPLANATION, RISK_SHORT, type Risk, type RiskLevel } from "@/lib/risk";

const ORDER: RiskLevel[] = ["low", "elevated", "high"];

/**
 * Risk level never by colour alone: the large word, one plain sentence, the scale with the current level bold and
 * underlined, and a three-segment meter (1, 2 or 3 filled). Only High uses the alert colour.
 */
export function RiskBadge({ risk }: { risk: Risk }) {
  const filled = ORDER.indexOf(risk.level) + 1;
  return (
    <div className="flex flex-col">
      <p className="t-risk risk-word" data-level={risk.level}>
        {RISK_SHORT[risk.level]}
      </p>
      <p className="mt-6">{RISK_EXPLANATION[risk.level]}</p>
      <p className="t-small mt-6" aria-label={`Scale: ${risk.label}`}>
        {ORDER.map((l, i) => (
          <span key={l}>
            {i > 0 && <span className="text-swiss-text"> · </span>}
            <span
              className={l === risk.level ? "font-semibold text-swiss-black underline underline-offset-4" : "text-swiss-text"}
              aria-current={l === risk.level ? "true" : undefined}
            >
              {RISK_SHORT[l]}
            </span>
          </span>
        ))}
      </p>
      <div className="meter mt-3 max-w-xs" data-level={risk.level} aria-hidden="true">
        {ORDER.map((l, i) => (
          <span key={l} className="meter__seg" data-filled={i < filled ? "true" : "false"} />
        ))}
      </div>
      <details className="t-small mt-4" data-levels>
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4">What the levels mean</summary>
        <dl className="mt-2 flex flex-col gap-2 text-swiss-text">
          {ORDER.map((l) => (
            <div key={l}>
              <dt className="font-semibold text-swiss-black">{RISK_SHORT[l]}</dt>
              <dd>{RISK_EXPLANATION[l]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-swiss-text">{RISK_CEILING_NOTE}</p>
      </details>
      {risk.reasons.length > 0 && (
        <ul className="t-small mt-6 flex flex-col gap-1 text-swiss-text">
          {risk.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
