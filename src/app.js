// Fluid wallet — browser UI. Keys live only in memory while unlocked;
// the only thing persisted is the standard encrypted keystore JSON.
import QRCode from "qrcode";
import {
  NETWORKS, createVault, importVault, unlockVault, validatePassword,
  getBalances, estimateSend, executeSend, formatSendIntent, fonbnkOfframpUrl,
} from "./wallet-core.js";

const $ = (id) => document.getElementById(id);
const VAULT_KEY = "fluid_vault_v1";
const HISTORY_KEY = "fluid_history_v1";

let wallet = null;          // ethers wallet, memory only
let networkKey = "bsc";     // default: cheap, and where Ethuram already operates
let balances = [];
let pendingSend = null;

function show(id, on = true) { $(id).classList.toggle("hidden", !on); }
function msg(id, text, ok = false) { const e = $(id); e.textContent = text; e.className = "msg " + (ok ? "ok" : "err"); }

function refreshGate() {
  const hasVault = !!localStorage.getItem(VAULT_KEY);
  show("onboard", !wallet);
  show("unlockBox", hasVault && !wallet);
  show("createBox", !hasVault && !wallet);
  show("walletMain", !!wallet);
  if (wallet) renderMain();
}

async function renderMain() {
  $("addrText").textContent = wallet.address;
  const sel = $("networkSel");
  sel.value = networkKey;
  $("balances").innerHTML = "Loading balances…";
  try {
    balances = await getBalances(wallet, networkKey);
    $("balances").innerHTML = balances.map(b =>
      `<div class="bal"><span>${b.symbol}</span><b>${Number(b.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</b></div>`).join("");
    const sendSel = $("sendToken");
    sendSel.innerHTML = balances.map((b, i) =>
      `<option value="${i}">${b.symbol} — ${Number(b.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</option>`).join("");
  } catch (e) {
    $("balances").innerHTML = "Could not load balances (RPC busy — tap refresh).";
  }
  renderHistory();
  const url = fonbnkOfframpUrl(networkKey);
  show("cashoutBtn", !!url);
  if (url) $("cashoutBtn").onclick = () => window.open(url, "_blank");
  QRCode.toDataURL(wallet.address, { width: 180, margin: 1 })
    .then(u => { $("qrImg").src = u; }).catch(() => {});
}

function renderHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  $("history").innerHTML = h.length
    ? h.map(x => `<div class="hist">Sent ${x.amount} ${x.symbol} → ${x.to.slice(0, 8)}… · <a target="_blank" href="${x.explorer}/tx/${x.hash}">view ↗</a></div>`).join("")
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
    wallet = await unlockVault(v.keystore, pw);
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
  try {
    wallet = await unlockVault(localStorage.getItem(VAULT_KEY), $("unlockPw").value);
    refreshGate();
  } catch (e) { msg("onboardMsg", e.message); }
};

// ---------- main actions ----------
$("networkSel").onchange = (e) => { networkKey = e.target.value; renderMain(); };
$("refreshBtn").onclick = renderMain;
$("lockBtn").onclick = () => { wallet = null; pendingSend = null; refreshGate(); };
$("copyAddr").onclick = () => navigator.clipboard.writeText(wallet.address);

$("reviewSendBtn").onclick = async () => {
  const to = $("sendTo").value.trim();
  const amount = $("sendAmount").value.trim();
  const b = balances[Number($("sendToken").value)];
  if (!b || !amount || Number(amount) <= 0) return msg("sendMsg", "Enter an amount.");
  if (Number(amount) > Number(b.amount)) return msg("sendMsg", "Amount is more than your balance.");
  try {
    msg("sendMsg", "Estimating fee…", true);
    const token = b.address ? b : null;
    const fee = await estimateSend(wallet, networkKey, { to, amount, token });
    pendingSend = { to, amount, token, symbol: b.symbol };
    $("intentText").textContent = formatSendIntent({ amount, symbol: b.symbol, to, networkKey, feeNative: Number(fee).toFixed(6) });
    show("intentBox");
    msg("sendMsg", "");
  } catch (e) { msg("sendMsg", "Could not estimate: " + (e.shortMessage || e.message)); }
};

$("confirmSendBtn").onclick = async () => {
  if (!pendingSend) return;
  try {
    msg("sendMsg", "Sending… approve nothing else, just wait for the network.", true);
    const tx = await executeSend(wallet, networkKey, pendingSend);
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    h.unshift({ hash: tx.hash, amount: pendingSend.amount, symbol: pendingSend.symbol, to: pendingSend.to, explorer: NETWORKS[networkKey].explorer, at: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
    show("intentBox", false);
    msg("sendMsg", "Sent ✓ Tx: " + tx.hash.slice(0, 18) + "…", true);
    pendingSend = null;
    renderMain();
  } catch (e) { msg("sendMsg", "Send failed: " + (e.shortMessage || e.message)); }
};
$("cancelSendBtn").onclick = () => { pendingSend = null; show("intentBox", false); };

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
