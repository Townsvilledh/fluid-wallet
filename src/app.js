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
} from "./wallet-core.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const HISTORY_KEY = "fluid_history_v1";
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
  $("addrText").onclick = () => navigator.clipboard.writeText(wallet.address);
  $("netBtn").textContent = NETWORKS[networkKey].name + " ▾";
  try { prices = await getPrices(); } catch { prices = {}; }
  // Bitcoin first (all chains, one wallet)
  btcAddr = bitcoinAddress(wallet.mnemonic.phrase);
  getBitcoinBalance(btcAddr).then(b => { btcBal = b; paintAssets(); }).catch(() => paintAssets());
  $("assetList").innerHTML = "Loading assets…";
  try {
    balances = await getBalances(wallet, networkKey);
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
    <button class="btn ghost" onclick="navigator.clipboard.writeText('${wallet.address}')">Copy EVM address</button>
    <hr style="border-color:var(--line)">
    <p class="tag">Bitcoin address:</p>
    <img class="qr" id="qrBtc"><p class="mono">${btcAddr}</p>
    <button class="btn ghost" id="cpBtc">Copy Bitcoin address</button>`);
  qr("qrEvm", wallet.address); qr("qrBtc", btcAddr);
  $("cpBtc").onclick = () => navigator.clipboard.writeText(btcAddr);
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
    const amount = $("sAmt").value.trim(), b = balances[Number($("sToken").value)];
    if (to && !/^0x[0-9a-fA-F]{40}$/.test(to)) {
      msg("sMsg", "Resolving Fluid name…", true);
      const hit = await resolveFluidName(to).catch(() => null);
      if (!hit || !hit.evm) return msg("sMsg", "That Fluid name is not in the registry yet.");
      to = hit.evm; msg("sMsg", hit.name + "." + FLUID_DOMAIN + " → " + to.slice(0, 10) + "…", true);
    }
    if (!b || !amount || Number(amount) <= 0) return msg("sMsg", "Enter an amount.");
    if (Number(amount) > Number(b.amount)) return msg("sMsg", "Amount is more than your balance.");
    try {
      msg("sMsg", "Estimating fee…", true);
      const fee = await estimateSend(wallet, networkKey, { to, amount, token: b.address ? b : null });
      pendingSend = { to, amount, token: b.address ? b : null, symbol: b.symbol };
      $("sIntentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: Number(fee).toFixed(6) });
      show("sIntent"); msg("sMsg", "");
    } catch (e) { msg("sMsg", "Could not estimate: " + (e.shortMessage || e.message)); }
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
  $("cpBtc2").onclick = () => navigator.clipboard.writeText(btcAddr);
  $("bSend").onclick = async () => {
    let to = $("bTo").value.trim();
    const amount = Number($("bAmt").value);
    if (to && !to.startsWith("bc1")) {
      const hit = await resolveFluidName(to).catch(() => null);
      if (!hit || !hit.btc) return msg("bMsg", "That Fluid name has no Bitcoin address in the registry.");
      to = hit.btc;
    }
    if (!to || !amount || amount <= 0) return msg("bMsg", "Enter a recipient and amount.");
    if (!confirm(`Send ${amount} BTC to ${to}? Network fee will be added at the current rate.`)) return;
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
    <label class="tag">Coin (on ${NETWORKS[networkKey].name})</label>
    <select id="rAsset"><option>USDC</option><option>USDT</option></select>
    <div id="rList"></div>`);
  const paint = () => {
    const code = $("rCountry").value, asset = $("rAsset").value;
    localStorage.setItem("fluid_country", code);
    const c = RAMP_COUNTRIES.find(x => x.code === code);
    const fonbnk = c.fonbnk
      ? (mode === "buy" ? fonbnkOnrampUrl(networkKey, asset, code) : fonbnkOfframpUrl(networkKey, asset, code)) : null;
    const routes = GLOBAL_RAMPS.map(r => ({ name: r.name, url: mode === "buy" ? r.buy : r.sell, region: r.region }));
    if (fonbnk) routes.push({ name: "Fonbnk", url: fonbnk, region: c.name + " · bank & mobile money" });
    const ranked = rankRoutes(routes);
    $("rList").innerHTML =
      `<p class="tag" style="margin-top:10px">⚡ Sorted cheapest-route first (typical fees from provider docs — the provider shows your final quote before you pay).</p>` +
      ranked.map((r, i) =>
        `<button class="netitem" onclick="window.open('${r.url}','_blank')"><span>${r.name} ${i === 0 ? '<span class="pill">CHEAPEST</span>' : ""}</span><small style="color:var(--dim)">${r.note || r.region}</small></button>`).join("") +
      (!fonbnk && c.fonbnk ? `<p class="tag">Fonbnk doesn't ride on ${NETWORKS[networkKey].name} — switch network (e.g. BNB Chain or Base) to use it, or use a global provider above.</p>` : "");
  };
  $("rCountry").onchange = paint; $("rAsset").onchange = paint; paint();
}
$("actBuy").onclick = () => rampSheet("buy");
$("actCash").onclick = () => rampSheet("sell");

