import type { AiStatus, Signal } from "@/lib/signals/types";
import { WARNING_CONTEXT_NOTE, WARNING_CONTEXT_TITLE } from "@/lib/tiers";

function Item({ s }: { s: Signal }) {
  return (
    <li className="text-sm">
      <span className="font-medium">{s.label}</span>
      <blockquote className="mt-0.5 border-l-2 border-sky-600 pl-2 font-mono text-xs break-words">
        &ldquo;<mark className="rounded-sm bg-yellow-200 px-0.5 text-neutral-900 dark:bg-yellow-700 dark:text-neutral-50 print:bg-transparent print:underline">{s.quote}</mark>&rdquo;
      </blockquote>
      <span className="text-xs text-neutral-500">
        rule <code>{s.rule_id}</code> · {s.source === "rule" ? "fixed pattern" : "AI, quote verified in your text"}
      </span>
    </li>
  );
}

export function SuspectedList({ signals, ai }: { signals: Signal[]; ai: AiStatus }) {
  const counted = signals.filter((s) => s.context !== "warning");
  const warning = signals.filter((s) => s.context === "warning");
  return (
    <div className="flex flex-col gap-2">
      {counted.length === 0 ? (
        <p className="text-sm italic text-neutral-500">No pattern signals found in the text.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {counted.map((s, i) => (
            <Item key={i} s={s} />
          ))}
        </ul>
      )}
      {warning.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {WARNING_CONTEXT_TITLE} ({warning.length})
          </summary>
          <p className="mt-1 text-xs text-neutral-500">{WARNING_CONTEXT_NOTE}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {warning.map((s, i) => (
              <Item key={i} s={s} />
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-neutral-500">
        AI pass:{" "}
        {ai.status === "ok"
          ? `${ai.model}${ai.dropped ? `, ${ai.dropped} unverifiable suggestion(s) discarded` : ""}`
          : `unavailable (${ai.reason})`}
      </p>
    </div>
  );
}
