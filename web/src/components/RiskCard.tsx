import { TIERS } from "@/lib/tiers";
import { TierSection } from "./TierSection";

export function RiskCard({ checked }: { checked: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Risk card</h2>
        <span className="text-sm text-neutral-500">
          {checked ? "Checks are not connected yet" : "Paste something and press Check"}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {TIERS.map((tier) => (
          <TierSection key={tier.id} tier={tier} />
        ))}
      </div>
    </div>
  );
}
