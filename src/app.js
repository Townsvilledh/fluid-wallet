// Fluid v2 — app-shell UI. Keys live only in memory while unlocked;
// the only thing persisted is the standard encrypted keystore JSON.
import "./buffer-shim.js"; // must stay first: @solana/web3.js needs Buffer
import QRCode from "qrcode";
import {
  NETWORKS, createVault, importVault, unlockVault, validatePassword, needsKdfUpgrade, reencryptVault,
  getBalances, estimateSend, executeSend, formatSendIntent,
  mtpelerinBuyUrl, mtpelerinSellUrl, rampRoutesFor, RAMP_COUNTRIES, fetchPaycrestNgnBuyRate, fetchPaycrestRate, getPrices,
  bitcoinAddress, bitcoinTaprootAddress, getBitcoinBalance, planBitcoinSend, broadcastBitcoinTx, feeRateNote, payLightningInvoice,
  getInscriptions, getRuneBalances, planRuneTransfer, formatInscriptionRow, formatRuneRow,
  litecoinAddress, getLitecoinBalance, planLitecoinSend, broadcastLitecoinTx, isValidLitecoinAddress, formatLitecoinSendIntent,
  dogecoinAddress, getDogecoinBalance, isValidDogeAddress, DOGE_MIN_OUTPUT,
  planDogecoinSend, broadcastDogeTx, formatDogeSendIntent,
  bitcoinCashAddress, getBitcoinCashBalance, planBitcoinCashSend, broadcastBitcoinCashTx, isValidBchAddress, formatBitcoinCashSendIntent,
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
  escapeHtml, sanitizePersistedSymbol, historyTxUrl, formatHistoryEntry, formatApprovalRow, formatRevokePrompt, formatWelcomeHeader, fluidStorageKeysToWipe, toChecksumAddress,
  stacksAddressFromPhrase, fetchStacksAccount, planStacksSend, sendStacks, isValidStacksAddress, stxMicroToStx, stacksRawToAmount, stacksExplorerTxUrl, STACKS_TOKENS, STACKS_EXPLORER,
  cosmosAddresses, getCosmosBalances, getCosmosAllBalances, sendCosmos, estimateCosmosFee, isValidCosmosAddress, formatCosmosSendIntent, COSMOS_CHAINS,
  RECEIVE_NETWORKS, filterReceiveNetworks, receiveNetworkMatches, cosmosSendSelection,
  FLUID_DOMAIN, validateFluidName, normalizeFluidName, buildNameEntry, resolveFluidName, resolveChainRecipient, fetchNameRegistry, findNameForAddresses, lightningInvoiceForAddress,
  lnErrorText, parseSisPathsInput, lnReceiveTransition, lnReceiveView,
  AGENT_POLICY_DEFAULTS, agentAddresses, agentEvmWallet, buildAgentDescriptor, checkAgentPolicy, sendFromAgent,
  LIFI_NATIVE_TOKEN, getSwapRoutes, rankSwapRoutes, swapRouteExecutable, executeSwapRoute, executeRelaySwapRoute, executeTronSwapRoute, executeSuiSwapRoute, TRON_EXPLORER, formatSwapIntent, swapAmountToRaw, swapRawToAmount, platformFeeOn, swapFeeCollectingChain,
  looksLikePoison, looksLikePoisonText, revokeApproval, revokeTronApproval, scanOnChainAllowances, LIFI_DIAMOND,
  registerNetworks, fetchEvmChainSources, gateChains, probeChain, fetchStableTokens,
  fetchLifiTokenList, lifiTokenVerified, getDexScreenerTokenInfo, dexChainIdForEvmChain,
  scanEvmTokenBalances, getEvmTokenBalance, readEvmTokenMeta, formatTokenAmount,
  classifyLightningTarget, resolveBip353Address, parseBolt11, holdWindowCopy, fundingAddressFromScript,
  detectScanFamily, scanTargetsForName, scanTargetsForAddress, fetchScan, mergeScanRows,
  formatScanFeedEntry, scanChainStatusText, scanChainBadge, scanTxUrl, scanAddressUrl,
  WALLETCONNECT_PROJECT_ID, walletConnectConfigured, parseWcUri, describeWcProposal, buildWcNamespaces,
  decodeWcRequest, wcSessionSummary, signWcMessage, signWcTypedData, executeWcTransaction, evmNetworkKeyForChainId,
  sortHomeFamilies, sortHomeRows,
} from "./wallet-core.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const HISTORY_KEY = "fluid_history_v1";
const APPROVALS_KEY = "fluid_approvals_v1";
const CHAINS_KEY = "fluid_chains_v1";
const HISTORY_MAX = 100; // §4.9: history storage cap (was 20)
// ---------- view context (§4.2 universal network picker) ----------
// viewKey scopes the WHOLE wallet view: "all" | "evm" (the EVM network
// in networkKey, behaviour unchanged) | a family id from
// RECEIVE_NETWORKS / COSMOS_CHAINS. Persisted per device.
const VIEW_KEY_LS = "fluid_view_v1";
const SHOW_ZERO_LS = "fluid_show_zero_v1";
let viewKey = "all";
try { const v = localStorage.getItem(VIEW_KEY_LS); if (v) viewKey = v; } catch { /* storage unavailable */ }
let showZeroBalances = false;
try { showZeroBalances = localStorage.getItem(SHOW_ZERO_LS) === "1"; } catch { /* storage unavailable */ }
const expandedZero = new Set();   // family keys whose "Zero balances" group is expanded
const famLoaded = new Set();      // families whose balance read settled this render (§4.13 skeletons)
function saveViewKey() { try { localStorage.setItem(VIEW_KEY_LS, viewKey); } catch { /* best effort */ } }
const viewMeta = () => RECEIVE_NETWORKS.find(m => m.id === viewKey) || null;
const isCosmosView = () => COSMOS_CHAINS.some(c => c.key === viewKey);
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

let wallet = null, networkKey = "bsc", balances = [], prices = {}, btcAddr = null, btcBal = 0, btcTrAddr = null, btcTrBal = 0, pendingSend = null;
let tronAddr = null, tronBalances = [], tronLoadFailed = false;
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
let ltcAddr = null, ltcBal = 0, ltcLoadFailed = false;
let dogeAddr = null, dogeBal = 0, dogeLoadFailed = false;
let bchAddr = null, bchBal = 0, bchLoadFailed = false;
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
let evmLoadFailed = false; // the curated EVM balance load failed — rows are UNKNOWN, never zero (DOGE precedent)
// Bitcoin has TWO balance reads (SegWit + Taproot) feeding one row:
// each account tracks its own failure, and the family flag is the
// OR — the combined total is unknown if either account is unknown.
let btcSegwitFailed = false, btcTaprootFailed = false, btcLoadFailed = false;
function syncBtcLoadFailed() { btcLoadFailed = btcSegwitFailed || btcTaprootFailed; }
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
// ---------- sheet chrome: busy lock, error banner, toast (§4.7/§4.8) ----------
// While a transaction broadcasts, the sheet is NOT dismissible: the X,
// the scrim and closeSheet() all refuse until the send settles.
let sheetBusy = false;
let sheetGen = 0; // guards the animated close against a same-tick reopen
function openSheet(html) { fireSheetCloseHook(); sheetBusy = false; sheetGen++; const r = $("sheetRoot"); if (r) { r.removeAttribute("data-busy"); r.classList.remove("closing"); } $("sheetBody").innerHTML = html; show("sheetRoot"); }
function closeSheet(force = false) {
  if (sheetBusy && !force) return;
  fireSheetCloseHook();
  const r = $("sheetRoot");
  if (!r || r.classList.contains("hidden")) { show("sheetRoot", false); return; }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { show("sheetRoot", false); return; }
  // Part 5: closing mirrors the entry (translateY + fade, ~190ms). A
  // reopen inside the window bumps sheetGen and cancels the hide.
  const gen = ++sheetGen;
  r.classList.add("closing");
  setTimeout(() => { if (sheetGen === gen) { show("sheetRoot", false); r.classList.remove("closing"); } }, 190);
}
$("sheetX").onclick = () => closeSheet(); $("scrim").onclick = () => closeSheet();
/** Put a confirm button into / out of its broadcasting state:
 *  spinner + "Sending…", disabled, sheet locked (§4.8). */
function setSendBusy(btn, on) {
  if (!btn) return;
  sheetBusy = !!on;
  const root = $("sheetRoot"); if (root) { if (on) root.setAttribute("data-busy", "1"); else root.removeAttribute("data-busy"); }
  if (on) {
    if (btn.dataset.label == null) btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>Sending…`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label != null) { btn.innerHTML = btn.dataset.label; delete btn.dataset.label; }
  }
}
/** A broadcast failure: sheet stays open, the error lands in a banner
 *  at the TOP of the sheet — never a silent close (§4.8). */
function showSheetError(text) {
  const body = $("sheetBody"); if (!body) return;
  let b = $("sheetBanner");
  if (!b) { b = document.createElement("div"); b.id = "sheetBanner"; body.prepend(b); }
  b.className = "banner err";
  b.innerHTML = `<svg class="ic"><use href="#i-alert"/></svg><span></span>`;
  b.querySelector("span").textContent = text;
}
/** Send-confirm failure path shared by every family sheet. */
function sendFailed(btn, msgId, e, prefix = "Send failed: ") {
  setSendBusy(btn, false);
  if (msgId) msg(msgId, "");
  showSheetError(prefix + ((e && (e.shortMessage || e.message)) || e));
}
/** Tiny toast for micro-confirmations ("Copied", "Name resolved"). */
let toastTimer = null;
function toast(text) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}
/** The review step's balance-impact line (§4.8, Pera-style): rendered
 *  as its own line UNDER the intent sentence. fee is subtracted only
 *  when it is denominated in the sent asset; otherwise the line is
 *  labelled "before network fee" — never a wrong number. */
function setBalanceAfter(intentTextEl, { balance, amount, fee = null, symbol, decimals = 6 }) {
  if (!intentTextEl || !intentTextEl.parentElement) return;
  let el = intentTextEl.parentElement.querySelector(".balafter");
  if (!el) { el = document.createElement("p"); el.className = "balafter"; intentTextEl.after(el); }
  const bal = Number(balance), amt = Number(amount);
  if (!Number.isFinite(bal) || !Number.isFinite(amt)) { el.textContent = ""; return; }
  const f = fee != null && Number.isFinite(Number(fee)) ? Number(fee) : null;
  const after = f != null ? bal - amt - f : bal - amt;
  el.textContent = `Balance after: ${fmt(after, decimals)} ${symbol}` + (f == null ? " (before network fee)" : "");
}
/** Activity nav dot (§4.6): set on a completed send, cleared when the
 *  Activity tab is opened. */
function markActivityDot() { const d = $("activityDot"); if (d) d.classList.remove("hidden"); }
function clearActivityDot() { const d = $("activityDot"); if (d) d.classList.add("hidden"); }
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

// ---------- icons + token logos (§4.5) ----------
const icon = (name, cls = "ic") => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
/** The letter tile — the logo resolver's LAST resort (§4.5 step 4). */
function letterTileHtml(sym) {
  const s = String(sym || "?");
  return `<span class="coin" style="background:${COIN_COLORS[s] || "#3b4a7a"}">${esc(s.slice(0, 1))}</span>`;
}
/** spothq cryptocurrency-icons URL for a symbol (step 3) — the symbol
 *  is sanitised to [a-z0-9] before interpolation (hostile metadata). */
function spothqUrl(symbol) {
  const s = String(symbol || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return s ? `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@0.18.1/svg/color/${s}.svg` : null;
}
const TW_CHAIN = { ethereum: "ethereum", bsc: "smartchain", base: "base", arbitrum: "arbitrum",
  polygon: "polygon", optimism: "optimism", avalanche: "avalanchec" };
/** Token logo markup — the ONLY builder of logo <img>s (§4.5/§6).
 *  Resolution order (first hit wins):
 *  1. token.logoURI from a list that provides one (LI.FI), validated
 *     with new URL() + https: before use;
 *  2. EVM contract → Trust Wallet assets CDN, constructed here from
 *     the checksummed address (network key → TW chain slug);
 *  3. natives/majors by symbol → the pinned spothq icon set;
 *  4. the letter tile.
 *  A failed <img> walks DOWN the same chain via the delegated error
 *  listener below (no inline onerror — the CSP forbids it). */
function tokenLogoHtml(token, familyId) {
  const sym = String((token && token.symbol) || "?");
  let src = null, step = "";
  const uri = token && token.logoURI;
  if (uri) {
    try { const u = new URL(uri); if (u.protocol === "https:") { src = u.href; step = "uri"; } } catch { /* fall through */ }
  }
  if (!src && token && token.address) {
    const evmKey = familyId === "evm" ? networkKey : (TW_CHAIN[familyId] ? familyId : null);
    const tw = evmKey ? TW_CHAIN[evmKey] : null;
    const cs = tw ? toChecksumAddress(token.address) : null;
    if (tw && cs) { src = `https://assets.trustwalletapp.com/blockchains/${tw}/assets/${cs}/logo.png`; step = "tw"; }
  }
  if (!src) { src = spothqUrl(sym); step = "spothq"; }
  if (!src) return letterTileHtml(sym);
  return `<img class="coin-img" src="${esc(src)}" data-step="${step}" data-symbol="${esc(sym)}" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="">`;
}
// One delegated capture-phase listener walks a failed logo DOWN the
// resolution chain (uri/tw → spothq → letter tile) and removes failed
// chain badges. Attached once; covers every list render.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.classList.contains("coin-badge")) { img.remove(); return; }
  if (!img.classList.contains("coin-img")) return;
  const step = img.dataset.step;
  if (step === "uri" || step === "tw") {
    const next = spothqUrl(img.dataset.symbol);
    if (next && img.src !== next) { img.dataset.step = "spothq"; img.src = next; return; }
  }
  const holder = document.createElement("span");
  holder.innerHTML = letterTileHtml(img.dataset.symbol);
  img.replaceWith(holder.firstElementChild);
}, true);
// Chain badges (§4.5): a symbol living on more than one network gets
// the network's own icon at its logo's corner in the All view.
let dupSymbols = new Set();
const FAMILY_NATIVE_SYM = { bitcoin: "BTC", litecoin: "LTC", dogecoin: "DOGE", bitcoincash: "BCH",
  tron: "TRX", solana: "SOL", sui: "SUI", stellar: "XLM", ton: "TON", near: "NEAR",
  algorand: "ALGO", xrpl: "XRP", polkadot: "DOT", aptos: "APT", stacks: "STX" };
function badgeHtml(b, famKey) {
  if (viewKey !== "all" || !b || !dupSymbols.has(b.symbol)) return "";
  const nat = famKey === "evm" ? NETWORKS[networkKey].symbol : FAMILY_NATIVE_SYM[famKey];
  const u = nat ? spothqUrl(nat) : null;
  return u ? `<img class="coin-badge" src="${esc(u)}" width="14" height="14" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="">` : "";
}

// ---------- THE send-confirmation moment (§4.8) ----------
// One shared success view for EVERY send path and swap completion.
// The caller writes history exactly as before (same entry shape)
// BEFORE calling this; the helper replaces the sheet content with the
// animated check + recap, and Done returns to a refreshed wallet.
function showTxSuccess({ verb, amount, symbol, logoHtml, to, toName, familyName, feeText, explorerUrl, txid, pending }) {
  setSendBusy(null, false); sheetBusy = false;
  const root = $("sheetRoot"); if (root) root.removeAttribute("data-busy");
  try { navigator.vibrate && navigator.vibrate(15); } catch { /* unsupported — fine */ }
  const usdPart = (() => {
    const p = prices[String(symbol || "").split("→")[0]];
    const a = Number(amount);
    return p != null && Number.isFinite(a) ? ` <span class="dim">≈ ${usd(a * p)}</span>` : "";
  })();
  const short = (a) => { const s = String(a || ""); return s.length > 14 ? s.slice(0, 8) + "…" + s.slice(-6) : s; };
  const toLine = toName ? `${esc(toName)}.${FLUID_DOMAIN} · ${esc(short(to))}` : esc(short(to));
  const txShort = txid ? esc(short(txid)) : "";
  openSheet(`<div class="txsuccess">
    <div class="txbadge"><svg viewBox="0 0 72 72" class="txring"><defs><linearGradient id="txgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#9d6bff"/></linearGradient></defs><circle cx="36" cy="36" r="32" fill="none" stroke="url(#txgrad)" stroke-width="3"/><path d="M24 37.5 32.5 46 49 28" fill="none" stroke="url(#txgrad)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h3 class="t-screen txverb">${esc(verb || "Sent")}</h3>
    ${pending ? `<p class="tag txcap">Confirming on ${esc(familyName || "the network")} — follow it in Activity</p>` : ""}
    ${amount != null && amount !== "" ? `<p class="txamt">${logoHtml || ""}<span><b>${esc(fmt(amount, 8))} ${esc(symbol || "")}</b>${usdPart}</span></p>` : ""}
    <div class="card txrecap">
      ${to ? `<div class="txrow"><span>To</span><b>${toLine}</b></div>` : ""}
      ${familyName ? `<div class="txrow"><span>Network</span><b>${esc(familyName)}</b></div>` : ""}
      ${feeText ? `<div class="txrow"><span>Fee</span><b>${esc(feeText)}</b></div>` : ""}
      ${txid ? `<div class="txrow"><span>Tx</span><b class="mono" id="txCopy" title="Tap to copy the full transaction id">${txShort} ⧉</b></div>` : ""}
    </div>
    ${explorerUrl ? `<button class="btn ghost" id="txExplorer">View on explorer ↗</button>` : ""}
    <button class="btn" id="txDone">Done</button>
  </div>`);
  if (txid) { const c = $("txCopy"); if (c) c.onclick = () => { copyText(String(txid), c); toast("Copied"); }; }
  const ex = $("txExplorer");
  if (ex && explorerUrl) ex.onclick = () => window.open(explorerUrl, "_blank", "noopener");
  $("txDone").onclick = () => { closeSheet(true); markActivityDot(); renderMain(); };
}

// ---------- tabs ----------
function goTab(name) {
  for (const t of ["wallet", "play", "activity", "scan", "more"]) show("tab-" + t, t === name);
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  if (name === "activity") clearActivityDot();
  const pane = $("tab-" + name);
  if (pane) { pane.classList.remove("tabenter"); void pane.offsetWidth; pane.classList.add("tabenter"); }
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => goTab(b.dataset.tab));
$("playJump").onclick = () => goTab("play");
$("notifyBtn").onclick = () => {
  localStorage.setItem("fluid_ogo_notify", "1");
  msg("notifyMsg", "You're on the list — on this device. Launch news will also be posted in the GitHub repo.", true);
};

