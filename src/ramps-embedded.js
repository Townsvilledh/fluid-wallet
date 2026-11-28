// Lubrica embedded ramps — E-leg adapter plumbing (SANDBOX-SIDE, UNSHIPPED).
//
// This module is NOT imported by src/app.js or src/wallet-core.js, is not
// bundled by scripts/build.mjs, and surfaces NO rows in the Buy/Sell sheets.
// It exists so that the first partner key that lands (Paychant widget key,
// Flipeet API key) becomes a live route by configuration, not by a new
// build. The only discovery entry point, embeddedRampProviders(), returns
// [] while EMBEDDED_RAMPS_ENABLED is false, and flipping the flag is a
// deliberate owner-gated step that additionally requires the spec's §6
// live re-verification (see goals/lubrica-fluid-s-routing-plug/files/
// embedded-ng-readiness.md).
//
// Design follows the composable-corridors spec
// (goals/lubrica-fluid-s-routing-plug/files/composable-corridors-spec.md):
//   - §1.2: these are class-E legs — Fluid executes the leg itself and
//     verifies the credit; nothing here models an X (link-out) leg.
//   - §1.3: milestone rule — value settles straight to the user's own
//     address / bank account, never to a Lubrica balance in between.
//   - §1.4: provider metadata is carried as leg records (provider, kind,
//     class, direction, min, tiers, tierSource, feeModel, capture, status).
//   - §2.1: a provider that does not publish its KYC tiers is TU, and TU
//     routes as T3. Silence never earns a lower tier.
//   - §2.5: Lubrica's fee is a small multiple of route cost capped at
//     0.5% of the amount (50 bps — mirrors PLATFORM_FEE_BPS in
//     wallet-core.js), charged once on the route, disclosed on the quote.
//   - §4.4 / §6: failure honesty — a failed or malformed provider read
//     surfaces as { ok: false, reason: "unavailable" }, NEVER as a quote.
//     No leg enters a route until a live re-verification has measured it.
//
// Provider facts below are from the providers' own public documentation,
// read 2026-11-27; each adapter cites its sources inline.

// ---------------------------------------------------------------- flag ---

// Master switch for embedded ramps. False = the plumbing is inert: no
// provider is discoverable, no quote can be requested through the
// registry, and nothing user-facing can reach this code.
export const EMBEDDED_RAMPS_ENABLED = false;

// Lubrica fee law (§2.5): the partner fee is configurable per provider
// but may never exceed the 50 bps (0.5%) cap.
export const LUBRICA_FEE_BPS_CAP = 50;
export const LUBRICA_FEE_BPS_DEFAULT = 50;

// Delivery band from the composition law (§4.4): a leg is confirmed
// delivered when what actually arrived is at least 90% of what was
// quoted; below the band the composition pauses, it does not proceed.
export const RAMP_DELIVERY_BAND = 0.9;

// ------------------------------------------------------------- helpers ---

// Round to 8 decimal places — enough for stablecoin amounts, and it
// keeps fee arithmetic free of binary-float dust in tests and quotes.
export function rampRound(n) {
  return Math.round(n * 1e8) / 1e8;
}

