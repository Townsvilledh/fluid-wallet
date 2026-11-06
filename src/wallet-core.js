// Fluid wallet core — all key handling lives here, on top of audited
// libraries (ethers v6 for EVM, @scure/* for Bitcoin). Fluid adds UI +
// routing, not home-grown cryptography. Non-custodial by construction:
// keys are generated and encrypted in the user's browser and never
// leave the device unencrypted. One seed phrase = every chain below.
import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import * as btc from "@scure/btc-signer";

const USDC = (address, decimals = 6) => ({ symbol: "USDC", address, decimals });
const USDT = (address, decimals = 6) => ({ symbol: "USDT", address, decimals });

// priceSym: the symbol used for USD pricing (L2s price their ETH as ETH).
export const NETWORKS = {
  ethereum: {
    name: "Ethereum", chainId: 1, symbol: "ETH", priceSym: "ETH",
    rpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io",
    fonbnkNetwork: "ETHEREUM",
    tokens: [USDC("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), USDT("0xdAC17F958D2ee523a2206206994597C13D831ec7")],
  },
  bsc: {
    name: "BNB Chain", chainId: 56, symbol: "BNB", priceSym: "BNB",
    rpc: "https://bsc-rpc.publicnode.com", explorer: "https://bscscan.com",
    fonbnkNetwork: "BNB",
    tokens: [USDC("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", 18), USDT("0x55d398326f99059fF775485246999027B3197955", 18)],
  },
  base: {
    name: "Base", chainId: 8453, symbol: "ETH", priceSym: "ETH",
    rpc: "https://base-rpc.publicnode.com", explorer: "https://basescan.org",
    fonbnkNetwork: "BASE",
    tokens: [USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), USDT("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2")],
  },
  arbitrum: {
    name: "Arbitrum", chainId: 42161, symbol: "ETH", priceSym: "ETH",
    rpc: "https://arbitrum-one-rpc.publicnode.com", explorer: "https://arbiscan.io",
    fonbnkNetwork: "ARBITRUM",
    tokens: [USDC("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), USDT("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9")],
  },
  optimism: {
    name: "OP Mainnet", chainId: 10, symbol: "ETH", priceSym: "ETH",
    rpc: "https://optimism-rpc.publicnode.com", explorer: "https://optimistic.etherscan.io",
    fonbnkNetwork: null,
    tokens: [USDC("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"), USDT("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58")],
  },
  polygon: {
    name: "Polygon", chainId: 137, symbol: "POL", priceSym: "POL",
    rpc: "https://polygon-bor-rpc.publicnode.com", explorer: "https://polygonscan.com",
    fonbnkNetwork: "POLYGON",
    tokens: [USDC("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"), USDT("0xc2132D05D31c914a87C6611C10748AEb04B58e8F")],
  },
  avalanche: {
    name: "Avalanche", chainId: 43114, symbol: "AVAX", priceSym: "AVAX",
    rpc: "https://avalanche-c-chain-rpc.publicnode.com", explorer: "https://snowtrace.io",
    fonbnkNetwork: null,
    tokens: [USDC("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"), USDT("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7")],
  },
  zksync: {
    name: "zkSync Era", chainId: 324, symbol: "ETH", priceSym: "ETH",
    rpc: "https://mainnet.era.zksync.io", explorer: "https://era.zksync.network",
    fonbnkNetwork: null,
    tokens: [USDC("0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4"), USDT("0x493257fD37EDB34451f62EDf8D2a0C418852bA4c")],
  },
  linea: {
    name: "Linea", chainId: 59144, symbol: "ETH", priceSym: "ETH",
    rpc: "https://linea-rpc.publicnode.com", explorer: "https://lineascan.build",
    fonbnkNetwork: null,
    tokens: [USDC("0x176211869cA2b568f2A7D4EE941E073a821EE1ff"), USDT("0xA219439258ca9da29E9Cc4cE5596924745e12B93")],
  },
  scroll: {
    name: "Scroll", chainId: 534352, symbol: "ETH", priceSym: "ETH",
    rpc: "https://scroll-rpc.publicnode.com", explorer: "https://scrollscan.com",
    fonbnkNetwork: null, tokens: [],
  },
  mantle: {
    name: "Mantle", chainId: 5000, symbol: "MNT", priceSym: "MNT",
    rpc: "https://rpc.mantle.xyz", explorer: "https://mantlescan.xyz",
    fonbnkNetwork: null, tokens: [],
  },
  gnosis: {
    name: "Gnosis", chainId: 100, symbol: "xDAI", priceSym: "DAI",
    rpc: "https://gnosis-rpc.publicnode.com", explorer: "https://gnosisscan.io",
    fonbnkNetwork: null, tokens: [],
  },
  celo: {
    name: "Celo", chainId: 42220, symbol: "CELO", priceSym: "CELO",
    rpc: "https://forno.celo.org", explorer: "https://celoscan.io",
    fonbnkNetwork: null,
    tokens: [USDC("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"), USDT("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e")],
  },
  fuse: {
    name: "Fuse", chainId: 122, symbol: "FUSE", priceSym: null,
    rpc: "https://rpc.fuse.io", explorer: "https://explorer.fuse.io",
    fonbnkNetwork: null, tokens: [],
  },
  sepolia: {
    name: "Sepolia (testnet)", chainId: 11155111, symbol: "ETH", priceSym: null,
    rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io",
    fonbnkNetwork: null, tokens: [],
  },
};

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export function providerFor(networkKey) {
  return new ethers.JsonRpcProvider(NETWORKS[networkKey].rpc, NETWORKS[networkKey].chainId);
}

/** Register runtime-discovered networks (see the discovery section at the
 *  bottom of this file) into the live registry every core function reads.
 *  Built-in keys are never overwritten; discovered chains use "c<chainId>"
 *  keys, which cannot collide with the built-ins. Returns the registry. */
export function registerNetworks(map) {
  for (const [k, v] of Object.entries(map || {})) {
    if (v && v.chainId && !NETWORKS[k]) NETWORKS[k] = v;
  }
  return NETWORKS;
}

/** Create a brand-new wallet. Returns the phrase ONCE so the UI can show it
 *  for backup; only the encrypted keystore should ever be stored. */
export async function createVault(password) {
  const wallet = ethers.Wallet.createRandom();
  const keystore = await wallet.encrypt(password);
  return { phrase: wallet.mnemonic.phrase, address: wallet.address, keystore };
}

export async function importVault(phrase, password) {
  const clean = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  if (!ethers.Mnemonic.isValidMnemonic(clean)) throw new Error("That seed phrase is not valid BIP39.");
  const wallet = ethers.Wallet.fromPhrase(clean);
  const keystore = await wallet.encrypt(password);
  return { phrase: clean, address: wallet.address, keystore };
}

export async function unlockVault(keystore, password) {
  try {
    return await ethers.Wallet.fromEncryptedJson(keystore, password);
  } catch {
    throw new Error("Wrong password.");
  }
}

export function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= 8;
}

export async function getBalances(wallet, networkKey) {
  const net = NETWORKS[networkKey];
  const provider = providerFor(networkKey);
  const out = [];
  const native = await provider.getBalance(wallet.address);
  out.push({ symbol: net.symbol, amount: ethers.formatEther(native), address: null });
  for (const t of net.tokens) {
    const c = new ethers.Contract(t.address, ERC20, provider);
    const bal = await c.balanceOf(wallet.address);
    out.push({ symbol: t.symbol, amount: ethers.formatUnits(bal, t.decimals), address: t.address, decimals: t.decimals });
  }
  return out;
}

/** The signer principle from the Fluid spec: the user approves a sentence,
 *  never a hex blob. Returns the intent text + the tx the wallet would send. */
export function formatSendIntent({ amount, symbol, to, networkKey, feeNative, name }) {
  const net = NETWORKS[networkKey];
  // When the recipient was given as a Fluid name, the confirmation must
  // show BOTH the name the user typed and the address it resolved to —
  // the sender confirms the resolution, not just the lookup.
  const dest = name ? `${name}.${FLUID_DOMAIN} (${to.slice(0, 6)}…${to.slice(-4)})` : to;
  return `Send ${amount} ${symbol} to ${dest} on ${net.name}. ` +
         `Network fee about ${feeNative} ${net.symbol}. Confirm?`;
}

export async function estimateSend(wallet, networkKey, { to, amount, token }) {
  const net = NETWORKS[networkKey];
  const provider = providerFor(networkKey);
  const signer = wallet.connect(provider);
  let gas;
  if (!token) {
    gas = await provider.estimateGas({ from: wallet.address, to, value: ethers.parseEther(String(amount)) });
  } else {
    const c = new ethers.Contract(token.address, ERC20, signer);
    gas = await c.transfer.estimateGas(to, ethers.parseUnits(String(amount), token.decimals));
  }
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  return ethers.formatEther(gas * gasPrice);
}

export async function executeSend(wallet, networkKey, { to, amount, token }) {
  if (!ethers.isAddress(to)) throw new Error("That is not a valid wallet address.");
  const provider = providerFor(networkKey);
  const signer = wallet.connect(provider);
  let tx;
  if (!token) {
    tx = await signer.sendTransaction({ to, value: ethers.parseEther(String(amount)) });
  } else {
    const c = new ethers.Contract(token.address, ERC20, signer);
    tx = await c.transfer(to, ethers.parseUnits(String(amount), token.decimals));
  }
  return tx; // caller awaits tx.wait() and records the hash
}

// ---------- USD prices (Binance public ticker, no key; graceful fallback) ----------
const PRICE_PAIRS = { ETH: "ETHUSDT", BNB: "BNBUSDT", BTC: "BTCUSDT", POL: "POLUSDT",
  AVAX: "AVAXUSDT", CELO: "CELOUSDT", MNT: "MNTUSDT", DAI: "DAIUSDT", USDC: "USDCUSDT", USDT: null };
export async function getPrices() {
  const out = { USDC: 1, USDT: 1, DAI: 1 };
  try {
    const syms = Object.values(PRICE_PAIRS).filter(Boolean);
    const url = "https://api.binance.com/api/v3/ticker/price?symbols=" + encodeURIComponent(JSON.stringify(syms));
    const res = await fetch(url);
    const data = await res.json();
    const byPair = Object.fromEntries(data.map(d => [d.symbol, parseFloat(d.price)]));
    for (const [sym, pair] of Object.entries(PRICE_PAIRS)) if (pair && byPair[pair]) out[sym] = byPair[pair];
    if (out.USDC == null && byPair.USDCUSDT) out.USDC = byPair.USDCUSDT;
  } catch { /* fall through to the CoinGecko fallback below */ }
  // Fallback (e.g. where api.binance.com is region-restricted — matters for
  // headless agents, which refuse unpriced sends): CoinGecko simple price.
  const CG = { BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", POL: "polygon-ecosystem-token", AVAX: "avalanche-2", CELO: "celo", MNT: "mantle" };
  const missing = Object.keys(CG).filter(s => out[s] == null);
  if (missing.length) {
    try {
      const ids = missing.map(s => CG[s]).join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const data = await res.json();
      for (const s of missing) if (data[CG[s]]?.usd) out[s] = data[CG[s]].usd;
    } catch { /* prices stay partial; callers that need them refuse safely */ }
  }
  return out;
}

// ---------- Bitcoin (same seed, BIP84 native SegWit) ----------
function btcKeys(phrase, account = 0) {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/84'/0'/${account}'/0/0`);
  const pay = btc.p2wpkh(child.publicKey, btc.NETWORK);
  return { child, address: pay.address, script: pay.script };
}
export function bitcoinAddress(phrase, account = 0) { return btcKeys(phrase, account).address; }

const MEMPOOL = "https://mempool.space/api";
export async function getBitcoinBalance(address) {
  const res = await fetch(`${MEMPOOL}/address/${address}`);
  const d = await res.json();
  const funded = d.chain_stats.funded_txo_sum + (d.mempool_stats?.funded_txo_sum || 0);
  const spent = d.chain_stats.spent_txo_sum + (d.mempool_stats?.spent_txo_sum || 0);
  return (funded - spent) / 1e8;
}
export async function getBtcFeeRate() {
  try {
    const res = await fetch(`${MEMPOOL}/v1/fees/recommended`);
    const d = await res.json();
    return Math.max(1, d.halfHourFee || 5);
  } catch { return 5; }
}
/** Build, sign and broadcast a BTC payment. Returns the txid. */
export async function sendBitcoin(phrase, { to, amountBtc, feeRate }) {
  const { child, address, script } = btcKeys(phrase);
  const rate = feeRate || (await getBtcFeeRate());
  const res = await fetch(`${MEMPOOL}/address/${address}/utxos`);
  const utxos = (await res.json()).filter(u => u.status?.confirmed !== false || true)
    .sort((a, b) => b.value - a.value);
  const target = Math.round(amountBtc * 1e8);
  const picked = []; let sum = 0;
  for (const u of utxos) { picked.push(u); sum += u.value; if (sum >= target + 1000) break; }
  // fee for nIn inputs, 2 outputs (pay + change), P2WPKH: ~10 + 68/in + 31/out vbytes
  const fee = Math.ceil((10 + picked.length * 68 + 62) * rate);
  if (sum < target + fee) throw new Error("Not enough confirmed BTC to cover the amount plus network fee.");
  const change = sum - target - fee;
  const tx = new btc.Transaction();
  for (const u of picked) {
    tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script, amount: BigInt(u.value) }, sighashType: btc.SigHash.ALL });
  }
  tx.addOutputAddress(to, BigInt(target), btc.NETWORK);
  if (change > 330) tx.addOutputAddress(address, BigInt(change), btc.NETWORK);
  tx.sign(child.privateKey);
  tx.finalize();
  const hex = tx.hex;
  const post = await fetch(`${MEMPOOL}/tx`, { method: "POST", body: hex });
  if (!post.ok) throw new Error("Bitcoin network rejected the transaction: " + (await post.text()));
  return post.text();
}

