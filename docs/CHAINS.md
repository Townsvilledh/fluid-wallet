# Chains, tokens, send & receive

One seed phrase derives every chain below. The same EVM address works on
every EVM network; each other family derives its own address from the
same seed. Everything listed here **ships**: balance, receive and send.

## Chain families

- **EVM — 15 built-in networks:** Ethereum, BNB Chain, Base, Arbitrum,
  OP Mainnet, Polygon, Avalanche, zkSync Era, Linea, Scroll, Mantle,
  Gnosis, Celo, Fuse, and Sepolia (testnet). Networks the swap routers
  support beyond the built-ins (for example **Arc**, chain 5042) are
  discovered and added automatically after unlock.
- **Bitcoin** — BIP84 native SegWit (bc1q…) and BIP86 Taproot (bc1p…).
  See `docs/BITCOIN-NATIVE.md`.
- **Lightning** — Fluid's own in-browser node (LDK) from the same seed.
  See `docs/LIGHTNING.md`.
- **Solana, Tron, Sui** — full send/receive plus swap routing.
- **Litecoin, Dogecoin, Bitcoin Cash** — UTXO family, full function.
- **Cosmos** — seven networks.
- **Stellar, TON, NEAR, Algorand, XRPL, Polkadot (Asset Hub), Aptos,
  Stacks** — full send/receive/balance.

## Tokens

- Native coins and the major stablecoins (USDC, USDT) are shown per
  network where they exist.
- **Any** other token the wallet holds is shown too, grouped under
  "Other tokens (N)": unverified token metadata is never rendered as
  clickable content, and a held balance is never silently shown as zero
  or hidden — a row shows a real value, a true zero, or an honest
  "couldn't load".

## How balances are read (the honesty layer)

A balance row is only ever a **real value**, a **true zero** (an
endpoint answered and the balance is zero), or **"couldn't load"**
(the read failed — the amount is unknown, shown as unknown in the
row, in the send sheet, and in the header total, which is annotated
"+ some balances couldn't load" whenever any **row** in view is in
that state — a single failed token row inside an otherwise loaded
family counts, not just whole-family failures). No reader defaults
to zero on failure; that rule was re-pinned across every family on
2026-11-14 after a post-release sweep caught five families
displaying $0.00 while their endpoints were down.

- **Endpoint rotation.** Every family's reads rotate over keyless
  public endpoints with the EVM discipline (last-good first, a
  failed endpoint demoted for 60 s): Stellar ×3 Horizons, NEAR ×5
  RPCs, Algorand ×2 AlgoNode hosts, Aptos ×2 fullnodes, Stacks ×2
  Hiro hosts. A definitive chain answer (an unfunded account's
  404, NEAR's UNKNOWN_ACCOUNT) returns at once and never rotates.
  TON is the exception: toncenter.com is the only keyless public
  endpoint that answers, so TON's protection is the honesty rule
  itself (its jetton index read rides the independent tonapi.io).
- **Cosmos** reads the cosmos.directory LCD first, then per-chain
  probed fallbacks (Polkachu for all seven; Osmosis' own LCD,
  Noble's api.noble.xyz, Injective's LCD, Sei's rest.sei-apis.com
  and dYdX's publicnode where probed) — one directory outage no
  longer darks the family.
- **EVM scans** race a 20 s settle for first paint, but the read
  keeps rotating behind it: each endpoint attempt is capped at
  30 s (a hung endpoint can no longer eat the scan), and a read
  rescued within 120 s repaints its rows in the same scan instead
  of leaving "couldn't load" standing until a manual refresh.
- **In-flight rows never show a placeholder amount.** While a
  family's live read is still running, its rows show either the
  skeleton (cold start) or the last-known cached values (a
  re-open paints the cache instantly, with "Updating…" in the
  header) — never a "0" standing in for an answer that has not
  arrived. The zero-placeholder row shapes exist only as the
  cold-start pre-read state the skeleton covers.

## Send & receive

- **Send to a raw address or a Fluid username** — every send field
  accepts both; a name resolves through the public registry
  (`names.README.md`) to the recipient's address on that chain.
- Every send is preceded by a plain-language review: *"Send 0.05 BNB to
  0x… on BNB Chain. Network fee about …"* — inspect before you sign,
  never a blind hex blob.
- Token approvals are **exact-amount only** — never unlimited.
- **Receive** by address or QR code on every family; the receive sheet
  states the network count as it actually is.
- Plain sends and receives carry **no Fluid fee** — network fees only
  (see `docs/FEES.md`).
