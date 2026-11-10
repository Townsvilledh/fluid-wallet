// Bridge core end-to-end over a local relay with a mock NWC wallet:
// registration auth (ethers-signed, registry-checked), the callback
// round-trip, wallet-offline honesty, lying-wallet refusal, rate
// limiting, and unregister. Run: node test/bridge.test.mjs
import assert from "node:assert";
import { ethers } from "ethers";
import { createBridgeCore, buildRegisterMessage, buildUnregisterMessage } from "../src/bridge-core.mjs";
import { lnurlStep1, parseBolt11, lnurlMetadataSha256Hex } from "../src/lnurl.mjs";
import { generateNostrKeypair } from "../src/nostr.mjs";
import { startLocalRelay, openRelayWs } from "./local-relay.mjs";
import { startMockWallet } from "./mock-wallet.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const relay = await startLocalRelay();
try {
  const NAME = "lnurlqa";
  const owner = ethers.Wallet.createRandom();
  const stranger = ethers.Wallet.createRandom();
  const registry = { [NAME]: { evm: owner.address, btc: "bc1qexample", lnOffer: "lno1example" } };
  const kvStore = new Map();
  const kv = {
    get: async (k) => (kvStore.has(k) ? kvStore.get(k) : null),
    put: async (k, v) => { kvStore.set(k, v); },
    delete: async (k) => { kvStore.delete(k); },
  };
  const core = createBridgeCore({
    kv,
    fetchRegistry: async () => registry,
    openRelay: openRelayWs,
  });

  const walletKeys = generateNostrKeypair();
  const clientKeys = generateNostrKeypair();
  // Registration requires wss:// relay URLs (production rule). The
  // local relay is ws:// on loopback, so the flow runs through a
  // core whose transport shim maps the registered wss:// URL back
  // to the local relay — validation sees the production shape, the
  // wire stays local. The un-shimmed core asserts the ws refusal.
  const shimOpenRelay = (url) => openRelayWs(url.replace("wss://", "ws://"));
  const coreShim = createBridgeCore({ kv, fetchRegistry: async () => registry, openRelay: shimOpenRelay, callbackTimeoutMs: 3000 });
  const reg = {
    name: NAME,
    evm: owner.address,
    walletPub: walletKeys.pubHex,
    clientPub: clientKeys.pubHex,
    clientSecret: clientKeys.privHex,
    relays: [relay.url.replace("ws://", "wss://")],
    maxInvoiceMsat: 500000000,
    ts: Math.floor(Date.now() / 1000),
  };
  reg.sig = await owner.signMessage(buildRegisterMessage(reg));

  // --- registration: happy path ---
  let res = await coreShim.handleRegister(reg);
  assert.equal(res.httpStatus, 200, JSON.stringify(res));
  assert.equal(res.body.ok, true);
  assert.ok(kvStore.has("bridge:v1:" + NAME), "record stored");

  // --- registration: production core refuses a ws:// relay ---
  const regWs = { ...reg, relays: [relay.url], ts: reg.ts + 1 };
  regWs.sig = await owner.signMessage(buildRegisterMessage(regWs));
  res = await core.handleRegister(regWs);
  assert.equal(res.httpStatus, 400, "ws:// relay must be refused");

  // --- registration refusals ---
  const tampered = { ...reg, ts: reg.ts + 1, sig: reg.sig }; // ts moved after signing
  res = await coreShim.handleRegister(tampered);
  assert.equal(res.httpStatus, 403, "signature over different bytes must fail");

  const wrongOwner = { ...reg, ts: reg.ts + 1 };
  wrongOwner.sig = await stranger.signMessage(buildRegisterMessage(wrongOwner));
  res = await coreShim.handleRegister(wrongOwner);
  assert.equal(res.httpStatus, 403, "non-owner signature must fail");

  const secretMismatch = { ...reg, ts: reg.ts + 1, clientSecret: generateNostrKeypair().privHex };
  secretMismatch.sig = await owner.signMessage(buildRegisterMessage(secretMismatch));
  res = await coreShim.handleRegister(secretMismatch);
  assert.equal(res.httpStatus, 400, "secret not owning clientPub must fail");

  const stale = { ...reg, ts: Math.floor(Date.now() / 1000) - 3600 };
  stale.sig = await owner.signMessage(buildRegisterMessage(stale));
  res = await coreShim.handleRegister(stale);
  assert.equal(res.httpStatus, 400, "stale ts must fail");

  const replay = { ...reg }; // same ts as the stored record
  res = await coreShim.handleRegister(replay);
  assert.equal(res.httpStatus, 409, "replayed registration must fail");

  const unknownName = { ...reg, name: "nosuchname", ts: reg.ts + 1 };
  unknownName.sig = await owner.signMessage(buildRegisterMessage(unknownName));
  res = await coreShim.handleRegister(unknownName);
  assert.equal(res.httpStatus, 404, "unregistered name must fail");

  // --- step 1 (what a payer wallet fetches first) ---
  const step1 = lnurlStep1(NAME);
  assert.equal(step1.tag, "payRequest");

  // --- callback: wallet OFFLINE -> honest LUD-06 error ---
  res = await coreShim.handleCallback(NAME, "21000");
  assert.equal(res.body.status, "ERROR");
  assert.match(res.body.reason, /not open right now/);

  // --- callback: wallet ONLINE -> real invoice round-trip ---
  const wallet = await startMockWallet({ relayUrl: relay.url, walletPrivHex: walletKeys.privHex, clientPubHex: clientKeys.pubHex });
  await sleep(150);
  res = await coreShim.handleCallback(NAME, "21000");
  assert.equal(res.httpStatus, 200, JSON.stringify(res));
  assert.ok(typeof res.body.pr === "string" && res.body.pr.startsWith("lnbc"), "invoice returned");
  assert.deepEqual(res.body.routes, []);
  const parsed = parseBolt11(res.body.pr);
  assert.equal(parsed.amountMsat, 21000);
  assert.equal(parsed.descriptionHashHex, lnurlMetadataSha256Hex(NAME));
  assert.equal(wallet.seen.length, 1, "wallet saw exactly one request");
  assert.equal(wallet.seen[0].method, "make_invoice");
  assert.equal(wallet.seen[0].params.amount, 21000);
  assert.equal(wallet.seen[0].params.description_hash, lnurlMetadataSha256Hex(NAME));

  // --- callback: amount rules ---
  res = await coreShim.handleCallback(NAME, "999");
  assert.match(res.body.reason, /below the 1 satoshi minimum/);
  res = await coreShim.handleCallback(NAME, "500000001");
  assert.match(res.body.reason, /above this address's per-payment limit/);
  res = await coreShim.handleCallback(NAME, "abc");
  assert.equal(res.body.status, "ERROR");
  res = await coreShim.handleCallback(NAME, null);
  assert.equal(res.body.status, "ERROR");
  res = await coreShim.handleCallback("nosuchname", "21000");
  assert.equal(res.httpStatus, 404);

  // --- callback: a lying wallet is refused, never passed through ---
  wallet.close();
  await sleep(100);
  const liar = await startMockWallet({ relayUrl: relay.url, walletPrivHex: walletKeys.privHex, clientPubHex: clientKeys.pubHex, mode: "wrong-amount" });
  await sleep(150);
  res = await coreShim.handleCallback(NAME, "21000");
  assert.equal(res.body.status, "ERROR");
  assert.match(res.body.reason, /wrong amount/);
  liar.close();
  await sleep(100);
  const hashLiar = await startMockWallet({ relayUrl: relay.url, walletPrivHex: walletKeys.privHex, clientPubHex: clientKeys.pubHex, mode: "wrong-hash" });
  await sleep(150);
  res = await coreShim.handleCallback(NAME, "21000");
  assert.equal(res.body.status, "ERROR");
  assert.match(res.body.reason, /wrong description hash/);
  hashLiar.close();

  // --- rate limit: 30/min per name ---
  // Below-minimum amounts return instantly after the limiter counts
  // them, so the loop is fast; the limiter must trip at 30/min.
  let limited = null;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await coreShim.handleCallback(NAME, "999");
    if (r.body && /Too many/.test(r.body.reason || "")) limited = r;
  }
  assert.ok(limited, "rate limit must trip");

  // --- unregister: owner-signed removal kills the record ---
  const un = { name: NAME, evm: owner.address, ts: Math.floor(Date.now() / 1000) };
  un.sig = await owner.signMessage(buildUnregisterMessage(un));
  res = await coreShim.handleUnregister(un);
  assert.equal(res.httpStatus, 200, JSON.stringify(res));
  assert.ok(!kvStore.has("bridge:v1:" + NAME), "record deleted");
  res = await coreShim.handleCallback(NAME, "21000");
  assert.equal(res.httpStatus, 404, "callback dies with the record");

  const unBad = { name: NAME, evm: owner.address, ts: Math.floor(Date.now() / 1000) };
  unBad.sig = await stranger.signMessage(buildUnregisterMessage(unBad));
  res = await coreShim.handleUnregister(unBad);
  assert.equal(res.httpStatus, 403, "non-owner removal must fail");

  console.log("bridge.test.mjs: all checks passed");
} finally {
  await relay.close();
}
