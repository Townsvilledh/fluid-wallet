// Fluid wallet core — all key handling lives here, on top of audited
// libraries (ethers v6 for EVM, @scure/* for Bitcoin). Fluid adds UI +
// routing, not home-grown cryptography. Non-custodial by construction:
// keys are generated and encrypted in the user's browser and never
// leave the device unencrypted. One seed phrase = every chain below.
import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import * as btc from "@scure/btc-signer";
import { base58, base58check, base64, bech32, hex } from "@scure/base";
import { SigningStargateClient, GasPrice, calculateFee, assertIsDeliverTxSuccess } from "@cosmjs/stargate";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  Keypair as SolKeypair, PublicKey as SolPublicKey, SystemProgram as SolSystemProgram,
  Transaction as SolTransaction, TransactionInstruction as SolTxInstruction,
  VersionedTransaction as SolVersionedTransaction,
} from "@solana/web3.js";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction as SuiTransaction } from "@mysten/sui/transactions";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

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
  AVAX: "AVAXUSDT", CELO: "CELOUSDT", MNT: "MNTUSDT", DAI: "DAIUSDT", USDC: "USDCUSDT", USDT: null, TRX: "TRXUSDT", SOL: "SOLUSDT",
  LTC: "LTCUSDT", DOGE: "DOGEUSDT", BCH: "BCHUSDT", SUI: "SUIUSDT",
  ATOM: "ATOMUSDT", OSMO: "OSMUSDT", TIA: "TIAUSDT", INJ: "INJUSDT", SEI: "SEIUSDT", DYDX: "DYDXUSDT" };
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
  const CG = { BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", POL: "polygon-ecosystem-token", AVAX: "avalanche-2", CELO: "celo", MNT: "mantle", TRX: "tron", SOL: "solana", LTC: "litecoin", DOGE: "dogecoin", BCH: "bitcoin-cash", SUI: "sui", ATOM: "cosmos", OSMO: "osmosis", TIA: "celestia", INJ: "injective-protocol", SEI: "sei-network", DYDX: "dydx-chain" };
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

// ---------- Litecoin (same seed, BIP84 native SegWit, coin type 2) ----------
// Same construction as Bitcoin, with Litecoin's network parameters:
// bech32 hrp "ltc", pubKeyHash 0x30, scriptHash 0x32, WIF 0xb0 — the
// address for the abandon…about test seed was cross-checked against
// bitcoinjs-lib's Litecoin params in scratch before shipping.
const LTC_NETWORK = { bech32: "ltc", pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 };
function ltcKeys(phrase, account = 0) {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/84'/2'/${account}'/0/0`);
  const pay = btc.p2wpkh(child.publicKey, LTC_NETWORK);
  return { child, address: pay.address, script: pay.script };
}
export function litecoinAddress(phrase, account = 0) { return ltcKeys(phrase, account).address; }
export function isValidLitecoinAddress(address) {
  try { btc.Address(LTC_NETWORK).decode(String(address).trim()); return true; } catch { return false; }
}

const LTC_API = "https://litecoinspace.org/api"; // Esplora (mempool-style), keyless
export async function getLitecoinBalance(address) {
  const res = await fetch(`${LTC_API}/address/${address}`);
  const d = await res.json();
  const funded = d.chain_stats.funded_txo_sum + (d.mempool_stats?.funded_txo_sum || 0);
  const spent = d.chain_stats.spent_txo_sum + (d.mempool_stats?.spent_txo_sum || 0);
  return (funded - spent) / 1e8;
}
export async function getLtcFeeRate() {
  try {
    const res = await fetch(`${LTC_API}/v1/fees/recommended`);
    const d = await res.json();
    return Math.max(1, d.halfHourFee || 1);
  } catch { return 1; }
}
export function formatLitecoinSendIntent({ amount, to, feeLtc }) {
  return `Send ${amount} LTC to ${to} on Litecoin. Network fee about ${feeLtc} LTC. Confirm?`;
}
/** Build, sign and broadcast an LTC payment. Returns the txid. */
export async function sendLitecoin(phrase, { to, amountLtc, feeRate }) {
  const { child, address, script } = ltcKeys(phrase);
  if (!isValidLitecoinAddress(to)) throw new Error("That is not a valid Litecoin address.");
  const rate = feeRate || (await getLtcFeeRate());
  // NB: litecoinspace's UTXO route is the singular /utxo (mempool.space
  // uses the plural /utxos) — verified live before wiring.
  const res = await fetch(`${LTC_API}/address/${address}/utxo`);
  const utxos = (await res.json()).sort((a, b) => b.value - a.value);
  const target = Math.round(amountLtc * 1e8);
  const picked = []; let sum = 0;
  for (const u of utxos) { picked.push(u); sum += u.value; if (sum >= target + 1000) break; }
  // P2WPKH sizing mirrors Bitcoin: ~10 + 68/in + 31/out vbytes.
  const fee = Math.ceil((10 + picked.length * 68 + 62) * rate);
  if (sum < target + fee) throw new Error("Not enough confirmed LTC to cover the amount plus network fee.");
  const change = sum - target - fee;
  const tx = new btc.Transaction();
  for (const u of picked) {
    tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script, amount: BigInt(u.value) }, sighashType: btc.SigHash.ALL });
  }
  tx.addOutputAddress(to, BigInt(target), LTC_NETWORK);
  if (change > 294) tx.addOutputAddress(address, BigInt(change), LTC_NETWORK); // SegWit dust limit
  tx.sign(child.privateKey);
  tx.finalize();
  const post = await fetch(`${LTC_API}/tx`, { method: "POST", body: tx.hex });
  if (!post.ok) throw new Error("Litecoin network rejected the transaction: " + (await post.text()));
  return post.text();
}

// ---------- Dogecoin (same seed, BIP44 legacy only, coin type 3) ----------
// Dogecoin has no SegWit in this wallet: legacy P2PKH (D… addresses,
// pubKeyHash 0x1e, scriptHash 0x16, WIF 0x9e), cross-checked against
// bitcoinjs-lib's Dogecoin params in scratch before shipping.
// Sending is intentionally NOT wired: verified live 2026-11-06, no
// keyless API offers a raw-transaction broadcast for Dogecoin
// (dogechain's pushtx is dead; BlockCypher's /txs/send builds the
// transaction server-side, which breaks Fluid's local-signing rule).
// Balances and fees are live via dogechain.com; the app shows the send
// button disabled with the reason.
const DOGE_NETWORK = { bech32: "doge", pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e };
function dogeKeys(phrase, account = 0) {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/3'/${account}'/0/0`);
  const pay = btc.p2pkh(child.publicKey, DOGE_NETWORK);
  return { child, address: pay.address, script: pay.script };
}
export function dogecoinAddress(phrase, account = 0) { return dogeKeys(phrase, account).address; }
export function isValidDogeAddress(address) {
  try {
    const raw = base58check(sha256Bytes).decode(String(address).trim());
    return raw.length === 21 && raw[0] === 0x1e;
  } catch { return false; }
}
// Dogecoin's dust limit is high (0.01 DOGE since Core 1.14.5): outputs
// below this are unspendable in practice, so it is the wallet minimum.
export const DOGE_MIN_OUTPUT = 0.01;
const DOGECHAIN_API = "https://dogechain.com/api";
export async function getDogecoinBalance(address) {
  const res = await fetch(`${DOGECHAIN_API}/v1/address/balance/${address}`);
  const d = await res.json();
  const bal = d?.balance ?? d?.data?.balance;
  if (bal == null) throw new Error("Dogecoin balance lookup failed.");
  return Number(bal);
}
/** Live fee context for display (sending is disabled — see note above). */
export async function getDogeFeeInfo() {
  try {
    const res = await fetch(`${DOGECHAIN_API}/v3/fees`);
    const d = await res.json();
    return { medianSatByte: Number(d?.data?.fee_rate_koinu_per_byte?.median) || null, medianFeeDoge: Number(d?.data?.median_fee_paid) || null };
  } catch { return { medianSatByte: null, medianFeeDoge: null }; }
}

// ---------- Bitcoin Cash (same seed, BIP44 coin type 145, CashAddr) ----------
// BCH signing is NOT plain Bitcoin signing: it uses the ForkID sighash
// (BIP143-style digest, sighash byte 0x41, forkId 0), which
// @scure/btc-signer does not implement — so the digest and transaction
// are assembled here from the spec and signed with @noble/curves.
// VALIDATED before shipping (2026-11-06, scratch cross-checks):
//  - the digest below is byte-identical to bitcore-lib-cash's
//    Transaction.Sighash output (modulo bitcore's display reversal)
//    on 1-input and 2-input scenarios;
//  - a real confirmed mainnet signature (tx 18ea60ef…, block 976217)
//    verifies over this digest with two independent ECDSA codebases
//    (tiny-secp256k1 and @noble/curves);
//  - a transaction built by this code passes bitcore-lib-cash's own
//    consensus script interpreter (SCRIPT_ENABLE_SIGHASH_FORKID).
// GOTCHA that the validation caught: @noble/curves v2 sign/verify
// PREHASH the message by default — with a sighash digest the digest
// IS the message, so every sign call must pass { prehash: false }.
const bchDsha256 = (b) => sha256(sha256(b));
const bchHash160 = (b) => ripemd160(sha256(b));
const bchB58Check = base58check(sha256);
const hexToBytesB = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const bytesToHexB = (b) => Buffer.from(b).toString("hex");

// CashAddr (BCH's bech32-like format) — encode/decode per the CashAddr
// spec (polymod checksum, 5-bit payload, version byte: type << 3 | size).
const CASHADDR_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function cashaddrPolymod(values) {
  const GENERATOR = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];
  let c = 1n;
  for (const v of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(v);
    for (let i = 0; i < 5; i++) if ((c0 >> BigInt(i)) & 1n) c ^= GENERATOR[i];
  }
  return c ^ 1n;
}
function convertBitsB(data, from, to, pad) {
  let acc = 0, bits = 0; const out = [];
  for (const v of data) {
    acc = (acc << from) | v; bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & ((1 << to) - 1)); }
  }
  if (pad) { if (bits) out.push((acc << (to - bits)) & ((1 << to) - 1)); }
  else if (bits >= from || ((acc << (to - bits)) & ((1 << to) - 1))) throw new Error("bad padding");
  return out;
}
export function cashaddrEncode(hash, type = "p2pkh", prefix = "bitcoincash") {
  const version = type === "p2pkh" ? 0 : 8; // 160-bit hash: size bits 0
  const payload = convertBitsB([version, ...hash], 8, 5, true);
  const prefixData = [...prefix].map(ch => ch.charCodeAt(0) & 0x1f);
  const mod = cashaddrPolymod([...prefixData, 0, ...payload, 0, 0, 0, 0, 0, 0, 0, 0]);
  const checksum = [];
  for (let i = 0; i < 8; i++) checksum.push(Number((mod >> BigInt(5 * (7 - i))) & 0x1fn));
  return prefix + ":" + [...payload, ...checksum].map(i => CASHADDR_CHARSET[i]).join("");
}
export function cashaddrDecode(str) {
  let s = String(str).trim().toLowerCase();
  let prefix = "bitcoincash";
  if (s.includes(":")) { const parts = s.split(":"); prefix = parts[0]; s = parts[1]; }
  if (!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(s)) throw new Error("bad cashaddr characters");
  const data = [...s].map(ch => CASHADDR_CHARSET.indexOf(ch));
  const prefixData = [...prefix].map(ch => ch.charCodeAt(0) & 0x1f);
  if (cashaddrPolymod([...prefixData, 0, ...data]) !== 0n) throw new Error("bad cashaddr checksum");
  const payload = convertBitsB(data.slice(0, -8), 5, 8, false);
  const version = payload[0];
  const type = (version >> 3) & 0x1f; // 0=p2pkh, 1=p2sh
  const expected = [20, 24, 28, 32, 40, 48, 56, 64][version & 0x07];
  const hash = Uint8Array.from(payload.slice(1));
  if (hash.length !== expected) throw new Error("bad cashaddr hash length");
  return { prefix, type: type === 0 ? "p2pkh" : type === 1 ? "p2sh" : "unknown", hash };
}
/** Any BCH address (CashAddr with/without prefix, or legacy base58) → output script bytes. */
export function bchAddressToScript(address) {
  const a = String(address).trim();
  if (/^(bitcoincash|bch):/i.test(a) || /^[qp][a-z0-9]{41}$/i.test(a)) {
    const { type, hash } = cashaddrDecode(a);
    if (type === "p2pkh") return Uint8Array.from([0x76, 0xa9, 0x14, ...hash, 0x88, 0xac]);
    if (type === "p2sh") return Uint8Array.from([0xa9, 0x14, ...hash, 0x87]);
    throw new Error("Unsupported CashAddr type.");
  }
  const bytes = bchB58Check.decode(a); // 0x00 p2pkh / 0x05 p2sh + hash160
  if (bytes.length !== 21) throw new Error("bad legacy address");
  if (bytes[0] === 0x00) return Uint8Array.from([0x76, 0xa9, 0x14, ...bytes.slice(1), 0x88, 0xac]);
  if (bytes[0] === 0x05) return Uint8Array.from([0xa9, 0x14, ...bytes.slice(1), 0x87]);
  throw new Error("bad legacy address version");
}
export function isValidBchAddress(address) {
  try { bchAddressToScript(address); return true; } catch { return false; }
}

function bchKeys(phrase, account = 0) {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/145'/${account}'/0/0`);
  const hash = bchHash160(child.publicKey);
  const script = Uint8Array.from([0x76, 0xa9, 0x14, ...hash, 0x88, 0xac]);
  return { child, hash, script, address: cashaddrEncode(hash) };
}
export function bitcoinCashAddress(phrase, account = 0) { return bchKeys(phrase, account).address; }
export function bitcoinCashLegacyAddress(phrase, account = 0) {
  return bchB58Check.encode(Uint8Array.from([0x00, ...bchKeys(phrase, account).hash]));
}

