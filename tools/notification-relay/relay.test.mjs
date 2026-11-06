// End-to-end test for the notification relay:
//   local HTTPS mock push service -> subscribe -> signed webhook ->
//   relay encrypts (RFC 8291) + VAPID-signs (RFC 8292) -> mock receives ->
//   this test DECRYPTS the push body with the subscriber's private key
//   (independent implementation of the receiver side) and verifies the
//   JWT signature against the relay's VAPID public key.
// Also: bad-signature and stale webhooks are rejected with no push sent.
//
// Run: node relay.test.mjs   (requires openssl on PATH for the mock's
// self-signed cert; the relay is started with a test-only env flag that
// allows the self-signed push endpoint)

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluid-relay-test-"));
process.env.FLUID_RELAY_DATA = path.join(tmp, "data");
process.env.FLUID_RELAY_PORT = "0"; // not used; we listen manually below
process.env.FLUID_RELAY_WEBHOOK_SECRET = "test-secret-do-not-use";
process.env.FLUID_RELAY_ALLOW_INSECURE_PUSH = "1"; // self-signed mock only

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}`);
  if (!cond) failures++;
}

// --- mock push service -------------------------------------------------------
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", path.join(tmp, "k.pem"),
  "-out", path.join(tmp, "c.pem"), "-days", "1", "-nodes", "-subj", "/CN=127.0.0.1",
  "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
const pushes = [];
const mockPush = https.createServer(
  { key: fs.readFileSync(path.join(tmp, "k.pem")), cert: fs.readFileSync(path.join(tmp, "c.pem")) },
  (req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => { pushes.push({ headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(201); res.end(); });
  });
await new Promise((r) => mockPush.listen(0, "127.0.0.1", r));
const pushPort = mockPush.address().port;

// --- subscriber (browser stand-in) -------------------------------------------
const sub = crypto.createECDH("prime256v1");
sub.generateKeys();
const subPub = sub.getPublicKey(null, "uncompressed");
const authSecret = crypto.randomBytes(16);
const subscription = {
  endpoint: `https://127.0.0.1:${pushPort}/push/abc`,
  keys: { p256dh: subPub.toString("base64url"), auth: authSecret.toString("base64url") },
};

// --- relay under test ---------------------------------------------------------
const relay = await import("./relay.mjs");
const server = relay.server;
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const vapidRes = await (await fetch(`${base}/vapid-public-key`)).json();
check("vapid public key served", typeof vapidRes.publicKey === "string" && vapidRes.publicKey.length > 80);

const subRes = await fetch(`${base}/subscribe`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "testuser01", subscription }),
});
check("subscribe accepted", subRes.status === 200);

function signWebhook(body, secret = "test-secret-do-not-use", ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex");
  return { "x-fluid-timestamp": String(ts), "x-fluid-signature": sig, "Content-Type": "application/json" };
}

const goodBody = JSON.stringify({ type: "payment_incoming", note: "fields here are never displayed" });
let res = await fetch(`${base}/webhook/testuser01`, { method: "POST", headers: signWebhook(goodBody, "wrong-secret"), body: goodBody });
check("bad-signature webhook rejected 401", res.status === 401 && pushes.length === 0);

res = await fetch(`${base}/webhook/testuser01`, { method: "POST", headers: signWebhook(goodBody, "test-secret-do-not-use", Math.floor(Date.now() / 1000) - 3600), body: goodBody });
check("stale webhook rejected 401", res.status === 401 && pushes.length === 0);

res = await fetch(`${base}/webhook/testuser01`, { method: "POST", headers: signWebhook(goodBody), body: goodBody });
const hookJson = await res.json();
check("good webhook delivered", res.status === 200 && hookJson.delivered === true && pushes.length === 1);

// --- verify + decrypt the push ------------------------------------------------
const push = pushes[0];
check("push content-encoding aes128gcm", push.headers["content-encoding"] === "aes128gcm");
const authMatch = /^vapid t=([\w.-]+), k=([\w-]+)$/.exec(push.headers["authorization"] || "");
check("vapid authorization header present", !!authMatch);
if (authMatch) {
  check("vapid key matches /vapid-public-key", authMatch[2] === vapidRes.publicKey);
  const [h, c, s] = authMatch[1].split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
  check("jwt aud is the push origin", claims.aud === `https://127.0.0.1:${pushPort}`);
  const raw = Buffer.from(authMatch[2], "base64url");
  const pubKey = crypto.createPublicKey({
    key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33, 65).toString("base64url") },
    format: "jwk",
  });
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: pubKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  check("jwt signature verifies against vapid key", ok);
}

// RFC 8291 receiver-side decryption, implemented independently here.
function hkdf(salt, ikm, info, length) {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const out = []; let prev = Buffer.alloc(0); let counter = 1;
  while (Buffer.concat(out).length < length) {
    prev = crypto.createHmac("sha256", prk).update(prev).update(info).update(Buffer.from([counter++])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).subarray(0, length);
}
{
  const body = push.body;
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const senderPub = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);
  const ecdhSecret = sub.computeSecret(senderPub);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "utf8"), subPub, senderPub]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  check("push payload decrypts (final-record delimiter 0x02)", plain[plain.length - 1] === 0x02);
  const payload = JSON.parse(plain.subarray(0, plain.length - 1).toString("utf8"));
  check("payload carries the fixed notification text", payload.body === "Payment received — open Fluid to claim it" && payload.url === "/#lightning");
}

server.close();
mockPush.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "RELAY TEST: ALL PASS" : `RELAY TEST: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
