// Fluid's Arkade layer — LAZY-LOADED CHUNK.
//
// app.js imports this module dynamically ONLY when the
// Lightning -> Bitcoin bridge tab opens, so the Arkade SDK
// never inflates the main bundle. The single-file build
// (dist/fluid-wallet.html) has no chunk beside it; there the
// bridge tab says so plainly and offers nothing fake.
//
// Custody: the Arkade wallet is @arkade-os/sdk's Wallet over a
// MnemonicIdentity built from the wallet's existing BIP-39
// phrase — the same seed that recovers every other Fluid
// family recovers the Arkade wallet (in any Arkade wallet,
// e.g. arkade.money). Keys never leave the device. The SDK's
// on-device repositories (IndexedDB) hold VTXO state — public
// chain state, never key material; the identity exists only in
// memory while unlocked.
//
// The operator (arkade.computer) coordinates batches and
// cosigns exits, but cannot move funds: every VTXO carries a
// pre-signed unilateral exit path, and the bridge tab states
// the model, the expiry duty and the costs before anything is
// signed (ALWAYS-WARN LAW v2, owner 2026-11-09).
//
// The VHTLC claim below is a faithful port of the reference
// client's published claim construction (@lendasat/
// lendaswap-sdk-pure 2.8.1, buildArkadeClaim /
// continueArkadeClaim / StrictVhtlcScript) onto @arkade-os/sdk
// 0.5.4 primitives — the same construction Satora's server
// funds against. Its safety does not rest on the port being
// trusted: before any claim is submitted, the locally computed
// VHTLC address must equal the address in the bounds-checked
// creation record byte-for-byte, or the claim refuses. The
// port was verified byte-exact against a live creation before
// this code shipped (see the build report).

import {
  Wallet, MnemonicIdentity, Ramps,
  RestArkProvider, RestIndexerProvider,
  buildOffchainTx, SingleKey, Transaction, CSVMultisigTapscript,
  VtxoScript, ConditionMultisigTapscript, MultisigTapscript,
  CLTVMultisigTapscript, ConditionCSVMultisigTapscript,
  Intent, setArkPsbtField, getArkPsbtFields, VtxoTaprootTree, ConditionWitness,
  ArkAddress,
} from "@arkade-os/sdk";
import { Script, SigHash } from "@scure/btc-signer";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";

/** Load marker: app.js refuses a chunk that doesn't carry it
 *  (a stale cached chunk from an older build), same discipline
 *  as the Lightning chunk's pinned-boot marker. */
export const ARKADE_CHUNK_MARKER = true;

export const ARKADE_SERVER_URL = "https://arkade.computer";
const NETWORK_HRP = "ark";

const hex = {
  decode: (s) => Uint8Array.from(Buffer.from(String(s).replace(/^0x/, ""), "hex")),
  encode: (b) => Buffer.from(b).toString("hex"),
};
const b64encode = (b) => Buffer.from(b).toString("base64");
const b64decode = (s) => Uint8Array.from(Buffer.from(s, "base64"));
function parseXOnlyPubKey(pubKeyHex) {
  const bytes = hex.decode(pubKeyHex);
  if (bytes.length === 33) return bytes.slice(1);
  if (bytes.length === 32) return bytes;
  throw new Error(`Invalid public key length: expected 32 or 33, got ${bytes.length}`);
}
const secondsToTimelock = (seconds) => ({ type: "seconds", value: BigInt(seconds) });

// ---------------------------------------------------------------------------
// StrictVhtlcScript — ported verbatim in construction from the
// reference SDK (its ARKADE_HTLC_SCRIPT_VERSION_STRICT = 1
// layout): six tapleaves — collaborative claim (preimage +
// receiver+server), collaborative refund (sender+receiver+
// server), refund without receiver after the CLTV locktime,
// and the three unilateral (CSV-delayed) counterparts.
// ---------------------------------------------------------------------------

function preimageConditionScript(preimageHash) {
  return Script.encode(["SIZE", 32, "EQUALVERIFY", "HASH160", preimageHash, "EQUAL"]);
}

