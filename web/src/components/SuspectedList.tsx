import type { AiStatus, Signal } from "@/lib/signals/types";

export function SuspectedList({ signals, ai }: { signals: Signal[]; ai: AiStatus }) {
  return (
    <div className="flex flex-col gap-2">
      {signals.length === 0 ? (
        <p className="text-sm italic text-neutral-500">No pattern signals found in the text.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {signals.map((s, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{s.label}</span>
              <blockquote className="mt-0.5 border-l-2 border-sky-600 pl-2 font-mono text-xs break-words">
                &ldquo;{s.quote}&rdquo;
              </blockquote>
              <span className="text-xs text-neutral-500">
                rule <code>{s.rule_id}</code> · {s.source === "rule" ? "fixed pattern" : "AI, quote verified in your text"}
              </span>
            </li>
          ))}
        </ul>
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
