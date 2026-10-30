"use client";

import { useEffect, useState } from "react";
import { UsageStats, usageStatsSentence } from "@/lib/usage-stats-schema";

/** "Checks run in the last 7 days: N ..." fetched after the page loads; nothing at all on any failure. */
export function UsageStatsLine() {
  const [s, setS] = useState<UsageStats | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/usage-stats", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = UsageStats.safeParse(j);
        if (p.success) setS(p.data);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  return s ? <p data-usage-stats>{usageStatsSentence(s)}</p> : null;
}
