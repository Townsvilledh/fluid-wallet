// Lightning key derivations — a deliberately TINY module.
//
// Both wallet-core.js (main bundle; re-exports these) and the lazy
// Lightning chunk (src/lightning-node.js) import from here, so the
// derivation exists exactly once and the chunk doesn't drag the whole
// wallet-core graph into its bundle.
//
// Both derivations are HKDF-SHA256 over the wallet's BIP-39 seed with
// Fluid domain separators. Same phrase -> same values, on any device.
// The outputs are pinned byte-for-byte in test/core.test.mjs against
// the standard test mnemonic.

import { mnemonicToSeedSync } from "@scure/bip39";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

const clean = (phrase) => String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");

/** The 32-byte seed for the in-app Lightning node. Independent of
 *  every other chain's keys by domain separation. */
export function deriveLightningSeed(phrase) {
  const seed = mnemonicToSeedSync(clean(phrase));
  return hkdf(sha256, seed, new TextEncoder().encode("fluid"), new TextEncoder().encode("fluid/lightning/ldk-seed/v1"), 32);
}

/** AES key encrypting the Lightning node's persisted state at rest.
 *  A SEPARATE HKDF branch from the node seed itself: the storage key
 *  can decrypt state blobs but is never channel key material. */
export function deriveLightningStorageKey(phrase) {
  const seed = mnemonicToSeedSync(clean(phrase));
  return hkdf(sha256, seed, new TextEncoder().encode("fluid"), new TextEncoder().encode("fluid/lightning/storage/v1"), 32);
}
