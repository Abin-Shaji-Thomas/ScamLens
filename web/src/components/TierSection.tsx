import type { ReactNode } from "react";
import type { TierInfo } from "@/lib/tiers";

const ACCENT: Record<TierInfo["id"], string> = {
  verified: "border-l-emerald-600",
  reported: "border-l-amber-500",
  suspected: "border-l-sky-600",
};

export function TierSection({ tier, children }: { tier: TierInfo; children?: ReactNode }) {
  return (
    <section
      aria-labelledby={`tier-${tier.id}`}
      className={`border-l-4 ${ACCENT[tier.id]} rounded-md bg-neutral-50 p-4 dark:bg-neutral-900`}
    >
      <h3 id={`tier-${tier.id}`} className="text-base font-semibold">
        {tier.title}
      </h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{tier.description}</p>
      <div className="mt-3">{children ?? <p className="text-sm italic text-neutral-500">{tier.emptyText}</p>}</div>
    </section>
  );
}
