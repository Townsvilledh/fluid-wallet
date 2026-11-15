// Lightning WASM provenance (security audit F-4.1, 2026-11-15).
//
// The 11 MB Lightning WASM is a compiled Rust artifact that the
// build copies into dist verbatim. Before this record existed,
// nothing tied those bytes to the lightning/ source tree: the
// LN_WASM_PIN in the bundle is computed FROM the published
// bytes, so it proves consistency, not provenance — a swapped
// WASM would have sailed through with a fresh, valid pin.
//
// The committed record (lightning/pkg-web/provenance.json)
// binds the artifact to its source:
//   wasmSha256   — sha256 of lightning/pkg-web/fluid_lightning_bg.wasm
//   sourceSha256 — sha256 over the WASM's source inputs:
//                  lightning/Cargo.toml, Cargo.lock, build.sh,
//                  zigar.sh, zigcc.sh and every file under
//                  lightning/src/, framed as
//                  sha256(concat of "<relpath>\0<file-sha256-hex>\n")
//                  in sorted relpath order.
// scripts/build.mjs recomputes both and FAILS the build on any
// mismatch, so dist can never silently carry a WASM that does
// not correspond to the recorded source. After a genuine WASM
// rebuild, refresh the record with:
//
//   node scripts/lightning-provenance.mjs --write
//
// and commit the updated provenance.json with the new artifact.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
export const LN_PROVENANCE_PATH = join(ROOT, "lightning/pkg-web/provenance.json");
export const LN_WASM_PATH = join(ROOT, "lightning/pkg-web/fluid_lightning_bg.wasm");

const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

function sourceFiles(root) {
  const files = ["Cargo.toml", "Cargo.lock", "build.sh", "zigar.sh", "zigcc.sh"]
    .map((f) => join(root, "lightning", f))
    .filter((p) => existsSync(p));
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(join(root, "lightning", "src"));
  return files.sort((a, b) => (relative(root, a) < relative(root, b) ? -1 : 1));
}

/** sha256 over the WASM's source inputs (see header). */
export function lightningSourceSha256(root = ROOT) {
  const h = createHash("sha256");
  for (const p of sourceFiles(root)) {
    h.update(relative(root, p) + "\0" + sha256Hex(readFileSync(p)) + "\n");
  }
  return h.digest("hex");
}

function toolVersion(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

/** The full provenance record for the tree as it stands. */
export function computeLightningProvenance(root = ROOT) {
  return {
    artifact: "lightning/pkg-web/fluid_lightning_bg.wasm",
    wasmSha256: sha256Hex(readFileSync(join(root, "lightning/pkg-web/fluid_lightning_bg.wasm"))),
    sourceSha256: lightningSourceSha256(root),
    toolchain: {
      cargo: toolVersion("cargo", ["--version"]),
      rustc: toolVersion("rustc", ["--version"]),
      wasmPack: toolVersion("wasm-pack", ["--version"]),
    },
    recordedAt: new Date().toISOString(),
  };
}

/** Verify the committed record against the tree. Returns
 *  { ok } or { ok: false, reason } — build.mjs fails on !ok. */
export function verifyLightningProvenance(root = ROOT) {
  if (!existsSync(LN_PROVENANCE_PATH))
    return { ok: false, reason: "lightning/pkg-web/provenance.json is missing — run: node scripts/lightning-provenance.mjs --write" };
  let record;
  try { record = JSON.parse(readFileSync(LN_PROVENANCE_PATH, "utf8")); }
  catch { return { ok: false, reason: "lightning/pkg-web/provenance.json does not parse — regenerate it: node scripts/lightning-provenance.mjs --write" }; }
  const now = computeLightningProvenance(root);
  if (record.wasmSha256 !== now.wasmSha256)
    return { ok: false, reason: "the Lightning WASM bytes do not match lightning/pkg-web/provenance.json — if the WASM was genuinely rebuilt, refresh the record (node scripts/lightning-provenance.mjs --write); otherwise the artifact is not the one recorded for this source." };
  if (record.sourceSha256 !== now.sourceSha256)
    return { ok: false, reason: "the lightning/ source tree does not match lightning/pkg-web/provenance.json — the shipped WASM was not recorded as built from this source. Rebuild the WASM from lightning/ and refresh the record (node scripts/lightning-provenance.mjs --write)." };
  return { ok: true, record };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    const record = computeLightningProvenance();
    writeFileSync(LN_PROVENANCE_PATH, JSON.stringify(record, null, 2) + "\n");
    console.log("wrote", LN_PROVENANCE_PATH);
    console.log("  wasmSha256  ", record.wasmSha256);
    console.log("  sourceSha256", record.sourceSha256);
  } else {
    const v = verifyLightningProvenance();
    console.log(v.ok ? "✓ Lightning WASM provenance matches the committed record." : "✗ " + v.reason);
    process.exit(v.ok ? 0 : 1);
  }
}
