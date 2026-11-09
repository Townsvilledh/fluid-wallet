# Lightning in Fluid — build record (2026-11-07)

What shipped, what was assessed, and the exact evidence. Fluid's rules
(set by the owner): pure self-custody — no custodians, no operator
co-signing (Spark was rejected on exactly this), no federation pegs
(Liquid), no mint custody (Cashu); every feature ships full function or
carries an honest blocker; official pinned dependencies only.

Design authority: `research_notes/fluid-lightning-offline-receive-20261106-2119/report.md`.
Headline of that research, unchanged by the build: **Fluid must be open
to SETTLE, not to RECEIVE.**

## Shipped

### 1. In-app LDK node (the core) — `lightning/` + `src/lightning-node.js`

A real Lightning node inside the wallet: **rust-lightning 0.2.7**
(LightningDevKit) compiled to WASM, used directly — not LDK Node,
whose async-payments surface is UniFFI-only and unreachable from
WASM. The node is seeded from the wallet's existing BIP-39 phrase:
HKDF-SHA256 over the BIP-39 seed, salt `fluid`, info
`fluid/lightning/ldk-seed/v1` (`src/ln-derive.js`, pinned byte-for-byte
in the test suite). Same phrase → same node, on any device.

- **Lazy-loaded**: the panel boots the node from a separate chunk
  (`dist/lightning.chunk.js`, ~41 KB) + the WASM binary
  (`dist/fluid_lightning_bg.wasm`, SIZE — see below) only when the
  Lightning panel opens. The main bundle did not grow.
- **Persistence**: channel manager + monitors live in the browser's
  localStorage domain under the prefix `fluidln.v1.<network>.`, every
  value AES-256-GCM-encrypted with a SEPARATE HKDF branch
  (`fluid/lightning/storage/v1`) — the storage key decrypts state
  blobs but is never channel key material. Host services (storage,
  broadcast, transport) are dumb pipes by construction: they can
  withhold service, never sign or steal.
- **Online flows**: connect to a user-chosen peer/LSP, open channel
  (funding built from the wallet's own BTC account with the standard
  review-then-broadcast-exact-bytes pattern; the funding script is
  converted to its address form by `fundingAddressFromScript`, which
  refuses non-P2WSH scripts), BOLT 11 invoice create + pay (expiry +
  amount checks from the red-team hardening intact), BOLT 12 offer
  pay, balance, payment history, close channel.
- **BOLT 11 cross-check**: the JS codec in wallet-core parses AND
  re-encodes all 7 official BOLT 11 spec test vectors byte-for-byte;
  the Rust node's invoices are verified by that independent JS codec
  (and vice versa).
- **Chain sync**: an Esplora driver (mempool.space APIs) confirms
  transactions with their real block hash + index, then moves the
  best block — the crate's documented order. Fee estimates come from
  the same API (sat/vB × 250 = sat/kwu, floored at the relay minimum).
- **Timer discipline**: the ChannelManager timer tick runs ~once a
  minute. It is a protocol input (it drives HTLC/ BOLT 12 retry
  machinery and the async-offer refresh); ticking in a tight loop
  floods the onion-message per-peer buffer (256 KB cap) and strangles
  the flows it is meant to drive. Both app and keeper use ~60 s.
- **One deliberate divergence**: `FluidMessageRouter` wraps
  `DefaultMessageRouter`. `find_path` delegates unchanged.
  `create_blinded_paths` differs in bounded ways: the default router
  only builds offer paths through peers already present in the gossip
  graph (or when the node has exactly one peer), which strands a
  light-client wallet whose graph may not contain its own LSP.
  Fluid's router builds one path per connected channel peer (max 3),
  leads with the canonical one-hop path when the recipient is itself
  a direct peer (several LDK call sites use only the first path for
  reply paths, so the first path must be deliverable by
  construction), and uses **no dummy-hop padding** — on measurement:
  a padded 4-hop path serialises to ~671 bytes, an unpadded 2-hop
  path (introduction peer → recipient) to ~369 bytes, and padding
  buys a wallet no real privacy when all its paths start at its own
  LSP anyway. Size is not cosmetic here; see the async section for
  the 1,300-byte onion budget it feeds into.
