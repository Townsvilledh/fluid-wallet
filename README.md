# 💧 Fluid

**Every chain. One wallet. Yours alone.**

Fluid is a global, open-source, **non-custodial** wallet and one-stop shop for blockchain: EVM chains & L2s, Bitcoin, Lightning, Solana, Tron, Sui and more — all from a single seed phrase — with global buy/cash-out routing and **Fluid usernames** people can send to instead of long addresses. No company accounts, no forms, no servers. If Fluid disappears tomorrow, your funds don't: your seed phrase works in any BIP39 wallet.

**🤖 Fluid is an agent wallet.** Any AI agent can create a wallet **for its user** — the seed is shown to the user and never retained by the agent, the user sets the password, and the agent keeps no spending power — or hold a wallet **of its own**, operating inside deployer-set spending caps and allowlists with human approval above thresholds and a kill path. Start at [`docs/AGENT-KIT.md`](docs/AGENT-KIT.md) or the machine-readable manifest: https://fluidwallet.dpdns.org/.well-known/fluid-agent.json

**Live:** https://fluidwallet.dpdns.org/

## Features

- **Create or import** a wallet with a standard BIP39 seed phrase (12 words) — and pick your **Fluid username** at creation: people send to your name on every chain, verified live in the public registry before creation counts as complete (`names.README.md`)
- **Encrypted on-device vault** — the standard Ethereum keystore format (scrypt + AES), password-protected, stored only in your browser. Keys never leave your device unencrypted
- **15 EVM networks, one address** — Ethereum, BNB Chain, Base, Arbitrum, OP Mainnet, Polygon, Avalanche, zkSync Era, Linea, Scroll, Mantle, Gnosis, Celo, Fuse, plus Sepolia testnet — and router-supported networks (e.g. Arc) discovered automatically
- **Bitcoin from the same seed** — BIP84 native SegWit **and** BIP86 Taproot accounts, balances, receive QRs, signed sends
- **Lightning** — Fluid runs its own in-browser Lightning node (LDK) from the same seed: pay invoices, receive, and open channels — self-custody, no custodian anywhere
- **Solana, Tron, Sui** with full send/receive and swap routing; **Litecoin, Dogecoin, Bitcoin Cash**, seven **Cosmos** networks, **Stellar, TON, NEAR, Algorand, XRPL, Polkadot, Aptos, Stacks** — every chain ships full function (see `docs/CHAINS.md`)
- **Swaps across chains** composed from live rails — Relay, Across, Jupiter, Mayan, LI.FI, and Satora (EVM stables → Lightning/Bitcoin) — with the total route cost and Fluid's fee shown as separate plain lines before you sign. Fluid's fee follows a published law: a small multiple of the route's own cost, capped at 0.5% and by per-ecosystem ceilings; **sends and receives are always free** (`docs/SWAPS.md`, `docs/FEES.md`)
- **Send to an address or a Fluid username**, with a human-readable confirmation — "Send 0.05 BNB to 0x… on BNB Chain. Network fee about 0.000105 BNB. Confirm?" — never a blind hex blob; token approvals are exact-amount only
- **Global buy & cash-out** behind three bars — a per-corridor price bar, a fee-capture gate (no route is wired that can never pay its way), and no platform-account life: Mt Pelerin (50 countries) is wired today; corridors with no honest route show an honest empty state, never a bad deal (`docs/RAMPS.md`)
- **WalletConnect v2** — paste a pairing URI and use dapps, every request in plain language first (`docs/WALLETCONNECT.md`)
- **Scan** — look up any Fluid name or address and see what's public on-chain for it (`docs/SCAN.md`)
- **🤖 Agentic wallets** — two modes: owner-assisted (derived account + `window.FluidAgent` intent API; owner approves, wallet signs) and **fully autonomous** (`agent/fluid-agent.mjs` — the agent generates its own seed and wallet with zero human steps, claims its own Fluid name, and signs within its caps). See `docs/AGENT-KIT.md` and `docs/AGENTIC.md`
- **Backup** as a downloadable encrypted keystore file; seed reveal is password-gated
- **Recovery tool included** (`tools/recovery.html`) — split your seed 2-of-4 (Shamir) across device / cloud / guardian / email, and recover from any 2, fully offline
- **⚽ OGO ERA** — the game universe whose rewards (RAIN) and soulbound Companion are designed to live in this wallet. **Parked**: only the bible exists today; the build starts once the wallet settles. See `docs/OGO-ERA.md`

## Documentation

**[docs/README.md](docs/README.md)** — the index: one hop to every aspect (chains, swaps, ramps, names, Lightning, WalletConnect, Scan, security & recovery, fees, the agent kit).

## Quick start

### Option A — zero install
Open https://fluidwallet.dpdns.org/ — or download the built app from `dist/` and open it locally. For real use, save it and open it **offline**.

### Option B — developers
```bash
npm install
npm test        # the full suite (1,500+ checks: keystore round-trip, known-vector addresses, fee law, name-claim states…)
npm run build   # → dist/index.html + app.bundle.js + fluid-wallet.html
npm run serve   # local preview
```

## How it works

```
[ Fluid UI ] ──creates unsigned tx──► [ Review screen: plain-English intent ]
                                              │ you confirm
[ Your keys ] ◄── encrypted keystore (your password, this device only)
```

- All cryptography comes from **ethers.js v6** (audited, widely used). Fluid adds UI, routing and guard-rails — not home-grown crypto.
- Balances and broadcasts go through public RPC endpoints; swap the URLs in `src/wallet-core.js` for your own node anytime.
- Cash-out uses the **corridor gate** principle: a provider is only offered when its payout rail for that country is verified *and* it passes the price and capture bars. "Supports NGN" is not the same as "pays a Nigerian bank account" — see `docs/RAMPS.md`.

## Project layout

```
src/wallet-core.js   networks, vault (create/import/unlock), names, fees, routing core
src/families-*.js    the non-EVM chain families (Bitcoin, Solana, Tron, Sui, Cosmos…)
src/app.js           browser UI wiring
src/index.html       the app shell
agent/fluid-agent.mjs  the autonomous agent runtime (own seed, caps, claimName)
test/                the test suite (test/*.test.mjs)
tools/recovery.html  offline 2-of-4 Shamir recovery tool
contracts/companion.move   Sui soulbound Companion NFT (OGO ERA, parked)
docs/                documentation — start at docs/README.md
```

## Security — read this

- **Unaudited prototype.** The underlying library (ethers) is audited; this app is not. Start with small amounts. Full model: `docs/SECURITY.md`.
- Your password encrypts the wallet **on this device only**. A weak password on a stolen device is the weakest link — use a strong one.
- Your **seed phrase is the wallet**. Anyone with it owns the funds. Fluid cannot recover it, freeze it, or reverse a transaction. That's the point — and the responsibility.
- Always verify you're running the real build: build from source, or check this repo's releases. Never type a seed into a random website copy of any wallet.

## Roadmap

1. ✅ Recovery core (2-of-4 Shamir, offline, tested)
2. ✅ Wallet — every chain family full function, names, swaps, Lightning node
3. ✅ Agent kit — manifest, kit doc, agent-owned `claimName`, claim durability
4. ⏭️ In-Fluid micro cash-out (Gateway) and Peer Cash — see `docs/RAMPS.md` "In build"
5. ⏭️ OGO ERA game build + RAIN claims (parked until the wallet settles)
6. ⏭️ Native app with biometric-gated signer

## Why open source?

A non-custodial wallet you can't inspect is just a promise. Fluid is MIT-licensed: fork it, audit it, ship your own. No forms.

## License

MIT — see `LICENSE`.
