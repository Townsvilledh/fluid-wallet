#!/bin/sh
ZIG="${FLUID_ZIG:-zig}"; command -v "$ZIG" >/dev/null 2>&1 || ZIG="$HOME/bin/zig"; exec "$ZIG" ar "$@"
