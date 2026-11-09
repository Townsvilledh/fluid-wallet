# Fluid documentation index

One hop to every aspect of Fluid. If a document describes something as
planned or parked, it is **not** live — the live app is the truth, and
each doc says plainly where its feature stands.

## Using Fluid

| Aspect | Document |
|---|---|
| Getting started, creating or importing a wallet | [README.md](../README.md) (Quick start) |
| Chains & tokens, send & receive | [docs/CHAINS.md](CHAINS.md) |
| Swaps & routing | [docs/SWAPS.md](SWAPS.md) |
| Buy & sell (fiat ramps) | [docs/RAMPS.md](RAMPS.md) |
| Fluid names (usernames) | [names.README.md](../names.README.md) — the registry; claim protocol in [docs/AGENT-KIT.md](AGENT-KIT.md) |
| Lightning | [docs/LIGHTNING.md](LIGHTNING.md) (build record + current limits) |
| Bitcoin (SegWit + Taproot) | [docs/BITCOIN-NATIVE.md](BITCOIN-NATIVE.md) |
| WalletConnect | [docs/WALLETCONNECT.md](WALLETCONNECT.md) |
| Scan (look up a name or address) | [docs/SCAN.md](SCAN.md) |
| Recovery & the security model | [docs/SECURITY.md](SECURITY.md) + the offline tool `tools/recovery.html` |
| Fees — the fee law, the 60/40 split, DripBot | [docs/FEES.md](FEES.md), [docs/DRIPBOT.md](DRIPBOT.md) |

## For agents

| Aspect | Document |
|---|---|
| **Agent kit** — create a wallet for your user, or hold your own | [docs/AGENT-KIT.md](AGENT-KIT.md) |
| Machine-readable manifest | https://fluidwallet.dpdns.org/.well-known/fluid-agent.json (mirror: https://fluidwallet.dpdns.org/fluid-agent.json) |
| Agentic wallets — design record | [docs/AGENTIC.md](AGENTIC.md) |

## Project & operations

| Document | Status |
|---|---|
| [docs/PUBLISHING.md](PUBLISHING.md) | How releases ship (single-commit, hash-checked) — current |
| [docs/OGO-ERA.md](OGO-ERA.md) | The OGO ERA game bible — **parked**: no playable build yet; starts after the wallet settles |
| [docs/GO-LIVE.md](GO-LIVE.md) | Historical checklist (2026-11-05/08) — the entity/KYB path it describes is **ruled out**; Fluid stays entity-free by the owner's standing rule |
| [docs/DOMAIN.md](DOMAIN.md) | Historical record — the live front door is **fluidwallet.dpdns.org**; the is-a.dev plan in that file was superseded (the `fluid.is-a.dev` suffix survives only as the Fluid-names display domain) |
| [docs/ROADMAP.md](ROADMAP.md) | Historical (2026-11-05) — superseded by the shipped app and the docs above |

Fluid is an unaudited open-source prototype (MIT). Use small amounts.
