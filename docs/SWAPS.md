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

Above merit sits **executability** (2026-11-14, matrix-sweep Family
A): a route Fluid cannot sign — judged by the same structural gate
every executor re-runs — never outranks one it can, and the
cheapest/fastest flags are assigned among executable routes only.
A non-executable route still returns from the search, annotated
with the gate's reason; it is listed for discovery, never badged
as the best takeable route. (The sweep caught a non-executable
destination-gas composite wearing the cheapest flag over an
executable Relay route on $10 swaps into Tron.)

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

**The all-to-native contract (resolved 2026-11-14).** Mechanism 2's
composite is an ordinary executable route, gated by the same
`swapRouteExecutable` as every other route: the sheet offers it —
tappable, badgable, ranked in the executable tier — exactly when
the composite is complete (a live gas plan for the destination,
the destination address, the target token, the reserve) and its
first leg is itself signable by a rail the executor can dispatch
(Relay, Across, Mayan, Jupiter, Cetus, SunSwap). Execution is one
confirmation: leg 1 broadcasts through that rail's own executor
(its bounds checks re-run before signing) and lands the native
token at your own address; a durable record persists at that
moment; leg 2 is then re-quoted fresh from what actually arrived
— never from the preview — and runs immediately, or, if the
credit outlasts the in-flow wait or leg 2 cannot complete, waits
as a one-tap "Complete the swap" in the sheet while you hold the
native token. Nothing in the path takes custody. One honest
limit, unchanged: no composite is built at all where leg 1 has
no rail (a Sui destination today — no rail delivers native SUI
cross-chain), and there the plain warning above is the answer.
History, kept straight: from the feature's first release
(2026-11-11) until 2026-11-14 the gate had no branch for this
composite at all, so its rows rendered disabled and the executor
was unreachable from the route list even though the machinery
was complete; the resolution and its evidence are in
`research_notes/fluid-gasfallback-resolution-20261114/`.

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
- Polkadot Asset Hub is a swap destination since 2026-11-14
  (Chainflip, next-but-one section): BSC USDT or BNB in, DOT
  out at your own Asset Hub address, composable from any
  origin that can reach a BSC anchor. DOT as a source is
  quoted but not yet executable — the section says why.
- Arkade is a swap endpoint in its own right (2026-11-14) — see
  the next section.
- Some source chains cannot be quoted from every network environment;
  when that happens the sheet shows an honest refusal, not a fake zero.

## Polkadot as a swap destination (2026-11-14)

DOT on Asset Hub joins the swap universe through Chainflip.
Fluid already held, sent and received DOT; what was missing
was the rail, and Chainflip's vault swap is it: your own BSC
wallet makes ONE call to the Chainflip vault with USDT or
BNB, and native DOT lands at your own Asset Hub address.
There is no deposit channel and no operator address in the
path. Before anything is signed, Fluid re-encodes the
deposit and verifies every field against the quote — the
vault address, the token, the amount, the value, the
destination bytes (your own account, decoded from your
address), and the fill-or-kill terms, which must match an
independently encoded copy byte-for-byte. A mismatch
refuses before funding.

- **Floors are Chainflip's, named as Chainflip's.** The
  smallest swap into DOT is 10 USDT or 0.02 BNB — the
  protocol's own per-pair minimums, refused by its quote
  API below them. A smaller amount is refused with the
  floor named before you commit; nothing is ever sent
  under it.
- **Speed is disclosed, never dressed up.** The leg takes
  ~110 seconds end to end (deposit ~7s, swap ~12s, egress
  ~91s), so neither the direct route nor any composition
  through it is ever badged fast — a composed BTCB → USDT →
  DOT route quotes ~141 seconds and says so.
- **Failure posture.** The swap is fill-or-kill: if it
  cannot fill at or above the quote's minimum price inside
  the retry window (~5 minutes), the deposit refunds
  automatically to your own BSC address — the refund
  address is part of the verified terms, and the executor
  refuses any route whose refund address is not yours.
  A wrong-asset or wrong-destination deposit cannot be
  produced by the executor: those are calldata fields it
  verifies, not free text.
