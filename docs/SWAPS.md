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
  TON in both directions via Relay (GRAM; the Relay-from-TON
  executor rebuilds and bounds-checks the deposit message
  locally), plus USDC into Sui (Mayan Fast MCTP), Sui same-chain swaps
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
- Polkadot Asset Hub became a swap destination on 2026-11-14
  (Chainflip, next-but-one section): BSC USDT or BNB in, DOT
  out at your own Asset Hub address, composable from any
  origin that can reach a BSC anchor. DOT as a source became
  executable on 2026-11-17 through Fluid's hosted Chainflip
  broker (§151, same section) — during the hours before it
  landed, the one-way trap gate (next section) paused the
  inbound direction rather than offer a route in whose
  value could not swap back out; the gate lifted Polkadot
  by coverage the moment the exit wired, with no gate edit.
- Arkade is a swap endpoint in its own right (2026-11-14) — see
  the next section.
- Some source chains cannot be quoted from every network environment;
  when that happens the sheet shows an honest refusal, not a fake zero.

## No one-way swap traps — the inbound gate (2026-11-17)

Ethuram's rule: **Fluid never offers a swap route INTO a
family it cannot swap back OUT of.** A user who swaps value
in and finds no swap path back has been trapped — their
only exit would be a plain send to an external wallet.
Two live traps made the rule: Stellar (1Click quoted in;
no executable route out) and Polkadot (Chainflip executed
in; DOT-out quoting-only until a broker is live). Both
exits shipped on 2026-11-17 (§150, §151 below), and the
gate lifted both families from coverage alone — as of
§151 no family Fluid offers is gated.

- **The gate is data-driven, never a hand-maintained list.**
  A family "has an exit" when the planner's own pair
  coverage — the same `*SupportsPair` predicates the
  cascade and the direct search consult, with each rail's
  executability fact applied where a direction is quotable
  but not executable (`chainflipDirectionExecutable`) —
  serves at least one executable route from one of the
  family's canonical liquid assets (native coin, pinned
  USDC/USDT) to a canonical asset of a different family
  (`swapFamilyHasExecutableExit` in `src/wallet-core.js`,
  §149 pins). The release that wires an exit flips the
  predicates and the family's inbound routes return on
  their own — no gate edit.
- **What is gated.** Cross-family routes into a no-exit
  family leave the offered set — in the direct search and
  in every composition leg (legs pass through the same
  search). The rails stay in code behind the gate, still
  exercised by their own pins. Intra-family swaps are
  untouched (they move value already inside the family).
  A gated family stays fully usable for hold, send and
  receive.
- **What the user sees.** Never a silent absence: picking a
  gated family as the swap destination stands a plain
  warning in the sheet before any search, the no-route
  diagnosis answers with the pause itself ("Swaps into
  <family> are paused in Fluid: Fluid can't swap back out
  of <family> yet…"), and the family's token pages carry
  the same note. The verdict arms only for a pair a rail
  actually serves into a no-exit family — that set was
  exactly {Stellar, Polkadot} and is empty since §151, so
  the pause stands armed for the next inbound rail that
  opens into a family without an exit.
- **Closed as destinations today (derived, 2026-11-17,
  post-§151):** none that was ever offered. The derived
  closed set holds only the presence-only / intra-only
  chains whose inbound was never offered and now cannot
  open as a trap either: algorand, aurora, b2, bitlayer,
  core, cronoszkevm, flare, filecoin, fuse, hedera,
  injectiveevm, kaia, kava, moonriver, rootstock, seievm,
  stacks, tac, taiko, tezos.
  (Full pair matrix: `research_notes/fluid-oneway-sweep-20261117/`.)
- **Cardano is NOT closed.** Both 1Click directions are
  wired, so the gate passes it; its open caveat is
  separate and environmental — the unverified broadcast
  link (see the Cardano section), not coverage.
- **The exits that reopened the two traps.** STELLAR-OUT
  IS WIRED (2026-11-17, §150 — see the Stellar section):
  the rail accepts Stellar as an origin in MEMO deposit
  mode, the wiring flipped the planner's coverage
  predicates, and the gate lifted Stellar from coverage
  alone — no gate edit was made for it; the §150 pins
  prove the inbound routes returned on the same
  derivation. DOT-OUT IS WIRED (2026-11-17, §151 — see
  the Polkadot section): Fluid's broker is the hosted
  Broker-as-a-Service (chainflip-broker.io); a self-hosted
  broker was rejected (FLIP funding plus a persistent
  node). Its wiring flipped the one executability
  predicate (`chainflipDirectionExecutable`), and the gate
  lifted Polkadot from that alone — again no gate edit;
  the §151 pins prove the DOT-out route executable and the
  DOT-in routes returned. Exit research: `research_notes/fluid-exit-research-20261117/`.

## Polkadot as a swap destination (2026-11-14)

> **2026-11-17 (§151):** DOT-out is executable through
> Fluid's hosted Chainflip broker (below), so the one-way
> trap gate has lifted Polkadot — swaps in are offered
> again, and swaps out execute with Fluid's commission
> verified twice before your DOT moves.

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
  ceiling ($0.30 total route cost). The two directions
  collect through different broker shapes. INTO DOT, the
  commission names Fluid's registered Chainflip broker
  account (an SS58 account) — an operator setup item that
  is not live yet — so DOT-in routes quote with the fee at
  exactly zero and the card's collecting flag says so,
  honestly. OUT of DOT, capture is LIVE since 2026-11-17
  (§151) through the hosted broker below, and is verified,
  not assumed: the broker's fee-bearing quote must
  reconcile with the fee-free protocol quote (commission
  itemised, output reduced by about the commission) or no
  route is shown, and the opened channel must echo the
  commission in the broker's own record before any DOT
  moves or nothing is sent.
- **DOT as a source is executable (§151, 2026-11-17).** A
  DOT deposit can only be made through a deposit channel
  opened by a broker, and the commission that carries
  Fluid's fee can only ride a channel Fluid's own broker
  opened — so the channel is opened through Fluid's
  hosted Broker-as-a-Service account (chainflip-broker.io).
  Its API key ships in the app by design: it identifies
  the broker and opens channels whose commission pays the
  Ethereum address registered with the account (the
  DripBot fee wallet); it cannot withdraw fees, move the
  payout address, or lower the commission below the
  registered rate, and the account's separate admin key
  never ships (a test pin greps the shipped bundle for
  it). Registration set Fluid's commission at 50 bps; the
  service adds its own 5 bps operating fee, so the user
  pays 55 bps total inside the one itemised BROKER fee and
  Fluid earns 50/55 of it. Execution: the broker opens the
  channel on the route's own terms (your BSC destination,
  your own DOT account as the refund, a fill-or-kill
  minimum price computed from the quote in exact decimal
  math), Fluid reads the channel back and verifies the
  recorded commission, deposit address and destination —
  and only then signs the DOT deposit from your own Asset
  Hub account. Any failed check sends nothing; an opened
  channel simply expires unused. Floors are the protocol's
  own (the DOT-source minimum measured 4 DOT on
  2026-11-17; DOT→BSC liquidity is thin — larger sizes can
  meet the protocol's insufficient-liquidity refusal,
  which surfaces honestly as no route). Bitcoin and
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
  **Echo drift (2026-11-17, §150):** the rail's echo has
  since changed shape fleet-wide — a request of F bps now
  echoes a single entry at F/2 (Fluid's net, matching the
  transform) instead of the two entries summing to F, so
  the shipped verifier no longer proves the total and
  charged quotes fall back fee-free until the total is
  re-proven. Full finding in the Stellar section.
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
- **Display pricing (walk repair, 2026-11-15):** the
  verification walk found the USDG and WETH pins grouped
  under "Other tokens — Unverified or unpriced": no feed
  prices USDG (no Binance pair, no CoinGecko id in the
  table) and WETH had no symbol price, so the rows could
  never carry a USD value. The display price table now
  prices every built-in `stable: true` pin at $1 by
  construction (pin-driven — any built-in's designated
  stable, not a USDG special case) and prices WETH at
  exactly the ETH price (wrapped ETH is 1:1 by contract).
  Both pins now stand as priced, curated rows. Display
  layer only — no swap pricing or route math reads these
  aliases, and send-cap valuations keep using the separate
  verified-price path.