- **Node roles**: the constructor takes a role. `wallet` (the app)
  never advertises `htlc_hold` — holding someone else's HTLC is a
  promise to stay online, and a phone must not make it.
  `server` (the keeper) advertises it, and announces the channels it
  opens (`announce_for_forwarding`), like any public LSP — announced
  server↔server channels are how a payer's router learns the hops to
  a blinded-path introduction beyond its own first hop. Both roles
  set `hold_outbound_htlcs_at_next_hop` (ask our next hop to park a
  static-invoice payment) and `accept_forwards_to_priv_channels`
  (BOLT 12 blinded paths exist to deliver over private channels; the
  blinding, not a refusal, is the privacy mechanism).

### 2. BOLT 12 async receive (offline receive)

While online, the wallet registers blinded paths with its
static-invoice server (SIS — the user's channel peer/LSP) and builds a
signed static invoice; the reusable **offer** is displayed with QR +
copy in the panel and in the Receive sheet. Payments to the offer
while Fluid is closed are HELD by the SIS as held HTLCs / held onion
messages. On next open, Fluid reconnects, the held payment is
released, and it settles — surfaced in the panel's event feed and
payment history.

The promise shown to the user, verbatim (from `holdWindowCopy`):

> Payments sent to this offer while Fluid is closed can wait up to 24
> hours for you to open Fluid. The peer holding them cannot take or
> redirect them — it can only wait. If you don't open Fluid in time,
> the payment is automatically returned to the sender.

Default hold window 24 h, maximum 72 h (`ASYNC_PAY_HOLD`, validated
1–72). The holding peer can only DELAY, never steal or redirect — the
HTLCs are time-locked to the recipient's preimage, which never leaves
the wallet's seed.

**The 1,300-byte budget (measured, and it dictates the design)**:
a static-invoice payment's onion must carry the whole invoice
request, which embeds the whole offer — including every message
path in it. Instrumenting LDK's own estimator
(`set_max_path_length`) on this build measured: invoice request 990
bytes and 1,374 bytes reserved (> the 1,300-byte onion limit, payer
refuses with `OnionPacketSizeExceeded`) for an offer carrying two
369-byte paths; 621 bytes and 1,005 reserved for one path. So the
SIS issues exactly **one** path for an async recipient's offer
(router rule, `StaticInvoiceRequested` context), preferring an
introduction that is neither the SIS nor the recipient itself — a
path introduced by the recipient is undeliverable exactly when it
matters, because the recipient is the node that's offline. The
paths a recipient uses to *reach* its SIS are likewise kept to one,
preferring the path introduced by the recipient itself (the one
introduction a light wallet can always reach: itself, then one hop
to the SIS). The recipient-id convention that makes this possible
is the recipient's node-id hex.

**Two hold modes, both proven**: LDK parks a static-invoice payment
in one of two places. *ToCounterparty*: the payer's next hop (its
LSP) holds the HTLC — viable when that LSP's onward channel is live,
the always-online LSP↔SIS shape. *ToUs*: when the payer's next hop
does not advertise `htlc_hold`, the payer holds its own HTLC and
sends only a `HeldHtlcAvailable` notice; on the recipient's release
it sends the payment for real. Arbitrary third-party payers will
mostly use ToUs today; a Fluid payer whose LSP is the keeper uses
ToCounterparty.

