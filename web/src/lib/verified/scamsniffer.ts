import type { Identifier } from "../extract/types";
import { scamSnifferList } from "./lists";
import type { CheckDeps, SourceResult } from "./types";

export const BLOB_URL = "https://github.com/scamsniffer/scam-database/blob/main/blacklist/all.json";

export function checkScamSniffer(id: Identifier, deps: Pick<CheckDeps, "now">): SourceResult {
  const { meta, set } = scamSnifferList();
  const asOf = meta.upstream_committed_at.slice(0, 10);
  const hit = set.has(id.value.toLowerCase());
  return {
    source: "scamsniffer",
    sourceName: "ScamSniffer open blacklist",
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    dataAsOf: asOf,
    note: meta.delay_note,
    link: BLOB_URL,
    status: hit ? "match" : "no_match",
    summary: hit
      ? `Listed on the ScamSniffer open address blacklist (copy dated ${asOf}).`
      : `Not on the ScamSniffer open address blacklist (copy dated ${asOf}).`,
    facts: [],
  };
}
