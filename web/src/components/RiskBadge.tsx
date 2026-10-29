import { RISK_EXPLANATION, RISK_SHORT, type Risk, type RiskLevel } from "@/lib/risk";

const ORDER: RiskLevel[] = ["low", "elevated", "high"];

/** Risk level without colour: a large word, one plain sentence, and the scale with the current level in bold. */
export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <div className="flex flex-col">
      <p className="t-risk">{RISK_SHORT[risk.level]}</p>
      <p className="mt-3">{RISK_EXPLANATION[risk.level]}</p>
      <p className="t-small mt-4" aria-label={`Scale: ${risk.label}`}>
        {ORDER.map((l, i) => (
          <span key={l}>
            {i > 0 && <span className="text-swiss-text"> · </span>}
            <span className={l === risk.level ? "font-semibold text-swiss-black" : "text-swiss-text"} aria-current={l === risk.level ? "true" : undefined}>
              {RISK_SHORT[l]}
            </span>
          </span>
        ))}
      </p>
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
