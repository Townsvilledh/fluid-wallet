# Fluid Names registry (names.json)

Maps a Fluid username to wallet addresses:
`"kemi": { "evm": "0x…", "btc": "bc1…", "ln": "kemi@getalby.com" }` — displayed as
`kemi.fluid.is-a.dev`, sendable from any Fluid wallet by name alone.

One name resolves to the wallet's keys on every family: `evm` is a single
address valid on **all 15 EVM chains for any token** (native coins, USDC,
USDT, any ERC-20), `btc` is the Bitcoin address, and `ln` (optional) is a
Lightning address so the name also receives Lightning payments. `algo`
(optional) is the Algorand address, so the name also receives ALGO and
ASA sends. Send any asset to the name alone — the wallet picks the right
key for the asset.

`lnOffer` (optional) is the wallet's **own BOLT 12 node offer** — the
Fluid-native Lightning identity. Every Fluid wallet runs its own
Lightning node inside the app; registering the node's offer to the
name (More → Your Fluid name → "Use my Fluid node") means a payment
to the name goes to the user's own node, with no outside service and
no other wallet to create. When an entry carries both, the offer is
the Lightning target Fluid pays; `ln` remains for a Lightning address
hosted by another provider. An offer is only carried when it is
**amountless** (the payer chooses the amount) and parses as a BOLT 12
offer. Receiving to a registered offer still needs the node to have a
channel with room in it and the app open when paid — the name card
says so plainly until the node can actually receive.

To claim a name: open the wallet and pick a name — at wallet creation,
or later under More → "Your Fluid name". The wallet signs the claim
with its own keys and publishes it from inside the app; a processor
verifies the signature, enforces first-come-first-served against this
registry, and lands the name here automatically — no account, no
GitHub, nothing to copy by hand. Your name shows as **live** only once
it appears in this registry resolving to your wallet; until then the
app says plainly that it is saved on your device or still publishing.

Fallback: if you prefer to publish by hand, the app still shows your
registry entry — add it to `names.json` in this repo via a GitHub
edit or PR. First come, first served either way; names are public and
permanent in git history, so choose one you're happy to be known by.

**Retired names:** the registry operator can retire a name by
listing it in `names-retired.json` at the repo root (first done
2026-11-11 for 46 QA/walk test names whose wallet keys no longer
exist). A retired name is removed from this registry, and the
claims processor refuses every future claim for it — from any
wallet, including the original owner's — so it can never resolve
again to a wallet nobody controls. The name stays visible in git
history and in `names-retired.json` itself; un-retiring is an
operator hand edit of that file, never a claim.

**Updating your own entry:** a name's owner can add fields to their
published entry — or refresh its Lightning fields (`ln` / `lnOffer`) —
by publishing a fresh signed claim from the app; the processor
verifies the claim's signature recovers the registered EVM address
(the ownership proof only the owner can produce) and merges the
claim in. Chain addresses (`evm`, `btc`, `algo`, `sol`, `tron`,
`sui`) can never be changed or removed this way, and no other wallet
can touch the entry at all.


## Claiming from the app — states, durability, and the developer protocol

In the app, a name's state is one of `none / saved / publishing /
repair / live / conflict` — and a name is only ever presented as owned
when this registry resolves it to the claiming wallet. A claim chosen
at wallet creation is persisted with the wallet **before** the seed
ceremony, so an interrupted creation reopens with the claim still
tracked (a banner on Home, and More → Your Fluid name) and finishes
submitting on unlock; a published claim that never lands and whose
event disappears from the relays is called what it is — lost — with a
one-tap republish (the `repair` state).

The full signed-claim protocol — canonical claim string, Nostr kind
30078 events, the relays, the poll-and-compare verification recipe and
the repair path — is documented for agents and developers in
`docs/AGENT-KIT.md`, with a machine-readable manifest at
https://fluidwallet.dpdns.org/.well-known/fluid-agent.json
(mirror: https://fluidwallet.dpdns.org/fluid-agent.json).
