// Fluid v2 — app-shell UI. Keys live only in memory while unlocked;
// the only thing persisted is the standard encrypted keystore JSON.
import QRCode from "qrcode";
import {
  NETWORKS, createVault, importVault, unlockVault, validatePassword,
  getBalances, estimateSend, executeSend, formatSendIntent,
  fonbnkOfframpUrl, fonbnkOnrampUrl, GLOBAL_RAMPS, RAMP_COUNTRIES, getPrices,
  bitcoinAddress, getBitcoinBalance, sendBitcoin, payLightningInvoice,
  FLUID_DOMAIN, validateFluidName, normalizeFluidName, buildNameEntry, resolveFluidName, lightningInvoiceForAddress, rankRoutes,
  AGENT_POLICY_DEFAULTS, agentAddresses, agentEvmWallet, buildAgentDescriptor, checkAgentPolicy, sendFromAgent,
  LIFI_NATIVE_TOKEN, getSwapRoutes, rankSwapRoutes, swapRouteExecutable, executeSwapRoute, formatSwapIntent, swapAmountToRaw, swapRawToAmount,
  looksLikePoison, revokeApproval,
} from "./wallet-core.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const HISTORY_KEY = "fluid_history_v1";
const APPROVALS_KEY = "fluid_approvals_v1";
const COIN_COLORS = { BTC: "#f7931a", ETH: "#627eea", BNB: "#f0b90b", USDC: "#2775ca", USDT: "#26a17b",
  POL: "#8247e5", AVAX: "#e84142", CELO: "#35d07f", MNT: "#5eead4", xDAI: "#04795d", FUSE: "#b4f461" };
const usd = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, d = 6) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

let wallet = null, networkKey = "bsc", balances = [], prices = {}, btcAddr = null, btcBal = 0, pendingSend = null;

function show(id, on = true) { $(id).classList.toggle("hidden", !on); }
function msg(id, text, ok = false) { const e = $(id); if (e) { e.textContent = text; e.className = "msg " + (ok ? "ok" : "err"); } }
function openSheet(html) { $("sheetBody").innerHTML = html; show("sheetRoot"); }
function closeSheet() { show("sheetRoot", false); }
$("sheetX").onclick = closeSheet; $("scrim").onclick = closeSheet;

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
  getBitcoinBalance(btcAddr).then(b => { btcBal = b; paintAssets(); }).catch(() => paintAssets());
  $("assetList").innerHTML = "Loading assets…";
  try {
    balances = await Promise.race([
      getBalances(wallet, networkKey),
      new Promise((_, reject) => setTimeout(() => reject(new Error("balance load timed out")), 20000)),
    ]);
  } catch { balances = []; $("assetList").innerHTML = "Could not load balances (network busy — tap More → Refresh)."; }
  paintAssets();
  renderHistory();
}

function heroTotal() {
  const net = NETWORKS[networkKey];
  let t = btcBal * (prices.BTC || 0);
  for (const b of balances) {
    const p = b.address ? (prices[b.symbol] ?? null) : (prices[net.priceSym] ?? null);
    if (p != null) t += Number(b.amount) * p;
  }
  return t;
}

function paintAssets() {
  $("totalUsd").textContent = usd(heroTotal());
  const net = NETWORKS[networkKey];
  const rows = [];
  rows.push(`<div class="row" id="btcRow">
      <span class="coin" style="background:${COIN_COLORS.BTC}">₿</span>
      <span class="grow"><b>Bitcoin</b><small>Native SegWit · all networks' wallet</small></span>
      <span class="amt"><b>${fmt(btcBal, 8)}</b><small>${usd(btcBal * (prices.BTC || 0))}</small></span></div>`);
  for (const b of balances) {
    const p = b.address ? prices[b.symbol] : prices[net.priceSym];
    rows.push(`<div class="row">
      <span class="coin" style="background:${COIN_COLORS[b.symbol] || "#3b4a7a"}">${b.symbol.slice(0, 1)}</span>
      <span class="grow"><b>${b.symbol}</b><small>${net.name}</small></span>
      <span class="amt"><b>${fmt(b.amount)}</b><small>${p != null ? usd(Number(b.amount) * p) : ""}</small></span></div>`);
  }
  $("assetList").innerHTML = rows.join("");
  $("btcRow").onclick = openBtcSheet;
}

