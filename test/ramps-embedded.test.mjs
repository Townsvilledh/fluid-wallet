// Lubrica embedded-ramp adapter tests — run via npm test.
// All provider traffic is faked with injected transports; fixtures are
// built from the providers' own public documentation (see the source
// citations in src/ramps-embedded.js). No network, no keys, no live
// provider is touched.
import assert from "node:assert";
import {
  EMBEDDED_RAMPS_ENABLED, embeddedRampProviders, EMBEDDED_RAMP_FACTORIES,
  LUBRICA_FEE_BPS_CAP, applyFluidFee, gateRampAmount, rampEffectiveTier,
  confirmRampDelivery,
  PAYCHANT_STELLAR_USDC_ID, buildPaychantWidgetConfig, buildPaychantWidgetUrl,
  openPaychantWidget, parsePaychantWidgetEvent, createPaychantAdapter,
  FLIPEET_API_BASE, parseFlipeetRampStatus, createFlipeetAdapter,
} from "../src/ramps-embedded.js";

let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log("✓", name); passed++; };

// A fetch stand-in that records calls and replays a scripted response.
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  impl.calls = calls;
  return impl;
}
const jsonResponse = (body, status = 200) => ({ status, json: async () => body });

// ------------------------------------------------------------- fee law ---

{
  const { fee, net } = applyFluidFee(200, 50);
  ok("fee: 50 bps on 200 is exactly 1, net 199", fee === 1 && net === 199);
  const zero = applyFluidFee(200, 0);
  ok("fee: 0 bps charges nothing", zero.fee === 0 && zero.net === 200);
  assert.throws(() => applyFluidFee(200, LUBRICA_FEE_BPS_CAP + 1), RangeError);
  ok("fee: bps above the 0.5% fee-law cap is refused", true);
  assert.throws(() => createFlipeetAdapter({ apiKey: "fpay_test_x", feeBps: 75 }), RangeError);
  ok("fee: an adapter cannot be constructed above the cap", true);
}

// ------------------------------------------------------- tier / gating ---

{
  const tuLeg = { min: null, max: null, tiers: [{ tier: "TU", ceiling: null, requires: "unpublished" }] };
  ok("tier: an unpublished (TU) leg routes as T3", rampEffectiveTier(tuLeg, 100) === "T3");
  const gate = gateRampAmount(tuLeg, 100, "lowest");
  ok("tier: default ceiling completes a TU leg but discloses T3", gate.feasible === true && gate.tier === "T3" && gate.tierDisclosed === true);
  const capped = gateRampAmount(tuLeg, 100, "T1");
  ok("tier: a hard T1 ceiling refuses a TU (T3) leg", capped.feasible === false && capped.reason === "tier_above_ceiling");
  const minLeg = { min: 1000, max: 5000, tiers: [{ tier: "T1", ceiling: null, requires: "BVN" }] };
  ok("gate: below the published minimum is infeasible", gateRampAmount(minLeg, 500).reason === "below_minimum");
  ok("gate: above the published maximum is infeasible", gateRampAmount(minLeg, 6000).reason === "above_maximum");
  const inBand = gateRampAmount(minLeg, 2000);
  ok("gate: in-band amount at a published T1 tier is feasible at T1", inBand.feasible === true && inBand.tier === "T1" && inBand.requires === "BVN");
}

// ---------------------------------------------------- delivery confirm ---

{
  ok("delivery: 95 of 100 quoted is inside the 90% band", confirmRampDelivery({ expectedAmount: 100, receivedAmount: 95 }).delivered === true);
  ok("delivery: exactly 90 of 100 is inside the band", confirmRampDelivery({ expectedAmount: 100, receivedAmount: 90 }).delivered === true);
  const short = confirmRampDelivery({ expectedAmount: 100, receivedAmount: 80 });
  ok("delivery: 80 of 100 is NOT delivered and reports the shortfall", short.delivered === false && short.shortfall === 20);
  ok("delivery: nothing arrived is not delivered", confirmRampDelivery({ expectedAmount: 100, receivedAmount: 0 }).delivered === false);
}

// ------------------------------------------------------------ registry ---

{
  ok("flag: embedded ramps ship DISABLED", EMBEDDED_RAMPS_ENABLED === false);
  ok("flag: discovery returns no providers while disabled, even with config supplied",
    embeddedRampProviders({ Paychant: { partnerApiKey: "k" }, Flipeet: { apiKey: "fpay_test_k" } }).length === 0);
  ok("registry: both adapter factories are registered for flip-on day",
    typeof EMBEDDED_RAMP_FACTORIES.Paychant === "function" && typeof EMBEDDED_RAMP_FACTORIES.Flipeet === "function");
}