export class StrictVhtlcScript extends VtxoScript {
  constructor(options) {
    if (options.preimageHash.length !== 20) throw new Error("preimage hash must be 20 bytes");
    for (const k of ["sender", "receiver", "server"]) {
      if (options[k].length !== 32) throw new Error(`Invalid public key length (${k})`);
    }
    if (options.refundLocktime <= 0n) throw new Error("refund locktime must be greater than 0");
    const conditionScript = preimageConditionScript(options.preimageHash);
    const claimScript = ConditionMultisigTapscript.encode({
      conditionScript, pubkeys: [options.receiver, options.server],
    }).script;
    const refundScript = MultisigTapscript.encode({
      pubkeys: [options.sender, options.receiver, options.server],
    }).script;
    const refundWithoutReceiverScript = CLTVMultisigTapscript.encode({
      absoluteTimelock: options.refundLocktime, pubkeys: [options.sender, options.server],
    }).script;
    const unilateralClaimScript = ConditionCSVMultisigTapscript.encode({
      conditionScript, timelock: options.unilateralClaimDelay, pubkeys: [options.receiver],
    }).script;
    const unilateralRefundScript = CSVMultisigTapscript.encode({
      timelock: options.unilateralRefundDelay, pubkeys: [options.sender, options.receiver],
    }).script;
    const unilateralRefundWithoutReceiverScript = CSVMultisigTapscript.encode({
      timelock: options.unilateralRefundWithoutReceiverDelay, pubkeys: [options.sender],
    }).script;
    super([claimScript, refundScript, refundWithoutReceiverScript,
      unilateralClaimScript, unilateralRefundScript, unilateralRefundWithoutReceiverScript]);
    this.options = options;
    this.claimScript = hex.encode(claimScript);
    this.refundScript = hex.encode(refundScript);
    this.refundWithoutReceiverScript = hex.encode(refundWithoutReceiverScript);
    this.unilateralClaimScript = hex.encode(unilateralClaimScript);
    this.unilateralRefundScript = hex.encode(unilateralRefundScript);
    this.unilateralRefundWithoutReceiverScript = hex.encode(unilateralRefundWithoutReceiverScript);
  }
  claim() { return this.findLeaf(this.claimScript); }
  refund() { return this.findLeaf(this.refundScript); }
  refundWithoutReceiver() { return this.findLeaf(this.refundWithoutReceiverScript); }
  unilateralClaim() { return this.findLeaf(this.unilateralClaimScript); }
  unilateralRefund() { return this.findLeaf(this.unilateralRefundScript); }
  unilateralRefundWithoutReceiver() { return this.findLeaf(this.unilateralRefundWithoutReceiverScript); }
}

/** Build the VHTLC script for a bounds-checked creation record
 *  plus the identity's hash lock, and the address the server
 *  must have funded. The preimage hash inside the script is
 *  ripemd160(sha256(preimage)) = ripemd160(hashLock) — the
 *  HASH160 the claim reveals the preimage against. */
export function bridgeVhtlc({ record, hashLock }) {
  const preimageHash = ripemd160(hex.decode(String(hashLock).replace(/^0x/, "")));
  const options = {
    sender: parseXOnlyPubKey(record.senderPk),
    receiver: parseXOnlyPubKey(record.receiverPk),
    server: parseXOnlyPubKey(record.serverPk),
    preimageHash,
    refundLocktime: BigInt(record.refundLocktime),
    unilateralClaimDelay: secondsToTimelock(record.unilateralClaimDelay),
    unilateralRefundDelay: secondsToTimelock(record.unilateralRefundDelay),
    unilateralRefundWithoutReceiverDelay: secondsToTimelock(record.unilateralRefundWithoutReceiverDelay),
  };
  const script = new StrictVhtlcScript(options);
  const address = script.address(NETWORK_HRP, options.server).encode();
  return { script, address, pkScriptHex: hex.encode(script.pkScript), options };
}

/** The record's claim-side keys, exactly as the claim needs
 *  them: the identity child's secret key + compressed pubkey
 *  (the receiver), and the preimage whose hash is the lock. */
function claimKeys({ secretKeyHex, claimPkHex, preimageHex, hashLockHex }) {
  const userPkBytes = parseXOnlyPubKey(claimPkHex);
  const preimageBytes = hex.decode(preimageHex);
  if (preimageBytes.length !== 32) throw new Error(`Invalid preimage length: expected 32, got ${preimageBytes.length}`);
  const expected = hex.encode(ripemd160(sha256(preimageBytes)));
  const given = hex.encode(ripemd160(hex.decode(hashLockHex)));
  if (expected !== given) throw new Error("The preimage does not match the swap's hash lock — refusing to claim.");
  return { userPkBytes, preimageBytes };
}