// ---------- gate ----------
// Lock-screen recovery: a stored vault used to trap anyone who
// forgot the password — the gate hid the create/import box (the only
// import form) whenever a vault existed, and the lock screen offered
// nothing but Unlock. Recovery needs no new flow: a confirmed detour
// (see lockRestoreBtn) back to the SAME onboarding box, whose create
// and import handlers remain the only paths that write the vault.
let restoreMode = false;
let gateWasLocked = true;
function refreshGate() {
  const hasVault = !!localStorage.getItem(VAULT_KEY);
  if (wallet) restoreMode = false; // reaching the app ends the detour
  show("onboard", !wallet);
  show("unlockBox", hasVault && !wallet && !restoreMode);
  show("createBox", (!hasVault || restoreMode) && !wallet);
  show("restoreBackBtn", restoreMode && !wallet && hasVault);
  show("app", !!wallet);
  // Entering the app (create, import, or unlock) always lands on
  // the Wallet home (QA F14): the tab panes are DOM state, so
  // without this an import finished after browsing Settings would
  // reopen on Settings, unlike a fresh create.
  if (wallet && gateWasLocked) goTab("wallet");
  gateWasLocked = !wallet;
  if (wallet) renderMain();
  // Wake-up deep link: a Lightning push notification lands on
  // /#lightning — open the node panel once per arrival so held
  // payments settle.
  if (wallet && location.hash === "#lightning" && !window.__lnDeepLinkDone) {
    window.__lnDeepLinkDone = true;
    history.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => openLightningPanel(), 350);
  }
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
  // Snapshot the wallet for the whole render: this function awaits
  // (prices, balances) while the auto-lock / lock button can null
  // the global at any moment, and every derivation below reads
  // w.mnemonic. Without the snapshot, a lock landing mid-render
  // threw "Cannot read properties of null (reading 'mnemonic')"
  // as an unhandled rejection (live WC QA walk, 2026-11-08) — the
  // gate already owned the screen by then, so the correct move is
  // to abandon the stale render, never to dereference the lock.
  const w = wallet;
  if (!w) return;
  // The name-section description (#namePreview) is painted by
  // renderNameSection() below — its only writer (QA round 3). A
  // set-only write here used to leave the previous wallet's name
  // in the description across a remove + import.
  renderAgents();
  famLoaded.clear();
  paintHeader();
  // Bounded: getPrices has no timeout of its own, and renderMain awaits
  // it before ANY balance load fires — a stalled price fetch used to
  // stall the whole render (and the More-tab Refresh with it) while
  // looking like nothing happened. Prices degrade to {} on timeout.
  try {
    prices = await Promise.race([
      getPrices(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("prices timed out")), 10000)),
    ]);
  } catch { prices = {}; }
  if (wallet !== w) return; // locked (or wallet switched) while prices loaded
  // Bitcoin first (all chains, one wallet)
  btcAddr = bitcoinAddress(w.mnemonic.phrase);
  // Fluid name: paint the owned/claim state, then (once per session) try
  // to adopt a registry name that already belongs to this wallet — a
  // restored wallet whose name was published earlier should SEE its name,
  // not an empty claim form that rejects the name as "already claimed".
  renderNameSection();
  adoptRegistryNameIfMine();
  // A failed Bitcoin load is UNKNOWN, not zero (EVM precedent): each
  // account tracks its own failure, and the family flag is the OR.
  // Flags reset at load start so a Refresh can clear them.
  btcSegwitFailed = btcTaprootFailed = false; btcLoadFailed = false;
  getBitcoinBalance(btcAddr).then(b => { btcBal = b; btcSegwitFailed = false; syncBtcLoadFailed(); famLoaded.add("bitcoin"); paintAssets(); }).catch(() => { btcSegwitFailed = true; syncBtcLoadFailed(); famLoaded.add("bitcoin"); paintAssets(); });
  // Taproot (BIP86) — a second Bitcoin account from the same seed
  // (Build B): its own address and balance, rolled into the BTC totals.
  btcTrAddr = bitcoinTaprootAddress(w.mnemonic.phrase);
  getBitcoinBalance(btcTrAddr).then(b => { btcTrBal = b; btcTaprootFailed = false; syncBtcLoadFailed(); famLoaded.add("bitcoin"); paintAssets(); }).catch(() => { btcTaprootFailed = true; syncBtcLoadFailed(); famLoaded.add("bitcoin"); paintAssets(); });
  // Tron next (a family like Bitcoin, not an EVM network): same key as
  // the EVM account, its own rows, painted with zero placeholders until
  // TronGrid answers.
  tronAddr = tronAddressFromPhrase(w.mnemonic.phrase);
  tronBalances = [{ symbol: "TRX", amount: "0", address: null, decimals: 6 },
                  ...TRON_TOKENS.map(t => ({ ...t, amount: "0" }))];
  tronLoadFailed = false;
  loadFamilyRows(() => getTronAllTokens(tronAddr), () => getTronBalances(tronAddr), "tron")
    .then(rows => {
      if (rows) tronBalances = rows;
      else {
        // BOTH the scan and the curated read failed (TronGrid 429s
        // did exactly this on sweep day): the placeholders above are
        // NOT balances. Mark the curated rows unknown (null) so they
        // render "couldn't load" under a load-failure alert — never
        // silent zeros dressed as a loaded wallet.
        tronLoadFailed = true;
        tronBalances = tronBalances.map(b => ({ ...b, amount: null }));
      }
      famLoaded.add("tron"); paintAssets();
    });
  // Solana (a family like Bitcoin/Tron, not an EVM network): SLIP-0010
  // Ed25519 branch of the same seed, its own rows, painted with zero
  // placeholders until the RPC answers.
  solAddr = solanaAddressFromPhrase(w.mnemonic.phrase);
  solBalances = [{ symbol: "SOL", amount: "0", address: null, decimals: 9 },
                 ...SOLANA_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSolanaAllTokens(solAddr), () => getSolanaBalances(solAddr), "solana")
    .then(rows => { if (rows) solBalances = rows; famLoaded.add("solana"); paintAssets(); });
  // Sui (Phase 2b): SLIP-0010 Ed25519 branch (coin type 784) of the
  // same seed — the same derivation family as Solana, Sui's own path.
  // Also the future home of the OGO ERA Companion NFT.
  suiAddr = suiAddressFromPhrase(w.mnemonic.phrase);
  suiBalances = [{ symbol: "SUI", amount: "0", address: null, decimals: 9 },
                 ...SUI_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSuiAllBalances(suiAddr), () => getSuiBalances(suiAddr), "sui")
    .then(rows => { if (rows) suiBalances = rows; famLoaded.add("sui"); paintAssets(); });
  // Stellar (Phase 3b): SLIP-0010 Ed25519 branch (coin type 148) of
  // the same seed. The single account read IS the all-asset read
  // (XLM + every trustline). An unfunded account is a state — "not
  // yet activated" — painted honestly; a failed read keeps the
  // placeholder row plus a "couldn't load" note, never a fake zero.
  stellarAddr = stellarAddressFromPhrase(w.mnemonic.phrase);
  stellarBalances = [{ symbol: "XLM", name: "Stellar Lumens", amount: "0", address: null, assetCode: null, issuer: null, decimals: 7, verified: true }];
  stellarFunded = null; stellarLoadFailed = false;
  getStellarAccount(stellarAddr)
    .then(acct => { stellarBalances = acct.balances; stellarFunded = acct.funded; famLoaded.add("stellar"); paintAssets(); })
    .catch(() => { stellarLoadFailed = true; famLoaded.add("stellar"); paintAssets(); });
  // Phase 4 — payments-grade families: TON (SLIP-0010 coin 607,
  // Wallet V4R2), NEAR (coin 397, implicit account), Algorand (coin
  // 283), XRP Ledger (BIP44 secp256k1 coin 144), Polkadot Asset Hub
  // (Sr25519, Substrate derivation). Each follows the Stellar
  // discipline: placeholder rows, honest state notes on failure —
  // never a fake zero presented as a loaded balance.
  tonAddr = tonAddressFromPhrase(w.mnemonic.phrase);
  tonBalances = [{ symbol: "TON", name: "Toncoin", amount: "0", address: null, decimals: 9, verified: true },
                 { ...TON_USDT, amount: "0" }];
  tonState = null; tonLoadFailed = false;
  getTonAccount(tonAddr)
    .then(acct => { tonBalances = acct.balances; tonState = acct.state; famLoaded.add("ton"); paintAssets(); })
    .catch(() => { tonLoadFailed = true; famLoaded.add("ton"); paintAssets(); });
  nearAddr = nearAddressFromPhrase(w.mnemonic.phrase);
  nearBalances = [{ symbol: "NEAR", name: "NEAR", amount: "0", address: null, decimals: 24, verified: true },
                  ...NEAR_TOKENS.map(t => ({ ...t, amount: "0" }))];
  nearExists = null; nearLoadFailed = false;
  getNearAccount(nearAddr)
    .then(acct => { nearBalances = acct.balances; nearExists = acct.exists; famLoaded.add("near"); paintAssets(); })
    .catch(() => { nearLoadFailed = true; famLoaded.add("near"); paintAssets(); });
  algoAddr = algoAddressFromPhrase(w.mnemonic.phrase);
  algoBalances = [{ symbol: "ALGO", name: "Algorand", amount: "0", address: null, decimals: 6, verified: true },
                  { ...ALGO_USDC, amount: "0" }];
  algoFunded = null; algoLoadFailed = false;
  getAlgorandAccount(algoAddr)
    .then(acct => { algoBalances = acct.balances; algoFunded = acct.funded; famLoaded.add("algorand"); paintAssets(); })
    .catch(() => { algoLoadFailed = true; famLoaded.add("algorand"); paintAssets(); });
  xrpAddr = xrplAddressFromPhrase(w.mnemonic.phrase);
  xrpBalances = [{ symbol: "XRP", name: "XRP", amount: "0", address: null, decimals: 6, verified: true }];
  xrpFunded = null; xrpLoadFailed = false;
  getXrplAccount(xrpAddr)
    .then(acct => { xrpBalances = acct.balances; xrpFunded = acct.funded; famLoaded.add("xrpl"); paintAssets(); })
    .catch(() => {
      // A failed read is UNKNOWN, not zero (QA F12): the row carries
      // amount null and renders "couldn't load" — never a $0.00
      // presented as a loaded balance.
      xrpLoadFailed = true;
      xrpBalances = [{ symbol: "XRP", name: "XRP", amount: null, address: null, decimals: 6, verified: true }];
      famLoaded.add("xrpl"); paintAssets();
    });
  dotAddr = dotAddressFromPhrase(w.mnemonic.phrase);
  dotBalances = [{ symbol: "DOT", name: "Polkadot", amount: "0", address: null, decimals: 10, verified: true },
                 ...DOT_TOKENS.map(t => ({ ...t, amount: "0" }))];
  dotExists = null; dotLoadFailed = false;
  getDotAccount(dotAddr)
    .then(acct => { dotBalances = acct.balances; dotExists = acct.exists; famLoaded.add("polkadot"); paintAssets(); })
    .catch(() => { dotLoadFailed = true; famLoaded.add("polkadot"); paintAssets(); });
  // Aptos (Phase 5): SLIP-0010 Ed25519 branch (coin type 637, the
  // Petra path) of the same seed. The account read reports existence
  // honestly — an address the chain has never seen is "not yet
  // created", not a fake zero — and a failed read keeps the
  // placeholder rows plus a note.
  aptosAddr = aptosAddressFromPhrase(w.mnemonic.phrase);
  aptosBalances = [{ symbol: "APT", name: "Aptos", amount: "0", address: null, decimals: 8, verified: true },
                   ...APTOS_TOKENS.map(t => ({ ...t, amount: "0", verified: true }))];
  aptosExists = null; aptosLoadFailed = false; aptosScanFailed = false;
  getAptosAccount(aptosAddr)
    .then(acct => { aptosBalances = acct.balances; aptosExists = acct.exists; aptosScanFailed = acct.scanFailed; famLoaded.add("aptos"); paintAssets(); })
    .catch(() => { aptosLoadFailed = true; famLoaded.add("aptos"); paintAssets(); });
  // Stacks (Bitcoin L2): BIP44 coin-5757 branch of the same seed. STX +
  // every SIP-010 balance via Hiro; pinned tokens (sBTC, USDA) verified,
  // everything else unverified (⚠) with contract-read metadata.
  stacksAddr = stacksAddressFromPhrase(w.mnemonic.phrase);
  stacksBalances = [{ symbol: "STX", name: "Stacks", amount: "0", decimals: 6, verified: true, contract: null },
                    ...STACKS_TOKENS.map(t => ({ ...t, amount: "0", balanceRaw: "0", verified: true }))];
  stacksLoadFailed = false; stacksScanFailed = false;
  fetchStacksAccount(stacksAddr)
    .then(acct => {
      famLoaded.add("stacks");
      if (acct.scanFailed) { stacksScanFailed = true; paintAssets(); return; }
      stacksBalances = [{ symbol: "STX", name: "Stacks", amount: stxMicroToStx(acct.stxUstx), decimals: 6, verified: true, contract: null },
                        ...acct.tokens.map(t => ({ ...t, amount: stacksRawToAmount(t.balanceRaw, t.decimals) }))];
      paintAssets();
    })
    .catch(() => { stacksLoadFailed = true; famLoaded.add("stacks"); paintAssets(); });
  // Bitcoin-family altcoins (Phase 2a): same seed, own branches —
  // Litecoin (BIP84 coin 2), Dogecoin (BIP44 coin 3, legacy),
  // Bitcoin Cash (BIP44 coin 145, CashAddr).
  ltcAddr = litecoinAddress(w.mnemonic.phrase);
  getLitecoinBalance(ltcAddr).then(b => { ltcBal = b; ltcLoadFailed = false; famLoaded.add("litecoin"); paintAssets(); }).catch(() => { ltcLoadFailed = true; famLoaded.add("litecoin"); paintAssets(); });
  dogeAddr = dogecoinAddress(w.mnemonic.phrase);
  getDogecoinBalance(dogeAddr).then(b => { dogeBal = b; dogeLoadFailed = false; famLoaded.add("dogecoin"); paintAssets(); }).catch(() => { dogeLoadFailed = true; famLoaded.add("dogecoin"); paintAssets(); });
  bchAddr = bitcoinCashAddress(w.mnemonic.phrase);
  getBitcoinCashBalance(bchAddr).then(b => { bchBal = b; bchLoadFailed = false; famLoaded.add("bitcoincash"); paintAssets(); }).catch(() => { bchLoadFailed = true; famLoaded.add("bitcoincash"); paintAssets(); });
  // Cosmos (Phase 3a): seven chains — six share one account's bytes
  // under their bech32 prefixes; Injective derives at coin type 60
  // (the Keplr path). Rows start as "unavailable"
  // (amount null) and fill in per chain as the public REST endpoints
  // answer; a chain that never answers keeps the honest null instead
  // of a fake zero (the DOGE precedent).
  cosmosAddrs = cosmosAddresses(w.mnemonic.phrase);
  cosmosRows = COSMOS_CHAINS.map(c => ({ ...c, address: cosmosAddrs[c.key], amount: null }));
  paintAssets();
  getCosmosAllBalances(w.mnemonic.phrase).then(rows => { cosmosRows = rows; famLoaded.add("cosmos"); paintAssets(); }).catch(() => { famLoaded.add("cosmos"); paintAssets(); });
  $("assetList").innerHTML = "Loading assets…";
  evmLoadFailed = false;
  try {
    balances = await Promise.race([
      getBalances(w, networkKey),
      new Promise((_, reject) => setTimeout(() => reject(new Error("balance load timed out")), 20000)),
    ]);
  } catch {
    // A failed load is UNKNOWN, not zero: the flag makes paintAssets
    // render "couldn't load" rows under a load-failure alert. (The old
    // code wrote an honest message into #assetList here — and the
    // paintAssets() call on the very next line erased it, which is
    // how the silent $0.00 shipped. The message now lives in the
    // alert, where rendering can't clobber it.)
    evmLoadFailed = true; balances = [];
  }
  famLoaded.add("evm");
  paintAssets();
  hydrateEvmTokens(); // background: custom tokens + full scan of the active chain
  renderHistory();
  discoverChains(); // background, non-blocking; no-ops while the cache is fresh
}

function heroTotal() {
  const net = NETWORKS[networkKey];
  // A failed Bitcoin load is unknown, not $0.00: its contribution
  // stays out of the total (same discipline as the EVM family).
  let t = (btcLoadFailed ? 0 : btcBal + btcTrBal) * (prices.BTC || 0)
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

// ---------- view scoping (§4.2): per-family USD totals ----------
// Reads the SAME per-family balance variables heroTotal() sums — no
// new fetching. heroTotal() stays the "all" total; scoped views read
// their slice here.
function familyUsdTotals() {
  const sumRows = (rows, priceFn) => rows.reduce((t, b) => {
    const p = priceOfRow(b, priceFn(b)); return p != null ? t + Number(b.amount) * p : t;
  }, 0);
  const m = {};
  // A failed Bitcoin load is unknown, not $0.00: the card total is
  // null (renders "—") and the unknown rows stay out of the total.
  m.bitcoin = btcLoadFailed ? null : (btcBal + btcTrBal) * (prices.BTC || 0);
  m.litecoin = ltcBal * (prices.LTC || 0);
  m.dogecoin = dogeBal * (prices.DOGE || 0);
  m.bitcoincash = bchBal * (prices.BCH || 0);
  const net = NETWORKS[networkKey];
  // A failed EVM load is unknown, not $0.00: the card total is null
  // (renders "—") and the unknown rows stay out of the total, the
  // same discipline as Cosmos' unavailable chains.
  m.evm = evmLoadFailed ? null : sumRows(balances, (b) => b.address ? prices[b.symbol] : prices[net.priceSym]);
  m.tron = sumRows(tronBalances, (b) => prices[b.symbol]);
  m.solana = sumRows(solBalances, (b) => prices[b.symbol]);
  m.sui = sumRows(suiBalances, (b) => prices[b.symbol]);
  m.stellar = sumRows(stellarBalances, (b) => prices[b.symbol]);
  m.ton = sumRows(tonBalances, (b) => prices[b.symbol]);
  m.near = sumRows(nearBalances, (b) => b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol]);
  m.algorand = sumRows(algoBalances, (b) => prices[b.symbol]);
  m.xrpl = sumRows(xrpBalances, (b) => prices[b.symbol]);
  m.polkadot = sumRows(dotBalances, (b) => prices[b.symbol]);
  m.aptos = sumRows(aptosBalances, (b) => prices[b.symbol]);
  m.stacks = sumRows(stacksBalances, (b) => prices[b.symbol]);
  m.lightning = lnSession ? (Number(lnSession.balance().spendableMsat || 0) / 1e11) * (prices.BTC || 0) : null;
  for (const r of cosmosRows) m[r.key] = r.amount == null ? 0 : Number(r.amount) * (prices[r.symbol] || 0);
  return m;
}
function scopedTotal() {
  if (viewKey === "all") return heroTotal();
  const m = familyUsdTotals();
  if (viewKey === "evm") return m.evm;
  return m[viewKey] != null ? m[viewKey] : 0;
}
function viewDisplayName() {
  if (viewKey === "all") return "All networks";
  if (viewKey === "evm") return NETWORKS[networkKey].name;
  const meta = viewMeta();
  return meta ? meta.name : viewKey;
}
/** The header address line for the current view (§4.1/§4.2):
 *  { text, copy } — copy is the full address, or null when the view
 *  has no single copyable address (Lightning). */
function viewAddress() {
  const short = (a) => { const s = String(a || ""); return s.length > 14 ? s.slice(0, 8) + "…" + s.slice(-6) : s; };
  if (viewKey === "all" || viewKey === "evm") return { text: short(wallet.address), copy: wallet.address };
  const byKey = {
    bitcoin: btcAddr, tron: tronAddr, solana: solAddr, sui: suiAddr, stellar: stellarAddr,
    ton: tonAddr, near: nearAddr, algorand: algoAddr, xrpl: xrpAddr, polkadot: dotAddr,
    aptos: aptosAddr, stacks: stacksAddr, litecoin: ltcAddr, dogecoin: dogeAddr, bitcoincash: bchAddr,
  };
  if (viewKey === "lightning") return { text: "Your own Lightning node", copy: null };
  const a = isCosmosView() ? cosmosAddrs[viewKey] : byKey[viewKey];
  return a ? { text: short(a), copy: a } : { text: "", copy: null };
}
/** Header (§4.1) + hero (§4.3) + pill (§4.2) for the current view. */
function paintHeader() {
  if (!wallet) return;
  const pill = $("netBtn");
  if (pill) pill.innerHTML = `${esc(viewDisplayName())} <svg class="ic ic-sm"><use href="#i-chev-d"/></svg>`;
  const totalEl = $("totalUsd");
  if (totalEl) {
    const t = usd(scopedTotal());
    if (totalEl.textContent !== t) { // Part 5: hero number cross-fades on change
      totalEl.textContent = t;
      totalEl.classList.remove("herofade"); void totalEl.offsetWidth; totalEl.classList.add("herofade");
    }
  }
  const sub = $("totalSub");
  if (sub) sub.textContent = viewKey === "all" ? "Across all networks" : `${viewDisplayName()} only`;
  const va = viewAddress();
  const addrEl = $("addrText");
  if (addrEl) {
    addrEl.innerHTML = va.text ? `${esc(va.text)} <svg class="ic ic-sm"><use href="#i-copy"/></svg>` : "";
    addrEl.onclick = va.copy ? () => { copyText(va.copy, addrEl); toast("Copied"); } : null;
  }
  const nameEl = $("welcomeText");
  if (nameEl) {
    const n = localStorage.getItem("fluid_name");
    nameEl.onclick = n ? () => { copyText(n + "." + FLUID_DOMAIN, nameEl); toast("Copied"); } : null;
  }
}

// ---------- universal tokens: asset-list presentation ----------
// Priced + verified tokens form the main list, sorted by USD value.
// Everything else — unverified, or held but unpriced — stays visible
// and fully usable under a collapsed "Other tokens (N)" group per
// family. Token-derived strings are escaped (see esc): a token's
// name is attacker-controlled data.
function tokenRowHtml(b, v, sub, dataAttr, famKey) {
  // §4.5 anatomy: logo | name (+ UNVERIFIED chip) / "SYMBOL · Network"
  // (ONE network mention — the standard moves to the asset sheet) |
  // amount / USD, tabular, right-aligned.
  const title = b.name && b.name !== b.symbol ? b.name : b.symbol;
  const chip = b.verified === false ? ` <span class="vchip">UNVERIFIED</span>` : "";
  // amount null = the read failed: the balance is unknown, and the
  // row says so instead of dressing a placeholder zero as fact.
  const amt = b.amount == null
    ? `<b>—</b><small>couldn't load</small>`
    : `<b>${fmt(b.amount)}</b><small>${v != null ? usd(v) : ""}</small>`;
  return `<div class="row"${dataAttr ? " " + dataAttr : ""}>
      <span class="logowrap">${tokenLogoHtml(b, famKey)}${badgeHtml(b, famKey)}</span>
      <span class="grow"><b class="rname">${esc(title)}${chip}</b><small>${esc(b.symbol)} · ${esc(sub)}</small></span>
      <span class="amt">${amt}</span></div>`;
}
// ---------- zero-balance collapse + skeletons (§4.5/§4.13) ----------
function isNativeRow(famKey, b) {
  if (famKey === "stacks") return !b.contract;
  return !b.address && !b.lpShare;
}
function isCuratedStableEvm(b) {
  return (b.symbol === "USDC" || b.symbol === "USDT") && b.verified !== false && !b.custom;
}
function zeroGroupHtml(famKey, items, renderItem) {
  if (!items.length) return "";
  const open = expandedZero.has(famKey);
  return `<div class="row" data-zero="${famKey}">
      <span class="coin" style="background:#3b4a7a">…</span>
      <span class="grow"><b>Zero balances (${items.length})</b><small>Not held right now — tap to ${open ? "hide" : "show"}.</small></span>
      <span>${open ? "▾" : "▸"}</span></div>` + (open ? items.map(renderItem).join("") : "");
}
function skeletonRowsHtml(n = 3) {
  return Array.from({ length: n }, () => `<div class="skelrow"><span class="skel skelc"></span><span class="skelbars"><span class="skel skelb1"></span><span class="skel skelb2"></span></span></div>`).join("");
}
/** One family's list body: skeleton while loading; otherwise the
 *  verified/priced main rows, the "Other tokens" group, and the
 *  collapsed "Zero balances" group (§4.5) — in that order. */
function familyRowsHtml(famKey, rowsArr, priceOf, renderItem) {
  if (!famLoaded.has(famKey)) return skeletonRowsHtml();
  let visible = rowsArr, zero = [];
  if (!showZeroBalances) {
    visible = []; zero = [];
    for (const b of rowsArr) {
      // amount null is a FAILED read (unknown), never a zero: it
      // stays visible as a "couldn't load" row instead of hiding
      // inside the collapsed Zero balances group.
      if (b.amount != null && Number(b.amount) === 0 && !isNativeRow(famKey, b) && !(famKey === "evm" && isCuratedStableEvm(b))) zero.push(b);
      else visible.push(b);
    }
  }
  const sp = splitRows(visible, priceOf);
  let html = sp.main.map(renderItem).join("");
  html += otherGroupHtml(famKey, sp.other, renderItem);
  if (zero.length) html += zeroGroupHtml(famKey, zero.map(b => ({ b, v: rowUsdValue(b, priceOf(b)) })), renderItem);
  return html;
}
// Load/scan problems surface as a small alert in the group header
// (§4.5) — the message + Retry live in a sheet, never as list prose.
function familyAlertMap() {
  const m = {};
  if (tronLoadFailed) m.tron = "Main Tron balances couldn't be loaded right now.";
  else if (familyScanFailed.tron) m.tron = "Full token scan unavailable — showing main Tron tokens only.";
  if (ltcLoadFailed) m.litecoin = "Litecoin balances couldn't be loaded right now.";
  if (dogeLoadFailed) m.dogecoin = "Dogecoin balances couldn't be loaded right now.";
  if (bchLoadFailed) m.bitcoincash = "Bitcoin Cash balances couldn't be loaded right now.";
  if (btcLoadFailed) m.bitcoin = "Bitcoin balances couldn't be loaded right now.";
  if (familyScanFailed.solana) m.solana = "Full token scan isn't available from the free public Solana endpoints right now — showing main Solana tokens only. Your main tokens above are up to date; the full scan needs an endpoint that serves indexed token lookups, which the free ones currently refuse.";
  if (familyScanFailed.sui) m.sui = "Full token scan unavailable — showing main Sui tokens only.";
  if (stellarLoadFailed) m.stellar = "Stellar balances couldn't be loaded right now.";
  if (tonLoadFailed) m.ton = "TON balances couldn't be loaded right now.";
  if (nearLoadFailed) m.near = "NEAR balances couldn't be loaded right now.";
  if (algoLoadFailed) m.algorand = "Algorand balances couldn't be loaded right now.";
  if (xrpLoadFailed) m.xrpl = "XRP Ledger balances couldn't be loaded right now.";
  if (dotLoadFailed) m.polkadot = "Polkadot Asset Hub balances couldn't be loaded right now.";
  if (aptosLoadFailed) m.aptos = "Aptos balances couldn't be loaded right now.";
  else if (aptosScanFailed) m.aptos = "Full token scan unavailable — showing main Aptos tokens only.";
  if (stacksLoadFailed || stacksScanFailed) m.stacks = "Stacks balances couldn't be loaded right now.";
  if (evmLoadFailed) m.evm = `${NETWORKS[networkKey].name} balances couldn't be loaded right now.`;
  else if (evmScanState.key === networkKey && evmScanState.status === "limited")
    m.evm = `Token scan is limited on ${NETWORKS[networkKey].name} (no Multicall3) — showing known tokens. Any token can still be added by contract address.`;
  else if (evmScanState.key === networkKey && evmScanState.status === "failed")
    m.evm = "Token scan unavailable right now — showing known tokens.";
  if (famLoaded.has("cosmos") && cosmosRows.some(r => r.amount == null))
    m.cosmos = "Some Cosmos chains didn't answer just now — those balances show as unavailable. Receiving still works on every chain.";
  return m;
}
function openFamilyAlert(key) {
  const text = familyAlertMap()[key];
  if (!text) return;
  const meta = RECEIVE_NETWORKS.find(x => x.id === key);
  const title = key === "evm" ? NETWORKS[networkKey].name : key === "cosmos" ? "Cosmos" : (meta ? meta.name : key);
  openSheet(`<h3>${esc(title)}</h3>
    <p class="tag" id="famAlertText">${esc(text)}</p>
    <button class="btn" id="famRetry">Retry</button>`);
  $("famRetry").onclick = () => retryFamily(key, title);
}
/** Retry that VISIBLY re-runs and reports its outcome (QA F12/F13):
 *  the button spins in place; success closes the sheet with a
 *  confirmation toast and the refreshed list behind it; failure
 *  restates the problem in the sheet and re-arms the button. The
 *  old behaviour — close silently and reload everything — told the
 *  user nothing about whether the retry did anything. XRPL and the
 *  Solana scan re-run their own reads deterministically; other
 *  families reload fully and are judged by whether their alert
 *  clears. */
async function retryFamily(key, title) {
  const btn = $("famRetry");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Retrying…`;
  const fail = (what, note) => {
    btn.disabled = false;
    btn.textContent = "Retry";
    const t = $("famAlertText");
    if (t) t.textContent = note || `${what} still couldn't be loaded right now — check your connection and try again.`;
  };
  const done = (what) => { closeSheet(); toast(what); };
  try {
    if (key === "xrpl") {
      try {
        const acct = await getXrplAccount(xrpAddr);
        xrpBalances = acct.balances; xrpFunded = acct.funded; xrpLoadFailed = false;
        paintAssets();
        return done("XRP Ledger balances updated");
      } catch { return fail("XRP Ledger balances"); }
    }
    if (key === "solana") {
      familyScanFailed.solana = false;
      const rows = await loadFamilyRows(() => getSolanaAllTokens(solAddr), () => getSolanaBalances(solAddr), "solana");
      if (rows) solBalances = rows;
      paintAssets();
      if (!familyScanFailed.solana) return done("Solana token scan updated");
      // Not a connection problem: the free public Solana endpoints
      // refuse the indexed lookups a full scan needs. Say that,
      // plainly — the retry above really did re-run the scan.
      return fail("The full Solana token scan",
        "The full Solana token scan still isn't available — the free public Solana endpoints aren't serving full scans right now. Your main Solana tokens above are up to date.");
    }
    await renderMain();
    await new Promise(r => setTimeout(r, 2500));
    if (!familyAlertMap()[key]) return done(`${title} balances updated`);
    return fail(`${title} balances`);
  } catch { return fail(`${title} balances`); }
}
function splitRows(rows, symPriceOf) {
  const main = [], other = [];
  for (const b of rows) {
    const v = rowUsdValue(b, symPriceOf(b));
    if (b.verified !== false && v != null) main.push({ b, v }); else other.push({ b, v });
  }
  // Home ordering: held rows first (USD value descending), then
  // couldn't-load rows (amount null), then true zeros in their
  // given order. The Other group (unverified / unpriced) keeps its
  // given order — that quarantine is a separate axis.
  return { main: sortHomeRows(main, (x) => x.b.amount, (x) => x.v), other };
}
function otherGroupHtml(famKey, items, renderItem) {
  if (!items.length) return "";
  const open = expandedOther.has(famKey);
  return `<div class="row" data-other="${famKey}">
      <span class="coin" style="background:#3b4a7a">…</span>
      <span class="grow"><b>Other tokens (${items.length})</b><small>Unverified or unpriced — tap to ${open ? "hide" : "show"}. Fully usable; check contract addresses carefully.</small></span>
      <span>${open ? "▾" : "▸"}</span></div>` + (open ? items.map(renderItem).join("") : "");
}

/** Amount cell for the scalar-balance families (LTC/DOGE/BCH):
 *  a failed read renders the same "couldn't load" state as a null
 *  token row (tokenRowHtml) — the balance is unknown, never a
 *  dressed-up zero. */
function scalarAmtHtml(failed, bal, price) {
  return failed
    ? `<b>—</b><small>couldn't load</small>`
    : `<b>${fmt(bal, 8)}</b><small>${usd(bal * (price || 0))}</small>`;
}