- **Fee capture.** Chainflip pays broker commission in
  bps, itemised as a BROKER fee in the quote and taken out
  of the output; Fluid's fee law applies under the Polkadot
  ceiling ($0.30 total route cost). Collecting needs
  Fluid's registered Chainflip broker account — an operator
  setup item that is not live yet — so until it lands,
  Chainflip routes quote with the fee at exactly zero and
  the card's collecting flag says so. When the account is
  registered, a fee-bearing quote must reconcile with the
  fee-free one (commission itemised, output reduced by
  about the commission) or no route is shown.
- **DOT as a source is quoting only, for now.** Chainflip
  serves DOT → BSC quotes, but a DOT deposit can only be
  made through a deposit channel opened by a broker, and
  the commission that carries Fluid's fee can only ride a
  channel Fluid's own broker opened. Shipping the direction
  without capture would break the rule that a surface that
  cannot return Fluid's fees does not ship — so DOT-out
  routes display their quote with the reason named and are
  not tappable, until the broker is live. Bitcoin and
  Lightning origins likewise do not compose into DOT yet:
  no rail in the planner carries their value into a BSC
  anchor.
- **Size limit, honestly.** At very large sizes (seen at
  $66,000) Chainflip's quote API offers only a DCA product
  instead of a regular swap. Fluid never substitutes it —
  an outsized search returns no route rather than a
  different product wearing the route's clothes.

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
  consequence at the time: HyperEVM (chain 999) dropped out of
  discovery, because the registry's entry for that reused id is
  stale. It is a hand-verified built-in since audit gap #6
  (2026-11-15) — see the HyperEVM section below; the registry and
  TVL data for the id remain poisoned, so discovery still cannot
  admit it and the built-in is the only door.

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
boundary is a chain Fluid does not support at all cannot be
a composition endpoint — support for a chain is its own
work, never invented here. (Robinhood Chain stood here as
the example until 2026-11-15; it is a built-in since the
gap-#7 build — see the Robinhood Chain section below.) Bitcoin/Lightning/Arkade destinations
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

## Cosmos via Skip — slice 1 (2026-11-15)

Six Cosmos chains join the swap universe as sources AND
destinations through Skip's keyless API (api.skip.build):
Cosmos Hub, Osmosis, Noble, Celestia, Injective (its Cosmos
side) and dYdX. Every route is ONE user signature — Skip
returns the exact messages and Fluid signs them as-is
through the wallet's own signers (CosmJS for the standard
chains; the hand-rolled Injective signer, extended to
generic Any messages with MsgTransfer first).

- **Route shapes.** Cosmos-to-Cosmos is one signed
  transaction: a hook-memo IBC transfer (the swap happens in
  the Osmosis entry-point contract on arrival), an Osmosis
  MsgExecuteContract for Osmosis-intra swaps, or a plain
  transfer when no swap is needed. Multi-hop routes (dYdX to
  Noble crosses Persistence) derive every intermediate
  address from the user's own account bytes — the same
  account on every chain — so no hop ever custodies funds.
  Noble is the CCTP door: USDC on Noble exits to any
  supported EVM chain's USDC in one Noble transaction (the
  hand-encoded MsgDepositForBurnWithCaller plus the relay's
  fee payment), with the mint recipient always the user's
  own EVM address. Any other Cosmos source to EVM USDC
  composes through the milestone planner: source to
  USDC@Noble, then the CCTP leg — each leg settling to the
  user's own address under the standing staged-swap rules.
- **Capture, echo-verified.** Skip's affiliate split favours
  Skip 75/25 (measured at three fee levels), so the client
  requests ~4/3 of the 50 bps law target (66 bps) to net 50.
  Before anything is signed, the returned memo is verified
  field by field — the affiliate total, Fluid's share and
  recipient, Skip's share, and the slippage floor
  (min_asset) — and ANY mismatch refuses the route outright,
  the same discipline as the NEAR Intents rail. When no
  affiliate address is configured the rail quotes fee-free
  and the route card says so (collecting=false).
- **Osmosis SQS is a price check, never a path.** SQS
  silently ignores affiliate parameters, so it can never
  carry Fluid's fee; Osmosis-intra routes execute through
  Skip's messages and are only cross-checked against SQS —
  a Skip quote more than 10% worse than SQS is refused.
