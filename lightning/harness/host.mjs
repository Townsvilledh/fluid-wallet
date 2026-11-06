// In-process host for the fluid-lightning WASM node: in-memory KV and
// pipe transports between harness nodes. This is test tooling with
// throwaway seeds only — the production hosts live in the Fluid app
// (encrypted localStorage + WebSocket) and the DripBot keeper (fs + TCP).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const ln = require("../pkg-node/fluid_lightning.js");

export const REGTEST_GENESIS = "0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206";
export const sha256d = (b) => createHash("sha256").update(createHash("sha256").update(b).digest()).digest();
export const reverseHex = (h) => Buffer.from(h, "hex").reverse().toString("hex");

// A minimal fake chain: headers link by sha256d, time advances 600s per
// block. LDK trusts its chain source (that is the LDK security model —
// the embedder IS the chain authority), so the harness drives confirms
// directly, exactly like the Esplora driver does with real headers.
export class FakeChain {
  constructor(nowSecs) {
    this.height = 0;
    this.time = nowSecs;
    this.headers = new Map(); // height -> {hash(display hex), headerHex}
    // A fabricated genesis header. LDK only requires that the chain
    // LINKs consistently: the node's starting best-block hash is the
    // tip hash the host passes at construction (this header's hash),
    // and every later block points back to its parent. (The crate's
    // BOLT 12 chain-hash checks use the bitcoin crate's own regtest
    // constants internally, independent of this fake chain.)
    const genesisHeader = Buffer.alloc(80);
    genesisHeader.writeUInt32LE(1, 0);
    genesisHeader.writeUInt32LE(nowSecs, 68);
    const genesisHash = reverseHex(sha256d(genesisHeader).toString("hex"));
    this.headers.set(0, { hash: genesisHash, headerHex: genesisHeader.toString("hex") });
  }
  mine(n = 1) {
    for (let i = 0; i < n; i++) {
      const prev = this.headers.get(this.height);
      const hdr = Buffer.alloc(80);
      hdr.writeUInt32LE(1, 0);
      Buffer.from(reverseHex(prev.hash), "hex").copy(hdr, 4); // prevhash, internal order
      hdr.writeUInt32LE(this.time + 600, 68);
      this.time += 600;
      this.height += 1;
      const hash = reverseHex(sha256d(hdr).toString("hex"));
      this.headers.set(this.height, { hash, headerHex: hdr.toString("hex") });
    }
    return this.headers.get(this.height);
  }
  tip() { return this.headers.get(this.height); }
}

export class PipeHost {
  constructor(name) {
    this.name = name;
    this.kv = new Map();
    this.node = null;
    this.links = new Map(); // connId -> {toHost, toConn}
    this.broadcasts = [];
  }
  attach(node) { this.node = node; }
  install() {
    const kv = this.kv, self = this;
    globalThis.__lnHosts = globalThis.__lnHosts || new Map();
    globalThis.__lnHosts.set(this.name, this);
    return {
      kvHas: (k) => kv.has(k),
      kvGet: (k) => kv.get(k),
      kvSet: (k, v) => kv.set(k, Buffer.from(v)),
      kvDel: (k) => kv.delete(k),
      kvKeys: (p) => [...kv.keys()].filter((k) => k.startsWith(p)),
      broadcast: (tx) => { self.broadcasts.push(Buffer.from(tx).toString("hex")); },
      wsOpen: (id, host, port) => { self.pendingDial = { id, host, port }; },
      wsNotify: (id) => { self.dirty = true; },
      wsClose: (id) => { self.links.delete(id); },
      logMsg: (m) => { if (process.env.LDK_LOG) console.log(`  [${self.name}]`, m.slice(0, 200)); },
    };
  }
  // Connect this host's pending dial to a peer host (called by the harness).
  completeDial(peerHost, peerConnId) {
    const { id } = this.pendingDial;
    this.links.set(id, { toHost: peerHost, toConn: peerConnId });
    peerHost.links.set(peerConnId, { toHost: this, toConn: id });
    this.pendingDial = null;
  }
}

const hosts = [];
export function makeNode(name, seedHex, chain) {
  const host = new PipeHost(name);
  const bridges = host.install();
  // The WASM module reads a single global FluidLnHost object; with
  // several nodes in one process we must swap it around construction
  // AND around every call. The harness wraps calls accordingly.
  globalThis.FluidLnHost = bridges;
  const tip = chain.tip();
  const node = new ln.FluidNode(new Uint8Array(Buffer.from(seedHex, "hex")), "regtest", chain.height, tip.hash, chain.time);
  host.attach(node);
  hosts.push({ name, host, node, bridges });
  return hosts[hosts.length - 1];
}
export function withNode(h, fn) {
  globalThis.FluidLnHost = h.bridges;
  return fn(h.node);
}
// Pump all pipes until quiescent, processing events and timer ticks.
export function pump(rounds = 40) {
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const h of hosts) {
      for (const [connId, link] of [...h.host.links]) {
        const bytes = withNode(h, (n) => n.take_outbound(connId));
        if (bytes && bytes.length) {
          moved = true;
          const peer = hosts.find((x) => x.host === link.toHost);
          withNode(peer, (n) => n.socket_data(link.toConn, bytes));
        }
      }
    }
    for (const h of hosts) withNode(h, (n) => n.tick());
    if (!moved) break;
  }
}
export function ticks(n = 3) {
  for (let i = 0; i < n; i++) {
    for (const h of hosts) withNode(h, (x) => x.timer_tick());
    pump(10);
  }
}
export { ln };