// ------------------------------------------------------------- Paychant ---

{
  const d = createPaychantAdapter({}).descriptor;
  ok("paychant descriptor: E-leg widget, partner-required, NG both directions",
    d.class === "E" && d.integration === "widget" && d.status === "partner-required" && !!d.legs.buy && !!d.legs.sell);
  ok("paychant descriptor: Stellar USDC both ways, TU tier, no invented static minimum",
    d.legs.buy.to === "USDC@Stellar" && d.legs.sell.from === "USDC@Stellar"
    && d.legs.buy.tiers[0].tier === "TU" && d.legs.buy.min === null);
}

{
  // Price fixture in the docs' response shape ({ usd, <fiat>, price,
  // minimum, maximum }); numbers are this test's, fields are theirs.
  const fetchImpl = fakeFetch(async () => jsonResponse({ usd: 1, nga: 1500, price: 99.3, minimum: 1000, maximum: 5000000 }));
  const adapter = createPaychantAdapter({ partnerApiKey: "pk_test", apiBase: "https://paychant.test", fetchImpl });
  const res = await adapter.getQuote({ direction: "buy", amount: 150000 });
  ok("paychant quote: buy prices NGN → USDC with Fluid's fee applied on destination",
    res.ok === true && res.quote.destAmount === 99.3 && res.quote.fluidFee === 0.4965 && res.quote.destAmountNet === 98.8035);
  ok("paychant quote: live minimum/maximum and T3 (TU) tier ride the quote",
    res.quote.min === 1000 && res.quote.max === 5000000 && res.quote.tier === "T3");
  const call = fetchImpl.calls[0];
  ok("paychant quote: request hits /price/STELLAR/USDC with iso/action/fiatValue",
    call.url.startsWith("https://paychant.test/price/STELLAR/USDC?") && call.url.includes("iso=NGA")
    && call.url.includes("action=buy") && call.url.includes("fiatValue=150000"));
}

{
  const fetchImpl = fakeFetch(async () => jsonResponse({ usd: 1, nga: 1500, price: 0.3, minimum: 1000, maximum: 5000000 }));
  const adapter = createPaychantAdapter({ partnerApiKey: "pk_test", apiBase: "https://paychant.test", fetchImpl });
  const res = await adapter.getQuote({ direction: "buy", amount: 500 });
  ok("paychant quote: below the live minimum is refused, not quoted", res.ok === false && res.reason === "below_minimum" && !("quote" in res));
}

{
  const down = createPaychantAdapter({ partnerApiKey: "pk", apiBase: "https://paychant.test", fetchImpl: fakeFetch(async () => { throw new Error("socket hangup"); }) });
  const resDown = await down.getQuote({ direction: "buy", amount: 10000 });
  ok("paychant honesty: a transport failure is unavailable, never a fake quote", resDown.ok === false && resDown.reason === "unavailable" && !("quote" in resDown));
  const http500 = createPaychantAdapter({ partnerApiKey: "pk", apiBase: "https://paychant.test", fetchImpl: fakeFetch(async () => jsonResponse({}, 500)) });
  ok("paychant honesty: HTTP 500 is unavailable", (await http500.getQuote({ direction: "buy", amount: 10000 })).reason === "unavailable");
  const noPrice = createPaychantAdapter({ partnerApiKey: "pk", apiBase: "https://paychant.test", fetchImpl: fakeFetch(async () => jsonResponse({ usd: 1, nga: 1500 })) });
  ok("paychant honesty: a price response with no price is unavailable", (await noPrice.getQuote({ direction: "buy", amount: 10000 })).reason === "unavailable");
  const unconfigured = createPaychantAdapter({ partnerApiKey: "pk" });
  ok("paychant honesty: no REST base configured → unconfigured, not a guess", (await unconfigured.getQuote({ direction: "buy", amount: 10000 })).reason === "unconfigured");
}

