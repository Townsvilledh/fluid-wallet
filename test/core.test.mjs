// Fluid core tests — run: npm test
import assert from "node:assert";
import { createVault, importVault, unlockVault, fonbnkOfframpUrl, fonbnkOnrampUrl, formatSendIntent, NETWORKS, bitcoinAddress, GLOBAL_RAMPS, RAMP_COUNTRIES, validateFluidName, normalizeFluidName, buildNameEntry, splitFee, FEE_SPLIT, rankRoutes, GAME_FEE_SPLIT, splitGameFee, AGENT_POLICY_DEFAULTS, agentAddresses, buildAgentDescriptor, checkAgentPolicy, FEE_SETTLEMENT, feeSettlementDue, rankSwapRoutes, formatSwapIntent, swapRouteExecutable, swapAmountToRaw, swapRawToAmount, LIFI_NATIVE_TOKEN, looksLikePoison, gateChains, registerNetworks, providerFor, tronAddressFromKey, tronAddressFromPhrase, tronAddressToHex, tronAddressFromHex, isValidTronAddress, tronSunToTrx, tronTrxToSun, formatTronSendIntent, TRON_TOKENS, TRON_LIFI_CHAIN_ID, TRON_SWAP_NATIVE_TOKEN, swapChainOf } from "../src/wallet-core.js";

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
