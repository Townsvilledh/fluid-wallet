// EIP-191 ("personal_sign") verification by public-key recovery,
// implemented on @noble primitives so the bridge Worker needs no
// ethers bundle. Cross-checked against ethers.verifyMessage in the
// test suite (test/eip191.test.mjs) — the two implementations must
// agree on every vector, valid and tampered.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { hexToBytes, bytesToHex, utf8, concatBytes } from "./nip44.mjs";

/** keccak256("\x19Ethereum Signed Message:\n" + len + message). */
export function eip191MessageHash(message) {
  const msg = utf8(String(message));
  const prefix = utf8("\x19Ethereum Signed Message:\n" + String(msg.length));
  return keccak_256(concatBytes(prefix, msg));
}

/** Recover the signer's EVM address (lowercase hex) from a 65-byte
 *  EIP-191 signature over `message`. Throws on malformed input. */
export function eip191RecoverAddress(message, sigHex) {
  const sig = hexToBytes(String(sigHex || "").replace(/^0x/, ""));
  if (sig.length !== 65) throw new Error("signature must be 65 bytes");
  const v = sig[64];
  const recovery = v >= 27 ? v - 27 : v;
  if (recovery !== 0 && recovery !== 1) throw new Error("bad recovery id");
  const signature = secp256k1.Signature.fromBytes(sig.slice(0, 64)).addRecoveryBit(recovery);
  const point = signature.recoverPublicKey(eip191MessageHash(message));
  const pub = point.toBytes(false); // uncompressed, 65 bytes with 0x04
  const hash = keccak_256(pub.slice(1));
  return "0x" + bytesToHex(hash.slice(12));
}

/** True when `sigHex` over `message` recovers exactly `address`. */
export function eip191Verify(message, sigHex, address) {
  try {
    return eip191RecoverAddress(message, sigHex) === String(address || "").toLowerCase();
  } catch {
    return false;
  }
}
