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
  sign. Version gate: Fluid serves Satora routes only while the
  live API reports the audited line — re-verified and re-pinned
  2026-11-13 to `backend-v0.3` (spec 0.3.26) after a full live diff
  against the 2026-11-08 audit found every depended-on behaviour
  identical (research_notes/fluid-satora-repin-20261113/REPORT.md).
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
fee law (`docs/FEES.md`). If no route answers, the sheet says WHY, in
one of three honest cases, each established by live probes at the
moment of failure (`diagnoseNoRouteSwap`) — never the bare router
error:

- **Below the minimum for this pair** — the same pair is re-quoted at
  climbing sizes ($10 / $50 / $250); the first size that answers is
  named: "the smallest swap that works right now is about X."
- **No market found for the token** — a non-hub token is also probed
  into its own chain's native coin, at the entered amount and at
  100× it. If even that has no quote, there is no market to route
  from, at any size (the SAFU case: a balance with no buyers).
- **No route exists for this pair yet** — the token trades, but no
  rail connects this pair at any probed size. This is the
  direct-quote limit described under "Milestone routing" below —
  the case composition exists to close. Until composition lands,
  and whenever even a composition search finds nothing, this
  message is the honest end of the search.

A transport failure (a rate limit, a network drop) is never
re-labelled as any of these: it keeps its own error, because probing
a rate limit would burn quota and manufacture a verdict.

## Coverage, honestly

- Swaps route on and between the EVM networks, Solana, Tron and Sui,
  plus the Satora exits to Lightning/Bitcoin.
- Bitcoin-family, Cosmos and the other send/receive families
  (`docs/CHAINS.md`) exit through the routed families above.
- Some source chains cannot be quoted from every network environment;
  when that happens the sheet shows an honest refusal, not a fake zero.

Per-pair reality for the Sui lanes (live-probed 2026-11-13):

- **Relay has no Sui chain at all** (58 chains listed, none is Sui) —
  no Relay quote can ever enter or leave Sui.
- **Mayan serves Sui only as a Fast MCTP destination for USDC** from
  CCTP-domain chains (Base proven live 2026-11-11). From BNB Chain
  Mayan answers "Route not found" for every token (BNB, WBNB, USDC,
  USDT) at every size probed ($0.22–$50): BSC has no CCTP domain, and
  Mayan Swift does not connect BSC → Sui.
- **LI.FI is the only rail that quotes into or out of Sui in
  general** — so every non-USDC Sui pair, and every Sui pair from
  BNB Chain, rides on LI.FI alone. For BSC → Sui specifically,
  LI.FI has no working route at any size today: on 2026-11-13 it
  answered "No available quotes for the requested transfer" for
  BNB → SUI at $0.22, $10 and $51 to a zero-SUI destination (the
  owner's exact failure) *and* to a destination holding 1.50 SUI —
  the pair itself is unserved, not merely size- or balance-gated.
  (Separately, repo-verified 2026-11-11: on the Sui pairs LI.FI
  does serve, it refuses to build the swap unless the destination
  already holds 0.05 SUI.)

## Milestone routing — composing a route when no rail quotes the pair

**The router asks for direct quotes first.** `getSwapRoutes`
puts the exact from→to pair to each rail and ranks what answers;
a direct answer returns untouched. Only when no rail lists the
pair does the milestone composition search below run (Stage 1,
shipped 2026-11-13) — before it landed, the search simply ended
there, which is the history this section records. The only multi-leg
constructions that exist are fixed-purpose: the destination-gas
fallback (land as the destination's native coin, then swap into the
target on-chain) and the Satora CCTP composition for Bitcoin /
Lightning exits. Nothing ever searches for an **indirect** route —
yet indirect routes exist today for pairs no rail quotes directly,
priced below with live quotes. That gap, not any single pair, is
the main distance between "many pairs" and "any asset to any
asset".

**The requirement (set 2026-11-13): if there is no direct route,
find the alternative route.** On direct-quote failure the router
searches *milestone compositions*: origin asset → the origin
chain's canonical liquid asset (USDC / USDT / WETH) → an
intermediate chain that unlocks the destination rail → the
destination asset, each milestone chosen because a rail verifiably
serves it, the whole composition ranked by total cost and presented
as one route with one combined output. Execution reuses the
destination-gas fallback's durable machinery (persisted per-leg
records, resume after a landed leg, "complete the swap"), extended
from its fixed native-only shape to searched compositions.

