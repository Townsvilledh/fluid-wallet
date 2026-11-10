// Fluid core tests — run: npm test
import assert from "node:assert";
import { readFileSync, statSync } from "node:fs";
import { FetchRequest, FetchResponse } from "ethers";
import { createVault, importVault, unlockVault, mtpelerinBuyUrl, mtpelerinSellUrl, MTPELERIN_FIATS, MTPELERIN_REFERRAL_CODE, formatSendIntent, dustDisplayFloor, formatDisplayAmount, formatDisplayFixed, formatDisplayUsd, NETWORKS, bitcoinAddress, rampRoutesFor, RAMP_COUNTRY_PLAN, RAMP_STATIC_LINKS, RAMP_COUNTRIES, RAMP_ADDRESS_ENTRY, LOCALCOINSWAP_URL, LOCALCOINSWAP_REFERRAL_CODE, PAYCREST_NGN_USDT_RATE_URL, parsePaycrestNgnBuyRate, fetchPaycrestNgnBuyRate, validateFluidName, normalizeFluidName, buildNameEntry, findNameForAddresses, buildNameClaimMessage, verifyNameClaim, buildSignedNameClaim, verifyNostrEventSignature, nameClaimNostrKeys, nameClaimState, NAME_STATE_COPY, NAME_CLAIM_RELAYS, splitFee, FEE_SPLIT, PLATFORM_FEE_BPS, PLATFORM_FEE_FRACTION, PLATFORM_FEE_COLLECTION_ENABLED, platformFeeOn, platformFeeApplies, platformFeePercentText, feeLegTargets, feePotReport, LIFI_INTEGRATOR, buildLifiRoutesRequest, buildLifiQuoteParams, swapFeeCollectingChain, BITCOIN_LIFI_CHAIN_ID, SWAP_FEE_COVERAGE, rankRoutes, GAME_FEE_SPLIT, splitGameFee, AGENT_POLICY_DEFAULTS, agentAddresses, buildAgentDescriptor, checkAgentPolicy, FEE_SETTLEMENT, feeSettlementDue, rankSwapRoutes, formatSwapIntent, swapRouteExecutable, swapAmountToRaw, swapRawToAmount, LIFI_NATIVE_TOKEN, looksLikePoison, gateChains, registerNetworks, providerFor, providerForFallback, getBalances, tronAddressFromKey, tronAddressFromPhrase, tronAddressToHex, tronAddressFromHex, isValidTronAddress, tronSunToTrx, tronTrxToSun, formatTronSendIntent, TRON_TOKENS, TRON_LIFI_CHAIN_ID, TRON_SWAP_NATIVE_TOKEN, swapChainOf, deriveSlip10Ed25519, solanaSeedFromSeed, solanaAddressFromSeed, solanaAddressFromPhrase, isValidSolanaAddress, solLamportsToSol, solSolToLamports, solanaAtaAddress, formatSolanaSendIntent, SOLANA_TOKENS, SOLANA_LIFI_CHAIN_ID, SOLANA_SWAP_NATIVE_TOKEN, SOLANA_RENT_EXEMPT_LAMPORTS, SOLANA_ATA_RENT_LAMPORTS, solanaSwapSteps, litecoinAddress, isValidLitecoinAddress, formatLitecoinSendIntent, dogecoinAddress, isValidDogeAddress, DOGE_MIN_OUTPUT, buildSignedDogeTx, formatDogeSendIntent, DOGE_DUST_KOINU, dogeTxSize, bitcoinCashAddress, bitcoinCashLegacyAddress, bchAddressToScript, bchSighashDigest, buildSignedBchTx, isValidBchAddress, RECEIVE_NETWORKS, receiveNetworkMatches, filterReceiveNetworks, escapeHtml, sanitizePersistedSymbol, historyTxUrl, formatHistoryEntry, formatApprovalRow, formatRevokePrompt, stacksAddressFromPhrase, stacksAddressDecode, stacksAddressEncode, isValidStacksAddress, isValidStacksContractAddress, stxMicroToStx, stxToMicro, stacksAmountToRaw, stacksRawToAmount, buildSignedStacksTx, formatStacksSendIntent, parseStacksCallReadValue, stacksExplorerTxUrl, STACKS_TOKENS, STACKS_MAX_FEE_USTX, STACKS_MAX_FEE_RATE_USTX_PER_BYTE, getSwapRoutes, getLifiSwapRoutes, buildRelayQuoteRequest, relayChainOf, relaySupportsPair, parseRelayQuote, relayExecutableSteps, checkRelayStepBounds, RELAY_APP_FEE_RECIPIENT, RELAY_SOLANA_CHAIN_ID, RELAY_TRON_CHAIN_ID, PLATFORM_FEE_ROUTE_MULTIPLIER, PLATFORM_FEE_ROUTE_MULTIPLIER_EVM, PLATFORM_FEE_TOTAL_CEILINGS_USD, platformFeeEcosystemOf, platformFeeMultiplierFor, platformFeeCeilingFor, platformFeeUsdForRoute, platformFeeBpsForRoute, lifiRouteFeeUsd, swapRouteCostLabel, fetchStableTokens, scanEvmTokenBalances, relayCurrencyFor, NATIVE_ASSET_PREDEPLOY, NATIVE_ASSET_PREDEPLOY_DECIMALS, scaleRawAmount, LIFI_API_NATIVE_SENTINEL, isNativePredeploy } from "../src/wallet-core.js";
import { parseAcrossQuote, acrossSupportsPair, buildAcrossQuoteParams, checkAcrossDepositBounds, acrossExecutableSteps, acrossQuoteArgs, ACROSS_HANDLERS, ACROSS_MESSAGE_ADAPTERS, ACROSS_APP_FEE_RECIPIENT, ACROSS_CHAIN_IDS, ACROSS_SPOKE_POOLS } from "../src/wallet-core.js";
import { SATORA_DEVELOPER_KEY, SATORA_MIN_NET_SATS, satoraDeveloperKeyLive, satoraFeeConfig, satoraSupportsPair, parseSatoraQuote, getSatoraSwapRoute, resetSatoraCaches, satoraSwapIdentity, satoraClaimKey, classifySatoraLightningDestination, checkSatoraLightningReceivability, buildSatoraBtcCreateRequest, buildSatoraLnCreateRequest, checkSatoraCreateResponse, createSatoraSwap, fetchSatoraFundingComponents, satoraCallsHash, checkSatoraFundingComponents, satoraSwapPhase, satoraSwapHistoryLine, loadSatoraSwapRecords, saveSatoraSwapRecord, nextSatoraSwapIndex, pollSatoraSwapStatuses, formatSatoraSwapIntent, executeSatoraSwapRoute, encodeBolt11, bitcoinTaprootAddress } from "../src/wallet-core.js";
import { SATORA_PERMIT2_TYPE_STRING, SATORA_WITNESS_TYPE_STRING, SATORA_WITNESS_TYPEHASH, SATORA_FUNDING_DEADLINE_SECS, SATORA_HTLC_ERC20_REFUND_SELECTOR, satoraPermitRefundAddress, satoraRandomPermitNonce, buildSatoraPermitTypedData, buildSatoraEip2612Permit, buildSatoraFundGaslessBody, submitSatoraFundGasless, buildSatoraUnilateralRefundCall } from "../src/wallet-core.js";
import { SATORA_BRIDGE_SOURCES, SATORA_CCTP_TOKEN_MESSENGER_V2, SATORA_CCTP_MESSAGE_TRANSMITTER_V2, parseIrisCctpFee, computeSatoraCctpMaxFee, fetchSatoraCctpAttestation, checkSatoraCctpMessage, buildSatoraCctpEvmBurn, checkSatoraCctpEvmBurn, buildSatoraCctpReceiveMessageCall, satoraCctpSolanaPdas, buildSatoraSolanaBurnInstruction, buildSatoraSolanaCctpBurn, checkSatoraSolanaCctpBurn, satoraFundingAmount, resumeSatoraBridgedSwaps } from "../src/wallet-core.js";
import { JUPITER_AGGREGATOR_PROGRAM, JUPITER_FEE_WALLET, JUPITER_WRAPPED_SOL_MINT, jupiterMintOf, jupiterSupportsPair, buildJupiterBuildParams, parseJupiterBuild, checkJupiterSwapBounds, jupiterFeeAccountFor, resetJupiterCaches, getJupiterSwapRoute, executeJupiterSwapRoute } from "../src/wallet-core.js";
import { lnReceivePlan, lnLsps2OpeningFeeMsat, lnScidToDecimal, parseLnPeerBook, serializeLnPeerBook, upsertLnPeer, removeLnPeer, lnPeerConnState, waitForLnPeerConnected, lnNodeStatus, lnLightningAddressState } from "../src/wallet-core.js";
import { satoraSwapClaimKey, parseLnArkadePair, estimateLnArkadeFeeSats, buildLnArkadeCreateRequest, checkLnArkadeCreateResponse, parseLnArkadeCreation, parseArkadeIntentFees, arkadeOffboardFeeSats, composeBridgeQuote, formatBridgeQuoteLines, loadBridgeRecords, saveBridgeRecord, bridgeCreationIndex, bumpBridgeCreationIndex, bridgePhaseLabel, bridgeHistoryLine, BRIDGE_ROUTE_COST_CAP_SATS } from "../src/wallet-core.js";
import { fetchPinnedAsset, LnAssetError, sha256Hex } from "../src/ln-download.js";
import { MAYAN_SDK_VERSION, MAYAN_FORWARDER, MAYAN_REFERRER_SOLANA, MAYAN_REFERRER_EVM, MAYAN_SWAPS_STORAGE_KEY, mayanChainNameOf, mayanTokenOf, mayanSupportsPair, buildMayanQuoteBody, parseMayanQuote, getMayanSwapRoute, mayanReferrerFor, buildMayanEvmTxPayload, checkMayanEvmTxBounds, buildMayanSolanaInstructions, checkMayanSolanaSwapBounds, decodeMayanJupiterSwapArgs, mayanJupiterDestAccountIndex, computeMayanSwiftOrderHash, mayanProxyWrap, mayanProxyUnwrap, loadMayanSwapRecords, saveMayanSwapRecord, fetchMayanSwapStatus, mayanSwapPhase, mayanSwapHistoryLine, pollMayanSwapStatuses, formatMayanRefundNote } from "../src/wallet-core.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { mnemonicToSeedSync } from "@scure/bip39";
import { Keypair as SolKeypair, PublicKey as SolPublicKey } from "@solana/web3.js";
import { suiAddressFromPhrase, suiAddressFromSeed, suiSeedFromSeed, isValidSuiAddress, normalizeSuiAddress, suiMistToSui, suiSuiToMist, formatSuiSendIntent, SUI_TOKENS, SUI_COIN_TYPE, SUI_LIFI_CHAIN_ID, SUI_SWAP_NATIVE_TOKEN } from "../src/wallet-core.js";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { blake2b } from "@noble/hashes/blake2.js";
import { cosmosAddress, cosmosAddresses, cosmosChain, COSMOS_CHAINS, isValidCosmosAddress, formatCosmosSendIntent, buildInjectiveSignedTx, INJECTIVE_PUBKEY_TYPE, injectiveAddressBytes } from "../src/wallet-core.js";
import * as btcSigner from "@scure/btc-signer";
import { ethers } from "ethers";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { stellarAddressFromPhrase, stellarAddressFromSeed, stellarSeedFromSeed, isValidStellarAddress, strKeyDecodeEd25519, crc16Xmodem, xlmToStroops, stroopsToXlm, stellarMinBalanceXlm, stellarMinBalanceStroops, formatStellarSendIntent, STELLAR_USDC, STELLAR_USDC_ISSUER } from "../src/wallet-core.js";
import { Keypair as StellarKeypair, StrKey as StellarStrKey } from "@stellar/stellar-sdk/base";
import { chunkArray, parseDexScreenerPairs, lifiTokenVerified, cosmosDenomDisplay, suiCoinFallbackSymbol,
  shortAddrLabel, tronDecodeAbiString, formatTokenAmount, dexChainIdForEvmChain, SOLANA_TOKEN2022_PROGRAM,
  MULTICALL3_ADDRESS } from "../src/wallet-core.js";
import { rampRouteCostUsd, rampTier1Eligible, rampFeeQuote, formatRampSellIntent,
  PERMIT2_ADDRESS, RAMP_PERMIT_BATCH_TYPE_STRING, RAMP_PERMIT2_ABI, buildRampPermitBatch, checkRampPermitBatch,
  buildSolanaRampSplitTx, newRampFeeOrder, rampFeeOrderTransition, rampFeeRefundInstruction,
  rampFeeOrderSummary, loadRampFeeOrders, saveRampFeeOrder } from "../src/wallet-core.js";
import { SATORA_PERMIT2_ADDRESS } from "../src/wallet-core.js";
import { tonAddressFromPhrase, tonAddressFromSeed, tonSeedFromSeed, isValidTonAddress, tonNanoToTon, tonTonToNano, formatTonSendIntent, tonJettonTransferBody, TON_USDT_MASTER,
  nearAddressFromPhrase, nearAddressFromSeed, nearSeedFromSeed, isValidNearAddress, nearYoctoToNear, nearNearToYocto, nearMinExistYocto, nearTransactionBytes, nearSignedTransactionBytes, nearActionTransfer, nearActionFunctionCall, formatNearSendIntent, NEAR_TOKENS,
  algoAddressFromPhrase, algoAddressFromSeed, algoSeedFromSeed, algoAddressFromPubkey, algoAddressDecode, isValidAlgorandAddress, algoMicroToAlgo, algoAlgoToMicro, formatAlgoSendIntent, ALGO_USDC, ALGO_USDC_ASA,
  xrplAddressFromPhrase, xrplAddressFromPubkey, xrplAddressDecode, isValidXrplAddress, xrplDropsToXrp, xrplXrpToDrops, xrplCurrencyLabel, xrplSignPayment, formatXrplSendIntent, XRPL_USDC, XRPL_USDC_ISSUER,
  dotAddressFromPhrase, isValidDotAddress, dotPlanckToDot, dotDotToPlanck, formatDotSendIntent, DOT_TOKENS } from "../src/wallet-core.js";
import { aptosAddressFromPhrase, aptosAddressFromSeed, aptosSeedFromSeed, isValidAptosAddress, normalizeAptosAddress, aptosOctasToApt, aptosAptToOctas, aptosAmountToRaw, aptosBuildRawTransaction, aptosSigningMessage, aptosSignRawTransaction, aptosPublicKeyFromPhrase, formatAptosSendIntent, APTOS_TOKENS, APTOS_COIN_TYPE } from "../src/wallet-core.js";
import { toChecksumAddress } from "../src/wallet-core.js";
import { detectScanFamily, detectScanTxid, isValidBitcoinAddress, scanTargetsForName, scanTargetsForAddress, scanTarget,
  scanTxUrl, scanAddressUrl, scanChainLabel, scanChainBadge, scanChainStatusText, formatScanFeedEntry,
  normalizeBlockscoutTxs, normalizeBlockscoutTokenTransfers, normalizeEsploraTxs, normalizeAlgoIndexerTxs,
  normalizeSolanaTx, normalizeTronTxs, normalizeTronTrc20Txs, normalizeSuiTxPage, mergeScanRows,
  SCAN_EVM_NETWORKS, SCAN_BLOCKSCOUT_APIS, SCAN_TX_LIMIT } from "../src/wallet-core.js";
import { withDeadline, dotApi } from "../src/wallet-core.js";
import { WALLETCONNECT_PROJECT_ID, walletConnectConfigured, WALLETCONNECT_RELAY_URL, WC_EIP155_METHODS, parseWcUri, planWcNamespaces, describeWcProposal, buildWcNamespaces, wcSessionSummary, decodeWcRequest, signWcMessage, signWcTypedData, evmNetworkKeyForChainId, wcSupportedChainIds } from "../src/wallet-core.js";
import { sortHomeFamilies, sortHomeRows } from "../src/wallet-core.js";
import { sha3_256 as nobleSha3_256 } from "@noble/hashes/sha3.js";
import { keyPairFromSeed as tonKeyPairFromSeed } from "@ton/crypto";
import { WalletContractV4 as TonWalletV4 } from "@ton/ton";
import { contractAddress as tonContractAddress, beginCell as tonBeginCell, storeMessageRelaxed as tonStoreMessageRelaxed, internal as tonInternalMsg, Address as TonAddr } from "@ton/core";
import { derivePath as ed25519HdDerivePath } from "ed25519-hd-key";
import { KeyPair as NearKeyPair, PublicKey as NearPublicKey, createTransaction as nearCreateTx, actions as nearActions, encodeTransaction as nearEncodeTx, baseEncode as nearBaseEncode, baseDecode as nearBaseDecode } from "near-api-js";
import algosdk from "algosdk";
import { encodeAccountID as xrplCodecEncodeAccountID } from "ripple-address-codec";
import * as xrplKeypairs from "ripple-keypairs";
import { decode as xrplCodecDecode, encodeForSigning as xrplCodecEncodeForSigning } from "ripple-binary-codec";
import { sr25519PairFromSeed as dotSrPairFromSeed, encodeAddress as dotEncodeAddress, sr25519Verify as dotSrVerify } from "@polkadot/util-crypto";
import { mnemonicToEntropy as scureMnemonicToEntropy } from "@scure/bip39";
import { wordlist as bip39EnglishWordlist } from "@scure/bip39/wordlists/english.js";
import { pbkdf2 as noblePbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { sha512 as nobleSha512 } from "@noble/hashes/sha2.js";
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex } from "@cosmjs/crypto";
import { HDKey } from "@scure/bip32";
import { bech32 } from "@scure/base";

let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log("✓", name); passed++; };

// 1. Known-vector import: Hardhat's well-known test mnemonic → known address
const KNOWN_PHRASE = "test test test test test test test test test test test junk";
const known = await importVault(
  KNOWN_PHRASE, "password123");
ok("known mnemonic gives known address", known.address === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

// 2. Unlock with the right password returns the same address
const unlocked = await unlockVault(known.keystore, "password123");
ok("unlock round-trip", unlocked.address === known.address);
ok("unlocked wallet carries the same phrase", unlocked.mnemonic.phrase.startsWith("test test test"));

// 3. Wrong password is rejected (AES via keystore scrypt — loud failure, not garbage)
await assert.rejects(() => unlockVault(known.keystore, "wrongpassword"), /Wrong password/);
ok("wrong password rejected", true);

// 4. Fresh wallet creation: valid address + unlockable
const fresh = await createVault("another-password");
ok("created wallet address is valid", /^0x[0-9a-fA-F]{40}$/.test(fresh.address));
const freshUnlocked = await unlockVault(fresh.keystore, "another-password");
ok("created wallet unlocks to same address", freshUnlocked.address === fresh.address);
ok("created phrase is 12 words", fresh.phrase.split(" ").length === 12);

// 5. Invalid mnemonic is refused
await assert.rejects(() => importVault("not a real seed phrase at all no no no no no no", "password123"), /not valid BIP39/);
ok("invalid mnemonic rejected", true);

// 6. Intent is a human sentence, no hex blobs
const intent = formatSendIntent({ amount: "0.05", symbol: "BNB", to: fresh.address, networkKey: "bsc", feeNative: "0.000105" });
ok("intent is human-readable", intent.includes("Send 0.05 BNB") && intent.includes("BNB Chain") && intent.includes("Confirm?"));

// 7. Mercuryo (pulled 2026-11-08, still out: its sell settles
// only in EUR/USD/GBP to a card, never NGN to a bank) holds no
// static links. Neither does the African off-ramp provider
// removed in full 2026-11-10 — no static link survives it.
ok("Mercuryo holds no static links; the 2026-11-10 removal left none either", !("Mercuryo" in RAMP_STATIC_LINKS) && !("Fonbnk" in RAMP_STATIC_LINKS));

// 8. Registry sanity: 6 networks, unique chain IDs
const ids = Object.values(NETWORKS).map(n => n.chainId);
ok("unique chain ids", new Set(ids).size === ids.length);

console.log(`\nAll ${passed} core tests passed.`);

// 13. Bitcoin: same seed -> BIP84 address, cross-validated against bitcoinjs-lib
ok("bitcoin address vector", bitcoinAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about") === "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");

// 14. Network registry sanity: 15 networks, unique chainIds, https RPCs
{
  const keys = Object.keys(NETWORKS);
  ok("at least 14 networks", keys.length >= 14);
  const ids = new Set(keys.map(k => NETWORKS[k].chainId));
  ok("chainIds unique", ids.size === keys.length);
  ok("all rpcs https", keys.every(k => NETWORKS[k].rpc.startsWith("https://")));
}

// 15. Global ramps + onramp links (per-country, price-ranked model)
ok("static ramp links are https", Object.values(RAMP_STATIC_LINKS).every(l =>
  (l.buy === undefined || l.buy.startsWith("https://")) && (l.sell === undefined || l.sell.startsWith("https://"))));
ok("static links table holds only the capture-clean LocalCoinSwap link after the capture-gate pulls", Object.keys(RAMP_STATIC_LINKS).length === 1
  && RAMP_STATIC_LINKS["LocalCoinSwap"].buy === "https://localcoinswap.com/?rc=EC82BA22"
  && RAMP_STATIC_LINKS["LocalCoinSwap"].sell === "https://localcoinswap.com/?rc=EC82BA22"
  && LOCALCOINSWAP_REFERRAL_CODE === "EC82BA22" && LOCALCOINSWAP_URL === "https://localcoinswap.com/?rc=EC82BA22");
// Paybis and Spritz were REMOVED in full 2026-11-09 under the
// owner's capture GATE (owner ruling ~14:34 WAT): as wired they
// paid Fluid nothing and no own-charge mechanism exists for
// their hosted shapes. No static link, no plan row, no caps
// entry. §76 pins the corridor consequences.
ok("Paybis and Spritz hold no static link, plan row or caps entry",
  !("Paybis" in RAMP_STATIC_LINKS) && !("Spritz" in RAMP_STATIC_LINKS)
  && !("Paybis" in RAMP_ADDRESS_ENTRY) && !("Spritz" in RAMP_ADDRESS_ENTRY)
  && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Paybis" && n !== "Spritz")));
// Noblocks was REMOVED in full 2026-11-09 under the owner's
// capture GATE (no referral parameter exists; its hosted shape
// admits no own-charge mechanism) — mirroring the NoOnes pull:
// no static link, no plan row, no caps entry, no default note.
// §76 pins the absence end-state.
ok("removed providers stay removed", (() => {
  // Sweep every country × mode: no removed provider may appear by
  // name, URL or note — incl. the +106%-in-Nigeria provider dropped
  // in this build, Mercuryo (pulled 2026-11-08; its sell is
  // EUR/USD/GBP-to-card only, so there is no completable NG sell
  // to restore), NoOnes, removed 2026-11-09 as a dead platform
  // (winding-down announced 17 Aug 2026, P2P closed 21 Aug 2026),
  // Noblocks, removed 2026-11-09 under the owner's capture
  // GATE (no referral parameter; no own-charge mechanism exists
  // for its hosted shape), Paybis + Spritz, removed 2026-11-09
  // under the same gate (owner ruling ~14:34 WAT — Affise link
  // stuck on moderation; referral unlock gated behind owner-KYC
  // activity), and the African off-ramp provider, restored for
  // one day (2026-11-09) and then REMOVED IN FULL 2026-11-10 on
  // the owner's direct order — none of them may appear ANYWHERE,
  // in no corridor, in no mode. §74/§76 pin the absence.
  const banned = /guardarian|moonpay|transak|ramp\.network|paychant|mercuryo|noones|noblocks|paybis|spritz|fonbnk/i;
  return RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const { routes } = rampRoutesFor(c.code, m, "bsc", "USDC");
    return routes.every(r => !banned.test(r.name) && !banned.test(r.url || "") && !banned.test(r.note));
  }));
})());
// Mercuryo appears in no corridor plan and holds no
// address-entry entry. Neither does the African off-ramp
// provider removed in full 2026-11-10: no plan row, no
// address-entry entry survives it.
ok("Mercuryo appears in no corridor plan; the 2026-11-10 removal left no plan row either", RAMP_COUNTRIES.every(c =>
  RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Mercuryo" && n !== "Fonbnk")));
ok("Mercuryo holds no address-entry entry; neither does the removed provider", !("Mercuryo" in RAMP_ADDRESS_ENTRY)
  && !("Fonbnk" in RAMP_ADDRESS_ENTRY));
// Removed 2026-11-09 (dead platform — winding-down, P2P closed):
// NoOnes holds no static link, no plan row and no caps entry.
ok("NoOnes holds no static link, plan row or caps entry", !("NoOnes" in RAMP_STATIC_LINKS)
  && !("NoOnes" in RAMP_ADDRESS_ENTRY)
  && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "NoOnes")));
// Removed in full 2026-11-09 under the owner's capture GATE:
// Noblocks holds no static link, no plan row and no caps entry.
ok("Noblocks holds no static link, plan row or caps entry", !("Noblocks" in RAMP_STATIC_LINKS)
  && !("Noblocks" in RAMP_ADDRESS_ENTRY)
  && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Noblocks")));
ok("ramp assembly carries no pulled-provider flags", (() => { const r = rampRoutesFor("NG", "sell", "bsc", "USDC");
  return !("fonbnkBuyBlocked" in r) && !("fonbnkNetworkMissing" in r); })());

// 16. Local-currency rails: country table
ok("ramp countries include NG+US", RAMP_COUNTRIES.some(c => c.code === "NG") && RAMP_COUNTRIES.some(c => c.code === "US"));
ok("ramp countries carry fiats", RAMP_COUNTRIES.every(c => typeof c.fiat === "string" && c.fiat.length >= 3)
  && RAMP_COUNTRIES.find(c => c.code === "NG").fiat === "NGN" && RAMP_COUNTRIES.find(c => c.code === "ZA").fiat === "ZAR");

// 16b. Mt Pelerin: param-prefilled links, 18-fiat gate
ok("mtpelerin fiat table has 18", MTPELERIN_FIATS.length === 18 && MTPELERIN_FIATS.includes("ZAR") && !MTPELERIN_FIATS.includes("NGN"));
ok("mtpelerin buy USDT/EUR", mtpelerinBuyUrl("USDT", "EUR") === "https://www.mtpelerin.com/buy-tether-usdt?bsc=EUR&bdc=USDT&rfr=Fp3dGFX3");
ok("mtpelerin sell USDT/ZAR", mtpelerinSellUrl("USDT", "ZAR") === "https://www.mtpelerin.com/sell-tether-usdt?ssc=USDT&sdc=ZAR&rfr=Fp3dGFX3");
ok("mtpelerin buy USDC/USD", mtpelerinBuyUrl("USDC", "USD") === "https://www.mtpelerin.com/buy-usdc?bsc=USD&bdc=USDC&rfr=Fp3dGFX3");
ok("mtpelerin sell USDC/GBP", mtpelerinSellUrl("USDC", "GBP") === "https://www.mtpelerin.com/sell-usdc?ssc=USDC&sdc=GBP&rfr=Fp3dGFX3");
ok("mtpelerin referral code rides every link", MTPELERIN_REFERRAL_CODE === "Fp3dGFX3" && mtpelerinBuyUrl("USDT", "EUR").includes("rfr=Fp3dGFX3") && mtpelerinSellUrl("USDC", "ZAR").includes("rfr=Fp3dGFX3"));
ok("mtpelerin null for unsupported fiat", mtpelerinBuyUrl("USDT", "NGN") === null && mtpelerinSellUrl("USDC", "KES") === null);
ok("mtpelerin null for unknown asset", mtpelerinBuyUrl("BTC", "EUR") === null);

// 16b2. NG live benchmark: Paycrest as a price SOURCE only (research
// 7 Nov 2026 — Paycrest is not a route: its consumer face is
// BVN-walled, order creation KYB-gated). The NG + KE sheets show
// the live market rate as a benchmark line; every failure mode must
// read as "no benchmark", never a stale or wrong figure, and no
// rate is ever hardcoded or cached. Since 2026-11-09 the DISPLAYED
// figure is the aggregator's MARKET rate (/v1/currencies'
// marketBuyRate/marketSellRate); the provider quote below is only
// a one-sided sanity witness — that day the NGN quote sat at
// ~₦683 (half the ₦1,378 market) for hours while the market
// fields stayed true, and the quote must never wear the "market"
// label nor suppress the true figure.
{
  ok("paycrest endpoint is the measured keyless rates URL", PAYCREST_NGN_USDT_RATE_URL === "https://api.paycrest.io/v2/rates/base/USDT/50/NGN");
  ok("paycrest parse reads the buy rate", parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: "1384.52" }, sell: { rate: "1369.35" } } }) === 1384.52
    && parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: 1400 } } }) === 1400);
  ok("paycrest parse rejects junk payloads", [null, undefined, 42, {}, { status: "error", data: { buy: { rate: "1400" } } },
    { status: "success" }, { status: "success", data: {} }, { status: "success", data: { buy: {} } },
    { status: "success", data: { buy: { rate: "abc" } } }, { status: "success", data: { buy: { rate: "" } } }]
    .every(x => parsePaycrestNgnBuyRate(x) === null));
  ok("paycrest sanity band ₦500–₦5,000 rejects absurd rates", parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: "499.99" } } }) === null
    && parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: "5000.01" } } }) === null
    && parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: "500" } } }) === 500
    && parsePaycrestNgnBuyRate({ status: "success", data: { buy: { rate: "5000" } } }) === 5000);
  const realFetch = globalThis.fetch;
  const CURR_OK = { status: "success", data: [
    { code: "NGN", marketBuyRate: "1384.52", marketSellRate: "1369.35" },
    { code: "KES", marketBuyRate: "130", marketSellRate: "129.85" } ] };
  const mockBench = (curr, rates) => async (url) => {
    if (String(url).includes("/v1/currencies")) {
      if (curr === "throw") throw new Error("offline");
      if (curr === "bad") return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, json: async () => curr };
    }
    if (rates === "throw") throw new Error("offline");
    if (rates === "bad") return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => rates };
  };
  try {
    globalThis.fetch = mockBench(CURR_OK, { status: "success", data: { buy: { rate: "1401.25" }, sell: { rate: "1390" } } });
    ok("paycrest fetch resolves the live MARKET rate", await fetchPaycrestNgnBuyRate() === 1384.52);
    globalThis.fetch = mockBench("bad", { status: "success", data: { buy: { rate: "1401.25" } } });
    ok("paycrest fetch: market payload non-200 → no benchmark", await fetchPaycrestNgnBuyRate() === null);
    globalThis.fetch = mockBench("throw", { status: "success", data: { buy: { rate: "1401.25" } } });
    ok("paycrest fetch: market payload unreachable → no benchmark", await fetchPaycrestNgnBuyRate() === null);
    globalThis.fetch = async (url) => String(url).includes("/v1/currencies")
      ? { ok: true, json: async () => { throw new Error("not json"); } }
      : { ok: true, json: async () => ({ status: "success", data: { buy: { rate: "1401.25" } } }) };
    ok("paycrest fetch: unparseable market body → no benchmark", await fetchPaycrestNgnBuyRate() === null);
    globalThis.fetch = mockBench({ status: "success", data: [{ code: "NGN", marketBuyRate: "99999", marketSellRate: "99998" }] },
      { status: "success", data: { buy: { rate: "99999" } } });
    ok("paycrest fetch: out-of-band market rate → no benchmark", await fetchPaycrestNgnBuyRate() === null);
    globalThis.fetch = mockBench(CURR_OK, "throw");
    ok("paycrest fetch: quote feed down, market healthy → market figure still shows", await fetchPaycrestNgnBuyRate() === 1384.52);
  } finally { globalThis.fetch = realFetch; }
  const appSrcB = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrcB = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("benchmark line renders from the parsed number (NG buy+sell F9, KE F10)", appSrcB.includes('id="rBench"')
    && appSrcB.includes("fetchPaycrestRate") && appSrcB.includes("Market rate now:")
    && appSrcB.includes("Market sell rate now:") && appSrcB.includes("per $1 (live)")
    && appSrcB.includes('NG: { fiat: "NGN"') && appSrcB.includes('KE: { fiat: "KES"'));
  ok("no hardcoded rate figure in the app shell", !appSrcB.includes("1384") && !appSrcB.includes("1,385"));
  ok("CSP untouched: connect-src https: already covers the rates API", idxSrcB.includes("connect-src 'self' https: wss:")
    && !idxSrcB.includes("paycrest") && !appSrcB.includes("api.paycrest.io"));
}

// 16c. Per-country ramp assembly: ranked on MEASURED price (6 Nov 2026)
{
  const names = (code, mode = "buy") => rampRoutesFor(code, mode, "bsc", "USDC").routes.map(r => r.name);
  const badged = (code, mode = "buy") => rampRoutesFor(code, mode, "bsc", "USDC").routes.filter(r => r.badge).map(r => r.name);

  // Nigeria (updated 2026-11-10, full removal): BUY stays
  // honestly empty — its last route (NoOnes) was removed as a
  // dead platform (winding-down announced 17 Aug 2026, P2P
  // trading closed permanently 21 Aug 2026, withdrawal-only
  // since 22 Aug 2026). SELL's last row — the African off-ramp
  // provider restored 2026-11-09 — was REMOVED IN FULL
  // 2026-11-10 on the owner's direct order, so NG sell resolves
  // to the same honest empty state. §73/§74 pin the absence.
  ok("NG lineup is honestly empty on both sides after the 2026-11-10 removal", JSON.stringify(names("NG")) === JSON.stringify([])
    && JSON.stringify(names("NG", "sell")) === JSON.stringify([]));
  ok("NG buy resolves to the empty state", rampRoutesFor("NG", "buy", "bsc", "USDC").routes.length === 0
    && rampRoutesFor("NG", "buy", "linea", "USDT").routes.length === 0);
  ok("NG sell is empty on supported and unsupported networks alike", ["bsc", "base", "ethereum", "arbitrum", "polygon", "linea"].every(k =>
    rampRoutesFor("NG", "sell", k, "USDT").routes.length === 0));
  ok("NG has no badges", badged("NG").length === 0 && badged("NG", "sell").length === 0);
  ok("NG has no routes at all", names("NG").length === 0 && names("NG", "sell").length === 0);
  // The empty state is an app-side render of routes.length === 0
  // (the pattern built 2026-11-07 for zero-route combos): pin both
  // the explainer's presence in the sheet and the absence of ANY
  // provider name from the app source (route names live in
  // wallet-core; the sheet renders them generically).
  const appSrcR = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("app sheet renders the honest empty state for zero-route combos", appSrcR.includes("routes.length === 0")
    && appSrcR.includes("passes Fluid's bar right now"));
  ok("app source names no ramp provider anywhere", !/fonbnk|mercuryo|noones|noblocks/i.test(appSrcR));
  ok("NG buy is empty on every network and asset", ["bsc", "base", "linea"].every(k =>
    rampRoutesFor("NG", "buy", k, "USDT").routes.length === 0));

  // The address-entry capability table is the standing buy gate:
  // every listed buy route anywhere takes a pasted address. A
  // future provider added to a plan without a caps entry — or
  // flipped to "walletconnect" — fails here instead of silently
  // reaching a buy sheet.
  ok("address-entry caps are recorded truthfully", RAMP_ADDRESS_ENTRY["Mt Pelerin"] === "paste"
    && !("Fonbnk" in RAMP_ADDRESS_ENTRY) && !("Mercuryo" in RAMP_ADDRESS_ENTRY) && !("NoOnes" in RAMP_ADDRESS_ENTRY)
    && !("Paybis" in RAMP_ADDRESS_ENTRY) && !("Spritz" in RAMP_ADDRESS_ENTRY) && !("Noblocks" in RAMP_ADDRESS_ENTRY));
  ok("every planned provider has a caps entry", RAMP_COUNTRIES.every(c =>
    RAMP_COUNTRY_PLAN[c.code].every(([n]) => typeof RAMP_ADDRESS_ENTRY[n] === "string")));
  ok("no WalletConnect-only route on any buy sheet", RAMP_COUNTRIES.every(c =>
    rampRoutesFor(c.code, "buy", "bsc", "USDC").routes.every(r => r.addressEntry === "paste")));
  ok("Mercuryo surfaces in no corridor or mode; the removed provider appears nowhere", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
    rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => r.name !== "Mercuryo" && r.name !== "Fonbnk"))));
  ok("NoOnes appears in no assembled route for any corridor", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
    rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => r.name !== "NoOnes"
      && !/noones/i.test(r.name) && !/noones/i.test(r.url || "") && !/noones/i.test(r.note)))));
  ok("removed US providers appear in no lineup", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const ns = rampRoutesFor(c.code, m, "bsc", "USDC").routes.map(r => r.name);
    return !ns.includes("Paybis") && !ns.includes("Spritz");
  })));

  // Kenya: both sides honestly empty after the 2026-11-10
  // removal (its only sell row was scrapped; Mercuryo stays
  // out everywhere). Ghana: BUY still honestly empty (live
  // book +1% to +54% over market fails the price bar), SELL
  // carries the labelled LocalCoinSwap external-marketplace
  // row since 2026-11-10 (fresh live book check: 10 offers,
  // −1% to −6% vs market, MTN MoMo, minimums from GH₵100;
  // capture = ambassador referral rc=EC82BA22, 10% of
  // platform fees in BTC — the sanctioned exception shape).
  ok("KE lineup is honestly empty on both sides after the 2026-11-10 removal", JSON.stringify(names("KE")) === JSON.stringify([])
    && JSON.stringify(names("KE", "sell")) === JSON.stringify([]));
  ok("GH buy stays honestly empty; GH sell is the LocalCoinSwap row alone", JSON.stringify(names("GH")) === JSON.stringify([])
    && JSON.stringify(names("GH", "sell")) === JSON.stringify(["LocalCoinSwap"]));
  ok("GH sell row is a labelled external link-out carrying the referral, never an in-Fluid trade", (() => {
    const r = rampRoutesFor("GH", "sell", "bsc", "USDT").routes[0];
    return r.external === true && r.badge === false && r.unavailable === false
      && r.url === "https://localcoinswap.com/?rc=EC82BA22"
      && r.note.includes("not inside Fluid") && r.note.includes("MTN MoMo") && r.note.includes("GH₵100");
  })());
  ok("LocalCoinSwap surfaces nowhere else: no other corridor, no buy sheet", RAMP_COUNTRIES.every(c =>
    ["buy", "sell"].every(m => c.code === "GH" && m === "sell"
      || rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => r.name !== "LocalCoinSwap"))));
  // Russia was live-checked 2026-11-10 and refused: the
  // platform's Terms of Service list the Russian Federation
  // as a restricted jurisdiction, its Russia sell book has
  // zero RUB offers and its buy book is +56%/+63%. No RU
  // country exists in the picker and no row may promise one.
  ok("RU is not a ramp country (LocalCoinSwap bans RU residents; no RUB book passes)", !RAMP_COUNTRIES.some(c => c.code === "RU")
    && !("RU" in RAMP_COUNTRY_PLAN));
  // The six corridors whose only route was the scrapped sell
  // row: both sides honestly empty now.
  ok("scrapped corridors: buy and sell both honestly empty", ["UG", "TZ", "CM", "SN", "CI", "ZM"].every(code =>
    rampRoutesFor(code, "buy", "bsc", "USDC").routes.length === 0
    && rampRoutesFor(code, "sell", "bsc", "USDC").routes.length === 0));

  // South Africa: Mt Pelerin alone on both sides after the
  // 2026-11-10 removal; under the global badge rule (audit
  // P0-4) its badge is BUY-only — the sell side fails the
  // small-ticket test at CHF 50.
  ok("ZA lineup", JSON.stringify(names("ZA")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(names("ZA", "sell")) === JSON.stringify(["Mt Pelerin"]));
  ok("ZA badges Mt Pelerin on buy only", JSON.stringify(badged("ZA")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged("ZA", "sell")) === JSON.stringify([]));

  // Corridor extensions (global ramp scout, 2026-11-09): the
  // existing Mt Pelerin referral preset extended to the rest of
  // the EEA beyond DE, plus CA (CAD), PL (PLN), AU (AUD) and SG
  // (SGD — verified on Mt Pelerin's own pricing page: SGD is in
  // the bank-transfer buy AND sell currency lists, and Singapore
  // is absent from its published exclusion list). Every new
  // corridor is Mt Pelerin only on both modes; the badge is
  // BUY-only under the global badge rule (audit P0-4: the sell
  // side fails the small-ticket test at CHF 50), and every link
  // carries the referral code with its preset fiat.
  const MTP_EXT_EUR = ["AT", "BE", "BG", "CY", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IS", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "RO", "SI", "SK"];
  const MTP_EXT_OWN = { CZ: "CZK", DK: "DKK", HU: "HUF", LI: "CHF", NO: "NOK", PL: "PLN", SE: "SEK", CA: "CAD", AU: "AUD", SG: "SGD" };
  const MTP_EXT_ALL = [...MTP_EXT_EUR, ...Object.keys(MTP_EXT_OWN)];
  ok("extensions: 32 corridors of 2026-11-09 + batch 2 of 2026-11-10 take the picker to 54 countries", RAMP_COUNTRIES.length === 54
    && MTP_EXT_ALL.length === 32 && MTP_EXT_ALL.every(code => RAMP_COUNTRIES.some(c => c.code === code)));
  ok("extensions: every new corridor is Mt Pelerin only, badge buy-only", MTP_EXT_ALL.every(code =>
    JSON.stringify(names(code)) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(names(code, "sell")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged(code)) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged(code, "sell")) === JSON.stringify([])));
  ok("extensions: every new-corridor link carries the referral + its preset fiat", MTP_EXT_ALL.every(code => {
    const fiat = MTP_EXT_OWN[code] || "EUR";
    const r = rampRoutesFor(code, "buy", "bsc", "USDC");
    const buy = r.routes[0], sell = rampRoutesFor(code, "sell", "bsc", "USDC").routes[0];
    return buy.url.includes(`bsc=${fiat}&`) && buy.url.includes("rfr=Fp3dGFX3")
      && sell.url.includes(`sdc=${fiat}`) && sell.url.includes("rfr=Fp3dGFX3")
      && r.mtpUnavailable === false;
  }));
  ok("extensions: exact preset URLs (CA buy, PL sell, AU buy, SG buy, FR buy)",
    rampRoutesFor("CA", "buy", "bsc", "USDC").routes[0].url === "https://www.mtpelerin.com/buy-usdc?bsc=CAD&bdc=USDC&rfr=Fp3dGFX3"
    && rampRoutesFor("PL", "sell", "bsc", "USDT").routes[0].url === "https://www.mtpelerin.com/sell-tether-usdt?ssc=USDT&sdc=PLN&rfr=Fp3dGFX3"
    && rampRoutesFor("AU", "buy", "bsc", "USDT").routes[0].url === "https://www.mtpelerin.com/buy-tether-usdt?bsc=AUD&bdc=USDT&rfr=Fp3dGFX3"
    && rampRoutesFor("SG", "buy", "bsc", "USDC").routes[0].url === "https://www.mtpelerin.com/buy-usdc?bsc=SGD&bdc=USDC&rfr=Fp3dGFX3"
    && rampRoutesFor("FR", "buy", "bsc", "USDC").routes[0].url === "https://www.mtpelerin.com/buy-usdc?bsc=EUR&bdc=USDC&rfr=Fp3dGFX3");
  // Corridor extensions batch 2 (global ramp coverage matrix,
  // 2026-11-10): CH, JP, HK, NZ join on the same Mt Pelerin
  // referral preset, re-verified on the provider's own pricing
  // page the same day (CHF/JPY/HKD/NZD in the bank-transfer buy
  // AND sell lists; min buy CHF 1, min sell CHF 50; none of the
  // four on the published exclusion list, Hong Kong expressly
  // accepted). CH is the provider's home market (SIC transfers
  // free) so — like LI on the same CHF preset — it carries NO
  // SWIFT line; JP/HK/NZ ride SWIFT on buys and carry the
  // P1-12 addendum, buy-side only.
  const MTP_EXT2 = { CH: "CHF", JP: "JPY", HK: "HKD", NZ: "NZD" };
  ok("extensions batch 2: CH/JP/HK/NZ are in the picker with their fiats", Object.entries(MTP_EXT2).every(([code, fiat]) =>
    RAMP_COUNTRIES.some(c => c.code === code && c.fiat === fiat)));
  ok("extensions batch 2: every corridor is Mt Pelerin only, badge buy-only", Object.keys(MTP_EXT2).every(code =>
    JSON.stringify(names(code)) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(names(code, "sell")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged(code)) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged(code, "sell")) === JSON.stringify([])));
  ok("extensions batch 2: every link carries the referral + its preset fiat", Object.entries(MTP_EXT2).every(([code, fiat]) => {
    const r = rampRoutesFor(code, "buy", "bsc", "USDC");
    const buy = r.routes[0], sell = rampRoutesFor(code, "sell", "bsc", "USDC").routes[0];
    return buy.url.includes(`bsc=${fiat}&`) && buy.url.includes("rfr=Fp3dGFX3")
      && sell.url.includes(`sdc=${fiat}`) && sell.url.includes("rfr=Fp3dGFX3")
      && r.mtpUnavailable === false;
  }));
  ok("extensions batch 2: exact preset URLs (CH buy, JP sell, HK buy, NZ buy)",
    rampRoutesFor("CH", "buy", "bsc", "USDC").routes[0].url === "https://www.mtpelerin.com/buy-usdc?bsc=CHF&bdc=USDC&rfr=Fp3dGFX3"
    && rampRoutesFor("JP", "sell", "bsc", "USDT").routes[0].url === "https://www.mtpelerin.com/sell-tether-usdt?ssc=USDT&sdc=JPY&rfr=Fp3dGFX3"
    && rampRoutesFor("HK", "buy", "bsc", "USDT").routes[0].url === "https://www.mtpelerin.com/buy-tether-usdt?bsc=HKD&bdc=USDT&rfr=Fp3dGFX3"
    && rampRoutesFor("NZ", "buy", "bsc", "USDC").routes[0].url === "https://www.mtpelerin.com/buy-usdc?bsc=NZD&bdc=USDC&rfr=Fp3dGFX3");
  ok("extensions batch 2: SWIFT line on JP/HK/NZ buys only; CH carries none (SIC is free)", (() => {
    const n = (code, mode) => (rampRoutesFor(code, mode, "bsc", "USDC").routes[0] || {}).note || "";
    return ["JP", "HK", "NZ"].every(code => n(code, "buy").includes("SWIFT") && !n(code, "sell").includes("SWIFT"))
      && !n("CH", "buy").includes("SWIFT") && !n("CH", "sell").includes("SWIFT");
  })());

  // Honest labels: no corridor's assembled route (name, URL or
  // note) — and neither app shell source — may claim the domestic
  // instant-payment rails that belong to providers failing the
  // bar (the CA/PL/AU rows must not promise them, ever). Word
  // boundaries keep ordinary words (e.g. "interaction") out.
  const appSrcX = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrcX = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("extensions: no domestic instant-rail claims anywhere user-facing", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
    rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !/\binterac\b|\bblik\b|\bpayid\b/i.test(`${r.name} ${r.url || ""} ${r.note}`))))
    && !/\binterac\b|\bblik\b|\bpayid\b/i.test(appSrcX) && !/\binterac\b|\bblik\b|\bpayid\b/i.test(idxSrcX));

  // US: the corridor's two paying-nothing routes were removed
  // under the capture gate (2026-11-09, owner ruling ~14:34).
  // What remains is the flagged Mt Pelerin row (it excludes US
  // persons) — non-navigating, unbadged, on both sides; the sheet
  // otherwise resolves to the honest empty state.
  ok("US lineup is the flagged Mt Pelerin row only, no badge", JSON.stringify(names("US")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged("US")) === JSON.stringify([])
    && JSON.stringify(names("US", "sell")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged("US", "sell")) === JSON.stringify([]));
  ok("US Mt Pelerin flags non-US", (() => { const us = rampRoutesFor("US", "buy", "bsc", "USDC").routes;
    return us[0].unavailable === true && us[0].url === null && us[0].note.includes("Not available to US residents"); })());

  // IN, BR, PH, ID: their only route was removed under the
  // capture gate — both sides resolve to the honest empty state.
  ok("IN/BR/PH/ID resolve honestly empty on both sides", ["IN", "BR", "PH", "ID"].every(code =>
    rampRoutesFor(code, "buy", "bsc", "USDC").routes.length === 0
    && rampRoutesFor(code, "sell", "bsc", "USDC").routes.length === 0));

  // Global invariants over all countries × buy/sell: at most one
  // badge per sheet, a badge only ever sits on the first route, and
  // every NAVIGATING route's URL is https (a route flagged
  // unavailable — QA F8 — carries url null instead and must say why
  // in its note). A plan entry may be EMPTY (the corridors left
  // routeless by the 2026-11-08 pull): zero routes is a valid
  // assembly — the sheet renders its honest empty state for it.
  ok("plan covers all ramp countries", RAMP_COUNTRIES.every(c => Array.isArray(RAMP_COUNTRY_PLAN[c.code])));
  ok("badge invariants hold everywhere", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const { routes } = rampRoutesFor(c.code, m, "bsc", "USDT");
    const b = routes.filter(r => r.badge);
    return b.length <= 1 && (b.length === 0 || routes[0].badge === true)
      && routes.every(r => r.unavailable ? (r.url === null && r.note.length > 0) : r.url.startsWith("https://"));
  })));
  // QA F8: Mt Pelerin in the US corridor is labelled unavailable —
  // it must reach the sheet as a non-navigating row (no URL) with
  // its note intact, on both sides; everywhere else it navigates.
  ok("F8: US Mt Pelerin is a non-navigating unavailable row", ["buy", "sell"].every(m => {
    const r = rampRoutesFor("US", m, "bsc", "USDC").routes.find(x => x.name === "Mt Pelerin");
    return r && r.unavailable === true && r.url === null && r.note.includes("Not available to US residents");
  }));
  ok("F8: no other corridor's Mt Pelerin is unavailable", ["ZA", "GB", "DE", "MX"].every(code =>
    rampRoutesFor(code, "buy", "bsc", "USDC").routes.every(r => !r.unavailable && r.url.startsWith("https://"))));
  // After the 2026-11-10 removal the formerly restored
  // corridors are empty on every network, supported or not.
  ok("scrapped corridors stay empty on unsupported networks too", ["KE", "UG", "ZM"].every(code =>
    rampRoutesFor(code, "buy", "linea", "USDT").routes.length === 0
    && rampRoutesFor(code, "sell", "linea", "USDT").routes.length === 0));
}

// 17. Fluid Names
ok("fluid name valid", validateFluidName("ethuram") && validateFluidName("kemi_2"));
ok("fluid name invalid", !validateFluidName("ab") && !validateFluidName("2cool") && !validateFluidName("has space"));
ok("fluid name normalize", normalizeFluidName("@Kemi.fluid.is-a.dev") === "kemi" && normalizeFluidName("kemi@fluid.is-a.dev") === "kemi");
ok("name entry builds", JSON.stringify(buildNameEntry("kemi", "0xabc", "bc1q")).includes('"kemi"'));

// 18. Name entries carry every key family; any-asset sends resolve from one name
ok("entry has evm+btc+ln", (() => { const e = buildNameEntry("kemi", "0xabc", "bc1q", "kemi@getalby.com").kemi; return e.evm === "0xabc" && e.btc === "bc1q" && e.ln.includes("getalby"); })());
ok("entry ln optional", buildNameEntry("kemi", "0xabc", "bc1q").kemi.ln === undefined);

// 18b. Reverse lookup: a wallet recognises its own registered name by address
const NAME_REG = { ethuram: { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", btc: "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw" },
                   dripbot: { evm: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", btc: "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn" } };
ok("reverse lookup matches by evm", findNameForAddresses(NAME_REG, { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", btc: null })?.name === "ethuram");
ok("reverse lookup matches by btc", findNameForAddresses(NAME_REG, { evm: null, btc: "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn" })?.name === "dripbot");
ok("reverse lookup evm case-insensitive", findNameForAddresses(NAME_REG, { evm: "0x0ebf5563f905e3b9d58718e28e08143511dc763b" })?.name === "ethuram"
   && findNameForAddresses({ kemi: { evm: "0xabc00000000000000000000000000000000000ab" } }, { evm: "0xABC00000000000000000000000000000000000AB" })?.name === "kemi");
ok("reverse lookup no match", findNameForAddresses(NAME_REG, { evm: "0x0000000000000000000000000000000000000000", btc: "bc1qnone" }) === null);
ok("reverse lookup empty/null registry", findNameForAddresses(null, { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b" }) === null && findNameForAddresses({}, { btc: "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw" }) === null);
ok("reverse lookup btc stays case-sensitive", findNameForAddresses(NAME_REG, { btc: "BC1QH0EYDM0KLSS3Y0J79D3MCTCVKPXU7XRZYFZQDW" }) === null);

// 18c. Signed name claims (2026-11-09): EIP-191 claim → Nostr →
// processor → registry. The claim must verify end-to-end, any
// post-signing edit must break it, and the five UI states must be
// exactly the honesty states the owner directed.
{
  const claimWallet = await unlockVault(known.keystore, "password123");
  const claimPhrase = claimWallet.mnemonic.phrase;
  const { claim, event } = await buildSignedNameClaim({
    name: "claimunit", evm: claimWallet.address, btc: bitcoinAddress(claimPhrase),
    algo: algoAddressFromPhrase(claimPhrase),
    phrase: claimPhrase, signerWallet: claimWallet,
  });
  ok("name claim: signed claim verifies", verifyNameClaim(claim).ok === true);
  ok("name claim: verified entry carries the signed addresses", (() => { const v = verifyNameClaim(claim); return v.entry.evm === claimWallet.address && v.entry.btc === claim.btc; })());
  ok("name claim: message covers name + evm + btc + ln + algo", buildNameClaimMessage(claim).startsWith("Fluid name claim v1\nname: claimunit\nevm: " + claimWallet.address) && buildNameClaimMessage(claim).includes("\nln: \n"));
  ok("name claim: EIP-191 recovery round-trips to the claimed address", ethers.verifyMessage(buildNameClaimMessage(claim), claim.sig) === claimWallet.address);
  ok("name claim: tampered btc address refused", verifyNameClaim({ ...claim, btc: bitcoinAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about") }).ok === false);
  ok("name claim: tampered name refused", verifyNameClaim({ ...claim, name: "claimunit2" }).ok === false);
  ok("name claim: invalid name format refused", verifyNameClaim({ ...claim, name: "2bad" }).ok === false);
  ok("name claim: missing signature refused", verifyNameClaim({ ...claim, sig: "" }).ok === false);
  ok("name claim: nostr event is kind 30078 with the claim d-tag", event.kind === 30078 && event.tags.some(t => t[0] === "d" && t[1] === "fluid-name-claim:claimunit"));
  ok("name claim: nostr event signature verifies", verifyNostrEventSignature(event) === true);
  ok("name claim: tampered nostr event refused", verifyNostrEventSignature({ ...event, content: event.content.replace("claimunit", "claimuniX") }) === false);
  ok("name claim: nostr key is stable per wallet", nameClaimNostrKeys(claimPhrase).pubHex === event.pubkey && nameClaimNostrKeys(claimPhrase).pubHex === nameClaimNostrKeys(claimPhrase).pubHex);
  ok("name claim: relays are the public set", NAME_CLAIM_RELAYS.length >= 3 && NAME_CLAIM_RELAYS.every(r => r.startsWith("wss://")));
  ok("name state: nothing held = none", nameClaimState({}) === "none");
  ok("name state: held unpublished = saved (NOT LIVE)", nameClaimState({ stored: "x1name", pending: { published: false }, myEvm: claimWallet.address }) === "saved");
  ok("name state: held published = publishing", nameClaimState({ stored: "x1name", pending: { published: true }, myEvm: claimWallet.address }) === "publishing");
  ok("name state: registry resolves to this wallet = live", nameClaimState({ stored: "x1name", pending: { published: true }, registryHit: { evm: claimWallet.address }, myEvm: claimWallet.address }) === "live");
  ok("name state: registry resolves elsewhere = conflict", nameClaimState({ stored: "x1name", pending: { published: true }, registryHit: { evm: "0x0000000000000000000000000000000000000001" }, myEvm: claimWallet.address }) === "conflict");
  ok("name state: pending from this device shows publishing, not taken", nameClaimState({ stored: "x1name", pending: { published: true }, registryHit: null, myEvm: claimWallet.address }) === "publishing");
  ok("name state copy: saved says NOT LIVE", NAME_STATE_COPY.saved.includes("NOT LIVE") && NAME_STATE_COPY.saved.includes("Publish my name"));
  ok("name state copy: conflict says NOT LIVE + pick different", NAME_STATE_COPY.conflict.includes("NOT LIVE") && NAME_STATE_COPY.conflict.includes("different name"));
  ok("name state copy: live says registered in the public registry", NAME_STATE_COPY.live.includes("public registry"));
  // App wiring: creation auto-submits, the wait sheet gates on the
  // registry read, More-tab publish/conflict buttons exist, and the
  // GitHub sheet survives only as the labelled fallback.
  const appSrcNc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrcNc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("name claim wiring: creation auto-submits + waits on the registry", appSrcNc.includes("submitNameClaim(claimed, null)") && appSrcNc.includes("showNameCreationWait(claimed, accepted)") && appSrcNc.includes("Continue without a username — you can claim one later; until then nobody can send to you by name"));
  ok("name claim wiring: More card carries publish + pick-different actions", appSrcNc.includes("Publish my name") && appSrcNc.includes("Pick a different name") && idxSrcNc.includes('id="ownedNameState"'));
  ok("name claim wiring: GitHub is the labelled fallback only", idxSrcNc.includes("Publish it yourself instead (fallback)") && appSrcNc.includes("Publish it yourself instead (fallback)"));
  // Native Lightning registration (2026-11-09): the name card's
  // first choice is the wallet's OWN node; the hosted address stays
  // as the labelled secondary; the receivable-0 honesty copy is
  // pinned; the Receive sheet's registered line names the live
  // front door (completion audit G7).
  ok("native ln wiring: name card leads with the Fluid node, hosted address secondary",
    idxSrcNc.includes('id="ownedLnNativeBtn"') && idxSrcNc.includes("Use my Fluid node") &&
    idxSrcNc.includes('id="ownedLnAddBtn"') && idxSrcNc.includes("Add hosted address") &&
    idxSrcNc.indexOf('id="ownedLnNativeBtn"') < idxSrcNc.indexOf('id="ownedLnInput"'));
  ok("native ln wiring: receivable-0 honesty copy is on the card",
    appSrcNc.includes("Registered but not yet payable") && appSrcNc.includes("it has no channel with room in it. A channel with room is what lets sats arrive") &&
    appSrcNc.includes("you won't need to register again") && idxSrcNc.includes('id="ownedLnNote"'));
  ok("native ln wiring: registration rides the signed-claim pipeline with the offer field",
    appSrcNc.includes("submitNameClaim(stored, keepLn, offer)") && appSrcNc.includes('createOffer(null, "Fluid")'));
  ok("native ln wiring: pay-by-name branches on the registry value's shape",
    appSrcNc.includes("lightningTargetForNameEntry(hit)") && appSrcNc.includes("lnSession.payOffer(t.value, msat)"));
  ok("native ln wiring: Receive sheet names the live front door (audit G7)",
    appSrcNc.includes("registered to ${esc(name)}.fluidwallet.dpdns.org") && !appSrcNc.includes("registered to ${esc(name)}.${FLUID_DOMAIN}"));
  // Strengthened wait (owner, 2026-11-09): submitted / waiting-for /
  // elapsed on screen; ~15-minute long-wait offers keep-waiting and
  // retry, never an auto-complete; a creation conflict loops back to
  // a name step inside the flow; import-with-new-name joins the same
  // rule and the already-published adoption skips the wait.
  ok("name claim wiring: wait sheet shows submitted, waiting-for and elapsed", appSrcNc.includes('id="ncElapsed"') && appSrcNc.includes("Claim submitted for ") && appSrcNc.includes("to appear in the public registry, resolving to your wallet"));
  ok("name claim wiring: long wait offers keep waiting + retry, never auto-completes", appSrcNc.includes('id="ncLongWait"') && appSrcNc.includes("Keep waiting") && appSrcNc.includes("Retry the claim submission") && appSrcNc.includes("s >= 900"));
  ok("name claim wiring: creation conflict loops back to a name step", appSrcNc.includes('id="ncNewName"') && appSrcNc.includes("Claim this name instead"));
  ok("name claim wiring: import with a new name claims + waits; foreign-owned name opens conflict", appSrcNc.includes("Import-with-new-name") && appSrcNc.includes("startConflict: true") && appSrcNc.includes("submitNameClaim(wantName, null)"));
  ok("name claim wiring: import adopting its own published name skips the wait", appSrcNc.includes("Already published to THIS wallet"));
}

// 18d. Claim repair (first-user audit P0-1, 2026-11-09): a published
// claim whose event is unfindable on the relays AND absent from the
// registry past the repair window is LOST — the state machine must
// say "repair", never leave it at "publishing" forever; the repair
// path (truth check, once-per-session auto re-publish, wait-sheet
// inheritance, greeting gate) must stay wired.
{
  const { nameClaimRepairDue, NAME_CLAIM_REPAIR_AFTER_MS, queryNameClaimEvent, publishNameClaimEventDetailed } = await import("../src/wallet-core.js");
  const myEvm = "0x1234567890AbcdEF1234567890aBcdef12345678";
  const nowMs = 1794230000000;
  const freshP = { published: true, publishedAt: nowMs - 60000, submittedAt: nowMs - 60000 };
  const staleP = { published: true, publishedAt: nowMs - NAME_CLAIM_REPAIR_AFTER_MS - 1000, submittedAt: nowMs - NAME_CLAIM_REPAIR_AFTER_MS - 1000 };
  ok("repair: publishing + event unfindable + window expired = repair", nameClaimState({ stored: "lostname1", pending: staleP, registryHit: null, myEvm, eventFound: false, now: nowMs }) === "repair");
  ok("repair: event still findable stays publishing (pipeline merely behind)", nameClaimState({ stored: "lostname1", pending: staleP, registryHit: null, myEvm, eventFound: true, now: nowMs }) === "publishing");
  ok("repair: truth not yet checked stays publishing", nameClaimState({ stored: "lostname1", pending: staleP, registryHit: null, myEvm, now: nowMs }) === "publishing");
  ok("repair: inside the window stays publishing even if unfindable", nameClaimState({ stored: "lostname1", pending: freshP, registryHit: null, myEvm, eventFound: false, now: nowMs }) === "publishing");
  ok("repair: registry live beats repair", nameClaimState({ stored: "lostname1", pending: staleP, registryHit: { evm: myEvm }, myEvm, eventFound: false, now: nowMs }) === "live");
  ok("repair: due boundary is exactly the 15-minute window", nameClaimRepairDue({ pending: staleP, eventFound: false, now: nowMs }) === true && nameClaimRepairDue({ pending: freshP, eventFound: false, now: nowMs }) === false && NAME_CLAIM_REPAIR_AFTER_MS === 15 * 60 * 1000);
  ok("repair copy: lost + NOT LIVE + Publish again", NAME_STATE_COPY.repair.includes("lost") && NAME_STATE_COPY.repair.includes("NOT LIVE") && NAME_STATE_COPY.repair.includes("Publish again"));
  ok("repair: truth check + detailed publish exported", typeof queryNameClaimEvent === "function" && typeof publishNameClaimEventDetailed === "function");
  const appSrcR = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("repair wiring: durable record keeps accepted relays + publishedAt", appSrcR.includes("held.acceptedRelays = detail.acceptedRelays") && appSrcR.includes("held.publishedAt = Date.now()"));
  ok("repair wiring: truth check + repair paint + once-per-session auto republish", appSrcR.includes("queryNameClaimEvent(p.eventId)") && appSrcR.includes('paintNameState("repair")') && appSrcR.includes("fluid_name_autorepair_"));
  ok("repair wiring: creation wait inherits the repair", appSrcR.includes("repairTried") && appSrcR.includes("NAME_STATE_COPY.repair"));
  ok("repair wiring: home greeting gated until the claim is proven live", appSrcR.includes("const greetName = stored && !loadPendingClaim() ? stored : null") && appSrcR.includes("formatWelcomeHeader(greetName)"));
}

// 19. Fee split 60/40 (settled in BTC Lightning) + cheapest-route ranking
ok("split 60/40", (() => { const s = splitFee(1000); return s.treasury === 600 && s.dripbot === 400; })());
ok("split remainder to treasury", (() => { const s = splitFee(101); return s.treasury + s.dripbot === 101 && s.treasury === 61; })());
ok("split config is BTC lightning", FEE_SPLIT.currency === "BTC" && FEE_SPLIT.rail === "lightning" && FEE_SPLIT.dripbot.x === "@bitcoinornatin");
ok("cheapest route first", rankRoutes([{ name: "B", rank: 2 }, { name: "A", rank: 1 }, { name: "C" }])[0].name === "A"
  && rankRoutes([{ name: "B", rank: 2 }, { name: "A", rank: 1 }]).map(r => r.name).join("") === "AB");

// 20. OGO ERA game fee split 40/20/20/20, all BTC Lightning
ok("game split sums to 100", GAME_FEE_SPLIT.treasury + GAME_FEE_SPLIT.top100 + GAME_FEE_SPLIT.sessionLottery + GAME_FEE_SPLIT.weeklyReferrals === 100);
ok("game split math", (() => { const s = splitGameFee(1000); return s.treasury === 400 && s.top100 === 200 && s.sessionLottery === 200 && s.weeklyReferrals === 200; })());
ok("game split lossless", (() => { const s = splitGameFee(101); return s.treasury + s.top100 + s.sessionLottery + s.weeklyReferrals === 101; })());

// 21. Agentic wallets: separate derived accounts, chain-only policy
ok("agent evm differs from owner", agentAddresses(KNOWN_PHRASE, 0).evm !== known.address);
ok("agent btc differs from owner", agentAddresses(KNOWN_PHRASE, 0).btc !== bitcoinAddress(KNOWN_PHRASE));
ok("agent accounts are deterministic", agentAddresses(KNOWN_PHRASE, 1).evm === agentAddresses(KNOWN_PHRASE, 1).evm && agentAddresses(KNOWN_PHRASE, 1).evm !== agentAddresses(KNOWN_PHRASE, 0).evm);
ok("agent policy: no ramps, no kyc", AGENT_POLICY_DEFAULTS.ramps === false && AGENT_POLICY_DEFAULTS.kyc === false && AGENT_POLICY_DEFAULTS.seedExport === false);
ok("agent policy caps enforced", checkAgentPolicy({}, 25, 0).ok === true && checkAgentPolicy({}, 75, 0).ok === false && checkAgentPolicy({}, 25, 190).ok === false);
ok("agent descriptor is chain-only", (() => { const d = buildAgentDescriptor({ name: "T", evm: "0x0", btc: "bc1q" }); return d.access.onramp === false && d.access.offramp === false && d.access.blockchain === "full" && d.accountIndex === 1000; })());

// 22. Fee settlement: convert at the $2 mark, BTC Lightning, 60/40
ok("fee settlement threshold is $2", FEE_SETTLEMENT.thresholdUsd === 2 && FEE_SETTLEMENT.rail === "lightning");
ok("fee settlement due logic", feeSettlementDue(1.99) === false && feeSettlementDue(2) === true && feeSettlementDue(2.01) === true);
ok("drip wallet paired in fee config", FEE_SPLIT.dripbot.agentWallet.evm === "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B" && FEE_SPLIT.dripbot.x === "@bitcoinornatin");

// 22b. Standard platform fee (Ethuram 2026-11-06): 0.5% on swaps/conversions only
ok("platform fee pinned at 50 bps", PLATFORM_FEE_BPS === 50 && PLATFORM_FEE_FRACTION === 0.005);
ok("platform fee label derived", platformFeePercentText() === "0.5%");
ok("platform fee math", platformFeeOn(10000n) === 50n && platformFeeOn(200n) === 1n && platformFeeOn(123456789n) === 617283n);
ok("platform fee floors to zero on dust", platformFeeOn(199n) === 0n && platformFeeOn(0n) === 0n && platformFeeOn(101) === 0n);
ok("platform fee never exceeds amount, net is exact", [1n, 199n, 200n, 10000n, 987654321n].every(a => { const f = platformFeeOn(a); return f >= 0n && f <= a && (a - f) + f === a; }));
ok("platform fee accepts raw strings", platformFeeOn("84000000") === 420000n);
ok("platform fee scope: swaps+conversions only", platformFeeApplies("swap") === true && platformFeeApplies("conversion") === true);
ok("platform fee scope: sends/receives are fee-free", platformFeeApplies("send") === false && platformFeeApplies("receive") === false && platformFeeApplies("") === false && platformFeeApplies(undefined) === false);
ok("send intent carries no platform fee", !formatSendIntent({ amount: "0.05", symbol: "BNB", to: fresh.address, networkKey: "bsc", feeNative: "0.000105" }).includes("Fluid fee"));
// Disclosure: the confirm sentence shows the fee computed from the quote's real numbers
ok("swap intent discloses fluid fee from quote numbers", (() => {
  const feeDisp = swapRawToAmount(platformFeeOn("84000000").toString(), 6); // 84 USDC quote at the cap -> 0.42 USDC fee
  const s = formatSwapIntent({ fromAmount: "84", fromSymbol: "USDC", fromNetKey: "bsc", toAmount: "83.9", toSymbol: "USDT", toNetKey: "bsc", toolName: "PancakeSwap", feeUsd: 0.21, durationSec: 30, platformFeeUsd: 0.42, platformFeePct: 0.5 });
  return feeDisp === "0.42" && s.includes("Fluid fee: $0.42 (0.5%)");
})());
ok("swap intent without fee value omits the clause", !formatSwapIntent({ fromAmount: "1", fromSymbol: "BNB", fromNetKey: "bsc", toAmount: "100", toSymbol: "USDC", toNetKey: "bsc", toolName: "X", feeUsd: 0.1, durationSec: 30 }).includes("Fluid fee"));
// LI.FI request construction: integrator always; fee param gated on collection being enabled
// (collection enabled 2026-11-07, after the "fluid-wallet" portal registration designated
// the DripBot agent wallet as the Default EVM fee wallet)
ok("lifi collection enabled after portal registration", PLATFORM_FEE_COLLECTION_ENABLED === true);
ok("lifi routes request carries integrator and 0.005 fee by default", (() => {
  const r = buildLifiRoutesRequest({ fromChainId: 56, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: 1000n, fromAddress: "0xc", toAddress: "0xc" });
  return r.options.integrator === LIFI_INTEGRATOR && LIFI_INTEGRATOR === "fluid-wallet" && r.options.fee === PLATFORM_FEE_FRACTION && PLATFORM_FEE_FRACTION === 0.005 && r.fromAmount === "1000";
})());
ok("lifi routes request with collection explicitly off omits fee", !("fee" in buildLifiRoutesRequest({ fromChainId: 56, toChainId: 1, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: false }).options));
ok("lifi routes request with collection on carries 0.005", buildLifiRoutesRequest({ fromChainId: 56, toChainId: 1, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true }).options.fee === 0.005);
ok("lifi quote params mirror the gating", (() => {
  const dflt = buildLifiQuoteParams({ fromChainId: 56, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" });
  const off = buildLifiQuoteParams({ fromChainId: 56, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: false });
  const on = buildLifiQuoteParams({ fromChainId: 56, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true });
  return dflt.get("integrator") === "fluid-wallet" && dflt.get("fee") === "0.005" && off.get("integrator") === "fluid-wallet" && off.get("fee") === null && on.get("fee") === "0.005";
})());
// Per-route fee audit (2026-11-07): LI.FI is the only swap engine. The
// integrator is attached for every chain type, but the 0.005 fee is
// attached BY DEFAULT only where the source chain's portal fee wallet
// is registered (swapFeeCollectingChain): LI.FI rejects fee-bearing
// requests on unconfigured chains outright (HTTP 400, code 1011 —
// verified live 2026-11-07 for the Tron and Sui chain ids before their
// portal fee wallets were registered later that day), so attaching it
// there would break the swap, not just skip the fee. Bitcoin has no
// swap route at all, so it never collects.
ok("lifi fee attached by default only on collecting chains", (() => {
  const matrix = [[56, true], [SOLANA_LIFI_CHAIN_ID, true], [TRON_LIFI_CHAIN_ID, true], [SUI_LIFI_CHAIN_ID, true], [BITCOIN_LIFI_CHAIN_ID, false]];
  return matrix.every(([id, collecting]) => {
    const r = buildLifiRoutesRequest({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" });
    const q = buildLifiQuoteParams({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" });
    return swapFeeCollectingChain(id) === collecting
      && r.options.integrator === "fluid-wallet" && (collecting ? r.options.fee === 0.005 : !("fee" in r.options))
      && q.get("integrator") === "fluid-wallet" && (collecting ? q.get("fee") === "0.005" : q.get("fee") === null);
  });
})());
ok("lifi fee explicit include still attaches on any chain type", (() => {
  const ids = [56, SOLANA_LIFI_CHAIN_ID, TRON_LIFI_CHAIN_ID, SUI_LIFI_CHAIN_ID, BITCOIN_LIFI_CHAIN_ID];
  return ids.every(id => {
    const r = buildLifiRoutesRequest({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true });
    const q = buildLifiQuoteParams({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true });
    return r.options.fee === 0.005 && q.get("fee") === "0.005";
  });
})());
ok("lifi fee opt-out holds for every chain type", (() => {
  const ids = [56, SOLANA_LIFI_CHAIN_ID, TRON_LIFI_CHAIN_ID, SUI_LIFI_CHAIN_ID, BITCOIN_LIFI_CHAIN_ID];
  return ids.every(id => {
    const r = buildLifiRoutesRequest({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: false });
    const q = buildLifiQuoteParams({ fromChainId: id, toChainId: 56, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: false });
    return !("fee" in r.options) && r.options.integrator === "fluid-wallet" && q.get("fee") === null && q.get("integrator") === "fluid-wallet";
  });
})());
// The swap universe is exactly the EVM networks + tron/solana/sui. Bitcoin (and every
// other send-only family) is NOT swappable — pinned so adding a family to the swap
// universe forces a fee-coverage review instead of silently shipping an unfeed route.
ok("swap universe is evm + tron + solana + sui only", (() => {
  const evmOk = Object.keys(NETWORKS).every(k => swapChainOf(k) !== null);
  const famOk = ["tron", "solana", "sui"].every(k => swapChainOf(k) !== null);
  const notSwappable = ["bitcoin", "litecoin", "dogecoin", "cosmoshub", "ton", "near", "xrpl", "stellar", "algorand", "aptos"].every(k => swapChainOf(k) === null);
  return evmOk && famOk && notSwappable && BITCOIN_LIFI_CHAIN_ID === 20000000000001;
})());
// SWAP_FEE_COVERAGE is the audited per-family state: it names exactly the non-EVM swap
// families plus the evm row, and feeWired mirrors collecting on every row — the request
// builders attach the fee exactly where a portal fee wallet is configured to receive
// it (LI.FI rejects fee-bearing requests elsewhere, code 1011). Its executable flags
// agree with swapRouteExecutable's real behaviour on synthetic routes.
ok("swap fee coverage names every swap family", (() => {
  const fams = SWAP_FEE_COVERAGE.map(r => r.family).sort();
  return JSON.stringify(fams) === JSON.stringify(["evm", "solana", "sui", "tron"])
    && SWAP_FEE_COVERAGE.every(r => r.provider === "LI.FI" && r.feeSupported === true && r.feeWired === r.collecting);
})());
ok("swap fee coverage: evm collecting into the dripbot agent wallet", (() => {
  const evm = SWAP_FEE_COVERAGE.find(r => r.family === "evm");
  return evm.executable === true && evm.collecting === true && evm.destination === FEE_SPLIT.dripbot.agentWallet.evm && evm.blocker === null;
})());
ok("swap fee coverage agrees with route executability", (() => {
  const evmRoute = { fromChainId: 56, steps: [{ transactionRequest: { to: "0xabc", chainId: 56, data: "0x", value: "0" } }] };
  const solRoute = { fromChainId: SOLANA_LIFI_CHAIN_ID, steps: [{ transactionRequest: { data: "AAAA" } }] };
  const trxRoute = { fromChainId: TRON_LIFI_CHAIN_ID, steps: [{ transactionRequest: { to: "TXYZ", data: "0xabcd", customData: { contractType: "TriggerSmartContract", tronTransaction: { raw_data_hex: "abcd", txID: "ef01" } } } }] };
  const suiRoute = { fromChainId: SUI_LIFI_CHAIN_ID, steps: [{ transactionRequest: { data: "AAAA" } }] };
  const byFam = Object.fromEntries(SWAP_FEE_COVERAGE.map(r => [r.family, r.executable]));
  return swapRouteExecutable(evmRoute).ok === byFam.evm && swapRouteExecutable(solRoute).ok === byFam.solana
    && swapRouteExecutable(trxRoute).ok === byFam.tron && swapRouteExecutable(suiRoute).ok === byFam.sui;
})());
ok("swap fee coverage: solana collecting into the dripbot agent wallet", (() => {
  const sol = SWAP_FEE_COVERAGE.find(r => r.family === "solana");
  return sol.executable === true && sol.collecting === true && sol.destination === FEE_SPLIT.dripbot.agentWallet.solana && sol.blocker === null;
})());
ok("swap fee coverage: tron collecting into the dripbot agent wallet", (() => {
  const t = SWAP_FEE_COVERAGE.find(r => r.family === "tron");
  return t.executable === true && t.collecting === true && t.destination === FEE_SPLIT.dripbot.agentWallet.tron
    && isValidTronAddress(t.destination) && t.blocker === null;
})());
ok("swap fee coverage: sui collecting into the dripbot agent wallet", (() => {
  const s = SWAP_FEE_COVERAGE.find(r => r.family === "sui");
  return s.executable === true && s.collecting === true && s.destination === FEE_SPLIT.dripbot.agentWallet.sui
    && isValidSuiAddress(s.destination) && s.blocker === null;
})());
// Disclosure is family-agnostic too: a Solana-sourced quote's confirm sentence carries
// the same Fluid fee clause as an EVM one.
ok("swap intent discloses fluid fee on a solana route", (() => {
  const s = formatSwapIntent({ fromAmount: "2", fromSymbol: "SOL", fromNetKey: "solana", toAmount: "150", toSymbol: "USDC", toNetKey: "base", toolName: "Jupiter", feeUsd: 0.05, durationSec: 60, platformFeeUsd: 1.5, platformFeePct: 0.5 });
  return s.includes("Fluid fee: $1.50 (0.5%)") && s.includes("on Solana");
})());
ok("swap intent discloses fluid fee on a tron route", (() => {
  const s = formatSwapIntent({ fromAmount: "100", fromSymbol: "TRX", fromNetKey: "tron", toAmount: "9.10", toSymbol: "BNB", toNetKey: "bsc", toolName: "Symbiosis", feeUsd: 0.40, durationSec: 120, platformFeeUsd: 0.14, platformFeePct: 0.5 });
  return s.includes("Fluid fee: $0.14 (0.5%)") && s.includes("on Tron");
})());
ok("swap intent discloses fluid fee on a sui route", (() => {
  const s = formatSwapIntent({ fromAmount: "10", fromSymbol: "SUI", fromNetKey: "sui", toAmount: "9.40", toSymbol: "BNB", toNetKey: "bsc", toolName: "Relay", feeUsd: 0.05, durationSec: 120, platformFeeUsd: 0.05, platformFeePct: 0.5 });
  return s.includes("Fluid fee: $0.05 (0.5%)") && s.includes("on Sui");
})());
// Settlement legs resolve by USERNAME through the names registry
ok("fee legs are username-modelled", FEE_SPLIT.treasury.username === "ethuram" && FEE_SPLIT.treasury.share === 60 && FEE_SPLIT.dripbot.username === "dripbot" && FEE_SPLIT.dripbot.share === 40);
ok("fee legs resolve via registry incl ln", (() => {
  const reg = { ...buildNameEntry("ethuram", "0x0EBf5563F905E3B9D58718E28E08143511DC763b", "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw"),
                ...buildNameEntry("dripbot", "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn", "dripbot@ln.fluid.example") };
  const legs = feeLegTargets(reg);
  return legs[0].username === "ethuram" && legs[0].evm === "0x0EBf5563F905E3B9D58718E28E08143511DC763b" && legs[0].ln === null
      && legs[1].username === "dripbot" && legs[1].ln === "dripbot@ln.fluid.example" && legs[1].share === 40;
})());
ok("fee legs tolerate a missing registry", feeLegTargets(null).every(l => l.evm === null && l.btc === null && l.ln === null) && feeLegTargets({})[0].username === "ethuram");
// Fee-pot accounting (keeper trigger): priced total, unpriced excluded, $2 rule
ok("fee pot totals priced holdings", (() => { const r = feePotReport([{ amount: 1.5, priceUsd: 2 }, { amount: 0.5, priceUsd: 4 }]); return r.totalUsd === 5 && r.priced === 2 && r.unpriced === 0 && r.due === true; })());
ok("fee pot excludes unpriced, never guesses", (() => { const r = feePotReport([{ amount: 100, priceUsd: null }, { amount: 3, priceUsd: 0.5 }]); return r.totalUsd === 1.5 && r.unpriced === 1 && r.due === false; })());
ok("fee pot due exactly at $2", feePotReport([{ amount: 2, priceUsd: 1 }]).due === true && feePotReport([{ amount: 1.99, priceUsd: 1 }]).due === false && feePotReport([]).totalUsd === 0);

// 23. Swap route ranking (LI.FI): cheapest = best net USD after gas, fastest = shortest duration
{
  const fake = [
    { id: "mid", toAmountUSD: "10.00", gasCostUSD: "0.50", executionDuration: 300, steps: [] },
    { id: "rich", toAmountUSD: "10.40", gasCostUSD: "0.20", executionDuration: 900, steps: [] },
    { id: "quick", toAmountUSD: "9.00", gasCostUSD: "0.10", steps: [{ estimate: { executionDuration: 60, gasCosts: [{ amountUSD: "0.10" }] } }] },
    { id: "nogas", toAmountUSD: "9.50", steps: [{ estimate: { executionDuration: 120, gasCosts: [{ amountUSD: "0.05" }, { amountUSD: "0.05" }] } }] },
  ];
  const ranked = rankSwapRoutes(fake);
  ok("swap ranking sorts best net first", ranked.map(r => r.id).join(",") === "rich,mid,nogas,quick");
  ok("swap cheapest is best net output", ranked.find(r => r.cheapest).id === "rich");
  ok("swap fastest uses step durations", ranked.find(r => r.fastest).id === "quick" && ranked.find(r => r.id === "quick").durationSec === 60);
  ok("swap gas falls back to step gasCosts", ranked.find(r => r.id === "nogas").gasCostUSD === 0.1 && ranked.find(r => r.id === "nogas").netUsd === 9.4);
  ok("swap ranking does not mutate inputs", fake[0].cheapest === undefined && fake[1].netUsd === undefined);
  ok("swap ranking of nothing is empty", Array.isArray(rankSwapRoutes([])) && rankSwapRoutes([]).length === 0 && rankSwapRoutes(null).length === 0);
}

// 24. Swap executability + amount conversion + intent sentence
{
  const good = { fromChainId: 56, steps: [{ transactionRequest: { to: "0xabc", chainId: 56 } }, { note: "bridge wait, no tx" }] };
  const wrongChain = { fromChainId: 56, steps: [{ transactionRequest: { to: "0xabc", chainId: 1 } }] };
  const bare = { fromChainId: 56, steps: [{ tool: "relay" }] };
  ok("swap executable picks signable source steps", swapRouteExecutable(good).ok === true && swapRouteExecutable(good).steps.length === 1);
  ok("swap executable refuses foreign-chain steps", swapRouteExecutable(wrongChain).ok === false && /can't sign/.test(swapRouteExecutable(wrongChain).reason));
  ok("swap executable refuses tx-less routes", swapRouteExecutable(bare).ok === false);
  ok("swap raw amount round-trip", swapAmountToRaw("0.01", 18) === "10000000000000000" && swapRawToAmount("6878572", 6) === "6.878572");
  ok("swap native token is zero address", LIFI_NATIVE_TOKEN === "0x0000000000000000000000000000000000000000");
  const si = formatSwapIntent({ fromAmount: "0.01", fromSymbol: "BNB", fromNetKey: "bsc", toAmount: "6.878572", toSymbol: "USDC", toNetKey: "base", toolName: "Relay", feeUsd: 0.0046, durationSec: 45 });
  ok("swap intent is human-readable", si.includes("Swap 0.01 BNB on BNB Chain") && si.includes("USDC") && si.includes("Base") && si.includes("Confirm?"));
}

// 25. Send intent with a resolved Fluid name: confirmation shows name AND
// the FULL address (audit L1 superseded the original short-address pin:
// the user confirms the resolution, so it is never truncated).
{
  const named = formatSendIntent({ amount: "0.0005", symbol: "BNB", to: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", networkKey: "bsc", feeNative: "0.000105", name: "dripbot" });
  ok("named intent shows name and FULL address", named.includes("Send 0.0005 BNB to dripbot.fluid.is-a.dev (0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B) on BNB Chain"));
  const plain = formatSendIntent({ amount: "0.0005", symbol: "BNB", to: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", networkKey: "bsc", feeNative: "0.000105" });
  ok("plain intent keeps raw address only", plain.includes("to 0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B on BNB Chain") && !plain.includes("dripbot"));
}

// 27. Chain discovery gate: LI.FI + chainid.network + DefiLlama merged,
// admitted only when active, untainted by reused ids, not a testnet, and
// either LI.FI-listed or carrying real TVL.
{
  const lifi = (id, extra = {}) => ({ chainType: "EVM", id, name: "Lifi " + id, mainnet: true, coin: "LX",
    nativeToken: { symbol: "LX", decimals: 18 },
    metamask: { chainId: "0x" + id.toString(16), rpcUrls: ["https://lifi-rpc-" + id + ".example"], blockExplorerUrls: ["https://lifi-scan-" + id + ".example"] },
    ...extra });
  const reg = (chainId, extra = {}) => ({ chainId, name: "Chain " + chainId, rpc: ["https://reg-rpc-" + chainId + ".example"],
    nativeCurrency: { symbol: "RX", decimals: 18 },
    explorers: [{ url: "https://reg-scan-" + chainId + ".example", standard: "EIP3091" }], ...extra });
  const gate = (sources) => gateChains(sources);
  const byId = (list, id) => list.find(c => c.chainId === id);

  // LI.FI-listed with negligible TVL → display, LI.FI RPC wins
  {
    const out = gate({ lifiChains: [lifi(9001)], registry: [], tvl: [{ chainId: 9001, tvl: 100 }] });
    const c = byId(out, 9001);
    ok("gate: LI.FI-listed low-TVL chain is display tier", !!c && c.tier === "display" && c.lifi === true && c.key === "c9001");
    ok("gate: LI.FI RPC and explorer preferred", c.rpc === "https://lifi-rpc-9001.example" && c.explorer === "https://lifi-scan-9001.example");
  }
  // $50M TVL, not LI.FI-listed → display
  {
    const out = gate({ lifiChains: [], registry: [reg(9002)], tvl: [{ chainId: 9002, tvl: 50_000_000 }] });
    const c = byId(out, 9002);
    ok("gate: $50M TVL non-LI.FI chain is display tier", !!c && c.tier === "display" && c.lifi === false && c.tvl === 50_000_000);
  }
  // $2M TVL, not LI.FI-listed → discoverable only
  {
    const out = gate({ lifiChains: [], registry: [reg(9003)], tvl: [{ chainId: 9003, tvl: 2_000_000 }] });
    ok("gate: $2M TVL non-LI.FI chain is discoverable only", byId(out, 9003)?.tier === "discoverable");
  }
  // $500k TVL, not LI.FI-listed → excluded entirely
  {
    const out = gate({ lifiChains: [], registry: [reg(9004)], tvl: [{ chainId: 9004, tvl: 500_000 }] });
    ok("gate: $500k TVL non-LI.FI chain is excluded", byId(out, 9004) === undefined);
  }
  // Graveyard chains stay out even when LI.FI lists them
  {
    const out = gate({ lifiChains: [lifi(1101), lifi(81457), lifi(1666600000)], registry: [reg(1101), reg(81457), reg(1666600000)], tvl: [] });
    ok("gate: graveyard excluded even when LI.FI-listed", out.length === 0);
  }
  // Testnet names stay out even with huge TVL
  {
    const out = gate({ lifiChains: [], tvl: [{ chainId: 9005, tvl: 50_000_000 }, { chainId: 9006, tvl: 50_000_000 }],
      registry: [reg(9005, { name: "Foo Testnet" }), reg(9006, { name: "Bar Sepolia" })] });
    ok("gate: testnet-named chains excluded", out.length === 0);
  }
  // reusedChainId red flag stays out — even when LI.FI-listed and rich
  {
    const out = gate({ lifiChains: [lifi(9007)], registry: [reg(9007, { redFlags: ["reusedChainId"] })], tvl: [{ chainId: 9007, tvl: 50_000_000 }] });
    ok("gate: reusedChainId red flag excluded", out.length === 0);
  }
  // Non-active registry status stays out (deprecated, incubating)
  {
    const out = gate({ lifiChains: [], tvl: [{ chainId: 9008, tvl: 50_000_000 }, { chainId: 9009, tvl: 50_000_000 }],
      registry: [reg(9008, { status: "deprecated" }), reg(9009, { status: "incubating" })] });
    ok("gate: deprecated and incubating statuses excluded", out.length === 0);
  }
  // API-key-templated RPCs are skipped for the next clean one
  {
    const out = gate({ lifiChains: [], tvl: [{ chainId: 9010, tvl: 50_000_000 }],
      registry: [reg(9010, { rpc: ["https://rpc.example/v1/${API_KEY}", "wss://socket.example", "https://clean.example"] })] });
    ok("gate: templated and wss RPCs skipped for a clean https one", byId(out, 9010)?.rpc === "https://clean.example");
  }
  // LI.FI mainnet overrides a stale testnet registry entry (the 999 pattern)
  {
    const out = gate({ lifiChains: [lifi(9012, { name: "HyperEVM", nativeToken: { symbol: "HYPE", decimals: 18 } })],
      registry: [reg(9012, { name: "Wanchain Testnet", nativeCurrency: { symbol: "WAN", decimals: 18 } })], tvl: [] });
    const c = byId(out, 9012);
    ok("gate: LI.FI mainnet beats stale testnet registry entry", !!c && c.name === "HyperEVM" && c.symbol === "HYPE" && c.tier === "display");
  }
  // LI.FI pseudo-entries (wallet metadata pointing at another chain) drop out
  {
    const bad = lifi(9013, { name: "Hyperliquid" });
    bad.metamask.chainId = "0x1"; // metadata disagrees with the id — not a plain EVM network
    const out = gate({ lifiChains: [bad], registry: [], tvl: [] });
    ok("gate: self-inconsistent LI.FI entry dropped", out.length === 0);
  }
  // Duplicate DefiLlama rows keep the max TVL; null-chainId rows attach by name
  {
    const out = gate({ lifiChains: [], registry: [reg(9014, { name: "Dup Chain" }), reg(9015, { name: "Namely Mainnet" })],
      tvl: [{ chainId: 9014, tvl: 0 }, { chainId: 9014, tvl: 5_000_000 }, { chainId: null, name: "Namely", tvl: 30_000_000 }] });
    ok("gate: duplicate TVL rows keep the max", byId(out, 9014)?.tvl === 5_000_000 && byId(out, 9014)?.tier === "discoverable");
    ok("gate: null-chainId TVL attaches by normalized name", byId(out, 9015)?.tvl === 30_000_000 && byId(out, 9015)?.tier === "display");
  }
  // Brand alias: DefiLlama "BSquared" must attach to registry "B2 Mainnet"
  // (the live B² Network case — $2.5M TVL, chainId null on DefiLlama)
  {
    const out = gate({ lifiChains: [], registry: [reg(223, { name: "B2 Mainnet", nativeCurrency: { symbol: "BTC", decimals: 18 } })],
      tvl: [{ chainId: null, name: "BSquared", tvl: 2_500_000 }] });
    const c = byId(out, 223);
    ok("gate: BSquared alias attaches TVL to B2 (223)", !!c && c.tvl === 2_500_000 && c.tier === "discoverable");
  }
  // Non-EVM registry squatters (Tron, Algorand) never auto-admit
  {
    const out = gate({ lifiChains: [], tvl: [{ chainId: 728126428, tvl: 5_000_000_000 }, { chainId: 4160, tvl: 30_000_000 }],
      registry: [reg(728126428, { name: "Tron Mainnet" }), reg(4160, { name: "Algorand" })] });
    ok("gate: non-EVM squatters excluded", out.length === 0);
  }
  // Empty or missing sources gate to nothing — never throw
  ok("gate: empty sources give an empty list", gateChains().length === 0 && gateChains({}).length === 0);
}

// 28. registerNetworks: discovered chains join the live registry core
// reads; built-ins are never overwritten.
{
  registerNetworks({ c424242: { name: "Test Chain", chainId: 424242, symbol: "TST", priceSym: null, rpc: "https://rpc-424242.example", explorer: null, tokens: [] } });
  ok("registerNetworks adds a discovered chain", NETWORKS.c424242?.chainId === 424242 && NETWORKS.c424242?.name === "Test Chain");
  ok("registerNetworks leaves built-ins untouched", NETWORKS.bsc.chainId === 56 && NETWORKS.bsc.rpc === "https://bsc-rpc.publicnode.com");
  ok("providerFor builds for a registered chain", !!providerFor("c424242"));
}

// 29. Tron: the EVM account's secp256k1 key derives the Tron address
// (keccak of the uncompressed pubkey, last 20 bytes, 0x41 + Base58Check).
// Vectors computed two independent ways (@scure/base Base58Check vs a
// manual BigInt-alphabet encoder over node:crypto double-SHA256) — both
// agreed on these values, and the EVM side of each key is a known vector.
{
  const HH_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat account #0, EVM 0xf39F…2266
  ok("tron: hardhat key vector", tronAddressFromKey(HH_KEY) === "TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG");
  ok("tron: phrase derivation matches the key", tronAddressFromPhrase(KNOWN_PHRASE) === "TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG");
  ok("tron: signer object accepted", tronAddressFromKey(unlocked) === "TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG");
  ok("tron: private key 1 vector", tronAddressFromKey("0x0000000000000000000000000000000000000000000000000000000000000001") === "TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC");
  ok("tron: base58check roundtrip", tronAddressFromHex(tronAddressToHex("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")) === "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
    && tronAddressToHex("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t").startsWith("41"));
  ok("tron: hex form encodes back", tronAddressFromHex("41f39fd6e51aad88f6f4ce6ab8827279cfffb92266") === "TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG");
  ok("tron: sun/trx conversions", tronSunToTrx(1_500_000) === "1.5" && tronSunToTrx(0) === "0.0" && tronTrxToSun("1.5") === 1_500_000n && tronTrxToSun("0.000001") === 1n);
  ok("tron: valid T-addresses pass", isValidTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") && isValidTronAddress("TYBNgWfhGuNzdLtjKtxXTfskAhTbMcqbaG") && isValidTronAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"));
  ok("tron: wrong-prefix base58check refused", !isValidTronAddress("16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM")); // valid Base58Check, 0x00 prefix (Bitcoin)
  ok("tron: corrupted checksum refused", !isValidTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u"));
  ok("tron: EVM addresses and garbage refused", !isValidTronAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") && !isValidTronAddress("hello") && !isValidTronAddress("") && !isValidTronAddress(null));
  const ti = formatTronSendIntent({ amount: "2.5", symbol: "USDT", to: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
  ok("tron: intent is human-readable", ti.includes("Send 2.5 USDT") && ti.includes("on Tron") && ti.includes("Confirm?"));
  ok("tron: token constants are the canonical contracts", TRON_TOKENS[0].address === "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" && TRON_TOKENS[1].address === "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8" && TRON_TOKENS.every(t => t.decimals === 6));
  ok("tron: LI.FI chain id and native token", TRON_LIFI_CHAIN_ID === 728126428 && TRON_SWAP_NATIVE_TOKEN === "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"
    && swapChainOf("tron").chainId === 728126428 && swapChainOf("bsc").chainId === 56 && swapChainOf("nope") === null);
  const tronRoute = { fromChainId: 728126428, steps: [{ transactionRequest: { to: "TXYZ", data: "0xabcd", customData: { contractType: "TriggerSmartContract", tronTransaction: { raw_data_hex: "abcd", txID: "ef01" } } } }] };
  ok("tron: swap routes sourced from Tron are executable (TVM signer)", (() => {
    const r = swapRouteExecutable(tronRoute);
    return r.ok === true && r.tvm === true && r.steps.length === 1;
  })());
  const tronBare = { fromChainId: 728126428, steps: [{ transactionRequest: { to: "TXYZ", data: "0x" } }] };
  ok("tron: swap route without the verified payload shape is refused", swapRouteExecutable(tronBare).ok === false && /no signable transaction/.test(swapRouteExecutable(tronBare).reason));
}

// 26. Address-poisoning lookalike detection: same first 4 + last 4 hex
// chars as a known address, but not the address itself
{
  const known = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const lookalike = "0x7Fe6" + "a".repeat(32) + "135B";
  ok("poison: the address itself is not a lookalike", looksLikePoison(known, [known]) === null);
  ok("poison: same address in another case is not a lookalike", looksLikePoison(known.toLowerCase(), [known]) === null);
  ok("poison: lookalike returns the known address it imitates", looksLikePoison(lookalike, [known]) === known);
  ok("poison: lookalike matching is case-insensitive", looksLikePoison(lookalike.toLowerCase(), [known.toUpperCase().replace("0X", "0x")]) === known.toUpperCase().replace("0X", "0x"));
  ok("poison: unrelated address is clean", looksLikePoison("0x1234567890abcdef1234567890abcdef12345678", [known]) === null);
  ok("poison: same start but different end is clean", looksLikePoison("0x7Fe6" + "a".repeat(32) + "9999", [known]) === null);
  ok("poison: non-addresses and empty known sets are clean", looksLikePoison("hello", [known]) === null && looksLikePoison(lookalike, []) === null && looksLikePoison(lookalike, null) === null);
}

// 30. Solana: SLIP-0010 Ed25519 derivation from the same BIP39 seed.
// (a) The official SLIP-0010 test vectors for ed25519 (spec:
// satoshilabs/slips slip-0010.md, "Test vector 1 for ed25519",
// seed 000102030405060708090a0b0c0d0e0f) pin the HMAC chain exactly —
// private key, chain code AND public key at four depths.
// (b) The end-to-end mnemonic vector was cross-checked during the
// Phase 1b build against three independent implementations — the
// ed25519-hd-key reference package, @solana/web3.js Keypair.fromSeed
// and OpenSSL's Ed25519 (via node:crypto) — all agreeing with the
// official vectors above; the web3.js agreement is re-asserted inline.
{
  const hex = (b) => Buffer.from(b).toString("hex");
  const seed = Uint8Array.from({ length: 16 }, (_, i) => i);
  const V = [
    { path: [], priv: "2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7", chain: "90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb", pub: "a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed" },
    { path: [0], priv: "68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3", chain: "8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69", pub: "8c8a13df77a28f3445213a0f432fde644acaa215fc72dcdf300d5efaa85d350c" },
    { path: [0, 1], priv: "b1d0bad404bf35da785a64ca1ac54b2617211d2777696fbffaf208f746ae84f2", chain: "a320425f77d1b5c2505a6b1b27382b37368ee640e3557c315416801243552f14", pub: "1932a5270f335bed617d5b935c80aedb1a35bd9fc1e31acafd5372c30f5c1187" },
    { path: [0, 1, 2], priv: "92a5b23c0b8a99e37d07df3fb9966917f5d06e02ddbd909c7e184371463e9fc9", chain: "2e69929e00b5ab250f49c3fb1c12f252de4fed2c1db88387094a0f8c4c9ccd6c", pub: "ae98736566d30ed0e9d2f4486a64bc95740d89c7db33f52121f8ea8f76ff0fc1" },
  ];
  for (const v of V) {
    const d = deriveSlip10Ed25519(seed, v.path);
    const label = "m" + v.path.map(i => "/" + i + "H").join("");
    ok(`solana: SLIP-0010 vector ${label} private+chain`, hex(d.key) === v.priv && hex(d.chainCode) === v.chain);
    ok(`solana: SLIP-0010 vector ${label} public key`, hex(ed25519.getPublicKey(d.key)) === v.pub);
  }
  // End-to-end: the canonical BIP39 test mnemonic at the Phantom path.
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  ok("solana: abandon…about @ m/44'/501'/0'/0'", solanaAddressFromPhrase(ABANDON) === "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
  ok("solana: seed-level derivation agrees", solanaAddressFromSeed(mnemonicToSeedSync(ABANDON)) === "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
  ok("solana: @solana/web3.js Keypair agrees", SolKeypair.fromSeed(solanaSeedFromSeed(mnemonicToSeedSync(ABANDON))).publicKey.toBase58() === "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
  ok("solana: derivation is seed-sensitive and deterministic",
    solanaAddressFromPhrase(KNOWN_PHRASE) !== "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk"
    && solanaAddressFromPhrase(KNOWN_PHRASE) === solanaAddressFromPhrase(KNOWN_PHRASE));

  // Address validation: exactly 32 bytes after Base58 decode
  ok("solana: valid addresses pass", isValidSolanaAddress("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")
    && isValidSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") && isValidSolanaAddress("11111111111111111111111111111111"));
  ok("solana: EVM and Tron addresses refused", !isValidSolanaAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") && !isValidSolanaAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"));
  ok("solana: wrong-length base58 refused", !isValidSolanaAddress("1111111111111111111111111111111") /* 31 zero bytes */ && !isValidSolanaAddress("1".repeat(33)) /* 33 zero bytes */ && !isValidSolanaAddress("1111") /* 4 bytes */);
  ok("solana: garbage refused", !isValidSolanaAddress("hello") && !isValidSolanaAddress("") && !isValidSolanaAddress(null) && !isValidSolanaAddress("0OIl+/="));

  // Lamports <-> SOL (9 decimals)
  ok("solana: lamport conversions", solLamportsToSol(1_500_000_000) === "1.5" && solLamportsToSol(0) === "0.0"
    && solSolToLamports("1.5") === 1_500_000_000n && solSolToLamports("0.000000001") === 1n);
  ok("solana: rent constants", SOLANA_RENT_EXEMPT_LAMPORTS === 890880 && solLamportsToSol(SOLANA_RENT_EXEMPT_LAMPORTS) === "0.00089088"
    && SOLANA_ATA_RENT_LAMPORTS === 2039280);

  // ATA derivation matches @solana/web3.js findProgramAddressSync computed independently here
  {
    const owner = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk", mint = SOLANA_TOKENS[0].address;
    const [expect] = SolPublicKey.findProgramAddressSync(
      [new SolPublicKey(owner).toBuffer(), new SolPublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), new SolPublicKey(mint).toBuffer()],
      new SolPublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")); // the canonical ATA program id, stated independently of core
    ok("solana: ATA derivation matches web3.js PDA", solanaAtaAddress(owner, mint) === expect.toBase58() && isValidSolanaAddress(solanaAtaAddress(owner, mint)));
  }

  // Intent sentence, with and without the ATA-creation disclosure
  const plain = formatSolanaSendIntent({ amount: "2.5", symbol: "SOL", to: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk" });
  ok("solana: intent is human-readable", plain.includes("Send 2.5 SOL") && plain.includes("on Solana") && plain.includes("Confirm?") && !plain.includes("token account"));
  const withAta = formatSolanaSendIntent({ amount: "5", symbol: "USDC", to: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk", createsAta: true });
  ok("solana: intent discloses ATA creation + rent", withAta.includes("creates the recipient's USDC account") && withAta.includes("0.00203928 SOL"));

  // Swap wiring: chain id + native token + SVM step extraction/gating
  ok("solana: LI.FI chain id and native token", SOLANA_LIFI_CHAIN_ID === 1151111081099710 && SOLANA_SWAP_NATIVE_TOKEN === "11111111111111111111111111111111"
    && swapChainOf("solana").chainId === 1151111081099710 && swapChainOf("solana").name === "Solana");
  ok("solana: token constants are the canonical mints", SOLANA_TOKENS[0].address === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" && SOLANA_TOKENS[1].address === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" && SOLANA_TOKENS.every(t => t.decimals === 6));
  const svmRoute = { fromChainId: SOLANA_LIFI_CHAIN_ID, steps: [{ tool: "mayan", transactionRequest: { data: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ==", svmTransactionVersion: 0 } }] };
  ok("solana: SVM route is executable", swapRouteExecutable(svmRoute).ok === true && swapRouteExecutable(svmRoute).svm === true && solanaSwapSteps(svmRoute).length === 1);
  const svmBare = { fromChainId: SOLANA_LIFI_CHAIN_ID, steps: [{ tool: "mayan" }] };
  ok("solana: SVM route without a transaction is refused", swapRouteExecutable(svmBare).ok === false && solanaSwapSteps(svmBare).length === 0);
}

// 27. Phase 2a — Litecoin (BIP84 coin 2) + Dogecoin (BIP44 coin 3).
// Vectors for the canonical abandon…about seed, cross-checked in
// scratch two independent ways before shipping: @scure (this build)
// vs bitcoinjs-lib with the Litecoin/Dogecoin network params — both
// derivations agreed byte-for-byte.
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  ok("litecoin: address vector", litecoinAddress(ABANDON) === "ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh");
  ok("litecoin: own address validates", isValidLitecoinAddress("ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh"));
  ok("litecoin: bitcoin address refused", !isValidLitecoinAddress("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"));
  const ltcIntent = formatLitecoinSendIntent({ amount: "1.5", to: "ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh", feeLtc: "0.00014" });
  ok("litecoin: intent is human-readable", ltcIntent.includes("Send 1.5 LTC") && ltcIntent.includes("on Litecoin") && ltcIntent.includes("Confirm?"));

  ok("dogecoin: address vector", dogecoinAddress(ABANDON) === "DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC");
  ok("dogecoin: own address validates", isValidDogeAddress("DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC"));
  ok("dogecoin: bitcoin/doge-network confusion refused", !isValidDogeAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT") && !isValidDogeAddress("ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh"));
  ok("dogecoin: dust minimum is 0.01 DOGE", DOGE_MIN_OUTPUT === 0.01);

  // Sends (gap-closure build, 2026-11-06): the pure builder's output
  // for a fabricated prev transaction is byte-identical to the
  // transaction cross-checked against bitcoinjs-lib in scratch AND
  // relayed live to Bitcore, whose Dogecoin node answered with its
  // own "Missing inputs" rejection (the relay and the signing are
  // real; the spent UTXO is fabricated, so no funds ever moved).
  {
    const DOGE_NET = { bech32: "doge", pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e };
    const root = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON));
    const child = root.derive("m/44'/3'/0'/0/0");
    const pay = btcSigner.p2pkh(child.publicKey, DOGE_NET);
    const prev = new btcSigner.Transaction();
    prev.addInput({ txid: new Uint8Array(32).fill(7), index: 0xffffffff });
    prev.addOutputAddress(pay.address, 200000000n, DOGE_NET);
    ok("dogecoin: fabricated prev txid (signing fixture)", prev.id === "726f7550ab16d29bc57fc11deb795a93374281f4e13f40a4e64f6791c30cd110");
    const built = buildSignedDogeTx({
      privateKey: child.privateKey,
      utxos: [{ txid: prev.id, index: 0, valueKoinu: 200000000, txHex: prev.hex }],
      to: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L", amountKoinu: 100000000, feeKoinu: 1000000,
      changeAddress: pay.address,
    });
    ok("dogecoin: signed tx byte-identical to the bitcoinjs-lib cross-check + live-relayed bytes",
      built.hex === "010000000110d10cc391674fe6a4403fe1f4814237935a79eb1dc17fc59bd216ab50756f72000000006a47304402207111aaf1e4e4ec8ea07bb8d18731d73f8ac380796f36b515ce60faaf8183251c022060326b99a932cf0797151a874a4db3e6a3be54bea8761778be287c98e12cfd00012102cc6b0dc33aabcf3a23643e5e2919a80c50fb3dd2129ce409bbc5f0d4643d05e0ffffffff0200e1f505000000001976a914830a7420e63d76244ff7cbd1c248e94c1446325988acc09ee605000000001976a9144a483568665dcdfa68dd58a1f62893448a64333988ac00000000"
      && built.txid === "8734540240cd208c505fd6bb056195a76d7f40ed7f3bcf3c002d9e42dd039f10");
    ok("dogecoin: change + fee accounting", built.changeKoinu === 99000000 && built.feeKoinu === 1000000);
    // Dust rules: change below the dust limit folds into the fee
    // instead of creating an unspendable output; amounts below the
    // dust limit are refused outright.
    const folded = buildSignedDogeTx({
      privateKey: child.privateKey,
      utxos: [{ txid: prev.id, index: 0, valueKoinu: 200000000, txHex: prev.hex }],
      to: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L", amountKoinu: 198500000, feeKoinu: 1000000,
      changeAddress: pay.address,
    });
    ok("dogecoin: dust change folds into the fee", folded.changeKoinu === 0 && folded.feeKoinu === 1500000);
    let refused = false;
    try {
      buildSignedDogeTx({ privateKey: child.privateKey, utxos: [{ txid: prev.id, index: 0, valueKoinu: 200000000, txHex: prev.hex }],
        to: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L", amountKoinu: DOGE_DUST_KOINU - 1, feeKoinu: 1000, changeAddress: pay.address });
    } catch { refused = true; }
    ok("dogecoin: sub-dust amount refused", refused);
    ok("dogecoin: legacy size estimate", dogeTxSize(1, 2) === 226 && dogeTxSize(2, 2) === 374);
    const dogeIntent = formatDogeSendIntent({ amount: "1.5", to: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L", feeDoge: "0.00226" });
    ok("dogecoin: intent is human-readable", dogeIntent.includes("Send 1.5 DOGE") && dogeIntent.includes("on Dogecoin") && dogeIntent.includes("Confirm?"));
  }
}

// 28. Phase 2a — Bitcoin Cash (BIP44 coin 145, CashAddr + ForkID sighash).
// Address vectors cross-checked in scratch against bitcore-lib-cash's
// HD derivation and bchaddrjs (legacy<->cash conversions both ways).
// The sighash digest vector was cross-checked against
// bitcore-lib-cash's Transaction.Sighash (its return value is the same
// digest byte-reversed, per bitcore's display convention), and a real
// confirmed mainnet signature (tx 18ea60ef…, block 976217) verifies
// over this implementation's digest — see wallet-core.js notes.
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const hex = (b) => Buffer.from(b).toString("hex");
  const unhex = (h) => Uint8Array.from(Buffer.from(h, "hex"));
  ok("bch: cashaddr vector", bitcoinCashAddress(ABANDON) === "bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6");
  ok("bch: legacy vector", bitcoinCashLegacyAddress(ABANDON) === "1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg");
  const OWN_SCRIPT = "76a914086a977c7dad32a56996af2ce90a727238d4899888ac";
  ok("bch: cashaddr -> script", hex(bchAddressToScript("bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6")) === OWN_SCRIPT);
  ok("bch: prefix-less cashaddr -> same script", hex(bchAddressToScript("qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6")) === OWN_SCRIPT);
  ok("bch: legacy -> same script", hex(bchAddressToScript("1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg")) === OWN_SCRIPT);
  ok("bch: satoshi-era cashaddr vector", hex(bchAddressToScript("bitcoincash:qp63uahgrxged4z5jswyt5dn5v3lzsem6cy4spdc2h")) === "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac");
  ok("bch: address validation", isValidBchAddress("bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6")
    && isValidBchAddress("1mW6fDEMjKrDHvLvoEsaeLxSCzZBf3Bfg")
    && !isValidBchAddress("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu") && !isValidBchAddress("not an address"));

  // Fixed signing scenario (the abandon…about BCH child key).
  const PRIV = unhex("28e9c4f61f735a059af93e0d9aca0b640126c827975841ad83723ccef295e659");
  const PUB = unhex("02bbe7dbcdf8b2261530a867df7180b17a90b482f74f2736b8a30d3f756e42e217");
  const ownScript = unhex(OWN_SCRIPT);
  const outputs = [
    { value: 50000, script: bchAddressToScript("bitcoincash:qrw3am5qe6a6g5wuymmyywyphzpkl6r2svhy9jy2kz") },
    { value: 49000, script: ownScript },
  ];
  const txObj = { version: 2, locktime: 0, inputs: [{ txid: "aa".repeat(32), index: 0, sequence: 0xffffffff }], outputs };
  const digest = bchSighashDigest(txObj, 0, ownScript, 100000);
  ok("bch: ForkID sighash digest vector (bitcore-lib-cash cross-check)",
    hex(digest) === "a55592af3218f16428df44f0223e56f880e3718044a199b79d319b2671e5a3c6");
  // The built transaction's signature must verify over that digest
  // (prehash:false — the digest IS the message; noble v2 prehashes by
  // default, the exact gotcha the pre-ship validation caught).
  const built = buildSignedBchTx({ inputs: [{ txid: "aa".repeat(32), index: 0, value: 100000 }], outputs, privateKey: PRIV, publicKey: PUB, ownScript });
  const raw = unhex(built.hex);
  const ssLen = raw[41]; const scriptSig = raw.slice(42, 42 + ssLen);
  const sigPush = scriptSig[0]; const sigWithType = scriptSig.slice(1, 1 + sigPush);
  ok("bch: built tx carries sighash byte 0x41", sigWithType[sigWithType.length - 1] === 0x41 && raw[0] === 2);
  const der = sigWithType.slice(0, -1);
  const rLen = der[3]; const r = der.slice(4, 4 + rLen); const sOff = 4 + rLen; const sLen = der[sOff + 1]; const s = der.slice(sOff + 2, sOff + 2 + sLen);
  const pad32 = (x) => { const o = new Uint8Array(32); o.set(x.slice(-32), 32 - Math.min(32, x.length)); return o; };
  const compact = Uint8Array.from([...pad32(r), ...pad32(s)]);
  ok("bch: built tx signature verifies over the ForkID digest",
    secp256k1.verify(compact, digest, PUB, { prehash: false }));
}

// 31. Phase 2b — Sui (SLIP-0010 Ed25519, coin type 784, m/44'/784'/0'/0'/0').
// The derivation REUSES the Solana branch's SLIP-0010 implementation —
// only the path and the address encoding differ (BLAKE2b-256 of
// 0x00 || pubkey, hex, instead of Base58 of the pubkey). The address
// vectors below were cross-checked live during the build against
// @mysten/sui's own Ed25519Keypair three ways (deriveKeypair default
// path, deriveKeypair explicit path, fromSecretKey of Fluid's derived
// seed) — the SDK agreement is re-asserted inline here.
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const ABANDON_SUI = "0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1";
  const KNOWN_SUI = "0xc88ef07b9b8b2fc3b7daad9478f4e1337f01792e2eab9c3794494e610636026e";
  ok("sui: abandon…about address vector", suiAddressFromPhrase(ABANDON) === ABANDON_SUI);
  ok("sui: known-phrase address vector", suiAddressFromPhrase(KNOWN_PHRASE) === KNOWN_SUI);
  ok("sui: @mysten/sui deriveKeypair (default path) agrees",
    SuiEd25519Keypair.deriveKeypair(ABANDON).getPublicKey().toSuiAddress() === suiAddressFromPhrase(ABANDON)
    && SuiEd25519Keypair.deriveKeypair(KNOWN_PHRASE).getPublicKey().toSuiAddress() === suiAddressFromPhrase(KNOWN_PHRASE));
  ok("sui: @mysten/sui deriveKeypair (explicit path) agrees",
    SuiEd25519Keypair.deriveKeypair(ABANDON, "m/44'/784'/0'/0'/0'").getPublicKey().toSuiAddress() === ABANDON_SUI);
  ok("sui: @mysten/sui fromSecretKey of Fluid's SLIP-0010 seed agrees",
    SuiEd25519Keypair.fromSecretKey(suiSeedFromSeed(mnemonicToSeedSync(ABANDON))).getPublicKey().toSuiAddress() === ABANDON_SUI);
  ok("sui: seed-level derivation agrees", suiAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_SUI);
  // Independent recomputation of the address recipe from primitives:
  // BLAKE2b-256(0x00 || ed25519 pubkey of the derived seed), hex.
  {
    const pub = ed25519.getPublicKey(suiSeedFromSeed(mnemonicToSeedSync(ABANDON)));
    const digest = blake2b(Uint8Array.from([0, ...pub]), { dkLen: 32 });
    ok("sui: address is blake2b-256(0x00||pubkey)", "0x" + Buffer.from(digest).toString("hex") === ABANDON_SUI);
  }
  ok("sui: address format is 0x + 64 lowercase hex",
    /^0x[0-9a-f]{64}$/.test(suiAddressFromPhrase(ABANDON)) && /^0x[0-9a-f]{64}$/.test(suiAddressFromPhrase(KNOWN_PHRASE)));
  ok("sui: derivation is seed-sensitive and deterministic",
    suiAddressFromPhrase(KNOWN_PHRASE) !== ABANDON_SUI && suiAddressFromPhrase(ABANDON) === suiAddressFromPhrase(ABANDON));

  // Address validation / normalization (Sui pads short forms: "0x2" IS
  // the 0x2 package address, so 1..64 hex digits are valid input)
  ok("sui: valid addresses pass", isValidSuiAddress(ABANDON_SUI) && isValidSuiAddress("0x2") && isValidSuiAddress(KNOWN_SUI.toUpperCase().replace("0X", "0x")));
  ok("sui: normalization pads and lowercases", normalizeSuiAddress("0x2") === "0x0000000000000000000000000000000000000000000000000000000000000002"
    && normalizeSuiAddress(ABANDON_SUI.toUpperCase().replace("0X", "0x")) === ABANDON_SUI);
  ok("sui: oversized and prefix-less forms refused", !isValidSuiAddress("0x" + "a".repeat(65)) && !isValidSuiAddress(ABANDON_SUI.slice(2)) && !isValidSuiAddress("0x"));
  ok("sui: Solana/Tron addresses and garbage refused", !isValidSuiAddress("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")
    && !isValidSuiAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") && !isValidSuiAddress("hello") && !isValidSuiAddress("") && !isValidSuiAddress(null));

  // MIST <-> SUI (9 decimals)
  ok("sui: mist conversions", suiMistToSui(1_500_000_000) === "1.5" && suiMistToSui(0) === "0.0"
    && suiSuiToMist("1.5") === 1_500_000_000n && suiSuiToMist("0.000000001") === 1n && suiSuiToMist("2") === 2_000_000_000n);

  // Token constants — both verified live 2026-11-06 against the
  // fullnode's coin metadata + LI.FI's token list. NOTE: the often-
  // quoted "USDT" type 0x5d4b3025…::coin::COIN is on-chain a USDC
  // (metadata name "USD Coin"); the USDT below reads name "Tether".
  ok("sui: native coin type", SUI_COIN_TYPE === "0x2::sui::SUI");
  ok("sui: token constants are the verified coin types", SUI_TOKENS[0].symbol === "USDC"
    && SUI_TOKENS[0].address === "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
    && SUI_TOKENS[1].symbol === "USDT"
    && SUI_TOKENS[1].address === "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT"
    && SUI_TOKENS.every(t => t.decimals === 6));

  const suiIntent = formatSuiSendIntent({ amount: "2.5", symbol: "SUI", to: ABANDON_SUI });
  ok("sui: intent is human-readable", suiIntent.includes("Send 2.5 SUI") && suiIntent.includes("on Sui") && suiIntent.includes("Confirm?"));

  // Swap wiring: LI.FI chain id (MVM) + native token + direction gating
  ok("sui: LI.FI chain id and native token", SUI_LIFI_CHAIN_ID === 9270000000000000
    && SUI_SWAP_NATIVE_TOKEN === "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
    && swapChainOf("sui").chainId === 9270000000000000 && swapChainOf("sui").name === "Sui");
  const suiRoute = { fromChainId: SUI_LIFI_CHAIN_ID, toChainId: 56, steps: [{ tool: "cetus", transactionRequest: { data: "AAAA" } }] };
  ok("sui: swap routes sourced from Sui are executable (MVM signer)",
    swapRouteExecutable(suiRoute).ok === true && swapRouteExecutable(suiRoute).mvm === true && swapRouteExecutable(suiRoute).steps.length === 1);
  const suiBare = { fromChainId: SUI_LIFI_CHAIN_ID, toChainId: 56, steps: [{ tool: "cetus" }] };
  ok("sui: swap route without a transaction payload is refused",
    swapRouteExecutable(suiBare).ok === false && /no signable transaction/.test(swapRouteExecutable(suiBare).reason));
  const intoSui = { fromChainId: 56, toChainId: SUI_LIFI_CHAIN_ID, steps: [{ transactionRequest: { to: "0xabc", chainId: 56 } }] };
  ok("sui: routes INTO Sui from an EVM chain stay executable", swapRouteExecutable(intoSui).ok === true && swapRouteExecutable(intoSui).steps.length === 1);
}

// 32. Phase 3a — Cosmos (one secp256k1 account, coin type 118,
// m/44'/118'/0'/0/0, seven chains differing only in bech32 prefix) —
// with the settlement fix of 2026-11-06: Injective derives at coin
// type 60 (m/44'/60'/0'/0/0, the Keplr/Leap path) so the same seed
// shows the same inj1 address in Fluid, Keplr and Leap; the other six
// chains still share the 118 account. Gap-closure fix, same day:
// Injective's account bytes are Ethereum-style (keccak), not hash160
// — the @cosmjs address cross-check below was REPLACED for Injective
// by ethers + @injectivelabs/sdk-ts evidence (see the block).
// Vectors for the canonical abandon…about seed: the account bytes were
// computed with Fluid's @scure derivation and cross-checked live
// during the build against both @cosmjs (below, re-asserted) and live
// chain reads (the Hub address holds 3 uatom and the Sei address 1050
// usei of third-party dust at the well-known test addresses, read back
// through both the public REST and a StargateClient over RPC).
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const VECTORS = {
    cosmoshub: "cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4", osmosis: "osmo19rl4cm2hmr8afy4kldpxz3fka4jguq0a5m7df8",
    noble: "noble19rl4cm2hmr8afy4kldpxz3fka4jguq0a5rc48m", celestia: "celestia19rl4cm2hmr8afy4kldpxz3fka4jguq0ad2ud9c",
    injective: "inj1npvwllfr9dqr8erajqqr6s0vxnk2ak55re90dz", sei: "sei19rl4cm2hmr8afy4kldpxz3fka4jguq0a3vute5",
    dydx: "dydx19rl4cm2hmr8afy4kldpxz3fka4jguq0a4erelz",
  };
  const addrs = cosmosAddresses(ABANDON);
  for (const [key, addr] of Object.entries(VECTORS)) {
    ok(`cosmos: ${key} address vector`, addrs[key] === addr && cosmosAddress(ABANDON, key) === addr);
  }
  // Six chains (coin type 118) share identical account bytes under
  // every prefix; Injective (coin type 60) has its own account bytes.
  {
    const bytesOf = (a) => {
      const dec = bech32.decode(a);
      return Buffer.from(bech32.fromWords(dec.words)).toString("hex");
    };
    const six = ["cosmoshub", "osmosis", "noble", "celestia", "sei", "dydx"].map(k => bytesOf(addrs[k]));
    ok("cosmos: same account bytes on the six 118 chains",
      six.every(h => h === "28ff5c6d57d8cfd492b6fb42614536ed648e01fd"));
    ok("cosmos: Injective (60) account bytes are its Ethereum address bytes",
      bytesOf(addrs.injective) === "9858effd232b4033e47d90003d41ec34ecaeda94");
  }
  // Cross-check against @cosmjs derivation, two prefixes (the brief's bar)
  const HD = [Slip10RawIndex.hardened(44), Slip10RawIndex.hardened(118), Slip10RawIndex.hardened(0), Slip10RawIndex.normal(0), Slip10RawIndex.normal(0)]; // m/44'/118'/0'/0/0
  for (const prefix of ["cosmos", "osmo"]) {
    const w = await DirectSecp256k1HdWallet.fromMnemonic(ABANDON, { prefix, hdPaths: [HD] });
    const [acc] = await w.getAccounts();
    const key = prefix === "cosmos" ? "cosmoshub" : "osmosis";
    ok(`cosmos: @cosmjs derivation agrees (${prefix})`, acc.address === addrs[key]);
  }
  // The signer sendCosmos actually uses — CosmJS built FROM Fluid's key
  {
    const root = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON));
    const child = root.derive("m/44'/118'/0'/0/0");
    const w = await DirectSecp256k1Wallet.fromKey(child.privateKey, "cosmos");
    const [acc] = await w.getAccounts();
    ok("cosmos: DirectSecp256k1Wallet from Fluid's key gives Fluid's address", acc.address === addrs.cosmoshub);
    ok("cosmos: signer pubkey is Fluid's derived pubkey", Buffer.from(acc.pubkey).toString("hex") === Buffer.from(child.publicKey).toString("hex"));
  }
  // Injective cross-checks at coin type 60. @cosmjs CANNOT pin the
  // ADDRESS: DirectSecp256k1 wallets always derive hash160 addresses,
  // which is the Cosmos rule Injective breaks — that mismatch is
  // what shipped as Fluid's original (wrong) inj address. What
  // @cosmjs pins is the KEY (same private key → same pubkey). The
  // ADDRESS is pinned against two independent Ethereum derivations:
  // ethers.computeAddress here, and @injectivelabs/sdk-ts in the
  // gap-closure scratch work (inj1npvwll…, matching the account
  // record injective-1 itself stores for this pubkey).
  {
    const root = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON));
    const child60 = root.derive("m/44'/60'/0'/0/0");
    const w2 = await DirectSecp256k1Wallet.fromKey(child60.privateKey, "inj");
    const [acc2] = await w2.getAccounts();
    ok("cosmos: signer pubkey at coin type 60 is Fluid's derived pubkey",
      Buffer.from(acc2.pubkey).toString("hex") === Buffer.from(child60.publicKey).toString("hex"));
    ok("cosmos: @cosmjs hash160 address is NOT Fluid's Injective address (documented divergence)",
      acc2.address === "inj1gsvdpdxec8hsu57lhxg5xem7refr233zkczfgv" && acc2.address !== addrs.injective);
    const ethAddr = ethers.computeAddress("0x" + Buffer.from(child60.privateKey).toString("hex"));
    ok("cosmos: ethers-derived Ethereum address matches the Injective account bytes",
      ethAddr.toLowerCase() === "0x9858effd232b4033e47d90003d41ec34ecaeda94");
    ok("cosmos: injectiveAddressBytes is the Ethereum derivation",
      Buffer.from(injectiveAddressBytes(child60.publicKey)).toString("hex") === "9858effd232b4033e47d90003d41ec34ecaeda94");
  }
  // Injective signed-transaction vector (gap-closure build): the
  // hand-rolled signer reproduces, byte for byte, the transaction
  // @injectivelabs/sdk-ts built for the same inputs (account number
  // and sequence are the test account's live-read values), and the
  // same transaction that reached the funds stage — and only the
  // funds stage — in the live injective-1 simulate.
  {
    const root = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON));
    const child60 = root.derive("m/44'/60'/0'/0/0");
    const built = buildInjectiveSignedTx({
      privateKey: child60.privateKey, publicKey: child60.publicKey,
      fromAddress: VECTORS.injective, toAddress: "inj1gsvdpdxec8hsu57lhxg5xem7refr233zkczfgv",
      denom: "inj", amountBase: "1000", feeAmountBase: "16000000000000", gasLimit: 100000,
      accountNumber: "1680321", sequence: "2",
    });
    ok("injective: signed tx byte-identical to @injectivelabs/sdk-ts output",
      Buffer.from(built.txBytes).toString("hex") === "0a88010a85010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412650a2a696e6a316e7076776c6c667239647172386572616a71717236733076786e6b32616b353572653930647a122a696e6a316773766470647865633868737535376c6878673578656d37726566723233337a6b637a6667761a0b0a03696e6a120431303030127d0a5e0a540a2d2f696e6a6563746976652e63727970746f2e763162657461312e657468736563703235366b312e5075624b657912230a210237b0bb7a8288d38ed49a524b5dc98cff3eb5ca824c9f9dc0dfdb3d9cd600f29912040a0208011802121b0a150a03696e6a120e313630303030303030303030303010a08d061a40aed8aca4946263458df9f77f1f5cdc98e6e3552003704ccd33aa4989f4e04b190b17a0a39066a4d5b5d2a893fe0023b93a9bb51f1448351ea0c117f2174e122d");
    ok("injective: tx hash is sha256 of the signed bytes",
      Buffer.from(nobleSha256(built.txBytes)).toString("hex").toUpperCase() === "8D32E273C668241BAB0778E93D0B287CE82BE8C49079A20D5CBEEBC9386FAC98");
    // The EthAccount digest rule, proven locally with noble: the
    // signature verifies over keccak256(SignDoc) and NOT sha256.
    ok("injective: signature verifies over keccak256(SignDoc)",
      secp256k1.verify(built.signature, keccak_256(built.signDocBytes), child60.publicKey, { prehash: false }) === true);
    ok("injective: signature does NOT verify over sha256(SignDoc)",
      secp256k1.verify(built.signature, nobleSha256(built.signDocBytes), child60.publicKey, { prehash: false }) === false);
    ok("injective: pubkey type URL is the EthAccount one",
      INJECTIVE_PUBKEY_TYPE === "/injective.crypto.v1beta1.ethsecp256k1.PubKey");
  }
  // Chain table pins — every value verified against the chain registry
  // (chain ids, prefixes, denoms, decimals) before shipping.
  ok("cosmos: seven chains", COSMOS_CHAINS.length === 7);
  ok("cosmos: chain ids", COSMOS_CHAINS.map(c => c.chainId).join(",") === "cosmoshub-4,osmosis-1,noble-1,celestia,injective-1,pacific-1,dydx-mainnet-1");
  ok("cosmos: denoms", COSMOS_CHAINS.map(c => c.denom).join(",") === "uatom,uosmo,uusdc,utia,inj,usei,adydx");
  ok("cosmos: decimals (INJ and DYDX are 18, the rest 6)", COSMOS_CHAINS.map(c => c.decimals).join(",") === "6,6,6,6,18,6,18");
  ok("cosmos: noble asset is USDC (uusdc — also its fee token)",
    cosmosChain("noble").symbol === "USDC" && cosmosChain("noble").denom === "uusdc" && cosmosChain("noble").gasPrice === "0.1uusdc");
  ok("cosmos: all seven chains have sends enabled (no receive-only chains)",
    COSMOS_CHAINS.every(c => c.sendEnabled !== false));
  ok("cosmos: Injective derives at coin type 60, the other six at the 118 default",
    cosmosChain("injective").coinType === 60 && COSMOS_CHAINS.filter(c => c.key !== "injective").every(c => (c.coinType || 118) === 118));
  ok("cosmos: unknown chain resolves to null", cosmosChain("nope") === null);

  // Address validation is per-chain: right prefix + checksum + payload
  ok("cosmos: own addresses validate", COSMOS_CHAINS.every(c => isValidCosmosAddress(addrs[c.key], c.key)));
  ok("cosmos: cross-chain prefixes refused", !isValidCosmosAddress(addrs.cosmoshub, "osmosis") && !isValidCosmosAddress(addrs.osmosis, "cosmoshub")
    && !isValidCosmosAddress(addrs.injective, "sei"));
  ok("cosmos: other families and garbage refused", !isValidCosmosAddress("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "cosmoshub")
    && !isValidCosmosAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "cosmoshub")
    && !isValidCosmosAddress("cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", "cosmoshub") // plausible shape, bad checksum
    && !isValidCosmosAddress("hello", "cosmoshub") && !isValidCosmosAddress("", "cosmoshub") && !isValidCosmosAddress(null, "cosmoshub"));

  const ci = formatCosmosSendIntent({ amount: "1.5", symbol: "ATOM", to: VECTORS.cosmoshub, chainName: "Cosmos Hub", feeAmount: "0.0035", feeSymbol: "ATOM" });
  ok("cosmos: intent is human-readable", ci.includes("Send 1.5 ATOM") && ci.includes("on Cosmos Hub") && ci.includes("fee about 0.0035 ATOM") && ci.includes("Confirm?"));

  // Cosmos is honestly ABSENT from the LI.FI swap universe (LI.FI has
  // no Cosmos-SDK chains) — no dead swap options are offered.
  ok("cosmos: not a LI.FI swap chain", swapChainOf("cosmoshub") === null && swapChainOf("osmosis") === null);
}

// 23. Universal token support (discovery helpers, pure logic)
{
  ok("chunkArray splits evenly", JSON.stringify(chunkArray([1, 2, 3, 4, 5], 2)) === "[[1,2],[3,4],[5]]");
  ok("chunkArray degenerate sizes", chunkArray([], 3).length === 0 && chunkArray([1], 0).length === 1);
  ok("formatTokenAmount respects decimals", formatTokenAmount(1500000n, 6) === "1.5" && formatTokenAmount("2500000000000000000", 18) === "2.5");
  ok("shortAddrLabel shortens long ids", shortAddrLabel("0x1234567890abcdef1234567890abcdef12345678") === "0x1234…5678" && shortAddrLabel("SUI") === "SUI");
  ok("multicall3 address is the canonical deployment", MULTICALL3_ADDRESS === "0xcA11bde05977b3631167028862bE2a173976CA11");
  ok("dex chain ids map the majors", dexChainIdForEvmChain(56) === "bsc" && dexChainIdForEvmChain(1) === "ethereum"
     && dexChainIdForEvmChain(137) === "polygon" && dexChainIdForEvmChain(999999) === null);

  // DexScreener selection: the live magnitude cluster must beat a dead
  // pool with phantom liquidity at the wrong price (observed live with
  // BONK: two stale Meteora pools quoted ~4,900× the market).
  const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
  const dex = { pairs: [
    { chainId: "solana", baseToken: { address: MINT, name: "Bonk", symbol: "Bonk" }, priceUsd: "0.01428", liquidity: { usd: 34076547 }, volume: { h24: 159414 } },
    { chainId: "solana", baseToken: { address: MINT, name: "Bonk", symbol: "Bonk" }, priceUsd: "0.000002899", liquidity: { usd: 285472 }, volume: { h24: 263028 } },
    { chainId: "solana", baseToken: { address: MINT, name: "Bonk", symbol: "Bonk" }, priceUsd: "0.000002888", liquidity: { usd: 246724 }, volume: { h24: 324424 } },
    { chainId: "ethereum", baseToken: { address: MINT, name: "Bonk", symbol: "Bonk" }, priceUsd: "5", liquidity: { usd: 1e9 }, volume: { h24: 1e9 } },
    { chainId: "solana", baseToken: { address: "SomeOtherMint1111111111111111111111111111111", name: "X", symbol: "X" },
      quoteToken: { address: MINT, name: "Bonk", symbol: "Bonk" }, priceUsd: "9", liquidity: { usd: 1e9 }, volume: { h24: 1e9 } },
  ] };
  const dexMap = parseDexScreenerPairs(dex, "solana", [MINT]);
  ok("dexscreener: live cluster price wins over phantom-liquidity dead pool",
     dexMap.get(MINT.toLowerCase())?.priceUsd === 0.000002888); // parser keys are lowercased
  const noDex = parseDexScreenerPairs(dex, "bsc", [MINT]);
  ok("dexscreener: other chains ignored", noDex.size === 0);

  // LI.FI verification status: "flagged" is the one explicit distrust.
  ok("lifi verified: normal token", lifiTokenVerified({ verificationStatus: "verified" }) === true);
  ok("lifi verified: no status still listed", lifiTokenVerified({}) === true);
  ok("lifi verified: flagged is unverified", lifiTokenVerified({ verificationStatus: "flagged" }) === false);
  ok("lifi verified: null token is unverified", lifiTokenVerified(null) === false);

  // Cosmos denom display: native / registry / IBC / factory / u-prefix.
  const hub = cosmosChain("cosmoshub");
  const dNative = cosmosDenomDisplay(hub, "uatom", null);
  ok("cosmos denom: native is named + verified", dNative.symbol === "ATOM" && dNative.verified === true && dNative.decimals === 6);
  const dMeta = cosmosDenomDisplay(hub, "ibc/ABC123", { symbol: "USDC", name: "USD Coin", decimals: 6 });
  ok("cosmos denom: registry meta beats the IBC label", dMeta.symbol === "USDC" && dMeta.verified === true);
  const dIbc = cosmosDenomDisplay(hub, "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2", null);
  ok("cosmos denom: unknown IBC hash is labelled, unverified", dIbc.symbol === "IBC token" && dIbc.verified === false && dIbc.ibc === true);
  const dU = cosmosDenomDisplay(hub, "uxprt", null);
  ok("cosmos denom: u-prefix micro heuristic", dU.symbol === "XPRT" && dU.decimals === 6 && dU.verified === false);
  const dFactory = cosmosDenomDisplay(hub, "factory/cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf3ek/ufoo", null);
  ok("cosmos denom: factory subdenom label", dFactory.symbol === "UFOO" && dFactory.verified === false);

  // Sui coin-type fallback names: the struct name (third segment).
  ok("sui fallback: struct name from the coin type", suiCoinFallbackSymbol("0xabc::deep::DEEP") === "DEEP");
  ok("sui fallback: malformed type gets a neutral label", suiCoinFallbackSymbol("garbage") === "COIN");

  // Tron constant-call string decoding: dynamic string + bytes32 forms.
  const dyn = "0000000000000000000000000000000000000000000000000000000000000020"
    + "000000000000000000000000000000000000000000000000000000000000000a"
    + "54657468657220555344" + "0".repeat(44);
  ok("tron abi string: dynamic form", tronDecodeAbiString("0x" + dyn) === "Tether USD");
  const b32 = Buffer.from("USDT", "utf8").toString("hex").padEnd(64, "0");
  ok("tron abi string: bytes32 form", tronDecodeAbiString("0x" + b32) === "USDT");

  // Solana Token-2022 ATA: program-aware derivation matches web3.js
  // with the Tokenz program, and differs from the legacy ATA.
  const TOKENZ = new SolPublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  const ATAPROG = new SolPublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const owner = new SolPublicKey("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
  const mint = new SolPublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const expect22 = SolPublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKENZ.toBuffer(), mint.toBuffer()], ATAPROG)[0].toBase58();
  ok("solana ATA: Token-2022 derivation matches web3.js",
     solanaAtaAddress(owner.toBase58(), mint.toBase58(), SOLANA_TOKEN2022_PROGRAM) === expect22);
  ok("solana ATA: Token-2022 ATA differs from legacy",
     solanaAtaAddress(owner.toBase58(), mint.toBase58(), SOLANA_TOKEN2022_PROGRAM)
       !== solanaAtaAddress(owner.toBase58(), mint.toBase58()));
}

// ---------- Solana ATA reads: balances without indexed RPC methods ----------
// (2026-11-08) The keyless endpoints that serve browsers refuse the
// indexed token methods (getTokenAccountsByOwner with ANY filter —
// and the old { mint, programId } pair was rejected by the RPC
// itself), so curated reads derive the ATA locally, read it with
// plain getAccountInfo, and parse the amount out of the account
// bytes. A refused read must surface as failure/unknown, never as a
// fake zero. Fetch is stubbed and answers JSON-RPC by request body.
{
  const { getSolanaTokenBalance, getSolanaBalances, parseSolanaTokenAccountAmount, SOLANA_TOKEN_PROGRAM, SOLANA_TOKEN2022_PROGRAM } =
    await import("../src/wallet-core.js");
  const OWNER = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  // A 165-byte SPL token account fixture: mint | owner | amount u64 LE @64.
  const tokenAccountBytes = (mintB58, ownerB58, raw) => {
    const b = Buffer.alloc(165);
    Buffer.from(new SolPublicKey(mintB58).toBytes()).copy(b, 0);
    Buffer.from(new SolPublicKey(ownerB58).toBytes()).copy(b, 32);
    b.writeBigUInt64LE(BigInt(raw), 64);
    return b;
  };
  ok("solana ata read: amount parses from the account bytes (offset 64, u64 LE)",
    parseSolanaTokenAccountAmount(tokenAccountBytes(USDC, OWNER, 1109540000n)) === 1109540000n);
  ok("solana ata read: short/garbage bytes parse to null, not a number",
    parseSolanaTokenAccountAmount(Buffer.alloc(10)) === null && parseSolanaTokenAccountAmount(null) === null);
  const accountEntry = (mintB58, ownerB58, raw, program) => ({
    lamports: 2039280, owner: program, executable: false,
    data: [tokenAccountBytes(mintB58, ownerB58, raw).toString("base64"), "base64"],
  });
  const realFetch = globalThis.fetch;
  const rpcStub = (accounts, failAccounts = false) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    const reply = (result) => ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) });
    if (body.method === "getBalance") return reply({ value: 0 });
    if (body.method === "getAccountInfo") {
      if (failAccounts) throw new Error("endpoint down");
      return reply({ value: accounts.get(body.params[0]) || null });
    }
    throw new Error("unexpected method " + body.method);
  };
  try {
    // USDC held under the legacy program: 1,109,540,000 raw = 1109.54.
    globalThis.fetch = rpcStub(new Map([
      [solanaAtaAddress(OWNER, USDC), accountEntry(USDC, OWNER, 1109540000n, SOLANA_TOKEN_PROGRAM)],
    ]));
    ok("solana ata read: legacy ATA balance reads through getAccountInfo",
      (await getSolanaTokenBalance(OWNER, USDC, 6)) === "1109.54");
    ok("solana ata read: an unheld mint is a true zero (no ATA anywhere)",
      (await getSolanaTokenBalance(OWNER, USDT, 6)) === "0.0");
    const rows = await getSolanaBalances(OWNER);
    ok("solana ata read: balance list carries the ATA-read amounts",
      rows.find(r => r.address === USDC)?.amount === "1109.54" && rows.find(r => r.address === USDT)?.amount === "0.0");
    // USDT held ONLY under Token-2022: the legacy probe finds no
    // account, the 2022 probe finds the funds.
    globalThis.fetch = rpcStub(new Map([
      [solanaAtaAddress(OWNER, USDT, SOLANA_TOKEN2022_PROGRAM), accountEntry(USDT, OWNER, 2500000n, SOLANA_TOKEN2022_PROGRAM)],
    ]));
    ok("solana ata read: Token-2022 ATA is probed when the legacy one is absent",
      (await getSolanaTokenBalance(OWNER, USDT, 6)) === "2.5");
    // Every endpoint down: failure must NOT collapse into "0".
    globalThis.fetch = rpcStub(new Map(), true);
    await assert.rejects(() => getSolanaTokenBalance(OWNER, USDC, 6));
    ok("solana ata read: transport failure throws instead of returning a fake zero", true);
    const failRows = await getSolanaBalances(OWNER);
    ok("solana ata read: balance list marks a failed token read unknown (null), never zero",
      failRows.find(r => r.address === USDC)?.amount === null
      && failRows.find(r => r.address === USDT)?.amount === null
      && failRows[0].amount === "0.0");
  } finally { globalThis.fetch = realFetch; }
  const appSrcSol = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("solana send sheet: the confirm passes the token's program to sendSolana",
    appSrcSol.includes("token: tok.address ? { address: tok.address, decimals: tok.decimals, program: tok.program } : null"));
  ok("renderMain: the render snapshots the wallet and abandons itself after a mid-render lock",
    appSrcSol.includes("const w = wallet;") && appSrcSol.includes("if (wallet !== w) return;"));
  ok("solana scan copy: endpoint refusal is stated honestly, not blamed on the connection",
    appSrcSol.includes("isn't available from the free public Solana endpoints")
    && appSrcSol.includes("the free public Solana endpoints aren't serving full scans"));
}

// 32b. UTXO altcoin + Tron/Stellar honesty (live home-screen sweep of
// build 459d3740bf): the same defect class as the Solana fix above —
// a family read fails in a real browser and the UI silently shows 0.
// dogechain is CORS-blocked from the live origin, so DOGE's read
// falls back to BlockCypher (its DOGE and LTC endpoints were verified
// browser-viable live from the live origin; chain.so is CORS-blocked
// too and is deliberately NOT used). Both sources failing must THROW
// so the app can show "couldn't load" (family alert + failed row)
// instead of a fake zero. Fetch is stubbed with per-source fixtures.
{
  const { getDogecoinBalance, getLitecoinBalance, parseBlockcypherBalance, getStellarAccount, stellarAddressFromPhrase } =
    await import("../src/wallet-core.js");
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const DOGE_ADDR = "DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC";
  const LTC_ADDR = "ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh";
  ok("blockcypher parse: final_balance satoshis become whole coins",
    parseBlockcypherBalance({ final_balance: 123456789 }) === 1.23456789
    && parseBlockcypherBalance({ balance: 200000000 }) === 2);
  let badShape = false;
  try { parseBlockcypherBalance({}); } catch { badShape = true; }
  ok("blockcypher parse: a garbled reply throws instead of becoming a number", badShape);
  const realFetch = globalThis.fetch;
  const jsonRes = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  try {
    // dogechain answers: its own shape wins, no fallback call.
    globalThis.fetch = async (url) => {
      if (String(url).includes("dogechain.com")) return jsonRes({ balance: "42.5" });
      throw new Error("fallback must not be called");
    };
    ok("doge balance: dogechain shape parses", (await getDogecoinBalance(DOGE_ADDR)) === 42.5);
    // dogechain dies the way CORS kills it (fetch rejects outright):
    // BlockCypher's fixture shape takes over (final_balance in koinu).
    globalThis.fetch = async (url) => {
      if (String(url).includes("dogechain.com")) throw new TypeError("Failed to fetch");
      if (String(url).includes("api.blockcypher.com/v1/doge/")) return jsonRes({ address: DOGE_ADDR, final_balance: 315000000, balance: 300000000 });
      throw new Error("unexpected url " + url);
    };
    ok("doge balance: CORS-dead primary falls back to BlockCypher final_balance",
      (await getDogecoinBalance(DOGE_ADDR)) === 3.15);
    // Both dead: the read rejects — the app shows "couldn't load".
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(() => getDogecoinBalance(DOGE_ADDR));
    ok("doge balance: total failure throws instead of returning a fake zero", true);
    // LTC: litecoinspace (Esplora) shape is the primary read...
    globalThis.fetch = async (url) => {
      if (String(url).includes("litecoinspace.org")) return jsonRes({ chain_stats: { funded_txo_sum: 55210668, spent_txo_sum: 210668 }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 } });
      throw new Error("fallback must not be called");
    };
    ok("ltc balance: litecoinspace funded-minus-spent parses", (await getLitecoinBalance(LTC_ADDR)) === 0.55);
    // ...and BlockCypher takes over when Esplora dies.
    globalThis.fetch = async (url) => {
      if (String(url).includes("litecoinspace.org")) throw new TypeError("Failed to fetch");
      if (String(url).includes("api.blockcypher.com/v1/ltc/")) return jsonRes({ address: LTC_ADDR, final_balance: 55000000 });
      throw new Error("unexpected url " + url);
    };
    ok("ltc balance: dead primary falls back to BlockCypher", (await getLitecoinBalance(LTC_ADDR)) === 0.55);
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(() => getLitecoinBalance(LTC_ADDR));
    ok("ltc balance: total failure throws instead of returning a fake zero", true);
    // Stellar dedupe: two CONCURRENT account reads share ONE Horizon
    // request (the double-render duplicate that used to trip the
    // failure flag); a 404 still reads as unfunded/zero, not failure.
    let horizonCalls = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes("horizon.stellar.org/accounts/")) { horizonCalls++; return { status: 404, json: async () => ({}) }; }
      throw new Error("unexpected url " + url);
    };
    const XLM_ADDR = stellarAddressFromPhrase(ABANDON);
    const [a1, a2] = await Promise.all([getStellarAccount(XLM_ADDR), getStellarAccount(XLM_ADDR)]);
    ok("stellar: concurrent account reads are deduped to one Horizon request",
      horizonCalls === 1 && a1.funded === false && a2.funded === false && a1.balances[0].amount === "0");
  } finally { globalThis.fetch = realFetch; }
  const appSrcAlt = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("altcoin honesty: failed LTC/DOGE/BCH reads raise family alerts",
    appSrcAlt.includes("m.litecoin = \"Litecoin balances couldn't be loaded right now.\"")
    && appSrcAlt.includes("m.dogecoin = \"Dogecoin balances couldn't be loaded right now.\"")
    && appSrcAlt.includes("m.bitcoincash = \"Bitcoin Cash balances couldn't be loaded right now.\""));
  ok("altcoin honesty: failed reads render the couldn't-load row state, not zero",
    appSrcAlt.includes("scalarAmtHtml(ltcLoadFailed, ltcBal, prices.LTC)")
    && appSrcAlt.includes("scalarAmtHtml(dogeLoadFailed, dogeBal, prices.DOGE)")
    && appSrcAlt.includes("scalarAmtHtml(bchLoadFailed, bchBal, prices.BCH)"));
  ok("tron honesty: total read failure marks the curated rows unknown and alerts on the load, not the scan",
    appSrcAlt.includes("m.tron = \"Main Tron balances couldn't be loaded right now.\"")
    && appSrcAlt.includes("tronBalances = tronBalances.map(b => ({ ...b, amount: null }))"));
}

// 33. Phase 3b — Stellar (SLIP-0010 Ed25519, coin type 148,
// m/44'/148'/0'). Vectors cross-checked three independent ways:
// Fluid's SLIP-0010 + hand-rolled StrKey codec (below), the
// @stellar/stellar-sdk Keypair built from the same raw seed bytes,
// and the SDK's StrKey encoder over the noble public key. The USDC
// issuer constant is Circle's, verified live against
// horizon.stellar.org/assets (exactly one record, ~2.53M accounts).
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const ABANDON_XLM = "GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX";
  const KNOWN_XLM = "GCRN5PMAG5FM5QLCH7BUZPRQ7UIW37LBZLF2BIDEOSG4ZQ6HYRC45ALA";
  ok("stellar: abandon…about address vector", stellarAddressFromPhrase(ABANDON) === ABANDON_XLM);
  ok("stellar: known-phrase address vector", stellarAddressFromPhrase(KNOWN_PHRASE) === KNOWN_XLM);
  ok("stellar: @stellar/stellar-sdk Keypair from the raw seed agrees",
    StellarKeypair.fromRawEd25519Seed(stellarSeedFromSeed(mnemonicToSeedSync(ABANDON))).publicKey() === ABANDON_XLM
    && StellarKeypair.fromRawEd25519Seed(stellarSeedFromSeed(mnemonicToSeedSync(KNOWN_PHRASE))).publicKey() === KNOWN_XLM);
  ok("stellar: SDK StrKey over the noble pubkey agrees",
    StellarStrKey.encodeEd25519PublicKey(Buffer.from(ed25519.getPublicKey(stellarSeedFromSeed(mnemonicToSeedSync(ABANDON))))) === ABANDON_XLM);
  ok("stellar: seed-level derivation agrees", stellarAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_XLM);
  ok("stellar: StrKey decode round-trips against the SDK",
    Buffer.from(StellarStrKey.decodeEd25519PublicKey(ABANDON_XLM)).equals(Buffer.from(strKeyDecodeEd25519(ABANDON_XLM)))
    && Buffer.from(strKeyDecodeEd25519(KNOWN_XLM)).equals(Buffer.from(ed25519.getPublicKey(stellarSeedFromSeed(mnemonicToSeedSync(KNOWN_PHRASE))))));
  ok("stellar: address format is a 56-char G… StrKey", /^G[A-Z2-7]{55}$/.test(ABANDON_XLM) && ABANDON_XLM.length === 56);
  const tampered = ABANDON_XLM.slice(0, 20) + (ABANDON_XLM[20] === "A" ? "B" : "A") + ABANDON_XLM.slice(21);
  ok("stellar: tampered checksum refused", !isValidStellarAddress(tampered) && strKeyDecodeEd25519(tampered) === null);
  ok("stellar: valid addresses pass", isValidStellarAddress(ABANDON_XLM) && isValidStellarAddress(KNOWN_XLM));
  ok("stellar: secret seeds and other families refused",
    !isValidStellarAddress(StellarKeypair.fromRawEd25519Seed(stellarSeedFromSeed(mnemonicToSeedSync(ABANDON))).secret())
    && !isValidStellarAddress("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk")
    && !isValidStellarAddress("0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1")
    && !isValidStellarAddress("hello") && !isValidStellarAddress("") && !isValidStellarAddress(null));
  // CRC16-XModem standard check value: CRC("123456789") = 0x31C3.
  ok("stellar: crc16-xmodem check value", crc16Xmodem(new TextEncoder().encode("123456789")) === 0x31c3);
  ok("stellar: stroop conversions", xlmToStroops("1.5") === 15000000n && xlmToStroops("0.0000001") === 1n
    && stroopsToXlm(15000000n) === "1.5" && stroopsToXlm(100n) === "0.00001");
  ok("stellar: minimum balance formula", stellarMinBalanceXlm(0) === "1.0" && stellarMinBalanceXlm(1) === "1.5"
    && stellarMinBalanceXlm(4) === "3.0" && stellarMinBalanceStroops(0) === 10000000n && stellarMinBalanceStroops(3) === 25000000n);
  ok("stellar: USDC is Circle's issuer", STELLAR_USDC.issuer === "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
    && STELLAR_USDC.code === "USDC" && STELLAR_USDC_ISSUER === STELLAR_USDC.issuer);
  const xlmIntent = formatStellarSendIntent({ amount: "2.5", symbol: "XLM", to: ABANDON_XLM, feeXlm: "0.00001" });
  ok("stellar: intent is human-readable", xlmIntent.includes("Send 2.5 XLM") && xlmIntent.includes("on Stellar")
    && xlmIntent.includes("Network fee ≈ 0.00001 XLM") && xlmIntent.includes("Confirm?"));
  const createIntent = formatStellarSendIntent({ amount: "1", symbol: "XLM", to: KNOWN_XLM, feeXlm: "0.00001", createsAccount: true });
  ok("stellar: intent discloses account creation", createIntent.includes("creates the recipient's account"));
  // LI.FI's public chain list (fetched live 2026-11-06: 70 chains —
  // EVM/SVM/UTXO/MVM/TVM) contains NO Stellar chain, so there is
  // deliberately no swap registration for the family.
  ok("stellar: no swap chain registered", swapChainOf("stellar") === null);
}

// 34. Phase 4 — payments-grade families: TON, NEAR, Algorand,
// XRP Ledger, Polkadot Asset Hub. Every family's derivation was
// cross-checked during development against an independent
// implementation (tonweb / ed25519-hd-key / algosdk /
// ripple-address-codec / entropy-route PBKDF2) and every signature
// scheme against a second implementation or a live vector; the
// checks below pin those results so they can never silently drift.
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  // ----- TON (SLIP-0010 coin 607, Wallet V4R2) -----
  const ABANDON_TON = "EQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-U9d";
  const KNOWN_TON = "EQAtUn6khf4MxnAB4aQNcDlUPNOsLtU8IOVZbIabFzw9Kbar";
  ok("ton: abandon…about address vector", tonAddressFromPhrase(ABANDON) === ABANDON_TON);
  ok("ton: known-phrase address vector", tonAddressFromPhrase(KNOWN_PHRASE) === KNOWN_TON);
  ok("ton: seed-level derivation agrees", tonAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_TON);
  // Independent address path: rebuild the StateInit address from the
  // contract's code+data with @ton/core's contractAddress — a
  // different code path from WalletContractV4's own .address.
  {
    const kp = tonKeyPairFromSeed(Buffer.from(tonSeedFromSeed(mnemonicToSeedSync(ABANDON))));
    const w = TonWalletV4.create({ publicKey: kp.publicKey, workchain: 0 });
    const rebuilt = tonContractAddress(0, w.init).toString({ bounceable: true, urlSafe: true });
    ok("ton: @ton/core contractAddress over the StateInit agrees", rebuilt === ABANDON_TON);
    ok("ton: noble pubkey agrees with @ton/crypto", Buffer.from(ed25519.getPublicKey(tonSeedFromSeed(mnemonicToSeedSync(ABANDON)))).equals(kp.publicKey));
    // Signing: @ton/ton's createTransfer signature must verify under
    // noble over a signing message rebuilt BY HAND (walletId,
    // timeout, seqno, extended-action op 0, per-message send mode +
    // ref) — the exact bytes the wallet contract checks on-chain.
    const dest = TonAddr.parse(TON_USDT_MASTER);
    const m = tonInternalMsg({ to: dest, value: 100000000n, bounce: false });
    const body = w.createTransfer({ seqno: 0, secretKey: kp.secretKey, timeout: 1700000000, sendMode: 3, messages: [m] });
    const sig = body.beginParse().loadBuffer(64);
    const signing = tonBeginCell().storeUint(w.walletId, 32).storeUint(1700000000, 32).storeUint(0, 32)
      .storeUint(0, 8).storeUint(3, 8).storeRef(tonBeginCell().store(tonStoreMessageRelaxed(m)).endCell()).endCell();
    ok("ton: createTransfer signature verifies over the hand-built signing message",
      ed25519.verify(sig, signing.hash(), kp.publicKey));
    // Jetton transfer body: TEP-74 op + fields decode back out.
    const jb = tonJettonTransferBody({ amountRaw: 1000000n, to: ABANDON_TON, responseTo: ABANDON_TON });
    const js = jb.beginParse();
    ok("ton: jetton body carries op 0xf8a7ea5 and the amount",
      js.loadUint(32) === 0xf8a7ea5 && (js.loadUint(64), js.loadCoins()) === 1000000n);
  }
  ok("ton: valid addresses pass (friendly + raw)", isValidTonAddress(ABANDON_TON)
    && isValidTonAddress("0:B2F18D7C8A26FAAA0F064B3A2E2873B1368A7A7DED502D279E37EABE9CA30ECF"));
  ok("ton: other families refused", !isValidTonAddress("rHsMGQEkVNJmpGWs8XUBoTBiAAbwxZN5v3")
    && !isValidTonAddress("hello") && !isValidTonAddress("") && !isValidTonAddress(null));
  ok("ton: nano conversions", tonTonToNano("0.05") === 50000000n && tonNanoToTon(1500000000n) === "1.5");
  const tonIntent = formatTonSendIntent({ amount: "2", symbol: "TON", to: ABANDON_TON });
  ok("ton: intent discloses the fee reserve", tonIntent.includes("Send 2 TON") && tonIntent.includes("0.05 TON is set aside for network fees")
    && tonIntent.includes("comes back to you") && tonIntent.includes("Confirm?"));
  ok("ton: USDT master is Tether's verified contract", TON_USDT_MASTER === "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
  ok("ton: no swap chain registered", swapChainOf("ton") === null);

  // ----- NEAR (SLIP-0010 coin 397, implicit accounts) -----
  const ABANDON_NEAR = "4e7de0a21d8a20f970c86b6edf407906d7ba9e205979c3268270eef80a286e2d";
  const KNOWN_NEAR = "0930358eaca9e871d33cfb89eb07e936be5669a99e3a17c020447492fb8382d0";
  ok("near: abandon…about implicit account vector", nearAddressFromPhrase(ABANDON) === ABANDON_NEAR);
  ok("near: known-phrase implicit account vector", nearAddressFromPhrase(KNOWN_PHRASE) === KNOWN_NEAR);
  ok("near: seed-level derivation agrees", nearAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_NEAR);
  {
    // Independent derivation: the ed25519-hd-key package (NEAR
    // tooling's own reference) must produce the same key + chain code.
    const ref = ed25519HdDerivePath("m/44'/397'/0'/0'/0'", Buffer.from(mnemonicToSeedSync(ABANDON)).toString("hex"));
    const mine = deriveSlip10Ed25519(mnemonicToSeedSync(ABANDON), [44, 397, 0, 0, 0]);
    ok("near: ed25519-hd-key derivation agrees (key + chain code)",
      Buffer.from(mine.key).toString("hex") === Buffer.from(ref.key).toString("hex")
      && Buffer.from(mine.chainCode).toString("hex") === Buffer.from(ref.chainCode).toString("hex"));
    // Serialization: Fluid's hand-rolled borsh must equal
    // near-api-js's bytes for a Transfer AND for the two
    // FunctionCall actions an NEP-141 send is built from; the
    // signature must equal near-api-js's KeyPair signature.
    const key = nearSeedFromSeed(mnemonicToSeedSync(ABANDON));
    const pub = ed25519.getPublicKey(key);
    const blockHash = nearBaseDecode("8xEAj3AoegnxQFJJgGQE2G9u5WG4jGWHYGqTXCSi7Em9");
    const deposit = 10n ** 24n;
    const mineTx = nearTransactionBytes({ signerId: ABANDON_NEAR, publicKey: pub, nonce: 42n, receiverId: "near", blockHash, actions: [nearActionTransfer(deposit)] });
    const refTx = nearCreateTx(ABANDON_NEAR, NearPublicKey.fromString("ed25519:" + nearBaseEncode(pub)), "near", 42n, [nearActions.transfer(deposit)], blockHash);
    ok("near: transfer serialization matches near-api-js", Buffer.from(mineTx).equals(Buffer.from(nearEncodeTx(refTx))));
    const usdc = NEAR_TOKENS[0].address;
    const sdArgs = new TextEncoder().encode(JSON.stringify({ account_id: "someone.near" }));
    const ftArgs = new TextEncoder().encode(JSON.stringify({ receiver_id: "someone.near", amount: "1000000", memo: null }));
    const mineFc = nearTransactionBytes({ signerId: ABANDON_NEAR, publicKey: pub, nonce: 7n, receiverId: usdc, blockHash,
      actions: [nearActionFunctionCall("storage_deposit", sdArgs, 30000000000000n, 1250000000000000000000n),
                nearActionFunctionCall("ft_transfer", ftArgs, 30000000000000n, 1n)] });
    const refFc = nearCreateTx(ABANDON_NEAR, NearPublicKey.fromString("ed25519:" + nearBaseEncode(pub)), usdc, 7n,
      [nearActions.functionCall("storage_deposit", sdArgs, 30000000000000n, 1250000000000000000000n),
       nearActions.functionCall("ft_transfer", ftArgs, 30000000000000n, 1n)], blockHash);
    ok("near: function-call serialization matches near-api-js", Buffer.from(mineFc).equals(Buffer.from(nearEncodeTx(refFc))));
    const digest = nobleSha256(mineTx);
    const sigMine = ed25519.sign(digest, key);
    const kp = NearKeyPair.fromString("ed25519:" + nearBaseEncode(new Uint8Array([...key, ...pub])));
    const { signature: sigRef } = await kp.sign(digest);
    ok("near: signature matches near-api-js KeyPair", Buffer.from(sigMine).equals(Buffer.from(sigRef)));
    ok("near: signed-tx assembly carries the same bytes",
      nearSignedTransactionBytes(mineTx, sigMine).length === mineTx.length + 65);
  }
  ok("near: address validation", isValidNearAddress(ABANDON_NEAR) && isValidNearAddress("example.near")
    && isValidNearAddress("usdt.tether-token.near") && isValidNearAddress("UPPER.NEAR") // case-normalized, as sendNear lowercases
    && !isValidNearAddress("NOT AN ADDRESS") && !isValidNearAddress("") && !isValidNearAddress(null));
  ok("near: yocto conversions", nearNearToYocto("0.00182") === 1820000000000000000000n
    && nearYoctoToNear(1820000000000000000000n) === "0.00182" && nearYoctoToNear(100n) === "0.0000000000000000000001");
  ok("near: existence minimum is 182 bytes × 10^19", nearMinExistYocto(182) === 1820000000000000000000n);
  ok("near: USDC contract is Circle's native deployment", NEAR_TOKENS[0].address === "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    && NEAR_TOKENS[0].symbol === "USDC" && NEAR_TOKENS[0].verified === true);
  const nearIntent = formatNearSendIntent({ amount: "1", symbol: "NEAR", to: "someone.near", createsAccount: true });
  ok("near: intent discloses account creation", nearIntent.includes("Send 1 NEAR") && nearIntent.includes("creates the recipient's account"));
  ok("near: no swap chain registered", swapChainOf("near") === null);

  // ----- Algorand (SLIP-0010 coin 283) -----
  const ABANDON_ALGO = "EP2D7TV7IAFANZHK3B6QLKB53N5UTD7RARVXZTWCPCRQQBKYVGM2XIMT2Q";
  const KNOWN_ALGO = "XTNEJTKVSDVMMRR6JZ7P2M2JMOHIUXU2CQAPL6WGEXNJ2L2HUBGW2OVQ6Q";
  ok("algorand: abandon…about address vector", algoAddressFromPhrase(ABANDON) === ABANDON_ALGO);
  ok("algorand: known-phrase address vector", algoAddressFromPhrase(KNOWN_PHRASE) === KNOWN_ALGO);
  ok("algorand: seed-level derivation agrees", algoAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_ALGO);
  {
    const pub = ed25519.getPublicKey(algoSeedFromSeed(mnemonicToSeedSync(ABANDON)));
    ok("algorand: algosdk.encodeAddress agrees", algosdk.encodeAddress(pub) === ABANDON_ALGO);
    ok("algorand: decode round-trips through both codecs",
      Buffer.from(algoAddressDecode(ABANDON_ALGO)).equals(Buffer.from(pub))
      && Buffer.from(algosdk.decodeAddress(ABANDON_ALGO).publicKey).equals(Buffer.from(pub)));
    ok("algorand: derivation agrees with ed25519-hd-key",
      Buffer.from(algoSeedFromSeed(mnemonicToSeedSync(ABANDON))).toString("hex")
      === Buffer.from(ed25519HdDerivePath("m/44'/283'/0'/0'/0'", Buffer.from(mnemonicToSeedSync(ABANDON)).toString("hex")).key).toString("hex"));
  }
  const tamperedAlgo = ABANDON_ALGO.slice(0, 30) + (ABANDON_ALGO[30] === "A" ? "B" : "A") + ABANDON_ALGO.slice(31);
  ok("algorand: tampered checksum refused", !isValidAlgorandAddress(tamperedAlgo) && algoAddressDecode(tamperedAlgo) === null);
  ok("algorand: valid passes, other families refused", isValidAlgorandAddress(ABANDON_ALGO)
    && !isValidAlgorandAddress(ABANDON_TON) && !isValidAlgorandAddress("hello") && !isValidAlgorandAddress(""));
  ok("algorand: micro conversions", algoAlgoToMicro("0.1") === 100000n && algoMicroToAlgo(100000n) === "0.1");
  ok("algorand: USDC is Circle's ASA", ALGO_USDC_ASA === 31566704 && ALGO_USDC.address === "31566704" && ALGO_USDC.verified === true);
  const algoIntent = formatAlgoSendIntent({ amount: "3", symbol: "ALGO", to: ABANDON_ALGO, feeAlgo: "0.001" });
  ok("algorand: intent is human-readable", algoIntent.includes("Send 3 ALGO") && algoIntent.includes("on Algorand")
    && algoIntent.includes("Network fee 0.001 ALGO") && algoIntent.includes("Confirm?"));
  ok("algorand: no swap chain registered", swapChainOf("algorand") === null);

  // ----- XRP Ledger (BIP44 secp256k1 coin 144) -----
  const ABANDON_XRP = "rHsMGQEkVNJmpGWs8XUBoTBiAAbwxZN5v3";
  const KNOWN_XRP = "rnrbiYDUYTJS4JVdSV5FtyCj4HFuRjfLKM";
  ok("xrpl: abandon…about classic address vector", xrplAddressFromPhrase(ABANDON) === ABANDON_XRP);
  ok("xrpl: known-phrase classic address vector", xrplAddressFromPhrase(KNOWN_PHRASE) === KNOWN_XRP);
  ok("xrpl: ripple-address-codec agrees on the account id",
    xrplCodecEncodeAccountID(Buffer.from(xrplAddressDecode(ABANDON_XRP))) === ABANDON_XRP
    && xrplCodecEncodeAccountID(Buffer.from(xrplAddressDecode(KNOWN_XRP))) === KNOWN_XRP);
  {
    // Signing: the production builder's blob must decode via
    // ripple-binary-codec and verify under ripple-keypairs — the
    // exact checks the network performs.
    const child = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON)).derive("m/44'/144'/0'/0/0");
    const tx = { TransactionType: "Payment", Account: ABANDON_XRP, Destination: KNOWN_XRP,
      Amount: "1000000", Fee: "12", Sequence: 12345, Flags: 2147483648, LastLedgerSequence: 108200000 };
    const { blob, hash } = xrplSignPayment({ privateKey: child.privateKey, publicKey: child.publicKey, tx });
    const back = xrplCodecDecode(blob);
    ok("xrpl: production blob verifies under ripple-keypairs",
      xrplKeypairs.verify(xrplCodecEncodeForSigning(tx), back.TxnSignature, back.SigningPubKey));
    ok("xrpl: tx hash is a 64-hex id", /^[0-9A-F]{64}$/.test(hash) && back.Account === ABANDON_XRP);
  }
  const tamperedXrp = ABANDON_XRP.slice(0, 10) + (ABANDON_XRP[10] === "r" ? "p" : "r") + ABANDON_XRP.slice(11);
  ok("xrpl: tampered checksum refused", !isValidXrplAddress(tamperedXrp) && xrplAddressDecode(tamperedXrp) === null);
  ok("xrpl: valid passes, other families refused", isValidXrplAddress(ABANDON_XRP)
    && !isValidXrplAddress(ABANDON_TON) && !isValidXrplAddress("GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX")
    && !isValidXrplAddress("") && !isValidXrplAddress(null));
  ok("xrpl: drops conversions", xrplXrpToDrops("1.5") === 1500000n && xrplDropsToXrp(1500000n) === "1.5" && xrplDropsToXrp(10n) === "0.00001");
  ok("xrpl: currency labels decode from 160-bit hex", xrplCurrencyLabel("5553444300000000000000000000000000000000") === "USDC"
    && xrplCurrencyLabel("USD") === "USD");
  // Circle's issuer — the brief for this phase carried a garbled
  // variant that fails XRPL checksum validation outright; only this
  // exact address verified live (gateway_balances obligations).
  ok("xrpl: USDC is Circle's verified issuer", XRPL_USDC_ISSUER === "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE"
    && isValidXrplAddress(XRPL_USDC_ISSUER) && XRPL_USDC.verified === true);
  const xrpIntent = formatXrplSendIntent({ amount: "5", symbol: "XRP", to: ABANDON_XRP, feeXrp: "0.00001", destinationTag: 12345 });
  ok("xrpl: intent shows the destination tag", xrpIntent.includes("Send 5 XRP") && xrpIntent.includes("Destination tag: 12345")
    && xrpIntent.includes("Network fee 0.00001 XRP") && xrpIntent.includes("Confirm?"));
  ok("xrpl: no swap chain registered", swapChainOf("xrpl") === null);

  // ----- Polkadot Asset Hub (Sr25519, Substrate scheme) -----
  const ABANDON_DOT = "13KVd4f2a4S5pLp4gTTFezyXdPWx27vQ9vS6xBXJ9yWVd7xo";
  const KNOWN_DOT = "15hjAH9GXCLMkcSxeRcbdbtuQZ59pgL6rDU73FBknBprgNR8";
  ok("polkadot: abandon…about address vector", dotAddressFromPhrase(ABANDON) === ABANDON_DOT);
  ok("polkadot: known-phrase address vector", dotAddressFromPhrase(KNOWN_PHRASE) === KNOWN_DOT);
  {
    // Independent mini-secret: PBKDF2-HMAC-SHA512 over the mnemonic
    // ENTROPY (@scure/bip39's decoder + noble's PBKDF2 — neither is
    // @polkadot code), then the primitive Sr25519 derivation must
    // land on the same address the Keyring route produces.
    const entropy = scureMnemonicToEntropy(ABANDON, bip39EnglishWordlist);
    const mini = noblePbkdf2(nobleSha512, entropy, new TextEncoder().encode("mnemonic"), { c: 2048, dkLen: 64 }).slice(0, 32);
    const pair = dotSrPairFromSeed(mini);
    ok("polkadot: entropy-route mini-secret + primitive derivation agrees",
      dotEncodeAddress(pair.publicKey, 0) === ABANDON_DOT);
    // And the pair's signatures verify under the canonical
    // primitive — the property @polkadot/api's signer relies on.
    const { Keyring: DotKeyringTest } = await import("@polkadot/keyring");
    const kp = new DotKeyringTest({ type: "sr25519", ss58Format: 0 }).addFromMnemonic(ABANDON);
    const message = new TextEncoder().encode("fluid phase4 check");
    ok("polkadot: keyring pair signature verifies under the primitive",
      dotSrVerify(message, kp.sign(message), kp.publicKey));
  }
  ok("polkadot: address validation", isValidDotAddress(ABANDON_DOT) && isValidDotAddress(KNOWN_DOT)
    && !isValidDotAddress(ABANDON_XRP) && !isValidDotAddress("hello") && !isValidDotAddress("") && !isValidDotAddress(null));
  ok("polkadot: planck conversions", dotDotToPlanck("0.01") === 100000000n && dotPlanckToDot(100000000n) === "0.01"
    && dotPlanckToDot(15000000000n) === "1.5");
  ok("polkadot: stablecoin asset ids are the verified pair", DOT_TOKENS[0].address === "1337" && DOT_TOKENS[0].symbol === "USDC"
    && DOT_TOKENS[1].address === "1984" && DOT_TOKENS[1].symbol === "USDT");
  const dotIntent = formatDotSendIntent({ amount: "2", symbol: "DOT", to: ABANDON_DOT, feeDot: "0.00012" });
  ok("polkadot: intent is human-readable", dotIntent.includes("Send 2 DOT") && dotIntent.includes("on Polkadot Asset Hub")
    && dotIntent.includes("Network fee ≈ 0.00012 DOT") && dotIntent.includes("Confirm?"));
  ok("polkadot: no swap chain registered", swapChainOf("polkadot") === null);
}

// 35. Phase 5 — Aptos (SLIP-0010 Ed25519, coin type 637, Petra path).
// Derivation, the hand-rolled BCS and the signing were cross-checked
// against @aptos-labs/ts-sdk as a scratch verifier (NOT a dependency):
// the SDK's Account.fromDerivationPath produces the address pinned
// below, its RawTransaction/EntryFunction BCS is byte-identical to
// aptosBuildRawTransaction's output for the fixed inputs used here
// (APT coin::transfer, USDt FA transfer, lzUSDC coin::transfer), the
// SDK verifies our signature over the signing message, and the full
// signed transaction is byte-identical. End-to-end on devnet, a
// transfer built and signed by this code executed successfully
// (tx 0xf1e9f1fa…fb4). A completed mainnet send remains
// undemonstrated (standing rule).
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const ABANDON_APTOS = "0xeb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf";
  const RECIP = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const hexOf = (u8) => Buffer.from(u8).toString("hex");
  ok("aptos: address from phrase (Petra path, SDK cross-checked)", aptosAddressFromPhrase(ABANDON) === ABANDON_APTOS);
  ok("aptos: address from seed agrees", aptosAddressFromSeed(mnemonicToSeedSync(ABANDON)) === ABANDON_APTOS);
  {
    // Independent recompute of the address rule itself: SHA3-256 of
    // (pubkey || 0x00), with the pubkey taken from noble directly.
    const pub = ed25519.getPublicKey(aptosSeedFromSeed(mnemonicToSeedSync(ABANDON)));
    ok("aptos: address = sha3-256(pubkey || 0x00)", "0x" + hexOf(nobleSha3_256(Uint8Array.from([...pub, 0x00]))) === ABANDON_APTOS);
    ok("aptos: public key helper agrees", aptosPublicKeyFromPhrase(ABANDON) === "0x" + hexOf(pub));
  }
  ok("aptos: address validation", isValidAptosAddress(ABANDON_APTOS) && isValidAptosAddress("0x1")
    && normalizeAptosAddress("0x1") === "0x0000000000000000000000000000000000000000000000000000000000000001"
    && !isValidAptosAddress("hello") && !isValidAptosAddress("") && !isValidAptosAddress(null)
    && !isValidAptosAddress("0x" + "ab".repeat(33)));
  ok("aptos: unit conversions", aptosAptToOctas("1.5") === 150000000n && aptosOctasToApt(150000000n) === "1.5"
    && aptosOctasToApt(1n) === "0.00000001" && aptosAmountToRaw("2.5", 6) === 2500000n);
  ok("aptos: verified assets are the issuer-confirmed pair", APTOS_COIN_TYPE === "0x1::aptos_coin::AptosCoin"
    && APTOS_TOKENS[0].symbol === "USDC" && APTOS_TOKENS[0].address === "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
    && APTOS_TOKENS[0].standard === "fa" && APTOS_TOKENS[0].decimals === 6
    && APTOS_TOKENS[1].symbol === "USDT" && APTOS_TOKENS[1].address === "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b"
    && APTOS_TOKENS[1].standard === "fa" && APTOS_TOKENS[1].decimals === 6);
  const FIXED = { sender: ABANDON_APTOS, sequenceNumber: 7n, to: RECIP, maxGasAmount: 5432n, gasUnitPrice: 100n, expirationTimestampSecs: 1893456000n, chainId: 1 };
  const PIN_APT_RAW = "eb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf070000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e0002201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef084e61bc00000000003815000000000000640000000000000080d8db700000000001";
  const PIN_APT_SIGNED = "eb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf070000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e0002201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef084e61bc00000000003815000000000000640000000000000080d8db7000000000010020a686f0309ab80312979606cfccc10ea2740147ae6888351488d11c46f08fbf6040bd042fd18722542fce96e6150dead933d44af3f0a9b0cf97ce43583577a0ab1bce203a6655e4a036bfc91699cb2ea182b5ea81caf8950b0ded894b0603f1f605";
  const PIN_USDT_RAW = "eb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf0700000000000000020000000000000000000000000000000000000000000000000000000000000001167072696d6172795f66756e6769626c655f73746f7265087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010e66756e6769626c655f6173736574084d65746164617461000320357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef08a0252600000000003815000000000000640000000000000080d8db700000000001";
  const rawApt = aptosBuildRawTransaction({ ...FIXED, amountRaw: 12345678n, token: null });
  ok("aptos: APT transfer BCS byte-identical to the SDK's", hexOf(rawApt) === PIN_APT_RAW);
  const rawUsdt = aptosBuildRawTransaction({ ...FIXED, amountRaw: 2500000n, token: APTOS_TOKENS[1] });
  ok("aptos: USDt FA transfer BCS byte-identical to the SDK's", hexOf(rawUsdt) === PIN_USDT_RAW);
  const signed = aptosSignRawTransaction(ABANDON, rawApt);
  ok("aptos: signed transaction byte-identical to the SDK's", hexOf(signed.signedBytes) === PIN_APT_SIGNED);
  {
    const pub = ed25519.getPublicKey(aptosSeedFromSeed(mnemonicToSeedSync(ABANDON)));
    const sigBytes = Buffer.from(signed.signature.slice(2), "hex");
    ok("aptos: signature verifies over the signing message (noble)",
      ed25519.verify(sigBytes, aptosSigningMessage(rawApt), pub));
    ok("aptos: signing message carries the sha3-256 domain prefix",
      hexOf(aptosSigningMessage(rawApt).slice(0, 32)) === hexOf(nobleSha3_256(new TextEncoder().encode("APTOS::RawTransaction"))));
  }
  const aptosIntent = formatAptosSendIntent({ amount: "2", symbol: "APT", to: RECIP, feeApt: "0.00000107" });
  ok("aptos: intent is human-readable", aptosIntent.includes("Send 2 APT") && aptosIntent.includes("on Aptos")
    && aptosIntent.includes("Network fee ≈ 0.00000107 APT") && aptosIntent.includes("Confirm?"));
  ok("aptos: no swap chain registered", swapChainOf("aptos") === null);
}

// ---------- Receive selector: network metadata + alias search ----------
// Ethuram's rule for the Receive sheet: search a spoken/short name, tap
// the network, get its panel — no scrolling a stack of address blocks.
{
  const ids = q => filterReceiveNetworks(q).map(m => m.id);
  const TOP_IDS = ["evm", "bitcoin", "lightning", "tron", "solana", "sui", "stellar", "ton", "near",
    "algorand", "xrpl", "polkadot", "aptos", "litecoin", "dogecoin", "bitcoincash"];
  ok("receive: one entry per network (17 top-level + 7 Cosmos)", RECEIVE_NETWORKS.length === 24);
  ok("receive: ids unique", new Set(RECEIVE_NETWORKS.map(m => m.id)).size === RECEIVE_NETWORKS.length);
  ok("receive: every panel id covered", TOP_IDS.every(id => RECEIVE_NETWORKS.some(m => m.id === id))
    && COSMOS_CHAINS.every(c => RECEIVE_NETWORKS.some(m => m.id === c.key)));
  ok("receive: blank query lists everything", ids("") .length === 24 && ids("   ").length === 24);
  ok("receive: btc → Bitcoin only (not Bitcoin Cash)", JSON.stringify(ids("btc")) === '["bitcoin"]');
  ok("receive: ln → Lightning only", JSON.stringify(ids("ln")) === '["lightning"]');
  ok("receive: lightning → Lightning only", JSON.stringify(ids("lightning")) === '["lightning"]');
  ok("receive: bsc/bnb/eth → the one shared EVM entry",
    JSON.stringify(ids("bsc")) === '["evm"]' && JSON.stringify(ids("bnb")) === '["evm"]' && JSON.stringify(ids("eth")) === '["evm"]');
  ok("receive: sol → Solana", JSON.stringify(ids("sol")) === '["solana"]');
  ok("receive: doge → Dogecoin", JSON.stringify(ids("doge")) === '["dogecoin"]');
  ok("receive: ltc → Litecoin", JSON.stringify(ids("ltc")) === '["litecoin"]');
  ok("receive: bch → Bitcoin Cash only (not Bitcoin)", JSON.stringify(ids("bch")) === '["bitcoincash"]');
  ok("receive: bitcoin → Bitcoin, Lightning and Bitcoin Cash",
    ids("bitcoin").includes("bitcoin") && ids("bitcoin").includes("lightning") && ids("bitcoin").includes("bitcoincash"));
  ok("receive: xrp → XRP Ledger", JSON.stringify(ids("xrp")) === '["xrpl"]');
  ok("receive: dot → Polkadot Asset Hub", JSON.stringify(ids("dot")) === '["polkadot"]');
  ok("receive: atom → Cosmos Hub", JSON.stringify(ids("atom")) === '["cosmoshub"]');
  ok("receive: cosmos → the whole Cosmos family, nothing else",
    ids("cosmos").length === 7 && COSMOS_CHAINS.every(c => ids("cosmos").includes(c.key)));
  ok("receive: inj → Injective", JSON.stringify(ids("inj")) === '["injective"]');
  ok("receive: apt → Aptos", JSON.stringify(ids("apt")) === '["aptos"]');
  ok("receive: sui → Sui", JSON.stringify(ids("sui")) === '["sui"]');
  ok("receive: ton → TON", JSON.stringify(ids("ton")) === '["ton"]');
  ok("receive: near → NEAR", JSON.stringify(ids("near")) === '["near"]');
  ok("receive: algo → Algorand", JSON.stringify(ids("algo")) === '["algorand"]');
  ok("receive: xlm → Stellar", JSON.stringify(ids("xlm")) === '["stellar"]');
  ok("receive: trx → Tron", JSON.stringify(ids("trx")) === '["tron"]');
  ok("receive: queries are case-insensitive and trimmed",
    JSON.stringify(ids("BTC")) === '["bitcoin"]' && JSON.stringify(ids("  Lightning ")) === '["lightning"]');
  ok("receive: gibberish matches nothing", ids("zzzz").length === 0);
  ok("receive: matcher works on bare metadata",
    receiveNetworkMatches({ name: "Foo Chain", aliases: ["foo"] }, "foo") === true
    && receiveNetworkMatches({ name: "Foo Chain", aliases: ["foo"] }, "bar") === false
    && receiveNetworkMatches({ name: "Foo Chain", aliases: [] }, "") === true);
}

// ---------- Stacks family (Bitcoin L2, Build A step 2) ----------
// Derivation/address vectors cross-checked against @stacks/transactions
// (getAddressFromPrivateKey) + the c32check package's decoder; signed-tx
// vectors are BYTE-IDENTICAL to @stacks/transactions output for the same
// inputs (makeSTXTokenTransfer / makeContractCall with an exact-amount
// Pc post-condition), re-verified 2026-11-06. A testnet transfer through
// sendStacks confirmed on-chain the same day (txid 0xfb8ff0…9f62a).
{
  const ABANDON = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  ok("stacks: mainnet address vector (BIP44 m/44'/5757'/0'/0/0)",
    stacksAddressFromPhrase(ABANDON) === "SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J");
  ok("stacks: testnet address vector",
    stacksAddressFromPhrase(ABANDON, "testnet") === "STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ");
  const dec = stacksAddressDecode("SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J");
  ok("stacks: c32 decode gives version 22 + the pinned hash160",
    dec.version === 22 && dec.hash160 === "1859c6840c4dc8ab3a3d39c6b5003fb36c5e7232");
  ok("stacks: address validation (checksum + network version)",
    isValidStacksAddress("SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J") === true
    && isValidStacksAddress("SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54K") === false
    && isValidStacksAddress("STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ", "testnet") === true
    && isValidStacksAddress("STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ", "mainnet") === false
    && isValidStacksAddress("not an address") === false);
  ok("stacks: SM contract addresses validate as contracts, not as user addresses",
    isValidStacksContractAddress("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4") === true
    && isValidStacksAddress("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4") === false);
  ok("stacks: c32 round-trip with a leading-zero hash160",
    stacksAddressDecode(stacksAddressEncode(22, Uint8Array.from([0, ...Array(19).fill(0x11)]))).hash160 === "00" + "11".repeat(19));
  ok("stacks: unit conversions (µSTX, 6dp)",
    stxMicroToStx(1620n) === "0.00162" && stxMicroToStx(500000n) === "0.5" && stxMicroToStx(0n) === "0"
    && stxToMicro("0.5") === 500000n && stxToMicro("12.000001") === 12000001n);
  ok("stacks: amount parsing is strict",
    (() => { try { stxToMicro("0.0000001"); return false; } catch { return true; } })()
    && stacksAmountToRaw("1.5", 8) === 150000000n
    && stacksRawToAmount(150000000n, 8) === "1.5"
    && stacksRawToAmount(5n, 6) === "0.000005");
  const TO = "SP37RG88PJBHSFKK90PG2NDWC0A8Y4JK9MDQ9YEKH";
  const stxTx = buildSignedStacksTx({ phrase: ABANDON, to: TO, amountRaw: 1000n, feeUstx: 200n, nonce: 3 });
  ok("stacks: signed STX transfer is the @stacks/transactions byte vector",
    stxTx.rawHex === "000000000104001859c6840c4dc8ab3a3d39c6b5003fb36c5e7232000000000000000300000000000000c80000b6127e6120d8e57222d26885a01c2144f2ac24e7d523778caa578665ce6cc6007d1714020865f57169a6fd211614b62df0838ffb92b8f3f478d936174be45d0d030200000000000516cf88211692e397ce6905a02ab78c0291e24a69a300000000000003e800000000000000000000000000000000000000000000000000000000000000000000"
    && stxTx.txid === "0x50d7ec699556abae72af2290ea98b37a26ea0dfbad8aae7fe20696ef8eece3fc");
  const usdaTx = buildSignedStacksTx({ phrase: ABANDON, to: TO, amountRaw: 5n, token: { contract: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token", assetName: "usda" }, feeUstx: 300n, nonce: 7 });
  ok("stacks: signed SIP-010 transfer (exact-amount PC) is the SDK byte vector",
    usdaTx.rawHex === "000000000104001859c6840c4dc8ab3a3d39c6b5003fb36c5e72320000000000000007000000000000012c00003003d918ac72594f0949e0e27b91c3608c55448e12a7d09ed1489c0fa326fe975b12cdf9388694f26f04e12a887f351c4998fa983994fc6168818435c66abdb90302000000010102161859c6840c4dc8ab3a3d39c6b5003fb36c5e723216982f3ec112a5f5928a5c96a914bd733793b896a50a757364612d746f6b656e04757364610100000000000000050216982f3ec112a5f5928a5c96a914bd733793b896a50a757364612d746f6b656e087472616e7366657200000004010000000000000000000000000000000505161859c6840c4dc8ab3a3d39c6b5003fb36c5e72320516cf88211692e397ce6905a02ab78c0291e24a69a309"
    && usdaTx.txid === "0x3b335d4064527122c4bd997691b085b82eddb69afd9785d0b53196c4b5c4a12b");
  const stxTxT = buildSignedStacksTx({ phrase: ABANDON, network: "testnet", to: "ST37RG88PJBHSFKK90PG2NDWC0A8Y4JK9MC5RYQHX", amountRaw: 250000n, feeUstx: 180n, nonce: 0 });
  ok("stacks: signed testnet STX transfer is the SDK byte vector",
    stxTxT.rawHex === "808000000004001859c6840c4dc8ab3a3d39c6b5003fb36c5e7232000000000000000000000000000000b400006e245f9e94a6d34c010a37d7dad203bf43a584154c6d58985f3fc67930298f5574c1a1f9b6e1710e039af496d9e0814a3010603f1ffb73b5bac48ca1a0b5533e03020000000000051acf88211692e397ce6905a02ab78c0291e24a69a3000000000003d09000000000000000000000000000000000000000000000000000000000000000000000");
  ok("stacks: signing is deterministic and rejects bad inputs",
    buildSignedStacksTx({ phrase: ABANDON, to: TO, amountRaw: 1000n, feeUstx: 200n, nonce: 3 }).rawHex === stxTx.rawHex
    && (() => { try { buildSignedStacksTx({ phrase: ABANDON, to: "STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ", amountRaw: 1n, feeUstx: 1n, nonce: 0 }); return false; } catch { return true; } })()
    && (() => { try { buildSignedStacksTx({ phrase: ABANDON, to: TO, amountRaw: 0n, feeUstx: 1n, nonce: 0 }); return false; } catch { return true; } })());
  ok("stacks: intent sentence quotes the fee",
    formatStacksSendIntent({ amountText: "0.5", symbol: "STX", to: "ST37RG88PJBHSFKK90PG2NDWC0A8Y4JK9MC5RYQHX", feeUstx: 1620n, network: "testnet" })
      === "Send 0.5 STX to ST37RG88PJBHSFKK90PG2NDWC0A8Y4JK9MC5RYQHX on Stacks Testnet — network fee 0.00162 STX. Confirm?");
  ok("stacks: fee safety caps are pinned",
    STACKS_MAX_FEE_USTX === 50000n && STACKS_MAX_FEE_RATE_USTX_PER_BYTE === 10000);
  ok("stacks: call-read value parser (ok-ascii / ok-uint / garbage)",
    (() => {
      const ascii = Uint8Array.from([0x07, 0x0d, 0, 0, 0, 4, ...new TextEncoder().encode("sBTC")]);
      const uint = Uint8Array.from([0x07, 0x01, ...new Uint8Array(15), 8]);
      const a = parseStacksCallReadValue(ascii), u = parseStacksCallReadValue(uint);
      return a?.kind === "string" && a.value === "sBTC" && u?.kind === "uint" && u.value === 8n
        && parseStacksCallReadValue(Uint8Array.from([0xff, 0x01])) === null;
    })());
  ok("stacks: pinned tokens carry the on-chain asset names (not the symbols)",
    STACKS_TOKENS.length === 2
    && STACKS_TOKENS[0].assetName === "sbtc-token" && STACKS_TOKENS[0].decimals === 8
    && STACKS_TOKENS[1].assetName === "usda" && STACKS_TOKENS[1].decimals === 6);
  ok("stacks: receive search aliases resolve to Stacks only",
    JSON.stringify(filterReceiveNetworks("stx").map(n => n.id)) === "[\"stacks\"]"
    && JSON.stringify(filterReceiveNetworks("stacks").map(n => n.id)) === "[\"stacks\"]");
  ok("stacks: no LI.FI swap chain (Stacks is not on LI.FI's live chain list)",
    swapChainOf("stacks") === null);
  ok("stacks: explorer URL shape",
    stacksExplorerTxUrl("0xabc") === "https://explorer.hiro.so/txid/0xabc?chain=mainnet");
}

// ---------- persisted-metadata XSS (security audit C1) ----------
// History + approval records persist token metadata from ERC-20 contracts
// and LI.FI — attacker-controlled strings. The render path must escape
// them, history links must be rebuilt only from validated parts, and the
// two app.js screens must route through these formatters.
{
  const EVIL = "<img src=x onerror=alert(1)>";
  ok("c1: escapeHtml escapes all five markup characters",
    escapeHtml(`&<>"'`) === "&amp;&lt;&gt;&quot;&#39;");
  const row = formatHistoryEntry({ amount: "1", symbol: EVIL, to: "0xabc", hash: "0x" + "a".repeat(64), explorer: "https://bscscan.com" });
  ok("c1: history row renders a malicious symbol as inert text",
    row.includes("&lt;img src=x onerror=alert(1)&gt;") && !row.includes("<img"));
  ok("c1: history row keeps a working explorer link for a valid hash",
    row.includes('href="https://bscscan.com/tx/0x' + "a".repeat(64) + '"'));
  const badLink = formatHistoryEntry({ amount: "1", symbol: "X", to: "0xabc", link: "javascript:alert(1)" });
  ok("c1: a javascript: history link is dropped, never emitted",
    !badLink.includes("href=") && !badLink.includes("javascript:"));
  const badHash = formatHistoryEntry({ amount: "1", symbol: "X", to: "0xabc", hash: '0x" onmouseover="alert(1)', explorer: "https://bscscan.com" });
  ok("c1: a quote-breakout hash yields no link",
    !badHash.includes("href=") && !badHash.includes("onmouseover"));
  ok("c1: historyTxUrl keeps a clean https link, rejects http and junk",
    historyTxUrl({ link: "https://tonscan.org/address/EQabc" }) === "https://tonscan.org/address/EQabc"
    && historyTxUrl({ link: "http://evil.example/x" }) === null
    && historyTxUrl({}) === null && historyTxUrl(null) === null);
  const ap = formatApprovalRow({ tokenSymbol: "<svg onload=alert(1)>", spender: "<script>zzzzzz" }, "5", "06/11/2026");
  ok("c1: approvals row escapes the token symbol and the spender slice",
    ap.includes("&lt;svg onload=alert(1)&gt;") && !ap.includes("<svg") && ap.includes("&lt;scrip") && !ap.includes("<script"));
  const rp = formatRevokePrompt({ tokenSymbol: "EVIL<x>", spender: "0x1234567890abcdef" }, "BNB <b>Chain</b>");
  ok("c1: revoke prompt escapes symbol and network name",
    rp.includes("EVIL&lt;x&gt;") && rp.includes("BNB &lt;b&gt;Chain&lt;/b&gt;") && !rp.includes("<b>Chain</b>"));
  ok("c1: write-time symbol sanitiser strips markup + control chars",
    sanitizePersistedSymbol('AB<C>"D\'E`F') === "ABCDEF"
    && sanitizePersistedSymbol("") === "Token"
    && sanitizePersistedSymbol("A".repeat(64)).length === 32);
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("c1: app renders history only through formatHistoryEntry",
    appSrc.includes("h.map(formatHistoryEntry)")
    && !appSrc.includes("${x.amount} ${x.symbol}")
    && !appSrc.includes('href="${x.link'));
  ok("c1: app renders approvals only through the escaping formatters",
    appSrc.includes("formatApprovalRow(a, fmt(a.amount)")
    && appSrc.includes("formatRevokePrompt(a,")
    && !appSrc.includes("${a.tokenSymbol || \"Token\"}")
    && !appSrc.includes("${a.tokenSymbol || \"token\"}"));
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("c1: index.html ships the strict CSP meta",
    idxSrc.includes('http-equiv="Content-Security-Policy"')
    && idxSrc.includes("script-src 'self'")
    && idxSrc.includes("object-src 'none'"));
}

// ---------- vault KDF hardening (security audit H2) ----------
// New vaults: scrypt N=2^18 (ethers default was 2^17) + a 12-character
// password floor. Old-format vaults must keep unlocking, be detectable,
// and re-encrypt to the new strength with the same password/phrase.
{
  const { validatePassword: vp, vaultKdfParams, needsKdfUpgrade: nku, reencryptVault, VAULT_SCRYPT, MIN_PASSWORD_LENGTH } =
    await import("../src/wallet-core.js");
  ok("h2: password floor is 12", MIN_PASSWORD_LENGTH === 12 && !vp("elevenchars") && vp("twelvechars!") && !vp(123456789012));
  const strong = await createVault("a-strong-password");
  const kp = vaultKdfParams(strong.keystore);
  ok("h2: new vault uses scrypt N=2^18 r=8 p=1", kp && kp.N === VAULT_SCRYPT.N && kp.N === 262144 && kp.r === 8 && kp.p === 1);
  ok("h2: new vault needs no upgrade", !nku(strong.keystore));
  // An old-format vault, built exactly the way pre-H2 Fluid built it:
  // ethers defaults (scrypt N=2^17) via wallet.encrypt.
  const oldWallet = ethers.Wallet.fromPhrase(KNOWN_PHRASE);
  const oldKeystore = await oldWallet.encrypt("password123");
  const okp = vaultKdfParams(oldKeystore);
  ok("h2: old vault reads back N=2^17", okp && okp.N === 131072);
  ok("h2: old vault flagged for upgrade", nku(oldKeystore));
  const oldUnlocked = await unlockVault(oldKeystore, "password123"); // 11-char password still unlocks — the floor is creation-only
  ok("h2: old-format vault unlocks", oldUnlocked.address === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  const upgraded = await reencryptVault(oldUnlocked, "password123");
  ok("h2: re-encrypted vault is at the new strength", vaultKdfParams(upgraded).N === 262144 && !nku(upgraded));
  const upgradedUnlocked = await unlockVault(upgraded, "password123");
  ok("h2: upgraded vault unlocks to the same wallet + phrase",
    upgradedUnlocked.address === oldUnlocked.address && upgradedUnlocked.mnemonic.phrase === KNOWN_PHRASE);
  ok("h2: garbage keystore → no params, no upgrade", vaultKdfParams("not json") === null && !nku("not json"));
}

// ---------- BTC-family fee safety (security audit H1 + L2) ----------
// Fee rates are resolved from TWO sources with a coded ceiling; the
// send sheets build the transaction at review time and show the exact
// fee. Coin selection spends confirmed UTXOs only.
{
  const { resolveFeeRate, feeRateNote, resolveDogeFeeRate, DOGE_FEE_CEILING_KOINU_BYTE,
    BTC_FEE_CEILING_SATVB, LTC_FEE_CEILING_SATVB, planBitcoinSend } = await import("../src/wallet-core.js");
  const agree = resolveFeeRate({ primary: 20, secondary: 22, ceiling: 300 });
  ok("h1: agreeing sources → primary rate, no flags", agree.rate === 20 && !agree.diverged && !agree.clamped && agree.sources === 2);
  const diverged = resolveFeeRate({ primary: 900, secondary: 30, ceiling: 300 });
  ok("h1: >2× divergence → lower rate, flagged", diverged.rate === 30 && diverged.diverged && !diverged.clamped);
  const clamped = resolveFeeRate({ primary: 800, secondary: 780, ceiling: 300 });
  ok("h1: agreeing-but-huge → clamped to ceiling", clamped.rate === 300 && clamped.clamped && !clamped.diverged);
  const both = resolveFeeRate({ primary: 1200, secondary: 500, ceiling: 300 });
  ok("h1: diverged AND over ceiling → lower, then clamped", both.rate === 300 && both.diverged && both.clamped);
  ok("h1: ceilings are the coded constants", BTC_FEE_CEILING_SATVB === 300 && LTC_FEE_CEILING_SATVB === 100);
  ok("h1: single source is used", resolveFeeRate({ primary: null, secondary: 15, ceiling: 300 }).rate === 15
    && resolveFeeRate({ primary: 7, secondary: null, ceiling: 300 }).sources === 1);
  const none = resolveFeeRate({ primary: NaN, secondary: -3, ceiling: 300, fallback: 5 });
  ok("h1: garbage/absent sources → fallback, sources 0", none.rate === 5 && none.sources === 0);
  ok("h1: rate floor is 1 sat/vB", resolveFeeRate({ primary: 0.2, secondary: null, ceiling: 300 }).rate === 1);
  ok("h1: notes disclose divergence / clamp / fallback, silent when clean",
    feeRateNote(diverged).includes("lower rate") && feeRateNote(clamped).includes("capped")
    && feeRateNote(none).includes("default rate") && feeRateNote(agree) === "" && feeRateNote(null) === "");
  ok("h1: doge rate floors, defaults and clamps",
    resolveDogeFeeRate(null).rate === 10000 && resolveDogeFeeRate(500).rate === 1000
    && resolveDogeFeeRate(5000).rate === 5000 && !resolveDogeFeeRate(5000).clamped
    && resolveDogeFeeRate(250000).rate === DOGE_FEE_CEILING_KOINU_BYTE && resolveDogeFeeRate(250000).clamped);
  const coreSrc = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("l2: the dead UTXO filter (|| true) is gone", !coreSrc.includes("confirmed !== false || true"));
  // planBitcoinSend, fully offline via a stubbed fetch: the wallet holds
  // one confirmed 100,000-sat UTXO and one UNCONFIRMED 500,000-sat UTXO.
  // The plan must spend only the confirmed one: fee = 140 vB × 10 sat/vB.
  const realFetch = globalThis.fetch;
  const utxoSet = [
    { txid: "aa".repeat(32), vout: 0, value: 100000, status: { confirmed: true, block_height: 800000 } },
    { txid: "bb".repeat(32), vout: 1, value: 500000, status: { confirmed: false } },
  ];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/v1/fees/recommended")) return { ok: true, json: async () => ({ halfHourFee: 10 }) };
    if (u.includes("blockstream.info/api/fee-estimates")) return { ok: true, json: async () => ({ "3": 11, "6": 8 }) };
    if (u.includes("/address/") && u.endsWith("/utxo")) return { ok: true, json: async () => utxoSet };
    throw new Error("unexpected fetch " + u);
  };
  try {
    const dest = bitcoinAddress(KNOWN_PHRASE); // self-send target is fine for a plan (never broadcast)
    const plan = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005 });
    ok("h1: plan resolves the cross-checked rate", plan.rate === 10 && plan.rateInfo && plan.rateInfo.sources === 2);
    ok("h1+l2: plan spends confirmed UTXOs only, exact fee", plan.feeSat === 1400 && plan.feeBtc === 0.000014
      && typeof plan.hex === "string" && /^[0-9a-f]{64}$/.test(plan.txid));
    await assert.rejects(
      () => planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0055 }),
      /Not enough confirmed BTC/);
    ok("l2: unconfirmed balance cannot be spent", true);
  } finally { globalThis.fetch = realFetch; }
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("h1: all four BTC-family sheets plan-then-broadcast",
    appSrc.includes("planBitcoinSend") && appSrc.includes("broadcastBitcoinTx")
    && appSrc.includes("planLitecoinSend") && appSrc.includes("broadcastLitecoinTx")
    && appSrc.includes("planDogecoinSend") && appSrc.includes("broadcastDogeTx")
    && appSrc.includes("planBitcoinCashSend") && appSrc.includes("broadcastBitcoinCashTx")
    && !appSrc.includes("Network fee will be added at the current rate"));
  ok("h1: intent formatters carry USD + note when given",
    formatLitecoinSendIntent({ amount: "1", to: "ltc1qxy", feeLtc: "0.00001400", feeUsd: "$0.01", note: "n" })
      .includes("($0.01)") && formatLitecoinSendIntent({ amount: "1", to: "ltc1qxy", feeLtc: "0.00001400" }).endsWith("Confirm?"));
}

// ---------- swap step bounds (security audit M1) ----------
// A route's step transactions are network data: their value and
// gasLimit are bounded against the quote the user confirmed, and a
// breach refuses the route before any approval or signature.
{
  const { checkSwapStepBounds, executeSwapRoute } = await import("../src/wallet-core.js");
  const ETH = (n) => BigInt(Math.round(n * 1e18)).toString();
  const nativeStep = (value, gasLimit, gasEst) => ({
    action: { fromToken: { address: "0x0000000000000000000000000000000000000000", symbol: "BNB", decimals: 18 }, fromAmount: ETH(1) },
    estimate: { gasCosts: gasEst != null ? [{ amount: ETH(0.003), estimate: String(gasEst) }] : [] },
    transactionRequest: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0x", value, gasLimit, chainId: 56 },
  });
  const route = { fromChainId: 56, fromAmount: ETH(1) };
  ok("m1: native step at the quoted value passes", checkSwapStepBounds(route, nativeStep(ETH(1), "21000", 200000)).ok);
  ok("m1: native step within 2% tolerance passes", checkSwapStepBounds(route, nativeStep(ETH(1.01), "21000", 200000)).ok);
  const overValue = checkSwapStepBounds(route, nativeStep(ETH(1.5), "21000", 200000));
  ok("m1: native step 50% over the quote is refused", !overValue.ok && /more value than the amount you agreed/.test(overValue.reason));
  const tokenStep = (value, gasLimit) => ({
    action: { fromToken: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 }, fromAmount: "100000000" },
    estimate: { gasCosts: [{ amount: ETH(0.003), estimate: "150000" }] },
    transactionRequest: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0x", value, gasLimit, chainId: 56 },
  });
  ok("m1: token step with zero value passes", checkSwapStepBounds(route, tokenStep("0", "200000")).ok);
  ok("m1: token step value within its declared gas costs passes", checkSwapStepBounds(route, tokenStep(ETH(0.002), "200000")).ok);
  ok("m1: token step carrying real value is refused", !checkSwapStepBounds(route, tokenStep(ETH(0.5), "200000")).ok);
  ok("m1: gasLimit within 3× the estimate passes", checkSwapStepBounds(route, nativeStep(ETH(1), "500000", 200000)).ok);
  const overGas = checkSwapStepBounds(route, nativeStep(ETH(1), "700000", 200000));
  ok("m1: gasLimit beyond 3× the estimate is refused", !overGas.ok && /gas limit far above/.test(overGas.reason));
  ok("m1: no estimate → fallback cap applies", checkSwapStepBounds(route, nativeStep(ETH(1), "1900000", null)).ok
    && !checkSwapStepBounds(route, nativeStep(ETH(1), "2100000", null)).ok);
  ok("m1: a hostile huge estimate cannot lift the absolute cap",
    !checkSwapStepBounds(route, nativeStep(ETH(1), "20000000", 10000000)).ok);
  // End-to-end: the executor itself refuses the hostile route before
  // touching the network (bounds run ahead of allowance/signing).
  const hostileRoute = { fromChainId: 56, fromAmount: ETH(1), steps: [nativeStep(ETH(2), "21000", 200000)] };
  await assert.rejects(
    () => executeSwapRoute(ethers.Wallet.createRandom(), hostileRoute),
    /Fluid refused this route/);
  ok("m1: executeSwapRoute refuses a hostile step before signing", true);
}

// ---------- registry/agent label escaping (security audit M3) ----------
// Discovered-chain names/symbols are community-submitted registry data:
// sanitised at the gate AND escaped at every render (picker, agent list,
// agent approval sheet).
{
  const { sanitizeChainLabel, sanitizeChainSymbol, gateChains } = await import("../src/wallet-core.js");
  ok("m3: hostile chain label loses all markup characters",
    !/[<>"'`]/.test(sanitizeChainLabel(`<img src=x onerror=alert(1)> Chain`)));
  ok("m3: legitimate chain labels pass through unchanged",
    sanitizeChainLabel("BNB Smart Chain") === "BNB Smart Chain"
    && sanitizeChainLabel("B² Network") === "B² Network"
    && sanitizeChainLabel("zkSync Era") === "zkSync Era");
  ok("m3: symbol sanitiser strips markup, keeps tickers",
    sanitizeChainSymbol("USDC") === "USDC" && !/[<>]/.test(sanitizeChainSymbol("<b>EVL</b>")));
  const out = gateChains({
    lifiChains: [], tvl: [{ chainId: 777001, tvl: 50_000_000 }],
    registry: [{ chainId: 777001, name: `<img src=x onerror=alert(1)> Chain`, rpc: ["https://rpc-777001.example"],
      nativeCurrency: { symbol: "<b>EVL</b>", decimals: 18 }, status: "active" }],
  });
  const c = out.find(x => x.chainId === 777001);
  ok("m3: gate admits the chain but its labels arrive inert", !!c && !/[<>]/.test(c.name) && !/[<>]/.test(c.symbol));
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("m3: picker escapes discovered labels", appSrc.includes("esc(label)") && appSrc.includes("esc(sub)"));
  ok("m3: agent list + approval sheet escape agent/network names",
    appSrc.includes("esc(a.name)") && appSrc.includes("esc(net.symbol)") && appSrc.includes("esc(net.name)") && appSrc.includes("esc(to)"));
}

// ---------- on-chain approvals scan (security audit M5) ----------
// The approvals screen must see approvals granted by ANY app on this
// address, not just Fluid's own records. The scan runs against a
// stubbed JSON-RPC endpoint (offline): Multicall3 answers allowance()
// for a fixture grid; only positive allowances come back.
{
  const { scanOnChainAllowances, LIFI_DIAMOND } = await import("../src/wallet-core.js");
  ok("m5: LI.FI diamond spender is the canonical one", LIFI_DIAMOND === "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
  ok("m5: empty token/spender sets scan to nothing, no network",
    (await scanOnChainAllowances("bsc", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", [], [])).length === 0);
  await assert.rejects(() => scanOnChainAllowances("nope", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", [], []), /Unknown network/);
  ok("m5: unknown network is refused", true);
  const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const TOK_A = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const TOK_B = "0x55d398326f99059fF775485246999027B3197955";
  const OTHER = "0x1111111111111111111111111111111111111111";
  const MAX = (1n << 256n) - 1n;
  const grid = new Map([
    [`${TOK_A.toLowerCase()}|${LIFI_DIAMOND.toLowerCase()}`, 5000000n],
    [`${TOK_B.toLowerCase()}|${LIFI_DIAMOND.toLowerCase()}`, MAX],
  ]);
  const mcIface = new ethers.Interface(["function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[])"]);
  const ercIface = new ethers.Interface(["function allowance(address owner, address spender) view returns (uint256)"]);
  // ethers speaks JSON-RPC over node:http in Node (global fetch stubs
  // can't intercept it), so the fixture is a real local RPC server and
  // a throwaway registered network pointing at it.
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const parsed = JSON.parse(raw);
      const answer = (body) => {
        if (body.method === "eth_chainId") return "0x" + (4252023).toString(16);
        if (body.method === "eth_blockNumber") return "0x100";
        if (body.method === "eth_getCode") return "0x60016000"; // Multicall3 "deployed"
        if (body.method === "eth_call") {
          const [calls] = mcIface.decodeFunctionData("aggregate3", body.params[0].data);
          const results = calls.map(c => {
            const [, spender] = ercIface.decodeFunctionData("allowance", c.callData);
            const v = grid.get(`${c.target.toLowerCase()}|${spender.toLowerCase()}`) || 0n;
            return [true, ercIface.encodeFunctionResult("allowance", [v])];
          });
          return mcIface.encodeFunctionResult("aggregate3", [results]);
        }
        return "0x0";
      };
      res.setHeader("content-type", "application/json");
      // ethers batches same-tick requests into one array payload.
      if (Array.isArray(parsed)) {
        return res.end(JSON.stringify(parsed.map(b => ({ jsonrpc: "2.0", id: b.id, result: answer(b) }))));
      }
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: answer(parsed) }));
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const { registerNetworks } = await import("../src/wallet-core.js");
  registerNetworks({ xapprov: { name: "Approvals Fixture", chainId: 4252023, symbol: "FIX", priceSym: null,
    rpc: `http://127.0.0.1:${server.address().port}`, explorer: null, tokens: [] } });
  try {
    const found = await scanOnChainAllowances("xapprov", OWNER,
      [{ address: TOK_A, symbol: "USDC", decimals: 18 }, { address: TOK_B, symbol: "USDT", decimals: 18 },
       { address: "0x0000000000000000000000000000000000000000", symbol: "NATIVE", decimals: 18 }],
      [LIFI_DIAMOND, OTHER]);
    ok("m5: scan returns exactly the positive allowances", found.length === 2);
    const a = found.find(r => r.token === TOK_A), b = found.find(r => r.token === TOK_B);
    ok("m5: finite allowance reported verbatim", !!a && a.allowance === "5000000" && a.unlimited === false && a.spender === LIFI_DIAMOND);
    ok("m5: max allowance flagged unlimited", !!b && b.unlimited === true);
  } finally { server.close(); }
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("m5: approvals screen has labelled on-chain + records sections",
    appSrc.includes("apChainList") && appSrc.includes("scanOnChainAllowances") && appSrc.includes("Fluid's records"));
}

// ---------- username-at-top home header (Ethuram's requirement) ----------
// The wallet home opens with "Welcome, <name>" when a Fluid name is
// owned/adopted, plain "Welcome" otherwise — above the balance hero.
{
  const { formatWelcomeHeader } = await import("../src/wallet-core.js");
  ok("welcome: owned name greets by name", formatWelcomeHeader("ethuram") === "Welcome, ethuram");
  ok("welcome: no name → plain Welcome", formatWelcomeHeader(null) === "Welcome"
    && formatWelcomeHeader("") === "Welcome" && formatWelcomeHeader("  ") === "Welcome"
    && formatWelcomeHeader(undefined) === "Welcome");
  ok("welcome: surrounding whitespace is trimmed", formatWelcomeHeader("  dripbot ") === "Welcome, dripbot");
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("welcome: header element sits at the top of the wallet tab, set via textContent from the name state",
    idxSrc.indexOf('id="welcomeText"') > idxSrc.indexOf('id="tab-wallet"')
    && idxSrc.indexOf('id="welcomeText"') < idxSrc.indexOf('class="hero"')
    && appSrc.includes('$("welcomeText").textContent = formatWelcomeHeader(stored)'));
}

// ---------- low bundle: full wipe (L3) + full address in name intents (L1) ----------
// (L2, confirmed-only BTC coin selection, shipped with the H1 fee work.)
{
  const { fluidStorageKeysToWipe } = await import("../src/wallet-core.js");
  const all = ["fluid_vault_v1", "fluid_name", "fluid_history_v1", "fluid_approvals_v1", "fluid_agents_v1",
    "fluid_agent_spend_v1", "fluid_chains_v1", "fluid_custom_tokens_v1", "fluid_lifi_tokens_v1",
    "fluid_country", "fluid_ogo_notify", "other_app_key", "fluidx", "xfluid_name"];
  const wiped = fluidStorageKeysToWipe(all);
  ok("l3: wipe takes every fluid_* key and nothing else",
    wiped.length === 11 && wiped.includes("fluid_vault_v1") && wiped.includes("fluid_agent_spend_v1")
    && !wiped.includes("other_app_key") && !wiped.includes("fluidx"));
  const named = formatSendIntent({ amount: "0.05", symbol: "BNB", to: fresh.address, networkKey: "bsc", feeNative: "0.000105", name: "ethuram" });
  ok("l1: name-send intent shows the FULL resolved address",
    named.includes(`ethuram.fluid.is-a.dev (${fresh.address})`) && !named.includes("…"));
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("l3: the wipe handler runs the full-key filter",
    appSrc.includes("fluidStorageKeysToWipe(allKeys)") && !appSrc.includes('localStorage.removeItem(VAULT_KEY); localStorage.removeItem("fluid_name")'));
}

// ---------- agent runtime send serialisation (security audit M6) ----------
// The daily-cap race: check-then-send must be atomic within the process.
// The queue primitive is tested directly (strict order, max concurrency
// 1, a rejected task doesn't jam the queue); the reservation is pinned
// by source inspection.
{
  const { createSendQueue } = await import("../agent/fluid-agent.mjs");
  const enqueue = createSendQueue();
  const order = []; let active = 0, maxActive = 0;
  const task = (id, ms) => async () => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(r => setTimeout(r, ms));
    order.push(id); active--;
    if (id === 2) throw new Error("boom");
    return id;
  };
  const results = await Promise.allSettled([enqueue(task(1, 30)), enqueue(task(2, 5)), enqueue(task(3, 5))]);
  ok("m6: queued sends run strictly one at a time, in order",
    maxActive === 1 && order.join(",") === "1,2,3");
  ok("m6: a failed send rejects its caller but not the queue",
    results[0].status === "fulfilled" && results[1].status === "rejected" && results[2].status === "fulfilled");
  const agentSrc = readFileSync(new URL("../agent/fluid-agent.mjs", import.meta.url), "utf8");
  ok("m6: send() is routed through the queue and reserves before broadcast",
    agentSrc.includes("send: (args) => enqueueSend(() => sendLocked(args))")
    && agentSrc.indexOf("RESERVE the spend on disk BEFORE broadcasting") < agentSrc.indexOf("sendTransaction"));
}

// ---------- red-team F-01: swap step payload inspection ----------
// Value/gas bounds alone do not make a step safe: its calldata, its
// target and the approval spender are network data too. A step whose
// calldata is a raw ERC-20 transfer/approve, a step aimed at the sold
// token's own contract, or an approval addressed to a third-party
// spender all refuse before signing; honest router shapes still pass.
{
  const { checkSwapStepBounds } = await import("../src/wallet-core.js");
  const ETH = (n) => BigInt(Math.round(n * 1e18)).toString();
  const DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
  const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const ATTACKER = "0x00000000000000000000000000000000deadbeef";
  const route = { fromChainId: 56, fromAmount: ETH(1) };
  const gas = [{ amount: ETH(0.003), estimate: "150000" }];
  const tokenStep = (over) => ({
    action: { fromToken: { address: USDC, symbol: "USDC", decimals: 18 }, fromAmount: "100000000" },
    estimate: { gasCosts: gas },
    transactionRequest: { to: DIAMOND, data: "0x", value: "0", gasLimit: "200000", chainId: 56 },
    ...over,
  });
  const rA = checkSwapStepBounds(route, tokenStep({ estimate: { gasCosts: gas, approvalAddress: ATTACKER } }));
  ok("rt-f01: approval addressed to a third-party spender is refused", !rA.ok && /unexpected spender/.test(rA.reason));
  const stepB = tokenStep({ transactionRequest: { to: USDC, data: "0xa9059cbb" + "0".repeat(64), value: "0", gasLimit: "200000", chainId: 56 } });
  ok("rt-f01: raw ERC-20 transfer calldata in a step is refused", !checkSwapStepBounds(route, stepB).ok);
  const stepC = {
    action: { fromToken: { address: "0x0000000000000000000000000000000000000000", symbol: "BNB", decimals: 18 }, fromAmount: ETH(1) },
    estimate: { gasCosts: [{ amount: ETH(0.003), estimate: "200000" }] },
    transactionRequest: { to: DIAMOND, data: "0x095ea7b3" + "f".repeat(64), value: ETH(1), gasLimit: "200000", chainId: 56 },
  };
  ok("rt-f01: native step carrying approve calldata is refused", !checkSwapStepBounds(route, stepC).ok);
  ok("rt-f01: approval addressed to the LI.FI diamond passes",
    checkSwapStepBounds(route, tokenStep({ estimate: { gasCosts: gas, approvalAddress: DIAMOND } })).ok);
  const ROUTER = "0x1111111111111111111111111111111111111111";
  const stepR = tokenStep({
    transactionRequest: { to: ROUTER, data: "0x", value: "0", gasLimit: "200000", chainId: 56 },
    estimate: { gasCosts: gas, approvalAddress: ROUTER },
  });
  ok("rt-f01: approval addressed to the step's own router passes", checkSwapStepBounds(route, stepR).ok);
}

// ---------- red-team F-02: Solana step instruction inspection ----------
// The fee-payer check authenticates the victim, not the payload: a
// "swap" transaction whose payer is the user can still carry top-level
// instructions that drain the user. Those shapes refuse before signing;
// account creation (WSOL/ATA plumbing) and ordinary program calls pass.
{
  const { assertSolanaStepSafe } = await import("../src/wallet-core.js");
  const SYS = "11111111111111111111111111111111";
  const TOK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOK22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  const u32 = (n) => { const b = new Uint8Array(12); new DataView(b.buffer).setUint32(0, n, true); return b; };
  assert.throws(() => assertSolanaStepSafe([{ program: SYS, data: u32(2) }]), /send SOL directly/);
  ok("rt-f02: SystemProgram transfer in a swap step is refused", true);
  assert.throws(() => assertSolanaStepSafe([{ program: TOK, data: new Uint8Array([3, 1, 0, 0, 0, 0, 0, 0, 0]) }]), /move, approve, burn or close/);
  ok("rt-f02: SPL token transfer in a swap step is refused", true);
  assert.throws(() => assertSolanaStepSafe([{ program: TOK22, data: new Uint8Array([16, 1]) }]), /move, approve, burn or close/);
  ok("rt-f02: Token-2022 approveChecked in a swap step is refused", true);
  assertSolanaStepSafe([{ program: SYS, data: u32(0) }]); // CreateAccount
  ok("rt-f02: SystemProgram CreateAccount (WSOL/ATA plumbing) passes", true);
  assertSolanaStepSafe([{ program: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", data: new Uint8Array([104, 105]) }]);
  ok("rt-f02: benign memo instruction passes", true);
  const coreSrc = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("rt-f02: inspection runs before signing on both tx shapes",
    coreSrc.indexOf("assertSolanaStepSafe(vtx.message.compiledInstructions") < coreSrc.indexOf("vtx.sign([kp])")
    && coreSrc.indexOf("assertSolanaStepSafe(tx.instructions") < coreSrc.indexOf("tx.partialSign(kp)"));
}

// ---------- red-team F-04: Tron swap step payload inspection ----------
// A TVM step signs sha256(raw_data): the inspection decodes the
// protobuf bytes themselves and refuses anything that is not exactly
// the quoted swap — a plain TRC-20 transfer dressed as a step, a txID
// that does not hash to the bytes, a step spending from another
// account, value above the quote, or a fee_limit that could burn the
// wallet's TRX. The decoder is pinned against a REAL unsigned
// transaction built by TronGrid during the 2026-11-07 build (a USDT
// transfer from the public BIP39 test-vector account — construction
// only, no funds ever moved).
{
  const { tronSwapSteps, decodeTronRawData, checkTronSwapStepBounds } = await import("../src/wallet-core.js");
  const OWNER = "TJ3vimbteHtgwxEvuHnbxxnSM99qQGQ5Ri"; // BIP39 "legal winner…" test vector
  const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const FIXTURE_HEX = "0a0291442208924317d58505c0aa40a894cdaa9b345aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a154158a57ed9d8d624cbd12e2c467d34787555bb1b25121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000000000000000f424070bcd2c9aa9b34900180c2d72f";
  const FIXTURE_TXID = "42f4519ade6e7d5d9e87b4170467508a4732535327541695db321b1421fefdfe";
  const dec = decodeTronRawData(FIXTURE_HEX);
  ok("rt-f04: decoder reads a genuine TronGrid transaction", dec.contracts.length === 1 && dec.contracts[0].type === 31
    && dec.contracts[0].trigger.ownerAddress === tronAddressToHex(OWNER)
    && dec.contracts[0].trigger.contractAddress === tronAddressToHex(USDT)
    && dec.contracts[0].trigger.callValue === 0n && dec.feeLimit === 100000000n
    && dec.contracts[0].trigger.data.startsWith("a9059cbb"));
  ok("rt-f04: fixture txID is sha256 of the raw bytes", ethers.sha256("0x" + FIXTURE_HEX).slice(2) === FIXTURE_TXID);
  const fixtureStep = {
    action: { fromToken: { address: USDT, symbol: "USDT", decimals: 6 }, fromAmount: "1000000" },
    estimate: { gasCosts: [{ amount: "20000000" }] },
    transactionRequest: { to: USDT, value: "0x0", gasLimit: "0x5f5e100", data: "0x" + FIXTURE_HEX,
      customData: { contractType: "TriggerSmartContract", tronTransaction: { txID: FIXTURE_TXID, raw_data_hex: FIXTURE_HEX } } },
  };
  ok("rt-f04: tron steps are picked by the verified payload shape", tronSwapSteps({ fromChainId: TRON_LIFI_CHAIN_ID, steps: [fixtureStep] }).length === 1
    && tronSwapSteps({ fromChainId: TRON_LIFI_CHAIN_ID, steps: [{ transactionRequest: { data: "0x" } }] }).length === 0);
  ok("rt-f04: a plain TRC-20 transfer dressed as a step is refused",
    !checkTronSwapStepBounds({ fromChainId: TRON_LIFI_CHAIN_ID }, fixtureStep, OWNER).ok
    && /token being sold/.test(checkTronSwapStepBounds({ fromChainId: TRON_LIFI_CHAIN_ID }, fixtureStep, OWNER).reason));
  // Synthetic honest payloads, assembled with a minimal protobuf writer
  // (the decoder's inverse).
  const pv = (n) => { const out = []; let v = BigInt(n); do { let b = Number(v & 0x7fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); return out; };
  const pfV = (f, n) => [...pv(f * 8), ...pv(n)];
  const pfB = (f, bytes) => [...pv(f * 8 + 2), ...pv(bytes.length), ...bytes];
  const hb = (h) => [...Buffer.from(h, "hex")];
  const buildRaw = ({ ownerHex, contractHex, callValue = 0n, dataHex = "38ed1739" + "00".repeat(32), feeLimit = 100_000_000n }) => {
    const tsc = [...pfB(1, hb(ownerHex)), ...pfB(2, hb(contractHex)), ...(callValue > 0n ? pfV(3, callValue) : []), ...pfB(4, hb(dataHex))];
    const any = [...pfB(1, [...Buffer.from("type.googleapis.com/protocol.TriggerSmartContract")]), ...pfB(2, tsc)];
    const contract = [...pfV(1, 31), ...pfB(2, any)];
    const now = Date.now();
    return Buffer.from([...pfB(11, contract), ...pfV(14, now), ...pfV(8, now + 600_000), ...pfV(18, feeLimit)]).toString("hex");
  };
  const ROUTER = tronAddressFromHex("41" + "22".repeat(20));
  const ownerHex = tronAddressToHex(OWNER), routerHex = tronAddressToHex(ROUTER);
  const mkStep = (rawHex, over = {}) => ({
    action: { fromToken: { address: USDT, symbol: "USDT", decimals: 6 }, fromAmount: "1000000" },
    estimate: { gasCosts: [{ amount: "20000000" }], approvalAddress: ROUTER },
    transactionRequest: { to: ROUTER, value: "0x0", gasLimit: "0x5f5e100", data: "0x" + rawHex,
      customData: { contractType: "TriggerSmartContract", tronTransaction: { txID: ethers.sha256("0x" + rawHex).slice(2), raw_data_hex: rawHex } } },
    ...over,
  });
  const routeT = { fromChainId: TRON_LIFI_CHAIN_ID };
  const goodRaw = buildRaw({ ownerHex, contractHex: routerHex });
  ok("rt-f04: an honest router step passes inspection", checkTronSwapStepBounds(routeT, mkStep(goodRaw), OWNER).ok);
  const badId = mkStep(goodRaw); badId.transactionRequest.customData.tronTransaction.txID = "00".repeat(32);
  ok("rt-f04: a txID that does not hash to the bytes is refused", !checkTronSwapStepBounds(routeT, badId, OWNER).ok
    && /does not match its contents/.test(checkTronSwapStepBounds(routeT, badId, OWNER).reason));
  const badData = mkStep(goodRaw); badData.transactionRequest.data = "0xdeadbeef";
  ok("rt-f04: two disagreeing transaction forms are refused", !checkTronSwapStepBounds(routeT, badData, OWNER).ok);
  ok("rt-f04: a step spending from another account is refused",
    !checkTronSwapStepBounds(routeT, mkStep(buildRaw({ ownerHex: "41" + "33".repeat(20), contractHex: routerHex })), OWNER).ok);
  const bigFeeRaw = buildRaw({ ownerHex, contractHex: routerHex, feeLimit: 900_000_000n });
  const bigFee = mkStep(bigFeeRaw); bigFee.transactionRequest.gasLimit = "0x35a4e900";
  ok("rt-f04: a fee_limit far above the step's own estimate is refused", !checkTronSwapStepBounds(routeT, bigFee, OWNER).ok
    && /fee limit/.test(checkTronSwapStepBounds(routeT, bigFee, OWNER).reason));
  const nativeOver = mkStep(buildRaw({ ownerHex, contractHex: routerHex, callValue: 60_000_000n }), {
    action: { fromToken: { address: TRON_SWAP_NATIVE_TOKEN, symbol: "TRX", decimals: 6 }, fromAmount: "50000000" },
  });
  nativeOver.transactionRequest.value = "0x3938700";
  ok("rt-f04: a native step above the quoted amount is refused", !checkTronSwapStepBounds(routeT, nativeOver, OWNER).ok);
  const nativeOk = mkStep(buildRaw({ ownerHex, contractHex: routerHex, callValue: 50_000_000n }), {
    action: { fromToken: { address: TRON_SWAP_NATIVE_TOKEN, symbol: "TRX", decimals: 6 }, fromAmount: "50000000" },
    estimate: { gasCosts: [{ amount: "20000000" }] },
  });
  nativeOk.transactionRequest.value = "0x2faf080";
  ok("rt-f04: an honest native step passes inspection", checkTronSwapStepBounds(routeT, nativeOk, OWNER).ok);
  const badApproval = mkStep(goodRaw); badApproval.estimate.approvalAddress = USDT;
  ok("rt-f04: an approval addressed to the token contract is refused", !checkTronSwapStepBounds(routeT, badApproval, OWNER).ok);
  const thirdParty = mkStep(goodRaw); thirdParty.estimate.approvalAddress = tronAddressFromHex("41" + "44".repeat(20));
  ok("rt-f04: an approval addressed to a third-party spender is refused", !checkTronSwapStepBounds(routeT, thirdParty, OWNER).ok
    && /unexpected spender/.test(checkTronSwapStepBounds(routeT, thirdParty, OWNER).reason));
  const coreSrc2 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("rt-f04: bounds inspection runs before approval and signing",
    coreSrc2.indexOf("checkTronSwapStepBounds(route, step, owner)") < coreSrc2.indexOf("signTronTxId(wallet, tt.txID)")
    && coreSrc2.indexOf("checkTronSwapStepBounds(route, step, owner)") < coreSrc2.indexOf("tronTriggerAndBroadcast(wallet, {\n          contractAddress: fromToken.address"));
}

// ---------- red-team F-05: Sui swap step payload inspection ----------
// An MVM step is inspected in its BUILT form — the exact bytes the
// wallet signs — with every owned-object input resolved on-chain.
// Refused: a foreign sender or gas owner, a gas budget beyond the
// bound, Publish/Upgrade commands, FundsWithdrawal inputs, transfers
// to anyone but the sender, spending a second asset, or spending more
// of the sold coin than the quote.
{
  const { checkSuiSwapStepSafety, SUI_STEP_GAS_ABSOLUTE_CAP } = await import("../src/wallet-core.js");
  const ME = "0x2695f469826971eadfea28e0f8719137482502c44140aead682d41231d60ba92"; // test-vector Sui address
  const OTHER = "0x" + "99".repeat(32);
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  const addrPure = (a) => ({ $kind: "Pure", Pure: { bytes: b64(Buffer.from(a.slice(2), "hex")) } });
  const u64Pure = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return { $kind: "Pure", Pure: { bytes: b64(b) } }; };
  const baseData = (over = {}) => ({
    version: 2, sender: ME, gasData: { budget: "5000000", price: "1000", owner: null, payment: [] },
    inputs: [], commands: [], ...over,
  });
  const moveCall = { $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [] } };
  const SUI_SHORT = "0x2::sui::SUI";
  const suiSale = (splitMist, fromAmount) => baseData({
    inputs: [u64Pure(splitMist)],
    commands: [{ $kind: "SplitCoins", SplitCoins: { coin: { $kind: "GasCoin" }, amounts: [{ $kind: "Input", Input: 0 }] } }, moveCall],
  });
  ok("rt-f05: an honest SUI sale split passes", checkSuiSwapStepSafety(suiSale(1_000_000_000n, 0), { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1000000000" }).ok);
  ok("rt-f05: a gas-coin split above the quoted amount is refused",
    !checkSuiSwapStepSafety(suiSale(2_000_000_000n, 0), { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1000000000" }).ok);
  ok("rt-f05: a transaction built for a different sender is refused",
    !checkSuiSwapStepSafety(baseData({ sender: OTHER }), { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1" }).ok);
  ok("rt-f05: a gas budget beyond the absolute cap is refused",
    !checkSuiSwapStepSafety(baseData({ gasData: { budget: String(SUI_STEP_GAS_ABSOLUTE_CAP + 1n), price: "1000", owner: null, payment: [] } }),
      { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1" }).ok);
  const xferTo = (addr) => baseData({ inputs: [addrPure(addr)], commands: [{ $kind: "TransferObjects", TransferObjects: { objects: [], address: { $kind: "Input", Input: 0 } } }] });
  ok("rt-f05: a transfer to a third party is refused", !checkSuiSwapStepSafety(xferTo(OTHER), { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1" }).ok);
  ok("rt-f05: a transfer back to the sender passes", checkSuiSwapStepSafety(xferTo(ME), { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1" }).ok);
  ok("rt-f05: a package publish inside a swap step is refused",
    !checkSuiSwapStepSafety(baseData({ commands: [{ $kind: "Publish", Publish: { modules: [], dependencies: [] } }] }),
      { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1" }).ok);
  const coinInput = (objectId) => ({ $kind: "Object", Object: { ImmOrOwnedObject: { objectId, version: "1", digest: "x" } } });
  const USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
  const usdcInfo = (balance) => new Map([[0, { owner: ME, type: `0x2::coin::Coin<${USDC_TYPE}>`, balance }]]);
  const callWithInput = { $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [{ $kind: "Input", Input: 0 }] } };
  const usdcIn = baseData({ inputs: [coinInput("0x" + "aa".repeat(32))], commands: [moveCall] });
  ok("rt-f05: an honest token sale input passes", checkSuiSwapStepSafety(usdcIn,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: usdcInfo(1000000n) }).ok);
  // The aggregator pattern: the wallet's coin is merged/split INSIDE the
  // PTB and only the quoted amount leaves it — a coin balance above the
  // quote is not an overspend.
  const splitFromInput = (splitAmt, balance) => ({
    data: baseData({ inputs: [coinInput("0x" + "aa".repeat(32)), u64Pure(splitAmt)], commands: [
      { $kind: "SplitCoins", SplitCoins: { coin: { $kind: "Input", Input: 0 }, amounts: [{ $kind: "Input", Input: 1 }] } },
      { $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [{ $kind: "Result", Result: 0 }] } },
    ] }),
    info: usdcInfo(balance),
  });
  const honestSplit = splitFromInput(1000000n, 5000000n);
  ok("rt-f05: a split of the quoted amount off a larger coin passes", checkSuiSwapStepSafety(honestSplit.data,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: honestSplit.info }).ok);
  const greedySplit = splitFromInput(2000000n, 5000000n);
  ok("rt-f05: a split above the quoted amount is refused", !checkSuiSwapStepSafety(greedySplit.data,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: greedySplit.info }).ok);
  const mergeThen = (lastCmd) => ({
    data: baseData({ inputs: [coinInput("0x" + "aa".repeat(32)), coinInput("0x" + "bb".repeat(32)), u64Pure(1000000n)], commands: [
      { $kind: "MergeCoins", MergeCoins: { destination: { $kind: "Input", Input: 0 }, sources: [{ $kind: "Input", Input: 1 }] } },
      { $kind: "SplitCoins", SplitCoins: { coin: { $kind: "Input", Input: 0 }, amounts: [{ $kind: "Input", Input: 2 }] } },
      lastCmd,
    ] }),
    info: new Map([[0, { owner: ME, type: `0x2::coin::Coin<${USDC_TYPE}>`, balance: 3000000n }], [1, { owner: ME, type: `0x2::coin::Coin<${USDC_TYPE}>`, balance: 2000000n }]]),
  });
  const mergedSplit = mergeThen({ $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [{ $kind: "Result", Result: 1 }] } });
  ok("rt-f05: merge-then-split of the quoted amount passes", checkSuiSwapStepSafety(mergedSplit.data,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: mergedSplit.info }).ok);
  const mergedWhole = mergeThen({ $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [{ $kind: "Input", Input: 0 }] } });
  ok("rt-f05: a merged pool taken whole above the quote is refused", !checkSuiSwapStepSafety(mergedWhole.data,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: mergedWhole.info }).ok);
  const usdcByValue = baseData({ inputs: [coinInput("0x" + "aa".repeat(32))], commands: [callWithInput] });
  ok("rt-f05: a sold coin taken whole by a call above the quote is refused", !checkSuiSwapStepSafety(usdcByValue,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: usdcInfo(2000000n) }).ok);
  ok("rt-f05: spending a second asset inside the step is refused", !checkSuiSwapStepSafety(usdcByValue,
    { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1000000000", inputObjects: usdcInfo(1n) }).ok);
  const usdcByRef = baseData({ inputs: [coinInput("0x" + "aa".repeat(32))], commands: [
    { $kind: "MoveCall", MoveCall: { package: "0x2", module: "coin", function: "value", typeArguments: [], arguments: [{ $kind: "Input", Input: 0 }], _argumentTypes: [{ reference: "immutable", body: {} }] } },
  ] });
  ok("rt-f05: a by-reference read of a coin exposes nothing", checkSuiSwapStepSafety(usdcByRef,
    { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1000000000", inputObjects: usdcInfo(5000000n) }).ok);
  const gasByValue = baseData({ commands: [
    { $kind: "MoveCall", MoveCall: { package: "0xabc", module: "router", function: "swap", typeArguments: [], arguments: [{ $kind: "GasCoin" }] } },
  ] });
  ok("rt-f05: the gas coin passed by value to a call is refused", !checkSuiSwapStepSafety(gasByValue,
    { ownerAddress: ME, fromCoinType: SUI_SHORT, fromAmount: "1000000000" }).ok);
  // A SUI-denominated fee split alongside a token sale is bounded by the
  // step's declared fees; beyond them it refuses.
  const feeSplit = (feeAmt) => baseData({ inputs: [u64Pure(feeAmt)], commands: [
    { $kind: "SplitCoins", SplitCoins: { coin: { $kind: "GasCoin" }, amounts: [{ $kind: "Input", Input: 0 }] } }, moveCall,
  ] });
  ok("rt-f05: a gas-coin fee split within the declared fees passes", checkSuiSwapStepSafety(feeSplit(3000000n),
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", suiFeeAllowanceMist: 5000000n }).ok);
  ok("rt-f05: a gas-coin split beyond the declared fees is refused", !checkSuiSwapStepSafety(feeSplit(9000000n),
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", suiFeeAllowanceMist: 5000000n }).ok);
  ok("rt-f05: an unverifiable input object is refused", !checkSuiSwapStepSafety(usdcIn,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000" }).ok);
  ok("rt-f05: a non-coin object of the wallet's is refused", !checkSuiSwapStepSafety(usdcIn,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: new Map([[0, { owner: ME, type: "0x2::kiosk::Kiosk", balance: null }]]) }).ok);
  ok("rt-f05: an object owned by someone else is refused", !checkSuiSwapStepSafety(usdcIn,
    { ownerAddress: ME, fromCoinType: USDC_TYPE, fromAmount: "1000000", inputObjects: new Map([[0, { owner: OTHER, type: `0x2::coin::Coin<${USDC_TYPE}>`, balance: 1000000n }]]) }).ok);
  const coreSrc3 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("rt-f05: built-bytes inspection runs before signing",
    coreSrc3.indexOf("checkSuiSwapStepSafety(data, {") > -1
    && coreSrc3.indexOf("checkSuiSwapStepSafety(data, {") < coreSrc3.indexOf("kp.signTransaction(bytes)"));
}

// ---------- red-team F-03: agent reservation release ----------
// M6 reserved spend on disk before broadcast but released it on ANY
// failure — including failures after the chain accepted the broadcast,
// un-counting money that had moved and letting the daily cap be spent
// again. The release must exist ONLY on the provably pre-broadcast path
// (sendTransaction itself threw); a confirmation failure keeps the
// reservation. Pinned structurally here; the red team's attack-agent
// fixture proves it end-to-end (6 sends land, the 7th is gate-blocked,
// $177 accounted).
{
  const agentSrc = readFileSync(new URL("../agent/fluid-agent.mjs", import.meta.url), "utf8");
  ok("rt-f03: reservation release happens exactly once (pre-broadcast path only)",
    (agentSrc.match(/s2\[today\(\)\] = Math\.max\(0/g) || []).length === 1);
  ok("rt-f03: the release sits before the broadcast/confirmation flow",
    agentSrc.indexOf("s2[today()] = Math.max(0") < agentSrc.indexOf("await tx.wait()"));
  ok("rt-f03: unconfirmed broadcasts keep the spend reserved, stated plainly",
    agentSrc.includes("broadcast but unconfirmed") && agentSrc.includes("spend stays reserved"));
}

// ---------- red-team F-04: agent cap price cross-check ----------
// The agent runtime valued its USD spending caps from Binance alone
// (CoinGecko only filled gaps, never compared) — one lying response
// revalued every cap. Cap valuation now needs both sources agreeing
// within 25% and takes the higher (conservative) value.
// 2026-11-10 repair: the non-CoinGecko leg was repointed from Binance
// (geo-blocked, HTTP 451, from the ops machine) to Coinbase Exchange;
// the agreement rule and these pins are unchanged.
{
  const { getVerifiedPrice } = await import("../src/wallet-core.js");
  const realFetch = globalThis.fetch;
  const stub = (cbPrice, cgPrice) => {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("api.exchange.coinbase.com")) {
        if (cbPrice === null) throw new Error("source down");
        return { json: async () => ({ price: String(cbPrice) }) };
      }
      if (u.includes("api.coingecko.com")) {
        if (cgPrice === null) throw new Error("source down");
        return { json: async () => ({ binancecoin: { usd: cgPrice } }) };
      }
      throw new Error("unexpected fetch " + u);
    };
  };
  try {
    stub(590, 595);
    ok("rt-f04: agreeing sources value at the higher price", (await getVerifiedPrice("BNB")) === 595);
    stub(1, 590);
    await assert.rejects(() => getVerifiedPrice("BNB"), /disagree/);
    ok("rt-f04: a rigged single source (BNB = $1) refuses the valuation", true);
    stub(590, null);
    await assert.rejects(() => getVerifiedPrice("BNB"), /cross-check/);
    ok("rt-f04: one silent source refuses the valuation", true);
    ok("rt-f04: USDT is the unit price without any fetch", (await getVerifiedPrice("USDT")) === 1);
    const agentSrc = readFileSync(new URL("../agent/fluid-agent.mjs", import.meta.url), "utf8");
    ok("rt-f04: agent caps are valued through the cross-check",
      agentSrc.includes("getVerifiedPrice(net.symbol)") && !agentSrc.includes("prices[net.symbol]"));
  } finally { globalThis.fetch = realFetch; }
}

// ---------- red-team F-05: poisoning-warning coverage ----------
// The old EVM check needed first-4 AND last-4, so imitators ground on
// the cheaper side (first-3+last-4, first-4+last-3) slipped through,
// and the Bitcoin sheet — the classic poisoning target — had no check
// at all. Combined-affix matching now covers both evasion shapes, and
// a generic text variant covers bech32/base58 families.
{
  const { looksLikePoisonText } = await import("../src/wallet-core.js");
  const knownEvm = "0x" + "abcdef" + "0".repeat(30) + "beef";
  const imitA = "0x" + "abc" + "f".repeat(33) + "beef";   // first-3 + last-4
  const imitB = "0x" + "abcd" + "f".repeat(33) + "eef";   // first-4 + last-3
  ok("rt-f05: first-3+last-4 imitator warns", looksLikePoison(imitA, [knownEvm]) === knownEvm);
  ok("rt-f05: first-4+last-3 imitator warns", looksLikePoison(imitB, [knownEvm]) === knownEvm);
  ok("rt-f05: unrelated address does not warn", looksLikePoison("0x" + "9".repeat(40), [knownEvm]) === null);
  ok("rt-f05: the address itself does not warn", looksLikePoison(knownEvm, [knownEvm]) === null);
  const knownBtc = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const imitBtc = knownBtc.slice(0, 24) + "qqqq" + knownBtc.slice(-6);
  ok("rt-f05: bech32 lookalike warns via the text check", looksLikePoisonText(imitBtc, [knownBtc]) === knownBtc);
  ok("rt-f05: sharing only the bc1q HRP does not warn",
    looksLikePoisonText("bc1q" + "z".repeat(38), [knownBtc]) === null);
  ok("rt-f05: the BTC address itself does not warn", looksLikePoisonText(knownBtc, [knownBtc]) === null);
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("rt-f05: the Bitcoin sheet runs the lookalike check", appSrc.includes("looksLikePoisonText(to, knownBtc)"));
}

// ---------- red-team F-06: DexScreener dust-pool capture ----------
// Pair selection trusted wash-tradable volume: a $120-liquidity pair
// at $400 used to set BOTH a token's displayed price and its identity
// (renaming it "USD Coin"/"USDC"). Pairs under $1,000 liquidity now
// contribute nothing — the token stays unpriced rather than captured.
// (Selection within qualifying pairs is unchanged: the BONK phantom-
// liquidity behaviour pinned in section 23 must not regress.)
{
  const TOK = "0x1111111111111111111111111111111111111111";
  const data = { pairs: [
    { chainId: "bsc", baseToken: { address: TOK, name: "USD Coin", symbol: "USDC" }, priceUsd: "400", liquidity: { usd: 120 }, volume: { h24: 1000000 } },
    { chainId: "bsc", baseToken: { address: TOK, name: "Real Token", symbol: "REAL" }, priceUsd: "1.00", liquidity: { usd: 50000 }, volume: { h24: 5000 } },
  ] };
  const m = parseDexScreenerPairs(data, "bsc", [TOK]);
  ok("rt-f06: dust pool cannot capture the price", m.get(TOK)?.priceUsd === 1);
  ok("rt-f06: dust pool cannot capture the name", m.get(TOK)?.name === "Real Token" && m.get(TOK)?.symbol === "REAL");
  const dustOnly = { pairs: [
    { chainId: "bsc", baseToken: { address: TOK, name: "USD Coin", symbol: "USDC" }, priceUsd: "400", liquidity: { usd: 120 }, volume: { h24: 1000000 } },
  ] };
  ok("rt-f06: a token with only dust pairs stays unpriced", !parseDexScreenerPairs(dustOnly, "bsc", [TOK]).has(TOK));
}

// ---------- red-team F-07: LNURL invoice verification ----------
// The invoice an LNURL server returned was handed to the payer
// unchecked — a hostile or buggy server could substitute an invoice
// for a different amount. The invoice must now be checksum-valid
// BOLT11 whose encoded amount equals the requested amount exactly.
{
  const { assertBolt11Amount } = await import("../src/wallet-core.js");
  const fakeInvoice = (prefix) => bech32.encode(prefix, new Array(120).fill(0), 4000);
  ok("rt-f07: exact-amount invoice passes", assertBolt11Amount(fakeInvoice("lnbc1000n"), 100000) === true);
  assert.throws(() => assertBolt11Amount(fakeInvoice("lnbc2500n"), 100000), /does not match/);
  ok("rt-f07: wrong-amount invoice is refused", true);
  assert.throws(() => assertBolt11Amount(fakeInvoice("lnbc"), 100000), /amount-less/);
  ok("rt-f07: amount-less invoice is refused for a fixed-amount payment", true);
  assert.throws(() => assertBolt11Amount("lnbc9999999999xnotarealinvoice", 100000), /invalid invoice/);
  ok("rt-f07: garbage invoice string is refused", true);
  ok("rt-f07: milli-bitcoin denominations convert exactly", assertBolt11Amount(fakeInvoice("lnbc1m"), 100000000) === true);
}

// ---------- red-team F-09: name-registry entry validation ----------
// Registry entries are fetched JSON: their fields flowed into send
// sheets raw. Every field is now shape-validated at the trust
// boundary; invalid fields drop, and an entry with nothing valid left
// is treated as unregistered.
{
  const { sanitizeNameEntry, resolveFluidName } = await import("../src/wallet-core.js");
  const EVM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const BTC = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  ok("rt-f09: a fully valid entry passes through intact",
    JSON.stringify(sanitizeNameEntry({ evm: EVM, btc: BTC, ln: "satoshi@example.com" }))
    === JSON.stringify({ evm: EVM, btc: BTC, ln: "satoshi@example.com" }));
  ok("rt-f09: garbage fields are dropped, valid ones kept",
    JSON.stringify(sanitizeNameEntry({ evm: "not-an-address", btc: BTC, ln: "no-at-sign" }))
    === JSON.stringify({ btc: BTC }));
  ok("rt-f09: an entry with no valid field is null",
    sanitizeNameEntry({ evm: "0x123", btc: "hello", ln: "x" }) === null && sanitizeNameEntry(null) === null && sanitizeNameEntry("str") === null);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ hostile: { evm: "javascript:alert(1)", btc: "drop table", ln: "a@b" } }) });
  try {
    ok("rt-f09: a hostile registry entry resolves as unregistered", (await resolveFluidName("hostile")) === null);
  } finally { globalThis.fetch = realFetch; }
  const mixed = { goodname: { evm: EVM, btc: "garbage-btc" } };
  const found = findNameForAddresses(mixed, { evm: EVM });
  ok("rt-f09: reverse lookup keeps the valid field, drops the garbage one",
    !!found && found.name === "goodname" && found.evm === EVM && found.btc === undefined);
}

// ---------- Fluid Names: the optional `algo` field ----------
// Registry entries may carry an Algorand address. It is validated at
// the same trust boundary as evm/btc/ln (sanitizeNameEntry) with the
// full checksum-verifying address check, resolveFluidName carries it,
// findNameForAddresses matches on it, and the Algorand send sheet's
// hard-block preconditions hold at core level: an unregistered name —
// or an entry whose only field is a malformed algo — resolves null,
// and a registered name without algo resolves with no algo field (the
// sheet then blocks with "no Algorand address in the registry").
{
  const { sanitizeNameEntry, resolveFluidName, formatAlgoSendIntent, algoAddressFromSeed } = await import("../src/wallet-core.js");
  const ALGO = "O67U3XOR7LK42HA5DB2BCQDMSVW7WMY3QMCW6P7XXQONLRVRLESB6XAB34";
  const EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const BTC = "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn";
  const BAD_ALGO = ALGO.slice(0, 20) + (ALGO[20] === "A" ? "B" : "A") + ALGO.slice(21); // one pubkey char flipped → checksum fails
  const OTHER_ALGO = algoAddressFromSeed(new Uint8Array(32).fill(7)); // a valid address nobody registered
  ok("names-algo: a valid algo field passes sanitize intact",
    sanitizeNameEntry({ evm: EVM, btc: BTC, algo: ALGO }).algo === ALGO);
  ok("names-algo: a bad-checksum algo field is dropped, valid fields kept",
    (() => { const e = sanitizeNameEntry({ evm: EVM, algo: BAD_ALGO }); return !!e && e.evm === EVM && e.algo === undefined; })());
  ok("names-algo: a malformed algo field is dropped",
    (() => { const e = sanitizeNameEntry({ evm: EVM, algo: "O67U3XOR" }); return !!e && e.algo === undefined; })());
  ok("names-algo: an entry whose only field is a malformed algo is null",
    sanitizeNameEntry({ algo: "not-an-algorand-address" }) === null);
  const REG = { dripbot: { evm: EVM, btc: BTC, algo: ALGO }, noalgo: { evm: EVM }, badalgo: { algo: BAD_ALGO } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => REG });
  try {
    ok("names-algo: resolveFluidName carries the algo address",
      (await resolveFluidName("dripbot"))?.algo === ALGO);
    ok("names-algo: a registered name without algo resolves with no algo field",
      (await resolveFluidName("noalgo"))?.algo === undefined);
    ok("names-algo: an entry with only a malformed algo resolves as unregistered",
      (await resolveFluidName("badalgo")) === null);
    ok("names-algo: an unregistered name resolves null (the Algorand sheet hard-blocks on this)",
      (await resolveFluidName("ghost")) === null);
  } finally { globalThis.fetch = realFetch; }
  ok("names-algo: reverse lookup matches by algo",
    findNameForAddresses(REG, { algo: ALGO })?.name === "dripbot");
  ok("names-algo: reverse lookup by algo finds nothing for an unregistered address",
    findNameForAddresses(REG, { algo: OTHER_ALGO }) === null);
  ok("names-algo: the intent sentence shows the name AND the full resolved address",
    formatAlgoSendIntent({ amount: "1.5", symbol: "ALGO", to: ALGO, feeAlgo: 0.001, name: "dripbot" })
    === `Send 1.5 ALGO to dripbot.fluid.is-a.dev (${ALGO}) on Algorand. Network fee 0.001 ALGO. Confirm?`);
  ok("names-algo: the intent sentence without a name is unchanged",
    formatAlgoSendIntent({ amount: "1.5", symbol: "ALGO", to: ALGO, feeAlgo: 0.001 })
    === `Send 1.5 ALGO to ${ALGO} on Algorand. Network fee 0.001 ALGO. Confirm?`);
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const coreSrcNa = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("names-algo: the Algorand sheet resolves names and hard-blocks like the EVM/BTC sheets",
    appSrc.includes('resolveChainRecipient(to, { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand" })')
    && coreSrcNa.includes("That Fluid name has no ${chainLabel} address in the registry.")
    && appSrc.includes("formatAlgoSendIntent({ amount, symbol: tok.symbol, to, feeAlgo: plan.feeAlgo, name: sendName })"));
  const published = JSON.parse(readFileSync(new URL("../names.json", import.meta.url), "utf8"));
  ok("names-algo: the published registry carries dripbot's algo address, sanitised intact",
    sanitizeNameEntry(published.dripbot)?.algo === ALGO);
  ok("names-algo: the published registry carries ethuram's algo address, sanitised intact",
    sanitizeNameEntry(published.ethuram)?.algo === "IHRNG3GNVJILY66Y6D5V3NS6BSOBACXJGHAUSAR37S77JS4HRPEDWWWSC4");
}

// ---------- Fluid Names: the `sol`, `tron` and `sui` fields ----------
// The registry schema now carries Solana, Tron and Sui alongside
// evm/btc/ln/algo. Same rules as the algo field: each is validated at
// the trust boundary with the chain's REAL validator (never a shape
// regex), resolveFluidName carries them, the three send sheets
// resolve names through them (field "sol"/"tron"/"sui" — no longer
// field: null), findNameForAddresses matches on them, Scan targets
// them for a name exactly as it does for a pasted address, and
// buildNameEntry emits them behind the same validators. Sui is the
// one canonicalisation: entries store 0x + 64 lowercase hex (the
// form normalizeSuiAddress defines), whatever spelling was published.
{
  const { sanitizeNameEntry, resolveFluidName, resolveChainRecipient,
    isValidSolanaAddress, isValidTronAddress, isValidSuiAddress,
    scanTargetsForName, scanTargetsForAddress, detectScanFamily } = await import("../src/wallet-core.js");
  const EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const BTC = "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn";
  const SOL = "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn";
  const TRON = "TMdUcLZmKVvKYHMJ12k5AA3ZCCHxPpmSSf";
  const SUI = "0x0cb53076d1207be242b18a63d97d2ccbd63f74d75abb68d4b7ea63b3a1d38831";
  const BAD_SOL = SOL.slice(0, -1); // truncated → decodes to 31 bytes, not a key
  const BAD_TRON = TRON.slice(0, 10) + (TRON[10] === "A" ? "B" : "A") + TRON.slice(11); // payload char flipped → Base58Check fails
  const BAD_SUI = "0x" + "zz".repeat(32); // non-hex
  const throwsMsg = async (fn, want) => { try { await fn(); return false; } catch (e) { return e.message === want; } };

  // sanitizeNameEntry: valid fields carried, malformed dropped.
  ok("names-sol-tron-sui: a valid sol field passes sanitize intact",
    sanitizeNameEntry({ evm: EVM, sol: SOL }).sol === SOL);
  ok("names-sol-tron-sui: a valid tron field passes sanitize intact",
    sanitizeNameEntry({ evm: EVM, tron: TRON }).tron === TRON);
  ok("names-sol-tron-sui: a valid sui field passes sanitize intact",
    sanitizeNameEntry({ evm: EVM, sui: SUI }).sui === SUI);
  ok("names-sol-tron-sui: a short-form sui field is stored canonicalised",
    sanitizeNameEntry({ sui: "0x2" }).sui === "0x" + "0".repeat(63) + "2");
  ok("names-sol-tron-sui: a malformed sol field is dropped, valid fields kept",
    (() => { const e = sanitizeNameEntry({ evm: EVM, sol: BAD_SOL }); return !!e && e.evm === EVM && e.sol === undefined; })());
  ok("names-sol-tron-sui: a bad-checksum tron field is dropped, valid fields kept",
    (() => { const e = sanitizeNameEntry({ evm: EVM, tron: BAD_TRON }); return !!e && e.evm === EVM && e.tron === undefined; })());
  ok("names-sol-tron-sui: a malformed sui field is dropped, valid fields kept",
    (() => { const e = sanitizeNameEntry({ evm: EVM, sui: BAD_SUI }); return !!e && e.evm === EVM && e.sui === undefined; })());
  ok("names-sol-tron-sui: an entry whose only fields are malformed sol/tron/sui is null",
    sanitizeNameEntry({ sol: BAD_SOL }) === null && sanitizeNameEntry({ tron: BAD_TRON }) === null && sanitizeNameEntry({ sui: BAD_SUI }) === null);

  // resolveFluidName carries the new fields from a fetched registry.
  const REG = { dripbot: { evm: EVM, btc: BTC, sol: SOL, tron: TRON, sui: SUI }, evmonly: { evm: EVM } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => REG });
  try {
    const hit = await resolveFluidName("dripbot");
    ok("names-sol-tron-sui: resolveFluidName carries sol, tron and sui",
      hit?.sol === SOL && hit?.tron === TRON && hit?.sui === SUI);
  } finally { globalThis.fetch = realFetch; }

  // resolveChainRecipient through the sheets' real field names.
  const reg = async (n) => n === "dripbot" ? { name: "dripbot", ...REG.dripbot } : (n === "evmonly" ? { name: "evmonly", ...REG.evmonly } : null);
  ok("names-sol-tron-sui: a known name resolves its Solana address",
    (await resolveChainRecipient("dripbot", { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana", lookupName: reg })).to === SOL);
  ok("names-sol-tron-sui: a known name resolves its Tron address",
    (await resolveChainRecipient("dripbot", { isValidAddress: isValidTronAddress, field: "tron", chainLabel: "Tron", lookupName: reg })).to === TRON);
  ok("names-sol-tron-sui: a known name resolves its Sui address",
    (await resolveChainRecipient("dripbot", { isValidAddress: isValidSuiAddress, field: "sui", chainLabel: "Sui", lookupName: reg })).to === SUI);
  ok("names-sol-tron-sui: a name without sol gets the exact Solana registry error", await throwsMsg(
    () => resolveChainRecipient("evmonly", { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana", lookupName: reg }),
    "That Fluid name has no Solana address in the registry."));
  ok("names-sol-tron-sui: a name without tron gets the exact Tron registry error", await throwsMsg(
    () => resolveChainRecipient("evmonly", { isValidAddress: isValidTronAddress, field: "tron", chainLabel: "Tron", lookupName: reg }),
    "That Fluid name has no Tron address in the registry."));
  ok("names-sol-tron-sui: a name without sui gets the exact Sui registry error", await throwsMsg(
    () => resolveChainRecipient("evmonly", { isValidAddress: isValidSuiAddress, field: "sui", chainLabel: "Sui", lookupName: reg }),
    "That Fluid name has no Sui address in the registry."));
  const appSrcSts = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("names-sol-tron-sui: the three sheets resolve via their registry fields",
    appSrcSts.includes('resolveChainRecipient(to, { isValidAddress: isValidTronAddress, field: "tron", chainLabel: "Tron" })')
    && appSrcSts.includes('resolveChainRecipient(to, { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana" })')
    && appSrcSts.includes('resolveChainRecipient(to, { isValidAddress: isValidSuiAddress, field: "sui", chainLabel: "Sui" })'));

  // Scan: a name's new-family targets are the raw-address targets.
  const fullTargets = scanTargetsForName({ evm: EVM, btc: BTC, sol: SOL, tron: TRON, sui: SUI });
  ok("names-sol-tron-sui: a full entry yields the sweep + BTC + Solana + Tron + Sui targets",
    fullTargets.length === 9
    && fullTargets.some(t => t.chainKey === "solana" && t.family === "solana" && t.address === SOL && t.label === "Solana" && t.badge === "SOL")
    && fullTargets.some(t => t.chainKey === "tron" && t.family === "tron" && t.address === TRON && t.label === "Tron" && t.badge === "TRON")
    && fullTargets.some(t => t.chainKey === "sui" && t.family === "sui" && t.address === SUI && t.label === "Sui" && t.badge === "SUI"));
  ok("names-sol-tron-sui: name targets are byte-identical to the raw-address targets",
    JSON.stringify(scanTargetsForName({ sol: SOL })) === JSON.stringify(scanTargetsForAddress(detectScanFamily(SOL)))
    && JSON.stringify(scanTargetsForName({ tron: TRON })) === JSON.stringify(scanTargetsForAddress(detectScanFamily(TRON)))
    && JSON.stringify(scanTargetsForName({ sui: SUI })) === JSON.stringify(scanTargetsForAddress(detectScanFamily(SUI))));
  ok("names-sol-tron-sui: an entry without the new fields yields no solana/tron/sui targets",
    scanTargetsForName({ evm: EVM, btc: BTC }).every(t => !["solana", "tron", "sui"].includes(t.chainKey)));

  // Reverse lookup: exact for the Base58 families, canonical for Sui.
  ok("names-sol-tron-sui: reverse lookup matches by sol",
    findNameForAddresses(REG, { sol: SOL })?.name === "dripbot");
  ok("names-sol-tron-sui: reverse lookup matches by tron",
    findNameForAddresses(REG, { tron: TRON })?.name === "dripbot");
  ok("names-sol-tron-sui: reverse lookup matches by sui",
    findNameForAddresses(REG, { sui: SUI })?.name === "dripbot");
  ok("names-sol-tron-sui: reverse lookup by sui ignores case (canonical compare)",
    findNameForAddresses(REG, { sui: "0x" + SUI.slice(2).toUpperCase() })?.name === "dripbot");
  ok("names-sol-tron-sui: reverse lookup stays case-sensitive for the Base58 families",
    findNameForAddresses(REG, { sol: "D" + SOL.slice(1) }) === null
    && findNameForAddresses(REG, { tron: "Tm" + TRON.slice(2) }) === null);

  // buildNameEntry: the new fields ride along behind their validators,
  // and the app's claim flows pass the wallet's own derived addresses.
  ok("names-sol-tron-sui: a built entry carries valid sol, tron and sui",
    (() => { const e = buildNameEntry("someone", EVM, BTC, null, null, SOL, TRON, SUI).someone; return e.sol === SOL && e.tron === TRON && e.sui === SUI; })());
  ok("names-sol-tron-sui: malformed sol/tron/sui never reach a built entry",
    (() => { const e = buildNameEntry("someone", EVM, BTC, null, null, BAD_SOL, BAD_TRON, BAD_SUI).someone; return e.sol === undefined && e.tron === undefined && e.sui === undefined; })());
  ok("names-sol-tron-sui: a built entry keeps a valid field beside a malformed one",
    (() => { const e = buildNameEntry("someone", EVM, BTC, null, null, SOL, BAD_TRON, SUI).someone; return e.sol === SOL && e.tron === undefined && e.sui === SUI; })());
  ok("names-sol-tron-sui: the claim flows build entries from the wallet's own derived addresses",
    appSrcSts.includes("solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase)")
    && appSrcSts.includes("tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase)")
    && appSrcSts.includes("suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase)")
    && appSrcSts.includes("solanaAddressFromPhrase(wallet.mnemonic.phrase), tronAddressFromPhrase(wallet.mnemonic.phrase), suiAddressFromPhrase(wallet.mnemonic.phrase))"));
}

// ---------- Fluid Names: registry host + mirror fallback ----------
// The registry's primary home is the GitHub Pages site; the Netlify
// site serves the same published names.json as the fallback (the
// order was swapped 2026-11-08 — Netlify deploys pause when build
// credits run out, which froze its copy of the registry). When the
// primary fetch fails (network error or a non-ok response), both
// registry readers fall back to the other host; a healthy primary
// is the only fetch made, and a caller-supplied registry URL never
// falls back.
{
  const { NAMES_REGISTRY_URL, NAMES_REGISTRY_FALLBACK_URL, resolveFluidName, fetchNameRegistry } = await import("../src/wallet-core.js");
  const EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const REG = { dripbot: { evm: EVM } };
  ok("names-host: the primary registry URL is the Fluid domain",
    NAMES_REGISTRY_URL === "https://fluidwallet.dpdns.org/names.json");
  ok("names-host: the fallback registry URL is the Netlify site",
    NAMES_REGISTRY_FALLBACK_URL === "https://fluidwallet.netlify.app/names.json");
  const realFetch = globalThis.fetch;
  const withFetch = async (stub, fn) => {
    const calls = [];
    globalThis.fetch = async (url, opts) => { calls.push(String(url)); return stub(String(url), opts); };
    try { return { result: await fn(), calls }; }
    finally { globalThis.fetch = realFetch; }
  };
  const good = async () => ({ ok: true, json: async () => REG });
  const boom = async () => { throw new Error("network down"); };
  const notOk = async () => ({ ok: false, json: async () => ({}) });
  let r = await withFetch(good, () => resolveFluidName("dripbot"));
  ok("names-host: a healthy primary resolves without touching the mirror",
    r.result?.evm === EVM && r.calls.length === 1 && r.calls[0] === NAMES_REGISTRY_URL);
  r = await withFetch(async (url) => (url === NAMES_REGISTRY_URL ? boom() : good()), () => resolveFluidName("dripbot"));
  ok("names-host: a failed primary fetch falls back to the mirror",
    r.result?.evm === EVM && r.calls.length === 2 && r.calls[1] === NAMES_REGISTRY_FALLBACK_URL);
  r = await withFetch(async (url) => (url === NAMES_REGISTRY_URL ? notOk() : good()), () => fetchNameRegistry());
  ok("names-host: a non-ok primary response falls back to the mirror",
    JSON.stringify(r.result) === JSON.stringify(REG) && r.calls.length === 2 && r.calls[1] === NAMES_REGISTRY_FALLBACK_URL);
  r = await withFetch(boom, () => resolveFluidName("dripbot"));
  ok("names-host: when both hosts fail, resolution is null",
    r.result === null && r.calls.length === 2);
  r = await withFetch(boom, () => fetchNameRegistry("https://example.com/names.json"));
  ok("names-host: a caller-supplied registry URL never falls back",
    r.result === null && r.calls.length === 1 && r.calls[0] === "https://example.com/names.json");
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("names-host: the page canonical and social images point at the Fluid domain",
    html.includes('<link rel="canonical" href="https://fluidwallet.dpdns.org/">')
    && html.includes('<meta property="og:url" content="https://fluidwallet.dpdns.org/">')
    && html.includes('<meta property="og:image" content="https://fluidwallet.dpdns.org/og-image.png">')
    && html.includes('<meta name="twitter:image" content="https://fluidwallet.dpdns.org/og-image.png">'));
}

// ---------- red-team F-08: route ranking / CHEAPEST badge capture ----------
// Ranking trusted LI.FI's own toAmountUSD: a route delivering half
// the tokens could take the CHEAPEST badge by lying about its dollar
// value. With an independently sourced receive-token price, a route
// whose claimed USD disagrees with amount × price by >20% is ranked
// by the corrected value, flagged, and cannot take the badge.
{
  const liar = { id: "liar", toAmount: "50000000", toToken: { decimals: 6 }, toAmountUSD: "1000.00", gasCostUSD: "1.00", executionDuration: 60, steps: [] };
  const honest = { id: "honest", toAmount: "99000000", toToken: { decimals: 6 }, toAmountUSD: "99.00", gasCostUSD: "1.00", executionDuration: 60, steps: [] };
  const ranked = rankSwapRoutes([liar, honest], 1);
  ok("rt-f08: the lying route is flagged as a USD mismatch", ranked.find(r => r.id === "liar").usdMismatch === true);
  ok("rt-f08: the lying route is ranked by its corrected value", ranked[0].id === "honest" && ranked.find(r => r.id === "liar").netUsd === 49);
  ok("rt-f08: the lying route cannot take the CHEAPEST badge",
    ranked.find(r => r.id === "honest").cheapest === true && ranked.find(r => r.id === "liar").cheapest === false);
  ok("rt-f08: honest routes are unflagged", ranked.find(r => r.id === "honest").usdMismatch === false);
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("rt-f08: the app passes its independently sourced token price",
    appSrc.includes("rankSwapRoutes(routes, Number(toTok.priceUSD)") && appSrc.includes("usdMismatch"));
}

// ---------- red-team F-10: agent request fallback ----------
// requestTransfer named a specific agent but silently fell back to
// agents[0] when the name didn't exist — a substitution primitive:
// a caller could spend a different agent's allowance than the one it
// asked for. Unknown names must throw, naming the miss.
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("rt-f10: no silent fallback to the first agent remains", !appSrc.includes("|| agents[0]"));
  ok("rt-f10: an unknown agent name fails loudly", appSrc.includes("No agent named"));
}

// ---------- Build B: Taproot (BIP86), Ordinals safety, Runes ----------
// Taproot address = the OFFICIAL BIP86 test vector (independently
// cross-checked against bitcoinjs-lib in scratch before shipping).
{
  const { bitcoinTaprootAddress, bitcoinAddress } = await import("../src/wallet-core.js");
  const BIP86_PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  ok("b-b: taproot address matches the official BIP86 vector",
    bitcoinTaprootAddress(BIP86_PHRASE) === "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr");
  ok("b-b: taproot and segwit accounts are distinct addresses from one seed",
    bitcoinTaprootAddress(KNOWN_PHRASE) !== bitcoinAddress(KNOWN_PHRASE)
    && bitcoinTaprootAddress(KNOWN_PHRASE).startsWith("bc1p"));
}
// Ordinals index parsing: the outpoint encoding pinned by a REAL
// outpoint verified against mempool.space (txid byte-reversed + LE vout).
{
  const { parseTurboOutpoint, normalizeTurboInscriptions, formatInscriptionRow, inscriptionPreviewUrl } =
    await import("../src/wallet-core.js");
  const p = parseTurboOutpoint("efa55da277f37e7a72db86da84377072ed8a969bb7e9a637c1b640547f8aa15d00000000");
  ok("b-b: turbo outpoint decodes to the on-chain txid:vout",
    p && p.txid === "5da18a7f5440b6c137a6e9b79b968aed72703784da86db727a7ef377a25da5ef" && p.vout === 0);
  ok("b-b: malformed outpoints are rejected",
    parseTurboOutpoint("zz") === null && parseTurboOutpoint("ab".repeat(32)) === null && parseTurboOutpoint(null) === null);
  const rows = normalizeTurboInscriptions([
    { id: "cb".repeat(32) + "i0", num: 42, content_type: "image/png", meta: { name: "<img onerror=alert(1)>" },
      collection: { name: "Evil<script>" }, outpoint: { outpoint: "11".repeat(32) + "00000000", sat_offset: 0 } },
    { id: "bad", outpoint: { outpoint: "nope" } },
  ]);
  ok("b-b: normalize keeps only rows with parseable outpoints", rows.length === 1 && rows[0].txid === "11".repeat(32));
  const html = formatInscriptionRow(rows[0]);
  ok("b-b: inscription row renders hostile metadata inert",
    !html.includes("<img onerror") && !html.includes("<script>") && html.includes("&lt;img")
    && html.includes(`src="https://cdn.ordinalswallet.com/inscription/preview/${"cb".repeat(32)}i0"`));
  ok("b-b: preview url only for strictly-valid inscription ids",
    inscriptionPreviewUrl("cb".repeat(32) + "i12") !== null && inscriptionPreviewUrl('x" onerror="1') === null
    && inscriptionPreviewUrl("cb".repeat(32)) === null);
}
// Runestone encoder: five vectors produced independently by BOTH
// @ordjs/runestone (official ord, WASM) and @magiceden-oss/runestone-lib
// in scratch — byte-for-byte agreement is the shipping gate.
{
  const { encodeRunestone, runeWholeToBase, parseRuneId, normalizeTurboRunes, formatRuneRow } =
    await import("../src/wallet-core.js");
  const hex = b => Buffer.from(b).toString("hex");
  ok("b-b: runestone v1 single edict", hex(encodeRunestone({ edicts: [{ id: { block: 840011, tx: 56 }, amount: 1000n, output: 1 }] })) === "6a5d0800cba23338e80701");
  ok("b-b: runestone v2 two runes + pointer", hex(encodeRunestone({ edicts: [{ id: { block: 840000, tx: 1229 }, amount: 55n, output: 1 }, { id: { block: 840011, tx: 56 }, amount: 1000n, output: 1 }], pointer: 2 })) === "6a5d0f160200c0a233cd0937010b38e80701");
  ok("b-b: runestone v3 zero + u128-overflow amount", hex(encodeRunestone({ edicts: [{ id: { block: 840011, tx: 56 }, amount: 0n, output: 1 }, { id: { block: 840011, tx: 57 }, amount: 18446744073709551617n, output: 2 }] })) === "6a5d1400cba23338000100018180808080808080800202");
  ok("b-b: runestone v4 mint only", hex(encodeRunestone({ mint: { block: 840011, tx: 56 } })) === "6a5d0614cba2331438");
  ok("b-b: runestone v5 same-block deltas + pointer 0", hex(encodeRunestone({ edicts: [{ id: { block: 840011, tx: 56 }, amount: 7n, output: 1 }, { id: { block: 840011, tx: 57 }, amount: 8n, output: 2 }, { id: { block: 840012, tx: 0 }, amount: 9n, output: 1 }], pointer: 0 })) === "6a5d11160000cba2333807010001080201000901");
  ok("b-b: edicts are sorted by the encoder (input order irrelevant)",
    hex(encodeRunestone({ edicts: [{ id: { block: 840011, tx: 56 }, amount: 1000n, output: 1 }, { id: { block: 840000, tx: 1229 }, amount: 55n, output: 1 }], pointer: 2 })) === "6a5d0f160200c0a233cd0937010b38e80701");
  ok("b-b: whole→base conversion (whole units proven on-chain)",
    runeWholeToBase("2100", 10) === 21000000000000n && runeWholeToBase("1.5", 2) === 150n
    && runeWholeToBase("7", 0) === 7n);
  let threw = false; try { runeWholeToBase("1.234", 2); } catch { threw = true; }
  ok("b-b: excess fractional digits are rejected", threw);
  ok("b-b: rune id parsing is strict",
    parseRuneId("840011:56").key === "840011:56" && parseRuneId("840011") === null && parseRuneId("a:b") === null);
  const rr = normalizeTurboRunes([
    { rune_id: "840000:1229", name: "ANARCHO•CATBUS", symbol: "<svg onload=1>", amount: "2100", divisibility: 10 },
    { rune_id: "bad", amount: "5", divisibility: 0 },
    { rune_id: "1:2", amount: "1.5", divisibility: 0 }, // fractional whole amount: not the API's semantics
  ]);
  ok("b-b: rune normalize validates id + integer whole amounts", rr.length === 1 && rr[0].amount === "2100");
  const rhtml = formatRuneRow(rr[0]);
  ok("b-b: rune row renders hostile symbol inert", !rhtml.includes("<svg") && rhtml.includes("&lt;svg"));
}
// Inscription protection in real plans (stubbed fetch): the LARGEST
// confirmed UTXO carries an inscription and must be excluded; the send
// then plans over the remaining coin and says how many were protected.
{
  const { planBitcoinSend, bitcoinAddress } = await import("../src/wallet-core.js");
  const realFetch = globalThis.fetch;
  const bigTx = "cc".repeat(32), smallTx = "dd".repeat(32);
  const mkStub = (inscriptions, aggBalance) => async (url) => {
    const u = String(url);
    if (u.includes("/v1/fees/recommended")) return { ok: true, json: async () => ({ halfHourFee: 10 }) };
    if (u.includes("blockstream.info/api/fee-estimates")) return { ok: true, json: async () => ({ "3": 11 }) };
    if (u.includes("turbo.ordinalswallet.com") && u.endsWith("/inscriptions")) return { ok: true, json: async () => inscriptions };
    if (u.includes("turbo.ordinalswallet.com")) return { ok: true, json: async () => ({ inscription_balance: aggBalance, inscriptions: [] }) };
    if (u.includes("/address/") && u.endsWith("/utxo")) return { ok: true, json: async () => ([
      { txid: bigTx, vout: 0, value: 500000, status: { confirmed: true } },
      { txid: smallTx, vout: 1, value: 100000, status: { confirmed: true } },
    ]) };
    throw new Error("unexpected fetch " + u);
  };
  // bigTx reversed-bytes encoding for the Turbo outpoint form:
  const bigOutpoint = bigTx.match(/../g).reverse().join("") + "00000000";
  const dest = bitcoinAddress(KNOWN_PHRASE);
  try {
    globalThis.fetch = mkStub([{ id: "ee".repeat(32) + "i0", num: 1, content_type: "text/plain",
      outpoint: { outpoint: bigOutpoint, sat_offset: 0 } }], 500000);
    const plan = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005 });
    ok("b-b: inscription-bearing UTXO is excluded from coin selection",
      plan.protectedCount === 1 && plan.inscriptionCheckOk === true && plan.feeSat === 1400);
    await assert.rejects(() => planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.002 }),
      /inscription-bearing coin\(s\) are protected/);
    ok("b-b: protected coins cannot fund a bigger send (clear error)", true);
    globalThis.fetch = async () => { throw new Error("index down"); };
    // fee stubs are also down here — pass an explicit rate so ONLY the
    // inscription index is unreachable:
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("turbo.ordinalswallet.com")) throw new Error("index down");
      if (u.includes("/address/") && u.endsWith("/utxo")) return { ok: true, json: async () => ([{ txid: smallTx, vout: 1, value: 100000, status: { confirmed: true } }]) };
      throw new Error("unexpected fetch " + u);
    };
    const plan2 = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005, feeRate: 10 });
    ok("b-b: index unreachable → send proceeds, check flagged as not run",
      plan2.inscriptionCheckOk === false && plan2.protectedCount === 0 && plan2.feeSat === 1400);
    globalThis.fetch = mkStub([], 500000); // cold index: aggregate says coins exist, list empty
    const plan3 = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005 });
    ok("b-b: cold-index inconsistency distrusts the empty list", plan3.inscriptionCheckOk === false && plan3.protectedCount === 0);
    // Taproot plan: same rails, P2TR sizes (fee = (10 + 58 + 43 + 43) × 10).
    globalThis.fetch = mkStub([], 0);
    const planTr = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005, kind: "taproot" });
    ok("b-b: taproot plan uses P2TR vsize and signs", planTr.feeSat === 1420 && planTr.kind === "taproot"
      && /^[0-9a-f]{64}$/.test(planTr.txid));
  } finally { globalThis.fetch = realFetch; }
}
// Rune transfer planning (stubbed fetch across BOTH accounts): the
// runestone in the built tx must equal the pinned encoding, the layout
// must be [runestone, recipient 546, rune change 546 w/ pointer], and a
// coin carrying a second rune must refuse the transfer.
{
  const { planRuneTransfer, bitcoinAddress, bitcoinTaprootAddress, encodeRunestone } = await import("../src/wallet-core.js");
  const realFetch = globalThis.fetch;
  const segAddr = bitcoinAddress(KNOWN_PHRASE), trAddr = bitcoinTaprootAddress(KNOWN_PHRASE);
  const coinTx = "f1".repeat(32), feeTx = "f2".repeat(32), bothTx = "f3".repeat(32);
  const baseStub = (runeOutpoints, utxosByAddr, balancesByAddr) => async (url) => {
    const u = String(url);
    if (u.includes("turbo.ordinalswallet.com")) {
      if (u.includes("/rune-outpoints/")) {
        const rid = decodeURIComponent(u.split("/rune-outpoints/")[1]);
        return { ok: true, json: async () => (runeOutpoints[rid] || []) };
      }
      if (u.includes("/rune-balance")) {
        const addr = u.split("/wallet/")[1].split("/")[0];
        return { ok: true, json: async () => (balancesByAddr[addr] || []) };
      }
      if (u.endsWith("/inscriptions")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({ inscription_balance: 0 }) };
    }
    if (u.includes("/address/") && u.endsWith("/utxo")) {
      const addr = u.split("/address/")[1].split("/")[0];
      return { ok: true, json: async () => (utxosByAddr[addr] || []) };
    }
    throw new Error("unexpected fetch " + u);
  };
  const dest = bitcoinAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
  try {
    globalThis.fetch = baseStub(
      { "840011:56": [{ outpoint: `${coinTx}:0`, amount: "100", sats: 546 }] },
      { [segAddr]: [{ txid: coinTx, vout: 0, value: 10000, status: { confirmed: true } },
                    { txid: feeTx, vout: 0, value: 100000, status: { confirmed: true } }],
        [trAddr]: [] },
      { [segAddr]: [{ rune_id: "840011:56", name: "TEST•RUNE", symbol: "T", amount: "100", divisibility: 0 }],
        [trAddr]: [] });
    const plan = await planRuneTransfer(KNOWN_PHRASE, { runeId: "840011:56", to: dest, amountWhole: "30", feeRate: 5 });
    ok("b-b: rune plan embeds the pinned runestone (30 units, change→pointer 2)",
      plan.runestoneHex === Buffer.from(encodeRunestone({ edicts: [{ id: { block: 840011, tx: 56 }, amount: 30n, output: 1 }], pointer: 2 })).toString("hex")
      && plan.baseAmount === "30" && plan.runeChange === true && plan.hex.includes(plan.runestoneHex));
    const full = await planRuneTransfer(KNOWN_PHRASE, { runeId: "840011:56", to: dest, amountWhole: "100", feeRate: 5 });
    ok("b-b: exact-amount rune send has no rune change output", full.runeChange === false);
    // A coin carrying a SECOND rune must refuse:
    globalThis.fetch = baseStub(
      { "840011:56": [{ outpoint: `${bothTx}:0`, amount: "100", sats: 546 }],
        "840000:1": [{ outpoint: `${bothTx}:0`, amount: "7", sats: 546 }] },
      { [segAddr]: [{ txid: bothTx, vout: 0, value: 10000, status: { confirmed: true } },
                    { txid: feeTx, vout: 0, value: 100000, status: { confirmed: true } }],
        [trAddr]: [] },
      { [segAddr]: [{ rune_id: "840011:56", name: "TEST•RUNE", symbol: "T", amount: "100", divisibility: 0 },
                    { rune_id: "840000:1", name: "OTHER•RUNE", symbol: "O", amount: "7", divisibility: 0 }],
        [trAddr]: [] });
    await assert.rejects(() => planRuneTransfer(KNOWN_PHRASE, { runeId: "840011:56", to: dest, amountWhole: "30", feeRate: 5 }),
      /also holds OTHER•RUNE/);
    ok("b-b: a coin carrying two runes refuses the transfer", true);
  } finally { globalThis.fetch = realFetch; }
}
// Receive selector: "taproot" resolves to the Bitcoin panel.
{
  const { filterReceiveNetworks } = await import("../src/wallet-core.js");
  ok("b-b: receive input 'taproot' resolves to bitcoin",
    JSON.stringify(filterReceiveNetworks("taproot").map(e => e.id)) === JSON.stringify(["bitcoin"]));
}

// Lightning native node — BOLT 11 codec pinned byte-for-byte by the
// official BOLT 11 spec examples (all signed with the spec's example
// private key, RFC 6979 deterministic signatures).
{
  const { parseBolt11, encodeBolt11, bolt11IsExpired, parseBolt12Offer, resolveBip353Address,
    classifyLightningTarget, deriveLightningSeed, deriveLightningStorageKey, ASYNC_PAY_HOLD, validateHoldHours,
    holdWindowCopy, summariseHeldPayments, fundingAddressFromScript } = await import("../src/wallet-core.js");
  const { bech32m } = await import("@scure/base");
  const PRIV = "e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734";
  const PAYEE = "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad";
  const PH = "0001020304050607080900010203040506070809000102030405060708090102";
  const SECRET = "11".repeat(32);
  const FEAT = [16, 8, 0];
  const TS = 1496314658;
  const HASH_DESC = "3925b6f67e2c340036ed12093dd44e0368df1b6ea26c53dbe4811f58fd5db8c1";
  const V1 = "lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql";
  const V2 = "lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh";
  const V3 = "lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr";
  const V4 = "lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqs9qrsgq7ea976txfraylvgzuxs8kgcw23ezlrszfnh8r6qtfpr6cxga50aj6txm9rxrydzd06dfeawfk6swupvz4erwnyutnjq7x39ymw6j38gp7ynn44";
  const V5 = "lntb20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfpp3x9et2e20v6pu37c5d9vax37wxq72un989qrsgqdj545axuxtnfemtpwkc45hx9d2ft7x04mt8q7y6t0k2dge9e7h8kpy9p34ytyslj3yu569aalz2xdk8xkd7ltxqld94u8h2esmsmacgpghe9k8";
  const V6 = "lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqsfpp3qjmp7lwpagxun9pygexvgpjdc4jdj85fr9yq20q82gphp2nflc7jtzrcazrra7wwgzxqc8u7754cdlpfrmccae92qgzqvzq2ps8pqqqqqqpqqqqq9qqqvpeuqafqxu92d8lr6fvg0r5gv0heeeqgcrqlnm6jhphu9y00rrhy4grqszsvpcgpy9qqqqqqgqqqqq7qqzq9qrsgqdfjcdk6w3ak5pca9hwfwfh63zrrz06wwfya0ydlzpgzxkn5xagsqz7x9j4jwe7yj7vaf2k9lqsdk45kts2fd0fkr28am0u4w95tt2nsq76cqw0";
  const V7 = "lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfppj3a24vwu6r8ejrss3axul8rxldph2q7z99qrsgqz6qsgww34xlatfj6e3sngrwfy3ytkt29d2qttr8qz2mnedfqysuqypgqex4haa2h8fx3wnypranf3pdwyluftwe680jjcfp438u82xqphf75ym";
  const w2bStrict = (words) => { // 5-bit words -> bytes, dropping the pad bits of the final word
    let acc = 0, bits = 0; const out = [];
    for (const w of words) { acc = (acc << 5) | w; bits += 5; while (bits >= 8) { bits -= 8; out.push((acc >>> bits) & 0xff); } acc &= (1 << bits) - 1; }
    return Buffer.from(out).toString("hex");
  };
  const p1 = parseBolt11(V1);
  ok("ln: BOLT11 spec vector 1 parses (donation, amountless)",
    p1.network === "mainnet" && p1.amountMsat === null && p1.timestamp === TS &&
    p1.paymentHash === PH && p1.paymentSecret === SECRET &&
    p1.description === "Please consider supporting this project" &&
    p1.payee === PAYEE && p1.expirySeconds === 3600 && p1.minFinalCltvExpiryDelta === 18);
  ok("ln: BOLT11 spec vector 1 re-encodes byte-for-byte",
    encodeBolt11({ network: "bc", amountMsat: null, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["d", "Please consider supporting this project"], ["9", FEAT]] }) === V1);
  const p2 = parseBolt11(V2);
  ok("ln: BOLT11 spec vector 2 parses (2500u, 60s expiry)",
    p2.amountMsat === 250000000n && p2.description === "1 cup coffee" && p2.expirySeconds === 60 && p2.payee === PAYEE);
  ok("ln: BOLT11 spec vector 2 re-encodes byte-for-byte",
    encodeBolt11({ network: "bc", amountMsat: 250000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["d", "1 cup coffee"], ["x", 60], ["9", FEAT]] }) === V2);
  ok("ln: BOLT11 spec vector 3 (UTF-8 description) re-encodes byte-for-byte",
    encodeBolt11({ network: "bc", amountMsat: 250000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["d", "ナンセンス 1杯"], ["x", 60], ["9", FEAT]] }) === V3 &&
    parseBolt11(V3).description === "ナンセンス 1杯");
  ok("ln: BOLT11 spec vector 4 (hashed description, 20m) re-encodes byte-for-byte",
    encodeBolt11({ network: "bc", amountMsat: 2000000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["h", HASH_DESC], ["9", FEAT]] }) === V4 &&
    parseBolt11(V4).descriptionHash === HASH_DESC);
  const p5 = parseBolt11(V5);
  ok("ln: BOLT11 spec vector 5 parses (testnet, P2PKH fallback)",
    p5.network === "testnet" && p5.amountMsat === 2000000000n && p5.fallback.version === 17 &&
    w2bStrict(p5.fallback.programWords) === "3172b5654f6683c8fb146959d347ce303cae4ca7");
  ok("ln: BOLT11 spec vector 5 re-encodes byte-for-byte",
    encodeBolt11({ network: "tb", amountMsat: 2000000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["h", HASH_DESC], ["p", PH],
        ["f", { version: 17, program: "3172b5654f6683c8fb146959d347ce303cae4ca7" }], ["9", FEAT]] }) === V5);
  const p6 = parseBolt11(V6);
  ok("ln: BOLT11 spec vector 6 parses both route hints exactly",
    p6.routeHints.length === 2 &&
    p6.routeHints[0].pubkey === "029e03a901b85534ff1e92c43c74431f7ce72046060fcf7a95c37e148f78c77255" &&
    p6.routeHints[0].shortChannelId === "66051x263430x1800" &&
    p6.routeHints[0].feeBaseMsat === 1 && p6.routeHints[0].feeProportionalMillionths === 20 && p6.routeHints[0].cltvExpiryDelta === 3 &&
    p6.routeHints[1].pubkey === "039e03a901b85534ff1e92c43c74431f7ce72046060fcf7a95c37e148f78c77255" &&
    p6.routeHints[1].shortChannelId === "197637x395016x2314" &&
    p6.routeHints[1].feeBaseMsat === 2 && p6.routeHints[1].feeProportionalMillionths === 30 && p6.routeHints[1].cltvExpiryDelta === 4);
  ok("ln: BOLT11 spec vector 6 re-encodes byte-for-byte",
    encodeBolt11({ network: "bc", amountMsat: 2000000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["h", HASH_DESC],
        ["f", { version: 17, program: w2bStrict(p6.fallback.programWords) }],
        ["r", p6.routeHints], ["9", FEAT]] }) === V6);
  const p7 = parseBolt11(V7);
  ok("ln: BOLT11 spec vector 7 (P2SH fallback) re-encodes byte-for-byte",
    p7.fallback.version === 18 &&
    encodeBolt11({ network: "bc", amountMsat: 2000000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["h", HASH_DESC], ["p", PH],
        ["f", { version: 18, program: w2bStrict(p7.fallback.programWords) }], ["9", FEAT]] }) === V7);
  ok("ln: BOLT11 expiry honours the x field",
    bolt11IsExpired(p2, TS + 59) === false && bolt11IsExpired(p2, TS + 61) === true &&
    bolt11IsExpired(p1, TS + 3599) === false && bolt11IsExpired(p1, TS + 3601) === true);
  assert.throws(() => parseBolt11(V2.replace("2500u", "2501u")), /./);
  ok("ln: a tampered invoice is refused (checksum/signature)", true);
  assert.throws(() => parseBolt11(encodeBolt11({ network: "bc", amountMsat: null, timestamp: TS, privKey: PRIV,
    fields: [["s", SECRET], ["d", "no payment hash"]] })), /payment hash/);
  ok("ln: an invoice with no payment hash is refused", true);
  assert.throws(() => parseBolt11("lnbc1garbage"), /./);
  ok("ln: garbage input is refused", true);
  ok("ln: amount encoding picks the shortest form, incl. pico",
    parseBolt11(encodeBolt11({ network: "bc", amountMsat: 1n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["d", "one msat"]] })).amountMsat === 1n &&
    encodeBolt11({ network: "bc", amountMsat: 100000000n, timestamp: TS, privKey: PRIV,
      fields: [["s", SECRET], ["p", PH], ["d", "one milli"]] }).startsWith("lnbc1m1"));
  ok("ln: deriveLightningSeed is pinned for the known test phrase",
    Buffer.from(deriveLightningSeed(KNOWN_PHRASE)).toString("hex") ===
      "83cced9bd54d12b9b00abdfbccfeb5ca2e06d4828ee2c326ff1315a19471d3dc" &&
    deriveLightningSeed(KNOWN_PHRASE).length === 32);
  ok("ln: deriveLightningStorageKey is a separate pinned HKDF branch",
    Buffer.from(deriveLightningStorageKey(KNOWN_PHRASE)).toString("hex") ===
      "7051ae1eef2bf8df4c2ac373e356db0f2291b5f451aa1cdfbd5d10695736f43e");
  // BOLT 12 offer parsing (hand-built TLV stream; byte layout per BOLT 12)
  const tlv = (type, value) => Buffer.concat([Buffer.from([type, value.length]), value]);
  const offerBytes = Buffer.concat([
    tlv(2, Buffer.from("6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000", "hex")),
    tlv(4, Buffer.from("deadbeef", "hex")),
    tlv(8, Buffer.from("01e240", "hex")),
    tlv(10, Buffer.from("coffee", "utf8")),
    tlv(14, Buffer.from("70dbd880", "hex")),
    tlv(16, Buffer.from("aabbcc", "hex")),
    tlv(18, Buffer.from("fluid", "utf8")),
    tlv(20, Buffer.alloc(0)),
    tlv(22, Buffer.from(PAYEE, "hex")),
  ]);
  const b2w = (bytes) => { let acc = 0, bits = 0; const out = [];
    for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; out.push((acc >>> bits) & 31); } acc &= (1 << bits) - 1; }
    if (bits > 0) out.push((acc << (5 - bits)) & 31); return out; };
  const offerStr = bech32m.encode("lno", b2w(offerBytes), 8000);
  const po = parseBolt12Offer(offerStr);
  ok("ln: BOLT12 offer parses its display fields",
    po.kind === "offer" && po.description === "coffee" && po.amountMsat === 123456n &&
    po.issuer === "fluid" && po.hasPaths === true && po.issuerId === PAYEE && po.quantityMax === 0n &&
    po.absoluteExpiry === 1893456000 && po.chains[0] === "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000" &&
    po.metadata === "deadbeef");
  ok("ln: BOLT12 offer id is the TLV stream hash",
    po.offerId === Buffer.from(nobleSha256(offerBytes)).toString("hex"));
  const oooBytes = Buffer.concat([tlv(10, Buffer.from("x", "utf8")), tlv(8, Buffer.from("01", "hex"))]);
  assert.throws(() => parseBolt12Offer(bech32m.encode("lno", b2w(oooBytes), 8000)), /out of order/);
  ok("ln: BOLT12 offer with out-of-order TLVs is refused", true);
  // BIP-353 over a stubbed DoH endpoint. The record name is BIP-353's
  // own — <user>.user._bitcoin-payment.<domain> (the resolver once
  // queried the labels in the wrong order and could never have
  // resolved a real record; the stub answers ONLY at the spec name
  // for alice and ONLY at the legacy name for carol, pinning both
  // the fix and the interop fallback).
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("name=alice.user._bitcoin-payment.example.com")) {
      return { ok: true, json: async () => ({ Answer: [{ name: "alice.user._bitcoin-payment.example.com", type: 16, data: `"bitcoin:?lno=${offerStr}"` }] }) };
    }
    if (u.includes("name=_bitcoin-payment.carol.example.com")) {
      return { ok: true, json: async () => ({ Answer: [{ name: "_bitcoin-payment.carol.example.com", type: 16, data: `"bitcoin:?lno=${offerStr}"` }] }) };
    }
    if (u.includes("example.com")) return { ok: true, json: async () => ({}) };
    throw new Error("unexpected fetch: " + url);
  };
  try {
    const r = await resolveBip353Address("₿alice@example.com");
    ok("ln: BIP-353 resolves a DNS TXT offer and validates it",
      r.offer === offerStr && r.parsedOffer.description === "coffee");
    const rc = await resolveBip353Address("carol@example.com");
    ok("ln: BIP-353 falls back to the legacy record name when the spec name has none",
      rc.offer === offerStr);
    await assert.rejects(() => resolveBip353Address("bob@example.com"), /No BIP-353|DNS lookup/);
    ok("ln: BIP-353 with no TXT record fails plainly", true);
  } finally { globalThis.fetch = realFetch; }
  ok("ln: classifyLightningTarget routes every input shape",
    classifyLightningTarget(V2).kind === "bolt11" &&
    classifyLightningTarget(offerStr).kind === "bolt12" &&
    classifyLightningTarget("alice@example.com").kind === "address" &&
    classifyLightningTarget("ethuram").kind === "fluid-name" &&
    classifyLightningTarget("not a payment").kind === "unknown");
  // --- Native Lightning registration: a name's lnOffer (2026-11-09).
  // The amountless variant of the fixture above (no amount TLV): a
  // standing name address must let the payer choose the amount.
  const { sanitizeNameEntry, parseNameLnOffer, lightningTargetForNameEntry } = await import("../src/wallet-core.js");
  const offerBytesOpen = Buffer.concat([
    tlv(2, Buffer.from("6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000", "hex")),
    tlv(4, Buffer.from("deadbeef", "hex")),
    tlv(10, Buffer.from("coffee", "utf8")),
    tlv(14, Buffer.from("70dbd880", "hex")),
    tlv(16, Buffer.from("aabbcc", "hex")),
    tlv(18, Buffer.from("fluid", "utf8")),
    tlv(20, Buffer.alloc(0)),
    tlv(22, Buffer.from(PAYEE, "hex")),
  ]);
  const offerOpenStr = bech32m.encode("lno", b2w(offerBytesOpen), 8000);
  const offerOpen2Str = bech32m.encode("lno", b2w(Buffer.concat([
    tlv(2, Buffer.from("6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000", "hex")),
    tlv(10, Buffer.from("tea", "utf8")),
    tlv(18, Buffer.from("fluid", "utf8")),
    tlv(22, Buffer.from(PAYEE, "hex")),
  ])), 8000);
  ok("ln: amountless offer fixture parses with no fixed amount",
    parseBolt12Offer(offerOpenStr).kind === "offer" && parseBolt12Offer(offerOpenStr).amountMsat === null && offerOpen2Str !== offerOpenStr);
  ok("ln: parseNameLnOffer accepts only amountless BOLT 12 offers",
    parseNameLnOffer(offerOpenStr) === offerOpenStr &&
    parseNameLnOffer("LIGHTNING:" + offerOpenStr.toUpperCase()) === offerOpenStr &&
    parseNameLnOffer(offerStr) === null &&
    parseNameLnOffer("lno1garbage") === null &&
    parseNameLnOffer("someone@wallet.example") === null &&
    parseNameLnOffer(null) === null && parseNameLnOffer(42) === null);
  const EVM_OK = "0x0EBf5563F905E3B9D58718E28E08143511DC763b", BTC_OK = "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw";
  ok("names: sanitizeNameEntry carries a valid lnOffer, drops fixed-amount and garbage",
    sanitizeNameEntry({ evm: EVM_OK, btc: BTC_OK, lnOffer: offerOpenStr }).lnOffer === offerOpenStr &&
    !("lnOffer" in sanitizeNameEntry({ evm: EVM_OK, btc: BTC_OK, lnOffer: offerStr })) &&
    !("lnOffer" in sanitizeNameEntry({ evm: EVM_OK, btc: BTC_OK, lnOffer: "lno1garbage" })));
  ok("names: buildNameEntry carries lnOffer only when it validates",
    buildNameEntry("offername", EVM_OK, BTC_OK, null, null, null, null, null, offerOpenStr).offername.lnOffer === offerOpenStr &&
    buildNameEntry("offername", EVM_OK, BTC_OK, null, null, null, null, null, offerStr).offername.lnOffer === undefined);
  const offerWallet = await unlockVault(known.keystore, "password123");
  const offerPhrase = offerWallet.mnemonic.phrase;
  const { claim: offerClaim } = await buildSignedNameClaim({
    name: "offertest", evm: offerWallet.address, btc: bitcoinAddress(offerPhrase),
    lnOffer: offerOpenStr, phrase: offerPhrase, signerWallet: offerWallet,
  });
  ok("names: a claim carrying lnOffer verifies and the entry round-trips the offer",
    verifyNameClaim(offerClaim).ok === true && verifyNameClaim(offerClaim).entry.lnOffer === offerOpenStr &&
    buildNameClaimMessage(offerClaim).endsWith("\nlnOffer: " + offerOpenStr));
  ok("names: swapping the offer after signing breaks the claim",
    verifyNameClaim({ ...offerClaim, lnOffer: offerOpen2Str }).ok === false);
  ok("names: a fixed-amount offer in a claim is refused at build time",
    await buildSignedNameClaim({ name: "offertest", evm: offerWallet.address, btc: bitcoinAddress(offerPhrase), lnOffer: offerStr, phrase: offerPhrase, signerWallet: offerWallet }).then(() => false, () => true));
  const { claim: legacyClaim } = await buildSignedNameClaim({
    name: "offertest", evm: offerWallet.address, btc: bitcoinAddress(offerPhrase),
    phrase: offerPhrase, signerWallet: offerWallet,
  });
  ok("names: a legacy claim (no lnOffer) keeps the exact pre-lnOffer message bytes and verifies",
    !buildNameClaimMessage(legacyClaim).includes("lnOffer") && verifyNameClaim(legacyClaim).ok === true);
  ok("ln: lightningTargetForNameEntry decides by the value's shape, native offer first",
    lightningTargetForNameEntry({ lnOffer: offerOpenStr }).kind === "offer" &&
    lightningTargetForNameEntry({ lnOffer: offerOpenStr }).value === offerOpenStr &&
    lightningTargetForNameEntry({ ln: "someone@wallet.example" }).kind === "address" &&
    lightningTargetForNameEntry({ lnOffer: offerOpenStr, ln: "someone@wallet.example" }).kind === "offer" &&
    lightningTargetForNameEntry({ ln: offerOpenStr }).kind === "offer" &&
    lightningTargetForNameEntry({}) === null && lightningTargetForNameEntry(null) === null &&
    lightningTargetForNameEntry({ lnOffer: "lno1garbage", ln: "someone@wallet.example" }).kind === "address");
  ok("ln: async hold window is bounded and its copy is honest",
    ASYNC_PAY_HOLD.defaultHours === 24 && ASYNC_PAY_HOLD.maxHours === 72 &&
    validateHoldHours(72) === 72 && holdWindowCopy(24).includes("cannot take or redirect") &&
    holdWindowCopy(24).includes("automatically returned to the sender"));
  assert.throws(() => validateHoldHours(73), /between 1 and 72/);
  assert.throws(() => validateHoldHours(0), /between 1 and 72/);
  ok("ln: hold windows outside 1..72h are refused", true);
  const sh = summariseHeldPayments([
    { amountMsat: 1000n, holdExpiresAtSec: 2000 },
    { amountMsat: 2500n, holdExpiresAtSec: 1500 },
    { amountMsat: 500n, holdExpiresAtSec: 900 },
  ], 1000);
  ok("ln: held-payment summary totals, expiry ordering and lapse counting",
    sh.count === 3 && sh.totalMsat === 4000n && sh.nextExpirySec === 1500 && sh.expiredUnswept === 1);
  // Funding-script -> address: the all-zero P2WSH program's address is
  // independently produced by @scure/btc-signer's Address encoder (two
  // code paths, same string) — pinned here from that cross-check.
  ok("ln: fundingAddressFromScript maps P2WSH to its bech32 address (cross-checked vs @scure/btc-signer)",
    fundingAddressFromScript("0020" + "00".repeat(32)) ===
      "bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqthqst8" &&
    fundingAddressFromScript("0020" + "00".repeat(32), "signet").startsWith("tb1q"));
  assert.throws(() => fundingAddressFromScript("0014" + "00".repeat(20)), /not a P2WSH/);
  ok("ln: fundingAddressFromScript refuses non-P2WSH scripts", true);
}

// ---------- UI rebuild P0: view model, send-success helper, activity ----------
// The §4.2 view context: one persisted key scoping pill, hero, header
// address, asset list, send and receive. app.js is DOM-bound, so the
// model is pinned at source level (the same style as the C1/M3 pins).
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("ui-p0: viewKey model exists with the persisted key and default",
    appSrc.includes('const VIEW_KEY_LS = "fluid_view_v1"')
    && appSrc.includes('let viewKey = "all"')
    && appSrc.includes("localStorage.getItem(VIEW_KEY_LS)")
    && appSrc.includes("function saveViewKey()"));
  ok("ui-p0: family ids come from the RECEIVE_NETWORKS taxonomy",
    appSrc.includes("RECEIVE_NETWORKS.find(m => m.id === viewKey)")
    && appSrc.includes("receiveNetworkMatches(m, q)")
    && appSrc.includes("COSMOS_CHAINS.some(c => c.key === viewKey)"));
  ok("ui-p0: scoped hero sums read the per-family totals, all = heroTotal()",
    appSrc.includes("function familyUsdTotals()")
    && appSrc.includes('if (viewKey === "all") return heroTotal();')
    && appSrc.includes("function scopedTotal()"));
  ok("ui-p0: hero caption is the one-line scope caption, census deleted",
    appSrc.includes('"Across all networks"')
    && !appSrc.includes("on this network + Bitcoin + Litecoin"));
  ok("ui-p0: picker offers All / EVM / Other sections with totals",
    appSrc.includes('data-viewall="1"') && appSrc.includes("EVM NETWORKS") && appSrc.includes("OTHER NETWORKS")
    && appSrc.includes('data-viewfam="${m.id}"'));
  ok("ui-p0: selecting an EVM row keeps selectNetwork (probe path intact)",
    appSrc.includes("await selectNetwork(b.dataset.net)"));
  ok("ui-p0: receive preselects the current view's entry",
    appSrc.includes('let selected = (viewKey === "all" || viewKey === "evm") ? "evm" : viewKey;'));
  ok("ui-p0: send dispatches to the family's own sheet from a family view",
    appSrc.includes('if (viewKey === "algorand") return openAlgoSheet')
    && appSrc.includes('if (viewKey === "bitcoin") return openBtcSheet()')
    && appSrc.includes("function openEvmSendSheet()"));
  // §4.8: the shared success helper is wired into every send family.
  ok("ui-p0: showTxSuccess is defined once and called by every family",
    appSrc.includes("function showTxSuccess({")
    && (appSrc.match(/showTxSuccess\(\{/g) || []).length >= 20);
  ok("ui-p0: success verbs cover Sent / Broadcast / Paid / Swapped",
    appSrc.includes('verb: "Sent"') && appSrc.includes('verb: "Broadcast"')
    && appSrc.includes('verb: "Paid"') && appSrc.includes('verb: "Swapped"'));
  ok("ui-p0: every family names itself in the success recap",
    ["Bitcoin", "Litecoin", "Dogecoin", "Bitcoin Cash", "Tron", "Solana", "Sui", "Stellar", "TON", "NEAR",
     "Algorand", "XRP Ledger", "Polkadot Asset Hub", "Aptos", "Stacks", "Lightning"]
      .every(n => appSrc.includes(`familyName: "${n}"`) || appSrc.includes(`familyName: chain.name`)));
  ok("ui-p0: balance-after line is computed in the review step (§4.8 P10)",
    appSrc.includes("function setBalanceAfter(")
    && (appSrc.match(/setBalanceAfter\(\$/g) || []).length >= 18
    && appSrc.includes("Balance after: "));
  ok("ui-p0: broadcasting locks the sheet and failures land in a banner",
    appSrc.includes("function setSendBusy(") && appSrc.includes('root.setAttribute("data-busy", "1")')
    && appSrc.includes("function showSheetError(") && appSrc.includes("if (sheetBusy && !force) return;"));
  ok("ui-p0: history cap is the HISTORY_MAX constant at every write site",
    appSrc.includes("const HISTORY_MAX = 100")
    && !appSrc.includes("h.slice(0, 20)")
    && (appSrc.match(/h\.slice\(0, HISTORY_MAX\)/g) || []).length >= 20);
  ok("ui-p0: activity groups by day with relative time + family sub-line",
    appSrc.includes("function historyDayLabel(") && appSrc.includes("function relTime(")
    && appSrc.includes("function historyFamilyLabel(") && appSrc.includes('data-actrow="${i}"')
    && appSrc.includes("Nothing here yet") && appSrc.includes("Make your first send"));
  ok("ui-p0: essay lives in <noscript> for crawlers and in More for humans",
    idxSrc.includes("<noscript>") && idxSrc.includes("What is Fluid?")
    && idxSrc.indexOf("What is Fluid?", idxSrc.indexOf("<noscript>")) > idxSrc.indexOf("<noscript>")
    && idxSrc.indexOf("non-custodial wallet for every blockchain", idxSrc.indexOf("<noscript>")) > idxSrc.indexOf("<noscript>")
    && idxSrc.includes('id="aboutBtn"') && appSrc.includes('$("aboutBtn").onclick')
    && !idxSrc.includes("<footer>"));
  ok("ui-p0: activity nav dot exists and is driven by the success flow",
    idxSrc.includes('id="activityDot"') && appSrc.includes("function markActivityDot()")
    && appSrc.includes("function clearActivityDot()"));
}

// ---------- UI rebuild P1: tokens, sprite, logo system, group cards ----------
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const coreSrc = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("ui-p1: CSP is exactly the baseline policy with img-src gaining https: and connect-src naming the WalletConnect relay/verify endpoints (script-src stays 'self')",
    idxSrc.includes("default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss: wss://relay.walletconnect.com https://relay.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org https://explorer-api.walletconnect.com https://pulse.walletconnect.com; object-src 'none'; base-uri 'self'; form-action 'none'"));
  ok("ui-p1: design tokens are the spec's (Part 3)",
    ["--bg0:#070606", "--surface-1:#0e0d0c", "--surface-2:#161413", "--surface-3:#211e1c",
     "--brand-1:#f7931a", "--brand-2:#ffbe0b", "--drop:#ff9f2e",
     "--grad-brand:linear-gradient(180deg,#ffa726 0%,#f7931a 100%)",
     "--sh-card:inset 0 1px 0 rgba(255,255,255,.045), 0 12px 32px rgba(0,0,0,.35)",
     "--r-sheet:28px", "--dur-sheet:260ms"].every(t => idxSrc.includes(t)));
  ok("ui-p1: SVG sprite carries the full icon set",
    ["i-drop", "i-drop-w", "i-send", "i-receive", "i-swap", "i-plus", "i-bank", "i-wallet",
     "i-ball", "i-activity", "i-more", "i-chev-d", "i-chev-r", "i-x", "i-check", "i-copy",
     "i-qr", "i-search", "i-bolt", "i-shield", "i-eye", "i-eye-off", "i-lock", "i-download",
     "i-refresh", "i-external", "i-alert", "i-spinner", "i-layers", "i-globe"]
      .every(id => idxSrc.includes(`id="${id}"`)) && idxSrc.includes('id="gradDrop"'));
  ok("ui-p1: logo fallback chain order is logoURI → TrustWallet → spothq → letter tile",
    (() => { const s = appSrc.indexOf("function tokenLogoHtml(");
      const uri = appSrc.indexOf("token.logoURI", s), tw = appSrc.indexOf("assets.trustwalletapp.com", s),
            sp = appSrc.indexOf('step = "spothq"', s), lt = appSrc.indexOf("return letterTileHtml(sym)", s);
      return s >= 0 && uri > s && tw > uri && sp > tw && lt > sp; })());
  ok("ui-p1: logo failures fall through ONE delegated capture-phase listener, never inline handlers",
    appSrc.includes('document.addEventListener("error"') && appSrc.includes("coin-img")
    && !appSrc.includes("onerror=") && !idxSrc.includes("onerror="));
  ok("ui-p1: Trust Wallet URLs are built from EIP-55 checksummed addresses",
    appSrc.includes("toChecksumAddress(token.address)") && coreSrc.includes("export function toChecksumAddress("));
  ok("ui-p1: EIP-55 checksum matches the official test vectors",
    toChecksumAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed") === "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
    && toChecksumAddress("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359") === "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"
    && toChecksumAddress("0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb") === "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"
    && toChecksumAddress("0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb") === "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"
    && toChecksumAddress("not an address") === null && toChecksumAddress("") === null);
  ok("ui-p1: LI.FI token shape carries logoURI through to the UI",
    coreSrc.includes('logoURI: typeof t.logoURI === "string"')
    && appSrc.includes("logoURI: t.logoURI || null"));
  ok("ui-p1: family groups render as cards with headers, subtotals and the alert button",
    appSrc.includes("function familyRowsHtml(") && appSrc.includes("groupcard")
    && appSrc.includes("data-famalert=") && appSrc.includes("function familyAlertMap(")
    && appSrc.includes("function openFamilyAlert("));
  ok("ui-p1: zero balances collapse behind the persisted global toggle + per-family group",
    appSrc.includes('const SHOW_ZERO_LS = "fluid_show_zero_v1"') && appSrc.includes("Zero balances (")
    && appSrc.includes('id="zeroToggle"') && appSrc.includes("function zeroGroupHtml("));
  ok("ui-p1: unloaded families render skeleton rows, driven by famLoaded",
    appSrc.includes("function skeletonRowsHtml(") && appSrc.includes("const famLoaded = new Set()")
    && appSrc.includes('markLoaded("evm")') && appSrc.includes('markLoaded("cosmos")')
    && appSrc.includes("const markLoaded = (k) => { famLoaded.add(k); liveFams.add(k); };")
    && idxSrc.includes("@keyframes shimmer"));
  ok("ui-p1: wallet header shows name + context address with a lock button (§4.1)",
    idxSrc.includes('class="apphead"') && idxSrc.includes('id="hdrLockBtn"')
    && appSrc.includes("hdrLockBtn.onclick = lockWallet")
    && idxSrc.indexOf('id="welcomeText"') > idxSrc.indexOf('id="tab-wallet"')
    && idxSrc.indexOf('id="welcomeText"') < idxSrc.indexOf('class="hero"')
    && !idxSrc.includes('id="nameText"'));
  ok("ui-p1: token rows carry the chain badge only for multi-network symbols",
    appSrc.includes("function badgeHtml(") && appSrc.includes("dupSymbols")
    && appSrc.includes("function tokenRowHtml(") && appSrc.includes("UNVERIFIED"));
  ok("ui-p1: bottom nav is the blurred 64px bar with SVG icons and press pill",
    idxSrc.includes("backdrop-filter:blur(16px) saturate(140%)")
    && idxSrc.includes('<use href="#i-wallet"/>') && idxSrc.includes('<use href="#i-ball"/>')
    && idxSrc.includes('<use href="#i-activity"/>') && idxSrc.includes('<use href="#i-more"/>'));
}

// ---------- UI rebuild P2: sheet system, Play, More, onboarding, motion ----------
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("ui-p2: sheets have the grab handle, entry/exit motion and a guarded animated close",
    idxSrc.includes('class="grab"') && idxSrc.includes("@keyframes sheetin") && idxSrc.includes("@keyframes sheetout")
    && idxSrc.includes("#sheetRoot.closing .sheet") && appSrc.includes('r.classList.add("closing")')
    && appSrc.includes("sheetGen") && appSrc.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'));
  ok("ui-p2: confirm actions ride a sticky footer (intent blocks, swap, Lightning pay)",
    idxSrc.includes('.sheet div[id$="Intent"]:not(.hidden)') && idxSrc.includes('.sheet #wConfirm:not(.hidden)')
    && idxSrc.includes(".stickyfoot{ position:sticky")
    && appSrc.includes('class="stickyfoot"><button class="btn" id="lnPayBtn"')
    && appSrc.includes('class="stickyfoot"><button class="btn" id="lnPay"'));
  ok("ui-p2: Play tab — SVG header, numbered explainer rows, plain notify label",
    idxSrc.includes('class="playhead"') && idxSrc.includes('class="nnum">1') && idxSrc.includes('class="nnum">4')
    && idxSrc.includes('id="notifyBtn">Notify me at launch</button>')
    && !idxSrc.includes("⚽") && !idxSrc.includes("🔔"));
  ok("ui-p2: More tab — grouped icon rows, About merged, danger zone last",
    idxSrc.includes('class="mrow" id="refreshBtn"') && idxSrc.includes('class="mrow" id="backupBtn"')
    && idxSrc.includes('class="mrow" id="showSeedBtn"') && idxSrc.includes('class="mrow" id="approvalsBtn"')
    && idxSrc.includes('class="mrow" id="lockBtn"') && idxSrc.includes('class="mrow dangerrow" id="wipeBtn"')
    && idxSrc.indexOf('id="wipeBtn"') > idxSrc.indexOf('id="aboutBtn"')
    && idxSrc.includes('id="buildStamp"') && !idxSrc.includes("🤖 Agentic"));
  ok("ui-p2: onboarding — gradient tile wordmark, one line, three chips, census gone",
    idxSrc.includes('class="brandtile"') && idxSrc.includes('<use href="#i-drop-w"/>')
    && idxSrc.includes('<span class="chip">Every blockchain</span>') && idxSrc.includes('<span class="chip">No account</span>')
    && idxSrc.includes('<span class="chip">Keys never leave your phone</span>')
    && !idxSrc.includes("Every blockchain family —") && !idxSrc.includes("💧"));
  ok("ui-p2: home zero state exists, wired to Buy/Receive, and gated on loaded emptiness",
    idxSrc.includes('id="homeZero"') && idxSrc.includes('id="homeBuy"') && idxSrc.includes('id="homeReceive"')
    && appSrc.includes('hz.classList.toggle("hidden"') && appSrc.includes('famLoaded.has("evm") && !evmLoadFailed && !btcLoadFailed && !anyBal')
    && appSrc.includes("hzBuy.onclick") && appSrc.includes("hzRcv.onclick"));
  ok("brand-kyc: no-KYC claims attach to Fluid itself — unqualified 'no KYC, global' gone from index.html",
    !idxSrc.includes("no KYC, global") && idxSrc.includes("Fluid never KYCs you")
    && idxSrc.includes("no KYC on Fluid's side — buy and sell routes run their own quick checks")
    && appSrc.includes("no KYC on Fluid's side — buy and sell routes run their own quick checks"));
  ok("ui-p2: app chrome emoji are gone — Lightning/agent/swap use the icon system",
    !appSrc.includes("⚡ Lightning") && !appSrc.includes("🤖 Agent") && !appSrc.includes("⇅ Flip")
    && !appSrc.includes("⬇ Received") && appSrc.includes('icon("bolt", "ic ic-brand")')
    && appSrc.includes('icon("swap", "ic ic-sm")'));
  ok("ui-p2: motion pass — hero cross-fade, tab fade kept, reduced motion kills sheet motion",
    appSrc.includes('totalEl.classList.add("herofade")') && idxSrc.includes("@keyframes herofade")
    && idxSrc.includes("#sheetRoot.closing .sheet, #sheetRoot.closing .scrim{ animation:none; }"));
}

// ---------- live-QA fixes 2026-11-07 (picker / BTC review / Cosmos / lock / name copy) ----------
// A full live QA in a fresh throwaway wallet found five defects the
// existing pins had missed. Defect 1 and the BTC fallback were proven
// in a headless browser against the built dist before/after; the pins
// here lock the failure mechanisms at the level CI can run.
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const coreSrc = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const { cosmosSendSelection, fetchBtcUtxos, planBitcoinSend, bitcoinAddress } = await import("../src/wallet-core.js");

  // Defect 1: the network picker called receiveNetworkMatches, which
  // app.js never imported — a runtime ReferenceError on every open,
  // so #netList stayed empty for every query. Reproduced headlessly:
  // "ReferenceError: receiveNetworkMatches is not defined" thrown from
  // the netBtn handler before paint() could write innerHTML.
  const importBlock = appSrc.slice(appSrc.indexOf("import {"), appSrc.indexOf('} from "./wallet-core.js"'));
  ok("qa1: app.js imports receiveNetworkMatches from wallet-core",
    /(^|[,\s])receiveNetworkMatches\s*,/.test(importBlock));
  // The failure CLASS, not just the instance: any wallet-core export
  // app.js calls as a bare identifier must be imported (or defined
  // locally in app.js) — anything else is a latent ReferenceError.
  const coreExports = [...coreSrc.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  const importedNames = new Set([...importBlock.matchAll(/([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const localDefs = new Set([
    ...[...appSrc.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]),
    ...[...appSrc.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]),
  ]);
  // Scan code only: a name mentioned in comment prose is not a call.
  const appCode = appSrc.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(l => !l.trimStart().startsWith("//")).join("\n");
  const unimported = [...new Set(coreExports)].filter(n =>
    new RegExp(`(?<![\\w$.])${n}\\s*\\(`).test(appCode) && !importedNames.has(n) && !localDefs.has(n));
  ok("qa1: no wallet-core export is called in app.js without being imported", unimported.length === 0);
  if (unimported.length) console.log("   unimported calls:", unimported.join(", "));

  // Defect 2: the BTC send review fetched the PLURAL /utxos route —
  // a 404 whose plain-text body ("endpoint does not exist …") hit an
  // unguarded .json() and surfaced as a raw parse error.
  ok("qa2: the plural /utxos fetch route is gone from wallet-core",
    !/address\/\$\{[^}]*\}\/utxos/.test(coreSrc) && coreSrc.includes("fetchBtcUtxos(address)"));
  const realFetch = globalThis.fetch;
  const oneUtxo = [{ txid: "aa".repeat(32), vout: 0, value: 100000, status: { confirmed: true, block_height: 800000 } }];
  const textPage = { ok: true, json: async () => { throw new SyntaxError("Unexpected token 'e', \"endpoint d\"... is not valid JSON"); } };
  try {
    // Source A (mempool.space) answers text/HTML 200 for everything;
    // source B (blockstream.info) answers valid JSON. Fees AND the
    // UTXO set must both fall back to B and the review must proceed:
    // rate 11 from B only (sources 1), fee = 140 vB × 11 = 1540.
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("ordinalswallet")) return { ok: false, json: async () => ({}) };
      if (u.includes("mempool.space")) return textPage;
      if (u.includes("blockstream.info/api/fee-estimates")) return { ok: true, json: async () => ({ "3": 11 }) };
      if (u.includes("blockstream.info/api/address/")) return { ok: true, json: async () => oneUtxo };
      throw new Error("unexpected fetch " + u);
    };
    const dest = bitcoinAddress(KNOWN_PHRASE);
    const plan = await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005 });
    ok("qa2: text-200 primary → review proceeds on the fallback source",
      plan.rate === 11 && plan.rateInfo.sources === 1 && plan.feeSat === 1540 && /^[0-9a-f]{64}$/.test(plan.txid));
    const utxos = await fetchBtcUtxos(dest);
    ok("qa2: fetchBtcUtxos normalises the fallback set",
      utxos.length === 1 && utxos[0].value === 100000 && utxos[0].status.confirmed === true);
    // Both sources dead → ONE plain-language error, never raw parse text.
    globalThis.fetch = async (url) => (String(url).includes("ordinalswallet") ? { ok: false, json: async () => ({}) } : textPage);
    let err = null;
    try { await planBitcoinSend(KNOWN_PHRASE, { to: dest, amountBtc: 0.0005 }); } catch (e) { err = e; }
    ok("qa2: both sources dead → plain-language error, no raw parse text",
      !!err && err.message === "Couldn't reach the fee sources — check your connection and try again"
      && !/Unexpected token|not valid JSON/.test(err.message));
  } finally { globalThis.fetch = realFetch; }

  // Defect 3: an EMPTY Cosmos token list left the send selection null.
  const hub = { key: "cosmoshub", denom: "uatom", symbol: "ATOM", name: "Cosmos Hub", decimals: 6, amount: "1.5" };
  ok("qa3: empty token list defaults to the native denom",
    cosmosSendSelection(hub, []).denom === "uatom" && cosmosSendSelection(hub, []).amount === "1.5");
  ok("qa3: missing token list defaults to the native denom",
    cosmosSendSelection(hub, null).denom === "uatom" && cosmosSendSelection(hub, undefined).symbol === "ATOM");
  const foreign = { denom: "uosmo", symbol: "OSMO", amount: "3" };
  const nativeTok = { denom: "uatom", symbol: "ATOM", amount: "2" };
  ok("qa3: populated list prefers the native entry, else the first token",
    cosmosSendSelection(hub, [foreign, nativeTok]) === nativeTok && cosmosSendSelection(hub, [foreign]) === foreign);
  ok("qa3: the Cosmos sheet selects through the shared helper",
    appSrc.includes("cosmosSendSelection(chain, chain.tokens)"));

  // Defect 4: the green "Wallet created…" message survived onto the
  // lock/unlock screen because locking never cleared onboardMsg.
  const lockAt = appSrc.indexOf("function lockWallet()");
  const lockSlice = appSrc.slice(lockAt, lockAt + 1200);
  ok("qa4: locking clears the transient onboarding message",
    lockSlice.includes('msg("onboardMsg", "")'));
  // Audit P1-14 (2026-11-10): the same function dismisses any open
  // sheet BEFORE the gate repaints, so a composed send can never
  // stay legible over the lock screen.
  ok("audit P1-14: locking dismisses an open sheet before repainting the gate",
    lockSlice.includes("closeSheet(true)") && lockSlice.indexOf("closeSheet(true)") < lockSlice.indexOf("refreshGate()"));

  // Defect 5: the owned-name card claimed public registration for a
  // name that was only claimed locally and never published.
  ok("qa5: the owned-name note no longer claims registration statically",
    idxSrc.includes('id="ownedNameNote"') && !idxSrc.includes("This name is registered to this wallet in the public registry")
    && idxSrc.includes("saved on this device"));
  const nameAt = appSrc.indexOf("function renderNameSection()");
  // The window is the WHOLE function body (up to the next function):
  // it was a fixed 16000 chars until the native-Lightning name card
  // (2026-11-09) grew renderNameSection past it — the pinned
  // property is unchanged (the wording lives inside this function,
  // in the registry-resolved branch).
  const nameSlice = appSrc.slice(nameAt, appSrc.indexOf("async function adoptRegistryNameIfMine", nameAt));
  // 2026-11-09: the wording now comes from NAME_STATE_COPY via
  // nameClaimState — the pinned property is unchanged (the LIVE
  // wording is painted only from the branch where the registry hit
  // is passed in, and nameClaimState returns "live" only when that
  // hit's evm matches this wallet; the state machine itself is
  // pinned in section 18c).
  ok("qa5: registered wording is set only when the registry resolves the name to this wallet",
    nameSlice.includes('$("ownedNameNote")')
    && nameSlice.includes("nameClaimState({ stored, pending: loadPendingClaim(), registryHit: hit")
    && nameSlice.includes("publish its entry so other Fluid wallets can resolve it"));
}

// ---------- lock-screen recovery 2026-11-07 ----------
// A stored vault trapped anyone who forgot the password: the gate
// hid the create/import box whenever a vault existed, so the only
// import form in the app was unreachable and the lock screen offered
// nothing but Unlock. The fix is a confirmed detour (restoreMode)
// back to the SAME onboarding box — no parallel import flow.
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");

  // (a) The lock screen itself carries the recovery entry point, and
  // the create/import box carries the way back to unlock.
  const unlockAt = idxSrc.indexOf('id="unlockBox"');
  const restoreBtnAt = idxSrc.indexOf('id="lockRestoreBtn"');
  const createAt = idxSrc.indexOf('id="createBox"');
  ok("lockfix: lock screen offers restore-from-seed inside the unlock box",
    unlockAt !== -1 && restoreBtnAt > unlockAt && restoreBtnAt < createAt
    && idxSrc.includes("Forgot password? Restore from seed phrase"));
  ok("lockfix: create/import box carries a back-to-unlock affordance",
    idxSrc.includes('id="restoreBackBtn"'));

  // (b) The route is the shared gate + the existing import handler:
  // restoreMode only re-routes which box the gate shows; the recovery
  // handler itself never touches the vault or the import machinery.
  const gateAt = appSrc.indexOf("function refreshGate()");
  const gateSlice = appSrc.slice(gateAt, gateAt + 800);
  ok("lockfix: gate routes restore mode to the existing create/import box",
    gateSlice.includes('show("unlockBox", hasVault && !wallet && !restoreMode)')
    && gateSlice.includes('show("createBox", (!hasVault || restoreMode) && !wallet)')
    && gateSlice.includes('show("restoreBackBtn", restoreMode && !wallet && hasVault)'));
  ok("lockfix: restore mode ends on unlock and on lock — no stale detour",
    gateSlice.includes("if (wallet) restoreMode = false;")
    && appSrc.slice(appSrc.indexOf("function lockWallet()"), appSrc.indexOf("function lockWallet()") + 1200).includes("restoreMode = false;"));
  const restoreAt = appSrc.indexOf('$("lockRestoreBtn").onclick');
  const restoreSlice = appSrc.slice(restoreAt, restoreAt + 2600);
  ok("lockfix: recovery handler routes through the shared gate only",
    restoreSlice.includes("restoreMode = true;") && restoreSlice.includes("refreshGate();")
    && !restoreSlice.includes("importVault(") && !restoreSlice.includes("setItem(VAULT_KEY"));
  ok("lockfix: create + import remain the only vault-writing paths",
    (appSrc.match(/localStorage\.setItem\(VAULT_KEY, v\.keystore\)/g) || []).length === 2);

  // (c) The destructive replace is confirmed before the flow opens:
  // warning copy (replaces the stored wallet; its seed phrase is the
  // only way back) plus a checkbox the continue button enforces.
  ok("lockfix: replace warning + seed-only-way-back copy precede the flow",
    restoreSlice.includes("replaces the wallet currently stored on this device")
    && restoreSlice.includes("its own seed phrase") && restoreSlice.includes('id="restoreCheck"')
    && restoreSlice.includes("I understand restoring replaces the wallet stored on this device"));
  ok("lockfix: continuing requires the confirmation checkbox",
    restoreSlice.includes('if (!$("restoreCheck").checked) return showSheetError('));
}

// ---------- Fluid Scan (in-wallet explorer, 2026-11-07) ----------
{
  const DRIP_EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const DRIP_BTC = "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn";
  const ETHU_BTC = "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw";
  const DRIP_ALGO = "O67U3XOR7LK42HA5DB2BCQDMSVW7WMY3QMCW6P7XXQONLRVRLESB6XAB34";
  const ETHU_ALGO = "IHRNG3GNVJILY66Y6D5V3NS6BSOBACXJGHAUSAR37S77JS4HRPEDWWWSC4";
  const DRIP_TRON = "TMdUcLZmKVvKYHMJ12k5AA3ZCCHxPpmSSf";
  const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // Tether's USDT contract — a real Tron address
  const DRIP_SOL = "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn";
  const DRIP_SUI = "0x0cb53076d1207be242b18a63d97d2ccbd63f74d75abb68d4b7ea63b3a1d38831";
  const OTHER_EVM = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  const HASH64 = "0x" + "ab".repeat(32);
  const TXID64 = "cd".repeat(32);

  // Family detection — every family, plus the overlap traps.
  ok("scan: detects an EVM address", detectScanFamily(DRIP_EVM)?.family === "evm");
  ok("scan: detects a Sui address (0x + 64 hex, NOT evm)", detectScanFamily(DRIP_SUI)?.family === "sui"
    && detectScanFamily(DRIP_SUI)?.address === DRIP_SUI);
  ok("scan: detects bech32 BTC", detectScanFamily(DRIP_BTC)?.family === "btc");
  ok("scan: detects legacy BTC by checksum (Satoshi address)", detectScanFamily("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")?.family === "btc");
  ok("scan: detects P2SH BTC", detectScanFamily("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")?.family === "btc");
  ok("scan: detects taproot BTC", detectScanFamily("bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297")?.family === "btc");
  ok("scan: a corrupted bech32 BTC address is NOT detected", detectScanFamily(DRIP_BTC.slice(0, -1) + "x") === null
    && isValidBitcoinAddress(DRIP_BTC.slice(0, -1) + "x") === false);
  ok("scan: detects Algorand (58-char base32 + checksum)", detectScanFamily(DRIP_ALGO)?.family === "algo");
  ok("scan: detects Tron before Solana (its own checksum decides)", detectScanFamily(DRIP_TRON)?.family === "tron");
  ok("scan: detects Solana base58", detectScanFamily(DRIP_SOL)?.family === "solana");
  ok("scan: garbage and empty input detect as nothing", detectScanFamily("hello world") === null
    && detectScanFamily("") === null && detectScanFamily("0x123") === null && detectScanFamily(null) === null);

  // Targets: a name scans its REGISTERED addresses only.
  const nameTargets = scanTargetsForName({ evm: DRIP_EVM, btc: DRIP_BTC, algo: DRIP_ALGO });
  ok("scan: a full name entry yields the 5-network EVM sweep + BTC + Algo", nameTargets.length === 7
    && nameTargets.slice(0, 5).every(t => t.family === "evm") && nameTargets[5].chainKey === "btc" && nameTargets[6].chainKey === "algo");
  ok("scan: the sweep order is the pinned main-five", JSON.stringify(SCAN_EVM_NETWORKS) === JSON.stringify(["ethereum", "bsc", "base", "polygon", "arbitrum"]));
  ok("scan: an evm-only entry yields just the sweep", scanTargetsForName({ evm: DRIP_EVM }).length === 5);
  ok("scan: a hostile entry is sanitised before targeting", scanTargetsForName({ evm: "not-an-address", btc: DRIP_BTC }).length === 1
    && scanTargetsForName(null).length === 0 && scanTargetsForName({}).length === 0);
  ok("scan: a raw EVM address gets the same sweep; BTC gets one target",
    scanTargetsForAddress(detectScanFamily(DRIP_EVM)).length === 5
    && scanTargetsForAddress(detectScanFamily(DRIP_BTC)).length === 1
    && scanTargetsForAddress(null).length === 0);
  ok("scan: BSC has NO Blockscout entry (no keyless history index exists — pinned honesty)",
    !("bsc" in SCAN_BLOCKSCOUT_APIS) && Object.values(SCAN_BLOCKSCOUT_APIS).every(u => u.startsWith("https://")));
  ok("scan: chain labels and badges", scanChainLabel("bsc") === "BNB Chain" && scanChainLabel("btc") === "Bitcoin"
    && scanChainBadge("bsc") === "BSC" && scanChainBadge("algo") === "ALGO");

  // Blockscout normalisation.
  const bsIn = normalizeBlockscoutTxs({ items: [
    { hash: HASH64, from: { hash: OTHER_EVM }, to: { hash: DRIP_EVM }, value: "500000000000000000", status: "ok", timestamp: "2026-11-07T10:00:00.000Z" },
    { hash: HASH64, from: { hash: DRIP_EVM }, to: { hash: OTHER_EVM }, value: "0", status: "ok", timestamp: "2026-11-07T11:00:00.000Z" },
    { hash: HASH64, from: { hash: DRIP_EVM }, to: { hash: OTHER_EVM }, value: "1000000000000000000", status: "error", timestamp: "2026-11-07T12:00:00.000Z" },
    { hash: "garbage", from: { hash: OTHER_EVM }, to: { hash: DRIP_EVM }, value: "1", status: "ok" },
    { hash: HASH64, from: { hash: OTHER_EVM }, to: { hash: OTHER_EVM }, value: "1000", status: "ok" },
  ] }, { networkKey: "bsc", address: DRIP_EVM });
  ok("scan: blockscout native rows keep only real value moves to/from the address", bsIn.length === 1
    && bsIn[0].direction === "in" && bsIn[0].amountText === "0.5" && bsIn[0].symbol === "BNB"
    && bsIn[0].counterparty === OTHER_EVM && bsIn[0].time === Date.parse("2026-11-07T10:00:00.000Z"));
  const bsTok = normalizeBlockscoutTokenTransfers({ items: [
    { transaction_hash: HASH64, from: { hash: OTHER_EVM }, to: { hash: DRIP_EVM },
      total: { value: "100500000", decimals: "6" }, token: { symbol: "USDC" }, timestamp: "2026-11-07T10:00:00.000Z" },
    { transaction_hash: HASH64, from: { hash: DRIP_EVM }, to: { hash: OTHER_EVM },
      total: { value: "not-a-number", decimals: "6" }, token: { symbol: "USDC" } },
  ] }, { networkKey: "base", address: DRIP_EVM });
  ok("scan: blockscout token rows scale by the transfer's own decimals; unparseable values drop",
    bsTok.length === 1 && bsTok[0].amountText === "100.5" && bsTok[0].symbol === "USDC" && bsTok[0].direction === "in");

  // Esplora normalisation: netting excludes change; direction follows the net.
  const esp = normalizeEsploraTxs([
    { txid: TXID64, vin: [{ prevout: { scriptpubkey_address: ETHU_BTC, value: 100000 } }],
      vout: [{ scriptpubkey_address: DRIP_BTC, value: 90000 }, { scriptpubkey_address: ETHU_BTC, value: 9000 }],
      status: { confirmed: true, block_time: 1762000000 } },
    { txid: TXID64, vin: [{ prevout: { scriptpubkey_address: DRIP_BTC, value: 90000 } }],
      vout: [{ scriptpubkey_address: ETHU_BTC, value: 50000 }, { scriptpubkey_address: DRIP_BTC, value: 39000 }],
      status: { confirmed: false } },
    { txid: "zz", vin: [], vout: [] },
  ], { address: DRIP_BTC });
  ok("scan: esplora rows net out change and name the single counterparty", esp.length === 2
    && esp[0].direction === "in" && esp[0].amountText === "0.0009" && esp[0].counterparty === ETHU_BTC
    && esp[1].direction === "out" && esp[1].amountText === "0.00051" && esp[1].counterparty === ETHU_BTC);
  ok("scan: an unconfirmed esplora tx is pending with no time", esp[1].pending === true && esp[1].time === null);

  // Algorand indexer normalisation.
  const algoTxId = "U7SYRJGWQIF6U3M5PPQG7SUOGUEPQBN4G3MVL5KI6T6HWVAXMZ4Q";
  const algoRows = normalizeAlgoIndexerTxs({ transactions: [
    { id: algoTxId, "tx-type": "pay", sender: ETHU_ALGO, "round-time": 1762000000, "payment-transaction": { receiver: DRIP_ALGO, amount: 500000 } },
    { id: algoTxId, "tx-type": "axfer", sender: DRIP_ALGO, "round-time": 1762000100, "asset-transfer-transaction": { receiver: ETHU_ALGO, amount: 2500000, "asset-id": 31566704 } },
    { id: algoTxId, "tx-type": "axfer", sender: DRIP_ALGO, "round-time": 1762000200, "asset-transfer-transaction": { receiver: ETHU_ALGO, amount: 42, "asset-id": 123456 } },
    { id: algoTxId, "tx-type": "pay", sender: DRIP_ALGO, "round-time": 1762000300, "payment-transaction": { receiver: DRIP_ALGO, amount: 0 } },
    { id: algoTxId, "tx-type": "appl", sender: DRIP_ALGO, "round-time": 1762000400 },
  ] }, { address: DRIP_ALGO });
  ok("scan: algo rows cover pay in, USDC axfer out, and a raw ASA row; zero + appl drop", algoRows.length === 3
    && algoRows[0].direction === "in" && algoRows[0].amountText === "0.5" && algoRows[0].symbol === "ALGO"
    && algoRows[1].direction === "out" && algoRows[1].amountText === "2.5" && algoRows[1].symbol === "USDC"
    && algoRows[2].symbol === "ASA 123456" && algoRows[2].amountText === "42");

  // Solana parsed-tx normalisation.
  const solSig = "1".repeat(88);
  const solRows = normalizeSolanaTx({
    blockTime: 1762000000,
    transaction: { message: { accountKeys: [{ pubkey: "4Nd1mPzV3kVZfzMGkFBPBjVzFnXc7PfKkzVbBBVMzvHV" }, { pubkey: DRIP_SOL }],
      instructions: [{ program: "system", parsed: { type: "transfer", info: { source: "4Nd1mPzV3kVZfzMGkFBPBjVzFnXc7PfKkzVbBBVMzvHV", destination: DRIP_SOL, lamports: 500000000 } } }] } },
    meta: { err: null, fee: 5000, preBalances: [2000000000, 100000000], postBalances: [1499995000, 600000000],
      preTokenBalances: [{ accountIndex: 2, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", owner: DRIP_SOL, uiTokenAmount: { amount: "1000000", decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 2, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", owner: DRIP_SOL, uiTokenAmount: { amount: "3500000", decimals: 6 } }] },
  }, solSig, { address: DRIP_SOL });
  const solNative = solRows.find(r => r.symbol === "SOL"), solTok = solRows.find(r => r.symbol === "USDC");
  ok("scan: solana native delta + parsed-instruction counterparty", !!solNative && solNative.direction === "in"
    && solNative.amountText === "0.5" && solNative.counterparty === "4Nd1mPzV3kVZfzMGkFBPBjVzFnXc7PfKkzVbBBVMzvHV");
  ok("scan: solana token delta resolves the known mint's symbol", !!solTok && solTok.direction === "in" && solTok.amountText === "2.5");
  ok("scan: a failed solana tx yields no rows", normalizeSolanaTx({ meta: { err: { InstructionError: [0, "Custom"] } }, transaction: { message: { accountKeys: [] } } }, solSig, { address: DRIP_SOL }).length === 0);

  // Tron normalisation (fixtures built with the wallet's own codec).
  const tronHex = (a) => tronAddressToHex(a);
  const tronRows = normalizeTronTxs({ data: [
    { txID: TXID64, block_timestamp: 1762000000000, raw_data: { contract: [{ type: "TransferContract",
      parameter: { value: { owner_address: tronHex(USDT_TRON), to_address: tronHex(DRIP_TRON), amount: 2500000 } } }] } },
    { txID: TXID64, block_timestamp: 1762000000000, raw_data: { contract: [{ type: "TriggerSmartContract",
      parameter: { value: { owner_address: tronHex(DRIP_TRON), contract_address: tronHex(USDT_TRON) } } }] } },
  ] }, { address: DRIP_TRON });
  ok("scan: tron native rows read TransferContract only, hex decoded to base58", tronRows.length === 1
    && tronRows[0].direction === "in" && tronRows[0].amountText === "2.5" && tronRows[0].symbol === "TRX"
    && tronRows[0].counterparty === USDT_TRON);
  const trc20Rows = normalizeTronTrc20Txs({ data: [
    { transaction_id: TXID64, block_timestamp: 1762000000000, from: DRIP_TRON, to: USDT_TRON, value: "100000000",
      token_info: { symbol: "USDT", decimals: 6 } },
  ] }, { address: DRIP_TRON });
  ok("scan: tron TRC20 rows scale by token decimals", trc20Rows.length === 1 && trc20Rows[0].direction === "out"
    && trc20Rows[0].amountText === "100.0" && trc20Rows[0].symbol === "USDT");

  // Sui GraphQL normalisation.
  const suiDigest = "7".repeat(44);
  const suiRows = normalizeSuiTxPage({ data: { transactions: { nodes: [
    { digest: suiDigest, sender: { address: DRIP_SUI }, effects: { timestamp: "2026-11-07T10:00:00.000Z",
      balanceChanges: { nodes: [
        { coinType: { repr: "0x2::sui::SUI" }, amount: "-1500000000", owner: { address: DRIP_SUI } },
        { coinType: { repr: "0x2::sui::SUI" }, amount: "1000000000", owner: { address: "0x" + "11".repeat(32) } },
      ] } } },
    { digest: suiDigest, sender: { address: "0x" + "22".repeat(32) }, effects: { timestamp: "2026-11-07T11:00:00.000Z",
      balanceChanges: { nodes: [
        { coinType: { repr: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" }, amount: "2500000", owner: { address: DRIP_SUI } },
      ] } } },
  ] } } }, { address: DRIP_SUI });
  ok("scan: sui rows come from balance changes, counterparty paired by coin", suiRows.length === 2
    && suiRows[0].direction === "out" && suiRows[0].amountText === "1.5" && suiRows[0].symbol === "SUI"
    && suiRows[0].counterparty === "0x" + "11".repeat(32)
    && suiRows[1].direction === "in" && suiRows[1].amountText === "2.5" && suiRows[1].symbol === "USDC"
    && suiRows[1].counterparty === "0x" + "22".repeat(32));

  // Merge: dedupe, newest first, pending (timeless) first, capped.
  const merged = mergeScanRows([
    [{ chainKey: "btc", txid: TXID64, direction: "in", symbol: "BTC", amountText: "0.1", counterparty: null, time: 1000 },
     { chainKey: "btc", txid: TXID64, direction: "in", symbol: "BTC", amountText: "0.1", counterparty: null, time: 1000 }],
    [{ chainKey: "algo", txid: algoTxId, direction: "out", symbol: "ALGO", amountText: "1", counterparty: null, time: 2000 },
     { chainKey: "btc", txid: TXID64, direction: "out", symbol: "BTC", amountText: "0.2", counterparty: null, time: null, pending: true }],
  ]);
  ok("scan: merge dedupes, sorts newest-first, pending first", merged.length === 3
    && merged[0].pending === true && merged[1].time === 2000 && merged[2].time === 1000);

  // Explorer URLs: built only for well-shaped ids.
  ok("scan: tx urls per family", scanTxUrl("bsc", HASH64) === "https://bscscan.com/tx/" + HASH64
    && scanTxUrl("btc", TXID64) === "https://mempool.space/tx/" + TXID64
    && scanTxUrl("algo", algoTxId) === "https://explorer.perawallet.app/tx/" + algoTxId
    && scanTxUrl("solana", solSig) === "https://solscan.io/tx/" + solSig
    && scanTxUrl("tron", TXID64) === "https://tronscan.org/#/transaction/" + TXID64
    && scanTxUrl("sui", suiDigest) === "https://suiscan.xyz/mainnet/tx/" + suiDigest);
  ok("scan: malformed ids never become links", scanTxUrl("btc", "xyz") === null && scanTxUrl("ethereum", "0x123") === null
    && scanTxUrl("algo", "lowercase-not-base32") === null && scanTxUrl("nope", TXID64) === null);
  ok("scan: address urls only where the path shape is standard", scanAddressUrl("bsc", DRIP_EVM) === "https://bscscan.com/address/" + DRIP_EVM
    && scanAddressUrl("btc", DRIP_BTC) === "https://mempool.space/address/" + DRIP_BTC
    && scanAddressUrl("solana", DRIP_SOL) === null);

  // Rendering: every chain-supplied string is escaped in core.
  const hostile = formatScanFeedEntry({ direction: "in", amountText: "1", symbol: "<img src=x onerror=alert(1)>",
    counterparty: 'a"><svg x' }, "3h ago");
  ok("scan: feed entry escapes hostile symbol + counterparty", hostile.includes("&lt;img") && hostile.includes("&lt;svg")
    && hostile.includes("&quot;&gt;") && !hostile.includes("<img") && !hostile.includes("<svg")
    && hostile.startsWith('<div class="hist">Received'));
  ok("scan: feed entry words for out + self", formatScanFeedEntry({ direction: "out", amountText: "2", symbol: "ALGO", counterparty: null }, "").includes("Sent <b>2 ALGO</b>")
    && formatScanFeedEntry({ direction: "self", amountText: "2", symbol: "ALGO", counterparty: null }, "").includes("Self transfer"));

  // Honest per-chain status lines.
  const tgt = scanTarget("base", DRIP_EVM, "evm");
  ok("scan: status text — failure names the chain", scanChainStatusText({ target: tgt, ok: false, rows: [], note: "failed" }).includes("Couldn't load Base"));
  ok("scan: status text — empty chain says so", scanChainStatusText({ target: tgt, ok: true, rows: [], note: null }) === "No activity found on Base.");
  ok("scan: status text — no-history-index explains itself", scanChainStatusText({ target: scanTarget("bsc", DRIP_EVM, "evm"), ok: true, rows: [], note: "no-history-index" }).includes("keyless source"));
  ok("scan: status text — a chain with rows needs no note", scanChainStatusText({ target: tgt, ok: true, rows: [{}], note: null }) === "");

  // Source pins: the pane, the tab, the privacy truth, the wiring.
  const scanAppSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const scanIdxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("scan: pane + input + button + tab exist in the page", scanIdxSrc.includes('id="tab-scan"') && scanIdxSrc.includes('id="scanInput"')
    && scanIdxSrc.includes('id="scanBtn"') && scanIdxSrc.includes('data-tab="scan"'));
  ok("scan: the privacy truth is printed under the search box, verbatim",
    scanIdxSrc.includes("Scan shows what is public on-chain for a name's registered addresses. Unregistered addresses stay private."));
  ok("scan: goTab knows the scan pane", scanAppSrc.includes('["wallet", "play", "activity", "scan", "more", "bridge"]'));
  ok("scan: the controller resolves names via the shared registry path and addresses via detection",
    scanAppSrc.includes("resolveFluidName(input)") && scanAppSrc.includes("detectScanFamily(input)")
    && scanAppSrc.includes("scanTargetsForName(entry)") && scanAppSrc.includes("fetchScan(targets)"));
  ok("scan: per-chain cap is a small constant", SCAN_TX_LIMIT === 20);
}

// ---------- QA fix build 2026-11-07 (F2–F14 + cosmetics) ----------
// Findings from the full first-user QA walk of the live site (147
// controls). F1 was closed as a bad QA fixture (the wallet was
// right); everything below pins a real fix.
{
  const core = await import("../src/wallet-core.js");
  const { resolveChainRecipient, isValidAlgorandAddress, isValidTronAddress, isValidSolanaAddress, isValidSuiAddress,
    lnErrorText, parseSisPathsInput, lnReceiveTransition, lnReceiveView,
    parsePaycrestRate, paycrestRateUrl, fetchPaycrestRate, parsePaycrestMarketRate, resolvePaycrestMarketRate, PAYCREST_CURRENCIES_URL, PAYCREST_MARKET_MAX_DIVERGENCE, getXrplAccount, xrplAddressFromPhrase, getSolanaAllTokens } = core;
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const ALGO_ZERO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AY5HFKQ".replace(" ", "");
  const ALGO_REAL = "IHRNG3GNVJILY66Y6D5V3NS6BSOBACXJGHAUSAR37S77JS4HRPEDWWWSC4";
  const throwsMsg = async (fn, want) => { try { await fn(); return false; } catch (e) { return e.message === want; } };

  // F2: a valid Algorand address is recognised BEFORE any name lookup.
  {
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    const r = await resolveChainRecipient(ALGO_ZERO, { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand", lookupName: spy });
    ok("F2: the checksum-valid Algorand zero address resolves as an address", r.to === ALGO_ZERO && r.name === null);
    ok("F2: no name lookup runs for a valid Algorand address", lookups === 0);
  }
  // F3–F5: name resolution on every chain, exact registry wording.
  {
    const reg = async (n) => n === "ethuram" ? { name: "ethuram", evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", btc: "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw", algo: ALGO_REAL } : null;
    ok("F3–F5: a known name resolves its Algorand address",
      (await resolveChainRecipient("ethuram", { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand", lookupName: reg })).to === ALGO_REAL);
    ok("F3: Solana name error is the exact registry wording", await throwsMsg(
      () => resolveChainRecipient("ethuram", { isValidAddress: isValidSolanaAddress, field: null, chainLabel: "Solana", lookupName: reg }),
      "That Fluid name has no Solana address in the registry."));
    ok("F4: Tron name error is the exact registry wording", await throwsMsg(
      () => resolveChainRecipient("ethuram", { isValidAddress: isValidTronAddress, field: null, chainLabel: "Tron", lookupName: reg }),
      "That Fluid name has no Tron address in the registry."));
    ok("F5: Sui name error is the exact registry wording", await throwsMsg(
      () => resolveChainRecipient("ethuram", { isValidAddress: isValidSuiAddress, field: null, chainLabel: "Sui", lookupName: reg }),
      "That Fluid name has no Sui address in the registry."));
    ok("F3–F5: an unknown name is hard-blocked as unregistered (audit P1-2 copy)", await throwsMsg(
      () => resolveChainRecipient("ghost", { isValidAddress: isValidSolanaAddress, field: null, chainLabel: "Solana", lookupName: reg }),
      "No Fluid user with that name — check the spelling."));
    ok("F3–F5: a valid Tron address passes untouched, no lookup", await (async () => {
      let n = 0; const spy = async () => { n++; return null; };
      const tronAddr = core.tronAddressFromPhrase(KNOWN_PHRASE); // (the QA walk's fixture T-address had a bad checksum — F1)
      const r = await resolveChainRecipient(tronAddr, { isValidAddress: isValidTronAddress, field: null, chainLabel: "Tron", lookupName: spy });
      return r.to === tronAddr && n === 0;
    })());
    ok("F3–F5: all three sheets route through the shared resolver", appSrc.includes('chainLabel: "Tron"')
      && appSrc.includes('chainLabel: "Solana"') && appSrc.includes('chainLabel: "Sui"'));
  }
  // F6: Lightning receive can never render a silent blank.
  {
    ok("F6: a thrown WASM string becomes the message", lnErrorText("an offer needs blinded paths") === "an offer needs blinded paths");
    ok("F6: undefined/null errors get a plain fallback", lnErrorText(undefined).length > 0 && lnErrorText(null).length > 0 && lnErrorText(new Error("")).length > 0);
    let s = { status: "idle" };
    s = lnReceiveTransition(s, { type: "request" });
    ok("F6: request → working with a spinner", lnReceiveView(s).status === "working" && lnReceiveView(s).spinner === true);
    s = lnReceiveTransition(s, { type: "success", text: "lno1example" });
    ok("F6: success → ready with the offer", lnReceiveView(s).text === "lno1example");
    s = lnReceiveTransition(s, { type: "request" });
    s = lnReceiveTransition(s, { type: "success", text: "" });
    ok("F6: an empty offer is a failure, never a blank QR", lnReceiveView(s).status === "failed" && lnReceiveView(s).message.length > 0);
    s = lnReceiveTransition(s, { type: "failure", error: "node says no" });
    ok("F6: a string failure surfaces verbatim", lnReceiveView(s).message === "node says no");
    ok("F6: the panel repaints receive + offline displays from state", appSrc.includes("paintLnReceive();") && appSrc.includes("paintLnSis();"));
  }
  // F7: the offline-offer input is validated before JSON.parse.
  {
    ok("F7: empty input gets the friendly paste message", await throwsMsg(async () => parseSisPathsInput("  "), "Paste the blinded-path list from your holding peer first."));
    ok("F7: malformed JSON gets a friendly message, not a SyntaxError", await throwsMsg(async () => parseSisPathsInput("{oops"), "That doesn't look like the blinded-path list — paste the full JSON list from your holding peer, exactly as they gave it."));
    ok("F7: an empty list gets the paste message", await throwsMsg(async () => parseSisPathsInput("[]"), "Paste the blinded-path list from your holding peer first."));
    ok("F7: a non-hex entry is called out", await throwsMsg(async () => parseSisPathsInput('["zz"]'), "One of those entries isn't a blinded path — paste the list exactly as your holding peer gave it."));
    ok("F7: a real list passes through", JSON.stringify(parseSisPathsInput('["ab12", "CD34"]')) === '["ab12","CD34"]');
    ok("F7: the sheet validates via the core helper, never raw JSON.parse on the input",
      appSrc.includes("parseSisPathsInput($(\"lnSisPaths\").value)") && !appSrc.includes("JSON.parse($(\"lnSisPaths\")"));
  }
  // F9/F10: Paycrest sell side + the KES pair on the same surface.
  // The parsePaycrestRate checks pin the PROVIDER-QUOTE parse (the
  // cross-check input); the DISPLAYED figure is the market rate —
  // pinned by the F13 block right after this one.
  {
    const payload = { status: "success", data: { buy: { rate: "1384.52" }, sell: { rate: "1369.35" } } };
    ok("F9: the NGN sell quote parses from the same payload", parsePaycrestRate(payload, "NGN", "sell") === 1369.35);
    ok("F10: the KES quote pair parses (buy + sell)", parsePaycrestRate({ status: "success", data: { buy: { rate: "130.94" }, sell: { rate: "128.79" } } }, "KES", "buy") === 130.94
      && parsePaycrestRate({ status: "success", data: { buy: { rate: "130.94" }, sell: { rate: "128.79" } } }, "KES", "sell") === 128.79);
    ok("F10: the KES sanity band rejects absurd quotes", parsePaycrestRate({ status: "success", data: { buy: { rate: "49.99" } } }, "KES", "buy") === null
      && parsePaycrestRate({ status: "success", data: { buy: { rate: "500.01" } } }, "KES", "buy") === null);
    ok("F9/F10: unsupported fiats and bad payloads read as no quote", parsePaycrestRate(payload, "GHS", "buy") === null
      && parsePaycrestRate(null, "NGN", "sell") === null && parsePaycrestRate({ status: "error" }, "NGN", "sell") === null);
    ok("F10: the KES rates URL is the same keyless surface", paycrestRateUrl("KES") === "https://api.paycrest.io/v2/rates/base/USDT/50/KES");
    const realFetch = globalThis.fetch;
    const url2 = (curr, rates) => async (url) => String(url).includes("/v1/currencies")
      ? { ok: true, json: async () => curr } : { ok: true, json: async () => rates };
    try {
      globalThis.fetch = url2({ status: "success", data: [{ code: "NGN", marketBuyRate: "1384.52", marketSellRate: "1369.35" }] }, payload);
      ok("F9: fetchPaycrestRate resolves the NGN MARKET sell rate", await fetchPaycrestRate("NGN", "sell") === 1369.35);
      globalThis.fetch = async () => { throw new Error("offline"); };
      ok("F9: fetch failure reads as no benchmark, never throws", await fetchPaycrestRate("NGN", "sell") === null);
    } finally { globalThis.fetch = realFetch; }
  }
  // F13: the "market rate" line is the MARKET field, never the
  // provider quote (2026-11-09: the NGN quote sat at ~₦683, half
  // the ₦1,378 market, for hours — labelled "market" it primed a
  // seller to accept half their money).
  {
    const currNgn = { status: "success", data: [
      { code: "NGN", marketBuyRate: "1378.52", marketSellRate: "1378.75" },
      { code: "KES", marketBuyRate: "130", marketSellRate: "129.85" } ] };
    ok("F13: currencies endpoint is the keyless market list", PAYCREST_CURRENCIES_URL === "https://api.paycrest.io/v1/currencies");
    ok("F13: market parse reads both NGN sides", parsePaycrestMarketRate(currNgn, "NGN", "buy") === 1378.52
      && parsePaycrestMarketRate(currNgn, "NGN", "sell") === 1378.75);
    ok("F13: market parse reads the KES entry, not NGN's", parsePaycrestMarketRate(currNgn, "KES", "sell") === 129.85);
    ok("F13: market parse rejects junk payloads", [null, undefined, 42, {}, { status: "error", data: [] },
      { status: "success", data: {} }, { status: "success", data: [] },
      { status: "success", data: [{ code: "NGN" }] },
      { status: "success", data: [{ code: "NGN", marketBuyRate: "abc" }] },
      { status: "success", data: [{ code: "GHS", marketBuyRate: "15", marketSellRate: "15" }] }]
      .every(x => parsePaycrestMarketRate(x, "NGN", "buy") === null));
    ok("F13: market parse keeps the per-fiat band", parsePaycrestMarketRate({ status: "success", data: [{ code: "NGN", marketBuyRate: "499.99" }] }, "NGN", "buy") === null
      && parsePaycrestMarketRate({ status: "success", data: [{ code: "KES", marketBuyRate: "500.01" }] }, "KES", "buy") === null);
    ok("F13: resolver passes a healthy market figure through", resolvePaycrestMarketRate(1378.75, 1369.8) === 1378.75
      && PAYCREST_MARKET_MAX_DIVERGENCE === 0.25);
    ok("F13: the witness is one-sided — a quote far ABOVE the figure contradicts it", resolvePaycrestMarketRate(600, 4000) === null
      && resolvePaycrestMarketRate(1378.75, 1800) === null);
    ok("F13: a quote far BELOW the figure (broken quote) never suppresses it", resolvePaycrestMarketRate(1378.75, 683.43) === 1378.75
      && resolvePaycrestMarketRate(5000, 900) === 5000);
    ok("F13: resolver never substitutes the quote for a missing market figure", resolvePaycrestMarketRate(null, 1384.52) === null
      && resolvePaycrestMarketRate(undefined, 1384.52) === null && resolvePaycrestMarketRate(NaN, 1384.52) === null);
    ok("F13: an absent quote cannot suppress a true market figure", resolvePaycrestMarketRate(1378.75, null) === 1378.75);
    const realFetch = globalThis.fetch;
    const byUrl = (curr, rates) => async (url) => String(url).includes("/v1/currencies")
      ? { ok: true, json: async () => curr } : { ok: true, json: async () => rates };
    try {
      // (i)+(ii): the 2026-11-09 shape — market ₦1,378.75, quote broken at ₦683.43.
      globalThis.fetch = byUrl(currNgn, { status: "success", data: { buy: { rate: "698.3" }, sell: { rate: "683.43" } } });
      ok("F13: broken provider quote does NOT change the displayed market figure (sell)", await fetchPaycrestRate("NGN", "sell") === 1378.75);
      ok("F13: broken provider quote does NOT change the displayed market figure (buy)", await fetchPaycrestRate("NGN", "buy") === 1378.52);
      // Healthy world: quote near market → the market figure shows.
      globalThis.fetch = byUrl(currNgn, { status: "success", data: { buy: { rate: "1384.52" }, sell: { rate: "1369.35" } } });
      ok("F13: healthy feeds render the market figure", await fetchPaycrestRate("NGN", "sell") === 1378.75);
      globalThis.fetch = byUrl(currNgn, { status: "success", data: { buy: { rate: "130.99" }, sell: { rate: "128.85" } } });
      ok("F13: the KES market figure renders on the same path", await fetchPaycrestRate("KES", "sell") === 129.85);
      // (iii): market source dead → no line, even with a perfect quote in hand.
      globalThis.fetch = async (url) => String(url).includes("/v1/currencies")
        ? { ok: false, status: 503, json: async () => ({}) }
        : { ok: true, json: async () => ({ status: "success", data: { buy: { rate: "1384.52" }, sell: { rate: "1369.35" } } }) };
      ok("F13: market source failure → no line (never the quote)", await fetchPaycrestRate("NGN", "sell") === null);
      globalThis.fetch = async () => { throw new Error("offline"); };
      ok("F13: total fetch failure → no line", await fetchPaycrestRate("NGN", "buy") === null);
    } finally { globalThis.fetch = realFetch; }
    const coreSrcF13 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    ok("F13: the sheet's benchmark is market-sourced in core (currencies feed + resolver wired)",
      coreSrcF13.includes("fetchPaycrestRateOrNull(PAYCREST_CURRENCIES_URL)")
      && coreSrcF13.includes("resolvePaycrestMarketRate(market, parsePaycrestRate(ratesJson, fiat, side))"));
  }
  // F11: the name section shows the same fields in both states.
  {
    ok("F11: a built entry carries the Algorand address when given a valid one",
      buildNameEntry("someone", "0x0EBf5563F905E3B9D58718E28E08143511DC763b", "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw", null, ALGO_REAL).someone.algo === ALGO_REAL);
    ok("F11: a malformed Algorand value never reaches an entry",
      buildNameEntry("someone", "0x0EBf5563F905E3B9D58718E28E08143511DC763b", "bc1qh0eydm0klss3y0j79d3mctcvkpxu7xrzyfzqdw", null, "not-an-address").someone.algo === undefined);
    ok("F11: the owned box lists EVM + Bitcoin + Algorand + Lightning", idxSrc.includes('id="ownedEvm"') && idxSrc.includes('id="ownedBtc"')
      && idxSrc.includes('id="ownedAlgo"') && idxSrc.includes('id="ownedLn"'));
    ok("F11: the owned state has the Lightning field the Receive sheet promises",
      idxSrc.includes('id="ownedLnInput"') && idxSrc.includes('id="ownedLnAddBtn"')
      && appSrc.includes("under “Your Fluid name” in the More tab"));
    ok("F11: the Lightning row is not hidden away in the owned state", !idxSrc.includes('class="hist hidden" id="ownedLnRow"'));
  }
  // F12: XRPL — ledger errors are answers, endpoints are CORS-usable.
  {
    const addr = xrplAddressFromPhrase(KNOWN_PHRASE);
    const realFetch = globalThis.fetch;
    const seen = [];
    try {
      globalThis.fetch = async (url, opts) => {
        seen.push(String(url));
        const body = JSON.parse(opts.body);
        if (body.method === "server_info") return { ok: true, json: async () => ({ result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }) };
        if (body.method === "account_info") return { ok: true, json: async () => ({ result: { error: "actNotFound", error_message: "Account not found.", status: "error" } }) };
        throw new Error("unexpected method " + body.method);
      };
      const acct = await getXrplAccount(addr);
      ok("F12: an unfunded account reads as funded:false, not a network failure", acct.funded === false && acct.balances[0].amount === "0");
      ok("F12: the first endpoint tried is the CORS-clean cluster", seen[0] === "https://xrplcluster.com");
      seen.length = 0;
      globalThis.fetch = async (url, opts) => {
        seen.push(String(url));
        if (String(url).includes("xrplcluster")) throw new Error("connection refused");
        const body = JSON.parse(opts.body);
        if (body.method === "server_info") return { ok: true, json: async () => ({ result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }) };
        if (body.method === "account_info") return { ok: true, json: async () => ({ result: { error: "actNotFound", error_message: "Account not found.", status: "error" } }) };
        throw new Error("unexpected method " + body.method);
      };
      const acct2 = await getXrplAccount(addr);
      ok("F12: a dead first endpoint falls through to the next", acct2.funded === false && seen.some(u => u.includes("xrpl.ws")));
    } finally { globalThis.fetch = realFetch; }
    ok("F12: a failed XRPL load renders as unknown, never a dressed-up zero",
      appSrc.includes('amount: null, address: null, decimals: 6, verified: true }];') && appSrc.includes("couldn't load"));
    ok("F12/F13: Retry re-runs in place with an outcome", appSrc.includes("async function retryFamily(")
      && appSrc.includes("Retrying…") && appSrc.includes("still couldn't be loaded"));
  }
  // F13: Solana scan survives one RPC refusing the token scan.
  {
    const realFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, opts) => {
        if (String(url).includes("api.mainnet-beta")) return { ok: false, status: 403, json: async () => ({}) };
        const body = JSON.parse(opts.body);
        if (body.method === "getBalance") return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: { value: 0 } }) };
        if (body.method === "getTokenAccountsByOwner") return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: { value: [] } }) };
        throw new Error("unexpected " + body.method);
      };
      const rows = await getSolanaAllTokens("11111111111111111111111111111111");
      ok("F13: the full token scan completes via the fallback RPC", Array.isArray(rows) && rows.length === 3 && rows[0].symbol === "SOL");
      globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
      let threw = false;
      try { await getSolanaAllTokens("11111111111111111111111111111111"); } catch { threw = true; }
      ok("F13: when every RPC refuses, the scan still fails honestly (fallback rows take over)", threw === true);
    } finally { globalThis.fetch = realFetch; }
  }
  // F14 + cosmetics.
  ok("F14: entering the app lands on Wallet home", appSrc.includes('if (wallet && gateWasLocked) goTab("wallet");'));
  ok("cosmetic i: a stale password error clears once the password is valid",
    appSrc.includes('for (const id of ["createPw", "createPw2"])') && appSrc.includes("Passwords do not match"));
  ok("cosmetic ii: removing the wallet resets the gate username preview",
    appSrc.includes('$("createNamePreview").textContent = "you." + FLUID_DOMAIN;'));
  ok("cosmetic iii: Refresh balances shows working + done feedback",
    appSrc.includes("Refreshing…") && appSrc.includes('toast((evmLoadFailed || btcLoadFailed) ? "Balances couldn\'t load — check your connection and try again" : "Balances refreshed")'));
}

// ---------- QA round 2 (2026-11-08): app-path pins, not core-only ----------
// Round 1's lesson: a core-level pin is not proof — the live sheet
// disagreed with the pinned core function. Every pin below ties the
// fix to the exact handler/branch the UI calls.
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const { resolveChainRecipient, isValidAlgorandAddress, algoAddressFromPhrase,
    fetchNameRegistry, resolveFluidName, NAMES_REGISTRY_URL, NAMES_REGISTRY_FALLBACK_URL,
    fetchScanTarget, scanTargetsForName, scanTargetsForAddress, detectScanFamily } = await import("../src/wallet-core.js");

  // R2-A (F2): the Algorand sheet's own handler is the pinned path.
  const agStart = appSrc.indexOf('$("agReview").onclick');
  const agSeg = appSrc.slice(agStart, appSrc.indexOf("algoSendPlan", agStart));
  ok("R2-A: the Algorand sheet calls the shared resolver with no validity pre-gate of its own",
    agSeg.includes('resolveChainRecipient(to, { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand" })')
    && !agSeg.includes("if (to && !isValidAlgorandAddress(to))"));
  const ALGO_ZERO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
  ok("R2-A: the pinned zero address is exactly 58 chars (one dropped 'A' is invisible — the pin guards the string itself)",
    ALGO_ZERO.length === 58);
  let lookups = 0;
  const spy = async () => { lookups++; return null; };
  // The sheet's exact data flow: input value → trim → the shared call.
  const sheetPath = (raw) => resolveChainRecipient(String(raw || "").trim(),
    { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand", lookupName: spy });
  const rz = await sheetPath(ALGO_ZERO);
  ok("R2-A: the exact string the sheet passes for the zero address resolves as an address, no lookup",
    rz.to === ALGO_ZERO && rz.name === null && lookups === 0);
  const ALGO_DERIVED = algoAddressFromPhrase("absent law burger minor breeze age tooth target report piece orchard close");
  const rd = await sheetPath(ALGO_DERIVED);
  ok("R2-A: a valid non-zero Algorand address (derived from the QA phrase) resolves as an address via the same path",
    rd.to === ALGO_DERIVED && rd.name === null && lookups === 0);
  let shortBlocked = false;
  try { await sheetPath(ALGO_ZERO.slice(1)); } catch { shortBlocked = true; }
  ok("R2-A: a 57-char near-miss does NOT resolve as an address (the transcription sensitivity, documented) — and no registry lookup runs for it (audit P1-2: it is a malformed address, not a name)",
    shortBlocked === true && lookups === 0);

  // R2-B1 (F11): the name section is scoped to the current wallet.
  const nsStart = appSrc.indexOf("function renderNameSection()");
  const nsSeg = appSrc.slice(nsStart, appSrc.indexOf("async function adoptRegistryNameIfMine", nsStart));
  ok("R2-B1: the owned Algorand row derives from the CURRENT wallet's phrase, never the family global",
    nsSeg.includes('$("ownedAlgo").textContent = algoAddressFromPhrase(wallet.mnemonic.phrase);')
    && !nsSeg.includes("algoAddr ||"));
  ok("R2-B1: the owned Bitcoin row derives from the current wallet's phrase too",
    nsSeg.includes('$("ownedBtc").textContent = bitcoinAddress(wallet.mnemonic.phrase);')
    && !nsSeg.includes("btcAddr ||"));
  ok("R2-B1: the async registry refine is generation + identity guarded against wallet switches",
    appSrc.includes("let nameSectionGen = 0;") && appSrc.includes("stillCurrent()"));
  ok("R2-B1: importing a wallet unbinds the replaced wallet's device-saved name",
    appSrc.includes('localStorage.removeItem("fluid_name");'));

  // R2-B2 (F11): the Lightning add form renders in both states,
  // including after a failed registry read; and the app can tell
  // "name not published" apart from "registry unreachable".
  const lnStart = appSrc.indexOf("const paintOwnedLn");
  const lnSeg = appSrc.slice(lnStart, appSrc.indexOf("paintOwnedLn(null);", lnStart));
  ok("R2-B2: both no-Lightning branches (not-registered AND registry-unknown) render the add form",
    lnSeg.includes("} else if (unknown) {") && (lnSeg.match(/show\("ownedLnAdd", true\)/g) || []).length >= 2);
  {
    const realFetch = globalThis.fetch;
    const REG = { ethuram: { evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b" } };
    try {
      globalThis.fetch = async () => ({ ok: true, json: async () => REG });
      ok("R2-B2: an unpublished name resolves null while the registry itself reads fine (not 'unreachable')",
        (await resolveFluidName("freshname")) === null
        && JSON.stringify(await fetchNameRegistry()) === JSON.stringify(REG));
      globalThis.fetch = async () => { throw new Error("offline"); };
      ok("R2-B2: an unreachable registry reads as null from the registry fetch itself",
        (await fetchNameRegistry()) === null);
      const calls = [];
      globalThis.fetch = async (url) => {
        calls.push(String(url));
        if (String(url) === NAMES_REGISTRY_URL) return { ok: true, json: async () => { throw new Error("html, not json"); } };
        return { ok: true, json: async () => REG };
      };
      const hit = await resolveFluidName("ethuram");
      ok("R2-B2: a non-JSON primary body (an HTML redirect page) falls through to the mirror",
        hit?.evm === REG.ethuram.evm && calls.length === 2 && calls[1] === NAMES_REGISTRY_FALLBACK_URL);
    } finally { globalThis.fetch = realFetch; }
  }

  // R2-C (Scan): name and raw paths — identical targets, one shared
  // fetcher, one retry budget.
  const DRIP_EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const nameBase = scanTargetsForName({ evm: DRIP_EVM }).find(t => t.chainKey === "base");
  const rawBase = scanTargetsForAddress(detectScanFamily(DRIP_EVM)).find(t => t.chainKey === "base");
  ok("R2-C: the name path and the raw path build the IDENTICAL Base target",
    JSON.stringify(nameBase) === JSON.stringify(rawBase));
  ok("R2-C: runScan converges both branches on a single fetchScan call",
    (appSrc.match(/await fetchScan\(targets\)/g) || []).length === 1
    && appSrc.includes("scanTargetsForName(entry)") && appSrc.includes("scanTargetsForAddress(detected)"));
  {
    const realFetch = globalThis.fetch;
    let infoCalls = 0;
    try {
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith("/transactions") || u.endsWith("/token-transfers")) return { ok: true, json: async () => ({ items: [] }) };
        if (u.includes("base.blockscout.com")) {
          infoCalls++;
          if (infoCalls === 1) return { ok: false, status: 429, json: async () => ({}) };
          return { ok: true, json: async () => ({ coin_balance: "1000000000000000000" }) };
        }
        throw new Error("unexpected " + u);
      };
      const rName = await fetchScanTarget(nameBase);
      ok("R2-C: the name path recovers a throttled balance via the shared retry",
        rName.ok === true && rName.balanceText === "1.0" && infoCalls === 2);
      infoCalls = 0;
      const rRaw = await fetchScanTarget(rawBase);
      ok("R2-C: the raw path gets the identical result on the identical retry budget",
        rRaw.ok === true && rRaw.balanceText === "1.0" && infoCalls === 2);
    } finally { globalThis.fetch = realFetch; }
  }

  // R2-D (stale build): HTML entries must revalidate; assets may not
  // be touched by the rule.
  const headersSrc = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  ok("R2-D: the HTML entries carry a must-revalidate cache rule",
    headersSrc.includes("/index.html") && headersSrc.includes("/recovery.html")
    && headersSrc.includes("/fluid-wallet.html")
    && headersSrc.includes("Cache-Control: public, max-age=0, must-revalidate"));
  const headerRules = headersSrc.split("\n").filter(l => !l.trim().startsWith("#")).join("\n");
  ok("R2-D: the rule is scoped to HTML documents only — no wildcard, no asset paths",
    !headerRules.includes("/*") && !headerRules.includes("app.bundle.js") && !headerRules.includes("lightning.chunk.js"));
  const buildSrc = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  ok("R2-D: the build ships _headers into dist (Netlify's publish dir)",
    buildSrc.includes('copyFileSync("public/_headers", "dist/_headers")'));
}

// ---------- QA round 3 (2026-11-08): invisible-character recipients + name-description state ----------
// R3-A (F2, third strike): the canonical zero address was STILL
// rejected live as an unregistered name, while every pinned path
// resolved it. Executing the chain against inputs carrying
// INVISIBLE FORMAT characters convicted the class: a trailing
// zero-width space (U+200B) — invisible in the field, not stripped
// by .trim() or by an <input>'s value sanitisation — reproduces
// the exact live error against the pre-fix resolver, and the bare
// string resolves. The fix cleans the input in the ONE shared
// resolver; the pins below execute that full chain (the sheet's
// exact data flow: field value → trim → the shared call).
{
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const { resolveChainRecipient, isValidAlgorandAddress, algoAddressFromPhrase, cleanRecipientInput } =
    await import("../src/wallet-core.js");
  const ALGO_ZERO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
  const sheetPath = (raw, lookupName) => resolveChainRecipient(String(raw || "").trim(),
    { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand", lookupName });
  const throwsMsg = async (fn, want) => { try { await fn(); return false; } catch (e) { return e.message === want; } };

  ok("R3-A: the cleaner strips the invisible format set and nothing else",
    cleanRecipientInput("ab\u200Bc\u200Cd\u200De\u2060f\u00ADg\uFEFFh") === "abcdefgh"
    && cleanRecipientInput("  ethuram  ") === "ethuram"
    && cleanRecipientInput(ALGO_ZERO) === ALGO_ZERO);
  {
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    const bare = await sheetPath(ALGO_ZERO, spy);
    ok("R3-A: canonical zero address — address branch, no lookup (control)",
      bare.to === ALGO_ZERO && bare.name === null && lookups === 0);
    const zwsp = await sheetPath(ALGO_ZERO + "\u200B", spy);
    ok("R3-A: zero address + trailing U+200B resolves as the address, cleaned, no lookup (the live failure, convicted)",
      zwsp.to === ALGO_ZERO && zwsp.name === null && lookups === 0);
    const mid = await sheetPath(ALGO_ZERO.slice(0, 20) + "\u200C" + ALGO_ZERO.slice(20), spy);
    ok("R3-A: zero address + mid-string U+200C resolves as the address, no lookup",
      mid.to === ALGO_ZERO && mid.name === null && lookups === 0);
    const derived = algoAddressFromPhrase("absent law burger minor breeze age tooth target report piece orchard close");
    const rd = await sheetPath(derived + "\u200D", spy);
    ok("R3-A: a normal address + trailing U+200D resolves as the address, no lookup",
      rd.to === derived && rd.name === null && lookups === 0);
    ok("R3-A: a 57-char near-miss hard-blocks — as a malformed address, with NO registry claim (audit P1-2: the pre-fix code misreported it as an unregistered name)",
      await throwsMsg(() => sheetPath(ALGO_ZERO.slice(0, 57), spy), "That doesn't look like a valid Algorand address, and it isn't a Fluid name either — check it and try again.") && lookups === 0);
    const reg = async (n) => n === "ethuram" ? { name: "ethuram", algo: ALGO_ZERO } : null;
    ok("R3-A: a real name still resolves through the lookup after cleaning",
      (await sheetPath("ethuram\u200B", reg)).to === ALGO_ZERO);
  }

  // R3-B (name description): the description's DOM text was the one
  // name store with set-only writers — after remove + import in one
  // session it kept the removed wallet's name until reload. The fix
  // makes renderNameSection its only writer, painting it in BOTH
  // states before the branch, and repaints it on wipe.
  const nsStart = appSrc.indexOf("function renderNameSection()");
  const nsSeg = appSrc.slice(nsStart, appSrc.indexOf("async function adoptRegistryNameIfMine", nsStart));
  const paintAt = nsSeg.indexOf('$("namePreview").textContent = stored ? stored + "." + FLUID_DOMAIN : "you." + FLUID_DOMAIN;');
  ok("R3-B: renderNameSection paints the description from current state in both states",
    paintAt > -1 && paintAt < nsSeg.indexOf('if (!stored)'));
  ok("R3-B: the description has exactly ONE writer left in app.js",
    (appSrc.match(/\$\("namePreview"\)\.textContent =/g) || []).length === 1);
  ok("R3-B: renderMain no longer writes the description set-only",
    !appSrc.includes('if (myName && $("namePreview"))'));
  const wipeAt = appSrc.indexOf('$("wipeGo").onclick');
  const wipeSeg = appSrc.slice(wipeAt, appSrc.indexOf("refreshGate();", wipeAt));
  ok("R3-B: the wipe handler repaints the name section for the no-wallet state",
    wipeSeg.includes("wallet = null;") && wipeSeg.includes("renderNameSection();"));
}

// QA F2 ROUND 4 — the experiment matrix release. Every faithful
// execution of the shipped code (source in node, the extracted
// bundle functions, the full app driven in jsdom on BOTH the round-3
// and round-2 bundles, against the REAL live registry) takes the
// address branch for the canonical zero address with ZERO registry
// fetches; the live tab's (a)/(b) failures are mutually inconsistent
// with its own (c) pass under any deterministic execution of that
// code with identical post-clean strings, localising the divergence
// to the browser session's input/click delivery, not to a shipped
// line. The one code-side surface the evidence still implicates is
// the cleaner's ENUMERATED strip set (round 3): a pasted delivery
// carrying an invisible character outside that enumeration (a
// combining grapheme joiner, a bidi control, a mid-string NBSP from
// a wrapped paste) still fell through to the name path. Round 4
// widens the cleaner to all whitespace + the whole Unicode format
// class — provably behaviour-preserving for legitimate input, since
// no valid address or Fluid name contains either. The pins below
// execute the resolver (the convicted layer) with crafted
// leading-zero Algorand addresses and the exotic-invisible set.
{
  const { resolveChainRecipient, isValidAlgorandAddress, algoAddressFromPubkey, cleanRecipientInput, detectScanFamily } =
    await import("../src/wallet-core.js");
  const ALGO_ZERO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
  const algoOpts = (spy) => ({ isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand", lookupName: spy });
  const throwsMsg = async (fn, want) => { try { await fn(); return false; } catch (e) { return e.message === want; } };

  // E2 set: crafted public keys with increasing leading zero bytes.
  const keyOne = new Uint8Array(32); keyOne[31] = 1;
  const keyHalf = new Uint8Array(32); for (let i = 0; i < 16; i++) keyHalf[16 + i] = i + 1;
  const keySeq = new Uint8Array(32); for (let i = 0; i < 32; i++) keySeq[i] = i + 1;
  const crafted = [
    ["all-zero key (the canonical zero address)", ALGO_ZERO, algoAddressFromPubkey(new Uint8Array(32))],
    ["key = 31 zero bytes + 0x01 (51 leading A's)", null, algoAddressFromPubkey(keyOne)],
    ["key = 16 zero bytes + 16 fixed bytes (26 leading A's)", null, algoAddressFromPubkey(keyHalf)],
    ["key = bytes 1..32 (a normal address)", null, algoAddressFromPubkey(keySeq)],
  ];
  for (const [label, literal, addr] of crafted) {
    if (literal) ok(`R4: crafted ${label} matches the canonical literal`, addr === literal);
    ok(`R4: crafted ${label} is checksum-valid`, isValidAlgorandAddress(addr) === true);
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    const r = await resolveChainRecipient(addr, algoOpts(spy));
    ok(`R4: crafted ${label} — address branch, no lookup`, r.to === addr && r.name === null && lookups === 0);
    ok(`R4: Scan classifies crafted ${label} as an Algorand address`, detectScanFamily(addr)?.family === "algo");
  }

  // The exotic-invisible set: outside round 3's enumeration, inside
  // round 4's widened class. Each must land in the address branch.
  const exotics = [
    ["trailing U+034F (combining grapheme joiner)", ALGO_ZERO + "\u034F"],
    ["trailing U+202E (right-to-left override)", ALGO_ZERO + "\u202E"],
    ["trailing U+180E (Mongolian vowel separator)", ALGO_ZERO + "\u180E"],
    ["mid-string U+00A0 (wrapped-paste NBSP)", ALGO_ZERO.slice(0, 30) + "\u00A0" + ALGO_ZERO.slice(30)],
    ["mid-string space (wrapped paste)", ALGO_ZERO.slice(0, 30) + " " + ALGO_ZERO.slice(30)],
  ];
  for (const [label, s] of exotics) {
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    const r = await resolveChainRecipient(s, algoOpts(spy));
    ok(`R4: zero address + ${label} — cleaned, address branch, no lookup`, r.to === ALGO_ZERO && r.name === null && lookups === 0);
  }

  ok("R4: the cleaner strips the full format class + internal whitespace, and nothing else",
    cleanRecipientInput("a\u2066b\u061Cc\u034Fd") === "abcd"
    && cleanRecipientInput("et huram") === "ethuram"
    && cleanRecipientInput(ALGO_ZERO) === ALGO_ZERO);

  // The fence: look-alike LETTERS are not the cleaner's business.
  // A Cyrillic А (U+0410) keeps the string at 58 chars and visually
  // identical, but it is not base32 — it must hard-block through the
  // name path, never silently resolve.
  {
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    const homoglyph = "\u0410" + ALGO_ZERO.slice(1);
    ok("R4: a Cyrillic-А look-alike still hard-blocks (no silent normalising) — as a malformed address, since it is neither a valid address nor a plausible Fluid name (audit P1-2)",
      await throwsMsg(() => resolveChainRecipient(homoglyph, algoOpts(spy)), "That doesn't look like a valid Algorand address, and it isn't a Fluid name either — check it and try again.") && lookups === 0);
  }
}

// 60. WalletConnect v2 (wallet side): URI validation, namespace
// planning, and the F-01 request decoder — every refusal case pinned.
{
  const throwsWc = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
  const ME = known.address;
  const OTHER = freshUnlocked.address;

  // -- pairing URI --
  const SYM = "a".repeat(64), TOPIC = "b".repeat(64);
  const parsed = parseWcUri(`wc:${TOPIC}@2?relay-protocol=irn&relay-data=eyJ0eXAiOiJKV1QifQ&symKey=${SYM}&methods=wc_sessionPropose,eth_sendTransaction`);
  ok("WC: valid v2 URI parses", !!parsed && parsed.topic === TOPIC && parsed.symKey === SYM && parsed.relayProtocol === "irn" && parsed.methods.includes("eth_sendTransaction"));
  ok("WC: v1 URI refused", parseWcUri(`wc:${TOPIC}@1?bridge=https%3A%2F%2Fexample.com&key=${SYM}`) === null);
  ok("WC: missing symKey refused", parseWcUri(`wc:${TOPIC}@2?relay-protocol=irn`) === null);
  ok("WC: short symKey refused", parseWcUri(`wc:${TOPIC}@2?relay-protocol=irn&symKey=abcd`) === null);
  ok("WC: wrong relay protocol refused", parseWcUri(`wc:${TOPIC}@2?relay-protocol=waku&symKey=${SYM}`) === null);
  ok("WC: garbage refused", parseWcUri("hello") === null && parseWcUri("") === null && parseWcUri(null) === null && parseWcUri(42) === null);
  ok("WC: shipped project id means configured", walletConnectConfigured() === true && /^[0-9a-f]{32}$/.test(WALLETCONNECT_PROJECT_ID));
  ok("WC: relay is the official Reown relay", WALLETCONNECT_RELAY_URL === "wss://relay.walletconnect.com");
  ok("WC: eth_sign is NOT in the inspectable method set", !WC_EIP155_METHODS.includes("eth_sign") && !WC_EIP155_METHODS.includes("eth_signTransaction"));

  // -- session namespaces --
  const prop = (required, optional) => ({ id: 1, params: { proposer: { metadata: { name: "Test dApp", description: "A test", url: "https://dapp.example", icons: ["https://dapp.example/i.png"] } }, requiredNamespaces: required, optionalNamespaces: optional } });
  const basic = prop({ eip155: { chains: ["eip155:1", "eip155:8453"], methods: ["eth_sendTransaction", "personal_sign"], events: ["chainChanged"] } });
  const ns = buildWcNamespaces({ proposal: basic, address: ME });
  ok("WC: namespaces carry exactly the approved chains", ns.eip155.chains.join() === "eip155:1,eip155:8453");
  ok("WC: accounts carry the user address on every approved chain", ns.eip155.accounts.length === 2 && ns.eip155.accounts.includes(`eip155:8453:${ME}`));
  const desc = describeWcProposal(basic);
  ok("WC: proposal description reads metadata + chains", desc.name === "Test dApp" && desc.url === "https://dapp.example" && desc.chains.length === 2 && desc.chains[0].name === "Ethereum" && desc.chains[1].name === "Base" && desc.refusal === null);
  const optBad = prop(
    { eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: [] } },
    { eip155: { chains: ["eip155:999999"], methods: ["eth_sign"], events: [] } });
  const nsOpt = buildWcNamespaces({ proposal: optBad, address: ME });
  ok("WC: unsupported OPTIONAL chain/method trimmed, not fatal", nsOpt.eip155.chains.join() === "eip155:1" && !nsOpt.eip155.methods.includes("eth_sign"));
  ok("WC: required unsupported chain refused", throwsWc(() => buildWcNamespaces({ proposal: prop({ eip155: { chains: ["eip155:999999"], methods: [], events: [] } }), address: ME }), /chain id 999999/));
  ok("WC: required non-EVM family refused", throwsWc(() => buildWcNamespaces({ proposal: prop({ solana: { chains: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"], methods: ["solana_signMessage"], events: [] } }), address: ME }), /solana/));
  ok("WC: describeWcProposal surfaces the same refusal", /solana/.test(describeWcProposal(prop({ solana: { chains: [], methods: [], events: [] } })).refusal || ""));
  ok("WC: required uninspectable method refused (eth_sign)", throwsWc(() => buildWcNamespaces({ proposal: prop({ eip155: { chains: ["eip155:1"], methods: ["eth_sign"], events: [] } }), address: ME }), /eth_sign/));
  ok("WC: chain-specific namespace keys understood", buildWcNamespaces({ proposal: prop({ "eip155:137": { methods: ["personal_sign"], events: [] } }), address: ME }).eip155.chains.join() === "eip155:137");
  ok("WC: invalid own address refused", throwsWc(() => buildWcNamespaces({ proposal: basic, address: "0x123" }), /valid EVM address/));
  ok("WC: plan defaults fill a bare connect (no chains/methods named)", (() => { const p = planWcNamespaces(prop({ eip155: { chains: [], methods: [], events: [] } })); return p.chains.length === wcSupportedChainIds().length && p.methods.includes("personal_sign"); })());

  // -- personal_sign --
  const helloHex = ethers.hexlify(ethers.toUtf8Bytes("Hello Fluid"));
  const ps = decodeWcRequest({ method: "personal_sign", params: [helloHex, ME], chainId: "eip155:1", ownAddress: ME });
  ok("WC: personal_sign hex decodes to the readable message", ps.ok && ps.kind === "personal_sign" && ps.rows[0].value === "Hello Fluid" && ps.sign.hex === helloHex);
  const sigMsg = await signWcMessage(unlocked, ps.sign);
  ok("WC: personal_sign signature verifies against the wallet address", ethers.verifyMessage(ethers.getBytes(helloHex), sigMsg) === ME);
  const ps2 = decodeWcRequest({ method: "personal_sign", params: ["Sign in to Example", ME], chainId: 1, ownAddress: ME });
  ok("WC: personal_sign plain text ok", ps2.ok && ps2.sign.text === "Sign in to Example" && ps2.sign.hex === null);
  const ps3 = decodeWcRequest({ method: "personal_sign", params: [ME, "legacy order"], chainId: 1, ownAddress: ME });
  ok("WC: personal_sign legacy [address, message] order handled", ps3.ok && ps3.sign.text === "legacy order");
  ok("WC: personal_sign non-text bytes refused", !decodeWcRequest({ method: "personal_sign", params: ["0xdeadbeef00112233", ME], chainId: 1, ownAddress: ME }).ok);
  ok("WC: personal_sign control characters refused", !decodeWcRequest({ method: "personal_sign", params: ["hi\u0001there", ME], chainId: 1, ownAddress: ME }).ok);
  ok("WC: personal_sign for another account refused", !decodeWcRequest({ method: "personal_sign", params: ["hi", OTHER], chainId: 1, ownAddress: ME }).ok);
  ok("WC: personal_sign empty refused", !decodeWcRequest({ method: "personal_sign", params: ["0x", ME], chainId: 1, ownAddress: ME }).ok);

  // -- typed data --
  const typed = {
    domain: { name: "Ether Mail", version: "1", chainId: 1, verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" },
    types: { Mail: [{ name: "from", type: "address" }, { name: "contents", type: "string" }] },
    primaryType: "Mail",
    message: { from: ME, contents: "Hello, Bob!" },
  };
  const td = decodeWcRequest({ method: "eth_signTypedData_v4", params: [ME, JSON.stringify(typed)], chainId: "eip155:1", ownAddress: ME });
  ok("WC: typed data decodes with every field visible", td.ok && td.kind === "typed_data" && td.rows.some(r => r.label === "contents" && r.value === "Hello, Bob!") && td.rows.some(r => r.label === "Domain name" && r.value === "Ether Mail"));
  ok("WC: typed data sign payload drops EIP712Domain", td.sign && !("EIP712Domain" in td.sign.types));
  const sigCore = await signWcTypedData(unlocked, td.sign);
  const sigDirect = await unlocked.signTypedData(typed.domain, typed.types, typed.message);
  ok("WC: typed data signature matches ethers direct signing", sigCore === sigDirect);
  ok("WC: typed data domain/chain mismatch refused", !decodeWcRequest({ method: "eth_signTypedData_v4", params: [ME, JSON.stringify({ ...typed, domain: { ...typed.domain, chainId: 56 } })], chainId: 1, ownAddress: ME }).ok);
  ok("WC: typed data bad JSON refused", !decodeWcRequest({ method: "eth_signTypedData_v4", params: [ME, "{nope"], chainId: 1, ownAddress: ME }).ok);
  ok("WC: typed data unknown primary type refused", !decodeWcRequest({ method: "eth_signTypedData_v4", params: [ME, JSON.stringify({ types: {}, primaryType: "Nope", domain: {}, message: {} })], chainId: 1, ownAddress: ME }).ok);
  ok("WC: typed data for another account refused", !decodeWcRequest({ method: "eth_signTypedData_v4", params: [OTHER, JSON.stringify(typed)], chainId: 1, ownAddress: ME }).ok);
  const permit = {
    domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    types: { Permit: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "Permit",
    message: { owner: ME, spender: OTHER, value: "1000000", nonce: "0", deadline: "9999999999" },
  };
  const pd = decodeWcRequest({ method: "eth_signTypedData_v4", params: [ME, JSON.stringify(permit)], chainId: 8453, ownAddress: ME });
  ok("WC: Permit typed data carries the permit warning", pd.ok && /PERMIT/.test(pd.warning || ""));

  // -- eth_sendTransaction --
  const txPlain = decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: OTHER, value: "0xde0b6b3a7640000" }], chainId: "eip155:8453", ownAddress: ME });
  ok("WC: plain transfer decodes to a send sentence", txPlain.ok && txPlain.kind === "transaction" && txPlain.networkKey === "base" && /Send 1\.0 ETH/.test(txPlain.intent) && txPlain.sign.tx.to === OTHER && txPlain.sign.tx.value === "0xde0b6b3a7640000");
  const erc20Abi = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)", "function approve(address spender, uint256 amount) returns (bool)", "function transferFrom(address from, address to, uint256 amount) returns (bool)"]);
  const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const txTok = decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: USDC_BASE, value: "0x0", data: erc20Abi.encodeFunctionData("transfer", [OTHER, 25000000n]) }], chainId: 8453, ownAddress: ME });
  ok("WC: ERC20 transfer decodes with the known token's amount", txTok.ok && /25\.0 USDC/.test(txTok.intent) && txTok.rows.some(r => r.label === "To" && r.value === OTHER));
  const txAppr = decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: USDC_BASE, data: erc20Abi.encodeFunctionData("approve", [OTHER, ethers.MaxUint256]) }], chainId: 8453, ownAddress: ME });
  ok("WC: unlimited approve decoded + warned", txAppr.ok && txAppr.rows.some(r => r.label === "Allowance" && r.value === "UNLIMITED") && /UNLIMITED/.test(txAppr.warning || ""));
  const txTf = decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: USDC_BASE, data: erc20Abi.encodeFunctionData("transferFrom", [ME, OTHER, 5000000n]) }], chainId: 8453, ownAddress: ME });
  ok("WC: transferFrom decodes with its warning", txTf.ok && !!txTf.warning && /5\.0 USDC/.test(txTf.intent));
  ok("WC: unknown contract selector refused (no blind signing)", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: OTHER, data: "0x12345678" + "00".repeat(32) }], chainId: 1, ownAddress: ME }).ok);
  ok("WC: contract creation refused", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, value: "0x0", data: "0x6000" }], chainId: 1, ownAddress: ME }).ok);
  ok("WC: unsupported chain refused", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: OTHER, value: "0x1" }], chainId: 999999, ownAddress: ME }).ok);
  ok("WC: tx chainId mismatch refused", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: OTHER, value: "0x1", chainId: "0x38" }], chainId: 1, ownAddress: ME }).ok);
  ok("WC: tx from another account refused", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: OTHER, to: ME, value: "0x1" }], chainId: 1, ownAddress: ME }).ok);
  ok("WC: token call carrying native value refused", !decodeWcRequest({ method: "eth_sendTransaction", params: [{ from: ME, to: USDC_BASE, value: "0x1", data: erc20Abi.encodeFunctionData("transfer", [OTHER, 1n]) }], chainId: 8453, ownAddress: ME }).ok);

  // -- refusals for everything else --
  ok("WC: eth_sign refused as an unreadable hash", /unreadable hash/.test(decodeWcRequest({ method: "eth_sign", params: [ME, "0xabc"], chainId: 1, ownAddress: ME }).reason || ""));
  ok("WC: eth_signTransaction refused", !decodeWcRequest({ method: "eth_signTransaction", params: [{}], chainId: 1, ownAddress: ME }).ok);
  ok("WC: unknown method refused by name", /wallet_sendCalls/.test(decodeWcRequest({ method: "wallet_sendCalls", params: [], chainId: 1, ownAddress: ME }).reason || ""));
  const acc = decodeWcRequest({ method: "eth_accounts", params: [], chainId: "eip155:1", ownAddress: ME });
  ok("WC: eth_accounts is a read-only auto answer", acc.ok && acc.auto === true && acc.sign === null);
  const cid = decodeWcRequest({ method: "eth_chainId", params: [], chainId: "eip155:137", ownAddress: ME });
  ok("WC: eth_chainId is a read-only auto answer", cid.ok && cid.auto === true && cid.chainId === 137);

  // -- sessions list summary --
  const sum = wcSessionSummary({ topic: "topic123", expiry: 1899999999, peer: { metadata: { name: "D", url: "https://d.example", icons: [] } }, namespaces: { eip155: { accounts: [`eip155:1:${ME}`, `eip155:8453:${ME}`], chains: ["eip155:1"], methods: [], events: [] } } });
  ok("WC: session summary extracts identity + chains", sum.topic === "topic123" && sum.chainIds.join() === "1,8453" && sum.name === "D");
  ok("WC: evmNetworkKeyForChainId resolves + refuses", evmNetworkKeyForChainId(8453) === "base" && evmNetworkKeyForChainId(1) === "ethereum" && evmNetworkKeyForChainId(999999) === null);
}

// 61. EVM silent-zero fix (domain-flip walk, 2026-11-08): when the
// curated EVM balance load fails (bsc-rpc.publicnode.com 429s), the
// BNB Chain family used to show a plain $0.00 — the honest "Could
// not load balances" message was written and then erased by the very
// next paintAssets() call, and the send sheet's empty token dropdown
// answered "Enter an amount." getBalances now retries once against
// the network's live-verified fallback RPC before failing, and the
// app carries an evmLoadFailed flag that renders "couldn't load"
// rows + an alert instead of a zero. Fetch is stubbed with a
// JSON-RPC fixture (1 BNB native, 2 USDC, 3 USDT on BSC).
{
  ok("evm fallback: bsc and base carry a verified fallback RPC",
    NETWORKS.bsc.rpcFallback === "https://bsc-dataseed.binance.org/"
    && NETWORKS.base.rpcFallback === "https://mainnet.base.org");
  ok("evm fallback: providerForFallback builds for bsc/base, null without one",
    !!providerForFallback("bsc") && !!providerForFallback("base")
    && providerForFallback("ethereum") === null);
  // NOTE: ethers v6 on Node does NOT use globalThis.fetch — its
  // JsonRpcProvider goes through FetchRequest's getUrl (Node http/https).
  // Stubbing global fetch therefore cannot intercept it (a debug run
  // proved it: the stub was never called and real chain data came
  // back). The tests below stub at ethers' own seam instead:
  // FetchRequest.registerGetUrl, restored to the default afterwards.
  const wallet = { address: "0x0000000000000000000000000000000000000001" };
  const defaultGetUrl = FetchRequest.createGetUrlFunc();
  let calls = [];
  const rpcGetUrl = (deadPrimary) => async (req) => {
    const url = req.url;
    calls.push(url);
    if (deadPrimary && url.includes("bsc-rpc.publicnode.com")) throw new Error("429 Too Many Requests");
    // ethers batches concurrent calls into one JSON array body.
    const parsed = JSON.parse(new TextDecoder().decode(req.body || new Uint8Array()));
    const answer = (reqObj) => {
      let result;
      if (reqObj.method === "eth_chainId") result = "0x38";
      else if (reqObj.method === "net_version") result = "56";
      else if (reqObj.method === "eth_getBalance") result = "0xde0b6b3a7640000";
      else if (reqObj.method === "eth_call") {
        const to = (reqObj.params?.[0]?.to || "").toLowerCase();
        const usdc = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
        // balanceOf returns a uint256: ABI-encoded, 32 bytes.
        result = to === usdc ? "0x0000000000000000000000000000000000000000000000001bc16d674ec80000"
          : "0x00000000000000000000000000000000000000000000000029a2241af62c0000";
      } else throw new Error("unexpected rpc method " + reqObj.method);
      return { jsonrpc: "2.0", id: reqObj.id, result };
    };
    const payload = Array.isArray(parsed) ? parsed.map(answer) : answer(parsed);
    return new FetchResponse(200, "OK", { "content-type": "application/json" },
      new TextEncoder().encode(JSON.stringify(payload)));
  };
  try {
    // Primary healthy: fallback never touched.
    calls = [];
    FetchRequest.registerGetUrl(rpcGetUrl(false));
    let rows = await getBalances(wallet, "bsc");
    ok("evm balances: healthy primary reads native + tokens",
      rows.length === 3 && rows[0].symbol === "BNB" && rows[0].amount === "1.0"
      && rows[1].symbol === "USDC" && rows[1].amount === "2.0"
      && rows[2].symbol === "USDT" && rows[2].amount === "3.0");
    ok("evm balances: healthy primary never calls the fallback",
      calls.every(u => u.includes("bsc-rpc.publicnode.com")));
    // Primary 429s (transport rejects, the way a rate limit surfaces):
    // the fallback is tried and its values win.
    calls = [];
    FetchRequest.registerGetUrl(rpcGetUrl(true));
    rows = await getBalances(wallet, "bsc");
    ok("evm balances: dead primary falls back to the dataseed",
      rows.length === 3 && rows[0].amount === "1.0" && rows[1].amount === "2.0");
    ok("evm balances: fallback was attempted after the primary failed",
      calls.some(u => u.includes("bsc-rpc.publicnode.com")) && calls.some(u => u.includes("bsc-dataseed.binance.org")));
    // Both dead: the read rejects — the app shows "couldn't load".
    FetchRequest.registerGetUrl(async () => { throw new Error("Failed to fetch"); });
    await assert.rejects(() => getBalances(wallet, "bsc"));
    ok("evm balances: total failure throws instead of returning a fake zero", true);
    // No fallback on the network: a dead primary throws straight away.
    let ethCalls = 0;
    FetchRequest.registerGetUrl(async () => { ethCalls++; throw new Error("Failed to fetch"); });
    await assert.rejects(() => getBalances(wallet, "ethereum"));
    ok("evm balances: a network without a fallback throws on primary failure", ethCalls > 0);
  } finally {
    FetchRequest.registerGetUrl(defaultGetUrl);
  }

  // app.js: the failure state is honest end-to-end (source pins — the
  // suite reads app.js as text, as it does for the other screens).
  const appSrcEvm = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("evm load-failed: flag is declared and set in the renderMain catch",
    appSrcEvm.includes("let evmLoadFailed = false")
    && appSrcEvm.includes("evmLoadFailed = true; balances = [];"));
  ok("evm load-failed: the old clobbering message write is gone",
    !appSrcEvm.includes("Could not load balances (network busy"));
  ok("evm load-failed: family alert names the active network",
    appSrcEvm.includes("if (evmLoadFailed) m.evm = `${NETWORKS[networkKey].name} balances couldn't be loaded right now.`;"));
  ok("evm load-failed: failed rows render as couldn't-load, total as —",
    appSrcEvm.includes("? [{ symbol: net.symbol, amount: null, address: null, verified: true },")
    && appSrcEvm.includes("m.evm = evmLoadFailed ? null : sumRows(")
    && appSrcEvm.includes('totalVal == null ? "—" : usd(totalVal || 0)'));
  ok("evm load-failed: hydrate never merges rows over a failed load",
    appSrcEvm.includes("if (evmLoadFailed) return;\n  const myKey = networkKey, chainId = NETWORKS[networkKey].chainId;"));
  ok("evm load-failed: send sheet says the load failed, not \"Enter an amount.\"",
    appSrcEvm.includes("Balances couldn't load right now — tap More → Refresh and try again.")
    && appSrcEvm.includes("if (evmLoadFailed) return msg(\"sMsg\", warnPrefix + resolvedNote + \"Balances couldn't load right now"));
  ok("evm load-failed: refresh reports the load outcome, prices can't stall the render",
    appSrcEvm.includes("toast((evmLoadFailed || btcLoadFailed) ? \"Balances couldn't load — check your connection and try again\" : \"Balances refreshed\")")
    && appSrcEvm.includes('setTimeout(() => reject(new Error("prices timed out")), 20000)'));
}

// 62. Bitcoin silent-zero fix (EVM re-walk, 2026-11-08): the same
// defect class as the EVM bug — getBitcoinBalance was mempool.space
// only, and during the walk both mempool reads timed out while the
// Bitcoin row showed an undisclosed 0. The balance now falls back
// to Blockstream's Esplora (identical address JSON shape), and the
// app carries per-account btcSegwitFailed/btcTaprootFailed flags
// with a derived btcLoadFailed that renders "couldn't load" rows +
// an alert instead of a zero. Fetch is stubbed with per-source
// fixtures, as in section 32b.
{
  const { getBitcoinBalance } = await import("../src/wallet-core.js");
  const BTC_ADDR = "bc1qkkgpmu9s9v5xece7rm5wgsmykc0qc25wf039xr";
  const esplora = (funded, spent) => ({ chain_stats: { funded_txo_sum: funded, spent_txo_sum: spent }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 } });
  const realFetch = globalThis.fetch;
  const jsonRes = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  try {
    // mempool.space answers: its own shape wins, no fallback call.
    globalThis.fetch = async (url) => {
      if (String(url).includes("mempool.space")) return jsonRes(esplora(155210668, 210668));
      throw new Error("fallback must not be called");
    };
    ok("btc balance: mempool funded-minus-spent parses", (await getBitcoinBalance(BTC_ADDR)) === 1.55);
    // mempool dies the way a timeout kills it (fetch rejects outright):
    // Blockstream's identical shape takes over.
    globalThis.fetch = async (url) => {
      if (String(url).includes("mempool.space")) throw new TypeError("Failed to fetch");
      if (String(url).includes("blockstream.info")) return jsonRes(esplora(155210668, 210668));
      throw new Error("unexpected url " + url);
    };
    ok("btc balance: dead mempool falls back to Blockstream", (await getBitcoinBalance(BTC_ADDR)) === 1.55);
    // mempool answers non-OK (a 429/500): the fallback is tried.
    globalThis.fetch = async (url) => {
      if (String(url).includes("mempool.space")) return jsonRes({}, false, 429);
      if (String(url).includes("blockstream.info")) return jsonRes(esplora(200000000, 0));
      throw new Error("unexpected url " + url);
    };
    ok("btc balance: non-OK mempool falls back to Blockstream", (await getBitcoinBalance(BTC_ADDR)) === 2);
    // Both dead: the read rejects — the app shows "couldn't load".
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(() => getBitcoinBalance(BTC_ADDR));
    ok("btc balance: total failure throws instead of returning a fake zero", true);
    // A garbled Blockstream body (a proxy block page with no
    // chain_stats) is a failed source, not a number.
    globalThis.fetch = async (url) => {
      if (String(url).includes("mempool.space")) throw new TypeError("Failed to fetch");
      if (String(url).includes("blockstream.info")) return jsonRes({ error: "endpoint does not exist" });
      throw new Error("unexpected url " + url);
    };
    await assert.rejects(() => getBitcoinBalance(BTC_ADDR));
    ok("btc balance: garbled fallback body throws instead of becoming a number", true);
  } finally {
    globalThis.fetch = realFetch;
  }

  // app.js: the failure state is honest end-to-end (source pins).
  const appSrcBtc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("btc load-failed: per-account flags and derived family flag declared",
    appSrcBtc.includes("let btcSegwitFailed = false, btcTaprootFailed = false, btcLoadFailed = false;")
    && appSrcBtc.includes("function syncBtcLoadFailed() { btcLoadFailed = btcSegwitFailed || btcTaprootFailed; }"));
  ok("btc load-failed: load callbacks set/clear the per-account flags",
    appSrcBtc.includes("btcSegwitFailed = false; syncBtcLoadFailed();")
    && appSrcBtc.includes("btcSegwitFailed = true; syncBtcLoadFailed();")
    && appSrcBtc.includes("btcTaprootFailed = false; syncBtcLoadFailed();")
    && appSrcBtc.includes("btcTaprootFailed = true; syncBtcLoadFailed();"));
  ok("btc load-failed: family alert names Bitcoin",
    appSrcBtc.includes('if (btcLoadFailed) m.bitcoin = "Bitcoin balances couldn\'t be loaded right now.";'));
  ok("btc load-failed: row renders couldn't-load, total is null, hero total excludes BTC",
    appSrcBtc.includes("scalarAmtHtml(btcLoadFailed, btcBal + btcTrBal, prices.BTC)")
    && appSrcBtc.includes("m.bitcoin = btcLoadFailed ? null : (btcBal + btcTrBal) * (prices.BTC || 0);")
    && appSrcBtc.includes("let t = (btcLoadFailed ? 0 : btcBal + btcTrBal) * (prices.BTC || 0)"));
  ok("btc load-failed: home-zero card stays hidden while Bitcoin is unknown",
    appSrcBtc.includes("!evmLoadFailed && !btcLoadFailed && !anyBal"));
  ok("btc load-failed: sheet header shows couldn't-load per account",
    appSrcBtc.includes('btcLoadFailed ? "Balance couldn\'t load"')
    && appSrcBtc.includes('btcSegwitFailed ? "couldn\'t load"')
    && appSrcBtc.includes('btcTaprootFailed ? "couldn\'t load"'));
  ok("btc load-failed: Review gates on the selected account's flag",
    appSrcBtc.includes("const sendKind = $(\"bFrom\").value;")
    && appSrcBtc.includes('if (sendKind === "taproot" ? btcTaprootFailed : btcSegwitFailed)'));
  ok("btc load-failed: scalar sheets gate Review on their load flags",
    appSrcBtc.includes('if (ltcLoadFailed) return msg("lMsg", "Balance couldn\'t load right now')
    && appSrcBtc.includes('if (bchLoadFailed) return msg("cMsg", "Balance couldn\'t load right now')
    && appSrcBtc.includes('if (dogeLoadFailed) return msg("gMsg", "Balance couldn\'t load right now'));
  ok("btc load-failed: refresh toast reflects a Bitcoin failure",
    appSrcBtc.includes('toast((evmLoadFailed || btcLoadFailed) ? "Balances couldn\'t load'));
}

// 63. Home asset-list ordering (owner request, 2026-11-08): opening
// the wallet used to bury what you HOLD under zero-balance families
// in a fixed chain order. Family cards now sort held-value first
// (USD total descending), then load-failed families (unknown is not
// zero), then all-zero families in their given order; rows within a
// family sort positives (USD descending) → couldn't-load (amount
// null) → true zeros in their given order. Pure helpers in core,
// presentation only — the fixtures below pin the rules end to end.
{
  const fam = (key, totalUsd, failed = false) => ({ key, totalUsd, failed });
  // paintAssets builds the groups in this fixed order today.
  const FIXED = ["bitcoin", "evm", "tron", "solana", "sui", "stellar", "ton", "near",
    "algorand", "xrpl", "polkadot", "aptos", "stacks", "cosmos", "litecoin", "dogecoin", "bitcoincash"];
  const keys = (arr) => arr.map(e => e.key);

  // A held asset on a late family surfaces above every zero family,
  // and the zero families keep their relative order behind it.
  const suiHeld = FIXED.map(k => fam(k, k === "sui" ? 42.5 : 0));
  ok("home order: a held Sui balance renders the Sui family first",
    keys(sortHomeFamilies(suiHeld)).join() === ["sui", ...FIXED.filter(k => k !== "sui")].join());
  const btcHeld = FIXED.map(k => fam(k, k === "bitcoin" ? 7 : 0));
  ok("home order: a held Bitcoin balance stays on top",
    keys(sortHomeFamilies(btcHeld)).join() === FIXED.join());

  // Valued families sort by USD total descending; ties keep the
  // order they were given.
  const valued = [fam("bitcoin", 10), fam("evm", 300), fam("sui", 10), fam("tron", 0)];
  ok("home order: valued families sort by total descending, ties stable",
    keys(sortHomeFamilies(valued)).join() === "evm,bitcoin,sui,tron");

  // A failed family sits between valued and zero families — both
  // failure shapes (null total, and flag-set with a $0 total, the
  // scalar-coin pattern), plus a bare null total (unknown).
  const mixed = [fam("evm", null, true), fam("bitcoin", 12), fam("sui", 0),
    fam("litecoin", 0, true), fam("tron", 0), fam("stellar", null)];
  ok("home order: failed families sit between valued and zero families",
    keys(sortHomeFamilies(mixed)).join() === "bitcoin,evm,litecoin,stellar,sui,tron");

  // The all-zero fresh wallet renders in exactly today's order.
  const freshWallet = FIXED.map(k => fam(k, 0));
  ok("home order: an all-zero wallet's family order is unchanged",
    keys(sortHomeFamilies(freshWallet)).join() === FIXED.join());
  ok("home order: sorting does not mutate the input array",
    keys(freshWallet).join() === FIXED.join() && sortHomeFamilies(freshWallet) !== freshWallet);

  // Within a family: positives by USD value descending, then
  // couldn't-load rows, then true zeros — each later tier in its
  // given order. Rows use splitRows' { b, v } shape, as the app does.
  const row = (id, amount, v) => ({ id, b: { amount }, v });
  const rowsIn = [row("zero1", 0, 0), row("heldSmall", 2, 10), row("failed1", null, 0),
    row("zero2", "0", 0), row("heldBig", 5, 30), row("failed2", null, null), row("heldUnpriced", 1, null)];
  const rowsOut = sortHomeRows(rowsIn, (x) => x.b.amount, (x) => x.v).map(x => x.id);
  ok("home rows: held token precedes zero tokens, couldn't-load rows between",
    rowsOut.join() === "heldBig,heldSmall,heldUnpriced,failed1,failed2,zero1,zero2");
  const zeroRows = [row("a", 0, 0), row("b", 0, 0), row("c", 0, 0)];
  ok("home rows: an all-zero family's row order is unchanged",
    sortHomeRows(zeroRows, (x) => x.b.amount, (x) => x.v).map(x => x.id).join() === "a,b,c");

  // --- 2026-11-09 load/order fix: HELD is a raw-balance fact ---
  // The owner's case end to end: he holds ALGO (raw amount > 0) while
  // its USD total computes to 0 — the price feed missed it — and the
  // zero BNB/EVM family must NOT sit above it. Under the old
  // totalUsd-only tier this rendered evm,bitcoin,...,algorand.
  const famH = (key, totalUsd, failed = false, held = false) => ({ key, totalUsd, failed, held });
  const ownerCase = FIXED.map(k => famH(k, 0, false, k === "algorand"));
  ok("home order: a raw-held but unpriced ALGO family beats the zero BNB/EVM family",
    keys(sortHomeFamilies(ownerCase)).join() === ["algorand", ...FIXED.filter(k => k !== "algorand")].join());
  // Prices entirely missing (the price-gate timeout shape): every
  // total is 0, held still wins on the raw fact alone.
  const noPrices = [famH("evm", 0, false, false), famH("algorand", 0, false, true), famH("bitcoin", 0)];
  ok("home order: with no prices at all, the held family still leads",
    keys(sortHomeFamilies(noPrices)).join() === "algorand,evm,bitcoin");
  // Within the held tier USD still orders: priced holdings first
  // (descending), unpriced holdings after, in given order.
  const heldMix = [famH("algorand", 0, false, true), famH("sui", 25, false, true), famH("tron", 0, false, true), famH("evm", 100, false, true), famH("bitcoin", 0)];
  ok("home order: within held, USD desc; unpriced held keep given order after priced",
    keys(sortHomeFamilies(heldMix)).join() === "evm,sui,algorand,tron,bitcoin");
  // A family that is BOTH held and flagged failed (partial read with
  // real rows landed) is held — its value outranks the unknown tier.
  const heldFailed = [famH("evm", null, true, false), famH("solana", 0, true, true), famH("bitcoin", 0)];
  ok("home order: held+failed ranks as held, above unknown and zero",
    keys(sortHomeFamilies(heldFailed)).join() === "solana,evm,bitcoin");
  // Backward compatibility: entries without `held` behave exactly
  // as before (the pre-fix fixtures above all rely on this).

  // app.js wiring (source pins, as in sections 61/62).
  const appSrcHome = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("home order: paintAssets passes the raw-balance held map into the cards",
    appSrcHome.includes("held: !!heldMap[g.key]") && appSrcHome.includes("held: heldMap.cosmos")
    && appSrcHome.includes("bitcoin: (Number(btcBal) + Number(btcTrBal)) > 0,"));
  ok("load speed: renderMain no longer awaits prices before balance loads",
    !appSrcHome.includes("prices = await Promise.race(")
    && appSrcHome.includes("Prices NO LONGER GATE the render"));
  ok("load speed: the balance cache is wired (hydrate in renderMain, persist in paintAssets)",
    appSrcHome.includes("hydrateBalanceCache(w);") && appSrcHome.includes("persistBalanceCache();")
    && appSrcHome.includes("BALANCE_CACHE_KEY, packBalanceCache, unpackBalanceCache,"));
  ok("load speed: the hero marks a cache paint as updating until every family is live",
    appSrcHome.includes("cachePaint && !HOME_FAMILIES.every((k) => liveFams.has(k))"));
  ok("home order: paintAssets renders the All view through sortHomeFamilies",
    appSrcHome.includes("html = sortHomeFamilies(cards).map(c => c.html).join(\"\");")
    && appSrcHome.includes("sortHomeFamilies, sortHomeRows,"));
  ok("home order: family failure is read from the load-failed flags",
    appSrcHome.includes("bitcoin: btcLoadFailed, evm: evmLoadFailed, litecoin: ltcLoadFailed,")
    && appSrcHome.includes("cosmos: famLoaded.has(\"cosmos\") && cosmosRows.some(r => r.amount == null) && !cosmosRows.some(r => Number(r.amount) > 0),"));
  const coreSrcHome = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("home order: splitRows main list runs through sortHomeRows, old value-only sort gone",
    coreSrcHome.includes("return { main: sortHomeRows(main, (x) => x.b.amount, (x) => x.v), other };")
    && appSrcHome.includes("return splitHomeRows(rows, (b) => rowUsdValue(b, symPriceOf(b)), isNative);")
    && !appSrcHome.includes("main.sort((x, y) => y.v - x.v);"));
  ok("home order: Cosmos rows sort inside their shared card",
    appSrcHome.includes("const inner = sortHomeRows(cosmosBuf, (x) => x.amount, (x) => x.valueUsd).map(x => x.html).join(\"\");"));
  ok("home order: a null amount is never classified as a zero balance",
    appSrcHome.includes("if (b.amount != null && Number(b.amount) === 0 && !isNativeRow(famKey, b)"));
  ok("home order: ordering helpers are used by the home list only (send sheets untouched)",
    (appSrcHome.match(/sortHomeFamilies\(/g) || []).length === 1
    && (appSrcHome.match(/sortHomeRows\(/g) || []).length === 1
    && (appSrcHome.match(/splitHomeRows\(/g) || []).length === 1);
}

// 63b. Balance cache pack/unpack (2026-11-09 load fix): the cache is
// a paint-early layer of PUBLIC data only — round-trip fidelity,
// foreign-wallet rejection, malformed-input rejection, and the
// fixed field list (nothing beyond balance rows/scalars/prices can
// be smuggled into storage through the packer).
{
  const { packBalanceCache, unpackBalanceCache, BALANCE_CACHE_KEY } = await import("../src/wallet-core.js");
  const ADDR = "0xb6714bf82EC9a1b27623FF0386e24307a8A185E1";
  const snap = {
    evmNetwork: "bsc",
    evmRows: [{ symbol: "BNB", amount: "0.000012166494395051", address: null }],
    rows: { algorand: [{ symbol: "ALGO", amount: "12.5", address: null, decimals: 6 }], solana: [{ symbol: "SOL", amount: "0" }] },
    cosmosRows: [{ key: "atom", symbol: "ATOM", amount: "0" }],
    scalars: { btcBal: 0, btcTrBal: 0, ltcBal: 0.25 },
    prices: { ALGO: 0.16, BNB: 690 },
    seedPhrase: "must never be packed",
    keystore: "must never be packed",
  };
  const packed = packBalanceCache(ADDR, snap, 1700000000000);
  ok("balance cache: pack produces a string under a fluid_* key (full-wipe covers it)",
    typeof packed === "string" && BALANCE_CACHE_KEY.startsWith("fluid_"));
  const back = unpackBalanceCache(packed, ADDR);
  ok("balance cache: round-trip preserves rows, scalars, evm slice and prices",
    !!back && back.fams.algorand[0].amount === "12.5" && back.fams.cosmos[0].symbol === "ATOM"
    && back.evm.network === "bsc" && back.evm.rows[0].symbol === "BNB"
    && back.scalars.ltcBal === 0.25 && back.prices.ALGO === 0.16 && back.t === 1700000000000);
  ok("balance cache: secret-shaped fields are dropped by the fixed field list",
    !!back && !("seedPhrase" in back) && !("keystore" in back) && !JSON.stringify(back).includes("must never"));
  ok("balance cache: a different wallet's cache is rejected",
    unpackBalanceCache(packed, "0x0000000000000000000000000000000000000001") === null);
  ok("balance cache: malformed and foreign payloads are rejected",
    unpackBalanceCache("not json", ADDR) === null
    && unpackBalanceCache(JSON.stringify({ v: 2, address: ADDR, fams: {} }), ADDR) === null
    && unpackBalanceCache(JSON.stringify({ v: 1, address: ADDR, fams: { solana: "nope" } }), ADDR) === null
    && unpackBalanceCache(null, ADDR) === null && unpackBalanceCache(packed, null) === null);
  ok("balance cache: an empty snapshot packs to null",
    packBalanceCache(ADDR, { rows: {}, scalars: {} }) === null && packBalanceCache(null, snap) === null);
}

// 64. Relay as PRIMARY swap router (router verdict, 2026-11-08):
// live quotes showed Relay cheapest on Fluid's core lanes and its App
// Fees carry Fluid's exact 0.5% with no second percentage layer, so
// getSwapRoutes quotes Relay first and keeps LI.FI for the pairs
// Relay can't serve (above all Sui) and as the fallback when Relay
// quoting fails. The quote fixture below is a REAL Relay /quote/v2
// response (Base USDC → Arbitrum USDC, $5, App Fees requested),
// captured live 2026-11-08 — the same shape parseRelayQuote consumes
// in production.
{
  const RELAY_QUOTE = {
    requestId: "0x1794173710e8c7672b9eb248b8d49ec5122942c084b83c899211416bb41ffd93",
    steps: [
      { id: "approve", kind: "transaction", items: [{ status: "incomplete", data: { from: "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x095ea7b30000000000000000000000004cd00e387622c35bddb9b4c962c136462338bc3100000000000000000000000000000000000000000000000000000000004c4b40", value: "0", chainId: 8453, gas: "73112", maxFeePerGas: "6500000", maxPriorityFeePerGas: "1000000" } }] },
      { id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34", to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0xe80179520000000000000000000000009780504dee2cdcd003484816a3731eb48be8ee34000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000004c4b40eec44d2440310e29e71d76ffbd114ab3ee3e5bd7427703a17ac10abcac44395d", value: "0", chainId: 8453, gas: "76194", maxFeePerGas: "6500000", maxPriorityFeePerGas: "1000000" } }] },
    ],
    fees: {
      gas: { currency: { chainId: 8453, address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 }, amount: "496052710134", amountFormatted: "0.000000496052710134", amountUsd: "0.001102", minimumAmount: "496052710134" },
      app: { currency: { chainId: 8453, address: "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913", symbol: "USDC", decimals: 6 }, amount: "25000", amountFormatted: "0.025", amountUsd: "0.024994", minimumAmount: "25000" },
    },
    details: {
      operation: "swap",
      sender: "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34",
      recipient: "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34",
      currencyIn: { currency: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 }, amount: "5000000", amountFormatted: "5.0", amountUsd: "4.998895", minimumAmount: "5000000" },
      currencyOut: { currency: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 }, amount: "4950786", amountFormatted: "4.950786", amountUsd: "4.949722", minimumAmount: "4851771" },
      timeEstimate: 1,
      expandedPriceImpact: { swap: { usd: "-0.000470" }, execution: { usd: "-0.023709" }, relay: { usd: "0" }, app: { usd: "-0.024994" }, sponsored: { usd: "0" } },
      totalImpact: { usd: "-0.049173", percent: "-0.98" },
    },
  };
  const RUSER = "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34";
  const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

  // Chain mapping: Relay ids for the families it covers; Sui never.
  ok("relay: chain ids for evm/solana/tron, none for sui",
    relayChainOf("base").chainId === 8453 && relayChainOf("bsc").chainId === 56
    && relayChainOf("solana").chainId === RELAY_SOLANA_CHAIN_ID && RELAY_SOLANA_CHAIN_ID === 792703809
    && relayChainOf("tron").chainId === RELAY_TRON_CHAIN_ID && RELAY_TRON_CHAIN_ID === 728126428
    && relayChainOf("sui") === null && relayChainOf("fuse") === null && relayChainOf("b2") === null && relayChainOf("sepolia") === null);
  // Router selection: Relay serves EVM-sourced pairs to any chain it
  // covers (destinations don't sign); Sui pairs and non-EVM sources
  // stay on LI.FI, whose step payloads Fluid has audited.
  ok("relay: selection — relay-supported pairs go to relay",
    relaySupportsPair("base", "arbitrum") === true && relaySupportsPair("base", "base") === true
    && relaySupportsPair("base", "solana") === true && relaySupportsPair("bsc", "tron") === true);
  ok("relay: selection — sui pairs and non-evm sources stay on lifi",
    relaySupportsPair("base", "sui") === false && relaySupportsPair("sui", "base") === false
    && relaySupportsPair("solana", "base") === false && relaySupportsPair("tron", "base") === false
    && relaySupportsPair("fuse", "base") === false);

  // Request construction: App Fees carry Fluid's exact 0.5% (50 bps)
  // to the DripBot EVM claim address; opt-out omits them entirely.
  const rreq = buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC, toTokenAddress: ARB_USDC, fromAmount: "5000000", fromAddress: RUSER, toAddress: RUSER });
  ok("relay: quote request carries app fee of exactly 0.5% to the dripbot evm wallet",
    rreq.originChainId === 8453 && rreq.destinationChainId === 42161 && rreq.amount === "5000000" && rreq.tradeType === "EXACT_INPUT"
    && Array.isArray(rreq.appFees) && rreq.appFees.length === 1
    && rreq.appFees[0].recipient === RELAY_APP_FEE_RECIPIENT && RELAY_APP_FEE_RECIPIENT === FEE_SPLIT.dripbot.agentWallet.evm
    && rreq.appFees[0].fee === String(PLATFORM_FEE_BPS) && PLATFORM_FEE_BPS === 50 && !(("recipient") in rreq));
  ok("relay: quote request fee opt-out omits appFees; foreign recipient is named",
    !("appFees" in buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC, toTokenAddress: ARB_USDC, fromAmount: "5", fromAddress: RUSER, toAddress: RUSER }, { includeFee: false }))
    && buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "solana", fromTokenAddress: BASE_USDC, toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", fromAmount: "5", fromAddress: RUSER, toAddress: "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn" }).recipient === "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn");
  ok("relay: quote request is null where relay has no chain",
    buildRelayQuoteRequest({ fromChainKey: "sui", toChainKey: "base", fromTokenAddress: "0x2::sui::SUI", toTokenAddress: BASE_USDC, fromAmount: "5", fromAddress: RUSER, toAddress: RUSER }) === null);

  // Quote parsing: amounts, costs and the fee come from the quote's
  // own fields; the extracted fee equals 0.5% of the input exactly.
  const rroute = parseRelayQuote(RELAY_QUOTE, { fromChainKey: "base", toChainKey: "arbitrum", fromAmount: "5000000", fromAddress: RUSER });
  ok("relay: quote parses into route shape with relay costs",
    rroute !== null && rroute.provider === "relay" && rroute.fromChainId === 8453 && rroute.toChainId === 42161
    && rroute.fromAmount === "5000000" && rroute.toAmount === "4950786" && rroute.toAmountMin === "4851771"
    && rroute.toAmountUSD === "4.949722" && Math.abs(rroute.gasCostUSD - 0.001102) < 1e-9 && rroute.executionDuration === 1
    && rroute.fromToken.symbol === "USDC" && rroute.toToken.symbol === "USDC" && rroute.relay.originChainId === 8453);
  ok("relay: extracted app fee is exactly 0.5% of the input",
    rroute.platformFeeCollecting === true && rroute.platformFeeRaw === "25000"
    && BigInt(rroute.platformFeeRaw) === platformFeeOn(rroute.fromAmount)
    && Math.abs(rroute.platformFeeUsd - 0.024994) < 1e-9);
  // Route cost under the model's corrected definition: the all-in
  // shortfall (4.998895 in − 4.949722 out − the 0.024994 app fee
  // this capture carries = 0.024179), NOT the $0.001102 of declared
  // gas — most of Relay's cost rides inside the rate, and the fee
  // model marks up what the route actually costs.
  ok("relay: route cost is the all-in shortfall, not the declared fees alone",
    Math.abs(rroute.routeFeeUsd - 0.024179) < 1e-9);
  // The $100 lane under the same definition and the adopted fee
  // law: a fee-free $100 quote whose shortfall is $0.035 (declared
  // gas still just $0.0011) into an EVM destination prices at the
  // EVM multiplier — 4 × $0.035 = $0.14 target → 14 bps, $0.14
  // charged exactly.
  ok("relay: $100 lane with a $0.035 all-in cost prices at 14 bps to an evm destination",
    (() => { const q = structuredClone(RELAY_QUOTE);
      q.details.currencyIn = { ...q.details.currencyIn, amount: "100000000", amountUsd: "100.0" };
      q.details.currencyOut = { ...q.details.currencyOut, amount: "99965000", amountUsd: "99.965" };
      q.fees.app = { ...q.fees.app, amount: "0", amountUsd: "0" };
      const r = parseRelayQuote(q, { fromChainKey: "base", toChainKey: "arbitrum", fromAmount: "100000000", fromAddress: RUSER });
      return r !== null && Math.abs(r.routeFeeUsd - 0.035) < 1e-9
        && platformFeeBpsForRoute(r.routeFeeUsd, r.fromAmountUSD, "arbitrum") === 14
        && platformFeeOn(100000000n, platformFeeBpsForRoute(r.routeFeeUsd, r.fromAmountUSD, "arbitrum")) === 140000n; })());
  ok("relay: quote for a different amount or sender is refused",
    parseRelayQuote({ ...RELAY_QUOTE, details: { ...RELAY_QUOTE.details, currencyIn: { ...RELAY_QUOTE.details.currencyIn, amount: "5000001" } } }, { fromChainKey: "base", toChainKey: "arbitrum", fromAmount: "5000000", fromAddress: RUSER }) === null
    && parseRelayQuote({ ...RELAY_QUOTE, details: { ...RELAY_QUOTE.details, sender: "0x0000000000000000000000000000000000000001" } }, { fromChainKey: "base", toChainKey: "arbitrum", fromAmount: "5000000", fromAddress: RUSER }) === null
    && parseRelayQuote({ ...RELAY_QUOTE, steps: [] }, { fromChainKey: "base", toChainKey: "arbitrum" }) === null);
  ok("relay: a skipped app fee parses as not collecting",
    (() => { const q = structuredClone(RELAY_QUOTE); q.fees.app = { ...q.fees.app, amount: "0", amountUsd: "0" };
      const r = parseRelayQuote(q, { fromChainKey: "base", toChainKey: "arbitrum", fromAmount: "5000000", fromAddress: RUSER });
      return r !== null && r.platformFeeCollecting === false && r.platformFeeRaw === "0"; })());

  // Executability + step bounds: the live fixture passes; tampered
  // approvals (wrong spender, inflated amount) and foreign steps are
  // refused before anything could be signed.
  const rex = swapRouteExecutable(rroute);
  ok("relay: evm route is executable with its quoted steps",
    rex.ok === true && rex.relay === true && rex.steps.length === 2 && relayExecutableSteps(rroute).length === 2);
  ok("relay: live fixture steps pass the bounds check",
    checkRelayStepBounds(rroute, rroute.relay.steps[0], rroute.relay.steps[0].items[0], RUSER).ok === true
    && checkRelayStepBounds(rroute, rroute.relay.steps[1], rroute.relay.steps[1].items[0], RUSER).ok === true);
  {
    const erc20 = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
    const clone = () => structuredClone(rroute);
    const inflated = clone();
    inflated.relay.steps[0].items[0].data.data = erc20.encodeFunctionData("approve", ["0x4cd00e387622c35bddb9b4c962c136462338bc31", 5000001n]);
    const wrongSpender = clone();
    wrongSpender.relay.steps[0].items[0].data.data = erc20.encodeFunctionData("approve", ["0x000000000000000000000000000000000000dEaD", 5000000n]);
    const foreign = clone();
    foreign.relay.steps[1].items[0].data.from = "0x0000000000000000000000000000000000000001";
    ok("relay: inflated approval amount is refused",
      checkRelayStepBounds(inflated, inflated.relay.steps[0], inflated.relay.steps[0].items[0], RUSER).ok === false
      && /exact amount/.test(checkRelayStepBounds(inflated, inflated.relay.steps[0], inflated.relay.steps[0].items[0], RUSER).reason));
    ok("relay: approval to an unexpected spender is refused",
      checkRelayStepBounds(wrongSpender, wrongSpender.relay.steps[0], wrongSpender.relay.steps[0].items[0], RUSER).ok === false);
    ok("relay: a step built for a different account is refused",
      checkRelayStepBounds(foreign, foreign.relay.steps[1], foreign.relay.steps[1].items[0], RUSER).ok === false
      && checkRelayStepBounds(rroute, rroute.relay.steps[0], rroute.relay.steps[0].items[0], "0x0000000000000000000000000000000000000001").ok === false);
    // Native-coin route: the single deposit step must carry exactly
    // the swapped amount as value — no more, no less.
    const native = clone();
    native.fromToken = { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18, chainId: 8453 };
    native.relay.steps = [native.relay.steps[1]];
    native.relay.steps[0].items[0].data.value = "5000000";
    const nativeShort = structuredClone(native);
    nativeShort.relay.steps[0].items[0].data.value = "4999999";
    ok("relay: native step value must equal the exact swap amount",
      checkRelayStepBounds(native, native.relay.steps[0], native.relay.steps[0].items[0], RUSER).ok === true
      && checkRelayStepBounds(nativeShort, nativeShort.relay.steps[0], nativeShort.relay.steps[0].items[0], RUSER).ok === false);
  }
  // Source pin (house style): the bounds check runs before signing.
  const coreSrcRelay = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("relay: bounds check precedes signing in the executor",
    coreSrcRelay.indexOf("checkRelayStepBounds(route, step, item, wallet.address)") > -1
    && coreSrcRelay.indexOf("checkRelayStepBounds(route, step, item, wallet.address)") < coreSrcRelay.indexOf("const tx = await signer.sendTransaction(txReq);", coreSrcRelay.indexOf("executeRelaySwapRoute")));

  // Review-sheet intent: the router is named and the fee is its own
  // clause — the same sentence shape LI.FI routes produce. The fee
  // shown is the final quote's own USD figure with its effective
  // percentage of the amount.
  ok("relay: intent names the relay router and discloses the fee in usd with its effective pct",
    (() => { const s = formatSwapIntent({ fromAmount: "5", fromSymbol: "USDC", fromNetKey: "base", toAmount: "4.950786", toSymbol: "USDC", toNetKey: "arbitrum", toolName: "Relay", feeUsd: rroute.gasCostUSD, durationSec: rroute.executionDuration, platformFeeUsd: rroute.platformFeeUsd, platformFeePct: (rroute.platformFeeUsd / Number(rroute.fromAmountUSD)) * 100 });
      return s.includes("via Relay") && s.includes("Fluid fee: $0.02 (0.5%)"); })());
  const appSrcRelay = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("relay: app names relay routes, gates fee disclosure on the quote, executes via the relay executor",
    appSrcRelay.includes('if (route && route.provider === "relay") return "Relay";')
    && appSrcRelay.includes('r.provider === "relay" ? r.platformFeeCollecting === true : swapFeeCollectingChain(r.fromChainId)')
    && appSrcRelay.includes('if (route.provider === "relay")')
    && appSrcRelay.includes("executeRelaySwapRoute(wallet, route"));

  // Router selection end-to-end, fetch stubbed per host: a Relay-
  // supported pair is answered by Relay alone; a Relay failure falls
  // back to LI.FI; a Sui pair never asks Relay at all.
  const realFetch = globalThis.fetch;
  const jsonRes = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const lifiStep = (fromChainId, toChainId) => ({ id: "lifi-quote", type: "swap",
    action: { fromChainId, toChainId, fromAmount: "1000000", fromToken: { address: "0xa", symbol: "A", decimals: 6 }, toToken: { address: "0xb", symbol: "B", decimals: 6 } },
    estimate: { toAmount: "999000", toAmountMin: "990000", toAmountUSD: "1.0", fromAmountUSD: "1.0", gasCosts: [], executionDuration: 30 },
    transactionRequest: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0x", value: "0", chainId: fromChainId } });
  try {
    let relayCalls = 0, lifiCalls = 0;
    const relayBodies = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.relay.link")) {
        relayCalls++;
        relayBodies.push(JSON.parse(opts.body));
        if (relayCalls === 1) return jsonRes(RELAY_QUOTE);
        // Pass 2 answers with the app fee at the computed 50 bps —
        // the capture's own 25,000 raw on 5,000,000.
        return jsonRes(structuredClone(RELAY_QUOTE));
      }
      if (u.includes("li.quest")) { lifiCalls++; throw new Error("lifi must not be called"); }
      throw new Error("unexpected url " + u);
    };
    const viaRelay = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC, toTokenAddress: ARB_USDC, fromAmount: "5000000", fromAddress: RUSER, toAddress: RUSER });
    ok("relay: supported pair is answered by relay alone",
      viaRelay.length === 1 && viaRelay[0].provider === "relay" && relayCalls === 2 && lifiCalls === 0);
    // The fee model's two passes, pinned on the wire: pass 1 carries
    // NO app fee (it only reads the route's cost — under the model's
    // definition the fixture's cost is its all-in shortfall,
    // 4.998895 in − 4.949722 out − 0.024994 app fee = $0.024179 on a
    // $4.998895 input, not its $0.001102 of declared gas), so even
    // the EVM multiplier's 4× the cost ($0.097) clears the $0.025
    // cap and pass 2 carries the full 50 bps; the executed route
    // is pass 2's, annotated with the charged bps.
    ok("relay: two-pass search reads the route cost fee-free, then charges the computed bps",
      !("appFees" in relayBodies[0])
      && relayBodies[1].appFees?.[0]?.fee === "50" && relayBodies[1].appFees?.[0]?.recipient === RELAY_APP_FEE_RECIPIENT
      && viaRelay[0].platformFeeBps === 50 && viaRelay[0].platformFeeRaw === "25000"
      && Math.abs(viaRelay[0].routeFeeUsd - 0.024179) < 1e-9);

    relayCalls = 0; lifiCalls = 0;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.relay.link")) { relayCalls++; return jsonRes({ message: "No route found for this pair" }, false, 400); }
      if (u.includes("li.quest/v1/routes")) { lifiCalls++; return jsonRes({ routes: [] }); }
      if (u.includes("li.quest/v1/quote")) { lifiCalls++; return jsonRes(lifiStep(8453, 42161)); }
      throw new Error("unexpected url " + u);
    };
    const viaFallback = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC, toTokenAddress: ARB_USDC, fromAmount: "5000000", fromAddress: RUSER, toAddress: RUSER });
    ok("relay: a relay failure falls back to lifi rather than failing the swap",
      relayCalls === 1 && lifiCalls >= 1 && viaFallback.length === 1 && viaFallback[0].provider !== "relay" && viaFallback[0].steps.length === 1);

    relayCalls = 0; lifiCalls = 0;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.relay.link")) { relayCalls++; throw new Error("relay must not be called for sui"); }
      if (u.includes("li.quest/v1/routes")) { lifiCalls++; return jsonRes({ routes: [] }); }
      if (u.includes("li.quest/v1/quote")) { lifiCalls++; return jsonRes(lifiStep(9270000000000000, 56)); }
      throw new Error("unexpected url " + u);
    };
    const viaSui = await getSwapRoutes({ fromChainKey: "sui", toChainKey: "bsc", fromTokenAddress: "0x2::sui::SUI", toTokenAddress: "0x55d398326f99059fF775485246999027B3197955", fromAmount: "1000000", fromAddress: "0xsuiaddr", toAddress: RUSER });
    ok("relay: a sui pair goes straight to lifi",
      relayCalls === 0 && lifiCalls >= 1 && viaSui.length === 1 && viaSui[0].provider !== "relay");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 65. Fee model (owner's design, adopted law 2026-11-08): Fluid's
// swap fee is a markup on the ROUTE's cost, not on the user's
// volume — feeUSD = min(MULTIPLIER(dest) × routeFeeUSD, 0.5% of
// the amount, CEILING(dest) − routeFeeUSD), floored at 0. The
// multiplier is 4× into EVM destinations, 5× everywhere else; the
// ceilings cap the user's TOTAL cost (route + fee) per destination
// ecosystem — $0.20 EVM, $1.50 Bitcoin, $0.30 Lightning, $0.30
// Solana, unlisted ecosystems on the EVM ceiling — and a route
// that alone meets its ceiling leaves the fee at 0. The 0.5% is
// the hard cap and the degenerate-case fallback. Both routers
// take the fee as basis points of the amount at quote time,
// computed by a two-pass search (fee-free quote to read the
// route's own cost, then the executed quote at exactly the
// computed bps, floored so the charge can never round above the
// target). A route's cost is the LARGER of its explicit fee
// components and its all-in shortfall (input value minus output
// value, Fluid's fee excluded) — most of a cheap route's cost
// rides inside the exchange rate, and the owner's worked example
// multiplies the all-in figure. The lane fixtures are the
// comparison study's live numbers
// (research_notes/fluid-router-comparison-20261108/).
{
  const USDC_B = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", USDC_A = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const FUSER = "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34";

  ok("fee model: multipliers are 5 standard and 4 evm, the cap stays 50 bps",
    PLATFORM_FEE_ROUTE_MULTIPLIER === 5 && PLATFORM_FEE_ROUTE_MULTIPLIER_EVM === 4 && PLATFORM_FEE_BPS === 50);
  ok("fee model: ceilings table is the adopted policy",
    PLATFORM_FEE_TOTAL_CEILINGS_USD.evm === 0.20 && PLATFORM_FEE_TOTAL_CEILINGS_USD.bitcoin === 1.50
    && PLATFORM_FEE_TOTAL_CEILINGS_USD.lightning === 0.30 && PLATFORM_FEE_TOTAL_CEILINGS_USD.solana === 0.30);
  // Destination classification: NETWORKS keys are EVM; the named
  // families get their own rows; unlisted ecosystems (Tron, Sui)
  // and an absent key fall to the default — EVM ceiling, 5×.
  ok("fee model: destination ecosystems classify as adopted",
    platformFeeEcosystemOf("arbitrum") === "evm" && platformFeeEcosystemOf("bsc") === "evm"
    && platformFeeEcosystemOf("solana") === "solana" && platformFeeEcosystemOf("bitcoin") === "bitcoin"
    && platformFeeEcosystemOf("lightning") === "lightning" && platformFeeEcosystemOf("tron") === "default"
    && platformFeeEcosystemOf("sui") === "default" && platformFeeEcosystemOf(null) === "default"
    && platformFeeMultiplierFor("base") === 4 && platformFeeMultiplierFor("solana") === 5
    && platformFeeMultiplierFor("tron") === 5 && platformFeeCeilingFor("solana") === 0.30
    && platformFeeCeilingFor("bitcoin") === 1.50 && platformFeeCeilingFor("tron") === 0.20
    && platformFeeCeilingFor(null) === 0.20);
  // The $100 Relay EVM lane: route $0.035 → 4× = $0.14 binds
  // (under the $0.50 cap and the $0.165 of ceiling room) — the
  // user's route+fee total is $0.175, the figure the owner
  // accepted for the flagship lane.
  ok("fee model: relay $100 evm lane prices at 4x the route cost",
    Math.abs(platformFeeUsdForRoute(0.035, 100, "arbitrum") - 0.14) < 1e-9
    && Math.abs(0.035 + platformFeeUsdForRoute(0.035, 100, "arbitrum") - 0.175) < 1e-9);
  // Charged in whole bps, floored: 14 bps = $0.14 exactly here —
  // and floor slack only ever lands UNDER the target, never above.
  ok("fee model: charged bps floors under the target fee",
    platformFeeBpsForRoute(0.035, 100, "arbitrum") === 14
    && platformFeeOn(100000000n, platformFeeBpsForRoute(0.035, 100, "arbitrum")) === 140000n);
  // An Across-class EVM lane: route $0.018 on $100 → 4× = $0.072
  // binds; 7 bps charged (floored from 7.2) stays under it.
  ok("fee model: across-class evm lane prices at 4x the route cost",
    Math.abs(platformFeeUsdForRoute(0.018, 100, "base") - 0.072) < 1e-9
    && platformFeeBpsForRoute(0.018, 100, "base") === 7);
  // An expensive same-chain EVM lane (Relay's $0.057 route on
  // $100): the ceiling binds — the fee is exactly the room left,
  // $0.20 − $0.057 = $0.143, and the total is exactly $0.20.
  ok("fee model: the evm ceiling binds an expensive same-chain lane",
    Math.abs(platformFeeUsdForRoute(0.057, 100, "base") - 0.143) < 1e-9
    && Math.abs(0.057 + platformFeeUsdForRoute(0.057, 100, "base") - 0.20) < 1e-9);
  // Bitcoin destination, $20 with a $0.30 route: 5× is $1.50 and
  // the $1.50 ceiling leaves $1.20 of room, but the 0.5% cap
  // binds at $0.10 — the cap is the binding term on BTC lanes at
  // realistic route costs (owner calibration, 2026-11-08).
  ok("fee model: bitcoin destination is capped at 0.5% under its ceiling",
    Math.abs(platformFeeUsdForRoute(0.30, 20, "bitcoin") - 0.10) < 1e-9
    && platformFeeBpsForRoute(0.30, 20, "bitcoin") === 50);
  // The calibrated BTC lane (Garden's live numbers, $100): the
  // route costs $0.84 — 5× is $4.20 and the ceiling leaves $0.66,
  // so the 0.5% cap binds at $0.50 and the total lands at $1.34,
  // inside the $0.70–1.85 market band for landing on Bitcoin.
  ok("fee model: bitcoin $100 garden-class lane prices at the 0.5% cap",
    Math.abs(platformFeeUsdForRoute(0.84, 100, "bitcoin") - 0.50) < 1e-9
    && Math.abs(0.84 + platformFeeUsdForRoute(0.84, 100, "bitcoin") - 1.34) < 1e-9
    && platformFeeBpsForRoute(0.84, 100, "bitcoin") === 50);
  // A pricier BTC route ($1.20 on $100 — Relay-class delivery):
  // 5× is $6.00 and the cap is $0.50, but the ceiling binds — the
  // fee is exactly the room left, $1.50 − $1.20 = $0.30, and the
  // total is exactly the $1.50 ceiling.
  ok("fee model: the bitcoin ceiling binds a $1.20 route at exactly $1.50 total",
    Math.abs(platformFeeUsdForRoute(1.20, 100, "bitcoin") - 0.30) < 1e-9
    && Math.abs(1.20 + platformFeeUsdForRoute(1.20, 100, "bitcoin") - 1.50) < 1e-9
    && platformFeeBpsForRoute(1.20, 100, "bitcoin") === 30);
  // A BTC route that alone exceeds the ceiling ($1.60 on $100)
  // leaves no room: the fee is 0 rather than pushing the total
  // past the hard cap on user pain.
  ok("fee model: a bitcoin route above its ceiling prices the fee at zero",
    platformFeeUsdForRoute(1.60, 100, "bitcoin") === 0
    && platformFeeBpsForRoute(1.60, 100, "bitcoin") === 0);
  // Lightning destination, $20 with a $0.10 route: the 0.5% cap
  // binds at $0.10 and the total lands at $0.20, under the $0.30
  // ceiling.
  ok("fee model: lightning destination prices under its ceiling",
    Math.abs(platformFeeUsdForRoute(0.10, 20, "lightning") - 0.10) < 1e-9
    && Math.abs(0.10 + platformFeeUsdForRoute(0.10, 20, "lightning") - 0.20) < 1e-9);
  // Solana destination, $100 with Relay's $0.209 exit route: the
  // ceiling term ($0.30 − $0.209 = $0.091) binds far below 5×
  // ($1.045) and the cap ($0.50); 9 bps charged stays under it.
  ok("fee model: solana ceiling binds a relay exit route",
    Math.abs(platformFeeUsdForRoute(0.209, 100, "solana") - 0.091) < 1e-9
    && platformFeeBpsForRoute(0.209, 100, "solana") === 9);
  // The $5 EVM lane: 4 × $0.026 = $0.104 > the $0.025 cap — the
  // cap bites.
  ok("fee model: relay $5 lane is capped at 0.5%",
    Math.abs(platformFeeUsdForRoute(0.026, 5, "arbitrum") - 0.025) < 1e-9 && platformFeeBpsForRoute(0.026, 5, "arbitrum") === 50);
  // The $1 lane: capped at $0.005.
  ok("fee model: relay $1 lane is capped at 0.5%",
    Math.abs(platformFeeUsdForRoute(0.026, 1, "arbitrum") - 0.005) < 1e-9 && platformFeeBpsForRoute(0.026, 1, "arbitrum") === 50);
  // A route that alone meets (or eats) the ceiling leaves no
  // room for a fee at all: the fee is 0, never a push past the
  // user's total-cost promise — $0.25 of route into a $0.20 EVM
  // ceiling, and a $2 route on $100 anywhere.
  ok("fee model: a route at or above the ceiling prices the fee at zero",
    platformFeeUsdForRoute(0.25, 100, "arbitrum") === 0 && platformFeeBpsForRoute(0.25, 100, "arbitrum") === 0
    && platformFeeUsdForRoute(2, 100) === 0 && platformFeeBpsForRoute(2, 100) === 0);
  // Degenerate cases fall back to the flat cap so a fee is still
  // collected and disclosed: zero/unreadable route cost, unpriced
  // amount.
  ok("fee model: degenerate inputs fall back to the flat 0.5%",
    platformFeeBpsForRoute(0, 100) === 50 && platformFeeBpsForRoute(undefined, 100) === 50
    && platformFeeBpsForRoute(NaN, 100) === 50 && platformFeeBpsForRoute(0.035, 0) === 50
    && platformFeeBpsForRoute(0.035, undefined) === 50
    && Math.abs(platformFeeUsdForRoute(0, 100) - 0.5) < 1e-9);
  // Sweep (default destination): charged bps never above the cap,
  // the charged USD never above the law's target (floor slack only
  // ever rounds down), and route + fee never past the ceiling —
  // a route already over the ceiling charges exactly 0.
  ok("fee model: charged fee never exceeds the law across a sweep",
    [[0.001, 1], [0.01, 3], [0.035, 100], [0.4, 250], [1.5, 40], [0.0005, 1000], [12, 75]].every(([rf, amt]) => {
      const bps = platformFeeBpsForRoute(rf, amt);
      const charged = (bps / 10000) * amt;
      return bps >= 0 && bps <= 50
        && charged <= Math.min(0.005 * amt, 5 * rf, Math.max(0, 0.20 - rf)) + 1e-9
        && (rf < 0.20 ? rf + charged <= 0.20 + 1e-9 : charged === 0);
    }));
  // platformFeeOn at an explicit rate; the default stays the cap.
  ok("fee model: platformFeeOn honours an explicit bps and defaults to the cap",
    platformFeeOn(5000000n, 17) === 8500n && platformFeeOn(5000000n) === 25000n && platformFeeOn(5000000n, 0) === 0n);
  // Request builders carry an explicit rate and default to the cap.
  ok("fee model: relay request builder carries an explicit bps and defaults to the cap",
    buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "5", fromAddress: FUSER, toAddress: FUSER }, { includeFee: true, feeBps: 17 }).appFees[0].fee === "17"
    && buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "5", fromAddress: FUSER, toAddress: FUSER }).appFees[0].fee === "50");
  ok("fee model: lifi builders carry an explicit fraction and default to the cap fraction",
    buildLifiRoutesRequest({ fromChainId: 8453, toChainId: 42161, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true, feeFraction: 0.0017 }).options.fee === 0.0017
    && buildLifiQuoteParams({ fromChainId: 8453, toChainId: 42161, fromTokenAddress: "0xa", toTokenAddress: "0xb", fromAmount: "5", fromAddress: "0xc", toAddress: "0xc" }, { includeFee: true, feeFraction: 0.0017 }).get("fee") === "0.0017");

  // The review sentence: below the cap the user sees the actual USD
  // fee AND its effective percentage — the edge is the point. At the
  // cap the percentage is the familiar 0.5%.
  ok("fee model: intent shows a below-cap fee in usd with its effective pct",
    (() => { const s = formatSwapIntent({ fromAmount: "100", fromSymbol: "USDC", fromNetKey: "base", toAmount: "99", toSymbol: "USDC", toNetKey: "arbitrum", toolName: "Relay", feeUsd: 0.035, durationSec: 1, platformFeeUsd: 0.17, platformFeePct: 0.17 });
      return s.includes("via Relay") && s.includes("Fluid fee: $0.17 (0.17%)"); })());
  ok("fee model: intent at the cap shows 0.5%",
    formatSwapIntent({ fromAmount: "100", fromSymbol: "USDC", fromNetKey: "base", toAmount: "99", toSymbol: "USDC", toNetKey: "arbitrum", toolName: "Relay", feeUsd: 0.035, durationSec: 1, platformFeeUsd: 0.5, platformFeePct: 0.5 }).includes("Fluid fee: $0.50 (0.5%)"));
  // App wiring (source pins): the sheet copy names the model, and
  // the disclosure is priced from the final quote (Relay's stated
  // USD fee, or the bps the LI.FI search attached) — the old
  // flat-rate computation from fromAmount is gone.
  const appSrcFee = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("fee model: app discloses the final quote's fee and names the model in the sheet copy",
    appSrcFee.includes("Fluid's fee is a small multiple of the route's cost, never more than 0.5%")
    && appSrcFee.includes("Total cost caps: $0.20 EVM · $1.50 Bitcoin · $0.30 Lightning · $0.30 Solana.")
    && appSrcFee.includes("Number(r.platformFeeBps) > 0")
    && appSrcFee.includes("...(platformFeeUsd != null ? { platformFeeUsd, platformFeePct } : {})")
    && !appSrcFee.includes("collects ? platformFeeOn(r.fromAmount) : 0n"));

  // Relay degenerate passes, fetch stubbed: a quote whose route
  // cost reads as zero prices at the flat cap on pass 2; a route
  // so cheap the model floors to 0 bps executes the fee-free
  // pass-1 quote with no second call.
  // The output's USD value tracks the declared gas, so the quote's
  // all-in shortfall equals its explicit cost — the two measures of
  // the route's cost agree, and the degenerate cases below price
  // off the gas figure alone.
  const RELAY_Q = (gasUsd, appFee) => ({
    requestId: "0xfee65",
    steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: FUSER, to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0xe8017952", value: "0", chainId: 8453 } }] }],
    fees: { gas: { amount: "1", amountUsd: gasUsd }, ...(appFee ? { app: { amount: appFee.amount, amountUsd: appFee.amountUsd } } : {}) },
    details: { sender: FUSER, recipient: FUSER,
      currencyIn: { currency: { chainId: 8453, address: USDC_B, symbol: "USDC", decimals: 6 }, amount: "100000000", amountUsd: "100.0" },
      currencyOut: { currency: { chainId: 42161, address: USDC_A, symbol: "USDC", decimals: 6 }, amount: "99000000", amountUsd: String(100 - Number(gasUsd)), minimumAmount: "98000000" },
      timeEstimate: 1 },
  });
  const realFetchFee = globalThis.fetch;
  const jsonResFee = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  try {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.relay.link")) {
        bodies.push(JSON.parse(opts.body));
        return jsonResFee(bodies.length === 1 ? RELAY_Q("0", null) : RELAY_Q("0", { amount: "50000000", amountUsd: "0.5" }));
      }
      throw new Error("unexpected url " + u);
    };
    const capped = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "100000000", fromAddress: FUSER, toAddress: FUSER });
    ok("fee model: relay zero-cost quote falls back to the flat cap on pass 2",
      bodies.length === 2 && !("appFees" in bodies[0]) && bodies[1].appFees?.[0]?.fee === "50"
      && capped[0].platformFeeBps === 50 && capped[0].platformFeeRaw === "50000000");

    const bodies0 = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("api.relay.link")) { bodies0.push(JSON.parse(opts.body)); return jsonResFee(RELAY_Q("0.0001", null)); }
      throw new Error("unexpected url " + u);
    };
    const free = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "100000000", fromAddress: FUSER, toAddress: FUSER });
    ok("fee model: relay route priced at 0 bps executes the fee-free pass-1 quote",
      bodies0.length === 1 && free[0].platformFeeBps === 0 && free[0].platformFeeCollecting === false);
  } finally {
    globalThis.fetch = realFetchFee;
  }

  // The same model on the LI.FI path: a route's own cost is its
  // steps' fee costs plus gas costs, read on the fee-free pass.
  const lifiRoute = () => ({ id: "r1", fromChainId: 8453, toChainId: 42161, fromAmount: "100000000", toAmount: "99000000", toAmountUSD: "99.0", fromAmountUSD: "100.0",
    fromToken: { address: USDC_B, symbol: "USDC", decimals: 6 }, toToken: { address: USDC_A, symbol: "USDC", decimals: 6 },
    steps: [{ id: "s1", type: "swap", estimate: { feeCosts: [{ name: "bridgeFee", amountUSD: "0.02" }], gasCosts: [{ amountUSD: "0.015" }], toAmountUSD: "99.0", fromAmountUSD: "100.0", executionDuration: 30 } }] });
  // The same explicit costs ($0.02 bridge fee + $0.015 gas) on a
  // route whose rate is tight: $99.99 arrives on $100, a $0.01
  // shortfall.
  const lifiRouteTight = () => ({ ...lifiRoute(), toAmount: "99990000", toAmountUSD: "99.99",
    steps: [{ id: "s1", type: "swap", estimate: { feeCosts: [{ name: "bridgeFee", amountUSD: "0.02" }], gasCosts: [{ amountUSD: "0.015" }], toAmountUSD: "99.99", fromAmountUSD: "100.0", executionDuration: 30 } }] });
  // The F2 route-cost definition (2026-11-10): the cost IS the
  // all-in shortfall — lifiRoute's $1.00 shortfall prices the fee;
  // the tight route's $0.01 shortfall prices it too, even though
  // its declared components total $0.035 (declared components are
  // estimates, not losses — the old larger-of combiner is what
  // audit F2 removed). The explicit sum survives only as the
  // fallback for an unreadable shortfall.
  ok("fee model: a lifi route's cost is its all-in shortfall, explicit costs only as fallback",
    Math.abs(lifiRouteFeeUsd(lifiRoute()) - 1.0) < 1e-9 && Math.abs(lifiRouteFeeUsd(lifiRouteTight()) - 0.01) < 1e-9
    && lifiRouteFeeUsd({}) === 0 && lifiRouteFeeUsd({ steps: [{}] }) === 0);
  try {
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("li.quest/v1/routes")) { bodies.push(JSON.parse(opts.body)); return jsonResFee({ routes: [lifiRouteTight()] }); }
      throw new Error("unexpected url " + u);
    };
    const rs = await getLifiSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "100000000", fromAddress: FUSER, toAddress: FUSER });
    // Route cost $0.01 on a $100 input (the tight fixture's all-in
    // shortfall under the F2 definition) into an EVM destination
    // → 4× binds → 4 bps → fraction 0.0004, attached on pass 2
    // only; the executed routes carry the bps.
    ok("fee model: lifi two-pass reads the cost fee-free, then charges the computed fraction",
      bodies.length === 2 && !("fee" in bodies[0].options) && bodies[0].options.integrator === "fluid-wallet"
      && Math.abs(bodies[1].options.fee - 0.0004) < 1e-12 && rs.length === 1 && rs[0].platformFeeBps === 4);

    const quoteUrls = [];
    const lifiQuoteStep = () => ({ id: "q1", type: "swap",
      action: { fromChainId: 8453, toChainId: 42161, fromAmount: "100000000", fromToken: { address: USDC_B, symbol: "USDC", decimals: 6 }, toToken: { address: USDC_A, symbol: "USDC", decimals: 6 } },
      estimate: { toAmount: "99990000", toAmountMin: "99980000", toAmountUSD: "99.99", fromAmountUSD: "100.0", feeCosts: [{ amountUSD: "0.02" }], gasCosts: [{ amountUSD: "0.015" }], executionDuration: 30 },
      transactionRequest: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0x", value: "0", chainId: 8453 } });
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("li.quest/v1/routes")) return jsonResFee({ routes: [] });
      if (u.includes("li.quest/v1/quote")) { quoteUrls.push(u); return jsonResFee(lifiQuoteStep()); }
      throw new Error("unexpected url " + u);
    };
    const qs = await getLifiSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_B, toTokenAddress: USDC_A, fromAmount: "100000000", fromAddress: FUSER, toAddress: FUSER });
    ok("fee model: lifi quote path runs its own two passes with the computed fee",
      quoteUrls.length === 2 && !quoteUrls[0].includes("fee=") && quoteUrls[1].includes("fee=0.0004")
      && qs.length === 1 && qs[0].platformFeeBps === 4 && qs[0].steps.length === 1);
  } finally {
    globalThis.fetch = realFetchFee;
  }
}

// 66. Across as PRIMARY for same-asset EVM majors (2026-11-08, under
// the §65 fee law): the dispatcher quotes Across BEFORE Relay only
// when both chains are EVM + in Across coverage AND the pair is the
// same hub asset (USDC/USDT/WETH) — everything else falls through to
// the unchanged Relay → LI.FI order. The Swap API's deposit is the
// NEWER unified deposit(bytes32,...) (selector 0xad5425c6); with an
// app fee the on-chain recipient is the destination MulticallHandler
// and the user + fee split live inside its `message` (Instructions),
// so parseAcrossQuote runs a strict bounds check (pinned handler +
// adapter per destination chain, exact fee/remainder containment) and
// REFUSES any shape it has not pinned — the live zkSync-Era composed
// message (approve + opaque router call) is the documented case:
// refused by design, Relay serves the lane. The API's approvalTxns
// encode UNLIMITED approvals and are never used; Fluid composes its
// own exact-amount approval. Fixture shapes mirror the live probes
// of 2026-11-08 (Base→Arbitrum USDC $100: bridge fee 27,133 raw =
// $0.027121577, handler 0x0f7a…, adapter 0xBF75…, 1632-byte message).
{
  const AUSER = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  const AFEE = RELAY_APP_FEE_RECIPIENT;
  const BASE_USDC_A2 = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const ARB_USDC_A2 = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const HANDLER_A2 = "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e";
  const ADAPTER_A2 = "0xBF75133b48b0a42AB9374027902E83C5E2949034";
  const BASE_POOL_A2 = "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64";
  const BSC_POOL_A2 = "0x4e8E101924eDE233C13e2D8622DC8aED2872d505";
  const BSC_USDC_A2 = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const coderA2 = ethers.AbiCoder.defaultAbiCoder();
  const b32A2 = (a) => ethers.zeroPadValue(a, 32);
  const depositIfaceA2 = new ethers.Interface(["function deposit(bytes32 depositor,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,bytes32 exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityParameter,bytes message)"]);
  const erc20A2 = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)", "function approve(address spender, uint256 amount) returns (bool)"]);
  const INSTR_A2 = "tuple(tuple(address target, bytes data, uint256 value)[] calls, address fallbackRecipient)";
  const adapterBlobA2 = (token, user, feeTo) => "0xd836083e" + coderA2.encode(["uint256", "uint256", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "string"], [32n, 480n, 1n, 0n, token, 0n, 0n, 0n, 416n, 0n, user, feeTo, "None"]).slice(2);
  const handlerMsgA2 = ({ token, feeTo, feeAmt, user, handler = HANDLER_A2, adapter = ADAPTER_A2 }) => {
    const deliver = "0xef8738d3" + coderA2.encode(["address", "address"], [token, user]).slice(2);
    const calls = [
      [token, erc20A2.encodeFunctionData("transfer", [feeTo, feeAmt]), 0n],
      [handler, deliver, 0n],
      [handler, deliver, 0n],
      [adapter, adapterBlobA2(token, user, feeTo), 0n],
    ];
    return coderA2.encode([INSTR_A2], [[calls, "0x0000000000000000000000000000000000000000"]]);
  };
  const acrossQuoteA2 = (o = {}) => {
    const { appRaw = "0", appUsd = "0", feeTo = AFEE, msgUser = AUSER, feeAmtOverride = null, handler = HANDLER_A2, adapter = ADAPTER_A2,
      inTok = BASE_USDC_A2, outTok = ARB_USDC_A2, inSym = "USDC", outSym = "USDC", inDec = 6, outDec = 6,
      inAmt = "100000000", bridgeOut = "99972867", bridgeRaw = "27133", bridgeUsd = "0.027121577007000002",
      originChainId = 8453, destChainId = 42161, pool = BASE_POOL_A2, messageOverride = null } = o;
    const hasFee = BigInt(appRaw) > 0n;
    const message = messageOverride ?? (hasFee ? handlerMsgA2({ token: outTok, feeTo, feeAmt: BigInt(feeAmtOverride ?? appRaw), user: msgUser, handler, adapter }) : "0x");
    const recipient = hasFee ? handler : AUSER;
    const data = depositIfaceA2.encodeFunctionData("deposit", [b32A2(AUSER), b32A2(recipient), b32A2(inTok), b32A2(outTok), BigInt(inAmt), BigInt(bridgeOut), BigInt(destChainId), b32A2("0x394311a6aaa0d8e3411d8b62de4578d41322d1bd"), 1794177000, 1794184200, 3, message]);
    const expected = (BigInt(bridgeOut) - BigInt(appRaw)).toString();
    const tokA2 = (address, symbol, decimals, chainId) => ({ decimals, symbol, address, name: symbol === "WETH" ? "Wrapped Ether" : "USD Coin", chainId });
    const feeTokIn = tokA2(inTok, inSym, inDec, originChainId), feeTokOut = tokA2(outTok, outSym, outDec, destChainId);
    return {
      crossSwapType: "bridgeableToBridgeable", amountType: "exactInput", id: "66-fixture",
      checks: { allowance: { token: inTok, spender: pool, actual: "0", expected: inAmt }, balance: { token: inTok, actual: "0", expected: inAmt } },
      approvalTxns: [{ chainId: originChainId, to: inTok, data: erc20A2.encodeFunctionData("approve", [pool, (2n ** 256n) - 1n]) }],
      steps: { bridge: { inputAmount: inAmt, outputAmount: bridgeOut, tokenIn: feeTokIn, tokenOut: feeTokOut } },
      inputToken: feeTokIn, outputToken: feeTokOut, refundToken: feeTokIn,
      fees: { total: { amount: (BigInt(bridgeRaw) + BigInt(appRaw)).toString(), amountUsd: String(Number(bridgeUsd) + Number(appUsd)), token: feeTokIn, details: {
        type: "total-breakdown",
        swapImpact: { amount: "-3", amountUsd: "-0.000003026793999966", token: feeTokIn },
        app: { amount: appRaw, amountUsd: appUsd, token: feeTokOut },
        bridge: { amount: bridgeRaw, amountUsd: bridgeUsd, token: feeTokIn },
      } } },
      inputAmount: inAmt, expectedOutputAmount: expected, minOutputAmount: expected, expectedFillTime: 2,
      swapTx: { to: pool, data, gas: 0, chainId: originChainId }, quoteExpiryTimestamp: 1994180911,
    };
  };
  const ARGS100_A2 = { fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC_A2, toTokenAddress: ARB_USDC_A2, fromAmount: "100000000", fromAddress: AUSER, toAddress: AUSER };
  const jsonResA2 = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });

  // Fee recipient + pin tables come from the live probes.
  ok("across: fee recipient is the Relay collection wallet (dripbot)", ACROSS_APP_FEE_RECIPIENT === AFEE && ACROSS_APP_FEE_RECIPIENT.toLowerCase() === "0x7fe638235fad0fdfbbcc759640d881e0fa62135b");
  ok("across: handler pins (Base/Arb family + Linea + zkSync + Avalanche)",
    ACROSS_HANDLERS[42161] === HANDLER_A2 && ACROSS_HANDLERS[8453] === HANDLER_A2
    && ACROSS_HANDLERS[59144] === "0xdf1c940487574eefa79989a79a4936a0f979cda2"
    && ACROSS_HANDLERS[324] === "0x68d3806e57148d6c6793c78ebddbc272fe605dbf"
    && ACROSS_HANDLERS[43114] === "0x9610954acdca5ff7905f051a040ce33fe613c60e");
  ok("across: message-adapter pins",
    ACROSS_MESSAGE_ADAPTERS[42161] === ADAPTER_A2 && ACROSS_MESSAGE_ADAPTERS[324] === "0x74a2966e23B61A360b1345eA359127aF325beC4C"
    && ACROSS_MESSAGE_ADAPTERS[43114] === "0x25b15Fc38d6A2C13FEDdD9cb51f184F7Cf0D4C11");

  // Eligibility matrix.
  const planUsdc = acrossSupportsPair(ARGS100_A2);
  ok("across: Base USDC → Arbitrum USDC is eligible", !!planUsdc && planUsdc.asset === "USDC" && planUsdc.inputToken === BASE_USDC_A2 && planUsdc.outputToken === ARB_USDC_A2 && planUsdc.nativeInput === false);
  const planWeth = acrossSupportsPair({ ...ARGS100_A2, fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: LIFI_NATIVE_TOKEN });
  ok("across: Base native → Arbitrum native maps to the WETH hub", !!planWeth && planWeth.asset === "WETH" && planWeth.nativeInput === true && planWeth.inputToken.toLowerCase() === "0x4200000000000000000000000000000000000006" && planWeth.outputToken.toLowerCase() === "0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
  const planBsc = acrossSupportsPair({ fromChainKey: "bsc", toChainKey: "base", fromTokenAddress: BSC_USDC_A2, toTokenAddress: BASE_USDC_A2, fromAmount: "100000000000000000000", fromAddress: AUSER, toAddress: AUSER });
  ok("across: BSC Binance-Peg USDC → Base USDC is eligible (peg pin)", !!planBsc && planBsc.inputToken === BSC_USDC_A2);
  ok("across: uncovered chain (Scroll) is ineligible", acrossSupportsPair({ ...ARGS100_A2, toChainKey: "scroll" }) === null);
  ok("across: different assets (USDC → USDT) are ineligible", acrossSupportsPair({ ...ARGS100_A2, toTokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" }) === null);
  ok("across: same chain is ineligible (Across is cross-chain only)", acrossSupportsPair({ ...ARGS100_A2, toChainKey: "base", toTokenAddress: BASE_USDC_A2 }) === null);
  ok("across: non-EVM source (Sui) is ineligible", acrossSupportsPair({ ...ARGS100_A2, fromChainKey: "sui" }) === null);
  ok("across: WETH → Avalanche is ineligible (no WETH hub there)", acrossSupportsPair({ ...ARGS100_A2, fromTokenAddress: LIFI_NATIVE_TOKEN, toChainKey: "avalanche" }) === null);
  ok("across: Polygon native (POL) is not an ETH-hub source", acrossSupportsPair({ fromChainKey: "polygon", toChainKey: "base", fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: LIFI_NATIVE_TOKEN, fromAmount: "1", fromAddress: AUSER, toAddress: AUSER }) === null);

  // Quote request shape: appFee is a decimal fraction, only when set.
  const paramsFree = buildAcrossQuoteParams(ARGS100_A2, planUsdc);
  ok("across: fee-free params carry no appFee", !paramsFree.has("appFee") && !paramsFree.has("appFeeRecipient") && paramsFree.get("tradeType") === "exactInput" && paramsFree.get("originChainId") === "8453" && paramsFree.get("destinationChainId") === "42161");
  const paramsFee = buildAcrossQuoteParams(ARGS100_A2, planUsdc, { appFeeFraction: 0.001 });
  ok("across: fee params carry the fraction + collection recipient", paramsFee.get("appFee") === "0.001" && paramsFee.get("appFeeRecipient") === AFEE);

  // Fee-free parse: honest pricing from the bridge-fee component.
  const freeRoute = parseAcrossQuote(acrossQuoteA2(), ARGS100_A2, planUsdc);
  ok("across: fee-free quote parses to a route", !!freeRoute && freeRoute.provider === "across" && freeRoute.toAmount === "99972867");
  ok("across: route cost = bridge fee USD (+ impact)", !!freeRoute && Math.abs(freeRoute.routeFeeUsd - 0.027121577) < 1e-6);
  ok("across: implied input value from the bridge price", !!freeRoute && Math.abs(freeRoute.fromAmountUSD - 99.9582) < 0.01);
  ok("across: fee-free quote is not collecting", !!freeRoute && freeRoute.platformFeeCollecting === false && freeRoute.platformFeeRaw === "0");
  ok("across: parsed route is executable-shaped", !!freeRoute && acrossExecutableSteps(freeRoute).length === 1 && swapRouteExecutable(freeRoute).ok === true && swapRouteExecutable(freeRoute).across === true);
  ok("across: the API's unlimited approvalTxns never reach the route", !!freeRoute && !("approvalTxns" in freeRoute.across) && !freeRoute.across.swapTx.data.includes("095ea7b3") && freeRoute.across.swapTx.data.startsWith("0xad5425c6"));

  // Fee-bearing parse: the charged fee comes from the final quote.
  const feeRoute = parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999" }), ARGS100_A2, planUsdc);
  ok("across: fee-bearing quote parses with its stated fee", !!feeRoute && feeRoute.platformFeeCollecting === true && feeRoute.platformFeeRaw === "99999" && Math.abs(feeRoute.platformFeeUsd - 0.0999) < 1e-9 && feeRoute.toAmount === "99872868");
  ok("across: fee-bearing route passes its bounds check", !!feeRoute && checkAcrossDepositBounds(feeRoute, AUSER).ok === true);
  // Tamper cases: any deviation from the pinned shape refuses.
  ok("across: fee amount mismatch refuses", parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999", feeAmtOverride: "100000" }), ARGS100_A2, planUsdc) === null);
  ok("across: fee paid to an attacker refuses", parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999", feeTo: "0x000000000000000000000000000000000000dEaD" }), ARGS100_A2, planUsdc) === null);
  ok("across: remainder delivered to an attacker refuses", parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999", msgUser: "0x000000000000000000000000000000000000dEaD" }), ARGS100_A2, planUsdc) === null);
  ok("across: unpinned handler refuses", parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999", handler: "0x000000000000000000000000000000000000dEaD" }), ARGS100_A2, planUsdc) === null);
  const zkCallsA2 = [[ARB_USDC_A2, erc20A2.encodeFunctionData("approve", [BASE_POOL_A2, 100n]), 0n]];
  const zkMsgA2 = coderA2.encode([INSTR_A2], [[zkCallsA2, AUSER]]);
  ok("across: zkSync-style composed message (approve + opaque) refuses → Relay fallback", parseAcrossQuote(acrossQuoteA2({ appRaw: "99999", appUsd: "0.0999", messageOverride: zkMsgA2 }), ARGS100_A2, planUsdc) === null);
  const mutated = feeRoute ? JSON.parse(JSON.stringify(feeRoute)) : null;
  if (mutated) mutated.across.swapTx.to = "0x000000000000000000000000000000000000dEaD";
  ok("across: deposit target ≠ quote's allowance spender refuses", !!mutated && checkAcrossDepositBounds(mutated, AUSER).ok === false);

  // Native WETH lane: route cost priced off the bridge fee.
  const wethQuote = acrossQuoteA2({ inTok: "0x4200000000000000000000000000000000000006", outTok: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", inSym: "WETH", outSym: "WETH", inDec: 18, outDec: 18, inAmt: "50000000000000000", bridgeOut: "49967973172748906", bridgeRaw: "32026827251094", bridgeUsd: "0.106" });
  const wethRoute = parseAcrossQuote(wethQuote, { ...ARGS100_A2, fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: LIFI_NATIVE_TOKEN, fromAmount: "50000000000000000" }, planWeth);
  ok("across: native WETH lane parses with nativeInput + priced cost", !!wethRoute && wethRoute.across.nativeInput === true && Math.abs(wethRoute.routeFeeUsd - 0.106) < 0.002);

  // BSC 18-decimal peg → Base 6-decimal USDC: same-asset identity pricing.
  const bscQuote = acrossQuoteA2({ inTok: BSC_USDC_A2, outTok: BASE_USDC_A2, inDec: 18, outDec: 6, inAmt: "100000000000000000000", bridgeOut: "99982054", bridgeRaw: "17900000000000000", bridgeUsd: "0.0179", originChainId: 56, destChainId: 8453, pool: BSC_POOL_A2 });
  const bscRoute = parseAcrossQuote(bscQuote, { fromChainKey: "bsc", toChainKey: "base", fromTokenAddress: BSC_USDC_A2, toTokenAddress: BASE_USDC_A2, fromAmount: "100000000000000000000", fromAddress: AUSER, toAddress: AUSER }, planBsc);
  ok("across: BSC peg decimals priced by the same-asset identity", !!bscRoute && Math.abs(bscRoute.fromAmountUSD - 100) < 0.01 && Math.abs(bscRoute.toAmountUSD - 99.982054) < 1e-6 && Math.abs(bscRoute.routeFeeUsd - 0.017946) < 1e-6);

  // Two-pass fee law over a stubbed wire: pass 1 fee-free, the law
  // prices 4 × $0.027121577 route cost capped by the $0.20 EVM
  // ceiling → 10 bps of the ~$99.96 input; pass 2 asks Across for
  // that fee as a fraction of the expected OUTPUT and the disclosed
  // fee is the final quote's own app component.
  {
    const realFetch = globalThis.fetch;
    let acrossCalls = 0, firstHadFee = null, secondFraction = null;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (!u.includes("app.across.to")) throw new Error("unexpected fetch in across two-pass stub: " + u);
      acrossCalls++;
      if (!u.includes("appFee=")) { firstHadFee = false; return jsonResA2(acrossQuoteA2()); }
      firstHadFee = firstHadFee ?? true;
      const frac = Number(new URL(u).searchParams.get("appFee"));
      secondFraction = frac;
      const appRaw = String(Math.floor(frac * 99972867));
      const appUsd = String(Number(appRaw) * (0.027121577007 / 27133));
      return jsonResA2(acrossQuoteA2({ appRaw, appUsd }));
    };
    try {
      const viaAcross = await getSwapRoutes(ARGS100_A2);
      ok("across: dispatcher returns the Across route as primary", viaAcross.length === 1 && viaAcross[0].provider === "across" && acrossCalls === 2);
      ok("across: pass 1 is fee-free, pass 2 carries the fraction", firstHadFee === false && secondFraction !== null && secondFraction >= 0.00099 && secondFraction <= 0.00101);
      ok("across: fee law applied (4× route cost = 10 bps at $100)", viaAcross[0].platformFeeBps === 10 && viaAcross[0].platformFeeUsd >= 0.095 && viaAcross[0].platformFeeUsd <= 0.1005 && viaAcross[0].platformFeeCollecting === true);
    } finally { globalThis.fetch = realFetch; }
  }

  // Fallbacks: Across 429 → Relay serves; Across-ineligible pairs
  // never touch the Across API at all.
  const relayQuoteMinA2 = () => ({ requestId: "0x66", steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: AUSER, to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0x12345678", value: "0", chainId: 8453 } }] }],
    fees: { gas: { amountUsd: "0.001" }, app: { amount: "0", amountUsd: "0" } },
    details: { sender: AUSER, recipient: AUSER, currencyIn: { currency: { chainId: 8453, address: BASE_USDC_A2, symbol: "USDC", decimals: 6 }, amount: "100000000", amountUsd: "100.0" }, currencyOut: { currency: { chainId: 42161, address: ARB_USDC_A2, symbol: "USDC", decimals: 6 }, amount: "99965000", amountUsd: "99.965", minimumAmount: "99000000" }, timeEstimate: 1 } });
  {
    const realFetch = globalThis.fetch;
    let acrossCalls = 0;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("app.across.to")) { acrossCalls++; return jsonResA2({ message: "Too Many Requests" }, false, 429); }
      if (u.includes("api.relay.link/quote")) return jsonResA2(relayQuoteMinA2());
      throw new Error("unexpected fetch in across-429 stub: " + u);
    };
    try {
      const viaRelay = await getSwapRoutes(ARGS100_A2);
      ok("across: 429 falls through to Relay", viaRelay.length === 1 && viaRelay[0].provider === "relay" && acrossCalls === 1);
    } finally { globalThis.fetch = realFetch; }
    acrossCalls = 0;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("app.across.to")) { acrossCalls++; return jsonResA2(acrossQuoteA2()); }
      if (u.includes("api.relay.link/quote")) return jsonResA2(relayQuoteMinA2());
      throw new Error("unexpected fetch in across-assets stub: " + u);
    };
    try {
      const mixed = await getSwapRoutes({ ...ARGS100_A2, toTokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" });
      ok("across: different-asset pair skips Across, Relay serves", mixed.length === 1 && mixed[0].provider === "relay" && acrossCalls === 0);
    } finally { globalThis.fetch = realFetch; }
  }

  // Review sentence + app wiring.
  const intentA2 = formatSwapIntent({ fromAmount: "100", fromSymbol: "USDC", fromNetKey: "base", toAmount: "99.87", toSymbol: "USDC", toNetKey: "arbitrum", toolName: "Across", feeUsd: 0.0271, durationSec: 2, platformFeeUsd: 0.0999, platformFeePct: 0.1 });
  ok("across: intent sentence names Across + the fee",
    intentA2.includes("via Across") && intentA2.includes("Fluid fee: $0.10") && intentA2.includes("Funds should arrive in about 2 seconds"));
  const appSrcAcross = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("across: app names the router, discloses its fee, notes the refund, and executes it",
    appSrcAcross.includes('if (route && route.provider === "across") return "Across";')
    && appSrcAcross.includes('r.provider === "across" && r.platformFeeCollecting === true')
    && appSrcAcross.includes("refunded automatically to this same wallet")
    && appSrcAcross.includes("executeAcrossSwapRoute(wallet, route"));
  const coreSrcAcross = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("across: bounds check precedes signing in the executor",
    coreSrcAcross.indexOf("checkAcrossDepositBounds(route, wallet.address)") > -1
    && coreSrcAcross.indexOf("checkAcrossDepositBounds(route, wallet.address)") < coreSrcAcross.indexOf("await signer.sendTransaction(txReq)", coreSrcAcross.indexOf("async function executeAcrossSwapRoute")));
  ok("across: executor composes its own exact-amount approval",
    coreSrcAcross.includes("c.approve(ac.swapTx.to, need)"));
}

// 67. Satora: EVM stablecoins -> Bitcoin mainnet / Lightning
// (2026-11-08, Immediate Incorporation Rule). REST composed by
// Fluid (never the SDK — its separate mnemonic is replaced by
// derivation from the user's own Fluid seed), version headers
// pinned (x-satora-evm-erc20-htlc-version 7, bitcoin 1, lightning
// 1; GET /version tag epoch checked), fee via the developer key's
// extra_fees read through satoraFeeConfig (placeholder key ->
// quotes at zero fee), minimums enforced on the NET landing,
// receivability gate for the user's own Lightning wallet, refund
// truth in the review sentence, swap ids persisted + polled.
// Funding was gated OFF while the Permit2 witness format was
// unpublished (a plain PermitTransferFrom signature provably
// fails with InvalidSigner — Fluid does not sign what it cannot
// verify); the official spec arrived 2026-11-09, the developer
// key went live the same day, and §69 covers the un-gated
// execution end to end. Fixtures mirror the live probes of
// 2026-11-08 (quotes, a real creation record, a real Permit2
// funding payload whose calls_hash Fluid's recomputation must
// reproduce byte-for-byte).
{
  const AUSER_S7 = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  const PHRASE_S7 = "legal winner thank year wave sausage worth useful legal winner thank yellow";
  const ARB_USDC_S7 = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const POL_USDC_S7 = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
  const BTC_USD_S7 = 74414;
  const jsonResS7 = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const pairsS7 = [
    { source: "42161", target: "Lightning", min_sats: 356, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "42161", target: "Bitcoin", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "137", target: "Bitcoin", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "137", target: "Lightning", min_sats: 356, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "1", target: "Bitcoin", min_sats: 10000, max_sats: 25000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "1", target: "Lightning", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
  ];
  const quoteLnS7 = (o = {}) => ({ exchange_rate: "74255.587732976906512215044182", network_fee: 4, gasless_network_fee: 4, protocol_fee: 134, protocol_fee_rate: 0.005, min_amount: 356, max_amount: 20000000, source_amount: "20000000", target_amount: "26934", net_source_amount: "20000000", net_target_amount: "26796", ...o });
  const quoteBtc20S7 = (o = {}) => ({ exchange_rate: "74630.764293657131342682080407", network_fee: 159, gasless_network_fee: 159, protocol_fee: 134, protocol_fee_rate: 0.005, min_amount: 10000, max_amount: 20000000, source_amount: "20000000", target_amount: "26726", net_source_amount: "20000000", net_target_amount: "26433", ...o });
  const quoteBtc100S7 = (o = {}) => ({ exchange_rate: "74630.764293657131342682080407", network_fee: 159, gasless_network_fee: 159, protocol_fee: 669, protocol_fee_rate: 0.005, min_amount: 10000, max_amount: 20000000, source_amount: "100000000", target_amount: "133993", net_source_amount: "100000000", net_target_amount: "133165", ...o });
  // The real creation record captured live (Polygon USDC $20 ->
  // BTC), with the probe's hash lock / claim key swapped for the
  // test wallet's derived ones.
  // One shared future locktime for the S7 creation + Permit2
  // fixtures (the captured record's real locktime expired on
  // 2026-11-09; the two fixtures must agree to the second).
  const LOCKTIME_S7 = Math.floor(Date.now() / 1000) + 86400;
  const createBtcS7 = ({ hashLock, claimPkXonly }) => ({
    id: "f8367eae-cc13-4062-be55-4b1b2a569e7e", status: "pending", fee_sats: 427,
    evm_hash_lock: hashLock, btc_hash_lock: "d6770bf184e0f3af2451bdeade083e25275c67c9",
    source_token: { token_id: POL_USDC_S7, symbol: "USDC", chain: "137", name: "USDC", decimals: 6 },
    target_token: { token_id: "btc", symbol: "BTC", chain: "Bitcoin", name: "Bitcoin", decimals: 8 },
    created_at: "2026-11-08T23:05:12.437373Z", chain: "Polygon", evm_chain_id: 137,
    source_amount: "20000000", evm_expected_sats: "26726", target_amount: "26299",
    evm_htlc_address: "0x6C38bF44A327bf36BfbeFcedc514c0FB3Fec6748", evm_htlc_version: 7, evm_htlc_kind: "erc20",
    evm_coordinator_address: "0xb79118233552d4b7eD5c8D2d1E2BbA7e8eecb71f",
    client_evm_address: "0x0877999faBfDEd6ADBa3A97A3B46159d2F6A2F6B", server_evm_address: "0x5ce278AAec6d9fa67bFcaF98512fE5175dFEebac",
    evm_fund_txid: null, evm_claim_txid: null, evm_refund_locktime: LOCKTIME_S7, evm_funding_confirmations: 128,
    btc_htlc_address: "bc1pnwvn0aqxhr0pa403rncxqdas9e7ddwetp0qg79avqae7u7u2w68q4v39t2",
    btc_user_claim_pk: claimPkXonly, btc_server_refund_pk: "75653010502f8aa3c4548eb589c094503b7f03bbceb0cf13d872f58db9fed633",
    btc_refund_locktime: 1794222312, btc_htlc_script_version: 1, btc_fund_txid: null, btc_fund_vout: null, btc_claim_txid: null,
    wbtc_address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", target_btc_address: null, network: "bitcoin", gasless: true,
  });
  // The real Permit2 funding payload captured live for that swap;
  // its calls_hash is production data Fluid must reproduce.
  const CALLS_S7 = [
    { target: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", value: "0", call_data: "0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000001312d00" },
    { target: "0xe592427a0aece92de3edee1f18e0157c05861564", value: "0", call_data: "0xc04b8d59000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000b79118233552d4b7ed5c8d2d1e2bba7e8eecb71fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000001312d00000000000000000000000000000000000000000000000000000000000000674100000000000000000000000000000000000000000000000000000000000000423c499c542cef5e3811e1192ce70d8cc03d5c3359000064c2132d05d31c914a87c6611c10748aeb04b58e8f000bb81bfd67037b42cf73acf2047067bd4f2c47d9bfd6000000000000000000000000000000000000000000000000000000000000" },
  ];
  const permit2S7 = ({ hashLock }) => ({
    coordinator_address: "0xb79118233552d4b7ed5c8d2d1e2bba7e8eecb71f", htlc_kind: "erc20", htlc_version: 7,
    permit2_address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    source_token_address: POL_USDC_S7, source_amount: "20000000",
    lock_token_address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
    preimage_hash: hashLock, claim_address: "0x5ce278AAec6d9fa67bfcaf98512fe5175dfeebac", timelock: LOCKTIME_S7,
    calls: CALLS_S7, calls_hash: "0x1b865e45034d8be753a876eb72909104ca9cd22f663c82134ade2eafb04ea027",
  });
  // A Satora wire stub: routes by URL, records quote URLs + create
  // bodies, and throws on anything unexpected.
  const satoraStubS7 = ({ quote, pairs = pairsS7, version = { tag: "developer-portal-v0.1.12", commit_hash: "e869e8a73020c8d33f57c6d346f95c92f0f901ab" }, status = { healthy: true, swaps_paused: false }, create = null, swapGet = null, permit2 = null, seen = { quotes: [], creates: [] } }) => async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("api.binance.com")) return jsonResS7([{ symbol: "BTCUSDT", price: String(BTC_USD_S7) }, { symbol: "ETHUSDT", price: "3000" }]);
    if (u.includes("api.coingecko.com")) return jsonResS7({});
    if (u.includes("api.satora.io/version")) return jsonResS7(version);
    if (u.includes("api.satora.io/status")) return jsonResS7(status);
    if (u.includes("api.satora.io/swap-pairs")) return jsonResS7(pairs);
    if (u.includes("api.satora.io/quote")) {
      seen.quotes.push(u);
      const base = typeof quote === "function" ? quote(new URL(u)) : quote;
      const extra = Number(new URL(u).searchParams.get("extra_fees") || 0);
      // Object fixtures are fee-free quotes; the live server
      // answers a fee-bearing pass by FOLDING the extra fee into
      // protocol_fee (and its rate) and deducting it from the
      // net — reproduce that shape here. Function fixtures shape
      // their own passes.
      if (typeof quote !== "function" && extra > 0) {
        // Scale the fixture's own protocol fee by extra/base
        // rate (at the usual 50-on-50 it exactly doubles, as the
        // live $20 pair did: 134 -> 268).
        const extraSats = Math.round(Number(base.protocol_fee) * extra / (Number(base.protocol_fee_rate) * 10000));
        return jsonResS7({ ...base, protocol_fee: Number(base.protocol_fee) + extraSats, protocol_fee_rate: Number(base.protocol_fee_rate) + extra / 10000, net_target_amount: String(Number(base.net_target_amount) - extraSats) });
      }
      return jsonResS7(base);
    }
    if (u.includes("api.satora.io/swap/evm/")) { seen.creates.push(JSON.parse(opts.body || "{}")); return jsonResS7(create); }
    if (u.includes("swap-and-lock-calldata-permit2")) return jsonResS7(permit2);
    if (u.includes("api.satora.io/swap/")) return jsonResS7(swapGet);
    throw new Error("unexpected fetch in satora stub: " + u);
  };
  const ARGS_BTC100_S7 = { fromChainKey: "polygon", toChainKey: "bitcoin", fromTokenAddress: POL_USDC_S7, toTokenAddress: "btc", fromAmount: "100000000", fromAddress: AUSER_S7, toAddress: "bc1pnwvn0aqxhr0pa403rncxqdas9e7ddwetp0qg79avqae7u7u2w68q4v39t2" };
  const ARGS_BTC20_S7 = { ...ARGS_BTC100_S7, fromAmount: "20000000" };

  // Developer key: LIVE (issued 2026-11-09, extra fee enabled at
  // a 50 bps cap). The placeholder branch survives in
  // satoraFeeConfig and is covered through its seam (an explicit
  // key argument) — never by editing the live constant.
  ok("satora: developer key is the live referral id", SATORA_DEVELOPER_KEY === "lnds_1f58b4d6016ca9fc" && satoraDeveloperKeyLive() === true);
  ok("satora: live fee config names the referral and passes the bps through", (() => { const f = satoraFeeConfig(50); return f.referralCode === SATORA_DEVELOPER_KEY && f.extraFeesBps === 50; })());
  ok("satora: placeholder fee config charges nothing and names no referral (seam)", (() => { const f = satoraFeeConfig(50, "PENDING_KEY"); return f.referralCode === null && f.extraFeesBps === 0 && satoraDeveloperKeyLive("PENDING_KEY") === false; })());
  ok("satora: minimums are the evidenced ones", SATORA_MIN_NET_SATS.bitcoin === 10000 && SATORA_MIN_NET_SATS.lightning === 356);

  // Eligibility matrix (pure). Base + Solana USDC joined the
  // evidenced sources with the CCTP bridge (2026-11-09); their
  // full matrix lives in §71.
  ok("satora: pair eligibility (evidenced sources only)",
    !!satoraSupportsPair(ARGS_BTC100_S7)
    && !!satoraSupportsPair({ fromChainKey: "arbitrum", toChainKey: "lightning", fromTokenAddress: ARB_USDC_S7 })
    && !!satoraSupportsPair({ fromChainKey: "ethereum", toChainKey: "bitcoin", fromTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" })
    && !!satoraSupportsPair({ ...ARGS_BTC100_S7, fromChainKey: "base", fromTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" })
    && satoraSupportsPair({ ...ARGS_BTC100_S7, toChainKey: "arbitrum" }) === null
    && satoraSupportsPair({ ...ARGS_BTC100_S7, fromChainKey: "solana" }) === null
    && satoraSupportsPair({ ...ARGS_BTC100_S7, fromTokenAddress: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" }) === null);

  // Quote parsing: a fee-free quote accounts for its own
  // deductions exactly (protocol + network, ±1 sat of rounding);
  // an unexplained deduction in a single quote is NOT attributed
  // to Fluid — under the live folded shape it cannot be told
  // apart from a folded protocol fee.
  const planLnS7 = satoraSupportsPair({ fromChainKey: "arbitrum", toChainKey: "lightning", fromTokenAddress: ARB_USDC_S7 });
  const parsedLnS7 = parseSatoraQuote(quoteLnS7(), planLnS7, { fromAmount: "20000000" });
  ok("satora: LN quote parses with the full fee stack", !!parsedLnS7 && parsedLnS7.grossSats === 26934 && parsedLnS7.netSats === 26796 && parsedLnS7.protocolFeeSats === 134 && parsedLnS7.networkFeeSats === 4 && parsedLnS7.fluidFeeSats === 0);
  ok("satora: an unexplained deduction in a fee-free quote is refused, not attributed",
    parseSatoraQuote(quoteLnS7({ net_target_amount: "26662" }), planLnS7, { fromAmount: "20000000" }) === null);
  ok("satora: inconsistent or mismatched quotes are refused",
    parseSatoraQuote(quoteLnS7({ net_target_amount: "27000" }), planLnS7, { fromAmount: "20000000" }) === null
    && parseSatoraQuote(quoteLnS7({ protocol_fee: 500, net_target_amount: "26430" }), planLnS7, { fromAmount: "20000000" }) === null
    && parseSatoraQuote(quoteLnS7(), planLnS7, { fromAmount: "999" }) === null);

  // The LIVE folded shape (probed 2026-11-09, $20 Arbitrum USDC
  // -> Bitcoin, live key): pass 1 (extra_fees=0) protocol_fee 134
  // at rate 0.005, network 160, net 26601 of gross 26895; pass 2
  // (extra_fees=50) protocol_fee 268 at rate 0.01 — the extra fee
  // FOLDED IN — network 160, net 26467. Fluid's fee exists only
  // as the differential, and the parser must recover exactly it:
  // protocol stays the pass-1 134, Fluid's fee is 134.
  const planBtcArbS7 = satoraSupportsPair({ fromChainKey: "arbitrum", toChainKey: "bitcoin", fromTokenAddress: ARB_USDC_S7 });
  const quoteLiveP1S7 = { exchange_rate: "74363.264547313627068228295222", network_fee: 160, gasless_network_fee: 0, protocol_fee: 134, protocol_fee_rate: 0.005, min_amount: 10000, max_amount: 20000000, source_amount: "20000000", target_amount: "26895", net_source_amount: "20000000", net_target_amount: "26601" };
  const quoteLiveP2S7 = { ...quoteLiveP1S7, protocol_fee: 268, protocol_fee_rate: 0.01, net_target_amount: "26467" };
  const parsedLiveP1S7 = parseSatoraQuote(quoteLiveP1S7, planBtcArbS7, { fromAmount: "20000000" });
  const parsedLiveP2S7 = parseSatoraQuote(quoteLiveP2S7, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7);
  ok("satora: the live folded pass 2 recovers Fluid's fee differentially (protocol 134, network 160, Fluid 134)",
    !!parsedLiveP1S7 && parsedLiveP1S7.fluidFeeSats === 0
    && !!parsedLiveP2S7 && parsedLiveP2S7.protocolFeeSats === 134 && parsedLiveP2S7.networkFeeSats === 160 && parsedLiveP2S7.fluidFeeSats === 134 && parsedLiveP2S7.netSats === 26467 && parsedLiveP2S7.grossSats === 26895);
  ok("satora: one sat of quote drift between passes is tolerated",
    !!parseSatoraQuote({ ...quoteLiveP2S7, net_target_amount: "26466" }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7)
    && !!parseSatoraQuote({ ...quoteLiveP2S7, target_amount: "26896" }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7));
  ok("satora: an irreconcilable pass 2 is refused (net, gross, network and baseline guards)",
    parseSatoraQuote({ ...quoteLiveP2S7, net_target_amount: "26460" }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7) === null
    && parseSatoraQuote({ ...quoteLiveP2S7, target_amount: "26897" }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7) === null
    && parseSatoraQuote({ ...quoteLiveP2S7, network_fee: 162 }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7) === null
    && parseSatoraQuote(quoteLiveP2S7, planBtcArbS7, { fromAmount: "20000000" }, { ...parsedLiveP1S7, fluidFeeSats: 5 }) === null);
  // The live LIGHTNING shape (probed 2026-11-09, stable across
  // repeated probes): the fee-bearing pass RE-PRICES — gross
  // 26,900 -> 26,910 (+10) — so the net differential (125) is
  // the protocol differential (135) minus the gross drift,
  // exactly the accounting identity. The fee is still 135, the
  // protocol stays the pass-1 134, and a gross reprice beyond
  // 0.1% refuses even when the identity would balance.
  const quoteLiveLnP1S7 = { ...quoteLiveP1S7, network_fee: 4, target_amount: "26900", net_target_amount: "26762" };
  const quoteLiveLnP2S7 = { ...quoteLiveLnP1S7, protocol_fee: 269, protocol_fee_rate: 0.01, target_amount: "26910", net_target_amount: "26637" };
  const parsedLiveLnP1S7 = parseSatoraQuote(quoteLiveLnP1S7, planLnS7, { fromAmount: "20000000" });
  const parsedLiveLnP2S7 = parseSatoraQuote(quoteLiveLnP2S7, planLnS7, { fromAmount: "20000000" }, parsedLiveLnP1S7);
  ok("satora: the live Lightning reprice reconciles through the identity (Fluid 135, protocol 134)",
    !!parsedLiveLnP2S7 && parsedLiveLnP2S7.fluidFeeSats === 135 && parsedLiveLnP2S7.protocolFeeSats === 134 && parsedLiveLnP2S7.networkFeeSats === 4 && parsedLiveLnP2S7.netSats === 26637);
  ok("satora: a gross reprice beyond 0.1% between passes is refused even when the identity balances",
    parseSatoraQuote({ ...quoteLiveP2S7, target_amount: "27095", net_target_amount: "26667" }, planBtcArbS7, { fromAmount: "20000000" }, parsedLiveP1S7) === null);

  // Dispatcher: Satora serves its pairs; live key -> the
  // two-pass discipline (fee-free pass reads the route cost, the
  // law's bps rides the second pass, the disclosed fee is
  // recovered differentially). The stub server honours
  // extra_fees the way the real one does: at 50 bps it FOLDS
  // 669 sats into protocol_fee (669 -> 1338, rate 0.005 -> 0.01)
  // and deducts them from the net.
  {
    const realFetch = globalThis.fetch;
    const seen = { quotes: [], creates: [] };
    globalThis.fetch = satoraStubS7({ quote: (u) => u.searchParams.get("extra_fees") === "50" ? quoteBtc100S7({ protocol_fee: 1338, protocol_fee_rate: 0.01, net_target_amount: "132496" }) : quoteBtc100S7(), seen });
    try {
      resetSatoraCaches();
      const routes = await getSwapRoutes(ARGS_BTC100_S7);
      const r = routes[0];
      ok("satora: dispatcher returns the Satora route for Polygon USDC -> Bitcoin", routes.length === 1 && r.provider === "satora" && r.toAmount === "132496");
      ok("satora: fee stack priced from the final quote (protocol + network + Fluid's 669 sats)", Math.abs(r.gasCostUSD - 1497 * BTC_USD_S7 / 1e8) < 1e-9 && r.platformFeeBps === 50 && r.platformFeeCollecting === true && Math.abs(r.platformFeeUsd - 669 * BTC_USD_S7 / 1e8) < 1e-9);
      const q1 = new URL(seen.quotes[0]), q2 = new URL(seen.quotes[1]);
      ok("satora: two-pass quoting — pass 1 at extra_fees=0, the law's 50 bps on pass 2, both under the live referral", seen.quotes.length === 2 && q1.searchParams.get("extra_fees") === "0" && q2.searchParams.get("extra_fees") === "50" && q1.searchParams.get("target_chain") === "Bitcoin" && q1.searchParams.get("ref") === SATORA_DEVELOPER_KEY && q2.searchParams.get("ref") === SATORA_DEVELOPER_KEY);
      const ranked = rankSwapRoutes(routes, BTC_USD_S7);
      ok("satora: route ranks cheapest-first by net value", ranked[0].provider === "satora" && ranked[0].cheapest === true && Math.abs(ranked[0].netUsd - (ranked[0].toAmountUSD - ranked[0].gasCostUSD)) < 1e-9);
    } finally { globalThis.fetch = realFetch; }
  }
  {
    // The LIVE pair-list shape is an object wrapping the array
    // ({"pairs":[...]}); the bare array the fixtures above use
    // must keep working too.
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ pairs: { pairs: pairsS7 }, quote: quoteBtc100S7() });
    try {
      resetSatoraCaches();
      const routes = await getSwapRoutes(ARGS_BTC100_S7);
      ok("satora: the live object-wrapped pair list ({pairs:[...]}) serves routes", routes.length === 1 && routes[0].provider === "satora" && routes[0].toAmount === "132496");
    } finally { globalThis.fetch = realFetch; }
  }
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: quoteLnS7() });
    try {
      resetSatoraCaches();
      const routes = await getSwapRoutes({ fromChainKey: "arbitrum", toChainKey: "lightning", fromTokenAddress: ARB_USDC_S7, toTokenAddress: "btc", fromAmount: "20000000", fromAddress: AUSER_S7, toAddress: "lnbc1example" });
      ok("satora: dispatcher returns the Satora route for Arbitrum USDC -> Lightning (fee-bearing net, Fluid fee itemised)",
        routes.length === 1 && routes[0].provider === "satora" && routes[0].toAmount === "26662" && routes[0].satora.fluidFeeSats === 134 && routes[0].satora.protocolFeeSats === 134 && Math.abs(routes[0].toAmountUSD - 26662 * BTC_USD_S7 / 1e8) < 1e-6);
    } finally { globalThis.fetch = realFetch; }
  }

  // Minimums enforced on the NET landing, with honest copy.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: (u) => u.searchParams.get("source_amount") === "20000"
      ? quoteLnS7({ source_amount: "20000", target_amount: "269", net_target_amount: "264", protocol_fee: 1 })
      : quoteBtc20S7({ source_amount: "5000000", target_amount: "6713", net_target_amount: "6521", protocol_fee: 33 }) });
    try {
      resetSatoraCaches();
      let lnErr = null, btcErr = null;
      try { await getSwapRoutes({ fromChainKey: "arbitrum", toChainKey: "lightning", fromTokenAddress: ARB_USDC_S7, toTokenAddress: "btc", fromAmount: "20000", fromAddress: AUSER_S7, toAddress: "lnbc1example" }); } catch (e) { lnErr = e; }
      try { await getSwapRoutes({ ...ARGS_BTC20_S7, fromAmount: "5000000" }); } catch (e) { btcErr = e; }
      ok("satora: Lightning net below 356 sats is refused with the minimum stated", !!lnErr && lnErr.message.includes("356-sat minimum"));
      ok("satora: Bitcoin net below 10,000 sats is refused with the minimum stated", !!btcErr && btcErr.message.includes("10,000-sat minimum"));
    } finally { globalThis.fetch = realFetch; }
  }

  // BTC-floor way-through: the sub-floor Bitcoin refusal carries the
  // structured marker (so the swap sheet can offer the alternative
  // without string parsing) and attributes the floor to the swap
  // route; the SAME amount quotes live to Lightning.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: (u) => {
      const chain = u.searchParams.get("target_chain");
      if (u.searchParams.get("source_amount") === "20000000")
        return chain === "Bitcoin" ? quoteBtc20S7() : quoteLnS7();
      return chain === "Bitcoin"
        ? quoteBtc20S7({ source_amount: "5000000", target_amount: "6713", net_target_amount: "6521", protocol_fee: 33 })
        : quoteLnS7({ source_amount: "5000000", target_amount: "6713", net_target_amount: "6676", protocol_fee: 33 });
    } });
    try {
      resetSatoraCaches();
      let btcErr = null;
      try { await getSwapRoutes({ ...ARGS_BTC20_S7, fromAmount: "5000000" }); } catch (e) { btcErr = e; }
      ok("satora: sub-floor Bitcoin refusal carries the way-through marker {destKey, netSats, minSats}",
        !!btcErr && !!btcErr.satoraBelowFloor && btcErr.satoraBelowFloor.destKey === "bitcoin"
        && btcErr.satoraBelowFloor.netSats === 6521 && btcErr.satoraBelowFloor.minSats === 10000);
      ok("satora: sub-floor Bitcoin refusal attributes the floor to the route and names Lightning",
        !!btcErr && btcErr.message.includes("10,000-sat minimum") && btcErr.message.includes("route") && btcErr.message.includes("Lightning"));
      const lnRoutes = await getSwapRoutes({ ...ARGS_BTC20_S7, fromAmount: "5000000", toChainKey: "lightning", toAddress: "lnbc1example" });
      ok("satora: the identical $5 amount quotes live to Lightning (the way-through exists)",
        lnRoutes.length === 1 && lnRoutes[0].provider === "satora");
      const btc20 = await getSwapRoutes(ARGS_BTC20_S7);
      ok("satora: above-floor $20 Bitcoin target still returns the Bitcoin route (no way-through needed)",
        btc20.length === 1 && btc20[0].provider === "satora");
    } finally { globalThis.fetch = realFetch; }
  }

  // BTC-floor way-through: app source pins + the no-implied-Fluid-
  // minimum audit — every line in app/core stating a minimum or
  // at-least bound that touches Bitcoin/BTC/sats must attribute the
  // floor to the swap route or to channel size, never to Fluid or
  // to Bitcoin itself.
  {
    const coreSrcPin = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    const appSrcPin = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    ok("btc-floor: the swap sheet intercepts the marker and offers the Lightning way-through",
      appSrcPin.includes("satoraBelowFloor") && appSrcPin.includes("Swap to Lightning instead")
      && appSrcPin.includes("not a Fluid minimum") && appSrcPin.includes("searchRoutes"));
    const unattributed = (src) => src.split("\n").filter(l => /(minimum|at least)/i.test(l) && /(bitcoin|btc|sats)/i.test(l) && !/(route|Channel)/.test(l));
    ok("btc-floor: no line states a Bitcoin/sats minimum without route or channel attribution",
      unattributed(appSrcPin).length === 0 && unattributed(coreSrcPin).length === 0);
  }

  // Version pinning: unknown epoch refuses; failures are not cached.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: quoteBtc100S7(), version: { tag: "developer-portal-v9.9.9", commit_hash: "deadbeef" } });
    try {
      resetSatoraCaches();
      let vErr = null;
      try { await getSatoraSwapRoute(ARGS_BTC100_S7); } catch (e) { vErr = e; }
      ok("satora: an unknown API version epoch refuses the route", !!vErr && vErr.message.includes("refusing the route rather than improvising"));
      let routes = null, fellThrough = false;
      try { routes = await getSwapRoutes(ARGS_BTC100_S7); } catch { fellThrough = true; }
      ok("satora: version refusal falls back (no Satora route is served)", fellThrough || !routes.some(r => r.provider === "satora"));
    } finally { globalThis.fetch = realFetch; }
    globalThis.fetch = satoraStubS7({ quote: quoteBtc100S7(), status: { healthy: true, swaps_paused: true } });
    try {
      resetSatoraCaches();
      let pErr = null;
      try { await getSatoraSwapRoute(ARGS_BTC100_S7); } catch (e) { pErr = e; }
      ok("satora: a paused service refuses the route", !!pErr && pErr.message.includes("paused"));
    } finally { globalThis.fetch = realFetch; }
  }

  // Secret derivation from the user's own Fluid seed (verified
  // independently against @scure/bip32 + noble sha256).
  const identityS7 = satoraSwapIdentity(PHRASE_S7, 0);
  const identity1S7 = satoraSwapIdentity(PHRASE_S7, 1);
  const nodeS7 = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE_S7)).derive("m/9419/121923");
  ok("satora: user_id is the m/9419/121923 child pubkey", identityS7.userId === Buffer.from(nodeS7.deriveChild(0).publicKey).toString("hex") && /^[0-9a-f]{66}$/.test(identityS7.userId));
  ok("satora: hash lock is sha256 of the derived secret (never a key itself)", identityS7.hashLock === "0x" + Buffer.from(nobleSha256(Buffer.from(identityS7.secretHex, "hex"))).toString("hex") && identityS7.secretHex !== Buffer.from(nodeS7.deriveChild(0).privateKey).toString("hex"));
  ok("satora: derivation is deterministic and per-index", satoraSwapIdentity(PHRASE_S7, 0).hashLock === identityS7.hashLock && identity1S7.userId !== identityS7.userId && identity1S7.hashLock !== identityS7.hashLock);
  const claimS7 = satoraClaimKey(PHRASE_S7);
  ok("satora: claim key is the wallet's own Taproot key", claimS7.address === bitcoinTaprootAddress(PHRASE_S7) && /^[0-9a-f]{66}$/.test(claimS7.claimPk) && claimS7.address.startsWith("bc1p"));

  // Creation request builders: fee fields identical (absent) on
  // quote and creation while the key is the placeholder.
  const btcBodyS7 = buildSatoraBtcCreateRequest({ route: { fromChainId: 137, fromToken: { address: POL_USDC_S7 }, fromAmount: "20000000", satora: { destKey: "bitcoin", destInput: ARGS_BTC20_S7.toAddress, extraFeesBps: 0 } }, userAddress: AUSER_S7, identity: identityS7, claimPk: claimS7.claimPk });
  ok("satora: BTC creation body carries our hash lock, claim key, script version 1", btcBodyS7.hash_lock === identityS7.hashLock && btcBodyS7.claim_pk === claimS7.claimPk && btcBodyS7.btc_htlc_script_version === 1 && btcBodyS7.user_id === identityS7.userId && btcBodyS7.amount_in === "20000000");
  ok("satora: creation sends the live referral code with the route's extra_fees", btcBodyS7.referral_code === SATORA_DEVELOPER_KEY && btcBodyS7.extra_fees === 0);

  // A real invoice for the Lightning tests (Fluid's own encoder).
  const invPrivS7 = "0000000000000000000000000000000000000000000000000000000000000001";
  const invPayHashS7 = Buffer.from(nobleSha256(new TextEncoder().encode("satora-test-preimage"))).toString("hex");
  const invoiceS7 = encodeBolt11({ network: "bc", amountMsat: 26796000n, timestamp: Math.floor(Date.now() / 1000), privKey: invPrivS7, fields: [["p", invPayHashS7], ["s", Buffer.from(nobleSha256(new TextEncoder().encode("satora-test-secret"))).toString("hex")], ["d", "satora test"]] });
  const invPayeeS7 = Buffer.from(secp256k1.getPublicKey(Buffer.from(invPrivS7, "hex"))).toString("hex");
  const lnBodyS7 = buildSatoraLnCreateRequest({ route: { fromChainId: 42161, fromToken: { address: ARB_USDC_S7 }, fromAmount: "20000000", satora: { destKey: "lightning", destInput: invoiceS7, grossSats: 26934, extraFeesBps: 0 } }, userAddress: AUSER_S7, userId: identityS7.userId });
  ok("satora: LN creation body carries the invoice (no target amount needed) + the live referral at the route's 0 bps", lnBodyS7.lightning_invoice === invoiceS7 && !("target_amount_sats" in lnBodyS7) && lnBodyS7.referral_code === SATORA_DEVELOPER_KEY && lnBodyS7.extra_fees === 0);
  const lnAddrBodyS7 = buildSatoraLnCreateRequest({ route: { fromChainId: 42161, fromToken: { address: ARB_USDC_S7 }, fromAmount: "20000000", satora: { destKey: "lightning", destInput: "friend@example.com", grossSats: 26934, extraFeesBps: 0 } }, userAddress: AUSER_S7, userId: identityS7.userId });
  ok("satora: LN address creation carries the quoted gross target", lnAddrBodyS7.lightning_address === "friend@example.com" && lnAddrBodyS7.target_amount_sats === 26934);
  ok("satora: destination classification", classifySatoraLightningDestination(invoiceS7)?.kind === "invoice" && classifySatoraLightningDestination("friend@example.com")?.kind === "address" && classifySatoraLightningDestination("lnurl1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")?.kind === "lnurl" && classifySatoraLightningDestination("not a destination") === null);

  // Receivability gate.
  ok("satora: own channel-less Lightning wallet is blocked", checkSatoraLightningReceivability({ destInput: invoiceS7, ownNodeId: invPayeeS7, ownReceivableMsat: 0 }).ok === false
    && checkSatoraLightningReceivability({ destInput: invoiceS7, ownNodeId: invPayeeS7, ownReceivableMsat: 0 }).reason.includes("no inbound Lightning capacity"));
  ok("satora: own wallet with enough inbound capacity passes", checkSatoraLightningReceivability({ destInput: invoiceS7, ownNodeId: invPayeeS7, ownReceivableMsat: 26796000 }).ok === true);
  ok("satora: external invoices always pass the gate", checkSatoraLightningReceivability({ destInput: invoiceS7, ownNodeId: "02" + "ab".repeat(32), ownReceivableMsat: 0 }).ok === true
    && checkSatoraLightningReceivability({ destInput: "friend@example.com", ownNodeId: invPayeeS7, ownReceivableMsat: 0 }).ok === true);

  // Creation, end to end over the stub, + bounds-check tampering.
  {
    const realFetch = globalThis.fetch;
    const seen = { quotes: [], creates: [] };
    globalThis.fetch = satoraStubS7({ quote: quoteBtc20S7(), create: createBtcS7({ hashLock: identityS7.hashLock, claimPkXonly: claimS7.claimPk.slice(2) }), permit2: permit2S7({ hashLock: identityS7.hashLock }), seen });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS_BTC20_S7))[0];
      const record = await createSatoraSwap(route, { phrase: PHRASE_S7, index: 0, userAddress: AUSER_S7 });
      ok("satora: creation returns the persisted record (id is the recovery key)", record.id === "f8367eae-cc13-4062-be55-4b1b2a569e7e" && record.status === "pending" && record.hashLock === identityS7.hashLock && record.netSats === 26299 && record.feeSats === 427 && record.protocolFeeSats === 134 && record.networkFeeSats === 159 && record.fluidFeeSats === 134);
      ok("satora: the record carries the funding-verification facts (sold token, HTLC kind/version, no fund tx yet)", record.sourceTokenAddress === POL_USDC_S7 && record.htlcKind === "erc20" && record.htlcVersion === 7 && record.fundTxHash === null);
      ok("satora: the create body the server received was Fluid's own (live referral at the quote's 50 bps)", seen.creates.length === 1 && seen.creates[0].hash_lock === identityS7.hashLock && seen.creates[0].claim_pk === claimS7.claimPk && seen.creates[0].referral_code === SATORA_DEVELOPER_KEY && seen.creates[0].extra_fees === 50);
      const good = createBtcS7({ hashLock: identityS7.hashLock, claimPkXonly: claimS7.claimPk.slice(2) });
      ok("satora: creation bounds check accepts the faithful record", checkSatoraCreateResponse(route, good, { identity: identityS7, claimPk: claimS7.claimPk }).ok === true);
      ok("satora: creation with a foreign hash lock is refused", checkSatoraCreateResponse(route, { ...good, evm_hash_lock: "0x" + "ff".repeat(32) }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === false);
      ok("satora: creation with a foreign claim key is refused", checkSatoraCreateResponse(route, { ...good, btc_user_claim_pk: "aa".repeat(32) }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === false);
      ok("satora: creation fee within one sat of the quote attribution passes; beyond it is refused", checkSatoraCreateResponse(route, { ...good, fee_sats: 428 }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === true
        && checkSatoraCreateResponse(route, { ...good, fee_sats: 429 }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === false);
      // The server re-prices at creation (live: quote net
      // 26,467 -> creation target 26,459): a payout drift
      // inside 0.1% of the quoted net is the reviewed swap at a
      // moved rate; beyond it, a different swap — refused.
      ok("satora: creation payout drift inside 0.1% passes; beyond it is refused", checkSatoraCreateResponse(route, { ...good, target_amount: "26280" }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === true
        && checkSatoraCreateResponse(route, { ...good, target_amount: "26200" }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === false);
      ok("satora: creation on an unpinned HTLC version is refused", checkSatoraCreateResponse(route, { ...good, evm_htlc_version: 8 }, { identity: identityS7, claimPk: claimS7.claimPk }).ok === false);
      // Funding components: the live payload must verify, and its
      // calls_hash must recompute exactly.
      ok("satora: calls_hash recomputes byte-for-byte from the live payload", satoraCallsHash(CALLS_S7) === "0x1b865e45034d8be753a876eb72909104ca9cd22f663c82134ade2eafb04ea027");
      const comp = await fetchSatoraFundingComponents(record);
      ok("satora: funding components verify against the record", !!comp && checkSatoraFundingComponents(permit2S7({ hashLock: identityS7.hashLock }), record).ok === true);
      // A creation whose payout drifted inside tolerance: the
      // persisted record adopts the CREATION's target as its
      // net (the payout actually promised), not the quote's.
      globalThis.fetch = satoraStubS7({ quote: quoteBtc20S7(), create: { ...createBtcS7({ hashLock: identityS7.hashLock, claimPkXonly: claimS7.claimPk.slice(2) }), target_amount: "26290" }, permit2: permit2S7({ hashLock: identityS7.hashLock }), seen });
      resetSatoraCaches();
      const driftRoute = (await getSwapRoutes(ARGS_BTC20_S7))[0];
      const driftRecord = await createSatoraSwap(driftRoute, { phrase: PHRASE_S7, index: 0, userAddress: AUSER_S7 });
      ok("satora: the record adopts the creation's drifted target as its net", driftRecord.netSats === 26290 && driftRoute.satora.netSats === 26299);
      const tamperedCalls = [{ ...CALLS_S7[0] }, { ...CALLS_S7[1], call_data: CALLS_S7[1].call_data.slice(0, -2) + "ff" }];
      ok("satora: tampered funding calls fail the hash pin", checkSatoraFundingComponents({ ...permit2S7({ hashLock: identityS7.hashLock }), calls: tamperedCalls }, record).ok === false);
      const greedyApprove = new ethers.Interface(["function approve(address spender, uint256 amount)"]).encodeFunctionData("approve", [CALLS_S7[1].target, 20000001n]);
      const greedyCalls = [{ ...CALLS_S7[0], call_data: greedyApprove }, CALLS_S7[1]];
      const greedy = { ...permit2S7({ hashLock: identityS7.hashLock }), calls: greedyCalls, calls_hash: satoraCallsHash(greedyCalls) };
      ok("satora: an over-amount approval is refused even with a matching hash", checkSatoraFundingComponents(greedy, record).ok === false);
      ok("satora: a foreign coordinator is refused", checkSatoraFundingComponents({ ...permit2S7({ hashLock: identityS7.hashLock }), coordinator_address: "0x000000000000000000000000000000000000dEaD" }, record).ok === false);
    } finally { globalThis.fetch = realFetch; }
  }

  // Review sentence: full fee stack + destination + refund truth.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: quoteBtc100S7() });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS_BTC100_S7))[0];
      const intent = formatSatoraSwapIntent({ route, destInput: ARGS_BTC100_S7.toAddress });
      ok("satora: intent states the full fee stack in plain words", intent.includes("protocol fee 669 sats") && intent.includes("network fee 159 sats") && intent.includes("Fluid's fee 669 sats") && intent.includes("via Satora"));
      ok("satora: intent names the Taproot destination + the refund truth", intent.includes("Taproot address you claim from with your own Fluid key") && intent.includes("If this swap fails, the refund comes back as WBTC/tBTC, not USDC."));
      const feeRoute = { ...route, satora: { ...route.satora, fluidFeeSats: 372 } };
      ok("satora: intent discloses Fluid's fee when one is charged", formatSatoraSwapIntent({ route: feeRoute, destInput: ARGS_BTC100_S7.toAddress }).includes("Fluid's fee 372 sats"));
      const lnIntent = formatSatoraSwapIntent({ route: { ...route, satora: { ...route.satora, destKey: "lightning", netSats: 26796 } }, destInput: invoiceS7 });
      ok("satora: LN intent names the invoice amount + refund truth", lnIntent.includes("Lightning invoice for 26,796 sats") && lnIntent.includes("If this swap fails, the refund comes back as WBTC/tBTC, not USDC."));
    } finally { globalThis.fetch = realFetch; }
  }

  // Execution gate: structural since the witness spec landed
  // (2026-11-09) — a complete route passes, an incomplete one is
  // refused, and the executor's full verification chain runs at
  // execution time (§69 exercises it end to end).
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = satoraStubS7({ quote: quoteBtc100S7() });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS_BTC100_S7))[0];
      const gate = swapRouteExecutable(route);
      ok("satora: a complete route passes the structural gate", gate.ok === true && gate.satora === true);
      ok("satora: an incomplete Satora route is refused at the gate", swapRouteExecutable({ provider: "satora" }).ok === false && swapRouteExecutable({ provider: "satora", satora: { destKey: "bitcoin" } }).ok === false);
      let execErr = null;
      try { await executeSatoraSwapRoute({}, route); } catch (e) { execErr = e; }
      ok("satora: the executor refuses without storage (the swap id must persist before funding)", !!execErr && execErr.message.includes("persist the swap id"));
    } finally { globalThis.fetch = realFetch; }
  }

  // Status model + history copy + refund paths.
  ok("satora: status model maps refund paths honestly",
    satoraSwapPhase("serverwontfund").refundPath === "collaborative"
    && satoraSwapPhase("clientfundedserverrefunded").refundPath === "unilateral"
    && satoraSwapPhase("clientredeemed").terminal === true
    && satoraSwapPhase("expired").terminal === true
    && satoraSwapPhase("pending").refundPath === null);
  const histRecS7 = { id: "x", destKey: "bitcoin", fromSymbol: "USDC", fromAmount: "20000000", netSats: 26433, status: "serverwontfund", refundLocktime: 1794265512 };
  ok("satora: history line carries the refund truth + collaborative path",
    satoraSwapHistoryLine(histRecS7).includes("the refund comes back as WBTC/tBTC, not USDC") && satoraSwapHistoryLine(histRecS7).includes("collaborative refund"));
  ok("satora: history line for a unilateral refund names the timelock path",
    satoraSwapHistoryLine({ ...histRecS7, status: "clientfundedserverrefunded" }).includes("with your own key after the timelock"));

  // Persistence + polling resume from stored ids.
  {
    const realFetch = globalThis.fetch;
    const store = new Map();
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    saveSatoraSwapRecord(storage, { id: "id-1", index: 0, status: "pending", destKey: "bitcoin", fromSymbol: "USDC", fromAmount: "20000000", netSats: 26433 });
    saveSatoraSwapRecord(storage, { id: "id-2", index: 1, status: "clientredeemed", destKey: "lightning", fromSymbol: "USDC", fromAmount: "20000000", netSats: 26796 });
    ok("satora: records persist + the next derivation index follows", loadSatoraSwapRecords(storage).length === 2 && nextSatoraSwapIndex(loadSatoraSwapRecords(storage)) === 2);
    let polledIds = [];
    globalThis.fetch = async (url) => { const u = String(url); if (u.includes("api.satora.io/swap/")) { polledIds.push(u); return jsonResS7({ id: "id-1", status: "clientfunded" }); } throw new Error("unexpected fetch in satora poll stub: " + u); };
    try {
      const after = await pollSatoraSwapStatuses(storage);
      const rec1 = after.find(r => r.id === "id-1"), rec2 = after.find(r => r.id === "id-2");
      ok("satora: polling resumes from persisted ids and saves fresh statuses", rec1.status === "clientfunded" && rec2.status === "clientredeemed" && polledIds.length === 1 && loadSatoraSwapRecords(storage).find(r => r.id === "id-1").status === "clientfunded");
    } finally { globalThis.fetch = realFetch; }
  }

  // Non-Satora pairs are untouched: the dispatcher never calls
  // Satora for an EVM->EVM pair (Across 429 -> Relay serves, as §66).
  {
    const realFetch = globalThis.fetch;
    let satoraCalls = 0;
    const relayQuoteMinS7 = () => ({ requestId: "0x66", steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: AUSER_S7, to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0x12345678", value: "0", chainId: 8453 } }] }],
      fees: { gas: { amountUsd: "0.001" }, app: { amount: "0", amountUsd: "0" } },
      details: { sender: AUSER_S7, recipient: AUSER_S7, currencyIn: { currency: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }, amount: "100000000", amountUsd: "100.0" }, currencyOut: { currency: { chainId: 42161, address: ARB_USDC_S7, symbol: "USDC", decimals: 6 }, amount: "99965000", amountUsd: "99.965", minimumAmount: "99000000" }, timeEstimate: 1 } });
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("api.satora.io")) { satoraCalls++; throw new Error("satora must not be called for EVM pairs"); }
      if (u.includes("app.across.to")) return jsonResS7({ message: "Too Many Requests" }, false, 429);
      if (u.includes("api.relay.link/quote")) return jsonResS7(relayQuoteMinS7());
      throw new Error("unexpected fetch in satora isolation stub: " + u);
    };
    try {
      const viaRelay = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", toTokenAddress: ARB_USDC_S7, fromAmount: "100000000", fromAddress: AUSER_S7, toAddress: AUSER_S7 });
      ok("satora: EVM->EVM pairs never touch Satora and keep the existing order", viaRelay.length === 1 && viaRelay[0].provider === "relay" && satoraCalls === 0);
    } finally { globalThis.fetch = realFetch; }
  }

  // App wiring (source pins, as in sections 61/62/66).
  const appSrcSatora = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("satora: app offers Bitcoin/Lightning as destinations only, gates, reviews and polls",
    appSrcSatora.includes('const swapDestNets = [...swapNets, "bitcoin", "lightning"]')
    && appSrcSatora.includes("checkSatoraLightningReceivability({")
    && appSrcSatora.includes("formatSatoraSwapIntent({ route: r, destInput })")
    && appSrcSatora.includes("pollSatoraSwapStatuses(localStorage)")
    && appSrcSatora.includes('if (route && route.provider === "satora") return "Satora";'));
  const coreSrcSatora = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("satora: core pins the key constant, the version headers and the spec version",
    coreSrcSatora.includes('export const SATORA_DEVELOPER_KEY = "lnds_1f58b4d6016ca9fc"')
    && coreSrcSatora.includes('"x-satora-evm-erc20-htlc-version"')
    && coreSrcSatora.includes('"x-satora-bitcoin-htlc-version"')
    && coreSrcSatora.includes('"x-satora-lightning-version"')
    && coreSrcSatora.includes('SATORA_API_SPEC_VERSION = "0.3.23"'));
}

// 69. Satora Permit2 witness funding (2026-11-09): the official
// witness spec landed (Philipp, Satora — the format was
// unpublished when §67 gated execution off) and the developer
// key went live, so execution is un-gated. Typed data is
// constructed field by field from the spec and verified against
// the bounds-checked creation record + funding components
// before signing; the checked calls go to the fund-gasless
// relay unchanged. Golden vectors here are computed
// INDEPENDENTLY (manual EIP-712 struct hashing over the pinned
// type strings, noble keccak cross-checks), never through the
// code under test alone. Fixtures mirror §67's live captures.
{
  const PHRASE_S9 = "legal winner thank year wave sausage worth useful legal winner thank yellow";
  const POL_USDC_S9 = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
  const WBTC_S9 = "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6";
  const COORD_S9 = "0xb79118233552d4b7eD5c8D2d1E2BbA7e8eecb71f";
  const SERVER_EVM_S9 = "0x5ce278AAec6d9fa67bFcaF98512fE5175dFEebac";
  const HTLC_S9 = "0x6C38bF44A327bf36BfbeFcedc514c0FB3Fec6748";
  const PERMIT2_S9 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const TIMELOCK_S9 = Math.floor(Date.now() / 1000) + 86400;
  const BTC_USD_S9 = 74414;
  const FUND_TX_S9 = "0x" + "ab".repeat(32);
  const jsonResS9 = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const identityS9 = satoraSwapIdentity(PHRASE_S9, 0);
  const claimS9 = satoraClaimKey(PHRASE_S9);
  const CALLS_S9 = [
    { target: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", value: "0", call_data: "0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000001312d00" },
    { target: "0xe592427a0aece92de3edee1f18e0157c05861564", value: "0", call_data: "0xc04b8d59000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000b79118233552d4b7ed5c8d2d1e2bba7e8eecb71fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000001312d00000000000000000000000000000000000000000000000000000000000000674100000000000000000000000000000000000000000000000000000000000000423c499c542cef5e3811e1192ce70d8cc03d5c3359000064c2132d05d31c914a87c6611c10748aeb04b58e8f000bb81bfd67037b42cf73acf2047067bd4f2c47d9bfd6000000000000000000000000000000000000000000000000000000000000" },
  ];
  const permit2S9 = ({ hashLock, ...over } = {}) => ({
    coordinator_address: COORD_S9, htlc_kind: "erc20", htlc_version: 7,
    permit2_address: PERMIT2_S9,
    source_token_address: POL_USDC_S9, source_amount: "20000000",
    lock_token_address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
    preimage_hash: hashLock, claim_address: "0x5ce278AAec6d9fa67bfcaf98512fe5175dfeebac", timelock: TIMELOCK_S9,
    calls: CALLS_S9, calls_hash: "0x1b865e45034d8be753a876eb72909104ca9cd22f663c82134ade2eafb04ea027",
    ...over,
  });
  const recS9 = {
    id: "f8367eae-cc13-4062-be55-4b1b2a569e7e", destKey: "bitcoin", fromChainKey: "polygon",
    fromAmount: "20000000", hashLock: identityS9.hashLock, coordinatorAddress: COORD_S9,
    htlcAddress: HTLC_S9, serverEvmAddress: SERVER_EVM_S9, wbtcAddress: WBTC_S9,
    refundLocktime: TIMELOCK_S9, sourceTokenAddress: POL_USDC_S9, htlcKind: "erc20", htlcVersion: 7,
  };

  // Golden: the spec's type strings + witness typehash.
  ok("satora witness: the full type string is the spec's verbatim string",
    SATORA_PERMIT2_TYPE_STRING === "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,ExecuteAndCreate witness)ExecuteAndCreate(bytes32 preimageHash,address token,address claimAddress,address refundAddress,uint256 timelock,bytes32 callsHash)TokenPermissions(address token,uint256 amount)"
    && SATORA_WITNESS_TYPE_STRING === "ExecuteAndCreate(bytes32 preimageHash,address token,address claimAddress,address refundAddress,uint256 timelock,bytes32 callsHash)");
  ok("satora witness: typehash matches independent keccak computations (ethers + noble)",
    SATORA_WITNESS_TYPEHASH === ethers.keccak256(ethers.toUtf8Bytes(SATORA_WITNESS_TYPE_STRING))
    && SATORA_WITNESS_TYPEHASH === "0x" + Buffer.from(keccak_256(new TextEncoder().encode(SATORA_WITNESS_TYPE_STRING))).toString("hex"));

  // The refundAddress rule, branch by branch (spec + reference).
  const DEP_S9 = "0x1111111111111111111111111111111111111111";
  ok("satora witness: refund address rule — depositor-keyed deployments name the depositor",
    satoraPermitRefundAddress({ htlcKind: "erc20", htlcVersion: 7, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === DEP_S9
    && satoraPermitRefundAddress({ htlcKind: "erc20", htlcVersion: 9, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === DEP_S9
    && satoraPermitRefundAddress({ htlcKind: "native", htlcVersion: 2, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === DEP_S9);
  ok("satora witness: refund address rule — older deployments name the coordinator",
    satoraPermitRefundAddress({ htlcKind: "erc20", htlcVersion: 6, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === COORD_S9
    && satoraPermitRefundAddress({ htlcKind: "native", htlcVersion: 1, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === COORD_S9);
  ok("satora witness: refund address rule — unknown kind or missing version refuses (null), never guesses",
    satoraPermitRefundAddress({ htlcKind: "btc", htlcVersion: 7, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === null
    && satoraPermitRefundAddress({ htlcKind: "erc20", htlcVersion: undefined, depositor: DEP_S9, coordinatorAddress: COORD_S9 }) === null
    && satoraPermitRefundAddress({}) === null);

  // Nonces: CSPRNG uint256, unique per draw, in range.
  ok("satora witness: random nonces are in-range and unique per draw",
    (() => { const a = satoraRandomPermitNonce(), b = satoraRandomPermitNonce(); return a > 0n && a < (1n << 256n) && b > 0n && b !== a; })());

  // Builder: field-by-field mapping + the golden digest, computed
  // manually from the pinned strings (domain separator, struct
  // hashes, 0x1901 digest) — equality with the builder's digest
  // (ethers' encoder over the returned types) proves the types
  // encode to the spec's string and every field lands in place.
  const walletS9 = await unlockVault((await importVault(PHRASE_S9, "password123")).keystore, "password123");
  const NONCE_S9 = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
  const NOW_S9 = 1794260000, DEADLINE_S9 = NOW_S9 + SATORA_FUNDING_DEADLINE_SECS;
  const builtS9 = buildSatoraPermitTypedData({ comp: permit2S9({ hashLock: identityS9.hashLock }), record: recS9, depositor: walletS9.address, nonce: NONCE_S9, deadline: DEADLINE_S9, nowSec: NOW_S9 });
  ok("satora witness: builder accepts the faithful payload", builtS9.ok === true);
  ok("satora witness: domain is Permit2's own (no version, canonical contract, the swap's chain)",
    builtS9.domain.name === "Permit2" && builtS9.domain.chainId === 137 && builtS9.domain.verifyingContract === PERMIT2_S9 && !("version" in builtS9.domain));
  ok("satora witness: message maps every field per the spec's table",
    builtS9.message.permitted.token.toLowerCase() === POL_USDC_S9.toLowerCase() && builtS9.message.permitted.amount === 20000000n
    && builtS9.message.spender.toLowerCase() === COORD_S9.toLowerCase() && builtS9.message.nonce === NONCE_S9 && builtS9.message.deadline === BigInt(DEADLINE_S9)
    && builtS9.message.witness.preimageHash === identityS9.hashLock && builtS9.message.witness.token.toLowerCase() === WBTC_S9.toLowerCase()
    && builtS9.message.witness.claimAddress.toLowerCase() === SERVER_EVM_S9.toLowerCase()
    && builtS9.message.witness.timelock === BigInt(TIMELOCK_S9)
    && builtS9.message.witness.callsHash === "0x1b865e45034d8be753a876eb72909104ca9cd22f663c82134ade2eafb04ea027");
  ok("satora witness: on the pinned ERC-20 v7 the witness names the depositor as refund address", builtS9.message.witness.refundAddress === walletS9.address && builtS9.refundAddress === walletS9.address);
  {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const domainSep = ethers.keccak256(coder.encode(["bytes32", "bytes32", "uint256", "address"],
      [ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)")), ethers.keccak256(ethers.toUtf8Bytes("Permit2")), 137n, PERMIT2_S9]));
    const tpHash = ethers.keccak256(coder.encode(["bytes32", "address", "uint256"],
      [ethers.keccak256(ethers.toUtf8Bytes("TokenPermissions(address token,uint256 amount)")), POL_USDC_S9, 20000000n]));
    const witHash = ethers.keccak256(coder.encode(["bytes32", "bytes32", "address", "address", "address", "uint256", "bytes32"],
      [SATORA_WITNESS_TYPEHASH, identityS9.hashLock, ethers.getAddress(WBTC_S9.toLowerCase()), ethers.getAddress(SERVER_EVM_S9.toLowerCase()), walletS9.address, BigInt(TIMELOCK_S9), "0x1b865e45034d8be753a876eb72909104ca9cd22f663c82134ade2eafb04ea027"]));
    const structHash = ethers.keccak256(coder.encode(["bytes32", "bytes32", "address", "uint256", "uint256", "bytes32"],
      [ethers.keccak256(ethers.toUtf8Bytes(SATORA_PERMIT2_TYPE_STRING)), tpHash, ethers.getAddress(COORD_S9.toLowerCase()), NONCE_S9, BigInt(DEADLINE_S9), witHash]));
    const manualDigest = ethers.keccak256(ethers.concat(["0x1901", domainSep, structHash]));
    ok("satora witness: the digest equals the independently constructed EIP-712 digest", builtS9.digest === manualDigest && ethers.TypedDataEncoder.hash(builtS9.domain, builtS9.types, builtS9.message) === manualDigest);
    const sigS9 = await walletS9.signTypedData(builtS9.domain, builtS9.types, builtS9.message);
    ok("satora witness: the wallet's signature recovers the wallet (typed-data + raw digest paths)",
      /^0x[0-9a-fA-F]{130}$/.test(sigS9)
      && ethers.verifyTypedData(builtS9.domain, builtS9.types, builtS9.message, sigS9) === walletS9.address
      && ethers.recoverAddress(builtS9.digest, sigS9) === walletS9.address);
  }

  // Builder: tamper refusals — payload fields (caught with the
  // funding-component check) and witness-level fields alike.
  const baseCompS9 = permit2S9({ hashLock: identityS9.hashLock });
  const tryBuildS9 = (comp, extra = {}) => buildSatoraPermitTypedData({ comp, record: recS9, depositor: walletS9.address, nonce: NONCE_S9, deadline: DEADLINE_S9, nowSec: NOW_S9, ...extra });
  ok("satora witness: a foreign coordinator is refused", tryBuildS9({ ...baseCompS9, coordinator_address: "0x000000000000000000000000000000000000dEaD" }).ok === false);
  ok("satora witness: a bumped funding amount is refused", tryBuildS9({ ...baseCompS9, source_amount: "20000001" }).ok === false);
  ok("satora witness: a foreign lock token is refused", tryBuildS9({ ...baseCompS9, lock_token_address: "0x000000000000000000000000000000000000dEaD" }).ok === false);
  ok("satora witness: a foreign preimage hash is refused", tryBuildS9({ ...baseCompS9, preimage_hash: "0x" + "ff".repeat(32) }).ok === false);
  ok("satora witness: a foreign claim address is refused", tryBuildS9({ ...baseCompS9, claim_address: "0x000000000000000000000000000000000000dEaD" }).ok === false);
  ok("satora witness: a shifted timelock is refused", tryBuildS9({ ...baseCompS9, timelock: TIMELOCK_S9 + 1 }).ok === false);
  ok("satora witness: a calls hash that does not recompute is refused", tryBuildS9({ ...baseCompS9, calls_hash: "0x" + "00".repeat(32) }).ok === false);
  ok("satora witness: a value-carrying funding call is refused", tryBuildS9({ ...baseCompS9, calls: [{ ...CALLS_S9[0], value: "1" }, CALLS_S9[1]], calls_hash: satoraCallsHash([{ ...CALLS_S9[0], value: "1" }, CALLS_S9[1]]) }).ok === false);
  ok("satora witness: an HTLC kind/version drifting from the creation record is refused",
    tryBuildS9({ ...baseCompS9, htlc_kind: "native", htlc_version: 2 }).ok === false
    && tryBuildS9({ ...baseCompS9, htlc_version: 6 }).ok === false
    && tryBuildS9({ ...baseCompS9, htlc_kind: undefined, htlc_version: undefined }).ok === false);
  ok("satora witness: a sold token drifting from the creation record is refused",
    tryBuildS9({ ...baseCompS9, source_token_address: "0x000000000000000000000000000000000000dEaD" }).ok === false);
  ok("satora witness: deadline/nonce bounds are enforced (past, >1h, zero nonce, bad depositor)",
    tryBuildS9(baseCompS9, { deadline: NOW_S9 }).ok === false
    && tryBuildS9(baseCompS9, { deadline: NOW_S9 + 3601 }).ok === false
    && tryBuildS9(baseCompS9, { nonce: 0n }).ok === false
    && tryBuildS9(baseCompS9, { depositor: "0x123" }).ok === false);

  // EIP-2612 side-permit: needed only when the payload says the
  // token supports it and Permit2 is unapproved; the value is
  // the EXACT swap amount, never unlimited.
  const DOMSEP_S9 = "0x" + "11".repeat(32);
  const recAmtS9 = { fromAmount: "20000000" };
  ok("satora witness: no EIP-2612 permit when the payload has no block, or it is unneeded",
    buildSatoraEip2612Permit({ comp: baseCompS9, record: recAmtS9, depositor: walletS9.address, deadline: DEADLINE_S9 }) === null
    && buildSatoraEip2612Permit({ comp: { ...baseCompS9, eip2612: { supported: true, already_approved: true, nonce: 7, domain_separator: DOMSEP_S9 } }, record: recAmtS9, depositor: walletS9.address, deadline: DEADLINE_S9 }) === null
    && buildSatoraEip2612Permit({ comp: { ...baseCompS9, eip2612: { supported: false, already_approved: false, nonce: 7, domain_separator: DOMSEP_S9 } }, record: recAmtS9, depositor: walletS9.address, deadline: DEADLINE_S9 }) === null);
  {
    const p = buildSatoraEip2612Permit({ comp: { ...baseCompS9, eip2612: { supported: true, already_approved: false, nonce: 7, domain_separator: DOMSEP_S9 } }, record: recAmtS9, depositor: walletS9.address, deadline: DEADLINE_S9 });
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const pStruct = ethers.keccak256(coder.encode(["bytes32", "address", "address", "uint256", "uint256", "uint256"],
      [ethers.keccak256(ethers.toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")), walletS9.address, PERMIT2_S9, 20000000n, 7n, BigInt(DEADLINE_S9)]));
    const pDigest = ethers.keccak256(ethers.concat(["0x1901", DOMSEP_S9, pStruct]));
    ok("satora witness: the EIP-2612 permit digest is the standard one, for the EXACT amount",
      !!p && p.ok === true && p.digest === pDigest && p.value === "20000000" && p.nonce === 7);
    ok("satora witness: a malformed EIP-2612 block is refused, not improvised",
      buildSatoraEip2612Permit({ comp: { ...baseCompS9, eip2612: { supported: true, already_approved: false, nonce: 7, domain_separator: "0xzz" } }, record: recAmtS9, depositor: walletS9.address, deadline: DEADLINE_S9 }).ok === false);
  }

  // Fund-gasless body shape: the relay's own fields; the calls
  // array goes through unchanged (the signed hash covers it).
  {
    const body = buildSatoraFundGaslessBody({ comp: baseCompS9, nonce: NONCE_S9, deadline: DEADLINE_S9, signature: "0x" + "cd".repeat(65) });
    ok("satora witness: fund-gasless body carries nonce/deadline/signature and the UNCHANGED calls",
      body.permit2_nonce === NONCE_S9.toString() && body.permit2_deadline === DEADLINE_S9
      && body.permit2_signature === "0x" + "cd".repeat(65)
      && JSON.stringify(body.calls) === JSON.stringify(baseCompS9.calls)
      && !("eip2612_permit" in body));
    const withPermit = buildSatoraFundGaslessBody({ comp: baseCompS9, nonce: NONCE_S9, deadline: DEADLINE_S9, signature: "0x" + "cd".repeat(65), eip2612Permit: { v: 27, r: "aa", s: "bb", value: "20000000", deadline: DEADLINE_S9, nonce: 7 } });
    ok("satora witness: the EIP-2612 permit rides the body only when one was signed", withPermit.eip2612_permit.value === "20000000" && withPermit.eip2612_permit.nonce === 7);
  }

  // Unilateral refund encoder: the depositor's own refund call
  // on the pinned v7 HTLC, every term from the record. The
  // locked amount must be supplied chain-verified — never
  // guessed — and the timelock must have passed.
  ok("satora refund: the pinned selector re-derives from the refund signature",
    SATORA_HTLC_ERC20_REFUND_SELECTOR === "0x36504721"
    && ethers.keccak256(ethers.toUtf8Bytes("refund(bytes32,uint256,address,address,uint256)")).slice(0, 10) === SATORA_HTLC_ERC20_REFUND_SELECTOR);
  {
    const call = buildSatoraUnilateralRefundCall(recS9, { lockedAmountRaw: "26433", nowSec: TIMELOCK_S9 + 1 });
    ok("satora refund: the unilateral call targets the swap's HTLC with the record's terms",
      call.ok === true && call.to === HTLC_S9 && call.data.startsWith(SATORA_HTLC_ERC20_REFUND_SELECTOR));
    const decoded = new ethers.Interface(["function refund(bytes32 preimageHash, uint256 amount, address token, address claimAddress, uint256 timelock)"]).decodeFunctionData("refund", call.data);
    ok("satora refund: the call decodes to hash lock, amount, lock token, claim address, timelock",
      decoded[0] === recS9.hashLock && decoded[1] === 26433n && decoded[2].toLowerCase() === WBTC_S9.toLowerCase() && decoded[3].toLowerCase() === SERVER_EVM_S9.toLowerCase() && decoded[4] === BigInt(TIMELOCK_S9));
    ok("satora refund: too-early, amount-less and zero-amount calls are refused",
      buildSatoraUnilateralRefundCall(recS9, { lockedAmountRaw: "26433", nowSec: TIMELOCK_S9 - 1 }).ok === false
      && buildSatoraUnilateralRefundCall(recS9, { nowSec: TIMELOCK_S9 + 1 }).ok === false
      && buildSatoraUnilateralRefundCall(recS9, { lockedAmountRaw: "0", nowSec: TIMELOCK_S9 + 1 }).ok === false
      && buildSatoraUnilateralRefundCall({ ...recS9, htlcKind: "native", htlcVersion: 2 }, { lockedAmountRaw: "26433", nowSec: TIMELOCK_S9 + 1 }).ok === false);
  }

  // Executor end to end over a stubbed API: create -> persist ->
  // funding payload -> verify -> sign -> fund-gasless -> record.
  const quote20S9 = { exchange_rate: "74630.764293657131342682080407", network_fee: 159, gasless_network_fee: 159, protocol_fee: 134, protocol_fee_rate: 0.005, min_amount: 10000, max_amount: 20000000, source_amount: "20000000", target_amount: "26726", net_source_amount: "20000000", net_target_amount: "26433" };
  const createBtcS9 = {
    id: "f8367eae-cc13-4062-be55-4b1b2a569e7e", status: "pending", fee_sats: 427,
    evm_hash_lock: identityS9.hashLock, btc_hash_lock: "d6770bf184e0f3af2451bdeade083e25275c67c9",
    source_token: { token_id: POL_USDC_S9, symbol: "USDC", chain: "137", name: "USDC", decimals: 6 },
    target_token: { token_id: "btc", symbol: "BTC", chain: "Bitcoin", name: "Bitcoin", decimals: 8 },
    created_at: "2026-11-08T23:05:12.437373Z", chain: "Polygon", evm_chain_id: 137,
    source_amount: "20000000", evm_expected_sats: "26726", target_amount: "26299",
    evm_htlc_address: HTLC_S9, evm_htlc_version: 7, evm_htlc_kind: "erc20",
    evm_coordinator_address: COORD_S9,
    client_evm_address: "0x0877999faBfDEd6ADBa3A97A3B46159d2F6A2F6B", server_evm_address: SERVER_EVM_S9,
    evm_fund_txid: null, evm_claim_txid: null, evm_refund_locktime: TIMELOCK_S9, evm_funding_confirmations: 128,
    btc_htlc_address: "bc1pnwvn0aqxhr0pa403rncxqdas9e7ddwetp0qg79avqae7u7u2w68q4v39t2",
    btc_user_claim_pk: claimS9.claimPk.slice(2), btc_server_refund_pk: "75653010502f8aa3c4548eb589c094503b7f03bbceb0cf13d872f58db9fed633",
    btc_refund_locktime: 1794222312, btc_htlc_script_version: 1, btc_fund_txid: null, btc_fund_vout: null, btc_claim_txid: null,
    wbtc_address: WBTC_S9, target_btc_address: null, network: "bitcoin", gasless: true,
  };
  const pairsS9 = [
    { source: "42161", target: "Lightning", min_sats: 356, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "42161", target: "Bitcoin", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "137", target: "Bitcoin", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "137", target: "Lightning", min_sats: 356, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "1", target: "Bitcoin", min_sats: 10000, max_sats: 25000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "1", target: "Lightning", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
  ];
  const stubS9 = ({ permit2 = null, fundResponse = null, seen = { funds: [], creates: [] } } = {}) => async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("api.binance.com")) return jsonResS9([{ symbol: "BTCUSDT", price: String(BTC_USD_S9) }, { symbol: "ETHUSDT", price: "3000" }]);
    if (u.includes("api.coingecko.com")) return jsonResS9({});
    if (u.includes("api.satora.io/version")) return jsonResS9({ tag: "developer-portal-v0.1.12", commit_hash: "e869e8a73020c8d33f57c6d346f95c92f0f901ab" });
    if (u.includes("api.satora.io/status")) return jsonResS9({ healthy: true, swaps_paused: false });
    if (u.includes("api.satora.io/swap-pairs")) return jsonResS9(pairsS9);
    if (u.includes("api.satora.io/quote")) {
      // The live folded shape: a fee-bearing pass folds the
      // extra fee into protocol_fee and deducts it from the net.
      if (new URL(u).searchParams.get("extra_fees") === "50")
        return jsonResS9({ ...quote20S9, protocol_fee: 268, protocol_fee_rate: 0.01, net_target_amount: "26299" });
      return jsonResS9(quote20S9);
    }
    if (u.includes("api.satora.io/swap/evm/")) { seen.creates.push(JSON.parse(opts.body || "{}")); return jsonResS9(createBtcS9); }
    if (u.includes("swap-and-lock-calldata-permit2")) return jsonResS9(permit2 || permit2S9({ hashLock: identityS9.hashLock }));
    if (u.includes("fund-gasless")) { seen.funds.push(JSON.parse(opts.body || "{}")); return jsonResS9(fundResponse || { id: createBtcS9.id, status: "clientfundingseen", tx_hash: FUND_TX_S9, message: "ok" }); }
    if (u.includes("api.satora.io/swap/")) return jsonResS9({ id: createBtcS9.id, status: "clientfundingseen" });
    throw new Error("unexpected fetch: " + u);
  };
  const storeS9 = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  const ARGS20_S9 = { fromChainKey: "polygon", toChainKey: "bitcoin", fromTokenAddress: POL_USDC_S9, toTokenAddress: "btc", fromAmount: "20000000", fromAddress: walletS9.address, toAddress: "bc1pnwvn0aqxhr0pa403rncxqdas9e7ddwetp0qg79avqae7u7u2w68q4v39t2" };

  {
    const realFetch = globalThis.fetch;
    const seen = { funds: [], creates: [] };
    const store = storeS9();
    globalThis.fetch = stubS9({ seen });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS20_S9))[0];
      const before = Math.floor(Date.now() / 1000);
      const hashes = await executeSatoraSwapRoute(walletS9, route, () => {}, { storage: store });
      ok("satora exec: funding returns the relay's funding transaction hash", hashes.length === 1 && hashes[0] === FUND_TX_S9);
      const body = seen.funds[0];
      ok("satora exec: the submitted body is the spec's shape (exactly one submission)",
        seen.funds.length === 1 && /^\d+$/.test(body.permit2_nonce) && BigInt(body.permit2_nonce) > 0n
        && body.permit2_deadline >= before + SATORA_FUNDING_DEADLINE_SECS - 5 && body.permit2_deadline <= before + SATORA_FUNDING_DEADLINE_SECS + 60
        && /^0x[0-9a-fA-F]{130}$/.test(body.permit2_signature)
        && JSON.stringify(body.calls) === JSON.stringify(CALLS_S9)
        && !("eip2612_permit" in body));
      const saved = loadSatoraSwapRecords(store)[0];
      const rebuilt = buildSatoraPermitTypedData({ comp: permit2S9({ hashLock: identityS9.hashLock }), record: saved, depositor: walletS9.address, nonce: BigInt(body.permit2_nonce), deadline: body.permit2_deadline, nowSec: body.permit2_deadline - SATORA_FUNDING_DEADLINE_SECS });
      ok("satora exec: the submitted signature is the wallet's, over exactly the verified typed data",
        rebuilt.ok === true && ethers.verifyTypedData(rebuilt.domain, rebuilt.types, rebuilt.message, body.permit2_signature) === walletS9.address);
      ok("satora exec: the persisted record carries the funding outcome and the refreshed status",
        saved.fundTxHash === FUND_TX_S9 && typeof saved.fundedAt === "number" && saved.status === "clientfundingseen");
    } finally { globalThis.fetch = realFetch; }
  }

  // EIP-2612 variant: the side-permit rides the same submission,
  // exact-amount, recoverable to the wallet.
  {
    const realFetch = globalThis.fetch;
    const seen = { funds: [], creates: [] };
    const store = storeS9();
    const comp2612 = { ...permit2S9({ hashLock: identityS9.hashLock }), eip2612: { supported: true, already_approved: false, nonce: 7, domain_separator: DOMSEP_S9 } };
    globalThis.fetch = stubS9({ permit2: comp2612, seen });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS20_S9))[0];
      await executeSatoraSwapRoute(walletS9, route, () => {}, { storage: store });
      const p = seen.funds[0] && seen.funds[0].eip2612_permit;
      ok("satora exec: the EIP-2612 permit rides the submission at the EXACT amount",
        !!p && p.value === "20000000" && p.nonce === 7 && /^[0-9a-f]{64}$/.test(p.r) && /^[0-9a-f]{64}$/.test(p.s) && (p.v === 27 || p.v === 28));
      const saved = loadSatoraSwapRecords(store)[0];
      const permit = buildSatoraEip2612Permit({ comp: comp2612, record: saved, depositor: walletS9.address, deadline: seen.funds[0].permit2_deadline });
      ok("satora exec: the EIP-2612 signature recovers the wallet over the standard digest",
        permit.ok === true && ethers.recoverAddress(permit.digest, { v: p.v, r: "0x" + p.r, s: "0x" + p.s }) === walletS9.address);
    } finally { globalThis.fetch = realFetch; }
  }

  // Tampered payload: the executor refuses BEFORE any submission;
  // the created swap stays on record for recovery.
  {
    const realFetch = globalThis.fetch;
    const seen = { funds: [], creates: [] };
    const store = storeS9();
    globalThis.fetch = stubS9({ permit2: permit2S9({ hashLock: identityS9.hashLock, calls_hash: "0x" + "00".repeat(32) }), seen });
    try {
      resetSatoraCaches();
      const route = (await getSwapRoutes(ARGS20_S9))[0];
      let execErr = null;
      try { await executeSatoraSwapRoute(walletS9, route, () => {}, { storage: store }); } catch (e) { execErr = e; }
      ok("satora exec: a tampered funding payload aborts before signing or submitting",
        !!execErr && execErr.message.includes("refused") && seen.funds.length === 0);
      const saved = loadSatoraSwapRecords(store)[0];
      ok("satora exec: the refused swap stays persisted as pending (recoverable, unfunded)",
        !!saved && saved.status === "pending" && saved.fundTxHash === null);
    } finally { globalThis.fetch = realFetch; }
  }

  // Submit verification: a relay answer about another swap (or
  // without a funding hash) is a refusal, never a success.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = stubS9({ fundResponse: { id: "00000000-0000-0000-0000-000000000000", status: "clientfundingseen", tx_hash: FUND_TX_S9, message: "ok" } });
    try {
      let submitErr = null;
      try { await submitSatoraFundGasless(recS9, { permit2_nonce: "1", permit2_deadline: 1, permit2_signature: "0x", calls: [] }); } catch (e) { submitErr = e; }
      ok("satora exec: a funding answer for a different swap is refused", !!submitErr && submitErr.message.includes("different swap"));
    } finally { globalThis.fetch = realFetch; }
    globalThis.fetch = stubS9({ fundResponse: { id: recS9.id, status: "clientfundingseen", message: "ok" } });
    try {
      let submitErr = null;
      try { await submitSatoraFundGasless(recS9, { permit2_nonce: "1", permit2_deadline: 1, permit2_signature: "0x", calls: [] }); } catch (e) { submitErr = e; }
      ok("satora exec: a funding answer without a transaction hash is refused", !!submitErr && submitErr.message.includes("carried no transaction hash"));
    } finally { globalThis.fetch = realFetch; }
  }

  // Wiring pins: the app executes Satora routes through the
  // executor with persistence; the old gate copy is gone from
  // both layers.
  {
    const appSrcS9 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const coreSrcS9 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    ok("satora exec: the app wires the executor with persistence and dropped the gate copy",
      appSrcS9.includes("executeSatoraSwapRoute(wallet, route, (t) => msg(\"wMsg\", t, true), { storage: localStorage, onApprove: recordEvmApproval })")
      && !appSrcS9.includes("funding for this route is not enabled yet")
      && !appSrcS9.includes("Satora execution is not enabled in this build")
      && !coreSrcS9.includes("Satora execution is not enabled in this build"));
  }
}

// 68. Jupiter as PRIMARY for Solana same-chain swaps (2026-11-09,
// Swap V2 /build on the keyless lite API): LI.FI's Solana routing
// resells Jupiter's own liquidity at +0.25%, so the dispatcher
// quotes Jupiter directly for Solana -> Solana pairs, ahead of
// LI.FI. Fee (probed live, controlled back-to-back builds): the
// platform fee is ALWAYS deducted from the OUTPUT amount —
// feeRaw = grossOut - netOut = floor(grossOut x bps / 10000) —
// whatever mint the fee account belongs to, so the fee account is
// the DripBot collection wallet's ATA for the OUTPUT mint, and it
// is attached only when that ATA verifiably exists on-chain (a
// missing ATA quotes fee-free with the reason on the route).
// Fixtures mirror the live probes of 2026-11-09: quote fields at
// the top level, decomposed instructions (compute-budget / setup
// incl. the SOL wrap System transfer + SyncNative / swap /
// CloseAccount cleanup), routePlan split legs, byte-array
// blockhash.
{
  const PHRASE_J8 = "legal winner thank year wave sausage worth useful legal winner thank yellow";
  const USER_J8 = solanaAddressFromPhrase(PHRASE_J8);
  const WSOL_J8 = JUPITER_WRAPPED_SOL_MINT;
  const USDC_J8 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const TOKEN_J8 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const ATA_J8 = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  const SYS_J8 = "11111111111111111111111111111111";
  const CB_J8 = "ComputeBudget111111111111111111111111111111";
  const DRIP_J8 = JUPITER_FEE_WALLET;
  const userWsolAtaJ8 = solanaAtaAddress(USER_J8, WSOL_J8, TOKEN_J8);
  const userUsdcAtaJ8 = solanaAtaAddress(USER_J8, USDC_J8, TOKEN_J8);
  const feeUsdcAtaJ8 = solanaAtaAddress(DRIP_J8, USDC_J8, TOKEN_J8);
  const ATTACKER_J8 = solanaAddressFromPhrase(KNOWN_PHRASE);
  const LUT_J8 = new SolPublicKey(new Uint8Array(32).fill(9)).toBase58();
  const jsonResJ8 = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const b64J8 = (bytes) => Buffer.from(bytes).toString("base64");
  const sysTransferDataJ8 = (amount) => { const b = new Uint8Array(12); new DataView(b.buffer).setUint32(0, 2, true); new DataView(b.buffer).setBigUint64(4, BigInt(amount), true); return b64J8(b); };
  const cbLimitDataJ8 = () => { const b = new Uint8Array(5); b[0] = 2; new DataView(b.buffer).setUint32(1, 200000, true); return b64J8(b); };
  const cbPriceDataJ8 = () => { const b = new Uint8Array(9); b[0] = 3; new DataView(b.buffer).setBigUint64(1, 10000n, true); return b64J8(b); };
  const ataIxJ8 = (owner, mint, program = TOKEN_J8) => ({ programId: ATA_J8, accounts: [
    { pubkey: USER_J8, isSigner: true, isWritable: true },
    { pubkey: solanaAtaAddress(owner, mint, program), isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SYS_J8, isSigner: false, isWritable: false },
    { pubkey: program, isSigner: false, isWritable: false },
  ], data: b64J8(new Uint8Array([1])) });
  // Gross output 20,000,000 USDC raw from 227,500,000 lamports,
  // two parallel split legs; the fee-bearing shape deducts
  // floor(gross x 49/10000) = 98,000 (the bps the law computes
  // for this fixture's $0.02 route cost on a $20.02 input).
  const buildRespJ8 = ({ fee = false, outOverride = null, legsOverride = null, mutate = null } = {}) => {
    const legs = legsOverride || [
      { percent: 50, swapInfo: { ammKey: "FixtureAmmA111111111111111111111111111111111", label: "FixtureA", inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "100000000", outAmount: "8800000" } },
      { percent: 50, swapInfo: { ammKey: "FixtureAmmB111111111111111111111111111111111", label: "FixtureB", inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "127500000", outAmount: "11200000" } },
    ];
    const gross = 20000000, feeRaw = fee ? 98000 : 0;
    const net = outOverride != null ? outOverride : gross - feeRaw;
    const resp = {
      inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "227500000", outAmount: String(net),
      otherAmountThreshold: String(Math.floor(net * 0.995)), swapMode: "ExactIn", slippageBps: 50, priceImpactPct: "0.01",
      routePlan: legs,
      computeBudgetInstructions: [
        { programId: CB_J8, accounts: [], data: cbLimitDataJ8() },
        { programId: CB_J8, accounts: [], data: cbPriceDataJ8() },
      ],
      setupInstructions: [
        ataIxJ8(USER_J8, WSOL_J8),
        { programId: SYS_J8, accounts: [
          { pubkey: USER_J8, isSigner: true, isWritable: true },
          { pubkey: userWsolAtaJ8, isSigner: false, isWritable: true },
        ], data: sysTransferDataJ8(227500000) },
        { programId: TOKEN_J8, accounts: [{ pubkey: userWsolAtaJ8, isSigner: false, isWritable: true }], data: b64J8(new Uint8Array([17])) },
        ataIxJ8(USER_J8, USDC_J8),
      ],
      swapInstruction: { programId: JUPITER_AGGREGATOR_PROGRAM, accounts: [
        { pubkey: USER_J8, isSigner: true, isWritable: false },
        { pubkey: userWsolAtaJ8, isSigner: false, isWritable: true },
        { pubkey: userUsdcAtaJ8, isSigner: false, isWritable: true },
        { pubkey: WSOL_J8, isSigner: false, isWritable: false },
        { pubkey: USDC_J8, isSigner: false, isWritable: false },
        { pubkey: TOKEN_J8, isSigner: false, isWritable: false },
        ...(fee ? [{ pubkey: feeUsdcAtaJ8, isSigner: false, isWritable: true }] : []),
      ], data: b64J8(new Uint8Array(40).fill(7)) },
      cleanupInstruction: { programId: TOKEN_J8, accounts: [
        { pubkey: userWsolAtaJ8, isSigner: false, isWritable: true },
        { pubkey: USER_J8, isSigner: false, isWritable: true },
        { pubkey: USER_J8, isSigner: false, isWritable: false },
      ], data: b64J8(new Uint8Array([9])) },
      otherInstructions: [], tipInstruction: null,
      addressesByLookupTableAddress: { [LUT_J8]: [USER_J8, WSOL_J8, USDC_J8] },
      blockhashWithMetadata: { blockhash: Array.from({ length: 32 }, (_, i) => i + 1), lastValidBlockHeight: 445116750 },
      transactionVersion: 0,
    };
    if (mutate) mutate(resp);
    return resp;
  };
  const ARGS_J8 = { fromChainKey: "solana", toChainKey: "solana", fromTokenAddress: SOLANA_SWAP_NATIVE_TOKEN, toTokenAddress: USDC_J8, fromAmount: "227500000", fromAddress: USER_J8, toAddress: USER_J8 };
  const PRICES_J8 = new Map([[WSOL_J8, { usdPrice: 88, decimals: 9 }], [USDC_J8, { usdPrice: 1, decimals: 6 }]]);

  // Pins + eligibility matrix.
  ok("jupiter: aggregator program + fee wallet pins (dripbot collection)",
    JUPITER_AGGREGATOR_PROGRAM === "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
    && DRIP_J8 === FEE_SPLIT.dripbot.agentWallet.solana && DRIP_J8 === "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn");
  ok("jupiter: mint mapping (native SOL is the wrapped mint)",
    jupiterMintOf(SOLANA_SWAP_NATIVE_TOKEN) === WSOL_J8 && jupiterMintOf(null) === WSOL_J8
    && jupiterMintOf(USDC_J8) === USDC_J8 && jupiterMintOf("not-an-address") === null);
  ok("jupiter: eligibility is Solana same-chain with the sender as recipient only",
    jupiterSupportsPair(ARGS_J8) === true
    && jupiterSupportsPair({ ...ARGS_J8, toChainKey: "base" }) === false
    && jupiterSupportsPair({ ...ARGS_J8, fromChainKey: "base" }) === false
    && jupiterSupportsPair({ ...ARGS_J8, toTokenAddress: SOLANA_SWAP_NATIVE_TOKEN }) === false
    && jupiterSupportsPair({ ...ARGS_J8, toAddress: ATTACKER_J8 }) === false
    && jupiterSupportsPair({ ...ARGS_J8, fromChainKey: "sui", toChainKey: "sui" }) === false);

  // Request shape: fee fields ride only on the fee pass.
  const paramsFreeJ8 = buildJupiterBuildParams(ARGS_J8);
  ok("jupiter: fee-free params carry no fee fields and map native SOL to the wrapped mint",
    paramsFreeJ8.get("inputMint") === WSOL_J8 && paramsFreeJ8.get("outputMint") === USDC_J8
    && paramsFreeJ8.get("amount") === "227500000" && paramsFreeJ8.get("taker") === USER_J8
    && !paramsFreeJ8.has("platformFeeBps") && !paramsFreeJ8.has("feeAccount"));
  const paramsFeeJ8 = buildJupiterBuildParams(ARGS_J8, { feeBps: 49, feeAccount: feeUsdcAtaJ8 });
  ok("jupiter: fee params carry the exact bps + the output-mint fee ATA",
    paramsFeeJ8.get("platformFeeBps") === "49" && paramsFeeJ8.get("feeAccount") === feeUsdcAtaJ8);

  // Fee-free parse: honest pricing, executable shape.
  const freeRouteJ8 = parseJupiterBuild(buildRespJ8(), ARGS_J8, { prices: PRICES_J8 });
  ok("jupiter: fee-free build parses to a route", !!freeRouteJ8 && freeRouteJ8.provider === "jupiter" && freeRouteJ8.fromChainId === SOLANA_LIFI_CHAIN_ID && freeRouteJ8.toChainId === SOLANA_LIFI_CHAIN_ID && freeRouteJ8.toAmount === "20000000" && freeRouteJ8.toAmountMin === "19900000");
  ok("jupiter: route cost is the all-in shortfall against the gross output", !!freeRouteJ8 && Math.abs(freeRouteJ8.routeFeeUsd - 0.02) < 1e-6 && Math.abs(freeRouteJ8.fromAmountUSD - 20.02) < 1e-9 && Math.abs(freeRouteJ8.toAmountUSD - 20) < 1e-9);
  ok("jupiter: fee-free route is not collecting and passes its bounds check", !!freeRouteJ8 && freeRouteJ8.platformFeeCollecting === false && freeRouteJ8.platformFeeRaw === "0" && checkJupiterSwapBounds(freeRouteJ8, USER_J8).ok === true);
  ok("jupiter: parsed route is executable-shaped (jupiter gate, not the LI.FI SVM gate)", !!freeRouteJ8 && swapRouteExecutable(freeRouteJ8).ok === true && swapRouteExecutable(freeRouteJ8).jupiter === true);

  // Fee-bearing parse: the fee is the final response's own figure.
  const feeRouteJ8 = parseJupiterBuild(buildRespJ8({ fee: true }), ARGS_J8, { prices: PRICES_J8, feeBps: 49, feeAccount: feeUsdcAtaJ8, feeTokenProgram: TOKEN_J8 });
  ok("jupiter: fee-bearing build parses with the derived fee (output mint)", !!feeRouteJ8 && feeRouteJ8.platformFeeRaw === "98000" && Math.abs(feeRouteJ8.platformFeeUsd - 0.098) < 1e-9 && feeRouteJ8.platformFeeCollecting === true && feeRouteJ8.jupiter.feeAccount === feeUsdcAtaJ8 && feeRouteJ8.jupiter.feeBps === 49);
  ok("jupiter: fee is taken in the OUTPUT mint — its ATA is derived from the output mint",
    feeUsdcAtaJ8 === solanaAtaAddress(DRIP_J8, USDC_J8, TOKEN_J8) && feeUsdcAtaJ8 !== solanaAtaAddress(DRIP_J8, WSOL_J8, TOKEN_J8));

  // Bounds-check refusals: every tamper falls back to LI.FI.
  ok("jupiter: a foreign program instruction refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.otherInstructions = [{ programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", accounts: [], data: b64J8(new Uint8Array([1])) }]; } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: a tip instruction refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.tipInstruction = { programId: SYS_J8, accounts: [{ pubkey: USER_J8, isSigner: true, isWritable: true }, { pubkey: ATTACKER_J8, isSigner: false, isWritable: true }], data: sysTransferDataJ8(1000) }; } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: a broken route plan (leg amounts do not conserve) refuses",
    parseJupiterBuild(buildRespJ8({ legsOverride: [
      { percent: 50, swapInfo: { ammKey: "FixtureAmmA111111111111111111111111111111111", label: "FixtureA", inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "100000000", outAmount: "8800000" } },
      { percent: 50, swapInfo: { ammKey: "FixtureAmmB111111111111111111111111111111111", label: "FixtureB", inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "127500000", outAmount: "11200001" } },
    ] }), ARGS_J8, { prices: PRICES_J8 }) === null
    && parseJupiterBuild(buildRespJ8({ legsOverride: [
      { percent: 100, swapInfo: { ammKey: "FixtureAmmA111111111111111111111111111111111", label: "FixtureA", inputMint: WSOL_J8, outputMint: USDC_J8, inAmount: "227499999", outAmount: "20000000" } },
    ] }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: output below the quoted minimum refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.otherAmountThreshold = String(Number(r.outAmount) + 1); } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: a fee different from the requested bps refuses", parseJupiterBuild(buildRespJ8({ fee: true, outOverride: 19950000 }), ARGS_J8, { prices: PRICES_J8, feeBps: 49, feeAccount: feeUsdcAtaJ8, feeTokenProgram: TOKEN_J8 }) === null);
  ok("jupiter: a fee paid anywhere but the collection ATA refuses", parseJupiterBuild(buildRespJ8({ fee: true }), ARGS_J8, { prices: PRICES_J8, feeBps: 49, feeAccount: userUsdcAtaJ8, feeTokenProgram: TOKEN_J8 }) === null);
  ok("jupiter: a System transfer to anyone but the user's own wSOL account refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.setupInstructions[1].accounts[1].pubkey = ATTACKER_J8; } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: a top-level token transfer refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.cleanupInstruction.data = b64J8(new Uint8Array([3, 1, 0, 0, 0, 0, 0, 0, 0])); } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: an ATA creation for someone else refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.setupInstructions[3].accounts[2].pubkey = ATTACKER_J8; } }), ARGS_J8, { prices: PRICES_J8 }) === null);
  ok("jupiter: a foreign signer refuses", parseJupiterBuild(buildRespJ8({ mutate: (r) => { r.swapInstruction.accounts.push({ pubkey: ATTACKER_J8, isSigner: true, isWritable: false }); } }), ARGS_J8, { prices: PRICES_J8 }) === null);

  // Wire stubs: Jupiter API + Solana RPC share the global fetch.
  const rpcJ8 = ({ feeAtaExists = true } = {}) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "getAccountInfo") {
      const addr = body.params[0];
      const acct = (owner) => ({ context: { slot: 1 }, value: { owner, data: ["", "base64"], lamports: 2039280, executable: false, rentEpoch: 0 } });
      if (addr === USDC_J8) return jsonResJ8({ jsonrpc: "2.0", id: 1, result: acct(TOKEN_J8) });
      if (addr === feeUsdcAtaJ8) return jsonResJ8({ jsonrpc: "2.0", id: 1, result: feeAtaExists ? acct(TOKEN_J8) : { context: { slot: 1 }, value: null } });
      return jsonResJ8({ jsonrpc: "2.0", id: 1, result: { context: { slot: 1 }, value: null } });
    }
    throw new Error("unexpected rpc in jupiter stub: " + body.method);
  };
  const lifiRouteJ8 = () => ({ id: "lifi-sol-fixture", fromAmountUSD: "20.02", toAmountUSD: "19.99", fromAmount: "227500000", toAmount: "19990000",
    steps: [{ estimate: { feeCosts: [{ amountUSD: "0.05" }], gasCosts: [{ amountUSD: "0.001" }], toAmountUSD: "19.99", fromAmountUSD: "20.02" } }] });

  // Two-pass wire flow: pass 1 fee-free reads the cost; the law
  // prices 49 bps (5x the $0.02 shortfall, under the cap and the
  // $0.30 Solana ceiling); pass 2 carries exactly that bps + the
  // fee ATA, and the executed route discloses pass 2's own fee.
  {
    const realFetch = globalThis.fetch;
    const buildUrls = [];
    resetJupiterCaches();
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("lite-api.jup.ag/price")) return jsonResJ8({ [WSOL_J8]: { usdPrice: 88, decimals: 9 }, [USDC_J8]: { usdPrice: 1, decimals: 6 } });
      if (u.includes("lite-api.jup.ag/swap/v2/build")) { buildUrls.push(u); return jsonResJ8(buildRespJ8({ fee: u.includes("platformFeeBps=") })); }
      if (u.includes("publicnode") || u.includes("api.mainnet-beta.solana.com")) return rpcJ8()(url, opts);
      throw new Error("unexpected fetch in jupiter two-pass stub: " + u);
    };
    try {
      const routes = await getSwapRoutes(ARGS_J8);
      const r = routes[0];
      ok("jupiter: dispatcher returns the Jupiter route as Solana same-chain primary", routes.length === 1 && r.provider === "jupiter" && buildUrls.length === 2);
      ok("jupiter: pass 1 is fee-free, pass 2 carries the law's bps + fee ATA",
        !buildUrls[0].includes("platformFeeBps") && buildUrls[1].includes("platformFeeBps=49") && buildUrls[1].includes("feeAccount=" + feeUsdcAtaJ8));
      ok("jupiter: fee law applied (5x route cost = 49 bps) and disclosed from the final build",
        r.platformFeeBps === 49 && r.platformFeeRaw === "98000" && Math.abs(r.platformFeeUsd - 0.098) < 1e-9 && r.platformFeeCollecting === true && r.jupiter.feeSkipped === null);
      const ranked = rankSwapRoutes(routes, 1);
      ok("jupiter: route ranks by net value like any other", ranked[0].provider === "jupiter" && ranked[0].cheapest === true);
    } finally { globalThis.fetch = realFetch; }
  }

  // Fee-ATA honesty: the account does not exist -> the SAME cheap
  // Jupiter route, quoted fee-free in ONE pass, reason recorded.
  {
    const realFetch = globalThis.fetch;
    const buildUrls = [];
    resetJupiterCaches();
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("lite-api.jup.ag/price")) return jsonResJ8({ [WSOL_J8]: { usdPrice: 88, decimals: 9 }, [USDC_J8]: { usdPrice: 1, decimals: 6 } });
      if (u.includes("lite-api.jup.ag/swap/v2/build")) { buildUrls.push(u); return jsonResJ8(buildRespJ8()); }
      if (u.includes("publicnode") || u.includes("api.mainnet-beta.solana.com")) return rpcJ8({ feeAtaExists: false })(url, opts);
      throw new Error("unexpected fetch in jupiter ata-missing stub: " + u);
    };
    try {
      const routes = await getSwapRoutes(ARGS_J8);
      const r = routes[0];
      ok("jupiter: missing fee ATA quotes fee-free through Jupiter (never a fee to nowhere)",
        routes.length === 1 && r.provider === "jupiter" && buildUrls.length === 1 && !buildUrls[0].includes("platformFeeBps")
        && r.platformFeeBps === 0 && r.platformFeeCollecting === false && r.jupiter.feeSkipped === "ata-missing" && swapRouteExecutable(r).ok === true);
      const state = await jupiterFeeAccountFor(USDC_J8);
      ok("jupiter: fee-account probe reports the missing ATA (negatives are not cached as live)", state.feeAccount === null && state.feeSkipped === "ata-missing");
    } finally { globalThis.fetch = realFetch; }
  }

  // 429 on the lite bucket -> LI.FI serves the pair, unchanged.
  {
    const realFetch = globalThis.fetch;
    let jupBuilds = 0;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("lite-api.jup.ag/price")) return jsonResJ8({ [WSOL_J8]: { usdPrice: 88, decimals: 9 }, [USDC_J8]: { usdPrice: 1, decimals: 6 } });
      if (u.includes("lite-api.jup.ag/swap/v2/build")) { jupBuilds++; return jsonResJ8({ code: 429, message: "Too many requests" }, false, 429); }
      if (u.includes("li.quest/v1/routes")) return jsonResJ8({ routes: [lifiRouteJ8()] });
      throw new Error("unexpected fetch in jupiter 429 stub: " + u);
    };
    try {
      const routes = await getSwapRoutes(ARGS_J8);
      ok("jupiter: a 429 from the lite bucket falls back to LI.FI", jupBuilds >= 1 && routes.length === 1 && routes[0].id === "lifi-sol-fixture" && routes[0].provider !== "jupiter");
    } finally { globalThis.fetch = realFetch; }
  }

  // Isolation: non-Solana pairs and Solana cross-chain never touch
  // the Jupiter API at all.
  {
    const realFetch = globalThis.fetch;
    let jupCalls = 0;
    const relayQuoteMinJ8 = () => ({ requestId: "0x68", steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0x12345678", value: "0", chainId: 8453 } }] }],
      fees: { gas: { amountUsd: "0.001" }, app: { amount: "0", amountUsd: "0" } },
      details: { sender: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", recipient: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", currencyIn: { currency: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 }, amount: "100000000", amountUsd: "100.0" }, currencyOut: { currency: { chainId: 42161, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 }, amount: "99965000", amountUsd: "99.965", minimumAmount: "99000000" }, timeEstimate: 1 } });
    globalThis.fetch = async (url) => {
      const u = String(url);
      // Jupiter's SWAP router must never serve these pairs. (Its
      // PRICE api may legitimately be read by the Mayan candidate
      // to price Solana rent — a price read is not a route.)
      if (u.includes("lite-api.jup.ag/swap")) { jupCalls++; throw new Error("jupiter swap must not be called for this pair"); }
      if (u.includes("lite-api.jup.ag")) return jsonResJ8({ [WSOL_J8]: { usdPrice: 88, decimals: 9 } });
      if (u.includes("app.across.to")) return jsonResJ8({ message: "Too Many Requests" }, false, 429);
      if (u.includes("api.relay.link/quote")) return jsonResJ8(relayQuoteMinJ8());
      if (u.includes("li.quest/v1/routes")) return jsonResJ8({ routes: [lifiRouteJ8()] });
      throw new Error("unexpected fetch in jupiter isolation stub: " + u);
    };
    try {
      const evm = await getSwapRoutes({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", toTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", fromAmount: "100000000", fromAddress: "0x0EBf5563F905E3B9D58718E28E08143511DC763b", toAddress: "0x0EBf5563F905E3B9D58718E28E08143511DC763b" });
      ok("jupiter: EVM pairs never touch Jupiter and keep the existing order", evm.length === 1 && evm[0].provider === "relay" && jupCalls === 0);
      const xchain = await getSwapRoutes({ ...ARGS_J8, toChainKey: "base", toTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" });
      ok("jupiter: Solana cross-chain stays on LI.FI (Jupiter is Solana-internal)", xchain.length === 1 && xchain[0].id === "lifi-sol-fixture" && jupCalls === 0);
    } finally { globalThis.fetch = realFetch; }
  }

  // Execution, end to end over a stubbed RPC: the assembled v0
  // transaction is signed by the wallet's own key and broadcast
  // through Fluid's RPC path; a tampered route refuses pre-sign.
  {
    const { VersionedTransaction: VTJ8 } = await import("@solana/web3.js");
    const realFetch = globalThis.fetch;
    const freshBhJ8 = new SolPublicKey(new Uint8Array(32).fill(3)).toBase58();
    let sentPayloadJ8 = null;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("publicnode") || u.includes("api.mainnet-beta.solana.com")) {
        const body = JSON.parse(opts.body);
        if (body.method === "getLatestBlockhash") return jsonResJ8({ jsonrpc: "2.0", id: 1, result: { context: { slot: 1 }, value: { blockhash: freshBhJ8, lastValidBlockHeight: 999 } } });
        if (body.method === "sendTransaction") { sentPayloadJ8 = body.params[0]; return jsonResJ8({ jsonrpc: "2.0", id: 1, result: "FixtureJupiterSignature" }); }
        throw new Error("unexpected rpc in jupiter exec stub: " + body.method);
      }
      throw new Error("unexpected fetch in jupiter exec stub: " + u);
    };
    try {
      const hashes = await executeJupiterSwapRoute(PHRASE_J8, feeRouteJ8);
      ok("jupiter: executor signs and broadcasts through Fluid's own RPC", hashes.length === 1 && hashes[0] === "FixtureJupiterSignature" && typeof sentPayloadJ8 === "string");
      const sent = VTJ8.deserialize(Buffer.from(sentPayloadJ8, "base64"));
      ok("jupiter: the broadcast transaction is a v0 tx paying from the user's own account",
        sent.message.staticAccountKeys[0].toBase58() === USER_J8 && sent.signatures.some(s => s.some(b => b !== 0)));
      const tampered = JSON.parse(JSON.stringify(feeRouteJ8));
      tampered.jupiter.quote.outAmount = "1";
      let execErr = null;
      try { await executeJupiterSwapRoute(PHRASE_J8, tampered); } catch (e) { execErr = e; }
      ok("jupiter: a tampered route is refused before signing", !!execErr && /refused|disagrees/.test(execErr.message));
      let takerErr = null;
      try { await executeJupiterSwapRoute(KNOWN_PHRASE, feeRouteJ8); } catch (e) { takerErr = e; }
      ok("jupiter: a route built for another account is refused", !!takerErr && takerErr.message.includes("different account"));
    } finally { globalThis.fetch = realFetch; }
  }

  // Review sentence + app/core wiring (source pins, as in §66/§67).
  const intentJ8 = formatSwapIntent({ fromAmount: "0.2275", fromSymbol: "SOL", fromNetKey: "solana", toAmount: "19.902", toSymbol: "USDC", toNetKey: "solana", toolName: "Jupiter", feeUsd: 0.0006, durationSec: null, platformFeeUsd: 0.098, platformFeePct: 0.49 });
  ok("jupiter: intent sentence names Jupiter + the fee", intentJ8.includes("via Jupiter") && intentJ8.includes("Fluid fee: $0.10 (0.49%)"));
  const appSrcJ8 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("jupiter: app names the router, discloses its fee from the quote, and executes it before the LI.FI Solana branch",
    appSrcJ8.includes('if (route && route.provider === "jupiter") return "Jupiter";')
    && appSrcJ8.includes('r.provider === "jupiter" && r.platformFeeCollecting === true')
    && appSrcJ8.includes("executeJupiterSwapRoute(wallet.mnemonic.phrase, route")
    && appSrcJ8.indexOf('route.provider === "jupiter"') > appSrcJ8.indexOf('route.provider === "across"')
    && appSrcJ8.indexOf("executeJupiterSwapRoute(wallet.mnemonic.phrase, route") < appSrcJ8.indexOf('hashes = await executeSolanaSwapRoute(wallet.mnemonic.phrase, route'));
  const coreSrcJ8 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  ok("jupiter: core pins the lite base, the aggregator program, and bounds-checks before signing",
    coreSrcJ8.includes("https://lite-api.jup.ag")
    && coreSrcJ8.includes('JUPITER_AGGREGATOR_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"')
    && coreSrcJ8.indexOf("checkJupiterSwapBounds(route, myAddr)") > -1
    && coreSrcJ8.indexOf("checkJupiterSwapBounds(route, myAddr)") < coreSrcJ8.indexOf("jtx.sign([kp])"));
}

// ---------- Mayan (ranked candidate: Swift + Fast MCTP) ----------
// Fixtures are the research session's LIVE quote captures
// (2026-11-09, research_notes/fluid-mayan-research-20261109/),
// trimmed to the fields the port reads, with only the deadline
// rolled forward (a quote's deadline is a live value). The
// owner's rule under test throughout: Mayan serves ONLY when
// its live quote ranks cheapest — never by priority.
{
  const jsonResM = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const EVM_USER_M = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  const SOL_USER_M = "FDo3sA7RKCD4KTGutuQXHVLAjavrgNQF547fB8tPhqMz";
  const USDC_SOL_M = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const USDC_ARB_M = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const USDC_BASE_M = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const WETH_ARB_M = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const WSOL_M = "So11111111111111111111111111111111111111112";
  const futureDlM = () => String(Math.floor(Date.now() / 1000) + 3600);
  // Lane B Swift capture: USDC Solana -> USDC Arbitrum, $100.
  const swiftSolQuoteM = (over = {}) => ({
    type: "SWIFT", gasless: false, swiftVersion: "V2", fromChain: "solana", toChain: "arbitrum",
    fromToken: { contract: USDC_SOL_M, symbol: "USDC", decimals: 6, standard: "spl" },
    toToken: { contract: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", symbol: "USDC", decimals: 6, standard: "erc20" },
    effectiveAmountIn: 100, effectiveAmountIn64: "100000000",
    expectedAmountOut: 99.934069, expectedAmountOutBaseUnits: "99934069",
    minAmountOut: 99.934069, minReceived: 99.934069, minReceivedBaseUnits: "99934069",
    minMiddleAmount: 100, price: 0.9996000212869403, toTokenPrice: 0.99976019,
    protocolBps: 0, protocolFeeUsd: 0, referrerBps: 0, referrerFeeUsd: 0,
    swiftMayanContract: "mayan34VedncxdK2XobtvWFDXQASUTBXhUVzt2kKgny", swiftInputContract: USDC_SOL_M,
    swiftInputDecimals: 6, swiftInputContractStandard: "spl", swiftWrapAndLock: false, swiftAuctionMode: 3,
    cancelRelayerFee64: "4476", refundRelayerFee64: "15339", submitRelayerFee64: "0",
    deadline64: futureDlM(), gasDrop: 0, slippageBps: 100, etaSeconds: 3,
    rentCost: "3000000", suggestedPriorityFee: 30000, quoteId: "0xeba18d1fc6e6c2ff778e500e330fba53",
    ...over,
  });
  // Lane B Fast MCTP capture (bridge mode): same pair, $100.
  const fastSolQuoteM = (over = {}) => ({
    type: "FAST_MCTP", gasless: false, hasAuction: false, fromChain: "solana", toChain: "arbitrum",
    fromToken: { contract: USDC_SOL_M, symbol: "USDC", decimals: 6, standard: "spl" },
    toToken: { contract: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", symbol: "USDC", decimals: 6, standard: "erc20" },
    effectiveAmountIn: 100, effectiveAmountIn64: "100000000",
    expectedAmountOut: 99.907438, expectedAmountOutBaseUnits: "99907438",
    minAmountOut: 98.868326, minReceived: 98.868326, minReceivedBaseUnits: "98868326",
    minMiddleAmount: 99.0005158281, price: 0.9997239156922222, toPrice: 0.99976019,
    protocolBps: 3, protocolFeeUsd: 0.0299812251, referrerBps: 0, referrerFeeUsd: 0,
    fastMctpMayanContract: "Gx9rivpS3YR8pBFwMuP6omYqVxunpLvLkNn7ubNyuZZ5", fastMctpInputContract: USDC_SOL_M,
    circleMaxFee64: "11001", fastMctpMinFinality: 1,
    redeemRelayerFee: 0.051583, redeemRelayerFee64: "51583", refundRelayerFee64: "51583", solanaRelayerFee64: "0",
    deadline64: futureDlM(), gasDrop: 0, slippageBps: 100, etaSeconds: 35,
    rentCost: "1774800", suggestedPriorityFee: 30000, quoteId: "0x5294c812c3fe3b9543565a9473aa2132",
    ...over,
  });
  // Lane C Swift capture: USDC Base -> WETH Arbitrum, $100 (source swap).
  const swiftEvmSwapQuoteM = (over = {}) => ({
    type: "SWIFT", gasless: false, swiftVersion: "V2", fromChain: "base", toChain: "arbitrum",
    fromToken: { contract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6, standard: "erc20" },
    toToken: { contract: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", symbol: "WETH", decimals: 18, standard: "erc20" },
    effectiveAmountIn: 100, effectiveAmountIn64: "100000000",
    expectedAmountOut: 0.0464810813805816, expectedAmountOutBaseUnits: "46481081380581600",
    minAmountOut: 0.0460162705667758, minReceived: 0.0460162705667758, minReceivedBaseUnits: "46016270566775800",
    minMiddleAmount: 0.04617976647945984, price: 0.0004648765176352921, toTokenPrice: 2152.72962889,
    protocolBps: 0, protocolFeeUsd: 0, referrerBps: 0, referrerFeeUsd: 0,
    swiftMayanContract: "0x40fFE85A28DC9993541449464d7529a922142960", swiftInputContract: "0x4200000000000000000000000000000000000006",
    swiftInputDecimals: 18, swiftInputContractStandard: "erc20", swiftWrapAndLock: true, swiftAuctionMode: 2,
    evmSwapRouterAddress: "0xC87De04e2EC1F4282dFF2933A2D58199f688fC3d",
    evmSwapRouterCalldata: "0x3f0bde254f0b939e398d2c31b0757d009222de99c6e461d3de1500000000000000000000000005f5e10000000000000000000094b376c869405608939e398d2c31b0757d009222de99c6e461d3de15337685fdab40d39bd02028545a4ffa7d287cc3e2833589fcd6edb6e08f4c7c32d4f71b54bda029134200000000000000000000000000000000000006b94b22332abf5f89877a14cc88f2abc48c34b3dfec3c3755b9ded4a2960ef50c9b48c1694ce274c2cbb7c0000ab88b473b1f5afd9ef808440eed33bf2bfd1fc5e25a8f55c2e849492ad7966ea8a0dd9e460402440506f9204a6f35db0307710301ff",
    cancelRelayerFee64: "210", refundRelayerFee64: "137", submitRelayerFee64: "0",
    deadline64: futureDlM(), gasDrop: 0, slippageBps: 100, etaSeconds: 3,
    rentCost: "3000000", suggestedPriorityFee: 0, quoteId: "0x1f6073ede28d59356f9af5a40eb79b43",
    ...over,
  });
  // Lane D shape: USDC Base -> USDC Arbitrum direct Swift, $100.
  const swiftEvmDirectQuoteM = (over = {}) => ({
    type: "SWIFT", gasless: false, swiftVersion: "V2", fromChain: "base", toChain: "arbitrum",
    fromToken: { contract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6, standard: "erc20" },
    toToken: { contract: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", symbol: "USDC", decimals: 6, standard: "erc20" },
    effectiveAmountIn: 100, effectiveAmountIn64: "100000000",
    expectedAmountOut: 99.93, expectedAmountOutBaseUnits: "99930000",
    minAmountOut: 99.93, minReceived: 99.93, minReceivedBaseUnits: "99930000",
    minMiddleAmount: 100, price: 0.9996, toTokenPrice: 0.99976,
    protocolBps: 0, protocolFeeUsd: 0, referrerBps: 0, referrerFeeUsd: 0,
    swiftMayanContract: "0x40fFE85A28DC9993541449464d7529a922142960", swiftInputContract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    swiftInputDecimals: 6, swiftInputContractStandard: "erc20", swiftWrapAndLock: false, swiftAuctionMode: 3,
    cancelRelayerFee64: "210", refundRelayerFee64: "137", submitRelayerFee64: "0",
    deadline64: futureDlM(), gasDrop: 0, slippageBps: 100, etaSeconds: 3,
    rentCost: "3000000", suggestedPriorityFee: 0, quoteId: "0xdddddddddddddddddddddddddddddddd",
    ...over,
  });
  const argsSolM = { fromChainKey: "solana", toChainKey: "arbitrum", fromTokenAddress: USDC_SOL_M, toTokenAddress: USDC_ARB_M, fromAmount: "100000000", fromAddress: SOL_USER_M, toAddress: EVM_USER_M };
  const argsEvmSwapM = { fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_BASE_M, toTokenAddress: WETH_ARB_M, fromAmount: "100000000", fromAddress: EVM_USER_M, toAddress: EVM_USER_M };
  const argsEvmDirectM = { fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: USDC_BASE_M, toTokenAddress: USDC_ARB_M, fromAmount: "100000000", fromAddress: EVM_USER_M, toAddress: EVM_USER_M };
  // A fee-bearing variant of a quote, as Mayan's pass 2 answers:
  // the bps echoed, the fee priced in USD, the output reduced
  // by the fee (the appendix's proven direction).
  const withFeeM = (q, bps, outHuman) => ({
    ...q, referrerBps: bps, referrerFeeUsd: bps / 100,
    expectedAmountOut: outHuman, expectedAmountOutBaseUnits: String(Math.round(outHuman * 10 ** q.toToken.decimals)),
    minAmountOut: outHuman, minReceived: outHuman, minReceivedBaseUnits: String(Math.round(outHuman * 10 ** q.toToken.decimals)),
  });
  // Stub fetch for Mayan quote rounds: answers quoteFor(body)
  // and prices SOL for the rent line. Records request bodies.
  const stubMayanQuotesM = (quoteFor) => {
    const realFetch = globalThis.fetch; const bodies = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("lite-api.jup.ag/price")) return jsonResM({ [WSOL_M]: { usdPrice: 87.38, decimals: 9 } });
      if (u.includes("price-api.mayan.finance/v3/quote")) { const b = JSON.parse(opts.body); bodies.push(b); return jsonResM({ quotes: [quoteFor(b)] }); }
      throw new Error("unexpected fetch in mayan stub: " + u);
    };
    return { bodies, restore: () => { globalThis.fetch = realFetch; } };
  };

  // Eligibility matrix (v1 scope).
  ok("mayan: Solana -> covered EVM is eligible", mayanSupportsPair(argsSolM) === true);
  ok("mayan: covered EVM <-> EVM is eligible", mayanSupportsPair(argsEvmSwapM) === true && mayanSupportsPair(argsEvmDirectM) === true);
  ok("mayan: EVM -> Solana is OUT (verified tie, owner's rule)", mayanSupportsPair({ ...argsEvmDirectM, toChainKey: "solana", toTokenAddress: USDC_SOL_M, toAddress: SOL_USER_M }) === false);
  ok("mayan: same-chain pairs are out", mayanSupportsPair({ ...argsSolM, toChainKey: "solana", toTokenAddress: USDC_SOL_M }) === false
    && mayanSupportsPair({ ...argsEvmDirectM, toChainKey: "base", toTokenAddress: USDC_BASE_M }) === false);
  ok("mayan: Sui is out on both sides in v1 (construction probe — see report)", mayanSupportsPair({ ...argsEvmDirectM, fromChainKey: "sui" }) === false
    && mayanSupportsPair({ ...argsEvmDirectM, toChainKey: "sui" }) === false && mayanSupportsPair({ ...argsSolM, toChainKey: "sui" }) === false);
  ok("mayan: chains outside the catalog are out", mayanSupportsPair({ ...argsEvmDirectM, fromChainKey: "fuse" }) === false
    && mayanSupportsPair({ ...argsEvmDirectM, toChainKey: "bitcoin" }) === false && mayanSupportsPair({ ...argsSolM, fromChainKey: "tron" }) === false);
  ok("mayan: chain/token mapping", mayanChainNameOf("base") === "base" && mayanChainNameOf("solana") === "solana" && mayanChainNameOf("sui") === null && mayanChainNameOf("tron") === null
    && mayanTokenOf("base", LIFI_NATIVE_TOKEN) === "0x0000000000000000000000000000000000000000"
    && mayanTokenOf("solana", SOLANA_SWAP_NATIVE_TOKEN) === WSOL_M && mayanTokenOf("solana", "not-an-address") === null);

  // Quote-request wire shape: the API's traps are all disarmed.
  {
    const p1 = buildMayanQuoteBody(argsSolM);
    const p2 = buildMayanQuoteBody(argsSolM, { feeBps: 12 });
    ok("mayan: quote body selects Swift + Fast MCTP only, with the mandatory params",
      p1.swift === true && p1.fastMctp === true && p1.mctp === false && p1.wormhole === false && p1.gasless === false
      && p1.sdkVersion === MAYAN_SDK_VERSION && p1.forwarderAddress === MAYAN_FORWARDER && p1.amountIn64 === "100000000"
      && p1.fromChain === "solana" && p1.toChain === "arbitrum");
    ok("mayan: fee identity rides every quote; the bps ride only when charged (pass discipline)",
      p1.referrer === MAYAN_REFERRER_SOLANA && !("referrerBps" in p1) && p2.referrerBps === 12 && p2.referrer === MAYAN_REFERRER_SOLANA);
    ok("mayan: the fee identity is the DripBot collection wallet (single referrer; the 60/40 split settles under the $2 rule)",
      MAYAN_REFERRER_SOLANA === FEE_SPLIT.dripbot.agentWallet.solana && MAYAN_REFERRER_EVM === FEE_SPLIT.dripbot.agentWallet.evm);
    ok("mayan: referrer resolves by the chain that PAYS (Swift: source; Fast MCTP: destination)",
      mayanReferrerFor(swiftSolQuoteM()) === MAYAN_REFERRER_SOLANA && mayanReferrerFor(swiftEvmSwapQuoteM()) === MAYAN_REFERRER_EVM
      && mayanReferrerFor(fastSolQuoteM()) === MAYAN_REFERRER_EVM);
  }

  // Quote parsing: the honest shapes parse; every unverifiable
  // shape refuses to null.
  {
    const r = parseMayanQuote(swiftSolQuoteM(), argsSolM, { feeBps: 0, solPriceUsd: 87.38 });
    ok("mayan: a live-shaped Swift quote parses to a route", !!r && r.provider === "mayan" && r.mayan.routeType === "SWIFT"
      && r.toAmount === "99934069" && r.platformFeeCollecting === false && r.platformFeeBps === 0);
    ok("mayan: route cost reads the model's definition (explicit fee vs gross shortfall)",
      Math.abs(r.routeFeeUsd - (r.fromAmountUSD - r.toAmountUSD)) < 1e-9 && r.routeFeeUsd > 0.02 && r.routeFeeUsd < 0.03);
    ok("mayan: Solana rent is priced into gasCostUSD from the quote's own rentCost",
      Math.abs(r.gasCostUSD - ((3000000 + 5000) / 1e9) * 87.38) < 1e-9);
    const rf = parseMayanQuote(fastSolQuoteM(), argsSolM, { feeBps: 0, solPriceUsd: 87.38 });
    ok("mayan: a live-shaped Fast MCTP bridge quote parses (route cost = the larger of its protocol fee and the shortfall)",
      !!rf && rf.mayan.routeType === "FAST_MCTP" && rf.mayan.hasAuction === false && rf.routeFeeUsd > 0.0299812251
      && Math.abs(rf.routeFeeUsd - (rf.fromAmountUSD - rf.toAmountUSD)) < 1e-9);
    const rc = parseMayanQuote(swiftEvmSwapQuoteM(), argsEvmSwapM, { feeBps: 0 });
    ok("mayan: the cross-asset EVM quote parses with USD read through the price ratio (price x toTokenPrice)",
      !!rc && Math.abs(rc.fromAmountUSD - 100 * 0.0004648765176352921 * 2152.72962889) < 1e-6 && rc.mayan.needsSwap === true && rc.gasCostUSD === 0);
    ok("mayan: slow MCTP / gasless / Swift V1 quotes are refused", parseMayanQuote(swiftSolQuoteM({ type: "MCTP" }), argsSolM, {}) === null
      && parseMayanQuote(swiftSolQuoteM({ gasless: true }), argsSolM, {}) === null
      && parseMayanQuote(swiftSolQuoteM({ swiftVersion: "V1" }), argsSolM, {}) === null);
    ok("mayan: quotes that disagree with the request are refused", parseMayanQuote(swiftSolQuoteM({ toChain: "base" }), argsSolM, {}) === null
      && parseMayanQuote(swiftSolQuoteM({ effectiveAmountIn64: "50000000" }), argsSolM, {}) === null
      && parseMayanQuote(swiftSolQuoteM({ fromToken: { contract: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", decimals: 5, standard: "spl" } }), argsSolM, {}) === null);
    ok("mayan: a fee-bearing quote must echo the requested bps and price the fee",
      parseMayanQuote(swiftSolQuoteM(), argsSolM, { feeBps: 10 }) === null
      && parseMayanQuote(withFeeM(swiftSolQuoteM(), 10, 99.83), argsSolM, { feeBps: 12 }) === null
      && !!parseMayanQuote(withFeeM(swiftSolQuoteM(), 10, 99.83), argsSolM, { feeBps: 10 }));
    ok("mayan: expired, under-guaranteed and undisclosed-swap quotes are refused",
      parseMayanQuote(swiftSolQuoteM({ deadline64: "1000000000" }), argsSolM, {}) === null
      && parseMayanQuote(swiftSolQuoteM({ minReceivedBaseUnits: "100000001" }), argsSolM, {}) === null
      && parseMayanQuote(swiftEvmSwapQuoteM({ evmSwapRouterCalldata: null }), argsEvmSwapM, {}) === null);
  }

  // Two-pass fee flow, Solana source: pass 1 fee-free reads the
  // cost; pass 2 carries the law's bps; the disclosed fee is the
  // final quote's own referrerFeeUsd.
  {
    const stub = stubMayanQuotesM((b) => b.referrerBps ? withFeeM(swiftSolQuoteM(), b.referrerBps, 99.934069 - (b.referrerBps / 100) / 0.99976019) : swiftSolQuoteM());
    try {
      const route = await getMayanSwapRoute(argsSolM);
      ok("mayan: two-pass wire flow (pass 1 fee-free, pass 2 carries exactly the charged bps)",
        stub.bodies.length === 2 && !("referrerBps" in stub.bodies[0]) && stub.bodies[1].referrerBps === route.platformFeeBps && route.platformFeeBps > 0);
      ok("mayan: the disclosed fee comes from the final quote's own referrerFeeUsd",
        route.platformFeeCollecting === true && Math.abs(route.platformFeeUsd - route.platformFeeBps / 100) < 1e-9);
      ok("mayan: a Solana-source route needs no EVM payload and is executable", route.mayan.tx === null && swapRouteExecutable(route).ok === true);
    } finally { stub.restore(); }
  }

  // Two-pass fee flow, EVM source (source-swap Swift): the
  // payload is built and bounds-checked at quote time.
  {
    const stub = stubMayanQuotesM((b) => b.referrerBps ? withFeeM(swiftEvmSwapQuoteM(), b.referrerBps, 0.0464810813805816 - (b.referrerBps / 100) / 2152.72962889) : swiftEvmSwapQuoteM());
    try {
      const route = await getMayanSwapRoute(argsEvmSwapM);
      ok("mayan: EVM two-pass flow prices the fee and builds the Forwarder payload at quote time",
        stub.bodies.length === 2 && route.platformFeeBps > 0 && !!route.mayan.tx && route.mayan.tx.to === MAYAN_FORWARDER && route.mayan.tx.value === "0");
      const fwd = new ethers.Interface([
        "function forwardERC20(address tokenIn, uint256 amountIn, tuple(uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitParams, address mayanProtocol, bytes protocolData)",
        "function swapAndForwardERC20(address tokenIn, uint256 amountIn, tuple(uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitParams, address swapProtocol, bytes swapData, address middleToken, uint256 minMiddleAmount, address mayanProtocol, bytes mayanData)",
      ]);
      const dec = fwd.decodeFunctionData("swapAndForwardERC20", route.mayan.tx.data);
      ok("mayan: the source-swap payload names the quote's own router leg, middle asset and protocol, with a zero permit",
        dec[3] === swiftEvmSwapQuoteM().evmSwapRouterAddress && dec[4] === swiftEvmSwapQuoteM().evmSwapRouterCalldata
        && dec[5].toLowerCase() === swiftEvmSwapQuoteM().swiftInputContract && dec[7].toLowerCase() === swiftEvmSwapQuoteM().swiftMayanContract.toLowerCase()
        && dec[2].value === 0n && dec[2].deadline === 0n && Number(dec[2].v) === 0);
      ok("mayan: bounds accept the built payload, and the route is executable",
        checkMayanEvmTxBounds(route, route.mayan.tx, EVM_USER_M).ok === true && swapRouteExecutable(route).ok === true);
      // Tamper refusals: anything that is not byte-for-byte the
      // payload the quote describes never reaches the signer.
      const tx = route.mayan.tx;
      const flipped = tx.data.slice(0, 200) + (tx.data[200] === "0" ? "1" : "0") + tx.data.slice(201);
      ok("mayan: EVM bounds refuse a wrong target, a mutated payload, and a stray value",
        checkMayanEvmTxBounds(route, { ...tx, to: "0x0000000000000000000000000000000000000001" }, EVM_USER_M).ok === false
        && checkMayanEvmTxBounds(route, { ...tx, data: flipped }, EVM_USER_M).ok === false
        && checkMayanEvmTxBounds(route, { ...tx, value: "1" }, EVM_USER_M).ok === false);
      const tamperedQuoteRoute = { ...route, mayan: { ...route.mayan, quote: { ...route.mayan.quote, evmSwapRouterCalldata: "0xdeadbeef" } } };
      ok("mayan: EVM bounds refuse a payload when the quote's disclosed leg changes under it",
        checkMayanEvmTxBounds(tamperedQuoteRoute, tx, EVM_USER_M).ok === false);
      const wrongDestRoute = { ...route, mayan: { ...route.mayan, destinationAddress: "0x0000000000000000000000000000000000000002" } };
      ok("mayan: EVM bounds refuse a payload paying a different destination than the swap's",
        checkMayanEvmTxBounds(wrongDestRoute, tx, EVM_USER_M).ok === false);
    } finally { stub.restore(); }
  }

  // EVM direct Swift: a forwardERC20 to the pinned Forwarder.
  {
    const stub = stubMayanQuotesM((b) => b.referrerBps ? withFeeM(swiftEvmDirectQuoteM(), b.referrerBps, 99.93 - (b.referrerBps / 100) / 0.99976) : swiftEvmDirectQuoteM());
    try {
      const route = await getMayanSwapRoute(argsEvmDirectM);
      const fwd = new ethers.Interface(["function forwardERC20(address tokenIn, uint256 amountIn, tuple(uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitParams, address mayanProtocol, bytes protocolData)"]);
      const dec = fwd.decodeFunctionData("forwardERC20", route.mayan.tx.data);
      ok("mayan: a direct EVM Swift route forwards the input token to the quote's Swift contract for exactly the amount",
        dec[0].toLowerCase() === swiftEvmDirectQuoteM().swiftInputContract && dec[1] === 100000000n
        && dec[3].toLowerCase() === swiftEvmDirectQuoteM().swiftMayanContract.toLowerCase()
        && checkMayanEvmTxBounds(route, route.mayan.tx, EVM_USER_M).ok === true);
    } finally { stub.restore(); }
  }

  // Solana Swift construction: the instruction set is local,
  // pinned, and field-verified against the quote; the state
  // account is the order hash's own PDA.
  {
    const route = parseMayanQuote(withFeeM(swiftSolQuoteM(), 10, 99.83), argsSolM, { feeBps: 10, solPriceUsd: 87.38 });
    const built = await buildMayanSolanaInstructions(route, SOL_USER_M);
    ok("mayan: a direct Solana Swift build is CU-price + wrapped create/transfer/init",
      built.instructions.length === 4 && built.extraSigners.length === 0
      && built.instructions[0].programId === "ComputeBudget111111111111111111111111111111"
      && built.instructions.slice(1).every(ix => ix.programId === "D8C8iW6zmoKg5TRr8nQ7h14TMWqQX8FiBdj2ju5MF3wa"));
    ok("mayan: Solana bounds accept the locally built set", checkMayanSolanaSwapBounds(route, built, SOL_USER_M).ok === true);
    const initIx = mayanProxyUnwrap(built.instructions[3]);
    const initData = Buffer.from(initIx.data, "base64");
    ok("mayan: the init instruction carries the quote's deadline, referrer rate and destination",
      initData.length === 198 && initData[163] === 10 && initData.readBigUInt64LE(123) === BigInt(route.mayan.quote.deadline64)
      && initIx.accounts[2].pubkey === built.state && initIx.accounts[3].pubkey === built.targetAccount);
    const hash = computeMayanSwiftOrderHash(route.mayan.quote, { swapperAddress: SOL_USER_M, destinationAddress: EVM_USER_M, randomKey: new Uint8Array(initData.slice(166, 198)) });
    const { PublicKey: PKM } = await import("@solana/web3.js");
    const pda = PKM.findProgramAddressSync([new TextEncoder().encode("STATE_SOURCE"), hash, new Uint8Array([23, 0])], new PKM("mayan34VedncxdK2XobtvWFDXQASUTBXhUVzt2kKgny"))[0].toBase58();
    ok("mayan: the state account re-derives from the order hash of the built fields", pda === built.state);
    // Tampers.
    const badTransfer = { ...built, instructions: built.instructions.map((ix, i) => {
      if (i !== 2) return ix;
      const d = Buffer.from(ix.data, "base64"); d.writeBigUInt64LE(99999999n, 1);
      return { ...ix, data: d.toString("base64") };
    }) };
    ok("mayan: Solana bounds refuse a funding transfer that moves anything but the quoted amount",
      checkMayanSolanaSwapBounds(route, badTransfer, SOL_USER_M).ok === false);
    ok("mayan: Solana bounds refuse a foreign program in the set",
      checkMayanSolanaSwapBounds(route, { ...built, instructions: [...built.instructions, { programId: "T1TANpTeScyeqVzzgNViGDNrkQ6qHz9KrSBS4aNXvGT", accounts: [], data: "" }] }, SOL_USER_M).ok === false);
    const badFee = { ...built, instructions: built.instructions.map((ix, i) => {
      if (i !== 3) return ix;
      const inner = mayanProxyUnwrap(ix); const d = Buffer.from(inner.data, "base64"); d[163] = 99;
      return { programId: "D8C8iW6zmoKg5TRr8nQ7h14TMWqQX8FiBdj2ju5MF3wa", accounts: ix.accounts, data: Buffer.from(d).toString("base64") };
    }) };
    ok("mayan: Solana bounds refuse a referrer rate in the order that is not the quoted rate",
      checkMayanSolanaSwapBounds(route, badFee, SOL_USER_M).ok === false);
    const badDest = { ...built, instructions: built.instructions.map((ix, i) => {
      if (i !== 3) return ix;
      const inner = mayanProxyUnwrap(ix); const d = Buffer.from(inner.data, "base64"); d[30] ^= 0xff;
      return { programId: "D8C8iW6zmoKg5TRr8nQ7h14TMWqQX8FiBdj2ju5MF3wa", accounts: ix.accounts, data: Buffer.from(d).toString("base64") };
    }) };
    ok("mayan: Solana bounds refuse an order paying a different destination",
      checkMayanSolanaSwapBounds(route, badDest, SOL_USER_M).ok === false);
  }

  // Solana Fast MCTP bridge construction: ledger + CCTP trigger,
  // one ephemeral message signer, fields verified.
  {
    const route = parseMayanQuote(fastSolQuoteM(), argsSolM, { feeBps: 0, solPriceUsd: 87.38 });
    const built = await buildMayanSolanaInstructions(route, SOL_USER_M);
    ok("mayan: a direct Fast MCTP build is CU + create/transfer/ledger/trigger with one ephemeral signer",
      built.instructions.length === 5 && built.extraSigners.length === 1);
    ok("mayan: Fast MCTP bounds accept the locally built set", checkMayanSolanaSwapBounds(route, built, SOL_USER_M).ok === true);
    const ledgerIx = mayanProxyUnwrap(built.instructions[3]);
    const ledgerData = Buffer.from(ledgerIx.data, "base64");
    ok("mayan: the ledger data carries bridge mode, the Arbitrum CCTP domain and the Circle fee cap",
      ledgerData.length === 124 && ledgerData[123] === 1 && ledgerData.readUInt32LE(72) === 3 && ledgerData.readBigUInt64LE(111) === 11001n);
    const badDomain = { ...built, instructions: built.instructions.map((ix, i) => {
      if (i !== 3) return ix;
      const d = Buffer.from(mayanProxyUnwrap(ix).data, "base64"); d.writeUInt32LE(0, 72);
      return { programId: "D8C8iW6zmoKg5TRr8nQ7h14TMWqQX8FiBdj2ju5MF3wa", accounts: ix.accounts, data: d.toString("base64") };
    }) };
    ok("mayan: Fast MCTP bounds refuse a ledger naming a different destination domain",
      checkMayanSolanaSwapBounds(route, badDomain, SOL_USER_M).ok === false);
  }

  // The Jupiter source-swap leg decode: contained amounts, zero
  // platform fee (deposit legs collect via the bridge contract),
  // destination index by discriminator.
  {
    const q = swiftSolQuoteM();
    const mkData = (disc, inAmt, quoted, slip, fee) => {
      const d = new Uint8Array(30);
      d.set(Buffer.from(disc, "hex"), 0);
      const off = disc === "bb64facc31c4af14" ? { i: 8, q: 16, s: 24, f: 26 } : { i: 9, q: 17, s: 25, f: 27 };
      new DataView(d.buffer).setBigUint64(off.i, BigInt(inAmt), true);
      new DataView(d.buffer).setBigUint64(off.q, BigInt(quoted), true);
      new DataView(d.buffer).setUint16(off.s, slip, true);
      new DataView(d.buffer).setUint16(off.f, fee, true);
      return d;
    };
    ok("mayan: a contained Jupiter leg decodes (both V2 shapes)",
      !!decodeMayanJupiterSwapArgs(mkData("bb64facc31c4af14", 100000000, 100500000, 100, 0), q)
      && !!decodeMayanJupiterSwapArgs(mkData("d19853937cfed8e9", 100000000, 100500000, 100, 0), q));
    ok("mayan: an over-consuming, fee-charging or unknown-shape Jupiter leg is refused",
      decodeMayanJupiterSwapArgs(mkData("bb64facc31c4af14", 100000001, 100500000, 100, 0), q) === null
      && decodeMayanJupiterSwapArgs(mkData("bb64facc31c4af14", 100000000, 100500000, 100, 25), q) === null
      && decodeMayanJupiterSwapArgs(mkData("deadbeefcafebabe", 100000000, 100500000, 100, 0), q) === null);
    ok("mayan: Jupiter destination account indexes follow the discriminator",
      mayanJupiterDestAccountIndex("d19853937cfed8e9") === 5 && mayanJupiterDestAccountIndex("bb64facc31c4af14") === 7 && mayanJupiterDestAccountIndex("deadbeef") === -1);
  }

  // Refund truth, in the review sentence and the history line.
  {
    const swapRoute = parseMayanQuote(swiftEvmSwapQuoteM(), argsEvmSwapM, { feeBps: 0 });
    const directRoute = parseMayanQuote(swiftSolQuoteM(), argsSolM, { feeBps: 0, solPriceUsd: 87.38 });
    const bridgeRoute = parseMayanQuote(fastSolQuoteM(), argsSolM, { feeBps: 0, solPriceUsd: 87.38 });
    ok("mayan: the refund note carries the converted-asset truth for a source-swapped order",
      formatMayanRefundNote(swapRoute).includes("converted asset, not the token you sent") && formatMayanRefundNote(swapRoute).includes("refund to this same wallet"));
    ok("mayan: the refund note is plain for a direct order, and states the bridge-mode truth (no order to refund)",
      formatMayanRefundNote(directRoute).includes("the locked funds refund to this same wallet on Solana") && !formatMayanRefundNote(directRoute).includes("converted asset")
      && formatMayanRefundNote(bridgeRoute).includes("left holding the minted USDC"));
    ok("mayan: status phases map to the record conventions",
      mayanSwapPhase("INPROGRESS").terminal === false && mayanSwapPhase("COMPLETED").terminal === true
      && mayanSwapPhase("REFUNDED").refunded === true && mayanSwapPhase("???").terminal === false);
    ok("mayan: the history line names the route and, for a live order, its refund deadline",
      mayanSwapHistoryLine({ status: "INPROGRESS", routeType: "SWIFT", deadline64: 1799999999 }).includes("refunds on the source chain")
      && mayanSwapHistoryLine({ status: "REFUNDED", routeType: "FAST_MCTP", deadline64: 1799999999 }).includes("Refunded on the source chain"));
  }

  // Records + explorer polling over a stub storage and API.
  {
    const store = new Map();
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    saveMayanSwapRecord(storage, { id: "sigA", status: "INPROGRESS", routeType: "SWIFT", deadline64: 1799999999, at: 1 });
    saveMayanSwapRecord(storage, { id: "sigB", status: "COMPLETED", routeType: "FAST_MCTP", at: 2 });
    ok("mayan: swap records persist and reload under the Mayan key",
      loadMayanSwapRecords(storage).length === 2 && store.has(MAYAN_SWAPS_STORAGE_KEY));
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("explorer-api.mayan.finance/v3/swap/trx/sigA")) return jsonResM({ clientStatus: "REFUNDED", fulfillTxHash: null });
      throw new Error("unexpected fetch in mayan status stub: " + u);
    };
    try {
      const fresh = await fetchMayanSwapStatus("sigA");
      const after = await pollMayanSwapStatuses(storage);
      ok("mayan: polling refreshes non-terminal records from the explorer and skips terminal ones",
        fresh.clientStatus === "REFUNDED" && after.find(r => r.id === "sigA").status === "REFUNDED" && after.find(r => r.id === "sigB").status === "COMPLETED");
    } finally { globalThis.fetch = realFetch; }
    globalThis.fetch = async () => jsonResM({ message: "Transaction not found" }, false, 404);
    try {
      const kept = await pollMayanSwapStatuses(storage);
      ok("mayan: a failed poll keeps the last known status (honest staleness)", kept.find(r => r.id === "sigA").status === "REFUNDED");
    } finally { globalThis.fetch = realFetch; }
  }

  // RANKING — the owner's rule, enforced at runtime. The
  // incumbent cascade and Mayan quote the same pair; Mayan is
  // offered only when it ranks first, and when it loses the
  // incumbent's routes come back untouched (no Mayan entry).
  const lifiRouteM = (toUsd) => ({ id: "lifi-mayan-fixture", fromAmountUSD: "100.10", toAmountUSD: String(toUsd), fromAmount: "100000000", toAmount: String(Math.round(toUsd * 1e6)),
    steps: [{ estimate: { feeCosts: [{ amountUSD: "0.20" }], gasCosts: [{ amountUSD: "0.01" }], toAmountUSD: String(toUsd), fromAmountUSD: "100.10" } }] });
  const relayQuoteM = (outUsd) => ({ requestId: "0x68", steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: EVM_USER_M, to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0x12345678", value: "0", chainId: 8453 } }] }],
    fees: { gas: { amountUsd: "0.001" }, app: { amount: "0", amountUsd: "0" } },
    details: { sender: EVM_USER_M, recipient: EVM_USER_M, currencyIn: { currency: { chainId: 8453, address: USDC_BASE_M, symbol: "USDC", decimals: 6 }, amount: "100000000", amountUsd: "100.0" }, currencyOut: { currency: { chainId: 42161, address: USDC_ARB_M, symbol: "USDC", decimals: 6 }, amount: String(Math.round(outUsd * 1e6)), amountUsd: String(outUsd), minimumAmount: "99000000" }, timeEstimate: 1 } });
  const stubRankingM = ({ mayanQuoteFor, lifiToUsd = null, relayOutUsd = null }) => {
    const realFetch = globalThis.fetch; const mayanCalls = { n: 0 };
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("lite-api.jup.ag/price")) return jsonResM({ [WSOL_M]: { usdPrice: 10, decimals: 9 } });
      if (u.includes("price-api.mayan.finance")) { mayanCalls.n++; const b = JSON.parse(opts.body); return jsonResM({ quotes: [mayanQuoteFor(b)] }); }
      if (u.includes("li.quest")) return jsonResM({ routes: [lifiRouteM(lifiToUsd)] });
      if (u.includes("app.across.to")) return jsonResM({ message: "Too Many Requests" }, false, 429);
      if (u.includes("api.relay.link")) return jsonResM(relayQuoteM(relayOutUsd));
      throw new Error("unexpected fetch in mayan ranking stub: " + u);
    };
    return { mayanCalls, restore: () => { globalThis.fetch = realFetch; } };
  };
  {
    const stub = stubRankingM({ mayanQuoteFor: (b) => b.referrerBps ? withFeeM(swiftSolQuoteM(), b.referrerBps, 99.934069 - (b.referrerBps / 100) / 0.99976019) : swiftSolQuoteM(), lifiToUsd: 99.55 });
    try {
      const routes = await getSwapRoutes(argsSolM);
      ok("mayan: RANKED — a cheaper Mayan quote leads the list, the incumbent ranked behind it",
        routes.length === 2 && routes[0].provider === "mayan" && routes[1].id === "lifi-mayan-fixture" && stub.mayanCalls.n >= 2);
    } finally { stub.restore(); }
  }
  {
    const stub = stubRankingM({ mayanQuoteFor: (b) => b.referrerBps ? withFeeM(swiftSolQuoteM(), b.referrerBps, 99.934069 - (b.referrerBps / 100) / 0.99976019) : swiftSolQuoteM(), lifiToUsd: 99.95 });
    try {
      const routes = await getSwapRoutes(argsSolM);
      ok("mayan: RANKED — a pricier Mayan quote is dropped and the incumbent serves untouched",
        routes.length === 1 && routes[0].id === "lifi-mayan-fixture" && routes.every(r => r.provider !== "mayan"));
    } finally { stub.restore(); }
  }
  {
    const stub = stubRankingM({ mayanQuoteFor: (b) => b.referrerBps ? withFeeM(swiftEvmDirectQuoteM(), b.referrerBps, 99.93 - (b.referrerBps / 100) / 0.99976) : swiftEvmDirectQuoteM(), relayOutUsd: 99.50 });
    try {
      const routes = await getSwapRoutes(argsEvmDirectM);
      ok("mayan: RANKED (EVM) — Mayan beats a pricier Relay quote and leads",
        routes.length >= 1 && routes[0].provider === "mayan");
    } finally { stub.restore(); }
  }
  {
    const stub = stubRankingM({ mayanQuoteFor: (b) => b.referrerBps ? withFeeM(swiftEvmDirectQuoteM(), b.referrerBps, 99.93 - (b.referrerBps / 100) / 0.99976) : swiftEvmDirectQuoteM(), relayOutUsd: 99.99 });
    try {
      const routes = await getSwapRoutes(argsEvmDirectM);
      ok("mayan: RANKED (EVM) — a cheaper Relay quote serves; Mayan does not appear",
        routes.length === 1 && routes[0].provider === "relay");
    } finally { stub.restore(); }
  }
  {
    // Ineligible pairs never touch Mayan at all: EVM -> Solana
    // (the excluded tie) is served by the incumbent cascade with
    // zero Mayan calls on the wire.
    const stub = stubRankingM({ mayanQuoteFor: () => { throw new Error("Mayan must not be called for this pair"); }, relayOutUsd: 99.90 });
    try {
      const routes = await getSwapRoutes({ fromChainKey: "base", toChainKey: "solana", fromTokenAddress: USDC_BASE_M, toTokenAddress: USDC_SOL_M, fromAmount: "100000000", fromAddress: EVM_USER_M, toAddress: SOL_USER_M });
      ok("mayan: isolation — EVM -> Solana makes zero Mayan calls and keeps the incumbent's answer",
        stub.mayanCalls.n === 0 && routes.length >= 1 && routes.every(r => r.provider !== "mayan"));
    } finally { stub.restore(); }
  }
  {
    // A Mayan outage removes the candidate, never the swap.
    const stub = stubRankingM({ mayanQuoteFor: () => { throw new Error("mayan down"); }, lifiToUsd: 99.55 });
    try {
      const routes = await getSwapRoutes(argsSolM);
      ok("mayan: a Mayan failure falls back to the incumbent untouched",
        routes.length === 1 && routes[0].id === "lifi-mayan-fixture");
    } finally { stub.restore(); }
  }

  // Wiring: the dispatcher consults Mayan only through the
  // ranked wrapper, and the app names, discloses, executes and
  // tracks Mayan routes like the other routers'.
  {
    const coreSrcM = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    const appSrcM = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    ok("mayan: wiring — getSwapRoutes gates Mayan behind mayanSupportsPair and rankSwapRoutes",
      coreSrcM.includes("if (!mayanSupportsPair(args)) return getSwapRoutesCascade(args);")
      && coreSrcM.includes("rankSwapRoutes(candidates, null)") && coreSrcM.includes("ranked[0].provider === \"mayan\""));
    ok("mayan: wiring — the app names, fee-discloses, refund-notes, executes and history-tracks Mayan routes",
      appSrcM.includes("provider === \"mayan\"") && appSrcM.includes("executeMayanSwapRoute") && appSrcM.includes("formatMayanRefundNote")
      && appSrcM.includes("saveMayanSwapRecord") && appSrcM.includes("wMayanSwaps") && appSrcM.includes("pollMayanSwapStatuses"));
  }
}

// 71. Satora CCTP bridge sources (2026-11-09): Base + Solana
// USDC -> Bitcoin/Lightning, incorporated the day Philipp
// confirmed both lanes. Neither is a new swap type: each is a
// Circle CCTP v2 inbound pre-leg in front of the shipped
// Arbitrum swap — creation adds bridge_source_chain /
// bridge_source_token_address; the user burns native USDC via
// CCTP Fast Transfer with mintRecipient = the user's OWN EVM
// address; IRIS attests; receiveMessage mints Arbitrum USDC to
// the user; the shipped Permit2 gasless funding then pulls the
// SERVER-NETTED amount. Live-proven at build time: creations in
// Fluid's exact shipped body shape (gasless: true) are accepted
// with BOTH bridge strings, and the Permit2 funding endpoint
// nets the CCTP deduction identically to the userop endpoint
// (20 USDC Base burn -> Permit2 source_amount 19996880; Solana
// -> 19997600), by the formula pinned in computeSatoraCctpMaxFee.
// The Solana wire goldens below were produced BY the SDK's own
// builder (@lendasat/lendaswap-sdk-pure 2.8.0, fixed inputs) —
// Fluid's hand-rolled port must reproduce them byte-for-byte.
{
  const PHRASE_S71 = "legal winner thank year wave sausage worth useful legal winner thank yellow";
  const walletS71 = await unlockVault((await importVault(PHRASE_S71, "password123")).keystore, "password123");
  const USER_S71 = walletS71.address;
  const SOL_OWNER_S71 = solanaAddressFromPhrase(PHRASE_S71);
  const identityS71 = satoraSwapIdentity(PHRASE_S71, 0);
  const claimS71 = satoraClaimKey(PHRASE_S71);
  const BTC_DEST_S71 = "bc1pnwvn0aqxhr0pa403rncxqdas9e7ddwetp0qg79avqae7u7u2w68q4v39t2";
  const ARB_USDC_S71 = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARB_WBTC_S71 = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  const BASE_USDC_S71 = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const BASE_USDT_S71 = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
  const SOL_USDC_S71 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const SOL_USDT_S71 = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const SOL_MINT_S71 = "So11111111111111111111111111111111111111112";
  const COORD_S71 = "0xb79118233552d4b7eD5c8D2d1E2BbA7e8eecb71f";
  const SERVER_EVM_S71 = "0x5ce278AAec6d9fa67bFcaF98512fE5175dFEebac";
  const HTLC_S71 = "0x6C38bF44A327bf36BfbeFcedc514c0FB3Fec6748";
  const ROUTER_S71 = "0xe592427a0aece92de3edee1f18e0157c05861564";
  const TIMELOCK_S71 = Math.floor(Date.now() / 1000) + 86400;
  const BTC_USD_S71 = 74414;
  const FUND_TX_S71 = "0x" + "ab".repeat(32);
  const jsonResS71 = (body, okFlag = true, status = 200) => ({ ok: okFlag, status, json: async () => body });
  const storeS71 = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const hexOf71 = (b) => [...b].map(x => x.toString(16).padStart(2, "0")).join("");

  // ---- Eligibility matrix (pure) ----
  {
    const basePlan = satoraSupportsPair({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: BASE_USDC_S71 });
    ok("satora bridge: Base native USDC plans a bridge (settlement = Arbitrum USDC)",
      !!basePlan && basePlan.chainId === 42161 && basePlan.token.address === ARB_USDC_S71
      && basePlan.bridge.name === "Base" && basePlan.bridge.domain === 6 && basePlan.bridge.sourceTokenAddress === BASE_USDC_S71);
    const solPlan = satoraSupportsPair({ fromChainKey: "solana", toChainKey: "lightning", fromTokenAddress: SOL_USDC_S71 });
    ok("satora bridge: Solana native USDC plans a bridge (domain 5)",
      !!solPlan && solPlan.chainId === 42161 && solPlan.token.address === ARB_USDC_S71
      && solPlan.bridge.name === "Solana" && solPlan.bridge.domain === 5 && solPlan.bridge.sourceTokenAddress === SOL_USDC_S71);
    ok("satora bridge: everything else on those chains returns null (Base USDT, Solana USDT/SOL, BSC, EVM destinations)",
      satoraSupportsPair({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: BASE_USDT_S71 }) === null
      && satoraSupportsPair({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: "0x4200000000000000000000000000000000000006" }) === null
      && satoraSupportsPair({ fromChainKey: "solana", toChainKey: "bitcoin", fromTokenAddress: SOL_USDT_S71 }) === null
      && satoraSupportsPair({ fromChainKey: "solana", toChainKey: "bitcoin", fromTokenAddress: SOL_MINT_S71 }) === null
      && satoraSupportsPair({ fromChainKey: "bsc", toChainKey: "bitcoin", fromTokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" }) === null
      && satoraSupportsPair({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC_S71 }) === null
      && satoraSupportsPair({ fromChainKey: "solana", toChainKey: "ethereum", fromTokenAddress: SOL_USDC_S71 }) === null);
    ok("satora bridge: the pinned source constants are Circle's native USDC on each chain",
      SATORA_BRIDGE_SOURCES.base.sourceTokenAddress === BASE_USDC_S71 && SATORA_BRIDGE_SOURCES.solana.sourceTokenAddress === SOL_USDC_S71);
  }

  // ---- IRIS fee parsing + the netting arithmetic ----
  ok("satora bridge: the IRIS fast tier parses to hundredths of a bip (and only the fast tier)",
    parseIrisCctpFee([{ finalityThreshold: 2000, minimumFee: 0.5 }, { finalityThreshold: 1000, minimumFee: 1.3 }])?.bpsHundredths === 130
    && parseIrisCctpFee([{ finalityThreshold: 1000, minimumFee: 1.0 }])?.bpsHundredths === 100
    && parseIrisCctpFee([{ finalityThreshold: 2000, minimumFee: 0.5 }]) === null
    && parseIrisCctpFee(null) === null && parseIrisCctpFee([{ finalityThreshold: 1000, minimumFee: "x" }]) === null);
  ok("satora bridge: the CCTP deduction cap reproduces the server's netting to the unit",
    computeSatoraCctpMaxFee("20000000", 130) === 3120n && computeSatoraCctpMaxFee("20000000", 100) === 2400n
    && computeSatoraCctpMaxFee("5000000", 130) === 780n && computeSatoraCctpMaxFee("5000000", 100) === 600n
    && computeSatoraCctpMaxFee("100000000", 130) === 15600n && computeSatoraCctpMaxFee("100000000", 100) === 12000n
    && computeSatoraCctpMaxFee("100", 130) === 0n);

  // ---- Creation bodies + the create-response echo pins ----
  const bridgePlan71 = (name) => name === "Base"
    ? { name: "Base", domain: 6, sourceChainKey: "base", sourceTokenAddress: BASE_USDC_S71, maxFeeRaw: "3120", netSourceAmountRaw: "19996880", irisFeeBpsHundredths: 130, cctpFeeUsd: 0.00312 }
    : { name: "Solana", domain: 5, sourceChainKey: "solana", sourceTokenAddress: SOL_USDC_S71, maxFeeRaw: "2400", netSourceAmountRaw: "19997600", irisFeeBpsHundredths: 100, cctpFeeUsd: 0.0024 };
  const route71 = (name) => ({
    provider: "satora", fromChainId: 42161, fromAmount: "20000000",
    fromToken: { address: ARB_USDC_S71, symbol: "USDC", decimals: 6 },
    satora: { destKey: "bitcoin", destInput: BTC_DEST_S71, extraFeesBps: 50, netSats: 26449, grossSats: 26877, bridge: bridgePlan71(name) },
  });
  {
    const body = buildSatoraBtcCreateRequest({ route: route71("Base"), userAddress: USER_S71, identity: identityS71, claimPk: claimS71.claimPk });
    ok("satora bridge: the BTC creation carries the bridge fields on the shipped body shape (gasless, settlement pair)",
      body.bridge_source_chain === "Base" && body.bridge_source_token_address === BASE_USDC_S71
      && body.evm_chain_id === 42161 && body.token_address === ARB_USDC_S71 && body.gasless === true
      && body.referral_code === SATORA_DEVELOPER_KEY && body.extra_fees === 50);
    const lnRoute = { ...route71("Solana"), satora: { ...route71("Solana").satora, destKey: "lightning", destInput: "user@wallet.example", grossSats: 6719 } };
    const lnBody = buildSatoraLnCreateRequest({ route: lnRoute, userAddress: USER_S71, userId: identityS71.userId });
    ok("satora bridge: the LN creation carries the Solana bridge fields",
      lnBody.bridge_source_chain === "Solana" && lnBody.bridge_source_token_address === SOL_USDC_S71 && lnBody.lightning_address === "user@wallet.example");
    const direct = buildSatoraBtcCreateRequest({ route: { ...route71("Base"), satora: { ...route71("Base").satora, bridge: undefined } }, userAddress: USER_S71, identity: identityS71, claimPk: claimS71.claimPk });
    ok("satora bridge: direct-lane creations carry no bridge fields (byte-identical bodies)",
      !("bridge_source_chain" in direct) && !("bridge_source_token_address" in direct));
  }
  const createFixture71 = (name, over = {}) => ({
    id: "aaaaaaa1-1111-4111-8111-111111111111", status: "pending", fee_sats: 428,
    evm_hash_lock: identityS71.hashLock, btc_hash_lock: "d6770bf184e0f3af2451bdeade083e25275c67c9",
    source_token: { chain_id: 42161, token_id: ARB_USDC_S71, decimals: 6, symbol: "USDC" },
    target_token: { chain_id: 0, token_id: "btc", decimals: 8, symbol: "BTC" },
    created_at: "2026-11-09T02:00:00.000000Z", chain: "Arbitrum", evm_chain_id: 42161,
    source_amount: "20000000", evm_expected_sats: "26877", target_amount: "26449",
    evm_htlc_address: HTLC_S71, evm_htlc_version: 7, evm_htlc_kind: "erc20",
    evm_coordinator_address: COORD_S71, client_evm_address: USER_S71, server_evm_address: SERVER_EVM_S71,
    evm_fund_txid: null, evm_claim_txid: null, evm_refund_locktime: TIMELOCK_S71, evm_funding_confirmations: 128,
    btc_htlc_address: BTC_DEST_S71, btc_user_claim_pk: claimS71.claimPk.slice(2),
    btc_server_refund_pk: "75653010502f8aa3c4548eb589c094503b7f03bbceb0cf13d872f58db9fed633",
    btc_refund_locktime: 1794222312, btc_htlc_script_version: 1, btc_fund_txid: null, btc_fund_vout: null, btc_claim_txid: null,
    wbtc_address: ARB_WBTC_S71, target_btc_address: BTC_DEST_S71, network: "bitcoin", gasless: true,
    bridge_source_chain: name, bridge_source_token_address: name === "Base" ? BASE_USDC_S71 : SOL_USDC_S71,
    ...over,
  });
  ok("satora bridge: a faithful bridged creation passes the response check",
    checkSatoraCreateResponse(route71("Base"), createFixture71("Base"), { identity: identityS71, claimPk: claimS71.claimPk }).ok === true
    && checkSatoraCreateResponse(route71("Solana"), createFixture71("Solana"), { identity: identityS71, claimPk: claimS71.claimPk }).ok === true);
  ok("satora bridge: missing or drifted bridge echoes are route refusals",
    checkSatoraCreateResponse(route71("Base"), createFixture71("Base", { bridge_source_chain: undefined }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false
    && checkSatoraCreateResponse(route71("Base"), createFixture71("Base", { bridge_source_chain: "base" }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false
    && checkSatoraCreateResponse(route71("Base"), createFixture71("Base", { bridge_source_token_address: BASE_USDT_S71 }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false
    && checkSatoraCreateResponse(route71("Solana"), createFixture71("Solana", { bridge_source_chain: "Base" }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false);
  ok("satora bridge: a creation settling anywhere but Arbitrum USDC is refused",
    checkSatoraCreateResponse(route71("Base"), createFixture71("Base", { evm_chain_id: 8453 }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false
    && checkSatoraCreateResponse(route71("Base"), createFixture71("Base", { source_token: { chain_id: 8453, token_id: BASE_USDC_S71, decimals: 6, symbol: "USDC" } }), { identity: identityS71, claimPk: claimS71.claimPk }).ok === false);

  // ---- Base burn: calldata golden + per-field refusals ----
  const GOLD_USER = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  {
    const call = buildSatoraCctpEvmBurn({ amountRaw: "20000000", mintRecipient: GOLD_USER, burnToken: BASE_USDC_S71, destinationCaller: GOLD_USER, maxFeeRaw: "3120" });
    ok("satora bridge: the Base burn targets Circle's pinned TokenMessengerV2 with the golden calldata",
      call.to === SATORA_CCTP_TOKEN_MESSENGER_V2
      && call.data === "0x8e0250ee0000000000000000000000000000000000000000000000000000000001312d0000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000ebf5563f905e3b9d58718e28e08143511dc763b000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000ebf5563f905e3b9d58718e28e08143511dc763b0000000000000000000000000000000000000000000000000000000000000c3000000000000000000000000000000000000000000000000000000000000003e8");
    const plan = { userAddress: GOLD_USER, amountRaw: "20000000", burnToken: BASE_USDC_S71, destinationCaller: GOLD_USER, maxFeeRaw: "3120" };
    ok("satora bridge: the Base burn bounds check accepts the faithful call",
      checkSatoraCctpEvmBurn(call, plan).ok === true);
    ok("satora bridge: the Base burn bounds check refuses every drift (target, amount, recipient, token, caller, fee cap)",
      checkSatoraCctpEvmBurn({ ...call, to: "0x000000000000000000000000000000000000dEaD" }, plan).ok === false
      && checkSatoraCctpEvmBurn(call, { ...plan, amountRaw: "20000001" }).ok === false
      && checkSatoraCctpEvmBurn(call, { ...plan, userAddress: "0x000000000000000000000000000000000000dEaD" }).ok === false
      && checkSatoraCctpEvmBurn(call, { ...plan, burnToken: BASE_USDT_S71 }).ok === false
      && checkSatoraCctpEvmBurn(call, { ...plan, destinationCaller: "0x0000000000000000000000000000000000000000" }).ok === false
      && checkSatoraCctpEvmBurn(call, { ...plan, maxFeeRaw: "3121" }).ok === false);
    const rm = buildSatoraCctpReceiveMessageCall({ message: "0x1234", attestation: "0x5678" });
    ok("satora bridge: receiveMessage targets Circle's pinned MessageTransmitterV2",
      rm.to === SATORA_CCTP_MESSAGE_TRANSMITTER_V2 && rm.data.slice(0, 10) === ethers.id("receiveMessage(bytes,bytes)").slice(0, 10));
  }

  // ---- Solana burn: wire-byte goldens vs the SDK's own builder ----
  const GOLD_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  const GOLD_TX = "0200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ae5c2e6b5cc7dcd66d19becec3cc3e449067c56fb3d7ab557f4577de64d832110ca20546b1e5d1d16ac642c32cc09fca482157c09a1ddf8f7f763d3f143a900e02000b117e8c088760bfde1dddcf32c17f209b8242ee52aaf131facd88d0ea2c6d0b06f2ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22cd3ea8cf5acaca8cd05207512175c43cef54a5dd99ede20a16b55253738f397dc076eaeeeb35d837e56b85fbca83355dea3141b9cfd5b90b3e8c6ee7c0a34942fa9a202630d8c5324689243a37de28596703eefb003fc03d2461e6d7bd9581780c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d610306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000002dc7bd6bda3aee5863e2160422ee2c6ff3d6abb980a1b959008704388776ad49454a9d54580421c4dd7ced5d1ca999425fae7ea6cfa7f6429d6ea06c2c9aeb528e6b6a31521dba9ad08af06b6d8ce9aaacfa821ea7712cbb4b92694a6f0336fb3c0a2554074b1c454c9c5b0096b9eeb8253939664ba98c79cfd961211f6a8272c14ed3febff31b8949c9d4112029bc5d3eff50dab32f41648bd613937333e1bfa65fc81ce19edcd2d2c340b02fa61be1d5badde1592833ddf92009d8cf685455a65fc81d0fefa8860cb3b83f089b0224be8a6687b7ae49f594c0b9b4d7e9389306ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a90000000000000000000000000000000000000000000000000000000000000000510033fcc78003f0dfd5be6750749b84b9f4823b9cc83b6cb54f1adb0cee206e01000000000000000000000000000000000000000000000000000000000000000306000502a08601000600090310270000000000000d12000007020803090a0b0405010c0d0e0f100d60d73c3d2e723780b0002d310100000000030000000000000000000000000000000ebf5563f905e3b9d58718e28e08143511dc763b0000000000000000000000000ebf5563f905e3b9d58718e28e08143511dc763b6009000000000000e8030000";
  {
    const built = buildSatoraSolanaCctpBurn({
      owner: GOLD_OWNER, amountRaw: "20000000", mintRecipient: GOLD_USER, destinationCaller: GOLD_USER,
      maxFeeRaw: "2400", blockhash: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM",
      priorityFeeMicroLamports: 10000n, eventSeed: new Uint8Array(32).fill(7),
    });
    ok("satora bridge: the Solana burn reproduces the SDK builder's wire bytes exactly",
      built.eventAccount === "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB" && hexOf71(built.transaction) === GOLD_TX);
    const pdas = satoraCctpSolanaPdas(GOLD_OWNER);
    ok("satora bridge: the Solana PDAs match Circle's published derivations",
      pdas.senderAuthority === "45hzrGLQ2EGo1Ln7QpXjDwb589GDQ9H2aEXXw6ds6BFE"
      && pdas.remoteTokenMessenger === "53NSDvEXmUixWSsCQF5rnTxcKdihq19WXNaZFXrX3ojf"
      && pdas.localToken === "CRBBbuLCyrkQy4dCTHxqstSmDQv4ajBeUVb9qUdMVaP1"
      && pdas.messageTransmitter === "W1k5ijkaSTo5iA5zChNpfzcy796fLhkBxfmJuR8W8HU");
    const plan = { owner: GOLD_OWNER, mintRecipient: GOLD_USER, destinationCaller: GOLD_USER, amountRaw: "20000000", maxFeeRaw: "2400" };
    ok("satora bridge: the Solana burn bounds check accepts the golden build", checkSatoraSolanaCctpBurn(built, plan).ok === true);
    const tamperedMsg = new Uint8Array(built.message); tamperedMsg[tamperedMsg.length - 1] ^= 0xff;
    ok("satora bridge: the Solana burn bounds check refuses drifted terms and tampered wire bytes",
      checkSatoraSolanaCctpBurn(built, { ...plan, amountRaw: "20000001" }).ok === false
      && checkSatoraSolanaCctpBurn(built, { ...plan, maxFeeRaw: "2401" }).ok === false
      && checkSatoraSolanaCctpBurn(built, { ...plan, mintRecipient: "0x000000000000000000000000000000000000dEaD" }).ok === false
      && checkSatoraSolanaCctpBurn(built, { ...plan, destinationCaller: "0x0000000000000000000000000000000000000000" }).ok === false
      && checkSatoraSolanaCctpBurn({ ...built, message: tamperedMsg }, plan).ok === false);
  }

  // ---- CCTP message pin ----
  const cctpMessage71 = ({ sourceDomain = 6, destDomain = 3, recipient = USER_S71, caller = USER_S71 } = {}) => {
    const u32 = (n) => BigInt(n).toString(16).padStart(8, "0");
    const pad = (a) => String(a).toLowerCase().replace("0x", "").padStart(64, "0");
    return "0x" + u32(1) + u32(sourceDomain) + u32(destDomain) + "0000000000000000" + "00".repeat(32) + pad(recipient) + pad(caller) + "000003e8000003e8" + "00000000";
  };
  ok("satora bridge: the CCTP message pin accepts this crossing and refuses foreign ones",
    checkSatoraCctpMessage(cctpMessage71({}), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: USER_S71 }).ok === true
    && checkSatoraCctpMessage(cctpMessage71({ caller: "0x0000000000000000000000000000000000000000" }), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: "0x0000000000000000000000000000000000000000" }).ok === true
    && checkSatoraCctpMessage(cctpMessage71({ recipient: "0x000000000000000000000000000000000000dEaD" }), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: USER_S71 }).ok === false
    && checkSatoraCctpMessage(cctpMessage71({ destDomain: 6 }), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: USER_S71 }).ok === false
    && checkSatoraCctpMessage(cctpMessage71({ sourceDomain: 5 }), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: USER_S71 }).ok === false
    && checkSatoraCctpMessage(cctpMessage71({}), { userAddress: USER_S71, sourceDomain: 6, destinationCaller: "0x0000000000000000000000000000000000000000" }).ok === false);

  // ---- Funding netting: the pulled amount is the netted one ----
  const compFor71 = (hashLock, netRaw, over = {}) => {
    const approveData = new ethers.Interface(["function approve(address,uint256) returns (bool)"]).encodeFunctionData("approve", [ROUTER_S71, BigInt(netRaw)]);
    const pad = (a) => String(a).toLowerCase().replace("0x", "").padStart(64, "0");
    const calls = [
      { target: ARB_USDC_S71, value: "0", call_data: approveData },
      { target: ROUTER_S71, value: "0", call_data: "0xc04b8d59" + pad(ARB_USDC_S71) + pad(ARB_WBTC_S71) },
    ];
    return {
      coordinator_address: COORD_S71, htlc_kind: "erc20", htlc_version: 7,
      permit2_address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      source_token_address: ARB_USDC_S71, source_amount: String(netRaw),
      lock_token_address: ARB_WBTC_S71.toLowerCase(), preimage_hash: hashLock,
      claim_address: SERVER_EVM_S71.toLowerCase(), timelock: TIMELOCK_S71,
      calls, calls_hash: satoraCallsHash(calls), ...over,
    };
  };
  const bridgedRecord71 = (over = {}) => ({
    id: "aaaaaaa1-1111-4111-8111-111111111111", destKey: "bitcoin", fromChainKey: "arbitrum",
    fromAmount: "20000000", hashLock: identityS71.hashLock, coordinatorAddress: COORD_S71,
    htlcAddress: HTLC_S71, serverEvmAddress: SERVER_EVM_S71, wbtcAddress: ARB_WBTC_S71,
    refundLocktime: TIMELOCK_S71, sourceTokenAddress: ARB_USDC_S71, htlcKind: "erc20", htlcVersion: 7,
    bridge: { name: "Base", domain: 6, sourceChainKey: "base", sourceTokenAddress: BASE_USDC_S71, maxFeeRaw: "3120", netSourceAmountRaw: "19996880", irisFeeBpsHundredths: 130, destinationCaller: USER_S71, mintTx: null, attestation: null },
    burnTx: "0x" + "cd".repeat(32), bridgePhase: "attesting", fundTxHash: null, status: "pending",
    destInput: BTC_DEST_S71, netSats: 26449, grossSats: 26877, feeSats: 428, fromSymbol: "USDC", index: 0, btcHtlcAddress: BTC_DEST_S71,
    ...over,
  });
  ok("satora bridge: the funding amount of a bridged record is the netted amount; a direct record's is the full amount",
    satoraFundingAmount(bridgedRecord71()) === "19996880" && satoraFundingAmount({ fromAmount: "20000000", bridge: null }) === "20000000");
  ok("satora bridge: netted funding components pass; full-amount components and approvals are refused",
    checkSatoraFundingComponents(compFor71(identityS71.hashLock, "19996880"), bridgedRecord71()).ok === true
    && checkSatoraFundingComponents(compFor71(identityS71.hashLock, "20000000"), bridgedRecord71()).ok === false
    && checkSatoraFundingComponents(compFor71(identityS71.hashLock, "19996880", { source_amount: "19996880" }), bridgedRecord71()).ok === true);
  {
    // A component set whose source_amount is netted but whose
    // APPROVE still names the full amount must refuse.
    const approveFull = new ethers.Interface(["function approve(address,uint256) returns (bool)"]).encodeFunctionData("approve", [ROUTER_S71, 20000000n]);
    const comp = compFor71(identityS71.hashLock, "19996880");
    comp.calls = [{ ...comp.calls[0], call_data: approveFull }, comp.calls[1]];
    comp.calls_hash = satoraCallsHash(comp.calls);
    ok("satora bridge: a full-amount approval inside netted components is refused",
      checkSatoraFundingComponents(comp, bridgedRecord71()).ok === false);
    const permit = buildSatoraEip2612Permit({ comp: { ...compFor71(identityS71.hashLock, "19996880"), eip2612: { supported: true, already_approved: false, nonce: 3, domain_separator: "0x" + "11".repeat(32) } }, record: bridgedRecord71(), depositor: USER_S71, deadline: Math.floor(Date.now() / 1000) + 600 });
    ok("satora bridge: the EIP-2612 side-permit is for the NETTED amount, never the full one",
      !!permit && permit.ok === true && permit.value === "19996880");
  }
  // ---- Quoting: fee-law pins with the CCTP fee folded in ----
  const pairsS71 = [
    { source: "42161", target: "Bitcoin", min_sats: 10000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "42161", target: "Lightning", min_sats: 356, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
  ];
  const quoteForS71 = (amountRaw, extraBps, destKey, fixedNet = null) => {
    let gross = Math.floor((Number(amountRaw) / 1e6) / BTC_USD_S71 * 1e8);
    // The live folded shape: the extra fee is folded INTO
    // protocol_fee (base + extra) and its rate, not carried as
    // a separate deduction.
    let baseProtocol = Math.round(gross * 0.005);
    const network = destKey === "bitcoin" ? 160 : 4;
    if (fixedNet != null) {
      // The minimum-enforcement fixture: pin the PASS-1 net by
      // pricing a small consistent quote around it (gross =
      // net + protocol + network), rather than bolting a tiny
      // net onto a $5 gross — a quote whose deductions do not
      // add up is refused by the parser, as it should be. A
      // fee-bearing pass then nets the extra fee on top.
      baseProtocol = Math.round(fixedNet * 0.005);
      gross = fixedNet + baseProtocol + network;
      baseProtocol = Math.round(gross * 0.005);
      gross = fixedNet + baseProtocol + network;
    }
    const extraProtocol = Math.round(gross * (Number(extraBps) || 0) / 10000);
    const protocol = baseProtocol + extraProtocol;
    const net = fixedNet != null ? fixedNet - extraProtocol : gross - protocol - network;
    return { exchange_rate: String(BTC_USD_S71), network_fee: network, gasless_network_fee: network, protocol_fee: protocol, protocol_fee_rate: 0.005 + (Number(extraBps) || 0) / 10000, min_amount: 10000, max_amount: 20000000, source_amount: String(amountRaw), target_amount: String(gross), net_source_amount: String(amountRaw), net_target_amount: String(net) };
  };
  const apiStubS71 = ({ creates = [], funds = [], createId = "aaaaaaa1-1111-4111-8111-111111111111", compNetRaw = "19996880", attestation = null, solanaSends = [], onSolanaSend = null, quoteFixedNet = null } = {}) => async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("api.binance.com")) return jsonResS71([{ symbol: "BTCUSDT", price: String(BTC_USD_S71) }, { symbol: "ETHUSDT", price: "3000" }]);
    if (u.includes("api.coingecko.com")) return jsonResS71({});
    if (u.includes("iris-api.circle.com/v2/burn/USDC/fees/6/3")) return jsonResS71([{ finalityThreshold: 2000, minimumFee: 0.5, forwardFee: 0 }, { finalityThreshold: 1000, minimumFee: 1.3, forwardFee: 0 }]);
    if (u.includes("iris-api.circle.com/v2/burn/USDC/fees/5/3")) return jsonResS71([{ finalityThreshold: 1000, minimumFee: 1.0, forwardFee: 0 }]);
    if (u.includes("iris-api.circle.com/v2/messages/")) {
      if (!attestation) return jsonResS71({ messages: [] });
      return jsonResS71({ messages: [{ status: "complete", message: attestation.message, attestation: attestation.attestation }] });
    }
    if (u.includes("api.satora.io/version")) return jsonResS71({ tag: "developer-portal-v0.1.12", commit_hash: "e869e8a73020c8d33f57c6d346f95c92f0f901ab" });
    if (u.includes("api.satora.io/status")) return jsonResS71({ healthy: true, swaps_paused: false });
    if (u.includes("api.satora.io/swap-pairs")) return jsonResS71(pairsS71);
    if (u.includes("api.satora.io/quote")) {
      const qs = new URL(u).searchParams;
      return jsonResS71(quoteForS71(qs.get("source_amount"), Number(qs.get("extra_fees") || 0), qs.get("target_chain") === "Bitcoin" ? "bitcoin" : "lightning", quoteFixedNet));
    }
    if (u.includes("api.satora.io/swap/evm/")) {
      const body = JSON.parse(opts.body || "{}");
      creates.push(body);
      const net = quoteForS71(body.amount_in, body.extra_fees || 0, "bitcoin").net_target_amount;
      return jsonResS71(createFixture71(body.bridge_source_chain || "Base", {
        id: createId, target_amount: String(net),
        bridge_source_chain: body.bridge_source_chain, bridge_source_token_address: body.bridge_source_token_address,
      }));
    }
    if (u.includes("swap-and-lock-calldata-permit2")) return jsonResS71(compFor71(identityS71.hashLock, compNetRaw));
    if (u.includes("fund-gasless")) { funds.push(JSON.parse(opts.body || "{}")); return jsonResS71({ id: createId, status: "clientfundingseen", tx_hash: FUND_TX_S71, message: "ok" }); }
    if (u.includes("api.satora.io/swap/")) return jsonResS71({ id: createId, status: "clientfundingseen" });
    if (u.includes("solana-rpc.publicnode.com") || u.includes("api.mainnet-beta.solana.com")) {
      const body = JSON.parse(opts.body);
      const reply = (result) => jsonResS71({ jsonrpc: "2.0", id: body.id ?? 1, result });
      if (body.method === "getLatestBlockhash") return reply({ context: { slot: 1 }, value: { blockhash: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM", lastValidBlockHeight: 100 } });
      if (body.method === "getRecentPrioritizationFees") return reply([{ slot: 1, prioritizationFee: 10000 }]);
      if (body.method === "simulateTransaction") return reply({ context: { slot: 1 }, value: { err: null, logs: [], unitsConsumed: 50000 } });
      if (body.method === "sendTransaction") { solanaSends.push(body.params[0]); if (onSolanaSend) onSolanaSend(body.params[0]); return reply("5SimulatedSignature1111111111111111111111111111"); }
      if (body.method === "getSignatureStatuses") return reply({ context: { slot: 1 }, value: [{ slot: 1, confirmations: 10, err: null, confirmationStatus: "confirmed" }] });
      throw new Error("unexpected solana method " + body.method);
    }
    // Other routers (dispatcher-isolation tests): an honest
    // "no route" answer, never a Satora route.
    if (u.includes("li.quest") || u.includes("relay.link") || u.includes("mayan") || u.includes("across")) return jsonResS71({}, false, 404);
    throw new Error("unexpected fetch: " + u);
  };
  // The EVM JSON-RPC seam (ethers does not use global fetch —
  // the suite's proven FetchRequest seam), one handler per test.
  const evmRpcS71 = ({ arbUsdcRaw = 19996880n, balanceOf = null, onSend = null, baseSends = [], arbSends = [] } = {}) => async (req) => {
    const url = req.url;
    const isBase = url.includes("base-rpc.publicnode.com");
    const isArb = url.includes("arbitrum-one-rpc.publicnode.com");
    if (!isBase && !isArb) throw new Error("unexpected rpc url " + url);
    const parsed = JSON.parse(new TextDecoder().decode(req.body || new Uint8Array()));
    const word = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
    const block71 = { number: "0x64", hash: "0x" + "22".repeat(32), parentHash: "0x" + "11".repeat(32), timestamp: "0x67300000", transactions: [], gasLimit: "0x1c9c380", gasUsed: "0x0", miner: "0x0000000000000000000000000000000000000000", difficulty: "0x0", baseFeePerGas: "0x5f5e100", extraData: "0x", nonce: "0x0000000000000000", mixHash: "0x" + "00".repeat(32), sha3Uncles: "0x" + "00".repeat(32), logsBloom: "0x" + "00".repeat(256), stateRoot: "0x" + "00".repeat(32), transactionsRoot: "0x" + "00".repeat(32), receiptsRoot: "0x" + "00".repeat(32), uncles: [] };
    const answer = (r) => {
      let result;
      switch (r.method) {
        case "eth_chainId": result = isBase ? "0x2105" : "0xa4b1"; break;
        case "net_version": result = isBase ? "8453" : "42161"; break;
        case "eth_blockNumber": result = "0x64"; break;
        case "eth_getBlockByNumber": result = block71; break;
        case "eth_getBalance": result = "0x38d7ea4c68000"; break; // 0.001 ETH — above the caller threshold on Arbitrum
        case "eth_getTransactionCount": result = "0x0"; break;
        case "eth_gasPrice": result = "0x5f5e100"; break;
        case "eth_maxPriorityFeePerGas": result = "0x0"; break;
        case "eth_feeHistory": result = { baseFeePerGas: ["0x5f5e100", "0x5f5e100"], gasUsedRatio: [0.5], reward: [["0x0"]], oldestBlock: "0x1" }; break;
        case "eth_estimateGas": result = "0x493e0"; break;
        case "eth_call": {
          const data = String(r.params?.[0]?.data || "");
          if (isBase && data.startsWith("0xdd62ed3e")) result = word(0n); // allowance: none yet -> the approve path runs
          else if (isArb && data.startsWith("0x70a08231")) result = word(balanceOf ? balanceOf() : arbUsdcRaw);
          else result = word(0n);
          break;
        }
        case "eth_sendRawTransaction": {
          const raw = r.params[0];
          const hash = ethers.keccak256(raw);
          const entry = { raw, hash, to: ethers.Transaction.from(raw).to };
          (isBase ? baseSends : arbSends).push(entry);
          if (onSend) onSend({ isBase, isArb, entry });
          result = hash;
          break;
        }
        case "eth_getTransactionReceipt": result = { transactionHash: r.params[0], transactionIndex: "0x0", blockHash: "0x" + "22".repeat(32), blockNumber: "0x64", from: USER_S71, to: "0x0000000000000000000000000000000000000000", cumulativeGasUsed: "0x30000", gasUsed: "0x30000", contractAddress: null, logs: [], logsBloom: "0x" + "00".repeat(256), status: "0x1", effectiveGasPrice: "0x5f5e100", type: "0x2" }; break;
        case "eth_getTransactionByHash": result = null; break;
        default: throw new Error("unexpected rpc method " + r.method);
      }
      return { jsonrpc: "2.0", id: r.id, result };
    };
    const payload = Array.isArray(parsed) ? parsed.map(answer) : answer(parsed);
    return new FetchResponse(200, "OK", { "content-type": "application/json" }, new TextEncoder().encode(JSON.stringify(payload)));
  };
  const defaultGetUrl71 = FetchRequest.createGetUrlFunc();
  const withStubs71 = async (apiOpts, rpcOpts, fn) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = apiStubS71(apiOpts);
    FetchRequest.registerGetUrl(evmRpcS71(rpcOpts));
    try { resetSatoraCaches(); return await fn(); }
    finally { globalThis.fetch = realFetch; FetchRequest.registerGetUrl(defaultGetUrl71); }
  };

  {
    const r = await withStubs71({}, {}, () => getSatoraSwapRoute({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: BASE_USDC_S71, toTokenAddress: "btc", fromAmount: "20000000", fromAddress: USER_S71, toAddress: BTC_DEST_S71 }));
    ok("satora bridge quote: $20 Base -> BTC prices the crossing into the route cost under the fee law",
      !!r && r.satora.bridge.maxFeeRaw === "3120" && r.satora.bridge.netSourceAmountRaw === "19996880"
      && Math.abs(r.routeFeeUsd - 0.22186) < 0.001 && r.platformFeeBps === 50
      && r.satora.protocolFeeSats === 134 && r.satora.fluidFeeSats === 134
      && Math.abs(r.gasCostUSD - 0.32173) < 0.001 && r.fromChainId === 42161);
  }
  {
    const r = await withStubs71({}, {}, () => getSatoraSwapRoute({ fromChainKey: "solana", toChainKey: "lightning", fromTokenAddress: SOL_USDC_S71, toTokenAddress: "ln", fromAmount: "5000000", fromAddress: SOL_OWNER_S71, toAddress: "user@wallet.example" }));
    ok("satora bridge quote: $5 Solana -> Lightning (fee cap 600 raw, 0.5% cap binds the bps; the folded Arbitrum settlement quote attributes differentially)",
      !!r && r.satora.bridge.maxFeeRaw === "600" && r.satora.bridge.netSourceAmountRaw === "4999400"
      && r.platformFeeBps === 50 && r.satora.protocolFeeSats === 34 && r.satora.networkFeeSats === 4 && r.satora.fluidFeeSats === 34 && Math.abs(r.routeFeeUsd - 0.0289) < 0.001);
  }
  {
    const rb = await withStubs71({}, {}, () => getSatoraSwapRoute({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: BASE_USDC_S71, toTokenAddress: "btc", fromAmount: "100000000", fromAddress: USER_S71, toAddress: BTC_DEST_S71 }));
    const rs = await withStubs71({}, {}, () => getSatoraSwapRoute({ fromChainKey: "solana", toChainKey: "bitcoin", fromTokenAddress: SOL_USDC_S71, toTokenAddress: "btc", fromAmount: "100000000", fromAddress: SOL_OWNER_S71, toAddress: BTC_DEST_S71 }));
    ok("satora bridge quote: $100 crossings price at 15,600 (Base) / 12,000 (Solana) raw",
      rb?.satora.bridge.maxFeeRaw === "15600" && rb?.satora.bridge.netSourceAmountRaw === "99984400"
      && rs?.satora.bridge.maxFeeRaw === "12000" && rs?.satora.bridge.netSourceAmountRaw === "99988000");
  }
  {
    // Minimums bind on the POST-CCTP net: a quote netting exactly
    // 356 sats crosses only 355 after the Solana fee — terminal
    // refusal; the same quote on the direct lane passes.
    let termErr = null;
    await withStubs71({ quoteFixedNet: 356 }, {}, async () => {
      try { await getSatoraSwapRoute({ fromChainKey: "solana", toChainKey: "lightning", fromTokenAddress: SOL_USDC_S71, toTokenAddress: "ln", fromAmount: "5000000", fromAddress: SOL_OWNER_S71, toAddress: "user@wallet.example" }); }
      catch (e) { termErr = e; }
    });
    const direct = await withStubs71({ quoteFixedNet: 356 }, {}, () => getSatoraSwapRoute({ fromChainKey: "arbitrum", toChainKey: "lightning", fromTokenAddress: ARB_USDC_S71, toTokenAddress: "ln", fromAmount: "5000000", fromAddress: USER_S71, toAddress: "user@wallet.example" }));
    ok("satora bridge quote: the Lightning minimum is enforced on the post-CCTP net (355 < 356 refuses; direct 356 passes)",
      !!termErr && termErr.satoraTerminal === true && /356-sat minimum/.test(termErr.message) && !!direct);
  }

  // ---- Executor end to end: Base ----
  {
    const creates = [], funds = [], baseSends = [], arbSends = [], approvals = [];
    const store = storeS71();
    let snapshotAtBurn = null;
    const attestation = { message: cctpMessage71({ sourceDomain: 6 }), attestation: "0x" + "aa".repeat(65) };
    const hashes = await withStubs71(
      { creates, funds, attestation },
      { baseSends, arbSends, onSend: ({ isBase, entry }) => { if (isBase && String(entry.to).toLowerCase() === SATORA_CCTP_TOKEN_MESSENGER_V2.toLowerCase()) snapshotAtBurn = store.getItem("fluid_satora_swaps_v1"); } },
      async () => {
        const route = (await getSwapRoutes({ fromChainKey: "base", toChainKey: "bitcoin", fromTokenAddress: BASE_USDC_S71, toTokenAddress: "btc", fromAmount: "20000000", fromAddress: USER_S71, toAddress: BTC_DEST_S71 }))[0];
        return executeSatoraSwapRoute(walletS71, route, () => {}, { storage: store, onApprove: (rec) => approvals.push(rec) });
      });
    const saved = loadSatoraSwapRecords(store)[0];
    ok("satora bridge exec (Base): returns [burn, funding] and the record lands funded",
      hashes.length === 2 && hashes[1] === FUND_TX_S71 && !!saved && saved.fundTxHash === FUND_TX_S71 && saved.bridgePhase === "funded" && saved.burnTx === hashes[0]);
    ok("satora bridge exec (Base): the creation carried the bridge fields on the shipped gasless body",
      creates.length === 1 && creates[0].bridge_source_chain === "Base" && creates[0].bridge_source_token_address === BASE_USDC_S71
      && creates[0].gasless === true && creates[0].extra_fees === 50 && creates[0].evm_chain_id === 42161);
    ok("satora bridge exec (Base): approve (exact) precedes the burn, and the burn is the pinned depositForBurn",
      baseSends.length === 2 && String(baseSends[0].to).toLowerCase() === BASE_USDC_S71.toLowerCase()
      && String(baseSends[1].to).toLowerCase() === SATORA_CCTP_TOKEN_MESSENGER_V2.toLowerCase()
      && baseSends[1].hash === hashes[0]
      && checkSatoraCctpEvmBurn({ to: baseSends[1].to, data: ethers.Transaction.from(baseSends[1].raw).data }, { userAddress: USER_S71, amountRaw: "20000000", burnToken: BASE_USDC_S71, destinationCaller: USER_S71, maxFeeRaw: "3120" }).ok === true
      && approvals.length === 1 && approvals[0].chainKey === "base" && approvals[0].spender === SATORA_CCTP_TOKEN_MESSENGER_V2 && approvals[0].amount === "20000000");
    ok("satora bridge exec (Base): the burn id was persisted BEFORE broadcast (the store snapshot at send time carries it)",
      !!snapshotAtBurn && JSON.parse(snapshotAtBurn)[0].burnTx === hashes[0]);
    ok("satora bridge exec (Base): the funding pulled the NETTED amount (components + approval)",
      funds.length === 1
      && new ethers.Interface(["function approve(address,uint256) returns (bool)"]).decodeFunctionData("approve", funds[0].calls[0].call_data)[1] === 19996880n);
  }

  // ---- Executor end to end: Solana ----
  {
    const creates = [], funds = [], solanaSends = [];
    const store = storeS71();
    let snapshotAtSend = null;
    const attestation = { message: cctpMessage71({ sourceDomain: 5 }), attestation: "0x" + "aa".repeat(65) };
    const { base58: base58S71 } = await import("@scure/base");
    const hashes = await withStubs71(
      { creates, funds, attestation, compNetRaw: "19997600", solanaSends, onSolanaSend: () => { snapshotAtSend = store.getItem("fluid_satora_swaps_v1"); } },
      { arbUsdcRaw: 19997600n },
      async () => {
        const route = (await getSwapRoutes({ fromChainKey: "solana", toChainKey: "bitcoin", fromTokenAddress: SOL_USDC_S71, toTokenAddress: "btc", fromAmount: "20000000", fromAddress: SOL_OWNER_S71, toAddress: BTC_DEST_S71 }))[0];
        return executeSatoraSwapRoute(walletS71, route, () => {}, { storage: store });
      });
    const saved = loadSatoraSwapRecords(store)[0];
    const txBytes = Buffer.from(solanaSends[0], "base64");
    const ownerSig = txBytes.slice(1, 65);
    const burnId = base58S71.encode(new Uint8Array(ownerSig));
    ok("satora bridge exec (Solana): returns [burn signature, funding] and the record lands funded",
      hashes.length === 2 && hashes[0] === burnId && hashes[1] === FUND_TX_S71 && !!saved && saved.burnTx === burnId && saved.bridgePhase === "funded");
    ok("satora bridge exec (Solana): exactly one burn broadcast, persisted before it, carrying the pinned terms",
      solanaSends.length === 1 && !!snapshotAtSend && JSON.parse(snapshotAtSend)[0].burnTx === burnId
      && Buffer.from(txBytes).toString("hex").includes("d73c3d2e723780b0" + "002d310100000000" + "03000000")
      && Buffer.from(txBytes).toString("hex").includes(USER_S71.toLowerCase().replace("0x", "").padStart(64, "0"))
      && Buffer.from(txBytes).toString("hex").includes("6009000000000000" + "e8030000"));
    ok("satora bridge exec (Solana): the owner's signature on the broadcast verifies against the wallet's Solana key",
      ed25519.verify(new Uint8Array(ownerSig), new Uint8Array(txBytes.slice(1 + 128)), base58S71.decode(SOL_OWNER_S71)) === true);
    ok("satora bridge exec (Solana): the creation used the shipped gasless body + Solana bridge fields; funding pulled the netted amount",
      creates.length === 1 && creates[0].bridge_source_chain === "Solana" && creates[0].gasless === true
      && new ethers.Interface(["function approve(address,uint256) returns (bool)"]).decodeFunctionData("approve", funds[0].calls[0].call_data)[1] === 19997600n);
  }

  // ---- Resume: never re-burns; mints when it must; funds when landed ----
  {
    const funds = [], baseSends = [], arbSends = [];
    const store = storeS71();
    saveSatoraSwapRecord(store, bridgedRecord71());
    const advanced = await withStubs71(
      { funds, attestation: { message: cctpMessage71({ sourceDomain: 6 }), attestation: "0x" + "aa".repeat(65) } },
      { baseSends, arbSends },
      () => resumeSatoraBridgedSwaps(walletS71, store));
    const saved = loadSatoraSwapRecords(store)[0];
    ok("satora bridge resume: an attesting Base record funds with ZERO new burns",
      advanced === 1 && baseSends.length === 0 && arbSends.length === 0 && funds.length === 1
      && saved.fundTxHash === FUND_TX_S71 && saved.bridgePhase === "funded" && saved.burnTx === "0x" + "cd".repeat(32));
  }
  {
    // Minting path: the balance is short until receiveMessage is
    // submitted by the user's own Arbitrum key (destinationCaller
    // = the user), then the funding proceeds.
    const funds = [], arbSends = [];
    const store = storeS71();
    let minted = false;
    const rec = bridgedRecord71({ bridgePhase: "minting", bridge: { ...bridgedRecord71().bridge, attestation: { message: cctpMessage71({ sourceDomain: 6 }), attestation: "0x" + "aa".repeat(65) } } });
    saveSatoraSwapRecord(store, rec);
    const advanced = await withStubs71(
      { funds },
      { arbSends, balanceOf: () => (minted ? 19996880n : 0n), onSend: ({ isArb, entry }) => { if (isArb && String(entry.to).toLowerCase() === SATORA_CCTP_MESSAGE_TRANSMITTER_V2.toLowerCase()) minted = true; } },
      () => resumeSatoraBridgedSwaps(walletS71, store));
    const saved = loadSatoraSwapRecords(store)[0];
    ok("satora bridge resume: receiveMessage is submitted by the user's own key, then the swap funds",
      advanced === 1 && arbSends.length === 1 && String(arbSends[0].to).toLowerCase() === SATORA_CCTP_MESSAGE_TRANSMITTER_V2.toLowerCase()
      && saved.bridge.mintTx === arbSends[0].hash && saved.fundTxHash === FUND_TX_S71);
  }
  {
    const funds = [], solanaSends = [];
    const store = storeS71();
    saveSatoraSwapRecord(store, bridgedRecord71({
      bridge: { name: "Solana", domain: 5, sourceChainKey: "solana", sourceTokenAddress: SOL_USDC_S71, maxFeeRaw: "2400", netSourceAmountRaw: "19997600", irisFeeBpsHundredths: 100, destinationCaller: USER_S71, mintTx: null, attestation: null },
      burnTx: "5BurnSignature111111111111111111111111111111111",
    }));
    const advanced = await withStubs71(
      { funds, compNetRaw: "19997600", attestation: { message: cctpMessage71({ sourceDomain: 5 }), attestation: "0x" + "aa".repeat(65) }, solanaSends },
      { arbUsdcRaw: 19997600n },
      () => resumeSatoraBridgedSwaps(walletS71, store));
    const saved = loadSatoraSwapRecords(store)[0];
    ok("satora bridge resume: an attesting Solana record funds with ZERO new broadcasts",
      advanced === 1 && solanaSends.length === 0 && funds.length === 1 && saved.fundTxHash === FUND_TX_S71);
  }

  // ---- Copy: intent + history ----
  {
    const intent = formatSatoraSwapIntent({ route: route71("Base") });
    ok("satora bridge copy: the intent names the crossing, its fee and its irreversibility",
      intent.includes("on Base") && intent.includes("Circle's transfer fee") && intent.includes("crosses from Base to Arbitrum")
      && intent.includes("can't be cancelled") && intent.includes("can only land in your own wallet")
      && intent.includes("Two small transactions on Base") && intent.includes("WBTC/tBTC"));
    const intentSol = formatSatoraSwapIntent({ route: { ...route71("Solana"), satora: { ...route71("Solana").satora, bridge: { ...bridgePlan71("Solana"), cctpFeeUsd: 0.0024 } } } });
    ok("satora bridge copy: the Solana intent discloses the network fee + message-account rent",
      intentSol.includes("on Solana") && intentSol.includes("0.0012 SOL"));
    ok("satora bridge copy: the history line states the crossing verbatim until the mint lands",
      satoraSwapHistoryLine(bridgedRecord71()).includes("USDC has left Base and is crossing to Arbitrum — this step can't be cancelled, and the money can only land in your own wallet.")
      && satoraSwapHistoryLine(bridgedRecord71({ bridgePhase: "funding" })).includes("landed on Arbitrum")
      && satoraSwapHistoryLine(bridgedRecord71({ burnTx: null })).includes("has not started yet"));
  }

  // ---- Dispatcher isolation + wiring ----
  {
    // With every other router stubbed "no route", the search may
    // legitimately end in the last-resort router's error — the
    // isolation property is that no SATORA route is ever produced.
    const searchOrNull = async (args) => { try { return await getSwapRoutes(args); } catch { return null; } };
    const routes = await withStubs71({}, {}, () => searchOrNull({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: BASE_USDC_S71, toTokenAddress: ARB_USDC_S71, fromAmount: "20000000", fromAddress: USER_S71, toAddress: USER_S71 }));
    ok("satora bridge: an EVM destination never produces a Satora route from a bridge source",
      routes === null || routes.every(r => r.provider !== "satora"));
    const routesBsc = await withStubs71({}, {}, () => searchOrNull({ fromChainKey: "bsc", toChainKey: "bitcoin", fromTokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", toTokenAddress: "btc", fromAmount: "20000000", fromAddress: USER_S71, toAddress: BTC_DEST_S71 }));
    ok("satora bridge: BSC sources never produce a Satora route", routesBsc === null || routesBsc.every(r => r.provider !== "satora"));
    const appSrc71 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const coreSrc71 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    ok("satora bridge: wiring — resume runs on unlock + the poll tick, the executor gets the approval recorder, Solana sources link the Solana explorer",
      appSrc71.includes("resumeSatoraBridgedSwaps(wallet, localStorage)") && appSrc71.includes("fromKey === \"solana\" ? SOLANA_EXPLORER")
      && coreSrc71.includes("bridge_source_chain") && coreSrc71.includes("computeSatoraCctpMaxFee"));
  }
}

// 72. Unpriced-native home fix (owner screenshots, 2026-11-09): a held
// NATIVE asset whose price never arrived was buried in the collapsed
// "Other tokens — Unverified or unpriced" group while the hero and the
// family header printed a bare $0.00. Ground truth at diagnosis: the
// owner's Algorand account holds 0.898 ALGO and zero ASAs — the buried
// row WAS the native. Two coupled defects: (i) splitRows sent any row
// with rowUsdValue == null (or verified === false) to the group, and
// the Algorand native row carries neither a verified flag nor a
// priceUsd; (ii) getPrices was all-or-nothing per round — Binance
// geo-blocked (HTTP 451 error OBJECT, not a list), the single ~28-id
// CoinGecko batch then failing left every symbol unpriced at once.
{
  const { splitHomeRows, countUnpricedHoldings, mergeCgFallbackPrices } = await import("../src/wallet-core.js");
  const ALGO_ROW = { symbol: "ALGO", name: "Algorand", amount: "0.898", address: null, decimals: 6, verified: true };
  const ASA_ROW = { symbol: "ASA 123", name: "Algorand asset", amount: "50", address: "123", decimals: 0, verified: false, priceUsd: null };
  // (a) native held, price missing → main with its amount, v null.
  {
    const sp = splitHomeRows([ALGO_ROW, ASA_ROW], () => null, (b) => !b.address);
    ok("unpriced native: a held native row with no price renders in main, not the Other group",
      sp.main.length === 1 && sp.main[0].b === ALGO_ROW && sp.main[0].v === null && sp.other.length === 1);
    ok("unpriced native: the held native sorts as held in main (ahead of zeros)",
      splitHomeRows([{ ...ALGO_ROW, amount: "0" }, ALGO_ROW], () => null, (b) => !b.address).main[0].b.amount === "0.898");
  }
  // (b) a genuine token, unpriced → still grouped; unverified stays
  // grouped even when priced (the owner's quarantine, unchanged).
  {
    const tok = { symbol: "MEME", amount: "10", address: "0xabc", verified: true };
    ok("unpriced native: an unpriced non-native token still lands in the Other group",
      splitHomeRows([tok], () => null, () => false).other.length === 1);
    ok("unpriced native: an unverified token stays grouped even with a price",
      splitHomeRows([{ ...tok, verified: false }], () => 5, () => false).other.length === 1);
    ok("unpriced native: a verified priced token renders in main",
      splitHomeRows([tok], () => 5, () => false).main.length === 1);
  }
  // Native wins over a stray unverified flag and over a failed read —
  // the test is first and unconditional.
  {
    const flagged = { ...ALGO_ROW, verified: false };
    const failed = { ...ALGO_ROW, amount: null };
    ok("unpriced native: a native row flagged verified:false still renders in main",
      splitHomeRows([flagged], () => 0.09, (b) => !b.address).main.length === 1);
    ok("unpriced native: a failed native read (amount null) stays a visible main row",
      splitHomeRows([failed], () => null, (b) => !b.address).main.length === 1);
  }
  // countUnpricedHoldings: the hero-note counter.
  {
    const groups = [
      [[ALGO_ROW], () => null],
      [[{ symbol: "X", amount: "0", priceUsd: null }, { symbol: "Y", amount: null, priceUsd: null },
        { symbol: "Z", amount: "3", priceUsd: 2 }, { symbol: "W", amount: "4", priceUsd: null }], () => 9],
      [[{ symbol: "Q", amount: "7" }], () => 1.5],
    ];
    ok("unpriced native: counter counts held+unpriced rows only (explicit priceUsd:null beats the symbol table; zeros and failed reads excluded)",
      countUnpricedHoldings(groups) === 2);
    ok("unpriced native: counter is zero when everything held is priced",
      countUnpricedHoldings([[[ALGO_ROW], () => 0.09]]) === 0);
  }
  // (c) price resilience: batch source A fails wholesale, source B
  // (per-symbol CoinGecko) prices the native; a batch that answered
  // partially is only topped up, never stripped.
  {
    const out = { USDC: 1, USDT: 1, DAI: 1 };
    const stub = async (url) => {
      if (url.includes("ids=algorand")) return { json: async () => ({ algorand: { usd: 0.091143 } }) };
      if (url.includes("ids=bitcoin")) return { json: async () => ({ bitcoin: { usd: 81234 } }) };
      throw new Error("source error body");
    };
    await mergeCgFallbackPrices(out, stub);
    ok("unpriced native: per-symbol fallback prices ALGO and BTC after the batch failed wholesale",
      out.ALGO === 0.091143 && out.BTC === 81234);
    ok("unpriced native: per-symbol fallback never removes a price already present",
      out.USDC === 1 && out.USDT === 1);
    const out2 = { BNB: 690 };
    await mergeCgFallbackPrices(out2, async (url) => {
      if (url.includes("ids=algorand")) throw new Error("down");
      return { json: async () => ({}) };
    });
    ok("unpriced native: a symbol no source can price stays absent (honest), others untouched",
      out2.ALGO === undefined && out2.BNB === 690);
  }
  // App wiring (source pins, matching house style).
  {
    const appSrc72 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const coreSrc72 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
    ok("unpriced native: splitRows delegates to splitHomeRows with the family native test",
      appSrc72.includes("return splitHomeRows(rows, (b) => rowUsdValue(b, symPriceOf(b)), isNative);")
      && appSrc72.includes("splitRows(visible, priceOf, (b) => isNativeRow(famKey, b))"));
    ok("unpriced native: token rows and scalar rows carry the 'price unavailable' marker",
      appSrc72.includes(`<small>price unavailable</small>`)
      && appSrc72.includes("if (price == null && Number(bal) > 0)"));
    ok("unpriced native: a true-zero token row keeps its truthful $0.00, not the unavailable marker",
      appSrc72.includes(`Number(b.amount) > 0 ? \`<b>\${fmt(b.amount)}</b><small>price unavailable</small>\``));
    ok("unpriced native: family card headers use cardTotalHtml with the native amount + 'no live price'",
      appSrc72.includes("cardTotalHtml(key, totalVal)") && appSrc72.includes("· no live price")
      && appSrc72.includes("unpricedNativeByKey"));
    ok("unpriced native: the hero sub carries the '+ holdings with no live price' note",
      appSrc72.includes(`+ holdings with no live price`) && appSrc72.includes("hasUnpricedHoldings()"));
    ok("unpriced native: scalar rows treat a missing price (null or undefined) as unavailable, never $0.00 for a held coin",
      appSrc72.includes("if (price == null && Number(bal) > 0)")
      && appSrc72.includes("scalarAmtHtml(btcLoadFailed, btcBal + btcTrBal, prices.BTC)"));
    ok("unpriced native: the cache hydrates before the price load and live prices merge over the cached floor",
      appSrc72.includes("const cachedPriceSnapshot = { ...prices };")
      && appSrc72.includes("prices = { ...cachedPriceSnapshot, ...p };")
      && appSrc72.indexOf("hydrateBalanceCache(w);") < appSrc72.indexOf("const cachedPriceSnapshot")
      && (appSrc72.match(/hydrateBalanceCache\(w\);/g) || []).length === 1);
    ok("unpriced native: getPrices rejects a non-list Binance body and tops up per symbol",
      coreSrc72.includes("Binance price response was not a list") && coreSrc72.includes("await mergeCgFallbackPrices(out)"));
  }
}

// 73. NG sell under the CAPTURE GATE (2026-11-09, owner's ruling
// ~13:51 WAT): the second NG sell row that stood here under the
// NG-repair decision was REMOVED IN FULL the same day — it has no
// referral parameter (measured) and its hosted/link-out shape
// admits no non-custodial own-charge mechanism in the ramp-fee
// design study, so the gate removes it; an honest sheet beats an
// unpaid route. These pins assert the ABSENCE end-state (the
// NoOnes-pull pattern): the removed provider appears in no
// corridor, no mode, no table. (NG sell's last remaining row —
// the African off-ramp provider restored the same day — was
// itself REMOVED IN FULL 2026-11-10 on the owner's direct
// order; §74 pins that end-state, and the first pin below now
// asserts the honestly empty NG sell sheet.) Evidence:
// research_notes/fluid-ramp-disclosure-global-audit-20261109/
// report.md (§1.9).
{
  const ngSell = rampRoutesFor("NG", "sell", "bsc", "BNB").routes;
  ok("capture gate + 2026-11-10 removal: NG sell sheet is honestly empty", ngSell.length === 0);
  ok("capture gate: the removed provider appears in no corridor and never on a buy sheet",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r =>
        !/noblocks/i.test(r.name + (r.url || "") + r.note)))));
  ok("capture gate: the removed provider holds no static link, caps entry or plan row",
    !("Noblocks" in RAMP_STATIC_LINKS) && !("Noblocks" in RAMP_ADDRESS_ENTRY)
    && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Noblocks")));
  ok("capture gate: NG buy still resolves empty on every network/asset",
    rampRoutesFor("NG", "buy", "bsc", "BNB").routes.length === 0
    && rampRoutesFor("NG", "buy", "base", "USDC").routes.length === 0);
  ok("removal: the NG plan is empty", RAMP_COUNTRY_PLAN.NG.length === 0);
}

// 74. Fonbnk removal (2026-11-10, owner's direct order —
// "Scrap Fonbnk"): the provider restored for one day
// (2026-11-09, §74 as it stood) is REMOVED IN FULL — every plan
// row, note, link builder, network code and address-entry
// entry. These pins assert the ABSENCE end-state (the
// NoOnes/Noblocks-pull pattern): the provider appears in no
// corridor, no mode, no table; its ten former sell corridors
// resolve to the honest empty state (ZA keeps Mt Pelerin
// alone), and no network carries its network code.
{
  const CORRIDORS = ["NG", "KE", "GH", "ZA", "UG", "TZ", "CM", "SN", "CI", "ZM"];
  ok("removal: the scrapped provider appears in no route, note or URL anywhere",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !/fonbnk/i.test(r.name + (r.url || "") + r.note)))));
  ok("removal: no plan row, static link or address-entry entry survives",
    !("Fonbnk" in RAMP_STATIC_LINKS) && !("Fonbnk" in RAMP_ADDRESS_ENTRY)
    && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Fonbnk")));
  ok("removal: no network carries the provider's network code",
    Object.values(NETWORKS).every(n => !("fonbnkNetwork" in n)));
  // (GH left this set later on 2026-11-10: its sell side gained
  // the labelled LocalCoinSwap external-marketplace row after a
  // fresh live book check — §16c pins that end-state.)
  ok("removal: the eight still-empty sell-only corridors are honestly empty on both sides",
    CORRIDORS.filter(code => code !== "ZA" && code !== "GH").every(code => ["buy", "sell"].every(m =>
      rampRoutesFor(code, m, "bsc", "USDC").routes.length === 0)));
  ok("removal: ZA keeps Mt Pelerin alone on both sides, badge buy-only",
    JSON.stringify(rampRoutesFor("ZA", "sell", "bsc", "USDT").routes.map(r => r.name)) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(rampRoutesFor("ZA", "sell", "bsc", "USDT").routes.filter(r => r.badge).map(r => r.name)) === JSON.stringify([])
    && JSON.stringify(rampRoutesFor("ZA", "buy", "bsc", "USDT").routes.filter(r => r.badge).map(r => r.name)) === JSON.stringify(["Mt Pelerin"]));
  ok("removal: Mercuryo still appears in no route, note, URL or table",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !/mercuryo/i.test(r.name + (r.url || "") + r.note))))
    && !("Mercuryo" in RAMP_STATIC_LINKS) && !("Mercuryo" in RAMP_ADDRESS_ENTRY)
    && RAMP_COUNTRIES.every(c => RAMP_COUNTRY_PLAN[c.code].every(([n]) => n !== "Mercuryo")));
}

// ---------- Black + Bitcoin-orange retheme (2026-11-09 spec) ----------
{
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const recSrc = readFileSync(new URL("../tools/recovery.html", import.meta.url), "utf8");
  const buildSrc = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  const pubSrc = readFileSync(new URL("../scripts/publish.mjs", import.meta.url), "utf8");
  const OLD_BLUE = ["#5b8cff", "#9d6bff", "#38bdf8", "#05070d", "#0b101f", "#111830", "#1a2247",
    "#232b52", "#171e3a", "#0a0f1e", "#ffb84d", "#c9a8ff", "148,163,255", "91,140,255", "56,130,246"];
  ok("theme: the old blue/violet palette survives nowhere in chrome sources",
    OLD_BLUE.every(c => !idxSrc.includes(c) && !appSrc.includes(c)));
  ok("theme: canvas/surface/warm-text tokens carry the spec values",
    ["--bg0:#070606", "--surface-1:#0e0d0c", "--surface-2:#161413", "--surface-3:#211e1c",
     "--surface-input:#0b0a09", "--txt:#faf6f0", "--dim:#a79e93", "--faint:#847c70",
     "--hairline:rgba(255,226,188,.09)", "--hairline-strong:rgba(255,226,188,.19)",
     "--brand-deep:#e85d04", "--on-brand:#1a1000", "--brand-tint:rgba(247,147,26,.12)",
     "--brand-line:rgba(247,147,26,.38)", "--sh-brand:0 8px 24px rgba(247,147,26,.28)",
     "--warn:#ffcf4d", "--good:#2fd08c", "--bad:#ff6b7a"].every(t => idxSrc.includes(t)));
  ok("theme: gradient inventory is exactly the three spec recipes in index.html",
    (() => { const g = [...idxSrc.matchAll(/(?:linear|radial)-gradient\([^;]*\)/g)].map(m => m[0]);
      const allowed = [
        "--grad-brand:linear-gradient(180deg,#ffa726 0%,#f7931a 100%)",
        ".btn:active{ transform:scale(.98); background:linear-gradient(180deg,#f7931a 0%,#e85d04 100%); }",
        "--grad-drop:linear-gradient(160deg,#ffbe0b 0%,#f7931a 48%,#e85d04 100%)",
        "--grad-hero-glow:radial-gradient(720px 420px at 50% -10%, rgba(247,147,26,.14), rgba(7,6,6,0) 62%)",
        "background:linear-gradient(180deg,#262019,#171310)",
        "linear-gradient(var(--surface-2),var(--surface-2)) padding-box, linear-gradient(135deg, var(--brand-line), rgba(247,147,26,.06)) border-box",
        "background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%)",
        "background:linear-gradient(180deg, rgba(14,13,12,0), var(--surface-1) 26%)",
        "background:linear-gradient(180deg, rgba(14,13,12,0), var(--surface-1) 22%)"];
      return g.length === 9 && g.every(x => allowed.some(a => a.includes(x))); })());
  ok("theme: droplet sprite + success ring carry the orange ramp, check stays green",
    idxSrc.includes('<stop offset="0" stop-color="#ffbe0b"/><stop offset=".48" stop-color="#f7931a"/><stop offset="1" stop-color="#e85d04"/>')
    && appSrc.includes('<stop offset="0" stop-color="#ffbe0b"/><stop offset=".48" stop-color="#f7931a"/><stop offset="1" stop-color="#e85d04"/>')
    && appSrc.includes('stroke="#2fd08c"'));
  ok("theme: primary button text is warm black on orange — never white",
    idxSrc.includes("color:var(--on-brand)") && !/\.btn\{[^}]*color:#fff/.test(idxSrc)
    && idxSrc.includes("--on-brand:#1a1000"));
  ok("theme: self-hosted fonts wired — faces, tokens, preload, build + publish plumbing",
    idxSrc.includes('font-family:"Inter"') && idxSrc.includes('font-family:"Space Grotesk"')
    && idxSrc.includes('href="/fonts/inter-var.woff2"')
    && idxSrc.includes('--font-sans:"Inter"') && idxSrc.includes('--font-display:"Space Grotesk"')
    && buildSrc.includes("public/fonts/inter-var.woff2") && pubSrc.includes("fonts/inter-var.woff2"));
  ok("theme: font payload inside the spec budget (Inter ≤48 KB, total ≤78 KB)",
    statSync(new URL("../public/fonts/inter-var.woff2", import.meta.url)).size <= 48 * 1024
    && statSync(new URL("../public/fonts/inter-var.woff2", import.meta.url)).size
       + statSync(new URL("../public/fonts/space-grotesk-var.woff2", import.meta.url)).size <= 78 * 1024);
  ok("theme: QR receive stays on a pure-white card (radius 20, 16px quiet zone)",
    idxSrc.includes(".qr{ display:block; margin:10px auto; background:#ffffff; border-radius:20px; padding:16px; width:228px; }"));
  ok("theme: tab bar is warm-tinted with the orange active state",
    idxSrc.includes("background:rgba(10,8,7,.86)") && idxSrc.includes(".tab.on{ color:var(--brand-1); }"));
  ok("theme: CHEAPEST badge is brand tint + orange text; game card is flat surface",
    idxSrc.includes(".pill{ font-size:11px; background:var(--brand-tint); color:var(--drop);")
    && idxSrc.includes(".game{ background:var(--surface-1);"));
  ok("theme: recovery tool wears the same black/orange chrome",
    recSrc.includes("--bg:#070606") && recSrc.includes("--acc:#f7931a") && recSrc.includes("color:var(--onacc)")
    && !recSrc.includes("#0b1220") && !recSrc.includes("#1e2c4a"));
}

// 76. Ramp disclosure + badge honesty + capture gate (2026-11-09,
// owner's rulings 13:29–13:51 WAT; spec:
// research_notes/fluid-ramp-disclosure-global-audit-20261109/
// report.md Part 1). Pins: F1 Mt Pelerin minimums in-sheet,
// F4 the (now-removed) interim minimum line, P0-4 the global
// CHEAPEST badge rule (Class 1 + completes at small ticket +
// cheapest among qualifying, judged per mode), P1-10 the Mt
// Pelerin 7-day hold (buy-side), P1-11 per-mode notes, P1-12 the
// SWIFT line on the 12 own-fiat corridors, F5 the swap route
// cost label, the capture gate's removals, and the 2026-11-10
// removal's corridor consequences (the F4 interim line and the
// own-charge disclosure left with the scrapped rows). (The
// specced F2 Paybis $5 note and F3
// Spritz rewrite are SUPERSEDED by the owner's capture-gate
// ruling of 2026-11-09 ~14:34 WAT — both providers were removed
// in full, strictly by the gate; their pins below assert the
// removal's corridor consequences instead.)
{
  const note = (code, mode, name) => (rampRoutesFor(code, mode, "bsc", "USDC").routes.find(r => r.name === name) || {}).note || "";
  const badges = (code, mode) => rampRoutesFor(code, mode, "bsc", "USDC").routes.filter(r => r.badge).map(r => r.name);

  // F1 / P0-3 — Mt Pelerin minimums, both sides, everywhere.
  ok("F1: DE sell note states the CHF 50 sell minimum", note("DE", "sell", "Mt Pelerin").includes("CHF 50"));
  ok("F1: DE buy note states the CHF 1 buy minimum", note("DE", "buy", "Mt Pelerin").includes("CHF 1"));
  ok("F1: FR sell note states the CHF 50 sell minimum (extension corridor)", note("FR", "sell", "Mt Pelerin").includes("CHF 50"));
  ok("F1: every Mt Pelerin corridor carries both minimums", RAMP_COUNTRIES.every(c =>
    rampRoutesFor(c.code, "sell", "bsc", "USDC").routes.every(r => r.name !== "Mt Pelerin" || r.unavailable || r.note.includes("CHF 50"))
    && rampRoutesFor(c.code, "buy", "bsc", "USDC").routes.every(r => r.name !== "Mt Pelerin" || r.unavailable || r.note.includes("CHF 1"))));

  // Capture-gate removal (owner ruling 2026-11-09 ~14:34 WAT,
  // superseding the specced F2/F3 note fixes): Paybis and Spritz
  // are gone from every corridor; the consequences are pinned.
  ok("gate removal: US carries no navigating route and no badge on either side",
    ["buy", "sell"].every(m => {
      const rs = rampRoutesFor("US", m, "bsc", "USDC").routes;
      return rs.every(r => r.unavailable === true && r.url === null && r.badge === false);
    }));
  ok("gate removal: IN/BR/PH/ID are honestly empty on both sides",
    ["IN", "BR", "PH", "ID"].every(code => ["buy", "sell"].every(m =>
      rampRoutesFor(code, m, "bsc", "USDC").routes.length === 0)));
  ok("gate removal + 2026-11-10 scrap: ZA sell is Mt Pelerin only, no removed row",
    JSON.stringify(rampRoutesFor("ZA", "sell", "bsc", "USDC").routes.map(r => r.name)) === JSON.stringify(["Mt Pelerin"]));
  ok("gate removal: GB/DE/MX keep Mt Pelerin only",
    ["GB", "DE", "MX"].every(code => ["buy", "sell"].every(m =>
      JSON.stringify(rampRoutesFor(code, m, "bsc", "USDC").routes.map(r => r.name)) === JSON.stringify(["Mt Pelerin"]))));
  ok("gate removal: the removed providers appear in no assembled route, note or URL",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !/paybis|spritz/i.test(r.name + (r.url || "") + r.note)))));
  ok("gate removal: the F2/F3 strings never shipped",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r =>
        !r.note.includes("orders start at $5") && !r.note.includes("$2 minimum fee") && !r.note.includes("For Spritz account holders")))));

  // F4 — the interim minimum line left with the scrapped rows
  // (2026-11-10 removal): the corridors that carried it are
  // honestly empty on sell now (ZA keeps Mt Pelerin alone), and
  // no assembled note anywhere carries the line.
  ok("removal: CM/SN/CI/ZM sell sheets are honestly empty", ["CM", "SN", "CI", "ZM"].every(code =>
    rampRoutesFor(code, "sell", "bsc", "USDC").routes.length === 0));
  ok("removal: no assembled note carries the interim minimum line", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
    rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !r.note.includes("sets its own minimum inside the widget")))));

  // P0-4 — the badge rule's audit outcomes.
  ok("badge rule: US carries no badge on either side", badges("US", "buy").length === 0 && badges("US", "sell").length === 0);
  ok("badge rule: DE/FR/ZA sell sheets are unbadged, buy sheets badge Mt Pelerin only",
    ["DE", "FR", "ZA"].every(code => badges(code, "sell").length === 0
      && JSON.stringify(badges(code, "buy")) === JSON.stringify(["Mt Pelerin"])));
  ok("badge rule: IN/BR/PH carry no badge on either side",
    ["IN", "BR", "PH"].every(code => badges(code, "buy").length === 0 && badges(code, "sell").length === 0));
  ok("badge rule: every Mt Pelerin corridor badges buy-only",
    RAMP_COUNTRIES.every(c => {
      const b = badges(c.code, "buy"), s = badges(c.code, "sell");
      return s.length === 0 && (b.length === 0 || (b.length === 1 && b[0] === "Mt Pelerin"));
    }));
  ok("badge rule: global invariants re-asserted — ≤1 badge per sheet, badge only on rank 0",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
      const { routes } = rampRoutesFor(c.code, m, "bsc", "USDT");
      const b = routes.filter(r => r.badge);
      return b.length <= 1 && (b.length === 0 || routes[0].badge === true);
    })));

  // P1-10 — the 7-day hold is a buy-side fact.
  ok("P1-10: DE buy note discloses the 7-day hold", note("DE", "buy", "Mt Pelerin").includes("7 days"));
  ok("P1-10: DE sell note carries no hold line", !note("DE", "sell", "Mt Pelerin").includes("7 days"));

  // P1-11 — per-mode copy: sell sheets lead on sell terms.
  ok("P1-11: DE sell note leads on sell terms, no buy-fee line",
    note("DE", "sell", "Mt Pelerin").includes("Sells start at CHF 50") && !note("DE", "sell", "Mt Pelerin").includes("first CHF 500"));
  ok("P1-11: no navigating sell note anywhere carries buy-rate copy",
    RAMP_COUNTRIES.every(c =>
      rampRoutesFor(c.code, "sell", "bsc", "USDC").routes.every(r =>
        r.unavailable || (!r.note.includes("bank buy") && !r.note.includes("0% fee on your first CHF 500")))));
  ok("P1-11: the stale dated rate claim is gone everywhere",
    RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
      rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r => !/market rate on 6 Nov/.test(r.note)))));

  // 2026-11-10 copy pass (hiccup dossier §6–§7): the CHF 50 sell
  // minimum is waived entirely for personal-IBAN holders, so every
  // Mt Pelerin sell note leads with that zero-minimum path instead of
  // presenting CHF 50 as a wall; the dollar conversion is the live
  // CHF 50 figure (≈ $61 at 2026-11-10 FX — re-check FX and update
  // the note + this pin together when it drifts).
  ok("MTP-COPY: DE sell note leads with the zero-minimum personal-IBAN path",
    note("DE", "sell", "Mt Pelerin").includes("or any amount if you hold a free personal Mt Pelerin IBAN"));
  ok("MTP-COPY: DE sell note carries the corrected CHF 50 conversion and no stale figure",
    note("DE", "sell", "Mt Pelerin").includes("(about $61)") && !note("DE", "sell", "Mt Pelerin").includes("$57")
    && !note("DE", "sell", "Mt Pelerin").includes("unless you hold"));
  ok("MTP-COPY: every Mt Pelerin sell note everywhere carries the IBAN lead and keeps the sell terms",
    RAMP_COUNTRIES.every(c =>
      rampRoutesFor(c.code, "sell", "bsc", "USDC").routes.every(r =>
        r.name !== "Mt Pelerin" || r.unavailable ||
        (r.note.includes("or any amount if you hold a free personal Mt Pelerin IBAN")
          && r.note.includes("sell fee 0–1.3% by bank")
          && r.note.includes("~CHF 999/month") && !r.note.includes("$57")))));
  ok("MTP-COPY: the US sell note keeps its residents prefix with the IBAN lead and corrected figure",
    rampRoutesFor("US", "sell").routes[0].note.includes("Not available to US residents")
    && rampRoutesFor("US", "sell").routes[0].note.includes("or any amount if you hold a free personal Mt Pelerin IBAN")
    && rampRoutesFor("US", "sell").routes[0].note.includes("(about $61)"));

  // P1-12 — SWIFT line on the 15 own-fiat corridors, buy-side only
  // (12 from 2026-11-09 + JP/HK/NZ from batch 2, 2026-11-10; CH
  // rides SIC for free and carries no SWIFT line, like LI).
  ok("P1-12: GB buy note carries the SWIFT line", note("GB", "buy", "Mt Pelerin").includes("SWIFT"));
  ok("P1-12: DE buy note (SEPA) carries no SWIFT line", !note("DE", "buy", "Mt Pelerin").includes("SWIFT"));
  ok("P1-12: exactly the 15 own-fiat corridors carry the SWIFT line, buy-side only",
    ["ZA", "GB", "MX", "CA", "AU", "SG", "CZ", "DK", "HU", "NO", "PL", "SE", "JP", "HK", "NZ"].every(code =>
      note(code, "buy", "Mt Pelerin").includes("SWIFT") && !note(code, "sell", "Mt Pelerin").includes("SWIFT"))
    && ["DE", "FR", "AT", "NL", "CH"].every(code => !note(code, "buy", "Mt Pelerin").includes("SWIFT")));

  // Removal (2026-11-10) — the own-charge disclosure line left
  // with the scrapped rows; no assembled note carries it.
  ok("removal: no assembled note carries the scrapped rows' own-charge line", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m =>
    rampRoutesFor(c.code, m, "bsc", "USDC").routes.every(r =>
      !r.note.includes("adds its own small fee on top of") && !r.note.includes("quote itself is never reduced")))));

  // F5 — the swap route-list label prints TOTAL route cost.
  ok("F5: a stubbed Relay route renders its total route cost, not gas alone",
    (() => { const l = swapRouteCostLabel({ provider: "relay", routeFeeUsd: 0.3621, platformFeeUsd: 0, gasCostUSD: 0.0033 });
      return l.text === "route cost" && Math.abs(l.usd - 0.3621) < 1e-9; })());
  ok("F5: the disclosed Fluid fee is added on top of the route cost",
    (() => { const l = swapRouteCostLabel({ routeFeeUsd: 0.30, platformFeeUsd: 0.06, gasCostUSD: 0.0033 });
      return l.text === "route cost" && Math.abs(l.usd - 0.36) < 1e-9; })());
  ok("F5: routes without routeFeeUsd fall back to the gas figure",
    (() => { const l = swapRouteCostLabel({ gasCostUSD: 0.0033 });
      return l.text === "fees" && Math.abs(l.usd - 0.0033) < 1e-12; })());
  {
    const appSrc76 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    ok("F5: the route row renders through swapRouteCostLabel, never gasCostUSD alone",
      appSrc76.includes("swapRouteCostLabel(r).text") && appSrc76.includes("swapRouteCostLabel(r).usd")
      && !appSrc76.includes("fees ≈ ${usd(r.gasCostUSD)}"));
  }
}

// 77. Arc (chain 5042) first-class fixes (2026-11-09, verification
// report research_notes/fluid-arc-support-20261109/report.md):
// GAP-1 — Arc's native USDC lives at the ERC-20 predeploy
// 0x3600…0000; LI.FI lists it as a token, so the stable list, the
// balance reader and the token scan each used to surface it as a
// SECOND row over the native row (same funds, totals doubled, two
// indistinguishable send options). GAP-3 — Relay rejects LI.FI's
// 0xEeee… sentinel verbatim (INVALID_INPUT_CURRENCY) and quotes
// Arc's native coin at ordinary sizes only under the predeploy, so
// Relay requests now translate native picks per chain. GAP-4 —
// Across quotes Arc live (re-probed 2026-11-09, both directions at
// $5); coverage + handler/adapter/SpokePool pins come from that
// probe's own fee-bearing quote. GAP-2 — receive copy no longer
// hard-codes a network count that discovered chains falsify.
{
  const ARC_PRE = "0x3600000000000000000000000000000000000000";
  const ARC_HANDLER = "0xA07480456C4EbaD7626e4FdF4a180709E238547b";
  const ARC_ADAPTER = "0x446Fe2Be6a8D90fA89F30f3d0A686aAFfe621237";
  const ARC_POOL = "0x9b4A302A548c7e313c2b74C461db7b84d3074A84";
  const BASE_USDC_77 = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const BASE_POOL_77 = "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64";
  const USER77 = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";
  // The discovered-chain registration, carrying the predeploy in
  // its token list the way a stale on-device cache still can —
  // the GAP-1 reads below must stay single-row regardless.
  registerNetworks({ c5042: { name: "Arc", chainId: 5042, symbol: "USDC", priceSym: "USDC",
    rpc: "https://rpc.arc-stub.invalid", explorer: "https://explorer.arc.io",
    tokens: [{ symbol: "USDC", address: ARC_PRE, decimals: 6 }] } });

  ok("arc: the predeploy pin is Arc's USDC predeploy, matched per chain only",
    NATIVE_ASSET_PREDEPLOY[5042] === ARC_PRE && isNativePredeploy(5042, ARC_PRE)
    && !isNativePredeploy(8453, ARC_PRE) && !isNativePredeploy(5042, BASE_USDC_77));

  // GAP-1a — the stable-token list drops the mirror entry.
  const realFetch77 = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const body = String(url).includes("chains=5042")
        ? { tokens: { "5042": [{ symbol: "USDC", coinKey: "USDC", address: ARC_PRE, decimals: 6 }] } }
        : { tokens: { "8453": [{ symbol: "USDC", coinKey: "USDC", address: BASE_USDC_77, decimals: 6 },
                               { symbol: "USDT", coinKey: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 }] } };
      return { ok: true, status: 200, json: async () => body };
    };
    const arcToks = await fetchStableTokens(5042);
    ok("GAP-1: Arc's stable list drops the native predeploy mirror (no second USDC row)",
      Array.isArray(arcToks) && arcToks.length === 0);
    const baseToks = await fetchStableTokens(8453);
    ok("GAP-1: other chains keep their stable rows untouched",
      Array.isArray(baseToks) && baseToks.length === 2 && baseToks[0].address === BASE_USDC_77);
  } finally { globalThis.fetch = realFetch77; }

  // GAP-1b — the balance reader: a funded 1.0 native fixture reads
  // as exactly ONE row of 1.0 (the $1.00 total, never $2.00), even
  // with the predeploy still sitting in the network's token list.
  const defaultGetUrl77 = FetchRequest.createGetUrlFunc();
  try {
    FetchRequest.registerGetUrl(async (req) => {
      const parsed = JSON.parse(new TextDecoder().decode(req.body || new Uint8Array()));
      const answer = (r) => {
        let result;
        if (r.method === "eth_chainId") result = "0x13b2";
        else if (r.method === "net_version") result = "5042";
        else if (r.method === "eth_getBalance") result = "0xde0b6b3a7640000"; // 1.0 native
        else if (r.method === "eth_call") result = "0x00000000000000000000000000000000000000000000000000000000000f4240"; // balanceOf = 1,000,000 (the same 1.0)
        else throw new Error("unexpected rpc method " + r.method);
        return { jsonrpc: "2.0", id: r.id, result };
      };
      const payload = Array.isArray(parsed) ? parsed.map(answer) : answer(parsed);
      return new FetchResponse(200, "OK", { "content-type": "application/json" },
        new TextEncoder().encode(JSON.stringify(payload)));
    });
    const rows77 = await getBalances({ address: USER77 }, "c5042");
    ok("GAP-1: a funded 1.0 Arc USDC fixture reads as ONE row of 1.0 (never doubled)",
      rows77.length === 1 && rows77[0].symbol === "USDC" && rows77[0].amount === "1.0");
    // GAP-1c — the token scan never re-adds the mirror as a
    // discovered row: a predeploy-only list scans to nothing and
    // touches no RPC at all (the stub above would have answered).
    const scan77 = await scanEvmTokenBalances("c5042", USER77, [{ symbol: "USDC", address: ARC_PRE, decimals: 6 }]);
    ok("GAP-1: the token scan skips the native predeploy entirely",
      scan77.balances.size === 0 && scan77.method === "none");
  } finally { FetchRequest.registerGetUrl(defaultGetUrl77); }

  // GAP-3 — Relay request translation, both directions. The Arc
  // native pick arrives at the app's native scale (5 = 5e18 raw);
  // translated to the predeploy it must be re-denominated to the
  // predeploy's 6 decimals (5e6) or Relay reads a $5-quadrillion
  // swap (live-probed: INSUFFICIENT_LIQUIDITY).
  ok("arc: re-denomination is exact and truncates only dust",
    NATIVE_ASSET_PREDEPLOY_DECIMALS[5042] === 6
    && scaleRawAmount("5000000000000000000", 18, 6) === "5000000"
    && scaleRawAmount("5000000", 6, 18) === "5000000000000000000"
    && scaleRawAmount("1999999999999999999", 18, 6) === "1999999"
    && scaleRawAmount("42", 6, 6) === "42");
  const rqArcOut = buildRelayQuoteRequest({ fromChainKey: "c5042", toChainKey: "base", fromTokenAddress: LIFI_API_NATIVE_SENTINEL, toTokenAddress: BASE_USDC_77, fromAmount: "5000000000000000000", fromAddress: USER77, toAddress: USER77 }, { includeFee: false });
  ok("GAP-3: Relay Arc→Base names the predeploy for a LI.FI-sentinel pick, amount re-denominated",
    !!rqArcOut && rqArcOut.originCurrency === ARC_PRE && rqArcOut.destinationCurrency === BASE_USDC_77 && rqArcOut.amount === "5000000");
  const rqArcZero = buildRelayQuoteRequest({ fromChainKey: "c5042", toChainKey: "base", fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: BASE_USDC_77, fromAmount: "5000000000000000000", fromAddress: USER77, toAddress: USER77 }, { includeFee: false });
  ok("GAP-3: Relay Arc→Base names the predeploy for the native (zero-marker) pick, amount re-denominated",
    !!rqArcZero && rqArcZero.originCurrency === ARC_PRE && rqArcZero.amount === "5000000");
  const rqArcTok = buildRelayQuoteRequest({ fromChainKey: "c5042", toChainKey: "base", fromTokenAddress: ARC_PRE, toTokenAddress: BASE_USDC_77, fromAmount: "5000000", fromAddress: USER77, toAddress: USER77 }, { includeFee: false });
  ok("GAP-3: a direct predeploy pick passes through at its own scale, unscaled",
    !!rqArcTok && rqArcTok.originCurrency === ARC_PRE && rqArcTok.amount === "5000000");
  const rqArcIn = buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "c5042", fromTokenAddress: BASE_USDC_77, toTokenAddress: LIFI_API_NATIVE_SENTINEL, fromAmount: "5000000", fromAddress: USER77, toAddress: USER77 }, { includeFee: false });
  ok("GAP-3: Relay Base→Arc names the predeploy on the destination side",
    !!rqArcIn && rqArcIn.destinationCurrency === ARC_PRE && rqArcIn.amount === "5000000");
  const rqBaseNat = buildRelayQuoteRequest({ fromChainKey: "base", toChainKey: "arbitrum", fromTokenAddress: LIFI_API_NATIVE_SENTINEL, toTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", fromAmount: "5000000", fromAddress: USER77, toAddress: USER77 }, { includeFee: false });
  ok("GAP-3: the sentinel maps to the zero marker where no predeploy exists, amount untouched",
    !!rqBaseNat && rqBaseNat.originCurrency === LIFI_NATIVE_TOKEN && rqBaseNat.amount === "5000000");
  ok("GAP-3: token addresses pass through Relay translation untouched",
    relayCurrencyFor(5042, BASE_USDC_77) === BASE_USDC_77 && relayCurrencyFor(5042, ARC_PRE) === ARC_PRE);

  // GAP-4 — Across coverage, pins, eligibility, and a live-shaped
  // fee-bearing Base→Arc quote (fixture mirrors the 2026-11-09
  // probe: handler 0xA074…, adapter 0x446F…, 1632-byte message).
  ok("GAP-4: Across covers 5042 with the live-probed pins",
    ACROSS_CHAIN_IDS.has(5042) && ACROSS_HANDLERS[5042] === ARC_HANDLER
    && ACROSS_MESSAGE_ADAPTERS[5042] === ARC_ADAPTER && ACROSS_SPOKE_POOLS[5042] === ARC_POOL);
  const planArcOut = acrossSupportsPair({ fromChainKey: "c5042", toChainKey: "base", fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: BASE_USDC_77 });
  ok("GAP-4: an Arc native pick resolves to the predeploy USDC lane (ERC-20 pull, not deposit value)",
    !!planArcOut && planArcOut.asset === "USDC" && planArcOut.inputToken === ARC_PRE
    && planArcOut.outputToken === BASE_USDC_77 && planArcOut.nativeInput === false);
  const planArcIn = acrossSupportsPair({ fromChainKey: "base", toChainKey: "c5042", fromTokenAddress: BASE_USDC_77, toTokenAddress: LIFI_NATIVE_TOKEN });
  ok("GAP-4: Base USDC → Arc native pick is eligible, delivering the predeploy",
    !!planArcIn && planArcIn.outputToken === ARC_PRE && planArcIn.nativeOutput === false);
  const planArcTok = acrossSupportsPair({ fromChainKey: "base", toChainKey: "c5042", fromTokenAddress: BASE_USDC_77, toTokenAddress: ARC_PRE });
  ok("GAP-4: Base USDC → Arc predeploy pick is the same eligible lane",
    !!planArcTok && planArcTok.inputToken === BASE_USDC_77 && planArcTok.outputToken === ARC_PRE);
  const coder77 = ethers.AbiCoder.defaultAbiCoder();
  const b3277 = (a) => ethers.zeroPadValue(a, 32);
  const depIface77 = new ethers.Interface(["function deposit(bytes32 depositor,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,bytes32 exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityParameter,bytes message)"]);
  const erc2077 = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]);
  const INSTR77 = "tuple(tuple(address target, bytes data, uint256 value)[] calls, address fallbackRecipient)";
  const adapterBlob77 = (token, user, feeTo) => "0xd836083e" + coder77.encode(["uint256", "uint256", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "string"], [32n, 480n, 1n, 0n, token, 0n, 0n, 0n, 416n, 0n, user, feeTo, "None"]).slice(2);
  const handlerMsg77 = ({ token, feeTo, feeAmt, user, handler = ARC_HANDLER, adapter = ARC_ADAPTER }) => {
    const deliver = "0xef8738d3" + coder77.encode(["address", "address"], [token, user]).slice(2);
    const calls = [
      [token, erc2077.encodeFunctionData("transfer", [feeTo, feeAmt]), 0n],
      [handler, deliver, 0n],
      [handler, deliver, 0n],
      [adapter, adapterBlob77(token, user, feeTo), 0n],
    ];
    return coder77.encode([INSTR77], [[calls, "0x0000000000000000000000000000000000000000"]]);
  };
  const arcQuote77 = ({ handler = ARC_HANDLER, adapter = ARC_ADAPTER, appRaw = "4995" } = {}) => {
    const inAmt = "5000000", bridgeOut = "4995327", bridgeRaw = "4702";
    const hasFee = BigInt(appRaw) > 0n;
    const message = hasFee ? handlerMsg77({ token: ARC_PRE, feeTo: RELAY_APP_FEE_RECIPIENT, feeAmt: BigInt(appRaw), user: USER77, handler, adapter }) : "0x";
    const data = depIface77.encodeFunctionData("deposit", [b3277(USER77), b3277(hasFee ? handler : USER77), b3277(BASE_USDC_77), b3277(ARC_PRE), BigInt(inAmt), BigInt(bridgeOut), 5042n, b3277("0x394311a6aaa0d8e3411d8b62de4578d41322d1bd"), 1794177000, 1794184200, 3, message]);
    const tok77 = (address, chainId) => ({ decimals: 6, symbol: "USDC", address, name: "USD Coin", chainId });
    const feeTokIn = tok77(BASE_USDC_77, 8453), feeTokOut = tok77(ARC_PRE, 5042);
    return {
      crossSwapType: "bridgeableToBridgeable", amountType: "exactInput", id: "77-fixture",
      checks: { allowance: { token: BASE_USDC_77, spender: BASE_POOL_77, actual: "0", expected: inAmt }, balance: { token: BASE_USDC_77, actual: "0", expected: inAmt } },
      approvalTxns: [{ chainId: 8453, to: BASE_USDC_77, data: "0x095ea7b3" }],
      steps: { bridge: { inputAmount: inAmt, outputAmount: bridgeOut, tokenIn: feeTokIn, tokenOut: feeTokOut } },
      inputToken: feeTokIn, outputToken: feeTokOut, refundToken: feeTokIn,
      fees: { total: { amount: String(BigInt(bridgeRaw) + BigInt(appRaw)), amountUsd: "0.009697", token: feeTokIn, details: {
        type: "total-breakdown",
        swapImpact: { amount: "-3", amountUsd: "-0.000003", token: feeTokIn },
        app: { amount: appRaw, amountUsd: "0.004995", token: feeTokOut },
        bridge: { amount: bridgeRaw, amountUsd: "0.004702", token: feeTokIn },
      } } },
      inputAmount: inAmt, expectedOutputAmount: (BigInt(bridgeOut) - BigInt(appRaw)).toString(), minOutputAmount: (BigInt(bridgeOut) - BigInt(appRaw)).toString(), expectedFillTime: 2,
      swapTx: { to: BASE_POOL_77, data, gas: 0, chainId: 8453 }, quoteExpiryTimestamp: 1994180911,
    };
  };
  const argsArc77 = { fromChainKey: "base", toChainKey: "c5042", fromTokenAddress: BASE_USDC_77, toTokenAddress: LIFI_NATIVE_TOKEN, fromAmount: "5000000", fromAddress: USER77, toAddress: USER77 };
  const routeArc77 = parseAcrossQuote(arcQuote77(), argsArc77, planArcIn);
  ok("GAP-4: a live-shaped fee-bearing Base→Arc quote parses and passes its bounds check",
    !!routeArc77 && routeArc77.provider === "across" && routeArc77.platformFeeCollecting === true
    && checkAcrossDepositBounds(routeArc77, USER77).ok === true);
  ok("GAP-4: an unpinned Arc handler refuses the route",
    parseAcrossQuote(arcQuote77({ handler: "0x000000000000000000000000000000000000dEaD" }), argsArc77, planArcIn) === null);

  // GAP-4 denomination — an Arc-ORIGIN native pick must reach the
  // Swap API at the predeploy's scale: acrossQuoteArgs performs
  // the same re-denomination as the Relay builder, and a live-
  // shaped fee-free Arc→Base quote (the 2026-11-09 probe's own
  // output figure) parses against the scaled args.
  const argsArcOrigin77 = { fromChainKey: "c5042", toChainKey: "base", fromTokenAddress: LIFI_NATIVE_TOKEN, toTokenAddress: BASE_USDC_77, fromAmount: "5000000000000000000", fromAddress: USER77, toAddress: USER77 };
  const qargsArc77 = acrossQuoteArgs(argsArcOrigin77, planArcOut);
  ok("GAP-4: Across args re-denominate an Arc native pick to the predeploy scale",
    qargsArc77.fromAmount === "5000000" && qargsArc77.fromTokenAddress === LIFI_NATIVE_TOKEN);
  ok("GAP-4: Across args leave token picks (incl. the predeploy itself) at their own scale",
    acrossQuoteArgs({ ...argsArcOrigin77, fromTokenAddress: ARC_PRE, fromAmount: "5000000" }, planArcOut).fromAmount === "5000000"
    && acrossQuoteArgs(argsArc77, planArcIn) === argsArc77);
  const arcOriginQuote77 = (() => {
    const inAmt = "5000000", outAmt = "4995843", bridgeRaw = "4202";
    const data = depIface77.encodeFunctionData("deposit", [b3277(USER77), b3277(USER77), b3277(ARC_PRE), b3277(BASE_USDC_77), BigInt(inAmt), BigInt(outAmt), 8453n, b3277("0x394311a6aaa0d8e3411d8b62de4578d41322d1bd"), 1794177000, 1794184200, 3, "0x"]);
    const tok77 = (address, chainId) => ({ decimals: 6, symbol: "USDC", address, name: "USD Coin", chainId });
    const feeTokIn = tok77(ARC_PRE, 5042), feeTokOut = tok77(BASE_USDC_77, 8453);
    return {
      crossSwapType: "bridgeableToBridgeable", amountType: "exactInput", id: "77-fixture-origin",
      checks: { allowance: { token: ARC_PRE, spender: ARC_POOL, actual: "0", expected: inAmt }, balance: { token: ARC_PRE, actual: "0", expected: inAmt } },
      approvalTxns: [{ chainId: 5042, to: ARC_PRE, data: "0x095ea7b3" }],
      steps: { bridge: { inputAmount: inAmt, outputAmount: outAmt, tokenIn: feeTokIn, tokenOut: feeTokOut } },
      inputToken: feeTokIn, outputToken: feeTokOut, refundToken: feeTokIn,
      fees: { total: { amount: bridgeRaw, amountUsd: "0.004202", token: feeTokIn, details: {
        type: "total-breakdown",
        swapImpact: { amount: "-3", amountUsd: "-0.000003", token: feeTokIn },
        app: { amount: "0", amountUsd: "0", token: feeTokOut },
        bridge: { amount: bridgeRaw, amountUsd: "0.004202", token: feeTokIn },
      } } },
      inputAmount: inAmt, expectedOutputAmount: outAmt, minOutputAmount: outAmt, expectedFillTime: 2,
      swapTx: { to: ARC_POOL, data, gas: 0, chainId: 5042 }, quoteExpiryTimestamp: 1994180911,
    };
  })();
  const routeArcOrigin77 = parseAcrossQuote(arcOriginQuote77, qargsArc77, planArcOut);
  ok("GAP-4: a live-shaped fee-free Arc→Base quote parses against the scaled args",
    !!routeArcOrigin77 && routeArcOrigin77.provider === "across" && routeArcOrigin77.fromAmount === "5000000"
    && routeArcOrigin77.toAmount === "4995843" && checkAcrossDepositBounds(routeArcOrigin77, USER77).ok === true);
  ok("GAP-4: the same quote refuses against unscaled (native-scale) args",
    parseAcrossQuote(arcOriginQuote77, argsArcOrigin77, planArcOut) === null);

  // GAP-2 — the receive copy is count-free on both surfaces.
  const coreSrc77 = readFileSync(new URL("../src/wallet-core.js", import.meta.url), "utf8");
  const appSrc77 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("GAP-2: receive copy no longer hard-codes a network count",
    !coreSrc77.includes("all 15 networks") && !appSrc77.includes("all 15 networks")
    && appSrc77.includes("the same on every EVM network") && coreSrc77.includes("one address · every EVM network"));
}

// 97. Agent kit (2026-11-09): the public manifest, the welcome/More
// agent surfaces, claim durability (create-click intent record →
// interrupt → reopen → still tracked and surfaced), and the
// autonomous runtime's claimName. The interrupt pin is behavioural:
// the exact record shapes the app persists are round-tripped through
// JSON (storage) and driven through the real state machine.
{
  const { readFileSync: rf97, existsSync: ex97, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: join97 } = await import("node:path");
  // --- the manifest ---
  const man97 = JSON.parse(rf97(new URL("../public/fluid-agent.json", import.meta.url), "utf8"));
  ok("kit: manifest parses and names the product + site", man97.name === "fluid-agent" && man97.site === "https://fluidwallet.dpdns.org");
  ok("kit: manifest carries the real claim protocol (string, kind, relays)",
    man97.claimProtocol.canonicalClaimString.startsWith("Fluid name claim v1") && man97.claimProtocol.canonicalClaimString.includes("sui: <Sui address>")
    && man97.claimProtocol.event.kind === 30078
    && JSON.stringify([...man97.claimProtocol.relays].sort()) === JSON.stringify([...NAME_CLAIM_RELAYS].sort()));
  ok("kit: the manifest's canonical string is the core's claim message shape",
    buildNameClaimMessage({ name: "kitwalk1109", evm: "0x1234567890AbcdEF1234567890aBcdef12345678", btc: "bc1qexample", ln: "", algo: "ALGOEXAMPLE", sol: "SolExample", tron: "TExample", sui: "0xsui" }).startsWith("Fluid name claim v1\nname: kitwalk1109\nevm: 0x1234567890AbcdEF1234567890aBcdef12345678"));
  ok("kit: manifest documents both modes + the safety layer graded by enforcer",
    !!man97.modes.forUser && !!man97.modes.agentOwned
    && man97.safetyAndCooperation.layers.some(l => l.enforcedBy === "wallet")
    && man97.safetyAndCooperation.layers.some(l => l.enforcedBy === "convention"));
  ok("kit: manifest policy defaults match the core constants",
    man97.modes.agentOwned.policyDefaults.perTxCapUsd === AGENT_POLICY_DEFAULTS.perTxCapUsd
    && man97.modes.agentOwned.policyDefaults.dailyCapUsd === AGENT_POLICY_DEFAULTS.dailyCapUsd);
  const buildSrc97 = rf97(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  ok("kit: build serves the manifest at the root and the well-known path",
    buildSrc97.includes('copyFileSync("public/fluid-agent.json", "dist/fluid-agent.json")')
    && buildSrc97.includes('copyFileSync("public/fluid-agent.json", "dist/.well-known/fluid-agent.json")'));
  const pubSrc97 = rf97(new URL("../scripts/publish.mjs", import.meta.url), "utf8");
  ok("kit: publish carries the manifest to gh-pages (both paths in ARTIFACTS)",
    pubSrc97.includes('"fluid-agent.json", ".well-known/fluid-agent.json"'));
  ok("kit: .nojekyll ships so Pages serves the dot-directory",
    buildSrc97.includes('writeFileSync("dist/.nojekyll", "")') && pubSrc97.includes('".nojekyll"'));
  // --- the site surfaces ---
  const html97 = rf97(new URL("../src/index.html", import.meta.url), "utf8");
  ok("kit: the WELCOME page carries the agent element with manifest + kit links",
    html97.includes('id="agentLine"') && html97.includes("Fluid is an agent wallet") && html97.includes('href="fluid-agent.json"'));
  ok("kit: the More tab carries the agent line", html97.includes('id="moreAgentLine"'));
  ok("kit: Home carries the pending-claim card", html97.includes('id="homeClaimCard"') && html97.includes('id="homeClaimText"') && html97.includes('id="homeClaimBtn"'));
  // --- claim durability: app wiring ---
  const app97 = rf97(new URL("../src/app.js", import.meta.url), "utf8");
  ok("kit durability: the create click persists the claim intent with the vault",
    app97.includes("savePendingClaim({ name: wantName, evm: null, published: false, submittedAt: Date.now(), awaitingSubmit: true })"));
  ok("kit durability: import records the owed claim before its awaits",
    app97.includes("savePendingClaim({ name: wantName, evm: wallet.address, published: false, submittedAt: Date.now(), awaitingSubmit: true })"));
  ok("kit durability: the seed-done clear that reopened the hole is gone",
    !app97.includes("savePendingClaim(null); // a fresh wallet starts with no held claim"));
  ok("kit durability: unlock render resumes the claim and surfaces it on Home",
    app97.includes("async function resumePendingClaim()") && app97.includes("async function refreshHomeClaimBanner()")
    && app97.includes("resumePendingClaim();") && app97.includes("refreshHomeClaimBanner();"));
  // --- claim durability: the interrupt walk over the persisted shapes ---
  const { NAME_CLAIM_REPAIR_AFTER_MS: R97 } = await import("../src/wallet-core.js");
  const myEvm97 = "0x1234567890AbcdEF1234567890aBcdef12345678";
  const t097 = 1794240000000;
  const intent97 = JSON.parse(JSON.stringify({ name: "kitwalk1109", evm: null, published: false, submittedAt: t097, awaitingSubmit: true }));
  ok("kit durability: create → interrupt at the seed screen → reopen = saved (tracked, NOT LIVE)",
    nameClaimState({ stored: intent97.name, pending: intent97, registryHit: null, myEvm: myEvm97, now: t097 + 1000 }) === "saved");
  const pub97 = { ...intent97, evm: myEvm97, published: true, eventId: "e".repeat(64), acceptedRelays: ["wss://relay.damus.io"], publishedAt: t097 + 5000 };
  ok("kit durability: the resumed claim reads publishing inside the window",
    nameClaimState({ stored: pub97.name, pending: pub97, registryHit: null, myEvm: myEvm97, now: t097 + 60000 }) === "publishing");
  ok("kit durability: a lost claim past the window reads repair, not publishing forever",
    nameClaimState({ stored: pub97.name, pending: pub97, registryHit: null, myEvm: myEvm97, eventFound: false, now: t097 + R97 + 10000 }) === "repair");
  ok("kit durability: live only when the registry resolves the name to THIS wallet",
    nameClaimState({ stored: pub97.name, pending: pub97, registryHit: { evm: myEvm97 }, myEvm: myEvm97, now: t097 + R97 + 20000 }) === "live");
  ok("kit durability: a registry hit to a different wallet reads conflict",
    nameClaimState({ stored: pub97.name, pending: pub97, registryHit: { evm: "0x0000000000000000000000000000000000000001" }, myEvm: myEvm97, now: t097 + 1000 }) === "conflict");
  // --- the autonomous runtime's claimName ---
  const { createAgentWallet, openAgent, claimName } = await import("../agent/fluid-agent.mjs");
  const dir97 = mkdtempSync(join97(tmpdir(), "fluid-kit-agent-"));
  await createAgentWallet({ name: "Kit Test", dir: dir97, password: "kit-test-password-123" });
  const agent97 = await openAgent({ dir: dir97, password: "kit-test-password-123" });
  let ev97 = null, resolveCalls97 = 0;
  const res97 = await claimName(agent97, "kitagent1109", {
    publish: async (ev) => { ev97 = ev; return { accepted: 2, acceptedRelays: ["wss://relay.damus.io", "wss://nos.lol"] }; },
    resolve: async () => (++resolveCalls97 > 1 ? { evm: agent97.descriptor.keys.evm } : null),
    pollMs: 1, timeoutMs: 5000,
  });
  ok("kit claimName: lands and returns the published record", res97.landed === true && !!ev97 && res97.eventId === ev97.id && res97.accepted === 2);
  ok("kit claimName: the event is a valid kind-30078 claim for the name",
    ev97.kind === 30078 && ev97.tags.some(t => t[0] === "d" && t[1] === "fluid-name-claim:kitagent1109") && verifyNostrEventSignature(ev97));
  const content97 = JSON.parse(ev97.content);
  ok("kit claimName: the claim content verifies and carries the agent's own addresses",
    verifyNameClaim(content97).ok && content97.evm === agent97.descriptor.keys.evm && content97.btc === agent97.descriptor.keys.btc);
  ok("kit claimName: the pending record is persisted in the agent dir", ex97(join97(dir97, "name-claim.json")));
  const res98 = await claimName(agent97, "kitagent21109", {
    publish: async () => ({ accepted: 1, acceptedRelays: ["wss://nos.lol"] }),
    resolve: async () => null,
    pollMs: 1, timeoutMs: 25,
  });
  ok("kit claimName: an unlanded claim reports landed:false without throwing", res98.landed === false && res98.accepted === 1);
  let threw97 = false;
  try { await claimName(agent97, "ethuram", { resolve: async () => ({ evm: "0x0EBf5563F905E3B9D58718E28E08143511DC763b" }) }); } catch { threw97 = true; }
  ok("kit claimName: a name claimed by a different wallet is refused", threw97);
  ok("kit claimName: claiming never touches the policy caps", AGENT_POLICY_DEFAULTS.perTxCapUsd === 50 && AGENT_POLICY_DEFAULTS.dailyCapUsd === 200);
  // --- documentation ---
  ok("kit: the documentation index and kit doc exist and cross-link",
    ex97(new URL("../docs/README.md", import.meta.url)) && ex97(new URL("../docs/AGENT-KIT.md", import.meta.url))
    && rf97(new URL("../docs/README.md", import.meta.url), "utf8").includes("AGENT-KIT.md")
    && rf97(new URL("../docs/AGENT-KIT.md", import.meta.url), "utf8").includes("claimName"));
}


// =====================================================================
// Lightning completion build (Phases 0+1): receive plan, LSPS2 fee
// arithmetic, peer book, the Satora gate's JIT amendment (§5.4), and
// the pinned resumable node download (owner directives 2026-11-10).
// =====================================================================
{
  // --- lnReceivePlan: the app must never render an unpayable artifact ---
  const planA = lnReceivePlan({ receivableMsat: 5000000, requestedMsat: 2000000, hasLsp: true });
  ok("lnplan: sized + covered → invoice (not partial)", planA.kind === "invoice" && planA.partial === false);
  ok("lnplan: sized + zero room + LSP → jit", lnReceivePlan({ receivableMsat: 0, requestedMsat: 2000000, hasLsp: true }).kind === "jit");
  ok("lnplan: sized + zero room + no LSP → need-channel", lnReceivePlan({ receivableMsat: 0, requestedMsat: 2000000, hasLsp: false }).kind === "need-channel");
  const planP = lnReceivePlan({ receivableMsat: 1000000, requestedMsat: 2000000, hasLsp: true });
  ok("lnplan: sized + partial room → invoice, partial", planP.kind === "invoice" && planP.partial === true && planP.receivableMsat === 1000000);
  ok("lnplan: amountless + room → offer", lnReceivePlan({ receivableMsat: 1000, requestedMsat: null, hasLsp: false }).kind === "offer");
  ok("lnplan: amountless + zero + LSP → need-amount", lnReceivePlan({ receivableMsat: 0, requestedMsat: null, hasLsp: true }).kind === "need-amount");
  ok("lnplan: amountless + zero + no LSP → need-channel", lnReceivePlan({ receivableMsat: 0, requestedMsat: null, hasLsp: false }).kind === "need-channel");
  ok("lnplan: exact fit is covered", lnReceivePlan({ receivableMsat: 2000000, requestedMsat: 2000000, hasLsp: false }).kind === "invoice");

  // --- LSPS2 opening fee: max(min_fee, ceil(size × proportional / 1e6)) ---
  ok("lsps2 fee: proportional exact", lnLsps2OpeningFeeMsat(2000000, { minFeeMsat: 1000, proportional: 1000 }) === 2000);
  ok("lsps2 fee: proportional rounds up", lnLsps2OpeningFeeMsat(1500500, { minFeeMsat: 0, proportional: 1000 }) === 1501);
  ok("lsps2 fee: min fee floor wins", lnLsps2OpeningFeeMsat(100000, { minFeeMsat: 1000, proportional: 1000 }) === 1000);
  ok("lsps2 fee: zero proportional = min fee", lnLsps2OpeningFeeMsat(5000000, { minFeeMsat: 2500, proportional: 0 }) === 2500);

  // --- SCID forms ---
  ok("ln scid: BxTxO → decimal string", lnScidToDecimal("800000x12x0") === "879609302221586432");
  ok("ln scid: numeric passes through", lnScidToDecimal("12345") === "12345" && lnScidToDecimal(12345) === "12345");
  ok("ln scid: garbage → null", lnScidToDecimal("nope") === null && lnScidToDecimal(null) === null && lnScidToDecimal("") === null);

  // --- persisted peer book ---
  const pkA = "02" + "aa".repeat(32), pkB = "03" + "bb".repeat(32);
  ok("peerbook: empty input → []", Array.isArray(parseLnPeerBook(null)) && parseLnPeerBook(null).length === 0 && parseLnPeerBook("{oops").length === 0);
  let bookT = upsertLnPeer([], { pubkey: pkA, host: "a.example", port: 9735 });
  bookT = upsertLnPeer(bookT, { pubkey: pkB, host: "b.example", port: 19735 });
  bookT = upsertLnPeer(bookT, { pubkey: pkA, host: "a2.example", port: 9736 });
  ok("peerbook: upsert dedupes by pubkey and updates the endpoint", bookT.length === 2 && bookT.find((p) => p.pubkey === pkA).host === "a2.example" && bookT.find((p) => p.pubkey === pkA).port === 9736);
  const bookRt = parseLnPeerBook(serializeLnPeerBook(bookT));
  ok("peerbook: serialize → parse round-trip", bookRt.length === 2 && bookRt.some((p) => p.pubkey === pkB && p.host === "b.example"));
  ok("peerbook: garbage entries are dropped, good ones survive", parseLnPeerBook(JSON.stringify([{ pubkey: "zz", host: "x", port: 1 }, { pubkey: pkA, host: "", port: 9735 }, { pubkey: pkB, host: "ok", port: 9735 }])).length === 1);
  ok("peerbook: remove by pubkey", removeLnPeer(bookT, pkA).length === 1 && removeLnPeer(bookT, pkA)[0].pubkey === pkB);

  // --- Satora gate JIT amendment (§5.4, exact) ---
  const LSP_PK_T = "034066e29e402d9cf55af1ae1026cc5adf92eed1e0e421785442f53717ad1453b0";
  const jitPrivT = "0000000000000000000000000000000000000000000000000000000000000001";
  const jitPayeeT = Buffer.from(secp256k1.getPublicKey(Buffer.from(jitPrivT, "hex"))).toString("hex");
  const jitHashT = Buffer.from(nobleSha256(new TextEncoder().encode("jit-test-preimage"))).toString("hex");
  const jitInvoiceT = encodeBolt11({ network: "bc", amountMsat: 2000000n, timestamp: Math.floor(Date.now() / 1000), privKey: jitPrivT,
    fields: [["s", "11".repeat(32)], ["p", jitHashT], ["d", "jit test"], ["r", [{ pubkey: LSP_PK_T, shortChannelId: "800000x12x0", feeBaseMsat: 0, feeProportionalMillionths: 0, cltvExpiryDelta: 144 }]]] });
  const jitCtxT = { lspPubkey: LSP_PK_T, interceptScids: { [jitHashT]: "879609302221586432" }, maxPaymentMsat: "100000000" };
  const gateT = (over) => checkSatoraLightningReceivability({ destInput: jitInvoiceT, ownNodeId: jitPayeeT, ownReceivableMsat: 0, ...over });
  ok("gate jit: recorded JIT invoice passes at receivable 0", gateT({ jit: jitCtxT }).ok === true);
  ok("gate jit: record deleted → refused", gateT({ jit: { ...jitCtxT, interceptScids: {} } }).ok === false);
  ok("gate jit: no jit context → refused under today's rule", gateT({}).ok === false);
  ok("gate jit: amount above the negotiated maximum → refused", gateT({ jit: { ...jitCtxT, maxPaymentMsat: "1999999" } }).ok === false);
  ok("gate jit: wrong LSP pubkey → refused", gateT({ jit: { ...jitCtxT, lspPubkey: pkA } }).ok === false);
  const forgedHashT = Buffer.from(nobleSha256(new TextEncoder().encode("forged-preimage"))).toString("hex");
  const forgedInvoiceT = encodeBolt11({ network: "bc", amountMsat: 2000000n, timestamp: Math.floor(Date.now() / 1000), privKey: jitPrivT,
    fields: [["s", "11".repeat(32)], ["p", forgedHashT], ["d", "forged"], ["r", [{ pubkey: LSP_PK_T, shortChannelId: "800000x12x0", feeBaseMsat: 0, feeProportionalMillionths: 0, cltvExpiryDelta: 144 }]]] });
  ok("gate jit: LSP first hop but no record for this payment hash → refused",
    checkSatoraLightningReceivability({ destInput: forgedInvoiceT, ownNodeId: jitPayeeT, ownReceivableMsat: 0, jit: jitCtxT }).ok === false);
  const wrongHopInvoiceT = encodeBolt11({ network: "bc", amountMsat: 2000000n, timestamp: Math.floor(Date.now() / 1000), privKey: jitPrivT,
    fields: [["s", "11".repeat(32)], ["p", jitHashT], ["d", "wrong hop"], ["r", [{ pubkey: pkA, shortChannelId: "800000x12x0", feeBaseMsat: 0, feeProportionalMillionths: 0, cltvExpiryDelta: 144 }]]] });
  ok("gate jit: recorded scid but first hop is not the LSP → refused",
    checkSatoraLightningReceivability({ destInput: wrongHopInvoiceT, ownNodeId: jitPayeeT, ownReceivableMsat: 0, jit: jitCtxT }).ok === false);
  const amountlessOwnT = encodeBolt11({ network: "bc", amountMsat: null, timestamp: Math.floor(Date.now() / 1000), privKey: jitPrivT, fields: [["s", "11".repeat(32)], ["p", jitHashT], ["d", "amountless"]] });
  ok("gate jit: amountless own invoice keeps today's pass", checkSatoraLightningReceivability({ destInput: amountlessOwnT, ownNodeId: jitPayeeT, ownReceivableMsat: 0 }).ok === true);
  ok("gate jit: external payee unaffected by the amendment", checkSatoraLightningReceivability({ destInput: jitInvoiceT, ownNodeId: pkA, ownReceivableMsat: 0, jit: jitCtxT }).ok === true);
  ok("gate jit: today's refusal text is byte-for-byte unchanged", gateT({}).reason === "That invoice pays your own Fluid Lightning wallet, but your wallet can't receive it yet — it has no inbound Lightning capacity (no open channels with room). Open a Lightning channel first, or pay an invoice from a different wallet.");

  // --- pinned, resumable download (ln-download.js) ---
  const dlTotal = 100000, dlChunk = 16384;
  const dlData = new Uint8Array(dlTotal);
  for (let i = 0; i < dlTotal; i++) dlData[i] = (i * 31 + 7) % 251;
  const dlPin = await sha256Hex(dlData);
  const mkStore = () => { const m = new Map(); return { map: m, get: async (k) => (m.has(k) ? m.get(k) : null), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } }; };
  const rangeFetch = (data, log, failAfter = Infinity) => {
    let served = 0;
    return async (url, opts) => {
      const range = opts && opts.headers && opts.headers.Range;
      const mm = /^bytes=(\d+)-(\d+)$/.exec(range || "");
      if (!mm) return new Response(data.slice().buffer, { status: 200 });
      if (served >= failAfter) throw new Error("network dropped");
      served++;
      const a = Number(mm[1]), b = Number(mm[2]);
      log.push([a, b]);
      return new Response(data.slice(a, b + 1).buffer, { status: 206, headers: { "Content-Range": `bytes ${a}-${b}/${data.length}` } });
    };
  };
  const noSleep = async () => {};
  // (a) resume: die after 3 chunks; the retry fetches ONLY the rest
  {
    const store = mkStore(); const log1 = [], log2 = [];
    let err = null;
    try { await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(dlData, log1, 3), chunkBytes: dlChunk, sleepImpl: noSleep }); } catch (e) { err = e; }
    ok("download: a mid-download drop is a download-stage error that keeps progress", err instanceof LnAssetError && err.stage === "download" && log1.length === 3);
    const got = await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(dlData, log2), chunkBytes: dlChunk, sleepImpl: noSleep });
    ok("download: resume fetches only the missing chunks", log2.length === Math.ceil(dlTotal / dlChunk) - 3 && log2[0][0] === 3 * dlChunk);
    ok("download: resumed bytes verify against the pin", (await sha256Hex(new Uint8Array(got.bytes))) === dlPin && got.resumedBytes === 3 * dlChunk);
    const log3 = [];
    const again = await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(dlData, log3), chunkBytes: dlChunk, sleepImpl: noSleep });
    ok("download: a complete download is served from the store with zero fetches", log3.length === 0 && again.fromStore === true);
  }
  // (b) tamper: corrupt exactly one stored chunk → only it is re-fetched
  {
    const store = mkStore(); const log0 = [];
    await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(dlData, log0), chunkBytes: dlChunk, sleepImpl: noSleep });
    const key2 = `lnasset:${dlPin}:chunk:2`;
    const bad = new Uint8Array(await store.get(key2)); bad[0] = (bad[0] + 1) % 256;
    await store.set(key2, bad);
    const logT = [];
    const got = await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(dlData, logT), chunkBytes: dlChunk, sleepImpl: noSleep });
    ok("download TAMPER: the corrupted chunk is identified and only it is re-fetched", JSON.stringify(got.repairedChunks) === "[2]" && logT.length === 1 && logT[0][0] === 2 * dlChunk);
    ok("download TAMPER: repaired bytes verify and boot may proceed", (await sha256Hex(new Uint8Array(got.bytes))) === dlPin);
  }
  // (c) pin refusal: the server serves different bytes entirely
  {
    const store = mkStore(); const wrong = new Uint8Array(dlTotal).fill(9);
    let err = null;
    try { await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: rangeFetch(wrong, []), chunkBytes: dlChunk, sleepImpl: noSleep }); } catch (e) { err = e; }
    ok("download: bytes that fail the pinned hash are REFUSED (integrity), nothing returned", err instanceof LnAssetError && err.stage === "integrity");
  }
  // (d) Range ignored → 200 whole body is sliced, stored and verified
  {
    const store = mkStore();
    const fullFetch = async () => new Response(dlData.slice().buffer, { status: 200 });
    const got = await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: fullFetch, chunkBytes: dlChunk, sleepImpl: noSleep });
    ok("download: a Range-ignoring server still yields a verified, stored download", (await sha256Hex(new Uint8Array(got.bytes))) === dlPin && [...store.map.keys()].filter((k) => k.includes(":chunk:")).length === Math.ceil(dlTotal / dlChunk));
  }
  // (e) short bodies are RETRIED, never fatal on first sight (the
  // owner's rule: the download must not cut off at the slightest
  // drop — a truncated chunk through a flaky proxy is a drop)
  {
    const store = mkStore();
    let calls = 0;
    const flakyFetch = async (url, opts) => {
      calls++;
      const mm = /^bytes=(\d+)-(\d+)$/.exec((opts && opts.headers && opts.headers.Range) || "");
      const a = Number(mm[1]), b = Number(mm[2]);
      const body = calls <= 2 ? dlData.slice(a, a + 100) : dlData.slice(a, b + 1);
      return new Response(body.buffer, { status: 206, headers: { "Content-Range": `bytes ${a}-${a + body.length - 1}/${dlTotal}` } });
    };
    const got = await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store, fetchImpl: flakyFetch, chunkBytes: dlChunk, sleepImpl: noSleep });
    ok("download: short chunk bodies are retried and the download completes", (await sha256Hex(new Uint8Array(got.bytes))) === dlPin);
    const store2 = mkStore();
    const alwaysShort = async (url, opts) => {
      const mm = /^bytes=(\d+)-(\d+)$/.exec((opts && opts.headers && opts.headers.Range) || "");
      const a = Number(mm[1]);
      return new Response(dlData.slice(a, a + 100).buffer, { status: 206, headers: { "Content-Range": `bytes ${a}-${a + 99}/${dlTotal}` } });
    };
    let err2 = null;
    try { await fetchPinnedAsset({ url: "https://x/wasm", sha256: dlPin, bytes: dlTotal, store: store2, fetchImpl: alwaysShort, chunkBytes: dlChunk, sleepImpl: noSleep }); } catch (e) { err2 = e; }
    ok("download: persistently short bodies give up as a DOWNLOAD error (kept progress), not an integrity refusal", err2 instanceof LnAssetError && err2.stage === "download");
  }

  // --- verbatim copy + wiring pins (source text) ---
  const appLz = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const nodeLz = readFileSync(new URL("../src/lightning-node.js", import.meta.url), "utf8");
  ok("copy: receivable-0 sentence (panel + receive sheet)", appLz.includes("Your node can't receive yet — it has no channel with room in it."));
  ok("copy: partial-capacity sentence", appLz.includes("but your channels can only receive") && appLz.includes("Whoever pays it can send at most"));
  ok("copy: JIT fee review", appLz.includes("Your first payment opens your channel. The provider (Megalith) takes") && appLz.includes("Keep Fluid open until the payment lands."));
  ok("copy: capacity line + advanced peer section", appLz.includes("Receiving room:") && appLz.includes("Sending room:") && appLz.includes("Advanced — connect to any peer"));
  ok("copy: offline-receive lead + wake-up honesty", appLz.includes("Not set up yet — this needs a holding peer that is always online.") && appLz.includes("Wake-up notifications need Fluid's notification relay, which isn't live yet."));
  ok("copy: send pre-checks", appLz.includes("Your node isn't connected right now — give it a few seconds after opening Fluid, then try again.") && appLz.includes("You don't have that much you can send — your sending room is"));
  ok("copy: download progress is persisted-progress wording", appLz.includes("kept on your phone as it arrives, so if the connection drops it continues where it stopped"));
  ok("copy: boot failure never presents the fallback as the node", appLz.includes("This is <b>not</b> your node — an external wallet would pay instead") && appLz.includes("Your Lightning node couldn't load"));
  ok("copy: registration verified against the registry", appLz.includes("Registered ✓ — the registry now shows your node's offer") && appLz.includes("It is not in the registry yet."));
  ok("pins: the app imports the in-bundle asset pins", appLz.includes("ln-asset-pins.generated.js") && appLz.includes("LN_WASM_PIN"));
  ok("pins: the loaded chunk must carry the pinned-boot marker (stale chunk refused)", appLz.includes("LN_PINNED_BOOT") && nodeLz.includes("export const LN_PINNED_BOOT = true") && appLz.includes('import("./lightning.chunk.js")'));
  ok("defaults: ws-proxy ships the deployed Cloudflare Worker template, relay still empty (not yet deployed), LSP is Megalith", nodeLz.includes('LN_DEFAULT_WS_PROXY = "wss://fluid-ws-proxy.kanugideontownsville.workers.dev/{host}/{port}"') && nodeLz.includes('LN_DEFAULT_RELAY_URL = ""') && nodeLz.includes("034066e29e402d9cf55af1ae1026cc5adf92eed1e0e421785442f53717ad1453b0"));
}

// ---------- Audit batch 4: Lightning panel honesty (F1–F3) ----------
// Source: native-Lightning QA walk retry §14.3. F1: the name-card
// button stuck at "Starting your node…" when createOffer failed.
// F2: the peer row claimed "connected" from socket bookkeeping
// alone. F3: no connect-only path existed though the explainer
// promised one, and open-channel slept a fixed 4 s.
{
  const appB4 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const nodeB4 = readFileSync(new URL("../src/lightning-node.js", import.meta.url), "utf8");
  const PK_B4 = "02" + "ab".repeat(32);

  // F2 — the state derivation itself (pure truth table).
  ok("F2 peer state: live socket + completed handshake = connected",
    lnPeerConnState({ socketLive: true, handshaken: true }) === "connected");
  ok("F2 peer state: dialled socket alone = connecting, never connected",
    lnPeerConnState({ socketLive: true, handshaken: false }) === "connecting");
  ok("F2 peer state: no socket = disconnected, even after a past handshake",
    lnPeerConnState({ socketLive: false, handshaken: true }) === "disconnected"
    && lnPeerConnState({ socketLive: false, handshaken: false }) === "disconnected"
    && lnPeerConnState() === "disconnected");

  // F2 — the session wiring: readiness comes from the node's own
  // peer_back_online events (LDK OnionMessagePeerConnected), the
  // drain is the single chokepoint, and a dead last socket voids it.
  ok("F2 session: peerStatus derives via lnPeerConnState(socket, handshake)",
    nodeB4.includes("lnPeerConnState({ socketLive: session.peerLive(p.pubkey), handshaken: session.peerReady.has(p.pubkey) })"));
  ok("F2 session: readiness is fed by peer_back_online drains",
    nodeB4.includes('ev.type === "peer_back_online"') && nodeB4.includes("session.peerReady.add(String(ev.peer).toLowerCase())"));
  ok("F2 session: the last socket closing clears the peer's readiness",
    nodeB4.includes("session.peerReady.delete(pubkey)"));
  ok("F2 panel: the row paints all three states",
    appB4.includes('p.state === "connected" ? "connected" : p.state === "connecting" ? "connecting…" : "disconnected"'));

  // F3 — the wait helper's semantics (pure, injected clock).
  {
    let t = 0;
    const clock = { now: () => t, sleep: async (ms) => { t += ms; } };
    const seq = (states) => { let i = 0; return () => [{ pubkey: PK_B4, state: states[Math.min(i++, states.length - 1)] }]; };
    const r1 = await waitForLnPeerConnected(seq(["connected"]), PK_B4, { timeoutMs: 5000, pollMs: 100, ...clock });
    ok("F3 wait: an already-connected peer resolves at once", r1.connected === true && r1.state === "connected" && t === 0);
    t = 0;
    const r2 = await waitForLnPeerConnected(seq(["connecting", "connecting", "connected"]), PK_B4, { timeoutMs: 5000, pollMs: 100, ...clock });
    ok("F3 wait: connecting → connected succeeds when the handshake lands", r2.connected === true && r2.state === "connected");
    t = 0;
    const r3 = await waitForLnPeerConnected(seq(["connecting"]), PK_B4, { timeoutMs: 1000, pollMs: 250, ...clock });
    ok("F3 wait: a handshake that never lands times out with the honest last state",
      r3.connected === false && r3.state === "connecting" && t >= 1000);
    t = 0;
    const r4 = await waitForLnPeerConnected(() => [], PK_B4, { timeoutMs: 300, pollMs: 100, ...clock });
    ok("F3 wait: a peer missing from the status list reads disconnected, never success",
      r4.connected === false && r4.state === "disconnected");
    t = 0;
    const r5 = await waitForLnPeerConnected(() => { throw new Error("node gone"); }, PK_B4, { timeoutMs: 300, pollMs: 100, ...clock });
    ok("F3 wait: a throwing status source degrades to disconnected, never success",
      r5.connected === false && r5.state === "disconnected");
  }

  // F3 — the panel wiring: both controls exist; connect-only dials
  // and waits but NEVER opens a channel or reads the sats field;
  // open-channel waits on state with an honest pre-open refusal.
  const advB4 = appB4.slice(appB4.indexOf('<details id="lnAdvanced"'), appB4.indexOf("</details>", appB4.indexOf('<details id="lnAdvanced"')));
  ok("F3 panel: Advanced carries BOTH connect-only and open-channel controls",
    advB4.includes('id="lnConnectBtn"') && advB4.includes("Connect only — no channel")
    && advB4.includes('id="lnOpenBtn"') && advB4.includes("Connect &amp; open channel"));
  const connectOnlyB4 = appB4.slice(appB4.indexOf("async function lnConnectOnly"), appB4.indexOf("async function lnOpenChannel"));
  ok("F3 connect-only: dials the peer and waits on real state",
    connectOnlyB4.includes("lnSession.connectPeer(pubkey, host, port)") && connectOnlyB4.includes("waitForLnPeerConnected"));
  ok("F3 connect-only: constructs NO channel open and reads NO channel size",
    !connectOnlyB4.includes("openChannel") && !connectOnlyB4.includes("lnChanSats") && !connectOnlyB4.includes("10000"));
  ok("F3 connect-only: success copy claims a connection only, never a channel",
    connectOnlyB4.includes("no channel was opened"));
  const openB4 = appB4.slice(appB4.indexOf("async function lnOpenChannel"), appB4.indexOf("function lnWatchFunding"));
  ok("F3 open-channel: waits on real connection state (bounded, truthful timeout)",
    openB4.includes("waitForLnPeerConnected") && openB4.includes("timeoutMs: 30000"));
  ok("F3 open-channel: a failed wait refuses BEFORE requesting any channel",
    openB4.includes("if (!res.connected) return msg(") && openB4.includes("no channel was requested")
    && openB4.indexOf("if (!res.connected)") < openB4.indexOf("lnSession.openChannel"));
  ok("F3 open-channel: the fixed 4-second connect→open sleep is gone everywhere",
    !appB4.includes("setTimeout(r, 4000)"));
  ok("F3 open-channel: the 10,000-sat minimum still guards OPENS (not connects)",
    openB4.includes("sats < 10000"));
  // SUPERSEDED by the 2026-11-10 reachability fix: the owner
  // directive that replaced this pin's behaviour — the normal
  // flow must never send the user into Advanced to connect a
  // peer; the app connects itself (lnAutoConnect). The Advanced
  // section keeps its explainer for power users.
  ok("F3 explainer: the manual-connect instruction is GONE from the app (auto-connect replaced it)",
    !appB4.includes("→ Advanced, connect to a peer, then tap again.") && !appB4.includes("Connect under Advanced below")
    && appB4.includes("function lnAutoConnect(session)") && advB4.includes("Connecting alone needs no Bitcoin and opens no channel"));

  // F1 — the name-card handler: the busy label is restored by the
  // branch finally on every non-success exit (offer failure, boot
  // failure, any early return); only a painted success keeps a
  // non-resting label.
  const nativeB4 = appB4.slice(appB4.indexOf('$("ownedLnNativeBtn").onclick'), appB4.indexOf("const lnPendingVerifyName"));
  ok("F1 handler: the branch tracks whether the success paint took over the label",
    nativeB4.includes("let painted = false;") && nativeB4.includes("painted = true;"));
  ok("F1 handler: the finally restores the resting label unless the success paint ran",
    nativeB4.includes("if (!painted) btn.textContent = lnStatusSnapshot().nativeBtnLabel;"));
  ok("F1 handler: the resting label is state-derived, never a blind revert to start",
    nativeB4.includes("lnStatusSnapshot().nativeBtnLabel") && !nativeB4.includes('btn.textContent = "Use my Fluid node";'));
  // SUPERSEDED by the 2026-11-10 reachability fix: the old
  // offer-failure message claimed "ready" while pointing into
  // Advanced — the dead-button defect. The new flow waits for
  // the offer with the button disabled, in a single honest
  // connecting state, and returns through the same finally.
  ok("F1 handler: the no-offer path waits for the offer in an honest connecting state (no Advanced pointer, no ready claim)",
    nativeB4.includes("await lnAwaitOffer(60000)") && nativeB4.includes("Connecting your node…")
    && nativeB4.includes("couldn't connect to the Lightning network just now") && nativeB4.includes("finally {")
    && !nativeB4.includes("→ Advanced, connect to a peer"));
  ok("F1 handler: no exit path sets the busy label without the finally behind it",
    (nativeB4.match(/btn\.textContent = "Starting your node…"/g) || []).length === 1
    && nativeB4.indexOf('btn.textContent = "Starting your node…"') < nativeB4.indexOf("if (!painted)"));
}

// ---------- LN node-status clarity + Lightning address (2026-11-10) ----------
const { parseBolt12Offer, parseNameLnOffer, lightningTargetForNameEntry } = await import("../src/wallet-core.js");
// Owner field report: he started his node, the button silently
// reverted to "Use my Fluid node", and only a later panel visit
// showed the node live. And his registry entry carried no offer,
// so his Lightning address resolved to nothing with no in-app way
// to publish it from the panel. Three layers pinned here: the pure
// status derivation, the panel/name-card/home wiring, and the
// BOLT 12 parser's checksum-less form — a current node's offer
// (LDK encodes BOLT 12 WITHOUT a bech32 checksum) must verify,
// publish and resolve, or both features are decoration.
{
  // --- The real LDK 0.2.7 offer fixture: produced by the shipped
  // node itself (create_offer(null, "Fluid"), peer connected, no
  // channels), captured in research_notes/fluid-ln-proxy-wiring-
  // 20261110/offer-repro.txt. Checksum-less, paths-bearing.
  const LDK_OFFER = "lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2q4rxcatfvsg06qt3qvs0tztx4jusenq3afhkagww6ead478p4tg9zpax897s7yu5u0l9uq5se68dk5ncudgnxaldhnzfh83lpzht6pshetl7zamz2xzu2q4xlcpq9tm5tm37cnv34jeujq8ne496h4dgyjv5ygjs4q06pjlrey87sndhqp6w6etr9c3a3sva6wyfak0n585z060lnfj5qtzdkdddhl8ttt8vuq9fcrjplw6uy83td8gp0hyvc8weu5jr4pc8kwxm95fyjcucn7j4sm6g09fuqp6gk30zcr7j8zgzw808y0a60hq4tf9aeyxpssjwzfhx9vewt5tpjakrjzlg2v8vkxjz43cefhlg6qnjnjwxrlkw9lvftuvjrvcgwmqq0v8gja0qgjwfzwnernjqt7f7zsq8g2fw06ttstpq0w2vrfms4ns0933es88mpgdgeukfctr458ras5kpsdm677xzg6m60zype0ep9cwv2gj64ju8zu5gxpghj4mheelxdlpu2ec7ze9vnzl69el53rlmyvdz0pmsrcyl09sv6he4cwzlrqsmdp9la7q5fmhylw8sr5hh50mnma5ckhxtlaqkyyprwan7p6umgdhy6kwsndhd8xpgrzfnfyy88c4yafxr8tc5uszrwtg";
  // The legacy checksummed offer (registry's lnqapipe1 entry shape).
  const LEGACY_OFFER = "lno1qgsxlc5vp2m0rvmjcxn2y34wv0m5lyc7sdj7zksgn35dvxgqqqqqqqq2rfkxuutpwp5hqef3ypcxjur9d35kuefqve5hsar4wfj3yptxd36kjeqkyypjyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsulx9nd";
  const pRepro = parseBolt12Offer(LDK_OFFER);
  ok("bolt12 nocs: a real current-LDK checksum-less offer parses",
    pRepro.kind === "offer" && pRepro.hasPaths === true && pRepro.amountMsat === null && pRepro.description === "Fluid");
  ok("bolt12 nocs: parseNameLnOffer accepts it for a name claim",
    parseNameLnOffer(LDK_OFFER) === LDK_OFFER);
  ok("bolt12 nocs: buildNameEntry carries it onto the entry",
    buildNameEntry("kemi", "0xabc", "bc1q", null, null, null, null, null, LDK_OFFER).kemi.lnOffer === LDK_OFFER);
  ok("bolt12 nocs: pay-by-name resolves an entry carrying it as an offer",
    (() => { const t = lightningTargetForNameEntry({ lnOffer: LDK_OFFER }); return !!t && t.kind === "offer" && t.value === LDK_OFFER; })());
  ok("bolt12 nocs: the legacy checksummed offer still parses via the strict path",
    parseBolt12Offer(LEGACY_OFFER).kind === "offer" && parseNameLnOffer(LEGACY_OFFER) === LEGACY_OFFER);
  ok("bolt12 nocs: garbage is still rejected",
    parseNameLnOffer("lno1garbage") === null && parseNameLnOffer(LDK_OFFER.slice(0, 100)) === null
    && parseNameLnOffer("lnbc1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9") === null
    && parseNameLnOffer("lno1qgsq vgnw") === null);

  // --- lnNodeStatus: the one derivation every surface reads.
  const ready0 = lnNodeStatus({ running: true, network: "bitcoin", nodeId: "02cf9ef2e783d99c", receivableMsat: 0, spendableMsat: 0 });
  ok("lnstatus: running on mainnet reads ready with the plain headline",
    ready0.state === "ready" && ready0.headline === "Your Fluid node is ready ✓" && ready0.detail.includes("Bitcoin mainnet"));
  ok("lnstatus: 0 receiving / 0 sending room reads as normal, never broken",
    ready0.detail.includes("That's normal for a new node") && ready0.detail.includes("first incoming payment opens receiving room"));
  ok("lnstatus: rooms with sats show without the new-node note",
    (() => { const r = lnNodeStatus({ running: true, network: "bitcoin", receivableMsat: 5000, spendableMsat: 2000 }); return r.detail.includes("Receiving room: 5 sats") && !r.detail.includes("That's normal"); })());
  ok("lnstatus: a test network is named as test coins",
    lnNodeStatus({ running: true, network: "signet" }).detail.includes("test coins"));
  ok("lnstatus: running beats an earlier failure (a retry that worked clears it)",
    lnNodeStatus({ running: true, failed: { stage: "download", message: "x" } }).state === "ready");
  ok("lnstatus: starting shows while a boot is in flight",
    lnNodeStatus({ starting: true }).state === "starting");
  const failed = lnNodeStatus({ failed: { stage: "download", message: "Your Lightning node couldn't load — the node program didn't finish downloading." } });
  ok("lnstatus: a failed boot stays a plain failure with retry, not a start button",
    failed.state === "failed" && failed.headline === "Your Fluid node couldn't start" && failed.nativeBtnLabel === "Try starting my node again");
  ok("lnstatus: a created-but-stopped node reads set up, not absent",
    (() => { const s = lnNodeStatus({ exists: true, network: "bitcoin", nodeId: "02cf9ef2e783d99c" }); return s.state === "setup" && s.headline === "Your Fluid node is set up ✓" && s.nativeBtnLabel === "Start my node"; })());
  ok("lnstatus: nothing created reads not-started with the original start label",
    (() => { const s = lnNodeStatus({}); return s.state === "not-started" && s.nativeBtnLabel === "Use my Fluid node"; })());
  ok("lnstatus: the ready name-card label offers registration, not a fresh start",
    lnNodeStatus({ running: true, network: "bitcoin" }).nativeBtnLabel === "Register my node — it's ready");

  // --- lnLightningAddressState: live only when the registry says so.
  ok("lnaddr: no name, no address",
    lnLightningAddressState({}).state === "no-name" && lnLightningAddressState({}).address === null);
  const notPub = lnLightningAddressState({ name: "ethuram", registryOffer: null, currentOffer: LDK_OFFER });
  ok("lnaddr: a name with nothing published is not-published with the publish action",
    notPub.state === "not-published" && notPub.address === "ethuram@fluidwallet.dpdns.org" && notPub.publishLabel === "Publish my Lightning address");
  ok("lnaddr: published offer matching the node's is live, no action offered",
    (() => { const s = lnLightningAddressState({ name: "ethuram", registryOffer: LDK_OFFER, currentOffer: LDK_OFFER }); return s.state === "live" && s.publishLabel === null; })());
  ok("lnaddr: comparison normalises case and a lightning: prefix",
    lnLightningAddressState({ name: "ethuram", registryOffer: LDK_OFFER, currentOffer: "LIGHTNING:" + LDK_OFFER.toUpperCase() }).state === "live");
  ok("lnaddr: a different published offer is live but offers Update",
    (() => { const s = lnLightningAddressState({ name: "ethuram", registryOffer: LEGACY_OFFER, currentOffer: LDK_OFFER }); return s.state === "update-available" && s.publishLabel === "Update my Lightning address"; })());
  ok("lnaddr: published with no current offer to compare is simply live",
    lnLightningAddressState({ name: "ethuram", registryOffer: LDK_OFFER, currentOffer: null }).state === "live");

  // --- Wiring pins: panel, home row, name card all read the one
  // derivation; the publish action rides the existing claim
  // pipeline and verifies against the registry before saying live.
  const appNs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxNs = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  ok("lnstatus wiring: the panel paints the shared status under its title",
    appNs.includes("const statusNow = lnStatusSnapshot();") && appNs.includes("statusNow.headline") && appNs.includes("statusNow.detail"));
  ok("lnstatus wiring: reopening the panel with a live session goes straight to it",
    appNs.includes("if (lnSession && lnSession.network === lnNetKey()) { paintLnPanel(); paintLnNodeStatus(); return; }"));
  ok("lnstatus wiring: a failed boot is recorded as state in lnEnsureSession",
    appNs.includes("lnBootUiState.failed = { stage:") && appNs.includes("lnRememberNode(session)"));
  ok("lnstatus wiring: home rows carry the shared status line",
    idxNs.includes('class="lnNodeStatusText"') && appNs.includes('class="lnNodeStatusText"'));
  ok("lnstatus wiring: the name card carries a persistent status line beside the button",
    idxNs.includes('id="ownedLnNodeStatus"') && appNs.includes("lnNativeOfferError"));
  ok("lnstatus wiring: step-1 success states the node is ready inside the terms",
    appNs.includes("✓ Your Fluid node is ready — set up and running on this device. "));
  const pubNs = appNs.slice(appNs.indexOf("async function lnPublishAddress"), appNs.indexOf("function paintLnSis"));
  ok("lnaddr wiring: publish rides submitNameClaim with the node's offer, hosted address preserved",
    pubNs.includes("submitNameClaim(name, keepLn, offer)") && pubNs.includes("hit.ln ? hit.ln : null") && pubNs.includes("createOffer(null, \"Fluid\")") === false && appNs.includes("lnSession.createOffer(null, \"Fluid\")"));
  ok("lnaddr wiring: publish verifies against the registry before claiming published",
    pubNs.includes("lnAddrPending = { name, offer }") && pubNs.includes('lnAddrView = { status: "published" }') && pubNs.includes("resolveFluidName(name)"));
  ok("lnaddr wiring: the panel Receive section carries the address block",
    appNs.includes('id="lnAddrOut"') && appNs.includes("paintLnAddress();") && appNs.includes("Not live yet"));
  const offerNowNs = appNs.slice(appNs.indexOf("function lnAddrOfferNow"), appNs.indexOf("async function lnAddrRefresh"));
  ok("lnaddr wiring: an offer failure is never cached for the session (publish stays reachable after connecting)",
    offerNowNs.includes("catch { return null; }") && !offerNowNs.includes("lnAddrOffer = null"));
}

// ---------- LN publish reachability + auto-connect (2026-11-10) ----------
// Owner field evidence, second report of the day: (1) the publish
// control shipped inside the Lightning panel only — the Receive
// sheet the asset view's Receive button opens had no address
// block at all, so "Wallet → Lightning → Receive → Publish" led
// nowhere; (2) on the name card, "Register my node — it's ready"
// was a live-looking dead button: a fresh node has no peer, so
// createOffer threw, and the handler restored the ready label
// over the failure — every tap re-ran the same instant failure
// with nothing on screen changing; (3) the Lightning scoped view
// rendered the node-status card twice (scoped row + static row).
// The fixes pinned here: the app connects to its default peer
// itself on boot; the card waits for the offer in a disabled,
// honestly-labelled connecting state and ends failure in a held
// Try again state; the address block paints on both Receive
// surfaces from one state; the static row hides in the LN view.
{
  const appR = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("lnreach: boot auto-connects the default peer (and the reuse path tops it up)",
    appR.includes("lnAutoConnect(session);") && appR.includes("if (lnSession && lnSession.network === net) { lnAutoConnect(lnSession); return lnSession; }")
    && appR.includes("session.connectPeer(lsp.pubkey, lsp.host, lsp.port)"));
  ok("lnreach: auto-connect is mainnet-only, rate-limited, and skips a live/dialling peer",
    appR.includes('session.network !== "bitcoin"') && appR.includes("lnLastAutoDialMs < 15000")
    && appR.includes('p.state === "connected" || p.state === "connecting"'));
  ok("lnreach: the offer wait is shared (one helper, success-cached getter)",
    appR.includes("async function lnAwaitOffer(timeoutMs = 60000)") && appR.includes("const offer = lnAddrOfferNow();"));
  const nativeR = appR.slice(appR.indexOf('$("ownedLnNativeBtn").onclick'), appR.indexOf("const lnPendingVerifyName"));
  ok("lnreach: the card's no-offer tap ends held in Try again — the ready label is never restored over a failure",
    nativeR.includes('btn.textContent = "Try again"; lnNativeLabelHold = true;') && nativeR.includes("let held = false;")
    && nativeR.includes("if (btn && !held)"));
  ok("lnreach: the card's connecting copy is the single true state (running, connecting, automatic)",
    nativeR.includes("It's connecting to the Lightning network so it can build its offer")
    && nativeR.includes("you don't need to connect anything yourself"));
  ok("lnreach: the address block paints every surface from one state (class-painted, per-container binding)",
    appR.includes('document.querySelectorAll(".lnAddrOut").forEach((out) => paintLnAddressInto(out));')
    && appR.includes('class="lnAddrOut"') && appR.includes('id="lnAddrOut" class="lnAddrOut"')
    && appR.includes("paintLnAddress();\n      const paintLn = (ln, name, kind = \"address\") => {"));
  ok("lnreach: the block's no-offer states never point into Advanced (start button / connecting + poll)",
    appR.includes('class="btn ghost lnAddrOpenNode">Start my Fluid node</button>') && appR.includes("lnAddrEnsurePoll();")
    && !appR.includes("connect under <b>Advanced</b> below"));
  ok("lnreach: publish itself waits out a dropped connection before failing, in plain words",
    appR.includes("if (!offer) offer = await lnAwaitOffer(30000);")
    && appR.includes("it's still connecting to the Lightning network"));
  ok("lnreach: the Lightning scoped view hides the static row (status card renders once per view)",
    appR.includes('lrRow.classList.toggle("hidden", viewKey === "lightning")'));
}

// ---------- Arkade composition bridge (Lightning -> Arkade -> BTC) ----------
// The fixture below is a REAL creation record, read back from
// api.satora.io on 2026-11-10 (an unpaid probe creation from
// the standard public test mnemonic — it was never funded and
// simply expires). It pins Fluid's derivation, bounds checker
// and VHTLC port against the live server's own answers.
{
  const PHRASE_ARK = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const identityArk = satoraSwapClaimKey(PHRASE_ARK, 0);
  ok("ark: swap claim key is deterministic per index", satoraSwapClaimKey(PHRASE_ARK, 0).claimPk === identityArk.claimPk && satoraSwapClaimKey(PHRASE_ARK, 0).secretKeyHex === identityArk.secretKeyHex);
  ok("ark: a different index derives a different claim key", satoraSwapClaimKey(PHRASE_ARK, 1).claimPk !== identityArk.claimPk);
  ok("ark: the derivation matches the live server record (hash lock + receiver key)",
    identityArk.hashLock === "0x2acc06197820cfcb43f88795103d130328e7f1d8570f99df88d65513b0b9d202" && identityArk.claimPk === "0294d0fd77f72c0334807b1d982e92e51e9ab0adcac84107bc4d0f674684098818");

  const pairArk = parseLnArkadePair({ pairs: [
    { source: "Bitcoin", target: "1", min_sats: 20000, max_sats: 20000000, fee_percentage: 0.005, network_fee_sats: 0 },
    { source: "Lightning", target: "Arkade", min_sats: 335, max_sats: 1000000, fee_percentage: 0.0015, network_fee_sats: 1 },
  ] });
  ok("ark: the live pair row parses (335 min, 0.15% + 1 sat)", !!pairArk && pairArk.minSats === 335 && pairArk.maxSats === 1000000 && pairArk.feePercentage === 0.0015 && pairArk.networkFeeSats === 1);
  ok("ark: a missing pair parses to null, never a guess", parseLnArkadePair({ pairs: [] }) === null && parseLnArkadePair(null) === null && parseLnArkadePair({}) === null);
  ok("ark: the leg-A estimate equals the live creation's deduction (2673 -> 6)", estimateLnArkadeFeeSats(2673, pairArk) === 6);

  const ARK_ADDR = "ark1qzpq904am6clw3pgqwyh4p02708fy4xs0hcpwt7rwfdttuxsjameeq5ydpgnhyjuyzeun9sycc5gek0d0a4yphmje25s9lwqdfafk0027450qg";
  const reqArk = buildLnArkadeCreateRequest({ identity: identityArk, sourceSats: 2673, targetArkadeAddress: ARK_ADDR, extraFeesBps: 0 });
  ok("ark: create request is the reference shape (source amount only, script version pinned)",
    reqArk.hash_lock === identityArk.hashLock && reqArk.claim_pk === identityArk.claimPk && reqArk.user_id === identityArk.userId
    && reqArk.source_amount_sats === 2673 && reqArk.target_arkade_address === ARK_ADDR && reqArk.arkade_htlc_script_version === 1
    && !("target_amount_sats" in reqArk) && reqArk.extra_fees === 0);
  const reqArkFee = buildLnArkadeCreateRequest({ identity: identityArk, sourceSats: 2673, targetArkadeAddress: ARK_ADDR, extraFeesBps: 25 });
  ok("ark: a fee-bearing request carries the referral code + extra_fees", reqArkFee.extra_fees === 25 && typeof reqArkFee.referral_code === "string" && reqArkFee.referral_code.length > 0);

  const FIXTURE_ARK = {
    direction: "lightning_to_arkade", id: "3f4cb859-083e-4c80-992f-f6f52cd39001", status: "pending",
    bolt11_invoice: "lnbc26730n1p40y77qpp59txqvxtcyr8ukslcs723q0gnqv5w0uwc2u8enhug6e238v9e6gpqsp53pg90usyvd6mn75f7z4kc8upd3uve9xuj6svt7pdytradlu8hdsqxqrwzqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpudpugek826tyypxyutf7g9exkctyv5s8qun0vfjjq2rwv4mx2u3qve6kuer9vs5s9qyyssqm2un37crzljjpcy7f6w77ycc98ul374tqtwddc4g9sjw66kjtmz3x966kt5l9q59xtzdaztn24j07mswq852xgl2m4gzuuhcrg0qemcpkyw3jl",
    invoice_expires_at: 1794290687, fee_sats: 5, network_fee_sats: 1,
    hash_lock: "0x2acc06197820cfcb43f88795103d130328e7f1d8570f99df88d65513b0b9d202",
    arkade_vhtlc_address: "ark1qzpq904am6clw3pgqwyh4p02708fy4xs0hcpwt7rwfdttuxsjameefmz99ake0ad8qfmemxl8t2hh5tztppfvjfdtla6dycm3dg3dyvmm84y9n",
    arkade_htlc_script_version: 1, target_arkade_address: ARK_ADDR,
    sender_pk: "6e644a3034da6e1278ba287c89e0dd0dad14ca02df92ae02a4d4662b8f9867cb",
    receiver_pk: "0294d0fd77f72c0334807b1d982e92e51e9ab0adcac84107bc4d0f674684098818",
    arkade_server_pk: "038202bebddeb1f7442803897a85eaf3ce9254d07df0172fc3725ab5f0d097779c",
    vhtlc_refund_locktime: 1794278087, unilateral_claim_delay: 605184, unilateral_refund_delay: 778240,
    unilateral_refund_without_receiver_delay: 778240, network: "bitcoin", source_amount: "2673", target_amount: "2667",
  };
  const checkArkArgs = { identity: identityArk, sourceSats: 2673, targetArkadeAddress: ARK_ADDR, nowSec: 1794270000 };
  ok("ark: the live creation record passes the bounds check", checkLnArkadeCreateResponse(FIXTURE_ARK, checkArkArgs).ok === true);
  const tamperArk = (patch) => checkLnArkadeCreateResponse({ ...FIXTURE_ARK, ...patch }, checkArkArgs).ok === false;
  ok("ark: tampered creations are refused (amount, lock, receiver, version, status, invoice)",
    tamperArk({ target_amount: "9999" }) && tamperArk({ source_amount: "2000" })
    && tamperArk({ hash_lock: "0x" + "00".repeat(32) }) && tamperArk({ receiver_pk: "02" + "11".repeat(32) })
    && tamperArk({ arkade_htlc_script_version: 2 }) && tamperArk({ status: "funded" })
    && tamperArk({ bolt11_invoice: "lnbc1invalid" }) && tamperArk({ arkade_vhtlc_address: "not-an-address" })
    && tamperArk({ vhtlc_refund_locktime: 1000 }));
  const parsedArk = parseLnArkadeCreation(FIXTURE_ARK);
  ok("ark: creation parse — leg-A truth is 6 sats, invoice expiry normalised to ms",
    parsedArk.legAFeeSats === 6 && parsedArk.targetSats === 2667 && parsedArk.feeSats === 5 && parsedArk.networkFeeSats === 1
    && parsedArk.invoiceExpiresAt === 1794290687000 && parsedArk.invoice === FIXTURE_ARK.bolt11_invoice);

  const LIVE_PROGRAM_ARK = { intentFee: { offchainInput: "inputType == 'vtxo' && expiry - now() > 2505216.0? amount * 0.002: 0.0", onchainInput: "", offchainOutput: "", onchainOutput: "200.0" }, txFeeRate: "0" };
  const progArk = parseArkadeIntentFees(LIVE_PROGRAM_ARK);
  ok("ark: the live operator fee program parses (200 flat + 0.2% conditional)", !!progArk && progArk.onchainOutputFlatSats === 200 && progArk.offchainInputRate === 0.002 && progArk.offchainInputMinExpirySecs === 2505216);
  ok("ark: unrecognised fee programs are refused, never guessed",
    parseArkadeIntentFees({ intentFee: { offchainInput: "amount * 0.5", onchainOutput: "200.0" } }) === null
    && parseArkadeIntentFees({ intentFee: { offchainInput: "", onchainOutput: "amount * 2" } }) === null
    && parseArkadeIntentFees({ intentFee: { offchainInput: "inputType == 'vtxo' && expiry - now() > 100.0? amount * 0.5: 0.0", onchainOutput: "200.0" } }) === null
    && parseArkadeIntentFees(null) === null && parseArkadeIntentFees({}) === null);
  ok("ark: offboard fee math (worst case / fresh VTXO / long-lived VTXO)",
    arkadeOffboardFeeSats(2667, progArk, { worstCase: true }) === 206
    && arkadeOffboardFeeSats(2667, progArk, { vtxoExpirySecs: 1100, nowSecs: 1000 }) === 200
    && arkadeOffboardFeeSats(2667, progArk, { vtxoExpirySecs: 3001000, nowSecs: 1000 }) === 206);

  const quoteArk = composeBridgeQuote({ sourceSats: 2673, pair: pairArk, legAQuoteSats: 6, offboardProgram: progArk, btcUsd: 74832 });
  ok("ark: the $2 quote composes inside the honesty gate (route cost 212 sats)", !!quoteArk && quoteArk.gate.ok === true && quoteArk.routeCostSats === 212 && quoteArk.offboardFeeSats === 206 && quoteArk.gate.capSats === BRIDGE_ROUTE_COST_CAP_SATS);
  ok("ark: the $2 quote's receive lands in the research band (~2,450 sats)", quoteArk.receiveSats > 2400 && quoteArk.receiveSats < 2500);
  ok("ark: Fluid's fee obeys the fee law's 0.5% amount cap", quoteArk.fluidFeeSats <= Math.floor(2673 * 0.005) && quoteArk.fluidFeeBps > 0);
  const quoteGateArk = composeBridgeQuote({ sourceSats: 2673, pair: pairArk, legAQuoteSats: 600, offboardProgram: progArk, btcUsd: 74832 });
  ok("ark: a 600-sat leg A trips the gate — the flow refuses", !!quoteGateArk && quoteGateArk.gate.ok === false && quoteGateArk.routeCostSats > BRIDGE_ROUTE_COST_CAP_SATS);
  const linesArk = formatBridgeQuoteLines(quoteArk);
  ok("ark: quote lines are itemised and carry the real figures", linesArk.length === 7 && linesArk[0].includes("2,673") && linesArk[5].includes(quoteArk.receiveSats.toLocaleString()) && linesArk[6].includes(quoteArk.totalCostSats.toLocaleString()));

  const storeArk = { m: new Map(), getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }, setItem(k, v) { this.m.set(k, String(v)); } };
  ok("ark: the creation index starts at 0 and bumps persist", bridgeCreationIndex(storeArk) === 0 && (bumpBridgeCreationIndex(storeArk, 0), bridgeCreationIndex(storeArk) === 1));
  saveBridgeRecord(storeArk, { id: "ark-test-1", index: 0, phase: "claimable", sourceSats: 2673, receiveSats: 2448, btcAddress: "bc1qexampleaddress" });
  const recsArk = loadBridgeRecords(storeArk);
  ok("ark: records round-trip with an honest history line", recsArk.length === 1 && bridgeHistoryLine(recsArk[0]).includes("2,673") && bridgeHistoryLine(recsArk[0]).includes("2,448") && bridgePhaseLabel(recsArk[0]).includes("ready to claim"));
  ok("ark: the index never reuses a spent record index", bridgeCreationIndex(storeArk, [{ index: 7 }]) >= 8);

  const arkChunkMod = await import("../src/arkade.js");
  ok("ark: the lazy chunk carries its load marker", arkChunkMod.ARKADE_CHUNK_MARKER === true);
  const vhtlcArk = arkChunkMod.bridgeVhtlc({ record: parsedArk, hashLock: identityArk.hashLock });
  ok("ark: the ported VHTLC reproduces the live server address byte-exact", vhtlcArk.address === FIXTURE_ARK.arkade_vhtlc_address);

  const htmlArk = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const appArk = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  ok("ark: the bridge has its own tab (ALWAYS-WARN LAW v2)", htmlArk.includes('data-tab="bridge"') && htmlArk.includes('id="tab-bridge"') && htmlArk.includes("Getting onto Lightning is safe and locked down"));
  ok("ark: the three acknowledgements exist and none is pre-ticked", ["bridgeAck1", "bridgeAck2", "bridgeAck3"].every((id) => htmlArk.includes(`id="${id}"`)) && !/id="bridgeAck[123]"[^>]*checked/.test(htmlArk));
  ok("ark: the warnings name expiry, irreversibility and the operator's limits", htmlArk.includes("Arkade coins expire") && htmlArk.includes("cannot be undone") || htmlArk.includes("can't be undone") || htmlArk.includes("Irreversible steps"));
  ok("ark: app.js drives the tab through the lazy chunk + core gate", appArk.includes('import("./arkade.chunk.js")') && appArk.includes("ARKADE_CHUNK_MARKER") && appArk.includes("BRIDGE_ROUTE_COST_CAP_SATS") && appArk.includes("bridgeRefresh"));
  ok("ark: exit destinations default to the user's own Fluid Bitcoin address (owner direction, 2026-11-10)",
    appArk.includes("function bridgeOwnBtcAddress()")
    && appArk.includes("btcAddr || bitcoinAddress(wallet.mnemonic.phrase)")
    && appArk.includes("Destination Bitcoin address — your Fluid Bitcoin address")
    && appArk.includes("Or exit everything to a Bitcoin address — your Fluid Bitcoin address")
    && appArk.includes("These sats land in your own Fluid Bitcoin wallet")
    && appArk.includes('autocapitalize="none" readonly value="${esc(own)}"'));
  ok("ark: another wallet is an explicit Change-destination choice on both exit fields, never the starting state",
    appArk.includes('id="bridgeDestChange"') && appArk.includes('id="bridgeDestOwn"')
    && appArk.includes('id="bridgeExitAllChange"') && appArk.includes('id="bridgeExitAllOwn"')
    && appArk.includes("Use my Fluid Bitcoin address")
    && !appArk.includes("Destination Bitcoin address (your external wallet)"));
  ok("ark: no derivable own address means an honest unfilled field, never a guessed pre-fill",
    appArk.includes("Your own Fluid Bitcoin address isn't available right now, so nothing was filled in for you"));
  ok("ark: the tab copy matches the default (own address first, another wallet by choice)",
    htmlArk.includes("to your own Fluid Bitcoin address by default, or to another wallet if you choose")
    && !htmlArk.includes("to an external Bitcoin wallet"));
  const chunkArk = readFileSync(new URL("../src/arkade.js", import.meta.url), "utf8");
  ok("ark: the chunk boot warms the operator snapshot and retries transient failures (QA fix, 2026-11-10)", chunkArk.includes("attempt < 3") && chunkArk.includes("getArkadeInfo()") && appArk.includes("bridgeArkRetry"));
  const buildArk = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  const publishArk = readFileSync(new URL("../scripts/publish.mjs", import.meta.url), "utf8");
  ok("ark: the chunk is built and published as its own artifact", buildArk.includes("dist/arkade.chunk.js") && buildArk.includes('"./arkade.chunk.js"') && publishArk.includes('"arkade.chunk.js"'));
}

// ---------- audit fix batch (2026-11-10): F2 / TS-F1 / TS-F2 /
// P1-16 / P1-3 / §1.11 ----------
{
  const appSrcBatch = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

  // F2, Relay leg — the live zkSync→Base $1 quote captured
  // 2026-11-10: Relay declares $4.666 of fees, of which "gas" is
  // $4.619255 — a padded worst-case estimate the user never pays
  // (the swap settles out of the input). The true loss is the
  // shortfall: $0.999767 in, $0.981167 out = $0.0186. Under the
  // old larger-of combiner the route cost read $4.666, the fee
  // law's EVM ceiling ($0.20) zeroed Fluid's fee, and the swap
  // sheet showed a ~$5 route cost on a $1 swap.
  const F2USER = "0x9780504dEE2cDcD003484816a3731eb48bE8Ee34";
  const zksyncQuoteF2 = {
    requestId: "0xf2zksync",
    steps: [{ id: "deposit", kind: "transaction", items: [{ status: "incomplete", data: { from: F2USER, to: "0x0000000000000000000000000000000000000001", data: "0x", value: "0", chainId: 324, gas: "300000" } }] }],
    fees: {
      gas: { amount: "2182000000000000000", amountUsd: "4.619255" },
      relayer: { amount: "11040000000000000", amountUsd: "0.023370" },
      relayerGas: { amount: "404000000000000", amountUsd: "0.000855" },
      relayerService: { amount: "10630000000000000", amountUsd: "0.022515" },
      app: { amount: "0", amountUsd: "0" },
    },
    details: {
      operation: "swap", sender: F2USER, recipient: F2USER,
      currencyIn: { currency: { chainId: 324, address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4", symbol: "USDC", name: "USD Coin", decimals: 6 }, amount: "1000000", amountFormatted: "1.0", amountUsd: "0.999767", minimumAmount: "1000000" },
      currencyOut: { currency: { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 }, amount: "981167", amountFormatted: "0.981167", amountUsd: "0.981167", minimumAmount: "971000" },
      timeEstimate: 5,
    },
  };
  const zkRoute = parseRelayQuote(zksyncQuoteF2, { fromChainKey: "zksync", toChainKey: "base", fromAmount: "1000000", fromAddress: F2USER });
  ok("F2: the zkSync Relay route cost is the $0.0186 shortfall, not the $4.67 declared estimate",
    zkRoute !== null && Math.abs(zkRoute.routeFeeUsd - 0.0186) < 1e-6);
  ok("F2: the zkSync route's fee is non-zero under the unchanged fee law, and its label is sane",
    zkRoute !== null && platformFeeBpsForRoute(zkRoute.routeFeeUsd, zkRoute.fromAmountUSD, "base") >= 40
    && Math.abs(swapRouteCostLabel(zkRoute).usd - 0.0186) < 1e-6);

  // F2, Mayan leg — the live dust quote captured 2026-11-10
  // (Solana USDC → Arbitrum USDC, $0.10): Mayan's `price` field is
  // the EXECUTION ratio 0.4922 (expectedOut/effectiveIn), so the
  // old parser valued the $0.10 input at $0.0492 and read a
  // ~$0.00014 route cost on a true $0.0508 loss. deadline64 is
  // refreshed in the fixture (the capture's own deadline has
  // passed; every priced field is the capture's, untouched).
  const mayanDustQuoteF2 = {"meta":{"title":"Fast MCTP","advertisedDescription":"via cctp v2","advertisedTitle":"","icon":"","switchText":""},"maxUserGasDrop":0.000007682223837782328,"withHub":false,"hubRelayerFee64":"0","circleMaxFee64":"12","fastMctpMinFinality":1,"sendTransactionCost":0,"rentCost":"1774800","gasless":false,"slippageBps":100,"effectiveAmountIn":0.1,"effectiveAmountIn64":"100000","expectedAmountOut":0.049192,"price":0.49222881339293006,"priceImpact":null,"minAmountOut":0.048949,"minReceived":0.048949,"route":null,"swapRelayerFee":0,"swapRelayerFee64":"0","solanaRelayerFee":0,"solanaRelayerFee64":"0","redeemRelayerFee":0.050788,"redeemRelayerFee64":"50788","refundRelayerFee":0.050788,"refundRelayerFee64":"50788","clientRelayerFeeSuccess":0.05078777,"clientRelayerFeeRefund":0.05078777,"cancelRelayerFee64":null,"submitRelayerFee64":null,"deadline64":"2000000000","fromToken":{"name":"USD Coin","standard":"spl","symbol":"USDC","mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","verified":true,"contract":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","chainId":0,"wChainId":1,"decimals":6,"logoURI":"https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png?1547042389","coingeckoId":"usd-coin","pythUsdPriceId":"0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a","realOriginContractAddress":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","realOriginChainId":1,"supportsPermit":false,"hasAuction":true},"fromChain":"solana","toToken":{"name":"USDC","standard":"erc20","hasAuction":true,"symbol":"USDC","mint":"CR4xnGrhsu1fWNPoX4KbTUUtqGMF3mzRLfj4S6YEs1Yo","verified":true,"contract":"0xaf88d065e77c8cc2239327c5edb3a432268e5831","chainId":42161,"wChainId":23,"decimals":6,"logoURI":"https://assets.coingecko.com/coins/images/6319/small/usdc.png?1696506694","coingeckoId":"usd-coin","pythUsdPriceId":"0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a","realOriginContractAddress":"0xaf88d065e77c8cc2239327c5edb3a432268e5831","realOriginChainId":23,"supportsPermit":true,"peggedAsset":"USD"},"toChain":"arbitrum","mintDecimals":null,"gasDrop":0,"eta":1,"etaSeconds":35,"clientEta":"35s","bridgeFee":0,"suggestedPriorityFee":30000,"type":"FAST_MCTP","priceStat":{"ratio":0.9999081532988366,"status":"GOOD"},"referrerBps":0,"protocolBps":3,"protocolFeeUsd":0.000014760299999999998,"referrerFeeUsd":0,"hasAuction":false,"onlyBridging":true,"fastMctpMayanContract":"Gx9rivpS3YR8pBFwMuP6omYqVxunpLvLkNn7ubNyuZZ5","fastMctpInputContract":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","toPrice":0.99978361,"minMiddleAmount":0.0995078777,"sourceSwapExpense":0,"expectedAmountOutBaseUnits":"49192","minAmountOutBaseUnits":"48949","minReceivedBaseUnits":"48949","signature":"0x1b31353a1b1603e327c729c93268427f69a4ad7940bf65ee06dea8f8547cb29813358f2279ea8c20aa379b9edcae7365cb1f4999d3fd0799b51018fa56915d2d1c"};
  const dustArgsF2 = { fromChainKey: "solana", toChainKey: "arbitrum", fromTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", toTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", fromAmount: "100000", fromAddress: "FDo3sA7RKCD4KTGutuQXHVLAjavrgNQF547fB8tPhqMz", toAddress: F2USER };
  const dustFair = parseMayanQuote(mayanDustQuoteF2, dustArgsF2, { feeBps: 0, solPriceUsd: 190, symbolPricesUsd: { USDC: 1 }, mintPricesUsd: { "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1 } });
  ok("F2: the Mayan dust quote priced at fair value reads its true $0.0508 route cost",
    dustFair !== null && Math.abs(dustFair.fromAmountUSD - 0.1) < 1e-9 && Math.abs(dustFair.toAmountUSD - 0.049192) < 1e-9
    && Math.abs(dustFair.routeFeeUsd - 0.050808) < 1e-6);
  const dustBlind = parseMayanQuote(mayanDustQuoteF2, dustArgsF2, { feeBps: 0, solPriceUsd: 190 });
  ok("F2: without fair prices the parser keeps its quote-derived fallback (coverage over precision)",
    dustBlind !== null && dustBlind.routeFeeUsd < 0.001);

  // TS-F1: the deadline helper, and dotApi's cache discipline —
  // a stalled connection attempt must reject at the deadline and
  // must NOT stay cached for the next call to await forever.
  ok("TS-F1: withDeadline resolves a fast promise and rejects a hanging one at the deadline",
    (await withDeadline(Promise.resolve(42), 1000, "T")) === 42
    && await withDeadline(new Promise(() => {}), 50, "T").then(() => false, e => /timed out/.test(e.message)));
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {}); // a fetch that never answers
    try {
      const t0 = Date.now();
      const p1 = dotApi(60);
      const first = await p1.then(() => "resolved", e => e.message);
      const p2 = dotApi(60);
      const second = await p2.then(() => "resolved", e => e.message);
      ok("TS-F1: a stalled Polkadot connection times out instead of hanging the card forever",
        /timed out/.test(first) && Date.now() - t0 < 5000);
      ok("TS-F1: the timed-out connection attempt is not cached — the next call retries fresh",
        /timed out/.test(second) && p2 !== p1);
    } finally { globalThis.fetch = realFetch; }
  }
  // TS-F1 (app side): a failed DOT read swaps in null-amount rows,
  // the XRPL F12 pattern, so the card can paint "couldn't load".
  ok("TS-F1: the app's DOT failure path swaps in unknown (null) rows",
    appSrcBatch.includes("dotBalances = [{ symbol: \"DOT\", name: \"Polkadot\", amount: null"));

  // TS-F2 (app source): every family's failed load nulls its card
  // total (renders "—"), and a fully-failed Cosmos card does too.
  ok("TS-F2: failed families report a null (—) header total, not $0.00",
    appSrcBatch.includes("m.tron = tronLoadFailed ? null :") && appSrcBatch.includes("m.xrpl = xrpLoadFailed ? null :")
    && appSrcBatch.includes("m.bitcoincash = bchLoadFailed ? null :") && appSrcBatch.includes("m.polkadot = dotLoadFailed ? null :")
    && appSrcBatch.includes("r.amount == null ? null : Number(r.amount)") && appSrcBatch.includes("COSMOS_CHAINS.every(c => totals[c.key] == null)"));

  // P1-16: transaction-id shapes route to a transaction lookup.
  ok("P1-16: a 0x transaction hash is detected as an EVM txid (not a Sui address)",
    detectScanTxid("0x" + "ab".repeat(32))?.kind === "evm");
  ok("P1-16: a bare 64-hex id is a Bitcoin/Tron txid; a 64-byte base58 string is a Solana signature",
    detectScanTxid("ab".repeat(32))?.kind === "btc-tron"
    && detectScanTxid("99eUso3aSbE9tqGSTXzo3TLfKb9RkMTURrHKQ1K7Zh3BbeqPevr5E1iCbpTjqHuTFLtfxTTD5ekfVuZFzQyEQf8")?.kind === "solana");
  ok("P1-16: addresses are never mistaken for transaction ids",
    detectScanTxid("0x" + "ab".repeat(20)) === null && detectScanTxid("US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx") === null
    && detectScanTxid("") === null && detectScanTxid("ethuram") === null);

  // P1-3: the app strips a core-carried prefix before adding its
  // own — the doubled "Route search failed: Route search failed:"
  // can no longer print.
  ok("P1-3: the swap sheet cannot double the route-search prefix",
    appSrcBatch.includes('replace(/^Route search failed:\\s*/, "")'));

  // §1.11(a): the US unavailable row speaks per-mode — the sell
  // sheet carries sell terms, never the buy sheet's 0%-fee copy.
  ok("§1.11: the US sell note is sell copy; the buy note keeps the buy terms",
    !rampRoutesFor("US", "sell").routes[0].note.includes("first CHF 500") && rampRoutesFor("US", "sell").routes[0].note.includes("sells start at CHF 50")
    && rampRoutesFor("US", "buy").routes[0].note.includes("first CHF 500") && rampRoutesFor("US", "buy").routes[0].note.includes("held 7 days"));
  // §1.11(c): Cosmos failure rows use the shared wording.
  ok("§1.11: Cosmos failure rows say \"couldn't load\" like every other family",
    appSrcBatch.includes("<small>couldn't load</small>") && !appSrcBatch.includes("<small>unavailable</small>"));

  // P1-17 (app source): opening a sheet arms a history entry and a
  // popstate closes the sheet instead of leaving the wallet.
  ok("P1-17: sheets arm a history entry; back closes the sheet, not the app",
    appSrcBatch.includes("history.pushState({ fluidSheet: 1 }") && appSrcBatch.includes('addEventListener("popstate"')
    && appSrcBatch.includes("sheetHistSwallow"));
}

// ---------- non-custodial ramp fees (2026-11-10) ----------
// The own-charge mechanism for deposit-address ramp sells, per
// research_notes/fluid-noncustodial-ramp-fee-20261109: Tier 1
// Permit2 batch split (EVM) / native split (Solana), Tier 2
// sequential fallback, fee sized by the shipped fee law and
// disclosed in the review sentence. These pins lock the design's
// worked table, the gates, and every refusal path.
{
  const appSrcRf = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const BSC_USDT = NETWORKS.bsc.tokens.find(t => t.symbol === "USDT");
  const worked = { family: "evm", chainKey: "bsc", tier1Eligible: true, gasUsd: 0.005,
    composeExtraUsd: 0.003, leg2GasUsd: 0.002, tokenDecimals: 6, tokenPriceUsd: 1 };

  // The design §2 worked table (provider quotes at a 0.5% spread).
  const q20 = rampFeeQuote({ ...worked, amountInUsd: 20, amountOutUsd: 19.9, providerRaw: 20_000_000n });
  ok("rampfee: the $20 row composes at tier 1 with the design's $0.095 fee, provider whole",
    q20.tier === 1 && q20.feeRaw === 95000n && q20.providerRaw === 20_000_000n
    && q20.totalRaw === 20_095_000n && Math.abs(q20.routeCostUsd - 0.105) < 1e-9 && q20.reason === "ok");
  const q1 = rampFeeQuote({ ...worked, amountInUsd: 1, amountOutUsd: 0.995, providerRaw: 1_000_000n });
  ok("rampfee: the $1 row prices a $0.005 fee that fails the compose gate — bare send, fee $0",
    q1.tier === 0 && q1.feeRaw === 0n && q1.totalRaw === 1_000_000n && q1.reason === "compose-gas");
  const q100 = rampFeeQuote({ ...worked, amountInUsd: 100, amountOutUsd: 99.5, providerRaw: 100_000_000n });
  ok("rampfee: the $100 row's route cost alone exceeds the $0.20 ceiling — the law itself charges $0",
    q100.tier === 0 && q100.feeRaw === 0n && q100.reason === "zero-law");

  // Route cost is fair-value shortfall + declared provider fee +
  // gas; an unmeasured side never yields a guessed fee.
  ok("rampfee: route cost clamps a negative spread to zero and adds the provider's declared fee",
    rampRouteCostUsd({ amountInUsd: 20, amountOutUsd: 20.5, gasUsd: 0.005 }) === 0.005
    && Math.abs(rampRouteCostUsd({ providerFeeUsd: 0.02, amountInUsd: 20, amountOutUsd: 19.9, gasUsd: 0.005 }) - 0.125) < 1e-12
    && rampRouteCostUsd({ amountInUsd: 20, amountOutUsd: null }) === null);
  const qUnmeasured = rampFeeQuote({ ...worked, amountInUsd: 20, amountOutUsd: null, providerRaw: 20_000_000n });
  ok("rampfee: an unmeasured quote sends bare and says why — never a guessed fee",
    qUnmeasured.tier === 0 && qUnmeasured.feeRaw === 0n && qUnmeasured.reason === "unmeasured");
  const qFeeInR = rampFeeQuote({ ...worked, providerFeeUsd: 0.02, amountInUsd: 20, amountOutUsd: 19.9, providerRaw: 20_000_000n });
  ok("rampfee: a declared provider fee counts in the route cost (fee $0.075 at the worked numbers)",
    qFeeInR.tier === 1 && qFeeInR.feeRaw === 75000n);
  const qDust = rampFeeQuote({ ...worked, gasUsd: 0, amountInUsd: 0.0001, amountOutUsd: 0.0000995, providerRaw: 100n });
  ok("rampfee: a fee that floors below one raw unit is dust — refused, not rounded up",
    qDust.tier === 0 && qDust.feeRaw === 0n && qDust.reason === "dust");
  ok("rampfee: a zero or unreadable provider amount is refused outright",
    rampFeeQuote({ ...worked, amountInUsd: 20, amountOutUsd: 19.9, providerRaw: 0n }).reason === "bad-amount");
  ok("rampfee: the raw fee never exceeds the shipped law's own raw-units cap and never reaches the principal",
    q20.feeRaw <= platformFeeOn(20_000_000n, PLATFORM_FEE_BPS) && q20.feeRaw < q20.providerRaw);

  // Tier eligibility by shape (design §4/§5).
  ok("rampfee: tier-1 eligibility is the listed-token test on EVM, native-or-listed on Solana, never Tron",
    rampTier1Eligible("evm", "bsc", BSC_USDT) === true
    && rampTier1Eligible("evm", "bsc", { address: "0x000000000000000000000000000000000000dEaD", symbol: "XXX", decimals: 18 }) === false
    && rampTier1Eligible("evm", "bsc", null) === false
    && rampTier1Eligible("solana", null, null) === true
    && rampTier1Eligible("solana", null, SOLANA_TOKENS.find(t => t.symbol === "USDC")) === true
    && rampTier1Eligible("solana", null, { address: "So11111111111111111111111111111111111111111", symbol: "X", decimals: 9 }) === false
    && rampTier1Eligible("tron", null, null) === false);
  const qNative = rampFeeQuote({ ...worked, tier1Eligible: false, amountInUsd: 20, amountOutUsd: 19.9, providerRaw: 20_000_000n });
  ok("rampfee: a shape tier 1 cannot cover falls to tier 2 when the fee clears the second leg's gas",
    qNative.tier === 2 && qNative.feeRaw === 95000n && qNative.totalRaw === 20_095_000n);
  const qNativeSmall = rampFeeQuote({ ...worked, tier1Eligible: false, leg2GasUsd: 0.5, amountInUsd: 20, amountOutUsd: 19.9, providerRaw: 20_000_000n });
  ok("rampfee: tier 2 refuses when the second leg's gas would eat the fee",
    qNativeSmall.tier === 0 && qNativeSmall.feeRaw === 0n && qNativeSmall.reason === "leg2-gas");
  const qSolRent = rampFeeQuote({ family: "solana", tier1Eligible: true, amountInUsd: 20, amountOutUsd: 19.9,
    gasUsd: 0.14, composeExtraUsd: 0.13, leg2GasUsd: 0.0008, providerRaw: 20_000_000n, tokenDecimals: 6, tokenPriceUsd: 1 });
  ok("rampfee: a first-ever Solana fee whose collection account rent dwarfs it sends bare",
    qSolRent.tier === 0 && qSolRent.reason === "compose-gas" && qSolRent.feeRaw === 0n);
  const qSolRentCap = rampFeeQuote({ family: "solana", tier1Eligible: true, amountInUsd: 20, amountOutUsd: 19.9,
    gasUsd: 0.31, composeExtraUsd: 0.306, leg2GasUsd: 0.0008, providerRaw: 20_000_000n, tokenDecimals: 6, tokenPriceUsd: 1 });
  ok("rampfee: when the rent-inclusive route cost alone passes Solana's $0.30 ceiling the law charges $0 first",
    qSolRentCap.tier === 0 && qSolRentCap.reason === "zero-law" && qSolRentCap.feeRaw === 0n);
  const qTron = rampFeeQuote({ family: "tron", tier1Eligible: false, amountInUsd: 100, amountOutUsd: 99.6,
    gasUsd: 2, leg2GasUsd: 1, providerRaw: 100_000_000n, tokenDecimals: 6, tokenPriceUsd: 1 });
  ok("rampfee: Tron prices out under the fee law — two honest energy legs exceed the total ceiling at any size",
    qTron.tier === 0 && qTron.feeRaw === 0n && qTron.reason === "zero-law");

  // The review sentences (design §2) — the fee line is never omitted.
  const s1 = formatRampSellIntent({ tier: 1, amountText: "20", symbol: "USDT", fiatText: "₦27,400", providerName: "Paycrest", feeText: "0.095", totalText: "20.095", networkFeeText: "0.0011 BNB", authorisation: true });
  ok("rampfee: the tier-1 sentence names every figure, the same-transaction promise and the refund promise",
    s1.includes("Sell 20 USDT") && s1.includes("₦27,400") && s1.includes("Fluid's fee: 0.095 USDT")
    && s1.includes("in the same transaction") && s1.includes("fee comes back to you automatically")
    && s1.includes("expires in 30 minutes") && s1.includes("Paycrest"));
  const s1Sol = formatRampSellIntent({ tier: 1, amountText: "20", symbol: "USDC", fiatText: "₦27,400", providerName: "Paycrest", feeText: "0.1", totalText: "20.1", networkFeeText: "0.000005 SOL" });
  ok("rampfee: the Solana tier-1 sentence claims no authorisation expiry — there is no authorisation to expire",
    s1Sol.includes("in the same transaction") && !s1Sol.includes("expires") && !s1Sol.includes("authorisation"));
  const s2 = formatRampSellIntent({ tier: 2, amountText: "20", symbol: "BNB", fiatText: "$19.90", feeText: "0.000138", totalText: "20.000138", networkFeeText: "0.002 BNB" });
  ok("rampfee: the tier-2 sentence promises the fee moves only after the provider confirms — never a same-transaction claim",
    s2.includes("only after the provider confirms") && s2.includes("Fluid's fee: 0.000138 BNB") && !s2.includes("same transaction"));
  const s0 = formatRampSellIntent({ tier: 0, amountText: "20", symbol: "USDT", fiatText: "₦27,400", feeText: "0", totalText: "20", networkFeeText: "0.001 BNB" });
  ok("rampfee: a bare sale still prints the fee line — as $0",
    s0.includes("Fluid's fee: $0 — this sale carries no Fluid fee."));

  // Sends stay free: the ramp mechanism never touches the send path's
  // fee posture.
  ok("rampfee: plain sends remain outside platform-fee scope",
    platformFeeApplies("send") === false && platformFeeApplies("receive") === false);

  // The send sheets carry the cash-out composition.
  ok("rampfee: all three send sheets offer the cash-out declaration and the composition paths",
    appSrcRf.includes("This is a cash-out") && appSrcRf.includes("executeRampFeeSendEvm")
    && appSrcRf.includes("sendSolanaRampSplit") && appSrcRf.includes("openRampOrderSheet")
    && appSrcRf.includes("formatRampSellIntent"));
}

// ---------- ramp fees: Permit2 batch construction (2026-11-10) ----------
{
  const BSC_USDT = NETWORKS.bsc.tokens.find(t => t.symbol === "USDT");
  const PROVIDER = "0x1111111111111111111111111111111111111111";
  const testWallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const DL = Math.floor(Date.now() / 1000) + 1800; // inside the builder's sane deadline bound
  ok("rampfee: the ramp composition targets the canonical Permit2 — the same contract the Satora flow pins",
    PERMIT2_ADDRESS === "0x000000000022D473030F116dDEE9F6B43aC78BA3" && PERMIT2_ADDRESS === SATORA_PERMIT2_ADDRESS);
  ok("rampfee: the batch type string is the canonical Permit2 batch shape, spender included",
    RAMP_PERMIT_BATCH_TYPE_STRING === "PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)");

  const built = buildRampPermitBatch({ chainId: 56, owner: testWallet.address, token: BSC_USDT.address,
    legs: [{ to: PROVIDER, amountRaw: 20_000_000n }, { to: FEE_SPLIT.dripbot.agentWallet.evm, amountRaw: 95000n }],
    nonce: 424242n, deadline: DL });
  ok("rampfee: the batch builds with the user as their own spender (self-relayed, no third party)",
    built.ok === true && built.message.spender === testWallet.address
    && built.message.permitted.length === 2 && built.transferDetails.length === 2);
  ok("rampfee: permitted[i] pairs with transferDetails[i] — same token twice, amounts and recipients aligned",
    built.transferDetails.every((d, i) => d.requestedAmount === built.message.permitted[i].amount)
    && built.transferDetails[0].to === PROVIDER && built.transferDetails[0].requestedAmount === 20_000_000n
    && built.transferDetails[1].to === FEE_SPLIT.dripbot.agentWallet.evm && built.transferDetails[1].requestedAmount === 95000n
    && built.message.permitted.every(p => p.token === BSC_USDT.address));

  // The digest, recomputed by hand from the type strings with noble
  // keccak — independent of ethers' encoder.
  const K = (b) => keccak_256(b);
  const utf8 = (s) => new TextEncoder().encode(s);
  const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const padAddr = (a) => ethers.getBytes(ethers.zeroPadValue(a, 32));
  const u256 = (n) => ethers.getBytes(ethers.toBeHex(BigInt(n), 32));
  const domainSep = K(cat(K(utf8("EIP712Domain(string name,uint256 chainId,address verifyingContract)")), K(utf8("Permit2")), u256(56), padAddr(PERMIT2_ADDRESS)));
  const itemHash = (p) => K(cat(K(utf8("TokenPermissions(address token,uint256 amount)")), padAddr(p.token), u256(p.amount)));
  const structHash = K(cat(K(utf8(RAMP_PERMIT_BATCH_TYPE_STRING)), K(cat(...built.message.permitted.map(itemHash))), padAddr(testWallet.address), u256(424242n), u256(DL)));
  const manualDigest = "0x" + Buffer.from(K(cat(new Uint8Array([0x19, 0x01]), domainSep, structHash))).toString("hex");
  ok("rampfee: the batch digest matches a hand-computed EIP-712 digest from the type strings",
    manualDigest === built.digest
    && manualDigest === ethers.TypedDataEncoder.hash(built.domain, built.types, built.message));
  const sig = await testWallet.signTypedData(built.domain, built.types, built.message);
  ok("rampfee: a signature over the batch recovers the owner — the construction is signable as built",
    ethers.verifyTypedData(built.domain, built.types, built.message, sig) === testWallet.address);
  const iface = new ethers.Interface(RAMP_PERMIT2_ABI);
  const canonicalSig = "permitTransferFrom(((address,uint256)[],uint256,uint256),(address,uint256)[],address,bytes)";
  ok("rampfee: the batch call's selector is the canonical Permit2 batch selector",
    iface.getFunction("permitTransferFrom").selector === "0x" + Buffer.from(K(utf8(canonicalSig))).toString("hex").slice(0, 8));

  // The independent re-check refuses every tamper that matters.
  const CTX = { chainId: 56, owner: testWallet.address, token: BSC_USDT.address,
    legs: [{ to: PROVIDER, amountRaw: 20_000_000n }, { to: FEE_SPLIT.dripbot.agentWallet.evm, amountRaw: 95000n }] };
  ok("rampfee: the pre-broadcast re-check accepts the untampered batch against the reviewed split",
    checkRampPermitBatch(built, CTX).ok === true);
  const tamper = (fn) => { const c = JSON.parse(JSON.stringify(built, (k, v) => typeof v === "bigint" ? v.toString() + "n" : v),
    (k, v) => typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v); fn(c); return checkRampPermitBatch(c, CTX).ok; };
  ok("rampfee: the re-check refuses a swapped fee recipient, a raised leg, a foreign spender and an extra leg",
    tamper(c => { c.transferDetails[1].to = PROVIDER; }) === false
    && tamper(c => { c.transferDetails[0].requestedAmount = 21_000_000n; }) === false
    && tamper(c => { c.message.spender = PROVIDER; }) === false
    && tamper(c => { c.transferDetails.push({ token: BSC_USDT.address, requestedAmount: 1n, to: PROVIDER }); }) === false);
  ok("rampfee: the builder refuses an expired deadline, a zero leg and a native (non-token) composition",
    buildRampPermitBatch({ chainId: 56, owner: testWallet.address, token: BSC_USDT.address, legs: [{ to: PROVIDER, amountRaw: 1n }], nonce: 1n, deadline: 1000 }).ok === false
    && buildRampPermitBatch({ chainId: 56, owner: testWallet.address, token: BSC_USDT.address, legs: [{ to: PROVIDER, amountRaw: 0n }], nonce: 1n, deadline: DL }).ok === false
    && buildRampPermitBatch({ chainId: 56, owner: testWallet.address, token: null, legs: [{ to: PROVIDER, amountRaw: 1n }], nonce: 1n, deadline: DL }).ok === false);
}

// ---------- ramp fees: Solana native split construction ----------
{
  const from = solanaAddressFromSeed(mnemonicToSeedSync("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"));
  const other = solanaAddressFromSeed(mnemonicToSeedSync("legal winner thank year wave sausage worth useful legal winner thank yellow"));
  const USDC = SOLANA_TOKENS.find(t => t.symbol === "USDC");
  const FEE_TO = FEE_SPLIT.dripbot.agentWallet.solana;
  const BH = "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM";
  const u64At = (data, off) => new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(off, true);

  const full = buildSolanaRampSplitTx({ fromAddress: from, to: other, feeTo: FEE_TO,
    token: { address: USDC.address, decimals: 6 }, providerRaw: 20_000_000n, feeRaw: 95000n,
    blockhash: BH, createsProviderAta: true, createsFeeAta: true });
  const fi = full.instructions;
  ok("rampfee: the Solana split creates both missing token accounts, then transfers provider-then-fee in one transaction",
    fi.length === 4
    && fi[0].programId.toBase58() === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" && fi[0].data[0] === 1
    && fi[1].programId.toBase58() === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    && fi[2].data[0] === 3 && u64At(fi[2].data, 1) === 20_000_000n
    && fi[3].data[0] === 3 && u64At(fi[3].data, 1) === 95000n);
  ok("rampfee: the split's legs land in the provider's and the collection wallet's own token accounts",
    fi[0].keys[1].pubkey.toBase58() === solanaAtaAddress(other, USDC.address)
    && fi[1].keys[1].pubkey.toBase58() === solanaAtaAddress(FEE_TO, USDC.address)
    && fi[2].keys[1].pubkey.toBase58() === solanaAtaAddress(other, USDC.address)
    && fi[3].keys[1].pubkey.toBase58() === solanaAtaAddress(FEE_TO, USDC.address));
  const lean = buildSolanaRampSplitTx({ fromAddress: from, to: other, feeTo: FEE_TO,
    token: { address: USDC.address, decimals: 6 }, providerRaw: 20_000_000n, feeRaw: 95000n, blockhash: BH });
  ok("rampfee: with both token accounts existing the split is exactly two transfers",
    lean.instructions.length === 2);
  const t22 = buildSolanaRampSplitTx({ fromAddress: from, to: other, feeTo: FEE_TO,
    token: { address: USDC.address, decimals: 6, program: SOLANA_TOKEN2022_PROGRAM },
    providerRaw: 20_000_000n, feeRaw: 95000n, blockhash: BH });
  ok("rampfee: Token-2022 splits use TransferChecked against the 2022 program and its own ATAs",
    t22.instructions.length === 2
    && t22.instructions[0].programId.toBase58() === SOLANA_TOKEN2022_PROGRAM
    && t22.instructions[0].data[0] === 12 && t22.instructions[0].data[9] === 6
    && t22.instructions[1].keys[2].pubkey.toBase58() === solanaAtaAddress(FEE_TO, USDC.address, SOLANA_TOKEN2022_PROGRAM));
  const native = buildSolanaRampSplitTx({ fromAddress: from, to: other, feeTo: FEE_TO,
    token: null, providerRaw: 2_000_000_000n, feeRaw: 4_750_000n, blockhash: BH });
  ok("rampfee: native SOL splits as two system transfers in one transaction",
    native.instructions.length === 2
    && native.instructions.every(ix => ix.programId.toBase58() === "11111111111111111111111111111111")
    && u64At(native.instructions[0].data, 4) === 2_000_000_000n
    && u64At(native.instructions[1].data, 4) === 4_750_000n
    && native.instructions[1].keys[1].pubkey.toBase58() === FEE_TO);
  let threw = false;
  try {
    buildSolanaRampSplitTx({ fromAddress: from, to: other, feeTo: FEE_TO, token: null, providerRaw: 1n, feeRaw: 0n, blockhash: BH });
  } catch { threw = true; }
  ok("rampfee: the Solana builder refuses a zero fee leg rather than building a bare send in disguise", threw);
}

// ---------- ramp fees: order records & the refund path ----------
{
  const BSC_USDT = NETWORKS.bsc.tokens.find(t => t.symbol === "USDT");
  const mk = (tier) => newRampFeeOrder({ id: "ramp-test-" + tier, tier, family: "evm", chainKey: "bsc",
    token: { symbol: "USDT", address: BSC_USDT.address, decimals: 6 },
    providerTo: "0x1111111111111111111111111111111111111111", providerRaw: 20000000n, feeRaw: 95000n,
    feeTo: FEE_SPLIT.dripbot.agentWallet.evm, userAddress: "0x2222222222222222222222222222222222222222",
    fiatText: "₦27,400", providerName: "Paycrest" });

  const t2 = mk(2);
  ok("rampfee: a tier-2 order starts created, keeps its fiat quote and provider, and its summary states the fee",
    t2.status === "created" && t2.fiatText === "₦27,400" && t2.providerName === "Paycrest"
    && rampFeeOrderSummary(t2).includes("Cash-out") && rampFeeOrderSummary(t2).includes("0.095 USDT"));
  const s1 = rampFeeOrderTransition(t2, "leg1-sent", { txid: "0xabc" });
  const s2 = rampFeeOrderTransition(s1, "provider-confirmed");
  const s3 = rampFeeOrderTransition(s2, "fee-sent", { txid: "0xdef" });
  const s4 = rampFeeOrderTransition(s3, "complete");
  ok("rampfee: the tier-2 lifecycle walks deposit → confirmed → fee → complete, immutably, txids recorded",
    s4.status === "complete" && t2.status === "created"
    && s4.txids.some(t => t.step === "leg1-sent" && t.txid === "0xabc")
    && s4.txids.some(t => t.step === "fee-sent" && t.txid === "0xdef"));
  let illegal = false;
  try { rampFeeOrderTransition(t2, "complete"); } catch { illegal = true; }
  ok("rampfee: an illegal jump (created → complete) is refused", illegal);
  const refundedEarly = rampFeeOrderTransition(s1, "provider-refunded");
  ok("rampfee: a sale refunded before the fee moved owes nothing back",
    refundedEarly.status === "refunded" && rampFeeRefundInstruction(refundedEarly) === null);
  const refundedLate = rampFeeOrderTransition(s3, "provider-refunded");
  const instr = rampFeeRefundInstruction(refundedLate);
  ok("rampfee: a sale refunded after the fee settled lands on fee-return-due with an executable return instruction",
    refundedLate.status === "fee-return-due" && instr !== null && instr.amountRaw === "95000"
    && instr.to === "0x2222222222222222222222222222222222222222" && instr.from === FEE_SPLIT.dripbot.agentWallet.evm);
  const t1 = rampFeeOrderTransition(mk(1), "settled", { txid: "0x999" });
  const t1Refunded = rampFeeOrderTransition(t1, "provider-refunded");
  ok("rampfee: a settled tier-1 sale that later refunds also lands on fee-return-due",
    t1Refunded.status === "fee-return-due" && rampFeeRefundInstruction(t1Refunded) !== null);
  let badOrder = false;
  try {
    newRampFeeOrder({ id: "x", tier: 1, family: "evm", token: { symbol: "USDT", decimals: 6 },
      providerTo: "0x1111111111111111111111111111111111111111", providerRaw: 1n, feeRaw: 1n,
      userAddress: "0x2222222222222222222222222222222222222222" });
  } catch { badOrder = true; }
  ok("rampfee: an order without a fee destination is refused at creation", badOrder);
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  saveRampFeeOrder(store, s4);
  saveRampFeeOrder(store, t1);
  const loaded = loadRampFeeOrders(store);
  ok("rampfee: orders persist and reload with amounts intact",
    loaded.length === 2 && loaded.find(r => r.id === "ramp-test-2").feeRaw === "95000"
    && loaded.find(r => r.id === "ramp-test-1").status === "settled");
}

// ---------- audit fix batch 2 (2026-11-10): P2-1 dust display /
// P2-4 sheet focus + no-autocorrect identifier fields ----------
{
  const appSrcB2 = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrcB2 = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");

  // P2-1 behaviour: the core display formatters.
  ok("P2-1: a dust fee renders as <smallest unit, never as zero",
    dustDisplayFloor(0.0000004, 6) === "<0.000001"
    && formatDisplayFixed(0.0000004) === "<0.000001"
    && formatDisplayFixed("0.00000049", 6) === "<0.000001"
    && formatDisplayAmount(0.0000004) === "<0.000001"
    && formatDisplayAmount(0.0000000004, 8) === "<0.00000001");
  ok("P2-1: a true zero still renders as plain zero",
    dustDisplayFloor(0, 6) === null
    && formatDisplayFixed(0) === "0.000000"
    && formatDisplayAmount(0) === "0"
    && formatDisplayUsd(0) === "$0.00");
  ok("P2-1: normal amounts are byte-for-byte unchanged",
    formatDisplayFixed(0.000105) === "0.000105"
    && formatDisplayFixed(1.5) === "1.500000"
    && formatDisplayAmount(2.5) === "2.5"
    && formatDisplayAmount(0.000001) === "0.000001"
    && formatDisplayAmount(0.1234567) === "0.123457"
    && formatDisplayUsd(12.3) === "$12.30"
    && formatDisplayUsd(0.01) === "$0.01");
  ok("P2-1: dust fiat renders as <$0.01, never $0.00",
    formatDisplayUsd(0.004) === "<$0.01" && formatDisplayUsd(0.0000001) === "<$0.01");
  ok("P2-1: the smallest visible unit itself is not dust",
    dustDisplayFloor(0.000001, 6) === null && dustDisplayFloor(0.01, 2) === null
    && formatDisplayFixed(0.000001) === "0.000001");

  // P2-1 wiring: the app shell's formatters delegate to core, and the
  // fixed-precision fee display sites route through fmtFixed.
  ok("P2-1: app fmt/usd delegate to the core dust-aware formatters",
    appSrcB2.includes("const usd = (n) => formatDisplayUsd(n);")
    && appSrcB2.includes("const fmt = (n, d = 6) => formatDisplayAmount(n, d);")
    && appSrcB2.includes("const fmtFixed = (n, d = 6) => formatDisplayFixed(n, d);"));
  ok("P2-1: send review + receipt fees render through fmtFixed",
    appSrcB2.includes("feeNative: fmtFixed(fee)")
    && appSrcB2.includes("`≈ ${fmtFixed(done.feeNative)} ${NETWORKS[networkKey].symbol}`")
    && !appSrcB2.includes("feeNative: Number(fee).toFixed(6)")
    && !appSrcB2.includes("done.feeNative.toFixed(6)"));
  ok("P2-1: cash-out network fee and Cosmos fee render through fmtFixed",
    appSrcB2.includes("fmtFixed(2 * Number(est.bareGasNativeText))")
    && appSrcB2.includes("fmtFixed(Number(est.gasNativeText))")
    && appSrcB2.includes("feeText: `${fmtFixed(est.feeText)} ${est.feeSymbol}`")
    && appSrcB2.includes("feeAmount: fmtFixed(est.feeText)"));

  // P2-4: focus placement on sheet open.
  ok("P2-4: openSheet focuses the sheet's marked primary field on a fresh open only",
    appSrcB2.includes("function focusSheetPrimary()")
    && appSrcB2.includes('body.querySelector("[data-autofocus]")')
    && appSrcB2.includes("if (!wasOpen) focusSheetPrimary();"));
  const tagOf = (src, id) => { const m = src.match(new RegExp(`<(?:input|textarea)\\b[^>]*?id="${id}"[^>]*?>`)); return m ? m[0] : ""; };
  const focusIds = ["sTo", "bTo", "tTo", "oTo", "uTo", "stTo", "tnTo", "nrTo", "agTo", "xrTo", "dtTo", "apTo", "sxTo", "lTo", "cTo", "gTo", "kTo", "ctAddr", "ncNewName", "lnTarget", "lnInv", "wcUri", "wAmt"];
  ok("P2-4: every form sheet's primary field carries data-autofocus",
    focusIds.every(id => tagOf(appSrcB2, id).includes("data-autofocus")));

  // P2-4: no keyboard correction on address/identifier fields.
  const identApp = [...focusIds.filter(id => id !== "wAmt"), "xrTag", "bridgeBtcAddr", "bridgeExitAllAddr", "wDestAddr", "wFromSearch", "wToSearch", "lnPeerKey", "lnPeerHost", "lnProxy", "lnRelay", "lnFundHex", "lnSisPaths"];
  const identIdx = ["createName", "scanInput", "ownedLnInput", "nameInput", "lnInput", "agentNameInput", "importPhrase"];
  const noCorrect = (tag) => tag.includes('spellcheck="false"') && tag.includes('autocomplete="off"') && tag.includes('autocorrect="off"') && tag.includes('autocapitalize="none"');
  ok("P2-4: every address/identifier field in app sheets refuses autocorrect",
    identApp.every(id => noCorrect(tagOf(appSrcB2, id))));
  ok("P2-4: every address/identifier field in the static shell refuses autocorrect",
    identIdx.every(id => noCorrect(tagOf(idxSrcB2, id))));
  ok("P2-4: prose fields keep their keyboard behaviour (invoice description untouched)",
    !tagOf(appSrcB2, "lnRcvDesc").includes("spellcheck"));
}

// ---------- Audit fix batch 3 (2026-11-10): P1-1, P1-2, P1-4, P1-9 ----------
// Source of truth for each finding: the total audit
// (fluid-total-audit-20261109/report.md §3) + the pass-1 origins.
{
  const core = await import("../src/wallet-core.js");
  const { buildSeedQuiz, seedQuizResults, seedQuizPassed, SEED_QUIZ_COUNT,
    resolveChainRecipient, lookupFluidNameStatus, isValidSolanaAddress, isValidBitcoinAddress,
    parseServedBuildStamp, buildFreshness, staleBuildAction, fetchServedBuildStamp } = core;
  const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const idxSrc = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const throwsMsg = async (fn, want) => { try { await fn(); return false; } catch (e) { return e.message === want; } };
  const EVM_ADDR = "0x0EBf5563F905E3B9D58718E28E08143511DC763b";

  // ---- P1-1: the seed backup quiz ----
  const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const PHRASE12 = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  const words12 = PHRASE12.split(" ");
  {
    const quiz = buildSeedQuiz(PHRASE12, lcg(42));
    ok("P1-1: the quiz challenges exactly SEED_QUIZ_COUNT positions", quiz.challenges.length === SEED_QUIZ_COUNT && SEED_QUIZ_COUNT === 3);
    ok("P1-1: challenged positions are distinct and inside the phrase",
      new Set(quiz.challenges.map(c => c.position)).size === 3
      && quiz.challenges.every(c => c.position >= 1 && c.position <= 12));
    ok("P1-1: each challenge's answer is the word at its position",
      quiz.challenges.every(c => c.answer === words12[c.position - 1]));
    ok("P1-1: each challenge offers 4 options with the answer exactly once",
      quiz.challenges.every(c => c.options.length === 4 && c.options.filter(w => w === c.answer).length === 1));
    ok("P1-1: decoys come from the phrase's other words, never the answer",
      quiz.challenges.every(c => c.options.every(w => words12.includes(w)) && new Set(c.options).size === c.options.length));
    ok("P1-1: all-correct picks pass", seedQuizPassed(quiz, quiz.challenges.map(c => c.answer)) === true);
    ok("P1-1: one wrong pick fails, and results name exactly that row",
      (() => { const picks = quiz.challenges.map(c => c.answer); picks[1] = quiz.challenges[1].options.find(w => w !== quiz.challenges[1].answer);
        return seedQuizPassed(quiz, picks) === false
          && JSON.stringify(seedQuizResults(quiz, picks)) === JSON.stringify([true, false, true]); })());
    ok("P1-1: unanswered picks never pass", seedQuizPassed(quiz, [quiz.challenges[0].answer, null, null]) === false);
    ok("P1-1: a too-short phrase yields an empty quiz that never passes",
      buildSeedQuiz("only three words", lcg(1)).challenges.length === 0 && seedQuizPassed(buildSeedQuiz("only three words", lcg(1)), []) === false);
    let propOk = true;
    for (let seed = 1; seed <= 60 && propOk; seed++) {
      const q = buildSeedQuiz(PHRASE12, lcg(seed));
      propOk = q.challenges.length === 3
        && new Set(q.challenges.map(c => c.position)).size === 3
        && q.challenges.every(c => c.answer === words12[c.position - 1] && c.options.includes(c.answer));
    }
    ok("P1-1: 60 seeded quizzes all challenge distinct positions with true answers", propOk);
  }
  ok("P1-1: the create flow paints the phrase as a numbered grid, not one line",
    appSrc.includes("$(\"seedOut\").innerHTML = seedGridHtml(v.phrase);") && !appSrc.includes("$(\"seedOut\").textContent = v.phrase"));
  ok("P1-1: creation persists the backup state as pending at the create click",
    appSrc.includes('localStorage.setItem(BACKUP_STATE_KEY, "pending")'));
  ok("P1-1: the seed button mounts the quiz; pass and later both enter the wallet (never bricked)",
    appSrc.includes("mountSeedQuiz($(\"seedQuizBox\"), v.phrase, {")
    && appSrc.includes("onPass: () => finishCreate(true)")
    && appSrc.includes("onLater: () => finishCreate(false)")
    && appSrc.includes('localStorage.setItem(BACKUP_STATE_KEY, "confirmed")'));
  ok("P1-1: the quiz offers the words-again path back to the phrase view",
    appSrc.includes('onWords: () => { show("seedQuizBox", false); show("seedWordsView", true); }'));
  ok("P1-1: the home reminder card exists in the shell with check + dismiss actions",
    idxSrc.includes('id="homeBackupCard"') && idxSrc.includes('id="homeBackupBtn"') && idxSrc.includes('id="homeBackupDismiss"'));
  ok("P1-1: the reminder paints only for a pending backup and dismisses per session",
    appSrc.includes("function refreshHomeBackupCard()")
    && appSrc.includes('localStorage.getItem(BACKUP_STATE_KEY) === "pending"')
    && appSrc.includes('sessionStorage.getItem(BACKUP_DISMISS_KEY) !== "1"')
    && appSrc.includes('sessionStorage.setItem(BACKUP_DISMISS_KEY, "1")'));
  ok("P1-1: import clears the replaced wallet's backup state (import behaviour itself unchanged)",
    appSrc.includes("localStorage.removeItem(BACKUP_STATE_KEY);"));

  // ---- P1-2: address/name error states are never conflated ----
  const evmOpts = (lookupName) => ({ isValidAddress: (a) => /^0x[0-9a-fA-F]{40}$/.test(a), field: "evm", chainLabel: "BNB Chain", lookupName });
  {
    let lookups = 0;
    const spy = async () => { lookups++; return null; };
    // Pre-fix reproduction: "0x123" in the EVM sheet (and a bad
    // string in the Solana sheet) returned "That Fluid name is not
    // in the registry yet." — a malformed address misdiagnosed as
    // an unregistered name, with a registry claim never proven.
    ok("P1-2: a malformed EVM address is reported as a malformed address, registry never consulted",
      await throwsMsg(() => resolveChainRecipient("0x123", evmOpts(spy)),
        "That doesn't look like a valid BNB Chain address, and it isn't a Fluid name either — check it and try again.") && lookups === 0);
    ok("P1-2: a malformed Solana string is reported as a malformed address, registry never consulted",
      await throwsMsg(() => resolveChainRecipient("not an address!!", { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana", lookupName: spy }),
        "That doesn't look like a valid Solana address, and it isn't a Fluid name either — check it and try again.") && lookups === 0);
    const raw = await resolveChainRecipient(EVM_ADDR, evmOpts(spy));
    ok("P1-2: a well-formed address is accepted as a raw external address, no lookup",
      raw.to === EVM_ADDR && raw.name === null && lookups === 0);
    const legacy = await resolveChainRecipient("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      { isValidAddress: isValidBitcoinAddress, field: "btc", chainLabel: "Bitcoin", lookupName: spy });
    ok("P1-2: a legacy Bitcoin address is an address (the old bc1-prefix test sent it down the name path)",
      legacy.to === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" && legacy.name === null && lookups === 0);
    const reg = async (n) => n === "kemi" ? { name: "kemi", evm: EVM_ADDR } : null;
    const named = await resolveChainRecipient("kemi", evmOpts(reg));
    ok("P1-2: a registered name resolves and shows its destination", named.to === EVM_ADDR && named.name === "kemi");
    ok("P1-2: a registered name with no address for the chain says exactly that",
      await throwsMsg(() => resolveChainRecipient("kemi", { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana", lookupName: reg }),
        "That Fluid name has no Solana address in the registry."));
    ok("P1-2: an unregistered name (registry read, name absent) says check the spelling",
      await throwsMsg(() => resolveChainRecipient("ghost", evmOpts(reg)),
        "No Fluid user with that name — check the spelling."));
  }
  {
    // The default (non-injected) path: existence claims require a
    // registry read that actually happened.
    const realFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error("network down"); };
      ok("P1-2: registry unreachable claims NOTHING about existence — a try-again state instead",
        await throwsMsg(() => resolveChainRecipient("kemi", evmOpts(undefined)),
          "Couldn't check the Fluid name registry just now — check your connection and try again."));
      globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
      ok("P1-2: registry read with the name absent → unregistered-name state",
        await throwsMsg(() => resolveChainRecipient("kemi", evmOpts(undefined)),
          "No Fluid user with that name — check the spelling."));
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ kemi: { evm: EVM_ADDR } }) });
      const hit = await resolveChainRecipient("kemi", evmOpts(undefined));
      ok("P1-2: registry read with the name present → resolved destination", hit.to === EVM_ADDR && hit.name === "kemi");
    } finally { globalThis.fetch = realFetch; }
  }
  {
    const realFetch = globalThis.fetch;
    try {
      let fetches = 0;
      globalThis.fetch = async () => { fetches++; return { ok: true, json: async () => ({ kemi: { evm: EVM_ADDR } }) }; };
      const st = await lookupFluidNameStatus("kemi", "https://example.invalid/reg.json");
      ok("P1-2: lookupFluidNameStatus reports found with the sanitized entry", st.status === "found" && st.entry.evm === EVM_ADDR && st.entry.name === "kemi");
      const nf = await lookupFluidNameStatus("0x123", "https://example.invalid/reg.json");
      ok("P1-2: lookupFluidNameStatus refuses a non-name without fetching", nf.status === "not-a-name" && fetches === 1);
      globalThis.fetch = async () => { throw new Error("down"); };
      const un = await lookupFluidNameStatus("kemi", "https://example.invalid/reg.json");
      ok("P1-2: lookupFluidNameStatus distinguishes unreachable from absent", un.status === "unreachable");
    } finally { globalThis.fetch = realFetch; }
  }
  ok("P1-2: the EVM sheet resolves through the shared path (its private conflated copy is gone)",
    appSrc.includes('resolveChainRecipient(to, { isValidAddress: (a) => /^0x[0-9a-fA-F]{40}$/.test(a), field: "evm", chainLabel: NETWORKS[networkKey].name })')
    && !appSrc.includes("That Fluid name is not in the registry yet."));
  ok("P1-2: the Bitcoin sheet resolves through the shared path (no bc1-prefix name gate)",
    appSrc.includes('resolveChainRecipient(to, { isValidAddress: isValidBitcoinAddress, field: "btc", chainLabel: "Bitcoin" })')
    && !appSrc.includes('!to.startsWith("bc1")'));

  // ---- P1-4: the swap form leads, the lecture follows ----
  ok("P1-4: no native network selects remain in the swap sheet",
    !appSrc.includes('<select id="wFromNet"') && !appSrc.includes('<select id="wToNet"')
    && !appSrc.includes('$("wFromNet")') && !appSrc.includes('$("wToNet")'));
  ok("P1-4: the network pickers are search panels in the token-picker pattern",
    appSrc.includes('id="wFromNetBtn"') && appSrc.includes('id="wToNetBtn"')
    && appSrc.includes('id="wFromNetSearch"') && appSrc.includes('id="wToNetSearch"')
    && appSrc.includes("function renderNetList(side)") && appSrc.includes("async function chooseNet(side, key)")
    && appSrc.includes('placeholder="Search networks…"'));
  ok("P1-4: the sheet reads network state from netSel, the single source of truth",
    appSrc.includes("const netSel = { from: fromKey0, to: toKey0 };")
    && appSrc.includes("const fromKey = netSel.from, toKey = netSel.to;"));
  ok("P1-4: the From row is the first interactive element — the explainer sits below the form",
    appSrc.indexOf('id="wFromNetBtn"') > -1
    && appSrc.indexOf('id="wFromNetBtn"') < appSrc.indexOf('id="wAmt"')
    && appSrc.indexOf('id="wAmt"') < appSrc.indexOf('id="wHow"')
    && appSrc.indexOf("One search across every Fluid chain") > appSrc.indexOf('id="wHow"'));
  ok("P1-4: the explainer + fee-law + caps copy survives verbatim, inside a collapsed details below the form",
    appSrc.includes('<details id="wHow"')
    && appSrc.includes("How swaps work")
    && appSrc.includes("Fluid's fee is a small multiple of the route's cost, never more than 0.5%")
    && appSrc.includes("Total cost caps: $0.20 EVM · $1.50 Bitcoin · $0.30 Lightning · $0.30 Solana.")
    && appSrc.indexOf('id="wHow"') < appSrc.indexOf('id="wConfirm"'));

  // ---- P1-9: the build-freshness handshake ----
  ok("P1-9: the served stamp parses from the fluid-build meta in either attribute order",
    parseServedBuildStamp('<head><meta name="fluid-build" content="abc123"></head>') === "abc123"
    && parseServedBuildStamp('<head><meta content="def456" name="fluid-build"></head>') === "def456"
    && parseServedBuildStamp("<head><title>x</title></head>") === null);
  ok("P1-9: freshness verdicts — same, moved, and unknown (an unreadable page proves nothing)",
    buildFreshness("a", "a") === "same" && buildFreshness("a", "b") === "moved"
    && buildFreshness(null, "b") === "unknown" && buildFreshness("a", null) === "unknown");
  ok("P1-9: stamp moved + failed load → refresh state",
    staleBuildAction({ loadFailed: true, bootStamp: "a", servedStamp: "b" }) === "refresh");
  ok("P1-9: stamp same + failed load → the existing honest error stands",
    staleBuildAction({ loadFailed: true, bootStamp: "a", servedStamp: "a" }) === "keep");
  ok("P1-9: stamp unknown + failed load → the existing honest error stands",
    staleBuildAction({ loadFailed: true, bootStamp: "a", servedStamp: null }) === "keep");
  ok("P1-9: stamp moved + healthy load → no interruption",
    staleBuildAction({ loadFailed: false, bootStamp: "a", servedStamp: "b" }) === "none");
  {
    let seenUrl = "";
    const stamp = await fetchServedBuildStamp(async (url) => { seenUrl = url; return { ok: true, text: async () => '<meta name="fluid-build" content="zz9"> ' }; }, "https://fluidwallet.dpdns.org/");
    ok("P1-9: the served-stamp re-read is cache-busted and returns the stamp",
      stamp === "zz9" && seenUrl.includes("fluid-freshness="));
    ok("P1-9: a failed or non-ok re-read returns null (unknown), never a false 'moved'",
      (await fetchServedBuildStamp(async () => { throw new Error("down"); }, "https://x/")) === null
      && (await fetchServedBuildStamp(async () => ({ ok: false, text: async () => "" }), "https://x/")) === null);
  }
  ok("P1-9: the app records its boot stamp and arms the handshake on the send sheet's load states",
    appSrc.includes("const BOOT_BUILD_STAMP")
    && appSrc.includes('id="sLoadNote"')
    && appSrc.includes("staleBuildCheck(note, true)")
    && appSrc.includes("STALE_BUILD_DEADLINE_MS = 20000"));
  ok("P1-9: the refresh state is an honest update message with a clean reload action",
    appSrc.includes("Fluid has updated since you opened it")
    && appSrc.includes("btn.onclick = () => location.reload();"));
}

console.log(`\n${passed} checks passed`);
