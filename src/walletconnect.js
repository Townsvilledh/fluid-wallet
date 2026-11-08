// Fluid's WalletConnect v2 client — LAZY-LOADED CHUNK.
//
// app.js imports this module dynamically ONLY when the WalletConnect
// panel opens, so the Reown/WalletConnect SDK never inflates the main
// bundle. The single-file build (dist/fluid-wallet.html) has no chunk
// beside it; there the panel says honestly that WalletConnect needs
// the hosted build.
//
// This module is TRANSPORT ONLY: pairing, session approve/reject,
// request responses, disconnects — via the official @reown/walletkit
// SDK. Every decision (which namespaces to grant, whether a request
// may be signed, what the user is shown) is made in wallet-core.js
// (planWcNamespaces / decodeWcRequest) and app.js; every signature is
// produced by wallet-core's sign helpers with the unlocked vault's
// key. Nothing here ever touches a key.

import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";

/** JSON-RPC result/error envelopes for respondSessionRequest. Codes
 *  follow EIP-1193 where one exists: 4001 user rejected, 4100
 *  unauthorized (wallet locked), 4200 unsupported method; 5000 is
 *  Fluid's generic "refused/failed with the message attached". */
const wcResult = (id, result) => ({ id, result, jsonrpc: "2.0" });
const wcError = (id, code, message) => ({ id, error: { code, message }, jsonrpc: "2.0" });

export async function bootWalletConnect({ projectId, metadata, onProposal, onRequest, onSessionDelete, onAuthenticate }) {
  const core = new Core({ projectId, relayUrl: "wss://relay.walletconnect.com" });
  const kit = await WalletKit.init({ core, metadata });

  kit.on("session_proposal", (proposal) => { try { onProposal && onProposal(proposal); } catch { /* the sheet layer owns its errors */ } });
  kit.on("session_request", (event) => { try { onRequest && onRequest(event); } catch { /* ditto */ } });
  kit.on("session_delete", (del) => { try { onSessionDelete && onSessionDelete(del); } catch { /* ditto */ } });
  // Sign-In-With-Ethereum one-shot auth is not part of Fluid's v1
  // WalletConnect surface: the app is told (so it can say so) and
  // rejects through rejectAuthenticate — never left hanging.
  kit.on("session_authenticate", (auth) => { try { onAuthenticate && onAuthenticate(auth); } catch { /* ditto */ } });

  return {
    kit,
    /** Pair with a wc: URI (already validated by core's parseWcUri). */
    pair: (uri) => kit.pair({ uri }),
    /** Approve a pending proposal with core-built namespaces. */
    approveSession: (id, namespaces) => kit.approveSession({ id, namespaces }),
    rejectSession: (id) => kit.rejectSession({ id, reason: getSdkError("USER_REJECTED") }),
    /** Answer a session request: pass a signature / tx hash / value
     *  on success, or reject it with an EIP-1193-style error. */
    respondResult: (topic, id, result) => kit.respondSessionRequest({ topic, response: wcResult(id, result) }),
    respondError: (topic, id, code, message) => kit.respondSessionRequest({ topic, response: wcError(id, code, message) }),
    disconnect: (topic) => kit.disconnectSession({ topic, reason: getSdkError("USER_DISCONNECTED") }),
    rejectAuthenticate: (id) => kit.rejectSessionAuthenticate({ id, reason: getSdkError("USER_REJECTED") }),
    /** Active sessions (map keyed by topic) + anything still pending
     *  — the panel replays pending items through the same review
     *  sheets as live ones. */
    sessions: () => kit.getActiveSessions(),
    pendingProposals: () => kit.getPendingSessionProposals(),
    pendingRequests: () => kit.getPendingSessionRequests(),
  };
}
