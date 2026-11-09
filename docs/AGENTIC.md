# Fluid Agentic Wallets

*Added at Ethuram's direction (2026-11-06): agents get their own Fluid wallet —
full blockchain access, no KYC, no on/off-ramps.*

*For the operational kit — how an agent creates a wallet for its user,
or claims and runs its own today — see `docs/AGENT-KIT.md` and the
machine-readable manifest at
https://fluidwallet.dpdns.org/.well-known/fluid-agent.json. This file
remains the design record.*

## The idea

Humans need ramps and identity checks because fiat touches banks. An AI agent
doesn't: it lives on-chain. So a Fluid **agent wallet** is chain-only by
design:

- **Full blockchain access** — the same chains as any Fluid wallet
  (15 EVM networks, Bitcoin, and every other family — see
  `docs/CHAINS.md`; Lightning receive via the owner's Lightning address).
- **No KYC** — there is no account, no email, no identity provider. The wallet
  is keys derived from a seed, nothing else.
- **No on-ramp, no off-ramp, ever** — the policy object hard-codes
  `ramps: false`; the policy gate refuses any spend plan that isn't
  chain-native. (This is also exactly how DripBot runs — see DRIPBOT.md.)
- **No seed export** — the agent never sees keys.

## How it works

1. The owner opens Fluid → **More → Agentic wallet**, names the agent, taps
   *Create agent wallet*.
2. The agent's keys are **derived from the owner's seed at a reserved account
   range** (BIP44 account 1000+ for EVM, BIP84 account 1000+ for BTC). One seed
   backup covers owner + all agents, but each agent's funds sit in its own
   account, separate from the owner's money.
3. The owner hands the agent its **descriptor** — a small JSON with only
   public addresses, the chain-only access flags, and its policy. No secrets.
4. The agent works through **intents**: on a page with Fluid open it calls
   `window.FluidAgent.requestTransfer({ agent, to, amount, network })`.
   The wallet enforces the policy caps first ($50/tx, $200/day by default —
   owner-set), then shows the owner a plain-language approval. Only when the
   owner approves does the wallet sign — with the *agent account's* key, so an
   agent can never touch the owner's main funds.

```js
// from the agent's side:
const agents = window.FluidAgent.list();
const res = await window.FluidAgent.requestTransfer({
  agent: "DripBot", to: "0xRecipient…", amount: 0.005, network: "bsc",
}); // → { hash, from, network } after the owner approves
```

## Autonomous mode — no human at all

Owner-assisted mode (above) is for agents that should *not* hold keys. For a
fully autonomous agent — a bot on a server, DripBot, an always-on service —
Fluid ships a headless runtime: **`agent/fluid-agent.mjs`** (Node, same
open-source repo). The agent creates its own wallet end-to-end:

```bash
node agent/fluid-agent.mjs create --name DripBot --dir ./dripbot-wallet
node agent/fluid-agent.mjs balance --dir ./dripbot-wallet
node agent/fluid-agent.mjs send --dir ./dripbot-wallet --to 0x… --amount 0.01 --network bsc
```

- The agent generates **its own BIP39 seed** and its own keystore password;
  the seed exists on disk only as an encrypted keystore, the password in a
  `0600` secret file in the agent's own directory. No human ever sees either.
- It derives its own EVM + BTC addresses and publishes its descriptor.
- `send()` signs with its own key — no approval step exists. The guardrails
  are the **policy caps, enforced in code before signing**, plus valuation:
  if a send can't be priced, it is refused (safety default). Over-cap sends
  throw — verified live: a 1 BNB send against a $50 cap is blocked before
  any signature.
- There is deliberately **no ramp code path** in the runtime. Chain only.
- **It can claim its own Fluid name** (agent kit, 2026-11-09):
  `claimName` — as a method on the opened agent, a standalone export,
  and a `claim` CLI command — builds, signs and publishes the registry
  claim with wallet-core, persists the pending record in the agent's
  directory, and verifies the name landed in the public registry. An
  agent wallet is a first-class named wallet, resolvable by anyone.

**The honest trade-off:** an autonomous agent holds its own keys, so whoever
controls the agent's machine controls the wallet. The protection model is
therefore *funding discipline + caps*: fund the agent wallet only with what
it is allowed to spend (e.g. DripBot's fee income), keep the caps tight, and
the worst case is bounded by what was sent to it. An operator who later wants
custody back simply sweeps the funds — the descriptor addresses are public.

Verified 2026-11-06 with a throwaway `TestBot` wallet: autonomous create,
live balance reads (BSC + BTC), duplicate-create refusal, over-cap policy
block, and a within-cap send that passed policy and reached the network
(failing only on its zero balance).

## Safety model

- **Signer separation** (Fluid's core rule): agents request, the signer signs.
  A compromised or hallucinating agent cannot move funds on its own — worst
  case it *asks*, and the caps bound what it can ask for.
- **Caps are policy, not promises**: `checkAgentPolicy()` runs before any
  approval prompt; over-cap requests never reach the owner.
- **Spend tally** is kept per agent per day on-device.
- **Revocation** = stop approving; the owner can also simply move the agent's
  funds out from the main wallet (same seed). A future version adds per-agent
  pause and headless mode (an agent runtime holding its own encrypted key with
  caps enforced in the runtime) for always-on bots like DripBot.

## Why this matters

Agent economies (x402 payments, bot treasuries, autonomous services like
DripBot's weekly drip) need wallets that don't pretend the agent is a human
with a passport. Fluid agent wallets are that: pure keys, pure chain,
owner-governed.
