// ln-nwc-bridge.js — the Fluid app's half of the LNURL-pay bridge
// that makes `name@fluidwallet.dpdns.org` payable from OTHER
// Lightning wallets (Wallet of Satoshi, Blink, Phoenix, ...).
//
// How it fits together (see docs + the bridge Worker):
//   - Other wallets resolve the address to a static step-1 file on
//     the site, then ask the bridge Worker for an invoice.
//   - The Worker asks THIS wallet, over Nostr Wallet Connect
//     (NIP-47, make_invoice only), to mint the invoice with its own
//     LDK node. Funds flow payer -> this node directly; the Worker
//     never touches a payment and holds no fund keys.
//   - The connection is scoped: the responder answers make_invoice
//     from exactly ONE client pubkey (the bridge's), enforces the
//     per-invoice cap below, and can be revoked here at any time —
//     revocation deletes the Worker record and unpublishes the
//     step-1 file (via the lnBridge name-claim flag).
//
// The wallet's NWC identity is DERIVED from the wallet phrase
// (path m/9419/122447 — Fluid's NWC derivation v1, mirroring how
// name-claim transport keys are derived at m/9419/121924): no new
// secret is created or stored for the wallet side. The bridge
// CLIENT keypair is generated fresh per registration; the app
// keeps only its public key (the secret lives with the Worker,
// which is the client — after registration this device never
// needs it again, and losing it is healed by re-registering).
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { schnorr } from "@noble/curves/secp256k1.js";
import {
  nip44Encrypt, nip44Decrypt, nip44ConversationKey,
  hexToBytes, bytesToHex, randomBytes, sha256, utf8,
} from "./ln-nip44.js";

export const LN_BRIDGE_BASE = "https://fluid-ws-proxy.kanugideontownsville.workers.dev";
export const LN_BRIDGE_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
export const LN_BRIDGE_MAX_INVOICE_MSAT = 1_000_000_000; // 1,000,000 sats — matches step-1 maxSendable
export const LN_BRIDGE_MIN_INVOICE_MSAT = 1000;
export const LN_NWC_DERIVATION_PATH = "m/9419/122447";

const STORAGE_PREFIX = "fluid.lnBridge.v1.";

// --- canonical registration messages -------------------------------
// The EXACT bytes the owner's EVM key signs; the bridge Worker
// builds the identical strings (pinned by a shared sample in both
// test suites).
export function buildRegisterMessage({ name, evm, walletPub, clientPub, relays, maxInvoiceMsat, ts }) {
  return [
    "Fluid LNURL bridge registration v1",
    "name: " + name,
    "evm: " + String(evm).toLowerCase(),
    "wallet: " + walletPub,
    "client: " + clientPub,
    "relays: " + (relays || []).join(","),
    "maxInvoiceMsat: " + String(maxInvoiceMsat),
    "ts: " + String(ts),
  ].join("\n");
}

export function buildUnregisterMessage({ name, evm, ts }) {
  return [
    "Fluid LNURL bridge removal v1",
    "name: " + name,
    "evm: " + String(evm).toLowerCase(),
    "ts: " + String(ts),
  ].join("\n");
}

// --- keys ----------------------------------------------------------
export function lnBridgeWalletKeys(phrase) {
  const seed = mnemonicToSeedSync(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const node = HDKey.fromMasterSeed(seed).derive(LN_NWC_DERIVATION_PATH);
  if (!node.privateKey) throw new Error("Could not derive this wallet's bridge key.");
  const priv = node.privateKey;
  return { priv, privHex: bytesToHex(priv), pubHex: bytesToHex(schnorr.getPublicKey(priv)) };
}

export function generateBridgeClientKeys() {
  const priv = randomBytes(32);
  return { privHex: bytesToHex(priv), pubHex: bytesToHex(schnorr.getPublicKey(priv)) };
}

// --- persisted opt-in state (per wallet, this device) --------------
function storageOr(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}
export function loadLnBridgeState(evm, storage) {
  const s = storageOr(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_PREFIX + String(evm).toLowerCase());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.v === 1 ? parsed : null;
  } catch { return null; }
}
export function saveLnBridgeState(state, storage) {
  const s = storageOr(storage);
  if (!s) return;
  try { s.setItem(STORAGE_PREFIX + String(state.evm).toLowerCase(), JSON.stringify(state)); } catch { /* private mode etc. — the bridge simply stays off */ }
}
export function clearLnBridgeState(evm, storage) {
  const s = storageOr(storage);
  if (!s) return;
  try { s.removeItem(STORAGE_PREFIX + String(evm).toLowerCase()); } catch { /* ignore */ }
}

