# Security model & recovery

## The model in one paragraph

Fluid is **seed-phrase-only and non-custodial**: there is no company
account, no server, and no Fluid-held key anywhere. Your 12-word BIP39
seed derives every chain (`docs/CHAINS.md`). On this device the seed
exists only inside an **encrypted vault** — the standard Ethereum
keystore format (scrypt + AES) protected by your password, stored in
your browser. Keys never leave the device unencrypted. If Fluid
disappears tomorrow, your seed works in any BIP39 wallet.

## Rules the app follows

- **Inspect before you sign** — every send, swap and dapp request is
  rendered as a plain-language sentence (amount, destination, network,
  fee) before any signature. Never a blind hex blob.
- **Exact-amount token approvals only** — never unlimited allowances.
- **Hostile-data rule** — everything rendered from chains, APIs or
  registries is escaped before display; unverified token metadata is
  never clickable.
- **Auto-lock** — the wallet locks when idle; the password is required
  to unlock, and the seed reveal is password-gated.
- **Honest name states** — a Fluid name is only ever presented as yours
  when the public registry resolves it to this wallet
  (`names.README.md`).

## Recovery

- **Your seed phrase is the recovery.** Fluid cannot reset a password,
  recover a seed, freeze funds or reverse a transaction — that is the
  point, and the responsibility.
- **Offline 2-of-4 Shamir tool** (`tools/recovery.html`, included in
  the repo and served with the app): split your seed across
  device / cloud / guardian / email shares and recover from any 2,
  fully offline. The cloud and email shares use **different**
  passwords by design — one password must never unlock both.
- Forgotten password with a stored vault? The lock screen offers a
  restore path: import your seed phrase (this replaces the wallet
  stored on the device — the warning says exactly that before you
  confirm).

## Agent wallets

Agent-held wallets add a policy layer — spending caps enforced before
signing, allowlists, owner approval above thresholds, a kill path and
an audit log. See `docs/AGENT-KIT.md` (the safety & cooperation layer,
graded by what the wallet enforces vs what is kit convention).

## Honest limits

- **Unaudited prototype.** The cryptography comes from audited
  libraries (ethers.js); this app is not independently audited. Use
  small amounts.
- A weak password on a stolen device is the weakest link — use a
  strong one (12+ characters, enforced at creation).
- Only ever run a build you can verify: build from this repo, or check
  the published build's hash against the source.

## Build integrity & release verification (2026-11-15)

- **Source ↔ served build.** Every push to `main` is rebuilt from
  source in CI (`build-check`), and the job fails if the committed
  `dist/` differs from the fresh build. Releases land source + dist
  as ONE commit via `scripts/publish.mjs`, which also builds twice
  locally and refuses to publish if the two builds differ. The
  served page carries its bundle stamp in a `fluid-build` meta tag
  and in the `app.bundle.js?v=<stamp>` URL.
- **The Lightning WASM (audit F-4.1).** The 11 MB Lightning WASM is
  a compiled Rust artifact copied into `dist` verbatim.
  `lightning/pkg-web/provenance.json` binds it to its source: the
  sha256 of the WASM bytes and a sha256 over its source inputs
  (`lightning/Cargo.toml`, `Cargo.lock`, the build scripts, and
  everything under `lightning/src/`). `scripts/build.mjs`
  recomputes both on every build and fails on any mismatch, so a
  WASM that does not correspond to the recorded source can never
  be published silently. After a genuine rebuild, the record is
  refreshed with `node scripts/lightning-provenance.mjs --write`
  and committed with the new artifact.
- **Signed release checksums (audit F-5.1).** Every build writes
  `dist/checksums.txt` — sha256 hashes, in sha256sum format, of
  `index.html`, `app.bundle.js`, `fluid-wallet.html` (the
  single-file build), `recovery.html`, `fluid_lightning_bg.wasm`,
  `lightning.chunk.js` and `release-pubkey.pem`. The publish step
  signs that file with Fluid's Ed25519 release key; the signature
  is served as `checksums.txt.sig` beside `checksums.txt`. This
  is the single-file build's authentication story: the CSP hash
  inside `fluid-wallet.html` is computed from its own inlined
  bytes and authenticates nothing by itself — the signature over
  the checksums is what ties the file to the release key.
  Release public key (committed at `public/release-pubkey.pem`,
  served as `/release-pubkey.pem`); SHA-256 fingerprint of the
  public key (DER/SPKI):
  `98f42b593f87307c93995091949f8b4ce8103aea19e68282189d5ab2b07d8c5f`.
  To verify a served release, download `checksums.txt`,
  `checksums.txt.sig`, `release-pubkey.pem` and the artifacts
  into one directory and run
  `node scripts/verify-release.mjs <directory>` — it checks the
  signature, prints the key fingerprint (compare it with the one
  above; a signature under a different key is not a Fluid
  release), and verifies every artifact's hash. Key custody,
  stated plainly: the private key exists only on the publishing
  machine (`~/.fluid-release/release-key.pem`, never in the
  repo) — a single point of trust for release signing today.
  Rotating means generating a new keypair, committing the new
  public key, and updating the fingerprint above in the same
  commit.
- **Framing (audit F-4.2).** GitHub Pages cannot send
  `X-Frame-Options` or a CSP `frame-ancestors` header, and
  `frame-ancestors` is ignored in a `<meta>` CSP. The app
  therefore refuses to initialise when it finds itself inside a
  frame: it attempts to navigate the top window to itself and
  otherwise renders a plain notice ("Fluid does not run inside a
  frame"). The wallet has no legitimate embedding use case.
