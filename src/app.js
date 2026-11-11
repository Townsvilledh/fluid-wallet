// Fluid v2 — app-shell UI. Keys live only in memory while unlocked;
// the only thing persisted is the standard encrypted keystore JSON.
import "./buffer-shim.js"; // must stay first: @solana/web3.js needs Buffer
import QRCode from "qrcode";
import {
  NETWORKS, createVault, importVault, unlockVault, validatePassword, needsKdfUpgrade, reencryptVault,
  getBalances, estimateSend, executeSend, formatSendIntent,
  dustDisplayFloor, formatDisplayAmount, formatDisplayFixed, formatDisplayUsd,
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
  FLUID_DOMAIN, validateFluidName, normalizeFluidName, buildNameEntry, resolveFluidName, resolveChainRecipient, fetchNameRegistry, findNameForAddresses, lightningInvoiceForAddress, lightningTargetForNameEntry,
  buildSeedQuiz, seedQuizResults, seedQuizPassed, fetchServedBuildStamp, staleBuildAction,
  buildSignedNameClaim, publishNameClaimEvent, publishNameClaimEventDetailed, queryNameClaimEvent, nameClaimState, NAME_STATE_COPY, NAME_CLAIM_REPAIR_AFTER_MS,
  lnErrorText, parseSisPathsInput, lnReceiveTransition, lnReceiveView, lnReceivePlan, lnLsps2OpeningFeeMsat, waitForLnPeerConnected,
  lnNodeStatus, lnLightningAddressState,
  AGENT_POLICY_DEFAULTS, agentAddresses, agentEvmWallet, buildAgentDescriptor, checkAgentPolicy, sendFromAgent,
  LIFI_NATIVE_TOKEN, getSwapRoutes, rankSwapRoutes, swapRouteExecutable, swapRouteCostLabel, executeSwapRoute, executeRelaySwapRoute, executeAcrossSwapRoute, executeJupiterSwapRoute, executeTronSwapRoute, executeSuiSwapRoute, TRON_EXPLORER, formatSwapIntent, swapAmountToRaw, swapRawToAmount, platformFeeOn, swapFeeCollectingChain,
  formatSatoraSwapIntent, checkSatoraLightningReceivability, classifySatoraLightningDestination, loadSatoraSwapRecords, pollSatoraSwapStatuses, satoraSwapHistoryLine, executeSatoraSwapRoute, resumeSatoraBridgedSwaps,
  satoraSwapClaimKey, fetchLnArkadePair, estimateLnArkadeFeeSats, createLnArkadeSwap, fetchLnArkadeSwapStatus, parseArkadeIntentFees, arkadeOffboardFeeSats, composeBridgeQuote, formatBridgeQuoteLines, loadBridgeRecords, saveBridgeRecord, bridgeCreationIndex, bumpBridgeCreationIndex, bridgePhaseLabel, bridgeHistoryLine, BRIDGE_ROUTE_COST_CAP_SATS, isValidBitcoinAddress,
  executeMayanSwapRoute, loadMayanSwapRecords, saveMayanSwapRecord, pollMayanSwapStatuses, mayanSwapHistoryLine, formatMayanRefundNote,
  formatDestGasLine, executeGasFallbackRoute, completeGasFallbackSwap, advanceGasFallbackRecords, loadGasFallbackRecords, gasFallbackHistoryLine, gasFallbackNeedsAction,
  looksLikePoison, looksLikePoisonText, revokeApproval, revokeTronApproval, scanOnChainAllowances, LIFI_DIAMOND,
  registerNetworks, fetchEvmChainSources, gateChains, probeChain, fetchStableTokens,
  fetchLifiTokenList, lifiTokenVerified, getDexScreenerTokenInfo, dexChainIdForEvmChain,
  scanEvmTokenBalances, getEvmTokenBalance, readEvmTokenMeta, formatTokenAmount,
  classifyLightningTarget, resolveBip353Address, parseBolt11, holdWindowCopy, fundingAddressFromScript,
  detectScanFamily, detectScanTxid, fetchScanTxid, scanTargetsForName, scanTargetsForAddress, fetchScan, mergeScanRows,
  formatScanFeedEntry, scanChainStatusText, scanChainBadge, scanTxUrl, scanAddressUrl,
  WALLETCONNECT_PROJECT_ID, walletConnectConfigured, parseWcUri, describeWcProposal, buildWcNamespaces,
  decodeWcRequest, wcSessionSummary, signWcMessage, signWcTypedData, executeWcTransaction, evmNetworkKeyForChainId,
  sortHomeFamilies, sortHomeRows, splitHomeRows, countUnpricedHoldings, mergeCgFallbackPrices,
  BALANCE_CACHE_KEY, packBalanceCache, unpackBalanceCache,
  FEE_SPLIT, rampFeeQuote, rampTier1Eligible, formatRampSellIntent,
  newRampFeeOrder, rampFeeOrderTransition, rampFeeOrderSummary,
  loadRampFeeOrders, saveRampFeeOrder,
  estimateRampFeeEvmGasUsd, executeRampFeeSendEvm,
  solanaRampSplitPlan, sendSolanaRampSplit, SOLANA_ATA_RENT_LAMPORTS, solLamportsToSol,
  RAMP_FEE_TRON_LEG_GAS_USD,
} from "./wallet-core.js";
import { ethers } from "ethers";
import { LN_WASM_PIN, LN_CHUNK_SHA256 } from "./ln-asset-pins.generated.js";
import {
  registerLnBridge, unregisterLnBridge, startLnBridgeResponder,
  loadLnBridgeState,
} from "./ln-nwc-bridge.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const NAME_CLAIM_KEY = "fluid_name_claim"; // the device-held signed name claim + its publish state
const HISTORY_KEY = "fluid_history_v1";
const BACKUP_STATE_KEY = "fluid_backup_state"; // "pending" | "confirmed" — the seed-backup quiz state (audit P1-1); wallet-scoped like fluid_name
const BACKUP_DISMISS_KEY = "fluid_backup_card_dismissed"; // sessionStorage: the home backup reminder's per-session dismissal
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
// Balance-cache paint state (2026-11-09 load fix): liveFams tracks
// families whose LIVE read settled this render (famLoaded also
// gains cache-hydrated families, so the two sets answer different
// questions); hydratedFams tracks which families are currently
// showing last-known cached values; cachePaint is true while any
// hydrated family is still waiting on its live read — the hero
// carries an "Updating…" marker for exactly that window, and a
// failed live read always overrides the cached paint.
const liveFams = new Set();
const hydratedFams = new Set();
let cachePaint = false;
const markLoaded = (k) => { famLoaded.add(k); liveFams.add(k); };
const HOME_FAMILIES = ["bitcoin", "evm", "tron", "solana", "sui", "stellar", "ton", "near",
  "algorand", "xrpl", "polkadot", "aptos", "stacks", "cosmos", "litecoin", "dogecoin", "bitcoincash"];
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
// P2-1: the display formatters live in wallet-core (dustDisplayFloor &
// friends) so a nonzero value can never render as an apparent zero —
// dust shows as "<0.000001" / "<$0.01", a true zero stays plain zero.
const usd = (n) => formatDisplayUsd(n);
const fmt = (n, d = 6) => formatDisplayAmount(n, d);
const fmtFixed = (n, d = 6) => formatDisplayFixed(n, d);

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
// ---------- build freshness (audit P1-9) ----------
// The build this tab booted with, recorded once at startup from
// the stamped page. A sheet whose data load fails or hangs checks
// the SERVED stamp once: if Fluid has updated since this tab
// opened, the stuck sheet is not a network problem — the sheet
// offers a clean refresh (the wallet itself lives in the vault;
// a reload loses nothing) instead of stranding the user on a
// loading line or a dead-end error. When the stamp has not moved,
// the existing honest error copy stands untouched.
const BOOT_BUILD_STAMP = (() => { const m = document.querySelector('meta[name="fluid-build"]'); return m && m.content ? m.content : null; })();
const STALE_BUILD_DEADLINE_MS = 20000;
async function staleBuildCheck(noteEl, loadFailed = true) {
  if (!noteEl || !BOOT_BUILD_STAMP) return false;
  const served = await fetchServedBuildStamp(fetch, location.href.split("#")[0]).catch(() => null);
  if (staleBuildAction({ loadFailed, bootStamp: BOOT_BUILD_STAMP, servedStamp: served }) !== "refresh") return false;
  if (!document.contains(noteEl)) return false;
  noteEl.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = "Fluid has updated since you opened it — this screen is running the old build. ";
  const btn = document.createElement("button");
  btn.className = "btn ghost";
  btn.style.cssText = "width:auto;padding:6px 12px;margin:4px 0";
  btn.textContent = "Tap to refresh";
  btn.onclick = () => location.reload();
  noteEl.append(span, btn);
  return true;
}
// ---------- sheet chrome: busy lock, error banner, toast (§4.7/§4.8) ----------
// While a transaction broadcasts, the sheet is NOT dismissible: the X,
// the scrim and closeSheet() all refuse until the send settles.
let sheetBusy = false;
let sheetGen = 0; // guards the animated close against a same-tick reopen
// Set by lockWallet when it dismisses a sheet (audit P1-14): the
// next unlock explains the closed sheet once, via toast.
let lockClosedSheet = false;
// Browser/Android back closes an open sheet instead of leaving
// the wallet (audit P1-17): opening a sheet arms ONE history
// entry; a popstate while a sheet is open closes the sheet and
// the app stays; closeSheet consumes its own entry so the two
// never fight. All history calls are best-effort (embedded
// webviews may refuse them, and the sheet must work regardless).
let sheetHistArmed = false, sheetHistSwallow = false;
function armSheetHistory() {
  if (sheetHistArmed) return;
  try { history.pushState({ fluidSheet: 1 }, ""); sheetHistArmed = true; } catch { /* no history to arm */ }
}
function disarmSheetHistory() {
  if (!sheetHistArmed) return;
  sheetHistArmed = false; sheetHistSwallow = true;
  try { history.back(); } catch { sheetHistSwallow = false; }
}
addEventListener("popstate", () => {
  if (sheetHistSwallow) { sheetHistSwallow = false; return; }
  if (sheetHistArmed) { sheetHistArmed = false; closeSheet(); }
});
function openSheet(html) { fireSheetCloseHook(); sheetBusy = false; sheetGen++; const r = $("sheetRoot"); const wasOpen = !!(r && !r.classList.contains("hidden")); if (r) { r.removeAttribute("data-busy"); r.classList.remove("closing"); } $("sheetBody").innerHTML = html; show("sheetRoot"); armSheetHistory(); if (!wasOpen) focusSheetPrimary(); }
/** P2-4: when a sheet opens, the cursor lands in its primary field —
 *  the field the sheet's markup marks data-autofocus (the recipient
 *  field on sends, the amount on Swap, the paste field on Lightning /
 *  WalletConnect). Only on a FRESH open: in-place repaints of an
 *  already-open sheet (the Lightning panel refreshes itself on node
 *  events) must never steal focus from what the user is typing. */
function focusSheetPrimary() {
  const body = $("sheetBody"); if (!body) return;
  const el = body.querySelector("[data-autofocus]");
  if (!el || typeof el.focus !== "function") return;
  try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch { /* field already gone — sheet replaced */ } }
}
function closeSheet(force = false) {
  if (sheetBusy && !force) return;
  fireSheetCloseHook();
  disarmSheetHistory();
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
    <div class="txbadge"><svg viewBox="0 0 72 72" class="txring"><defs><linearGradient id="txgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffbe0b"/><stop offset=".48" stop-color="#f7931a"/><stop offset="1" stop-color="#e85d04"/></linearGradient></defs><circle cx="36" cy="36" r="32" fill="none" stroke="url(#txgrad)" stroke-width="3"/><path d="M24 37.5 32.5 46 49 28" fill="none" stroke="#2fd08c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
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
  for (const t of ["wallet", "play", "activity", "scan", "more", "bridge"]) show("tab-" + t, t === name);
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  if (name === "activity") clearActivityDot();
  if (name === "bridge") bridgeRefresh().catch(() => {});
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
  if (wallet && lockClosedSheet) { lockClosedSheet = false; toast("The sheet that was open when the wallet locked was closed."); }
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

/* ---------- balance cache: paint last-known amounts instantly ----------
 * hydrateBalanceCache runs mid-renderMain (after the placeholder
 * state is set up, before the EVM await): it copies the cached rows
 * into the live globals and marks those families loaded, so the
 * first paint shows real amounts — marked "Updating…" in the hero —
 * instead of skeletons. Every live read then replaces its family's
 * paint as it lands; persistBalanceCache (called from paintAssets)
 * writes back only families whose LIVE read has settled this
 * render, so a failed read never overwrites the last good values,
 * and the failure rendering (couldn't-load) overrides the cache. */
function hydrateBalanceCache(w) {
  let cached = null;
  try { cached = unpackBalanceCache(localStorage.getItem(BALANCE_CACHE_KEY), w.address); } catch { /* storage unavailable */ }
  if (!cached) return;
  if (cached.prices && typeof cached.prices === "object" && Object.keys(cached.prices).length) {
    prices = { ...prices, ...cached.prices };
  }
  const f = cached.fams || {};
  const put = (key, apply) => { if (Array.isArray(f[key])) { apply(f[key]); famLoaded.add(key); hydratedFams.add(key); } };
  put("tron", (rows) => { tronBalances = rows; });
  put("solana", (rows) => { solBalances = rows; });
  put("sui", (rows) => { suiBalances = rows; });
  put("stellar", (rows) => { stellarBalances = rows; });
  put("ton", (rows) => { tonBalances = rows; });
  put("near", (rows) => { nearBalances = rows; });
  put("algorand", (rows) => { algoBalances = rows; });
  put("xrpl", (rows) => { xrpBalances = rows; });
  put("polkadot", (rows) => { dotBalances = rows; });
  put("aptos", (rows) => { aptosBalances = rows; });
  put("stacks", (rows) => { stacksBalances = rows; });
  put("cosmos", (rows) => { cosmosRows = rows; });
  if (cached.evm && cached.evm.network === networkKey && Array.isArray(cached.evm.rows)) {
    balances = cached.evm.rows;
    famLoaded.add("evm"); hydratedFams.add("evm");
  }
  const sc = cached.scalars || {};
  if (Number.isFinite(Number(sc.btcBal)) || Number.isFinite(Number(sc.btcTrBal))) {
    if (Number.isFinite(Number(sc.btcBal))) btcBal = Number(sc.btcBal);
    if (Number.isFinite(Number(sc.btcTrBal))) btcTrBal = Number(sc.btcTrBal);
    famLoaded.add("bitcoin"); hydratedFams.add("bitcoin");
  }
  if (Number.isFinite(Number(sc.ltcBal))) { ltcBal = Number(sc.ltcBal); famLoaded.add("litecoin"); hydratedFams.add("litecoin"); }
  if (Number.isFinite(Number(sc.dogeBal))) { dogeBal = Number(sc.dogeBal); famLoaded.add("dogecoin"); hydratedFams.add("dogecoin"); }
  if (Number.isFinite(Number(sc.bchBal))) { bchBal = Number(sc.bchBal); famLoaded.add("bitcoincash"); hydratedFams.add("bitcoincash"); }
  cachePaint = hydratedFams.size > 0;
  if (cachePaint) paintAssets();
}

let lastCacheWrite = 0;
function persistBalanceCache() {
  if (!wallet || !liveFams.size) return;
  const now = Date.now();
  const complete = HOME_FAMILIES.every((k) => liveFams.has(k));
  if (!complete && now - lastCacheWrite < 2000) return; // throttle mid-load writes
  lastCacheWrite = now;
  try {
    const prev = unpackBalanceCache(localStorage.getItem(BALANCE_CACHE_KEY), wallet.address);
    const rows = { ...(prev ? prev.fams : {}) };
    const take = (key, arr) => { if (liveFams.has(key)) rows[key] = arr; };
    take("tron", tronBalances); take("solana", solBalances); take("sui", suiBalances);
    take("stellar", stellarBalances); take("ton", tonBalances); take("near", nearBalances);
    take("algorand", algoBalances); take("xrpl", xrpBalances); take("polkadot", dotBalances);
    take("aptos", aptosBalances); take("stacks", stacksBalances);
    delete rows.cosmos; // cosmos travels via cosmosRows in the pack format
    const scalars = { ...(prev && prev.scalars ? prev.scalars : {}) };
    if (liveFams.has("bitcoin")) { scalars.btcBal = btcBal; scalars.btcTrBal = btcTrBal; }
    if (liveFams.has("litecoin")) scalars.ltcBal = ltcBal;
    if (liveFams.has("dogecoin")) scalars.dogeBal = dogeBal;
    if (liveFams.has("bitcoincash")) scalars.bchBal = bchBal;
    const evm = liveFams.has("evm") && !evmLoadFailed
      ? { network: networkKey, rows: balances }
      : (prev && prev.evm ? prev.evm : null);
    const cosmosRowsSnap = liveFams.has("cosmos") ? cosmosRows
      : (prev && prev.fams && Array.isArray(prev.fams.cosmos) ? prev.fams.cosmos : null);
    const packed = packBalanceCache(wallet.address, {
      rows, scalars,
      ...(evm ? { evmNetwork: evm.network, evmRows: evm.rows } : {}),
      ...(cosmosRowsSnap ? { cosmosRows: cosmosRowsSnap } : {}),
      prices,
    }, now);
    if (packed) localStorage.setItem(BALANCE_CACHE_KEY, packed);
  } catch { /* storage unavailable/full — the cache is an optimisation only */ }
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
  liveFams.clear();
  hydratedFams.clear();
  cachePaint = false;
  paintHeader();
  // Prices NO LONGER GATE the render (2026-11-09 load fix): this
  // function used to await getPrices() — raced against a 10 s
  // timeout — before ANY balance load fired, so opening the wallet
  // meant staring at skeletons for the whole price round trip
  // (measured: first balance request left ~3.5 s after the prices
  // that preceded it; a stalled fetch ate the full 10 s and left
  // prices = {} for the session, which also silently zeroed every
  // family's USD total and defeated the held-first ordering).
  // Prices now load in parallel and repaint values when they land;
  // amounts paint first, dollars a beat later. The cache hydrates
  // FIRST (2026-11-09 unpriced-native fix): its stored prices are
  // the floor this load merges over, so a slow or partial live load
  // can add prices but never strip the ones the last good session
  // had — cached amounts painting with their cached prices is what
  // makes the first paint truthful. On timeout the merged (cached)
  // prices stay — display-only either way; sends re-verify prices
  // independently.
  hydrateBalanceCache(w);
  const cachedPriceSnapshot = { ...prices };
  (async () => {
    try {
      const p = await Promise.race([
        getPrices(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("prices timed out")), 20000)),
      ]);
      if (wallet !== w) return; // locked (or wallet switched) meanwhile
      prices = { ...cachedPriceSnapshot, ...p };
      paintAssets();
    } catch { /* keep last-known (cached) prices */ }
  })();
  if (wallet !== w) return;
  // Bitcoin first (all chains, one wallet)
  btcAddr = bitcoinAddress(w.mnemonic.phrase);
  // Fluid name: paint the owned/claim state, then (once per session) try
  // to adopt a registry name that already belongs to this wallet — a
  // restored wallet whose name was published earlier should SEE its name,
  // not an empty claim form that rejects the name as "already claimed".
  renderNameSection();
  adoptRegistryNameIfMine();
  // Claim durability (agent kit): finish a claim an interrupted
  // creation left unsubmitted, and surface any in-flight claim on
  // Home until it verifies live in the registry.
  resumePendingClaim();
  refreshHomeClaimBanner();
  refreshHomeBackupCard();
  // A failed Bitcoin load is UNKNOWN, not zero (EVM precedent): each
  // account tracks its own failure, and the family flag is the OR.
  // Flags reset at load start so a Refresh can clear them.
  btcSegwitFailed = btcTaprootFailed = false; btcLoadFailed = false;
  getBitcoinBalance(btcAddr).then(b => { btcBal = b; btcSegwitFailed = false; syncBtcLoadFailed(); markLoaded("bitcoin"); paintAssets(); }).catch(() => { btcSegwitFailed = true; syncBtcLoadFailed(); markLoaded("bitcoin"); paintAssets(); });
  // Taproot (BIP86) — a second Bitcoin account from the same seed
  // (Build B): its own address and balance, rolled into the BTC totals.
  btcTrAddr = bitcoinTaprootAddress(w.mnemonic.phrase);
  getBitcoinBalance(btcTrAddr).then(b => { btcTrBal = b; btcTaprootFailed = false; syncBtcLoadFailed(); markLoaded("bitcoin"); paintAssets(); }).catch(() => { btcTaprootFailed = true; syncBtcLoadFailed(); markLoaded("bitcoin"); paintAssets(); });
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
      markLoaded("tron"); paintAssets();
    });
  // Solana (a family like Bitcoin/Tron, not an EVM network): SLIP-0010
  // Ed25519 branch of the same seed, its own rows, painted with zero
  // placeholders until the RPC answers.
  solAddr = solanaAddressFromPhrase(w.mnemonic.phrase);
  solBalances = [{ symbol: "SOL", amount: "0", address: null, decimals: 9 },
                 ...SOLANA_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSolanaAllTokens(solAddr), () => getSolanaBalances(solAddr), "solana")
    .then(rows => {
      if (rows) solBalances = rows;
      else if (hydratedFams.has("solana")) {
        // The live read failed over a cache paint: the cached rows
        // must not stand as final — replace them with couldn't-load
        // rows (the EVM failure shape) until a read succeeds.
        solBalances = [{ symbol: "SOL", amount: null, address: null, decimals: 9 },
                       ...SOLANA_TOKENS.map(t => ({ ...t, amount: null }))];
      }
      markLoaded("solana"); paintAssets();
    });
  // Sui (Phase 2b): SLIP-0010 Ed25519 branch (coin type 784) of the
  // same seed — the same derivation family as Solana, Sui's own path.
  // Also the future home of the OGO ERA Companion NFT.
  suiAddr = suiAddressFromPhrase(w.mnemonic.phrase);
  suiBalances = [{ symbol: "SUI", amount: "0", address: null, decimals: 9 },
                 ...SUI_TOKENS.map(t => ({ ...t, amount: "0" }))];
  loadFamilyRows(() => getSuiAllBalances(suiAddr), () => getSuiBalances(suiAddr), "sui")
    .then(rows => {
      if (rows) suiBalances = rows;
      else if (hydratedFams.has("sui")) {
        // Same cache-honesty rule as Solana: a failed live read
        // replaces the cached paint with couldn't-load rows.
        suiBalances = [{ symbol: "SUI", amount: null, address: null, decimals: 9 },
                       ...SUI_TOKENS.map(t => ({ ...t, amount: null }))];
      }
      markLoaded("sui"); paintAssets();
    });
  // Stellar (Phase 3b): SLIP-0010 Ed25519 branch (coin type 148) of
  // the same seed. The single account read IS the all-asset read
  // (XLM + every trustline). An unfunded account is a state — "not
  // yet activated" — painted honestly; a failed read keeps the
  // placeholder row plus a "couldn't load" note, never a fake zero.
  stellarAddr = stellarAddressFromPhrase(w.mnemonic.phrase);
  stellarBalances = [{ symbol: "XLM", name: "Stellar Lumens", amount: "0", address: null, assetCode: null, issuer: null, decimals: 7, verified: true }];
  stellarFunded = null; stellarLoadFailed = false;
  getStellarAccount(stellarAddr)
    .then(acct => { stellarBalances = acct.balances; stellarFunded = acct.funded; markLoaded("stellar"); paintAssets(); })
    .catch(() => { stellarLoadFailed = true; markLoaded("stellar"); paintAssets(); });
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
    .then(acct => { tonBalances = acct.balances; tonState = acct.state; markLoaded("ton"); paintAssets(); })
    .catch(() => { tonLoadFailed = true; markLoaded("ton"); paintAssets(); });
  nearAddr = nearAddressFromPhrase(w.mnemonic.phrase);
  nearBalances = [{ symbol: "NEAR", name: "NEAR", amount: "0", address: null, decimals: 24, verified: true },
                  ...NEAR_TOKENS.map(t => ({ ...t, amount: "0" }))];
  nearExists = null; nearLoadFailed = false;
  getNearAccount(nearAddr)
    .then(acct => { nearBalances = acct.balances; nearExists = acct.exists; markLoaded("near"); paintAssets(); })
    .catch(() => { nearLoadFailed = true; markLoaded("near"); paintAssets(); });
  algoAddr = algoAddressFromPhrase(w.mnemonic.phrase);
  algoBalances = [{ symbol: "ALGO", name: "Algorand", amount: "0", address: null, decimals: 6, verified: true },
                  { ...ALGO_USDC, amount: "0" }];
  algoFunded = null; algoLoadFailed = false;
  getAlgorandAccount(algoAddr)
    .then(acct => { algoBalances = acct.balances; algoFunded = acct.funded; markLoaded("algorand"); paintAssets(); })
    .catch(() => { algoLoadFailed = true; markLoaded("algorand"); paintAssets(); });
  xrpAddr = xrplAddressFromPhrase(w.mnemonic.phrase);
  xrpBalances = [{ symbol: "XRP", name: "XRP", amount: "0", address: null, decimals: 6, verified: true }];
  xrpFunded = null; xrpLoadFailed = false;
  getXrplAccount(xrpAddr)
    .then(acct => { xrpBalances = acct.balances; xrpFunded = acct.funded; markLoaded("xrpl"); paintAssets(); })
    .catch(() => {
      // A failed read is UNKNOWN, not zero (QA F12): the row carries
      // amount null and renders "couldn't load" — never a $0.00
      // presented as a loaded balance.
      xrpLoadFailed = true;
      xrpBalances = [{ symbol: "XRP", name: "XRP", amount: null, address: null, decimals: 6, verified: true }];
      markLoaded("xrpl"); paintAssets();
    });
  dotAddr = dotAddressFromPhrase(w.mnemonic.phrase);
  dotBalances = [{ symbol: "DOT", name: "Polkadot", amount: "0", address: null, decimals: 10, verified: true },
                 ...DOT_TOKENS.map(t => ({ ...t, amount: "0" }))];
  dotExists = null; dotLoadFailed = false;
  getDotAccount(dotAddr)
    .then(acct => { dotBalances = acct.balances; dotExists = acct.exists; markLoaded("polkadot"); paintAssets(); })
    .catch(() => {
      // A failed read is UNKNOWN, not zero (QA F12, same pattern
      // as XRPL): rows carry amount null and render "couldn't
      // load" — never a $0.00 presented as a loaded balance.
      dotLoadFailed = true;
      dotBalances = [{ symbol: "DOT", name: "Polkadot", amount: null, address: null, decimals: 10, verified: true },
                     ...DOT_TOKENS.map(t => ({ ...t, amount: null }))];
      markLoaded("polkadot"); paintAssets();
    });
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
    .then(acct => { aptosBalances = acct.balances; aptosExists = acct.exists; aptosScanFailed = acct.scanFailed; markLoaded("aptos"); paintAssets(); })
    .catch(() => { aptosLoadFailed = true; markLoaded("aptos"); paintAssets(); });
  // Stacks (Bitcoin L2): BIP44 coin-5757 branch of the same seed. STX +
  // every SIP-010 balance via Hiro; pinned tokens (sBTC, USDA) verified,
  // everything else unverified (⚠) with contract-read metadata.
  stacksAddr = stacksAddressFromPhrase(w.mnemonic.phrase);
  stacksBalances = [{ symbol: "STX", name: "Stacks", amount: "0", decimals: 6, verified: true, contract: null },
                    ...STACKS_TOKENS.map(t => ({ ...t, amount: "0", balanceRaw: "0", verified: true }))];
  stacksLoadFailed = false; stacksScanFailed = false;
  fetchStacksAccount(stacksAddr)
    .then(acct => {
      markLoaded("stacks");
      if (acct.scanFailed) { stacksScanFailed = true; paintAssets(); return; }
      stacksBalances = [{ symbol: "STX", name: "Stacks", amount: stxMicroToStx(acct.stxUstx), decimals: 6, verified: true, contract: null },
                        ...acct.tokens.map(t => ({ ...t, amount: stacksRawToAmount(t.balanceRaw, t.decimals) }))];
      paintAssets();
    })
    .catch(() => { stacksLoadFailed = true; markLoaded("stacks"); paintAssets(); });
  // Bitcoin-family altcoins (Phase 2a): same seed, own branches —
  // Litecoin (BIP84 coin 2), Dogecoin (BIP44 coin 3, legacy),
  // Bitcoin Cash (BIP44 coin 145, CashAddr).
  ltcAddr = litecoinAddress(w.mnemonic.phrase);
  getLitecoinBalance(ltcAddr).then(b => { ltcBal = b; ltcLoadFailed = false; markLoaded("litecoin"); paintAssets(); }).catch(() => { ltcLoadFailed = true; markLoaded("litecoin"); paintAssets(); });
  dogeAddr = dogecoinAddress(w.mnemonic.phrase);
  getDogecoinBalance(dogeAddr).then(b => { dogeBal = b; dogeLoadFailed = false; markLoaded("dogecoin"); paintAssets(); }).catch(() => { dogeLoadFailed = true; markLoaded("dogecoin"); paintAssets(); });
  bchAddr = bitcoinCashAddress(w.mnemonic.phrase);
  getBitcoinCashBalance(bchAddr).then(b => { bchBal = b; bchLoadFailed = false; markLoaded("bitcoincash"); paintAssets(); }).catch(() => { bchLoadFailed = true; markLoaded("bitcoincash"); paintAssets(); });
  // Cosmos (Phase 3a): seven chains — six share one account's bytes
  // under their bech32 prefixes; Injective derives at coin type 60
  // (the Keplr path). Rows start as "unavailable"
  // (amount null) and fill in per chain as the public REST endpoints
  // answer; a chain that never answers keeps the honest null instead
  // of a fake zero (the DOGE precedent).
  cosmosAddrs = cosmosAddresses(w.mnemonic.phrase);
  cosmosRows = COSMOS_CHAINS.map(c => ({ ...c, address: cosmosAddrs[c.key], amount: null }));
  paintAssets();
  getCosmosAllBalances(w.mnemonic.phrase).then(rows => { cosmosRows = rows; markLoaded("cosmos"); paintAssets(); }).catch(() => {
    // A failed live read over a cache paint: cached Cosmos amounts
    // become "unavailable" (amount null), never final numbers.
    if (hydratedFams.has("cosmos")) cosmosRows = cosmosRows.map(r => ({ ...r, amount: null }));
    markLoaded("cosmos"); paintAssets();
  });
  $("assetList").innerHTML = "Loading assets…";
  // Hydration already ran at the top of renderMain (its prices are
  // the floor the live price merge builds on); the cached amounts it
  // painted stand until the live reads fired above replace them
  // family by family.
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
  markLoaded("evm");
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
  // EVERY family's failed load is unknown, not $0.00 (audit
  // TS-F2): the Bitcoin/EVM rule above applies to all — a family
  // whose rows couldn't load gets a null total, which the card
  // header renders as "—". (Before this fix Tron, XRPL, BCH and
  // the Cosmos chains printed "$0.00" over "couldn't load" rows.)
  m.litecoin = ltcLoadFailed ? null : ltcBal * (prices.LTC || 0);
  m.dogecoin = dogeLoadFailed ? null : dogeBal * (prices.DOGE || 0);
  m.bitcoincash = bchLoadFailed ? null : bchBal * (prices.BCH || 0);
  const net = NETWORKS[networkKey];
  m.evm = evmLoadFailed ? null : sumRows(balances, (b) => b.address ? prices[b.symbol] : prices[net.priceSym]);
  m.tron = tronLoadFailed ? null : sumRows(tronBalances, (b) => prices[b.symbol]);
  m.solana = sumRows(solBalances, (b) => prices[b.symbol]);
  m.sui = sumRows(suiBalances, (b) => prices[b.symbol]);
  m.stellar = stellarLoadFailed ? null : sumRows(stellarBalances, (b) => prices[b.symbol]);
  m.ton = tonLoadFailed ? null : sumRows(tonBalances, (b) => prices[b.symbol]);
  m.near = nearLoadFailed ? null : sumRows(nearBalances, (b) => b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol]);
  m.algorand = algoLoadFailed ? null : sumRows(algoBalances, (b) => prices[b.symbol]);
  m.xrpl = xrpLoadFailed ? null : sumRows(xrpBalances, (b) => prices[b.symbol]);
  m.polkadot = dotLoadFailed ? null : sumRows(dotBalances, (b) => prices[b.symbol]);
  m.aptos = aptosLoadFailed ? null : sumRows(aptosBalances, (b) => prices[b.symbol]);
  m.stacks = stacksLoadFailed ? null : sumRows(stacksBalances, (b) => prices[b.symbol]);
  m.lightning = lnSession ? (Number(lnSession.balance().spendableMsat || 0) / 1e11) * (prices.BTC || 0) : null;
  for (const r of cosmosRows) m[r.key] = r.amount == null ? null : Number(r.amount) * (prices[r.symbol] || 0);
  return m;
}
function scopedTotal() {
  if (viewKey === "all") return heroTotal();
  const m = familyUsdTotals();
  if (viewKey === "evm") return m.evm;
  return m[viewKey] != null ? m[viewKey] : 0;
}

/** Unpriced-holdings signal for the hero (2026-11-09 unpriced-native
 *  fix): holdings the totals CANNOT value — a nonzero balance whose
 *  price never arrived. The priced total stays the priced total; this
 *  only drives the "+ holdings with no live price" note, so the hero
 *  never presents a bare $0.00 as the whole story while the wallet
 *  holds something. The price lookups mirror heroTotal() exactly
 *  (row priceUsd wins, EVM natives read the network symbol, wNEAR
 *  reads NEAR, Cosmos reads its symbol table); failed reads (amount
 *  null / load-failed flags) are unknown, not unpriced, and never
 *  counted. */
