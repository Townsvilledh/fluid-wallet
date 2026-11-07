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

export const LN_NETWORKS = {
  bitcoin: { label: "Bitcoin mainnet", esplora: "https://mempool.space/api" },
  signet: { label: "Signet (test coins)", esplora: "https://mempool.space/signet/api" },
  testnet: { label: "Testnet3 (test coins)", esplora: "https://mempool.space/testnet/api" },
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
    ws.onclose = () => { active.sockets.delete(connId); try { sock.node.socket_closed(connId); } catch { /* node gone */ } };
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
// Session
// ---------------------------------------------------------------------------

export async function bootLightning({ phrase, network = "bitcoin", wsProxy = "" }) {
  const net = LN_NETWORKS[network] || LN_NETWORKS.bitcoin;
  const seed = deriveLightningSeed(phrase);
  const storageKey = deriveLightningStorageKey(phrase);
  // The bridge must be live before the node constructor reads state.
  active = {
    prefix: `fluidln.v1.${network}.`,
    storageKey, esplora: net.esplora, wsProxy,
    node: null, sockets: new Map(),
  };
  await init(new URL("fluid_lightning_bg.wasm", import.meta.url));
  const tipHeight = Number(await fetchText(`${net.esplora}/blocks/tip/height`));
  const tipHash = (await fetchText(`${net.esplora}/blocks/tip/hash`)).trim();
  const nowSecs = Math.floor(Date.now() / 1000);
  const node = new FluidNode(seed, network, tipHeight, tipHash, nowSecs, "wallet");
  active.node = node;

  const session = {
    node,
    network,
    esplora: net.esplora,
    nodeId: node.node_id(),
    balance: () => JSON.parse(node.balance()),
    channels: () => JSON.parse(node.channels()),
    history: () => JSON.parse(node.history()),
    drainEvents: () => JSON.parse(node.drain_events()),
    pendingFunding: () => JSON.parse(node.pending_funding()),
    connectPeer: (pubkey, host, port) => node.connect_peer(pubkey, host, port),
    openChannel: (pubkey, amountSat, pushMsat = 0n) => node.open_channel(pubkey, BigInt(amountSat), BigInt(pushMsat)),
    fundingTxReady: (userChannelId, rawTxHex) => node.funding_tx_ready(userChannelId, rawTxHex),
    closeChannel: (channelId, force) => node.close_channel(channelId, force),
    createInvoice: (amountMsat, description) => node.create_invoice(amountMsat == null ? null : BigInt(amountMsat), description, 3600),
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
      session.timers = [pump, chain, minute];
      syncChain(session).catch(() => {});
    },
    stopLoops() { session.timers.forEach(clearInterval); session.timers = []; },
  };
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
