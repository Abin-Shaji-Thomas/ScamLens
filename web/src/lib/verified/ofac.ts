import type { Identifier } from "../extract/types";
import { normaliseAddress } from "./lists-schema";
import { ofacList } from "./lists";
import type { CheckDeps, SourceResult } from "./types";

const SEARCH_URL = "https://sanctionssearch.ofac.treas.gov/";

export function checkOfac(id: Identifier, deps: Pick<CheckDeps, "now">): SourceResult {
  const { meta, byAddress } = ofacList();
  const hits = byAddress.get(normaliseAddress(id.value)) ?? [];
  const base = {
    source: "ofac" as const,
    sourceName: "OFAC SDN list",
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    dataAsOf: meta.publish_date,
    link: hits.length ? `https://sanctionssearch.ofac.treas.gov/Details.aspx?id=${hits[0].sdn_uid}` : SEARCH_URL,
  };
  if (!hits.length) {
    return { ...base, status: "no_match", summary: `Not on the OFAC SDN list published ${meta.publish_date}.`, facts: [] };
  }
  const h = hits[0];
  return {
    ...base,
    status: "match",
    summary: `Listed on the OFAC SDN list (published ${meta.publish_date}) under "${h.sdn_name}".`,
    facts: [
      { label: "SDN entry", value: h.sdn_name },
      { label: "Programs", value: h.programs.join(", ") || "n/a" },
      { label: "Listed currency", value: hits.map((x) => x.currency).join(", ") },
      { label: "SDN UID", value: h.sdn_uid },
    ],
  };
}
