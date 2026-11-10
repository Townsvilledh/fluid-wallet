# Fluid fees — cheapest route for users, 60/40 split settled in BTC Lightning

## Principle 1: cheapest route for the user, always
Fluid routes, it does not sell. For every deposit/withdrawal the wallet
ranks providers by user cost and puts the cheapest first (the ramp
sheet shows a CHEAPEST badge on buys; the provider still shows
the final live quote before the user pays). Which routes are wired at
all is governed by the bars in `docs/RAMPS.md` — a per-corridor price
bar, the capture gate (a route that can never carry Fluid's fee is
removed, not subsidised), and no platform-account life. One African
off-ramp's history is the worked example: pulled 2026-11-08 when it
paid nothing collectable, restored 2026-11-09 as a SELL route under
the capture gate's own-charge clause with the disclosure line on
every row, then removed in full 2026-11-10 on the owner's order.
The current wired set lives in `docs/RAMPS.md`.

## Principle 2: Fluid's own fees split 60/40 — all settled in BTC over Lightning
Where Fluid itself charges a fee, the fee is split:
- **60% → Ethuram (treasury)**
- **40% → DripBot** (X: @bitcoinornatin)

**All settlement is in Bitcoin over the Lightning Network.** Fees may be
*collected* wherever the flow lives (RAIN token on Arc, game currency,
swap fees), but they are *settled* the same way every time:
accrued fees are swept, converted to BTC, and paid out to the two
Fluid usernames in the `FEE_SPLIT` config (`src/wallet-core.js`) —
**ethuram** and **dripbot** — resolved to addresses through the Fluid
Names registry (`names.json`) at settlement time (`feeLegTargets()`);
a registry entry's `ln` field is that leg's Lightning destination
when present.

**The $2 rule (Ethuram, 2026-11-06):** fee profit never sits idle in
chain assets (BNB, USDT, …). Whenever accumulated unsettled fees across
ALL chains combined reach **$2**, the whole pot is converted to BTC on
the Lightning Network via the easiest trade with the cheapest fee, and
split 60/40 in the same run (`FEE_SETTLEMENT` + `feeSettlementDue()` in
the wallet core). This repeats at every $2 mark — small, frequent,
automatic. The 40% lands in the Drip Wallet (autonomous agent wallet,
EVM `0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B`, BTC
`bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn`, paired with
@bitcoinornatin), from where the weekly drip distributes it.
No external Lightning address is ever requested from anyone:
settlement resolves by Fluid username. DripBot's Lightning identity
is created and held by the keeper (DripBot's operator); Ethuram's
60% resolves by his username to his own Fluid wallet. A leg whose
registry entry has no `ln` field yet settles to its BTC/EVM address
or waits for its Lightning identity — the split math (`splitFee`,
remainder to treasury) is unit-tested and does not depend on any
address being set. DripBot's 40% is not profit it keeps — it funds
the weekly follower drip and the OGO ERA player pools; see
`docs/DRIPBOT.md`.

## Where fees apply
1. **RAIN claims (wallet — designed, not yet live; RAIN is parked with OGO ERA):** `contracts/rain-distributor.sol` takes
   `feeBps` at deploy and accounts the fee 60/40 on-chain
   (`feeTreasury` / `feeDripbot` counters) so the split can never be
   skewed; the keeper sweeps and settles in BTC via Lightning.
2. **OGO ERA (game — designed, not yet live; the game is parked):** the game has its OWN fee split (set 2026-11-06),
   deliberately player-first — most of the game's fees go back to
   players, all settled in BTC over Lightning:
   - **40% → Ethuram (treasury)**
   - **20% → Top-100 pool** (leaderboard players)
   - **20% → Session lottery** (drawn among the other active players
     in that session)
   - **20% → Weekly active-referral rewards**
   Implemented as `GAME_FEE_SPLIT` + `splitGameFee` in the wallet core.
   Who qualifies (top-100 standings, lottery draw, referral tally) is
   computed by the keeper (DripBot) from the game's published activity
   data; the percentages and settlement rail are fixed here.
3. **In-app swaps (the standard fee):** swaps and in-app conversions
   carry Fluid's platform fee under the **fee law** (owner's model,
   2026-11-08): `fee = min(multiplier × the route's own cost, 0.5% of
   the amount, ecosystem ceiling − route cost)`, floored at 0.
   Multipliers: **4× on EVM, 5× elsewhere**. Ceilings on the user's
   TOTAL cost (route + fee): **EVM $0.20 · Bitcoin $1.50 · Lightning
   $0.30 · Solana exits $0.30**. The old flat 0.5%
   (`PLATFORM_FEE_BPS = 50` in the wallet core, set by Ethuram
   2026-11-06) survives only as the hard cap the markup can never
   cross. The review sheet discloses the route's own cost ("route
   cost ≈ $X") and Fluid's fee as separate lines — computed from the
   quote's actual amounts, never hidden in a spread. Plain
   sends/receives never carry it. (The route-cost measure behind
   that label was corrected in the 2026-11-10 audit fix batch: cost
   is now the fair-value shortfall between the two sides, with
   declared router components kept only as a fallback.) Collection rides each router's native
   mechanism into the DripBot agent wallet — Relay App Fees, LI.FI's
   integrator fee, Satora's developer markup, Jupiter/Mayan fee
   accounts. LI.FI pays
   integrator fees only to a wallet configured in its Partner Portal.
   That registration was completed on 2026-11-07 (integrator
   `fluid-wallet`, DripBot agent wallet as Default EVM fee wallet) and
   collection is ON (`PLATFORM_FEE_COLLECTION_ENABLED = true`). The
   per-family audit (`SWAP_FEE_COVERAGE` in the wallet core, pinned
   by tests) records the remaining gaps: EVM-sourced swaps collect
   live; Solana-sourced swaps collect too (the portal's Default SVM
   fee wallet was set to the DripBot agent wallet's Solana address on
   2026-11-07); Tron- and Sui-sourced swaps execute since their LI.FI
   step signers landed on 2026-11-07 and collect too: the agent
   wallet's Tron and Sui addresses (derived from its keystore and
   recorded as the coverage rows' destinations) were registered as
   the portal's Default Tron / Sui fee wallets on 2026-11-07, and the
   two coverage rows were flipped to collecting in the same build.
   Before that registration the fee could not be attached to Tron/Sui
   requests at all: LI.FI rejects fee-bearing requests on chains with
   no configured fee wallet (HTTP 400, code 1011 — verified live on
   2026-11-07), so those swaps executed fee-free rather than failing.
   The request builders gate the fee per source chain
   (`swapFeeCollectingChain`).
   Every other chain family (Bitcoin, Litecoin, Dogecoin, Bitcoin
   Cash, Cosmos, TON, NEAR, XRP, Stellar, Algorand, Polkadot, Aptos,
   Stacks, Lightning) has no swap route at all — sends/receives only.
