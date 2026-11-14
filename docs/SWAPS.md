# Swaps & routing

Fluid composes existing rails — there is no Fluid routing contract.
Users experience every cross-chain move as a **swap**, never a "bridge".

## How a swap is routed

Routing is **merit-based** (since 2026-11-11): the dispatcher quotes
the sources a pair can use — in walk order Satora, Jupiter, Across,
Relay, with Mayan competing as a ranked candidate — and the
routes compete on one rule: a route that fulfils the **full**
requirement (including the destination-gas delivery below, at the
user's actual size) outranks one that cannot; among routes that can,
the best net output wins. Brand order alone never decides.

The sources, per pair:

- **Satora** — EVM stablecoins → Lightning, → Bitcoin mainnet and
  → Arkade; and Arkade → Lightning and → EVM stablecoins
  (non-custodial HTLC swaps; the Arkade legs are VHTLC swaps —
  see "Arkade as a swap endpoint" below). Note: Satora refunds
  return WBTC/tBTC, not the deposited stablecoin — the review
  sheet says so before you sign. Version gate: Fluid serves
  Satora routes only while the live API reports the audited
  line — re-verified and re-pinned 2026-11-13 to `backend-v0.3`
  (spec 0.3.26) after a full live diff against the 2026-11-08
  audit found every depended-on behaviour identical
  (research_notes/fluid-satora-repin-20261113/REPORT.md).
- **Jupiter** — Solana same-chain swaps (direct, ~10× cheaper than
  routing Solana through a general aggregator).
- **Across** — same-asset moves between EVM majors. (No gas drop:
  its API delivers a single output token.)
- **Relay** — the general any-asset router (Fluid's fee rides Relay's
  App Fees). Sources: EVM chains and Tron (Fluid builds the Tron
  transaction locally from Relay's call parameters and inspects the
  built bytes before signing). Carries a gas top-up on EVM
  destinations.
- **Mayan** — Swift and Fast MCTP routes; carries a native gas drop
  (proven live by Fluid on Base → Sui, 2026-11-11).
- **SunSwap** — Tron same-chain swaps (direct V2 router port,
  2026-11-14): Fluid quotes the pinned router's own
  `getAmountsOut` as a constant call (never an off-chain price),
  composes the swap call locally and inspects the built bytes
  before signing — the Relay-Tron discipline. SunSwap has no
  integrator-fee parameter, so Fluid's fee is an output-side
  skim to the DripBot Tron wallet inside the same flow (see
  `docs/FEES.md`), disclosed on the route like every rail.

**Removed 2026-11-13: LI.FI.** The general aggregator that used to
cover the long tail was removed entirely, on the owner's order,
after its demotion for cause (2026-11-11: hard rate-limiting of the
keyless API, refusal to build Sui swaps unless the account already
held 0.05 SUI, micro-size refusals, a 45%-cost Tron quote). Every
function it served was re-homed or is named below as an open gap:
EVM swaps ride Relay/Across/Mayan; Tron sources ride Relay (with
Fluid's fee collected through Relay App Fees, live-probed
2026-11-13); Solana same-chain rides Jupiter; token lists come from
CoinGecko (EVM) and Jupiter (Solana); chain discovery runs on the
chainid.network registry + DefiLlama TVL. The gaps are listed under
"Known gaps" below (the Sui entries there closed on
2026-11-13/14 and the Tron same-chain entry on 2026-11-14 —
see the gap list itself).

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
   Relay top-up). The
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

- Swaps route on and between the EVM networks, Solana and Tron,
  plus USDC into Sui (Mayan Fast MCTP), Sui same-chain swaps
  (direct Cetus aggregator port, 2026-11-13), Tron same-chain
  swaps (direct SunSwap V2 port, 2026-11-14) and the Satora
  exits to Lightning/Bitcoin — and, since 2026-11-14, Satora
  swaps OUT of Lightning (to EVM stablecoins and Bitcoin), out
  of Arkade, and OUT of Bitcoin itself (to EVM stablecoins and
  Lightning); see the sections below. The same build closed
  the shipped EVM → Bitcoin lane's claim gap: a funded
  EVM → BTC swap's Bitcoin is now claimable in-app from the
  swaps list (the "Bitcoin as a swap source" section below). Sui-source cross-chain swaps
  ride Mayan Fast MCTP (the bridge-origin port of 2026-11-14)
  for USDC, native SUI and USDT out of Sui — the non-USDC
  inputs convert through Mayan's server-built slices under
  two pinned grammars (the server-swap port of 2026-11-14;
  see the Sui-source entry in "Known gaps" below). Milestone compositions (Stage 1,
  below) carry those families further: since the address-book
  lift (2026-11-14, "Milestone routing" below), Solana, Tron
  and Sui sources also compose through an EVM milestone into
  Sui, Bitcoin and Lightning destinations.
- Bitcoin-family, Cosmos and the other send/receive families
  (`docs/CHAINS.md`) exit through the routed families above.
- Arkade is a swap endpoint in its own right (2026-11-14) — see
  the next section.
- Some source chains cannot be quoted from every network environment;
  when that happens the sheet shows an honest refusal, not a fake zero.

## Arkade as a swap endpoint (2026-11-14)

Arkade — Fluid's Bitcoin layer-2, previously reachable only
inside the Bitcoin exit tab — is a first-class swap endpoint
(universal-composability audit §7.2). All three pairs ride
Satora under the same version gate, fee law and creation-check
discipline as the Bitcoin/Lightning lanes; Satora's live pair
table (verified 2026-11-14) floors every Arkade pair at
**335 sats** (~$0.23):

