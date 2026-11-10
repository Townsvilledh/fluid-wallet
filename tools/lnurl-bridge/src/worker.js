// fluid-ws-proxy + LNURL bridge — Cloudflare Worker.
//
// Two jobs, one deployment:
//  1. The original WebSocket -> TCP proxy (browser -> Lightning
//     peer): wss://<host>/<peer-host>/9735. Unchanged behavior and
//     unchanged trust model: it carries BOLT 8 Noise ciphertext
//     only; no keys, no funds; worst failure is liveness.
//  2. The LNURL-pay bridge (see ./bridge-core.mjs): 
//       POST /lnurl-bridge/register     — owner-signed registration
//       POST /lnurl-bridge/unregister   — owner-signed removal
//       GET  /lnurlp/callback/<name>?amount=<msat>
//         -> asks the name owner's own Fluid wallet, over Nostr
//            Wallet Connect (make_invoice only), to mint the
//            invoice, and returns it as LUD-06 requires.
//     The Worker never holds funds or fund keys; it holds one
//     make_invoice-scoped NWC client secret per opted-in name.
//
// Bindings (wrangler.toml / dashboard):
//   LNURL_BRIDGE — Workers KV namespace holding bridge records.
//
// Source layout: this file is bundled with esbuild before upload
// (deploy uploads a single module):
//   esbuild src/worker.js --bundle --format=esm \
//     --external:cloudflare:sockets --outfile=worker.bundle.js

import { connect } from "cloudflare:sockets";
import { createBridgeCore } from "./bridge-core.mjs";

const ALLOWED_PORTS = new Set([9735]);
const REGISTRY_URL = "https://fluidwallet.dpdns.org/names.json";
const MAX_BODY_BYTES = 16384;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function jsonResponse(httpStatus, body) {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json", ...CORS },
  });
}

/** NWC relay transport for Workers: a client WebSocket is opened by
 *  fetching the relay URL with an Upgrade header. */
async function openRelay(url) {
  const resp = await fetch(url, { headers: { Upgrade: "websocket" } });
  const ws = resp.webSocket;
  if (!ws) throw new Error("relay refused the websocket upgrade");
  ws.accept();
  let handler = () => {};
  ws.addEventListener("message", (ev) => {
    if (typeof ev.data === "string") handler(ev.data);
  });
  return {
    send: (text) => ws.send(text),
    setOnMessage: (fn) => { handler = fn; },
    close: () => { try { ws.close(); } catch { /* gone */ } },
  };
}

function bridgeCore(env) {
  const kv = env.LNURL_BRIDGE;
  return createBridgeCore({
    kv: {
      get: (k) => kv.get(k),
      put: (k, v) => kv.put(k, v),
      delete: (k) => kv.delete(k),
    },
    fetchRegistry: async () => {
      const resp = await fetch(REGISTRY_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!resp.ok) throw new Error("registry fetch failed: " + resp.status);
      return resp.json();
    },
    openRelay,
  });
}

async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("body too large");
  return JSON.parse(text);
}

async function handleBridge(request, env, url) {
  const core = bridgeCore(env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (request.method === "POST" && url.pathname === "/lnurl-bridge/register") {
      const { httpStatus, body } = await core.handleRegister(await readJsonBody(request));
      return jsonResponse(httpStatus, body);
    }
    if (request.method === "POST" && url.pathname === "/lnurl-bridge/unregister") {
      const { httpStatus, body } = await core.handleUnregister(await readJsonBody(request));
      return jsonResponse(httpStatus, body);
    }
    const cb = /^\/lnurlp\/callback\/([^/]+)\/?$/.exec(url.pathname);
    if (request.method === "GET" && cb) {
      let name;
      try { name = decodeURIComponent(cb[1]); } catch { return jsonResponse(404, { status: "ERROR", reason: "Unknown Lightning address." }); }
      const { httpStatus, body } = await core.handleCallback(name.toLowerCase(), url.searchParams.get("amount"));
      return jsonResponse(httpStatus, body);
    }
  } catch {
    return jsonResponse(400, { status: "ERROR", reason: "Malformed request." });
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/lnurlp/") || url.pathname.startsWith("/lnurl-bridge/")) {
      const handled = await handleBridge(request, env, url);
      if (handled) return handled;
    }
    // --- original ws-proxy behavior, unchanged ---
    const m = /^\/([^/]+)\/(\d{1,5})\/?$/.exec(url.pathname);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket" || !m) {
      return new Response(
        "fluid ws-proxy: open a WebSocket to /<host>/<port> and your bytes are carried over TCP to that Lightning peer.\n",
        { status: 200, headers: { "content-type": "text/plain" } },
      );
    }
    let host;
    try { host = decodeURIComponent(m[1]); } catch { return new Response("bad host\n", { status: 400 }); }
    const port = Number(m[2]);
    if (!host || port < 1 || port > 65535) return new Response("bad port\n", { status: 400 });
    if (!ALLOWED_PORTS.has(port)) return new Response("port not allowed\n", { status: 403 });

    const tcp = connect({ hostname: host, port }, { secureTransport: "off", allowHalfOpen: false });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const closeBoth = () => {
      try { server.close(); } catch { /* gone */ }
      try { tcp.close(); } catch { /* gone */ }
    };

    const pump = (async () => {
      try {
        for await (const chunk of tcp.readable) server.send(chunk);
      } catch { /* peer reset etc. */ }
      closeBoth();
    })();
    ctx.waitUntil(pump);

    const writer = tcp.writable.getWriter();
    server.addEventListener("message", (ev) => {
      const data = ev.data instanceof ArrayBuffer
        ? new Uint8Array(ev.data)
        : new TextEncoder().encode(String(ev.data));
      writer.write(data).catch(closeBoth);
    });
    server.addEventListener("close", closeBoth);
    server.addEventListener("error", closeBoth);

    return new Response(null, { status: 101, webSocket: client });
  },
};
