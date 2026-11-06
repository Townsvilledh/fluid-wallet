#!/bin/bash
# C compiler shim for wasm32-unknown-unknown: cc-rs appends rustc-style
# --target=wasm32-unknown-unknown, which zig does not understand, so
# strip it and substitute zig's freestanding wasm target. Requires zig
# (https://ziglang.org) or set FLUID_CC to a real clang for wasm.
args=()
prev=""
for a in "$@"; do
  if [[ "$a" == --target=* ]]; then continue; fi
  if [[ "$prev" == "--target" ]]; then prev=""; continue; fi
  if [[ "$a" == "--target" ]]; then prev="--target"; continue; fi
  args+=("$a")
done
exec "${FLUID_ZIG:-zig}" cc -target wasm32-freestanding "${args[@]}"