## Canonical-bridge moves — pair table EMPTY (machinery dormant since 2026-11-17)

A Move is not a swap, and it never travels through a swap
rail. Some tokens exist on an L2 only as the canonical
bridged form of an L1 token — the L2 contract was deployed
by the chain's own token bridge and is redeemable 1:1
against the L1 escrow. For a token that genuinely has that
shape, selling the bridged form into a market swap hands
the user the L2 market price, and the canonical bridge is
the true 1:1. Fluid's Move machinery (initiation through
the GatewayRouter, a persisted pending record, probe-driven
claim readiness, and the L1 Outbox claim) exists for such
pairs — and every Move surface in the app is driven by one
pair table (`BRIDGED_MOVE_PAIRS` in wallet-core).

- **The pair table is EMPTY (2026-11-17).** Its one entry —
  LADYS Arbitrum → Ethereum, added 2026-11-15 — was
  REMOVED after the pairing proved invalid on-chain. The
  held Arbitrum token (`0x3b60…70E4E`) is a standalone
  team deployment (plain ERC20 + AccessControl: no
  bridge(), no l1Address(), no gateway link). The standard
  gateway's calculated L2 token for L1 LADYS is a
  DIFFERENT contract (`0x3952…cFF24`) that holders of
  `0x3b60…70E4E` do not hold, and the router's
  outboundTransfer reverts "burn amount exceeds balance"
  for every amount > 0 of the held token. No canonical
  1:1 redemption exists for it. The 2026-11-15
  verification was fooled two ways: getGateway returns
  the DEFAULT gateway for unregistered tokens, so its
  answer proved nothing about this token; and the
  zero-balance burn-revert "proof" was simulated against
  the calculated token, not the held one.
- **LADYS takes the market path again.** Arbitrum LADYS →
  Ethereum LADYS is an ordinary swap-sheet route: the
  market quote (Relay) is shown as it really is — the two
  forms trade at different prices, measured at −86.55%
  impact on ~$100 (2026-11-14 probe) — with the standard
  price-impact disclosure, never dressed as a 1:1 Move.
- **The machinery stays, dormant.** Initiation (one
  `outboundTransfer` call, no approval leg, calldata
  bounds-checked, gateway re-read live), the persisted
  record + countdown, readiness probed not clocked (Outbox
  isSpent, a confirmed send root, a NodeInterface proof,
  an eth_call of the exact claim), and the claim itself
  (one Outbox execution, bounds-checked, marked claimed
  only on a successful L1 receipt) all remain in the tree
  behind the empty table; Move L2 reads rotate over the
  primary, the fallback and an archive-capable endpoint.
  With no pair listed, no token page offers a Move and no
  swap route presents one. Records written under a removed
  pairId still load and phase; their claims refuse safely
  (the bounds check rejects an unlisted pair).