function ensureConditionWitness(tx, inputIndex, preimage) {
  if (getArkPsbtFields(tx, inputIndex, ConditionWitness).length > 0) return;
  setArkPsbtField(tx, inputIndex, ConditionWitness, [preimage]);
}
function attachClaimConditionWitness(arkTx, checkpoints, preimage) {
  for (let i = 0; i < arkTx.inputsLength; i++) ensureConditionWitness(arkTx, i, preimage);
  for (const checkpoint of checkpoints) {
    for (let i = 0; i < checkpoint.inputsLength; i++) ensureConditionWitness(checkpoint, i, preimage);
  }
}
const isNoPendingClaimError = (e) => e instanceof Error && e.message.startsWith("No pending transactions found at the VHTLC address");

/** Claim a funded bridge VHTLC into `destinationAddress` (the
 *  user's own Arkade address): reveal the preimage, land a
 *  plain VTXO. Faithful port of the reference claim: first try
 *  to CONTINUE a pending submitted claim (a previous attempt
 *  may have submitted without finalising — its checkpoints are
 *  fetched and finalised); only when the operator reports no
 *  pending claim does a fresh claim get built and submitted.
 *  The VHTLC address is recomputed locally and must match the
 *  record's before anything is signed or submitted. */
export async function claimBridgeVhtlc(params) {
  try {
    return await continueBridgeClaim(params);
  } catch (e) {
    if (!isNoPendingClaimError(e)) throw e;
  }
  return freshBridgeClaim(params);
}

async function freshBridgeClaim(params) {
  const { record, destinationAddress } = params;
  const { userPkBytes, preimageBytes } = claimKeys(params);
  const { script: vhtlc, address, pkScriptHex } = bridgeVhtlc({ record, hashLock: params.hashLockHex });
  if (address !== record.vhtlcAddress)
    throw new Error(`Fluid computed a different VHTLC address (${address}) than the swap's (${record.vhtlcAddress}) — refusing to claim.`);
  const arkProvider = new RestArkProvider(ARKADE_SERVER_URL);
  const indexerProvider = new RestIndexerProvider(ARKADE_SERVER_URL);
  const serverInfo = await arkProvider.getInfo();
  const { vtxos } = await indexerProvider.getVtxos({ scripts: [pkScriptHex], spendableOnly: true });
  if (!vtxos.length) throw new Error("No spendable VTXOs found at the VHTLC address — the swap has not funded it yet.");
  const totalAmount = vtxos.reduce((acc, v) => acc + BigInt(v.value), 0n);
  if (totalAmount === 0n) throw new Error("Total VTXO amount is zero");
  const claimLeafScript = vhtlc.claim();
  const tapTree = vhtlc.encode();
  const checkpointTapscript = CSVMultisigTapscript.decode(hex.decode(serverInfo.checkpointTapscript));
  const inputs = vtxos.map((v) => ({
    txid: v.txid, vout: v.vout, value: v.value,
    tapTree, tapLeafScript: claimLeafScript, witnessData: preimageBytes,
  }));
  const destAddr = ArkAddress.decode(destinationAddress);
  const outputs = [{ script: destAddr.pkScript, amount: totalAmount }];
  const { arkTx, checkpoints } = buildOffchainTx(inputs, outputs, checkpointTapscript);
  const signer = SingleKey.fromHex(params.secretKeyHex);
  const computedPk = await signer.xOnlyPublicKey();
  if (hex.encode(userPkBytes) !== hex.encode(computedPk))
    throw new Error("The claim key does not match the swap's receiver key — refusing to sign.");
  attachClaimConditionWitness(arkTx, checkpoints, preimageBytes);
  const signedArkTx = await signer.sign(arkTx);
  const { arkTxid, signedCheckpointTxs } = await arkProvider.submitTx(
    b64encode(signedArkTx.toPSBT()),
    checkpoints.map((cp) => b64encode(cp.toPSBT())),
  );
  const finalCheckpoints = await Promise.all(signedCheckpointTxs.map(async (c) => {
    const tx = Transaction.fromPSBT(b64decode(c));
    ensureConditionWitness(tx, 0, preimageBytes);
    const signedCheckpoint = await signer.sign(tx, [0]);
    return b64encode(signedCheckpoint.toPSBT());
  }));
  await arkProvider.finalizeTx(arkTxid, finalCheckpoints);
  return { txId: arkTxid, claimAmount: totalAmount };
}

