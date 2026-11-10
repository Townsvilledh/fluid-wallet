// Minimal in-memory Nostr relay for offline bridge tests.
// Implements just enough of NIP-01: EVENT (store + broadcast to
// matching live subscriptions), REQ (stored matches + EOSE), CLOSE.
// NOT a production relay — a test fixture.
import { WebSocketServer } from "ws";

function matchesFilter(ev, f) {
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f.ids && !f.ids.includes(ev.id)) return false;
  for (const k of Object.keys(f)) {
    if (k.startsWith("#")) {
      const tagName = k.slice(1);
      const wanted = f[k];
      const have = (ev.tags || []).filter((t) => t[0] === tagName).map((t) => t[1]);
      if (!wanted.some((w) => have.includes(w))) return false;
    }
  }
  return true;
}

export async function startLocalRelay() {
  const events = [];
  const subs = new Map(); // ws -> Map(subId -> filters)
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((res) => wss.on("listening", res));
  const port = wss.address().port;
  wss.on("connection", (ws) => {
    subs.set(ws, new Map());
    ws.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === "EVENT") {
        const ev = msg[1];
        // NIP-01: ephemeral kinds (20000-29999, incl. NWC 23194/5)
        // are broadcast to live subscriptions only, never stored
        // or replayed.
        const ephemeral = ev.kind >= 20000 && ev.kind < 30000;
        if (!ephemeral) events.push(ev);
        for (const [other, subMap] of subs) {
          for (const [subId, filters] of subMap) {
            if (filters.some((f) => matchesFilter(ev, f))) {
              try { other.send(JSON.stringify(["EVENT", subId, ev])); } catch { /* gone */ }
            }
          }
        }
        try { ws.send(JSON.stringify(["OK", ev.id, true, ""])); } catch { /* gone */ }
      } else if (msg[0] === "REQ") {
        const subId = msg[1];
        const filters = msg.slice(2);
        subs.get(ws).set(subId, filters);
        for (const ev of events) {
          if (filters.some((f) => matchesFilter(ev, f))) {
            try { ws.send(JSON.stringify(["EVENT", subId, ev])); } catch { /* gone */ }
          }
        }
        try { ws.send(JSON.stringify(["EOSE", subId])); } catch { /* gone */ }
      } else if (msg[0] === "CLOSE") {
        subs.get(ws).delete(msg[1]);
      }
    });
    ws.on("close", () => subs.delete(ws));
  });
  return {
    url: `ws://127.0.0.1:${port}`,
    events,
    async close() {
      for (const ws of subs.keys()) { try { ws.terminate(); } catch { /* gone */ } }
      await new Promise((res) => wss.close(res));
    },
  };
}

/** RelayConn adapter (see nwc-client.mjs) over the `ws` package. */
export async function openRelayWs(url) {
  const { default: WebSocket } = await import("ws");
  const ws = new WebSocket(url);
  let handler = () => {};
  ws.on("message", (data) => handler(String(data)));
  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });
  return {
    send: (text) => ws.send(text),
    setOnMessage: (fn) => { handler = fn; },
    close: () => { try { ws.close(); } catch { /* gone */ } },
  };
}
