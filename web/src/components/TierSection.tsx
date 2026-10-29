import type { ReactNode } from "react";
import type { TierInfo } from "@/lib/tiers";

const TIER_NUMBER: Record<TierInfo["id"], string> = { verified: "01", reported: "02", suspected: "03" };

/** One of the three tiers: a card with a 2px top rule, a decorative index and a real heading. */
export function TierSection({ tier, children }: { tier: TierInfo; children?: ReactNode }) {
  return (
    <section aria-labelledby={`tier-${tier.id}`} className="card col-span-full flex flex-col lg:col-span-4 print:break-inside-avoid">
      <p className="eyebrow" aria-hidden="true">
        {TIER_NUMBER[tier.id]}
      </p>
      <h2 id={`tier-${tier.id}`} className="t-h2 mt-2 text-swiss-black">
        {tier.title}
      </h2>
      <p className="mt-2 text-swiss-text">{tier.description}</p>
      <div className="mt-8">{children ?? <p className="text-swiss-text">{tier.emptyText}</p>}</div>
    </section>
  );
}
