// Fluid's in-app Lightning node — LAZY-LOADED CHUNK.
//
// app.js imports this module dynamically ONLY when the Lightning panel
// opens, so the rust-lightning WASM (several MB) never inflates the
// main bundle. The single-file build (dist/fluid-wallet.html) has no
// chunk beside it; there the panel keeps the WebLN/LNURL fallback.
//
// Custody: the node is rust-lightning (LDK) compiled to WASM, seeded
// from the wallet's existing BIP-39 phrase via the HKDF branch in
// wallet-core (deriveLightningSeed). Keys never leave the device. Node
// state (channel manager + monitors) is persisted through the host
// bridge below into localStorage, AES-256-GCM-encrypted at rest with a
// SEPARATE HKDF branch (deriveLightningStorageKey) — the stored bytes
// are ciphertext; the key exists only in memory while unlocked.
//
// Hosts are dumb pipes by construction (see lightning/src/lib.rs): the
// bridge can withhold service but can never sign or move funds.
//
// Browser limits, stated plainly:
//  * Browsers cannot open raw TCP sockets. Peer connections run over
//    WebSocket: either the peer itself serves a wss:// endpoint, or a
//    WebSocket-to-TCP proxy the user configures (URL template with
//    {host}/{port}) carries the bytes. The proxy sees only encrypted
//    Noise traffic — it cannot read or alter payments.
//  * The node only runs while the panel/app is open. Receiving while
//    closed is what the BOLT 12 async offer + wake-up push are for
//    (see docs/LIGHTNING.md).

import init, { FluidNode } from "../lightning/pkg-web/fluid_lightning.js";
import { gcm } from "@noble/ciphers/aes.js";
import { deriveLightningSeed, deriveLightningStorageKey } from "./ln-derive.js";
import { parseLnPeerBook, serializeLnPeerBook, upsertLnPeer, removeLnPeer, lnPeerConnState } from "./ln-peers.js";
import { fetchPinnedAsset, LnAssetError } from "./ln-download.js";

export const LN_NETWORKS = {
  bitcoin: { label: "Bitcoin mainnet", esplora: "https://mempool.space/api" },
  signet: { label: "Signet (test coins)", esplora: "https://mempool.space/signet/api" },
  testnet: { label: "Testnet3 (test coins)", esplora: "https://mempool.space/testnet/api" },
};

/** Fluid's own WebSocket→TCP proxy for browser→peer transport
 *  (tools/ws-proxy — a dumb pipe: it sees only Noise-encrypted bytes
 *  and its worst failure is refusing to carry them). EMPTY until the
 *  proxy is deployed: deployment is an ops step, and until then raw
 *  TCP peers (like Megalith) are reachable only when the user sets
 *  their own proxy template in the panel's Advanced section. The
 *  value is a URL template with {host}/{port}, same shape as the
 *  panel's per-user setting. */
// Generation marker: the app bundle verifies the chunk it loaded
// carries this flag before trusting it with a boot. A stale cached
// chunk from an older build lacks it and is refused plainly (with a
// reload hint) instead of silently booting an old harness.
export const LN_PINNED_BOOT = true;

export const LN_DEFAULT_WS_PROXY = "";

/** Fluid's notification relay for wake-up pushes (tools/
 *  notification-relay). EMPTY until deployed — while empty the
 *  panel's wake-up section says so plainly instead of offering a
 *  flow that cannot complete. */
export const LN_DEFAULT_RELAY_URL = "";

/** The default LSP: Megalith's LSPS2/LSPS1 endpoint (raw TCP — from
 *  a browser it is reached through the WebSocket proxy above). The
 *  token is Megalith's published public-access token. */
export const LN_LSP = {
  pubkey: "034066e29e402d9cf55af1ae1026cc5adf92eed1e0e421785442f53717ad1453b0",
  host: "64.23.159.177",
  port: 9735,
  token: "any",
};

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf8 = (s) => new TextEncoder().encode(s);