- **The CCTP relay fee is disclosed per quote.** Skip's
  smart relay charges a fee paid from the Noble transaction
  itself (about 5.3% of a $10 exit, shrinking with size).
  The exact fee from the live quote is printed on the route
  card and in the confirmation text before signing — never
  buried, never estimated. The burn is verified before
  signing: mint recipient, destination domain, fee recipient
  and fee amount must all match the quote.
- **Timeouts end as refunds, in plain language.** Every
  Skip leg carries its IBC timeout. A leg that passes its
  timeout with the funds visibly back on the source chain
  (or an errored tracking status) closes as **timed-out**:
  IBC timeout refunds are protocol-native to the sender's
  own address — the Cosmos analogue of the NEAR rail's
  REFUNDED state — and the Activity line names the timeout
  and the automatic refund instead of a generic failure.
- **Honest edges.** EVM-to-Cosmos via Skip is NOT wired:
  the keyless API would not quote Base USDC from this
  network ("Source token not found"), so those pairs keep
  the routes they already had and make no new claim. Kujira
  is not added (a legacy THORChain remnant). Sei does not
  join this rail: its Cosmos network is retired (see the
  gap-#5 section below) — SEI swaps live on Sei EVM via
  OpenOcean. Funded settlement on this rail is unproven
  until the first funded drill, like every rail before it.

## Cardano — presence + 1Click ADA (2026-11-15)

Cardano joins Fluid whole: the family itself (derive, hold,
receive, send) and ADA as the seventh 1Click family, swappable
in both directions. The implementation is hand-rolled from
primitives the bundle already carries — CIP-1852 derivation
(Icarus root + Khovratovich CKD + extended-key Ed25519
signing), a minimal CBOR encoder and a min-UTxO-aware payment
builder — verified byte-for-byte against
cardano-serialization-lib during the probe (addresses,
signatures, the official CIP-0003 vector). CSL/Mesh WASM was
rejected on measured bundle weight (+~2.75 MB, +43%).

- **Reads** are keyless Koios GETs (tip, epoch params, the
  address_utxos array-literal GET form); a failed read shows
  "couldn't load", never a fake zero. Native-token balances
  display from the UTxO asset lists; token sends are not in
  this slice, and neither are delegation/rewards.
  **Read-path repair (2026-11-15):** Koios's GET responses
  carry no `Access-Control-Allow-Origin` header on any host,
  so browsers could never read them — the family showed
  "couldn't load" for every real user while curl probes
  passed (the live walk caught it; no other keyless
  CORS-clean Cardano read source exists). Reads now rotate:
  first Fluid's own read-only CORS bridge — a minimal
  Cloudflare Worker (`tools/koios-proxy/worker.js`,
  infrastructure that forwards exactly these three GET
  paths to Koios and returns the bodies verbatim with CORS
  headers attached) — then the direct Koios hosts, which
  answer the day Koios fixes its headers. Every base
  failing still throws: "couldn't load", never a fake zero.
- **The rail** is 1Click, unmodified: the same two-pass fee
  flow and echo verification as the six families before it.
  Capture was probed live for ADA in both directions — the
  fee-50 echo is the shipped transform (Fluid 25 / 1Click
  25). The floor is 1Click's own 1.2 ADA out, read from its
  refusal and named before the user commits. Cardano pairs
  are slow-class by construction (the deposit must confirm
  on Cardano before the solver leg starts), so their cards
  floor at five minutes and never wear the fast badge.
- **Broadcast is the one unverified link.** Koios POST —
  including /submittx — never answered from the build
  environment (45–240 s windows, while its GETs answer in
  seconds and POSTs to other hosts work). Submit is built to
  Koios's published spec (raw CBOR, application/cbor) with a
  Blockfrost project-ID config seam as the fallback path;
  the first funded Cardano send is its proof — the same
  status every rail's funded settlement carries until its
  first drill. Transaction construction and signing carry no
  such caveat: they are byte-pinned against the CSL-verified
  fixtures in the suite.
- **Intra-Cardano DEX is deferred, plainly.** SteelSwap has
  the right shape (keyless build, unsigned tx CBOR, a
  first-class partner fee field) but its capture is
  UNVERIFIED — its POSTs stall from this environment and no
  partner id is registered. DexHunter was unreachable and
  MinSwap's aggregator shows no partner surface; neither is
  planned against until it can be probed.

## Sei EVM + Injective EVM via OpenOcean — audit gap #5 (2026-11-15)

Both chains join as built-in EVM networks (`seievm` 1329,
`injectiveevm` 1776 — fresh keys, because the plain keys are
the Cosmos families'), with pinned Circle-native USDC on both,
USDT0 as Sei's USDT and the Peggy USDT on Injective, and
three-endpoint RPC rotation probed in-page from the production
origin. No cross-chain rail Fluid uses quotes either chain
(Relay, Across, 1Click, Mayan, Squid and KyberSwap all probed
NONE), so their pairs stay honestly unserved beyond composition
through other legs; CCTP is a plausible future door into their
native USDC and is unprobed, not claimed.

- **OpenOcean is the intra-chain rail** (DragonSwap on Sei,
  Pumex on Injective, behind the aggregator). Its `/swap`
  endpoint returns the executable build itself; Fluid quotes
  from builds, bounds-checks the build before signing (the
  exchange contract is pinned per chain — both chains quoted
  `0x6352a56caadC4F1E25CD6c75970Fa768A3304e64` in every probe —
  the exact value, and this wallet as the build's account),
  takes its own exact-amount approval, simulates, then signs.
  Native legs quote through the zero-address sentinel, which
  `/swap` accepts on both chains (the build carries the amount
  as its value and OpenOcean wraps internally).
- **The fee: proven charge, unproven net.** The `referrerFee`
  dial takes a percentage out of the trade's output inside the
  built transaction, paid to the DripBot EVM collection
  address. A/B probes at sane sizes (zero drift) proved the
  CHARGE: on Sei the output falls by exactly the dial (0.620%
  at a 0.625 dial; 0.99998% at 1.0). On Injective the echo is
  per-route: WINJ→USDT echoes the full dial (0.99879% at 1.0)
  while the WINJ↔USDC routes echo only a fraction (0.196% /
  0.477% at 1.0), because the fee rides only part of a split
  route. So every quote is echo-verified per route: the fee
  build ships only when its measured output delta matches the
  dial (grossed up for OpenOcean's documented 20% share —
  dial = law target / 0.8); otherwise the fee-free build ships
  with the route stating it does not collect. What Fluid NETS
  is documented-not-settled: OpenOcean's docs say they keep
  20% of the referrer fee, but no funded settlement has
  reached the collection address yet, so the net share carries
  the same unproven status as any rail's funded proof. The
  fee disclosed on the confirmation is the measured gross
  delta — what actually leaves the user's trade.
- **Injective is one account.** Its Cosmos and EVM faces share
  one unified balance (proven two-sided: a bank `inj` wei read
  identically over EVM, and the native USDC's bank
  `erc20:<contract>` balance exactly equal to its ERC-20
  balance). A Skip leg landing INJ or USDC on Injective has
  already landed it on Injective EVM — no bridge, no wait, no
  second fee. The wallet presents the two faces as one account:
  INJ is counted once in totals, and there is no
  transfer-between-them UI because there is nothing to
  transfer.
- **Sei's Cosmos form is labelled legacy** (home row, chain
  sheet, receive picker and panel): the network is retired —
  SIP-3 closed IBC in 2026 — and SEI trades on Sei EVM. A
  MsgSend simulation against pacific-1 still executes the
  chain's bank path (probed 2026-11-15; it failed only on the
  test account's funds), so sends stay enabled under the
  legacy label rather than being silently removed.
- **Unverified, named:** a funded OpenOcean settlement (and
  with it the net fee share landing), USDT0's depth against
  Sei's legacy bridged USDT, and the direct venue APIs
  (DragonSwap / Sailor / Symphony / Pumex) — proven as
  OpenOcean's venues only.

## HyperEVM (999) — audit gap #6 (2026-11-15)

Chain 999 joins as a hand-verified built-in (`hyperevm`), because
discovery cannot admit it: the chainid.network registry still
lists the reused id as "Wanchain Testnet" and DefiLlama's
Hyperliquid L1 row carries no chainId, so the admission gate —
correctly — refuses the id on poisoned data. The gate was not
loosened; the chain was verified by hand instead (research:
`research_notes/fluid-hyperevm-20261115/probe-notes.md`, all
probes in-page from the production origin). HYPE is the native,
priced through CoinGecko (its only configured source — no
Binance pair is wired, so agent spend caps on HYPE fail closed
until a second source exists). Pinned tokens: Circle-native
USDC and USD₮0 (Tether's LayerZero OFT form, the same shape as
Sei's USDT0 pin — not a Tether-native deployment). RPC rotation
carries three endpoints with the official RPC first; it stalls
from some egresses, and rotation falls through on timeout.
HyperEVM is the EVM environment only — HyperCore (the L1 order
book) is a different environment and is never wired as this
chain.

- **Relay is the primary rail, collecting in every direction.**
  HYPE out, USDC in and USDC out all quoted with the 50 bps App
  Fee echoed in full on build day; Relay's own chains table
  gives 999's depository as Fluid's already-pinned canonical
  depository constant (code proven on-chain there), so the
  security build's deposit pinning and bounds-check cover
  HyperEVM with no new constants — pinned in the test suite
  against regression.
- **Across is wired as the second rail on the USDC pair,
  collecting both directions.** The build-day probe (in-page
  from the production origin, Fluid's own two-pass quote shape)
  echoed the app fee on real quotes — 99,965 raw out and 99,979
  raw in on $20 — and the quotes parse collecting and pass the
  deposit bounds check. The handler, message adapter and
  SpokePool pins for 999 were read off those same live quotes,
  and fee-free control quotes pin the echo check as non-vacuous.
- **Relay intra-chain quotes collect at quote level, but their
  execution is refused by the depository pinning** — Relay
  builds same-chain swaps as a router call, not a depository
  deposit, and that step grammar is unpinned product-wide: a
  Base → Base quote refuses identically. HyperEVM is in exactly
  the fleet's position; intra execution waits on a pinned
  router-step grammar, not on anything 999-specific.
- **Not wired:** 1Click (its chain list carries "hypercore" —
  the L1, not this chain) and Mayan (destination-only for 999
  today; a possible future redundancy for USDC-in, not built).
- **Unverified, named:** any funded 999 settlement (the first
  funded deposit is the end-to-end proof, gated on Muse
  earnings), HYPE pricing depth beyond CoinGecko, and USD₮0
  liquidity at size.

## Robinhood Chain (4663) — audit gap #7 (2026-11-15)

Chain 4663 joins as a hand-verified built-in (`robinhood`) —
as canonicalisation, not an admission repair. Robinhood
Chain (an Arbitrum-Orbit L2) launched its public mainnet on
2026-07-01 — its testnet is a different id, 46630 — and
discovery already admitted it on clean registry data; the
line above that named it "a chain Fluid does not support at
all" dated from before that mainnet and was simply stale.
What discovery could not give it: a token list (no CoinGecko
slug was wired, so no scan or metadata), an RPC rotation
(the discovered entry rides the single official endpoint,
which Robinhood's own ecosystem docs note is rate-limited),
and its stable — the stable-token lookup hunted USDC/USDT
symbols, and neither exists on this chain. Verified by hand
instead (research:
`research_notes/fluid-robinhood-chain-20261115/probe-notes.md`,
all probes in-page from the production origin). ETH is the
native, priced through the existing ETH wiring (CoinGecko
with the Coinbase cross-check). RPC rotation carries three
endpoints with the official RPC first.

- **The chain's stable is USDG — and USDC/USDT do not exist
  here.** USDG (Paxos Global Dollar, contract
  `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 dp) is
  verified against Robinhood's own contracts page, Paxos's
  docs, Relay's catalogue, CoinGecko's list and on-chain
  reads; it is an upgradeable proxy, the same trust class as
  USDC. Circle issues no USDC on 4663 and there is no
  Tether deployment, so any "USDC" a user meets on this
  chain is an impostor token — Robinhood's docs warn about
  exactly this. Fluid pins none, and the stable lookup can
  never synthesise one: for a built-in chain a USDC/USDT
  list entry survives only when a hand-verified pin names
  the same address, and a pin carrying the fleet's
  `stable: true` marker (USDG) surfaces on the pin's own
  authority — both pinned in the test suite, the guard
  against a poisoned list fixture.
- **Relay is the primary rail, collecting in every
  direction.** ETH out, USDG out, USDC in to USDG, and
  intra ETH → USDG all quoted with the 50 bps App Fee
  echoed in full on build day; Relay settles on 4663 in
  exactly its two solver currencies, ETH and USDG. Relay's
  own chains table gives 4663's depository as Fluid's
  already-pinned canonical depository constant (code proven
  on-chain there), so the security build's deposit pinning
  and bounds-check cover Robinhood Chain with no new
  constants — pinned in the test suite against regression.
- **Across is wired as the second rail on the WETH pair,
  collecting both directions.** The build-day probe
  (in-page from the production origin, Fluid's own two-pass
  quote shape) echoed the app fee on real quotes —
  49,717,673,510,382 raw out and 49,966,442,301,006 raw in
  on 0.01 ETH — and the quotes parse collecting and pass
  the deposit bounds check. The handler (a chain-specific
  contract, not the common handler), message adapter and
  SpokePool pins for 4663 were read off those same live
  quotes. One caveat, and it is fleet-wide rather than
  4663's: Across's native-output grammar routes even a
  fee-free delivery through the handler (an unwrap
  message), which Fluid's fee-free bounds branch refuses —
  so the two-pass flow's first pass cannot price a WETH
  pair today and the dispatcher falls back to Relay. The
  identical control probe against the long-wired
  Ethereum → Base WETH lane on build day returned the same
  shape and the same refusal, so 4663's WETH lane stands
  exactly where every wired chain's WETH lane stands; the
  stable lanes (USDC/USDT, whose fee-free deposits are
  plain) are unaffected. USDG is not an Across hub asset
  in Fluid's grammar (the same hub asset must pin on both
  sides), so USDG pairs stay Relay's.
- **Relay intra-chain quotes collect at quote level, but
  their execution is refused by the depository pinning** —
  Relay builds same-chain swaps as a router call, not a
  depository deposit, and that step grammar is unpinned
  product-wide: a Base → Base quote refuses identically.
  Robinhood Chain is in exactly the fleet's position.
- **Not wired:** 1Click (no Robinhood entries in its token
  list) and Mayan (both directions refused with Fluid's
  exact request shape — `CHAIN_NOT_SUPPORTED` out,
  `ROUTE_NOT_FOUND` in). Not needed: Relay covers both
  directions with capture.
- **Unverified, named:** any funded 4663 settlement (the
  first funded deposit is the end-to-end proof, gated on
  Muse earnings), USDG liquidity at size, the Across WETH
  two-pass first pass (the fleet-wide native-output item
  above — the fee-bearing quote itself is verified
  collecting and bounds-clean), and the chain's stock
  tokens — Robinhood Stock Tokens are the chain's headline
  assets; the CoinGecko scan surfaces held ones as scanned
  rows under the fleet's existing rules, and no curated
  stock-token pins are made.

## Canonical-bridge moves — the LADYS class (2026-11-15)

A Move is not a swap, and it never travels through a swap
rail. Some tokens exist on an L2 only as the canonical
bridged form of an L1 token — the L2 contract was deployed
by the chain's own token bridge and is redeemable 1:1
against the L1 escrow. Selling the bridged form into a
market swap hands the user the L2 market price: for LADYS
(Arbitrum → Ethereum) that was measured at −86.55% impact
on ~$100 and −96.06% on ~$1,000 (2026-11-14 probe), because
the two forms trade at different prices. The canonical
bridge is the true 1:1.

- **The pair table is the only source of Moves**
  (`BRIDGED_MOVE_PAIRS` in wallet-core): token, origin
  chain, bridged chain, bridge type. LADYS is the first and
  only entry — Arbitrum `0x3b60…70E4E` ↔ Ethereum
  `0x1297…646bf`, 18 decimals, bridge `arbitrum-canonical`.
  A pair joins only with its own on-chain gateway
  verification, never by analogy.
- **The route (verified on-chain at build time):** the L2
  GatewayRouter (`0x5288…4F933`) resolves LADYS to the
  STANDARD L2 ERC20 Gateway (`0x09e9…51EEe` — re-read live
  before every initiation and refused if it ever changes).
  The standard gateway escrows by burning the L2 token
  through its gateway-only `bridgeBurn`, so the initiation
  is ONE call — `outboundTransfer(l1Token, to, amount,
  "0x")` to the router, carrying no native value and empty
  extra data (the gateway enforces both) — and there is NO
  approval leg. The built calldata is decoded and
  bounds-checked before signing (pinned L1 token, recipient
  = the user's own Ethereum address, exact amount, empty
  data), and the call is simulated before broadcast.
- **The wait is the protocol's:** about 7 days (Arbitrum's
  challenge period), shown up front on the confirm screen
  with the Arbitrum-side gas estimate and the claim's
  Ethereum-gas need (with a warning when the wallet holds
  no ETH on Ethereum). The pending-move record is written
  at broadcast, persists across lock/close, and shows the
  countdown on the token page, in the swap sheet and in
  Activity ("Move in progress — LADYS to Ethereum,
  claimable ~<date>"). The record carries the initiation
  receipt's full ArbSys `L2ToL1Tx` event — every field the
  L1 Outbox execution consumes.
- **Readiness is probed, not clocked.** The +7-day date is
  an estimate and stays labelled with a "~". Whether a
  move can actually be claimed is decided by an on-chain
  probe (run lazily when a move surface renders): the
  Outbox's `isSpent` (already claimed — including claims
  made through any other front-end, which reconcile the
  record to claimed), a confirmed send root covering the
  message's `position` (found by walking L2 block headers'
  `sendRoot`/`sendCount` against the Outbox's `roots()`),
  a NodeInterface `constructOutboxProof` whose send/root
  reproduce the confirmed root (with the Outbox's own
  `calculateMerkleRoot` as a third check), and finally an
  `eth_call` of the exact claim — success is the only
  thing that lights the Claim button.
- **The claim itself** is one Ethereum transaction:
  `Outbox.executeTransaction` (pinned Outbox
  `0x0B98…4840`, non-payable, 0 ETH) whose payload is the
  gateway's `finalizeInboundTransfer` — executing the
  message IS the whole claim; the L1 gateway releases the
  token. The calldata is built entirely from the record
  and bounds-checked before signing (position, the
  standard gateway as L2 sender, the pinned L1 gateway as
  destination, the pair's L1 token, from the user, to the
  user, the exact moved amount). The claim sheet shows
  the Ethereum gas estimated live for that exact claim
  (real claims sampled at 152,899–180,655 gas) and checks
  the wallet's ETH balance against it. The record is
  marked claimed only on a successful L1 receipt; a
  reverted claim leaves it ready and retryable.
- **Self-healing records.** The first build's receipt
  parser used the classic `L2ToL1Tx` ABI, but ArbOS
  changed the event's shape (the global send index is now
  `position`; `batchNumber`/`indexInBatch` no longer
  exist), so records written by that build carry no claim
  payload. Nothing is stranded: on read, such a record
  re-derives the payload from its own initiation tx hash
  and verifies the re-parsed fields reproduce the event's
  item hash before trusting them.
- **State of the parts (2026-11-15):** initiation LIVE ·
  pending tracking + countdown LIVE · claim-readiness
  surfacing LIVE (probe-driven) · claim execution LIVE.
  Arbitrum's official bridge (bridge.arbitrum.io, same
  wallet) remains named in-app as an alternative way to
  make the same claim. Nothing about a move is claimable
  by anyone but the user's own key, before or after.
- **Fee: none.** A canonical withdrawal is neither a swap
  nor a ramp and has no capture surface; the only cost is
  the Arbitrum network fee for the initiation (and, at
  claim time, Ethereum's).
- **Entry points:** the LADYS (Arbitrum) token page's
  "Move to Ethereum" action, and the swap screen — where
  the exact ARB LADYS → ETH LADYS pair presents the Move
  instead of any market quote.
