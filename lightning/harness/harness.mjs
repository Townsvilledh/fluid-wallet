// fluid-lightning harness: WASM nodes on throwaway regtest seeds, a
// fake chain driven through the same Confirm calls the real Esplora
// driver uses. Proves channel open, BOLT 11 payments both ways,
// BOLT 12 offer payment, and BOLT 12 ASYNC RECEIVE with a static
// invoice server in BOTH of LDK's hold modes:
//  - ToCounterparty: the payer's LSP parks the HTLC (4-node chain
//    payer -> payer's LSP -> SIS -> recipient), and
//  - ToUs: the payer holds its own HTLC because its next hop does not
//    advertise htlc_hold (3-node chain payer -> SIS -> recipient).
// In both: pay while the recipient is offline -> settle on return.
// Run: node harness/harness.mjs
import { FakeChain, makeNode, withNode, pump, ticks, reverseHex, sha256d } from "./host.mjs";
import { createHash } from "node:crypto";

const now = Math.floor(Date.now() / 1000);
const chain = new FakeChain(now);
const seed = (i) => createHash("sha256").update(`fluid-harness-throwaway-${i}`).digest("hex");

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
};
const drain = (h) => withNode(h, (n) => JSON.parse(n.drain_events()));
const balance = (h) => withNode(h, (n) => JSON.parse(n.balance()));
const all = [];

function syncTip() {
  const tip = chain.tip();
  for (const h of all) withNode(h, (n) => n.best_block_updated(chain.height, tip.hash, tip.headerHex));
}
function advance(blocks = 1) {
  chain.mine(blocks);
  syncTip();
  pump(10);
}
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

// Fabricate a funding transaction paying `valueSat` to `scriptHex`.
// Only the output matters to LDK; the input is a dummy (the harness
// chain source is authoritative, as in the real LDK trust model).
function fundingTx(valueSat, scriptHex, salt) {
  const script = Buffer.from(scriptHex, "hex");
  const parts = [];
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
  parts.push(u32(2)); // version
  parts.push(Buffer.from([0, 1])); // segwit marker + flag
  parts.push(Buffer.from([1])); // 1 input
  parts.push(Buffer.alloc(32, salt)); // dummy prev txid
  parts.push(u32(0));
  parts.push(Buffer.from([0])); // empty scriptSig (segwit input)
  parts.push(u32(0xffffffff));
  parts.push(Buffer.from([1])); // 1 output
  parts.push(u64(valueSat));
  parts.push(Buffer.from([script.length]));
  parts.push(script);
  // Witness: 2 items (dummy signature + dummy pubkey) so the input is
  // a fully-signed segwit spend as far as LDK's checks are concerned.
  parts.push(Buffer.from([2, 71]));
  parts.push(Buffer.alloc(71, 0x30));
  parts.push(Buffer.from([33]));
  parts.push(Buffer.alloc(33, 0x02));
  parts.push(u32(0)); // locktime
  const raw = Buffer.concat(parts);
  return { rawHex: raw.toString("hex"), txid: reverseHex(sha256d(raw).toString("hex")) };
}

function connect(x, y) {
  const yId = withNode(y, (n) => n.node_id());
  const connX = withNode(x, (n) => n.connect_peer(yId, y.name, 9735));
  const connY = withNode(y, (n) => n.accept_peer());
  x.host.completeDial(y.host, connY);
  pump(30);
  return { x, y, connX, connY };
}
function disconnect(link) {
  withNode(link.x, (n) => n.socket_closed(link.connX));
  withNode(link.y, (n) => n.socket_closed(link.connY));
  link.x.host.links.delete(link.connX);
  link.y.host.links.delete(link.connY);
  pump(10);
}

function openChannel(from, to, amountSat, salt) {
  const toId = withNode(to, (n) => n.node_id());
  const uid = withNode(from, (n) => n.open_channel(toId, BigInt(amountSat), 0n));
  const ev = waitFor("funding_needed", () => drain(from).find((e) => e.type === "funding_needed"));
  if (!ev) throw new Error("no funding_needed event");
  const pending = withNode(from, (n) => JSON.parse(n.pending_funding()));
  const req = pending.find((r) => r.userChannelId === uid) || pending[0];
  const ftx = fundingTx(req.valueSat, req.scriptPubkey, salt);
  // Order matters, twice over:
  //  1. funding_transaction_generated first (only then does LDK watch
  //     the outpoint).
  //  2. The FundingCreated/funding_signed exchange must be PUMPED to
  //     completion before confirming: a channel only becomes a *funded*
  //     channel (the kind chain events are processed for) once
  //     funding_signed returns to the opener, and the monitor watch is
  //     registered at that point. Confirming earlier is silently a
  //     no-op for both sides. (The production Esplora driver re-polls
  //     relevant txids every cycle, so it self-heals; a one-shot
  //     harness confirm does not.)
  withNode(from, (n) => n.funding_tx_ready(uid, ftx.rawHex));
  const settled = waitFor("channel_pending on both sides", () => {
    const a = drain(from).find((e) => e.type === "channel_pending");
    const b = drain(to).find((e) => e.type === "channel_pending");
    return a && b ? true : null;
  }, 30);
  if (!settled) throw new Error("channel_pending never fired on both sides");
  const atHeight = chain.height + 1;
  chain.mine(1);
  for (const h of [from, to]) {
    const tip = chain.tip();
    withNode(h, (n) => n.confirm_transactions(tip.headerHex, atHeight, [0], [ftx.rawHex]));
  }
  advance(8); // minimum depth + margin
  const ready = waitFor("channel_ready", () => drain(from).find((e) => e.type === "channel_ready"), 30);
  return { uid, ftx, ready };
}

