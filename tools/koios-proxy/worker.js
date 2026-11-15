// fluid-koios-proxy — read-only CORS bridge for Cardano data.
//
// Why this exists: Koios (api.koios.rest and its regional hosts
// eu-api / us-api) is the keyless Cardano data layer Fluid
// reads, but its GET responses carry no
// Access-Control-Allow-Origin header (only its OPTIONS
// preflights do), so a browser wallet can never read them —
// verified 2026-11-15 from the live Fluid origin: curl answers
// in seconds while in-page fetch is refused by CORS on every
// Koios host, and no other keyless CORS-clean Cardano read
// source exists (research_notes/fluid-cardano-20261115 +
// fluid-live-verify-cardano-20261115). This Worker forwards
// the three read paths the wallet uses to api.koios.rest and
// returns the bodies verbatim with CORS headers attached.
//
// Trust model: a dumb pipe. GET only, an allowlist of exactly
// three paths, no keys, no state, nothing stored or logged by
// the script; the data is public chain data either way. Worst
// failure is liveness — if this Worker dies, the wallet falls
// back to the direct Koios hosts and, failing those, shows
// "couldn't load", exactly the pre-proxy behaviour. It never
// touches transaction submission (that stays on the wallet's
// own Koios/Blockfrost submit paths).
//
// Deploy (Cloudflare connector helper):
//   python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cf.py \
//     deploy 6b3665db1568527716d05b63eea581ab fluid-koios-proxy \
//     ~/workspace/fluid-wallet/tools/koios-proxy/worker.js
// Endpoint: https://fluid-koios-proxy.kanugideontownsville.workers.dev

const UPSTREAM = "https://api.koios.rest";
const ALLOWED_PATHS = new Set([
  "/api/v1/tip",
  "/api/v1/epoch_params",
  "/api/v1/address_utxos",
]);
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-max-age": "86400",
};
const BANNER =
  "fluid koios-proxy: GET /api/v1/tip, /api/v1/epoch_params or /api/v1/address_utxos and the Koios body comes back verbatim with CORS headers attached.\n";

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
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response("not found\n", {
        status: 404,
        headers: { "content-type": "text/plain", ...CORS },
      });
    }
    if (request.method !== "GET") {
      return new Response("GET only\n", { status: 405, headers: CORS });
    }
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      headers: { accept: "application/json" },
    });
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