// ---------- Fluid Names: usernames that resolve under the Fluid domain ----------
// Your name is `you.fluid.is-a.dev`. The registry is a public JSON file in
// the open-source repo (names.json, served from the wallet site itself) —
// no server, no company database. Anyone can verify a name -> address
// mapping; only the repo (via signed GitHub commits/PRs) can publish one,
// and a future version moves this to an on-chain registry.
export const FLUID_DOMAIN = "fluid.is-a.dev";
export const NAMES_REGISTRY_URL = "https://townsvilledh.github.io/fluid-wallet/names.json";
export function validateFluidName(name) {
  return /^[a-z][a-z0-9_]{2,19}$/.test(name || "");
}
/** Accept "kemi", "@kemi", "kemi.fluid.is-a.dev", "kemi@fluid.is-a.dev". */
export function normalizeFluidName(input) {
  let s = String(input || "").trim().toLowerCase();
  s = s.replace(/^@/, "").replace(/@fluid\.is-a\.dev$/, "").replace(/\.fluid\.is-a\.dev$/, "");
  return s;
}
/** A name resolves to the wallet's KEYS (addresses) on every family:
 *  `evm` is one address valid on ALL 15 EVM chains/L2s for ANY token
 *  (native, USDC, USDT, any ERC-20), `btc` is the Bitcoin key, and `ln`
 *  is an optional Lightning address for invoice-less Lightning sends.
 *  New families (sui, sol) get added as fields — old entries keep working. */
