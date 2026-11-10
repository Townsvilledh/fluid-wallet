// Processor decision tests: real signed claims (ethers EIP-191 +
// the app's own builders) fed through decideClaims.
// Run: node tools/name-claims/process.test.mjs
import assert from "node:assert";
import { ethers } from "ethers";
import { buildSignedNameClaim, bitcoinAddress, algoAddressFromPhrase } from "../../src/wallet-core.js";
import { decideClaims, nameEntriesEqual, nameUpdateMerge, summarizeRelayScan, fetchClaimsPaged } from "./process-name-claims.mjs";
import { planLnurlEmission, lnurlOptedInNames, lnurlPathFor, LNURL_DIR } from "./lnurl-emit.mjs";
import { lnurlPayRequestJson } from "../../src/wallet-core.js";

let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log("✓", name); passed++; };

const PHRASE_A = "test test test test test test test test test test test junk";
const PHRASE_B = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const walletA = ethers.Wallet.fromPhrase(PHRASE_A);
const walletB = ethers.Wallet.fromPhrase(PHRASE_B);

async function claimEvent(phrase, wallet, name, createdAt, btcOverride = null) {
  const { event } = await buildSignedNameClaim({
    name, evm: wallet.address,
    btc: btcOverride || bitcoinAddress(phrase),
    algo: algoAddressFromPhrase(phrase),
    phrase, signerWallet: wallet, createdAt,
  });
  return event;
}

async function claimEventLn(phrase, wallet, name, createdAt, { ln = null, lnOffer = null, btc = null } = {}) {
  const { event } = await buildSignedNameClaim({
    name, evm: wallet.address,
    btc: btc || bitcoinAddress(phrase),
    ln, lnOffer,
    algo: algoAddressFromPhrase(phrase),
    phrase, signerWallet: wallet, createdAt,
  });
  return event;
}

// An amountless BOLT 12 offer fixture (hand-built TLV stream, the
// same layout the core suite pins) — the only lnOffer shape the
// registry accepts for a name.
const { bech32m } = await import("@scure/base");
const tlvB = (type, value) => Buffer.concat([Buffer.from([type, value.length]), value]);
const b2wB = (bytes) => { let acc = 0, bits = 0; const out = [];
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; out.push((acc >>> bits) & 31); } acc &= (1 << bits) - 1; }
  if (bits > 0) out.push((acc << (5 - bits)) & 31); return out; };
const OFFER_OPEN = bech32m.encode("lno", b2wB(Buffer.concat([
  tlvB(2, Buffer.from("6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000", "hex")),
  tlvB(10, Buffer.from("fluid node", "utf8")),
  tlvB(18, Buffer.from("fluid", "utf8")),
  tlvB(22, Buffer.from("02" + "11".repeat(32), "hex")),
])), 8000);

