// LNURL bridge core — register / unregister / callback handlers with
// every external dependency injected ({kv, fetchRegistry, nwcCall})
// so the whole surface is testable offline. The Cloudflare adapter
// (worker.js) supplies real KV, the live registry fetch and the
// relay transport; the tests supply fakes.
//
// Trust model (from the plan): the Worker NEVER holds funds or fund
// keys. A bridge record holds a make_invoice-scoped NWC client
// secret; its leak ceiling is invoice spam against the owner's own
// wallet, bounded by the wallet's own caps, revocable in-app at any
// time. Registration is authorised by an EIP-191 signature from the
// EVM key the public registry binds to the name — the same ownership
// proof the name-claims pipeline runs on.
import { isLnurlName, lnurlError, lnurlMetadataSha256Hex, parseBolt11, MIN_SENDABLE_MSAT, MAX_SENDABLE_MSAT } from "./lnurl.mjs";
import { eip191Verify } from "./eip191.mjs";
import { nostrPubkeyHex } from "./nostr.mjs";
import { hexToBytes } from "./nip44.mjs";
import { nwcMakeInvoice } from "./nwc-client.mjs";

export const BRIDGE_RECORD_PREFIX = "bridge:v1:";
export const REGISTER_TS_WINDOW_SECS = 600; // signatures older than 10 min are refused
export const CALLBACK_TIMEOUT_MS = 20000;
export const RATE_LIMIT_PER_MIN = 30;

const HEX64 = /^[0-9a-f]{64}$/;

/** Canonical registration text — the EXACT bytes the owner's EVM
 *  key signs. The app module builds the identical string; the test
 *  suite pins a sample so the two sides can never drift silently. */
export function buildRegisterMessage({ name, evm, walletPub, clientPub, relays, maxInvoiceMsat, ts }) {
  return [
    "Fluid LNURL bridge registration v1",
    "name: " + name,
    "evm: " + String(evm).toLowerCase(),
    "wallet: " + walletPub,
    "client: " + clientPub,
    "relays: " + (relays || []).join(","),
    "maxInvoiceMsat: " + String(maxInvoiceMsat),
    "ts: " + String(ts),
  ].join("\n");
}

export function buildUnregisterMessage({ name, evm, ts }) {
  return [
    "Fluid LNURL bridge removal v1",
    "name: " + name,
    "evm: " + String(evm).toLowerCase(),
    "ts: " + String(ts),
  ].join("\n");
}

function err(httpStatus, reason) {
  return { httpStatus, body: lnurlError(reason) };
}
function json(httpStatus, body) {
  return { httpStatus, body };
}

