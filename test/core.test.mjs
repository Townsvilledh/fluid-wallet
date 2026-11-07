// Fluid core tests — run: npm test
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createVault, importVault, unlockVault, fonbnkOfframpUrl, fonbnkOnrampUrl, mtpelerinBuyUrl, mtpelerinSellUrl, MTPELERIN_FIATS, MTPELERIN_REFERRAL_CODE, formatSendIntent, NETWORKS, bitcoinAddress, rampRoutesFor, RAMP_COUNTRY_PLAN, RAMP_STATIC_LINKS, RAMP_COUNTRIES, RAMP_ADDRESS_ENTRY, validateFluidName, normalizeFluidName, buildNameEntry, findNameForAddresses, splitFee, FEE_SPLIT, PLATFORM_FEE_BPS, PLATFORM_FEE_FRACTION, PLATFORM_FEE_COLLECTION_ENABLED, platformFeeOn, platformFeeApplies, platformFeePercentText, feeLegTargets, feePotReport, LIFI_INTEGRATOR, buildLifiRoutesRequest, buildLifiQuoteParams, swapFeeCollectingChain, BITCOIN_LIFI_CHAIN_ID, SWAP_FEE_COVERAGE, rankRoutes, GAME_FEE_SPLIT, splitGameFee, AGENT_POLICY_DEFAULTS, agentAddresses, buildAgentDescriptor, checkAgentPolicy, FEE_SETTLEMENT, feeSettlementDue, rankSwapRoutes, formatSwapIntent, swapRouteExecutable, swapAmountToRaw, swapRawToAmount, LIFI_NATIVE_TOKEN, looksLikePoison, gateChains, registerNetworks, providerFor, tronAddressFromKey, tronAddressFromPhrase, tronAddressToHex, tronAddressFromHex, isValidTronAddress, tronSunToTrx, tronTrxToSun, formatTronSendIntent, TRON_TOKENS, TRON_LIFI_CHAIN_ID, TRON_SWAP_NATIVE_TOKEN, swapChainOf, deriveSlip10Ed25519, solanaSeedFromSeed, solanaAddressFromSeed, solanaAddressFromPhrase, isValidSolanaAddress, solLamportsToSol, solSolToLamports, solanaAtaAddress, formatSolanaSendIntent, SOLANA_TOKENS, SOLANA_LIFI_CHAIN_ID, SOLANA_SWAP_NATIVE_TOKEN, SOLANA_RENT_EXEMPT_LAMPORTS, SOLANA_ATA_RENT_LAMPORTS, solanaSwapSteps, litecoinAddress, isValidLitecoinAddress, formatLitecoinSendIntent, dogecoinAddress, isValidDogeAddress, DOGE_MIN_OUTPUT, buildSignedDogeTx, formatDogeSendIntent, DOGE_DUST_KOINU, dogeTxSize, bitcoinCashAddress, bitcoinCashLegacyAddress, bchAddressToScript, bchSighashDigest, buildSignedBchTx, isValidBchAddress, RECEIVE_NETWORKS, receiveNetworkMatches, filterReceiveNetworks, escapeHtml, sanitizePersistedSymbol, historyTxUrl, formatHistoryEntry, formatApprovalRow, formatRevokePrompt, stacksAddressFromPhrase, stacksAddressDecode, stacksAddressEncode, isValidStacksAddress, isValidStacksContractAddress, stxMicroToStx, stxToMicro, stacksAmountToRaw, stacksRawToAmount, buildSignedStacksTx, formatStacksSendIntent, parseStacksCallReadValue, stacksExplorerTxUrl, STACKS_TOKENS, STACKS_MAX_FEE_USTX, STACKS_MAX_FEE_RATE_USTX_PER_BYTE } from "../src/wallet-core.js";
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
import { tonAddressFromPhrase, tonAddressFromSeed, tonSeedFromSeed, isValidTonAddress, tonNanoToTon, tonTonToNano, formatTonSendIntent, tonJettonTransferBody, TON_USDT_MASTER,
  nearAddressFromPhrase, nearAddressFromSeed, nearSeedFromSeed, isValidNearAddress, nearYoctoToNear, nearNearToYocto, nearMinExistYocto, nearTransactionBytes, nearSignedTransactionBytes, nearActionTransfer, nearActionFunctionCall, formatNearSendIntent, NEAR_TOKENS,
  algoAddressFromPhrase, algoAddressFromSeed, algoSeedFromSeed, algoAddressFromPubkey, algoAddressDecode, isValidAlgorandAddress, algoMicroToAlgo, algoAlgoToMicro, formatAlgoSendIntent, ALGO_USDC, ALGO_USDC_ASA,
  xrplAddressFromPhrase, xrplAddressFromPubkey, xrplAddressDecode, isValidXrplAddress, xrplDropsToXrp, xrplXrpToDrops, xrplCurrencyLabel, xrplSignPayment, formatXrplSendIntent, XRPL_USDC, XRPL_USDC_ISSUER,
  dotAddressFromPhrase, isValidDotAddress, dotPlanckToDot, dotDotToPlanck, formatDotSendIntent, DOT_TOKENS } from "../src/wallet-core.js";