function paintAssets() {
  paintHeader();
  const net = NETWORKS[networkKey];
  // Chain-badge census (§4.5): symbols living on more than one network.
  {
    const symNets = new Map();
    const noteSym = (sym, where) => { if (!sym) return; if (!symNets.has(sym)) symNets.set(sym, new Set()); symNets.get(sym).add(where); };
    for (const b of balances) noteSym(b.symbol, "evm");
    for (const b of tronBalances) noteSym(b.symbol, "tron");
    for (const b of solBalances) noteSym(b.symbol, "solana");
    for (const b of suiBalances) noteSym(b.symbol, "sui");
    for (const b of stellarBalances) noteSym(b.symbol, "stellar");
    for (const b of tonBalances) noteSym(b.symbol, "ton");
    for (const b of nearBalances) noteSym(b.symbol, "near");
    for (const b of algoBalances) noteSym(b.symbol, "algorand");
    for (const b of xrpBalances) noteSym(b.symbol, "xrpl");
    for (const b of dotBalances) noteSym(b.symbol, "polkadot");
    for (const b of aptosBalances) noteSym(b.symbol, "aptos");
    for (const b of stacksBalances) noteSym(b.symbol, "stacks");
    for (const r of cosmosRows) noteSym(r.symbol, r.key);
    dupSymbols = new Set([...symNets].filter(([, s]) => s.size > 1).map(([sym]) => sym));
  }
  // §4.2: rows are built per family ONCE into groups, then rendered
  // per viewKey (All = fixed family order; scoped = that group only).
  const groups = [];
  const grp = (key, header, rowsArr) => groups.push({ key, header, html: rowsArr.join("") });
  // Bitcoin group (tap the row for the Bitcoin sheet)
  grp("bitcoin", "", [famLoaded.has("bitcoin") ? `<div class="row" id="btcRow">
      <span class="logowrap">${tokenLogoHtml({ symbol: "BTC" }, "bitcoin")}${badgeHtml({ symbol: "BTC" }, "bitcoin")}</span>
      <span class="grow"><b class="rname">Bitcoin</b><small>BTC · SegWit + Taproot</small></span>
      <span class="amt">${scalarAmtHtml(btcLoadFailed, btcBal + btcTrBal, prices.BTC)}</span></div>` : skeletonRowsHtml(1)]);
  // EVM rows for the active network: native + curated + custom +
  // scanned (hydrateEvmTokens merges the discovered ones into
  // `balances`), presented priced-and-verified first. A failed load
  // renders native + curated tokens as "couldn't load" rows (amount
  // null) — never an empty list under a $0.00 header.
  {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, net.name, "", "evm");
    const evmRows = evmLoadFailed
      ? [{ symbol: net.symbol, amount: null, address: null, verified: true },
         ...net.tokens.map(t => ({ ...t, amount: null }))]
      : balances;
    rows.push(familyRowsHtml("evm", evmRows, (b) => b.address ? prices[b.symbol] : prices[net.priceSym], render));
    if (evmScanState.key === networkKey && evmScanState.status === "scanning") rows.push(skeletonRowsHtml(2));
    rows.push(`<button class="btn ghost" id="addTokBtn" style="margin:8px 0">＋ Add a token by contract address</button>`);
    grp("evm", "", rows);
  }
  // Tron family rows (tap a row to send on Tron)
  if (tronBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Tron", `data-tron="${tronBalances.indexOf(b)}"`, "tron");
    rows.push(familyRowsHtml("tron", tronBalances, (b) => prices[b.symbol], render));
    grp("tron", `<p class="tag" style="margin:12px 0 2px">Tron</p>`, rows);
  }
  // Solana family rows (tap a row to send on Solana)
  if (solBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Solana", `data-sol="${solBalances.indexOf(b)}"`, "solana");
    rows.push(familyRowsHtml("solana", solBalances, (b) => prices[b.symbol], render));
    grp("solana", `<p class="tag" style="margin:12px 0 2px">Solana</p>`, rows);
  }
  // Sui family rows (tap a row to send on Sui)
  if (suiBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Sui", `data-sui="${suiBalances.indexOf(b)}"`, "sui");
    rows.push(familyRowsHtml("sui", suiBalances, (b) => prices[b.symbol], render));
    grp("sui", `<p class="tag" style="margin:12px 0 2px">Sui</p>`, rows);
  }
  // Stellar family rows (tap a row to send on Stellar)
  if (stellarBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Stellar", `data-stellar="${stellarBalances.indexOf(b)}"`, "stellar");
    rows.push(familyRowsHtml("stellar", stellarBalances, (b) => prices[b.symbol], render));
    grp("stellar", `<p class="tag" style="margin:12px 0 2px">Stellar</p>`, rows);
  }
  // TON family rows (Phase 4; tap a row to send on TON)
  if (tonBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "TON", `data-ton="${tonBalances.indexOf(b)}"`, "ton");
    rows.push(familyRowsHtml("ton", tonBalances, (b) => prices[b.symbol], render));
    grp("ton", `<p class="tag" style="margin:12px 0 2px">TON</p>`, rows);
  }
  // NEAR family rows (Phase 4; tap a row to send on NEAR)
  if (nearBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "NEAR", `data-near="${nearBalances.indexOf(b)}"`, "near");
    rows.push(familyRowsHtml("near", nearBalances, (b) => b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol], render));
    grp("near", `<p class="tag" style="margin:12px 0 2px">NEAR</p>`, rows);
  }
  // Algorand family rows (Phase 4; tap a row to send on Algorand)
  if (algoBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Algorand", `data-algo="${algoBalances.indexOf(b)}"`, "algorand");
    rows.push(familyRowsHtml("algorand", algoBalances, (b) => prices[b.symbol], render));
    grp("algorand", `<p class="tag" style="margin:12px 0 2px">Algorand</p>`, rows);
  }
  // XRP Ledger family rows (Phase 4; tap a row to send on XRPL)
  if (xrpBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "XRP Ledger", `data-xrp="${xrpBalances.indexOf(b)}"`, "xrpl");
    rows.push(familyRowsHtml("xrpl", xrpBalances, (b) => prices[b.symbol], render));
    grp("xrpl", `<p class="tag" style="margin:12px 0 2px">XRP Ledger</p>`, rows);
  }
  // Polkadot Asset Hub family rows (Phase 4; tap a row to send)
  if (dotBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Polkadot Asset Hub", `data-dot="${dotBalances.indexOf(b)}"`, "polkadot");
    rows.push(familyRowsHtml("polkadot", dotBalances, (b) => prices[b.symbol], render));
    grp("polkadot", `<p class="tag" style="margin:12px 0 2px">Polkadot Asset Hub</p>`, rows);
  }
  // Aptos family rows (Phase 5; tap a row to send on Aptos)
  if (aptosBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Aptos", `data-aptos="${aptosBalances.indexOf(b)}"`, "aptos");
    rows.push(familyRowsHtml("aptos", aptosBalances, (b) => prices[b.symbol], render));
    grp("aptos", `<p class="tag" style="margin:12px 0 2px">Aptos</p>`, rows);
  }
  // Stacks family rows (Bitcoin L2; tap a row to send on Stacks)
  if (stacksBalances.length) {
    const rows = [];
    const render = ({ b, v }) => tokenRowHtml(b, v, "Stacks", `data-stacks="${stacksBalances.indexOf(b)}"`, "stacks");
    rows.push(familyRowsHtml("stacks", stacksBalances, (b) => prices[b.symbol], render));
    grp("stacks", `<p class="tag" style="margin:12px 0 2px">Stacks · Bitcoin L2</p>`, rows);
  }
  // Cosmos family rows (Phase 3a): one phrase, seven chains — a row
  // per chain showing that chain's native asset. An unavailable read
  // shows "unavailable", never a fake zero. Each chain is its OWN
  // view group (§4.2); in the All view they render consecutively
  // under one shared header.
  cosmosRows.forEach((r, i) => {
    const p = prices[r.symbol];
    const rowHtml = (r.amount == null && !famLoaded.has("cosmos")) ? skeletonRowsHtml(1) : `<div class="row" data-cosmos="${r.key}">
        <span class="logowrap">${tokenLogoHtml({ symbol: r.symbol }, r.key)}</span>
        <span class="grow"><b class="rname">${esc(r.name)}</b><small>${esc(r.symbol)} · Cosmos</small></span>
        <span class="amt">${r.amount == null
          ? `<b>—</b><small>unavailable</small>`
          : `<b>${fmt(r.amount)}</b><small>${p != null ? usd(Number(r.amount) * p) : ""}</small>`}</span></div>`;
    grp(r.key, i === 0 ? `<p class="tag" style="margin:12px 0 2px">Cosmos — one phrase, seven chains</p>` : "", [rowHtml]);
  });
  // Lightning scoped view (§4.2): no token rows — one row into the
  // Lightning panel (the Wallet tab's Lightning button covers All).
  grp("lightning", "", [`<div class="row" data-ln="1">
      <span class="logowrap"><span class="coin" style="background:#f7931a">${icon("bolt", "ic ic-wht")}</span></span>
      <span class="grow"><b class="rname">Bitcoin Lightning</b><small>Your own node — pay invoices, offers and Lightning addresses</small></span>
      <span>›</span></div>`]);
  // Bitcoin-family rows (Phase 2a): Litecoin, Dogecoin, Bitcoin Cash
  grp("litecoin", `<p class="tag" style="margin:12px 0 2px">Bitcoin family</p>`, [famLoaded.has("litecoin") ? `<div class="row" data-ltc="1">
      <span class="logowrap">${tokenLogoHtml({ symbol: "LTC" }, "litecoin")}${badgeHtml({ symbol: "LTC" }, "litecoin")}</span>
      <span class="grow"><b class="rname">Litecoin</b><small>LTC · Native SegWit</small></span>
      <span class="amt">${scalarAmtHtml(ltcLoadFailed, ltcBal, prices.LTC)}</span></div>` : skeletonRowsHtml(1)]);
  grp("dogecoin", "", [famLoaded.has("dogecoin") ? `<div class="row" data-doge="1">
      <span class="logowrap">${tokenLogoHtml({ symbol: "DOGE" }, "dogecoin")}${badgeHtml({ symbol: "DOGE" }, "dogecoin")}</span>
      <span class="grow"><b class="rname">Dogecoin</b><small>DOGE · Legacy</small></span>
      <span class="amt">${scalarAmtHtml(dogeLoadFailed, dogeBal, prices.DOGE)}</span></div>` : skeletonRowsHtml(1)]);
  grp("bitcoincash", "", [famLoaded.has("bitcoincash") ? `<div class="row" data-bch="1">
      <span class="logowrap">${tokenLogoHtml({ symbol: "BCH" }, "bitcoincash")}${badgeHtml({ symbol: "BCH" }, "bitcoincash")}</span>
      <span class="grow"><b class="rname">Bitcoin Cash</b><small>BCH · CashAddr</small></span>
      <span class="amt">${scalarAmtHtml(bchLoadFailed, bchBal, prices.BCH)}</span></div>` : skeletonRowsHtml(1)]);
  // Render per viewKey (§4.5): each family is its OWN card with a
  // header (name + subtotal + alert) in the All view; a scoped view
  // renders its single group without the header. The seven Cosmos
  // chains share one Cosmos card in the All view.
  const totals = familyUsdTotals();
  const alerts = familyAlertMap();
  // Home ordering (owner request, 2026-11-08): what you hold comes
  // first. A family's load failure is read from its flag — several
  // families keep a $0 total on failure (the scalar coins, Tron),
  // while EVM/Bitcoin report a null total; sortHomeFamilies treats
  // both as "unknown", ranked below held value and above true
  // zeros. Solana/Sui have no load-failed flag (their main reads
  // either land or the group never renders), so they sort purely
  // on their totals. Cosmos counts as failed only when no chain
  // holds anything and at least one read came back unavailable.
  const famFailed = {
    bitcoin: btcLoadFailed, evm: evmLoadFailed, litecoin: ltcLoadFailed,
    dogecoin: dogeLoadFailed, bitcoincash: bchLoadFailed, tron: tronLoadFailed,
    stellar: stellarLoadFailed, ton: tonLoadFailed, near: nearLoadFailed,
    algorand: algoLoadFailed, xrpl: xrpLoadFailed, polkadot: dotLoadFailed,
    aptos: aptosLoadFailed, stacks: stacksLoadFailed,
    cosmos: famLoaded.has("cosmos") && cosmosRows.some(r => r.amount == null) && !cosmosRows.some(r => Number(r.amount) > 0),
  };
  const titleOf = (key) => key === "evm" ? net.name : key === "bitcoin" ? "Bitcoin" : key === "cosmos" ? "Cosmos"
    : (RECEIVE_NETWORKS.find(x => x.id === key) || {}).name || key;
  const cardFor = (key, innerHtml, titled, totalVal) => {
    const head = titled ? `<div class="ghead"><span class="t-strong">${esc(titleOf(key))}</span><span class="gsub">${totalVal == null ? "—" : usd(totalVal || 0)}${alerts[key] ? ` <button class="falert" data-famalert="${key}" aria-label="Network note">${icon("alert", "ic ic-sm")}</button>` : ""}</span></div>` : "";
    return `<div class="card groupcard">${head}${innerHtml}</div>`;
  };
  let html = "";
  if (viewKey === "all") {
    const cards = [];
    let cosmosBuf = [];
    const flushCosmos = () => {
      if (!cosmosBuf.length) return;
      const total = COSMOS_CHAINS.reduce((t, c) => t + (totals[c.key] || 0), 0);
      // The seven chain rows inside the shared Cosmos card follow
      // the same within-family order as every other family.
      const inner = sortHomeRows(cosmosBuf, (x) => x.amount, (x) => x.valueUsd).map(x => x.html).join("");
      cards.push({ key: "cosmos", totalUsd: total, failed: famFailed.cosmos, html: cardFor("cosmos", inner, true, total) });
      cosmosBuf = [];
    };
    for (const g of groups) {
      if (g.key === "lightning") continue;
      if (COSMOS_CHAINS.some(c => c.key === g.key)) {
        const r = cosmosRows.find(x => x.key === g.key);
        cosmosBuf.push({ html: g.html, amount: r ? r.amount : null, valueUsd: totals[g.key] });
        continue;
      }
      flushCosmos();
      cards.push({ key: g.key, totalUsd: totals[g.key], failed: !!famFailed[g.key], html: cardFor(g.key, g.html, true, totals[g.key]) });
    }
    flushCosmos();
    html = sortHomeFamilies(cards).map(c => c.html).join("");
  } else {
    const g = groups.find(x => x.key === viewKey);
    html = g ? cardFor(g.key, g.html, false, totals[g.key]) : "";
  }
  html += `<button class="btn ghost" id="zeroToggle">${showZeroBalances ? "Hide zero balances" : "Show zero balances"}</button>`;
  $("assetList").innerHTML = html || `<p class="tag">Nothing here yet.</p>`;
  document.querySelectorAll("[data-famalert]").forEach(b => b.onclick = (e) => { e.stopPropagation(); openFamilyAlert(b.dataset.famalert); });
  const zt = $("zeroToggle");
  if (zt) zt.onclick = () => {
    showZeroBalances = !showZeroBalances;
    try { localStorage.setItem(SHOW_ZERO_LS, showZeroBalances ? "1" : "0"); } catch { /* best effort */ }
    paintAssets();
  };
  // §4.13 home zero state: one compact card, All view only, and only
  // once balances have actually loaded with nothing anywhere.
  const hz = $("homeZero");
  if (hz) {
    const anyBal = (btcBal + btcTrBal + ltcBal + dogeBal + bchBal) > 0
      || [balances, tronBalances, solBalances, suiBalances, stellarBalances, tonBalances, nearBalances, algoBalances, xrpBalances, dotBalances, aptosBalances, stacksBalances]
        .some(a => a.some(b => Number(b.amount) > 0))
      || cosmosRows.some(r => Number(r.amount) > 0);
    hz.classList.toggle("hidden", !(viewKey === "all" && famLoaded.has("evm") && !evmLoadFailed && !btcLoadFailed && !anyBal && scopedTotal() === 0));
  }
  const btcRowEl = $("btcRow"); if (btcRowEl) btcRowEl.onclick = openBtcSheet;
  const ltcEl = document.querySelector("[data-ltc]"); if (ltcEl) ltcEl.onclick = openLtcSheet;
  const dogeEl = document.querySelector("[data-doge]"); if (dogeEl) dogeEl.onclick = openDogeSheet;
  const bchEl = document.querySelector("[data-bch]"); if (bchEl) bchEl.onclick = openBchSheet;
  const lnEl = document.querySelector("[data-ln]"); if (lnEl) lnEl.onclick = () => openLightningPanel();
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
  document.querySelectorAll("[data-zero]").forEach(r => r.onclick = () => {
    const k = r.dataset.zero;
    if (expandedZero.has(k)) expandedZero.delete(k); else expandedZero.add(k);
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
      rpc: d.rpc, explorer: d.explorer, tokens: d.tokens || [], discovered: true };
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
  // The curated load failed: nothing the scan reads is trustworthy
  // right now (same RPC), and merging custom rows at their fallback
  // "0" would dress the failure up as loaded balances. Wait for a
  // successful load — renderMain re-runs this after one.
  if (evmLoadFailed) return;
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
    if (t) { cr.verified = lifiTokenVerified(t); if (t.priceUSD != null) cr.priceUsd = t.priceUSD; if (t.logoURI) cr.logoURI = t.logoURI; }
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
                       address: t.address, decimals: t.decimals, verified: lifiTokenVerified(t), priceUsd: t.priceUSD, logoURI: t.logoURI || null });
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
  // §4.2 universal picker: All networks / EVM networks / Other
  // networks (every family + each Cosmos chain). Search matches EVM
  // rows on name as today, family rows via the receive alias matcher
  // (receiveNetworkMatches — "btc" finds Bitcoin, not Bitcoin Cash).
  openSheet(`<h3>Network</h3>
    <input id="netSearch" placeholder="Search networks…" autocapitalize="none">
    <div id="netList"></div>
    <p class="msg err" id="netMsg"></p>`);
  const totals = familyUsdTotals();
  const total = (v) => v == null ? "—" : usd(v);
  const check = `<svg class="ic ic-sm ic-brand"><use href="#i-check"/></svg>`;
  const paint = () => {
    const q = $("netSearch").value.trim().toLowerCase();
    // SECURITY (audit M3): discovered-chain names/symbols are registry
    // data — escaped here even though gateChains also sanitises them.
    const item = (k, label, sub) => {
      const sel = viewKey === "evm" && k === networkKey;
      return `<button class="netitem${sel ? " sel" : ""}" data-net="${k}"><span>${esc(label)}${sub ? ` <small style="color:var(--dim)">${esc(sub)}</small>` : ""}</span><span class="vtotal">${k === networkKey ? total(totals.evm) : "—"}${sel ? " " + check : ""}</span></button>`;
    };
    let html = "";
    if (receiveNetworkMatches({ name: "All networks", aliases: ["all", "everything", "networks"] }, q)) {
      const sel = viewKey === "all";
      html += `<button class="netitem${sel ? " sel" : ""}" data-viewall="1"><span><svg class="ic ic-sm"><use href="#i-layers"/></svg> All networks</span><span class="vtotal">${total(heroTotal())}${sel ? " " + check : ""}</span></button>`;
    }
    let evmHtml = BUILTIN_NETWORK_KEYS
      .filter(k => !q || NETWORKS[k].name.toLowerCase().includes(q))
      .map(k => item(k, NETWORKS[k].name)).join("");
    // Display-tier chains are listed outright; discoverable-tier chains
    // surface as soon as the user starts searching.
    const disc = Object.values(discoveredChains).filter(d =>
      (q ? true : d.tier === "display") &&
      (!q || d.name.toLowerCase().includes(q) || d.symbol.toLowerCase() === q));
    if (disc.length) {
      evmHtml += `<p class="tag" style="margin:12px 0 4px">More networks — discovered automatically, checked live before switching</p>` +
        disc.map(d => item(d.key, d.name, d.symbol)).join("");
    }
    if (evmHtml) html += `<p class="tag vgroup">EVM NETWORKS</p>` + evmHtml;
    const fams = RECEIVE_NETWORKS.filter(m => m.id !== "evm" && receiveNetworkMatches(m, q));
    if (fams.length) {
      html += `<p class="tag vgroup">OTHER NETWORKS</p>` + fams.map(m => {
        const sel = viewKey === m.id;
        return `<button class="netitem${sel ? " sel" : ""}" data-viewfam="${m.id}"><span>${esc(m.name)}${m.sub ? ` <small style="color:var(--dim)">${esc(m.sub)}</small>` : ""}</span><span class="vtotal">${total(totals[m.id])}${sel ? " " + check : ""}</span></button>`;
      }).join("");
    }
    $("netList").innerHTML = html || `<p class="tag">No networks match.</p>`;
    document.querySelectorAll("[data-net]").forEach(b => b.onclick = async () => {
      viewKey = "evm"; saveViewKey();
      const before = networkKey;
      await selectNetwork(b.dataset.net);
      if (networkKey === before) { closeSheet(); renderMain(); } // same network: selectNetwork only closed the sheet
    });
    document.querySelectorAll("[data-viewall]").forEach(b => b.onclick = () => {
      viewKey = "all"; saveViewKey(); closeSheet(); renderMain();
    });
    document.querySelectorAll("[data-viewfam]").forEach(b => b.onclick = () => {
      viewKey = b.dataset.viewfam; saveViewKey(); closeSheet(); renderMain();
    });
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
    bitcoin: `<p class="tag">Bitcoin — Native SegWit address (bc1q…):</p>
      <img class="qr" id="qrBtc"><p class="mono">${btcAddr}</p>
      <button class="btn ghost" id="cpBtc">Copy SegWit address</button>
      <p class="tag">Bitcoin — Taproot address (bc1p…), same seed:</p>
      <img class="qr" id="qrBtcTr"><p class="mono">${btcTrAddr}</p>
      <button class="btn ghost" id="cpBtcTr">Copy Taproot address</button>
      <p class="tag">Both addresses are yours and both can receive BTC. Taproot is the newer format — some older services only send to SegWit.</p>`,
    lightning: `<div id="rcvLnSlot"><p class="tag">Checking for your Lightning receive address…</p></div>
      <p class="tag">Fluid's Lightning is a real node inside this app, run from your own seed — nobody custodies your sats. Your reusable BOLT 12 offer (below, once the node has run) is your shareable Lightning address; a Lightning address registered to your Fluid name also works.</p>`,
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
    bitcoin: () => { qr("qrBtc", btcAddr); $("cpBtc").onclick = () => copyText(btcAddr, $("cpBtc"));
      qr("qrBtcTr", btcTrAddr); $("cpBtcTr").onclick = () => copyText(btcTrAddr, $("cpBtcTr")); },
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
      // Prefer the native node's own reusable BOLT 12 offer when the
      // node has been booted this session; otherwise the Lightning
      // address registered to the user's Fluid name.
      if (lnSession) {
        try { return paintLn(lnSession.createOffer(null, "Fluid"), null); } catch { /* no peer yet — fall through */ }
      }
      const myName = localStorage.getItem("fluid_name");
      if (!myName) {
        const slot = $("rcvLnSlot");
        if (slot) slot.innerHTML = `<p class="tag">Open the Lightning panel (Wallet tab → Lightning) once to start your node — your reusable receive offer will appear here. You can also register a Lightning address to your Fluid name under “Your Fluid name” in the More tab.</p>`;
        return;
      }
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
  // Default: the context the user came from (§4.2) — a family view
  // preselects that family's entry; All/EVM preselect the shared EVM
  // panel (the active network is an EVM chain).
  let selected = (viewKey === "all" || viewKey === "evm") ? "evm" : viewKey;
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
// §4.2: the Send button dispatches on the current view — a family
// view opens that family's own send sheet; All/EVM open the EVM sheet.
$("actSend").onclick = () => {
  if (viewKey === "all" || viewKey === "evm") return openEvmSendSheet();
  if (viewKey === "bitcoin") return openBtcSheet();
  if (viewKey === "lightning") return openLightningPanel();
  if (viewKey === "litecoin") return openLtcSheet();
  if (viewKey === "dogecoin") return openDogeSheet();
  if (viewKey === "bitcoincash") return openBchSheet();
  if (isCosmosView()) { const row = cosmosRows.find(r => r.key === viewKey); if (row) return openCosmosSheet(row); return openEvmSendSheet(); }
  const nativeOf = (rows) => rows.find(b => !b.address && !b.contract) || rows[0];
  if (viewKey === "tron") return openTronSheet(nativeOf(tronBalances));
  if (viewKey === "solana") return openSolanaSheet(nativeOf(solBalances));
  if (viewKey === "sui") return openSuiSheet(nativeOf(suiBalances));
  if (viewKey === "stellar") return openStellarSheet(nativeOf(stellarBalances));
  if (viewKey === "ton") return openTonSheet(nativeOf(tonBalances));
  if (viewKey === "near") return openNearSheet(nativeOf(nearBalances));
  if (viewKey === "algorand") return openAlgoSheet(nativeOf(algoBalances));
  if (viewKey === "xrpl") return openXrplSheet(nativeOf(xrpBalances));
  if (viewKey === "polkadot") return openDotSheet(nativeOf(dotBalances));
  if (viewKey === "aptos") return openAptosSheet(nativeOf(aptosBalances));
  if (viewKey === "stacks") return openStacksSheet(nativeOf(stacksBalances));
  return openEvmSendSheet();
};
function openEvmSendSheet() {
  openSheet(`<h3>Send on ${NETWORKS[networkKey].name}</h3>
    ${!balances.length ? `<p class="tag">${evmLoadFailed ? "Balances couldn't load right now — tap More → Refresh and try again." : "Balances are still loading — wait a moment and try again."}</p>` : ""}
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
      toast("Name resolved");
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
    // An empty token list means the balances never loaded — say so
    // plainly instead of the misleading "Enter an amount." (the
    // dropdown is empty because there is nothing to pick, not
    // because the user forgot the amount).
    if (evmLoadFailed) return msg("sMsg", warnPrefix + resolvedNote + "Balances couldn't load right now — tap More → Refresh and try again.");
    if (!b) return msg("sMsg", warnPrefix + resolvedNote + "Balances are still loading — wait a moment and try again.");
    if (!amount || Number(amount) <= 0) return msg("sMsg", warnPrefix + resolvedNote + "Enter an amount.");
    if (Number(amount) > Number(b.amount)) return msg("sMsg", warnPrefix + resolvedNote + "Amount is more than your balance.");
    try {
      msg("sMsg", "Estimating fee…", true);
      const fee = await estimateSend(wallet, networkKey, { to, amount, token: b.address ? b : null });
      pendingSend = { to, amount, token: b.address ? b : null, symbol: b.symbol, name: sendName, feeNative: Number(fee) };
      $("sIntentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: Number(fee).toFixed(6), name: sendName })
        + (b.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("sIntentText"), { balance: b.amount, amount, fee: b.address ? null : Number(fee), symbol: b.symbol });
      show("sIntent"); msg("sMsg", poisonNote);
    } catch (e) { msg("sMsg", warnPrefix + "Could not estimate: " + (e.shortMessage || e.message)); }
  };
  $("sConfirm").onclick = async () => {
    if (!pendingSend) return;
    const btn = $("sConfirm");
    try {
      setSendBusy(btn, true);
      msg("sMsg", "Sending…", true);
      const tx = await executeSend(wallet, networkKey, pendingSend);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: tx.hash, amount: pendingSend.amount, symbol: pendingSend.symbol, to: pendingSend.to, explorer: NETWORKS[networkKey].explorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingSend; pendingSend = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: done.symbol,
        logoHtml: tokenLogoHtml({ symbol: done.symbol, address: done.token ? done.token.address : null }, "evm"),
        to: done.to, toName: done.name, familyName: NETWORKS[networkKey].name,
        feeText: done.feeNative != null ? `≈ ${done.feeNative.toFixed(6)} ${NETWORKS[networkKey].symbol}` : null,
        explorerUrl: historyTxUrl({ hash: tx.hash, explorer: NETWORKS[networkKey].explorer }), txid: tx.hash, pending: false });
    } catch (e) { sendFailed(btn, "sMsg", e); }
  };
}

// ---------- Bitcoin sheet ----------
// Mirrors the other family sheets: review → human-readable sentence →
// confirm, all in-app. No native confirm() dialog here — those get
// swallowed in some phone webviews and make the button look dead.
function openBtcSheet() {
  let pendingBtc = null;
  openSheet(`<h3>Bitcoin</h3>
    <p><b>${btcLoadFailed ? "Balance couldn't load" : fmt(btcBal + btcTrBal, 8) + " BTC"}</b>${btcLoadFailed ? "" : ` · ${usd((btcBal + btcTrBal) * (prices.BTC || 0))} across two accounts from the same seed`}</p>
    <p class="tag">Native SegWit (bc1q…) · ${btcSegwitFailed ? "couldn't load" : fmt(btcBal, 8) + " BTC"}</p>
    <img class="qr" id="qrBtc2"><p class="mono">${btcAddr}</p>
    <button class="btn ghost" id="cpBtc2">Copy SegWit address</button>
    <p class="tag">Taproot (bc1p…) · ${btcTaprootFailed ? "couldn't load" : fmt(btcTrBal, 8) + " BTC"}</p>
    <img class="qr" id="qrBtcTr2"><p class="mono">${btcTrAddr}</p>
    <button class="btn ghost" id="cpBtcTr2">Copy Taproot address</button>
    <hr style="border-color:var(--line)">
    <h3>Send BTC</h3>
    <p class="tag">Send from</p>
    <select id="bFrom" style="width:100%;margin:4px 0 10px">
      <option value="segwit">SegWit account (bc1q…)</option>
      <option value="taproot">Taproot account (bc1p…)</option>
    </select>
    <input id="bTo" placeholder="Recipient bc1… address or Fluid name">
    <input id="bAmt" inputmode="decimal" placeholder="Amount in BTC">
    <button class="btn" id="bSend">Review &amp; send BTC</button>
    <div id="bIntent" class="hidden">
      <p class="seed" id="bIntentText"></p>
      <button class="btn" id="bConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="bMsg"></p>
    <p class="tag">The fee rate is cross-checked against two independent sources and capped for your protection; the exact fee is shown before you confirm. Coins carrying inscriptions are never spent by ordinary sends. Sends are final.</p>
    <hr style="border-color:var(--line)">
    <h3>Collectibles · Inscriptions</h3>
    <div id="bInscList"><p class="tag">Loading inscriptions from the index…</p></div>
    <p class="tag">Inscriptions are collectibles — they are never counted in your BTC balance and ordinary sends never spend the coins carrying them.</p>
    <hr style="border-color:var(--line)">
    <h3>Runes</h3>
    <div id="bRuneList"><p class="tag">Loading rune balances from the index…</p></div>
    <p class="tag">⚠ Runes are not verified by Fluid — anyone can etch a rune with any name, including names imitating well-known ones. Always check the rune id.</p>
    <div id="bRuneForm"></div>`);
  qr("qrBtc2", btcAddr);
  $("cpBtc2").onclick = () => copyText(btcAddr, $("cpBtc2"));
  qr("qrBtcTr2", btcTrAddr);
  $("cpBtcTr2").onclick = () => copyText(btcTrAddr, $("cpBtcTr2"));
  $("bFrom").onchange = () => { pendingBtc = null; $("bIntent").classList.add("hidden"); };
  // Collectibles + Runes, loaded fresh from the keyless index for BOTH
  // Bitcoin accounts each time the sheet opens. Failures show an honest
  // unavailable state — never a false "none".
  (async () => {
    try {
      const [s, t] = await Promise.all([getInscriptions(btcAddr), getInscriptions(btcTrAddr)]);
      const el = $("bInscList"); if (!el) return; // sheet moved on
      const all = [...s, ...t];
      el.innerHTML = all.length ? all.map(formatInscriptionRow).join("")
        : `<p class="tag">No inscriptions on either Bitcoin address.</p>`;
    } catch {
      const el = $("bInscList"); if (el) el.innerHTML =
        `<p class="tag">Couldn't reach the inscription index — collectibles are unavailable right now. Your BTC balance and sends are unaffected.</p>`;
    }
    try {
      const [s, t] = await Promise.all([getRuneBalances(btcAddr), getRuneBalances(btcTrAddr)]);
      const el = $("bRuneList"); if (!el) return;
      const merged = new Map();
      for (const r of [...s, ...t]) {
        const prev = merged.get(r.runeId);
        if (prev) prev.amount = (BigInt(prev.amount) + BigInt(r.amount)).toString();
        else merged.set(r.runeId, { ...r });
      }
      const runes = [...merged.values()];
      el.innerHTML = runes.length ? runes.map((r, i) =>
        `<div>${formatRuneRow(r)}<button class="btn ghost" data-rune-send="${i}">Send ${esc(r.symbol || "rune")}</button></div>`).join("")
        : `<p class="tag">No runes on either Bitcoin address.</p>`;
      el.querySelectorAll("[data-rune-send]").forEach(btn =>
        btn.onclick = () => paintRuneSendForm(runes[Number(btn.getAttribute("data-rune-send"))]));
    } catch {
      const el = $("bRuneList"); if (el) el.innerHTML =
        `<p class="tag">Couldn't reach the rune index — rune balances are unavailable right now.</p>`;
    }
  })();
  // Rune send sub-form, rendered in place under the rune list. Same
  // review-then-broadcast-exact-bytes pattern as the BTC send above.
  const paintRuneSendForm = (r) => {
    const mount = $("bRuneForm"); if (!mount) return;
    let pendingRune = null;
    mount.innerHTML = `<hr style="border-color:var(--line)">
      <h3>Send ${esc(r.name)}</h3>
      <p class="tag">Rune id ${esc(r.runeId)} · you hold ${esc(r.amount)}. The transfer rides on small BTC outputs (546 sats each) plus the network fee — it needs a little inscription-free BTC for postage.</p>
      <input id="rTo" placeholder="Recipient Bitcoin address (bc1…)" autocapitalize="none">
      <input id="rAmt" inputmode="decimal" placeholder="Amount (whole units)">
      <button class="btn" id="rReview">Review rune send</button>
      <div id="rIntent" class="hidden">
        <p class="seed" id="rIntentText"></p>
        <button class="btn" id="rConfirm">Confirm &amp; send</button>
      </div>
      <p class="msg err" id="rMsg"></p>`;
    $("rReview").onclick = async () => {
      const to = $("rTo").value.trim(), amountWhole = $("rAmt").value.trim();
      if (!to || !amountWhole) return msg("rMsg", "Enter a recipient and amount.");
      try {
        msg("rMsg", "Building the transfer…", true);
        const plan = await planRuneTransfer(wallet.mnemonic.phrase, { runeId: r.runeId, to, amountWhole });
        pendingRune = { to, amountWhole, plan };
        const note = feeRateNote(plan.rateInfo);
        $("rIntentText").textContent = `Send ${amountWhole} ${r.name} (rune ${r.runeId}) to ${to} on Bitcoin. Network fee ${plan.feeBtc.toFixed(8)} BTC (${usd(plan.feeBtc * (prices.BTC || 0))}).${plan.protectedCount ? ` ${plan.protectedCount} inscription-bearing coin(s) left untouched.` : ""}${note ? ` Note: ${note}.` : ""} Confirm?`;
        setBalanceAfter($("rIntentText"), { balance: r.amount, amount: amountWhole, fee: null, symbol: sanitizePersistedSymbol(r.name), decimals: 0 });
        show("rIntent"); msg("rMsg", "");
      } catch (e) { msg("rMsg", e.message); }
    };
    $("rConfirm").onclick = async () => {
      if (!pendingRune) return;
      const btn = $("rConfirm");
      try {
        setSendBusy(btn, true);
        msg("rMsg", "Broadcasting the transfer you reviewed…", true);
        const txid = await broadcastBitcoinTx(pendingRune.plan.hex);
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash: txid, amount: pendingRune.amountWhole, symbol: sanitizePersistedSymbol(r.name), to: pendingRune.to, explorer: "https://mempool.space", at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        const done = pendingRune; pendingRune = null;
        showTxSuccess({ verb: "Broadcast", amount: done.amountWhole, symbol: sanitizePersistedSymbol(r.name),
          logoHtml: tokenLogoHtml({ symbol: r.name }, "bitcoin"), to: done.to, familyName: "Bitcoin · Runes",
          feeText: `${done.plan.feeBtc.toFixed(8)} BTC`,
          explorerUrl: historyTxUrl({ hash: txid, explorer: "https://mempool.space" }), txid, pending: true });
      } catch (e) { sendFailed(btn, "rMsg", e, ""); }
    };
  };
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
    // A failed balance load is UNKNOWN, not zero: never plan a send
    // against the account whose balance didn't load (EVM precedent).
    // The gate is per account — a loaded SegWit account still sends
    // when only Taproot failed, and vice versa.
    const sendKind = $("bFrom").value;
    if (sendKind === "taproot" ? btcTaprootFailed : btcSegwitFailed)
      return msg("bMsg", "Balances couldn't load right now — tap More → Refresh and try again.");
    // Address-poisoning check (red-team Finding D): the EVM sheet has
    // always warned on lookalike recipients; the Bitcoin sheet — the
    // highest-value target for poisoning — showed nothing. Mirror it:
    // warn (never hard-block) when a raw recipient imitates the user's
    // own BTC address or a past BTC recipient.
    let poisonNote = "";
    if (!sendName) {
      const knownBtc = [btcAddr, btcTrAddr, ...JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").filter(x => x && x.symbol === "BTC").map(x => x.to).filter(Boolean)];
      const look = looksLikePoisonText(to, knownBtc);
      if (look) poisonNote = `⚠ This address starts and ends like ${look.slice(0, 10)}…${look.slice(-6)} which you've used before, but it is NOT the same address — this is how address-poisoning scams work. Double-check every character.`;
    }
    try {
      // Build the transaction NOW (audit H1): the review shows the exact
      // fee, and Confirm broadcasts exactly these bytes — the fee can
      // never change between what the user read and what gets signed.
      msg("bMsg", "Checking the network fee…", true);
      const plan = await planBitcoinSend(wallet.mnemonic.phrase, { to, amountBtc: amount, kind: sendKind });
      pendingBtc = { to, amount, plan, name: sendName };
      if (sendName) toast("Name resolved");
      // Same disclosure as formatSendIntent: when the recipient was given
      // as a Fluid name, the sentence shows the name AND the FULL address
      // it resolved to — the user confirms the resolution, not the name.
      const dest = sendName ? `${sendName}.${FLUID_DOMAIN} (${to})` : to;
      const note = feeRateNote(plan.rateInfo);
      // Inscription protection disclosure (Build B): the exclusion is
      // VISIBLE in the review, and a check that could not run is stated
      // plainly — never silently assumed clean.
      const protNote = !plan.inscriptionCheckOk
        ? " Note: the inscription check could not run, so Fluid could not verify that none of the coins spent carry inscriptions."
        : plan.protectedCount > 0 ? ` ${plan.protectedCount} inscription-bearing coin(s) left untouched.` : "";
      $("bIntentText").textContent = `Send ${amount} BTC to ${dest} on Bitcoin (from your ${plan.kind === "taproot" ? "Taproot" : "SegWit"} account). Network fee ${plan.feeBtc.toFixed(8)} BTC (${usd(plan.feeBtc * (prices.BTC || 0))}).${note ? ` Note: ${note}.` : ""}${protNote} Confirm?`;
      setBalanceAfter($("bIntentText"), { balance: plan.kind === "taproot" ? btcTrBal : btcBal, amount, fee: plan.feeBtc, symbol: "BTC", decimals: 8 });
      show("bIntent"); msg("bMsg", poisonNote);
    } catch (e) { msg("bMsg", e.message); }
  };
  $("bConfirm").onclick = async () => {
    if (!pendingBtc) return;
    const btn = $("bConfirm");
    try {
      setSendBusy(btn, true);
      msg("bMsg", "Broadcasting the transaction you reviewed…", true);
      const txid = await broadcastBitcoinTx(pendingBtc.plan.hex);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingBtc.amount, symbol: "BTC", to: pendingBtc.to, explorer: "https://mempool.space", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingBtc; pendingBtc = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: "BTC",
        logoHtml: tokenLogoHtml({ symbol: "BTC" }, "bitcoin"), to: done.to, toName: done.name, familyName: "Bitcoin",
        feeText: `${done.plan.feeBtc.toFixed(8)} BTC`,
        explorerUrl: historyTxUrl({ hash: txid, explorer: "https://mempool.space" }), txid, pending: true });
    } catch (e) { sendFailed(btn, "bMsg", e, ""); }
  };
}