// ForkID sighash (BIP143 digest with hashType 0x41 = SIGHASH_ALL | FORKID, forkId 0)
const u32leB = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
const u64leB = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; };
const compactSizeB = (n) => {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) { const b = new Uint8Array(3); b[0] = 0xfd; new DataView(b.buffer).setUint16(1, n, true); return b; }
  const b = new Uint8Array(5); b[0] = 0xfe; new DataView(b.buffer).setUint32(1, n, true); return b;
};
const catB = (...parts) => { const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
export const BCH_SIGHASH_FORKID = 0x41;
export function bchSighashDigest(tx, inputIndex, scriptCode, amountSat) {
  const hashPrevouts = bchDsha256(catB(...tx.inputs.map(i => catB(hexToBytesB(i.txid).reverse(), u32leB(i.index)))));
  const hashSequence = bchDsha256(catB(...tx.inputs.map(i => u32leB(i.sequence ?? 0xffffffff))));
  const hashOutputs = bchDsha256(catB(...tx.outputs.map(o => catB(u64leB(o.value), compactSizeB(o.script.length), o.script))));
  const inp = tx.inputs[inputIndex];
  const preimage = catB(
    u32leB(tx.version ?? 2), hashPrevouts, hashSequence,
    hexToBytesB(inp.txid).reverse(), u32leB(inp.index),
    compactSizeB(scriptCode.length), scriptCode, u64leB(amountSat), u32leB(inp.sequence ?? 0xffffffff),
    hashOutputs, u32leB(tx.locktime ?? 0), u32leB(BCH_SIGHASH_FORKID),
  );
  return bchDsha256(preimage);
}
function derIntB(x) {
  let i = 0; while (i < x.length - 1 && x[i] === 0) i++;
  let v = x.slice(i);
  if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
  return v;
}
function derEncodeB(compact) {
  const r = derIntB(compact.slice(0, 32)), s = derIntB(compact.slice(32, 64));
  const body = Uint8Array.from([0x02, r.length, ...r, 0x02, s.length, ...s]);
  return Uint8Array.from([0x30, body.length, ...body]);
}
/** Assemble + sign a BCH transaction (all inputs spend the wallet's own P2PKH script). */
export function buildSignedBchTx({ inputs, outputs, privateKey, publicKey, ownScript }) {
  const tx = { version: 2, locktime: 0, inputs: inputs.map(i => ({ ...i, sequence: 0xffffffff })), outputs };
  const scriptSigs = tx.inputs.map((inp, idx) => {
    const digest = bchSighashDigest(tx, idx, ownScript, inp.value);
    const compact = secp256k1.sign(digest, privateKey, { lowS: true, prehash: false }); // digest IS the message
    const sigWithType = Uint8Array.from([...derEncodeB(compact), BCH_SIGHASH_FORKID]);
    return catB(compactSizeB(sigWithType.length), sigWithType, compactSizeB(publicKey.length), publicKey);
  });
  const raw = catB(
    u32leB(tx.version), compactSizeB(tx.inputs.length),
    ...tx.inputs.map((inp, i) => catB(hexToBytesB(inp.txid).reverse(), u32leB(inp.index), compactSizeB(scriptSigs[i].length), scriptSigs[i], u32leB(0xffffffff))),
    compactSizeB(outputs.length),
    ...outputs.map(o => catB(u64leB(o.value), compactSizeB(o.script.length), o.script)),
    u32leB(0),
  );
  return { hex: bytesToHexB(raw), txid: bytesToHexB(bchDsha256(raw).reverse()) };
}

const HASKOIN_BCH = "https://api.haskoin.com/bch"; // keyless, verified live 2026-11-06
export async function getBitcoinCashBalance(address) {
  const res = await fetch(`${HASKOIN_BCH}/address/${address}/balance`);
  const d = await res.json();
  if (d?.confirmed == null) throw new Error("Bitcoin Cash balance lookup failed.");
  return (Number(d.confirmed) + Number(d.unconfirmed || 0)) / 1e8;
}
export const BCH_DUST = 546;
export function formatBitcoinCashSendIntent({ amount, to, feeBch }) {
  return `Send ${amount} BCH to ${to} on Bitcoin Cash. Network fee about ${feeBch} BCH. Confirm?`;
}
/** Build, sign and broadcast a BCH payment (1 sat/byte fee). Returns the txid. */
export async function sendBitcoinCash(phrase, { to, amountBch }) {
  const { child, address, script } = bchKeys(phrase);
  const destScript = bchAddressToScript(to); // throws on a bad address
  const target = Math.round(amountBch * 1e8);
  if (target < BCH_DUST) throw new Error(`Amount is below the Bitcoin Cash dust limit (${BCH_DUST} satoshis).`);
  const res = await fetch(`${HASKOIN_BCH}/address/${address}/unspent`);
  const utxos = (await res.json()).filter(u => u.value > 0)
    .map(u => ({ txid: u.txid, index: u.index, value: u.value }))
    .sort((a, b) => b.value - a.value);
  const picked = []; let sum = 0;
  for (const u of utxos) {
    picked.push(u); sum += u.value;
    const fee = 10 + picked.length * 148 + 2 * 34; // 1 sat/byte, P2PKH sizing
    if (sum >= target + fee) break;
  }
  const fee = 10 + picked.length * 148 + 2 * 34;
  if (sum < target + fee) throw new Error("Not enough confirmed BCH to cover the amount plus network fee.");
  const change = sum - target - fee;
  const outputs = [{ value: target, script: destScript }];
  if (change >= BCH_DUST) outputs.push({ value: change, script });
  const { hex, txid } = buildSignedBchTx({
    inputs: picked, outputs, privateKey: child.privateKey, publicKey: child.publicKey, ownScript: script,
  });
  const post = await fetch(`${HASKOIN_BCH}/transactions`, {
    method: "POST", headers: { "Content-Type": "text/plain" }, body: hex,
  });
  if (!post.ok) throw new Error("Bitcoin Cash network rejected the transaction: " + (await post.text()));
  const d = await post.json().catch(() => null);
  return d?.txid || txid;
}

// ---------- Tron (same secp256k1 key as the EVM account) ----------
// Tron is NOT an EVM chain, but it reuses the wallet's secp256k1 key
// directly: the Tron address is the EVM account's public key run through
// keccak-256, taking the last 20 bytes (the same bytes as the EVM
// address), prefixed with 0x41 and Base58Check-encoded. No new seed, no
// new key — the user's existing backup covers Tron. Transactions are
// built by TronGrid but signed locally; the key never leaves the device.
const TRONGRID = "https://api.trongrid.io";
export const TRON_EXPLORER = "https://tronscan.org";
export const TRON_TOKENS = [
  { symbol: "USDT", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
  { symbol: "USDC", address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },
];
const sha256Bytes = (b) => ethers.getBytes(ethers.sha256(b));
const tronB58Check = base58check(sha256Bytes); // checksum = sha256(sha256(x))[:4], applied inside

function tronPrivateKeyHex(input) {
  if (typeof input === "string" && /^0x[0-9a-fA-F]{64}$/.test(input.trim())) return input.trim();
  if (input && typeof input.privateKey === "string") return input.privateKey;
  if (input instanceof Uint8Array && input.length === 32) return ethers.hexlify(input);
  throw new Error("Tron needs the wallet's private key (hex or a signer).");
}
/** Derive the Tron address (base58 "T…") for a private key given as hex,
 *  bytes, or any ethers signer carrying .privateKey (the unlocked Fluid
 *  wallet qualifies — Tron uses the very same key as the EVM account). */
export function tronAddressFromKey(input) {
  const key = tronPrivateKeyHex(input);
  const uncompressed = ethers.SigningKey.computePublicKey(key, false); // 0x04 || X || Y
  const pub = ethers.getBytes(uncompressed).slice(1);                   // 64 bytes, no prefix
  const body = ethers.getBytes(ethers.keccak256(pub)).slice(-20);       // == the EVM address bytes
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  payload.set(body, 1);
  return tronB58Check.encode(payload);
}
/** The Tron address of the wallet's main account — same derivation the
 *  app uses for the EVM account (ethers' default BIP44 path). */
export function tronAddressFromPhrase(phrase) {
  return tronAddressFromKey(ethers.Wallet.fromPhrase(phrase.trim().toLowerCase().replace(/\s+/g, " ")).privateKey);
}
/** base58 T-address → 42-char hex form ("41…") TronGrid uses internally. */
export function tronAddressToHex(address) {
  const bytes = tronB58Check.decode(String(address || "").trim());
  return ethers.hexlify(bytes).slice(2);
}
/** 42-char hex form ("41…") → base58 T-address. */
export function tronAddressFromHex(hexAddr) {
  const clean = String(hexAddr || "").trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{42}$/.test(clean)) throw new Error("That is not a Tron hex address.");
  return tronB58Check.encode(ethers.getBytes("0x" + clean));
}
/** A valid Tron address: Base58Check-decodable, 21 bytes, 0x41 prefix. */
export function isValidTronAddress(address) {
  try {
    const bytes = tronB58Check.decode(String(address || "").trim());
    return bytes.length === 21 && bytes[0] === 0x41;
  } catch { return false; }
}
export function tronSunToTrx(sun) { return ethers.formatUnits(BigInt(sun), 6); }
export function tronTrxToSun(amount) { return ethers.parseUnits(String(amount), 6); }

async function tronPost(path, body) {
  const res = await fetch(TRONGRID + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Tron network error (HTTP " + res.status + ").");
  return data;
}
function tronErrorText(m) {
  if (typeof m !== "string" || !m) return "unknown error";
  if (/^[0-9a-fA-F]+$/.test(m) && m.length % 2 === 0) {
    try { return new TextDecoder().decode(ethers.getBytes("0x" + m)); } catch { /* keep raw */ }
  }
  return m;
}
/** TRC-20 balanceOf via a constant (free, unsigned) contract call.
 *  Returns a BigInt in the token's smallest unit. */
async function tronTrc20Balance(ownerAddress, token) {
  const ownerHex = tronAddressToHex(ownerAddress);
  const parameter = ownerHex.slice(2).padStart(64, "0"); // ABI address: 12 zero bytes + 20 address bytes
  const data = await tronPost("/wallet/triggerconstantcontract", {
    owner_address: ownerHex, contract_address: tronAddressToHex(token.address),
    function_selector: "balanceOf(address)", parameter,
  });
  const out = data && data.constant_result && data.constant_result[0];
  if (!out) throw new Error("Empty Tron balance reply.");
  return BigInt("0x" + out);
}
/** Tron balances shaped like getBalances(): native TRX first (address
 *  null), then the TRC-20 tokens. A failed token read degrades to the
 *  native balance only — it never fails the whole lookup. */
export async function getTronBalances(address) {
  if (!isValidTronAddress(address)) throw new Error("That is not a valid Tron address.");
  const out = [{ symbol: "TRX", amount: "0", address: null, decimals: 6 }];
  const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Tron balance lookup failed (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  const acct = data && Array.isArray(data.data) ? data.data[0] : null;
  out[0].amount = tronSunToTrx((acct && acct.balance) ?? 0); // no account on-chain yet = 0
  for (const t of TRON_TOKENS) {
    const row = { symbol: t.symbol, amount: "0", address: t.address, decimals: t.decimals };
    try {
      const raw = await tronTrc20Balance(address, t);
      row.amount = ethers.formatUnits(raw, t.decimals);
    } catch { /* token read failed — the row stays at 0, the native balance stands */ }
    out.push(row);
  }
  return out;
}
/** The signer principle, Tron edition: a sentence, never a blob. */
export function formatTronSendIntent({ amount, symbol, to }) {
  return `Send ${amount} ${symbol} to ${to} on Tron. Confirm?`;
}
function signTronTxId(wallet, txID) {
  // A Tron transaction's id IS sha256(raw_data); signing that digest with
  // the account key yields the 65-byte r‖s‖v signature Tron expects
  // (v = the bare recovery id, 0/1 — not Ethereum's 27/28).
  const sk = new ethers.SigningKey(tronPrivateKeyHex(wallet));
  const sig = sk.sign(ethers.getBytes("0x" + String(txID).replace(/^0x/, "")));
  return sig.r.slice(2) + sig.s.slice(2) + sig.recoveryParam.toString(16).padStart(2, "0");
}
/** Build (via TronGrid), sign (locally) and broadcast a TRX transfer or
 *  a TRC-20 token transfer. `token` is null for native TRX, otherwise a
 *  TRON_TOKENS-style {address, decimals}. Returns {hash, txid}. */
export async function sendTron(wallet, { to, amount, token = null }) {
  if (!isValidTronAddress(to)) throw new Error("That is not a valid Tron address.");
  const owner = tronAddressFromKey(wallet);
  const ownerHex = tronAddressToHex(owner);
  let tx;
  if (!token) {
    const sun = tronTrxToSun(amount);
    if (sun <= 0n) throw new Error("Enter an amount.");
    const data = await tronPost("/wallet/createtransaction", {
      owner_address: ownerHex, to_address: tronAddressToHex(to), amount: Number(sun),
    });
    if (!data || data.Error) throw new Error("Tron rejected the transfer: " + tronErrorText(data && data.Error));
    tx = data;
  } else {
    if (!isValidTronAddress(token.address)) throw new Error("Unknown Tron token contract.");
    const raw = ethers.parseUnits(String(amount), token.decimals ?? 6);
    if (raw <= 0n) throw new Error("Enter an amount.");
    const parameter = tronAddressToHex(to).slice(2).padStart(64, "0") + raw.toString(16).padStart(64, "0");
    const data = await tronPost("/wallet/triggersmartcontract", {
      owner_address: ownerHex, contract_address: tronAddressToHex(token.address),
      function_selector: "transfer(address,uint256)", parameter,
      fee_limit: 100_000_000, call_value: 0,
    });
    if (!data || !data.result || data.result.result !== true) {
      throw new Error("Tron rejected the token transfer: " + tronErrorText(data && data.result && data.result.message));
    }
    tx = data.transaction;
  }
  if (!tx || !tx.txID || !tx.raw_data) throw new Error("Tron did not return a transaction to sign.");
  const cast = await tronPost("/wallet/broadcasttransaction", {
    txID: tx.txID, raw_data: tx.raw_data, raw_data_hex: tx.raw_data_hex,
    signature: [signTronTxId(wallet, tx.txID)],
  });
  if (!cast || cast.result !== true) {
    throw new Error("Tron network rejected the transaction: " + tronErrorText(cast && (cast.message || cast.code)));
  }
  return { hash: tx.txID, txid: tx.txID };
}

// ---------- Solana (SLIP-0010 Ed25519 branch of the same BIP39 seed) ----------
// Solana keys are Ed25519 — they cannot come from the secp256k1 BIP32
// tree the EVM and Bitcoin accounts use. The standard derivation is
// SLIP-0010: HMAC-SHA512, hardened-only, from the raw BIP39 seed, at the
// Phantom/Solflare path m/44'/501'/0'/0'. The derived 32 bytes are the
// Ed25519 seed; the public key IS the address, Base58-encoded. Same seed
// phrase, same backup — a different curve branch of it. The derivation
// below is pinned to the official SLIP-0010 test vectors (see tests) and
// was cross-checked against the independent ed25519-hd-key reference
// implementation, @solana/web3.js and OpenSSL — all four agree.
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const SOLANA_EXPLORER = "https://solscan.io";
export const SOLANA_TOKENS = [
  { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
];
const SOLANA_PROGRAMS = {
  token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ata: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
};
export const SOLANA_TOKEN_PROGRAM = SOLANA_PROGRAMS.token;
export const SOLANA_TOKEN2022_PROGRAM = SOLANA_PROGRAMS.token2022;
// Rent-exempt minimums (lamports): a 0-byte account must hold 890,880 or
// exactly 0 — anything in between is not a valid account state; a token
// account (165 bytes) costs 2,039,280, paid by whoever creates it.
export const SOLANA_RENT_EXEMPT_LAMPORTS = 890880;
export const SOLANA_ATA_RENT_LAMPORTS = 2039280;
const SOLANA_BASE_FEE_LAMPORTS = 5000n; // per signature

/** SLIP-0010 master + hardened child derivation for Ed25519. `indices`
 *  are the plain path indices (44, 501, …); every step is hardened here,
 *  the only mode SLIP-0010 defines for this curve. Returns the derived
 *  {key, chainCode} (32 bytes each). */
export function deriveSlip10Ed25519(seed, indices = []) {
  let I = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  let key = I.slice(0, 32), chainCode = I.slice(32);
  for (const idx of indices) {
    const data = new Uint8Array(1 + 32 + 4);
    data.set(key, 1); // data = 0x00 || key || ser32(hardened index)
    new DataView(data.buffer).setUint32(33, (idx | 0x80000000) >>> 0, false);
    I = hmac(sha512, chainCode, data);
    key = I.slice(0, 32); chainCode = I.slice(32);
  }
  return { key, chainCode };
}
/** The wallet's Solana private seed: BIP39 seed → m/44'/501'/0'/0'. */
export function solanaSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 501, 0, 0]).key;
}
function solanaKeypair(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return SolKeypair.fromSeed(solanaSeedFromSeed(mnemonicToSeedSync(clean)));
}
/** Solana address (Base58 public key) for a raw BIP39 seed. */
export function solanaAddressFromSeed(seed) {
  return base58.encode(ed25519.getPublicKey(solanaSeedFromSeed(seed)));
}
/** The Solana address of the wallet's main account (Phantom path). */
export function solanaAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return solanaAddressFromSeed(mnemonicToSeedSync(clean));
}
/** A valid Solana address: Base58 that decodes to exactly 32 bytes. */
export function isValidSolanaAddress(address) {
  try {
    return base58.decode(String(address || "").trim()).length === 32;
  } catch { return false; }
}
export function solLamportsToSol(lamports) { return ethers.formatUnits(BigInt(lamports), 9); }
export function solSolToLamports(amount) { return ethers.parseUnits(String(amount), 9); }

