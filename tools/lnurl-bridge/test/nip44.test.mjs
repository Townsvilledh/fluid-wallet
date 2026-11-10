// NIP-44 v2: official test vector + padding boundaries from the
// NIP-44 spec's extended-length table. Run: node test/nip44.test.mjs
import assert from "node:assert";
import { createHash } from "node:crypto";
import {
  nip44ConversationKey, nip44Encrypt, nip44Decrypt, nip44MessageKeys,
  calcPaddedLen, hexToBytes, bytesToHex,
} from "../src/nip44.mjs";

const sha256hex = (s) => createHash("sha256").update(s).digest("hex");

// Official vector (nips/44.md): sec1 = 1, sec2 = 2.
const sec1 = hexToBytes("0000000000000000000000000000000000000000000000000000000000000001");
const sec2 = hexToBytes("0000000000000000000000000000000000000000000000000000000000000002");
import { schnorr } from "@noble/curves/secp256k1.js";
const pub2 = bytesToHex(schnorr.getPublicKey(sec2));
const conv = nip44ConversationKey(sec1, pub2);
assert.equal(bytesToHex(conv), "c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d", "conversation key must match the official vector");
// Symmetry: conv(sec1, pub2) == conv(sec2, pub1)
const pub1 = bytesToHex(schnorr.getPublicKey(sec1));
assert.equal(bytesToHex(nip44ConversationKey(sec2, pub1)), bytesToHex(conv), "conversation key must be symmetric");

const nonce = hexToBytes("0000000000000000000000000000000000000000000000000000000000000001");
const payload = nip44Encrypt("a", conv, nonce);
assert.equal(
  payload,
  "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb",
  "encrypt must reproduce the official payload byte-for-byte",
);
assert.equal(nip44Decrypt(payload, conv), "a", "decrypt round-trip on the official payload");

// Message-keys split lengths
const keys = nip44MessageKeys(conv, nonce);
assert.equal(keys.chachaKey.length, 32);
assert.equal(keys.chachaNonce.length, 12);
assert.equal(keys.hmacKey.length, 32);

// Padding boundaries (spec table)
assert.equal(calcPaddedLen(1), 32);
assert.equal(calcPaddedLen(32), 32);
assert.equal(calcPaddedLen(33), 64);
assert.equal(calcPaddedLen(65535), 65536);
assert.equal(calcPaddedLen(65536), 65536);
assert.equal(calcPaddedLen(65537), 81920);

// Extended-length vectors: 'a' * len, same conv key + nonce.
for (const [len, payloadSha] of [
  [65535, "6d8c2810d1e870fbaa1f0a0937126cca837a15f9260e27060c331d70a3c0bc84"],
  [65536, "b7b4edb36ba92e267d322d56d9aebc22e7fa96ff52e3c12adc07f07a43cbc616"],
  [65537, "eeb7c7c5373894ea2c1547cfd3ccb15d5a0b2d619da852e5c79df792dcc9e435"],
]) {
  const p = nip44Encrypt("a".repeat(len), conv, nonce);
  assert.equal(sha256hex(p), payloadSha, `payload sha256 must match the spec table at length ${len}`);
  assert.equal(nip44Decrypt(p, conv), "a".repeat(len), `round-trip at length ${len}`);
}

// Random-nonce round trips + tamper refusal
for (const msg of ["", "x", "Pay to qa@fluidwallet.dpdns.org", "ünïcode ✓", "z".repeat(5000)]) {
  if (msg === "") {
    assert.throws(() => nip44Encrypt(msg, conv), /too short/);
    continue;
  }
  const p = nip44Encrypt(msg, conv);
  assert.equal(nip44Decrypt(p, conv), msg);
  const tampered = p.slice(0, 40) + (p[40] === "A" ? "B" : "A") + p.slice(41);
  assert.throws(() => nip44Decrypt(tampered, conv), /invalid MAC/);
}
assert.throws(() => nip44Decrypt(payload, nip44ConversationKey(sec2, pub2)), /invalid MAC/, "wrong conversation key must fail the MAC");

console.log("nip44.test.mjs: all checks passed");
