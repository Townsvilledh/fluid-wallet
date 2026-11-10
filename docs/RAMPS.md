# Buy & sell (fiat ramps)

Fluid never touches fiat and holds no user funds: a ramp is a
transact-page flow with a provider who settles directly with the user's
own bank or wallet. Fluid wires a route only when it passes three bars:

- **Price bar** — never more than ~4% (₦60-equivalent) above the local
  P2P/parallel-market benchmark for that corridor.
- **Capture gate** — the route must carry Fluid's fee natively
  (referral/affiliate/split) or through a non-custodial charge mechanism
  of Fluid's own. A route that can never pay is removed, not subsidised.
- **Seamlessness** — no platform-account life. If using a route means
  joining an exchange or P2P marketplace, it is out, however cheap.

Buy and sell are judged **independently per side**: a platform's strong
side never excuses wiring its weak side.

**The standing target is $1 in and out, worldwide** (the one exception:
US citizens *buying* have a $5 floor; US selling stays $1). Where no
route meets the bars at $1, the sheet shows the real floor — or an
honest empty state — rather than a bad route.

## What is wired today

- **Mt Pelerin — buy and sell, 50 countries.** Referral wired
  (`rfr=Fp3dGFX3`; Mt Pelerin pays 25% of its fees). Buy from CHF 1.
  **Sell floor is CHF 50 (≈ $57)** — disclosed in the sheet, not hidden.
  Purchases made without full verification carry a **7-day hold** before
  the crypto can be sold back, and some corridors pay out over SWIFT —
  both disclosed in-sheet. Mt Pelerin does **not** serve US residents:
  for the US it appears only as a flagged-unavailable row.
## Honest empty states today

- **Nigeria buy and sell** — no route currently passes the price bar
  *and* the capture gate. Both sheets say so plainly. (The sell side's
  last route was removed in full on 2026-11-10 on the owner's order.)
- **Kenya, Ghana, Uganda, Tanzania, Cameroon, Senegal, Côte d'Ivoire
  and Zambia sell** — their only sell route was removed in the same
  2026-11-10 removal; honestly empty until a qualifying route exists.
  South Africa keeps Mt Pelerin on both sides.
- **US buy and sell** — no wired route yet (see below).
- **India, Brazil, Philippines, Indonesia** — no route passes the bars
  yet; honestly empty.

## In build (NOT live yet)

- **Gateway (Paycrest network)** — an in-Fluid sell sheet settling
  straight to a bank account. Quote-proven at the provider's $0.50
  floor in Nigeria and Kenya (below the floor no provider answers);
  funded settlement micro-tests are queued before it wires.
  Corridors with no provider at any size (Tanzania, Uganda) will stay
  honestly empty.
- **Peer Cash (ZKP2P protocol, driven inside Fluid)** — US sell and buy
  via Venmo / Cash App / Zelle / X Money / Wise / PayPal, with the
  protocol's 50 bps integration share carried by attribution. Buy
  minimums are per-maker (many intents fill at $5; Cash App's book
  starts higher) — the sheet will show the live book's real floor.

Until a build lands and passes live QA, it is not part of the product —
this page will be updated when it ships.