function unpricedHoldingGroups() {
  const net = NETWORKS[networkKey];
  return [
    [balances, (b) => b.address ? prices[b.symbol] : prices[net.priceSym]],
    [tronBalances, (b) => prices[b.symbol]],
    [solBalances, (b) => prices[b.symbol]],
    [suiBalances, (b) => prices[b.symbol]],
    [stellarBalances, (b) => prices[b.symbol]],
    [tonBalances, (b) => prices[b.symbol]],
    [nearBalances, (b) => b.symbol === "wNEAR" ? prices.NEAR : prices[b.symbol]],
    [algoBalances, (b) => prices[b.symbol]],
    [xrpBalances, (b) => prices[b.symbol]],
    [dotBalances, (b) => prices[b.symbol]],
    [aptosBalances, (b) => prices[b.symbol]],
    [stacksBalances, (b) => prices[b.symbol]],
    [cosmosRows, (r) => prices[r.symbol]],
  ];
}
function countUnpricedInView() {
  let n = 0;
  const btcTotal = Number(btcBal) + Number(btcTrBal);
  if (!btcLoadFailed && btcTotal > 0 && prices.BTC == null) n++;
  for (const [bal, sym] of [[ltcBal, "LTC"], [dogeBal, "DOGE"], [bchBal, "BCH"]]) {
    if (Number(bal) > 0 && prices[sym] == null) n++;
  }
  n += countUnpricedHoldings(unpricedHoldingGroups());
  return n;
}
function hasUnpricedHoldings() { return countUnpricedInView() > 0; }
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
  if (sub) {
    // While a cache paint is still waiting on live reads, say so —
    // the numbers on screen are last-known, not final.
    const updating = cachePaint && !HOME_FAMILIES.every((k) => liveFams.has(k));
    sub.textContent = (viewKey === "all" ? "Across all networks" : `${viewDisplayName()} only`)
      + (hasUnpricedHoldings() ? " + holdings with no live price" : "")
      + (updating ? " · Updating…" : "");
  }
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
  // row says so instead of dressing a placeholder zero as fact. A
  // HELD amount with NO live price says "price unavailable" — never
  // a blank where a $0.00 could be read into it. A true zero keeps
  // its $0.00: 0 is worth $0.00 at any price, so that one is a fact.
  const amt = b.amount == null
    ? `<b>—</b><small>couldn't load</small>`
    : (v != null ? `<b>${fmt(b.amount)}</b><small>${usd(v)}</small>`
        : (Number(b.amount) > 0 ? `<b>${fmt(b.amount)}</b><small>price unavailable</small>`
            : `<b>${fmt(b.amount)}</b><small>${usd(0)}</small>`));
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
  const sp = splitRows(visible, priceOf, (b) => isNativeRow(famKey, b));
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
    m.cosmos = "Some Cosmos chains didn't answer just now — those balances couldn't load. Receiving still works on every chain.";
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
function splitRows(rows, symPriceOf, isNative = () => false) {
  // The split itself lives in wallet-core (splitHomeRows) so the
  // rule is unit-testable: the native row is tested FIRST and goes
  // to main unconditionally — priced or not, flagged or not. A
  // native asset is never an "other token".
  return splitHomeRows(rows, (b) => rowUsdValue(b, symPriceOf(b)), isNative);
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
  if (failed) return `<b>—</b><small>couldn't load</small>`;
  // A held scalar coin with no live price shows its amount with an
  // honest "price unavailable" — the old `price || 0` printed a
  // $0.00 under a real balance. A true zero keeps its $0.00: that
  // one is a fact, not a missing price.
  if (price == null && Number(bal) > 0) return `<b>${fmt(bal, 8)}</b><small>price unavailable</small>`;
  return `<b>${fmt(bal, 8)}</b><small>${usd(bal * (price || 0))}</small>`;
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
  // shows "couldn't load" (the wording every family uses, audit
  // §1.11), never a fake zero. Each chain is its OWN
  // view group (§4.2); in the All view they render consecutively
  // under one shared header.
  cosmosRows.forEach((r, i) => {
    const p = prices[r.symbol];
    const rowHtml = (r.amount == null && !famLoaded.has("cosmos")) ? skeletonRowsHtml(1) : `<div class="row" data-cosmos="${r.key}">
        <span class="logowrap">${tokenLogoHtml({ symbol: r.symbol }, r.key)}</span>
        <span class="grow"><b class="rname">${esc(r.name)}</b><small>${esc(r.symbol)} · Cosmos</small></span>
        <span class="amt">${r.amount == null
          ? `<b>—</b><small>couldn't load</small>`
          : `<b>${fmt(r.amount)}</b><small>${p != null ? usd(Number(r.amount) * p) : (Number(r.amount) > 0 ? "price unavailable" : usd(0))}</small>`}</span></div>`;
    grp(r.key, i === 0 ? `<p class="tag" style="margin:12px 0 2px">Cosmos — one phrase, seven chains</p>` : "", [rowHtml]);
  });
  // Lightning scoped view (§4.2): no token rows — one row into the
  // Lightning panel (the Wallet tab's Lightning button covers All).
  grp("lightning", "", [`<div class="row" data-ln="1">
      <span class="logowrap"><span class="coin" style="background:#f7931a">${icon("bolt", "ic ic-wht")}</span></span>
      <span class="grow"><b class="rname">Bitcoin Lightning</b><small class="lnNodeStatusText">Your own node — pay invoices, offers and Lightning addresses</small></span>
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
  // Unpriced-native card totals (2026-11-09 unpriced-native fix): a
  // family holding its native asset with no live price shows the
  // native amount in its card header instead of a bare priced-sum
  // $0.00. Cosmos is keyed per chain row (its card spans seven).
  const unpricedNativeByKey = {};
  {
    const net0 = NETWORKS[networkKey];
    if (!evmLoadFailed) {
      const row = balances.find(b => isNativeRow("evm", b));
      if (row && Number(row.amount) > 0) {
        const p = priceOfRow(row, row.address ? prices[row.symbol] : prices[net0.priceSym]);
        if (p == null) unpricedNativeByKey.evm = { amount: fmt(row.amount), sym: row.symbol };
      }
    }
    const btcT = Number(btcBal) + Number(btcTrBal);
    if (!btcLoadFailed && btcT > 0 && prices.BTC == null)
      unpricedNativeByKey.bitcoin = { amount: fmt(btcT), sym: "BTC" };
    for (const [bal, sym, key] of [[ltcBal, "LTC", "litecoin"], [dogeBal, "DOGE", "dogecoin"], [bchBal, "BCH", "bitcoincash"]])
      if (Number(bal) > 0 && prices[sym] == null) unpricedNativeByKey[key] = { amount: fmt(bal, 8), sym };
    for (const [key, rows, sym0, flag] of [
      ["tron", tronBalances, "TRX", tronLoadFailed], ["solana", solBalances, "SOL", false],
      ["sui", suiBalances, "SUI", false], ["stellar", stellarBalances, "XLM", stellarLoadFailed],
      ["ton", tonBalances, "TON", tonLoadFailed], ["near", nearBalances, "NEAR", nearLoadFailed],
      ["algorand", algoBalances, "ALGO", algoLoadFailed], ["xrpl", xrpBalances, "XRP", xrpLoadFailed],
      ["polkadot", dotBalances, "DOT", dotLoadFailed], ["aptos", aptosBalances, "APT", aptosLoadFailed],
      ["stacks", stacksBalances, "STX", stacksLoadFailed],
    ]) {
      if (flag || !Array.isArray(rows)) continue;
      const row = rows.find(b => isNativeRow(key, b)) || rows.find(b => b.symbol === sym0 && !b.address);
      if (row && Number(row.amount) > 0 && priceOfRow(row, prices[row.symbol]) == null)
        unpricedNativeByKey[key] = { amount: fmt(row.amount), sym: row.symbol };
    }
    for (const r of cosmosRows)
      if (Number(r.amount) > 0 && prices[r.symbol] == null) { unpricedNativeByKey[r.key] = { amount: fmt(r.amount), sym: r.symbol }; unpricedNativeByKey.cosmos = unpricedNativeByKey[r.key]; }
  }
  const cardTotalHtml = (key, totalVal) => {
    const un = unpricedNativeByKey[key];
    if (un && !(totalVal > 0)) return `<span class="unpriced-total">${esc(un.amount)} ${esc(un.sym)} · no live price</span>`;
    return totalVal == null ? "—" : usd(totalVal || 0);
  };
  // Held is a RAW-balance fact (2026-11-09 ordering fix): any
  // nonzero amount in a family marks it held for sortHomeFamilies,
  // independent of prices — a priced-or-not holding must never
  // classify as zero again. USD totals only order the held tier.
  const anyHeld = (rows) => Array.isArray(rows) && rows.some(b => Number(b && b.amount) > 0);
  const heldMap = {
    bitcoin: (Number(btcBal) + Number(btcTrBal)) > 0,
    evm: anyHeld(balances), tron: anyHeld(tronBalances), solana: anyHeld(solBalances),
    sui: anyHeld(suiBalances), stellar: anyHeld(stellarBalances), ton: anyHeld(tonBalances),
    near: anyHeld(nearBalances), algorand: anyHeld(algoBalances), xrpl: anyHeld(xrpBalances),
    polkadot: anyHeld(dotBalances), aptos: anyHeld(aptosBalances), stacks: anyHeld(stacksBalances),
    litecoin: Number(ltcBal) > 0, dogecoin: Number(dogeBal) > 0, bitcoincash: Number(bchBal) > 0,
    cosmos: cosmosRows.some(r => Number(r.amount) > 0),
  };
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
    const head = titled ? `<div class="ghead"><span class="t-strong">${esc(titleOf(key))}</span><span class="gsub">${cardTotalHtml(key, totalVal)}${alerts[key] ? ` <button class="falert" data-famalert="${key}" aria-label="Network note">${icon("alert", "ic ic-sm")}</button>` : ""}</span></div>` : "";
    return `<div class="card groupcard">${head}${innerHtml}</div>`;
  };
  let html = "";
  if (viewKey === "all") {
    const cards = [];
    let cosmosBuf = [];
    const flushCosmos = () => {
      if (!cosmosBuf.length) return;
      // The shared Cosmos card header follows TS-F2 too: when
      // EVERY chain's read failed the total is unknown ("—");
      // chains that did load still sum honestly.
      const total = COSMOS_CHAINS.every(c => totals[c.key] == null)
        ? null
        : COSMOS_CHAINS.reduce((t, c) => t + (totals[c.key] || 0), 0);
      // The seven chain rows inside the shared Cosmos card follow
      // the same within-family order as every other family.
      const inner = sortHomeRows(cosmosBuf, (x) => x.amount, (x) => x.valueUsd).map(x => x.html).join("");
      cards.push({ key: "cosmos", totalUsd: total, failed: famFailed.cosmos, held: heldMap.cosmos, html: cardFor("cosmos", inner, true, total) });
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
      cards.push({ key: g.key, totalUsd: totals[g.key], failed: !!famFailed[g.key], held: !!heldMap[g.key], html: cardFor(g.key, g.html, true, totals[g.key]) });
    }
    flushCosmos();
    html = sortHomeFamilies(cards).map(c => c.html).join("");
  } else {
    const g = groups.find(x => x.key === viewKey);
    html = g ? cardFor(g.key, g.html, false, totals[g.key]) : "";
  }
  html += `<button class="btn ghost" id="zeroToggle">${showZeroBalances ? "Hide zero balances" : "Show zero balances"}</button>`;
  $("assetList").innerHTML = html || `<p class="tag">Nothing here yet.</p>`;
  // The static Lightning row under the list is the All view's
  // entry into the panel; the Lightning scoped view renders its
  // OWN Lightning row inside the list. Showing both stacked two
  // identical node-status cards on one screen (owner screenshot,
  // 2026-11-10) — in the Lightning view the static row hides, so
  // the status card renders exactly once per view.
  const lrRow = $("lightningRow");
  if (lrRow) lrRow.classList.toggle("hidden", viewKey === "lightning");
  paintLnNodeStatus();
  persistBalanceCache();
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
    <input id="ctAddr" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Contract address 0x…" autocapitalize="none">
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
    evm: `<p class="tag">EVM address — the same on every EVM network:</p>
      <img class="qr" id="qrEvm"><p class="mono">${wallet.address}</p>
      <button class="btn ghost" id="cpEvm">Copy EVM address</button>`,
    bitcoin: `<p class="tag">Bitcoin — Native SegWit address (bc1q…):</p>
      <img class="qr" id="qrBtc"><p class="mono">${btcAddr}</p>
      <button class="btn ghost" id="cpBtc">Copy SegWit address</button>
      <p class="tag">Bitcoin — Taproot address (bc1p…), same seed:</p>
      <img class="qr" id="qrBtcTr"><p class="mono">${btcTrAddr}</p>
      <button class="btn ghost" id="cpBtcTr">Copy Taproot address</button>
      <p class="tag">Both addresses are yours and both can receive BTC. Taproot is the newer format — some older services only send to SegWit.</p>`,
    lightning: `<div class="lnAddrOut"></div>
      <div id="rcvLnSlot"><p class="tag">Checking for your Lightning receive address…</p></div>
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
      // The "Your Lightning address" block tops this panel: the
      // Receive flow is where a user looks for the address people
      // pay them at, so its publish action lives here too — the
      // same block, from the same state, as the Lightning panel's
      // Receive section (paintLnAddress paints every surface).
      paintLnAddress();
      const paintLn = (ln, name, kind = "address") => {
        const slot = $("rcvLnSlot"); if (!slot) return; // sheet has moved on
        if (ln) {
          // The registered-domain line names the LIVE front door
          // (fluidwallet.dpdns.org) — it used to render FLUID_DOMAIN
          // (fluid.is-a.dev, the legacy display domain), which told
          // users their address lived on a domain it doesn't
          // (Lightning completion audit G7; pinned in tests).
          const label = kind === "offer"
            ? `Your Fluid node's offer${name ? ` (registered to ${esc(name)} — pay it from any Lightning wallet, or by name inside Fluid)` : ""}:`
            : `Your Lightning address${name ? ` (registered to ${esc(name)}.fluidwallet.dpdns.org)` : ""}:`;
          slot.innerHTML = `<p class="tag">${label}</p>
            <img class="qr" id="qrLn"><p class="mono">${esc(ln)}</p>
            <button class="btn ghost" id="cpLn">Copy Lightning ${kind === "offer" ? "offer" : "address"}</button>`;
          qr("qrLn", ln);
          $("cpLn").onclick = () => copyText(ln, $("cpLn"));
        } else {
          slot.innerHTML = `<p class="tag">No Lightning address is registered to your Fluid name yet — add one under “Your Fluid name” in the More tab and it will show here.</p>`;
        }
      };
      // Prefer the native node's own reusable BOLT 12 offer when the
      // node has been booted this session; otherwise the Lightning
      // target registered to the user's Fluid name — the native
      // offer (lnOffer) first, then a hosted address (ln).
      if (lnSession) {
        // P1-15 (completion audit §5.3): an amountless offer is only
        // payable when the node has receiving room. At receivable 0
        // the sheet says so plainly and renders NO artifact.
        const plan = lnReceivePlan({ receivableMsat: Number(lnSession.balance().receivableMsat || 0), requestedMsat: null, hasLsp: !!lnSession.lsp });
        if (plan.kind === "offer") {
          try { return paintLn(lnSession.createOffer(null, "Fluid"), null, "offer"); } catch { /* no peer yet — fall through */ }
        } else {
          const slot = $("rcvLnSlot");
          if (slot) slot.innerHTML = `<p class="tag">Your node can't receive yet — it has no channel with room in it. Open the Lightning panel (Wallet tab → Lightning) and receive a first payment — the payment itself opens your channel.</p>`;
          return;
        }
      }
      const myName = localStorage.getItem("fluid_name");
      if (!myName) {
        const slot = $("rcvLnSlot");
        if (slot) slot.innerHTML = `<p class="tag">Open the Lightning panel (Wallet tab → Lightning) once to start your node — your reusable receive offer will appear here. You can also register a Lightning address to your Fluid name under “Your Fluid name” in the More tab.</p>`;
        return;
      }
      resolveFluidName(myName).then(hit => {
        const t = hit ? lightningTargetForNameEntry(hit) : null;
        paintLn(t ? t.value : null, myName, t ? t.kind : "address");
      }).catch(() => paintLn(null, myName));
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
  // Sheet order (owner feedback, 2026-11-11): the network list
  // LEADS and the selected network's panel follows it — a normal
  // multi-network receive sheet. The Lightning address block lives
  // inside the Lightning panel like every other network's own
  // section, never as a banner over the list; and the search
  // drives BOTH halves: the list filters, and while a query is
  // typed the shown panel must be one of the hits, so a match is
  // on screen the moment it's typed. (Field report: searching
  // "algo" left the Algorand row at the bottom of the scroll box
  // under an unrelated Lightning panel — most users never found
  // it.)
  openSheet(`<h3>Receive</h3>
    <input id="rcvSearch" placeholder="Search networks…" autocapitalize="none">
    <div id="rcvList" style="max-height:38dvh;overflow-y:auto"></div>
    <hr style="border-color:var(--line)">
    <div id="rcvPanel"></div>`);
  const paintPanel = () => {
    const host = $("rcvPanel"); if (!host) return;
    host.innerHTML = panels[selected] || "";
    if (binds[selected]) binds[selected]();
  };
  const paintList = () => {
    const host = $("rcvList"); if (!host) return;
    const q = $("rcvSearch").value;
    const hits = filterReceiveNetworks(q);
    // Search moves the panel too: if the current selection fell
    // out of the hits, the panel follows the top hit — the match
    // and its address are visible without scrolling or a tap.
    // A selection that still matches (or a blank query) is left
    // exactly where the user put it.
    if (String(q).trim() && hits.length && !hits.some(m => m.id === selected)) {
      selected = hits[0].id;
      paintPanel();
    }
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
// ---------- cash-out deposits (non-custodial ramp fees) ----------
// A send the user declares as a CASH-OUT — they finished a provider's
// own sale steps and came back with the provider's deposit address
// and its exact quoted amount — is composed with Fluid's own fee
// under the ramp-fee design (wallet-core's rampFeeQuote and friends):
// the provider receives its full quoted amount, Fluid's fee is a
// separate line in the review sentence, sized by the fee law. Plain
// sends are untouched: the toggle defaults off, and every refusal
// inside the composition falls back to the plain send with the fee
// printed as $0 — never a silent charge, and never a silently
// dropped one either (the sentence always shows the fee line).
const RAMP_FEE_FIAT_SYMBOLS = { NGN: "₦", KES: "KSh ", GHS: "GH₵", ZAR: "R ", USD: "$", EUR: "€", GBP: "£" };
function rampFeeFieldsHtml(p) {
  return `<label class="tag" style="display:block;margin-top:10px"><input type="checkbox" id="${p}Ramp"> This is a cash-out — I'm sending to a provider's deposit address for a sale</label>
  <div id="${p}RampFields" class="hidden">
    <input id="${p}ProvName" placeholder="Provider name (optional)" autocapitalize="words">
    <input id="${p}FiatAmt" inputmode="decimal" placeholder="The provider will pay you (fiat amount)">
    <input id="${p}FiatRate" inputmode="decimal" placeholder="Provider's rate — fiat per $1 (e.g. 1378)">
    <input id="${p}FiatCur" placeholder="Currency (e.g. NGN)" autocapitalize="characters">
    <p class="tag">Fluid composes the sale with its own fee where the fee law allows — the provider still receives the full amount in the amount box. The review sentence shows the fee before you confirm. Leave the rate blank and the sale simply carries no Fluid fee.</p>
  </div>`;
}
function wireRampFeeFields(p) {
  const box = $(p + "Ramp");
  if (box) box.onchange = () => { const f = $(p + "RampFields"); if (f) f.classList.toggle("hidden", !box.checked); };
}
function readRampFeeInputs(p) {
  const box = $(p + "Ramp");
  if (!box || !box.checked) return null;
  const fiatAmt = Number(($(p + "FiatAmt") || {}).value);
  const rate = Number(($(p + "FiatRate") || {}).value);
  const cur = String((($(p + "FiatCur") || {}).value || "")).trim().toUpperCase();
  const sym = RAMP_FEE_FIAT_SYMBOLS[cur] || (cur ? cur + " " : "");
  return {
    providerName: String((($(p + "ProvName") || {}).value || "")).trim(),
    fiatText: Number.isFinite(fiatAmt) && fiatAmt > 0 ? sym + fiatAmt.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "",
    amountOutUsd: Number.isFinite(fiatAmt) && fiatAmt > 0 && Number.isFinite(rate) && rate > 0 ? fiatAmt / rate : null,
  };
}
function saveRampOrder(record) {
  try { saveRampFeeOrder(localStorage, record); } catch { /* storage blocked: the in-sheet flow still stands */ }
  return record;
}
function openRampOrder(family, chainKey = null) {
  try {
    return loadRampFeeOrders(localStorage).find(r => r.family === family
      && (chainKey == null || r.chainKey === chainKey)
      && (r.status === "leg1-sent" || r.status === "provider-confirmed" || r.status === "fee-return-due")) || null;
  } catch { return null; }
}
function rampOrderId() {
  return "ramp-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
}
/** The tier-2 continuation panel: the deposit is sent; the fee send
 *  waits for the provider's confirmation (the ordering IS the safety
 *  property — a failed sale never costs the fee), and a refund marks
 *  the order closed with nothing owed. Self-contained: it re-renders
 *  itself into its container after every step, and the same panel is
 *  what a reopened send sheet offers for an unfinished sale. */
function mountRampOrderPanel(container, record, sendFee) {
  if (!container) return;
  container.innerHTML = `<p class="tag">${esc(rampFeeOrderSummary(record))}</p>`
    + ((record.status === "leg1-sent" || record.status === "provider-confirmed")
      ? `<button class="btn" data-ramp-fee-send>Provider confirmed — send Fluid's fee</button>
         <button class="btn ghost" data-ramp-refunded>The sale failed / was refunded</button>` : "")
    + (record.status === "fee-return-due"
      ? `<p class="tag">Fluid's fee for this sale is on its way back to your address — it returns automatically.</p>` : "")
    + `<p class="msg err" data-ramp-msg></p>`;
  const msgEl = container.querySelector("[data-ramp-msg]");
  const refBtn = container.querySelector("[data-ramp-refunded]");
  if (refBtn) refBtn.onclick = () => {
    try {
      const next = rampFeeOrderTransition(record, "provider-refunded");
      saveRampOrder(next);
      mountRampOrderPanel(container, next, sendFee);
    } catch (e) { if (msgEl) msgEl.textContent = e.message; }
  };
  const feeBtn = container.querySelector("[data-ramp-fee-send]");
  if (feeBtn) feeBtn.onclick = async () => {
    try {
      feeBtn.disabled = true;
      let rec = record;
      if (rec.status === "leg1-sent") { rec = rampFeeOrderTransition(rec, "provider-confirmed"); saveRampOrder(rec); }
      if (msgEl) msgEl.textContent = "Sending Fluid's fee…";
      const { hash } = await sendFee(rec);
      rec = rampFeeOrderTransition(rec, "fee-sent", { txid: hash }); saveRampOrder(rec);
      rec = rampFeeOrderTransition(rec, "complete"); saveRampOrder(rec);
      mountRampOrderPanel(container, rec, sendFee);
    } catch (e) {
      if (msgEl) msgEl.textContent = "Fee send failed: " + (e.shortMessage || e.message);
      feeBtn.disabled = false;
    }
  };
}
function openRampOrderSheet(record, sendFee) {
  openSheet(`<h3>Cash-out in progress</h3>
    <div id="roPanel"></div>
    <p class="tag">You can close this and finish later — the sale is saved on this device, and the send sheet will offer to complete it.</p>`);
  mountRampOrderPanel($("roPanel"), record, sendFee);
}
/** The tier-2 fee send, per family — an ordinary plain send of the
 *  recorded fee amount to the recorded collection address. */
function evmRampSendFee(record) {
  return async (rec) => {
    const dec = rec.token.decimals ?? 6;
    const tx = await executeSend(wallet, rec.chainKey, {
      to: rec.feeTo, amount: ethers.formatUnits(BigInt(rec.feeRaw), dec),
      token: rec.token.address ? { address: rec.token.address, decimals: dec } : null,
    });
    return { hash: tx.hash };
  };
}
function solanaRampSendFee() {
  return async (rec) => {
    const dec = rec.token.decimals ?? 6;
    const { hash } = await sendSolana(wallet.mnemonic.phrase, {
      to: rec.feeTo, amount: ethers.formatUnits(BigInt(rec.feeRaw), dec),
      token: rec.token.address ? { address: rec.token.address, decimals: dec, program: rec.token.program || undefined } : null,
    });
    return { hash };
  };
}
function tronRampSendFee() {
  return async (rec) => {
    const dec = rec.token.decimals ?? 6;
    const { hash } = await sendTron(wallet, {
      to: rec.feeTo, amount: ethers.formatUnits(BigInt(rec.feeRaw), dec),
      token: rec.token.address ? { address: rec.token.address, decimals: dec } : null,
    });
    return { hash };
  };
}

function openEvmSendSheet() {
  openSheet(`<h3>Send on ${NETWORKS[networkKey].name}</h3>
    <div id="sRampOrder"></div>
    ${!balances.length ? `<p class="tag" id="sLoadNote">${evmLoadFailed ? "Balances couldn't load right now — tap More → Refresh and try again." : "Balances are still loading — wait a moment and try again."}</p>` : ""}
    <select id="sToken">${balances.map((b, i) => `<option value="${i}">${b.verified === false ? "⚠ " : ""}${esc(b.symbol)} — ${fmt(b.amount)}</option>`).join("")}</select>
    <input id="sTo" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" data-autofocus placeholder="Recipient 0x… address or Fluid name (e.g. kemi)">
    <input id="sAmt" inputmode="decimal" placeholder="Amount">
    ${rampFeeFieldsHtml("s")}
    <button class="btn" id="sReview">Review send</button>
    <div id="sIntent" class="hidden">
      <p class="seed" id="sIntentText"></p>
      <button class="btn" id="sConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="sMsg"></p>
    <p class="tag">For Bitcoin, tap the Bitcoin row instead.</p>`);
  wireRampFeeFields("s");
  // Audit P1-9: the two states above are exactly where a stale
  // build strands this sheet after a deploy — a failed load checks
  // the served build stamp now; a load still unfinished at the
  // deadline checks it then. A moved stamp replaces the note with
  // the refresh offer; anything else leaves the copy untouched.
  if (!balances.length) {
    const note = $("sLoadNote");
    if (evmLoadFailed) staleBuildCheck(note, true);
    else setTimeout(() => { if (!balances.length) staleBuildCheck(note, true); }, STALE_BUILD_DEADLINE_MS);
  }
  const sOpenOrder = openRampOrder("evm", networkKey);
  if (sOpenOrder) mountRampOrderPanel($("sRampOrder"), sOpenOrder, evmRampSendFee(sOpenOrder));
  $("sReview").onclick = async () => {
    let to = $("sTo").value.trim();
    let sendName = null;
    const amount = $("sAmt").value.trim(), b = balances[Number($("sToken").value)];
    if (!to) return msg("sMsg", "Enter a recipient.");
    // Recipient resolution is the shared resolveChainRecipient path
    // (audit P1-2): a well-formed address is accepted as a raw
    // external address; a name-shaped string is checked against the
    // registry, and only that registry read decides whether the
    // name exists; anything else is reported as what it is — a
    // malformed address. The three states are never conflated.
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) msg("sMsg", "Checking the recipient…", true);
    try {
      const r = await resolveChainRecipient(to, { isValidAddress: (a) => /^0x[0-9a-fA-F]{40}$/.test(a), field: "evm", chainLabel: NETWORKS[networkKey].name });
      to = r.to; sendName = r.name;
    } catch (e) { return msg("sMsg", e.message); }
    if (sendName) {
      toast("Name resolved");
      msg("sMsg", sendName + "." + FLUID_DOMAIN + " → " + to.slice(0, 10) + "…", true);
    } else msg("sMsg", "");
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
    // Cash-out deposits take their own review path: the composition
    // is priced and the design's sentence painted BEFORE the balance
    // gate, so the fee disclosure exists even when the send itself
    // then refuses on funds.
    const rampIn = readRampFeeInputs("s");
    if (rampIn) {
      pendingSend = null;
      show("sIntent", false);
      try {
        msg("sMsg", "Pricing this cash-out…", true);
        const token = b.address ? b : null;
        const dec = token ? token.decimals : 18;
        const px = Number(prices[b.symbol]);
        const amountInUsd = Number(amount) * px;
        const est = await estimateRampFeeEvmGasUsd(wallet, networkKey, { to, amount, token, nativePriceUsd: prices[NETWORKS[networkKey].priceSym] });
        const quote = rampFeeQuote({ family: "evm", chainKey: networkKey,
          tier1Eligible: rampTier1Eligible("evm", networkKey, token),
          amountInUsd, amountOutUsd: rampIn.amountOutUsd,
          gasUsd: est.gasUsd, composeExtraUsd: est.extraGasUsd,
          leg2GasUsd: Math.max(0, est.gasUsd - est.extraGasUsd),
          providerRaw: ethers.parseUnits(String(amount), dec), tokenDecimals: dec, tokenPriceUsd: px });
        const feeText = ethers.formatUnits(quote.feeRaw, dec);
        const totalText = ethers.formatUnits(quote.totalRaw, dec);
        const netFeeText = (quote.tier === 2
          ? fmtFixed(2 * Number(est.bareGasNativeText))
          : fmtFixed(Number(est.gasNativeText))) + " " + NETWORKS[networkKey].symbol;
        $("sIntentText").textContent = formatRampSellIntent({ tier: quote.tier,
          amountText: amount, symbol: b.symbol, authorisation: quote.tier === 1,
          fiatText: rampIn.fiatText || ("$" + (Number.isFinite(amountInUsd) ? amountInUsd.toFixed(2) : amount)),
          providerName: rampIn.providerName, feeText, totalText, networkFeeText: netFeeText })
          + (b.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
        setBalanceAfter($("sIntentText"), { balance: b.amount, amount: totalText, fee: null, symbol: b.symbol });
        show("sIntent");
        if (Number(totalText) > Number(b.amount)) {
          return msg("sMsg", warnPrefix + resolvedNote + (quote.tier
            ? "That amount plus Fluid's fee is more than your balance."
            : "Amount is more than your balance."));
        }
        pendingSend = { to, amount, token, symbol: b.symbol, name: sendName,
          feeNative: Number(est.gasNativeText), ramp: { quote, rampIn } };
        msg("sMsg", poisonNote);
      } catch (e) { msg("sMsg", warnPrefix + "Could not price this cash-out: " + (e.shortMessage || e.message)); }
      return;
    }
    if (Number(amount) > Number(b.amount)) return msg("sMsg", warnPrefix + resolvedNote + "Amount is more than your balance.");
    try {
      msg("sMsg", "Estimating fee…", true);
      const fee = await estimateSend(wallet, networkKey, { to, amount, token: b.address ? b : null });
      pendingSend = { to, amount, token: b.address ? b : null, symbol: b.symbol, name: sendName, feeNative: Number(fee) };
      $("sIntentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: fmtFixed(fee), name: sendName })
        + (b.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("sIntentText"), { balance: b.amount, amount, fee: b.address ? null : Number(fee), symbol: b.symbol });
      show("sIntent"); msg("sMsg", poisonNote);
    } catch (e) { msg("sMsg", warnPrefix + "Could not estimate: " + (e.shortMessage || e.message)); }
  };
  $("sConfirm").onclick = async () => {
    if (!pendingSend) return;
    const btn = $("sConfirm");
    // Cash-out, tier 1: one Permit2 batch transaction settles the
    // provider's full amount and Fluid's fee atomically.
    if (pendingSend.ramp && pendingSend.ramp.quote.tier === 1) {
      const { quote, rampIn } = pendingSend.ramp;
      try {
        setSendBusy(btn, true);
        msg("sMsg", "Composing the sale — the provider's amount and Fluid's fee move together…", true);
        const feeTo = FEE_SPLIT.dripbot.agentWallet.evm;
        const tx = await executeRampFeeSendEvm(wallet, networkKey, {
          token: pendingSend.token,
          legs: [{ to: pendingSend.to, amountRaw: quote.providerRaw },
                 { to: feeTo, amountRaw: quote.feeRaw }],
        });
        const dec = pendingSend.token ? pendingSend.token.decimals : 18;
        saveRampOrder(rampFeeOrderTransition(newRampFeeOrder({
          id: rampOrderId(), tier: 1, family: "evm", chainKey: networkKey,
          token: { symbol: pendingSend.symbol, address: pendingSend.token ? pendingSend.token.address : null, decimals: dec },
          providerTo: pendingSend.to, providerRaw: quote.providerRaw, feeRaw: quote.feeRaw,
          feeTo, userAddress: wallet.address, fiatText: rampIn.fiatText, providerName: rampIn.providerName,
        }), "settled", { txid: tx.hash }));
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash: tx.hash, amount: pendingSend.amount, symbol: pendingSend.symbol, to: pendingSend.to, explorer: NETWORKS[networkKey].explorer, at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        const done = pendingSend; pendingSend = null;
        showTxSuccess({ verb: "Sold", amount: done.amount, symbol: done.symbol,
          logoHtml: tokenLogoHtml({ symbol: done.symbol, address: done.token ? done.token.address : null }, "evm"),
          to: done.to, toName: done.name, familyName: NETWORKS[networkKey].name,
          feeText: `Fluid fee ${ethers.formatUnits(quote.feeRaw, dec)} ${done.symbol} — settled in the same transaction`,
          explorerUrl: historyTxUrl({ hash: tx.hash, explorer: NETWORKS[networkKey].explorer }), txid: tx.hash, pending: false });
      } catch (e) { sendFailed(btn, "sMsg", e); }
      return;
    }
    // Cash-out, tier 2: the provider's amount goes first, in full;
    // the fee send waits for the provider's confirmation.
    if (pendingSend.ramp && pendingSend.ramp.quote.tier === 2) {
      const { quote, rampIn } = pendingSend.ramp;
      try {
        setSendBusy(btn, true);
        msg("sMsg", "Sending the provider's amount first…", true);
        const tx = await executeSend(wallet, networkKey, pendingSend);
        const dec = pendingSend.token ? pendingSend.token.decimals : 18;
        const feeTo = FEE_SPLIT.dripbot.agentWallet.evm;
        let record = newRampFeeOrder({
          id: rampOrderId(), tier: 2, family: "evm", chainKey: networkKey,
          token: { symbol: pendingSend.symbol, address: pendingSend.token ? pendingSend.token.address : null, decimals: dec },
          providerTo: pendingSend.to, providerRaw: quote.providerRaw, feeRaw: quote.feeRaw,
          feeTo, userAddress: wallet.address, fiatText: rampIn.fiatText, providerName: rampIn.providerName,
        });
        record = saveRampOrder(rampFeeOrderTransition(record, "leg1-sent", { txid: tx.hash }));
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash: tx.hash, amount: pendingSend.amount, symbol: pendingSend.symbol, to: pendingSend.to, explorer: NETWORKS[networkKey].explorer, at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        pendingSend = null;
        openRampOrderSheet(record, evmRampSendFee(record));
      } catch (e) { sendFailed(btn, "sMsg", e); }
      return;
    }
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
        feeText: done.feeNative != null ? `≈ ${fmtFixed(done.feeNative)} ${NETWORKS[networkKey].symbol}` : null,
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
    <input id="bTo" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" data-autofocus placeholder="Recipient bc1… address or Fluid name">
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
    // The shared resolver (audit P1-2): the old startsWith("bc1")
    // test sent legacy 1…/3… addresses — and every typo — down the
    // name path, where they were misreported as name problems. A
    // valid Bitcoin address (any format) is an address; a
    // name-shaped string is settled by the registry read; anything
    // else is a malformed address and says so.
    if (to) {
      try {
        const r = await resolveChainRecipient(to, { isValidAddress: isValidBitcoinAddress, field: "btc", chainLabel: "Bitcoin" });
        to = r.to; sendName = r.name;
      } catch (e) { return msg("bMsg", e.message); }
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
    <div id="tRampOrder"></div>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${tronAddr}</span></p>
    <input id="tTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient T… address or Fluid name" autocapitalize="none">
    <input id="tAmt" inputmode="decimal" placeholder="Amount">
    ${rampFeeFieldsHtml("t")}
    <button class="btn" id="tReview">Review send</button>
    <div id="tIntent" class="hidden">
      <p class="seed" id="tIntentText"></p>
      <button class="btn" id="tConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="tMsg"></p>
    <p class="tag">${tok.address
      ? "Token sends burn a little TRX for energy — keep some TRX in this wallet."
      : "Tron network fees are paid in TRX (bandwidth/energy). Sends are final."}</p>`);
  wireRampFeeFields("t");
  const tOpenOrder = openRampOrder("tron");
  if (tOpenOrder) mountRampOrderPanel($("tRampOrder"), tOpenOrder, tronRampSendFee());
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
    // Cash-out deposits: Tron composes sequentially (tier 2) — the
    // provider's send first, the fee only after it confirms — and
    // the honest energy cost of the second leg is fed into the fee
    // law, which is why small Tron sales price at a $0 fee.
    const rampInTron = readRampFeeInputs("t");
    if (rampInTron) {
      pendingTron = null;
      show("tIntent", false);
      const dec = tok.decimals ?? 6;
      const px = Number(prices[tok.symbol]);
      const amountInUsd = Number(amount) * px;
      const quote = rampFeeQuote({ family: "tron", tier1Eligible: false,
        amountInUsd, amountOutUsd: rampInTron.amountOutUsd,
        gasUsd: 2 * RAMP_FEE_TRON_LEG_GAS_USD, leg2GasUsd: RAMP_FEE_TRON_LEG_GAS_USD,
        providerRaw: ethers.parseUnits(String(amount), dec), tokenDecimals: dec, tokenPriceUsd: px });
      const feeText = ethers.formatUnits(quote.feeRaw, dec);
      const totalText = ethers.formatUnits(quote.totalRaw, dec);
      $("tIntentText").textContent = formatRampSellIntent({ tier: quote.tier,
        amountText: amount, symbol: tok.symbol,
        fiatText: rampInTron.fiatText || ("$" + (Number.isFinite(amountInUsd) ? amountInUsd.toFixed(2) : amount)),
        providerName: rampInTron.providerName, feeText, totalText,
        networkFeeText: "$" + (2 * RAMP_FEE_TRON_LEG_GAS_USD).toFixed(2) + " of TRX (modelled, two sends)" })
        + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
      setBalanceAfter($("tIntentText"), { balance: tok.amount, amount: totalText, fee: null, symbol: tok.symbol });
      show("tIntent");
      if (Number(totalText) > Number(tok.amount)) {
        return msg("tMsg", quote.tier ? "That amount plus Fluid's fee is more than your balance." : "Amount is more than your balance.");
      }
      pendingTron = { to, amount, ramp: { quote, rampIn: rampInTron } };
      return msg("tMsg", "");
    }
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
    // Cash-out, tier 2: the provider's amount goes first, in full;
    // the fee send waits for the provider's confirmation.
    if (pendingTron.ramp && pendingTron.ramp.quote.tier === 2) {
      const { quote, rampIn } = pendingTron.ramp;
      try {
        setSendBusy(btn, true);
        msg("tMsg", "Sending the provider's amount first…", true);
        const { hash } = await sendTron(wallet, {
          to: pendingTron.to, amount: pendingTron.amount,
          token: tok.address ? { address: tok.address, decimals: tok.decimals } : null,
        });
        const feeTo = FEE_SPLIT.dripbot.agentWallet.tron;
        let record = newRampFeeOrder({
          id: rampOrderId(), tier: 2, family: "tron", chainKey: "tron",
          token: { symbol: tok.symbol, address: tok.address || null, decimals: tok.decimals ?? 6 },
          providerTo: pendingTron.to, providerRaw: quote.providerRaw, feeRaw: quote.feeRaw,
          feeTo, userAddress: tronAddr, fiatText: rampIn.fiatText, providerName: rampIn.providerName,
        });
        record = saveRampOrder(rampFeeOrderTransition(record, "leg1-sent", { txid: hash }));
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash, amount: pendingTron.amount, symbol: tok.symbol, to: pendingTron.to,
          link: `https://tronscan.org/#/transaction/${hash}`, explorer: "https://tronscan.org", at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        pendingTron = null;
        openRampOrderSheet(record, tronRampSendFee());
      } catch (e) { sendFailed(btn, "tMsg", e); }
      return;
    }
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
    <div id="oRampOrder"></div>
    <p><b>${fmt(tok.amount)} ${esc(tok.symbol)}</b> · from <span class="mono">${solAddr}</span></p>
    <input id="oTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Solana address or Fluid name" autocapitalize="none">
    <input id="oAmt" inputmode="decimal" placeholder="Amount">
    ${rampFeeFieldsHtml("o")}
    <button class="btn" id="oReview">Review send</button>
    <div id="oIntent" class="hidden">
      <p class="seed" id="oIntentText"></p>
      <button class="btn" id="oConfirm">Confirm &amp; send</button>
    </div>
    <p class="msg err" id="oMsg"></p>
    <p class="tag">${tok.address
      ? "Token sends pay a small SOL fee. If the recipient has no " + esc(tok.symbol) + " account yet, one is created for them and you pay about 0.002 SOL rent for it — the review sentence tells you when that applies."
      : "A Solana account must always keep at least 0.00089 SOL (the rent-exempt minimum) or be emptied completely — sends that would strand less than that are blocked. Sends are final."}</p>`);
  wireRampFeeFields("o");
  const oOpenOrder = openRampOrder("solana");
  if (oOpenOrder) mountRampOrderPanel($("oRampOrder"), oOpenOrder, solanaRampSendFee());
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
    // Cash-out deposits: priced and sentenced before the balance
    // gate, exactly as on the EVM sheet.
    const rampInSol = readRampFeeInputs("o");
    if (rampInSol) {
      pendingSol = null;
      show("oIntent", false);
      try {
        msg("oMsg", "Pricing this cash-out…", true);
        const token = tok.address ? { address: tok.address, decimals: tok.decimals, program: tok.program } : null;
        const dec = tok.decimals ?? 6;
        const px = Number(prices[tok.symbol]);
        const amountInUsd = Number(amount) * px;
        const plan = await solanaRampSplitPlan(solAddr, { to, token });
        const solPx = Number(prices.SOL) || 0;
        const quote = rampFeeQuote({ family: "solana",
          tier1Eligible: rampTier1Eligible("solana", null, token),
          amountInUsd, amountOutUsd: rampInSol.amountOutUsd,
          gasUsd: ((5000 + plan.ataRentLamports) / 1e9) * solPx,
          composeExtraUsd: (plan.createsFeeAta ? SOLANA_ATA_RENT_LAMPORTS / 1e9 : 0) * solPx,
          leg2GasUsd: (5000 / 1e9) * solPx,
          providerRaw: ethers.parseUnits(String(amount), dec), tokenDecimals: dec, tokenPriceUsd: px });
        const feeText = ethers.formatUnits(quote.feeRaw, dec);
        const totalText = ethers.formatUnits(quote.totalRaw, dec);
        $("oIntentText").textContent = formatRampSellIntent({ tier: quote.tier,
          amountText: amount, symbol: tok.symbol,
          fiatText: rampInSol.fiatText || ("$" + (Number.isFinite(amountInUsd) ? amountInUsd.toFixed(2) : amount)),
          providerName: rampInSol.providerName, feeText, totalText,
          networkFeeText: solLamportsToSol(5000 + plan.ataRentLamports) + " SOL" })
          + (tok.verified === false ? " ⚠ " + UNVERIFIED_CAUTION : "");
        setBalanceAfter($("oIntentText"), { balance: tok.amount, amount: totalText, fee: null, symbol: tok.symbol });
        show("oIntent");
        if (Number(totalText) > Number(tok.amount)) {
          return msg("oMsg", quote.tier ? "That amount plus Fluid's fee is more than your balance." : "Amount is more than your balance.");
        }
        pendingSol = { to, amount, ramp: { quote, rampIn: rampInSol } };
        msg("oMsg", "");
      } catch (e) { msg("oMsg", "Could not price this cash-out: " + e.message); }
      return;
    }
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
    // Cash-out, tier 1: one transaction carries the provider's full
    // amount and Fluid's fee together (native Solana composition).
    if (pendingSol.ramp && pendingSol.ramp.quote.tier === 1) {
      const { quote, rampIn } = pendingSol.ramp;
      try {
        setSendBusy(btn, true);
        msg("oMsg", "Composing the sale — both amounts move in one transaction…", true);
        const feeTo = FEE_SPLIT.dripbot.agentWallet.solana;
        const { hash } = await sendSolanaRampSplit(wallet.mnemonic.phrase, {
          to: pendingSol.to, amount: pendingSol.amount,
          feeAmount: ethers.formatUnits(quote.feeRaw, tok.decimals ?? 6),
          token: tok.address ? { address: tok.address, decimals: tok.decimals, program: tok.program } : null,
        });
        saveRampOrder(rampFeeOrderTransition(newRampFeeOrder({
          id: rampOrderId(), tier: 1, family: "solana", chainKey: "solana",
          token: { symbol: tok.symbol, address: tok.address || null, decimals: tok.decimals ?? 6, program: tok.program || null },
          providerTo: pendingSol.to, providerRaw: quote.providerRaw, feeRaw: quote.feeRaw,
          feeTo, userAddress: solAddr, fiatText: rampIn.fiatText, providerName: rampIn.providerName,
        }), "settled", { txid: hash }));
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash, amount: pendingSol.amount, symbol: tok.symbol, to: pendingSol.to,
          link: `${SOLANA_EXPLORER}/tx/${hash}`, explorer: SOLANA_EXPLORER, at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        const done = pendingSol; pendingSol = null;
        showTxSuccess({ verb: "Sold", amount: done.amount, symbol: tok.symbol,
          logoHtml: tokenLogoHtml(tok, "solana"), to: done.to, familyName: "Solana",
          feeText: `Fluid fee ${ethers.formatUnits(quote.feeRaw, tok.decimals ?? 6)} ${tok.symbol} — settled in the same transaction`,
          explorerUrl: historyTxUrl({ link: `${SOLANA_EXPLORER}/tx/${hash}` }), txid: hash, pending: false });
      } catch (e) { sendFailed(btn, "oMsg", e); }
      return;
    }
    // Cash-out, tier 2: provider first, fee after confirmation.
    if (pendingSol.ramp && pendingSol.ramp.quote.tier === 2) {
      const { quote, rampIn } = pendingSol.ramp;
      try {
        setSendBusy(btn, true);
        msg("oMsg", "Sending the provider's amount first…", true);
        const { hash } = await sendSolana(wallet.mnemonic.phrase, {
          to: pendingSol.to, amount: pendingSol.amount,
          token: tok.address ? { address: tok.address, decimals: tok.decimals, program: tok.program } : null,
        });
        const feeTo = FEE_SPLIT.dripbot.agentWallet.solana;
        let record = newRampFeeOrder({
          id: rampOrderId(), tier: 2, family: "solana", chainKey: "solana",
          token: { symbol: tok.symbol, address: tok.address || null, decimals: tok.decimals ?? 6, program: tok.program || null },
          providerTo: pendingSol.to, providerRaw: quote.providerRaw, feeRaw: quote.feeRaw,
          feeTo, userAddress: solAddr, fiatText: rampIn.fiatText, providerName: rampIn.providerName,
        });
        record = saveRampOrder(rampFeeOrderTransition(record, "leg1-sent", { txid: hash }));
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        h.unshift({ hash, amount: pendingSol.amount, symbol: tok.symbol, to: pendingSol.to,
          link: `${SOLANA_EXPLORER}/tx/${hash}`, explorer: SOLANA_EXPLORER, at: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)));
        pendingSol = null;
        openRampOrderSheet(record, solanaRampSendFee());
      } catch (e) { sendFailed(btn, "oMsg", e); }
      return;
    }
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
    <input id="uTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Sui address (0x…) or Fluid name" autocapitalize="none">
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
    <input id="stTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Stellar address (G…)" autocapitalize="none">
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
    <input id="tnTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient TON address (EQ… / UQ…)" autocapitalize="none">
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
    <input id="nrTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient NEAR account (name.near or 64-hex)" autocapitalize="none">
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
    <input id="agTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Algorand address or Fluid name (e.g. dripbot)" autocapitalize="none">
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
    <input id="xrTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient XRP Ledger address (r…)" autocapitalize="none">
    <input id="xrAmt" inputmode="decimal" placeholder="Amount">
    <input id="xrTag" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="numeric" placeholder="Destination tag (optional — exchanges often require one)">
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
    <input id="dtTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Polkadot address" autocapitalize="none">
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
    <input id="apTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Aptos address (0x…)" autocapitalize="none">
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
    <input id="sxTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient Stacks address (SP…)" autocapitalize="none">
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
    <input id="lTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient ltc1… address" autocapitalize="none">
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
    <input id="cTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient bitcoincash:q… or legacy address" autocapitalize="none">
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
    <input id="gTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient D… address" autocapitalize="none">
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
       <input id="kTo" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Recipient ${chain.prefix}1… address" autocapitalize="none">
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
        feeText: `${fmtFixed(est.feeText)} ${est.feeSymbol}`, feeAmt: Number(est.feeText) };
      $("kIntentText").textContent = formatCosmosSendIntent({
        amount, symbol: sel.symbol, to, chainName: chain.name,
        feeAmount: fmtFixed(est.feeText), feeSymbol: est.feeSymbol })
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
// Node-status clarity (owner directive, 2026-11-10): every Lightning
// surface — home row, panel, name card — derives what it says from
// lnStatusSnapshot() below, never from its own local guess. The boot
// bookkeeping lives here: a boot in flight, and the last boot's
// failure (stage + plain headline), so a failed start stays VISIBLE
// as a failure with a retry instead of silently reverting to a
// start button. A successful boot also records the node (id +
// network) per wallet on this device, so "you have created your
// Fluid node" stays true and sayable across restarts even while
// the node isn't running.
let lnBootUiState = { starting: false, failed: null };
let lnNativeOfferError = null; // name-card step-1 offer failure, painted beside the button
let lnNativeLabelHold = false; // the "Check the registry again" label owns the button while set
let lnNativeTermsPainted = false; // the terms step owns the button label while painted
const LN_NODE_REC_KEY = "fluid_ln_node_v1";
function lnNodeRecord() {
  try {
    if (!wallet || !wallet.address) return null;
    const all = JSON.parse(localStorage.getItem(LN_NODE_REC_KEY) || "{}");
    return all[String(wallet.address).toLowerCase()] || null;
  } catch { return null; }
}
function lnRememberNode(session) {
  try {
    if (!wallet || !wallet.address || !session) return;
    const all = JSON.parse(localStorage.getItem(LN_NODE_REC_KEY) || "{}");
    all[String(wallet.address).toLowerCase()] = { nodeId: session.nodeId, network: session.network };
    localStorage.setItem(LN_NODE_REC_KEY, JSON.stringify(all));
  } catch { /* storage blocked — status falls back to the live session alone */ }
}
function lnStatusSnapshot() {
  let running = false, nodeId = null, network = null, recv = 0, spend = 0;
  if (lnSession) {
    running = true; nodeId = lnSession.nodeId; network = lnSession.network;
    try { const b = lnSession.balance(); recv = Number(b.receivableMsat || 0); spend = Number(b.spendableMsat || 0); } catch { recv = 0; spend = 0; }
  }
  const rec = lnNodeRecord();
  return lnNodeStatus({
    running,
    exists: !!rec,
    starting: lnBootUiState.starting,
    failed: lnBootUiState.failed,
    network: network || (rec && rec.network) || null,
    nodeId: nodeId || (rec && rec.nodeId) || null,
    receivableMsat: recv,
    spendableMsat: spend,
  });
}
// Paint the shared status onto every surface currently in the DOM:
// the home Lightning rows (class), and the name card's status line
// + resting button label (ids; the button keeps a held label —
// "Check the registry again" — while lnNativeLabelHold is set).
function paintLnNodeStatus() {
  const st = lnStatusSnapshot();
  document.querySelectorAll(".lnNodeStatusText").forEach((el) => { el.textContent = st.short; });
  const nc = $("ownedLnNodeStatus");
  if (nc) nc.textContent = lnNativeOfferError && lnSession ? lnNativeOfferError : st.headline + " — " + st.detail;
  const nb = $("ownedLnNativeBtn");
  if (nb && !nb.disabled && !lnNativeLabelHold && !lnNativeTermsPainted) nb.textContent = st.nativeBtnLabel;
}
let satoraPollTimer = null;
let mayanPollTimer = null;
let gfbPollTimer = null;
const lnNetKey = () => localStorage.getItem("fluid_ln_network") || "bitcoin";
const lnSats = (msat) => `${(Number(msat || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;

$("lightningRow").onclick = () => openLightningPanel();

// The Lightning chunk is verified against the fingerprint pinned in
// THIS bundle (ln-asset-pins.generated.js) before it is imported —
// the exact bytes served for the chunk URL are fetched fresh and
// hashed first, and the module that actually loads must carry the
// pinned-boot marker, so a stale cached chunk from a previous build
// is refused plainly (reload) instead of silently running. (The
// import specifier must stay the literal "./lightning.chunk.js":
// the bundler externalises exactly that string.)
let lnChunkPromise = null;
function lnLoadChunk() {
  if (lnChunk) return Promise.resolve(lnChunk);
  if (lnChunkPromise) return lnChunkPromise;
  lnChunkPromise = (async () => {
    try {
      const url = new URL("./lightning.chunk.js", document.baseURI);
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
      if (hex !== LN_CHUNK_SHA256) {
        const e = new Error("The Lightning code that arrived doesn't match this app's fingerprint — it was refused, and nothing ran. This can happen while the site is mid-update; try again in a moment.");
        e.stage = "integrity";
        throw e;
      }
      const mod = await import("./lightning.chunk.js");
      if (!mod || mod.LN_PINNED_BOOT !== true) {
        const e = new Error("The Lightning code on this device is from an older Fluid build — reload the page to update it, then try again. Nothing ran.");
        e.stage = "integrity";
        throw e;
      }
      lnChunk = mod;
      return lnChunk;
    } catch (e) {
      lnChunkPromise = null;
      if (e && e.stage) throw e;
      const err = new Error("The Lightning code couldn't be downloaded: " + (e && e.message ? e.message : e));
      err.stage = "software";
      throw err;
    }
  })();
  return lnChunkPromise;
}

// One place that turns node events into (a) the panel's recent-events
// line, (b) repaint, (c) answers for lnWaitEvent waiters (the LSPS
// flows are request/event pairs).
let lnEventWaiters = [];
function lnHandleEvents(evs) {
  for (const ev of evs) {
    if (!lnEventWaiters.length) break;
    const remaining = [];
    for (const w of lnEventWaiters) {
      if (ev.type === w.type && (!w.match || w.match(ev))) { clearTimeout(w.timer); w.resolve(ev); }
      else if (w.failTypes && w.failTypes.includes(ev.type)) { clearTimeout(w.timer); w.reject(new Error(ev.error || "The Lightning provider refused the request.")); }
      else remaining.push(w);
    }
    lnEventWaiters = remaining;
  }
  lnEvents = [...evs].reverse().concat(lnEvents).slice(0, 8);
  if ($("lnPanel")) paintLnPanel();
  paintLnNodeStatus();
}
function lnWaitEvent(type, { timeoutMs = 45000, match = null, failTypes = ["lsps2_failed", "lsps1_failed"] } = {}) {
  return new Promise((resolve, reject) => {
    const w = { type, match, failTypes, resolve, reject, timer: 0 };
    w.timer = setTimeout(() => {
      lnEventWaiters = lnEventWaiters.filter((x) => x !== w);
      reject(new Error("The Lightning provider didn't answer in time — check your connection and try again."));
    }, timeoutMs);
    lnEventWaiters.push(w);
  });
}

// --- Automatic peer connection (channel-free presentation) ---
// A fresh node has an empty peer book, and the node can only
// build its BOLT 12 offer — or route anything — once it is
// connected to at least one peer. Connecting is plumbing, so the
// app does it itself: on boot it dials the default peer (Megalith,
// the same LSP the JIT flows use, reached through the deployed
// WebSocket proxy) with no channel and no user action, and the
// user is never sent into Advanced to connect by hand (owner
// directive, 2026-11-10: the manual remedy shipped earlier made
// registration silently impossible for a normal user). Dial
// attempts are rate-limited, and a peer already live or dialling
// is left alone; the supervisor only re-dials channel peers, so
// this also tops the connection back up if it drops.
let lnLastAutoDialMs = 0;
function lnAutoConnect(session) {
  try {
    if (!session || session.network !== "bitcoin") return;
    if (session.peerStatus().some((p) => p.state === "connected" || p.state === "connecting")) return;
    const now = Date.now();
    if (now - lnLastAutoDialMs < 15000) return;
    const lsp = session.lsp;
    if (!lsp || !lsp.pubkey) return;
    lnLastAutoDialMs = now;
    session.connectPeer(lsp.pubkey, lsp.host, lsp.port);
  } catch { /* a failed dial is retried by the offer waits below */ }
}

// Boot (or reuse) the node session on a network. Throws an error
// carrying .stage ("software" | "download" | "integrity" | "chain" |
// "node") so callers can say exactly which leg failed — never a bare
// "Failed to fetch" (owner field evidence, 2026-11-10).
async function lnEnsureSession(network, onProgress) {
  const net = network || lnNetKey();
  if (lnSession && lnSession.network === net) { lnAutoConnect(lnSession); return lnSession; }
  if (lnSession) { lnBridgeStopResponder(); lnSession.stopLoops(); lnSession = null; }
  lnBootUiState.starting = true;
  lnBootUiState.failed = null;
  paintLnNodeStatus();
  try {
    const chunk = await lnLoadChunk();
    const session = await chunk.bootLightning({
      phrase: wallet.mnemonic.phrase,
      network: net,
      wsProxy: localStorage.getItem("fluid_ln_wsproxy") || "",
      wasmPin: LN_WASM_PIN,
      onProgress: onProgress || (() => {}),
    });
    lnSession = session;
    session.startLoops((evs) => lnHandleEvents(evs));
    lnBridgeSyncResponder();
    lnAutoConnect(session);
    session.syncNow().catch(() => {});
    lnBootUiState.starting = false;
    lnRememberNode(session);
    paintLnNodeStatus();
    return session;
  } catch (e) {
    // A failed boot is a STATE, not a moment: it stays painted on
    // every Lightning surface (with its stage named) until a retry
    // succeeds — never a silent revert to a start button.
    lnBootUiState.starting = false;
    lnBootUiState.failed = { stage: (e && e.stage) || "software", message: lnBootStageHeadline((e && e.stage) || "software") };
    paintLnNodeStatus();
    throw e;
  }
}

function lnBootStageHeadline(stage) {
  if (stage === "download") return "Your Lightning node couldn't load — the node program didn't finish downloading. This is usually a slow or dropped connection.";
  if (stage === "integrity") return "Your Lightning node couldn't load — the downloaded code didn't match this app's fingerprint, so Fluid refused to run it. Nothing was executed.";
  if (stage === "chain") return "Your Lightning node program loaded, but Fluid couldn't read the Bitcoin chain tip to start it.";
  if (stage === "node") return "Your Lightning node couldn't start.";
  return "Your Lightning node couldn't load — its code didn't download.";
}

function lnBootFailedSheet(e) {
  const stage = (e && e.stage) || "software";
  const reason = e && e.message ? e.message : String(e);
  console.warn("[fluid-ln] boot failed at stage:", stage, e);
  openSheet(`<h3>${icon("bolt", "ic ic-brand")} Lightning</h3>
    <p><b>${esc(lnBootStageHeadline(stage))}</b></p>
    <p class="tag">${esc(reason)}</p>
    <p class="tag">Nothing was sent or changed, and your funds are untouched. Any part of the download that did arrive is kept on your phone — retrying continues from there, not from zero.</p>
    <div class="stickyfoot"><button class="btn" id="lnBootRetry">Retry</button></div>
    <h4>Fallback</h4>
    <p class="tag">This is <b>not</b> your node — an external wallet would pay instead: <button class="btn ghost" id="lnBootFallback">Pay via WebLN / LNURL instead</button></p>`);
  $("lnBootRetry").onclick = () => openLightningPanel();
  $("lnBootFallback").onclick = () => lnFallbackSheet("");
  // If the connection comes back while this sheet is up, retry once
  // automatically — the download resumes from its kept progress.
  const onOnline = () => {
    window.removeEventListener("online", onOnline);
    if ($("lnBootRetry")) openLightningPanel();
  };
  window.addEventListener("online", onOnline);
}

async function openLightningPanel() {
  // Already running on the chosen network: go straight to the
  // panel and its plain "Your Fluid node is ready ✓" status — no
  // "Starting…" sheet flash that reads as if nothing existed.
  if (lnSession && lnSession.network === lnNetKey()) { paintLnPanel(); paintLnNodeStatus(); return; }
  openSheet(`<h3>${icon("bolt", "ic ic-brand")} Lightning</h3>
    <p class="tag" id="lnBootLine"><span class="spinner"></span> Starting your Lightning node… it runs entirely on your device, from your own seed. Nobody custodies your sats.</p>`);
  const line = (html) => { const el = $("lnBootLine"); if (el) el.innerHTML = html; };
  try {
    await lnEnsureSession(lnNetKey(), (stage, info) => {
      if (stage === "download") {
        const mb = (n) => (n / 1048576).toFixed(1);
        line(`<span class="spinner"></span> Downloading the node program: ${mb(info.downloadedBytes)} of ${mb(info.totalBytes)} MB${info.persisted ? " — kept on your phone as it arrives, so if the connection drops it continues where it stopped, even if you leave and come back." : " — this browser can't keep a download between visits, so stay on this screen until it finishes."} First time only; after that your node starts from the copy already on your phone.`);
      } else if (stage === "verify") line(`<span class="spinner"></span> Download complete — checking it against the app's fingerprint…`);
      else if (stage === "chain") line(`<span class="spinner"></span> Node program ready — reading the Bitcoin chain tip…`);
      else if (stage === "node") line(`<span class="spinner"></span> Starting your node…`);
    });
    paintLnPanel();
  } catch (e) {
    lnBootFailedSheet(e);
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

let lnAdvancedOpen = false;
function paintLnPanel() {
  const s = lnSession; if (!s) return;
  lnAutoConnect(s);
  const bal = s.balance();
  const chans = s.channels();
  const hist = s.history().slice(-8).reverse();
  const net = s.network;
  const peers = s.peerStatus();
  const relayDefault = s.defaultRelayUrl || "";
  const relayVal = relayDefault || localStorage.getItem("fluid_ln_relay") || "";
  const statusNow = lnStatusSnapshot();
  openSheet(`<div id="lnPanel"><h3>${icon("bolt", "ic ic-brand")} Lightning — your own node</h3>
    <p style="margin:8px 0 2px"><b>${esc(statusNow.headline)}</b></p>
    <p class="tag" style="margin:0 0 8px">${esc(statusNow.detail)}</p>
    <p class="tag">Node <span class="mono">${esc(s.nodeId.slice(0, 16))}…</span> · network:
      <select id="lnNetSel">
        <option value="bitcoin" ${net === "bitcoin" ? "selected" : ""}>Bitcoin mainnet</option>
        <option value="signet" ${net === "signet" ? "selected" : ""}>Signet (test coins)</option>
        <option value="testnet" ${net === "testnet" ? "selected" : ""}>Testnet (test coins)</option>
      </select></p>
    <p><b>Receiving room:</b> ${lnSats(bal.receivableMsat)} · <b>Sending room:</b> ${lnSats(bal.spendableMsat)}${bal.claimableOnchainSat ? ` · <b>Claimable on-chain:</b> ${Number(bal.claimableOnchainSat).toLocaleString()} sats` : ""}</p>
    ${lnEvents.length ? `<p class="tag">${lnEvents.map(lnEventLine).filter(Boolean).map(esc).join("<br>")}</p>` : ""}
    <h4>Pay</h4>
    <textarea id="lnTarget" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" data-autofocus rows="3" placeholder="lnbc… invoice, lno… offer, ₿name@domain, name@domain, or a Fluid name"></textarea>
    <input id="lnSatsIn" inputmode="numeric" placeholder="Sats (for offers / addresses / amountless invoices)">
    <div class="stickyfoot"><button class="btn" id="lnPayBtn">Pay with my node</button></div>
    <p class="msg err" id="lnPayMsg"></p>
    <h4>Receive</h4>
    <div id="lnAddrOut" class="lnAddrOut"></div>
    <input id="lnRcvSats" inputmode="numeric" placeholder="Sats (optional for the offer)">
    <input id="lnRcvDesc" placeholder="What is it for? (optional)">
    <button class="btn ghost" id="lnInvoiceBtn">New one-time invoice</button>
    <button class="btn ghost" id="lnOfferBtn">My reusable offer (my Lightning address)</button>
    <div id="lnRcvOut"></div>
    <h4>Buy receiving room</h4>
    <p class="tag">Pay Megalith once to open a channel to your node with the sats on their side — that side is your receiving room. The channel's sats sit on the provider's side; what you then receive into the room becomes yours to spend. ${lnChannelOpenSentence("your", prices.BTC)}</p>
    <p>
      <button class="btn ghost lnBuyPreset" data-sats="100000">100,000 sats</button>
      <button class="btn ghost lnBuyPreset" data-sats="500000">500,000 sats</button>
      <button class="btn ghost lnBuyPreset" data-sats="1000000">1,000,000 sats</button>
    </p>
    <div id="lnBuyOut"></div>
    <h4>Connections</h4>
    ${peers.length ? peers.map(p => `<p class="tag mono">${esc(p.pubkey.slice(0, 16))}… · ${esc(p.host)}:${p.port} · ${p.state === "connected" ? "connected" : p.state === "connecting" ? "connecting…" : "disconnected"}</p>`).join("") : `<p class="tag">No peers yet — your node reconnects to these automatically after every restart.</p>`}
    <h4>Channels (${chans.length})</h4>
    ${chans.length ? chans.map(c => `<p class="tag mono">${esc(String(c.counterparty).slice(0, 16))}… · ${Number(c.valueSat).toLocaleString()} sats · spend ${lnSats(c.outboundMsat)} / receive ${lnSats(c.inboundMsat)}${c.isUsable ? "" : " · not ready yet"}</p>`).join("") : `<p class="tag">No channels yet. Your first received payment can open one (see Receive above), or open one yourself under Advanced.</p>`}
    <div id="lnFundOut"></div>
    <h4>Receive while Fluid is closed</h4>
    <p class="tag">Not set up yet — this needs a holding peer that is always online. Fluid's own holding peer is on its way; for now, payments to your offer need Fluid open.</p>
    <div id="lnSisOut"></div>
    <h4>Wake-up notifications</h4>
    ${relayDefault ? `<p class="tag">Optional: Fluid's notification relay (holds no keys and no funds — see Tools in the project repo) pings your phone when a payment is waiting, so you can open Fluid and claim it.</p>
    <button class="btn ghost" id="lnWakeBtn">Enable wake-up notifications</button>
    <p class="msg" id="lnWakeMsg"></p>` : `<p class="tag">Wake-up notifications need Fluid's notification relay, which isn't live yet.</p>`}
    <details id="lnAdvanced" ${lnAdvancedOpen ? "open" : ""}>
      <summary><b>Advanced — connect to any peer</b></summary>
      <p class="tag">Connect to any Lightning peer — just connect, or connect and open a channel from your own on-chain Bitcoin. Connecting alone needs no Bitcoin and opens no channel; it is what lets your node build its offer and talk to that peer. Peers you connect to are remembered and reconnected automatically.</p>
      <input id="lnPeerKey" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" placeholder="Peer pubkey (66 hex chars)">
      <input id="lnPeerHost" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" placeholder="Peer host — wss://… endpoint, or host for your proxy">
      <input id="lnPeerPort" inputmode="numeric" placeholder="Port (e.g. 9735)">
      <input id="lnChanSats" inputmode="numeric" placeholder="Channel size in sats (open channel only)">
      <input id="lnProxy" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" placeholder="Optional WebSocket proxy template: wss://proxy.example/{host}/{port}" value="${esc(localStorage.getItem("fluid_ln_wsproxy") || s.defaultWsProxy || "")}">
      <button class="btn ghost" id="lnConnectBtn">Connect only — no channel</button>
      <button class="btn ghost" id="lnOpenBtn">Connect &amp; open channel</button>
      <p class="msg" id="lnChanMsg"></p>
      <p class="tag" style="margin-top:14px">Offline receive (manual): if a peer acts as your holding peer, ask it for blinded paths (the DripBot keeper provides them) and paste them here — Fluid builds your offline-receive offer from them. ${esc(holdWindowCopy(24))}</p>
      <textarea id="lnSisPaths" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" rows="2" placeholder='Blinded paths from your holding peer (JSON list)'></textarea>
      <button class="btn ghost" id="lnSisBtn">Use these paths &amp; show my offline offer</button>
      <p class="tag" style="margin-top:14px">Wake-up relay (self-hosted): a relay URL you run yourself. Holds no keys and no funds.</p>
      <input id="lnRelay" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" placeholder="Relay URL, e.g. https://relay.example.com" value="${esc(relayVal)}">
      <button class="btn ghost" id="lnWakeBtnAdv">Enable wake-up notifications via this relay</button>
      <p class="msg" id="lnWakeMsgAdv"></p>
    </details>
    ${hist.length ? `<h4>Recent payments</h4>${hist.map(h => `<p class="tag">${h.dir === "in" ? "+" : h.dir === "out" ? "−" : "failed "}${h.amountMsat ? lnSats(h.amountMsat) + " · " : ""}<span class="mono">${esc(String(h.paymentHash || "").slice(0, 12))}…</span></p>`).join("")}` : ""}
    <h4>Fallback</h4>
    <p class="tag">Prefer an external Lightning wallet? <button class="btn ghost" id="lnFallbackBtn">Pay via WebLN / LNURL instead</button></p>
    </div>`);
  $("lnNetSel").onchange = () => { localStorage.setItem("fluid_ln_network", $("lnNetSel").value); if (lnSession) { lnBridgeStopResponder(); lnSession.stopLoops(); lnSession = null; } openLightningPanel(); };
  $("lnPayBtn").onclick = lnPayWithNode;
  $("lnInvoiceBtn").onclick = () => lnShowReceive("invoice");
  $("lnOfferBtn").onclick = () => lnShowReceive("offer");
  $("lnSisBtn").onclick = lnSetupOfflineOffer;
  if ($("lnWakeBtn")) $("lnWakeBtn").onclick = () => lnEnableWakeUp(relayDefault);
  $("lnWakeBtnAdv").onclick = () => lnEnableWakeUp(($("lnRelay").value || "").trim());
  $("lnConnectBtn").onclick = lnConnectOnly;
  $("lnOpenBtn").onclick = lnOpenChannel;
  $("lnFallbackBtn").onclick = () => lnFallbackSheet("");
  $("lnAdvanced").addEventListener("toggle", (ev) => { lnAdvancedOpen = ev.target.open; });
  document.querySelectorAll(".lnBuyPreset").forEach((b) => { b.onclick = () => lnBuyRoom(Number(b.dataset.sats)); });
  // The event pump repaints this whole panel; the receive, buy and
  // offline-offer displays are state-driven, so repaint them from
  // their state — a rendered offer must never be wiped blank (F6).
  paintLnReceive();
  paintLnBuy();
  paintLnSis();
  paintLnAddress();
}

// First-receive warning state (owner Q&A, 2026-11-11): the
// "name:sats" pair the sender was last warned about, so the
// warning shows once per payment and the second tap sends.
let lnFirstReceiveWarnedFor = null;

// Canonical channel-opening sentence (owner's simple wording,
// 2026-11-11 refinement): the 2,500-sat requirement with a LIVE
// dollar equivalent, then the 1-sat floor for every later transfer.
// The dollar figure is computed at render time from the app's BTC
// price (btcUsd is the getPrices-fed prices.BTC, injected by the
// caller); when no price is loaded the parenthetical is omitted —
// never a stale hardcoded figure.
function lnChannelOpenSentence(whose, btcUsd) {
  const btc = Number(btcUsd);
  const usd = Number.isFinite(btc) && btc > 0 ? ` (about $${(2500 * btc / 1e8).toFixed(2)})` : "";
  return `Opening a channel on the Lightning Network requires 2,500 sats${usd}. After that, every transfer to ${whose} wallet can be as little as 1 sat.`;
}
function lnFirstReceiveWarning(sats) {
  const fmt = (n) => n.toLocaleString();
  if (sats >= 2502) {
    return `Before you send: if this is their first Lightning receive, this payment opens their channel, and Megalith takes a one-time 2,500 sats out of it for the opening — so ${fmt(sats - 2500)} of your ${fmt(sats)} sats would reach them. If they've received a payment before, the full ${fmt(sats)} sats lands and no fee is taken. ${lnChannelOpenSentence("their", prices.BTC)} Tap Pay again to send.`;
  }
  return `Before you send: if this is their first Lightning receive, this payment opens their channel, and Megalith takes a one-time 2,500 sats out of it for the opening — a payment of ${fmt(sats)} sats is too small to survive that: it either can't go through at all or leaves almost nothing behind. Send around 5,000 sats or more so a meaningful amount lands in that case. If they've received a payment before, the full ${fmt(sats)} sats lands and no fee is taken. ${lnChannelOpenSentence("their", prices.BTC)} Tap Pay again to send anyway, or raise the amount.`;
}

async function lnPayWithNode() {
  const target = $("lnTarget").value.trim();
  const sats = Number($("lnSatsIn").value) || 0;
  const msat = sats > 0 ? BigInt(Math.round(sats * 1000)) : null;
  if (!target) return msg("lnPayMsg", "Paste an invoice, offer, address or Fluid name first.");
  let paidMsat = msat;
  try {
    const kind = classifyLightningTarget(target).kind;
    // Pre-checks with plain answers (completion audit §5.2): a dead
    // connection or an over-room amount should say so up front, not
    // surface as a routing failure after the fact.
    const peers = lnSession.peerStatus();
    if (peers.length && !peers.some((p) => p.state === "connected")) {
      return msg("lnPayMsg", "Your node isn't connected right now — give it a few seconds after opening Fluid, then try again.");
    }
    let checkMsat = msat;
    if (kind === "bolt11") {
      try { const p = parseBolt11(target); if (p.amountMsat != null) checkMsat = BigInt(Math.round(Number(p.amountMsat))); } catch { /* the pay attempt reports a bad invoice */ }
    }
    if (checkMsat != null) {
      const spendable = Number(lnSession.balance().spendableMsat || 0);
      if (Number(checkMsat) > spendable) {
        return msg("lnPayMsg", `You don't have that much you can send — your sending room is ${Math.floor(spendable / 1000).toLocaleString()} sats.`);
      }
    }
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
      // Shape-aware (completion audit §5.6.1): the registry value's
      // SHAPE decides the path — a registered BOLT 12 offer is paid
      // as an offer through this node; a registered address goes
      // through LNURL-pay as before. (An offer-shaped value in the
      // old LNURL-only branch would have broken the payment.)
      const hit = await resolveFluidName(target).catch(() => null);
      const t = hit ? lightningTargetForNameEntry(hit) : null;
      if (!t) return msg("lnPayMsg", "That Fluid name has no Lightning address or node offer in the registry.");
      if (!msat) return msg("lnPayMsg", "Enter the sats amount for a name payment.");
      if (t.kind === "offer") {
        // First-receive honesty (owner Q&A, 2026-11-11): this
        // payment goes to the name's own Fluid node. If that node
        // has never received, the payment opens its first channel
        // through Megalith, whose live opening terms take a flat
        // 2,500 sats out of the payment — and a payment too close
        // to that fee can't land at all in that case. The sender
        // can't see the recipient's channels, so the warning is
        // worded for the case it might be; it shows once per
        // (name, amount) before anything is paid, and a second
        // tap sends. (A hosted address on the name is NOT this
        // case — that path's terms are the host's, below.)
        const warnKey = target.toLowerCase() + ":" + sats;
        if (lnFirstReceiveWarnedFor !== warnKey) {
          lnFirstReceiveWarnedFor = warnKey;
          return msg("lnPayMsg", lnFirstReceiveWarning(sats), true);
        }
        lnSession.payOffer(t.value, msat);
      } else {
        const invoice = await lightningInvoiceForAddress(t.value, sats);
        lnSession.payInvoice(invoice, null);
      }
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
  if (lnJitFlow) { paintLnJitFlow(out); return; }
  if (lnPartialState) { paintLnPartial(out); return; }
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
// --- Your Lightning address (owner directive, 2026-11-10) ---
// The panel's Receive section shows <name>@fluidwallet.dpdns.org
// and — truth over looks — calls it live ONLY when the published
// registry entry for the name actually carries this node's BOLT 12
// offer (lnLightningAddressState decides). Publishing rides the
// SAME signed-claim pipeline as the name card (submitNameClaim:
// EIP-191 claim → Nostr kind-30078 → processor → names.json) with
// the node's current offer as lnOffer, preserving any hosted
// address already on the entry. State-driven like the other
// receive displays: the panel's event pump repaints the whole
// panel, so everything renders from the state below (F6 rule).
let lnAddrView = { status: "idle" }; // idle | publishing | published | sent | failed{message}
let lnAddrEntry = undefined; // undefined = registry not read yet this panel session; null = no entry
let lnAddrOffer = undefined; // undefined = not built yet; null = the node couldn't build one
let lnAddrOfferSession = null;
let lnAddrPending = null; // { name, offer } — sent, registry hasn't shown it yet
let lnAddrFetching = false;
function lnAddrOfferNow() {
  if (!lnSession) return null;
  if (lnAddrOfferSession === lnSession && lnAddrOffer) return lnAddrOffer;
  // Only a SUCCESS is cached: a failure (no peer connected yet)
  // must be retried on the next paint, or a user who opens the
  // panel before connecting would never be offered Publish.
  try {
    const offer = lnSession.createOffer(null, "Fluid");
    lnAddrOffer = offer;
    lnAddrOfferSession = lnSession;
    return offer;
  } catch { return null; }
}
// Wait for the node's offer to exist, keeping the automatic peer
// connection topped up while waiting. The node builds its offer
// itself once a peer handshake lands (seconds, normally); the
// success is cached by lnAddrOfferNow, so every surface that asks
// afterwards — the name card's Register step and the Receive
// address block alike — works from the same offer. One wait, one
// source of truth.
async function lnAwaitOffer(timeoutMs = 60000) {
  if (!lnSession) return null;
  lnAutoConnect(lnSession);
  const t0 = Date.now();
  for (;;) {
    const offer = lnAddrOfferNow();
    if (offer) return offer;
    if (Date.now() - t0 >= timeoutMs) return null;
    lnAutoConnect(lnSession);
    await new Promise((r) => setTimeout(r, 1500));
  }
}
// While an address block is on screen with no offer yet, keep
// retrying in the background: the moment the offer lands, the
// block repaints with its Publish button — the user watches it
// arrive instead of hunting for the next step.
let lnAddrPollTimer = null;
function lnAddrEnsurePoll() {
  if (lnAddrPollTimer || !lnSession) return;
  let tries = 0;
  lnAddrPollTimer = setInterval(() => {
    tries++;
    if (!document.querySelector(".lnAddrOut") || !lnSession || tries > 40) {
      clearInterval(lnAddrPollTimer); lnAddrPollTimer = null; return;
    }
    lnAutoConnect(lnSession);
    if (lnAddrOfferNow()) { clearInterval(lnAddrPollTimer); lnAddrPollTimer = null; paintLnAddress(); }
  }, 2500);
}
async function lnAddrRefresh() {
  const name = localStorage.getItem("fluid_name");
  if (!name || lnAddrFetching) return;
  lnAddrFetching = true;
  try {
    const hit = await resolveFluidName(name).catch(() => null);
    lnAddrEntry = hit || null;
  } finally {
    lnAddrFetching = false;
    if (document.querySelector(".lnAddrOut")) paintLnAddress();
  }
}
// The address block lives on TWO surfaces — the Lightning
// panel's Receive section and the Receive sheet the asset view's
// Receive button opens — painted from the ONE state above
// (lnAddrView / lnAddrEntry / the session's cached offer), so the
// two can never disagree. Buttons are classes, bound per
// container; the panel instance also keeps the historical id.
function paintLnAddress() {
  document.querySelectorAll(".lnAddrOut").forEach((out) => paintLnAddressInto(out));
}
function paintLnAddressInto(out) {
  const name = localStorage.getItem("fluid_name");
  if (lnAddrView.status === "publishing") {
    out.innerHTML = `<p class="tag"><span class="spinner"></span> Publishing your Lightning address — signing the update and sending it to the registry…</p>`;
    return;
  }
  if (lnAddrView.status === "failed") {
    out.innerHTML = `<p class="msg err">${esc(lnAddrView.message)}</p>
      <button class="btn ghost lnAddrRetry">Try again</button>`;
    out.querySelector(".lnAddrRetry").onclick = () => { lnAddrView = { status: "idle" }; lnPublishAddress(); };
    return;
  }
  if (!name) {
    out.innerHTML = `<p class="tag"><b>Your Lightning address</b> is built from your Fluid name — like <span class="mono">you@fluidwallet.dpdns.org</span> — and people pay it to send you sats. You don't have a Fluid name yet: claim one first under <b>More tab → “Your Fluid name”</b>, then come back here and publish your address.</p>`;
    return;
  }
  if (lnAddrEntry === undefined) {
    out.innerHTML = `<p class="tag"><span class="spinner"></span> Checking the registry for your Lightning address…</p>`;
    lnAddrRefresh();
    return;
  }
  const current = lnAddrOfferNow();
  const st = lnLightningAddressState({
    name,
    registryOffer: lnAddrEntry ? lnAddrEntry.lnOffer : null,
    currentOffer: current,
    hostedLn: lnAddrEntry ? lnAddrEntry.ln : null,
  });
  const addrHtml = `<p class="tag" style="margin-bottom:2px">Your Lightning address:</p>
    <p class="mono" style="font-size:15px;margin:2px 0"><b>${esc(st.address)}</b></p>`;
  const copyShare = `
    <button class="btn ghost lnAddrCopy">Copy address</button>
    <button class="btn ghost lnAddrShare">Share</button>`;
  const bindCopyShare = () => {
    const cp = out.querySelector(".lnAddrCopy"), sh = out.querySelector(".lnAddrShare");
    if (cp) cp.onclick = () => copyText(st.address, cp);
    if (sh) sh.onclick = async () => {
      if (navigator.share) { try { await navigator.share({ title: "My Fluid Lightning address", text: st.address }); } catch { /* user closed the share sheet */ } }
      else copyText(st.address, sh);
    };
  };
  if (st.state === "live") {
    // Copy truth (2026-11-11): the payability claim is scoped to
    // Fluid — outside wallets cannot resolve a Fluid address until
    // the LNURL bridge ships AND its external proof passes.
    // Restore the unscoped "anyone can pay it" wording then.
    out.innerHTML = `${addrHtml}
      <p class="tag"><b>✓ Live</b> — the registry carries your node's offer under this address, so anyone in Fluid can pay it to send you sats. Payments come to your own node inside this app; Fluid must be open on this device when you're paid.${lnAddrView.status === "published" ? " <b>Published ✓ — just confirmed in the registry.</b>" : ""}</p>
      <p>${copyShare}</p>
      ${lnBridgeBlockHtml()}`;
    bindCopyShare();
    bindLnBridge(out);
    return;
  }
  if (st.state === "update-available") {
    out.innerHTML = `${addrHtml}
      <p class="tag"><b>✓ Live</b> — but your node has a newer offer than the one published under this address. Update it so payments keep coming to this node.</p>
      <p><button class="btn lnAddrPublish">${esc(st.publishLabel)}</button></p>
      <p>${copyShare}</p>
      ${lnBridgeBlockHtml()}`;
    out.querySelector(".lnAddrPublish").onclick = () => lnPublishAddress();
    bindCopyShare();
    bindLnBridge(out);
    return;
  }
  // not-published: the address is shown, but plainly NOT live —
  // never present an address that resolves to nothing as usable.
  // The offer is the node's to build, and building it needs a peer
  // connection — which the app makes itself (lnAutoConnect). The
  // states below are the ONE truth per moment: publish when the
  // offer exists; a start button when the node isn't running; a
  // plain "connecting — it happens on its own" while the offer is
  // on its way, with the background poll armed so the Publish
  // button replaces it the moment the offer lands. No state ever
  // sends the user into Advanced to connect a peer by hand.
  let actionHtml;
  if (current) {
    actionHtml = `<p><button class="btn lnAddrPublish">${esc(st.publishLabel)}</button></p>`;
  } else if (!lnSession) {
    actionHtml = `<p class="tag">Your Lightning node isn't running right now — it builds the offer this address publishes. Start it and the publish button appears here.</p>
    <p><button class="btn ghost lnAddrOpenNode">Start my Fluid node</button></p>`;
  } else {
    actionHtml = `<p class="tag">Your node is connecting to the Lightning network so it can build its offer — that happens on its own and takes a few seconds. The publish button appears here the moment the offer is ready; you don't need to do anything.</p>`;
    lnAddrEnsurePoll();
  }
  out.innerHTML = `${addrHtml}
    <p class="tag"><b>Not live yet</b> — nothing is published under this address, so it can't receive anything yet. Publish it and your node's offer is registered under this address through the same signed claim that published your name.${st.hostedLn ? " (A hosted address is registered to your name; publishing adds your own node's offer alongside it.)" : ""}</p>
    ${lnAddrView.status === "sent" ? `<p class="tag">Your signed update was sent, but the registry doesn't show it yet — claims usually appear within a few minutes.</p>
    <p><button class="btn ghost lnAddrCheck">Check the registry again</button></p>` : ""}
    ${actionHtml}`;
  const pub = out.querySelector(".lnAddrPublish"); if (pub) pub.onclick = () => lnPublishAddress();
  const chk = out.querySelector(".lnAddrCheck"); if (chk) chk.onclick = () => lnAddrCheckAgain();
  const opn = out.querySelector(".lnAddrOpenNode"); if (opn) opn.onclick = () => openLightningPanel();
}
async function lnAddrCheckAgain() {
  if (!lnAddrPending) { lnAddrRefresh(); return; }
  const hit = await resolveFluidName(lnAddrPending.name).catch(() => null);
  if (hit && hit.lnOffer && lnAddrPending.offer
    && String(hit.lnOffer).trim().toLowerCase() === String(lnAddrPending.offer).trim().toLowerCase()) {
    lnAddrEntry = hit;
    lnAddrPending = null;
    lnAddrView = { status: "published" };
  }
  if (document.querySelector(".lnAddrOut")) paintLnAddress();
}
async function lnPublishAddress() {
  const name = localStorage.getItem("fluid_name");
  if (!name || !lnSession) return;
  // The publish button only renders once an offer exists, but the
  // session may have dropped its connection since the paint —
  // give the automatic connection a chance to land the offer
  // before declaring anything, and never point the user at
  // Advanced as the remedy.
  let offer = lnAddrOfferNow();
  if (!offer) offer = await lnAwaitOffer(30000);
  if (!offer) {
    lnAddrView = { status: "failed", message: "Your node couldn't build its offer yet — it's still connecting to the Lightning network. Check your internet connection, give it a few seconds, then try again." };
    paintLnAddress();
    return;
  }
  lnAddrView = { status: "publishing" };
  paintLnAddress();
  try {
    const hit = await resolveFluidName(name).catch(() => null);
    if (hit && hit.evm && wallet && String(hit.evm).toLowerCase() !== String(wallet.address).toLowerCase()) {
      throw new Error("That name is registered to a different wallet — this wallet can't publish a Lightning address for it.");
    }
    lnAddrEntry = hit || null;
    const keepLn = hit && hit.ln ? hit.ln : null;
    const n = await submitNameClaim(name, keepLn, offer);
    if (n === 0) {
      // Held claim: a defined state, NOT a publication — the offer
      // publishes together with the name when the name goes live.
      lnAddrView = { status: "failed", message: "Your node's offer was saved into the claim held on this device — it publishes together with your name when the name goes live. It is not in the registry yet, so the address isn't live." };
      paintLnAddress();
      return;
    }
    // Sent is not published: verify against the registry itself,
    // polling like the creation wait sheet, and say which it is.
    let verified = null;
    for (let i = 0; i < 9 && !verified; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      const check = await resolveFluidName(name).catch(() => null);
      if (check && check.lnOffer && String(check.lnOffer).trim().toLowerCase() === offer.trim().toLowerCase()) verified = check;
    }
    if (verified) {
      lnAddrEntry = verified;
      lnAddrPending = null;
      lnAddrView = { status: "published" };
    } else {
      lnAddrPending = { name, offer };
      lnAddrView = { status: "sent" };
    }
    paintLnAddress();
  } catch (e) {
    lnAddrView = { status: "failed", message: "Couldn't publish your Lightning address: " + lnErrorText(e) };
    paintLnAddress();
  }
}

// --- External payments (LNURL-pay bridge, owner directive 2026-11-11) ---
// Turning this on makes the published address payable from OTHER
// Lightning wallets (Wallet of Satoshi, Blink, Phoenix, ...), not
// just inside Fluid: the wallet registers with the bridge service
// as the invoice-minter for its name (NWC make_invoice only — the
// bridge can ask for invoices, never move funds), then republishes
// its name claim with lnBridge: true; the name-claims processor
// sees the flag and serves the step-1 file other wallets resolve.
// The block is presented as ON only when the registry itself shows
// the flag — the same confirm discipline as the offer publish —
// and payments still land on the user's own node, which must be
// open when they're paid (the responder below is what answers).
let lnBridgeView = { status: "idle" }; // idle | working{label} | sent | failed{message}
let lnBridgeResponder = null;
function lnBridgeBlockHtml() {
  const name = localStorage.getItem("fluid_name");
  if (!name || !wallet) return "";
  if (lnBridgeView.status === "working") {
    return `<p class="tag"><span class="spinner"></span> ${esc(lnBridgeView.label || "Working…")}</p>`;
  }
  const deviceState = loadLnBridgeState(wallet.address);
  const registryOn = !!(lnAddrEntry && lnAddrEntry.lnBridge === true);
  let inner;
  if (registryOn) {
    inner = `<p class="tag"><b>✓ Also payable from other wallets</b> — Wallet of Satoshi, Blink, Phoenix and other Lightning wallets can pay this address too. Payments come to your own node inside this app; Fluid must be open on this device when you're paid.</p>
      <p><button class="btn ghost lnBridgeOff">Turn off external payments</button></p>`;
  } else if (deviceState) {
    inner = `<p class="tag">External payments are registered on this device, but the registry doesn't show them yet — claims usually appear within a few minutes.</p>
      <p><button class="btn ghost lnBridgeOn">Finish turning on external payments</button> <button class="btn ghost lnBridgeOff">Turn off external payments</button></p>`;
  } else {
    inner = `<p class="tag"><b>Also payable from other wallets</b> — turn this on and Wallet of Satoshi, Blink, Phoenix and other Lightning wallets can pay this address too, not just Fluid users. Payments still come to your own node, and Fluid must be open on this device when you're paid — the same as now.</p>
      <p><button class="btn ghost lnBridgeOn">Make this address payable from other wallets</button></p>`;
  }
  if (lnBridgeView.status === "sent") inner += `<p class="tag">Your signed update was sent, but the registry doesn't show it yet — claims usually appear within a few minutes. Reopen this panel to check.</p>`;
  if (lnBridgeView.status === "failed") inner += `<p class="msg err">${esc(lnBridgeView.message)}</p>`;
  return inner;
}
function bindLnBridge(out) {
  const on = out.querySelector(".lnBridgeOn"); if (on) on.onclick = () => lnBridgeEnable();
  const off = out.querySelector(".lnBridgeOff"); if (off) off.onclick = () => lnBridgeDisable();
}
async function lnBridgeEnable() {
  const name = localStorage.getItem("fluid_name");
  if (!name || !wallet) return;
  lnBridgeView = { status: "working", label: "Registering this wallet with the bridge…" };
  paintLnAddress();
  try {
    await registerLnBridge({
      name, evm: wallet.address, phrase: wallet.mnemonic.phrase,
      signMessage: (m) => wallet.signMessage(m),
    });
    lnBridgeView = { status: "working", label: "Registered — publishing the update to the registry…" };
    paintLnAddress();
    const keepLn = lnAddrEntry && lnAddrEntry.ln ? lnAddrEntry.ln : null;
    const n = await submitNameClaim(name, keepLn, lnAddrOfferNow(), true);
    if (n === 0) {
      lnBridgeView = { status: "failed", message: "This device is registered with the bridge, but the signed update couldn't reach the relays, so the registry doesn't show external payments yet — the update is saved on this device. Try again in a moment." };
      paintLnAddress();
      return;
    }
    // Sent is not on: verify against the registry itself, polling
    // like the address publish, and say which it is.
    let verified = null;
    for (let i = 0; i < 9 && !verified; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      const check = await resolveFluidName(name).catch(() => null);
      if (check && check.lnBridge === true) verified = check;
    }
    if (verified) {
      lnAddrEntry = verified;
      lnBridgeView = { status: "idle" };
      lnBridgeSyncResponder();
    } else {
      lnBridgeView = { status: "sent" };
    }
    paintLnAddress();
  } catch (e) {
    lnBridgeView = { status: "failed", message: "Couldn't turn on external payments: " + lnErrorText(e) };
    paintLnAddress();
  }
}
async function lnBridgeDisable() {
  const name = localStorage.getItem("fluid_name");
  if (!name || !wallet) return;
  lnBridgeView = { status: "working", label: "Turning off external payments…" };
  paintLnAddress();
  try {
    // unregisterLnBridge clears this device's state even when the
    // bridge service can't be reached; withdrawing the registry
    // flag below is what removes the step-1 file other wallets
    // resolve, and that is the withdrawal that stops payments.
    try {
      await unregisterLnBridge({ name, evm: wallet.address, signMessage: (m) => wallet.signMessage(m) });
    } catch { /* local state is already cleared; the republish proceeds */ }
    lnBridgeStopResponder();
    const keepLn = lnAddrEntry && lnAddrEntry.ln ? lnAddrEntry.ln : null;
    const n = await submitNameClaim(name, keepLn, lnAddrOfferNow(), false);
    if (n === 0) {
      lnBridgeView = { status: "failed", message: "External payments are off on this device, but the signed update couldn't reach the relays — the registry may still show them on until the update publishes. Try again in a moment." };
      paintLnAddress();
      return;
    }
    let verified = null;
    for (let i = 0; i < 9 && !verified; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      const check = await resolveFluidName(name).catch(() => null);
      if (check && check.lnBridge !== true) verified = check;
    }
    if (verified) {
      lnAddrEntry = verified;
      lnBridgeView = { status: "idle" };
    } else {
      lnBridgeView = { status: "sent" };
    }
    paintLnAddress();
  } catch (e) {
    lnBridgeView = { status: "failed", message: "Couldn't turn off external payments: " + lnErrorText(e) };
    paintLnAddress();
  }
}
// The responder: while the wallet is unlocked, the node is running
// and this device holds a bridge registration, answer the bridge's
// make_invoice requests by minting with the wallet's own node.
function lnBridgeStopResponder() {
  if (lnBridgeResponder) { try { lnBridgeResponder.stop(); } catch { /* already gone */ } lnBridgeResponder = null; }
}
function lnBridgeSyncResponder() {
  lnBridgeStopResponder();
  if (!wallet || !lnSession || lnSession.network !== "bitcoin") return;
  const st = loadLnBridgeState(wallet.address);
  if (!st || !st.clientPub) return;
  try {
    lnBridgeResponder = startLnBridgeResponder({
      phrase: wallet.mnemonic.phrase,
      clientPubHex: st.clientPub,
      mintInvoice: lnBridgeMintInvoice,
    });
  } catch { lnBridgeResponder = null; }
}
async function lnBridgeMintInvoice({ amountMsat, descriptionHashHex }) {
  if (!wallet || !lnSession || lnSession.network !== "bitcoin") throw new Error("This wallet's node is not running.");
  const bal = lnSession.balance();
  const plan = lnReceivePlan({
    receivableMsat: Number(bal.receivableMsat || 0),
    requestedMsat: amountMsat,
    hasLsp: !!lnSession.lsp,
  });
  if (plan.kind === "need-channel") throw new Error("This wallet can't receive yet — it has no channel with room in it.");
  if (plan.kind === "need-amount") throw new Error("An amount is required for this wallet's first receive.");
  if (plan.kind === "invoice") {
    // A partial plan would mint an invoice for more than the
    // channels can receive — refuse honestly; the payer's wallet
    // shows the refusal instead of attempting a broken payment.
    if (plan.partial) throw new Error("That amount is more than this wallet can receive right now.");
    return lnSession.createInvoiceDescHash(amountMsat, descriptionHashHex);
  }
  return lnBridgeMintJitInvoice(amountMsat, descriptionHashHex);
}
async function lnBridgeMintJitInvoice(amountMsat, descriptionHashHex) {
  const lsp = lnSession.lsp;
  try { lnSession.connectPeer(lsp.pubkey, lsp.host, lsp.port); } catch { /* already live or dial in flight */ }
  const rid = lnSession.lsps2RequestParams(lsp.pubkey, lsp.token);
  const ev = await lnWaitEvent("lsps2_params_ready", { match: (e) => e.requestId === rid });
  const menu = (ev.menu || []).map((p, i) => ({ ...p, i, feeMsat: lnLsps2OpeningFeeMsat(amountMsat, p) }))
    .filter((p) => amountMsat >= Number(p.minPaymentSizeMsat || 0) && amountMsat <= Number(p.maxPaymentSizeMsat || Infinity))
    .sort((x, y) => x.feeMsat - y.feeMsat);
  if (!menu.length) throw new Error("The channel provider can't open a channel for that amount.");
  const chosen = menu[0];
  const untilMs = Date.parse(chosen.validUntil) || (Date.now() + 3600000);
  const expirySecs = Math.max(120, Math.min(3600, Math.floor((untilMs - Date.now()) / 1000) - 60));
  const buyRid = lnSession.lsps2SelectParams(rid, chosen.i, amountMsat);
  const ip = await lnWaitEvent("lsps2_invoice_params", { match: (e) => e.requestId === buyRid });
  const invoice = lnSession.createInvoiceJitDescHash(amountMsat, descriptionHashHex, expirySecs, lsp.pubkey, ip.interceptScid, ip.cltvExpiryDelta);
  // The same gate record the Receive sheet keeps (audit §5.4), so
  // a bridge-minted JIT invoice is recognised as ours-to-receive.
  try {
    const parsed = parseBolt11(invoice);
    if (parsed && parsed.paymentHash) lnStoreJitRecord(parsed.paymentHash, ip.interceptScid, chosen.maxPaymentSizeMsat);
  } catch { /* the invoice still stands; the gate just won't special-case it */ }
  return invoice;
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
  lnJitFlow = null;
  lnPartialState = null;
  const sats = Number($("lnRcvSats").value) || 0;
  const desc = $("lnRcvDesc").value.trim() || "Fluid payment";
  const bal = lnSession.balance();
  // P1-15 (completion audit §5.3): the plan decides what may render.
  // At receivable 0 NO invoice or offer is produced anywhere — the
  // node would mint an artifact nobody can pay.
  const plan = lnReceivePlan({
    receivableMsat: Number(bal.receivableMsat || 0),
    requestedMsat: sats > 0 ? Math.round(sats * 1000) : null,
    hasLsp: !!lnSession.lsp,
  });
  if (plan.kind === "need-channel") {
    lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "failure", error: new Error("Your node can't receive yet — it has no channel with room in it. A channel with room is what lets sats arrive.") });
    paintLnReceive();
    return;
  }
  if (plan.kind === "need-amount") {
    lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "failure", error: new Error("Enter an amount for your first receive — the first payment opens your channel, so it has to name the amount.") });
    paintLnReceive();
    return;
  }
  if (plan.kind === "jit") {
    lnStartJitReceive(Math.round(sats * 1000), desc);
    return;
  }
  if (plan.kind === "invoice" && plan.partial) {
    lnPartialState = { requestedMsat: plan.requestedMsat, receivableMsat: plan.receivableMsat };
    paintLnReceive();
    return;
  }
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

// The receivable-0-with-room-elsewhere state (audit §5.3, verbatim
// numbers): offer the largest invoice the channels CAN receive, or
// the path to more room — never the unpayable full amount.
let lnPartialState = null;
function paintLnPartial(out) {
  const x = Math.floor(lnPartialState.requestedMsat / 1000);
  const y = Math.floor(lnPartialState.receivableMsat / 1000);
  out.innerHTML = `<p class="msg err">This invoice asks for ${x.toLocaleString()} sats, but your channels can only receive ${y.toLocaleString()} sats right now. Whoever pays it can send at most ${y.toLocaleString()}.</p>
    <button class="btn ghost" id="lnPartialBtn">Receive ${y.toLocaleString()} instead</button>
    <button class="btn ghost" id="lnPartialMore">Get more receiving room</button>`;
  $("lnPartialBtn").onclick = () => {
    lnPartialState = null;
    if ($("lnRcvSats")) $("lnRcvSats").value = String(y);
    lnShowReceive("invoice");
  };
  $("lnPartialMore").onclick = () => {
    lnPartialState = null;
    paintLnPanel();
    const el = document.querySelector(".lnBuyPreset");
    if (el) el.scrollIntoView({ block: "center" });
  };
}

// --- LSPS2 just-in-time receive (Phase 1) ---------------------------
// State lives outside the DOM for the same F6 reason as the receive
// display: the event pump repaints the panel and must find the flow
// exactly where it was.
let lnJitFlow = null; // { stage, amountMsat, desc, menu, chosen, feeMsat, error }

function paintLnJitFlow(out) {
  const f = lnJitFlow;
  if (f.stage === "params" || f.stage === "buying") {
    out.innerHTML = `<p class="tag"><span class="spinner"></span> ${f.stage === "params" ? "Asking Megalith for its channel-opening terms…" : "Opening your channel and building the invoice…"}</p>`;
    return;
  }
  if (f.stage === "failed") {
    out.innerHTML = `<p class="msg err">${esc(f.error || "The channel opening failed.")}</p>
      <button class="btn ghost" id="lnJitRetry">Try again</button>`;
    $("lnJitRetry").onclick = () => lnShowReceive("invoice");
    return;
  }
  // stage === "review": the fee disclosure, verbatim shape, BEFORE
  // anything is bought or shown as payable.
  const a = Math.floor(f.amountMsat / 1000);
  const fee = Math.max(1, Math.round(f.feeMsat / 1000));
  const landed = a - fee;
  out.innerHTML = `<p>Your first payment opens your channel. The provider (Megalith) takes ${fee.toLocaleString()} sats of this ${a.toLocaleString()}-sat payment for opening it, so ${landed.toLocaleString()} sats land in your wallet. ${lnChannelOpenSentence("your", prices.BTC)} Keep Fluid open until the payment lands.</p>
    <button class="btn" id="lnJitGo">Show my invoice</button>
    <button class="btn ghost" id="lnJitCancel">Cancel</button>`;
  $("lnJitGo").onclick = () => lnConfirmJitReceive();
  $("lnJitCancel").onclick = () => { lnJitFlow = null; paintLnReceive(); };
}

async function lnStartJitReceive(amountMsat, desc) {
  const lsp = lnSession.lsp;
  lnJitFlow = { stage: "params", amountMsat, desc };
  paintLnReceive();
  try {
    // The LSP peer must be connected for the negotiation; this also
    // records it in the peer book so it reconnects after restarts.
    try { lnSession.connectPeer(lsp.pubkey, lsp.host, lsp.port); } catch { /* already live or dial in flight */ }
    const rid = lnSession.lsps2RequestParams(lsp.pubkey, lsp.token);
    const ev = await lnWaitEvent("lsps2_params_ready", { match: (e) => e.requestId === rid });
    const menu = (ev.menu || []).map((p, i) => ({ ...p, i, feeMsat: lnLsps2OpeningFeeMsat(amountMsat, p) }))
      .filter((p) => amountMsat >= Number(p.minPaymentSizeMsat || 0) && amountMsat <= Number(p.maxPaymentSizeMsat || Infinity))
      .sort((x, y) => x.feeMsat - y.feeMsat);
    if (!menu.length) {
      const all = ev.menu || [];
      const lo = all.length ? Math.ceil(Math.min(...all.map((p) => Number(p.minPaymentSizeMsat || 0))) / 1000) : 0;
      const hi = all.length ? Math.floor(Math.max(...all.map((p) => Number(p.maxPaymentSizeMsat || 0))) / 1000) : 0;
      lnJitFlow = { stage: "failed", amountMsat, desc, error: `Megalith can't open a channel for that amount — its range is ${lo.toLocaleString()} to ${hi.toLocaleString()} sats.` };
      paintLnReceive();
      return;
    }
    lnJitFlow = { stage: "review", amountMsat, desc, menu, chosen: menu[0], feeMsat: menu[0].feeMsat, requestId: rid };
    paintLnReceive();
  } catch (e) {
    lnJitFlow = { stage: "failed", amountMsat, desc, error: lnErrorText(e) };
    paintLnReceive();
  }
}

async function lnConfirmJitReceive() {
  const f = lnJitFlow; if (!f || f.stage !== "review") return;
  const lsp = lnSession.lsp;
  const chosen = f.chosen;
  lnJitFlow = { ...f, stage: "buying" };
  paintLnReceive();
  try {
    // Invoice expiry must end before the negotiated terms do.
    const untilMs = Date.parse(chosen.validUntil) || (Date.now() + 3600000);
    const expirySecs = Math.max(120, Math.min(3600, Math.floor((untilMs - Date.now()) / 1000) - 60));
    const buyRid = lnSession.lsps2SelectParams(f.requestId, chosen.i, f.amountMsat);
    const ip = await lnWaitEvent("lsps2_invoice_params", { match: (e) => e.requestId === buyRid });
    const invoice = lnSession.createInvoiceJit(f.amountMsat, f.desc, expirySecs, lsp.pubkey, ip.interceptScid, ip.cltvExpiryDelta);
    // The Satora gate recognises this invoice as ours-to-receive
    // ONLY through this local record (completion audit §5.4).
    try {
      const parsed = parseBolt11(invoice);
      if (parsed && parsed.paymentHash) lnStoreJitRecord(parsed.paymentHash, ip.interceptScid, chosen.maxPaymentSizeMsat);
    } catch { /* the invoice still renders; the gate just won't special-case it */ }
    lnJitFlow = null;
    lnReceiveState = lnReceiveTransition(lnReceiveState, { type: "success", text: invoice });
    paintLnReceive();
  } catch (e) {
    lnJitFlow = { stage: "failed", amountMsat: f.amountMsat, desc: f.desc, error: lnErrorText(e) };
    paintLnReceive();
  }
}

// JIT gate records (audit §5.4): { paymentHash -> { scid, maxMsat } }
// plus the LSP they belong to. Payment hashes and SCIDs are routing
// data the invoice itself reveals — not secrets — so they live in
// plain localStorage, capped at the last 50.
const LN_JIT_RECORDS_KEY = "fluid_ln_jit_records";
function lnLoadJitRecords() {
  try {
    const j = JSON.parse(localStorage.getItem(LN_JIT_RECORDS_KEY) || "{}");
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}
function lnStoreJitRecord(paymentHash, scid, maxPaymentMsat) {
  const all = lnLoadJitRecords();
  all[String(paymentHash).toLowerCase()] = { scid: String(scid), maxPaymentMsat: String(maxPaymentMsat || ""), lsp: lnSession ? lnSession.lsp.pubkey : "" };
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete all[k];
  try { localStorage.setItem(LN_JIT_RECORDS_KEY, JSON.stringify(all)); } catch { /* full/blocked storage: gate falls back to today's rule */ }
}
// The gate context for one destination invoice: the records map plus
// THIS invoice's negotiated maximum (the gate wants a scalar).
function lnJitGateContext(parsed) {
  if (!parsed || !parsed.paymentHash || !lnSession || !lnSession.lsp) return null;
  const all = lnLoadJitRecords();
  const rec = all[String(parsed.paymentHash).toLowerCase()];
  if (!rec) return null;
  const interceptScids = {};
  for (const [h, r] of Object.entries(all)) interceptScids[h] = r.scid;
  return { lspPubkey: lnSession.lsp.pubkey, interceptScids, maxPaymentMsat: rec.maxPaymentMsat || "0" };
}

// --- LSPS1 buy receiving room (Phase 1) -----------------------------
let lnBuyState = { status: "idle" };
function paintLnBuy() {
  const out = $("lnBuyOut"); if (!out) return;
  const b = lnBuyState;
  if (b.status === "idle") { out.innerHTML = ""; return; }
  if (b.status === "working") { out.innerHTML = `<p class="tag"><span class="spinner"></span> ${esc(b.note || "Talking to Megalith…")}</p>`; return; }
  if (b.status === "failed") { out.innerHTML = `<p class="msg err">${esc(b.error || "The order failed.")}</p>`; return; }
  if (b.status === "order") {
    const o = b.order;
    const bolt11 = o.payment && o.payment.bolt11 ? o.payment.bolt11 : null;
    const onchain = o.payment && o.payment.onchain ? o.payment.onchain : null;
    const totalSat = bolt11 ? Number(bolt11.orderTotalSat) : onchain ? Number(onchain.orderTotalSat) : 0;
    const feeSat = bolt11 ? Number(bolt11.feeTotalSat) : onchain ? Number(onchain.feeTotalSat) : 0;
    let html = `<p>Order placed: ${Number(o.lspBalanceSat || b.sats).toLocaleString()} sats of receiving room. Total to pay: <b>${totalSat.toLocaleString()} sats</b>${feeSat ? ` (includes a ${feeSat.toLocaleString()} sat provider fee)` : ""}. The channel's sats sit on the provider's side — they are your receiving room, not your balance.</p>`;
    if (bolt11) {
      html += `<p class="mono">${esc(bolt11.invoice)}</p>
        <button class="btn ghost" id="lnBuyCopyInv">Copy payment invoice</button>
        ${lnSession.balance().spendableMsat >= totalSat * 1000 ? `<button class="btn" id="lnBuyPayNode">Pay from my node</button>` : `<p class="tag">Your node's sending room doesn't cover this — pay the invoice from any other Lightning wallet, or pay on-chain below if offered.</p>`}`;
    }
    if (onchain) {
      html += `<p class="tag">Pay on-chain instead: send exactly <b>${Number(onchain.orderTotalSat).toLocaleString()} sats</b> to <span class="mono">${esc(onchain.address)}</span></p>
        <button class="btn ghost" id="lnBuyPayBtc">Pay from my Bitcoin</button>`;
    }
    html += `<p class="msg" id="lnBuyMsg"></p>`;
    out.innerHTML = html;
    if ($("lnBuyCopyInv")) $("lnBuyCopyInv").onclick = () => copyText(bolt11.invoice, $("lnBuyCopyInv"));
    if ($("lnBuyPayNode")) $("lnBuyPayNode").onclick = async () => {
      try {
        lnSession.payInvoice(bolt11.invoice, null);
        msg("lnBuyMsg", "Paid ✓ Watching for your new channel…", true);
        lnWatchBuyOrder();
      } catch (e) { msg("lnBuyMsg", "Payment failed: " + lnErrorText(e)); }
    };
    if ($("lnBuyPayBtc")) $("lnBuyPayBtc").onclick = () => lnBuyPayOnchain(onchain);
    return;
  }
  if (b.status === "funded") {
    out.innerHTML = `<p class="msg">Your channel is open ✓ Your receiving room is updated above.</p>`;
    return;
  }
  out.innerHTML = "";
}

async function lnBuyRoom(sats) {
  const lsp = lnSession.lsp;
  lnBuyState = { status: "working", sats, note: "Asking Megalith what receiving room it can sell…" };
  paintLnBuy();
  try {
    try { lnSession.connectPeer(lsp.pubkey, lsp.host, lsp.port); } catch { /* already live or dial in flight */ }
    const rid = lnSession.lsps1RequestOptions(lsp.pubkey);
    const opts = await lnWaitEvent("lsps1_options", { match: (e) => e.requestId === rid });
    const o = opts.options || {};
    if (sats < Math.ceil(Number(o.minInitialLspBalanceSat || 0)) || sats > Math.floor(Number(o.maxInitialLspBalanceSat || Infinity))) {
      lnBuyState = { status: "failed", error: `Megalith sells receiving room between ${Number(o.minInitialLspBalanceSat || 0).toLocaleString()} and ${Number(o.maxInitialLspBalanceSat || 0).toLocaleString()} sats — ${sats.toLocaleString()} is outside that range.` };
      paintLnBuy();
      return;
    }
    lnBuyState = { status: "working", sats, note: "Placing the order…" };
    paintLnBuy();
    lnSession.lsps1CreateOrder(lsp.pubkey, sats);
    const orderEv = await lnWaitEvent("lsps1_order", { failTypes: ["lsps1_failed"] });
    lnBuyState = { status: "order", sats, order: orderEv };
    paintLnBuy();
    lnWatchBuyOrder();
  } catch (e) {
    lnBuyState = { status: "failed", error: lnErrorText(e) };
    paintLnBuy();
  }
}

// After an order exists (whichever way it gets paid), poll its status
// until the channel is funded, then repaint so the room shows.
let lnBuyWatchTimer = null;
function lnWatchBuyOrder() {
  if (lnBuyWatchTimer || !lnBuyState.order) return;
  const orderId = lnBuyState.order.orderId;
  const lsp = lnSession.lsp;
  let rounds = 0;
  lnBuyWatchTimer = setInterval(async () => {
    rounds++;
    if (rounds > 40 || !$("lnBuyOut") || !lnSession) { clearInterval(lnBuyWatchTimer); lnBuyWatchTimer = null; return; }
    try {
      lnSession.lsps1CheckOrder(lsp.pubkey, orderId);
      const ev = await lnWaitEvent("lsps1_order_status", { timeoutMs: 8000, match: (e) => e.orderId === orderId, failTypes: [] }).catch(() => null);
      if (ev && ev.channelFunded) {
        clearInterval(lnBuyWatchTimer); lnBuyWatchTimer = null;
        lnBuyState = { status: "funded", sats: lnBuyState.sats };
        paintLnPanel();
      }
    } catch { /* next round */ }
  }, 15000);
}

async function lnBuyPayOnchain(onchain) {
  const out = $("lnBuyOut"); if (!out) return;
  try {
    const sats = Number(onchain.orderTotalSat);
    const to = onchain.address;
    const plan = await planBitcoinSend(wallet.mnemonic.phrase, { to, amountBtc: sats / 1e8 });
    if (!plan || !plan.hex) throw new Error("Couldn't build the Bitcoin payment — check your Bitcoin balance covers it plus the network fee.");
    out.innerHTML = `<p class="tag">Pay for your receiving room: send exactly <b>${sats.toLocaleString()} sats</b> to <span class="mono">${esc(to)}</span>. Network fee: ${plan.feeSat} sats.</p>
      <button class="btn" id="lnBuyBtcBtn">Pay ${sats.toLocaleString()} sats + ${plan.feeSat} fee</button>
      <p class="msg" id="lnBuyMsg"></p>`;
    $("lnBuyBtcBtn").onclick = async () => {
      try {
        msg("lnBuyMsg", "Broadcasting the payment…", true);
        const txid = await broadcastBitcoinTx(plan.hex);
        msg("lnBuyMsg", "Bitcoin payment sent ✓ (" + String(txid).slice(0, 16) + "…) Watching for your new channel…", true);
        lnWatchBuyOrder();
      } catch (e) { msg("lnBuyMsg", "Payment failed: " + lnErrorText(e)); }
    };
  } catch (e) { msg("lnBuyMsg", "Bitcoin payment failed: " + lnErrorText(e)); }
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

async function lnEnableWakeUp(relayUrl) {
  const msgId = relayUrl && lnSession && relayUrl === lnSession.defaultRelayUrl ? "lnWakeMsg" : "lnWakeMsgAdv";
  try {
    const url = String(relayUrl || "").trim();
    if (!url) return msg(msgId, "Enter the relay URL first.");
    localStorage.setItem("fluid_ln_relay", url);
    const chunk = await lnLoadChunk();
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("sw.js").catch(() => { throw new Error("Service worker registration failed — wake-ups need the hosted build."); });
    }
    const { webhookUrl } = await chunk.subscribeWakeUp({ relayUrl: url, nodeId: lnSession.nodeId });
    msg(msgId, "Wake-ups on ✓ Give this webhook URL to your holding peer: " + webhookUrl, true);
  } catch (e) { msg(msgId, lnErrorText(e)); }
}

// Connect to a peer WITHOUT opening a channel (audit batch 4,
// F3): the name-card explainer sends users here to "connect to a
// peer", and connecting is all an offer needs — no on-chain BTC,
// no 10,000-sat minimum, no channel. Success is reported only
// when the node's own status shows the handshake completed; a
// dial that never handshakes gets the honest timeout answer.
async function lnConnectOnly() {
  const pubkey = $("lnPeerKey").value.trim();
  const host = $("lnPeerHost").value.trim();
  const port = Number($("lnPeerPort").value) || 9735;
  const proxy = $("lnProxy").value.trim();
  localStorage.setItem("fluid_ln_wsproxy", proxy);
  if (!/^[0-9a-fA-F]{66}$/.test(pubkey)) return msg("lnChanMsg", "Peer pubkey must be 66 hex characters.");
  if (!host) return msg("lnChanMsg", "Enter the peer host (a wss:// endpoint, or a host your proxy can reach).");
  try {
    msg("lnChanMsg", "Connecting to peer…", true);
    lnSession.connectPeer(pubkey, host, port);
    const res = await waitForLnPeerConnected(() => lnSession.peerStatus(), pubkey, { timeoutMs: 30000 });
    if (res.connected) {
      msg("lnChanMsg", "Connected ✓ Your node is linked to this peer — no channel was opened and no sats were needed. You can open a channel any time with “Connect & open channel”.", true);
    } else {
      msg("lnChanMsg", "Couldn't finish connecting to this peer — the connection didn't complete in time, so your node isn't linked to it yet. Check the host and port (and the proxy template above if this peer needs one), then try again. The peer is saved in your Connections list, and your node dials it again next time Fluid opens.");
    }
  } catch (e) { msg("lnChanMsg", "Connect failed: " + lnErrorText(e)); }
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
    // Wait on the node's real connection state, not a fixed
    // sleep: 4 s proved shorter than real connection time in the
    // wild (audit batch 4, F3), and requesting a channel from an
    // unconnected peer only fails inside LDK. A wait that times
    // out fails here, truthfully, with no channel requested.
    const res = await waitForLnPeerConnected(() => lnSession.peerStatus(), pubkey, { timeoutMs: 30000 });
    if (!res.connected) return msg("lnChanMsg", "Open channel failed: your node couldn't finish connecting to this peer in time, so no channel was requested. Check the host and port (and the proxy template above if this peer needs one), then try again.");
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
        <textarea id="lnFundHex" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" rows="2" placeholder="Raw funding transaction hex"></textarea>
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
    <textarea id="lnInv" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" data-autofocus rows="3" placeholder="lnbc… invoice — or a Fluid name / Lightning address"></textarea>
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
          // Shape-aware like the node's own pay path: an external
          // WebLN wallet pays invoices, so it can only serve the
          // LNURL (address) shape — a name whose Lightning is its
          // own Fluid node offer gets the plain refusal, not a
          // broken LNURL attempt against an lno… string.
          const hit = await resolveFluidName(target).catch(() => null);
          const t = hit ? lightningTargetForNameEntry(hit) : null;
          if (!t) return msg("lnMsg", "That Fluid name has no Lightning address or node offer in the registry.");
          if (t.kind === "offer") return msg("lnMsg", "That name receives through its own Fluid node — this fallback pays invoices through an external wallet and can't pay a node offer. Use Wallet tab → Lightning → Pay with my node instead.");
          lnAddr = t.value;
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

// ---------- BTC exit tab: Lightning -> Arkade -> Bitcoin ----------
// ALWAYS-WARN LAW v2 (owner, 2026-11-09): this tab is the only
// home of the bridge; its static warnings and unticked
// acknowledgements live in index.html, and nothing in this
// section runs until all three are ticked. The route: Satora
// Lightning -> Arkade (V-HTLC, lands in the user's own Arkade
// VTXO), then the Arkade operator's batched offboard to the
// user's Bitcoin address. Core holds the quote math and the
// ≈740-sat honesty gate; the Arkade SDK runs in the lazy
// arkade chunk. No custodial moment anywhere: the swap is
// atomic (pay the invoice or it fails back), the claim reveals
// the preimage into the user's own VTXO, and the exit is the
// operator batching outputs it cannot redirect.
let arkChunk = null, arkChunkPromise = null, arkSession = null, arkBootPromise = null;
let bridgePair = null, bridgeFeesInfo = null, bridgeQuote = null, bridgeBusy = false;
let bridgeForm = { sourceSats: "", btcAddress: "", destCustom: false };
let bridgeExitAll = { addr: "", custom: false };

function arkLoadChunk() {
  if (arkChunk) return Promise.resolve(arkChunk);
  if (arkChunkPromise) return arkChunkPromise;
  arkChunkPromise = (async () => {
    let mod;
    try { mod = await import("./arkade.chunk.js"); }
    catch {
      const err = new Error("The Arkade module isn't included in this build (the single-file build doesn't carry it). Open Fluid from fluidwallet.dpdns.org to use the bridge.");
      err.stage = "asset";
      throw err;
    }
    if (!mod || mod.ARKADE_CHUNK_MARKER !== true) {
      const err = new Error("The Arkade module loaded but doesn't match this build — hard-refresh the page and try again.");
      err.stage = "integrity";
      throw err;
    }
    arkChunk = mod;
    return mod;
  })();
  return arkChunkPromise;
}

function arkEnsureSession() {
  if (arkSession) return Promise.resolve(arkSession);
  if (arkBootPromise) return arkBootPromise;
  arkBootPromise = (async () => {
    const mod = await arkLoadChunk();
    const session = await mod.bootArkade({ phrase: wallet.mnemonic.phrase });
    arkSession = session;
    return session;
  })();
  arkBootPromise.catch(() => { arkBootPromise = null; });
  return arkBootPromise;
}

function bridgeAcksOk() {
  return ["bridgeAck1", "bridgeAck2", "bridgeAck3"].every((id) => { const el = $(id); return !!el && el.checked; });
}

// The wallet's own native Bitcoin mainnet address — the same one
// the Receive view shows for Bitcoin. BTC-exit destinations
// default to it (owner direction, 2026-11-10): the sats land back
// in the user's own Fluid wallet, and the user moves them on from
// there if they choose; sending to a different wallet is an
// explicit "Change destination" choice, never the starting state.
// Null when the address can't be derived, so the form says so
// plainly instead of pre-filling a blank or a wrong address.
function bridgeOwnBtcAddress() {
  if (!wallet) return null;
  try {
    const a = btcAddr || bitcoinAddress(wallet.mnemonic.phrase);
    return a && isValidBitcoinAddress(a) ? a : null;
  } catch { return null; }
}
for (const id of ["bridgeAck1", "bridgeAck2", "bridgeAck3"]) {
  const el = $(id);
  if (el) el.onchange = () => { bridgeQuote = null; if (wallet) bridgeRefresh().catch(() => {}); };
}

async function bridgeRefresh() {
  if (!wallet || !$("tab-bridge")) return;
  paintBridgeRecords();
  if (bridgeAcksOk()) paintBridgeForm(); else paintBridgeLocked();
  paintBridgeArkade(`<p class="tag" style="margin:0">Loading your Arkade wallet…</p>`);
  try {
    await arkEnsureSession();
    const session = arkSession;
    const [info, pair] = await Promise.all([
      session.operatorInfo().catch(() => null),
      fetchLnArkadePair().catch(() => null),
    ]);
    if (info) bridgeFeesInfo = info;
    if (pair) bridgePair = pair;
    if (!prices.BTC) { try { const p = await getPrices(); if (p && p.BTC) prices.BTC = p.BTC; } catch {} }
    await bridgeSyncRecords();
    paintBridgeRecords();
    await paintBridgeArkadeLive();
    if (bridgeAcksOk()) paintBridgeForm(); else paintBridgeLocked();
  } catch (e) {
    paintBridgeArkadeError(e.message || String(e));
    if (bridgeAcksOk()) paintBridgeForm();
  }
}

function paintBridgeArkadeError(message) {
  paintBridgeArkade(`<p class="msg err" style="margin:0 0 8px">${esc(message)}</p><button class="btn ghost" id="bridgeArkRetry" style="width:auto">Retry</button>`);
  const b = $("bridgeArkRetry");
  if (b) b.onclick = () => bridgeRefresh().catch(() => {});
}

function paintBridgeLocked() {
  const el = $("bridgeMain");
  if (el) el.innerHTML = `<div class="card"><p class="tag" style="margin:0">Tick the three confirmations above and the bridge form opens. Nothing here runs until you do — that's deliberate.</p></div>`;
}

function paintBridgeForm() {
  const el = $("bridgeMain");
  if (!el) return;
  if (!bridgeAcksOk()) { paintBridgeLocked(); return; }
  const pair = bridgePair;
  const pairLine = pair
    ? `Satora's live Lightning → Arkade route terms: ${pair.feePercentage * 100}% + ${pair.networkFeeSats} sat per swap · this route's minimum is ${pair.minSats.toLocaleString()} sats · maximum ${pair.maxSats.toLocaleString()} sats.`
    : "Satora's live pair table couldn't be read just now — quoting is paused until it can be. Nothing is guessed.";
  // Destination: the user's own Fluid Bitcoin address by default
  // (filled in, locked); "Change destination" is the explicit
  // choice that unlocks pasting a different wallet. No derivable
  // own address → nothing is pre-filled and the form says why.
  const own = bridgeOwnBtcAddress();
  if (!bridgeForm.destCustom && own) bridgeForm.btcAddress = own;
  const destHtml = !own
    ? `<label class="fld"><span>Destination Bitcoin address</span><input id="bridgeBtcAddr" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="bc1…" autocapitalize="none" value="${esc(bridgeForm.btcAddress)}"></label>
    <p class="tag" style="margin:0 0 10px">Your own Fluid Bitcoin address isn't available right now, so nothing was filled in for you — paste the destination address yourself, and check it carefully.</p>`
    : !bridgeForm.destCustom
    ? `<label class="fld"><span>Destination Bitcoin address — your Fluid Bitcoin address</span><input id="bridgeBtcAddr" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" readonly value="${esc(own)}"></label>
    <p class="tag" style="margin:0 0 6px">These sats land in your own Fluid Bitcoin wallet. From there you can move them wherever you like.</p>
    <button class="btn ghost" id="bridgeDestChange" style="width:auto;margin:0 0 10px">Change destination</button>`
    : `<label class="fld"><span>Destination Bitcoin address</span><input id="bridgeBtcAddr" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="bc1…" autocapitalize="none" value="${esc(bridgeForm.btcAddress)}"></label>
    <button class="btn ghost" id="bridgeDestOwn" style="width:auto;margin:0 0 10px">Use my Fluid Bitcoin address</button>`;
  el.innerHTML = `<div class="card">
    <p class="t-strong" style="margin:0 0 6px">Cross to Bitcoin mainnet</p>
    <p class="tag" style="margin:0 0 10px">${esc(pairLine)}</p>
    <label class="fld"><span>Amount in sats (from your Lightning balance)</span><input id="bridgeAmount" inputmode="numeric" placeholder="e.g. 2700" value="${esc(bridgeForm.sourceSats)}"></label>
    ${destHtml}
    <p class="msg" id="bridgeMsg"></p>
    <div id="bridgeQuoteBox"></div>
    <button class="btn" id="bridgeQuoteBtn" ${pair ? "" : "disabled"}>Get the exact quote</button>
    <p class="tag" style="margin:10px 0 0">The quote is a real, live Satora creation — unpaid, and it simply expires if you stop here. Fluid refuses the crossing, plainly, if the true costs would push the route above its honesty cap.</p>
  </div>`;
  $("bridgeAmount").oninput = (e) => { bridgeForm.sourceSats = e.target.value; };
  const destInput = $("bridgeBtcAddr");
  if (destInput && !destInput.readOnly) destInput.oninput = (e) => { bridgeForm.btcAddress = e.target.value; };
  const destChange = $("bridgeDestChange");
  if (destChange) destChange.onclick = () => { bridgeForm.destCustom = true; bridgeForm.btcAddress = ""; bridgeQuote = null; paintBridgeForm(); };
  const destOwn = $("bridgeDestOwn");
  if (destOwn) destOwn.onclick = () => { bridgeForm.destCustom = false; bridgeQuote = null; paintBridgeForm(); };
  $("bridgeQuoteBtn").onclick = () => bridgeDoQuote().catch((e) => msg("bridgeMsg", e.message || String(e), false));
  if (bridgeQuote) paintBridgeQuoteReview();
}

async function bridgeDoQuote() {
  if (bridgeBusy) return;
  const sourceSats = Math.floor(Number(bridgeForm.sourceSats));
  const btcAddress = String(bridgeForm.btcAddress || "").trim();
  if (!Number.isFinite(sourceSats) || sourceSats <= 0) throw new Error("Enter the amount in sats.");
  if (!bridgePair) throw new Error("Satora's pair table isn't readable right now — try again in a moment.");
  if (sourceSats < bridgePair.minSats) throw new Error(`This route's minimum is ${bridgePair.minSats} sats — that's Satora's Lightning → Arkade pair floor, not a Fluid minimum.`);
  if (sourceSats > bridgePair.maxSats) throw new Error(`Satora's Lightning → Arkade maximum is ${bridgePair.maxSats.toLocaleString()} sats per swap.`);
  if (!isValidBitcoinAddress(btcAddress)) throw new Error("That doesn't look like a Bitcoin mainnet address — check it and try again.");
  const session = await arkEnsureSession();
  const info = bridgeFeesInfo || await session.operatorInfo().catch(() => null);
  const program = info ? parseArkadeIntentFees(info.fees) : null;
  if (!program) throw new Error("The Arkade operator's current fee program isn't one Fluid recognises — quoting is paused rather than guessed. Nothing was created.");
  bridgeBusy = true;
  msg("bridgeMsg", "Asking Satora for the exact quote…", true);
  try {
    const idx = bridgeCreationIndex(localStorage);
    const identity = satoraSwapClaimKey(wallet.mnemonic.phrase, idx);
    const creation = await createLnArkadeSwap({ identity, sourceSats, targetArkadeAddress: session.address, extraFeesBps: 0 });
    bumpBridgeCreationIndex(localStorage, idx);
    const quote = composeBridgeQuote({ sourceSats, pair: bridgePair, legAQuoteSats: creation.legAFeeSats, offboardProgram: program, btcUsd: prices.BTC || 0 });
    if (!quote) throw new Error("After the quoted fees nothing would arrive — increase the amount.");
    bridgeQuote = { quote, quoteLegAFeeSats: creation.legAFeeSats, sourceSats, btcAddress };
    paintBridgeQuoteReview();
    msg("bridgeMsg", "", true);
  } finally { bridgeBusy = false; }
}

function paintBridgeQuoteReview() {
  const box = $("bridgeQuoteBox");
  if (!box || !bridgeQuote) return;
  const { quote, sourceSats, btcAddress } = bridgeQuote;
  const lines = formatBridgeQuoteLines({ ...quote, sourceSats, btcAddress });
  if (!quote.gate.ok) {
    box.innerHTML = `<div class="subcard" style="margin-top:12px">${lines.map((l) => `<p class="tag" style="margin:0 0 4px">${esc(l)}</p>`).join("")}
      <p class="msg err" style="margin:8px 0 0">Fluid won't run this crossing: the true route cost (${quote.routeCostSats} sats) is above the ${BRIDGE_ROUTE_COST_CAP_SATS}-sat honesty cap for this route. Nothing was paid; the quote creation above simply expires unpaid.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="subcard" style="margin-top:12px">${lines.map((l) => `<p class="tag" style="margin:0 0 4px">${esc(l)}</p>`).join("")}
    <button class="btn" id="bridgeGoBtn" style="margin-top:8px">Create the swap</button>
    <p class="tag" style="margin:8px 0 0">Creating charges nothing. You then review the invoice and pay it from your own Lightning node — paying is the irreversible step.</p></div>`;
  $("bridgeGoBtn").onclick = () => bridgeCreateReal().catch((e) => msg("bridgeMsg", e.message || String(e), false));
}

async function bridgeCreateReal() {
  if (bridgeBusy || !bridgeQuote) return;
  const { quote, quoteLegAFeeSats, sourceSats, btcAddress } = bridgeQuote;
  const session = await arkEnsureSession();
  bridgeBusy = true;
  msg("bridgeMsg", "Creating the real swap…", true);
  try {
    const idx = bridgeCreationIndex(localStorage);
    const identity = satoraSwapClaimKey(wallet.mnemonic.phrase, idx);
    const real = await createLnArkadeSwap({ identity, sourceSats, targetArkadeAddress: session.address, extraFeesBps: quote.fluidFeeBps });
    bumpBridgeCreationIndex(localStorage, idx);
    // Two-pass honesty: the real creation's deduction over the
    // fee-free quote creation must be exactly Fluid's quoted fee
    // (±1 sat of integer rounding) — anything else means the
    // server moved the price between quote and creation.
    const expectedExtra = real.legAFeeSats - quoteLegAFeeSats;
    if (Math.abs(expectedExtra - quote.fluidFeeSats) > 1)
      throw new Error(`Satora priced the real swap differently from its own quote (expected Fluid's fee of ${quote.fluidFeeSats} sats on top, saw ${expectedExtra}). Nothing was paid — the created swap expires unpaid.`);
    // Self-check before any money moves: Fluid recomputes the
    // VHTLC lock address from the swap's own parameters and
    // refuses if it differs from the address Satora will fund.
    const mod = await arkLoadChunk();
    const local = mod.bridgeVhtlc({ record: { ...real, receiverPk: identity.claimPk }, hashLock: identity.hashLock });
    if (local.address !== real.vhtlcAddress)
      throw new Error("Fluid computed a different Arkade lock address than the swap's — nothing was paid, and the created swap expires unpaid. This should never happen; please report it.");
    const record = {
      id: real.id, index: idx, phase: "awaiting-payment",
      sourceSats, targetSats: real.targetSats, legAFeeSats: real.legAFeeSats,
      fluidFeeSats: quote.fluidFeeSats, offboardFeeQuotedSats: quote.offboardFeeSats,
      receiveSats: quote.receiveSats, btcAddress, arkadeAddress: session.address,
      vhtlcAddress: real.vhtlcAddress, senderPk: real.senderPk, serverPk: real.serverPk,
      receiverPk: identity.claimPk, refundLocktime: real.refundLocktime,
      unilateralClaimDelay: real.unilateralClaimDelay, unilateralRefundDelay: real.unilateralRefundDelay,
      unilateralRefundWithoutReceiverDelay: real.unilateralRefundWithoutReceiverDelay,
      invoice: real.invoice, invoiceExpiresAt: real.invoiceExpiresAt || null,
      satoraStatus: real.status || "", createdAt: Date.now(), updatedAt: Date.now(),
    };
    saveBridgeRecord(localStorage, record);
    bridgeQuote = null;
    msg("bridgeMsg", "Swap created. Pay its invoice below to start the crossing.", true);
    paintBridgeForm();
    paintBridgeRecords();
  } finally { bridgeBusy = false; }
}

async function bridgeSyncRecords() {
  if (!wallet) return;
  const records = loadBridgeRecords(localStorage);
  const mod = arkChunk || await arkLoadChunk().catch(() => null);
  for (const r of records) {
    if (["done", "expired", "failed"].includes(r.phase)) continue;
    let changed = false;
    try {
      if (r.phase === "awaiting-payment") {
        const st = await fetchLnArkadeSwapStatus(r.id).catch(() => null);
        if (st && st.status && st.status !== r.satoraStatus) { r.satoraStatus = st.status; changed = true; }
        if (!r.paidAt && r.invoiceExpiresAt && Date.now() > r.invoiceExpiresAt) { r.phase = "expired"; changed = true; }
        else if (r.paidAt) { r.phase = "funding"; changed = true; }
      }
      if (r.phase === "funding" && mod) {
        const identity = satoraSwapClaimKey(wallet.mnemonic.phrase, r.index);
        const funded = await mod.bridgeVhtlcFundedSats(r, identity.hashLock).catch(() => 0);
        if (funded > 0) { r.fundedSats = funded; r.phase = "claimable"; changed = true; }
      }
    } catch {}
    if (changed) { r.updatedAt = Date.now(); saveBridgeRecord(localStorage, r); }
  }
}

function paintBridgeRecords() {
  const el = $("bridgeRecords");
  if (!el || !wallet) return;
  const records = loadBridgeRecords(localStorage);
  if (!records.length) { el.innerHTML = `<p class="tag" style="margin:0">None yet.</p>`; return; }
  el.innerHTML = records.map((r) => {
    const line = bridgeHistoryLine(r);
    let action = "";
    if (r.phase === "awaiting-payment") action = `<button class="btn ghost" data-bridge-pay="${esc(r.id)}">Pay the invoice (${Number(r.sourceSats).toLocaleString()} sats)</button>`;
    else if (r.phase === "claimable") action = `<button class="btn ghost" data-bridge-claim="${esc(r.id)}">Claim ${Number(r.fundedSats || r.targetSats).toLocaleString()} sats into my Arkade wallet</button>`;
    else if (r.phase === "claimed") action = `<button class="btn ghost" data-bridge-exit="${esc(r.id)}">Exit to ${esc(String(r.btcAddress || "").slice(0, 10))}… (review the live fee first)</button>`;
    return `<div class="subcard" style="margin:0 0 8px"><p class="tag" style="margin:0 0 2px">${esc(line)}</p><p class="tag" style="margin:0 0 ${action ? 8 : 0}px">Status: ${esc(bridgePhaseLabel(r))}${r.claimTxId ? ` · claim tx ${esc(String(r.claimTxId).slice(0, 16))}…` : ""}${r.exitTxId ? ` · exit tx ${esc(String(r.exitTxId).slice(0, 16))}…` : ""}</p>${action}</div>`;
  }).join("");
  el.querySelectorAll("[data-bridge-pay]").forEach((b) => b.onclick = () => bridgePay(b.dataset.bridgePay).catch((e) => toast(e.message || String(e))));
  el.querySelectorAll("[data-bridge-claim]").forEach((b) => b.onclick = () => bridgeClaim(b.dataset.bridgeClaim).catch((e) => toast(e.message || String(e))));
  el.querySelectorAll("[data-bridge-exit]").forEach((b) => b.onclick = () => bridgeExit(b.dataset.bridgeExit).catch((e) => toast(e.message || String(e))));
}

async function bridgePay(id) {
  const record = loadBridgeRecords(localStorage).find((r) => r.id === id);
  if (!record || record.phase !== "awaiting-payment") return;
  if (record.invoiceExpiresAt && Date.now() > record.invoiceExpiresAt) throw new Error("That invoice has expired — start a fresh crossing.");
  const session = await lnEnsureSession("bitcoin");
  toast("Paying the swap invoice from your Lightning node…");
  await session.payInvoice(record.invoice, null);
  record.paidAt = Date.now();
  record.phase = "funding";
  record.updatedAt = Date.now();
  saveBridgeRecord(localStorage, record);
  paintBridgeRecords();
  try { await lnWaitEvent("payment_sent", { timeoutMs: 120000, failTypes: ["payment_failed"] }); }
  catch (e) { toast(`Payment problem: ${e.message} — the bridge record below tracks the ground truth.`); }
  await bridgeSyncRecords();
  paintBridgeRecords();
}

async function bridgeClaim(id) {
  const record = loadBridgeRecords(localStorage).find((r) => r.id === id);
  if (!record || record.phase !== "claimable") return;
  const session = await arkEnsureSession();
  const mod = await arkLoadChunk();
  const identity = satoraSwapClaimKey(wallet.mnemonic.phrase, record.index);
  toast("Claiming into your Arkade wallet…");
  const res = await mod.claimBridgeVhtlc({
    secretKeyHex: identity.secretKeyHex, claimPkHex: identity.claimPk,
    preimageHex: identity.secretHex, hashLockHex: identity.hashLock,
    record, destinationAddress: session.address,
  });
  record.phase = "claimed";
  record.claimTxId = res.txId;
  record.claimedSats = Number(res.claimAmount);
  record.updatedAt = Date.now();
  saveBridgeRecord(localStorage, record);
  paintBridgeRecords();
  await paintBridgeArkadeLive();
  toast(`Claimed ${Number(res.claimAmount).toLocaleString()} sats into your Arkade wallet ✓`);
}

async function bridgeExit(id) {
  const record = loadBridgeRecords(localStorage).find((r) => r.id === id);
  if (!record || record.phase !== "claimed") return;
  const session = await arkEnsureSession();
  const info = await session.operatorInfo();
  const program = parseArkadeIntentFees(info.fees);
  if (!program) throw new Error("The Arkade operator's current fee program isn't one Fluid recognises — the exit is paused rather than guessed.");
  const vtxos = await session.vtxos();
  const earliest = vtxos.reduce((m, v) => (v.expirySecs && (!m || v.expirySecs < m) ? v.expirySecs : m), null);
  const fee = arkadeOffboardFeeSats(record.claimedSats, program, { vtxoExpirySecs: earliest, nowSecs: Math.floor(Date.now() / 1000) });
  const net = record.claimedSats - fee;
  if (net <= 0) throw new Error("The exit fee would consume the whole amount — nothing to exit.");
  if (!window.confirm(`Exit ${record.claimedSats.toLocaleString()} sats to ${record.btcAddress}?\n\nArkade exit fee (live): ${fee} sats\nYou receive on Bitcoin mainnet: ≈ ${net.toLocaleString()} sats\n\nOnce submitted to the batch this cannot be recalled.`)) return;
  toast("Submitting the exit to the operator's next batch…");
  const txid = await session.offboard({ btcAddress: record.btcAddress, feeInfo: info.fees, amountSats: record.claimedSats });
  record.phase = "done";
  record.exitTxId = txid;
  record.exitFeeQuotedSats = fee;
  record.updatedAt = Date.now();
  saveBridgeRecord(localStorage, record);
  paintBridgeRecords();
  await paintBridgeArkadeLive();
  toast("Exit submitted ✓ — it lands on-chain with the operator's next batch, then confirms like any Bitcoin transaction.");
}

function paintBridgeArkade(html) {
  const el = $("bridgeArkadeBody");
  if (el) el.innerHTML = html;
}

async function paintBridgeArkadeLive() {
  const el = $("bridgeArkadeBody");
  if (!el) return;
  try {
    const session = await arkEnsureSession();
    const [balance, vtxos] = await Promise.all([session.balanceSats().catch(() => null), session.vtxos().catch(() => [])]);
    if (balance == null) { paintBridgeArkadeError("Your Arkade balance couldn't be read just now. Nothing is guessed."); return; }
    const earliest = vtxos.reduce((m, v) => (v.expirySecs && (!m || v.expirySecs < m) ? v.expirySecs : m), null);
    const soon = earliest && earliest * 1000 - Date.now() < 7 * 24 * 3600 * 1000;
    const rows = vtxos.slice(0, 12).map((v) => `<p class="tag" style="margin:0 0 2px">${Number(v.valueSats).toLocaleString()} sats${v.expirySecs ? ` · expires ${esc(new Date(v.expirySecs * 1000).toLocaleString())}` : ""}</p>`).join("");
    // Same destination rule as the bridge form: the user's own
    // Fluid Bitcoin address by default; another wallet only via
    // the explicit "Change destination" choice.
    const own = bridgeOwnBtcAddress();
    if (!bridgeExitAll.custom && own) bridgeExitAll.addr = own;
    const exitDestHtml = !own
      ? `<label class="fld" style="margin-top:10px"><span>Or exit everything to a Bitcoin address</span><input id="bridgeExitAllAddr" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="bc1…" autocapitalize="none" value="${esc(bridgeExitAll.addr)}"></label>
      <p class="tag" style="margin:6px 0 0">Your own Fluid Bitcoin address isn't available right now, so nothing was filled in for you — paste the destination address yourself, and check it carefully.</p>`
      : !bridgeExitAll.custom
      ? `<label class="fld" style="margin-top:10px"><span>Or exit everything to a Bitcoin address — your Fluid Bitcoin address</span><input id="bridgeExitAllAddr" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" readonly value="${esc(own)}"></label>
      <p class="tag" style="margin:6px 0 0">These sats land in your own Fluid Bitcoin wallet. From there you can move them wherever you like.</p>
      <button class="btn ghost" id="bridgeExitAllChange" style="width:auto;margin-top:8px">Change destination</button>`
      : `<label class="fld" style="margin-top:10px"><span>Or exit everything to a Bitcoin address</span><input id="bridgeExitAllAddr" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="bc1…" autocapitalize="none" value="${esc(bridgeExitAll.addr)}"></label>
      <button class="btn ghost" id="bridgeExitAllOwn" style="width:auto;margin-top:8px">Use my Fluid Bitcoin address</button>`;
    paintBridgeArkade(`
      <p style="margin:0 0 4px"><b>${Number(balance).toLocaleString()} sats</b> in Arkade</p>
      <p class="tag" style="margin:0 0 6px">Your Arkade address: <span class="mono">${esc(session.address)}</span></p>
      ${rows}
      ${earliest ? `<p class="tag" style="margin:6px 0 0${soon ? ";color:#e5484d" : ""}">Earliest expiry: ${esc(new Date(earliest * 1000).toLocaleString())}${soon ? " — renew or exit soon; past expiry the operator can sweep unspent coins." : ""}</p>` : ""}
      ${balance > 0 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn ghost" id="bridgeRenewBtn" style="width:auto">Renew my Arkade balance</button></div>
      ${exitDestHtml}
      <p class="msg" id="bridgeArkadeMsg"></p>
      <button class="btn ghost" id="bridgeExitAllBtn">Review the exit</button>` : `<p class="tag" style="margin:6px 0 0">Sats you bridge land here first; from here you exit them to Bitcoin mainnet.</p>`}`);
    if (balance > 0) {
      const exitAllInput = $("bridgeExitAllAddr");
      if (exitAllInput && !exitAllInput.readOnly) exitAllInput.oninput = (e) => { bridgeExitAll.addr = e.target.value; };
      const exitAllChange = $("bridgeExitAllChange");
      if (exitAllChange) exitAllChange.onclick = () => { bridgeExitAll.custom = true; bridgeExitAll.addr = ""; paintBridgeArkadeLive().catch(() => {}); };
      const exitAllOwn = $("bridgeExitAllOwn");
      if (exitAllOwn) exitAllOwn.onclick = () => { bridgeExitAll.custom = false; paintBridgeArkadeLive().catch(() => {}); };
      $("bridgeRenewBtn").onclick = async () => {
        try {
          toast("Renewing your Arkade balance…");
          await session.renew();
          toast("Renewed ✓ — your VTXOs carry a fresh expiry.");
          await paintBridgeArkadeLive();
        } catch (e) { msg("bridgeArkadeMsg", e.message || String(e), false); }
      };
      $("bridgeExitAllBtn").onclick = async () => {
        try {
          const addr = String($("bridgeExitAllAddr").value || "").trim();
          if (!isValidBitcoinAddress(addr)) throw new Error("Enter a valid Bitcoin mainnet address.");
          const info = await session.operatorInfo();
          const program = parseArkadeIntentFees(info.fees);
          if (!program) throw new Error("The Arkade operator's current fee program isn't one Fluid recognises — the exit is paused rather than guessed.");
          const fee = arkadeOffboardFeeSats(balance, program, { vtxoExpirySecs: earliest, nowSecs: Math.floor(Date.now() / 1000) });
          const net = balance - fee;
          if (net <= 0) throw new Error("The exit fee would consume the whole balance.");
          if (!window.confirm(`Exit your whole Arkade balance (${Number(balance).toLocaleString()} sats) to ${addr}?\n\nArkade exit fee (live): ${fee} sats\nYou receive on Bitcoin mainnet: ≈ ${net.toLocaleString()} sats\n\nOnce submitted to the batch this cannot be recalled.`)) return;
          await session.offboard({ btcAddress: addr, feeInfo: info.fees });
          toast("Exit submitted ✓ — it lands on-chain with the operator's next batch.");
          await paintBridgeArkadeLive();
        } catch (e) { msg("bridgeArkadeMsg", e.message || String(e), false); }
      };
    }
  } catch (e) {
    paintBridgeArkadeError(e.message || String(e));
  }
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
    <textarea id="wcUri" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus rows="3" placeholder="wc:… pairing code from the app" autocapitalize="none"></textarea>
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
  // Live market benchmark: Paycrest's keyless MARKET fields
  // (/v1/currencies marketBuyRate/marketSellRate — a price source,
  // not a route; the provider quote from the same aggregator is
  // only a one-sided sanity witness inside wallet-core), fetched
  // fresh for this sheet opening and never persisted. Served
  // corridors: Nigeria (buy AND sell — QA F9) and Kenya (same
  // surface, QA F10). Any failure leaves the line hidden rather
  // than showing a stale or wrong figure.
  const BENCH = { NG: { fiat: "NGN", sym: "₦", dec: 0 }, KE: { fiat: "KES", sym: "KSh ", dec: 2 } };
  let benchRate = null, benchKey = "";
  const paintBench = () => {
    const el = $("rBench"); if (!el) return;
    const cEl = $("rCountry");
    const b = cEl && BENCH[cEl.value];
    if (b && benchKey === cEl.value + ":" + mode && benchRate != null) {
      // benchRate is the MARKET figure: parsed, band-checked and
      // quote-witnessed in wallet-core; the line is built
      // from that number, never from raw response text.
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
const swapChainName = (k) => (k === "bitcoin" ? "Bitcoin" : k === "lightning" ? "Lightning" : (swapChainOf(k) ? swapChainOf(k).name : NETWORKS[k].name));
function swapTokenList(netKey) {
  if (netKey === "bitcoin" || netKey === "lightning") {
    // Satora destinations: the receive asset is BTC itself (sats on
    // Bitcoin mainnet, sats over Lightning). Not a LI.FI token.
    return [{ symbol: "BTC", address: "btc", decimals: 8, native: false }];
  }
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
  // Across and Relay return single quotes, not LI.FI-style tool
  // steps — their router names are simply "Across" / "Relay", and
  // the confirm sentence names the router so the user always sees
  // which one will move their money.
  if (route && route.provider === "across") return "Across";
  if (route && route.provider === "relay") return "Relay";
  if (route && route.provider === "satora") return "Satora";
  if (route && route.provider === "jupiter") return "Jupiter";
  if (route && route.provider === "mayan") return "Mayan";
  if (route && route.provider === "gasfallback") return "Two-step via " + swapRouteName(route.legs?.leg1 || {});
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
  // Bitcoin and Lightning are receive-only swap destinations
  // (Satora, from EVM stablecoins) — they appear in the To list only.
  const swapDestNets = [...swapNets, "bitcoin", "lightning"];
  const fromKey0 = (viewKey === "tron" || viewKey === "solana" || viewKey === "sui") ? viewKey : (networkKey === "sepolia" ? "bsc" : networkKey);
  const toKey0 = fromKey0 === "base" ? "bsc" : "base";
  // §4.2: from a non-swappable family view the sheet still opens —
  // with a one-line caption, never a dead button.
  const swapViewCaption = (viewKey !== "all" && viewKey !== "evm" && !["tron", "solana", "sui"].includes(viewKey))
    ? `<p class="tag">Swaps run on EVM, Solana, Tron and Sui — pick a source chain below.</p>` : "";
  openSheet(`<h3>Swap</h3>
    ${swapViewCaption}
    <label class="tag">From</label>
    <div style="display:flex;gap:8px">
      <button class="btn ghost" id="wFromNetBtn" style="flex:1.2;margin:6px 0">${esc(swapChainName(fromKey0))} ▾</button>
      <button class="btn ghost" id="wFromTokBtn" style="flex:1;margin:6px 0">Select token ▾</button>
    </div>
    <div id="wFromNetPick" class="hidden">
      <input id="wFromNetSearch" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="Search networks…" autocapitalize="none">
      <div id="wFromNetList" style="max-height:240px;overflow:auto"></div>
    </div>
    <div id="wFromPick" class="hidden">
      <input id="wFromSearch" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="Search name or symbol, or paste an address…" autocapitalize="none">
      <div id="wFromList" style="max-height:240px;overflow:auto"></div>
    </div>
    <input id="wAmt" data-autofocus inputmode="decimal" placeholder="Amount">
    <button class="btn ghost" id="wFlip">${icon("swap", "ic ic-sm")} Flip</button>
    <label class="tag">To</label>
    <div style="display:flex;gap:8px">
      <button class="btn ghost" id="wToNetBtn" style="flex:1.2;margin:6px 0">${esc(swapChainName(toKey0))} ▾</button>
      <button class="btn ghost" id="wToTokBtn" style="flex:1;margin:6px 0">Select token ▾</button>
    </div>
    <div id="wToNetPick" class="hidden">
      <input id="wToNetSearch" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="Search networks…" autocapitalize="none">
      <div id="wToNetList" style="max-height:240px;overflow:auto"></div>
    </div>
    <div id="wToPick" class="hidden">
      <input id="wToSearch" spellcheck="false" autocomplete="off" autocorrect="off" placeholder="Search name or symbol, or paste an address…" autocapitalize="none">
      <div id="wToList" style="max-height:240px;overflow:auto"></div>
    </div>
    <div id="wDestWrap" class="hidden">
      <label class="tag" id="wDestLabel"></label>
      <input id="wDestAddr" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
    </div>
    <button class="btn" id="wRoutes">Get routes</button>
    <div id="wList"></div>
    <details id="wHow" style="margin:10px 0">
      <summary class="tag" style="cursor:pointer">How swaps work</summary>
      <p class="tag">One search across every Fluid chain (routes by Relay — LI.FI covers the chains Relay doesn't; Satora covers Bitcoin and Lightning from EVM stablecoins). Cheapest = most received after fees; Fluid's fee is a small multiple of the route's cost, never more than 0.5% — and you approve the exact sentence before anything is signed.</p>
      <p class="tag">Total cost caps: $0.20 EVM · $1.50 Bitcoin · $0.30 Lightning · $0.30 Solana.</p>
    </details>
    <div id="wConfirm" class="hidden">
      <p class="seed" id="wIntentText"></p>
      <button class="btn" id="wDo">Confirm &amp; swap</button>
    </div>
    <div id="wSatoraSwaps"></div>
    <div id="wMayanSwaps"></div>
    <div id="wGasFallback"></div>
    <p class="msg err" id="wMsg"></p>`);
  const P = {
    from: { btn: "wFromTokBtn", panel: "wFromPick", search: "wFromSearch", list: "wFromList", netBtn: "wFromNetBtn", netPanel: "wFromNetPick", netSearch: "wFromNetSearch", netList: "wFromNetList" },
    to: { btn: "wToTokBtn", panel: "wToPick", search: "wToSearch", list: "wToList", netBtn: "wToNetBtn", netPanel: "wToNetPick", netSearch: "wToNetSearch", netList: "wToNetList" },
  };
  const pick = { from: null, to: null };
  // Network selection (audit P1-4): the network pickers get the
  // same search treatment as the token pickers — a button that
  // opens a searchable list — instead of native <select>s with
  // 90+ options. netSel is the single source of truth the rest of
  // the sheet reads (the old selects were read via .value in a
  // dozen places; they all read netSel now).
  const netSel = { from: fromKey0, to: toKey0 };
  function updateNetBtn(side) { $(P[side].netBtn).textContent = swapChainName(netSel[side]) + " ▾"; }
  function setNetValue(side, key) { netSel[side] = key; updateNetBtn(side); }
  function renderNetList(side) {
    const q = $(P[side].netSearch).value.trim().toLowerCase();
    const keys = (side === "to" ? swapDestNets : swapNets)
      .filter(k => !q || swapChainName(k).toLowerCase().includes(q) || k.toLowerCase().includes(q));
    $(P[side].netList).innerHTML = keys.length
      ? keys.map(k => `<button class="netitem" data-netpick="${side}" data-key="${esc(k)}"><span>${esc(swapChainName(k))}${k === netSel[side] ? " ✓" : ""}</span></button>`).join("")
      : `<p class="tag">No networks match.</p>`;
    document.querySelectorAll(`[data-netpick="${side}"]`).forEach(b => b.onclick = async () => {
      show(P[side].netPanel, false);
      await chooseNet(side, b.dataset.key);
    });
  }
  async function chooseNet(side, key) {
    setNetValue(side, key);
    show(P[side].panel, false);
    await ensureStableTokens(key); // discovered chains learn USDC/USDT lazily
    setPick(side, defaultTok(side, key));
    ensureSwapList(key);
    if (side === "to") syncDestRow();
  }
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
  // Bitcoin / Lightning destinations need a destination the wallet
  // can't derive from the seed alone: a Bitcoin address (defaulted
  // to the user's own Fluid Taproot address) or a Lightning
  // invoice / address / LNURL the user pastes.
  function syncDestRow() {
    const tk = netSel.to;
    const wrap = $("wDestWrap"), inp = $("wDestAddr");
    if (tk === "bitcoin") {
      wrap.classList.remove("hidden");
      $("wDestLabel").textContent = "Bitcoin address to receive at — your Fluid Taproot address by default; you claim the Bitcoin with your own key";
      if (!inp.value || /^ln/i.test(inp.value)) { inp.value = ""; try { inp.value = bitcoinTaprootAddress(wallet.mnemonic.phrase); } catch { /* stays editable */ } }
      inp.placeholder = "bc1p…";
    } else if (tk === "lightning") {
      wrap.classList.remove("hidden");
      $("wDestLabel").textContent = "Lightning destination — an amount-bearing invoice, a Lightning address, or an LNURL";
      if (/^bc1p/i.test(inp.value)) inp.value = "";
      inp.placeholder = "lnbc… invoice, name@domain, or lnurl…";
    } else {
      wrap.classList.add("hidden");
    }
  }
  // BTC-floor way-through: a sub-10,000-sat swap to Bitcoin mainnet
  // is refused by the swap route (Satora's settlement floor). That
  // floor belongs to the route, not to Fluid and not to Bitcoin:
  // Bitcoin the user holds can be sent at any amount. The sheet
  // turns the refusal into the Lightning alternative at the same
  // amount instead of a dead-end error. One tap switches the
  // destination network to Lightning and re-quotes; the destination
  // prefill uses the user's registered Lightning ADDRESS only —
  // never the own-node BOLT 12 offer, which Satora's creation path
  // cannot pay (it accepts invoice / address / LNURL only), so
  // offering it here would quote and then fail at creation.
  function paintBtcFloorWayThrough(floor) {
    const host = $("wList"); if (!host) return;
    host.innerHTML = `<div class="netitem" style="cursor:default">
        <span>That swap would land about <b>${Number(floor.netSats).toLocaleString("en-GB")} sats</b> on Bitcoin.<br>
        <small style="color:var(--dim)">Mainnet settlement on this swap route opens at 10,000 sats — that is the route's floor, not a Fluid minimum: Bitcoin you hold can be sent at any amount. Lightning settles this amount today, in seconds.</small></span>
      </div>
      <button class="btn" id="wBtcFloorLn" style="margin:8px 0">Swap to Lightning instead</button>`;
    $("wBtcFloorLn").onclick = async () => {
      setNetValue("to", "lightning");
      setPick("to", defaultTok("to", "lightning"));
      syncDestRow();
      const inp = $("wDestAddr");
      if (inp.value && !classifySatoraLightningDestination(inp.value)) inp.value = "";
      if (!inp.value) {
        try {
          const myName = localStorage.getItem("fluid_name");
          const hit = myName ? await resolveFluidName(myName).catch(() => null) : null;
          if (hit && hit.ln) inp.value = hit.ln;
        } catch { /* stays empty — guidance below */ }
      }
      if (inp.value) { searchRoutes(); }
      else { inp.focus(); msg("wMsg", "Lightning is selected with the same amount — paste the invoice or Lightning address to receive at, then tap Get routes.", true); }
    };
  }
  // Satora swaps in flight / history, inside this sheet (no new
  // surface): persisted swap ids are the recovery key; statuses are
  // polled from the server and rendered as text only (audit C1).
  function paintSatoraSwaps() {
    const host = $("wSatoraSwaps"); if (!host) return;
    const records = loadSatoraSwapRecords(localStorage);
    if (!records.length) { host.innerHTML = ""; return; }
    host.innerHTML = `<h4>Satora swaps</h4>` + records.map(r => `<p class="tag" data-satora-line="${esc(r.id)}"></p>`).join("");
    host.querySelectorAll("[data-satora-line]").forEach((el, i) => { el.textContent = satoraSwapHistoryLine(records[i]); });
  }
  paintSatoraSwaps();
  pollSatoraSwapStatuses(localStorage).then(() => paintSatoraSwaps()).catch(() => {});
  // Mayan swaps in flight / history, same conventions: the
  // source transaction hash is the recovery key; statuses are
  // polled from Mayan's explorer and rendered as text only.
  function paintMayanSwaps() {
    const host = $("wMayanSwaps"); if (!host) return;
    const records = loadMayanSwapRecords(localStorage);
    if (!records.length) { host.innerHTML = ""; return; }
    host.innerHTML = `<h4>Mayan swaps</h4>` + records.map(r => `<p class="tag" data-mayan-line="${esc(r.id)}"></p>`).join("");
    host.querySelectorAll("[data-mayan-line]").forEach((el, i) => { el.textContent = mayanSwapHistoryLine(records[i]); });
  }
  paintMayanSwaps();
  pollMayanSwapStatuses(localStorage).then(() => paintMayanSwaps()).catch(() => {});
  // Gas-fallback two-step swaps, same conventions: the persisted
  // record is the recovery key; a record whose first leg landed
  // surfaces its line plus the one-tap "Complete the swap"
  // button (the user holds the native token throughout — the
  // completion is a fresh same-chain swap, signed on tap).
  const recordEvmApprovalGfb = (rec) => {
    try {
      const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
      list.unshift({ chainKey: rec.chainKey, token: rec.token, tokenSymbol: sanitizePersistedSymbol(rec.tokenSymbol), spender: rec.spender, amount: rec.decimals != null ? swapRawToAmount(rec.amount, rec.decimals) : rec.amount, at: rec.at });
      localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
    } catch { /* the approvals list is a nicety, never a blocker */ }
  };
  function paintGasFallbackSwaps() {
    const host = $("wGasFallback"); if (!host) return;
    const records = loadGasFallbackRecords(localStorage);
    if (!records.length) { host.innerHTML = ""; return; }
    host.innerHTML = `<h4>Two-step swaps</h4>` + records.map(r => `<p class="tag" data-gfb-line="${esc(r.id)}"></p>`).join("");
    host.querySelectorAll("[data-gfb-line]").forEach((el, i) => {
      const r = records[i];
      el.textContent = gasFallbackHistoryLine(r);
      if (gasFallbackNeedsAction(r)) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = "Complete the swap";
        b.onclick = async () => {
          b.disabled = true;
          try {
            await completeGasFallbackSwap(wallet, r.id, (t) => msg("wMsg", t, true), { storage: localStorage, onApprove: recordEvmApprovalGfb });
            msg("wMsg", "Swap complete ✓");
          } catch (e) { msg("wMsg", String(e?.shortMessage || e?.message || e)); }
          paintGasFallbackSwaps();
        };
        el.appendChild(document.createTextNode(" "));
        el.appendChild(b);
      }
    });
  }
  paintGasFallbackSwaps();
  advanceGasFallbackRecords(localStorage).then(() => paintGasFallbackSwaps()).catch(() => {});
  function renderPickList(side) {
    const netKey = netSel[side];
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
      show(P.from.netPanel, false); show(P.to.netPanel, false);
      if (opening) { show(P[side].panel, true); renderPickList(side); }
    };
    $(P[side].search).addEventListener("input", () => renderPickList(side));
    $(P[side].netBtn).onclick = () => {
      const opening = $(P[side].netPanel).classList.contains("hidden");
      show(P.from.panel, false); show(P.to.panel, false);
      show(P.from.netPanel, false); show(P.to.netPanel, false);
      if (opening) { show(P[side].netPanel, true); renderNetList(side); }
    };
    $(P[side].netSearch).addEventListener("input", () => renderNetList(side));
  }
  setPick("from", defaultTok("from", fromKey0));
  setPick("to", defaultTok("to", toKey0));
  syncDestRow();
  ensureStableTokens(fromKey0).then(() => ensureSwapList(fromKey0));
  ensureStableTokens(toKey0).then(() => ensureSwapList(toKey0));
  $("wFlip").onclick = async () => {
    const fn = netSel.from, tn = netSel.to;
    if (fn === "bitcoin" || fn === "lightning" || tn === "bitcoin" || tn === "lightning")
      return msg("wMsg", "Bitcoin and Lightning are receive-only swap destinations — they can't be a swap source.");
    const fTok = pick.from, tTok = pick.to;
    setNetValue("from", tn); setNetValue("to", fn);
    show(P.from.panel, false); show(P.to.panel, false);
    show(P.from.netPanel, false); show(P.to.netPanel, false);
    await ensureStableTokens(tn); await ensureStableTokens(fn);
    setPick("from", findTok(tn, tTok) || defaultTok("from", tn));
    setPick("to", findTok(fn, fTok) || defaultTok("to", fn));
    ensureSwapList(tn).then(() => { const nt = findTok(tn, tTok); if (nt) setPick("from", nt); });
    ensureSwapList(fn).then(() => { const nt = findTok(fn, fTok); if (nt) setPick("to", nt); });
    msg("wMsg", "");
  };
  const searchRoutes = async () => {
    await ensureStableTokens(netSel.from);
    await ensureStableTokens(netSel.to);
    const fromKey = netSel.from, toKey = netSel.to;
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
      // Satora destinations take their destination from the input
      // row: the Bitcoin address (defaulted to the user's Taproot
      // address) or the pasted Lightning invoice / address / LNURL.
      let destInput = "";
      if (toKey === "bitcoin" || toKey === "lightning") {
        destInput = ($("wDestAddr").value || "").trim();
        if (toKey === "bitcoin" && !destInput) { try { destInput = bitcoinTaprootAddress(wallet.mnemonic.phrase); } catch { /* handled below */ } }
        if (!destInput) return msg("wMsg", toKey === "bitcoin" ? "Enter the Bitcoin address to receive at." : "Paste the Lightning invoice, Lightning address or LNURL to pay first.");
        if (toKey === "lightning" && classifyLightningTarget(destInput).kind === "fluid-name") {
          // Completion audit §5.6.3 — Satora as a name consumer: a
          // registered Lightning ADDRESS passes through as the swap
          // destination; a registered node OFFER gets a plain refusal
          // (Satora pays invoices, addresses and LNURLs — it cannot
          // pay a raw BOLT 12 offer).
          const hit = await resolveFluidName(destInput).catch(() => null);
          const t = hit ? lightningTargetForNameEntry(hit) : null;
          if (!t) return msg("wMsg", "That Fluid name has no Lightning address or node offer in the registry.");
          if (t.kind === "offer") return msg("wMsg", "That name receives through its own Fluid node's offer — this swap pays Lightning invoices, addresses and LNURLs, and can't pay a raw offer. Pay the offer directly from the Lightning panel instead (Wallet tab → Lightning).");
          destInput = t.value;
        }
      }
      const routes = await getSwapRoutes({
        fromChainKey: fromKey, toChainKey: toKey,
        fromTokenAddress: fromTok.address, toTokenAddress: toTok.address,
        fromAmount: swapAmountToRaw(amount, fromTok.decimals),
        fromAddress: addrOf(fromKey),
        toAddress: (toKey === "bitcoin" || toKey === "lightning") ? destInput : addrOf(toKey),
      });
      if (!routes.length) return msg("wMsg", "No route found for that pair and amount. Try a different pair or a larger amount.");
      const ranked = rankSwapRoutes(routes, Number(toTok.priceUSD) || null).slice(0, 3);
      msg("wMsg", "");
      $("wList").innerHTML = ranked.map((r, i) => {
        const ex = swapRouteExecutable(r);
        const badges = `${r.cheapest ? '<span class="pill">CHEAPEST</span> ' : ""}${r.fastest ? '<span class="pill">FASTEST</span> ' : ""}`;
        const recv = fmt(swapRawToAmount(r.toAmount, toTok.decimals));
        return `<button class="netitem" data-route="${i}" ${ex.ok ? "" : "disabled style=\"opacity:.45\""}>
            <span>${badges}${recv} ${esc(toTok.symbol)}<br><small style="color:var(--dim)">${esc(swapRouteName(r))} · ${swapDurationText(r.durationSec)} · ${swapRouteCostLabel(r).text} ≈ ${usd(swapRouteCostLabel(r).usd)}${r.usdMismatch ? " · ⚠ quoted value disagrees with the market price" : ""}</small></span>
            <span>${usd(r.toAmountUSD)}</span></button>
          ${ex.ok ? "" : `<p class="tag" style="margin:2px 0 8px">${esc(ex.reason)}</p>`}`;
      }).join("");
      document.querySelectorAll("[data-route]").forEach(b => b.onclick = async () => {
        if (b.disabled) return;
        const r = ranked[Number(b.dataset.route)];
        pendingSwap = { route: r, fromKey, toKey, fromTok, toTok, amount };
        if (r.provider === "satora") {
          // Receivability gate first (Lightning): an invoice paying
          // the user's own channel-less Lightning wallet is blocked
          // before any review is offered.
          if (toKey === "lightning") {
            // Completion audit §5.6/Phase 0.5: if the node has never
            // been booted this session, boot it now so the gate
            // judges with the real node id + receivable (and can
            // recognise a JIT invoice through its local record). A
            // failed boot doesn't block the swap — the gate then
            // runs exactly as it did before this build.
            if (!lnSession) { try { await lnEnsureSession("bitcoin"); } catch { /* gate falls back */ } }
            let jit = null;
            try { jit = lnJitGateContext(parseBolt11(destInput)); } catch { jit = null; }
            const gate = checkSatoraLightningReceivability({
              destInput,
              ownNodeId: lnSession ? lnSession.nodeId : null,
              ownReceivableMsat: lnSession ? lnSession.balance().receivableMsat : null,
              jit,
            });
            if (!gate.ok) { pendingSwap = null; show("wConfirm", false); return msg("wMsg", gate.reason); }
          }
          // The Satora review sentence is self-contained (full fee
          // stack + destination + refund truth in core's words), so
          // it replaces the generic disclosure below; Confirm is
          // live — confirming runs the executor, which re-verifies
          // the creation record, the funding payload and the
          // Permit2 witness field by field before signing.
          $("wIntentText").textContent = formatSatoraSwapIntent({ route: r, destInput });
          $("wDo").disabled = false;
          show("wConfirm"); msg("wMsg", "");
          return;
        }
        $("wDo").disabled = false;
        // Fluid's own fee, disclosed as its own clause in the confirm
        // sentence, priced by the fee model (a markup on the route's
        // own cost, capped at 0.5% — core's two-pass search set the
        // rate) and recomputed from THIS final quote's own numbers —
        // never a typed-in number. Relay states the fee it will
        // actually take in its quote (platformFeeUsd, parsed from
        // fees.app) but may skip collecting dust-sized fees, and its
        // quote says so (platformFeeCollecting); LI.FI charges the
        // bps the search attached to this route (platformFeeBps)
        // out of fromAmount, priced here by the quote itself. Only
        // where the route actually collects: LI.FI attaches the fee
        // per source chain only where its portal fee wallet is
        // registered (swapFeeCollectingChain) — no fee is disclosed
        // on a route that will not charge it.
        const collects = r.provider === "relay" ? r.platformFeeCollecting === true : swapFeeCollectingChain(r.fromChainId);
        let platformFeeUsd = null, platformFeePct = null;
        if (collects && r.provider === "relay" && Number(r.platformFeeUsd) > 0) {
          platformFeeUsd = Number(r.platformFeeUsd);
          const amtUsd = Number(r.fromAmountUSD);
          if (amtUsd > 0) platformFeePct = (platformFeeUsd / amtUsd) * 100;
        } else if (r.provider === "across" && r.platformFeeCollecting === true && Number(r.platformFeeUsd) > 0) {
          // Across states the fee it will actually take in its
          // quote (platformFeeUsd, parsed from fees.total's app
          // component) and collects it inside the fill — disclose
          // exactly that figure, like Relay's.
          platformFeeUsd = Number(r.platformFeeUsd);
          const amtUsd = Number(r.fromAmountUSD);
          if (amtUsd > 0) platformFeePct = (platformFeeUsd / amtUsd) * 100;
        } else if (r.provider === "jupiter" && r.platformFeeCollecting === true && Number(r.platformFeeUsd) > 0) {
          // Jupiter deducts the fee from the swap's OUTPUT inside
          // the aggregator program; core derived the charged figure
          // from the final build's own gross-vs-net output
          // (platformFeeUsd) — disclose exactly that figure, like
          // Across's. (The generic LI.FI branch below must never
          // price a Jupiter fee: it would read the bps off the
          // INPUT amount, the wrong mint entirely.)
          platformFeeUsd = Number(r.platformFeeUsd);
          const amtUsd = Number(r.fromAmountUSD);
          if (amtUsd > 0) platformFeePct = (platformFeeUsd / amtUsd) * 100;
        } else if (r.provider === "gasfallback" && r.platformFeeCollecting === true && Number(r.platformFeeUsd) > 0) {
          // Gas-fallback composite: core summed BOTH legs' fees
          // under the law into platformFeeUsd at quote time —
          // disclose exactly that figure, like Mayan's.
          platformFeeUsd = Number(r.platformFeeUsd);
          const amtUsd = Number(r.fromAmountUSD);
          if (amtUsd > 0) platformFeePct = (platformFeeUsd / amtUsd) * 100;
        } else if (r.provider === "mayan" && r.platformFeeCollecting === true && Number(r.platformFeeUsd) > 0) {
          // Mayan states the fee it will actually take in the
          // final quote's own referrerFeeUsd (paid in the source
          // asset on a Swift, in destination USDC on a Fast
          // MCTP) — disclose exactly that figure, like Across's.
          // (The generic LI.FI branch below must never price a
          // Mayan fee: it would read the bps off the input
          // amount in the wrong asset and chain.)
          platformFeeUsd = Number(r.platformFeeUsd);
          const amtUsd = Number(r.fromAmountUSD);
          if (amtUsd > 0) platformFeePct = (platformFeeUsd / amtUsd) * 100;
        } else if (collects && Number(r.platformFeeBps) > 0 && r.fromAmount != null) {
          const feeRaw = platformFeeOn(r.fromAmount, Number(r.platformFeeBps));
          const amtRaw = Number(r.fromAmount), amtUsd = Number(r.fromAmountUSD);
          if (feeRaw > 0n && amtRaw > 0 && amtUsd > 0) {
            platformFeeUsd = (Number(feeRaw) / amtRaw) * amtUsd;
            platformFeePct = (platformFeeUsd / amtUsd) * 100;
          }
        }
        $("wIntentText").textContent = formatSwapIntent({
          fromAmount: amount, fromSymbol: fromTok.symbol, fromNetKey: fromKey,
          toAmount: fmt(swapRawToAmount(r.toAmount, toTok.decimals)), toSymbol: toTok.symbol, toNetKey: toKey,
          toolName: swapRouteName(r), feeUsd: r.gasCostUSD, durationSec: r.durationSec,
          ...(platformFeeUsd != null ? { platformFeeUsd, platformFeePct } : {}),
        }) + ((fromTok.verified === false || toTok.verified === false) ? " ⚠ " + UNVERIFIED_CAUTION : "");
        if (r.provider === "across") $("wIntentText").textContent += " If the bridge does not fill, your deposit is refunded automatically to this same wallet — refunds take several hours, never seconds.";
        if (r.provider === "mayan") $("wIntentText").textContent += formatMayanRefundNote(r);
        // Destination gas (2026-11-11): the plan's one plain line —
        // the drop alongside, the two-step fallback, or the honest
        // warning — appended to the review before the user confirms.
        // It is the user's own swap slice, never the fee (the fee
        // clause above stays separate and unchanged).
        const gasLine = formatDestGasLine(r);
        if (gasLine) $("wIntentText").textContent += " " + gasLine;
        show("wConfirm"); msg("wMsg", "");
      });
    } catch (e) {
      if (e && e.satoraBelowFloor && e.satoraBelowFloor.destKey === "bitcoin" && netSel.to === "bitcoin") {
        paintBtcFloorWayThrough(e.satoraBelowFloor);
        msg("wMsg", "");
      } else msg("wMsg", "Route search failed: " + String(e.shortMessage || e.message || e).replace(/^Route search failed:\s*/, ""));
    }
  };
  $("wRoutes").onclick = searchRoutes;
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
      if (route.provider === "gasfallback") {
        // Destination-gas fallback (2026-11-11): two legs, ONE
        // confirmation — leg 1 lands the destination's native
        // token, leg 2 swaps into the target leaving the gas
        // reserve behind. Core orchestrates both legs and
        // persists the record; if leg 2 cannot complete, its
        // error says exactly where the money is (the native
        // token, in the user's wallet, movable) and the sheet's
        // "Complete the swap" button finishes it later.
        const out = await executeGasFallbackRoute(wallet, route, (t) => msg("wMsg", t, true), { storage: localStorage, onApprove: recordEvmApproval });
        hashes = out.hashes;
        srcExplorer = fromKey === "solana" ? SOLANA_EXPLORER : fromKey === "tron" ? TRON_EXPLORER : fromKey === "sui" ? SUI_EXPLORER : NETWORKS[fromKey].explorer;
        if (fromKey === "solana") srcLink = `${SOLANA_EXPLORER}/tx/${hashes[0]}`;
        else if (fromKey === "tron") srcLink = `${TRON_EXPLORER}/#/transaction/${hashes[0]}`;
        else if (fromKey === "sui") srcLink = `${SUI_EXPLORER}/mainnet/tx/${hashes[0]}`;
        try { paintGasFallbackSwaps(); } catch { /* the list repaints on sheet open regardless */ }
      } else if (route.provider === "satora") {
        // Satora route (Bitcoin / Lightning destinations): the
        // executor creates the swap, persists its id, verifies
        // the funding payload + the Permit2 witness field by
        // field, signs with the wallet's EVM key and submits to
        // the gasless relay — the returned hash is the relay's
        // funding transaction on the SOURCE chain. For Base /
        // Solana USDC sources it first drives the CCTP crossing
        // (burn id persisted before broadcast) and the returned
        // hashes lead with the burn; resume completes a crossing
        // still in flight. The persisted record joins the Satora
        // swaps list in this sheet, whose polling tracks it.
        hashes = await executeSatoraSwapRoute(wallet, route, (t) => msg("wMsg", t, true), { storage: localStorage, onApprove: recordEvmApproval });
        // Bridge sources: the source chain may be Solana (no
        // NETWORKS entry) — its explorer is the Solana one.
        srcExplorer = fromKey === "solana" ? SOLANA_EXPLORER : NETWORKS[fromKey].explorer;
        try { paintSatoraSwaps(); } catch { /* the list repaints on sheet open regardless */ }
      } else if (route.provider === "relay") {
        // Relay route (primary router): EVM source by construction —
        // its steps are complete transactions, bounds-checked in core.
        hashes = await executeRelaySwapRoute(wallet, route, (t) => msg("wMsg", t, true), recordEvmApproval);
        srcExplorer = NETWORKS[fromKey].explorer;
      } else if (route.provider === "across") {
        // Across route (same-asset EVM majors): one SpokePool
        // deposit, bounds-checked in core; Fluid composes its own
        // exact-amount approval — the API's is unlimited and is
        // never used.
        hashes = await executeAcrossSwapRoute(wallet, route, (t) => msg("wMsg", t, true), recordEvmApproval);
        srcExplorer = NETWORKS[fromKey].explorer;
      } else if (route.provider === "jupiter") {
        // Jupiter route (Solana same-chain primary): Fluid
        // assembled the transaction itself from the decomposed
        // instructions and signs with the wallet's Solana key —
        // checked BEFORE the generic Solana branch below, whose
        // executor expects LI.FI step payloads a Jupiter route
        // does not carry.
        hashes = await executeJupiterSwapRoute(wallet.mnemonic.phrase, route, (t) => msg("wMsg", t, true));
        srcExplorer = SOLANA_EXPLORER;
        srcLink = `${SOLANA_EXPLORER}/tx/${hashes[0]}`;
      } else if (route.provider === "mayan") {
        // Mayan route (ranked candidate — it is here because it
        // quoted cheapest): EVM sources sign the bounds-checked
        // Forwarder payload in core; Solana sources sign the
        // locally assembled instruction set with the wallet's
        // Solana key. Checked BEFORE the generic Solana branch
        // below, whose executor expects LI.FI step payloads.
        // The swap is then tracked by its source hash in the
        // Mayan history (statuses polled from Mayan's explorer).
        hashes = await executeMayanSwapRoute(wallet, route, (t) => msg("wMsg", t, true), (rec) => {
          const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
          list.unshift({ chainKey: fromKey, token: fromTok.address, tokenSymbol: sanitizePersistedSymbol(fromTok.symbol), spender: rec.spender, amount: rec.amount, at: Date.now() });
          localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
        });
        saveMayanSwapRecord(localStorage, {
          id: hashes[0], status: "INPROGRESS",
          routeType: route.mayan.routeType, fromChainKey: fromKey, toChainKey: toKey,
          deadline64: route.mayan.deadline64, at: Date.now(), updatedAt: Date.now(),
        });
        if (fromKey === "solana") { srcExplorer = SOLANA_EXPLORER; srcLink = `${SOLANA_EXPLORER}/tx/${hashes[0]}`; }
        else srcExplorer = NETWORKS[fromKey].explorer;
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
      const destAddr = route.provider === "satora" ? (route.satora.destInput || wallet.address) : toKey === "solana" ? solAddr : toKey === "tron" ? tronAddr : toKey === "sui" ? suiAddr : wallet.address;
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
/** A found transaction's result card (audit P1-16). */
function renderScanTxid(r) {
  $("scanResults").innerHTML = `<div class="card"><b>${esc(r.label)}</b>
    <p class="tag" style="margin:6px 0 0">${esc(r.detail || "")}</p>
    ${r.url ? `<p style="margin:10px 0 0"><a href="${esc(r.url)}" target="_blank" rel="noopener">View in explorer ↗</a></p>` : ""}</div>`;
}
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
  // Transaction ids route to a transaction lookup, never to an
  // address page (audit P1-16: a pasted Base tx hash used to land
  // on an empty SUI address result, and a Solana signature got no
  // lookup at all). The 0x-hash case is ambiguous with a Sui
  // address, so its lookup runs first and only a miss falls
  // through to the address scan below.
  const txid = detectScanTxid(input);
  if (txid) {
    const r = await fetchScanTxid(txid).catch(() => ({ found: false, unknown: true }));
    if (seq !== scanSeq) return;
    if (r.found) { btn.disabled = false; btn.textContent = "Search"; renderScanTxid(r); return; }
    if (txid.kind !== "evm") {
      btn.disabled = false; btn.textContent = "Search";
      scanMsg(r.unknown
        ? "Couldn't check that transaction ID just now — check your connection and try again."
        : txid.kind === "solana"
          ? "No Solana transaction has that signature."
          : "No transaction with that ID was found on Bitcoin or Tron — check the ID and try again.", true);
      return;
    }
  }
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

// ---------- seed backup quiz (audit P1-1) ----------
/** The phrase as a numbered grid — position is what the quiz
 *  challenges, so the words are never shown as one unnumbered line. */
function seedGridHtml(phrase) {
  return String(phrase || "").trim().split(/\s+/).map((w, i) => `<span class="seedword"><b>${i + 1}</b> ${esc(w)}</span>`).join("");
}
/** Mount the backup word quiz into a container. The user PICKS
 *  the correct word for each challenged position from decoy
 *  options (MetaMask pattern — selection, never typing). Retries
 *  are unlimited; a failed check keeps the correct picks and
 *  clears only the wrong ones. The quiz never locks anything:
 *  onLater always proceeds with the backup honestly unconfirmed,
 *  and onWords returns to the phrase (the caller re-mounts a
 *  fresh quiz when the user comes back to the check). */
function mountSeedQuiz(container, phrase, { onPass, onLater, onWords }) {
  const quiz = buildSeedQuiz(phrase);
  const picks = new Array(quiz.challenges.length).fill(null);
  container.innerHTML = `
    <p><b>Prove the backup works.</b> Pick the word that belongs at each position — the words from the paper you just wrote. If the words on paper are wrong, this is the only moment that can still be fixed.</p>
    ${quiz.challenges.map((c, ci) => `
      <p class="tag" style="margin:12px 0 4px">Word #${c.position}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${c.options.map(w => `<button class="btn ghost" data-quiz-opt="${ci}" data-word="${esc(w)}" style="width:auto;padding:8px 14px">${esc(w)}</button>`).join("")}
      </div>`).join("")}
    <p class="msg err" data-quiz-msg></p>
    <button class="btn" data-quiz-go disabled>Check my words</button>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn ghost" data-quiz-words style="flex:1">See the words again</button>
      <button class="btn ghost" data-quiz-later style="flex:1">I'll confirm later</button>
    </div>`;
  const msgEl = container.querySelector("[data-quiz-msg]");
  const goBtn = container.querySelector("[data-quiz-go]");
  const paintPicks = () => {
    container.querySelectorAll("[data-quiz-opt]").forEach(b => {
      const sel = picks[Number(b.dataset.quizOpt)] === b.dataset.word;
      b.style.borderColor = sel ? "var(--brand-1)" : "";
      b.style.background = sel ? "var(--brand-1)" : "";
      b.style.color = sel ? "#000" : "";
    });
    goBtn.disabled = picks.some(p => p == null);
  };
  container.querySelectorAll("[data-quiz-opt]").forEach(b => b.onclick = () => {
    picks[Number(b.dataset.quizOpt)] = b.dataset.word;
    msgEl.textContent = "";
    paintPicks();
  });
  goBtn.onclick = () => {
    if (seedQuizPassed(quiz, picks)) { onPass(); return; }
    seedQuizResults(quiz, picks).forEach((okPick, ci) => { if (!okPick) picks[ci] = null; });
    msgEl.textContent = "Not quite — the rows left empty aren't the words from your phrase. Try again, or look at the words again. There's no limit, and nothing is locked.";
    paintPicks();
  };
  container.querySelector("[data-quiz-words]").onclick = () => onWords();
  container.querySelector("[data-quiz-later]").onclick = () => onLater();
  paintPicks();
}

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
  // Claim durability (agent kit, 2026-11-09): bind the chosen name to
  // this wallet and persist the pending-claim intent AT THE CREATE
  // CLICK — before the seed ceremony. If the session dies on the seed
  // screen (the cold-start F3/F4 hole: vault existed, but no name, no
  // record, no notice), the wallet reopens knowing the claim is still
  // owed: the record paints "saved" until submitNameClaim replaces it
  // with the signed claim — at ceremony finish, or at the next
  // unlock's resumePendingClaim(). The address is not known until the
  // vault is unlocked, so the intent record carries evm: null; the
  // signed claim record supersedes it wholesale.
  localStorage.setItem("fluid_name", wantName);
  savePendingClaim({ name: wantName, evm: null, published: false, submittedAt: Date.now(), awaitingSubmit: true });
  // Backup state (audit P1-1), persisted at the same moment for the
  // same reason: this wallet's seed backup starts UNCONFIRMED and
  // only the word quiz below turns it "confirmed". If the session
  // dies on the seed screen, the wallet reopens with the state
  // honestly "pending" and the home reminder standing.
  try { localStorage.setItem(BACKUP_STATE_KEY, "pending"); } catch { /* storage unavailable */ }
  $("seedOut").innerHTML = seedGridHtml(v.phrase);
  show("seedBox");
  show("seedWordsView", true);
  show("seedQuizBox", false);
  msg("onboardMsg", "Wallet created. Write the seed down, tick the box, then continue.", true);
  // Entering the wallet happens exactly once, by either quiz path:
  // passed (backup confirmed) or deferred (backup honestly
  // unconfirmed, home reminder standing). The name claim below is
  // part of creation either way — deferring the backup check never
  // defers the name, and the quiz never bricks the wallet.
  const finishCreate = async (backupConfirmed) => {
    if (backupConfirmed) { try { localStorage.setItem(BACKUP_STATE_KEY, "confirmed"); } catch { /* storage unavailable */ } }
    wallet = await unlockVault(v.keystore, pw);
    if (pendingName) {
      const claimed = pendingName; pendingName = null;
      localStorage.setItem("fluid_name", claimed);
      // No savePendingClaim(null) clear here: the create-click intent
      // record stands until submitNameClaim's own persist-first write
      // supersedes it — clearing first would reopen the interruption
      // hole if the submit throws before its write.
      // The claim is submitted automatically now that the keys exist
      // (NAMES RESOLUTION RULE, 2026-11-09): creation is not complete
      // until the name verifies as resolving from the published
      // registry — the wait sheet polls for exactly that. The only
      // bypass is the explicit continue-without-a-name choice on it.
      let accepted = 0;
      try { accepted = await submitNameClaim(claimed, null); } catch { accepted = 0; }
      showNameCreationWait(claimed, accepted);
      return;
    }
    refreshGate();
  };
  $("seedDoneBtn").onclick = () => {
    if (!$("seedCheck").checked) return msg("onboardMsg", "Tick the box confirming you wrote the seed down.");
    // The checkbox alone was attestation, not a check (audit
    // P1-1): run the word quiz. Passing confirms the backup;
    // "I'll confirm later" enters anyway, unconfirmed; "See the
    // words again" returns here and this button re-mounts a FRESH
    // quiz — retries are unlimited and nothing is ever locked.
    msg("onboardMsg", "");
    show("seedWordsView", false);
    show("seedQuizBox", true);
    mountSeedQuiz($("seedQuizBox"), v.phrase, {
      onPass: () => finishCreate(true),
      onLater: () => finishCreate(false),
      onWords: () => { show("seedQuizBox", false); show("seedWordsView", true); },
    });
  };
};
$("importBtn").onclick = async () => {
  const pw = $("createPw").value;
  if (!validatePassword(pw)) return msg("onboardMsg", "Set a password (12+ characters) above first.");
  // Import-with-new-name: a username typed in the box above is part
  // of this onboarding (NAMES RESOLUTION RULE) — validate its format
  // BEFORE importing, so a bad name fails here, not after the wallet
  // has already been replaced.
  const wantName = normalizeFluidName($("createName").value);
  if ($("createName").value.trim() && !validateFluidName(wantName)) return msg("onboardMsg", "Username must be 3-20 chars: letters, numbers, underscore; start with a letter — or clear the username field to import without claiming a name.");
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
    localStorage.removeItem(NAME_CLAIM_KEY);
    // Same scoping for the backup state (audit P1-1): it belonged
    // to the replaced wallet. Import itself has no backup step —
    // the imported phrase is the user's existing backup — so the
    // imported wallet starts with no state and no reminder.
    localStorage.removeItem(BACKUP_STATE_KEY);
    nameAdoptTried = false;
    wallet = await unlockVault(v.keystore, pw);
    if (wantName) {
      // Claim durability (agent kit, 2026-11-09): record the owed
      // claim BEFORE any await that could be interrupted — the same
      // rule as the create click. submitNameClaim supersedes the
      // record when it runs; the adopt path clears it; the conflict
      // path leaves it for the name section's conflict paint.
      localStorage.setItem("fluid_name", wantName);
      savePendingClaim({ name: wantName, evm: wallet.address, published: false, submittedAt: Date.now(), awaitingSubmit: true });
      const hit = await resolveFluidName(wantName).catch(() => null);
      if (hit && hit.evm && String(hit.evm).toLowerCase() === String(wallet.address).toLowerCase()) {
        // Already published to THIS wallet — resolvable as-is, no
        // wait needed: adopt it and finish.
        localStorage.setItem("fluid_name", wantName);
        savePendingClaim(null);
        refreshGate();
        return;
      }
      if (hit) {
        // Registered to a DIFFERENT wallet: creation must not
        // complete under this name — the wait sheet opens in its
        // conflict state (pick a different name, or continue
        // without a username).
        localStorage.setItem("fluid_name", wantName);
        showNameCreationWait(wantName, 0, { startConflict: true });
        return;
      }
      // New name for this wallet: submit the signed claim and wait
      // on the registry read, exactly like a fresh creation.
      let accepted = 0;
      try { accepted = await submitNameClaim(wantName, null); } catch { accepted = 0; }
      showNameCreationWait(wantName, accepted);
      return;
    }
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
    // Satora swap polling resumes on unlock: persisted swap ids are
    // the recovery key, so any swap left in flight by a reload or a
    // locked session picks its status back up here, then keeps
    // polling while the wallet stays unlocked.
    pollSatoraSwapStatuses(localStorage).catch(() => {});
    resumeSatoraBridgedSwaps(wallet, localStorage).catch(() => {});
    if (!satoraPollTimer) satoraPollTimer = setInterval(() => { if (wallet) { pollSatoraSwapStatuses(localStorage).catch(() => {}); resumeSatoraBridgedSwaps(wallet, localStorage).catch(() => {}); } }, 60000);
    // Mayan swap polling resumes on unlock on the same terms
    // (source hashes are the recovery key).
    pollMayanSwapStatuses(localStorage).catch(() => {});
    if (!mayanPollTimer) mayanPollTimer = setInterval(() => { if (wallet) pollMayanSwapStatuses(localStorage).catch(() => {}); }, 60000);
    // Gas-fallback records advance on the same cadence: a landed
    // first leg becomes the sheet's "Complete the swap" action.
    advanceGasFallbackRecords(localStorage).catch(() => {});
    if (!gfbPollTimer) gfbPollTimer = setInterval(() => { if (wallet) advanceGasFallbackRecords(localStorage).catch(() => {}); }, 60000);
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
// ---------- signed name claims: publish from inside the app ----------
// The device-held claim record (fluid_name_claim) is the signed claim
// JSON plus its publish state. It is written BEFORE anything is sent
// (persist-first), so a claim that fails to reach any relay stays in
// the saved state with its Publish button — never silently lost, and
// never presented as live.
function loadPendingClaim() {
  try { const p = JSON.parse(localStorage.getItem(NAME_CLAIM_KEY) || "null"); return p && typeof p === "object" ? p : null; }
  catch { return null; }
}
function savePendingClaim(p) {
  try { if (p) localStorage.setItem(NAME_CLAIM_KEY, JSON.stringify(p)); else localStorage.removeItem(NAME_CLAIM_KEY); } catch { /* storage unavailable */ }
}
/** Sign this wallet's claim for `name` and publish it to the relays.
 *  Resolves the number of relays that accepted (≥1 = publishing).
 *  Throws only when the claim cannot be built or verified locally.
 *  `lnOffer` carries the wallet's own BOLT 12 node offer (the
 *  Fluid-native Lightning registration); the processor merges it
 *  into an already-live entry as a same-owner update.
 *  `lnBridge` is the external-payments opt-in flag: pass true/false
 *  to state it outright; when omitted, the claim states THIS
 *  device's bridge state (registered here = on) — every claim the
 *  app signs says where the flag stands, because the processor
 *  takes a verified same-owner claim's word for the flag (that is
 *  what lets an opt-out republish clear it). */
async function submitNameClaim(name, ln, lnOffer = null, lnBridge = undefined) {
  if (!wallet) throw new Error("Unlock your wallet first.");
  const phrase = wallet.mnemonic.phrase;
  const bridgeFlag = lnBridge !== undefined ? lnBridge : (loadLnBridgeState(wallet.address) ? true : null);
  const { claim, event } = await buildSignedNameClaim({
    name, evm: wallet.address,
    btc: bitcoinAddress(phrase), ln: ln || null, lnOffer: lnOffer || null, lnBridge: bridgeFlag || null,
    algo: algoAddressFromPhrase(phrase), sol: solanaAddressFromPhrase(phrase),
    tron: tronAddressFromPhrase(phrase), sui: suiAddressFromPhrase(phrase),
    phrase, signerWallet: wallet,
  });
  savePendingClaim({ ...claim, eventId: event.id, published: false, submittedAt: Date.now() });
  localStorage.setItem("fluid_name", claim.name);
  let accepted = 0, detail = null;
  try { detail = await publishNameClaimEventDetailed(event); accepted = detail.accepted; } catch { accepted = 0; }
  const held = loadPendingClaim();
  if (held && held.eventId === event.id) {
    held.published = accepted > 0;
    held.relaysAccepted = accepted;
    // Durable record (audit P0-1): WHICH relays accepted + when —
    // the repair truth check keys off publishedAt, and the record
    // is what lets a later session tell "in flight" from "lost".
    if (detail) held.acceptedRelays = detail.acceptedRelays;
    if (accepted > 0) held.publishedAt = Date.now();
    savePendingClaim(held);
  }
  return accepted;
}
let namePollTimer = null;
function stopNamePoll() { if (namePollTimer) { clearInterval(namePollTimer); namePollTimer = null; } }
function ensureNamePoll() {
  if (namePollTimer) return;
  namePollTimer = setInterval(() => {
    if (!wallet) { stopNamePoll(); return; }
    const p = loadPendingClaim();
    if (!p || !p.published) { stopNamePoll(); return; }
    renderNameSection();
  }, 20000);
}
// ---------- claim durability: resume + Home surface (agent kit, 2026-11-09) ----------
// The create/import click persists a pending-claim intent record
// BEFORE the seed ceremony (see createBtn). These two functions are
// the reopening half of that promise: an interrupted creation must
// reopen to a wallet that KNOWS it has a claim in flight.
let claimResumeTried = false;
/** Finish a claim that was recorded but never submitted (the session
 *  died before the ceremony completed). Once the wallet is unlocked
 *  the keys exist, so submit exactly as the ceremony would have.
 *  Once per session; a failed submit leaves the record in the saved
 *  state, whose Publish button (More → Your Fluid name) finishes it. */
async function resumePendingClaim() {
  if (claimResumeTried || !wallet) return;
  const p = loadPendingClaim();
  if (!p || p.published || p.eventId || !p.name) return;
  if (localStorage.getItem("fluid_name") !== p.name) return;
  claimResumeTried = true;
  try { await submitNameClaim(p.name, p.ln || null, p.lnOffer || null); } catch { /* the saved state + Publish button remain */ }
  renderNameSection();
  refreshHomeClaimBanner();
}
/** Home surface for an in-flight claim: until the name verifies LIVE
 *  in the registry, Home says so — the same nameClaimState +
 *  NAME_STATE_COPY the More card paints, registry-refined. The
 *  button leads to the More-tab name card, whose state paint owns
 *  the existing one-tap Publish / Publish again actions. A record
 *  whose claim belongs to a different wallet is never surfaced. */
async function refreshHomeClaimBanner() {
  const card = $("homeClaimCard"); if (!card) return;
  const p = loadPendingClaim();
  const stored = localStorage.getItem("fluid_name");
  if (!wallet || !p || !stored || p.name !== stored) { card.classList.add("hidden"); return; }
  if (p.evm && String(p.evm).toLowerCase() !== String(wallet.address).toLowerCase()) { card.classList.add("hidden"); return; }
  let hit = null;
  try { hit = await resolveFluidName(stored); } catch { hit = null; }
  if (!wallet) return;
  const st = nameClaimState({ stored, pending: p, registryHit: hit, myEvm: wallet.address });
  if (st === "live") { savePendingClaim(null); card.classList.add("hidden"); renderNameSection(); return; }
  if (st === "none") { card.classList.add("hidden"); return; }
  $("homeClaimText").textContent = NAME_STATE_COPY[st] || "";
  $("homeClaimBtn").textContent = st === "repair" ? "Publish again" : st === "publishing" ? "View name status" : st === "conflict" ? "Pick a different name" : "Publish my name";
  card.classList.remove("hidden");
}
$("homeClaimBtn").onclick = () => {
  goTab("more");
  const owned = $("ownedNameBox"), form = $("claimForm");
  const el = owned && !owned.classList.contains("hidden") ? owned : form;
  if (el) setTimeout(() => { try { el.scrollIntoView({ block: "start" }); } catch { /* older engines */ } }, 60);
};
/** Home reminder for an unconfirmed seed backup (audit P1-1):
 *  shown while THIS wallet's backup state is "pending" — written
 *  at creation, turned "confirmed" only by passing the word quiz.
 *  Dismissal is per-session (sessionStorage); the card returns
 *  next session until the quiz passes. Wallets created before the
 *  state existed, and imported wallets, carry no state and are
 *  never nagged. */
function refreshHomeBackupCard() {
  const card = $("homeBackupCard"); if (!card) return;
  let showCard = false;
  try {
    showCard = !!wallet
      && localStorage.getItem(BACKUP_STATE_KEY) === "pending"
      && sessionStorage.getItem(BACKUP_DISMISS_KEY) !== "1";
  } catch { showCard = false; }
  card.classList.toggle("hidden", !showCard);
}
$("homeBackupDismiss").onclick = () => {
  try { sessionStorage.setItem(BACKUP_DISMISS_KEY, "1"); } catch { /* session storage unavailable — the card simply stays */ }
  refreshHomeBackupCard();
};
$("homeBackupBtn").onclick = () => {
  if (!wallet) return;
  openSheet(`<h3>Confirm your backup</h3><div id="backupQuizBox"></div>`);
  const mount = () => mountSeedQuiz($("backupQuizBox"), wallet.mnemonic.phrase, {
    onPass: () => {
      try { localStorage.setItem(BACKUP_STATE_KEY, "confirmed"); } catch { /* storage unavailable */ }
      refreshHomeBackupCard();
      closeSheet();
      toast("Backup confirmed — your words are right");
    },
    onLater: () => closeSheet(),
    onWords: () => {
      const box = $("backupQuizBox"); if (!box) return;
      box.innerHTML = `<p>Your 12 words, in order — check them against your paper, then take the check again.</p>
        <div class="seed">${seedGridHtml(wallet.mnemonic.phrase)}</div>
        <button class="btn" data-quiz-retry style="margin-top:10px">Back to the check</button>`;
      box.querySelector("[data-quiz-retry]").onclick = mount;
    },
  });
  mount();
};
/** Creation-time wait (NAMES RESOLUTION RULE, strengthened
 *  2026-11-09): after a wallet claims its name during onboarding
 *  (create, or import with a new name), creation is NOT complete
 *  until an actual registry read shows the name resolving to THIS
 *  wallet. The sheet shows what was submitted, what it is waiting
 *  for, and the elapsed time; it polls the published registry every
 *  10 seconds. It NEVER auto-completes on a timeout: past ~15
 *  minutes it offers keep waiting / retry the claim submission /
 *  continue without a username. The ONLY bypass is that explicit
 *  continue-without-a-username tap (dismissing the sheet is the
 *  same deliberate bypass, via the sheet-close hook). A registry
 *  read showing DIFFERENT addresses is a lost race: creation does
 *  not complete under that name — the sheet loops back to a name
 *  step (claim a different name) or the same bypass. */
function showNameCreationWait(name, accepted, { startConflict = false } = {}) {
  let currentName = name;
  let entryText = "";
  const rebuildEntryText = () => {
    const entry = buildNameEntry(currentName, wallet.address, bitcoinAddress(wallet.mnemonic.phrase), null, algoAddressFromPhrase(wallet.mnemonic.phrase), solanaAddressFromPhrase(wallet.mnemonic.phrase), tronAddressFromPhrase(wallet.mnemonic.phrase), suiAddressFromPhrase(wallet.mnemonic.phrase));
    entryText = JSON.stringify(entry).slice(1, -1) + ",";
  };
  rebuildEntryText();
  let settled = false;
  let poll = null, tick = null;
  let startedAt = Date.now();
  let longWaitDismissed = false;
  const stopTimers = () => { if (poll) { clearInterval(poll); poll = null; } if (tick) { clearInterval(tick); tick = null; } };
  const finish = () => { settled = true; stopTimers(); sheetCloseHook = null; closeSheet(); refreshGate(); };
  openSheet(`<h3 style="margin:4px 0" id="ncWaitTitle">Your name: ${esc(currentName)}.${FLUID_DOMAIN}</h3>
    <p class="tag" id="ncWaitStatus">${startConflict ? esc(NAME_STATE_COPY.conflict) : (accepted > 0 ? esc(NAME_STATE_COPY.publishing) : esc(NAME_STATE_COPY.saved))}</p>
    <p class="tag" id="ncSubmitted">Claim submitted for ${esc(currentName)}.${FLUID_DOMAIN} — signed with your wallet's key and sent to the public relays.</p>
    <p class="tag" id="ncWaiting">Waiting for ${esc(currentName)} to appear in the public registry, resolving to your wallet… elapsed <span id="ncElapsed">0:00</span></p>
    <button class="btn ${startConflict || accepted > 0 ? "hidden" : ""}" id="ncPublishBtn">Publish my name</button>
    <div id="ncLongWait" class="hidden">
      <p class="tag" style="margin-top:10px">This is taking longer than usual. Your claim is still publishing — nothing is wrong with your wallet, and this screen will never finish on its own without your name live.</p>
      <button class="btn ghost" id="ncKeepWaiting">Keep waiting</button>
      <button class="btn ghost" id="ncRetryBtn">Retry the claim submission</button>
    </div>
    <div id="ncConflictBox" class="${startConflict ? "" : "hidden"}">
      <input id="ncNewName" spellcheck="false" autocomplete="off" autocorrect="off" data-autofocus placeholder="Pick a different name" autocapitalize="none" style="margin-top:10px">
      <button class="btn" id="ncClaimOtherBtn">Claim this name instead</button>
      <p class="msg err" id="ncSheetMsg"></p>
    </div>
    <button class="btn hidden" id="ncEnterBtn">Enter Fluid →</button>
    <button class="btn ghost" id="ncSkipBtn" style="margin-top:10px">Continue without a username — you can claim one later; until then nobody can send to you by name</button>
    <p class="tag" style="margin-top:12px"><b>Publish it yourself instead (fallback):</b> copy your entry, then add it into <b>names.json</b> in the GitHub repo:</p>
    <div class="seed" style="font-size:12px" id="ncEntryText">${entryText}</div>
    <button class="btn ghost" id="ncCopyEntry">Copy entry</button>
    <a class="btn ghost" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="https://github.com/Townsvilledh/fluid-wallet/edit/main/names.json" target="_blank" rel="noopener">Open names.json on GitHub ↗</a>`);
  sheetCloseHook = () => { if (!settled) { settled = true; stopTimers(); refreshGate(); } };
  if (startConflict) {
    // Import-conflict: this device submitted nothing — the name was
    // already registered elsewhere. Say exactly that, and hide the
    // waiting line until a loop-back claim starts a real wait.
    $("ncSubmitted").textContent = "This name is already registered to a different wallet — nothing was submitted for it from this device.";
    $("ncWaiting").style.display = "none";
  }
  $("ncCopyEntry").onclick = () => copyText(entryText, $("ncCopyEntry"));
  $("ncSkipBtn").onclick = finish;
  $("ncEnterBtn").onclick = finish;
  const paintElapsed = () => {
    const el = $("ncElapsed"); if (!el) return;
    const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    el.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    if (s >= 900 && !longWaitDismissed) { const lw = $("ncLongWait"); if (lw) lw.classList.remove("hidden"); }
  };
  tick = setInterval(paintElapsed, 1000); paintElapsed();
  $("ncKeepWaiting").onclick = () => { longWaitDismissed = true; $("ncLongWait").classList.add("hidden"); };
  const resubmit = async (btn) => {
    if (btn) btn.disabled = true;
    try {
      // Resubmit the claim THE USER MADE — including any Lightning
      // fields folded into it — never a stripped variant.
      const held = loadPendingClaim();
      const same = held && held.name === currentName;
      const n = await submitNameClaim(currentName, same ? (held.ln || null) : null, same ? (held.lnOffer || null) : null);
      const st = $("ncWaitStatus"); if (st) st.textContent = n > 0 ? NAME_STATE_COPY.publishing : NAME_STATE_COPY.saved;
      const pb = $("ncPublishBtn"); if (pb) pb.classList.toggle("hidden", n > 0);
      if (n === 0 && btn) btn.disabled = false;
    } catch { if (btn) btn.disabled = false; }
  };
  $("ncPublishBtn").onclick = (e) => resubmit(e.currentTarget);
  $("ncRetryBtn").onclick = (e) => resubmit(e.currentTarget);
  $("ncClaimOtherBtn").onclick = async () => {
    const want = normalizeFluidName($("ncNewName").value);
    if (!validateFluidName(want)) return msg("ncSheetMsg", "Name must be 3-20 chars: letters, numbers, underscore; start with a letter.");
    msg("ncSheetMsg", "Checking the registry…", true);
    const hit = await resolveFluidName(want).catch(() => null);
    if (hit) return msg("ncSheetMsg", "That name is already claimed. Try another.");
    try { await submitNameClaim(want, null); } catch (e) { return msg("ncSheetMsg", "Claim failed: " + (e.message || e)); }
    currentName = want;
    rebuildEntryText();
    startedAt = Date.now(); longWaitDismissed = false;
    $("ncWaitTitle").textContent = "Your name: " + want + "." + FLUID_DOMAIN;
    $("ncSubmitted").textContent = "Claim submitted for " + want + "." + FLUID_DOMAIN + " — signed with your wallet's key and sent to the public relays.";
    $("ncWaiting").style.display = "";
    $("ncWaiting").innerHTML = "";
    $("ncWaiting").textContent = "Waiting for " + want + " to appear in the public registry, resolving to your wallet… elapsed ";
    const el = document.createElement("span"); el.id = "ncElapsed"; el.textContent = "0:00"; $("ncWaiting").appendChild(el);
    $("ncWaitStatus").textContent = NAME_STATE_COPY.publishing;
    $("ncConflictBox").classList.add("hidden");
    msg("ncSheetMsg", "");
    const et = $("ncEntryText"); if (et) et.textContent = entryText;
    if (!poll) poll = setInterval(check, 10000);
    check();
  };
  let repairTried = false, repairBusy = false;
  const check = async () => {
    if (settled || !wallet) return;
    const hit = await resolveFluidName(currentName).catch(() => null);
    if (settled) return;
    if (!hit) {
      // Repair inheritance (audit P0-1): past the repair window
      // with still no registry entry, ask the relays for the claim
      // EVENT itself. Findable = the pipeline is merely behind —
      // keep waiting. Unfindable = the claim is lost: show the
      // REPAIR wording and re-send the claim ONCE, right here in
      // the wait, instead of leaving the sheet at "Publishing…"
      // forever. (The manual Retry button stays available.)
      const p = loadPendingClaim();
      if (p && p.published && p.eventId && !repairTried && !repairBusy
        && Date.now() - (p.publishedAt || p.submittedAt || startedAt) >= NAME_CLAIM_REPAIR_AFTER_MS) {
        repairBusy = true;
        try {
          const q = await queryNameClaimEvent(p.eventId).catch(() => ({ found: false }));
          if (!settled && !q.found && wallet) {
            repairTried = true;
            const st = $("ncWaitStatus"); if (st) st.textContent = NAME_STATE_COPY.repair;
            await resubmit(null);
            startedAt = Date.now();
          }
        } finally { repairBusy = false; }
      }
      return;
    }
    const statusEl = $("ncWaitStatus"), enterBtn = $("ncEnterBtn"), skipBtn = $("ncSkipBtn");
    if (!statusEl || !enterBtn) return;
    if (String(hit.evm || "").toLowerCase() === String(wallet.address).toLowerCase()) {
      statusEl.textContent = NAME_STATE_COPY.live;
      enterBtn.classList.remove("hidden");
      if (skipBtn) skipBtn.classList.add("hidden");
      const lw = $("ncLongWait"); if (lw) lw.classList.add("hidden");
      const cb = $("ncConflictBox"); if (cb) cb.classList.add("hidden");
      stopTimers();
    } else {
      statusEl.textContent = NAME_STATE_COPY.conflict;
      const cb = $("ncConflictBox"); if (cb) cb.classList.remove("hidden");
      if (poll) { clearInterval(poll); poll = null; }
    }
  };
  if (!startConflict) { poll = setInterval(check, 10000); check(); }
}
function renderNameSection() {
  const gen = ++nameSectionGen;
  const stored = localStorage.getItem("fluid_name");
  const myAddr = wallet ? wallet.address : null;
  // Held-claim hygiene: a pending claim belongs to ONE name and ONE
  // wallet. A record left by a replaced wallet, or for a name this
  // device no longer holds, is stale — drop it rather than let it
  // paint another wallet's state.
  {
    const held = loadPendingClaim();
    if (held && (held.name !== stored || (myAddr && held.evm && String(held.evm).toLowerCase() !== String(myAddr).toLowerCase()))) savePendingClaim(null);
  }
  const stillCurrent = () => gen === nameSectionGen
    && localStorage.getItem("fluid_name") === stored
    && (wallet ? wallet.address : null) === myAddr;
  // The home header greets by Fluid name (Ethuram's requirement): set it
  // here because every name-state change (claim, adoption, removal)
  // flows through this function, and renderMain calls it on unlock.
  // BUT the greeting is earned only by a LIVE name (audit P0-1:
  // auditwalk26 was greeted for over an hour by a name that had
  // never landed in the registry). A held pending claim means "not
  // proven live yet" — suppress the name until the registry refine
  // below clears the claim (the live paint restores the greeting).
  const greetName = stored && !loadPendingClaim() ? stored : null;
  $("welcomeText").textContent = formatWelcomeHeader(greetName);
  // The section DESCRIPTION names the current wallet's name or the
  // generic placeholder — painted HERE, unconditionally, on every
  // render and in both states (QA round 3): it used to be written
  // only on the owned branch below (and set-only in renderMain), so
  // the claim state never repainted it — after remove + import in
  // one session it kept the REMOVED wallet's name until a page
  // reload reset the DOM to the static placeholder. This function
  // is now the description's ONLY writer.
  $("namePreview").textContent = stored ? stored + "." + FLUID_DOMAIN : "you." + FLUID_DOMAIN;
  if (!stored) { stopNamePoll(); show("ownedNameBox", false); show("claimForm", true); return; }
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
  // The five-state paint (nameClaimState + NAME_STATE_COPY): the note
  // and the one finishing action for the state — Publish my name
  // (saved), Publish again (publishing), Pick a different name
  // (conflict), nothing (live). Painted immediately from the local
  // claim state, then refined by the registry lookup below: a name
  // pending from THIS device shows as PUBLISHING, never as free,
  // taken, or done.
  const paintNameState = (state) => {
    if (!stillCurrent()) return;
    if (noteEl && NAME_STATE_COPY[state]) noteEl.textContent = NAME_STATE_COPY[state];
    const box = $("ownedNameState");
    if (!box) return;
    if (state === "publishing" || state === "repair") {
      box.innerHTML = `<button class="btn ghost" id="nsRepublishBtn" style="width:auto;padding:6px 12px">Publish again</button>`;
      $("nsRepublishBtn").onclick = async () => {
        const p = loadPendingClaim(); if (!p || !wallet) return;
        try { await submitNameClaim(p.name, p.ln || null, p.lnOffer || null); } catch { /* the state repaint reports the outcome */ }
        renderNameSection();
      };
      ensureNamePoll();
    } else if (state === "saved") {
      stopNamePoll();
      box.innerHTML = `<button class="btn" id="nsPublishBtn">Publish my name</button>`;
      $("nsPublishBtn").onclick = async () => {
        const btn = $("nsPublishBtn"); if (btn) btn.disabled = true;
        try {
          const p = loadPendingClaim();
          const n = await submitNameClaim(stored, p ? (p.ln || null) : null, p ? (p.lnOffer || null) : null);
          msg("nameMsg", n > 0 ? NAME_STATE_COPY.publishing : NAME_STATE_COPY.saved, true);
        } catch (e) { msg("nameMsg", "Publish failed: " + (e.message || e)); }
        renderNameSection();
      };
    } else if (state === "conflict") {
      stopNamePoll();
      box.innerHTML = `<button class="btn ghost" id="nsPickOtherBtn" style="width:auto;padding:6px 12px">Pick a different name</button>`;
      $("nsPickOtherBtn").onclick = () => {
        localStorage.removeItem("fluid_name");
        savePendingClaim(null);
        msg("nameMsg", "");
        renderNameSection();
        renderMain();
      };
    } else {
      if (state === "live" && loadPendingClaim()) savePendingClaim(null);
      if (state === "live") $("welcomeText").textContent = formatWelcomeHeader(stored);
      stopNamePoll();
      box.innerHTML = "";
    }
  };
  paintNameState(nameClaimState({ stored, pending: loadPendingClaim(), registryHit: null, myEvm: myAddr }));
  // REPAIR truth check (audit P0-1): a claim stuck at PUBLISHING
  // past the repair window gets asked the hard question — is its
  // event still findable on ANY relay (by id — the only read shape
  // that proved reliable)? If yes, the pipeline is merely behind
  // and the state stays PUBLISHING. If no, the claim is LOST:
  // paint REPAIR and re-publish ONCE per unlock session, telling
  // the user on the name message line. Triggered from the registry
  // refine below (unlock render and every More-tab render flow
  // through it, and the 20s name poll re-renders while pending).
  let truthBusy = false;
  const maybeRepair = async (registryHit) => {
    if (truthBusy || !stillCurrent() || !wallet) return;
    const p = loadPendingClaim();
    if (!p || !p.published || !p.eventId) return;
    if (nameClaimState({ stored, pending: p, registryHit, myEvm: myAddr }) !== "publishing") return;
    if (Date.now() - (p.publishedAt || p.submittedAt || 0) < NAME_CLAIM_REPAIR_AFTER_MS) return;
    truthBusy = true;
    try {
      const q = await queryNameClaimEvent(p.eventId).catch(() => ({ found: false }));
      if (!stillCurrent()) return;
      const st = nameClaimState({ stored, pending: loadPendingClaim(), registryHit, myEvm: myAddr, eventFound: q.found, now: Date.now() });
      if (st !== "repair") return;
      paintNameState("repair");
      const key = "fluid_name_autorepair_" + p.eventId;
      let done = false;
      try { done = sessionStorage.getItem(key) === "1"; if (!done) sessionStorage.setItem(key, "1"); } catch { /* no sessionStorage — the manual button remains */ }
      if (!done) {
        msg("nameMsg", "Your earlier claim for " + stored + " never reached the public registry — sending it again now.", true);
        try { await submitNameClaim(p.name, p.ln || null, p.lnOffer || null); } catch { /* the repaint reports the outcome */ }
        if (stillCurrent()) renderNameSection();
      }
    } finally { truthBusy = false; }
  };
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
  // The value the Lightning row's Copy button copies. A registered
  // node offer is long and the row shows a shortened form — copying
  // the DISPLAY text would hand out a broken offer, so paintOwnedLn
  // keeps the full value here.
  let ownedLnCopyValue = "";
  $("copyOwnedLn").onclick = () => copyText(ownedLnCopyValue || $("ownedLn").textContent, $("copyOwnedLn"));
  // The owned box shows the SAME fields the claim form takes (QA
  // F11): EVM, Bitcoin, Algorand, and Lightning in both states. The
  // Lightning row is always present. Round 3 (native Lightning,
  // 2026-11-09): the row is painted from the registry ENTRY, not a
  // bare address — a registered lnOffer (the wallet's own node) is
  // the headline state and hides the add form; a hosted address
  // alone still shows the form, because the native option remains
  // addable on top of it; neither shows "Not registered yet" with
  // the form. The form ALSO renders when the registry couldn't be
  // checked — the entry is built locally from the user's own keys,
  // so a failed registry read must never suppress it; the honest
  // note and the form appear together.
  const paintOwnedLn = (entry, unknown = false) => {
    const note = $("ownedLnNote");
    const paintNote = (text) => { if (note) { note.textContent = text || ""; note.classList.toggle("hidden", !text); } };
    const offer = entry && entry.lnOffer ? String(entry.lnOffer) : "";
    const hosted = entry && entry.ln ? String(entry.ln) : "";
    if (offer) {
      ownedLnCopyValue = offer;
      $("ownedLn").textContent = "Your Fluid node: " + (offer.length > 42 ? offer.slice(0, 24) + "…" + offer.slice(-8) : offer);
      show("copyOwnedLn", true); show("ownedLnAdd", false);
      // Capacity truth (Lightning completion audit §5.6.2): a
      // registered offer is money-in only when the node has a
      // channel with room in it. Read the LIVE session when one is
      // running on mainnet; without a session, never assert
      // capacity — point at the panel instead. The offer is bound
      // to the node, not the channel: gaining a channel later makes
      // this same registration payable with no re-registration.
      let noteText;
      if (lnSession && lnSession.network === "bitcoin") {
        let recvMsat = 0;
        try { recvMsat = Number(lnSession.balance().receivableMsat || 0); } catch { recvMsat = 0; }
        noteText = recvMsat > 0
          ? "Registered — pays your own node, no outside service. Your node can receive up to ~" + Math.floor(recvMsat / 1000).toLocaleString("en-GB") + " sats right now; Fluid must be open on this device when you're paid."
          : "Registered but not yet payable — your node can't receive yet: it has no channel with room in it. A channel with room is what lets sats arrive. Open the Lightning panel (Wallet tab → Lightning) to get a channel; this same registration becomes payable the moment a channel has room — no need to register again.";
      } else {
        noteText = "Registered — pays your own node, no outside service. Open the Lightning panel once to start your node and see whether it can receive yet: payments to your name need a channel with room in the node, and Fluid open on this device when you're paid.";
      }
      if (hosted) noteText += " A hosted address (" + hosted + ") is also registered to this name.";
      paintNote(noteText);
    } else if (hosted) {
      ownedLnCopyValue = hosted;
      $("ownedLn").textContent = hosted;
      show("copyOwnedLn", true); show("ownedLnAdd", true);
      paintNote("This name receives Lightning at the hosted address above. Your own Fluid node is the first choice — register it below and payments come straight to this app instead.");
    } else if (unknown) {
      ownedLnCopyValue = "";
      $("ownedLn").textContent = "Couldn't check the registry just now";
      show("copyOwnedLn", false); show("ownedLnAdd", true);
      paintNote("");
    } else {
      ownedLnCopyValue = "";
      $("ownedLn").textContent = "Not registered yet";
      show("copyOwnedLn", false); show("ownedLnAdd", true);
      paintNote("");
    }
  };
  paintOwnedLn(null);
  lnNativeTermsPainted = false; // a fresh section render has no terms painted (the label hold survives by design)
  paintLnNodeStatus();
  $("ownedLn").textContent = "Checking the registry…";
  show("copyOwnedLn", false); show("ownedLnAdd", false);
  // --- Native Lightning registration: "Use my Fluid node" ---
  // First choice on the card (owner directive 2026-11-09: Lightning
  // is Fluid-native — no external wallet creation, Lightning or
  // not). Step 1 starts the wallet's own node on mainnet if it
  // isn't running, takes its amountless BOLT 12 offer, and paints
  // the honest terms — the live receivable decides whether the
  // copy says "can receive" or "registered but not yet payable"
  // (completion audit §5.6.2; the receivable-0 sentence is the
  // audit's lnReceivePlan wording). Step 2 registers that offer to
  // the name through the signed-claim pipeline: folded into the
  // held claim while the name isn't live, merged into the
  // published entry by the processor as a same-owner update once
  // it is. A hosted address already registered or held is carried
  // along untouched.
  let lnNativeState = null;
  // A registration that was sent but not yet SEEN in the registry:
  // the button becomes a one-tap re-check that reads the registry
  // and reports its live state — "on its way" is never the final
  // word (field evidence 2026-11-10: the owner couldn't tell
  // whether registration had worked, and it had not).
  let lnPendingVerify = null;
  const paintNativeTerms = () => {
    const terms = $("ownedLnNativeTerms"), copy = $("ownedLnNativeCopy"), btn = $("ownedLnNativeBtn");
    if (!terms || !copy || !btn) return;
    if (!lnNativeState) { terms.classList.add("hidden"); lnNativeTermsPainted = false; btn.textContent = lnStatusSnapshot().nativeBtnLabel; return; }
    terms.classList.remove("hidden");
    lnNativeTermsPainted = true;
    // Explicit success state (owner directive, 2026-11-10): step 1
    // ends by SAYING the node is created and ready, in the terms
    // themselves — the flow never just reverts to the start button.
    const readyLead = "✓ Your Fluid node is ready — set up and running on this device. ";
    const recvSats = Math.floor((lnNativeState.receivableMsat || 0) / 1000);
    if (recvSats > 0) {
      copy.textContent = readyLead + "Your node can receive up to ~" + recvSats.toLocaleString("en-GB") + " sats right now. Payments to your name will come to this node — Fluid must be open on this device when you're paid.";
      btn.textContent = "Register my node";
    } else {
      copy.textContent = readyLead + "Registered but not yet payable: your node can't receive yet — it has no channel with room in it. A channel with room is what lets sats arrive. You can register now and get a channel later (Wallet tab → Lightning → Channels) — this registration becomes payable the moment a channel has room; you won't need to register again. Until then, payments to your name will fail.";
      btn.textContent = "Register anyway — I'll get a channel";
    }
  };
  $("ownedLnNativeBtn").onclick = async () => {
    if (!wallet) return msg("nameMsg", "Unlock your wallet first.");
    const btn = $("ownedLnNativeBtn");
    // Re-check path: a sent registration that the registry hadn't
    // shown yet gets one fresh registry read and a plain answer.
    if (lnPendingVerify && !lnNativeState) {
      lnNativeLabelHold = false;
      if (btn) btn.disabled = true;
      try {
        const hit = await resolveFluidName(lnPendingVerify.name).catch(() => null);
        if (hit && hit.lnOffer === lnPendingVerify.offer) {
          lnPendingVerify = null;
          msg("nameMsg", "Registered ✓ — the registry now shows your node's offer for " + lnPendingVerifyName() + ".", true);
          renderNameSection();
        } else {
          msg("nameMsg", "Still not in the registry — your signed registration was sent, but the registry doesn't show your node's offer yet. Give it a few more minutes and check again.");
          if (btn) btn.textContent = "Check the registry again";
          lnNativeLabelHold = true;
        }
      } finally { if (btn) btn.disabled = false; }
      return;
    }
    if (!lnNativeState) {
      lnNativeLabelHold = false;
      lnNativeOfferError = null;
      paintLnNodeStatus();
      if (lnSession && lnSession.network !== "bitcoin") return msg("nameMsg", "Your Lightning node is on a test network right now — switch it to Bitcoin (mainnet) in the Lightning panel first, so the offer you register can receive real payments.");
      if (btn) btn.disabled = true;
      // The busy label ("Starting your node…") is restored on
      // EVERY exit path of this branch (audit batch 4, F1): the
      // finally below puts the resting label back unless the
      // success path ran, where paintNativeTerms() takes over the
      // label with the registration step's own wording, or the
      // connecting-failure path ended in its own deliberate state
      // (held), which owns the button until the next tap.
      let painted = false;
      let held = false;
      try {
        if (!lnSession) {
          if (btn) btn.textContent = "Starting your node…";
          // The shared boot (completion build): resumable verified
          // download + stage-identified failures. A boot failure
          // here says exactly that and registers NOTHING — it never
          // degrades into a fallback.
          await lnEnsureSession("bitcoin");
        }
        let offer = lnAddrOfferNow();
        if (!offer) {
          // The node is running but has no offer yet: building one
          // needs a peer connection, and connecting is the APP's
          // job — lnEnsureSession dialled the default peer on its
          // own when the node booted. State the ONE true state
          // beside the button (running, connecting, automatic —
          // never "ready" before an offer exists, and never a
          // pointer into Advanced), keep the button disabled for
          // the whole wait so it can never sit live-looking but
          // dead, and let the wait finish this step when the offer
          // lands. Before this fix, this branch returned at once
          // with the label restored to "Register my node — it's
          // ready": the next tap re-ran the same instant failure
          // and nothing on screen changed — a dead button (owner
          // field evidence, 2026-11-10).
          lnNativeOfferError = "Your Fluid node is running on this device. It's connecting to the Lightning network so it can build its offer — that happens on its own and takes a few seconds. You don't need to do anything, and you don't need to connect anything yourself.";
          if (btn) btn.textContent = "Connecting your node…";
          paintLnNodeStatus();
          offer = await lnAwaitOffer(60000);
        }
        if (!offer) {
          // A full minute with no connection: say so plainly, in
          // the same persistent place, and leave an honest working
          // control — Try again — never the register promise.
          lnNativeOfferError = "Your Fluid node is running, but it couldn't connect to the Lightning network just now — check your internet connection, then tap Try again. Nothing was registered.";
          paintLnNodeStatus();
          if (btn) { btn.disabled = false; btn.textContent = "Try again"; lnNativeLabelHold = true; }
          held = true;
          return msg("nameMsg", "Your node is running, but it couldn't connect to the Lightning network just now — check your internet connection, then tap Try again. Nothing was registered.");
        }
        lnNativeOfferError = null;
        let recv = 0;
        try { recv = Number(lnSession.balance().receivableMsat || 0); } catch { recv = 0; }
        lnNativeState = { offer, receivableMsat: recv };
        paintNativeTerms();
        painted = true;
      } catch (e) {
        const stage = e && e.stage;
        if (stage === "download") msg("nameMsg", "Your node couldn't load — the node program didn't finish downloading (a slow or dropped connection?). Any part that arrived is kept on your phone, so retrying continues from there. Nothing was registered.");
        else if (stage === "integrity") msg("nameMsg", "Your node couldn't load — the downloaded code didn't match this app's fingerprint, so it wasn't run. Nothing was registered.");
        else if (stage === "chain") msg("nameMsg", "Your node couldn't load — it couldn't read the Bitcoin chain tip to start. Nothing was registered.");
        else msg("nameMsg", "Your node couldn't start just now: " + lnErrorText(e) + " Nothing was registered.");
      } finally {
        if (btn && !held) {
          btn.disabled = false;
          // The resting label is state-derived, never a blind
          // revert: with a node running it offers registration,
          // with none it offers the start — the label itself tells
          // the user which world they're in.
          if (!painted) btn.textContent = lnStatusSnapshot().nativeBtnLabel;
        }
        paintLnNodeStatus();
      }
      return;
    }
    const offer = lnNativeState.offer;
    if (btn) btn.disabled = true;
    try {
      const hit = await resolveFluidName(stored).catch(() => null);
      const mine = !!(hit && hit.evm && String(hit.evm).toLowerCase() === String(wallet.address).toLowerCase());
      const held = loadPendingClaim();
      const keepLn = (mine && hit.ln) || (held && held.name === stored ? (held.ln || null) : null) || null;
      const n = await submitNameClaim(stored, keepLn, offer);
      lnNativeState = null;
      paintNativeTerms();
      if (n === 0) {
        // Held claim: a defined state, NOT a registration.
        msg("nameMsg", "Your offer was folded into the claim saved on this device — it publishes together with your name when the name goes live. It is not in the registry yet.", true);
        if (btn) btn.disabled = false;
        renderNameSection();
        return;
      }
      // Sent is not registered: verify against the registry itself
      // and say which one it is.
      msg("nameMsg", "Registration sent — checking the registry…", true);
      let verified = false;
      for (let i = 0; i < 9 && !verified; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        const check = await resolveFluidName(stored).catch(() => null);
        verified = !!(check && check.lnOffer === offer);
      }
      if (verified) {
        msg("nameMsg", "Registered ✓ — the registry now shows your node's offer for " + stored + ".fluid.", true);
      } else {
        lnPendingVerify = { offer, name: stored };
        msg("nameMsg", "Your signed registration was sent, but the registry doesn't show it yet — claims usually appear within a few minutes.");
        if (btn) btn.textContent = "Check the registry again";
        lnNativeLabelHold = true;
      }
    } catch (e) { msg("nameMsg", "Could not register your node: " + (e.message || e)); }
    if (btn) btn.disabled = false;
    renderNameSection();
  };
  const lnPendingVerifyName = () => (lnPendingVerify ? lnPendingVerify.name : stored) + ".fluid";
  $("ownedLnAddBtn").onclick = async () => {
    if (!wallet) return msg("nameMsg", "Unlock your wallet first.");
    const ln = $("ownedLnInput").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ln)) return msg("nameMsg", "That doesn't look like a Lightning address (name@domain).");
    // The hosted address rides the signed-claim pipeline in both
    // states: folded into the held claim while the name isn't live
    // yet, and merged into the published entry by the processor as
    // a same-owner update once it is — the processor verifies the
    // signature recovers this wallet's EVM before the entry moves.
    // A native offer already registered or held is carried along.
    const hit = await resolveFluidName(stored).catch(() => null);
    const held = loadPendingClaim();
    const keepOffer = (hit && hit.lnOffer) || (held && held.name === stored ? (held.lnOffer || null) : null) || null;
    try {
      const n = await submitNameClaim(stored, ln, keepOffer);
      msg("nameMsg", n > 0 ? "Lightning address on its way into the registry — " + NAME_STATE_COPY.publishing : "Lightning address added to your claim — " + NAME_STATE_COPY.saved, true);
    } catch (e) { msg("nameMsg", "Could not update your claim: " + (e.message || e)); }
    renderNameSection();
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
      paintNameState(nameClaimState({ stored, pending: loadPendingClaim(), registryHit: null, myEvm: myAddr }));
      maybeRepair(null);
      return;
    }
    if (hit.evm) $("ownedEvm").textContent = hit.evm;
    if (hit.btc) $("ownedBtc").textContent = hit.btc;
    if (hit.algo) $("ownedAlgo").textContent = hit.algo;
    paintOwnedLn(hit);
    paintNameState(nameClaimState({ stored, pending: loadPendingClaim(), registryHit: hit, myEvm: myAddr }));
  }).catch(() => { if (stillCurrent()) { paintOwnedLn(null, true); paintNameState(nameClaimState({ stored, pending: loadPendingClaim(), registryHit: null, myEvm: myAddr })); maybeRepair(null); } });
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
  // A claim already held by THIS device for THIS name is neither
  // free nor taken-by-another — it is this wallet's own publish in
  // flight (or waiting on its Publish button).
  const heldClaim = loadPendingClaim();
  if (heldClaim && heldClaim.name === name && heldClaim.evm && String(heldClaim.evm).toLowerCase() === String(wallet.address).toLowerCase()) {
    localStorage.setItem("fluid_name", name);
    msg("nameMsg", heldClaim.published ? NAME_STATE_COPY.publishing : NAME_STATE_COPY.saved, true);
    renderNameSection();
    renderMain();
    return;
  }
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
  // Sign + publish from inside the app — the claim completes here;
  // the GitHub entry below is now only the labelled fallback.
  msg("nameMsg", "Signing your claim…", true);
  let accepted = 0;
  try { accepted = await submitNameClaim(name, $("lnInput").value.trim() || null); }
  catch (e) { return msg("nameMsg", "Claim failed: " + (e.message || e)); }
  const entry = buildNameEntry(name, wallet.address, btcAddr || bitcoinAddress(wallet.mnemonic.phrase), $("lnInput").value.trim() || null, algoAddr || algoAddressFromPhrase(wallet.mnemonic.phrase), solAddr || solanaAddressFromPhrase(wallet.mnemonic.phrase), tronAddr || tronAddressFromPhrase(wallet.mnemonic.phrase), suiAddr || suiAddressFromPhrase(wallet.mnemonic.phrase));
  $("nameEntry").textContent = JSON.stringify(entry).slice(1, -1) + ",";
  show("claimBox");
  msg("nameMsg", accepted > 0 ? NAME_STATE_COPY.publishing : NAME_STATE_COPY.saved, true);
  renderNameSection();
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
function lockWallet() {
  // A lock must never leave a composed sheet painted over the
  // lock screen (audit P1-14): the sheet overlay outlives the
  // gate paint, so a recipient + amount stayed legible above the
  // dimmed unlock card. Dismiss it — forced, because privacy
  // outranks the broadcast-busy refusal (the broadcast itself
  // holds its own state and is unaffected) — and explain the
  // closed sheet once, after the next unlock.
  const sheetRoot = $("sheetRoot");
  if (sheetRoot && !sheetRoot.classList.contains("hidden")) { lockClosedSheet = true; closeSheet(true); }
  lnBridgeStopResponder(); // a locked wallet answers no bridge invoice requests
  wallet = null; pendingSend = null; restoreMode = false; nameAdoptTried = false; arkSession = null; arkBootPromise = null; bridgeQuote = null; msg("onboardMsg", ""); refreshGate();
}
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
    // Reset the seed ceremony to its first step (audit P1-1): no
    // mounted quiz (it renders the phrase as options) may linger,
    // and the next creation starts on the words view.
    const quizBox = $("seedQuizBox"); if (quizBox) { quizBox.innerHTML = ""; show("seedQuizBox", false); }
    show("seedWordsView", true);
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
