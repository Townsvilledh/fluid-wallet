# ⚽ Fluid

**Your money, only you control.**

Fluid is a simple, seamless, open-source, **non-custodial** Web3 wallet. No company, no accounts, no forms, no servers — just software and routes. If Fluid disappears tomorrow, your funds don't: your seed phrase works in any BIP39 wallet.

Built for Nigeria first (cash out straight to a Nigerian bank), usable anywhere.

## Features

- **Create or import** a wallet with a standard BIP39 seed phrase (12 words)
- **Encrypted on-device vault** — the standard Ethereum keystore format (scrypt + AES), password-protected, stored only in your browser. Keys never leave your device unencrypted
- **6 networks, one address** — Ethereum, BNB Chain, Base, Polygon, Arbitrum, plus Sepolia testnet for safe practice
- **Balances** for the native coin + USDC + USDT on every mainnet
- **Send with a human-readable confirmation** — "Send 0.05 BNB to 0x… on BNB Chain. Network fee about 0.000105 BNB. Confirm?" — never a blind hex blob
- **Receive** by address or QR code
- **Cash out to a Nigerian bank** via Fonbnk's consumer widget (you verify with Fonbnk; they pay your bank directly; Fluid never touches fiat and needs no partner agreement)
- **Backup** as a downloadable encrypted keystore file; seed reveal is password-gated
- **Recovery tool included** (`tools/recovery.html`) — split your seed 2-of-4 (Shamir) across device / cloud / guardian / email, and recover from any 2, fully offline

## Quick start

### Option A — zero install
Download `fluid-wallet.html` from `dist/` (or build it) and open it in any browser. It's one self-contained file (~412 KB). For real use, save it and open it **offline**.

### Option B — developers
```bash
npm install
npm test        # 12 core tests: keystore round-trip, known-vector address, wrong-password rejection…
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
- Balances and broadcasts go through public RPC endpoints (`publicnode.com`); swap the URLs in `src/wallet-core.js` for your own node anytime.
- Cash-out uses the **corridor gate** principle: a provider is only offered when its payout rail for that country is verified. "Supports NGN" is not the same as "pays a Nigerian bank account" — see `examples/router-v2-global.mjs`.

## Project layout

```
src/wallet-core.js   networks, vault (create/import/unlock), balances, send, cash-out link
src/app.js           browser UI wiring
src/index.html       the app shell
test/core.test.mjs   the test suite
tools/recovery.html  offline 2-of-4 Shamir recovery tool (Phase 1)
contracts/companion.move   Sui soulbound Companion NFT (OGO ERA)
examples/            router engines: local ramps mock + global aggregator with corridor gate
docs/GO-LIVE.md      what going "production" would actually require (and why personal use doesn't)
```

## Security — read this

- **Unaudited prototype.** The underlying library (ethers) is audited; this app is not. Start on Sepolia or with small amounts.
- Your password encrypts the wallet **on this device only**. A weak password on a stolen device is the weakest link — use a strong one.
- Your **seed phrase is the wallet**. Anyone with it owns the funds. Fluid cannot recover it, freeze it, or reverse a transaction. That's the point — and the responsibility.
- Always verify you're running the real build: build from source, or check this repo's releases. Never type a seed into a random website copy of any wallet.

## Roadmap

1. ✅ Recovery core (2-of-4 Shamir, offline, tested — including the bug its tests caught)
2. ✅ Wallet v1 (this repo)
3. ✅ Router v2 — global aggregators (Onramper/Meld) + Africa specialists (Fonbnk/Breet) behind a corridor gate
4. ⏭️ Companion NFT on Sui testnet (`contracts/companion.move` compiles next)
5. ⏭️ Native app with biometric-gated Rust signer
6. ⏭️ OGO ERA game hooks + RAIN earned-claim pools, UBI claim hub (GoodDollar first)

## Why open source?

A non-custodial wallet you can't inspect is just a promise. Fluid is MIT-licensed: fork it, audit it, ship your own. No forms.

## License

MIT — see `LICENSE`.
