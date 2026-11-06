// Fluid notification relay — LSPS5/bLIP-55 wake-up service.
//
// What this is: a tiny, dependency-free (Node builtins only) HTTP service
// that connects "a payment arrived for an offline Fluid user" (a webhook
// from the user's channel peer / static-invoice server) to a Web Push
// notification on the user's device: "Payment received — open Fluid to
// claim it."
//
// What this is NOT: it holds NO Lightning keys, NO wallet seeds, NO funds,
// and it can never move money. The only key it owns is a VAPID keypair,
// whose sole power is sending push notifications to browsers that opted
// in. Push subscription credentials (endpoint + p256dh + auth) are
// capabilities for *sending notifications to that browser only*.
//
// Trust model (Fluid's hostile-input rule): the webhook body is never
// trusted for content. A valid webhook triggers one fixed notification
// text. Amounts, sender names, or any other webhook fields are never
// displayed — the user opens Fluid and reads the real state from their
// own node.
//
// Webhook authentication: HMAC-SHA256 over "<timestamp>.<raw body>" with
// a per-deployment shared secret (header x-fluid-signature, hex), plus a
// ±5 minute freshness window. When pairing with a third-party LSPS5 LSP
// instead of Fluid's own keeper, plug that LSP's signature scheme into
// verifyWebhook() below — it is deliberately isolated.
//
// Run:  node relay.mjs            (see README.md for env vars)

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = process.env.FLUID_RELAY_DATA || path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const PORT = Number(process.env.FLUID_RELAY_PORT || 8931);
const WEBHOOK_SECRET = process.env.FLUID_RELAY_WEBHOOK_SECRET || "";
const VAPID_SUBJECT = process.env.FLUID_RELAY_VAPID_SUBJECT || "mailto:fluid-wallet@example.com";
const NOTIFICATION_TEXT = "Payment received — open Fluid to claim it";
const NOTIFICATION_TITLE = "Fluid — Lightning payment";

// ---------------------------------------------------------------------------
// Storage (JSON files, data dir mode 0700, files 0600)
// ---------------------------------------------------------------------------

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try { fs.chmodSync(DATA_DIR, 0o700); } catch { /* best effort */ }

function loadJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")); }
  catch { return fallback; }
}
function saveJson(name, value) {
  const file = path.join(DATA_DIR, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch { /* best effort */ }
}

// VAPID keypair: generated once, persisted. Public key is public by design.
let vapid = loadJson("vapid.json", null);
if (!vapid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pubJwk = publicKey.export({ format: "jwk" });
  const privJwk = privateKey.export({ format: "jwk" });
  const pubRaw = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, "base64url"),
    Buffer.from(pubJwk.y, "base64url"),
  ]);
  vapid = { publicKey: pubRaw.toString("base64url"), privateJwk: privJwk };
  saveJson("vapid.json", vapid);
}
const vapidPrivateKey = crypto.createPrivateKey({ key: vapid.privateJwk, format: "jwk" });

let subscriptions = loadJson("subscriptions.json", {});

// ---------------------------------------------------------------------------
// Web Push — RFC 8291 (aes128gcm content encoding) + RFC 8292 (VAPID),
// implemented by hand on node:crypto. No third-party code.
// ---------------------------------------------------------------------------

function hkdf(salt, ikm, info, length) {
  // HKDF-SHA256 via extract+expand, spelled out so the construction is
  // auditable against RFC 5869 / RFC 8291.
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const out = [];
  let prev = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(out).length < length) {
    prev = crypto.createHmac("sha256", prk)
      .update(prev).update(info).update(Buffer.from([counter++])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).subarray(0, length);
}

function encryptPushPayload(subscription, payloadString) {
  const receiverPub = Buffer.from(subscription.keys.p256dh, "base64url"); // 65-byte uncompressed point
  const authSecret = Buffer.from(subscription.keys.auth, "base64url");    // 16 bytes
  if (receiverPub.length !== 65 || receiverPub[0] !== 0x04) throw new Error("bad p256dh key");
  if (authSecret.length !== 16) throw new Error("bad auth secret");

  const eph = crypto.createECDH("prime256v1");
  eph.generateKeys();
  const senderPub = eph.getPublicKey(null, "uncompressed"); // 65 bytes
  const ecdhSecret = eph.computeSecret(receiverPub);

  const salt = crypto.randomBytes(16);
  // RFC 8291 §3.3: key_info = "WebPush: info" || 0x00 || receiver || sender
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "utf8"), receiverPub, senderPub]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  // Single record: payload || 0x02 (final-record delimiter, no padding).
  const record = Buffer.concat([Buffer.from(payloadString, "utf8"), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([senderPub.length]), senderPub, ciphertext]);
}

function vapidAuthHeader(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT,
  })).toString("base64url");
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: vapidPrivateKey, dsaEncoding: "ieee-p1363",
  });
  const jwt = `${signingInput}.${signature.toString("base64url")}`;
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

