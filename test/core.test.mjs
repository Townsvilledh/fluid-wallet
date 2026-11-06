// Fluid core tests — run: npm test
import assert from "node:assert";
import { createVault, importVault, unlockVault, fonbnkOfframpUrl, fonbnkOnrampUrl, formatSendIntent, NETWORKS, bitcoinAddress, GLOBAL_RAMPS, RAMP_COUNTRIES, validateFluidName, normalizeFluidName, buildNameEntry, splitFee, FEE_SPLIT, rankRoutes, GAME_FEE_SPLIT, splitGameFee, AGENT_POLICY_DEFAULTS, agentAddresses, buildAgentDescriptor, checkAgentPolicy, FEE_SETTLEMENT, feeSettlementDue, rankSwapRoutes, formatSwapIntent, swapRouteExecutable, swapAmountToRaw, swapRawToAmount, LIFI_NATIVE_TOKEN, looksLikePoison, gateChains, registerNetworks, providerFor, tronAddressFromKey, tronAddressFromPhrase, tronAddressToHex, tronAddressFromHex, isValidTronAddress, tronSunToTrx, tronTrxToSun, formatTronSendIntent, TRON_TOKENS, TRON_LIFI_CHAIN_ID, TRON_SWAP_NATIVE_TOKEN, swapChainOf, deriveSlip10Ed25519, solanaSeedFromSeed, solanaAddressFromSeed, solanaAddressFromPhrase, isValidSolanaAddress, solLamportsToSol, solSolToLamports, solanaAtaAddress, formatSolanaSendIntent, SOLANA_TOKENS, SOLANA_LIFI_CHAIN_ID, SOLANA_SWAP_NATIVE_TOKEN, SOLANA_RENT_EXEMPT_LAMPORTS, SOLANA_ATA_RENT_LAMPORTS, solanaSwapSteps, litecoinAddress, isValidLitecoinAddress, formatLitecoinSendIntent, dogecoinAddress, isValidDogeAddress, DOGE_MIN_OUTPUT, bitcoinCashAddress, bitcoinCashLegacyAddress, bchAddressToScript, bchSighashDigest, buildSignedBchTx, isValidBchAddress } from "../src/wallet-core.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { mnemonicToSeedSync } from "@scure/bip39";
import { Keypair as SolKeypair, PublicKey as SolPublicKey } from "@solana/web3.js";
import { suiAddressFromPhrase, suiAddressFromSeed, suiSeedFromSeed, isValidSuiAddress, normalizeSuiAddress, suiMistToSui, suiSuiToMist, formatSuiSendIntent, SUI_TOKENS, SUI_COIN_TYPE, SUI_LIFI_CHAIN_ID, SUI_SWAP_NATIVE_TOKEN } from "../src/wallet-core.js";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { blake2b } from "@noble/hashes/blake2.js";
import { cosmosAddress, cosmosAddresses, cosmosChain, COSMOS_CHAINS, isValidCosmosAddress, formatCosmosSendIntent } from "../src/wallet-core.js";
import { stellarAddressFromPhrase, stellarAddressFromSeed, stellarSeedFromSeed, isValidStellarAddress, strKeyDecodeEd25519, crc16Xmodem, xlmToStroops, stroopsToXlm, stellarMinBalanceXlm, stellarMinBalanceStroops, formatStellarSendIntent, STELLAR_USDC, STELLAR_USDC_ISSUER } from "../src/wallet-core.js";
import { Keypair as StellarKeypair, StrKey as StellarStrKey } from "@stellar/stellar-sdk/base";
import { chunkArray, parseDexScreenerPairs, lifiTokenVerified, cosmosDenomDisplay, suiCoinFallbackSymbol,
  shortAddrLabel, tronDecodeAbiString, formatTokenAmount, dexChainIdForEvmChain, SOLANA_TOKEN2022_PROGRAM,
  MULTICALL3_ADDRESS } from "../src/wallet-core.js";
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

// 15. Global ramps + onramp links
ok("global ramps listed", GLOBAL_RAMPS.length >= 3 && GLOBAL_RAMPS.every(r => r.buy.startsWith("https://")));
ok("fonbnk onramp builds", (fonbnkOnrampUrl("bsc") || "").includes("pay.fonbnk.com/onramp"));
ok("fonbnk onramp null without mapping", fonbnkOnrampUrl("linea") === null);

// 16. Local-currency rails: country-aware Fonbnk links + country table
ok("fonbnk KE onramp", (fonbnkOnrampUrl("bsc", "USDC", "KE") || "").includes("countryIsoCode=KE"));
ok("fonbnk GH offramp USDT", (fonbnkOfframpUrl("base", "USDT", "GH") || "").includes("asset=USDT"));
ok("ramp countries include NG+US", RAMP_COUNTRIES.some(c => c.code === "NG" && c.fonbnk) && RAMP_COUNTRIES.some(c => c.code === "US"));

// 17. Fluid Names
ok("fluid name valid", validateFluidName("ethuram") && validateFluidName("kemi_2"));
ok("fluid name invalid", !validateFluidName("ab") && !validateFluidName("2cool") && !validateFluidName("has space"));
ok("fluid name normalize", normalizeFluidName("@Kemi.fluid.is-a.dev") === "kemi" && normalizeFluidName("kemi@fluid.is-a.dev") === "kemi");
ok("name entry builds", JSON.stringify(buildNameEntry("kemi", "0xabc", "bc1q")).includes('"kemi"'));

// 18. Name entries carry every key family; any-asset sends resolve from one name
ok("entry has evm+btc+ln", (() => { const e = buildNameEntry("kemi", "0xabc", "bc1q", "kemi@getalby.com").kemi; return e.evm === "0xabc" && e.btc === "bc1q" && e.ln.includes("getalby"); })());
ok("entry ln optional", buildNameEntry("kemi", "0xabc", "bc1q").kemi.ln === undefined);