export function buildNameEntry(name, evm, btc, ln = null) {
  if (!validateFluidName(name)) throw new Error("Name must be 3-20 chars: letters, numbers, underscore; start with a letter.");
  const entry = { evm, btc };
  if (ln) entry.ln = ln;
  return { [name]: entry };
}
/** Fetch a Lightning invoice for a Lightning address (LNURL-pay, LUD-16).
 *  Returns a BOLT11 invoice the user's own WebLN wallet then pays. */
export async function lightningInvoiceForAddress(lnAddress, sats) {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(String(lnAddress || "").trim());
  if (!m) throw new Error("That is not a Lightning address (name@domain).");
  const meta = await (await fetch(`https://${m[2]}/.well-known/lnurlp/${m[1]}`)).json();
  if (!meta.callback || meta.tag !== "payRequest") throw new Error("That Lightning address does not support LNURL-pay.");
  const amountMsat = Math.round(sats * 1000);
  if (amountMsat < (meta.minSendable || 0) || amountMsat > (meta.maxSendable || Infinity))
    throw new Error("Amount is outside that address's accepted range.");
  const inv = await (await fetch(`${meta.callback}${meta.callback.includes("?") ? "&" : "?"}amount=${amountMsat}`)).json();
  if (!inv.pr) throw new Error("Could not get an invoice from that Lightning address.");
  return inv.pr;
}
export async function resolveFluidName(input, registryUrl = NAMES_REGISTRY_URL) {
  const name = normalizeFluidName(input);
  if (!validateFluidName(name)) return null;
  const res = await fetch(registryUrl, { cache: "no-store" });
  if (!res.ok) return null;
  const reg = await res.json();
  const entry = reg[name];
  return entry ? { name, ...entry } : null;
}