function sendPush(subscription, payloadString) {
  return new Promise((resolve) => {
    let body;
    try { body = encryptPushPayload(subscription, payloadString); }
    catch (e) { return resolve({ ok: false, status: 0, error: String(e && e.message || e) }); }
    const url = new URL(subscription.endpoint);
    const req = https.request({
      method: "POST", hostname: url.hostname, port: url.port || 443,
      // Test-only escape hatch (self-signed mock push servers). Never set
      // FLUID_RELAY_ALLOW_INSECURE_PUSH in production.
      rejectUnauthorized: process.env.FLUID_RELAY_ALLOW_INSECURE_PUSH !== "1",
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": body.length,
        TTL: "86400",
        Urgency: "high",
        Authorization: vapidAuthHeader(subscription.endpoint),
      },
    }, (res) => {
      res.resume();
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    req.on("error", (e) => resolve({ ok: false, status: 0, error: String(e && e.message || e) }));
    req.end(body);
  });
}

// ---------------------------------------------------------------------------
// Webhook verification — ISOLATED on purpose (see header comment).
// ---------------------------------------------------------------------------

function verifyWebhook(req, rawBody) {
  if (!WEBHOOK_SECRET) return { ok: false, reason: "relay has no FLUID_RELAY_WEBHOOK_SECRET configured" };
  const ts = req.headers["x-fluid-timestamp"];
  const sig = req.headers["x-fluid-signature"];
  if (!ts || !sig) return { ok: false, reason: "missing signature headers" };
  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(skew) || skew > 300) return { ok: false, reason: "stale or invalid timestamp" };
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.`).update(rawBody).digest();
  let given;
  try { given = Buffer.from(String(sig), "hex"); } catch { return { ok: false, reason: "bad signature encoding" }; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HTTP surface
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 256 * 1024) { reject(new Error("body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://relay.local");

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "fluid-notification-relay", subscriptions: Object.keys(subscriptions).length });
    }
    if (req.method === "GET" && url.pathname === "/vapid-public-key") {
      return json(res, 200, { publicKey: vapid.publicKey });
    }

    if (req.method === "POST" && url.pathname === "/subscribe") {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const { id, subscription } = body || {};
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(id)) return json(res, 400, { error: "id must be 8-128 url-safe chars" });
      if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")) {
        return json(res, 400, { error: "subscription.endpoint must be an https URL" });
      }
      const keys = subscription.keys || {};
      if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return json(res, 400, { error: "subscription.keys.p256dh/auth required" });
      // Validate the crypto material parses before storing it.
      encryptPushPayload({ keys }, "probe");
      subscriptions[id] = { subscription, updatedAt: new Date().toISOString() };
      saveJson("subscriptions.json", subscriptions);
      return json(res, 200, { ok: true });
    }

    const unsubMatch = url.pathname.match(/^\/subscribe\/([A-Za-z0-9_-]{8,128})$/);
    if (req.method === "DELETE" && unsubMatch) {
      delete subscriptions[unsubMatch[1]];
      saveJson("subscriptions.json", subscriptions);
      return json(res, 200, { ok: true });
    }

    const hookMatch = url.pathname.match(/^\/webhook\/([A-Za-z0-9_-]{8,128})$/);
    if (req.method === "POST" && hookMatch) {
      const raw = await readBody(req);
      const verdict = verifyWebhook(req, raw);
      if (!verdict.ok) return json(res, 401, { error: verdict.reason });
      let event = {};
      try { event = JSON.parse(raw.toString("utf8")); } catch { return json(res, 400, { error: "webhook body must be JSON" }); }
      // Only one event type triggers a push. The body's fields are never
      // displayed; the notification text is fixed by this service.
      if (event.type !== "payment_incoming") return json(res, 200, { ok: true, ignored: true });
      const entry = subscriptions[hookMatch[1]];
      if (!entry) return json(res, 200, { ok: true, delivered: false, reason: "no subscription for id" });
      const payload = JSON.stringify({ title: NOTIFICATION_TITLE, body: NOTIFICATION_TEXT, tag: "fluid-lightning-payment", url: "/#lightning" });
      const result = await sendPush(entry.subscription, payload);
      if (result.status === 404 || result.status === 410) {
        delete subscriptions[hookMatch[1]];
        saveJson("subscriptions.json", subscriptions);
        return json(res, 200, { ok: true, delivered: false, reason: "subscription gone, removed" });
      }
      return json(res, 200, { ok: true, delivered: result.ok, pushStatus: result.status });
    }

    return json(res, 404, { error: "not found" });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message || e) });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, () => {
    console.log(`fluid-notification-relay listening on :${PORT} (data: ${DATA_DIR})`);
    if (!WEBHOOK_SECRET) console.log("WARNING: FLUID_RELAY_WEBHOOK_SECRET unset — webhooks will be rejected");
  });
}

export { server, encryptPushPayload, vapidAuthHeader };
export const __test = { vapidPublicKey: vapid.publicKey, dataDir: DATA_DIR };