**Evidence**: the harness (`lightning/harness/`) runs seven real
FluidNodes over in-memory pipes with a fabricated chain — 28 checks,
all passing, foreground-verified across repeated runs: channels,
BOLT 11 both directions, BOLT 12 offer payment, then both async
legs end to end (SIS paths issued, async offer built, payment NOT
settled while the recipient is offline, SIS served the static
invoice, held payment settled to the recipient on return, payer
sees completion) — leg 1 in the 4-node ToCounterparty topology
(payer → payer's LSP → SIS → recipient, HTLC parked at the LSP),
leg 2 in the 3-node ToUs topology (payer → SIS → recipient, HTLC
held by the payer). The harness also models two production facts
that turned out to be load-bearing: a payer routes to a blinded
introduction beyond its first hop only if the intervening
server↔server channel is announced and gossiped, and a forwarder
can only send up to its outbound balance minus the channel reserve
— the leg-2 topology shifts liquidity first, as a real wallet must
before it can receive.

**Not proven live**: no signet/testnet coins were obtainable from
this build environment (every faucet was unreachable, as in Build B),
so the same flow has not yet run against public signet with real
peers. What remains unproven live is exactly: public-network peer
connections + a funded signet channel + the async flow over the real
network. The protocol behaviour is proven against LDK itself in the
harness; the keeper (below) is live on signet and syncing.

### 3. Wake-up — LSPS5 / bLIP-55

- **Client** (`src/lightning-node.js` + `src/sw.js`): the panel's
  wake-up section registers the service worker, requests notification
  permission, fetches the relay's VAPID public key, subscribes with
  `userVisibleOnly: true` (Chrome's constraint — every push shows a
  notification) and registers the subscription with the relay under
  an opaque id (truncated SHA-256 of the node id). The service
  worker's push handler shows the FIXED text "Payment received —
  open Fluid to claim it"; a tap deep-links to `/#lightning`, which
  opens the node panel after unlock so the held payment settles.
  Push payloads are never trusted beyond the fixed shape.
- **Relay** (`tools/notification-relay/`): a dependency-free Node
  service holding NO keys and NO funds. The peer/SIS fires an
  HMAC-SHA256-signed `payment_incoming` webhook (timestamped,
  ±5 min freshness, timing-safe compare); the relay verifies it and
  sends a Web Push — RFC 8291 (aes128gcm) + RFC 8292 (VAPID)
  implemented by hand on `node:crypto`. The webhook's body fields are
  never displayed: the notification text is fixed. Worst case for a
  compromised relay: it can send or withhold a generic notification.
  Its end-to-end test stands up a local HTTPS push service and
  verifies the whole loop independently (receiver-side decryption,
  VAPID JWT audience + signature): ALL PASS. Run instructions are in
  its README.

### 4. BIP-353 + LNURL

- **Sending**: the panel classifies every target
  (`classifyLightningTarget`): BOLT 11 → pay; BOLT 12 → pay; a
  `₿user@domain` / Lightning address → BIP-353 first (DNS TXT at
  `_bitcoin-payment.<user>.<domain>` fetched over DNS-over-HTTPS,
  the returned offer validated by the BOLT 12 parser before use),
  falling back to LNURL-pay for an invoice paid through the node; a
  bare word → Fluid name → its registered Lightning address → LNURL
  invoice → node pay.
- **Receiving identity**: the wallet's BOLT 12 offer IS its shareable
  address (Receive sheet + panel). Publishing that offer in DNS under
  the project domain is a documented one-record step that waits for
  the fluid.js.org grant (PR pending): add a TXT record
  `_bitcoin-payment.<name>.fluid.js.org` containing
  `bitcoin:?lno=<offer>`. The code path (resolution + validation) is
  shipped and tested; no DNS control is faked.
- **Fallback kept**: the pre-existing WebLN / LNURL-pay sheet remains
  as a clearly-labelled secondary fallback (and is the only Lightning
  path in the single-file build, which cannot carry the WASM chunk).

### 5. DripBot keeper — `~/workspace/dripbot-lightning/` (outside the repo)

DripBot's own always-on LDK node under Node (real TCP, inbound peers
accepted), seeded deterministically from the DRIP wallet's stored
keystore (decrypted in memory; HKDF-SHA256 over the private key,
info `dripbot/lightning/ldk-seed/v1`). It exposes the CLI the
fee-settlement / drip jobs will call: `status`, `invoice`,
`pay-invoice`, `offer`, `sis-paths` (it is the natural static-invoice
server / holding peer for Fluid users — including settling fees to
the Fluid username "dripbot"), `connect`, `open-channel`, `channels`,
`balance`, `history`, and a `daemon` mode. Because it is always on,
it needs none of the async machinery — payments to it settle live;
its README says so. Default network signet; mainnet only on the
owner's explicit say-so. PROOF: see the keeper README for what was
exercised (startup, Esplora sync to the signet tip, invoice creation
verified by the independent JS codec, an inbound TCP peer connection
from a second node).

