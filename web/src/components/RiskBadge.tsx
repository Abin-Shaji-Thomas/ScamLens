import { RISK_EXPLANATION, RISK_SYMBOL, type Risk } from "@/lib/risk";

const STYLE: Record<Risk["level"], string> = {
  high: "bg-red-600 text-white",
  elevated: "bg-amber-500 text-black",
  low: "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={`self-start rounded-md px-3 py-1 text-sm font-semibold ${STYLE[risk.level]} print:border print:border-black`}>
        <span aria-hidden="true">{RISK_SYMBOL[risk.level]} </span>
        {risk.label}
      </p>
      <p className="text-sm">{RISK_EXPLANATION[risk.level]}</p>
      {risk.reasons.length > 0 && (
        <ul className="list-inside list-disc text-xs text-neutral-600 dark:text-neutral-400">
          {risk.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