const reg = () => ({ ethuram: { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", btc: "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw" } });
const emptyState = () => ({ processed: {}, winners: {} });

// 1. A valid claim wins, in created_at order.
{
  const ev = await claimEvent(PHRASE_A, walletA, "newname1", 1000);
  const { decisions, winners } = decideClaims([ev], reg(), emptyState());
  ok("valid claim wins", winners.length === 1 && winners[0].name === "newname1" && decisions[0].decision === "winner");
  ok("winner entry carries the signed addresses", winners[0].entry.evm === walletA.address && winners[0].entry.btc === bitcoinAddress(PHRASE_A));
}

// 2. Tampered claim: the btc address changed AFTER signing — the
//    signature no longer recovers the claimed EVM address.
{
  const ev = await claimEvent(PHRASE_A, walletA, "tamper1", 1000);
  const content = JSON.parse(ev.content);
  content.btc = bitcoinAddress(PHRASE_B); // swapped post-signing
  const { buildNameClaimMessage } = await import("../../src/wallet-core.js");
  ok("tamper setup truly breaks recovery", ethers.verifyMessage(buildNameClaimMessage(content), content.sig).toLowerCase() !== content.evm.toLowerCase());
  const tampered = { ...ev, content: JSON.stringify(content) };
  // The Nostr event id covers content, so the tampered copy also
  // fails the transport check — refused either way, never a winner.
  const { winners } = decideClaims([tampered], reg(), emptyState());
  ok("tampered claim refused", winners.length === 0);
}

// 3. Bad EIP-191 signature with a VALID Nostr wrapper: rebuild the
//    event around a forged claim using the real builder path for a
//    different name, then swap the signature — verifyNameClaim must
//    be the refusing layer.
{
  const ev = await claimEvent(PHRASE_A, walletA, "forged1", 1000);
  const content = JSON.parse(ev.content);
  const other = await claimEvent(PHRASE_A, walletA, "forged2", 1001);
  content.sig = JSON.parse(other.content).sig; // signature over a different message
  const { nostrEventId, nameClaimNostrKeys } = await import("../../src/wallet-core.js");
  const { schnorr } = await import("@noble/curves/secp256k1.js");
  const { sha256 } = await import("@noble/hashes/sha2.js");
  void sha256;
  const keys = nameClaimNostrKeys(PHRASE_A);
  const forged = { ...ev, content: JSON.stringify(content) };
  forged.id = nostrEventId(forged);
  forged.sig = Buffer.from(schnorr.sign(Uint8Array.from(Buffer.from(forged.id, "hex")), keys.priv)).toString("hex");
  const { decisions, winners } = decideClaims([forged], reg(), emptyState());
  ok("forged EIP-191 signature refused by claim verification", winners.length === 0 && decisions[0].decision === "rejected" && /signature/.test(decisions[0].reason));
}

// 4. Already-taken name: a valid claim for a registered name held by
//    a DIFFERENT wallet is refused.
{
  const ev = await claimEvent(PHRASE_A, walletA, "ethuram", 1000);
  const { decisions, winners } = decideClaims([ev], reg(), emptyState());
  ok("claim for a registered name (different wallet) refused", winners.length === 0 && decisions[0].decision === "rejected" && /already registered/.test(decisions[0].reason));
}

// 5. Identical duplicate: the registry already holds EXACTLY this
//    claim — idempotent no-op, not an error, not a second entry.
{
  const ev = await claimEvent(PHRASE_A, walletA, "dupname", 1000);
  const content = JSON.parse(ev.content);
  const registry = { dupname: { evm: content.evm, btc: content.btc, algo: content.algo } };
  const { decisions, winners } = decideClaims([ev], registry, emptyState());
  ok("identical duplicate is a no-op", winners.length === 0 && decisions[0].decision === "duplicate");
}

// 6. FCFS inside one batch: two valid claims for the same new name —
//    the EARLIER created_at wins even when it arrives second in the
//    relay results; the later one is refused.
{
  const early = await claimEvent(PHRASE_A, walletA, "race1", 1000);
  const late = await claimEvent(PHRASE_B, walletB, "race1", 2000);
  const { decisions, winners } = decideClaims([late, early], reg(), emptyState());
  ok("earlier claim wins the race", winners.length === 1 && winners[0].entry.evm === walletA.address);
  const loser = decisions.find((d) => d.eventId === late.id);
  ok("later claim for the same name refused", !!loser && loser.decision === "rejected" && /earlier valid claim/.test(loser.reason));
}

// 7. A name won in a PRIOR run (state) blocks a fresh claim.
{
  const ev = await claimEvent(PHRASE_B, walletB, "oldwin", 3000);
  const state = { processed: {}, winners: { oldwin: "some-prior-event" } };
  const { decisions, winners } = decideClaims([ev], reg(), state);
  ok("prior-run winner blocks a new claim", winners.length === 0 && decisions[0].decision === "rejected");
}

// 8. Already-processed events are skipped entirely (idempotent runs).
{
  const ev = await claimEvent(PHRASE_A, walletA, "seen1", 1000);
  const state = { processed: { [ev.id]: { decision: "winner" } }, winners: { seen1: ev.id } };
  const { decisions, winners } = decideClaims([ev], { seen1: { evm: walletA.address, btc: bitcoinAddress(PHRASE_A) } }, state);
  ok("processed event is a no-op", decisions.length === 0 && winners.length === 0);
}

// 9. The per-run cap defers (does not reject) overflow winners.
{
  const evs = [];
  for (let i = 0; i < 3; i++) evs.push(await claimEvent(PHRASE_A, walletA, "capname" + i, 1000 + i));
  const { decisions, winners } = decideClaims(evs, reg(), emptyState(), 2);
  ok("cap holds winners at the limit", winners.length === 2);
  ok("overflow is deferred, not rejected", decisions.some((d) => d.decision === "deferred" && d.deferred));
}

// 10. Entry equality: EVM case is ignored, BTC case is not.
ok("entries equal: evm case-insensitive", nameEntriesEqual({ evm: "0xABC", btc: "bc1q" }, { evm: "0xabc", btc: "bc1q" }));
ok("entries unequal: btc case differs", !nameEntriesEqual({ evm: "0xabc", btc: "BC1Q" }, { evm: "0xabc", btc: "bc1q" }));

// 11. Per-relay scan summary (audit P0-1): counts are pre-merge and
// per relay; a failed query reads -1 so a silent relay is visible.
{
  const s = summarizeRelayScan(
    [{ status: "fulfilled", value: [{ id: "a" }, { id: "b" }] }, { status: "fulfilled", value: [] }, { status: "rejected", reason: new Error("down") }],
    ["wss://r1", "wss://r2", "wss://r3"]);
  ok("scan summary: per-relay counts, -1 on failure, total pre-merge", s.perRelay["wss://r1"] === 2 && s.perRelay["wss://r2"] === 0 && s.perRelay["wss://r3"] === -1 && s.total === 2);
}

// 12. Same-owner update (native Lightning, 2026-11-09): the owner
//     of a registered name adds its lnOffer with a fresh signed
//     claim — the processor merges it into the published entry.
{
  const base = await claimEvent(PHRASE_A, walletA, "updname", 1000);
  const c0 = JSON.parse(base.content);
  const registry = { updname: { evm: c0.evm, btc: c0.btc, algo: c0.algo } };
  const upd = await claimEventLn(PHRASE_A, walletA, "updname", 2000, { lnOffer: OFFER_OPEN });
  const { decisions, winners, updates } = decideClaims([upd], registry, emptyState());
  ok("same-owner lnOffer update merges into the published entry",
    winners.length === 0 && updates.length === 1 && decisions[0].decision === "updated" &&
    updates[0].entry.lnOffer === OFFER_OPEN && updates[0].entry.btc === c0.btc && updates[0].entry.algo === c0.algo && updates[0].entry.evm === c0.evm);
}

// 13. A DIFFERENT wallet's claim carrying lnOffer for a registered
//     name is still refused — the update path is owner-only.
{
  const registry = { takenname: { evm: walletA.address, btc: bitcoinAddress(PHRASE_A) } };
  const ev = await claimEventLn(PHRASE_B, walletB, "takenname", 1000, { lnOffer: OFFER_OPEN });
  const { decisions, winners, updates } = decideClaims([ev], registry, emptyState());
  ok("different wallet cannot update a registered name", winners.length === 0 && updates.length === 0 && decisions[0].decision === "rejected" && /already registered/.test(decisions[0].reason));
}

// 14. A same-owner claim that tries to MOVE a registered chain
//     address (a different btc) alongside lnOffer is refused, not
//     merged — updates add fields and refresh Lightning only.
{
  const base = await claimEvent(PHRASE_A, walletA, "confname", 1000);
  const c0 = JSON.parse(base.content);
  const registry = { confname: { evm: c0.evm, btc: c0.btc, algo: c0.algo } };
  const bad = await claimEventLn(PHRASE_A, walletA, "confname", 2000, { lnOffer: OFFER_OPEN, btc: bitcoinAddress(PHRASE_B) });
  const { decisions, updates } = decideClaims([bad], registry, emptyState());
  ok("same-owner claim moving a chain address is refused", updates.length === 0 && decisions[0].decision === "rejected");
}

// 15. An identical claim INCLUDING lnOffer is a duplicate no-op.
{
  const ev = await claimEventLn(PHRASE_A, walletA, "dupoffer", 1000, { lnOffer: OFFER_OPEN });
  const c = JSON.parse(ev.content);
  const registry = { dupoffer: { evm: c.evm, btc: c.btc, algo: c.algo, lnOffer: OFFER_OPEN } };
  const { decisions, winners, updates } = decideClaims([ev], registry, emptyState());
  ok("identical claim with lnOffer is a duplicate", winners.length === 0 && updates.length === 0 && decisions[0].decision === "duplicate");
}

// 16. Updates never consume the per-run new-names cap.
{
  const base = await claimEvent(PHRASE_A, walletA, "capupd", 1000);
  const c0 = JSON.parse(base.content);
  const registry = { capupd: { evm: c0.evm, btc: c0.btc, algo: c0.algo } };
  const upd = await claimEventLn(PHRASE_A, walletA, "capupd", 2000, { ln: "owner@wallet.example" });
  const { winners, updates } = decideClaims([upd], registry, emptyState(), 0);
  ok("same-owner update lands even at cap 0", winners.length === 0 && updates.length === 1 && updates[0].entry.ln === "owner@wallet.example");
}

// 17. nameUpdateMerge units: the hosted address is replaceable by
//     the owner, silent fields are preserved, a foreign EVM is
//     refused outright.
ok("merge: ln replaceable, silent fields preserved, foreign evm refused",
  nameUpdateMerge({ evm: "0xAbC", btc: "bc1qx", ln: "old@wallet.example" }, { evm: "0xabc", btc: "bc1qx", ln: "new@wallet.example" }).ln === "new@wallet.example" &&
  nameUpdateMerge({ evm: "0xabc", btc: "bc1qx", algo: "ALGO1" }, { evm: "0xabc", btc: "bc1qx", lnOffer: OFFER_OPEN }).algo === "ALGO1" &&
  nameUpdateMerge({ evm: "0xabc", btc: "bc1qx" }, { evm: "0xdef", btc: "bc1qx" }) === null);

// 18. fetchClaimsPaged: a claim buried past the relay's first page
//     is still found — pages walk back with `until` to the window
//     floor, dedupe by id, and stop on a short page or at maxPages.
{
  const mk = (id, t) => ({ id, created_at: t, kind: 30078, tags: [], content: "{}", pubkey: "p", sig: "s" });
  const all = [mk("a", 900), mk("b", 800), mk("c", 700), mk("d", 600), mk("e", 500)];
  const fakeRelay = (pages) => {
    let i = 0;
    return async () => pages[i++] || [];
  };
  const paged = await fetchClaimsPaged(fakeRelay([[all[0], all[1]], [all[2], all[3]], [all[4]]]), { kinds: [30078], since: 100 }, 2);
  ok("paged scan walks back past the first page", paged.length === 5 && paged[4].id === "e");
  const dup = await fetchClaimsPaged(fakeRelay([[all[0], all[1]], [all[1], all[2]]]), { kinds: [30078], since: 100 }, 2);
  ok("paged scan dedupes overlapping pages", dup.length === 3);
  let floorCalls = 0;
  const floorRelay = async () => { floorCalls++; return [[all[0], all[1]], [all[2], all[3]], [all[4]]][floorCalls - 1] || []; };
  const floored = await fetchClaimsPaged(floorRelay, { kinds: [30078], since: 750 }, 2);
  ok("paged scan stops paging at the since floor", floorCalls === 2 && floored.length === 4);
  let calls = 0;
  const endless = async () => { calls++; return [mk("x" + calls, 1000 - calls), mk("y" + calls, 999 - calls)]; };
  const capped = await fetchClaimsPaged(endless, { kinds: [30078], since: 0 }, 2, 3);
  ok("paged scan respects maxPages", calls === 3 && capped.length === 6);
  const untils = [];
  const recording = async (f) => { untils.push(f.until || null); return untils.length === 1 ? [all[0], all[1]] : [all[2]]; };
  await fetchClaimsPaged(recording, { kinds: [30078], since: 100 }, 2);
  ok("paged scan chains until = oldest-1 with the caller's limit", untils[0] === null && untils[1] === 799); // limit asserted via pageSize arg above
}

// 19. lnBridge (LNURL bridge opt-in, 2026-11-11): a same-owner
//     claim carrying the flag merges it in; a later same-owner
//     claim without it clears it (the opt-out); equality sees it.
{
  const claimEventBridge = async (phrase, wallet, name, createdAt, lnBridge) => {
    const { event } = await buildSignedNameClaim({
      name, evm: wallet.address,
      btc: bitcoinAddress(phrase),
      algo: algoAddressFromPhrase(phrase),
      lnBridge,
      phrase, signerWallet: wallet, createdAt,
    });
    return event;
  };
  const base = await claimEvent(PHRASE_A, walletA, "bridgename", 1000);
  const c0 = JSON.parse(base.content);
  const registry = { bridgename: { evm: c0.evm, btc: c0.btc, algo: c0.algo } };
  const on = await claimEventBridge(PHRASE_A, walletA, "bridgename", 2000, true);
  const r1 = decideClaims([on], registry, emptyState());
  ok("lnBridge: same-owner opt-in merges the flag in",
    r1.updates.length === 1 && r1.decisions[0].decision === "updated" && r1.updates[0].entry.lnBridge === true && r1.updates[0].entry.btc === c0.btc);
  const registryOn = { bridgename: r1.updates[0].entry };
  const off = await claimEventBridge(PHRASE_A, walletA, "bridgename", 3000, null);
  const r2 = decideClaims([off], registryOn, emptyState());
  ok("lnBridge: same-owner republish without the flag clears it (opt-out)",
    r2.updates.length === 1 && r2.updates[0].entry.lnBridge === undefined && r2.updates[0].entry.evm === c0.evm);
  ok("lnBridge: equality distinguishes flag on/off",
    !nameEntriesEqual({ evm: c0.evm, btc: c0.btc, lnBridge: true }, { evm: c0.evm, btc: c0.btc }) &&
    nameEntriesEqual({ evm: c0.evm, btc: c0.btc, lnBridge: true }, { evm: c0.evm, btc: c0.btc, lnBridge: true }));
  ok("lnBridge: merge units — claim states the flag outright",
    nameUpdateMerge({ evm: "0xabc", btc: "bc1qx" }, { evm: "0xabc", btc: "bc1qx", lnBridge: true }).lnBridge === true &&
    nameUpdateMerge({ evm: "0xabc", btc: "bc1qx", lnBridge: true }, { evm: "0xabc", btc: "bc1qx" }).lnBridge === undefined);
  const foreign = await claimEventBridge(PHRASE_B, walletB, "bridgename", 4000, true);
  const r3 = decideClaims([foreign], registryOn, emptyState());
  ok("lnBridge: a different wallet cannot set the flag", r3.updates.length === 0 && r3.decisions[0].decision === "rejected");
}

// 20. LNURL step-1 emission plan (mirrors the bridge package's
//     suite, against the repo's own step-1 builder): the served
//     files always match the registry's opt-ins exactly.
{
  const registry = {
    ethuram: { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", lnBridge: true },
    meeday: { evm: "0xc675C7A6fdC261eF546D526726A2d262f54E1051" }, // not opted in
    qa1: { evm: "0x1111111111111111111111111111111111111111", lnBridge: true },
    qa2: { evm: "0x2222222222222222222222222222222222222222", lnBridge: false },
    "Bad Name": { evm: "0x3333333333333333333333333333333333333333", lnBridge: true }, // charset refusal
  };
  ok("emission: opted-in names are the flagged, charset-valid ones", JSON.stringify(lnurlOptedInNames(registry)) === JSON.stringify(["ethuram", "qa1"]));
  let plan = planLnurlEmission(registry, new Map());
  ok("emission: cold start writes both opted-in files, deletes nothing",
    plan.writes.size === 2 && plan.deletes.length === 0 &&
    plan.writes.get(lnurlPathFor("ethuram")) === lnurlPayRequestJson("ethuram") &&
    JSON.parse(plan.writes.get(lnurlPathFor("qa1"))).tag === "payRequest");
  const current = new Map(plan.writes);
  plan = planLnurlEmission(registry, current);
  ok("emission: steady state is a no-op", plan.writes.size === 0 && plan.deletes.length === 0);
  const reg2 = { ...registry, qa1: { evm: registry.qa1.evm } };
  plan = planLnurlEmission(reg2, current);
  ok("emission: opt-out deletes the file, the other stays", plan.writes.size === 0 && JSON.stringify(plan.deletes) === JSON.stringify([lnurlPathFor("qa1")]));
  const withStale = new Map(current);
  withStale.set(LNURL_DIR + "/ghost", "{}");
  plan = planLnurlEmission(registry, withStale);
  ok("emission: stale foreign file is cleaned up", JSON.stringify(plan.deletes) === JSON.stringify([LNURL_DIR + "/ghost"]));
  const corrupted = new Map(current);
  corrupted.set(lnurlPathFor("ethuram"), "{\"tag\":\"payRequest\"");
  plan = planLnurlEmission(registry, corrupted);
  ok("emission: corrupted content is rewritten to the canonical bytes", plan.writes.get(lnurlPathFor("ethuram")) === lnurlPayRequestJson("ethuram"));
}

console.log(`\n${passed} processor checks passed`);