- **EVM stablecoins → Arkade.** The shipped Permit2 funding
  path unchanged; the payout side is an Arkade VHTLC the server
  funds and the user claims into their own Arkade wallet with
  their Fluid swap key (the bridge's VHTLC claim machinery,
  driven from the swap sheet's Satora list once the swap is
  funded server-side). Arkade is a milestone terminus like
  Bitcoin/Lightning: compositions into Arkade settle at the
  user's own Arkade address from the address book, and search
  never boots the Arkade session — the session lazy-boots only
  when the user picks Arkade or claims. (Arkade is ALSO a
  milestone intermediate since the cheapest-entry build below:
  a composition may pass THROUGH Arkade on its way to
  Lightning or Bitcoin mainnet.) One wire difference
  from the other lanes: this creation may omit the lock token
  (the reference SDK's funding terms tolerate the same); the
  funding payload's lock token is then adopted onto the record
  and pinned before anything is signed — validated as a real
  address that is not the token being sold.
- **Arkade → Lightning.** Source-anchored for Lightning
  addresses/LNURLs; for a pasted invoice the invoice pins its
  own amount, Satora derives the lock from the invoice's
  payment hash, and Fluid pins the creation's lock amount to
  invoice + the quoted fee stack before funding. Satora pays
  the invoice itself once the VHTLC is funded — no user claim.
- **Arkade → EVM stablecoins** (curated USDC/USDT on Ethereum,
  Polygon, Arbitrum). The payout is a gasless HTLC claim: the
  server's redeem-and-swap calldata is bounds-checked against
  the reviewed net, the claim digest is reproduced locally
  (EIP-712, HTLCErc20 v7) and signed with the swap's own secret
  key, whose derived address the creation pinned as the claim
  address — the signature, not the server, names the final
  destination.

Funding an Arkade-source swap spends the user's Arkade VTXOs
through one new wrapper (`fundArkadeVhtlc` in the Arkade
chunk): the funding address is **recomputed locally from the
creation's lock parameters** (the same StrictVhtlcScript
recompute the Lightning → Arkade bridge lock check uses) and
the send is refused on any mismatch, before any sats move;
the Arkade balance is checked first, and the executor funds
the **creation's** lock amount, never the quote's. Fee
capture: Satora's developer-key extra fee folds into the
protocol fee on all three Arkade pairs exactly as on the
Bitcoin/Lightning lanes (verified live 2026-11-14: quotes with
the key requested 25 bps and returned it inside the protocol
fee on every pair), so routes quote under the standard
two-pass differential law. Two honest limits: the fee law
still declines to add Fluid's fee where the route's own cost
already busts the destination ecosystem's ceiling — on
Arkade → EVM that is the common case at larger sizes, because
Satora's internal BTC rate prices the stablecoin output well
under spot, and the route then shows `collecting: false`
rather than a fee the law forbids; and nothing composes **out
of** Arkade — by design, not for want of the two-crossing
planner (built 2026-11-14, §"Milestone routing" below): that phase
deliberately does not extend source branches with their own
first legs, and an Arkade-source leg is not a leg the
milestone executor can drive (it drives Satora legs through
the EVM executor) — Arkade as a destination composes freely,
Arkade as a source is direct-only. The swap sheet carries the standing Arkade
warning whenever either side is Arkade: a Bitcoin layer-2
whose exits to mainnet are operator-assisted, with VTXOs that
expire if never renewed.

## Lightning as a swap source (2026-11-14)

