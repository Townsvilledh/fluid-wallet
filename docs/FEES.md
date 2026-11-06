# Fluid fees — cheapest route for users, 60/40 split settled in BTC Lightning

## Principle 1: cheapest route for the user, always
Fluid routes, it does not sell. For every deposit/withdrawal the wallet
ranks providers by their documented typical fees and puts the cheapest
first (the ramp sheet shows a CHEAPEST badge; the provider still shows
the final live quote before the user pays). Current typical-fee order
for African local-currency corridors: Fonbnk (flat ~$0.12 documented
fee) → Ramp Network → Transak → MoonPay. When free-tier live quote APIs
become available to the project, ranking switches from typical fees to
live quotes automatically — the ranking function (`rankRoutes`) is the
single place that changes.

## Principle 2: Fluid's own fees split 60/40 — all settled in BTC over Lightning
Where Fluid itself charges a fee, the fee is split:
- **60% → Ethuram (treasury)**
- **40% → DripBot** (X: @bitcoinornatin)

**All settlement is in Bitcoin over the Lightning Network.** Fees may be
*collected* wherever the flow lives (RAIN token on Arc, game currency,
future swap fees), but they are *settled* the same way every time:
accrued fees are swept, converted to BTC, and paid out to the two
Lightning addresses in the `FEE_SPLIT` config (`src/wallet-core.js`).
Lightning addresses: **to be provided** (treasury + DripBot).
DripBot's 40% is not profit it keeps — it funds the weekly follower
drip and the OGO ERA player pools; see `docs/DRIPBOT.md`. The split
math (`splitFee`, remainder to treasury) is unit-tested and does not
depend on the addresses being set.

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
3. **Future in-app swaps:** same rule when they land.

## What Fluid never does
- No fee on plain sends/receives of your own money between your keys.
- No hidden spread on ramps: providers pay referral or not, the user
  always sees the provider's own quote; ranking is by user cost only.