import { aptosAddressFromPhrase, aptosAddressFromSeed, aptosSeedFromSeed, isValidAptosAddress, normalizeAptosAddress, aptosOctasToApt, aptosAptToOctas, aptosAmountToRaw, aptosBuildRawTransaction, aptosSigningMessage, aptosSignRawTransaction, aptosPublicKeyFromPhrase, formatAptosSendIntent, APTOS_TOKENS, APTOS_COIN_TYPE } from "../src/wallet-core.js";
import { toChecksumAddress } from "../src/wallet-core.js";
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

// 7. Cash-out URL: NG bank channel, null on testnet
const url = fonbnkOfframpUrl("base");
ok("fonbnk url built for Base", url.includes("pay.fonbnk.com/offramp") && url.includes("network=BASE") && url.includes("countryIsoCode=NG"));
ok("no cash-out on testnet", fonbnkOfframpUrl("sepolia") === null);

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
ok("static ramp links are https", Object.values(RAMP_STATIC_LINKS).every(l => l.buy.startsWith("https://") && l.sell.startsWith("https://")));
ok("static links are the kept providers", ["Paybis", "Mercuryo", "NoOnes", "Spritz"].every(n => RAMP_STATIC_LINKS[n])
  && !RAMP_STATIC_LINKS["Noblocks"] && RAMP_STATIC_LINKS["NoOnes"].buy === "https://noones.app");
ok("removed providers stay removed", (() => {
  // Sweep every country × mode: no removed provider may appear by name
  // or URL — incl. the +106%-in-Nigeria provider dropped in this build.
  const banned = /guardarian|moonpay|transak|ramp\.network|paychant|noblocks/i;
  return RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const { routes } = rampRoutesFor(c.code, m, "bsc", "USDC");
    return routes.every(r => !banned.test(r.name) && !banned.test(r.url));
  }));
})());
// Fonbnk buy = widget ROOT (the old /onramp path is a dead route in the app)
ok("fonbnk onramp builds at root", (fonbnkOnrampUrl("bsc") || "").startsWith("https://pay.fonbnk.com/?")
  && (fonbnkOnrampUrl("bsc") || "").includes("countryIsoCode=NG") && !(fonbnkOnrampUrl("bsc") || "").includes("/onramp"));
ok("fonbnk onramp null without mapping", fonbnkOnrampUrl("linea") === null);
// Fonbnk links never carry merchant-gated params
ok("fonbnk links carry no gated params", ["bsc", "base"].every(k => !/[?&](source|signature|address|freezeWallet)=/.test(fonbnkOnrampUrl(k) + "&" + (fonbnkOfframpUrl(k) || ""))));

// 16. Local-currency rails: country-aware Fonbnk links + country table
ok("fonbnk KE onramp", (fonbnkOnrampUrl("bsc", "USDC", "KE") || "").includes("countryIsoCode=KE"));
ok("fonbnk GH offramp USDT", (fonbnkOfframpUrl("base", "USDT", "GH") || "").includes("asset=USDT"));
ok("ramp countries include NG+US", RAMP_COUNTRIES.some(c => c.code === "NG" && c.fonbnk) && RAMP_COUNTRIES.some(c => c.code === "US"));
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

