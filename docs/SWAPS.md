# Swaps & routing

Fluid composes existing rails — there is no Fluid routing contract.
Users experience every cross-chain move as a **swap**, never a "bridge".

## How a swap is routed

Routing is pair-aware — the dispatcher considers, per pair:

- **Satora** — EVM stablecoins → Lightning and → Bitcoin mainnet
  (non-custodial HTLC swaps). Note: Satora refunds return WBTC/tBTC,
  not the deposited stablecoin — the review sheet says so before you
  sign.
- **Jupiter** — Solana same-chain swaps (direct, ~10× cheaper than
  routing Solana through a general aggregator).
- **Across** — cheapest for same-asset moves between EVM majors.
- **Relay** — the general any-asset router (Fluid's fee rides Relay's
  App Fees).
- **Mayan** — ranked in whenever its quote beats the others (Swift and
  Fast MCTP routes only).
- **LI.FI** — the long tail.

Cross-ecosystem compositions (for example Base USDC → Satora via CCTP)
are assembled client-side from these rails.

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
