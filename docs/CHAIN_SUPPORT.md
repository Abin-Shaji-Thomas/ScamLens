# Etherscan V2 chain support

Source of truth in code: `EVM_CHAINS` in `web/src/lib/verified/etherscan.ts` (`freeTier` flag) and `chainEnabled()` (a chain is queried when `freeTier` is true or `ETHERSCAN_PLAN=paid`).

## Probe (2026-10-29, free-plan key)

Command, from `web/`: `npx tsx scripts/probe-etherscan-chains.ts` (one `module=account&action=balance` call per chain for the EIP-55 test vector, 1 call/s; the key is never printed).

| Chain id | Chain | `freeTier` in code | Probe result (2026-10-29T17:14Z) |
|---|---|---|---|
| 1 | Ethereum | true | OK, balance returned |
| 56 | BNB Chain | false | REJECTED: "Free API access is not supported for this chain. Please upgrade your api plan..." |
| 137 | Polygon | true | OK, balance returned |
| 8453 | Base | false | REJECTED: same message |
| 42161 | Arbitrum One | true | OK, balance returned |

The first probe run at 17:13Z timed out on BNB Chain (network); the second run, above, got Etherscan's answer. Code and probe agree on every chain.

## Behaviour

- Free plan: Ethereum, Polygon and Arbitrum One are looked up; BNB Chain and Base appear as "unavailable (not included in the Etherscan free API plan)", never as clean.
- `ETHERSCAN_PLAN=paid` enables all five (not probed: no paid key).
- Rate: `ETHERSCAN_RPS` (default 2/s; 3/s was measured to trip "Max calls per sec" on the free plan), at most 2 chains in flight, and only the first EVM wallet per check (`ETHERSCAN_MAX_ADDRESSES = 1`), because each chain costs 5 calls.
- Facts only (type, balance, nonce, first/last transaction). No "pattern" heuristic is derived from them: none could be explained in one sentence without implying a judgement.
