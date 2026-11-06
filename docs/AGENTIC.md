# Fluid Agentic Wallets

*Added at Ethuram's direction (2026-11-06): agents get their own Fluid wallet —
full blockchain access, no KYC, no on/off-ramps.*

## The idea

Humans need ramps and identity checks because fiat touches banks. An AI agent
doesn't: it lives on-chain. So a Fluid **agent wallet** is chain-only by
design:

- **Full blockchain access** — the same 15 EVM networks + Bitcoin as any Fluid
  wallet (Lightning receive via the owner's Lightning address).
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