// ---------- Tron sheet ----------
// Mirrors the EVM send sheet: review → human-readable sentence → confirm.
// The transaction is built by TronGrid but signed locally by sendTron.
function openTronSheet(tok) {
  let pendingTron = null;
  openSheet(`<h3>Send ${esc(tok.symbol)} on Tron</h3>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${tronAddr}</span></p>
    <input id="tTo" placeholder="Recipient T… address or Fluid name" autocapitalize="none">
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
  $("tReview").onclick = async () => {
    let to = $("tTo").value.trim();
    const amount = $("tAmt").value.trim();
    // Fluid names resolve via the shared registry path (QA F3–F5):
    // a valid T… address passes untouched; a name is looked up and
    // hard-blocked with the chain-specific registry message.
    if (to && !isValidTronAddress(to)) {
      msg("tMsg", "Resolving Fluid name…", true);
      try {
        const r = await resolveChainRecipient(to, { isValidAddress: isValidTronAddress, field: "tron", chainLabel: "Tron" });
        to = r.to; toast("Name resolved");
      } catch (e) { return msg("tMsg", e.message); }
    }
    if (!amount || Number(amount) <= 0) return msg("tMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("tMsg", "Amount is more than your balance.");
    pendingTron = { to, amount };
    $("tIntentText").textContent = formatTronSendIntent({ amount, symbol: tok.symbol, to })
      + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
    setBalanceAfter($("tIntentText"), { balance: tok.amount, amount, fee: null, symbol: tok.symbol });
    show("tIntent"); msg("tMsg", "");
  };
  $("tConfirm").onclick = async () => {
    if (!pendingTron) return;
    const btn = $("tConfirm");
    try {
      setSendBusy(btn, true);
      msg("tMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendTron(wallet, {
        to: pendingTron.to, amount: pendingTron.amount,
        token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingTron.amount, symbol: tok.symbol, to: pendingTron.to,
        link: `https://tronscan.org/#/transaction/${hash}`, explorer: "https://tronscan.org", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingTron; pendingTron = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "tron"), to: done.to, familyName: "Tron", feeText: null,
        explorerUrl: historyTxUrl({ link: `https://tronscan.org/#/transaction/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "tMsg", e); }
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
    <input id="oTo" placeholder="Recipient Solana address or Fluid name" autocapitalize="none">
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
    let to = $("oTo").value.trim();
    const amount = $("oAmt").value.trim();
    // Fluid names resolve via the shared registry path (QA F3–F5),
    // exactly as on the other family sheets.
    if (to && !isValidSolanaAddress(to)) {
      msg("oMsg", "Resolving Fluid name…", true);
      try {
        const r = await resolveChainRecipient(to, { isValidAddress: isValidSolanaAddress, field: "sol", chainLabel: "Solana" });
        to = r.to; toast("Name resolved");
      } catch (e) { return msg("oMsg", e.message); }
    }
    if (!amount || Number(amount) <= 0) return msg("oMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("oMsg", "Amount is more than your balance.");
    try {
      msg("oMsg", "Checking the recipient…", true);
      const plan = tok.address ? await solanaSendPlan(solAddr, { to, token: tok }) : { createsAta: false };
      pendingSol = { to, amount };
      $("oIntentText").textContent = formatSolanaSendIntent({ amount, symbol: tok.symbol, to, createsAta: plan.createsAta })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("oIntentText"), { balance: tok.amount, amount, fee: null, symbol: tok.symbol });
      show("oIntent"); msg("oMsg", "");
    } catch (e) { msg("oMsg", "Could not check the recipient: " + e.message); }
  };
  $("oConfirm").onclick = async () => {
    if (!pendingSol) return;
    const btn = $("oConfirm");
    try {
      setSendBusy(btn, true);
      msg("oMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendSolana(wallet.mnemonic.phrase, {
        to: pendingSol.to, amount: pendingSol.amount,
        // The token's program rides along: the review plan was built
        // with it (Token-2022 mints derive a different ATA and use a
        // different transfer instruction), so execution must use the
        // same program the user reviewed — dropping it silently
        // rebuilt the send against the legacy program.
        token: tok.address ? { address: tok.address, decimals: tok.decimals, program: tok.program } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingSol.amount, symbol: tok.symbol, to: pendingSol.to,
        link: `${SOLANA_EXPLORER}/tx/${hash}`, explorer: SOLANA_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingSol; pendingSol = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "solana"), to: done.to, familyName: "Solana", feeText: null,
        explorerUrl: historyTxUrl({ link: `${SOLANA_EXPLORER}/tx/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "oMsg", e); }
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
    <input id="uTo" placeholder="Recipient Sui address (0x…) or Fluid name" autocapitalize="none">
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
  $("uReview").onclick = async () => {
    let to = $("uTo").value.trim();
    const amount = $("uAmt").value.trim();
    // Fluid names resolve via the shared registry path (QA F3–F5),
    // exactly as on the other family sheets.
    if (to && !isValidSuiAddress(to)) {
      msg("uMsg", "Resolving Fluid name…", true);
      try {
        const r = await resolveChainRecipient(to, { isValidAddress: isValidSuiAddress, field: "sui", chainLabel: "Sui" });
        to = r.to; toast("Name resolved");
      } catch (e) { return msg("uMsg", e.message); }
    }
    if (!amount || Number(amount) <= 0) return msg("uMsg", "Enter an amount.");
    if (Number(amount) > Number(tok.amount)) return msg("uMsg", "Amount is more than your balance.");
    pendingSui = { to, amount };
    $("uIntentText").textContent = formatSuiSendIntent({ amount, symbol: tok.symbol, to })
      + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
    setBalanceAfter($("uIntentText"), { balance: tok.amount, amount, fee: null, symbol: tok.symbol });
    show("uIntent"); msg("uMsg", "");
  };
  $("uConfirm").onclick = async () => {
    if (!pendingSui) return;
    const btn = $("uConfirm");
    try {
      setSendBusy(btn, true);
      msg("uMsg", "Signing locally and executing…", true);
      const { hash } = await sendSui(wallet.mnemonic.phrase, {
        to: pendingSui.to, amount: pendingSui.amount,
        token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingSui.amount, symbol: tok.symbol, to: pendingSui.to,
        link: `${SUI_EXPLORER}/mainnet/tx/${hash}`, explorer: SUI_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingSui; pendingSui = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "sui"), to: done.to, familyName: "Sui", feeText: null,
        explorerUrl: historyTxUrl({ link: `${SUI_EXPLORER}/mainnet/tx/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "uMsg", e); }
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
      pendingStellar = { to, amount, feeXlm: plan.feeXlm };
      $("stIntentText").textContent = formatStellarSendIntent({
        amount, symbol: tok.symbol, to, feeXlm: plan.feeXlm,
        createsAccount: !assetTok && plan.destFunded === false,
      }) + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("stIntentText"), { balance: tok.amount, amount, fee: assetTok ? null : Number(plan.feeXlm), symbol: tok.symbol, decimals: 7 });
      show("stIntent"); msg("stMsg", "");
    } catch (e) { msg("stMsg", "Could not check the recipient: " + e.message); }
  };
  $("stConfirm").onclick = async () => {
    if (!pendingStellar) return;
    const btn = $("stConfirm");
    try {
      setSendBusy(btn, true);
      msg("stMsg", "Signing locally and submitting…", true);
      const { hash } = await sendStellar(wallet.mnemonic.phrase, {
        to: pendingStellar.to, amount: pendingStellar.amount, token: assetTok,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingStellar.amount, symbol: tok.symbol, to: pendingStellar.to,
        link: `${STELLAR_EXPLORER}/tx/${hash}`, explorer: STELLAR_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingStellar; pendingStellar = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "stellar"), to: done.to, familyName: "Stellar",
        feeText: done.feeXlm != null ? `${done.feeXlm} XLM` : null,
        explorerUrl: historyTxUrl({ link: `${STELLAR_EXPLORER}/tx/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "stMsg", e); }
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
      setBalanceAfter($("tnIntentText"), { balance: tok.amount, amount, fee: null, symbol: tok.symbol });
      show("tnIntent"); msg("tnMsg", "");
    } catch (e) { msg("tnMsg", "Could not check: " + e.message); }
  };
  $("tnConfirm").onclick = async () => {
    if (!pendingTon) return;
    const btn = $("tnConfirm");
    try {
      setSendBusy(btn, true);
      msg("tnMsg", "Signing locally and submitting…", true);
      const { hash } = await sendTon(wallet.mnemonic.phrase, { to: pendingTon.to, amount: pendingTon.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingTon.amount, symbol: tok.symbol, to: pendingTon.to,
        link: `${TON_EXPLORER}/address/${tonAddr}`, explorer: TON_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingTon; pendingTon = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "ton"), to: done.to, familyName: "TON", feeText: null,
        explorerUrl: historyTxUrl({ link: `${TON_EXPLORER}/address/${tonAddr}` }), txid: hash, pending: true });
    } catch (e) { sendFailed(btn, "tnMsg", e); }
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
      setBalanceAfter($("nrIntentText"), { balance: tok.amount, amount, fee: null, symbol: tok.symbol });
      show("nrIntent"); msg("nrMsg", "");
    } catch (e) { msg("nrMsg", "Could not check the recipient: " + e.message); }
  };
  $("nrConfirm").onclick = async () => {
    if (!pendingNear) return;
    const btn = $("nrConfirm");
    try {
      setSendBusy(btn, true);
      msg("nrMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendNear(wallet.mnemonic.phrase, { to: pendingNear.to, amount: pendingNear.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingNear.amount, symbol: tok.symbol, to: pendingNear.to,
        link: `${NEAR_EXPLORER}/txns/${hash}`, explorer: NEAR_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingNear; pendingNear = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "near"), to: done.to, familyName: "NEAR", feeText: null,
        explorerUrl: historyTxUrl({ link: `${NEAR_EXPLORER}/txns/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "nrMsg", e); }
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
    <input id="agTo" placeholder="Recipient Algorand address or Fluid name (e.g. dripbot)" autocapitalize="none">
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
    let to = $("agTo").value.trim();
    let sendName = null;
    const amount = $("agAmt").value.trim();
    // Recipient handling is the shared resolveChainRecipient path
    // (QA F2): a valid Algorand address — the checksum-verified zero
    // address included — is recognised as an address BEFORE any name
    // lookup; anything else is treated as a Fluid name, resolved
    // against the registry, and hard-blocked when the name is
    // unregistered or carries no Algorand address.
    // Round 2: the sheet hands the trimmed input to that ONE shared
    // function unconditionally — it no longer pre-gates on its own
    // isValidAlgorandAddress check first. The address-vs-name
    // decision lives in exactly one place (the place the suite pins
    // end-to-end), so the sheet's behaviour can never diverge from
    // the pinned core path for any input shape.
    if (!to) return msg("agMsg", "That is not a valid Algorand address.");
    msg("agMsg", "Resolving…", true);
    try {
      const r = await resolveChainRecipient(to, { isValidAddress: isValidAlgorandAddress, field: "algo", chainLabel: "Algorand" });
      to = r.to; sendName = r.name;
      if (sendName) toast("Name resolved");
      msg("agMsg", "");
    } catch (e) { return msg("agMsg", e.message); }
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
      pendingAlgo = { to, amount, feeAlgo: plan.feeAlgo, name: sendName };
      $("agIntentText").textContent = formatAlgoSendIntent({ amount, symbol: tok.symbol, to, feeAlgo: plan.feeAlgo, name: sendName })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("agIntentText"), { balance: tok.amount, amount, fee: tokenArg ? null : Number(plan.feeAlgo), symbol: tok.symbol });
      show("agIntent"); msg("agMsg", "");
    } catch (e) { msg("agMsg", "Could not check the recipient: " + e.message); }
  };
  $("agConfirm").onclick = async () => {
    if (!pendingAlgo) return;
    const btn = $("agConfirm");
    try {
      setSendBusy(btn, true);
      msg("agMsg", "Signing locally and submitting…", true);
      const { hash } = await sendAlgorand(wallet.mnemonic.phrase, { to: pendingAlgo.to, amount: pendingAlgo.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingAlgo.amount, symbol: tok.symbol, to: pendingAlgo.to,
        link: `${ALGO_EXPLORER}/tx/${hash}`, explorer: ALGO_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingAlgo; pendingAlgo = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "algorand"), to: done.to, toName: done.name, familyName: "Algorand",
        feeText: done.feeAlgo != null ? `${done.feeAlgo} ALGO` : null,
        explorerUrl: historyTxUrl({ link: `${ALGO_EXPLORER}/tx/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "agMsg", e); }
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
      pendingXrp = { to, amount, destinationTag, feeXrp: plan.feeXrp };
      $("xrIntentText").textContent = formatXrplSendIntent({ amount, symbol: tok.symbol, to, feeXrp: plan.feeXrp, destinationTag })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("xrIntentText"), { balance: tok.amount, amount, fee: tokenArg ? null : Number(plan.feeXrp), symbol: tok.symbol });
      show("xrIntent"); msg("xrMsg", "");
    } catch (e) { msg("xrMsg", "Could not check the recipient: " + e.message); }
  };
  $("xrConfirm").onclick = async () => {
    if (!pendingXrp) return;
    const btn = $("xrConfirm");
    try {
      setSendBusy(btn, true);
      msg("xrMsg", "Signing locally and submitting…", true);
      const { hash } = await sendXrpl(wallet.mnemonic.phrase, {
        to: pendingXrp.to, amount: pendingXrp.amount, token: tokenArg, destinationTag: pendingXrp.destinationTag,
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingXrp.amount, symbol: tok.symbol, to: pendingXrp.to,
        link: `${XRPL_EXPLORER}/tx/${hash}`, explorer: XRPL_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingXrp; pendingXrp = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "xrpl"), to: done.to, familyName: "XRP Ledger",
        feeText: done.feeXrp != null ? `${done.feeXrp} XRP` : null,
        explorerUrl: historyTxUrl({ link: `${XRPL_EXPLORER}/tx/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "xrMsg", e); }
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
      pendingDot = { to, amount, feeDot: plan.feeDot };
      $("dtIntentText").textContent = formatDotSendIntent({ amount, symbol: tok.symbol, to, feeDot: plan.feeDot })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("dtIntentText"), { balance: tok.amount, amount, fee: tokenArg ? null : Number(plan.feeDot), symbol: tok.symbol });
      show("dtIntent"); msg("dtMsg", "");
    } catch (e) { msg("dtMsg", "Could not estimate: " + e.message); }
  };
  $("dtConfirm").onclick = async () => {
    if (!pendingDot) return;
    const btn = $("dtConfirm");
    try {
      setSendBusy(btn, true);
      msg("dtMsg", "Signing locally and submitting…", true);
      const { hash } = await sendDot(wallet.mnemonic.phrase, { to: pendingDot.to, amount: pendingDot.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingDot.amount, symbol: tok.symbol, to: pendingDot.to,
        link: `${DOT_EXPLORER}/extrinsic/${hash}`, explorer: DOT_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingDot; pendingDot = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "polkadot"), to: done.to, familyName: "Polkadot Asset Hub",
        feeText: done.feeDot != null ? `${done.feeDot} DOT` : null,
        explorerUrl: historyTxUrl({ link: `${DOT_EXPLORER}/extrinsic/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "dtMsg", e); }
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
      pendingAptos = { to, amount, feeApt: aptosOctasToApt(plan.estimatedFeeOctas) };
      $("apIntentText").textContent = formatAptosSendIntent({ amount, symbol: tok.symbol, to, feeApt: aptosOctasToApt(plan.estimatedFeeOctas) })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("apIntentText"), { balance: tok.amount, amount, fee: tokenArg ? null : Number(aptosOctasToApt(plan.estimatedFeeOctas)), symbol: tok.symbol, decimals: 8 });
      show("apIntent"); msg("apMsg", "");
    } catch (e) { msg("apMsg", "Could not simulate the send: " + e.message); }
  };
  $("apConfirm").onclick = async () => {
    if (!pendingAptos) return;
    const btn = $("apConfirm");
    try {
      setSendBusy(btn, true);
      msg("apMsg", "Signing locally and submitting…", true);
      const { hash } = await sendAptos(wallet.mnemonic.phrase, { to: pendingAptos.to, amount: pendingAptos.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingAptos.amount, symbol: tok.symbol, to: pendingAptos.to,
        link: `${APTOS_EXPLORER}/transaction/${hash}`, explorer: APTOS_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingAptos; pendingAptos = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "aptos"), to: done.to, familyName: "Aptos",
        feeText: done.feeApt != null ? `${done.feeApt} APT` : null,
        explorerUrl: historyTxUrl({ link: `${APTOS_EXPLORER}/transaction/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "apMsg", e); }
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
      pendingStacks = { to, amount, feeUstx: plan.feeUstx };
      $("sxIntentText").textContent = plan.intent + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("sxIntentText"), { balance: tok.amount, amount, fee: tokenArg ? null : Number(stacksRawToAmount(plan.feeUstx, 6)), symbol: tok.symbol });
      show("sxIntent"); msg("sxMsg", "");
    } catch (e) { msg("sxMsg", e.message); }
  };
  $("sxConfirm").onclick = async () => {
    if (!pendingStacks) return;
    const btn = $("sxConfirm");
    try {
      setSendBusy(btn, true);
      msg("sxMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendStacks(wallet.mnemonic.phrase, { to: pendingStacks.to, amountText: pendingStacks.amount, token: tokenArg });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingStacks.amount, symbol: sanitizePersistedSymbol(tok.symbol), to: pendingStacks.to,
        link: stacksExplorerTxUrl(hash), explorer: STACKS_EXPLORER, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingStacks; pendingStacks = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: tok.symbol,
        logoHtml: tokenLogoHtml(tok, "stacks"), to: done.to, familyName: "Stacks",
        feeText: done.feeUstx != null ? `${stacksRawToAmount(done.feeUstx, 6)} STX` : null,
        explorerUrl: historyTxUrl({ link: stacksExplorerTxUrl(hash) }), txid: hash, pending: true });
    } catch (e) { sendFailed(btn, "sxMsg", e); }
  };
}

// ---------- Litecoin sheet ----------
// Mirrors the Tron/Solana sheets: review → human-readable sentence →
// confirm. Built and signed locally by sendLitecoin (same @scure stack
// as Bitcoin, Litecoin network parameters).
function openLtcSheet() {
  let pendingLtc = null;
  openSheet(`<h3>Send LTC on Litecoin</h3>
    <p><b>${ltcLoadFailed ? "Balance couldn't load" : fmt(ltcBal, 8) + " LTC"}</b> · from <span class="mono">${ltcAddr}</span></p>
    <input id="lTo" placeholder="Recipient ltc1… address" autocapitalize="none">
    <input id="lAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="lReview">Review send</button>
    <div id="lIntent" class="hidden">
      <p class="seed" id="lIntentText"></p>
      <button class="btn" id="lConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="lMsg"></p>
    <p class="tag">The fee rate is cross-checked against two independent sources and capped, like Bitcoin's; the exact fee is shown before you confirm. Sends are final.</p>`);
  $("lReview").onclick = async () => {
    const to = $("lTo").value.trim(), amount = $("lAmt").value.trim();
    if (!isValidLitecoinAddress(to)) return msg("lMsg", "That is not a valid Litecoin address.");
    if (!amount || Number(amount) <= 0) return msg("lMsg", "Enter an amount.");
    // A failed load is UNKNOWN, not zero: the stale 0 balance must
    // never answer "Amount is more than your balance." (EVM precedent).
    if (ltcLoadFailed) return msg("lMsg", "Balance couldn't load right now — tap More → Refresh and try again.");
    if (Number(amount) > ltcBal) return msg("lMsg", "Amount is more than your balance.");
    try {
      // Build now, show the EXACT fee, broadcast the same bytes on
      // confirm (audit H1) — no more 140-vbyte estimate in the sentence.
      msg("lMsg", "Checking the network fee…", true);
      const plan = await planLitecoinSend(wallet.mnemonic.phrase, { to, amountLtc: Number(amount) });
      pendingLtc = { to, amount, plan };
      $("lIntentText").textContent = formatLitecoinSendIntent({
        amount, to, feeLtc: plan.feeLtc.toFixed(8),
        feeUsd: usd(plan.feeLtc * (prices.LTC || 0)), note: feeRateNote(plan.rateInfo),
      });
      setBalanceAfter($("lIntentText"), { balance: ltcBal, amount, fee: plan.feeLtc, symbol: "LTC", decimals: 8 });
      show("lIntent"); msg("lMsg", "");
    } catch (e) { msg("lMsg", "Could not check the fee: " + e.message); }
  };
  $("lConfirm").onclick = async () => {
    if (!pendingLtc) return;
    const btn = $("lConfirm");
    try {
      setSendBusy(btn, true);
      msg("lMsg", "Broadcasting the transaction you reviewed…", true);
      const txid = await broadcastLitecoinTx(pendingLtc.plan.hex);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingLtc.amount, symbol: "LTC", to: pendingLtc.to,
        explorer: "https://litecoinspace.org", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingLtc; pendingLtc = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: "LTC",
        logoHtml: tokenLogoHtml({ symbol: "LTC" }, "litecoin"), to: done.to, familyName: "Litecoin",
        feeText: `${done.plan.feeLtc.toFixed(8)} LTC`,
        explorerUrl: historyTxUrl({ hash: txid, explorer: "https://litecoinspace.org" }), txid, pending: true });
    } catch (e) { sendFailed(btn, "lMsg", e); }
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
    <p><b>${bchLoadFailed ? "Balance couldn't load" : fmt(bchBal, 8) + " BCH"}</b> · from <span class="mono">${bchAddr}</span></p>
    <input id="cTo" placeholder="Recipient bitcoincash:q… or legacy address" autocapitalize="none">
    <input id="cAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn" id="cReview">Review send</button>
    <div id="cIntent" class="hidden">
      <p class="seed" id="cIntentText"></p>
      <button class="btn" id="cConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="cMsg"></p>
    <p class="tag">Fees are a fixed 1 satoshi per byte — the exact fee for your inputs is shown before you confirm. CashAddr and legacy addresses both work. Sends are final.</p>`);
  $("cReview").onclick = async () => {
    const to = $("cTo").value.trim(), amount = $("cAmt").value.trim();
    if (!isValidBchAddress(to)) return msg("cMsg", "That is not a valid Bitcoin Cash address.");
    if (!amount || Number(amount) <= 0) return msg("cMsg", "Enter an amount.");
    // A failed load is UNKNOWN, not zero: the stale 0 balance must
    // never answer "Amount is more than your balance." (EVM precedent).
    if (bchLoadFailed) return msg("cMsg", "Balance couldn't load right now — tap More → Refresh and try again.");
    if (Number(amount) > bchBal) return msg("cMsg", "Amount is more than your balance.");
    try {
      // Build now, show the EXACT fee, broadcast the same bytes on
      // confirm (audit H1) — no more hardcoded "typical" fee.
      msg("cMsg", "Checking the network fee…", true);
      const plan = await planBitcoinCashSend(wallet.mnemonic.phrase, { to, amountBch: Number(amount) });
      pendingBch = { to, amount, plan };
      $("cIntentText").textContent = formatBitcoinCashSendIntent({
        amount, to, feeBch: plan.feeBch.toFixed(8), feeUsd: usd(plan.feeBch * (prices.BCH || 0)),
      });
      setBalanceAfter($("cIntentText"), { balance: bchBal, amount, fee: plan.feeBch, symbol: "BCH", decimals: 8 });
      show("cIntent"); msg("cMsg", "");
    } catch (e) { msg("cMsg", "Could not check the fee: " + e.message); }
  };
  $("cConfirm").onclick = async () => {
    if (!pendingBch) return;
    const btn = $("cConfirm");
    try {
      setSendBusy(btn, true);
      msg("cMsg", "Broadcasting the transaction you reviewed…", true);
      const txid = await broadcastBitcoinCashTx(pendingBch.plan.hex, pendingBch.plan.txid);
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingBch.amount, symbol: "BCH", to: pendingBch.to,
        link: `https://blockchair.com/bitcoin-cash/transaction/${txid}`, explorer: "https://blockchair.com/bitcoin-cash", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingBch; pendingBch = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: "BCH",
        logoHtml: tokenLogoHtml({ symbol: "BCH" }, "bitcoincash"), to: done.to, familyName: "Bitcoin Cash",
        feeText: `${done.plan.feeBch.toFixed(8)} BCH`,
        explorerUrl: historyTxUrl({ link: `https://blockchair.com/bitcoin-cash/transaction/${txid}` }), txid, pending: true });
    } catch (e) { sendFailed(btn, "cMsg", e); }
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
    <p><b>${dogeLoadFailed ? "Balance couldn't load" : fmt(dogeBal, 8) + " DOGE"}</b>${dogeLoadFailed ? "" : ` · ${usd(dogeBal * (prices.DOGE || 0))}`}</p>
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
    // A failed load is UNKNOWN, not zero: the stale 0 balance must
    // never answer "Amount is more than your balance." (EVM precedent).
    if (dogeLoadFailed) return msg("gMsg", "Balance couldn't load right now — tap More → Refresh and try again.");
    if (Number(amount) > dogeBal) return msg("gMsg", "Amount is more than your balance.");
    try {
      // Build now, show the EXACT fee, relay the same bytes on confirm
      // (audit H1) — no more 226-byte estimate in the sentence.
      msg("gMsg", "Checking the network fee…", true);
      const plan = await planDogecoinSend(wallet.mnemonic.phrase, { to, amountDoge: Number(amount) });
      pendingDoge = { to, amount, plan };
      $("gIntentText").textContent = formatDogeSendIntent({
        amount, to, feeDoge: plan.feeDoge.toFixed(8), feeUsd: usd(plan.feeDoge * (prices.DOGE || 0)),
        note: plan.clamped ? "the live fee quote was unusually high, so Fluid capped the rate — the fee shown is exactly what will be paid" : "",
      });
      setBalanceAfter($("gIntentText"), { balance: dogeBal, amount, fee: plan.feeDoge, symbol: "DOGE", decimals: 8 });
      show("gIntent"); msg("gMsg", "");
    } catch (e) { msg("gMsg", "Could not check the fee: " + e.message); }
  };
  $("gConfirm").onclick = async () => {
    if (!pendingDoge) return;
    const btn = $("gConfirm");
    try {
      setSendBusy(btn, true);
      msg("gMsg", "Relaying the transaction you reviewed…", true);
      await broadcastDogeTx(pendingDoge.plan.hex);
      const txid = pendingDoge.plan.txid;
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount: pendingDoge.amount, symbol: "DOGE", to: pendingDoge.to,
        link: `https://blockchair.com/dogecoin/transaction/${txid}`, explorer: "https://blockchair.com/dogecoin", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingDoge; pendingDoge = null;
      showTxSuccess({ verb: "Broadcast", amount: done.amount, symbol: "DOGE",
        logoHtml: tokenLogoHtml({ symbol: "DOGE" }, "dogecoin"), to: done.to, familyName: "Dogecoin",
        feeText: `${done.plan.feeDoge.toFixed(8)} DOGE`,
        explorerUrl: historyTxUrl({ link: `https://blockchair.com/dogecoin/transaction/${txid}` }), txid, pending: true });
    } catch (e) { sendFailed(btn, "gMsg", e); }
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
  // Default selection lives in wallet-core (cosmosSendSelection): the
  // native denom in every balance state — including an EMPTY token
  // list, which used to leave sel null and kill every review with
  // "No token selected." (QA 2026-11-07).
  let sel = cosmosSendSelection(chain, chain.tokens);
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
      pendingCosmos = { to, amount, fee: est.fee, denom: sel.denom, decimals: sel.decimals, symbol: sel.symbol,
        feeText: `${Number(est.feeText).toFixed(6)} ${est.feeSymbol}`, feeAmt: Number(est.feeText) };
      $("kIntentText").textContent = formatCosmosSendIntent({
        amount, symbol: sel.symbol, to, chainName: chain.name,
        feeAmount: Number(est.feeText).toFixed(6), feeSymbol: est.feeSymbol })
        + (sel.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("kIntentText"), { balance: sel.amount, amount, fee: sel.denom === chain.denom ? Number(est.feeText) : null, symbol: sel.symbol });
      show("kIntent"); msg("kMsg", "");
    } catch (e) { msg("kMsg", "Could not estimate the fee: " + e.message); }
  };
  $("kConfirm").onclick = async () => {
    if (!pendingCosmos) return;
    const btn = $("kConfirm");
    try {
      setSendBusy(btn, true);
      msg("kMsg", "Signing locally and broadcasting…", true);
      const { hash } = await sendCosmos(wallet.mnemonic.phrase, chain.key, {
        to: pendingCosmos.to, amount: pendingCosmos.amount, fee: pendingCosmos.fee,
        denom: pendingCosmos.denom, decimals: pendingCosmos.decimals });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash, amount: pendingCosmos.amount, symbol: pendingCosmos.symbol, to: pendingCosmos.to,
        link: `${chain.explorer}/txs/${hash}`, explorer: chain.explorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      const done = pendingCosmos; pendingCosmos = null;
      showTxSuccess({ verb: "Sent", amount: done.amount, symbol: done.symbol,
        logoHtml: tokenLogoHtml({ symbol: done.symbol }, chain.key), to: done.to, familyName: chain.name,
        feeText: done.feeText || null,
        explorerUrl: historyTxUrl({ link: `${chain.explorer}/txs/${hash}` }), txid: hash, pending: false });
    } catch (e) { sendFailed(btn, "kMsg", e); }
  };
}

