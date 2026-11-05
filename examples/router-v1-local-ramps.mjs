/**
 * Fluid Router — Phase 3 starter (MOCK providers, no real money, no API keys)
 *
 * What this proves: the quote-engine shape from the spec — ask every ramp in
 * parallel, rank by TRUE total cost (fee + FX spread + speed/reliability
 * penalty), fall back automatically when a provider is down, and produce the
 * human-readable intent string the Signer would show for biometric approval.
 *
 * Real providers (Busha, Mavapay, Cashramp, Kotani Pay…) need partnership /
 * KYC agreements and CBN-licensed NGN rails — that is a business process,
 * not code. Swap each mock for a real adapter behind the same interface:
 *   { name, async getQuote({amount, from, to}) -> {feeNgn, rate, etaSec, ok} }
 *
 * Run:  node router.mjs
 */

// ---- Mock providers (deterministic-ish, one randomly "down" sometimes) ----
const jitter = (n) => Math.round(n * (0.9 + Math.random() * 0.25));
const mock = (name, baseFeePct, etaSec, failRate) => ({
  name,
  async getQuote({ amountNgn }) {
    await new Promise(r => setTimeout(r, jitter(120))); // fake latency
    if (Math.random() < failRate) throw new Error(name + " unavailable");
    const feeNgn = Math.round(amountNgn * baseFeePct);
    return { provider: name, feeNgn, etaSec, ok: true };
  },
});

const PROVIDERS = [
  mock("Busha",    0.014, 300, 0.15),
  mock("Mavapay",  0.011, 900, 0.15),
  mock("Cashramp", 0.017, 180, 0.10),
  mock("Kotani",   0.020, 600, 0.10),
];

// Reliability/speed penalty: 1 naira per minute of ETA, so "cheapest" means
// cheapest *for the user*, not cheapest headline fee. Tune in production.
const score = (q) => q.feeNgn + Math.round(q.etaSec / 60);

export async function getBestQuote({ amountNgn, from = "NGN", to = "USDC" }) {
  const settled = await Promise.allSettled(
    PROVIDERS.map(p => p.getQuote({ amountNgn, from, to }))
  );
  const quotes = settled.filter(r => r.status === "fulfilled").map(r => r.value);
  const failures = settled.filter(r => r.status === "rejected").map(r => r.reason.message);
  if (!quotes.length) throw new Error("All ramps down — queue offline and retry. Failures: " + failures.join("; "));
  quotes.sort((a, b) => score(a) - score(b));
  return { best: quotes[0], alternatives: quotes.slice(1), failures };
}

/** The ONLY thing the Signer ever shows. AI/app propose; human approves. */
export function formatIntent({ amountNgn, quote, to }) {
  const mins = Math.max(1, Math.round(quote.etaSec / 60));
  return `Convert ₦${amountNgn.toLocaleString("en-NG")} to ${to} via ${quote.provider}, ` +
         `fee ₦${quote.feeNgn.toLocaleString("en-NG")}, about ${mins} min. Confirm?`;
}

// ---- Demo ----
const { best, alternatives, failures } = await getBestQuote({ amountNgn: 50000 });
console.log("Failures (auto-routed around):", failures.length ? failures.join("; ") : "none");
console.log("Best route:", best.provider, "· fee ₦" + best.feeNgn.toLocaleString("en-NG"), "· ETA", best.etaSec + "s", "· score", score(best));
for (const a of alternatives) console.log("  alt:", a.provider, "· fee ₦" + a.feeNgn.toLocaleString("en-NG"), "· score", score(a));
console.log("\nSigner would show:\n  “" + formatIntent({ amountNgn: 50000, quote: best, to: "USDC on Arc" }) + "”");
console.log("\nNote: NGN on-ramp in production = per-user virtual account (Flutterwave/Paystack/Monnify) → webhook → ramp converts → USDC. The user sees “Naira balance”; the wallet holds USDC. Fluid itself never holds the funds.");