// --- registration --------------------------------------------------
async function postBridge(path, body, fetchFn) {
  const f = fetchFn || globalThis.fetch;
  const resp = await f(LN_BRIDGE_BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try { parsed = await resp.json(); } catch { /* non-JSON error page */ }
  if (!resp.ok || !parsed || parsed.ok !== true) {
    throw new Error((parsed && parsed.reason) || `Bridge request failed (${resp.status}).`);
  }
  return parsed;
}

/**
 * Register this wallet as the invoice-minter for `name`.
 * `signMessage` is the unlocked EVM signer's personal_sign
 * (signerWallet.signMessage). Returns the persisted state. After
 * this resolves, the caller republishes the name claim with
 * lnBridge: true so the processor emits the step-1 file — the
 * address is only ever presented as externally payable once BOTH
 * halves confirm (registration here + the published file).
 */
export async function registerLnBridge({ name, evm, phrase, signMessage, relays = LN_BRIDGE_RELAYS, fetchFn, storage }) {
  const wallet = lnBridgeWalletKeys(phrase);
  const client = generateBridgeClientKeys();
  const ts = Math.floor(Date.now() / 1000);
  const fields = {
    name, evm, walletPub: wallet.pubHex, clientPub: client.pubHex,
    relays, maxInvoiceMsat: LN_BRIDGE_MAX_INVOICE_MSAT, ts,
  };
  const sig = await signMessage(buildRegisterMessage(fields));
  await postBridge("/lnurl-bridge/register", { ...fields, clientSecret: client.privHex, sig }, fetchFn);
  const state = { v: 1, ...fields, enabledAt: ts };
  saveLnBridgeState(state, storage);
  return state;
}

/** Remove the bridge registration (Worker record deleted). The
 *  caller then republishes the name claim WITHOUT lnBridge so the
 *  step-1 file is withdrawn. Local state is cleared either way. */
export async function unregisterLnBridge({ name, evm, signMessage, fetchFn, storage }) {
  const ts = Math.floor(Date.now() / 1000);
  const fields = { name, evm, ts };
  const sig = await signMessage(buildUnregisterMessage(fields));
  try {
    await postBridge("/lnurl-bridge/unregister", { ...fields, sig }, fetchFn);
  } finally {
    clearLnBridgeState(evm, storage);
  }
}

// --- NWC responder ---------------------------------------------------
function nostrEventId(ev) {
  const ser = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
  return bytesToHex(sha256(utf8(ser)));
}
function signEvent(priv, fields) {
  const ev = {
    pubkey: bytesToHex(schnorr.getPublicKey(priv)),
    created_at: Math.floor(Date.now() / 1000),
    kind: fields.kind,
    tags: fields.tags || [],
    content: fields.content || "",
  };
  ev.id = nostrEventId(ev);
  ev.sig = bytesToHex(schnorr.sign(hexToBytes(ev.id), priv));
  return ev;
}
function verifyEvent(ev) {
  try {
    return nostrEventId(ev) === ev.id && schnorr.verify(hexToBytes(ev.sig), hexToBytes(ev.id), hexToBytes(ev.pubkey));
  } catch { return false; }
}

/**
 * Answer make_invoice requests from the bridge while the wallet is
 * open. `mintInvoice({amountMsat, descriptionHashHex})` must return
 * a BOLT11 invoice string minted by this wallet's own node (the
 * caller wires the receive-plan-aware minter, incl. the LSPS2 JIT
 * path for a wallet with no receiving room yet) and throw on any
 * refusal — refusals become NWC errors, which the bridge turns
 * into the honest "wallet could not create an invoice" message.
 * Returns { stop, walletPubHex }.
 */
export function startLnBridgeResponder({ phrase, clientPubHex, mintInvoice, relays = LN_BRIDGE_RELAYS, onLog = () => {} }) {
  const keys = lnBridgeWalletKeys(phrase);
  const convKey = nip44ConversationKey(keys.priv, clientPubHex);
  const answered = new Set();
  const answeredOrder = [];
  let stopped = false;
  const sockets = new Map();

  function remember(id) {
    answered.add(id);
    answeredOrder.push(id);
    if (answeredOrder.length > 500) answered.delete(answeredOrder.shift());
  }

  async function handleRequest(ws, ev) {
    if (answered.has(ev.id)) return;
    remember(ev.id);
    const reply = (contentObj) => {
      const content = nip44Encrypt(JSON.stringify(contentObj), convKey);
      const resp = signEvent(keys.priv, {
        kind: 23195,
        tags: [["p", clientPubHex], ["e", ev.id]],
        content,
      });
      try { ws.send(JSON.stringify(["EVENT", resp])); } catch { /* relay gone; payer times out honestly */ }
    };
    const fail = (code, message) => reply({ result_type: "make_invoice", error: { code, message } });
    let req;
    try {
      req = JSON.parse(nip44Decrypt(ev.content, convKey));
    } catch { return; } // undecryptable: not for us / not valid — stay silent
    if (!req || req.method !== "make_invoice") { fail("NOT_IMPLEMENTED", "Only make_invoice is supported."); return; }
    const amount = Number(req.params && req.params.amount);
    const descHash = String((req.params && req.params.description_hash) || "");
    if (!Number.isInteger(amount) || amount < LN_BRIDGE_MIN_INVOICE_MSAT || amount > LN_BRIDGE_MAX_INVOICE_MSAT) {
      fail("QUOTA_EXCEEDED", "Amount outside this address's limits.");
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(descHash)) { fail("INTERNAL", "A description hash is required."); return; }
    try {
      const invoice = await mintInvoice({ amountMsat: amount, descriptionHashHex: descHash });
      if (typeof invoice !== "string" || !invoice.startsWith("lnbc")) throw new Error("minter returned no mainnet invoice");
      reply({ result_type: "make_invoice", result: { type: "make_invoice", invoice } });
    } catch (e) {
      onLog("mint refused: " + (e && e.message ? e.message : e));
      fail("INTERNAL", "This wallet could not create an invoice right now.");
    }
  }

  function connect(url) {
    if (stopped) return;
    let ws;
    try { ws = new WebSocket(url); } catch { scheduleReconnect(url); return; }
    sockets.set(url, ws);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      try {
        ws.send(JSON.stringify(["EVENT", signEvent(keys.priv, {
          kind: 13194,
          tags: [["encryption", "nip44_v2"]],
          content: "make_invoice",
        })]));
        ws.send(JSON.stringify(["REQ", "fluid-ln-bridge", { kinds: [23194], "#p": [keys.pubHex] }]));
      } catch { /* close handler will reconnect */ }
    };
    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(String(msg.data)); } catch { return; }
      if (!Array.isArray(data) || data[0] !== "EVENT") return;
      const ev = data[2];
      if (!ev || ev.kind !== 23194 || ev.pubkey !== clientPubHex) return;
      if (!verifyEvent(ev)) return;
      handleRequest(ws, ev);
    };
    ws.onclose = () => { sockets.delete(url); if (opened) scheduleReconnect(url); else scheduleReconnect(url); };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }
  const timers = new Set();
  function scheduleReconnect(url) {
    if (stopped) return;
    const t = setTimeout(() => { timers.delete(t); connect(url); }, 5000);
    timers.add(t);
  }
  for (const url of relays) connect(url);

  return {
    walletPubHex: keys.pubHex,
    stop() {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      for (const ws of sockets.values()) { try { ws.close(); } catch { /* ignore */ } }
      sockets.clear();
    },
  };
}