// ------------------------------------------------------------------
const A = makeNode("A", seed(1), chain); // the "phone" (wallet role)
const B = makeNode("B", seed(2), chain, "server"); // its peer / LSP / SIS
const P = makeNode("P", seed(3), chain); // an unrelated payer
all.push(A, B, P);
syncTip();
check("three distinct node ids", new Set(all.map((h) => withNode(h, (n) => n.node_id()))).size === 3);

const linkAB = connect(A, B);
let linkPB = connect(P, B);
// A<->P get an onion-level peer link too (no channel). This models
// the real network, where any node can reach an LSP's other peers as
// blinded-path introduction points through ordinary onion routing;
// without it, a closed 3-node world makes some introduction choices
// undeliverable in a way the deployed network never is.
let linkAP = connect(A, P);
check("peers connected (channels list still empty)", balance(A).channels === 0);

const chAB = openChannel(A, B, 200_000, 0xaa);
check("channel A-B ready after fabricated funding confirms", !!chAB.ready);
const chPB = openChannel(P, B, 200_000, 0xbb);
check("channel P-B ready", !!chPB.ready);
check("balances show both channels", balance(B).channels === 2);

// --- BOLT 11: B invoices, A pays.
// Amount note: 2,500,000 msat is deliberately large. BOLT 2 makes B
// keep the channel reserve A selected (1% of 200,000 sat = 2,000 sat)
// before B can spend anything back; a 5,000 msat receipt would leave
// B's spendable balance at exactly zero (verified against LDK's
// available-balance code) and the B->A payment below could never route.
drain(A); drain(B);
const invB = withNode(B, (n) => n.create_invoice(2500000n, "harness coffee", 3600));
check("B invoice created", invB.startsWith("lnbcrt"), invB.slice(0, 24));
withNode(A, (n) => n.pay_invoice(invB, null));
const sentA = waitFor("A payment_sent", () => drain(A).find((e) => e.type === "payment_sent"));
const gotB = waitFor("B payment_received", () => drain(B).find((e) => e.type === "payment_received"));
check("BOLT11 A->B settled", !!sentA && !!gotB && gotB.amountMsat === 2500000, JSON.stringify(gotB || {}));

// --- BOLT 11: A invoices, B pays back.
// B's claimed balance becomes *spendable* only once the fulfill's
// commitment dance completes; a real wallet keys off the spendable
// balance, so the harness waits for it instead of racing the dance.
const spendable = waitFor("B spendable balance after claim", () => {
  const chs = JSON.parse(withNode(B, (n) => n.channels()));
  const ab = chs.find((c) => c.counterparty === withNode(A, (n) => n.node_id()));
  return ab && ab.outboundMsat >= 3000 ? ab : null;
});
check("B spendable after claim", !!spendable);
const invA = withNode(A, (n) => n.create_invoice(3000n, "payback", 3600));
withNode(B, (n) => n.pay_invoice(invA, null));
const gotA = waitFor("A payment_received", () => drain(A).find((e) => e.type === "payment_received"));
check("BOLT11 B->A settled", !!gotA && gotA.amountMsat === 3000);

// --- BOLT 12: B's offer, A pays.
// B creates the offer while only A is connected to it (P's link is
// down): an offer's blinded paths name introduction peers, and the
// payer uses the first path — so the offer must be built from the
// peer set as it stands when the offer is made, exactly like a real
// wallet whose user shares an offer while connected to their LSP.
disconnect(linkPB);
const offerB = withNode(B, (n) => n.create_offer(7000n, "harness offer"));
check("B offer created", offerB.startsWith("lno1"));
withNode(A, (n) => n.pay_offer(offerB, null));
const gotB12 = waitFor("B offer payment received", () => drain(B).find((e) => e.type === "payment_received" && e.kind === "bolt12_offer"));
check("BOLT12 offer A->B settled", !!gotB12 && gotB12.amountMsat === 7000, JSON.stringify(gotB12 || {}));
linkPB = connect(P, B);
pump(30); ticks(2); // let B's view of the reconnected peer settle

