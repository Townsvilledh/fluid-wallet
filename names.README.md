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
