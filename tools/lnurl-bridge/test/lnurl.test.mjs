// LNURL step-1 bytes, metadata hash, and the BOLT11 reader.
// Run: node test/lnurl.test.mjs
import assert from "node:assert";
import { createHash } from "node:crypto";
import {
  isLnurlName, lnurlAddress, lnurlPayMetadata, lnurlStep1, lnurlStep1Json,
  lnurlMetadataSha256Hex, lnurlCallbackUrl, lnurlError, parseBolt11,
  MIN_SENDABLE_MSAT, MAX_SENDABLE_MSAT, BRIDGE_BASE,
} from "../src/lnurl.mjs";
import { buildMockInvoice } from "./mock-wallet.mjs";

// Names
assert.ok(isLnurlName("ethuram"));
assert.ok(isLnurlName("lnpubqa5110"));
assert.ok(!isLnurlName("Ethuram")); // uppercase is not LUD-16
assert.ok(!isLnurlName("bad name"));
assert.ok(!isLnurlName(""));
assert.ok(!isLnurlName("../evil"));

// Step 1 shape (LUD-06/LUD-16)
const s1 = lnurlStep1("ethuram");
assert.equal(s1.tag, "payRequest");
assert.equal(s1.callback, BRIDGE_BASE + "/lnurlp/callback/ethuram");
assert.equal(s1.minSendable, MIN_SENDABLE_MSAT);
assert.equal(s1.maxSendable, MAX_SENDABLE_MSAT);
const meta = JSON.parse(s1.metadata);
assert.deepEqual(meta, [
  ["text/plain", "Pay to " + "ethu" + "ram@fluidwallet.dpdns.org"],
  ["text/identifier", "ethuram@fluidwallet.dpdns.org"],
]);
assert.equal(lnurlAddress("ethuram"), "ethuram@fluidwallet.dpdns.org");
assert.equal(lnurlCallbackUrl("ethuram"), s1.callback);

// The static file bytes parse back to the same object (JSON, pretty)
assert.deepEqual(JSON.parse(lnurlStep1Json("ethuram")), s1);
assert.ok(lnurlStep1Json("ethuram").endsWith("\n"));

// Metadata hash = sha256 of the EXACT metadata string (tester rule)
const expectHash = createHash("sha256").update(lnurlPayMetadata("ethuram"), "utf8").digest("hex");
assert.equal(lnurlMetadataSha256Hex("ethuram"), expectHash);
assert.notEqual(lnurlMetadataSha256Hex("ethuram"), lnurlMetadataSha256Hex("meeday"));

// Error shape
assert.deepEqual(lnurlError("nope"), { status: "ERROR", reason: "nope" });

// BOLT11 reader on mock invoices across the amount range
const now = Math.floor(Date.now() / 1000);
for (const amountMsat of [1000, 21000, 100000, 999999999, 1000000000]) {
  const descHash = lnurlMetadataSha256Hex("ethuram");
  const { invoice, paymentHashHex } = buildMockInvoice({ amountMsat, descriptionHashHex: descHash, nowSecs: now });
  const p = parseBolt11(invoice);
  assert.equal(p.amountMsat, amountMsat, `amount ${amountMsat}`);
  assert.equal(p.descriptionHashHex, descHash);
  assert.equal(p.paymentHashHex, paymentHashHex);
  assert.equal(p.network, "bc");
  assert.equal(p.expirySecs, 3600);
  assert.ok(p.expiresAt > now, "fresh invoice must not read expired");
}
// Expired invoice reads expired
{
  const { invoice } = buildMockInvoice({ amountMsat: 5000, descriptionHashHex: lnurlMetadataSha256Hex("ethuram"), nowSecs: now - 7200, expirySecs: 3600 });
  const p = parseBolt11(invoice);
  assert.ok(p.expiresAt < now, "stale invoice must read expired");
}
// Garbage in -> throw
assert.throws(() => parseBolt11("not an invoice"));
assert.throws(() => parseBolt11("lnbc210000p1qqqqqq"));

console.log("lnurl.test.mjs: all checks passed");
