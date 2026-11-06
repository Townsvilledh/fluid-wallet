# Fluid notification relay (LSPS5 / bLIP-55 wake-up)

A tiny standalone service that wakes a Fluid user's phone when a Lightning
payment arrives for them while the app is closed:

```
peer's static-invoice server ──webhook──▶ this relay ──Web Push──▶ user's browser
(LSPS5 payment_incoming)                 (no keys, no funds)     "Payment received —
                                                                  open Fluid to claim it"
```

The push never contains amounts or sender details — a webhook is untrusted
input, so the notification text is fixed by this service. The user opens
Fluid and reads the real state from their own node; the held payment then
settles (BOLT 12 async payments — see `docs/LIGHTNING.md`).

## What it holds — and what it can never do

- **No wallet keys, no seeds, no funds.** It cannot sign, pay, or redirect
  anything. The worst a fully compromised relay can do is send (or not
  send) a generic "payment received" notification to subscribed browsers.
- It stores: one **VAPID keypair** (its only power is sending pushes to
  browsers that opted in) and **push subscriptions** (endpoint + p256dh +
  auth — capabilities for sending notifications *to that browser only*),
  in `./data/` (dir 0700, files 0600).

## Run

```sh
FLUID_RELAY_WEBHOOK_SECRET=<shared secret with the peer/keeper> \
FLUID_RELAY_VAPID_SUBJECT=mailto:you@example.com \
node relay.mjs            # listens on :8931 (FLUID_RELAY_PORT)
```

Node ≥ 18, **zero dependencies** — Web Push encryption (RFC 8291
aes128gcm) and VAPID (RFC 8292, ES256 JWT) are implemented by hand on
`node:crypto` in `relay.mjs`.

## API

| Route | Purpose |
|---|---|
| `GET /health` | liveness + subscription count |
| `GET /vapid-public-key` | the VAPID public key (Fluid fetches this before subscribing) |
| `POST /subscribe` `{id, subscription}` | store a browser push subscription under an opaque id (e.g. a hash of the user's offer). `id` is 8–128 url-safe chars. |
| `DELETE /subscribe/:id` | remove a subscription |
| `POST /webhook/:id` | the peer's payment-incoming webhook. Triggers one fixed-text push to that id's subscription. |

Webhook authentication: header `x-fluid-timestamp` (unix seconds) and
`x-fluid-signature` = hex HMAC-SHA256 of `"<timestamp>.<raw body>"` under
`FLUID_RELAY_WEBHOOK_SECRET`, with a ±5-minute freshness window. Dead
subscriptions (push service answers 404/410) are removed automatically.

**Pairing with a third-party LSPS5 LSP instead of Fluid's own keeper:**
LSPS5 leaves the webhook signature scheme to the implementation; our
keeper signs as above. For another LSP, plug its scheme into the single
isolated `verifyWebhook()` function in `relay.mjs` — nothing else changes,
because the relay never trusts webhook content anyway.

Chrome's `userVisibleOnly` rule is respected end-to-end: every push this
relay sends carries a visible notification (there is no silent-push path),
and the Fluid service worker shows it and deep-links the tap into the
Lightning panel.

## Test

```sh
node relay.test.mjs
```

Spins up the relay plus a local HTTPS mock push service, subscribes a
throwaway browser keypair, fires signed/unsigned/stale webhooks, then
*decrypts* the delivered push with the subscriber's private key (an
independent receiver-side implementation) and verifies the VAPID JWT
against the relay's public key.
