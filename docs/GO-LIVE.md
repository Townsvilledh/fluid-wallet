# FLUID — Go-Live Checklist: the "form", step by step
*For Ethuram · Prepared 2026-11-05 · All requirements checked against the providers' own docs*

## The key realisation: there are TWO different "lives"

**A) Fluid live for YOUR personal use — NO partner form needed.**
As a normal consumer you can cash out through Fonbnk's public widget today: you KYC *as a user* inside Fonbnk (ID + selfie, like any Nigerian using a cash-out app), they pay your bank. Combined with the wallets you already have (Binance Agentic Wallet + scout wallet) and the Fluid recovery/router prototypes, that's a working personal Fluid this week. The partner form only matters when *other people* use Fluid under your brand and you earn the referral cut.
**Update 2026-11-08:** the in-wallet Fonbnk *route* was PULLED (owner's rule: no pay, no route — Fonbnk pays Fluid nothing collectable without the KYB track below). Personal use of their public widget is unaffected; Track 1 below is now only the re-add path, to run if a collectable programme ever makes the route worth restoring.

**B) Fluid live as a product (partner/production keys) — the form below.**
Every provider's production KYB has the same gate: **a registered legal entity**. No entity, no live keys — from anyone.

---

## Step 0 (production only): Register Fluid with CAC
- Portal: CAC ICRP — `icrp.cac.gov.ng` (fully online, no office visit).
- You need: NIN, valid government ID (National ID / passport / driver's licence), passport photo, Nigerian business address, 2–3 proposed names ("Fluid…" — have backups).
- **Business Name (BN):** ~₦21,000 official (₦1,000 name reservation + ₦20,000 filing, +~₦161 Remita charge), typically 24–72 hours. Cheapest and fastest — but a BN is *registered, not incorporated*, and some KYB desks (Onramper's checklist says "legal entity already incorporated") may insist on a company.
- **Private Limited (Ltd):** the safer choice for fintech partners. Official CAC schedule lists ₦10,000 for share capital ≤ ₦1m plus stamp duty; agent/all-in guides put it anywhere between ~₦30,000 and ₦100,000. TIN is generated with registration.
- Recommendation: if Fluid is going public, go straight to **Ltd** and skip doing paperwork twice.

## Track 1 — Fonbnk (fastest, do this first)
> **STATUS — PULLED 2026-11-08 until a collectable programme exists.** Fonbnk was removed from Fluid's ramp routes on 2026-11-08 (owner's decision): its partner fees are KYB + server-signed-JWT gated, so Fluid earned nothing — and the rule is no pay, no route. The wiring facts (widget root = buy, `/offramp` = sell, address param merchant-KYB-gated) are preserved in the wallet-core ramp notes. This track is what re-adding would require; don't run it unless the route decision is revisited.
1. **Sandbox (today, ~minutes, no KYB, no company):** register at `sandbox-dashboard.fonbnk.com/register-initiate`, grab API signature secret + client ID from API Settings, test with the sandbox pay widget (their docs even provide a Nigeria sandbox test account). No real money.
2. **Production account:** register at `dashboard.fonbnk.com/register-initiate`.
3. **KYB:** after registering, contact Fonbnk support and complete KYB. This unlocks the production powers: signed widget URLs, pre-setting the user's wallet address, webhooks.
   - Note: the basic PayWidget is listed by Fonbnk as **"Free to use"** — KYB gates the *API/advanced* features, not basic use.
4. Fields they'll want (from their contact form): business email, phone, business type (pick **Crypto Exchange/Wallet** or **Gaming**), countries (Nigeria), product (PayWidget first), estimated timeline, how you KYC users (answer: "Provider-side — Fonbnk widget handles user KYC").

## Track 2 — Onramper (aggregator, staging now / live in 3–7 working days after KYB)
1. Sign up at Onramper — their guide says **under 5 minutes**, and you get a **staging key immediately** to start integrating. No KYB needed for staging.
2. Subscribe via Stripe checkout to start the **14-day free trial**.
   ⚠️ Correction to my earlier message: the *end user* pays no added Onramper fee, but the *partner* (Fluid) has a **monthly/annual subscription** after the trial — waived only above €1m/month volume. Budget for this; exact price is shown at their checkout.
3. Click the KYB link in the dashboard, upload entity documents with their KYB vendor. **Review: 3–7 working days** (incomplete docs extend it).
4. Their pre-flight checklist, verbatim in substance: ☑ registered legal entity, already incorporated ☑ registration documents in hand ☑ aware of the subscription fee.
5. After approval: "Request live keys" → production keys appear in the dashboard.
6. Newer API (V2) also wants: an Ed25519 key pair you generate (they never see the private key), your server IPs, widget domains, redirect URLs, and a security contact.

## Track 3 — Breet (fastest production KYB — usually under a day)
1. Not fully self-serve: go to Breet Business and **book a demo** / create the business account.
2. KYB uploads: **business registration documents (CAC certificate), proof of address, ID for beneficial owners/directors**.
3. Their claim: sign-up to first live transaction **in under a day** once documents are in order. Then you receive App ID + App Secret for the API.
4. No crypto licence needed on your side — Breet operates under its own licensed-partner model.

---

## Realistic timeline to "live"

| Milestone | When |
|---|---|
| Fonbnk sandbox + Onramper staging keys in hand, router v2 wired to test quotes | **Today** |
| Personal-use Fluid: your wallets + Fonbnk consumer cash-out + recovery tool | **This week** (no form at all) |
| CAC Ltd certificate + TIN | ~3–7 days (portal-dependent) |
| Breet live (KYB ~same day after CAC) | ~1 week |
| Fonbnk verified merchant | ~1 week (support-paced) |
| Onramper live keys (KYB 3–7 working days + subscription) | ~1–2 weeks |

**Bottom line:** nothing about the *form* stops you using Fluid yourself right now. The form is the gate to *selling* Fluid. Do Track 1 sandbox today, file CAC this week, and the production doors open in that order: Breet → Fonbnk → Onramper.
