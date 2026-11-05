# OGO ERA — the game inside Fluid

OGO ERA is not a side feature. It is Fluid's distribution engine: a
phone-first street-football game (Lagos pitch energy, global players)
that brings people into self-custody through play, not paperwork.

## The loop
1. **Play** — short street-football matches, designed for low-end phones.
2. **Companion** — every player has a soulbound Companion NFT (Sui Move,
   `contracts/companion.move` in this repo): `key`-only, so it can never
   be sold or transferred. Match stats level it up. It is the player's
   identity in the game.
3. **RAIN** — match rewards, tournament drops and community events accrue
   as RAIN. Distribution uses signed Merkle drops: the game publishes a
   root, the player claims with a proof straight from the Fluid wallet.
   Fluid never custodies unclaimed rewards, and claims work even if the
   game servers disappear.
4. **Real money rails** — RAIN lands in the same wallet as the player's
   BTC, ETH and stablecoins (15 EVM chains + Bitcoin + Lightning), and
   can be sent anywhere or cashed out to banks in 180+ countries through
   the wallet's ramp routing.

## Why wallet-first
The wallet, recovery tool (2-of-4 Shamir) and Companion contract were
built before the game on purpose: the day OGO ERA launches, claiming
must already be boring and safe. The Play tab in the wallet is the
game's home screen — status, how-it-works and launch notification live
there now.

## Roadmap
- [x] Fluid wallet v2 with Play tab (this repo)
- [x] Companion contract (Sui Move, soulbound) — written, needs testnet deploy
- [ ] RAIN Merkle-claim contract + claim button in the Play tab
- [ ] Companion mint on first game login (Sui testnet → mainnet)
- [ ] OGO ERA playable prototype (match engine + Companion stats sync)
- [ ] UBI hub alongside: GoodDollar / World / Circles claims in-wallet

## Design rules (from the Fluid spec, unchanged)
- The game never holds player funds; rewards are claimable proofs.
- AI advises, never signs. The human approves a sentence, not a hex blob.
- If Fluid the company dies, players keep everything: wallet, Companion,
  unclaimed RAIN proofs.