function isFinitePositive(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isFiniteNonNegative(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// The uniform failure shape. Callers branch on `reason`; a failure NEVER
// carries quote fields, so a UI cannot accidentally render one.
export function rampUnavailable(reason, detail) {
  const out = { ok: false, reason };
  if (detail !== undefined) out.detail = detail;
  return out;
}

// Fluid's fee on a quote, computed on the DESTINATION amount (what the
// user receives), in destination units. bps is validated against the
// fee-law cap by the adapter constructors; this helper re-validates so
// it is safe to call directly.
export function applyFluidFee(destGross, bps = LUBRICA_FEE_BPS_DEFAULT) {
  if (!isFiniteNonNegative(destGross)) throw new TypeError("destGross must be a non-negative number");
  if (!Number.isInteger(bps) || bps < 0 || bps > LUBRICA_FEE_BPS_CAP) {
    throw new RangeError(`Fluid fee must be an integer 0..${LUBRICA_FEE_BPS_CAP} bps (fee-law cap)`);
  }
  const fee = rampRound((destGross * bps) / 10000);
  return { fee, net: rampRound(destGross - fee) };
}

// The tier a leg effectively routes at. A leg whose published tiers are
// all TU (unpublished) routes as T3 (§2.1); otherwise the lowest
// published tier that fits the amount wins.
export function rampEffectiveTier(leg, amount) {
  const tiers = Array.isArray(leg?.tiers) ? leg.tiers : [];
  if (!tiers.length) return "T3";
  if (tiers.every((t) => t.tier === "TU")) return "T3";
  const order = ["T0", "T1", "T2", "T3"];
  const fitting = tiers
    .filter((t) => t.tier !== "TU" && (t.ceiling == null || amount <= t.ceiling))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
  return fitting.length ? fitting[0].tier : "T3";
}

const TIER_ORDER = { T0: 0, T1: 1, T2: 2, T3: 3 };

// Minimum / maximum / tier gating for one leg at one amount (§2.2 rule 1
// + §2.3). `ceiling` is the user's tier ceiling: "lowest" (the default —
// minimise tier, disclose what the completing leg asks for) or a hard
// cap "T0".."T3". Returns { feasible, tier, requires } or
// { feasible: false, reason, ... } — reasons: "below_minimum",
// "above_maximum", "tier_above_ceiling".
export function gateRampAmount(leg, amount, ceiling = "lowest") {
  if (!isFinitePositive(amount)) throw new TypeError("amount must be a positive number");
  if (leg.min != null && amount < leg.min) {
    return { feasible: false, reason: "below_minimum", min: leg.min };
  }
  if (leg.max != null && amount > leg.max) {
    return { feasible: false, reason: "above_maximum", max: leg.max };
  }
  const tier = rampEffectiveTier(leg, amount);
  if (ceiling !== "lowest") {
    if (!(ceiling in TIER_ORDER)) throw new RangeError(`unknown tier ceiling ${ceiling}`);
    if (TIER_ORDER[tier] > TIER_ORDER[ceiling]) {
      return { feasible: false, reason: "tier_above_ceiling", tier, ceiling };
    }
  }
  const tierRecord = (leg.tiers || []).find((t) => t.tier === tier);
  return {
    feasible: true,
    tier,
    // What the completing leg will ask for, for the quote card (§4.1).
    // TU legs disclose that the provider has not published its ask.
    requires: tierRecord?.requires ?? (tier === "T3" ? "unpublished — provider manages verification in its own flow" : "none"),
    tierDisclosed: true,
  };
}

// Delivery confirmation (§4.4): what arrived at the user's own address
// vs. what was quoted. `observed` is the amount of the target asset the
// wallet actually saw land (from Fluid's own chain reads — this module
// deliberately does not fetch chain state itself).
export function confirmRampDelivery({ expectedAmount, receivedAmount, band = RAMP_DELIVERY_BAND }) {
  if (!isFinitePositive(expectedAmount)) throw new TypeError("expectedAmount must be a positive number");
  if (!isFiniteNonNegative(receivedAmount)) throw new TypeError("receivedAmount must be a non-negative number");
  const threshold = rampRound(expectedAmount * band);
  const delivered = receivedAmount >= threshold && receivedAmount > 0;
  return {
    delivered,
    withinBand: delivered,
    receivedAmount,
    expectedAmount,
    shortfall: delivered ? 0 : rampRound(expectedAmount - receivedAmount),
  };
}

// fetch-with-timeout returning a uniform result. Any transport error,
// non-2xx status, or unparseable body is "unavailable" — never data.
async function rampFetchJson(fetchImpl, url, init, timeoutMs = 15000) {
  const impl = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!impl) return rampUnavailable("unavailable", "no fetch implementation available");
  let res;
  try {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      res = await impl(url, { ...init, ...(ctrl ? { signal: ctrl.signal } : {}) });
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    return rampUnavailable("unavailable", `transport error: ${err?.message || err}`);
  }
  if (!res || typeof res.status !== "number") return rampUnavailable("unavailable", "malformed transport response");
  if (res.status < 200 || res.status >= 300) {
    // Surface the provider's stable error code when the body carries
    // one (Flipeet's envelope does) — it is diagnostic gold and costs
    // nothing; the result is still "unavailable", never data.
    let code = null;
    try {
      const errBody = typeof res.json === "function" ? await res.json() : null;
      if (typeof errBody?.code === "string") code = errBody.code;
    } catch { /* an unparseable error body changes nothing */ }
    return rampUnavailable("unavailable", `provider HTTP ${res.status}${code ? ` (${code})` : ""}`);
  }
  let body;
  try {
    body = typeof res.json === "function" ? await res.json() : JSON.parse(await res.text());
  } catch {
    return rampUnavailable("unavailable", "provider returned an unparseable body");
  }
  return { ok: true, body };
}

function checkFeeBps(feeBps) {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > LUBRICA_FEE_BPS_CAP) {
    throw new RangeError(`partnerFeeBps must be an integer 0..${LUBRICA_FEE_BPS_CAP} (fee-law cap, spec §2.5)`);
  }
  return feeBps;
}

