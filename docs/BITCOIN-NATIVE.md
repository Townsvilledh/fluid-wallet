# Bitcoin-native layers in Fluid — Build B record (2026-11-06)

What shipped, what was assessed and deliberately not built, and why.
Fluid's rule (set by the owner): every shipped chain ships FULL function
(send + receive + balance), and nothing remotely custodial is ever wired
in — a federation-pegged or operator-co-signed system is excluded even
when it would be convenient.

## Shipped

- **Taproot (BIP86)** — full function. Second Bitcoin account from the
  same seed (m/86'/0'/0'/0/0, bc1p…), Schnorr keypath spends. Derivation
  and signing were cross-checked against bitcoinjs-lib (independent
  implementation, scratch-only) and the official BIP86 test vector
  before shipping; sends reuse the two-source fee cross-check, the
  300 sat/vB ceiling, confirmed-UTXO-only selection and the
  review-then-broadcast-exact-bytes pattern.
- **Ordinals safety** — ordinary BTC sends on BOTH Bitcoin accounts
  exclude inscription-bearing UTXOs (keyless Ordinals Wallet Turbo
  index; Hiro's ordinals API now requires an API key). The exclusion is
  counted on the plan and stated in the send review. If the index cannot
  be reached, the send proceeds and the review says plainly that the
  check could not run. Inscriptions display as collectibles (escaped
  rendering, never counted in the BTC balance).
  - Known gap: **rare sats**. No verified keyless per-UTXO satributes
    source exists today, so a UTXO carrying only a rare sat (no
    inscription) is not detectable keylessly. The protection covers
    inscriptions, the index-verified asset class.
  - **Inscription sends are not built**: the postage/sat-offset transfer
    construction could not be validated byte-for-byte against an open
    reference implementation available to this project (the reference
    wallet, ord, needs a local bitcoind + ord server; the production
    ordinals wallets are closed-source). Per the build rule — full
    function must be earned by cross-check evidence — safety + display
    shipped; sends wait for a validatable construction.
- **Runes** — display + transfers. The hand-rolled runestone encoder is
  pinned byte-for-byte by five vectors produced independently by two
  reference implementations (the official ord runestone code compiled
  to WASM, and runestone-lib). Index amounts are whole units (proven
  against an on-chain runestone). Transfers refuse, with a split-first
  message, when a coin also carries an inscription or a different rune,
  and refuse outright when the inscription check cannot run (fee coins
  must be verifiably inscription-free).

## Assessed — NOT built (decisions, not oversights)

### Liquid Network — excluded by the owner's custody bar
Feasibility facts: a browser build is technically plausible. The
Blockstream LWK (Liquid Wallet Kit) ships `lwk_wasm` bindings, Liquid
has public Esplora backends, and the key/transaction model (confidential
transactions aside) is close to Bitcoin's. None of that matters here:
Liquid is a **federated sidechain** — the BTC peg is held and released
by the Liquid functionary federation, so holding L-BTC means trusting
that federation's custody of the underlying BTC. The owner ruled out
federation-pegged systems explicitly and named Liquid ("anything
remotely custodial — skip"). **Verdict: excluded by decision.** Do not
re-propose without the owner reversing the custody bar.

### RGB — no serverless standard-conforming route today
RGB is client-side validation: an asset's state lives in consignments
(state transitions + history proofs) that are bound to specific UTXOs
and held by the asset's holders, NOT derivable from chain data. A
transfer requires the sender to maintain the asset's full consignment
history and hand a consignment to the receiver, who must store it to
ever spend. A stateless, seed-only web wallet cannot reconstruct that
state from the blockchain alone — it would need the user (or a server)
to carry per-asset state backups, which breaks Fluid's
seed-phrase-only recovery model. **Verdict: not buildable serverless to
a defensible standard today.** Revisit only if a standard,
seed-derivable state-recovery scheme for RGB ships.

### Taproot Assets — daemon-shaped protocol, no browser implementation
Taproot Assets (Lightning Labs) is built around the `tapd` daemon: it
maintains asset state, syncs with universe servers for issuance and
transfer proofs, manages the MS-SMT proof trees, and coordinates
multi-step transfers (including the Lightning channel integration).
There is no browser-grade or WASM implementation of tapd, and the proof
and universe-sync responsibilities cannot be reduced to a keyless API
call the way an Esplora balance can. Running tapd server-side for users
would put Fluid infrastructure in the transfer path — against the
non-custodial, no-server design. **Verdict: not buildable serverless to
a defensible standard today.** Revisit if a credible client-only
implementation emerges.