// 19. Fee split 60/40 (settled in BTC Lightning) + cheapest-route ranking
ok("split 60/40", (() => { const s = splitFee(1000); return s.treasury === 600 && s.dripbot === 400; })());
ok("split remainder to treasury", (() => { const s = splitFee(101); return s.treasury + s.dripbot === 101 && s.treasury === 61; })());
ok("split config is BTC lightning", FEE_SPLIT.currency === "BTC" && FEE_SPLIT.rail === "lightning" && FEE_SPLIT.dripbot.x === "@bitcoinornatin");
ok("cheapest route first", rankRoutes([{ name: "MoonPay" }, { name: "Fonbnk" }])[0].name === "Fonbnk");

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

// 25. Send intent with a resolved Fluid name: confirmation shows name AND address
{
  const named = formatSendIntent({ amount: "0.0005", symbol: "BNB", to: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", networkKey: "bsc", feeNative: "0.000105", name: "dripbot" });
  ok("named intent shows name and short address", named.includes("Send 0.0005 BNB to dripbot.fluid.is-a.dev (0x7Fe6…135B) on BNB Chain"));
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
  const tronRoute = { fromChainId: 728126428, steps: [{ transactionRequest: { to: "TXYZ", chainId: 728126428 } }] };
  ok("tron: swap routes sourced from Tron are not executable yet", swapRouteExecutable(tronRoute).ok === false && /can't sign/.test(swapRouteExecutable(tronRoute).reason));
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
  ok("sui: swap routes sourced from Sui are listed but not executable yet",
    swapRouteExecutable(suiRoute).ok === false && /Sui/.test(swapRouteExecutable(suiRoute).reason) && /can't sign/.test(swapRouteExecutable(suiRoute).reason));
  const intoSui = { fromChainId: 56, toChainId: SUI_LIFI_CHAIN_ID, steps: [{ transactionRequest: { to: "0xabc", chainId: 56 } }] };
  ok("sui: routes INTO Sui from an EVM chain stay executable", swapRouteExecutable(intoSui).ok === true && swapRouteExecutable(intoSui).steps.length === 1);
}

// 32. Phase 3a — Cosmos (one secp256k1 account, coin type 118,
// m/44'/118'/0'/0/0, seven chains differing only in bech32 prefix) —
// with the settlement fix of 2026-11-06: Injective derives at coin
// type 60 (m/44'/60'/0'/0/0, the Keplr/Leap path) so the same seed
// shows the same inj1 address in Fluid, Keplr and Leap; the other six
// chains still share the 118 account.
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
    injective: "inj1gsvdpdxec8hsu57lhxg5xem7refr233zkczfgv", sei: "sei19rl4cm2hmr8afy4kldpxz3fka4jguq0a3vute5",
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
    ok("cosmos: Injective (60) account bytes are its own",
      bytesOf(addrs.injective) === "4418d0b4d9c1ef0e53dfb99143677e1e52354622");
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
  // Injective cross-checks at coin type 60 — @cosmjs HD derivation AND
  // a DirectSecp256k1Wallet built from Fluid's own 60 key must both
  // land on Fluid's inj address (the Keplr-compatibility promise).
  {
    const HD60 = [Slip10RawIndex.hardened(44), Slip10RawIndex.hardened(60), Slip10RawIndex.hardened(0), Slip10RawIndex.normal(0), Slip10RawIndex.normal(0)]; // m/44'/60'/0'/0/0
    const w = await DirectSecp256k1HdWallet.fromMnemonic(ABANDON, { prefix: "inj", hdPaths: [HD60] });
    const [acc] = await w.getAccounts();
    ok("cosmos: @cosmjs derivation agrees (inj, coin type 60)", acc.address === addrs.injective);
    const root = HDKey.fromMasterSeed(mnemonicToSeedSync(ABANDON));
    const child60 = root.derive("m/44'/60'/0'/0/0");
    const w2 = await DirectSecp256k1Wallet.fromKey(child60.privateKey, "inj");
    const [acc2] = await w2.getAccounts();
    ok("cosmos: DirectSecp256k1Wallet from Fluid's 60 key gives Fluid's inj address", acc2.address === addrs.injective);
  }
  // Chain table pins — every value verified against the chain registry
  // (chain ids, prefixes, denoms, decimals) before shipping.
  ok("cosmos: seven chains", COSMOS_CHAINS.length === 7);
  ok("cosmos: chain ids", COSMOS_CHAINS.map(c => c.chainId).join(",") === "cosmoshub-4,osmosis-1,noble-1,celestia,injective-1,pacific-1,dydx-mainnet-1");
  ok("cosmos: denoms", COSMOS_CHAINS.map(c => c.denom).join(",") === "uatom,uosmo,uusdc,utia,inj,usei,adydx");
  ok("cosmos: decimals (INJ and DYDX are 18, the rest 6)", COSMOS_CHAINS.map(c => c.decimals).join(",") === "6,6,6,6,18,6,18");
  ok("cosmos: noble asset is USDC (uusdc — also its fee token)",
    cosmosChain("noble").symbol === "USDC" && cosmosChain("noble").denom === "uusdc" && cosmosChain("noble").gasPrice === "0.1uusdc");
  ok("cosmos: Injective sends disabled (EthAccount), the other six enabled",
    cosmosChain("injective").sendEnabled === false && COSMOS_CHAINS.filter(c => c.key !== "injective").every(c => c.sendEnabled !== false));
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

console.log(`\n${passed} checks passed`);