// ---------- network sheet ----------
$("netBtn").onclick = () => {
  openSheet(`<h3>Choose network</h3>` + Object.entries(NETWORKS).map(([k, n]) =>
    `<button class="netitem" data-net="${k}"><span>${n.name}</span>${k === networkKey ? '<span class="pill">ACTIVE</span>' : ""}</button>`).join(""));
  document.querySelectorAll("[data-net]").forEach(b => b.onclick = () => { networkKey = b.dataset.net; closeSheet(); renderMain(); });
};

// ---------- receive ----------
function qr(el, text) { QRCode.toDataURL(text, { width: 180, margin: 1 }).then(u => { const i = $(el); if (i) i.src = u; }).catch(() => {}); }
$("actReceive").onclick = () => {
  openSheet(`<h3>Receive</h3>
    <p class="tag">EVM address — the same on all 15 networks:</p>
    <img class="qr" id="qrEvm"><p class="mono">${wallet.address}</p>
    <button class="btn ghost" id="cpEvm">Copy EVM address</button>
    <hr style="border-color:var(--line)">
    <p class="tag">Bitcoin address:</p>
    <img class="qr" id="qrBtc"><p class="mono">${btcAddr}</p>
    <button class="btn ghost" id="cpBtc">Copy Bitcoin address</button>`);
  qr("qrEvm", wallet.address); qr("qrBtc", btcAddr);
  $("cpEvm").onclick = () => copyText(wallet.address, $("cpEvm"));
  $("cpBtc").onclick = () => copyText(btcAddr, $("cpBtc"));
};