// 16c. Per-country ramp assembly: ranked on MEASURED price (6 Nov 2026)
{
  const names = (code, mode = "buy") => rampRoutesFor(code, mode, "bsc", "USDC").routes.map(r => r.name);
  const badged = (code, mode = "buy") => rampRoutesFor(code, mode, "bsc", "USDC").routes.filter(r => r.badge).map(r => r.name);

  // Nigeria (7 Nov 2026, owner's corrected criterion): the buy
  // disqualifier is WalletConnect-only address entry, NOT BVN/KYC.
  // Fonbnk buy is OUT everywhere (its wallet step is WalletConnect;
  // there is no paste path); Fonbnk sell stays (no wallet
  // connection). Noblocks is gone (BVN wall + a verify step that
  // failed live). NoOnes is the NG BUY lead: an external P2P
  // marketplace link-out, email-only starter sign-up, paste-address
  // send-out — honestly labelled and UNBADGED (its ≈3–4% premium is
  // not the cheapest measured; it leads on the address rule).
  ok("NG lineup is NoOnes buy / Fonbnk sell", JSON.stringify(names("NG")) === JSON.stringify(["NoOnes"])
    && JSON.stringify(names("NG", "sell")) === JSON.stringify(["Fonbnk"]));
  ok("NG has no badges", badged("NG").length === 0 && badged("NG", "sell").length === 0);
  ok("NG has no Paybis or Mercuryo", !names("NG").includes("Paybis") && !names("NG").includes("Mercuryo")
    && !names("NG", "sell").includes("Paybis") && !names("NG", "sell").includes("Mercuryo"));
  ok("NG buy flags the Fonbnk buy block", rampRoutesFor("NG", "buy", "bsc", "USDC").fonbnkBuyBlocked === true
    && rampRoutesFor("NG", "sell", "bsc", "USDC").fonbnkBuyBlocked === false);
  const ngBuy = rampRoutesFor("NG", "buy", "bsc", "USDC").routes;
  ok("NG NoOnes is the unbadged external lead", ngBuy.length === 1 && ngBuy[0].rank === 0
    && ngBuy[0].url === "https://noones.app" && ngBuy[0].badge === false && ngBuy[0].external === true);
  ok("NG NoOnes note is honest about what it is", ngBuy[0].note.includes("External marketplace")
    && ngBuy[0].note.includes("no ID documents") && ngBuy[0].note.includes("no WalletConnect")
    && ngBuy[0].note.includes("3–4% over the market rate"));
  const ngSell = rampRoutesFor("NG", "sell", "bsc", "USDC").routes;
  ok("NG Fonbnk sell note is address-based, no ID", ngSell[0].note.includes("no ID check") && ngSell[0].url.startsWith("https://pay.fonbnk.com/"));

  // The address-entry capability table is the standing buy gate:
  // Fonbnk is the WalletConnect-only route; every listed buy route
  // anywhere takes a pasted address. A future provider added to a
  // plan without a caps entry — or flipped to "walletconnect" —
  // fails here instead of silently reaching a buy sheet.
  ok("address-entry caps are recorded truthfully", RAMP_ADDRESS_ENTRY["Fonbnk"] === "walletconnect"
    && ["Mt Pelerin", "Paybis", "Mercuryo", "NoOnes", "Spritz"].every(n => RAMP_ADDRESS_ENTRY[n] === "paste"));
  ok("every planned provider has a caps entry", RAMP_COUNTRIES.every(c =>
    RAMP_COUNTRY_PLAN[c.code].every(([n]) => typeof RAMP_ADDRESS_ENTRY[n] === "string")));
  ok("no WalletConnect-only route on any buy sheet", RAMP_COUNTRIES.every(c =>
    rampRoutesFor(c.code, "buy", "bsc", "USDC").routes.every(r => RAMP_ADDRESS_ENTRY[r.name] === "paste")));
  ok("Fonbnk is on no buy sheet but keeps its sell sheets", RAMP_COUNTRIES.every(c =>
    !rampRoutesFor(c.code, "buy", "bsc", "USDC").routes.some(r => r.name === "Fonbnk"))
    && ["NG", "KE", "GH", "ZA", "UG", "TZ", "CM", "SN", "CI", "ZM"].every(code =>
      rampRoutesFor(code, "sell", "bsc", "USDC").routes.some(r => r.name === "Fonbnk")));
  ok("NoOnes appears only as the NG buy lead", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const has = rampRoutesFor(c.code, m, "bsc", "USDC").routes.some(r => r.name === "NoOnes");
    return has === (c.code === "NG" && m === "buy");
  })));
  ok("Spritz appears only in the US lineup", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const has = rampRoutesFor(c.code, m, "bsc", "USDC").routes.some(r => r.name === "Spritz");
    return has === (c.code === "US");
  })));

  // Kenya: Fonbnk sell-only since 7 Nov; Mercuryo is the buy fallback.
  ok("KE lineup", JSON.stringify(names("KE")) === JSON.stringify(["Mercuryo"])
    && JSON.stringify(names("KE", "sell")) === JSON.stringify(["Fonbnk", "Mercuryo"])
    && badged("KE").length === 0 && badged("KE", "sell").length === 0);

  // South Africa: Mt Pelerin outranks Fonbnk on price and takes the
  // badge; Fonbnk is sell-only since 7 Nov 2026, never badged.
  ok("ZA lineup", JSON.stringify(names("ZA")) === JSON.stringify(["Mt Pelerin", "Paybis", "Mercuryo"])
    && JSON.stringify(names("ZA", "sell")) === JSON.stringify(["Mt Pelerin", "Fonbnk", "Paybis", "Mercuryo"]));
  ok("ZA badges Mt Pelerin, not Fonbnk", JSON.stringify(badged("ZA")) === JSON.stringify(["Mt Pelerin"])
    && JSON.stringify(badged("ZA", "sell")) === JSON.stringify(["Mt Pelerin"]));
  const zaFonbnk = rampRoutesFor("ZA", "sell", "bsc", "USDC").routes.find(r => r.name === "Fonbnk");
  ok("ZA Fonbnk is sell-only and unbadged", zaFonbnk.badge === false && zaFonbnk.note.includes("check the quote")
    && !rampRoutesFor("ZA", "buy", "bsc", "USDC").routes.some(r => r.name === "Fonbnk"));

  // US: Spritz leads + badges (cheapest verified US route, global
  // research 7 Nov 2026); Mt Pelerin stays listed but flagged non-US
  // (it excludes US persons); Paybis keeps the ~5% card note.
  ok("US lineup + badge", JSON.stringify(names("US")) === JSON.stringify(["Spritz", "Mt Pelerin", "Paybis", "Mercuryo"])
    && JSON.stringify(badged("US")) === JSON.stringify(["Spritz"])
    && JSON.stringify(names("US", "sell")) === JSON.stringify(["Spritz", "Mt Pelerin", "Paybis", "Mercuryo"])
    && JSON.stringify(badged("US", "sell")) === JSON.stringify(["Spritz"]));
  ok("US Spritz is the external lead, Mt Pelerin flags non-US", (() => { const us = rampRoutesFor("US", "buy", "bsc", "USDC").routes;
    return us[0].external === true && us[0].url === "https://app.spritz.finance" && us[1].note.includes("Not available to US residents"); })());
  ok("US Paybis note is the dated card figure", rampRoutesFor("US", "buy", "bsc", "USDC").routes[2].note.includes("~5% all-in"));

  // Brazil: Paybis measured at market — kept, badged, ahead of Mercuryo.
  ok("BR lineup + badge", JSON.stringify(names("BR")) === JSON.stringify(["Paybis", "Mercuryo"])
    && JSON.stringify(badged("BR")) === JSON.stringify(["Paybis"]));

  // Indonesia: nothing measured for anyone — Paybis listed, NO badge
  // anywhere, and its note says the price is not yet verified.
  ok("ID has no badge at all", badged("ID").length === 0 && badged("ID", "sell").length === 0);
  ok("ID Paybis note says unverified", rampRoutesFor("ID", "buy", "bsc", "USDC").routes[0].note.includes("not yet verified for Indonesia"));

  // Global invariants over all 18 countries × buy/sell: at most one
  // badge per sheet, a badge only ever sits on the first route, every
  // URL is https, and every plan country assembles at least one route.
  ok("plan covers all ramp countries", RAMP_COUNTRIES.every(c => Array.isArray(RAMP_COUNTRY_PLAN[c.code]) && RAMP_COUNTRY_PLAN[c.code].length >= 1));
  ok("badge invariants hold everywhere", RAMP_COUNTRIES.every(c => ["buy", "sell"].every(m => {
    const { routes } = rampRoutesFor(c.code, m, "bsc", "USDT");
    const b = routes.filter(r => r.badge);
    return routes.length >= 1 && b.length <= 1 && (b.length === 0 || routes[0].badge === true)
      && routes.every(r => r.url.startsWith("https://"));
  })));
  // Unmeasured Fonbnk corridors carry no badge (no price evidence).
  ok("unmeasured corridors are unbadged", ["UG", "TZ", "CM", "SN", "CI", "ZM"].every(code => badged(code).length === 0 && badged(code, "sell").length === 0
    && rampRoutesFor(code, "sell", "bsc", "USDC").routes[0].note.includes("check the quote")));
  // Fonbnk on a network it doesn't ride: row omitted, flag raised.
  ok("fonbnk network gap is flagged", (() => { const r = rampRoutesFor("NG", "sell", "linea", "USDC");
    return r.fonbnkNetworkMissing === true && !r.routes.some(x => x.name === "Fonbnk"); })());
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
  const feeDisp = swapRawToAmount(platformFeeOn("84000000").toString(), 6); // 84 USDC quote -> 0.42 USDC fee
  const s = formatSwapIntent({ fromAmount: "84", fromSymbol: "USDC", fromNetKey: "bsc", toAmount: "83.9", toSymbol: "USDT", toNetKey: "bsc", toolName: "PancakeSwap", feeUsd: 0.21, durationSec: 30, platformFee: `${feeDisp} USDC` });
  return feeDisp === "0.42" && s.includes("Fluid fee (0.5%): 0.42 USDC");
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
  const s = formatSwapIntent({ fromAmount: "2", fromSymbol: "SOL", fromNetKey: "solana", toAmount: "150", toSymbol: "USDC", toNetKey: "base", toolName: "Jupiter", feeUsd: 0.05, durationSec: 60, platformFee: "0.01 SOL" });
  return s.includes("Fluid fee (0.5%): 0.01 SOL") && s.includes("on Solana");
})());
ok("swap intent discloses fluid fee on a tron route", (() => {
  const s = formatSwapIntent({ fromAmount: "100", fromSymbol: "TRX", fromNetKey: "tron", toAmount: "9.10", toSymbol: "BNB", toNetKey: "bsc", toolName: "Symbiosis", feeUsd: 0.40, durationSec: 120, platformFee: "0.5 TRX" });
  return s.includes("Fluid fee (0.5%): 0.5 TRX") && s.includes("on Tron");
})());
ok("swap intent discloses fluid fee on a sui route", (() => {
  const s = formatSwapIntent({ fromAmount: "10", fromSymbol: "SUI", fromNetKey: "sui", toAmount: "9.40", toSymbol: "BNB", toNetKey: "bsc", toolName: "Relay", feeUsd: 0.05, durationSec: 120, platformFee: "0.05 SUI" });
  return s.includes("Fluid fee (0.5%): 0.05 SUI") && s.includes("on Sui");
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
  registerNetworks({ c424242: { name: "Test Chain", chainId: 424242, symbol: "TST", priceSym: null, rpc: "https://rpc-424242.example", explorer: null, fonbnkNetwork: null, tokens: [] } });
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
    rpc: `http://127.0.0.1:${server.address().port}`, explorer: null, fonbnkNetwork: null, tokens: [] } });
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
{
  const { getVerifiedPrice } = await import("../src/wallet-core.js");
  const realFetch = globalThis.fetch;
  const stub = (binPrice, cgPrice) => {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("api.binance.com")) {
        if (binPrice === null) throw new Error("source down");
        return { json: async () => ({ price: String(binPrice) }) };
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
  ok("names-algo: the Algorand sheet resolves names and hard-blocks like the EVM/BTC sheets",
    appSrc.includes("That Fluid name has no Algorand address in the registry.")
    && appSrc.includes("formatAlgoSendIntent({ amount, symbol: tok.symbol, to, feeAlgo: plan.feeAlgo, name: sendName })"));
  const published = JSON.parse(readFileSync(new URL("../names.json", import.meta.url), "utf8"));
  ok("names-algo: the published registry carries dripbot's algo address, sanitised intact",
    sanitizeNameEntry(published.dripbot)?.algo === ALGO);
  ok("names-algo: the published registry carries ethuram's algo address, sanitised intact",
    sanitizeNameEntry(published.ethuram)?.algo === "IHRNG3GNVJILY66Y6D5V3NS6BSOBACXJGHAUSAR37S77JS4HRPEDWWWSC4");
}

// ---------- Fluid Names: registry host + mirror fallback ----------
// The registry's primary home is the Netlify site; the GitHub Pages
// mirror serves the same published names.json. When the primary
// fetch fails (network error or a non-ok response), both registry
// readers fall back to the mirror; a healthy primary is the only
// fetch made, and a caller-supplied registry URL never falls back.
{
  const { NAMES_REGISTRY_URL, NAMES_REGISTRY_FALLBACK_URL, resolveFluidName, fetchNameRegistry } = await import("../src/wallet-core.js");
  const EVM = "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B";
  const REG = { dripbot: { evm: EVM } };
  ok("names-host: the primary registry URL is the Netlify site",
    NAMES_REGISTRY_URL === "https://fluidwallet.netlify.app/names.json");
  ok("names-host: the fallback registry URL is the GitHub Pages mirror",
    NAMES_REGISTRY_FALLBACK_URL === "https://townsvilledh.github.io/fluid-wallet/names.json");
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
  ok("names-host: the page canonical and social images point at the Netlify site",
    html.includes('<link rel="canonical" href="https://fluidwallet.netlify.app/">')
    && html.includes('<meta property="og:url" content="https://fluidwallet.netlify.app/">')
    && html.includes('<meta property="og:image" content="https://fluidwallet.netlify.app/og-image.png">')
    && html.includes('<meta name="twitter:image" content="https://fluidwallet.netlify.app/og-image.png">'));
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
  // BIP-353 over a stubbed DoH endpoint
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("_bitcoin-payment.alice.example.com")) {
      return { ok: true, json: async () => ({ Answer: [{ name: "_bitcoin-payment.alice.example.com", type: 16, data: `"bitcoin:?lno=${offerStr}"` }] }) };
    }
    throw new Error("unexpected fetch: " + url);
  };
  try {
    const r = await resolveBip353Address("₿alice@example.com");
    ok("ln: BIP-353 resolves a DNS TXT offer and validates it",
      r.offer === offerStr && r.parsedOffer.description === "coffee");
    await assert.rejects(() => resolveBip353Address("bob@example.com"), /No BIP-353|DNS lookup/);
    ok("ln: BIP-353 with no TXT record fails plainly", true);
  } finally { globalThis.fetch = realFetch; }
  ok("ln: classifyLightningTarget routes every input shape",
    classifyLightningTarget(V2).kind === "bolt11" &&
    classifyLightningTarget(offerStr).kind === "bolt12" &&
    classifyLightningTarget("alice@example.com").kind === "address" &&
    classifyLightningTarget("ethuram").kind === "fluid-name" &&
    classifyLightningTarget("not a payment").kind === "unknown");
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
  ok("ui-p1: CSP is exactly the baseline policy with img-src gaining https: and nothing else",
    idxSrc.includes("default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; form-action 'none'"));
  ok("ui-p1: design tokens are the spec's (Part 3)",
    ["--bg0:#05070d", "--surface-1:#0b101f", "--surface-2:#111830", "--surface-3:#1a2247",
     "--brand-1:#5b8cff", "--brand-2:#9d6bff", "--drop:#38bdf8",
     "--grad-brand:linear-gradient(135deg,var(--brand-1),var(--brand-2))",
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
    && appSrc.includes('famLoaded.add("evm")') && appSrc.includes('famLoaded.add("cosmos")')
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
    && idxSrc.includes('<span class="chip">Every blockchain</span>') && idxSrc.includes('<span class="chip">No KYC</span>')
    && idxSrc.includes('<span class="chip">Keys never leave your phone</span>')
    && !idxSrc.includes("Every blockchain family —") && !idxSrc.includes("💧"));
  ok("ui-p2: home zero state exists, wired to Buy/Receive, and gated on loaded emptiness",
    idxSrc.includes('id="homeZero"') && idxSrc.includes('id="homeBuy"') && idxSrc.includes('id="homeReceive"')
    && appSrc.includes('hz.classList.toggle("hidden"') && appSrc.includes('famLoaded.has("evm") && !anyBal')
    && appSrc.includes("hzBuy.onclick") && appSrc.includes("hzRcv.onclick"));
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
  const lockSlice = appSrc.slice(lockAt, lockAt + 220);
  ok("qa4: locking clears the transient onboarding message",
    lockSlice.includes('msg("onboardMsg", "")'));

  // Defect 5: the owned-name card claimed public registration for a
  // name that was only claimed locally and never published.
  ok("qa5: the owned-name note no longer claims registration statically",
    idxSrc.includes('id="ownedNameNote"') && !idxSrc.includes("This name is registered to this wallet in the public registry")
    && idxSrc.includes("saved on this device"));
  const nameAt = appSrc.indexOf("function renderNameSection()");
  const nameSlice = appSrc.slice(nameAt, nameAt + 3400);
  ok("qa5: registered wording is set only when the registry resolves the name to this wallet",
    nameSlice.includes('$("ownedNameNote")')
    && nameSlice.includes("String(hit.evm).toLowerCase() === String(wallet.address).toLowerCase()")
    && nameSlice.includes("publish its entry so other Fluid wallets can resolve it"));
}

console.log(`\n${passed} checks passed`);
