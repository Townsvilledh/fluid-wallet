# FLUID — Corrected Build Roadmap
*For Ethuram · Started 2026-11-05 · Muse (this assistant) as builder*

Fluid = non-custodial, router-based universal wallet for Nigeria. OGO ERA (Lagos street football) is distribution. UBI claims are a feature. Gaming rewards (RAIN) are earned through play. If Fluid the company dies, users keep their funds — that is the whole design test.

## Claude's three corrections — all accepted and applied

1. **Secure Enclave / StrongBox cannot hold a BIP39 seed.** They hold non-exportable P-256 keys only.
   → Revised: seed is generated in app memory, split immediately, then zeroized (`explicit_bzero`). What lives on disk is `vault.enc`, encrypted under a Key-Encryption-Key that *is* non-exportable in the enclave and unwraps only after biometric. Docs must say honestly: "seed exists in memory only during generation/recovery, then wiped" — the same model BlueWallet-class wallets use.
2. **One password must never protect both the cloud and email shards.** Cloud + inbox + one password = full wallet, no guardian needed.
   → Revised and enforced in code: Shard B (cloud) uses Password A, Shard D (email) uses Password B. The Phase 1 tool refuses to split if A == B.
3. **Biometric-on-every-action needs a native signer, not a web app.** The offline recovery page has no biometric gate (it's an emergency tool); the real app signer is native (iOS LocalAuthentication + CryptoKit, Android BiometricPrompt + Keystore).

*Extra bug found while building Phase 1 (worth knowing):* the first Shamir implementation used GF(256) log/exp tables built from generator 3 — wrong for polynomial 0x11d (3 has order 51 there, not 255), so reconstruction silently produced garbage. The automated test caught it: 0/6 shard pairs recovered. Fixed with brute-force inverses; retested: **1,200/1,200 random-secret combinations and all 6 pairs of the test seed recover correctly.** Lesson baked into the process: no crypto ships without a round-trip test, ever.

## What's built (Phase 1 pack)

| File | What it is | Status |
|---|---|---|
| `fluid-recovery.html` | Single-file offline recovery tool: BIP39 validation w/ checksum, generate test seed, split 2-of-4, each shard encrypted separately (PBKDF2-SHA256 600k + AES-256-GCM), recover from any 2 | ✅ Built + tested in Node (Shamir 1200/1200, AES round-trip, wrong-password rejection, BIP39 vectors) |
| `companion.move` | Sui Move Companion NFT, corrected: true soulbound (`key` only, no `store`), owner-checked stat updates that don't abort on repeat, +1-only level-ups, events | ✅ Written, modern Move 2024 syntax — needs `sui move build` + testnet deploy to verify |
| `router.mjs` | Quote-engine shape with mock Busha/Mavapay/Cashramp/Kotani adapters: parallel quotes, true-cost scoring (fee + speed penalty), automatic fallback, human-readable signer intent | ✅ Runs (`node router.mjs`) |
| `router-v2-global.mjs` | Global aggregator edition: Onramper/Meld layer + Fonbnk/Breet, free quote APIs, and a corridor gate that blocks providers whose NG bank payout is unverified (MoonPay, Ramp, Transak). Prototype only — Fonbnk was PULLED from the wallet itself 2026-11-08 (no collectable programme; see the wallet-core ramp notes) | ✅ Runs (`node router-v2-global.mjs`) |
| `FLUID-ROADMAP.md` | This file | ✅ |

**Prototype limit, stated plainly:** the recovery tool uses PBKDF2 because Argon2id needs a big WASM bundle. Production must swap in Argon2id (libsodium-wasm) and get an audit before any real seed touches it. Until then: **throwaway seeds only.**

## Phased build order (realistic)

- **Phase 1 — Recovery core** ✅ (above). Next hardening: Argon2id swap, publish to GitHub + IPFS so `recover.fluid.ng` works with zero Fluid servers, weekly "company is dead" recovery drill.
- **Phase 2 — Companion on Sui testnet.** Install Sui CLI, `sui move build`, unit tests, deploy to testnet, mint from a test wallet, verify soulbound (transfer attempt must fail). Registry object for one-companion-per-wallet.
- **Phase 3 — Router, real adapters. REVISED 2026-11-05 (Ethuram's global-aggregator idea — adopted).** No longer blocked on negotiating with each Nigerian ramp:
  - **Phase 3a — Aggregator first.** One integration with **Onramper** (30+ ramps, 8 off-ramps, widget ≈ 8 lines, adds no fee on top — it earns referral fees, so its quote/widget tier is effectively free) or **Meld** (free sandbox quote API). Their local partners (Yellow Card, Wello…) settle the Naira last mile. Fluid signs one agreement instead of eight, holds no fiat licence, and never touches user money.
  - **Phase 3b — Africa specialists direct.** **Fonbnk** (documented NG off-ramp to bank + airtime, widget + signed REST API, ~$1 minimums — ideal for UBI/RAIN-sized cash-outs) — **PULLED from the wallet 2026-11-08** until it offers a programme Fluid can collect from without KYB / server-side signing (owner's rule: no pay, no route); this stays the re-add path if that changes. **Breet** (NGN/GHS API, no setup/monthly fees, KYB < 1 day) as direct fallback.
  - **Corridor gate (new, non-negotiable):** "supports NGN" ≠ "pays a Nigerian bank". Verified Nov 2026: MoonPay lists NGN for selling but its Visa Direct payout list excludes Nigeria; Ramp Network's bank payouts are mainly UK/EU; Transak's NG payout rail is unconfirmed. Those providers are blocked for NG bank cash-out in `router-v2-global.mjs` until a live sandbox quote for NG+bank succeeds. They may still serve card on-ramp.
  - **What "bypass" really means:** we bypass *negotiating* with Nigerian ramps and carrying their licences — a licensed local partner still settles the last mile (someone always must), and users do KYC inside the provider's widget, with the provider, not Fluid. Production keys still need a free partner signup + KYB of Fluid the company; sandbox needs none of that.
  - Nigerian direct ramps (Busha/Mavapay) and virtual accounts (Flutterwave/Paystack/Monnify) drop to a later optimisation — only if aggregator pricing proves uncompetitive at volume.
- **Phase 4 — Native signer + wallet app.** React Native shell + Rust core via UniFFI; enclave KEK wrapping; signer stays <1,000 lines, separate process boundary, human-readable intents only. This is the long, expensive phase — and the one that needs the Trail of Bits / OtterSec audit before launch.
- **Phase 5 — Wallet UI.** Naira-first view, fee abstraction on Arc, offline queue, <50MB.
- **Phase 6 — AI advisor.** On-device, produces *unsigned* intents only. It can never sign — enforced by architecture, not by promise.
- **Phase 7 — OGO ERA hooks + RAIN.** Merkle-root weekly pool on Arc, rotating in-game claim actions, 7-day expiry back to pool, `rains_claimed` stat to Companion.
- **Phase 8 — UBI aggregator.** GoodDollar first (easiest, works in Nigeria today), then Circles; World ID optional (Orb access is the bottleneck).

## The final test (from the spec, unchanged)

Delete Fluid's servers. Delete the app. Recover from email + cloud shards using only the offline tool. Import into BlueWallet / MetaMask / Sui Wallet. Funds still there, Companion still owned. Anything that fails this test is not Fluid — it's a custodial wallet wearing a costume.

## Figma prompt for the 5 onboarding screens (bonus, from Grok's question)

"Mobile app onboarding, 5 screens, dark navy background (#0B1220), green accent (#22C55E), friendly Lagos street-football energy, large readable type for low-end Android phones: (1) 'Welcome to Fluid. Your money, only you control.' with a big Create Wallet button and a fingerprint icon; (2) 'Add a recovery password — you'll need it if you lose your phone' with two password fields and the note 'We never see this. Write it down.'; (3) 'Add a recovery email — your escape hatch if Fluid disappears' with an email field and a Send button; (4) 'Pick a guardian — someone who can help you recover' with a contacts picker and a Skip option; (5) 'Done. You're sovereign.' with three status rows: Cloud ✓, Email ✓, Guardian ○, and a football companion character celebrating."