Lightning joins the swap sheet as a SOURCE family
(universal-composability audit §7.3): the sats in the user's
own Fluid Lightning wallet (their LDK node) can be swapped
out through Satora, under the same version gate, fee law and
creation-check discipline as every other Satora lane. Pairs
(per Satora's live table, verified 2026-11-14):

- **Lightning → EVM stablecoins** (curated USDC/USDT on
  Arbitrum, Polygon, Ethereum; source floor **356 sats**).
  Paying is a HOLD invoice locked to the swap's own payment
  hash: Satora funds an HTLCErc20 on the destination chain,
  and Fluid claims the payout gaslessly under the swap's own
  claim signature (the same claim as the Arkade → EVM lane),
  which reveals the secret and settles the hold. If Satora
  doesn't complete the swap, the held payment returns to the
  user's Lightning wallet automatically when the hold
  expires — no refund action exists or is needed.
- **Lightning → Bitcoin mainnet** (direct pair; source floor
  **10,000 sats**). Satora funds an on-chain Taproot HTLC
  (script v1) under the user's own Fluid swap key; the claim
  is a client-built Bitcoin transaction (Fluid ports the
  reference construction: hashlock + timelock leaves under a
  NUMS internal key, 150-vbyte claim at the live fee rate,
  paid out of the locked sats), broadcast from the swap
  sheet's Satora list once funded. Below the 10,000-sat
  floor the sheet presents the way-through instead of a dead
  end: the Bitcoin bridge tab's Lightning → Arkade → Bitcoin
  composition, which serves smaller amounts.
- **Lightning → Arkade** is deliberately NOT duplicated in
  the sheet: the Bitcoin bridge tab already owns that exact
  move through the same creation endpoint family.

Creation is bounds-checked before anything is paid, with the
discipline generalised from the Lightning → Arkade bridge
check: the creation's invoice must ask for exactly the
reviewed sats and be locked to the swap's own hash (paying
anything else would not be atomic against the claim), fees
must reconcile with the quote's itemised stack, and for a
Bitcoin payout the HTLC address is **recomputed locally from
the creation's own lock parameters** (hash lock, claim key,
server refund key, refund locktime) and refused on mismatch.
The amount paid is always the CREATION's invoice amount,
never the quote's. Fee capture: the developer-key extra fee
folds into the protocol fee on LN-source pairs exactly as on
the other lanes (verified live 2026-11-14: 500 → 750 sats at
+25 bps to Arbitrum; on the Bitcoin pair the fold is computed
on the post-fee base — 298 → 790 at +50 bps — which is why
the fee is always attributed differentially, never assumed);
where the route's own cost already busts the destination
ecosystem's ceiling the route shows `collecting: false`
rather than a fee the law forbids. Composition: Lightning is
a milestone SOURCE — LN → USDC on a Satora chain composes
onward to Sui (via the CCTP milestone), Tron, Solana and
other EVM chains inside the planner's one-crossing limit.
(Correction history: the exhaustive any-to-any sweep of
2026-11-14 (research_notes/fluid-any-to-any-matrix-20261114)
first found the Tron onward composition missing — LN → Tron
returned no route at $1/$10/$50 or on the diagnosis ladder to
$250, though both legs quoted individually. Fixed and
live-verified later on 2026-11-14: LN → Tron USDT now
composes at $10 fee-collecting and at $50 with the fee
honestly null. The Solana onward rests on the EVM → Solana
leg, which quoted nothing all sweep window. Sui and the EVM
chains verified composing.)
Compositions anchored on Base (Satora serves no LN → Base
pair) and anything needing a second hub crossing remain
uncomposed for this branch even after the two-crossing
planner (2026-11-14): that phase extends only the generic
hub grammar, and the LN-source branch keeps its own
one-crossing grammar by design. Execution
gate: the payer's constraint is the node's spendable
balance, read fresh at review and again at Confirm; an
unreadable node balance is the gate's unreadable verdict,
and route preview at zero balance works like every family
(the search reads no balance at all).

## Bitcoin as a swap source (2026-11-14) — and the EVM → BTC claim

Bitcoin mainnet is a first-class swap SOURCE (universal-
composability audit §7.4), not just a destination. The pairs
are Satora's live ones: **BTC → EVM stablecoins** (the curated
USDC/USDT on Ethereum, Polygon and Arbitrum) and **BTC →
Lightning** (the direct pair). BTC → Arkade is NOT a Satora
pair — the pair table carries no such row — so it composes
through an EVM hub or Lightning instead of being forced.
Floors are Satora's and are disclosed as the route's wherever
these swaps are offered: **20,000 sats** (10,000 to Polygon) —
Bitcoin-source is not $1-class and no copy pretends otherwise.

Quotes ride the same wire schema as the other Satora source
lanes (verified live 2026-11-14: fee-free residual identities
hold to the sat on the Arbitrum, Polygon and Lightning pairs,
and the developer-key extra fee folds into the protocol fee —
500 → 750 sats at +25 bps to Arbitrum — attributed
differentially, never assumed). The fee law applies per
destination family as elsewhere; at 100,000 sats the routes'
own cost busts the EVM ceiling, so they show
`collecting: false` rather than a forbidden fee. Duration is
honest: a Bitcoin funding send needs confirmations, so these
routes carry a ~1-hour execution estimate and are never
badged fast.

**The funding inspection.** Creation is
`POST /swap/bitcoin/evm` or `POST /swap/bitcoin/lightning`
under the shipped version gate, and the creation is verified
BEFORE any funding send exists: the lock amount and payout
must be the reviewed figures; for an EVM destination the BTC
hash lock must be ripemd160 of the EVM hash lock and the EVM
lock must be the swap identity's own; for a Lightning
destination the BTC hash lock must be ripemd160 of the
payment hash (for an invoice, the reviewed invoice's own
hash, named back verbatim); the fee must reconcile with the
reviewed stack; the BTC refund timelock must be **strictly
after** the EVM refund timelock; and the HTLC address must
**recompute locally from the creation's own parameters**
(hash lock, Satora's claim key, the user's own refund key,
the BTC refund locktime) and equal the creation's
`btc_htlc_address`. Any mismatch refuses the creation — no
funding transaction is built, let alone signed. The record
persists before funding, the persisted record's lock is
recomputed a second time, and only then does funding happen:
an ordinary Bitcoin send of the exact reviewed sats from the
user's confirmed UTXOs (inscription-bearing outputs excluded
by the planner, as everywhere). An EVM payout is claimed
in-flow through the same gasless claim as the other source
lanes; a Lightning payout needs no claim.

**The refund.** The HTLC's timelock leaf belongs to the
user's own swap key, so an expired funded swap is recovered
WITHOUT Satora's cooperation: a script-path spend of the
timelock leaf after its locktime, built and bounds-checked in
core (exactly one input — the lock's UTXO; exactly one output
— the user's own Bitcoin address minus a pinned fee; the
transaction locktime IS the refund locktime; sequence
0xFFFFFFFE), sighash-verified in tests against an
independently recomputed BIP341 sighash. The swaps list
surfaces "Refund my Bitcoin" whenever a funded record's swap
failed or its refund time has passed unclaimed, and the
review copy states the refund truth before the user confirms.

