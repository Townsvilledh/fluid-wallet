// fluid-lightning LSPS harness: LSPS2 just-in-time channels end to
// end against an in-process server-role LSP (the crate's LSPS2
// service with its built-in test fee policy: 1 sat minimum + 0.1%),
// plus restart persistence and the P1-15 receive plan.
//  - a channel-less wallet negotiates a JIT channel (get_info -> buy)
//  - builds the bLIP-52 invoice (intercept hint first, fees 0,
//    min-final-CLTV = normal + 2)
//  - a payer pays it; the LSP opens the channel just-in-time and
//    forwards payment - opening fee; the wallet claims it
//  - the Satora gate recognises the REAL invoice as JIT (and refuses
//    it when the local paymentHash -> scid record is absent)
//  - a second receive over the same channel pays NO opening fee
//  - the wallet restarts (same seed + KV): channels + balances are
//    identical, it reconnects, and receives again
// LSPS1 is client-only in the published lightning-liquidity 0.2.7
// (its service is compiled only inside the LDK monorepo), so the
// LSPS1 leg proves the client emits its request — the order flow
// completes against a real LSPS1 LSP (Megalith) in production.
// Run: node harness/lsps.mjs
import { FakeChain, makeNode, withNode, pump, ticks, ln } from "./host.mjs";
import { createHash } from "node:crypto";
import { parseBolt11, checkSatoraLightningReceivability, lnReceivePlan, lnLsps2OpeningFeeMsat, lnScidToDecimal } from "../../src/wallet-core.js";

const now = Math.floor(Date.now() / 1000);
const chain = new FakeChain(now);
const seed = (i) => createHash("sha256").update(`fluid-lsps-harness-${i}`).digest("hex");

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
};
const drain = (h) => withNode(h, (n) => JSON.parse(n.drain_events()));
// Cumulative event log: drain() consumes the node's queue, so every
// drained event is also appended here — waitFor predicates search the
// log, never a draining read, so an event that arrives while another
// leg is waiting can never be discarded unseen.
const evLog = new Map();
const drainLog = (h) => {
  const evs = drain(h);
  if (!evLog.has(h)) evLog.set(h, []);
  evLog.get(h).push(...evs);
  return evs;
};
const seenEv = (h, pred) => (evLog.get(h) || []).find(pred);
const balance = (h) => withNode(h, (n) => JSON.parse(n.balance()));
const nodeId = (h) => withNode(h, (n) => n.node_id());
const all = [];
function syncTip() {
  const tip = chain.tip();
  for (const h of all) withNode(h, (n) => n.best_block_updated(chain.height, tip.hash, tip.headerHex));
}
function advance(blocks = 1) { chain.mine(blocks); syncTip(); pump(10); }
function waitFor(label, fn, rounds = 60) {
  for (let i = 0; i < rounds; i++) {
    pump(15); ticks(1);
    const v = fn();
    if (v) return v;
    if (i % 6 === 5) advance(1);
  }
  console.log(`  (waitFor timed out: ${label})`);
  return null;
}
import { createRequire } from "node:module";
const reverseHex = (h) => Buffer.from(h, "hex").reverse().toString("hex");
const sha256d = (b) => createHash("sha256").update(createHash("sha256").update(b).digest()).digest();
function fundingTx(valueSat, scriptHex, salt) {
  const script = Buffer.from(scriptHex, "hex");
  const parts = [];
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
  parts.push(u32(2)); parts.push(Buffer.from([0, 1])); parts.push(Buffer.from([1]));
  parts.push(Buffer.alloc(32, salt)); parts.push(u32(0)); parts.push(Buffer.from([0]));
  parts.push(u32(0xffffffff)); parts.push(Buffer.from([1])); parts.push(u64(valueSat));
  parts.push(Buffer.from([script.length])); parts.push(script);
  parts.push(Buffer.from([2, 71])); parts.push(Buffer.alloc(71, 0x30));
  parts.push(Buffer.from([33])); parts.push(Buffer.alloc(33, 0x02)); parts.push(u32(0));
  const raw = Buffer.concat(parts);
  return { rawHex: raw.toString("hex"), txid: reverseHex(sha256d(raw).toString("hex")) };
}
function connect(x, y) {
  const yId = nodeId(y);
  const connX = withNode(x, (n) => n.connect_peer(yId, y.name, 9735));
  const connY = withNode(y, (n) => n.accept_peer());
  x.host.completeDial(y.host, connY);
  pump(30);
  return { x, y, connX, connY };
}
// Fabricate + confirm the funding for a node's oldest pending
// funding request (works for user-opened and LSPS2-service-opened
// channels alike — both surface through the same sink).
function fundPending(h, salt) {
  const pending = withNode(h, (n) => JSON.parse(n.pending_funding()));
  if (!pending.length) return false;
  const req = pending[0];
  const ftx = fundingTx(req.valueSat, req.scriptPubkey, salt);
  withNode(h, (n) => n.funding_tx_ready(req.userChannelId, ftx.rawHex));
  pump(20);
  const atHeight = chain.height + 1;
  chain.mine(1);
  for (const x of all) {
    const tip = chain.tip();
    withNode(x, (n) => n.confirm_transactions(tip.headerHex, atHeight, [0], [ftx.rawHex]));
  }
  advance(8);
  return true;
}
function openChannel(from, to, amountSat, salt) {
  const uid = withNode(from, (n) => n.open_channel(nodeId(to), BigInt(amountSat), 0n));
  const ok = waitFor("funding for user channel", () => (fundPending(from, salt) ? true : null), 40);
  if (!ok) throw new Error("user channel funding never landed");
  const ready = waitFor("channel_ready", () => drain(from).find((e) => e.type === "channel_ready"), 30);
  return { uid, ready };
}
function restart(h, seedHex, role) {
  const tip = chain.tip();
  // A real restart closes the node's sockets: both ends' peer
  // managers must hear socket_closed, or the surviving peer keeps a
  // ghost connection the re-dial collides with ("Peer Sent Invalid
  // Data"). The harness clears every link below (a full network
  // bounce), so notify every link, not just this host's.
  for (const x of all) {
    for (const [connId, link] of [...x.host.links]) {
      try { withNode(x, (n) => n.socket_closed(connId)); } catch { /* already gone */ }
      const peer = all.find((y) => y.host === link.toHost);
      if (peer) { try { withNode(peer, (n) => n.socket_closed(link.toConn)); } catch { /* already gone */ } }
    }
  }
  pump(5);
  globalThis.FluidLnHost = h.bridges;
  const node = new ln.FluidNode(new Uint8Array(Buffer.from(seedHex, "hex")), "regtest", chain.height, tip.hash, chain.time, role);
  h.node = node;
  h.host.attach(node);
  for (const x of all) x.host.links.clear();
  pump(10);
}

