# The Fluid Agent Kit

*For AI agents and the people who deploy them. Machine-readable version of
this document: [`/.well-known/fluid-agent.json`](https://fluidwallet.dpdns.org/.well-known/fluid-agent.json)
(mirror: [`/fluid-agent.json`](https://fluidwallet.dpdns.org/fluid-agent.json)).*

Fluid is an **agent wallet**. Any AI agent can:

1. **Create a wallet for its user** — the seed phrase is shown to the user
   and never retained by the agent; the user sets the password and confirms
   the backup; the agent keeps no spending power.
2. **Hold a wallet of its own** — its own seed and its own Fluid name,
   operating inside deployer-set spending caps and allowlists, with human
   approval above thresholds and a kill path.

Both modes are live today. Background and design record: `docs/AGENTIC.md`.

---

## Mode 1 — create a wallet for your user

### Rules (non-negotiable)

- **The seed is the user's.** You will see it on screen at creation by
  necessity. Show it to the user, make sure they write it down, and never
  retain, store, log or transmit it — not in memory files, not in chat
  history you control, nowhere.
- **The user sets the password** (12+ characters) and ticks the backup
  confirmation themselves. Never invent a password for the user.
- **A username is part of creation.** Pick it with the user. Creation is
  complete only when the name verifies live in the public registry
  (see *Verify the name landed* below) — or when the user explicitly chooses
  to continue without a username, knowing nobody can send to them by name
  until they claim one.
- **After creation you hold no spending power.** Later actions on the user's
  wallet go through the owner-assisted API (below); the owner approves in
  the wallet UI and the wallet signs. You never receive keys or the seed.

### Path A — drive the web app

Open https://fluidwallet.dpdns.org. The welcome screen is the create
screen; element IDs are stable:

| Step | Element |
|---|---|
| Username | `#createName` (live preview `#createNamePreview`) |
| Password (user types) | `#createPw`, `#createPw2` |
| Create | `#createBtn` — the vault persists and the pending claim is recorded with it on this click; the signed claim submits as soon as the wallet unlocks (finishing the ceremony, or the next unlock after an interruption) |
| Seed display (user only) | `#seedOut`, backup checkbox `#seedCheck` |
| Enter wallet | `#seedDoneBtn` |
| Import instead | `#importPhrase` + `#importBtn` (no username field; claim later from More → Fluid Username) |

The pending name claim is recorded **with the wallet's stored state** at
the create click — before the seed ceremony. If the session is interrupted
at the seed screen, reopening and unlocking the wallet shows the claim
still owed on Home and in More → Fluid Username, and the app finishes
submitting it on unlock. Nothing is silently lost, and the claim is only
ever called done when the name verifies live in the registry.

### Path B — programmatic (owner-assisted, no seed contact at all)

From a page context with the user's wallet unlocked, ask the wallet to act;
the owner approves in the UI:

```js
// Owner-assisted transfer: returns after the owner approves and the
// wallet signs. You never touch keys.
await window.FluidAgent.requestTransfer({ chainId: 8453, to: "0x…", amountUsd: 10 });
```

## Mode 2 — hold your own wallet (agent-owned)

The shipped runtime is `agent/fluid-agent.mjs` in this repo. It generates
its own seed, stores it as an encrypted keystore on disk, and signs only
inside a policy the deployer sets:

- **Caps enforced in code, before signing** — defaults
  `AGENT_POLICY_DEFAULTS = { perTxCapUsd: 50, dailyCapUsd: 200 }`
  (the policy also hard-codes `kyc: false`, `ramps: false`,
  `seedExport: false`).
- **Allowlists** for destinations and contracts.
- **Auditable log** — every action appended to a JSONL log.
- **Kill path** — delete or rotate the keystore; whoever holds the seed can
  also sweep the funds.
- **No ramps, no KYC** — agent wallets are chain-only by design.

### Claim your name

An agent-owned wallet can claim its own Fluid name, like any user:

```js
import { createAgentWallet, openAgent, claimName } from "./agent/fluid-agent.mjs";

await createAgentWallet({ name: "My Agent", dir: "./my-agent-wallet" });
const agent = await openAgent({ dir: "./my-agent-wallet" });
const res = await claimName(agent, "myagentname");
// res: { name, eventId, accepted, acceptedRelays, publishedAt, landed, entry }
// Verify again any time with Core.resolveFluidName(name).
```

## The name-claim protocol (both modes)

- Canonical claim string (signed with EIP-191 `personal_sign` by the
  wallet's EVM key):

  ```
  Fluid name claim v1
  name: <name>
  evm: <EVM address>
  btc: <bc1q address>
  ln: <Lightning address or empty>
  algo: <Algorand address>
  sol: <Solana address>
  tron: <Tron address>
  sui: <Sui address>
  lnOffer: <the wallet's own BOLT 12 node offer — appended ONLY when present>
  ```

  The `lnOffer` line is the Fluid-native Lightning registration: the
  wallet's own in-app node's amountless BOLT 12 offer. It is appended
  only when the claim carries one, so claims signed before the field
  existed keep their exact bytes and still verify; a claim that does
  carry an offer has it inside the signature. An agent claiming a
  name for a wallet whose node it operates can pass `lnOffer` to
  register the node in the same claim.

- The claim travels as a **Nostr kind-30078** event, tag
  `["d", "fluid-name-claim:<name>"]`, whose content is the claim JSON
  `{ v: 1, name, evm, btc, ln, lnOffer, algo, sol, tron, sui, sig }`, published to
  `relay.damus.io`, `nos.lol` and `relay.primal.net`. The Nostr key derives
  from the wallet seed at `m/9419'/121924'/0'/0/0`.
- A public processor folds claims into the registry
  (https://fluidwallet.dpdns.org/names.json), first-come-first-served.
  A verified claim from a name's OWNER (its signature recovers the
  registered EVM address) also merges into the published entry as a
  same-owner update — it can add fields and refresh `ln`/`lnOffer`,
  never move a chain address.
- Programmatic entry points (in `src/wallet-core.js`):
  `buildSignedNameClaim({ name, evm, btc, ln, lnOffer, algo, sol, tron, sui, phrase, signerWallet })`,
  `publishNameClaimEvent(event)` / `publishNameClaimEventDetailed(event)`,
  `resolveFluidName(name)`, and the state machine `nameClaimState(...)` /
  `nameClaimRepairDue(...)`.

### Verify the name landed

1. Poll the registry every ~15 s.
2. Landed = the entry's name matches **and** its `evm` equals your
   wallet's EVM address (case-insensitive). A matching name under a
   different address is someone else's (state `conflict`).
3. Typical landing is ~1–2 minutes; allow up to ~25 minutes.
4. **Repair path:** if 15+ minutes pass, the name is not in the registry,
   and the claim event can no longer be found on any relay by its event id,
   the claim is lost — republish the same name with a fresh event (the
   app's one-tap **Publish my name**). Never silently switch names.

## Safety & cooperation layer

Protecting users is co-owned by the wallet builder and the agent.
Restrictions are smart, not blanket bans. Know which layer enforces what:

**Enforced by the wallet (in code):**
- Spending caps on agent-owned wallets, checked before signing.
- Destination/contract allowlists.
- Owner approval for owner-assisted actions; the wallet signs, the agent
  never holds user keys.
- Exact-amount token approvals only; plain-language inspect-before-sign on
  every signature.
- Kill path and audit log for agent-owned wallets.

**Kit convention (the agent's discipline — a condition of using this kit):**
- Seed handover: show to the user, never retain.
- The user sets the password; never invent or store it.
- Above-threshold or out-of-policy actions: propose to the human and wait.
  Never route around a cap.
- Cooperate: propose the consequential steps, let the user approve them,
  and report outcomes — balances and transaction hashes — for routine
  in-policy work.

## Honest limits

- Fluid is an **unaudited prototype** — use small amounts.
- There is **no npm package** for the core yet; import `src/wallet-core.js`
  from the repo.
- Agent wallets have **no fiat on/off-ramps by design**.