// ============================================================ PAYCHANT ===
//
// Widget leg (spec §5.2: on success of the partner conversation this is
// an E leg — the highest-value integration in the spec).
// Sources (Paychant's own developer documentation, read 2026-11-27):
//   - Widget parameters + REST reference: https://developer.paychant.com
//     (integrations/parameters, integrations/overlay-embed,
//     api-reference/rest-api-reference, resources/webhooks,
//     resources/api-keys)
//   - Overlay SDK script: https://paychant.com/inline/v1 exposing the
//     global `PaychantWidget`; `new PaychantWidget({...}).openWindow()`.
//   - Widget host: https://widget.paychant.com/[action]; sandbox links
//     use the /sand/[action] path (docs' own sandbox example).
//   - REST price: GET /price/{chain}/{asset}?iso={iso_alpha_3}&
//     action={buy|sell}&fiatValue=|assetValue=&networkFee=&paymentMethod=
//     → { usd, <fiat>: unit price, price: calculated amount, minimum,
//     maximum } (minimum/maximum in fiat terms for the query context).
//   - Supported assets include { chain: "STELLAR", asset: "USDC" }
//     (docs' /assets example response).
//   - Webhook events: WIDGET.CREATED, WIDGET.AWAITING_PAYMENT,
//     WIDGET.PAYMENT_CONFIRMED, WIDGET.PAYMENT_COMPLETED,
//     WIDGET.PAYMENT_INSUFFICIENT, WIDGET.PAYMENT_TIMEOUT,
//     WIDGET.PAYMENT_FAILED; signature is HMAC-SHA512 in the
//     `paychant-signature` header (verified server-side — Fluid is a
//     client app, so webhook receipt belongs to Lubrica's backend; the
//     in-app status channel is the widget's callback.onStatus, which
//     carries the same event shape).
//   - Published fee ranges (provider docs): buy 1–2%, sell 1–2.5%,
//     varying by payment method. KYC/AML is managed inside the widget;
//     the tier at any amount is NOT published ⇒ TU ⇒ routes as T3.
//   - Partner fee: Paychant's terms allow an extra partner fee, but the
//     public docs name no rate and the widget parameters carry no fee
//     field — capture is UNRESOLVED until the partner conversation
//     settles it (capture gate, spec §5 preamble). The adapter therefore
//     computes Fluid's fee for disclosure/math only.

export const PAYCHANT_SDK_SCRIPT_URL = "https://paychant.com/inline/v1";
export const PAYCHANT_WIDGET_HOST = "https://widget.paychant.com";
// The listedAsset / selectedAsset identifier format is "<chain>_<asset>"
// lower-case (docs' examples: "ethereum_dai", "polygon_matic").
export const PAYCHANT_STELLAR_USDC_ID = "stellar_usdc";

export const PAYCHANT_NG_DESCRIPTOR = {
  provider: "Paychant",
  kind: "ramp",
  class: "E",
  integration: "widget",
  // Partner-required: a production partner API key is issued only after
  // Paychant's application (docs: apply via paychant.com/contact);
  // Fluid's own 2026-11-07 live check found the guest widget returning
  // 502/404 without one (spec §5.2/§6).
  status: "partner-required",
  capture: "unresolved",
  legs: {
    buy: {
      provider: "Paychant", kind: "ramp", class: "E", direction: "buy",
      from: "NGN@bank", to: "USDC@Stellar",
      // No static published minimum: /price returns live minimum/maximum
      // per query and the adapter gates on those. (A dated docs example
      // shows minimum 1000 / maximum 5000 in an NGN context — an example
      // payload, NOT a published current limit; never hardcoded.)
      min: null, max: null,
      minSource: "live from GET /price response (minimum/maximum fields)",
      tiers: [{ tier: "TU", ceiling: null, requires: "unpublished — KYC/AML managed inside the Paychant widget" }],
      tierSource: "developer.paychant.com, read 2026-11-27 — no tier schedule published",
      feeModel: "provider fee 1–2% buy (published range, by payment method), included in widget price",
      settleTime: "provider-claimed",
    },
    sell: {
      provider: "Paychant", kind: "ramp", class: "E", direction: "sell",
      from: "USDC@Stellar", to: "NGN@bank",
      min: null, max: null,
      minSource: "live from GET /price response (minimum/maximum fields)",
      tiers: [{ tier: "TU", ceiling: null, requires: "unpublished — KYC/AML managed inside the Paychant widget" }],
      tierSource: "developer.paychant.com, read 2026-11-27 — no tier schedule published",
      feeModel: "provider fee 1–2.5% sell (published range, by payment method), included in widget price",
      settleTime: "provider-claimed",
    },
  },
};