// ------------------------------------------------------------------
const LSP = makeNode("LSP", seed(11), chain, "server"); // LSPS2 service role
const C = makeNode("C", seed(12), chain); // the channel-less wallet
const P = makeNode("P", seed(13), chain); // an unrelated payer
all.push(LSP, C, P);
syncTip();
const lspId = nodeId(LSP);
check("wallet starts channel-less", balance(C).channels === 0 && balance(C).receivableMsat === 0);

// P1-15 receive plan against the REAL (zero) balance.
const plan0 = lnReceivePlan({ receivableMsat: balance(C).receivableMsat, requestedMsat: 2000000, hasLsp: true });
check("P1-15: zero-receivable + LSP + amount -> jit plan", plan0.kind === "jit");
const planNoLsp = lnReceivePlan({ receivableMsat: 0, requestedMsat: 2000000, hasLsp: false });
check("P1-15: zero-receivable without LSP -> need-channel (nothing renders)", planNoLsp.kind === "need-channel");

connect(P, LSP);
connect(C, LSP); // peer connection only — NO channel
openChannel(P, LSP, 300000, 0x11);
check("payer funded the LSP", balance(LSP).channels === 1);

// --- LSPS2 negotiation: get_info -> buy.
drain(C); drain(LSP);
const rid = withNode(C, (n) => n.lsps2_request_params(lspId, "any"));
const paramsEv = waitFor("lsps2_params_ready", () => { drainLog(C); return seenEv(C, (e) => e.type === "lsps2_params_ready"); }, 40);
check("LSPS2 get_info answered with a fee menu", !!paramsEv && Array.isArray(paramsEv.menu) && paramsEv.menu.length === 1, JSON.stringify(paramsEv || {}));
const menu0 = paramsEv.menu[0];
check("fee menu carries the LSP policy (1 sat min, 0.1%)", menu0.minFeeMsat === 1000 && menu0.proportional === 1000);
const PAY_MSAT = 2000000; // 2,000 sats — the funded-proof size
const feeMsat = lnLsps2OpeningFeeMsat(PAY_MSAT, menu0);
check("opening fee arithmetic: max(min, ceil(size x prop)) = 2000 msat", feeMsat === 2000, String(feeMsat));
const buyRid = withNode(C, (n) => n.lsps2_select_params(rid, 0, BigInt(PAY_MSAT)));
const invParams = waitFor("lsps2_invoice_params", () => { drainLog(C); return seenEv(C, (e) => e.type === "lsps2_invoice_params"); }, 40);
check("LSPS2 buy answered with intercept params", !!invParams && invParams.paymentSizeMsat === PAY_MSAT, JSON.stringify(invParams || {}));