4. **Cash-out deposit sales (shipped 2026-11-10):** when a user
   finishes a ramp provider's own sale steps and sends the quoted
   amount to the provider's deposit address from a Fluid send sheet,
   they can declare the send a cash-out. Fluid then composes its own
   fee into the sale — sized by the same fee law as swaps, from the
   route cost the user declares (the provider's payout against the
   amount sent, plus network cost) — and the review sentence states
   every figure before anything is signed. The provider always
   receives its full quoted amount; the fee is a separate, disclosed
   amount on top, paid to the DripBot collection wallet (the 60/40
   settlement split applies as usual). Composition is atomic where
   the chain allows it — one Permit2 batch authorisation on EVM for
   listed ERC-20 tokens, one transaction with two transfers on
   Solana — and sequential where it does not (EVM native coins and
   unlisted tokens, Tron): the provider's amount moves first, and
   the fee is sent only after the user confirms the provider
   completed the sale, so a failed sale never costs the fee. Two
   honesty gates ride on top of the fee law: a composition is only
   used when the fee clears twice its own execution cost, and when
   no lawful fee clears its collection cost — small sales, Tron
   sales under the law's total ceiling, sales whose payout the user
   does not declare — the sale simply sends with the fee printed as
   $0. If a provider later refunds a sale whose fee already settled,
   the order record lands on a fee-return state and the fee comes
   back to the user's address automatically. Plain sends are never
   affected: the declaration is off by default, and an undeclared
   send carries no fee, ever.

## Ramp referrals
- Mt Pelerin: every buy/sell link carries the owner's referral code
  (`rfr`, single-source `MTPELERIN_REFERRAL_CODE` in
  src/wallet-core.js, wired 2026-11-07). Mt Pelerin pays 25% of the
  fees it charges referred users out of its own cut, monthly in USDC
  on Polygon to the address registered in the owner's Bridge Wallet.
  The user's price is unchanged.

## What Fluid never does
- No fee on plain sends/receives of your own money between your keys.
- No hidden spread on ramps: providers pay referral or not, the user
  always sees the provider's own quote; ranking is by user cost only.
