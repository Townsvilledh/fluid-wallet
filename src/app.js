// Fluid v2 — app-shell UI. Keys live only in memory while unlocked;
// the only thing persisted is the standard encrypted keystore JSON.
import "./buffer-shim.js"; // must stay first: @solana/web3.js needs Buffer
import QRCode from "qrcode";
import {
  NETWORKS, createVault, importVault, unlockVault, validatePassword,
  getBalances, estimateSend, executeSend, formatSendIntent,
  fonbnkOfframpUrl, fonbnkOnrampUrl, GLOBAL_RAMPS, RAMP_COUNTRIES, getPrices,
  bitcoinAddress, getBitcoinBalance, sendBitcoin, payLightningInvoice,
  litecoinAddress, getLitecoinBalance, getLtcFeeRate, sendLitecoin, isValidLitecoinAddress, formatLitecoinSendIntent,
  dogecoinAddress, getDogecoinBalance, isValidDogeAddress, DOGE_MIN_OUTPUT,
  sendDogecoin, formatDogeSendIntent, getDogeFeeInfo,
  bitcoinCashAddress, getBitcoinCashBalance, sendBitcoinCash, isValidBchAddress, formatBitcoinCashSendIntent,
  tronAddressFromPhrase, getTronBalances, getTronAllTokens, getTronTokenBalance, sendTron, isValidTronAddress, formatTronSendIntent, TRON_TOKENS, TRON_SWAP_NATIVE_TOKEN,
  solanaAddressFromPhrase, getSolanaBalances, getSolanaAllTokens, getSolanaTokenBalance, sendSolana, isValidSolanaAddress, formatSolanaSendIntent, solanaSendPlan, SOLANA_TOKENS, SOLANA_EXPLORER, SOLANA_SWAP_NATIVE_TOKEN, executeSolanaSwapRoute, swapChainOf,
  suiAddressFromPhrase, getSuiBalances, getSuiAllBalances, getSuiTokenBalance, sendSui, isValidSuiAddress, formatSuiSendIntent, SUI_TOKENS, SUI_COIN_TYPE, SUI_EXPLORER, SUI_SWAP_NATIVE_TOKEN,
  stellarAddressFromPhrase, getStellarAccount, sendStellar, isValidStellarAddress, formatStellarSendIntent, stellarSendPlan, STELLAR_EXPLORER,
  tonAddressFromPhrase, getTonAccount, sendTon, isValidTonAddress, formatTonSendIntent, tonSendPlan, TON_EXPLORER, TON_USDT,
  nearAddressFromPhrase, getNearAccount, sendNear, isValidNearAddress, formatNearSendIntent, nearSendPlan, NEAR_EXPLORER, NEAR_TOKENS,
  algoAddressFromPhrase, getAlgorandAccount, sendAlgorand, isValidAlgorandAddress, formatAlgoSendIntent, algoSendPlan, ALGO_EXPLORER, ALGO_USDC,
  xrplAddressFromPhrase, getXrplAccount, sendXrpl, isValidXrplAddress, formatXrplSendIntent, xrplSendPlan, XRPL_EXPLORER,
  dotAddressFromPhrase, getDotAccount, sendDot, isValidDotAddress, formatDotSendIntent, dotSendPlan, DOT_EXPLORER, DOT_TOKENS,
  aptosAddressFromPhrase, aptosPublicKeyFromPhrase, getAptosAccount, sendAptos, isValidAptosAddress, formatAptosSendIntent, aptosSendPlan, aptosOctasToApt, aptosAmountToRaw, APTOS_EXPLORER, APTOS_TOKENS,
  escapeHtml, sanitizePersistedSymbol, historyTxUrl, formatHistoryEntry, formatApprovalRow, formatRevokePrompt,
  stacksAddressFromPhrase, fetchStacksAccount, planStacksSend, sendStacks, isValidStacksAddress, stxMicroToStx, stacksRawToAmount, stacksExplorerTxUrl, STACKS_TOKENS, STACKS_EXPLORER,
  cosmosAddresses, getCosmosBalances, getCosmosAllBalances, sendCosmos, estimateCosmosFee, isValidCosmosAddress, formatCosmosSendIntent, COSMOS_CHAINS,
  RECEIVE_NETWORKS, filterReceiveNetworks,
  FLUID_DOMAIN, validateFluidName, normalizeFluidName, buildNameEntry, resolveFluidName, fetchNameRegistry, findNameForAddresses, lightningInvoiceForAddress, rankRoutes,
  AGENT_POLICY_DEFAULTS, agentAddresses, agentEvmWallet, buildAgentDescriptor, checkAgentPolicy, sendFromAgent,
  LIFI_NATIVE_TOKEN, getSwapRoutes, rankSwapRoutes, swapRouteExecutable, executeSwapRoute, formatSwapIntent, swapAmountToRaw, swapRawToAmount,
  looksLikePoison, revokeApproval,
  registerNetworks, fetchEvmChainSources, gateChains, probeChain, fetchStableTokens,
  fetchLifiTokenList, lifiTokenVerified, getDexScreenerTokenInfo, dexChainIdForEvmChain,
  scanEvmTokenBalances, getEvmTokenBalance, readEvmTokenMeta, formatTokenAmount,
} from "./wallet-core.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const HISTORY_KEY = "fluid_history_v1";
const APPROVALS_KEY = "fluid_approvals_v1";
const CHAINS_KEY = "fluid_chains_v1";
// Snapshot BEFORE discovery merges anything: these are the 15 canonical
// built-ins. Some surfaces (ramps) intentionally list only these.
const BUILTIN_NETWORK_KEYS = Object.keys(NETWORKS);
const BUILTIN_CHAIN_IDS = new Set(Object.values(NETWORKS).map(n => n.chainId));
const COIN_COLORS = { BTC: "#f7931a", ETH: "#627eea", BNB: "#f0b90b", USDC: "#2775ca", USDT: "#26a17b",
  POL: "#8247e5", AVAX: "#e84142", CELO: "#35d07f", MNT: "#5eead4", xDAI: "#04795d", FUSE: "#b4f461", TRX: "#eb0029", SOL: "#9945ff", SUI: "#4da2ff",
  LTC: "#345d9d", DOGE: "#c2a633", BCH: "#8dc351", XLM: "#3b5bdb",
  TON: "#2aabee", NEAR: "#00c08b", wNEAR: "#00c08b", ALGO: "#454545", XRP: "#4b5563", DOT: "#e6007a", APT: "#2dd4bf", lzUSDC: "#2775ca",
  ATOM: "#2e3148", OSMO: "#750bbb", TIA: "#7c2bf0", INJ: "#25b6e9", SEI: "#c1272d", DYDX: "#6966ff", STX: "#5546ff", sBTC: "#f7931a" };
const usd = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, d = 6) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

let wallet = null, networkKey = "bsc", balances = [], prices = {}, btcAddr = null, btcBal = 0, pendingSend = null;
let tronAddr = null, tronBalances = [];
let solAddr = null, solBalances = [];
let suiAddr = null, suiBalances = [];
let stellarAddr = null, stellarBalances = [], stellarFunded = null, stellarLoadFailed = false;
let tonAddr = null, tonBalances = [], tonState = null, tonLoadFailed = false;
let nearAddr = null, nearBalances = [], nearExists = null, nearLoadFailed = false;
let algoAddr = null, algoBalances = [], algoFunded = null, algoLoadFailed = false;
let xrpAddr = null, xrpBalances = [], xrpFunded = null, xrpLoadFailed = false;
let dotAddr = null, dotBalances = [], dotExists = null, dotLoadFailed = false;
let aptosAddr = null, aptosBalances = [], aptosExists = null, aptosLoadFailed = false, aptosScanFailed = false;
let stacksAddr = null, stacksBalances = [], stacksLoadFailed = false, stacksScanFailed = false;
let ltcAddr = null, ltcBal = 0;
let dogeAddr = null, dogeBal = 0;
let bchAddr = null, bchBal = 0;
let cosmosAddrs = {}, cosmosRows = [];

// ---------- universal tokens: shared presentation state ----------
// Token names/symbols now arrive from external lists and contracts —
// they are DATA, never markup: everything token-derived that reaches
// innerHTML goes through esc() first.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const UNVERIFIED_CAUTION = "This token isn't on a verified list — check the contract address carefully.";
const expandedOther = new Set();  // family keys whose "Other tokens" group is expanded
let familyScanFailed = {};        // tron/solana/sui -> true when the all-token read fell back to curated rows
let evmScanState = { key: null, status: "idle" }; // idle|scanning|done|limited|failed, for the ACTIVE chain
// A row's own priceUsd (present on discovered rows, null when no
// source prices them) always wins over the symbol table — a scam
// token can call itself "USDC", it cannot borrow USDC's price here.
const priceOfRow = (b, symPrice) => (b.priceUsd !== undefined ? b.priceUsd : symPrice);
const rowUsdValue = (b, symPrice) => { const p = priceOfRow(b, symPrice); return p != null ? Number(b.amount) * p : null; };
// Custom tokens (added by contract address) persist per EVM chain id.
const CUSTOM_TOKENS_KEY = "fluid_custom_tokens_v1";
const LIFI_TOKENS_KEY = "fluid_lifi_tokens_v1"; // single-slot cache: the most recent chain's LI.FI list, 24h
function loadCustomTokens(chainId) {
  try { const all = JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "{}"); return Array.isArray(all[chainId]) ? all[chainId] : []; }
  catch { return []; }
}
function saveCustomToken(chainId, tok) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "{}"); } catch { /* start fresh */ }
  const list = (Array.isArray(all[chainId]) ? all[chainId] : []).filter(c => c.address.toLowerCase() !== tok.address.toLowerCase());
  list.push(tok); all[chainId] = list;
  try { localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(all)); } catch { /* storage full/blocked */ }
}
function removeCustomToken(chainId, address) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "{}"); } catch { return; }
  if (Array.isArray(all[chainId])) all[chainId] = all[chainId].filter(c => c.address.toLowerCase() !== address.toLowerCase());
  try { localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(all)); } catch { /* best effort */ }
}
function lifiCacheGet(chainId) {
  try {
    const s = JSON.parse(localStorage.getItem(LIFI_TOKENS_KEY) || "null");
    if (s && s.chainId === chainId && Date.now() - (s.fetchedAt || 0) < 24 * 3600 * 1000 && Array.isArray(s.tokens)) return s.tokens;
  } catch { /* no cache */ }
  return null;
}
function lifiCacheSet(chainId, tokens) {
  try { localStorage.setItem(LIFI_TOKENS_KEY, JSON.stringify({ chainId, fetchedAt: Date.now(), tokens })); }
  catch { /* list too big for storage — session-only, refetched next time */ }
}

function show(id, on = true) { $(id).classList.toggle("hidden", !on); }
function msg(id, text, ok = false) { const e = $(id); if (e) { e.textContent = text; e.className = "msg " + (ok ? "ok" : "err"); } }
function openSheet(html) { fireSheetCloseHook(); $("sheetBody").innerHTML = html; show("sheetRoot"); }
function closeSheet() { fireSheetCloseHook(); show("sheetRoot", false); }
$("sheetX").onclick = closeSheet; $("scrim").onclick = closeSheet;
// One-shot hook fired when the current sheet goes away — via the X, the
// scrim, closeSheet(), or being replaced by another sheet. Promise-based
// sheets (the agent-transfer approval) register one so a dismissal settles
// the promise as "no" instead of leaving the caller hanging forever.
let sheetCloseHook = null;
function fireSheetCloseHook() { const h = sheetCloseHook; sheetCloseHook = null; if (h) { try { h(); } catch { /* a hook must never break the UI */ } } }

// ---------- copy (one path for the whole app) ----------
// Async Clipboard API where the browser allows it, textarea + execCommand
// fallback where it does not (older Android WebViews silently reject the
// promise, which used to make copy buttons look dead). ALWAYS gives
// visible feedback on the element that was tapped.
async function copyText(text, el) {
  let done = false;
  try { await navigator.clipboard.writeText(text); done = true; } catch { /* fall back below */ }
  if (!done) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      done = document.execCommand("copy");
      ta.remove();
    } catch { done = false; }
  }
  if (el) {
    const old = el.textContent;
    el.textContent = done ? "Copied ✓" : "Copy failed — long-press the text to copy";
    setTimeout(() => { el.textContent = old; }, 1500);
  }
  return done;
}

// ---------- tabs ----------
function goTab(name) {
  for (const t of ["wallet", "play", "activity", "more"]) show("tab-" + t, t === name);
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => goTab(b.dataset.tab));
$("playJump").onclick = () => goTab("play");
$("notifyBtn").onclick = () => {
  localStorage.setItem("fluid_ogo_notify", "1");
  msg("notifyMsg", "You're on the list — on this device. Launch news will also be posted in the GitHub repo.", true);
};

// ---------- gate ----------
function refreshGate() {
  const hasVault = !!localStorage.getItem(VAULT_KEY);
  show("onboard", !wallet);
  show("unlockBox", hasVault && !wallet);
  show("createBox", !hasVault && !wallet);
  show("app", !!wallet);
  if (wallet) renderMain();
}

/** Load a family's ALL-token rows; if the discovery read itself is
 *  unreachable, fall back to the curated-rows read and flag the
 *  family so the UI can say "scan unavailable — main tokens only"
 *  instead of silently pretending the wallet holds nothing else. */
async function loadFamilyRows(allFn, fallbackFn, fam) {
  try { return await allFn(); }
  catch {
    familyScanFailed[fam] = true;
    try { return await fallbackFn(); } catch { return null; }
  }
}

async function renderMain() {
  $("addrText").textContent = wallet.address.slice(0, 8) + "…" + wallet.address.slice(-6) + " ⧉ tap to copy";
  const myName = localStorage.getItem("fluid_name");
  $("nameText").textContent = myName ? "@" + myName + " · " + myName + "." + FLUID_DOMAIN : "";
  if (myName && $("namePreview")) $("namePreview").textContent = myName + "." + FLUID_DOMAIN;
  renderAgents();
  $("addrText").onclick = () => copyText(wallet.address, $("addrText"));
  $("netBtn").textContent = NETWORKS[networkKey].name + " ▾";
  try { prices = await getPrices(); } catch { prices = {}; }
  // Bitcoin first (all chains, one wallet)
  btcAddr = bitcoinAddress(wallet.mnemonic.phrase);
  // Fluid name: paint the owned/claim state, then (once per session) try
  // to adopt a registry name that already belongs to this wallet — a
  // restored wallet whose name was published earlier should SEE its name,
  // not an empty claim form that rejects the name as "already claimed".
  renderNameSection();
  adoptRegistryNameIfMine();
  getBitcoinBalance(btcAddr).then(b => { btcBal = b; paintAssets(); }).catch(() => paintAssets());
  // Tron next (a family like Bitcoin, not an EVM network): same key as
  // the EVM account, its own rows, painted with zero placeholders until
  // TronGrid answers.
  tronAddr = tronAddressFromPhrase(wallet.mnemonic.phrase);
  tronBalances = [{ symbol: "TRX", amount: "0", address: null, decimals: 6 },
                  ...TRON_TOKENS.map(t => ({ ...t, amount: "0" }))];
  $("totalSub").textContent = "on this network + Bitcoin + Litecoin + Dogecoin + Bitcoin Cash + Tron + Solana + Sui + Stellar + Cosmos (7 chains) + TON + NEAR + Algorand + XRP Ledger + Polkadot Asset Hub + Aptos + Stacks";
  loadFamilyRows(() => getTronAllTokens(tronAddr), () => getTronBalances(tronAddr), "tron")
    .then(rows => { if (rows) tronBalances = rows; paintAssets(); });
  // Solana (a family like Bitcoin/Tron, not an EVM network): SLIP-0010
  // Ed25519 branch of the same seed, its own rows, painted with zero
  // placeholders until the RPC answers.
  solAddr = solanaAddressFromPhrase(wallet.mnemonic.phrase);
  solBalances = [{ symbol: "SOL", amount: "0", address: null, decimals: 9 },
                 ...SOLANA_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSolanaAllTokens(solAddr), () => getSolanaBalances(solAddr), "solana")
    .then(rows => { if (rows) solBalances = rows; paintAssets(); });
  // Sui (Phase 2b): SLIP-0010 Ed25519 branch (coin type 784) of the
  // same seed — the same derivation family as Solana, Sui's own path.
  // Also the future home of the OGO ERA Companion NFT.
  suiAddr = suiAddressFromPhrase(wallet.mnemonic.phrase);
  suiBalances = [{ symbol: "SUI", amount: "0", address: null, decimals: 9 },
                 ...SUI_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSuiAllBalances(suiAddr), () => getSuiBalances(suiAddr), "sui")
    .then(rows => { if (rows) suiBalances = rows; paintAssets(); });
  // Stellar (Phase 3b): SLIP-0010 Ed25519 branch (coin type 148) of
  // the same seed. The single account read IS the all-asset read
  // (XLM + every trustline). An unfunded account is a state — "not
  // yet activated" — painted honestly; a failed read keeps the
  // placeholder row plus a "couldn't load" note, never a fake zero.
  stellarAddr = stellarAddressFromPhrase(wallet.mnemonic.phrase);
  stellarBalances = [{ symbol: "XLM", name: "Stellar Lumens", amount: "0", address: null, assetCode: null, issuer: null, decimals: 7, verified: true }];
  stellarFunded = null; stellarLoadFailed = false;
  getStellarAccount(stellarAddr)
    .then(acct => { stellarBalances = acct.balances; stellarFunded = acct.funded; paintAssets(); })
    .catch(() => { stellarLoadFailed = true; paintAssets(); });
  // Phase 4 — payments-grade families: TON (SLIP-0010 coin 607,
  // Wallet V4R2), NEAR (coin 397, implicit account), Algorand (coin
  // 283), XRP Ledger (BIP44 secp256k1 coin 144), Polkadot Asset Hub
  // (Sr25519, Substrate derivation). Each follows the Stellar
  // discipline: placeholder rows, honest state notes on failure —
  // never a fake zero presented as a loaded balance.
  tonAddr = tonAddressFromPhrase(wallet.mnemonic.phrase);
  tonBalances = [{ symbol: "TON", name: "Toncoin", amount: "0", address: null, decimals: 9, verified: true },
                 { ...TON_USDT, amount: "0" }];
  tonState = null; tonLoadFailed = false;
  getTonAccount(tonAddr)
    .then(acct => { tonBalances = acct.balances; tonState = acct.state; paintAssets(); })
    .catch(() => { tonLoadFailed = true; paintAssets(); });
  nearAddr = nearAddressFromPhrase(wallet.mnemonic.phrase);
  nearBalances = [{ symbol: "NEAR", name: "NEAR", amount: "0", address: null, decimals: 24, verified: true },
                  ...NEAR_TOKENS.map(t => ({ ...t, amount: "0" }))];
  nearExists = null; nearLoadFailed = false;
  getNearAccount(nearAddr)
    .then(acct => { nearBalances = acct.balances; nearExists = acct.exists; paintAssets(); })
    .catch(() => { nearLoadFailed = true; paintAssets(); });
  algoAddr = algoAddressFromPhrase(wallet.mnemonic.phrase);
  algoBalances = [{ symbol: "ALGO", name: "Algorand", amount: "0", address: null, decimals: 6, verified: true },
                  { ...ALGO_USDC, amount: "0" }];
  algoFunded = null; algoLoadFailed = false;
  getAlgorandAccount(algoAddr)
    .then(acct => { algoBalances = acct.balances; algoFunded = acct.funded; paintAssets(); })
    .catch(() => { algoLoadFailed = true; paintAssets(); });
  xrpAddr = xrplAddressFromPhrase(wallet.mnemonic.phrase);
  xrpBalances = [{ symbol: "XRP", name: "XRP", amount: "0", address: null, decimals: 6, verified: true }];
  xrpFunded = null; xrpLoadFailed = false;
  getXrplAccount(xrpAddr)
    .then(acct => { xrpBalances = acct.balances; xrpFunded = acct.funded; paintAssets(); })
    .catch(() => { xrpLoadFailed = true; paintAssets(); });
  dotAddr = dotAddressFromPhrase(wallet.mnemonic.phrase);
  dotBalances = [{ symbol: "DOT", name: "Polkadot", amount: "0", address: null, decimals: 10, verified: true },
                 ...DOT_TOKENS.map(t => ({ ...t, amount: "0" }))];
  dotExists = null; dotLoadFailed = false;
  getDotAccount(dotAddr)
    .then(acct => { dotBalances = acct.balances; dotExists = acct.exists; paintAssets(); })
    .catch(() => { dotLoadFailed = true; paintAssets(); });
  // Aptos (Phase 5): SLIP-0010 Ed25519 branch (coin type 637, the
  // Petra path) of the same seed. The account read reports existence
  // honestly — an address the chain has never seen is "not yet
  // created", not a fake zero — and a failed read keeps the
  // placeholder rows plus a note.
  aptosAddr = aptosAddressFromPhrase(wallet.mnemonic.phrase);
  aptosBalances = [{ symbol: "APT", name: "Aptos", amount: "0", address: null, decimals: 8, verified: true },
                   ...APTOS_TOKENS.map(t => ({ ...t, amount: "0", verified: true }))];
  aptosExists = null; aptosLoadFailed = false; aptosScanFailed = false;
  getAptosAccount(aptosAddr)
    .then(acct => { aptosBalances = acct.balances; aptosExists = acct.exists; aptosScanFailed = acct.scanFailed; paintAssets(); })
    .catch(() => { aptosLoadFailed = true; paintAssets(); });
  // Stacks (Bitcoin L2): BIP44 coin-5757 branch of the same seed. STX +
  // every SIP-010 balance via Hiro; pinned tokens (sBTC, USDA) verified,
  // everything else unverified (⚠) with contract-read metadata.
  stacksAddr = stacksAddressFromPhrase(wallet.mnemonic.phrase);
  stacksBalances = [{ symbol: "STX", name: "Stacks", amount: "0", decimals: 6, verified: true, contract: null },
                    ...STACKS_TOKENS.map(t => ({ ...t, amount: "0", balanceRaw: "0", verified: true }))];
  stacksLoadFailed = false; stacksScanFailed = false;
  fetchStacksAccount(stacksAddr)
    .then(acct => {
      if (acct.scanFailed) { stacksScanFailed = true; paintAssets(); return; }
      stacksBalances = [{ symbol: "STX", name: "Stacks", amount: stxMicroToStx(acct.stxUstx), decimals: 6, verified: true, contract: null },
                        ...acct.tokens.map(t => ({ ...t, amount: stacksRawToAmount(t.balanceRaw, t.decimals) }))];
      paintAssets();
    })
    .catch(() => { stacksLoadFailed = true; paintAssets(); });
  // Bitcoin-family altcoins (Phase 2a): same seed, own branches —
  // Litecoin (BIP84 coin 2), Dogecoin (BIP44 coin 3, legacy),
  // Bitcoin Cash (BIP44 coin 145, CashAddr).
  ltcAddr = litecoinAddress(wallet.mnemonic.phrase);
  getLitecoinBalance(ltcAddr).then(b => { ltcBal = b; paintAssets(); }).catch(() => paintAssets());
  dogeAddr = dogecoinAddress(wallet.mnemonic.phrase);
  getDogecoinBalance(dogeAddr).then(b => { dogeBal = b; paintAssets(); }).catch(() => paintAssets());
  bchAddr = bitcoinCashAddress(wallet.mnemonic.phrase);
  getBitcoinCashBalance(bchAddr).then(b => { bchBal = b; paintAssets(); }).catch(() => paintAssets());
  // Cosmos (Phase 3a): seven chains — six share one account's bytes
  // under their bech32 prefixes; Injective derives at coin type 60
  // (the Keplr path). Rows start as "unavailable"
  // (amount null) and fill in per chain as the public REST endpoints
  // answer; a chain that never answers keeps the honest null instead
  // of a fake zero (the DOGE precedent).
  cosmosAddrs = cosmosAddresses(wallet.mnemonic.phrase);
  cosmosRows = COSMOS_CHAINS.map(c => ({ ...c, address: cosmosAddrs[c.key], amount: null }));
  paintAssets();
  getCosmosAllBalances(wallet.mnemonic.phrase).then(rows => { cosmosRows = rows; paintAssets(); }).catch(() => paintAssets());
  $("assetList").innerHTML = "Loading assets…";
  try {
    balances = await Promise.race([
      getBalances(wallet, networkKey),
      new Promise((_, reject) => setTimeout(() => reject(new Error("balance load timed out")), 20000)),
    ]);
  } catch { balances = []; $("assetList").innerHTML = "Could not load balances (network busy — tap More → Refresh)."; }
  paintAssets();
  hydrateEvmTokens(); // background: custom tokens + full scan of the active chain
  renderHistory();
  discoverChains(); // background, non-blocking; no-ops while the cache is fresh
}