// --- The JIT invoice itself (bLIP-52 shape, checked with Fluid's own parser).
const jitInvoice = withNode(C, (n) => n.create_invoice_jit(BigInt(PAY_MSAT), "jit harness", 3600, lspId, invParams.interceptScid, invParams.cltvExpiryDelta));
const parsed = parseBolt11(jitInvoice);
check("JIT invoice parses; amount is the full payment size", Number(parsed.amountMsat) === PAY_MSAT);
check("JIT invoice first hint is the LSP intercept hop (fees 0)", parsed.routeHints.length >= 1 && parsed.routeHints[0].pubkey === lspId && lnScidToDecimal(parsed.routeHints[0].shortChannelId) === String(invParams.interceptScid) && parsed.routeHints[0].feeBaseMsat === 0 && parsed.routeHints[0].feeProportionalMillionths === 0);
check("JIT invoice min-final-CLTV carries the +2 margin (20)", parsed.minFinalCltvExpiryDelta === 20, String(parsed.minFinalCltvExpiryDelta));

// --- The gate recognises THIS invoice (audit section 5.4), and only with the record.
const jitCtx = { lspPubkey: lspId, interceptScids: { [parsed.paymentHash]: String(invParams.interceptScid) }, maxPaymentMsat: menu0.maxPaymentSizeMsat };
check("gate: JIT invoice passes at receivable 0", checkSatoraLightningReceivability({ destInput: jitInvoice, ownNodeId: nodeId(C), ownReceivableMsat: 0, jit: jitCtx }).ok === true);
check("gate: same invoice WITHOUT the local record is refused", checkSatoraLightningReceivability({ destInput: jitInvoice, ownNodeId: nodeId(C), ownReceivableMsat: 0 }).ok === false);
check("gate: same invoice with the record DELETED is refused", checkSatoraLightningReceivability({ destInput: jitInvoice, ownNodeId: nodeId(C), ownReceivableMsat: 0, jit: { ...jitCtx, interceptScids: {} } }).ok === false);

// --- LSPS1 client emits its request (no LSPS1 service in the
// published crate — the call itself must not throw and must return
// a request id; the flow completes against a real LSPS1 LSP).
let lsps1Rid = null;
try { lsps1Rid = withNode(C, (n) => n.lsps1_request_options(lspId)); } catch { /* counted below */ }
check("LSPS1 client request_options emits a request id", typeof lsps1Rid === "string" && lsps1Rid.length > 0, String(lsps1Rid));
pump(10);

// --- The payer pays the JIT invoice; the LSP opens the channel
// just-in-time and forwards payment - fee.
drain(C); drain(LSP); drain(P);
withNode(P, (n) => n.pay_invoice(jitInvoice, null));
const funded = waitFor("JIT channel funding requested by the LSP service", () => (fundPending(LSP, 0x22) ? true : null), 60);
check("LSP service requested channel funding on intercept", !!funded);
const gotJit = waitFor("wallet claims the JIT payment", () => { drainLog(C); return seenEv(C, (e) => e.type === "payment_received" && e.amountMsat === PAY_MSAT - feeMsat); }, 120);
check("JIT payment landed at payment - fee (1,998,000 msat)", !!gotJit && gotJit.amountMsat === PAY_MSAT - feeMsat, JSON.stringify(gotJit || {}));
const balAfterJit = balance(C);
check("wallet now holds the channel: spendable > 0, receivable ~ the 10,000 sat headroom", balAfterJit.channels === 1 && balAfterJit.spendableMsat > 0 && balAfterJit.receivableMsat >= 9000000, JSON.stringify(balAfterJit));

// --- Second receive over the same channel: NO new opening fee.
drain(C); drain(P);
const inv2 = withNode(C, (n) => n.create_invoice(500000n, "second receive", 3600));
withNode(P, (n) => n.pay_invoice(inv2, null));
const got2 = waitFor("second receive settles", () => { drainLog(C); return seenEv(C, (e) => e.type === "payment_received" && e.amountMsat === 500000); }, 60);
check("second receive is the full 500,000 msat (no opening fee)", !!got2 && got2.amountMsat === 500000, JSON.stringify(got2 || {}));

// --- Restart: same seed + KV. Channels and balances identical;
// reconnect and receive again.
const beforeRestart = balance(C);
restart(C, seed(12), "wallet");
pump(10); ticks(1);
const afterRestart = balance(C);
check("restart: node id, channels and balances identical", nodeId(C) === parsed.payee && afterRestart.channels === beforeRestart.channels && afterRestart.spendableMsat === beforeRestart.spendableMsat && afterRestart.receivableMsat === beforeRestart.receivableMsat, JSON.stringify(afterRestart));
connect(C, LSP);
connect(P, LSP);
pump(20);
drain(C); drain(P);
const inv3 = withNode(C, (n) => n.create_invoice(250000n, "post-restart receive", 3600));
withNode(P, (n) => n.pay_invoice(inv3, null));
const got3 = waitFor("post-restart receive settles", () => { drainLog(C); return seenEv(C, (e) => e.type === "payment_received" && e.amountMsat === 250000); }, 60);
check("post-restart receive settles in full (250,000 msat)", !!got3 && got3.amountMsat === 250000, JSON.stringify(got3 || {}));

console.log(failures === 0 ? "\nLSPS HARNESS: ALL CHECKS PASSED" : `\nLSPS HARNESS: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