{
  const cfg = buildPaychantWidgetConfig({
    direction: "buy", partnerApiKey: "pk_sandbox", env: "sandbox",
    destAddress: "GUSEROWNEDSTELLARADDRESS", fiatAmount: 150000, reference: "fluid_pc_1",
  });
  ok("paychant widget config: sandbox buy, Stellar USDC preselected, destination pre-set to the user's own address",
    cfg.env === "sandbox" && cfg.action === "buy" && cfg.listedAsset === PAYCHANT_STELLAR_USDC_ID
    && cfg.selectedAsset === "stellar_usdc" && cfg.walletAddress === "GUSEROWNEDSTELLARADDRESS"
    && cfg.selectedFiatCurrency === "NGN" && cfg.partnerReferenceId === "fluid_pc_1");
  const url = buildPaychantWidgetUrl(cfg);
  ok("paychant widget url: sandbox path /sand/buy carries key + address",
    url.startsWith("https://widget.paychant.com/sand/buy?") && url.includes("partnerApiKey=pk_sandbox")
    && url.includes("walletAddress=GUSEROWNEDSTELLARADDRESS"));
  let launched = null;
  class FakeWidget { constructor(c) { launched = c; } openWindow() {} }
  ok("paychant widget launch: injected SDK constructor is used", openPaychantWidget(cfg, FakeWidget).ok === true && launched === cfg);
  ok("paychant widget launch: missing SDK is an honest failure", openPaychantWidget(cfg, undefined).reason === "sdk_unavailable");
  const adapter = createPaychantAdapter({ partnerApiKey: "pk_sandbox", env: "sandbox" });
  const order = await adapter.createOrder({ direction: "buy", amount: 150000, destAddress: "GUSEROWNEDSTELLARADDRESS", reference: "fluid_pc_1" });
  ok("paychant order: a widget session opens against the user's own address",
    order.ok === true && order.order.status === "widget_open" && order.order.destAddress === "GUSEROWNEDSTELLARADDRESS"
    && order.order.widgetUrl.startsWith("https://widget.paychant.com/sand/buy?"));
  const noKey = createPaychantAdapter({});
  ok("paychant order: no partner key → unconfigured", (await noKey.createOrder({ direction: "buy", amount: 1, destAddress: "GABC" })).reason === "unconfigured");
}

{
  // Event payload in the docs' webhook shape.
  const completed = parsePaychantWidgetEvent({
    event: "WIDGET.PAYMENT_COMPLETED",
    data: { transactionRef: "7CMJS1Q90GS79AA", partnerParams: { reference_id: "fluid_pc_1" }, fiatAmount: 150000, assetAmount: 99.3, userAddress: "GUSEROWNEDSTELLARADDRESS" },
  });
  ok("paychant status: PAYMENT_COMPLETED is terminal completion carrying our reference",
    completed.status === "completed" && completed.terminal === true && completed.reference === "fluid_pc_1" && completed.assetAmount === 99.3);
  ok("paychant status: AWAITING_PAYMENT is non-terminal",
    parsePaychantWidgetEvent({ event: "WIDGET.AWAITING_PAYMENT", data: {} }).status === "awaiting_payment");
  ok("paychant status: PAYMENT_FAILED is terminal failure",
    parsePaychantWidgetEvent({ event: "WIDGET.PAYMENT_FAILED", data: {} }).terminal === true);
  ok("paychant status: an undocumented event is unknown, never guessed",
    parsePaychantWidgetEvent({ event: "WIDGET.SOMETHING_NEW", data: {} }).status === "unknown");
}

// -------------------------------------------------------------- Flipeet ---

{
  const d = createFlipeetAdapter({ apiKey: "fpay_test_x" }).descriptor;
  ok("flipeet descriptor: E-leg API, partner-required, NG both directions, TU tier, unpublished minimum",
    d.class === "E" && d.integration === "api" && d.status === "partner-required"
    && d.legs.buy.to === "USDC@Base" && d.legs.sell.from === "USDC@Base"
    && d.legs.buy.tiers[0].tier === "TU" && d.legs.buy.min === null);
  ok("flipeet env: fpay_test_ keys select sandbox", createFlipeetAdapter({ apiKey: "fpay_test_x" }).env === "sandbox");
  ok("flipeet env: fpay_live_ keys select live", createFlipeetAdapter({ apiKey: "fpay_live_x" }).env === "live");
  assert.throws(() => createFlipeetAdapter({ apiKey: "sk_whatever" }), TypeError);
  ok("flipeet env: an unrecognised key prefix is refused at construction", true);
}

// Quote fixture: envelope + fields per the docs (source/destination/
// fee.total/fee_inclusive/rate/livemode); amounts follow the docs' own
// worked example (₦150,000 at the sandbox rate 1,500 → 99.25 USDC).
const flipeetQuoteBody = (overrides = {}) => ({
  message: "Successfully", status: "success", statusCode: 200,
  data: {
    success: true, message: "Quote returned", livemode: false,
    data: {
      reference: "q_1", rate: 1500,
      source: { amount: 150000, currency: "NGN" },
      destination: { amount: 99.25, currency: "usdc" },
      fee: { total: 0.75 }, fee_inclusive: true,
      ...overrides,
    },
  },
});