- **The verification standard for any future pair** — all
  three, with the evidence recorded in the entry (the
  suite's pair-table lint refuses an entry without it):
  (1) `gateway.calculateL2TokenAddress(L1 token)` ==
  the held L2 token, exactly; (2) the L2 token's own
  `l1Address()` == the L1 token; (3) a simulation of the
  initiation from a funded holder of that exact L2 token,
  for an amount > 0. getGateway resolving and name/symbol
  matching prove nothing — they are how the LADYS entry
  passed in 2026.
- **Fee: none** — when a pair is listed, a canonical
  withdrawal is neither a swap nor a ramp and has no
  capture surface; the only cost is the origin chain's
  network fee for the initiation (and, at claim time, the
  destination's).

## Zcash + Dash — presence + 1Click swaps (audit gap #8, 2026-11-15)

Zcash and Dash join Fluid whole: each family derives, holds,
receives and sends from the same phrase, and each native coin
is a 1Click family (the eighth and ninth), swappable in both
directions wherever 1Click has liquidity. Dash is the
Dogecoin shape with Dash parameters; Zcash carries the
build's one genuinely new component, a version-5 transaction
builder.

- **Dash (BIP44 coin 5).** Legacy P2PKH (X… addresses) on the
  existing legacy builder machinery — standard v1
  transactions, Bitcoin-class 546-satoshi dust. DIP2 special
  transactions are provider traffic and never used; neither
  is InstantSend. Reads are BlockCypher primary (its balance
  shape is the in-tree parser's, its chain endpoint carries
  the fee stats) with the shared Blockchair dashboard parser
  as fallback; the fee rate is cross-checked two-source and
  ceiling-clamped like Litecoin's. Broadcast is BlockCypher's
  raw push, Blockchair's push as fallback.
- **Zcash (BIP44 coin 133), transparent only.** t1 addresses
  are base58check over a TWO-byte prefix (0x1cb8), hand-rolled
  on the in-tree primitive (@scure's p2pkh cannot encode
  two-byte prefixes). Shielded (zs…) and unified (ua…)
  addresses are refused honestly — this build holds no
  shielded keys. Reads ride Blockchair's address dashboard
  (the only keyless CORS-clean source the research found):
  one call returns balance + UTXOs, and its keyless tier's
  HTTP 430 IP-blacklist body is a FAILED read — "couldn't
  load", never a fake zero. A keyed/proxied read path (the
  Koios pattern) is the hardening item if the keyless tier
  proves too tight in production.
- **Zcash sends are v5 transactions (ZIP 225).** NU7 (ZIP
  259, activated 2026-11-06) retired version 4 outright, so
  sends are built as transparent-only v5 transactions signed
  with the ZIP-244 sighash and priced by ZIP-317 (5,000 zats
  per logical action, 10,000-zat minimum — a flat ~0.0001 ZEC
  for a typical send, not a per-vbyte market), with the
  ZIP-203 expiry height at tip + 120. PROVEN before shipping
  to the BCH standard: the code reproduces a real post-NU7
  mainnet v5 transaction's txid from its raw hex
  (1138a133…, block 3,575,780), and both of that
  transaction's real signatures verify over this code's
  sighash — both pinned in the suite (§128). Broadcast rides
  Blockchair's push endpoint, whose preflight passed in
  research; the broadcast itself is UNVERIFIED until a first
  funded send — the send sheet says so.
- **MAINTENANCE PIN — the consensus branch ID.**
  `ZEC_CONSENSUS_BRANCH_ID` in wallet-core is NU7's
  `0x77190ad9` (ZIP 259). Zcash signatures and txids commit
  to this value, and it changes at EVERY network upgrade:
  when the next upgrade activates, this constant must be
  updated from its deployment ZIP or every Zcash send fails
  network-wide. NU8 is already sketched for late January
  2027 — this is a recurring calendar item, not a one-off.
- **The rail** is 1Click, unmodified — the same two-pass fee
  flow and echo verification as the families before it.
  Capture was probed live: the fee-50 echo verifies for ZEC
  in both directions and for DASH out (Fluid 25 / 1Click
  25). Production collecting stays **false** fleet-wide
  until the operator sets `ONECLICK_FEE_RECIPIENT` — the
  same standing operator item as LTC/DOGE/BCH/ADA; the
  mechanism ships proven and the display says collecting is
  off, exactly as the existing families do.
- **Floors and speeds are 1Click's own, named before the
  user commits.** ZEC out: floor 0.00132 ZEC (~$1.22) at a
  ~457 s estimate — SLOW CLASS, disclosed as slow, never
  badged fast. ZEC in: floor ~$1.24 at ~150 s. DASH out:
  floor 0.011 DASH (~$0.42) at ~129 s. **DASH in currently
  has no liquidity above ~$1** (only a $1 quote cleared at
  the probe; $5/$10/$20 all answered "No liquidity
  available") — a solver-inventory state that may refill.
  The pair is wired anyway and presents as an honest
  no-route at larger sizes.
- **Integration fix shipped with this gap:** 1Click's
  "No liquidity available" answer used to surface as a
  thrown route-search ERROR; it is now part of the no-route
  pattern in the quote fetch, so thin liquidity reads as
  no-route on every 1Click pair, not just DASH-in.

## Stellar swaps — Soroswap intra-chain + 1Click both ways (audit gap #9, 2026-11-15; Stellar-out §150, 2026-11-17)

> **2026-11-17 (§150):** Stellar-OUT is wired (1Click,
> MEMO deposit mode — see the last bullet), so Stellar has
> an executable exit and the one-way trap gate lifted it
> from coverage alone; swaps INTO Stellar are offered
> again. Intra-Stellar swaps (Soroswap) are unaffected.

Stellar gains both swap directions this slice, on two
different rails: swaps WITHIN Stellar (XLM ↔ USDC) ride the
Soroswap Aggregator, and swaps INTO Stellar from other
chains ride 1Click with XLM as a destination. Stellar as a
cross-chain SOURCE rode 1Click too from §150 (below).

- **The Soroswap shape.** A REST port in the OpenOcean
  mould: `POST /quote` (assets as SAC contract addresses —
  XLM is `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`,
  Circle's USDC is `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` —
  amounts as integer strings in stroops, 7 decimals) →
  `POST /quote/build` with the unchanged quote → the user
  signs the returned envelope → `POST /send`. The aggregator
  routes across Soroswap AMM, Phoenix, Aquarius, Comet,
  Sushi and the SDEX order book behind one pinned contract
  (`CARVQXFP4JF5ELLXUMQ6DALR346YVGBMQOHB4ENA7SSVXAYABXLBDDC4`),
  so this one port is the whole Stellar DEX surface;
  SDEX-direct and Aquarius-direct were rejected in research
  (zero capture; Aquarius is already a venue inside the
  aggregator). The build simulates server-side and the
  envelope is submitted **exactly as built — never
  re-simulated** (the API forbids it, and the build's
  simulation is what priced the route). A built envelope
  lives 180 s on Soroban routes, so the executor builds
  immediately before signing; a stale build (a 409, or a
  sequence that no longer matches the account) refuses with
  "search again", never a silent re-price.
- **Inspect-before-sign.** Nothing is signed on trust: the
  executor decodes the built envelope and pins it before the
  Stellar key touches it — sourced by the user's own
  account, exactly one operation, a real expiry inside the
  quote's lifetime, a network fee no larger than any Stellar
  fee can honestly be (cap 1 XLM), and then the operation
  itself: either an invoke of the pinned aggregator contract
  (`swap_exact_in` / `swap_exact_out` carrying the owner's
  address, both assets' SAC ids and the quoted input amount
  among its arguments), or an SDEX path payment pinned to
  the same fields (destination = the owner, the quoted
  amounts, a minimum no lower than the quote's threshold).
  Anything else refuses unsigned.
- **Trustlines are their own step.** `/quote/build` can
  answer **428** with a ready-to-sign changeTrust envelope
  for the asset the account cannot yet hold — which can be
  an intermediate route asset, so the step names its asset
  from the response, never an assumption. The executor
  bounds-checks that envelope on its own (exactly one
  changeTrust, adding exactly that asset), presents it as a
  separate, clearly-labelled signing step BEFORE the swap,
  and only then builds the swap. Each trustline locks
  +0.5 XLM under the existing reserve model. A trustline
  envelope is never smuggled inside the swap envelope, and
  the bounds checker refuses a swap-shaped envelope
  presented as a trustline (and vice versa).
- **The key posture.** Every Soroswap endpoint needs an API
  key (`Authorization: Bearer sk_…`); there is no keyless
  tier (live proof: a keyless call answers 401
  MISSING_CREDENTIAL). `SOROSWAP_API_KEY` is build-time
  config, the `ONECLICK_JWT` posture: **while no key is
  configured the surface is honestly ABSENT** — no route is
  offered, no dead button, no error card. One embedded key
  is one fleet-wide rate bucket (Free plan: 1 request per
  second) — Soroswap itself warns against frontend keys;
  that is the accepted launch posture, stated here rather
  than hidden. Live POST verification from the build VM was
  environment-blocked (POSTs to api.soroswap.finance hang
  from its egress while GETs answer), so the port is pinned
  on the API's documented shapes plus the research's live
  GET/SDEX evidence; the first-user walk re-checks POSTs
  in-page from the production origin.
- **Capture — the gate, stated plainly.** The partner fee
  (25–300 bps, set on the Soroswap ACCOUNT, never per-quote)
  is taken from the input token and echoes in quotes as
  `platformFee {feeBps, feeAmount}` **only once Soroswap
  manually activates the account as a partner**. Activation
  is **PENDING** (a console signup and the activation email
  are operator-side steps), so this surface ships
  **collecting=false, honestly displayed** — the shipped
  configuration carries no partner rate
  (`SOROSWAP_PARTNER_BPS = 0`). The echo verification is
  wired from day one: with a rate configured, a quote
  collects only when its echoed `platformFee` matches the
  configured rate and the exact fee arithmetic
  (`floor(amountIn × bps / 10000)`, ±1 stroop); a quote
  carrying a `platformFee` while no rate is configured is
  an unverified charge and **refuses**, as does any
  mismatch. When collecting, the disclosed figure is the
  gross partner rate — the whole fee leaves the user's
  input in the open; Fluid's share (about half, per
  Soroswap's docs — unverified) arrives as Soroswap's
  monthly USDC settlement and is never an extra charge on
  the user. The switch is config + a proven live echo,
  never copy claiming collecting when it is not (the
  Cosmos/1Click precedent).
- **The swap table** is XLM and Circle's USDC — the only
  verified Stellar asset (the `STELLAR_USDC` rule) —
  addressed exactly as their balance rows are (the `xlm`
  sentinel; `USDC:<issuer>`). Other trustline assets a user
  holds stay send/receive only this slice: the sheet never
  offers a swap it cannot route. There is no practical
  floor (the SDEX probe quoted 0.1 XLM); speed is the fast
  class by construction (~15 s estimated end-to-end — an
  estimate, not a measurement; the walk re-measures).
- **1Click INTO Stellar is live.** The re-probe overturned
  half of the 1Click section's original verdict: the
  catalogue's XLM (a `nep245:` HOT-omni asset id, 7
  decimals — not the `nep141:` shape of the other families)
  now quotes as a destination (live captures: USDC on Base
  $5 → 34.9064438 XLM, $20 → 142.9257757 XLM, ~52 s
  estimate, 1.1 XLM withdraw fee inside the quote). It is
  wired through the ordinary 1Click machinery — same
  two-pass fee flow and echo verification as every family —
  and its capture posture is the fleet-wide one:
  **collecting=false until the operator sets
  `ONECLICK_FEE_RECIPIENT`**, displayed exactly as the other
  1Click families display it.
- **Stellar OUT via 1Click is WIRED (§150, 2026-11-17).**
  The rail began accepting Stellar as an ORIGIN (its
  catalogue carries exactly two Stellar assets — XLM and
  Circle's USDC, both HOT-omni `nep245:` ids at 7 decimals;
  both are in the 1Click table, USDC in the stable class).
  Live dry quotes on wiring day: XLM → USDC on Base at
  100 / 10 / 2 XLM (minimum ≤ 2 XLM ≈ $0.27), XLM → BTC,
  Stellar USDC → USDC on Base. The origin works ONLY in
  MEMO deposit mode (SIMPLE is refused outright): a
  non-dry quote returns HOT's pooled deposit address and
  a numeric `depositMemo`, and execution is one ordinary
  Stellar payment to that address carrying the memo —
  `sendStellar` now attaches it as a **text** memo (real
  deposits to the pooled account carry the same value as
  text and as id memos; the watcher matches the string).
  The fail-closed discipline: a Stellar-origin quote
  without a memo is no quote at all (the route search
  returns nothing), the swap gate refuses a Stellar route
  whose memo was stripped, and the executor refuses
  before sending rather than deposit memo-less. Refunds
  return to the sender's own Stellar address (a Stellar
  origin's refund address must be able to hold the asset
  — a real holder's own address does by construction).
- **Capture on Stellar-origin routes: collecting=false,
  honestly.** Same fleet-wide posture as every 1Click
  route today — `ONECLICK_FEE_RECIPIENT` ships empty (no
  NEAR-form fee address for the DripBot wallet exists in
  the pinned records; none was invented), so the charged
  pass never runs. **The fee-echo finding (live re-probe
  2026-11-17):** requesting an appFee of F bps now echoes
  back a SINGLE `appFees` entry naming Fluid's recipient
  at ceil(F/2) — the two-entry echo summing to F (the
  2026-11-14 captures) is no longer returned on any origin
  probed (Stellar, Base, NEAR all behave the same). Per
  1Click's fee-config docs the requested fee is split
  50/50 with 1Click (its half floored at 20 bps, 1 bp for
  the stable class), so Fluid's predicted NET (the
  transform's `expectedFluidBps` = F/2) matches the echoed
  entry exactly — but the echo no longer proves the TOTAL
  was charged, so the shipped verifier
  (`verifyOneClickFeeEcho`, which requires the two-entry
  total) fails it and the two-pass search falls back to
  the fee-free quote: fail-safe, never an unverified
  charge. Re-proving the total (a fresh capture against a
  configured recipient, or 1Click confirming the echo
  contract) is the step that turns capture on for the
  whole 1Click fleet at once.

## Aptos CCTP V2 — the native USDC crossing (audit gap #10, 2026-11-15)

USDC moves between Aptos and the EVM chains over Circle's
own CCTP V2 — the one rail that is exactly 1:1, because it
IS the issuer's bridge: burn native USDC on the source,
Circle attests, mint native USDC on the destination. V2
only (V1 pauses 2026-12-01; nothing V1 was built). Aptos is
CCTP **domain 9**; the EVM side covers every chain where
Fluid pins native USDC and CCTP V2 lives — Ethereum (0),
Avalanche (1), Optimism (2), Arbitrum (3), Base (6),
Polygon (7), Linea (11). Solana (5) and Sui (8) are a
second slice: both already have their own swap rails, and
their CCTP receive patterns differ from the EVM one reused
here. Only Circle's native Aptos USDC (the fungible-asset
metadata object) crosses — the LayerZero-bridged Aptos USDC
is a different asset and never matches.

- **The shape.** The Aptos side runs on Circle's own
  precompiled Move **scripts** (`deposit_for_burn.mv`
  outbound, `receive_message.mv` inbound, from
  circlefin/aptos-cctp's published mainnet V2 set): the
  wallet builds a Script-payload transaction — a payload
  variant the Aptos builder gained for this slice — and
  both scripts are pinned by SHA-256 in the source; a
  script whose hash differs from its pin refuses, and the
  pins are fixture-tested against Circle's published bytes.
  Outbound needs **no approval transaction** (the script
  withdraws from the sender's primary fungible store). The
  EVM side reuses the in-tree CCTP machinery: the V2
  `depositForBurn` burn against the pinned TokenMessengerV2,
  field-checked before signing like every Satora-CCTP call,
  and the generalised message pin on the way back. The
  attestation is Circle's Iris API — keyless GET polling,
  transport already proven in-page from the production
  origin; the in-tree Satora poller does the waiting.
- **Capture — the composition, per direction.** Native
  CCTP has NO fee surface (no hook, no fee recipient, no
  spread), so under the universal rule the route ships only
  as the skim composition, following the Noble precedent:
  Fluid's fee — the fee law on a zero-cost route, the flat
  cap rate (50 bps today), fee + net == amount exactly — is
  an explicit USDC transfer on the EVM side of the crossing,
  inside the same user confirmation, to the DripBot EVM fee
  wallet. **Inbound (EVM → Aptos): collecting** — the burn
  is amount − fee and the fee transfer follows the confirmed
  burn. **Outbound (Aptos → EVM): collecting** — the full
  amount burns on Aptos and the fee is skimmed from what the
  mint lands on the destination chain (the SunSwap
  output-skim shape), after the mint confirms. A skim that
  fails after the crossing lands is flagged on the record
  and retried by the driver; it never blocks or reverses
  the user's crossing. Below the fee law's floor the route
  is honestly fee-free (collecting=false), exactly like the
  Cosmos precedent.
- **Slow class, disclosed.** A standard transfer waits for
  source-chain finality before Circle attests: **~15–19
  minutes** end to end. The card says so and is never badged
  fast; the 1Click Aptos route stays untouched beside it as
  the fast alternative.
- **The APT-dust claim.** The inbound mint is submitted by
  the user's OWN Aptos account (the receive script) and
  pays APT dust — **a zero-APT account cannot self-claim**.
  The card says so before confirming, and the pending record
  waits honestly in that state until the account holds a
  little APT (or the user takes the 1Click route instead).
  Records persist under `fluid_cctp_aptos_v1` and resume on
  unlock and on the minute tick, like the bridge-move
  records: funds are never in Fluid's custody, and the
  attested message + attestation persisted on the record
  are everything the mint needs.
- **Re-check trigger.** Circle's Fast Transfer, the
  Forwarding Service and hooks are all unavailable on
  domain 9 today (probed 2026-11-15). If Circle enables
  any of them for Aptos, re-probe: a hook or forwarder
  would let the crossing carry its own fee and drop the
  skim composition — and Fast Transfer would retire the
  slow-class disclosure.
- **Unproven.** No funded burn has run: settlement proof
  stays gated on Muse earnings, like every funded proof
  in this programme. The quote side is deterministic (1:1
  minus the disclosed skim), the scripts are Circle's own
  bytes pinned by hash, and every calldata/script/message
  the executor signs is bounds-checked in §130 of the suite.

## Stacks — the sBTC peg (Move class) + Bitflow intra swaps (audit gap #11, 2026-11-15)

Stacks gains its swap surfaces on one new primitive: a
**general contract-call builder** (a Clarity value
serialiser/parser, contract-call payloads with caller-built
post-conditions, and a decoder that bounds-checks the built
transaction against the reviewed spec before broadcast —
§131 of the suite pins it independently of both surfaces).

- **The sBTC peg — a MOVE, never a swap, and fee-free.**
  BTC ↔ sBTC is Bitcoin's canonical bridged form on Stacks:
  the peg redeems exactly 1:1, so the swap sheet presents
  the Move card instead of any market quote, and the move
  carries **no Fluid fee** — the peg has no capture surface
  at all (no protocol fee, no signer fee; the only deduction
  is the Bitcoin network fee of the signers' sweep, capped
  by the user's own max-fee), and a canonical move never
  invents one (the Move discipline — see Canonical-bridge
  moves above).
  - **Peg-in (BTC → sBTC)** is a plain Bitcoin send to a
    P2TR deposit address computed locally from the pinned
    script grammar (the official sBTC helper's): a deposit
    leaf naming the user's Stacks recipient + the signers'
    aggregate key, and a reclaim leaf CSV-locked to the
    user's own key (default 950 blocks, ~6.6 days). The
    aggregate key is **read live from the sBTC registry at
    quote time** — signer sets rotate, so a failed read
    refuses the quote and an executor re-read refuses a
    deposit priced against a rotated set; never a stale
    hardcoded key. Minimum 0.001 BTC (the peg route's own
    floor, set by the protocol). Minting lands within ~3
    Bitcoin blocks (~10–30 min). Emily is notified
    best-effort after broadcast and its deposit limits are
    shown when it answers; neither ever blocks, and no cap
    is ever fabricated from its silence.
  - **Peg-out (sBTC → BTC)** is one contract call —
    `sbtc-withdrawal.initiate-withdrawal-request` — guarded
    by an exact-lock post-condition (the user's sBTC moves
    by exactly amount + max-fee or the transaction aborts).
    The contract locks amount + fee allowance at initiation;
    the signers pay the Bitcoin payout fee from the
    allowance, the unspent part is minted back in sBTC, and
    the user receives exactly the amount in BTC; a rejected
    request unlocks the full lock. Payout ~1 h class (after
    ~6 Bitcoin blocks). The recipient is the user's own
    Bitcoin address, encoded in the contract's version table
    for every address form Fluid holds.
  - **Trust disclosure, on both cards:** the peg is held by
    a threshold signer set (8-of-11 at the 2026-11-15 probe;
    the threshold and set size are read live with the key
    and printed as read) — sBTC is signer-held Bitcoin, not
    native BTC; the reclaim path is the user's protection
    on the way in.
  - **Records** persist under `fluid_sbtc_peg_v1` and resume
    like the bridge-move records; phases advance only from
    protocol evidence (Bitcoin confirmations, the registry's
    completed-deposit / withdrawal-request reads, the sBTC
    balance delta, the payout visible on the user's Bitcoin
    address) — a record's own state claim never completes it.
  - **Repair (2026-11-15, the first-user walk's check 6):**
    the peg-in driver's fallback mint evidence — the sBTC
    balance delta against the plan's baseline — originally
    accepted any delta in [amount − maxFee, amount] with no
    positive floor and no deposit gate, so a seeded record
    whose amount sat below the fee cap completed on a zero
    delta (fabricated deposit txid, no registry entry, no
    credit) and the panel explained the whole deposit away
    as "sweep fee". The invariant now: **no completion
    without deposit evidence** — neither the registry read
    nor the fallback runs until the record's own deposit is
    proven to exist AND be confirmed on Bitcoin (an unfound
    or unconfirmed deposit leaves the record in-progress,
    never done, never failed); the fallback delta must be
    **positive** and in band (a genuine mint always credits
    a positive amount — the planner refuses maxFee ≥
    amount — while a zero delta is the absence of a mint);
    the written amount is always the observed one, and the
    sweep-fee explanation renders only on a positive
    completion. A record already carrying a non-positive
    "minted" figure is re-derived, not trusted
    (repair-on-read). §132 of the suite pins the walk's
    seeded case, the fake-txid and unconfirmed-deposit
    cases, the genuine fallback, and the unchanged
    registry-confirmed path.
- **Bitflow intra-Stacks swaps — the v1 shape.** Quotes are
  computed the legacy SDK's client-side way: the route set
  comes from the pinned **docs gateway host** (the SDK's
  bundled default host is dead), each route's quote function
  is called read-only through Hiro with arguments built in
  **ABI order** (the gateway's own `order` array disagrees
  with the ABI on the Velar path and is not trusted), and
  the best quote wins — in probes Velar's pool beat
  Bitflow's own XYK pool on STX→sBTC, which is the
  aggregator's whole point. Execution is a contract call
  through the general builder against **pinned,
  fixture-verified contracts only** (the XYK swap helper and
  the Velar path wrapper in this slice), guarded by Fluid's
  own post-conditions built from the route's map: exactly
  the quoted input leaves the wallet, at least the quoted
  minimum (0.5% slippage floor) arrives, or the transaction
  aborts. **Prices come from the quotes, never from
  Bitflow's token price feed — the feed is proven stale**
  (its sBTC figure disagreed with the pools by ~18% at probe
  time).
  - **Capture: none on v1, honestly shown.** The legacy
    path carries no fee in the transaction — Bitflow's own
    SDK docs state the `provider` principal is attribution
    only, with no automated revenue sharing from it — so
    every v1 route is `collecting=false` and the card says
    no Fluid fee is charged. The provider principal is a
    config seam (empty in this build → provider = none).
  - **The v2 BFF path is NOT wired.** Its fee-carrying
    aggregator calls are POSTs to `bff.bitflowapis.finance`,
    and POSTs to that host never completed from this VM
    (the KyberSwap environment class — no build may depend
    on an executor whose calls were never inspected from
    here). **Re-probe trigger:** from a clean network,
    (1) a BFF `POST /quotes/v2/quote` + `POST
    /quotes/v2/agg/swap` round-trip completes and the built
    call is inspectable, and (2) Bitflow's revenue-share
    percentage to providers is pinned in writing (today it
    is published only as "a portion"). On both, v2 switches
    on with `agg_fee_bps` on `agg_buildable` routes — the
    route/gate/executor shapes here need no redesign.
- **Unproven.** No funded peg-in, peg-out or Bitflow swap
  has run: settlement proof stays gated on Muse earnings,
  like every funded proof in this programme. What is proven
  is the construction layer — the deposit address derives
  byte-identically to the official grammar over the live
  registry key, the peg-out call and the Bitflow quote/swap
  arguments match the probe's serialised vectors, and every
  transaction the executors sign is decoded and
  bounds-checked in §131 of the suite.

## Algorand — intra-chain swaps via Tinyman v2 + Pact direct (audit gap #12, 2026-11-15)

Algorand held, sent and received long before it could swap.
This slice closes the intra-chain gap against the chain's
two live DEXes **directly** — no aggregator in between —
with Fluid assembling the swap's atomic group itself.

- **Tinyman v2.** Pools are LogicSig accounts under the v2
  validator app (id **1002541853**, pinned). The pool
  address is derived locally from the validator's published
  LogicSig template (asset1 = the larger ASA id; ALGO, id 0,
  is always asset2 in its pairs) — the derivation is pinned
  in §133 against the live ALGO/USDC and USDC/USD t pools.
  Pool state (reserves + `total_fee_share`, read live — the
  majors currently carry 36, i.e. 0.36%, not an assumed 0.3%)
  comes from the pool account's validator local state over
  algod, and the fixed-input quote is computed client-side
  with the official SDK's own arithmetic.
- **Pact.** Pools are applications. Discovery runs through
  Pact's keyless public API (`api.pact.fi/api/pools`, by
  asset pair); state (CONFIG → [ASSET_A, ASSET_B, FEE_BPS],
  internal totals A/B) comes from the pool app's global
  state over algod; the quote uses the SDK's
  constant-product arithmetic (gross off the curve, the pool
  fee off the gross, the SDK's rounding kept exactly).
  **Constant-product pools only** ("PACT AMM") — stableswap
  pools are not quoted by this slice. Where several pools
  serve a pair, the best output wins.
- **Both venues are quoted for every pair both serve**; each
  route names its venue on the card, and merit ranking
  decides. Prices come from pool state only. Speed is the
  fast class: Algorand's measured block time is 2,574 ms
  and an atomic group settles in about a round (≤ ~10 s
  stated).
- **Execution — inspect-before-sign.** The group is built
  as plain descriptors — [deposit to the pool, the venue's
  pinned app call carrying the reviewed minimum-out] plus
  the skim leg when the route collects — bounds-checked
  against the reviewed route, materialised with algosdk,
  decoded back to descriptors and checked **again**; only
  then does anything sign. A missing destination-ASA
  opt-in is **its own signing step first** (the Stellar
  trustline precedent): a separate bounds-checked
  zero-amount self-transfer, confirmed, and only then is
  the swap group built fresh. The confirm copy names the
  one-time 0.1 ALGO minimum-balance reserve the opt-in
  locks. At execution the pool is re-read and re-quoted; a
  fresh output below the reviewed minimum refuses.
- **Capture — the SKIM shape (Noble/SunSwap precedent).**
  Neither venue has an integrator programme (Tinyman's FAQ:
  none; Pact's pool fee goes 100% to LPs), so Fluid's fee
  rides **inside the atomic group it assembles**: under the
  fee law (50 bps class on these routes), taken in ALGO at
  the quote-implied rate as an appended payment leg to the
  DripBot fee wallet's Algorand address
  (`O67U3XOR…B6XAB34`, pinned in `FEE_SPLIT` and §133) —
  or, when the input is ALGO itself, as a leg of exactly
  the input's skim: the pool receives amount − fee, and
  fee + deposit == amount, exactly. The executability gate
  re-derives the whole fee state from the route's own
  amounts. If the user's ALGO cannot cover the fee leg
  alongside the swap and the network fees, the route is
  **honestly fee-free** (`collecting=false` on the card),
  never blocked (the Cosmos precedent); below the fee law's
  floor it is fee-free by the law itself. Collecting is on
  from day one — no config gate.
- **USDt warning.** USDt on Algorand (ASA **312769**,
  genuine Tether) trades **below $1** in its own pools
  (≈ $0.88 measured 2026-11-15; the USDC/USD t pool implied
  $0.8836 at build time). Everywhere this slice prices,
  displays or ranks USDt it uses the quoting pool's implied
  rate — never the $1 the generic price table pins on the
  USDT symbol (a different asset's price). A USDC→USDt
  quote showing more than 1 out per 1 in is that discount,
  not a gain: §133 pins that such a quote, valued honestly,
  does not outrank a par USDC quote of higher value. USDC
  is ASA **31566704** (Circle, pinned, re-verified from
  algod). goBTC (**386192725**) / goETH (**386195940**) are
  ordinary swap assets where pools exist — their pools are
  thin, so the card states the price impact plainly — and
  there is **no Move pair** for them: Algomint mint/redeem
  is a custodial web flow, not a canonical bridge.
- **The Haystack Router is NOT wired.** Haystack (ex-Deflex,
  TxnLab) is the one Algorand aggregator WITH capture
  (`referrerAddress` + `feeBps`, default 15 / max 300; the
  referrer earns 25% of the router fee into a claimable
  escrow, so Fluid would net 50 bps only at `feeBps=200` —
  a rate decision). It stays unbuilt because it is gated
  three ways and environment-blocked: **switch-on triggers,
  all four required** — (1) a clean-network end-to-end
  quote proof (from this VM the quote API never completed:
  a valid-key `fetchQuote` hung past 600 s in-page and
  280 s by curl, zero response — the KyberSwap class: never
  ship an executor whose traffic was never inspected);
  (2) one-time referrer registration in the Haystack app
  (0.26 ALGO, an operator item — unregistered referrers get
  HTTP 400 on quotes); (3) a production API key (issued by
  email request); (4) the `feeBps` rate decision (200 for a
  50 bps net). Vestige is a no-rail (shutdown announced
  2026-11-14 for 2026-12-31; its API roots already fail),
  Folks is a no-rail as a surface (in-app aggregator only),
  Humble is dead and Algofi wound down in 2023.
- **Cross-chain Algorand stays honest no-route** in this
  slice.
- **Unproven.** No funded Algorand swap has run: settlement
  proof stays gated on Muse earnings, like every funded
  proof in this programme. What is proven is the
  construction and quoting layer — both venues quote live
  through the shipped quoter (Tinyman and Pact both answered
  for ALGO→USDC, USDC→USDt and ALGO→goBTC at build time,
  collecting at 50 bps with fee + deposit == amount
  exactly), the pool derivation matches the live pools,
  both quote arithmetics reproduce the research fixtures,
  and every group the executor signs is spec-checked and
  decode-checked in §133 of the suite.

## EVM long-tail batch — audit gap #14 (2026-11-16)

Seventeen candidate chains probed live in one pass (research:
`research_notes/fluid-evm-longtail-20261116` — probe notes, 92
fixtures, and the build addendum). Twelve join as hand-verified
built-ins; none is auto-discovered (no router Fluid runs lists
any of them, so the discovery gate has nothing to admit — the
gate was not loosened, HyperEVM precedent). Every chain's RPC
was verified against the chain itself (eth_chainId) from this
machine.

- **Rootstock (30) — FULL: presence + OpenOcean intra.**
  RBTC ↔ USD₮0 quotes and builds live through the fleet
  OpenOcean rail (the pinned exchange, the zero-address
  native sentinel accepted, per-route echo verification —
  the admission A/B matched the 0.625 dial at 0.6196%). The
  pinned stable is USD₮0 (Tether's LayerZero form, the traded
  dollar on RSK), pinned as the chain's USDT with provenance
  named; rUSDT (the bridge form) is not pinned.
- **Rootstock's Satora lane — capture PROVEN, execution NOT
  wired, deliberately.** Satora quotes RBTC ↔ BTC /
  Lightning / Arkade 1:1 both ways, and the keyed
  `extra_fees` echo was proven live at build time (protocol
  fee 250 → 500 under the developer key, net down exactly
  250 sats, both directions — the shipped differential
  identity holds to the sat). But chain-30 execution is a
  different grammar from every shipped lane: creations lock
  in an **HTLCNative v2** (the server refuses gasless funding
  for native locks outright, and Fluid's executor funds only
  Permit2 ERC-20 locks), and payouts claim through the
  user's **RIF Relay smart wallet** (relayed
  meta-transactions; `/chain-config` publishes the relay
  block). Neither grammar is implemented, and the lock-call
  ABI appears in no payload — so no Satora route is offered
  for Rootstock. A route that would refuse at creation is
  not a route. **Re-probe / build trigger:** a separate
  slice that pins the HTLCNative v2 ABI (lock + refund) and
  the RIF Relay claim flow from the reference SDK against
  the addendum's payloads, then re-runs the keyed echo.
- **Flare (14) — FULL: presence + OpenOcean intra.** Relay
  refuses the chain explicitly; OpenOcean builds live (echo
  0.6199% at sane size at admission; the shipped rail
  re-verifies every route). The pinned stable is USD₮0
  `0xe7cd86e1…`. **Impostor caution:** an unrelated same-name
  "USDT" at `0x0b38e83b…` also trades on Flare — never
  pinned, never offered (the Robinhood rule). At dust sizes
  the venue over-echoes the dial, so dust routes read
  fee-free honestly under the fee law, as on every
  echo-verified rail.
- **Presence-only (10) — derive, hold, receive, send; swaps
  are an honest no-route.** Kaia (8217), Filecoin FEVM
  (314), Taiko (167000), Core (1116), Kava (2222), Cronos
  zkEVM (388), Aurora (1313161554), Moonriver (1285),
  Bitlayer (200901), TAC (239). The recurring trap, recorded
  per chain in CHAINS.md: five of them (Kaia, Kava, Aurora,
  Moonriver, TAC) appear in OpenOcean's token LIST while its
  /swap refuses every build — a token list is not a route,
  and presence was never gated on it. Stable pins only where
  a canonical dollar verifies without a rail: Kava pins
  Tether's canonical USDt; Aurora pins the Rainbow-bridge
  USDC/USDT; Cronos zkEVM pins NOTHING (Circle's "Cronos"
  USDC is chain 25, not 388); Moonriver pins nothing (its
  traded dollars are defunct-Multichain bridged forms —
  native MOVR only, the value caveat stated in CHAINS.md).
  **Re-probe trigger for each:** any rail Fluid runs (Relay,
  Across, Mayan, 1Click, OpenOcean, Satora, Skip) quoting
  the chain with capture, re-verified live.
- **Held out entirely (4) — NO-RAIL, not admitted:** Story
  (1514), Oasis Sapphire (42262), Conflux eSpace (1030),
  Bittensor-EVM (964). Absent from every rail probed AND
  their canonical public RPCs never answered from this
  network (multi-endpoint timeouts), so even presence is
  unverified from here. **Re-probe trigger:** a clean-network
  pass that (a) reads the chain id from a canonical RPC and
  (b) finds any quotable rail; neither alone admits.
- **Liquid Network — NO-RAIL for this batch, separate
  future probe.** Liquid is not an EVM chain (Elements /
  Bitcoin sidechain: L-BTC, issued assets, its own address
  and transaction grammar), so the EVM table cannot carry
  it. The one candidate door (Boltz submarine swaps) was
  unreachable from this VM (HTTP 000 ×5), so its capture is
  UNVERIFIED, not absent. **Re-probe trigger:** a
  clean-network Boltz pass proving L-BTC ↔ BTC/Lightning
  quotes AND the referral/capture terms, judged then as its
  own family slice (like Zcash/Dash), never as a table row.
- **Unproven, named:** funded OpenOcean settlement on 30/14
  (same status as the gap-#5 chains), and every presence
  chain's funded send — the construction and read layers are
  what this batch proves.

## Tezos + Hedera — presence only, no rail (audit gap #16, 2026-11-16)

Both families ship hold / receive / send with swaps as an
honest no-route: every rail Fluid runs was probed during
research (Relay, Across, 1Click, Satora, OpenOcean) and
none serves either chain; the on-chain DEXes that exist
(3route / QuipuSwap on Tezos) expose no integrator fee, so
capture is NONE and no route is offered. The swap sheet
lists both families deliberately (the gap #12 lesson): the
dispatcher resolves their pairs to zero routes and the
diagnosis reads "isn't connected yet" for the native asset
and "no market" for a token with no answered market probe —
suite §137 pins both through `getSwapRoutes` with the
sheet's exact args shape. **Re-probe trigger:** any rail
quoting either chain with capture, re-verified live; for
Hedera the one named candidate is Squid/Axelar, whose API
is keyed (401 without a real integrator id), so its capture
is UNVERIFIED, not absent.

- **Tezos.** Derivation SLIP-0010 Ed25519
  `m/44'/1729'/0'/0'` → tz1 (research-proven byte-identical
  two ways and against mainnet state; @scure/bip32's
  secp256k1 default at the same path yields a silently
  wrong tz1 — suite-pinned against). Reads via TzKT
  (keyless, CORS `*`); broadcast is forge/sign/inject on
  the public octez RPCs. The injection POST was
  environment-blocked from the build VM — the standard path
  is built; a walk that cannot prove injection from here
  adjudicates as named-environment, not a client defect.
  Dollar: Tether USDt FA2 `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o`
  token id 0, pinned by contract; at least eight same-name
  copycats exist (one named in the suite) and none is ever
  offered. No Circle USDC exists on Tezos L1. Sender-side
  facts priced into the confirmation copy: the 0.06425 XTZ
  allocation burn on a first send to a fresh tz1
  (250 mutez/byte × 257 bytes, protocol constants) and the
  one-time reveal before the account's first outbound op.
- **Hedera.** ECDSA-first (coin type 3030,
  `m/44'/3030'/0'/0'/0'`): the EVM-address alias IS the
  receive target — ed25519 key aliases are NOT resolvable
  on the public mirror (HTTP 400 in every form), so receive
  is never built on them. Hollow-account model: no account
  number can be derived offline and none is needed; the
  first inbound HBAR or token transfer auto-creates the
  account with the creation fee charged to the SENDER and
  unlimited auto-associations (HIP-32/542/904), and the
  account self-completes on its first signed send
  (HIP-583). Reads via the public mirror REST (keyless,
  CORS `*`, documented 50 req/s/IP). Sends ride the Hashio
  JSON-RPC relay as legacy Ethereum transactions (native
  HAPI is gRPC — not browser-feasible); Hashio was
  environment-blocked from the build VM, so the relay path
  is built to the research spec and an unreachable relay
  refuses with that named plainly — no unprobed fallback
  exists. Dollar: Circle USDC `0.0.456858` only. **"USDT"
  `0.0.1055472` (USDT[hts]) is NEVER pinned: it is
  Hashport-bridged stock, Hashport was decommissioned on
  2026-05-31, and the stock is permanently unredeemable** —
  a held balance still shows as an unverified row (a held
  balance is never hidden), never as a dollar.
- **Unproven, named:** funded sends on both chains (Tezos
  injection and the Hashio relay were both unreachable from
  the build VM); the construction, signing and read layers
  are what this slice proves, all suite-pinned (§137).