**Scope (set 2026-11-13, the owner's widening): the requirement
is any chain → any chain, not the Sui example.** The composition
search is general — it special-cases no chain: for any pair the
direct search cannot serve, it tries the origin's hub asset, a
milestone chain chosen for the property the destination rail
needs, and the destination's hub asset, across every family
Fluid swaps in (EVM chains, Solana, Tron, Sui, and — as
destinations — Bitcoin mainnet and Lightning). Two honest
boundaries: Bitcoin and Lightning are receive-only swap
destinations today (no BTC-source leg exists that Fluid can
sign — `swapChainOf` returns null for Bitcoin by design, its
step payloads being PSBT shapes Fluid has not inspected), so
nothing composes FROM Bitcoin yet; and a chain Fluid does not
support at all (Robinhood Chain, as of this writing) cannot be
a composition endpoint — support for a chain is its own work,
never invented here. Bitcoin/Lightning destinations compose
through USDC on a Satora source chain (Arbitrum first):
any asset → USDC on Arbitrum → Satora to BTC/Lightning,
inheriting Satora's floors (10,000 sats to mainnet — below
which Lightning is the small-size destination — and 356 sats
to Lightning) and its version gate (Fluid refuses Satora
routes while the live API's version line differs from the
audited spec; that gate, not routing, is what stands between
a composed BNB → BTC and execution whenever it is closed —
it closed on 2026-11-13 when Satora moved to backend-v0.3.26
and re-opened the same day after the re-verification and
re-pin recorded in the Satora bullet above).

### Worked example, live-priced 2026-11-13: BNB (BNB Chain) → SUI (Sui)

No rail quotes this pair directly (see "Per-pair reality" above).
The composition that works: **BNB → USDC on Base → USDC on Sui →
SUI**, where Base is the milestone — it holds a CCTP domain, which
is what unlocks Mayan's Fast MCTP into Sui.

| Leg | Rail | Live evidence |
|---|---|---|
| BNB → USDC on Base | Relay / Mayan Swift | Relay quotes at every size probed, down to the failing 0.00035 BNB → $0.2025 out. Mayan Swift is cheaper where it quotes (0.0032 BNB → $2.0457; 0.016 → $10.2429; 0.08 → $51.2529) but refuses below ~0.00156 BNB (≈$1.00): "Amount too small". |
| USDC on Base → USDC on Sui | Mayan Fast MCTP | Quotes at every size probed ($0.22 → 0.159268 USDC out; $2 → 1.938479; $10 → 9.934935; $50 → 49.917215, each with the gas drop below). The flat shortfall is ≈$0.061–0.083 — the redeem relayer fee — so the percentage cost collapses as size grows. |
| USDC → SUI on Sui | Cetus (the LI.FI Sui lane) | The same lane Fluid executed live on 2026-11-07 (SUI → USDC). Probed 2026-11-13: LI.FI finds routes for the pair (its 422 was a tx-build refusal for a probe account holding no USDC, not a missing market). Pool fee ≈0.05–0.25% at these sizes (estimate), gas ≈0.015 SUI. |

**The first-time-Sui gas problem is solved inside the composition:**
Mayan Fast MCTP carries a native **gas drop** — up to 0.1 SUI
delivered alongside the USDC (0.05 SUI drop quoted at every size
above; 0.025 SUI executed live on 2026-11-11). A zero-SUI account
lands USDC *and* the SUI to pay the final leg's gas, and a drop of
≥0.05 SUI also satisfies LI.FI's 0.05-SUI destination rule for
building that final swap. No rail outside this composition offers
the drop: Relay has no Sui chain, and LI.FI's own Sui quotes refuse
a zero-SUI destination outright.

