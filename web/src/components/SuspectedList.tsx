import type { AiStatus, Signal } from "@/lib/signals/types";
import { WARNING_CONTEXT_NOTE, WARNING_CONTEXT_TITLE } from "@/lib/tiers";

function Item({ s }: { s: Signal }) {
  return (
    <li className="flex flex-col py-4">
      <p className="font-semibold text-swiss-black">{s.label}</p>
      <p className="mt-1 break-id text-swiss-black">
        &ldquo;<mark className="quote">{s.quote}</mark>&rdquo;
      </p>
      <p className="t-small mt-1 text-swiss-text">
        rule {s.rule_id} · {s.source === "rule" ? "fixed pattern" : "AI, quote verified in your text"}
      </p>
    </li>
  );
}

export function SuspectedList({ signals, ai }: { signals: Signal[]; ai: AiStatus }) {
  const counted = signals.filter((s) => s.context !== "warning");
  const warning = signals.filter((s) => s.context === "warning");
  return (
    <div className="flex flex-col gap-6">
      {counted.length === 0 ? (
        <p className="text-swiss-text">No pattern signals found in the text.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule">
          {counted.map((s, i) => (
            <Item key={i} s={s} />
          ))}
        </ul>
      )}
      {warning.length > 0 && (
        <details>
          <summary className="py-2 text-swiss-text">
            {WARNING_CONTEXT_TITLE} ({warning.length})
          </summary>
          <p className="t-small mt-2 text-swiss-text">{WARNING_CONTEXT_NOTE}</p>
          <ul className="mt-4 flex flex-col divide-y divide-swiss-rule border-t border-swiss-rule">
            {warning.map((s, i) => (
              <Item key={i} s={s} />
            ))}
          </ul>
        </details>
      )}
      <p className="t-small text-swiss-text">
        AI pass:{" "}
        {ai.status === "ok"
          ? `${ai.model}${ai.dropped ? `, ${ai.dropped} unverifiable suggestion(s) discarded` : ""}`
          : `unavailable (${ai.reason})`}
      </p>
    </div>
  );
}