// ---------- Lightning ----------
// Native node first: a real rust-lightning node inside the app, seeded
// from the wallet's own phrase, in a LAZY chunk (lightning.chunk.js)
// loaded only when this panel opens. The WebLN/LNURL flow survives as
// a clearly-labelled fallback for builds without the chunk (the
// single-file build) or users who prefer an external wallet.
let lnSession = null, lnChunk = null, lnEvents = [];
const lnNetKey = () => localStorage.getItem("fluid_ln_network") || "bitcoin";
const lnSats = (msat) => `${(Number(msat || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;

$("lightningRow").onclick = () => openLightningPanel();

async function openLightningPanel() {
  openSheet(`<h3>${icon("bolt", "ic ic-brand")} Lightning</h3>
    <p class="tag">Starting your Lightning node… The first open downloads the node code (a few MB, once); after that it runs entirely on your device, from your own seed. Nobody custodies your sats.</p>
    <p class="msg" id="lnBootMsg"></p>`);
  try {
    if (!lnChunk) lnChunk = await import("./lightning.chunk.js");
    if (!lnSession || lnSession.network !== lnNetKey()) {
      if (lnSession) lnSession.stopLoops();
      lnSession = await lnChunk.bootLightning({
        phrase: wallet.mnemonic.phrase,
        network: lnNetKey(),
        wsProxy: localStorage.getItem("fluid_ln_wsproxy") || "",
      });
      lnSession.startLoops((evs) => {
        lnEvents = [...evs.reverse(), ...lnEvents].slice(0, 8);
        if ($("lnPanel")) paintLnPanel();
      });
      lnSession.syncNow().catch(() => {});
    }
    paintLnPanel();
  } catch (e) {
    lnFallbackSheet("The native Lightning node isn't available in this build (" + e.message + ").");
  }
}

function lnEventLine(ev) {
  if (ev.type === "payment_received") return `Received ${lnSats(ev.amountMsat)} (${esc(ev.kind || "bolt11")})`;
  if (ev.type === "payment_sent") return "Payment sent ✓";
  if (ev.type === "payment_failed") return "Payment failed — no funds moved";
  if (ev.type === "channel_ready") return "Channel is open and ready ✓";
  if (ev.type === "channel_pending") return "Channel funded, waiting for confirmations…";
  if (ev.type === "static_invoice_stored") return "Your offline-receive offer was registered with your holding peer ✓";
  if (ev.type === "held_message_stored") return "A payment message is being held for a peer";
  return "";
}

function paintLnPanel() {
  const s = lnSession; if (!s) return;
  const bal = s.balance();
  const chans = s.channels();
  const hist = s.history().slice(-8).reverse();
  const net = s.network;
  openSheet(`<div id="lnPanel"><h3>${icon("bolt", "ic ic-brand")} Lightning — your own node</h3>
    <p class="tag">Node <span class="mono">${esc(s.nodeId.slice(0, 16))}…</span> · network:
      <select id="lnNetSel">
        <option value="bitcoin" ${net === "bitcoin" ? "selected" : ""}>Bitcoin mainnet</option>
        <option value="signet" ${net === "signet" ? "selected" : ""}>Signet (test coins)</option>
        <option value="testnet" ${net === "testnet" ? "selected" : ""}>Testnet (test coins)</option>
      </select></p>
    <p><b>Spendable:</b> ${lnSats(bal.spendableMsat)} · <b>Receivable:</b> ${lnSats(bal.receivableMsat)}${bal.claimableOnchainSat ? ` · <b>Claimable on-chain:</b> ${Number(bal.claimableOnchainSat).toLocaleString()} sats` : ""}</p>
    ${lnEvents.length ? `<p class="tag">${lnEvents.map(lnEventLine).filter(Boolean).map(esc).join("<br>")}</p>` : ""}
    <h4>Pay</h4>
    <textarea id="lnTarget" rows="3" placeholder="lnbc… invoice, lno… offer, ₿name@domain, name@domain, or a Fluid name"></textarea>
    <input id="lnSatsIn" inputmode="numeric" placeholder="Sats (for offers / addresses / amountless invoices)">
    <div class="stickyfoot"><button class="btn" id="lnPayBtn">Pay with my node</button></div>
    <p class="msg err" id="lnPayMsg"></p>
    <h4>Receive</h4>
    <input id="lnRcvSats" inputmode="numeric" placeholder="Sats (optional for the offer)">
    <input id="lnRcvDesc" placeholder="What is it for? (optional)">
    <button class="btn ghost" id="lnInvoiceBtn">New one-time invoice</button>
    <button class="btn ghost" id="lnOfferBtn">My reusable offer (my Lightning address)</button>
    <div id="lnRcvOut"></div>
    <h4>Receive while Fluid is closed</h4>
    <p class="tag">${esc(holdWindowCopy(24))}</p>
    <p class="tag">Your channel peer can act as your holding peer: ask it for blinded paths (the DripBot keeper provides them), paste them here, and Fluid builds your offline-receive offer.</p>
    <textarea id="lnSisPaths" rows="2" placeholder='Blinded paths from your holding peer (JSON list)'></textarea>
    <button class="btn ghost" id="lnSisBtn">Use these paths &amp; show my offline offer</button>
    <div id="lnSisOut"></div>
    <h4>Wake-up notifications</h4>
    <p class="tag">Optional: a notification relay (holds no keys and no funds — see Tools in the project repo) pings your phone when a payment is waiting, so you can open Fluid and claim it.</p>
    <input id="lnRelay" placeholder="Relay URL, e.g. https://relay.example.com" value="${esc(localStorage.getItem("fluid_ln_relay") || "")}">
    <button class="btn ghost" id="lnWakeBtn">Enable wake-up notifications</button>
    <p class="msg" id="lnWakeMsg"></p>
    <h4>Channels (${chans.length})</h4>
    ${chans.length ? chans.map(c => `<p class="tag mono">${esc(String(c.counterparty).slice(0, 16))}… · ${Number(c.valueSat).toLocaleString()} sats · spend ${lnSats(c.outboundMsat)} / receive ${lnSats(c.inboundMsat)}${c.isUsable ? "" : " · not ready yet"}</p>`).join("") : `<p class="tag">No channels yet — open one to a peer or LSP below. You need a channel before you can send or receive.</p>`}
    <input id="lnPeerKey" placeholder="Peer pubkey (66 hex chars)">
    <input id="lnPeerHost" placeholder="Peer host — wss://… endpoint, or host for your proxy">
    <input id="lnPeerPort" inputmode="numeric" placeholder="Port (e.g. 9735)">
    <input id="lnChanSats" inputmode="numeric" placeholder="Channel size in sats">
    <input id="lnProxy" placeholder="Optional WebSocket proxy template: wss://proxy.example/{host}/{port}" value="${esc(localStorage.getItem("fluid_ln_wsproxy") || "")}">
    <button class="btn ghost" id="lnOpenBtn">Connect &amp; open channel</button>
    <p class="msg" id="lnChanMsg"></p>
    <div id="lnFundOut"></div>
    ${hist.length ? `<h4>Recent payments</h4>${hist.map(h => `<p class="tag">${h.dir === "in" ? "+" : h.dir === "out" ? "−" : "failed "}${h.amountMsat ? lnSats(h.amountMsat) + " · " : ""}<span class="mono">${esc(String(h.paymentHash || "").slice(0, 12))}…</span></p>`).join("")}` : ""}
    <h4>Fallback</h4>
    <p class="tag">Prefer an external Lightning wallet? <button class="btn ghost" id="lnFallbackBtn">Pay via WebLN / LNURL instead</button></p>
    </div>`);
  $("lnNetSel").onchange = () => { localStorage.setItem("fluid_ln_network", $("lnNetSel").value); if (lnSession) { lnSession.stopLoops(); lnSession = null; } openLightningPanel(); };
  $("lnPayBtn").onclick = lnPayWithNode;
  $("lnInvoiceBtn").onclick = () => lnShowReceive("invoice");
  $("lnOfferBtn").onclick = () => lnShowReceive("offer");
  $("lnSisBtn").onclick = lnSetupOfflineOffer;
  $("lnWakeBtn").onclick = lnEnableWakeUp;
  $("lnOpenBtn").onclick = lnOpenChannel;
  $("lnFallbackBtn").onclick = () => lnFallbackSheet("");
  // The event pump repaints this whole panel; the receive and
  // offline-offer displays are state-driven, so repaint them from
  // their state — a rendered offer must never be wiped blank (F6).
  paintLnReceive();
  paintLnSis();
}

async function lnPayWithNode() {
  const target = $("lnTarget").value.trim();
  const sats = Number($("lnSatsIn").value) || 0;
  const msat = sats > 0 ? BigInt(Math.round(sats * 1000)) : null;
  if (!target) return msg("lnPayMsg", "Paste an invoice, offer, address or Fluid name first.");
  let paidMsat = msat;
  try {
    const kind = classifyLightningTarget(target).kind;
    msg("lnPayMsg", "Paying…", true);
    if (kind === "bolt11") {
      const parsed = parseBolt11(target);
      if (parsed.amountMsat != null) paidMsat = BigInt(Math.round(Number(parsed.amountMsat)));
      lnSession.payInvoice(target, parsed.amountMsat != null ? null : msat);
    } else if (kind === "bolt12") {
      lnSession.payOffer(target, msat);
    } else if (kind === "address") {
      // BIP-353 first (an offer in DNS); LNURL-pay as the interop path.
      let offer = null;
      try { offer = (await resolveBip353Address(target)).offer; } catch { offer = null; }
      if (offer) { lnSession.payOffer(offer, msat); }
      else {
        if (!msat) return msg("lnPayMsg", "Enter the sats amount for an address payment.");
        const invoice = await lightningInvoiceForAddress(target, sats);
        lnSession.payInvoice(invoice, null);
      }
    } else if (kind === "fluid-name") {
      const hit = await resolveFluidName(target).catch(() => null);
      if (!hit || !hit.ln) return msg("lnPayMsg", "That Fluid name has no Lightning address in the registry.");
      if (!msat) return msg("lnPayMsg", "Enter the sats amount for a name payment.");
      const invoice = await lightningInvoiceForAddress(hit.ln, sats);
      lnSession.payInvoice(invoice, null);
    } else {
      return msg("lnPayMsg", "That doesn't look like a Lightning invoice, offer, address or Fluid name.");
    }
    showTxSuccess({ verb: "Paid", amount: paidMsat != null ? Number(paidMsat) / 1000 : null, symbol: "sats",
      logoHtml: tokenLogoHtml({ symbol: "BTC" }, "lightning"), to: target, familyName: "Lightning",
      feeText: null, explorerUrl: null, txid: null, pending: true });
  } catch (e) { msg("lnPayMsg", "Payment failed: " + lnErrorText(e)); }
}

// Receive + offline-offer displays live in core-driven state
// (lnReceiveTransition/lnReceiveView) and are REPAINTED from that
// state after every panel repaint — the node's event pump repaints
// the whole panel, and a display held only in the DOM was wiped
// blank (QA F6). Errors go through lnErrorText: the WASM node
// throws plain strings, and reading .message off one used to
// render an empty error paragraph — a silent blank.
let lnReceiveState = { status: "idle" };
let lnReceiveWhich = "invoice";
let lnSisState = { status: "idle" };
function paintLnReceive() {
  const out = $("lnRcvOut"); if (!out) return;
  const v = lnReceiveView(lnReceiveState);
  if (v.status === "working") {
    out.innerHTML = `<p class="tag"><span class="spinner"></span> Building your ${lnReceiveWhich === "offer" ? "reusable offer" : "invoice"}…</p>`;
  } else if (v.status === "ready") {
    out.innerHTML = `<img class="qr" id="qrLnRcv"><p class="mono">${esc(v.text)}</p>
      <button class="btn ghost" id="cpLnRcv">Copy</button>
      ${lnReceiveWhich === "offer" ? `<p class="tag">This offer is your shareable Lightning address — anyone can pay it any number of times. (For payments while Fluid is closed, use the offline-receive offer below.)</p>` : ""}`;
    qr("qrLnRcv", v.text);
    $("cpLnRcv").onclick = () => copyText(v.text, $("cpLnRcv"));
  } else if (v.status === "failed") {
    out.innerHTML = `<p class="msg err">${esc(v.message)}</p>
      <button class="btn ghost" id="lnRcvRetry">Try again</button>`;
    $("lnRcvRetry").onclick = () => lnShowReceive(lnReceiveWhich);
  } else out.innerHTML = "";
}
function paintLnSis() {
  const out = $("lnSisOut"); if (!out) return;
  const v = lnReceiveView(lnSisState);
  if (v.status === "working") {
    out.innerHTML = `<p class="tag"><span class="spinner"></span> Paths set. Building your offline-receive offer — this takes a short exchange with your peer…</p>`;
  } else if (v.status === "ready") {
    out.innerHTML = `<img class="qr" id="qrLnSis"><p class="mono">${esc(v.text)}</p>
      <button class="btn ghost" id="cpLnSis">Copy offline-receive offer</button>
      <p class="tag">${esc(holdWindowCopy(24))}</p>`;
    qr("qrLnSis", v.text);
    $("cpLnSis").onclick = () => copyText(v.text, $("cpLnSis"));
  } else if (v.status === "failed") {
    out.innerHTML = `<p class="msg err">${esc(v.message)}</p>`;
  } else out.innerHTML = "";
}
function lnShowReceive(which) {
  if (!$("lnRcvOut")) return;
  lnReceiveWhich = which;
  const sats = Number($("lnRcvSats").value) || 0;
  const desc = $("lnRcvDesc").value.trim() || "Fluid payment";
  lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "request" });
  paintLnReceive();
  try {
    const text = which === "invoice"
      ? lnSession.createInvoice(sats > 0 ? Math.round(sats * 1000) : null, desc)
      : lnSession.createOffer(sats > 0 ? Math.round(sats * 1000) : null, desc);
    lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "success", text });
  } catch (e) {
    lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "failure", error: e });
  }
  paintLnReceive();
}

async function lnSetupOfflineOffer() {
  if (!$("lnSisOut")) return;
  // Validate BEFORE JSON.parse ever sees the text (QA F7): empty or
  // malformed input gets a friendly, specific message — never the
  // raw "Unexpected end of JSON input" SyntaxError text.
  let paths;
  try { paths = parseSisPathsInput($("lnSisPaths").value); }
  catch (e) {
    lnSisState = lnReceiveTransition(lnSisState, { type: "failure", error: e });
    paintLnSis();
    return;
  }
  lnSisState = lnReceiveTransition(lnSisState, { type: "request" });
  paintLnSis();
  try {
    lnSession.setSisPaths(paths);
    const offer = lnSession.asyncReceiveOffer();
    lnSisState = lnReceiveTransition(lnSisState, { type: "success", text: offer });
  } catch (e) {
    lnSisState = lnReceiveTransition(lnSisState, { type: "failure", error: e });
  }
  paintLnSis();
}

async function lnEnableWakeUp() {
  try {
    const relayUrl = $("lnRelay").value.trim();
    if (!relayUrl) return msg("lnWakeMsg", "Enter the relay URL first.");
    localStorage.setItem("fluid_ln_relay", relayUrl);
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("sw.js").catch(() => { throw new Error("Service worker registration failed — wake-ups need the hosted build."); });
    }
    const { webhookUrl } = await lnChunk.subscribeWakeUp({ relayUrl, nodeId: lnSession.nodeId });
    msg("lnWakeMsg", "Wake-ups on ✓ Give this webhook URL to your holding peer: " + webhookUrl, true);
  } catch (e) { msg("lnWakeMsg", lnErrorText(e)); }
}

async function lnOpenChannel() {
  const pubkey = $("lnPeerKey").value.trim();
  const host = $("lnPeerHost").value.trim();
  const port = Number($("lnPeerPort").value) || 9735;
  const sats = Number($("lnChanSats").value) || 0;
  const proxy = $("lnProxy").value.trim();
  localStorage.setItem("fluid_ln_wsproxy", proxy);
  if (!/^[0-9a-fA-F]{66}$/.test(pubkey)) return msg("lnChanMsg", "Peer pubkey must be 66 hex characters.");
  if (!host) return msg("lnChanMsg", "Enter the peer host (a wss:// endpoint, or a host your proxy can reach).");
  if (sats < 10000) return msg("lnChanMsg", "Channel size must be at least 10,000 sats.");
  try {
    msg("lnChanMsg", "Connecting to peer… (if this peer needs a proxy, set the template above and re-open the panel so the node restarts with it)", true);
    lnSession.connectPeer(pubkey, host, port);
    await new Promise(r => setTimeout(r, 4000));
    lnSession.openChannel(pubkey, sats, 0);
    msg("lnChanMsg", "Channel requested. The funding step appears below when the node is ready for it.", true);
    lnWatchFunding();
  } catch (e) { msg("lnChanMsg", "Open channel failed: " + lnErrorText(e)); }
}

// Poll for the node's funding request; on mainnet offer the in-app BTC
// funding flow (review the EXACT fee, broadcast the reviewed bytes,
// hand them to the node). On test networks the user pastes a funding
// tx built elsewhere (e.g. from a faucet wallet).
function lnWatchFunding() {
  const started = Date.now();
  const iv = setInterval(async () => {
    if (!$("lnFundOut") || Date.now() - started > 180000) return clearInterval(iv);
    const pending = lnSession.pendingFunding();
    if (!pending.length) return;
    clearInterval(iv);
    const req = pending[0];
    const out = $("lnFundOut"); if (!out) return;
    if (lnSession.network === "bitcoin") {
      try {
        const to = fundingAddressFromScript(req.scriptPubkey, "bitcoin");
        const plan = await planBitcoinSend(wallet.mnemonic.phrase, { to, amountBtc: req.valueSat / 1e8 });
        out.innerHTML = `<p class="tag">Fund the channel: send exactly <b>${Number(req.valueSat).toLocaleString()} sats</b> to the channel's funding address <span class="mono">${esc(to)}</span>. Network fee: ${plan.feeSat} sats.</p>
          <button class="btn" id="lnFundBtn">Fund channel (${Number(req.valueSat).toLocaleString()} sats + ${plan.feeSat} fee)</button>
          <p class="msg" id="lnFundMsg"></p>`;
        $("lnFundBtn").onclick = async () => {
          try {
            msg("lnFundMsg", "Broadcasting the funding transaction…", true);
            await broadcastBitcoinTx(plan.hex);
            lnSession.fundingTxReady(req.userChannelId, plan.hex);
            msg("lnFundMsg", "Funding broadcast ✓ The channel opens once it confirms.", true);
          } catch (e) { msg("lnFundMsg", "Funding failed: " + e.message); }
        };
      } catch (e) {
        out.innerHTML = `<p class="msg err">Could not build the funding payment: ${esc(e.message)}</p>`;
      }
    } else {
      out.innerHTML = `<p class="tag">Fund the channel from any ${esc(lnSession.network)} wallet: pay exactly <b>${Number(req.valueSat).toLocaleString()} sats</b> to the funding script <span class="mono">${esc(req.scriptPubkey)}</span> (address form: <span class="mono">${esc(fundingAddressFromScript(req.scriptPubkey, lnSession.network))}</span>), then paste the raw signed transaction hex:</p>
        <textarea id="lnFundHex" rows="2" placeholder="Raw funding transaction hex"></textarea>
        <button class="btn" id="lnFundBtn">Submit funding transaction</button>
        <p class="msg" id="lnFundMsg"></p>`;
      $("lnFundBtn").onclick = () => {
        try {
          lnSession.fundingTxReady(req.userChannelId, $("lnFundHex").value.trim());
          msg("lnFundMsg", "Funding submitted ✓ The channel opens once it confirms.", true);
        } catch (e) { msg("lnFundMsg", "Funding failed: " + e.message); }
      };
    }
  }, 3000);
}

function lnFallbackSheet(note) {
  openSheet(`<h3>${icon("bolt", "ic ic-brand")} Lightning payment (fallback)</h3>
    ${note ? `<p class="tag">${esc(note)}</p>` : ""}
    <p class="tag">Fluid never custodies Lightning funds. Paste an invoice — your own WebLN wallet (e.g. Alby) pays it.</p>
    <textarea id="lnInv" rows="3" placeholder="lnbc… invoice — or a Fluid name / Lightning address"></textarea>
    <input id="lnSats" inputmode="numeric" placeholder="Sats (only for name / Lightning address)">
    <div class="stickyfoot"><button class="btn" id="lnPay">Pay</button></div>
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
      let paidSats = null;
      try { const p = parseBolt11(invoice); if (p.amountMsat != null) paidSats = Number(p.amountMsat) / 1000; } catch { /* amount unknown — the recap omits it */ }
      showTxSuccess({ verb: "Paid", amount: paidSats, symbol: "sats",
        logoHtml: tokenLogoHtml({ symbol: "BTC" }, "lightning"), to: target, familyName: "Lightning",
        feeText: null, explorerUrl: null, txid: null, pending: false });
    } catch (e) { msg("lnMsg", lnErrorText(e)); }
  };
}

