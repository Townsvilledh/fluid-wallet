// Processor decision tests: real signed claims (ethers EIP-191 +
// the app's own builders) fed through decideClaims.
// Run: node tools/name-claims/process.test.mjs
import assert from "node:assert";
import { ethers } from "ethers";
import { buildSignedNameClaim, bitcoinAddress, algoAddressFromPhrase } from "../../src/wallet-core.js";
import { decideClaims, nameEntriesEqual, summarizeRelayScan } from "./process-name-claims.mjs";

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

console.log(`\n${passed} processor checks passed`);
