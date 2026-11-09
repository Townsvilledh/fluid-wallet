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
