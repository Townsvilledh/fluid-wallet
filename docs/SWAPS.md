# Swaps & routing

Fluid composes existing rails — there is no Fluid routing contract.
Users experience every cross-chain move as a **swap**, never a "bridge".

## How a swap is routed

Routing is **merit-based** (since 2026-11-11): the dispatcher quotes
the sources a pair can use — in walk order Satora, Jupiter, Across,
Relay, LI.FI, with Mayan competing as a ranked candidate — and the
routes compete on one rule: a route that fulfils the **full**
requirement (including the destination-gas delivery below, at the
user's actual size) outranks one that cannot; among routes that can,
the best net output wins. Brand order alone never decides.

The sources, per pair:

- **Satora** — EVM stablecoins → Lightning and → Bitcoin mainnet
  (non-custodial HTLC swaps). Note: Satora refunds return WBTC/tBTC,
  not the deposited stablecoin — the review sheet says so before you
  sign.
- **Jupiter** — Solana same-chain swaps (direct, ~10× cheaper than
  routing Solana through a general aggregator).
- **Across** — same-asset moves between EVM majors. (No gas drop:
  its API delivers a single output token.)
- **Relay** — the general any-asset router (Fluid's fee rides Relay's
  App Fees). Carries a gas top-up on EVM destinations.
- **Mayan** — Swift and Fast MCTP routes; carries a native gas drop
  (proven live by Fluid on Base → Sui, 2026-11-11).
- **LI.FI** — the long tail, **demoted for cause** (2026-11-11):
  its keyless API rate-limits hard (HTTP 429), it refuses to build
  any Sui swap unless the account already holds 0.05 SUI, it refuses
  micro sizes, and it quoted a Tron move at 45% of value. It is used
  only where it is the sole working source for a pair or
  demonstrably the best executable outcome, and it loses net-output
  ties to every other provider. Its gas fronting (LI.Fuel) is
  credited only when a returned route evidences the delivery.

Cross-ecosystem compositions (for example Base USDC → Satora via CCTP)
are assembled client-side from these rails.

## Destination gas — you never land stranded

When a swap crosses ecosystems, Fluid checks your native-gas balance
on the destination chain first. Below the per-chain "enough" line
(enough for several typical transactions — e.g. 0.06 SUI, 0.01 SOL,
0.0001 ETH on L2s, sized from real fee data), delivery is adjusted,
in this order:

1. **Gas drop alongside** — a small slice of the swap arrives as the
   destination's native token next to your asset (Mayan `gasDrop`,
   Relay top-up, LI.FI LI.Fuel where the route evidences it). The
   review says so in one line, with the slice's size: *"You have no
   gas token on Sui, so a little of this swap (about $0.05) will
   arrive as SUI for gas."*
2. **All-to-native, then swap back** — where no route can carry the
   slice, the swap lands 100% as the native token, then swaps into
   your asset on the destination chain, keeping the gas reserve.
   One review, one confirmation; if the second leg fails after the
   first landed, you hold the **native** token (movable, never
   stranded) and the swap sheet offers a one-tap "Complete the swap".
3. **A plain warning** — only if neither mechanism works, the review
   says before you confirm that the funds will land without gas.

The gas slice is part of your own swap, **not a fee** — Fluid's fee
is computed and disclosed separately, under the same fee law as
always (`docs/FEES.md`). Same-chain swaps, native-token deliveries,
and destinations where you already hold enough gas are untouched.

## What you see before you sign

Every swap review shows, in plain language: the amount in and out, the
route, the **total route cost** ("route cost ≈ $X" — what the route
itself consumes), and **Fluid's fee** as its own line, computed by the
fee law (`docs/FEES.md`). If no route answers, the sheet says so —
Fluid never invents a quote, and a route whose true cost would eat a
dust-sized swap is labelled honestly instead of hidden.

## Coverage, honestly

- Swaps route on and between the EVM networks, Solana, Tron and Sui,
  plus the Satora exits to Lightning/Bitcoin.
- Bitcoin-family, Cosmos and the other send/receive families
  (`docs/CHAINS.md`) exit through the routed families above.
- Some source chains cannot be quoted from every network environment;
  when that happens the sheet shows an honest refusal, not a fake zero.