// ---------- send (EVM) ----------
$("actSend").onclick = () => {
  openSheet(`<h3>Send on ${NETWORKS[networkKey].name}</h3>
    <select id="sToken">${balances.map((b, i) => `<option value="${i}">${b.symbol} — ${fmt(b.amount)}</option>`).join("")}</select>
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
      $("sIntentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: Number(fee).toFixed(6), name: sendName });
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
function openBtcSheet() {
  openSheet(`<h3>Bitcoin</h3>
    <p><b>${fmt(btcBal, 8)} BTC</b> · ${usd(btcBal * (prices.BTC || 0))}</p>
    <img class="qr" id="qrBtc2"><p class="mono">${btcAddr}</p>
    <button class="btn ghost" id="cpBtc2">Copy address</button>
    <hr style="border-color:var(--line)">
    <h3>Send BTC</h3>
    <input id="bTo" placeholder="Recipient bc1… address or Fluid name">
    <input id="bAmt" inputmode="decimal" placeholder="Amount in BTC">
    <button class="btn" id="bSend">Review &amp; send BTC</button>
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
    const dest = sendName ? `${sendName}.${FLUID_DOMAIN} (${to.slice(0, 10)}…${to.slice(-6)})` : to;
    if (!confirm(`Send ${amount} BTC to ${dest}? Network fee will be added at the current rate.`)) return;
    try {
      msg("bMsg", "Building, signing and broadcasting…", true);
      const txid = await sendBitcoin(wallet.mnemonic.phrase, { to, amountBtc: amount });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: txid, amount, symbol: "BTC", to, explorer: "https://mempool.space", at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      msg("bMsg", "Broadcast ✓ txid " + txid.slice(0, 16) + "…", true);
      renderMain();
    } catch (e) { msg("bMsg", e.message); }
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
  openSheet(`<h3>${mode === "buy" ? "Deposit local currency → crypto" : "Withdraw crypto → local currency"}</h3>
    <p class="tag">Pick your country and coin. You complete the ${mode === "buy" ? "purchase" : "sale"} with the provider in your own currency (they handle KYC &amp; fiat) — Fluid never touches your bank money.</p>
    <label class="tag">Country / currency</label>
    <select id="rCountry">${RAMP_COUNTRIES.map(c => `<option value="${c.code}" ${c.code === country ? "selected" : ""}>${c.name}</option>`).join("")}</select>
    <label class="tag">Network</label>
    <select id="rNet">${Object.keys(NETWORKS).filter(k => k !== "sepolia").map(k => `<option value="${k}" ${k === (networkKey === "sepolia" ? "bsc" : networkKey) ? "selected" : ""}>${NETWORKS[k].name}</option>`).join("")}</select>
    <label class="tag" id="rAssetLabel">Coin (on ${NETWORKS[networkKey === "sepolia" ? "bsc" : networkKey].name})</label>
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
        `<button class="netitem" onclick="window.open('${r.url}','_blank')"><span>${r.name} ${i === 0 ? '<span class="pill">CHEAPEST</span>' : ""}</span><small style="color:var(--dim)">${r.note || r.region}</small></button>`).join("") +
      (!fonbnk && c.fonbnk ? `<p class="tag">Fonbnk doesn't ride on ${NETWORKS[netKey].name} — pick a network it supports above (e.g. BNB Chain or Base), or use a global provider instead.</p>` : "");
  };
  $("rCountry").onchange = paint; $("rAsset").onchange = paint; $("rNet").onchange = paint; paint();
}
$("actBuy").onclick = () => rampSheet("buy");
$("actCash").onclick = () => rampSheet("sell");

// ---------- swap (LI.FI routes: same-chain + cross-chain) ----------
let pendingSwap = null;
function swapTokenList(netKey) {
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
$("actSwap").onclick = () => {
  pendingSwap = null;
  const swapNets = Object.keys(NETWORKS).filter(k => k !== "sepolia");
  const netOpts = (sel) => swapNets.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${NETWORKS[k].name}</option>`).join("");
  const fromKey0 = networkKey === "sepolia" ? "bsc" : networkKey;
  const toKey0 = fromKey0 === "base" ? "bsc" : "base";
  openSheet(`<h3>Swap</h3>
    <p class="tag">One search across every Fluid chain (routes by LI.FI). Cheapest = most received after fees; you approve the exact sentence before anything is signed.</p>
    <label class="tag">From</label>
    <div style="display:flex;gap:8px">
      <select id="wFromNet" style="flex:1.2">${netOpts(fromKey0)}</select>
      <select id="wFromTok" style="flex:1"></select>
    </div>
    <input id="wAmt" inputmode="decimal" placeholder="Amount">
    <button class="btn ghost" id="wFlip">⇅ Flip</button>
    <label class="tag">To</label>
    <div style="display:flex;gap:8px">
      <select id="wToNet" style="flex:1.2">${netOpts(toKey0)}</select>
      <select id="wToTok" style="flex:1"></select>
    </div>
    <button class="btn" id="wRoutes">Get routes</button>
    <div id="wList"></div>
    <div id="wConfirm" class="hidden">
      <p class="seed" id="wIntentText"></p>
      <button class="btn" id="wDo">Confirm &amp; swap</button>
    </div>
    <p class="msg err" id="wMsg"></p>`);
  const fillToks = (netSel, tokSel, wantNative) => {
    const toks = swapTokenList($(netSel).value);
    $(tokSel).innerHTML = toks.map((t, i) => `<option value="${i}">${t.symbol}</option>`).join("");
    if (!wantNative) {
      const si = toks.findIndex(t => !t.native);
      if (si > 0) $(tokSel).value = String(si);
    }
  };
  fillToks("wFromNet", "wFromTok", true);
  fillToks("wToNet", "wToTok", false);
  $("wFromNet").onchange = () => fillToks("wFromNet", "wFromTok", true);
  $("wToNet").onchange = () => fillToks("wToNet", "wToTok", false);
  $("wFlip").onclick = () => {
    const fn = $("wFromNet").value, ft = $("wFromTok").value, tn = $("wToNet").value, tt = $("wToTok").value;
    $("wFromNet").value = tn; fillToks("wFromNet", "wFromTok", true); $("wFromTok").value = tt;
    $("wToNet").value = fn; fillToks("wToNet", "wToTok", false); $("wToTok").value = ft;
    show("wConfirm", false); $("wList").innerHTML = ""; msg("wMsg", "");
  };
  $("wRoutes").onclick = async () => {
    const fromKey = $("wFromNet").value, toKey = $("wToNet").value;
    const fromTok = swapTokenList(fromKey)[Number($("wFromTok").value)];
    const toTok = swapTokenList(toKey)[Number($("wToTok").value)];
    const amount = $("wAmt").value.trim();
    show("wConfirm", false); pendingSwap = null;
    if (!fromTok || !toTok || !amount || Number(amount) <= 0) return msg("wMsg", "Enter an amount to swap.");
    if (fromKey === toKey && fromTok.address.toLowerCase() === toTok.address.toLowerCase())
      return msg("wMsg", "Pick two different tokens — swapping a token for itself does nothing.");
    try {
      msg("wMsg", "Checking your balance…", true);
      const bals = await getBalances(wallet, fromKey);
      const mine = bals.find(b => fromTok.native ? !b.address : (b.address || "").toLowerCase() === fromTok.address.toLowerCase());
      if (!mine || Number(amount) > Number(mine.amount))
        return msg("wMsg", `Not enough ${fromTok.symbol} on ${NETWORKS[fromKey].name} (you have ${mine ? fmt(mine.amount) : "0"}).`);
      msg("wMsg", "Searching routes across chains…", true);
      const routes = await getSwapRoutes({
        fromChainKey: fromKey, toChainKey: toKey,
        fromTokenAddress: fromTok.address, toTokenAddress: toTok.address,
        fromAmount: swapAmountToRaw(amount, fromTok.decimals),
        fromAddress: wallet.address,
      });
      if (!routes.length) return msg("wMsg", "No route found for that pair and amount. Try a different pair or a larger amount.");
      const ranked = rankSwapRoutes(routes).slice(0, 3);
      msg("wMsg", "");
      $("wList").innerHTML = ranked.map((r, i) => {
        const ex = swapRouteExecutable(r);
        const badges = `${r.cheapest ? '<span class="pill">CHEAPEST</span> ' : ""}${r.fastest ? '<span class="pill">FASTEST</span> ' : ""}`;
        const recv = fmt(swapRawToAmount(r.toAmount, toTok.decimals));
        return `<button class="netitem" data-route="${i}" ${ex.ok ? "" : "disabled style=\"opacity:.45\""}>
            <span>${badges}${recv} ${toTok.symbol}<br><small style="color:var(--dim)">${swapRouteName(r)} · ${swapDurationText(r.durationSec)} · fees ≈ ${usd(r.gasCostUSD)}</small></span>
            <span>${usd(r.toAmountUSD)}</span></button>
          ${ex.ok ? "" : `<p class="tag" style="margin:2px 0 8px">${ex.reason}</p>`}`;
      }).join("");
      document.querySelectorAll("[data-route]").forEach(b => b.onclick = () => {
        if (b.disabled) return;
        const r = ranked[Number(b.dataset.route)];
        pendingSwap = { route: r, fromKey, toKey, fromTok, toTok, amount };
        $("wIntentText").textContent = formatSwapIntent({
          fromAmount: amount, fromSymbol: fromTok.symbol, fromNetKey: fromKey,
          toAmount: fmt(swapRawToAmount(r.toAmount, toTok.decimals)), toSymbol: toTok.symbol, toNetKey: toKey,
          toolName: swapRouteName(r), feeUsd: r.gasCostUSD, durationSec: r.durationSec,
        });
        show("wConfirm"); msg("wMsg", "");
      });
    } catch (e) { msg("wMsg", "Route search failed: " + (e.shortMessage || e.message)); }
  };
  $("wDo").onclick = async () => {
    if (!pendingSwap) return;
    const { route, fromKey, toKey, fromTok, toTok, amount } = pendingSwap;
    const btn = $("wDo"); btn.disabled = true;
    try {
      const hashes = await executeSwapRoute(wallet, route, (t) => msg("wMsg", t, true), (rec) => {
        // Keep a device record of every approval Fluid makes, so the user
        // can review and revoke them later (More → Token approvals).
        const list = JSON.parse(localStorage.getItem(APPROVALS_KEY) || "[]");
        list.unshift({ chainKey: rec.chainKey, token: rec.token, tokenSymbol: rec.tokenSymbol, spender: rec.spender, amount: rec.decimals != null ? swapRawToAmount(rec.amount, rec.decimals) : rec.amount, at: rec.at });
        localStorage.setItem(APPROVALS_KEY, JSON.stringify(list.slice(0, 50)));
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      h.unshift({ hash: hashes[0], amount, symbol: `${fromTok.symbol}→${toTok.symbol}`, to: wallet.address, explorer: NETWORKS[fromKey].explorer, at: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
      pendingSwap = null; show("wConfirm", false);
      msg("wMsg", fromKey === toKey
        ? `Swap done ✓ tx ${hashes[hashes.length - 1].slice(0, 16)}…`
        : `Swap sent ✓ — your ${toTok.symbol} will arrive on ${NETWORKS[toKey].name} via the bridge shortly. First tx ${hashes[0].slice(0, 16)}…`, true);
      renderMain();
    } catch (e) { msg("wMsg", "Swap failed: " + (e.shortMessage || e.message)); }
    btn.disabled = false;
  };
};

// ---------- activity ----------
function renderHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  $("history").innerHTML = h.length
    ? h.map(x => `<div class="hist">Sent ${x.amount} ${x.symbol} → ${String(x.to).slice(0, 10)}… · <a target="_blank" rel="noopener" href="${x.explorer}/tx/${x.hash}">view ↗</a></div>`).join("")
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
  if (taken) return msg("onboardMsg", "That username is already claimed. Try another.");
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

// ---------- Fluid name claim ----------
// Top level on purpose: this wiring used to live inside the seedDoneBtn
// click handler, so the Claim button was dead for anyone who unlocked an
// existing wallet instead of creating a fresh one in the same session.
$("claimNameBtn").onclick = async () => {
  if (!wallet) return msg("nameMsg", "Unlock your wallet first.");
  const name = normalizeFluidName($("nameInput").value);
  if (!validateFluidName(name)) return msg("nameMsg", "Name must be 3-20 chars: letters, numbers, underscore; start with a letter.");
  msg("nameMsg", "Checking the registry…", true);
  const existing = await resolveFluidName(name).catch(() => null);
  if (existing) return msg("nameMsg", "That name is already claimed. Try another.");
  localStorage.setItem("fluid_name", name);
  const entry = buildNameEntry(name, wallet.address, btcAddr || bitcoinAddress(wallet.mnemonic.phrase), $("lnInput").value.trim() || null);
  $("nameEntry").textContent = JSON.stringify(entry).slice(1, -1) + ",";
  show("claimBox");
  msg("nameMsg", "Name saved on this device. Publish the entry to make it resolve everywhere.", true);
  renderMain();
};
$("copyEntryBtn").onclick = () => copyText($("nameEntry").textContent, $("copyEntryBtn"));
if (localStorage.getItem("fluid_name")) $("namePreview").textContent = localStorage.getItem("fluid_name") + "." + FLUID_DOMAIN;

// ---------- more tab ----------
$("refreshBtn").onclick = renderMain;
function lockWallet() { wallet = null; pendingSend = null; refreshGate(); }
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
    $("apList").innerHTML = mine.length ? mine.map(a => `
      <div class="hist" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span><b>${a.tokenSymbol || "Token"}</b> · ${fmt(a.amount)}<br><small style="color:var(--dim)">spender ${a.spender.slice(0, 6)}…${a.spender.slice(-4)} · ${new Date(a.at).toLocaleDateString()}</small></span>
        <button class="btn ghost" data-revoke="${a._i}" style="width:auto;padding:6px 12px">Revoke</button>
      </div>`).join("") : emptyNote;
    document.querySelectorAll("[data-revoke]").forEach(b => b.onclick = () => {
      const list = loadApprovals(); const a = list[Number(b.dataset.revoke)]; if (!a) return;
      pendingRevoke = Number(b.dataset.revoke);
      $("apConfirm").innerHTML = `<p class="seed" style="margin-top:10px">Revoke the ${a.tokenSymbol || "token"} approval for spender ${a.spender.slice(0, 6)}…${a.spender.slice(-4)} on ${NETWORKS[a.chainKey].name}? This sends an on-chain transaction setting the permission to zero (a network fee applies). The swap that used it already finished — revoking breaks nothing.</p>
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
    const ok = confirm(`🤖 Agent "${a.name}" requests a transfer:\n\nSend ${amt} ${net.symbol} on ${net.name}\nTo: ${to}\n${price ? "Value ≈ " + usd(usdAmt) + ` (caps: $${a.policy.perTxCapUsd}/tx, $${a.policy.dailyCapUsd}/day)` : "(price unknown — check carefully)"}\n\nApprove and sign with the AGENT wallet?`);
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
