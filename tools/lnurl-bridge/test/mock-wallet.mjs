// Mock NWC wallet for offline bridge tests: the stand-in for the
// Fluid app's NWC responder. Connects to the local relay, answers
// kind-23194 make_invoice requests with kind-23195 responses, and
// "mints" structurally valid BOLT11 invoices (real bech32, correct
// amount + description-hash tags; the signature words are filler —
// in production the app's LDK node signs for real, and the bridge
// deliberately does not verify invoice signatures: that is the
// payer wallet's job).
import { bech32 } from "@scure/base";
import { nip44Encrypt, nip44Decrypt, nip44ConversationKey, hexToBytes, bytesToHex, randomBytes, sha256, utf8 } from "../src/nip44.mjs";
import { signNostrEvent, verifyNostrEvent, nostrPubkeyHex } from "../src/nostr.mjs";
import { openRelayWs } from "./local-relay.mjs";

function bytesToWords(bytes) {
  const words = [];
  let acc = 0, bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  return words;
}

function valueToWords(v) {
  const words = [];
  let n = v;
  do { words.unshift(n % 32); n = Math.floor(n / 32); } while (n > 0);
  return words;
}

/** Build a BOLT11 invoice string with the given amount (msat) and
 *  description hash. Expiry defaults to 3600s from `nowSecs`. */
export function buildMockInvoice({ amountMsat, descriptionHashHex, nowSecs, expirySecs = 3600 }) {
  const hrp = "lnbc" + String(amountMsat * 10) + "p"; // msat -> pico-BTC digits
  const ts = nowSecs || Math.floor(Date.now() / 1000);
  const words = [];
  // timestamp: 35 bits, big-endian 5-bit words
  const tsWords = valueToWords(ts);
  while (tsWords.length < 7) tsWords.unshift(0);
  words.push(...tsWords.slice(-7));
  const tag = (type, dataWords) => {
    words.push(type, (dataWords.length >> 5) & 31, dataWords.length & 31, ...dataWords);
  };
  const paymentHash = randomBytes(32);
  tag(1, bytesToWords(paymentHash)); // payment_hash
  tag(23, bytesToWords(hexToBytes(descriptionHashHex))); // description_hash
  tag(6, valueToWords(expirySecs)); // expiry
  for (let i = 0; i < 104; i++) words.push(0); // signature (filler in the mock)
  return { invoice: bech32.encode(hrp, words, 4096), paymentHashHex: bytesToHex(paymentHash) };
}

export async function startMockWallet({ relayUrl, walletPrivHex, clientPubHex, mode = "honest" }) {
  const priv = hexToBytes(walletPrivHex);
  const walletPubHex = nostrPubkeyHex(priv);
  const conn = await openRelayWs(relayUrl);
  const seen = [];
  // NIP-47 info event (kind 13194): declares make_invoice + nip44_v2.
  conn.send(JSON.stringify(["EVENT", signNostrEvent(priv, {
    kind: 13194,
    tags: [["encryption", "nip44_v2"]],
    content: "make_invoice",
  })]));
  conn.setOnMessage((text) => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (!Array.isArray(msg) || msg[0] !== "EVENT") return;
    const ev = msg[2];
    if (!ev || ev.kind !== 23194) return;
    if (ev.pubkey !== clientPubHex) return; // not our bridge client
    if (!verifyNostrEvent(ev)) return;
    let req;
    try {
      const plain = nip44Decrypt(ev.content, nip44ConversationKey(priv, clientPubHex));
      req = JSON.parse(plain);
    } catch { return; }
    seen.push(req);
    if (req.method !== "make_invoice") return;
    let amount = Number(req.params && req.params.amount);
    let descHash = String((req.params && req.params.description_hash) || "");
    if (mode === "wrong-amount") amount += 1000;
    if (mode === "wrong-hash") descHash = bytesToHex(sha256(utf8("not the metadata")));
    const { invoice, paymentHashHex } = buildMockInvoice({ amountMsat: amount, descriptionHashHex: descHash });
    const result = { result_type: "make_invoice", result: { type: "make_invoice", invoice, payment_hash: paymentHashHex } };
    const content = nip44Encrypt(JSON.stringify(result), nip44ConversationKey(priv, clientPubHex));
    conn.send(JSON.stringify(["EVENT", signNostrEvent(priv, {
      kind: 23195,
      tags: [["p", clientPubHex], ["e", ev.id]],
      content,
    })]));
  });
  conn.send(JSON.stringify(["REQ", "mock-wallet", { kinds: [23194], "#p": [walletPubHex] }]));
  return { walletPubHex, seen, close: () => conn.close() };
}