export function createBridgeCore(deps) {
  const kv = deps.kv;
  const fetchRegistry = deps.fetchRegistry;
  const nwcCallImpl = deps.nwcCallImpl || (async (a) => nwcMakeInvoice({ ...a, openRelay: deps.openRelay }));
  const callbackTimeoutMs = deps.callbackTimeoutMs || CALLBACK_TIMEOUT_MS;
  const nowSecs = deps.nowSecs || (() => Math.floor(Date.now() / 1000));
  // Best-effort per-isolate rate limiting: blunts invoice-mint spam
  // without burning KV write quota. The wallet's own caps are the
  // hard bound; this is a courtesy brake.
  const hits = new Map();
  function rateLimited(name) {
    const now = Date.now();
    const arr = (hits.get(name) || []).filter((t) => now - t < 60000);
    arr.push(now);
    hits.set(name, arr);
    return arr.length > RATE_LIMIT_PER_MIN;
  }

  async function registryEvmFor(name) {
    const registry = await fetchRegistry();
    const entry = registry && registry[name];
    return entry && typeof entry.evm === "string" ? entry.evm.toLowerCase() : null;
  }

  async function handleRegister(body) {
    const b = body || {};
    const name = String(b.name || "");
    if (!isLnurlName(name)) return err(400, "Invalid name.");
    const walletPub = String(b.walletPub || "").toLowerCase();
    const clientPub = String(b.clientPub || "").toLowerCase();
    const clientSecret = String(b.clientSecret || "").toLowerCase();
    if (!HEX64.test(walletPub) || !HEX64.test(clientPub) || !HEX64.test(clientSecret)) {
      return err(400, "Invalid NWC key material.");
    }
    // The stored secret must actually own the signed client pubkey —
    // otherwise a registrant could pin a victim's pubkey to a secret
    // the victim doesn't control (or vice versa).
    let derivedPub;
    try { derivedPub = nostrPubkeyHex(hexToBytes(clientSecret)); } catch { return err(400, "Invalid client secret."); }
    if (derivedPub !== clientPub) return err(400, "Client secret does not match the client public key.");
    const relays = Array.isArray(b.relays) ? b.relays.filter((r) => typeof r === "string" && /^wss:\/\/[^\s]+$/.test(r)).slice(0, 5) : [];
    if (!relays.length) return err(400, "No usable relays.");
    const maxInvoiceMsat = Number(b.maxInvoiceMsat);
    if (!Number.isInteger(maxInvoiceMsat) || maxInvoiceMsat < MIN_SENDABLE_MSAT || maxInvoiceMsat > MAX_SENDABLE_MSAT) {
      return err(400, "Invalid per-invoice cap.");
    }
    const ts = Number(b.ts);
    if (!Number.isInteger(ts) || Math.abs(nowSecs() - ts) > REGISTER_TS_WINDOW_SECS) {
      return err(400, "Registration signature is stale — try again.");
    }
    const evm = String(b.evm || "").toLowerCase();
    const message = buildRegisterMessage({ name, evm, walletPub, clientPub, relays, maxInvoiceMsat, ts });
    if (!eip191Verify(message, b.sig, evm)) return err(403, "Signature does not recover the claimed address.");
    let registryEvm;
    try { registryEvm = await registryEvmFor(name); } catch { return err(502, "Could not read the name registry to verify ownership."); }
    if (!registryEvm) return err(404, "That name is not in the Fluid registry.");
    if (registryEvm !== evm) return err(403, "The signature's address does not own this name in the registry.");
    const key = BRIDGE_RECORD_PREFIX + name;
    const existingRaw = await kv.get(key);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (typeof existing.ts === "number" && ts <= existing.ts) {
          return err(409, "A newer registration already exists for this name.");
        }
      } catch { /* a corrupt record is replaceable by a valid newer registration */ }
    }
    const record = { v: 1, name, evm, walletPub, clientPub, clientSecret, relays, maxInvoiceMsat, ts };
    await kv.put(key, JSON.stringify(record));
    return json(200, { ok: true, name });
  }

  async function handleUnregister(body) {
    const b = body || {};
    const name = String(b.name || "");
    if (!isLnurlName(name)) return err(400, "Invalid name.");
    const ts = Number(b.ts);
    if (!Number.isInteger(ts) || Math.abs(nowSecs() - ts) > REGISTER_TS_WINDOW_SECS) {
      return err(400, "Removal signature is stale — try again.");
    }
    const evm = String(b.evm || "").toLowerCase();
    const message = buildUnregisterMessage({ name, evm, ts });
    if (!eip191Verify(message, b.sig, evm)) return err(403, "Signature does not recover the claimed address.");
    let registryEvm;
    try { registryEvm = await registryEvmFor(name); } catch { return err(502, "Could not read the name registry to verify ownership."); }
    if (registryEvm && registryEvm !== evm) return err(403, "The signature's address does not own this name in the registry.");
    await kv.delete(BRIDGE_RECORD_PREFIX + name);
    return json(200, { ok: true, name });
  }

  async function handleCallback(name, amountRaw) {
    if (!isLnurlName(name)) return err(404, "Unknown Lightning address.");
    const raw = await kv.get(BRIDGE_RECORD_PREFIX + name);
    if (!raw) return err(404, "This Fluid name is not set up for payments from other wallets.");
    let record;
    try { record = JSON.parse(raw); } catch { return err(500, "Bridge record is unreadable."); }
    if (rateLimited(name)) return err(200, "Too many invoice requests — please wait a minute and try again.");
    if (typeof amountRaw !== "string" || !/^\d+$/.test(amountRaw)) return err(200, "A whole-number amount in millisatoshis is required.");
    const amountMsat = Number(amountRaw);
    if (!Number.isSafeInteger(amountMsat)) return err(200, "Amount is too large.");
    if (amountMsat < MIN_SENDABLE_MSAT) return err(200, "Amount is below the 1 satoshi minimum.");
    const cap = Math.min(Number(record.maxInvoiceMsat) || MAX_SENDABLE_MSAT, MAX_SENDABLE_MSAT);
    if (amountMsat > cap) return err(200, "Amount is above this address's per-payment limit.");
    const descriptionHashHex = lnurlMetadataSha256Hex(name);
    let invoice;
    try {
      invoice = await nwcCallImpl({
        clientPrivHex: record.clientSecret,
        walletPubHex: record.walletPub,
        relays: record.relays,
        amountMsat,
        descriptionHashHex,
        timeoutMs: callbackTimeoutMs,
      });
    } catch (e) {
      if (e && e.code === "WALLET_OFFLINE") {
        return err(200, "The recipient's Fluid wallet is not open right now, so it cannot create an invoice. Ask them to open Fluid, then try again.");
      }
      return err(200, "The recipient's wallet could not create an invoice. Ask them to open Fluid, then try again.");
    }
    // Hold the round-trip honest: the invoice must be a mainnet
    // BOLT11 for exactly the requested amount, carrying OUR
    // description hash, and unexpired. Anything else is refused
    // rather than handed to the payer.
    let parsed;
    try { parsed = parseBolt11(invoice); } catch { return err(200, "The recipient's wallet returned an unreadable invoice."); }
    if (parsed.network !== "bc") return err(200, "The recipient's wallet returned an invoice for the wrong network.");
    if (parsed.amountMsat !== amountMsat) return err(200, "The recipient's wallet returned an invoice for the wrong amount.");
    if (parsed.descriptionHashHex !== descriptionHashHex) return err(200, "The recipient's wallet returned an invoice with the wrong description hash.");
    if (parsed.expiresAt <= nowSecs() - 60) return err(200, "The recipient's wallet returned an expired invoice.");
    return json(200, { pr: invoice, routes: [] });
  }

  return { handleRegister, handleUnregister, handleCallback };
}