const PAYCHANT_EVENT_STATUS = {
  "WIDGET.CREATED": { status: "created", terminal: false },
  "WIDGET.AWAITING_PAYMENT": { status: "awaiting_payment", terminal: false },
  "WIDGET.PAYMENT_CONFIRMED": { status: "payment_confirmed", terminal: false },
  "WIDGET.PAYMENT_COMPLETED": { status: "completed", terminal: true },
  "WIDGET.PAYMENT_INSUFFICIENT": { status: "insufficient", terminal: false, needsAction: true },
  "WIDGET.PAYMENT_TIMEOUT": { status: "expired", terminal: true },
  "WIDGET.PAYMENT_FAILED": { status: "failed", terminal: true },
};

// Normalise a Paychant widget event (webhook body or onStatus payload —
// both carry { event, data: { transactionRef, partnerParams, fiat,
// asset, chain, action, fiatAmount, assetAmount, userAddress,
// exchangeRate, paymentMethod, env } }).
export function parsePaychantWidgetEvent(payload) {
  const event = payload?.event;
  const data = payload?.data || {};
  const mapped = PAYCHANT_EVENT_STATUS[event];
  if (!mapped) return { status: "unknown", terminal: false, event: event ?? null, raw: payload ?? null };
  return {
    ...mapped,
    event,
    reference: data.partnerParams?.reference_id ?? null,
    transactionRef: data.transactionRef ?? null,
    fiatAmount: typeof data.fiatAmount === "number" ? data.fiatAmount : null,
    assetAmount: typeof data.assetAmount === "number" ? data.assetAmount : null,
    destAddress: data.userAddress ?? null,
    raw: payload,
  };
}

// Pure builder for the PaychantWidget constructor argument (overlay
// embed). NG-first: Stellar USDC pre-selected, destination pre-set to
// the user's own Fluid Stellar address (the widget's walletAddress
// parameter — the RAMP_ADDRESS_ENTRY discipline: delivery goes to an
// address the user holds the keys to).
export function buildPaychantWidgetConfig({
  direction, partnerApiKey, env = "sandbox", destAddress,
  fiatAmount, assetAmount, reference, userEmail, webhookStatusUrl,
  themeColor, logoUrl,
}) {
  if (direction !== "buy" && direction !== "sell") throw new TypeError("direction must be buy or sell");
  if (!partnerApiKey) throw new TypeError("partnerApiKey is required");
  if (env !== "sandbox" && env !== "production") throw new TypeError("env must be sandbox or production");
  const cfg = {
    env,
    action: direction,
    partnerApiKey,
    listedAsset: PAYCHANT_STELLAR_USDC_ID,
    selectedAsset: PAYCHANT_STELLAR_USDC_ID,
    selectedFiatCurrency: "NGN",
  };
  if (destAddress) cfg.walletAddress = destAddress;
  if (fiatAmount != null) cfg.fiatAmount = fiatAmount;
  if (assetAmount != null) cfg.assetAmount = assetAmount;
  if (reference) cfg.partnerReferenceId = reference;
  if (userEmail) cfg.userEmailAddress = userEmail;
  if (webhookStatusUrl) cfg.webhookStatusUrl = webhookStatusUrl;
  if (themeColor) cfg.partnerThemeColor = themeColor;
  if (logoUrl) cfg.partnerLogoUrl = logoUrl;
  return cfg;
}

// The same configuration as a widget URL (redirect form). Sandbox links
// live under /sand/[action] per the docs' own sandbox example.
export function buildPaychantWidgetUrl(config) {
  const { env, action, ...rest } = config;
  const base = env === "sandbox"
    ? `${PAYCHANT_WIDGET_HOST}/sand/${action}`
    : `${PAYCHANT_WIDGET_HOST}/${action}`;
  const params = new URLSearchParams({ env, action });
  for (const [k, v] of Object.entries(rest)) {
    if (v != null) params.set(k, String(v));
  }
  return `${base}?${params.toString()}`;
}

// Launch the overlay with an injected SDK constructor (the global
// PaychantWidget in the browser; a fake in tests). A missing SDK is an
// honest failure, not a silent no-op.
export function openPaychantWidget(config, WidgetCtor) {
  if (typeof WidgetCtor !== "function") return rampUnavailable("sdk_unavailable", "Paychant SDK not loaded");
  try {
    new WidgetCtor(config).openWindow();
    return { ok: true };
  } catch (err) {
    return rampUnavailable("sdk_error", err?.message || String(err));
  }
}