async function solanaRpc(method, params) {
  const res = await fetch(SOLANA_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("Solana network error (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("Solana returned an unreadable reply.");
  if (data.error) throw new Error("Solana rejected the request: " + (data.error.message || "unknown error"));
  return data.result;
}
/** Solana balances shaped like getBalances(): native SOL first (address
 *  null), then the SPL tokens. A failed token read degrades to that
 *  token's zero — it never fails the whole lookup. */
export async function getSolanaBalances(address) {
  if (!isValidSolanaAddress(address)) throw new Error("That is not a valid Solana address.");
  const out = [{ symbol: "SOL", amount: "0", address: null, decimals: 9 }];
  const bal = await solanaRpc("getBalance", [address]);
  out[0].amount = solLamportsToSol((bal && bal.value) ?? 0); // no account on-chain yet = 0
  for (const t of SOLANA_TOKENS) {
    const row = { symbol: t.symbol, amount: "0", address: t.address, decimals: t.decimals };
    try {
      const r = await solanaRpc("getTokenAccountsByOwner", [address, { mint: t.address }, { encoding: "jsonParsed" }]);
      let sum = 0n;
      for (const acc of (r && r.value) || []) {
        const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.amount;
        if (amt != null) sum += BigInt(amt);
      }
      row.amount = ethers.formatUnits(sum, t.decimals);
    } catch { /* token read failed — the row stays at 0, the native balance stands */ }
    out.push(row);
  }
  return out;
}
/** The associated token account (ATA) address for an owner + mint: a
 *  program-derived address, computed locally — no RPC needed. The
 *  token program is a seed, so Token-2022 mints (programId =
 *  SOLANA_TOKEN2022_PROGRAM) derive a DIFFERENT ATA than legacy SPL
 *  mints — callers pass the mint's program when it isn't the legacy
 *  one (token rows from getSolanaAllTokens carry it as `program`). */
export function solanaAtaAddress(ownerAddress, mintAddress, programId = SOLANA_PROGRAMS.token) {
  const [pda] = SolPublicKey.findProgramAddressSync(
    [new SolPublicKey(ownerAddress).toBuffer(),
     new SolPublicKey(programId).toBuffer(),
     new SolPublicKey(mintAddress).toBuffer()],
    new SolPublicKey(SOLANA_PROGRAMS.ata));
  return pda.toBase58();
}
async function solanaAccountExists(address) {
  const r = await solanaRpc("getAccountInfo", [address, { encoding: "base64" }]);
  return !!(r && r.value);
}
/** Would sending this token to `to` need a new token account created
 *  (sender-paid rent)? Drives both the pre-confirm plan and the send. */
export async function solanaSendPlan(fromAddress, { to, token = null } = {}) {
  if (!token) return { createsAta: false, ataRentLamports: 0 };
  const exists = await solanaAccountExists(solanaAtaAddress(to, token.address, token.program || SOLANA_PROGRAMS.token));
  return { createsAta: !exists, ataRentLamports: exists ? 0 : SOLANA_ATA_RENT_LAMPORTS };
}
/** The signer principle, Solana edition: a sentence, never a blob. */
export function formatSolanaSendIntent({ amount, symbol, to, createsAta = false }) {
  return `Send ${amount} ${symbol} to ${to} on Solana.` +
    (createsAta ? ` This also creates the recipient's ${symbol} account — you pay about ${solLamportsToSol(SOLANA_ATA_RENT_LAMPORTS)} SOL rent for it (it comes back if they ever close the account).` : "") +
    " Confirm?";
}
function solanaCreateAtaInstruction(payer, ataAddress, ownerAddress, mintAddress, tokenProgramId = SOLANA_PROGRAMS.token) {
  // createIdempotent (data [1]): succeeds whether or not the account
  // appeared since the plan was checked — no race can strand the send.
  return new SolTxInstruction({
    programId: new SolPublicKey(SOLANA_PROGRAMS.ata),
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: new SolPublicKey(ataAddress), isSigner: false, isWritable: true },
      { pubkey: new SolPublicKey(ownerAddress), isSigner: false, isWritable: false },
      { pubkey: new SolPublicKey(mintAddress), isSigner: false, isWritable: false },
      { pubkey: SolSystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new SolPublicKey(tokenProgramId), isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}
function solanaSplTransferCheckedInstruction(sourceAta, mintAddress, destAta, owner, rawAmount, decimals, tokenProgramId) {
  // TransferChecked (data [12, amount u64 LE, decimals u8]): the
  // Token-2022-safe form — it names the mint explicitly, so the
  // program itself verifies the accounts belong to it.
  const data = Buffer.alloc(10);
  data[0] = 12;
  data.writeBigUInt64LE(BigInt(rawAmount), 1);
  data[9] = decimals & 0xff;
  return new SolTxInstruction({
    programId: new SolPublicKey(tokenProgramId),
    keys: [
      { pubkey: sourceAta, isSigner: false, isWritable: true },
      { pubkey: new SolPublicKey(mintAddress), isSigner: false, isWritable: false },
      { pubkey: destAta, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}
function solanaSplTransferInstruction(sourceAta, destAta, owner, rawAmount) {
  const data = Buffer.alloc(9);
  data[0] = 3; // SPL Token "Transfer"
  data.writeBigUInt64LE(BigInt(rawAmount), 1);
  return new SolTxInstruction({
    programId: new SolPublicKey(SOLANA_PROGRAMS.token),
    keys: [
      { pubkey: sourceAta, isSigner: false, isWritable: true },
      { pubkey: destAta, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}
async function solanaBroadcast(serializedBytes, what) {
  try {
    // The JSON-RPC method is "sendTransaction" (sendRawTransaction is
    // only the web3.js client-side name for it).
    return await solanaRpc("sendTransaction", [base64.encode(serializedBytes), { encoding: "base64", skipPreflight: false, preflightCommitment: "processed" }]);
  } catch (e) {
    if (/blockhash/i.test(e.message)) throw new Error(`${what} expired before it could be sent (stale blockhash) — please try again so a fresh one is fetched.`);
    throw e;
  }
}
/** Build, sign (locally) and broadcast a SOL transfer or an SPL token
 *  transfer. `token` is null for native SOL, otherwise a SOLANA_TOKENS
 *  {address, decimals}. Returns {hash, createsAta}. */
export async function sendSolana(phrase, { to, amount, token = null }) {
  if (!isValidSolanaAddress(to)) throw new Error("That is not a valid Solana address.");
  const kp = solanaKeypair(phrase);
  const from = kp.publicKey;
  const fromAddr = from.toBase58();
  const balance = BigInt((await solanaRpc("getBalance", [fromAddr]))?.value ?? 0);
  const { blockhash } = (await solanaRpc("getLatestBlockhash", [])).value;
  const tx = new SolTransaction({ feePayer: from, recentBlockhash: blockhash });
  let createsAta = false;
  if (!token) {
    const lamports = solSolToLamports(amount);
    if (lamports <= 0n) throw new Error("Enter an amount.");
    const remaining = balance - lamports - SOLANA_BASE_FEE_LAMPORTS;
    if (remaining < 0n) throw new Error("Not enough SOL to cover the amount plus the network fee.");
    if (remaining > 0n && remaining < BigInt(SOLANA_RENT_EXEMPT_LAMPORTS)) {
      throw new Error(`That would leave ${solLamportsToSol(remaining)} SOL behind — below Solana's rent-exempt minimum of ${solLamportsToSol(SOLANA_RENT_EXEMPT_LAMPORTS)} SOL, so the network would reject it. Send a little less, or everything but the fee.`);
    }
    tx.add(SolSystemProgram.transfer({ fromPubkey: from, toPubkey: new SolPublicKey(to), lamports }));
  } else {
    const raw = ethers.parseUnits(String(amount), token.decimals ?? 6);
    if (raw <= 0n) throw new Error("Enter an amount.");
    // Token-2022 mints live under a different program: their ATAs are
    // derived with that program as a seed and their transfers are
    // TransferChecked instructions addressed to it. Legacy SPL keeps
    // the original code path untouched.
    const program = token.program || SOLANA_PROGRAMS.token;
    const is2022 = program === SOLANA_PROGRAMS.token2022;
    const fromAta = solanaAtaAddress(fromAddr, token.address, program);
    let held = 0n;
    try {
      const tb = await solanaRpc("getTokenAccountBalance", [fromAta]);
      held = BigInt(tb?.value?.amount ?? 0);
    } catch { held = 0n; } // no token account yet = holds none
    if (held < raw) throw new Error(`Not enough ${token.symbol} on Solana (you have ${ethers.formatUnits(held, token.decimals ?? 6)}).`);
    const plan = await solanaSendPlan(fromAddr, { to, token });
    createsAta = plan.createsAta;
    const solNeeded = SOLANA_BASE_FEE_LAMPORTS + BigInt(plan.ataRentLamports);
    if (balance < solNeeded) {
      throw new Error(createsAta
        ? `Not enough SOL for the fee plus the recipient's token-account rent (about ${solLamportsToSol(solNeeded)} SOL needed).`
        : "Not enough SOL to pay the network fee for this token send.");
    }
    const toAta = solanaAtaAddress(to, token.address, program);
    if (createsAta) tx.add(solanaCreateAtaInstruction(from, toAta, to, token.address, program));
    tx.add(is2022
      ? solanaSplTransferCheckedInstruction(new SolPublicKey(fromAta), token.address, new SolPublicKey(toAta), from, raw, token.decimals ?? 6, program)
      : solanaSplTransferInstruction(new SolPublicKey(fromAta), new SolPublicKey(toAta), from, raw));
  }
  tx.sign(kp);
  const signature = await solanaBroadcast(tx.serialize(), "That send");
  return { hash: signature, createsAta };
}

// ---------- Sui (SLIP-0010 Ed25519 branch, coin type 784) ----------
// Sui keys are Ed25519, like Solana's — so Sui reuses the SAME SLIP-0010
// derivation as the Solana branch (deriveSlip10Ed25519), at Sui's own
// path m/44'/784'/0'/0'/0' (the @mysten/sui default). The address is not
// the public key itself (as on Solana) but
//   "0x" || hex(BLAKE2b-256(0x00 || pubkey))
// where 0x00 is Sui's Ed25519 signature-scheme flag. Cross-checked
// against @mysten/sui's own Ed25519Keypair.deriveKeypair on two
// mnemonics — all derivations agree (see tests). Same seed phrase, same
// backup — a third curve branch of it. Strategic double-duty: Sui is
// also the future home of the OGO ERA Companion NFT (a Sui object), so
// this account is the one the game will read.
// No JSON-RPC URL here any more: Mysten retired JSON-RPC on the public
// fullnodes (every method now answers "Method not found… Please migrate
// to gRPC or GraphQL" — verified live 2026-11-06). ALL Sui traffic —
// reads AND transaction execution — rides the public GraphQL endpoint
// (SUI_GRAPHQL, defined in the universal-token section below) through
// the @mysten/sui GraphQL client.
export const SUI_EXPLORER = "https://suiscan.xyz";
export const SUI_COIN_TYPE = "0x2::sui::SUI";
export const SUI_TOKENS = [
  // Circle's native USDC on Sui — verified live 2026-11-06 against the
  // fullnode's coin metadata (name "USDC", 6 decimals, ~$335M supply)
  // and LI.FI's Sui token list.
  { symbol: "USDC", address: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC", decimals: 6 },
  // USDT on Sui — verified live 2026-11-06, and the obvious candidate
  // was WRONG: 0x5d4b3025…::coin::COIN, often listed as "USDT", has
  // on-chain metadata name "USD Coin" / symbol USDC (it is the Wormhole
  // USDC). The coin below is the one whose metadata reads name
  // "Tether" / symbol USDT (module literally `usdt`), is LI.FI's
  // first-listed Sui USDT, and carries a live ~6.78M supply. The legacy
  // Wormhole-bridged USDT is 0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN
  // (metadata "Tether USD") — not wired as a row.
  { symbol: "USDT", address: "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT", decimals: 6 },
];
// Gas reserve kept back on native sends (MIST): a simple Sui transfer
// costs roughly 0.001 SUI all-in; 0.002 leaves headroom without ever
// letting a send strand the fee.
const SUI_GAS_RESERVE_MIST = 2000000n;

/** The wallet's Sui private seed: BIP39 seed → m/44'/784'/0'/0'/0'. */
export function suiSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 784, 0, 0, 0]).key;
}
function suiKeypair(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return SuiEd25519Keypair.fromSecretKey(suiSeedFromSeed(mnemonicToSeedSync(clean)));
}
/** Sui address (0x + 64 hex) for a raw BIP39 seed. */
export function suiAddressFromSeed(seed) {
  const pub = ed25519.getPublicKey(suiSeedFromSeed(seed));
  const digest = blake2b(Uint8Array.from([0, ...pub]), { dkLen: 32 });
  return "0x" + hex.encode(digest);
}
/** The Sui address of the wallet's main account. */
export function suiAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return suiAddressFromSeed(mnemonicToSeedSync(clean));
}
/** Canonical Sui address form: 0x + 64 lowercase hex (left-padded with
 *  zeros — Sui itself accepts and displays short forms like "0x2"). */
export function normalizeSuiAddress(address) {
  const s = String(address || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(s)) return null;
  return "0x" + s.slice(2).padStart(64, "0");
}
/** A valid Sui address: 0x-prefixed hex of at most 32 bytes. */
export function isValidSuiAddress(address) {
  return normalizeSuiAddress(address) !== null;
}
export function suiMistToSui(mist) { return ethers.formatUnits(BigInt(mist), 9); }
export function suiSuiToMist(amount) { return ethers.parseUnits(String(amount), 9); }

// (The raw JSON-RPC reader that used to live here is gone on purpose:
// Mysten deprecated JSON-RPC on the public fullnodes — see the note on
// getSuiBalances. Sui reads use the GraphQL endpoint in the universal
// token section at the bottom of this file, and sendSui executes over
// the same GraphQL transport via the SDK client below — migrated
// 2026-11-06 after the JSON-RPC execution method was verified dead
// and the GraphQL execute mutation was verified live: a locally
// signed transaction from the unfunded test account was accepted by
// the transport and rejected at input-object/signature validation,
// and gas selection fails an unfunded send at the balance stage —
// chain-stage answers, never transport errors.)
/** Sui balances shaped like getBalances(): native SUI first (address
 *  null), then the stablecoins. This is now a view over
 *  getSuiAllBalances (universal token support, bottom of this file):
 *  Mysten deprecated JSON-RPC on the public fullnodes — the suix_*
 *  reads this function originally used now return "Method not
 *  found" (verified live 2026-11-06) — so all Sui READS ride the
 *  public GraphQL endpoint instead. Same shape, same degradation:
 *  the full read either answers or throws, and callers fall back to
 *  placeholder rows rather than fake zeros. */
export async function getSuiBalances(address) {
  if (!isValidSuiAddress(address)) throw new Error("That is not a valid Sui address.");
  const all = await getSuiAllBalances(address);
  const pick = (addr) => all.find(r => (r.address || null) === addr) || null;
  const native = pick(null);
  const out = [{ symbol: "SUI", amount: native ? native.amount : "0", address: null, decimals: 9 }];
  for (const t of SUI_TOKENS) {
    const hit = pick(t.address);
    out.push({ symbol: t.symbol, amount: hit ? hit.amount : "0", address: t.address, decimals: t.decimals });
  }
  return out;
}
/** The signer principle, Sui edition: a sentence, never a blob. */
export function formatSuiSendIntent({ amount, symbol, to }) {
  return `Send ${amount} ${symbol} to ${to} on Sui. Confirm?`;
}

let _suiClient = null;
function suiClient() {
  if (!_suiClient) _suiClient = new SuiGraphQLClient({ url: SUI_GRAPHQL, network: "mainnet" });
  return _suiClient;
}
/** Every coin object of one type the address holds, via the GraphQL
 *  client's core API (paginated, capped at 10 pages) — the coin
 *  selection source for token sends, replacing the retired JSON-RPC
 *  getCoins. Rows are the core Coin shape: { objectId, balance, … }. */
async function suiListAllCoins(client, owner, coinType) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    const res = await client.core.listCoins({ owner, coinType, cursor });
    out.push(...(res.objects || []));
    if (!res.hasNextPage || !res.cursor) break;
    cursor = res.cursor;
  }
  return out;
}
/** Build, sign (locally, Sui intent signing via the SDK keypair) and
 *  execute a SUI transfer or a coin transfer over the GraphQL
 *  transport (the SDK client's core signAndExecuteTransaction: it
 *  builds against the GraphQL resolver, the keypair signs locally,
 *  and the executeTransaction mutation broadcasts). `token` is null
 *  for native SUI, otherwise a SUI_TOKENS {address, decimals}.
 *  Returns {hash} — the transaction digest. */
export async function sendSui(phrase, { to, amount, token = null }) {
  if (!isValidSuiAddress(to)) throw new Error("That is not a valid Sui address.");
  const recipient = normalizeSuiAddress(to);
  const kp = suiKeypair(phrase);
  const from = kp.getPublicKey().toSuiAddress();
  const client = suiClient();
  const tx = new SuiTransaction();
  tx.setSender(from);
  if (!token) {
    const mist = suiSuiToMist(amount);
    if (mist <= 0n) throw new Error("Enter an amount.");
    const { balance } = await client.core.getBalance({ owner: from, coinType: SUI_COIN_TYPE });
    if (mist + SUI_GAS_RESERVE_MIST > BigInt(balance.balance)) {
      throw new Error("Not enough SUI to cover the amount plus the network fee.");
    }
    // Native sends split straight off the gas coin — the canonical
    // Sui wallet pattern; the remainder stays as gas/change.
    const [coin] = tx.splitCoins(tx.gas, [mist]);
    tx.transferObjects([coin], recipient);
  } else {
    const raw = ethers.parseUnits(String(amount), token.decimals ?? 6);
    if (raw <= 0n) throw new Error("Enter an amount.");
    const coins = await suiListAllCoins(client, from, token.address);
    const sorted = [...coins].sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : BigInt(b.balance) < BigInt(a.balance) ? -1 : 0));
    const picked = []; let sum = 0n;
    for (const c of sorted) { picked.push(c); sum += BigInt(c.balance); if (sum >= raw) break; }
    if (sum < raw) throw new Error(`Not enough ${token.symbol} on Sui (you have ${ethers.formatUnits(sum, token.decimals ?? 6)}).`);
    // Merge fragments into the largest coin, then split the exact
    // amount off it — the sender keeps the change automatically.
    if (picked.length > 1) tx.mergeCoins(picked[0].objectId, picked.slice(1).map(c => c.objectId));
    const [coin] = tx.splitCoins(picked[0].objectId, [raw]);
    tx.transferObjects([coin], recipient);
  }
  const res = await client.core.signAndExecuteTransaction({ signer: kp, transaction: tx, include: { effects: true } });
  const txn = res.$kind === "FailedTransaction" ? res.FailedTransaction : res.Transaction;
  if (!txn) throw new Error("Sui returned an unreadable execution reply.");
  if (res.$kind === "FailedTransaction" || (txn.status && txn.status.success === false)) {
    const errMsg = (txn.status && txn.status.error && txn.status.error.message) || "execution failed";
    throw new Error("Sui rejected the transaction: " + errMsg);
  }
  return { hash: txn.digest };
}

// ---------- Cosmos (one secp256k1 account, seven chains) ----------
// The Cosmos family is the inverse of the EVM universe: instead of many
// chains sharing one ADDRESS, seven Cosmos SDK chains share one ACCOUNT
// — the same hash160 account bytes from the same BIP44 branch
// (coin type 118, m/44'/118'/0'/0/0) — and differ only in the bech32
// prefix printed in front of them (cosmos1…, osmo1…, noble1…). One seed
// phrase, one backup, seven chains. Derivation is Fluid's own (@scure,
// the same stack as the Bitcoin branch) and was cross-checked against
// @cosmjs DirectSecp256k1HdWallet for two prefixes before shipping
// (see tests); sends hand that very key to CosmJS as a
// DirectSecp256k1Wallet, so the signer is built FROM Fluid's derived
// key, never from a second derivation.
// ONE EXCEPTION (Ethuram's decision, 2026-11-06): Injective derives at
// coin type 60 (m/44'/60'/0'/0/0) — the path Keplr and Leap use for
// Injective — instead of the family's 118, so the same seed shows the
// SAME inj1 address in Fluid, Keplr and Leap (Fluid's "if Fluid dies,
// users keep their funds" promise: a seed imported elsewhere must find
// every account where the user expects it). Injective's account bytes
// therefore differ from the other six chains'; the other six still
// share one account at 118. The switch was made while Injective was
// receive-only with no user balances, so no funds were stranded.
// Denoms, chain ids, prefixes and average gas prices were verified
// 2026-11-06 against the chain registry (github.com/cosmos/chain-registry)
// and live endpoint reads; INJ and DYDX use 18-decimal base denoms
// (inj, adydx), the rest 6. Endpoints: cosmos.directory public REST for
// balance reads (all seven verified live), cosmos.directory RPC for
// signing clients — except Sei, whose directory RPC was down (HTTP 502)
// at build time, so Sei sends ride the Sei team's own rpc.sei-apis.com
// (verified live, POST included).
// Injective is the family's DOGE: receive + live balance work, sending
// is disabled with the reason shown. Injective accounts are
// /injective.types.v1beta1.EthAccount and expect signatures over the
// /injective.crypto.v1beta1.ethsecp256k1.PubKey type (both verified
// live against a validator account) — the stock CosmJS signer emits
// the Cosmos pubkey type, which Injective's ante handler does not
// accept, so a working Injective signer is a separate build, not a
// config flag.
// Swaps: LI.FI carries NO Cosmos-SDK chains (its chainTypes are
// EVM/SVM/TVM/MVM/UTXO only — checked live), and Skip Go, while it
// answers keyless and returns real routes, packs the actual swap into
// an opaque wasm memo inside an IBC transfer — a blob, not a sentence
// a user can approve — so Cosmos-source swap execution is NOT wired;
// the chain sheets say so plainly.
export const COSMOS_CHAINS = [
  { key: "cosmoshub", name: "Cosmos Hub", chainId: "cosmoshub-4", prefix: "cosmos", denom: "uatom", symbol: "ATOM", decimals: 6, gasPrice: "0.025uatom",
    rest: "https://rest.cosmos.directory/cosmoshub", rpc: "https://rpc.cosmos.directory/cosmoshub", explorer: "https://www.mintscan.io/cosmos" },
  { key: "osmosis", name: "Osmosis", chainId: "osmosis-1", prefix: "osmo", denom: "uosmo", symbol: "OSMO", decimals: 6, gasPrice: "0.1uosmo",
    rest: "https://rest.cosmos.directory/osmosis", rpc: "https://rpc.cosmos.directory/osmosis", explorer: "https://www.mintscan.io/osmosis" },
  // Noble is the Cosmos home of native USDC: its fee token IS uusdc
  // (chain registry fee_tokens, verified live), so the family's asset
  // on Noble is USDC itself and fees are paid in it too.
  { key: "noble", name: "Noble", chainId: "noble-1", prefix: "noble", denom: "uusdc", symbol: "USDC", decimals: 6, gasPrice: "0.1uusdc",
    rest: "https://rest.cosmos.directory/noble", rpc: "https://rpc.cosmos.directory/noble", explorer: "https://www.mintscan.io/noble" },
  { key: "celestia", name: "Celestia", chainId: "celestia", prefix: "celestia", denom: "utia", symbol: "TIA", decimals: 6, gasPrice: "0.02utia",
    rest: "https://rest.cosmos.directory/celestia", rpc: "https://rpc.cosmos.directory/celestia", explorer: "https://www.mintscan.io/celestia" },
  // coinType 60: the Keplr/Leap Injective path (see the family note
  // above) — every other chain in this table derives at the default 118.
  { key: "injective", name: "Injective", chainId: "injective-1", prefix: "inj", denom: "inj", symbol: "INJ", decimals: 18, gasPrice: "160000000inj", sendEnabled: false, coinType: 60,
    rest: "https://rest.cosmos.directory/injective", rpc: "https://rpc.cosmos.directory/injective", explorer: "https://www.mintscan.io/injective" },
  { key: "sei", name: "Sei", chainId: "pacific-1", prefix: "sei", denom: "usei", symbol: "SEI", decimals: 6, gasPrice: "0.02usei",
    rest: "https://rest.cosmos.directory/sei", rpc: "https://rpc.sei-apis.com", explorer: "https://www.mintscan.io/sei" },
  { key: "dydx", name: "dYdX", chainId: "dydx-mainnet-1", prefix: "dydx", denom: "adydx", symbol: "DYDX", decimals: 18, gasPrice: "12500000000adydx",
    rest: "https://rest.cosmos.directory/dydx", rpc: "https://rpc.cosmos.directory/dydx", explorer: "https://www.mintscan.io/dydx" },
];
export function cosmosChain(chainKey) {
  return COSMOS_CHAINS.find(c => c.key === chainKey) || null;
}
/** The BIP44 coin type a Cosmos chain derives at: 118 for the family,
 *  60 for Injective (the Keplr/Leap path — see the family note). */
export function cosmosCoinType(chain) { return chain.coinType || 118; }
function cosmosKeys(phrase, coinType = 118) {
  const seed = mnemonicToSeedSync(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/${coinType}'/0'/0/0`);
  return { child, accountBytes: ripemd160(sha256(child.publicKey)) }; // hash160 of the compressed pubkey
}
/** The wallet's address on one Cosmos chain (bech32 of that chain's
 *  account bytes under its prefix — shared at 118 for six chains,
 *  Injective's own at 60). */
export function cosmosAddress(phrase, chainKey) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  const { accountBytes } = cosmosKeys(phrase, cosmosCoinType(chain));
  return bech32.encode(chain.prefix, bech32.toWords(accountBytes));
}
/** Every Cosmos address of this wallet: { chainKey: address }.
 *  Derives once per distinct coin type in the table (118 + 60). */
export function cosmosAddresses(phrase) {
  const byType = new Map();
  const wordsFor = (coinType) => {
    if (!byType.has(coinType)) byType.set(coinType, bech32.toWords(cosmosKeys(phrase, coinType).accountBytes));
    return byType.get(coinType);
  };
  return Object.fromEntries(COSMOS_CHAINS.map(c => [c.key, bech32.encode(c.prefix, wordsFor(cosmosCoinType(c)))]));
}
/** A valid address FOR THIS CHAIN: right bech32 prefix, valid checksum,
 *  20-byte (account) or 32-byte (contract) payload. */
export function isValidCosmosAddress(address, chainKey) {
  const chain = cosmosChain(chainKey);
  if (!chain) return false;
  try {
    const dec = bech32.decode(String(address || "").trim());
    if (dec.prefix !== chain.prefix) return false;
    const bytes = bech32.fromWords(dec.words);
    return bytes.length === 20 || bytes.length === 32;
  } catch { return false; }
}
/** One chain's native balance via its public REST (bank module),
 *  formatted in the display unit. THROWS when the read fails — callers
 *  that paint rows use getCosmosBalances, which degrades per chain. */
export async function getCosmosBalance(chainKey, address) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  const res = await fetch(`${chain.rest}/cosmos/bank/v1beta1/balances/${address}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${chain.name} balance lookup failed (HTTP ${res.status}).`);
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.balances)) throw new Error(`${chain.name} returned an unreadable balance reply.`);
  const hit = data.balances.find(b => b.denom === chain.denom);
  return ethers.formatUnits(BigInt(hit ? hit.amount : "0"), chain.decimals);
}
/** All seven balances, one entry per chain, fault-tolerant per chain:
 *  a chain whose read fails reports amount: null (the UI shows
 *  "unavailable", never a fake zero — the DOGE precedent), and this
 *  function itself never throws. */
export async function getCosmosBalances(phrase) {
  const addrs = cosmosAddresses(phrase);
  return Promise.all(COSMOS_CHAINS.map(async (chain) => {
    let amount = null;
    try { amount = await getCosmosBalance(chain.key, addrs[chain.key]); } catch { /* this chain stays null */ }
    return { ...chain, address: addrs[chain.key], amount };
  }));
}
/** The signer principle, Cosmos edition: a sentence, never a blob. */
export function formatCosmosSendIntent({ amount, symbol, to, chainName, feeAmount, feeSymbol }) {
  return `Send ${amount} ${symbol} to ${to} on ${chainName}. ` +
         `Network fee about ${feeAmount} ${feeSymbol}. Confirm?`;
}
function cosmosMsgSend(chain, from, to, rawAmount, denom = chain.denom) {
  return { typeUrl: "/cosmos.bank.v1beta1.MsgSend",
           value: { fromAddress: from, toAddress: to, amount: [{ denom, amount: rawAmount }] } };
}
async function cosmosSignerClient(phrase, chain) {
  const { child } = cosmosKeys(phrase, cosmosCoinType(chain));
  const signer = await DirectSecp256k1Wallet.fromKey(child.privateKey, chain.prefix);
  return SigningStargateClient.connectWithSigner(chain.rpc, signer, { gasPrice: GasPrice.fromString(chain.gasPrice) });
}
/** Simulate a MsgSend and price the fee at the chain's registry
 *  average gas price (CosmJS "auto" math: simulated gas × 1.4).
 *  Returns { fee: {amount: [{denom, amount}], gas}, feeText } where
 *  feeText is the display-unit fee for the intent sentence. */
export async function estimateCosmosFee(phrase, chainKey, { to, amount, denom = null, decimals = null }) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  const from = cosmosAddress(phrase, chainKey);
  const raw = ethers.parseUnits(String(amount), decimals ?? chain.decimals).toString();
  const client = await cosmosSignerClient(phrase, chain);
  try {
    const gasUsed = await client.simulate(from, [cosmosMsgSend(chain, from, to, raw, denom || chain.denom)], "");
    const fee = calculateFee(Math.round(gasUsed * 1.4), GasPrice.fromString(chain.gasPrice));
    const coin = fee.amount[0] || { denom: chain.denom, amount: "0" };
    return { fee, feeText: ethers.formatUnits(BigInt(coin.amount), chain.decimals), feeSymbol: chain.symbol };
  } finally { client.disconnect(); }
}
/** Build, sign (locally — CosmJS signing with Fluid's derived key) and
 *  broadcast a bank MsgSend of the chain's native asset. Pass the fee
 *  object from estimateCosmosFee to broadcast exactly what the user
 *  approved; without one the fee is computed at broadcast time.
 *  Returns { hash }. */
export async function sendCosmos(phrase, chainKey, { to, amount, fee = null, denom = null, decimals = null }) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  if (chain.sendEnabled === false) throw new Error(`Sending on ${chain.name} is not available yet.`);
  if (!isValidCosmosAddress(to, chainKey)) throw new Error(`That is not a valid ${chain.name} address (it starts with ${chain.prefix}1).`);
  const raw = ethers.parseUnits(String(amount), decimals ?? chain.decimals);
  if (raw <= 0n) throw new Error("Enter an amount.");
  const from = cosmosAddress(phrase, chainKey);
  const client = await cosmosSignerClient(phrase, chain);
  try {
    const result = await client.signAndBroadcast(from, [cosmosMsgSend(chain, from, to, raw.toString(), denom || chain.denom)], fee || "auto", "");
    assertIsDeliverTxSuccess(result);
    return { hash: result.transactionHash };
  } finally { client.disconnect(); }
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
// Non-EVM families join the swap universe by their LI.FI chain id. Tron
// (chainType TVM on LI.FI) is addressed by base58 T-addresses there —
// its "native token" is the T-form of the zero address, NOT the EVM one.
export const TRON_LIFI_CHAIN_ID = 728126428;
export const TRON_SWAP_NATIVE_TOKEN = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
// Solana (chainType SVM on LI.FI) is addressed by Base58 pubkeys there;
// its "native token" is the System Program id, per LI.FI's chain list.
export const SOLANA_LIFI_CHAIN_ID = 1151111081099710;
export const SOLANA_SWAP_NATIVE_TOKEN = "11111111111111111111111111111111";
// Sui (chainType MVM on LI.FI) is addressed by 0x coin types there; its
// "native token" is the SUI coin type in zero-padded long form, exactly
// as LI.FI's chain list carries it (verified live 2026-11-06 against
// /v1/chains?chainTypes=…, which also fixed the chain id below).
export const SUI_LIFI_CHAIN_ID = 9270000000000000;
export const SUI_SWAP_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
/** Resolve a swap-side chain key to {chainId, name}: a NETWORKS key, or
 *  a non-EVM family key ("tron", "solana", "sui"). Null when unknown. */
export function swapChainOf(chainKey) {
  if (chainKey === "tron") return { chainId: TRON_LIFI_CHAIN_ID, name: "Tron" };
  if (chainKey === "solana") return { chainId: SOLANA_LIFI_CHAIN_ID, name: "Solana" };
  if (chainKey === "sui") return { chainId: SUI_LIFI_CHAIN_ID, name: "Sui" };
  const n = NETWORKS[chainKey];
  return n ? { chainId: n.chainId, name: n.name } : null;
}

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
export async function getSwapRoutes({ fromChainKey, toChainKey, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress }) {
  const from = swapChainOf(fromChainKey), to = swapChainOf(toChainKey);
  if (!from || !to) throw new Error("Unknown network in swap.");
  const destAddress = toAddress || fromAddress;
  try {
    const res = await fetch(`${LIFI_API}/routes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        fromChainId: from.chainId, toChainId: to.chainId,
        fromTokenAddress, toTokenAddress,
        fromAmount: String(fromAmount), fromAddress, toAddress: destAddress,
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
    fromAmount: String(fromAmount), fromAddress, toAddress: destAddress,
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
/** The SVM steps of a Solana-sourced route: LI.FI does not return an
 *  EVM transactionRequest for them — it returns a ready-to-sign
 *  serialized Solana transaction as base64 in transactionRequest.data
 *  (svmTransactionVersion 0 = a v0 VersionedTransaction; absent = a
 *  legacy transaction). Verified against live LI.FI quotes 2026-11-06:
 *  the payload deserializes with @solana/web3.js and carries exactly
 *  one signature slot — the user's. */
export function solanaSwapSteps(route) {
  if (Number(route?.fromChainId) !== SOLANA_LIFI_CHAIN_ID) return [];
  return (route?.steps || []).filter(s =>
    s.transactionRequest && typeof s.transactionRequest.data === "string" && s.transactionRequest.data.length > 0);
}
export function swapRouteExecutable(route) {
  // Solana-sourced routes are signable since Phase 1b: the step payload
  // is a serialized transaction Fluid deserializes, signs with the
  // wallet's Solana key and broadcasts — see executeSolanaSwapRoute.
  if (Number(route?.fromChainId) === SOLANA_LIFI_CHAIN_ID) {
    const steps = solanaSwapSteps(route);
    return steps.length
      ? { ok: true, svm: true, steps }
      : { ok: false, reason: "This route's Solana steps carry no signable transaction — pick another route." };
  }
  // Sui-sourced routes: LI.FI's MVM step payload shape could not be
  // live-verified in the Phase 2b build session (LI.FI answered the
  // /quote probes with HTTP 429 rate-limit), and Fluid never signs a
  // payload shape it has not inspected — the same discipline that kept
  // Tron routes disabled in Phase 1a. Routes INTO Sui from an EVM
  // chain are unaffected: their signable steps are the EVM ones, and
  // the bridge delivers to the Sui address.
  if (Number(route?.fromChainId) === SUI_LIFI_CHAIN_ID) {
    return { ok: false, reason: "Fluid can't sign swap steps starting on Sui yet — send from the Sui rows instead, or pick a route starting on an EVM chain or Solana." };
  }
  // Fluid signs with an EVM key on EVM chains. Routes sourced from a
  // non-EVM family (Tron, …) may carry steps, but
  // their signatures are a different scheme — they stay unexecutable
  // here until that family's signer lands, never faked.
  const evmIds = new Set(Object.values(NETWORKS).map(n => n.chainId));
  if (!evmIds.has(Number(route?.fromChainId))) {
    return { ok: false, reason: "Fluid can't sign swap steps starting on this chain yet — send from the chain's own rows instead, or pick a route starting on an EVM chain." };
  }
  const steps = swapExecutableSteps(route);
  return steps.length
    ? { ok: true, steps }
    : { ok: false, reason: "This route needs steps Fluid can't sign yet — pick another route." };
}

/** Execute a Solana-sourced swap route: for each SVM step, deserialize
 *  LI.FI's transaction, verify it was built for THIS wallet (its fee
 *  payer must be the wallet's Solana address — never sign a transaction
 *  addressed to someone else's account), sign with the wallet's Solana
 *  key and broadcast. Returns the transaction signatures. */
export async function executeSolanaSwapRoute(phrase, route, onProgress = () => {}) {
  const { ok, svm, steps, reason } = swapRouteExecutable(route);
  if (!ok || !svm) throw new Error(reason || "That route does not start on Solana.");
  const kp = solanaKeypair(phrase);
  const myAddr = kp.publicKey.toBase58();
  const hashes = [];
  for (let i = 0; i < steps.length; i++) {
    const tr = steps[i].transactionRequest;
    const raw = base64.decode(tr.data);
    onProgress(`Signing Solana step ${i + 1} of ${steps.length}…`);
    let serialized;
    if (tr.svmTransactionVersion != null) {
      const vtx = SolVersionedTransaction.deserialize(raw);
      const payer = vtx.message.staticAccountKeys[0];
      if (!payer || payer.toBase58() !== myAddr) throw new Error("That Solana route was built for a different account — refusing to sign it.");
      vtx.sign([kp]);
      serialized = vtx.serialize();
    } else {
      const tx = SolTransaction.from(raw);
      if (tx.feePayer && tx.feePayer.toBase58() !== myAddr) throw new Error("That Solana route was built for a different account — refusing to sign it.");
      tx.partialSign(kp);
      serialized = tx.serialize();
    }
    const sig = await solanaBroadcast(serialized, "That route");
    hashes.push(sig);
    onProgress(`Solana step ${i + 1} sent ✓`);
  }
  return hashes;
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
  const f = swapChainOf(fromNetKey), t = swapChainOf(toNetKey);
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

// ---------- Universal token support (every token, every chain) ----------
// Ethuram's rule (2026-11-06): Fluid supports TOKENS, not just chains —
// every asset a wallet holds, memecoins included, is visible, sendable
// and swappable — not only the native coin + USDC/USDT rows each family
// shipped with. This section is the discovery layer behind that:
//
//   * Solana: UNFILTERED getTokenAccountsByOwner across BOTH SPL
//     programs (legacy Token + Token-2022); metadata in the order
//     Jupiter strict list → LI.FI token record → DexScreener → short
//     mint label. (token.jup.ag did not answer from this machine at
//     build time; the lookup degrades gracefully when it doesn't.)
//   * Sui: the GraphQL balances connection (every coin type) + batched
//     coinMetadata — JSON-RPC's suix_getAllBalances is deprecated on
//     the public fullnodes (see getSuiBalances).
//   * Cosmos: the bank balances response already carries EVERY denom;
//     names/decimals come from the chain registry (cosmos.directory),
//     IBC/ hashes are labelled "IBC token".
//   * Tron: TronGrid's account resource carries the full trc20 map;
//     metadata comes from the contracts themselves (constant calls).
//   * EVM: the ACTIVE chain's LI.FI token list + a Multicall3
//     balanceOf scan (JSON-RPC batch / direct-call fallbacks) + custom
//     tokens by contract address.
//
// Safety treatment (wallet-security research, drainer-era discipline):
// a token is "verified" only when it appears in the family's trusted
// list (curated set, Jupiter strict, or the chain's LI.FI list without
// a "flagged" mark). Everything else still shows and still works, but
// carries verified:false — the app groups it under "Other tokens",
// marks it ⚠, and adds a caution line to its send/swap reviews.
// Prices come from the list that named the token (LI.FI priceUSD) or
// DexScreener — NEVER from a bare symbol lookup, because any scam
// token can call itself "USDC".
// Row contract: DISCOVERED rows always carry `priceUsd` (a number, or
// null when no source prices them); native/curated rows leave it
// undefined so the app prices them from its market table exactly as
// before. Consumers must prefer a present priceUsd — including null —
// over any symbol-based price.

export function chunkArray(arr, size) {
  const out = [];
  const n = Math.max(1, size | 0);
  const a = arr || [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
/** "0x1234…abcd"-style label for an address with no known metadata. */
export function shortAddrLabel(address) {
  const s = String(address || "");
  return s.length > 12 ? s.slice(0, 6) + "…" + s.slice(-4) : s;
}
/** Format a raw smallest-unit amount for display (ethers formatUnits). */
export function formatTokenAmount(raw, decimals) {
  return ethers.formatUnits(BigInt(raw), decimals ?? 18);
}

// ----- DexScreener: long-tail prices + metadata of last resort -----
const DEX_API = "https://api.dexscreener.com/latest/dex";
/** DexScreener chain ids for the EVM chains Fluid knows by number. */
const DEX_EVM_CHAIN_IDS = { 1: "ethereum", 56: "bsc", 8453: "base", 42161: "arbitrum", 10: "optimism",
  137: "polygon", 43114: "avalanche", 324: "zksync", 59144: "linea", 534352: "scroll",
  5000: "mantle", 100: "gnosis", 42220: "celo", 122: "fuse" };
export function dexChainIdForEvmChain(chainId) {
  return DEX_EVM_CHAIN_IDS[Number(chainId)] || null;
}
/** Pure parser: from a DexScreener /tokens response pick, per wanted
 *  token address, a trustworthy price ON the requested chain where
 *  the token is the BASE token. Returns a Map keyed by the LOWERCASED
 *  address → { priceUsd, name, symbol }. Quote-side pairs (the token
 *  merely traded against) never set its price.
 *  Price selection is deliberately NOT "the deepest pool wins": dead
 *  pools keep absurd ratios with phantom liquidity (measured live on
 *  BONK, 2026-11-06: two stale Meteora pools quoted ~4,900× the real
 *  price with $34M of "liquidity" between them, outranking every live
 *  pool). Instead, candidate prices are bucketed by order of
 *  magnitude; the bucket with the most 24h VOLUME wins (real trading
 *  clusters at the real price; a stale pool cannot fake a market),
 *  and inside the bucket the highest-volume pair's price is used. */
export function parseDexScreenerPairs(data, dexChainId, addresses) {
  const want = new Set((addresses || []).map(a => String(a).toLowerCase()));
  const byToken = new Map(); // key -> [candidate pairs]
  for (const p of (data && data.pairs) || []) {
    if (!p || p.chainId !== dexChainId || !p.baseToken || !p.baseToken.address) continue;
    const key = String(p.baseToken.address).toLowerCase();
    if (!want.has(key)) continue;
    const price = p.priceUsd != null && p.priceUsd !== "" ? Number(p.priceUsd) : null;
    if (price == null || !(price > 0)) continue;
    const cand = { price, vol: Number((p.volume && p.volume.h24) || 0),
                   liq: Number((p.liquidity && p.liquidity.usd) || 0),
                   name: p.baseToken.name || null, symbol: p.baseToken.symbol || null };
    if (!byToken.has(key)) byToken.set(key, []);
    byToken.get(key).push(cand);
  }
  const out = new Map();
  for (const [key, cands] of byToken) {
    const buckets = new Map(); // magnitude -> { vol, liq, pairs }
    for (const c of cands) {
      const mag = Math.floor(Math.log10(c.price));
      const b = buckets.get(mag) || { vol: 0, liq: 0, pairs: [] };
      b.vol += c.vol; b.liq += c.liq; b.pairs.push(c);
      buckets.set(mag, b);
    }
    let win = null;
    for (const b of buckets.values()) {
      if (!win || b.vol > win.vol || (b.vol === win.vol && b.liq > win.liq)) win = b;
    }
    const rep = win.pairs.slice().sort((a, b) => (b.vol - a.vol) || (b.liq - a.liq))[0];
    out.set(key, { priceUsd: rep.price, name: rep.name, symbol: rep.symbol });
  }
  return out;
}
/** Batched DexScreener lookup (30 addresses per call, the API's cap).
 *  Returns a Map keyed by the address AS PASSED IN → { priceUsd, name,
 *  symbol }. Fault-tolerant per batch: a failed batch prices nothing,
 *  it never throws. */
export async function getDexScreenerTokenInfo(dexChainId, addresses) {
  const out = new Map();
  if (!dexChainId) return out;
  const clean = [...new Set((addresses || []).filter(Boolean).map(String))];
  for (const grp of chunkArray(clean, 30)) {
    try {
      const res = await fetch(`${DEX_API}/tokens/${grp.join(",")}`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const m = parseDexScreenerPairs(data, dexChainId, grp);
      for (const a of grp) {
        const hit = m.get(a.toLowerCase());
        if (hit) out.set(a, hit);
      }
    } catch { /* that batch stays unpriced */ }
  }
  return out;
}

// ----- LI.FI token lists (the swap universe doubles as a registry) -----
function lifiTokenShape(t) {
  if (!t || !t.address || !t.symbol) return null;
  const px = t.priceUSD != null && t.priceUSD !== "" ? Number(t.priceUSD) : null;
  return { symbol: t.symbol, name: t.name || t.symbol, address: t.address,
           decimals: t.decimals ?? 18, priceUSD: px != null && px > 0 ? px : null,
           verificationStatus: t.verificationStatus || null };
}
/** Verified, for LI.FI-sourced tokens, means: in the chain's LI.FI
 *  list AND not marked "flagged" by LI.FI's own risk provider. */
export function lifiTokenVerified(t) {
  return !!t && t.verificationStatus !== "flagged";
}
/** The FULL LI.FI token list for one chain (any family LI.FI carries:
 *  EVM chain ids, Solana 1151111081099710, Tron 728126428, Sui
 *  9270000000000000). Trimmed to the fields the wallet uses. Returns
 *  [] when LI.FI definitively has no list for the chain (HTTP 400),
 *  null when the lookup itself failed. */
export async function fetchLifiTokenList(chainId) {
  try {
    const res = await fetch(`${LIFI_API}/tokens?chains=${chainId}`, { signal: AbortSignal.timeout(30000) });
    if (res.status === 400) return [];
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const list = (data && data.tokens && data.tokens[String(chainId)]) || [];
    return list.map(lifiTokenShape).filter(Boolean);
  } catch { return null; }
}
/** One token's LI.FI record (metadata + price + verification), or
 *  null when LI.FI doesn't know it / the lookup failed. */
export async function fetchLifiToken(chainId, address) {
  try {
    const res = await fetch(`${LIFI_API}/token?chain=${chainId}&token=${encodeURIComponent(address)}`,
      { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return lifiTokenShape(await res.json().catch(() => null));
  } catch { return null; }
}

// ----- Solana: every SPL token, both programs -----
let _jupStrictPromise = null;
/** Jupiter's strict token list as a Map(mint → {symbol, name,
 *  decimals}), fetched at most once per session and ONLY when an
 *  unknown mint actually needs resolving. Null when the list doesn't
 *  answer (it did not answer from the build machine — the fallback
 *  chain in getSolanaAllTokens exists precisely for that). */
export function fetchJupiterStrictMap() {
  if (!_jupStrictPromise) {
    _jupStrictPromise = (async () => {
      try {
        const res = await fetch("https://token.jup.ag/strict", { signal: AbortSignal.timeout(30000) });
        if (!res.ok) return null;
        const list = await res.json().catch(() => null);
        if (!Array.isArray(list)) return null;
        const m = new Map();
        for (const t of list) if (t && t.address) m.set(t.address, { symbol: t.symbol, name: t.name || t.symbol, decimals: t.decimals });
        return m;
      } catch { return null; }
    })();
  }
  return _jupStrictPromise;
}
/** EVERY Solana token row for an address: native SOL, the curated
 *  USDC/USDT (always present, zero when unheld — the family's familiar
 *  face), then every other mint with a positive balance across BOTH
 *  token programs. Discovered rows carry { program, verified,
 *  priceUsd } — priceUsd is null when no source prices the token,
 *  never a symbol-based guess. Throws only when the token scan itself
 *  is unreachable (both program reads failed); a single program's
 *  failure degrades to the other's tokens. */
export async function getSolanaAllTokens(address) {
  if (!isValidSolanaAddress(address)) throw new Error("That is not a valid Solana address.");
  const native = { symbol: "SOL", name: "Solana", amount: "0", address: null, decimals: 9, verified: true };
  const bal = await solanaRpc("getBalance", [address]);
  native.amount = solLamportsToSol((bal && bal.value) ?? 0);
  const byMint = new Map(); // mint -> { raw, decimals, program }
  let failures = 0;
  for (const program of [SOLANA_PROGRAMS.token, SOLANA_PROGRAMS.token2022]) {
    try {
      const r = await solanaRpc("getTokenAccountsByOwner", [address, { programId: program }, { encoding: "jsonParsed" }]);
      for (const acc of (r && r.value) || []) {
        const info = acc && acc.account && acc.account.data && acc.account.data.parsed && acc.account.data.parsed.info;
        const ta = info && info.tokenAmount;
        if (!info || !info.mint || !ta) continue;
        let raw = 0n;
        try { raw = BigInt(ta.amount || "0"); } catch { continue; }
        if (raw <= 0n) continue;
        const cur = byMint.get(info.mint) || { raw: 0n, decimals: ta.decimals ?? 6, program };
        cur.raw += raw;
        byMint.set(info.mint, cur);
      }
    } catch { failures++; }
  }
  if (failures === 2) throw new Error("Solana token scan unavailable.");
  // Metadata resolution for every held mint, cheapest source first.
  const meta = new Map(); // mint -> { symbol, name, verified, priceUsd }
  for (const t of SOLANA_TOKENS) meta.set(t.address, { symbol: t.symbol, name: t.symbol, verified: true, priceUsd: null });
  const unknown = [...byMint.keys()].filter(m => !meta.has(m));
  if (unknown.length) {
    const jup = await fetchJupiterStrictMap().catch(() => null);
    for (const m of unknown) {
      const j = jup && jup.get(m);
      if (j) meta.set(m, { symbol: j.symbol, name: j.name, verified: true, priceUsd: null });
    }
    const needMeta = unknown.filter(m => !meta.has(m)).slice(0, 24);
    for (const grp of chunkArray(needMeta, 6)) {
      await Promise.all(grp.map(async (m) => {
        const t = await fetchLifiToken(SOLANA_LIFI_CHAIN_ID, m);
        if (t) meta.set(m, { symbol: t.symbol, name: t.name, verified: lifiTokenVerified(t), priceUsd: t.priceUSD });
      }));
    }
    const needPrice = unknown.filter(m => { const x = meta.get(m); return !x || x.priceUsd == null; });
    if (needPrice.length) {
      const dex = await getDexScreenerTokenInfo("solana", needPrice);
      for (const m of needPrice) {
        const d = dex.get(m);
        if (!d) continue;
        const cur = meta.get(m) || { symbol: d.symbol || shortAddrLabel(m), name: d.name || "", verified: false, priceUsd: null };
        if (!meta.has(m) && d.symbol) { cur.symbol = d.symbol; cur.name = d.name || cur.name; }
        if (d.priceUsd != null) cur.priceUsd = d.priceUsd;
        meta.set(m, cur);
      }
    }
  }
  const rows = [native];
  for (const t of SOLANA_TOKENS) {
    const held = byMint.get(t.address);
    rows.push({ symbol: t.symbol, name: t.symbol, amount: held ? ethers.formatUnits(held.raw, t.decimals) : "0",
                address: t.address, decimals: t.decimals, program: held ? held.program : SOLANA_PROGRAMS.token,
                verified: true });
    byMint.delete(t.address);
  }
  for (const [mint, held] of byMint) {
    const mm = meta.get(mint) || { symbol: shortAddrLabel(mint), name: "", verified: false, priceUsd: null };
    rows.push({ symbol: mm.symbol, name: mm.name || mm.symbol, amount: ethers.formatUnits(held.raw, held.decimals),
                address: mint, decimals: held.decimals, program: held.program,
                verified: !!mm.verified, priceUsd: mm.priceUsd ?? null });
  }
  return rows;
}
/** One Solana balance for the swap sheet's targeted check: native SOL
 *  when `mint` is null, else the summed balance of that mint across
 *  both token programs, formatted with the given decimals. */
export async function getSolanaTokenBalance(address, mint = null, decimals = 6) {
  if (!mint) {
    const bal = await solanaRpc("getBalance", [address]);
    return solLamportsToSol((bal && bal.value) ?? 0);
  }
  let sum = 0n, dec = decimals;
  for (const program of [SOLANA_PROGRAMS.token, SOLANA_PROGRAMS.token2022]) {
    try {
      const r = await solanaRpc("getTokenAccountsByOwner", [address, { mint, programId: program }, { encoding: "jsonParsed" }]);
      for (const acc of (r && r.value) || []) {
        const ta = acc && acc.account && acc.account.data && acc.account.data.parsed &&
                   acc.account.data.parsed.info && acc.account.data.parsed.info.tokenAmount;
        if (!ta) continue;
        sum += BigInt(ta.amount || "0");
        if (ta.decimals != null) dec = ta.decimals;
      }
    } catch { /* that program holds none / didn't answer */ }
  }
  return ethers.formatUnits(sum, dec);
}

// ----- Sui: every coin type, via the public GraphQL endpoint -----
const SUI_GRAPHQL = "https://graphql.mainnet.sui.io/graphql";
async function suiGraphql(query) {
  const res = await fetch(SUI_GRAPHQL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("Sui network error (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  if (!data || data.errors) throw new Error("Sui returned an unreadable reply.");
  return data.data;
}
/** Fallback symbol from a coin type string: the struct name
 *  ("0x2::sui::SUI" → "SUI") — used only when on-chain metadata is
 *  missing; such rows are unverified by construction. */
export function suiCoinFallbackSymbol(coinType) {
  const seg = String(coinType || "").split("::");
  return seg.length >= 3 ? seg[2] : "COIN";
}
/** Fetch coin metadata for a batch of coin types in ONE GraphQL
 *  request (aliased coinMetadata queries). Fault-tolerant per type:
 *  a type whose metadata is missing or malformed is simply absent
 *  from the returned Map. */
async function suiCoinMetadataMap(coinTypes) {
  const out = new Map();
  for (const grp of chunkArray(coinTypes, 20)) {
    try {
      const fields = grp.map((t, i) =>
        `m${i}: coinMetadata(coinType: ${JSON.stringify(t)}) { decimals name symbol }`).join(" ");
      const data = await suiGraphql(`query { ${fields} }`);
      grp.forEach((t, i) => {
        const m = data && data["m" + i];
        if (m && m.decimals != null) out.set(t, { decimals: m.decimals, name: m.name || "", symbol: m.symbol || "" });
      });
    } catch { /* that batch stays metadata-less */ }
  }
  return out;
}
/** EVERY Sui coin row for an address: native SUI, the curated
 *  USDC/USDT (always present, zero when unheld), then every other
 *  coin type the address holds. Reads ride Mysten's public GraphQL
 *  (the JSON-RPC balances API is deprecated on public fullnodes).
 *  Discovered rows carry { verified, priceUsd } like Solana's. */
export async function getSuiAllBalances(address) {
  if (!isValidSuiAddress(address)) throw new Error("That is not a valid Sui address.");
  const owner = normalizeSuiAddress(address);
  const held = new Map(); // coinType -> raw total (string)
  let cursor = null, pages = 0;
  while (pages < 4) {
    const after = cursor ? `, after: ${JSON.stringify(cursor)}` : "";
    const data = await suiGraphql(
      `query { address(address: ${JSON.stringify(owner)}) { balances(first: 50${after}) { nodes { coinType { repr } totalBalance } pageInfo { hasNextPage endCursor } } } }`);
    const conn = data && data.address && data.address.balances;
    if (!conn) break;
    for (const n of conn.nodes || []) {
      if (n && n.coinType && n.coinType.repr) held.set(n.coinType.repr, String(n.totalBalance || "0"));
    }
    if (!conn.pageInfo || !conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
    pages++;
  }
  const norm = (t) => (normalizeSuiAddress(t.split("::")[0]) || t.split("::")[0]) + "::" + t.split("::").slice(1).join("::");
  const heldByNorm = new Map([...held.entries()].map(([t, v]) => [norm(t), { type: t, raw: v }]));
  const rows = [{ symbol: "SUI", name: "Sui", amount: suiMistToSui((heldByNorm.get(norm(SUI_COIN_TYPE)) || {}).raw ?? 0),
                  address: null, decimals: 9, verified: true }];
  heldByNorm.delete(norm(SUI_COIN_TYPE));
  for (const t of SUI_TOKENS) {
    const hit = heldByNorm.get(norm(t.address));
    rows.push({ symbol: t.symbol, name: t.symbol, amount: hit ? ethers.formatUnits(BigInt(hit.raw), t.decimals) : "0",
                address: t.address, decimals: t.decimals, verified: true });
    heldByNorm.delete(norm(t.address));
  }
  const others = [...heldByNorm.values()].filter(h => { try { return BigInt(h.raw) > 0n; } catch { return false; } });
  if (others.length) {
    const metas = await suiCoinMetadataMap(others.map(h => h.type));
    const meta = new Map();
    const needLifi = [];
    for (const h of others) {
      const cm = metas.get(h.type);
      meta.set(h.type, { symbol: (cm && cm.symbol) || suiCoinFallbackSymbol(h.type),
                         name: (cm && cm.name) || "", decimals: cm ? cm.decimals : 9,
                         verified: false, priceUsd: null });
      needLifi.push(h.type);
    }
    for (const grp of chunkArray(needLifi.slice(0, 24), 6)) {
      await Promise.all(grp.map(async (type) => {
        const t = await fetchLifiToken(SUI_LIFI_CHAIN_ID, type);
        if (t) { const cur = meta.get(type); cur.verified = lifiTokenVerified(t); cur.priceUsd = t.priceUSD; if (t.decimals != null) cur.decimals = t.decimals; }
      }));
    }
    const needPrice = others.map(h => h.type).filter(t => { const x = meta.get(t); return !x || x.priceUsd == null; });
    if (needPrice.length) {
      const dex = await getDexScreenerTokenInfo("sui", needPrice);
      for (const type of needPrice) {
        const d = dex.get(type);
        if (d && d.priceUsd != null) meta.get(type).priceUsd = d.priceUsd;
      }
    }
    for (const h of others) {
      const mm = meta.get(h.type);
      rows.push({ symbol: mm.symbol, name: mm.name || mm.symbol, amount: ethers.formatUnits(BigInt(h.raw), mm.decimals),
                  address: h.type, decimals: mm.decimals, verified: !!mm.verified, priceUsd: mm.priceUsd ?? null });
    }
  }
  return rows;
}
/** One Sui coin balance for the swap sheet's targeted check. */
export async function getSuiTokenBalance(address, coinType, decimals = 9) {
  if (!isValidSuiAddress(address)) throw new Error("That is not a valid Sui address.");
  const owner = normalizeSuiAddress(address);
  const data = await suiGraphql(
    `query { address(address: ${JSON.stringify(owner)}) { balance(coinType: ${JSON.stringify(coinType)}) { totalBalance } } }`);
  const raw = (data && data.address && data.address.balance && data.address.balance.totalBalance) || "0";
  return ethers.formatUnits(BigInt(raw), decimals);
}

// ----- Tron: every TRC-20 in the account resource -----
/** Decode an ABI-encoded string from a TronGrid constant-call result
 *  (hex, no 0x): dynamic string layout first, bytes32 fallback for
 *  the old tokens that return fixed-width names/symbols. */
export function tronDecodeAbiString(hexStr) {
  try {
    const bytes = ethers.getBytes("0x" + String(hexStr || "").replace(/^0x/i, ""));
    if (bytes.length >= 64) {
      const len = Number(BigInt("0x" + hex.encode(bytes.slice(32, 64))));
      if (len > 0 && len <= 256 && bytes.length >= 64 + len) {
        return new TextDecoder().decode(bytes.slice(64, 64 + len));
      }
    }
    const s = new TextDecoder().decode(Uint8Array.from(bytes.filter(b => b !== 0))).trim();
    return s || null;
  } catch { return null; }
}
async function tronConstantResult(contractAddress, selector, parameter = "") {
  const data = await tronPost("/wallet/triggerconstantcontract", {
    owner_address: "410000000000000000000000000000000000000000", // zero-ish caller; constant calls need no account
    contract_address: tronAddressToHex(contractAddress),
    function_selector: selector, parameter,
  });
  const out = data && data.constant_result && data.constant_result[0];
  return typeof out === "string" && out ? out : null;
}
/** A TRC-20's own metadata, read from the contract itself (name(),
 *  symbol(), decimals() constant calls). Each field is independently
 *  fault-tolerant; unanswered fields come back null. */
export async function tronTrc20Meta(contractAddress) {
  const out = { name: null, symbol: null, decimals: null };
  const [n, s, d] = await Promise.all([
    tronConstantResult(contractAddress, "name()").catch(() => null),
    tronConstantResult(contractAddress, "symbol()").catch(() => null),
    tronConstantResult(contractAddress, "decimals()").catch(() => null),
  ]);
  if (n) out.name = tronDecodeAbiString(n);
  if (s) out.symbol = tronDecodeAbiString(s);
  if (d) { try { out.decimals = Number(BigInt("0x" + d)); } catch { /* stays null */ } }
  return out;
}
const TRON_META_LOOKUP_CAP = 40; // per-account cap on per-contract metadata reads
/** EVERY Tron row for an address: native TRX, the curated USDT/USDC
 *  (always present, zero when unheld), then every other TRC-20 the
 *  account resource lists with a positive balance. Metadata for
 *  discovered tokens is read from their contracts (capped, above);
 *  prices come from DexScreener. Discovered rows carry { verified,
 *  priceUsd }; verification for Tron means: curated, or present in
 *  LI.FI's Tron token list without a "flagged" mark. */
export async function getTronAllTokens(address) {
  if (!isValidTronAddress(address)) throw new Error("That is not a valid Tron address.");
  const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Tron balance lookup failed (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  const acct = data && Array.isArray(data.data) ? data.data[0] : null;
  const rows = [{ symbol: "TRX", name: "Tron", amount: tronSunToTrx((acct && acct.balance) ?? 0), address: null, decimals: 6, verified: true }];
  const held = new Map(); // contract -> raw BigInt
  for (const entry of (acct && acct.trc20) || []) {
    if (!entry || typeof entry !== "object") continue;
    for (const [contract, rawStr] of Object.entries(entry)) {
      try { const raw = BigInt(rawStr); if (raw > 0n) held.set(contract, raw); } catch { /* unparsable balance — skip */ }
    }
  }
  for (const t of TRON_TOKENS) {
    const raw = held.get(t.address);
    rows.push({ symbol: t.symbol, name: t.symbol, amount: raw != null ? ethers.formatUnits(raw, t.decimals) : "0",
                address: t.address, decimals: t.decimals, verified: true });
    held.delete(t.address);
  }
  const others = [...held.entries()];
  if (others.length) {
    const dex = await getDexScreenerTokenInfo("tron", others.map(([c]) => c));
    const metaWork = others.slice(0, TRON_META_LOOKUP_CAP);
    const metas = new Map();
    for (const grp of chunkArray(metaWork, 5)) {
      await Promise.all(grp.map(async ([contract]) => {
        const [cm, lt] = await Promise.all([
          tronTrc20Meta(contract).catch(() => ({ name: null, symbol: null, decimals: null })),
          fetchLifiToken(TRON_LIFI_CHAIN_ID, contract).catch(() => null),
        ]);
        metas.set(contract, { cm, lt });
      }));
    }
    for (const [contract, raw] of others) {
      const { cm, lt } = metas.get(contract) || { cm: { name: null, symbol: null, decimals: null }, lt: null };
      const d = dex.get(contract);
      const decimals = cm.decimals ?? (lt && lt.decimals) ?? 6;
      const symbol = cm.symbol || (lt && lt.symbol) || (d && d.symbol) || shortAddrLabel(contract);
      const name = cm.name || (lt && lt.name) || (d && d.name) || symbol;
      const priceUsd = (lt && lt.priceUSD) ?? (d && d.priceUsd) ?? null;
      rows.push({ symbol, name, amount: ethers.formatUnits(raw, decimals), address: contract,
                  decimals, verified: lifiTokenVerified(lt), priceUsd });
    }
  }
  return rows;
}
/** One Tron balance for the swap sheet's targeted check: native TRX
 *  when `token` is null, else that TRC-20's balanceOf. */
export async function getTronTokenBalance(address, token = null) {
  if (!token) {
    const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error("Tron balance lookup failed (HTTP " + res.status + ").");
    const data = await res.json().catch(() => null);
    const acct = data && Array.isArray(data.data) ? data.data[0] : null;
    return tronSunToTrx((acct && acct.balance) ?? 0);
  }
  const raw = await tronTrc20Balance(address, token);
  return ethers.formatUnits(raw, token.decimals ?? 6);
}

// ----- Cosmos: every denom the bank module reports -----
const COSMOS_REGISTRY_API = "https://chains.cosmos.directory";
const _cosmosRegistryCache = new Map(); // chainKey -> Map(denom -> {symbol, name, decimals}) | null
/** The chain registry's asset table for one Cosmos chain (cosmos.
 *  directory mirrors github.com/cosmos/chain-registry keylessly):
 *  denom → display {symbol, name, decimals}. Session-cached; null
 *  when the registry didn't answer (callers fall back to heuristics
 *  and mark denoms unverified). */
export async function fetchCosmosDenomRegistry(chainKey) {
  if (_cosmosRegistryCache.has(chainKey)) return _cosmosRegistryCache.get(chainKey);
  let map = null;
  try {
    const res = await fetch(`${COSMOS_REGISTRY_API}/${chainKey}`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const j = await res.json().catch(() => null);
      const assets = (j && j.chain && j.chain.assets) || (j && j.assets) || [];
      map = new Map();
      for (const a of assets) {
        const denom = a && (a.denom || (a.base && a.base.denom));
        if (!denom) continue;
        const dec = a.decimals != null ? a.decimals
          : (a.display && a.display.exponent != null ? a.display.exponent : 6);
        map.set(denom, { symbol: a.symbol || denom, name: a.name || a.symbol || denom, decimals: dec });
      }
    }
  } catch { /* registry unreachable — heuristics apply */ }
  _cosmosRegistryCache.set(chainKey, map);
  return map;
}
/** Pure presentation for one bank denom on one chain: the chain's
 *  native denom and registry-known denoms are named + verified; IBC/
 *  hashes are labelled "IBC token"; factory/ denoms show their
 *  subdenom; a bare u-prefixed denom follows the Cosmos micro
 *  convention (u = 6 decimals, symbol = the rest uppercased). Any
 *  heuristic row is unverified — its amount may be mis-scaled if the
 *  token uses non-standard decimals, which is exactly what the ⚠
 *  in the app communicates. */
export function cosmosDenomDisplay(chain, denom, meta) {
  if (denom === chain.denom) {
    return { symbol: chain.symbol, name: chain.name, decimals: chain.decimals, verified: true, ibc: false };
  }
  if (meta) return { symbol: meta.symbol, name: meta.name || meta.symbol, decimals: meta.decimals, verified: true, ibc: false };
  if (String(denom).startsWith("ibc/")) {
    return { symbol: "IBC token", name: "IBC token", decimals: 6, verified: false, ibc: true };
  }
  if (String(denom).startsWith("factory/")) {
    const parts = String(denom).split("/");
    return { symbol: parts[parts.length - 1].toUpperCase().slice(0, 16), name: "Factory token", decimals: 6, verified: false, ibc: false };
  }
  if (/^u[a-zA-Z0-9]{2,}$/.test(denom)) {
    return { symbol: denom.slice(1).toUpperCase(), name: denom, decimals: 6, verified: false, ibc: false };
  }
  return { symbol: String(denom).toUpperCase().slice(0, 16), name: String(denom), decimals: 6, verified: false, ibc: false };
}
/** All seven Cosmos balances WITH every denom per chain. Same
 *  fault-tolerance contract as getCosmosBalances: a chain whose read
 *  fails reports amount: null AND tokens: null (unavailable, never a
 *  fake zero); this function itself never throws. Each chain entry
 *  gains `tokens`: [{ denom, symbol, name, amount, decimals,
 *  verified, ibc }] with the native denom first. */
export async function getCosmosAllBalances(phrase) {
  const addrs = cosmosAddresses(phrase);
  return Promise.all(COSMOS_CHAINS.map(async (chain) => {
    let amount = null, tokens = null;
    try {
      const res = await fetch(`${chain.rest}/cosmos/bank/v1beta1/balances/${addrs[chain.key]}`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`${chain.name} balance lookup failed (HTTP ${res.status}).`);
      const data = await res.json().catch(() => null);
      if (!data || !Array.isArray(data.balances)) throw new Error(`${chain.name} returned an unreadable balance reply.`);
      const registry = await fetchCosmosDenomRegistry(chain.key);
      tokens = data.balances.map(b => {
        const disp = cosmosDenomDisplay(chain, b.denom, registry ? registry.get(b.denom) : null);
        let amt = "0";
        try { amt = ethers.formatUnits(BigInt(b.amount || "0"), disp.decimals); } catch { /* keep 0 */ }
        return { denom: b.denom, ...disp, amount: amt };
      });
      tokens.sort((x, y) => (y.denom === chain.denom ? 1 : 0) - (x.denom === chain.denom ? 1 : 0) || x.denom.localeCompare(y.denom));
      const nat = tokens.find(t => t.denom === chain.denom);
      amount = nat ? nat.amount : "0";
    } catch { amount = null; tokens = null; }
    return { ...chain, address: addrs[chain.key], amount, tokens };
  }));
}

// ----- EVM: Multicall3 scan, single reads, custom-token metadata -----
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
// aggregate3 is declared `view` here on purpose: on-chain it is
// payable, but it performs no state changes, and declaring it view is
// what makes ethers issue an eth_call instead of demanding a signer
// (a read-only provider "does not support sending transactions").
const MULTICALL3_ABI = ["function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] results)"];
const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];
const ERC20_META_ABI = [
  "function name() view returns (string)", "function symbol() view returns (string)",
  "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)",
];
const ERC20_META_B32_ABI = ["function name() view returns (bytes32)", "function symbol() view returns (bytes32)"];
const _multicall3Cache = new Map(); // networkKey -> boolean
/** Does this chain have Multicall3 at its canonical address? One
 *  eth_getCode per chain per session. */
export async function hasMulticall3(networkKey) {
  if (_multicall3Cache.has(networkKey)) return _multicall3Cache.get(networkKey);
  let ok = false;
  try {
    const code = await providerFor(networkKey).getCode(MULTICALL3_ADDRESS);
    ok = !!code && code !== "0x";
  } catch { ok = false; }
  _multicall3Cache.set(networkKey, ok);
  return ok;
}
/** Scan a token list for an owner's positive balances on one chain.
 *  Returns { balances: Map(lowercasedAddress -> BigInt raw), method }
 *  where method is "multicall3" | "batch" | "direct" — the path that
 *  actually ran, so the app can report scan quality honestly.
 *  Strategy: Multicall3 aggregate3 in chunks of 250 when deployed;
 *  else raw JSON-RPC batch eth_call in chunks of 50; else direct
 *  eth_call in chunks of 25 — but a list longer than 800 with no
 *  Multicall3 and a failed batch throws instead of hammering a
 *  public RPC with thousands of calls (the app shows the scan as
 *  "limited" on that chain; curated + custom tokens still work). */
export async function scanEvmTokenBalances(networkKey, ownerAddress, tokens, { chunkSize = 250 } = {}) {
  const net = NETWORKS[networkKey];
  if (!net) throw new Error("Unknown network: " + networkKey);
  const list = (tokens || []).filter(t => t && ethers.isAddress(t.address) && !/^0x0{40}$/i.test(t.address));
  const balances = new Map();
  if (!list.length) return { balances, method: "none" };
  const iface = new ethers.Interface(ERC20_BALANCE_ABI);
  const callData = iface.encodeFunctionData("balanceOf", [ownerAddress]);
  if (await hasMulticall3(networkKey)) {
    const mc = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, providerFor(networkKey));
    for (const grp of chunkArray(list, chunkSize)) {
      const calls = grp.map(t => ({ target: t.address, allowFailure: true, callData }));
      const results = await mc.aggregate3(calls);
      results.forEach((r, i) => {
        if (!r || !r.success || !r.returnData || r.returnData === "0x") return;
        try {
          const v = iface.decodeFunctionResult("balanceOf", r.returnData)[0];
          if (v > 0n) balances.set(grp[i].address.toLowerCase(), v);
        } catch { /* a non-ERC20 reply — not a balance */ }
      });
    }
    return { balances, method: "multicall3" };
  }
  try {
    for (const grp of chunkArray(list, 50)) {
      const payload = grp.map((t, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call",
        params: [{ to: t.address, data: callData }, "latest"] }));
      const res = await fetch(net.rpc, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("batch HTTP " + res.status);
      const out = await res.json().catch(() => null);
      if (!Array.isArray(out)) throw new Error("batch unsupported");
      for (const item of out) {
        const t = item && grp[item.id];
        if (!t || !item.result || item.result === "0x") continue;
        try { const v = BigInt(item.result); if (v > 0n) balances.set(t.address.toLowerCase(), v); } catch { /* not a number */ }
      }
    }
    return { balances, method: "batch" };
  } catch { /* batching refused — direct calls or an honest "limited" */ }
  if (list.length > 800) throw new Error("Token scan is limited on this chain (no Multicall3 deployment).");
  const provider = providerFor(networkKey);
  for (const grp of chunkArray(list, 25)) {
    await Promise.all(grp.map(async (t) => {
      try {
        const v = await new ethers.Contract(t.address, ERC20_BALANCE_ABI, provider).balanceOf(ownerAddress);
        if (v > 0n) balances.set(t.address.toLowerCase(), v);
      } catch { /* that contract didn't answer — not a balance */ }
    }));
  }
  return { balances, method: "direct" };
}
/** One EVM balance for targeted checks (swap sheet, custom-token
 *  rows): the native coin when `token` is null or the zero address,
 *  else that contract's balanceOf. Returns a formatted string. */
export async function getEvmTokenBalance(wallet, networkKey, token = null) {
  const provider = providerFor(networkKey);
  if (!token || !token.address || /^0x0{40}$/i.test(token.address)) {
    return ethers.formatEther(await provider.getBalance(wallet.address));
  }
  const c = new ethers.Contract(token.address, ERC20_BALANCE_ABI, provider);
  return ethers.formatUnits(await c.balanceOf(wallet.address), token.decimals ?? 18);
}
/** Read a would-be ERC-20's metadata + the owner's balance straight
 *  from the contract (custom-token add: nothing is taken on trust
 *  from any list). Throws a plain error when the contract doesn't
 *  answer like an ERC-20 — a pasted address that isn't a token must
 *  fail loudly here, not become a broken row. Handles the old
 *  bytes32 name/symbol tokens via a fallback ABI. */
export async function readEvmTokenMeta(networkKey, address, ownerAddress) {
  if (!ethers.isAddress(address)) throw new Error("That is not a valid contract address.");
  const contract = ethers.getAddress(address);
  const provider = providerFor(networkKey);
  const c = new ethers.Contract(contract, ERC20_META_ABI, provider);
  let name = null, symbol = null, decimals = null, balance = 0n;
  try { name = await c.name(); } catch { /* try bytes32 below */ }
  try { symbol = await c.symbol(); } catch { /* try bytes32 below */ }
  if (!symbol || !name) {
    try {
      const cb = new ethers.Contract(contract, ERC20_META_B32_ABI, provider);
      const dec = (v) => { try { return new TextDecoder().decode(ethers.getBytes(v).filter(b => b !== 0)).trim() || null; } catch { return null; } };
      if (!symbol) symbol = dec(await cb.symbol());
      if (!name) name = dec(await cb.name());
    } catch { /* stays null — handled below */ }
  }
  try { decimals = Number(await c.decimals()); } catch { /* handled below */ }
  if (decimals == null || !Number.isFinite(decimals)) {
    throw new Error("That contract doesn't answer like an ERC-20 token (no decimals) — check the address.");
  }
  if (!symbol) {
    throw new Error("That contract doesn't answer like an ERC-20 token (no symbol) — check the address.");
  }
  try { balance = await c.balanceOf(ownerAddress); } catch { /* balance stays 0 */ }
  return { address: contract, name: name || symbol, symbol, decimals,
           balance: ethers.formatUnits(balance, decimals) };
}