// ---------- WalletConnect ----------
// Fluid as a wallet for OTHER apps: paste a wc: URI, review the
// session proposal, and every later signing request comes back here
// as a human-readable intent (core's decodeWcRequest — F-01: the
// payload is inspected, never just the envelope). Transport is the
// lazy walletconnect.chunk.js (Reown WalletKit); every decision and
// signature happens here + wallet-core, with the unlocked vault's
// key. While Fluid is locked, requests are refused to the dApp —
// the keys only exist in memory while unlocked.
let wcChunk = null, wcClient = null;

$("wcBtn").onclick = () => openWcPanel();

async function wcBoot() {
  if (wcClient) return wcClient;
  if (!wcChunk) wcChunk = await import("./walletconnect.chunk.js");
  wcClient = await wcChunk.bootWalletConnect({
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: "Fluid",
      description: "Fluid — every chain, one wallet. Non-custodial, open source.",
      url: "https://fluidwallet.dpdns.org",
      icons: ["https://fluidwallet.dpdns.org/og-image.png"],
    },
    onProposal: (p) => wcOnProposal(p),
    onRequest: (ev) => { wcOnRequest(ev).catch(() => {}); },
    onSessionDelete: () => { toast("An app disconnected from Fluid"); if ($("wcSessions")) paintWcSessions(); },
    onAuthenticate: (auth) => {
      wcClient.rejectAuthenticate(auth.id).catch(() => {});
      toast("An app asked for one-tap sign-in, which Fluid doesn't support yet — rejected");
    },
  });
  // Replay anything that arrived while the panel was closed — same
  // review sheets as live items, never silently answered.
  for (const p of Object.values(wcClient.pendingProposals() || {})) wcOnProposal(p);
  for (const r of Object.values(wcClient.pendingRequests() || {})) wcOnRequest(r).catch(() => {});
  return wcClient;
}

async function openWcPanel() {
  if (!walletConnectConfigured()) {
    openSheet(`<h3>${icon("layers", "ic ic-brand")} WalletConnect</h3>
      <p class="tag">WalletConnect isn't configured in this build yet — it needs a Reown project ID, and none is set. Nothing is broken: every other part of Fluid works as normal, and this panel will light up as soon as the ID is added.</p>`);
    return;
  }
  openSheet(`<h3>${icon("layers", "ic ic-brand")} WalletConnect</h3>
    <p class="tag">Starting WalletConnect… the first open downloads its code (once); after that it loads from your device.</p>`);
  try {
    await wcBoot();
    paintWcPanel();
  } catch (e) {
    openSheet(`<h3>${icon("layers", "ic ic-brand")} WalletConnect</h3>
      <p class="tag">WalletConnect isn't available in this build (${esc((e && e.message) || e)}). The single-file build can't load it — open Fluid at <b>fluidwallet.dpdns.org</b> to connect to dApps.</p>`);
  }
}

function paintWcPanel() {
  openSheet(`<div id="wcPanel"><h3>${icon("layers", "ic ic-brand")} WalletConnect</h3>
    <p class="tag">Connect Fluid to an app: open the app, choose WalletConnect, copy its pairing code (it starts with <span class="mono">wc:</span>) and paste it here. You'll review the connection before anything is shared. (Pairing codes are copied text for now — Fluid has no camera scanner yet.)</p>
    <textarea id="wcUri" rows="3" placeholder="wc:… pairing code from the app" autocapitalize="none"></textarea>
    <div class="stickyfoot"><button class="btn" id="wcConnectBtn">Connect</button></div>
    <p class="msg err" id="wcMsg"></p>
    <h4>Connected apps</h4>
    <div id="wcSessions"></div>
    </div>`);
  $("wcConnectBtn").onclick = wcConnect;
  paintWcSessions();
}

async function wcConnect() {
  const uri = $("wcUri").value.trim();
  if (!parseWcUri(uri)) return msg("wcMsg", "That doesn't look like a WalletConnect pairing code — it should start with wc: and come fresh from the app's WalletConnect screen.");
  const btn = $("wcConnectBtn"); btn.disabled = true;
  try {
    msg("wcMsg", "Pairing — waiting for the app's connection request…", true);
    await wcClient.pair(uri);
    msg("wcMsg", "Paired. The app's connection request appears here for your review.", true);
  } catch (e) {
    msg("wcMsg", "Pairing failed: " + ((e && e.message) || e) + " — pairing codes expire fast; copy a fresh one and try again.");
  } finally { btn.disabled = false; }
}

function paintWcSessions() {
  const host = $("wcSessions");
  if (!host || !wcClient) return;
  const sessions = Object.values(wcClient.sessions() || {});
  if (!sessions.length) {
    host.innerHTML = `<p class="tag">No apps connected. Connections you approve will appear here, and you can disconnect them any time.</p>`;
    return;
  }
  host.innerHTML = sessions.map(s => {
    const sum = wcSessionSummary(s);
    const chainNames = sum.chainIds.map(id => { const k = evmNetworkKeyForChainId(id); return k ? NETWORKS[k].name : `Chain ${id}`; });
    return `<div class="hist" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span><b>${esc(sum.name || "Unnamed app")}</b>${sum.url ? `<br><small class="mono">${esc(sum.url)}</small>` : ""}<br><small style="color:var(--dim)">${esc(chainNames.join(", ") || "No chains")}</small></span>
      <button class="btn ghost" data-wc-disconnect="${esc(sum.topic)}" style="width:auto;padding:6px 12px;flex:none">Disconnect</button>
    </div>`;
  }).join("");
  host.querySelectorAll("[data-wc-disconnect]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await wcClient.disconnect(b.dataset.wcDisconnect); toast("Disconnected"); }
    catch (e) { toast("Disconnect failed: " + ((e && e.message) || e)); }
    paintWcSessions();
  });
}