export function createPaychantAdapter({
  partnerApiKey = null,
  env = "sandbox",
  apiBase = null, // REST base for /price — the public docs give paths,
                  // not a host; set from the issued partner pack.
  fetchImpl = null,
  feeBps = LUBRICA_FEE_BPS_DEFAULT,
  webhookStatusUrl = null,
} = {}) {
  checkFeeBps(feeBps);
  const descriptor = PAYCHANT_NG_DESCRIPTOR;

  // Quote via the REST price endpoint. Buy: price a fiat amount.
  // Sell: price an asset amount. The response's `price` is the
  // calculated destination amount; minimum/maximum gate the SOURCE
  // (fiat) side per the docs' field descriptions.
  async function getQuote({ direction, amount }) {
    const leg = descriptor.legs[direction];
    if (!leg) throw new TypeError("direction must be buy or sell");
    if (!isFinitePositive(amount)) throw new TypeError("amount must be a positive number");
    if (!apiBase) return rampUnavailable("unconfigured", "Paychant REST base URL not set (partner pack pending)");
    const params = new URLSearchParams({ iso: "NGA", action: direction, networkFee: "ON" });
    if (direction === "buy") params.set("fiatValue", String(amount));
    else params.set("assetValue", String(amount));
    const url = `${apiBase.replace(/\/$/, "")}/price/STELLAR/USDC?${params.toString()}`;
    const res = await rampFetchJson(fetchImpl, url, { method: "GET" });
    if (!res.ok) return res;
    const body = res.body;
    const destAmount = body?.price;
    const min = typeof body?.minimum === "number" ? body.minimum : null;
    const max = typeof body?.maximum === "number" ? body.maximum : null;
    if (!isFinitePositive(destAmount)) {
      return rampUnavailable("unavailable", "Paychant price response carried no usable price");
    }
    // Minimum/maximum are fiat-denominated: for a buy the source IS the
    // fiat amount; for a sell the fiat side is the destination amount.
    const fiatSide = direction === "buy" ? amount : destAmount;
    if (min != null && fiatSide < min) return rampUnavailable("below_minimum", `Paychant minimum is ${min} NGN`);
    if (max != null && fiatSide > max) return rampUnavailable("above_maximum", `Paychant maximum is ${max} NGN`);
    const { fee, net } = applyFluidFee(destAmount, feeBps);
    return {
      ok: true,
      quote: {
        provider: "Paychant", direction,
        sourceAmount: amount,
        sourceCurrency: direction === "buy" ? "NGN" : "USDC",
        destAmount, // gross, as priced by the provider
        destCurrency: direction === "buy" ? "USDC" : "NGN",
        fluidFee: fee, fluidFeeBps: feeBps,
        destAmountNet: net,
        rate: typeof body.nga === "number" ? body.nga : null,
        min, max,
        tier: rampEffectiveTier(leg, amount),
        expiresAt: null, // the price endpoint publishes no quote expiry
        raw: body,
      },
    };
  }

  // For a widget leg, "creating the order" = opening the widget session
  // with the destination pre-set. The returned order is the session
  // descriptor; settlement status arrives via parseStatus events and is
  // only final when confirmDelivery sees the credit on-chain.
  async function createOrder({ direction, amount, destAddress, reference, userEmail }) {
    if (!partnerApiKey) return rampUnavailable("unconfigured", "Paychant partner API key not set");
    if (!destAddress) throw new TypeError("destAddress (the user's own Fluid address) is required");
    const widgetConfig = buildPaychantWidgetConfig({
      direction, partnerApiKey, env, destAddress,
      fiatAmount: direction === "buy" ? amount : undefined,
      assetAmount: direction === "sell" ? amount : undefined,
      reference, userEmail, webhookStatusUrl,
    });
    return {
      ok: true,
      order: {
        provider: "Paychant", direction,
        reference: reference ?? null,
        status: "widget_open",
        destAddress,
        widgetConfig,
        widgetUrl: buildPaychantWidgetUrl(widgetConfig),
        raw: null,
      },
    };
  }

  return {
    provider: "Paychant",
    kind: "widget",
    descriptor,
    getQuote,
    createOrder,
    parseStatus: parsePaychantWidgetEvent,
    confirmDelivery: confirmRampDelivery,
  };
}

