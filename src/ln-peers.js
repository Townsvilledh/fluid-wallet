// Lightning peer book — a deliberately TINY module.
//
// Both wallet-core.js (main bundle; re-exports these) and the lazy
// Lightning chunk (src/lightning-node.js) import from here, so the
// peer-book logic exists exactly once and the chunk doesn't drag the
// whole wallet-core graph into its bundle.
//
// The book is [{pubkey, host, port}] — every peer the node should
// stay connected to. It persists inside the node's own encrypted KV
// (key "peers"), so the connections a user's channels live on are
// re-dialled automatically after every restart; without it, a
// restarted node knew its channels but not where its peers live
// (Lightning completion audit G10).

/** Parse + validate a peer book (JSON text or an array). Defensive:
 *  garbage in is an empty book, never a crash; entries need a 66-hex
 *  pubkey, a non-empty host and a real port; deduped by pubkey. */
export function parseLnPeerBook(input) {
  let arr = input;
  if (typeof input === "string") {
    try { arr = JSON.parse(input || ""); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    const pubkey = String(e?.pubkey || "").toLowerCase();
    const host = String(e?.host || "").trim();
    const port = Math.floor(Number(e?.port) || 0);
    if (!/^[0-9a-f]{66}$/.test(pubkey) || !host || port < 1 || port > 65535) continue;
    if (seen.has(pubkey)) continue;
    seen.add(pubkey);
    out.push({ pubkey, host, port });
  }
  return out;
}
export function serializeLnPeerBook(peers) {
  return JSON.stringify(parseLnPeerBook(peers));
}
export function upsertLnPeer(peers, peer) {
  const book = parseLnPeerBook(peers);
  const clean = parseLnPeerBook([peer]);
  if (!clean.length) return book;
  const i = book.findIndex((p) => p.pubkey === clean[0].pubkey);
  if (i >= 0) book[i] = clean[0]; else book.push(clean[0]);
  return book;
}
export function removeLnPeer(peers, pubkey) {
  return parseLnPeerBook(peers).filter(
    (p) => p.pubkey !== String(pubkey || "").toLowerCase(),
  );
}

/** The honest connection state of one peer (audit batch 4, F2).
 *  "connected" requires BOTH a live socket AND a completed
 *  Lightning handshake — the node layer learns of the handshake
 *  from LDK itself (its OnionMessagePeerConnected event, surfaced
 *  to JS as "peer_back_online": the peer manager only fires it
 *  after the Noise handshake and init exchange complete). A socket
 *  that merely dialled is "connecting", never "connected": under a
 *  failing transport the two diverge, and the row must not claim
 *  more than LDK has. No socket at all is "disconnected", however
 *  the peer behaved in the past. */
export function lnPeerConnState({ socketLive = false, handshaken = false } = {}) {
  if (socketLive && handshaken) return "connected";
  if (socketLive) return "connecting";
  return "disconnected";
}

/** Poll a peer-status source until the peer's handshake completes
 *  ("connected") or the timeout passes. Resolves { connected,
 *  state } with the LAST observed state — it never reports success
 *  it didn't see, and a peer missing from the list reads as
 *  "disconnected". Clock and sleep are injectable for tests. Used
 *  by the panel's connect-only and open-channel flows in place of
 *  the old fixed 4-second connect→open sleep, which was shorter
 *  than real connection time in the wild (audit batch 4, F3). */
export async function waitForLnPeerConnected(getStatus, pubkey, {
  timeoutMs = 30000, pollMs = 500,
  now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const want = String(pubkey || "").toLowerCase();
  const start = now();
  let state = "disconnected";
  for (;;) {
    let rows = [];
    try { rows = getStatus() || []; } catch { rows = []; }
    const row = rows.find((p) => String(p?.pubkey || "").toLowerCase() === want);
    state = row ? row.state : "disconnected";
    if (state === "connected") return { connected: true, state };
    if (now() - start >= timeoutMs) return { connected: false, state };
    await sleep(pollMs);
  }
}