function heroTotal() {
  const net = NETWORKS[networkKey];
  let t = btcBal * (prices.BTC || 0)
    + ltcBal * (prices.LTC || 0) + dogeBal * (prices.DOGE || 0) + bchBal * (prices.BCH || 0);
  for (const b of balances) {
    const p = priceOfRow(b, b.address ? prices[b.symbol] : prices[net.priceSym]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of tronBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of solBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of suiBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of stellarBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of tonBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of nearBalances) {
    // wNEAR is NEAR, wrapped 1:1 — price it as NEAR.
    const p = priceOfRow(b, b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of algoBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of xrpBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of dotBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of aptosBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const b of stacksBalances) {
    const p = priceOfRow(b, prices[b.symbol]);
    if (p != null) t += Number(b.amount) * p;
  }
  for (const r of cosmosRows) {
    if (r.amount == null) continue; // unavailable is not zero — it is unknown, and stays out of the total
    const p = prices[r.symbol] ?? null;
    if (p != null) t += Number(r.amount) * p;
  }
  return t;
}

// ---------- universal tokens: asset-list presentation ----------
// Priced + verified tokens form the main list, sorted by USD value.
// Everything else — unverified, or held but unpriced — stays visible
// and fully usable under a collapsed "Other tokens (N)" group per
// family. Token-derived strings are escaped (see esc): a token's
// name is attacker-controlled data.
function tokenRowHtml(b, v, sub, dataAttr) {
  const warn = b.verified === false ? "⚠ " : "";
  const nameLine = b.name && b.name !== b.symbol ? `${esc(b.name)} · ${sub}` : sub;
  return `<div class="row"${dataAttr ? " " + dataAttr : ""}>
      <span class="coin" style="background:${COIN_COLORS[b.symbol] || "#3b4a7a"}">${esc(String(b.symbol).slice(0, 1))}</span>
      <span class="grow"><b>${warn}${esc(b.symbol)}</b><small>${esc(nameLine)}</small></span>
      <span class="amt"><b>${fmt(b.amount)}</b><small>${v != null ? usd(v) : ""}</small></span></div>`;
}
function splitRows(rows, symPriceOf) {
  const main = [], other = [];
  for (const b of rows) {
    const v = rowUsdValue(b, symPriceOf(b));
    if (b.verified !== false && v != null) main.push({ b, v }); else other.push({ b, v });
  }
  main.sort((x, y) => y.v - x.v);
  return { main, other };
}
function otherGroupHtml(famKey, items, renderItem) {
  if (!items.length) return "";
  const open = expandedOther.has(famKey);
  return `<div class="row" data-other="${famKey}">
      <span class="coin" style="background:#3b4a7a">…</span>
      <span class="grow"><b>Other tokens (${items.length})</b><small>Unverified or unpriced — tap to ${open ? "hide" : "show"}. Fully usable; check contract addresses carefully.</small></span>
      <span>${open ? "▾" : "▸"}</span></div>` + (open ? items.map(renderItem).join("") : "");
}

function paintAssets() {
  $("totalUsd").textContent = usd(heroTotal());
  const net = NETWORKS[networkKey];
  const rows = [];
  rows.push(`<div class="row" id="btcRow">
      <span class="coin" style="background:${COIN_COLORS.BTC}">₿</span>
      <span class="grow"><b>Bitcoin</b><small>Native SegWit · all networks' wallet</small></span>
      <span class="amt"><b>${fmt(btcBal, 8)}</b><small>${usd(btcBal * (prices.BTC || 0))}</small></span></div>`);
  // EVM rows for the active network: native + curated + custom +
  // scanned (hydrateEvmTokens merges the discovered ones into
  // `balances`), presented priced-and-verified first.
  {
    const sp = splitRows(balances, (b) => b.address ? prices[b.symbol] : prices[net.priceSym]);
    const render = ({ b, v }) => tokenRowHtml(b, v, net.name, "");
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("evm", sp.other, render));
    if (evmScanState.key === networkKey) {
      if (evmScanState.status === "scanning") rows.push(`<p class="tag" style="margin:6px 0">Scanning ${esc(net.name)} for your other tokens…</p>`);
      else if (evmScanState.status === "limited") rows.push(`<p class="tag" style="margin:6px 0">Token scan is limited on ${esc(net.name)} (no Multicall3) — showing known tokens. Any token can still be added by contract address.</p>`);
      else if (evmScanState.status === "failed") rows.push(`<p class="tag" style="margin:6px 0">Token scan unavailable right now — showing known tokens.</p>`);
    }
    rows.push(`<button class="btn ghost" id="addTokBtn" style="margin:8px 0">＋ Add a token by contract address</button>`);
  }
  // Tron family rows (tap a row to send on Tron)
  if (tronBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Tron</p>`);
    const sp = splitRows(tronBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Tron${b.address ? " · TRC20" : ""}`, `data-tron="${tronBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("tron", sp.other, render));
    if (familyScanFailed.tron) rows.push(`<p class="tag">Full token scan unavailable — showing main Tron tokens only.</p>`);
  }
  // Solana family rows (tap a row to send on Solana)
  if (solBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Solana</p>`);
    const sp = splitRows(solBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Solana${b.address ? " · SPL" : ""}`, `data-sol="${solBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("solana", sp.other, render));
    if (familyScanFailed.solana) rows.push(`<p class="tag">Full token scan unavailable — showing main Solana tokens only.</p>`);
  }
  // Sui family rows (tap a row to send on Sui)
  if (suiBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Sui</p>`);
    const sp = splitRows(suiBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Sui${b.address ? " · Coin" : ""}`, `data-sui="${suiBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("sui", sp.other, render));
    if (familyScanFailed.sui) rows.push(`<p class="tag">Full token scan unavailable — showing main Sui tokens only.</p>`);
  }
  // Stellar family rows (tap a row to send on Stellar)
  if (stellarBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Stellar</p>`);
    const sp = splitRows(stellarBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Stellar${b.address && !b.lpShare ? " · Trustline asset" : ""}`, `data-stellar="${stellarBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("stellar", sp.other, render));
    if (stellarFunded === false) rows.push(`<p class="tag">Account not yet activated — receive at least 1 XLM to activate it.</p>`);
    if (stellarLoadFailed) rows.push(`<p class="tag">Stellar balances couldn't be loaded right now.</p>`);
  }
  // TON family rows (Phase 4; tap a row to send on TON)
  if (tonBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">TON</p>`);
    const sp = splitRows(tonBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `TON${b.address ? " · Jetton" : ""}`, `data-ton="${tonBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("ton", sp.other, render));
    if (tonState && tonState !== "active") rows.push(`<p class="tag">Wallet not deployed yet — it deploys automatically with your first send.</p>`);
    if (tonLoadFailed) rows.push(`<p class="tag">TON balances couldn't be loaded right now.</p>`);
  }
  // NEAR family rows (Phase 4; tap a row to send on NEAR)
  if (nearBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">NEAR</p>`);
    const sp = splitRows(nearBalances, (b) => b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `NEAR${b.address ? " · NEP-141" : ""}`, `data-near="${nearBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("near", sp.other, render));
    if (nearExists === false) rows.push(`<p class="tag">Account doesn't exist yet — it is created when it first receives at least 0.00182 NEAR.</p>`);
    if (nearLoadFailed) rows.push(`<p class="tag">NEAR balances couldn't be loaded right now.</p>`);
  }
  // Algorand family rows (Phase 4; tap a row to send on Algorand)
  if (algoBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Algorand</p>`);
    const sp = splitRows(algoBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Algorand${b.address ? " · ASA " + esc(b.address) : ""}`, `data-algo="${algoBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("algorand", sp.other, render));
    if (algoFunded === false) rows.push(`<p class="tag">Account not funded yet — receive ALGO to start using it.</p>`);
    if (algoLoadFailed) rows.push(`<p class="tag">Algorand balances couldn't be loaded right now.</p>`);
  }
  // XRP Ledger family rows (Phase 4; tap a row to send on XRPL)
  if (xrpBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">XRP Ledger</p>`);
    const sp = splitRows(xrpBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `XRP Ledger${b.address ? " · Trust line" : ""}`, `data-xrp="${xrpBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("xrpl", sp.other, render));
    if (xrpFunded === false) rows.push(`<p class="tag">Account not activated yet — it activates when it first receives at least the network base reserve (1 XRP).</p>`);
    if (xrpLoadFailed) rows.push(`<p class="tag">XRP Ledger balances couldn't be loaded right now.</p>`);
  }
  // Polkadot Asset Hub family rows (Phase 4; tap a row to send)
  if (dotBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Polkadot Asset Hub</p>`);
    const sp = splitRows(dotBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Polkadot Asset Hub${b.address ? " · Asset " + esc(b.address) : ""}`, `data-dot="${dotBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("polkadot", sp.other, render));
    if (dotLoadFailed) rows.push(`<p class="tag">Polkadot Asset Hub balances couldn't be loaded right now.</p>`);
  }
  // Aptos family rows (Phase 5; tap a row to send on Aptos)
  if (aptosBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Aptos</p>`);
    const sp = splitRows(aptosBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Aptos${b.address ? (b.standard === "coin" ? " · Coin" : " · Fungible asset") : ""}`, `data-aptos="${aptosBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("aptos", sp.other, render));
    if (aptosExists === false) rows.push(`<p class="tag">Account not yet created — it is created when it first receives APT.</p>`);
    if (aptosScanFailed) rows.push(`<p class="tag">Full token scan unavailable — showing main Aptos tokens only.</p>`);
    if (aptosLoadFailed) rows.push(`<p class="tag">Aptos balances couldn't be loaded right now.</p>`);
  }
  // Stacks family rows (Bitcoin L2; tap a row to send on Stacks)
  if (stacksBalances.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Stacks · Bitcoin L2</p>`);
    const sp = splitRows(stacksBalances, (b) => prices[b.symbol]);
    const render = ({ b, v }) => tokenRowHtml(b, v, `Stacks${b.contract ? " · SIP-010 token" : ""}`, `data-stacks="${stacksBalances.indexOf(b)}"`);
    for (const item of sp.main) rows.push(render(item));
    rows.push(otherGroupHtml("stacks", sp.other, render));
    if (stacksScanFailed || stacksLoadFailed) rows.push(`<p class="tag">Stacks balances couldn't be loaded right now.</p>`);
  }
  // Cosmos family rows (Phase 3a): one phrase, seven chains — a row
  // per chain showing that chain's native asset. An unavailable read
  // shows "unavailable", never a fake zero.
  if (cosmosRows.length) {
    rows.push(`<p class="tag" style="margin:12px 0 2px">Cosmos — one phrase, seven chains</p>`);
    cosmosRows.forEach((r) => {
      const p = prices[r.symbol];
      rows.push(`<div class="row" data-cosmos="${r.key}">
        <span class="coin" style="background:${COIN_COLORS[r.symbol] || "#3b4a7a"}">${r.symbol.slice(0, 1)}</span>
        <span class="grow"><b>${r.symbol}</b><small>${r.name}</small></span>
        <span class="amt">${r.amount == null
          ? `<b>—</b><small>unavailable</small>`
          : `<b>${fmt(r.amount)}</b><small>${p != null ? usd(Number(r.amount) * p) : ""}</small>`}</span></div>`);
    });
  }
  // Bitcoin-family rows (Phase 2a): Litecoin, Dogecoin, Bitcoin Cash
  rows.push(`<p class="tag" style="margin:12px 0 2px">Bitcoin family</p>`);
  rows.push(`<div class="row" data-ltc="1">
      <span class="coin" style="background:${COIN_COLORS.LTC}">Ł</span>
      <span class="grow"><b>Litecoin</b><small>Native SegWit · same seed as Bitcoin</small></span>
      <span class="amt"><b>${fmt(ltcBal, 8)}</b><small>${usd(ltcBal * (prices.LTC || 0))}</small></span></div>`);
  rows.push(`<div class="row" data-doge="1">
      <span class="coin" style="background:${COIN_COLORS.DOGE}">Ð</span>
      <span class="grow"><b>Dogecoin</b><small>Legacy · same seed as Bitcoin</small></span>
      <span class="amt"><b>${fmt(dogeBal, 8)}</b><small>${usd(dogeBal * (prices.DOGE || 0))}</small></span></div>`);
  rows.push(`<div class="row" data-bch="1">
      <span class="coin" style="background:${COIN_COLORS.BCH}">B</span>
      <span class="grow"><b>Bitcoin Cash</b><small>CashAddr · same seed as Bitcoin</small></span>
      <span class="amt"><b>${fmt(bchBal, 8)}</b><small>${usd(bchBal * (prices.BCH || 0))}</small></span></div>`);
  $("assetList").innerHTML = rows.join("");
  $("btcRow").onclick = openBtcSheet;
  document.querySelector("[data-ltc]").onclick = openLtcSheet;
  document.querySelector("[data-doge]").onclick = openDogeSheet;
  document.querySelector("[data-bch]").onclick = openBchSheet;
  document.querySelectorAll("[data-tron]").forEach(r => r.onclick = () => {
    const b = tronBalances[Number(r.dataset.tron)];
    if (b) openTronSheet(b);
  });
  document.querySelectorAll("[data-sol]").forEach(r => r.onclick = () => {
    const b = solBalances[Number(r.dataset.sol)];
    if (b) openSolanaSheet(b);
  });
  document.querySelectorAll("[data-sui]").forEach(r => r.onclick = () => {
    const b = suiBalances[Number(r.dataset.sui)];
    if (b) openSuiSheet(b);
  });
  document.querySelectorAll("[data-stellar]").forEach(r => r.onclick = () => {
    const b = stellarBalances[Number(r.dataset.stellar)];
    if (b) openStellarSheet(b);
  });
  document.querySelectorAll("[data-ton]").forEach(r => r.onclick = () => {
    const b = tonBalances[Number(r.dataset.ton)];
    if (b) openTonSheet(b);
  });
  document.querySelectorAll("[data-near]").forEach(r => r.onclick = () => {
    const b = nearBalances[Number(r.dataset.near)];
    if (b) openNearSheet(b);
  });
  document.querySelectorAll("[data-algo]").forEach(r => r.onclick = () => {
    const b = algoBalances[Number(r.dataset.algo)];
    if (b) openAlgoSheet(b);
  });
  document.querySelectorAll("[data-xrp]").forEach(r => r.onclick = () => {
    const b = xrpBalances[Number(r.dataset.xrp)];
    if (b) openXrplSheet(b);
  });
  document.querySelectorAll("[data-dot]").forEach(r => r.onclick = () => {
    const b = dotBalances[Number(r.dataset.dot)];
    if (b) openDotSheet(b);
  });
  document.querySelectorAll("[data-aptos]").forEach(r => r.onclick = () => {
    const b = aptosBalances[Number(r.dataset.aptos)];
    if (b) openAptosSheet(b);
  });
  document.querySelectorAll("[data-stacks]").forEach(r => r.onclick = () => {
    const b = stacksBalances[Number(r.dataset.stacks)];
    if (b) openStacksSheet(b);
  });
  document.querySelectorAll("[data-cosmos]").forEach(r => r.onclick = () => {
    const row = cosmosRows.find(x => x.key === r.dataset.cosmos);
    if (row) openCosmosSheet(row);
  });
  document.querySelectorAll("[data-other]").forEach(r => r.onclick = () => {
    const k = r.dataset.other;
    if (expandedOther.has(k)) expandedOther.delete(k); else expandedOther.add(k);
    paintAssets();
  });
  const atb = $("addTokBtn");
  if (atb) atb.onclick = openAddTokenSheet;
}

// ---------- chain discovery (Phase 0: gated EVM auto-discovery) ----------
// The 15 built-ins stay canonical. Discovered chains (gated in core:
// active, no reused ids, no testnets, LI.FI-listed or real TVL) persist on
// this device, refresh every 24h, and are fingerprint-checked with
// probeChain before the wallet ever switches to one. Discovery runs in
// the background after unlock and can never break the wallet — if every
// source fails, the built-ins simply carry on.
let discoveredChains = {};   // key -> gated entry produced by gateChains
let chainsCache = null;      // parsed fluid_chains_v1 payload
let discoveryRunning = false;

function applyDiscovered(list) {
  discoveredChains = {};
  const reg = {};
  for (const d of list || []) {
    if (!d || !d.key || !d.rpc || BUILTIN_CHAIN_IDS.has(d.chainId)) continue;
    discoveredChains[d.key] = d;
    reg[d.key] = { name: d.name, chainId: d.chainId, symbol: d.symbol, priceSym: d.symbol,
      rpc: d.rpc, explorer: d.explorer, fonbnkNetwork: null, tokens: d.tokens || [], discovered: true };
  }
  registerNetworks(reg);
}
function loadStoredChains() {
  try { chainsCache = JSON.parse(localStorage.getItem(CHAINS_KEY) || "null"); } catch { chainsCache = null; }
  if (chainsCache && Array.isArray(chainsCache.chains)) applyDiscovered(chainsCache.chains);
}
async function discoverChains() {
  if (discoveryRunning) return;
  if (chainsCache && Date.now() - (chainsCache.fetchedAt || 0) < 24 * 3600 * 1000) return;
  discoveryRunning = true;
  try {
    const gated = gateChains(await fetchEvmChainSources());
    if (gated.length) {
      // Keep stable-token lists fetched lazily in earlier sessions.
      const oldById = new Map(Object.values(discoveredChains).map(d => [d.chainId, d]));
      for (const d of gated) {
        const old = oldById.get(d.chainId);
        if (old && old.tokens) { d.tokens = old.tokens; d.tokensLoaded = true; }
      }
      chainsCache = { fetchedAt: Date.now(), chains: gated };
      try { localStorage.setItem(CHAINS_KEY, JSON.stringify(chainsCache)); } catch { /* full/blocked storage — run uncached */ }
      applyDiscovered(gated);
    }
  } catch { /* every source failed — the built-ins carry on regardless */ }
  discoveryRunning = false;
}
/** Lazily fetch a discovered chain's USDC/USDT (LI.FI) the first time it
 *  is selected; the result is cached on the entry, in the live registry
 *  and in local storage. Built-ins and already-loaded chains are no-ops. */
async function ensureStableTokens(key) {
  const d = discoveredChains[key];
  if (!d || d.tokensLoaded) return;
  const toks = await fetchStableTokens(d.chainId);
  if (toks === null) return; // lookup failed — leave unloaded so a later selection retries
  d.tokens = toks; d.tokensLoaded = true;
  if (NETWORKS[key]) NETWORKS[key].tokens = toks;
  try {
    const s = JSON.parse(localStorage.getItem(CHAINS_KEY) || "null");
    const rec = s && (s.chains || []).find(c => c.key === key);
    if (rec) { rec.tokens = toks; rec.tokensLoaded = true; localStorage.setItem(CHAINS_KEY, JSON.stringify(s)); chainsCache = s; }
  } catch { /* cache write is best-effort */ }
  if (key === networkKey) renderMain();
}
loadStoredChains();

// ---------- universal tokens: EVM discovery on the ACTIVE chain ----------
// Runs in the background after the base balances paint (renderMain).
// Custom tokens merge first (a handful of direct reads); then the
// active chain's LI.FI list is scanned for positive balances via
// Multicall3. Only the ACTIVE chain is ever scanned — never the whole
// universe. Scan results are session-cached per chain for 5 minutes;
// the LI.FI list itself is cached on-device for 24h (single slot: the
// most recent chain's list).
const evmScanCache = new Map(); // chainId -> { at, status, rows }
let evmHydrateSeq = 0;
async function lifiTokensForChain(chainId) {
  const cached = lifiCacheGet(chainId);
  if (cached) return cached;
  const list = await fetchLifiTokenList(chainId);
  if (list) lifiCacheSet(chainId, list);
  return list;
}
function mergeEvmRows(customRows, scannedRows) {
  const base = balances.filter(b => !b.custom && !b.scanned);
  const seen = new Set(base.map(b => (b.address || "").toLowerCase()));
  const extra = [];
  for (const r of [...customRows, ...scannedRows]) {
    const k = (r.address || "").toLowerCase();
    if (!k || seen.has(k)) continue; // curated/native identity wins; discovered rows never duplicate it
    seen.add(k);
    extra.push(r.custom ? r : { ...r, scanned: true });
  }
  balances = [...base, ...extra];
  paintAssets();
}
async function hydrateEvmTokens() {
  if (!wallet) return;
  const myKey = networkKey, chainId = NETWORKS[networkKey].chainId;
  const seq = ++evmHydrateSeq;
  const alive = () => seq === evmHydrateSeq && networkKey === myKey && !!wallet;
  // 1) Custom tokens: few, read directly, merged immediately.
  const customRows = [];
  for (const ct of loadCustomTokens(chainId)) {
    let amount = "0";
    try { amount = await getEvmTokenBalance(wallet, myKey, ct); } catch { /* row stays at 0 */ }
    customRows.push({ symbol: ct.symbol, name: ct.name, amount, address: ct.address, decimals: ct.decimals, custom: true, verified: false, priceUsd: null });
  }
  if (!alive()) return;
  const prev = evmScanCache.get(chainId);
  mergeEvmRows(customRows, (prev && prev.rows) || []);
  // 2) The chain's LI.FI list (24h on-device cache when it fits).
  const list = await lifiTokensForChain(chainId);
  if (!alive()) return;
  if (!list) { evmScanState = { key: myKey, status: "failed" }; paintAssets(); return; }
  const byAddr = new Map(list.map(t => [t.address.toLowerCase(), t]));
  for (const cr of customRows) {
    const t = byAddr.get(cr.address.toLowerCase());
    if (t) { cr.verified = lifiTokenVerified(t); if (t.priceUSD != null) cr.priceUsd = t.priceUSD; }
  }
  if (prev && prev.status === "done" && Date.now() - prev.at < 5 * 60 * 1000) {
    mergeEvmRows(customRows, prev.rows);
    evmScanState = { key: myKey, status: "done" };
    paintAssets();
    return;
  }
  // 3) The scan itself.
  evmScanState = { key: myKey, status: "scanning" };
  paintAssets();
  let scan;
  try { scan = await scanEvmTokenBalances(myKey, wallet.address, list); }
  catch {
    if (!alive()) return;
    evmScanCache.set(chainId, { at: Date.now(), status: "limited", rows: [] });
    evmScanState = { key: myKey, status: "limited" };
    paintAssets();
    return;
  }
  if (!alive()) return;
  const scannedRows = [];
  for (const [addrLower, raw] of scan.balances) {
    const t = byAddr.get(addrLower);
    if (!t) continue;
    scannedRows.push({ symbol: t.symbol, name: t.name, amount: formatTokenAmount(raw, t.decimals),
                       address: t.address, decimals: t.decimals, verified: lifiTokenVerified(t), priceUsd: t.priceUSD });
  }
  // 4) DexScreener prices for held rows no list could price.
  const unpriced = [...customRows, ...scannedRows].filter(r => r.priceUsd == null && Number(r.amount) > 0);
  const dexId = dexChainIdForEvmChain(chainId);
  if (unpriced.length && dexId) {
    const info = await getDexScreenerTokenInfo(dexId, unpriced.map(r => r.address));
    if (!alive()) return;
    for (const r of unpriced) {
      const d = info.get(r.address);
      if (d && d.priceUsd != null) r.priceUsd = d.priceUsd;
    }
  }
  evmScanCache.set(chainId, { at: Date.now(), status: "done", rows: scannedRows });
  mergeEvmRows(customRows, scannedRows);
  evmScanState = { key: myKey, status: "done" };
  paintAssets();
}

// ---------- custom token add (by contract address, read from chain) ----------
function openAddTokenSheet() {
  const net = NETWORKS[networkKey], chainId = net.chainId;
  openSheet(`<h3>Add a token on ${esc(net.name)}</h3>
    <p class="tag">Paste any ERC-20 contract address on this network. Fluid reads its name, symbol and decimals straight from the contract — nothing is taken on trust from a list. A token added this way is marked ⚠ unverified unless a verified list also knows it.</p>
    <input id="ctAddr" placeholder="Contract address 0x…" autocapitalize="none">
    <button class="btn" id="ctLookup">Look up token</button>
    <div id="ctInfo"></div>
    <p class="msg err" id="ctMsg"></p>`);
  $("ctLookup").onclick = async () => {
    const addr = $("ctAddr").value.trim();
    try {
      msg("ctMsg", "Reading the contract…", true);
      $("ctInfo").innerHTML = "";
      const meta = await readEvmTokenMeta(networkKey, addr, wallet.address);
      const exists = loadCustomTokens(chainId).some(ct => ct.address.toLowerCase() === meta.address.toLowerCase());
      $("ctInfo").innerHTML = `<p class="seed" style="margin-top:10px">${esc(meta.name)} (${esc(meta.symbol)}) · ${meta.decimals} decimals<br>Your balance: ${fmt(meta.balance)} ${esc(meta.symbol)}<br><span style="font-size:11px">${esc(meta.address)}</span></p>
        ${exists
          ? `<button class="btn danger" id="ctRemove">Remove this token</button>`
          : `<button class="btn" id="ctAdd">Add this token</button>`}`;
      msg("ctMsg", "");
      const addBtn = $("ctAdd"), rmBtn = $("ctRemove");
      if (addBtn) addBtn.onclick = () => {
        saveCustomToken(chainId, { address: meta.address, symbol: meta.symbol, name: meta.name, decimals: meta.decimals });
        closeSheet(); hydrateEvmTokens();
      };
      if (rmBtn) rmBtn.onclick = () => {
        removeCustomToken(chainId, meta.address);
        closeSheet(); hydrateEvmTokens();
      };
    } catch (e) { msg("ctMsg", e.message); }
  };
}

// ---------- network sheet ----------
async function selectNetwork(key) {
  if (!NETWORKS[key] || key === networkKey) { closeSheet(); return; }
  const d = discoveredChains[key];
  if (d) {
    msg("netMsg", `Checking ${d.name}…`, true);
    if (!(await probeChain(d))) return msg("netMsg", "That network didn't answer correctly — not switching.");
    networkKey = key; closeSheet(); renderMain();
    ensureStableTokens(key);
    return;
  }
  networkKey = key; closeSheet(); renderMain();
}
$("netBtn").onclick = () => {
  openSheet(`<h3>Choose network</h3>
    <input id="netSearch" placeholder="Search networks…" autocapitalize="none">
    <div id="netList"></div>
    <p class="msg err" id="netMsg"></p>`);
  const paint = () => {
    const q = $("netSearch").value.trim().toLowerCase();
    const item = (k, label, sub) =>
      `<button class="netitem" data-net="${k}"><span>${label}${sub ? ` <small style="color:var(--dim)">${sub}</small>` : ""}</span>${k === networkKey ? '<span class="pill">ACTIVE</span>' : ""}</button>`;
    let html = BUILTIN_NETWORK_KEYS
      .filter(k => !q || NETWORKS[k].name.toLowerCase().includes(q))
      .map(k => item(k, NETWORKS[k].name)).join("");
    // Display-tier chains are listed outright; discoverable-tier chains
    // surface as soon as the user starts searching.
    const disc = Object.values(discoveredChains).filter(d =>
      (q ? true : d.tier === "display") &&
      (!q || d.name.toLowerCase().includes(q) || d.symbol.toLowerCase() === q));
    if (disc.length) {
      html += `<p class="tag" style="margin:12px 0 4px">More networks — discovered automatically, checked live before switching</p>` +
        disc.map(d => item(d.key, d.name, d.symbol)).join("");
    }
    $("netList").innerHTML = html || `<p class="tag">No networks match.</p>`;
    document.querySelectorAll("[data-net]").forEach(b => b.onclick = () => selectNetwork(b.dataset.net));
  };
  $("netSearch").addEventListener("input", paint);
  paint();
};

// ---------- receive ----------
function qr(el, text) { QRCode.toDataURL(text, { width: 180, margin: 1 }).then(u => { const i = $(el); if (i) i.src = u; }).catch(() => {}); }
$("actReceive").onclick = () => {
  // Selector + search, not a scroll: one panel per network (the exact
  // blocks the old list stacked — same labels, QR ids, copy buttons and
  // state notes), and only the selected network's panel is in the sheet.
  // Entries + alias matching live in wallet-core (RECEIVE_NETWORKS) so the
  // search behaviour is unit-tested.
  const panels = {
    evm: `<p class="tag">EVM address — the same on all 15 networks:</p>
      <img class="qr" id="qrEvm"><p class="mono">${wallet.address}</p>
      <button class="btn ghost" id="cpEvm">Copy EVM address</button>`,
    bitcoin: `<p class="tag">Bitcoin address:</p>
      <img class="qr" id="qrBtc"><p class="mono">${btcAddr}</p>
      <button class="btn ghost" id="cpBtc">Copy Bitcoin address</button>`,
    lightning: `<div id="rcvLnSlot"><p class="tag">Checking your Fluid name for a Lightning address…</p></div>
      <p class="tag">Fluid never custodies Lightning funds — Lightning runs through your own Lightning wallet (WebLN / LNURL-pay). Anyone can pay the Lightning address registered to your Fluid name, or your name itself.</p>`,
    tron: `<p class="tag">Tron address (TRX and TRC20 tokens):</p>
      <img class="qr" id="qrTron"><p class="mono">${tronAddr}</p>
      <button class="btn ghost" id="cpTron">Copy Tron address</button>`,
    solana: `<p class="tag">Solana address (SOL and SPL tokens):</p>
      <img class="qr" id="qrSol"><p class="mono">${solAddr}</p>
      <button class="btn ghost" id="cpSol">Copy Solana address</button>`,
    sui: `<p class="tag">Sui address (SUI and Sui coins):</p>
      <img class="qr" id="qrSui"><p class="mono">${suiAddr}</p>
      <button class="btn ghost" id="cpSui">Copy Sui address</button>`,
    stellar: `<p class="tag">Stellar address (XLM and Stellar assets):</p>
      <img class="qr" id="qrStellar"><p class="mono">${stellarAddr}</p>
      <button class="btn ghost" id="cpStellar">Copy Stellar address</button>
      ${stellarFunded === false ? `<p class="tag">This account isn't activated yet — it activates when it first receives at least 1 XLM.</p>` : ""}`,
    ton: `<p class="tag">TON address (TON and jettons like USDT):</p>
      <img class="qr" id="qrTon"><p class="mono">${tonAddr}</p>
      <button class="btn ghost" id="cpTon">Copy TON address</button>
      ${tonState && tonState !== "active" ? `<p class="tag">This wallet deploys automatically with your first send — receiving works right away.</p>` : ""}`,
    near: `<p class="tag">NEAR address (implicit account — NEAR and NEP-141 tokens):</p>
      <img class="qr" id="qrNear"><p class="mono">${nearAddr}</p>
      <button class="btn ghost" id="cpNear">Copy NEAR address</button>
      ${nearExists === false ? `<p class="tag">This account is created when it first receives at least 0.00182 NEAR.</p>` : ""}`,
    algorand: `<p class="tag">Algorand address (ALGO and ASAs like USDC):</p>
      <img class="qr" id="qrAlgo"><p class="mono">${algoAddr}</p>
      <button class="btn ghost" id="cpAlgo">Copy Algorand address</button>`,
    xrpl: `<p class="tag">XRP Ledger address (XRP and trust-line tokens):</p>
      <img class="qr" id="qrXrp"><p class="mono">${xrpAddr}</p>
      <button class="btn ghost" id="cpXrp">Copy XRP Ledger address</button>
      ${xrpFunded === false ? `<p class="tag">This account activates when it first receives at least the network base reserve (1 XRP).</p>` : ""}`,
    polkadot: `<p class="tag">Polkadot Asset Hub address (DOT, USDC, USDT on Asset Hub):</p>
      <img class="qr" id="qrDot"><p class="mono">${dotAddr}</p>
      <button class="btn ghost" id="cpDot">Copy Polkadot address</button>`,
    aptos: `<p class="tag">Aptos address (APT, USDC, USDt and other Aptos assets):</p>
      <img class="qr" id="qrAptos"><p class="mono">${aptosAddr}</p>
      <button class="btn ghost" id="cpAptos">Copy Aptos address</button>
      ${aptosExists === false ? `<p class="tag">This account isn't created yet — it is created when it first receives APT.</p>` : ""}`,
    stacks: `<p class="tag">Stacks address (STX, sBTC, USDA and other Stacks assets):</p>
      <img class="qr" id="qrStacks"><p class="mono">${stacksAddr}</p>
      <button class="btn ghost" id="cpStacks">Copy Stacks address</button>`,
    litecoin: `<p class="tag">Litecoin address:</p>
      <img class="qr" id="qrLtc"><p class="mono">${ltcAddr}</p>
      <button class="btn ghost" id="cpLtc">Copy Litecoin address</button>`,
    dogecoin: `<p class="tag">Dogecoin address:</p>
      <img class="qr" id="qrDoge"><p class="mono">${dogeAddr}</p>
      <button class="btn ghost" id="cpDoge">Copy Dogecoin address</button>`,
    bitcoincash: `<p class="tag">Bitcoin Cash address:</p>
      <img class="qr" id="qrBch"><p class="mono">${bchAddr}</p>
      <button class="btn ghost" id="cpBch">Copy Bitcoin Cash address</button>`,
  };
  // Cosmos: seven prefixes (six over one shared account, Injective on the
  // Keplr path) — one panel per chain, as the family's own sheets show.
  for (const c of COSMOS_CHAINS) {
    panels[c.key] = `<p class="tag">${c.name} address (${c.symbol}):</p>
      <img class="qr" id="qrCosmos_${c.key}"><p class="mono">${cosmosAddrs[c.key]}</p>
      <button class="btn ghost" data-cpcosmos="${c.key}">Copy ${c.name} address</button>
      <p class="tag">${c.key === "injective"
        ? "Injective uses the standard Keplr path, so this address matches Keplr/Leap for the same phrase. Send each coin only on its own chain."
        : "One Cosmos account on six chains — only the prefix differs; this is its " + c.name + " form. Send each coin only on its own chain."}</p>`;
  }
  const binds = {
    evm: () => { qr("qrEvm", wallet.address); $("cpEvm").onclick = () => copyText(wallet.address, $("cpEvm")); },
    bitcoin: () => { qr("qrBtc", btcAddr); $("cpBtc").onclick = () => copyText(btcAddr, $("cpBtc")); },
    lightning: () => {
      const paintLn = (ln, name) => {
        const slot = $("rcvLnSlot"); if (!slot) return; // sheet has moved on
        if (ln) {
          slot.innerHTML = `<p class="tag">Your Lightning address${name ? ` (registered to ${esc(name)}.${FLUID_DOMAIN})` : ""}:</p>
            <img class="qr" id="qrLn"><p class="mono">${esc(ln)}</p>
            <button class="btn ghost" id="cpLn">Copy Lightning address</button>`;
          qr("qrLn", ln);
          $("cpLn").onclick = () => copyText(ln, $("cpLn"));
        } else {
          slot.innerHTML = `<p class="tag">No Lightning address is registered to your Fluid name yet — add one under “Your Fluid name” in the More tab and it will show here.</p>`;
        }
      };
      const myName = localStorage.getItem("fluid_name");
      if (!myName) return paintLn(null);
      resolveFluidName(myName).then(hit => paintLn(hit && hit.ln, myName)).catch(() => paintLn(null, myName));
    },
    tron: () => { qr("qrTron", tronAddr); $("cpTron").onclick = () => copyText(tronAddr, $("cpTron")); },
    solana: () => { qr("qrSol", solAddr); $("cpSol").onclick = () => copyText(solAddr, $("cpSol")); },
    sui: () => { qr("qrSui", suiAddr); $("cpSui").onclick = () => copyText(suiAddr, $("cpSui")); },
    stellar: () => { qr("qrStellar", stellarAddr); $("cpStellar").onclick = () => copyText(stellarAddr, $("cpStellar")); },
    ton: () => { qr("qrTon", tonAddr); $("cpTon").onclick = () => copyText(tonAddr, $("cpTon")); },
    near: () => { qr("qrNear", nearAddr); $("cpNear").onclick = () => copyText(nearAddr, $("cpNear")); },
    algorand: () => { qr("qrAlgo", algoAddr); $("cpAlgo").onclick = () => copyText(algoAddr, $("cpAlgo")); },
    xrpl: () => { qr("qrXrp", xrpAddr); $("cpXrp").onclick = () => copyText(xrpAddr, $("cpXrp")); },
    polkadot: () => { qr("qrDot", dotAddr); $("cpDot").onclick = () => copyText(dotAddr, $("cpDot")); },
    aptos: () => { qr("qrAptos", aptosAddr); $("cpAptos").onclick = () => copyText(aptosAddr, $("cpAptos")); },
    stacks: () => { qr("qrStacks", stacksAddr); $("cpStacks").onclick = () => copyText(stacksAddr, $("cpStacks")); },
    litecoin: () => { qr("qrLtc", ltcAddr); $("cpLtc").onclick = () => copyText(ltcAddr, $("cpLtc")); },
    dogecoin: () => { qr("qrDoge", dogeAddr); $("cpDoge").onclick = () => copyText(dogeAddr, $("cpDoge")); },
    bitcoincash: () => { qr("qrBch", bchAddr); $("cpBch").onclick = () => copyText(bchAddr, $("cpBch")); },
  };
  for (const c of COSMOS_CHAINS) {
    binds[c.key] = () => {
      qr("qrCosmos_" + c.key, cosmosAddrs[c.key]);
      document.querySelectorAll("[data-cpcosmos]").forEach(b => b.onclick = () => copyText(cosmosAddrs[b.dataset.cpcosmos], b));
    };
  }
  // Default: the context the user came from — the active network is an
  // EVM chain, whose receive entry is the shared EVM panel.
  let selected = "evm";
  openSheet(`<h3>Receive</h3>
    <input id="rcvSearch" placeholder="Search networks…" autocapitalize="none">
    <div id="rcvPanel"></div>
    <hr style="border-color:var(--line)">
    <div id="rcvList" style="max-height:38dvh;overflow-y:auto"></div>`);
  const paintPanel = () => {
    const host = $("rcvPanel"); if (!host) return;
    host.innerHTML = panels[selected] || "";
    if (binds[selected]) binds[selected]();
  };
  const paintList = () => {
    const host = $("rcvList"); if (!host) return;
    const hits = filterReceiveNetworks($("rcvSearch").value);
    host.innerHTML = hits.length
      ? hits.map(m => `<button class="netitem" data-rcv="${m.id}"><span>${esc(m.name)}${m.sub ? ` <small style="color:var(--dim)">${esc(m.sub)}</small>` : ""}</span>${m.id === selected ? '<span class="pill">SHOWING</span>' : ""}</button>`).join("")
      : `<p class="tag">No networks match.</p>`;
    document.querySelectorAll("[data-rcv]").forEach(b => b.onclick = () => {
      selected = b.dataset.rcv;
      paintPanel(); paintList();
      const p = $("rcvPanel"); if (p) p.scrollIntoView({ block: "nearest" });
    });
  };
  $("rcvSearch").addEventListener("input", paintList);
  paintPanel();
  paintList();
};

// ---------- send (EVM) ----------
$("actSend").onclick = () => {
  openSheet(`<h3>Send on ${NETWORKS[networkKey].name}</h3>
    <select id="sToken">${balances.map((b, i) => `<option value="${i}">${b.verified === false ? "⚠ " : ""}${esc(b.symbol)} — ${fmt(b.amount)}</option>`).join("")}</select>
    <input id="sTo" placeholder="Recipient 0x… address or Fluid name (e.g. kemi)">
    <input id="sAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="sReview">Review send</button>
    <div id="sIntent" class="hidden">
      <p class="seed" id="sIntentText"></p>
      <button class="btn" id="sConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="sMsg"></p>
    <p class="tag">For Bitcoin, tap the Bitcoin row instead.</p>`);
  $("sReview").onclick = async () => {
    let to = $("sTo").value.trim();
    let sendName = null;
    const amount = $("sAmt").value.trim(), b = balances[Number($("sToken").value)];
    if (to && !/^0x[0-9a-fA-F]{40}$/.test(to)) {
      msg("sMsg", "Resolving Fluid name…", true);
      const hit = await resolveFluidName(to).catch(() => null);
      if (!hit || !hit.evm) return msg("sMsg", "That Fluid name is not in the registry yet.");
      to = hit.evm; sendName = hit.name;
      msg("sMsg", hit.name + "." + FLUID_DOMAIN + " → " + to.slice(0, 10) + "…", true);
    }
    const resolvedNote = sendName ? sendName + "." + FLUID_DOMAIN + " → " + to.slice(0, 10) + "… · " : "";
    // Address-poisoning check (raw addresses only — Fluid names are verified
    // against the registry): warn if the recipient imitates an address the
    // user knows (own address or a past recipient). Never a hard block.
    let poisonNote = "";
    if (!sendName && /^0x[0-9a-fA-F]{40}$/.test(to)) {
      const known = [wallet.address, ...JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").map(x => x.to).filter(Boolean)];
      const look = looksLikePoison(to, known);
      if (look) poisonNote = `⚠ This address starts and ends like ${look.slice(0, 6)}…${look.slice(-4)} which you've used before, but it is NOT the same address — this is how address-poisoning scams work. Double-check every character.`;
    }
    const warnPrefix = poisonNote ? poisonNote + " " : "";
    if (!b || !amount || Number(amount) <= 0) return msg("sMsg", warnPrefix + resolvedNote + "Enter an amount.");
    if (Number(amount) > Number(b.amount)) return msg("sMsg", warnPrefix + resolvedNote + "Amount is more than your balance.");
    try {
      msg("sMsg", "Estimating fee…", true);
      const fee = await estimateSend(wallet, networkKey, { to, amount, token: b.address ? b : null });
      pendingSend = { to, amount, token: b.address ? b : null, symbol: b.symbol, name: sendName };
      $("sIntentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: Number(fee).toFixed(6), name: sendName })
        + (b.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("sIntent"); msg("sMsg", poisonNote);
    } catch (e) { msg("sMsg", warnPrefix + "Could not estimate: " + (e.shortMessage || e.message)); }
  };
  $("sConfirm").onclick = async () => {
    if (!pendingSend) return;
    try {
      msg("sMsg", "Sending…", true);
      const tx = await executeSend(wallet, networkKey, pendingSend);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: tx.hash, amount: pendingSend.amount, symbol: pendingSend.symbol, to: pendingSend.to, explorer: NETWORKS[networkKey].explorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingSend = null; closeSheet(); renderMain();
    } catch (e) { msg("sMsg", "Send failed: " + (e.shortMessage || e.message)); }
  };
};

// ---------- Bitcoin sheet ----------
// Mirrors the other family sheets: review → human-readable sentence →
// confirm, all in-app. No native confirm() dialog here — those get
// swallowed in some phone webviews and make the button look dead.
function openBtcSheet() {
  let pendingBtc = null;
  openSheet(`<h3>Bitcoin</h3>
    <p><b>${fmt(btcBal, 8)} BTC</b> · ${usd(btcBal * (prices.BTC || 0))}</p>
    <img class="qr" id="qrBtc2"><p class="mono">${btcAddr}</p>
    <button class="btn ghost" id="cpBtc2">Copy address</button>
    <hr style="border-color:var(--line)">
    <h3>Send BTC</h3>
    <input id="bTo" placeholder="Recipient bc1… address or Fluid name">
    <input id="bAmt" inputmode="decimal" placeholder="Amount in BTC">
    <button class="btn" id="bSend">Review &amp; send BTC</button>
    <div id="bIntent" class="hidden">
      <p class="seed" id="bIntentText"></p>
      <button class="btn" id="bConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="bMsg"></p>
    <p class="tag">Fee uses the current recommended network rate (mempool.space). Sends are final.</p>`);
  qr("qrBtc2", btcAddr);
  $("cpBtc2").onclick = () => copyText(btcAddr, $("cpBtc2"));
  $("bSend").onclick = async () => {
    let to = $("bTo").value.trim();
    let sendName = null;
    const amount = Number($("bAmt").value);
    if (to && !to.startsWith("bc1")) {
      const hit = await resolveFluidName(to).catch(() => null);
      if (!hit || !hit.btc) return msg("bMsg", "That Fluid name has no Bitcoin address in the registry.");
      to = hit.btc; sendName = hit.name;
    }
    if (!to || !amount || amount <= 0) return msg("bMsg", "Enter a recipient and amount.");
    pendingBtc = { to, amount };
    // Same disclosure as formatSendIntent: when the recipient was given
    // as a Fluid name, the sentence shows the name AND the address it
    // resolved to — the user confirms the resolution, not just the name.
    const dest = sendName ? `${sendName}.${FLUID_DOMAIN} (${to.slice(0, 10)}…${to.slice(-6)})` : to;
    $("bIntentText").textContent = `Send ${amount} BTC to ${dest} on Bitcoin. Network fee will be added at the current rate. Confirm?`;
    show("bIntent"); msg("bMsg", "");
  };
  $("bConfirm").onclick = async () => {
    if (!pendingBtc) return;
    try {
      msg("bMsg", "Building, signing and broadcasting…", true);
      const txid = await sendBitcoin(wallet.mnemonic.phrase, { to: pendingBtc.to, amountBtc: pendingBtc.amount });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingBtc.amount, symbol: "BTC", to: pendingBtc.to, explorer: "https://mempool.space", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingBtc = null;
      msg("bMsg", "Broadcast ✓ txid " + txid.slice(0, 16) + "…", true);
      renderMain();
    } catch (e) { msg("bMsg", e.message); }
  };
}

// ---------- Tron sheet ----------
// Mirrors the EVM send sheet: review → human-readable sentence → confirm.
// The transaction is built by TronGrid but signed locally by sendTron.
function openTronSheet(tok) {
  let pendingTron = null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Tron</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${tronAddr}</span></p>
    <input id="tTo" placeholder="Recipient T… address" autocapitalize="none">
    <input id="tAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="tReview">Review send</button>
    <div id="tIntent" class="hidden">
      <p class="seed" id="tIntentText"></p>
      <button class="btn" id="tConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="tMsg"></p>
    <p class="tag">${tok.address
      ? "Token sends burn a little TRX for energy — keep some TRX in this wallet."
      : "Tron network fees are paid in TRX (bandwidth/energy). Sends are final."}</p>`);
  $("tReview").onclick = () => {
    const to = $("tTo").value.trim(), amount = $("tAmt").value.trim();
    if (!isValidTronAddress(to)) return msg("tMsg", "That is not a valid Tron address (it starts with T).");
    if (!amount || Number(amount) <= 0) return msg("tMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("tMsg", "Amount is more than your balance.");
    pendingTron = { to, amount };
    $("tIntentText").textContent = formatTronSendIntent({ amount, symbol: tok.symbol, to })
      + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
    show("tIntent"); msg("tMsg", "");
  };
  $("tConfirm").onclick = async () => {
    if (!pendingTron) return;
    try {
      msg("tMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendTron(wallet, {
        to: pendingTron.to, amount: pendingTron.amount,
        token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingTron.amount, symbol: tok.symbol, to: pendingTron.to,
        link: `https://tronscan.org/#/transaction/${hash}`, explorer: "https://tronscan.org", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingTron = null; closeSheet(); renderMain();
    } catch (e) { msg("tMsg", "Send failed: " + e.message); }
  };
}

// ---------- Solana sheet ----------
// Mirrors the Tron sheet: review → human-readable sentence → confirm.
// Transactions are built and signed locally by sendSolana; only the
// finished bytes touch the network.
function openSolanaSheet(tok) {
  let pendingSol = null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Solana</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${solAddr}</span></p>
    <input id="oTo" placeholder="Recipient Solana address" autocapitalize="none">
    <input id="oAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="oReview">Review send</button>
    <div id="oIntent" class="hidden">
      <p class="seed" id="oIntentText"></p>
      <button class="btn" id="oConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="oMsg"></p>
    <p class="tag">${tok.address
      ? "Token sends pay a small SOL fee. If the recipient has no " + esc(tok.symbol) + " account yet, one is created for them and you pay about 0.002 SOL rent for it — the review sentence tells you when that applies."
      : "A Solana account must always keep at least 0.00089 SOL (the rent-exempt minimum) or be emptied completely — sends that would strand less than that are blocked. Sends are final."}</p>`);
  $("oReview").onclick = async () => {
    const to = $("oTo").value.trim(), amount = $("oAmt").value.trim();
    if (!isValidSolanaAddress(to)) return msg("oMsg", "That is not a valid Solana address.");
    if (!amount || Number(amount) <= 0) return msg("oMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("oMsg", "Amount is more than your balance.");
    try {
      msg("oMsg", "Checking the recipient…", true);
      const plan = tok.address ? await solanaSendPlan(solAddr, { to, token: tok }) : { createsAta: false };
      pendingSol = { to, amount };
      $("oIntentText").textContent = formatSolanaSendIntent({ amount, symbol: tok.symbol, to, createsAta: plan.createsAta })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("oIntent"); msg("oMsg", "");
    } catch (e) { msg("oMsg", "Could not check the recipient: " + e.message); }
  };
  $("oConfirm").onclick = async () => {
    if (!pendingSol) return;
    try {
      msg("oMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendSolana(wallet.mnemonic.phrase, {
        to: pendingSol.to, amount: pendingSol.amount,
        token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingSol.amount, symbol: tok.symbol, to: pendingSol.to,
        link: `${SOLANA_EXPLORER}/tx/${hash}`, explorer: SOLANA_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingSol = null; closeSheet(); renderMain();
    } catch (e) { msg("oMsg", "Send failed: " + e.message); }
  };
}

// ---------- Sui sheet ----------
// Mirrors the Solana sheet: review → human-readable sentence → confirm.
// Transactions are built with the Sui SDK but signed locally by sendSui
// (intent signing with the wallet's derived Ed25519 key); only the
// signed transaction touches the network.
function openSuiSheet(tok) {
  let pendingSui = null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Sui</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${suiAddr}</span></p>
    <input id="uTo" placeholder="Recipient Sui address (0x…)" autocapitalize="none">
    <input id="uAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="uReview">Review send</button>
    <div id="uIntent" class="hidden">
      <p class="seed" id="uIntentText"></p>
      <button class="btn" id="uConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="uMsg"></p>
    <p class="tag">${tok.address
      ? "Token sends pay a small SUI fee — keep some SUI in this wallet."
      : "Sui network fees are paid in SUI and are tiny (about 0.001 SUI). Sends are final."}</p>`);
  $("uReview").onclick = () => {
    const to = $("uTo").value.trim(), amount = $("uAmt").value.trim();
    if (!isValidSuiAddress(to)) return msg("uMsg", "That is not a valid Sui address (0x + hex).");
    if (!amount || Number(amount) <= 0) return msg("uMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("uMsg", "Amount is more than your balance.");
    pendingSui = { to, amount };
    $("uIntentText").textContent = formatSuiSendIntent({ amount, symbol: tok.symbol, to })
      + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
    show("uIntent"); msg("uMsg", "");
  };
  $("uConfirm").onclick = async () => {
    if (!pendingSui) return;
    try {
      msg("uMsg", "Signing locally and executing…", true);
      const { hash } = await sendSui(wallet.mnemonic.phrase, {
        to: pendingSui.to, amount: pendingSui.amount,
        token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingSui.amount, symbol: tok.symbol, to: pendingSui.to,
        link: `${SUI_EXPLORER}/mainnet/tx/${hash}`, explorer: SUI_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingSui = null; closeSheet(); renderMain();
    } catch (e) { msg("uMsg", "Send failed: " + e.message); }
  };
}

// ---------- Stellar sheet ----------
// Mirrors the Sui sheet: review → human-readable sentence → confirm.
// The review pre-flights the destination's state (activation +
// trustline) via stellarSendPlan so the sentence can say what will
// happen; sendStellar re-enforces every rule in code before signing.
function openStellarSheet(tok) {
  if (tok.lpShare) {
    openSheet(`<h3>Stellar liquidity pool shares</h3>
      <p><b>${fmt(tok.amount)} shares</b> · from <span class="mono">${stellarAddr}</span></p>
      <p class="tag">These are shares in a Stellar liquidity pool. Fluid shows them so nothing you hold is hidden, but they can't be sent from Fluid yet — withdraw them from the pool with a Stellar tool that supports liquidity pools.</p>`);
    return;
  }
  if (stellarFunded === false) {
    openSheet(`<h3>Stellar</h3>
      <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · <span class="mono">${stellarAddr}</span></p>
      <p class="tag">Account not yet activated — Stellar accounts only exist once they hold XLM. Receive at least 1 XLM at this address to activate it; then you can send.</p>`);
    return;
  }
  let pendingStellar = null;
  const assetTok = tok.address ? { code: tok.assetCode, issuer: tok.issuer } : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Stellar</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${stellarAddr}</span></p>
    ${tok.address ? `<p class="tag">Issuer <span class="mono">${esc(tok.issuer)}</span></p>` : ""}
    <input id="stTo" placeholder="Recipient Stellar address (G…)" autocapitalize="none">
    <input id="stAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="stReview">Review send</button>
    <div id="stIntent" class="hidden">
      <p class="seed" id="stIntentText"></p>
      <button class="btn" id="stConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="stMsg"></p>
    <p class="tag">${tok.address
      ? "The recipient must already hold a trustline for this asset — Stellar accounts can only receive assets they have opted into. Sends are final."
      : "Stellar fees are paid in XLM and are tiny. Your account must always keep its minimum XLM reserve. Sends are final."}</p>`);
  $("stReview").onclick = async () => {
    const to = $("stTo").value.trim(), amount = $("stAmt").value.trim();
    if (!isValidStellarAddress(to)) return msg("stMsg", "That is not a valid Stellar address (it starts with G).");
    if (!amount || Number(amount) <= 0) return msg("stMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("stMsg", "Amount is more than your balance.");
    try {
      msg("stMsg", "Checking the recipient…", true);
      const plan = await stellarSendPlan(stellarAddr, { to, token: assetTok });
      if (assetTok) {
        if (plan.destFunded === false) return msg("stMsg", `The recipient's Stellar account isn't activated yet, so it can't hold ${tok.symbol} yet. They need to receive at least 1 XLM first.`);
        if (plan.destHasTrustline === false) return msg("stMsg", `The recipient can't receive ${tok.symbol} yet — they have no trustline for it. On Stellar, an account can only hold an asset it has opted into with a trustline.`);
      } else if (plan.destFunded === false && Number(amount) < 1) {
        return msg("stMsg", "That account doesn't exist yet — creating it needs a starting balance of at least 1 XLM.");
      }
      pendingStellar = { to, amount };
      $("stIntentText").textContent = formatStellarSendIntent({
        amount, symbol: tok.symbol, to, feeXlm: plan.feeXlm,
        createsAccount: !assetTok && plan.destFunded === false,
      }) + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("stIntent"); msg("stMsg", "");
    } catch (e) { msg("stMsg", "Could not check the recipient: " + e.message); }
  };
  $("stConfirm").onclick = async () => {
    if (!pendingStellar) return;
    try {
      msg("stMsg", "Signing locally and submitting…", true);
      const { hash } = await sendStellar(wallet.mnemonic.phrase, {
        to: pendingStellar.to, amount: pendingStellar.amount, token: assetTok,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingStellar.amount, symbol: tok.symbol, to: pendingStellar.to,
        link: `${STELLAR_EXPLORER}/tx/${hash}`, explorer: STELLAR_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingStellar = null; closeSheet(); renderMain();
    } catch (e) { msg("stMsg", "Send failed: " + e.message); }
  };
}

// ---------- TON sheet (Phase 4) ----------
// Mirrors the Stellar sheet: review → human-readable sentence →
// confirm. sendTon re-enforces every rule in code before signing
// (balance minus the disclosed fee reserve; jetton wallet must
// exist). TON's broadcast returns the external message hash, which
// is not a tonviewer transaction id — the history link points at
// the wallet's own page, where the transfer appears.
function openTonSheet(tok) {
  let pendingTon = null;
  const tokenArg = tok.address ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on TON</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${tonAddr}</span></p>
    ${tok.address ? `<p class="tag">Jetton master <span class="mono">${esc(tok.address)}</span></p>` : ""}
    <input id="tnTo" placeholder="Recipient TON address (EQ… / UQ…)" autocapitalize="none">
    <input id="tnAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="tnReview">Review send</button>
    <div id="tnIntent" class="hidden">
      <p class="seed" id="tnIntentText"></p>
      <button class="btn" id="tnConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="tnMsg"></p>
    <p class="tag">TON fees come out of your TON balance — about 0.05 TON is set aside per send and what isn't used comes back. Sends are final.</p>`);
  $("tnReview").onclick = async () => {
    const to = $("tnTo").value.trim(), amount = $("tnAmt").value.trim();
    if (!isValidTonAddress(to)) return msg("tnMsg", "That is not a valid TON address.");
    if (!amount || Number(amount) <= 0) return msg("tnMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("tnMsg", "Amount is more than your balance.");
    try {
      msg("tnMsg", "Checking your wallet…", true);
      await tonSendPlan(tonAddr, { token: tokenArg });
      pendingTon = { to, amount };
      $("tnIntentText").textContent = formatTonSendIntent({ amount, symbol: tok.symbol, to, isJetton: !!tokenArg })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("tnIntent"); msg("tnMsg", "");
    } catch (e) { msg("tnMsg", "Could not check: " + e.message); }
  };
  $("tnConfirm").onclick = async () => {
    if (!pendingTon) return;
    try {
      msg("tnMsg", "Signing locally and submitting…", true);
      const { hash } = await sendTon(wallet.mnemonic.phrase, { to: pendingTon.to, amount: pendingTon.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingTon.amount, symbol: tok.symbol, to: pendingTon.to,
        link: `${TON_EXPLORER}/address/${tonAddr}`, explorer: TON_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingTon = null; closeSheet(); renderMain();
    } catch (e) { msg("tnMsg", "Send failed: " + e.message); }
  };
}

// ---------- NEAR sheet (Phase 4) ----------
// Review pre-flights the recipient (existence + token registration)
// via nearSendPlan so the sentence can say when a send creates the
// recipient's account or pays their token registration; sendNear
// re-enforces every rule (storage minimums) in code before signing.
function openNearSheet(tok) {
  if (nearExists === false) {
    openSheet(`<h3>NEAR</h3>
      <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · <span class="mono">${nearAddr}</span></p>
      <p class="tag">Your NEAR account doesn't exist yet — NEAR accounts are created by their first transfer. Receive at least 0.00182 NEAR at this address to create it; then you can send.</p>`);
    return;
  }
  let pendingNear = null;
  const tokenArg = tok.address ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on NEAR</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${nearAddr}</span></p>
    ${tok.address ? `<p class="tag">Token contract <span class="mono">${esc(tok.address)}</span></p>` : ""}
    <input id="nrTo" placeholder="Recipient NEAR account (name.near or 64-hex)" autocapitalize="none">
    <input id="nrAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="nrReview">Review send</button>
    <div id="nrIntent" class="hidden">
      <p class="seed" id="nrIntentText"></p>
      <button class="btn" id="nrConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="nrMsg"></p>
    <p class="tag">${tok.address
      ? "The recipient must have a NEAR account; if they aren't registered for this token yet, a small NEAR storage deposit from your balance registers them in the same transaction. Sends are final."
      : "Your account must always keep the NEAR it holds for storage — Fluid stops any send that would zero it below that minimum. Sends are final."}</p>`);
  $("nrReview").onclick = async () => {
    const to = $("nrTo").value.trim(), amount = $("nrAmt").value.trim();
    if (!isValidNearAddress(to)) return msg("nrMsg", "That is not a valid NEAR account id.");
    if (!amount || Number(amount) <= 0) return msg("nrMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("nrMsg", "Amount is more than your balance.");
    try {
      msg("nrMsg", "Checking the recipient…", true);
      const plan = await nearSendPlan(nearAddr, { to, token: tokenArg });
      if (tokenArg) {
        if (plan.destExists === false) return msg("nrMsg", "The recipient's NEAR account doesn't exist yet, so it can't hold tokens. They need a NEAR account first.");
      } else if (plan.destExists === false && !/^[0-9a-fA-F]{64}$/.test(to)) {
        return msg("nrMsg", "That NEAR account doesn't exist — a plain transfer can't create a named account. Check the account id.");
      }
      pendingNear = { to, amount };
      $("nrIntentText").textContent = formatNearSendIntent({
        amount, symbol: tok.symbol, to,
        createsAccount: !tokenArg && plan.destExists === false,
        registerCostNear: tokenArg ? plan.registerNear : null,
      }) + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("nrIntent"); msg("nrMsg", "");
    } catch (e) { msg("nrMsg", "Could not check the recipient: " + e.message); }
  };
  $("nrConfirm").onclick = async () => {
    if (!pendingNear) return;
    try {
      msg("nrMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendNear(wallet.mnemonic.phrase, { to: pendingNear.to, amount: pendingNear.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingNear.amount, symbol: tok.symbol, to: pendingNear.to,
        link: `${NEAR_EXPLORER}/txns/${hash}`, explorer: NEAR_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingNear = null; closeSheet(); renderMain();
    } catch (e) { msg("nrMsg", "Send failed: " + e.message); }
  };
}

// ---------- Algorand sheet (Phase 4) ----------
// Review pre-flights ASA opt-in via algoSendPlan; sendAlgorand
// re-enforces min-balance and opt-in in code before signing.
function openAlgoSheet(tok) {
  if (algoFunded === false) {
    openSheet(`<h3>Algorand</h3>
      <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · <span class="mono">${algoAddr}</span></p>
      <p class="tag">Your Algorand account isn't funded yet, so it can't send. Receive ALGO at this address first — every account must always keep at least 0.1 ALGO (plus 0.1 per asset it holds).</p>`);
    return;
  }
  let pendingAlgo = null;
  const tokenArg = tok.address ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Algorand</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${algoAddr}</span></p>
    ${tok.address ? `<p class="tag">ASA id <span class="mono">${esc(tok.address)}</span></p>` : ""}
    <input id="agTo" placeholder="Recipient Algorand address" autocapitalize="none">
    <input id="agAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="agReview">Review send</button>
    <div id="agIntent" class="hidden">
      <p class="seed" id="agIntentText"></p>
      <button class="btn" id="agConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="agMsg"></p>
    <p class="tag">${tok.address
      ? "The recipient must already be opted into this asset — Algorand accounts can only hold assets they have opted into. Sends are final."
      : "Every Algorand account must always keep its minimum balance (0.1 ALGO plus 0.1 per asset held) — Fluid stops any send that would break that. Sends are final."}</p>`);
  $("agReview").onclick = async () => {
    const to = $("agTo").value.trim(), amount = $("agAmt").value.trim();
    if (!isValidAlgorandAddress(to)) return msg("agMsg", "That is not a valid Algorand address.");
    if (!amount || Number(amount) <= 0) return msg("agMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("agMsg", "Amount is more than your balance.");
    try {
      msg("agMsg", "Checking the recipient…", true);
      const plan = await algoSendPlan(algoAddr, { to, token: tokenArg });
      if (tokenArg && plan.destOptedIn === false) {
        return msg("agMsg", `The recipient can't receive ${tok.symbol} yet — on Algorand, an account can only hold an asset it has opted into, and this account hasn't opted into it.`);
      }
      if (tokenArg && plan.destFunded === false) {
        return msg("agMsg", "The recipient's Algorand account isn't funded yet, so it can't hold assets. They need to receive ALGO first.");
      }
      pendingAlgo = { to, amount };
      $("agIntentText").textContent = formatAlgoSendIntent({ amount, symbol: tok.symbol, to, feeAlgo: plan.feeAlgo })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("agIntent"); msg("agMsg", "");
    } catch (e) { msg("agMsg", "Could not check the recipient: " + e.message); }
  };
  $("agConfirm").onclick = async () => {
    if (!pendingAlgo) return;
    try {
      msg("agMsg", "Signing locally and submitting…", true);
      const { hash } = await sendAlgorand(wallet.mnemonic.phrase, { to: pendingAlgo.to, amount: pendingAlgo.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingAlgo.amount, symbol: tok.symbol, to: pendingAlgo.to,
        link: `${ALGO_EXPLORER}/tx/${hash}`, explorer: ALGO_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingAlgo = null; closeSheet(); renderMain();
    } catch (e) { msg("agMsg", "Send failed: " + e.message); }
  };
}

// ---------- XRP Ledger sheet (Phase 4) ----------
// Includes the optional destination tag exchanges require. Review
// pre-flights funding + the live reserve via xrplSendPlan;
// sendXrpl re-enforces the reserve rules in code before signing.
function openXrplSheet(tok) {
  if (xrpFunded === false) {
    openSheet(`<h3>XRP Ledger</h3>
      <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · <span class="mono">${xrpAddr}</span></p>
      <p class="tag">Your XRP Ledger account isn't activated yet — accounts only exist once they hold the network base reserve. Receive at least 1 XRP at this address to activate it; then you can send.</p>`);
    return;
  }
  let pendingXrp = null;
  const tokenArg = tok.address ? { currency: tok.currency, issuer: tok.issuer } : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on the XRP Ledger</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${xrpAddr}</span></p>
    ${tok.address ? `<p class="tag">Issuer <span class="mono">${esc(tok.issuer)}</span></p>` : ""}
    <input id="xrTo" placeholder="Recipient XRP Ledger address (r…)" autocapitalize="none">
    <input id="xrAmt" inputmode="decimal" placeholder="Amount">
    <input id="xrTag" inputmode="numeric" placeholder="Destination tag (optional — exchanges often require one)">
    <button class="btn" id="xrReview">Review send</button>
    <div id="xrIntent" class="hidden">
      <p class="seed" id="xrIntentText"></p>
      <button class="btn" id="xrConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="xrMsg"></p>
    <p class="tag">Your account must always keep its reserve (base reserve plus 0.2 XRP per object it owns, read live from the network) — Fluid stops any send that would break that. Sending to an exchange? Add its destination tag or the deposit may be lost. Sends are final.</p>`);
  $("xrReview").onclick = async () => {
    const to = $("xrTo").value.trim(), amount = $("xrAmt").value.trim();
    const tagRaw = $("xrTag").value.trim();
    let destinationTag = null;
    if (tagRaw !== "") {
      if (!/^\d{1,10}$/.test(tagRaw) || Number(tagRaw) > 4294967295) return msg("xrMsg", "The destination tag must be a whole number (0 to 4294967295), or left empty.");
      destinationTag = Number(tagRaw);
    }
    if (!isValidXrplAddress(to)) return msg("xrMsg", "That is not a valid XRP Ledger address (it starts with r).");
    if (!amount || Number(amount) <= 0) return msg("xrMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("xrMsg", "Amount is more than your balance.");
    try {
      msg("xrMsg", "Checking the recipient…", true);
      const plan = await xrplSendPlan(xrpAddr, { to });
      if (!tokenArg && plan.destFunded === false && plan.baseReserveXrp != null && Number(amount) < Number(plan.baseReserveXrp)) {
        return msg("xrMsg", `That account doesn't exist yet — creating it needs a starting balance of at least ${plan.baseReserveXrp} XRP (the network base reserve).`);
      }
      pendingXrp = { to, amount, destinationTag };
      $("xrIntentText").textContent = formatXrplSendIntent({ amount, symbol: tok.symbol, to, feeXrp: plan.feeXrp, destinationTag })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("xrIntent"); msg("xrMsg", "");
    } catch (e) { msg("xrMsg", "Could not check the recipient: " + e.message); }
  };
  $("xrConfirm").onclick = async () => {
    if (!pendingXrp) return;
    try {
      msg("xrMsg", "Signing locally and submitting…", true);
      const { hash } = await sendXrpl(wallet.mnemonic.phrase, {
        to: pendingXrp.to, amount: pendingXrp.amount, token: tokenArg, destinationTag: pendingXrp.destinationTag,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingXrp.amount, symbol: tok.symbol, to: pendingXrp.to,
        link: `${XRPL_EXPLORER}/tx/${hash}`, explorer: XRPL_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingXrp = null; closeSheet(); renderMain();
    } catch (e) { msg("xrMsg", "Send failed: " + e.message); }
  };
}

// ---------- Polkadot Asset Hub sheet (Phase 4) ----------
// The review builds the exact transfer in core to quote the
// network's own fee estimate; sendDot re-enforces the existential
// deposit in code (and transferKeepAlive at the protocol level).
function openDotSheet(tok) {
  let pendingDot = null;
  const tokenArg = tok.address ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Polkadot Asset Hub</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${dotAddr}</span></p>
    ${tok.address ? `<p class="tag">Asset id <span class="mono">${esc(tok.address)}</span> · Polkadot Asset Hub</p>` : ""}
    <input id="dtTo" placeholder="Recipient Polkadot address" autocapitalize="none">
    <input id="dtAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="dtReview">Review send</button>
    <div id="dtIntent" class="hidden">
      <p class="seed" id="dtIntentText"></p>
      <button class="btn" id="dtConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="dtMsg"></p>
    <p class="tag">This address is for Polkadot Asset Hub (DOT and its USDC/USDT). An account must always keep at least 0.01 DOT (the existential deposit) — Fluid stops any send that would reap it. Sends are final.</p>`);
  $("dtReview").onclick = async () => {
    const to = $("dtTo").value.trim(), amount = $("dtAmt").value.trim();
    if (!isValidDotAddress(to)) return msg("dtMsg", "That is not a valid Polkadot address.");
    if (!amount || Number(amount) <= 0) return msg("dtMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("dtMsg", "Amount is more than your balance.");
    try {
      msg("dtMsg", "Estimating the network fee…", true);
      const plan = await dotSendPlan(wallet.mnemonic.phrase, { to, amount, token: tokenArg });
      pendingDot = { to, amount };
      $("dtIntentText").textContent = formatDotSendIntent({ amount, symbol: tok.symbol, to, feeDot: plan.feeDot })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("dtIntent"); msg("dtMsg", "");
    } catch (e) { msg("dtMsg", "Could not estimate: " + e.message); }
  };
  $("dtConfirm").onclick = async () => {
    if (!pendingDot) return;
    try {
      msg("dtMsg", "Signing locally and submitting…", true);
      const { hash } = await sendDot(wallet.mnemonic.phrase, { to: pendingDot.to, amount: pendingDot.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingDot.amount, symbol: tok.symbol, to: pendingDot.to,
        link: `${DOT_EXPLORER}/extrinsic/${hash}`, explorer: DOT_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingDot = null; closeSheet(); renderMain();
    } catch (e) { msg("dtMsg", "Send failed: " + e.message); }
  };
}

// ---------- Aptos sheet (Phase 5) ----------
// Review runs the chain's own simulation of the exact call
// (aptosSendPlan) so the intent sentence quotes the network's fee
// estimate; sendAptos re-plans fresh and re-enforces balances in
// code before signing locally.
function openAptosSheet(tok) {
  if (aptosExists === false) {
    openSheet(`<h3>Aptos</h3>
      <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · <span class="mono">${aptosAddr}</span></p>
      <p class="tag">Your Aptos account doesn't exist on-chain yet — an account is created when it first receives APT. Receive some APT at this address first; then you can send.</p>`);
    return;
  }
  let pendingAptos = null;
  const tokenArg = tok.address ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Aptos</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${aptosAddr}</span></p>
    ${tok.address ? `<p class="tag">Asset <span class="mono">${esc(tok.address)}</span></p>` : ""}
    <input id="apTo" placeholder="Recipient Aptos address (0x…)" autocapitalize="none">
    <input id="apAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="apReview">Review send</button>
    <div id="apIntent" class="hidden">
      <p class="seed" id="apIntentText"></p>
      <button class="btn" id="apConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="apMsg"></p>
    <p class="tag">Fees are paid in APT and are tiny — the amount in the sentence above is the network's own simulation of this exact send. Sends are final.</p>`);
  $("apReview").onclick = async () => {
    const to = $("apTo").value.trim(), amount = $("apAmt").value.trim();
    if (!isValidAptosAddress(to)) return msg("apMsg", "That is not a valid Aptos address.");
    if (!amount || Number(amount) <= 0) return msg("apMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("apMsg", "Amount is more than your balance.");
    try {
      msg("apMsg", "Simulating on the network…", true);
      const plan = await aptosSendPlan(aptosAddr, { to, amountRaw: aptosAmountToRaw(amount, tok.decimals ?? 8), token: tokenArg, publicKey: aptosPublicKeyFromPhrase(wallet.mnemonic.phrase) });
      if (!plan.exists) return msg("apMsg", "Your Aptos account doesn't exist on-chain yet — receive some APT first, then you can send.");
      if (!plan.simSuccess) return msg("apMsg", "The network says this send would fail: " + (plan.simStatus || "simulation failed"));
      pendingAptos = { to, amount };
      $("apIntentText").textContent = formatAptosSendIntent({ amount, symbol: tok.symbol, to, feeApt: aptosOctasToApt(plan.estimatedFeeOctas) })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("apIntent"); msg("apMsg", "");
    } catch (e) { msg("apMsg", "Could not simulate the send: " + e.message); }
  };
  $("apConfirm").onclick = async () => {
    if (!pendingAptos) return;
    try {
      msg("apMsg", "Signing locally and submitting…", true);
      const { hash } = await sendAptos(wallet.mnemonic.phrase, { to: pendingAptos.to, amount: pendingAptos.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingAptos.amount, symbol: tok.symbol, to: pendingAptos.to,
        link: `${APTOS_EXPLORER}/transaction/${hash}`, explorer: APTOS_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingAptos = null; closeSheet(); renderMain();
    } catch (e) { msg("apMsg", "Send failed: " + e.message); }
  };
}

// ---------- Stacks sheet (Bitcoin L2) ----------
// Review runs planStacksSend so the intent sentence quotes Hiro's fee
// estimate for this exact transaction (sanity-bounded in wallet-core
// before signing); sendStacks re-plans fresh and re-enforces balances
// in code before signing locally. SIP-010 sends carry an exact-amount
// post-condition.
function openStacksSheet(tok) {
  let pendingStacks = null;
  const tokenArg = tok.contract ? tok : null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Stacks</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${stacksAddr}</span></p>
    ${tok.contract ? `<p class="tag">Token contract <span class="mono">${esc(tok.contract)}</span></p>` : ""}
    <input id="sxTo" placeholder="Recipient Stacks address (SP…)" autocapitalize="none">
    <input id="sxAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="sxReview">Review send</button>
    <div id="sxIntent" class="hidden">
      <p class="seed" id="sxIntentText"></p>
      <button class="btn" id="sxConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="sxMsg"></p>
    <p class="tag">Fees are paid in STX, estimated by the network for this exact send and shown in the sentence above. Sends are final.</p>`);
  $("sxReview").onclick = async () => {
    const to = $("sxTo").value.trim(), amount = $("sxAmt").value.trim();
    if (!isValidStacksAddress(to)) return msg("sxMsg", "That is not a valid Stacks address.");
    if (!amount || Number(amount) <= 0) return msg("sxMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("sxMsg", "Amount is more than your balance.");
    try {
      msg("sxMsg", "Checking with the network…", true);
      const plan = await planStacksSend(wallet.mnemonic.phrase, { to, amountText: amount, token: tokenArg });
      pendingStacks = { to, amount };
      $("sxIntentText").textContent = plan.intent + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("sxIntent"); msg("sxMsg", "");
    } catch (e) { msg("sxMsg", e.message); }
  };
  $("sxConfirm").onclick = async () => {
    if (!pendingStacks) return;
    try {
      msg("sxMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendStacks(wallet.mnemonic.phrase, { to: pendingStacks.to, amountText: pendingStacks.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingStacks.amount, symbol: sanitizePersistedSymbol(tok.symbol), to: pendingStacks.to,
        link: stacksExplorerTxUrl(hash), explorer: STACKS_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingStacks = null; closeSheet(); renderMain();
    } catch (e) { msg("sxMsg", "Send failed: " + e.message); }
  };
}

// ---------- Litecoin sheet ----------
// Mirrors the Tron/Solana sheets: review → human-readable sentence →
// confirm. Built and signed locally by sendLitecoin (same @scure stack
// as Bitcoin, Litecoin network parameters).
function openLtcSheet() {
  let pendingLtc = null;
  openSheet(`<h3>Send LTC on Litecoin</h3>
    <p><b>${fmt(ltcBal, 8)} LTC</b> · from <span class="mono">${ltcAddr}</span></p>
    <input id="lTo" placeholder="Recipient ltc1… address" autocapitalize="none">
    <input id="lAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="lReview">Review send</button>
    <div id="lIntent" class="hidden">
      <p class="seed" id="lIntentText"></p>
      <button class="btn" id="lConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="lMsg"></p>
    <p class="tag">Fees use the current recommended Litecoin rate (litecoinspace.org), like Bitcoin's. Sends are final.</p>`);
  $("lReview").onclick = async () => {
    const to = $("lTo").value.trim(), amount = $("lAmt").value.trim();
    if (!isValidLitecoinAddress(to)) return msg("lMsg", "That is not a valid Litecoin address.");
    if (!amount || Number(amount) <= 0) return msg("lMsg", "Enter an amount.");
    if (Number(amount) > ltcBal) return msg("lMsg", "Amount is more than your balance.");
    try {
      msg("lMsg", "Checking the network fee…", true);
      const rate = await getLtcFeeRate();
      const feeLtc = (Math.ceil(140 * rate) / 1e8).toFixed(8); // ~1-in/2-out SegWit estimate for the sentence
      pendingLtc = { to, amount };
      $("lIntentText").textContent = formatLitecoinSendIntent({ amount, to, feeLtc });
      show("lIntent"); msg("lMsg", "");
    } catch (e) { msg("lMsg", "Could not check the fee: " + e.message); }
  };
  $("lConfirm").onclick = async () => {
    if (!pendingLtc) return;
    try {
      msg("lMsg", "Signing locally and broadcasting…", true);
      const txid = await sendLitecoin(wallet.mnemonic.phrase, { to: pendingLtc.to, amountLtc: Number(pendingLtc.amount) });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingLtc.amount, symbol: "LTC", to: pendingLtc.to,
        explorer: "https://litecoinspace.org", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingLtc = null; closeSheet(); renderMain();
    } catch (e) { msg("lMsg", "Send failed: " + e.message); }
  };
}
// ---------- Bitcoin Cash sheet ----------
// Mirrors the Litecoin sheet: review → human-readable sentence →
// confirm. Built and signed locally by sendBitcoinCash (ForkID
// sighash, validated against bitcore-lib-cash + real mainnet
// signatures before shipping).
function openBchSheet() {
  let pendingBch = null;
  openSheet(`<h3>Send BCH on Bitcoin Cash</h3>
    <p><b>${fmt(bchBal, 8)} BCH</b> · from <span class="mono">${bchAddr}</span></p>
    <input id="cTo" placeholder="Recipient bitcoincash:q… or legacy address" autocapitalize="none">
    <input id="cAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="cReview">Review send</button>
    <div id="cIntent" class="hidden">
      <p class="seed" id="cIntentText"></p>
      <button class="btn" id="cConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="cMsg"></p>
    <p class="tag">Fees are 1 satoshi per byte (about 0.00000226 BCH for a typical send). CashAddr and legacy addresses both work. Sends are final.</p>`);
  $("cReview").onclick = () => {
    const to = $("cTo").value.trim(), amount = $("cAmt").value.trim();
    if (!isValidBchAddress(to)) return msg("cMsg", "That is not a valid Bitcoin Cash address.");
    if (!amount || Number(amount) <= 0) return msg("cMsg", "Enter an amount.");
    if (Number(amount) > bchBal) return msg("cMsg", "Amount is more than your balance.");
    pendingBch = { to, amount };
    $("cIntentText").textContent = formatBitcoinCashSendIntent({ amount, to, feeBch: "0.00000226" });
    show("cIntent"); msg("cMsg", "");
  };
  $("cConfirm").onclick = async () => {
    if (!pendingBch) return;
    try {
      msg("cMsg", "Signing locally and broadcasting…", true);
      const txid = await sendBitcoinCash(wallet.mnemonic.phrase, { to: pendingBch.to, amountBch: Number(pendingBch.amount) });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingBch.amount, symbol: "BCH", to: pendingBch.to,
        link: `https://blockchair.com/bitcoin-cash/transaction/${txid}`, explorer: "https://blockchair.com/bitcoin-cash", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingBch = null; closeSheet(); renderMain();
    } catch (e) { msg("cMsg", "Send failed: " + e.message); }
  };
}

// ---------- Dogecoin sheet ----------
// Receive (QR + copy) and send in the established review → intent
// sentence → confirm pattern. The transaction is built and signed
// locally by sendDogecoin and relayed RAW through keyless public
// relays (Bitcore primary, BlockCypher raw-push fallback — both
// verified live 2026-11-06 with a locally-signed transaction; see
// wallet-core). The minimum-amount guard reflects Dogecoin's high
// dust limit (0.01 DOGE).
function openDogeSheet() {
  let pendingDoge = null;
  openSheet(`<h3>Dogecoin</h3>
    <p><b>${fmt(dogeBal, 8)} DOGE</b> · ${usd(dogeBal * (prices.DOGE || 0))}</p>
    <img class="qr" id="qrDoge2"><p class="mono">${dogeAddr}</p>
    <button class="btn ghost" id="cpDoge2">Copy address</button>
    <hr style="border-color:var(--line)">
    <h3>Send DOGE</h3>
    <input id="gTo" placeholder="Recipient D… address" autocapitalize="none">
    <input id="gAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="gReview">Review send</button>
    <div id="gIntent" class="hidden">
      <p class="seed" id="gIntentText"></p>
      <button class="btn" id="gConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="gMsg"></p>
    <p class="tag">Built and signed on this device, then broadcast exactly as signed through a public relay — no server ever builds your transaction. Dogecoin's minimum spendable output is ${DOGE_MIN_OUTPUT} DOGE. Sends are final.</p>`);
  qr("qrDoge2", dogeAddr);
  $("cpDoge2").onclick = () => copyText(dogeAddr, $("cpDoge2"));
  $("gReview").onclick = async () => {
    const to = $("gTo").value.trim(), amount = $("gAmt").value.trim();
    if (!isValidDogeAddress(to)) return msg("gMsg", "That is not a valid Dogecoin address.");
    if (!amount || Number(amount) <= 0) return msg("gMsg", "Enter an amount.");
    if (Number(amount) < DOGE_MIN_OUTPUT) return msg("gMsg", `Dogecoin's minimum spendable output is ${DOGE_MIN_OUTPUT} DOGE — send at least that much.`);
    if (Number(amount) > dogeBal) return msg("gMsg", "Amount is more than your balance.");
    try {
      msg("gMsg", "Checking the network fee…", true);
      const info = await getDogeFeeInfo();
      const rate = Math.max(1000, Math.floor(info.medianSatByte ?? 10000));
      const feeDoge = (rate * 226 / 1e8).toFixed(8); // ~1-in/2-out legacy estimate for the sentence
      pendingDoge = { to, amount };
      $("gIntentText").textContent = formatDogeSendIntent({ amount, to, feeDoge });
      show("gIntent"); msg("gMsg", "");
    } catch (e) { msg("gMsg", "Could not check the fee: " + e.message); }
  };
  $("gConfirm").onclick = async () => {
    if (!pendingDoge) return;
    try {
      msg("gMsg", "Signing locally and broadcasting…", true);
      const { txid } = await sendDogecoin(wallet.mnemonic.phrase, { to: pendingDoge.to, amountDoge: Number(pendingDoge.amount) });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingDoge.amount, symbol: "DOGE", to: pendingDoge.to,
        link: `https://blockchair.com/dogecoin/transaction/${txid}`, explorer: "https://blockchair.com/dogecoin", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingDoge = null; closeSheet(); renderMain();
    } catch (e) { msg("gMsg", "Send failed: " + e.message); }
  };
}

// ---------- Cosmos sheet ----------
// One sheet per Cosmos chain (tap its row): balance, QR + copy for the
// chain's prefixed address, EVERY denom the account holds on that
// chain (universal token support: the bank module reports them all —
// registry-named where the chain registry knows them, IBC/ hashes
// labelled, the rest heuristic and ⚠ unverified), and a MsgSend form
// in the established review → intent sentence → confirm pattern for
// the selected denom. The fee in the sentence is a live simulation at
// the chain's registry gas price, and the confirmed send broadcasts
// with exactly that fee (fees are always paid in the native denom,
// whatever denom is being sent). Injective rides its own hand-rolled
// EthAccount signer inside sendCosmos/estimateCosmosFee (see
// wallet-core) — the sheet is chain-generic and doesn't care. One
// honest limit, stated in the sheet itself: swaps from Cosmos
// chains aren't available yet (LI.FI carries no Cosmos chains;
// Skip Go's routes hide the swap inside an opaque transfer memo).
function openCosmosSheet(row) {
  const chain = row; // COSMOS_CHAINS entry + { address, amount|null, tokens|null }
  let pendingCosmos = null;
  const tokens = Array.isArray(chain.tokens) ? chain.tokens : null;
  let sel = tokens
    ? (tokens.find(t => t.denom === chain.denom) || tokens[0] || null)
    : { denom: chain.denom, symbol: chain.symbol, name: chain.name, decimals: chain.decimals, amount: chain.amount, verified: true, ibc: false };
  const balLine = chain.amount == null
    ? `<p><b>Balance unavailable right now</b> — ${chain.name}'s public API didn't answer. Receiving still works; sending needs a live balance read first.</p>`
    : `<p><b>${fmt(chain.amount)} ${chain.symbol}</b> · ${usd(Number(chain.amount) * (prices[chain.symbol] || 0))}</p>`;
  const tokenList = tokens && tokens.length
    ? `<p class="tag" style="margin:10px 0 4px">Tokens on ${chain.name} — tap one to select it for sending:</p>
       <div id="kTokens">${tokens.map(t => `
         <button class="netitem" data-ktok="${esc(t.denom)}">
           <span>${t.verified ? "" : "⚠ "}${esc(t.symbol)}<br><small style="color:var(--dim)">${esc(t.denom)}${t.ibc ? " · bridged via IBC — the label can't name the original asset" : ""}</small></span>
           <span>${fmt(t.amount)}${sel && t.denom === sel.denom ? ' <span class="pill">SENDING</span>' : ""}</span>
         </button>`).join("")}</div>`
    : "";
  const sendBlock = `<h3>Send <span id="kSendSym">${esc(sel ? sel.symbol : chain.symbol)}</span></h3>
       <input id="kTo" placeholder="Recipient ${chain.prefix}1… address" autocapitalize="none">
       <input id="kAmt" inputmode="decimal" placeholder="Amount">
       <button class="btn" id="kReview">Review send</button>
       <div id="kIntent" class="hidden">
         <p class="seed" id="kIntentText"></p>
         <button class="btn" id="kConfirm">Confirm &amp; send</button>
       </div>
       <p class="msg err" id="kMsg"></p>
       <p class="tag">Fees are paid in ${chain.symbol} at ${chain.name}'s going gas price and are estimated live before you confirm. Sends are final.</p>`;
  openSheet(`<h3>${chain.name}</h3>
    ${balLine}
    <img class="qr" id="qrCosmos"><p class="mono">${chain.address}</p>
    <button class="btn ghost" id="cpCosmos">Copy address</button>
    <p class="tag">One seed phrase controls all seven Cosmos addresses. Six chains share one account — only the prefix changes (${COSMOS_CHAINS.map(c => c.prefix + "1…").join(", ")}); Injective uses the standard Keplr path (coin type 60), so its address matches Keplr/Leap for the same phrase.</p>
    ${tokenList}
    <hr style="border-color:var(--line)">
    ${sendBlock}
    <hr style="border-color:var(--line)">
    <p class="tag">Swaps from Cosmos chains aren't available yet — Fluid can send on ${chain.name}, but swapping cross-chain isn't wired.</p>`);
  qr("qrCosmos", chain.address);
  $("cpCosmos").onclick = () => copyText(chain.address, $("cpCosmos"));
  if (tokens && tokens.length) {
    document.querySelectorAll("[data-ktok]").forEach(b => b.onclick = () => {
      const t = tokens.find(x => x.denom === b.dataset.ktok);
      if (!t) return;
      sel = t; pendingCosmos = null;
      // Re-render the selection state without rebuilding the sheet.
      document.querySelectorAll("[data-ktok]").forEach(x => {
        const xt = tokens.find(y => y.denom === x.dataset.ktok);
        const amtSpan = x.querySelector("span:last-child");
        if (amtSpan && xt) amtSpan.innerHTML = `${fmt(xt.amount)}${xt.denom === sel.denom ? ' <span class="pill">SENDING</span>' : ""}`;
      });
      const symEl = $("kSendSym"); if (symEl) symEl.textContent = sel.symbol;
      const intEl = $("kIntent"); if (intEl) intEl.classList.add("hidden");
      msg("kMsg", "");
    });
  }
  $("kReview").onclick = async () => {
    const to = $("kTo").value.trim(), amount = $("kAmt").value.trim();
    if (!sel) return msg("kMsg", "No token selected.");
    if (!isValidCosmosAddress(to, chain.key)) return msg("kMsg", `That is not a valid ${chain.name} address (it starts with ${chain.prefix}1).`);
    if (!amount || Number(amount) <= 0) return msg("kMsg", "Enter an amount.");
    if (sel.amount == null) return msg("kMsg", "Balance is unavailable right now — try again when the network answers.");
    if (Number(amount) > Number(sel.amount)) return msg("kMsg", "Amount is more than your balance.");
    try {
      msg("kMsg", "Estimating fee…", true);
      const est = await estimateCosmosFee(wallet.mnemonic.phrase, chain.key, { to, amount, denom: sel.denom, decimals: sel.decimals });
      pendingCosmos = { to, amount, fee: est.fee, denom: sel.denom, decimals: sel.decimals, symbol: sel.symbol };
      $("kIntentText").textContent = formatCosmosSendIntent({
        amount, symbol: sel.symbol, to, chainName: chain.name,
        feeAmount: Number(est.feeText).toFixed(6), feeSymbol: est.feeSymbol })
        + (sel.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      show("kIntent"); msg("kMsg", "");
    } catch (e) { msg("kMsg", "Could not estimate the fee: " + e.message); }
  };
  $("kConfirm").onclick = async () => {
    if (!pendingCosmos) return;
    try {
      msg("kMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendCosmos(wallet.mnemonic.phrase, chain.key, {
        to: pendingCosmos.to, amount: pendingCosmos.amount, fee: pendingCosmos.fee,
        denom: pendingCosmos.denom, decimals: pendingCosmos.decimals });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingCosmos.amount, symbol: pendingCosmos.symbol, to: pendingCosmos.to,
        link: `${chain.explorer}/txs/${hash}`, explorer: chain.explorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingCosmos = null; closeSheet(); renderMain();
    } catch (e) { msg("kMsg", "Send failed: " + e.message); }
  };
}

// ---------- Lightning ----------
$("lightningRow").onclick = () => {
  openSheet(`<h3>⚡ Lightning payment</h3>
    <p class="tag">Fluid never custodies Lightning funds. Paste an invoice — your own WebLN wallet (e.g. Alby) pays it.</p>
    <textarea id="lnInv" rows="3" placeholder="lnbc… invoice — or a Fluid name / Lightning address"></textarea>
    <input id="lnSats" inputmode="numeric" placeholder="Sats (only for name / Lightning address)">
    <button class="btn" id="lnPay">Pay</button>
    <p class="msg err" id="lnMsg"></p>`);
  $("lnPay").onclick = async () => {
    try {
      let target = $("lnInv").value.trim(), invoice = target;
      if (!target.toLowerCase().startsWith("lnbc")) {
        const sats = Number($("lnSats").value);
        if (!sats || sats <= 0) return msg("lnMsg", "Enter the sats amount for a name / Lightning address.");
        let lnAddr = target;
        if (!target.includes("@")) {
          const hit = await resolveFluidName(target).catch(() => null);
          if (!hit || !hit.ln) return msg("lnMsg", "That Fluid name has no Lightning address in the registry.");
          lnAddr = hit.ln;
        }
        msg("lnMsg", "Getting invoice for " + lnAddr + "…", true);
        invoice = await lightningInvoiceForAddress(lnAddr, sats);
      }
      await payLightningInvoice(invoice);
      msg("lnMsg", "Paid ✓", true);
    } catch (e) { msg("lnMsg", e.message); }
  };
};

// ---------- ramps (local currency, country-aware) ----------
function rampSheet(mode) {
  const country = localStorage.getItem("fluid_country") || "NG";
  const ctry = RAMP_COUNTRIES.find(c => c.code === country) || RAMP_COUNTRIES[0];
  // Ramps settle on the built-in networks (provider coverage is mapped
  // there); discovered chains are for holding, sending and swapping.
  const rampDefault = BUILTIN_NETWORK_KEYS.includes(networkKey) ? networkKey : "bsc";
  openSheet(`<h3>${mode === "buy" ? "Deposit local currency → crypto" : "Withdraw crypto → local currency"}</h3>
    <p class="tag">Pick your country and coin. You complete the ${mode === "buy" ? "purchase" : "sale"} with the provider in your own currency (they handle KYC &amp; fiat) — Fluid never touches your bank money.</p>
    <label class="tag">Country / currency</label>
    <select id="rCountry">${RAMP_COUNTRIES.map(c => `<option value="${c.code}" ${c.code === country ? "selected" : ""}>${c.name}</option>`).join("")}</select>
    <label class="tag">Network</label>
    <select id="rNet">${BUILTIN_NETWORK_KEYS.filter(k => k !== "sepolia").map(k => `<option value="${k}" ${k === rampDefault ? "selected" : ""}>${NETWORKS[k].name}</option>`).join("")}</select>
    <label class="tag" id="rAssetLabel">Coin (on ${NETWORKS[rampDefault].name})</label>
    <select id="rAsset"><option>USDC</option><option>USDT</option></select>
    <div id="rList"></div>`);
  const paint = () => {
    const code = $("rCountry").value, asset = $("rAsset").value, netKey = $("rNet").value;
    localStorage.setItem("fluid_country", code);
    $("rAssetLabel").textContent = `Coin (on ${NETWORKS[netKey].name})`;
    const c = RAMP_COUNTRIES.find(x => x.code === code);
    const fonbnk = c.fonbnk
      ? (mode === "buy" ? fonbnkOnrampUrl(netKey, asset, code) : fonbnkOfframpUrl(netKey, asset, code)) : null;
    const routes = GLOBAL_RAMPS.map(r => ({ name: r.name, url: mode === "buy" ? r.buy : r.sell, region: r.region }));
    if (fonbnk) routes.push({ name: "Fonbnk", url: fonbnk, region: c.name + " · bank & mobile money" });
    const ranked = rankRoutes(routes);
    $("rList").innerHTML =
      `<p class="tag" style="margin-top:10px">⚡ Sorted cheapest-route first (typical fees from provider docs — the provider shows your final quote before you pay).</p>` +
      ranked.map((r, i) =>
        // No inline onclick (the CSP forbids inline handlers): the URL
        // rides in a data attribute and is opened by the bound listener.
        `<button class="netitem" data-ramp-url="${esc(r.url)}"><span>${esc(r.name)} ${i === 0 ? '<span class="pill">CHEAPEST</span>' : ""}</span><small style="color:var(--dim)">${esc(r.note || r.region || "")}</small></button>`).join("") +
      (!fonbnk && c.fonbnk ? `<p class="tag">Fonbnk doesn't ride on ${NETWORKS[netKey].name} — pick a network it supports above (e.g. BNB Chain or Base), or use a global provider instead.</p>` : "");
    document.querySelectorAll("[data-ramp-url]").forEach(b => b.onclick = () => { const u = b.dataset.rampUrl; if (u && /^https:\/\//.test(u)) window.open(u, "_blank", "noopener"); });
  };
  $("rCountry").onchange = paint; $("rAsset").onchange = paint; $("rNet").onchange = paint; paint();
}
$("actBuy").onclick = () => rampSheet("buy");
$("actCash").onclick = () => rampSheet("sell");

// ---------- swap (LI.FI routes: same-chain + cross-chain) ----------
// Token pickers are searchable over the chain's FULL LI.FI token list
// (universal token support) — thousands of tokens per chain, fetched
// on demand and cached — plus the user's custom tokens on EVM chains.
// A token is pickable the moment any list knows it; unverified ones
// (custom tokens no list knows) carry ⚠ and add a caution line to the
// approval sentence, exactly like unverified sends.
let pendingSwap = null;
const swapChainName = (k) => (swapChainOf(k) ? swapChainOf(k).name : NETWORKS[k].name);
function swapTokenList(netKey) {
  if (netKey === "tron") {
    // LI.FI addresses Tron tokens by their base58 T-address; the native
    // TRX entry is LI.FI's T-form zero address (see core).
    return [{ symbol: "TRX", address: TRON_SWAP_NATIVE_TOKEN, decimals: 6, native: true },
            ...TRON_TOKENS.map(t => ({ ...t, native: false }))];
  }
  if (netKey === "solana") {
    // LI.FI addresses Solana tokens by mint; native SOL is the System
    // Program id (see core).
    return [{ symbol: "SOL", address: SOLANA_SWAP_NATIVE_TOKEN, decimals: 9, native: true },
            ...SOLANA_TOKENS.map(t => ({ ...t, native: false }))];
  }
  if (netKey === "sui") {
    // LI.FI addresses Sui tokens by full coin type; native SUI is the
    // zero-padded 0x2::sui::SUI type (see core).
    return [{ symbol: "SUI", address: SUI_SWAP_NATIVE_TOKEN, decimals: 9, native: true },
            ...SUI_TOKENS.map(t => ({ ...t, native: false }))];
  }
  const net = NETWORKS[netKey];
  return [{ symbol: net.symbol, address: LIFI_NATIVE_TOKEN, decimals: 18, native: true },
          ...(net.tokens || []).map(t => ({ ...t, native: false }))];
}
function swapRouteName(route) {
  const names = [...new Set((route.steps || []).map(s => s.toolDetails?.name || s.tool).filter(Boolean))];
  return names.join(" → ") || "LI.FI route";
}
function swapDurationText(sec) {
  if (!Number.isFinite(sec)) return "time varies";
  return sec < 90 ? `~${Math.max(1, Math.round(sec))} sec` : `~${Math.round(sec / 60)} min`;
}
// The picker's token universe per chain: curated/native entries first
// (always available instantly), merged with the chain's full LI.FI
// list once fetched. Entries: {symbol, name, address, decimals,
// native, verified, priceUSD}.
const swapLists = new Map(); // chainKey -> { tokens, full }
function swapBaseTokens(netKey) {
  return swapTokenList(netKey).map(t => ({ symbol: t.symbol, name: t.symbol, address: t.address,
    decimals: t.decimals, native: !!t.native, verified: true, priceUSD: null }));
}
function swapTokensFor(netKey) {
  const hit = swapLists.get(netKey);
  return hit ? hit.tokens : swapBaseTokens(netKey);
}
async function ensureSwapList(netKey) {
  const existing = swapLists.get(netKey);
  if (existing && existing.full) return existing.tokens;
  const base = swapBaseTokens(netKey);
  const sc = swapChainOf(netKey);
  if (!sc) { swapLists.set(netKey, { tokens: base, full: true }); return base; }
  // EVM chains reuse the 24h on-device LI.FI cache; other families
  // fetch per session (their lists are only needed inside this sheet).
  const list = NETWORKS[netKey] ? await lifiTokensForChain(sc.chainId) : await fetchLifiTokenList(sc.chainId);
  if (!list) { swapLists.set(netKey, { tokens: base, full: false }); return base; }
  const seen = new Set(base.map(t => t.address.toLowerCase()));
  const merged = [...base];
  for (const t of list) {
    const k = t.address.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push({ symbol: t.symbol, name: t.name, address: t.address, decimals: t.decimals,
                  native: false, verified: lifiTokenVerified(t), priceUSD: t.priceUSD });
  }
  if (NETWORKS[netKey]) {
    for (const ct of loadCustomTokens(sc.chainId)) {
      const k = ct.address.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push({ symbol: ct.symbol, name: ct.name, address: ct.address, decimals: ct.decimals,
                    native: false, verified: false, priceUSD: null, custom: true });
    }
  }
  swapLists.set(netKey, { tokens: merged, full: true });
  return merged;
}
/** Targeted balance read for the swap sheet's pre-flight check —
 *  works for ANY token in the picker, not just balance-list rows. */
async function swapBalanceOf(chainKey, tok) {
  try {
    if (chainKey === "tron") return await getTronTokenBalance(tronAddr, tok.native ? null : { address: tok.address, decimals: tok.decimals });
    if (chainKey === "solana") return await getSolanaTokenBalance(solAddr, tok.native ? null : tok.address, tok.decimals);
    if (chainKey === "sui") return await getSuiTokenBalance(suiAddr, tok.native ? SUI_COIN_TYPE : tok.address, tok.decimals);
    return await getEvmTokenBalance(wallet, chainKey, tok);
  } catch { return null; }
}
$("actSwap").onclick = () => {
  pendingSwap = null;
  const swapNets = [...Object.keys(NETWORKS).filter(k => k !== "sepolia"), "tron", "solana", "sui"];
  const netOpts = (sel) => swapNets.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${swapChainName(k)}</option>`).join("");
  const fromKey0 = networkKey === "sepolia" ? "bsc" : networkKey;
  const toKey0 = fromKey0 === "base" ? "bsc" : "base";
  openSheet(`<h3>Swap</h3>
    <p class="tag">One search across every Fluid chain (routes by LI.FI). Cheapest = most received after fees; you approve the exact sentence before anything is signed.</p>
    <label class="tag">From</label>
    <div style="display:flex;gap:8px">
      <select id="wFromNet" style="flex:1.2">${netOpts(fromKey0)}</select>
      <button class="btn ghost" id="wFromTokBtn" style="flex:1;margin:6px 0">Select token ▾</button>
    </div>
    <div id="wFromPick" class="hidden">
      <input id="wFromSearch" placeholder="Search name or symbol, or paste an address…" autocapitalize="none">
      <div id="wFromList" style="max-height:240px;overflow:auto"></div>
    </div>
    <input id="wAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn ghost" id="wFlip">⇅ Flip</button>
    <label class="tag">To</label>
    <div style="display:flex;gap:8px">
      <select id="wToNet" style="flex:1.2">${netOpts(toKey0)}</select>
      <button class="btn ghost" id="wToTokBtn" style="flex:1;margin:6px 0">Select token ▾</button>
    </div>
    <div id="wToPick" class="hidden">
      <input id="wToSearch" placeholder="Search name or symbol, or paste an address…" autocapitalize="none">
      <div id="wToList" style="max-height:240px;overflow:auto"></div>
    </div>
    <button class="btn" id="wRoutes">Get routes</button>
    <div id="wList"></div>
    <div id="wConfirm" class="hidden">
      <p class="seed" id="wIntentText"></p>
      <button class="btn" id="wDo">Confirm &amp; swap</button>
    </div>
    <p class="msg err" id="wMsg"></p>`);
  const P = {
    from: { net: "wFromNet", btn: "wFromTokBtn", panel: "wFromPick", search: "wFromSearch", list: "wFromList" },
    to: { net: "wToNet", btn: "wToTokBtn", panel: "wToPick", search: "wToSearch", list: "wToList" },
  };
  const pick = { from: null, to: null };
  function updatePickBtn(side) {
    const t = pick[side];
    $(P[side].btn).textContent = t ? `${t.verified === false ? "⚠ " : ""}${t.symbol} ▾` : "Select token ▾";
  }
  function setPick(side, t) { pick[side] = t; updatePickBtn(side); show("wConfirm", false); $("wList").innerHTML = ""; pendingSwap = null; }
  function defaultTok(side, netKey) {
    const toks = swapTokensFor(netKey);
    return side === "from" ? (toks.find(t => t.native) || toks[0]) : (toks.find(t => !t.native) || toks[0]);
  }
  function findTok(netKey, tok) {
    if (!tok) return null;
    return swapTokensFor(netKey).find(t => t.address.toLowerCase() === String(tok.address).toLowerCase()) || null;
  }
  function renderPickList(side) {
    const netKey = $(P[side].net).value;
    const q = $(P[side].search).value.trim().toLowerCase();
    const toks = swapTokensFor(netKey);
    const list = toks.filter(t => !q || t.symbol.toLowerCase().includes(q)
      || String(t.name || "").toLowerCase().includes(q) || t.address.toLowerCase() === q).slice(0, 80);
    const entry = swapLists.get(netKey);
    $(P[side].list).innerHTML = list.length
      ? list.map(t => `<button class="netitem" data-pick="${side}" data-addr="${esc(t.address)}">
          <span>${t.verified === false ? "⚠ " : ""}${esc(t.symbol)}<br><small style="color:var(--dim)">${esc(t.name || "")}</small></span>
          <span>${t.priceUSD != null ? usd(t.priceUSD) : ""}</span></button>`).join("")
      : `<p class="tag">No tokens match${entry && entry.full ? "" : " — the full token list is still loading"}.</p>`;
    document.querySelectorAll(`[data-pick="${side}"]`).forEach(b => b.onclick = () => {
      const t = swapTokensFor(netKey).find(x => x.address === b.dataset.addr);
      if (t) setPick(side, t);
      show(P[side].panel, false);
    });
  }
  for (const side of ["from", "to"]) {
    $(P[side].btn).onclick = () => {
      const opening = $(P[side].panel).classList.contains("hidden");
      show(P.from.panel, false); show(P.to.panel, false);
      if (opening) { show(P[side].panel, true); renderPickList(side); }
    };
    $(P[side].search).addEventListener("input", () => renderPickList(side));
    $(P[side].net).onchange = async () => {
      const netKey = $(P[side].net).value;
      show(P[side].panel, false);
      await ensureStableTokens(netKey); // discovered chains learn USDC/USDT lazily
      setPick(side, defaultTok(side, netKey));
      ensureSwapList(netKey);
    };
  }
  setPick("from", defaultTok("from", fromKey0));
  setPick("to", defaultTok("to", toKey0));
  ensureStableTokens(fromKey0).then(() => ensureSwapList(fromKey0));
  ensureStableTokens(toKey0).then(() => ensureSwapList(toKey0));
  $("wFlip").onclick = async () => {
    const fn = $("wFromNet").value, tn = $("wToNet").value;
    const fTok = pick.from, tTok = pick.to;
    $("wFromNet").value = tn; $("wToNet").value = fn;
    show(P.from.panel, false); show(P.to.panel, false);
    await ensureStableTokens(tn); await ensureStableTokens(fn);
    setPick("from", findTok(tn, tTok) || defaultTok("from", tn));
    setPick("to", findTok(fn, fTok) || defaultTok("to", fn));
    ensureSwapList(tn).then(() => { const nt = findTok(tn, tTok); if (nt) setPick("from", nt); });
    ensureSwapList(fn).then(() => { const nt = findTok(fn, fTok); if (nt) setPick("to", nt); });
    msg("wMsg", "");
  };
  $("wRoutes").onclick = async () => {
    await ensureStableTokens($("wFromNet").value);
    await ensureStableTokens($("wToNet").value);
    const fromKey = $("wFromNet").value, toKey = $("wToNet").value;
    const fromTok = pick.from, toTok = pick.to;
    const amount = $("wAmt").value.trim();
    show("wConfirm", false); pendingSwap = null;
    if (!fromTok || !toTok || !amount || Number(amount) <= 0) return msg("wMsg", "Pick both tokens and enter an amount to swap.");
    if (fromKey === toKey && fromTok.address.toLowerCase() === toTok.address.toLowerCase())
      return msg("wMsg", "Pick two different tokens — swapping a token for itself does nothing.");
    try {
      msg("wMsg", "Checking your balance…", true);
      const have = await swapBalanceOf(fromKey, fromTok);
      if (have == null || Number(amount) > Number(have))
        return msg("wMsg", `Not enough ${fromTok.symbol} on ${swapChainName(fromKey)} (you have ${have == null ? "0" : fmt(have)}).`);
      msg("wMsg", "Searching routes across chains…", true);
      const addrOf = (k) => (k === "tron" ? tronAddr : k === "solana" ? solAddr : k === "sui" ? suiAddr : wallet.address);
      const routes = await getSwapRoutes({
        fromChainKey: fromKey, toChainKey: toKey,
        fromTokenAddress: fromTok.address, toTokenAddress: toTok.address,
        fromAmount: swapAmountToRaw(amount, fromTok.decimals),
        fromAddress: addrOf(fromKey),
        toAddress: addrOf(toKey),
      });
      if (!routes.length) return msg("wMsg", "No route found for that pair and amount. Try a different pair or a larger amount.");
      const ranked = rankSwapRoutes(routes).slice(0, 3);
      msg("wMsg", "");
      $("wList").innerHTML = ranked.map((r, i) => {
        const ex = swapRouteExecutable(r);
        const badges = `${r.cheapest ? '<span class="pill">CHEAPEST</span> ' : ""}${r.fastest ? '<span class="pill">FASTEST</span> ' : ""}`;
        const recv = fmt(swapRawToAmount(r.toAmount, toTok.decimals));
        return `<button class="netitem" data-route="${i}" ${ex.ok ? "" : "disabled style=\"opacity:.45\""}>
            <span>${badges}${recv} ${esc(toTok.symbol)}<br><small style="color:var(--dim)">${esc(swapRouteName(r))} · ${swapDurationText(r.durationSec)} · fees ≈ ${usd(r.gasCostUSD)}</small></span>
            <span>${usd(r.toAmountUSD)}</span></button>
          ${ex.ok ? "" : `<p class="tag" style="margin:2px 0 8px">${esc(ex.reason)}</p>`}`;
      }).join("");
      document.querySelectorAll("[data-route]").forEach(b => b.onclick = () => {
        if (b.disabled) return;
        const r = ranked[Number(b.dataset.route)];
        pendingSwap = { route: r, fromKey, toKey, fromTok, toTok, amount };
        $("wIntentText").textContent = formatSwapIntent({
          fromAmount: amount, fromSymbol: fromTok.symbol, fromNetKey: fromKey,
          toAmount: fmt(swapRawToAmount(r.toAmount, toTok.decimals)), toSymbol: toTok.symbol, toNetKey: toKey,
          toolName: swapRouteName(r), feeUsd: r.gasCostUSD, durationSec: r.durationSec,
        }) + ((fromTok.verified === false || toTok.verified === false) ? " ⚠ " + UNVERIFIED_CAUTION : "");
        show("wConfirm"); msg("wMsg", "");
      });
    } catch (e) { msg("wMsg", "Route search failed: " + (e.shortMessage || e.message)); }
  };
  $("wDo").onclick = async () => {
    if (!pendingSwap) return;
    const { route, fromKey, toKey, fromTok, toTok, amount } = pendingSwap;
    const btn = $("wDo"); btn.disabled = true;
    try {
      let hashes, srcExplorer, srcLink;
      if (fromKey === "solana") {
        hashes = await executeSolanaSwapRoute(wallet.mnemonic.phrase, route, (t) => msg("wMsg", t, true));
        srcExplorer = SOLANA_EXPLORER;
        srcLink = `${SOLANA_EXPLORER}/tx/${hashes[0]}`;
      } else if (fromKey === "sui") {
        // Unreachable in practice — Sui-source route cards are disabled
        // by swapRouteExecutable — but never fall through to the EVM
        // signer with a Sui route.
        throw new Error("Fluid can't sign swap steps starting on Sui yet — use the Sui rows to send SUI directly.");
      } else {
        hashes = await executeSwapRoute(wallet, route, (t) => msg("wMsg", t, true), (rec) => {
          // Keep a device record of every approval Fluid makes, so the user
          // can review and revoke them later (More → Token approvals).
          const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
          list.unshift({ chainKey: rec.chainKey, token: rec.token, tokenSymbol: sanitizePersistedSymbol(rec.tokenSymbol), spender: rec.spender, amount: rec.decimals != null ? swapRawToAmount(rec.amount, rec.decimals) : rec.amount, at: rec.at });
          localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
        });
        srcExplorer = NETWORKS[fromKey].explorer;
      }
      const destAddr = toKey === "solana" ? solAddr : toKey === "tron" ? tronAddr : toKey === "sui" ? suiAddr : wallet.address;
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: hashes[0], amount, symbol: `${sanitizePersistedSymbol(fromTok.symbol)}→${sanitizePersistedSymbol(toTok.symbol)}`, to: destAddr, ...(srcLink ? { link: srcLink } : {}), explorer: srcExplorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingSwap = null; show("wConfirm", false);
      msg("wMsg", fromKey === toKey
        ? `Swap done ✓ tx ${hashes[hashes.length - 1].slice(0, 16)}…`
        : `Swap sent ✓ — your ${toTok.symbol} will arrive on ${swapChainName(toKey)} via the bridge shortly. First tx ${hashes[0].slice(0, 16)}…`, true);
      renderMain();
    } catch (e) { msg("wMsg", "Swap failed: " + (e.shortMessage || e.message)); }
    btn.disabled = false;
  };
};

// ---------- activity ----------
// SECURITY (audit C1): history entries persist token symbols from ERC-20 /
// LI.FI metadata — attacker-controlled. They render ONLY through
// formatHistoryEntry (wallet-core), which escapes every value and rebuilds
// the explorer link from a validated hash / clean https URL. Never
// interpolate a stored history field into innerHTML directly here.
function renderHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  $("history").innerHTML = h.length
    ? h.map(formatHistoryEntry).join("")
    : "No sends yet from this browser.";
}

// ---------- onboarding ----------
let pendingName = null;
$("createName").addEventListener("input", () => {
  const n = normalizeFluidName($("createName").value);
  $("createNamePreview").textContent = (n || "you") + "." + FLUID_DOMAIN;
});
$("createBtn").onclick = async () => {
  const pw = $("createPw").value;
  if (!validatePassword(pw)) return msg("onboardMsg", "Password needs at least 8 characters.");
  if (pw !== $("createPw2").value) return msg("onboardMsg", "Passwords do not match.");
  // Username is chosen FIRST, at creation (set by design): validate it and
  // check the public registry before any wallet exists.
  const wantName = normalizeFluidName($("createName").value);
  if (!wantName) return msg("onboardMsg", "Pick your Fluid username first — it's your name on every chain.");
  if (!validateFluidName(wantName)) return msg("onboardMsg", "Username must be 3-20 chars: letters, numbers, underscore; start with a letter.");
  msg("onboardMsg", "Checking your username…", true);
  const taken = await resolveFluidName(wantName).catch(() => null);
  // A new wallet has no addresses yet, so a registered name can never be
  // verified as this wallet's here — the hard block stands. But if the
  // name belongs to a wallet the user already HAS, importing/unlocking
  // that wallet adopts it automatically by reverse lookup (see
  // adoptRegistryNameIfMine) — say so instead of a dead end.
  if (taken) return msg("onboardMsg", "That username is already claimed. If it's yours from a wallet you already have, import or unlock that wallet instead — Fluid will attach the name to it automatically.");
  pendingName = wantName;
  msg("onboardMsg", "Creating your wallet… (encrypting takes a few seconds)", true);
  const v = await createVault(pw);
  localStorage.setItem(VAULT_KEY, v.keystore);
  $("seedOut").textContent = v.phrase;
  show("seedBox");
  msg("onboardMsg", "Wallet created. Write the seed down, tick the box, then continue.", true);
  $("seedDoneBtn").onclick = async () => {
    if (!$("seedCheck").checked) return msg("onboardMsg", "Tick the box confirming you wrote the seed down.");
    wallet = await unlockVault(v.keystore, pw);
    if (pendingName) {
      localStorage.setItem("fluid_name", pendingName);
      const entry = buildNameEntry(pendingName, wallet.address, bitcoinAddress(wallet.mnemonic.phrase), null);
      const entryText = JSON.stringify(entry).slice(1, -1) + ",";
      const claimed = pendingName; pendingName = null;
      setTimeout(() => {
        openSheet(`<h3 style="margin:4px 0">Your name: ${claimed}.${FLUID_DOMAIN}</h3>
          <p class="tag">Claimed with your wallet and saved on this device. One last step so EVERY Fluid wallet can resolve you: publish this entry into <b>names.json</b> in the GitHub repo.</p>
          <div class="seed" style="font-size:12px">${entryText}</div>
          <button class="btn" id="sheetCopyEntry">Copy entry</button>
          <a class="btn ghost" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="https://github.com/Townsvilledh/fluid-wallet/edit/main/names.json" target="_blank" rel="noopener">Open names.json on GitHub ↗</a>`);
        $("sheetCopyEntry").onclick = () => copyText(entryText, $("sheetCopyEntry"));
      }, 400);
    }
    refreshGate();
  };
};
$("importBtn").onclick = async () => {
  const pw = $("createPw").value;
  if (!validatePassword(pw)) return msg("onboardMsg", "Set a password (8+ characters) above first.");
  try {
    msg("onboardMsg", "Importing…", true);
    const v = await importVault($("importPhrase").value, pw);
    localStorage.setItem(VAULT_KEY, v.keystore);
    wallet = await unlockVault(v.keystore, pw);
    refreshGate();
  } catch (e) { msg("onboardMsg", e.message); }
};
$("unlockBtn").onclick = async () => {
  try { wallet = await unlockVault(localStorage.getItem(VAULT_KEY), $("unlockPw").value); refreshGate(); }
  catch (e) { msg("onboardMsg", e.message); }
};

// ---------- Fluid name: owned state + claim ----------
// The name card has two states. OWNED: the wallet has a name (claimed on
// this device, or adopted from the public registry by reverse lookup) —
// show the name and the addresses it resolves to, with copy buttons.
// UNCLAIMED: show the claim form. Owning a name must never look like not
// owning one: a restored wallet whose name was published from another
// browser previously saw an empty form, and claiming its own name back
// was hard-blocked as "already claimed" — by itself.
let nameAdoptTried = false;
function renderNameSection() {
  const stored = localStorage.getItem("fluid_name");
  if (!stored) { show("ownedNameBox", false); show("claimForm", true); return; }
  show("claimForm", false);
  show("ownedNameBox", true);
  $("namePreview").textContent = stored + "." + FLUID_DOMAIN;
  $("ownedNameText").textContent = stored + "." + FLUID_DOMAIN;
  // Prefill from this wallet's own keys right away; the registry entry
  // (what senders actually resolve) refines the fields when it loads.
  if (wallet) {
    $("ownedEvm").textContent = wallet.address;
    $("ownedBtc").textContent = btcAddr || bitcoinAddress(wallet.mnemonic.phrase);
  }
  $("copyOwnedEvm").onclick = () => copyText($("ownedEvm").textContent, $("copyOwnedEvm"));
  $("copyOwnedBtc").onclick = () => copyText($("ownedBtc").textContent, $("copyOwnedBtc"));
  $("copyOwnedLn").onclick = () => copyText($("ownedLn").textContent, $("copyOwnedLn"));
  resolveFluidName(stored).then(hit => {
    if (!hit) return;
    if (hit.evm) $("ownedEvm").textContent = hit.evm;
    if (hit.btc) $("ownedBtc").textContent = hit.btc;
    if (hit.ln) { $("ownedLn").textContent = hit.ln; show("ownedLnRow", true); }
    else show("ownedLnRow", false);
  }).catch(() => {});
}
/** Reverse lookup, once per unlock session: if the public registry holds
 *  a name whose EVM or BTC address is THIS wallet's, adopt it — store it
 *  locally and paint the owned state. Never touches names that resolve
 *  to anyone else's addresses. */
async function adoptRegistryNameIfMine() {
  if (!wallet || nameAdoptTried || localStorage.getItem("fluid_name")) return;
  nameAdoptTried = true;
  try {
    const reg = await fetchNameRegistry();
    const hit = findNameForAddresses(reg, { evm: wallet.address, btc: btcAddr || bitcoinAddress(wallet.mnemonic.phrase) });
    if (hit) {
      localStorage.setItem("fluid_name", hit.name);
      $("nameText").textContent = "@" + hit.name + " · " + hit.name + "." + FLUID_DOMAIN;
      renderNameSection();
    }
  } catch { /* registry unreachable — the claim form stays, nothing breaks */ }
}
// Top level on purpose: this wiring used to live inside the seedDoneBtn
// click handler, so the Claim button was dead for anyone who unlocked an
// existing wallet instead of creating a fresh one in the same session.
$("claimNameBtn").onclick = async () => {
  if (!wallet) return msg("nameMsg", "Unlock your wallet first.");
  const name = normalizeFluidName($("nameInput").value);
  if (!validateFluidName(name)) return msg("nameMsg", "Name must be 3-20 chars: letters, numbers, underscore; start with a letter.");
  msg("nameMsg", "Checking the registry…", true);
  const existing = await resolveFluidName(name).catch(() => null);
  if (existing) {
    // Registered already — but to THIS wallet? Then it's not a conflict,
    // it's a homecoming: adopt it instead of blocking the owner.
    const mine = findNameForAddresses({ [existing.name]: existing },
      { evm: wallet.address, btc: btcAddr || bitcoinAddress(wallet.mnemonic.phrase) });
    if (mine) {
      localStorage.setItem("fluid_name", name);
      msg("nameMsg", "That name is already yours — added to this wallet.", true);
      renderNameSection();
      renderMain();
      return;
    }
    return msg("nameMsg", "That name is already claimed. Try another.");
  }
  localStorage.setItem("fluid_name", name);
  const entry = buildNameEntry(name, wallet.address, btcAddr || bitcoinAddress(wallet.mnemonic.phrase), $("lnInput").value.trim() || null);
  $("nameEntry").textContent = JSON.stringify(entry).slice(1, -1) + ",";
  show("claimBox");
  msg("nameMsg", "Name saved on this device. Publish the entry to make it resolve everywhere.", true);
  renderMain();
};
$("copyEntryBtn").onclick = () => copyText($("nameEntry").textContent, $("copyEntryBtn"));
renderNameSection();

// ---------- more tab ----------
$("refreshBtn").onclick = renderMain;
function lockWallet() { wallet = null; pendingSend = null; nameAdoptTried = false; refreshGate(); }
$("lockBtn").onclick = lockWallet;

// ---------- auto-lock ----------
// Keys live only in memory while unlocked. After 5 minutes without
// interaction — or 5 minutes spent hidden — Fluid locks itself, so an
// unattended, unlocked wallet is never left sitting open.
const AUTOLOCK_MS = 5 * 60 * 1000;
let lastActivity = Date.now(), hiddenAt = null;
addEventListener("pointerdown", () => { lastActivity = Date.now(); }, { passive: true });
addEventListener("keydown", () => { lastActivity = Date.now(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt != null && Date.now() - hiddenAt > AUTOLOCK_MS && wallet) lockWallet();
  hiddenAt = null;
});
setInterval(() => { if (wallet && Date.now() - lastActivity > AUTOLOCK_MS) lockWallet(); }, 30 * 1000);

// ---------- token approvals ----------
// Every approval Fluid makes for a swap is recorded on this device; this
// screen lists them for the current network and can revoke each one
// (an on-chain approve(spender, 0)).
function loadApprovals() { try { return JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]"); } catch { return []; } }
$("approvalsBtn").onclick = () => {
  let pendingRevoke = null;
  openSheet(`<h3>Token approvals</h3>
    <p class="tag">Approvals Fluid made for swaps from this device. Revoking sets the permission back to zero.</p>
    <div id="apList"></div>
    <div id="apConfirm"></div>
    <p class="msg err" id="apMsg"></p>`);
  const emptyNote = `<p class="tag">No approvals recorded — swaps approve the exact amount needed, and they'll appear here.</p>`;
  const paint = () => {
    const mine = loadApprovals().map((a, i) => ({ ...a, _i: i })).filter(a => a.chainKey === networkKey);
    // SECURITY (audit C1): approval records persist LI.FI token symbols —
    // attacker-controlled. Rows render ONLY through formatApprovalRow /
    // formatRevokePrompt (wallet-core), which escape every stored value.
    $("apList").innerHTML = mine.length ? mine.map(a => `
      <div class="hist" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        ${formatApprovalRow(a, fmt(a.amount), new Date(a.at).toLocaleDateString())}
        <button class="btn ghost" data-revoke="${a._i}" style="width:auto;padding:6px 12px">Revoke</button>
      </div>`).join("") : emptyNote;
    document.querySelectorAll("[data-revoke]").forEach(b => b.onclick = () => {
      const list = loadApprovals(); const a = list[Number(b.dataset.revoke)]; if (!a) return;
      pendingRevoke = Number(b.dataset.revoke);
      $("apConfirm").innerHTML = `<p class="seed" style="margin-top:10px">${formatRevokePrompt(a, (NETWORKS[a.chainKey] || {}).name)}</p>
        <button class="btn" id="apRevokeGo">Revoke approval</button>`;
      msg("apMsg", "");
      $("apRevokeGo").onclick = async () => {
        const cur = loadApprovals(); const rec = cur[pendingRevoke]; if (!rec) return;
        const btn = $("apRevokeGo"); btn.disabled = true;
        try {
          msg("apMsg", "Sending revoke transaction…", true);
          await revokeApproval(wallet, rec.chainKey, rec.token, rec.spender);
          cur.splice(pendingRevoke, 1);
          localStorage.setItem(APPROVALS_KEY, JSON.stringify(cur));
          pendingRevoke = null; $("apConfirm").innerHTML = "";
          msg("apMsg", "Revoked ✓ — that spender can no longer move this token.", true);
          paint();
        } catch (e) { msg("apMsg", "Revoke failed: " + (e.shortMessage || e.message)); btn.disabled = false; }
      };
    });
  };
  paint();
};

// ---------- build stamp ----------
// dist pages carry <meta name="fluid-build"> with the bundle hash; showing
// it lets anyone verify the running code matches the open-source build.
const buildMeta = document.querySelector('meta[name="fluid-build"]');
if (buildMeta && buildMeta.content) $("buildStamp").textContent = buildMeta.content;
$("backupBtn").onclick = () => {
  const blob = new Blob([localStorage.getItem(VAULT_KEY)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "fluid-keystore-backup.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
$("showSeedBtn").onclick = () => {
  openSheet(`<h3>Reveal seed phrase</h3>
    <p class="tag">Your seed phrase controls everything. Never share it, never type it into a website, and make sure nobody is looking at your screen.</p>
    <input id="seedPw" type="password" placeholder="Wallet password" autocomplete="current-password">
    <button class="btn" id="seedRevealGo">Reveal</button>
    <div id="seedRevealOut"></div>
    <p class="msg err" id="seedRevealMsg"></p>`);
  $("seedRevealGo").onclick = async () => {
    const pw = $("seedPw").value;
    if (!pw) return msg("seedRevealMsg", "Enter your password.");
    try {
      const w = await unlockVault(localStorage.getItem(VAULT_KEY), pw);
      $("seedRevealOut").innerHTML = `<p class="seed" style="margin-top:10px">${w.mnemonic.phrase}</p>`;
      msg("seedRevealMsg", "");
    } catch { msg("seedRevealMsg", "Wrong password."); }
  };
};
$("wipeBtn").onclick = () => {
  openSheet(`<h3>Remove wallet from this browser?</h3>
    <p class="tag">You can only get it back with your seed phrase or keystore backup. Funds on-chain are NOT deleted — this only removes the wallet from this device.</p>
    <button class="btn" id="wipeGo" style="background:#b3261e">Remove wallet</button>
    <button class="btn ghost" id="wipeCancel">Keep my wallet</button>`);
  $("wipeCancel").onclick = () => closeSheet();
  $("wipeGo").onclick = () => {
    localStorage.removeItem(VAULT_KEY); localStorage.removeItem("fluid_name");
    wallet = null; pendingSend = null;
    // Leave no trace of the removed wallet on the onboarding screen:
    // a seed phrase or password must never linger in the form after removal.
    $("seedOut").textContent = ""; show("seedBox", false);
    $("seedCheck").checked = false;
    for (const id of ["createPw", "createPw2", "importPhrase", "unlockPw", "createName"]) { const el = $(id); if (el) el.value = ""; }
    msg("onboardMsg", "");
    closeSheet(); refreshGate();
  };
};

refreshGate();

// ---------- Agentic wallets ----------
// Agents are stored as PUBLIC descriptors only (name, index, addresses,
// policy). Keys are derived from the seed in memory, only while unlocked,
// and never leave the wallet. Agent access is chain-only: no KYC, no ramps.
const AGENTS_KEY = "fluid_agents_v1";
const AGENT_SPEND_KEY = "fluid_agent_spend_v1";
const loadAgents = () => { try { return JSON.parse(localStorage.getItem(AGENTS_KEY) || "[]"); } catch { return []; } };
const saveAgents = (a) => localStorage.setItem(AGENTS_KEY, JSON.stringify(a));
function agentSpentToday(index) {
  try { const s = JSON.parse(localStorage.getItem(AGENT_SPEND_KEY) || "{}"); const t = new Date().toISOString().slice(0, 10); return s[t + ":" + index] || 0; } catch { return 0; }
}
function recordAgentSpend(index, usdAmt) {
  const s = (() => { try { return JSON.parse(localStorage.getItem(AGENT_SPEND_KEY) || "{}"); } catch { return {}; } })();
  const k = new Date().toISOString().slice(0, 10) + ":" + index; s[k] = (s[k] || 0) + usdAmt;
  localStorage.setItem(AGENT_SPEND_KEY, JSON.stringify(s));
}
function renderAgents() {
  const list = loadAgents().filter(a => !a.owner || !wallet || a.owner === wallet.address);
  $("agentList").innerHTML = list.map(a =>
    `<div style="border-top:1px solid #26314d;padding:8px 0"><b>${a.name}</b> <span class="tag">caps $${a.policy.perTxCapUsd}/tx · $${a.policy.dailyCapUsd}/day · no ramps · no KYC</span><br>` +
    `<span class="mono" style="font-size:11px">EVM ${a.keys.evm}</span><br><span class="mono" style="font-size:11px">BTC ${a.keys.btc}</span></div>`).join("");
}
$("createAgentBtn").onclick = () => {
  if (!wallet) return msg("agentMsg", "Unlock your wallet first.");
  const name = $("agentNameInput").value.trim();
  if (name.length < 2) return msg("agentMsg", "Give the agent a name (2+ characters).");
  const agents = loadAgents();
  if (agents.some(a => a.name.toLowerCase() === name.toLowerCase())) return msg("agentMsg", "You already have an agent with that name.");
  const index = agents.length;
  const keys = agentAddresses(wallet.mnemonic.phrase, index);
  const descriptor = buildAgentDescriptor({ name, index, evm: keys.evm, btc: keys.btc });
  agents.push({ name, index, keys, policy: descriptor.policy, owner: wallet.address });
  saveAgents(agents); renderAgents();
  $("agentDescriptor").textContent = JSON.stringify(descriptor, null, 1);
  show("agentBox");
  msg("agentMsg", `Agent wallet created for ${name} — separate account, full chain access, no KYC, no ramps.`, true);
};
$("copyAgentBtn").onclick = () => copyText($("agentDescriptor").textContent, $("copyAgentBtn"));
renderAgents();

// Owner approval for an agent transfer, as an in-app sheet — never a native
// dialog: those get swallowed in some phone webviews, which for a security
// approval both looks broken and trains blind tapping elsewhere. The full
// intent is on screen BEFORE any button: agent, amount, the destination
// address in full (never truncated — this is a security surface), network,
// and the policy check result. Resolves true ONLY on an explicit Approve
// tap; Reject, the X, the scrim, or the sheet being replaced by another
// sheet all resolve false, so the agent's promise never hangs.
function askAgentApproval({ a, net, to, amt, usdAmt, price, spentToday }) {
  return new Promise((resolve) => {
    const settle = (v) => { sheetCloseHook = null; closeSheet(); resolve(v); };
    const policyLine = price
      ? `✅ <b>Policy check passed</b> — value ≈ ${usd(usdAmt)}; caps $${a.policy.perTxCapUsd} per transfer and $${a.policy.dailyCapUsd} per day (this agent has spent ${usd(spentToday)} today).`
      : `⚠️ <b>Price unknown</b> — the dollar policy caps could not be checked for this transfer. Check the amount and destination extra carefully.`;
    openSheet(`<h3>🤖 Agent transfer request</h3>
      <p class="tag">An agent is asking to spend from its own agent wallet. Nothing moves unless you tap Approve.</p>
      <p><b>Agent:</b> ${a.name} <span class="tag">(agent #${a.index})</span></p>
      <p><b>Send:</b> ${amt} ${net.symbol} on ${net.name}</p>
      <p><b>To — full destination address:</b></p>
      <p class="mono" style="word-break:break-all">${to}</p>
      <p><b>From — the agent's wallet:</b></p>
      <p class="mono" style="word-break:break-all">${a.keys.evm}</p>
      <p>${policyLine}</p>
      <button class="btn" id="agentApprove">Approve &amp; sign with the AGENT wallet</button>
      <button class="btn ghost" id="agentReject">Reject</button>`);
    sheetCloseHook = () => resolve(false); // dismissed without a decision = rejected
    $("agentApprove").onclick = () => settle(true);
    $("agentReject").onclick = () => settle(false);
  });
}

// The agent-facing API. An agent (script, bot, another app on this device)
// can READ public info and REQUEST a transfer. It can never sign: every
// request pops a human-readable approval to the owner, policy caps are
// enforced first, and the transfer is signed by the agent account's key
// inside the wallet only after the owner taps Approve.
window.FluidAgent = {
  list: () => loadAgents().map(a => ({ name: a.name, keys: a.keys, policy: a.policy })),
  async requestTransfer({ agent, to, amount, network } = {}) {
    if (!wallet) throw new Error("Fluid is locked — the owner must unlock first.");
    const agents = loadAgents();
    const a = agents.find(x => x.name === agent) || agents[0];
    if (!a) throw new Error("No agent wallet exists yet — the owner creates one in More → Agentic wallet.");
    const netKey = network || networkKey;
    const net = NETWORKS[netKey];
    if (!net) throw new Error("Unknown network: " + netKey);
    const amt = Number(amount);
    if (!ethersIsAddress(to)) throw new Error("Invalid destination address.");
    const price = prices[net.symbol] || 0;
    const usdAmt = price ? amt * price : 0;
    const gate = checkAgentPolicy(a.policy, price ? usdAmt : 0.0001, agentSpentToday(a.index));
    if (price && !gate.ok) throw new Error("Policy blocked: " + gate.reason);
    const ok = await askAgentApproval({ a, net, to, amt, usdAmt, price, spentToday: agentSpentToday(a.index) });
    if (!ok) throw new Error("Owner declined.");
    const tx = await sendFromAgent(wallet.mnemonic.phrase, a.index, netKey, to, amt);
    if (price) recordAgentSpend(a.index, usdAmt);
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    h.unshift({ hash: tx.hash, amount: String(amt), symbol: net.symbol, to, explorer: net.explorer, at: Date.now(), agent: a.name });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
    return { hash: tx.hash, from: a.keys.evm, network: netKey };
  },
};
function ethersIsAddress(x) { return /^0x[0-9a-fA-F]{40}$/.test(String(x || "")); }