// ---------------------------------------------------------------------------
// Host bridge. The WASM resolves `FluidLnHost` per call, so one active
// session at a time is supported — the panel boots one network at once.
// ---------------------------------------------------------------------------

let active = null; // { prefix, storageKey, esplora, wsProxy, node, sockets }

function kvStoreKey(key) { return active.prefix + key; }

globalThis.FluidLnHost = {
  kvHas(key) {
    return active != null && localStorage.getItem(kvStoreKey(key)) != null;
  },
  kvGet(key) {
    const raw = localStorage.getItem(kvStoreKey(key));
    if (raw == null) return new Uint8Array();
    const all = unb64(raw);
    const nonce = all.subarray(0, 12);
    return gcm(active.storageKey, nonce).decrypt(all.subarray(12));
  },
  kvSet(key, value) {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ct = gcm(active.storageKey, nonce).encrypt(value);
    const all = new Uint8Array(12 + ct.length);
    all.set(nonce); all.set(ct, 12);
    localStorage.setItem(kvStoreKey(key), b64(all));
  },
  kvDel(key) { localStorage.removeItem(kvStoreKey(key)); },
  kvKeys(prefix) {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(active.prefix)) {
        const inner = k.slice(active.prefix.length);
        if (inner.startsWith(prefix)) out.push(inner);
      }
    }
    return out;
  },
  broadcast(txBytes) {
    // Fire-and-forget: LDK re-broadcasts on its own schedule if a tx
    // doesn't land, and the chain driver confirms what it sees.
    const hex = [...txBytes].map((x) => x.toString(16).padStart(2, "0")).join("");
    fetch(`${active.esplora}/tx`, { method: "POST", body: hex }).catch(() => {});
  },
  wsOpen(connId, host, port) {
    if (!active) return;
    let url = null;
    if (/^wss?:\/\//i.test(host)) url = host;
    else if (active.wsProxy) url = active.wsProxy.replace("{host}", encodeURIComponent(host)).replace("{port}", String(port));
    if (!url) {
      // No way to reach this peer from a browser: report the socket as
      // closed (asynchronously — never call back synchronously).
      queueMicrotask(() => { try { active.node.socket_closed(connId); } catch { /* node gone */ } });
      return;
    }
    let ws;
    try { ws = new WebSocket(url); } catch { queueMicrotask(() => { try { active.node.socket_closed(connId); } catch { /* node gone */ } }); return; }
    ws.binaryType = "arraybuffer";
    const sock = { ws, node: active.node };
    active.sockets.set(connId, sock);
    ws.onopen = () => drainSocket(connId);
    ws.onmessage = (ev) => {
      try { sock.node.socket_data(connId, new Uint8Array(ev.data)); } catch { /* node gone */ }
      drainSocket(connId);
    };
    ws.onclose = () => { active.sockets.delete(connId); try { sock.node.socket_closed(connId); } catch { /* node gone */ } if (active.onSocketClosed) { try { active.onSocketClosed(connId); } catch { /* session gone */ } } };
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
  },
  wsNotify(connId) { drainSocket(connId); },
  wsClose(connId) {
    const sock = active && active.sockets.get(connId);
    if (sock) { active.sockets.delete(connId); try { sock.ws.close(); } catch { /* already closing */ } }
  },
  logMsg(msg) { console.debug("[fluid-ln]", msg); },
};

function drainSocket(connId) {
  const sock = active && active.sockets.get(connId);
  if (!sock || sock.ws.readyState !== 1) return;
  try {
    const bytes = sock.node.take_outbound(connId);
    if (bytes.length) sock.ws.send(bytes);
  } catch { /* node gone */ }
}

// ---------------------------------------------------------------------------
// Chain sync driver (Esplora). Mirrors the crate's contract: confirm
// what is confirmed (with its real index in its real block), unconfirm
// what vanished, then move the best block — in that order.
// ---------------------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Esplora ${res.status} for ${url}`);
  return res.text();
}

