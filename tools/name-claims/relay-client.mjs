// Minimal Nostr relay query client for the name-claims processor.
// Mirrors ~/workspace/dripbot-nostr/relay-client.mjs: the `ws` package
// tunnelled through the VM's HTTP egress proxy (https_proxy env) —
// a direct WebSocket from this VM does not reach the relays, and the
// pool helpers do not pick up the proxy agent on their own. Both
// packages resolve from the repo's node_modules (transitive deps of
// the WalletConnect stack); if the proxy agent is ever unavailable
// the client falls back to a direct connection rather than dying.
import WebSocket from "ws";

let agent;
try {
  const mod = await import("https-proxy-agent");
  const HttpsProxyAgent = mod.HttpsProxyAgent || mod.default;
  const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (proxyUrl && HttpsProxyAgent) agent = new HttpsProxyAgent(proxyUrl);
} catch { agent = undefined; }

/** Query one relay with a Nostr filter; resolves the events received
 *  before EOSE or the timeout (whichever first). Never rejects — a
 *  dead relay resolves []. */
export function queryEvents(url, filter, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const events = [];
    let done = false;
    let ws;
    let timer;
    const subId = "nc" + Math.random().toString(36).slice(2, 10);
    // Teardown (2026-11-17): destroy the socket NOW instead of
    // waiting for the peer's close frame. close() leaves the socket
    // — and the proxy agent's in-flight TLS handshake — alive after
    // the query is done, and a late RST on it surfaces as an
    // unhandled TLSSocket error at process teardown, crashing the
    // processor with exit 1 after all work succeeded (four runs
    // on 2026-11-17). terminate() destroys the socket immediately,
    // and clearing the timer here (not only at the call sites) means
    // no 25 s timer keeps the event loop — and the process — alive
    // past the run's end either.
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { if (ws) ws.terminate(); } catch { /* already gone */ }
      resolve(events);
    };
    try {
      ws = new WebSocket(url, agent ? { agent, handshakeTimeout: 15000 } : { handshakeTimeout: 15000 });
    } catch { return resolve(events); }
    timer = setTimeout(finish, timeoutMs);
    ws.on("open", () => { try { ws.send(JSON.stringify(["REQ", subId, filter])); } catch { clearTimeout(timer); finish(); } });
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (Array.isArray(msg) && msg[0] === "EVENT" && msg[1] === subId) events.push(msg[2]);
        if (Array.isArray(msg) && msg[0] === "EOSE" && msg[1] === subId) { clearTimeout(timer); finish(); }
      } catch { /* unparseable frame — ignore */ }
    });
    ws.on("error", () => { clearTimeout(timer); finish(); });
    ws.on("close", () => { clearTimeout(timer); finish(); });
  });
}
