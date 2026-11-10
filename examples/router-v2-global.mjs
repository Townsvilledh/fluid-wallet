/**
 * Fluid Router v2 — GLOBAL AGGREGATOR edition (Ethuram's suggestion, 2026-11-05)
 *
 * Idea: don't negotiate 8 Nigerian ramps one by one. Embed ONE aggregator
 * widget/API in-app, use its FREE quote API to compare live rates across
 * global liquidity providers, and let the aggregator's local partners do
 * the last-mile Naira payout. Fluid never touches fiat and never holds funds.
 *
 * What the research verified (Nov 2026 sources, re-check before production):
 *  - Onramper: aggregator of 30+ ramps, 8 off-ramps, 190+ countries. Widget ≈ 8
 *    lines. "Generally does not add a fee on top" — it earns referral fees from
 *    providers, so the quote API/widget tier is effectively free for Fluid.
 *    Its network includes Nigeria rails via Yellow Card / Wello.
 *  - Meld: similar aggregator; quote = POST /payments/crypto/quote, free sandbox
 *    at api-sb.meld.io, white-label API if Fluid wants its own UI later.
 *  - An Africa specialist that sat here was removed from Fluid
 *    entirely on 2026-11-10 (owner's order) — its registry entry
 *    and widget hand-off went with it.
 *  - Breet: NGN/GHS off-ramp API, "no setup fees, no monthly fees, no hidden
 *    spread", KYB clears in under a day. Good direct fallback.
 *
 * THE TRAP this file is built to avoid — "supports NGN" ≠ "pays out to a
 * Nigerian bank account":
 *  - MoonPay lists NGN as a sell currency, BUT its Visa Direct payout country
 *    list does NOT include Nigeria (Kenya, South Africa, Egypt… no Nigeria),
 *    and Mastercard payouts are Europe-only. -> NGN bank payout UNVERIFIED.
 *  - Ramp Network off-ramp bank payouts are mainly UK/Europe (+ card payouts
 *    elsewhere). -> NGN bank payout UNVERIFIED.
 *  - Transak lists NGN, but off-ramp coverage is narrower than on-ramp and
 *    payout rails are corridor-specific. -> NGN bank payout UNVERIFIED
 *    until a live quote for NG/bank succeeds.
 * So the router has a CORRIDOR GATE: a provider is only offered for a sell
 * if it has a verified payout rail for that country+method. Listing a
 * currency is not enough. Unverified providers can still ON-ramp (card buy),
 * they just never get shown a Nigerian "cash out to bank" button that would
 * fail at the last step.
 *
 * The honest limit of "bypassing Nigerian ramps": you bypass NEGOTIATING
 * with them and holding their licences — the aggregator's Nigerian partner
 * still settles the last mile (someone licensed always must), and the user
 * does KYC inside the provider's widget, with the provider — not with Fluid.
 * That is exactly what keeps Fluid non-custodial and licence-light.
 *
 * Run:  node router-v2-global.mjs
 */

// ---------- Corridor registry: payout rails VERIFIED per provider ----------
// verified: based on provider docs/examples found 2026-11-05. Re-verify live
// (a successful sandbox quote for country=NG + method=bank) before launch.
const PROVIDERS = [
  { name: "Onramper (aggregator → Yellow Card/Wello etc.)", kind: "aggregator",
    ngBankPayout: true,  feePct: 0.010, etaSec: 600, note: "Routes to whichever local partner is cheapest/live" },
  { name: "Breet", kind: "africa-specialist",
    ngBankPayout: true,  feePct: 0.012, etaSec: 420, note: "NGN/GHS API, no setup/monthly fees, KYB < 1 day" },
  { name: "Transak", kind: "global",
    ngBankPayout: false, feePct: 0.015, etaSec: 900, note: "NGN listed; NG bank payout rail not confirmed" },
  { name: "MoonPay", kind: "global",
    ngBankPayout: false, feePct: 0.020, etaSec: 900, note: "NGN sell currency listed; Visa Direct list excludes Nigeria" },
  { name: "Ramp Network", kind: "global",
    ngBankPayout: false, feePct: 0.018, etaSec: 900, note: "Off-ramp bank payouts mainly UK/EU" },
];

/** CORRIDOR GATE — the whole point of v2. */
export function eligibleForOfframp(provider, country, method) {
  if (country === "NG" && method === "bank") return provider.ngBankPayout === true;
  return true; // other corridors: extend the registry as they get verified
}

const score = (q) => q.feeNgn + Math.round(q.etaSec / 60); // fee + speed penalty

export async function getOfframpQuotes({ amountNgn, country = "NG", method = "bank" }) {
  const eligible = [], blocked = [];
  for (const p of PROVIDERS) {
    // In production this loop calls each provider's FREE quote API
    // (Onramper/Meld quote endpoints, …) in parallel.
    // Here the quotes are mocked from the registered fee levels.
    const quote = { provider: p.name, kind: p.kind, feeNgn: Math.round(amountNgn * p.feePct), etaSec: p.etaSec, note: p.note };
    (eligibleForOfframp(p, country, method) ? eligible : blocked).push(quote);
  }
  eligible.sort((a, b) => score(a) - score(b));
  return { best: eligible[0], alternatives: eligible.slice(1), blocked };
}

/** Widget hand-off for the winner (what the app actually embeds). */
export function widgetHandoff(quote, { usdcAmount, network = "BASE" }) {
  if (quote.provider.startsWith("Onramper"))
    return "Embed: Onramper widget (mode=sell, ~8 lines) pre-set to the winning route; user does KYC + bank details inside the widget.";
  return "Embed: " + quote.provider + " widget session created via its quote API.";
}

export function formatIntent({ amountNgn, quote }) {
  return `Cash out ₦${amountNgn.toLocaleString("en-NG")} worth of USDC to your bank via ${quote.provider}, ` +
         `fee ₦${quote.feeNgn.toLocaleString("en-NG")}, about ${Math.max(1, Math.round(quote.etaSec / 60))} min. ` +
         `Fluid never holds the money — the provider pays your bank directly. Confirm?`;
}

// ---------- Demo: sell ₦50,000 of USDC to a Nigerian bank account ----------
const { best, alternatives, blocked } = await getOfframpQuotes({ amountNgn: 50000 });
console.log("⛔ BLOCKED by corridor gate (currency listed, NG bank payout unverified):");
for (const b of blocked) console.log("  -", b.provider, "—", b.note);
console.log("\n✅ Eligible for NG bank payout:");
console.log("  BEST:", best.provider, "· fee ₦" + best.feeNgn.toLocaleString("en-NG"), "· score", score(best), "—", best.note);
for (const a of alternatives) console.log("  alt :", a.provider, "· fee ₦" + a.feeNgn.toLocaleString("en-NG"), "· score", score(a));
console.log("\n" + widgetHandoff(best, { usdcAmount: 36 }));
console.log("\nSigner would show:\n  “" + formatIntent({ amountNgn: 50000, quote: best }) + "”");
console.log("\nFlow: user taps Cash Out → Fluid asks free quote APIs → corridor gate filters → " +
            "Signer shows intent → biometric → wallet sends USDC to provider → provider pays the bank. " +
            "Fluid is software + routes only, exactly as the spec demands.");
