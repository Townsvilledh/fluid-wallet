// Fluid wallet core — all key handling lives here, on top of audited
// libraries (ethers v6 for EVM, @scure/* for Bitcoin). Fluid adds UI +
// routing, not home-grown cryptography. Non-custodial by construction:
// keys are generated and encrypted in the user's browser and never
// leave the device unencrypted. One seed phrase = every chain below.
import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import * as btc from "@scure/btc-signer";
import { base58, base58check, base58xrp, base64, base32, bech32, bech32m, hex } from "@scure/base";
import { SigningStargateClient, GasPrice, calculateFee, assertIsDeliverTxSuccess } from "@cosmjs/stargate";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { TxBody as CosmosTxBody, TxRaw as CosmosTxRaw, AuthInfo as CosmosAuthInfo, SignDoc as CosmosSignDoc, SignerInfo as CosmosSignerInfo, ModeInfo as CosmosModeInfo } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgSend as CosmosBankMsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { Any as ProtobufAny } from "cosmjs-types/google/protobuf/any";
import { PubKey as CosmosSecp256k1PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { Coin as CosmosCoin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { hmac } from "@noble/hashes/hmac.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256, sha512, sha512_256 } from "@noble/hashes/sha2.js";
import { keccak_256, sha3_256 } from "@noble/hashes/sha3.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1, schnorr } from "@noble/curves/secp256k1.js";
import {
  Keypair as SolKeypair, PublicKey as SolPublicKey, SystemProgram as SolSystemProgram,
  Transaction as SolTransaction, TransactionInstruction as SolTxInstruction,
  VersionedTransaction as SolVersionedTransaction,
  TransactionMessage as SolTransactionMessage,
  AddressLookupTableAccount as SolAddressLookupTableAccount,
} from "@solana/web3.js";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction as SuiTransaction } from "@mysten/sui/transactions";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import {
  Keypair as StellarKeypair, Account as StellarAccount,
  TransactionBuilder as StellarTxBuilder, Operation as StellarOperation,
  Asset as StellarAsset, Networks as StellarNetworks,
} from "@stellar/stellar-sdk/base";
import {
  Address as TonAddress, beginCell as tonBeginCell, storeMessage as tonStoreMessage,
  external as tonExternal, internal as tonInternal, toNano as tonToNano, fromNano as tonFromNano,
} from "@ton/core";
import { WalletContractV4 as TonWalletContractV4 } from "@ton/ton";
import { keyPairFromSeed as tonKeyPairFromSeed } from "@ton/crypto";
import algosdk from "algosdk";
import { encodeForSigning as xrplEncodeForSigning, encode as xrplEncode, decode as xrplDecode } from "ripple-binary-codec";
import { ApiPromise as DotApiPromise, HttpProvider as DotHttpProvider } from "@polkadot/api";
import { Keyring as DotKeyring } from "@polkadot/keyring";
import { decodeAddress as dotDecodeAddress, cryptoWaitReady as dotCryptoWaitReady } from "@polkadot/util-crypto";

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
    // Fallback for the balance read (live-verified 2026-11-08: HTTP 200,
    // CORS *, eth_chainId 0x38): the publicnode endpoint 429s under
    // shared-IP load, and a failed curated load used to surface as a
    // silent $0.00. getBalances retries here once before failing.
    rpcFallback: "https://bsc-dataseed.binance.org/",
    fonbnkNetwork: "BNB",
    tokens: [USDC("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", 18), USDT("0x55d398326f99059fF775485246999027B3197955", 18)],
  },
  base: {
    name: "Base", chainId: 8453, symbol: "ETH", priceSym: "ETH",
    rpc: "https://base-rpc.publicnode.com", explorer: "https://basescan.org",
    // Fallback for the balance read (live-verified 2026-11-08: HTTP 200,
    // CORS allows the Fluid origin): same 429 story as BNB Chain.
    rpcFallback: "https://mainnet.base.org",
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
    tokens: [USDC("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"), USDT("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7")],
  },
  zksync: {
    name: "zkSync Era", chainId: 324, symbol: "ETH", priceSym: "ETH",
    rpc: "https://mainnet.era.zksync.io", explorer: "https://era.zksync.network",
    tokens: [USDC("0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4"), USDT("0x493257fD37EDB34451f62EDf8D2a0C418852bA4c")],
  },
  linea: {
    name: "Linea", chainId: 59144, symbol: "ETH", priceSym: "ETH",
    rpc: "https://linea-rpc.publicnode.com", explorer: "https://lineascan.build",
    tokens: [USDC("0x176211869cA2b568f2A7D4EE941E073a821EE1ff"), USDT("0xA219439258ca9da29E9Cc4cE5596924745e12B93")],
  },
  scroll: {
    name: "Scroll", chainId: 534352, symbol: "ETH", priceSym: "ETH",
    rpc: "https://scroll-rpc.publicnode.com", explorer: "https://scrollscan.com",
    tokens: [],
  },
  mantle: {
    name: "Mantle", chainId: 5000, symbol: "MNT", priceSym: "MNT",
    rpc: "https://rpc.mantle.xyz", explorer: "https://mantlescan.xyz",
    tokens: [],
  },
  gnosis: {
    name: "Gnosis", chainId: 100, symbol: "xDAI", priceSym: "DAI",
    rpc: "https://gnosis-rpc.publicnode.com", explorer: "https://gnosisscan.io",
    tokens: [],
  },
  celo: {
    name: "Celo", chainId: 42220, symbol: "CELO", priceSym: "CELO",
    rpc: "https://forno.celo.org", explorer: "https://celoscan.io",
    tokens: [USDC("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"), USDT("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e")],
  },
  fuse: {
    name: "Fuse", chainId: 122, symbol: "FUSE", priceSym: null,
    rpc: "https://rpc.fuse.io", explorer: "https://explorer.fuse.io",
    tokens: [],
  },
  // B² Network (Bitcoin L2) is pinned as a built-in, live-verified
  // 2026-11-06: the discovery gate admits it (DefiLlama "BSquared" TVL
  // $2.5M, discoverable tier) but the registry's first RPC for it
  // (mainnet.b2-rpc.com) is dead — tenant disabled — so the gate's entry
  // could never pass the switch-time fingerprint. This pin carries the
  // verified RPC instead (eth_chainId 0xdf, blocks flowing). LI.FI does
  // not list chain 223 at all, so there is no LI.FI stable list to pin;
  // the universal EVM scan still finds held tokens on it.
  b2: {
    name: "B² Network", chainId: 223, symbol: "BTC", priceSym: "BTC",
    rpc: "https://rpc.bsquared.network", explorer: "https://explorer.bsquared.network",
    tokens: [],
  },
  sepolia: {
    name: "Sepolia (testnet)", chainId: 11155111, symbol: "ETH", priceSym: null,
    rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io",
    tokens: [],
  },
};

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export function providerFor(networkKey) {
  return new ethers.JsonRpcProvider(NETWORKS[networkKey].rpc, NETWORKS[networkKey].chainId);
}

/** Provider for a network's verified fallback RPC (null when the
 *  network carries none — only networks whose fallback was
 *  live-verified carry one; never invent one). */
export function providerForFallback(networkKey) {
  const fb = NETWORKS[networkKey]?.rpcFallback;
  return fb ? new ethers.JsonRpcProvider(fb, NETWORKS[networkKey].chainId) : null;
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

/* Vault KDF (audit H2, 2026-11-06): new vaults are encrypted with scrypt
 * N=2^18, r=8, p=1 — twice the work factor of the ethers default (2^17)
 * the audit measured. 2^19 was rejected deliberately: it needs ~512 MB
 * of RAM inside the KDF, which risks the browser tab being killed on
 * low-end Android WebViews; 2^18 (~256 MB) measured ≈1.4 s to unlock on
 * this build machine and stays inside the 2–3 s budget on modest phones.
 * The parameters are not a Fluid-side secret: they are stored IN the
 * keystore JSON (Crypto.kdfparams), ethers reads them back at unlock,
 * so vaults written by older Fluid versions (N=2^17) keep unlocking
 * forever, and Fluid re-encrypts them at the new strength after the
 * next successful unlock (see needsKdfUpgrade / reencryptVault and the
 * unlock handler in app.js). NOTE: ethers' Wallet.encrypt() takes a
 * progress callback as its second argument, NOT options — custom scrypt
 * params must go through ethers.encryptKeystoreJson(account, pw,
 * { scrypt }), which is what encryptVault below does (the mnemonic is
 * preserved in the keystore's x-ethers section, as before). */
export const VAULT_SCRYPT = Object.freeze({ N: 262144, r: 8, p: 1 });
async function encryptVault(wallet, password) {
  return ethers.encryptKeystoreJson(wallet, password, { scrypt: { ...VAULT_SCRYPT } });
}

/** Create a brand-new wallet. Returns the phrase ONCE so the UI can show it
 *  for backup; only the encrypted keystore should ever be stored. */
export async function createVault(password) {
  const wallet = ethers.Wallet.createRandom();
  const keystore = await encryptVault(wallet, password);
  return { phrase: wallet.mnemonic.phrase, address: wallet.address, keystore };
}

export async function importVault(phrase, password) {
  const clean = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  if (!ethers.Mnemonic.isValidMnemonic(clean)) throw new Error("That seed phrase is not valid BIP39.");
  const wallet = ethers.Wallet.fromPhrase(clean);
  const keystore = await encryptVault(wallet, password);
  return { phrase: clean, address: wallet.address, keystore };
}

export async function unlockVault(keystore, password) {
  try {
    return await ethers.Wallet.fromEncryptedJson(keystore, password);
  } catch {
    throw new Error("Wrong password.");
  }
}

/** The scrypt parameters a stored keystore was encrypted with, read from
 *  the keystore JSON itself (ethers writes "Crypto", some tools write
 *  "crypto"; param names are lowercase n/r/p). Null when unparseable. */
export function vaultKdfParams(keystore) {
  try {
    const j = typeof keystore === "string" ? JSON.parse(keystore) : keystore;
    const kp = (j && (j.Crypto || j.crypto) || {}).kdfparams || {};
    const n = Number(kp.n), r = Number(kp.r), p = Number(kp.p);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
    return { N: n, r, p };
  } catch { return null; }
}

/** True when a stored vault predates the current KDF strength and should
 *  be re-encrypted at the next successful unlock. Unparseable keystores
 *  return false (unlock will fail on its own; never "upgrade" blind). */
export function needsKdfUpgrade(keystore) {
  const kp = vaultKdfParams(keystore);
  return !!kp && (kp.N < VAULT_SCRYPT.N || kp.r < VAULT_SCRYPT.r || kp.p < VAULT_SCRYPT.p);
}

/** Re-encrypt an already-unlocked wallet at the current KDF strength
 *  (same password). Used opportunistically right after a successful
 *  unlock of an old-format vault. */
export async function reencryptVault(wallet, password) {
  return encryptVault(wallet, password);
}

/* Password floor (audit H2): 12 characters for NEW wallets, imports and
 * password changes. Unlocking an existing vault never applies this —
 * an 8–11 character password set under the old floor must keep working
 * (its vault is silently strengthened at unlock instead). */
export const MIN_PASSWORD_LENGTH = 12;
export function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LENGTH;
}

async function readBalances(wallet, networkKey, provider) {
  const net = NETWORKS[networkKey];
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

export async function getBalances(wallet, networkKey) {
  try {
    return await readBalances(wallet, networkKey, providerFor(networkKey));
  } catch (e) {
    // The primary is a free public endpoint and 429s under shared-IP
    // load (live: bsc-rpc.publicnode.com, 2026-11-08). Retry once
    // against the network's verified fallback before the caller
    // reports the load as failed — a failed read must surface as
    // "couldn't load", never as a zero.
    const fallback = providerForFallback(networkKey);
    if (!fallback) throw e;
    return await readBalances(wallet, networkKey, fallback);
  }
}

/** The home-screen greeting (Ethuram's requirement, 2026-11-06): the
 *  wallet opens with the username FIRST — "Welcome, <name>" when the
 *  wallet owns/adopted a Fluid name, plain "Welcome" when it hasn't.
 *  Selection logic lives here so it is unit-tested; the name is only
 *  ever rendered via textContent. */
export function formatWelcomeHeader(name) {
  const n = String(name || "").trim();
  return n ? `Welcome, ${n}` : "Welcome";
}

/** The signer principle from the Fluid spec: the user approves a sentence,
 *  never a hex blob. Returns the intent text + the tx the wallet would send. */
export function formatSendIntent({ amount, symbol, to, networkKey, feeNative, name }) {
  const net = NETWORKS[networkKey];
  // When the recipient was given as a Fluid name, the confirmation must
  // show BOTH the name the user typed and the FULL address it resolved
  // to (audit L1: a truncated address asks the user to trust the very
  // resolution they are supposed to be checking).
  const dest = name ? `${name}.${FLUID_DOMAIN} (${to})` : to;
  return `Send ${amount} ${symbol} to ${dest} on ${net.name}. ` +
         `Network fee about ${feeNative} ${net.symbol}. Confirm?`;
}

/** "Remove wallet" must leave NOTHING behind (audit L3): every key the
 *  app owns is fluid_* — the vault, the name, send history, approval
 *  records, agent descriptors AND their spend log, the discovered-chain
 *  cache, custom tokens, the LI.FI token cache, the ramp country. The
 *  wipe filters a storage key list through this pure helper so the set
 *  is unit-tested; foreign keys (other apps on the origin) survive. */
export function fluidStorageKeysToWipe(keys) {
  return [...(keys || [])].filter(k => typeof k === "string" && k.startsWith("fluid_"));
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
  LTC: "LTCUSDT", DOGE: "DOGEUSDT", BCH: "BCHUSDT", SUI: "SUIUSDT", XLM: "XLMUSDT",
  ATOM: "ATOMUSDT", OSMO: "OSMUSDT", TIA: "TIAUSDT", INJ: "INJUSDT", SEI: "SEIUSDT", DYDX: "DYDXUSDT",
  TON: "TONUSDT", NEAR: "NEARUSDT", ALGO: "ALGOUSDT", XRP: "XRPUSDT", DOT: "DOTUSDT", APT: "APTUSDT", STX: "STXUSDT" };
const CG_IDS = { BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", POL: "polygon-ecosystem-token", AVAX: "avalanche-2", CELO: "celo", MNT: "mantle", TRX: "tron", SOL: "solana", LTC: "litecoin", DOGE: "dogecoin", BCH: "bitcoin-cash", SUI: "sui", XLM: "stellar", ATOM: "cosmos", OSMO: "osmosis", TIA: "celestia", INJ: "injective-protocol", SEI: "sei-network", DYDX: "dydx-chain", TON: "the-open-network", NEAR: "near", ALGO: "algorand", XRP: "ripple", DOT: "polkadot", APT: "aptos", STX: "blockstack" };
/* RED-TEAM 2026-11-06 (Finding C): getPrices() takes Binance's word alone
 * (CoinGecko only fills gaps and is never compared), yet the agent runtime
 * prices its USD spending CAPS from it — one wrong or malicious response
 * silently revalues every cap. Security controls need agreement: this
 * fetches both sources independently and refuses (throws) unless both
 * answer within 25% of each other. The valuation returned is the HIGHER
 * of the two — for cap enforcement, overvaluing a send is the safe side.
 * Display code keeps using getPrices(); only cap checks use this. */
export async function getVerifiedPrice(symbol) {
  const pair = PRICE_PAIRS[symbol], cgId = CG_IDS[symbol];
  if (symbol === "USDT") return 1;
  if (!pair && !cgId) throw new Error(`No price sources known for ${symbol} — refusing to value it.`);
  let bin = null, cg = null;
  if (pair) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      const d = await res.json();
      const v = parseFloat(d && d.price);
      if (Number.isFinite(v) && v > 0) bin = v;
    } catch { /* source down */ }
  }
  if (cgId) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
      const d = await res.json();
      const v = Number(d && d[cgId] && d[cgId].usd);
      if (Number.isFinite(v) && v > 0) cg = v;
    } catch { /* source down */ }
  }
  if (bin == null || cg == null) throw new Error(`Could not cross-check the ${symbol} price between two independent sources — refusing to value the send.`);
  const hi = Math.max(bin, cg), lo = Math.min(bin, cg);
  if ((hi - lo) / lo > 0.25) throw new Error(`Price sources disagree on ${symbol} (Binance ${bin}, CoinGecko ${cg}) — refusing to value the send.`);
  return hi;
}
/** Per-symbol CoinGecko retry for whatever the batch fallbacks left
 *  unpriced (2026-11-09 unpriced-native fix): the batch fallback is
 *  all-or-nothing — one error body, one slow id or one timeout empties
 *  the WHOLE table (observed live: Binance geo-blocked with an HTTP
 *  451 error object, then the single ~28-id CoinGecko request failed,
 *  leaving even ALGO unpriced while pricing it alone answered in
 *  ~200 ms). Any symbol CoinGecko CAN price must land, so the misses
 *  get one bounded request each. Mutates and returns `out`; it only
 *  ever ADDS prices, never removes one already present.
 *  `fetchImpl` is injectable for tests. */
export async function mergeCgFallbackPrices(out, fetchImpl) {
  const F = fetchImpl || fetch;
  const missing = Object.keys(CG_IDS).filter(s => out[s] == null);
  for (const s of missing) {
    try {
      const res = await F(`https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS[s]}&vs_currencies=usd`, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      const v = Number(data && data[CG_IDS[s]] && data[CG_IDS[s]].usd);
      if (Number.isFinite(v) && v > 0) out[s] = v;
    } catch { /* this symbol stays unpriced; the home UI says so honestly */ }
  }
  return out;
}

export async function getPrices() {
  const out = { USDC: 1, USDT: 1, DAI: 1 };
  try {
    const syms = Object.values(PRICE_PAIRS).filter(Boolean);
    const url = "https://api.binance.com/api/v3/ticker/price?symbols=" + encodeURIComponent(JSON.stringify(syms));
    // Bounded per source (2026-11-09): a HUNG Binance request (not a
    // fast failure) used to hold the whole price load for ~13 s+
    // before the CoinGecko fallback even started — and the caller's
    // own timeout then discarded prices for the whole session. Each
    // source now gets its own budget, so worst case ≈ 6 s + 8 s and
    // the typical case stays one fast batch.
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Binance price response was not a list");
    const byPair = Object.fromEntries(data.map(d => [d.symbol, parseFloat(d.price)]));
    for (const [sym, pair] of Object.entries(PRICE_PAIRS)) if (pair && byPair[pair]) out[sym] = byPair[pair];
    if (out.USDC == null && byPair.USDCUSDT) out.USDC = byPair.USDCUSDT;
  } catch { /* fall through to the CoinGecko fallback below */ }
  // Fallback (e.g. where api.binance.com is region-restricted — matters for
  // headless agents, which refuse unpriced sends): CoinGecko simple price.
  const CG = CG_IDS;
  const missing = Object.keys(CG).filter(s => out[s] == null);
  if (missing.length) {
    try {
      const ids = missing.map(s => CG[s]).join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      for (const s of missing) if (data[CG[s]]?.usd) out[s] = data[CG[s]].usd;
    } catch { /* prices stay partial; callers that need them refuse safely */ }
  }
  // Whatever the batch still missed gets a per-symbol retry: a native
  // major is priced if ANY configured source can price it, never held
  // hostage by one failing batch (see mergeCgFallbackPrices).
  if (Object.keys(CG).some(s => out[s] == null)) {
    try { await mergeCgFallbackPrices(out); } catch { /* partial prices stand */ }
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
const BLOCKSTREAM = "https://blockstream.info/api";
/** Bitcoin balance, mempool.space first with Blockstream's Esplora as
 *  fallback — the two answer the IDENTICAL address JSON shape
 *  (chain_stats / mempool_stats), so one parser serves both (the
 *  same pairing fetchBtcUtxos already uses for UTXOs). A non-OK
 *  status, a garbled body, or a network error all read as "this
 *  source failed, try the next one". Both failing THROWS, so the UI
 *  shows "couldn't load" instead of a fake zero (the DOGE/EVM
 *  precedent). Fallback verified live 2026-11-08: Blockstream's
 *  /address/ answered HTTP 200 for a bc1q address with the Fluid
 *  origin (BlockCypher's BTC balance endpoint also answered 200). */
export async function getBitcoinBalance(address) {
  for (const base of [MEMPOOL, BLOCKSTREAM]) {
    try {
      const res = await fetch(`${base}/address/${address}`);
      if (!res.ok) continue;
      const d = await res.json();
      const funded = d.chain_stats.funded_txo_sum + (d.mempool_stats?.funded_txo_sum || 0);
      const spent = d.chain_stats.spent_txo_sum + (d.mempool_stats?.spent_txo_sum || 0);
      return (funded - spent) / 1e8;
    } catch { /* this source failed — try the next one */ }
  }
  throw new Error("Bitcoin balance lookup failed.");
}

/* Fee-rate resolution (audit H1, 2026-11-06): a fee oracle is an input
 * to signing, so it is treated like every other hostile input — never
 * single-source, never unbounded. resolveFeeRate is the pure core:
 *   - two sane sources that agree within 2× → the primary's rate;
 *   - two sane sources diverging by MORE than 2× → the LOWER rate (a
 *     manipulated or broken oracle can then only underpay, and the UI
 *     discloses it), flagged `diverged`;
 *   - one sane source → that rate; none → the caller's fallback;
 *   - the result is clamped to a coded ceiling, flagged `clamped`.
 * Ceilings: BTC's halfHourFee has exceeded 300 sat/vB only in brief
 * mania spikes (May 2023 ordinals congestion peaked ≈300–500 for hours,
 * not days); paying more than that for a wallet send is never the
 * user's intent, and a capped transaction still confirms when the
 * mempool drains — it is disclosed in the review sentence. LTC's
 * market rate lives at 1–10 sat/vB; 100 is a generous ceiling. */
export const BTC_FEE_CEILING_SATVB = 300;
export const LTC_FEE_CEILING_SATVB = 100;
export function resolveFeeRate({ primary, secondary, ceiling, fallback = 5 } = {}) {
  const sane = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0) ? v : null;
  const p = sane(primary), s = sane(secondary);
  let rate, diverged = false, sources = 0;
  if (p != null && s != null) {
    sources = 2;
    if (Math.max(p, s) / Math.min(p, s) > 2) { rate = Math.min(p, s); diverged = true; }
    else rate = p;
  } else if (p != null) { rate = p; sources = 1; }
  else if (s != null) { rate = s; sources = 1; }
  else rate = fallback;
  let clamped = false;
  if (ceiling && rate > ceiling) { rate = ceiling; clamped = true; }
  return { rate: Math.max(1, rate), diverged, clamped, sources };
}
/** The user-facing disclosure for a resolved fee rate, or "" when the
 *  rate was unremarkable (two agreeing sources under the ceiling). */
export function feeRateNote(info) {
  if (!info) return "";
  const bits = [];
  if (info.diverged) bits.push("the two fee sources disagreed sharply, so Fluid used the lower rate");
  if (info.clamped) bits.push("fee quotes are extremely high right now, so Fluid capped the rate — this may confirm more slowly than usual");
  if (info.sources === 0) bits.push("fee sources were unreachable, so a conservative default rate was used");
  return bits.join("; ");
}
const _feeGrab = async (fn) => { try { const v = await fn(); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } };
/** BTC fee rate, cross-checked: mempool.space's halfHourFee against
 *  Blockstream's independent Esplora fee-estimates (its ~3-block
 *  target ≈ the same half hour), resolved + ceiling-clamped. */
export async function getBtcFeeRateInfo() {
  const [primary, secondary] = await Promise.all([
    _feeGrab(async () => { const r = await fetch(`${MEMPOOL}/v1/fees/recommended`); if (!r.ok) return null; const d = await r.json(); return Number(d?.halfHourFee); }),
    _feeGrab(async () => { const r = await fetch("https://blockstream.info/api/fee-estimates"); if (!r.ok) return null; const d = await r.json(); return Number(d?.["3"]); }),
  ]);
  return resolveFeeRate({ primary, secondary, ceiling: BTC_FEE_CEILING_SATVB, fallback: 5 });
}
/** Fetch a JSON body, or null on ANY failure — never throws. A non-OK
 *  status, a non-JSON body (proxy block pages and rate-limit notices
 *  are plain text) and a network error all read the same way: this
 *  source failed, fall back to the next one. (QA 2026-11-07: the BTC
 *  send review died with the raw parse error `Unexpected token 'e',
 *  "endpoint d"… is not valid JSON` when a source answered text.) */
async function fetchJsonOrNull(url) {
  try {
    const r = await fetch(url);
    if (!r || !r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}
/** Validate + normalise an Esplora UTXO set (hostile input: entries
 *  are kept only with a well-formed txid/vout/value, and reduced to
 *  the fields the planners read). A non-array, or an array whose every
 *  entry is malformed, is a failed source (null), not an empty set. */
function validUtxoSet(d) {
  if (!Array.isArray(d)) return null;
  const out = [];
  for (const u of d) {
    if (u && typeof u.txid === "string" && /^[0-9a-f]{64}$/i.test(u.txid)
      && Number.isInteger(u.vout) && u.vout >= 0 && Number.isFinite(u.value) && u.value >= 0) {
      out.push({ txid: u.txid, vout: u.vout, value: u.value, status: { confirmed: !!(u.status && u.status.confirmed === true) } });
    }
  }
  return d.length && !out.length ? null : out;
}
/** The address's UTXO set from two independent Esplora sources —
 *  mempool.space first, Blockstream as fallback (identical JSON
 *  shape). NOTE the route is the SINGULAR /utxo: the plural /utxos
 *  answers 404 with a plain-text body ("endpoint does not exist …")
 *  on both, verified live 2026-11-07 — the old plural fetch is what
 *  crashed the send review. If neither source produces a valid set,
 *  the caller gets ONE plain-language error, never a raw parse
 *  message. */
export async function fetchBtcUtxos(address) {
  for (const base of [MEMPOOL, BLOCKSTREAM]) {
    const list = validUtxoSet(await fetchJsonOrNull(`${base}/address/${address}/utxo`));
    if (list) return list;
  }
  throw new Error("Couldn't reach the fee sources — check your connection and try again");
}
export async function getBtcFeeRate() {
  return (await getBtcFeeRateInfo()).rate;
}
/** Relay an already-built, already-signed BTC transaction. */
export async function broadcastBitcoinTx(hex) {
  const post = await fetch(`${MEMPOOL}/tx`, { method: "POST", body: hex });
  if (!post.ok) throw new Error("Bitcoin network rejected the transaction: " + (await post.text()));
  return post.text();
}
/** Address form of a Lightning channel funding script. LDK funding
 *  outputs are always P2WSH (0020<32-byte witness program>); anything
 *  else is refused rather than guessed at, because the funding payment
 *  must land on the EXACT script the channel negotiated. */
export function fundingAddressFromScript(scriptHex, network = "bitcoin") {
  const s = String(scriptHex || "").toLowerCase();
  if (!/^0020[0-9a-f]{64}$/.test(s)) {
    throw new Error("Funding script is not a P2WSH script — refusing to build a funding payment to it.");
  }
  const hrp = network === "bitcoin" ? "bc" : (network === "signet" || network === "testnet") ? "tb" : "bcrt";
  return bech32.encode(hrp, [0, ...bech32.toWords(hex.decode(s.slice(4)))], 90);
}
/** Build + sign a BTC payment WITHOUT broadcasting, so the review sheet
 *  can show the EXACT fee before the user confirms; confirming then
 *  broadcasts these exact bytes (what was reviewed is what is sent).
 *  Coin selection uses CONFIRMED UTXOs only (audit L2 — spending an
 *  unconfirmed input can strand the payment if its parent is replaced
 *  or dropped) and, since Build B, excludes inscription-bearing UTXOs
 *  (see getInscriptionProtection): an ordinary send must never burn an
 *  inscription as fee/change dust. `kind` selects the account: "segwit"
 *  (BIP84, default) or "taproot" (BIP86). When the inscription index
 *  cannot be reached the plan still proceeds (the coins are the user's
 *  to risk) but reports inscriptionCheckOk=false so the review can say
 *  plainly that the check did not run. */
export async function planBitcoinSend(phrase, { to, amountBtc, feeRate, kind = "segwit" }) {
  const keys = kind === "taproot" ? btcTaprootKeys(phrase) : btcKeys(phrase);
  const { child, address, script } = keys;
  let rateInfo = null;
  if (!feeRate) { rateInfo = await getBtcFeeRateInfo(); feeRate = rateInfo.rate; }
  const rate = feeRate;
  const prot = await getInscriptionProtection(address);
  const confirmed = (await fetchBtcUtxos(address)).filter(u => u.status.confirmed === true);
  const utxos = confirmed.filter(u => !prot.outpoints.has(`${u.txid}:${u.vout}`))
    .sort((a, b) => b.value - a.value);
  const protectedCount = confirmed.length - utxos.length;
  const target = Math.round(amountBtc * 1e8);
  const picked = []; let sum = 0;
  for (const u of utxos) { picked.push(u); sum += u.value; if (sum >= target + 1000) break; }
  // fee for nIn inputs, 2 outputs (pay + change): ~10 overhead + 68/in
  // (P2WPKH) or 58/in (P2TR keypath) + the two output sizes (31 P2WPKH /
  // 43 P2TR each, sized from the actual output scripts).
  const inVb = kind === "taproot" ? 58 : 68;
  const fee = Math.ceil((10 + picked.length * inVb + btcOutVsize(to) + btcOutVsize(address)) * rate);
  if (sum < target + fee) {
    throw new Error(protectedCount > 0
      ? `Not enough spendable BTC to cover the amount plus network fee. ${protectedCount} inscription-bearing coin(s) are protected and are never spent by ordinary sends.`
      : "Not enough confirmed BTC to cover the amount plus network fee.");
  }
  const change = sum - target - fee;
  const tx = new btc.Transaction();
  for (const u of picked) {
    const input = { txid: u.txid, index: u.vout, witnessUtxo: { script, amount: BigInt(u.value) } };
    if (kind === "taproot") input.tapInternalKey = keys.internalKey; // SIGHASH_DEFAULT, as cross-verified
    else input.sighashType = btc.SigHash.ALL;
    tx.addInput(input);
  }
  tx.addOutputAddress(to, BigInt(target), btc.NETWORK);
  if (change > 330) tx.addOutputAddress(address, BigInt(change), btc.NETWORK);
  tx.sign(child.privateKey);
  tx.finalize();
  return { hex: tx.hex, txid: tx.id, feeSat: fee, feeBtc: fee / 1e8, rate, rateInfo, protectedCount, inscriptionCheckOk: prot.ok, kind };
}
/** Virtual size of one output paying `address` (script + 9 bytes of
 *  framing), from the address family — fee estimation only; the built
 *  transaction's real fee is fixed by the change-absorbs-the-rest
 *  construction, exactly as the SegWit planner has always worked. */
function btcOutVsize(address) {
  const a = String(address || "");
  if (a.startsWith("bc1p")) return 43; // P2TR script 34
  if (a.startsWith("bc1q")) return 31; // P2WPKH script 22
  if (a.startsWith("3")) return 32;    // P2SH script 23
  if (a.startsWith("1")) return 34;    // P2PKH script 25
  return 43;                           // unknown: assume the largest standard size
}
/** Build, sign and broadcast a BTC payment. Returns the txid. */
export async function sendBitcoin(phrase, opts) {
  const plan = await planBitcoinSend(phrase, opts);
  return broadcastBitcoinTx(plan.hex);
}
// --- Taproot (BIP86) — Build B. A second Bitcoin account from the same
// seed: m/86'/0'/account'/0/0, bc1p… Derivation and Schnorr keypath
// signing were cross-checked byte-for-byte against bitcoinjs-lib (an
// independent implementation, scratch-only) and the official BIP86 test
// vector before shipping: abandon×11+about at m/86'/0'/0'/0/0 →
// bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr.
function btcTaprootKeys(phrase, account = 0) {
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/86'/0'/${account}'/0/0`);
  // p2tr needs the x-only (32-byte) internal key — secp keys are 33 bytes.
  const xonly = child.publicKey.slice(1);
  const pay = btc.p2tr(xonly, undefined, btc.NETWORK);
  return { child, address: pay.address, script: pay.script, internalKey: xonly };
}
export function bitcoinTaprootAddress(phrase, account = 0) { return btcTaprootKeys(phrase, account).address; }
// --- Ordinals safety + Runes — Build B. Index: the Ordinals Wallet
// "Turbo" API (keyless for reads, verified live 2026-11-06; the Hiro
// Ordinals/Runes APIs now require an API key, so they cannot serve a
// keyless wallet). All index data is HOSTILE input: ids and outpoints
// are strictly validated, names/symbols are escaped at render, amounts
// are integer strings bounded in code. Rare sats: no verified keyless
// per-UTXO satributes source exists today, so the protection covers
// inscriptions (the index-verified asset class); a UTXO carrying only a
// rare sat is not detectable keylessly — disclosed in the Build B report.
const ORD_API = "https://turbo.ordinalswallet.com";
/** Parse Turbo's inscription outpoint encoding: 72 hex chars = the txid
 *  in internal (reversed) byte order + a little-endian u32 vout.
 *  Returns { txid (display order), vout } or null on any malformation.
 *  Verified against mempool.space on a real outpoint (see tests). */
export function parseTurboOutpoint(op) {
  const s = String(op ?? "").toLowerCase();
  if (!/^[0-9a-f]{72}$/.test(s)) return null;
  const rawBytes = s.slice(0, 64).match(/../g).reverse().join("");
  const vout = parseInt(s.slice(64, 72).match(/../g).reverse().join(""), 16);
  return { txid: rawBytes, vout };
}
/** Validate + normalise one raw Turbo inscriptions response. Rows whose
 *  outpoint does not parse are dropped entirely — for protection AND
 *  display an unparseable location is worse than none. Metadata is
 *  length-capped here and escaped at render. */
export function normalizeTurboInscriptions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    const loc = parseTurboOutpoint(r?.outpoint?.outpoint);
    if (!loc) continue;
    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
    out.push({
      id: /^[0-9a-f]{64}i[0-9]+$/.test(String(r?.id ?? "")) ? String(r.id) : null,
      num: Number.isInteger(r?.num) ? r.num : null,
      contentType: str(r?.content_type, 100) || "unknown",
      name: str(r?.meta?.name, 200),
      collection: str(r?.collection?.name, 200),
      txid: loc.txid, vout: loc.vout,
      satOffset: Number.isInteger(r?.outpoint?.sat_offset) ? r.outpoint.sat_offset : null,
    });
  }
  return out;
}
/** The wallet's inscriptions (display). Throws on index failure so the
 *  UI can show an honest error state instead of "none". */
export async function getInscriptions(address) {
  const res = await fetch(`${ORD_API}/wallet/${address}/inscriptions`);
  if (!res.ok) throw new Error(`Inscription index returned ${res.status}.`);
  return normalizeTurboInscriptions(await res.json());
}
/** Which confirmed UTXOs must ordinary BTC sends NEVER touch.
 *  NEVER throws: any failure (index down, malformed data, the cold-index
 *  case where the aggregate claims inscription coins exist but the list
 *  comes back empty) returns ok:false with an EMPTY protected set plus
 *  the flag, and the caller proceeds with the disclosure the brief
 *  specifies — the protection must never brick a plain BTC send. */
export async function getInscriptionProtection(address) {
  try {
    const [insRes, walRes] = await Promise.all([
      fetch(`${ORD_API}/wallet/${address}/inscriptions`),
      fetch(`${ORD_API}/wallet/${address}`),
    ]);
    if (!insRes.ok || !walRes.ok) return { ok: false, outpoints: new Set(), count: 0 };
    const list = normalizeTurboInscriptions(await insRes.json());
    const agg = await walRes.json();
    if (Number(agg?.inscription_balance) > 0 && list.length === 0) {
      return { ok: false, outpoints: new Set(), count: 0 }; // cold index — distrust the empty list
    }
    return { ok: true, outpoints: new Set(list.map(i => `${i.txid}:${i.vout}`)), count: list.length };
  } catch { return { ok: false, outpoints: new Set(), count: 0 }; }
}
export function inscriptionPreviewUrl(id) {
  return typeof id === "string" && /^[0-9a-f]{64}i[0-9]+$/.test(id)
    ? `https://cdn.ordinalswallet.com/inscription/preview/${id}` : null;
}
/** One collectibles row, fully escaped (C1 pattern). The preview image
 *  is only ever the id-validated CDN URL, only for image content. */
export function formatInscriptionRow(ins) {
  const title = ins?.name || ins?.collection || "Inscription";
  const bits = [ins?.num != null ? `#${ins.num}` : null, ins?.contentType || "unknown type",
    ins?.collection && ins?.name ? ins.collection : null].filter(Boolean).join(" · ");
  const url = String(ins?.contentType || "").startsWith("image/") ? inscriptionPreviewUrl(ins?.id) : null;
  const img = url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" style="width:38px;height:38px;border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:8px">` : "";
  return `<div class="hist">${img}<b>${escapeHtml(title)}</b> <small style="color:var(--dim)">${escapeHtml(bits)}</small></div>`;
}
// --- Runes: balances, and transfers whose runestone encoding was
// validated byte-for-byte in scratch against TWO independent reference
// implementations (@ordjs/runestone — the official ord WASM — and
// @magiceden-oss/runestone-lib) across five vectors incl. multi-rune
// edicts, pointer, mint, zero/huge amounts and same-block delta rules.
export function parseRuneId(s) {
  const m = /^(\d{1,10}):(\d{1,10})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const block = Number(m[1]), tx = Number(m[2]);
  if (!Number.isSafeInteger(block) || !Number.isSafeInteger(tx)) return null;
  return { block, tx, key: `${block}:${tx}` };
}
/** Turbo's rune amount is in WHOLE units (proven against an on-chain
 *  runestone: 2,100 whole at divisibility 10 = 21,000,000,000,000 base).
 *  Amounts are kept as strings end-to-end — never floats. */
export function normalizeTurboRunes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    const id = parseRuneId(r?.rune_id);
    if (!id) continue;
    if (!/^\d{1,40}$/.test(String(r?.amount ?? ""))) continue; // integer whole units only
    const div = Number(r?.divisibility);
    if (!Number.isInteger(div) || div < 0 || div > 38) continue;
    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
    out.push({ runeId: id.key, block: id.block, tx: id.tx, name: str(r?.name, 200) || id.key,
      symbol: str(r?.symbol, 16), amount: String(r.amount), divisibility: div });
  }
  return out;
}
export async function getRuneBalances(address) {
  const res = await fetch(`${ORD_API}/wallet/${address}/rune-balance`);
  if (!res.ok) throw new Error(`Rune index returned ${res.status}.`);
  return normalizeTurboRunes(await res.json());
}
export function normalizeTurboRuneOutpoints(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    const m = /^([0-9a-f]{64}):(\d{1,6})$/i.exec(String(r?.outpoint ?? ""));
    if (!m) continue;
    if (!/^\d{1,40}$/.test(String(r?.amount ?? ""))) continue;
    out.push({ txid: m[1].toLowerCase(), vout: Number(m[2]), amountWhole: String(r.amount),
      sats: Number.isSafeInteger(r?.sats) && r.sats > 0 ? r.sats : null });
  }
  return out;
}
export async function getRuneOutpoints(address, runeId) {
  const res = await fetch(`${ORD_API}/wallet/${address}/rune-outpoints/${encodeURIComponent(runeId)}`);
  if (!res.ok) throw new Error(`Rune index returned ${res.status}.`);
  return normalizeTurboRuneOutpoints(await res.json());
}
/** Whole-unit amount string → base units (BigInt). Fractional input is
 *  accepted up to the rune's divisibility and rejected beyond it. */
export function runeWholeToBase(amount, divisibility) {
  const s = String(amount ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid rune amount.");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > divisibility) throw new Error("Too many decimal places for this rune.");
  const padded = (frac + "0".repeat(divisibility)).slice(0, divisibility);
  return BigInt(whole) * 10n ** BigInt(divisibility) + BigInt(padded || "0");
}
function leb128Encode(n) {
  let v = BigInt(n); const out = [];
  do { let b = Number(v & 0x7fn); v >>= 7n; if (v > 0n) b |= 0x80; out.push(b); } while (v > 0n);
  return out;
}
/** Encode a runestone script (OP_RETURN OP_13 + chunked payload pushes).
 *  Field order: mint (tag 20 as two pairs), pointer (tag 22), body
 *  (tag 0, then delta-encoded edicts sorted by rune id; the tx component
 *  is ABSOLUTE when the block advanced, a delta only within one block).
 *  Pinned byte-for-byte by five reference vectors in the tests. */
export function encodeRunestone({ edicts = [], pointer, mint } = {}) {
  const ints = [];
  if (mint) ints.push(20, mint.block, 20, mint.tx);
  if (pointer !== undefined && pointer !== null) ints.push(22, pointer);
  if (edicts.length) {
    const sorted = [...edicts].sort((a, b) => (a.id.block - b.id.block) || (a.id.tx - b.id.tx));
    ints.push(0);
    let prevBlock = 0, prevTx = 0;
    for (const e of sorted) {
      const blockDelta = e.id.block - prevBlock;
      ints.push(blockDelta, blockDelta === 0 ? e.id.tx - prevTx : e.id.tx, e.amount, e.output);
      prevBlock = e.id.block; prevTx = e.id.tx;
    }
  }
  if (!ints.length) throw new Error("A runestone needs at least one field.");
  const payload = ints.flatMap(i => leb128Encode(i));
  const script = [0x6a, 0x5d]; // OP_RETURN, OP_13 (the Runestone magic)
  for (let off = 0; off < payload.length; off += 520) {
    const chunk = payload.slice(off, off + 520);
    if (chunk.length < 76) script.push(chunk.length);
    else if (chunk.length <= 0xff) script.push(0x4c, chunk.length);
    else script.push(0x4d, chunk.length & 0xff, (chunk.length >> 8) & 0xff);
    script.push(...chunk);
  }
  return Uint8Array.from(script);
}
/** One rune balance row, fully escaped. Rune names/symbols are hostile
 *  metadata (anyone can etch any name) — the app adds the standing
 *  unverified caution at section level. */
export function formatRuneRow(r) {
  return `<div class="hist"><b>${escapeHtml(r?.name || r?.runeId || "Rune")}</b> <small style="color:var(--dim)">${escapeHtml(r?.symbol || "")} · ${escapeHtml(r?.runeId || "")}</small><br><b>${escapeHtml(r?.amount ?? "0")}</b></div>`;
}
/** Build + sign a Rune transfer WITHOUT broadcasting (same
 *  review-then-broadcast-exact-bytes pattern as planBitcoinSend).
 *  Construction: output 0 = runestone OP_RETURN, output 1 = recipient
 *  (546 sats, edict target), output 2 = rune change (546 sats, pointer)
 *  only when unallocated runes remain, then BTC change. Safety rails:
 *  the inscription check MUST have run (unlike a plain BTC send, a rune
 *  transfer refuses when it cannot verify its fee coins are
 *  inscription-free); a rune coin that also carries an inscription or a
 *  DIFFERENT rune is a hard refusal with a split-first message, because
 *  moving it would silently move that asset too. */
export async function planRuneTransfer(phrase, { runeId, to, amountWhole, feeRate }) {
  const rid = parseRuneId(runeId);
  if (!rid) throw new Error("Invalid rune id.");
  try { btc.Address(btc.NETWORK).decode(String(to)); }
  catch { throw new Error("That is not a valid Bitcoin address."); }
  let rateInfo = null;
  if (!feeRate) { rateInfo = await getBtcFeeRateInfo(); feeRate = rateInfo.rate; }
  const rate = feeRate;
  const accounts = [
    { kind: "segwit", ...btcKeys(phrase) },
    { kind: "taproot", ...btcTaprootKeys(phrase) },
  ];
  let divisibility = null, runeName = rid.key;
  const runeCoins = [], feeCoins = [];
  let protectedCount = 0;
  for (const acct of accounts) {
    const balances = await getRuneBalances(acct.address).catch(() => null);
    if (!balances) throw new Error("Could not reach the rune index — no transfer was built.");
    const entry = balances.find(b => b.runeId === rid.key);
    const prot = await getInscriptionProtection(acct.address);
    if (!prot.ok) throw new Error("The inscription check could not run, so Fluid won't build a rune transfer: its fee coins could not be verified inscription-free. Try again when the index is reachable.");
    protectedCount += prot.count;
    const utxoMap = new Map((await fetchBtcUtxos(acct.address))
      .filter(u => u.status.confirmed === true).map(u => [`${u.txid}:${u.vout}`, u.value]));
    const runeHeldOutpoints = new Set();
    if (entry) {
      if (divisibility === null) { divisibility = entry.divisibility; runeName = entry.name; }
      else if (divisibility !== entry.divisibility) throw new Error("The rune index disagrees with itself about this rune — no transfer was built.");
      for (const c of await getRuneOutpoints(acct.address, rid.key)) {
        const key = `${c.txid}:${c.vout}`, value = utxoMap.get(key);
        if (value === undefined) continue; // spent or unconfirmed since indexing
        runeHeldOutpoints.add(key);
        if (prot.outpoints.has(key)) throw new Error("One of the coins holding this rune also carries an inscription — Fluid won't move it. Split that coin in a dedicated ordinals wallet first.");
        runeCoins.push({ ...c, value, kind: acct.kind, base: runeWholeToBase(c.amountWhole, divisibility) });
      }
    }
    for (const b of balances) {
      if (b.runeId === rid.key) continue;
      for (const o of await getRuneOutpoints(acct.address, b.runeId)) {
        const key = `${o.txid}:${o.vout}`;
        runeHeldOutpoints.add(key);
        if (runeCoins.some(c => `${c.txid}:${c.vout}` === key)) {
          throw new Error(`One of the coins holding this rune also holds ${b.name} — sending it would move that rune too. Split that coin first.`);
        }
      }
    }
    for (const [key, value] of utxoMap) {
      if (prot.outpoints.has(key) || runeHeldOutpoints.has(key)) continue;
      const [txid, vout] = key.split(":");
      feeCoins.push({ txid, vout: Number(vout), value, kind: acct.kind });
    }
  }
  if (divisibility === null) throw new Error("This wallet does not hold that rune.");
  const targetBase = runeWholeToBase(amountWhole, divisibility);
  if (targetBase <= 0n) throw new Error("Enter an amount above zero.");
  runeCoins.sort((a, b) => (a.base > b.base ? -1 : a.base < b.base ? 1 : 0));
  feeCoins.sort((a, b) => b.value - a.value);
  const pickedRunes = []; let runeSum = 0n;
  for (const c of runeCoins) { pickedRunes.push(c); runeSum += c.base; if (runeSum >= targetBase) break; }
  if (runeSum < targetBase) throw new Error(`Not enough ${runeName} — this wallet holds less than the amount entered.`);
  const runeChange = runeSum > targetBase;
  const primary = accounts.find(a => a.kind === pickedRunes[0].kind);
  const runestone = encodeRunestone({
    edicts: [{ id: rid, amount: targetBase, output: 1 }],
    ...(runeChange ? { pointer: 2 } : {}),
  });
  const POSTAGE = 546;
  const outputsBase = POSTAGE * (runeChange ? 2 : 1);
  const inVbOf = c => (c.kind === "taproot" ? 58 : 68);
  const pickedFees = [];
  const feeFor = () => Math.ceil((10
    + [...pickedRunes, ...pickedFees].reduce((s, c) => s + inVbOf(c), 0)
    + (runestone.length + 9) + btcOutVsize(to)
    + (runeChange ? btcOutVsize(primary.address) : 0)
    + btcOutVsize(primary.address)) * rate); // + BTC change output, always estimated in
  let fee = feeFor();
  const totalIn = () => [...pickedRunes, ...pickedFees].reduce((s, c) => s + c.value, 0);
  while (totalIn() < outputsBase + fee) {
    const next = feeCoins.shift();
    if (!next) throw new Error("Not enough inscription-free BTC to pay this transfer's postage and network fee.");
    pickedFees.push(next); fee = feeFor();
  }
  const change = totalIn() - outputsBase - fee;
  // allowUnknownOutputs is required for the OP_RETURN runestone output.
  const tx = new btc.Transaction({ allowUnknownOutputs: true });
  const byKind = { segwit: accounts[0], taproot: accounts[1] };
  const usedKinds = new Set();
  for (const c of [...pickedRunes, ...pickedFees]) {
    const acct = byKind[c.kind];
    const input = { txid: c.txid, index: c.vout, witnessUtxo: { script: acct.script, amount: BigInt(c.value) } };
    if (c.kind === "taproot") input.tapInternalKey = acct.internalKey; else input.sighashType = btc.SigHash.ALL;
    tx.addInput(input); usedKinds.add(c.kind);
  }
  tx.addOutput({ script: runestone, amount: 0n });
  tx.addOutputAddress(to, BigInt(POSTAGE), btc.NETWORK);
  if (runeChange) tx.addOutputAddress(primary.address, BigInt(POSTAGE), btc.NETWORK);
  if (change > 330) tx.addOutputAddress(primary.address, BigInt(change), btc.NETWORK);
  for (const k of usedKinds) tx.sign(byKind[k].child.privateKey);
  tx.finalize();
  return { hex: tx.hex, txid: tx.id, feeSat: fee, feeBtc: fee / 1e8, rate, rateInfo,
    baseAmount: targetBase.toString(), runeChange, protectedCount, runeName,
    runestoneHex: Buffer.from(runestone).toString("hex") };
}
export async function sendRuneTransfer(phrase, opts) {
  const plan = await planRuneTransfer(phrase, opts);
  const txid = await broadcastBitcoinTx(plan.hex);
  return { ...plan, txid };
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
/** BlockCypher's address-balance shape (LTC/DOGE endpoints): amounts
 *  are satoshi-denominated; final_balance is the confirmed balance
 *  plus any unconfirmed change. Pure parser — throws on a bad shape
 *  so a garbled reply can never become a number. */
export function parseBlockcypherBalance(d) {
  const sat = d?.final_balance ?? d?.balance;
  if (sat == null || !Number.isFinite(Number(sat))) throw new Error("BlockCypher balance lookup failed.");
  return Number(sat) / 1e8;
}
/** BlockCypher balance read (coin = "ltc" | "doge"). BlockCypher
 *  answers from a browser Origin — verified live 2026-11-08 from the
 *  live Fluid origin, where dogechain/chain.so are CORS-blocked —
 *  which is why it is the fallback for both UTXO altcoin reads. */
async function blockcypherBalance(coin, address) {
  const res = await fetch(`https://api.blockcypher.com/v1/${coin}/main/addrs/${address}/balance`);
  if (!res.ok) throw new Error("BlockCypher balance lookup failed (HTTP " + res.status + ").");
  return parseBlockcypherBalance(await res.json());
}
export async function getLitecoinBalance(address) {
  try {
    const res = await fetch(`${LTC_API}/address/${address}`);
    const d = await res.json();
    const funded = d.chain_stats.funded_txo_sum + (d.mempool_stats?.funded_txo_sum || 0);
    const spent = d.chain_stats.spent_txo_sum + (d.mempool_stats?.spent_txo_sum || 0);
    return (funded - spent) / 1e8;
  } catch {
    // Fallback (see blockcypherBalance): both reads failing THROWS,
    // so the UI shows "couldn't load" instead of a fake zero.
    return blockcypherBalance("ltc", address);
  }
}
/** LTC fee rate, cross-checked (audit H1): litecoinspace's halfHourFee
 *  against BlockCypher's independent LTC fee stats (medium_fee_per_kb,
 *  converted to sat/vB), resolved + ceiling-clamped like Bitcoin's. */
export async function getLtcFeeRateInfo() {
  const [primary, secondary] = await Promise.all([
    _feeGrab(async () => { const r = await fetch(`${LTC_API}/v1/fees/recommended`); const d = await r.json(); return Number(d.halfHourFee); }),
    _feeGrab(async () => { const r = await fetch("https://api.blockcypher.com/v1/ltc/main"); const d = await r.json(); return Number(d.medium_fee_per_kb) / 1000; }),
  ]);
  return resolveFeeRate({ primary, secondary, ceiling: LTC_FEE_CEILING_SATVB, fallback: 1 });
}
export async function getLtcFeeRate() {
  return (await getLtcFeeRateInfo()).rate;
}
export function formatLitecoinSendIntent({ amount, to, feeLtc, feeUsd, note }) {
  return `Send ${amount} LTC to ${to} on Litecoin. Network fee about ${feeLtc} LTC${feeUsd ? ` (${feeUsd})` : ""}.${note ? ` Note: ${note}.` : ""} Confirm?`;
}
/** Relay an already-built, already-signed LTC transaction. */
export async function broadcastLitecoinTx(hex) {
  const post = await fetch(`${LTC_API}/tx`, { method: "POST", body: hex });
  if (!post.ok) throw new Error("Litecoin network rejected the transaction: " + (await post.text()));
  return post.text();
}
/** Build + sign an LTC payment WITHOUT broadcasting (see planBitcoinSend
 *  for the pattern; confirmed UTXOs only, like Bitcoin). */
export async function planLitecoinSend(phrase, { to, amountLtc, feeRate }) {
  const { child, address, script } = ltcKeys(phrase);
  if (!isValidLitecoinAddress(to)) throw new Error("That is not a valid Litecoin address.");
  let rateInfo = null;
  if (!feeRate) { rateInfo = await getLtcFeeRateInfo(); feeRate = rateInfo.rate; }
  const rate = feeRate;
  // NB: the Esplora UTXO route is the singular /utxo on BOTH
  // litecoinspace and mempool.space — the plural /utxos is a 404
  // plain-text body (re-verified live 2026-11-07; see fetchBtcUtxos).
  const res = await fetch(`${LTC_API}/address/${address}/utxo`);
  const utxos = (await res.json()).filter(u => u.status && u.status.confirmed === true)
    .sort((a, b) => b.value - a.value);
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
  return { hex: tx.hex, txid: tx.id, feeSat: fee, feeLtc: fee / 1e8, rate, rateInfo };
}
/** Build, sign and broadcast an LTC payment. Returns the txid. */
export async function sendLitecoin(phrase, opts) {
  const plan = await planLitecoinSend(phrase, opts);
  return broadcastLitecoinTx(plan.hex);
}

// ---------- Dogecoin (same seed, BIP44 legacy only, coin type 3) ----------
// Dogecoin has no SegWit in this wallet: legacy P2PKH (D… addresses,
// pubKeyHash 0x1e, scriptHash 0x16, WIF 0x9e), cross-checked against
// bitcoinjs-lib's Dogecoin params in scratch before shipping.
// SENDS (wired 2026-11-06, gap-closure build): the transaction is
// built and signed locally exactly like Litecoin's, except legacy
// P2PKH inputs carry the full previous transaction (nonWitnessUtxo)
// from dogechain's unspent list. The signed bytes are relayed RAW —
// no server ever builds or alters them — through two keyless public
// relays, both verified live 2026-11-06 with a locally-signed
// transaction spending a nonexistent UTXO: Bitcore's public API
// (api.bitcore.io, POST /api/DOGE/mainnet/tx/send) answered with the
// Dogecoin node's own "Missing inputs" rejection, and BlockCypher's
// raw-push endpoint (POST /v1/doge/main/txs/push — the push endpoint
// only; their /txs/send skeleton API builds server-side and stays
// forbidden) answered "Transaction … orphaned, missing reference …"
// quoting our exact txid. A signed test transaction built by this
// code is byte-identical to bitcoinjs-lib's output for the same
// inputs (pinned in tests). Signing was never the gap — the relay
// was; the earlier "no keyless raw broadcast exists" note is retired.
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
    return raw.length === 21 && (raw[0] === 0x1e || raw[0] === 0x16); // P2PKH (D…) or P2SH (A…)
  } catch { return false; }
}
// Dogecoin's dust limit is high (0.01 DOGE since Core 1.14.5): outputs
// below this are unspendable in practice, so it is the wallet minimum.
export const DOGE_MIN_OUTPUT = 0.01;
const DOGECHAIN_API = "https://dogechain.com/api";
export async function getDogecoinBalance(address) {
  try {
    const res = await fetch(`${DOGECHAIN_API}/v1/address/balance/${address}`);
    const d = await res.json();
    const bal = d?.balance ?? d?.data?.balance;
    if (bal == null) throw new Error("Dogecoin balance lookup failed.");
    return Number(bal);
  } catch {
    // dogechain is CORS-blocked from browsers (verified live
    // 2026-11-08: the request dies before any response is readable),
    // so in the shipped app this fallback IS the balance read.
    // BlockCypher answers from a browser Origin; chain.so does not
    // (also verified). Both sources failing THROWS, so the UI shows
    // "couldn't load" instead of the fake zero this replaces.
    return blockcypherBalance("doge", address);
  }
}
/** Live Dogecoin fee market (dogechain v3): the median koinu-per-byte
 *  recent transactions actually paid. sendDogecoin builds its fee
 *  from this; the sheet shows it in the intent sentence. */
export async function getDogeFeeInfo() {
  try {
    const res = await fetch(`${DOGECHAIN_API}/v3/fees`);
    const d = await res.json();
    return { medianSatByte: Number(d?.data?.fee_rate_koinu_per_byte?.median) || null, medianFeeDoge: Number(d?.data?.median_fee_paid) || null };
  } catch { return { medianSatByte: null, medianFeeDoge: null }; }
}
// Dogecoin's dust limit in its smallest unit (1 DOGE = 1e8 koinu).
export const DOGE_DUST_KOINU = 1_000_000;
/** Serialized size estimate for a legacy P2PKH transaction:
 *  10 bytes overhead + ~148 per input + ~34 per output. */
export function dogeTxSize(nIn, nOut) { return 10 + nIn * 148 + nOut * 34; }
/** PURE builder (unit-testable offline): assemble + sign a legacy
 *  P2PKH Dogecoin transaction from explicit inputs. utxos carry the
 *  full previous transaction hex (legacy signing needs it for the
 *  sighash). Change below the dust limit is folded into the fee
 *  rather than creating an unspendable output. Returns
 *  { hex, txid, feeKoinu (actual, after any dust fold), changeKoinu }. */
export function buildSignedDogeTx({ privateKey, utxos, to, amountKoinu, feeKoinu, changeAddress }) {
  if (!(amountKoinu >= DOGE_DUST_KOINU)) {
    throw new Error(`Dogecoin's minimum spendable output is ${DOGE_MIN_OUTPUT} DOGE — send at least that much.`);
  }
  const total = utxos.reduce((s, u) => s + u.valueKoinu, 0);
  let change = total - amountKoinu - feeKoinu;
  if (change < 0) throw new Error("Not enough confirmed DOGE to cover the amount plus network fee.");
  let actualFee = feeKoinu;
  if (change > 0 && change < DOGE_DUST_KOINU) { actualFee += change; change = 0; }
  const tx = new btc.Transaction({ version: 1 }); // Dogecoin's conventional tx version
  for (const u of utxos) {
    tx.addInput({ txid: u.txid, index: u.index, nonWitnessUtxo: hex.decode(u.txHex), sighashType: btc.SigHash.ALL });
  }
  tx.addOutputAddress(to, BigInt(amountKoinu), DOGE_NETWORK);
  if (change > 0) tx.addOutputAddress(changeAddress, BigInt(change), DOGE_NETWORK);
  tx.sign(privateKey);
  tx.finalize();
  return { hex: tx.hex, txid: tx.id, feeKoinu: actualFee, changeKoinu: change };
}
// Keyless RAW relays for the locally-signed bytes (see the section
// note for the live verification of both). Primary: Bitcore (BitPay's
// public infrastructure; its error text is the node's own). Fallback:
// BlockCypher's raw-push endpoint only — never their build-it-for-you
// skeleton API.
const DOGE_RELAYS = [
  { name: "Bitcore", url: "https://api.bitcore.io/api/DOGE/mainnet/tx/send", body: (txHex) => ({ rawTx: txHex }) },
  { name: "BlockCypher", url: "https://api.blockcypher.com/v1/doge/main/txs/push", body: (txHex) => ({ tx: txHex }) },
];
/** Relay a signed Dogecoin transaction hex through the public raw
 *  relays, primary first. Returns the name of the relay that accepted
 *  it; throws with both relays' answers when neither does. */
export async function broadcastDogeTx(txHex) {
  const errors = [];
  for (const relay of DOGE_RELAYS) {
    try {
      const res = await fetch(relay.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(relay.body(txHex)), signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return relay.name;
      errors.push(`${relay.name}: ${(await res.text().catch(() => "")).trim().slice(0, 160) || "HTTP " + res.status}`);
    } catch (e) { errors.push(`${relay.name}: ${e.message}`); }
  }
  throw new Error("Dogecoin relays rejected the transaction — " + errors.join(" · "));
}
export function formatDogeSendIntent({ amount, to, feeDoge, feeUsd, note }) {
  return `Send ${amount} DOGE to ${to} on Dogecoin. Network fee about ${feeDoge} DOGE${feeUsd ? ` (${feeUsd})` : ""}.${note ? ` Note: ${note}.` : ""} Confirm?`;
}
/* Dogecoin's fee quote is dogechain's median of what recent transactions
 * actually paid — an aggregate, not a single oracle's say-so — but it is
 * still network input, so it is floored AND ceiling-clamped (audit H1
 * pattern). 100,000 koinu/byte = 0.001 DOGE/byte: a typical 226-byte
 * transaction would pay ≈0.23 DOGE at the ceiling, far above the live
 * market (~0.01–0.05 DOGE total) — anything above it is a bad quote,
 * not a real fee. */
export const DOGE_FEE_CEILING_KOINU_BYTE = 100000;
export function resolveDogeFeeRate(medianKoinuByte) {
  let rate = Math.max(1000, Math.floor(Number(medianKoinuByte) || 10000));
  let clamped = false;
  if (rate > DOGE_FEE_CEILING_KOINU_BYTE) { rate = DOGE_FEE_CEILING_KOINU_BYTE; clamped = true; }
  return { rate, clamped };
}
/** Build + sign a DOGE payment WITHOUT broadcasting, so the review
 *  sheet shows the EXACT fee (dogechain rate × actual selected inputs);
 *  confirming relays these exact bytes. UTXOs come from dogechain's
 *  unspent list (confirmed only, largest first). */
export async function planDogecoinSend(phrase, { to, amountDoge, feeRateKoinuByte = null }) {
  const { child, address } = dogeKeys(phrase);
  if (!isValidDogeAddress(to)) throw new Error("That is not a valid Dogecoin address.");
  const amountKoinu = Math.round(Number(amountDoge) * 1e8);
  if (!(amountKoinu >= DOGE_DUST_KOINU)) {
    throw new Error(`Dogecoin's minimum spendable output is ${DOGE_MIN_OUTPUT} DOGE — send at least that much.`);
  }
  const { rate, clamped } = resolveDogeFeeRate(feeRateKoinuByte ?? (await getDogeFeeInfo()).medianSatByte);
  const res = await fetch(`${DOGECHAIN_API}/v1/address/unspent/${address}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  const raw = Array.isArray(data?.unspent_outputs) ? data.unspent_outputs : [];
  const utxos = raw
    .filter(u => (u.confirmations ?? 0) >= 1 && u.tx_hex && u.tx_hash)
    .map(u => ({ txid: u.tx_hash, index: u.tx_output_n, valueKoinu: Number(u.value), txHex: u.tx_hex }))
    .sort((a, b) => b.valueKoinu - a.valueKoinu);
  if (!utxos.length) throw new Error("No confirmed DOGE available to spend yet.");
  const picked = []; let sum = 0, feeKoinu = 0;
  for (const u of utxos) {
    picked.push(u); sum += u.valueKoinu;
    feeKoinu = rate * dogeTxSize(picked.length, 2);
    if (sum >= amountKoinu + feeKoinu) break;
  }
  if (sum < amountKoinu + feeKoinu) throw new Error("Not enough confirmed DOGE to cover the amount plus network fee.");
  const built = buildSignedDogeTx({ privateKey: child.privateKey, utxos: picked, to, amountKoinu, feeKoinu, changeAddress: address });
  return { hex: built.hex, txid: built.txid, feeDoge: built.feeKoinu / 1e8, feeKoinu: built.feeKoinu, rateKoinuByte: rate, clamped };
}
/** Build, sign and broadcast a DOGE payment (plan + raw relay).
 *  Returns { txid, feeDoge, route }. */
export async function sendDogecoin(phrase, opts) {
  const plan = await planDogecoinSend(phrase, opts);
  const route = await broadcastDogeTx(plan.hex);
  return { txid: plan.txid, feeDoge: plan.feeDoge, route };
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
export function formatBitcoinCashSendIntent({ amount, to, feeBch, feeUsd, note }) {
  return `Send ${amount} BCH to ${to} on Bitcoin Cash. Network fee about ${feeBch} BCH${feeUsd ? ` (${feeUsd})` : ""}.${note ? ` Note: ${note}.` : ""} Confirm?`;
}
/** Build + sign a BCH payment WITHOUT broadcasting, so the review sheet
 *  shows the EXACT fee (BCH pays a fixed 1 sat/byte — no oracle is
 *  involved, but the fee still depends on the selected inputs).
 *  Confirming relays these exact bytes. */
export async function planBitcoinCashSend(phrase, { to, amountBch }) {
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
  return { hex, txid, feeSat: fee, feeBch: fee / 1e8 };
}
/** Relay an already-built, already-signed BCH transaction. */
export async function broadcastBitcoinCashTx(hex, fallbackTxid) {
  const post = await fetch(`${HASKOIN_BCH}/transactions`, {
    method: "POST", headers: { "Content-Type": "text/plain" }, body: hex,
  });
  if (!post.ok) throw new Error("Bitcoin Cash network rejected the transaction: " + (await post.text()));
  const d = await post.json().catch(() => null);
  return d?.txid || fallbackTxid;
}
/** Build, sign and broadcast a BCH payment (1 sat/byte fee). Returns the txid. */
export async function sendBitcoinCash(phrase, opts) {
  const plan = await planBitcoinCashSend(phrase, opts);
  return broadcastBitcoinCashTx(plan.hex, plan.txid);
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
 *  null), then the TRC-20 tokens. A failed NATIVE read fails the
 *  whole lookup (the caller marks every curated row unknown); a
 *  failed token read marks only that row unknown (amount null). */
export async function getTronBalances(address) {
  if (!isValidTronAddress(address)) throw new Error("That is not a valid Tron address.");
  const out = [{ symbol: "TRX", amount: "0", address: null, decimals: 6 }];
  const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Tron balance lookup failed (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  const acct = data && Array.isArray(data.data) ? data.data[0] : null;
  out[0].amount = tronSunToTrx((acct && acct.balance) ?? 0); // no account on-chain yet = 0
  for (const t of TRON_TOKENS) {
    // A failed token read marks the row unknown (amount null — the
    // UI renders "couldn't load"), never a fake zero; the native
    // balance above still stands on its own read.
    const row = { symbol: t.symbol, amount: null, address: t.address, decimals: t.decimals };
    try {
      const raw = await tronTrc20Balance(address, t);
      row.amount = ethers.formatUnits(raw, t.decimals);
    } catch { /* stays null — unknown, not zero */ }
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

/** Keyless public Solana RPCs, tried in order. ORDER MATTERS
 *  (revised 2026-11-08): PublicNode goes FIRST because it is the
 *  endpoint that actually serves browsers — the canonical
 *  mainnet-beta endpoint answers every request carrying a browser
 *  Origin header with HTTP 403 "Access forbidden", so from the app
 *  (a browser page) it only ever burns a round-trip before the
 *  fall-through; it stays on the list as the fallback for
 *  non-browser contexts, where it works fine. PublicNode refuses
 *  INDEXED methods (getTokenAccountsByOwner, getTokenAccountBalance)
 *  without a personal token, so every curated token read below is
 *  built on plain getAccountInfo of the locally derived ATA — the
 *  indexed methods survive only in the best-effort full scan
 *  (getSolanaAllTokens). solana.drpc.org was dropped: it no longer
 *  serves Solana on its free plan at all (HTTP 400 on every
 *  method). The last endpoint that answered is tried first next
 *  time. */
const SOLANA_RPCS = ["https://solana-rpc.publicnode.com", SOLANA_RPC];
let _solRpcGood = 0;
async function solanaRpc(method, params) {
  let lastErr = null;
  for (let n = 0; n < SOLANA_RPCS.length; n++) {
    const idx = (_solRpcGood + n) % SOLANA_RPCS.length;
    try {
      const res = await fetch(SOLANA_RPCS[idx], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error("Solana network error (HTTP " + res.status + ").");
      const data = await res.json().catch(() => null);
      if (!data) throw new Error("Solana returned an unreadable reply.");
      if (data.error) throw new Error("Solana rejected the request: " + (data.error.message || "unknown error"));
      _solRpcGood = idx;
      return data.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Solana network error.");
}
/** Solana balances shaped like getBalances(): native SOL first (address
 *  null), then the SPL tokens. Token reads go through the ATAs
 *  (plain getAccountInfo — see solanaMintRawBalance), NOT the
 *  indexed getTokenAccountsByOwner the keyless endpoints refuse. A
 *  token whose read fails on every endpoint gets amount null — the
 *  codebase's "balance unknown" marker (the row renders "couldn't
 *  load" and stays out of totals) — never a fake zero; the native
 *  balance still stands. */
export async function getSolanaBalances(address) {
  if (!isValidSolanaAddress(address)) throw new Error("That is not a valid Solana address.");
  const out = [{ symbol: "SOL", amount: "0", address: null, decimals: 9 }];
  const bal = await solanaRpc("getBalance", [address]);
  out[0].amount = solLamportsToSol((bal && bal.value) ?? 0); // no account on-chain yet = 0
  for (const t of SOLANA_TOKENS) {
    const row = { symbol: t.symbol, amount: "0", address: t.address, decimals: t.decimals, program: SOLANA_PROGRAMS.token };
    try {
      const held = await solanaMintRawBalance(address, t.address);
      row.amount = ethers.formatUnits(held.raw, t.decimals);
      row.program = held.program;
    } catch { row.amount = null; /* every endpoint refused — unknown, not zero */ }
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
/** The raw amount in an SPL token account's data bytes, or null
 *  when the bytes are too short to hold one. The token-account
 *  layout is mint (32) | owner (32) | amount (u64 little-endian at
 *  byte offset 64); a legacy token account is exactly 165 bytes and
 *  Token-2022 accounts share the same prefix. Exported for tests. */
export function parseSolanaTokenAccountAmount(bytes) {
  if (!bytes || bytes.length < 72) return null;
  return new DataView(bytes.buffer, bytes.byteOffset + 64, 8).getBigUint64(0, true);
}
/** One token account's raw balance via getAccountInfo of its ATA —
 *  a PLAIN (non-indexed) read, because the keyless endpoints that
 *  serve browsers refuse the indexed token methods
 *  (getTokenAccountsByOwner / getTokenAccountBalance) outright.
 *  Returns the raw amount, 0n when the account does not exist (a
 *  true zero — nothing was ever held under that program), and
 *  THROWS when no endpoint answers, so no caller ever mistakes a
 *  transport failure for an empty account. The account's own mint
 *  and owner fields are checked before its amount is trusted. */
async function solanaAtaRawBalance(ownerAddress, mintAddress, programId) {
  const ata = solanaAtaAddress(ownerAddress, mintAddress, programId);
  const r = await solanaRpc("getAccountInfo", [ata, { encoding: "base64" }]);
  if (!r || !r.value) return 0n;
  if (r.value.owner && r.value.owner !== programId) return 0n;
  const data = Array.isArray(r.value.data) ? r.value.data[0] : null;
  if (typeof data !== "string" || !data) return 0n;
  const bytes = base64.decode(data);
  if (base58.encode(bytes.slice(0, 32)) !== mintAddress) return 0n;
  if (base58.encode(bytes.slice(32, 64)) !== ownerAddress) return 0n;
  return parseSolanaTokenAccountAmount(bytes) ?? 0n;
}
/** A mint's balance for an owner across BOTH token programs, read
 *  via the ATAs: probe the legacy Token program first, then
 *  Token-2022 — the program whose ATA holds funds is the mint's
 *  program (a mint lives under exactly one). Returns { raw,
 *  program }; throws when no endpoint answers. */
async function solanaMintRawBalance(ownerAddress, mintAddress) {
  const legacy = await solanaAtaRawBalance(ownerAddress, mintAddress, SOLANA_PROGRAMS.token);
  if (legacy > 0n) return { raw: legacy, program: SOLANA_PROGRAMS.token };
  const t22 = await solanaAtaRawBalance(ownerAddress, mintAddress, SOLANA_PROGRAMS.token2022);
  if (t22 > 0n) return { raw: t22, program: SOLANA_PROGRAMS.token2022 };
  return { raw: 0n, program: SOLANA_PROGRAMS.token };
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
    // Held-check via the ATA's own account data (plain getAccountInfo):
    // getTokenAccountBalance is an indexed read the keyless endpoints
    // refuse, and a refused read must never pose as "you hold none" —
    // a missing ATA is the true zero; a transport failure throws.
    const held = await solanaAtaRawBalance(fromAddr, token.address, program);
    if (held < raw) throw new Error(`Not enough ${token.symbol || "tokens"} on Solana (you have ${ethers.formatUnits(held, token.decimals ?? 6)}).`);
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

// ---------- Stellar (SLIP-0010 Ed25519 branch, coin type 148) ----------
// Stellar keys are Ed25519 — the same curve family as Solana/Sui — so
// Stellar reuses deriveSlip10Ed25519 at m/44'/148'/0' (Stellar's coin
// type 148; the path stops at the account level — that IS the Stellar
// standard, the one Ledger/Trezor use). The address is a StrKey:
//   base32(0x30 || pubkey || CRC16-XModem(0x30 || pubkey)), no padding
// where version byte 0x30 is why every address starts with "G".
// Derivation and the StrKey codec are cross-checked against
// @stellar/stellar-sdk (Keypair.fromRawEd25519Seed, StrKey) in tests.
//
// Stellar's account model differs from every family above, and the
// code below enforces those differences instead of papering over them:
//  • Accounts do not exist until funded with ≥ 1 XLM. A Horizon 404 is
//    a STATE ("not yet activated"), never an error, never a fake zero.
//  • An account can only RECEIVE an asset it has opted into with a
//    trustline — asset sends check the recipient's trustlines first.
//  • Every account must keep a minimum XLM reserve of
//    (2 + subentry_count) × 0.5 XLM; sends that would breach it are
//    blocked before anything is signed.
// Reads and submission ride plain fetch against Horizon (house style);
// the SDK is used for what it must be used for — account/transaction
// construction and local signing.
const STELLAR_HORIZON = "https://horizon.stellar.org";
export const STELLAR_EXPLORER = "https://stellar.expert/explorer/public";
// Circle's USDC issuer on Stellar — verified live 2026-11-06 against
// horizon.stellar.org/assets?asset_code=USDC&asset_issuer=<this>:
// exactly one asset record (credit_alphanum4), ~2.53M authorized
// accounts. This (code, issuer) pair is the ONLY verified Stellar
// asset in Fluid; every other trustline is unverified by default.
export const STELLAR_USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const STELLAR_USDC = { symbol: "USDC", code: "USDC", issuer: STELLAR_USDC_ISSUER, decimals: 7 };
const STELLAR_BASE_RESERVE_STROOPS = 5000000n;  // 0.5 XLM
const STELLAR_MIN_CREATE_STROOPS = 10000000n;   // 1 XLM

/** The wallet's Stellar private seed: BIP39 seed → m/44'/148'/0'. */
export function stellarSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 148, 0]).key;
}
function stellarKeypair(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return StellarKeypair.fromRawEd25519Seed(stellarSeedFromSeed(mnemonicToSeedSync(clean)));
}
/** CRC16-XModem (poly 0x1021, init 0) — the StrKey checksum. */
export function crc16Xmodem(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
const STRKEY_VERSION_ED25519_PUBLIC = 0x30; // 6 << 3 — renders as "G…"
/** StrKey-encode a 32-byte Ed25519 public key into a "G…" address. */
export function strKeyEncodeEd25519(pubkey) {
  const payload = Uint8Array.from([STRKEY_VERSION_ED25519_PUBLIC, ...pubkey]);
  const crc = crc16Xmodem(payload);
  return base32.encode(Uint8Array.from([...payload, crc & 0xff, (crc >> 8) & 0xff])).replace(/=+$/, "");
}
/** Decode a "G…" StrKey back to its 32-byte public key, verifying the
 *  version byte and the CRC16 checksum. Null for anything else —
 *  including "S…" secret seeds, which carry a different version byte
 *  and must never be accepted as an address. */
export function strKeyDecodeEd25519(address) {
  try {
    const s = String(address || "").trim().toUpperCase().replace(/=+$/, "");
    const raw = base32.decode(s + "=".repeat((8 - (s.length % 8)) % 8));
    if (raw.length !== 35 || raw[0] !== STRKEY_VERSION_ED25519_PUBLIC) return null;
    const crc = crc16Xmodem(raw.slice(0, 33));
    if (raw[33] !== (crc & 0xff) || raw[34] !== ((crc >> 8) & 0xff)) return null;
    return raw.slice(1, 33);
  } catch { return null; }
}
/** Stellar address (StrKey "G…") for a raw BIP39 seed. */
export function stellarAddressFromSeed(seed) {
  return strKeyEncodeEd25519(ed25519.getPublicKey(stellarSeedFromSeed(seed)));
}
/** The Stellar address of the wallet's main account. */
export function stellarAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return stellarAddressFromSeed(mnemonicToSeedSync(clean));
}
/** A valid Stellar destination: a checksummed "G…" StrKey. */
export function isValidStellarAddress(address) {
  return strKeyDecodeEd25519(address) !== null;
}
export function xlmToStroops(amount) { return ethers.parseUnits(String(amount), 7); }
export function stroopsToXlm(stroops) { return ethers.formatUnits(BigInt(stroops), 7); }
/** Minimum XLM balance an account with `subentryCount` subentries
 *  (trustlines, offers, …) must keep: (2 + subentries) × 0.5 XLM. */
export function stellarMinBalanceStroops(subentryCount) {
  return (2n + BigInt(subentryCount || 0)) * STELLAR_BASE_RESERVE_STROOPS;
}
export function stellarMinBalanceXlm(subentryCount) {
  return stroopsToXlm(stellarMinBalanceStroops(subentryCount));
}

async function horizonJson(path) {
  const res = await fetch(STELLAR_HORIZON + path, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
/** The Horizon account record, or null when Horizon says 404 — the
 *  account simply doesn't exist yet (unfunded). Other failures throw.
 *  In-flight reads are DEDUPED per address: the app's double render
 *  used to fire two identical account requests, and when the
 *  duplicate was aborted the load was flagged failed even though the
 *  surviving read succeeded — a false "couldn't load" badge on a
 *  healthy (e.g. brand-new, unfunded) account. One shared request
 *  means every concurrent caller sees the same single outcome. */
const stellarAccountInflight = new Map(); // address -> Promise<record|null>
async function stellarFetchAccount(address) {
  const existing = stellarAccountInflight.get(address);
  if (existing) return existing;
  const p = (async () => {
    const { status, data } = await horizonJson("/accounts/" + address);
    if (status === 404) return null;
    if (status !== 200 || !data) throw new Error("Stellar network error (HTTP " + status + ").");
    return data;
  })();
  stellarAccountInflight.set(address, p);
  try { return await p; } finally { stellarAccountInflight.delete(address); }
}
/** Recommended base fee (stroops per operation): the fee_stats
 *  fee_charged p50 — the same figure the SDK's fetchBaseFee returns —
 *  floored at the 100-stroop network base fee. */
export async function stellarBaseFeeStroops() {
  try {
    const { status, data } = await horizonJson("/fee_stats");
    const p50 = BigInt(data?.fee_charged?.p50 ?? 0);
    return p50 > 100n ? p50 : 100n;
  } catch { return 100n; }
}
function stellarNativeRow(amount) {
  return { symbol: "XLM", name: "Stellar Lumens", amount, address: null, assetCode: null, issuer: null, decimals: 7, verified: true };
}
function stellarTrustlineRow(b) {
  if (b.asset_type === "liquidity_pool_shares") {
    return { symbol: "LP", name: "Liquidity pool shares", amount: b.balance, address: "lp:" + (b.liquidity_pool_id || ""),
      assetCode: null, issuer: null, decimals: 7, verified: false, priceUsd: null, lpShare: true };
  }
  const code = b.asset_code, issuer = b.asset_issuer;
  const isUsdc = code === STELLAR_USDC.code && issuer === STELLAR_USDC.issuer;
  return {
    symbol: code, name: isUsdc ? "USD Coin" : `${code} · ${issuer.slice(0, 4)}…${issuer.slice(-4)}`,
    amount: b.balance, address: code + ":" + issuer, assetCode: code, issuer, decimals: 7,
    verified: isUsdc, priceUsd: isUsdc ? 1 : null,
  };
}
/** The full Stellar account state: activation, reserve and EVERY
 *  balance — native XLM plus all trustlines, verified or not (the
 *  universal-token rule: everything the account holds is surfaced).
 *  An unfunded account returns funded:false with a zero XLM row —
 *  the UI renders the activation state, not an error. */
export async function getStellarAccount(address) {
  if (!isValidStellarAddress(address)) throw new Error("That is not a valid Stellar address.");
  const rec = await stellarFetchAccount(address);
  if (!rec) {
    return { funded: false, subentryCount: 0, minBalanceXlm: stellarMinBalanceXlm(0), balances: [stellarNativeRow("0")] };
  }
  const balances = [stellarNativeRow((rec.balances || []).find(b => b.asset_type === "native")?.balance ?? "0")];
  for (const b of rec.balances || []) if (b.asset_type !== "native") balances.push(stellarTrustlineRow(b));
  return { funded: true, subentryCount: rec.subentry_count || 0, minBalanceXlm: stellarMinBalanceXlm(rec.subentry_count || 0), balances };
}
/** Stellar balances shaped like the other families' row lists. */
export async function getStellarBalances(address) {
  return (await getStellarAccount(address)).balances;
}
/** Read-only pre-flight for the send sheet (mirrors solanaSendPlan):
 *  what the destination's state means for this send, plus the fee —
 *  so the intent sentence can say "this creates the account" before
 *  anything is signed. Best-effort: unknown states come back null and
 *  sendStellar re-checks everything authoritatively anyway. */
export async function stellarSendPlan(fromAddress, { to, token = null } = {}) {
  const plan = { feeXlm: null, senderFunded: null, destFunded: null, destHasTrustline: null, senderXlm: null, minBalanceXlm: null };
  try { plan.feeXlm = stroopsToXlm(await stellarBaseFeeStroops()); } catch { /* stays null */ }
  try {
    const sender = await stellarFetchAccount(fromAddress);
    plan.senderFunded = !!sender;
    if (sender) {
      plan.senderXlm = (sender.balances || []).find(b => b.asset_type === "native")?.balance ?? "0";
      plan.minBalanceXlm = stellarMinBalanceXlm(sender.subentry_count || 0);
    }
  } catch { /* stays null */ }
  try {
    const dest = await stellarFetchAccount(to);
    plan.destFunded = !!dest;
    if (dest && token) {
      plan.destHasTrustline = (dest.balances || []).some(b => b.asset_code === token.code && b.asset_issuer === token.issuer);
    }
  } catch { /* stays null */ }
  return plan;
}
/** The signer principle, Stellar edition: a sentence, never a blob. */
export function formatStellarSendIntent({ amount, symbol, to, feeXlm, createsAccount = false }) {
  let s = `Send ${amount} ${symbol} to ${to} on Stellar.`;
  if (createsAccount) s += " This creates the recipient's account — Stellar accounts only exist once they hold at least 1 XLM.";
  if (feeXlm != null) s += ` Network fee ≈ ${feeXlm} XLM.`;
  return s + " Confirm?";
}
function stellarParseAmount(amount) {
  try { return xlmToStroops(amount); }
  catch { throw new Error("Stellar amounts can have at most 7 decimal places."); }
}
/** Build, sign LOCALLY with the derived Stellar keypair, and submit a
 *  payment (or an account creation, when XLM goes to an unfunded
 *  address). `token` is null for native XLM, otherwise the row's
 *  {code, issuer}. Every Stellar rule — activation, trustlines,
 *  minimum reserve — is enforced here in code before signing, with a
 *  plain message, whatever the UI showed. Returns {hash}. */
export async function sendStellar(phrase, { to, amount, token = null }) {
  if (!isValidStellarAddress(to)) throw new Error("That is not a valid Stellar address (it starts with G).");
  const kp = stellarKeypair(phrase);
  const from = kp.publicKey();
  const sender = await stellarFetchAccount(from);
  if (!sender) throw new Error("Your Stellar account isn't activated yet — it needs to receive at least 1 XLM before it can send.");
  const dest = await stellarFetchAccount(to);
  const fee = await stellarBaseFeeStroops();
  const minBal = stellarMinBalanceStroops(sender.subentry_count || 0);
  const senderXlm = xlmToStroops((sender.balances || []).find(b => b.asset_type === "native")?.balance ?? "0");
  const reserveMsg = `That would leave your account below its minimum reserve of ${stroopsToXlm(minBal)} XLM — Stellar accounts must always keep that much XLM. Lower the amount.`;
  const tb = new StellarTxBuilder(new StellarAccount(from, String(sender.sequence)), {
    fee: fee.toString(), networkPassphrase: StellarNetworks.PUBLIC,
  });
  if (!token) {
    const amt = stellarParseAmount(amount);
    if (amt <= 0n) throw new Error("Enter an amount.");
    if (!dest) {
      // Sending XLM to an address that has never held any CREATES the
      // account — and an account's own minimum balance is 1 XLM, so a
      // smaller creation is invalid on the network, not just unwise.
      if (amt < STELLAR_MIN_CREATE_STROOPS) {
        throw new Error("That Stellar account doesn't exist yet, so this send would create it — and creating an account needs a starting balance of at least 1 XLM.");
      }
      tb.addOperation(StellarOperation.createAccount({ destination: to, startingBalance: stroopsToXlm(amt) }));
    } else {
      tb.addOperation(StellarOperation.payment({ destination: to, asset: StellarAsset.native(), amount: stroopsToXlm(amt) }));
    }
    if (senderXlm - amt - fee < minBal) throw new Error(reserveMsg);
  } else {
    const raw = stellarParseAmount(amount);
    if (raw <= 0n) throw new Error("Enter an amount.");
    if (!dest) {
      throw new Error(`The recipient's Stellar account isn't activated yet (it has never received XLM), so it can't hold ${token.code} yet. They need to receive at least 1 XLM first.`);
    }
    const tl = (dest.balances || []).find(b => b.asset_code === token.code && b.asset_issuer === token.issuer);
    if (!tl) {
      throw new Error(`The recipient can't receive ${token.code} yet — on Stellar, an account can only hold an asset it has opted into with a trustline, and this account has no trustline for ${token.code}.`);
    }
    const held = (sender.balances || []).find(b => b.asset_code === token.code && b.asset_issuer === token.issuer);
    if (!held || raw > xlmToStroops(held.balance)) {
      throw new Error(`Not enough ${token.code} on Stellar (you have ${held ? held.balance : "0"}).`);
    }
    tb.addOperation(StellarOperation.payment({ destination: to, asset: new StellarAsset(token.code, token.issuer), amount: stroopsToXlm(raw) }));
    if (senderXlm - fee < minBal) throw new Error(reserveMsg);
  }
  const tx = tb.setTimeout(120).build();
  tx.sign(kp);
  const res = await fetch(STELLAR_HORIZON + "/transactions", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "tx=" + encodeURIComponent(tx.toXDR()),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.hash) {
    const codes = data?.extras?.result_codes;
    const detail = codes ? [codes.transaction, ...(codes.operations || [])].filter(Boolean).join(", ") : "HTTP " + res.status;
    throw new Error("Stellar rejected the transaction (" + detail + ").");
  }
  return { hash: data.hash };
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
// SECOND Injective difference, found by the gap-closure build's
// mandated @injectivelabs/sdk-ts cross-check (2026-11-06): Injective
// account bytes are ETHEREUM-style — the last 20 bytes of
// keccak256(uncompressed pubkey), i.e. the account's 0x address bytes
// — NOT the family's hash160. The chain's own account record proves
// it: the test seed's pubkey is stored on injective-1 under the
// eth-derived address with the ethsecp256k1 pubkey type. Fluid
// originally printed the hash160 address for Injective (a receive
// trap: that address is not the account this key controls there);
// fixed in the same build, still with no user balances anywhere.
// Denoms, chain ids, prefixes and average gas prices were verified
// 2026-11-06 against the chain registry (github.com/cosmos/chain-registry)
// and live endpoint reads; INJ and DYDX use 18-decimal base denoms
// (inj, adydx), the rest 6. Endpoints: cosmos.directory public REST for
// balance reads (all seven verified live), cosmos.directory RPC for
// signing clients — except Sei, whose directory RPC was down (HTTP 502)
// at build time, so Sei sends ride the Sei team's own rpc.sei-apis.com
// (verified live, POST included).
// Injective SENDS (wired 2026-11-06, gap-closure build): stock
// CosmJS cannot sign for Injective — its accounts are
// /injective.types.v1beta1.EthAccount, the signer pubkey must encode
// as /injective.crypto.v1beta1.ethsecp256k1.PubKey, and the signature
// digest is keccak256(SignDoc bytes), Ethereum-style, not the Cosmos
// sha256. The hand-rolled signer below (buildInjectiveSignedTx)
// assembles TxBody/AuthInfo/SignDoc with the cosmjs-types codecs and
// signs with @noble secp256k1 over the keccak digest. VALIDATION:
// for identical inputs its output is BYTE-IDENTICAL to
// @injectivelabs/sdk-ts's createTransaction + PrivateKey.sign —
// signature included (RFC6979 makes both deterministic) — and that
// exact transaction, simulated live against injective-1 through the
// chain's LCD, was accepted through decoding and the account/fee
// ante stages and failed ONLY at funds ("spendable balance 1inj is
// smaller than 16000000000000inj", fee.go:236 — the test account
// holds exactly 1 wei). Honest limit of that proof: Injective's
// simulate skips signature verification (proven with corrupted- and
// empty-signature controls, which reach the same stage), and its
// CheckTx ante checks the fee BEFORE the signature, so no live
// endpoint will verify a signature for an account that cannot pay a
// fee — byte-identity with the chain's own reference SDK is the
// load-bearing evidence, and it is pinned in tests.
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
  { key: "injective", name: "Injective", chainId: "injective-1", prefix: "inj", denom: "inj", symbol: "INJ", decimals: 18, gasPrice: "160000000inj", coinType: 60,
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

/** ---------- Receive view: network selector metadata + search ----------
 *  The Receive sheet is a picker, not a scroll: one entry per network the
 *  wallet can receive on, each with the spoken/short names people actually
 *  search by ("btc", "ln", "doge"…). The app pairs each id with that
 *  network's existing receive panel; this table is only names + aliases,
 *  so it is unit-testable without any UI. EVM is ONE entry on purpose —
 *  every EVM network shares a single receive address. The Cosmos entries
 *  are generated from COSMOS_CHAINS so the two can never drift apart. */
const COSMOS_RECEIVE_ALIASES = {
  cosmoshub: ["atom", "cosmos hub"],
  osmosis: ["osmo"],
  noble: ["usdc", "noble usdc"],
  celestia: ["tia"],
  injective: ["inj"],
  sei: ["sei"],
  dydx: ["dydx"],
};
export const RECEIVE_NETWORKS = [
  { id: "evm", name: "EVM networks", sub: "one address · all 15 networks",
    aliases: ["evm", "eth", "ethereum", "bsc", "bnb", "bnb chain", "binance smart chain", "base", "polygon", "matic", "arbitrum", "optimism", "avalanche", "avax"] },
  { id: "bitcoin", name: "Bitcoin", aliases: ["btc", "bitcoin", "taproot"] },
  { id: "lightning", name: "Bitcoin Lightning", sub: "via your own Lightning wallet",
    aliases: ["lightning", "ln", "lnurl", "webln", "sats"] },
  { id: "tron", name: "Tron", aliases: ["trx", "tron", "trc20"] },
  { id: "solana", name: "Solana", aliases: ["sol", "solana", "spl"] },
  { id: "sui", name: "Sui", aliases: ["sui"] },
  { id: "stellar", name: "Stellar", aliases: ["xlm", "stellar"] },
  { id: "ton", name: "TON", aliases: ["ton", "the open network", "jetton", "jettons"] },
  { id: "near", name: "NEAR", aliases: ["near"] },
  { id: "algorand", name: "Algorand", aliases: ["algo", "algorand", "asa"] },
  { id: "xrpl", name: "XRP Ledger", aliases: ["xrp", "xrpl", "ripple", "xrp ledger"] },
  { id: "polkadot", name: "Polkadot Asset Hub", aliases: ["dot", "polkadot", "asset hub"] },
  { id: "aptos", name: "Aptos", aliases: ["apt", "aptos"] },
  { id: "stacks", name: "Stacks", aliases: ["stx", "stacks"] },
  { id: "litecoin", name: "Litecoin", aliases: ["ltc", "litecoin"] },
  { id: "dogecoin", name: "Dogecoin", aliases: ["doge", "dogecoin"] },
  { id: "bitcoincash", name: "Bitcoin Cash", aliases: ["bch", "bitcoin cash", "bitcoincash"] },
  ...COSMOS_CHAINS.map(c => ({
    id: c.key, name: c.name, sub: "Cosmos",
    aliases: [c.symbol.toLowerCase(), c.name.toLowerCase(), "cosmos", ...(COSMOS_RECEIVE_ALIASES[c.key] || [])],
  })),
];
/** Does one receive-network entry match a search-box query? Matches the
 *  display name as a substring, or any alias exactly / as a prefix / as a
 *  substring — so "btc" finds Bitcoin (but not Bitcoin Cash, which claims
 *  no "btc"-ish alias), "ln" and "lightning" find Lightning, and "cosmos"
 *  finds the whole Cosmos family. Blank query matches everything. */
export function receiveNetworkMatches(meta, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  if (String(meta.name || "").toLowerCase().includes(q)) return true;
  return (meta.aliases || []).some(a => {
    const al = String(a).toLowerCase();
    return al === q || al.startsWith(q) || al.includes(q);
  });
}
export function filterReceiveNetworks(query, metas = RECEIVE_NETWORKS) {
  return metas.filter(m => receiveNetworkMatches(m, query));
}

function cosmosKeys(phrase, coinType = 118) {
  const seed = mnemonicToSeedSync(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/${coinType}'/0'/0/0`);
  return { child, accountBytes: ripemd160(sha256(child.publicKey)) }; // hash160 of the compressed pubkey
}
/** Injective's account bytes for a compressed pubkey: Ethereum-style
 *  — the last 20 bytes of keccak256(uncompressed pubkey), the same
 *  bytes as the account's 0x address. Cross-checked against
 *  @injectivelabs/sdk-ts and ethers.computeAddress (see tests) and
 *  against the account record the chain itself stores for the test
 *  seed's pubkey. Every other Cosmos chain uses hash160. */
export function injectiveAddressBytes(compressedPub) {
  const uncompressed = secp256k1.Point.fromHex(hex.encode(compressedPub)).toBytes(false);
  return keccak_256(uncompressed.slice(1)).slice(-20);
}
/** The account bytes one Cosmos chain expects for this wallet's key:
 *  hash160 everywhere except Injective (Ethereum-style, above). */
export function cosmosAccountBytes(phrase, chain) {
  const { child, accountBytes } = cosmosKeys(phrase, cosmosCoinType(chain));
  return chain.key === "injective" ? injectiveAddressBytes(child.publicKey) : accountBytes;
}
/** The wallet's address on one Cosmos chain (bech32 of that chain's
 *  account bytes under its prefix — shared at 118 for six chains,
 *  Injective's own at 60). */
export function cosmosAddress(phrase, chainKey) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  return bech32.encode(chain.prefix, bech32.toWords(cosmosAccountBytes(phrase, chain)));
}
/** Every Cosmos address of this wallet: { chainKey: address }.
 *  Derives once per distinct account (118 shared + Injective's 60). */
export function cosmosAddresses(phrase) {
  const byAcct = new Map();
  const wordsFor = (chain) => {
    const k = chain.key === "injective" ? "injective" : String(cosmosCoinType(chain));
    if (!byAcct.has(k)) byAcct.set(k, bech32.toWords(cosmosAccountBytes(phrase, chain)));
    return byAcct.get(k);
  };
  return Object.fromEntries(COSMOS_CHAINS.map(c => [c.key, bech32.encode(c.prefix, wordsFor(c))]));
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
/** Which token a Cosmos chain's send sheet starts with. The native
 *  denom is the default in EVERY balance state — a populated token
 *  list that lacks it, an EMPTY list, and no list at all (QA
 *  2026-11-07: an empty array on a fresh wallet left the selection
 *  null and every review died with "No token selected."). A populated
 *  list keeps the native entry when present, else its first token —
 *  the sheet's token list is how the user picks anything else. */
export function cosmosSendSelection(chain, tokens) {
  const native = { denom: chain.denom, symbol: chain.symbol, name: chain.name, decimals: chain.decimals, amount: chain.amount ?? null, verified: true, ibc: false };
  if (!Array.isArray(tokens) || tokens.length === 0) return native;
  return tokens.find(t => t.denom === chain.denom) || tokens[0] || native;
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

// ---------- Injective signer (EthAccount — see the family note) ----------
// Hand-rolled because stock CosmJS emits the Cosmos pubkey type and
// signs sha256(SignDoc); Injective needs its own pubkey type URL and
// keccak256(SignDoc). The protobuf assembly reuses the cosmjs-types
// codecs (the same generated code CosmJS itself ships); the pubkey
// Any's value is the standard { key: bytes } protobuf, which is also
// exactly the ethsecp256k1 PubKey's wire layout.
export const INJECTIVE_PUBKEY_TYPE = "/injective.crypto.v1beta1.ethsecp256k1.PubKey";
/** PURE builder (unit-testable offline): assemble + sign an Injective
 *  bank MsgSend. Deterministic (RFC6979): for identical inputs the
 *  output is byte-identical to @injectivelabs/sdk-ts's — pinned in
 *  tests against a transaction that was also simulated live on
 *  injective-1. Returns { txBytes, signDocBytes, signature }. */
export function buildInjectiveSignedTx({ privateKey, publicKey, fromAddress, toAddress, denom, amountBase, feeAmountBase, gasLimit, accountNumber, sequence, chainId = "injective-1" }) {
  const msgAny = ProtobufAny.fromPartial({
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: CosmosBankMsgSend.encode(CosmosBankMsgSend.fromPartial({
      fromAddress, toAddress,
      amount: [CosmosCoin.fromPartial({ denom, amount: String(amountBase) })],
    })).finish(),
  });
  const bodyBytes = CosmosTxBody.encode(CosmosTxBody.fromPartial({ messages: [msgAny], memo: "" })).finish();
  const pubKeyAny = ProtobufAny.fromPartial({
    typeUrl: INJECTIVE_PUBKEY_TYPE,
    value: CosmosSecp256k1PubKey.encode(CosmosSecp256k1PubKey.fromPartial({ key: publicKey })).finish(),
  });
  const feeCoins = String(feeAmountBase) === "0" ? [] : [CosmosCoin.fromPartial({ denom: "inj", amount: String(feeAmountBase) })];
  const authInfoBytes = CosmosAuthInfo.encode(CosmosAuthInfo.fromPartial({
    signerInfos: [CosmosSignerInfo.fromPartial({
      publicKey: pubKeyAny,
      modeInfo: CosmosModeInfo.fromPartial({ single: { mode: 1 } }), // SIGN_MODE_DIRECT
      sequence: BigInt(sequence),
    })],
    fee: { amount: feeCoins, gasLimit: BigInt(gasLimit) },
  })).finish();
  const signDocBytes = CosmosSignDoc.encode(CosmosSignDoc.fromPartial({
    bodyBytes, authInfoBytes, chainId, accountNumber: BigInt(accountNumber),
  })).finish();
  // Injective's ethsecp256k1 verification hashes the sign bytes with
  // keccak256 (Ethereum-style) — NOT the Cosmos sha256. Proven three
  // ways in the gap-closure build: sdk-ts source, local noble verify
  // (keccak verifies, sha256 does not), byte-identical output vs sdk-ts.
  const signature = secp256k1.sign(keccak_256(signDocBytes), privateKey, { prehash: false, lowS: true });
  const txBytes = CosmosTxRaw.encode(CosmosTxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures: [signature] })).finish();
  return { txBytes, signDocBytes, signature };
}
/** The chain's own account record for an Injective address (EthAccount
 *  wraps a base_account). Returns { accountNumber, sequence } as
 *  strings, or null when the account does not exist on-chain yet —
 *  a Cosmos account must exist before it can sign a transaction. */
async function injectiveAccount(chain, address) {
  const res = await fetch(`${chain.rest}/cosmos/auth/v1beta1/accounts/${address}`, { signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Injective account lookup failed (HTTP ${res.status}).`);
  const data = await res.json().catch(() => null);
  const acct = data?.account || {};
  const base = acct.base_account || acct;
  if (base.account_number == null) throw new Error("Injective returned an unreadable account record.");
  return { accountNumber: String(base.account_number), sequence: String(base.sequence ?? "0") };
}
/** POST a signed transaction to the chain's simulate endpoint;
 *  resolves with gas_info, throws the chain's own message otherwise. */
async function injectiveSimulate(chain, txBytes) {
  const res = await fetch(`${chain.rest}/cosmos/tx/v1beta1/simulate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_bytes: base64.encode(txBytes) }), signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.gas_info) {
    throw new Error((data?.message || `Injective simulation failed (HTTP ${res.status}).`).trim());
  }
  return data.gas_info;
}
// Injective's registry gas price is an integer amount of inj per gas
// ("160000000inj" in the chain table) — parse the leading integer.
function injectiveGasPricePerGas(chain) {
  const m = /^(\d+)/.exec(chain.gasPrice || "");
  if (!m) throw new Error("Injective gas price is not an integer price: " + chain.gasPrice);
  return BigInt(m[1]);
}
/** Injective fee estimate with the same return shape as
 *  estimateCosmosFee and the same math (simulated gas × 1.4 at the
 *  registry price). The simulation itself is signed with a
 *  provisional fee — Injective's ante checks the fee during
 *  simulation too, so an account that cannot pay fails here with the
 *  chain's insufficient-funds message, which is the honest answer
 *  for an empty account. */
async function estimateInjectiveFee(phrase, chain, { to, amount, denom = null, decimals = null }) {
  const from = cosmosAddress(phrase, chain.key);
  const acct = await injectiveAccount(chain, from);
  if (!acct) throw new Error("Your Injective account isn't on-chain yet — receive some INJ first, then sending works.");
  const { child } = cosmosKeys(phrase, cosmosCoinType(chain));
  const raw = ethers.parseUnits(String(amount), decimals ?? chain.decimals).toString();
  const price = injectiveGasPricePerGas(chain);
  const provisionalGas = 250000;
  const provisional = buildInjectiveSignedTx({
    privateKey: child.privateKey, publicKey: child.publicKey, fromAddress: from, toAddress: to,
    denom: denom || chain.denom, amountBase: raw,
    feeAmountBase: (price * BigInt(provisionalGas)).toString(), gasLimit: provisionalGas,
    accountNumber: acct.accountNumber, sequence: acct.sequence, chainId: chain.chainId,
  });
  const gasInfo = await injectiveSimulate(chain, provisional.txBytes);
  const gasWanted = Math.ceil(Number(gasInfo.gas_used) * 1.4);
  const feeAmount = price * BigInt(gasWanted);
  const fee = { amount: [{ denom: chain.denom, amount: feeAmount.toString() }], gas: String(gasWanted) };
  return { fee, feeText: ethers.formatUnits(feeAmount, chain.decimals), feeSymbol: chain.symbol };
}
/** Injective send: build + sign with buildInjectiveSignedTx and
 *  broadcast through the chain's LCD (BROADCAST_MODE_SYNC — CheckTx
 *  runs the full ante handler; delivery is then committed by the
 *  network). Takes the fee object from estimateInjectiveFee so the
 *  broadcast matches exactly what the user approved. Returns { hash }. */
async function sendInjective(phrase, chain, { to, amount, fee = null, denom = null, decimals = null }) {
  const from = cosmosAddress(phrase, chain.key);
  const acct = await injectiveAccount(chain, from);
  if (!acct) throw new Error("Your Injective account isn't on-chain yet — receive some INJ first, then sending works.");
  const { child } = cosmosKeys(phrase, cosmosCoinType(chain));
  const raw = ethers.parseUnits(String(amount), decimals ?? chain.decimals).toString();
  const useFee = fee || (await estimateInjectiveFee(phrase, chain, { to, amount, denom, decimals })).fee;
  const built = buildInjectiveSignedTx({
    privateKey: child.privateKey, publicKey: child.publicKey, fromAddress: from, toAddress: to,
    denom: denom || chain.denom, amountBase: raw,
    feeAmountBase: useFee.amount?.[0]?.amount || "0", gasLimit: Number(useFee.gas || 200000),
    accountNumber: acct.accountNumber, sequence: acct.sequence, chainId: chain.chainId,
  });
  const res = await fetch(`${chain.rest}/cosmos/tx/v1beta1/txs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_bytes: base64.encode(built.txBytes), mode: "BROADCAST_MODE_SYNC" }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  const txr = data?.tx_response;
  if (!res.ok || !txr) throw new Error((data?.message || `Injective broadcast failed (HTTP ${res.status}).`).trim());
  if (Number(txr.code) !== 0) throw new Error(`Injective rejected the transaction: ${(txr.raw_log || "code " + txr.code).trim().slice(0, 240)}`);
  return { hash: txr.txhash };
}
/** Simulate a MsgSend and price the fee at the chain's registry
 *  average gas price (CosmJS "auto" math: simulated gas × 1.4).
 *  Returns { fee: {amount: [{denom, amount}], gas}, feeText } where
 *  feeText is the display-unit fee for the intent sentence. */
export async function estimateCosmosFee(phrase, chainKey, { to, amount, denom = null, decimals = null }) {
  const chain = cosmosChain(chainKey);
  if (!chain) throw new Error("Unknown Cosmos chain: " + chainKey);
  if (chain.key === "injective") return estimateInjectiveFee(phrase, chain, { to, amount, denom, decimals });
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
  if (!isValidCosmosAddress(to, chainKey)) throw new Error(`That is not a valid ${chain.name} address (it starts with ${chain.prefix}1).`);
  const raw = ethers.parseUnits(String(amount), decimals ?? chain.decimals);
  if (raw <= 0n) throw new Error("Enter an amount.");
  // Injective signs with its own EthAccount signer (hand-rolled
  // above); the other six chains ride the CosmJS client below.
  if (chain.key === "injective") return sendInjective(phrase, chain, { to, amount, fee, denom, decimals });
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
export const NAMES_REGISTRY_URL = "https://fluidwallet.dpdns.org/names.json";
/** The same registry file on the Netlify site — the fallback when
 *  the primary host can't be reached (the two hosts serve the same
 *  published names.json, so a fallback read is the same data). The
 *  primary was the Pages URL until 2026-11-08, when the front door
 *  moved to fluidwallet.dpdns.org (GitHub Pages behind the domain);
 *  before that it was Netlify, swapped because Netlify deploys pause
 *  whenever the team's build credits run out, which froze the
 *  registry it served while GitHub Pages kept publishing. */
export const NAMES_REGISTRY_FALLBACK_URL = "https://fluidwallet.netlify.app/names.json";
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
 *  (native, USDC, USDT, any ERC-20), `btc` is the Bitcoin key, `ln`
 *  is an optional Lightning address for invoice-less Lightning sends,
 *  and `algo`, `sol`, `tron`, `sui` carry the wallet's Algorand,
 *  Solana, Tron and Sui addresses. Every field beyond evm/btc is
 *  optional — an entry carries the families its wallet uses, and
 *  entries published before a field existed keep working. */
export function buildNameEntry(name, evm, btc, ln = null, algo = null, sol = null, tron = null, sui = null) {
  if (!validateFluidName(name)) throw new Error("Name must be 3-20 chars: letters, numbers, underscore; start with a letter.");
  const entry = { evm, btc };
  if (ln) entry.ln = ln;
  // The non-EVM families ride along when the caller has the wallet's
  // address for them, each behind its own full validator (the same
  // checks sanitizeNameEntry applies at read time): published
  // entries carry the fields, and a claim/update entry should match
  // that shape so the name resolves on every chain the registry
  // schema covers.
  if (algo && isValidAlgorandAddress(algo)) entry.algo = algo;
  if (sol && isValidSolanaAddress(sol)) entry.sol = sol;
  if (tron && isValidTronAddress(tron)) entry.tron = tron;
  if (sui && isValidSuiAddress(sui)) entry.sui = sui;
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
  assertBolt11Amount(inv.pr, amountMsat);
  return inv.pr;
}
/* RED-TEAM 2026-11-06 (Finding G): the invoice an LNURL server returns
 * was handed to the payer completely unchecked — a hostile or buggy
 * server could return an unparseable string, or worse, an invoice for a
 * DIFFERENT amount than the user typed. Verify before it goes anywhere:
 * the string must be a checksum-valid bech32 BOLT11 invoice, and the
 * amount encoded in its human-readable part must equal the requested
 * amount exactly. (Amount-less invoices are refused for a payment that
 * named an amount.) */
export function assertBolt11Amount(invoice, amountMsat) {
  let dec;
  try { dec = bech32.decode(String(invoice || "").trim().toLowerCase(), 4000); }
  catch { throw new Error("The Lightning service returned an invalid invoice — refusing to use it."); }
  const m = /^ln(?:bc|tb|bcrt)(\d+)?([munp])?$/.exec(dec.prefix);
  if (!m) throw new Error("The Lightning service returned an invalid invoice — refusing to use it.");
  if (!m[1]) throw new Error("The Lightning service returned an amount-less invoice for a fixed-amount payment — refusing to use it.");
  const MULT = { "": [100000000000n, 1n], m: [100000000n, 1n], u: [100000n, 1n], n: [100n, 1n], p: [1n, 10n] };
  const [num, den] = MULT[m[2] || ""];
  const raw = BigInt(m[1]) * num;
  if (raw % den !== 0n || raw / den !== BigInt(amountMsat)) {
    throw new Error("The invoice amount does not match the amount you entered — refusing to use it.");
  }
  return true;
}
/* RED-TEAM 2026-11-06 (Finding H): registry entries were trusted raw —
 * a malformed or hostile entry (the registry is a fetched JSON file)
 * flowed straight into the send sheets. Validate every field's shape
 * here, at the trust boundary; fields that don't parse as the address
 * type they claim to be are dropped, and an entry with no valid field
 * left is treated as unregistered. */
export function sanitizeNameEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const out = {};
  if (typeof entry.evm === "string" && /^0x[0-9a-fA-F]{40}$/.test(entry.evm.trim())) out.evm = entry.evm.trim();
  if (typeof entry.btc === "string" && /^(bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(entry.btc.trim())) out.btc = entry.btc.trim();
  if (typeof entry.ln === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.ln.trim())) out.ln = entry.ln.trim();
  // Algorand: the full address check (58-char base32 + checksum), not a
  // shape regex — a malformed or bad-checksum `algo` field is dropped
  // exactly like the other fields above.
  if (typeof entry.algo === "string" && isValidAlgorandAddress(entry.algo.trim())) out.algo = entry.algo.trim();
  // Solana / Tron / Sui: the same treatment — each field is carried
  // only when it passes the chain's REAL validator (Base58 32-byte
  // decode, Base58Check + 0x41 prefix, Sui hex shape), never a shape
  // regex alone. The Base58 families are stored exactly as published
  // (their checksummed mixed-case form IS the canonical form); Sui
  // is stored in its canonical form (0x + 64 lowercase hex — the
  // form normalizeSuiAddress defines and Scan's raw-address path
  // emits), so every consumer sees one spelling.
  if (typeof entry.sol === "string" && isValidSolanaAddress(entry.sol.trim())) out.sol = entry.sol.trim();
  if (typeof entry.tron === "string" && isValidTronAddress(entry.tron.trim())) out.tron = entry.tron.trim();
  if (typeof entry.sui === "string") { const n = normalizeSuiAddress(entry.sui); if (n) out.sui = n; }
  return Object.keys(out).length ? out : null;
}
/** The one registry read both name lookups share: try the requested
 *  URL, and — for the default registry only — fall back to the
 *  GitHub Pages mirror when the fetch fails or the response is not
 *  ok. A caller-supplied registry URL is fetched as-is (no surprise
 *  second host). Returns the parsed registry, or null on failure. */
async function fetchRegistryJson(registryUrl) {
  const urls = registryUrl === NAMES_REGISTRY_URL
    ? [registryUrl, NAMES_REGISTRY_FALLBACK_URL]
    : [registryUrl];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res && res.ok) return await res.json();
    } catch { /* fall through to the next mirror */ }
  }
  return null;
}
export async function resolveFluidName(input, registryUrl = NAMES_REGISTRY_URL) {
  const name = normalizeFluidName(input);
  if (!validateFluidName(name)) return null;
  const reg = await fetchRegistryJson(registryUrl);
  if (!reg) return null;
  const entry = sanitizeNameEntry(reg[name]);
  return entry ? { name, ...entry } : null;
}
/** Resolve a SEND-sheet recipient for one chain — the one path every
 *  family sheet shares (QA F2/F3–F5, 2026-11-07). Order matters:
 *  1. A string that IS a valid address for the chain is an address,
 *     full stop — the name lookup never runs for it. (The Algorand
 *     zero address AAAA…Y5HFKQ is checksum-valid and must not be
 *     treated as an unregistered Fluid name.)
 *  2. Anything else is treated as a Fluid name and resolved through
 *     the shared registry (resolveFluidName). An unregistered name is
 *     a hard block: "That Fluid name is not in the registry yet."
 *  3. A registered name with no address for this chain is the other
 *     hard block, worded exactly like the Bitcoin sheet's:
 *     "That Fluid name has no <Chain> address in the registry."
 *     A chain the registry schema doesn't carry (field: null)
 *     always lands here for known names.
 *  Returns { to, name } — name is null for a raw address. Throws an
 *  Error carrying the user-facing message otherwise. `lookupName`
 *  is injectable for tests. */
/** Recipient-input hygiene (QA F2 round 3, convicted by execution):
 *  invisible format characters — zero-width space U+200B, ZWNJ
 *  U+200C, ZWJ U+200D, word joiner U+2060, soft hyphen U+00AD, and
 *  a mid-string BOM U+FEFF — ride along in addresses copied from
 *  web pages, PDFs and generated text. They are invisible in the
 *  field, are NOT stripped by String.trim() or by an <input>'s
 *  value sanitisation (which removes line breaks only), and fail
 *  every checksum-strict validator — so a pasted, genuinely valid
 *  address carrying one was silently misrouted to the name path
 *  and hard-blocked as "That Fluid name is not in the registry
 *  yet." while the bare string resolved fine. The canonical zero
 *  address + a trailing U+200B reproduces that exact live error
 *  against the pre-fix resolver; the bare string takes the address
 *  branch. Cleaning lives HERE, in the one shared resolver, so
 *  every chain sheet gets it. */
export function cleanRecipientInput(input) {
  // Round 4 widening: the strip set is no longer an enumerated few.
  // It now covers ALL whitespace (including a mid-string space or
  // NBSP left by a line-wrapped paste) and the WHOLE Unicode format
  // class (\p{Cf}: zero-width chars, bidi controls, joiners, the
  // combining grapheme joiner U+034F, the Arabic letter mark U+061C,
  // …) plus U+180E, a format char in older Unicode. This is safe to
  // widen without limit: no valid address on any chain Fluid speaks
  // (base32/base58/bech32/hex) and no valid Fluid name ([a-z0-9_])
  // contains whitespace or a format character, so stripping them
  // can never alter a legitimate input — it can only rescue a
  // pasted delivery that was carrying invisible weight. Look-alike
  // LETTERS (e.g. a Cyrillic А) are deliberately NOT touched: they
  // fail the checksum and hard-block, loudly, as they should.
  return String(input || "").replace(/[\s\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\p{Cf}]/gu, "").trim();
}
export async function resolveChainRecipient(input, { isValidAddress, field = null, chainLabel, lookupName } = {}) {
  const raw = cleanRecipientInput(input);
  if (typeof isValidAddress === "function" && isValidAddress(raw)) return { to: raw, name: null };
  const lookup = lookupName || resolveFluidName;
  const hit = await lookup(raw).catch(() => null);
  if (!hit) throw new Error("That Fluid name is not in the registry yet.");
  if (!field || !hit[field]) throw new Error(`That Fluid name has no ${chainLabel} address in the registry.`);
  return { to: hit[field], name: hit.name };
}
/** Fetch the whole name registry (null on any failure). */
export async function fetchNameRegistry(registryUrl = NAMES_REGISTRY_URL) {
  return fetchRegistryJson(registryUrl);
}
/** Reverse lookup: which registered name belongs to these addresses?
 *  EVM addresses compare case-insensitively (checksummed vs lowercase
 *  spellings of the same key); BTC addresses are case-sensitive and
 *  compare exactly. Algorand addresses compare case-insensitively too:
 *  the base32 encoding decodes identically in either case (the decoder
 *  uppercases first), so case carries no information. Solana and Tron
 *  addresses are Base58 — case is significant there, so they compare
 *  exactly, like BTC. Sui addresses compare in canonical form (0x +
 *  64 lowercase hex, via normalizeSuiAddress — entries are already
 *  stored canonically by sanitizeNameEntry). Returns
 *  { name, ...entry } or null. Lets a wallet that already owns a
 *  published name recognise it as its own instead of being told the
 *  name is "already claimed" by itself. */
export function findNameForAddresses(registry, { evm = null, btc = null, algo = null, sol = null, tron = null, sui = null } = {}) {
  if (!registry || typeof registry !== "object") return null;
  const evmLc = evm ? String(evm).toLowerCase() : null;
  const algoUc = algo ? String(algo).toUpperCase() : null;
  const suiNorm = sui ? normalizeSuiAddress(sui) : null;
  for (const [name, rawEntry] of Object.entries(registry)) {
    const entry = sanitizeNameEntry(rawEntry);
    if (!entry) continue;
    if (evmLc && entry.evm && entry.evm.toLowerCase() === evmLc) return { name, ...entry };
    if (btc && entry.btc && entry.btc === btc) return { name, ...entry };
    if (algoUc && entry.algo && entry.algo.toUpperCase() === algoUc) return { name, ...entry };
    if (sol && entry.sol && entry.sol === sol) return { name, ...entry };
    if (tron && entry.tron && entry.tron === tron) return { name, ...entry };
    if (suiNorm && entry.sui && entry.sui === suiNorm) return { name, ...entry };
  }
  return null;
}

// ---------- Fluid Name claims: signed claim → Nostr → processor → registry ----------
// THE GAP THIS CLOSES (meeday incident, 2026-11-09): claiming used to
// save the name on-device only; publishing meant hand-editing
// names.json on GitHub — a step outside the app that phone-only users
// never completed, so their name never resolved for anyone else while
// the app showed it as theirs. The claim now completes inside the
// app: the wallet signs a canonical claim with its EVM key (EIP-191),
// wraps it in a Nostr event and publishes it to public relays; a
// processor verifies the signature, enforces first-come-first-served
// against the published registry, and lands the winner in names.json.
// No server, no account, no token, no cost — names and addresses are
// public data, and the event carries nothing private.
export const NAME_CLAIM_KIND = 30078;
export const NAME_CLAIM_D_PREFIX = "fluid-name-claim:";
export const NAME_CLAIM_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
/** The Nostr signing key for claims derives from the user's seed at
 *  its own BIP32 path — m/9419/121924, one leaf past Satora's
 *  m/9419/121923 namespace — so a wallet's claims are stable across
 *  devices and sessions. The key only signs the transport event; the
 *  binding ownership proof is the EIP-191 signature inside it. */
export const NAME_CLAIM_DERIVATION_PATH = "m/9419/121924";
export function nameClaimNostrKeys(phrase) {
  const seed = mnemonicToSeedSync(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const node = HDKey.fromMasterSeed(seed).derive(NAME_CLAIM_DERIVATION_PATH);
  if (!node.privateKey) throw new Error("Could not derive this wallet's name-claim key.");
  const priv = node.privateKey;
  return { priv, pubHex: hexOf(schnorr.getPublicKey(priv)) };
}
/** The canonical claim text — the EXACT bytes the EVM key signs.
 *  One field per line, empty optional fields stay as empty lines, so
 *  any post-signing edit to any covered field changes the message
 *  and the signature stops recovering the claimed EVM address.
 *  Covers name + evm + btc + ln + algo, plus sol/tron/sui when the
 *  wallet carries them (the registry entry's remaining families —
 *  signing them too means the processor can never be handed a
 *  different Solana/Tron/Sui address than the owner signed). */
export function buildNameClaimMessage(claim) {
  const c = claim || {};
  const f = (v) => String(v == null ? "" : v).trim();
  return [
    "Fluid name claim v1",
    "name: " + normalizeFluidName(c.name),
    "evm: " + f(c.evm),
    "btc: " + f(c.btc),
    "ln: " + f(c.ln),
    "algo: " + f(c.algo),
    "sol: " + f(c.sol),
    "tron: " + f(c.tron),
    "sui: " + f(c.sui),
  ].join("\n");
}
/** Verify a claim object {name, evm, btc, ln?, algo?, sol?, tron?,
 *  sui?, sig}: the name must pass the app's own format rules, every
 *  present address must pass the registry's own sanitizer, and the
 *  EIP-191 signature over buildNameClaimMessage must recover EXACTLY
 *  the claimed EVM address. Returns { ok, reason?, entry? } — entry
 *  is the sanitized registry entry (no name key) on success. This is
 *  the single verification the processor runs; the app uses the same
 *  function on its own claim before publishing. */
export function verifyNameClaim(claim) {
  const c = claim || {};
  const name = normalizeFluidName(c.name);
  if (!validateFluidName(name)) return { ok: false, reason: "invalid name format" };
  if (typeof c.sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(c.sig)) return { ok: false, reason: "missing or malformed signature" };
  const raw = { evm: c.evm, btc: c.btc, ln: c.ln || undefined, algo: c.algo || undefined, sol: c.sol || undefined, tron: c.tron || undefined, sui: c.sui || undefined };
  const entry = sanitizeNameEntry(raw);
  if (!entry || !entry.evm || !entry.btc) return { ok: false, reason: "missing or invalid evm/btc address" };
  // A present-but-invalid optional field is dropped by the sanitizer;
  // a claim that CARRIED such a field was not the claim its owner
  // reviewed — refuse rather than publish a trimmed variant.
  for (const k of ["ln", "algo", "sol", "tron", "sui"]) {
    if (c[k] && !entry[k]) return { ok: false, reason: `invalid ${k} address` };
  }
  if (String(entry.evm).toLowerCase() !== String(c.evm).trim().toLowerCase()) return { ok: false, reason: "evm address failed sanitization" };
  let recovered;
  try { recovered = ethers.verifyMessage(buildNameClaimMessage({ ...c, name }), c.sig); }
  catch { return { ok: false, reason: "signature does not verify" }; }
  if (String(recovered).toLowerCase() !== String(c.evm).trim().toLowerCase()) return { ok: false, reason: "signature recovers a different address" };
  return { ok: true, entry };
}
/** The Nostr event id (NIP-01): sha256 of the JSON serialization
 *  [0, pubkey, created_at, kind, tags, content], hex-encoded. */
export function nostrEventId(event) {
  const ser = JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  return hexOf(sha256(new TextEncoder().encode(ser)));
}
/** Build + sign the claim's Nostr transport event (kind 30078,
 *  d-tag "fluid-name-claim:<name>", content = the claim JSON).
 *  `signerWallet` is the unlocked ethers wallet (EIP-191); the claim
 *  is verified locally before anything is signed or sent. */
export async function buildSignedNameClaim({ name, evm, btc, ln = null, algo = null, sol = null, tron = null, sui = null, phrase, signerWallet, createdAt = null }) {
  const claim = { v: 1, name: normalizeFluidName(name), evm, btc, ln: ln || "", algo: algo || "", sol: sol || "", tron: tron || "", sui: sui || "" };
  const sig = await signerWallet.signMessage(buildNameClaimMessage(claim));
  const signed = { ...claim, sig };
  const check = verifyNameClaim(signed);
  if (!check.ok) throw new Error("This claim does not verify (" + check.reason + ") — nothing was published.");
  const keys = nameClaimNostrKeys(phrase);
  const event = {
    pubkey: keys.pubHex,
    created_at: createdAt || Math.floor(Date.now() / 1000),
    kind: NAME_CLAIM_KIND,
    tags: [["d", NAME_CLAIM_D_PREFIX + claim.name]],
    content: JSON.stringify(signed),
  };
  event.id = nostrEventId(event);
  event.sig = hexOf(schnorr.sign(hexToBytesB(event.id), keys.priv));
  return { claim: signed, event };
}
/** Verify a Nostr event's own Schnorr signature (transport integrity
 *  only — ownership is proven by the EIP-191 signature inside). */
export function verifyNostrEventSignature(event) {
  try {
    if (!event || typeof event.id !== "string" || typeof event.pubkey !== "string" || typeof event.sig !== "string") return false;
    if (nostrEventId(event) !== event.id) return false;
    return schnorr.verify(hexToBytesB(event.sig), hexToBytesB(event.id), hexToBytesB(event.pubkey));
  } catch { return false; }
}
/** How long a published claim may stay missing from BOTH the relays
 *  and the registry before the app stops calling it "publishing"
 *  and calls it what it is — lost (the REPAIR state). Aligned with
 *  the creation wait sheet's ~15-minute long-wait bound: claims
 *  normally land in ~2 minutes, so 15 minutes of total absence is
 *  not slowness, it is loss. */
export const NAME_CLAIM_REPAIR_AFTER_MS = 15 * 60 * 1000;
/** Publish a signed claim event to the public relays over wss
 *  (browser WebSocket), reporting WHICH relays accepted — the
 *  device-held claim record keeps the list, because "accepted
 *  somewhere" is only half the truth: the first-user audit
 *  (2026-11-09, P0-1) lost a claim whose publish had been accepted
 *  yet which no processor scan ever saw. Never throws. */
export async function publishNameClaimEventDetailed(event, relays = NAME_CLAIM_RELAYS, timeoutMs = 9000) {
  const one = (url) => new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; try { ws.close(); } catch { /* already closed */ } resolve(ok); } };
    let ws;
    try { ws = new WebSocket(url); } catch { return resolve(false); }
    const timer = setTimeout(() => finish(false), timeoutMs);
    ws.onopen = () => { try { ws.send(JSON.stringify(["EVENT", event])); } catch { clearTimeout(timer); finish(false); } };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(String(m.data || ""));
        if (Array.isArray(msg) && msg[0] === "OK" && msg[1] === event.id) { clearTimeout(timer); finish(msg[2] === true); }
      } catch { /* not an OK frame — keep waiting for the timeout */ }
    };
    ws.onerror = () => { clearTimeout(timer); finish(false); };
    ws.onclose = () => { clearTimeout(timer); finish(false); };
  });
  const results = await Promise.allSettled(relays.map(one));
  const acceptedRelays = relays.filter((_, i) => results[i].status === "fulfilled" && results[i].value === true);
  return { accepted: acceptedRelays.length, acceptedRelays };
}
/** Publish a signed claim event; resolves the number of relays that
 *  accepted (OK true); succeeds by the caller's rule at ≥1. Never
 *  throws — a total failure returns 0 and the caller keeps the claim
 *  in the saved-on-device state with its Publish button. */
export async function publishNameClaimEvent(event, relays = NAME_CLAIM_RELAYS, timeoutMs = 9000) {
  return (await publishNameClaimEventDetailed(event, relays, timeoutMs)).accepted;
}
/** Truth check for a published claim: ask the relays, BY EVENT ID,
 *  whether the claim event still exists anywhere. (By-id is the
 *  only reliable read shape — measured 2026-11-09: the audit's
 *  winning event was fetchable by id from one relay while author
 *  and bulk queries on the same relays returned nothing.) Resolves
 *  { found, foundRelays } and never throws: a relay that cannot be
 *  reached simply does not answer, and "found nowhere we could
 *  ask" after the repair window is exactly the lost-claim signal
 *  the REPAIR state exists for. */
export async function queryNameClaimEvent(eventId, relays = NAME_CLAIM_RELAYS, timeoutMs = 9000) {
  if (typeof eventId !== "string" || !eventId) return { found: false, foundRelays: [] };
  const one = (url) => new Promise((resolve) => {
    let done = false;
    const finish = (found) => { if (!done) { done = true; try { ws.close(); } catch { /* already closed */ } resolve(found); } };
    let ws;
    try { ws = new WebSocket(url); } catch { return resolve(false); }
    const subId = "fc" + Math.random().toString(36).slice(2, 10);
    const timer = setTimeout(() => finish(false), timeoutMs);
    ws.onopen = () => { try { ws.send(JSON.stringify(["REQ", subId, { ids: [eventId] }])); } catch { clearTimeout(timer); finish(false); } };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(String(m.data || ""));
        if (Array.isArray(msg) && msg[0] === "EVENT" && msg[2] && msg[2].id === eventId) { clearTimeout(timer); finish(true); }
        if (Array.isArray(msg) && msg[0] === "EOSE" && msg[1] === subId) { clearTimeout(timer); finish(false); }
      } catch { /* unparseable frame — keep waiting */ }
    };
    ws.onerror = () => { clearTimeout(timer); finish(false); };
    ws.onclose = () => { clearTimeout(timer); finish(false); };
  });
  const results = await Promise.allSettled(relays.map(one));
  const foundRelays = relays.filter((_, i) => results[i].status === "fulfilled" && results[i].value === true);
  return { found: foundRelays.length > 0, foundRelays };
}
/** Is a published claim LOST — old enough, absent from the
 *  registry, and its event unfindable on the relays? Pure, so the
 *  suite pins the boundary. `eventFound` must be an actual relay
 *  truth-check result: null (not checked) is never "lost". */
export function nameClaimRepairDue({ pending = null, registryHit = null, myEvm = null, eventFound = null, now = null } = {}) {
  if (!pending || !pending.published) return false;
  if (registryHit && myEvm && registryHit.evm && String(registryHit.evm).toLowerCase() === String(myEvm).toLowerCase()) return false;
  if (eventFound !== false) return false;
  const t = typeof now === "number" ? now : Date.now();
  const since = pending.publishedAt || pending.submittedAt || 0;
  return t - since >= NAME_CLAIM_REPAIR_AFTER_MS;
}
/** The five name states (owner's honesty rule, 2026-11-09: no state
 *  may present a name as owned while it doesn't resolve for other
 *  wallets). Pure, so the suite pins every transition:
 *   none       — this device holds no claim for the name.
 *   saved      — claimed on this device, NOT LIVE: nobody else can
 *                send to it yet; the Publish button finishes it.
 *   publishing — the signed claim is with the relays; the app polls
 *                the published registry until it lands.
 *   live       — the registry resolves the name to THIS wallet.
 *   conflict   — the registry resolves the name to a DIFFERENT
 *                wallet (first come, first served was won elsewhere). */
export function nameClaimState({ stored = null, pending = null, registryHit = null, myEvm = null, eventFound = null, now = null } = {}) {
  const mine = !!(registryHit && myEvm && registryHit.evm && String(registryHit.evm).toLowerCase() === String(myEvm).toLowerCase());
  if (registryHit && mine) return "live";
  if (registryHit && stored) return "conflict";
  if (pending && pending.published) {
    // A published claim that is past the repair window, absent
    // from the registry AND unfindable on the relays is not
    // "publishing" — it is lost, and the UI must say so (P0-1).
    if (nameClaimRepairDue({ pending, registryHit, myEvm, eventFound, now })) return "repair";
    return "publishing";
  }
  if (stored || pending) return "saved";
  return "none";
}
/** The exact user-facing sentence for each state — one source, used
 *  by the creation flow and the More-tab card alike, pinned by tests. */
export const NAME_STATE_COPY = Object.freeze({
  saved: "Saved on this device only — NOT LIVE. Nobody else can send to this name yet. Tap “Publish my name” to finish claiming it.",
  publishing: "Publishing… your signed claim has been sent and your name will go live once it lands in the public registry — usually a few minutes. This screen keeps checking.",
  repair: "Your claim seems to have been lost on its way to the public registry — this name is NOT LIVE yet, and nobody can send to it. Tap “Publish again” to send the claim once more.",
  live: "This name is registered to this wallet in the public registry — anyone can send to it on any chain.",
  conflict: "This name was claimed by someone else first — the public registry resolves it to a different wallet, so this device's claim is NOT LIVE. Pick a different name.",
});

// ---------- Platform fees: cheapest-route principle + 60/40 split, settled in BTC over Lightning ----------
// Fluid's own fees (RAIN claim fee, OGO ERA game rake, the swap fee
// below) are split 60% to Ethuram's treasury and 40% to DripBot — and
// ALL settlement is in Bitcoin over the Lightning Network: fees accrue
// wherever they are collected, a keeper (DripBot) sweeps them, converts
// to BTC and pays both legs. Settlement targets are Fluid USERNAMES —
// "ethuram" (60%) and "dripbot" (40%) — resolved to addresses through
// the Fluid Names registry (names.json) at settlement time via
// feeLegTargets(); a registry entry's `ln` field is that leg's
// Lightning destination when present. Nobody is ever asked for an
// external Lightning address: DripBot's Lightning identity is created
// and held by the keeper, and Ethuram's leg lands in his own Fluid
// wallet. The split math never waits on resolution.

/** Ethuram's platform fee — the CAP: 0.5% of the swap amount, the
 *  rate he set on 2026-11-06. Charged on swaps and in-app
 *  conversions ONLY (see platformFeeApplies) — plain sends and
 *  receives are network-fee-only, always. Since 2026-11-08 the cap
 *  is no longer the price: the charged fee is a markup on the
 *  ROUTE's own cost (see PLATFORM_FEE_ROUTE_MULTIPLIER and
 *  platformFeeBpsForRoute), and this constant is the hard ceiling
 *  that markup can never cross — no quote may ever charge more
 *  than the old flat 0.5% would have. It stays the single source:
 *  the degenerate-case fallback rate, the LI.FI default collection
 *  parameter and every fee computation derive from it, never from
 *  a second copy of the number. */
export const PLATFORM_FEE_BPS = 50;
/** The same rate as a decimal fraction (0.005) — the shape LI.FI's
 *  integrator `fee` parameter expects. */
export const PLATFORM_FEE_FRACTION = PLATFORM_FEE_BPS / 10000;
/** The fee model (owner's design, 2026-11-08): Fluid's fee is a
 *  markup on what the ROUTE costs, never a tax on the user's
 *  volume — feeUSD = min(MULTIPLIER × the route's own cost, 0.5%
 *  of the amount, CEILING − the route's cost), where the ceiling
 *  caps the user's TOTAL cost (route + fee) per destination
 *  ecosystem (see PLATFORM_FEE_TOTAL_CEILINGS_USD). On the cheap
 *  routes Fluid prefers (Relay's L2↔L2 lanes cost ~$0.03) the
 *  multiplier term is far below the 0.5% cap, so the user pays
 *  the small markup and SEES the edge in the quote; on an
 *  expensive route the cap or the ceiling bites and the user
 *  never pays more than the old flat model — and when the route
 *  alone already meets the ceiling, Fluid's fee is 0 rather than
 *  pushing the total past it. Percentage-of-volume pricing
 *  survives only as the cap and as the fallback when a route's
 *  cost cannot be read. */
export const PLATFORM_FEE_ROUTE_MULTIPLIER = 5;
/** The EVM multiplier (owner, 2026-11-08 — "meet in the middle"):
 *  EVM destinations price at 4× the route cost, not 5×; every
 *  other ecosystem keeps PLATFORM_FEE_ROUTE_MULTIPLIER. */
export const PLATFORM_FEE_ROUTE_MULTIPLIER_EVM = 4;
/** Per-destination-ecosystem ceilings on the user's TOTAL swap
 *  cost in USD — route cost + Fluid's fee together may never
 *  exceed these (owner's adopted policy, 2026-11-08). Ecosystems
 *  not listed here (Tron, Sui, Cosmos, …) fall back to the EVM
 *  ceiling via platformFeeCeilingFor. Bitcoin and Lightning have
 *  no swap route in the current universe (swapChainOf returns
 *  null for them); their rows exist so a future BTC/LN route
 *  (Garden is the adopted candidate) prices under the law from
 *  its first quote. The Bitcoin ceiling sits at $1.50 (owner
 *  calibration, 2026-11-08, from the BTC-bridge market
 *  comparison): into-BTC route costs are dominated by FIXED fees
 *  (Garden's $0.75 flat into BTC; Satora ~$0.62 at $100), the
 *  whole market band for landing on Bitcoin mainnet is
 *  $0.70–1.85 at $100, and at realistic route costs the
 *  0.5%-of-amount cap is the binding term anyway — the ceiling
 *  exists only as a hard cap on user pain, so it sits at $1.50
 *  rather than starving the lane at $0.50. */
export const PLATFORM_FEE_TOTAL_CEILINGS_USD = { evm: 0.20, bitcoin: 1.50, lightning: 0.30, solana: 0.30 };
/** The destination ecosystem a swap chain key belongs to, for fee
 *  purposes: a NETWORKS key is "evm"; the named non-EVM families
 *  with their own ceiling get their own row; anything else —
 *  including an absent or unknown key — is "default", which takes
 *  the EVM ceiling with the non-EVM multiplier (the conservative
 *  pairing: the tightest total-cost promise, the standard markup). */
export function platformFeeEcosystemOf(destChainKey) {
  if (destChainKey === "solana") return "solana";
  if (destChainKey === "bitcoin" || destChainKey === "btc") return "bitcoin";
  if (destChainKey === "lightning" || destChainKey === "ln") return "lightning";
  if (typeof destChainKey === "string" && NETWORKS[destChainKey]) return "evm";
  return "default";
}
/** The route-cost multiplier for a destination chain key: 4× for
 *  EVM destinations, 5× everywhere else. */
export function platformFeeMultiplierFor(destChainKey) {
  return platformFeeEcosystemOf(destChainKey) === "evm"
    ? PLATFORM_FEE_ROUTE_MULTIPLIER_EVM : PLATFORM_FEE_ROUTE_MULTIPLIER;
}
/** The total-cost ceiling (USD) for a destination chain key:
 *  the ecosystem's own row, or the EVM ceiling for unlisted
 *  ecosystems and the default. */
export function platformFeeCeilingFor(destChainKey) {
  return PLATFORM_FEE_TOTAL_CEILINGS_USD[platformFeeEcosystemOf(destChainKey)]
    ?? PLATFORM_FEE_TOTAL_CEILINGS_USD.evm;
}
/** "0.5%" — the cap's label. Derived, not typed. */
export function platformFeePercentText() {
  const pct = PLATFORM_FEE_BPS / 100;
  return (Number.isInteger(pct) ? String(pct) : String(parseFloat(pct.toFixed(2)))) + "%";
}
/** The model's target fee in USD for a quote whose route costs
 *  routeFeeUsd, whose input is worth amountUsd and whose
 *  destination is destChainKey: min(MULTIPLIER(dest) × routeFeeUsd,
 *  the 0.5% cap, CEILING(dest) − routeFeeUsd), floored at 0 — the
 *  ceiling term is what remains of the destination ecosystem's
 *  total-cost promise after the route itself is paid, so a route
 *  that alone meets the ceiling leaves Fluid's fee at exactly 0.
 *  Degenerate inputs fall back to the cap (a route whose cost is
 *  zero or unreadable, so a fee is still collected and disclosed);
 *  an unpriced amount yields 0 here and the flat cap rate in
 *  platformFeeBpsForRoute. */
export function platformFeeUsdForRoute(routeFeeUsd, amountUsd, destChainKey = null) {
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt <= 0) return 0;
  const cap = amt * PLATFORM_FEE_FRACTION;
  const rf = Number(routeFeeUsd);
  if (!Number.isFinite(rf) || rf <= 0) return cap;
  return Math.max(0, Math.min(cap,
    platformFeeMultiplierFor(destChainKey) * rf,
    platformFeeCeilingFor(destChainKey) - rf));
}
/** The fee to actually charge, in basis points of the amount —
 *  the shape both routers take at quote time (Relay's App Fees
 *  `fee`, LI.FI's `fee` fraction = bps / 10000):
 *  min(50, floor(multiplier × R / amount × 10000),
 *  floor((ceiling − R) / amount × 10000)), clamped ≥ 0 — computed
 *  through platformFeeUsdForRoute so the law lives in one place.
 *  Rounding is FLOOR, always: the charged bps can land a fraction
 *  under the target but never above it, and never above the
 *  PLATFORM_FEE_BPS cap. The floor carries a 1e-9-bp residue
 *  correction: route costs arrive as IEEE754 differences (a
 *  $0.035 shortfall parses as 0.03499999999999659), and without
 *  it a target sitting exactly on a whole bp would floor one bp
 *  under its decimal-true value; the correction is a billionth
 *  of a basis point, so it can never lift the charge meaningfully
 *  above the target. Degenerate cases (route cost zero or
 *  unreadable, amount unpriced) return the flat cap, so a fee is
 *  still collected and disclosed exactly as the old model did. */
export function platformFeeBpsForRoute(routeFeeUsd, amountUsd, destChainKey = null) {
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt <= 0) return PLATFORM_FEE_BPS;
  const target = platformFeeUsdForRoute(routeFeeUsd, amt, destChainKey);
  return Math.max(0, Math.min(PLATFORM_FEE_BPS, Math.floor((target / amt) * 10000 + 1e-9)));
}
/** The route-cost definition the markup reads (owner's worked
 *  example, 2026-11-08): a route's cost is the LARGER of its
 *  explicit fee components (what the router declares — gas,
 *  bridge and relayer fees) and its all-in shortfall (what the
 *  input is worth minus what the user receives, with Fluid's own
 *  fee excluded: callers measure on the fee-free quote pass, or
 *  net the fee out first). Most of a cheap route's cost rides
 *  inside the exchange rate, where no fee component declares it —
 *  on Relay's $5 Base→Arbitrum capture the declared gas is
 *  $0.0011 but the shortfall is $0.0242 — so marking up the
 *  declared components alone would price Fluid's fee off a small
 *  fraction of the true cost. An unreadable measure drops out;
 *  the result never goes below zero, and a total blank stays zero
 *  so the degenerate fallback in platformFeeBpsForRoute applies. */
function routeCostUsd(explicitUsd, shortfallUsd) {
  const e = Number(explicitUsd);
  let cost = Number.isFinite(e) && e > 0 ? e : 0;
  const s = Number(shortfallUsd);
  if (Number.isFinite(s) && s > cost) cost = s;
  return Math.max(0, cost);
}
/** The platform fee on a raw integer amount (smallest units, BigInt
 *  math): fee = floor(amount × bps / 10000), at the cap rate unless
 *  a bps from platformFeeBpsForRoute is given. Rounding: the fee is
 *  floored, so fee + net == amount EXACTLY (net is simply
 *  amount − fee) — rounding can never create or destroy value, and
 *  the sub-unit remainder of the division stays with the user's net.
 *  Amounts under 200 raw units at the cap (fee < 1 unit) pay 0.
 *  Both routers' fees are defined on the swap's fromAmount, so
 *  this is too. */
export function platformFeeOn(rawAmount, bps = PLATFORM_FEE_BPS) {
  const a = typeof rawAmount === "bigint" ? rawAmount : BigInt(Math.max(0, Math.floor(Number(rawAmount) || 0)));
  if (a <= 0n) return 0n;
  const b = BigInt(Math.max(0, Math.min(10000, Math.floor(Number(bps) || 0))));
  return (a * b) / 10000n;
}
/** Scope of the standard fee, pinned by tests: asset exchanges Fluid
 *  routes ("swap", "conversion") carry it; moving your own money
 *  ("send", "receive") never does. */
export function platformFeeApplies(kind) {
  return kind === "swap" || kind === "conversion";
}
/** LI.FI collection switch. LI.FI's docs ("Monetizing the
 *  integration", checked 2026-11-06) are explicit: the `fee` parameter
 *  pays out to the fee wallet CONFIGURED for the integrator in the
 *  LI.FI Partner Portal (portal.li.fi) — an integrator string with no
 *  portal account has no configured wallet to forward to. Fluid's
 *  "fluid-wallet" integrator WAS registered on 2026-11-07, with the
 *  DripBot agent wallet (FEE_SPLIT.dripbot.agentWallet.evm) designated
 *  as the Default EVM fee wallet in the portal (fees forward to it
 *  automatically; the portal's Default SVM fee wallet was set to the
 *  agent wallet's Solana address the same day, and its Tron and Sui
 *  fee wallets were registered as the portal defaults later the same
 *  day too — and because LI.FI rejects fee-bearing requests on chains
 *  with no configured fee wallet (code 1011, verified live
 *  2026-11-07), the request builders attach the fee per source chain
 *  only where collection is actually configured
 *  (swapFeeCollectingChain); the full per-family state is pinned in
 *  SWAP_FEE_COVERAGE below).
 *  Collection is therefore ON:
 *  quote/route requests carry the `fee` parameter and LI.FI skims
 *  that fraction of fromAmount to that portal wallet. The fraction
 *  attached is the one the two-pass search computed for the route
 *  (platformFeeBpsForRoute — the route-cost markup, at most
 *  PLATFORM_FEE_FRACTION). The fee actually charged is also
 *  DISCLOSED on every swap confirmation (formatSwapIntent) from
 *  the final quote's own numbers, so the price a user sees is the
 *  price charged. */
export const PLATFORM_FEE_COLLECTION_ENABLED = true;

export const FEE_SPLIT = {
  currency: "BTC", rail: "lightning",
  treasury: { share: 60, label: "Ethuram (treasury)", username: "ethuram" },
  dripbot: { share: 40, label: "DripBot", username: "dripbot", x: "@bitcoinornatin", hashtag: "#bitcoinornatin",
    // Autonomous agent wallet created 2026-11-06 (agent/fluid-agent.mjs,
    // mode: autonomous, paired with @bitcoinornatin). Public addresses only:
    agentWallet: { evm: "0x7Fe638235FaD0fdfbBcC759640d881e0fa62135B", btc: "bc1qxtn2gkquphkhazvy6x8ny8tejxm530xlcskqqn",
      solana: "dpNKQrEWWU3kBLNMRYWZ4Dsnbig7G9vCeVChTHn4VPn", tron: "TMdUcLZmKVvKYHMJ12k5AA3ZCCHxPpmSSf", sui: "0x0cb53076d1207be242b18a63d97d2ccbd63f74d75abb68d4b7ea63b3a1d38831" },
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
/** Resolve the two settlement legs to addresses through the Fluid
 *  Names registry — the names.json object (username → {evm, btc, ln?, algo?},
 *  the same shape buildNameEntry produces). Resolution is by USERNAME,
 *  always: the keeper looks up "ethuram" and "dripbot", never a
 *  hard-coded or hand-supplied address. `ln` is null until the name's
 *  entry carries one (DripBot's Lightning identity is keeper-created;
 *  the treasury leg's is Ethuram's own in-app Lightning) — a null ln
 *  means that leg settles to its btc/evm address or waits for the
 *  Lightning identity, never that anyone gets asked for an external
 *  Lightning address. A missing registry entry resolves to all-null
 *  addresses with the username and share intact. */
export function feeLegTargets(registry) {
  const leg = (cfg) => {
    const e = (registry && typeof registry === "object") ? registry[cfg.username] : null;
    return { username: cfg.username, share: cfg.share, label: cfg.label,
             evm: e?.evm ?? null, btc: e?.btc ?? null, ln: e?.ln ?? null };
  };
  return [leg(FEE_SPLIT.treasury), leg(FEE_SPLIT.dripbot)];
}
/** Keeper's settlement-trigger input: total the unsettled fee pot in
 *  USD from per-chain fee-wallet holdings. Each holding is
 *  { amount, priceUsd } — amount in whole units of the asset, priceUsd
 *  the USD price of ONE unit from the app's existing price sources
 *  (the keeper passes getVerifiedPrice results), or null when no
 *  source prices that asset. Unpriced holdings are EXCLUDED from the
 *  total and counted in `unpriced` — the keeper never settles on a
 *  guessed price (the same discipline as getVerifiedPrice). `due`
 *  applies the $2 rule (feeSettlementDue). Pure: no fetching here, so
 *  the wallet bundle and the server-side keeper share one accounting. */
export function feePotReport(holdings) {
  let totalUsd = 0, priced = 0, unpriced = 0;
  for (const h of holdings || []) {
    const amt = Number(h?.amount);
    if (!(amt > 0)) continue;
    const px = h?.priceUsd == null ? null : Number(h.priceUsd);
    if (px == null || !Number.isFinite(px) || px <= 0) { unpriced++; continue; }
    totalUsd += amt * px; priced++;
  }
  return { totalUsd, priced, unpriced, due: feeSettlementDue(totalUsd) };
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
/** Ramp ranking is by MEASURED effective price against the market rate,
 *  per country — never by headline fee % (price research, 6 Nov 2026:
 *  the global card ramps hide their markup in the FX rate; the worst
 *  measured +106% and another +66% over market in Nigeria while quoting
 *  small "fees"). The per-country assembly lives with the ramp links
 *  below (rampRoutesFor + RAMP_COUNTRY_PLAN); routes carry an explicit
 *  rank, and rankRoutes just honours it for legacy callers. */
export function rankRoutes(routes) {
  return routes.map(r => ({ ...r })).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9));
}

// ---------- Lightning (WebLN: user keeps their own Lightning wallet) ----------
export async function payLightningInvoice(invoice) {
  if (typeof window === "undefined" || !window.webln) {
    throw new Error("No Lightning wallet found. Install Alby or another WebLN wallet, then try again — Fluid never custodies your Lightning funds.");
  }
  await window.webln.enable();
  return window.webln.sendPayment(invoice);
}

// ---------- Lightning, native node (rust-lightning in WASM, lazy chunk) ----------
// Fluid runs its OWN Lightning node, in the browser, from the same seed
// phrase as every other chain. Keys never leave the device; there is no
// custodian, no operator co-signing, no federation — the node is the
// user's, the way the on-chain wallets are. The heavy engine
// (rust-lightning compiled to WASM) lives in a lazily loaded chunk
// (src/lightning-node.js); everything in this section is the pure,
// testable protocol layer around it: BOLT 11 invoice codec, BOLT 12
// offer parsing, BIP-353 resolution, and the async-receive (held HTLC)
// state model from BOLT 12 async payments. The BOLT 11 codec is pinned
// byte-for-byte by the official BOLT 11 spec examples (see tests) and
// cross-checked against the Rust implementation in the chunk.

/** The Lightning seed/storage derivations live in src/ln-derive.js
 *  (re-exported here) so the lazy Lightning chunk can import them
 *  without bundling all of wallet-core. */
export { deriveLightningSeed, deriveLightningStorageKey } from "./ln-derive.js";

// --- 5-bit word <-> byte helpers (BOLT 11 packs its data part as a bit
// stream: words are concatenated as bits and zero-padded to bytes). ---
function wordsToBytesPadded(words) {
  let acc = 0, bits = 0; const out = [];
  for (const w of words) {
    acc = (acc << 5) | (w & 31); bits += 5;
    while (bits >= 8) { bits -= 8; out.push((acc >>> bits) & 0xff); }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out.push((acc << (8 - bits)) & 0xff);
  return Uint8Array.from(out);
}
/** Strict variant for VALUE decoding: N bytes encode to ceil(N*8/5)
 *  words with zero padding bits in the final word; decoding must drop
 *  the partial byte, not materialise it as a trailing zero byte. */
function wordsToBytesStrict(words) {
  const totalBits = words.length * 5;
  const byteLen = Math.floor(totalBits / 8);
  const full = wordsToBytesPadded(words);
  return full.slice(0, byteLen);
}
function bytesToWords(bytes) {
  let acc = 0, bits = 0; const out = [];
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; out.push((acc >>> bits) & 31); }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out.push((acc << (5 - bits)) & 31);
  return out;
}
function wordsToInt(words) {
  let v = 0n;
  for (const w of words) v = (v << 5n) | BigInt(w & 31);
  return v;
}
function intToWords(value, count = 0) {
  let v = BigInt(value); const out = [];
  while (v > 0n) { out.unshift(Number(v & 31n)); v >>= 5n; }
  while (out.length < count) out.unshift(0);
  return out.length ? out : [0];
}
const hexOf = (bytes) => Buffer.from(bytes).toString("hex");
const bytesOfHex = (h) => Uint8Array.from(Buffer.from(String(h || ""), "hex"));

// --- BOLT 11 ---
const BOLT11_PREFIXES = { bc: "mainnet", tb: "testnet", bcrt: "regtest", tbs: "signet" };
const BOLT11_MULT_MSAT = { "": 100000000000n, m: 100000000n, u: 100000n, n: 100n };
function bolt11Hrp(network, amountMsat) {
  if (amountMsat == null) return "ln" + network;
  const a = BigInt(amountMsat);
  if (a <= 0n) throw new Error("Invoice amount must be positive.");
  for (const [suffix, mult] of [["", 100000000000n], ["m", 100000000n], ["u", 100000n], ["n", 100n]]) {
    if (a % mult === 0n) return `ln${network}${a / mult}${suffix}`;
  }
  return `ln${network}${a * 10n}p`; // pico: value is msat*10, always ends in 0
}
function bolt11AmountFromHrp(hrp) {
  const m = /^ln(bcrt|tbs|bc|tb)(\d+)?([munp])?$/.exec(hrp);
  if (!m) throw new Error("That invoice's currency prefix is not recognised.");
  const network = BOLT11_PREFIXES[m[1]];
  if (!m[2]) return { network, amountMsat: null };
  const digits = m[2], mult = m[3] || "";
  if (mult === "p") {
    if (!digits.endsWith("0")) throw new Error("Invalid invoice amount (pico amount must end in 0).");
    return { network, amountMsat: BigInt(digits) / 10n };
  }
  return { network, amountMsat: BigInt(digits) * BOLT11_MULT_MSAT[mult] };
}
const BOLT11_TAGS = { p: 1, s: 16, d: 13, m: 27, n: 19, h: 23, x: 6, c: 24, f: 9, r: 3, "9": 5 };
function bolt11TagWords(tag, value) {
  switch (tag) {
    case "p": case "s": case "h": {
      const b = bytesOfHex(value); if (b.length !== 32) throw new Error(`Invoice field ${tag} must be 32 bytes.`);
      return bytesToWords(b);
    }
    case "n": {
      const b = bytesOfHex(value); if (b.length !== 33) throw new Error("Invoice payee field must be 33 bytes.");
      return bytesToWords(b);
    }
    case "d": return bytesToWords(new TextEncoder().encode(String(value)));
    case "m": return bytesToWords(bytesOfHex(value));
    case "x": case "c": return intToWords(BigInt(value));
    case "f": {
      const prog = bytesToWords(bytesOfHex(value.program || ""));
      return [value.version, ...prog];
    }
    case "r": {
      const entries = value.map((e) => {
        const pk = bytesOfHex(e.pubkey); if (pk.length !== 33) throw new Error("Route hint pubkey must be 33 bytes.");
        let scid;
        if (typeof e.shortChannelId === "string") {
          const [bh, ti, oi] = e.shortChannelId.split("x").map((p) => BigInt(p));
          scid = (bh << 40n) | (ti << 16n) | oi; // blockheight(24) | txindex(24) | output(16)
        } else scid = BigInt(e.shortChannelId);
        const buf = new Uint8Array(51);
        buf.set(pk, 0);
        const dv = new DataView(buf.buffer);
        dv.setBigUint64(33, scid);
        dv.setUint32(41, Number(e.feeBaseMsat));
        dv.setUint32(45, Number(e.feeProportionalMillionths));
        dv.setUint16(49, Number(e.cltvExpiryDelta));
        return buf;
      });
      const all = new Uint8Array(entries.length * 51);
      entries.forEach((b, i) => all.set(b, i * 51));
      return bytesToWords(all);
    }
    case "9": return [...value]; // caller supplies raw 5-bit feature words
    default: throw new Error("Unknown invoice field: " + tag);
  }
}
/** Encode a BOLT 11 invoice. `fields` is an ORDERED array of
 *  [tag, value] pairs (order is significant — it is signed). Signing is
 *  RFC 6979 deterministic ECDSA over secp256k1, exactly per BOLT 11;
 *  pinned byte-for-byte by the spec's own examples in the test suite. */
export function encodeBolt11({ network = "bc", amountMsat = null, timestamp, fields, privKey }) {
  if (!BOLT11_PREFIXES[network]) throw new Error("Unknown invoice network: " + network);
  const hrp = bolt11Hrp(network, amountMsat);
  const words = [...intToWords(BigInt(timestamp), 7)];
  for (const [tag, value] of fields) {
    const data = bolt11TagWords(tag, value);
    words.push(BOLT11_TAGS[tag], data.length >> 5, data.length & 31, ...data);
  }
  const signData = new Uint8Array([...new TextEncoder().encode(hrp), ...wordsToBytesPadded(words)]);
  const hash = sha256(signData);
  const priv = bytesOfHex(privKey);
  const sig = secp256k1.sign(hash, priv, { prehash: false });
  const myPub = hexOf(secp256k1.getPublicKey(priv));
  let recovery = -1;
  for (let rec = 0; rec < 4; rec++) {
    try {
      const pk = secp256k1.Signature.fromBytes(sig, "compact").addRecoveryBit(rec).recoverPublicKey(hash);
      if (pk.toHex() === myPub) { recovery = rec; break; }
    } catch { /* not this recovery id */ }
  }
  if (recovery < 0) throw new Error("Could not determine the invoice signature recovery id.");
  const sigBytes = new Uint8Array(65); sigBytes.set(sig, 0); sigBytes[64] = recovery;
  return bech32.encode(hrp, [...words, ...bytesToWords(sigBytes)], 4000);
}
/** Parse and validate a BOLT 11 invoice (BOLT 11 reader requirements:
 *  exactly one p and one s field, exactly one of d/h, fixed field
 *  lengths, valid signature — the payee is recovered from the signature
 *  or taken from the n field and verified against it). Hostile input:
 *  anything malformed throws; nothing is trusted on shape alone. */
export function parseBolt11(input) {
  let s = String(input || "").trim();
  if (/^lightning:/i.test(s)) s = s.slice(10);
  s = s.toLowerCase();
  let dec;
  try { dec = bech32.decode(s, 8000); }
  catch { throw new Error("That is not a valid BOLT 11 invoice (bech32 checksum failed)."); }
  if (!dec.prefix.startsWith("ln")) throw new Error("That is not a BOLT 11 invoice.");
  const { network, amountMsat } = bolt11AmountFromHrp(dec.prefix);
  const words = dec.words;
  if (words.length < 7 + 104) throw new Error("Invoice is too short to be valid.");
  const timestamp = Number(wordsToInt(words.slice(0, 7)));
  const sigWords = words.slice(words.length - 104);
  const fieldWords = words.slice(7, words.length - 104);
  const sigBytes = wordsToBytesStrict(sigWords);
  if (sigBytes.length !== 65) throw new Error("Invoice signature has the wrong length.");
  const out = {
    network, amountMsat, timestamp,
    paymentHash: null, paymentSecret: null, description: null, descriptionHash: null,
    expirySeconds: 3600, minFinalCltvExpiryDelta: 18, metadata: null,
    fallback: null, routeHints: [], featuresWords: null, payee: null, payeeFromField: false,
  };
  const seen = new Set();
  let i = 0;
  while (i + 2 < fieldWords.length + 0 && i < fieldWords.length) {
    const type = fieldWords[i];
    const len = (fieldWords[i + 1] << 5) | fieldWords[i + 2];
    const data = fieldWords.slice(i + 3, i + 3 + len);
    if (data.length < len) throw new Error("Invoice has a truncated field.");
    i += 3 + len;
    const tagName = Object.keys(BOLT11_TAGS).find((k) => BOLT11_TAGS[k] === type);
    if (!tagName) continue; // unknown fields are skipped, per spec
    if (["p", "s", "d", "h", "n", "x", "c"].includes(tagName)) {
      if (seen.has(tagName)) throw new Error(`Invoice has a duplicate ${tagName} field.`);
      seen.add(tagName);
    }
    const dataBytes = wordsToBytesStrict(data);
    switch (tagName) {
      case "p": if (len !== 52) throw new Error("Invoice payment hash has the wrong length."); out.paymentHash = hexOf(dataBytes.slice(0, 32)); break;
      case "s": if (len !== 52) throw new Error("Invoice payment secret has the wrong length."); out.paymentSecret = hexOf(dataBytes.slice(0, 32)); break;
      case "h": if (len !== 52) throw new Error("Invoice description hash has the wrong length."); out.descriptionHash = hexOf(dataBytes.slice(0, 32)); break;
      case "n": if (len !== 53) throw new Error("Invoice payee field has the wrong length."); out.payee = hexOf(dataBytes.slice(0, 33)); out.payeeFromField = true; break;
      case "d":
        try { out.description = new TextDecoder("utf-8", { fatal: true }).decode(dataBytes); }
        catch { throw new Error("Invoice description is not valid UTF-8."); }
        break;
      case "m": out.metadata = hexOf(dataBytes); break;
      case "x": out.expirySeconds = Number(wordsToInt(data)); break;
      case "c": out.minFinalCltvExpiryDelta = Number(wordsToInt(data)); break;
      case "f": out.fallback = { version: data[0], programWords: data.slice(1) }; break;
      case "9": out.featuresWords = [...data]; break;
      case "r": {
        const bytes = wordsToBytesStrict(data);
        for (let off = 0; off + 51 <= bytes.length; off += 51) {
          const dv = new DataView(bytes.buffer, bytes.byteOffset + off, 51);
          const scid = dv.getBigUint64(33); // entry layout: pubkey(33) | scid(8) | feeBase(4) | feeProp(4) | cltv(2)
          out.routeHints.push({
            pubkey: hexOf(bytes.slice(off, off + 33)),
            shortChannelId: `${scid >> 40n}x${(scid >> 16n) & 0xffffffn}x${scid & 0xffffn}`,
            feeBaseMsat: dv.getUint32(41), feeProportionalMillionths: dv.getUint32(45),
            cltvExpiryDelta: dv.getUint16(49),
          });
        }
        break;
      }
    }
  }
  if (!out.paymentHash) throw new Error("Invoice is missing its payment hash.");
  if (!out.paymentSecret) throw new Error("Invoice is missing its payment secret.");
  if ((out.description == null) === (out.descriptionHash == null))
    throw new Error("Invoice must carry exactly one of a description or a description hash.");
  // Signature: recover the payee (or verify against the n field).
  const signData = new Uint8Array([...new TextEncoder().encode(dec.prefix), ...wordsToBytesPadded(words.slice(0, words.length - 104))]);
  const hash = sha256(signData);
  const sig = sigBytes.slice(0, 64), recId = sigBytes[64];
  if (recId > 3) throw new Error("Invoice signature recovery id is out of range.");
  let recovered;
  try { recovered = secp256k1.Signature.fromBytes(sig, "compact").addRecoveryBit(recId).recoverPublicKey(hash).toHex(); }
  catch { throw new Error("Invoice signature is invalid."); }
  if (out.payeeFromField) {
    // With an n field the signature itself must verify against it.
    let ok = false;
    try { ok = secp256k1.verify(sig, hash, bytesOfHex(out.payee), { prehash: false, format: "compact" }); } catch { ok = false; }
    if (!ok) throw new Error("Invoice signature does not match its stated payee.");
  } else {
    out.payee = recovered;
  }
  out.expiresAt = timestamp + out.expirySeconds;
  return out;
}
/** Has this invoice expired at `nowSec` (default: now)? */
export function bolt11IsExpired(parsed, nowSec = Math.floor(Date.now() / 1000)) {
  return nowSec > parsed.expiresAt;
}

// --- BOLT 12 offers (display/validation layer; the node builds them) ---
// TLV type assignments for the `offer` stream per BOLT 12. Kept in one
// table so it can be audited against the spec / the Rust implementation
// in one place.
export const BOLT12_OFFER_TLV = {
  // Verified against the rust-lightning 0.2.7 OfferTlvStream definition
  // (lightning/src/offers/offer.rs): 16 is paths, 18 is issuer.
  chains: 2, metadata: 4, currency: 6, amount: 8, description: 10,
  features: 12, absoluteExpiry: 14, paths: 16, issuer: 18,
  quantityMax: 20, issuerId: 22,
};
function bigSizeRead(bytes, off) {
  if (off >= bytes.length) throw new Error("Truncated BOLT 12 data.");
  const b = bytes[off];
  if (b < 0xfd) return [BigInt(b), 1];
  if (b === 0xfd) { if (off + 2 >= bytes.length) throw new Error("Truncated BOLT 12 data."); return [BigInt((bytes[off + 1] << 8) | bytes[off + 2]), 3]; }
  if (b === 0xfe) { if (off + 4 >= bytes.length) throw new Error("Truncated BOLT 12 data."); return [BigInt(new DataView(bytes.buffer, bytes.byteOffset + off + 1, 4).getUint32(0)), 5]; }
  if (off + 8 >= bytes.length) throw new Error("Truncated BOLT 12 data.");
  return [new DataView(bytes.buffer, bytes.byteOffset + off + 1, 8).getBigUint64(0), 9];
}
function tu64(bytes) { let v = 0n; for (const b of bytes) v = (v << 8n) | BigInt(b); return v; }
/** Parse a BOLT 12 offer (lno1…) into its displayable fields. The offer
 *  is an unsigned TLV stream; its id is the SHA-256 of the stream. Only
 *  known fields are surfaced; unknown TLVs are reported, never trusted
 *  silently. Full payment handling lives in the node chunk — this is
 *  the validation/display layer the wallet UI and BIP-353 resolver use
 *  before an offer is shown or handed to the node. */
export function parseBolt12Offer(input) {
  let s = String(input || "").trim();
  if (/^lightning:/i.test(s)) s = s.slice(10);
  s = s.toLowerCase();
  let dec;
  try { dec = bech32m.decode(s, 8000); }
  catch { throw new Error("That is not a valid BOLT 12 string (bech32m checksum failed)."); }
  const kind = { lno: "offer", lnr: "invoice_request", lni: "invoice" }[dec.prefix];
  if (!kind) throw new Error("That is not a BOLT 12 string.");
  const bytes = wordsToBytesStrict(dec.words);
  const out = {
    kind, raw: s, chains: null, metadata: null, currency: null, amountMsat: null,
    description: null, featuresHex: null, absoluteExpiry: null, issuer: null,
    hasPaths: false, quantityMax: null, issuerId: null, unknownTlvs: [],
    offerId: kind === "offer" ? hexOf(sha256(bytes)) : null,
  };
  if (kind !== "offer") return out;
  const nameByType = Object.fromEntries(Object.entries(BOLT12_OFFER_TLV).map(([k, v]) => [v, k]));
  let off = 0, lastType = -1n;
  while (off < bytes.length) {
    const [type, tLen] = bigSizeRead(bytes, off); off += tLen;
    const [len, lLen] = bigSizeRead(bytes, off); off += lLen;
    const n = Number(len);
    if (off + n > bytes.length) throw new Error("BOLT 12 offer has a truncated TLV record.");
    const value = bytes.slice(off, off + n); off += n;
    if (type <= lastType) throw new Error("BOLT 12 offer TLV records are out of order or duplicated.");
    lastType = type;
    const name = nameByType[Number(type)];
    switch (name) {
      case "chains": out.chains = []; for (let k = 0; k + 32 <= value.length; k += 32) out.chains.push(hexOf(value.slice(k, k + 32))); break;
      case "metadata": out.metadata = hexOf(value); break;
      case "currency": out.currency = new TextDecoder().decode(value.slice(0, 3)); break;
      case "amount": out.amountMsat = tu64(value); break;
      case "description":
        try { out.description = new TextDecoder("utf-8", { fatal: true }).decode(value); }
        catch { throw new Error("Offer description is not valid UTF-8."); }
        break;
      case "features": out.featuresHex = hexOf(value); break;
      case "absoluteExpiry": out.absoluteExpiry = Number(tu64(value)); break;
      case "issuer":
        try { out.issuer = new TextDecoder("utf-8", { fatal: true }).decode(value); }
        catch { throw new Error("Offer issuer is not valid UTF-8."); }
        break;
      case "paths": out.hasPaths = true; break;
      case "quantityMax": out.quantityMax = tu64(value); break;
      case "issuerId": if (value.length === 33) out.issuerId = hexOf(value); break;
      default: out.unknownTlvs.push({ type: Number(type), length: n });
    }
  }
  return out;
}

// --- BIP-353 (DNS payment instructions) ---
/** Resolve a BIP-353 address (₿user@domain or user@domain) to the
 *  BOLT 12 offer published in its DNS TXT record. Uses DNS-over-HTTPS
 *  (Cloudflare) because browsers cannot do raw DNS. The returned offer
 *  is validated with parseBolt12Offer before it is trusted — DNS is
 *  hostile input like everything else on the wire. */
export async function resolveBip353Address(address, dohUrl = "https://cloudflare-dns.com/dns-query") {
  let a = String(address || "").trim().replace(/^₿/, "");
  const m = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/.exec(a);
  if (!m) throw new Error("That is not a payment address (name@domain).");
  const qname = `_bitcoin-payment.${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  let res;
  try {
    res = await fetch(`${dohUrl}?name=${encodeURIComponent(qname)}&type=TXT`, { headers: { Accept: "application/dns-json" } });
  } catch (e) { throw new Error("DNS lookup for that address failed."); }
  if (!res.ok) throw new Error("DNS lookup for that address failed.");
  const j = await res.json();
  const answers = (j.Answer || []).filter((r) => r.type === 16);
  for (const r of answers) {
    const txt = String(r.data || "").replace(/"\s*/g, "").replace(/"/g, "");
    if (!/^bitcoin:/i.test(txt)) continue;
    const query = txt.slice(txt.indexOf("?") + 1);
    const params = new URLSearchParams(query);
    const lno = params.get("lno");
    if (lno) {
      const offer = parseBolt12Offer(decodeURIComponent(lno));
      return { address: a, offer: offer.raw, parsedOffer: offer, txt };
    }
    const lnp = params.get("lnp");
    if (lnp) return { address: a, invoice: decodeURIComponent(lnp), txt };
  }
  throw new Error("No BIP-353 payment instructions are published for that address.");
}

/** Classify anything a user pastes into the Lightning sheet so the UI
 *  routes it correctly: BOLT 11 invoice, BOLT 12 offer, a name@domain
 *  address (BIP-353 first, LNURL-pay fallback), or a Fluid name. */
export function classifyLightningTarget(input) {
  const s = String(input || "").trim();
  const body = s.replace(/^lightning:/i, "");
  if (/^ln(bc|tb|bcrt|tbs)/i.test(body)) return { kind: "bolt11", value: body };
  if (/^lno1/i.test(body)) return { kind: "bolt12", value: body };
  if (/^lnr1/i.test(body) || /^lni1/i.test(body)) return { kind: "bolt12-other", value: body };
  if (/^₿?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { kind: "address", value: s.replace(/^₿/, "") };
  if (validateFluidName(normalizeFluidName(s))) return { kind: "fluid-name", value: normalizeFluidName(s) };
  return { kind: "unknown", value: s };
}

// --- BOLT 12 async payments: the held-HTLC receive model ---
// A payment to the user's offer while Fluid is closed is HELD by the
// user's own channel peer as a time-locked HTLC. The holder can only
// delay — it cannot settle (it never learns the preimage), redirect, or
// keep the funds past the hold window the user's OWN invoice chose; on
// timeout the sender is automatically refunded. Fluid must be open to
// SETTLE, not to receive. See
// research_notes/fluid-lightning-offline-receive-20261106-2119.
export const ASYNC_PAY_HOLD = { defaultHours: 24, maxHours: 72, minHours: 1 };
export function validateHoldHours(hours) {
  const h = Math.floor(Number(hours));
  if (!Number.isFinite(h) || h < ASYNC_PAY_HOLD.minHours || h > ASYNC_PAY_HOLD.maxHours) {
    throw new Error(`Hold window must be between ${ASYNC_PAY_HOLD.minHours} and ${ASYNC_PAY_HOLD.maxHours} hours.`);
  }
  return h;
}
/** The plain-language promise shown wherever the offer is shared. */
export function holdWindowCopy(hours = ASYNC_PAY_HOLD.defaultHours) {
  validateHoldHours(hours);
  return `Payments sent to this offer while Fluid is closed can wait up to ${hours} hour${hours === 1 ? "" : "s"} for you to open Fluid. The peer holding them cannot take or redirect them — it can only wait. If you don't open Fluid in time, the payment is automatically returned to the sender.`;
}
/** Summarise payments currently held for this wallet (pure; the node
 *  chunk supplies the records). */
export function summariseHeldPayments(held, nowSec = Math.floor(Date.now() / 1000)) {
  const list = Array.isArray(held) ? held : [];
  let totalMsat = 0n; let nextExpirySec = null; let expired = 0;
  for (const h of list) {
    totalMsat += BigInt(h.amountMsat || 0);
    if (h.holdExpiresAtSec != null) {
      if (h.holdExpiresAtSec <= nowSec) expired++;
      else if (nextExpirySec == null || h.holdExpiresAtSec < nextExpirySec) nextExpirySec = h.holdExpiresAtSec;
    }
  }
  return { count: list.length, totalMsat, nextExpirySec, expiredUnswept: expired };
}

/** Normalise ANY thrown value from the Lightning node into a
 *  displayable message (QA F6, 2026-11-07). The WASM node throws
 *  plain STRINGS (JsValue), not Error objects — reading `.message`
 *  off one yields undefined and the panel rendered a silent blank.
 *  This never returns an empty string: unknown failures get a plain
 *  fallback with a recovery verb. */
export function lnErrorText(e) {
  let s = "";
  if (typeof e === "string") s = e;
  else if (e && typeof e.message === "string") s = e.message;
  s = String(s || "").trim();
  if (!s || s === "undefined" || s === "null") return "Something went wrong — please try again.";
  return s;
}
/** Validate the offline-offer blinded-paths input BEFORE it reaches
 *  JSON.parse (QA F7, 2026-11-07): an empty box used to surface the
 *  raw "Unexpected end of JSON input" SyntaxError. Every failure
 *  here is a friendly, specific message; success returns the list of
 *  hex path strings the node expects. */
export function parseSisPathsInput(text) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Paste the blinded-path list from your holding peer first.");
  let parsed;
  try { parsed = JSON.parse(t); }
  catch { throw new Error("That doesn't look like the blinded-path list — paste the full JSON list from your holding peer, exactly as they gave it."); }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error("Paste the blinded-path list from your holding peer first.");
  for (const p of parsed) {
    if (typeof p !== "string" || !/^(?:[0-9a-fA-F]{2})+$/.test(p.trim())) {
      throw new Error("One of those entries isn't a blinded path — paste the list exactly as your holding peer gave it.");
    }
  }
  return parsed.map(p => p.trim());
}
/** The Lightning receive display as a tiny state machine (QA F6):
 *  idle → working → ready | failed. The panel renders ONLY from
 *  lnReceiveView(state), so there is no path to a silent blank:
 *  working always shows its spinner line, ready always carries a
 *  non-empty payload (an empty payload from the node is a failure,
 *  not a blank QR), and failed always carries a message. */
export function lnReceiveTransition(state, action) {
  if (!action || typeof action.type !== "string") return state || { status: "idle" };
  if (action.type === "request") return { status: "working" };
  if (action.type === "success") {
    const text = String(action.text || "").trim();
    if (!text) return { status: "failed", message: "The node returned an empty result — wait a moment and try again." };
    return { status: "ready", text };
  }
  if (action.type === "failure") return { status: "failed", message: lnErrorText(action.error) };
  if (action.type === "reset") return { status: "idle" };
  return state || { status: "idle" };
}
/** What the panel paints for a receive state: exactly one of a
 *  spinner flag, a payload, or a message is live at a time. */
export function lnReceiveView(state) {
  const s = state && typeof state.status === "string" ? state : { status: "idle" };
  if (s.status === "working") return { status: "working", spinner: true, text: null, message: null };
  if (s.status === "ready") return { status: "ready", spinner: false, text: s.text, message: null };
  if (s.status === "failed") return { status: "failed", spinner: false, text: null, message: s.message || "Something went wrong — please try again." };
  return { status: "idle", spinner: false, text: null, message: null };
}

// ---------- Global ramps: Fluid routes, providers settle (users KYC with them) ----------
// Local-currency rails: pick a country, Fluid builds the provider link with
// that country's ISO code so the user deposits/withdraws in THEIR currency
// (NGN, KES, GHS, ZAR, USD, EUR...). The global providers cover 150-180+
// countries each. Fluid never touches the fiat itself. (The African
// corridors' former rail was pulled on 2026-11-08 — see the PULLED note
// in the per-country plan comments below.)
export const RAMP_COUNTRIES = [
  { code: "NG", name: "Nigeria · NGN", fiat: "NGN" },
  { code: "KE", name: "Kenya · KES", fiat: "KES" },
  { code: "GH", name: "Ghana · GHS", fiat: "GHS" },
  { code: "ZA", name: "South Africa · ZAR", fiat: "ZAR" },
  { code: "UG", name: "Uganda · UGX", fiat: "UGX" },
  { code: "TZ", name: "Tanzania · TZS", fiat: "TZS" },
  { code: "CM", name: "Cameroon · XAF", fiat: "XAF" },
  { code: "SN", name: "Senegal · XOF", fiat: "XOF" },
  { code: "CI", name: "Côte d'Ivoire · XOF", fiat: "XOF" },
  { code: "ZM", name: "Zambia · ZMW", fiat: "ZMW" },
  { code: "US", name: "United States · USD", fiat: "USD" },
  { code: "GB", name: "United Kingdom · GBP", fiat: "GBP" },
  { code: "DE", name: "Germany · EUR", fiat: "EUR" },
  { code: "IN", name: "India · INR", fiat: "INR" },
  { code: "BR", name: "Brazil · BRL", fiat: "BRL" },
  { code: "PH", name: "Philippines · PHP", fiat: "PHP" },
  { code: "ID", name: "Indonesia · IDR", fiat: "IDR" },
  { code: "MX", name: "Mexico · MXN", fiat: "MXN" },
  // Corridor extensions (global ramp scout, 2026-11-09): Canada,
  // Australia and Singapore, then the rest of the EEA beyond DE,
  // all on the same Mt Pelerin preset DE already uses (see the
  // plan entries below). BG/RO/IS ride the EUR preset: their own
  // currencies are not Mt Pelerin fiats, but all three sit inside
  // SEPA, so an EUR transfer is the real route for them.
  { code: "CA", name: "Canada · CAD", fiat: "CAD" },
  { code: "AU", name: "Australia · AUD", fiat: "AUD" },
  { code: "SG", name: "Singapore · SGD", fiat: "SGD" },
  { code: "AT", name: "Austria · EUR", fiat: "EUR" },
  { code: "BE", name: "Belgium · EUR", fiat: "EUR" },
  { code: "BG", name: "Bulgaria · EUR", fiat: "EUR" },
  { code: "CY", name: "Cyprus · EUR", fiat: "EUR" },
  { code: "CZ", name: "Czechia · CZK", fiat: "CZK" },
  { code: "DK", name: "Denmark · DKK", fiat: "DKK" },
  { code: "EE", name: "Estonia · EUR", fiat: "EUR" },
  { code: "ES", name: "Spain · EUR", fiat: "EUR" },
  { code: "FI", name: "Finland · EUR", fiat: "EUR" },
  { code: "FR", name: "France · EUR", fiat: "EUR" },
  { code: "GR", name: "Greece · EUR", fiat: "EUR" },
  { code: "HR", name: "Croatia · EUR", fiat: "EUR" },
  { code: "HU", name: "Hungary · HUF", fiat: "HUF" },
  { code: "IE", name: "Ireland · EUR", fiat: "EUR" },
  { code: "IS", name: "Iceland · EUR", fiat: "EUR" },
  { code: "IT", name: "Italy · EUR", fiat: "EUR" },
  { code: "LI", name: "Liechtenstein · CHF", fiat: "CHF" },
  { code: "LT", name: "Lithuania · EUR", fiat: "EUR" },
  { code: "LU", name: "Luxembourg · EUR", fiat: "EUR" },
  { code: "LV", name: "Latvia · EUR", fiat: "EUR" },
  { code: "MT", name: "Malta · EUR", fiat: "EUR" },
  { code: "NL", name: "Netherlands · EUR", fiat: "EUR" },
  { code: "NO", name: "Norway · NOK", fiat: "NOK" },
  { code: "PL", name: "Poland · PLN", fiat: "PLN" },
  { code: "PT", name: "Portugal · EUR", fiat: "EUR" },
  { code: "RO", name: "Romania · EUR", fiat: "EUR" },
  { code: "SE", name: "Sweden · SEK", fiat: "SEK" },
  { code: "SI", name: "Slovenia · EUR", fiat: "EUR" },
  { code: "SK", name: "Slovakia · EUR", fiat: "EUR" },
];
// Mt Pelerin: the consumer site IS the checkout (no account, no partner
// key). URL params prefill the fiat + crypto pair (bsc/bdc buy, ssc/sdc
// sell — official parameter docs). Only 18 fiats are supported; any other
// currency returns null so the sheet can say so honestly instead of
// linking to a broken prefill.
export const MTPELERIN_FIATS = ["AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "JPY", "MXN", "NOK", "NZD", "PLN", "SEK", "SGD", "USD", "ZAR"];
const MTPELERIN_SLUGS = {
  USDT: { buy: "buy-tether-usdt", sell: "sell-tether-usdt" },
  USDC: { buy: "buy-usdc", sell: "sell-usdc" },
};
// Mt Pelerin referral code (Ethuram's own account, supplied 2026-11-07).
// Mt Pelerin pays 25% of the fees it charges referred users back to the
// referrer, taken from ITS cut — the user's price never changes. Paid
// monthly in USDC on Polygon to the address registered in his Bridge
// Wallet. Keyless: just the rfr param on the links Fluid already builds.
export const MTPELERIN_REFERRAL_CODE = "Fp3dGFX3";
export function mtpelerinBuyUrl(asset = "USDT", fiat = "EUR") {
  const slugs = MTPELERIN_SLUGS[asset];
  if (!slugs || !MTPELERIN_FIATS.includes(fiat)) return null;
  const p = new URLSearchParams({ bsc: fiat, bdc: asset, rfr: MTPELERIN_REFERRAL_CODE });
  return `https://www.mtpelerin.com/${slugs.buy}?${p.toString()}`;
}
export function mtpelerinSellUrl(asset = "USDT", fiat = "EUR") {
  const slugs = MTPELERIN_SLUGS[asset];
  if (!slugs || !MTPELERIN_FIATS.includes(fiat)) return null;
  const p = new URLSearchParams({ ssc: asset, sdc: fiat, rfr: MTPELERIN_REFERRAL_CODE });
  return `https://www.mtpelerin.com/${slugs.sell}?${p.toString()}`;
}
/** Fonbnk off-ramp (SELL) widget link, built per selection — the
 *  pre-pull shape, restored 2026-11-09: /offramp carries only
 *  network / asset / paymentChannel / countryIsoCode (the
 *  address / source / signature params are KYB-merchant-gated,
 *  so no keyless pre-fill exists). Returns null on any network
 *  Fonbnk does not support — the caller omits the row there.
 *  The channel is per country: bank where Fonbnk runs a bank
 *  off-ramp channel (NG, KE, ZA), mobile_money where the
 *  off-ramp is mobile-money only (GH, UG, TZ, CM, SN, CI, ZM) —
 *  per Fonbnk's own supported-countries table, re-verified
 *  2026-11-09. Sell only: this builder is never used for a buy
 *  sheet (see the RESTORED note in the plan comments). */
export const FONBNK_OFFRAMP_CHANNELS = {
  NG: "bank", KE: "bank", ZA: "bank",
  GH: "mobile_money", UG: "mobile_money", TZ: "mobile_money",
  CM: "mobile_money", SN: "mobile_money", CI: "mobile_money",
  ZM: "mobile_money",
};
export function fonbnkOfframpUrl(networkKey, asset = "USDC", country = "NG") {
  const net = NETWORKS[networkKey];
  const channel = FONBNK_OFFRAMP_CHANNELS[country];
  if (!net?.fonbnkNetwork || !channel) return null;
  const p = new URLSearchParams({ network: net.fonbnkNetwork, asset, paymentChannel: channel, countryIsoCode: country });
  return `https://pay.fonbnk.com/offramp?${p.toString()}`;
}

// ---------- Per-country ramp plan: ranked on MEASURED price ----------
// Evidence base: price research of 6 Nov 2026 (benchmarks: USD/NGN
// mid-market ₦1,374, P2P street ₦1,376–1,380; KES 129.91; GHS 11.66;
// ZAR 16.51). Rules the plan encodes:
//  - The CHEAPEST badge is governed by the global badge rule
//    (audit P0-4, 2026-11-09): it may sit on a route only if that
//    route, on that side of that corridor, is Class 1 (transact
//    page), completes at the corridor's small-ticket size, and is
//    cheapest among routes satisfying both — encoded per-mode via
//    badgeModes on the plan rows below.
//  - One launch provider is GONE everywhere: its only measured
//    corridor was Nigeria at +106% over market and it publishes no
//    rates anywhere, so no corridor can carry it on price evidence.
//  - Paychant stays out: its guest widget returned 502, then 404
//    (502 again on the 7 Nov 2026 recheck; its docs also require a
//    production API key, so the "guest" link was never truly keyless).
//  - PULLED 2026-11-08 — Fonbnk and Mercuryo (owner's decision,
//    Ethuram): both platforms pay Fluid nothing Fluid can actually
//    collect, so they were out of EVERY corridor under the rule
//    "no pay, no route". RESTORED IN PART 2026-11-09 (owner's
//    ruling): the fee-capture gate (superseded the same day by
//    the owner's capture GATE — see the gate note above the plan)
//    no longer strands a corridor — a route that genuinely
//    completes comes back with full disclosure, and fee capture
//    stays the preference.
//    Fonbnk SELL returns on its ten pre-pull corridors (NG, KE,
//    GH, ZA, UG, TZ, CM, SN, CI, ZM) as unbadged external rows
//    with full disclosure, on fresh live evidence: the widget
//    walked end-to-end (amount → email verification → payout
//    details → deposit address) with live quotes at or near the
//    market (NG ₦1,371.50/$ vs the ₦1,378.14 P2P composite) —
//    full evidence in
//    research_notes/fluid-fonbnk-restore-20261109/report.md.
//    Fonbnk BUY stays out: walked live the same day, its wallet
//    step offers WalletConnect ONLY in the keyless widget (no
//    paste-address field), and the owner's standing criterion
//    excludes WalletConnect-only buys whatever their price; its
//    NG buy KYC (BVN from $1, hosted photo ID from $15) is the
//    provider's own and is recorded in the restore report for
//    the owner's decision. Mercuryo stays OUT entirely: its sell
//    settles only in EUR/USD/GBP to a card (Nigeria: Visa only),
//    never NGN to a bank account — no completable NG sell exists
//    to restore. Wiring facts for Fonbnk, kept from the pre-pull
//    build and re-verified at the restore:
//      Fonbnk — widget at pay.fonbnk.com: the ROOT path is the buy
//      flow (the old /onramp path is dead) and /offramp is the sell
//      flow; links carry only network / asset / countryIsoCode
//      (sell adds paymentChannel — bank where a bank off-ramp
//      channel exists: NG, KE, ZA; mobile_money where it does
//      not: GH, UG, TZ, CM, SN, CI, ZM). Network codes: ethereum
//      ETHEREUM, bsc BNB, base BASE, arbitrum ARBITRUM, polygon
//      POLYGON — any other Fluid network is unsupported and its
//      row is omitted. The address / source / signature /
//      freezeWallet params are gated behind a KYB-verified
//      merchant account, so no keyless pre-fill exists; buy
//      delivery in the keyless widget is WalletConnect only
//      (walked live 2026-11-09), $500 per-order cap, NG buy KYC
//      tops out at BVN number + hosted photo ID, agent fulfilment
//      in minutes (not instant); sell needs no wallet connection
//      at all (email code + payout details, they return a deposit
//      address the user sends to FROM Fluid). Partner fees are
//      KYB + server-signed-JWT gated — that is exactly why Fluid
//      earns nothing from it, and the restored rows say so.
//      Mercuryo — plain static links (mercuryo.io, both modes);
//      published fees buy 3.95% / sell 2.95%, ID required, sell
//      pays EUR/USD/GBP to a card; its partner programme is
//      B2B/KYB-only with no attachable consumer referral.
//  - Noblocks REMOVED 7 Nov 2026 as a Fluid ROUTE: BVN wall up
//    front, and the owner's live attempt died on its own verify
//    button. REVERSED IN PART 2026-11-09 (owner decision, NG
//    repair): it returned on the NG SELL sheet only, explicitly
//    as an EXTERNAL app that paid Fluid nothing. REMOVED AGAIN
//    2026-11-09 under the owner's CAPTURE GATE (~13:51 WAT): a
//    route stays wired ONLY IF it carries Fluid's referral /
//    affiliate / split natively OR a non-custodial own-charge
//    mechanism exists for its shape — Noblocks has no referral
//    parameter (measured) and its hosted/link-out shape admits
//    no own-charge mechanism in the non-custodial ramp-fee design
//    study, so it came off in full (plan row, static link,
//    address-entry, default note — the NoOnes-pull pattern). NG
//    sell is Fonbnk-only until the in-Fluid Paycrest Gateway
//    sell (native senderFee capture, Class 1) passes its last
//    gate. History only — no route, link, note or caps entry
//    for it remains below.
//  - NoOnes was ADDED 7 Nov 2026 as the Nigeria BUY lead and
//    REMOVED 2026-11-09: the platform announced its winding-down
//    on 17 Aug 2026, closed P2P trading permanently on 21 Aug
//    2026, and has been withdrawal-only since 22 Aug 2026 — a
//    dead platform cannot stay on a user-facing route list
//    (owner's standing rule: no pay, no route; dead providers
//    come off). NG buy now resolves to the same honest empty
//    state NG sell already showed, until a qualifying route
//    exists. History only — no route, link, note or caps entry
//    for it remains below.
// Direct consumer links whose URL doesn't depend on the selection
// (Mt Pelerin links are built per selection above).
// PULLED 2026-11-09 under the owner's CAPTURE GATE (owner ruling
// ~14:34 WAT, strictly by the gate): Paybis and Spritz were
// removed in full — every plan row, note, link and address-entry
// entry — because as wired they pay Fluid nothing and no
// non-custodial own-charge mechanism exists for their hosted
// shapes. RE-ADD FACTS: Paybis returns only when its Affise
// programme actually issues Fluid a live tracking link (20% of
// commission, lifetime, $50 minimum payout — the account sat on
// moderation, so no live link existed); Spritz returns only if
// its referral unlocks without the owner-KYC ≥$200/60d gate.
// The table stays (empty) so the assembly code path is unchanged.
export const RAMP_STATIC_LINKS = {
};
// A default note is either one string (used on both sheets) or a
// per-mode { buy, sell } object — rampRoutesFor selects by mode so
// a sell sheet never leads with buy copy (audit P1-11). The
// per-mode strings below carry the $1-rule disclosure fix F1
// (2026-11-09): true minimums in-sheet, per side. (The F2/F3
// strings specced for Paybis/Spritz were superseded the same day
// by the owner's capture-gate removal of both providers — they
// never shipped.)
const RAMP_DEFAULT_NOTES = {
  "Mt Pelerin": {
    buy: "No ID needed for bank transfers up to ~CHF 999/month · 0% fee on your first CHF 500/year · then 0–1.3% by bank · buys start at CHF 1 · unverified purchases are held 7 days before delivery",
    sell: "Sells start at CHF 50 (about $57) unless you hold a personal IBAN with them · sell fee 0–1.3% by bank · no ID needed for bank transfers up to ~CHF 999/month",
  },
  "Fonbnk": "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your payout details, and Fonbnk gives you an address to send to from Fluid · priced off the local market — check the quote before you send",
};
// The SWIFT addendum (audit P1-12): on the 12 own-fiat Mt Pelerin
// corridors flagged `swift: true` in the plan, a bank-transfer buy
// from a bank outside the currency's home area usually rides
// SWIFT, and the user's own bank + intermediaries take "a few $
// to several dozen $" — a fixed cost that can exceed a small
// purchase. rampRoutesFor appends this to the Mt Pelerin BUY
// note only, on flagged corridors only; the SEPA corridors are
// exempt by fact (SEPA/SIC transfers are free/cheap).
const RAMP_SWIFT_BUY_NOTE = "paying from a bank outside this currency's home area usually rides SWIFT — your bank's international transfer fee applies and can exceed a small purchase";
/** How each provider takes the destination address on a BUY:
 *  "paste" = the user can type/paste their Fluid address and the
 *  route delivers there; "walletconnect" = the flow forces a
 *  WalletConnect connection to an external wallet instead. The
 *  owner's standing criterion (corrected 7 Nov 2026, from his own
 *  live tap-test): a WalletConnect-only buy route is OUT, whatever
 *  its price — it forces users out of Fluid to buy for Fluid. An
 *  ID check (BVN/KYC) alone does NOT disqualify a "paste" route.
 *  rampRoutesFor's buy assembly consults this table, and the tests
 *  pin it, so a future route cannot silently reintroduce a
 *  WalletConnect-only buy. A plan row may override the provider
 *  default for its ONE corridor via `addressEntry` where
 *  corridor-level evidence shows a paste path the global reading
 *  missed; the override is per-row, never global, and every route
 *  object carries its effective entry as `addressEntry`. */
export const RAMP_ADDRESS_ENTRY = {
  "Mt Pelerin": "paste",
  // Fonbnk is listed SELL-only (restored 2026-11-09): on a sell
  // there is no destination address at all — Fonbnk returns a
  // deposit address and the user sends to it FROM Fluid. The
  // entry records that deposit-address model; the buy side is
  // excluded by the plan rows' modes and by an explicit sell-only
  // guard in rampRoutesFor, so the buy gate never sees it either.
  "Fonbnk": "deposit-address",
};
// CAPTURE GATE (owner's ruling, 2026-11-09 ~13:51 WAT): a ramp
// route stays wired ONLY IF (a) it carries Fluid's referral /
// affiliate / split natively, OR (b) a non-custodial own-charge
// mechanism exists for its shape under the ramp-fee design study
// (research_notes/fluid-noncustodial-ramp-fee-20261109), sized by
// the fee law and disclosed in-sheet. Otherwise the route is
// REMOVED and the side shows the honest empty state — the old
// "Fluid earns nothing from it" fallback class is abolished.
// Application in this plan: Mt Pelerin keeps both sides via (a)
// (rfr=Fp3dGFX3 pays 25% of its fees); Fonbnk keeps its sell rows
// via (b) — its deposit-address shape is exactly what the design
// study's "Ramp own-charge Tier 1/2" build covers (Permit2
// signed batch split on EVM; Solana native multi-instruction
// variant; Tier 2 sequential fallback), and that build is the
// NAMED, SEQUENCED DEPENDENCY of this wiring: it lands with this
// disclosure release train, and when it ships, every Fonbnk
// note's interim wording is replaced by the standing disclosure
// already carried in the row notes ("Fluid adds its own small
// fee on top of Fonbnk's quote — shown in the send review before
// you confirm · Fonbnk's quote itself is never reduced"). The
// Paycrest Gateway sell is the gate's model citizen (native
// senderFee) and NG sell's Class-1 end-state behind its gates.
// Paybis and Spritz were REMOVED in full by the owner's
// capture-gate ruling (2026-11-09 ~14:34 WAT) — see the PULLED
// note above RAMP_STATIC_LINKS for the re-add facts.
//
// Ordered provider list per country: [name, { badge, badgeModes,
// note, swift, … }]. Order IS the ranking (cheapest measured
// first); badge/note override the provider defaults above. The
// CHEAPEST badge is per-mode (audit P0-4): badgeModes lists the
// modes on which the row may carry it — a platform may hold it on
// the buy sheet and not the sell sheet of the same corridor.
// `swift: true` flags the own-fiat Mt Pelerin corridors whose
// bank-transfer buys usually ride SWIFT (audit P1-12).
export const RAMP_COUNTRY_PLAN = {
  // NG: BUY has no qualifying route (its last route was removed
  // 2026-11-09 as a dead platform — see the REMOVED note above;
  // Fonbnk buy was re-checked live the same day and is
  // WalletConnect-only in the keyless widget, so it stays out
  // under the owner's standing buy criterion) and stays honestly
  // empty. SELL carries Fonbnk ONLY (restored 2026-11-09, owner's
  // ruling — see the RESTORED note in the plan comments): a
  // deposit-address sell where the money leaves Fluid directly,
  // walked live at ₦1,371.50/$ against the ₦1,378.14 composite,
  // no ID check on Nigeria sell orders, bank minimum ₦5,000
  // (≈$3.65) enforced live in the widget. Fonbnk is kept under
  // clause (b) of the owner's capture gate (2026-11-09 ~13:51):
  // the non-custodial own-charge mechanism for its deposit-
  // address shape is the FOLLOW-ON BUILD "Ramp own-charge
  // Tier 1/2" (Permit2 signed batch split on EVM, Solana native
  // multi-instruction variant, Tier 2 sequential fallback),
  // sequenced WITH this disclosure release — see the gate note
  // above the plan. The second NG sell row that stood here was
  // removed in full under that gate the same day (no referral
  // parameter exists for it, and its hosted shape admits no
  // own-charge mechanism); NG sell is Fonbnk-only until the
  // in-Fluid Paycrest Gateway sell (same protocol family, native
  // fee capture) passes its standing gates — see
  // research_notes/fluid-ng-repair-20261109/report.md.
  NG: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your bank details, and Fonbnk gives you an address to send to from Fluid — no ID check on Nigeria sell orders · bank sells start at ₦5,000 (about $3.65) · priced off the local market — check the quote before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  // KE, GH, UG, TZ, CM, SN, CI, ZM: BUY resolves empty (Fonbnk
  // buy stays out — see the NG note). SELL carries the restored
  // Fonbnk row (2026-11-09): deposit-address model, off-ramp
  // KYC off in all of them (Fonbnk's own country pages +
  // platform KYC page, re-verified 2026-11-09), live quotes
  // spot-checked for KE (1 USDT ≈ 128.41 KES vs the 130.0
  // benchmark) and GH (11.99 GHS, mobile money only — Ghana has
  // no bank off-ramp channel, so the link preselects
  // mobile_money and the note says where the money lands).
  KE: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your bank or M-PESA details, and Fonbnk gives you an address to send to from Fluid — no ID check on Kenya sell orders · sells start at about $1 · priced off the local market — check the quote before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  GH: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Ghana sell orders · sells start at about $1 · Ghana pays to mobile money, not to a bank account · priced off the local market — check the quote before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  ZA: [
    ["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }],
    // Fonbnk sell restored 2026-11-09: South
    // Africa is the ONE corridor where Fonbnk switches sell-side
    // KYC on (basic ID check from $1 — its own country page), so
    // the note discloses it; live quote the same day was
    // 1 USDT ≈ 16.11 ZAR.
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your bank details, and Fonbnk gives you an address to send to from Fluid — South Africa sell orders need an ID check · priced off the local market — check the quote before you send · Fonbnk sets its own minimum inside the widget — it is shown before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  UG: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Uganda sell orders · sells start at about $1 · priced off the local market — check the quote before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  TZ: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Tanzania sell orders · sells start at about $1 · priced off the local market — check the quote before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  CM: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Cameroon sell orders · priced off the local market — check the quote before you send · Fonbnk sets its own minimum inside the widget — it is shown before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  SN: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Senegal sell orders · priced off the local market — check the quote before you send · Fonbnk sets its own minimum inside the widget — it is shown before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  CI: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Côte d'Ivoire sell orders · priced off the local market — check the quote before you send · Fonbnk sets its own minimum inside the widget — it is shown before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  ZM: [
    ["Fonbnk", { modes: ["sell"], external: true, addressEntry: "deposit-address", note: "Opens the Fonbnk app — Fluid earns nothing from it · you verify an email, give your mobile money details, and Fonbnk gives you an address to send to from Fluid — no ID check on Zambia sell orders · priced off the local market — check the quote before you send · Fonbnk sets its own minimum inside the widget — it is shown before you send · Fluid adds its own small fee on top of Fonbnk's quote — shown in the send review before you confirm · Fonbnk's quote itself is never reduced" }],
  ],
  US: [
    // Mt Pelerin EXCLUDES US persons, so it stays listed, flagged,
    // for non-US users paying in USD — it can never lead or badge
    // here. The corridor's two paying-nothing routes were removed
    // under the capture gate (2026-11-09), so the US sheet
    // otherwise resolves to the honest empty state on both sides.
    ["Mt Pelerin", { unavailable: true, note: "Not available to US residents — if you're outside the US: no ID needed for bank transfers up to ~CHF 999/month · 0% fee on your first CHF 500/year · then 0–1.3% by bank" }],
  ],
  GB: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  DE: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  // IN, BR, PH, ID: their only route was removed under the
  // capture gate (2026-11-09) — both sides resolve to the honest
  // empty state until a capture-clean route exists.
  IN: [],
  BR: [],
  PH: [],
  ID: [],
  MX: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  // Corridor extensions (global ramp scout, 2026-11-09; approved
  // by the owner's standing rule the same day): the existing Mt
  // Pelerin referral preset extended beyond DE — the remaining
  // EEA on the EUR/SEPA preset (its own Mt Pelerin fiat where one
  // exists: CZK, DKK, HUF, CHF, NOK, PLN, SEK), plus CA (CAD),
  // AU (AUD) and SG (SGD). Mechanics identical to DE: the link is
  // built per selection and the referral rides every one. Copy
  // discipline: the provider default note only — passive and
  // neutral, nothing promotional toward EU/UK users (Mt Pelerin
  // serves the EU on reverse solicitation), and the notes claim
  // no domestic instant-payment rail for CA, PL or AU — those
  // rails belong to providers that fail Fluid's bar. SG verified
  // on Mt Pelerin's own pricing page (2026-11-09): SGD is listed
  // for bank-transfer buys AND sells, and Singapore is absent
  // from its published exclusion list. JP deliberately stays out:
  // JPY being a supported fiat is not, by itself, a route.
  CA: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  AU: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  SG: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  AT: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  BE: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  BG: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  CY: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  CZ: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  DK: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  EE: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  ES: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  FI: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  FR: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  GR: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  HR: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  HU: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  IE: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  IS: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  IT: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  LI: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  LT: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  LU: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  LV: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  MT: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  NL: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  NO: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  PL: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  PT: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  RO: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  SE: [["Mt Pelerin", { badge: true, badgeModes: ["buy"], swift: true }]],
  SI: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
  SK: [["Mt Pelerin", { badge: true, badgeModes: ["buy"] }]],
};
/** Assemble the ramp sheet's routes for one country + mode + network +
 *  asset, in ranked order. Each route: { name, url, note, badge,
 *  external, addressEntry, pasteAddress, rank }. mtpUnavailable
 *  mirrors the Mt Pelerin fiat gate for the sheet's honest "not
 *  available for this currency" line. Buy assembly applies the
 *  owner's standing criterion via RAMP_ADDRESS_ENTRY: a
 *  WalletConnect-only route never reaches a buy sheet. A plan row
 *  may also carry modes: ["buy"] / ["sell"] to appear on one side
 *  only, addressEntry to override the
 *  provider's default address entry for its corridor,
 *  pasteAddress: true to flag a paste route whose widget can't be
 *  pre-filled keylessly (carried on the route object; no current
 *  route sets it), and external: true to
 *  render as an external-app link-out. A row may
 *  also carry badgeModes: ["buy"] / ["sell"] — the CHEAPEST
 *  badge is judged per mode (global badge rule, audit P0-4);
 *  rows with plain badge: true and no badgeModes keep the
 *  both-modes meaning — and swift: true, which appends the SWIFT
 *  bank-cost line to an Mt Pelerin BUY note (audit P1-12). A
 *  provider default note may be a per-mode { buy, sell } object
 *  (audit P1-11); a row-level note override stays a string. A
 *  country/mode with no qualifying rows returns an empty routes
 *  array and the sheet renders its honest empty state. */
export function rampRoutesFor(countryCode, mode = "buy", networkKey = "bsc", asset = "USDC") {
  const c = RAMP_COUNTRIES.find(x => x.code === countryCode) || RAMP_COUNTRIES[0];
  const plan = RAMP_COUNTRY_PLAN[c.code] || [];
  const routes = [];
  for (const [name, opts] of plan) {
    let url = null;
    if (Array.isArray(opts.modes) && !opts.modes.includes(mode)) continue;
    // The buy gate: no WalletConnect-only route on a buy sheet, ever.
    // A row may override the provider default for its corridor
    // (opts.addressEntry).
    const addressEntry = opts.addressEntry || RAMP_ADDRESS_ENTRY[name];
    if (mode === "buy" && addressEntry === "walletconnect") {
      continue;
    }
    if (name === "Mt Pelerin") {
      url = mode === "buy" ? mtpelerinBuyUrl(asset, c.fiat) : mtpelerinSellUrl(asset, c.fiat);
      if (!url) continue;
    } else if (name === "Fonbnk") {
      // Fonbnk is SELL-only by construction (restored 2026-11-09):
      // its link builder exists only for the off-ramp, and this
      // guard keeps it off every buy sheet even if a future plan
      // row forgets its modes. A network Fonbnk does not support
      // builds no URL and the row is omitted.
      if (mode !== "sell") continue;
      url = fonbnkOfframpUrl(networkKey, asset, c.code);
      if (!url) continue;
    } else {
      const links = RAMP_STATIC_LINKS[name];
      if (!links) continue;
      url = mode === "buy" ? links.buy : links.sell;
    }
    // Note assembly: a row override wins; otherwise the provider
    // default, which may be per-mode. On flagged SWIFT corridors
    // the Mt Pelerin buy note gains the bank-cost line (P1-12).
    let note = opts.note;
    if (note == null) {
      const dflt = RAMP_DEFAULT_NOTES[name];
      note = (dflt && typeof dflt === "object") ? (dflt[mode] || "") : (dflt || "");
    }
    if (opts.swift && name === "Mt Pelerin" && mode === "buy") note = `${note} · ${RAMP_SWIFT_BUY_NOTE}`;
    routes.push({
      name,
      // A plan row flagged unavailable (QA F8: Mt Pelerin in the US
      // corridor) keeps its explanatory note but carries NO url —
      // the sheet renders it as a non-navigating row, so a corridor
      // can be honest about a provider without linking anyone to a
      // service that will refuse them.
      url: opts.unavailable ? null : url,
      note,
      // The badge is per-mode: badgeModes lists the modes on which
      // this row may carry CHEAPEST; absent, badge: true keeps
      // its both-modes meaning (no current row relies on it).
      badge: !!opts.badge && (!Array.isArray(opts.badgeModes) || opts.badgeModes.includes(mode)),
      external: !!opts.external,
      unavailable: !!opts.unavailable,
      addressEntry,
      pasteAddress: !!opts.pasteAddress,
      rank: routes.length,
    });
  }
  return { country: c, routes, mtpUnavailable: !MTPELERIN_FIATS.includes(c.fiat) };
}

/** Paycrest's keyless public rates API — the cheapest verifiable NG
 *  machine price (buy ₦1,384.52/USDT, measured live 7 Nov 2026) —
 *  is a PRICE SOURCE for Fluid. As a ROUTE its direct Gateway sell
 *  was re-verified live 2026-11-09 (NG repair): createOrder on the
 *  deployed BSC + Base Gateways is permissionless (dry-runs passed
 *  every contract check; the docs' KYB + API-Key prerequisite is
 *  attribution metadata only, and the keyless verify-account and
 *  order-status endpoints answer), and senderFee capture is native
 *  with a 0% treasury skim — but that day's live NGN provider
 *  quotes sat at ~₦683/$, half the ₦1,378 market rate, so the
 *  route fails the rate bar until quotes normalise AND one funded
 *  ~$1 test proves the aggregator settles an unattributed order;
 *  full evidence in research_notes/fluid-ng-repair-20261109.
 *  (Its consumer face was named on the NG sell sheet until
 *  2026-11-09, when the owner's capture GATE removed it in
 *  full — see the plan comments above.) The ramp sheets show a
 *  live "market rate" benchmark line so users can judge prices
 *  against the market themselves. That line is sourced from the
 *  aggregator's MARKET fields only — /v1/currencies'
 *  marketBuyRate/marketSellRate — never from the provider quote
 *  above: on 2026-11-09 the NGN provider quote sat at ~₦683/$
 *  (half the ₦1,378 market) for hours while the market fields
 *  stayed true, and a provider quote labelled "market rate"
 *  primes a seller to accept half their money. The fix sources
 *  the line from the market fields; the provider quote is then
 *  used only as a one-sided sanity witness (parsePaycrestRate
 *  feeding resolvePaycrestMarketRate): a quote ABOVE the market
 *  figure by more than PAYCREST_MARKET_MAX_DIVERGENCE
 *  contradicts the figure and hides the line, while a quote
 *  below it — a broken or merely poor quote, the normal state
 *  of the world — never suppresses or alters the true figure.
 *  Both payloads are hostile remote data: the parse keeps
 *  only a finite number inside a sane per-$ band, and every
 *  failure mode (offline, non-200, unparseable, out-of-band,
 *  contradicted) reads as "no benchmark" — the sheet then
 *  shows no line rather than a stale or wrong figure.
 *  Nothing is cached anywhere: each call fetches fresh, and
 *  the sheet fetches once per opening. */
export const PAYCREST_NGN_USDT_RATE_URL = "https://api.paycrest.io/v2/rates/base/USDT/50/NGN";
/** Fiats the benchmark line serves, with the sane per-$ band each
 *  rate must fall inside (same hostile-data discipline as NGN: a
 *  finite number inside the band or "no benchmark"). KES was
 *  verified live on this same keyless surface 2026-11-07 (buy
 *  130.94 / sell 128.79 per USDT) — QA F10. */
/** The aggregator's keyless market list: one entry per fiat
 *  carrying marketBuyRate + marketSellRate (per $1). Verified
 *  live 2026-11-09: NGN 1378.52/1378.75 and KES 130/129.85
 *  while the NGN provider quote was broken at ~683/698 — the
 *  market fields are the honest figure the sheets label. */
export const PAYCREST_CURRENCIES_URL = "https://api.paycrest.io/v1/currencies";
export const PAYCREST_RATE_BANDS = { NGN: [500, 5000], KES: [50, 500] };
export function paycrestRateUrl(fiat) {
  return `https://api.paycrest.io/v2/rates/base/USDT/50/${fiat}`;
}
/** Parse one side ("buy" or "sell") of a Paycrest PROVIDER-QUOTE
 *  payload for a supported fiat. A quote is what providers will
 *  transact at — it is NOT the market rate, and nothing displays
 *  it as one. Its remaining job is the one-sided sanity witness
 *  inside resolvePaycrestMarketRate. Null for unsupported fiats,
 *  failed payloads, missing sides, and out-of-band numbers. */
export function parsePaycrestRate(json, fiat, side) {
  const band = PAYCREST_RATE_BANDS[fiat];
  if (!band || (side !== "buy" && side !== "sell")) return null;
  if (!json || json.status !== "success") return null;
  const rate = Number(json.data && json.data[side] && json.data[side].rate);
  if (!Number.isFinite(rate) || rate < band[0] || rate > band[1]) return null;
  return rate;
}
/** Parse one side of a /v1/currencies payload for a supported
 *  fiat: the MARKET rate (the fiat entry's marketBuyRate or
 *  marketSellRate). Same hostile-data discipline as the quote
 *  parse — finite and in-band or null. */
export function parsePaycrestMarketRate(json, fiat, side) {
  const band = PAYCREST_RATE_BANDS[fiat];
  if (!band || (side !== "buy" && side !== "sell")) return null;
  if (!json || json.status !== "success" || !Array.isArray(json.data)) return null;
  const entry = json.data.find(c => c && c.code === fiat);
  if (!entry) return null;
  const rate = Number(side === "buy" ? entry.marketBuyRate : entry.marketSellRate);
  if (!Number.isFinite(rate) || rate < band[0] || rate > band[1]) return null;
  return rate;
}
/** The quote's one-sided witness bound: a provider quote may
 *  sit BELOW the market figure by any amount (a poor or broken
 *  quote — 2026-11-09: −50% for hours — is the quote's problem,
 *  never the market figure's), but a quote ABOVE the market
 *  figure by more than this fraction contradicts the figure
 *  itself: real provider quotes embed margin under market, they
 *  do not clear it by a quarter. */
export const PAYCREST_MARKET_MAX_DIVERGENCE = 0.25;
/** Reconcile the two keyless feeds into the one figure a sheet
 *  may label "market rate": the market field, witnessed by the
 *  provider quote when the quote parses. The witness is
 *  ONE-SIDED: a quote far above the figure (quote > figure ×
 *  (1 + PAYCREST_MARKET_MAX_DIVERGENCE)) contradicts it and
 *  hides the line; a quote at or below it — however broken —
 *  leaves the figure standing, because the quote is never the
 *  source of the figure (2026-11-09: quote ₦683 vs market
 *  ₦1,378 — the figure must still show ₦1,378). A missing
 *  market field is null: NEVER fall back to the provider
 *  quote. */
export function resolvePaycrestMarketRate(market, quote) {
  if (!Number.isFinite(market) || market <= 0) return null;
  if (Number.isFinite(quote) && quote > market * (1 + PAYCREST_MARKET_MAX_DIVERGENCE)) return null;
  return market;
}
export function parsePaycrestNgnBuyRate(json) {
  return parsePaycrestRate(json, "NGN", "buy");
}
/** The live MARKET rate for a supported fiat + side — the only
 *  figure a sheet may label "market rate" — or null on ANY
 *  failure. Never throws, so the sheet can fire-and-forget it.
 *  Fetches the market payload (required — a slow one times out
 *  at the app's 4s benchmark budget, in fetchPaycrestRateOrNull)
 *  and the provider quote (one-sided sanity witness) in
 *  parallel. */
export async function fetchPaycrestRate(fiat, side) {
  if (!PAYCREST_RATE_BANDS[fiat]) return null;
  const fetchPaycrestRateOrNull = async (url) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r || !r.ok) return null;
      return await r.json().catch(() => null);
    } catch { return null; }
  };
  const [currJson, ratesJson] = await Promise.all([
    fetchPaycrestRateOrNull(PAYCREST_CURRENCIES_URL),
    fetchPaycrestRateOrNull(paycrestRateUrl(fiat)),
  ]);
  const market = parsePaycrestMarketRate(currJson, fiat, side);
  if (market == null) return null;
  return resolvePaycrestMarketRate(market, parsePaycrestRate(ratesJson, fiat, side));
}
/** The live Paycrest NGN market buy rate, or null on ANY failure —
 *  never throws, so the sheet can fire-and-forget it. */
export async function fetchPaycrestNgnBuyRate() {
  return fetchPaycrestRate("NGN", "buy");
}

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

// ---------- Swaps (Across for same-asset EVM majors, Relay general, LI.FI fallback: one search across every chain) ----------
// Fluid does not run its own DEX. A swap is a route search — Across
// first where the pair is the same hub asset across two EVM chains
// (the Across section below), Relay next (cheapest on Fluid's core
// lanes; the Relay section below),
// LI.FI where neither has a route: same-chain DEX swaps and cross-chain bridge+swap
// routes come back together, Fluid ranks them cheapest (best net USD
// received after gas) and fastest, shows the user a plain sentence, and
// only then signs — step by step, from the user's own wallet, on the
// source chain. Bridge delivery on the destination chain is automatic
// once the source steps are mined. No Fluid server, no Fluid custody.
export const LIFI_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
const LIFI_API = "https://li.quest/v1";
/** Fluid's LI.FI integrator string (sent on every route/quote request).
 *  Registered in the LI.FI Partner Portal on 2026-11-07 with the
 *  DripBot agent wallet as the Default EVM fee wallet — see
 *  PLATFORM_FEE_COLLECTION_ENABLED. */
export const LIFI_INTEGRATOR = "fluid-wallet";
/** The LI.FI family a chain id belongs to, for fee purposes: the fee
 *  is charged on the SOURCE chain, so the source chain's family row in
 *  SWAP_FEE_COVERAGE decides whether a request may carry it. Null for
 *  chains outside the swap universe. */
export function lifiFeeFamily(chainId) {
  const id = Number(chainId);
  if (id === SOLANA_LIFI_CHAIN_ID) return "solana";
  if (id === TRON_LIFI_CHAIN_ID) return "tron";
  if (id === SUI_LIFI_CHAIN_ID) return "sui";
  if (Object.values(NETWORKS).some(n => n.chainId === id)) return "evm";
  return null;
}
/** Whether LI.FI may be asked to collect the standard fee on a route
 *  SOURCED from this chain today: collection is enabled AND the
 *  family's portal fee wallet is registered (its SWAP_FEE_COVERAGE
 *  row is collecting). This gate is load-bearing, not cosmetic —
 *  verified live 2026-11-07: LI.FI REJECTS a fee-bearing quote
 *  request for a chain whose integrator fee wallet is not configured
 *  (HTTP 400, code 1011, for both the Tron and the Sui chain id), so
 *  attaching the fee before registration would break those swaps
 *  entirely instead of merely leaving the fee uncollected. */
export function swapFeeCollectingChain(chainId) {
  const fam = lifiFeeFamily(chainId);
  if (!fam) return false;
  const row = SWAP_FEE_COVERAGE.find(r => r.family === fam);
  return !!(row && row.collecting);
}
/** Build the POST /v1/routes body. Pure and exported so tests can pin
 *  exactly what reaches LI.FI: the integrator string always; the `fee`
 *  fraction only when the source chain may collect (see
 *  swapFeeCollectingChain) — an explicit includeFee overrides the
 *  gate for tests and probes, and an explicit feeFraction (the
 *  two-pass search's computed rate, bps / 10000) replaces the
 *  PLATFORM_FEE_FRACTION cap default. */
export function buildLifiRoutesRequest({ fromChainId, toChainId, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress }, { includeFee = null, feeFraction = null } = {}) {
  const withFee = includeFee ?? (PLATFORM_FEE_COLLECTION_ENABLED && swapFeeCollectingChain(fromChainId));
  const options = { integrator: LIFI_INTEGRATOR, order: "RECOMMENDED" };
  if (withFee) options.fee = feeFraction ?? PLATFORM_FEE_FRACTION;
  return { fromChainId, toChainId, fromTokenAddress, toTokenAddress, fromAmount: String(fromAmount), fromAddress, toAddress, options };
}
/** Build the GET /v1/quote params (same fee gating as the routes body;
 *  on /quote, integrator and fee are top-level parameters). */
export function buildLifiQuoteParams({ fromChainId, toChainId, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress }, { includeFee = null, feeFraction = null } = {}) {
  const withFee = includeFee ?? (PLATFORM_FEE_COLLECTION_ENABLED && swapFeeCollectingChain(fromChainId));
  const q = new URLSearchParams({
    fromChain: fromChainId, toChain: toChainId,
    fromToken: fromTokenAddress, toToken: toTokenAddress,
    fromAmount: String(fromAmount), fromAddress, toAddress,
    integrator: LIFI_INTEGRATOR,
  });
  if (withFee) q.set("fee", String(feeFraction ?? PLATFORM_FEE_FRACTION));
  return q;
}
/** Per-source-family fee coverage for Fluid's LI.FI swap engine
 *  — the audited state of the standard fee, kept in code so a future
 *  swap family cannot ship without declaring its row here (tests pin
 *  this map against swapChainOf and swapRouteExecutable). The fee is
 *  charged on the SOURCE chain's fromAmount, so the destination
 *  family never changes collection; what varies per source family is
 *  (a) whether Fluid can sign the route at all and (b) whether the
 *  LI.FI portal has a fee wallet configured for that family's VM.
 *  feeWired mirrors collecting exactly: buildLifiRoutesRequest /
 *  buildLifiQuoteParams attach the fee only for source chains whose
 *  portal fee wallet is registered (swapFeeCollectingChain), because
 *  LI.FI rejects fee-bearing requests on unconfigured chains
 *  outright (HTTP 400, code 1011 — verified live 2026-11-07 for both
 *  the Tron and Sui chain ids). A family whose row flips to
 *  collecting:true starts carrying the fee in the same build.
 *  Rows (audit 2026-11-07):
 *  - evm: signable; portal Default EVM fee wallet set — collecting.
 *  - solana: signable; portal Default SVM fee wallet set to the
 *    agent wallet's Solana address (2026-11-07) — collecting.
 *  - tron: signable since the TVM signer landed 2026-11-07
 *    (executeTronSwapRoute; the step payload is decoded from its
 *    protobuf raw_data and inspected by checkTronSwapStepBounds
 *    before anything is signed — validated live the same day against
 *    a real Layerswap USDT→USDT quote). The portal has no Tron fee
 *    wallet registered yet: the agent wallet's Tron address is
 *    derived and recorded (destination), and until the operator
 *    registers it the fee is NOT attached to Tron requests (LI.FI
 *    would reject them, code 1011) — Tron swaps execute, fee-free.
 *  - sui: signable since the MVM signer landed 2026-11-07
 *    (executeSuiSwapRoute; each step is rebuilt against the chain and
 *    the BUILT bytes inspected by checkSuiSwapStepSafety before
 *    signing — validated live the same day against a real Cetus
 *    SUI→USDC quote). LI.FI pays Sui fees directly to the configured
 *    wallet; same portal state as Tron — destination derived and
 *    recorded, registration pending, fee not attached meanwhile.
 *  Every other Fluid family (Bitcoin, Litecoin, Dogecoin, Bitcoin
 *  Cash, Cosmos, TON, NEAR, XRP, Stellar, Algorand, Polkadot, Aptos,
 *  Stacks, Lightning) has NO swap route at all — swapChainOf returns
 *  null and the swap sheet never offers them; they are sends/receives
 *  only and fee-free by platformFeeApplies. */
export const SWAP_FEE_COVERAGE = [
  { family: "evm", provider: "LI.FI", feeSupported: true, feeWired: true, executable: true, collecting: true,
    destination: FEE_SPLIT.dripbot.agentWallet.evm, blocker: null },
  { family: "solana", provider: "LI.FI", feeSupported: true, feeWired: true, executable: true, collecting: true,
    destination: FEE_SPLIT.dripbot.agentWallet.solana, blocker: null },
  { family: "tron", provider: "LI.FI", feeSupported: true, feeWired: true, executable: true, collecting: true,
    destination: FEE_SPLIT.dripbot.agentWallet.tron, blocker: null },
  { family: "sui", provider: "LI.FI", feeSupported: true, feeWired: true, executable: true, collecting: true,
    destination: FEE_SPLIT.dripbot.agentWallet.sui, blocker: null },
];
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
// Bitcoin (chainType UTXO on LI.FI) — LI.FI lists it (verified live
// 2026-11-07 against /v1/chains?chainTypes=UTXO: id 20000000000001,
// native token address "bitcoin", 8 decimals) and its docs count
// Bitcoin among the chains whose integrator fees are paid directly to
// the configured wallet. Fluid deliberately does NOT put Bitcoin in
// the swap universe (swapChainOf returns null for it): a BTC-sourced
// route's step payload is a PSBT-shaped blob Fluid has not inspected,
// and Fluid never signs a payload shape it has not inspected. The id
// is pinned here so the fee builders' coverage is testable across
// every chain type LI.FI carries, and so a future BTC swap build
// starts from the audited fee pattern, not from scratch.
export const BITCOIN_LIFI_CHAIN_ID = 20000000000001;
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

/** One LI.FI step's EXPLICIT cost in USD: its declared fee costs
 *  plus its gas costs. Read on a FEE-FREE quote there is no
 *  integrator-fee entry in here yet to exclude — this is the
 *  explicit measure lifiRouteFeeUsd weighs against the route's
 *  all-in shortfall. */
function lifiStepCostsUsd(step) {
  const e = step?.estimate || {};
  let sum = 0;
  for (const c of [...(e.feeCosts || []), ...(e.gasCosts || [])]) sum += Number(c?.amountUSD || 0);
  return sum;
}
/** A LI.FI route's own cost in USD — the single place LI.FI's
 *  routeFeeUsd is computed, under the model's definition
 *  (routeCostUsd): the LARGER of the route's explicit costs (the
 *  sum over its steps of lifiStepCostsUsd) and its all-in
 *  shortfall (fromAmountUSD − toAmountUSD — what the rate quietly
 *  takes beyond the declared fees). Measured on the fee-free pass,
 *  so neither measure has Fluid's fee inside it. Exported for
 *  tests. */
export function lifiRouteFeeUsd(route) {
  let explicit = 0;
  for (const s of route?.steps || []) explicit += lifiStepCostsUsd(s);
  return routeCostUsd(explicit, Number(route?.fromAmountUSD) - Number(route?.toAmountUSD));
}
/** The swap route-list cost label ($1-rule fix F5, 2026-11-09):
 *  the row prints the route's TOTAL cost — its own cost
 *  (routeFeeUsd) plus the Fluid fee the final quote discloses
 *  (platformFeeUsd) — never gasCostUSD alone, which can understate
 *  the true cost by orders of magnitude on solver routes (a
 *  BSC→Solana quote showed "fees ≈ $0.0033" while the user
 *  received $0.82 of $1). Falls back to gasCostUSD when the route
 *  carries no routeFeeUsd. Pure and exported so tests pin the
 *  exact arithmetic the sheet renders. */
export function swapRouteCostLabel(route) {
  const rf = Number(route?.routeFeeUsd);
  if (Number.isFinite(rf) && rf >= 0) {
    const pf = Number(route?.platformFeeUsd);
    const total = rf + (Number.isFinite(pf) && pf > 0 ? pf : 0);
    return { text: "route cost", usd: total };
  }
  return { text: "fees", usd: Number(route?.gasCostUSD) || 0 };
}
/** GET /v1/quote with the given builder options; throws the route
 *  search's standard error on a non-OK answer. */
async function fetchLifiQuoteStep(reqArgs, opts) {
  const q = buildLifiQuoteParams(reqArgs, opts);
  const res = await fetch(`${LIFI_API}/quote?${q.toString()}`);
  const step = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Route search failed: " + (step.message || ("HTTP " + res.status)));
  return step;
}
/** Ask LI.FI for routes. fromAmount is the RAW integer amount (string)
 *  in the from-token's smallest unit. Primary path is POST /v1/routes
 *  (several competing routes). That endpoint can be very slow, so on a
 *  timeout or empty answer Fluid falls back to GET /v1/quote, which
 *  returns the single recommended route as one executable step. This
 *  is the FALLBACK engine now — getSwapRoutes tries Relay first and
 *  lands here only for pairs Relay can't serve or when Relay fails.
 *
 *  FEE MODEL (two-pass, where the source chain collects): the fee is
 *  a markup on the route's own cost (platformFeeBpsForRoute), and
 *  /routes takes ONE fee fraction per request — so pass 1 fetches
 *  routes with NO fee attached and reads the best route's cost
 *  (rankSwapRoutes' top pick, the route the sheet badges CHEAPEST),
 *  pass 2 re-fetches with the computed fraction, and the routes the
 *  user executes come from pass 2, annotated with the charged bps
 *  (route.platformFeeBps) so the disclosure prices exactly what was
 *  attached. Sibling routes share the reference route's bps — the
 *  cap guarantees none of them can overcharge. If the model prices
 *  the fee at 0 bps the pass-1 routes already carry no fee and are
 *  returned as quoted. If pass 2 fails, the /quote path runs its
 *  own two passes rather than executing fee-free pass-1 routes; the
 *  /quote path is single-route, so its fee is exact for the route
 *  executed. Where the source chain does not collect, the original
 *  single-pass behaviour runs unchanged. */
export async function getLifiSwapRoutes({ fromChainKey, toChainKey, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress }) {
  const from = swapChainOf(fromChainKey), to = swapChainOf(toChainKey);
  if (!from || !to) throw new Error("Unknown network in swap.");
  const destAddress = toAddress || fromAddress;
  const reqArgs = { fromChainId: from.chainId, toChainId: to.chainId, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress: destAddress };
  const fetchRoutes = async (opts) => {
    const res = await fetch(`${LIFI_API}/routes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(buildLifiRoutesRequest(reqArgs, opts)),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.routes?.length ? data.routes : null;
  };
  if (!(PLATFORM_FEE_COLLECTION_ENABLED && swapFeeCollectingChain(from.chainId))) {
    try {
      const routes = await fetchRoutes();
      if (routes) return routes;
    } catch { /* slow or unavailable — fall back to /quote below */ }
    return [quoteStepToRoute(await fetchLifiQuoteStep(reqArgs))];
  }
  let firstRoutes = null;
  try { firstRoutes = await fetchRoutes({ includeFee: false }); } catch { /* /quote path below */ }
  if (firstRoutes) {
    const reference = rankSwapRoutes(firstRoutes, null)[0];
    const bps = platformFeeBpsForRoute(lifiRouteFeeUsd(reference), reference?.fromAmountUSD, toChainKey);
    if (bps <= 0) {
      for (const r of firstRoutes) r.platformFeeBps = 0;
      return firstRoutes;
    }
    try {
      const routes = await fetchRoutes({ includeFee: true, feeFraction: bps / 10000 });
      if (routes) {
        for (const r of routes) r.platformFeeBps = bps;
        return routes;
      }
    } catch { /* /quote path below */ }
  }
  const firstStep = await fetchLifiQuoteStep(reqArgs, { includeFee: false });
  const firstRoute = quoteStepToRoute(firstStep);
  const bps = platformFeeBpsForRoute(lifiRouteFeeUsd(firstRoute), firstStep.estimate?.fromAmountUSD, toChainKey);
  if (bps <= 0) {
    firstRoute.platformFeeBps = 0;
    return [firstRoute];
  }
  const route = quoteStepToRoute(await fetchLifiQuoteStep(reqArgs, { includeFee: true, feeFraction: bps / 10000 }));
  route.platformFeeBps = bps;
  return [route];
}

// ---------- Relay (PRIMARY swap router; LI.FI above is the fallback) ----------
// Router verdict 2026-11-08 (research_notes/fluid-router-comparison-
// 20261108/, live quotes): Relay is the cheapest quotable router on
// Fluid's core lanes (Base↔Arbitrum all-in $0.025–0.035 at $1–$100,
// ~1 s intent fills) and its App Fees carry Fluid's fee — the
// route-cost markup capped at 0.5% (see platformFeeBpsForRoute) —
// with no second percentage layer underneath (LI.FI adds its
// own 0.25%).
// Cheapest route wins: getSwapRoutes quotes Relay FIRST for every
// pair Relay can serve and falls back to LI.FI only where Relay has
// no route (above all Sui — Relay has no Sui chain) or when Relay
// quoting itself fails. Relay is a plain REST API (POST /quote/v2 on
// api.relay.link, keyless today) — no SDK, no new dependency.
//
// Chain coverage (GET /chains snapshot, verified live 2026-11-08):
// 57 chains — every Fluid EVM network except Fuse (122) and B² (223),
// plus Solana (Relay id 792703809), Tron (728126428 — the same id
// LI.FI uses) and on-chain Bitcoin (not in Fluid's swap universe).
// Relay token addresses match the ones the app already passes: EVM
// contracts, Solana mints (native = the System Program id, exactly
// LI.FI's SOLANA_SWAP_NATIVE_TOKEN) and Tron base58 (native =
// TRON_SWAP_NATIVE_TOKEN — verified live 2026-11-08, a TRX→Base quote
// priced against it).
//
// EXECUTION is wired for EVM sources only. Relay's EVM steps are
// complete transactions ({from,to,data,value,chainId}) Fluid bounds-
// checks and signs with its EVM key (executeRelaySwapRoute). Its SVM
// steps arrive as UNASSEMBLED instruction JSON ({instructions,
// addressLookupTableAddresses}) and its TVM steps as a TronWeb
// contract parameter — neither is a payload shape Fluid has audited
// (Fluid's Solana/Tron signers sign prebuilt payloads after
// inspection), so Solana- and Tron-SOURCED swaps stay on LI.FI.
// Destinations never sign: EVM→Solana and EVM→Tron route via Relay.
//
// FEE GAP vs LI.FI (deliberate, owner's rules): Relay App Fee
// recipients must be an EVM address even for non-EVM chains, and fees
// accrue OFF-CHAIN in USDC to that one claim address — Relay cannot
// pay per-chain fee wallets the way LI.FI's portal does. So on Relay
// routes the whole Fluid fee accrues to the DripBot EVM collection wallet
// (RELAY_APP_FEE_RECIPIENT) as USDC, whatever the source/destination
// chains, and is claimed from Relay's App Balance by that wallet
// (claiming needs that wallet's signature via Relay's /execute/permit
// flow — an operator action, not app code). That fits Fluid's
// settlement model (all fees convert to BTC over Lightning anyway),
// but it is a real difference from LI.FI's per-chain pots: on Relay
// lanes there is no Solana/Tron fee pot to sweep, only the USDC App
// Balance. Documented caveat (docs.relay.link/features/app-fees,
// checked 2026-11-08): on same-chain swaps whose fee would be worth
// ≤ $0.025 Relay may skip collection; the quote says so up front
// (fees.app.amount is 0), and Fluid discloses the fee only when the
// quote says it will actually be collected (platformFeeCollecting).
const RELAY_API = "https://api.relay.link";
/** Relay's chain id for Solana (LI.FI uses a different one). */
export const RELAY_SOLANA_CHAIN_ID = 792703809;
/** Relay's chain id for Tron — the same id LI.FI uses. */
export const RELAY_TRON_CHAIN_ID = 728126428;
/** The one Relay App Fees claim address: the DripBot collection
 *  wallet's EVM address. Relay requires an EVM recipient even for
 *  non-EVM chains and settles all app fees to it in USDC, off-chain. */
export const RELAY_APP_FEE_RECIPIENT = FEE_SPLIT.dripbot.agentWallet.evm;
/** Relay's EVM chain ids (GET /chains snapshot, verified live
 *  2026-11-08). A Fluid network whose chain id is absent (Fuse 122,
 *  B² 223, Sepolia) is a LI.FI lane. */
export const RELAY_EVM_CHAIN_IDS = new Set([
  1, 10, 25, 56, 100, 130, 137, 143, 146, 169, 196, 288, 324, 360,
  480, 747, 988, 999, 1088, 1337, 1868, 2020, 2741, 2818, 4217,
  4326, 4663, 5000, 5031, 5042, 8453, 9745, 33139, 34443, 42018,
  42161, 42220, 43114, 48900, 57073, 59144, 60808, 80094, 97477,
  98866, 534352, 685689, 747474, 7777777,
]);
/** Resolve a swap-side chain key to Relay's {chainId, name}. Null
 *  when Relay has no such chain — Sui above all (Relay has none). */
export function relayChainOf(chainKey) {
  if (chainKey === "tron") return { chainId: RELAY_TRON_CHAIN_ID, name: "Tron" };
  if (chainKey === "solana") return { chainId: RELAY_SOLANA_CHAIN_ID, name: "Solana" };
  if (chainKey === "sui") return null;
  const n = NETWORKS[chainKey];
  if (!n) return null;
  return RELAY_EVM_CHAIN_IDS.has(n.chainId) ? { chainId: n.chainId, name: n.name } : null;
}
/** Whether getSwapRoutes should quote Relay for this pair: Relay
 *  covers both chains AND the source family's Relay execution is
 *  wired (EVM sources only — see the section header). Solana/Tron
 *  sources and any Sui pair go straight to LI.FI. */
export function relaySupportsPair(fromChainKey, toChainKey) {
  if (!relayChainOf(fromChainKey) || !relayChainOf(toChainKey)) return false;
  return !!NETWORKS[fromChainKey];
}
/** Build the POST /quote/v2 body. Pure and exported so tests can pin
 *  exactly what reaches Relay: the App Fees entry carries Fluid's
 *  fee as basis points to the DripBot EVM claim address whenever
 *  collection is enabled — the cap rate (PLATFORM_FEE_BPS = 50 →
 *  "50") by default, or the two-pass search's computed rate when
 *  feeBps is given (platformFeeBpsForRoute). Relay needs no
 *  per-chain portal registration, so unlike LI.FI there is no
 *  per-chain gate. An explicit includeFee overrides for tests.
 *  Returns null for pairs Relay doesn't cover. */
export function buildRelayQuoteRequest({ fromChainKey, toChainKey, fromTokenAddress, toTokenAddress, fromAmount, fromAddress, toAddress }, { includeFee = null, feeBps = null } = {}) {
  const from = relayChainOf(fromChainKey), to = relayChainOf(toChainKey);
  if (!from || !to) return null;
  const withFee = includeFee ?? PLATFORM_FEE_COLLECTION_ENABLED;
  const body = {
    user: fromAddress,
    originChainId: from.chainId,
    destinationChainId: to.chainId,
    originCurrency: fromTokenAddress,
    destinationCurrency: toTokenAddress,
    amount: String(fromAmount),
    tradeType: "EXACT_INPUT",
  };
  const destAddress = toAddress || fromAddress;
  if (destAddress && destAddress !== fromAddress) body.recipient = destAddress;
  if (withFee) body.appFees = [{ recipient: RELAY_APP_FEE_RECIPIENT, fee: String(feeBps ?? PLATFORM_FEE_BPS) }];
  return body;
}
/** Parse a Relay /quote/v2 response into Fluid's route shape (the
 *  same fields rankSwapRoutes and the swap sheet consume for LI.FI
 *  routes), keeping the raw quote on route.relay for execution.
 *  Pure; returns null when the response is unusable or disagrees
 *  with the request it answers (amount or sender mismatch — API
 *  data is hostile, and a quote for a different trade must never
 *  reach the signer). Chain ids on the returned route are in
 *  Fluid's own id space (swapChainOf), NOT Relay's, so every
 *  existing consumer (fee gates, explorers, ranking) sees the ids
 *  it expects; Relay's ids live on route.relay. */
export function parseRelayQuote(quote, { fromChainKey, toChainKey, fromAmount = null, fromAddress = null } = {}) {
  const d = quote?.details;
  if (!d || !Array.isArray(quote?.steps) || !quote.steps.length) return null;
  const from = swapChainOf(fromChainKey), to = swapChainOf(toChainKey);
  const relayFrom = relayChainOf(fromChainKey), relayTo = relayChainOf(toChainKey);
  if (!from || !to || !relayFrom || !relayTo) return null;
  const inAmt = d.currencyIn?.amount, outAmt = d.currencyOut?.amount;
  if (inAmt == null || outAmt == null) return null;
  if (fromAmount != null && String(inAmt) !== String(fromAmount)) return null;
  if (fromAddress && d.sender) {
    const a = String(fromAddress), b = String(d.sender);
    const same = (a.startsWith("0x") && b.startsWith("0x")) ? a.toLowerCase() === b.toLowerCase() : a === b;
    if (!same) return null;
  }
  const tok = (c, chainId) => (c && c.address != null)
    ? { address: c.address, symbol: c.symbol || null, name: c.name || null, decimals: c.decimals ?? null, chainId }
    : null;
  const appFeeRaw = quote.fees?.app?.amount != null ? String(quote.fees.app.amount) : "0";
  const appFeeUsd = Number(quote.fees?.app?.amountUsd || 0);
  let appFeeCollecting = false;
  try { appFeeCollecting = BigInt(appFeeRaw) > 0n; } catch { appFeeCollecting = false; }
  // The route's OWN cost in USD — the single place Relay's
  // routeFeeUsd is computed, under the model's definition
  // (routeCostUsd): the LARGER of the explicit fee components
  // Relay declares (every entry in fees EXCEPT Fluid's app fee)
  // and the quote's all-in shortfall — input value minus output
  // value, with Fluid's app fee taken back out (on the fee-free
  // pass 1, where platformFeeBpsForRoute reads this, there is no
  // app fee in the quote, so the shortfall is pure route cost).
  // Most of Relay's cost rides inside the exchange rate: the live
  // $5 capture declares $0.0011 of gas, but its shortfall is
  // $0.0242 — the declared components alone would understate the
  // cost the model means to mark up by more than twentyfold.
  let explicitFeeUsd = 0;
  for (const [k, v] of Object.entries(quote.fees || {})) {
    if (k === "app") continue;
    const n = Number(v?.amountUsd || 0);
    if (Number.isFinite(n)) explicitFeeUsd += n;
  }
  const routeFeeUsd = routeCostUsd(explicitFeeUsd,
    Number(d.currencyIn?.amountUsd) - Number(d.currencyOut?.amountUsd) - appFeeUsd);
  return {
    provider: "relay",
    id: "relay:" + (quote.requestId || ""),
    type: "relay",
    fromChainId: from.chainId, toChainId: to.chainId,
    fromAmount: String(inAmt),
    fromToken: tok(d.currencyIn?.currency, from.chainId),
    toToken: tok(d.currencyOut?.currency, to.chainId),
    toAmount: String(outAmt),
    toAmountMin: d.currencyOut?.minimumAmount != null ? String(d.currencyOut.minimumAmount) : null,
    toAmountUSD: d.currencyOut?.amountUsd,
    fromAmountUSD: d.currencyIn?.amountUsd,
    gasCostUSD: Number(quote.fees?.gas?.amountUsd || 0),
    routeFeeUsd,
    executionDuration: d.timeEstimate,
    platformFeeRaw: appFeeRaw,
    platformFeeUsd: appFeeUsd,
    platformFeeCollecting: appFeeCollecting,
    steps: [],
    relay: {
      requestId: quote.requestId || null,
      originChainId: relayFrom.chainId, destinationChainId: relayTo.chainId,
      sender: d.sender || null, steps: quote.steps,
    },
  };
}
/** The Relay steps Fluid can actually sign: transaction steps with
 *  complete EVM transaction items, on an EVM source chain. Anything
 *  else (signature-kind steps, non-EVM sources) yields []. */
export function relayExecutableSteps(route) {
  if (route?.provider !== "relay") return [];
  const evmIds = new Set(Object.values(NETWORKS).map(n => n.chainId));
  if (!evmIds.has(Number(route?.relay?.originChainId))) return [];
  return (route.relay.steps || []).filter(s =>
    s && s.kind === "transaction" && Array.isArray(s.items) && s.items.length > 0
    && s.items.every(it => it && it.data && typeof it.data.to === "string" && typeof it.data.data === "string"));
}
/** Ask Relay for its single executable quote (with the given fee
 *  options) and parse it into route shape. Throws on any failure
 *  (HTTP error, unusable or unsignable quote) — getSwapRoutes
 *  catches and falls back. */
async function fetchRelayRoute(args, opts) {
  const body = buildRelayQuoteRequest(args, opts);
  if (!body) return null;
  const res = await fetch(`${RELAY_API}/quote/v2`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Relay route search failed: " + (data.message || data.error || ("HTTP " + res.status)));
  const route = parseRelayQuote(data, args);
  if (!route) throw new Error("Relay returned no usable route for that pair.");
  if (!relayExecutableSteps(route).length) throw new Error("Relay's route for that pair carries no steps Fluid can sign.");
  return route;
}
/** Relay's route for a swap, priced under the fee model — a
 *  TWO-PASS search whenever collection is enabled: pass 1 quotes
 *  with NO app fee and reads the route's own cost (routeFeeUsd —
 *  the larger of the quote's declared fee components and its
 *  all-in shortfall, see routeCostUsd) and the
 *  input's USD value; platformFeeBpsForRoute turns those into the
 *  bps to charge (the fee law: the destination's multiplier × the
 *  route cost, floored, capped at the old flat 0.5% and by the
 *  destination ecosystem's total-cost ceiling); pass 2 re-quotes
 *  with exactly that bps, and the
 *  EXECUTED route is pass 2's, annotated with the charged bps
 *  (route.platformFeeBps). Relay offers no way to set the fee on
 *  an already-fetched quote, so the second call is the price of
 *  exactness. If the model prices the fee at 0 bps, pass 1's quote
 *  already carries no fee and is executed as quoted. If pass 2
 *  returns a materially different route cost, the charged bps
 *  stays as set — the DISCLOSED fee is recomputed from the final
 *  quote's own fees.app by the caller, never from pass 1. */
async function getRelaySwapRoute(args) {
  if (!PLATFORM_FEE_COLLECTION_ENABLED) return fetchRelayRoute(args);
  const first = await fetchRelayRoute(args, { includeFee: false });
  if (!first) return null;
  const bps = platformFeeBpsForRoute(first.routeFeeUsd, first.fromAmountUSD, args.toChainKey);
  if (bps <= 0) {
    first.platformFeeBps = 0;
    return first;
  }
  const final = await fetchRelayRoute(args, { includeFee: true, feeBps: bps });
  if (!final) return null;
  final.platformFeeBps = bps;
  return final;
}
/* ---------- Across (PRIMARY for same-asset EVM majors) ----------
 * Readiness verdict 2026-11-08 (research_notes/fluid-across-
 * readiness-20261108/, live-probed): Across's Swap API
 * (GET app.across.to/api/swap/approval) is the cheapest road Fluid
 * has for moving one hub asset (USDC / USDT / WETH) between EVM
 * chains — Base↔Arbitrum all-in $0.004–0.028, ~2 s fills — and its
 * app fee works keylessly: set `appFee` (a decimal fraction of the
 * expected OUTPUT) + `appFeeRecipient` on the quote and the fee is
 * charged in the output token, on the destination chain, atomically
 * inside the fill — no off-chain balance to claim (unlike Relay),
 * no portal registration (unlike LI.FI). The dispatcher therefore
 * quotes Across FIRST wherever the pair is the same hub asset on
 * both sides across two covered EVM chains; everything else keeps
 * the Relay → LI.FI order below, untouched.
 *
 * EXECUTION SHAPE: one origin transaction — the API returns a
 * ready SpokePool `deposit` call (the current unified deposit,
 * selector 0xad5425c6) whose calldata Fluid decodes and bounds-
 * checks field by field before signing (checkAcrossDepositBounds).
 * Two hard rules from the readiness probe:
 *   - NEVER submit the API's `approvalTxns`: they encode
 *     approve(SpokePool, 2^256−1), an UNLIMITED approval. Fluid
 *     composes its own exact-amount approval (the response's
 *     checks.allowance.expected proves the exact input amount is
 *     all the pool pulls).
 *   - The API returns no `value` on the deposit: for a native-ETH
 *     input Fluid attaches msg.value == inputAmount itself (the
 *     SpokePool wraps it — the quote is taken against the chain's
 *     WETH address).
 *
 * THE HANDLER MESSAGE (the subtle part): with an app fee — or a
 * WETH→native delivery — the deposit's on-chain recipient is NOT
 * the user but Across's destination handler contract, and the
 * deposit `message` carries the delivery instructions (an Across
 * MulticallHandler Instructions tuple: Call[] + fallbackRecipient).
 * Decoded live 2026-11-08, the fee-bearing shape is stable across
 * chains and assets: call 0 is the output token's transfer of
 * EXACTLY the quote's app fee to the app-fee recipient; then two
 * identical handler self-calls naming (outputToken, user) — the
 * remainder leg, whose named recipient is the user; then one call
 * to a per-destination message adapter (the alternate settlement
 * path's instruction blob, which names only the output token, the
 * user and the fee recipient). checkAcrossDepositBounds decodes
 * the message fully and enforces exactly that containment — every
 * address the message can direct funds to is pinned, no call
 * carries value, no approval or transferFrom may hide inside it —
 * and ANY other shape (zkSync Era destinations, for instance,
 * compose a destination swap into the message: an approve() plus
 * an opaque router call) is REFUSED at quote time and the pair
 * falls back to Relay. Fluid never signs a message shape it has
 * not pinned.
 *
 * REFUNDS: an unfilled deposit (fill deadline = quote + ~2 h)
 * refunds automatically to the depositor on the origin chain, in
 * the input token, via Across's settlement bundles — several
 * hours end to end, no claim transaction. The app copy says so;
 * the fee only materialises inside a fill, so a refunded deposit
 * costs the user nothing but time. */
const ACROSS_API = "https://app.across.to/api";
/** Across app fees land on the same DripBot EVM collection wallet
 *  as Relay's — one fee pot, one settlement path. The difference
 *  is mechanical: Relay accrues off-chain in USDC for a later
 *  claim; Across pays this address directly on the destination
 *  chain, in the output token, at fill time. */
export const ACROSS_APP_FEE_RECIPIENT = RELAY_APP_FEE_RECIPIENT;
/** Across chain ids with live routes for the hub assets (from the
 *  readiness probe's /available-routes snapshot, 2026-11-08): nine
 *  of Fluid's fifteen EVM networks. Scroll, Mantle, Gnosis, Celo,
 *  Fuse and B² have no Across routes — Relay/LI.FI keep them. */
export const ACROSS_CHAIN_IDS = new Set([1, 10, 56, 137, 324, 8453, 42161, 43114, 59144]);
/** Canonical WETH per chain key, for the chains whose native coin
 *  IS ETH (Across quotes native routes against the WETH address).
 *  Polygon's wrapped native is WPOL, BSC's is WBNB and Avalanche's
 *  is WAVAX — their native coins are not the WETH hub asset, so
 *  they carry no entry and native picks there stay Relay lanes.
 *  Avalanche additionally has NO WETH routes at all (stables only),
 *  so WETH pairs into Avalanche are ineligible even as tokens. */
export const ACROSS_WETH = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  optimism: "0x4200000000000000000000000000000000000006",
  linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
  zksync: "0x5AEa5775959fBC2557Cc8789Bc1bf90A239D9a91",
};
/** Across's destination handler contract per destination chain id
 *  — the deposit's on-chain recipient whenever a message rides
 *  (app fee or WETH unwrap). Pinned from live Swap API quotes,
 *  2026-11-08: one handler serves most chains; Linea, zkSync Era
 *  and Avalanche have their own. A destination with no pin can
 *  never carry a fee-bearing Across route in Fluid. */
export const ACROSS_HANDLERS = {
  1: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  10: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  56: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  137: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  8453: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  42161: "0x0f7ae28de1c8532170ad4ee566b5801485c13a0e",
  59144: "0xdf1c940487574eefa79989a79a4936a0f979cda2",
  324: "0x68d3806e57148d6c6793c78ebddbc272fe605dbf",
  43114: "0x9610954acdca5ff7905f051a040ce33fe613c60e",
};
/** The message-adapter contract per destination chain id — the
 *  target of the composed message's final call (the alternate
 *  settlement path's instruction blob). Pinned from the same live
 *  quotes as ACROSS_HANDLERS. */
export const ACROSS_MESSAGE_ADAPTERS = {
  1: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  10: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  56: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  137: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  8453: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  42161: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  59144: "0xBF75133b48b0a42AB9374027902E83C5E2949034",
  324: "0x74a2966e23B61A360b1345eA359127aF325beC4C",
  43114: "0x25b15Fc38d6A2C13FEDdD9cb51f184F7Cf0D4C11",
};
/** Origin SpokePools, pinned where a live quote named them (the
 *  deposit transaction's target — and the response's own
 *  checks.allowance.spender, which the bounds check cross-verifies
 *  on every quote, pinned or not). */
export const ACROSS_SPOKE_POOLS = {
  8453: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  42161: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
};
const ACROSS_DEPOSIT_ABI = ["function deposit(bytes32 depositor, bytes32 recipient, bytes32 inputToken, bytes32 outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, bytes32 exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message)"];
const ACROSS_ERC20_TRANSFER = ["function transfer(address to, uint256 amount) returns (bool)"];
const ACROSS_INSTRUCTIONS_TYPE = "tuple(tuple(address target, bytes data, uint256 value)[] calls, address fallbackRecipient)";
/** The handler's remainder-delivery call selector (live-decoded:
 *  a 68-byte call naming (outputToken, userRecipient)) and the
 *  message adapter's selector. Their internals are Across's
 *  composed-delivery machinery; Fluid pins their TARGETS and
 *  ARGUMENTS, which is what decides where funds can go. */
const ACROSS_HANDLER_DELIVER_SELECTOR = "0xef8738d3";
const ACROSS_ADAPTER_SELECTOR = "0xd836083e";
/** Resolve one side of a swap to its Across hub asset: the chain's
 *  native pick maps to the WETH hub asset only where the native
 *  coin is ETH; a token pick must be the chain's pinned USDC/USDT
 *  (NETWORKS' curated rows — on BSC those are the Binance-Peg
 *  contracts at 18 decimals, which the Swap API absorbs) or the
 *  chain's canonical WETH. Anything else is not an Across lane. */
function acrossAssetOf(chainKey, tokenAddress) {
  const net = NETWORKS[chainKey];
  if (!net) return null;
  if (!tokenAddress || /^0x0{40}$/i.test(String(tokenAddress))) {
    return net.symbol === "ETH" && ACROSS_WETH[chainKey]
      ? { asset: "WETH", token: ACROSS_WETH[chainKey], native: true } : null;
  }
  const weth = ACROSS_WETH[chainKey];
  if (weth && String(tokenAddress).toLowerCase() === weth.toLowerCase())
    return { asset: "WETH", token: tokenAddress, native: false };
  const t = (net.tokens || []).find(x => x.address.toLowerCase() === String(tokenAddress).toLowerCase());
  if (t && (t.symbol === "USDC" || t.symbol === "USDT"))
    return { asset: t.symbol, token: t.address, native: false };
  return null;
}
/** Whether Across serves this pair — and if so, the resolved plan
 *  (hub asset + the exact token addresses to quote). Eligibility:
 *  both chains EVM networks in ACROSS_CHAIN_IDS, different chains,
 *  and the SAME hub asset (USDC, USDT or WETH/ETH) pinned on both
 *  sides. Returns null for everything else — the dispatcher then
 *  runs its Relay → LI.FI order exactly as before. */
export function acrossSupportsPair({ fromChainKey, toChainKey, fromTokenAddress, toTokenAddress }) {
  const from = NETWORKS[fromChainKey], to = NETWORKS[toChainKey];
  if (!from || !to || fromChainKey === toChainKey) return null;
  if (!ACROSS_CHAIN_IDS.has(from.chainId) || !ACROSS_CHAIN_IDS.has(to.chainId)) return null;
  const a = acrossAssetOf(fromChainKey, fromTokenAddress);
  const b = acrossAssetOf(toChainKey, toTokenAddress);
  if (!a || !b || a.asset !== b.asset) return null;
  if (a.asset === "WETH" && to.chainId === 43114) return null; // Avalanche: stables only
  return { asset: a.asset, inputToken: a.token, outputToken: b.token, nativeInput: a.native, nativeOutput: b.native };
}
/** Build the Swap API query for one quote. Pure and exported so
 *  tests can pin exactly what reaches Across: the fee rides only
 *  when a fraction is given — pass 1 of the two-pass search omits
 *  it entirely so the route's own cost can be read fee-free, and
 *  pass 2 sets it as a decimal fraction of the expected output
 *  (Across's denomination) with the collection wallet as
 *  recipient. Deliberately absent: the API's approvalTxns are
 *  never requested as anything but quote data (they encode
 *  unlimited approvals and are never submitted), and no integrator
 *  id is sent — keyless quoting is the probed, working mode, with
 *  Relay as the fallback if Across ever throttles it. */
export function buildAcrossQuoteParams({ fromChainKey, toChainKey, fromAmount, fromAddress, toAddress }, plan, { appFeeFraction = null } = {}) {
  const from = NETWORKS[fromChainKey], to = NETWORKS[toChainKey];
  const q = new URLSearchParams({
    tradeType: "exactInput",
    amount: String(fromAmount),
    inputToken: plan.inputToken,
    outputToken: plan.outputToken,
    originChainId: String(from.chainId),
    destinationChainId: String(to.chainId),
    depositor: fromAddress,
    recipient: toAddress || fromAddress,
  });
  if (appFeeFraction != null && Number(appFeeFraction) > 0) {
    q.set("appFee", String(appFeeFraction));
    q.set("appFeeRecipient", ACROSS_APP_FEE_RECIPIENT);
  }
  return q;
}
/** Decode the API-returned deposit calldata (the unified SpokePool
 *  `deposit`). Returns the fields Fluid verifies, or null when the
 *  calldata does not decode as exactly that call with EVM-style
 *  addresses in its bytes32 slots. Pure. */
function decodeAcrossDeposit(data) {
  try {
    const dec = new ethers.Interface(ACROSS_DEPOSIT_ABI).decodeFunctionData("deposit", data);
    const addr = (v) => {
      const s = String(v);
      return /^0x0{24}[0-9a-fA-F]{40}$/.test(s) ? "0x" + s.slice(-40) : null;
    };
    const depositor = addr(dec[0]), recipient = addr(dec[1]);
    const inputToken = addr(dec[2]), outputToken = addr(dec[3]);
    if (!depositor || !recipient || !inputToken || !outputToken) return null;
    return {
      depositor, recipient, inputToken, outputToken,
      inputAmount: dec[4].toString(), outputAmount: dec[5].toString(),
      destinationChainId: Number(dec[6]), message: dec[11],
    };
  } catch { return null; }
}
/** Decode the handler message (Across MulticallHandler
 *  Instructions) and demand byte-exact re-encoding: the message
 *  must be the canonical encoding of exactly (Call[], fallback) —
 *  no trailing garbage, no exotic packing. Returns
 *  { calls: [{target, data, value}], fallbackRecipient } or null. */
function decodeAcrossHandlerMessage(message) {
  try {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const [inst] = coder.decode([ACROSS_INSTRUCTIONS_TYPE], message);
    const re = coder.encode([ACROSS_INSTRUCTIONS_TYPE], [inst]);
    if (re.toLowerCase() !== String(message).toLowerCase()) return null;
    const calls = Array.from(inst[0]).map(c => ({ target: c[0], data: c[1], value: c[2] }));
    return { calls, fallbackRecipient: inst[1] };
  } catch { return null; }
}
/** Bounds-check an Across route's deposit BEFORE anything is
 *  signed (the Across twin of checkRelayStepBounds), decoding the
 *  actual calldata fresh — the route object's stored fields are
 *  the EXPECTATIONS, never the evidence:
 *   - the deposit must target the origin chain's SpokePool (the
 *     pinned address where one is pinned; the quote's own
 *     checks.allowance.spender everywhere else — the pool the
 *     exact-amount approval names must be the pool the deposit
 *     calls), and its depositor / tokens / amount / destination
 *     chain must be exactly the swap the user approved;
 *   - fee-free quote: the deposit recipient must be the USER and
 *     the message empty — the plain shape;
 *   - fee-bearing quote: the recipient must be the destination
 *     chain's pinned handler, and the message must decode (byte-
 *     exact) to calls that move value ONLY as pinned — one
 *     transfer of exactly the quote's app fee to the collection
 *     wallet, at least one handler delivery call naming
 *     (outputToken, user) as the remainder leg, at most one
 *     adapter call whose every embedded address is the user, the
 *     collection wallet, the two tokens, the handler or the
 *     adapter itself; every call value 0; no approve / transfer /
 *     transferFrom selector hidden anywhere one does not belong.
 *  Any deviation refuses the route (the dispatcher falls back to
 *  Relay); nothing here can be talked into signing. */
export function checkAcrossDepositBounds(route, owner) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this route: " + m + " Pick another route." });
  const ac = route?.across;
  if (route?.provider !== "across" || !ac?.swapTx) return refuse("the route carried no Across deposit to inspect.");
  if (!owner) return refuse("the swap's account is unknown.");
  const ownerLc = String(owner).toLowerCase();
  if (!ethers.isAddress(ac.swapTx.to || "")) return refuse("the Across deposit targeted an address Fluid couldn't verify.");
  const poolPin = ACROSS_SPOKE_POOLS[ac.originChainId];
  if (poolPin && ac.swapTx.to.toLowerCase() !== poolPin.toLowerCase())
    return refuse("the Across deposit targeted a contract that is not the chain's SpokePool.");
  if (ac.checksSpender && ac.swapTx.to.toLowerCase() !== String(ac.checksSpender).toLowerCase())
    return refuse("the Across deposit targeted a different contract than the quote's own approval names.");
  const dep = decodeAcrossDeposit(ac.swapTx.data);
  if (!dep) return refuse("the Across deposit calldata did not decode as a SpokePool deposit.");
  if (dep.depositor.toLowerCase() !== ownerLc) return refuse("the Across deposit was built for a different account than yours.");
  if (dep.inputToken.toLowerCase() !== String(ac.inputToken).toLowerCase()) return refuse("the Across deposit pulls a different token than the one being swapped.");
  if (dep.outputToken.toLowerCase() !== String(ac.outputToken).toLowerCase()) return refuse("the Across deposit delivers a different token than the one being bought.");
  if (dep.inputAmount !== String(route.fromAmount)) return refuse("the Across deposit amount did not match the exact amount being swapped.");
  if (dep.destinationChainId !== Number(ac.destinationChainId)) return refuse("the Across deposit targeted a different chain than the swap's destination.");
  let appFeeRaw = 0n;
  try { appFeeRaw = BigInt(route.platformFeeRaw ?? "0"); } catch { return refuse("the quote's app fee was unreadable."); }
  if (appFeeRaw <= 0n) {
    if (dep.recipient.toLowerCase() !== ownerLc) return refuse("a fee-free Across deposit named someone other than you as its recipient.");
    if (dep.message !== "0x") return refuse("a fee-free Across deposit carried a message Fluid didn't ask for.");
    return { ok: true };
  }
  const handler = ACROSS_HANDLERS[dep.destinationChainId];
  if (!handler) return refuse("the destination chain has no pinned Across handler — Fluid won't guess it.");
  if (dep.recipient.toLowerCase() !== handler.toLowerCase()) return refuse("the Across deposit named an unexpected handler contract as its recipient.");
  let depositOut = null;
  try { depositOut = BigInt(dep.outputAmount); } catch { return refuse("the Across deposit output amount was unreadable."); }
  if (depositOut - appFeeRaw <= 0n) return refuse("the app fee would consume the whole Across delivery.");
  const msg = decodeAcrossHandlerMessage(dep.message);
  if (!msg) return refuse("the Across handler message did not decode into the pinned instruction shape.");
  const fb = String(msg.fallbackRecipient || "").toLowerCase();
  if (fb !== "0x0000000000000000000000000000000000000000" && fb !== ownerLc)
    return refuse("the Across handler message named an unexpected fallback recipient.");
  if (!msg.calls.length || msg.calls.length > 8) return refuse("the Across handler message carried an unexpected number of calls.");
  const feeLc = ACROSS_APP_FEE_RECIPIENT.toLowerCase();
  const handlerLc = handler.toLowerCase();
  const adapter = ACROSS_MESSAGE_ADAPTERS[dep.destinationChainId];
  const adapterLc = adapter ? adapter.toLowerCase() : null;
  const transferIface = new ethers.Interface(ACROSS_ERC20_TRANSFER);
  let feeTransfers = 0, deliverCalls = 0, adapterCalls = 0;
  for (const call of msg.calls) {
    let value = null;
    try { value = BigInt(call.value); } catch { return refuse("an Across handler call carried an unreadable value."); }
    if (value !== 0n) return refuse("an Across handler call carried native value it should not have.");
    const data = String(call.data || "");
    if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) return refuse("an Across handler call carried data Fluid couldn't inspect.");
    const sel = data.slice(0, 10).toLowerCase();
    const target = String(call.target || "").toLowerCase();
    if (sel === "0xa9059cbb") {
      // An ERC-20 transfer: only the fee leg (exactly the quote's
      // app fee, to the collection wallet, on the output token)
      // and — if a future quote makes it explicit — the remainder
      // leg (exactly output minus fee, to the user) may exist.
      if (target !== dep.outputToken.toLowerCase()) return refuse("an Across handler transfer targeted a contract that is not the output token.");
      let to = null, amt = null;
      try { const d = transferIface.decodeFunctionData("transfer", data); to = d[0]; amt = d[1]; }
      catch { return refuse("an Across handler transfer did not decode."); }
      if (String(to).toLowerCase() === feeLc && amt === appFeeRaw) { feeTransfers++; continue; }
      if (String(to).toLowerCase() === ownerLc && amt === depositOut - appFeeRaw) { continue; }
      return refuse("an Across handler transfer moved the output somewhere unexpected.");
    }
    if (sel === ACROSS_HANDLER_DELIVER_SELECTOR) {
      if (target !== handlerLc) return refuse("an Across delivery call targeted an unexpected contract.");
      if (data.length !== 2 + 68 * 2) return refuse("an Across delivery call carried unexpected arguments.");
      let a0 = null, a1 = null;
      try { [a0, a1] = ethers.AbiCoder.defaultAbiCoder().decode(["address", "address"], "0x" + data.slice(10)); }
      catch { return refuse("an Across delivery call's arguments did not decode."); }
      if (String(a0).toLowerCase() !== dep.outputToken.toLowerCase() || String(a1).toLowerCase() !== ownerLc)
        return refuse("an Across delivery call named an unexpected token or recipient — the remainder must name you.");
      deliverCalls++;
      continue;
    }
    if (sel === ACROSS_ADAPTER_SELECTOR) {
      if (!adapterLc || target !== adapterLc) return refuse("an Across adapter call targeted an unexpected contract.");
      if (++adapterCalls > 1) return refuse("the Across message carried more than one adapter call.");
      const hex = data.slice(10).toLowerCase();
      if (hex.length < 200 || hex.length > 2400) return refuse("the Across adapter call carried an unexpected payload size.");
      if (/a9059cbb|095ea7b3|23b872dd|42842e0e/.test(hex)) return refuse("the Across adapter call hid a token movement or approval selector.");
      // Address containment: every ABI word in the blob that
      // decodes as an address must be one of the parties this
      // delivery is allowed to name — the user, the collection
      // wallet, the two tokens, the handler, the adapter. Small
      // words (offsets, lengths, enum values) and the quote's own
      // amounts are structural, not addresses.
      const knownAmounts = new Set([String(route.fromAmount), dep.outputAmount, appFeeRaw.toString()]);
      const allowed = new Set([ownerLc, feeLc, dep.outputToken.toLowerCase(), dep.inputToken.toLowerCase(), handlerLc, adapterLc]);
      let namesUser = false;
      for (let i = 0; i + 64 <= hex.length; i += 64) {
        const w = hex.slice(i, i + 64);
        if (!w.startsWith("000000000000000000000000")) continue;
        let v = null;
        try { v = BigInt("0x" + w); } catch { continue; }
        if (v === 0n || v < 65536n || knownAmounts.has(v.toString())) continue;
        const a = "0x" + w.slice(24);
        if (!allowed.has(a)) return refuse("the Across adapter call named an address Fluid doesn't recognise.");
        if (a === ownerLc) namesUser = true;
      }
      if (!namesUser) return refuse("the Across adapter call never named you as its recipient.");
      continue;
    }
    return refuse("the Across handler message carried a call shape Fluid has not pinned.");
  }
  if (feeTransfers !== 1) return refuse("the Across handler message did not carry exactly the quoted app-fee transfer.");
  if (deliverCalls < 1) return refuse("the Across handler message carried no delivery call naming you as the recipient.");
  return { ok: true };
}
/** Parse a Swap API response into Fluid's route shape (the fields
 *  rankSwapRoutes and the swap sheet consume), keeping the raw
 *  deposit on route.across for execution. Pure; returns null when
 *  the response is unusable, disagrees with the request it answers,
 *  is already expired, cannot be priced in USD, or fails the
 *  deposit bounds check — a quote Fluid cannot verify never
 *  reaches the signer (the dispatcher falls back to Relay).
 *
 *  PRICING: the Swap API quotes no USD values for the amounts
 *  themselves, only for its fee components — so the input's USD
 *  price is DERIVED from the bridge fee component (its raw amount
 *  and its USD value price the input token exactly), with a $1
 *  fallback for the stable hubs when a route declares no bridge
 *  fee. Amounts are converted across decimals by the same-asset
 *  identity (a BSC 18-decimal peg unit and a Base 6-decimal unit
 *  are the same dollar), and the route's own cost follows the
 *  model's one definition (routeCostUsd): the larger of the
 *  explicit components (bridge fee + any positive swap impact)
 *  and the all-in shortfall, Fluid's app fee excluded. */
export function parseAcrossQuote(quote, args, plan) {
  const from = NETWORKS[args.fromChainKey], to = NETWORKS[args.toChainKey];
  if (!from || !to || !plan) return null;
  if (!quote || typeof quote !== "object") return null;
  if (quote.crossSwapType !== "bridgeableToBridgeable") return null;
  const st = quote.swapTx;
  if (!st || !ethers.isAddress(st.to || "") || typeof st.data !== "string") return null;
  if (st.chainId != null && Number(st.chainId) !== from.chainId) return null;
  if (quote.quoteExpiryTimestamp != null && Number(quote.quoteExpiryTimestamp) * 1000 < Date.now()) return null;
  const dep = decodeAcrossDeposit(st.data);
  if (!dep) return null;
  if (dep.depositor.toLowerCase() !== String(args.fromAddress).toLowerCase()) return null;
  if (dep.inputToken.toLowerCase() !== String(plan.inputToken).toLowerCase()) return null;
  if (dep.outputToken.toLowerCase() !== String(plan.outputToken).toLowerCase()) return null;
  if (dep.inputAmount !== String(args.fromAmount)) return null;
  if (dep.destinationChainId !== to.chainId) return null;
  const details = quote.fees?.total?.details || {};
  const bridgeUsd = Number(details.bridge?.amountUsd || 0);
  const bridgeRaw = details.bridge?.amount != null ? String(details.bridge.amount) : "0";
  const impactUsd = Number(details.swapImpact?.amountUsd || 0);
  const appFeeRaw = details.app?.amount != null ? String(details.app.amount) : "0";
  const appFeeUsd = Number(details.app?.amountUsd || 0);
  let pricePerRaw = 0;
  try { const br = BigInt(bridgeRaw); if (br > 0n && bridgeUsd > 0) pricePerRaw = bridgeUsd / Number(br); } catch { /* unpriced below */ }
  if (!(pricePerRaw > 0)) {
    const sym = quote.inputToken?.symbol || plan.asset;
    const dec = Number(quote.inputToken?.decimals);
    if ((sym === "USDC" || sym === "USDT" || sym === "DAI") && Number.isFinite(dec) && dec >= 0 && dec <= 36)
      pricePerRaw = 1 / (10 ** dec);
  }
  if (!(pricePerRaw > 0)) return null;
  const inDec = Number(quote.inputToken?.decimals), outDec = Number(quote.outputToken?.decimals);
  if (!Number.isFinite(inDec) || !Number.isFinite(outDec)) return null;
  const fromAmountUSD = Number(dep.inputAmount) * pricePerRaw;
  const expectedOut = quote.expectedOutputAmount != null ? String(quote.expectedOutputAmount) : dep.outputAmount;
  const toAmountUSD = Number(expectedOut) * pricePerRaw * (10 ** inDec) / (10 ** outDec);
  const routeFeeUsd = routeCostUsd(bridgeUsd + Math.max(0, impactUsd), fromAmountUSD - toAmountUSD - appFeeUsd);
  const route = {
    provider: "across",
    id: "across:" + (quote.id || ""),
    type: "across",
    fromChainId: from.chainId, toChainId: to.chainId,
    fromAmount: String(args.fromAmount),
    fromToken: { address: args.fromTokenAddress, symbol: quote.inputToken?.symbol || plan.asset, name: quote.inputToken?.name || null, decimals: inDec, chainId: from.chainId },
    toToken: { address: args.toTokenAddress, symbol: quote.outputToken?.symbol || plan.asset, name: quote.outputToken?.name || null, decimals: outDec, chainId: to.chainId },
    toAmount: expectedOut,
    toAmountMin: quote.minOutputAmount != null ? String(quote.minOutputAmount) : null,
    toAmountUSD, fromAmountUSD,
    gasCostUSD: bridgeUsd,
    routeFeeUsd,
    executionDuration: Number.isFinite(Number(quote.expectedFillTime)) && quote.expectedFillTime != null ? Number(quote.expectedFillTime) : null,
    platformFeeRaw: appFeeRaw,
    platformFeeUsd: appFeeUsd,
    platformFeeCollecting: (() => { try { return BigInt(appFeeRaw) > 0n; } catch { return false; } })(),
    steps: [],
    across: {
      swapTx: { to: st.to, data: st.data, gas: st.gas ?? null },
      originChainId: from.chainId, destinationChainId: to.chainId,
      inputToken: plan.inputToken, outputToken: plan.outputToken,
      nativeInput: plan.nativeInput === true,
      checksSpender: quote.checks?.allowance?.spender || null,
      quoteExpiryTimestamp: quote.quoteExpiryTimestamp ?? null,
    },
  };
  if (!checkAcrossDepositBounds(route, args.fromAddress).ok) return null;
  return route;
}
/** One Swap API quote, parsed and bounds-checked. Throws on any
 *  failure (HTTP error — including the 429 throttle the readiness
 *  probe warned keyless callers about — an unusable quote, or a
 *  refused deposit) — getSwapRoutes catches and falls back. The
 *  API's approvalTxns are deliberately never read here: they
 *  encode unlimited approvals, and Fluid composes its own. */
async function fetchAcrossRoute(args, plan, opts) {
  const q = buildAcrossQuoteParams(args, plan, opts);
  const res = await fetch(`${ACROSS_API}/swap/approval?${q.toString()}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Across route search failed: " + (data.message || ("HTTP " + res.status)));
  const route = parseAcrossQuote(data, args, plan);
  if (!route) throw new Error("Across returned no usable route for that pair.");
  return route;
}
/** Across's route for a same-asset EVM pair, priced under the fee
 *  law — the same TWO-PASS discipline as the other routers: pass 1
 *  quotes with NO app fee and reads the route's own cost
 *  (routeFeeUsd — the larger of the declared bridge cost and the
 *  all-in shortfall) and the input's USD value;
 *  platformFeeBpsForRoute turns those into the fee the law allows
 *  (the destination's multiplier × the route cost, capped at the
 *  old flat 0.5% and by the destination ecosystem's total-cost
 *  ceiling). Across denominates its app fee as a fraction of the
 *  expected OUTPUT, so pass 2 converts the law's target fee USD
 *  against pass 1's expected output USD and FLOORS the fraction —
 *  the conversion can land a fraction under the target, never
 *  above it — and if the final quote nevertheless charges more
 *  than the target (the rate moved between passes), the route is
 *  refused outright and the dispatcher falls back: the law is a
 *  ceiling, not a target. The fee the user is shown is the final
 *  quote's own app figure (route.platformFeeUsd), exactly as with
 *  Relay. If the law prices the fee at 0 bps, pass 1's fee-free
 *  quote is executed as quoted. */
async function getAcrossSwapRoute(args) {
  const plan = acrossSupportsPair(args);
  if (!plan) return null;
  if (!PLATFORM_FEE_COLLECTION_ENABLED) return fetchAcrossRoute(args, plan);
  const first = await fetchAcrossRoute(args, plan);
  const bps = platformFeeBpsForRoute(first.routeFeeUsd, first.fromAmountUSD, args.toChainKey);
  if (bps <= 0) {
    first.platformFeeBps = 0;
    return first;
  }
  const targetFeeUsd = (bps / 10000) * Number(first.fromAmountUSD);
  let fraction = targetFeeUsd / Number(first.toAmountUSD);
  if (!(fraction > 0)) {
    first.platformFeeBps = 0;
    return first;
  }
  fraction = Math.floor(fraction * 1e12) / 1e12;
  const capFraction = PLATFORM_FEE_FRACTION * (Number(first.fromAmountUSD) / Number(first.toAmountUSD));
  if (fraction > capFraction) fraction = capFraction;
  const final = await fetchAcrossRoute(args, plan, { appFeeFraction: fraction });
  if (Number(final.platformFeeUsd) > targetFeeUsd + 0.001
    || Number(final.platformFeeUsd) > PLATFORM_FEE_FRACTION * Number(final.fromAmountUSD) + 0.001)
    throw new Error("Across's fee came back above Fluid's fee law — refusing the route.");
  final.platformFeeBps = bps;
  return final;
}
/** The deposit step of an Across route, when the route carries a
 *  structurally complete one — execution re-runs the full bounds
 *  check on the calldata itself, so this is a shape gate only. */
export function acrossExecutableSteps(route) {
  if (route?.provider !== "across") return [];
  const ac = route.across;
  if (!ac?.swapTx || !ethers.isAddress(ac.swapTx.to || "") || typeof ac.swapTx.data !== "string") return [];
  if (!decodeAcrossDeposit(ac.swapTx.data)) return [];
  return [ac];
}
/** Execute a chosen Across route: Fluid's own EXACT-amount
 *  approval for the input token where one is needed (the API's
 *  approvalTxns encode unlimited approvals and are never used),
 *  then the API-returned deposit transaction — bounds-checked
 *  (checkAcrossDepositBounds) BEFORE anything is signed — with
 *  msg.value == inputAmount attached when the input is the
 *  chain's native coin (the API returns no value; the SpokePool
 *  wraps the native coin against the quote's WETH address).
 *  Returns the deposit hash first (the swap itself), then the
 *  approval hash when an approval was sent. Destination delivery
 *  is Across's relayer network (~2 s); an unfilled deposit refunds
 *  automatically to this wallet on the origin chain over several
 *  hours. */
export async function executeAcrossSwapRoute(wallet, route, onProgress = () => {}, onApprove = () => {}) {
  const fromKey = Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === Number(route?.fromChainId));
  if (!fromKey) throw new Error("Across swap source chain is not a Fluid network.");
  const { ok, reason } = swapRouteExecutable(route);
  if (!ok) throw new Error(reason);
  const bounds = checkAcrossDepositBounds(route, wallet.address);
  if (!bounds.ok) throw new Error(bounds.reason);
  const provider = providerFor(fromKey);
  const signer = wallet.connect(provider);
  const ac = route.across;
  const approvalHashes = [];
  if (ac.nativeInput !== true) {
    const need = BigInt(route.fromAmount);
    const c = new ethers.Contract(ac.inputToken, SWAP_ERC20, signer);
    if ((await c.allowance(wallet.address, ac.swapTx.to)) < need) {
      onProgress(`Approving ${route.fromToken?.symbol || "token"} for the route (exact amount only)…`);
      const atx = await c.approve(ac.swapTx.to, need);
      approvalHashes.push(atx.hash);
      await atx.wait();
      try {
        onApprove({ chainKey: fromKey, token: ac.inputToken, tokenSymbol: route.fromToken?.symbol || null, spender: ac.swapTx.to, amount: need.toString(), decimals: route.fromToken?.decimals ?? null, at: Date.now() });
      } catch { /* recording an approval must never break a swap */ }
    }
  }
  onProgress("Signing the Across deposit…");
  const txReq = { to: ac.swapTx.to, data: ac.swapTx.data, value: ac.nativeInput === true ? BigInt(route.fromAmount) : 0n };
  const g = Number(ac.swapTx.gas);
  if (Number.isFinite(g) && g > 0) { try { txReq.gasLimit = BigInt(Math.floor(g)); } catch { /* let the node estimate */ } }
  const depTx = await signer.sendTransaction(txReq);
  onProgress("Deposit sent — waiting for it to mine…");
  await depTx.wait();
  return [depTx.hash, ...approvalHashes];
}
// ---------- Satora: EVM stablecoins -> Bitcoin mainnet / Lightning ----------
// Fluid's first Bitcoin-mainnet and Lightning swap DESTINATIONS
// (2026-11-08, under the owner's Immediate Incorporation Rule;
// verification report: research_notes/
// fluid-satora-verification-20261108). Satora runs non-custodial
// HTLC swaps: the user funds an EVM HTLC (via its coordinator's
// Permit2 flow) with USDC/USDT from Arbitrum, Polygon or Ethereum,
// Satora's side locks the matching BTC, and the user claims on
// Bitcoin with their OWN Fluid Taproot key — or Satora pays the
// user's Lightning invoice / address / LNURL.
//
// REST, never the SDK: Satora's TypeScript SDK keeps a SEPARATE
// BIP39 mnemonic for swap secrets. Fluid composes the REST calls
// itself and derives every per-swap secret from the USER's Fluid
// seed (satoraSwapIdentity), so the Fluid seed alone recovers
// every swap — see the derivation note there.
//
// VERSION PINS (the API enforces compatibility-version headers on
// swap creation; live-probed 2026-11-08): the ERC-20 HTLC version
// is 7 (creation responses echo evm_htlc_version 7), the Bitcoin
// HTLC script version is 1 ("new swaps must use version 1"), the
// Lightning component is 1, and the REST spec Fluid is built
// against is OpenAPI 0.3.23. Response headers carry NO version,
// so Fluid also checks GET /version's server tag before quoting
// (cached per session): an unknown epoch refuses the Satora route
// rather than improvising. Every creation response is re-checked
// against the pinned HTLC versions before anything else happens.
//
// FUNDING (un-gated 2026-11-09): funding runs through the
// coordinator's executeAndCreateWithPermit2, which requires a
// Permit2 WITNESS signature. The witness format was published
// nowhere at first — not in the REST docs, not in the OpenAPI
// spec, not in the SDK's readable surface — and a plain
// PermitTransferFrom signature failed on-chain with Permit2's
// InvalidSigner (proven against the live API's dry-run,
// 2026-11-08), so execution stayed gated until Satora's Philipp
// supplied the official witness specification directly
// (research_notes/fluid-satora-verification-20261108/
// witness-spec.md, received 2026-11-09). Fluid now constructs
// the typed data field by field from that spec, verifies EVERY
// field against the bounds-checked creation record + funding
// components before signing (buildSatoraPermitTypedData), signs
// with the user's own EVM key and submits the checked calls
// unchanged to the fund-gasless relay (executeSatoraSwapRoute).
// The developer key is LIVE (below), so the fee law's extra_fees
// are charged exactly as designed in §67.
export const SATORA_API_BASE = "https://api.satora.io";
/** The Satora developer key (referral id) Fluid's fee capture
 *  rides on — ONE constant; every fee path reads through
 *  satoraFeeConfig(). LIVE since 2026-11-09 (issued by Satora
 *  with the extra fee enabled, capped at 50 bps / 0.5% — the
 *  cap the fee law binds to anyway). The key is a public client
 *  identifier, not a secret: the API SECRET is console-only and
 *  never enters the app. (Before issuance this held the
 *  placeholder "PENDING_KEY", under which routes quoted with
 *  extra_fees 0 and no referral code; that branch survives in
 *  satoraFeeConfig and is exercised in tests through its seam.) */
export const SATORA_DEVELOPER_KEY = "lnds_1f58b4d6016ca9fc";
export const SATORA_API_SPEC_VERSION = "0.3.23";
export const SATORA_SERVER_TAG_PREFIX = "developer-portal-v0.1";
export const SATORA_ERC20_HTLC_VERSION = 7;
export const SATORA_BITCOIN_HTLC_VERSION = 1;
export const SATORA_LIGHTNING_VERSION = 1;
export const SATORA_BITCOIN_CHAIN_ID = BITCOIN_LIFI_CHAIN_ID;
export const SATORA_LIGHTNING_CHAIN_ID = 20000000000002;
export const SATORA_MIN_NET_SATS = { bitcoin: 10000, lightning: 356 };
export const SATORA_SWAPS_STORAGE_KEY = "fluid_satora_swaps_v1";
const SATORA_PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const SATORA_SOURCE_CHAINS = { ethereum: 1, polygon: 137, arbitrum: 42161 };
const SATORA_DEST_NAMES = { bitcoin: "Bitcoin", lightning: "Lightning" };
// ---------- CCTP bridge sources (Base + Solana USDC, 2026-11-09) ----------
// Two more Satora SOURCES, incorporated the day Philipp confirmed
// them (study: research_notes/fluid-satora-source-extensions-
// 20261109). Neither is a new swap type: each is a Circle CCTP v2
// inbound pre-leg in front of the shipped Arbitrum swap — the
// creation carries two extra fields (bridge_source_chain /
// bridge_source_token_address), the user burns native USDC via
// CCTP Fast Transfer with mintRecipient = the user's OWN EVM
// address, IRIS attests, receiveMessage mints Arbitrum USDC to
// the user, and the shipped Permit2 gasless funding runs
// unchanged on the server-netted amount. The SDK's settlement
// vehicle (ERC-4337 UserOp from an EIP-7702 Kernel delegation,
// an UNLIMITED Permit2 approval, a bundler keyed by Satora's own
// Alchemy/paymaster credentials) is NOT used — Fluid composes the
// crossing itself, exact-amount approvals only, and every burn is
// built + bounds-checked locally. Live-proven at build time
// (2026-11-09): creations in Fluid's exact shipped body shape
// (gasless: true, the user's own EVM address as depositor) are
// accepted with BOTH bridge strings, and the Permit2 funding
// endpoint nets the CCTP deduction identically to the userop
// endpoint (20 USDC Base burn -> source_amount 19996880; Solana
// -> 19997600), by the SDK-published formula reproduced in
// computeSatoraCctpMaxFee.
export const SATORA_CCTP_TOKEN_MESSENGER_V2 = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
export const SATORA_CCTP_MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";
export const SATORA_CCTP_SOLANA_TOKEN_MESSENGER = "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe";
export const SATORA_CCTP_SOLANA_MESSAGE_TRANSMITTER = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";
export const SATORA_CCTP_DEST_DOMAIN = 3; // Arbitrum
export const SATORA_CCTP_FAST_FINALITY = 1000;
export const SATORA_IRIS_API_BASE = "https://iris-api.circle.com";
/** The two bridge sources: CCTP moves Circle-issued USDC only,
 *  so each lane is native-USDC-only by construction. `domain` is
 *  the CCTP source domain; `sourceTokenAddress` is the pinned
 *  native USDC on that source. */
export const SATORA_BRIDGE_SOURCES = {
  base: { name: "Base", domain: 6, sourceChainKey: "base", sourceTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  solana: { name: "Solana", domain: 5, sourceChainKey: "solana", sourceTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
};

export function satoraDeveloperKeyLive(key = SATORA_DEVELOPER_KEY) {
  return typeof key === "string" && key.length > 0 && key !== "PENDING_KEY";
}
/** The fee wiring for one quote/creation pass: the developer key
 *  as the referral code and the extra_fees (bps) to send. With a
 *  placeholder key, no referral code is sent and extra_fees is 0 —
 *  quotes stay live, the fee simply isn't charged. Quote and
 *  creation MUST be given the same value (the bps the final quote
 *  was priced with), which is why both read through this helper.
 *  The optional key parameter is the tests' seam for exercising
 *  the placeholder branch without touching the live constant;
 *  production callers never pass it. */
export function satoraFeeConfig(extraFeesBps = 0, key = SATORA_DEVELOPER_KEY) {
  if (!satoraDeveloperKeyLive(key)) return { referralCode: null, extraFeesBps: 0 };
  const bps = Math.max(0, Math.min(10000, Math.floor(Number(extraFeesBps) || 0)));
  return { referralCode: key, extraFeesBps: bps };
}
function satoraVersionHeaders(destKey) {
  const h = { "x-satora-evm-erc20-htlc-version": String(SATORA_ERC20_HTLC_VERSION) };
  if (destKey === "bitcoin") h["x-satora-bitcoin-htlc-version"] = String(SATORA_BITCOIN_HTLC_VERSION);
  if (destKey === "lightning") h["x-satora-lightning-version"] = String(SATORA_LIGHTNING_VERSION);
  return h;
}
async function satoraFetchJson(path, { method = "GET", destKey = null, body = null } = {}) {
  const res = await fetch(SATORA_API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...satoraVersionHeaders(destKey) },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Satora request failed: " + (data?.error || data?.message || ("HTTP " + res.status)));
  return data;
}
// Session-cached compatibility checks. The version tag is the only
// version signal the API exposes (response headers carry none);
// pair limits are Satora's mandatory preflight data. Failures are
// never cached — a transient outage must not poison the session.
let satoraVersionPromise = null;
let satoraPairsPromise = null;
export function resetSatoraCaches() { satoraVersionPromise = null; satoraPairsPromise = null; satoraIrisFeeCache = new Map(); }
async function satoraAssertVersion() {
  if (!satoraVersionPromise) {
    satoraVersionPromise = (async () => {
      const data = await satoraFetchJson("/version");
      const tag = String(data?.tag || "");
      if (!tag.startsWith(SATORA_SERVER_TAG_PREFIX))
        throw new Error(`Satora's API reports version "${tag || "unknown"}", which is not the ${SATORA_SERVER_TAG_PREFIX}.x line Fluid was built against (spec ${SATORA_API_SPEC_VERSION}) — refusing the route rather than improvising.`);
      const status = await satoraFetchJson("/status").catch(() => null);
      if (status && status.swaps_paused === true)
        throw new Error("Satora has paused swaps right now — try again later.");
      return tag;
    })();
    satoraVersionPromise.catch(() => { satoraVersionPromise = null; });
  }
  return satoraVersionPromise;
}
async function satoraPairLimits(chainId, destKey) {
  if (!satoraPairsPromise) {
    satoraPairsPromise = (async () => {
      const data = await satoraFetchJson("/swap-pairs");
      const pairs = Array.isArray(data) ? data : (Array.isArray(data?.pairs) ? data.pairs : null);
      if (!pairs) throw new Error("Satora returned an unreadable pair list.");
      return pairs;
    })();
    satoraPairsPromise.catch(() => { satoraPairsPromise = null; });
  }
  const pairs = await satoraPairsPromise;
  const pair = pairs.find(p => p && String(p.source) === String(chainId) && p.target === SATORA_DEST_NAMES[destKey]);
  if (!pair) return null;
  const minSats = Number(pair.min_sats), maxSats = Number(pair.max_sats);
  if (!Number.isFinite(minSats) || !Number.isFinite(maxSats)) return null;
  return { minSats, maxSats };
}
/** Is this pair one Satora serves — USDC/USDT on Arbitrum,
 *  Polygon or Ethereum, destined for Bitcoin or Lightning? Pure;
 *  the token must be Fluid's own curated contract for the chain
 *  (the addresses Satora's registry expects are exactly those).
 *  Two further sources ride the CCTP bridge (see the constants
 *  block): native USDC on Base and native USDC on Solana — for
 *  those the plan's chainId/token are the SETTLEMENT pair
 *  (Arbitrum + its native USDC, where the swap actually lives)
 *  and plan.bridge describes the crossing. Everything else on
 *  those chains (Base USDT, Solana USDT/SOL, BSC anything)
 *  returns null: CCTP moves Circle-issued USDC only. */
export function satoraSupportsPair(args) {
  const destKey = (args?.toChainKey === "bitcoin" || args?.toChainKey === "btc") ? "bitcoin"
    : (args?.toChainKey === "lightning" || args?.toChainKey === "ln") ? "lightning" : null;
  if (!destKey) return null;
  const chainId = SATORA_SOURCE_CHAINS[args?.fromChainKey];
  if (chainId) {
    const net = NETWORKS[args.fromChainKey];
    const tok = (net?.tokens || []).find(t => String(t.address).toLowerCase() === String(args?.fromTokenAddress || "").toLowerCase());
    if (!tok || (tok.symbol !== "USDC" && tok.symbol !== "USDT")) return null;
    return { destKey, chainId, token: tok };
  }
  const bridge = SATORA_BRIDGE_SOURCES[args?.fromChainKey];
  if (bridge) {
    if (String(args?.fromTokenAddress || "") !== bridge.sourceTokenAddress) return null;
    const settleTok = (NETWORKS.arbitrum.tokens || []).find(t => t.symbol === "USDC");
    if (!settleTok) return null;
    return {
      destKey, chainId: SATORA_SOURCE_CHAINS.arbitrum, token: settleTok,
      bridge: { name: bridge.name, domain: bridge.domain, sourceChainKey: bridge.sourceChainKey, sourceTokenAddress: bridge.sourceTokenAddress },
    };
  }
  return null;
}
export function parseSatoraQuote(data, plan, args, baselineQuote = null) {
  if (!data || typeof data !== "object") return null;
  if (String(data.source_amount) !== String(args.fromAmount)) return null;
  const gross = Number(data.target_amount), net = Number(data.net_target_amount);
  const protocol = Number(data.protocol_fee), network = Number(data.network_fee);
  if (![gross, net, protocol, network].every(Number.isFinite) || gross <= 0 || net <= 0 || protocol < 0 || network < 0) return null;
  const rate = Number(data.protocol_fee_rate);
  if (Number.isFinite(rate) && rate > 0 && Math.abs(protocol - rate * gross) > 2) return null;
  if (baselineQuote != null) {
    // Live Satora FOLDS extra_fees into protocol_fee on a
    // fee-bearing quote: pass 2's protocol_fee is the base
    // protocol fee PLUS Fluid's fee, and its protocol_fee_rate is
    // the sum of the two rates (live-probed 2026-11-09: $20
    // Arbitrum USDC -> BTC moved protocol_fee 134 -> 268 and
    // rate 0.005 -> 0.01 at extra_fees=50, while net fell by the
    // same 134 sats). The only honest attribution is therefore
    // DIFFERENTIAL, against the fee-free pass the flow already
    // fetched: Fluid's fee is the protocol-fee differential,
    // cross-checked through the two passes' accounting identity
    //   netDifferential = fluidFee - grossDrift + networkDrift
    // which must hold within one sat (the fee-free pass's own
    // rounding). The identity matters: the Lightning lane
    // RE-PRICES between passes (live-probed 2026-11-09, stable
    // across repeated probes: pass-2 gross +10 sats on a 26,900
    // gross, protocol differential 135, net differential 125 —
    // exactly the identity), so a naive net-differential
    // equality refuses every Lightning quote, while the
    // identity separates the fee from the reprice exactly. The
    // gross reprice itself is bounded at 0.1% (the creation
    // tolerance): beyond it the second quote is a different
    // swap than the one measured, and attributing a fee from
    // it would be a guess — refuse.
    const baseGross = Number(baselineQuote.grossSats), baseNet = Number(baselineQuote.netSats);
    const baseProtocol = Number(baselineQuote.protocolFeeSats), baseNetwork = Number(baselineQuote.networkFeeSats);
    if (![baseGross, baseNet, baseProtocol, baseNetwork].every(Number.isFinite)) return null;
    if (Number(baselineQuote.fluidFeeSats) !== 0) return null;
    const grossDrift = gross - baseGross, networkDrift = network - baseNetwork;
    if (Math.abs(grossDrift) > Math.max(2, Math.floor(baseGross * 0.001))) return null;
    if (Math.abs(networkDrift) > 1) return null;
    const fluidFeeSats = protocol - baseProtocol;
    const netDifferential = baseNet - net;
    if (fluidFeeSats < 0 || Math.abs(netDifferential - (fluidFeeSats - grossDrift + networkDrift)) > 1) return null;
    return {
      grossSats: gross, netSats: net,
      protocolFeeSats: baseProtocol, networkFeeSats: network,
      fluidFeeSats, exchangeRate: String(data.exchange_rate || ""),
    };
  }
  // A fee-free quote must account for its own deductions:
  // gross - net is protocol + network, up to one sat of the
  // server's rounding. A larger unexplained deduction cannot be
  // attributed from a single quote — under the live folded shape
  // it could be a fee folded into protocol_fee, a rate move, or
  // an error — so the quote is refused rather than guessed at.
  const residual = gross - net - protocol - network;
  if (Math.abs(residual) > 1) return null;
  return { grossSats: gross, netSats: net, protocolFeeSats: protocol, networkFeeSats: network, fluidFeeSats: 0, exchangeRate: String(data.exchange_rate || "") };
}
async function fetchSatoraQuote(plan, args, extraFeesBps, baselineQuote = null) {
  const fee = satoraFeeConfig(extraFeesBps);
  const q = new URLSearchParams({
    source_chain: String(plan.chainId),
    source_token: plan.token.address,
    target_chain: SATORA_DEST_NAMES[plan.destKey],
    target_token: "btc",
    source_amount: String(args.fromAmount),
    extra_fees: String(fee.extraFeesBps),
  });
  if (fee.referralCode) q.set("ref", fee.referralCode);
  const data = await satoraFetchJson("/quote?" + q.toString(), { destKey: plan.destKey });
  return parseSatoraQuote(data, plan, args, baselineQuote);
}
// ---------- Circle IRIS: CCTP fast-transfer fee + attestation ----------
// The bridge lanes price and settle the crossing with Circle's
// own public API (no key): the fast-tier fee per domain pair, and
// the attestation that authorises the destination mint. Fees are
// Circle's LIVE parameters (1.3 bps Base->Arbitrum, 1.0 bps
// Solana->Arbitrum at build time) — read per quote, never
// hardcoded; cached ~60 s per pair, the SDK's own TTL.
let satoraIrisFeeCache = new Map();
/** The fast-tier (finality threshold 1000) fee entry of an IRIS
 *  fee response, as hundredths of a basis point (1.3 bps -> 130).
 *  Null when the response carries no usable fast tier — a lane
 *  whose crossing cannot be priced exactly is not quoted. */
export function parseIrisCctpFee(entries) {
  if (!Array.isArray(entries)) return null;
  const fast = entries.find(e => e && Number(e.finalityThreshold) === SATORA_CCTP_FAST_FINALITY) || null;
  if (!fast) return null;
  const minimumFee = Number(fast.minimumFee);
  if (!Number.isFinite(minimumFee) || minimumFee < 0) return null;
  return { minimumFee, bpsHundredths: Math.round(minimumFee * 100) };
}
/** The CCTP deduction cap for a burn of `amountRaw`, in the
 *  burn token's smallest units — the SDK-published formula that
 *  mirrors Satora's Rust backend (compute_max_fee):
 *  floor(amount x bpsHundredths / 1e6), then a 20% buffer
 *  (floor(x * 120 / 100)). This one figure is BOTH the burn's
 *  authorised maxFee AND the amount the server nets out of the
 *  funding pull (live-verified to the unit on both lanes,
 *  2026-11-09: 20,000,000 at 130 -> 3,120; at 100 -> 2,400).
 *  Circle keeps only the true fee (<= this cap); any headroom
 *  it does not consume simply never leaves the user's minted
 *  balance, because the funding pull is for the netted amount. */
export function computeSatoraCctpMaxFee(amountRaw, bpsHundredths) {
  const amount = BigInt(amountRaw);
  const bps = BigInt(Math.max(0, Math.floor(Number(bpsHundredths) || 0)));
  const protocolFee = (amount * bps) / 1000000n;
  return (protocolFee * 120n) / 100n;
}
async function fetchSatoraCctpFee(sourceDomain) {
  const key = String(sourceDomain);
  const hit = satoraIrisFeeCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.fee;
  const res = await fetch(`${SATORA_IRIS_API_BASE}/v2/burn/USDC/fees/${sourceDomain}/${SATORA_CCTP_DEST_DOMAIN}?forward=true`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Circle's fee service answered HTTP " + res.status + " — the crossing cannot be priced right now.");
  const fee = parseIrisCctpFee(await res.json().catch(() => null));
  if (!fee) throw new Error("Circle's fee service returned no fast-transfer fee for this crossing — refusing to price the route from a guess.");
  satoraIrisFeeCache.set(key, { fee, expiresAt: Date.now() + 60000 });
  return fee;
}
/** One IRIS attestation lookup for a burn (EVM by tx hash,
 *  Solana by signature): { message, attestation } once Circle's
 *  attestation is complete, null while the burn is unindexed or
 *  still confirming. Throws on transport/HTTP errors so a caller
 *  never mistakes an outage for a pending burn. */
export async function fetchSatoraCctpAttestation(sourceDomain, burnTxId) {
  const url = `${SATORA_IRIS_API_BASE}/v2/messages/${sourceDomain}?transactionHash=${encodeURIComponent(String(burnTxId))}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Circle's attestation service answered HTTP " + res.status + ".");
  const data = await res.json().catch(() => null);
  const msgs = Array.isArray(data?.messages) ? data.messages : [];
  const done = msgs.find(m => m && m.status === "complete" && typeof m.message === "string" && typeof m.attestation === "string");
  if (!done) return null;
  if (!/^0x[0-9a-fA-F]+$/.test(done.message) || !/^0x[0-9a-fA-F]+$/.test(done.attestation)) return null;
  return { message: done.message, attestation: done.attestation };
}
/** Verify a CCTP message names THIS crossing before it is
 *  submitted to receiveMessage: header fields only — destination
 *  domain Arbitrum, the expected source domain, the recipient
 *  (mintRecipient) exactly the user's own address, and the
 *  destination caller exactly the caller the burn authorised
 *  (the user's address, or zero = anyone may relay). Circle's
 *  attestation already makes a forged message unmintable; this
 *  pin means a confused or hostile relay response can never make
 *  Fluid submit a message for somebody else's crossing. */
export function checkSatoraCctpMessage(messageHex, { userAddress, sourceDomain, destinationCaller } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this CCTP message: " + m });
  if (typeof messageHex !== "string" || !/^0x[0-9a-fA-F]+$/.test(messageHex)) return refuse("the message was unreadable.");
  let bytes;
  try { bytes = ethers.getBytes(messageHex); } catch { return refuse("the message was unreadable."); }
  // v2 header: version(4) sourceDomain(4) destDomain(4) nonce(8)
  // sender(32) recipient(32) destinationCaller(32) thresholds(8).
  if (bytes.length < 124) return refuse("the message is too short to be a CCTP v2 message.");
  const u32 = (off) => new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(0, false);
  if (u32(8) !== SATORA_CCTP_DEST_DOMAIN) return refuse("the message is not addressed to Arbitrum.");
  if (Number(sourceDomain) >= 0 && u32(4) !== Number(sourceDomain)) return refuse("the message comes from a different source domain than the burn.");
  const word = (off) => "0x" + hexOf(bytes.slice(off, off + 32));
  const pad = (addr) => ethers.zeroPadValue(String(addr).toLowerCase(), 32).toLowerCase();
  if (word(52) !== pad(userAddress)) return refuse("the message would mint to a different address than your own wallet.");
  if (word(84) !== pad(destinationCaller)) return refuse("the message names a different destination caller than the burn authorised.");
  return { ok: true };
}
/** Satora's route for an EVM-stablecoin -> Bitcoin/Lightning pair,
 *  priced under the fee law with the same two-pass discipline as
 *  the other routers: pass 1 quotes fee-free to read the route's
 *  own cost (protocol + network sats, priced at an independently
 *  fetched BTC price); platformFeeBpsForRoute turns it into the
 *  allowed extra_fees (the destination ecosystem's ceiling and the
 *  0.5% cap do the binding — at evidenced sizes the cap governs);
 *  pass 2 re-quotes with that fee, and the disclosed Fluid fee is
 *  recovered differentially against pass 1 (the server folds
 *  extra_fees into protocol_fee — see parseSatoraQuote). A pass 2
 *  that cannot be reconciled with pass 1 refuses the route:
 *  quoting a fee Fluid cannot itemise would be a lying sentence.
 *  Minimums are enforced on the
 *  NET landing (Satora's quote layer does not enforce them):
 *  10,000 sats for Bitcoin, 356 for Lightning; pair limits from
 *  the /swap-pairs preflight bound the gross. Returns null when
 *  the pair is unsupported or cannot be priced honestly; throws
 *  (marked satoraTerminal) when the honest answer is an error the
 *  user must see — no other router in the dispatcher serves these
 *  destinations, so falling through would only hide it. */
export async function getSatoraSwapRoute(args) {
  const plan = satoraSupportsPair(args);
  if (!plan) return null;
  await satoraAssertVersion();
  const limits = await satoraPairLimits(plan.chainId, plan.destKey);
  if (!limits) return null;
  const prices = await getPrices().catch(() => null);
  const btcUsd = Number(prices?.BTC);
  if (!(btcUsd > 0)) return null; // unpriced: cannot rank or disclose honestly
  const fromAmountUSD = Number(swapRawToAmount(args.fromAmount, plan.token.decimals)) * (Number(prices?.[plan.token.symbol]) || 1);
  if (!(fromAmountUSD > 0)) return null;
  // Bridge sources: price the CCTP crossing from Circle's live
  // fee BEFORE the passes, because the fee law's route cost (and
  // therefore the bps) must include it, and the executor's burn
  // cap + the server's funding netting both derive from this one
  // figure. An unpriceable crossing returns no route — never a
  // route priced from a guessed fee.
  let bridge = null;
  if (plan.bridge) {
    const iris = await fetchSatoraCctpFee(plan.bridge.domain).catch(() => null);
    if (!iris) return null;
    let amount;
    try { amount = BigInt(args.fromAmount); } catch { return null; }
    const maxFee = computeSatoraCctpMaxFee(amount, iris.bpsHundredths);
    if (maxFee <= 0n || maxFee >= amount) return null;
    bridge = {
      ...plan.bridge,
      irisMinimumFee: iris.minimumFee, irisFeeBpsHundredths: iris.bpsHundredths,
      maxFeeRaw: maxFee.toString(), netSourceAmountRaw: (amount - maxFee).toString(),
      cctpFeeUsd: Number(maxFee) / 1e6 * (Number(prices?.USDC) || 1),
    };
  }
  // The sats the funded swap can actually be built on: for
  // bridged plans the funding pulls the post-CCTP netted amount,
  // so the minimums bind on the net scaled to that amount (the
  // creation's target is pinned separately, at creation).
  const postCctpNetSats = (netSats) => bridge
    ? Number(BigInt(Math.round(netSats)) * BigInt(bridge.netSourceAmountRaw) / BigInt(args.fromAmount))
    : netSats;
  const minNet = SATORA_MIN_NET_SATS[plan.destKey];
  const belowMin = (netSats) => {
    const e = new Error(plan.destKey === "bitcoin"
      ? `That swap would land about ${Math.round(netSats).toLocaleString()} sats on Bitcoin — under the 10,000-sat minimum for Bitcoin swaps. Swap a little more.`
      : `That swap would land about ${Math.round(netSats).toLocaleString()} sats on Lightning — under the 356-sat minimum for Lightning swaps. Swap a little more.`);
    e.satoraTerminal = true;
    return e;
  };
  let quote = await fetchSatoraQuote(plan, args, 0);
  if (!quote) throw new Error("Satora returned no usable quote for that pair.");
  if (quote.grossSats > limits.maxSats) {
    const e = new Error(`That swap is above Satora's maximum of ${limits.maxSats.toLocaleString()} sats for this pair. Swap less.`);
    e.satoraTerminal = true;
    throw e;
  }
  if (postCctpNetSats(quote.netSats) < minNet) throw belowMin(postCctpNetSats(quote.netSats));
  const routeFeeUsd = routeCostUsd((quote.protocolFeeSats + quote.networkFeeSats) * btcUsd / 1e8, fromAmountUSD - quote.netSats * btcUsd / 1e8)
    + (bridge ? bridge.cctpFeeUsd : 0);
  let usedBps = 0;
  if (satoraDeveloperKeyLive()) {
    const bps = platformFeeBpsForRoute(routeFeeUsd, fromAmountUSD, plan.destKey);
    if (bps > 0) {
      const q2 = await fetchSatoraQuote(plan, args, bps, quote).catch(() => null);
      if (!q2) {
        const e = new Error("Satora's fee-bearing quote could not be reconciled with its fee-free quote — refusing to quote a fee Fluid cannot itemise.");
        e.satoraTerminal = true;
        throw e;
      }
      if (postCctpNetSats(q2.netSats) >= minNet) { quote = q2; usedBps = bps; }
    }
  }
  const feeStackSats = quote.protocolFeeSats + quote.networkFeeSats + quote.fluidFeeSats;
  return {
    provider: "satora",
    id: `satora:${plan.destKey}:${plan.chainId}${bridge ? ":" + bridge.sourceChainKey : ""}`,
    type: "satora",
    fromChainId: plan.chainId,
    toChainId: plan.destKey === "bitcoin" ? SATORA_BITCOIN_CHAIN_ID : SATORA_LIGHTNING_CHAIN_ID,
    fromAmount: String(args.fromAmount),
    fromToken: { address: plan.token.address, symbol: plan.token.symbol, name: plan.token.symbol, decimals: plan.token.decimals, chainId: plan.chainId },
    toToken: { address: "btc", symbol: "BTC", name: "Bitcoin", decimals: 8, chainId: plan.destKey === "bitcoin" ? SATORA_BITCOIN_CHAIN_ID : SATORA_LIGHTNING_CHAIN_ID },
    toAmount: String(quote.netSats),
    toAmountMin: String(quote.netSats),
    fromAmountUSD,
    toAmountUSD: quote.netSats * btcUsd / 1e8,
    gasCostUSD: feeStackSats * btcUsd / 1e8 + (bridge ? bridge.cctpFeeUsd : 0),
    routeFeeUsd,
    executionDuration: (plan.destKey === "bitcoin" ? 3600 : 300) + (bridge ? 240 : 0),
    platformFeeBps: usedBps,
    platformFeeUsd: quote.fluidFeeSats * btcUsd / 1e8,
    platformFeeCollecting: usedBps > 0 && quote.fluidFeeSats > 0,
    steps: [],
    satora: {
      destKey: plan.destKey, chainId: plan.chainId,
      destInput: String(args.toAddress || ""),
      grossSats: quote.grossSats, netSats: quote.netSats,
      protocolFeeSats: quote.protocolFeeSats, networkFeeSats: quote.networkFeeSats,
      fluidFeeSats: quote.fluidFeeSats, extraFeesBps: usedBps,
      btcUsd, pairMinSats: limits.minSats, pairMaxSats: limits.maxSats,
      exchangeRate: quote.exchangeRate,
      ...(bridge ? { bridge } : {}),
    },
  };
}
/** Per-swap secrets, derived from the USER's Fluid seed — the
 *  design the SDK's separate mnemonic is replaced with:
 *   - an HD node at m/9419/121923 (Satora's own recovery namespace:
 *     the server derives user_ids at m/9419/121923/<index> from a
 *     supplied xpub) is derived from the Fluid seed;
 *   - user_id for swap <index> is that node's child <index>'s
 *     compressed public key (the 66-hex pubkey string the API
 *     requires);
 *   - the swap secret (Bitcoin destinations) is
 *     sha256("fluid-satora-preimage-v1:" || child private key ||
 *     ":" || index) — a one-way hash of the child key, NEVER the
 *     key itself: a swap preimage is revealed publicly when the
 *     user claims on Bitcoin, so it must not be (or reveal) any
 *     key. hash_lock is sha256(secret), 0x-prefixed.
 *  Fluid persists swap IDs + indices (SATORA_SWAPS_STORAGE_KEY), so
 *  recovery never depends on the server's xpub scan: re-derive the
 *  index, re-derive the secret. */
export function satoraSwapIdentity(phrase, index) {
  const i = Math.max(0, Math.floor(Number(index) || 0));
  const seed = mnemonicToSeedSync(String(phrase || "").trim().toLowerCase().replace(/\s+/g, " "));
  const node = HDKey.fromMasterSeed(seed).derive("m/9419/121923");
  const child = node.deriveChild(i);
  if (!child.privateKey) throw new Error("Could not derive this wallet's Satora swap key.");
  const secret = sha256(new Uint8Array([...new TextEncoder().encode("fluid-satora-preimage-v1:"), ...child.privateKey, ...new TextEncoder().encode(":" + i)]));
  return { userId: hexOf(child.publicKey), secretHex: hexOf(secret), hashLock: "0x" + hexOf(sha256(secret)) };
}
/** The claim key for Bitcoin destinations: the user's own Fluid
 *  Taproot (BIP86) key. claim_pk is its compressed public key (the
 *  66-hex form the API requires; the server takes the x-only key
 *  from it) — the user claims the Bitcoin HTLC with this key, so
 *  no Satora key ever touches the Bitcoin side. */
export function satoraClaimKey(phrase) {
  const k = btcTaprootKeys(phrase, 0);
  return { claimPk: hexOf(k.child.publicKey), address: k.address };
}
/** What kind of Lightning destination did the user give? A BOLT11
 *  invoice (parsed strictly — amount + payment hash come from
 *  Fluid's own parser, never the server's word), a Lightning
 *  address (name@domain), or an LNURL. Satora resolves all three. */
export function classifySatoraLightningDestination(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  try {
    const parsed = parseBolt11(s);
    return { kind: "invoice", invoice: s.toLowerCase(), parsed };
  } catch { /* not an invoice — try the other shapes */ }
  if (/^lnurl[0-9a-z]+$/i.test(s)) return { kind: "lnurl", lnurl: s };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { kind: "address", address: s };
  return null;
}
/** RECEIVABILITY GATE (Lightning): paying an invoice whose payee
 *  is the user's OWN Fluid Lightning node only works if that node
 *  can actually receive the amount — a fresh Fluid Lightning
 *  wallet has no channels and no inbound capacity, so the payment
 *  would fail after the EVM side locked. Block before anything is
 *  signed, in plain words. External invoices always pass; an
 *  amountless own invoice cannot be sized, so it passes too (the
 *  failure mode the gate exists for is the sized one). */
export function checkSatoraLightningReceivability({ destInput, ownNodeId = null, ownReceivableMsat = null } = {}) {
  const cls = classifySatoraLightningDestination(destInput);
  if (!cls || cls.kind !== "invoice" || !ownNodeId) return { ok: true };
  const payee = cls.parsed?.payee;
  if (!payee || payee.toLowerCase() !== String(ownNodeId).toLowerCase()) return { ok: true };
  if (cls.parsed.amountMsat == null) return { ok: true };
  let recv = 0n;
  try { recv = BigInt(ownReceivableMsat ?? 0); } catch { recv = 0n; }
  if (recv >= cls.parsed.amountMsat) return { ok: true };
  return { ok: false, reason: "That invoice pays your own Fluid Lightning wallet, but your wallet can't receive it yet — it has no inbound Lightning capacity (no open channels with room). Open a Lightning channel first, or pay an invoice from a different wallet." };
}
/** The CCTP bridge fields of a creation body, present ONLY on
 *  bridged plans: the settlement stays Arbitrum (evm_chain_id /
 *  token_address above are the settlement pair); these two fields
 *  tell the server the USDC crosses from the named source first.
 *  The strings are the server's own ("Base" / "Solana" — both
 *  live-probed 2026-11-09 in Fluid's exact body shape). */
function satoraBridgeCreateFields(route) {
  const b = route?.satora?.bridge;
  if (!b) return {};
  return { bridge_source_chain: b.name, bridge_source_token_address: b.sourceTokenAddress };
}
export function buildSatoraBtcCreateRequest({ route, userAddress, identity, claimPk }) {
  const fee = satoraFeeConfig(route?.satora?.extraFeesBps || 0);
  return {
    user_address: userAddress,
    evm_chain_id: Number(route.fromChainId),
    token_address: route.fromToken.address,
    amount_in: String(route.fromAmount),
    hash_lock: identity.hashLock,
    btc_htlc_script_version: SATORA_BITCOIN_HTLC_VERSION,
    claim_pk: claimPk,
    user_id: identity.userId,
    target_address: route.satora.destInput || undefined,
    gasless: true,
    ...(fee.referralCode ? { referral_code: fee.referralCode, extra_fees: fee.extraFeesBps } : {}),
    ...satoraBridgeCreateFields(route),
  };
}
export function buildSatoraLnCreateRequest({ route, userAddress, userId }) {
  const fee = satoraFeeConfig(route?.satora?.extraFeesBps || 0);
  const cls = classifySatoraLightningDestination(route?.satora?.destInput);
  if (!cls) throw new Error("That Lightning destination isn't an invoice, a Lightning address, or an LNURL Fluid can read.");
  return {
    evm_chain_id: Number(route.fromChainId),
    token_address: route.fromToken.address,
    user_address: userAddress,
    user_id: userId,
    ...(cls.kind === "invoice" ? { lightning_invoice: cls.invoice }
      : cls.kind === "address" ? { lightning_address: cls.address, target_amount_sats: Math.round(route.satora.grossSats) }
      : { lnurl: cls.lnurl, target_amount_sats: Math.round(route.satora.grossSats) }),
    gasless: true,
    ...(fee.referralCode ? { referral_code: fee.referralCode, extra_fees: fee.extraFeesBps } : {}),
    ...satoraBridgeCreateFields(route),
  };
}
/** Bounds-check a swap-creation response against the quote and the
 *  request before the record is trusted: ids, amounts and the fee
 *  stack must match the final quote exactly; the hash lock must be
 *  OURS (the secret's hash for Bitcoin, the invoice's payment hash
 *  for Lightning); the claim key echo must be our own Taproot key;
 *  the HTLC versions must be the pinned ones; every address must
 *  be well-formed. Anything else is refused — a lying server must
 *  not be able to redirect the swap. */
export function checkSatoraCreateResponse(route, data, { identity = null, claimPk = null } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this Satora swap: " + m });
  const s = route?.satora;
  if (!s || !data || typeof data !== "object") return refuse("the creation response was unreadable.");
  if (typeof data.id !== "string" || !data.id) return refuse("the creation response carried no swap id.");
  if (data.status !== "pending") return refuse("the created swap was not in the expected pending state.");
  if (Number(data.evm_chain_id) !== Number(route.fromChainId)) return refuse("the created swap is on a different chain than the quote.");
  if (String(data.source_amount) !== String(route.fromAmount)) return refuse("the created swap's amount differs from the quote.");
  if (String(data.source_token?.token_id || "").toLowerCase() !== String(route.fromToken.address).toLowerCase())
    return refuse("the created swap sells a different token than the quote.");
  // Bridged plans: the creation must echo the crossing back
  // byte-for-byte — the bridge chain string and the source token
  // exactly as requested. A missing or drifted echo means the
  // server did not register the crossing the burn will perform,
  // and funding it would strand the swap: refuse.
  if (s.bridge) {
    if (data.bridge_source_chain !== s.bridge.name)
      return refuse("the created swap does not echo the bridge source chain the crossing was planned from.");
    if (String(data.bridge_source_token_address || "") !== String(s.bridge.sourceTokenAddress))
      return refuse("the created swap does not echo the bridge source token the crossing was planned from.");
  }
  // The creation's total fee must reconcile with the quote's
  // itemised attribution (protocol + network + Fluid's fee),
  // within one sat of server rounding/drift (live-probed
  // 2026-11-09: quote attribution 134 + 160 + 134 = 428 against a
  // creation fee_sats of 429). Routes built by hand in tests may
  // carry only gross/net; for those the total deduction is the
  // attribution. A mismatch beyond tolerance means the server
  // created a differently-priced swap than the one reviewed —
  // refuse before funding.
  const feeParts = [s.protocolFeeSats, s.networkFeeSats, s.fluidFeeSats];
  const wantFee = feeParts.every(v => Number.isFinite(Number(v)) && v != null)
    ? Math.round(feeParts.reduce((a, v) => a + Number(v), 0))
    : Math.round(s.grossSats - s.netSats);
  if (!Number.isFinite(Number(data.fee_sats)) || Math.abs(Number(data.fee_sats) - wantFee) > 1)
    return refuse("the created swap's fee differs from the final quote.");
  // The payout: the server RE-PRICES at creation, so the
  // creation's target can drift a little from the quote's net
  // (live-probed 2026-11-09: quote net 26,467 against a creation
  // target of 26,459 — the creation's own gross had moved ~7
  // sats in the seconds between quote and creation, while its
  // fee_sats still reconciled with the quote's attribution
  // within 1 sat). An exact-equality pin therefore refuses
  // every live creation. The honest pin is a bounded drift —
  // 0.1% of the quoted net, floored at 2 sats — with the
  // creation's figure adopted as the record's truth (see
  // createSatoraSwap): inside it, the swap is the reviewed one
  // at a marginally moved rate (the review sentence says
  // "about"); beyond it, the server created a materially
  // different payout and funding is refused.
  const wantTarget = Math.round(s.netSats);
  const gotTarget = Number(data.target_amount);
  const targetTol = Math.max(2, Math.floor(wantTarget * 0.001));
  if (!Number.isFinite(gotTarget) || Math.abs(gotTarget - wantTarget) > targetTol)
    return refuse("the created swap's payout differs from the quote.");
  if (Number(data.evm_htlc_version) !== SATORA_ERC20_HTLC_VERSION)
    return refuse(`the created swap uses HTLC version ${data.evm_htlc_version}, not the pinned version ${SATORA_ERC20_HTLC_VERSION} Fluid was built against.`);
  if (!ethers.isAddress(data.evm_htlc_address || "") || !ethers.isAddress(data.evm_coordinator_address || "")
    || !ethers.isAddress(data.client_evm_address || "") || !ethers.isAddress(data.server_evm_address || "")
    || !ethers.isAddress(data.wbtc_address || ""))
    return refuse("the created swap carried a malformed contract address.");
  if (!(Number(data.evm_refund_locktime) > Math.floor(Date.now() / 1000)))
    return refuse("the created swap's refund timelock is not in the future.");
  if (s.destKey === "bitcoin") {
    if (!identity || String(data.evm_hash_lock || "").toLowerCase() !== identity.hashLock.toLowerCase())
      return refuse("the created swap's hash lock is not the one Fluid derived from your seed.");
    const xonly = String(claimPk || "").length === 66 ? String(claimPk).slice(2) : String(claimPk || "");
    if (String(data.btc_user_claim_pk || "").toLowerCase() !== xonly.toLowerCase())
      return refuse("the created swap's claim key is not your Fluid Taproot key.");
    if (Number(data.btc_htlc_script_version) !== SATORA_BITCOIN_HTLC_VERSION)
      return refuse("the created swap's Bitcoin HTLC script version is not the pinned version 1.");
    if (!/^bc1p[0-9a-z]+$/.test(String(data.btc_htlc_address || "")))
      return refuse("the created swap's Bitcoin HTLC address is not a Taproot address.");
  } else {
    const cls = classifySatoraLightningDestination(s.destInput);
    if (cls?.kind === "invoice") {
      if (String(data.hash_lock || "").toLowerCase() !== ("0x" + cls.parsed.paymentHash).toLowerCase())
        return refuse("the created swap's hash lock is not your invoice's payment hash.");
      if (String(data.client_lightning_invoice || "").toLowerCase() !== cls.invoice)
        return refuse("the created swap would pay a different invoice than the one you gave.");
    }
  }
  return { ok: true };
}
/** Create the swap server-side (bounds-checked) and return the
 *  persisted record — the swap id is the recovery key, so the app
 *  saves this record before anything else happens. Creation moves
 *  NO funds: the swap sits pending until it is funded. */
export async function createSatoraSwap(route, { phrase, index = 0, userAddress } = {}) {
  const s = route?.satora;
  if (!s) throw new Error("That route is not a Satora route.");
  await satoraAssertVersion();
  const identity = satoraSwapIdentity(phrase, index);
  let body, claim = null;
  if (s.destKey === "bitcoin") {
    claim = satoraClaimKey(phrase);
    body = buildSatoraBtcCreateRequest({ route, userAddress, identity, claimPk: claim.claimPk });
  } else {
    body = buildSatoraLnCreateRequest({ route, userAddress, userId: identity.userId });
  }
  const data = await satoraFetchJson(s.destKey === "bitcoin" ? "/swap/evm/bitcoin" : "/swap/evm/lightning", { method: "POST", destKey: s.destKey, body });
  const check = checkSatoraCreateResponse(route, data, { identity, claimPk: claim?.claimPk });
  if (!check.ok) throw new Error(check.reason);
  return {
    id: data.id, provider: "satora", index: Math.max(0, Math.floor(Number(index) || 0)),
    destKey: s.destKey, fromChainKey: Object.keys(SATORA_SOURCE_CHAINS).find(k => SATORA_SOURCE_CHAINS[k] === Number(route.fromChainId)) || null,
    fromSymbol: route.fromToken.symbol, fromAmount: String(route.fromAmount),
    destInput: s.destInput,
    // The record's net is the CREATION's target — the payout
    // the server actually promised — not the quote's estimate
    // (the two can drift within the tolerance checked above).
    netSats: Number.isFinite(Number(data.target_amount)) ? Math.round(Number(data.target_amount)) : Math.round(s.netSats),
    grossSats: Math.round(s.grossSats),
    feeSats: Number(data.fee_sats), status: data.status,
    protocolFeeSats: s.protocolFeeSats != null ? Math.round(Number(s.protocolFeeSats)) : null,
    networkFeeSats: s.networkFeeSats != null ? Math.round(Number(s.networkFeeSats)) : null,
    fluidFeeSats: s.fluidFeeSats != null ? Math.round(Number(s.fluidFeeSats)) : null,
    hashLock: s.destKey === "bitcoin" ? identity.hashLock : String(data.hash_lock || ""),
    claimAddress: s.destKey === "bitcoin" ? (s.destInput || claim.address) : null,
    coordinatorAddress: data.evm_coordinator_address, htlcAddress: data.evm_htlc_address,
    serverEvmAddress: data.server_evm_address, wbtcAddress: data.wbtc_address,
    refundLocktime: Number(data.evm_refund_locktime),
    // The funding witness is verified against these creation
    // facts (the sold token, the HTLC deployment it locked on);
    // fundTxHash is filled in by the executor after the relay
    // accepts the funding signature.
    sourceTokenAddress: data.source_token?.token_id || null,
    htlcKind: data.evm_htlc_kind || null,
    htlcVersion: data.evm_htlc_version != null ? Number(data.evm_htlc_version) : null,
    // Bridge crossings (Base/Solana USDC sources): the plan the
    // executor drives — burnTx is persisted BEFORE the burn is
    // broadcast (it is the transit's recovery key), and
    // bridgePhase walks burning -> attesting -> minting ->
    // funding at every persisted transition. Null on direct lanes.
    bridge: s.bridge ? {
      name: s.bridge.name, domain: s.bridge.domain, sourceChainKey: s.bridge.sourceChainKey,
      sourceTokenAddress: s.bridge.sourceTokenAddress,
      maxFeeRaw: s.bridge.maxFeeRaw, netSourceAmountRaw: s.bridge.netSourceAmountRaw,
      irisFeeBpsHundredths: s.bridge.irisFeeBpsHundredths,
      destinationCaller: null, mintTx: null, attestation: null,
    } : null,
    burnTx: null,
    bridgePhase: s.bridge ? "burning" : null,
    fundTxHash: null,
    btcHtlcAddress: data.btc_htlc_address || null,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}
/** The calls hash the coordinator verifies: keccak256 of the
 *  abi-encoded call list (proven against a live funding payload,
 *  2026-11-08 — Fluid's recomputation reproduces the server's
 *  calls_hash exactly). */
export function satoraCallsHash(calls) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const tuples = (calls || []).map(c => [c.target, BigInt(c.value ?? "0"), c.call_data]);
  return ethers.keccak256(coder.encode(["tuple(address target, uint256 value, bytes callData)[]"], [tuples]));
}
/** Bounds-check the Permit2 funding components against the swap
 *  record before any signature is even contemplated: every field
 *  must pin back to the bounds-checked creation response (the
 *  coordinator, the Permit2 contract, the sold token and its EXACT
 *  amount, the lock token, the preimage hash, the server's claim
 *  address, the refund timelock), the calls hash must recompute,
 *  and the calls must be exactly the accepted two-call shape — an
 *  exact-amount approve of the DEX router ON the sold token,
 *  followed by the router's swap call carrying no value. The swap
 *  call's internals are the one part Fluid cannot semantically
 *  verify (proprietary DEX calldata) — the mitigations are the
 *  pins above plus the Permit2 permit's own cap: the coordinator
 *  can never pull more than the exact source amount. */
/** The amount the funding pull must be for: the full swap
 *  amount on direct lanes; on bridged lanes the server-netted
 *  amount (burn amount minus the CCTP deduction cap the quote
 *  computed — the Permit2 endpoint nets it identically, live-
 *  verified 2026-11-09). A bridged payload naming any other
 *  amount is a drift and refused by the checks that read this. */
export function satoraFundingAmount(record) {
  if (record?.bridge && record.bridge.netSourceAmountRaw) return String(record.bridge.netSourceAmountRaw);
  return String(record?.fromAmount);
}
export function checkSatoraFundingComponents(comp, record) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this Satora funding payload: " + m });
  if (!comp || typeof comp !== "object" || !record) return refuse("the payload was unreadable.");
  const eq = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  if (!eq(comp.coordinator_address, record.coordinatorAddress)) return refuse("the coordinator differs from the swap's creation record.");
  if (!eq(comp.permit2_address, SATORA_PERMIT2_ADDRESS)) return refuse("the Permit2 contract is not the canonical one.");
  if (String(comp.source_amount) !== satoraFundingAmount(record)) return refuse("the funding amount differs from the swap amount.");
  if (!eq(comp.lock_token_address, record.wbtcAddress)) return refuse("the lock token differs from the swap's creation record.");
  if (!eq(comp.preimage_hash, record.hashLock)) return refuse("the preimage hash differs from the swap's hash lock.");
  if (!eq(comp.claim_address, record.serverEvmAddress)) return refuse("the claim address differs from the swap's creation record.");
  if (Number(comp.timelock) !== Number(record.refundLocktime)) return refuse("the timelock differs from the swap's creation record.");
  const calls = comp.calls;
  if (!Array.isArray(calls) || calls.length !== 2) return refuse("the funding calls are not the expected approve + swap pair.");
  if (!eq(comp.calls_hash, satoraCallsHash(calls))) return refuse("the calls hash does not recompute — the calls were tampered with or misreported.");
  for (const c of calls) if (String(c?.value ?? "0") !== "0") return refuse("a funding call carries native value it should not have.");
  const srcToken = comp.source_token_address;
  if (!ethers.isAddress(srcToken || "") || !eq(calls[0].target, srcToken)) return refuse("the approval does not target the token being sold.");
  let decoded = null;
  try { decoded = new ethers.Interface(SWAP_ERC20).decodeFunctionData("approve", calls[0].call_data); }
  catch { return refuse("the first funding call did not decode as an ERC-20 approval."); }
  if (!eq(decoded[0], calls[1].target)) return refuse("the approval's spender is not the swap call's router.");
  if (BigInt(decoded[1]) !== BigInt(satoraFundingAmount(record))) return refuse("the approval is not for exactly the swap amount.");
  const swapData = String(calls[1].call_data || "").toLowerCase();
  if (!swapData.includes(String(srcToken).toLowerCase().slice(2)) || !swapData.includes(String(comp.lock_token_address).toLowerCase().slice(2)))
    return refuse("the swap call does not name the sold token and the lock token.");
  return { ok: true };
}
export async function fetchSatoraFundingComponents(record) {
  const data = await satoraFetchJson(`/swap/${encodeURIComponent(record.id)}/swap-and-lock-calldata-permit2`, { destKey: record.destKey });
  const check = checkSatoraFundingComponents(data, record);
  if (!check.ok) throw new Error(check.reason);
  return data;
}
// ---------- Permit2 witness funding (spec received 2026-11-09) ----------
// The official witness specification (Philipp, Satora —
// research_notes/fluid-satora-verification-20261108/
// witness-spec.md) for the coordinator's
// executeAndCreateWithPermit2: an EIP-712 PermitWitnessTransferFrom
// under Permit2's OWN domain (name "Permit2", no version field,
// canonical verifying contract), whose ExecuteAndCreate witness
// binds the lock's terms — preimage hash, lock token, claim
// address, refund address, timelock, calls hash. Every value is
// mapped from the swap-and-lock-calldata-permit2 response and
// verified below against the bounds-checked creation record
// before the user's key signs anything.
/** The full EIP-712 type string as hashed, verbatim from the
 *  spec (sub-types alphabetical, per EIP-712). */
export const SATORA_PERMIT2_TYPE_STRING = "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,ExecuteAndCreate witness)ExecuteAndCreate(bytes32 preimageHash,address token,address claimAddress,address refundAddress,uint256 timelock,bytes32 callsHash)TokenPermissions(address token,uint256 amount)";
/** The witness struct's own type string, verbatim from the spec. */
export const SATORA_WITNESS_TYPE_STRING = "ExecuteAndCreate(bytes32 preimageHash,address token,address claimAddress,address refundAddress,uint256 timelock,bytes32 callsHash)";
/** keccak256 of the witness type string — the spec's witness
 *  typehash, computed here from the pinned string (tests verify
 *  it against independent keccak computations). */
export const SATORA_WITNESS_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(SATORA_WITNESS_TYPE_STRING));
/** The funding signature's lifetime: the client-chosen deadline
 *  is now + 30 minutes (the reference client's choice); the
 *  builder refuses deadlines beyond now + 1 hour. */
export const SATORA_FUNDING_DEADLINE_SECS = 1800;
const SATORA_PERMIT_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "ExecuteAndCreate" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  ExecuteAndCreate: [
    { name: "preimageHash", type: "bytes32" },
    { name: "token", type: "address" },
    { name: "claimAddress", type: "address" },
    { name: "refundAddress", type: "address" },
    { name: "timelock", type: "uint256" },
    { name: "callsHash", type: "bytes32" },
  ],
};
/** The witness's refundAddress rule, exactly as the spec states
 *  it: deployments whose locks are keyed under the depositor —
 *  HTLCErc20 from v7, HTLCNative from v2 — name the DEPOSITOR
 *  (the wallet signing the permit; the depositor is the HTLC
 *  sender and refunds directly after the timelock); older
 *  deployments name the COORDINATOR. An unknown kind, or a
 *  missing/unreadable version, returns null and the caller
 *  refuses: the reference client defaults those to the
 *  coordinator, but Fluid does not guess at a field whose wrong
 *  value invalidates the signature — and Fluid's own creations
 *  are pinned to HTLCErc20 v7, where the rule is unambiguous. */
export function satoraPermitRefundAddress({ htlcKind, htlcVersion, depositor, coordinatorAddress } = {}) {
  const kind = String(htlcKind || "").toLowerCase();
  const v = Number(htlcVersion);
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) return null;
  if (kind === "erc20") return v >= 7 ? depositor : coordinatorAddress;
  if (kind === "native") return v >= 2 ? depositor : coordinatorAddress;
  return null;
}
/** A one-use Permit2 nonce: 32 CSPRNG bytes as a uint256 (the
 *  reference client's construction; Permit2 nonces are unordered,
 *  so a random one is never reused). */
export function satoraRandomPermitNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt("0x" + hexOf(bytes));
}
/** Construct AND verify the Permit2 witness typed data for one
 *  swap, field by field, per the official spec. The funding
 *  components are first re-run through
 *  checkSatoraFundingComponents (coordinator, Permit2 contract,
 *  exact amount, lock token, preimage hash, claim address,
 *  timelock, calls-hash recomputation, the approve + swap call
 *  shape); this builder then pins what that check does not: the
 *  sold token against the creation record, the HTLC kind/version
 *  against the creation record AND the pinned ERC-20 v7
 *  deployment, the refund address by the spec's rule, the chain
 *  id from the record's own chain, and the client-chosen nonce /
 *  deadline to their sane bounds. Returns { ok: false, reason }
 *  on any mismatch — the executor signs only an { ok: true }
 *  result, so a lying or drifting server can never reach the
 *  user's key. The returned digest is the EIP-712 hash of the
 *  exact domain/types/message returned alongside it. */
export function buildSatoraPermitTypedData({ comp, record, depositor, nonce, deadline, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this Satora funding signature: " + m });
  if (!record || typeof record !== "object") return refuse("the swap record was unreadable.");
  const compCheck = checkSatoraFundingComponents(comp, record);
  if (!compCheck.ok) return { ok: false, reason: compCheck.reason };
  const eq = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  if (!ethers.isAddress(depositor || "")) return refuse("the funding wallet's address was unreadable.");
  if (record.sourceTokenAddress && !eq(comp.source_token_address, record.sourceTokenAddress))
    return refuse("the funding payload sells a different token than the swap was created with.");
  // HTLC deployment: the funding payload must describe the same
  // deployment the bounds-checked creation locked on, and that
  // deployment is the pinned ERC-20 HTLC v7 — anything else is a
  // drift Fluid was not built against.
  const kind = String(comp.htlc_kind || "").toLowerCase();
  const version = Number(comp.htlc_version);
  if (record.htlcKind != null && kind !== String(record.htlcKind).toLowerCase())
    return refuse("the funding payload's HTLC kind differs from the swap's creation record.");
  if (record.htlcVersion != null && version !== Number(record.htlcVersion))
    return refuse("the funding payload's HTLC version differs from the swap's creation record.");
  if (kind !== "erc20" || version !== SATORA_ERC20_HTLC_VERSION)
    return refuse(`the funding payload locks on HTLC "${comp.htlc_kind || "?"} v${comp.htlc_version ?? "?"}", not the pinned ERC-20 HTLC v${SATORA_ERC20_HTLC_VERSION} this swap was created under.`);
  const refundAddress = satoraPermitRefundAddress({ htlcKind: kind, htlcVersion: version, depositor, coordinatorAddress: comp.coordinator_address });
  if (!refundAddress || !ethers.isAddress(refundAddress)) return refuse("the witness refund address could not be determined by the published rule.");
  const chainId = SATORA_SOURCE_CHAINS[record.fromChainKey];
  if (!chainId) return refuse("the swap's source chain is not a Satora source chain.");
  let nonceBn;
  try { nonceBn = BigInt(nonce); } catch { return refuse("the Permit2 nonce was unreadable."); }
  if (nonceBn <= 0n || nonceBn >= (1n << 256n)) return refuse("the Permit2 nonce is out of range.");
  let deadlineBn;
  try { deadlineBn = BigInt(deadline); } catch { return refuse("the funding deadline was unreadable."); }
  const now = Math.floor(Number(nowSec) || 0);
  if (deadlineBn <= BigInt(now) || deadlineBn > BigInt(now + 3600))
    return refuse("the funding deadline is outside its sane bound (it must be within the next hour).");
  // Address CASE is normalised to the canonical checksum form:
  // the server's own claim_address arrives mixed-case but NOT
  // EIP-55-valid (see the §67 fixture), and ethers' typed-data
  // encoder throws on a bad checksum. The 20-byte values — and
  // therefore the digest — are unchanged by presentation case.
  const addr = (v) => ethers.getAddress(String(v).toLowerCase());
  const domain = { name: "Permit2", chainId, verifyingContract: SATORA_PERMIT2_ADDRESS };
  const types = SATORA_PERMIT_TYPES;
  const message = {
    permitted: { token: addr(comp.source_token_address), amount: BigInt(comp.source_amount) },
    spender: addr(comp.coordinator_address),
    nonce: nonceBn,
    deadline: deadlineBn,
    witness: {
      preimageHash: comp.preimage_hash,
      token: addr(comp.lock_token_address),
      claimAddress: addr(comp.claim_address),
      refundAddress: addr(refundAddress),
      timelock: BigInt(comp.timelock),
      callsHash: comp.calls_hash,
    },
  };
  return { ok: true, domain, types, message, refundAddress, digest: ethers.TypedDataEncoder.hash(domain, types, message) };
}
const SATORA_EIP2612_PERMIT_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"));
/** The EIP-2612 side-permit the gasless flow needs when the sold
 *  token supports it and Permit2 holds no allowance yet: Permit2
 *  can only pull what the token lets it, and a signature permit
 *  is the gasless way to grant that. The funding payload reports
 *  the token's domain separator + permit nonce; Fluid signs a
 *  permit for the EXACT swap amount — never the unlimited value
 *  the reference client uses (Fluid's exact-amount rule applies
 *  to signature approvals exactly as to on-chain ones). Permit2
 *  consumes the permit for precisely this swap's pull.
 *  Returns null when no permit is needed (no eip2612 block in
 *  the payload — the evidenced live shape — or the token doesn't
 *  support permits, or Permit2 is already approved); returns
 *  { ok: false } when a needed permit's inputs are malformed. */
export function buildSatoraEip2612Permit({ comp, record, depositor, deadline } = {}) {
  const e = comp?.eip2612;
  if (e == null) return null;
  if (e.supported !== true || e.already_approved === true) return null;
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this Satora funding signature: " + m });
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(e.domain_separator || "")))
    return refuse("the token's EIP-2612 domain separator was unreadable.");
  const pNonce = Number(e.nonce);
  if (!Number.isInteger(pNonce) || pNonce < 0) return refuse("the token's EIP-2612 nonce was unreadable.");
  if (!ethers.isAddress(depositor || "")) return refuse("the funding wallet's address was unreadable.");
  let value, deadlineBn;
  try { value = BigInt(satoraFundingAmount(record)); deadlineBn = BigInt(deadline); } catch { return refuse("the EIP-2612 permit's terms were unreadable."); }
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const structHash = ethers.keccak256(coder.encode(
    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
    [SATORA_EIP2612_PERMIT_TYPEHASH, ethers.getAddress(String(depositor).toLowerCase()), SATORA_PERMIT2_ADDRESS, value, BigInt(pNonce), deadlineBn]));
  const digest = ethers.keccak256(ethers.concat(["0x1901", String(e.domain_separator), structHash]));
  return { ok: true, digest, value: satoraFundingAmount(record), nonce: pNonce };
}
/** The fund-gasless request body, in the relay's own field
 *  shape: the client-chosen nonce + deadline, the compact
 *  65-byte r‖s‖v signature, and the bounds-checked calls array
 *  submitted UNCHANGED (the signed calls hash covers it — the
 *  contract recomputes the hash and Permit2 rejects the
 *  signature if anything differs). The EIP-2612 permit rides
 *  along only when one was signed. */
export function buildSatoraFundGaslessBody({ comp, nonce, deadline, signature, eip2612Permit = null } = {}) {
  return {
    permit2_nonce: BigInt(nonce).toString(),
    permit2_deadline: Number(deadline),
    permit2_signature: signature,
    calls: comp.calls,
    ...(eip2612Permit ? { eip2612_permit: eip2612Permit } : {}),
  };
}
/** Submit the funding signature to Satora's relayer. The
 *  response is the server's word, so it is pinned to this swap:
 *  the id must be the record's own, and the relay's transaction
 *  hash must be a well-formed hash before it is stored. */
export async function submitSatoraFundGasless(record, body) {
  const data = await satoraFetchJson(`/swap/${encodeURIComponent(record.id)}/fund-gasless`, { method: "POST", destKey: record.destKey, body });
  if (!data || String(data.id || "") !== String(record.id))
    throw new Error("Satora's funding response named a different swap — refusing to trust it.");
  if (typeof data.tx_hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(data.tx_hash))
    throw new Error("Satora's funding response carried no transaction hash.");
  return data;
}
/** The swap status model: Satora's wire states mapped to a phase,
 *  a plain label, terminality, and the refund path available if the
 *  swap stalls in that state. Refund EXECUTION remains
 *  state-model-only in this build: the collaborative refund's
 *  EIP-712 params are fetchable (fetchSatoraCollabRefundParams),
 *  and the unilateral refund's call is encodable from verified
 *  terms (buildSatoraUnilateralRefundCall) — but the locked
 *  amount that call must name is only knowable from the HTLC's
 *  on-chain creation log, which Fluid does not yet read, so no
 *  refund is signed yet. The model + copy are exact and tested. */
export function satoraSwapPhase(status) {
  switch (String(status || "")) {
    case "pending": return { phase: "awaiting-funding", label: "Created — not funded yet", terminal: false, refundPath: null };
    case "clientfundingseen": return { phase: "funding-seen", label: "Funding seen — waiting for confirmations", terminal: false, refundPath: null };
    case "clientfunded": return { phase: "funded", label: "Funded — Satora is preparing the other side", terminal: false, refundPath: "collaborative" };
    case "serverfunded": return { phase: "server-funded", label: "The other side is locked — your payout is on its way", terminal: false, refundPath: "collaborative" };
    case "clientredeeming": return { phase: "claiming", label: "Claiming your payout…", terminal: false, refundPath: null };
    case "clientredeemed":
    case "serverredeemed": return { phase: "complete", label: "Complete — payout claimed", terminal: true, refundPath: null };
    case "serverwontfund": return { phase: "refund-available", label: "Satora could not complete this swap — a refund is available", terminal: false, refundPath: "collaborative" };
    case "clientfundedserverrefunded": return { phase: "refund-available", label: "Satora refunded its side — your refund unlocks at the timelock", terminal: false, refundPath: "unilateral" };
    case "clientinvalidfunded":
    case "clientfundedtoolate": return { phase: "refund-available", label: "The funding could not be used — a refund is available", terminal: false, refundPath: "collaborative" };
    case "expired": return { phase: "expired", label: "Expired unfunded — nothing was locked, nothing to refund", terminal: true, refundPath: null };
    case "clientrefunded":
    case "clientrefundedserverrefunded":
    case "clientredeemedandclientrefunded": return { phase: "refunded", label: "Refunded", terminal: true, refundPath: null };
    default: return { phase: "unknown", label: "Status: " + String(status || "unknown"), terminal: false, refundPath: null };
  }
}
/** One plain-text history line for a persisted Satora swap, with
 *  the refund truth stated wherever a refund path exists. Text
 *  only — the app renders it via textContent (audit C1 rules). */
export function satoraSwapHistoryLine(record, nowSec = Math.floor(Date.now() / 1000)) {
  const ph = satoraSwapPhase(record?.status);
  const fromHuman = record?.fromAmount != null && record?.fromSymbol
    ? `${swapRawToAmount(record.fromAmount, 6)} ${record.fromSymbol}` : "your stablecoin";
  const destName = record?.destKey === "lightning" ? "Lightning" : "Bitcoin";
  // Bridged records still crossing: the honest state is where
  // the money IS, not the swap's wire status — the crossing
  // sentence until the mint lands, then the landed state.
  if (record?.bridge && !record.fundTxHash) {
    if (!record.burnTx) return `Satora swap: ${fromHuman} → about ${Math.round(Number(record.netSats || 0)).toLocaleString()} sats on ${destName} — created; the crossing from ${record.bridge.name} has not started yet.`;
    if (record.bridgePhase === "funding") return `Satora swap: ${fromHuman} → about ${Math.round(Number(record.netSats || 0)).toLocaleString()} sats on ${destName} — your USDC has landed on Arbitrum and the swap is being funded.`;
    return `Satora swap: ${fromHuman} (${record.bridge.name}) → ${destName} — USDC has left ${record.bridge.name} and is crossing to Arbitrum — this step can't be cancelled, and the money can only land in your own wallet.`;
  }
  let line = `Satora swap: ${fromHuman} → about ${Math.round(Number(record?.netSats || 0)).toLocaleString()} sats on ${destName} — ${ph.label}.`;
  if (ph.refundPath === "collaborative")
    line += ` If this swap fails, the refund comes back as WBTC/tBTC, not ${record?.fromSymbol || "the stablecoin you sent"} — a collaborative refund (Satora co-signs, no gas for you) is available now, or you can refund on your own after the 24h timelock.`;
  else if (ph.refundPath === "unilateral") {
    const when = Number(record?.refundLocktime) > nowSec ? ` It unlocks at ${new Date(Number(record.refundLocktime) * 1000).toLocaleString()}.` : " It is unlocked now.";
    line += ` If this swap fails, the refund comes back as WBTC/tBTC, not ${record?.fromSymbol || "the stablecoin you sent"} — you refund it with your own key after the timelock.${when}`;
  }
  return line;
}
/** The collaborative refund's EIP-712 parameters (server-co-signed,
 *  gasless for the user). Fetched + shape-checked only in this
 *  build — signing/submitting a refund is not wired yet; the
 *  history view states the path honestly via satoraSwapPhase. */
export async function fetchSatoraCollabRefundParams(record) {
  const data = await satoraFetchJson(`/swap/${encodeURIComponent(record.id)}/collab-refund-evm/params`, { destKey: record.destKey });
  if (!data || !["direct", "coordinator", "unavailable"].includes(String(data.refund_path)))
    throw new Error("Satora returned an unreadable refund path for this swap.");
  if (String(data.sweep_token || "").toLowerCase() !== String(record.wbtcAddress || "").toLowerCase())
    throw new Error("Satora's refund would sweep a different token than the swap locked — refusing.");
  return data;
}
// HTLCErc20.refund(bytes32,uint256,address,address,uint256) —
// the depositor's own refund on the pinned v7 deployment, called
// on the HTLC contract itself after the timelock. The selector
// is pinned from the reference implementation and re-derived
// from the signature in tests.
export const SATORA_HTLC_ERC20_REFUND_SELECTOR = "0x36504721";
const SATORA_HTLC_REFUND_INTERFACE = ["function refund(bytes32 preimageHash, uint256 amount, address token, address claimAddress, uint256 timelock)"];
/** Encode the UNILATERAL refund call for a funded swap: after
 *  the timelock, the depositor (the wallet that funded) calls
 *  refund(preimageHash, amount, token, claimAddress, timelock)
 *  on the swap's own HTLC contract and the locked token returns
 *  to them — every term pinned to the bounds-checked creation
 *  record (hash lock, lock token, the server's claim address,
 *  the refund timelock, the HTLC address itself).
 *
 *  lockedAmountRaw is the ONE term the record cannot supply:
 *  the HTLC locks whatever the funding's DEX leg actually
 *  received, and the creation record's expected sats are an
 *  expectation the fill may not match to the unit. The
 *  reference client reads the lock's true amount from the
 *  HTLC's on-chain creation log; until Fluid reads that log,
 *  the caller must supply the chain-verified amount — this
 *  builder refuses without it rather than encode a call whose
 *  amount is a guess (a wrong amount computes a different lock
 *  key and the call reverts). Execution is therefore not wired
 *  to a button yet; the encoder + checks are the verified
 *  piece, ready for the lock-terms reader. */
export function buildSatoraUnilateralRefundCall(record, { lockedAmountRaw, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this Satora refund: " + m });
  if (!record || typeof record !== "object") return refuse("the swap record was unreadable.");
  if (record.htlcKind != null && String(record.htlcKind).toLowerCase() !== "erc20")
    return refuse("the swap did not lock on an ERC-20 HTLC.");
  if (record.htlcVersion != null && Number(record.htlcVersion) !== SATORA_ERC20_HTLC_VERSION)
    return refuse("the swap did not lock on the pinned ERC-20 HTLC v7.");
  if (!ethers.isAddress(record.htlcAddress || "")) return refuse("the swap's HTLC address was unreadable.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(record.hashLock || ""))) return refuse("the swap's hash lock was unreadable.");
  if (!ethers.isAddress(record.wbtcAddress || "")) return refuse("the swap's lock token was unreadable.");
  if (!ethers.isAddress(record.serverEvmAddress || "")) return refuse("the swap's claim address was unreadable.");
  const timelock = Number(record.refundLocktime);
  if (!Number.isInteger(timelock) || timelock <= 0) return refuse("the swap's refund timelock was unreadable.");
  if (Math.floor(Number(nowSec) || 0) < timelock)
    return refuse(`the refund is not unlocked yet — it opens at ${new Date(timelock * 1000).toLocaleString()}.`);
  let amount;
  try { amount = BigInt(lockedAmountRaw); } catch { return refuse("the locked amount was unreadable."); }
  if (amount <= 0n) return refuse("the locked amount must be the chain-verified amount locked in the HTLC — it cannot be guessed.");
  const data = new ethers.Interface(SATORA_HTLC_REFUND_INTERFACE)
    .encodeFunctionData("refund", [record.hashLock, amount, record.wbtcAddress, record.serverEvmAddress, BigInt(timelock)]);
  if (data.slice(0, 10).toLowerCase() !== SATORA_HTLC_ERC20_REFUND_SELECTOR)
    return refuse("the encoded refund call does not carry the pinned HTLC refund selector.");
  return { ok: true, to: record.htlcAddress, data, functionSignature: "refund(bytes32,uint256,address,address,uint256)" };
}
// --- persisted swap records (the swap id is the recovery key) ---
function validSatoraRecord(r) {
  return !!r && typeof r === "object" && typeof r.id === "string" && !!r.id && typeof r.status === "string";
}
export function loadSatoraSwapRecords(storage) {
  try {
    const list = JSON.parse(storage.getItem(SATORA_SWAPS_STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list.filter(validSatoraRecord) : [];
  } catch { return []; }
}
export function saveSatoraSwapRecord(storage, record) {
  if (!validSatoraRecord(record)) return loadSatoraSwapRecords(storage);
  const list = loadSatoraSwapRecords(storage).filter(r => r.id !== record.id);
  list.unshift(record);
  try { storage.setItem(SATORA_SWAPS_STORAGE_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* storage full/blocked: the in-memory record still stands */ }
  return list;
}
export function nextSatoraSwapIndex(records) {
  return (records || []).reduce((m, r) => Math.max(m, Math.floor(Number(r?.index) || 0) + 1), 0);
}
export async function fetchSatoraSwapStatus(id) {
  const data = await satoraFetchJson("/swap/" + encodeURIComponent(String(id)));
  if (!data || typeof data.status !== "string") throw new Error("Satora returned an unreadable swap status.");
  return data;
}
/** Background status polling over the persisted records: refresh
 *  every non-terminal swap from the server and save what changed.
 *  A failed poll keeps the last known status (honest staleness,
 *  never a fabricated state). The app calls this when the swap
 *  sheet opens and on unlock, so polling survives reloads. */
export async function pollSatoraSwapStatuses(storage) {
  const records = loadSatoraSwapRecords(storage);
  let changed = false;
  for (const r of records) {
    if (satoraSwapPhase(r.status).terminal) continue;
    try {
      const fresh = await fetchSatoraSwapStatus(r.id);
      if (fresh.status !== r.status) { r.status = fresh.status; r.updatedAt = Date.now(); changed = true; }
    } catch { /* keep the last known status */ }
  }
  if (changed) { try { storage.setItem(SATORA_SWAPS_STORAGE_KEY, JSON.stringify(records.slice(0, 50))); } catch { /* as above */ } }
  return records;
}
// ---------- CCTP burn construction (the bridge pre-leg) ----------
// Base: two ordinary EVM transactions (exact-amount approve +
// depositForBurn on Circle's canonical TokenMessengerV2 — the
// same address on every EVM chain). Solana: one hand-rolled
// legacy transaction against TokenMessengerMinterV2, ported from
// the SDK's published builder (itself a port of Circle's IDL) —
// program ids, PDA seeds, the Anchor discriminator and the Borsh
// layout are all pinned constants, and the compiled message is
// verified field by field before anything signs (the golden
// vectors in the tests were produced BY the SDK's builder).
const SATORA_CCTP_EVM_INTERFACE = new ethers.Interface([
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
  "function receiveMessage(bytes message, bytes attestation) returns (bool success)",
]);
/** The Base burn call: depositForBurn of the full swap amount
 *  into Circle's TokenMessengerV2, minting to the user's OWN EVM
 *  address on Arbitrum, with the quote's buffered fee cap. */
export function buildSatoraCctpEvmBurn({ amountRaw, mintRecipient, burnToken, destinationCaller, maxFeeRaw } = {}) {
  const data = SATORA_CCTP_EVM_INTERFACE.encodeFunctionData("depositForBurn", [
    BigInt(amountRaw), SATORA_CCTP_DEST_DOMAIN, ethers.zeroPadValue(String(mintRecipient), 32),
    String(burnToken), ethers.zeroPadValue(String(destinationCaller), 32),
    BigInt(maxFeeRaw), SATORA_CCTP_FAST_FINALITY,
  ]);
  return { to: SATORA_CCTP_TOKEN_MESSENGER_V2, data };
}
/** Bounds-check a Base burn call field by field: the target is
 *  Circle's pinned TokenMessengerV2, and every argument — the
 *  exact amount, the Arbitrum domain, the mint recipient (the
 *  user's own address), the pinned Base USDC, the authorised
 *  destination caller, the quote's fee cap, the fast finality
 *  threshold — must equal the plan. Anything else is refused. */
export function checkSatoraCctpEvmBurn(call, { userAddress, amountRaw, burnToken, destinationCaller, maxFeeRaw } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this bridge burn: " + m });
  if (!call || String(call.to || "").toLowerCase() !== SATORA_CCTP_TOKEN_MESSENGER_V2.toLowerCase())
    return refuse("the burn does not target Circle's pinned TokenMessenger contract.");
  let d;
  try { d = SATORA_CCTP_EVM_INTERFACE.decodeFunctionData("depositForBurn", call.data); }
  catch { return refuse("the burn call does not decode as a CCTP depositForBurn."); }
  const pad = (a) => ethers.zeroPadValue(String(a).toLowerCase(), 32).toLowerCase();
  if (d[0] !== BigInt(amountRaw)) return refuse("the burn amount differs from the swap amount.");
  if (Number(d[1]) !== SATORA_CCTP_DEST_DOMAIN) return refuse("the burn is not addressed to Arbitrum.");
  if (String(d[2]).toLowerCase() !== pad(userAddress)) return refuse("the burn would mint to a different address than your own wallet.");
  if (String(d[3]).toLowerCase() !== String(burnToken).toLowerCase()) return refuse("the burn token is not the pinned native USDC.");
  if (String(d[4]).toLowerCase() !== pad(destinationCaller)) return refuse("the burn names a different destination caller than authorised.");
  if (d[5] !== BigInt(maxFeeRaw)) return refuse("the burn's fee cap differs from the quote's.");
  if (Number(d[6]) !== SATORA_CCTP_FAST_FINALITY) return refuse("the burn does not use the fast-transfer finality the quote priced.");
  return { ok: true };
}
/** The Arbitrum mint call: receiveMessage on Circle's pinned
 *  MessageTransmitterV2, carrying the IRIS message + attestation
 *  for THIS record's burn (the message itself is bounds-checked
 *  by checkSatoraCctpMessage before this is built). */
export function buildSatoraCctpReceiveMessageCall({ message, attestation } = {}) {
  return {
    to: SATORA_CCTP_MESSAGE_TRANSMITTER_V2,
    data: SATORA_CCTP_EVM_INTERFACE.encodeFunctionData("receiveMessage", [String(message), String(attestation)]),
  };
}
export const SATORA_CCTP_BURN_DISCRIMINATOR = new Uint8Array([215, 60, 61, 46, 114, 55, 128, 176]); // sha256("global:deposit_for_burn")[..8]
export const SATORA_SOLANA_BURN_COMPUTE_UNIT_LIMIT = 100000;
const SATORA_COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
function satoraConcatBytes(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function satoraShortvec(value) {
  const out = [];
  let rem = value;
  for (;;) { let b = rem & 0x7f; rem >>= 7; if (rem === 0) { out.push(b); return new Uint8Array(out); } b |= 0x80; out.push(b); }
}
function satoraU32Le(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, Number(v), true); return b; }
function satoraU64Le(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return b; }
function satoraEvmBytes32(address) {
  const hexStr = String(address).toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(hexStr)) throw new Error("Not an EVM address: " + address);
  const out = new Uint8Array(32);
  for (let i = 0; i < 20; i++) out[12 + i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  return out;
}
/** The pinned PDAs of the Solana deposit_for_burn, derived from
 *  Circle's published seeds (the remote token messenger's domain
 *  seed is the domain's DECIMAL STRING, per Circle's own
 *  derivation). */
export function satoraCctpSolanaPdas(owner, mint = SATORA_BRIDGE_SOURCES.solana.sourceTokenAddress) {
  const tmm = new SolPublicKey(SATORA_CCTP_SOLANA_TOKEN_MESSENGER);
  const mt = new SolPublicKey(SATORA_CCTP_SOLANA_MESSAGE_TRANSMITTER);
  const utf8 = (s) => new TextEncoder().encode(s);
  const pda = (seeds, prog) => SolPublicKey.findProgramAddressSync(seeds, prog)[0].toBase58();
  return {
    senderAuthority: pda([utf8("sender_authority")], tmm),
    denylistAccount: pda([utf8("denylist_account"), new SolPublicKey(owner).toBuffer()], tmm),
    messageTransmitter: pda([utf8("message_transmitter")], mt),
    tokenMessenger: pda([utf8("token_messenger")], tmm),
    remoteTokenMessenger: pda([utf8("remote_token_messenger"), utf8(String(SATORA_CCTP_DEST_DOMAIN))], tmm),
    tokenMinter: pda([utf8("token_minter")], tmm),
    localToken: pda([utf8("local_token"), new SolPublicKey(mint).toBuffer()], tmm),
    eventAuthority: pda([utf8("__event_authority")], tmm),
  };
}
/** The deposit_for_burn instruction: the IDL's 18-account list
 *  (owner twice — as owner and as event rent payer — then the
 *  pinned PDAs, the mint, the co-signing message account, the
 *  two CCTP programs, Token, System, and the event-cpi pair). */
export function buildSatoraSolanaBurnInstruction({ owner, eventAccount, amountRaw, mintRecipient, destinationCaller, maxFeeRaw } = {}) {
  const mint = SATORA_BRIDGE_SOURCES.solana.sourceTokenAddress;
  const pdas = satoraCctpSolanaPdas(owner, mint);
  const ro = (pubkey) => ({ pubkey, isSigner: false, isWritable: false });
  const rw = (pubkey) => ({ pubkey, isSigner: false, isWritable: true });
  const data = satoraConcatBytes([
    SATORA_CCTP_BURN_DISCRIMINATOR,
    satoraU64Le(amountRaw), satoraU32Le(SATORA_CCTP_DEST_DOMAIN),
    satoraEvmBytes32(mintRecipient), satoraEvmBytes32(destinationCaller),
    satoraU64Le(maxFeeRaw), satoraU32Le(SATORA_CCTP_FAST_FINALITY),
  ]);
  return {
    programId: SATORA_CCTP_SOLANA_TOKEN_MESSENGER,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false }, // owner
      { pubkey: owner, isSigner: true, isWritable: true }, // event rent payer
      ro(pdas.senderAuthority),
      rw(solanaAtaAddress(owner, mint)),
      ro(pdas.denylistAccount),
      rw(pdas.messageTransmitter),
      ro(pdas.tokenMessenger),
      ro(pdas.remoteTokenMessenger),
      ro(pdas.tokenMinter),
      rw(pdas.localToken),
      rw(mint),
      { pubkey: eventAccount, isSigner: true, isWritable: true }, // message_sent_event_data
      ro(SATORA_CCTP_SOLANA_MESSAGE_TRANSMITTER),
      ro(SATORA_CCTP_SOLANA_TOKEN_MESSENGER),
      ro(SOLANA_PROGRAMS.token),
      ro(SolSystemProgram.programId.toBase58()),
      ro(pdas.eventAuthority),
      ro(SATORA_CCTP_SOLANA_TOKEN_MESSENGER), // program (event cpi)
    ],
    data,
  };
}
/** Compile instructions into a legacy Solana message (account
 *  keys ordered: fee payer, writable signers, read-only signers,
 *  writable non-signers, read-only non-signers; flags merged per
 *  key) — the SDK builder's exact algorithm, so the wire bytes
 *  are reproducible byte-for-byte (see the golden tests). */
function compileSatoraLegacyMessage(feePayer, instructions, blockhash) {
  const metas = new Map();
  const touch = (pubkey, isSigner, isWritable) => {
    const prev = metas.get(pubkey);
    metas.set(pubkey, { isSigner: (prev?.isSigner ?? false) || isSigner, isWritable: (prev?.isWritable ?? false) || isWritable });
  };
  touch(feePayer, true, true);
  for (const ix of instructions) {
    for (const k of ix.keys) touch(k.pubkey, k.isSigner, k.isWritable);
    touch(ix.programId, false, false);
  }
  const entries = [...metas.entries()];
  const group = (signer, writable) => entries.filter(([, m]) => m.isSigner === signer && m.isWritable === writable).map(([k]) => k);
  const writableSigners = group(true, true).filter(k => k !== feePayer);
  const readonlySigners = group(true, false);
  const writableNonSigners = group(false, true);
  const readonlyNonSigners = group(false, false);
  const accountKeys = [feePayer, ...writableSigners, ...readonlySigners, ...writableNonSigners, ...readonlyNonSigners];
  const index = new Map(accountKeys.map((k, i) => [k, i]));
  const numSigners = 1 + writableSigners.length + readonlySigners.length;
  const compiled = instructions.map(ix => {
    const accounts = ix.keys.map(k => index.get(k.pubkey));
    return satoraConcatBytes([new Uint8Array([index.get(ix.programId)]), satoraShortvec(accounts.length), new Uint8Array(accounts), satoraShortvec(ix.data.length), ix.data]);
  });
  const message = satoraConcatBytes([
    new Uint8Array([numSigners, readonlySigners.length, readonlyNonSigners.length]),
    satoraShortvec(accountKeys.length),
    ...accountKeys.map(k => base58.decode(k)),
    base58.decode(blockhash),
    satoraShortvec(compiled.length),
    ...compiled,
  ]);
  return { message, accountKeys, numSigners };
}
/** Build the full Solana burn transaction: ComputeBudget (unit
 *  limit + price) and the burn instruction, the ephemeral
 *  message account's signature in place, the owner's signature
 *  slot EMPTY (the executor simulates this exact artifact, then
 *  adds the owner's signature — slot 0 — whose base58 is the
 *  burn's id, persisted before broadcast). */
export function buildSatoraSolanaCctpBurn({ owner, amountRaw, mintRecipient, destinationCaller, maxFeeRaw, blockhash, priorityFeeMicroLamports = 10000n, eventSeed = null } = {}) {
  const seed = eventSeed ? new Uint8Array(eventSeed) : crypto.getRandomValues(new Uint8Array(32));
  if (seed.length !== 32) throw new Error("The burn's message-account seed was unreadable.");
  const eventAccount = base58.encode(ed25519.getPublicKey(seed));
  const burnInstruction = buildSatoraSolanaBurnInstruction({ owner, eventAccount, amountRaw, mintRecipient, destinationCaller, maxFeeRaw });
  const limitIx = { programId: SATORA_COMPUTE_BUDGET_PROGRAM, keys: [], data: satoraConcatBytes([new Uint8Array([2]), satoraU32Le(SATORA_SOLANA_BURN_COMPUTE_UNIT_LIMIT)]) };
  const priceIx = { programId: SATORA_COMPUTE_BUDGET_PROGRAM, keys: [], data: satoraConcatBytes([new Uint8Array([3]), satoraU64Le(priorityFeeMicroLamports)]) };
  const { message, accountKeys, numSigners } = compileSatoraLegacyMessage(owner, [limitIx, priceIx, burnInstruction], blockhash);
  const signatures = accountKeys.slice(0, numSigners).map(k => (k === eventAccount ? ed25519.sign(message, seed) : new Uint8Array(64)));
  const transaction = satoraConcatBytes([satoraShortvec(numSigners), ...signatures, message]);
  return { transaction, message, accountKeys, numSigners, eventAccount, eventSeed: seed, burnInstruction };
}
/** Parse a compiled legacy message back into header, keys and
 *  instructions (for the bounds check). Null on malformed bytes. */
function parseSatoraLegacyMessage(message) {
  try {
    const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);
    let off = 0;
    const readShortvec = () => { let v = 0, shift = 0; for (;;) { const b = bytes[off++]; v |= (b & 0x7f) << shift; if (!(b & 0x80)) return v; shift += 7; } };
    const numSigners = bytes[off++], numReadonlySigned = bytes[off++], numReadonlyUnsigned = bytes[off++];
    const keyCount = readShortvec();
    const accountKeys = [];
    for (let i = 0; i < keyCount; i++) { accountKeys.push(base58.encode(bytes.slice(off, off + 32))); off += 32; }
    off += 32; // blockhash
    const ixCount = readShortvec();
    const instructions = [];
    for (let i = 0; i < ixCount; i++) {
      const programIndex = bytes[off++];
      const acctCount = readShortvec();
      const accounts = [...bytes.slice(off, off + acctCount)]; off += acctCount;
      const dataLen = readShortvec();
      const data = bytes.slice(off, off + dataLen); off += dataLen;
      instructions.push({ programIndex, accounts, data });
    }
    return { numSigners, numReadonlySigned, numReadonlyUnsigned, accountKeys, instructions };
  } catch { return null; }
}
/** Bounds-check a built Solana burn against the plan: the burn
 *  instruction must equal a fresh local construction byte-for-
 *  byte (program, all 18 accounts, the Borsh body — amount,
 *  domain, recipient, caller, fee cap, finality), the compiled
 *  message must carry exactly the two ComputeBudget instructions
 *  (the pinned unit limit; a price inside the SDK's clamp) plus
 *  that burn, the fee payer must be the owner, and the only
 *  signers may be the owner and the ephemeral message account. */
export function checkSatoraSolanaCctpBurn(built, { owner, mintRecipient, destinationCaller, amountRaw, maxFeeRaw } = {}) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this bridge burn: " + m });
  if (!built || !(built.message instanceof Uint8Array)) return refuse("the burn transaction was unreadable.");
  const expected = buildSatoraSolanaBurnInstruction({ owner, eventAccount: built.eventAccount, amountRaw, mintRecipient, destinationCaller, maxFeeRaw });
  const got = built.burnInstruction;
  if (!got || got.programId !== expected.programId) return refuse("the burn does not call Circle's pinned TokenMessengerMinter program.");
  if (JSON.stringify(got.keys) !== JSON.stringify(expected.keys)) return refuse("the burn's account list differs from the pinned CCTP account map.");
  if (hexOf(got.data) !== hexOf(expected.data)) return refuse("the burn's terms (amount, domain, recipient, caller, fee cap, finality) differ from the plan.");
  const parsed = parseSatoraLegacyMessage(built.message);
  if (!parsed) return refuse("the compiled burn message was unreadable.");
  if (parsed.accountKeys[0] !== owner) return refuse("the burn's fee payer is not the swap's Solana wallet.");
  if (parsed.numSigners !== 2 || parsed.accountKeys[1] !== built.eventAccount) return refuse("the burn must be signed by exactly the owner and its message account.");
  if (parsed.instructions.length !== 3) return refuse("the burn transaction carries unexpected instructions.");
  const [cbLimit, cbPrice, burnIx] = parsed.instructions;
  const cbProgram = parsed.accountKeys[cbLimit.programIndex];
  if (cbProgram !== SATORA_COMPUTE_BUDGET_PROGRAM || parsed.accountKeys[cbPrice.programIndex] !== SATORA_COMPUTE_BUDGET_PROGRAM)
    return refuse("the burn's first instructions are not ComputeBudget instructions.");
  if (cbLimit.data.length !== 5 || cbLimit.data[0] !== 2 || new DataView(cbLimit.data.buffer, cbLimit.data.byteOffset + 1, 4).getUint32(0, true) !== SATORA_SOLANA_BURN_COMPUTE_UNIT_LIMIT)
    return refuse("the burn's compute-unit limit differs from the pinned limit.");
  if (cbPrice.data.length !== 9 || cbPrice.data[0] !== 3) return refuse("the burn's priority-fee instruction is malformed.");
  const price = new DataView(cbPrice.data.buffer, cbPrice.data.byteOffset + 1, 8).getBigUint64(0, true);
  if (price > 2000000n) return refuse("the burn's priority fee is above the sane clamp.");
  if (parsed.accountKeys[burnIx.programIndex] !== SATORA_CCTP_SOLANA_TOKEN_MESSENGER) return refuse("the burn instruction calls a different program than pinned.");
  const expectIdx = expected.keys.map(k => parsed.accountKeys.indexOf(k.pubkey));
  if (JSON.stringify(burnIx.accounts) !== JSON.stringify(expectIdx)) return refuse("the compiled burn's accounts differ from the pinned account map.");
  if (hexOf(burnIx.data) !== hexOf(expected.data)) return refuse("the compiled burn's terms differ from the plan.");
  return { ok: true };
}
/** A sane Solana priority fee for the burn, the SDK's rule:
 *  the 75th percentile of recent fees for the burn's writable
 *  state accounts, clamped to [10,000, 2,000,000] micro-lamports
 *  per CU; the floor on any read failure. */
async function suggestSatoraSolanaPriorityFee(owner) {
  try {
    const pdas = satoraCctpSolanaPdas(owner);
    const fees = await solanaRpc("getRecentPrioritizationFees", [[pdas.messageTransmitter, pdas.localToken]]);
    const paid = (Array.isArray(fees) ? fees : []).map(f => Number(f?.prioritizationFee)).filter(f => Number.isFinite(f) && f > 0).sort((a, b) => a - b);
    if (!paid.length) return 10000n;
    const p75 = BigInt(Math.floor(paid[Math.floor(paid.length * 0.75)] || 0));
    return p75 < 10000n ? 10000n : p75 > 2000000n ? 2000000n : p75;
  } catch { return 10000n; }
}

/** The pre-sign review sentence for a Satora route, in
 *  formatSwapIntent's conventions: the FULL fee stack in plain
 *  words (protocol + network + Fluid's fee when one is charged),
 *  the destination, and the refund truth — refunds come back as
 *  the BTC-pegged HTLC token (WBTC/tBTC), never the stablecoin
 *  that was sent. */
export function formatSatoraSwapIntent({ route, destInput } = {}) {
  const s = route?.satora;
  if (!s) throw new Error("That route is not a Satora route.");
  const usd = (sats) => { const v = sats * s.btcUsd / 1e8; return v < 0.01 ? "under $0.01" : "$" + v.toFixed(2); };
  const fromHuman = swapRawToAmount(route.fromAmount, route.fromToken.decimals);
  const dest = s.destKey === "bitcoin" ? "Bitcoin" : "Lightning";
  const feeParts = [
    `Satora's protocol fee ${Math.round(s.protocolFeeSats).toLocaleString()} sats (about ${usd(s.protocolFeeSats)})`,
    `network fee ${Math.round(s.networkFeeSats).toLocaleString()} sats (about ${usd(s.networkFeeSats)})`,
  ];
  const cctpSats = s.bridge ? s.bridge.cctpFeeUsd / s.btcUsd * 1e8 : 0;
  if (s.bridge) feeParts.push(`Circle's transfer fee ${Math.round(cctpSats).toLocaleString()} sats (about ${usd(cctpSats)})`);
  if (s.fluidFeeSats > 0) feeParts.push(`Fluid's fee ${Math.round(s.fluidFeeSats).toLocaleString()} sats (about ${usd(s.fluidFeeSats)})`);
  const totalSats = s.protocolFeeSats + s.networkFeeSats + s.fluidFeeSats + cctpSats;
  let destSentence;
  if (s.destKey === "bitcoin") {
    const addr = String(destInput || s.destInput || "");
    destSentence = `Your Bitcoin is claimed to ${addr ? addr.slice(0, 12) + "…" + addr.slice(-6) : "your Bitcoin address"} — a Taproot address you claim from with your own Fluid key.`;
  } else {
    const cls = classifySatoraLightningDestination(destInput || s.destInput);
    if (cls?.kind === "invoice") {
      const sats = cls.parsed.amountMsat != null ? Math.round(Number(cls.parsed.amountMsat) / 1000).toLocaleString() : null;
      destSentence = `It pays the Lightning invoice${sats ? ` for ${sats} sats` : ""}${cls.parsed.description ? ` ("${cls.parsed.description}")` : ""} you pasted.`;
    } else if (cls?.kind === "address") destSentence = `It pays the Lightning address ${cls.address}.`;
    else if (cls?.kind === "lnurl") destSentence = "It pays the LNURL you pasted.";
    else destSentence = "It pays the Lightning destination you gave.";
  }
  const fromChainName = s.bridge ? s.bridge.name : (NETWORKS[Object.keys(SATORA_SOURCE_CHAINS).find(k => SATORA_SOURCE_CHAINS[k] === Number(route.fromChainId))]?.name || "your chain");
  const crossingSentence = s.bridge
    ? ` Your USDC first crosses from ${s.bridge.name} to Arbitrum through Circle's transfer service — once it leaves ${s.bridge.name} that step can't be cancelled, and it can only land in your own wallet.${s.bridge.sourceChainKey === "base" ? " Two small transactions on Base pay their own network fees." : " Solana's network fee plus about 0.0012 SOL of account rent for the transfer's message account also apply."}`
    : "";
  return `Swap ${fromHuman} ${route.fromToken.symbol} on ${fromChainName} for about ${Math.round(s.netSats).toLocaleString()} sats on ${dest} via Satora. Fees: ${feeParts.join(", ")} — ${Math.round(totalSats).toLocaleString()} sats in total (about ${usd(totalSats)}). ${destSentence}${crossingSentence} If this swap fails, the refund comes back as WBTC/tBTC, not ${route.fromToken.symbol}. Confirm?`;
}
/** Execute a Satora route end to end (un-gated 2026-11-09, on
 *  the published witness spec): create the swap server-side
 *  (bounds-checked; the record — whose id is the recovery key —
 *  is PERSISTED before anything else happens), fetch the funding
 *  components (bounds-checked), build + verify the Permit2
 *  witness typed data field by field, sign it with the user's
 *  own EVM key, attach an exact-amount EIP-2612 permit when the
 *  token requires one, and submit the checked calls unchanged
 *  to the fund-gasless relay. Satora's relayer then runs
 *  executeAndCreateWithPermit2 — the user's stablecoin moves
 *  only under the permit's exact amount, into the bounds-checked
 *  calls. Funding is gasless for the user. Any refusal along the
 *  chain leaves the persisted record in place (status polling
 *  keeps tracking it) and signs nothing further.
 *  opts.storage is REQUIRED (a localStorage-shaped object): a
 *  swap whose id was not persisted before funding would be
 *  unrecoverable, so the executor refuses without it.
 *  Returns [fundingTxHash] — the relay's on-chain funding
 *  transaction on the source chain. */
/** Fund a persisted Satora record through the shipped gasless
 *  Permit2 path (components fetched + bounds-checked, witness
 *  typed data verified field by field, exact-amount EIP-2612
 *  permit when the token requires one). Shared by the executor
 *  and by bridge resume — the funding half never changes between
 *  lanes; on bridged records the amount it moves is the netted
 *  one (satoraFundingAmount). Persists + returns the updated
 *  record. */
async function fundSatoraSwapRecord(wallet, record, storage, onProgress = () => {}) {
  onProgress("Fetching the funding payload…");
  const comp = await fetchSatoraFundingComponents(record);
  const nowSec = Math.floor(Date.now() / 1000);
  const deadline = nowSec + SATORA_FUNDING_DEADLINE_SECS;
  const nonce = satoraRandomPermitNonce();
  const built = buildSatoraPermitTypedData({ comp, record, depositor: wallet.address, nonce, deadline, nowSec });
  if (!built.ok) throw new Error(built.reason);
  onProgress("Signing the funding authorisation…");
  const signature = await wallet.signTypedData(built.domain, built.types, built.message);
  if (!/^0x[0-9a-fA-F]{130}$/.test(String(signature || "")))
    throw new Error("The wallet returned an unreadable funding signature.");
  let eip2612Permit = null;
  const permit = buildSatoraEip2612Permit({ comp, record, depositor: wallet.address, deadline });
  if (permit) {
    if (!permit.ok) throw new Error(permit.reason);
    const ps = wallet.signingKey.sign(permit.digest);
    eip2612Permit = { v: ps.v, r: String(ps.r).slice(2), s: String(ps.s).slice(2), value: permit.value, deadline, nonce: permit.nonce };
  }
  const body = buildSatoraFundGaslessBody({ comp, nonce, deadline, signature, eip2612Permit });
  onProgress("Submitting the funding to Satora's relayer…");
  const result = await submitSatoraFundGasless(record, body);
  const updated = { ...record, fundTxHash: result.tx_hash, fundedAt: Date.now(), updatedAt: Date.now(),
    ...(record.bridge ? { bridgePhase: "funded" } : {}) };
  try {
    const fresh = await fetchSatoraSwapStatus(record.id);
    if (fresh?.status) updated.status = fresh.status;
  } catch { /* the record keeps its last known status; polling resumes it */ }
  saveSatoraSwapRecord(storage, updated);
  return updated;
}
// ---------- Bridge drive: burn -> attest -> mint -> fund ----------
// The bridge is a state machine on the persisted record, and the
// persisted burnTx is its recovery key: it is written BEFORE the
// burn is broadcast (EVM: the hash of the signed transaction;
// Solana: the base58 of the owner's signature), so no crash or
// close can orphan a crossing — resume finds the same burn and
// NEVER re-burns (a set burnTx is assumed to may-have-landed;
// only a PROVABLY failed burn — an on-chain failed receipt /
// errored signature status — lets the foreground executor retry
// once, because a failed burn moved nothing and its blockhash
// is spent anyway). IRIS is the source of truth for landing:
// it indexes the burn and carries the attestation; the mint is
// confirmed by the depositor's Arbitrum USDC balance reaching
// the record's netted amount. receiveMessage is submitted by
// the user's own Arbitrum key when the burn authorised that
// (destinationCaller = the user, chosen when the user holds
// Arbitrum ETH dust at burn time; the zero-address path leaves
// the relay to anyone — the mint can still only land at the
// pinned user address), and the crossing shows honestly until
// the mint is observed. While the steps land, the money sits
// visibly in the user's own wallet in USDC on Arbitrum.
let satoraBridgeInFlight = new Set();
function satoraBridgePersist(storage, rec) { rec.updatedAt = Date.now(); saveSatoraSwapRecord(storage, rec); }
/** The burn's destination caller: the user's own address when
 *  they hold Arbitrum ETH dust (so Fluid can submit
 *  receiveMessage itself); the zero address otherwise (anyone
 *  may relay; the mint can only land at the user's address). */
async function chooseSatoraBridgeCaller(userAddress) {
  try {
    const bal = await providerFor("arbitrum").getBalance(userAddress);
    return bal >= 200000000000000n ? userAddress : ethers.ZeroAddress; // 0.0002 ETH
  } catch { return ethers.ZeroAddress; }
}
function arbUsdcOf(userAddress) {
  const arbUsdc = (NETWORKS.arbitrum.tokens || []).find(t => t.symbol === "USDC");
  return new ethers.Contract(arbUsdc.address, ["function balanceOf(address) view returns (uint256)"], providerFor("arbitrum"));
}
async function satoraBridgeBurnEvm(wallet, rec, storage, onProgress, opts) {
  const fromKey = "base";
  const net = NETWORKS[fromKey];
  const tok = (net.tokens || []).find(t => String(t.address).toLowerCase() === String(rec.bridge.sourceTokenAddress).toLowerCase());
  const signer = wallet.connect(providerFor(fromKey));
  const amount = BigInt(rec.fromAmount);
  const token = new ethers.Contract(tok.address, ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], signer);
  const allowance = await token.allowance(wallet.address, SATORA_CCTP_TOKEN_MESSENGER_V2);
  if (allowance < amount) {
    onProgress("Approving exactly the swap amount for Circle's transfer contract…");
    if (opts?.onApprove) opts.onApprove({ chainKey: fromKey, token: tok.address, tokenSymbol: tok.symbol, spender: SATORA_CCTP_TOKEN_MESSENGER_V2, amount: rec.fromAmount, decimals: tok.decimals ?? 6, at: Date.now() });
    const atx = await token.approve(SATORA_CCTP_TOKEN_MESSENGER_V2, amount);
    rec.bridge.approveTx = atx.hash;
    satoraBridgePersist(storage, rec);
    const arc = await atx.wait().catch(() => null);
    if (!arc || Number(arc.status) !== 1) throw new Error("The approval for the crossing did not confirm — nothing was burned.");
  }
  const caller = rec.bridge.destinationCaller || await chooseSatoraBridgeCaller(wallet.address);
  rec.bridge.destinationCaller = caller;
  const call = buildSatoraCctpEvmBurn({ amountRaw: rec.fromAmount, mintRecipient: wallet.address, burnToken: tok.address, destinationCaller: caller, maxFeeRaw: rec.bridge.maxFeeRaw });
  const check = checkSatoraCctpEvmBurn(call, { userAddress: wallet.address, amountRaw: rec.fromAmount, burnToken: tok.address, destinationCaller: caller, maxFeeRaw: rec.bridge.maxFeeRaw });
  if (!check.ok) throw new Error(check.reason);
  onProgress("Burning your USDC on Base for the crossing…");
  const unsigned = { to: call.to, data: call.data, value: 0n, chainId: net.chainId };
  const populated = await signer.populateTransaction(unsigned);
  const signed = await signer.signTransaction(populated);
  rec.burnTx = ethers.keccak256(signed);
  rec.bridgePhase = "attesting";
  satoraBridgePersist(storage, rec); // BEFORE broadcast — the recovery key
  try {
    await signer.provider.broadcastTransaction(signed);
  } catch (e) {
    // A broadcast the network never saw must not strand the
    // record as "crossing" forever: if the transaction is
    // unknown on-chain, the burn provably never happened —
    // clear it (nothing moved) and surface the error.
    let known = false;
    try { known = !!(await signer.provider.getTransaction(rec.burnTx)); } catch { /* unknown is the answer we need */ }
    if (!known) { rec.burnTx = null; rec.bridgePhase = "burning"; satoraBridgePersist(storage, rec); }
    throw e;
  }
  return rec;
}
async function satoraBridgeBurnEvmRetry(rec, storage) {
  // A provably-failed burn moved nothing: clear it so the
  // executor can re-burn once (fresh nonce/blockhash). Only the
  // foreground executor does this — never resume.
  try {
    const rc = await providerFor("base").getTransactionReceipt(rec.burnTx);
    if (rc && Number(rc.status) === 0) { rec.burnTx = null; rec.bridgePhase = "burning"; satoraBridgePersist(storage, rec); return true; }
  } catch { /* an unread receipt is not proof of failure */ }
  return false;
}
async function satoraBridgeBurnSolana(wallet, rec, storage, onProgress) {
  const phrase = wallet?.mnemonic?.phrase;
  if (!phrase) throw new Error("The unlocked wallet is not available for this swap.");
  const kp = solanaKeypair(phrase);
  const owner = kp.publicKey.toBase58();
  const caller = rec.bridge.destinationCaller || await chooseSatoraBridgeCaller(wallet.address);
  rec.bridge.destinationCaller = caller;
  const { blockhash } = (await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]))?.value || {};
  if (!blockhash) throw new Error("Solana did not return a recent blockhash for the crossing.");
  const priorityFee = await suggestSatoraSolanaPriorityFee(owner);
  const built = buildSatoraSolanaCctpBurn({
    owner, amountRaw: rec.fromAmount, mintRecipient: wallet.address,
    destinationCaller: caller, maxFeeRaw: rec.bridge.maxFeeRaw,
    blockhash, priorityFeeMicroLamports: priorityFee,
  });
  const check = checkSatoraSolanaCctpBurn(built, { owner, mintRecipient: wallet.address, destinationCaller: caller, amountRaw: rec.fromAmount, maxFeeRaw: rec.bridge.maxFeeRaw });
  if (!check.ok) throw new Error(check.reason);
  // Simulate the exact artifact (message-account signature in
  // place) before the owner signs anything.
  const sim = await solanaRpc("simulateTransaction", [base64.encode(built.transaction), { sigVerify: false, commitment: "processed" }]);
  const simErr = sim?.value?.err ?? sim?.err;
  if (simErr) throw new Error("Solana refused the crossing in simulation (" + JSON.stringify(simErr) + ") — nothing was signed.");
  const seed = solanaSeedFromSeed(mnemonicToSeedSync(phrase.trim().toLowerCase().replace(/\s+/g, " ")));
  const ownerSig = ed25519.sign(built.message, seed);
  const txBytes = new Uint8Array(built.transaction);
  txBytes.set(ownerSig, satoraShortvec(built.numSigners).length); // signature slot 0 (the owner is the fee payer)
  const burnId = base58.encode(ownerSig);
  rec.burnTx = burnId;
  rec.bridgePhase = "attesting";
  satoraBridgePersist(storage, rec); // BEFORE broadcast — the recovery key
  onProgress("Burning your USDC on Solana for the crossing…");
  try {
    await solanaBroadcast(txBytes, "the CCTP burn");
  } catch (e) {
    // Same rule as the EVM burn: a broadcast the network never
    // saw (unknown signature afterwards) provably moved nothing
    // — clear the burn id so the record is not stranded.
    let known = false;
    try { const st = await solanaRpc("getSignatureStatuses", [[burnId], { searchTransactionHistory: true }]); known = !!(Array.isArray(st?.value) && st.value[0]); } catch { /* unknown is the answer we need */ }
    if (!known) { rec.burnTx = null; rec.bridgePhase = "burning"; satoraBridgePersist(storage, rec); }
    throw e;
  }
  return rec;
}
async function satoraBridgeBurnSolanaRetry(rec, storage) {
  try {
    const st = await solanaRpc("getSignatureStatuses", [[rec.burnTx], { searchTransactionHistory: true }]);
    const value = Array.isArray(st?.value) ? st.value[0] : null;
    if (value && value.err) { rec.burnTx = null; rec.bridgePhase = "burning"; satoraBridgePersist(storage, rec); return true; }
  } catch { /* an unread status is not proof of failure */ }
  return false;
}
/** Drive one bridged record as far as it can go right now.
 *  Foreground calls (the executor) may burn and poll briefly;
 *  resume calls check once per stage and never burn. Returns the
 *  record as persisted. */
async function driveSatoraBridge(wallet, record, storage, onProgress = () => {}, opts = {}) {
  const foreground = !!opts.foreground;
  let rec = { ...record };
  if (!rec.burnTx) {
    if (!foreground) return rec; // resume never burns
    rec = rec.bridge.sourceChainKey === "solana"
      ? await satoraBridgeBurnSolana(wallet, rec, storage, onProgress)
      : await satoraBridgeBurnEvm(wallet, rec, storage, onProgress, opts);
    rec.bridgePhase = "attesting";
    satoraBridgePersist(storage, rec);
  } else if (foreground && rec.bridgePhase !== "funding") {
    // A persisted burn may have provably failed on-chain (a
    // failed receipt / an errored signature status): only then
    // may the foreground drive clear it and burn again — a
    // pending or landed burn is never re-burned.
    const cleared = rec.bridge.sourceChainKey === "solana"
      ? await satoraBridgeBurnSolanaRetry(rec, storage)
      : await satoraBridgeBurnEvmRetry(rec, storage);
    if (cleared) return driveSatoraBridge(wallet, rec, storage, onProgress, opts);
  }
  // Attesting: IRIS indexes the burn + issues the attestation.
  // A persisted attestation is already Circle-issued for this
  // burn — it stays valid, so it is used as-is and IRIS is only
  // polled while none is stored.
  if (rec.bridge.attestation?.message && rec.bridge.attestation?.attestation) {
    if (rec.bridgePhase !== "minting") { rec.bridgePhase = "minting"; satoraBridgePersist(storage, rec); }
  } else {
    const deadlineMs = Date.now() + (foreground ? 90000 : 0);
    for (;;) {
      let att = null;
      try { att = await fetchSatoraCctpAttestation(rec.bridge.domain, rec.burnTx); } catch { att = null; }
      if (att) { rec.bridge.attestation = att; if (rec.bridgePhase !== "minting") rec.bridgePhase = "minting"; satoraBridgePersist(storage, rec); break; }
      if (Date.now() >= deadlineMs) return rec; // still crossing — resume continues it
      onProgress("Your USDC is crossing to Arbitrum…");
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  // Minting: the balance is the truth — once the depositor's
  // Arbitrum USDC reaches the netted amount the crossing is done.
  const user = wallet.address;
  const need = BigInt(rec.bridge.netSourceAmountRaw);
  const hasLanded = async () => { try { return await arbUsdcOf(user).balanceOf(user) >= need; } catch { return false; } };
  if (!(await hasLanded())) {
    const att = rec.bridge.attestation;
    const caller = String(rec.bridge.destinationCaller || "").toLowerCase();
    if (att && caller === user.toLowerCase()) {
      const msgCheck = checkSatoraCctpMessage(att.message, { userAddress: user, sourceDomain: rec.bridge.domain, destinationCaller: rec.bridge.destinationCaller });
      if (!msgCheck.ok) throw new Error(msgCheck.reason);
      try {
        const signer = wallet.connect(providerFor("arbitrum"));
        const mt = new ethers.Contract(SATORA_CCTP_MESSAGE_TRANSMITTER_V2, ["function receiveMessage(bytes,bytes) returns (bool)"], signer);
        const call = buildSatoraCctpReceiveMessageCall(att);
        const gas = await mt.receiveMessage.estimateGas(att.message, att.attestation).catch(() => null);
        const fee = await providerFor("arbitrum").getFeeData().catch(() => null);
        const price = fee?.gasPrice || fee?.maxFeePerGas || 0n;
        const ethBal = await providerFor("arbitrum").getBalance(user).catch(() => 0n);
        if (gas && price > 0n && ethBal * 5n >= gas * price * 6n) { // balance covers estimate x 1.2
          onProgress("Claiming your USDC on Arbitrum…");
          const tx = await mt.receiveMessage(att.message, att.attestation, gas ? { gasLimit: gas * 6n / 5n } : {});
          rec.bridge.mintTx = tx.hash;
          satoraBridgePersist(storage, rec);
          await tx.wait().catch(() => null);
        }
      } catch { /* a failed mint attempt never loses the crossing: the attestation persists and resume retries */ }
    }
    if (!(await hasLanded())) return rec; // still crossing (or awaiting a relay) — resume continues it
  }
  rec.bridgePhase = "funding";
  satoraBridgePersist(storage, rec);
  return rec;
}
export async function executeSatoraSwapRoute(wallet, route, onProgress = () => {}, opts = {}) {
  const gate = swapRouteExecutable(route);
  if (!gate.ok) throw new Error(gate.reason);
  const storage = opts?.storage;
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function")
    throw new Error("Satora swaps need storage to persist the swap id before funding — refusing to create an unrecoverable swap.");
  const phrase = wallet?.mnemonic?.phrase;
  if (!phrase || !ethers.isAddress(wallet?.address || ""))
    throw new Error("The unlocked wallet is not available for this swap.");
  const index = nextSatoraSwapIndex(loadSatoraSwapRecords(storage));
  onProgress("Creating the swap with Satora…");
  let record = await createSatoraSwap(route, { phrase, index, userAddress: wallet.address });
  saveSatoraSwapRecord(storage, record);
  satoraBridgeInFlight.add(record.id);
  try {
    if (record.bridge) {
      // The CCTP pre-leg runs first; the funding below only
      // starts once the netted USDC verifiably sits in the
      // user's own Arbitrum wallet. If the crossing is still in
      // flight, the burn id is the result — resume completes
      // the funding.
      record = await driveSatoraBridge(wallet, record, storage, onProgress, { ...opts, foreground: true });
      if (record.bridgePhase !== "funding")
        return record.burnTx ? [record.burnTx] : [];
    }
    const updated = await fundSatoraSwapRecord(wallet, record, storage, onProgress);
    return record.bridge && record.burnTx ? [record.burnTx, updated.fundTxHash] : [updated.fundTxHash];
  } finally { satoraBridgeInFlight.delete(record.id); }
}
/** Continue in-flight bridge crossings after unlock (mirrors the
 *  status poll): records whose burn is attesting/minting are
 *  driven forward — mint when possible, fund when landed — and
 *  records are NEVER re-burned here. Best-effort per record. */
export async function resumeSatoraBridgedSwaps(wallet, storage, onProgress = () => {}) {
  if (!storage || !wallet?.address || !wallet?.mnemonic?.phrase) return 0;
  const records = loadSatoraSwapRecords(storage).filter(r => r.bridge && !r.fundTxHash && r.burnTx);
  let advanced = 0;
  for (const record of records) {
    if (satoraBridgeInFlight.has(record.id)) continue;
    satoraBridgeInFlight.add(record.id);
    try {
      const rec = await driveSatoraBridge(wallet, record, storage, onProgress, { foreground: false });
      if (rec.bridgePhase === "funding") {
        await fundSatoraSwapRecord(wallet, rec, storage, onProgress);
        advanced++;
      } else if (rec.bridgePhase !== record.bridgePhase || rec.bridge.mintTx) advanced++;
    } catch { /* one stuck crossing never blocks the others */ }
    finally { satoraBridgeInFlight.delete(record.id); }
  }
  return advanced;
}

// ---------- Jupiter (PRIMARY for Solana same-chain swaps) ----------
// Verdict 2026-11-09 (research_notes/fluid-jupiter-check-20261109/,
// live-probed): for Solana → Solana swaps, LI.FI's routing sources
// Jupiter itself and adds its own 0.25% on top — so Fluid quotes
// Jupiter DIRECTLY via Swap V2's /build endpoint (Metis routing,
// decomposed instructions), roughly an order of magnitude cheaper
// on the core lanes (modelled $100 SOL→USDC ≈ $0.05–0.18 all-in vs
// ≈ $0.75 via LI.FI) and the most inspectable Solana shape Fluid
// has: the response decomposes the transaction into compute-budget
// / setup / swap / cleanup instructions, which Fluid bounds-checks
// (checkJupiterSwapBounds), assembles into a v0 transaction
// itself, signs with the wallet's Solana key and submits through
// its own RPC path — no Jupiter landing pipeline, no co-signers,
// no sponsored shapes. /order (managed execution) was rejected:
// its referral fee is clamped to 50–255 bps with a 20% Jupiter
// cut, which cannot express the fee law on cheap lanes. Swap
// V1/Metis is unmaintained upstream. Solana-source CROSS-CHAIN
// stays on LI.FI — Jupiter's swap APIs are strictly Solana-internal.
//
// ENDPOINT + RATE-LIMIT POSTURE: the keyless lite API
// (lite-api.jup.ag) is the default base — CORS-verified against
// Fluid's origin, no key, nothing secret to ship. Its keyless
// bucket is ~0.5 requests/second shared across Jupiter's APIs, so
// a quote costs one price call plus one or two /build calls paced
// by the user's own actions, and a 429 (or any 5xx) throws here
// and the dispatcher falls back to LI.FI — the Across throttle
// posture. If Jupiter retires the lite host, the same paths answer
// on api.jup.ag with a free portal key shipped as a public client
// identifier (the Relay pattern) — a base-URL change, not a
// redesign.
//
// FEE (probed live 2026-11-09, back-to-back controlled builds):
// with platformFeeBps + feeAccount set, Jupiter deducts
// floor(grossOut × bps / 10000) from the swap's OUTPUT amount and
// pays it to the fee account — ALWAYS in the output mint, whatever
// mint the fee account belongs to (an input-mint fee account still
// priced the deduction off the output, and would fail the token
// program's mint check on-chain), so the fee account is the
// collection wallet's ATA for the OUTPUT mint, derived locally
// (solanaAtaAddress) under the mint's own token program. Jupiter
// takes no cut on /build. The response states no fee field: the
// charged fee is derived from the final response's own figures —
// the route plan's gross output minus the response's net
// outAmount — and the bounds check requires that derivation to
// equal the floor formula EXACTLY for the requested bps.
// HONESTY RULE: the fee is attached only when the fee ATA
// verifiably EXISTS on-chain (getAccountInfo) — a fee pointed at
// a non-existent account would fail the swap or vanish, so a
// missing (or unverifiable) fee ATA quotes FEE-FREE through
// Jupiter and the route records why (route.jupiter.feeSkipped);
// creating those ATAs is an operator action, never something a
// user's swap silently funds.
const JUPITER_API = "https://lite-api.jup.ag";
/** The Jupiter Aggregator program — the ONLY program a /build
 *  swap instruction may target, pinned from the verification
 *  probes. */
export const JUPITER_AGGREGATOR_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const JUPITER_COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
/** The Solana collection wallet Fluid's Jupiter fees land in: the
 *  same DripBot agent wallet every other Solana fee names
 *  (FEE_SPLIT) — fees accrue to its ATA for the swap's output mint. */
export const JUPITER_FEE_WALLET = FEE_SPLIT.dripbot.agentWallet.solana;
/** Jupiter addresses native SOL by its wrapped mint; Fluid's own
 *  Solana swap space names it by the System Program id
 *  (SOLANA_SWAP_NATIVE_TOKEN). */
export const JUPITER_WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

/** Map a swap-space Solana token address to the mint Jupiter
 *  quotes: native SOL (the System Program id, or an absent
 *  address) is the wrapped-SOL mint; any other valid Solana
 *  address is itself a mint. Null for anything else. */
export function jupiterMintOf(tokenAddress) {
  if (tokenAddress == null || String(tokenAddress) === SOLANA_SWAP_NATIVE_TOKEN) return JUPITER_WRAPPED_SOL_MINT;
  const a = String(tokenAddress);
  return isValidSolanaAddress(a) ? a : null;
}
/** Whether Jupiter serves this pair: Solana → Solana only, both
 *  sides resolvable to distinct mints, and the recipient is the
 *  sender (Jupiter's /build pays the taker's own accounts — a
 *  third-party destination is a LI.FI lane, never a silent reroute
 *  of the proceeds). Pure. */
export function jupiterSupportsPair(args) {
  if (args?.fromChainKey !== "solana" || args?.toChainKey !== "solana") return false;
  const inMint = jupiterMintOf(args.fromTokenAddress), outMint = jupiterMintOf(args.toTokenAddress);
  if (!inMint || !outMint || inMint === outMint) return false;
  if (args.toAddress && args.fromAddress && args.toAddress !== args.fromAddress) return false;
  return true;
}
/** Build the GET /swap/v2/build query. Pure and exported so tests
 *  can pin exactly what reaches Jupiter: the platform fee fields
 *  ride ONLY when a fee is actually being charged (feeBps > 0 AND
 *  a fee account — pass 2 of the two-pass search; see
 *  getJupiterSwapRoute), never decoratively. Slippage is left to
 *  Jupiter's own defaulting (50 bps on the probed lanes, echoed in
 *  the response and enforced via otherAmountThreshold). */
export function buildJupiterBuildParams({ fromTokenAddress, toTokenAddress, fromAmount, fromAddress }, { feeBps = 0, feeAccount = null } = {}) {
  const q = new URLSearchParams({
    inputMint: jupiterMintOf(fromTokenAddress),
    outputMint: jupiterMintOf(toTokenAddress),
    amount: String(fromAmount),
    taker: fromAddress,
  });
  if (Number(feeBps) > 0 && feeAccount) {
    q.set("platformFeeBps", String(Math.floor(Number(feeBps))));
    q.set("feeAccount", String(feeAccount));
  }
  return q;
}
/** USD prices (+ decimals) for Solana mints from Jupiter's Price
 *  V3 — the router's own price source, read from the same keyless
 *  lite host. Returns a Map(mint → { usdPrice, decimals }); a mint
 *  Jupiter doesn't price is simply absent. Throws on transport
 *  failure — a route Fluid cannot price cannot be fee-law'd, so
 *  the dispatcher falls back to LI.FI (whose quotes carry USD). */
async function fetchJupiterPrices(mints) {
  const ids = [...new Set(mints.filter(Boolean))];
  const res = await fetch(`${JUPITER_API}/price/v3?ids=${ids.join(",")}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Jupiter price lookup failed: HTTP " + res.status);
  const out = new Map();
  for (const m of ids) {
    const p = data?.[m];
    const usd = Number(p?.usdPrice);
    if (Number.isFinite(usd) && usd > 0)
      out.set(m, { usdPrice: usd, decimals: Number.isFinite(Number(p?.decimals)) ? Number(p.decimals) : null });
  }
  return out;
}
// Session cache of PROVEN fee-ATA existence, per mint (an ATA,
// once created, does not un-exist; a negative is never cached —
// the operator may create the account mid-session).
const jupiterFeeAtaCache = new Map();
export function resetJupiterCaches() { jupiterFeeAtaCache.clear(); }
/** The fee account for a Jupiter swap paying `outputMint`: the
 *  collection wallet's ATA for that mint, derived locally under
 *  the mint's OWN token program (read from the mint account — a
 *  Token-2022 mint's ATA differs from a legacy one). Resolves
 *  { feeAccount, tokenProgram, feeSkipped: null } when the ATA
 *  verifiably exists on-chain; otherwise feeAccount is null and
 *  feeSkipped says why — "ata-missing" (the account is not there)
 *  or "ata-unverified" (its state could not be read). Either way
 *  the swap quotes fee-free rather than attaching a fee that
 *  would fail or vanish. Exported for tests. */
export async function jupiterFeeAccountFor(outputMint) {
  const hit = jupiterFeeAtaCache.get(outputMint);
  if (hit) return hit;
  let tokenProgram = null;
  try {
    const info = await solanaRpc("getAccountInfo", [outputMint, { encoding: "base64" }]);
    const owner = info?.value?.owner;
    if (owner === SOLANA_PROGRAMS.token || owner === SOLANA_PROGRAMS.token2022) tokenProgram = owner;
  } catch { /* unverifiable below */ }
  if (!tokenProgram) return { feeAccount: null, tokenProgram: null, feeSkipped: "ata-unverified" };
  const feeAccount = solanaAtaAddress(JUPITER_FEE_WALLET, outputMint, tokenProgram);
  let exists = false;
  try {
    const info = await solanaRpc("getAccountInfo", [feeAccount, { encoding: "base64" }]);
    exists = !!(info && info.value);
  } catch { return { feeAccount: null, tokenProgram, feeSkipped: "ata-unverified" }; }
  if (!exists) return { feeAccount: null, tokenProgram, feeSkipped: "ata-missing" };
  const okState = { feeAccount, tokenProgram, feeSkipped: null };
  jupiterFeeAtaCache.set(outputMint, okState);
  return okState;
}
/** Route-plan flow conservation for a /build quote: the legs'
 *  amounts must account for the whole swap — the input mint's net
 *  consumption is exactly inAmount, every intermediate mint
 *  produces exactly what it consumes, and the output mint's net
 *  production (grossOut) minus the response's outAmount is the
 *  platform fee the route actually charges. Parallel split legs
 *  (percent < 100, same in/out mints) and sequential multi-hop
 *  legs both satisfy conservation; a leg that invents or drops
 *  value breaks it. Returns { grossOut, feeRaw } (BigInts) or
 *  null when the plan does not conserve. */
function jupiterRouteFlows(quote) {
  const legs = quote?.routePlan;
  if (!Array.isArray(legs) || !legs.length) return null;
  const produced = new Map(), consumed = new Map();
  for (const leg of legs) {
    const s = leg?.swapInfo;
    if (!s || !s.inputMint || !s.outputMint || s.inAmount == null || s.outAmount == null) return null;
    let inV, outV;
    try { inV = BigInt(s.inAmount); outV = BigInt(s.outAmount); } catch { return null; }
    if (inV <= 0n || outV <= 0n) return null;
    consumed.set(s.inputMint, (consumed.get(s.inputMint) || 0n) + inV);
    produced.set(s.outputMint, (produced.get(s.outputMint) || 0n) + outV);
  }
  let inAmt, outAmt;
  try { inAmt = BigInt(quote.inAmount); outAmt = BigInt(quote.outAmount); } catch { return null; }
  const netIn = (consumed.get(quote.inputMint) || 0n) - (produced.get(quote.inputMint) || 0n);
  if (netIn !== inAmt) return null;
  const grossOut = (produced.get(quote.outputMint) || 0n) - (consumed.get(quote.outputMint) || 0n);
  if (grossOut <= 0n) return null;
  for (const m of new Set([...produced.keys(), ...consumed.keys()])) {
    if (m === quote.inputMint || m === quote.outputMint) continue;
    if ((produced.get(m) || 0n) !== (consumed.get(m) || 0n)) return null;
  }
  const feeRaw = grossOut - outAmt;
  if (feeRaw < 0n) return null;
  return { grossOut, feeRaw };
}
/** The network cost of a /build response in lamports: the 5,000-
 *  lamport base fee for the user's one signature plus the priority
 *  fee its compute-budget instructions declare (unit price × unit
 *  limit). Read from the response itself; an absent compute-budget
 *  section prices as the plain base fee. */
function jupiterNetworkLamports(computeBudgetInstructions) {
  let lamports = 5000n, limit = 0n, price = 0n;
  const u32le = (b, o) => BigInt(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));
  const u64le = (b, o) => { let v = 0n; for (let i = 0; i < 8; i++) v |= BigInt(b[o + i]) << BigInt(8 * i); return v; };
  for (const ix of computeBudgetInstructions || []) {
    if (ix?.programId !== JUPITER_COMPUTE_BUDGET_PROGRAM || typeof ix.data !== "string") continue;
    let bytes;
    try { bytes = base64.decode(ix.data); } catch { continue; }
    if (bytes.length >= 5 && bytes[0] === 2) limit = u32le(bytes, 1);
    else if (bytes.length >= 9 && bytes[0] === 3) price = u64le(bytes, 1);
  }
  if (limit > 0n && price > 0n) lamports += (price * limit) / 1000000n;
  return lamports;
}
function jupiterSymbolOf(mint) {
  if (mint === JUPITER_WRAPPED_SOL_MINT) return "SOL";
  return (SOLANA_TOKENS.find(t => t.address === mint) || {}).symbol || null;
}
function jupiterDecimalsOf(mint, priceEntry) {
  if (priceEntry && Number.isFinite(priceEntry.decimals)) return priceEntry.decimals;
  if (mint === JUPITER_WRAPPED_SOL_MINT) return 9;
  const t = SOLANA_TOKENS.find(x => x.address === mint);
  return t ? t.decimals : null;
}
/** Parse a /build response into Fluid's route shape (the fields
 *  rankSwapRoutes and the swap sheet consume), keeping the raw
 *  instruction groups on route.jupiter for execution. Pure;
 *  returns null when the response disagrees with the request it
 *  answers (mints, amount, taker), is not ExactIn, fails route-
 *  plan flow conservation, charges a fee different from the one
 *  requested (ctx.feeBps — derived from the response's own gross
 *  vs net output, required to equal floor(gross × bps / 10000)
 *  EXACTLY), is unpriceable in USD, or fails the instruction
 *  bounds check — a quote Fluid cannot verify never reaches the
 *  signer (the dispatcher falls back to LI.FI).
 *
 *  PRICING: fromAmountUSD / toAmountUSD come from Jupiter's own
 *  Price V3 (ctx.prices, fetched once per search and shared by
 *  both passes). The route's own cost follows the model's one
 *  definition (routeCostUsd): the larger of the explicit network
 *  cost (base + priority fee declared by the compute-budget
 *  instructions, priced in SOL) and the all-in shortfall measured
 *  against the GROSS output — so Fluid's fee, deducted inside the
 *  fee-bearing pass's net output, never inflates the route cost
 *  it is marked up from. */
export function parseJupiterBuild(data, args, ctx = {}) {
  const prices = ctx.prices instanceof Map ? ctx.prices : new Map();
  const feeBps = Math.max(0, Math.floor(Number(ctx.feeBps) || 0));
  const inMint = jupiterMintOf(args?.fromTokenAddress), outMint = jupiterMintOf(args?.toTokenAddress);
  if (!inMint || !outMint || !data || typeof data !== "object") return null;
  if (data.inputMint !== inMint || data.outputMint !== outMint) return null;
  if (data.swapMode !== "ExactIn") return null;
  if (String(data.inAmount) !== String(args.fromAmount)) return null;
  if (!data.swapInstruction || typeof data.swapInstruction !== "object") return null;
  const inPrice = prices.get(inMint), outPrice = prices.get(outMint);
  if (!inPrice || !outPrice) return null;
  const inDec = jupiterDecimalsOf(inMint, inPrice), outDec = jupiterDecimalsOf(outMint, outPrice);
  if (inDec == null || outDec == null) return null;
  const flows = jupiterRouteFlows(data);
  if (!flows) return null;
  const expectedFee = feeBps > 0 ? (flows.grossOut * BigInt(feeBps)) / 10000n : 0n;
  if (flows.feeRaw !== expectedFee) return null;
  if (feeBps > 0 && !ctx.feeAccount) return null;
  let outAmt, threshold;
  try { outAmt = BigInt(data.outAmount); threshold = BigInt(data.otherAmountThreshold); } catch { return null; }
  if (outAmt <= 0n || threshold <= 0n || outAmt < threshold) return null;
  const solPrice = prices.get(JUPITER_WRAPPED_SOL_MINT)?.usdPrice || 0;
  const gasCostUSD = solPrice > 0 ? (Number(jupiterNetworkLamports(data.computeBudgetInstructions)) / 1e9) * solPrice : 0;
  const fromAmountUSD = (Number(BigInt(data.inAmount)) / 10 ** inDec) * inPrice.usdPrice;
  const grossOutUSD = (Number(flows.grossOut) / 10 ** outDec) * outPrice.usdPrice;
  const toAmountUSD = (Number(outAmt) / 10 ** outDec) * outPrice.usdPrice;
  const routeFeeUsd = routeCostUsd(gasCostUSD, fromAmountUSD - grossOutUSD);
  const platformFeeUsd = flows.feeRaw > 0n ? (Number(flows.feeRaw) / 10 ** outDec) * outPrice.usdPrice : 0;
  const bh = data.blockhashWithMetadata?.blockhash;
  const blockhash = typeof bh === "string" ? bh
    : (Array.isArray(bh) && bh.length === 32 ? base58.encode(Uint8Array.from(bh)) : null);
  const route = {
    provider: "jupiter",
    id: "jupiter:" + (blockhash ? blockhash.slice(0, 16) : String(data.inAmount)),
    type: "jupiter",
    fromChainId: SOLANA_LIFI_CHAIN_ID, toChainId: SOLANA_LIFI_CHAIN_ID,
    fromAmount: String(data.inAmount),
    fromToken: { address: args.fromTokenAddress, symbol: jupiterSymbolOf(inMint), name: null, decimals: inDec, chainId: SOLANA_LIFI_CHAIN_ID },
    toToken: { address: args.toTokenAddress, symbol: jupiterSymbolOf(outMint), name: null, decimals: outDec, chainId: SOLANA_LIFI_CHAIN_ID },
    toAmount: String(data.outAmount),
    toAmountMin: String(data.otherAmountThreshold),
    toAmountUSD, fromAmountUSD,
    gasCostUSD,
    routeFeeUsd,
    executionDuration: null,
    platformFeeRaw: flows.feeRaw.toString(),
    platformFeeUsd,
    platformFeeCollecting: flows.feeRaw > 0n,
    steps: [],
    jupiter: {
      inputMint: inMint, outputMint: outMint, taker: args.fromAddress,
      feeBps, feeAccount: feeBps > 0 ? String(ctx.feeAccount) : null,
      feeTokenProgram: feeBps > 0 ? (ctx.feeTokenProgram || null) : null,
      feeSkipped: ctx.feeSkipped || null,
      grossOut: flows.grossOut.toString(),
      quote: {
        inAmount: String(data.inAmount), outAmount: String(data.outAmount),
        otherAmountThreshold: String(data.otherAmountThreshold),
        slippageBps: data.slippageBps ?? null, priceImpactPct: data.priceImpactPct ?? null,
        routePlan: data.routePlan,
      },
      instructions: {
        computeBudgetInstructions: data.computeBudgetInstructions || [],
        setupInstructions: data.setupInstructions || [],
        swapInstruction: data.swapInstruction,
        cleanupInstruction: data.cleanupInstruction || null,
        otherInstructions: data.otherInstructions || [],
        tipInstruction: data.tipInstruction || null,
      },
      addressesByLookupTableAddress: data.addressesByLookupTableAddress || {},
      blockhash,
      lastValidBlockHeight: data.blockhashWithMetadata?.lastValidBlockHeight ?? null,
    },
  };
  if (!checkJupiterSwapBounds(route, args.fromAddress).ok) return null;
  return route;
}
/** Bounds-check a Jupiter route BEFORE anything is signed (the
 *  Solana twin of checkAcrossDepositBounds / checkRelayStepBounds).
 *  /build's decomposition is what makes this strong: Fluid pins
 *  every instruction the assembled transaction may carry —
 *   - programs: the Jupiter Aggregator (the swap instruction
 *     itself, exactly one), ComputeBudget, System, the two token
 *     programs and the ATA program — anything else refuses;
 *   - no tip instruction (a tip is a payment to a stranger);
 *   - every signer account across all instructions is the user;
 *   - System instructions: only a Transfer from the user into the
 *     user's OWN wrapped-SOL ATA, for at most the swap's input —
 *     the native-SOL wrap leg, nothing else;
 *   - token-program instructions: only SyncNative (17) and
 *     CloseAccount (9), only on the user's own wrapped-SOL ATA,
 *     the close paying the user — the wrap/unwrap bookends. Any
 *     top-level transfer / approve / burn (the shapes
 *     assertSolanaStepSafe refuses for LI.FI payloads) refuses;
 *   - ATA instructions: create / createIdempotent only, the new
 *     account recomputed locally from (owner, mint, token
 *     program), and the owner is the user — a swap never pays rent
 *     to open accounts for anyone else;
 *   - the swap instruction names the user as signer and touches
 *     the user's own input and output accounts; when a fee is
 *     charged, the fee account is present AND is exactly the
 *     collection wallet's ATA for the output mint (recomputed);
 *   - quote integrity: amounts and the minimum-received threshold
 *     agree with the route, and the fee derived from the route
 *     plan's gross vs net output equals floor(gross × bps /
 *     10000) for the bps the quote was requested with.
 *  The Jupiter swap instruction's own calldata stays opaque (it
 *  encodes the route) — the containment above is what decides
 *  where funds can move: into the aggregator, out to the user's
 *  own accounts and the pinned fee account, nowhere else. */
export function checkJupiterSwapBounds(route, owner) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this route: " + m + " Pick another route." });
  if (route?.provider !== "jupiter") return refuse("this is not a Jupiter route.");
  const j = route.jupiter;
  if (!j || !j.quote || !j.instructions || !j.instructions.swapInstruction) return refuse("the Jupiter route carried no swap instruction to inspect.");
  if (!owner || j.taker !== owner) return refuse("the Jupiter quote was built for a different account than yours.");
  if (String(j.quote.inAmount) !== String(route.fromAmount)) return refuse("the Jupiter quote's input disagrees with the swap.");
  if (String(j.quote.outAmount) !== String(route.toAmount)) return refuse("the Jupiter quote's output disagrees with the route.");
  if (String(j.quote.otherAmountThreshold) !== String(route.toAmountMin)) return refuse("the Jupiter quote's minimum disagrees with the route.");
  const flows = jupiterRouteFlows({ inputMint: j.inputMint, outputMint: j.outputMint, inAmount: j.quote.inAmount, outAmount: j.quote.outAmount, routePlan: j.quote.routePlan });
  if (!flows) return refuse("the Jupiter route plan does not account for the swap's amounts.");
  if (flows.grossOut.toString() !== String(j.grossOut)) return refuse("the Jupiter route's gross output disagrees with its route plan.");
  let feeRawRoute;
  try { feeRawRoute = BigInt(route.platformFeeRaw ?? "0"); } catch { return refuse("the Jupiter route carried an unreadable fee."); }
  const expectedFee = j.feeBps > 0 ? (flows.grossOut * BigInt(j.feeBps)) / 10000n : 0n;
  if (flows.feeRaw !== expectedFee || feeRawRoute !== flows.feeRaw) return refuse("the fee in the Jupiter quote is not the fee that was requested.");
  let outAmt, threshold, inAmt;
  try { outAmt = BigInt(j.quote.outAmount); threshold = BigInt(j.quote.otherAmountThreshold); inAmt = BigInt(j.quote.inAmount); } catch { return refuse("the Jupiter quote carried unreadable amounts."); }
  if (outAmt <= 0n || threshold <= 0n || outAmt < threshold) return refuse("the Jupiter quote guarantees less than its own minimum received.");
  if (j.instructions.tipInstruction) return refuse("the Jupiter response carried a tip instruction Fluid never pays.");
  const userWsolAta = solanaAtaAddress(owner, JUPITER_WRAPPED_SOL_MINT, SOLANA_PROGRAMS.token);
  const decodeIx = (ix) => {
    if (!ix || typeof ix.programId !== "string" || !Array.isArray(ix.accounts) || typeof ix.data !== "string") return null;
    let data;
    try { data = base64.decode(ix.data); } catch { return null; }
    for (const a of ix.accounts) if (!a || typeof a.pubkey !== "string") return null;
    return data;
  };
  const checkIx = (ix, isSwap) => {
    const data = decodeIx(ix);
    if (!data) return refuse("a Jupiter instruction was not in the decomposed shape Fluid inspects.");
    for (const a of ix.accounts) if (a.isSigner && a.pubkey !== owner) return refuse("a Jupiter instruction named a signer that is not you.");
    switch (ix.programId) {
      case JUPITER_AGGREGATOR_PROGRAM:
        if (!isSwap) return refuse("a second Jupiter-program instruction rode along with the swap.");
        return { ok: true };
      case JUPITER_COMPUTE_BUDGET_PROGRAM:
        if (ix.accounts.length) return refuse("a compute-budget instruction named accounts it should not have.");
        return { ok: true };
      case SOL_SYSTEM_PROGRAM: {
        if (data.length < 12 || (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) !== 2)
          return refuse("a System instruction in the Jupiter build was not the wrapped-SOL wrap transfer.");
        const from = ix.accounts[0]?.pubkey, to = ix.accounts[1]?.pubkey;
        let amount = 0n;
        for (let i = 0; i < 8; i++) amount |= BigInt(data[4 + i]) << BigInt(8 * i);
        if (from !== owner || to !== userWsolAta)
          return refuse("a System transfer in the Jupiter build did not go from you to your own wrapped-SOL account.");
        if (j.inputMint !== JUPITER_WRAPPED_SOL_MINT || amount <= 0n || amount > inAmt)
          return refuse("the wrapped-SOL wrap transfer did not match the swap's input.");
        return { ok: true };
      }
      case SOLANA_PROGRAMS.token: {
        const op = data.length >= 1 ? data[0] : -1;
        if (op === 17) { // SyncNative — the wrap bookend
          if (ix.accounts.length !== 1 || ix.accounts[0].pubkey !== userWsolAta)
            return refuse("a SyncNative instruction did not target your own wrapped-SOL account.");
          return { ok: true };
        }
        if (op === 9) { // CloseAccount — the unwrap bookend, paying the user
          if (ix.accounts.length !== 3 || ix.accounts[0].pubkey !== userWsolAta
            || ix.accounts[1].pubkey !== owner || ix.accounts[2].pubkey !== owner)
            return refuse("a CloseAccount instruction did not close your own wrapped-SOL account back to you.");
          return { ok: true };
        }
        return refuse("a token instruction in the Jupiter build was not one Fluid has pinned (sync/close of your own wrapped-SOL account).");
      }
      case SOLANA_PROGRAMS.ata: {
        if (data.length !== 1 || (data[0] !== 0 && data[0] !== 1))
          return refuse("an ATA instruction in the Jupiter build was not a plain account creation.");
        const k = ix.accounts;
        if (k.length !== 6) return refuse("an ATA creation named an unexpected account set.");
        if (k[0].pubkey !== owner || !k[0].isSigner) return refuse("an ATA creation was not funded by you.");
        if (k[2].pubkey !== owner) return refuse("the Jupiter build tried to open a token account for someone else.");
        if (k[4].pubkey !== SOL_SYSTEM_PROGRAM) return refuse("an ATA creation named an unexpected system program.");
        if (k[5].pubkey !== SOLANA_PROGRAMS.token && k[5].pubkey !== SOLANA_PROGRAMS.token2022)
          return refuse("an ATA creation named an unexpected token program.");
        if (solanaAtaAddress(k[2].pubkey, k[3].pubkey, k[5].pubkey) !== k[1].pubkey)
          return refuse("an ATA creation's account did not match its owner, mint and token program.");
        return { ok: true };
      }
      default:
        return refuse("an instruction targeted a program Fluid has not pinned for Jupiter swaps: " + ix.programId + ".");
    }
  };
  const groups = [
    ...(j.instructions.computeBudgetInstructions || []),
    ...(j.instructions.setupInstructions || []),
    ...(j.instructions.otherInstructions || []),
    ...(j.instructions.cleanupInstruction ? [j.instructions.cleanupInstruction] : []),
  ];
  for (const ix of groups) { const r = checkIx(ix, false); if (!r.ok) return r; }
  const swapCheck = checkIx(j.instructions.swapInstruction, true);
  if (!swapCheck.ok) return swapCheck;
  const swap = j.instructions.swapInstruction;
  if (!swap.accounts.some(a => a.pubkey === owner && a.isSigner)) return refuse("the Jupiter swap instruction does not name you as its signer.");
  const swapKeys = new Set(swap.accounts.map(a => a.pubkey));
  const ataCandidates = (mint) => [solanaAtaAddress(owner, mint, SOLANA_PROGRAMS.token), solanaAtaAddress(owner, mint, SOLANA_PROGRAMS.token2022)];
  if (!ataCandidates(j.inputMint).some(a => swapKeys.has(a))) return refuse("the Jupiter swap instruction does not draw from your input account.");
  if (!ataCandidates(j.outputMint).some(a => swapKeys.has(a))) return refuse("the Jupiter swap instruction does not pay your output account.");
  if (j.feeBps > 0) {
    if (!j.feeAccount || !swapKeys.has(j.feeAccount)) return refuse("the charged fee does not land in the quoted fee account.");
    if (!j.feeTokenProgram || j.feeAccount !== solanaAtaAddress(JUPITER_FEE_WALLET, j.outputMint, j.feeTokenProgram))
      return refuse("the fee account is not the collection wallet's account for the output token.");
  } else if (j.feeAccount) return refuse("a fee account rode on a fee-free quote.");
  return { ok: true };
}
/** One /build call, parsed and bounds-checked. Throws on any
 *  failure (HTTP error — including the keyless bucket's 429 — an
 *  unusable response, or a refused instruction set) —
 *  getSwapRoutes catches and falls back. */
async function fetchJupiterRoute(args, prices, opts = {}) {
  const q = buildJupiterBuildParams(args, opts);
  const res = await fetch(`${JUPITER_API}/swap/v2/build?${q.toString()}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Jupiter route search failed: " + (data.error || data.message || ("HTTP " + res.status)));
  const route = parseJupiterBuild(data, args, { prices, feeBps: opts.feeBps || 0, feeAccount: opts.feeAccount || null, feeTokenProgram: opts.feeTokenProgram || null, feeSkipped: opts.feeSkipped || null });
  if (!route) throw new Error("Jupiter returned no usable route for that pair.");
  return route;
}
/** Jupiter's route for a Solana same-chain swap, priced under the
 *  fee law — the same TWO-PASS discipline as the other routers:
 *  pass 1 builds with NO platform fee and reads the route's own
 *  cost (routeFeeUsd — the larger of the declared network cost and
 *  the all-in shortfall against the gross output) and the input's
 *  USD value; platformFeeBpsForRoute turns those into the bps to
 *  charge (the Solana row: 5× markup, 0.5% cap, $0.30 total-cost
 *  ceiling); pass 2 re-builds with exactly that bps and the fee
 *  account, and the EXECUTED route is pass 2's, annotated with
 *  the charged bps (route.platformFeeBps) — the disclosed fee is
 *  pass 2's own derived figure (route.platformFeeUsd), never pass
 *  1's arithmetic. If the law prices the fee at 0 bps, pass 1's
 *  quote already carries no fee and is executed as quoted. If the
 *  fee ATA does not verifiably exist, pass 1's quote is likewise
 *  returned fee-free with the reason recorded on the route
 *  (route.jupiter.feeSkipped) — never a fee attached to an account
 *  that isn't there. A failed pass 2 throws (the Relay posture):
 *  the dispatcher falls back to LI.FI rather than silently
 *  dropping the fee. Prices are fetched ONCE per search and
 *  shared by both passes. */
export async function getJupiterSwapRoute(args) {
  if (!jupiterSupportsPair(args)) return null;
  const inMint = jupiterMintOf(args.fromTokenAddress), outMint = jupiterMintOf(args.toTokenAddress);
  const prices = await fetchJupiterPrices([inMint, outMint, JUPITER_WRAPPED_SOL_MINT]);
  if (!prices.has(inMint) || !prices.has(outMint)) throw new Error("Jupiter could not price that pair in USD.");
  if (!PLATFORM_FEE_COLLECTION_ENABLED) return fetchJupiterRoute(args, prices);
  const first = await fetchJupiterRoute(args, prices);
  const bps = platformFeeBpsForRoute(first.routeFeeUsd, first.fromAmountUSD, args.toChainKey);
  if (bps <= 0) {
    first.platformFeeBps = 0;
    return first;
  }
  const feeState = await jupiterFeeAccountFor(outMint);
  if (!feeState.feeAccount) {
    first.platformFeeBps = 0;
    first.jupiter.feeSkipped = feeState.feeSkipped;
    return first;
  }
  const final = await fetchJupiterRoute(args, prices, { feeBps: bps, feeAccount: feeState.feeAccount, feeTokenProgram: feeState.tokenProgram });
  final.platformFeeBps = bps;
  return final;
}
function jupiterInstructionToWeb3(ix) {
  return new SolTxInstruction({
    programId: new SolPublicKey(ix.programId),
    keys: (ix.accounts || []).map(a => ({ pubkey: new SolPublicKey(a.pubkey), isSigner: !!a.isSigner, isWritable: !!a.isWritable })),
    data: Buffer.from(base64.decode(ix.data || "")),
  });
}
/** Execute a Jupiter route: re-run the full bounds check on the
 *  exact instruction set, assemble the v0 transaction from the
 *  decomposed instructions + lookup tables with Fluid's own code,
 *  sign with the wallet's Solana key and broadcast through
 *  Fluid's own RPC path — no Jupiter landing service, no
 *  sponsored or co-signed shapes. The blockhash is refreshed at
 *  signing time (the quote's may have aged while the user read
 *  the review); the instructions themselves are blockhash-free,
 *  so the bounds-checked set is exactly what gets signed. */
export async function executeJupiterSwapRoute(phrase, route, onProgress = () => {}) {
  const gate = swapRouteExecutable(route);
  if (!gate.ok || !gate.jupiter) throw new Error(gate.reason || "That route does not start on Solana.");
  const kp = solanaKeypair(phrase);
  const myAddr = kp.publicKey.toBase58();
  if (route.jupiter.taker !== myAddr) throw new Error("That Jupiter route was built for a different account — refusing to sign it.");
  const bounds = checkJupiterSwapBounds(route, myAddr);
  if (!bounds.ok) throw new Error(bounds.reason);
  onProgress("Signing the Jupiter swap…");
  const j = route.jupiter;
  const rawIxs = [
    ...(j.instructions.computeBudgetInstructions || []),
    ...(j.instructions.setupInstructions || []),
    j.instructions.swapInstruction,
    ...(j.instructions.cleanupInstruction ? [j.instructions.cleanupInstruction] : []),
    ...(j.instructions.otherInstructions || []),
  ];
  const instructions = rawIxs.map(jupiterInstructionToWeb3);
  const lutAccounts = Object.entries(j.addressesByLookupTableAddress || {}).map(([lut, addresses]) => new SolAddressLookupTableAccount({
    key: new SolPublicKey(lut),
    state: {
      deactivationSlot: (2n ** 64n) - 1n, // the on-chain sentinel for "not deactivated"
      lastExtendedSlot: 0,
      lastExtendedSlotStartIndex: 0,
      addresses: (addresses || []).map(a => new SolPublicKey(a)),
    },
  }));
  let blockhash = j.blockhash;
  try {
    const latest = await solanaRpc("getLatestBlockhash", [{ commitment: "processed" }]);
    if (latest?.value?.blockhash) blockhash = latest.value.blockhash;
  } catch { /* the quote's own blockhash stands */ }
  if (!blockhash) throw new Error("No blockhash available for that swap — please try again.");
  const message = new SolTransactionMessage({ payerKey: kp.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message(lutAccounts);
  const jtx = new SolVersionedTransaction(message);
  jtx.sign([kp]);
  const sig = await solanaBroadcast(jtx.serialize(), "That swap");
  onProgress("Solana swap sent ✓");
  return [sig];
}

// ---------- Mayan (RANKED candidate: Swift + Fast MCTP) ----------
// Verdict 2026-11-09 (research_notes/fluid-mayan-research-20261109/,
// live shoot-out): Mayan's Swift intent auctions beat LI.FI on
// Solana-source exits (USDC Solana→Arbitrum route cost $0.066 vs
// ~$0.209 at $100 — Solana's problem was never the entry, it is
// the exit) and beat Relay on covered EVM↔EVM any-asset pairs
// (fully-live all-in $0.010–0.037 vs $0.066–0.335). EVM→Solana is
// a TIE (~$0.21 route cost on both stacks), and the owner's rule
// is INTEGRATE ONLY IF CHEAPER — so Mayan joins the dispatcher
// as a RANKED CANDIDATE, never a hard-wired priority: for every
// eligible pair its live quote competes in rankSwapRoutes against
// the incumbent cascade's answer, and the Mayan route is only
// offered when it ranks first (see getSwapRoutes). The rule is
// therefore enforced continuously at runtime, not just in the
// study. Slow MCTP is excluded (never cheapest at Fluid sizes —
// a ~$1 fixed relayer cost — and it collects NO referrer fee on
// plain USDC→USDC); gasless mode is excluded (off-chain signed
// orders — refused by Fluid's doctrine, and the standard path
// never needs it); the deposit-address mode is excluded (funding
// by plain transfer to a derived address is not a wallet-signed
// swap). Route types in scope: SWIFT and FAST_MCTP only.
//
// CONSTRUCTION (no new dependency): quotes are plain REST
// (POST price-api.mayan.finance/v3/quote, keyless, CORS *), but
// execution payloads are normally built by Mayan's TypeScript
// SDK. Per the Satora precedent, the SDK's public source was
// used as the SPEC and the construction re-implemented here:
// EVM sources call the pinned Mayan Forwarder with the Swift /
// Fast-MCTP contract calldata composed field by field; Solana
// sources assemble the instruction set locally against pinned
// program ids (state/ledger PDAs, order-hash and ledger layouts
// ported byte for byte). The one server-built piece is the
// Solana SOURCE-SWAP leg (a Jupiter swap into the order's state
// / ledger account, from Mayan's get-swap endpoint): Fluid pins
// its aggregator to the Jupiter program it already trusts,
// decodes its V6 amount arguments, and containment-checks every
// account — a Titan/DFlow-shaped answer is refused, never
// signed. Sui sources are OUT of v1: Mayan does quote them
// (probe 2026-11-09: SUI→USDC(Base) answered by Fast MCTP), but
// the construction is a separate Move-call port that resolves
// package ids and coin objects through a live Sui client —
// Fluid's Sui stack signs inspected prebuilt payloads and has
// no locally-built Move composer, so the shape is not locally
// assembled + bounds-checkable today; the ranked design admits
// it later without dispatcher changes.
//
// FEE (no pay, no route — passes): the quote takes `referrer`
// (a Solana address as the fee identity — always the DripBot
// collection wallet's Solana address) + `referrerBps` (the fee
// law's integer bps; the law's 50 bps cap sits far inside the
// route caps, Swift ≤200 / Fast MCTP ≤100). The fee LANDS with
// the family's collection wallet of the chain that PAYS it,
// resolved exactly as Mayan's own dispatcher resolves it: Swift
// pays in the locked source asset on the SOURCE chain (Solana
// source → the referrer's Solana token account at unlock; EVM
// source → Mayan's fee-manager contract, which auto-pays the
// EVM collection wallet), Fast MCTP pays in the minted USDC on
// the DESTINATION chain. ONE referrer per route (the collection
// wallet of the paying family) — the 60/40 split is NOT
// expressed natively: the quote-level referrer identity is a
// single Solana address and the treasury leg's addresses are
// deliberately never hard-coded in this app (they resolve
// through the Fluid Names registry in the settlement keeper),
// so the split settles under the existing $2 rule, exactly as
// on Relay lanes. The disclosed fee is read ONLY from the final
// quote's own referrerFeeUsd.
//
// REFUND TRUTH (carried into the review sentence): a Swift /
// Fast-MCTP ORDER nobody fills is refundable by the user on the
// SOURCE chain after its deadline — and if the input was first
// converted into the order's locked asset (e.g. SOL → USDC),
// the refund returns the CONVERTED asset, not the token sent.
// A Fast-MCTP BRIDGE (no auction) has no order to refund: if
// the destination swap leg cannot execute, the user is left
// holding the minted destination USDC, not nothing.
const MAYAN_PRICE_API = "https://price-api.mayan.finance/v3";
const MAYAN_EXPLORER_API = "https://explorer-api.mayan.finance/v3";
/** The Price API requires an sdkVersion parameter (a version
 *  string, not a credential) and rejects older ones — pinned to
 *  the SDK release whose construction this port follows. */
export const MAYAN_SDK_VERSION = "15_3_0";
const MAYAN_SOLANA_PROGRAM = "FC4eXxkyrMPTjiYUpp4EAnkmwMbQyZ6NDCh1kfLn6vsf";
/** The Mayan Forwarder — the single EVM entry point (same
 *  address on every EVM chain). ERC-20 approvals name it, for
 *  exactly the swap amount, and every Mayan EVM transaction
 *  targets it. */
export const MAYAN_FORWARDER = "0x337685fdaB40D39bd02028545a4FfA7D287cC3E2";
/** Solana program pins (from the SDK's published addresses and
 *  the live quote probes). */
export const MAYAN_SWIFT_V2_PROGRAM = "mayan34VedncxdK2XobtvWFDXQASUTBXhUVzt2kKgny";
export const MAYAN_FAST_MCTP_PROGRAM = "Gx9rivpS3YR8pBFwMuP6omYqVxunpLvLkNn7ubNyuZZ5";
export const MAYAN_FEE_MANAGER_PROGRAM = "5VtQHnhs2pfVEr68qQsbTRwKh4JV5GTu9mBHgHFxpHeQ";
export const MAYAN_CPI_PROXY_PROGRAM = "D8C8iW6zmoKg5TRr8nQ7h14TMWqQX8FiBdj2ju5MF3wa";
export const MAYAN_LOOKUP_TABLE = "Ff3yi1meWQQ19VPZMzGg6H8JQQeRudiV7QtVtyzJyoht";
const MAYAN_CCTP_V2_CORE_PROGRAM = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";
const MAYAN_CCTP_V2_TOKEN_PROGRAM = "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe";
const MAYAN_SYSVAR_RENT = "SysvarRent111111111111111111111111111111111";
/** Referrer fee caps by route type (bps) — the fee law's cap
 *  (50) never approaches them; asserted anyway so a future law
 *  change can never attach an uncollectable rate. */
export const MAYAN_REFERRER_CAPS_BPS = { SWIFT: 200, FAST_MCTP: 100 };
/** The quote-level fee identity: always a Solana address (the
 *  DripBot collection wallet's), whatever the source chain. */
export const MAYAN_REFERRER_SOLANA = FEE_SPLIT.dripbot.agentWallet.solana;
/** Where the fee lands when an EVM chain pays it (Swift from an
 *  EVM source via the fee-manager contract; Fast MCTP into an
 *  EVM destination in minted USDC): the DripBot collection
 *  wallet's EVM address — the same pot Relay/Across pay. */
export const MAYAN_REFERRER_EVM = FEE_SPLIT.dripbot.agentWallet.evm;
export const MAYAN_SWAPS_STORAGE_KEY = "fluid_mayan_swaps_v1";
/** Fluid chain key → Mayan chain name, for the chains Mayan's
 *  catalog covers: 8 of Fluid's EVM networks plus Solana. Sui is
 *  in Mayan's catalog but out of v1 scope (see the header). */
const MAYAN_CHAIN_NAME_BY_ID = new Map([[1, "ethereum"], [56, "bsc"], [137, "polygon"], [43114, "avalanche"], [42161, "arbitrum"], [10, "optimism"], [8453, "base"], [59144, "linea"]]);
export function mayanChainNameOf(chainKey) {
  if (chainKey === "solana") return "solana";
  const n = NETWORKS[chainKey];
  return n ? (MAYAN_CHAIN_NAME_BY_ID.get(n.chainId) ?? null) : null;
}
/** Wormhole chain ids for Mayan's covered chains (the order
 *  structs and hashes are keyed by these, not by EVM ids). */
const MAYAN_WORMHOLE_IDS = { solana: 1, ethereum: 2, bsc: 4, polygon: 5, avalanche: 6, sui: 21, arbitrum: 23, optimism: 24, base: 30, linea: 38 };
/** Circle CCTP domain ids for the Fast MCTP legs. */
const MAYAN_CCTP_DOMAINS = { ethereum: 0, avalanche: 1, optimism: 2, arbitrum: 3, solana: 5, base: 6, polygon: 7, sui: 8, linea: 11 };
const MAYAN_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAYAN_ZERO_PERMIT = { value: 0n, deadline: 0n, v: 0, r: "0x" + "00".repeat(32), s: "0x" + "00".repeat(32) };
const MAYAN_FORWARDER_ABI = [
  "function forwardERC20(address tokenIn, uint256 amountIn, tuple(uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitParams, address mayanProtocol, bytes protocolData)",
  "function forwardEth(address mayanProtocol, bytes protocolData) payable",
  "function swapAndForwardERC20(address tokenIn, uint256 amountIn, tuple(uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permitParams, address swapProtocol, bytes swapData, address middleToken, uint256 minMiddleAmount, address mayanProtocol, bytes mayanData)",
  "function swapAndForwardEth(uint256 amountIn, address swapProtocol, bytes swapData, address middleToken, uint256 minMiddleAmount, address mayanProtocol, bytes mayanData) payable",
];
const MAYAN_SWIFT_EVM_ABI = [
  "function createOrderWithToken(address tokenIn, uint256 amountIn, tuple(uint8 payloadType, bytes32 trader, bytes32 destAddr, uint16 destChainId, bytes32 referrerAddr, bytes32 tokenOut, uint64 minAmountOut, uint64 gasDrop, uint64 cancelFee, uint64 refundFee, uint64 deadline, uint8 referrerBps, uint8 auctionMode, bytes32 random) params, bytes customPayload) returns (bytes32)",
];
const MAYAN_FAST_MCTP_EVM_ABI = [
  "function bridge(address tokenIn, uint256 amountIn, uint64 redeemFee, uint256 circleMaxFee, uint64 gasDrop, bytes32 destAddr, uint32 destDomain, bytes32 referrerAddress, uint8 referrerBps, uint8 payloadType, uint32 minFinalityThreshold, bytes customPayload)",
  "function createOrder(address tokenIn, uint256 amountIn, uint256 circleMaxFee, uint32 destDomain, uint32 minFinalityThreshold, tuple(uint8 payloadType, bytes32 destAddr, bytes32 tokenOut, uint64 amountOutMin, uint64 gasDrop, uint64 redeemFee, uint64 refundFee, uint64 deadline, bytes32 referrerAddr, uint8 referrerBps) orderPayload) returns (bytes32)",
];

/** Map a swap-space token address to the contract/mint Mayan
 *  quotes: EVM native (Fluid's LI.FI sentinel, the zero address,
 *  or an absent address) is Mayan's zero address; Solana native
 *  (the System Program id) is the wrapped-SOL mint. Anything
 *  else is itself. Null for an address Mayan cannot name. */
export function mayanTokenOf(chainKey, tokenAddress) {
  if (chainKey === "solana") {
    if (tokenAddress == null || String(tokenAddress) === SOLANA_SWAP_NATIVE_TOKEN) return JUPITER_WRAPPED_SOL_MINT;
    const a = String(tokenAddress);
    return isValidSolanaAddress(a) ? a : null;
  }
  if (!NETWORKS[chainKey]) return null;
  if (tokenAddress == null) return MAYAN_ZERO_ADDRESS;
  const a = String(tokenAddress);
  if (a.toLowerCase() === MAYAN_ZERO_ADDRESS || a === LIFI_NATIVE_TOKEN) return MAYAN_ZERO_ADDRESS;
  return ethers.isAddress(a) ? a : null;
}
/** Whether Mayan contests this pair in v1: Swift + Fast MCTP
 *  for Solana-source → covered EVM, and covered EVM ↔ EVM.
 *  EVM → Solana is OUT (a verified tie, not cheaper — the
 *  owner's rule), Sui is out on both sides (see the header),
 *  same-chain is out (Jupiter/LI.FI own those lanes), and both
 *  tokens must be nameable in Mayan's space. Pure. */
export function mayanSupportsPair(args) {
  const fromName = mayanChainNameOf(args?.fromChainKey), toName = mayanChainNameOf(args?.toChainKey);
  if (!fromName || !toName || fromName === toName) return false;
  if (toName === "solana") return false; // EVM → Solana: tie, excluded
  if (fromName !== "solana" && toName === "sui") return false;
  if (!mayanTokenOf(args.fromChainKey, args.fromTokenAddress)) return false;
  if (!mayanTokenOf(args.toChainKey, args.toTokenAddress)) return false;
  if (!args.fromAddress) return false;
  return true;
}
/** An address as the 32-byte Wormhole-form hex string Mayan's
 *  order structs carry: a Solana/Sui address is its raw 32
 *  bytes; an EVM address is left-padded with zeroes. */
export function mayanAddressHex(address, mayanChainName) {
  if (mayanChainName === "solana") return ethers.zeroPadValue("0x" + hex.encode(base58.decode(String(address))), 32).toLowerCase();
  if (mayanChainName === "sui") {
    const a = String(address).toLowerCase();
    return ethers.zeroPadValue(a.startsWith("0x") ? a : "0x" + a, 32).toLowerCase();
  }
  return ethers.zeroPadValue(String(address), 32).toLowerCase();
}
function mayanAddressBytes(address, mayanChainName) {
  return hex.decode(mayanAddressHex(address, mayanChainName).slice(2));
}
/** The SDK's fractional-amount conversion, ported faithfully:
 *  normalize a human decimal to at most 8 fractional digits
 *  (truncation via a fixed-point string, never rounding up),
 *  then scale to `decimals`. Used for the order structs'
 *  normalized u64 fields (minAmountOut, gasDrop, fees). */
export function mayanFractionalAmount(amount, decimals) {
  const dec = Number(decimals);
  if (!Number.isFinite(Number(amount)) || !Number.isFinite(dec)) throw new Error("Mayan: unreadable amount in quote.");
  const cut = Math.min(8, dec);
  const fixed = Number(amount).toFixed(cut + 1);
  const m = fixed.match(new RegExp(`^-?\\d+(?:\\.\\d{0,${cut}})?`));
  if (!m) throw new Error("Mayan: unreadable amount in quote.");
  return ethers.parseUnits(m[0], dec);
}
function mayanGasDecimals(mayanChainName) { return (mayanChainName === "solana" || mayanChainName === "sui") ? 9 : 18; }
/** The destination token as the Swift order's tokenOut bytes:
 *  the zero contract (a native destination) is named by the
 *  System Program's bytes, per the SDK; anything else is the
 *  token contract in Wormhole form. */
function mayanSwiftTokenOutHex(quote) {
  const to = quote?.toToken;
  if (!to) throw new Error("Mayan: quote carries no destination token.");
  if (String(to.contract) === MAYAN_ZERO_ADDRESS) return mayanAddressHex(SOLANA_SWAP_NATIVE_TOKEN, "solana");
  return mayanAddressHex(to.contract, quote.toChain);
}
/** The per-quote random key, SDK-shaped: the quote id's 16
 *  bytes followed by 16 fresh random bytes (a memo would fill
 *  the second half instead; Fluid sets none). Only uniqueness
 *  matters — the same bytes feed the order hash, the state PDA
 *  and the init instruction, all derived in one place here. */
export function mayanSwiftRandomKey(quote) {
  const out = new Uint8Array(32);
  try {
    const id = hex.decode(String(quote?.quoteId || "").replace(/^0x/, ""));
    out.set(id.slice(0, 16), 0);
  } catch { /* a malformed id just leaves zeroes — the random half still separates orders */ }
  const rnd = new Uint8Array(16);
  (globalThis.crypto || {}).getRandomValues ? globalThis.crypto.getRandomValues(rnd) : rnd.set(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
  out.set(rnd, 16);
  return out;
}
function mayanU64Le(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return b; }
function mayanU64Be(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), false); return b; }
function mayanU16Le(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, Number(v), true); return b; }
function mayanAnchorDisc(name) { return sha256(new TextEncoder().encode("global:" + name)).slice(0, 8); }

/** The POST /v3/quote body. Pure and exported so tests can pin
 *  exactly what reaches Mayan: route flags select Swift + Fast
 *  MCTP ONLY (the raw API defaults every flag to false — set
 *  none and every request answers ROUTE_NOT_FOUND), sdkVersion
 *  is mandatory, the Forwarder address must ride along for EVM
 *  sources, and the referrer identity + fee bps ride ONLY when
 *  a fee is actually being charged (pass 2 of the two-pass
 *  search) — never decoratively. amountIn64 carries Fluid's raw
 *  amount, so no decimal knowledge is needed to ask. */
export function buildMayanQuoteBody(args, { feeBps = 0 } = {}) {
  const body = {
    swift: true, fastMctp: true, mctp: false, wormhole: false, monoChain: false,
    shuttle: false, gasless: false, onlyDirect: false, fullList: true,
    solanaProgram: MAYAN_SOLANA_PROGRAM,
    forwarderAddress: MAYAN_FORWARDER,
    amountIn64: String(args.fromAmount),
    fromToken: mayanTokenOf(args.fromChainKey, args.fromTokenAddress),
    fromChain: mayanChainNameOf(args.fromChainKey),
    toToken: mayanTokenOf(args.toChainKey, args.toTokenAddress),
    toChain: mayanChainNameOf(args.toChainKey),
    slippageBps: 100,
    referrer: MAYAN_REFERRER_SOLANA,
    destinationAddress: args.toAddress || args.fromAddress,
    sdkVersion: MAYAN_SDK_VERSION,
  };
  if (Number(feeBps) > 0) body.referrerBps = Math.floor(Number(feeBps));
  return body;
}

/** Parse one Mayan quote into Fluid's route shape (the fields
 *  rankSwapRoutes and the swap sheet consume), keeping the raw
 *  quote on route.mayan for execution. Pure; returns null when
 *  the quote disagrees with the request it answers (chains,
 *  tokens, input amount), is not an executable v1 shape
 *  (wrong type, gasless, a Swift version this build does not
 *  construct, a source swap whose router leg the quote does
 *  not pre-disclose), is unpriceable in USD, guarantees less
 *  than its own minimum, carries a referrer rate different
 *  from the one requested (ctx.feeBps), or has already expired
 *  — a quote Fluid cannot verify never reaches the signer.
 *
 *  ROUTE COST (the model's one definition, routeCostUsd): the
 *  larger of the explicit protocol fee Mayan declares
 *  (protocolFeeUsd — Swift's is 0, Fast MCTP's 3 bps) and the
 *  all-in shortfall, measured against the GROSS output — on a
 *  fee-bearing quote the expected output is already net of
 *  Fluid's referrer fee, so the fee (the quote's own
 *  referrerFeeUsd) is added back before the shortfall is read;
 *  Fluid's fee never inflates the cost it is marked up from.
 *  gasCostUSD prices what the quote itself denominates: for a
 *  Solana source, the account rent the quote declares
 *  (rentCost, lamports) plus the base signature fee, priced in
 *  SOL via ctx.solPriceUsd when known; Mayan denominates no
 *  source gas for EVM sources (the Forwarder call's gas is the
 *  chain's ordinary transaction cost, outside the quote), so
 *  it stays 0 there — the basis the shoot-out verdicts were
 *  reached on. */
export function parseMayanQuote(quote, args, ctx = {}) {
  const feeBps = Math.max(0, Math.floor(Number(ctx.feeBps) || 0));
  if (!quote || typeof quote !== "object") return null;
  const type = quote.type;
  if (type !== "SWIFT" && type !== "FAST_MCTP") return null;
  if (quote.gasless) return null;
  const fromName = mayanChainNameOf(args?.fromChainKey), toName = mayanChainNameOf(args?.toChainKey);
  if (!fromName || !toName || quote.fromChain !== fromName || quote.toChain !== toName) return null;
  const fromTok = mayanTokenOf(args.fromChainKey, args.fromTokenAddress);
  const toTok = mayanTokenOf(args.toChainKey, args.toTokenAddress);
  if (!fromTok || !toTok) return null;
  const sameAddr = (a, b, chainName) => chainName === "solana"
    ? String(a) === String(b) : String(a).toLowerCase() === String(b).toLowerCase();
  if (!quote.fromToken || !sameAddr(quote.fromToken.contract, fromTok, fromName)) return null;
  if (!quote.toToken || !sameAddr(quote.toToken.contract, toTok, toName)) return null;
  if (String(quote.effectiveAmountIn64) !== String(args.fromAmount)) return null;
  if (type === "SWIFT") {
    if (quote.swiftVersion !== "V2") return null; // only the V2 construction is ported
    if (quote.swiftInputContract === MAYAN_ZERO_ADDRESS && fromName !== "solana") return null; // V2 has no native-lock EVM shape (the SDK refuses it too)
    if (fromName === "solana" ? !isValidSolanaAddress(String(quote.swiftMayanContract || "")) : !ethers.isAddress(String(quote.swiftMayanContract || ""))) return null;
    if (fromName === "solana" && String(quote.swiftMayanContract) !== MAYAN_SWIFT_V2_PROGRAM) return null;
    if (!quote.deadline64 || !quote.cancelRelayerFee64 || !quote.refundRelayerFee64) return null;
  } else {
    if (fromName === "solana" ? String(quote.fastMctpMayanContract || "") !== MAYAN_FAST_MCTP_PROGRAM : !ethers.isAddress(String(quote.fastMctpMayanContract || ""))) return null;
    if (quote.redeemRelayerFee == null || quote.redeemRelayerFee64 == null || quote.circleMaxFee64 == null || quote.fastMctpMinFinality == null) return null;
    if (quote.hasAuction && (!quote.deadline64 || !quote.refundRelayerFee64)) return null;
  }
  // A source swap (input ≠ the route's locked/bridged asset)
  // is only signable when the quote itself pre-discloses the
  // router leg Fluid will bounds-check and sign — no second,
  // undisclosed call is ever fetched at execution time.
  const inputContract = type === "SWIFT" ? quote.swiftInputContract : quote.fastMctpInputContract;
  const needsSwap = !(fromName === "solana" ? String(quote.fromToken.contract) === String(inputContract) : String(quote.fromToken.contract).toLowerCase() === String(inputContract).toLowerCase());
  if (needsSwap && fromName !== "solana" && !(quote.evmSwapRouterAddress && quote.evmSwapRouterCalldata)) return null;
  let inAmt, outAmt, minAmt;
  try {
    inAmt = BigInt(quote.effectiveAmountIn64); outAmt = BigInt(quote.expectedAmountOutBaseUnits); minAmt = BigInt(quote.minReceivedBaseUnits);
  } catch { return null; }
  if (inAmt <= 0n || outAmt <= 0n || minAmt <= 0n || outAmt < minAmt) return null;
  const inDec = Number(quote.fromToken.decimals), outDec = Number(quote.toToken.decimals);
  if (!Number.isFinite(inDec) || !Number.isFinite(outDec)) return null;
  // The quote's human and raw amount pairs must agree — a quote
  // whose own figures disagree is not one to price a fee from.
  const agree = (human, raw, dec) => {
    const h = Number(human);
    if (!Number.isFinite(h)) return false;
    const scaled = h * 10 ** dec;
    return Math.abs(scaled - Number(raw)) <= Math.max(1, Math.abs(scaled) * 1e-6);
  };
  if (!agree(quote.effectiveAmountIn, inAmt, inDec) || !agree(quote.expectedAmountOut, outAmt, outDec)) return null;
  // Mayan's `price` is the from-token's price denominated in
  // the TO token (USDC→WETH quotes ~0.00047, not ~1) — the
  // from-token's USD price is price × toTokenPrice (verified
  // against live quotes: 0.0004718 × 2118.67 ≈ 0.9996, the
  // USDC price in the quote's own feed). Reading `price` as
  // USD directly would understate the input by the to-token's
  // whole price factor on cross-asset quotes.
  const priceRatio = Number(quote.price), outPrice = Number(quote.toTokenPrice ?? quote.toPrice);
  if (!Number.isFinite(priceRatio) || priceRatio <= 0 || !Number.isFinite(outPrice) || outPrice <= 0) return null;
  const fromAmountUSD = Number(quote.effectiveAmountIn) * priceRatio * outPrice;
  const toAmountUSD = Number(quote.expectedAmountOut) * outPrice;
  const referrerFeeUsd = Math.max(0, Number(quote.referrerFeeUsd) || 0);
  if (Math.abs((Number(quote.referrerBps) || 0) - feeBps) > 1e-9) return null;
  if (feeBps > 0 && !(referrerFeeUsd > 0)) return null; // a fee was requested; the quote must price it, never silently drop it
  const routeFeeUsd = routeCostUsd(Number(quote.protocolFeeUsd) || 0, fromAmountUSD - (toAmountUSD + referrerFeeUsd));
  let gasCostUSD = 0;
  if (fromName === "solana" && Number(ctx.solPriceUsd) > 0) {
    const rent = Number(quote.rentCost) || 0;
    gasCostUSD = ((rent + 5000) / 1e9) * Number(ctx.solPriceUsd);
  }
  const deadline = Number(quote.deadline64) || null;
  if (deadline && deadline < Math.floor(Date.now() / 1000) - 60) return null;
  const from = swapChainOf(args.fromChainKey), to = swapChainOf(args.toChainKey);
  if (!from || !to) return null;
  const route = {
    provider: "mayan",
    id: "mayan:" + (quote.quoteId || String(quote.effectiveAmountIn64)),
    type: "mayan",
    fromChainId: from.chainId, toChainId: to.chainId,
    fromAmount: String(quote.effectiveAmountIn64),
    fromToken: { address: args.fromTokenAddress, symbol: quote.fromToken.symbol || null, name: quote.fromToken.name || null, decimals: inDec, chainId: from.chainId },
    toToken: { address: args.toTokenAddress, symbol: quote.toToken.symbol || null, name: quote.toToken.name || null, decimals: outDec, chainId: to.chainId },
    toAmount: String(quote.expectedAmountOutBaseUnits),
    toAmountMin: String(quote.minReceivedBaseUnits),
    toAmountUSD, fromAmountUSD,
    gasCostUSD,
    routeFeeUsd,
    executionDuration: Number.isFinite(Number(quote.etaSeconds)) ? Number(quote.etaSeconds) : null,
    platformFeeRaw: null,
    platformFeeUsd: referrerFeeUsd,
    platformFeeCollecting: referrerFeeUsd > 0,
    platformFeeBps: feeBps,
    steps: [],
    mayan: {
      routeType: type,
      fromChainName: fromName, toChainName: toName,
      hasAuction: quote.hasAuction === true,
      needsSwap,
      deadline64: deadline,
      destinationAddress: args.toAddress || args.fromAddress,
      // The Swift order's random key, fixed at quote time so the
      // EVM payload rebuild in the bounds check reproduces the
      // exact bytes the user reviewed. (Solana Swift derives a
      // fresh key inside its execution-time build instead —
      // its bounds check re-derives everything from the built
      // instruction set, so no stored key is needed there.)
      randomKey: type === "SWIFT" ? hex.encode(mayanSwiftRandomKey(quote)) : null,
      quote,
      tx: null, // EVM sources: the bounds-checked Forwarder payload, built by getMayanSwapRoute
    },
  };
  return route;
}
/** One POST /v3/quote round: returns the response's quote list
 *  (possibly empty). Throws on transport/HTTP failure and on a
 *  response whose minimum SDK version has moved past the pin —
 *  an API that outruns the ported construction must fall back,
 *  never improvise. */
async function fetchMayanQuotes(args, feeBps = 0) {
  const res = await fetch(`${MAYAN_PRICE_API}/quote`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify(buildMayanQuoteBody(args, { feeBps })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Mayan route search failed: " + (data?.msg || data?.message || ("HTTP " + res.status)));
  const minV = data?.minimumSdkVersion;
  if (Array.isArray(minV) && minV.length >= 1 && Number(minV[0]) > 15)
    throw new Error("Mayan's API now requires a newer SDK than this build's port — falling back.");
  return Array.isArray(data?.quotes) ? data.quotes : [];
}
/** The best eligible quote in a response list: Swift or Fast
 *  MCTP, non-gasless, ranked by the raw expected output (one
 *  destination token across the list, so raw compares cleanly).
 *  When wantType is given, only that route type is eligible
 *  (pass 2 must price the SAME route pass 1 measured). */
function pickMayanQuote(quotes, wantType = null) {
  let best = null;
  for (const q of quotes || []) {
    if (!q || (q.type !== "SWIFT" && q.type !== "FAST_MCTP") || q.gasless) continue;
    if (wantType && q.type !== wantType) continue;
    let out;
    try { out = BigInt(q.expectedAmountOutBaseUnits); } catch { continue; }
    if (!best || out > best.out) best = { quote: q, out };
  }
  return best ? best.quote : null;
}
/** Mayan's route for a swap, priced under the fee law — the
 *  same TWO-PASS discipline as the other routers: pass 1 quotes
 *  with NO referrer fee and reads the best route's own cost;
 *  platformFeeBpsForRoute turns it into the bps to charge (the
 *  destination ecosystem's row of the law), clamped to the
 *  route type's referrer cap; pass 2 re-quotes with exactly
 *  that bps and the EXECUTED route is pass 2's quote OF THE
 *  SAME ROUTE TYPE, with the disclosed fee read from its own
 *  referrerFeeUsd. If the law prices the fee at 0 bps, pass 1's
 *  quote already carries no fee and is executed as quoted. A
 *  failed or unusable pass 2 throws (the Relay posture): the
 *  dispatcher ranks what it has rather than silently dropping
 *  the fee. For EVM sources the execution payload is built and
 *  bounds-checked HERE, at quote time (buildMayanEvmTxPayload +
 *  checkMayanEvmTxBounds) — a payload Fluid cannot verify
 *  refuses the route before the user ever sees it. */
export async function getMayanSwapRoute(args) {
  if (!mayanSupportsPair(args)) return null;
  let solPriceUsd = 0;
  if (args.fromChainKey === "solana") {
    try {
      const prices = await fetchJupiterPrices([JUPITER_WRAPPED_SOL_MINT]);
      solPriceUsd = prices.get(JUPITER_WRAPPED_SOL_MINT)?.usdPrice || 0;
    } catch { /* rent stays unpriced (gasCostUSD 0) — ranking still reads the shortfall honestly */ }
  }
  const firstRaw = pickMayanQuote(await fetchMayanQuotes(args, 0));
  if (!firstRaw) throw new Error("Mayan returned no usable route for that pair.");
  const first = parseMayanQuote(firstRaw, args, { feeBps: 0, solPriceUsd });
  if (!first) throw new Error("Mayan returned no usable route for that pair.");
  const finish = (route) => {
    if (route.mayan.fromChainName !== "solana") {
      const tx = buildMayanEvmTxPayload(route.mayan.quote, {
        swapperAddress: args.fromAddress, destinationAddress: route.mayan.destinationAddress,
        randomKey: route.mayan.randomKey ? hex.decode(route.mayan.randomKey) : null,
      });
      const bounds = checkMayanEvmTxBounds(route, tx, args.fromAddress);
      if (!bounds.ok) throw new Error(bounds.reason);
      route.mayan.tx = tx;
    }
    return route;
  };
  if (!PLATFORM_FEE_COLLECTION_ENABLED) { first.platformFeeBps = 0; return finish(first); }
  let bps = platformFeeBpsForRoute(first.routeFeeUsd, first.fromAmountUSD, args.toChainKey);
  bps = Math.min(bps, MAYAN_REFERRER_CAPS_BPS[first.mayan.routeType] ?? 0);
  if (bps <= 0) { first.platformFeeBps = 0; return finish(first); }
  const finalRaw = pickMayanQuote(await fetchMayanQuotes(args, bps), first.mayan.routeType);
  if (!finalRaw) throw new Error("Mayan returned no usable route for that pair.");
  const final = parseMayanQuote(finalRaw, args, { feeBps: bps, solPriceUsd });
  if (!final) throw new Error("Mayan's fee-bearing quote disagreed with its fee-free quote — refusing it.");
  final.platformFeeBps = bps;
  return finish(final);
}
// --- persisted order records (the source tx hash is the key) ---
function validMayanRecord(r) {
  return !!r && typeof r === "object" && typeof r.id === "string" && !!r.id && typeof r.status === "string";
}
export function loadMayanSwapRecords(storage) {
  try {
    const list = JSON.parse(storage.getItem(MAYAN_SWAPS_STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list.filter(validMayanRecord) : [];
  } catch { return []; }
}
export function saveMayanSwapRecord(storage, record) {
  if (!validMayanRecord(record)) return loadMayanSwapRecords(storage);
  const list = loadMayanSwapRecords(storage).filter(r => r.id !== record.id);
  list.unshift(record);
  try { storage.setItem(MAYAN_SWAPS_STORAGE_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* storage full/blocked: the in-memory record still stands */ }
  return list;
}
/** One Mayan swap's explorer state, by source transaction hash:
 *  the response's clientStatus drives the record's phase
 *  (INPROGRESS until a final state, then COMPLETED / REFUNDED). */
export async function fetchMayanSwapStatus(txHash) {
  const res = await fetch(`${MAYAN_EXPLORER_API}/swap/trx/${encodeURIComponent(String(txHash))}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Mayan status lookup failed: " + (data?.message || ("HTTP " + res.status)));
  if (!data || typeof data.clientStatus !== "string") throw new Error("Mayan returned an unreadable swap status.");
  return data;
}
/** Map an explorer clientStatus to the record phase: label,
 *  terminality, and — for an order route past its deadline with
 *  no fill — the refund path the user actually has. */
export function mayanSwapPhase(clientStatus) {
  switch (String(clientStatus || "").toUpperCase()) {
    case "COMPLETED": return { key: "completed", label: "Completed", terminal: true, refunded: false };
    case "REFUNDED": return { key: "refunded", label: "Refunded on the source chain", terminal: true, refunded: true };
    case "INPROGRESS": return { key: "inprogress", label: "In progress", terminal: false, refunded: false };
    default: return { key: "unknown", label: "Status unknown", terminal: false, refunded: false };
  }
}
export function mayanSwapHistoryLine(record) {
  const phase = mayanSwapPhase(record?.status);
  const when = record?.deadline64 && !phase.terminal
    ? ` — if it is not filled by ${new Date(record.deadline64 * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC it refunds on the source chain.`
    : "";
  return `${record?.routeType === "FAST_MCTP" ? "Mayan Fast MCTP" : "Mayan Swift"} · ${phase.label}${when}`;
}
/** Background status polling over the persisted records:
 *  refresh every non-terminal swap from the explorer API and
 *  save what changed. A failed poll keeps the last known status
 *  (honest staleness, never a fabricated state). */
export async function pollMayanSwapStatuses(storage) {
  const records = loadMayanSwapRecords(storage);
  let changed = false;
  for (const r of records) {
    if (mayanSwapPhase(r.status).terminal) continue;
    try {
      const fresh = await fetchMayanSwapStatus(r.id);
      if (fresh.clientStatus !== r.status) { r.status = fresh.clientStatus; r.updatedAt = Date.now(); changed = true; }
    } catch { /* keep the last known status */ }
  }
  if (changed) { try { storage.setItem(MAYAN_SWAPS_STORAGE_KEY, JSON.stringify(records.slice(0, 50))); } catch { /* as above */ } }
  return records;
}
/** The refund truth for a Mayan route, stated before signing
 *  (the report's required copy): order routes refund on the
 *  source chain after the deadline — in the CONVERTED asset
 *  when the input was swapped into the locked asset first;
 *  bridge-mode Fast MCTP leaves the user holding the minted
 *  destination USDC if its destination leg cannot execute. */
export function formatMayanRefundNote(route) {
  const m = route?.mayan;
  if (!m) return "";
  const fromLabel = m.fromChainName === "solana" ? "Solana" : (Object.values(NETWORKS).find(n => n.chainId === Number(route.fromChainId))?.name || "the source chain");
  if (m.routeType === "FAST_MCTP" && !m.hasAuction) {
    return ` This bridge has no order to refund: if the destination swap leg cannot execute, you are left holding the minted USDC on the destination chain, not nothing.`;
  }
  const when = m.deadline64 ? ` before its deadline (${new Date(m.deadline64 * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC)` : "";
  const converted = m.needsSwap
    ? " — and because your input is first converted into the asset the order locks, the refund returns that converted asset, not the token you sent"
    : "";
  return ` If no driver fills this order${when}, the locked funds refund to this same wallet on ${fromLabel}${converted}.`;
}

/** The referrer address a quote's fee is paid TO, resolved by
 *  the chain that pays it (Mayan's own resolution): Swift pays
 *  on the SOURCE chain, Fast MCTP on the DESTINATION chain.
 *  Returns the collection wallet for that family, or null for a
 *  family Fluid takes no Mayan fee in. */
export function mayanReferrerFor(quote) {
  const paysOn = quote?.type === "SWIFT" ? quote?.fromChain : quote?.toChain;
  if (paysOn === "solana") return MAYAN_REFERRER_SOLANA;
  if (paysOn && [...MAYAN_CHAIN_NAME_BY_ID.values()].includes(paysOn)) return MAYAN_REFERRER_EVM;
  return null;
}
const mayanFwdIface = () => new ethers.Interface(MAYAN_FORWARDER_ABI);
const mayanSwiftIface = () => new ethers.Interface(MAYAN_SWIFT_EVM_ABI);
const mayanFastMctpIface = () => new ethers.Interface(MAYAN_FAST_MCTP_EVM_ABI);
/** The Swift order tuple for an EVM-source quote, in ABI order
 *  (payloadType, trader, destAddr, destChainId, referrerAddr,
 *  tokenOut, minAmountOut, gasDrop, cancelFee, refundFee,
 *  deadline, referrerBps, auctionMode, random) — the port of
 *  the SDK's getEvmSwiftParams. The trader is the swapper (a
 *  refund returns to the trader), the referrer is the SOURCE
 *  family's collection wallet (Swift pays on the source
 *  chain), and `random` is the caller-supplied per-quote key
 *  so a rebuild reproduces the payload byte for byte. */
export function buildMayanEvmSwiftOrder(quote, { swapperAddress, destinationAddress, randomKey }) {
  const sourceName = quote.fromChain, destName = quote.toChain;
  const referrer = mayanReferrerFor(quote);
  const order = [
    1, // payloadType: default (Fluid attaches no custom payload)
    mayanAddressHex(swapperAddress, sourceName),
    mayanAddressHex(destinationAddress, destName),
    MAYAN_WORMHOLE_IDS[destName],
    referrer ? mayanAddressHex(referrer, sourceName) : mayanAddressHex(SOLANA_SWAP_NATIVE_TOKEN, "solana"),
    mayanSwiftTokenOutHex(quote),
    mayanFractionalAmount(quote.minAmountOut, Math.min(Number(quote.toToken.decimals), 8)),
    mayanFractionalAmount(quote.gasDrop, Math.min(mayanGasDecimals(destName), 8)),
    BigInt(quote.cancelRelayerFee64),
    BigInt(quote.refundRelayerFee64),
    BigInt(quote.deadline64),
    Number(quote.referrerBps) || 0,
    Number(quote.swiftAuctionMode),
    "0x" + hex.encode(randomKey),
  ];
  const tokenIn = quote.swiftWrapAndLock ? MAYAN_ZERO_ADDRESS : quote.swiftInputContract;
  const data = mayanSwiftIface().encodeFunctionData("createOrderWithToken", [tokenIn, BigInt(quote.effectiveAmountIn64), order, "0x"]);
  return { contractAddress: quote.swiftMayanContract, tokenIn, amountIn: BigInt(quote.effectiveAmountIn64), order, data };
}
/** The Fast MCTP inner payload for an EVM-source quote: an
 *  ORDER (createOrder) when the quote runs an auction, a plain
 *  BRIDGE otherwise — the port of the SDK's two payload
 *  builders. The referrer is the DESTINATION family's
 *  collection wallet (Fast MCTP pays in the minted USDC). */
export function buildMayanEvmFastMctpPayload(quote, { destinationAddress }) {
  const destName = quote.toChain;
  const referrer = mayanReferrerFor(quote);
  const referrerHex = referrer ? mayanAddressHex(referrer, destName) : mayanAddressHex(SOLANA_SWAP_NATIVE_TOKEN, "solana");
  const destAddr = mayanAddressHex(destinationAddress, destName);
  const amountIn = BigInt(quote.effectiveAmountIn64);
  const gasDrop = mayanFractionalAmount(quote.gasDrop, Math.min(mayanGasDecimals(destName), 8));
  const redeemFee = mayanFractionalAmount(quote.redeemRelayerFee, 6);
  const destDomain = MAYAN_CCTP_DOMAINS[destName];
  const iface = mayanFastMctpIface();
  if (quote.hasAuction) {
    const tokenOut = String(quote.toToken.contract) === MAYAN_ZERO_ADDRESS
      ? mayanAddressHex(SOLANA_SWAP_NATIVE_TOKEN, "solana") : mayanAddressHex(quote.toToken.contract, destName);
    const orderPayload = [
      3, // payloadType: order
      destAddr, tokenOut,
      mayanFractionalAmount(quote.minAmountOut, Math.min(8, Number(quote.toToken.decimals))),
      gasDrop, redeemFee, BigInt(quote.refundRelayerFee64), BigInt(quote.deadline64),
      referrerHex, Number(quote.referrerBps) || 0,
    ];
    const data = iface.encodeFunctionData("createOrder", [quote.fastMctpInputContract, amountIn, BigInt(quote.circleMaxFee64), destDomain, Number(quote.fastMctpMinFinality), orderPayload]);
    return { contractAddress: quote.fastMctpMayanContract, data, orderPayload };
  }
  const data = iface.encodeFunctionData("bridge", [quote.fastMctpInputContract, amountIn, redeemFee, BigInt(quote.circleMaxFee64), gasDrop, destAddr, destDomain, referrerHex, Number(quote.referrerBps) || 0, 1, Number(quote.fastMctpMinFinality), "0x"]);
  return { contractAddress: quote.fastMctpMayanContract, data, orderPayload: null };
}
/** The full EVM execution payload for a Mayan quote: one call
 *  to the pinned Forwarder — a direct forward when the input
 *  already IS the route's locked/bridged asset, or a
 *  swap-and-forward through the router leg THE QUOTE ITSELF
 *  pre-discloses (evmSwapRouterAddress / evmSwapRouterCalldata
 *  — Fluid fetches no second, undisclosed leg). The permit is
 *  always the zero permit: Fluid grants the Forwarder a
 *  classic exact-amount ERC-20 approval instead of signing
 *  permit messages. Pure; throws when the quote's shape is
 *  not one this build constructs. */
export function buildMayanEvmTxPayload(quote, { swapperAddress, destinationAddress, randomKey = null }) {
  if (!quote || (quote.type !== "SWIFT" && quote.type !== "FAST_MCTP")) throw new Error("Mayan: not a constructible quote type.");
  const inner = quote.type === "SWIFT"
    ? buildMayanEvmSwiftOrder(quote, { swapperAddress, destinationAddress, randomKey: randomKey || mayanSwiftRandomKey(quote) })
    : buildMayanEvmFastMctpPayload(quote, { destinationAddress });
  const inputContract = quote.type === "SWIFT" ? quote.swiftInputContract : quote.fastMctpInputContract;
  const amountIn = BigInt(quote.effectiveAmountIn64);
  const fromContract = quote.fromToken.contract;
  const fwd = mayanFwdIface();
  const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  if (eq(fromContract, inputContract)) {
    if (eq(fromContract, MAYAN_ZERO_ADDRESS)) throw new Error("Mayan: a native-input direct forward is not a constructible shape.");
    const tokenInArg = quote.type === "SWIFT" ? inner.tokenIn : fromContract;
    return { to: MAYAN_FORWARDER, value: "0", data: fwd.encodeFunctionData("forwardERC20", [tokenInArg, amountIn, MAYAN_ZERO_PERMIT, inner.contractAddress, inner.data]) };
  }
  const router = quote.evmSwapRouterAddress, routerData = quote.evmSwapRouterCalldata;
  if (!router || !routerData) throw new Error("Mayan: the quote does not pre-disclose its source-swap leg — refusing to construct it.");
  const minMiddle = quote.type === "SWIFT"
    ? mayanFractionalAmount(quote.minMiddleAmount, quote.swiftInputDecimals)
    : mayanFractionalAmount(quote.minMiddleAmount, 6);
  if (eq(fromContract, MAYAN_ZERO_ADDRESS)) {
    return { to: MAYAN_FORWARDER, value: amountIn.toString(), data: fwd.encodeFunctionData("swapAndForwardEth", [amountIn, router, routerData, inputContract, minMiddle, inner.contractAddress, inner.data]) };
  }
  return { to: MAYAN_FORWARDER, value: "0", data: fwd.encodeFunctionData("swapAndForwardERC20", [fromContract, amountIn, MAYAN_ZERO_PERMIT, router, routerData, inputContract, minMiddle, inner.contractAddress, inner.data]) };
}
/** Bounds-check a Mayan EVM payload BEFORE anything is signed.
 *  The payload must target the pinned Forwarder, carry value
 *  only on a native input (exactly the amount), and — the
 *  strong check — REBUILD byte for byte from the route's own
 *  quote, owner, destination and stored random key: whatever
 *  is signed is exactly the trade the final quote describes.
 *  The rebuilt inner call is then decoded and its fields
 *  verified against the quote semantically (destination,
 *  minimum received, deadline, referrer rate), and a
 *  swap-and-forward's router leg must be the quote's own
 *  pre-disclosed one, its calldata naming the token sold and
 *  the Forwarder as the swap's recipient. */
export function checkMayanEvmTxBounds(route, tx, owner) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this route: " + m + " Pick another route." });
  if (route?.provider !== "mayan") return refuse("this is not a Mayan route.");
  const m = route.mayan, quote = m?.quote;
  if (!quote || !tx) return refuse("the Mayan route carried no payload to inspect.");
  if (String(tx.to || "").toLowerCase() !== MAYAN_FORWARDER.toLowerCase()) return refuse("the Mayan transaction does not target the pinned Forwarder contract.");
  if (m.fromChainName === "solana") return refuse("an EVM payload rode on a Solana-source route.");
  let rebuilt;
  try {
    rebuilt = buildMayanEvmTxPayload(quote, { swapperAddress: owner, destinationAddress: m.destinationAddress, randomKey: m.randomKey ? hex.decode(m.randomKey) : null });
  } catch (e) { return refuse("the Mayan payload could not be reconstructed from its quote (" + (e?.message || e) + ")."); }
  if (quote.type === "SWIFT" && !m.randomKey) return refuse("the Mayan route carries no order key to rebuild against.");
  if (String(tx.data) !== rebuilt.data) return refuse("the Mayan transaction's calldata is not the payload its quote describes.");
  if (String(tx.value ?? "0") !== String(rebuilt.value)) return refuse("the Mayan transaction's value does not match the swap.");
  // Semantic verification of the (now byte-pinned) inner call.
  const fwd = mayanFwdIface();
  let decoded;
  try { decoded = fwd.parseTransaction({ data: tx.data }); } catch { return refuse("the Mayan transaction did not decode as a Forwarder call."); }
  const innerData = decoded.name === "forwardEth" ? decoded.args[1] : decoded.args[decoded.args.length - 1];
  const protocol = decoded.name === "forwardEth" ? decoded.args[0] : decoded.args[decoded.args.length - 2];
  const wantProtocol = quote.type === "SWIFT" ? quote.swiftMayanContract : quote.fastMctpMayanContract;
  if (String(protocol).toLowerCase() !== String(wantProtocol).toLowerCase()) return refuse("the Mayan call names a protocol contract its quote did not.");
  const destHex = mayanAddressHex(m.destinationAddress, m.toChainName);
  try {
    if (quote.type === "SWIFT") {
      const call = mayanSwiftIface().decodeFunctionData("createOrderWithToken", innerData);
      const p = call[2];
      if (BigInt(call[1]) !== BigInt(quote.effectiveAmountIn64)) return refuse("the Swift order's amount disagrees with the quote.");
      if (String(p.destAddr).toLowerCase() !== destHex) return refuse("the Swift order pays a different destination than the swap's.");
      if (Number(p.destChainId) !== MAYAN_WORMHOLE_IDS[m.toChainName]) return refuse("the Swift order names a different destination chain than the swap's.");
      if (BigInt(p.minAmountOut) !== mayanFractionalAmount(quote.minAmountOut, Math.min(Number(quote.toToken.decimals), 8))) return refuse("the Swift order's minimum received disagrees with the quote.");
      if (BigInt(p.deadline) !== BigInt(quote.deadline64)) return refuse("the Swift order's deadline disagrees with the quote.");
      if (Number(p.referrerBps) !== (Number(quote.referrerBps) || 0)) return refuse("the Swift order's referrer rate is not the quoted rate.");
      if (String(p.trader).toLowerCase() !== mayanAddressHex(owner, m.fromChainName)) return refuse("the Swift order's trader is not you.");
    } else if (quote.hasAuction) {
      const call = mayanFastMctpIface().decodeFunctionData("createOrder", innerData);
      const p = call[5];
      if (BigInt(call[1]) !== BigInt(quote.effectiveAmountIn64)) return refuse("the Fast MCTP order's amount disagrees with the quote.");
      if (Number(call[3]) !== MAYAN_CCTP_DOMAINS[m.toChainName]) return refuse("the Fast MCTP order names a different destination domain than the swap's.");
      if (String(p.destAddr).toLowerCase() !== destHex) return refuse("the Fast MCTP order pays a different destination than the swap's.");
      if (Number(p.referrerBps) !== (Number(quote.referrerBps) || 0)) return refuse("the Fast MCTP order's referrer rate is not the quoted rate.");
      if (BigInt(p.deadline) !== BigInt(quote.deadline64)) return refuse("the Fast MCTP order's deadline disagrees with the quote.");
    } else {
      const call = mayanFastMctpIface().decodeFunctionData("bridge", innerData);
      if (BigInt(call[1]) !== BigInt(quote.effectiveAmountIn64)) return refuse("the Fast MCTP bridge's amount disagrees with the quote.");
      if (Number(call[6]) !== MAYAN_CCTP_DOMAINS[m.toChainName]) return refuse("the Fast MCTP bridge names a different destination domain than the swap's.");
      if (String(call[5]).toLowerCase() !== destHex) return refuse("the Fast MCTP bridge pays a different destination than the swap's.");
      if (Number(call[8]) !== (Number(quote.referrerBps) || 0)) return refuse("the Fast MCTP bridge's referrer rate is not the quoted rate.");
    }
  } catch (e) {
    if (e && typeof e.message === "string" && e.message.startsWith("Fluid refused")) throw e;
    return refuse("the Mayan inner call did not decode as the order its quote describes.");
  }
  if (decoded.name === "swapAndForwardERC20" || decoded.name === "swapAndForwardEth") {
    const swapProtocol = decoded.name === "swapAndForwardEth" ? decoded.args[1] : decoded.args[3];
    const swapData = decoded.name === "swapAndForwardEth" ? decoded.args[2] : decoded.args[4];
    if (String(swapProtocol).toLowerCase() !== String(quote.evmSwapRouterAddress).toLowerCase())
      return refuse("the source swap runs through a router the quote did not disclose.");
    if (String(swapData).toLowerCase() !== String(quote.evmSwapRouterCalldata).toLowerCase())
      return refuse("the source swap's calldata is not the leg the quote pre-disclosed.");
    // The router packs its calldata tightly (addresses ride as
    // raw 20-byte segments, not always as padded words), so
    // containment is checked on the raw address bytes: the leg
    // must name the Forwarder as its recipient and the token
    // being sold. (The hard enforcement is on-chain anyway —
    // swapAndForward requires the Forwarder's middle-token
    // balance to grow by at least minMiddleAmount.)
    const words = String(swapData).toLowerCase();
    const raw = (a) => String(a).toLowerCase().replace(/^0x/, "");
    if (!words.includes(raw(MAYAN_FORWARDER))) return refuse("the source swap does not deliver to the Forwarder.");
    if (quote.fromToken.contract !== MAYAN_ZERO_ADDRESS && !words.includes(raw(quote.fromToken.contract)))
      return refuse("the source swap does not name the token being sold.");
  }
  return { ok: true };
}

// --- Solana execution: locally assembled instructions -------
// Every instruction below is a plain shape ({ programId,
// accounts: [{ pubkey, isSigner, isWritable }], data: base64 })
// — the same decomposition style the Jupiter executor uses —
// so the bounds check reads exactly what will be signed.
function mayanSolIx(programId, accounts, dataBytes) {
  return {
    programId,
    accounts: accounts.map(([pubkey, isSigner, isWritable]) => ({ pubkey: String(pubkey), isSigner: !!isSigner, isWritable: !!isWritable })),
    data: base64.encode(dataBytes),
  };
}
function mayanAtaCreateIx(payer, ata, owner, mint, tokenProgram) {
  return mayanSolIx(SOLANA_PROGRAMS.ata, [
    [payer, true, true], [ata, false, true], [owner, false, false], [mint, false, false],
    [SOLANA_SWAP_NATIVE_TOKEN, false, false], [tokenProgram, false, false], [MAYAN_SYSVAR_RENT, false, false],
  ], new Uint8Array([1])); // CreateIdempotent
}
function mayanSplTransferIx(source, dest, owner, amount, tokenProgram) {
  const data = new Uint8Array(9);
  data[0] = 3; // Transfer
  data.set(mayanU64Le(amount), 1);
  return mayanSolIx(tokenProgram, [[source, false, true], [dest, false, true], [owner, true, false]], data);
}
function mayanComputeUnitPriceIx(microLamports) {
  const data = new Uint8Array(9);
  data[0] = 3; // SetComputeUnitPrice
  data.set(mayanU64Le(microLamports), 1);
  return { programId: "ComputeBudget111111111111111111111111111111", accounts: [], data: base64.encode(data) };
}
/** The CPI-proxy sandwich the Mayan programs expect around
 *  most of their flow's instructions: the inner instruction's
 *  program becomes the first (read-only) account and its data
 *  rides unchanged. */
export function mayanProxyWrap(ix) {
  return {
    programId: MAYAN_CPI_PROXY_PROGRAM,
    accounts: [{ pubkey: ix.programId, isSigner: false, isWritable: false }, ...ix.accounts],
    data: ix.data,
  };
}
export function mayanProxyUnwrap(ix) {
  if (ix?.programId !== MAYAN_CPI_PROXY_PROGRAM) return ix;
  const [head, ...rest] = ix.accounts || [];
  if (!head) return ix;
  return { programId: head.pubkey, accounts: rest, data: ix.data };
}
/** Mayan's server-built Solana SOURCE-SWAP leg (a Jupiter swap
 *  paying the order's state / ledger account), normalized to
 *  the plain instruction shape. This is the one piece Fluid
 *  does not compose itself; the bounds check pins its
 *  aggregator, decodes its amount arguments and contains its
 *  accounts before anything signs. */
async function fetchMayanSolanaClientSwap(quote, { userWallet, userLedger, depositMode }) {
  const suitable = mayanReferrerFor(quote);
  const params = new URLSearchParams();
  params.append("minMiddleAmount", String(quote.minMiddleAmount));
  params.append("middleToken", quote.type === "SWIFT" ? quote.swiftInputContract : quote.fastMctpInputContract);
  params.append("userWallet", userWallet);
  params.append("slippageBps", String(quote.slippageBps ?? 100));
  params.append("fromToken", quote.fromToken.contract);
  params.append("amountIn64", String(quote.effectiveAmountIn64));
  params.append("depositMode", depositMode);
  params.append("fillMaxAccounts", "false");
  if (suitable) params.append("referrerAddress", suitable);
  params.append("userLedger", userLedger);
  params.append("chainName", "solana");
  params.append("sdkVersion", MAYAN_SDK_VERSION);
  const res = await fetch(`${MAYAN_PRICE_API}/get-swap/solana?${params.toString()}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Mayan's source-swap leg could not be built: " + (data?.msg || data?.message || ("HTTP " + res.status)));
  const norm = (ix) => ix ? {
    programId: String(ix.programId),
    accounts: (ix.accounts || []).map(a => ({ pubkey: String(a.pubkey), isSigner: !!a.isSigner, isWritable: !!a.isWritable })),
    data: String(ix.data || ""),
  } : null;
  return {
    swapInstruction: norm(data?.swapInstruction),
    cleanupInstruction: norm(data?.cleanupInstruction),
    computeBudgetInstructions: (data?.computeBudgetInstructions || []).map(norm).filter(Boolean),
    setupInstructions: (data?.setupInstructions || []).map(norm).filter(Boolean),
    addressLookupTableAddresses: Array.isArray(data?.addressLookupTableAddresses) ? data.addressLookupTableAddresses.map(String) : [],
  };
}
/** The Swift V2 order hash: keccak-256 over the order's
 *  272-byte canonical buffer. Ported field for field — note
 *  the buffer's integers are BIG-endian (the instruction
 *  layout below is little-endian; the asymmetry is the
 *  protocol's own, preserved deliberately). */
export function computeMayanSwiftOrderHash(quote, { swapperAddress, destinationAddress, randomKey }) {
  const srcName = quote.fromChain, destName = quote.toChain;
  const srcW = MAYAN_WORMHOLE_IDS[srcName], destW = MAYAN_WORMHOLE_IDS[destName];
  const tokenInHex = String(quote.swiftInputContract) === MAYAN_ZERO_ADDRESS
    ? mayanAddressHex(SOLANA_SWAP_NATIVE_TOKEN, "solana") : mayanAddressHex(quote.swiftInputContract, srcName);
  const referrer = mayanReferrerFor(quote);
  const referrerBytes = referrer ? mayanAddressBytes(referrer, srcName) : new Uint8Array(32);
  const parts = [
    new Uint8Array([1]), // payloadType: default
    mayanAddressBytes(swapperAddress, srcName), // trader (the refund address on a Solana source)
    (() => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, srcW, false); return b; })(),
    hex.decode(tokenInHex.slice(2)),
    mayanAddressBytes(destinationAddress, destName),
    (() => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, destW, false); return b; })(),
    hex.decode(mayanSwiftTokenOutHex(quote).slice(2)),
    mayanU64Be(mayanFractionalAmount(quote.minAmountOut, Math.min(Number(quote.toToken.decimals), 8))),
    mayanU64Be(mayanFractionalAmount(quote.gasDrop, Math.min(mayanGasDecimals(destName), 8))),
    mayanU64Be(quote.cancelRelayerFee64),
    mayanU64Be(quote.refundRelayerFee64),
    mayanU64Be(quote.deadline64),
    referrerBytes,
    new Uint8Array([Number(quote.referrerBps) || 0]),
    new Uint8Array([Number(quote.protocolBps) || 0]),
    new Uint8Array([Number(quote.swiftAuctionMode) || 0]),
    randomKey,
    new Uint8Array(32), // customPayloadHash: none
  ];
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return keccak_256(buf);
}
function mayanSwiftStatePda(orderHash, destWormholeId) {
  return SolPublicKey.findProgramAddressSync(
    [new TextEncoder().encode("STATE_SOURCE"), orderHash, mayanU16Le(destWormholeId)],
    new SolPublicKey(MAYAN_SWIFT_V2_PROGRAM))[0];
}
/** The Swift init_order instruction data (198 bytes):
 *  discriminator, amount-in-minimum, native-input flag,
 *  submit fee, then the order fields in little-endian blobs —
 *  the port of the SDK's layout. */
export function buildMayanSwiftInitData(quote, { destinationAddress, randomKey, amountInMin }) {
  const destName = quote.toChain;
  const referrer = mayanReferrerFor(quote);
  const out = [
    mayanAnchorDisc("init_order"),
    mayanU64Le(amountInMin),
    new Uint8Array([0]), // nativeInput: never on a Solana source
    mayanU64Le(quote.submitRelayerFee64 || 0),
    mayanAddressBytes(destinationAddress, destName),
    mayanU16Le(MAYAN_WORMHOLE_IDS[destName]),
    hex.decode(mayanSwiftTokenOutHex(quote).slice(2)),
    mayanU64Le(mayanFractionalAmount(quote.minAmountOut, Math.min(Number(quote.toToken.decimals), 8))),
    mayanU64Le(mayanFractionalAmount(quote.gasDrop, Math.min(mayanGasDecimals(destName), 8))),
    mayanU64Le(quote.cancelRelayerFee64),
    mayanU64Le(quote.refundRelayerFee64),
    mayanU64Le(quote.deadline64),
    referrer ? mayanAddressBytes(referrer, quote.fromChain) : new Uint8Array(32),
    new Uint8Array([Number(quote.referrerBps) || 0]),
    new Uint8Array([Number(quote.protocolBps) || 0]),
    new Uint8Array([Number(quote.swiftAuctionMode) || 0]),
    randomKey,
  ];
  const buf = new Uint8Array(out.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of out) { buf.set(p, off); off += p.length; }
  return buf;
}
/** Assemble a Solana-source Swift route's instructions: the
 *  direct path locks the input into the order's state account
 *  (create its ATA, transfer exactly the quoted amount, init);
 *  the source-swap path routes a Jupiter swap into that same
 *  state account and inits against the guaranteed middle
 *  amount. The state PDA and order hash are derived here, from
 *  the quote — nothing about the order is taken on trust. */
export async function buildMayanSolanaSwiftInstructions(route, owner) {
  const quote = route.mayan.quote;
  const destination = route.mayan.destinationAddress;
  const mint = new SolPublicKey(quote.swiftInputContract);
  const tokenProgramId = quote.swiftInputContractStandard === "spl2022" ? SOLANA_PROGRAMS.token2022 : SOLANA_PROGRAMS.token;
  const tokenProgram = new SolPublicKey(tokenProgramId);
  const ownerPk = new SolPublicKey(owner);
  const randomKey = mayanSwiftRandomKey(quote);
  const orderHash = computeMayanSwiftOrderHash(quote, { swapperAddress: owner, destinationAddress: destination, randomKey });
  const destW = MAYAN_WORMHOLE_IDS[quote.toChain];
  const state = mayanSwiftStatePda(orderHash, destW);
  const stateAccount = solanaAtaAddress(state, quote.swiftInputContract, tokenProgramId);
  const relayerAccount = solanaAtaAddress(ownerPk, quote.swiftInputContract, tokenProgramId);
  const needsSwap = route.mayan.needsSwap;
  const amountInMin = needsSwap
    ? mayanFractionalAmount(quote.minMiddleAmount, quote.swiftInputDecimals)
    : BigInt(quote.effectiveAmountIn64);
  const initIx = mayanSolIx(MAYAN_SWIFT_V2_PROGRAM, [
    [owner, false, false], // trader: read-only in V2 (the relayer signs)
    [owner, true, true], // relayer = the user (never gasless)
    [state.toBase58(), false, true],
    [stateAccount, false, true],
    [relayerAccount, false, true],
    [MAYAN_SWIFT_V2_PROGRAM, false, false], // custom-payload account slot: the program itself
    [mint.toBase58(), false, false],
    [MAYAN_FEE_MANAGER_PROGRAM, false, false],
    [tokenProgramId, false, false],
    [SOLANA_SWAP_NATIVE_TOKEN, false, false],
  ], buildMayanSwiftInitData(quote, { destinationAddress: destination, randomKey, amountInMin }));
  const instructions = [];
  const lookupTableAddresses = [MAYAN_LOOKUP_TABLE];
  if (!needsSwap) {
    if (Number(quote.suggestedPriorityFee) > 0) instructions.push(mayanComputeUnitPriceIx(Number(quote.suggestedPriorityFee)));
    if (String(route.fromToken.address) === SOLANA_SWAP_NATIVE_TOKEN) {
      // Native SOL in: wrap it into the user's wSOL account
      // first (pinned bookends — System transfer of exactly
      // the quoted amount, then SyncNative).
      const userAta = solanaAtaAddress(ownerPk, quote.swiftInputContract, tokenProgramId);
      instructions.push(mayanAtaCreateIx(owner, userAta, owner, quote.swiftInputContract, tokenProgramId));
      const sysData = new Uint8Array(12);
      new DataView(sysData.buffer).setUint32(0, 2, true);
      sysData.set(mayanU64Le(quote.effectiveAmountIn64), 4);
      instructions.push(mayanSolIx(SOLANA_SWAP_NATIVE_TOKEN, [[owner, true, true], [userAta, false, true]], sysData));
      instructions.push(mayanSolIx(tokenProgramId, [[userAta, false, true]], new Uint8Array([17])));
    }
    const userAta = solanaAtaAddress(ownerPk, quote.swiftInputContract, tokenProgramId);
    instructions.push(mayanProxyWrap(mayanAtaCreateIx(owner, stateAccount, state.toBase58(), quote.swiftInputContract, tokenProgramId)));
    instructions.push(mayanProxyWrap(mayanSplTransferIx(userAta, stateAccount, owner, BigInt(quote.effectiveAmountIn64), tokenProgramId)));
    instructions.push(mayanProxyWrap(initIx));
  } else {
    const clientSwap = await fetchMayanSolanaClientSwap(quote, { userWallet: owner, userLedger: state.toBase58(), depositMode: "SWIFT" });
    if (!clientSwap.swapInstruction) throw new Error("Mayan's source-swap leg came back empty — refusing the route.");
    for (const ix of clientSwap.computeBudgetInstructions) instructions.push(ix);
    for (const ix of clientSwap.setupInstructions) instructions.push(mayanProxyWrap(ix));
    instructions.push(clientSwap.swapInstruction);
    if (clientSwap.cleanupInstruction) instructions.push(mayanProxyWrap(clientSwap.cleanupInstruction));
    instructions.push(mayanProxyWrap(initIx));
    lookupTableAddresses.push(...clientSwap.addressLookupTableAddresses);
  }
  return {
    instructions, extraSigners: [], lookupTableAddresses,
    targetAccount: stateAccount, state: state.toBase58(),
    amountInMin: amountInMin.toString(), randomKey: hex.encode(randomKey),
  };
}

function mayanCctpPda(seeds, programId) {
  return SolPublicKey.findProgramAddressSync(seeds, new SolPublicKey(programId))[0].toBase58();
}
/** The Fast MCTP ledger instruction data. Two layouts (bridge
 *  mode 1, order mode 2), ported field for field — note the
 *  field ORDER differs between them (the order layout carries
 *  refund fee + token-out + amount-out-min + deadline, and its
 *  mode byte sits mid-struct). The referrer is converted in
 *  the DESTINATION chain's form (Fast MCTP pays there). */
export function buildMayanFastMctpLedgerData(quote, { destinationAddress, randomKey16, amountInMin, feeSolana }) {
  const destName = quote.toChain;
  const referrer = mayanReferrerFor(quote);
  const head = [
    mayanAddressBytes(destinationAddress, destName),
    mayanU64Le(amountInMin),
    mayanU64Le(mayanFractionalAmount(quote.gasDrop, Math.min(mayanGasDecimals(destName), 8))),
    mayanU64Le(quote.redeemRelayerFee64), // feeRedeem
  ];
  const refBytes = referrer ? mayanAddressBytes(referrer, destName) : new Uint8Array(32);
  const u32le = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, Number(v), true); return b; };
  let parts;
  if (quote.hasAuction) {
    const tokenOut = String(quote.toToken.contract) === MAYAN_ZERO_ADDRESS
      ? mayanAddressBytes(SOLANA_SWAP_NATIVE_TOKEN, "solana") : mayanAddressBytes(quote.toToken.contract, destName);
    parts = [
      mayanAnchorDisc("init_order_ledger"), ...head,
      mayanU64Le(quote.refundRelayerFee64), // feeRefund
      mayanU64Le(feeSolana),
      u32le(MAYAN_CCTP_DOMAINS[destName]),
      mayanU16Le(randomKey16),
      new Uint8Array([2]), // mode: order
      tokenOut,
      mayanU64Le(mayanFractionalAmount(quote.minAmountOut, Math.min(8, Number(quote.toToken.decimals)))),
      mayanU64Le(quote.deadline64),
      refBytes,
      new Uint8Array([Number(quote.referrerBps) || 0]),
      mayanU64Le(quote.circleMaxFee64),
      u32le(quote.fastMctpMinFinality),
    ];
  } else {
    parts = [
      mayanAnchorDisc("init_bridge_ledger"), ...head,
      mayanU64Le(feeSolana),
      u32le(MAYAN_CCTP_DOMAINS[destName]),
      refBytes,
      new Uint8Array([Number(quote.referrerBps) || 0]),
      mayanU16Le(randomKey16),
      mayanU64Le(quote.circleMaxFee64),
      u32le(quote.fastMctpMinFinality),
      new Uint8Array([1]), // mode: bridge
    ];
  }
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return buf;
}
/** The 19-account CCTP v2 trigger instruction (bridge /
 *  create_order): every account derived here from Circle's
 *  published PDA seeds; the only extra signer is the ephemeral
 *  message account, created fresh per execution. */
function buildMayanCctpTriggerIx(quote, { ledger, ledgerAccount, owner, feeSolana, cctpMessage }) {
  const mint = quote.fastMctpInputContract;
  const destDomain = MAYAN_CCTP_DOMAINS[quote.toChain];
  const ledgerBytes = base58.decode(ledger);
  const ownerBytes = base58.decode(owner);
  const core = MAYAN_CCTP_V2_CORE_PROGRAM, tokenP = MAYAN_CCTP_V2_TOKEN_PROGRAM;
  const ascii = (s) => new TextEncoder().encode(s);
  const relayerAccount = feeSolana > 0n
    ? solanaAtaAddress(new SolPublicKey(owner), mint, SOLANA_PROGRAMS.token)
    : MAYAN_FAST_MCTP_PROGRAM; // no Solana relayer fee: the program itself stands in (the SDK's shape)
  const accounts = [
    [ledger, false, !quote.hasAuction], // writable for bridge, read-only for create_order
    [ledgerAccount, false, true],
    [owner, true, true], // relayer = the user
    [relayerAccount, false, true],
    [mint, false, true],
    [mayanCctpPda([ascii("denylist_account"), ownerBytes], tokenP), false, false], // realDenyListAccount (the trader's)
    [mayanCctpPda([ascii("sender_authority")], tokenP), false, false],
    [mayanCctpPda([ascii("denylist_account"), ledgerBytes], tokenP), false, false], // cctpDenyListAccount (the ledger's)
    [mayanCctpPda([ascii("token_messenger")], tokenP), false, false],
    [mayanCctpPda([ascii("remote_token_messenger"), ascii(String(destDomain))], tokenP), false, false],
    [mayanCctpPda([ascii("token_minter")], tokenP), false, false],
    [mayanCctpPda([ascii("local_token"), base58.decode(mint)], tokenP), false, true],
    [mayanCctpPda([ascii("__event_authority")], tokenP), false, false],
    [mayanCctpPda([ascii("message_transmitter")], core), false, true],
    [cctpMessage, true, true],
    [core, false, false],
    [tokenP, false, false],
    [SOLANA_PROGRAMS.token, false, false],
    [SOLANA_SWAP_NATIVE_TOKEN, false, false],
  ];
  return mayanSolIx(MAYAN_FAST_MCTP_PROGRAM, accounts, mayanAnchorDisc(quote.hasAuction ? "create_order" : "bridge"));
}
/** Assemble a Solana-source Fast MCTP route's instructions.
 *  Direct: fund the ledger account with exactly the quoted
 *  USDC, write the ledger, then fire the CCTP trigger in the
 *  same transaction. Source-swap: the Jupiter leg pays the
 *  ledger account and the ledger alone is written — the
 *  relayer submits the burn itself, funded by the Solana
 *  relayer fee the ledger records (the protocol's own split
 *  of labour, replicated faithfully). */
export async function buildMayanSolanaFastMctpInstructions(route, owner) {
  const quote = route.mayan.quote;
  const destination = route.mayan.destinationAddress;
  const mint = quote.fastMctpInputContract;
  const ownerPk = new SolPublicKey(owner);
  const randomKey16 = Math.floor(Math.random() * 65536);
  const ledger = SolPublicKey.findProgramAddressSync(
    [new TextEncoder().encode(quote.hasAuction ? "LEDGER_ORDER" : "LEDGER_BRIDGE"), ownerPk.toBytes(), mayanU16Le(randomKey16)],
    new SolPublicKey(MAYAN_FAST_MCTP_PROGRAM))[0];
  const ledgerAccount = solanaAtaAddress(ledger, mint, SOLANA_PROGRAMS.token);
  const needsSwap = route.mayan.needsSwap;
  const feeSolana = needsSwap ? BigInt(quote.solanaRelayerFee64 || 0) : 0n;
  const amountInMin = needsSwap ? mayanFractionalAmount(quote.minMiddleAmount, 6) : BigInt(quote.effectiveAmountIn64);
  const ledgerData = buildMayanFastMctpLedgerData(quote, { destinationAddress: destination, randomKey16, amountInMin, feeSolana });
  const ledgerIx = mayanSolIx(MAYAN_FAST_MCTP_PROGRAM, quote.hasAuction
    ? [[owner, true, true], [ledger.toBase58(), false, true], [owner, true, true], [ledgerAccount, false, false], [mint, false, false], [SOLANA_SWAP_NATIVE_TOKEN, false, false]]
    : [[owner, true, true], [ledger.toBase58(), false, true], [owner, true, true], [ledgerAccount, false, false], [MAYAN_FAST_MCTP_PROGRAM, false, false], [mint, false, false], [SOLANA_SWAP_NATIVE_TOKEN, false, false]],
    ledgerData);
  const instructions = [];
  const lookupTableAddresses = [MAYAN_LOOKUP_TABLE];
  const extraSigners = [];
  if (!needsSwap) {
    if (Number(quote.suggestedPriorityFee) > 0) instructions.push(mayanComputeUnitPriceIx(Number(quote.suggestedPriorityFee)));
    const userAta = solanaAtaAddress(ownerPk, mint, SOLANA_PROGRAMS.token);
    instructions.push(mayanProxyWrap(mayanAtaCreateIx(owner, ledgerAccount, ledger.toBase58(), mint, SOLANA_PROGRAMS.token)));
    instructions.push(mayanProxyWrap(mayanSplTransferIx(userAta, ledgerAccount, owner, BigInt(quote.effectiveAmountIn64), SOLANA_PROGRAMS.token)));
    instructions.push(mayanProxyWrap(ledgerIx));
    const cctpMessage = SolKeypair.generate();
    extraSigners.push(cctpMessage);
    instructions.push(mayanProxyWrap(buildMayanCctpTriggerIx(quote, {
      ledger: ledger.toBase58(), ledgerAccount, owner, feeSolana, cctpMessage: cctpMessage.publicKey.toBase58(),
    })));
  } else {
    const clientSwap = await fetchMayanSolanaClientSwap(quote, {
      userWallet: owner, userLedger: ledger.toBase58(),
      depositMode: quote.hasAuction ? "FAST_MCTP_ORDER" : "FAST_MCTP_BRIDGE",
    });
    if (!clientSwap.swapInstruction) throw new Error("Mayan's source-swap leg came back empty — refusing the route.");
    for (const ix of clientSwap.computeBudgetInstructions) instructions.push(ix);
    for (const ix of clientSwap.setupInstructions) instructions.push(mayanProxyWrap(ix));
    instructions.push(clientSwap.swapInstruction);
    if (clientSwap.cleanupInstruction) instructions.push(mayanProxyWrap(clientSwap.cleanupInstruction));
    instructions.push(mayanProxyWrap(ledgerIx));
    lookupTableAddresses.push(...clientSwap.addressLookupTableAddresses);
  }
  return {
    instructions, extraSigners, lookupTableAddresses,
    targetAccount: ledgerAccount, ledger: ledger.toBase58(),
    amountInMin: amountInMin.toString(), randomKey16,
  };
}
export async function buildMayanSolanaInstructions(route, owner) {
  return route.mayan.routeType === "SWIFT"
    ? buildMayanSolanaSwiftInstructions(route, owner)
    : buildMayanSolanaFastMctpInstructions(route, owner);
}

/** Decode a Jupiter V6 swap instruction's amount arguments
 *  (the two V2 discriminators — the only ones Mayan's own
 *  decoder accepts): { inAmount, quotedOut, slippageBps,
 *  platformFeeBps } or null for anything else. The containment
 *  rule for a Mayan DEPOSIT leg: the swap may consume at most
 *  the quoted input, and its platform fee must be ZERO — on
 *  deposit routes the referrer fee is taken by the bridge
 *  contract itself (feeRateRef, verified in the init/ledger
 *  data), so a Jupiter platform fee would be a second,
 *  undisclosed fee taken from the user's middle amount.
 *  (Mayan's own client asserts platform fee == referrerBps
 *  only on MONO-CHAIN swaps, where the Jupiter fee IS the
 *  collection mechanism; live deposit legs carry 0.) No
 *  output floor is asserted here by design: the amount the
 *  order needs is demanded by the init/ledger instruction
 *  itself from the state/ledger account's balance, so an
 *  under-delivering swap fails the whole transaction
 *  atomically — the guarantee lives on-chain, not in this
 *  decode (and Mayan's server sets the middle minimum above
 *  the leg's own slippage floor, so asserting one here would
 *  refuse live, valid legs). */
export function decodeMayanJupiterSwapArgs(dataBytes, quote) {
  if (!dataBytes || dataBytes.length < 28) return null;
  const disc = hex.encode(dataBytes.slice(0, 8));
  const u64 = (o) => new DataView(dataBytes.buffer, dataBytes.byteOffset + o, 8).getBigUint64(0, true);
  const u16 = (o) => new DataView(dataBytes.buffer, dataBytes.byteOffset + o, 2).getUint16(0, true);
  let inAmount, quotedOut, slippageBps, platformFeeBps;
  if (disc === "bb64facc31c4af14") { // routeV2
    inAmount = u64(8); quotedOut = u64(16); slippageBps = u16(24); platformFeeBps = u16(26);
  } else if (disc === "d19853937cfed8e9") { // sharedAccountsRouteV2
    inAmount = u64(9); quotedOut = u64(17); slippageBps = u16(25); platformFeeBps = u16(27);
  } else return null;
  if (inAmount > BigInt(quote.effectiveAmountIn64)) return null;
  if (platformFeeBps !== 0) return null;
  return { inAmount, quotedOut, slippageBps, platformFeeBps };
}
/** The account index at which a Jupiter V6 instruction names
 *  its destination token account, by discriminator (Mayan's
 *  own containment table): the swap leg must pay exactly the
 *  order's state / ledger account at that index. */
export function mayanJupiterDestAccountIndex(discHex) {
  switch (discHex) {
    case "d19853937cfed8e9": return 5; // sharedAccountsRouteV2
    case "bb64facc31c4af14": return 7; // routeV2
    default: return -1;
  }
}
const mayanReadU64Le = (bytes, off) => new DataView(bytes.buffer, bytes.byteOffset + off, 8).getBigUint64(0, true);
const mayanReadU32Le = (bytes, off) => new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(0, true);
const mayanReadU16Le = (bytes, off) => new DataView(bytes.buffer, bytes.byteOffset + off, 2).getUint16(0, true);
const mayanBytesEq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Bounds-check a built Solana Mayan instruction set BEFORE
 *  anything is signed. Every (CPI-proxy-unwrapped) instruction
 *  must call a pinned program; token movements are contained
 *  to exactly the quoted amount into the order's state /
 *  ledger account; the core order instruction's data is
 *  decoded and every field verified against the quote —
 *  including re-deriving the Swift state PDA from the order
 *  hash of the DECODED fields, and the Fast MCTP ledger PDA
 *  from its decoded key; a server-built swap leg must target
 *  the Jupiter program Fluid already trusts, decode to
 *  contained amounts, and pay the order account; and the only
 *  signers are the user and the CCTP message account. */
export function checkMayanSolanaSwapBounds(route, built, owner) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this route: " + m + " Pick another route." });
  const m = route?.mayan, quote = m?.quote;
  if (route?.provider !== "mayan" || !quote) return refuse("this is not a Mayan route.");
  if (m.fromChainName !== "solana") return refuse("an EVM payload rode on a Solana-source route check.");
  if (!built || !Array.isArray(built.instructions) || !built.instructions.length || !built.targetAccount)
    return refuse("the Mayan route built no instructions to inspect.");
  const target = built.targetAccount;
  const extraSigners = new Set((built.extraSigners || []).map(kp => kp.publicKey.toBase58()));
  const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
  const ALLOWED = new Set([MAYAN_SWIFT_V2_PROGRAM, MAYAN_FAST_MCTP_PROGRAM, JUPITER_AGGREGATOR_PROGRAM,
    SOLANA_PROGRAMS.token, SOLANA_PROGRAMS.token2022, SOLANA_PROGRAMS.ata, SOLANA_SWAP_NATIVE_TOKEN, COMPUTE_BUDGET]);
  const nativeInput = String(route.fromToken.address) === SOLANA_SWAP_NATIVE_TOKEN;
  // The user's own account for the token being sold. On a
  // direct path that token IS the route's input contract, so
  // the quote's declared token standard names its program;
  // Fast MCTP's input is always classic-token USDC.
  const inputProgram = quote.type === "SWIFT" && quote.swiftInputContractStandard === "spl2022"
    ? SOLANA_PROGRAMS.token2022 : SOLANA_PROGRAMS.token;
  const userInputAta = solanaAtaAddress(new SolPublicKey(owner), quote.fromToken.contract, inputProgram);
  let coreCount = 0, fundingSeen = false, swapSeen = false;
  for (const rawIx of built.instructions) {
    const ix = mayanProxyUnwrap(rawIx);
    const pid = ix.programId;
    if (!ALLOWED.has(pid)) return refuse(`an instruction calls ${pid}, which is not one of Mayan's pinned programs (a different aggregator's swap leg is never signed).`);
    for (const a of ix.accounts || []) {
      if (a.isSigner && a.pubkey !== owner && !extraSigners.has(a.pubkey))
        return refuse("an instruction asks an account other than you (or the swap's own message account) to sign.");
    }
    const data = base64.decode(ix.data || "");
    if (pid === COMPUTE_BUDGET) {
      if (data[0] === 3 && mayanReadU64Le(data, 1) > 100000000n) return refuse("the compute-unit price is beyond any sane bound.");
      continue;
    }
    if (pid === SOLANA_PROGRAMS.ata) {
      // Create (0), CreateIdempotent (1), or the empty-data
      // form the ATA program itself treats as Create.
      if (!((data.length === 0 || data[0] === 0 || data[0] === 1)) || (ix.accounts || []).length < 6) return refuse("an associated-token instruction is not a plain create.");
      const ataOwnerAcc = ix.accounts[2].pubkey;
      if (![owner, built.state, built.ledger].includes(ataOwnerAcc))
        return refuse("an associated-token account would be created for someone other than you or the order itself.");
      const expect = solanaAtaAddress(new SolPublicKey(ataOwnerAcc), ix.accounts[3].pubkey, ix.accounts[5].pubkey);
      if (ix.accounts[1].pubkey !== expect) return refuse("an associated-token account is not the account it claims to create.");
      continue;
    }
    if (pid === SOLANA_PROGRAMS.token || pid === SOLANA_PROGRAMS.token2022) {
      if (data[0] === 3) { // Transfer
        const amount = mayanReadU64Le(data, 1);
        const src = ix.accounts[0]?.pubkey, dst = ix.accounts[1]?.pubkey, authority = ix.accounts[2]?.pubkey;
        if (dst === target) {
          if (amount !== BigInt(quote.effectiveAmountIn64)) return refuse("the transfer into the order does not move exactly the quoted amount.");
          if (src !== userInputAta || authority !== owner) return refuse("the order is funded from an account that is not your own token account.");
          fundingSeen = true;
        } else if (authority === owner) {
          return refuse("a token transfer moves your funds somewhere other than the order account.");
        }
      } else if (data[0] === 17) { // SyncNative — only on the user's own wrapped-SOL account
        if (ix.accounts[0]?.pubkey !== userInputAta) return refuse("a SyncNative targets an account that is not your wrapped-SOL account.");
      } else if (data[0] === 9) { // CloseAccount — proceeds must return to the user
        if (ix.accounts[1]?.pubkey !== owner) return refuse("a token account would be closed to someone other than you.");
      } else if (data[0] === 1 || data[0] === 16 || data[0] === 18) { // InitializeAccount{,2,3} — only for the user's input account or the order account
        if (![userInputAta, target].includes(ix.accounts[0]?.pubkey)) return refuse("a token account would be initialised for an account outside this swap.");
      } else return refuse("an unrecognised token instruction rides in this swap.");
      continue;
    }
    if (pid === SOLANA_SWAP_NATIVE_TOKEN) { // System: only the native wrap transfer
      if (!nativeInput) return refuse("a System transfer rides in a swap whose input is not native SOL.");
      if (data.length !== 12 || mayanReadU32Le(data, 0) !== 2) return refuse("an unrecognised System instruction rides in this swap.");
      if (mayanReadU64Le(data, 4) !== BigInt(quote.effectiveAmountIn64)) return refuse("the SOL wrap does not move exactly the quoted amount.");
      if (ix.accounts[0]?.pubkey !== owner || ix.accounts[1]?.pubkey !== userInputAta) return refuse("the SOL wrap moves funds between accounts that are not yours.");
      continue;
    }
    if (pid === JUPITER_AGGREGATOR_PROGRAM) {
      if (!decodeMayanJupiterSwapArgs(data, quote)) return refuse("the source-swap leg's amounts or fee disagree with the quote (or its shape is one Fluid does not validate).");
      const destIdx = mayanJupiterDestAccountIndex(hex.encode(data.slice(0, 8)));
      if (destIdx < 0 || ix.accounts?.[destIdx]?.pubkey !== target) return refuse("the source-swap leg does not pay the order account.");
      swapSeen = true;
      continue;
    }
    if (pid === MAYAN_SWIFT_V2_PROGRAM) {
      coreCount++;
      if (data.length !== 198 || !mayanBytesEq(data.slice(0, 8), mayanAnchorDisc("init_order")))
        return refuse("the Swift init instruction is not the order layout its quote describes.");
      const rd64 = (o) => mayanReadU64Le(data, o);
      if (String(rd64(8)) !== String(built.amountInMin)) return refuse("the Swift order's locked minimum disagrees with its build.");
      const destBytes = mayanAddressBytes(m.destinationAddress, m.toChainName);
      if (!mayanBytesEq(data.slice(25, 57), destBytes)) return refuse("the Swift order pays a different destination than the swap's.");
      if (mayanReadU16Le(data, 57) !== MAYAN_WORMHOLE_IDS[m.toChainName]) return refuse("the Swift order names a different destination chain than the swap's.");
      const tokenOutBytes = hex.decode(mayanSwiftTokenOutHex(quote).slice(2));
      if (!mayanBytesEq(data.slice(59, 91), tokenOutBytes)) return refuse("the Swift order buys a different token than the swap's.");
      if (rd64(91) !== mayanFractionalAmount(quote.minAmountOut, Math.min(Number(quote.toToken.decimals), 8))) return refuse("the Swift order's minimum received disagrees with the quote.");
      if (rd64(107) !== BigInt(quote.cancelRelayerFee64) || rd64(115) !== BigInt(quote.refundRelayerFee64)) return refuse("the Swift order's relayer fees disagree with the quote.");
      if (rd64(123) !== BigInt(quote.deadline64)) return refuse("the Swift order's deadline disagrees with the quote.");
      const referrer = mayanReferrerFor(quote);
      const refBytes = referrer ? mayanAddressBytes(referrer, "solana") : new Uint8Array(32);
      if (!mayanBytesEq(data.slice(131, 163), refBytes)) return refuse("the Swift order pays its referrer fee to an unexpected address.");
      if (data[163] !== (Number(quote.referrerBps) || 0)) return refuse("the Swift order's referrer rate is not the quoted rate.");
      // Re-derive the order hash from the decoded fields and
      // require the state account in the instruction to be
      // exactly that order's PDA — the account the funds lock
      // into is the order the quote describes, no other.
      const orderHash = computeMayanSwiftOrderHash(quote, {
        swapperAddress: owner, destinationAddress: m.destinationAddress,
        randomKey: data.slice(166, 198),
      });
      const state = mayanSwiftStatePda(orderHash, MAYAN_WORMHOLE_IDS[m.toChainName]).toBase58();
      if (ix.accounts[2]?.pubkey !== state || state !== built.state) return refuse("the Swift order's state account is not the order its quote describes.");
      if (ix.accounts[3]?.pubkey !== target) return refuse("the Swift order's token account is not the account the funds lock into.");
      continue;
    }
    if (pid === MAYAN_FAST_MCTP_PROGRAM) {
      if (data.length === 8) { // the CCTP trigger
        const wantDisc = mayanAnchorDisc(quote.hasAuction ? "create_order" : "bridge");
        if (!mayanBytesEq(data, wantDisc)) return refuse("the Fast MCTP trigger is not the instruction its quote describes.");
        if ((ix.accounts || []).length !== 19) return refuse("the Fast MCTP trigger's account list is not the CCTP shape.");
        if (ix.accounts[0]?.pubkey !== built.ledger) return refuse("the Fast MCTP trigger names a different ledger than the order's.");
        if (!extraSigners.has(ix.accounts[14]?.pubkey)) return refuse("the Fast MCTP trigger's message account is not the swap's own ephemeral signer.");
        if (ix.accounts[15]?.pubkey !== MAYAN_CCTP_V2_CORE_PROGRAM || ix.accounts[16]?.pubkey !== MAYAN_CCTP_V2_TOKEN_PROGRAM)
          return refuse("the Fast MCTP trigger does not call Circle's pinned CCTP v2 programs.");
      } else {
        coreCount++;
        const isOrder = !!quote.hasAuction;
        if (data.length !== (isOrder ? 180 : 124) || !mayanBytesEq(data.slice(0, 8), mayanAnchorDisc(isOrder ? "init_order_ledger" : "init_bridge_ledger")))
          return refuse("the Fast MCTP ledger instruction is not the layout its quote describes.");
        const rd64 = (o) => mayanReadU64Le(data, o);
        const destBytes = mayanAddressBytes(m.destinationAddress, m.toChainName);
        if (!mayanBytesEq(data.slice(8, 40), destBytes)) return refuse("the Fast MCTP ledger pays a different destination than the swap's.");
        if (String(rd64(40)) !== String(built.amountInMin)) return refuse("the Fast MCTP ledger's amount disagrees with its build.");
        if (rd64(56) !== BigInt(quote.redeemRelayerFee64)) return refuse("the Fast MCTP ledger's redeem fee disagrees with the quote.");
        const feeSolanaAt = isOrder ? 72 : 64;
        const wantFeeSolana = m.needsSwap ? BigInt(quote.solanaRelayerFee64 || 0) : 0n;
        if (rd64(feeSolanaAt) !== wantFeeSolana) return refuse("the Fast MCTP ledger's Solana relayer fee disagrees with the quote.");
        const domainAt = isOrder ? 80 : 72;
        if (mayanReadU32Le(data, domainAt) !== MAYAN_CCTP_DOMAINS[m.toChainName]) return refuse("the Fast MCTP ledger names a different destination domain than the swap's.");
        const keyAt = isOrder ? 84 : 109;
        const keyRnd = mayanReadU16Le(data, keyAt);
        const ledgerPda = SolPublicKey.findProgramAddressSync(
          [new TextEncoder().encode(isOrder ? "LEDGER_ORDER" : "LEDGER_BRIDGE"), base58.decode(owner), mayanU16Le(keyRnd)],
          new SolPublicKey(MAYAN_FAST_MCTP_PROGRAM))[0].toBase58();
        if (ledgerPda !== built.ledger || ix.accounts[1]?.pubkey !== ledgerPda) return refuse("the Fast MCTP ledger account is not the order its quote describes.");
        if (ix.accounts[3]?.pubkey !== target) return refuse("the Fast MCTP ledger's token account is not the account the funds lock into.");
        const referrer = mayanReferrerFor(quote);
        const refAt = isOrder ? 135 : 76;
        const refBytes = referrer ? mayanAddressBytes(referrer, m.toChainName) : new Uint8Array(32);
        if (!mayanBytesEq(data.slice(refAt, refAt + 32), refBytes)) return refuse("the Fast MCTP ledger pays its referrer fee to an unexpected address.");
        const bpsAt = isOrder ? 167 : 108;
        if (data[bpsAt] !== (Number(quote.referrerBps) || 0)) return refuse("the Fast MCTP ledger's referrer rate is not the quoted rate.");
        const maxFeeAt = isOrder ? 168 : 111;
        if (rd64(maxFeeAt) !== BigInt(quote.circleMaxFee64)) return refuse("the Fast MCTP ledger's Circle fee cap disagrees with the quote.");
        if (isOrder) {
          if (data[86] !== 2) return refuse("the Fast MCTP ledger's mode is not an order.");
          if (rd64(64) !== BigInt(quote.refundRelayerFee64)) return refuse("the Fast MCTP order's refund fee disagrees with the quote.");
          const tokenOutBytes = String(quote.toToken.contract) === MAYAN_ZERO_ADDRESS
            ? mayanAddressBytes(SOLANA_SWAP_NATIVE_TOKEN, "solana") : mayanAddressBytes(quote.toToken.contract, m.toChainName);
          if (!mayanBytesEq(data.slice(87, 119), tokenOutBytes)) return refuse("the Fast MCTP order buys a different token than the swap's.");
          if (rd64(119) !== mayanFractionalAmount(quote.minAmountOut, Math.min(8, Number(quote.toToken.decimals)))) return refuse("the Fast MCTP order's minimum received disagrees with the quote.");
          if (rd64(127) !== BigInt(quote.deadline64)) return refuse("the Fast MCTP order's deadline disagrees with the quote.");
        } else if (data[123] !== 1) return refuse("the Fast MCTP ledger's mode is not a bridge.");
      }
      continue;
    }
    return refuse("an instruction calls a program Fluid does not inspect.");
  }
  if (coreCount !== 1) return refuse("the swap does not contain exactly one Mayan order instruction.");
  if (!m.needsSwap && !fundingSeen) return refuse("no transfer funds the order with exactly the quoted amount.");
  if (m.needsSwap && !swapSeen) return refuse("a source-swap route carries no validated swap leg.");
  return { ok: true };
}
/** One lookup-table account, fetched and parsed (the address
 *  list begins after the 56-byte table metadata). */
async function mayanLookupTableAccount(address) {
  const info = await solanaRpc("getAccountInfo", [address, { encoding: "base64" }]);
  const raw = info?.value?.data?.[0];
  if (!raw) throw new Error("Mayan: a lookup table account could not be read.");
  const bytes = base64.decode(raw);
  if (bytes.length < 56 || (bytes.length - 56) % 32 !== 0) throw new Error("Mayan: a lookup table account did not parse.");
  const addresses = [];
  for (let off = 56; off + 32 <= bytes.length; off += 32) addresses.push(new SolPublicKey(bytes.slice(off, off + 32)));
  return new SolAddressLookupTableAccount({
    key: new SolPublicKey(address),
    state: { deactivationSlot: BigInt("18446744073709551615"), lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses },
  });
}
/** Execute a Mayan route the sheet approved. EVM sources:
 *  bounds-check the quote-time payload again, grant the
 *  Forwarder a classic exact-amount approval when the input
 *  is an ERC-20 (never a permit, never the API's own approval
 *  suggestion), and send. Solana sources: assemble the
 *  instruction set, bounds-check it, and sign a v0 transaction
 *  with the user's key (plus the CCTP message account on a
 *  direct Fast MCTP). Returns the source transaction hash in
 *  an array, like the other executors. */
export async function executeMayanSwapRoute(wallet, route, onProgress = () => {}, onApprove = null) {
  const gate = swapRouteExecutable(route);
  if (!gate.ok) throw new Error(gate.reason);
  if (route.mayan.fromChainName === "solana") {
    const phrase = wallet?.mnemonic?.phrase;
    if (!phrase) throw new Error("Mayan: the wallet's recovery phrase is unavailable.");
    const kp = solanaKeypair(phrase);
    const owner = kp.publicKey.toBase58();
    const built = await buildMayanSolanaInstructions(route, owner);
    const bounds = checkMayanSolanaSwapBounds(route, built, owner);
    if (!bounds.ok) throw new Error(bounds.reason);
    const tables = [];
    for (const addr of [...new Set(built.lookupTableAddresses)]) tables.push(await mayanLookupTableAccount(addr));
    const latest = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
    const blockhash = latest?.value?.blockhash;
    if (!blockhash) throw new Error("Mayan: no recent Solana blockhash.");
    const message = new SolTransactionMessage({
      payerKey: kp.publicKey, recentBlockhash: blockhash,
      instructions: built.instructions.map(ix => new SolTxInstruction({
        programId: new SolPublicKey(ix.programId),
        keys: ix.accounts.map(a => ({ pubkey: new SolPublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
        data: Buffer.from(base64.decode(ix.data)),
      })),
    }).compileToV0Message(tables);
    const tx = new SolVersionedTransaction(message);
    tx.sign([kp, ...built.extraSigners]);
    const sig = await solanaBroadcast(tx.serialize(), "Mayan swap");
    onProgress("Mayan swap sent ✓");
    return [sig];
  }
  const bounds = checkMayanEvmTxBounds(route, route.mayan.tx, wallet.address);
  if (!bounds.ok) throw new Error(bounds.reason);
  const fromKey = Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === Number(route.fromChainId));
  const provider = await providerFor(fromKey);
  const signer = wallet.connect(provider);
  const fromContract = route.mayan.quote.fromToken.contract;
  if (String(fromContract).toLowerCase() !== MAYAN_ZERO_ADDRESS) {
    const token = new ethers.Contract(fromContract, ERC20_ABI, signer);
    const need = BigInt(route.fromAmount);
    const current = await token.allowance(wallet.address, MAYAN_FORWARDER);
    if (current < need) {
      const atx = await token.approve(MAYAN_FORWARDER, need);
      onApprove?.({ hash: atx.hash, spender: MAYAN_FORWARDER, amount: need.toString() });
      await atx.wait();
    }
  }
  const txr = await signer.sendTransaction({ to: route.mayan.tx.to, data: route.mayan.tx.data, value: BigInt(route.mayan.tx.value || "0") });
  onProgress("Mayan swap sent ✓");
  return [txr.hash];
}

/** The incumbent route search — Satora, Jupiter, Across,
 *  Relay, LI.FI, in the order this dispatcher has always used.
 *  getSwapRoutes (below) wraps it with Mayan's ranked
 *  candidacy; for pairs Mayan does not contest this function
 *  IS the search, byte for byte as before. */
async function getSwapRoutesCascade(args) {
  // Satora serves the destinations nobody else in this dispatcher
  // can — Bitcoin mainnet and Lightning, from USDC/USDT on
  // Arbitrum, Polygon or Ethereum. Its pairs never overlap the
  // other routers' (swapChainOf deliberately returns null for
  // bitcoin/lightning, so LI.FI cannot quote them and Relay does
  // not list them), so quoting it first here changes nothing for
  // any existing pair. A minimum or pair-limit refusal is marked
  // satoraTerminal and propagates: it is the honest answer for
  // these destinations, and falling through would only replace it
  // with LI.FI's "unknown network". Any other Satora failure falls
  // through to the normal order below.
  if (satoraSupportsPair(args)) {
    try {
      const route = await getSatoraSwapRoute(args);
      if (route) return [route];
    } catch (e) {
      if (e && e.satoraTerminal) throw e;
      /* Satora failed or is on an unknown version — fall through */
    }
  }
  // Jupiter serves Solana → Solana pairs directly (its own
  // liquidity, no reseller layer). Its pairs never overlap the
  // other routers' best lanes: Across and Relay do not source
  // Solana at all in Fluid, and LI.FI — the fallback below — is
  // what used to serve them. Any Jupiter failure (throttle,
  // unusable quote, refused instructions) falls through to the
  // unchanged order below.
  if (jupiterSupportsPair(args)) {
    try {
      const route = await getJupiterSwapRoute(args);
      if (route) return [route];
    } catch { /* Jupiter failed or throttled — LI.FI below is the Solana fallback */ }
  }
  if (acrossSupportsPair(args)) {
    try {
      const route = await getAcrossSwapRoute(args);
      if (route) return [route];
    } catch { /* Across failed, throttled or refused the quote — Relay below */ }
  }
  if (relaySupportsPair(args.fromChainKey, args.toChainKey)) {
    try {
      const route = await getRelaySwapRoute(args);
      if (route) return [route];
    } catch { /* Relay failed or has no route — LI.FI below is the fallback */ }
  }
  return getLifiSwapRoutes(args);
}
/** The one route search the swap sheet calls. Cheapest route
 *  wins. For pairs Mayan does not contest (mayanSupportsPair),
 *  this is exactly the incumbent cascade above — no Mayan call
 *  is made at all. For contested pairs, Mayan's live quote is
 *  fetched alongside the cascade's answer and the two compete
 *  in rankSwapRoutes — the dispatcher's own ordering by net
 *  USD value (destination amount minus gas; the route cost and
 *  Fluid's fee under the law are already inside the quoted
 *  amounts on both sides). THE OWNER'S RULE, enforced here at
 *  runtime: the Mayan route is offered ONLY when it ranks
 *  first. When it loses, the incumbent's routes are returned
 *  untouched — Mayan is a ranked candidate, never a priority,
 *  so its integration can never make an existing swap worse.
 *  A Mayan failure (outage, unusable quote, unverifiable
 *  payload) likewise just removes the candidate; the cascade's
 *  own failure still surfaces when nothing can serve. */
export async function getSwapRoutes(args) {
  if (!mayanSupportsPair(args)) return getSwapRoutesCascade(args);
  let incumbent = null, incumbentError = null;
  try { incumbent = await getSwapRoutesCascade(args); } catch (e) { incumbentError = e; }
  let mayan = null;
  try { mayan = await getMayanSwapRoute(args); } catch { mayan = null; }
  if (mayan) {
    const candidates = [mayan, ...(incumbent || [])];
    const ranked = rankSwapRoutes(candidates, null);
    if (ranked[0] && ranked[0].provider === "mayan") return ranked;
    if (incumbent && incumbent.length) return incumbent;
    return ranked;
  }
  if (incumbent && incumbent.length) return incumbent;
  if (incumbentError) throw incumbentError;
  return incumbent || [];
}
/** Bounds-check one Relay step item BEFORE anything is signed (the
 *  Relay twin of checkSwapStepBounds). Relay builds complete
 *  transactions; Fluid signs only a transaction that is exactly the
 *  trade the user approved:
 *   - it must be FROM the user's own address, on the route's origin
 *     chain, with hex calldata;
 *   - an approve step must call approve() on the FROM-TOKEN contract
 *     itself, naming the deposit step's contract as spender, for
 *     EXACTLY the route's fromAmount — an unlimited or inflated
 *     approval is refused, always;
 *   - a non-approve step must never target the token being sold
 *     (the LI.FI M1 lesson) and must carry value only when the sold
 *     asset is the chain's native coin — and then exactly fromAmount. */
export function checkRelayStepBounds(route, step, item, owner) {
  const refuse = (m) => ({ ok: false, reason: "Fluid refused this route: " + m + " Pick another route." });
  const data = item?.data;
  if (!data) return refuse("a Relay step carried no transaction to inspect.");
  if (!owner || String(data.from || "").toLowerCase() !== String(owner).toLowerCase())
    return refuse("a Relay step was built for a different account than yours.");
  if (Number(data.chainId) !== Number(route?.relay?.originChainId))
    return refuse("a Relay step targeted a different chain than the swap's source.");
  if (typeof data.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(data.data) || data.data.length < 10)
    return refuse("a Relay step carried calldata Fluid couldn't inspect.");
  const fromToken = route?.fromToken;
  const isNative = !fromToken?.address || /^0x0{40}$/i.test(fromToken.address);
  let value = null;
  try { value = BigInt(data.value ?? "0"); } catch { return refuse("a Relay step carried an unreadable value."); }
  if (step?.id === "approve") {
    if (isNative) return refuse("a Relay route asked for a token approval on a native-coin swap.");
    if (String(data.to || "").toLowerCase() !== String(fromToken.address).toLowerCase())
      return refuse("a Relay approval targeted a contract that is not the token being sold.");
    let decoded = null;
    try { decoded = new ethers.Interface(SWAP_ERC20).decodeFunctionData("approve", data.data); }
    catch { return refuse("a Relay approval step's calldata did not decode as an ERC-20 approval."); }
    const spender = decoded?.[0], amount = decoded?.[1];
    const depositTo = (route.relay.steps || [])
      .filter(s => s && s.id !== "approve")
      .flatMap(s => (s.items || []).map(it => it?.data?.to))
      .find(t => typeof t === "string" && t);
    if (!depositTo || String(spender || "").toLowerCase() !== String(depositTo).toLowerCase())
      return refuse("a Relay approval was addressed to an unexpected spender, not the swap's deposit contract.");
    let want = null;
    try { want = BigInt(route.fromAmount); } catch { want = null; }
    if (want == null || amount == null || BigInt(amount) !== want)
      return refuse("a Relay approval asked for more than the exact amount being swapped.");
    if (value !== 0n) return refuse("a Relay approval step carried native value it should not have.");
    return { ok: true };
  }
  if (!ethers.isAddress(data.to || "")) return refuse("a Relay step targeted an address Fluid couldn't verify.");
  if (!isNative && String(data.to).toLowerCase() === String(fromToken.address).toLowerCase())
    return refuse("a Relay step targeted the token being sold instead of the swap's deposit contract.");
  if (isNative) {
    let want = null;
    try { want = BigInt(route.fromAmount); } catch { want = null; }
    if (want == null || value !== want)
      return refuse("a Relay step's value did not match the exact amount being swapped.");
  } else if (value !== 0n) {
    return refuse("a Relay step carried native value on a token swap.");
  }
  return { ok: true };
}
/** Execute a chosen Relay route: send each step's transaction in
 *  order from the user's wallet on the source chain, awaiting each
 *  receipt (Relay includes its own exact-amount approve step when
 *  one is needed — Fluid never improvises approvals). Every item is
 *  bounds-checked BEFORE it is signed (checkRelayStepBounds), and
 *  approvals are reported through onApprove exactly like LI.FI's, so
 *  the approvals screen keeps a complete record. EVM sources only;
 *  destination delivery is Relay's solver network, not a step. */
export async function executeRelaySwapRoute(wallet, route, onProgress = () => {}, onApprove = () => {}) {
  const fromKey = Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === Number(route?.relay?.originChainId));
  if (!fromKey) throw new Error("Relay swap source chain is not a Fluid network.");
  const { ok, steps, reason } = swapRouteExecutable(route);
  if (!ok) throw new Error(reason);
  const provider = providerFor(fromKey);
  const signer = wallet.connect(provider);
  const total = steps.reduce((s, st) => s + st.items.length, 0);
  const hashes = [];
  let n = 0;
  for (const step of steps) {
    for (const item of step.items) {
      const bounds = checkRelayStepBounds(route, step, item, wallet.address);
      if (!bounds.ok) throw new Error(bounds.reason);
      const data = item.data;
      n++;
      onProgress(step.id === "approve"
        ? `Approving ${route.fromToken?.symbol || "token"} for the route (exact amount only)…`
        : `Signing step ${n} of ${total}…`);
      const txReq = { to: data.to, data: data.data || "0x", value: data.value != null ? BigInt(data.value) : 0n };
      if (data.gas != null) { try { txReq.gasLimit = BigInt(data.gas); } catch { /* let the node estimate */ } }
      if (data.maxFeePerGas != null) { try { txReq.maxFeePerGas = BigInt(data.maxFeePerGas); } catch { /* node default */ } }
      if (data.maxPriorityFeePerGas != null) { try { txReq.maxPriorityFeePerGas = BigInt(data.maxPriorityFeePerGas); } catch { /* node default */ } }
      const tx = await signer.sendTransaction(txReq);
      hashes.push(tx.hash);
      if (step.id === "approve") {
        try {
          const decoded = new ethers.Interface(SWAP_ERC20).decodeFunctionData("approve", data.data);
          onApprove({ chainKey: fromKey, token: route.fromToken?.address, tokenSymbol: route.fromToken?.symbol || null, spender: decoded[0], amount: decoded[1].toString(), decimals: route.fromToken?.decimals ?? null, at: Date.now() });
        } catch { /* recording an approval must never break a swap */ }
      }
      onProgress(`Step ${n} sent — waiting for it to mine…`);
      await tx.wait();
    }
  }
  return hashes;
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
export function rankSwapRoutes(routes, toTokenPriceUsd = null) {
  const scored = (routes || []).map(r => {
    const gas = swapRouteGasUsd(r);
    const out = Number(r?.toAmountUSD);
    let netUsd = (Number.isFinite(out) ? out : 0) - gas;
    let usdMismatch = false;
    // RED-TEAM 2026-11-06 (Finding I): ranking and the CHEAPEST badge
    // trusted LI.FI's own toAmountUSD — a route delivering HALF the
    // tokens could badge itself cheapest by lying about the dollar
    // figure. When the caller supplies an independently sourced price
    // for the receive token, cross-check: a route whose claimed USD
    // value disagrees with amount × price by >20% is ranked by the
    // CORRECTED value, flagged, and cannot take the CHEAPEST badge.
    if (toTokenPriceUsd > 0 && r?.toAmount != null && r?.toToken?.decimals != null) {
      const expected = Number(swapRawToAmount(r.toAmount, r.toToken.decimals)) * toTokenPriceUsd;
      if (expected > 0 && (!Number.isFinite(out) || Math.abs(out - expected) / expected > 0.2)) {
        usdMismatch = true;
        netUsd = expected - gas;
      }
    }
    return {
      ...r,
      gasCostUSD: gas,
      netUsd,
      usdMismatch,
      durationSec: swapRouteDurationSec(r),
      cheapest: false, fastest: false,
    };
  });
  if (scored.length) {
    const honest = scored.filter(r => !r.usdMismatch);
    let best = honest[0] || null;
    for (const r of honest) if (!best || r.netUsd > best.netUsd || (r.netUsd === best.netUsd && r.durationSec < best.durationSec)) best = r;
    if (best) best.cheapest = true;
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
  // Satora routes (Bitcoin / Lightning destinations): executable
  // since 2026-11-09, when Satora published the Permit2 witness
  // specification — the gate is structural (a complete Satora
  // route object, as getSatoraSwapRoute builds it), and the
  // executor re-runs the FULL verification chain before signing:
  // the creation bounds check, the funding-component bounds
  // check, and the witness field-by-field verification
  // (buildSatoraPermitTypedData). A payload that drifts at any
  // step is refused there, never signed — the same posture as
  // the Across/Jupiter gates below.
  if (route?.provider === "satora") {
    const s = route.satora;
    const complete = !!s && (s.destKey === "bitcoin" || s.destKey === "lightning")
      && Number(route.fromChainId) > 0 && !!route.fromAmount && !!route.fromToken?.address;
    return complete
      ? { ok: true, satora: true }
      : { ok: false, reason: "This Satora route is incomplete — pick another route." };
  }
  // Relay routes (the primary router since 2026-11-08): executable
  // when their source is an EVM chain and every step is a complete
  // transaction Fluid can bounds-check and sign — see
  // relayExecutableSteps. Relay routes from a non-EVM source are
  // never produced by getSwapRoutes (their step shapes are not
  // audited payloads) and are refused here as defence in depth.
  if (route?.provider === "relay") {
    const steps = relayExecutableSteps(route);
    return steps.length
      ? { ok: true, relay: true, steps }
      : { ok: false, reason: "This Relay route's steps aren't signable by Fluid — pick another route." };
  }
  // Across routes (primary for same-asset EVM majors since
  // 2026-11-08): executable when the route carries its one deposit
  // transaction in decodable shape — the executor re-runs the full
  // deposit bounds check (checkAcrossDepositBounds) on the calldata
  // before signing, so this gate is structural, and a message shape
  // Fluid has not pinned never reaches it (parseAcrossQuote already
  // refused it at quote time).
  if (route?.provider === "across") {
    const steps = acrossExecutableSteps(route);
    return steps.length
      ? { ok: true, across: true, steps }
      : { ok: false, reason: "This Across route's deposit isn't signable by Fluid — pick another route." };
  }
  // Jupiter routes (primary for Solana same-chain since 2026-11-09):
  // executable when the route carries its decomposed swap
  // instruction — the executor re-runs the full bounds check
  // (checkJupiterSwapBounds) on the instruction set before
  // assembling and signing, so this gate is structural. Checked
  // BEFORE the LI.FI Solana branch below: a Jupiter route shares
  // the Solana chain id but carries no LI.FI steps.
  if (route?.provider === "jupiter") {
    return route.jupiter?.instructions?.swapInstruction
      ? { ok: true, jupiter: true }
      : { ok: false, reason: "This Jupiter route carries no swap instruction Fluid can sign — pick another route." };
  }
  // Mayan routes (ranked candidate since 2026-11-09): executable
  // when the route carries its verified quote — and, for an EVM
  // source, the bounds-checked Forwarder payload built at quote
  // time. The executors re-run the full bounds checks
  // (checkMayanEvmTxBounds / checkMayanSolanaSwapBounds) before
  // signing, so this gate is structural. Checked BEFORE the
  // LI.FI Solana branch below: a Mayan Solana-source route
  // shares the Solana chain id but carries no LI.FI steps.
  if (route?.provider === "mayan") {
    if (!route.mayan?.quote) return { ok: false, reason: "This Mayan route carries no quote Fluid can execute — pick another route." };
    if (route.mayan.fromChainName !== "solana" && !route.mayan.tx)
      return { ok: false, reason: "This Mayan route carries no transaction Fluid can sign — pick another route." };
    return { ok: true, mayan: true };
  }
  // Solana-sourced routes are signable since Phase 1b: the step payload
  // is a serialized transaction Fluid deserializes, signs with the
  // wallet's Solana key and broadcasts — see executeSolanaSwapRoute.
  if (Number(route?.fromChainId) === SOLANA_LIFI_CHAIN_ID) {
    const steps = solanaSwapSteps(route);
    return steps.length
      ? { ok: true, svm: true, steps }
      : { ok: false, reason: "This route's Solana steps carry no signable transaction — pick another route." };
  }
  // Sui-sourced routes are signable since the MVM signer landed
  // (2026-11-07): the payload is the step's serialized transaction,
  // which Fluid rebuilds against the chain and inspects in its BUILT
  // form — the exact bytes that get signed — before the wallet's Sui
  // key touches it — see executeSuiSwapRoute /
  // checkSuiSwapStepSafety. The shape was verified live the same day:
  // a real Cetus SUI→USDC quote's payload was rebuilt against the
  // chain and passed the inspection end to end.
  // Routes INTO Sui from an EVM chain are unaffected either way:
  // their signable steps are the EVM ones, and the bridge delivers to
  // the Sui address.
  if (Number(route?.fromChainId) === SUI_LIFI_CHAIN_ID) {
    const steps = suiSwapSteps(route);
    return steps.length
      ? { ok: true, mvm: true, steps }
      : { ok: false, reason: "This route's Sui steps carry no signable transaction — pick another route." };
  }
  // Tron-sourced routes are signable since the TVM signer landed
  // (2026-11-07): LI.FI's documented payload — the unsigned
  // TriggerSmartContract protobuf plus its TronWeb rendering — is
  // decoded and inspected byte-for-byte before the wallet signs its
  // txID — see executeTronSwapRoute / checkTronSwapStepBounds.
  if (Number(route?.fromChainId) === TRON_LIFI_CHAIN_ID) {
    const steps = tronSwapSteps(route);
    return steps.length
      ? { ok: true, tvm: true, steps }
      : { ok: false, reason: "This route's Tron steps carry no signable transaction — pick another route." };
  }
  // Fluid signs with an EVM key on EVM chains. Routes sourced from a
  // non-EVM family may carry steps, but their signatures are a
  // different scheme — they stay unexecutable here until that family's
  // signer lands, never faked.
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
const SOL_SYSTEM_PROGRAM = "11111111111111111111111111111111";
const SOL_TOKEN_PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
/* RED-TEAM 2026-11-06 (Finding B): the fee-payer check authenticates the
 * VICTIM, not the payload — a serialized "swap" transaction whose payer
 * is the user can still carry instructions that drain the user directly.
 * Aggregator-built swap transactions move the user's funds via CPI inside
 * the router program's OWN instructions; they never contain a top-level
 * SystemProgram transfer out of the user, nor a top-level SPL transfer /
 * approve / burn / close authorised by the user. Refuse those shapes:
 *   - SystemProgram instruction 2 (Transfer lamports)
 *   - SPL Token/Token-2022 instructions 3 (Transfer), 4 (Approve),
 *     8 (Burn), 9 (CloseAccount), 12 (TransferChecked), 16 (ApproveChecked)
 * Instructions whose program cannot be resolved from the static account
 * keys (lookup-table programs) are not system/token programs in practice
 * (those are always static) and are left to the router-instruction class. */
export function assertSolanaStepSafe(ixs) {
  for (const ix of ixs) {
    if (!ix.program) continue;
    if (ix.program === SOL_SYSTEM_PROGRAM) {
      const disc = ix.data && ix.data.length >= 4 ? (ix.data[0] | (ix.data[1] << 8) | (ix.data[2] << 16) | (ix.data[3] << 24)) : -1;
      if (disc === 2) throw new Error("That Solana route asks your wallet to send SOL directly instead of swapping through the swap program — refusing to sign it.");
    } else if (SOL_TOKEN_PROGRAMS.has(ix.program)) {
      const op = ix.data && ix.data.length >= 1 ? ix.data[0] : -1;
      if ([3, 4, 8, 9, 12, 16].includes(op)) throw new Error("That Solana route asks your wallet to move, approve, burn or close a token account directly instead of swapping through the swap program — refusing to sign it.");
    }
  }
}
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
      assertSolanaStepSafe(vtx.message.compiledInstructions.map(ci => ({
        program: vtx.message.staticAccountKeys[ci.programIdIndex]?.toBase58() || null,
        data: ci.data,
      })));
      vtx.sign([kp]);
      serialized = vtx.serialize();
    } else {
      const tx = SolTransaction.from(raw);
      if (tx.feePayer && tx.feePayer.toBase58() !== myAddr) throw new Error("That Solana route was built for a different account — refusing to sign it.");
      assertSolanaStepSafe(tx.instructions.map(ins => ({ program: ins.programId?.toBase58() || null, data: ins.data })));
      tx.partialSign(kp);
      serialized = tx.serialize();
    }
    const sig = await solanaBroadcast(serialized, "That route");
    hashes.push(sig);
    onProgress(`Solana step ${i + 1} sent ✓`);
  }
  return hashes;
}

/** The TVM steps of a Tron-sourced route: LI.FI does not return an EVM
 *  transactionRequest for them. Per LI.FI's Tron provider docs
 *  (docs.li.fi "Tron Providers", checked 2026-11-07), the step's
 *  transactionRequest carries the unsigned Tron transaction in two
 *  forms that must agree: `data` — the hex protobuf raw_data of an
 *  unsigned TriggerSmartContract transaction, 0x-prefixed (i.e. the
 *  Tron node's raw_data_hex), and `customData.tronTransaction` — the
 *  same transaction as a TronWeb object {txID, raw_data, raw_data_hex}
 *  with customData.contractType "TriggerSmartContract". `to` is the
 *  LI.FI contract on Tron (base58 T-address), `value` the TRX call
 *  value in SUN and `gasLimit` the transaction's fee_limit in SUN,
 *  both hex-encoded strings. */
export function tronSwapSteps(route) {
  if (Number(route?.fromChainId) !== TRON_LIFI_CHAIN_ID) return [];
  return (route?.steps || []).filter(s => {
    const tr = s.transactionRequest;
    const tt = tr?.customData?.tronTransaction;
    return !!tr && typeof tr.data === "string" && tr.data.length > 0
      && tr.customData?.contractType === "TriggerSmartContract"
      && !!tt && typeof tt.raw_data_hex === "string" && tt.raw_data_hex.length > 0
      && typeof tt.txID === "string" && tt.txID.length > 0;
  });
}
/* Minimal protobuf field reader — just enough to take apart a Tron
 * Transaction.raw_data and inspect what would actually be signed.
 * Tron transactions are protobuf; the wallet signs sha256(raw_data)
 * (the txID), so the inspection decodes THE BYTES, not LI.FI's JSON
 * rendering of them: a rendering that disagreed with the bytes would
 * be caught by the txID check in checkTronSwapStepBounds. Only wire
 * types 0 (varint) and 2 (length-delimited) carry meaning here; 1/5
 * are skipped by width, anything else is malformed. */
function pbFields(bytes) {
  const fields = [];
  let i = 0;
  const readVarint = () => {
    let v = 0n, shift = 0n;
    for (;;) {
      if (i >= bytes.length) throw new Error("truncated varint");
      const b = bytes[i++];
      v |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return v;
      shift += 7n;
      if (shift > 70n) throw new Error("varint too long");
    }
  };
  while (i < bytes.length) {
    const key = readVarint();
    const num = Number(key >> 3n), wire = Number(key & 7n);
    if (num <= 0) throw new Error("bad field number");
    if (wire === 0) fields.push({ num, wire, value: readVarint() });
    else if (wire === 2) {
      const len = Number(readVarint());
      if (len < 0 || i + len > bytes.length) throw new Error("truncated field");
      fields.push({ num, wire, value: bytes.slice(i, i + len) });
      i += len;
    } else if (wire === 5) { fields.push({ num, wire, value: bytes.slice(i, i + 4) }); i += 4; }
    else if (wire === 1) { fields.push({ num, wire, value: bytes.slice(i, i + 8) }); i += 8; }
    else throw new Error("unsupported wire type");
  }
  return fields;
}
/** Decode a Tron Transaction.raw_data (hex, no 0x) into the parts the
 *  swap inspection needs: each contract's type, and for
 *  TriggerSmartContract (type 31) its owner_address / contract_address
 *  (42-char 41-prefixed hex), call_value (SUN) and call data (hex);
 *  plus the transaction-level fee_limit, expiration and timestamp.
 *  Throws on malformed bytes — callers treat that as unverifiable. */
export function decodeTronRawData(rawDataHex) {
  const bytes = ethers.getBytes("0x" + String(rawDataHex || "").replace(/^0x/i, ""));
  const out = { contracts: [], feeLimit: 0n, expiration: 0n, timestamp: 0n };
  for (const f of pbFields(bytes)) {
    if (f.wire === 0 && f.num === 18) out.feeLimit = f.value;
    else if (f.wire === 0 && f.num === 8) out.expiration = f.value;
    else if (f.wire === 0 && f.num === 14) out.timestamp = f.value;
    else if (f.wire === 2 && f.num === 11) {
      const cf = pbFields(f.value);
      const typeF = cf.find(x => x.num === 1 && x.wire === 0);
      const paramF = cf.find(x => x.num === 2 && x.wire === 2);
      const contract = { type: typeF ? Number(typeF.value) : null, typeUrl: null, trigger: null };
      if (paramF) {
        const anyF = pbFields(paramF.value);
        const urlF = anyF.find(x => x.num === 1 && x.wire === 2);
        const valF = anyF.find(x => x.num === 2 && x.wire === 2);
        contract.typeUrl = urlF ? new TextDecoder().decode(urlF.value) : null;
        if (valF && contract.type === 31) {
          const tf = pbFields(valF.value);
          const bytesAt = (n) => { const g = tf.find(x => x.num === n && x.wire === 2); return g ? ethers.hexlify(g.value).slice(2) : null; };
          const cv = tf.find(x => x.num === 3 && x.wire === 0);
          contract.trigger = {
            ownerAddress: bytesAt(1),
            contractAddress: bytesAt(2),
            callValue: cv ? cv.value : 0n,
            data: bytesAt(4) || "",
          };
        }
      }
      out.contracts.push(contract);
    }
  }
  return out;
}
/* Tron fee_limit bounds: LI.FI's docs call the fee_limit "a safety
 * ceiling, not the expected cost", so the cap is looser than the EVM
 * gas-limit multiple — 10× the step's own SUN gas estimate, floored at
 * the 100 TRX fee_limit Fluid's own TRC-20 sends use, never above the
 * absolute cap. fee_limit caps what a bad call could burn; it is not
 * itself a transfer. */
export const TRON_STEP_FEELIMIT_MULTIPLE = 10n;
export const TRON_STEP_FEELIMIT_FALLBACK_CAP = 100_000_000n;  // 100 TRX
export const TRON_STEP_FEELIMIT_ABSOLUTE_CAP = 1_000_000_000n; // 1,000 TRX, never
/** The Tron edition of checkSwapStepBounds (audit M1 discipline): the
 *  confirmed route is the only authority for what a step may do, and
 *  the payload inspected is the exact protobuf the signature commits
 *  to. Runs BEFORE approval and BEFORE signing. Refusals:
 *   - the two LI.FI forms of the transaction disagree, or the txID is
 *     not sha256(raw_data) — the JSON rendering cannot vouch for bytes
 *     it does not hash to;
 *   - the transaction is not exactly one TriggerSmartContract whose
 *     owner is THIS wallet (never sign a transaction spending from
 *     someone else's account, or a plain transfer dressed as a swap);
 *   - the called contract is not the quote's `to`, or IS the token
 *     being sold, or the call is a bare TRC-20 transfer/approve/
 *     transferFrom (routers move tokens inside their own calls);
 *   - value: native input spends at most the quoted amount + 2%; a
 *     token-input step carries no TRX value at all;
 *   - fee_limit beyond the bounds above, or an already-expired tx. */
export function checkTronSwapStepBounds(route, step, ownerAddress) {
  const refuse = (reason) => ({ ok: false, reason });
  const tr = step?.transactionRequest;
  const tt = tr?.customData?.tronTransaction;
  if (!tr || !tt) return refuse("Fluid refused this route: a step carried no Tron transaction to check. Pick another route.");
  if (tr.customData?.contractType !== "TriggerSmartContract") return refuse("Fluid refused this route: a step was not the smart-contract call a swap step must be. Pick another route.");
  if (typeof tr.data !== "string" || tr.data.toLowerCase() !== "0x" + String(tt.raw_data_hex).toLowerCase()) {
    return refuse("Fluid refused this route: the step's two transaction forms disagree. Pick another route.");
  }
  if (ethers.sha256("0x" + tt.raw_data_hex).slice(2) !== String(tt.txID).toLowerCase()) {
    return refuse("Fluid refused this route: the step's transaction id does not match its contents. Pick another route.");
  }
  let raw;
  try { raw = decodeTronRawData(tt.raw_data_hex); } catch { return refuse("Fluid refused this route: the step's transaction could not be decoded for checking. Pick another route."); }
  if (raw.contracts.length !== 1) return refuse("Fluid refused this route: a step must contain exactly one contract call. Pick another route.");
  const c = raw.contracts[0];
  if (c.type !== 31 || !c.trigger) return refuse("Fluid refused this route: a step was not a smart-contract call. Pick another route.");
  if (!isValidTronAddress(ownerAddress) || c.trigger.ownerAddress !== tronAddressToHex(ownerAddress)) {
    return refuse("Fluid refused this route: the step's transaction spends from a different account. Pick another route.");
  }
  if (!isValidTronAddress(tr.to || "") || c.trigger.contractAddress !== tronAddressToHex(tr.to)) {
    return refuse("Fluid refused this route: the step calls a different contract than the quote names. Pick another route.");
  }
  const fromToken = step.action?.fromToken;
  const isNative = !fromToken?.address || fromToken.address === TRON_SWAP_NATIVE_TOKEN;
  let trValue = 0n;
  if (tr.value != null) { try { trValue = BigInt(tr.value); } catch { return refuse("Fluid refused this route: a step's value could not be read as a number. Pick another route."); } }
  if (c.trigger.callValue !== trValue) return refuse("Fluid refused this route: the step's transaction value disagrees with the quote. Pick another route.");
  if (isNative) {
    let base = 0n;
    try { base = BigInt(step.action?.fromAmount ?? route?.fromAmount ?? 0); } catch { base = 0n; }
    const maxValue = base + (base * SWAP_STEP_VALUE_TOLERANCE_BPS) / 10000n;
    if (c.trigger.callValue > maxValue) return refuse("Fluid refused this route: a step asked to send more TRX than the amount you agreed to swap. Pick another route.");
  } else {
    if (c.trigger.callValue !== 0n) return refuse("Fluid refused this route: a token swap step asked to carry TRX value as well. Pick another route.");
    if (fromToken?.address && isValidTronAddress(fromToken.address) && c.trigger.contractAddress === tronAddressToHex(fromToken.address)) {
      return refuse("Fluid refused this route: a step targeted the token being sold instead of a swap router. Pick another route.");
    }
  }
  const dataSel = (c.trigger.data || "").slice(0, 8).toLowerCase();
  if (["a9059cbb", "095ea7b3", "23b872dd"].includes(dataSel)) {
    return refuse("Fluid refused this route: a step tried to move or approve your tokens directly instead of swapping through a router. Pick another route.");
  }
  const approvalSpender = step.estimate?.approvalAddress;
  if (approvalSpender) {
    if (!isValidTronAddress(approvalSpender)) return refuse("Fluid refused this route: the token approval address was not a Tron address. Pick another route.");
    if (!isNative && fromToken?.address && approvalSpender === fromToken.address) {
      return refuse("Fluid refused this route: the token approval was addressed to the token contract itself. Pick another route.");
    }
    // Same rule as the EVM steps (red-team Finding A): the approval may
    // only ever go to the contract the step itself calls — LI.FI's
    // docs name `to` as the LI.FI contract on Tron and the executing
    // contract as the one that pulls the tokens. A third-party spender
    // is a substitution, however plausible it looks.
    if (approvalSpender !== tr.to) {
      return refuse("Fluid refused this route: the token approval was addressed to an unexpected spender, not the swap contract. Pick another route.");
    }
  }
  if (tr.gasLimit != null) {
    let gl = null;
    try { gl = BigInt(tr.gasLimit); } catch { gl = null; }
    if (gl != null && gl !== raw.feeLimit) return refuse("Fluid refused this route: the step's fee limit disagrees with its transaction. Pick another route.");
  }
  let est = 0n;
  for (const g of step.estimate?.gasCosts || []) {
    try { est += BigInt(g?.amount || 0); } catch { /* an unreadable gas cost grants nothing */ }
  }
  let cap = est > 0n ? est * TRON_STEP_FEELIMIT_MULTIPLE : TRON_STEP_FEELIMIT_FALLBACK_CAP;
  if (cap < TRON_STEP_FEELIMIT_FALLBACK_CAP) cap = TRON_STEP_FEELIMIT_FALLBACK_CAP;
  if (cap > TRON_STEP_FEELIMIT_ABSOLUTE_CAP) cap = TRON_STEP_FEELIMIT_ABSOLUTE_CAP;
  if (raw.feeLimit > cap) return refuse("Fluid refused this route: a step's fee limit was far above its own estimate, which could burn your TRX on a failing call. Pick another route.");
  if (raw.expiration > 0n && raw.expiration <= BigInt(Date.now())) return refuse("Fluid refused this route: the step's transaction had already expired. Pick another route.");
  return { ok: true };
}
/** TRC-20 allowance via a constant (free, unsigned) contract call. */
async function tronTrc20Allowance(ownerAddress, tokenAddress, spenderAddress) {
  const parameter = tronAddressToHex(ownerAddress).slice(2).padStart(64, "0")
    + tronAddressToHex(spenderAddress).slice(2).padStart(64, "0");
  const data = await tronPost("/wallet/triggerconstantcontract", {
    owner_address: tronAddressToHex(ownerAddress), contract_address: tronAddressToHex(tokenAddress),
    function_selector: "allowance(address,address)", parameter,
  });
  const out = data && data.constant_result && data.constant_result[0];
  if (!out) throw new Error("Empty Tron allowance reply.");
  return BigInt("0x" + out);
}
/** Build (via TronGrid), sign (locally) and broadcast one contract
 *  call from the wallet — the shape sendTron's token path uses,
 *  generalised for the swap approval. Returns the txID. */
async function tronTriggerAndBroadcast(wallet, { contractAddress, selector, parameter, feeLimit = 100_000_000, callValue = 0 }) {
  const ownerHex = tronAddressToHex(tronAddressFromKey(wallet));
  const data = await tronPost("/wallet/triggersmartcontract", {
    owner_address: ownerHex, contract_address: tronAddressToHex(contractAddress),
    function_selector: selector, parameter, fee_limit: feeLimit, call_value: callValue,
  });
  if (!data || !data.result || data.result.result !== true) {
    throw new Error("Tron rejected the contract call: " + tronErrorText(data && data.result && data.result.message));
  }
  const tx = data.transaction;
  if (!tx || !tx.txID || !tx.raw_data) throw new Error("Tron did not return a transaction to sign.");
  const cast = await tronPost("/wallet/broadcasttransaction", {
    txID: tx.txID, raw_data: tx.raw_data, raw_data_hex: tx.raw_data_hex,
    signature: [signTronTxId(wallet, tx.txID)],
  });
  if (!cast || cast.result !== true) {
    throw new Error("Tron network rejected the transaction: " + tronErrorText(cast && (cast.message || cast.code)));
  }
  return tx.txID;
}
/** Poll until a broadcast transaction is visible on-chain (Tron blocks
 *  land every ~3s; an approval must be in before the swap step that
 *  spends against it is broadcast). */
async function tronWaitTxVisible(txid, tries = 12) {
  for (let i = 0; i < tries; i++) {
    try {
      const d = await tronPost("/wallet/gettransactionbyid", { value: txid });
      if (d && d.txID) return true;
    } catch { /* not visible yet */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}
/** Revoke a TRC-20 approval on Tron: set the spender's allowance back
 *  to zero — the Tron counterpart of revokeApproval, so approvals a
 *  Tron swap records can be reviewed and revoked to the same standard
 *  as EVM ones. Returns the txID. */
export async function revokeTronApproval(wallet, tokenAddress, spender) {
  if (!isValidTronAddress(tokenAddress) || !isValidTronAddress(spender)) throw new Error("That approval record is not a Tron approval.");
  const parameter = tronAddressToHex(spender).slice(2).padStart(64, "0") + (0n).toString(16).padStart(64, "0");
  return tronTriggerAndBroadcast(wallet, {
    contractAddress: tokenAddress, selector: "approve(address,uint256)", parameter, feeLimit: 100_000_000,
  });
}
/** Execute a Tron-sourced swap route: for each TVM step, inspect the
 *  exact protobuf payload (checkTronSwapStepBounds), approve the
 *  from-token for the exact amount where the step needs it (LI.FI's
 *  docs: the executing contract pulls TRC-20 input against an
 *  allowance to the step's estimate.approvalAddress; native TRX rides
 *  as the call value and needs none), then sign the transaction id
 *  with the wallet's key — the same key as its EVM account — and
 *  broadcast. Returns the transaction ids. */
export async function executeTronSwapRoute(wallet, route, onProgress = () => {}, onApprove = () => {}) {
  const { ok, tvm, steps, reason } = swapRouteExecutable(route);
  if (!ok || !tvm) throw new Error(reason || "That route does not start on Tron.");
  const owner = tronAddressFromKey(wallet);
  const hashes = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], tr = step.transactionRequest, tt = tr.customData.tronTransaction;
    const bounds = checkTronSwapStepBounds(route, step, owner);
    if (!bounds.ok) throw new Error(bounds.reason);
    const fromToken = step.action?.fromToken;
    const isNative = !fromToken?.address || fromToken.address === TRON_SWAP_NATIVE_TOKEN;
    if (!isNative && step.action?.fromAmount && step.estimate?.skipApproval !== true) {
      const need = BigInt(step.action.fromAmount);
      const spender = step.estimate?.approvalAddress || tr.to;
      if ((await tronTrc20Allowance(owner, fromToken.address, spender)) < need) {
        onProgress(`Approving ${fromToken.symbol || "token"} for the route (exact amount only)…`);
        const parameter = tronAddressToHex(spender).slice(2).padStart(64, "0") + need.toString(16).padStart(64, "0");
        const approveTx = await tronTriggerAndBroadcast(wallet, {
          contractAddress: fromToken.address, selector: "approve(address,uint256)", parameter, feeLimit: 100_000_000,
        });
        try {
          onApprove({ chainKey: "tron", token: fromToken.address, tokenSymbol: fromToken.symbol || null, spender, amount: need.toString(), decimals: fromToken.decimals ?? null, at: Date.now() });
        } catch { /* recording an approval must never break a swap */ }
        if (!(await tronWaitTxVisible(approveTx))) throw new Error("The token approval didn't land on Tron in time — no swap was attempted. Try again.");
      }
    }
    onProgress(`Signing Tron step ${i + 1} of ${steps.length}…`);
    const cast = await tronPost("/wallet/broadcasttransaction", {
      txID: tt.txID, raw_data: tt.raw_data, raw_data_hex: tt.raw_data_hex,
      signature: [signTronTxId(wallet, tt.txID)],
    });
    if (!cast || cast.result !== true) {
      throw new Error("Tron network rejected the swap transaction: " + tronErrorText(cast && (cast.message || cast.code)));
    }
    hashes.push(tt.txID);
    onProgress(`Tron step ${i + 1} sent ✓`);
  }
  return hashes;
}

/** The MVM steps of a Sui-sourced route: like SVM steps, the payload
 *  is the step's transactionRequest.data string — a serialized Sui
 *  transaction (LI.FI's own SDK feeds exactly this string to
 *  @mysten/sui's Transaction.from, then builds, signs and executes —
 *  the flow executeSuiSwapRoute mirrors). */
export function suiSwapSteps(route) {
  if (Number(route?.fromChainId) !== SUI_LIFI_CHAIN_ID) return [];
  return (route?.steps || []).filter(s =>
    s.transactionRequest && typeof s.transactionRequest.data === "string" && s.transactionRequest.data.length > 0);
}
/* Sui gas budget bounds, mirroring the other families: the budget is
 * a cap, not a spend — 5× the step's own MIST gas estimate, floored at
 * 0.05 SUI, never above 1 SUI. (The multiple carries headroom because
 * the SDK's builder sets the budget from its own simulation: a live
 * Cetus quote checked 2026-11-07 estimated 14.5M MIST of gas and
 * built a 50M MIST budget — a 3.45× ratio.) */
export const SUI_STEP_GAS_MULTIPLE = 5n;
export const SUI_STEP_GAS_FALLBACK_CAP = 50_000_000n;   // 0.05 SUI
export const SUI_STEP_GAS_ABSOLUTE_CAP = 1_000_000_000n; // 1 SUI, never
const SUI_COIN_TYPE_RE = /^0x0*2::coin::Coin<(.+)>$/;
/** Normalise a coin type for comparison: Sui writes the SUI type with
 *  a fully padded package address in some payloads and as "0x2" in
 *  others; compare on the padded canonical form. */
function suiCoinTypeNorm(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(0x[0-9a-fA-F]+)::(.*)$/);
  if (!m) return s.toLowerCase();
  return "0x" + m[1].slice(2).toLowerCase().padStart(64, "0") + "::" + m[2];
}
/** The Sui edition of the payload inspection (audit M1 / red-team
 *  discipline): runs on the BUILT transaction data — the exact bytes
 *  that will be signed — and refuses any shape a swap step never
 *  legitimately has:
 *   - sender or gas owner other than this wallet;
 *   - a gas budget beyond the bounds above;
 *   - Publish / Upgrade commands, or FundsWithdrawal inputs (swap
 *     steps move coins through calls, they do not publish packages
 *     or draw on address balances);
 *   - TransferObjects to any address but the sender (a bridge/DEX
 *     step hands coins to contracts through Move calls; a direct
 *     transfer out to a third party is a drain shape);
 *   - value: the built inputs are resolved against the chain by the
 *     caller (see executeSuiSwapRoute) — this pure part checks the
 *     command/input structure those resolutions attach to.
 *  `resolveInputObjects` maps each ImmOrOwnedObject input index to
 *  {owner, type, balance} as read from the chain (balance for coin
 *  objects, null otherwise); the value invariants enforced here:
 *   - every owned-object input belongs to the sender and is a coin
 *     (a swap step never needs another of the wallet's objects);
 *   - value is accounted by CONSUMPTION, not by mere presence:
 *     aggregator PTBs merge the wallet's coins and split the quoted
 *     amount off inside the transaction, so a coin input's exposure
 *     is the amount its commands actually take from it — the split
 *     amounts when it is only split/merged, its full balance when a
 *     Move call takes it by value, and zero when it is only read by
 *     reference, left unused, or transferred back to the sender;
 *   - the sold coin's total exposure — plus, for a SUI sale, amounts
 *     split off the gas coin — is at most the quoted amount + 2%,
 *     and any OTHER coin's exposure must be exactly zero (the step
 *     may not spend a second asset of the wallet's). */
export function checkSuiSwapStepSafety(data, { ownerAddress, fromCoinType, fromAmount, gasEstimateMist = 0n, suiFeeAllowanceMist = 0n, inputObjects = new Map() } = {}) {
  const refuse = (reason) => ({ ok: false, reason });
  const me = normalizeSuiAddress(ownerAddress || "");
  if (!me) return refuse("Fluid refused this route: the wallet's Sui address could not be read. Pick another route.");
  if (normalizeSuiAddress(data?.sender || "") !== me) return refuse("Fluid refused this route: the step's transaction was built for a different account. Pick another route.");
  const gas = data?.gasData || {};
  if (gas.owner && normalizeSuiAddress(gas.owner) !== me) return refuse("Fluid refused this route: the step's gas was assigned to a different account. Pick another route.");
  let budget = 0n;
  try { budget = BigInt(gas.budget ?? 0); } catch { return refuse("Fluid refused this route: the step's gas budget could not be read. Pick another route."); }
  let cap = gasEstimateMist > 0n ? gasEstimateMist * SUI_STEP_GAS_MULTIPLE : SUI_STEP_GAS_FALLBACK_CAP;
  if (cap < SUI_STEP_GAS_FALLBACK_CAP) cap = SUI_STEP_GAS_FALLBACK_CAP;
  if (cap > SUI_STEP_GAS_ABSOLUTE_CAP) cap = SUI_STEP_GAS_ABSOLUTE_CAP;
  if (budget > cap) return refuse("Fluid refused this route: the step's gas budget was far above its own estimate. Pick another route.");
  const inputs = data?.inputs || [];
  const pureBytes = (idx) => {
    const inp = inputs[idx];
    if (!inp || inp.$kind !== "Pure" || typeof inp.Pure?.bytes !== "string") return null;
    try { return base64.decode(inp.Pure.bytes); } catch { return null; }
  };
  const pureAddress = (arg) => {
    if (!arg || arg.$kind !== "Input") return null;
    const b = pureBytes(arg.Input);
    if (!b || b.length !== 32) return null;
    return "0x" + Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  };
  const pureU64 = (arg) => {
    if (!arg || arg.$kind !== "Input") return null;
    const b = pureBytes(arg.Input);
    if (!b || b.length !== 8) return null;
    let v = 0n;
    for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[i]);
    return v;
  };
  const fromType = suiCoinTypeNorm(fromCoinType || "");
  const suiType = suiCoinTypeNorm(SUI_COIN_TYPE);
  const isSuiSale = fromType === suiType;
  // Pass 1 — validate every owned-object input and record its coin.
  const coinInfo = new Map(); // input index -> { coinType, balance }
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    if (!inp) continue;
    if (inp.$kind === "FundsWithdrawal") return refuse("Fluid refused this route: a step tried to draw on the wallet's address balance directly. Pick another route.");
    if (inp.$kind !== "Object") continue;
    const obj = inp.Object || {};
    if (obj.Receiving) return refuse("Fluid refused this route: a step tried to consume an unreceived object. Pick another route.");
    if (!obj.ImmOrOwnedObject) continue; // shared objects (pools, bridge state) carry no wallet value
    const info = inputObjects.get(i);
    if (!info) return refuse("Fluid refused this route: a step's input object could not be verified on-chain. Pick another route.");
    if (normalizeSuiAddress(info.owner || "") !== me) return refuse("Fluid refused this route: a step tried to spend an object the wallet does not own. Pick another route.");
    const coinMatch = SUI_COIN_TYPE_RE.exec(String(info.type || ""));
    if (!coinMatch) return refuse("Fluid refused this route: a step tried to spend a non-coin object of the wallet's. Pick another route.");
    if (typeof info.balance !== "bigint") return refuse("Fluid refused this route: a step coin's balance could not be read on-chain. Pick another route.");
    coinInfo.set(i, { coinType: suiCoinTypeNorm(coinMatch[1]), balance: info.balance });
  }
  // Pass 2 — record how each command consumes the inputs. `usage`
  // tracks, per input index: split amounts taken from it, whether a
  // Move call / vector takes it BY VALUE (full exposure), which input
  // it merges into, and which inputs merge into it.
  const usage = new Map();
  const use = (idx) => {
    if (!usage.has(idx)) usage.set(idx, { split: 0n, wasSplit: false, direct: false, mergeInto: null, mergedSources: [] });
    return usage.get(idx);
  };
  const inputIdxOf = (arg) => (arg && arg.$kind === "Input" && coinInfo.has(arg.Input) ? arg.Input : null);
  let gasSplitTotal = 0n;
  const splitAmounts = (amounts) => {
    let sum = 0n;
    for (const a of amounts || []) {
      const v = pureU64(a);
      if (v == null) return null;
      sum += v;
    }
    return sum;
  };
  for (const cmd of data?.commands || []) {
    if (!cmd) continue;
    if (cmd.$kind === "Publish" || cmd.$kind === "Upgrade") {
      return refuse("Fluid refused this route: a step tried to publish or upgrade a package. Pick another route.");
    }
    if (cmd.$kind === "TransferObjects") {
      const to = pureAddress(cmd.TransferObjects?.address);
      if (!to || normalizeSuiAddress(to) !== me) {
        return refuse("Fluid refused this route: a step tried to transfer objects to an address that is not yours. Pick another route.");
      }
      continue; // transfers back to the sender expose nothing
    }
    if (cmd.$kind === "SplitCoins") {
      const sc = cmd.SplitCoins || {};
      const total = splitAmounts(sc.amounts);
      if (total == null) return refuse("Fluid refused this route: a step's split amount could not be read. Pick another route.");
      if (sc.coin?.$kind === "GasCoin") gasSplitTotal += total;
      else { const idx = inputIdxOf(sc.coin); if (idx != null) { const u = use(idx); u.split += total; u.wasSplit = true; } }
      continue;
    }
    if (cmd.$kind === "MergeCoins") {
      const mc = cmd.MergeCoins || {};
      const destIdx = inputIdxOf(mc.destination);
      for (const src of mc.sources || []) {
        const sIdx = inputIdxOf(src);
        if (sIdx == null) continue;
        const u = use(sIdx);
        if (destIdx != null) { u.mergeInto = destIdx; use(destIdx).mergedSources.push(sIdx); }
        else if (mc.destination?.$kind === "GasCoin") u.mergeInto = "gas";
        else u.direct = true; // merged into a command result — untrackable, count it whole
      }
      continue;
    }
    if (cmd.$kind === "MoveCall") {
      const mc = cmd.MoveCall || {};
      const argTypes = Array.isArray(mc._argumentTypes) ? mc._argumentTypes : [];
      const args = mc.arguments || [];
      for (let p = 0; p < args.length; p++) {
        const arg = args[p];
        const byRef = argTypes[p] && (argTypes[p].reference === "immutable" || argTypes[p].reference === "mutable");
        if (arg?.$kind === "GasCoin" && !byRef) {
          // The protocol itself rejects a by-value gas coin in a Move
          // call (InvalidGasCoinUsage) — the sanctioned path is a
          // SplitCoins off the gas coin, accounted above.
          return refuse("Fluid refused this route: a step tried to spend the gas coin directly through a contract call. Pick another route.");
        }
        const idx = inputIdxOf(arg);
        if (idx != null && !byRef) use(idx).direct = true;
      }
      continue;
    }
    if (cmd.$kind === "MakeMoveVec") {
      for (const el of cmd.MakeMoveVec?.elements || []) {
        const idx = inputIdxOf(el);
        if (idx != null) use(idx).direct = true;
      }
      continue;
    }
  }
  // Pass 3 — resolve each coin's exposure from its recorded usage.
  const exposure = (idx, seen = new Set()) => {
    const info = coinInfo.get(idx);
    if (!info) return 0n;
    if (seen.has(idx)) return info.balance; // merge cycle — count it whole
    seen.add(idx);
    const u = usage.get(idx);
    if (!u) return 0n;
    let pool = info.balance;
    for (const sIdx of u.mergedSources) { const si = coinInfo.get(sIdx); if (si) pool += si.balance; }
    if (u.direct) return pool;
    if (u.mergeInto != null) return 0n; // its value is accounted at the destination
    if (u.wasSplit) return u.split;
    return 0n;
  };
  let fromTotal = 0n, suiSideTotal = 0n;
  for (const [idx, info] of coinInfo) {
    const ex = exposure(idx);
    if (ex === 0n) continue;
    if (info.coinType === fromType) fromTotal += ex;
    else if (info.coinType === suiType) suiSideTotal += ex;
    else return refuse("Fluid refused this route: a step tried to spend a different asset than the one being swapped. Pick another route.");
  }
  if (isSuiSale) fromTotal += gasSplitTotal;
  else suiSideTotal += gasSplitTotal;
  let base = 0n;
  try { base = BigInt(fromAmount ?? 0); } catch { base = 0n; }
  const maxFrom = base + (base * SWAP_STEP_VALUE_TOLERANCE_BPS) / 10000n;
  if (fromTotal > maxFrom) return refuse("Fluid refused this route: a step asked to spend more than the amount you agreed to swap. Pick another route.");
  // SUI spent alongside a non-SUI sale (an aggregator/bridge fee taken
  // in the gas coin) is bounded by the step's own declared SUI fees:
  // its feeCosts plus its gas estimate, as passed in by the caller.
  if (!isSuiSale && suiSideTotal > suiFeeAllowanceMist + gasEstimateMist) {
    return refuse("Fluid refused this route: a step asked to spend more SUI alongside the swap than its own declared fees. Pick another route.");
  }
  return { ok: true };
}
/** Execute a Sui-sourced swap route, mirroring LI.FI's own SDK flow
 *  over Fluid's GraphQL transport: rebuild the step's transaction
 *  from its payload, build it against the chain, inspect the BUILT
 *  bytes (the exact bytes that get signed — owned-object inputs are
 *  resolved on-chain and valued by checkSuiSwapStepSafety), sign with
 *  the wallet's Sui key and execute. Returns the digests. */
export async function executeSuiSwapRoute(phrase, route, onProgress = () => {}) {
  const { ok, mvm, steps, reason } = swapRouteExecutable(route);
  if (!ok || !mvm) throw new Error(reason || "That route does not start on Sui.");
  const kp = suiKeypair(phrase);
  const myAddr = kp.getPublicKey().toSuiAddress();
  const client = suiClient();
  const hashes = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], tr = step.transactionRequest;
    onProgress(`Preparing Sui step ${i + 1} of ${steps.length}…`);
    const tx = SuiTransaction.from(tr.data);
    tx.setSenderIfNotSet(myAddr);
    const bytes = await tx.build({ client });
    const data = SuiTransaction.from(bytes).getData();
    // Resolve every owned-object input on-chain: owner, type and (for
    // coins) balance — the values the safety check holds the step to.
    const ownedIdx = [];
    (data.inputs || []).forEach((inp, idx) => {
      if (inp?.$kind === "Object" && inp.Object?.ImmOrOwnedObject) ownedIdx.push(idx);
    });
    const inputObjects = new Map();
    if (ownedIdx.length) {
      const ids = ownedIdx.map(idx => data.inputs[idx].Object.ImmOrOwnedObject.objectId);
      const res = await client.core.getObjects({ objectIds: ids, include: { content: true } });
      (res.objects || []).forEach((o, j) => {
        if (!o || o.error || !o.objectId) return;
        let balance = null;
        if (SUI_COIN_TYPE_RE.test(String(o.type || "")) && o.content instanceof Uint8Array && o.content.length >= 40) {
          // Coin<T> BCS layout: UID (32 bytes) || balance u64 LE.
          let v = 0n;
          for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(o.content[32 + k]);
          balance = v;
        }
        inputObjects.set(ownedIdx[j], {
          owner: o.owner?.$kind === "AddressOwner" ? o.owner.AddressOwner : null,
          type: o.type || null,
          balance,
        });
      });
    }
    let gasEstimateMist = 0n;
    for (const g of step.estimate?.gasCosts || []) {
      try { gasEstimateMist += BigInt(g?.amount || 0); } catch { /* an unreadable gas cost grants nothing */ }
    }
    let suiFeeAllowanceMist = 0n;
    for (const f of step.estimate?.feeCosts || []) {
      try { suiFeeAllowanceMist += BigInt(f?.amount || 0); } catch { /* an unreadable fee grants nothing */ }
    }
    const safety = checkSuiSwapStepSafety(data, {
      ownerAddress: myAddr,
      fromCoinType: step.action?.fromToken?.address,
      fromAmount: step.action?.fromAmount ?? route?.fromAmount ?? 0,
      gasEstimateMist,
      suiFeeAllowanceMist,
      inputObjects,
    });
    if (!safety.ok) throw new Error(safety.reason);
    onProgress(`Signing Sui step ${i + 1} of ${steps.length}…`);
    const { signature } = await kp.signTransaction(bytes);
    const res = await client.core.executeTransaction({ transaction: bytes, signatures: [signature], include: { effects: true } });
    const txn = res.$kind === "FailedTransaction" ? res.FailedTransaction : res.Transaction;
    if (!txn) throw new Error("Sui returned an unreadable execution reply.");
    if (res.$kind === "FailedTransaction" || (txn.status && txn.status.success === false)) {
      const errMsg = (txn.status && txn.status.error && txn.status.error.message) || "execution failed";
      throw new Error("Sui rejected the swap transaction: " + errMsg);
    }
    hashes.push(txn.digest);
    onProgress(`Sui step ${i + 1} sent ✓`);
  }
  return hashes;
}

const SWAP_ERC20 = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
/* Swap step bounds (audit M1, 2026-11-06): the route object the user
 * confirmed is the ONLY authority for what a step may spend. LI.FI's
 * per-step transactionRequest is network data — a compromised or buggy
 * response must not be able to make the wallet send more value, or
 * burn more gas, than the quote the user read. checkSwapStepBounds is
 * pure and runs BEFORE the step's approval and signature:
 *   - VALUE: for a native-input step, value ≤ the step's quoted input
 *     amount + 2% tolerance. For a token-input step, value may only
 *     cover the step's own declared gas costs (native-denominated) —
 *     in practice LI.FI sends 0 there.
 *   - GASLIMIT: ≤ 3× the step's own gas estimate, never above the
 *     absolute cap; with no estimate at all, the fallback cap applies.
 * A breach refuses the whole route with a plain explanation. */
export const SWAP_STEP_VALUE_TOLERANCE_BPS = 200n;   // 2% over the quoted input
export const SWAP_STEP_GASLIMIT_MULTIPLE = 3n;       // × the step's own estimate
export const SWAP_STEP_GASLIMIT_FALLBACK_CAP = 2_000_000n; // no estimate → this
export const SWAP_STEP_GASLIMIT_ABSOLUTE_CAP = 10_000_000n; // never, estimate or not
export function checkSwapStepBounds(route, step) {
  const refuse = (reason) => ({ ok: false, reason });
  const tr = step?.transactionRequest;
  if (!tr) return refuse("Fluid refused this route: a step carried no transaction to check. Pick another route.");
  let value = 0n;
  try { value = tr.value != null ? BigInt(tr.value) : 0n; } catch { return refuse("Fluid refused this route: a step's value could not be read as a number. Pick another route."); }
  if (value < 0n) return refuse("Fluid refused this route: a step asked for a negative value. Pick another route.");
  const fromToken = step.action?.fromToken;
  const isNative = !fromToken?.address || /^0x0{40}$/i.test(fromToken.address);
  let maxValue;
  if (isNative) {
    let base = 0n;
    try { base = BigInt(step.action?.fromAmount ?? route?.fromAmount ?? 0); } catch { base = 0n; }
    maxValue = base + (base * SWAP_STEP_VALUE_TOLERANCE_BPS) / 10000n;
  } else {
    maxValue = 0n;
    for (const g of step.estimate?.gasCosts || []) {
      try { maxValue += BigInt(g?.amount || 0); } catch { /* an unreadable gas cost grants nothing */ }
    }
  }
  if (value > maxValue) {
    return refuse("Fluid refused this route: a step asked to send more value than the amount you agreed to swap. Pick another route.");
  }
  // RED-TEAM 2026-11-06 (Finding A): value/gas bounds alone do not make a
  // step safe — `to`, `data` and the approval spender are also network
  // data. Three payload shapes are never a legitimate swap step and are
  // refused outright:
  //   1. The step's calldata is a RAW ERC-20 transfer/approve/transferFrom.
  //      Routers move tokens inside their own calls; a top-level ERC-20
  //      call in a "swap" step moves the wallet's tokens wherever the
  //      payload says (or grants an approval of any size).
  //   2. The step targets the very token being sold — steps talk to
  //      routers/bridges, never to the sold token's own contract.
  //   3. The approval spender is a third party: LI.FI routes approve
  //      either the LI.FI diamond or the step's own target contract.
  //      Any other spender (an EOA, a foreign contract) is a substitution.
  const dataSel = typeof tr.data === "string" ? tr.data.slice(0, 10).toLowerCase() : "";
  if (["0xa9059cbb", "0x095ea7b3", "0x23b872dd"].includes(dataSel)) {
    return refuse("Fluid refused this route: a step tried to move or approve your tokens directly instead of swapping through a router. Pick another route.");
  }
  const toLc = typeof tr.to === "string" ? tr.to.toLowerCase() : "";
  if (!isNative && fromToken?.address && toLc === String(fromToken.address).toLowerCase()) {
    return refuse("Fluid refused this route: a step targeted the token being sold instead of a swap router. Pick another route.");
  }
  const approvalSpender = step.estimate?.approvalAddress;
  if (approvalSpender) {
    const sp = String(approvalSpender).toLowerCase();
    if (sp !== toLc && sp !== LIFI_DIAMOND.toLowerCase()) {
      return refuse("Fluid refused this route: the token approval was addressed to an unexpected spender, not the swap router. Pick another route.");
    }
  }
  if (tr.gasLimit != null) {
    let gl = null;
    try { gl = BigInt(tr.gasLimit); } catch { gl = null; /* unparseable → the node estimates, as before */ }
    if (gl != null) {
      let est = 0n;
      for (const g of step.estimate?.gasCosts || []) {
        try { est += BigInt(g?.estimate || 0); } catch { /* ignore unreadable estimates */ }
      }
      let cap = est > 0n ? est * SWAP_STEP_GASLIMIT_MULTIPLE : SWAP_STEP_GASLIMIT_FALLBACK_CAP;
      if (cap > SWAP_STEP_GASLIMIT_ABSOLUTE_CAP) cap = SWAP_STEP_GASLIMIT_ABSOLUTE_CAP;
      if (gl > cap) {
        return refuse("Fluid refused this route: a step asked for a gas limit far above its own estimate, which could burn your funds on a failing transaction. Pick another route.");
      }
    }
  }
  return { ok: true };
}
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
    // Bounds BEFORE approval and BEFORE signing (audit M1): a hostile
    // step gets neither an approval nor a signature.
    const bounds = checkSwapStepBounds(route, step);
    if (!bounds.ok) throw new Error(bounds.reason);
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

/* On-chain approvals scan (audit M5, 2026-11-06): the approvals screen
 * used to show only Fluid's own records, which made approvals granted
 * through OTHER wallets/dApps on the same address invisible — including
 * the unlimited drainer approvals the research flagged as a top loss
 * pattern. This reads allowance(owner, spender) for the wallet's known
 * tokens × a bounded spender set (every spender in Fluid's records for
 * the chain, plus LI.FI's diamond — the spender Fluid itself uses),
 * via Multicall3 when the chain has it, direct eth_calls otherwise.
 * Only POSITIVE allowances are returned. The pair count is capped so a
 * long token list can never turn the screen into an RPC flood. */
export const LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
export const MAX_APPROVAL_SCAN_PAIRS = 400;
export async function scanOnChainAllowances(networkKey, ownerAddress, tokens, spenders) {
  const net = NETWORKS[networkKey];
  if (!net) throw new Error("Unknown network: " + networkKey);
  const toks = [];
  const seenT = new Set();
  for (const t of tokens || []) {
    if (!t || !ethers.isAddress(t.address || "") || /^0x0{40}$/i.test(t.address)) continue;
    const k = t.address.toLowerCase();
    if (seenT.has(k)) continue;
    seenT.add(k);
    toks.push({ address: t.address, symbol: t.symbol || "Token", decimals: t.decimals ?? 18 });
  }
  const spends = [];
  const seenS = new Set();
  for (const s of spenders || []) {
    if (!ethers.isAddress(s || "")) continue;
    const k = s.toLowerCase();
    if (seenS.has(k)) continue;
    seenS.add(k);
    spends.push(s);
  }
  const pairs = [];
  for (const t of toks) for (const s of spends) {
    if (pairs.length >= MAX_APPROVAL_SCAN_PAIRS) break;
    pairs.push({ token: t, spender: s });
  }
  if (!pairs.length) return [];
  const iface = new ethers.Interface(SWAP_ERC20);
  const callData = (spender) => iface.encodeFunctionData("allowance", [ownerAddress, spender]);
  const values = new Array(pairs.length).fill(0n);
  if (await hasMulticall3(networkKey)) {
    const mc = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, providerFor(networkKey));
    for (const grp of chunkArray(pairs.map((p, i) => ({ ...p, i })), 250)) {
      const calls = grp.map(p => ({ target: p.token.address, allowFailure: true, callData: callData(p.spender) }));
      const results = await mc.aggregate3(calls);
      results.forEach((r, j) => {
        if (!r || !r.success || !r.returnData || r.returnData === "0x") return;
        try { values[grp[j].i] = iface.decodeFunctionResult("allowance", r.returnData)[0]; } catch { /* not an ERC-20 reply */ }
      });
    }
  } else {
    const provider = providerFor(networkKey);
    for (const grp of chunkArray(pairs.map((p, i) => ({ ...p, i })), 25)) {
      await Promise.all(grp.map(async (p) => {
        try {
          const c = new ethers.Contract(p.token.address, SWAP_ERC20, provider);
          values[p.i] = await c.allowance(ownerAddress, p.spender);
        } catch { /* that pair didn't answer — treated as no approval found */ }
      }));
    }
  }
  const out = [];
  pairs.forEach((p, i) => {
    if (values[i] > 0n) {
      out.push({
        token: p.token.address, tokenSymbol: p.token.symbol, decimals: p.token.decimals,
        spender: p.spender, allowance: values[i].toString(),
        unlimited: values[i] >= (1n << 255n),
      });
    }
  });
  return out;
}

/** Address-poisoning defence: scammers generate addresses that share the
 *  first and last few characters with one you already use, then dust you
 *  from them hoping you'll copy the wrong one out of your history. Returns
 *  the known address the recipient imitates (a meaningful shared head AND
 *  tail, case-insensitive, but NOT the same address), otherwise null. */
export function looksLikePoison(recipient, knownAddresses) {
  const norm = (a) => String(a || "").trim().toLowerCase();
  const r = norm(recipient);
  if (!/^0x[0-9a-f]{40}$/.test(r)) return null;
  for (const k of knownAddresses || []) {
    const known = norm(k);
    if (!/^0x[0-9a-f]{40}$/.test(known) || known === r) continue;
    if (affixMatch(r.slice(2), known.slice(2), 3, 3, 7)) return k;
  }
  return null;
}
/* Common prefix/suffix test behind both lookalike checks: an imitator
 * must share a meaningful head AND tail with the known string. Two
 * unrelated addresses essentially never share 3+3 affixes by chance
 * (hex: ~16^-6 per pair), while ground vanity addresses match on
 * whichever side was cheaper to grind. */
function affixMatch(a, b, minPrefix, minSuffix, minTotal) {
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p < minPrefix) return false;
  let s = 0; while (s < a.length && s < b.length && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return s >= minSuffix && p + s >= minTotal;
}
/* RED-TEAM 2026-11-06 (Finding D): the poisoning warning existed only
 * for EVM addresses — the Bitcoin sheet (and the other families) showed
 * none, and the EVM check required first-4 AND last-4, so imitators
 * ground on the cheaper side (first-3+last-4, first-4+last-3) evaded it.
 * looksLikePoison above now matches on combined affixes; this generic
 * variant covers bech32/base58 families, whose constant HRP ("bc1q")
 * inflates the shared prefix — hence the higher defaults (an imitator
 * must match 4+ characters BEYOND the shared "bc1q" and 4 at the tail). */
export function looksLikePoisonText(recipient, knownAddresses, { minPrefix = 8, minSuffix = 4, minTotal = 12 } = {}) {
  const norm = (a) => String(a || "").trim().toLowerCase();
  const r = norm(recipient);
  if (r.length < minTotal + 2) return null;
  for (const k of knownAddresses || []) {
    const known = norm(k);
    if (!known || known === r) continue;
    if (affixMatch(r, known, minPrefix, minSuffix, minTotal)) return k;
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
/** Brand aliases a name-normalisation can't bridge: the same chain is
 *  spelled so differently across sources that stripping suffixes and
 *  punctuation never converges ("BSquared" on DefiLlama vs "B2 Mainnet"
 *  on the registry — live-audited 2026-11-06: the mismatch silently kept
 *  B² Network's $2.5M TVL from attaching, and the chain out of the gate). */
const CHAIN_NAME_ALIASES = { bsquared: "b2" };
function normalizeChainName(name) {
  let s = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of CHAIN_NAME_SUFFIXES) {
      if (s.length > suf.length && s.endsWith(suf)) { s = s.slice(0, -suf.length); changed = true; }
    }
  }
  return CHAIN_NAME_ALIASES[s] || s;
}
const cleanChainRpc = (u) =>
  (typeof u === "string" && u.startsWith("https://") && !u.includes("{") && !u.includes("}")) ? u : null;
/* Registry labels are community-submitted third-party data (audit M3):
 * before a discovered chain's name/symbol is admitted — and long before
 * it is rendered — strip everything outside a conservative charset, so
 * a markup-carrying registry entry arrives inert even before the UI's
 * escaping. Legitimate names ("BNB Smart Chain", "B² Network", "zkSync
 * Era") pass through unchanged. */
export function sanitizeChainLabel(s, maxLen = 48) {
  return String(s ?? "").replace(/[^\p{L}\p{N} .,&'()+\-²³/]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}
export function sanitizeChainSymbol(s) {
  return String(s ?? "").replace(/[^A-Za-z0-9.\-]+/g, "").slice(0, 16);
}
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
    let name = sanitizeChainLabel((reg && reg.name) || (lifi && lifi.name) || "");
    let testnet = chainNameMarksTestnet(name);
    if (lifi && lifi.mainnet === false) testnet = true;
    // A LI.FI mainnet whose registry entry still carries a previous chain's
    // testnet name is a stale reused-id entry (live case: 999 is "Wanchain
    // Testnet" in the registry, HyperEVM to LI.FI). LI.FI wins — for the
    // name and for every other field sourced from that registry entry.
    let staleReg = false;
    if (lifi && lifi.mainnet === true && chainNameMarksTestnet(name) && !chainNameMarksTestnet(lifi.name)) {
      name = sanitizeChainLabel(lifi.name); testnet = false; staleReg = true;
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
      symbol: sanitizeChainSymbol(nc.symbol || (lifi && lifi.coin) || ""), decimals: nc.decimals ?? 18,
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

/** The swap version of the signer principle: a sentence, never a blob.
 *  `platformFeeUsd` is Fluid's own fee in USD, recomputed by the
 *  caller from the FINAL quote's own numbers (Relay: its fees.app;
 *  LI.FI: the charged bps applied to fromAmount) — when present it
 *  is disclosed as its own clause BEFORE the user confirms, with
 *  its effective percentage of the amount (`platformFeePct`, in
 *  percent units) beside it, so the user sees the route-cost
 *  markup's edge rather than a flat-rate label. Fluid never hides
 *  its fee in a spread, and never discloses a fee the quote will
 *  not actually charge. */
export function formatSwapIntent({ fromAmount, fromSymbol, fromNetKey, toAmount, toSymbol, toNetKey, toolName, feeUsd, durationSec, platformFeeUsd, platformFeePct }) {
  const f = swapChainOf(fromNetKey), t = swapChainOf(toNetKey);
  const secs = Math.max(1, Math.round(Number(durationSec) || 0));
  const when = Number.isFinite(durationSec)
    ? (durationSec < 90 ? ` Funds should arrive in about ${secs} second${secs === 1 ? "" : "s"}.`
                        : ` Funds should arrive in about ${Math.round(durationSec / 60)} minutes.`)
    : "";
  const fee = Number(feeUsd || 0);
  const feeText = fee > 0 && fee < 0.01 ? "under $0.01" : "$" + fee.toFixed(2);
  const pFee = Number(platformFeeUsd);
  const pPct = Number(platformFeePct);
  const platformFeeText = (Number.isFinite(pFee) && pFee > 0)
    ? ` Fluid fee: ${pFee < 0.01 ? "under $0.01" : "$" + pFee.toFixed(2)}${Number.isFinite(pPct) && pPct > 0 ? ` (${parseFloat(pPct.toFixed(3))}%)` : ""}.`
    : "";
  return `Swap ${fromAmount} ${fromSymbol} on ${f.name} for about ${toAmount} ${toSymbol} on ${t.name} via ${toolName}. ` +
         `Route + network fees about ${feeText}.${platformFeeText}${when} Confirm?`;
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
    // RED-TEAM 2026-11-06 (Finding F): a pair with dust liquidity and
    // wash-traded volume used to set BOTH the displayed price and the
    // token's display name/symbol here (a $120 pool "renamed" a token to
    // USDC at $400). Liquidity is the expensive thing to fake; volume is
    // not. Pairs under the floor contribute nothing — the token simply
    // stays unpriced (Other tokens, still fully usable).
    const liq = Number((p.liquidity && p.liquidity.usd) || 0);
    if (!(liq >= 1000)) continue;
    const cand = { price, vol: Number((p.volume && p.volume.h24) || 0),
                   liq,
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
           verificationStatus: t.verificationStatus || null,
           logoURI: typeof t.logoURI === "string" && t.logoURI ? t.logoURI : null };
}
/** EIP-55 checksummed form of an EVM address (null for non-addresses).
 *  Presentation support: the Trust Wallet assets CDN keys token logos
 *  by checksummed address, so the UI constructs logo URLs with this. */
export function toChecksumAddress(addr) {
  const a = String(addr || "").toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(a)) return null;
  const hash = [...keccak_256(new TextEncoder().encode(a))]
    .map(b => b.toString(16).padStart(2, "0")).join("");
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
  return out;
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
 *  when `mint` is null, else that mint's balance, formatted with the
 *  given decimals. The mint read goes through the ATAs (see
 *  solanaMintRawBalance) — the previous implementation filtered
 *  getTokenAccountsByOwner by { mint, programId } together, a filter
 *  shape the RPC itself rejects, and swallowed the rejection into a
 *  false "0.0" (it returned 0 for an address holding 1109.54 USDC).
 *  A transport failure now THROWS, so the swap sheet's pre-flight
 *  sees "couldn't check" (its null path) instead of a fake zero. */
export async function getSolanaTokenBalance(address, mint = null, decimals = 6) {
  if (!mint) {
    const bal = await solanaRpc("getBalance", [address]);
    return solLamportsToSol((bal && bal.value) ?? 0);
  }
  const held = await solanaMintRawBalance(address, mint);
  return ethers.formatUnits(held.raw, decimals);
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

// ---------- TON (SLIP-0010 Ed25519 branch, coin type 607) ----------
// TON keys are Ed25519, derived exactly like Solana's at m/44'/607'/0'
// (TON's registered coin type; the path ends at the account level —
// that is the path Tonkeeper and the hardware wallets use). A TON
// "address" is not the public key: it is the hash of the wallet
// contract's StateInit (code + data holding the key), so the same key
// yields one address per wallet-contract version. Fluid uses Wallet
// V4R2 — the long-standing default across TON wallets (V5 exists but
// V4R2 remains the interoperability baseline). Derivation and the
// address were cross-checked against TWO independent implementations
// (@ton/ton's WalletContractV4 and tonweb's v4R2) in scratch, and the
// V4 signature scheme was verified by rebuilding the signing message
// by hand and checking @ton/ton's signature under noble Ed25519.
// Reads and broadcast ride toncenter (keyless; ~1 req/s courtesy
// rate, respected by keeping reads sequential and few).
const TONCENTER_V2 = "https://toncenter.com/api/v2/jsonRPC";
const TONCENTER_V3 = "https://toncenter.com/api/v3";
export const TON_EXPLORER = "https://tonviewer.io";
// Tether's USDT jetton master on TON — verified live 2026-11-06
// against toncenter v3 /jetton/masters: jetton content points at
// tether.to, 6 decimals, ~1.43 trillion (raw) total supply.
export const TON_USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
export const TON_USDT = { symbol: "USDT", name: "Tether USD", address: TON_USDT_MASTER, decimals: 6, verified: true, priceUsd: 1 };
// What a V4 transfer parks for network fees; the unused part returns
// to the sender with the wallet's answer message. Disclosed in the
// intent sentence rather than buried.
export const TON_FEE_RESERVE = "0.05";

/** The wallet's TON private seed: BIP39 seed → m/44'/607'/0'. */
export function tonSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 607, 0]).key;
}
function tonKeypair(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return tonKeyPairFromSeed(Buffer.from(tonSeedFromSeed(mnemonicToSeedSync(clean))));
}
function tonWalletContract(publicKey) {
  return TonWalletContractV4.create({ publicKey, workchain: 0 });
}
function tonFriendly(address) {
  return address.toString({ bounceable: true, urlSafe: true });
}
/** TON Wallet V4R2 address for a raw BIP39 seed. */
export function tonAddressFromSeed(seed) {
  return tonFriendly(tonWalletContract(tonKeyPairFromSeed(Buffer.from(tonSeedFromSeed(seed))).publicKey).address);
}
/** The TON address of the wallet's main account. */
export function tonAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return tonAddressFromSeed(mnemonicToSeedSync(clean));
}
/** A valid TON address: raw ("0:…") or user-friendly, parseable. */
export function isValidTonAddress(address) {
  try { TonAddress.parse(String(address || "").trim()); return true; } catch { return false; }
}
export function tonNanoToTon(nano) { return tonFromNano(BigInt(nano)); }
export function tonTonToNano(amount) { return tonToNano(String(amount)); }

async function tonV2(method, params) {
  const res = await fetch(TONCENTER_V2, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error("TON network error (HTTP " + res.status + ").");
  return data.result;
}
async function tonV3(path) {
  const res = await fetch(TONCENTER_V3 + path, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("TON network error (HTTP " + res.status + ").");
  return data;
}
const tonMasterMetaCache = new Map();
/** Jetton master metadata (name/symbol/decimals) from toncenter's
 *  content record, following the metadata URI when the content only
 *  points at one. Best-effort: nulls when nothing answers. */
async function tonJettonMeta(masterRaw) {
  if (tonMasterMetaCache.has(masterRaw)) return tonMasterMetaCache.get(masterRaw);
  let meta = { name: null, symbol: null, decimals: null };
  try {
    const data = await tonV3("/jetton/masters?address=" + encodeURIComponent(masterRaw));
    const content = data?.jetton_masters?.[0]?.jetton_content || {};
    meta = { name: content.name || null, symbol: content.symbol || null,
             decimals: content.decimals != null ? Number(content.decimals) : null };
    if ((!meta.symbol || meta.decimals == null) && content.uri && /^https?:\/\//.test(content.uri)) {
      try {
        const r = await fetch(content.uri, { signal: AbortSignal.timeout(10000) });
        const j = await r.json().catch(() => null);
        if (j) {
          meta.name = meta.name || j.name || null;
          meta.symbol = meta.symbol || j.symbol || null;
          if (meta.decimals == null && j.decimals != null) meta.decimals = Number(j.decimals);
        }
      } catch { /* metadata URI unreachable — the row still surfaces */ }
    }
  } catch { /* master read failed — the row still surfaces, unlabelled */ }
  tonMasterMetaCache.set(masterRaw, meta);
  return meta;
}
function tonNativeRow(amount) {
  return { symbol: "TON", name: "Toncoin", amount, address: null, decimals: 9, verified: true };
}
/** The full TON account state: native balance + account state +
 *  EVERY jetton wallet toncenter's indexer knows for the address
 *  (the universal-token rule). USDT is the one verified jetton —
 *  matched by master contract, never by name; every other jetton is
 *  unverified by default. A failed jetton read degrades to the
 *  native row plus a zero USDT row with jettonsFailed set — the UI
 *  says "scan unavailable" rather than faking an empty wallet. */
export async function getTonAccount(address) {
  if (!isValidTonAddress(address)) throw new Error("That is not a valid TON address.");
  const parsed = TonAddress.parse(address);
  const [balanceNano, state] = await Promise.all([
    tonV2("getAddressBalance", { address }),
    tonV2("getAddressState", { address }).catch(() => "unknown"),
  ]);
  const balances = [tonNativeRow(tonFromNano(BigInt(balanceNano)))];
  let jettonsFailed = false;
  try {
    const data = await tonV3("/jetton/wallets?owner_address=" + encodeURIComponent(address) + "&limit=128&offset=0");
    const wallets = data?.jetton_wallets || [];
    let usdtSeen = false;
    for (const w of wallets) {
      const master = TonAddress.parse(w.jetton);
      const masterFriendly = tonFriendly(master);
      if (masterFriendly === TON_USDT_MASTER) {
        usdtSeen = true;
        balances.push({ ...TON_USDT, amount: ethers.formatUnits(BigInt(w.balance || "0"), TON_USDT.decimals) });
        continue;
      }
      const meta = await tonJettonMeta(master.toRawString());
      const decimals = meta.decimals != null && Number.isFinite(meta.decimals) ? meta.decimals : 9;
      balances.push({
        symbol: meta.symbol || shortAddrLabel(masterFriendly), name: meta.name || "Jetton",
        amount: ethers.formatUnits(BigInt(w.balance || "0"), decimals),
        address: masterFriendly, decimals, verified: false, priceUsd: null,
      });
    }
    if (!usdtSeen) balances.push({ ...TON_USDT, amount: "0" });
  } catch { jettonsFailed = true; balances.push({ ...TON_USDT, amount: "0" }); }
  return { state, balances, jettonsFailed };
}
/** TON balances shaped like the other families' row lists. */
export async function getTonBalances(address) {
  return (await getTonAccount(address)).balances;
}
/** The sender's jetton wallet address for a master, via toncenter's
 *  indexer (null when the sender has no wallet for it yet). */
async function tonJettonWalletOf(ownerAddress, masterAddress) {
  const data = await tonV3("/jetton/wallets?owner_address=" + encodeURIComponent(ownerAddress)
    + "&jetton_address=" + encodeURIComponent(masterAddress) + "&limit=1");
  const w = data?.jetton_wallets?.[0];
  return w ? w.address : null; // raw "0:…" form
}
/** Read-only pre-flight for the send sheet (mirrors stellarSendPlan). */
export async function tonSendPlan(fromAddress, { token = null } = {}) {
  const plan = { feeTon: TON_FEE_RESERVE, balanceTon: null, state: null, jettonWallet: null };
  try {
    const [balanceNano, state] = await Promise.all([
      tonV2("getAddressBalance", { address: fromAddress }),
      tonV2("getAddressState", { address: fromAddress }).catch(() => "unknown"),
    ]);
    plan.balanceTon = tonFromNano(BigInt(balanceNano)); plan.state = state;
  } catch { /* stays null — sendTon re-checks authoritatively */ }
  if (token) {
    try { plan.jettonWallet = await tonJettonWalletOf(fromAddress, token.address); } catch { /* stays null */ }
  }
  return plan;
}
/** The signer principle, TON edition: a sentence, never a blob. */
export function formatTonSendIntent({ amount, symbol, to, isJetton = false }) {
  let s = `Send ${amount} ${symbol} to ${to} on TON.`;
  s += ` About ${TON_FEE_RESERVE} TON is set aside for network fees${isJetton ? " (jetton transfers move through your token wallet contract)" : ""} — what isn't used comes back to you.`;
  return s + " Confirm?";
}
function tonParseAmount(amount, decimals) {
  try { return ethers.parseUnits(String(amount), decimals); }
  catch { throw new Error(`TON amounts can have at most ${decimals} decimal places.`); }
}
/** The TEP-74 jetton transfer body (op 0xf8a7ea5) — the standard
 *  layout every TON wallet builds: query id, amount, destination,
 *  response destination (excess fees come back), no custom payload,
 *  a 0.01 TON forward so the recipient's wallet posts the credit. */
export function tonJettonTransferBody({ queryId = 0n, amountRaw, to, responseTo }) {
  return tonBeginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(BigInt(queryId), 64)
    .storeCoins(BigInt(amountRaw))
    .storeAddress(TonAddress.parse(to))
    .storeAddress(TonAddress.parse(responseTo))
    .storeBit(0) // no custom payload
    .storeCoins(10000000n) // forward_ton_amount: 0.01 TON
    .storeBit(0) // forward payload: empty, in place
    .endCell();
}
/** Build, sign LOCALLY with the derived TON keypair, and submit a
 *  transfer (native TON or a jetton). The external message is
 *  assembled here — state-init included when the wallet contract
 *  isn't deployed yet — and only the finished BOC touches the
 *  network. Returns {hash} = the external message hash. */
export async function sendTon(phrase, { to, amount, token = null }) {
  if (!isValidTonAddress(to)) throw new Error("That is not a valid TON address.");
  const kp = tonKeypair(phrase);
  const wallet = tonWalletContract(kp.publicKey);
  const from = tonFriendly(wallet.address);
  const state = await tonV2("getAddressState", { address: from }).catch(() => "unknown");
  const balanceNano = BigInt(await tonV2("getAddressBalance", { address: from }));
  const feeReserve = tonToNano(TON_FEE_RESERVE);
  let seqno = 0;
  if (state === "active") {
    const r = await tonV2("runGetMethod", { address: from, method: "seqno", stack: [] });
    seqno = Number(BigInt(r?.stack?.[0]?.[1] ?? "0x0"));
  }
  let message;
  if (!token) {
    const amt = tonParseAmount(amount, 9);
    if (amt <= 0n) throw new Error("Enter an amount.");
    if (amt + feeReserve > balanceNano) {
      throw new Error(`Not enough TON — a transfer needs the amount plus about ${TON_FEE_RESERVE} TON set aside for fees (you have ${tonFromNano(balanceNano)} TON).`);
    }
    message = tonInternal({ to: TonAddress.parse(to), value: amt, bounce: false });
  } else {
    const raw = tonParseAmount(amount, token.decimals);
    if (raw <= 0n) throw new Error("Enter an amount.");
    if (feeReserve > balanceNano) {
      throw new Error(`Jetton transfers are paid for in TON — you need about ${TON_FEE_RESERVE} TON for fees (you have ${tonFromNano(balanceNano)} TON).`);
    }
    const jw = await tonJettonWalletOf(from, token.address);
    if (!jw) throw new Error(`You have no ${token.symbol} wallet on TON to send from.`);
    message = tonInternal({
      to: TonAddress.parse(jw), value: feeReserve, bounce: true,
      body: tonJettonTransferBody({ amountRaw: raw, to, responseTo: from }),
    });
  }
  const body = wallet.createTransfer({
    seqno, secretKey: kp.secretKey, timeout: Math.floor(Date.now() / 1000) + 300,
    sendMode: 3, messages: [message],
  });
  const extCell = tonBeginCell().store(tonStoreMessage(tonExternal({
    to: wallet.address, init: state === "active" ? undefined : wallet.init, body,
  }))).endCell();
  const res = await fetch(TONCENTER_V2, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendBoc", params: { boc: extCell.toBoc().toString("base64") } }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error("TON rejected the transfer (" + (data?.error || ("HTTP " + res.status)) + ").");
  }
  return { hash: extCell.hash().toString("hex") };
}

// ---------- NEAR (SLIP-0010 Ed25519 branch, coin type 397) ----------
// NEAR keys are Ed25519 at m/44'/397'/0'/0'/0' — the path NEAR's own
// tooling (near-seed-phrase / Ledger) uses. The account IS the key:
// an "implicit account" whose id is simply the hex of the public key.
// Derivation was cross-checked against the independent ed25519-hd-key
// package (key AND chain code), and the transaction format was
// validated byte-for-byte: Fluid's hand-rolled borsh serializer
// produces exactly near-api-js's bytes for both Transfer and
// FunctionCall actions, and noble's signature over sha256(tx) is
// byte-identical to near-api-js's KeyPair signature. So NEAR ships
// with NO runtime dependency on near-api-js — plain fetch + borsh.
// NEAR's account-existence rule is enforced in code: an account must
// always hold storage_usage × storage_amount_per_byte (a fresh
// implicit account: 182 bytes × 10^19 yocto = 0.00182 NEAR), and a
// transfer to a not-yet-existing implicit account must carry at
// least that much or the network refuses to create it.
const NEAR_RPC = "https://rpc.mainnet.near.org";
export const NEAR_EXPLORER = "https://nearblocks.io";
// NEP-141 contracts verified live 2026-11-06 via ft_metadata on the
// public RPC: Circle's native USDC (the hex-named contract Circle
// deployed), Tether's native USDt, the Rainbow Bridge USDC.e/USDT.e,
// and wNEAR. Every one of them answered with the expected symbol and
// decimals; nothing else is marked verified on NEAR.
export const NEAR_TOKENS = [
  { symbol: "USDC", name: "USD Coin (Circle, native)", address: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", decimals: 6, verified: true, priceUsd: 1 },
  { symbol: "USDT", name: "Tether USD (native)", address: "usdt.tether-token.near", decimals: 6, verified: true, priceUsd: 1 },
  { symbol: "USDC.e", name: "Bridged USDC (Rainbow Bridge)", address: "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near", decimals: 6, verified: true, priceUsd: 1 },
  { symbol: "USDT.e", name: "Tether USD (Rainbow Bridge)", address: "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near", decimals: 6, verified: true, priceUsd: 1 },
  { symbol: "wNEAR", name: "Wrapped NEAR", address: "wrap.near", decimals: 24, verified: true },
];
const NEAR_FRESH_ACCOUNT_BYTES = 182n;
const NEAR_STORAGE_BYTE_FALLBACK = 10000000000000000000n; // 10^19 yocto/byte, the protocol value since genesis
const NEAR_FT_GAS = 30000000000000n;        // 30 TGas per function call
const NEAR_FT_REGISTER_FALLBACK = 1250000000000000000000n; // 0.00125 NEAR, the ecosystem-standard ft registration deposit

/** The wallet's NEAR private seed: BIP39 seed → m/44'/397'/0'/0'/0'. */
export function nearSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 397, 0, 0, 0]).key;
}
function nearKey(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return nearSeedFromSeed(mnemonicToSeedSync(clean));
}
/** NEAR implicit account id (hex public key) for a raw BIP39 seed. */
export function nearAddressFromSeed(seed) {
  return hex.encode(ed25519.getPublicKey(nearSeedFromSeed(seed)));
}
/** The NEAR implicit account of the wallet's main key. */
export function nearAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return nearAddressFromSeed(mnemonicToSeedSync(clean));
}
const NEAR_NAMED_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
/** A valid NEAR account id: a 64-hex implicit id or a named account. */
export function isValidNearAddress(address) {
  const s = String(address || "").trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(s)) return true;
  return s.length >= 2 && s.length <= 64 && NEAR_NAMED_RE.test(s);
}
export function nearIsImplicit(address) { return /^[0-9a-f]{64}$/.test(String(address || "").trim().toLowerCase()); }
export function nearYoctoToNear(yocto) { return ethers.formatUnits(BigInt(yocto), 24); }
export function nearNearToYocto(amount) { return ethers.parseUnits(String(amount), 24); }

async function nearRpc(method, params) {
  const res = await fetch(NEAR_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "fluid", method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("NEAR network error (HTTP " + res.status + ").");
  if (data.error) {
    const err = new Error(data.error.data?.message || data.error.cause?.name || data.error.message || "NEAR RPC error");
    err.nearCause = data.error.data?.name || data.error.cause?.name || "";
    throw err;
  }
  return data.result;
}
async function nearQuery(requestType, args) {
  return nearRpc("query", { request_type: requestType, finality: "final", ...args });
}
function nearQueryErrorIs(error, name) {
  return error?.nearCause === name || String(error?.message || "").includes(name);
}
/** A view-function call; returns the decoded JSON value (or null when
 *  the contract itself answered JSON null). RPC-level failures throw. */
async function nearCallView(accountId, methodName, args = {}) {
  const r = await nearQuery("call_function", {
    account_id: accountId, method_name: methodName,
    args_base64: base64.encode(new TextEncoder().encode(JSON.stringify(args))),
  });
  if (r.error) throw new Error("NEAR view call failed: " + r.error);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(r.result)));
}
let nearStorageByteCache = null;
/** The protocol's storage price (yocto per byte), read live from the
 *  protocol config; the genesis value is the fallback. */
export async function nearStoragePerByte() {
  if (nearStorageByteCache) return nearStorageByteCache;
  try {
    const cfg = await nearRpc("EXPERIMENTAL_protocol_config", { finality: "final" });
    nearStorageByteCache = BigInt(cfg?.runtime_config?.storage_amount_per_byte ?? NEAR_STORAGE_BYTE_FALLBACK);
  } catch { nearStorageByteCache = NEAR_STORAGE_BYTE_FALLBACK; }
  return nearStorageByteCache;
}
/** Minimum NEAR an account with `storageUsage` bytes must always
 *  hold to exist. A fresh implicit account is 182 bytes → 0.00182. */
export function nearMinExistYocto(storageUsage) {
  return BigInt(storageUsage ?? NEAR_FRESH_ACCOUNT_BYTES) * NEAR_STORAGE_BYTE_FALLBACK;
}
function nearNativeRow(amount) {
  return { symbol: "NEAR", name: "NEAR Protocol", amount, address: null, decimals: 24, verified: true };
}
/** The full NEAR account state: existence, NEAR balance, storage,
 *  and every curated NEP-141 balance (ft_balance_of per contract —
 *  an unregistered account simply reads 0). A non-existent account
 *  returns exists:false with zero rows, never an error. */
export async function getNearAccount(address) {
  if (!isValidNearAddress(address)) throw new Error("That is not a valid NEAR account id.");
  let rec = null;
  try { rec = await nearQuery("view_account", { account_id: address }); }
  catch (e) { if (!nearQueryErrorIs(e, "UNKNOWN_ACCOUNT")) throw e; }
  if (!rec) return { exists: false, storageUsage: 0, balances: [nearNativeRow("0"), ...NEAR_TOKENS.map(t => ({ ...t, amount: "0" }))] };
  const balances = [nearNativeRow(nearYoctoToNear(rec.amount))];
  for (const t of NEAR_TOKENS) {
    let amount = "0";
    try {
      const raw = await nearCallView(t.address, "ft_balance_of", { account_id: address });
      amount = ethers.formatUnits(BigInt(raw ?? "0"), t.decimals);
    } catch { /* one bad contract must not break the list */ }
    balances.push({ ...t, amount });
  }
  return { exists: true, storageUsage: rec.storage_usage || 0, balances };
}
/** NEAR balances shaped like the other families' row lists. */
export async function getNearBalances(address) {
  return (await getNearAccount(address)).balances;
}
// ----- hand-rolled borsh (validated byte-for-byte vs near-api-js) -----
function nearBStr(s) {
  const b = new TextEncoder().encode(s);
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, b.length, true);
  return [...len, ...b];
}
function nearBBytes(b) {
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, b.length, true);
  return [...len, ...b];
}
function nearU64(n) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return [...b]; }
function nearU128(n) {
  const b = new Uint8Array(16); const v = BigInt(n);
  for (let i = 0; i < 16; i++) b[i] = Number((v >> BigInt(8 * i)) & 0xffn);
  return [...b];
}
/** Action enum 3 — Transfer { deposit: u128 }. */
export function nearActionTransfer(depositYocto) { return [3, ...nearU128(depositYocto)]; }
/** Action enum 2 — FunctionCall { method, args, gas, deposit }. */
export function nearActionFunctionCall(methodName, argsBytes, gas, depositYocto) {
  return [2, ...nearBStr(methodName), ...nearBBytes(argsBytes), ...nearU64(gas), ...nearU128(depositYocto)];
}
/** Serialize an unsigned NEAR transaction (the exact bytes the
 *  signature covers via sha256). */
export function nearTransactionBytes({ signerId, publicKey, nonce, receiverId, blockHash, actions }) {
  const out = [
    ...nearBStr(signerId), 0, ...publicKey, ...nearU64(nonce), ...nearBStr(receiverId), ...blockHash,
    ...(() => { const l = new Uint8Array(4); new DataView(l.buffer).setUint32(0, actions.length, true); return [...l]; })(),
  ];
  for (const a of actions) out.push(...a);
  return Uint8Array.from(out);
}
/** Serialize a signed transaction for broadcast_tx_commit. */
export function nearSignedTransactionBytes(txBytes, signature) {
  return Uint8Array.from([...txBytes, 0, ...signature]);
}
/** Read-only pre-flight for the send sheet: existence of both sides,
 *  the sender's existence minimum, and (for tokens) whether the
 *  recipient is registered on the token contract. */
export async function nearSendPlan(fromAddress, { to: toRaw, token = null } = {}) {
  const to = String(toRaw || "").trim().toLowerCase();
  const plan = { senderExists: null, senderNear: null, minExistNear: null, destExists: null, destRegistered: null, registerNear: null };
  try {
    const s = await nearQuery("view_account", { account_id: fromAddress });
    plan.senderExists = true;
    plan.senderNear = nearYoctoToNear(s.amount);
    plan.minExistNear = nearYoctoToNear(BigInt(s.storage_usage || 0) * (await nearStoragePerByte()));
  } catch (e) { if (nearQueryErrorIs(e, "UNKNOWN_ACCOUNT")) plan.senderExists = false; }
  try { await nearQuery("view_account", { account_id: to }); plan.destExists = true; }
  catch (e) { if (nearQueryErrorIs(e, "UNKNOWN_ACCOUNT")) plan.destExists = false; }
  if (token && plan.destExists) {
    try {
      const bal = await nearCallView(token.address, "storage_balance_of", { account_id: to });
      plan.destRegistered = bal !== null;
      if (!bal) {
        const bounds = await nearCallView(token.address, "storage_balance_bounds", {}).catch(() => null);
        plan.registerNear = nearYoctoToNear(bounds?.min ?? NEAR_FT_REGISTER_FALLBACK);
      }
    } catch { /* stays null — sendNear re-checks authoritatively */ }
  }
  return plan;
}
/** The signer principle, NEAR edition: a sentence, never a blob. */
export function formatNearSendIntent({ amount, symbol, to, createsAccount = false, registerCostNear = null }) {
  let s = `Send ${amount} ${symbol} to ${to} on NEAR.`;
  if (createsAccount) s += " This creates the recipient's account — the amount covers its storage deposit.";
  if (registerCostNear) s += ` The recipient isn't registered for ${symbol} yet, so about ${registerCostNear} NEAR from your balance registers them (a storage deposit on the token contract).`;
  return s + " Network fees on NEAR are a fraction of a cent. Confirm?";
}
function nearJsonArgs(obj) { return new TextEncoder().encode(JSON.stringify(obj)); }
/** Build, sign LOCALLY with the derived NEAR key, and broadcast a
 *  transfer — native NEAR or an NEP-141 token (with the recipient's
 *  storage registration folded into the same transaction when they
 *  aren't registered yet). Every NEAR rule is enforced here in code
 *  before signing, with a plain message. Returns {hash}. */
export async function sendNear(phrase, { to, amount, token = null }) {
  const dest = String(to || "").trim().toLowerCase();
  if (!isValidNearAddress(dest)) throw new Error("That is not a valid NEAR account id.");
  const key = nearKey(phrase);
  const pub = ed25519.getPublicKey(key);
  const from = hex.encode(pub);
  const sender = await nearQuery("view_account", { account_id: from }).catch(e => {
    if (nearQueryErrorIs(e, "UNKNOWN_ACCOUNT")) return null;
    throw e;
  });
  if (!sender) throw new Error("Your NEAR account doesn't exist yet — it needs to receive at least 0.00182 NEAR before it can send.");
  const senderYocto = BigInt(sender.amount);
  const perByte = await nearStoragePerByte();
  const minExist = BigInt(sender.storage_usage || 0) * perByte;
  const accessKey = await nearQuery("view_access_key", { account_id: from, public_key: "ed25519:" + base58.encode(pub) });
  const nonce = BigInt(accessKey.nonce) + 1n;
  const block = await nearRpc("block", { finality: "final" });
  const blockHash = base58.decode(block.header.hash);
  const destRec = await nearQuery("view_account", { account_id: dest }).catch(e => {
    if (nearQueryErrorIs(e, "UNKNOWN_ACCOUNT")) return null;
    throw e;
  });
  let actions, totalNearCost = 0n;
  if (!token) {
    let amt;
    try { amt = nearNearToYocto(amount); } catch { throw new Error("NEAR amounts can have at most 24 decimal places."); }
    if (amt <= 0n) throw new Error("Enter an amount.");
    if (!destRec) {
      if (!nearIsImplicit(dest)) {
        throw new Error("That NEAR account doesn't exist — a plain transfer can't create a named account. Check the account id.");
      }
      const createMin = NEAR_FRESH_ACCOUNT_BYTES * perByte;
      if (amt < createMin) {
        throw new Error(`That account doesn't exist yet, so this transfer would create it — and creating it needs at least ${nearYoctoToNear(createMin)} NEAR to cover its storage.`);
      }
    }
    if (senderYocto - amt < minExist) {
      throw new Error(`That would leave your account below the ${nearYoctoToNear(minExist)} NEAR it must always hold for storage. Lower the amount.`);
    }
    actions = [nearActionTransfer(amt)];
    totalNearCost = amt;
  } else {
    let raw;
    try { raw = ethers.parseUnits(String(amount), token.decimals); } catch { throw new Error(`${token.symbol} amounts can have at most ${token.decimals} decimal places.`); }
    if (raw <= 0n) throw new Error("Enter an amount.");
    if (!destRec) throw new Error("The recipient's NEAR account doesn't exist yet, so it can't hold tokens. They need a NEAR account first.");
    const held = await nearCallView(token.address, "ft_balance_of", { account_id: from }).catch(() => "0");
    if (raw > BigInt(held ?? "0")) throw new Error(`Not enough ${token.symbol} on NEAR (you have ${ethers.formatUnits(BigInt(held ?? "0"), token.decimals)}).`);
    actions = [];
    const reg = await nearCallView(token.address, "storage_balance_of", { account_id: dest }).catch(() => null);
    if (reg === null) {
      const bounds = await nearCallView(token.address, "storage_balance_bounds", {}).catch(() => null);
      const regDeposit = BigInt(bounds?.min ?? NEAR_FT_REGISTER_FALLBACK);
      actions.push(nearActionFunctionCall("storage_deposit", nearJsonArgs({ account_id: dest }), NEAR_FT_GAS, regDeposit));
      totalNearCost += regDeposit;
    }
    actions.push(nearActionFunctionCall("ft_transfer",
      nearJsonArgs({ receiver_id: dest, amount: raw.toString(), memo: null }), NEAR_FT_GAS, 1n));
    totalNearCost += 1n;
    // Gas is also paid from the NEAR balance; keep a small cushion
    // above the storage minimum on top of the deposits.
    if (senderYocto - totalNearCost < minExist + (10n ** 21n)) {
      throw new Error(`This token send also spends a little NEAR (registration + fees) and would leave your account below its storage minimum of ${nearYoctoToNear(minExist)} NEAR. Top up your NEAR first.`);
    }
  }
  const txBytes = nearTransactionBytes({
    signerId: from, publicKey: pub, nonce, receiverId: token ? token.address : dest, blockHash, actions,
  });
  const signature = ed25519.sign(sha256(txBytes), key);
  const signed = nearSignedTransactionBytes(txBytes, signature);
  const result = await nearRpc("broadcast_tx_commit", [base64.encode(signed)]);
  const failure = result?.status?.Failure;
  if (failure) {
    const kind = failure?.ActionError?.kind;
    const detail = kind?.FunctionCallError?.ExecutionError || kind?.TransferToClosedAccount
      || (typeof kind === "string" ? kind : null) || failure?.TxExecutionError?.InvalidTxError?.toString?.()
      || "the network rejected it";
    throw new Error("NEAR rejected the transaction (" + detail + ").");
  }
  const hash = result?.transaction?.hash || result?.transaction_outcome?.id;
  if (!hash) throw new Error("NEAR didn't confirm the transaction.");
  return { hash };
}

// ---------- Algorand (SLIP-0010 Ed25519 branch, coin type 283) ----------
// Algorand keys are Ed25519 at m/44'/283'/0'/0'/0'. The address is
// base32(pubkey ‖ last-4-bytes(sha512/256(pubkey))) — hand-rolled
// here and cross-checked character-for-character against
// algosdk.encodeAddress in tests; a signed payment built by algosdk
// from this derived key verifies independently under noble. (Note:
// algosdk's own 25-word mnemonic is a DIFFERENT system — a checksum
// encoding of a raw key, not BIP39. Fluid never uses it; the BIP39
// phrase stays the one backup, and this branch is derived from it
// like every other Ed25519 family.) Reads ride Algonode's free
// public algod; transactions are built and signed by algosdk from
// the derived key (the Stellar pattern: house derivation, SDK
// signing). Algorand's rules are enforced in code: every account
// must keep its min-balance (0.1 ALGO + 0.1 per ASA/app), and an ASA
// can only be sent to an account that has opted into it.
const ALGOD = "https://mainnet-api.algonode.cloud";
export const ALGO_EXPLORER = "https://explorer.perawallet.app";
// Circle's USDC on Algorand — verified live 2026-11-06 against
// Algonode /v2/assets/31566704 (creator is Circle's address,
// unit-name USDC, 6 decimals).
export const ALGO_USDC_ASA = 31566704;
export const ALGO_USDC = { symbol: "USDC", name: "USD Coin", address: String(ALGO_USDC_ASA), decimals: 6, verified: true, priceUsd: 1 };

/** The wallet's Algorand private seed: BIP39 seed → m/44'/283'/0'/0'/0'. */
export function algoSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 283, 0, 0, 0]).key;
}
function algoKey(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return algoSeedFromSeed(mnemonicToSeedSync(clean));
}
/** Algorand address encoding: base32(pubkey ‖ checksum), no padding. */
export function algoAddressFromPubkey(pubkey) {
  const checksum = sha512_256(pubkey).slice(-4);
  return base32.encode(Uint8Array.from([...pubkey, ...checksum])).replace(/=+$/, "");
}
/** Algorand address for a raw BIP39 seed. */
export function algoAddressFromSeed(seed) {
  return algoAddressFromPubkey(ed25519.getPublicKey(algoSeedFromSeed(seed)));
}
/** The Algorand address of the wallet's main account. */
export function algoAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return algoAddressFromSeed(mnemonicToSeedSync(clean));
}
/** Decode an Algorand address back to its 32-byte public key,
 *  verifying length and checksum. Null for anything invalid. */
export function algoAddressDecode(address) {
  try {
    const s = String(address || "").trim().toUpperCase().replace(/=+$/, "");
    if (s.length !== 58) return null;
    const raw = base32.decode(s + "=".repeat((8 - (s.length % 8)) % 8));
    if (raw.length !== 36) return null;
    const pub = raw.slice(0, 32);
    const want = sha512_256(pub).slice(-4);
    if (!want.every((b, i) => raw[32 + i] === b)) return null;
    return pub;
  } catch { return null; }
}
export function isValidAlgorandAddress(address) { return algoAddressDecode(address) !== null; }
export function algoMicroToAlgo(micro) { return ethers.formatUnits(BigInt(micro), 6); }
export function algoAlgoToMicro(amount) { return ethers.parseUnits(String(amount), 6); }

async function algodJson(path) {
  const res = await fetch(ALGOD + path, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
/** One ASA's parameters (unit name, name, decimals). Best-effort:
 *  null when the node doesn't answer — the row still surfaces. */
const algoAssetMetaCache = new Map();
async function algoAssetMeta(assetId) {
  if (algoAssetMetaCache.has(assetId)) return algoAssetMetaCache.get(assetId);
  let meta = null;
  try {
    const { status, data } = await algodJson("/v2/assets/" + assetId);
    if (status === 200 && data?.params) {
      meta = { symbol: data.params["unit-name"] || null, name: data.params.name || null,
               decimals: Number(data.params.decimals ?? 0) };
    }
  } catch { /* stays null */ }
  algoAssetMetaCache.set(assetId, meta);
  return meta;
}
function algoNativeRow(amount) {
  return { symbol: "ALGO", name: "Algorand", amount, address: null, decimals: 6, verified: true };
}
/** The full Algorand account state: ALGO balance, the account's
 *  min-balance, and EVERY ASA it holds (the account record lists
 *  them — the universal-token rule comes free here). USDC (Circle's
 *  ASA 31566704) is the only verified ASA; all others are
 *  unverified. A 404 is an unfunded account — a state, not an
 *  error (the Stellar treatment). */
export async function getAlgorandAccount(address) {
  if (!isValidAlgorandAddress(address)) throw new Error("That is not a valid Algorand address.");
  const { status, data } = await algodJson("/v2/accounts/" + address);
  if (status === 404) {
    return { funded: false, minBalanceAlgo: "0.1", balances: [algoNativeRow("0")] };
  }
  if (status !== 200 || !data) throw new Error("Algorand network error (HTTP " + status + ").");
  const balances = [algoNativeRow(algoMicroToAlgo(data.amount ?? 0))];
  for (const a of data.assets || []) {
    const id = Number(a["asset-id"]);
    if (id === ALGO_USDC_ASA) {
      balances.push({ ...ALGO_USDC, amount: ethers.formatUnits(BigInt(a.amount ?? 0), ALGO_USDC.decimals) });
      continue;
    }
    const meta = await algoAssetMeta(id);
    const decimals = meta?.decimals ?? 0;
    balances.push({
      symbol: meta?.symbol || ("ASA " + id), name: meta?.name || "Algorand asset",
      amount: ethers.formatUnits(BigInt(a.amount ?? 0), decimals),
      address: String(id), decimals, verified: false, priceUsd: null,
    });
  }
  return { funded: true, minBalanceAlgo: algoMicroToAlgo(data["min-balance"] ?? 100000), balances };
}
/** Algorand balances shaped like the other families' row lists. */
export async function getAlgorandBalances(address) {
  return (await getAlgorandAccount(address)).balances;
}
/** Read-only pre-flight for the send sheet. */
export async function algoSendPlan(fromAddress, { to, token = null } = {}) {
  const plan = { senderFunded: null, senderAlgo: null, minBalanceAlgo: null, destFunded: null, destOptedIn: null, feeAlgo: null };
  try {
    const p = await algodJson("/v2/transactions/params");
    if (p.status === 200 && p.data) plan.feeAlgo = algoMicroToAlgo(p.data["min-fee"] ?? 1000);
  } catch { /* stays null */ }
  try {
    const s = await algodJson("/v2/accounts/" + fromAddress);
    plan.senderFunded = s.status === 200;
    if (plan.senderFunded) {
      plan.senderAlgo = algoMicroToAlgo(s.data.amount ?? 0);
      plan.minBalanceAlgo = algoMicroToAlgo(s.data["min-balance"] ?? 100000);
    }
  } catch { /* stays null */ }
  try {
    const d = await algodJson("/v2/accounts/" + to);
    plan.destFunded = d.status === 200;
    if (plan.destFunded && token) {
      plan.destOptedIn = (d.data.assets || []).some(a => Number(a["asset-id"]) === Number(token.address));
    }
  } catch { /* stays null */ }
  return plan;
}
/** The signer principle, Algorand edition: a sentence, never a blob.
 *  With `name` (a Fluid name the recipient was given as), the sentence
 *  shows BOTH the name and the FULL address it resolved to — the same
 *  disclosure formatSendIntent makes for EVM sends (audit L1). */
export function formatAlgoSendIntent({ amount, symbol, to, feeAlgo, name = null }) {
  const dest = name ? `${name}.${FLUID_DOMAIN} (${to})` : to;
  let s = `Send ${amount} ${symbol} to ${dest} on Algorand.`;
  if (feeAlgo != null) s += ` Network fee ${feeAlgo} ALGO.`;
  return s + " Confirm?";
}
/** Build, sign LOCALLY (algosdk, from the derived key), and submit
 *  a payment or ASA transfer. Min-balance and opt-in rules are
 *  enforced here in code before signing, with plain messages.
 *  Returns {hash} = the transaction id. */
export async function sendAlgorand(phrase, { to, amount, token = null }) {
  if (!isValidAlgorandAddress(to)) throw new Error("That is not a valid Algorand address.");
  const key = algoKey(phrase);
  const pub = ed25519.getPublicKey(key);
  const from = algoAddressFromPubkey(pub);
  const sk = Uint8Array.from([...key, ...pub]); // algosdk/nacl secret-key layout
  const senderRes = await algodJson("/v2/accounts/" + from);
  if (senderRes.status !== 200 || !senderRes.data) {
    throw new Error("Your Algorand account doesn't exist yet — it needs to receive ALGO before it can send.");
  }
  const sender = senderRes.data;
  const minBal = BigInt(sender["min-balance"] ?? 100000);
  const client = new algosdk.Algodv2("", ALGOD, "");
  const params = await client.getTransactionParams().do();
  let txn;
  if (!token) {
    let amt;
    try { amt = algoAlgoToMicro(amount); } catch { throw new Error("ALGO amounts can have at most 6 decimal places."); }
    if (amt <= 0n) throw new Error("Enter an amount.");
    txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: from, receiver: to, amount: amt, suggestedParams: params,
    });
    const fee = BigInt(txn.fee);
    if (BigInt(sender.amount) - amt - fee < minBal) {
      throw new Error(`That would leave your account below its minimum balance of ${algoMicroToAlgo(minBal)} ALGO — Algorand accounts must always keep that much. Lower the amount.`);
    }
  } else {
    let raw;
    try { raw = ethers.parseUnits(String(amount), token.decimals); } catch { throw new Error(`${token.symbol} amounts can have at most ${token.decimals} decimal places.`); }
    if (raw <= 0n) throw new Error("Enter an amount.");
    const held = (sender.assets || []).find(a => Number(a["asset-id"]) === Number(token.address));
    if (!held || raw > BigInt(held.amount ?? 0)) {
      throw new Error(`Not enough ${token.symbol} on Algorand (you have ${held ? ethers.formatUnits(BigInt(held.amount), token.decimals) : "0"}).`);
    }
    const destRes = await algodJson("/v2/accounts/" + to);
    if (destRes.status !== 200 || !destRes.data) {
      throw new Error("The recipient's Algorand account doesn't exist yet, so it can't hold assets. They need to receive ALGO first.");
    }
    const opted = (destRes.data.assets || []).some(a => Number(a["asset-id"]) === Number(token.address));
    if (!opted) {
      throw new Error(`The recipient can't receive ${token.symbol} yet — on Algorand, an account can only hold an asset it has opted into, and this account hasn't opted into it.`);
    }
    txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: from, receiver: to, assetIndex: Number(token.address), amount: raw, suggestedParams: params,
    });
    const fee = BigInt(txn.fee);
    if (BigInt(sender.amount) - fee < minBal) {
      throw new Error(`Your account must keep its minimum balance of ${algoMicroToAlgo(minBal)} ALGO after the fee. Top up your ALGO first.`);
    }
  }
  const signed = algosdk.signTransaction(txn, sk);
  const { txid } = await client.sendRawTransaction(signed.blob).do();
  try { await algosdk.waitForConfirmation(client, txid, 4); } catch { /* accepted ≠ failed: return the id */ }
  return { hash: txid };
}

// ---------- XRP Ledger (secp256k1 BIP44 branch, coin type 144) ----------
// XRPL accounts in the wider world come in two flavours: Ed25519
// keys (Xaman-style, from a family seed) and secp256k1 keys at the
// BIP44 path m/44'/144'/0'/0/0 — the Ledger/Trezor standard, and the
// one Fluid uses, because it keeps XRPL on the same audited BIP32
// tree as the EVM and Bitcoin accounts: private key → compressed
// public key → account ID = RIPEMD160(SHA256(pubkey)) → classic
// address (base58check, XRPL alphabet). Derivation and the address
// codec were cross-checked against ripple-address-codec; signing was
// validated three ways — noble's DER signature over the
// sha512half signing hash (with prehash DISABLED — noble v2 hashes
// by default, the same trap the BCH build documented) is
// byte-identical to ripple-keypairs' signature, a hand-built signed
// blob round-trips through ripple-binary-codec and verifies, and a
// real mainnet transaction's hash recomputed from its blob matches
// the hash the network reports. Reserve rules are read LIVE from
// server_info on every load — never hardcoded — and enforced in
// code before signing.
// Endpoint order matters (QA F12, 2026-11-07): s2.ripple.com's Clio
// sends NO CORS headers and refuses the preflight, so in a browser
// every call burned its first attempt there. xrplcluster.com and
// xrpl.ws both answer with Access-Control-Allow-Origin: * (verified
// live) — they lead; s2 stays as a last resort for non-browser
// contexts.
const XRPL_RPCS = ["https://xrplcluster.com", "https://xrpl.ws", "https://s2.ripple.com:51234"];
export const XRPL_EXPLORER = "https://xrpscan.com";
// Circle's USDC issuer on XRPL — verified live 2026-11-06 via
// gateway_balances on THIS address (≈5.52M USDC of obligations
// under currency 55534443…). Cautionary note: an address that
// differs from this one by a few characters circulates in project
// briefs — it fails XRPL checksum validation entirely. Only this
// exact address is Circle's.
export const XRPL_USDC_ISSUER = "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE";
export const XRPL_USDC = { symbol: "USDC", currency: "USDC", issuer: XRPL_USDC_ISSUER, decimals: 0, verified: true, priceUsd: 1 };
const XRPL_FULLY_CANONICAL = 2147483648; // tfFullyCanonicalSig

function xrplKeys(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  const master = HDKey.fromMasterSeed(mnemonicToSeedSync(clean));
  const child = master.derive("m/44'/144'/0'/0/0");
  return { privateKey: child.privateKey, publicKey: child.publicKey };
}
/** Classic address from a compressed secp256k1 public key:
 *  base58check(0x00 ‖ RIPEMD160(SHA256(pubkey))) in the XRPL
 *  alphabet. Hand-rolled; pinned against ripple-address-codec. */
export function xrplAddressFromPubkey(pubkey) {
  const accountId = ripemd160(sha256(pubkey));
  const payload = Uint8Array.from([0, ...accountId]);
  const checksum = sha256(sha256(payload)).slice(0, 4);
  return base58xrp.encode(Uint8Array.from([...payload, ...checksum]));
}
/** The XRPL classic address of the wallet's main account. */
export function xrplAddressFromPhrase(phrase) {
  return xrplAddressFromPubkey(xrplKeys(phrase).publicKey);
}
/** Decode a classic address to its 20-byte account ID, verifying
 *  the version byte and checksum. Null for anything invalid. */
export function xrplAddressDecode(address) {
  try {
    const raw = base58xrp.decode(String(address || "").trim());
    if (raw.length !== 25 || raw[0] !== 0) return null;
    const payload = raw.slice(0, 21);
    const want = sha256(sha256(payload)).slice(0, 4);
    if (!want.every((b, i) => raw[21 + i] === b)) return null;
    return raw.slice(1, 21);
  } catch { return null; }
}
export function isValidXrplAddress(address) { return xrplAddressDecode(address) !== null; }
export function xrplDropsToXrp(drops) { return ethers.formatUnits(BigInt(drops), 6); }
export function xrplXrpToDrops(amount) { return ethers.parseUnits(String(amount), 6); }
/** rippled reports non-3-letter currency codes as 160-bit hex in
 *  account_lines; decode those to their ASCII label. */
export function xrplCurrencyLabel(currency) {
  const c = String(currency || "");
  if (/^[0-9A-Fa-f]{40}$/.test(c)) {
    try {
      const bytes = hex.decode(c);
      const label = new TextDecoder().decode(bytes).replace(/\0+$/, "").trim();
      if (label && /^[\x20-\x7E]+$/.test(label)) return label;
    } catch { /* fall through */ }
  }
  return c;
}
async function xrplRpc(method, params) {
  let lastErr = null;
  for (const url of XRPL_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, params: [params] }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) throw new Error("HTTP " + res.status);
      if (data.result.error) {
        const e = new Error(data.result.error_message || data.result.error);
        e.xrplError = data.result.error;
        throw e;
      }
      return data.result;
    } catch (e) {
      // A ledger-level error (actNotFound and friends) is a
      // DEFINITIVE answer, identical on every endpoint — retrying
      // it elsewhere only re-asks the same question, and wrapping
      // it in the aggregate below used to strip the xrplError code
      // getXrplAccount branches on, so every unfunded account read
      // as a network failure (QA F12). Rethrow it untouched. Only
      // transport failures fall through to the next endpoint.
      if (e && e.xrplError) throw e;
      lastErr = e;
    }
  }
  throw new Error("XRP Ledger network error (" + (lastErr?.message || "unreachable") + ").");
}
/** Current reserve requirements (in drops), read live from the
 *  validated ledger: base reserve + per-object increment. */
export async function xrplReserves() {
  const info = await xrplRpc("server_info", {});
  const v = info?.info?.validated_ledger || {};
  const base = BigInt(Math.round(Number(v.reserve_base_xrp ?? 1) * 1e6));
  const inc = BigInt(Math.round(Number(v.reserve_inc_xrp ?? 0.2) * 1e6));
  return { baseDrops: base, incrementDrops: inc };
}
function xrpNativeRow(amount) {
  return { symbol: "XRP", name: "XRP", amount, address: null, currency: null, issuer: null, decimals: 6, verified: true };
}
function xrplTrustlineRow(line) {
  const label = xrplCurrencyLabel(line.currency);
  const isUsdc = label === XRPL_USDC.currency && line.account === XRPL_USDC.issuer;
  return {
    symbol: label, name: isUsdc ? "USD Coin" : `${label} · ${line.account.slice(0, 6)}…${line.account.slice(-4)}`,
    amount: String(line.balance), address: line.currency + ":" + line.account,
    currency: line.currency, issuer: line.account, decimals: 0,
    verified: isUsdc, priceUsd: isUsdc ? 1 : null,
  };
}
/** The full XRPL account state: XRP balance, live reserve figures,
 *  and EVERY trust line (the universal-token rule). An unfunded
 *  account (actNotFound) returns funded:false with a zero row —
 *  the account simply doesn't exist until it receives at least the
 *  base reserve. */
export async function getXrplAccount(address) {
  if (!isValidXrplAddress(address)) throw new Error("That is not a valid XRP Ledger address.");
  const reserves = await xrplReserves();
  let info = null;
  try { info = await xrplRpc("account_info", { account: address, ledger_index: "validated" }); }
  catch (e) { if (e.xrplError !== "actNotFound") throw e; }
  if (!info?.account_data) {
    return { funded: false, ownerCount: 0,
      reserveXrp: xrplDropsToXrp(reserves.baseDrops), baseReserveXrp: xrplDropsToXrp(reserves.baseDrops),
      balances: [xrpNativeRow("0")] };
  }
  const d = info.account_data;
  const linesRes = await xrplRpc("account_lines", { account: address, ledger_index: "validated" }).catch(() => ({ lines: [] }));
  const balances = [xrpNativeRow(xrplDropsToXrp(d.Balance ?? "0"))];
  for (const line of linesRes.lines || []) balances.push(xrplTrustlineRow(line));
  const reserve = reserves.baseDrops + BigInt(d.OwnerCount || 0) * reserves.incrementDrops;
  return { funded: true, ownerCount: d.OwnerCount || 0, sequence: d.Sequence,
    reserveXrp: xrplDropsToXrp(reserve), baseReserveXrp: xrplDropsToXrp(reserves.baseDrops), balances };
}
/** XRPL balances shaped like the other families' row lists. */
export async function getXrplBalances(address) {
  return (await getXrplAccount(address)).balances;
}
/** Read-only pre-flight for the send sheet. */
export async function xrplSendPlan(fromAddress, { to } = {}) {
  const plan = { feeXrp: null, senderFunded: null, senderXrp: null, reserveXrp: null, destFunded: null, baseReserveXrp: null };
  try {
    const fee = await xrplRpc("fee", {});
    plan.feeXrp = xrplDropsToXrp(fee?.drops?.base_fee ?? "10");
  } catch { /* stays null */ }
  try {
    const acct = await getXrplAccount(fromAddress);
    plan.senderFunded = acct.funded;
    plan.senderXrp = acct.balances[0]?.amount ?? "0";
    plan.reserveXrp = acct.reserveXrp;
    plan.baseReserveXrp = acct.baseReserveXrp;
  } catch { /* stays null */ }
  try { plan.destFunded = (await getXrplAccount(to)).funded; } catch { /* stays null */ }
  return plan;
}
/** The signer principle, XRPL edition: a sentence, never a blob. */
export function formatXrplSendIntent({ amount, symbol, to, feeXrp, destinationTag = null }) {
  let s = `Send ${amount} ${symbol} to ${to} on the XRP Ledger.`;
  if (destinationTag != null) s += ` Destination tag: ${destinationTag}.`;
  if (feeXrp != null) s += ` Network fee ${feeXrp} XRP.`;
  return s + " Confirm?";
}
/** Assemble and sign a Payment (the exact path sendXrpl submits).
 *  Exported so tests can prove the production bytes: the blob must
 *  decode via ripple-binary-codec and verify under ripple-keypairs. */
export function xrplSignPayment({ privateKey, publicKey, tx }) {
  const signingHex = xrplEncodeForSigning(tx);
  const hash = sha512(hex.decode(signingHex)).slice(0, 32);
  // noble v2 prehashes by default — XRPL signs the sha512half digest
  // itself, so prehash must be off (the BCH lesson, again).
  const sig = secp256k1.sign(hash, privateKey, { format: "der", lowS: true, prehash: false });
  const signed = {
    ...tx,
    SigningPubKey: hex.encode(publicKey).toUpperCase(),
    TxnSignature: hex.encode(sig).toUpperCase(),
  };
  const blob = xrplEncode(signed);
  const id = sha512(Uint8Array.from([0x54, 0x58, 0x4e, 0x00, ...hex.decode(blob)])).slice(0, 32);
  return { blob, hash: hex.encode(id).toUpperCase() };
}
/** Build, sign LOCALLY with the derived secp256k1 key, and submit a
 *  Payment — native XRP or a trust-line token. Reserve rules are
 *  enforced in code (figures read live) before signing.
 *  `token` is null for XRP, else the row's {currency, issuer};
 *  `destinationTag` is an optional integer exchanges often require.
 *  Returns {hash}. */
export async function sendXrpl(phrase, { to, amount, token = null, destinationTag = null }) {
  if (!isValidXrplAddress(to)) throw new Error("That is not a valid XRP Ledger address (it starts with r).");
  let tag = null;
  if (destinationTag != null && String(destinationTag).trim() !== "") {
    tag = Number(destinationTag);
    if (!Number.isInteger(tag) || tag < 0 || tag > 4294967295) {
      throw new Error("The destination tag must be a whole number between 0 and 4294967295.");
    }
  }
  const { privateKey, publicKey } = xrplKeys(phrase);
  const from = xrplAddressFromPubkey(publicKey);
  const senderInfo = await xrplRpc("account_info", { account: from, ledger_index: "validated" })
    .catch(e => { if (e.xrplError === "actNotFound") return null; throw e; });
  if (!senderInfo?.account_data) {
    throw new Error("Your XRP Ledger account doesn't exist yet — it needs to receive at least the base reserve (1 XRP) before it can send.");
  }
  const sender = senderInfo.account_data;
  const reserves = await xrplReserves();
  const reserve = reserves.baseDrops + BigInt(sender.OwnerCount || 0) * reserves.incrementDrops;
  const feeRes = await xrplRpc("fee", {}).catch(() => null);
  const feeDrops = BigInt(feeRes?.drops?.base_fee ?? "10");
  const senderDrops = BigInt(sender.Balance ?? "0");
  let amountField;
  if (!token) {
    let drops;
    try { drops = xrplXrpToDrops(amount); } catch { throw new Error("XRP amounts can have at most 6 decimal places."); }
    if (drops <= 0n) throw new Error("Enter an amount.");
    const destInfo = await xrplRpc("account_info", { account: to, ledger_index: "validated" })
      .catch(e => { if (e.xrplError === "actNotFound") return null; throw e; });
    if (!destInfo?.account_data && drops < reserves.baseDrops) {
      throw new Error(`That XRP Ledger account doesn't exist yet, so this payment would create it — and creating an account needs at least the base reserve of ${xrplDropsToXrp(reserves.baseDrops)} XRP.`);
    }
    if (senderDrops - drops - feeDrops < reserve) {
      throw new Error(`That would leave your account below its reserve of ${xrplDropsToXrp(reserve)} XRP — the base reserve plus 0.2 XRP per item your account owns (trust lines, offers…). Lower the amount.`);
    }
    amountField = drops.toString();
  } else {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter an amount.");
    const linesRes = await xrplRpc("account_lines", { account: from, ledger_index: "validated" }).catch(() => ({ lines: [] }));
    const line = (linesRes.lines || []).find(l => l.currency === token.currency && l.account === token.issuer);
    if (!line || amt > Number(line.balance)) {
      throw new Error(`Not enough ${xrplCurrencyLabel(token.currency)} on the XRP Ledger (you have ${line ? line.balance : "0"}).`);
    }
    if (senderDrops - feeDrops < reserve) {
      throw new Error(`Your account must keep its reserve of ${xrplDropsToXrp(reserve)} XRP after the fee. Top up your XRP first.`);
    }
    amountField = { currency: token.currency, issuer: token.issuer, value: String(amount) };
  }
  const ledger = await xrplRpc("server_info", {}).catch(() => null);
  const validatedSeq = ledger?.info?.validated_ledger?.seq;
  const tx = {
    TransactionType: "Payment", Account: from, Destination: to, Amount: amountField,
    Fee: feeDrops.toString(), Sequence: sender.Sequence, Flags: XRPL_FULLY_CANONICAL,
    ...(validatedSeq ? { LastLedgerSequence: validatedSeq + 20 } : {}),
    ...(tag != null ? { DestinationTag: tag } : {}),
  };
  const { blob, hash } = xrplSignPayment({ privateKey, publicKey, tx });
  const submitted = await xrplRpc("submit", { tx_blob: blob });
  const engine = submitted?.engine_result;
  if (engine !== "tesSUCCESS") {
    throw new Error("XRP Ledger rejected the payment (" + (submitted?.engine_result_message || engine || "unknown error") + ").");
  }
  return { hash };
}

// ---------- Polkadot Asset Hub (Sr25519, Substrate mnemonic scheme) ----------
// Polkadot does NOT do BIP44: the seed phrase feeds Substrate's own
// scheme — mnemonicToMiniSecret, which is PBKDF2-HMAC-SHA512 over
// the mnemonic's ENTROPY (salt "mnemonic"), a different input from
// the BIP39 seed (which hashes the sentence) — Fluid's other
// families must never be confused with it. The mini-secret seeds an
// Sr25519 pair; the Asset Hub address is that pair at SS58 format 0
// (confirmed live from the chain registry: chainSS58 = 0, DOT with
// 10 decimals). Every step was validated independently: the
// mini-secret matches a hand-computed entropy-route PBKDF2 (noble),
// keyring and primitive derivations agree on the address, and
// sr25519 signatures verify under the canonical primitive. The
// chain connection is plain HTTPS JSON-RPC via @polkadot/api's
// HttpProvider (this VM's egress blocks websockets; the Lucky
// Friday public endpoint answers HTTPS and read the full account
// state live during development). Asset IDs verified live via
// on-chain metadata: 1337 = Circle USDC ("USD Coin", 6 dp),
// 1984 = Tether ("USDt", 6 dp).
const DOT_RPC = "https://rpc-asset-hub-polkadot.luckyfriday.io";
export const DOT_EXPLORER = "https://assethub-polkadot.subscan.io";
export const DOT_TOKENS = [
  { symbol: "USDC", name: "USD Coin", address: "1337", decimals: 6, verified: true, priceUsd: 1 },
  { symbol: "USDT", name: "Tether USD", address: "1984", decimals: 6, verified: true, priceUsd: 1 },
];
let dotKeyringInstance = null;
function dotKeyring() {
  if (!dotKeyringInstance) dotKeyringInstance = new DotKeyring({ type: "sr25519", ss58Format: 0 });
  return dotKeyringInstance;
}
function dotPair(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return dotKeyring().addFromMnemonic(clean);
}
/** The wallet's Polkadot Asset Hub address (SS58 format 0). */
export function dotAddressFromPhrase(phrase) {
  return dotPair(phrase).address;
}
/** A valid SS58 address (any network prefix — the account bytes are
 *  what the chain reads; Fluid's own addresses are format 0). */
export function isValidDotAddress(address) {
  try {
    const raw = dotDecodeAddress(String(address || "").trim());
    return raw.length === 32;
  } catch { return false; }
}
export function dotPlanckToDot(planck) { return ethers.formatUnits(BigInt(planck), 10); }
export function dotDotToPlanck(amount) { return ethers.parseUnits(String(amount), 10); }
let dotApiPromise = null;
/** The shared Asset Hub API connection (HTTPS). A failed attempt
 *  is NOT cached — the next call retries from scratch. */
export function dotApi() {
  if (!dotApiPromise) {
    dotCryptoWaitReady().catch(() => {});
    dotApiPromise = DotApiPromise.create({ provider: new DotHttpProvider(DOT_RPC), noInitWarn: true })
      .catch(e => { dotApiPromise = null; throw e; });
  }
  return dotApiPromise;
}
function dotNativeRow(amount) {
  return { symbol: "DOT", name: "Polkadot", amount, address: null, decimals: 10, verified: true };
}
/** The full Asset Hub account state: DOT (free minus the part the
 *  UI must treat carefully — the raw free balance is shown; the
 *  existential deposit is enforced at send time) plus the verified
 *  stablecoin assets. An account the chain has never seen returns
 *  exists:false with zero rows. NOTE: Asset Hub hosts thousands of
 *  community assets; Fluid checks the two verified stables — the
 *  chain gives no cheap "all assets of one account" query without
 *  an indexer, and inventing one from partial data would lie. */
export async function getDotAccount(address) {
  if (!isValidDotAddress(address)) throw new Error("That is not a valid Polkadot address.");
  const api = await dotApi();
  const acct = await api.query.system.account(address);
  const free = acct.data.free.toString();
  const exists = Number(acct.providers?.toString?.() ?? 0) > 0 || !acct.data.free.isZero();
  const balances = [dotNativeRow(dotPlanckToDot(free))];
  for (const t of DOT_TOKENS) {
    let amount = "0";
    try {
      const entry = await api.query.assets.account(Number(t.address), address);
      if (entry.isSome) amount = ethers.formatUnits(BigInt(entry.unwrap().balance.toString()), t.decimals);
    } catch { /* one asset must not break the list */ }
    balances.push({ ...t, amount });
  }
  return { exists, balances, existentialDepositDot: dotPlanckToDot(api.consts.balances.existentialDeposit.toString()) };
}
/** Asset Hub balances shaped like the other families' row lists. */
export async function getDotBalances(address) {
  return (await getDotAccount(address)).balances;
}
function dotBuildTx(api, pair, { to, amount, token }) {
  if (!token) {
    return api.tx.balances.transferKeepAlive(to, dotDotToPlanck(amount).toString());
  }
  const raw = ethers.parseUnits(String(amount), token.decimals);
  const id = Number(token.address);
  const fn = api.tx.assets.transferKeepAlive ?? api.tx.assets.transfer;
  return fn(id, to, raw.toString());
}
/** Read-only pre-flight for the send sheet: the network's own fee
 *  estimate for exactly this transfer, plus the ED. */
export async function dotSendPlan(phrase, { to, amount, token = null } = {}) {
  const plan = { feeDot: null, senderFreeDot: null, existentialDepositDot: null };
  if (!isValidDotAddress(to)) return plan;
  try {
    const api = await dotApi();
    const pair = dotPair(phrase);
    plan.existentialDepositDot = dotPlanckToDot(api.consts.balances.existentialDeposit.toString());
    const acct = await api.query.system.account(pair.address);
    plan.senderFreeDot = dotPlanckToDot(acct.data.free.toString());
    const tx = dotBuildTx(api, pair, { to, amount, token });
    const info = await tx.paymentInfo(pair);
    plan.feeDot = dotPlanckToDot(info.partialFee.toString());
  } catch { /* stays null — sendDot re-checks authoritatively */ }
  return plan;
}
/** The signer principle, Polkadot edition: a sentence, never a blob. */
export function formatDotSendIntent({ amount, symbol, to, feeDot }) {
  let s = `Send ${amount} ${symbol} to ${to} on Polkadot Asset Hub.`;
  if (feeDot != null) s += ` Network fee ≈ ${feeDot} DOT.`;
  return s + " Confirm?";
}
function dotSubmit(tx, pair) {
  return new Promise((resolve, reject) => {
    let unsub = null, settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; if (unsub) unsub(); fn(v); } };
    tx.signAndSend(pair, (result) => {
      if (result.dispatchError) {
        let detail = result.dispatchError.toString();
        try {
          if (result.dispatchError.isModule) {
            const meta = tx.registry.findMetaError(result.dispatchError.asModule);
            detail = `${meta.section}.${meta.name}`;
          }
        } catch { /* keep the raw form */ }
        done(reject, new Error("Polkadot Asset Hub rejected the transfer (" + detail + ")."));
        return;
      }
      if (result.status?.isInBlock || result.status?.isFinalized) {
        done(resolve, { hash: result.txHash.toHex() });
      }
    }).then(u => { unsub = u; if (settled) u(); }).catch(e => done(reject, e));
  });
}
/** Sign LOCALLY with the Sr25519 pair (@polkadot/api + keyring) and
 *  submit a DOT or asset transfer on Asset Hub. The chain's
 *  existential deposit (read live from the chain's constants —
 *  0.01 DOT at verification time) is enforced in code before
 *  signing: transferKeepAlive at the protocol level, plus Fluid's
 *  own pre-check so the user reads the reason, not an error code. */
export async function sendDot(phrase, { to, amount, token = null }) {
  if (!isValidDotAddress(to)) throw new Error("That is not a valid Polkadot address.");
  const api = await dotApi();
  const pair = dotPair(phrase);
  const acct = await api.query.system.account(pair.address);
  const free = acct.data.free.toBigInt();
  if (free === 0n && !token) {
    throw new Error("Your Asset Hub account doesn't exist yet — it needs to receive DOT before it can send.");
  }
  const ed = api.consts.balances.existentialDeposit.toBigInt();
  const tx = dotBuildTx(api, pair, { to, amount, token });
  const info = await tx.paymentInfo(pair);
  const fee = info.partialFee.toBigInt();
  if (!token) {
    let amt;
    try { amt = dotDotToPlanck(amount); } catch { throw new Error("DOT amounts can have at most 10 decimal places."); }
    if (amt <= 0n) throw new Error("Enter an amount.");
    if (free - amt - fee < ed) {
      throw new Error(`That would leave your account below the existential deposit of ${dotPlanckToDot(ed)} DOT — an Asset Hub account under that amount is deleted and loses the rest. Lower the amount.`);
    }
  } else {
    let raw;
    try { raw = ethers.parseUnits(String(amount), token.decimals); } catch { throw new Error(`${token.symbol} amounts can have at most ${token.decimals} decimal places.`); }
    if (raw <= 0n) throw new Error("Enter an amount.");
    const entry = await api.query.assets.account(Number(token.address), pair.address);
    const held = entry.isSome ? entry.unwrap().balance.toBigInt() : 0n;
    if (raw > held) {
      throw new Error(`Not enough ${token.symbol} on Asset Hub (you have ${ethers.formatUnits(held, token.decimals)}).`);
    }
    if (free - fee < ed) {
      throw new Error(`Your DOT must cover the fee and stay above the existential deposit of ${dotPlanckToDot(ed)} DOT. Top up your DOT first.`);
    }
  }
  return dotSubmit(tx, pair);
}

// ---------- Aptos (SLIP-0010 Ed25519 branch, coin type 637) ----------
// Aptos keys are Ed25519 — the same curve branch as Solana/Sui — at the
// Petra-standard path m/44'/637'/0'/0'/0'. The account address is NOT
// the public key: it is SHA3-256(pubkey || 0x00), the 0x00 being the
// single-signer Ed25519 scheme byte. Same seed phrase, same backup.
//
// Everything transactional here is HAND-ROLLED (a small BCS writer —
// no @aptos-labs/ts-sdk in the bundle) and was validated against that
// SDK as an independent checker before shipping (2026-11-06):
//   - derivation + address match the SDK's Account.fromDerivationPath
//     exactly (test phrase → 0xeb663b…3d3bf, pinned in tests);
//   - for identical inputs, the hand-rolled raw transaction BCS, the
//     signing message (SHA3-256("APTOS::RawTransaction") || raw BCS),
//     and the FULL signed transaction are BYTE-IDENTICAL to the SDK's
//     for an APT coin::transfer, a USDt fungible-asset transfer and a
//     legacy-coin transfer (pinned in tests);
//   - the SDK verifies our noble signature over its own signing
//     message;
//   - END-TO-END on devnet: the faucet created the derived account
//     (its on-chain authentication key IS our derived address), and a
//     transfer built + signed by this exact code path executed
//     successfully (tx 0xf1e9f1fa…fb4, "Executed successfully").
// Two live facts shape the code below: (1) the Aptos Labs public
// gateway REFUSES the BCS submission content type (HTTP 415), so
// sends submit the equivalent JSON form — the node canonicalizes it
// to the same BCS bytes the signature covers, which is exactly what
// the devnet execution proved; (2) APT itself has migrated to the
// fungible-asset standard — the legacy CoinStore resource no longer
// exists even for 0x1 — so the APT balance is read through the
// 0x1::coin::balance VIEW (which understands the migration), with the
// CoinStore read kept only as a fallback.
// Swaps: LI.FI's live chain list (checked 2026-11-06) has NO Aptos
// entry at all — Aptos ships with no swap entries (the Stellar
// precedent), pinned by a test.
export const APTOS_EXPLORER = "https://aptoscan.com";
export const APTOS_COIN_TYPE = "0x1::aptos_coin::AptosCoin";
const APTOS_NODE = "https://fullnode.mainnet.aptoslabs.com/v1";
const APTOS_INDEXER = "https://api.mainnet.aptoslabs.com/v1/graphql";
const APTOS_CHAIN_ID = 1;
export const APTOS_TOKENS = [
  // Circle's NATIVE USDC on Aptos — an FA (metadata object address).
  // Verified on-chain 2026-11-06: the Metadata resource at this
  // address reads name "USDC", symbol "USDC", 6 decimals, project_uri
  // circle.com/usdc, live supply ≈293M; Circle's own docs name this
  // exact address as the native issue (the LayerZero-bridged lzUSDC
  // coin below is a different asset and is labelled as such).
  { symbol: "USDC", name: "USDC", address: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b", decimals: 6, standard: "fa" },
  // Tether's native USDt on Aptos — also an FA. Verified on-chain
  // 2026-11-06: Metadata reads name "Tether USD", symbol "USDt",
  // 6 decimals, project_uri tether.to, live supply ≈630M; Tether's
  // own developer docs name this exact metadata address. The row
  // symbol is "USDT" (the symbol every price source uses); the
  // on-chain symbol "USDt" is preserved in the name.
  { symbol: "USDT", name: "Tether USD (USDt)", address: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b", decimals: 6, standard: "fa" },
];
const APTOS_FA_METADATA_TYPE = "0x1::fungible_asset::Metadata";
const APTOS_APT_FA_METADATA = "0x000000000000000000000000000000000000000000000000000000000000000a";
// LayerZero-bridged USDC (a legacy coin, NOT Circle-issued — Circle's
// migration guide says so explicitly). If a wallet holds it, the
// indexer discovery surfaces it under this honest label, never as
// plain "USDC".
const APTOS_LZ_USDC_COIN_TYPE = "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC";
const APTOS_DUMMY_SIGNATURE = "0x" + "00".repeat(64); // simulate-only; the endpoint rejects real signatures

/** The wallet's Aptos private seed: BIP39 seed → m/44'/637'/0'/0'/0'. */
export function aptosSeedFromSeed(seed) {
  return deriveSlip10Ed25519(seed, [44, 637, 0, 0, 0]).key;
}
/** Aptos address (0x + 64 hex) for a raw BIP39 seed. */
export function aptosAddressFromSeed(seed) {
  const pub = ed25519.getPublicKey(aptosSeedFromSeed(seed));
  return "0x" + hex.encode(sha3_256(Uint8Array.from([...pub, 0x00])));
}
/** The Aptos address of the wallet's main account (Petra path). */
export function aptosAddressFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return aptosAddressFromSeed(mnemonicToSeedSync(clean));
}
/** Canonical Aptos address form: 0x + 64 lowercase hex (Aptos itself
 *  accepts and displays short forms like "0x1"). */
export function normalizeAptosAddress(address) {
  const s = String(address || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(s)) return null;
  return "0x" + s.slice(2).padStart(64, "0");
}
/** A valid Aptos address: 0x-prefixed hex of at most 32 bytes. */
export function isValidAptosAddress(address) {
  return normalizeAptosAddress(address) !== null;
}
export function aptosOctasToApt(octas) { return ethers.formatUnits(BigInt(octas), 8); }
export function aptosAptToOctas(amount) { return ethers.parseUnits(String(amount), 8); }
/** Human amount → raw smallest units for any Aptos asset (exact
 *  decimal math via ethers — never float multiplication). */
export function aptosAmountToRaw(amount, decimals = 8) { return ethers.parseUnits(String(amount), decimals); }

async function aptosRest(path, { method = "GET", body = null } = {}) {
  const res = await fetch(APTOS_NODE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}
/** One fullnode view call; returns the result array. Throws on any
 *  non-200 (a missing account/resource is a chain answer, and the
 *  caller decides what it means). */
async function aptosView(fn, typeArguments, args) {
  const r = await aptosRest("/view", { method: "POST", body: { function: fn, type_arguments: typeArguments, arguments: args } });
  if (!r.ok || !Array.isArray(r.data)) {
    throw new Error("Aptos view " + fn + " failed (HTTP " + r.status + ").");
  }
  return r.data;
}
/** Raw balance (smallest unit, string) of one asset for one owner,
 *  read from the fullnode alone: APT and legacy coins through
 *  coin::balance, fungible assets through the primary store. */
export async function aptosAssetBalanceRaw(owner, token = null) {
  const who = normalizeAptosAddress(owner);
  if (!token || token.standard === "coin") {
    const out = await aptosView("0x1::coin::balance", [token ? token.address : APTOS_COIN_TYPE], [who]);
    return String(out[0] ?? "0");
  }
  const out = await aptosView("0x1::primary_fungible_store::balance", [APTOS_FA_METADATA_TYPE], [who, token.address]);
  return String(out[0] ?? "0");
}
/** The account's APT balance in octas (string). View first (the
 *  post-migration truth), legacy CoinStore resource as fallback. */
async function aptosAptBalanceRaw(owner) {
  try { return await aptosAssetBalanceRaw(owner, null); } catch { /* fall through to the legacy read */ }
  const r = await aptosRest(`/accounts/${owner}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`);
  if (r.ok && r.data && r.data.data && r.data.data.coin) return String(r.data.data.coin.amount ?? "0");
  throw new Error("Aptos balance lookup failed (HTTP " + r.status + ").");
}
/** Every positive balance the Aptos Indexer reports for the owner
 *  (keyless GraphQL, verified live 2026-11-06), each with the asset's
 *  own on-chain metadata joined in: {asset_type, amount,
 *  token_standard ("v1" legacy coin | "v2" fungible asset), metadata
 *  {name, symbol, decimals}}. Throws when the indexer doesn't answer —
 *  callers degrade to the fullnode-only reads, never to fake zeros. */
async function aptosIndexerBalances(owner) {
  const query = `query { current_fungible_asset_balances(where: {owner_address: {_eq: ${JSON.stringify(owner)}}, amount: {_gt: 0}}, limit: 100) { asset_type amount token_standard metadata { name symbol decimals } } }`;
  const res = await fetch(APTOS_INDEXER, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("Aptos indexer error (HTTP " + res.status + ").");
  const data = await res.json().catch(() => null);
  if (!data || data.errors || !data.data) throw new Error("Aptos indexer returned an unreadable reply.");
  return data.data.current_fungible_asset_balances || [];
}
/** Does this address have an on-chain account? The current fullnode
 *  SYNTHESIZES a default /accounts answer for any address (sequence 0,
 *  auth key = the address itself, HTTP 200 — verified live
 *  2026-11-06), so existence is read from the resources list: a
 *  created account always carries its 0x1::account::Account resource;
 *  an uncreated one has an empty list. */
async function aptosAccountExists(owner) {
  const r = await aptosRest(`/accounts/${owner}/resources`);
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Aptos account lookup failed (HTTP " + r.status + ").");
  return r.data.some(x => x && x.type === "0x1::account::Account");
}
/** The Aptos account read, shaped like the other families' account
 *  reads: { exists, balances, scanFailed }. An address the chain has
 *  never seen is a STATE — exists:false, zero rows, painted honestly
 *  as "not yet created" (the Stellar precedent) — never an error.
 *  Rows: native APT first (fullnode view read), the curated USDC/USDT
 *  (always present), then every other asset the indexer reports, with
 *  the bridged lzUSDC explicitly labelled. When the indexer is down,
 *  the curated balances still come from the fullnode (scanFailed). */
export async function getAptosAccount(address) {
  if (!isValidAptosAddress(address)) throw new Error("That is not a valid Aptos address.");
  const owner = normalizeAptosAddress(address);
  if (!(await aptosAccountExists(owner))) {
    return {
      exists: false, scanFailed: false,
      balances: [
        { symbol: "APT", name: "Aptos", amount: "0", address: null, decimals: 8, verified: true },
        ...APTOS_TOKENS.map(t => ({ ...t, amount: "0", verified: true })),
      ],
    };
  }
  const aptRaw = await aptosAptBalanceRaw(owner);
  const rows = [{ symbol: "APT", name: "Aptos", amount: aptosOctasToApt(aptRaw), address: null, decimals: 8, verified: true }];
  let discovered = null;
  try { discovered = await aptosIndexerBalances(owner); } catch { discovered = null; }
  const heldByType = new Map();
  if (discovered) for (const d of discovered) heldByType.set(String(d.asset_type).toLowerCase(), d);
  for (const t of APTOS_TOKENS) {
    const hit = heldByType.get(t.address.toLowerCase());
    let raw = hit ? String(hit.amount ?? "0") : null;
    if (raw === null && discovered === null) {
      // Indexer down: read the curated balance from the fullnode so
      // the row is real, not a placeholder zero.
      try { raw = await aptosAssetBalanceRaw(owner, t); } catch { raw = "0"; }
    }
    rows.push({ ...t, amount: ethers.formatUnits(BigInt(raw ?? "0"), t.decimals), verified: true });
    heldByType.delete(t.address.toLowerCase());
  }
  heldByType.delete(APTOS_COIN_TYPE.toLowerCase());
  heldByType.delete(APTOS_APT_FA_METADATA);
  const others = [...heldByType.values()].filter(d => { try { return BigInt(d.amount) > 0n; } catch { return false; } });
  if (others.length) {
    const meta = new Map();
    for (const d of others) {
      const m = d.metadata || {};
      const isLzUsdc = String(d.asset_type).toLowerCase() === APTOS_LZ_USDC_COIN_TYPE.toLowerCase();
      meta.set(d.asset_type, {
        symbol: isLzUsdc ? "lzUSDC" : (m.symbol || "COIN"),
        name: isLzUsdc ? "LayerZero Bridged USDC" : (m.name || m.symbol || "Unknown asset"),
        decimals: m.decimals != null ? m.decimals : 8,
        standard: d.token_standard === "v1" ? "coin" : "fa",
        priceUsd: null,
      });
    }
    try {
      const dex = await getDexScreenerTokenInfo("aptos", others.map(d => d.asset_type));
      for (const d of others) {
        const info = dex.get(d.asset_type);
        if (info && info.priceUsd != null) meta.get(d.asset_type).priceUsd = info.priceUsd;
      }
    } catch { /* prices are decoration; rows stay unpriced */ }
    for (const d of others) {
      const mm = meta.get(d.asset_type);
      rows.push({ symbol: mm.symbol, name: mm.name, amount: ethers.formatUnits(BigInt(d.amount), mm.decimals),
                  address: d.asset_type, decimals: mm.decimals, standard: mm.standard,
                  verified: false, priceUsd: mm.priceUsd ?? null });
    }
  }
  return { exists: true, balances: rows, scanFailed: discovered === null };
}

// ----- Aptos transactions: hand-rolled BCS (SDK-validated, above) -----
/** Minimal BCS writer — exactly the subset Aptos raw transactions
 *  need: u8/u64, ULEB128, length-prefixed bytes/strings, addresses. */
class AptosBcs {
  constructor() { this.parts = []; }
  push(u8) { this.parts.push(Uint8Array.from(u8)); return this; }
  u8(v) { return this.push([v & 0xff]); }
  u64(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return this.push(b); }
  uleb(v) { let n = BigInt(v); const out = []; do { let byte = Number(n & 0x7fn); n >>= 7n; if (n) byte |= 0x80; out.push(byte); } while (n); return this.push(out); }
  bytes(u8) { this.uleb(u8.length); return this.push(u8); }
  str(s) { return this.bytes(new TextEncoder().encode(s)); }
  addr(a) {
    const h = String(a).replace(/^0x/, "").padStart(64, "0");
    const b = new Uint8Array(32);
    for (let i = 0; i < 32; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return this.push(b);
  }
  done() {
    const out = new Uint8Array(this.parts.reduce((s, p) => s + p.length, 0));
    let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}
/** Write one TypeTag parsed from its string form ("0x1::a::B",
 *  "vector<0x1::a::B>", generics nested) into the writer. The
 *  plain-struct paths are the ones pinned byte-for-byte against the
 *  SDK in tests; generic arguments recurse through aptosTypeTagBytes. */
function aptosWriteTypeTag(b, tag) {
  const { bytes, next } = aptosTypeTagBytes(String(tag), 0);
  if (next !== String(tag).length) throw new Error("Cannot encode Aptos type: " + tag);
  b.push(bytes);
  return b;
}
/** Parse one TypeTag starting at index `from` in `tag`, returning its
 *  BCS bytes and the index just past it (helper for aptosWriteTypeTag's
 *  generic arguments). */
function aptosTypeTagBytes(tag, from) {
  const b = new AptosBcs();
  let i = from;
  if (tag.startsWith("vector<", i)) {
    b.u8(6); const inner = aptosTypeTagBytes(tag, i + "vector<".length);
    b.push(inner.bytes); i = inner.next + 1; // consume '>'
    return { bytes: b.done(), next: i };
  }
  for (const [word, code] of [["bool", 0], ["u8", 1], ["u64", 2], ["u128", 3], ["address", 4], ["signer", 5]]) {
    if (tag.startsWith(word, i) && !/[a-z0-9_]/i.test(tag[i + word.length] || "")) { b.u8(code); return { bytes: b.done(), next: i + word.length }; }
  }
  const m = /^(0x[0-9a-fA-F]{1,64})::([A-Za-z0-9_]+)::([A-Za-z0-9_]+)/.exec(tag.slice(i));
  if (!m) throw new Error("Cannot encode Aptos type: " + tag);
  b.u8(7); b.addr(m[1]); b.str(m[2]); b.str(m[3]); i += m[0].length;
  const args = [];
  if (tag[i] === "<") {
    i++;
    for (;;) {
      const inner = aptosTypeTagBytes(tag, i);
      args.push(inner.bytes); i = inner.next;
      if (tag[i] === ",") { i++; while (tag[i] === " ") i++; continue; }
      if (tag[i] === ">") { i++; break; }
      throw new Error("Cannot encode Aptos type: " + tag);
    }
  }
  b.uleb(args.length); for (const a of args) b.push(a);
  return { bytes: b.done(), next: i };
}
/** The entry-function call a transfer uses, for a balance row:
 *  native APT and legacy coins go through 0x1::coin::transfer<T>;
 *  fungible assets through 0x1::primary_fungible_store::transfer
 *  (type argument = the Metadata struct, per the SDK's own FA
 *  transfer). Returns {fn, typeArguments, argumentsFor(to, raw)} in
 *  the JSON spelling the node accepts, plus the BCS spelling the
 *  signer covers — two renderings of ONE call. */
function aptosTransferCall(token, to, rawAmount) {
  const amt = String(rawAmount);
  if (!token || token.standard === "coin") {
    const coinType = token ? token.address : APTOS_COIN_TYPE;
    return {
      fn: "0x1::coin::transfer", module: ["0x1", "coin", "transfer"], typeArguments: [coinType],
      jsonArguments: [to, amt],
      bcsArguments: [new AptosBcs().addr(to).done(), new AptosBcs().u64(rawAmount).done()],
    };
  }
  return {
    fn: "0x1::primary_fungible_store::transfer", module: ["0x1", "primary_fungible_store", "transfer"],
    typeArguments: [APTOS_FA_METADATA_TYPE],
    jsonArguments: [token.address, to, amt],
    bcsArguments: [new AptosBcs().addr(token.address).done(), new AptosBcs().addr(to).done(), new AptosBcs().u64(rawAmount).done()],
  };
}
/** Build the raw transaction BCS for a transfer. Exported for the
 *  tests, which pin its bytes against the SDK-validated vectors. */
export function aptosBuildRawTransaction({ sender, sequenceNumber, to, amountRaw, token = null, maxGasAmount, gasUnitPrice, expirationTimestampSecs, chainId = APTOS_CHAIN_ID }) {
  const call = aptosTransferCall(token, to, amountRaw);
  const b = new AptosBcs();
  b.addr(sender); b.u64(sequenceNumber);
  b.u8(2); // TransactionPayload variant: EntryFunction
  b.addr(call.module[0]); b.str(call.module[1]); b.str(call.module[2]);
  b.uleb(call.typeArguments.length);
  for (const t of call.typeArguments) aptosWriteTypeTag(b, t);
  b.uleb(call.bcsArguments.length);
  for (const a of call.bcsArguments) b.bytes(a);
  b.u64(maxGasAmount); b.u64(gasUnitPrice); b.u64(expirationTimestampSecs); b.u8(chainId);
  return b.done();
}
/** The Aptos signing message: SHA3-256 of the domain separator
 *  "APTOS::RawTransaction", prepended to the raw transaction BCS. */
export function aptosSigningMessage(rawBytes) {
  const prefix = sha3_256(new TextEncoder().encode("APTOS::RawTransaction"));
  const out = new Uint8Array(prefix.length + rawBytes.length);
  out.set(prefix); out.set(rawBytes, prefix.length);
  return out;
}
/** Sign raw transaction bytes with the wallet's Aptos key (locally,
 *  noble Ed25519). Returns the full signed-transaction BCS plus the
 *  hex parts the JSON submission form needs. */
export function aptosSignRawTransaction(phrase, rawBytes) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  const seedKey = aptosSeedFromSeed(mnemonicToSeedSync(clean));
  const pub = ed25519.getPublicKey(seedKey);
  const signature = ed25519.sign(aptosSigningMessage(rawBytes), seedKey);
  const b = new AptosBcs();
  b.push(rawBytes);
  b.u8(0); // TransactionAuthenticator variant: Ed25519
  b.bytes(pub); b.bytes(signature);
  return { signedBytes: b.done(), publicKey: "0x" + hex.encode(pub), signature: "0x" + hex.encode(signature) };
}
/** The JSON transaction body (simulate + submit share it; only the
 *  signature differs — simulate REQUIRES a dummy signature, the
 *  endpoint rejects real ones with "must not have a valid signature"). */
function aptosTxJson({ sender, sequenceNumber, to, amountRaw, token, maxGasAmount, gasUnitPrice, expirationTimestampSecs, signature, publicKey }) {
  const call = aptosTransferCall(token, to, amountRaw);
  return {
    sender, sequence_number: String(sequenceNumber),
    max_gas_amount: String(maxGasAmount), gas_unit_price: String(gasUnitPrice),
    expiration_timestamp_secs: String(expirationTimestampSecs),
    payload: { type: "entry_function_payload", function: call.fn, type_arguments: call.typeArguments, arguments: call.jsonArguments },
    signature: { type: "ed25519_signature", public_key: publicKey, signature },
  };
}
/** The wallet's Aptos public key (0x hex) — simulation needs it:
 *  the endpoint skips signature verification but DOES check that the
 *  public key hashes to the account's authentication key (verified
 *  live: a zero key simulates as INVALID_AUTH_KEY; the real key
 *  simulates the identical call successfully). */
export function aptosPublicKeyFromPhrase(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  return "0x" + hex.encode(ed25519.getPublicKey(aptosSeedFromSeed(mnemonicToSeedSync(clean))));
}
/** Pre-flight a send: account existence, the chain's own gas estimate
 *  (simulate with a dummy signature — the node's simulation of THIS
 *  exact call), and the fee it implies. The intent sentence quotes
 *  estimatedFeeOctas; the send re-runs the plan fresh and enforces
 *  the worst-case fee before signing. `publicKey` is the sender's
 *  (see aptosPublicKeyFromPhrase) — required for the simulation. */
export async function aptosSendPlan(fromAddress, { to, amountRaw = 1n, token = null, publicKey = null } = {}) {
  const from = normalizeAptosAddress(fromAddress);
  if (!(await aptosAccountExists(from))) return { exists: false };
  const acct = await aptosRest(`/accounts/${from}`);
  if (!acct.ok || !acct.data) throw new Error("Aptos account lookup failed (HTTP " + acct.status + ").");
  if (!publicKey) throw new Error("Aptos planning needs the sender's public key.");
  const sequenceNumber = String(acct.data.sequence_number ?? "0");
  const gasRes = await aptosRest("/estimate_gas_price");
  const gasUnitPrice = BigInt((gasRes.data && gasRes.data.gas_estimate) ?? 100);
  const expirationTimestampSecs = Math.floor(Date.now() / 1000) + 600;
  const sim = await aptosRest("/transactions/simulate", { method: "POST", body: aptosTxJson({
    sender: from, sequenceNumber, to: normalizeAptosAddress(to) || to, amountRaw, token,
    maxGasAmount: 20000n, gasUnitPrice, expirationTimestampSecs,
    signature: APTOS_DUMMY_SIGNATURE, publicKey,
  }) });
  const s0 = Array.isArray(sim.data) ? sim.data[0] : null;
  if (!s0) throw new Error("Aptos simulation didn't answer (HTTP " + sim.status + ").");
  const gasUsed = BigInt(s0.gas_used || 0);
  const maxGasAmount = gasUsed * 3n / 2n + 100n;
  return {
    exists: true, sequenceNumber, gasUnitPrice: gasUnitPrice.toString(),
    maxGasAmount: maxGasAmount.toString(), expirationTimestampSecs,
    estimatedFeeOctas: (gasUsed * gasUnitPrice).toString(),
    simSuccess: !!s0.success, simStatus: String(s0.vm_status || ""),
  };
}
/** The signer principle, Aptos edition: a sentence, never a blob. */
export function formatAptosSendIntent({ amount, symbol, to, feeApt }) {
  let s = `Send ${amount} ${symbol} to ${to} on Aptos.`;
  if (feeApt != null) s += ` Network fee ≈ ${feeApt} APT.`;
  return s + " Confirm?";
}
/** Build, sign (locally) and submit a transfer. `token` is null for
 *  native APT, otherwise a balance row ({address, decimals,
 *  standard}). Submission is the JSON form (the gateway refuses BCS
 *  content — see the family note); the signature covers the local
 *  BCS, which the node canonicalizes identically. Returns {hash}. */
export async function sendAptos(phrase, { to, amount, token = null }) {
  if (!isValidAptosAddress(to)) throw new Error("That is not a valid Aptos address.");
  const recipient = normalizeAptosAddress(to);
  const from = aptosAddressFromPhrase(phrase);
  const decimals = token ? (token.decimals ?? 8) : 8;
  const rawAmount = ethers.parseUnits(String(amount), decimals);
  if (rawAmount <= 0n) throw new Error("Enter an amount.");
  const plan = await aptosSendPlan(from, { to: recipient, amountRaw: rawAmount, token, publicKey: aptosPublicKeyFromPhrase(phrase) });
  if (!plan.exists) {
    throw new Error("Your Aptos account doesn't exist on-chain yet — an account is created when it first receives APT. Receive some APT at this address first, then you can send.");
  }
  if (!plan.simSuccess) {
    throw new Error("The network says this send would fail: " + (plan.simStatus || "simulation failed"));
  }
  const feeWorst = BigInt(plan.maxGasAmount) * BigInt(plan.gasUnitPrice);
  const aptRaw = BigInt(await aptosAptBalanceRaw(from));
  if (!token) {
    if (rawAmount + feeWorst > aptRaw) throw new Error("Not enough APT to cover the amount plus the network fee.");
  } else {
    const held = BigInt(await aptosAssetBalanceRaw(from, token));
    if (held < rawAmount) throw new Error(`Not enough ${token.symbol} on Aptos (you have ${ethers.formatUnits(held, decimals)}).`);
    if (feeWorst > aptRaw) throw new Error("Not enough APT to pay the network fee for this send.");
  }
  const raw = aptosBuildRawTransaction({
    sender: from, sequenceNumber: BigInt(plan.sequenceNumber), to: recipient, amountRaw: rawAmount, token,
    maxGasAmount: BigInt(plan.maxGasAmount), gasUnitPrice: BigInt(plan.gasUnitPrice),
    expirationTimestampSecs: BigInt(plan.expirationTimestampSecs), chainId: APTOS_CHAIN_ID,
  });
  const signed = aptosSignRawTransaction(phrase, raw);
  const sub = await aptosRest("/transactions", { method: "POST", body: aptosTxJson({
    sender: from, sequenceNumber: plan.sequenceNumber, to: recipient, amountRaw: rawAmount, token,
    maxGasAmount: BigInt(plan.maxGasAmount), gasUnitPrice: BigInt(plan.gasUnitPrice),
    expirationTimestampSecs: plan.expirationTimestampSecs,
    signature: signed.signature, publicKey: signed.publicKey,
  }) });
  if (!(sub.status === 202 || sub.status === 200) || !sub.data || !sub.data.hash) {
    const why = (sub.data && sub.data.message) || ("HTTP " + sub.status);
    throw new Error("Aptos rejected the transaction: " + why);
  }
  const hash = sub.data.hash;
  // Poll for the committed result (bounded): success returns, a
  // failed execution throws its vm_status, and a still-pending tx
  // returns its hash — the send DID leave the wallet either way.
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const chk = await aptosRest(`/transactions/by_hash/${hash}`);
    const tx = chk.data;
    if (tx && tx.success === true) return { hash };
    if (tx && tx.success === false) throw new Error("Aptos rejected the transaction: " + (tx.vm_status || "execution failed"));
  }
  return { hash, pending: true };
}

/* ================= Home asset-list ordering (owner request, 2026-11-08) =================
 * What you HOLD belongs at the top of the home list: opening the
 * wallet used to bury a held asset under zero-balance families in a
 * fixed chain order. These two pure helpers are the whole ordering
 * rule — presentation only; they read totals/amounts, never fetch.
 * Both are stable: entries that tie keep the order they were given,
 * so an all-zero wallet renders in exactly the order it always has. */

/** Order home family cards: families HOLDING anything first —
 *  "held" is a RAW-balance fact (entries carry `held` when any raw
 *  amount in the family is nonzero), never a USD fact. The first
 *  version keyed the held tier on totalUsd > 0, so a real holding
 *  whose price was missing (or whose whole price fetch had failed)
 *  classified as zero and sank to its fixed-order slot — the owner's
 *  ALGO buried under a zero BNB card (2026-11-09). USD value only
 *  orders WITHIN the held tier (descending; an unpriced holding
 *  counts as 0 there, so priced holdings lead and unpriced ones
 *  follow in given order — still above every non-held family).
 *  Then families whose balances FAILED to load (total null, or the
 *  family's load-failed flag set) — unknown is not zero, so they
 *  stay visible above the true zeros; then the all-zero families
 *  in their given order.
 *  entries: [{ key, totalUsd (number|null), failed (boolean),
 *              held (boolean, optional) }] */
export function sortHomeFamilies(entries) {
  const tier = (e) => {
    if (e.held || (e.totalUsd != null && e.totalUsd > 0)) return 0;
    if (e.totalUsd == null || e.failed) return 1;
    return 2;
  };
  return entries.map((e, i) => [e, i]).sort((a, b) => {
    const ta = tier(a[0]), tb = tier(b[0]);
    if (ta !== tb) return ta - tb;
    if (ta === 0) { const d = (b[0].totalUsd || 0) - (a[0].totalUsd || 0); if (d !== 0) return d; }
    return a[1] - b[1];
  }).map(([e]) => e);
}

/* ================= Home balance cache (2026-11-09) =================
 * Last-known balances, kept on-device so opening the wallet paints
 * real amounts instantly instead of skeletons for ~30 s while the
 * public endpoints answer. The cache holds ONLY public data —
 * balance rows, scalar balances and the price map, all of which are
 * visible on-chain or from public price feeds. No keys, no seed, no
 * keystore material ever enters it (packBalanceCache copies a fixed
 * field list). It is keyed by the wallet's EVM address, lives under
 * a fluid_* localStorage key (so the full-wipe path removes it with
 * the wallet), and is a PAINT-EARLY layer only: live reads replace
 * it family by family, the UI marks the paint as updating until
 * they land, and a failed live read renders couldn't-load — the
 * cached value is never presented as final. */
export const BALANCE_CACHE_KEY = "fluid_balcache_v1";
const BALANCE_CACHE_ROW_KEYS = ["bitcoin", "tron", "solana", "sui", "stellar", "ton", "near", "algorand", "xrpl", "polkadot", "aptos", "stacks"];
const BALANCE_CACHE_SCALAR_KEYS = ["btcBal", "btcTrBal", "ltcBal", "dogeBal", "bchBal"];

/** Serialise a balance snapshot for the cache. `snap` is the app's
 *  plain-data balance state: { evmNetwork, evmRows, rows: {family:
 *  [...]}, scalars: {btcBal, ...}, cosmosRows, prices }. Anything
 *  not on the fixed field list is dropped. Returns a JSON string,
 *  or null when the snapshot carries nothing worth caching. */
export function packBalanceCache(address, snap, now = Date.now()) {
  if (!address || !snap || typeof snap !== "object") return null;
  const out = { v: 1, address: String(address), t: Number(now) || 0, fams: {} };
  let any = false;
  const rows = snap.rows || {};
  for (const k of BALANCE_CACHE_ROW_KEYS) {
    if (Array.isArray(rows[k])) { out.fams[k] = rows[k]; any = true; }
  }
  if (Array.isArray(snap.cosmosRows)) { out.fams.cosmos = snap.cosmosRows; any = true; }
  if (typeof snap.evmNetwork === "string" && Array.isArray(snap.evmRows)) {
    out.evm = { network: snap.evmNetwork, rows: snap.evmRows }; any = true;
  }
  const sc = snap.scalars || {};
  const scalars = {};
  for (const k of BALANCE_CACHE_SCALAR_KEYS) if (Number.isFinite(Number(sc[k]))) scalars[k] = Number(sc[k]);
  if (Object.keys(scalars).length) { out.scalars = scalars; any = true; }
  if (snap.prices && typeof snap.prices === "object") out.prices = snap.prices;
  return any ? JSON.stringify(out) : null;
}

/** Parse + validate a cached snapshot for `address`. Returns the
 *  snapshot object, or null for anything malformed, foreign (a
 *  different wallet's cache), or from an unknown version — the
 *  caller then simply paints from live reads as before. */
export function unpackBalanceCache(json, address) {
  if (!json || !address) return null;
  let o; try { o = JSON.parse(json); } catch { return null; }
  if (!o || o.v !== 1 || String(o.address).toLowerCase() !== String(address).toLowerCase()) return null;
  if (!o.fams || typeof o.fams !== "object") return null;
  for (const k of Object.keys(o.fams)) if (!Array.isArray(o.fams[k])) return null;
  if (o.evm != null && (typeof o.evm !== "object" || typeof o.evm.network !== "string" || !Array.isArray(o.evm.rows))) return null;
  return o;
}

/** Order rows within one family: positive balances first (USD
 *  value descending), then couldn't-load rows (amount null — the
 *  balance is unknown, never a dressed-up zero), then true-zero
 *  rows in their given order. amountOf/valueOf read the caller's
 *  row shape; an unpriced positive counts as value 0 among the
 *  positives. */
/** Split one family's home rows into the visible main list and the
 *  collapsed "Other tokens" group (2026-11-09 unpriced-native fix).
 *  THE NATIVE ROW IS TESTED FIRST AND UNCONDITIONALLY: a family's
 *  native asset is a main row even when its price is missing (v null)
 *  and even if a data source left verified === false on it — natives
 *  are never "other tokens". A NON-native row joins main only when it
 *  is not flagged unverified AND carries a USD value; an explicit
 *  unverified flag or a missing price keeps a token in the group
 *  (the owner's quarantine for unverified/unpriced tokens). Main is
 *  ordered with sortHomeRows (held, then couldn't-load, then zeros);
 *  the Other group keeps its given order.
 *  rows: balance-row objects; valueOf(b) → USD value or null;
 *  isNative(b) → boolean. Returns { main: [{b, v}], other: [{b, v}] }. */
export function splitHomeRows(rows, valueOf, isNative) {
  const main = [], other = [];
  for (const b of rows) {
    const v = valueOf(b);
    if (isNative(b)) main.push({ b, v });
    else if (b.verified !== false && v != null) main.push({ b, v });
    else other.push({ b, v });
  }
  return { main: sortHomeRows(main, (x) => x.b.amount, (x) => x.v), other };
}

/** Count holdings with no live price (2026-11-09 unpriced-native
 *  fix): rows whose amount is a real number greater than zero and
 *  whose effective price — the row's own priceUsd when the field is
 *  present (even explicitly null), else the symbol-table price — is
 *  null. Failed reads (amount null: the balance is unknown, not
 *  unpriced) and true zeros never count. groups: an iterable of
 *  [rows, priceOf] pairs, where priceOf(b) returns the symbol-table
 *  price for that row (or null). Drives the hero's "+ holdings with
 *  no live price" note; it counts, it never values. */
export function countUnpricedHoldings(groups) {
  let n = 0;
  for (const [rows, priceOf] of groups) {
    if (!Array.isArray(rows)) continue;
    for (const b of rows) {
      if (!b || b.amount == null || !(Number(b.amount) > 0)) continue;
      const p = b.priceUsd !== undefined ? b.priceUsd : priceOf(b);
      if (p == null) n++;
    }
  }
  return n;
}
export function sortHomeRows(items, amountOf, valueOf) {
  const tier = (x) => {
    const a = amountOf(x);
    if (a == null) return 1;
    return Number(a) > 0 ? 0 : 2;
  };
  return items.map((x, i) => [x, i]).sort((p, q) => {
    const tp = tier(p[0]), tq = tier(q[0]);
    if (tp !== tq) return tp - tq;
    if (tp === 0) { const d = (valueOf(q[0]) || 0) - (valueOf(p[0]) || 0); if (d !== 0) return d; }
    return p[1] - q[1];
  }).map(([x]) => x);
}

/* ================= Persisted-metadata safety (security audit 2026-11-06, C1) =================
 * Token symbols/names come from ERC-20 metadata and LI.FI — attacker-
 * controlled strings. Fluid PERSISTS some of them (send history
 * `fluid_history`, swap approval records `fluid_approvals_v1`) and used to
 * render them back into innerHTML UNESCAPED: a token whose symbol() returns
 * markup executed script in the wallet origin on the next Activity /
 * Token-approvals view (stored XSS → password keylogging / seed scraping).
 * The helpers below are the single render path for those two screens now:
 * every persisted value is escaped, history links are rebuilt only from a
 * validated hash or a clean https URL, and symbols are ALSO sanitised at
 * write time (defence in depth — render escaping alone already makes any
 * previously stored payload inert). */

/** Escape a value for interpolation into HTML text or a quoted attribute.
 *  Same entity map as the esc() the token rows and swap pickers use. */
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

/** Write-time sanitiser for token symbols persisted to localStorage:
 *  strips markup characters and control characters, caps the length. */
export function sanitizePersistedSymbol(s) {
  const clean = String(s ?? "").replace(/[<>&"'`\u0000-\u001f\u007f]/g, "").trim().slice(0, 32);
  return clean || "Token";
}

/** Rebuild a history entry's explorer URL — or return null (no link).
 *  A stored `link` is trusted only when it parses as a clean https URL
 *  (anything else, e.g. javascript: or a quote breakout, is DROPPED, never
 *  emitted); otherwise the URL is rebuilt from the explorer base plus a
 *  hash restricted to a conservative charset (hex / base58 / base64url
 *  txids across Fluid's families). */
export function historyTxUrl(x) {
  if (!x || typeof x !== "object") return null;
  const link = typeof x.link === "string" ? x.link.trim() : "";
  if (link) {
    try { const u = new URL(link); return u.protocol === "https:" ? u.href : null; } catch { return null; }
  }
  const hash = typeof x.hash === "string" ? x.hash.trim() : "";
  const explorer = typeof x.explorer === "string" ? x.explorer.trim().replace(/\/+$/, "") : "";
  if (!explorer || !/^[A-Za-z0-9._~-]{8,200}$/.test(hash)) return null;
  try { const u = new URL(explorer + "/tx/" + hash); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}

/** One Activity-history row, fully escaped (the renderHistory render path). */
export function formatHistoryEntry(x) {
  const url = historyTxUrl(x);
  const view = url ? ` · <a target="_blank" rel="noopener" href="${escapeHtml(url)}">view ↗</a>` : "";
  return `<div class="hist">Sent ${escapeHtml(x?.amount)} ${escapeHtml(x?.symbol)} → ${escapeHtml(String(x?.to ?? "").slice(0, 10))}…${view}</div>`;
}

/** One Token-approvals list row's text span, fully escaped. amountText and
 *  dateText are formatted by the caller (fmt / toLocaleDateString) and are
 *  escaped here anyway — spender is sliced AND escaped (a slice of a
 *  hostile string is still hostile). */
export function formatApprovalRow(a, amountText, dateText) {
  const spender = String(a?.spender ?? "");
  return `<span><b>${escapeHtml(a?.tokenSymbol || "Token")}</b> · ${escapeHtml(amountText)}<br><small style="color:var(--dim)">spender ${escapeHtml(spender.slice(0, 6))}…${escapeHtml(spender.slice(-4))} · ${escapeHtml(dateText)}</small></span>`;
}

/** The revoke-confirmation sentence, fully escaped (incl. the network name,
 *  which for discovered chains is registry-controlled data). */
export function formatRevokePrompt(a, networkName) {
  const spender = String(a?.spender ?? "");
  return `Revoke the ${escapeHtml(a?.tokenSymbol || "token")} approval for spender ${escapeHtml(spender.slice(0, 6))}…${escapeHtml(spender.slice(-4))} on ${escapeHtml(networkName || a?.chainKey || "this network")}? This sends an on-chain transaction setting the permission to zero (a network fee applies). The swap that used it already finished — revoking breaks nothing.`;
}

/* ================= Stacks (Bitcoin L2 — Build A, Step 2) =================
 * Stacks is a NON-EVM Bitcoin L2 (settles to Bitcoin via PoX). Full
 * function: balances, receive, sends — hand-rolled against the wire
 * formats in SIP-005/SIP-010, NO @stacks/* runtime dependency (the
 * official SDK is used only as a scratch verifier — see the validation
 * note at the end of this section).
 *
 * Keys: secp256k1 BIP44 m/44'/5757'/0'/0/0 (Stacks' registered coin
 * type), address = c32check(version, hash160(compressed pubkey)),
 * version 22 mainnet (SP…) / 26 testnet (ST…). Derivation cross-checked
 * against @stacks/transactions (getAddressFromPrivateKey) and the
 * c32check package's own decoder — two independent SDK surfaces:
 * test mnemonic → mainnet SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J,
 * testnet STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ (hash160
 * 1859c6840c4dc8ab3a3d39c6b5003fb36c5e7232).
 *
 * Reads: Hiro API (api.hiro.so) keyless — /extended/v1/address/{a}/
 * balances (STX + every SIP-010 balance) and /v2/accounts/{a} (nonce).
 * Token metadata for DISCOVERED tokens is read from the contracts
 * themselves (call-read get-name/get-symbol/get-decimals) and treated
 * as hostile: control characters stripped, lengths capped, decimals
 * range-checked. Pinned tokens (STACKS_TOKENS) are verified against
 * their live on-chain metadata (checked 2026-11-06); everything else
 * renders unverified (⚠).
 *
 * Sends: transactions are built and signed locally (SIP-005 sighash
 * chain: sha512/256, VRS signature). STX = token-transfer payload;
 * SIP-010 = contract-call transfer(uint, principal, principal,
 * optional-buff) with an EXACT-AMOUNT post-condition (SendEq, mode
 * Deny). Fee: Hiro's /v2/fees/transfer rate (µSTX/byte) × tx length —
 * the same algorithm @stacks/transactions uses for transfers — shown
 * in the intent sentence and SANITY-BOUNDED in code (rate and total
 * caps below) before anything is signed. */

export const STACKS_EXPLORER = "https://explorer.hiro.so";
const STACKS_NETWORKS = {
  mainnet: { label: "Stacks", api: "https://api.hiro.so", chainId: 0x00000001, txVersion: 0x00, addressVersion: 22, explorerChain: "mainnet" },
  testnet: { label: "Stacks Testnet", api: "https://api.testnet.hiro.so", chainId: 0x80000000, txVersion: 0x80, addressVersion: 26, explorerChain: "testnet" },
};
export function stacksNetwork(network) { return STACKS_NETWORKS[network === "testnet" ? "testnet" : "mainnet"]; }
export function stacksExplorerTxUrl(txid, network = "mainnet") {
  return `${STACKS_EXPLORER}/txid/${txid}?chain=${stacksNetwork(network).explorerChain}`;
}
// Fee sanity bounds (security directive: fees bounded in code before signing).
export const STACKS_MAX_FEE_RATE_USTX_PER_BYTE = 10_000; // Hiro's live rate is 1
export const STACKS_MAX_FEE_USTX = 50_000n;              // 0.05 STX — far above any sane transfer fee

/* ---------- c32check addresses ---------- */
const C32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function c32EncodeBytes(bytes) {
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  let digits = "";
  while (v > 0n) { digits = C32_ALPHABET[Number(v % 32n)] + digits; v /= 32n; }
  return "0".repeat(leadingZeros) + digits;
}
function c32DecodeToBytes(str) {
  const norm = String(str).toUpperCase().replace(/O/g, "0").replace(/[LI]/g, "1");
  if (![...norm].every(ch => C32_ALPHABET.includes(ch))) throw new Error("Invalid c32 character");
  let leadingZeros = 0;
  while (leadingZeros < norm.length && norm[leadingZeros] === "0") leadingZeros++;
  let v = 0n;
  for (const ch of norm.slice(leadingZeros)) v = v * 32n + BigInt(C32_ALPHABET.indexOf(ch));
  let hexStr = v === 0n ? "" : v.toString(16);
  if (hexStr.length % 2) hexStr = "0" + hexStr;
  const body = hexToBytesB(hexStr);
  const out = new Uint8Array(leadingZeros + body.length);
  out.set(body, leadingZeros);
  return out;
}
function stacksChecksum(version, hash160Bytes) {
  return sha256(sha256(catB(Uint8Array.of(version), hash160Bytes))).slice(0, 4);
}
/** Encode a Stacks address from an address version + 20-byte hash160. */
export function stacksAddressEncode(version, hash160Bytes) {
  if (hash160Bytes.length !== 20) throw new Error("Stacks hash160 must be 20 bytes");
  const payload = catB(hash160Bytes, stacksChecksum(version, hash160Bytes));
  return "S" + C32_ALPHABET[version] + c32EncodeBytes(payload);
}
/** Decode + checksum-verify a Stacks address → { version, hash160 (hex) }. */
export function stacksAddressDecode(address) {
  const a = String(address || "").trim();
  if (a.length < 3 || a[0] !== "S") throw new Error("Invalid Stacks address");
  const version = C32_ALPHABET.indexOf(a[1].toUpperCase());
  if (version < 0) throw new Error("Invalid Stacks address version");
  const payload = c32DecodeToBytes(a.slice(2));
  if (payload.length !== 24) throw new Error("Invalid Stacks address length");
  const hash160Bytes = payload.slice(0, 20);
  const want = stacksChecksum(version, hash160Bytes);
  if (!payload.slice(20).every((b, i) => b === want[i])) throw new Error("Invalid Stacks address checksum");
  return { version, hash160: bytesToHexB(hash160Bytes) };
}
export function isValidStacksAddress(address, network) {
  try {
    const { version } = stacksAddressDecode(address);
    if (version !== 22 && version !== 26) return false;
    if (network) return version === stacksNetwork(network).addressVersion;
    return true;
  } catch { return false; }
}
/** Contract addresses may also be multisig (SM…/SN…): versions 20/21.
 *  (The sBTC deployer is SM… — a standard-principal check would reject
 *  the most important token contract on the network.) */
export function isValidStacksContractAddress(address, network = "mainnet") {
  try {
    const { version } = stacksAddressDecode(address);
    return network === "testnet" ? (version === 26 || version === 21) : (version === 22 || version === 20);
  } catch { return false; }
}

/* ---------- keys ---------- */
function stacksChildFromPhrase(phrase) {
  const seed = mnemonicToSeedSync(String(phrase).trim());
  return HDKey.fromMasterSeed(seed).derive("m/44'/5757'/0'/0/0");
}
export function stacksAddressFromPhrase(phrase, network = "mainnet") {
  const child = stacksChildFromPhrase(phrase);
  const pub = secp256k1.getPublicKey(child.privateKey, true);
  const hash160 = ripemd160(sha256(pub));
  return stacksAddressEncode(stacksNetwork(network).addressVersion, hash160);
}

/* ---------- units ---------- */
export function stxMicroToStx(micro) {
  const m = BigInt(micro); const neg = m < 0n; const a = neg ? -m : m;
  const whole = a / 1_000_000n, frac = String(a % 1_000_000n).padStart(6, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toString() + (frac ? "." + frac : "");
}
export function stxToMicro(text) {
  const t = String(text).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) throw new Error("Enter a valid STX amount (up to 6 decimals)");
  const [w, f = ""] = t.split(".");
  return BigInt(w) * 1_000_000n + BigInt((f + "000000").slice(0, 6));
}
/** Parse a decimal amount string into raw base units for any decimals. */
export function stacksAmountToRaw(text, decimals) {
  const t = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error("Enter a valid amount");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new Error(`Too many decimal places (max ${decimals})`);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}
export function stacksRawToAmount(raw, decimals) {
  const v = BigInt(raw); const base = 10n ** BigInt(decimals);
  const whole = v / base, frac = String(v % base).padStart(decimals, "0").replace(/0+$/, "");
  return whole.toString() + (frac ? "." + frac : "");
}

/* ---------- pinned tokens (verified on-chain 2026-11-06) ----------
 * symbol/name/decimals come from the contracts' own get-symbol /
 * get-name / get-decimals call-reads; the assetName is the contract's
 * define-fungible-token name taken from the verified contract SOURCE
 * and confirmed against Hiro's balance keys — it is NOT the symbol
 * (sBTC's asset is "sbtc-token", USDA's is "usda"), and it is what
 * post-conditions must reference exactly. */
export const STACKS_TOKENS = [
  { contract: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token", assetName: "sbtc-token", symbol: "sBTC", name: "sBTC", decimals: 8 },
  { contract: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token", assetName: "usda", symbol: "USDA", name: "USDA", decimals: 6 },
];

/* ---------- reads (Hiro) ---------- */
async function stacksCallRead(api, contract, fn, sender) {
  const [addr, name] = contract.split(".");
  const r = await fetch(`${api}/v2/contracts/call-read/${addr}/${name}/${fn}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender, arguments: [] }),
  });
  if (!r.ok) throw new Error(`call-read ${fn} HTTP ${r.status}`);
  const j = await r.json();
  if (!j || j.okay !== true || typeof j.result !== "string") throw new Error(`call-read ${fn} failed`);
  return hexToBytesB(j.result.replace(/^0x/, ""));
}
/** Parse a Clarity (ok <string-ascii|utf8>) or (ok <uint>) call-read result. Hostile-input safe: returns null on anything unexpected. */
export function parseStacksCallReadValue(bytes) {
  try {
    let b = bytes;
    if (b[0] === 0x07) b = b.slice(1); // (ok …) wrapper
    if (b[0] === 0x01 && b.length === 17) { // uint128
      let v = 0n; for (let i = 1; i < 17; i++) v = (v << 8n) | BigInt(b[i]);
      return { kind: "uint", value: v };
    }
    if (b[0] === 0x0d) { // string-ascii: u32 len + bytes
      const len = new DataView(b.buffer, b.byteOffset + 1, 4).getUint32(0);
      if (b.length < 5 + len) return null;
      return { kind: "string", value: new TextDecoder().decode(b.slice(5, 5 + len)) };
    }
    if (b[0] === 0x0e) { // string-utf8: u32 char count + 4-byte codepoints
      const len = new DataView(b.buffer, b.byteOffset + 1, 4).getUint32(0);
      if (b.length < 5 + len * 4) return null;
      let s = "";
      for (let i = 0; i < len; i++) s += String.fromCodePoint(new DataView(b.buffer, b.byteOffset + 5 + i * 4, 4).getUint32(0));
      return { kind: "string", value: s };
    }
    return null;
  } catch { return null; }
}
function stacksCleanMeta(s, max) {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
/** STX balance + nonce + every SIP-010 balance (metadata read from the contracts for unpinned tokens). */
export async function fetchStacksAccount(address, network = "mainnet") {
  const net = stacksNetwork(network);
  let balances, account;
  try {
    const [br, ar] = await Promise.all([
      fetch(`${net.api}/extended/v1/address/${address}/balances`),
      fetch(`${net.api}/v2/accounts/${address}`),
    ]);
    if (!br.ok) throw new Error(`Hiro balances HTTP ${br.status}`);
    if (!ar.ok) throw new Error(`Hiro account HTTP ${ar.status}`);
    balances = await br.json(); account = await ar.json();
  } catch (e) {
    return { address, exists: false, nonce: 0, stxUstx: "0", tokens: [], scanFailed: true, error: String(e.message || e) };
  }
  const stxUstx = BigInt(balances?.stx?.balance ?? "0");
  const nonce = Number(account?.nonce ?? 0);
  // Pinned contracts (exact contract + asset name) are verified by the
  // pin itself — no call-reads needed. Everything else gets its metadata
  // read from its contract, in parallel, and stays unverified (⚠).
  const tokens = await Promise.all(Object.entries(balances?.fungible_tokens || {}).map(async ([key, v]) => {
    const m = /^(S[0-9A-Z]+)\.([a-zA-Z0-9_-]+)::(.+)$/.exec(key);
    if (!m) return null;
    const contract = `${m[1]}.${m[2]}`, assetName = m[3];
    const pin = STACKS_TOKENS.find(t => t.contract === contract && t.assetName === assetName);
    if (pin) return { contract, assetName, symbol: pin.symbol, name: pin.name, decimals: pin.decimals, balanceRaw: String(v.balance ?? "0"), verified: true };
    const row = { contract, assetName, symbol: assetName, name: assetName, decimals: 0, balanceRaw: String(v.balance ?? "0"), verified: false };
    try {
      const [nm, sy, de] = await Promise.all([
        stacksCallRead(net.api, contract, "get-name", address),
        stacksCallRead(net.api, contract, "get-symbol", address),
        stacksCallRead(net.api, contract, "get-decimals", address),
      ]);
      const nameV = parseStacksCallReadValue(nm), symV = parseStacksCallReadValue(sy), decV = parseStacksCallReadValue(de);
      if (nameV?.kind === "string") row.name = stacksCleanMeta(nameV.value, 64) || assetName;
      if (symV?.kind === "string") row.symbol = stacksCleanMeta(symV.value, 32) || assetName;
      if (decV?.kind === "uint" && decV.value >= 0n && decV.value <= 18n) row.decimals = Number(decV.value);
    } catch { /* metadata unreadable → stays unverified with the asset name */ }
    return row;
  }));
  const tokenRows = tokens.filter(Boolean);
  tokenRows.sort((a, b) => (b.verified - a.verified) || a.symbol.localeCompare(b.symbol));
  return { address, exists: stxUstx > 0n || nonce > 0 || tokenRows.length > 0, nonce, stxUstx: stxUstx.toString(), tokens: tokenRows, scanFailed: false };
}

/* ---------- transaction building & signing (SIP-005) ---------- */
const u32beS = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, Number(n), false); return b; };
const u64beS = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), false); return b; };
const u128beS = (n) => { const v = BigInt(n); return catB(u64beS(v >> 64n), u64beS(v & 0xffffffffffffffffn)); };
const lpStringS = (s) => { const bytes = new TextEncoder().encode(String(s)); if (bytes.length > 128) throw new Error("Stacks name too long"); return catB(Uint8Array.of(bytes.length), bytes); };
function stacksPrincipalBytes(address) { // post-condition / address wire form: version || hash160
  const { version, hash160 } = stacksAddressDecode(address);
  return catB(Uint8Array.of(version), hexToBytesB(hash160));
}
function stacksPrincipalCvBytes(address) { // Clarity principal value: 0x05 || version || hash160
  return catB(Uint8Array.of(0x05), stacksPrincipalBytes(address));
}
function stacksSerializeTx({ net, auth, anchorMode, postConditionMode, postConditions, payload }) {
  return catB(
    Uint8Array.of(net.txVersion), u32beS(net.chainId), auth,
    Uint8Array.of(anchorMode), Uint8Array.of(postConditionMode),
    u32beS(postConditions.length), ...postConditions, payload,
  );
}
function stacksSpendingCondition({ pubKey, nonce, feeUstx, signature }) {
  const signer = ripemd160(sha256(pubKey));
  return catB(
    Uint8Array.of(0x04, 0x00), signer, u64beS(nonce), u64beS(feeUstx),
    Uint8Array.of(0x00), signature ?? new Uint8Array(65),
  );
}
/** SIP-005 sighash chain for a single-sig origin (sha512/256 throughout). */
export function stacksSighash(serializedWithClearedAuth, feeUstx, nonce, pubKey, signatureVrs) {
  const initial = bytesToHexB(sha512_256(serializedWithClearedAuth));
  const pre = sha512_256(catB(hexToBytesB(initial), Uint8Array.of(0x04), u64beS(feeUstx), u64beS(nonce)));
  if (!signatureVrs) return { initial, preSign: bytesToHexB(pre) };
  const post = sha512_256(catB(pre, Uint8Array.of(0x00), signatureVrs));
  return { initial, preSign: bytesToHexB(pre), postSign: bytesToHexB(post) };
}
/**
 * Build + sign a Stacks transaction. draft = { to, amountRaw (BigInt),
 * token: null | { contract, assetName } }. Returns { rawHex, txid }.
 * Byte-identical to @stacks/transactions for identical inputs
 * (validation 2026-11-06 — see test vectors).
 */
export function buildSignedStacksTx({ phrase, network = "mainnet", to, amountRaw, token = null, feeUstx, nonce }) {
  const net = stacksNetwork(network);
  const child = stacksChildFromPhrase(phrase);
  const priv = child.privateKey;
  const pub = secp256k1.getPublicKey(priv, true);
  const from = stacksAddressEncode(net.addressVersion, ripemd160(sha256(pub)));
  if (!isValidStacksAddress(to, network)) throw new Error(`Recipient is not a valid ${net.label} address`);
  const amount = BigInt(amountRaw);
  if (amount <= 0n) throw new Error("Amount must be more than zero");
  if (amount > 0xffffffffffffffffn) throw new Error("Amount exceeds the Stacks u64 limit");
  const fee = BigInt(feeUstx); const nn = BigInt(nonce);
  let payload, postConditions = [], postConditionMode = 0x02; // Deny
  if (!token) {
    payload = catB(Uint8Array.of(0x00), stacksPrincipalCvBytes(to), u64beS(amount), new Uint8Array(34));
  } else {
    const [cAddr, cName] = String(token.contract).split(".");
    if (!cAddr || !cName || !isValidStacksContractAddress(cAddr, network)) throw new Error("Invalid token contract");
    payload = catB(
      Uint8Array.of(0x02), stacksPrincipalBytes(cAddr), lpStringS(cName), lpStringS("transfer"),
      u32beS(4),
      catB(Uint8Array.of(0x01), u128beS(amount)),          // uint
      stacksPrincipalCvBytes(from),                        // sender principal
      stacksPrincipalCvBytes(to),                          // recipient principal
      Uint8Array.of(0x09),                                 // none (no memo)
    );
    const asset = catB(stacksPrincipalBytes(cAddr), lpStringS(cName), lpStringS(token.assetName));
    postConditions = [catB(
      Uint8Array.of(0x01, 0x02), stacksPrincipalBytes(from), asset, // fungible PC, STANDARD principal (wire id 2)
      Uint8Array.of(0x01), u64beS(amount),                 // SendEq, exact amount
    )];
  }
  const anchorMode = 0x03; // Any
  const clearedAuth = stacksSpendingCondition({ pubKey: pub, nonce: 0n, feeUstx: 0n });
  const unsigned = stacksSerializeTx({ net, auth: clearedAuth, anchorMode, postConditionMode, postConditions, payload });
  const { preSign } = stacksSighash(unsigned, fee, nn, pub, null);
  const sigVrs = secp256k1.sign(hexToBytesB(preSign), priv, { lowS: true, prehash: false, format: "recovered" });
  const auth = stacksSpendingCondition({ pubKey: pub, nonce: nn, feeUstx: fee, signature: sigVrs });
  const raw = stacksSerializeTx({ net, auth, anchorMode, postConditionMode, postConditions, payload });
  return { rawHex: bytesToHexB(raw), txid: "0x" + bytesToHexB(sha512_256(raw)), from };
}

/* ---------- fee estimation (bounded) ---------- */
/** fee = Hiro transfer fee-rate (µSTX/byte) × tx byte length — the same
 *  algorithm @stacks/transactions uses for transfers — with the rate and
 *  the total sanity-bounded BEFORE signing (hostile-oracle guard). */
export async function estimateStacksFee(byteLen, network = "mainnet") {
  const net = stacksNetwork(network);
  const r = await fetch(`${net.api}/v2/fees/transfer`);
  if (!r.ok) throw new Error(`Hiro fee estimate HTTP ${r.status}`);
  const text = (await r.text()).trim();
  if (!/^\d+$/.test(text)) throw new Error("Hiro returned an unusable fee rate");
  const rate = BigInt(text);
  if (rate < 1n || rate > BigInt(STACKS_MAX_FEE_RATE_USTX_PER_BYTE)) {
    throw new Error(`Hiro fee rate ${text} µSTX/byte is outside the sane bound — refusing to sign`);
  }
  const fee = rate * BigInt(byteLen);
  if (fee > STACKS_MAX_FEE_USTX) throw new Error(`Estimated Stacks fee ${stxMicroToStx(fee)} STX exceeds the safety cap — refusing to sign`);
  return fee;
}

/* ---------- plan + send ---------- */
export function formatStacksSendIntent({ amountText, symbol, to, feeUstx, network = "mainnet" }) {
  return `Send ${amountText} ${symbol} to ${to} on ${stacksNetwork(network).label} — network fee ${stxMicroToStx(feeUstx)} STX. Confirm?`;
}
export async function planStacksSend(phrase, { to, amountText, token = null }, network = "mainnet") {
  const net = stacksNetwork(network);
  const from = stacksAddressFromPhrase(phrase, network);
  const acct = await fetchStacksAccount(from, network);
  if (acct.scanFailed) throw new Error("Couldn't reach the Stacks network (Hiro) — check your connection and try again");
  const decimals = token ? token.decimals : 6;
  const symbol = token ? token.symbol : "STX";
  const amountRaw = stacksAmountToRaw(amountText, decimals);
  if (amountRaw <= 0n) throw new Error("Amount must be more than zero");
  const stxBal = BigInt(acct.stxUstx);
  if (token) {
    if (amountRaw > BigInt(token.balanceRaw)) throw new Error(`Insufficient ${symbol} balance`);
  }
  // Fee first (needs the tx length, which is fee-independent: the fee is
  // a fixed-width u64 in the auth), then build the signed transaction.
  const probe = buildSignedStacksTx({ phrase, network, to, amountRaw, token, feeUstx: 0n, nonce: acct.nonce });
  const feeUstx = await estimateStacksFee(probe.rawHex.length / 2, network);
  if (token ? feeUstx > stxBal : amountRaw + feeUstx > stxBal) {
    throw new Error(token ? "Insufficient STX for the network fee" : `Insufficient STX (amount + ${stxMicroToStx(feeUstx)} STX fee exceeds your balance)`);
  }
  const built = buildSignedStacksTx({ phrase, network, to, amountRaw, token, feeUstx, nonce: acct.nonce });
  return {
    from, to, token, symbol, decimals, amountRaw: amountRaw.toString(),
    amountText: stacksRawToAmount(amountRaw, decimals),
    feeUstx: feeUstx.toString(), nonce: acct.nonce,
    rawHex: built.rawHex, txid: built.txid,
    intent: formatStacksSendIntent({ amountText: stacksRawToAmount(amountRaw, decimals), symbol, to, feeUstx, network }),
  };
}
/** Re-plan (fresh nonce/balances/fee), then broadcast via Hiro. */
export async function sendStacks(phrase, draft, network = "mainnet") {
  const net = stacksNetwork(network);
  const plan = await planStacksSend(phrase, draft, network);
  const r = await fetch(`${net.api}/v2/transactions`, {
    method: "POST", headers: { "content-type": "application/octet-stream" },
    body: hexToBytesB(plan.rawHex),
  });
  const text = await r.text();
  if (!r.ok) {
    let reason = text.slice(0, 200);
    try { const j = JSON.parse(text); reason = j.reason || j.error || reason; if (j.reason_data?.message) reason += `: ${j.reason_data.message}`; } catch { /* keep raw */ }
    throw new Error(`Stacks node rejected the transaction (${reason})`);
  }
  let txid = plan.txid;
  try { const j = JSON.parse(text); if (typeof j === "string" && /^0x[0-9a-f]{64}$/i.test(j)) txid = j; } catch { /* plain-text txid */ }
  return { hash: txid, plan };
}

// ---------- Fluid Scan: the in-wallet explorer (owner's idea, 2026-11-07) ----------
// "Like BscScan, but ours": type a Fluid name or any wallet address and
// see that wallet's PUBLIC on-chain activity across chains in one feed.
// Everything Scan shows is public chain data read from keyless public
// sources — the same class of endpoints the wallet already reads
// balances from (Blockstream/Esplora, public RPCs, the AlgoNode
// indexer). A name resolves through the SAME public names registry the
// send sheets use: only a name's REGISTERED addresses are scanned —
// the privacy truth the Scan pane states in plain words (unregistered
// addresses stay private because nothing anywhere links them to the
// name). Every source response is hostile data: the normalisers below
// validate shape field by field and keep only what parses, and every
// rendered string passes escapeHtml before it reaches markup (the
// formatScanFeedEntry render path, audit-C1 discipline).

/** The EVM networks Scan sweeps for an EVM address, in display order. */
export const SCAN_EVM_NETWORKS = ["ethereum", "bsc", "base", "polygon", "arbitrum"];
/** Keyless Blockscout API v2 roots per EVM network — the open-source
 *  explorer whose public instances need no API key. BNB Chain has NO
 *  Blockscout instance and no other keyless history index (the
 *  Etherscan-family API made BSC paid-only, verified 2026-11-07):
 *  Scan still reads the BSC balance over the chain's own public RPC
 *  and says plainly that its activity list isn't available keylessly
 *  yet, linking out to BscScan instead of pretending. */
export const SCAN_BLOCKSCOUT_APIS = {
  ethereum: "https://eth.blockscout.com",
  base: "https://base.blockscout.com",
  polygon: "https://polygon.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
};
const SCAN_ALGO_INDEXER = "https://mainnet-idx.algonode.cloud";
export const SCAN_TX_LIMIT = 20;    // newest transactions kept per chain
export const SCAN_FEED_LIMIT = 120; // newest rows kept in the merged feed
const SCAN_TIMEOUT_MS = 15000;

const SCAN_FAMILY_LABELS = { btc: "Bitcoin", algo: "Algorand", solana: "Solana", tron: "Tron", sui: "Sui" };
const SCAN_BADGES = { ethereum: "ETH", bsc: "BSC", base: "BASE", polygon: "POL", arbitrum: "ARB",
  btc: "BTC", algo: "ALGO", solana: "SOL", tron: "TRON", sui: "SUI" };
/** Human chain name for a Scan chain key (an EVM network key or a family id). */
export function scanChainLabel(chainKey) {
  if (NETWORKS[chainKey]) return NETWORKS[chainKey].name;
  return SCAN_FAMILY_LABELS[chainKey] || String(chainKey || "");
}
/** Short chain badge ("BSC", "BTC", …) shown on Scan rows and headers. */
export function scanChainBadge(chainKey) {
  return SCAN_BADGES[chainKey] || scanChainLabel(chainKey).toUpperCase().slice(0, 5);
}

/** One Scan target: a chain to read + the address to read on it. */
export function scanTarget(chainKey, address, family) {
  return { chainKey, family: family || (NETWORKS[chainKey] ? "evm" : chainKey),
           address, label: scanChainLabel(chainKey), badge: scanChainBadge(chainKey) };
}
/** Targets for a resolved Fluid name: its REGISTERED addresses only —
 *  the EVM address swept across SCAN_EVM_NETWORKS, plus BTC, Algorand,
 *  Solana, Tron and Sui when the entry carries them. The raw registry
 *  entry is sanitised first (the send sheets' trust boundary). The
 *  non-EVM targets use chainKey === family, exactly the shape
 *  scanTargetsForAddress builds for a pasted address of the family. */
export function scanTargetsForName(entry) {
  const e = sanitizeNameEntry(entry);
  if (!e) return [];
  const out = [];
  if (e.evm) for (const k of SCAN_EVM_NETWORKS) out.push(scanTarget(k, e.evm, "evm"));
  if (e.btc) out.push(scanTarget("btc", e.btc, "btc"));
  if (e.algo) out.push(scanTarget("algo", e.algo, "algo"));
  if (e.sol) out.push(scanTarget("solana", e.sol, "solana"));
  if (e.tron) out.push(scanTarget("tron", e.tron, "tron"));
  if (e.sui) out.push(scanTarget("sui", e.sui, "sui"));
  return out;
}
/** Targets for a raw address: an EVM address gets the same
 *  multi-network sweep; every other family scans its own chain. */
export function scanTargetsForAddress(detected) {
  if (!detected || !detected.address) return [];
  if (detected.family === "evm") return SCAN_EVM_NETWORKS.map(k => scanTarget(k, detected.address, "evm"));
  if (["btc", "algo", "solana", "tron", "sui"].includes(detected.family)) {
    return [scanTarget(detected.family, detected.address, detected.family)];
  }
  return [];
}

/* Address-family detection for a pasted address. Checks run in an
 * order that resolves the charset overlaps honestly: Sui is the only
 * 0x-prefixed 64-hex family; Bitcoin legacy is verified by its
 * base58check checksum + version byte (a Solana address of similar
 * shape fails the checksum); Tron is verified by isValidTronAddress
 * (its own checksum) before the bare-base58 Solana check. */
const scanBtcB58Check = base58check(sha256Bytes);
export function isValidBitcoinAddress(address) {
  const s = String(address || "").trim();
  if (/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,71}$/.test(s)) {
    try { const d = bech32.decode(s, 90); if (d.prefix === "bc" && d.words && d.words[0] === 0) return true; } catch { /* not bech32 */ }
    try { const d = bech32m.decode(s, 90); if (d.prefix === "bc" && d.words && d.words[0] === 1) return true; } catch { /* not bech32m */ }
    return false;
  }
  try {
    const raw = scanBtcB58Check.decode(s);
    return raw.length === 21 && (raw[0] === 0x00 || raw[0] === 0x05);
  } catch { return false; }
}
/** Detect which chain family a pasted address belongs to, or null.
 *  Returns { family, address } with the address normalised where the
 *  family has a canonical form (Sui checksummed-long, Algorand
 *  uppercase base32). */
export function detectScanFamily(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return { family: "evm", address: s };
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) {
    const n = normalizeSuiAddress(s);
    if (n) return { family: "sui", address: n };
  }
  if (isValidBitcoinAddress(s)) return { family: "btc", address: s };
  if (isValidAlgorandAddress(s)) return { family: "algo", address: s.toUpperCase() };
  if (isValidTronAddress(s)) return { family: "tron", address: s };
  if (isValidSolanaAddress(s)) return { family: "solana", address: s };
  return null;
}

/** Canonical explorer transaction URL for a Scan row — or null when
 *  the txid doesn't match the family's id shape (a hostile or garbled
 *  id never becomes a link). Paths mirror the ones the send flows
 *  already link out to. */
export function scanTxUrl(chainKey, txid) {
  const id = String(txid || "").trim();
  if (NETWORKS[chainKey]) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return null;
    return historyTxUrl({ hash: id, explorer: NETWORKS[chainKey].explorer });
  }
  switch (chainKey) {
    case "btc":
      if (!/^[0-9a-fA-F]{64}$/.test(id)) return null;
      return historyTxUrl({ hash: id, explorer: "https://mempool.space" });
    case "algo":
      if (!/^[A-Z2-7]{52}$/.test(id)) return null;
      return historyTxUrl({ hash: id, explorer: ALGO_EXPLORER });
    case "solana":
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(id)) return null;
      return historyTxUrl({ hash: id, explorer: SOLANA_EXPLORER });
    case "tron":
      if (!/^[0-9a-fA-F]{64}$/.test(id)) return null;
      return historyTxUrl({ link: TRON_EXPLORER + "/#/transaction/" + id });
    case "sui":
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(id)) return null;
      return historyTxUrl({ hash: id, explorer: SUI_EXPLORER + "/mainnet" });
    default: return null;
  }
}
/** Canonical explorer ADDRESS page — only where the path shape is the
 *  explorer family's standard one (used for the BNB Chain note's
 *  "view on BscScan" link). Null anywhere else rather than a guess. */
export function scanAddressUrl(chainKey, address) {
  const a = String(address || "").trim();
  if (NETWORKS[chainKey]) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
    try { const u = new URL(NETWORKS[chainKey].explorer + "/address/" + a); return u.protocol === "https:" ? u.href : null; } catch { return null; }
  }
  if (chainKey === "btc" && isValidBitcoinAddress(a)) return "https://mempool.space/address/" + a;
  return null;
}

// ---------- Scan normalisers: hostile source JSON -> feed rows ----------
// A feed row: { chainKey, family, txid, direction: "in"|"out"|"self",
// amountText, symbol, counterparty|null, time (ms epoch | null),
// pending?: true }. Rows with an unparseable amount or id are dropped,
// never rendered as guesses.

function scanIsoTime(s) { const t = Date.parse(String(s || "")); return Number.isFinite(t) ? t : null; }
function scanDir(from, to, me, foldCase = true) {
  // EVM hex and Algorand base32 compare case-insensitively; Tron's
  // base58check addresses are case-SENSITIVE and must not be folded.
  const norm = (x) => foldCase ? String(x || "").toLowerCase() : String(x || "");
  const f = norm(from) === norm(me), t = norm(to) === norm(me);
  if (f && t) return "self";
  if (t) return "in";
  if (f) return "out";
  return null;
}

/** Blockscout API v2 /addresses/{a}/transactions -> native-coin rows. */
export function normalizeBlockscoutTxs(json, { networkKey, address } = {}) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const me = String(address || "").toLowerCase();
  const rows = [];
  for (const tx of items) {
    if (!tx || typeof tx.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tx.hash)) continue;
    if (tx.status && tx.status !== "ok") continue; // a failed tx moved no value
    let value;
    try { value = BigInt(tx.value ?? "0"); } catch { continue; }
    if (value <= 0n) continue; // contract calls with no value aren't transfers
    const direction = scanDir(tx.from?.hash, tx.to?.hash, me);
    if (!direction) continue;
    rows.push({ chainKey: networkKey, family: "evm", txid: tx.hash, direction,
      amountText: formatTokenAmount(value, 18), symbol: NETWORKS[networkKey]?.symbol || "",
      counterparty: direction === "in" ? (tx.from?.hash || null) : direction === "out" ? (tx.to?.hash || null) : null,
      time: scanIsoTime(tx.timestamp) });
  }
  return rows;
}
/** Blockscout API v2 /addresses/{a}/token-transfers -> token rows. */
export function normalizeBlockscoutTokenTransfers(json, { networkKey, address } = {}) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const me = String(address || "").toLowerCase();
  const rows = [];
  for (const tr of items) {
    if (!tr || typeof tr.transaction_hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tr.transaction_hash)) continue;
    const direction = scanDir(tr.from?.hash, tr.to?.hash, me);
    if (!direction) continue;
    const decRaw = Number(tr.total?.decimals ?? tr.token?.decimals ?? 0);
    const decimals = Number.isInteger(decRaw) && decRaw >= 0 && decRaw <= 36 ? decRaw : 0;
    let amountText;
    try { amountText = formatTokenAmount(BigInt(tr.total?.value ?? "0"), decimals); } catch { continue; }
    rows.push({ chainKey: networkKey, family: "evm", txid: tr.transaction_hash, direction,
      amountText, symbol: String(tr.token?.symbol || "Token").slice(0, 32),
      counterparty: direction === "in" ? (tr.from?.hash || null) : direction === "out" ? (tr.to?.hash || null) : null,
      time: scanIsoTime(tr.timestamp) });
  }
  return rows;
}

/** Esplora /address/{a}/txs -> BTC rows. Net value to/from the address
 *  decides direction and amount (change back to self is excluded by
 *  the netting); the counterparty is named only when exactly one
 *  external address sits on the other side. */
export function normalizeEsploraTxs(json, { address } = {}) {
  if (!Array.isArray(json)) return [];
  const rows = [];
  for (const tx of json) {
    if (!tx || typeof tx.txid !== "string" || !/^[0-9a-fA-F]{64}$/.test(tx.txid)) continue;
    let inSum = 0, outSum = 0;
    const inFrom = new Set(), outTo = new Set();
    for (const vin of Array.isArray(tx.vin) ? tx.vin : []) {
      const p = vin?.prevout;
      if (!p || typeof p.scriptpubkey_address !== "string" || !Number.isFinite(p.value)) continue;
      if (p.scriptpubkey_address === address) inSum += p.value; else inFrom.add(p.scriptpubkey_address);
    }
    for (const vout of Array.isArray(tx.vout) ? tx.vout : []) {
      if (!vout || typeof vout.scriptpubkey_address !== "string" || !Number.isFinite(vout.value)) continue;
      if (vout.scriptpubkey_address === address) outSum += vout.value; else outTo.add(vout.scriptpubkey_address);
    }
    const net = outSum - inSum;
    if (net === 0) continue;
    const direction = net > 0 ? "in" : "out";
    const cps = direction === "in" ? [...inFrom] : [...outTo];
    const confirmed = !!(tx.status && tx.status.confirmed === true);
    rows.push({ chainKey: "btc", family: "btc", txid: tx.txid, direction,
      amountText: formatTokenAmount(Math.abs(net), 8), symbol: "BTC",
      counterparty: cps.length === 1 ? cps[0] : null,
      time: confirmed && Number.isFinite(tx.status?.block_time) ? tx.status.block_time * 1000 : null,
      pending: !confirmed });
  }
  return rows;
}

/** AlgoNode indexer /accounts/{a}/transactions -> ALGO + ASA rows.
 *  Payments and asset transfers only; zero-amount transfers (opt-ins)
 *  are not money movement and are skipped. Circle's USDC ASA is the
 *  one ASA whose decimals Scan states; any other ASA shows its raw
 *  unit count under an "ASA <id>" label rather than a guessed scale. */
export function normalizeAlgoIndexerTxs(json, { address } = {}) {
  const txs = Array.isArray(json?.transactions) ? json.transactions : [];
  const rows = [];
  for (const tx of txs) {
    if (!tx || typeof tx.id !== "string" || !tx.id) continue;
    const kind = tx["tx-type"];
    let amount = null, decimals = 6, symbol = "ALGO", receiver = null;
    if (kind === "pay" && tx["payment-transaction"]) {
      amount = tx["payment-transaction"].amount; receiver = tx["payment-transaction"].receiver;
    } else if (kind === "axfer" && tx["asset-transfer-transaction"]) {
      const at = tx["asset-transfer-transaction"];
      amount = at.amount; receiver = at.receiver;
      if (Number(at["asset-id"]) === ALGO_USDC_ASA) { symbol = "USDC"; decimals = 6; }
      else { symbol = "ASA " + String(at["asset-id"]); decimals = 0; }
    } else continue;
    if (!Number.isFinite(amount) || amount === 0 || typeof receiver !== "string") continue;
    const sender = typeof tx.sender === "string" ? tx.sender : null;
    const direction = scanDir(sender, receiver, String(address || ""));
    if (!direction) continue;
    rows.push({ chainKey: "algo", family: "algo", txid: tx.id, direction,
      amountText: formatTokenAmount(amount, decimals), symbol,
      counterparty: direction === "in" ? sender : direction === "out" ? receiver : null,
      time: Number.isFinite(tx["round-time"]) ? tx["round-time"] * 1000 : null });
  }
  return rows;
}

/** One Solana getTransaction (jsonParsed) result -> rows: the native
 *  SOL balance delta for the address (fee added back for the payer, so
 *  a pure fee payment yields no row) plus one row per SPL mint whose
 *  balance for the address changed. */
export function normalizeSolanaTx(parsed, signature, { address } = {}) {
  if (!parsed || typeof parsed !== "object" || !parsed.meta || parsed.meta.err) return [];
  if (typeof signature !== "string" || !signature) return [];
  const keys = Array.isArray(parsed.transaction?.message?.accountKeys) ? parsed.transaction.message.accountKeys : [];
  const keyStr = (k) => typeof k === "string" ? k : (k && typeof k.pubkey === "string" ? k.pubkey : null);
  const idx = keys.findIndex(k => keyStr(k) === address);
  const time = Number.isFinite(parsed.blockTime) ? parsed.blockTime * 1000 : null;
  const rows = [];
  if (idx >= 0) {
    const pre = Number(parsed.meta.preBalances?.[idx]), post = Number(parsed.meta.postBalances?.[idx]);
    if (Number.isFinite(pre) && Number.isFinite(post)) {
      const isPayer = idx === 0;
      const delta = post - pre + (isPayer ? (Number(parsed.meta.fee) || 0) : 0);
      if (delta !== 0) {
        let counterparty = null;
        for (const ix of Array.isArray(parsed.transaction.message.instructions) ? parsed.transaction.message.instructions : []) {
          if (ix?.program === "system" && ix?.parsed?.type === "transfer") {
            const info = ix.parsed.info || {};
            if (info.destination === address && info.source !== address) counterparty = info.source;
            if (info.source === address && info.destination !== address) counterparty = info.destination;
          }
        }
        rows.push({ chainKey: "solana", family: "solana", txid: signature, direction: delta > 0 ? "in" : "out",
          amountText: formatTokenAmount(Math.abs(delta), 9), symbol: "SOL", counterparty, time });
      }
    }
  }
  const byMint = new Map();
  const fold = (list, sign) => {
    for (const b of Array.isArray(list) ? list : []) {
      if (!b || b.owner !== address || typeof b.mint !== "string") continue;
      const amt = b.uiTokenAmount?.amount;
      if (typeof amt !== "string" || !/^[0-9]+$/.test(amt)) continue;
      const cur = byMint.get(b.mint) || { delta: 0n, decimals: Number(b.uiTokenAmount?.decimals ?? 0) };
      cur.delta += sign * BigInt(amt);
      byMint.set(b.mint, cur);
    }
  };
  fold(parsed.meta.preTokenBalances, -1n);
  fold(parsed.meta.postTokenBalances, 1n);
  for (const [mint, { delta, decimals }] of byMint) {
    if (delta === 0n) continue;
    const known = SOLANA_TOKENS.find(t => t.address === mint);
    rows.push({ chainKey: "solana", family: "solana", txid: signature, direction: delta > 0n ? "in" : "out",
      amountText: formatTokenAmount(delta > 0n ? delta : -delta, known ? known.decimals : (Number.isInteger(decimals) ? decimals : 0)),
      symbol: known ? known.symbol : "SPL token", counterparty: null, time });
  }
  return rows;
}

/** TronGrid /v1/accounts/{a}/transactions -> native TRX rows
 *  (TransferContract only — other contract types carry no reliably
 *  readable value here and are left to the TRC20 list below). */
export function normalizeTronTxs(json, { address } = {}) {
  const data = Array.isArray(json?.data) ? json.data : [];
  const rows = [];
  for (const tx of data) {
    const c = tx?.raw_data?.contract?.[0];
    if (!tx || typeof tx.txID !== "string" || !/^[0-9a-fA-F]{64}$/.test(tx.txID)) continue;
    if (!c || c.type !== "TransferContract") continue;
    const v = c.parameter?.value || {};
    let owner = null, to = null;
    try { owner = tronAddressFromHex(v.owner_address); } catch { /* unreadable */ }
    try { to = tronAddressFromHex(v.to_address); } catch { /* unreadable */ }
    if (!owner || !to || !Number.isFinite(v.amount)) continue;
    const direction = scanDir(owner, to, String(address || ""), false);
    if (!direction) continue;
    rows.push({ chainKey: "tron", family: "tron", txid: tx.txID, direction,
      amountText: formatTokenAmount(v.amount, 6), symbol: "TRX",
      counterparty: direction === "in" ? owner : direction === "out" ? to : null,
      time: Number.isFinite(tx.block_timestamp) ? tx.block_timestamp : null });
  }
  return rows;
}
/** TronGrid /v1/accounts/{a}/transactions/trc20 -> token rows. */
export function normalizeTronTrc20Txs(json, { address } = {}) {
  const data = Array.isArray(json?.data) ? json.data : [];
  const rows = [];
  for (const tr of data) {
    if (!tr || typeof tr.transaction_id !== "string" || !/^[0-9a-fA-F]{64}$/.test(tr.transaction_id)) continue;
    const direction = scanDir(tr.from, tr.to, String(address || ""), false);
    if (!direction) continue;
    const decRaw = Number(tr.token_info?.decimals ?? 0);
    const decimals = Number.isInteger(decRaw) && decRaw >= 0 && decRaw <= 36 ? decRaw : 0;
    let amountText;
    try { amountText = formatTokenAmount(BigInt(tr.value ?? "0"), decimals); } catch { continue; }
    rows.push({ chainKey: "tron", family: "tron", txid: tr.transaction_id, direction,
      amountText, symbol: String(tr.token_info?.symbol || "Token").slice(0, 32),
      counterparty: direction === "in" ? (tr.from || null) : direction === "out" ? (tr.to || null) : null,
      time: Number.isFinite(tr.block_timestamp) ? tr.block_timestamp : null });
  }
  return rows;
}

/** Sui GraphQL transactions page -> rows, from the effects'
 *  balance changes for the scanned address. Counterparty: for an
 *  outflow, the single other owner who gained the same coin; for an
 *  inflow, the transaction sender (or the single owner who lost it). */
export function normalizeSuiTxPage(json, { address } = {}) {
  const nodes = Array.isArray(json?.data?.transactions?.nodes) ? json.data.transactions.nodes : [];
  const me = normalizeSuiAddress(address);
  if (!me) return [];
  const rows = [];
  for (const node of nodes) {
    if (!node || typeof node.digest !== "string" || !node.digest) continue;
    const changesRaw = node.effects?.balanceChanges;
    const changes = Array.isArray(changesRaw) ? changesRaw : (Array.isArray(changesRaw?.nodes) ? changesRaw.nodes : []);
    const byCoin = new Map();
    for (const c of changes) {
      const repr = typeof c?.coinType === "string" ? c.coinType : (typeof c?.coinType?.repr === "string" ? c.coinType.repr : null);
      const owner = typeof c?.owner === "string" ? c.owner : (typeof c?.owner?.address === "string" ? c.owner.address : null);
      if (!repr || !owner || typeof c.amount !== "string" || !/^-?[0-9]+$/.test(c.amount)) continue;
      const cur = byCoin.get(repr) || [];
      cur.push({ owner: normalizeSuiAddress(owner) || owner, amount: BigInt(c.amount) });
      byCoin.set(repr, cur);
    }
    const sender = typeof node.sender?.address === "string" ? (normalizeSuiAddress(node.sender.address) || node.sender.address) : null;
    for (const [repr, list] of byCoin) {
      const mine = list.filter(x => x.owner === me).reduce((a, x) => a + x.amount, 0n);
      if (mine === 0n) continue;
      const direction = mine > 0n ? "in" : "out";
      let counterparty = null;
      const others = list.filter(x => x.owner !== me && (direction === "in" ? x.amount < 0n : x.amount > 0n));
      if (others.length === 1) counterparty = others[0].owner;
      else if (direction === "in" && sender && sender !== me) counterparty = sender;
      const known = repr === SUI_COIN_TYPE ? { symbol: "SUI", decimals: 9 }
        : SUI_TOKENS.find(t => t.address === repr);
      rows.push({ chainKey: "sui", family: "sui", txid: node.digest, direction,
        amountText: formatTokenAmount(mine > 0n ? mine : -mine, known ? known.decimals : 0),
        symbol: known ? known.symbol : (repr.split("::").pop() || "Coin").slice(0, 32),
        counterparty, time: scanIsoTime(node.effects?.timestamp ?? node.timestamp) });
    }
  }
  return rows;
}

/** Merge per-chain row lists into one feed: exact duplicates dropped
 *  (the same transfer can surface in two source lists), newest first
 *  (pending rows, which carry no time yet, sort as newest), capped. */
export function mergeScanRows(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists || []) {
    for (const row of list || []) {
      if (!row || !row.txid) continue;
      const key = [row.chainKey, row.txid, row.direction, row.symbol, row.amountText, row.counterparty || ""].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  out.sort((a, b) => {
    const ta = a.time == null ? Infinity : a.time, tb = b.time == null ? Infinity : b.time;
    return ta === tb ? 0 : (tb > ta ? 1 : -1);
  });
  return out.slice(0, SCAN_FEED_LIMIT);
}

/** One feed row's inner HTML — the ONLY render path for Scan rows
 *  (audit-C1 discipline: every interpolated value is escaped here, in
 *  core, so app.js never interpolates a chain-supplied string). */
export function formatScanFeedEntry(row, timeLabel) {
  if (!row || typeof row !== "object") return "";
  const dir = row.direction === "in" ? "Received" : row.direction === "out" ? "Sent" : "Self transfer";
  const amt = row.amountText != null && row.amountText !== ""
    ? ` <b>${escapeHtml(row.amountText)} ${escapeHtml(row.symbol || "")}</b>` : "";
  const cp = row.counterparty
    ? ` <small style="color:var(--dim)">${row.direction === "in" ? "from" : "to"} ${escapeHtml(shortAddrLabel(row.counterparty))}</small>` : "";
  const time = timeLabel ? ` <small style="color:var(--dim)">· ${escapeHtml(timeLabel)}</small>` : "";
  return `<div class="hist">${dir}${amt}${cp}${time}</div>`;
}

/** The honest per-chain status line for a finished Scan read: a
 *  failure names the chain, an empty chain says so, and the one chain
 *  with no keyless history index says exactly that. "" when the chain
 *  produced rows and needs no note. */
export function scanChainStatusText(result) {
  if (!result || !result.target) return "";
  const label = scanChainLabel(result.target.chainKey);
  if (!result.ok) return `Couldn't load ${label} — check your connection and try again.`;
  if (result.note === "no-history-index") return `${label}: balance shown — full activity isn't available from a keyless source yet.`;
  if (!result.rows || !result.rows.length) return `No activity found on ${label}.`;
  return "";
}

// ---------- Scan fetchers: one read per target, never throwing ----------
// Each returns { target, ok, balanceText, balanceSymbol, rows, note }.
// ok=false + note "failed" is the honest per-chain failure state;
// note "no-history-index" marks the chain whose balance is readable
// but whose history has no keyless index (BNB Chain today).

/** GET/POST a JSON body with the Scan timeout, or null on ANY
 *  failure (the fetchJsonOrNull discipline: a source that answers
 *  text, an error status, or nothing has simply failed). */
async function scanFetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(SCAN_TIMEOUT_MS), ...opts });
    if (!res || !res.ok) return null;
    return await res.json().catch(() => null);
  } catch { return null; }
}
function scanFailed(target, balanceSymbol) {
  return { target, ok: false, balanceText: null, balanceSymbol: balanceSymbol || "", rows: [], note: "failed" };
}
function scanSortSlice(rows) {
  return mergeScanRows([rows]).slice(0, SCAN_TX_LIMIT);
}

async function fetchScanEvmTarget(target) {
  const net = NETWORKS[target.chainKey];
  const api = SCAN_BLOCKSCOUT_APIS[target.chainKey];
  if (!api) {
    // No keyless history index for this chain: balance over the
    // chain's own public RPC (the same RPC the wallet reads through),
    // and the honest note instead of a fabricated feed.
    let balanceText = null;
    const data = await scanFetchJson(net.rpc, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [target.address, "latest"] }) });
    if (data && typeof data.result === "string") {
      try { balanceText = formatTokenAmount(BigInt(data.result), 18); } catch { /* stays null */ }
    }
    return { target, ok: true, balanceText, balanceSymbol: net.symbol, rows: [], note: "no-history-index" };
  }
  const base = `${api}/api/v2/addresses/${target.address}`;
  const loadPass = () => Promise.all([
    scanFetchJson(base), scanFetchJson(base + "/transactions"), scanFetchJson(base + "/token-transfers"),
  ]);
  let [info, txs, transfers] = await loadPass();
  // ONE retry for whichever pieces are missing (Scan round 2): the
  // Blockscout instances throttle bursts, and a name search fires
  // more parallel targets than a raw-address search (the sweep plus
  // BTC and Algorand) — its balance (info) requests were the ones
  // dropped, painting "balance unavailable" for chains the raw
  // search loaded fine seconds later in the same session. Both
  // paths share this fetcher and these targets, so the retry
  // budget is identical for both; only the missing pieces re-run.
  if (!info || info.coin_balance == null || (!txs && !transfers)) {
    const [info2, txs2, transfers2] = await loadPass();
    if ((!info || info.coin_balance == null) && info2 && info2.coin_balance != null) info = info2;
    if (!txs) txs = txs2;
    if (!transfers) transfers = transfers2;
  }
  if (!txs && !transfers) return scanFailed(target, net.symbol);
  let balanceText = null;
  if (info && info.coin_balance != null) {
    try { balanceText = formatTokenAmount(BigInt(info.coin_balance), 18); } catch { /* stays null */ }
  }
  const rows = mergeScanRows([
    normalizeBlockscoutTxs(txs, { networkKey: target.chainKey, address: target.address }),
    normalizeBlockscoutTokenTransfers(transfers, { networkKey: target.chainKey, address: target.address }),
  ]).slice(0, SCAN_TX_LIMIT);
  return { target, ok: true, balanceText, balanceSymbol: net.symbol, rows, note: null };
}

async function fetchScanBtcTarget(target) {
  // Two independent Esplora sources, the wallet's own pattern.
  for (const base of [MEMPOOL, "https://blockstream.info/api"]) {
    const [info, txs] = await Promise.all([
      scanFetchJson(`${base}/address/${target.address}`),
      scanFetchJson(`${base}/address/${target.address}/txs`),
    ]);
    if (info && Array.isArray(txs)) {
      const sats = Math.max(0,
        (Number(info.chain_stats?.funded_txo_sum) || 0) - (Number(info.chain_stats?.spent_txo_sum) || 0)
        + (Number(info.mempool_stats?.funded_txo_sum) || 0) - (Number(info.mempool_stats?.spent_txo_sum) || 0));
      return { target, ok: true, balanceText: formatTokenAmount(sats, 8), balanceSymbol: "BTC",
        rows: scanSortSlice(normalizeEsploraTxs(txs, { address: target.address })), note: null };
    }
  }
  return scanFailed(target, "BTC");
}

async function fetchScanAlgoTarget(target) {
  const [acct, txs] = await Promise.all([
    scanFetchJson(`${SCAN_ALGO_INDEXER}/v2/accounts/${target.address}`),
    scanFetchJson(`${SCAN_ALGO_INDEXER}/v2/accounts/${target.address}/transactions?limit=40`),
  ]);
  if (!txs || !Array.isArray(txs.transactions)) return scanFailed(target, "ALGO");
  // A 404 account is an unfunded address, not a failure: zero balance.
  const amount = Number(acct?.account?.amount);
  return { target, ok: true, balanceText: formatTokenAmount(Number.isFinite(amount) ? amount : 0, 6),
    balanceSymbol: "ALGO",
    rows: scanSortSlice(normalizeAlgoIndexerTxs(txs, { address: target.address })), note: null };
}

async function fetchScanSolanaTarget(target) {
  const rpc = async (method, params) => {
    const data = await scanFetchJson(SOLANA_RPC, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    return data && !data.error ? data.result : null;
  };
  const [bal, sigs] = await Promise.all([
    rpc("getBalance", [target.address]),
    rpc("getSignaturesForAddress", [target.address, { limit: SCAN_TX_LIMIT }]),
  ]);
  if (!Array.isArray(sigs)) return scanFailed(target, "SOL");
  const live = sigs.filter(s => s && !s.err && typeof s.signature === "string");
  const parsed = await Promise.all(live.map(s =>
    rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])));
  const rows = live.flatMap((s, i) => normalizeSolanaTx(parsed[i], s.signature, { address: target.address }));
  return { target, ok: true, balanceText: bal && Number.isFinite(bal.value) ? formatTokenAmount(bal.value, 9) : null,
    balanceSymbol: "SOL", rows: scanSortSlice(rows), note: null };
}

async function fetchScanTronTarget(target) {
  const [acct, txs, trc20] = await Promise.all([
    scanFetchJson(`${TRONGRID}/v1/accounts/${target.address}`),
    scanFetchJson(`${TRONGRID}/v1/accounts/${target.address}/transactions?limit=${SCAN_TX_LIMIT}&only_confirmed=true&order_by=block_timestamp,desc`),
    scanFetchJson(`${TRONGRID}/v1/accounts/${target.address}/transactions/trc20?limit=${SCAN_TX_LIMIT}&only_confirmed=true`),
  ]);
  if (!txs && !trc20) return scanFailed(target, "TRX");
  const balRaw = acct?.data?.[0]?.balance;
  const rows = mergeScanRows([
    normalizeTronTxs(txs, { address: target.address }),
    normalizeTronTrc20Txs(trc20, { address: target.address }),
  ]).slice(0, SCAN_TX_LIMIT);
  return { target, ok: true, balanceText: Number.isFinite(balRaw) ? formatTokenAmount(balRaw, 6) : "0",
    balanceSymbol: "TRX", rows, note: null };
}

async function fetchScanSuiTarget(target) {
  const gql = async (query, variables) => {
    const data = await scanFetchJson(SUI_GRAPHQL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }) });
    return data && !data.errors ? data.data : null;
  };
  const [balData, txData] = await Promise.all([
    gql(`query($a: SuiAddress!) { address(address: $a) { balance(coinType: "0x2::sui::SUI") { totalBalance } } }`, { a: target.address }),
    gql(`query($a: SuiAddress!, $n: Int!) { transactions(first: $n, filter: { affectedAddress: $a }) {
      nodes { digest sender { address } effects { timestamp balanceChanges { nodes { coinType { repr } amount owner { address } } } } } } }`,
      { a: target.address, n: SCAN_TX_LIMIT }),
  ]);
  if (!txData && !balData) return scanFailed(target, "SUI");
  const total = balData?.address?.balance?.totalBalance;
  return { target, ok: !!txData, balanceText: typeof total === "string" && /^[0-9]+$/.test(total) ? formatTokenAmount(BigInt(total), 9) : null,
    balanceSymbol: "SUI",
    rows: txData ? scanSortSlice(normalizeSuiTxPage({ data: txData }, { address: target.address })) : [],
    note: txData ? null : "failed" };
}

/** Read one Scan target. NEVER throws — a bad source is a per-chain
 *  "failed" result the UI shows honestly, not a crashed search. */
export async function fetchScanTarget(target) {
  try {
    if (!target || typeof target.address !== "string" || !target.address) return scanFailed(target, "");
    switch (target.family) {
      case "evm": return await fetchScanEvmTarget(target);
      case "btc": return await fetchScanBtcTarget(target);
      case "algo": return await fetchScanAlgoTarget(target);
      case "solana": return await fetchScanSolanaTarget(target);
      case "tron": return await fetchScanTronTarget(target);
      case "sui": return await fetchScanSuiTarget(target);
      default: return scanFailed(target, "");
    }
  } catch { return scanFailed(target, ""); }
}
/** Read every target in parallel (each with its own timeout); the
 *  results come back in target order for the balance headers, and the
 *  caller merges .rows for the unified feed. */
export async function fetchScan(targets) {
  return Promise.all((Array.isArray(targets) ? targets : []).map(t => fetchScanTarget(t)));
}

// ---------- WalletConnect v2 (wallet side; EVM/eip155 in v1) ----------
// Fluid as a WALLET for other apps: a dApp hands the user a wc: URI,
// the user pastes it into Fluid, and Fluid pairs through the
// WalletConnect relay (Reown WalletKit, lazy chunk —
// src/walletconnect.js). The transport lives in the chunk; EVERY
// decision lives here, pure and unit-tested:
//
//   * parseWcUri — is this string really a v2 pairing URI?
//   * planWcNamespaces / buildWcNamespaces — what would approving a
//     session proposal grant? Only chains/methods Fluid actually has.
//   * decodeWcRequest — the F-01 rule (red-team, 2026-11-06): the
//     signer inspects the PAYLOAD, never just the envelope. Every
//     session request is decoded into a human-readable intent BEFORE
//     anything is signed; anything that cannot be decoded is REFUSED
//     here, in core, so no UI path can sign it blind.
//
// Scope v1: EVM (eip155) only — that is what dApp connect screens and
// hosted ramp-widget flows need. Solana and the other families are
// future work; proposals that REQUIRE another family are refused
// outright, never half-met.

/** The Reown (WalletConnect Cloud) project id — the "Fluid Wallet"
 *  project's public client id (Reown dashboard, created 2026-11-08).
 *  A placeholder value here would mean "not configured", and the
 *  WalletConnect panel says so honestly instead of failing silently.
 *  This is the ONLY place the id lives. */
export const WALLETCONNECT_PROJECT_ID = "220705e3c4dc16fd3c8aaf353b2e0daa";
export function walletConnectConfigured() {
  return typeof WALLETCONNECT_PROJECT_ID === "string"
    && WALLETCONNECT_PROJECT_ID.trim() !== ""
    && WALLETCONNECT_PROJECT_ID !== "REPLACE_WITH_REOWN_PROJECT_ID";
}
export const WALLETCONNECT_RELAY_URL = "wss://relay.walletconnect.com";

/** Methods Fluid will sign or answer over WalletConnect in v1.
 *  eth_sign is deliberately ABSENT: it signs an opaque hash the user
 *  cannot read, which the F-01 rule forbids. eth_signTransaction is
 *  absent too — a partial transaction's missing fields cannot be
 *  inspected, so there is nothing honest to approve. */
export const WC_EIP155_METHODS = Object.freeze([
  "eth_sendTransaction",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_accounts",
  "eth_chainId",
]);
export const WC_EIP155_EVENTS = Object.freeze(["chainChanged", "accountsChanged"]);

/** The NETWORKS key for an EVM chain id (built-ins plus any runtime-
 *  discovered chains), or null when Fluid doesn't know the chain. */
export function evmNetworkKeyForChainId(chainId) {
  const id = Number(chainId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === id) || null;
}
/** Every EVM chain id Fluid can sign for right now. */
export function wcSupportedChainIds() {
  return Object.values(NETWORKS).map(n => n.chainId);
}

/** Parse + validate a WalletConnect v2 pairing URI. Returns
 *  { topic, version: 2, symKey, relayProtocol, relayData, methods }
 *  or null — anything malformed, any v1 URI, or a URI missing its
 *  symmetric key is not pairable, full stop. */
export function parseWcUri(uri) {
  if (typeof uri !== "string") return null;
  const m = /^wc:([0-9a-fA-F]{64})@2\?(.+)$/.exec(uri.trim());
  if (!m) return null;
  let q;
  try { q = new URLSearchParams(m[2]); } catch { return null; }
  const symKey = q.get("symKey") || "";
  if (!/^[0-9a-fA-F]{64}$/.test(symKey)) return null;
  if (q.get("relay-protocol") !== "irn") return null;
  return {
    topic: m[1], version: 2, symKey,
    relayProtocol: "irn",
    relayData: q.get("relay-data"),
    methods: (q.get("methods") || "").split(",").map(s => s.trim()).filter(Boolean),
  };
}

function wcCaipChainId(caip) {
  if (typeof caip === "number" && Number.isFinite(caip)) return caip;
  const m = /^eip155:(\d+)$/.exec(String(caip || "").trim());
  return m ? Number(m[1]) : null;
}

/** Collect chains/methods/events out of a namespaces map (proposal
 *  required/optional), keyed by bare family ("eip155") or by CAIP-2
 *  chain ("eip155:1"). Non-EVM families land in .other. */
function wcCollect(nsMap) {
  const out = { chains: new Set(), methods: new Set(), events: new Set(), other: new Set() };
  for (const [key, ns] of Object.entries(nsMap || {})) {
    const base = key.includes(":") ? key.slice(0, key.indexOf(":")) : key;
    if (base !== "eip155") { out.other.add(base); continue; }
    const keyChain = wcCaipChainId(key);
    if (keyChain != null) out.chains.add(keyChain);
    for (const c of (ns && ns.chains) || []) { const id = wcCaipChainId(c); if (id != null) out.chains.add(id); }
    for (const mth of (ns && ns.methods) || []) if (typeof mth === "string") out.methods.add(mth);
    for (const ev of (ns && ns.events) || []) if (typeof ev === "string") out.events.add(ev);
  }
  return out;
}

function wcProposalParams(proposal) {
  if (!proposal || typeof proposal !== "object") return {};
  // WalletKit emits { id, params }; accept the params struct directly too.
  return proposal.params && typeof proposal.params === "object" ? proposal.params : proposal;
}

/** Work out what approving a session proposal would grant. Throws an
 *  Error with a user-readable reason when the proposal asks for
 *  anything Fluid cannot or will not do (a required non-EVM family, a
 *  required chain Fluid doesn't support, a required method outside
 *  the inspectable v1 set). Optional extras are trimmed, never fatal. */
export function planWcNamespaces(proposal) {
  const params = wcProposalParams(proposal);
  const req = wcCollect(params.requiredNamespaces);
  const opt = wcCollect(params.optionalNamespaces);
  if (req.other.size) {
    throw new Error(`This app requires ${[...req.other].join(", ")} support — Fluid's WalletConnect speaks EVM (eip155) only for now, so it can't connect safely.`);
  }
  const supported = new Set(wcSupportedChainIds());
  const badChains = [...req.chains].filter(id => !supported.has(id));
  if (badChains.length) {
    throw new Error(`This app requires chain id ${badChains.join(", ")} — Fluid doesn't support ${badChains.length === 1 ? "that chain" : "those chains"}.`);
  }
  const badMethods = [...req.methods].filter(m => !WC_EIP155_METHODS.includes(m));
  if (badMethods.length) {
    throw new Error(`This app requires the method ${badMethods.join(", ")} — Fluid won't sign what it can't show you, and it can't inspect that method.`);
  }
  const chains = new Set(req.chains);
  for (const id of opt.chains) if (supported.has(id)) chains.add(id);
  // No chain named at all: the account is the same key on every EVM
  // chain Fluid knows — approve the full set, listed on the sheet.
  if (!chains.size) for (const id of supported) chains.add(id);
  const methods = new Set([...req.methods, ...opt.methods].filter(m => WC_EIP155_METHODS.includes(m)));
  if (!methods.size) for (const m of ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4", "eth_accounts", "eth_chainId"]) methods.add(m);
  const events = new Set([...req.events, ...opt.events].filter(e => WC_EIP155_EVENTS.includes(e)));
  if (!events.size) for (const e of WC_EIP155_EVENTS) events.add(e);
  return { chains: [...chains], methods: [...methods], events: [...events] };
}

/** Everything the proposal sheet renders, pre-digested: dApp identity
 *  (HOSTILE strings — returned raw; the UI must escape them), the
 *  requested chains with Fluid's names + support flags, the requested
 *  methods, and the refusal reason if approving is impossible. */
export function describeWcProposal(proposal) {
  const params = wcProposalParams(proposal);
  const md = (params.proposer && params.proposer.metadata) || {};
  const req = wcCollect(params.requiredNamespaces);
  const opt = wcCollect(params.optionalNamespaces);
  const chainRow = (id, required) => {
    const key = evmNetworkKeyForChainId(id);
    return { chainId: id, name: key ? NETWORKS[key].name : `Chain ${id}`, supported: !!key, required };
  };
  let refusal = null;
  try { planWcNamespaces(proposal); } catch (e) { refusal = e.message; }
  return {
    name: typeof md.name === "string" ? md.name : "",
    description: typeof md.description === "string" ? md.description : "",
    url: typeof md.url === "string" ? md.url : "",
    icon: Array.isArray(md.icons) && typeof md.icons[0] === "string" ? md.icons[0] : "",
    chains: [
      ...[...req.chains].map(id => chainRow(id, true)),
      ...[...opt.chains].filter(id => !req.chains.has(id)).map(id => chainRow(id, false)),
    ],
    methods: [...new Set([...req.methods, ...opt.methods])],
    otherNamespaces: [...new Set([...req.other, ...opt.other])],
    refusal,
  };
}

/** The namespaces object handed to WalletKit.approveSession when the
 *  user approves: only Fluid-supported chains, only inspectable
 *  methods, the user's one EVM address on every approved chain. */
export function buildWcNamespaces({ proposal, address }) {
  if (!ethers.isAddress(address)) throw new Error("WalletConnect needs a valid EVM address to connect.");
  const plan = planWcNamespaces(proposal);
  const acct = ethers.getAddress(address);
  return {
    eip155: {
      chains: plan.chains.map(id => `eip155:${id}`),
      methods: plan.methods,
      events: plan.events,
      accounts: plan.chains.map(id => `eip155:${id}:${acct}`),
    },
  };
}

/** One row for the connected-sessions list. Metadata strings are
 *  dApp-supplied and hostile — returned raw; the UI escapes them. */
export function wcSessionSummary(session) {
  const md = (session && session.peer && session.peer.metadata) || {};
  const ns = (session && session.namespaces) || {};
  const chainIds = new Set();
  for (const nsVal of Object.values(ns)) {
    for (const acct of (nsVal && nsVal.accounts) || []) {
      const parts = String(acct).split(":");
      if (parts[0] === "eip155") { const id = Number(parts[1]); if (Number.isFinite(id)) chainIds.add(id); }
    }
    for (const c of (nsVal && nsVal.chains) || []) { const id = wcCaipChainId(c); if (id != null) chainIds.add(id); }
  }
  return {
    topic: session && session.topic ? String(session.topic) : "",
    name: typeof md.name === "string" ? md.name : "",
    url: typeof md.url === "string" ? md.url : "",
    icon: Array.isArray(md.icons) && typeof md.icons[0] === "string" ? md.icons[0] : "",
    chainIds: [...chainIds],
    expiry: session && session.expiry ? Number(session.expiry) : null,
  };
}

const WC_MAX_REVIEW_CHARS = 10000;
const wcRefuse = (reason) => ({ ok: false, reason });
function wcHexQty(v) {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v)) { try { return BigInt(v); } catch { return null; } }
  if (typeof v === "string" && /^[0-9]+$/.test(v)) { try { return BigInt(v); } catch { return null; } }
  return null;
}

function wcDecodePersonalSign(params, ownAddress) {
  if (!Array.isArray(params) || params.length < 2) return wcRefuse("The sign request is malformed (personal_sign needs a message and an address).");
  let rawMsg = params[0], rawAddr = params[1];
  // Legacy order [address, message]: some dApps still send it. Only
  // trust the swap when param 0 is exactly OUR address and param 1 is
  // not an address at all — a 20-byte hex message stays ambiguous and
  // keeps the spec order.
  if (typeof rawMsg === "string" && ethers.isAddress(rawMsg) && ownAddress
      && rawMsg.toLowerCase() === ownAddress.toLowerCase()
      && typeof rawAddr === "string" && !ethers.isAddress(rawAddr)) {
    [rawMsg, rawAddr] = [rawAddr, rawMsg];
  }
  if (typeof rawAddr === "string" && ethers.isAddress(rawAddr) && ownAddress && rawAddr.toLowerCase() !== ownAddress.toLowerCase())
    return wcRefuse("This request asks you to sign for a different account than yours.");
  let text = null, hex = null;
  if (typeof rawMsg === "string" && /^0x[0-9a-fA-F]*$/.test(rawMsg) && rawMsg.length % 2 === 0) {
    hex = rawMsg;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(ethers.getBytes(rawMsg)); }
    catch { return wcRefuse("The message isn't readable text — Fluid never signs a message it can't show you."); }
  } else if (typeof rawMsg === "string") {
    text = rawMsg;
  }
  if (text == null) return wcRefuse("The message isn't text — Fluid never signs a message it can't show you.");
  if (!text.length) return wcRefuse("The message is empty — nothing to sign.");
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) return wcRefuse("The message contains hidden control characters — Fluid won't sign it.");
  if (text.length > WC_MAX_REVIEW_CHARS) return wcRefuse("The message is too long to review in full — Fluid won't sign what you can't read end to end.");
  return {
    ok: true, kind: "personal_sign",
    intent: "Sign a message with your wallet. This moves no funds, but a signature proves you control this wallet — and some sites treat it as a login or an agreement. Read every word:",
    rows: [{ label: "Message", value: text }],
    warning: null,
    sign: { type: "message", text, hex },
  };
}

function wcFlattenTyped(prefix, value, rows) {
  if (value == null) { rows.push({ label: prefix, value: String(value) }); return; }
  if (Array.isArray(value)) {
    if (!value.length) { rows.push({ label: prefix, value: "[]" }); return; }
    value.forEach((v, i) => wcFlattenTyped(`${prefix}[${i}]`, v, rows));
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) { rows.push({ label: prefix, value: "{}" }); return; }
    for (const k of keys) wcFlattenTyped(prefix ? `${prefix}.${k}` : k, value[k], rows);
    return;
  }
  rows.push({ label: prefix, value: String(value) });
}

function wcDecodeTypedData(params, chainId, ownAddress) {
  if (!Array.isArray(params) || params.length < 2) return wcRefuse("The typed-data request is malformed.");
  const [rawAddr, rawData] = params;
  if (typeof rawAddr === "string" && ethers.isAddress(rawAddr) && ownAddress && rawAddr.toLowerCase() !== ownAddress.toLowerCase())
    return wcRefuse("This request asks you to sign for a different account than yours.");
  let data = rawData;
  if (typeof rawData === "string") {
    try { data = JSON.parse(rawData); }
    catch { return wcRefuse("The typed data isn't valid JSON — Fluid can't show it to you, so it won't sign it."); }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return wcRefuse("The typed data is malformed.");
  const { types, primaryType, domain, message } = data;
  if (!types || typeof types !== "object" || typeof primaryType !== "string" || !Array.isArray(types[primaryType]))
    return wcRefuse("The typed data doesn't name a valid primary type — Fluid can't verify it.");
  if (!message || typeof message !== "object" || Array.isArray(message)) return wcRefuse("The typed data has no message object to review.");
  const dom = domain && typeof domain === "object" && !Array.isArray(domain) ? domain : {};
  if (dom.chainId != null && Number(dom.chainId) !== Number(chainId))
    return wcRefuse(`The typed data is for chain ${dom.chainId}, but the request came in on chain ${chainId} — a mismatch Fluid won't sign.`);
  const signTypes = { ...types };
  delete signTypes.EIP712Domain;
  // Verify the payload actually encodes under EIP-712 before anyone
  // is asked to sign it — malformed typed data is refused here, not
  // at the key.
  try { ethers.TypedDataEncoder.hash(dom, signTypes, message); }
  catch (e) { return wcRefuse("Fluid couldn't verify this typed data (" + ((e && (e.shortMessage || e.message)) || "invalid") + ") — refusing to sign it."); }
  const rows = [];
  for (const k of ["name", "version", "chainId", "verifyingContract", "salt"]) if (dom[k] != null) rows.push({ label: `Domain ${k}`, value: String(dom[k]) });
  wcFlattenTyped("", message, rows);
  const totalChars = rows.reduce((n, r) => n + r.label.length + r.value.length, 0);
  if (totalChars > WC_MAX_REVIEW_CHARS) return wcRefuse("The typed data is too large to review in full — Fluid won't sign what you can't read end to end.");
  const looksPermit = /permit/i.test(primaryType) || ("spender" in message && "value" in message && "deadline" in message);
  return {
    ok: true, kind: "typed_data",
    intent: `Sign typed data (${primaryType})${dom.name ? ` for ${dom.name}` : ""}. This is an off-chain signature: it moves no funds by itself, but it can authorise real actions elsewhere. Check every field:`,
    rows,
    warning: looksPermit ? "This looks like a token PERMIT: signing it can let the spender named in the fields move your tokens without a separate approval transaction." : null,
    sign: { type: "typedData", domain: dom, types: signTypes, value: message },
  };
}

const WC_ERC20_SELECTORS = { "0xa9059cbb": "transfer", "0x23b872dd": "transferFrom", "0x095ea7b3": "approve" };
function wcDecodeTx(params, chainId, ownAddress) {
  if (!Array.isArray(params) || !params[0] || typeof params[0] !== "object") return wcRefuse("The transaction request is malformed.");
  const tx = params[0];
  const networkKey = evmNetworkKeyForChainId(chainId);
  if (!networkKey) return wcRefuse(`Fluid doesn't support chain ${chainId}, so it can't send this transaction.`);
  const net = NETWORKS[networkKey];
  if (tx.chainId != null) {
    const cid = wcHexQty(tx.chainId);
    if (cid == null || Number(cid) !== Number(chainId)) return wcRefuse("The transaction's chain doesn't match the chain the request came in on — refusing.");
  }
  if (typeof tx.from === "string" && ownAddress && tx.from.toLowerCase() !== ownAddress.toLowerCase())
    return wcRefuse("This transaction is from a different account than yours.");
  if (tx.to == null) return wcRefuse("This transaction creates a new contract — Fluid can't show you what deployed code will do, so it won't sign it.");
  if (!ethers.isAddress(tx.to)) return wcRefuse("The transaction's destination isn't a valid address.");
  const to = ethers.getAddress(tx.to);
  const value = tx.value == null ? 0n : wcHexQty(tx.value);
  if (value == null) return wcRefuse("The transaction's value is malformed.");
  const data = typeof tx.data === "string" ? tx.data : "0x";
  if (!/^0x([0-9a-fA-F]{2})*$/.test(data)) return wcRefuse("The transaction's data is malformed.");
  // Gas fields: pass through only the well-formed ones, and show them.
  const gasRows = [];
  const signTx = { to, value: "0x" + value.toString(16), data, chainId: Number(chainId) };
  const gasRaw = tx.gas != null ? tx.gas : tx.gasLimit;
  const gasLimit = gasRaw != null ? wcHexQty(gasRaw) : null;
  if (gasRaw != null && gasLimit == null) return wcRefuse("The transaction's gas limit is malformed.");
  if (gasLimit != null) { signTx.gasLimit = "0x" + gasLimit.toString(16); gasRows.push({ label: "Gas limit (set by the app)", value: gasLimit.toLocaleString("en-US") }); }
  for (const f of ["gasPrice", "maxFeePerGas", "maxPriorityFeePerGas"]) {
    if (tx[f] != null) {
      const q = wcHexQty(tx[f]);
      if (q == null) return wcRefuse(`The transaction's ${f} is malformed.`);
      signTx[f] = "0x" + q.toString(16);
      gasRows.push({ label: f, value: `${ethers.formatUnits(q, "gwei")} gwei` });
    }
  }
  const sym = net.symbol;
  if (data === "0x") {
    return {
      ok: true, kind: "transaction", networkKey,
      intent: `Send ${ethers.formatEther(value)} ${sym} to ${to} on ${net.name}.`,
      rows: [{ label: "To", value: to }, { label: "Amount", value: `${ethers.formatEther(value)} ${sym}` }, { label: "Network", value: net.name }, ...gasRows],
      warning: null,
      sign: { type: "transaction", networkKey, tx: signTx },
    };
  }
  const selector = data.slice(0, 10).toLowerCase();
  const fn = WC_ERC20_SELECTORS[selector];
  if (!fn) return wcRefuse(`Fluid can't decode this contract call (function ${selector}) — it refuses to sign what it can't show you.`);
  // A token call that ALSO carries native currency is an anomaly —
  // never sign the combination in v1.
  if (value !== 0n) return wcRefuse("This contract call also carries native currency — an unusual combination Fluid won't sign.");
  let args;
  try {
    args = ethers.AbiCoder.defaultAbiCoder().decode(
      fn === "transferFrom" ? ["address", "address", "uint256"] : ["address", "uint256"],
      "0x" + data.slice(10));
  } catch { return wcRefuse("The contract call's arguments are malformed — refusing to sign it."); }
  const token = (net.tokens || []).find(t => t.address.toLowerCase() === to.toLowerCase()) || null;
  const amount = fn === "transferFrom" ? args[2] : args[1];
  const amountText = token
    ? `${ethers.formatUnits(amount, token.decimals)} ${token.symbol}`
    : `${amount.toString()} base units of the token at ${to} (Fluid doesn't know this token, so it can't convert the amount)`;
  const tokenRow = { label: "Token contract", value: token ? `${to} (${token.symbol})` : to };
  const base = { ok: true, kind: "transaction", networkKey, sign: { type: "transaction", networkKey, tx: signTx } };
  if (fn === "transfer") {
    const dest = ethers.getAddress(args[0]);
    return { ...base,
      intent: `Transfer ${amountText} to ${dest} on ${net.name}.`,
      rows: [tokenRow, { label: "To", value: dest }, { label: "Amount", value: amountText }, { label: "Network", value: net.name }, ...gasRows],
      warning: null };
  }
  if (fn === "transferFrom") {
    const from = ethers.getAddress(args[0]), dest = ethers.getAddress(args[1]);
    return { ...base,
      intent: `Move ${amountText} from ${from} to ${dest} on ${net.name}, spending an allowance (transferFrom).`,
      rows: [tokenRow, { label: "From", value: from }, { label: "To", value: dest }, { label: "Amount", value: amountText }, { label: "Network", value: net.name }, ...gasRows],
      warning: "transferFrom moves tokens OUT of the From account using an allowance it granted — make sure that account and this amount are what you expect." };
  }
  // approve
  const spender = ethers.getAddress(args[0]);
  const unlimited = amount === (2n ** 256n - 1n);
  return { ...base,
    intent: `Approve ${spender} to spend ${unlimited ? "an UNLIMITED amount" : amountText} of this token from your wallet on ${net.name}.`,
    rows: [tokenRow, { label: "Spender", value: spender }, { label: "Allowance", value: unlimited ? "UNLIMITED" : amountText }, { label: "Network", value: net.name }, ...gasRows],
    warning: unlimited
      ? "UNLIMITED allowance: this spender can move ALL of this token from your wallet, at any time, until you revoke it."
      : "An approval lets the spender move this token from your wallet up to the allowance — it is not a transfer yet, but treat it like one." };
}

/** Decode one WalletConnect session request into a human-readable
 *  intent (F-01: inspect the payload, not the envelope). Returns
 *  { ok:false, reason } — the request must be rejected with that
 *  reason and NOTHING may be signed — or { ok:true, kind, intent,
 *  rows, warning, sign } where `sign` is the exact payload the core
 *  sign helpers below will sign. Read-only kinds (eth_accounts /
 *  eth_chainId) come back with auto:true and sign:null — they reveal
 *  only what the approved session already granted. chainId accepts
 *  1, "1" or "eip155:1". */
export function decodeWcRequest({ method, params, chainId, ownAddress } = {}) {
  const cidNum = typeof chainId === "string" && chainId.includes(":") ? wcCaipChainId(chainId) : Number(chainId);
  switch (method) {
    case "eth_accounts":
      return { ok: true, kind: "accounts", auto: true, intent: "", rows: [], warning: null, sign: null, chainId: cidNum };
    case "eth_chainId":
      return { ok: true, kind: "chainId", auto: true, intent: "", rows: [], warning: null, sign: null, chainId: cidNum };
    case "personal_sign": {
      const d = wcDecodePersonalSign(params, ownAddress);
      return d.ok ? { ...d, chainId: cidNum } : d;
    }
    case "eth_signTypedData": case "eth_signTypedData_v3": case "eth_signTypedData_v4": {
      const d = wcDecodeTypedData(params, cidNum, ownAddress);
      return d.ok ? { ...d, chainId: cidNum } : d;
    }
    case "eth_sendTransaction": {
      const d = wcDecodeTx(params, cidNum, ownAddress);
      return d.ok ? { ...d, chainId: cidNum } : d;
    }
    case "eth_sign":
      return wcRefuse("eth_sign asks for a signature over an unreadable hash — Fluid never signs what it can't show you.");
    case "eth_signTransaction":
      return wcRefuse("Fluid doesn't sign raw transactions over WalletConnect in v1 — the app should use eth_sendTransaction so the send can be reviewed in full and broadcast properly.");
    case "wallet_switchEthereumChain":
      return wcRefuse("Fluid keeps its own network view — chain switching from a dApp isn't supported in v1.");
    case "wallet_addEthereumChain":
      return wcRefuse("Fluid discovers EVM chains itself — adding chains from a dApp isn't supported.");
    default:
      return wcRefuse(`Fluid doesn't support the method "${String(method)}" over WalletConnect yet.`);
  }
}

/** Sign a decoded personal_sign payload (from decodeWcRequest). When
 *  the dApp sent the message as hex, the BYTES are signed, so the
 *  signature matches the exact payload that was reviewed. */
export async function signWcMessage(wallet, sign) {
  if (!sign || sign.type !== "message") throw new Error("Not a decoded message payload.");
  return sign.hex ? wallet.signMessage(ethers.getBytes(sign.hex)) : wallet.signMessage(sign.text);
}

/** Sign a decoded EIP-712 typed-data payload (from decodeWcRequest). */
export async function signWcTypedData(wallet, sign) {
  if (!sign || sign.type !== "typedData") throw new Error("Not a decoded typed-data payload.");
  return wallet.signTypedData(sign.domain, sign.types, sign.value);
}

/** Broadcast a decoded eth_sendTransaction through Fluid's own RPC
 *  for that chain — the same provider every Fluid send uses. Returns
 *  the ethers transaction response; the caller awaits .wait(). */
export async function executeWcTransaction(wallet, sign) {
  if (!sign || sign.type !== "transaction") throw new Error("Not a decoded transaction payload.");
  const signer = wallet.connect(providerFor(sign.networkKey));
  return signer.sendTransaction({ ...sign.tx });
}