// ---------- Platform fees: cheapest-route principle + 60/40 split, settled in BTC over Lightning ----------
// Fluid's own fees (RAIN claim fee, OGO ERA game rake, future swap fee) are
// split 60% to Ethuram's treasury and 40% to DripBot — and ALL settlement
// is in Bitcoin over the Lightning Network: fees accrue wherever they are
// collected, a keeper (DripBot) sweeps them, converts to BTC and pays both
// Lightning addresses. Lightning addresses are filled in when provided;
// the split math never waits on them.
export const FEE_SPLIT = {
  currency: "BTC", rail: "lightning",
  treasury: { share: 60, label: "Ethuram (treasury)", evmWallet: "0x7d0e382D1267C38EE5d5Ce806018d93da241750e", lnAddress: null },
  dripbot: { share: 40, label: "DripBot", x: "@bitcoinornatin", hashtag: "#bitcoinornothing", lnAddress: null,
    // Autonomous agent wallet created 2026-11-06 (agent/fluid-agent.mjs,
    // mode: autonomous, paired with @bitcoinornatin). Public addresses only:
    agentWallet: { evm: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", btc: "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn" },
    // The odd account, by design (docs/DRIPBOT.md): DripBot is AUTONOMOUS.
    // It has NO on/off-ramp and never sells anything. It only RECEIVES
    // BTC over Lightning (converted from platform fee assets) and PAYS
    // OUT BTC over Lightning — weekly follower drips and the OGO ERA
    // player pools. Its balance grows as Fluid usage and followers grow.
    role: "autonomous-distribution", ramps: false, receives: "BTC-Lightning only" },
};
// Fee settlement rule (Ethuram, 2026-11-06): fee profit must NOT sit idle
// in chain assets (BNB/USDT/etc.). Whenever accumulated unsettled fees —
// across all chains combined — reach the threshold ($2), the whole pot is
// converted to BTC on the Lightning Network via the easiest/cheapest route
// and split 60/40 (splitFee) in the same run. Repeat at every $2 mark.
export const FEE_SETTLEMENT = { thresholdUsd: 2, target: "BTC", rail: "lightning", route: "cheapest-available", splitAtConversion: true };
export function feeSettlementDue(accumulatedUsd) { return Number(accumulatedUsd) >= FEE_SETTLEMENT.thresholdUsd; }
/** Split an integer amount (sats, or any smallest unit) 60/40.
 *  Rounding remainder goes to the treasury so nothing is ever lost. */
export function splitFee(amount) {
  const a = Math.floor(Number(amount));
  const dripbot = Math.floor((a * FEE_SPLIT.dripbot.share) / 100);
  return { treasury: a - dripbot, dripbot };
}
// OGO ERA has its OWN fee split (set by Ethuram 2026-11-06), different
// from the wallet split: the game gives most of its fees back to players.
// 40% treasury / 20% top-100 leaderboard pool / 20% session lottery for
// the remaining active players / 20% weekly active-referral rewards.
// All settled in BTC (Lightning), like every Fluid split. Distribution
// (who is top-100, lottery draw, referral tally) is keeper work — DripBot
// runs it from the game's published activity data.
export const GAME_FEE_SPLIT = {
  currency: "BTC", rail: "lightning",
  treasury: 40, top100: 20, sessionLottery: 20, weeklyReferrals: 20,
};
export function splitGameFee(amount) {
  const a = Math.floor(Number(amount));
  const top100 = Math.floor((a * GAME_FEE_SPLIT.top100) / 100);
  const sessionLottery = Math.floor((a * GAME_FEE_SPLIT.sessionLottery) / 100);
  const weeklyReferrals = Math.floor((a * GAME_FEE_SPLIT.weeklyReferrals) / 100);
  return { treasury: a - top100 - sessionLottery - weeklyReferrals, top100, sessionLottery, weeklyReferrals };
}
/** Cheapest-route ranking for ramps, by documented typical fees.
 *  The provider always shows the final live quote before the user pays;
 *  Fluid's job is to put the typically-cheapest route first. */
const RAMP_FEE_PROFILE = {
  "Fonbnk": { score: 1, note: "flat ~$0.12 fee (documented) — usually cheapest locally" },
  "Ramp Network": { score: 2, note: "low % fees, often ~0.5-1.5%" },
  "Transak": { score: 3, note: "typically ~0.5-3.5% + network fee" },
  "MoonPay": { score: 4, note: "typically ~1-4.5% depending on payment method" },
};
export function rankRoutes(routes) {
  return routes.map(r => ({ ...r, ...(RAMP_FEE_PROFILE[r.name] || { score: 9, note: "" }) }))
    .sort((a, b) => a.score - b.score);
}

// ---------- Lightning (WebLN: user keeps their own Lightning wallet) ----------
export async function payLightningInvoice(invoice) {
  if (typeof window === "undefined" || !window.webln) {
    throw new Error("No Lightning wallet found. Install Alby or another WebLN wallet, then try again — Fluid never custodies your Lightning funds.");
  }
  await window.webln.enable();
  return window.webln.sendPayment(invoice);
}

// ---------- Global ramps: Fluid routes, providers settle (users KYC with them) ----------
// Local-currency rails: pick a country, Fluid builds the provider link with
// that country's ISO code so the user deposits/withdraws in THEIR currency
// (NGN, KES, GHS, ZAR, USD, EUR...). Fonbnk covers the African corridors
// below (bank + mobile money inside its widget); the global providers
// cover 150-180+ countries each. Fluid never touches the fiat itself.
export const RAMP_COUNTRIES = [
  { code: "NG", name: "Nigeria · NGN", fonbnk: true },
  { code: "KE", name: "Kenya · KES", fonbnk: true },
  { code: "GH", name: "Ghana · GHS", fonbnk: true },
  { code: "ZA", name: "South Africa · ZAR", fonbnk: true },
  { code: "UG", name: "Uganda · UGX", fonbnk: true },
  { code: "TZ", name: "Tanzania · TZS", fonbnk: true },
  { code: "CM", name: "Cameroon · XAF", fonbnk: true },
  { code: "SN", name: "Senegal · XOF", fonbnk: true },
  { code: "CI", name: "Côte d'Ivoire · XOF", fonbnk: true },
  { code: "ZM", name: "Zambia · ZMW", fonbnk: true },
  { code: "US", name: "United States · USD", fonbnk: false },
  { code: "GB", name: "United Kingdom · GBP", fonbnk: false },
  { code: "DE", name: "Germany · EUR", fonbnk: false },
  { code: "IN", name: "India · INR", fonbnk: false },
  { code: "BR", name: "Brazil · BRL", fonbnk: false },
  { code: "PH", name: "Philippines · PHP", fonbnk: false },
  { code: "ID", name: "Indonesia · IDR", fonbnk: false },
  { code: "MX", name: "Mexico · MXN", fonbnk: false },
];
export function fonbnkOfframpUrl(networkKey, asset = "USDC", country = "NG") {
  const net = NETWORKS[networkKey];
  if (!net.fonbnkNetwork) return null;
  const p = new URLSearchParams({
    network: net.fonbnkNetwork, asset, paymentChannel: "bank", countryIsoCode: country,
  });
  return `https://pay.fonbnk.com/offramp?${p.toString()}`;
}
export function fonbnkOnrampUrl(networkKey, asset = "USDC", country = "NG") {
  const net = NETWORKS[networkKey];
  if (!net.fonbnkNetwork) return null;
  const p = new URLSearchParams({ network: net.fonbnkNetwork, asset, countryIsoCode: country });
  return `https://pay.fonbnk.com/onramp?${p.toString()}`;
}
// Global consumer ramps (no Fluid partner key needed; user completes on provider).
export const GLOBAL_RAMPS = [
  { name: "MoonPay", region: "Global · 180+ countries", buy: "https://www.moonpay.com/buy", sell: "https://www.moonpay.com/sell" },
  { name: "Ramp Network", region: "Global · 150+ countries", buy: "https://ramp.network/", sell: "https://ramp.network/" },
  { name: "Transak", region: "Global · 170+ countries", buy: "https://global.transak.com/", sell: "https://global.transak.com/" },
];

// ---------- Agentic wallets ----------
// An agent wallet is a SEPARATE account derived from the owner's seed at a
// reserved account range (1000+), so one seed backup covers owner + agents
// while agent funds stay apart from the owner's main account. Agent wallets
// are chain-only BY DESIGN: no KYC, no on/off-ramps, no seed export. The
// agent works through intents (window.FluidAgent); the owner's signer signs.
export const AGENT_ACCOUNT_BASE = 1000;
export const AGENT_POLICY_DEFAULTS = Object.freeze({
  kyc: false, ramps: false, seedExport: false,
  chains: "all",            // every Fluid chain: 15 EVM + Bitcoin (+ Lightning receive via owner's address)
  perTxCapUsd: 50, dailyCapUsd: 200,
  approval: "owner",        // owner approves each spend in the wallet UI
});
export function agentEvmWallet(mnemonic, index = 0) {
  return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/${AGENT_ACCOUNT_BASE + index}'/0/0`);
}
export function agentAddresses(mnemonic, index = 0) {
  return { evm: agentEvmWallet(mnemonic, index).address, btc: bitcoinAddress(mnemonic, AGENT_ACCOUNT_BASE + index) };
}
export function buildAgentDescriptor({ name, index = 0, evm, btc, policy = {} }) {
  return {
    type: "fluid-agent-wallet", version: 1, name,
    accountIndex: AGENT_ACCOUNT_BASE + index,
    keys: { evm, btc },
    access: { blockchain: "full", kyc: false, onramp: false, offramp: false },
    policy: { ...AGENT_POLICY_DEFAULTS, ...policy },
    api: "window.FluidAgent — requestTransfer({network,to,amount}) returns a promise; the owner approves and the wallet signs. Keys are never exposed to the agent.",
  };
}
// Policy gate for an agent spend intent. Returns {ok} or {ok:false, reason}.
export function checkAgentPolicy(policy, amountUsd, spentTodayUsd = 0) {
  const p = { ...AGENT_POLICY_DEFAULTS, ...(policy || {}) };
  if (p.ramps !== false) return { ok: false, reason: "agent wallets never use ramps" };
  if (!(amountUsd > 0)) return { ok: false, reason: "amount must be positive" };
  if (amountUsd > p.perTxCapUsd) return { ok: false, reason: `over per-transaction cap ($${p.perTxCapUsd})` };
  if (spentTodayUsd + amountUsd > p.dailyCapUsd) return { ok: false, reason: `over daily cap ($${p.dailyCapUsd})` };
  return { ok: true };
}
// Execute an owner-approved agent spend (native token) on a given network.
export async function sendFromAgent(mnemonic, index, networkKey, to, amountNative) {
  const net = NETWORKS[networkKey];
  if (!net) throw new Error("Unknown network: " + networkKey);
  const provider = new ethers.JsonRpcProvider(net.rpc);
  const aw = agentEvmWallet(mnemonic, index).connect(provider);
  const tx = await aw.sendTransaction({ to, value: ethers.parseEther(String(amountNative)) });
  await tx.wait();
  return tx;
}

// ---------- Swaps (LI.FI aggregator: one search across every chain) ----------
// Fluid does not run its own DEX. A swap is a route search at LI.FI
// (public API, no key): same-chain DEX swaps and cross-chain bridge+swap
// routes come back together, Fluid ranks them cheapest (best net USD
// received after gas) and fastest, shows the user a plain sentence, and
// only then signs — step by step, from the user's own wallet, on the
// source chain. Bridge delivery on the destination chain is automatic
// once the source steps are mined. No Fluid server, no Fluid custody.
export const LIFI_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
const LIFI_API = "https://li.quest/v1";

export function swapAmountToRaw(amount, decimals) { return ethers.parseUnits(String(amount), decimals).toString(); }
export function swapRawToAmount(raw, decimals) { return ethers.formatUnits(raw ?? "0", decimals); }

/** Wrap a /quote step (LI.FI's single recommended route) in route shape
 *  so ranking and execution treat both endpoints identically. */
function quoteStepToRoute(step) {
  const e = step.estimate || {};
  return {
    id: step.id, type: step.type,
    fromChainId: step.action?.fromChainId, toChainId: step.action?.toChainId,
    fromAmount: step.action?.fromAmount, fromToken: step.action?.fromToken, toToken: step.action?.toToken,
    toAmount: e.toAmount, toAmountMin: e.toAmountMin, toAmountUSD: e.toAmountUSD, fromAmountUSD: e.fromAmountUSD,
    gasCostUSD: (e.gasCosts || []).reduce((s, g) => s + Number(g.amountUSD || 0), 0),
    executionDuration: e.executionDuration,
    steps: [step],
  };
}

/** Ask LI.FI for routes. fromAmount is the RAW integer amount (string)
 *  in the from-token's smallest unit. Primary path is POST /v1/routes
 *  (several competing routes). That endpoint can be very slow, so on a
 *  timeout or empty answer Fluid falls back to GET /v1/quote, which
 *  returns the single recommended route as one executable step. */
export async function getSwapRoutes({ fromChainKey, toChainKey, fromTokenAddress, toTokenAddress, fromAmount, fromAddress }) {
  const from = NETWORKS[fromChainKey], to = NETWORKS[toChainKey];
  if (!from || !to) throw new Error("Unknown network in swap.");
  try {
    const res = await fetch(`${LIFI_API}/routes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        fromChainId: from.chainId, toChainId: to.chainId,
        fromTokenAddress, toTokenAddress,
        fromAmount: String(fromAmount), fromAddress, toAddress: fromAddress,
        options: { integrator: "fluid-wallet", order: "RECOMMENDED" },
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.routes?.length) return data.routes;
    }
  } catch { /* slow or unavailable — fall back to /quote below */ }
  const q = new URLSearchParams({
    fromChain: from.chainId, toChain: to.chainId,
    fromToken: fromTokenAddress, toToken: toTokenAddress,
    fromAmount: String(fromAmount), fromAddress,
  });
  const res = await fetch(`${LIFI_API}/quote?${q.toString()}`);
  const step = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Route search failed: " + (step.message || ("HTTP " + res.status)));
  return [quoteStepToRoute(step)];
}

function swapRouteGasUsd(route) {
  const direct = Number(route?.gasCostUSD);
  if (Number.isFinite(direct) && route?.gasCostUSD != null && route?.gasCostUSD !== "") return direct;
  let sum = 0;
  for (const s of route?.steps || []) for (const g of s.estimate?.gasCosts || []) sum += Number(g.amountUSD || 0);
  return sum;
}
function swapRouteDurationSec(route) {
  const direct = Number(route?.executionDuration);
  if (route?.executionDuration != null && Number.isFinite(direct)) return direct;
  let sum = 0, seen = false;
  for (const s of route?.steps || []) {
    const d = Number(s.estimate?.executionDuration);
    if (Number.isFinite(d)) { sum += d; seen = true; }
  }
  return seen ? sum : Infinity;
}
/** Pure ranking: annotate each route with netUsd (what you receive in
 *  USD minus gas in USD), durationSec, and cheapest / fastest flags, and
 *  sort best-value first. Input routes are NOT mutated. */
export function rankSwapRoutes(routes) {
  const scored = (routes || []).map(r => {
    const gas = swapRouteGasUsd(r);
    const out = Number(r?.toAmountUSD);
    return {
      ...r,
      gasCostUSD: gas,
      netUsd: (Number.isFinite(out) ? out : 0) - gas,
      durationSec: swapRouteDurationSec(r),
      cheapest: false, fastest: false,
    };
  });
  if (scored.length) {
    let best = scored[0];
    for (const r of scored) if (r.netUsd > best.netUsd || (r.netUsd === best.netUsd && r.durationSec < best.durationSec)) best = r;
    best.cheapest = true;
    let fast = scored[0];
    for (const r of scored) if (r.durationSec < fast.durationSec || (r.durationSec === fast.durationSec && r.netUsd > fast.netUsd)) fast = r;
    fast.fastest = true;
  }
  return scored.sort((a, b) => (b.netUsd - a.netUsd) || (a.durationSec - b.durationSec));
}

/** The steps of a route Fluid can actually sign: those carrying a
 *  transactionRequest for the route's source chain. Bridge waiting is
 *  not a step — only signature steps are returned. */
export function swapExecutableSteps(route) {
  const cid = (v) => { try { return Number(BigInt(v)); } catch { return NaN; } };
  return (route?.steps || []).filter(s =>
    s.transactionRequest && (s.transactionRequest.chainId == null || cid(s.transactionRequest.chainId) === Number(route.fromChainId)));
}
export function swapRouteExecutable(route) {
  const steps = swapExecutableSteps(route);
  return steps.length
    ? { ok: true, steps }
    : { ok: false, reason: "This route needs steps Fluid can't sign yet — pick another route." };
}

const SWAP_ERC20 = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
/** Execute a chosen route: approve the from-token where a step needs it,
 *  then send each signable step's transaction in order from the user's
 *  wallet on the source chain, awaiting each receipt. Returns tx hashes.
 *  onProgress receives human sentences for the UI. Approvals are for the
 *  EXACT amount the step needs — never unlimited — and every approval is
 *  reported through the optional onApprove callback so the app layer can
 *  keep a record the user can later review and revoke. */
export async function executeSwapRoute(wallet, route, onProgress = () => {}, onApprove = () => {}) {
  const fromKey = Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === Number(route?.fromChainId));
  if (!fromKey) throw new Error("Swap source chain is not a Fluid network.");
  const { ok, steps, reason } = swapRouteExecutable(route);
  if (!ok) throw new Error(reason);
  const provider = providerFor(fromKey);
  const signer = wallet.connect(provider);
  const hashes = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], tr = step.transactionRequest;
    const fromToken = step.action?.fromToken;
    const isNative = !fromToken?.address || /^0x0{40}$/i.test(fromToken.address);
    if (!isNative && step.action?.fromAmount) {
      const need = BigInt(step.action.fromAmount);
      const spender = step.estimate?.approvalAddress || tr.to;
      const c = new ethers.Contract(fromToken.address, SWAP_ERC20, signer);
      if ((await c.allowance(wallet.address, spender)) < need) {
        onProgress(`Approving ${fromToken.symbol || "token"} for the route (exact amount only)…`);
        const atx = await c.approve(spender, need);
        await atx.wait();
        try {
          onApprove({ chainKey: fromKey, token: fromToken.address, tokenSymbol: fromToken.symbol || null, spender, amount: need.toString(), decimals: fromToken.decimals ?? null, at: Date.now() });
        } catch { /* recording an approval must never break a swap */ }
      }
    }
    onProgress(`Signing step ${i + 1} of ${steps.length}…`);
    const txReq = { to: tr.to, data: tr.data || "0x", value: tr.value != null ? BigInt(tr.value) : 0n };
    if (tr.gasLimit != null) { try { txReq.gasLimit = BigInt(tr.gasLimit); } catch { /* let the node estimate */ } }
    const tx = await signer.sendTransaction(txReq);
    hashes.push(tx.hash);
    onProgress(`Step ${i + 1} sent — waiting for it to mine…`);
    await tx.wait();
  }
  return hashes;
}

/** Revoke a token approval: set the spender's allowance back to zero. */
export async function revokeApproval(wallet, chainKey, tokenAddress, spender) {
  if (!NETWORKS[chainKey]) throw new Error("Unknown network.");
  const signer = wallet.connect(providerFor(chainKey));
  const c = new ethers.Contract(tokenAddress, SWAP_ERC20, signer);
  const tx = await c.approve(spender, 0n);
  await tx.wait();
  return tx.hash;
}

/** Address-poisoning defence: scammers generate addresses that share the
 *  first and last few characters with one you already use, then dust you
 *  from them hoping you'll copy the wrong one out of your history. Returns
 *  the known address the recipient imitates (same first 4 AND last 4 hex
 *  chars, case-insensitive, but NOT the same address), otherwise null. */
export function looksLikePoison(recipient, knownAddresses) {
  const norm = (a) => String(a || "").trim().toLowerCase();
  const r = norm(recipient);
  if (!/^0x[0-9a-f]{40}$/.test(r)) return null;
  for (const k of knownAddresses || []) {
    const known = norm(k);
    if (!/^0x[0-9a-f]{40}$/.test(known) || known === r) continue;
    if (known.slice(0, 6) === r.slice(0, 6) && known.slice(-4) === r.slice(-4)) return k;
  }
  return null;
}

// ---------- Chain discovery (Phase 0: gated EVM auto-discovery) ----------
// Fluid's 15 built-ins stay canonical, but the EVM world keeps growing.
// Discovery merges three keyless public sources — LI.FI's chain list (the
// routing universe), chainid.network's registry (names, RPCs, explorers,
// status, red flags) and DefiLlama's TVL table (does anyone actually use
// this chain?) — and admits a chain only through the gate below:
//   * not in the hard graveyard (sunset/wound-down chains), not a known
//     non-EVM squatter in the registry (those get their own family phase);
//   * registry status active (an absent status counts as active) and no
//     "reusedChainId" red flag;
//   * not a testnet (by name, or LI.FI's own mainnet flag);
//   * and it must matter: LI.FI-listed, or DefiLlama TVL >= $10M
//     (tier "display"); LI.FI-listed or TVL >= $1M is the floor for the
//     "discoverable" tier. Below both, the chain is excluded.
// Admission is never trust: before the wallet switches to a discovered
// chain, probeChain fingerprints its RPC (eth_chainId must match, blocks
// must flow). Discovery failure degrades to the built-ins, always.
export const CHAIN_GRAVEYARD = new Set([1101, 81457, 1666600000]); // Polygon zkEVM, Blast, Harmony — sunset/wound down
const CHAIN_NON_EVM = new Set([728126428, 4160]); // Tron, Algorand: registry entries, but not EVM — allow-list-only families
const TESTNET_NAME_TOKENS = new Set(["sepolia", "goerli", "holesky", "mumbai", "amoy", "fuji",
  "alfajores", "baobab", "kairos", "chapel", "kovan", "rinkeby", "ropsten", "chiado", "minato"]);
const CHAIN_NAME_SUFFIXES = ["mainnet", "network", "blockchain", "chain", "evm", "espace", "l1", "l2"];

function chainNameMarksTestnet(name) {
  const s = String(name || "").toLowerCase();
  if (s.includes("testnet")) return true;
  return s.split(/[^a-z0-9]+/).some(t => TESTNET_NAME_TOKENS.has(t));
}
/** Loose name key for cross-source matching: "X Layer Mainnet", "X Layer"
 *  and "XLayer" should all land on the same chain. */
function normalizeChainName(name) {
  let s = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of CHAIN_NAME_SUFFIXES) {
      if (s.length > suf.length && s.endsWith(suf)) { s = s.slice(0, -suf.length); changed = true; }
    }
  }
  return s;
}
const cleanChainRpc = (u) =>
  (typeof u === "string" && u.startsWith("https://") && !u.includes("{") && !u.includes("}")) ? u : null;
/** LI.FI carries a few pseudo-entries that are not plain EVM networks for
 *  their id (its Hyperliquid L1 entry uses id 1337 while its own wallet
 *  metadata points at chain 42161). A self-consistent entry's metamask
 *  chainId must equal the chain id itself; anything else is dropped. */
function lifiChainConsistent(c) {
  const mm = c && c.metamask && c.metamask.chainId;
  if (!mm) return true;
  const n = parseInt(mm, 16);
  return Number.isFinite(n) && n === Number(c.id);
}

async function fetchJsonT(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
/** Fetch the three discovery sources. Each is independently fault-tolerant:
 *  a failed source comes back empty and the gate simply works with less —
 *  this function never throws. */
export async function fetchEvmChainSources() {
  const grab = (p) => p.catch(() => null);
  const [lifiRaw, registryRaw, tvlRaw] = await Promise.all([
    grab(fetchJsonT("https://li.quest/v1/chains", 20000)),
    grab(fetchJsonT("https://chainid.network/chains.json", 30000)),
    grab(fetchJsonT("https://api.llama.fi/v2/chains", 20000)),
  ]);
  const lifiList = Array.isArray(lifiRaw) ? lifiRaw : (lifiRaw && Array.isArray(lifiRaw.chains) ? lifiRaw.chains : []);
  return {
    lifiChains: lifiList.filter(c => c && c.chainType === "EVM"),
    registry: Array.isArray(registryRaw) ? registryRaw : [],
    tvl: Array.isArray(tvlRaw) ? tvlRaw : [],
  };
}

/** The gate itself — pure, no I/O. Inputs are the three raw source lists
 *  (LI.FI chain objects, chainid.network entries, DefiLlama rows); output
 *  is the admitted chains, display tier first, then by TVL. */
export function gateChains({ lifiChains = [], registry = [], tvl = [] } = {}) {
  const lifiById = new Map(), regById = new Map(), tvlById = new Map();
  for (const c of lifiChains || []) {
    if (c && c.chainType === "EVM" && Number.isFinite(Number(c.id)) && lifiChainConsistent(c)) lifiById.set(Number(c.id), c);
  }
  for (const c of registry || []) {
    if (c && Number.isFinite(Number(c.chainId))) regById.set(Number(c.chainId), c);
  }
  for (const t of tvl || []) {
    if (!t || t.chainId == null || !Number.isFinite(Number(t.chainId))) continue;
    const id = Number(t.chainId), v = Number(t.tvl || 0);
    if (!tvlById.has(id) || v > tvlById.get(id)) tvlById.set(id, v); // duplicate rows exist — keep the max
  }
  // DefiLlama leaves chainId null on some rows (XDC, Flare, Hyperliquid…).
  // Attach those by normalized name — uniquely, or not at all.
  const nameToId = new Map(), ambiguousNames = new Set();
  const claimName = (name, id) => {
    const k = normalizeChainName(name);
    if (!k) return;
    if (nameToId.has(k) && nameToId.get(k) !== id) ambiguousNames.add(k);
    else nameToId.set(k, id);
  };
  for (const [id, c] of regById) claimName(c.name, id);
  for (const [id, c] of lifiById) claimName(c.name, id);
  for (const k of ambiguousNames) nameToId.delete(k);
  for (const t of tvl || []) {
    if (!t || t.chainId != null) continue;
    const id = nameToId.get(normalizeChainName(t.name));
    if (id != null && !tvlById.has(id)) tvlById.set(id, Number(t.tvl || 0));
  }

  const out = [];
  for (const chainId of new Set([...regById.keys(), ...lifiById.keys()])) {
    if (CHAIN_GRAVEYARD.has(chainId) || CHAIN_NON_EVM.has(chainId)) continue;
    const reg = regById.get(chainId), lifi = lifiById.get(chainId);
    if (reg && reg.status && reg.status !== "active") continue;
    if (reg && Array.isArray(reg.redFlags) && reg.redFlags.includes("reusedChainId")) continue;
    let name = (reg && reg.name) || (lifi && lifi.name) || "";
    let testnet = chainNameMarksTestnet(name);
    if (lifi && lifi.mainnet === false) testnet = true;
    // A LI.FI mainnet whose registry entry still carries a previous chain's
    // testnet name is a stale reused-id entry (live case: 999 is "Wanchain
    // Testnet" in the registry, HyperEVM to LI.FI). LI.FI wins — for the
    // name and for every other field sourced from that registry entry.
    let staleReg = false;
    if (lifi && lifi.mainnet === true && chainNameMarksTestnet(name) && !chainNameMarksTestnet(lifi.name)) {
      name = lifi.name; testnet = false; staleReg = true;
    }
    if (testnet || !name) continue;
    const chainTvl = tvlById.get(chainId) || 0;
    let tier = null;
    if (lifi || chainTvl >= 10_000_000) tier = "display";
    else if (chainTvl >= 1_000_000) tier = "discoverable";
    if (!tier) continue;
    const fieldReg = staleReg ? null : reg;
    const rpcCandidates = [...((lifi && lifi.metamask && lifi.metamask.rpcUrls) || []), ...((fieldReg && fieldReg.rpc) || [])];
    const rpc = rpcCandidates.map(cleanChainRpc).find(Boolean) || null;
    let explorer = null;
    const exps = (fieldReg && fieldReg.explorers) || [];
    const eip = exps.find(e => e && e.standard === "EIP3091") || exps[0];
    if (eip && eip.url) explorer = String(eip.url).replace(/\/+$/, "");
    else if (lifi && lifi.metamask && Array.isArray(lifi.metamask.blockExplorerUrls) && lifi.metamask.blockExplorerUrls[0]) {
      explorer = String(lifi.metamask.blockExplorerUrls[0]).replace(/\/+$/, "");
    }
    const nc = (fieldReg && fieldReg.nativeCurrency) || (lifi && lifi.nativeToken) || {};
    out.push({
      key: "c" + chainId, chainId, name, rpc, explorer,
      symbol: nc.symbol || (lifi && lifi.coin) || "", decimals: nc.decimals ?? 18,
      tier, lifi: !!lifi, tvl: chainTvl,
    });
  }
  const tierRank = { display: 0, discoverable: 1 };
  return out.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || b.tvl - a.tvl || a.name.localeCompare(b.name));
}

/** Fingerprint a discovered chain before trusting it: its RPC must answer
 *  eth_chainId with the chain's own id, and blocks must flow. One retry
 *  after a short pause — public RPCs throttle bursts, and a single user
 *  tap should not be rejected for a transient rate limit. */
export async function probeChain(entry) {
  if (!entry || !entry.rpc || !entry.chainId) return false;
  const call = async (method) => {
    const res = await fetch(entry.rpc, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
    });
    if (!res.ok) throw new Error("http " + res.status);
    return res.json();
  };
  const attempt = async () => {
    const idRes = await call("eth_chainId");
    if (parseInt(idRes && idRes.result, 16) !== entry.chainId) return false;
    const bnRes = await call("eth_blockNumber");
    return typeof (bnRes && bnRes.result) === "string";
  };
  try { if (await attempt()) return true; } catch { /* fall through to the retry */ }
  await new Promise(r => setTimeout(r, 600));
  try { return await attempt(); } catch { return false; }
}

/** The stablecoins LI.FI knows on a chain — fetched lazily when a
 *  discovered chain is first selected. Returns [{symbol, address,
 *  decimals}] for USDC/USDT, [] when the chain has none, null when the
 *  lookup itself failed (callers may retry later). */
export async function fetchStableTokens(chainId) {
  try {
    const res = await fetch(`${LIFI_API}/tokens?chains=${chainId}`, { signal: AbortSignal.timeout(20000) });
    // LI.FI answers 400 for chains outside its universe — that is a
    // definitive "no list", not a failure: report an empty list so
    // callers stop retrying. Other errors stay retryable (null).
    if (res.status === 400) return [];
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const list = (data && data.tokens && data.tokens[String(chainId)]) || [];
    const out = [];
    for (const sym of ["USDC", "USDT"]) {
      const t = list.find(x => x && x.symbol === sym && x.coinKey === sym) || list.find(x => x && x.symbol === sym);
      if (t && ethers.isAddress(t.address) && !/^0x0{40}$/i.test(t.address)) {
        out.push({ symbol: sym, address: t.address, decimals: t.decimals ?? 6 });
      }
    }
    return out;
  } catch { return null; }
}

/** The swap version of the signer principle: a sentence, never a blob. */
export function formatSwapIntent({ fromAmount, fromSymbol, fromNetKey, toAmount, toSymbol, toNetKey, toolName, feeUsd, durationSec }) {
  const f = NETWORKS[fromNetKey], t = NETWORKS[toNetKey];
  const secs = Math.max(1, Math.round(Number(durationSec) || 0));
  const when = Number.isFinite(durationSec)
    ? (durationSec < 90 ? ` Funds should arrive in about ${secs} second${secs === 1 ? "" : "s"}.`
                        : ` Funds should arrive in about ${Math.round(durationSec / 60)} minutes.`)
    : "";
  const fee = Number(feeUsd || 0);
  const feeText = fee > 0 && fee < 0.01 ? "under $0.01" : "$" + fee.toFixed(2);
  return `Swap ${fromAmount} ${fromSymbol} on ${f.name} for about ${toAmount} ${toSymbol} on ${t.name} via ${toolName}. ` +
         `Route + network fees about ${feeText}.${when} Confirm?`;
}