**Part A — the shipped EVM → BTC claim.** Records from the
original EVM → Bitcoin lane stored the HTLC address but none
of the BTC lock parameters, and had no claim path at all.
The swaps list now offers "Claim Bitcoin on-chain" on a
funded EVM → BTC record: the lock parameters are recovered
from Satora's current swap object and verified against the
record (hash lock = ripemd160 of the swap's own hash lock,
claim key = the wallet's BIP86 Taproot key those records were
created with, HTLC address recomputed to the recorded
address), then the claim is built with the shared HTLC claim
builder paying the record's own claim address. The lane's
refund paths are the shipped EVM-side ones, stated on the
record's history line.

**Collaborative refund signing — wired (2026-11-14).** The
follow-up named above is closed for every EVM-source lane
(Bitcoin, Lightning and Arkade destinations share the same
EVM HTLC lock). A funded EVM-source record in a
collaborative-refund state offers "Refund my locked tokens"
in the swaps list. The executor refreshes the swap's state
first (the fresh status gates eligibility; the swap object's
recorded lock terms — `evm_htlc_locked_amount`,
`evm_htlc_sender`, `evm_htlc_token` — double-source the
refund's amount, sender and token), fetches Satora's refund
params, and bounds-checks every field against the
bounds-checked creation record (HTLC, coordinator, lock
preimage hash, lock token, claim address, timelock, chain)
before anything is signed. Two paths, per the server's
answer: **coordinator** — Fluid builds the `CollabRefund`
EIP-712 digest itself under the coordinator's domain and
signs it with the depositor's EVM key (self-verified by
recovery before submission), but only for the no-calls shape:
an in-kind sweep of the lock token, a zero output floor, and
an empty calls hash — a calls payload Fluid cannot see is
never signed over; Satora co-signs and broadcasts, gasless,
and the record stores the response's tx hash. **Direct** —
the server returns its HTLC-level `Refund` signature plus
the exact terms it covers; every term is pinned to the
record, Fluid encodes `refundBySig` under its pinned
selector, dry-runs the exact call against the HTLC (the
contract is the oracle for the server's signature), and only
then broadcasts it from the depositor's own wallet, which
pays that chain's gas. Either way the record is marked
refunded only on the broadcast's tx hash, and the refund
returns the locked WBTC/tBTC to the depositor — never the
sold stablecoin. `unavailable` is stated plainly with the
timelock fallback's opening time.

**Unilateral timelock refund — wired (2026-11-14).** The
last refund path on the lane is executable: after the EVM
refund locktime, the depositor calls `refund(preimageHash,
amount, token, claimAddress, timelock)` on the swap's own
HTLC (pinned selector `0x36504721`; the reference SDK's own
encoder spells the identical call) with no server
cooperation at all — on the pinned v7 the depositor is the
lock's sender, so the contract takes the refund address from
the caller and returns the locked token to them. A funded
EVM-source record in a refund-available state offers
"Refund my locked tokens (timelock reached)" once its
timelock has passed (before that, collaborative states offer
the collaborative action above — never both as primary).
The executor gates on BOTH conditions: the fresh status is
a refund-available phase (the unilateral state, or a
collaborative state whose refund evidently never completed —
including a record whose earlier collaborative broadcast
never landed, which reaches this path post-timelock) AND
the lock chain's own latest-block timestamp is at/past the
record's refund timelock (the device wall clock never gates
it). Every call term is pinned to the bounds-checked
creation record through the pinned encoder; the amount —
the one term the record cannot supply — is the swap
object's own recorded lock amount (`evm_htlc_locked_amount`,
Satora's read of the HTLC's creation event), cross-checked
against the collaborative params answer when that answer
carries an amount, with the swap object's sender/token
double-sourced the same way. The exact calldata is dry-run
against the HTLC before broadcast (the contract is the
oracle: a wrong amount computes a different lock key and
reverts), then broadcast from the depositor's own wallet,
which pays the funding chain's gas. The record is marked
refunded only on the broadcast's tx hash. No refund path
on the EVM-source lane remains encoder-only.

Composition: Bitcoin is a milestone SOURCE — BTC → USDC on a
Satora chain composes onward to Sui, Tron, Solana and other
EVM chains inside the one-crossing limit, and BTC → Arkade
composes through the hub detour. (Correction history: the
exhaustive any-to-any sweep of 2026-11-14
(research_notes/fluid-any-to-any-matrix-20261114) first found
the Tron onward composition missing — BTC → Tron returned no
route at $1/$10/$50 or on the diagnosis ladder to $250,
though both legs quoted individually. Fixed and live-verified
later on 2026-11-14: BTC → Tron USDT now composes at $10
fee-collecting and at $50 with the fee honestly null. The
Solana onward rests on the EVM → Solana leg, which quoted
nothing all sweep window. Sui, the EVM chains and the Arkade
detour verified composing.) Execution gate: the wallet's
own BTC balance, read fresh at review and again at Confirm;
unreadable is the gate's unreadable verdict, and route
preview at zero balance works like every family.

### Known gaps after the LI.FI removal (2026-11-13)

Named plainly, each with its replacement path — none of these is
silently degraded:

