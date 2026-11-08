# Fluid fees — cheapest route for users, 60/40 split settled in BTC Lightning

## Principle 1: cheapest route for the user, always
Fluid routes, it does not sell. For every deposit/withdrawal the wallet
ranks providers by their documented typical fees and puts the cheapest
first (the ramp sheet shows a CHEAPEST badge; the provider still shows
the final live quote before the user pays). Current typical-fee order
for African local-currency corridors: none in the wallet right now —
Fonbnk (flat ~$0.12 documented fee) was PULLED 2026-11-08 because it
pays Fluid nothing collectable without KYB / server-side signing
(owner's rule: no pay, no route; wiring facts kept in the wallet-core
ramp notes). Older experiments ranked Ramp Network → Transak →
MoonPay. When free-tier live quote APIs
become available to the project, ranking switches from typical fees to
live quotes automatically — the ranking function (`rankRoutes`) is the
single place that changes.

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
1. **RAIN claims (wallet):** `contracts/rain-distributor.sol` takes
   `feeBps` at deploy and accounts the fee 60/40 on-chain
   (`feeTreasury` / `feeDripbot` counters) so the split can never be
   skewed; the keeper sweeps and settles in BTC via Lightning.
2. **OGO ERA (game):** the game has its OWN fee split (set 2026-11-06),
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
   carry Fluid's standard platform fee of **0.5%**
   (`PLATFORM_FEE_BPS = 50` in the wallet core, set by Ethuram
   2026-11-06), disclosed as its own clause in the swap confirmation
   sentence — computed from the quote's actual amounts, never hidden
   in a spread. Plain sends/receives never carry it. Collection rides
   LI.FI's integrator fee into the DripBot agent wallet; LI.FI pays
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
