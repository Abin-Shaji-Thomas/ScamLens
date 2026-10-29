import type { ReactNode } from "react";
import type { TierInfo } from "@/lib/tiers";

const TIER_NUMBER: Record<TierInfo["id"], string> = { verified: "01", reported: "02", suspected: "03" };

/** One of the three tiers: "01 Verified" etc., separated from the next by a hairline. */
export function TierSection({ tier, children }: { tier: TierInfo; children?: ReactNode }) {
  return (
    <section aria-labelledby={`tier-${tier.id}`} className="border-t border-hairline pt-8 print:break-inside-avoid">
      <h3 id={`tier-${tier.id}`} className="t-h2">
        <span className="mr-3">{TIER_NUMBER[tier.id]}</span>
        {tier.title}
      </h3>
      <p className="t-small mt-1 text-muted">{tier.description}</p>
      <div className="mt-6">{children ?? <p className="text-muted">{tier.emptyText}</p>}</div>
    </section>
  );
}
