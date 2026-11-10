// Smoke test for the BUNDLED worker (the exact bytes shape that
// gets uploaded to Cloudflare): routing for the bridge endpoints,
// the untouched ws-proxy banner, and JSON/CORS response shapes.
// Build first:  node test/build-bundle.mjs
// Run:          node test/worker-smoke.test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";

const bundlePath = new URL("../worker.bundle.mjs", import.meta.url).pathname;
let worker;
try {
  worker = (await import(bundlePath)).default;
} catch (e) {
  console.error("bundle missing or unimportable — run node test/build-bundle.mjs first:", e.message);
  process.exit(1);
}

const kvStore = new Map();
const env = {
  LNURL_BRIDGE: {
    get: async (k) => (kvStore.has(k) ? kvStore.get(k) : null),
    put: async (k, v) => { kvStore.set(k, v); },
    delete: async (k) => { kvStore.delete(k); },
  },
};
const ctx = { waitUntil: () => {} };
const call = (url, init) => worker.fetch(new Request(url, init), env, ctx);

// Banner (original proxy behavior) still answers at the root.
let resp = await call("https://fluid-ws-proxy.kanugideontownsville.workers.dev/");
assert.equal(resp.status, 200);
assert.match(await resp.text(), /fluid ws-proxy/);

// Callback for an unknown name: 404 LUD-06 error JSON + CORS.
resp = await call("https://fluid-ws-proxy.kanugideontownsville.workers.dev/lnurlp/callback/nosuchname?amount=21000");
assert.equal(resp.status, 404);
assert.equal(resp.headers.get("access-control-allow-origin"), "*");
assert.equal(resp.headers.get("content-type"), "application/json");
let body = await resp.json();
assert.equal(body.status, "ERROR");
assert.ok(body.reason.length > 0);

// Register with malformed JSON: 400 ERROR, not a crash.
resp = await call("https://fluid-ws-proxy.kanugideontownsville.workers.dev/lnurl-bridge/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{not json",
});
assert.equal(resp.status, 400);
body = await resp.json();
assert.equal(body.status, "ERROR");

// Register with valid JSON but bad fields: validation error, no KV write.
resp = await call("https://fluid-ws-proxy.kanugideontownsville.workers.dev/lnurl-bridge/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Bad Name" }),
});
assert.equal(resp.status, 400);
assert.equal(kvStore.size, 0);

// CORS preflight on bridge routes.
resp = await call("https://fluid-ws-proxy.kanugideontownsville.workers.dev/lnurlp/callback/x", { method: "OPTIONS" });
assert.equal(resp.status, 204);
assert.equal(resp.headers.get("access-control-allow-origin"), "*");

// The DEPLOY bundle must be a single self-contained module
// (deploy.py uploads one file): no bare imports left except
// cloudflare:sockets. (The smoke bundle aliases that away, so this
// check reads the deploy bundle.)
const src = readFileSync(new URL("../worker.deploy.mjs", import.meta.url).pathname, "utf8");
const bareImports = [...src.matchAll(/from\s+["']([^"./][^"']*)["']/g)].map((m) => m[1]);
assert.deepEqual([...new Set(bareImports)], ["cloudflare:sockets"], "unexpected bare imports: " + bareImports.join(","));

console.log("worker-smoke.test.mjs: all checks passed");