async function syncChain(session) {
  const base = session.esplora;
  const node = session.node;
  const tipHeight = Number(await fetchText(`${base}/blocks/tip/height`));
  const tipHash = (await fetchText(`${base}/blocks/tip/hash`)).trim();
  const tipHeader = (await fetchText(`${base}/block/${tipHash}/header`)).trim();
  try {
    const fees = await (await fetch(`${base}/v1/fees/recommended`)).json();
    // mempool.space reports sat/vB; LDK wants sat/kwu (×250).
    const kwu = (satVb) => Math.max(253, Math.round(satVb * 250));
    node.set_fee_estimates(kwu(fees.hourFee || 1), kwu(fees.halfHourFee || 2), kwu(fees.fastestFee || 5));
  } catch { /* keep previous estimates */ }
  for (const txid of node.relevant_txids()) {
    let tx;
    try { tx = await (await fetch(`${base}/tx/${txid}`)).json(); } catch { continue; }
    if (!tx || !tx.status) continue;
    if (!tx.status.confirmed) continue; // LDK picks it up once mined
    const { block_hash: blockHash, block_height: height } = tx.status;
    try {
      const header = (await fetchText(`${base}/block/${blockHash}/header`)).trim();
      const hex = (await fetchText(`${base}/tx/${txid}/hex`)).trim();
      const txids = await (await fetch(`${base}/block/${blockHash}/txids`)).json();
      const idx = txids.indexOf(txid);
      if (idx >= 0) node.confirm_transactions(header, height, [idx], [hex]);
    } catch { /* retry next cycle */ }
  }
  node.best_block_updated(tipHeight, tipHash, tipHeader);
}

// ---------------------------------------------------------------------------
// Boot staging + the resumable asset store.
//
// Boot failures must say WHICH leg failed (owner field evidence,
// 2026-11-10): the old single "Failed to fetch" hid whether it was
// the 12 MB node program on a slow connection, the chain-tip read,
// or the node itself. LnBootError carries the stage; the panel turns
// it into plain words + a Retry that resumes rather than restarts.
// ---------------------------------------------------------------------------

export class LnBootError extends Error {
  constructor(stage, message, cause) {
    super(message);
    this.name = "LnBootError";
    this.stage = stage; // "download" | "integrity" | "chain" | "node"
    this.cause = cause;
  }
}

