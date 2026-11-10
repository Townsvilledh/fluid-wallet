// LNURL-pay (LUD-06) / Lightning Address (LUD-16) shared vocabulary
// for the Fluid bridge. The step-1 JSON built here is what the
// name-claims processor writes to `.well-known/lnurlp/<name>` and
// what the Worker hashes for description_hash — ONE implementation,
// so the two can never drift (the test suite pins the exact bytes).
import { bech32 } from "@scure/base";
import { sha256, utf8, bytesToHex } from "./nip44.mjs";

export const LNURL_DOMAIN = "fluidwallet.dpdns.org";
export const BRIDGE_BASE = "https://fluid-ws-proxy.kanugideontownsville.workers.dev";
export const MIN_SENDABLE_MSAT = 1000; // 1 sat
export const MAX_SENDABLE_MSAT = 1_000_000_000; // 1,000,000 sats per invoice

/** LUD-16 name part: lowercase a-z 0-9 and - _ . + only. Fluid names
 *  are stricter than this, so every valid Fluid name qualifies. */
export function isLnurlName(name) {
  return typeof name === "string" && /^[a-z0-9][a-z0-9\-_.+]*$/.test(name) && name.length <= 64;
}

export function lnurlAddress(name) {
  return `${name}@${LNURL_DOMAIN}`;
}

/** The metadata string, EXACTLY as served in step 1. The invoice's
 *  description_hash is sha256 of these bytes — never rebuild the
 *  JSON differently at hash time. */
export function lnurlPayMetadata(name) {
  return JSON.stringify([
    ["text/plain", `Pay to ${lnurlAddress(name)}`],
    ["text/identifier", lnurlAddress(name)],
  ]);
}

export function lnurlCallbackUrl(name) {
  return `${BRIDGE_BASE}/lnurlp/callback/${name}`;
}

/** LUD-06 step-1 payRequest object. */
export function lnurlStep1(name) {
  return {
    tag: "payRequest",
    callback: lnurlCallbackUrl(name),
    minSendable: MIN_SENDABLE_MSAT,
    maxSendable: MAX_SENDABLE_MSAT,
    metadata: lnurlPayMetadata(name),
  };
}

/** The exact bytes the processor writes to the static file. */
export function lnurlStep1Json(name) {
  return JSON.stringify(lnurlStep1(name), null, 2) + "\n";
}

export function lnurlMetadataSha256Hex(name) {
  return bytesToHex(sha256(utf8(lnurlPayMetadata(name))));
}

/** LUD-06 error body. Served with HTTP 200 by convention so payer
 *  wallets display `reason` instead of a bare transport failure. */
export function lnurlError(reason) {
  return { status: "ERROR", reason: String(reason || "unknown error") };
}

// --- Minimal BOLT 11 reader ---------------------------------------
// Just enough for the Worker to hold the wallet (and itself) honest:
// amount, payment hash, description hash, timestamp + expiry. Full
// signature/routing validation is the payer wallet's job, not the
// bridge's.

function wordsToBytes(words) {
  let acc = 0, bits = 0;
  const out = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function parseBolt11(invoice) {
  const str = String(invoice || "").trim().toLowerCase();
  if (!str.startsWith("ln")) throw new Error("not a BOLT11 invoice");
  const decoded = bech32.decode(str, 4096);
  const hrp = decoded.prefix;
  const words = decoded.words;
  const amountMsat = (() => {
    const m = /^ln(bc|tb|bcrt|sb)(\d*)([munp]?)$/.exec(hrp);
    if (!m) throw new Error("bad BOLT11 hrp");
    if (!m[2]) return null;
    const v = BigInt(m[2]);
    const factor = { "": 100_000_000_000n, m: 100_000_000n, u: 100_000n, n: 100n }[m[3]];
    if (m[3] === "p") {
      if (v % 10n !== 0n) throw new Error("sub-msat amount");
      return Number(v / 10n); // v counts pico-BTC (1e-12 BTC); msat = v * 1e11 / 1e12 = v / 10
    }
    return Number(v * factor);
  })();
  if (words.length < 7 + 104) throw new Error("invoice too short");
  let timestamp = 0;
  for (let i = 0; i < 7; i++) timestamp = timestamp * 32 + words[i];
  const tags = {};
  let i = 7;
  const end = words.length - 104; // signature words excluded
  while (i + 2 <= end) {
    const type = words[i];
    const len = words[i + 1] * 32 + words[i + 2];
    const data = words.slice(i + 3, i + 3 + len);
    if (data.length < len) break;
    if (tags[type] === undefined) tags[type] = data;
    i += 3 + len;
  }
  const tagBytes = (t) => (tags[t] ? wordsToBytes(tags[t]) : null);
  const expiryWords = tags[6];
  let expirySecs = 3600; // BOLT11 default when the tag is absent
  if (expiryWords) {
    let v = 0n;
    for (const w of expiryWords) v = v * 32n + BigInt(w);
    expirySecs = Number(v);
  }
  return {
    network: hrp.replace(/^ln/, "").replace(/\d.*$/, ""),
    amountMsat,
    timestamp,
    expirySecs,
    expiresAt: timestamp + expirySecs,
    paymentHashHex: tagBytes(1) ? bytesToHex(tagBytes(1).slice(0, 32)) : null,
    descriptionHashHex: tagBytes(23) ? bytesToHex(tagBytes(23).slice(0, 32)) : null,
    description: tagBytes(13) ? new TextDecoder().decode(tagBytes(13)) : null,
  };
}