function wcOnProposal(proposal) {
  const d = describeWcProposal(proposal);
  const iconHtml = d.icon ? `<img src="${esc(d.icon)}" alt="" width="44" height="44" style="border-radius:10px;vertical-align:middle;margin-right:10px" referrerpolicy="no-referrer">` : "";
  openSheet(`<div id="wcProposal"><h3>${icon("layers", "ic ic-brand")} Connection request</h3>
    <p>${iconHtml}<b style="font-size:17px">${esc(d.name || "Unnamed app")}</b></p>
    ${d.url ? `<p class="tag mono">${esc(d.url)}</p>` : ""}
    ${d.description ? `<p class="tag">${esc(d.description)}</p>` : ""}
    <p class="tag">This app is asking to connect to your Fluid wallet. If you approve, it can see your EVM address and ask you to sign messages and transactions — every request still comes back here for your review before anything is signed.</p>
    <h4>Chains</h4>
    ${d.chains.length ? d.chains.map(c => `<p class="tag">${esc(c.name)} <span class="mono">(chain ${c.chainId})</span>${c.required ? "" : " · optional"}${c.supported ? "" : " · NOT supported by Fluid"}</p>`).join("") : `<p class="tag">All Fluid EVM chains</p>`}
    <h4>It may ask you to</h4>
    ${d.methods.length ? d.methods.map(m => `<p class="tag mono">${esc(m)}</p>`).join("") : `<p class="tag">View your address</p>`}
    ${d.otherNamespaces.length ? `<p class="tag">It also asks for: ${esc(d.otherNamespaces.join(", "))} — Fluid doesn't support ${d.otherNamespaces.length === 1 ? "that family" : "those families"} yet.</p>` : ""}
    ${d.refusal ? `<p class="banner err">${icon("alert", "ic ic-sm")}<span>${esc(d.refusal)}</span></p>
      <div class="stickyfoot"><button class="btn danger" id="wcPropReject">Reject</button></div>`
    : `<div class="stickyfoot"><button class="btn" id="wcPropApprove">Connect</button>
      <button class="btn danger" id="wcPropReject">Reject</button></div>`}
    <p class="msg err" id="wcPropMsg"></p></div>`);
  $("wcPropReject").onclick = async () => {
    try { await wcClient.rejectSession(proposal.id); } catch { /* already expired — nothing to tell the dApp */ }
    toast("Connection rejected");
    paintWcPanel();
  };
  const ap = $("wcPropApprove");
  if (ap) ap.onclick = async () => {
    if (!wallet) return msg("wcPropMsg", "Fluid locked itself — unlock it, then ask the app for a fresh connection request.");
    ap.disabled = true;
    try {
      const namespaces = buildWcNamespaces({ proposal, address: wallet.address });
      await wcClient.approveSession(proposal.id, namespaces);
      toast("Connected to " + (d.name || "the app"));
      paintWcPanel();
    } catch (e) {
      ap.disabled = false;
      msg("wcPropMsg", "Couldn't connect: " + ((e && e.message) || e));
    }
  };
}

async function wcOnRequest(event) {
  const { id, topic } = event;
  const req = (event.params && event.params.request) || {};
  const chainId = event.params && event.params.chainId;
  const session = wcClient && wcClient.sessions() ? wcClient.sessions()[topic] : null;
  const sum = session ? wcSessionSummary(session) : null;
  const dappName = (sum && sum.name) || "A connected app";
  if (!wallet) {
    try { await wcClient.respondError(topic, id, 4100, "Fluid is locked — unlock it to review requests."); } catch { /* relay gone */ }
    return;
  }
  const decoded = decodeWcRequest({ method: req.method, params: req.params, chainId, ownAddress: wallet.address });
  if (!decoded.ok) {
    try { await wcClient.respondError(topic, id, 4200, decoded.reason); } catch { /* relay gone */ }
    openSheet(`<h3>${icon("alert", "ic ic-brand")} Request refused</h3>
      <p class="tag"><b>${esc(dappName)}</b> asked Fluid to run <span class="mono">${esc(String(req.method || "an unknown method"))}</span>.</p>
      <p class="banner err">${icon("alert", "ic ic-sm")}<span>${esc(decoded.reason)}</span></p>
      <p class="tag">Nothing was signed. The refusal has been sent back to the app.</p>
      <div class="stickyfoot"><button class="btn" id="wcRefusedOk">OK</button></div>`);
    $("wcRefusedOk").onclick = () => paintWcPanel();
    return;
  }
  if (decoded.auto) {
    // Read-only answers the approved session already granted.
    try {
      if (decoded.kind === "accounts") await wcClient.respondResult(topic, id, [wallet.address]);
      else if (decoded.kind === "chainId") await wcClient.respondResult(topic, id, "0x" + Number(decoded.chainId || 1).toString(16));
    } catch { /* relay gone */ }
    return;
  }
  const netName = decoded.networkKey ? NETWORKS[decoded.networkKey].name : (decoded.chainId ? `Chain ${decoded.chainId}` : "");
  const rowsHtml = decoded.rows.map(r => r.label === "Message"
    ? `<p class="tag" style="margin:10px 0 2px">${esc(r.label)}</p><p class="seed" style="white-space:pre-wrap">${esc(r.value)}</p>`
    : `<div class="txrow"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join("");
  openSheet(`<div id="wcRequest"><h3>${icon("layers", "ic ic-brand")} ${decoded.kind === "transaction" ? "Transaction request" : "Sign request"}</h3>
    <p class="tag">From <b>${esc(dappName)}</b>${sum && sum.url ? ` · <span class="mono">${esc(sum.url)}</span>` : ""}${netName ? ` · on ${esc(netName)}` : ""}</p>
    <p class="seed" style="white-space:pre-wrap">${esc(decoded.intent)}</p>
    ${rowsHtml}
    ${decoded.warning ? `<p class="banner err">${icon("alert", "ic ic-sm")}<span>${esc(decoded.warning)}</span></p>` : ""}
    <div class="stickyfoot"><button class="btn" id="wcReqApprove">${decoded.kind === "transaction" ? "Send transaction" : "Sign"}</button>
    <button class="btn danger" id="wcReqReject">Reject</button></div>
    <p class="msg err" id="wcReqMsg"></p></div>`);
  $("wcReqReject").onclick = async () => {
    try { await wcClient.respondError(topic, id, 4001, "User rejected the request."); } catch { /* relay gone */ }
    toast("Request rejected");
    paintWcPanel();
  };
  $("wcReqApprove").onclick = async () => {
    const btn = $("wcReqApprove");
    if (!wallet) return msg("wcReqMsg", "Fluid locked itself — unlock and ask the app to retry.");
    if (decoded.kind === "transaction") setSendBusy(btn, true); else btn.disabled = true;
    try {
      if (decoded.kind === "personal_sign") {
        const sig = await signWcMessage(wallet, decoded.sign);
        await wcClient.respondResult(topic, id, sig);
        toast("Message signed");
        paintWcPanel();
      } else if (decoded.kind === "typed_data") {
        const sig = await signWcTypedData(wallet, decoded.sign);
        await wcClient.respondResult(topic, id, sig);
        toast("Typed data signed");
        paintWcPanel();
      } else if (decoded.kind === "transaction") {
        const tx = await executeWcTransaction(wallet, decoded.sign);
        await wcClient.respondResult(topic, id, tx.hash);
        setSendBusy(btn, false);
        showTxSuccess({ verb: "Sent", amount: null, symbol: "", to: decoded.sign.tx.to, familyName: netName, txid: tx.hash, pending: true });
      }
    } catch (e) {
      if (decoded.kind === "transaction") setSendBusy(btn, false); else btn.disabled = false;
      try { await wcClient.respondError(topic, id, 5000, "Fluid couldn't complete it: " + ((e && (e.shortMessage || e.message)) || e)); } catch { /* relay gone */ }
      showSheetError("Failed: " + ((e && (e.shortMessage || e.message)) || e));
    }
  };
}

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
    <p class="tag" id="rBench" style="display:none;margin-top:10px"></p>
    <div id="rList"></div>`);
  // Live market benchmark: Paycrest's keyless rates API (a price
  // source, not a route — see wallet-core), fetched fresh for this
  // sheet opening and never persisted. Served corridors: Nigeria
  // (buy AND sell — QA F9) and Kenya (same surface, QA F10). Any
  // failure leaves the line hidden rather than showing a stale or
  // wrong figure.
  const BENCH = { NG: { fiat: "NGN", sym: "₦", dec: 0 }, KE: { fiat: "KES", sym: "KSh ", dec: 2 } };
  let benchRate = null, benchKey = "";
  const paintBench = () => {
    const el = $("rBench"); if (!el) return;
    const cEl = $("rCountry");
    const b = cEl && BENCH[cEl.value];
    if (b && benchKey === cEl.value + ":" + mode && benchRate != null) {
      // benchRate is a number parsed + band-checked in wallet-core;
      // the line is built from that number, never from raw response text.
      const num = benchRate.toLocaleString("en-US", { minimumFractionDigits: b.dec, maximumFractionDigits: b.dec });
      el.textContent = mode === "buy"
        ? `Market rate now: ≈ ${b.sym}${num} per $1 (live)`
        : `Market sell rate now: ≈ ${b.sym}${num} per $1 (live)`;
      el.style.display = "";
    } else el.style.display = "none";
  };
  const paint = () => {
    const code = $("rCountry").value, asset = $("rAsset").value, netKey = $("rNet").value;
    localStorage.setItem("fluid_country", code);
    $("rAssetLabel").textContent = `Coin (on ${NETWORKS[netKey].name})`;
    // Per-country lineup ranked on MEASURED price vs the market rate
    // (rampRoutesFor in wallet-core). The CHEAPEST badge comes from the
    // plan's price evidence, not from list position alone.
    const { country: c, routes, mtpUnavailable } = rampRoutesFor(code, mode, netKey, asset);
    $("rList").innerHTML =
      `<p class="tag" style="margin-top:10px">Sorted by real measured price against the market rate (price checks 6–7 Nov 2026) — where a price couldn't be verified, the note says so. The provider shows your final quote before you pay.</p>` +
      routes.map(r => r.unavailable
        // Unavailable-for-this-corridor rows (QA F8) render as plain
        // rows with the reason visible — never as live links.
        ? `<div class="netitem rampitem"><span class="rampname">${esc(r.name)} <span class="pill soon">UNAVAILABLE</span></span><small class="rampnote">${esc(r.note)}</small></div>`
        // No inline onclick (the CSP forbids inline handlers): the URL
        // rides in a data attribute and is opened by the bound listener.
        // Name + badge on their own line, note beneath (stacked layout).
        : `<button class="netitem rampitem" data-ramp-url="${esc(r.url)}"><span class="rampname">${esc(r.name)}${r.badge ? ' <span class="pill">CHEAPEST</span>' : ""}${r.external ? ' <span class="pill soon">EXTERNAL APP</span>' : ""}</span><small class="rampnote">${esc(r.note)}</small></button>`).join("") +
      (routes.length === 0 ? `<p class="tag">No ${mode === "buy" ? "buy" : "cash-out"} route for ${esc(c.name)} passes Fluid's bar right now — a direct page that lets you paste your Fluid address, with no WalletConnect step. We're working on it.</p>` : "") +
      (mtpUnavailable ? `<p class="tag">Mt Pelerin is not available for ${esc(c.fiat)} yet — it takes USD, EUR, GBP, ZAR and 14 other currencies.</p>` : "");
    document.querySelectorAll("[data-ramp-url]").forEach(b => b.onclick = () => { const u = b.dataset.rampUrl; if (u && /^https:\/\//.test(u)) window.open(u, "_blank", "noopener"); });
    paintBench();
    const bMeta = BENCH[code];
    if (bMeta && benchKey !== code + ":" + mode) {
      benchKey = code + ":" + mode;
      benchRate = null;
      const benchEl = $("rBench"), key = benchKey;
      fetchPaycrestRate(bMeta.fiat, mode).then(rate => {
        // Only paint if this sheet's element is still on screen and
        // the user hasn't switched corridor since the fetch started.
        if (benchEl && benchEl.isConnected && benchKey === key) { benchRate = rate; paintBench(); }
      });
    }
  };
  $("rCountry").onchange = paint; $("rAsset").onchange = paint; $("rNet").onchange = paint; paint();
}
$("actBuy").onclick = () => rampSheet("buy");
$("actCash").onclick = () => rampSheet("sell");
const hzBuy = $("homeBuy"); if (hzBuy) hzBuy.onclick = () => $("actBuy").click();
const hzRcv = $("homeReceive"); if (hzRcv) hzRcv.onclick = () => $("actReceive").click();

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
  // Relay (the primary router) returns a single solver quote, not
  // LI.FI-style tool steps — its router name is simply "Relay", and
  // the confirm sentence names it so the user always sees which
  // router will move their money.
  if (route && route.provider === "relay") return "Relay";
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
                  native: false, verified: lifiTokenVerified(t), priceUSD: t.priceUSD, logoURI: t.logoURI || null });
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
  const fromKey0 = (viewKey === "tron" || viewKey === "solana" || viewKey === "sui") ? viewKey : (networkKey === "sepolia" ? "bsc" : networkKey);
  const toKey0 = fromKey0 === "base" ? "bsc" : "base";
  // §4.2: from a non-swappable family view the sheet still opens —
  // with a one-line caption, never a dead button.
  const swapViewCaption = (viewKey !== "all" && viewKey !== "evm" && !["tron", "solana", "sui"].includes(viewKey))
    ? `<p class="tag">Swaps run on EVM, Solana, Tron and Sui — pick a source chain below.</p>` : "";
  openSheet(`<h3>Swap</h3>
    <p class="tag">One search across every Fluid chain (routes by Relay — LI.FI covers the chains Relay doesn't). Cheapest = most received after fees; you approve the exact sentence before anything is signed.</p>
    ${swapViewCaption}
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
    <button class="btn ghost" id="wFlip">${icon("swap", "ic ic-sm")} Flip</button>
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
      const ranked = rankSwapRoutes(routes, Number(toTok.priceUSD) || null).slice(0, 3);
      msg("wMsg", "");
      $("wList").innerHTML = ranked.map((r, i) => {
        const ex = swapRouteExecutable(r);
        const badges = `${r.cheapest ? '<span class="pill">CHEAPEST</span> ' : ""}${r.fastest ? '<span class="pill">FASTEST</span> ' : ""}`;
        const recv = fmt(swapRawToAmount(r.toAmount, toTok.decimals));
        return `<button class="netitem" data-route="${i}" ${ex.ok ? "" : "disabled style=\"opacity:.45\""}>
            <span>${badges}${recv} ${esc(toTok.symbol)}<br><small style="color:var(--dim)">${esc(swapRouteName(r))} · ${swapDurationText(r.durationSec)} · fees ≈ ${usd(r.gasCostUSD)}${r.usdMismatch ? " · ⚠ quoted value disagrees with the market price" : ""}</small></span>
            <span>${usd(r.toAmountUSD)}</span></button>
          ${ex.ok ? "" : `<p class="tag" style="margin:2px 0 8px">${esc(ex.reason)}</p>`}`;
      }).join("");
      document.querySelectorAll("[data-route]").forEach(b => b.onclick = () => {
        if (b.disabled) return;
        const r = ranked[Number(b.dataset.route)];
        pendingSwap = { route: r, fromKey, toKey, fromTok, toTok, amount };
        // Fluid's own fee, disclosed as its own clause in the confirm
        // sentence: computed from THIS quote's actual fromAmount with
        // the standard rate (platformFeeOn) — never a typed-in number.
        // Only where the route actually collects: LI.FI attaches the
        // fee per source chain only where its portal fee wallet is
        // registered (swapFeeCollectingChain); Relay attaches its App
        // Fee on every quote but may skip collecting dust-sized fees,
        // and its quote says so (platformFeeCollecting, parsed from
        // the quote's own fees.app) — no fee is disclosed on a route
        // that will not charge it.
        const collects = r.provider === "relay" ? r.platformFeeCollecting === true : swapFeeCollectingChain(r.fromChainId);
        const feeRaw = r.fromAmount != null && collects ? platformFeeOn(r.fromAmount) : 0n;
        const platformFee = feeRaw > 0n ? `${fmt(swapRawToAmount(feeRaw.toString(), fromTok.decimals))} ${fromTok.symbol}` : null;
        $("wIntentText").textContent = formatSwapIntent({
          fromAmount: amount, fromSymbol: fromTok.symbol, fromNetKey: fromKey,
          toAmount: fmt(swapRawToAmount(r.toAmount, toTok.decimals)), toSymbol: toTok.symbol, toNetKey: toKey,
          toolName: swapRouteName(r), feeUsd: r.gasCostUSD, durationSec: r.durationSec,
          ...(platformFee ? { platformFee } : {}),
        }) + ((fromTok.verified === false || toTok.verified === false) ? " ⚠ " + UNVERIFIED_CAUTION : "");
        show("wConfirm"); msg("wMsg", "");
      });
    } catch (e) { msg("wMsg", "Route search failed: " + (e.shortMessage || e.message)); }
  };
  $("wDo").onclick = async () => {
    if (!pendingSwap) return;
    const { route, fromKey, toKey, fromTok, toTok, amount } = pendingSwap;
    const btn = $("wDo"); setSendBusy(btn, true);
    try {
      let hashes, srcExplorer, srcLink;
      // Keep a device record of every approval Fluid makes, so the user
      // can review and revoke them later (More → Token approvals).
      // Shared by both EVM executors (Relay and LI.FI).
      const recordEvmApproval = (rec) => {
        const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
        list.unshift({ chainKey: rec.chainKey, token: rec.token, tokenSymbol: sanitizePersistedSymbol(rec.tokenSymbol), spender: rec.spender, amount: rec.decimals != null ? swapRawToAmount(rec.amount, rec.decimals) : rec.amount, at: rec.at });
        localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
      };
      if (route.provider === "relay") {
        // Relay route (primary router): EVM source by construction —
        // its steps are complete transactions, bounds-checked in core.
        hashes = await executeRelaySwapRoute(wallet, route, (t) => msg("wMsg", t, true), recordEvmApproval);
        srcExplorer = NETWORKS[fromKey].explorer;
      } else if (fromKey === "solana") {
        hashes = await executeSolanaSwapRoute(wallet.mnemonic.phrase, route, (t) => msg("wMsg", t, true));
        srcExplorer = SOLANA_EXPLORER;
        srcLink = `${SOLANA_EXPLORER}/tx/${hashes[0]}`;
      } else if (fromKey === "tron") {
        // Tron signs with the same key as the EVM account (the unlocked
        // wallet object carries it) — never the phrase.
        hashes = await executeTronSwapRoute(wallet, route, (t) => msg("wMsg", t, true), (rec) => {
          const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
          list.unshift({ chainKey: rec.chainKey, token: rec.token, tokenSymbol: sanitizePersistedSymbol(rec.tokenSymbol), spender: rec.spender, amount: rec.decimals != null ? swapRawToAmount(rec.amount, rec.decimals) : rec.amount, at: rec.at });
          localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
        });
        srcExplorer = TRON_EXPLORER;
        srcLink = `${TRON_EXPLORER}/#/transaction/${hashes[0]}`;
      } else if (fromKey === "sui") {
        hashes = await executeSuiSwapRoute(wallet.mnemonic.phrase, route, (t) => msg("wMsg", t, true));
        srcExplorer = SUI_EXPLORER;
        srcLink = `${SUI_EXPLORER}/mainnet/tx/${hashes[0]}`;
      } else {
        hashes = await executeSwapRoute(wallet, route, (t) => msg("wMsg", t, true), recordEvmApproval);
        srcExplorer = NETWORKS[fromKey].explorer;
      }
      const destAddr = toKey === "solana" ? solAddr : toKey === "tron" ? tronAddr : toKey === "sui" ? suiAddr : wallet.address;
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: hashes[0], amount, symbol: `${sanitizePersistedSymbol(fromTok.symbol)}→${sanitizePersistedSymbol(toTok.symbol)}`, to: destAddr, ...(srcLink ? { link: srcLink } : {}), explorer: srcExplorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
      pendingSwap = null;
      showTxSuccess({ verb: "Swapped", amount, symbol: `${fromTok.symbol}→${toTok.symbol}`,
        logoHtml: `<span class="swaplogos">${tokenLogoHtml(fromTok, fromKey)}${tokenLogoHtml(toTok, toKey)}</span>`,
        to: destAddr, familyName: swapChainName(toKey),
        feeText: route.gasCostUSD != null ? `≈ ${usd(route.gasCostUSD)} network fees` : null,
        explorerUrl: srcLink ? historyTxUrl({ link: srcLink }) : historyTxUrl({ hash: hashes[0], explorer: srcExplorer }),
        txid: hashes[0], pending: fromKey !== toKey });
    } catch (e) { sendFailed(btn, "wMsg", e, "Swap failed: "); }
  };
};