// ============================================================= FLIPEET ===
//
// API leg (spec §5.2). Chosen over Bitnob for the first API adapter —
// see the readiness note for the full comparison; in short, Flipeet's
// public docs publish the complete ramp contract (quote → order →
// status, both directions, exact request/response schemas), and ramps
// settle straight to the customer's own wallet/bank — "The money goes
// straight to them, not through your balance" — which is the spec's
// milestone rule (§1.3). Bitnob's documented flows settle through
// Bitnob-held business wallets/balances first.
//
// Sources (Flipeet's own public documentation, read 2026-11-27):
//   - https://docs.flipeet.io/guides/ramps — the flow, statuses
//     (AWAITING_DEPOSIT / COMPLETED / FAILED / EXPIRED), networks table
//     (Base carries USDC + cNGN; USDC is NOT on Base-USDT — Base: USDC ✓,
//     USDT ✗), fee semantics ("fee.total is everything your customer
//     pays in fees; with fee_inclusive true it's already taken out of
//     destination.amount").
//   - https://docs.flipeet.io/api-reference/ramps/get-an-on-ramp-quote
//     — POST /api/v1/public/on-ramp/quote, body { amount, asset,
//     network, currency, country, channel }, x-api-key auth, error
//     envelope { message, status: "error", statusCode, code, ... } with
//     stable codes (invalid_request, authentication_failed,
//     permission_denied, not_found, conflict, rate_limited,
//     internal_error, provider_error).
//   - .../create-an-on-ramp-order — POST /api/v1/public/on-ramp/
//     initialize; beneficiary { holder_type, holder_name,
//     wallet_address }; response nests data.data { reference, status,
//     rate, source, destination, deposit { bank_name, account_number,
//     account_name, amount }, beneficiary }.
//   - .../create-an-off-ramp-order — POST /api/v1/public/off-ramp/
//     initialize; beneficiary adds account_number + bank_code; deposit
//     { address, amount, asset: "base:usdc" }.
//   - https://docs.flipeet.io/sandbox — fpay_test_ keys select the
//     sandbox; fixed test rates (NGN 1,500 per USDC/USDT); responses
//     carry "livemode": false.
//   - Server: https://api.pay.flipeet.io (OpenAPI servers list).
//   - KEY CUSTODY (their quickstart, verbatim substance): secret keys
//     belong on a server — "Never put one in a mobile app, a browser or
//     a public repository." A raw fpay_live_ key therefore can NEVER
//     ship inside Fluid; live calls must go through a Lubrica backend
//     proxy that holds the key, or Flipeet must issue a restricted
//     public key. The adapter takes its base URL + key from config so
//     the proxy swap is configuration, not code. Sandbox keys are used
//     here only against injected transports in tests.
//   - Minimums and end-user KYC posture are NOT published in the public
//     docs (spec §5.2 records the same gap) ⇒ min null, tier TU ⇒ T3.

export const FLIPEET_API_BASE = "https://api.pay.flipeet.io";

export const FLIPEET_NG_DESCRIPTOR = {
  provider: "Flipeet",
  kind: "ramp",
  class: "E",
  integration: "api",
  status: "partner-required",
  capture: "unresolved", // partner fee terms are not in the public docs
  legs: {
    buy: {
      provider: "Flipeet", kind: "ramp", class: "E", direction: "buy",
      from: "NGN@bank", to: "USDC@Base",
      min: null, max: null,
      minSource: "unpublished in public docs (checked 2026-11-27)",
      tiers: [{ tier: "TU", ceiling: null, requires: "unpublished — end-user KYC posture absent from public docs" }],
      tierSource: "docs.flipeet.io, read 2026-11-27 — no tier schedule published",
      feeModel: "per-quote fee.total in the quote response (fee_inclusive flag states whether it is inside destination.amount)",
      settleTime: "provider-claimed",
    },
    sell: {
      provider: "Flipeet", kind: "ramp", class: "E", direction: "sell",
      from: "USDC@Base", to: "NGN@bank",
      min: null, max: null,
      minSource: "unpublished in public docs (checked 2026-11-27)",
      tiers: [{ tier: "TU", ceiling: null, requires: "unpublished — end-user KYC posture absent from public docs" }],
      tierSource: "docs.flipeet.io, read 2026-11-27 — no tier schedule published",
      feeModel: "per-quote fee.total in the quote response (fee_inclusive flag states whether it is inside destination.amount)",
      settleTime: "provider-claimed",
    },
  },
};

const FLIPEET_STATUS = {
  AWAITING_DEPOSIT: { status: "awaiting_deposit", terminal: false },
  COMPLETED: { status: "completed", terminal: true },
  FAILED: { status: "failed", terminal: true },
  EXPIRED: { status: "expired", terminal: true },
};

