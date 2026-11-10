// NIP-44 v2 encrypted payloads — one implementation shared (by copy)
// between the LNURL bridge Worker and the Fluid app module. Verified
// byte-for-byte against the official NIP-44 test vector (see
// test/nip44.test.mjs): sec 1 / sec 2 -> conversation key
// c41c7753..., nonce 1, plaintext "a" -> the published payload.
//
// Construction (NIP-44 v2):
//   conversation_key = HKDF-extract(sha256, salt="nip44-v2", IKM=ECDH x)
//   message keys     = HKDF-expand(conversation_key, info=nonce, 76)
//                      = chacha_key | chacha_nonce(12) | hmac_key
//   payload          = base64( 0x02 | nonce | chacha20(pad(pt)) | mac )
//   mac              = HMAC-SHA256(hmac_key, nonce | ciphertext)
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { chacha20 } from "@noble/ciphers/chacha.js";

export const utf8 = (s) => new TextEncoder().encode(s);
export const fromUtf8 = (b) => new TextDecoder().decode(b);

export function hexToBytes(hex) {
  const h = String(hex || "").trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]*$/.test(h) || h.length % 2) throw new Error("invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}
export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
// base64 (standard, padded) without Buffer so the same code runs in
// Workers, browsers and Node.
export function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function base64ToBytes(b64) {
  const bin = atob(String(b64));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function randomBytes(n) {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** ECDH shared x-coordinate (BIP-340 lift: x-only pubkey -> even point). */
export function ecdhSharedX(privBytes, pubHexXOnly) {
  const pub = typeof pubHexXOnly === "string" ? hexToBytes(pubHexXOnly) : pubHexXOnly;
  if (pub.length !== 32) throw new Error("pubkey must be 32-byte x-only");
  const compressed = new Uint8Array(33);
  compressed[0] = 0x02;
  compressed.set(pub, 1);
  const shared = secp256k1.getSharedSecret(privBytes, compressed);
  return shared.slice(1); // drop the prefix byte, keep x
}

function hkdfExpand(prk, info, length) {
  const parts = [];
  let prev = new Uint8Array(0);
  let produced = 0;
  for (let i = 1; produced < length; i++) {
    prev = hmac(sha256, prk, concatBytes(prev, info, new Uint8Array([i])));
    parts.push(prev);
    produced += prev.length;
  }
  return concatBytes(...parts).slice(0, length);
}

export function nip44ConversationKey(privBytes, pubHexXOnly) {
  const sharedX = ecdhSharedX(privBytes, pubHexXOnly);
  return hmac(sha256, utf8("nip44-v2"), sharedX); // HKDF-extract
}

export function nip44MessageKeys(conversationKey, nonce) {
  if (conversationKey.length !== 32 || nonce.length !== 32) throw new Error("invalid conversation key or nonce length");
  const keys = hkdfExpand(conversationKey, nonce, 76);
  return { chachaKey: keys.slice(0, 32), chachaNonce: keys.slice(32, 44), hmacKey: keys.slice(44, 76) };
}

export function calcPaddedLen(unpaddedLen) {
  if (unpaddedLen <= 32) return 32;
  const nextPower = 2 ** (Math.floor(Math.log2(unpaddedLen - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
}

function pad(plaintextBytes) {
  const len = plaintextBytes.length;
  if (len < 1) throw new Error("plaintext too short");
  let prefix;
  if (len >= 65536) {
    prefix = new Uint8Array(6);
    new DataView(prefix.buffer).setUint32(2, len, false);
  } else {
    prefix = new Uint8Array(2);
    new DataView(prefix.buffer).setUint16(0, len, false);
  }
  const padded = new Uint8Array(prefix.length + calcPaddedLen(len));
  padded.set(prefix, 0);
  padded.set(plaintextBytes, prefix.length);
  return padded;
}

function unpad(padded) {
  if (padded.length < 2) throw new Error("invalid padding");
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const firstTwo = view.getUint16(0, false);
  let len, prefixLen;
  if (firstTwo === 0) {
    if (padded.length < 6) throw new Error("invalid padding");
    len = view.getUint32(2, false);
    if (len < 65536) throw new Error("invalid padding");
    prefixLen = 6;
  } else {
    len = firstTwo;
    prefixLen = 2;
  }
  if (len === 0 || padded.length !== prefixLen + calcPaddedLen(len)) throw new Error("invalid padding");
  return padded.slice(prefixLen, prefixLen + len);
}

export function nip44Encrypt(plaintext, conversationKey, nonce = randomBytes(32)) {
  const { chachaKey, chachaNonce, hmacKey } = nip44MessageKeys(conversationKey, nonce);
  const padded = pad(utf8(plaintext));
  const ciphertext = chacha20(chachaKey, chachaNonce, padded);
  const mac = hmac(sha256, hmacKey, concatBytes(nonce, ciphertext));
  return bytesToBase64(concatBytes(new Uint8Array([2]), nonce, ciphertext, mac));
}

export function nip44Decrypt(payload, conversationKey) {
  if (typeof payload !== "string" || payload.length < 132) throw new Error("invalid payload size");
  if (payload[0] === "#") throw new Error("unknown version");
  const data = base64ToBytes(payload);
  if (data.length < 99) throw new Error("invalid data size");
  if (data[0] !== 2) throw new Error("unknown version " + data[0]);
  const nonce = data.slice(1, 33);
  const ciphertext = data.slice(33, data.length - 32);
  const mac = data.slice(data.length - 32);
  const { chachaKey, chachaNonce, hmacKey } = nip44MessageKeys(conversationKey, nonce);
  const expected = hmac(sha256, hmacKey, concatBytes(nonce, ciphertext));
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= expected[i] ^ mac[i];
  if (diff !== 0) throw new Error("invalid MAC");
  const padded = chacha20(chachaKey, chachaNonce, ciphertext);
  return fromUtf8(unpad(padded));
}

export { sha256 };