- **Sui same-chain swaps — CLOSED 2026-11-13** by the direct
  Cetus aggregator port. Fluid composes the aggregator's route
  into a locally built PTB (Fluid's own coin construction first,
  then the SDK's swap-context calls) and inspects it before
  signing under a pinned grammar: the aggregator package is
  pinned to the SDK's own Mainnet address, the swap context
  must carry the quote's exact input amount, a floor no lower
  than the reviewed minimum, Fluid's fee rate and the DripBot
  Sui fee receiver, each hop must call the package its quote
  path names, and every output must end with the user. Pyth-
  oracle-based venues are excluded from quotes (their PTBs
  insert price-update calls outside that grammar), as is the
  SDK-inactive SEVENK venue. This also restored the milestone
  composition's final leg into non-USDC Sui tokens (the
  BTCB → … → SUI pair composes again). (Correction history,
  kept honest: the exhaustive any-to-any sweep of 2026-11-14,
  research_notes/fluid-any-to-any-matrix-20261114, found the
  pair forming at NO size — empty at $1/$10/$50 and on the
  diagnosis ladder — because BTCB reaches hub USDC only
  through a same-chain anchor leg of its own, one leg more
  than the Sui branch's three-leg shape budget, so the
  composition died on its first leg. Fixed the same day by
  the composition-fixes build,
  research_notes/fluid-composition-fixes-20261114: the
  search's anchored-inbound phase re-sources the family
  branches' inbound through the origin chain's own stable,
  so the pair forms end-to-end as BTCB → USDC on BSC (Relay)
  → USDC on Base (Mayan) → USDC on Sui (Mayan Fast MCTP) →
  SUI (Cetus) — verified live at $1/$10/$50 on 2026-11-14,
  executable and fee-collecting, its honest summed duration
  (~103 s at $10) disclosed as slow.) Fluid's fee rides the
  aggregator's overlay fee to the DripBot Sui wallet, set by
  the same fee law as every other rail. One honest limit: a
  destination-gas fallback INTO Sui still cannot be built —
  its first leg needs a cross-chain delivery of native SUI,
  which no rail offers (Mayan delivers Sui USDC only); the
  second leg (Sui same-chain) is exactly what this port
  restored.
- **Sui-source cross-chain swaps — CLOSED 2026-11-14** by the
  Mayan Fast MCTP bridge-origin port. Fluid composes the
  bridge-origin PTB locally (its own USDC coin construction,
  then Mayan's prepare → bridge / create-order ticket, then
  Circle CCTP v2's package-auth burn sequence, then Mayan's
  log call) and inspects it before signing under a pinned
  grammar: the Mayan state object, the USDC Currency object
  and every Circle package/state are pinned literals sourced
  from Mayan's published SDK constants and cross-checked on
  chain; the live Fast MCTP package is resolved from the
  pinned state object at execution (Mayan's own resolution)
  and a quote naming a different package is refused as stale;
  the prepare call's destination is pinned to the user's own
  address on the destination chain, its amount floor to the
  full input, and its fee fields to the reviewed quote, with
  Fluid's fee taken through Mayan's referrer mechanism to the
  destination family's collection wallet under the same fee
  law as every other rail. The composed PTB was verified
  argument-for-argument identical to Mayan's own SDK
  composition for the same quotes (bridge and auction forms).
  Served set (live-probed 2026-11-14): USDC out of Sui to
  USDC on Ethereum, Arbitrum, Optimism, Base, Polygon and
  Solana (plain CCTP bridge), and to non-USDC assets on those
  chains where Mayan runs its Fast MCTP auction (Base ETH
  proven). The last sub-case — a non-USDC Sui INPUT (native
  SUI, USDT) — was CLOSED the same day by the server-swap
  port. Mayan quotes those only by first swapping into USDC
  through a server-built PTB (its get-swap/sui endpoint);
  live captures (2026-11-14) show the endpoint answering in
  exactly two grammars — Fluid's own Cetus aggregator for
  USDT inputs, and a wrapper aggregator (pinned router
  package, pinned protocol-fee/treasury objects, three pinned
  venue adapters) for native SUI — and both are now pinned
  Cetus-style. At execution the slice is fetched fresh,
  Fluid's own bridge section is appended to it (fed by the
  slice's declared output coin, the ticket floored at the
  quote's minimum middle amount — a slice producing less
  cannot redeem the ticket and the PTB aborts rather than
  delivering below the reviewed floor), and BOTH halves are
  inspected before signing: the slice admits no foreign
  package, no unknown call, no extra transfer, no aggregator
  fee, and no stated figure outside the quote's band. The
  slice carries no referrer carve-out (verified against a
  fee-bearing capture): Fluid's fee rides the bridge ticket
  exactly as on the USDC lane. What remains refused, named
  plainly: any day the endpoint answers in a shape outside
  the two pinned grammars — an unpinned venue or backend is
  a refusal, never a signature — and USDT inputs whose value
  sits in address-balance form with no coin objects, which
  the endpoint itself cannot build for (it answers NO_COINS;
  the user sees "no route" until a coin object exists).