// ---------- activity ----------
// SECURITY (audit C1): history entries persist token symbols from ERC-20 /
// LI.FI metadata — attacker-controlled. They render ONLY through
// formatHistoryEntry (wallet-core), which escapes every value and rebuilds
// the explorer link from a validated hash / clean https URL. Never
// interpolate a stored history field into innerHTML directly here.
function relTime(at) {
  const s = Math.max(0, (Date.now() - Number(at || 0)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function historyDayLabel(at) {
  const d = new Date(at), now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
const HISTORY_FAMILY_BY_HOST = [
  ["litecoinspace.org", "Litecoin"], ["blockchair.com/dogecoin", "Dogecoin"],
  ["blockchair.com/bitcoin-cash", "Bitcoin Cash"], ["mempool.space", "Bitcoin"],
  ["blockstream.info", "Bitcoin"], ["tronscan.org", "Tron"], ["solscan.io", "Solana"],
  ["suiscan.xyz", "Sui"], ["stellar.expert", "Stellar"], ["tonviewer.io", "TON"],
  ["nearblocks.io", "NEAR"], ["perawallet", "Algorand"], ["xrpscan.com", "XRP Ledger"],
  ["subscan.io", "Polkadot Asset Hub"], ["aptoscan.com", "Aptos"], ["explorer.hiro.so", "Stacks"],
  ["mintscan.io/cosmos", "Cosmos Hub"], ["mintscan.io/osmosis", "Osmosis"],
  ["mintscan.io/noble", "Noble"], ["mintscan.io/celestia", "Celestia"],
  ["mintscan.io/injective", "Injective"], ["mintscan.io/sei", "Sei"], ["mintscan.io/dydx", "dYdX"],
];
/** Family name for an Activity row's sub-line, derived from the
 *  entry's own explorer (presentation only — entries keep their
 *  original shape; nothing is re-stored). */
function historyFamilyLabel(x) {
  if (x && x.explorer) for (const k of Object.keys(NETWORKS)) if (NETWORKS[k].explorer === x.explorer) return NETWORKS[k].name;
  const src = String((x && (x.link || x.explorer)) || "");
  for (const [frag, label] of HISTORY_FAMILY_BY_HOST) if (src.includes(frag)) return label;
  return "";
}
function renderHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const host = $("history");
  if (!h.length) {
    host.innerHTML = `<div class="actempty">${icon("activity", "ic ic-xl")}<p class="t-title" style="margin:10px 0 4px">Nothing here yet</p><p class="tag">Sends, swaps and Lightning payments will show up here.</p><button class="btn" id="actFirstSend">Make your first send</button></div>`;
    const b = $("actFirstSend"); if (b) b.onclick = () => $("actSend").click();
    return;
  }
  // Sentences render ONLY through formatHistoryEntry (audit C1); the
  // row chrome (icon well, day groups, relative time, amount column)
  // is filled via textContent below — no stored field is interpolated
  // into markup here.
  const rendered = h.map(formatHistoryEntry);
  const groups = new Map();
  h.forEach((x, i) => {
    const label = historyDayLabel(x && x.at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(i);
  });
  let html = "";
  for (const [label, idxs] of groups) {
    html += `<p class="tag actday">${esc(label)}</p>`;
    for (const i of idxs) {
      const x = h[i];
      const isSwap = String((x && x.symbol) || "").includes("→");
      const well = isSwap ? icon("swap") : (x && x.symbol ? tokenLogoHtml({ symbol: x.symbol }, null) : icon("send"));
      html += `<div class="actrow" data-actrow="${i}"><span class="actwell">${well}</span><span class="actmain">${rendered[i]}<small class="actsub"></small></span><span class="actamt"></span></div>`;
    }
  }
  host.innerHTML = html;
  host.querySelectorAll("[data-actrow]").forEach(row => {
    const x = h[Number(row.dataset.actrow)];
    if (!x) return;
    const sub = row.querySelector(".actsub");
    if (sub) sub.textContent = [relTime(x.at), historyFamilyLabel(x)].filter(Boolean).join(" · ");
    const amt = row.querySelector(".actamt");
    if (amt) amt.textContent = x.amount != null ? String(x.amount) + " " + String(x.symbol || "") : "";
    const url = historyTxUrl(x);
    if (url) row.onclick = (e) => { if (e.target.closest("a")) return; window.open(url, "_blank", "noopener"); };
  });
}

// ---------- scan ----------
// Fluid Scan: the in-wallet explorer. All chain reads and every row's
// HTML live in wallet-core (formatScanFeedEntry is the only render
// path for chain-supplied strings — audit C1); this controller only
// resolves the input, paints the chrome (badges, balance headers,
// honest per-chain notes) and wires clicks. A search that finds
// nothing, or a chain that fails, says so in words — never a silent
// blank, never a dead button.
let scanSeq = 0;
function scanMsg(text, isErr) {
  const el = $("scanMsg");
  el.textContent = text || "";
  el.className = "msg" + (isErr ? " err" : "");
}
function renderScanResults(heading, sub, results) {
  const host = $("scanResults");
  const feed = mergeScanRows(results.map(r => r.rows));
  let html = `<div class="card" style="padding:6px 16px"><p class="t-title" style="margin:8px 0 2px">${esc(heading)}</p>`;
  if (sub) html += `<p class="tag" style="margin:0 0 6px">${esc(sub)}</p>`;
  for (const r of results) {
    const t = r.target;
    const amt = r.balanceText != null ? `${esc(r.balanceText)} ${esc(r.balanceSymbol || "")}`
      : (r.ok ? `<span style="color:var(--dim)">balance unavailable</span>` : `<span style="color:var(--bad)">couldn't load</span>`);
    html += `<div class="scanbal"><span class="scanbadge">${esc(t.badge)}</span><span class="grow"><b>${esc(t.label)}</b><small class="mono">${esc(shortAddr(t.address))}</small></span><span class="amt">${amt}</span></div>`;
    const note = scanChainStatusText(r);
    if (note) {
      const addrUrl = r.note === "no-history-index" ? scanAddressUrl(t.chainKey, t.address) : null;
      html += `<p class="scannote">${esc(note)}${addrUrl ? ` <a href="${esc(addrUrl)}" target="_blank" rel="noopener">View on the explorer ↗</a>` : ""}</p>`;
    }
  }
  html += `</div>`;
  if (feed.length) {
    html += `<div class="card" style="padding:4px 16px">`;
    feed.forEach((row, i) => {
      const well = row.direction === "in" ? icon("receive") : icon("send");
      html += `<div class="actrow" data-scanrow="${i}"><span class="actwell">${well}</span><span class="actmain">${formatScanFeedEntry(row, row.pending || !row.time ? "pending" : relTime(row.time))}</span><span class="scanbadge">${esc(scanChainBadge(row.chainKey))}</span></div>`;
    });
    html += `</div>`;
  } else if (results.length && results.every(r => !r.ok)) {
    html += `<div class="actempty">${icon("alert", "ic ic-xl")}<p class="t-title" style="margin:10px 0 4px">Couldn't load any chain</p><p class="tag">Check your connection and search again.</p></div>`;
  } else {
    html += `<div class="actempty">${icon("search", "ic ic-xl")}<p class="t-title" style="margin:10px 0 4px">No activity found</p><p class="tag">Nothing public on-chain for this lookup yet — the per-chain notes above say what each chain reported.</p></div>`;
  }
  host.innerHTML = html;
  host.querySelectorAll("[data-scanrow]").forEach(el => {
    const row = feed[Number(el.dataset.scanrow)];
    if (!row) return;
    const url = scanTxUrl(row.chainKey, row.txid);
    if (url) el.onclick = () => window.open(url, "_blank", "noopener");
  });
}
const shortAddr = (a) => a && a.length > 14 ? a.slice(0, 8) + "…" + a.slice(-6) : String(a || "");
async function runScan() {
  const input = $("scanInput").value.trim();
  if (!input) { scanMsg("Type a Fluid name or paste a wallet address first.", true); return; }
  const seq = ++scanSeq;
  const btn = $("scanBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Scanning`;
  scanMsg("");
  $("scanResults").innerHTML = "";
  let targets = [], heading = "", sub = "";
  const detected = detectScanFamily(input);
  if (detected) {
    targets = scanTargetsForAddress(detected);
    heading = shortAddr(detected.address);
    sub = detected.family === "evm" ? "This address, swept across Fluid's main EVM networks" : `${scanChainBadge(detected.family)} address`;
  } else {
    const entry = await resolveFluidName(input).catch(() => null);
    if (seq !== scanSeq) return;
    if (!entry) {
      btn.disabled = false; btn.textContent = "Search";
      const name = normalizeFluidName(input);
      scanMsg(validateFluidName(name)
        ? `No Fluid name "${name}" is registered — check the spelling, or paste a wallet address instead.`
        : "That doesn't look like a Fluid name or a wallet address.", true);
      return;
    }
    targets = scanTargetsForName(entry);
    heading = `${entry.name}.${FLUID_DOMAIN}`;
    sub = "Registered addresses only — what this name has published";
  }
  if (!targets.length) {
    btn.disabled = false; btn.textContent = "Search";
    scanMsg("Nothing scannable was found for that input.", true);
    return;
  }
  $("scanResults").innerHTML = `<div class="card"><b>${esc(heading)}</b><p class="tag" style="margin:6px 0 0">Scanning ${targets.length} chain${targets.length === 1 ? "" : "s"}…</p></div>`;
  const results = await fetchScan(targets).catch(() => []);
  if (seq !== scanSeq) return;
  btn.disabled = false; btn.textContent = "Search";
  renderScanResults(heading, sub, results);
}
$("scanBtn").onclick = () => runScan();
$("scanInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runScan(); });

// ---------- onboarding ----------
let pendingName = null;
$("createName").addEventListener("input", () => {
  const n = normalizeFluidName($("createName").value);
  $("createNamePreview").textContent = (n || "you") + "." + FLUID_DOMAIN;
});
// A password error must not outlive the fix (cosmetic, QA
// 2026-11-07): as soon as the typed password is valid (and the
// confirmation matches, once typed), the stale error clears.
for (const id of ["createPw", "createPw2"]) {
  $(id).addEventListener("input", () => {
    const m = $("onboardMsg").textContent || "";
    if (!/at least 12 characters|12\+ characters|Passwords do not match/.test(m)) return;
    const pw = $("createPw").value, pw2 = $("createPw2").value;
    if (validatePassword(pw) && (pw2 === "" || pw === pw2)) msg("onboardMsg", "");
  });
}
$("createBtn").onclick = async () => {
  const pw = $("createPw").value;
  if (!validatePassword(pw)) return msg("onboardMsg", "Password needs at least 12 characters.");
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
      const entry = buildNameEntry(pendingName, wallet.address, bitcoinAddress(wallet.mnemonic.phrase), null, algoAddressFromPhrase(wallet.mnemonic.phrase), solanaAddressFromPhrase(wallet.mnemonic.phrase), tronAddressFromPhrase(wallet.mnemonic.phrase), suiAddressFromPhrase(wallet.mnemonic.phrase));
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
  if (!validatePassword(pw)) return msg("onboardMsg", "Set a password (12+ characters) above first.");
  try {
    msg("onboardMsg", "Importing…", true);
    const v = await importVault($("importPhrase").value, pw);
    localStorage.setItem(VAULT_KEY, v.keystore);
    // The device-saved name belonged to the wallet being replaced —
    // unbind it (QA F11 round 2): a name is scoped to the wallet it
    // was claimed/adopted with, never carried across an import. The
    // imported wallet starts nameless here; renderMain's reverse
    // lookup re-attaches its own published name if it has one.
    localStorage.removeItem("fluid_name");
    nameAdoptTried = false;
    wallet = await unlockVault(v.keystore, pw);
    refreshGate();
  } catch (e) { msg("onboardMsg", e.message); }
};
$("unlockBtn").onclick = async () => {
  try {
    wallet = await unlockVault(localStorage.getItem(VAULT_KEY), $("unlockPw").value);
    // Opportunistic KDF upgrade (audit H2): a vault written at the old
    // scrypt strength is re-encrypted at the current strength with the
    // password the user just proved — silently, and a failure here must
    // never block an otherwise-good unlock.
    try {
      const stored = localStorage.getItem(VAULT_KEY);
      if (stored && needsKdfUpgrade(stored)) {
        localStorage.setItem(VAULT_KEY, await reencryptVault(wallet, $("unlockPw").value));
      }
    } catch { /* the old vault still works; the upgrade retries next unlock */ }
    refreshGate();
  }
  catch (e) { msg("onboardMsg", e.message); }
};

// ---------- lock-screen recovery ----------
// The destructive step is not taken here: this only opens the door
// to the existing create/import box (restoreMode), and only after
// the user confirms — in writing, via the checkbox — that the
// stored wallet will be replaced and its seed phrase is the only
// way back to it. The replace itself happens inside the shared
// createBtn/importBtn handlers above when they overwrite VAULT_KEY.
$("lockRestoreBtn").onclick = () => {
  openSheet(`<h3>Forgot your password?</h3>
    <p class="tag">Fluid can't reset it — your seed phrase is the reset. Continuing takes you to the create / import screen, where importing a seed phrase (or creating a new wallet) <b>replaces the wallet currently stored on this device</b>.</p>
    <p class="tag">The <b>only</b> way back to the wallet stored here now is <b>its own seed phrase</b>. If you don't have that seed phrase written down, stop: once replaced, that wallet is gone from this device for good. Funds on-chain are never deleted — only this device's copy.</p>
    <label style="display:block;margin:12px 0"><input type="checkbox" id="restoreCheck" style="width:auto"> I understand restoring replaces the wallet stored on this device, and its seed phrase is the only way back to it.</label>
    <button class="btn" id="restoreGo" style="background:#b3261e">Replace wallet &amp; continue</button>
    <button class="btn ghost" id="restoreCancel">Keep my wallet</button>`);
  $("restoreCancel").onclick = () => closeSheet();
  $("restoreGo").onclick = () => {
    if (!$("restoreCheck").checked) return showSheetError("Tick the box confirming you understand this replaces the wallet stored on this device.");
    restoreMode = true;
    closeSheet();
    refreshGate();
  };
};
$("restoreBackBtn").onclick = () => {
  // Backing out abandons the detour; never leave a typed seed phrase
  // or password sitting in the hidden form.
  restoreMode = false;
  for (const id of ["importPhrase", "createPw", "createPw2"]) { const el = $(id); if (el) el.value = ""; }
  refreshGate();
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
// Render generation for the name section (QA F11 round 2): the
// registry refine below is async, and a wallet switch (create /
// import / remove / unlock) can land while it is in flight. Every
// render bumps the generation; a refine that resolves against a
// stale generation — or a different name/wallet than it started
// with — is dropped instead of painting the old wallet's data into
// the new wallet's section.
let nameSectionGen = 0;
function renderNameSection() {
  const gen = ++nameSectionGen;
  const stored = localStorage.getItem("fluid_name");
  const myAddr = wallet ? wallet.address : null;
  const stillCurrent = () => gen === nameSectionGen
    && localStorage.getItem("fluid_name") === stored
    && (wallet ? wallet.address : null) === myAddr;
  // The home header greets by Fluid name (Ethuram's requirement): set it
  // here because every name-state change (claim, adoption, removal)
  // flows through this function, and renderMain calls it on unlock.
  $("welcomeText").textContent = formatWelcomeHeader(stored);
  // The section DESCRIPTION names the current wallet's name or the
  // generic placeholder — painted HERE, unconditionally, on every
  // render and in both states (QA round 3): it used to be written
  // only on the owned branch below (and set-only in renderMain), so
  // the claim state never repainted it — after remove + import in
  // one session it kept the REMOVED wallet's name until a page
  // reload reset the DOM to the static placeholder. This function
  // is now the description's ONLY writer.
  $("namePreview").textContent = stored ? stored + "." + FLUID_DOMAIN : "you." + FLUID_DOMAIN;
  if (!stored) { show("ownedNameBox", false); show("claimForm", true); return; }
  show("claimForm", false);
  show("ownedNameBox", true);
  $("ownedNameText").textContent = stored + "." + FLUID_DOMAIN;
  // Truthfulness (QA 2026-11-07): the note under the name states the
  // LOCAL state by default. The public-registry wording is earned
  // only when the registry lookup below resolves the name to THIS
  // wallet — a name claimed on-device but never published must not
  // be described as registered.
  const noteEl = $("ownedNameNote");
  if (noteEl) noteEl.textContent = "This name is saved on this device — publish its entry so other Fluid wallets can resolve it.";
  // Prefill from THIS wallet's own keys right away; the registry
  // entry (what senders actually resolve) refines the fields when
  // it loads. The addresses are derived from the current wallet's
  // phrase at render time — never read from the family globals
  // (btcAddr / algoAddr), which are populated for whichever wallet
  // the balance loaders last ran against and can still hold the
  // PREVIOUS wallet's addresses right after a switch (QA F11
  // round 2: a fresh wallet's section showed the replaced wallet's
  // Algorand address until a page reload).
  if (wallet) {
    $("ownedEvm").textContent = wallet.address;
    $("ownedBtc").textContent = bitcoinAddress(wallet.mnemonic.phrase);
    $("ownedAlgo").textContent = algoAddressFromPhrase(wallet.mnemonic.phrase);
  }
  $("copyOwnedEvm").onclick = () => copyText($("ownedEvm").textContent, $("copyOwnedEvm"));
  $("copyOwnedBtc").onclick = () => copyText($("ownedBtc").textContent, $("copyOwnedBtc"));
  $("copyOwnedAlgo").onclick = () => copyText($("ownedAlgo").textContent, $("copyOwnedAlgo"));
  $("copyOwnedLn").onclick = () => copyText($("ownedLn").textContent, $("copyOwnedLn"));
  // The owned box shows the SAME fields the claim form takes (QA
  // F11): EVM, Bitcoin, Algorand, and Lightning in both states. The
  // Lightning row is always present — the registered address when
  // the registry carries one, and the add form whenever it doesn't
  // (the Receive sheet sends users here for exactly this). Round 2:
  // the form ALSO renders when the registry couldn't be checked —
  // the entry is built locally from the user's own keys, so a
  // failed registry read must never suppress it; the honest note
  // and the form appear together.
  const paintOwnedLn = (ln, unknown = false) => {
    if (ln) {
      $("ownedLn").textContent = ln;
      show("copyOwnedLn", true); show("ownedLnAdd", false);
    } else if (unknown) {
      $("ownedLn").textContent = "Couldn't check the registry just now";
      show("copyOwnedLn", false); show("ownedLnAdd", true);
    } else {
      $("ownedLn").textContent = "Not registered yet";
      show("copyOwnedLn", false); show("ownedLnAdd", true);
    }
  };
  paintOwnedLn(null);
  $("ownedLn").textContent = "Checking the registry…";
  show("copyOwnedLn", false); show("ownedLnAdd", false);
  $("ownedLnAddBtn").onclick = () => {
    if (!wallet) return msg("nameMsg", "Unlock your wallet first.");
    const ln = $("ownedLnInput").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ln)) return msg("nameMsg", "That doesn't look like a Lightning address (name@domain).");
    const entry = buildNameEntry(stored,
      $("ownedEvm").textContent || wallet.address,
      $("ownedBtc").textContent || bitcoinAddress(wallet.mnemonic.phrase),
      ln,
      $("ownedAlgo").textContent || algoAddressFromPhrase(wallet.mnemonic.phrase),
      solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase),
      tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase),
      suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase));
    $("ownedEntry").textContent = JSON.stringify(entry).slice(1, -1) + ",";
    show("ownedEntryBox", true);
    msg("nameMsg", "Lightning address added to your entry — publish it so the change resolves everywhere.", true);
  };
  $("copyOwnedEntryBtn").onclick = () => copyText($("ownedEntry").textContent, $("copyOwnedEntryBtn"));
  resolveFluidName(stored).then(async (hit) => {
    if (!stillCurrent()) return;
    if (!hit) {
      // No entry resolved — two different truths hide behind it:
      // the registry couldn't be read at all, or this name simply
      // isn't published yet (the normal state of a freshly created
      // wallet). Round 1 collapsed both into "couldn't check" and
      // hid the Lightning add form (QA F11 round 2). Tell them
      // apart with the canonical registry read; either way the
      // form renders — only the note differs.
      const reg = await fetchNameRegistry().catch(() => null);
      if (!stillCurrent()) return;
      paintOwnedLn(null, !reg);
      return;
    }
    if (hit.evm) $("ownedEvm").textContent = hit.evm;
    if (hit.btc) $("ownedBtc").textContent = hit.btc;
    if (hit.algo) $("ownedAlgo").textContent = hit.algo;
    paintOwnedLn(hit.ln || null);
    if (noteEl && wallet && hit.evm) {
      if (String(hit.evm).toLowerCase() === String(wallet.address).toLowerCase()) {
        noteEl.textContent = "This name is registered to this wallet in the public registry — anyone can send to it on any chain.";
      } else {
        noteEl.textContent = "Saved on this device — but the public registry currently resolves this name to a different wallet.";
      }
    }
  }).catch(() => { if (stillCurrent()) paintOwnedLn(null, true); });
}
/** Reverse lookup, once per unlock session: if the public registry holds
 *  a name whose EVM, BTC, Algorand, Solana, Tron or Sui address is THIS
 *  wallet's, adopt it — store it locally and paint the owned state.
 *  Never touches names that resolve to anyone else's addresses. */
async function adoptRegistryNameIfMine() {
  if (!wallet || nameAdoptTried || localStorage.getItem("fluid_name")) return;
  nameAdoptTried = true;
  try {
    const reg = await fetchNameRegistry();
    const hit = findNameForAddresses(reg, { evm: wallet.address, btc: btcAddr || bitcoinAddress(wallet.mnemonic.phrase), algo: algoAddr || algoAddressFromPhrase(wallet.mnemonic.phrase), sol: solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase), tron: tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase), sui: suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase) });
    if (hit) {
      localStorage.setItem("fluid_name", hit.name);
      renderNameSection();
      paintHeader();
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
      { evm: wallet.address, btc: btcAddr || bitcoinAddress(wallet.mnemonic.phrase), algo: algoAddr || algoAddressFromPhrase(wallet.mnemonic.phrase), sol: solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase), tron: tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase), sui: suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase) });
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
  const entry = buildNameEntry(name, wallet.address, btcAddr || bitcoinAddress(wallet.mnemonic.phrase), $("lnInput").value.trim() || null, algoAddr || algoAddressFromPhrase(wallet.mnemonic.phrase), solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase), tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase), suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase));
  $("nameEntry").textContent = JSON.stringify(entry).slice(1, -1) + ",";
  show("claimBox");
  msg("nameMsg", "Name saved on this device. Publish the entry to make it resolve everywhere.", true);
  renderMain();
};
$("copyEntryBtn").onclick = () => copyText($("nameEntry").textContent, $("copyEntryBtn"));
renderNameSection();

// ---------- more tab ----------
// Refresh with visible feedback (cosmetic, QA 2026-11-07): the row
// shows its working state and a completion toast — never a tap that
// looks like nothing happened.
$("refreshBtn").onclick = async () => {
  const btn = $("refreshBtn");
  if (btn.dataset.busy) return;
  btn.dataset.busy = "1";
  const label = btn.querySelector(".grow");
  const old = label ? label.textContent : "";
  if (label) label.innerHTML = `<span class="spinner"></span> Refreshing…`;
  try {
    await renderMain();
    await new Promise(r => setTimeout(r, 900));
    // The old toast claimed success even when the EVM load had just
    // failed again — the refresh looked like it worked while nothing
    // had loaded. Report the load outcome, not the tap. (Caveat: the
    // Bitcoin loads are fire-and-forget, so the toast can only
    // reflect a BTC failure that has already landed when it fires —
    // a slow timeout still surfaces on the row + alert, not here.)
    toast((evmLoadFailed || btcLoadFailed) ? "Balances couldn't load — check your connection and try again" : "Balances refreshed");
  } finally {
    if (label) label.textContent = old || "Refresh balances";
    delete btn.dataset.busy;
  }
};
function lockWallet() { wallet = null; pendingSend = null; restoreMode = false; nameAdoptTried = false; msg("onboardMsg", ""); refreshGate(); }
$("lockBtn").onclick = lockWallet;
const hdrLockBtn = $("hdrLockBtn"); // §4.1 header lock — same handler as More's lock row
if (hdrLockBtn) hdrLockBtn.onclick = lockWallet;

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
  let chainFound = null; // on-chain scan result for the current network
  let pendingChainRevoke = null;
  openSheet(`<h3>Token approvals</h3>
    <p class="tag">Two views below: approvals found <b>on-chain</b> for this wallet on the current network — including any made from other apps — and Fluid's own records from this device. Revoking sets the permission back to zero.</p>
    <h4 style="margin:14px 0 4px">On-chain · ${esc(NETWORKS[networkKey].name)}</h4>
    <div id="apChainList"><p class="tag">Checking the chain for approvals…</p></div>
    <h4 style="margin:14px 0 4px">Fluid's records · this device</h4>
    <div id="apList"></div>
    <div id="apConfirm"></div>
    <p class="msg err" id="apMsg"></p>`);
  const emptyNote = `<p class="tag">No approvals recorded — swaps approve the exact amount needed, and they'll appear here.</p>`;
  const paint = () => {
    const mine = loadApprovals().map((a, i) => ({ ...a, _i: i })).filter(a => a.chainKey === networkKey || a.chainKey === "tron");
    // SECURITY (audit C1): approval records persist LI.FI token symbols —
    // attacker-controlled. Rows render ONLY through formatApprovalRow /
    // formatRevokePrompt (wallet-core), which escape every stored value.
    $("apList").innerHTML = mine.length ? mine.map(a => `
      <div class="hist" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        ${formatApprovalRow(a, fmt(a.amount), new Date(a.at).toLocaleDateString())}${a.chainKey === "tron" ? ' <span class="pill">TRON</span>' : ""}
        <button class="btn ghost" data-revoke="${a._i}" style="width:auto;padding:6px 12px">Revoke</button>
      </div>`).join("") : emptyNote;
    document.querySelectorAll("[data-revoke]").forEach(b => b.onclick = () => {
      const list = loadApprovals(); const a = list[Number(b.dataset.revoke)]; if (!a) return;
      pendingRevoke = Number(b.dataset.revoke);
      pendingChainRevoke = null;
      $("apConfirm").innerHTML = `<p class="seed" style="margin-top:10px">${formatRevokePrompt(a, (NETWORKS[a.chainKey] || (a.chainKey === "tron" ? { name: "Tron" } : {})).name)}</p>
        <button class="btn" id="apRevokeGo">Revoke approval</button>`;
      msg("apMsg", "");
      $("apRevokeGo").onclick = async () => {
        const cur = loadApprovals(); const rec = cur[pendingRevoke]; if (!rec) return;
        const btn = $("apRevokeGo"); btn.disabled = true;
        try {
          msg("apMsg", "Sending revoke transaction…", true);
          if (rec.chainKey === "tron") await revokeTronApproval(wallet, rec.token, rec.spender);
          else await revokeApproval(wallet, rec.chainKey, rec.token, rec.spender);
          cur.splice(pendingRevoke, 1);
          localStorage.setItem(APPROVALS_KEY, JSON.stringify(cur));
          pendingRevoke = null; $("apConfirm").innerHTML = "";
          msg("apMsg", "Revoked ✓ — that spender can no longer move this token.", true);
          paint();
        } catch (e) { msg("apMsg", "Revoke failed: " + (e.shortMessage || e.message)); btn.disabled = false; }
      };
    });
  };
  // On-chain section (audit M5): Fluid's records alone can give false
  // assurance — approvals granted by other apps on this address are the
  // dangerous set. Scan allowance() for the wallet's known tokens ×
  // (spenders from Fluid's records on this chain + LI.FI's diamond).
  const paintChain = () => {
    const el = $("apChainList"); if (!el) return;
    if (!chainFound) return; // still loading or failed — the placeholder/error text stands
    el.innerHTML = chainFound.length ? chainFound.map((r, i) => `
      <div class="hist" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span><b>${esc(r.tokenSymbol || "Token")}</b> · ${r.unlimited ? "Unlimited ∞" : esc(formatTokenAmount(r.allowance, r.decimals))}<br><small style="color:var(--dim)">spender ${esc(String(r.spender).slice(0, 6))}…${esc(String(r.spender).slice(-4))} · found on-chain</small></span>
        <button class="btn ghost" data-chain-revoke="${i}" style="width:auto;padding:6px 12px">Revoke</button>
      </div>`).join("") : `<p class="tag">No live approvals found on-chain for your known tokens and the spenders checked (Fluid's swap spenders + LI.FI's router).</p>`;
    document.querySelectorAll("[data-chain-revoke]").forEach(b => b.onclick = () => {
      const r = chainFound[Number(b.dataset.chainRevoke)]; if (!r) return;
      pendingChainRevoke = Number(b.dataset.chainRevoke);
      pendingRevoke = null;
      const rec = { tokenSymbol: r.tokenSymbol, spender: r.spender, chainKey: networkKey };
      $("apConfirm").innerHTML = `<p class="seed" style="margin-top:10px">${formatRevokePrompt(rec, NETWORKS[networkKey].name)}</p>
        <button class="btn" id="apChainRevokeGo">Revoke approval</button>`;
      msg("apMsg", "");
      $("apChainRevokeGo").onclick = async () => {
        const cur2 = chainFound[pendingChainRevoke]; if (!cur2) return;
        const btn = $("apChainRevokeGo"); btn.disabled = true;
        try {
          msg("apMsg", "Sending revoke transaction…", true);
          await revokeApproval(wallet, networkKey, cur2.token, cur2.spender);
          chainFound.splice(pendingChainRevoke, 1);
          pendingChainRevoke = null; $("apConfirm").innerHTML = "";
          msg("apMsg", "Revoked ✓ — that spender can no longer move this token.", true);
          paintChain();
        } catch (e) { msg("apMsg", "Revoke failed: " + (e.shortMessage || e.message)); btn.disabled = false; }
      };
    });
  };
  paint();
  (async () => {
    try {
      const records = loadApprovals().filter(a => a.chainKey === networkKey);
      const spenders = [...new Set([...records.map(a => a.spender), LIFI_DIAMOND])];
      const toks = new Map();
      const addTok = (address, symbol, decimals) => {
        if (address && ethersIsAddress(address) && !/^0x0{40}$/i.test(address)) {
          toks.set(address.toLowerCase(), { address, symbol: symbol || "Token", decimals: decimals ?? 18 });
        }
      };
      for (const b of balances) if (b.address) addTok(b.address, b.symbol, b.decimals);
      for (const t of NETWORKS[networkKey].tokens || []) addTok(t.address, t.symbol, t.decimals);
      for (const a of records) addTok(a.token, a.tokenSymbol, a.decimals);
      for (const ct of loadCustomTokens(NETWORKS[networkKey].chainId)) addTok(ct.address, ct.symbol, ct.decimals);
      chainFound = await scanOnChainAllowances(networkKey, wallet.address, [...toks.values()], spenders);
      paintChain();
    } catch (e) {
      const el = $("apChainList");
      if (el) el.innerHTML = `<p class="tag">Couldn't read on-chain approvals right now (${esc(e.message || e)}). The list below only covers approvals Fluid itself made — for a full check from another device, revoke.cash also works.</p>`;
    }
  })();
};

// ---------- About (§4.9/§4.11): the essay, for humans, in More ----------
$("aboutBtn").onclick = () => {
  openSheet(`<h3>What is Fluid?</h3>
    <p class="tag">Fluid is a free, open-source (MIT), non-custodial wallet for every blockchain. One seed phrase derives your accounts on EVM chains and L2s (15 built in, more auto-discovered), Bitcoin and Lightning, Stacks (the Bitcoin L2), Litecoin, Dogecoin, Bitcoin Cash, Tron, Solana, Sui, seven Cosmos chains, Stellar, TON, NEAR, Algorand, the XRP Ledger, Polkadot Asset Hub and Aptos — and every chain both sends and receives.</p>
    <p class="tag">Fluid never holds your keys or your funds: your keys stay encrypted on your own device, there is no account, no sign-up and no KYC on Fluid's side — buy and sell routes run their own quick checks — and if Fluid disappeared tomorrow your seed phrase would restore everything in any standard wallet.</p>
    <p class="tag">Buy and cash out worldwide at the cheapest available route, swap between chains, and send to a simple name — like you.fluid.is-a.dev — instead of a long address.</p>
    <p class="tag">Source code: <a href="https://github.com/Townsvilledh/fluid-wallet" target="_blank" rel="noopener">github.com/Townsvilledh/fluid-wallet</a></p>`);
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
    // Full wipe (audit L3): EVERY fluid_* key goes — vault, name,
    // history, approval records, agents + spend log, chain cache,
    // custom tokens, caches. Nothing of the removed wallet survives.
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
    for (const k of fluidStorageKeysToWipe(allKeys)) localStorage.removeItem(k);
    wallet = null; pendingSend = null; nameAdoptTried = false;
    // Repaint the name section for the no-wallet state NOW (QA
    // round 3): its description is only repainted by
    // renderNameSection, and the next wallet's renderMain is not
    // guaranteed to be the first thing the user sees — the section
    // must not describe the removed wallet in the meantime.
    renderNameSection();
    // Leave no trace of the removed wallet on the onboarding screen:
    // a seed phrase or password must never linger in the form after removal.
    $("seedOut").textContent = ""; show("seedBox", false);
    $("seedCheck").checked = false;
    for (const id of ["createPw", "createPw2", "importPhrase", "unlockPw", "createName"]) { const el = $(id); if (el) el.value = ""; }
    // The gate's username preview is only repainted on input events,
    // so reset it explicitly — it must not keep showing the removed
    // wallet's name (cosmetic, QA 2026-11-07).
    $("createNamePreview").textContent = "you." + FLUID_DOMAIN;
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
    `<div style="border-top:1px solid #26314d;padding:8px 0"><b>${esc(a.name)}</b> <span class="tag">caps $${a.policy.perTxCapUsd}/tx · $${a.policy.dailyCapUsd}/day · no ramps · no KYC</span><br>` +
    `<span class="mono" style="font-size:11px">EVM ${esc(a.keys.evm)}</span><br><span class="mono" style="font-size:11px">BTC ${esc(a.keys.btc)}</span></div>`).join("");
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
    openSheet(`<h3>Agent transfer request</h3>
      <p class="tag">An agent is asking to spend from its own agent wallet. Nothing moves unless you tap Approve.</p>
      <p><b>Agent:</b> ${esc(a.name)} <span class="tag">(agent #${a.index})</span></p>
      <p><b>Send:</b> ${amt} ${esc(net.symbol)} on ${esc(net.name)}</p>
      <p><b>To — full destination address:</b></p>
      <p class="mono" style="word-break:break-all">${esc(to)}</p>
      <p><b>From — the agent's wallet:</b></p>
      <p class="mono" style="word-break:break-all">${esc(a.keys.evm)}</p>
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
    // RED-TEAM 2026-11-06 (Finding J): never fall back to the first agent
    // when the named one doesn't exist — a caller asking for a specific
    // agent must fail loudly, not silently spend a different agent's
    // allowance (the approval sheet named the real agent, but a fatigued
    // owner could approve without noticing the substitution).
    const a = agents.find(x => x.name === agent);
    if (!a) throw new Error(agents.length
      ? `No agent named "${String(agent)}" exists.`
      : "No agent wallet exists yet — the owner creates one in More → Agentic wallet.");
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
    return { hash: tx.hash, from: a.keys.evm, network: netKey };
  },
};
function ethersIsAddress(x) { return /^0x[0-9a-fA-F]{40}$/.test(String(x || "")); }
