#!/bin/sh
# Build the fluid-lightning WASM packages (pkg-web for the app, pkg-node
# for the keeper/harness). Requires: cargo + the wasm32-unknown-unknown
# target, wasm-bindgen-cli (cargo install wasm-bindgen-cli --version
# 0.2.130), and a C compiler for secp256k1-sys: clang, or zig (set
# FLUID_ZIG=/path/to/zig) via the ./zigcc.sh shim.
set -e
cd "$(dirname "$0")"
if command -v clang >/dev/null 2>&1; then
  export CC_wasm32_unknown_unknown=clang
else
  export CC_wasm32_unknown_unknown="$PWD/zigcc.sh"
  export AR_wasm32_unknown_unknown="$PWD/zigar.sh"
fi
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/fluid_lightning.wasm --out-dir pkg-web --target web
wasm-bindgen target/wasm32-unknown-unknown/release/fluid_lightning.wasm --out-dir pkg-node --target nodejs
# The repo root package.json is "type": "module"; the nodejs glue is
# CommonJS, so mark pkg-node explicitly.
printf '{ "type": "commonjs" }\n' > pkg-node/package.json
echo "built pkg-web/ and pkg-node/"