- **Tron same-chain swaps — CLOSED 2026-11-14** by the direct
  SunSwap V2 port. TRX ↔ TRC20 and TRC20 ↔ TRC20 pairs inside
  Tron ride SunSwap's canonical V2 router
  (TXF1xDbVGdxFGbovmmmXvBGu8ZiE3Lq4mR — pinned as a literal
  and cross-checked on-chain 2026-11-14: its code names it
  UniswapV2Router02, WETH() returns the canonical WTRX,
  factory() the canonical SunSwap factory). Quotes are the
  router's own `getAmountsOut` constant calls over the
  candidate paths (direct, via WTRX, via USDT — best output
  wins), so every quoted number is reproducible on-chain;
  execution composes the swap locally and bounds-checks the
  decoded call before signing (pinned router, pair + amounts
  matching the quote, recipient = the user's own address, no
  extra calls) — the Relay-Tron discipline throughout.
  SunSwap has no integrator-fee parameter, so Fluid's fee is
  taken as an output-side skim to the DripBot Tron wallet
  inside the same flow, sized by the fee law and disclosed on
  the route; the skim is measured off what actually arrived
  (the receipt's own amounts, else the balance delta), and a
  failed skim never fails the swap. Tron energy is priced
  honestly: the quote carries the unstaked burn estimate
  (~150k energy per hop at the chain's live energy price plus
  bandwidth), never a network-feeless claim. Honest limits:
  V2 pools only — a pair with no V2 pool (or only a V3 pool)
  answers "no route"; TRX → WTRX is a wrap, not a swap, and
  stays out of the gate. (Report:
  research_notes/fluid-sunswap-port-20261114/report.md.)
- **EVM long-tail tokens outside Relay's catalog** (e.g. some
  Ethereum-mainnet memecoins Relay answers
  INVALID_INPUT_CURRENCY for). Replacement path: the KyberSwap
  aggregator API (keyless). Probed again 2026-11-13 during the
  Cetus port: its routes API now answers from the build
  machine's network and quotes the refused pairs (PEPE → USDC
  quoted live), and its fee parameters are accepted — a 50 bps
  fee charged on the output to Fluid's collection wallet came
  back in the quote's fee block, so fee capture under the fee
  law is viable. But its transaction-building endpoint — the
  half that produces the signable call — never answered
  (three attempts up to 110 s, zero bytes, two pairs), while
  the routes endpoint answers in ~2 s. An executor whose
  calldata shape has never been seen cannot be put behind
  inspect-before-sign honestly, so KyberSwap is NOT wired; it
  lands when the build endpoint can be probed and its
  responses pinned like every other rail's.
- **Chain discovery** no longer has the aggregator's chain list as
  a third source: admission is registry + TVL only. One visible
  consequence: HyperEVM (chain 999) drops out of discovery,
  because the registry's entry for that reused id is stale and no
  trustworthy source remains to correct it.

Per-pair reality for the Sui lanes (live-probed 2026-11-13):

- **Relay has no Sui chain at all** (58 chains listed, none is Sui) —
  no Relay quote can ever enter or leave Sui.
- **Mayan serves Sui only as a Fast MCTP destination for USDC** from
  CCTP-domain chains (Base proven live 2026-11-11). From BNB Chain
  Mayan answers "Route not found" for every token (BNB, WBNB, USDC,
  USDT) at every size probed ($0.22–$50): BSC has no CCTP domain, and
  Mayan Swift does not connect BSC → Sui.
- **Sui same-chain swaps ride the direct Cetus aggregator port
  (2026-11-13)** — live-probed the same day: USDC → SUI,
  SUI → USDC and USDT → SUI all quote and compose locally, and
  the BTCB → … → SUI milestone composition forms end-to-end
  (Relay + Mayan + Mayan + Cetus legs, through the anchored
  inbound — found broken by the 2026-11-14 sweep and
  restored the same day by the composition-fixes build; see
  the Cetus section's correction history).
  Swapping OUT of Sui
  rides the Mayan Fast MCTP bridge-origin port (2026-11-14)
  for USDC (see "Known gaps"): live-probed the same day —
  USDC out of Sui quoted and composed to Base, Ethereum,
  Arbitrum, Optimism, Polygon and Solana, fee-collecting
  under the fee law (26 bps measured on the Base lane at
  $10, the 50 bps cap on the Base ETH auction lane), with
  Mayan's own minimum surfacing honestly on the Ethereum
  lane below ~$1.30.

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
boundaries: until 2026-11-14 nothing composed FROM Bitcoin or
Lightning (no signable source leg existed); since the
Lightning-source build and Part B (Bitcoin as a source,
above) both families compose OUT through their Satora hub
legs inside the one-crossing limit, and the remaining
boundary is a chain Fluid does not support at all (Robinhood
Chain, as of this writing) cannot be a composition endpoint —
support for a chain is its own work, never invented here. Bitcoin/Lightning/Arkade destinations
compose through USDC on a Satora source chain (Arbitrum first):
any asset → USDC on Arbitrum → Satora to BTC/Lightning/Arkade,
inheriting Satora's floors (10,000 sats to mainnet — below
which Lightning is the small-size destination — 356 sats to
Lightning, and 335 sats to Arkade) and its version gate (Fluid
refuses Satora
routes while the live API's version line differs from the
audited spec; that gate, not routing, is what stands between
a composed BNB → BTC and execution whenever it is closed —
it closed on 2026-11-13 when Satora moved to backend-v0.3.26
and re-opened the same day after the re-verification and
re-pin recorded in the Satora bullet above).