## Browser limits, stated plainly

- **No raw TCP in browsers.** Peer connections run over WebSocket:
  the peer's own wss:// endpoint, or a user-configured
  WebSocket-to-TCP proxy (URL template with `{host}`/`{port}`). The
  proxy sees only Noise-encrypted bytes. Peers reachable only by raw
  TCP cannot be dialled from the app — the keeper (Node) has no such
  limit.
- **localStorage size**: channel state is small, but localStorage
  quotas (~5 MB) bound how much state fits; monitors for many
  channels could eventually pressure it. Acceptable for the intended
  few-channel wallet; a future move to IndexedDB is noted, not done.
- **Long-offline risk**: a node offline longer than its channels'
  `to_self_delay` window can be cheated by a malicious peer
  broadcasting an old state. The 24–72 h hold design keeps offline
  windows far below typical delays (days–weeks); a keyless
  watchtower is the bar-compatible mitigation and is future work,
  not shipped.
- **Gossip**: the node runs in light-client mode (no UTXO lookup);
  routing uses the network graph it gossips from peers plus its own
  channels. `FluidMessageRouter` (above) covers the bootstrap gap
  for offers.

## Dependencies added (all official, pinned)

JS (app): `@noble/ciphers ^2.4.0` (publisher paulmillr — same as the
existing noble packages) for synchronous AES-GCM over the node's
persisted state (WebCrypto is async; LDK's KV bridge is sync).
`src/ln-derive.js` reuses existing deps (`@scure/bip39`,
`@noble/hashes`).

Rust (crate, all LightningDevKit / rust-bitcoin orgs): `lightning
0.2.7`, `lightning-invoice 0.34.1`, `lightning-types 0.3.5`,
`bitcoin 0.32.102`, `bitcoin-io 0.1.101`, `wasm-bindgen 0.2.130`.

Keeper: `ethers ^6.17.0` (ethers-io) for keystore decryption,
`@noble/hashes` for HKDF. Relay: zero dependencies (Node stdlib).

Tooling (build-time only): zig 0.13.0 as the wasm C compiler shim
(clang is absent on this VM), wasm-bindgen-cli 0.2.130.

## Sizes

- Main bundle `dist/app.bundle.js`: 5,155,094 bytes — unchanged by
  the Lightning work (the chunk import is external).
- Lazy chunk `dist/lightning.chunk.js`: 41,190 bytes.
- WASM `dist/fluid_lightning_bg.wasm`: 11,603,447 bytes (crate
  profile: opt-level 2, `strip = "symbols"`; served gzip-compressed
  by Pages in practice, and fetched only when the panel opens). The
  single-file build cannot inline it and keeps the WebLN fallback +
  a note.


## Using Lightning today — honest limits (2026-11-09)

- The node runs **in your browser**, from your seed, only while Fluid
  is open — Fluid must be open to settle, not to receive.
- A fresh node has **no channels**: spendable and receivable are both
  0 until a channel is opened (the panel's open-channel flow funds one
  from your on-chain BTC). An invoice issued before any channel exists
  cannot be paid — open a channel first.
- The balances the panel shows are the node's real channel state, not
  estimates.
