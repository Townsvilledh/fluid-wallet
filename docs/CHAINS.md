# Chains, tokens, send & receive

One seed phrase derives every chain below. The same EVM address works on
every EVM network; each other family derives its own address from the
same seed. Everything listed here **ships**: balance, receive and send.

## Chain families

- **EVM — 15 built-in networks:** Ethereum, BNB Chain, Base, Arbitrum,
  OP Mainnet, Polygon, Avalanche, zkSync Era, Linea, Scroll, Mantle,
  Gnosis, Celo, Fuse, and Sepolia (testnet). Networks the swap routers
  support beyond the built-ins (for example **Arc**, chain 5042) are
  discovered and added automatically after unlock.
- **Bitcoin** — BIP84 native SegWit (bc1q…) and BIP86 Taproot (bc1p…).
  See `docs/BITCOIN-NATIVE.md`.
- **Lightning** — Fluid's own in-browser node (LDK) from the same seed.
  See `docs/LIGHTNING.md`.
- **Solana, Tron, Sui** — full send/receive plus swap routing.
- **Litecoin, Dogecoin, Bitcoin Cash** — UTXO family, full function.
- **Cosmos** — seven networks.
- **Stellar, TON, NEAR, Algorand, XRPL, Polkadot (Asset Hub), Aptos,
  Stacks** — full send/receive/balance.

## Tokens

- Native coins and the major stablecoins (USDC, USDT) are shown per
  network where they exist.
- **Any** other token the wallet holds is shown too, grouped under
  "Other tokens (N)": unverified token metadata is never rendered as
  clickable content, and a held balance is never silently shown as zero
  or hidden — a row shows a real value, a true zero, or an honest
  "couldn't load".

## Send & receive

- **Send to a raw address or a Fluid username** — every send field
  accepts both; a name resolves through the public registry
  (`names.README.md`) to the recipient's address on that chain.
- Every send is preceded by a plain-language review: *"Send 0.05 BNB to
  0x… on BNB Chain. Network fee about …"* — inspect before you sign,
  never a blind hex blob.
- Token approvals are **exact-amount only** — never unlimited.
- **Receive** by address or QR code on every family; the receive sheet
  states the network count as it actually is.
- Plain sends and receives carry **no Fluid fee** — network fees only
  (see `docs/FEES.md`).