// --- BOLT 12 ASYNC RECEIVE, leg 1 (ToCounterparty hold).
// Topology: P -> L -> B(SIS) -> A. L is P's own LSP (server role:
// it advertises htlc_hold, so P asks L to park the payment's HTLC
// instead of sending it onwards while A is offline). L's outgoing
// channel towards B stays live throughout, which is exactly the
// always-online LSP<->SIS shape this hold mode is designed for.
const L = makeNode("L", seed(4), chain, "server");
all.push(L);
syncTip();
connect(P, L);
connect(L, B);
// A<->L onion link (no channel): B's reply paths for the async
// negotiation may be introduced by any of B's peers, and an onion
// message is delivered by connecting directly to its introduction
// node. The production driver dials such a peer on demand
// (ConnectionNeeded); the harness models that standing ability here.
const linkAL = connect(A, L);
const chPL = openChannel(P, L, 200_000, 0xcc);
check("channel P-L ready", !!chPL.ready);
const chLB = openChannel(L, B, 200_000, 0xdd);
check("channel L-B ready", !!chLB.ready);
// Take P's direct link to B down for this leg: with two hold-capable
// first hops the router could park the HTLC at B, whose channel to
// the offline A is not live — the one shape this mode cannot serve.
// A single deterministic first hop (L) models the production case of
// a payer whose LSP is not the recipient's SIS.
disconnect(linkPB);
// The recipient_id convention in this crate is the recipient's
// node-id hex: the SIS uses it to rate-limit, and the message router
// uses it to avoid offering a path introduced by the recipient
// itself (the node that will be offline when the path is used).
const pathsJson = withNode(B, (n) => n.sis_paths_for_recipient(withNode(A, (x) => x.node_id())));
check("SIS paths issued by B", Array.isArray(JSON.parse(pathsJson)) && JSON.parse(pathsJson).length > 0);
withNode(A, (n) => n.set_sis_paths(JSON.parse(pathsJson)));
let asyncOffer = null;
// NOTE on cadence: the manager timer tick is a ~once-a-minute protocol
// input (it resets the async-offer request attempt counter). Ticking
// in a tight loop floods the onion-message queue past its 256KB
// per-peer buffer and the flow strangles itself — tick sparingly and
// let plain message pumping (which processes events on every socket
// read) do the work, exactly as the shipped drivers do.
for (let i = 0; i < 120 && !asyncOffer; i++) {
  pump(20);
  if (i % 20 === 19) { ticks(1); advance(1); }
  try { asyncOffer = withNode(A, (n) => n.async_receive_offer()); } catch { /* not ready yet */ }
}
check("A built its async-receive offer with B as SIS", !!asyncOffer && asyncOffer.startsWith("lno1"));

// A goes offline (ALL of its links drop — including the A-L onion
// link, or A would stay reachable for onion messages and release
// the payment early). P pays A's async offer; the HTLC must be
// parked at L, nothing may settle.
disconnect(linkAB);
disconnect(linkAP);
disconnect(linkAL);
drain(P); drain(B); drain(A); drain(L);
withNode(P, (n) => n.pay_offer(asyncOffer, 9000n));
let pSentEarly = null;
for (let i = 0; i < 25; i++) {
  pump(15); ticks(1);
  pSentEarly = drain(P).find((e) => e.type === "payment_sent") || pSentEarly;
  if (i % 6 === 5) advance(1);
}
check("payment NOT settled while A is offline (held)", !pSentEarly);
const bServed = drain(B).find((e) => e.type === "static_invoice_requested" || e.type === "static_invoice_stored");
check("B served the static invoice for the offline recipient", !!bServed, JSON.stringify(bServed || {}));

// A returns: reconnect and the held payment must settle.
// Pacing note: the release onion message races the B-A channel's
// reestablish — if the released HTLC reaches B before the channel is
// live again, B fails it back and the payer's retry timer is what
// saves the payment. Production retry timers tick about once a
// minute, long after resumption (a few message round trips)
// completes; the harness's shared tight tick loop would burn all
// retry attempts inside the resumption window. So for the first
// rounds after reconnect, tick every node EXCEPT the payer — the
// same wall-clock shape as production, where pumps are continuous
// and per-node retry timers are slow.
connect(A, B);
linkAP = connect(A, P);
connect(A, L);
for (let i = 0; i < 12; i++) {
  pump(15);
  for (const h of [A, B, L]) withNode(h, (n) => n.timer_tick());
}
const gotHeld = waitFor("A receives held payment", () => drain(A).find((e) => e.type === "payment_received"), 80);
check("held payment settled to A on return (ToCounterparty)", !!gotHeld && gotHeld.amountMsat === 9000, JSON.stringify(gotHeld || {}));
const pSent = waitFor("P sees payment_sent", () => drain(P).find((e) => e.type === "payment_sent"), 40);
check("P sees the async payment complete (ToCounterparty)", !!pSent);

