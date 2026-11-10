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
