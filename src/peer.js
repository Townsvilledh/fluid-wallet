// Peer (ZKP2P) Cash SDK chunk — the @zkp2p/cash surface
// wallet-core needs for the Peer cash-out (sell) route: client
// construction, the referral-attribution helpers, and the
// protocol amount constants. Split out of the boot bundle on the
// existing lightning/walletconnect/arkade/cosmos/polkadot
// lazy-chunk pattern (2026-11-16): the SDK plus its viem peer is
// far too heavy for the boot bundle and is needed only when a
// user opens the Peer sell sheet. wallet-core loads this module
// on the first Peer path and gates it on the marker below (the
// arkade discipline; the Lightning chunk's in-bundle SHA pin is
// Lightning-only, as it carries a WASM node).
//
// Trust note (from the SDK's own README, carried into the build
// record, research 2026-11-09 §2.8): the published @zkp2p/cash
// package depends on @zkp2p/sdk for protocol internals; that
// dependency ships from private source. On-chain custody is
// enforced by the protocol — only the escrow contract holds
// funds, and only the maker can withdraw an unmatched deposit.
// Fluid's mitigations: exact version pins, the unsigned
// prepare() paths only (Fluid reviews and signs every
// transaction itself), and a calldata check that refuses to
// broadcast any prepared transaction missing the referral
// attribution markers (see peerAttributionCheck in wallet-core).
export const PEER_CHUNK_MARKER = true;

export { createCashClient, toCashReferralAttributionCode, normalizeCashPayee } from "@zkp2p/cash";
export { CASH_ATTRIBUTION_CODE, CASH_REFERRAL_ATTRIBUTION_PREFIX, MIN_CASHOUT_AMOUNT, RECOMMENDED_MIN_CASHOUT_AMOUNT } from "@zkp2p/cash";
