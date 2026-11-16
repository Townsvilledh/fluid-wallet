// Polkadot SDK chunk — the @polkadot/api + keyring surface
// wallet-core needs for Asset Hub (address derivation, validity
// checks, the HTTPS API connection, signing). Split out of the
// boot bundle on the existing lightning/walletconnect/arkade
// lazy-chunk pattern (loading performance, 2026-11-16): ~830 KB
// of the 6.6 MB boot bundle was this family, and none of it is
// needed to render the unlock screen. wallet-core loads this
// module before the first Polkadot use (app.js awaits the load in
// the home render, before deriving the DOT address) and gates it
// on the marker below (the arkade discipline; the Lightning
// chunk's in-bundle SHA pin is Lightning-only, as it carries a
// WASM node).
export const POLKADOT_CHUNK_MARKER = true;

export { ApiPromise, HttpProvider } from "@polkadot/api";
export { Keyring } from "@polkadot/keyring";
export { decodeAddress, cryptoWaitReady } from "@polkadot/util-crypto";