**Addressing — the address-book lift (2026-11-14).** A
composition's intermediate chain must settle to the user's own
address on that chain. Originally `milestoneAddressFor` could
only derive that address from the swap's own endpoints, so any
composition whose source AND destination were both non-EVM
died on addressing before a single leg was quoted — Solana /
Tron / Sui sources could not compose through an EVM milestone
into Sui, Bitcoin or Lightning, even though every leg
individually quoted and executed. The lift: the swap sheet
supplies an **address book** (`args.addresses`) — every
family's address derived from the user's own seed (the same
values the sheet's own address resolution uses, plus the
wallet's Taproot address, plus the Arkade session's address
when that session has booted) — threaded through
`getSwapRoutes` into the composition search, and
`milestoneAddressFor` consults it for intermediate chains.
Endpoints still resolve from the swap's own arguments first:
the book never overrides the destination the user chose (which
may be an external address or a pasted Lightning input), a
malformed book entry is refused against its family's address
shape, and with no book supplied the resolution is exactly the
old endpoint behaviour. What now composes, live-probed
quote-only on 2026-11-14 through the real search: Solana USDC
→ SUI (Mayan → Mayan → Cetus through an Arbitrum milestone,
executable, fee-collecting, 88 s estimated), Tron TRX →
Bitcoin and Sui USDC → Bitcoin (through Arbitrum USDC into
the Satora leg), and Tron TRX → Lightning — each returning
nothing at all without the book. **Two-crossing routes
compose since 2026-11-14** (the §7.5 planner build): when no
one-crossing composition exists at all, the search prices a
second phase of shapes through one intermediate hub — the
EVM CCTP chains in milestone preference order (Base first;
Solana is never a waypoint, as no rail crosses out of it
toward Tron or Sui) — at most four legs, exactly two of them
crossings, every intermediate settling to the user's own
address from the book, every leg held to the same
executability gate, priced through a memoising quoter under
a hard cap of 30 leg quotes per search so the hub × anchor
grid can never grind. Either end may anchor on the chain's
OTHER liquid stable (USDT) when the hub asset itself does
not cross: Relay serves USDT on Tron both ways but answers
NO_SWAP_ROUTES_FOUND for USDC on Tron in both directions
(probe-verified 2026-11-14), so Tron pairs anchor on USDT
and Tron's own SunSwap leg finishes into USDC. Live-probed
quote-only on 2026-11-14 through the real search: Sui USDC →
Tron USDT and Sui USDC → Tron USDC both compose through Base
(Mayan → Relay → SunSwap, executable), Solana USDC → Tron
USDT and Solana USDC → Tron USDC compose the same way (the
USDC finish estimated at 98 s, so it carries the slow
disclosure — a two-crossing route wears a fast badge only
when its honest summed duration earns one). What remains
frontier is narrower and rail-shaped, not planner-shaped:
**Tron → Solana** still does not compose, because the final
hub → Solana leg itself quotes nothing in either rail today
(Relay and Mayan both returned no EVM → Solana routes in the
2026-11-14 probe window while Solana → EVM quoted instantly)
— every Tron-side and hub-side leg on that path quotes, and
the shape is pinned ready in tests for when the leg serves;
pairs needing THREE crossings stay uncomposed by design; and
the branch-grammar families keep their own one-crossing
shapes (Bitcoin / Lightning / Arkade sources and Sui
destinations are not extended by the two-crossing phase),
with Arkade-source legs riding the milestone executor only
as cheapest-entry intermediates (below), driven through the
app-injected VHTLC funding send — the two-crossing phase
itself still does not extend those grammars.

### Worked example, live-priced 2026-11-13: BNB (BNB Chain) → SUI (Sui)

No rail quotes this pair directly (see "Per-pair reality" above).
The composition that works: **BNB → USDC on Base → USDC on Sui →
SUI**, where Base is the milestone — it holds a CCTP domain, which
is what unlocks Mayan's Fast MCTP into Sui.

| Leg | Rail | Live evidence |
|---|---|---|
| BNB → USDC on Base | Relay / Mayan Swift | Relay quotes at every size probed, down to the failing 0.00035 BNB → $0.2025 out. Mayan Swift is cheaper where it quotes (0.0032 BNB → $2.0457; 0.016 → $10.2429; 0.08 → $51.2529) but refuses below ~0.00156 BNB (≈$1.00): "Amount too small". |
| USDC on Base → USDC on Sui | Mayan Fast MCTP | Quotes at every size probed ($0.22 → 0.159268 USDC out; $2 → 1.938479; $10 → 9.934935; $50 → 49.917215, each with the gas drop below). The flat shortfall is ≈$0.061–0.083 — the redeem relayer fee — so the percentage cost collapses as size grows. |
| USDC → SUI on Sui | Cetus — **direct aggregator port (2026-11-13)** | The leg rides Fluid's own Cetus aggregator integration: the SDK composes the route client-side, Fluid builds and inspects the PTB locally before signing (pinned aggregator package, quote-bound amounts, fee to the DripBot Sui wallet), settling to the user's own Sui address in the same atomic transaction. Pool fee ≈0.05–0.25% at these sizes (estimate), gas ≈0.01 SUI. |

**The first-time-Sui gas problem is solved inside the composition:**
Mayan Fast MCTP carries a native **gas drop** — up to 0.1 SUI
delivered alongside the USDC (0.05 SUI drop quoted at every size
above; 0.025 SUI executed live on 2026-11-11). A zero-SUI account
lands USDC *and* the SUI to pay for its first moves on Sui. No rail
outside this composition offers
the drop: Relay has no Sui chain.

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
   leg's own mechanism (Relay App Fees, Mayan referrer, and each
   rail's own) and disclosed as the sum — there is no extra
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
   Mayan's 0.06 SUI drop at the sizes below). A transport failure (a
   rate limit, a network drop) is never composed over: it
   propagates as itself.
   Live composed quotes for the worked example, from the
   shipped search on 2026-11-13 (quote-time measurements, not
   guarantees; at that time the final on-Sui leg was
   estimate-previewed at the recorded 0.25% pool-fee estimate
   until the gas drop landed, then re-quoted fresh for
   execution — the estimate preview was removed with the
   aggregator on 2026-11-13, and a final leg must now genuinely
   quote for a composition to form):
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