// Normalise a Flipeet order-status payload (order response node or a
// callback/webhook body carrying { reference, status, ... }).
export function parseFlipeetRampStatus(payload) {
  const node = payload?.data?.data ?? payload?.data ?? payload;
  const rawStatus = node?.status;
  const mapped = FLIPEET_STATUS[rawStatus];
  if (!mapped) return { status: "unknown", terminal: false, rawStatus: rawStatus ?? null, raw: payload ?? null };
  return {
    ...mapped,
    reference: node.reference ?? null,
    rate: typeof node.rate === "number" ? node.rate : null,
    raw: payload,
  };
}

// Unwrap Flipeet's envelope: { status: "success", data: { success,
// livemode, data: { ... } } } — or an error envelope. Returns the inner
// node or an unavailable result. A response whose livemode disagrees
// with the key's environment is rejected: a sandbox integration must
// never mistake a live response for a test one, or vice versa.
function unwrapFlipeet(body, expectLivemode) {
  if (!body || typeof body !== "object") return rampUnavailable("unavailable", "Flipeet returned a non-object body");
  if (body.status === "error") {
    return rampUnavailable("unavailable", `Flipeet error ${body.code || body.statusCode || "unknown"}`);
  }
  const node = body?.data?.data ?? body?.data ?? body;
  const livemode = body?.data?.livemode ?? node?.livemode;
  if (typeof livemode === "boolean" && livemode !== expectLivemode) {
    return rampUnavailable("unavailable", `Flipeet livemode mismatch (expected ${expectLivemode}, got ${livemode})`);
  }
  return { ok: true, node };
}