{
  const fetchImpl = fakeFetch(async () => jsonResponse(flipeetQuoteBody()));
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl, callbackUrl: "https://hooks.example/flipeet" });
  const res = await adapter.getQuote({ direction: "buy", amount: 150000 });
  ok("flipeet quote: destination, provider fee and Fluid fee all surface; net is honest",
    res.ok === true && res.quote.destAmount === 99.25 && res.quote.providerFee === 0.75
    && res.quote.fluidFee === 0.49625 && res.quote.destAmountNet === 98.75375 && res.quote.rate === 1500);
  const call = fetchImpl.calls[0];
  const sentBody = JSON.parse(call.init.body);
  ok("flipeet quote: request is the documented on-ramp quote (USDC/Base/NG/BANK) with the key header",
    call.url === `${FLIPEET_API_BASE}/api/v1/public/on-ramp/quote`
    && call.init.headers["x-api-key"] === "fpay_test_key"
    && sentBody.asset === "usdc" && sentBody.network === "base" && sentBody.country === "NG" && sentBody.channel === "BANK");
}

{
  const fetchImpl = fakeFetch(async () => jsonResponse(flipeetQuoteBody({ fee: { total: 1 }, fee_inclusive: false, destination: { amount: 100, currency: "usdc" } })));
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl, callbackUrl: "https://hooks.example/f" });
  const res = await adapter.getQuote({ direction: "buy", amount: 150000 });
  ok("flipeet quote: a non-inclusive provider fee still comes out of the user's net (100 − 0.5 Fluid − 1 provider = 98.5)",
    res.ok === true && res.quote.destAmountNet === 98.5 && res.quote.feeInclusive === false);
}

{
  const fetchImpl = fakeFetch(async () => jsonResponse(flipeetQuoteBody({ source: { amount: 999, currency: "NGN" } })));
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl, callbackUrl: "https://hooks.example/f" });
  const res = await adapter.getQuote({ direction: "buy", amount: 150000 });
  ok("flipeet honesty: a quote echoing a different source amount is refused", res.ok === false && res.reason === "unavailable" && !("quote" in res));
}
{
  const liveBody = flipeetQuoteBody(); liveBody.data.livemode = true;
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl: fakeFetch(async () => jsonResponse(liveBody)), callbackUrl: "https://hooks.example/f" });
  ok("flipeet honesty: a live-mode response under a sandbox key is refused", (await adapter.getQuote({ direction: "buy", amount: 150000 })).reason === "unavailable");
}
{
  const errBody = { message: "Too many requests", status: "error", statusCode: 429, code: "rate_limited", details: null };
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl: fakeFetch(async () => jsonResponse(errBody, 429)), callbackUrl: "https://hooks.example/f" });
  ok("flipeet honesty: a provider error envelope is unavailable with its code", (await adapter.getQuote({ direction: "buy", amount: 150000 })).detail?.includes("rate_limited") === true);
  const down = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl: fakeFetch(async () => { throw new Error("DNS"); }), callbackUrl: "https://hooks.example/f" });
  ok("flipeet honesty: a transport failure is unavailable, never a fake quote", (await down.getQuote({ direction: "buy", amount: 150000 })).reason === "unavailable");
  const noKey = createFlipeetAdapter({ fetchImpl: fakeFetch(async () => jsonResponse({})), callbackUrl: "https://hooks.example/f" });
  ok("flipeet honesty: no key → unconfigured", (await noKey.getQuote({ direction: "buy", amount: 150000 })).reason === "unconfigured");
}

// Order fixtures use the docs' own worked examples (on-ramp ramp_901 /
// Providus Bank; off-ramp ramp_902), with livemode false for sandbox.
const flipeetBuyOrderBody = {
  message: "Successfully", status: "success", statusCode: 201,
  data: {
    success: true, message: "Onramp initiated", livemode: false,
    data: {
      reference: "ramp_901", status: "AWAITING_DEPOSIT", rate: 1500,
      source: { amount: 150000, currency: "NGN" },
      destination: { amount: 99.25, currency: "usdc" },
      deposit: { bank_name: "Providus Bank", account_number: "9100482736", account_name: "Flipeet / Ngozi Eze", amount: 150000 },
      beneficiary: { holder_type: "INDIVIDUAL", holder_name: "Ngozi Eze", wallet_address: "0x5aE1c3B0d2F4e6A8b0C2d4E6f8A0b2C4d6E89c21" },
    },
  },
};
const flipeetSellOrderBody = {
  message: "Successfully", status: "success", statusCode: 201,
  data: {
    success: true, message: "Offramp initiated", livemode: false,
    data: {
      reference: "ramp_902", status: "AWAITING_DEPOSIT", rate: 1500,
      source: { amount: 100, currency: "usdc" },
      destination: { amount: 149250, currency: "NGN" },
      deposit: { address: "0x91c4d2E6f8A0b2C4d6E8f0A2b4C6d8E0f2A4b6C8", amount: 100, asset: "base:usdc" },
      beneficiary: { holder_type: "INDIVIDUAL", holder_name: "Chidi Okafor", account_number: "0123456789", bank_code: "044" },
    },
  },
};

