// fluid-fonbnk-proxy — signing bridge for the Fonbnk Merchant API.
//
// Why this exists: Fonbnk's server-to-server API authenticates
// every call with an HMAC-SHA256 signature made from the
// merchant's API signature secret (docs: Signing requests —
// x-client-id / x-timestamp / x-signature over
// "{timestamp}:{endpoint}"). Fonbnk's own docs are explicit
// that the secret "belongs on your server — never in
// client-side code", and Fluid is a client-only wallet with no
// server of its own. This Worker is that server: it holds the
// merchant credentials as Worker secrets, signs each request
// exactly as Fonbnk specifies, and forwards it to
// https://api.fonbnk.com. The wallet ships only this Worker's
// URL (FONBNK_PROXY_URL in src/wallet-core.js) — no Fonbnk
// credential ever enters the bundle, the repo, or the page.
//
// Trust model: a signing pipe with a hard allowlist. Only the
// nine Merchant API paths the wallet uses are forwarded, only
// with their documented methods; the request body passes
// through verbatim (Fonbnk does not sign bodies). The Worker
// stores nothing and logs nothing. Deliberately NOT on the
// list: POST /api/v2/user/kyc, Fonbnk's KYC-submit endpoint —
// the owner's order (2026-11-16: "Anything KYC, I don't want
// it") removed every ID-checked Fonbnk row from Fluid, so
// this proxy can read a per-order KYC state (the wallet's
// refusal guard) but can never submit an identity check. Residual risk, stated
// plainly: anyone who learns this URL can ask the Worker to
// sign Fonbnk calls as Fluid's merchant — quotes and discovery
// are harmless, but order creation is not, so the merchant
// account's own limits are the blast-radius cap, and rotating
// the secret in the Fonbnk dashboard + Worker secret retires a
// leaked URL's usefulness only together with a config release
// pointing at a fresh Worker. Treat the URL as low-sensitivity
// but not public-copy material.
//
// Secrets (set with wrangler secret put, NEVER committed):
//   FONBNK_CLIENT_ID     — dashboard → Navigation → Integration
//   FONBNK_API_SECRET    — the API signature secret, same page
// Until both are set the Worker answers 501 with a plain
// "merchant not configured" body, and the wallet's Fonbnk
// sheets render their activation-pending state — no call ever
// reaches Fonbnk half-configured.
//
// Deploy (Cloudflare connector helper):
//   python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cf.py \
//     deploy 6b3665db1568527716d05b63eea581ab fluid-fonbnk-proxy \
//     ~/workspace/fluid-wallet/tools/fonbnk-proxy/worker.js
// Endpoint: https://fluid-fonbnk-proxy.kanugideontownsville.workers.dev

const UPSTREAM = "https://api.fonbnk.com";
// The exact Merchant API surface the wallet calls (Fonbnk docs,
// server-to-server endpoint pages, verified 2026-11-16). Method
// matters: a path with the wrong method is a 404 here, never a
// signed forward.
const ALLOWED = new Map([
  ["GET /api/v2/currencies", 1],
  ["GET /api/v2/order-limits", 1],
  ["GET /api/v2/user/kyc", 1],
  ["POST /api/v2/quote", 1],
  ["POST /api/v2/order", 1],
  ["GET /api/v2/order", 1],
  ["POST /api/v2/order/confirm", 1],
  ["POST /api/v2/order/cancel", 1],
  ["POST /api/v2/order/intermediate-action", 1],
]);
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};
const BANNER =
  "fluid fonbnk-proxy: POST/GET the allowlisted Fonbnk Merchant API paths and the call is signed with the merchant secret held here and forwarded to api.fonbnk.com.\n";

function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decodeToBytes(text) {
  const bin = atob(String(text).replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/** Fonbnk's signature: Base64( HMAC-SHA256( Base64-Decode(secret),
 *  UTF8("{timestamp}:{endpoint}") ) ) — endpoint is the path AND
 *  the query string, exactly as sent. */
async function fonbnkSignature(secret, timestamp, endpoint) {
  const key = await crypto.subtle.importKey(
    "raw", b64decodeToBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${timestamp}:${endpoint}`));
  return b64(new Uint8Array(sig));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === "/") {
      return new Response(BANNER, {
        status: 200,
        headers: { "content-type": "text/plain", ...CORS },
      });
    }
    if (!ALLOWED.has(`${request.method} ${url.pathname}`)) {
      return new Response("not found\n", {
        status: 404,
        headers: { "content-type": "text/plain", ...CORS },
      });
    }
    const clientId = env && env.FONBNK_CLIENT_ID;
    const secret = env && env.FONBNK_API_SECRET;
    if (!clientId || !secret) {
      return new Response(
        JSON.stringify({ message: "Fluid's Fonbnk merchant account is not switched on yet.", errorCode: "MERCHANT_NOT_CONFIGURED" }),
        { status: 501, headers: { "content-type": "application/json", ...CORS } });
    }
    const endpoint = url.pathname + url.search;
    const timestamp = Date.now().toString();
    const signature = await fonbnkSignature(secret, timestamp, endpoint);
    const init = {
      method: request.method,
      headers: {
        "content-type": "application/json",
        "x-client-id": clientId,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    };
    if (request.method === "POST") init.body = await request.text();
    const upstream = await fetch(UPSTREAM + endpoint, init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
        ...CORS,
      },
    });
  },
};
