// Nostr Wallet Connect (NIP-47) client for the bridge Worker: asks
// the recipient's own Fluid wallet to mint an invoice
// (make_invoice, NIP-44 v2 encryption) and waits for its reply.
// The Worker is a *client* here — the connection it holds is scoped
// make_invoice-only by the wallet, so the worst a leak enables is
// asking the wallet to mint invoices. It can never pay or sign.
//
// Relay access is injected (`openRelay`) because the transport
// differs by runtime: Cloudflare Workers open client WebSockets via
// a fetch Upgrade; Node (tests) uses the `ws` package. The protocol
// logic is identical and fully covered by the local-relay tests.
//
// RelayConn contract:
//   { send(text), setOnMessage(fn), close() }  — messages are raw
//   Nostr relay frames (JSON strings).
import { nip44Encrypt, nip44Decrypt, nip44ConversationKey, hexToBytes, bytesToHex } from "./nip44.mjs";
import { signNostrEvent, verifyNostrEvent, nostrPubkeyHex } from "./nostr.mjs";

export const NWC_REQUEST_KIND = 23194;
export const NWC_RESPONSE_KIND = 23195;
export const NWC_INFO_KIND = 13194;

export function buildNwcRequestEvent({ clientPrivHex, walletPubHex, method, params }) {
  const priv = hexToBytes(clientPrivHex);
  const convKey = nip44ConversationKey(priv, walletPubHex);
  const content = nip44Encrypt(JSON.stringify({ method, params }), convKey);
  return signNostrEvent(priv, {
    kind: NWC_REQUEST_KIND,
    tags: [["p", walletPubHex], ["encryption", "nip44_v2"]],
    content,
  });
}

export function parseNwcResponseEvent(ev, { clientPrivHex, walletPubHex, requestId }) {
  if (!ev || ev.kind !== NWC_RESPONSE_KIND) throw new Error("not an NWC response");
  if (ev.pubkey !== walletPubHex) throw new Error("response from the wrong wallet key");
  const eTag = (ev.tags || []).find((t) => t[0] === "e");
  if (!eTag || eTag[1] !== requestId) throw new Error("response does not answer our request");
  if (!verifyNostrEvent(ev)) throw new Error("response signature invalid");
  const convKey = nip44ConversationKey(hexToBytes(clientPrivHex), walletPubHex);
  const plain = nip44Decrypt(ev.content, convKey);
  const parsed = JSON.parse(plain);
  if (parsed.error) {
    const err = new Error(parsed.error.message || "wallet returned an error");
    err.code = parsed.error.code || "WALLET_ERROR";
    err.walletError = true;
    throw err;
  }
  return parsed.result || {};
}

/**
 * Round-trip one NWC call. Connects to every relay in parallel,
 * subscribes for the response BEFORE publishing the request, and
 * resolves with the first valid response. Rejects with
 * err.code === "WALLET_OFFLINE" after `timeoutMs`.
 */
export async function nwcCall({ clientPrivHex, walletPubHex, relays, method, params, timeoutMs = 20000, openRelay }) {
  const clientPubHex = nostrPubkeyHex(hexToBytes(clientPrivHex));
  const request = buildNwcRequestEvent({ clientPrivHex, walletPubHex, method, params });
  const subId = "bridge-" + request.id.slice(0, 12);
  const conns = [];
  let settled = false;
  try {
    const result = await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const err = new Error("wallet did not answer in time");
        err.code = "WALLET_OFFLINE";
        reject(err);
      }, timeoutMs);
      const finish = (fn, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(val);
      };
      const opened = await Promise.allSettled((relays || []).map((url) => openRelay(url)));
      const live = opened.filter((r) => r.status === "fulfilled").map((r) => r.value);
      conns.push(...live);
      if (!live.length) {
        const err = new Error("no relay reachable");
        err.code = "WALLET_OFFLINE";
        finish(reject, err);
        return;
      }
      for (const conn of live) {
        conn.setOnMessage((text) => {
          let msg;
          try { msg = JSON.parse(text); } catch { return; }
          if (!Array.isArray(msg) || msg[0] !== "EVENT" || msg[1] !== subId) return;
          try {
            finish(resolve, parseNwcResponseEvent(msg[2], { clientPrivHex, walletPubHex, requestId: request.id }));
          } catch (e) {
            if (e && e.walletError) finish(reject, e);
            // malformed/spoofed frames are ignored — a valid later
            // response can still arrive on another relay.
          }
        });
        conn.send(JSON.stringify(["REQ", subId, { kinds: [NWC_RESPONSE_KIND], authors: [walletPubHex], "#e": [request.id], "#p": [clientPubHex] }]));
      }
      for (const conn of live) {
        try { conn.send(JSON.stringify(["EVENT", request])); } catch { /* one relay is enough */ }
      }
    });
    return result;
  } finally {
    for (const conn of conns) {
      try { conn.send(JSON.stringify(["CLOSE", subId])); } catch { /* gone */ }
      try { conn.close(); } catch { /* gone */ }
    }
  }
}

export async function nwcMakeInvoice(args) {
  const result = await nwcCall({ ...args, method: "make_invoice", params: { amount: args.amountMsat, description_hash: args.descriptionHashHex } });
  if (!result || typeof result.invoice !== "string" || !result.invoice) {
    const err = new Error("wallet returned no invoice");
    err.code = "WALLET_ERROR";
    err.walletError = true;
    throw err;
  }
  return result.invoice;
}
