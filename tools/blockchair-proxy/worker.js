// fluid-blockchair-proxy — read-only CORS bridge for Zcash/Dash data.
//
// Why this exists: Blockchair's address dashboard is the one
// keyless API found that answers from a browser Origin for Zcash
// (and Fluid's fallback read for Dash), but its keyless tier
// IP-blacklists hard — HTTP 430 ("Your IP address is temporary
// blacklisted") after ~10 rapid requests from one IP, verified
// 2026-11-15 from this build machine's egress for both chains
// (research_notes/fluid-zcash-dash-20261115, gap #8; repair-batch
// probe 2026-11-15). A wallet on a hostile or shared IP (carrier
// NAT, a flagged VPN exit) hits the same wall through no fault of
// its own. This Worker forwards the four GET read paths the
// wallet uses to api.blockchair.com from Cloudflare's egress and
// returns the bodies verbatim with CORS headers attached — the
// fluid-koios-proxy pattern, which is Fluid's standing answer to
// a keyless source that cannot be read directly.
//
// Trust model: a dumb pipe. GET only, an allowlist of exactly the
// dashboard + raw-transaction read paths for the two chains, no
// keys, no state, nothing stored or logged by the script; the
// data is public chain data either way. Worst failure is
// liveness — if this Worker dies, the wallet falls back to the
// direct Blockchair host and, failing that, shows "couldn't
// load", exactly the pre-proxy behaviour. It never touches
// transaction submission (broadcast stays on the wallet's own
// push paths).
//
// PROBE OUTCOME (2026-11-15, repair batch): deployed and probed
// the same day — Blockchair answered HTTP 430 from Cloudflare's
// Worker egress too, for fresh addresses on both chains. The
// keyless tier is blacklisting shared egress IP space generally,
// not just this build machine, so this proxy does NOT clear the
// wall today and the wallet client deliberately does NOT route
// reads through it (no unproven read path ships). It stays
// deployed as the standing shape for the day a re-probe clears
// (or a keyed tier lands — the key would live here as a Worker
// secret, never in the client). The keyed tier itself is applied
// for by email (the 430 body names info@blockchair.com) — an
// operator step.
//
// Deploy (Cloudflare connector helper):
//   python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cf.py \
//     deploy 6b3665db1568527716d05b63eea581ab fluid-blockchair-proxy \
//     ~/workspace/fluid-wallet/tools/blockchair-proxy/worker.js
// Endpoint: https://fluid-blockchair-proxy.kanugideontownsville.workers.dev

const UPSTREAM = "https://api.blockchair.com";
// Exactly the read paths the wallet calls: the address dashboard
// (balance + UTXOs + transactions in one call) and the raw
// transaction read, for Zcash and Dash only. The trailing segment
// is an address (base58) or a txid (hex) — nothing else routes.
const ALLOWED = [
  /^\/(zcash|dash)\/dashboards\/address\/[1-9A-HJ-NP-Za-km-z]{20,64}$/,
  /^\/(zcash|dash)\/raw\/transaction\/[0-9a-fA-F]{64}$/,
];
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-max-age": "86400",
};
const BANNER =
  "fluid blockchair-proxy: GET /zcash|dash/dashboards/address/<address> or /zcash|dash/raw/transaction/<txid> and the Blockchair body comes back verbatim with CORS headers attached.\n";

export default {
  async fetch(request) {
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
    if (request.method !== "GET" || !ALLOWED.some((re) => re.test(url.pathname))) {
      return new Response("not found\n", {
        status: 404,
        headers: { "content-type": "text/plain", ...CORS },
      });
    }
    const res = await fetch(UPSTREAM + url.pathname, {
      headers: { accept: "application/json" },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        ...CORS,
      },
    });
  },
};