## Cheapest entry — the cheapest door into a family (2026-11-14)

Ethuram's rule, extending the composability law: for every
destination, prefer the cheapest viable **door** into its
family, then move internally — ranked on true all-in cost
with floors counted, never on the direct pair alone. The
Bitcoin family's doors, with their real entry costs:

| Door | Floor | Entry truth |
|---|---|---|
| Arkade | 335 sats | The family's cheapest entry. From Arkade the user can continue to Lightning (a Satora pair) or exit to Bitcoin mainnet (the operator offboard, below). |
| Lightning | 356 sats | Plus, for a wallet with **no Lightning channel yet**, the one-time **2,500 sats** first-receive channel opening (Megalith LSP). That cost is counted in ranking only when the sheet's own node reports no channel — a wallet-state input, stated on the route card when counted, never charged to a returning user and never guessed when the node state is unknown. The payout amount itself is never reduced by it; only the ranking value is. |
| Bitcoin mainnet | 10,000 sats composed / 20,000 direct | The expensive door. Below it, the direct door is shut — but the Arkade door is not. |

What this changes in the planner and the search:

- **Arkade is a milestone intermediate.** Compositions may
  now pass THROUGH Arkade: *source → (hub) → Arkade →
  Lightning* and *source → (hub) → Arkade → Bitcoin*. Every
  leg still settles to the user's own addresses under the one
  upfront confirmation. A Bitcoin-family search returns EVERY
  completed door composition (no duration race — the family's
  legs are all slow by construction, so the cheapest door is
  judged on net received), and the dispatcher's direct Satora
  answer is merged with the via-Arkade compositions and
  ranked on the same net-USD merit. Via-Arkade wins when it
  wins; the direct door wins when it wins. No thumb on the
  scale beyond the stated costs.
- **Below the direct floor, the refusal waits.** A sub-10,000-
  sat Bitcoin swap whose direct door refuses on the floor now
  runs the composition search before the refusal is allowed
  to stand: a via-Arkade composition (335-sat door) answers
  instead. The floor error — and the sheet's Lightning
  way-through built on it — stands only when nothing
  composes.
- **Arkade → Bitcoin mainnet is NOT a Satora pair.** The leg
  is the Arkade operator's **offboard** — the same exit the
  Bitcoin bridge tab uses (`session.offboard`), quoted from
  the operator's public info endpoint and judged by the
  strict fee-program parser: 200 sats flat per on-chain
  output plus up to 0.2% on a soon-expiring VTXO input,
  quoted worst-case, and refused outright when the program
  is one Fluid doesn't recognise (never a guessed fee) or
  when the output would sit at/below the operator's dust
  (330 sats). Settlement truth: the exit lands with the
  operator's next batch — the leg carries an honest
  half-hour-class estimate, never a fast badge. Fluid
  collects **no fee inside an offboard** (there is no
  collection mechanism in an operator exit; the leg discloses
  `platformFeeCollecting: false` rather than pretend).
- **A via-Lightning composition is deliberately NOT built.**
  An intermediate Lightning leg settles by paying an invoice,
  and minting one against the user's own node is a
  sheet-level, user-present step (the receivability / JIT
  channel gate), not something the milestone executor can do
  inside a composition. Lightning remains a door as a direct
  pair and as a way-through the sheet offers; the planner
  does not pretend to route through it. (His example —
  BTC → Arkade → destination — is exactly the shape that IS
  built, in the source → Arkade direction the planner can
  sign.)
- **Preview without booting.** Search never boots the Arkade
  session (the route-preview rule: discovery runs with zero
  balance and zero side effects). When the address book has
  no Arkade entry yet, an intermediate Arkade leg previews
  against a deferred session marker — the quote layer never
  reads a leg's destination input, so the preview is exact —
  and execution re-resolves the marker to the booted
  session's address before anything is created (a creation
  naming the marker is impossible: the runner patches the
  leg's route destination from the re-resolved address). If
  the session still isn't loaded at execution, the record
  parks leg-due with the reason in plain language — the
  user's funds sit in their own wallet on the previous leg's
  chain — and "Complete the swap" resumes it. A FINAL Arkade
  leg never takes the marker: Arkade as the destination uses
  the user's chosen endpoint address, as before.
- **The intermediate leg's credit is a claim, not a balance.**
  A leg INTO Arkade settles into a VHTLC; the milestone
  runner completes it in-flow through the same claim the
  swap sheet's Satora list offers (funded state read from
  the indexer, payout claimed into the user's own Arkade
  wallet), and the CLAIMED amount — the claim's own return,
  never the quote's expectation — becomes the next leg's
  input. The background advancer carries the same claim, so
  a swap closed mid-flight still stages its next leg on its
  own. Arkade's layer-2 framing (the ALWAYS-WARN copy) shows
  on any composition touching Arkade, endpoints or
  intermediate alike, and composed durations are summed and
  slow-disclosed by the standing standard.
- **Other families** enumerate their doors from the legs that
  already quote rather than a hard-coded answer — the same
  planner behaviour that found Tron anchoring on USDT in the
  two-crossing build. No new rails, no new providers: the
  doors are the existing leg set, re-ranked honestly.