**Composed end-to-end (cheapest leg at each size; final leg at the
0.25% estimate):**

| In | SUI value out (≈) | All-in cost |
|---|---|---|
| $0.22 (the size that failed) | $0.18 | ≈$0.04 (~18%) |
| $1.02 | $0.98 | ≈$0.05 (~5%) |
| $2.05 | $2.02 | ≈$0.03 (~1.5%) |
| $10.25 | $10.19 | ≈$0.06 (~0.6%) |
| $51.31 | $51.08 | ≈$0.23 (~0.5%) |

The route exists at the exact size that failed — fixed leg costs
make it expensive in percentage terms at $0.22, and near-free by
$10. Quote-time measurements, not guarantees.

### The build, staged so each stage ships on its own

1. **Stage 0 — honest failure (shipped).** The three-case diagnosis
   above: below-minimum (with the working size), no-market,
   no-route-yet. It becomes composition's fallback: it speaks only
   when the composition search also finds nothing.
2. **Stage 1 — milestone composition search (shipped 2026-11-13).**
   On direct-quote failure, the router searches compositions of
   the worked example's shape: an origin hub leg when the FROM
   token is not a hub asset, a milestone-chain hop when the
   destination rail needs a chain property the origin lacks (a
   CCTP domain, a listing), and a destination hub leg when rails
   reach the destination chain's hub asset but not the target
   token. Composed candidates are priced all-in (the sum of
   their legs' costs) and ranked by the same merit rule; every
   leg is quoted by its own rail under the same fee law as a
   direct route, so Fluid's fee is collected per leg by that
   leg's own mechanism (Relay App Fees, Mayan referrer, LI.FI
   integrator) and disclosed as the sum — there is no extra
   Fluid charge and no Fluid contract. The review presents the
   composition as ONE route with one combined output and the
   milestones named plainly. Execution persists a per-leg
   record (the gas-fallback pattern, generalised): each later
   leg is re-quoted fresh from what actually arrived, and a
   leg that cannot run yet leaves the user holding the
   previous leg's asset in their own wallet, with a one-tap
   "Complete the swap" resume. Destination-gas planning runs
   across the whole composition: the leg entering the
   destination ecosystem carries the gas drop (into Sui,
   Mayan's 0.06 SUI drop at the sizes below — which also
   satisfies LI.FI's 0.05 SUI build rule when the final on-Sui
   leg is re-quoted after it lands). A transport failure (a
   rate limit, a network drop) is never composed over: it
   propagates as itself.
   Live composed quotes for the worked example, from the
   shipped search on 2026-11-13 (quote-time measurements, not
   guarantees; the final on-Sui leg is estimate-previewed at
   the recorded 0.25% pool-fee estimate until the gas drop
   lands, then re-quoted fresh for execution):
   | In | Route | Out (≈) |
   |---|---|---|
   | $0.22 (0.00035 BNB) | Relay BNB→USDC-Base ($0.198) → Mayan USDC→Sui ($0.129 + 0.06 SUI drop) → est. SUI | 0.1613 SUI ($0.129) + the 0.06 SUI drop |
   | $2.02 (0.0032 BNB) | Mayan BNB→USDC-Base ($1.829) → Mayan USDC→Sui ($1.751 + 0.06 SUI drop) → est. SUI | 2.1857 SUI ($1.747) + the 0.06 SUI drop |
   Per-pair minimum for this composition today: it answers at
   the smallest size probed ($0.22) — the floor is cost, not
   availability: fixed leg costs (above all Mayan's ≈$0.06–0.08
   Fast MCTP shortfall) eat a visible share below a few dollars,
   and the review shows the true all-in cost before signing.

**The floor no routing can remove:** every leg carries fixed costs
— a DEX fee, a bridge minimum, destination gas. Composition moves
the floor (a composed route answered at $0.22 where no direct quote
exists at any size), but below a few dollars those fixed costs
still eat a visible share of the swap. At those sizes Fluid's job
is to show the true all-in cost before signing — and, when even
composition finds nothing, to say the working minimum plainly
(Stage 0), never to invent a route that loses the user's money.
