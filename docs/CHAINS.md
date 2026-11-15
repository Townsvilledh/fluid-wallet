# Chains, tokens, send & receive

One seed phrase derives every chain below. The same EVM address works on
every EVM network; each other family derives its own address from the
same seed. Everything listed here **ships**: balance, receive and send.

## Chain families

- **EVM — 20 built-in networks:** Ethereum, BNB Chain, Base, Arbitrum,
  OP Mainnet, Polygon, Avalanche, zkSync Era, Linea, Scroll, Mantle,
  Gnosis, Celo, Fuse, B² Network, Sei EVM, Injective EVM, HyperEVM,
  Robinhood Chain, and Sepolia (testnet). Networks the swap routers support beyond
  the built-ins (for example **Arc**, chain 5042) are discovered and
  added automatically after unlock. Sei EVM (chain 1329) is where SEI lives
  now — Sei's Cosmos network is retired (see Cosmos below).
  Injective EVM (chain 1776) is Injective's second face: its balance
  is unified with the Cosmos side (one account, one ledger — INJ or
  USDC landed on either face is already on both, and the wallet
  counts it once). HyperEVM (chain 999, HYPE) is hand-verified
  rather than discovered: the public registries still carry the
  id's previous occupant, so discovery cannot admit it — see
  `docs/SWAPS.md`. Robinhood Chain (chain 4663, ETH) is a built-in
  as canonicalisation: discovery admitted it, but only the built-in
  carries its RPC rotation, its token list, and its stable — USDG,
  because USDC and USDT do not exist on that chain at all (any
  "USDC" there is an impostor) — see `docs/SWAPS.md`.
- **Bitcoin** — BIP84 native SegWit (bc1q…) and BIP86 Taproot (bc1p…).
  See `docs/BITCOIN-NATIVE.md`.
- **Lightning** — Fluid's own in-browser node (LDK) from the same seed.
  See `docs/LIGHTNING.md`.
- **Solana, Tron, Sui** — full send/receive plus swap routing.
- **Litecoin, Dogecoin, Bitcoin Cash** — UTXO family, full function.
- **Zcash** — transparent only (t1/t3): derive, hold, receive and
  send from the same phrase (BIP44 coin 133). Sends are v5
  transactions (ZIP 225/244/317) built and signed on-device;
  shielded and unified addresses are not supported yet and are
  refused honestly. Reads ride Blockchair's dashboard (a failed
  read is "couldn't load", never a fake zero). ZEC is a 1Click
  swap family both directions — see `docs/SWAPS.md` (gap #8).
- **Dash** — UTXO family, full function (BIP44 coin 5, legacy
  P2PKH on the Dogecoin builder machinery; BlockCypher reads
  with a Blockchair fallback). DASH is a 1Click swap family;
  swaps INTO Dash currently have no liquidity above ~$1 and
  present as no-route — see `docs/SWAPS.md` (gap #8).
- **Cosmos** — seven networks. Sei's entry is the retired Cosmos
  form, labelled **legacy** everywhere it renders (home row, chain
  sheet, receive): SIP-3 shut its Cosmos side down (IBC closed in
  2026) and SEI now lives on Sei EVM. Its reads still answer and
  sends still run while the chain does, but nothing new arrives
  there.
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
  longer darks the family. (Sei's entry in that list is its
  retired Cosmos network, kept readable under its legacy label.)
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

### The balance cache contract

The on-device balance cache (`fluid_balcache_v2`) is a
paint-early layer, and it holds **only proven states**. Three
rules govern it:

1. **Provenance.** A number — zero included — enters the cache
   only from a successful live read in the current session. The
   app tracks this per family (`liveOkFams`), and per account
   for Bitcoin's two accounts (SegWit and Taproot settle
   independently; each account's scalar is written only when
   that account's read succeeded). A failed or never-completed
   read writes nothing. Per-row unknowns inside a *successful*
   read (a Cosmos chain that stayed dark, a TON jetton scan that
   failed) are part of that read's proven result and persist as
   `null` rows, exactly as read.
2. **Finality.** A family's cache entry is replaced only by
   that family's settled live state — after any endpoint
   rotation/fallback rescue inside the read, and, for EVM,
   after late-read adoption (a read rescued inside the 120 s
   adoption window is marked proven at adoption, and its settle
   paint persists it). A persist fired mid-scan snapshots only
   families already settled with proven state; a family whose
   read lands later writes at its own settle paint (the
   throttle yields to a fresh proven settle), so no
   intermediate snapshot is ever the only record.
3. **Paint fidelity.** Hydration renders persisted entries
   exactly as stored: rows verbatim, scalars only when they are
   finite numbers (never coerced — `Number(null)` is 0, and a
   coerced unknown is a fake zero), and Bitcoin's two account
   scalars together or not at all, so a one-sided cache never
   presents a partial sum as the BTC balance.

**What a failed scan does to a previously-good cached value:
nothing.** The failure is rendered live in-session — the rows
switch to "couldn't load" over the cache paint, the header
carries the marker, and the hero total excludes the failed
family (the scalar rule covers BTC, LTC, DOGE and BCH alike) —
but it is never written back. The next open therefore paints
the last *proven* state, marked "Updating…", and the new scan
replaces it or fails over it honestly. The reason: a failed
read produces no information about a balance, so it must not
manufacture cache content in either direction — neither a
number it never measured, nor the erasure of the last measured
truth. Both failure directions shipped before this contract
was stated (2026-11-14): a failed Bitcoin Cash read persisted
the balance global's initialiser `0`, which the next open
painted as a measured zero for ~30 s; and failed re-scans
persisted their couldn't-load rows over rotation-rescued
proven values, so re-opens repainted rescued families as
"couldn't load" although their last settled state was a proven
zero. The cache is also written under the wallet's own address
key and holds public balance data only — no keys or seed
material ever enter it.

**One-time reset on upgrade.** The contract above governs what
the cache writes *now* — it cannot retroactively judge entries
written by earlier builds. Before the honesty fix, the persist
path could manufacture values: a failed Bitcoin Cash scan
persisted the balance global's initialiser `0`, and a Bitcoin
persist fired mid-scan could snapshot one account's settled
value beside the other's unsettled one. Stored, those values
are indistinguishable from proven ones — and because a failed
scan now writes nothing, a poisoned entry would have kept
re-painting on every open until a read happened to succeed.
So the first run of the fixed build drops the entire legacy
store (`fluid_balcache_v1`) unread, and the cache key and
envelope version moved to v2 together, so a pre-fix payload is
rejected even if it somehow lands under the new key. The reset
happens once; no other store (vault, names, approvals, history,
settings) is touched. Every wallet's first open after the
upgrade is therefore a cold start — rows show loading, then
settle to proven values or "couldn't load", never a number
without a read — and the cache rebuilds from proven reads only.

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
