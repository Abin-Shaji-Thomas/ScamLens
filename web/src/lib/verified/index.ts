import type { Identifier } from "../extract/types";
import { uniqueIdentifiers } from "../identifiers";
import { checkEtherscanChain, EVM_CHAINS } from "./etherscan";
import { checkGoPlus } from "./goplus";
import { Unavailable, withTimeout } from "./http";
import { checkOfac, SEARCH_URL } from "./ofac";
import { BLOB_URL, checkScamSniffer } from "./scamsniffer";
import { checkTronGrid } from "./tron";
import { defaultDeps, unavailable, type CheckDeps, type ResultBase, type SourceResult } from "./types";

export const MAX_ADDRESSES = 10;
export const ETHERSCAN_MAX_ADDRESSES = 1; // 15 rate-limited calls per wallet on the free plan (~7.5 s)

type Task = { base: ResultBase; run: () => Promise<SourceResult> | SourceResult; guardMs: number };

/** Any error — network, timeout, schema, bug — becomes "unavailable". Never a pass. */
async function runTask(t: Task): Promise<SourceResult> {
  try {
    return await withTimeout(Promise.resolve().then(t.run), t.guardMs);
  } catch (e) {
    return unavailable(t.base, e instanceof Unavailable ? e.message : "internal error");
  }
}

// Where a user can check a finding themselves. Also used when a source is unavailable, so every row has a working link.
function defaultLink(id: Identifier, source: ResultBase["source"]): string {
  switch (source) {
    case "ofac":
      return SEARCH_URL;
    case "scamsniffer":
      return BLOB_URL;
    case "goplus":
      return "https://gopluslabs.io/";
    case "trongrid":
      return `https://tronscan.org/#/address/${id.value}`;
    case "etherscan":
      return `https://etherscan.io/address/${id.value}`;
  }
}

function base(id: Identifier, source: ResultBase["source"], sourceName: string, deps: CheckDeps): ResultBase {
  return { source, sourceName, identifier: { type: id.type, value: id.value }, checkedAt: deps.now().toISOString(), link: defaultLink(id, source) };
}

function tasksFor(id: Identifier, deps: CheckDeps, etherscanBudget: boolean): Task[] {
  const g = deps.timeoutMs + 250; // per-request timeout + scheduling slack
  const ofac: Task = { base: base(id, "ofac", "OFAC SDN list", deps), run: () => checkOfac(id, deps), guardMs: g };
  const goplus: Task = { base: base(id, "goplus", "GoPlus address security", deps), run: () => checkGoPlus(id, deps), guardMs: g };
  switch (id.type) {
    case "evm":
      return [
        ofac,
        { base: base(id, "scamsniffer", "ScamSniffer open blacklist", deps), run: () => checkScamSniffer(id, deps), guardMs: g },
        goplus,
        ...EVM_CHAINS.map((c) => {
          const b = { ...base(id, "etherscan", `Etherscan V2 (${c.name})`, deps), link: `${c.explorer}/address/${id.value}` };
          return {
            base: b,
            run: () =>
              etherscanBudget
                ? checkEtherscanChain(id, c, deps)
                : unavailable(b, `skipped: on-chain history is looked up for the first ${ETHERSCAN_MAX_ADDRESSES} wallet(s) only (rate limit)`),
            // Requests are rate-limited (3/s on the free plan), so allow queueing time on top of the per-request timeout.
            guardMs: deps.timeoutMs + 15000,
          };
        }),
      ];
    case "tron":
      return [ofac, goplus, { base: base(id, "trongrid", "TronGrid (TRON mainnet)", deps), run: () => checkTronGrid(id, deps), guardMs: g }];
    case "btc":
      return [ofac];
    default:
      return []; // UPI, phone, Telegram, email, domain: no verified source (report-only).
  }
}

export async function runVerifiedChecks(ids: Identifier[], deps: CheckDeps = defaultDeps()): Promise<SourceResult[]> {
  const addresses = uniqueIdentifiers(ids)
    .filter((i) => i.type === "evm" || i.type === "tron" || i.type === "btc")
    .slice(0, MAX_ADDRESSES);
  const evmOrder = addresses.filter((a) => a.type === "evm");
  return Promise.all(
    addresses.flatMap((id) => tasksFor(id, deps, evmOrder.indexOf(id) < ETHERSCAN_MAX_ADDRESSES)).map(runTask),
  );
}

// F6: ScamSniffer's domain list (blacklist/domains.json) was HEAD-probed on 2026-10-29 at 9,148,722 bytes,
// over the 8 MB budget for a lazily loaded serverless lookup, so domains are NOT checked against it.
export const SCAMSNIFFER_DOMAINS_PROBED_BYTES = 9_148_722;
export const DOMAIN_LIST_BUDGET_BYTES = 8 * 1024 * 1024;
export const DOMAIN_NOT_CHECKED_NOTICE =
  "Website domains are not checked against a blocklist here (ScamSniffer's domain list is too large for this deployment). Nothing found does not mean the site is safe.";