// Chunk store for the resumable download (ln-download.js): IndexedDB
// when available (chunks survive app closes and phone sleeps), an
// in-memory map otherwise (download still works; only the resume
// guarantee degrades, and the progress callback says so honestly).
function lnAssetStore() {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
    let dbp = null;
    const open = () => (dbp ||= new Promise((resolve, reject) => {
      const req = indexedDB.open("fluid-ln-assets", 1);
      req.onupgradeneeded = () => { req.result.createObjectStore("kv"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
    const reqP = (req) => new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return {
      persisted: true,
      store: {
        async get(k) { const db = await open(); return reqP(db.transaction("kv", "readonly").objectStore("kv").get(k)); },
        async set(k, v) { const db = await open(); await reqP(db.transaction("kv", "readwrite").objectStore("kv").put(v, k)); },
        async del(k) { const db = await open(); await reqP(db.transaction("kv", "readwrite").objectStore("kv").delete(k)); },
      },
    };
  } catch {
    const map = new Map();
    return {
      persisted: false,
      store: {
        async get(k) { return map.get(k); },
        async set(k, v) { map.set(k, v); },
        async del(k) { map.delete(k); },
      },
    };
  }
}

async function fetchTip(net) {
  // The tip read is two tiny requests; retry once before blaming the
  // connection — on mobile networks single requests drop constantly.
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tipHeight = Number(await fetchText(`${net.esplora}/blocks/tip/height`));
      const tipHash = (await fetchText(`${net.esplora}/blocks/tip/hash`)).trim();
      return { tipHeight, tipHash };
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function bootLightning({ phrase, network = "bitcoin", wsProxy = "", wasmPin = null, onProgress = () => {} }) {
  const net = LN_NETWORKS[network] || LN_NETWORKS.bitcoin;
  const seed = deriveLightningSeed(phrase);
  const storageKey = deriveLightningStorageKey(phrase);
  // The bridge must be live before the node constructor reads state.
  active = {
    prefix: `fluidln.v1.${network}.`,
    storageKey, esplora: net.esplora, wsProxy: wsProxy || LN_DEFAULT_WS_PROXY,
    node: null, sockets: new Map(), onSocketClosed: null,
  };
  // Stage 1 — the node program itself. With a pin from the main
  // bundle, the WASM arrives through the resumable, hash-verified
  // download (ln-download.js): inert chunks in IndexedDB, assembled
  // and instantiated ONLY after length + SHA-256 pass. Without a pin
  // (a context the main bundle couldn't vouch for) fall back to the
  // plain same-origin init.
  if (wasmPin && wasmPin.sha256 && wasmPin.bytes) {
    const { store, persisted } = lnAssetStore();
    let got;
    try {
      got = await fetchPinnedAsset({
        url: new URL("fluid_lightning_bg.wasm", import.meta.url).href,
        sha256: wasmPin.sha256,
        bytes: wasmPin.bytes,
        store,
        onProgress: (p) => onProgress("download", { ...p, persisted }),
      });
    } catch (e) {
      if (e instanceof LnAssetError) throw new LnBootError(e.stage, e.message, e);
      throw new LnBootError("download", "The node program couldn't be downloaded: " + (e && e.message ? e.message : e), e);
    }
    onProgress("verify", { repairedChunks: got.repairedChunks, fromStore: got.fromStore });
    await init(got.bytes);
  } else {
    await init(new URL("fluid_lightning_bg.wasm", import.meta.url));
  }
  // Stage 2 — the chain tip the node starts from.
  onProgress("chain", {});
  let tip;
  try {
    tip = await fetchTip(net);
  } catch (e) {
    throw new LnBootError("chain", "Your node program loaded, but Fluid couldn't read the Bitcoin chain tip to start it: " + (e && e.message ? e.message : e), e);
  }
  // Stage 3 — construct the node over its persisted state.
  onProgress("node", {});
  const nowSecs = Math.floor(Date.now() / 1000);
  let node;
  try {
    node = new FluidNode(seed, network, tip.tipHeight, tip.tipHash, nowSecs, "wallet");
  } catch (e) {
    throw new LnBootError("node", "Your node couldn't start: " + (e && e.message ? e.message : e), e);
  }
  active.node = node;

  // Peer book (audit G10): persisted in the node's own encrypted KV
  // (the bridge above), so the peers our channels live on are
  // re-dialled after every restart without the user re-typing them.
  const kv = globalThis.FluidLnHost;
  const loadBook = () => {
    try {
      if (!kv.kvHas("peers")) return [];
      return parseLnPeerBook(new TextDecoder().decode(kv.kvGet("peers")));
    } catch { return []; }
  };
  const saveBook = (book) => {
    try { kv.kvSet("peers", utf8(serializeLnPeerBook(book))); } catch { /* storage blocked */ }
  };

  const session = {
    node,
    network,
    esplora: net.esplora,
    nodeId: node.node_id(),
    balance: () => JSON.parse(node.balance()),
    channels: () => JSON.parse(node.channels()),
    history: () => JSON.parse(node.history()),
    // Draining events also feeds the handshake ledger below: the
    // crate serialises LDK's OnionMessagePeerConnected as
    // "peer_back_online" — the peer manager emits it only after
    // the Noise handshake AND the init exchange complete, so it
    // is the node's own proof a peer is truly connected (F2).
    // Every drain passes through here, whoever the caller is.
    drainEvents: () => {
      const evs = JSON.parse(node.drain_events());
      for (const ev of evs) {
        if (ev && ev.type === "peer_back_online" && ev.peer) session.peerReady.add(String(ev.peer).toLowerCase());
      }
      return evs;
    },
    pendingFunding: () => JSON.parse(node.pending_funding()),
    // --- Peer book + connection supervision ---
    peerBook: loadBook(),
    liveConns: new Map(), // connId -> pubkey
    peerReady: new Set(), // pubkeys whose Lightning handshake LDK has confirmed (peer_back_online)
    peerRetry: new Map(), // pubkey -> { nextMs, delayMs, dialed }
    peerLive(pubkey) {
      if (!active || active.node !== node) return false;
      for (const [connId, pk] of session.liveConns) {
        if (pk !== pubkey) continue;
        const sock = active.sockets.get(connId);
        if (sock && (sock.ws.readyState === 0 || sock.ws.readyState === 1)) return true;
      }
      return false;
    },
    dialPeer(peer) {
      const clean = parseLnPeerBook([peer])[0];
      if (!clean) throw new Error("That peer doesn't look right — check the pubkey, host and port.");
      if (session.peerLive(clean.pubkey)) return null;
      const connId = node.connect_peer(clean.pubkey, clean.host, clean.port);
      session.liveConns.set(connId, clean.pubkey);
      return connId;
    },
    connectPeer: (pubkey, host, port) => {
      const clean = parseLnPeerBook([{ pubkey, host, port }])[0];
      if (!clean) throw new Error("That peer doesn't look right — check the pubkey, host and port.");
      session.peerBook = upsertLnPeer(session.peerBook, clean);
      saveBook(session.peerBook);
      return session.dialPeer(clean);
    },
    disconnectPeer: (pubkey) => {
      session.peerBook = removeLnPeer(session.peerBook, pubkey);
      saveBook(session.peerBook);
      session.peerReady.delete(String(pubkey || "").toLowerCase());
    },
    // Truth in three states (F2): "connected" only when the
    // socket is live AND LDK has confirmed the handshake; a
    // dialled socket still handshaking is "connecting"; no
    // socket is "disconnected". Never "connected" on dial alone.
    peerStatus: () => session.peerBook.map((p) => ({
      ...p, state: lnPeerConnState({ socketLive: session.peerLive(p.pubkey), handshaken: session.peerReady.has(p.pubkey) }),
    })),
    _socketClosed(connId) {
      const pubkey = session.liveConns.get(connId);
      session.liveConns.delete(connId);
      // The last socket for a peer dying voids its handshake
      // proof: a re-dial must earn "connected" again, not inherit
      // it while the new handshake is still running.
      if (pubkey && ![...session.liveConns.values()].includes(pubkey)) session.peerReady.delete(pubkey);
    },
    // Boot dials every book peer; afterwards the supervisor re-dials
    // only peers that hold channels with us and have no live socket,
    // with per-peer backoff (30 s doubling to a 5 min cap).
    supervisePeers(initial = false) {
      try {
        if (!active || active.node !== node) return;
        const chanPeers = new Set(session.channels().map((c) => String(c.counterparty).toLowerCase()));
        const now = Date.now();
        for (const p of session.peerBook) {
          if (session.peerLive(p.pubkey)) { session.peerRetry.delete(p.pubkey); continue; }
          if (!initial && !chanPeers.has(p.pubkey)) continue;
          const retry = session.peerRetry.get(p.pubkey) || { nextMs: 0, delayMs: 30000, dialed: false };
          if (now < retry.nextMs) continue;
          if (retry.dialed) retry.delayMs = Math.min(300000, retry.delayMs * 2);
          try { session.dialPeer(p); } catch { /* refusal counts as a failed dial */ }
          retry.dialed = true;
          retry.nextMs = Date.now() + retry.delayMs;
          session.peerRetry.set(p.pubkey, retry);
        }
      } catch { /* node gone */ }
    },
    openChannel: (pubkey, amountSat, pushMsat = 0n) => node.open_channel(pubkey, BigInt(amountSat), BigInt(pushMsat)),
    fundingTxReady: (userChannelId, rawTxHex) => node.funding_tx_ready(userChannelId, rawTxHex),
    closeChannel: (channelId, force) => node.close_channel(channelId, force),
    createInvoice: (amountMsat, description) => node.create_invoice(amountMsat == null ? null : BigInt(amountMsat), description, 3600),
    createInvoiceJit: (amountMsat, description, expirySecs, lspPubkey, interceptScid, cltvDelta) => node.create_invoice_jit(BigInt(amountMsat), description, expirySecs, lspPubkey, String(interceptScid), cltvDelta),
    // --- LSPS (LSPS1 orders + LSPS2 JIT) over the node's events ---
    lsp: LN_LSP,
    defaultWsProxy: LN_DEFAULT_WS_PROXY,
    defaultRelayUrl: LN_DEFAULT_RELAY_URL,
    lsps2RequestParams: (lspPubkey, token) => node.lsps2_request_params(lspPubkey, token || ""),
    lsps2SelectParams: (requestId, menuIndex, paymentSizeMsat) => node.lsps2_select_params(requestId, menuIndex, paymentSizeMsat == null ? null : BigInt(paymentSizeMsat)),
    lsps1RequestOptions: (lspPubkey) => node.lsps1_request_options(lspPubkey),
    lsps1CreateOrder: (lspPubkey, lspBalanceSat) => node.lsps1_create_order(lspPubkey, BigInt(lspBalanceSat)),
    lsps1CheckOrder: (lspPubkey, orderId) => node.lsps1_check_order(lspPubkey, orderId),
    payInvoice: (invoice, amountMsat) => node.pay_invoice(invoice, amountMsat == null ? null : BigInt(amountMsat)),
    payOffer: (offer, amountMsat) => node.pay_offer(offer, amountMsat == null ? null : BigInt(amountMsat)),
    createOffer: (amountMsat, description) => node.create_offer(amountMsat == null ? null : BigInt(amountMsat), description),
    sisPathsForRecipient: (recipientId) => JSON.parse(node.sis_paths_for_recipient(recipientId)),
    setSisPaths: (paths) => node.set_sis_paths(paths),
    asyncReceiveOffer: () => node.async_receive_offer(),
    syncNow: () => syncChain(session),
    timers: [],
    startLoops(onEvents) {
      const pump = setInterval(() => {
        try {
          node.tick();
          const evs = session.drainEvents();
          if (evs.length && onEvents) onEvents(evs);
        } catch { /* node gone */ }
      }, 2000);
      const chain = setInterval(() => { syncChain(session).catch(() => {}); }, 20000);
      // The manager timer is a ~once-a-minute protocol input (it also
      // drives the async-offer refresh cycle) — not a busy loop.
      const minute = setInterval(() => { try { node.timer_tick(); } catch { /* node gone */ } }, 60000);
      const supervisor = setInterval(() => { session.supervisePeers(false); }, 30000);
      session.timers = [pump, chain, minute, supervisor];
      syncChain(session).catch(() => {});
      session.supervisePeers(true);
    },
    stopLoops() { session.timers.forEach(clearInterval); session.timers = []; },
  };
  active.onSocketClosed = (connId) => session._socketClosed(connId);
  return session;
}

// ---------------------------------------------------------------------------
// Wake-up push (LSPS5 / bLIP-55 client side).
//
// The peer/static-invoice server fires a signed webhook at the relay
// when a payment is held for us; the relay sends a Web Push; the
// service worker (sw.js) shows "Payment received — open Fluid to claim
// it" and deep-links the tap to the Lightning panel. userVisibleOnly
// is always true: every push shows a notification (Chrome's rule).
// ---------------------------------------------------------------------------

export async function subscribeWakeUp({ relayUrl, nodeId }) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser doesn't support Web Push wake-ups.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const base = String(relayUrl || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) throw new Error("Relay URL must start with https://");
  const keyRes = await fetch(`${base}/vapid-public-key`);
  if (!keyRes.ok) throw new Error("Could not reach the notification relay.");
  const { publicKey } = await keyRes.json();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: unb64(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
  });
  // Stable, non-identifying subscription id: first 32 hex chars of the
  // node id's SHA-256. The webhook URL for the peer is <relay>/webhook/<id>.
  const digest = await crypto.subtle.digest("SHA-256", utf8(nodeId));
  const id = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const res = await fetch(`${base}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error("The relay refused the subscription.");
  return { id, webhookUrl: `${base}/webhook/${id}` };
}