// ---------- activity ----------
function renderHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  $("history").innerHTML = h.length
    ? h.map(x => `<div class="hist">Sent ${x.amount} ${x.symbol} → ${String(x.to).slice(0, 10)}… · <a target="_blank" rel="noopener" href="${x.explorer}/tx/${x.hash}">view ↗</a></div>`).join("")
    : "No sends yet from this browser.";
}

// ---------- onboarding ----------
$("createBtn").onclick = async () => {
  const pw = $("createPw").value;
  if (!validatePassword(pw)) return msg("onboardMsg", "Password needs at least 8 characters.");
  if (pw !== $("createPw2").value) return msg("onboardMsg", "Passwords do not match.");
  msg("onboardMsg", "Creating your wallet… (encrypting takes a few seconds)", true);
  const v = await createVault(pw);
  localStorage.setItem(VAULT_KEY, v.keystore);
  $("seedOut").textContent = v.phrase;
  show("seedBox");
  msg("onboardMsg", "Wallet created. Write the seed down, tick the box, then continue.", true);
  $("seedDoneBtn").onclick = async () => {
    if (!$("seedCheck").checked) return msg("onboardMsg", "Tick the box confirming you wrote the seed down.");
    wallet = await unlockVault(v.keystore, pw);
    // ---------- Fluid name claim ----------
$("claimNameBtn").onclick = async () => {
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
$("copyEntryBtn").onclick = () => navigator.clipboard.writeText($("nameEntry").textContent);
if (localStorage.getItem("fluid_name")) $("namePreview").textContent = localStorage.getItem("fluid_name") + "." + FLUID_DOMAIN;

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

// ---------- more tab ----------
$("refreshBtn").onclick = renderMain;
$("lockBtn").onclick = () => { wallet = null; pendingSend = null; refreshGate(); };
$("backupBtn").onclick = () => {
  const blob = new Blob([localStorage.getItem(VAULT_KEY)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "fluid-keystore-backup.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
$("showSeedBtn").onclick = async () => {
  const pw = prompt("Re-enter your password to reveal the seed phrase:");
  if (!pw) return;
  try {
    const w = await unlockVault(localStorage.getItem(VAULT_KEY), pw);
    alert("Your seed phrase (never share it, never type it into a website):\n\n" + w.mnemonic.phrase);
  } catch { alert("Wrong password."); }
};
$("wipeBtn").onclick = () => {
  if (!confirm("Remove this wallet from this browser? You can only get it back with your seed phrase / keystore backup. Funds on-chain are NOT deleted.")) return;
  localStorage.removeItem(VAULT_KEY); wallet = null; refreshGate();
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
  const list = loadAgents();
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
  agents.push({ name, index, keys, policy: descriptor.policy });
  saveAgents(agents); renderAgents();
  $("agentDescriptor").textContent = JSON.stringify(descriptor, null, 1);
  show("agentBox");
  msg("agentMsg", `Agent wallet created for ${name} — separate account, full chain access, no KYC, no ramps.`, true);
};
$("copyAgentBtn").onclick = () => navigator.clipboard?.writeText($("agentDescriptor").textContent);
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