async function continueBridgeClaim(params) {
  const { record } = params;
  const { userPkBytes, preimageBytes } = claimKeys(params);
  const { script: vhtlc, address, pkScriptHex } = bridgeVhtlc({ record, hashLock: params.hashLockHex });
  if (address !== record.vhtlcAddress)
    throw new Error(`Fluid computed a different VHTLC address (${address}) than the swap's (${record.vhtlcAddress}) — refusing to claim.`);
  const arkProvider = new RestArkProvider(ARKADE_SERVER_URL);
  const indexerProvider = new RestIndexerProvider(ARKADE_SERVER_URL);
  const { vtxos } = await indexerProvider.getVtxos({ scripts: [pkScriptHex] });
  if (!vtxos.length) throw new Error("No spendable VTXOs found at the VHTLC address");
  const totalAmount = vtxos.reduce((acc, v) => acc + BigInt(v.value), 0n);
  if (totalAmount === 0n) throw new Error("Total VTXO amount is zero");
  const claimLeafScript = vhtlc.claim();
  const claimScriptByte = claimLeafScript[1];
  const tapTree = vhtlc.encode();
  const now = Math.floor(Date.now() / 1000);
  const intentMessage = { type: "get-pending-tx", expire_at: now + 120 };
  const pkScriptBytes = hex.decode(pkScriptHex);
  const intentInputs = vtxos.map((v) => ({
    txid: hex.decode(v.txid), index: v.vout,
    witnessUtxo: { script: pkScriptBytes, amount: BigInt(v.value) },
    tapLeafScript: [claimLeafScript], sighashType: SigHash.ALL,
  }));
  const intentProof = Intent.create(intentMessage, intentInputs);
  for (let i = 0; i < vtxos.length; i++) setArkPsbtField(intentProof, i + 1, VtxoTaprootTree, tapTree);
  for (let i = 0; i < vtxos.length; i++) setArkPsbtField(intentProof, i + 1, ConditionWitness, [preimageBytes]);
  const signer = SingleKey.fromHex(params.secretKeyHex);
  const computedPk = await signer.xOnlyPublicKey();
  if (hex.encode(userPkBytes) !== hex.encode(computedPk))
    throw new Error("The claim key does not match the swap's receiver key — refusing to sign.");
  const signedIntentProof = await signer.sign(intentProof);
  const pendingTxs = await arkProvider.getPendingTxs({ proof: b64encode(signedIntentProof.toPSBT()), message: intentMessage });
  if (!pendingTxs.length)
    throw new Error("No pending transactions found at the VHTLC address. The claim may have already been finalized or was never submitted.");
  let lastResult = null;
  for (const pendingTx of pendingTxs) {
    const { arkTxid, signedCheckpointTxs } = pendingTx;
    const finalCheckpoints = await Promise.all(signedCheckpointTxs.map(async (c) => {
      const checkpointTx = Transaction.fromPSBT(b64decode(c));
      checkpointTx.updateInput(0, { witnessScript: claimScriptByte });
      for (let i = 0; i < checkpointTx.inputsLength; i++) ensureConditionWitness(checkpointTx, i, preimageBytes);
      const signedCheckpoint = await signer.sign(checkpointTx, [0]);
      return b64encode(signedCheckpoint.toPSBT());
    }));
    await arkProvider.finalizeTx(arkTxid, finalCheckpoints);
    lastResult = { txId: arkTxid, claimAmount: totalAmount };
  }
  if (!lastResult) throw new Error("Failed continuing claim");
  return lastResult;
}

/** Is there a spendable VTXO at this record's VHTLC address
 *  yet? The indexer is the ground truth for claimability (the
 *  Satora status string lags it). Returns the total sats
 *  waiting, or 0. */
export async function bridgeVhtlcFundedSats(record, hashLock) {
  const { pkScriptHex } = bridgeVhtlc({ record, hashLock });
  const indexerProvider = new RestIndexerProvider(ARKADE_SERVER_URL);
  const { vtxos } = await indexerProvider.getVtxos({ scripts: [pkScriptHex], spendableOnly: true });
  return vtxos.reduce((acc, v) => acc + Number(v.value || 0), 0);
}

