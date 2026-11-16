// Cosmos SDK chunk — the CosmJS + cosmjs-types surface wallet-core
// needs for Cosmos SENDS (signing, Injective protobuf assembly, the
// Skip registry). Split out of the boot bundle on the existing
// lightning/walletconnect/arkade lazy-chunk pattern (loading
// performance, 2026-11-16): ~1.24 MB of the 6.6 MB boot bundle was
// this family, and none of it is needed to render the unlock
// screen or read balances — Cosmos derivation is Fluid's own
// @scure stack and balance reads are plain REST. wallet-core loads
// this module on the first Cosmos send path and gates it on the
// marker below (the arkade discipline; the Lightning chunk's
// in-bundle SHA pin is Lightning-only, as it carries a WASM node).
export const COSMOS_CHUNK_MARKER = true;

export { SigningStargateClient, GasPrice, calculateFee, assertIsDeliverTxSuccess, defaultRegistryTypes } from "@cosmjs/stargate";
export { DirectSecp256k1Wallet, Registry } from "@cosmjs/proto-signing";
export {
  TxBody as CosmosTxBody, TxRaw as CosmosTxRaw, AuthInfo as CosmosAuthInfo,
  SignDoc as CosmosSignDoc, SignerInfo as CosmosSignerInfo, ModeInfo as CosmosModeInfo,
} from "cosmjs-types/cosmos/tx/v1beta1/tx";
export { MsgSend as CosmosBankMsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
export { MsgExecuteContract as WasmMsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
export { Any as ProtobufAny } from "cosmjs-types/google/protobuf/any";
export { PubKey as CosmosSecp256k1PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
export { Coin as CosmosCoin } from "cosmjs-types/cosmos/base/v1beta1/coin";
