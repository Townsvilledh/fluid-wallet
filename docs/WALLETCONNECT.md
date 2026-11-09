# WalletConnect

Fluid connects to dapps with **WalletConnect v2** (via Reown):

- In **More → WalletConnect**, paste a pairing URI (`wc:…`) from the
  dapp — no camera needed.
- Every session request (connect, sign, send) is shown as a
  plain-language intent for approval first — inspect before you sign,
  the same rule as everywhere in Fluid.
- Disconnect a session at any time from the same sheet.
- **Current scope: EVM only (v1).** A dapp that *requires* non-EVM
  namespaces (for example a Solana-only dapp) cannot pair yet — the
  sheet says so instead of failing silently.