// ---------------------------------------------------------------------------
// Operator probe + wallet session
// ---------------------------------------------------------------------------

/** The operator's live facts, read without a wallet: the fee
 *  program (core's parseArkadeIntentFees judges it), the signer
 *  key, the dust floor. A fresh provider per call — the read is
 *  one request and nothing here is worth caching stale. */
export async function probeArkadeOperator() {
  const provider = new RestArkProvider(ARKADE_SERVER_URL);
  const info = await provider.getInfo();
  return {
    signerPubkey: String(info.signerPubkey || ""),
    fees: info.fees || null,
    dustSats: Number(info.dust || 0),
    network: String(info.network || ""),
  };
}

function normaliseVtxo(v) {
  let expirySecs = null;
  const ex = v?.expiry;
  if (ex instanceof Date) expirySecs = Math.floor(ex.getTime() / 1000);
  else if (typeof ex === "number" && ex > 0) expirySecs = ex > 1e12 ? Math.floor(ex / 1000) : Math.floor(ex);
  else if (ex && typeof ex === "object") {
    const s = Number(ex.seconds ?? ex.value ?? NaN);
    if (Number.isFinite(s) && s > 0) expirySecs = Math.floor(s);
  }
  return {
    txid: String(v?.txid || ""), vout: Number(v?.vout || 0),
    valueSats: Number(v?.value || 0), expirySecs,
    raw: v,
  };
}

/** Boot (or re-boot) the user's Arkade wallet from their Fluid
 *  phrase. Automatic settlement is DISABLED in the wallet
 *  config: nothing in Arkade moves unless the user taps it in
 *  the bridge tab — renewals and exits are explicit acts, the
 *  same discipline as every other Fluid family. */
export async function bootArkade({ phrase }) {
  const identity = MnemonicIdentity.fromMnemonic(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const wallet = await Wallet.create({
    identity,
    service: { network: "bitcoin" },
    settlementConfig: false,
  });
  const address = await wallet.getAddress();
  const session = {
    wallet,
    address,
    network: "bitcoin",
    async operatorInfo() {
      const info = await wallet.getArkadeInfo();
      return {
        signerPubkey: String(info.signerPubkey || ""),
        fees: info.fees || null,
        dustSats: Number(info.dust || 0),
        network: String(info.network || ""),
      };
    },
    async balanceSats() {
      const bal = await wallet.getBalance();
      const total = Number(bal?.total ?? bal?.available ?? 0);
      return Number.isFinite(total) ? total : 0;
    },
    async vtxos() {
      const list = await wallet.getVtxos();
      return (Array.isArray(list) ? list : []).map(normaliseVtxo);
    },
    /** Collaborative exit to a Bitcoin mainnet address via the
     *  operator's next batch. feeInfo is the operator's LIVE fee
     *  info (from operatorInfo()); the SDK computes the actual
     *  deduction from it inside the settlement — the caller
     *  re-reads the balance afterwards and reports the truth.
     *  Pass specific vtxos (the bridge's claimed ones) or omit
     *  to exit the whole Arkade balance. Returns the ark txid
     *  of the settlement; the on-chain output lands with the
     *  batch's commitment transaction. */
    async offboard({ btcAddress, feeInfo, amountSats = null, vtxos = null, onEvent = null }) {
      const ramps = new Ramps(wallet);
      const rawVtxos = vtxos ? vtxos.map((v) => v.raw || v) : undefined;
      const txid = await ramps.offboard(
        String(btcAddress),
        feeInfo,
        amountSats != null ? BigInt(Math.floor(Number(amountSats))) : undefined,
        onEvent || undefined,
        rawVtxos,
      );
      return String(txid || "");
    },
    /** Renew the given VTXOs (or all) — a settlement back to
     *  the user's own address that re-issues them with a fresh
     *  batch expiry. The renewal duty the tab surfaces. */
    async renew(vtxos = null) {
      const manager = await wallet.getVtxoManager();
      if (manager && typeof manager.renewVtxos === "function") {
        return String(await manager.renewVtxos(undefined, vtxos ? { vtxos: vtxos.map((v) => v.raw || v) } : undefined) || "");
      }
      const txid = await wallet.settle(vtxos ? { inputs: vtxos.map((v) => v.raw || v) } : undefined);
      return String(txid || "");
    },
  };
  return session;
}