{
  const fetchImpl = fakeFetch(async () => jsonResponse(flipeetBuyOrderBody, 201));
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl, callbackUrl: "https://hooks.example/flipeet" });
  const res = await adapter.createOrder({
    direction: "buy", amount: 150000, reference: "ramp_901",
    beneficiary: { holder_name: "Ngozi Eze", wallet_address: "0x5aE1c3B0d2F4e6A8b0C2d4E6f8A0b2C4d6E89c21" },
  });
  ok("flipeet buy order: opens AWAITING_DEPOSIT with the deposit bank details to show the user",
    res.ok === true && res.order.status === "awaiting_deposit" && res.order.deposit.account_number === "9100482736"
    && res.order.reference === "ramp_901");
  const sentBody = JSON.parse(fetchImpl.calls[0].init.body);
  ok("flipeet buy order: beneficiary is the user's own wallet address; callback + reference are sent",
    sentBody.beneficiary.wallet_address === "0x5aE1c3B0d2F4e6A8b0C2d4E6f8A0b2C4d6E89c21"
    && sentBody.beneficiary.holder_type === "INDIVIDUAL" && sentBody.callback_url === "https://hooks.example/flipeet"
    && sentBody.reference === "ramp_901");
}

{
  const fetchImpl = fakeFetch(async () => jsonResponse(flipeetSellOrderBody, 201));
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl, callbackUrl: "https://hooks.example/flipeet" });
  const res = await adapter.createOrder({
    direction: "sell", amount: 100, reference: "ramp_902",
    beneficiary: { holder_name: "Chidi Okafor", account_number: "0123456789", bank_code: "044" },
  });
  ok("flipeet sell order: opens with a deposit address for the stablecoin and NGN 149,250 to the user's bank",
    res.ok === true && res.order.deposit.address === "0x91c4d2E6f8A0b2C4d6E8f0A2b4C6d8E0f2A4b6C8"
    && res.order.destination.amount === 149250 && res.order.destination.currency === "NGN");
  await assert.rejects(() => adapter.createOrder({ direction: "sell", amount: 100, beneficiary: { holder_name: "X" } }), TypeError);
  ok("flipeet sell order: missing bank details is a programming error, rejected not hidden", true);
}

{
  const failedBody = JSON.parse(JSON.stringify(flipeetBuyOrderBody));
  failedBody.data.data.status = "FAILED";
  const adapter = createFlipeetAdapter({ apiKey: "fpay_test_key", fetchImpl: fakeFetch(async () => jsonResponse(failedBody, 201)), callbackUrl: "https://hooks.example/f" });
  const res = await adapter.createOrder({ direction: "buy", amount: 150000, reference: "r_x", beneficiary: { holder_name: "N", wallet_address: "0xabc" } });
  ok("flipeet honesty: an order opening in a terminal FAILED state is reported failed", res.ok === false && res.reason === "order_failed");
}

{
  ok("flipeet status: AWAITING_DEPOSIT → awaiting_deposit (non-terminal)",
    parseFlipeetRampStatus({ reference: "r1", status: "AWAITING_DEPOSIT" }).status === "awaiting_deposit");
  const done = parseFlipeetRampStatus({ data: { data: { reference: "r1", status: "COMPLETED" } } });
  ok("flipeet status: COMPLETED unwraps the envelope and is terminal", done.status === "completed" && done.terminal === true && done.reference === "r1");
  ok("flipeet status: EXPIRED is terminal", parseFlipeetRampStatus({ status: "EXPIRED" }).terminal === true);
  ok("flipeet status: an undocumented status is unknown, never guessed",
    parseFlipeetRampStatus({ status: "PROCESSING_SOMEHOW" }).status === "unknown");
}

console.log(`\n${passed} checks passed`);
