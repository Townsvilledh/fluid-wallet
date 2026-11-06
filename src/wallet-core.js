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
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  Keypair as SolKeypair, PublicKey as SolPublicKey, SystemProgram as SolSystemProgram,
  Transaction as SolTransaction, TransactionInstruction as SolTxInstruction,
  VersionedTransaction as SolVersionedTransaction,
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
  const CG = CG_IDS;
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
    _feeGrab(async () => { const r = await fetch(`${MEMPOOL}/v1/fees/recommended`); const d = await r.json(); return Number(d.halfHourFee); }),
    _feeGrab(async () => { const r = await fetch("https://blockstream.info/api/fee-estimates"); const d = await r.json(); return Number(d["3"]); }),
  ]);
  return resolveFeeRate({ primary, secondary, ceiling: BTC_FEE_CEILING_SATVB, fallback: 5 });
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
  const res = await fetch(`${MEMPOOL}/address/${address}/utxos`);
  const confirmed = (await res.json()).filter(u => u.status && u.status.confirmed === true);
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
    const uRes = await fetch(`${MEMPOOL}/address/${acct.address}/utxos`);
    const utxoMap = new Map(((await uRes.json()) || [])
      .filter(u => u.status && u.status.confirmed === true).map(u => [`${u.txid}:${u.vout}`, u.value]));
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
export async function getLitecoinBalance(address) {
  const res = await fetch(`${LTC_API}/address/${address}`);
  const d = await res.json();
  const funded = d.chain_stats.funded_txo_sum + (d.mempool_stats?.funded_txo_sum || 0);
  const spent = d.chain_stats.spent_txo_sum + (d.mempool_stats?.spent_txo_sum || 0);
  return (funded - spent) / 1e8;
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
  // NB: litecoinspace's UTXO route is the singular /utxo (mempool.space
  // uses the plural /utxos) — verified live before wiring.
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
  const res = await fetch(`${DOGECHAIN_API}/v1/address/balance/${address}`);
  const d = await res.json();
  const bal = d?.balance ?? d?.data?.balance;
  if (bal == null) throw new Error("Dogecoin balance lookup failed.");
  return Number(bal);
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
 *  account simply doesn't exist yet (unfunded). Other failures throw. */
async function stellarFetchAccount(address) {
  const { status, data } = await horizonJson("/accounts/" + address);
  if (status === 404) return null;
  if (status !== 200 || !data) throw new Error("Stellar network error (HTTP " + status + ").");
  return data;
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
  return Object.keys(out).length ? out : null;
}
export async function resolveFluidName(input, registryUrl = NAMES_REGISTRY_URL) {
  const name = normalizeFluidName(input);
  if (!validateFluidName(name)) return null;
  const res = await fetch(registryUrl, { cache: "no-store" });
  if (!res.ok) return null;
  const reg = await res.json();
  const entry = sanitizeNameEntry(reg[name]);
  return entry ? { name, ...entry } : null;
}
/** Fetch the whole name registry (null on any failure). */
export async function fetchNameRegistry(registryUrl = NAMES_REGISTRY_URL) {
  const res = await fetch(registryUrl, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}
/** Reverse lookup: which registered name belongs to these addresses?
 *  EVM addresses compare case-insensitively (checksummed vs lowercase
 *  spellings of the same key); BTC addresses are case-sensitive and
 *  compare exactly. Returns { name, ...entry } or null. Lets a wallet
 *  that already owns a published name recognise it as its own instead
 *  of being told the name is "already claimed" by itself. */
export function findNameForAddresses(registry, { evm = null, btc = null } = {}) {
  if (!registry || typeof registry !== "object") return null;
  const evmLc = evm ? String(evm).toLowerCase() : null;
  for (const [name, rawEntry] of Object.entries(registry)) {
    const entry = sanitizeNameEntry(rawEntry);
    if (!entry) continue;
    if (evmLc && entry.evm && entry.evm.toLowerCase() === evmLc) return { name, ...entry };
    if (btc && entry.btc && entry.btc === btc) return { name, ...entry };
  }
  return null;
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
  "Mt Pelerin": { score: 1, note: "No ID needed for bank transfers up to ~CHF 999/month · 0% fee on your first CHF 500/year · then 0–1.3% by bank" },
  "Paybis": { score: 2, note: "Bank buy ~0.99% · sell from 1.49% · free email account + quick ID check — paste your Fluid address" },
  "Guardarian": { score: 3, note: "~1.6% built into the rate · No account — paste your Fluid address in their checkout" },
  "Fonbnk": { score: 4, note: "Bank & mobile money · fees shown in their quote before you pay" },
  "Mercuryo": { score: 5, note: "Buy 3.95% · sell 2.95% · ID required · selling pays EUR/USD/GBP to a card" },
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

/** The 32-byte seed for the in-app Lightning node, derived from the
 *  wallet's BIP-39 seed with HKDF-SHA256 under a Fluid-specific domain
 *  separator. Same phrase -> same Lightning node, on any device, and
 *  independent of every other chain's keys. */
export function deriveLightningSeed(phrase) {
  const clean = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  const seed = mnemonicToSeedSync(clean);
  return hkdf(sha256, seed, new TextEncoder().encode("fluid"), new TextEncoder().encode("fluid/lightning/ldk-seed/v1"), 32);
}

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

// ---------- Global ramps: Fluid routes, providers settle (users KYC with them) ----------
// Local-currency rails: pick a country, Fluid builds the provider link with
// that country's ISO code so the user deposits/withdraws in THEIR currency
// (NGN, KES, GHS, ZAR, USD, EUR...). Fonbnk covers the African corridors
// below (bank + mobile money inside its widget); the global providers
// cover 150-180+ countries each. Fluid never touches the fiat itself.
export const RAMP_COUNTRIES = [
  { code: "NG", name: "Nigeria · NGN", fiat: "NGN", fonbnk: true },
  { code: "KE", name: "Kenya · KES", fiat: "KES", fonbnk: true },
  { code: "GH", name: "Ghana · GHS", fiat: "GHS", fonbnk: true },
  { code: "ZA", name: "South Africa · ZAR", fiat: "ZAR", fonbnk: true },
  { code: "UG", name: "Uganda · UGX", fiat: "UGX", fonbnk: true },
  { code: "TZ", name: "Tanzania · TZS", fiat: "TZS", fonbnk: true },
  { code: "CM", name: "Cameroon · XAF", fiat: "XAF", fonbnk: true },
  { code: "SN", name: "Senegal · XOF", fiat: "XOF", fonbnk: true },
  { code: "CI", name: "Côte d'Ivoire · XOF", fiat: "XOF", fonbnk: true },
  { code: "ZM", name: "Zambia · ZMW", fiat: "ZMW", fonbnk: true },
  { code: "US", name: "United States · USD", fiat: "USD", fonbnk: false },
  { code: "GB", name: "United Kingdom · GBP", fiat: "GBP", fonbnk: false },
  { code: "DE", name: "Germany · EUR", fiat: "EUR", fonbnk: false },
  { code: "IN", name: "India · INR", fiat: "INR", fonbnk: false },
  { code: "BR", name: "Brazil · BRL", fiat: "BRL", fonbnk: false },
  { code: "PH", name: "Philippines · PHP", fiat: "PHP", fonbnk: false },
  { code: "ID", name: "Indonesia · IDR", fiat: "IDR", fonbnk: false },
  { code: "MX", name: "Mexico · MXN", fiat: "MXN", fonbnk: false },
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
  // Fonbnk's current widget: the ROOT path is the buy (on-ramp) flow; the
  // old /onramp path is dead (the app shows its own 404 view there — the
  // route table in the served bundle has AMOUNT:'/' and no /onramp entry).
  // Only non-gated params go in the link: source/signature/address/
  // freezeWallet require a KYB-verified merchant account, so the user
  // enters their address inside the widget.
  const p = new URLSearchParams({ network: net.fonbnkNetwork, asset, countryIsoCode: country });
  return `https://pay.fonbnk.com/?${p.toString()}`;
}
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
export function mtpelerinBuyUrl(asset = "USDT", fiat = "EUR") {
  const slugs = MTPELERIN_SLUGS[asset];
  if (!slugs || !MTPELERIN_FIATS.includes(fiat)) return null;
  const p = new URLSearchParams({ bsc: fiat, bdc: asset });
  return `https://www.mtpelerin.com/${slugs.buy}?${p.toString()}`;
}
export function mtpelerinSellUrl(asset = "USDT", fiat = "EUR") {
  const slugs = MTPELERIN_SLUGS[asset];
  if (!slugs || !MTPELERIN_FIATS.includes(fiat)) return null;
  const p = new URLSearchParams({ ssc: asset, sdc: fiat });
  return `https://www.mtpelerin.com/${slugs.sell}?${p.toString()}`;
}
// Global consumer ramps (no Fluid partner key needed; user completes on provider).
export const GLOBAL_RAMPS = [
  { name: "Guardarian", region: "Global · 170+ countries", buy: "https://guardarian.com/", sell: "https://guardarian.com/" },
  { name: "Paybis", region: "Global · 180+ countries", buy: "https://paybis.com/", sell: "https://paybis.com/" },
  { name: "Mercuryo", region: "Global · 150+ countries", buy: "https://mercuryo.io/", sell: "https://mercuryo.io/" },
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
/** The signer principle, Algorand edition: a sentence, never a blob. */
export function formatAlgoSendIntent({ amount, symbol, to, feeAlgo }) {
  let s = `Send ${amount} ${symbol} to ${to} on Algorand.`;
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
const XRPL_RPCS = ["https://s2.ripple.com:51234", "https://xrplcluster.com"];
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
    } catch (e) { lastErr = e; }
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
