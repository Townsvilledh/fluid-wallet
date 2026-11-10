// Minimal Nostr (NIP-01) event helpers — exactly what the bridge
// needs: ids, Schnorr signatures, keypairs. No relay logic here.
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256, hexToBytes, bytesToHex, utf8, randomBytes } from "./nip44.mjs";

export { hexToBytes, bytesToHex };

export function nostrPubkeyHex(privBytes) {
  return bytesToHex(schnorr.getPublicKey(privBytes));
}

export function generateNostrKeypair() {
  const priv = randomBytes(32);
  return { priv, privHex: bytesToHex(priv), pubHex: nostrPubkeyHex(priv) };
}

/** NIP-01 event id: sha256 of [0, pubkey, created_at, kind, tags, content]. */
export function nostrEventId(ev) {
  const ser = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
  return bytesToHex(sha256(utf8(ser)));
}

/** Build a signed event. `fields`: {kind, tags, content, created_at?}. */
export function signNostrEvent(privBytes, fields) {
  const ev = {
    pubkey: nostrPubkeyHex(privBytes),
    created_at: fields.created_at || Math.floor(Date.now() / 1000),
    kind: fields.kind,
    tags: fields.tags || [],
    content: fields.content || "",
  };
  ev.id = nostrEventId(ev);
  ev.sig = bytesToHex(schnorr.sign(hexToBytes(ev.id), privBytes));
  return ev;
}

export function verifyNostrEvent(ev) {
  try {
    if (!ev || typeof ev.id !== "string" || typeof ev.sig !== "string") return false;
    if (nostrEventId(ev) !== ev.id) return false;
    return schnorr.verify(hexToBytes(ev.sig), hexToBytes(ev.id), hexToBytes(ev.pubkey));
  } catch {
    return false;
  }
}