// --- BOLT 12 ASYNC RECEIVE, leg 2 (ToUs hold).
// Fresh trio where the SIS (B2) runs the WALLET role: it does not
// advertise htlc_hold, so the payer (P2) cannot park the HTLC at its
// next hop and instead holds the payment itself, sending only a
// HeldHtlcAvailable notice. On A's return the notice is released and
// P2 sends the payment for real. This is the mode arbitrary
// third-party payers will use against a Fluid offer today.
const A2 = makeNode("A2", seed(5), chain);
const B2 = makeNode("B2", seed(6), chain);
const P2 = makeNode("P2", seed(7), chain);
all.push(A2, B2, P2);
syncTip();
const linkA2B2 = connect(A2, B2);
connect(P2, B2);
let linkA2P2 = connect(A2, P2);
const chA2B2 = openChannel(A2, B2, 200_000, 0xee);
check("channel A2-B2 ready", !!chA2B2.ready);
const chP2B2 = openChannel(P2, B2, 200_000, 0xff);
check("channel P2-B2 ready", !!chP2B2.ready);
// Liquidity: B2->A2 starts with zero outbound balance (A2 opened the
// channel), so B2 could never forward the async payment to A2. A
// BOLT11 payment A2->B2 first shifts balance, exactly the
// inbound-liquidity step a real wallet needs before it can receive.
// The shift must clear the 1% channel reserve (2,000 sat on a
// 200,000 sat channel) before B2 can send anything back — hence
// 2,100 sat, not a token amount (same reserve math as the BOLT11
// note in leg 0).
const invB2 = withNode(B2, (n) => n.create_invoice(2100000n, "leg2 liquidity", 3600));
withNode(A2, (n) => n.pay_invoice(invB2, null));
const liq2 = waitFor("leg2 liquidity payment", () => drain(B2).find((e) => e.type === "payment_received"));
check("leg2 liquidity shifted to B2", !!liq2 && liq2.amountMsat === 2100000);
const paths2Json = withNode(B2, (n) => n.sis_paths_for_recipient(withNode(A2, (x) => x.node_id())));
check("SIS paths issued by B2", Array.isArray(JSON.parse(paths2Json)) && JSON.parse(paths2Json).length > 0);
withNode(A2, (n) => n.set_sis_paths(JSON.parse(paths2Json)));
let asyncOffer2 = null;
for (let i = 0; i < 120 && !asyncOffer2; i++) {
  pump(20);
  if (i % 20 === 19) { ticks(1); advance(1); }
  try { asyncOffer2 = withNode(A2, (n) => n.async_receive_offer()); } catch { /* not ready yet */ }
}
check("A2 built its async-receive offer with B2 as SIS", !!asyncOffer2 && asyncOffer2.startsWith("lno1"));
disconnect(linkA2B2);
disconnect(linkA2P2);
drain(P2); drain(B2); drain(A2);
withNode(P2, (n) => n.pay_offer(asyncOffer2, 8000n));
let p2SentEarly = null;
for (let i = 0; i < 25; i++) {
  pump(15); ticks(1);
  p2SentEarly = drain(P2).find((e) => e.type === "payment_sent") || p2SentEarly;
  if (i % 6 === 5) advance(1);
}
check("payment NOT settled while A2 is offline (held by payer)", !p2SentEarly);
const b2Served = drain(B2).find((e) => e.type === "static_invoice_requested" || e.type === "static_invoice_stored");
check("B2 served the static invoice for the offline recipient", !!b2Served, JSON.stringify(b2Served || {}));
connect(A2, B2);
linkA2P2 = connect(A2, P2);
const gotHeld2 = waitFor("A2 receives held payment", () => drain(A2).find((e) => e.type === "payment_received"), 80);
check("held payment settled to A2 on return (ToUs)", !!gotHeld2 && gotHeld2.amountMsat === 8000, JSON.stringify(gotHeld2 || {}));
const p2Sent = waitFor("P2 sees payment_sent", () => drain(P2).find((e) => e.type === "payment_sent"), 40);
check("P2 sees the async payment complete (ToUs)", !!p2Sent);

console.log(failures === 0 ? "\nHARNESS: ALL CHECKS PASSED" : `\nHARNESS: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