export function createFlipeetAdapter({
  apiKey = null,
  apiBase = FLIPEET_API_BASE,
  fetchImpl = null,
  feeBps = LUBRICA_FEE_BPS_DEFAULT,
  callbackUrl = null,
} = {}) {
  checkFeeBps(feeBps);
  // The key prefix selects the environment (docs: fpay_test_ = sandbox,
  // fpay_live_ = live). An unrecognised key is a configuration error,
  // surfaced at construction — never discovered mid-quote.
  let env = null;
  if (apiKey != null) {
    if (apiKey.startsWith("fpay_test_")) env = "sandbox";
    else if (apiKey.startsWith("fpay_live_")) env = "live";
    else throw new TypeError("unrecognised Flipeet API key prefix (expected fpay_test_ or fpay_live_)");
  }
  const descriptor = FLIPEET_NG_DESCRIPTOR;
  const base = apiBase.replace(/\/$/, "");

  async function call(path, payload) {
    if (!apiKey) return rampUnavailable("unconfigured", "Flipeet API key not set");
    return rampFetchJson(fetchImpl, `${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
    });
  }

  function quoteBody({ direction, amount }) {
    return {
      amount,
      asset: "usdc",
      network: "base",
      currency: "NGN",
      country: "NG",
      channel: "BANK",
    };
  }

  async function getQuote({ direction, amount }) {
    const leg = descriptor.legs[direction];
    if (!leg) throw new TypeError("direction must be buy or sell");
    if (!isFinitePositive(amount)) throw new TypeError("amount must be a positive number");
    const path = direction === "buy" ? "/api/v1/public/on-ramp/quote" : "/api/v1/public/off-ramp/quote";
    const res = await call(path, quoteBody({ direction, amount }));
    if (!res.ok) return res;
    const unwrapped = unwrapFlipeet(res.body, env === "live");
    if (!unwrapped.ok) return unwrapped;
    const node = unwrapped.node;
    const destAmount = node?.destination?.amount;
    const sourceAmount = node?.source?.amount;
    // Echo check: a quote for a different amount than requested is not
    // a quote for this trade — refuse it rather than render it.
    if (!isFinitePositive(destAmount) || sourceAmount !== amount) {
      return rampUnavailable("unavailable", "Flipeet quote response failed validation (missing destination or source echo mismatch)");
    }
    const providerFee = typeof node?.fee?.total === "number" ? node.fee.total : null;
    const feeInclusive = node?.fee_inclusive === true;
    // Normalisation (documented in the readiness note as a flip-on
    // confirmation item): fee.total is everything the customer pays in
    // fees; when it is not already inside destination.amount it still
    // comes out of the customer's side, so the honest user-net is
    // destination − providerFee(when exclusive) − Fluid fee.
    const { fee, net } = applyFluidFee(destAmount, feeBps);
    const destAmountNet = feeInclusive || providerFee == null ? net : rampRound(net - providerFee);
    return {
      ok: true,
      quote: {
        provider: "Flipeet", direction,
        sourceAmount: amount,
        sourceCurrency: direction === "buy" ? "NGN" : "USDC",
        destAmount, // as returned: destination.amount
        destCurrency: direction === "buy" ? "USDC" : "NGN",
        providerFee, feeInclusive,
        fluidFee: fee, fluidFeeBps: feeBps,
        destAmountNet,
        rate: typeof node?.rate === "number" ? node.rate : null,
        min: leg.min, max: leg.max,
        tier: rampEffectiveTier(leg, amount),
        expiresAt: null, // the public quote schema publishes no expiry
        raw: res.body,
      },
    };
  }

  // Create the order. Buy: beneficiary is the user's own Fluid Base
  // address (wallet_address). Sell: beneficiary is the user's bank
  // account (account_number + bank_code from Flipeet's List
  // institutions). The response's deposit block is what the user acts
  // on: a bank account to pay into (buy) or an address to send to
  // (sell) — value then settles straight to the beneficiary.
  async function createOrder({ direction, amount, reference, beneficiary }) {
    const leg = descriptor.legs[direction];
    if (!leg) throw new TypeError("direction must be buy or sell");
    if (!isFinitePositive(amount)) throw new TypeError("amount must be a positive number");
    if (!callbackUrl) return rampUnavailable("unconfigured", "Flipeet callback_url not set (status channel)");
    if (!beneficiary || typeof beneficiary !== "object") throw new TypeError("beneficiary is required");
    if (direction === "buy" && !beneficiary.wallet_address) {
      throw new TypeError("buy orders require beneficiary.wallet_address (the user's own Fluid address)");
    }
    if (direction === "sell" && (!beneficiary.account_number || !beneficiary.bank_code)) {
      throw new TypeError("sell orders require beneficiary.account_number and beneficiary.bank_code");
    }
    const ref = reference ?? `fluid_flipeet_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    const path = direction === "buy" ? "/api/v1/public/on-ramp/initialize" : "/api/v1/public/off-ramp/initialize";
    const res = await call(path, {
      ...quoteBody({ direction, amount }),
      reference: ref,
      callback_url: callbackUrl,
      beneficiary: { holder_type: "INDIVIDUAL", ...beneficiary },
    });
    if (!res.ok) return res;
    const unwrapped = unwrapFlipeet(res.body, env === "live");
    if (!unwrapped.ok) return unwrapped;
    const node = unwrapped.node;
    const status = parseFlipeetRampStatus(node);
    if (!node?.reference || !node?.deposit || status.status === "unknown") {
      return rampUnavailable("unavailable", "Flipeet order response failed validation (missing reference/deposit/status)");
    }
    if (status.terminal && status.status !== "completed") {
      return rampUnavailable("order_failed", `Flipeet order opened in terminal state ${node.status}`);
    }
    return {
      ok: true,
      order: {
        provider: "Flipeet", direction,
        reference: node.reference,
        status: status.status,
        rate: typeof node.rate === "number" ? node.rate : null,
        source: node.source ?? null,
        destination: node.destination ?? null,
        deposit: node.deposit, // buy: { bank_name, account_number, account_name, amount }
                               // sell: { address, amount, asset }
        beneficiary: node.beneficiary ?? beneficiary,
        raw: res.body,
      },
    };
  }

  return {
    provider: "Flipeet",
    kind: "api",
    descriptor,
    env,
    getQuote,
    createOrder,
    parseStatus: parseFlipeetRampStatus,
    confirmDelivery: confirmRampDelivery,
  };
}

// ------------------------------------------------------------ registry ---

// Adapter factories by provider name, for the day the flag flips. Kept
// separate from discovery so tests (and sandbox tooling) can construct
// adapters directly while the registry stays dark.
export const EMBEDDED_RAMP_FACTORIES = {
  Paychant: createPaychantAdapter,
  Flipeet: createFlipeetAdapter,
};

// The ONLY discovery entry point a future sheet/router may call. While
// EMBEDDED_RAMPS_ENABLED is false it returns [] regardless of config —
// an unproven, unkeyed route stays invisible (owner's order, 2026-11-27).
export function embeddedRampProviders(configs = {}) {
  if (!EMBEDDED_RAMPS_ENABLED) return [];
  const out = [];
  for (const [name, factory] of Object.entries(EMBEDDED_RAMP_FACTORIES)) {
    if (configs[name]) out.push(factory(configs[name]));
  }
  return out;
}
