// Verify a published Fluid release (security audit F-5.1,
// 2026-11-15).
//
// The single-file build (dist/fluid-wallet.html) used to
// "authenticate" itself with a CSP hash computed from its own
// inlined bytes — self-referential, proving nothing. The real
// story: every build writes dist/checksums.txt (sha256 of the
// release artifacts, in sha256sum format), and the publish
// step signs it with Fluid's Ed25519 release key, placing
// checksums.txt.sig beside it on the served site. The public
// key is committed in the repo (public/release-pubkey.pem,
// copied into dist at build time) and its fingerprint is in
// docs/SECURITY.md.
//
// Usage:
//   node scripts/verify-release.mjs [directory]
// The directory defaults to ./dist; point it at a downloaded
// copy of the served files (index.html, app.bundle.js,
// fluid-wallet.html, recovery.html, fluid_lightning_bg.wasm,
// lightning.chunk.js, release-pubkey.pem, checksums.txt,
// checksums.txt.sig) to verify what was actually served.
import { readFileSync, existsSync } from "node:fs";
import { createHash, createPublicKey, verify } from "node:crypto";
import { join } from "node:path";

const dir = process.argv[2] || new URL("../dist", import.meta.url).pathname;
const fail = (m) => { console.error("✗ " + m); process.exit(1); };

const checksumsPath = join(dir, "checksums.txt");
const sigPath = join(dir, "checksums.txt.sig");
const pubPath = join(dir, "release-pubkey.pem");
for (const p of [checksumsPath, sigPath, pubPath])
  if (!existsSync(p)) fail(`missing ${p} — this directory is not a complete signed release copy.`);

const checksums = readFileSync(checksumsPath);
const sig = Buffer.from(readFileSync(sigPath, "utf8").trim(), "base64");
let pub;
try { pub = createPublicKey(readFileSync(pubPath, "utf8")); }
catch { fail("release-pubkey.pem does not parse as a public key."); }
const fingerprint = createHash("sha256").update(pub.export({ type: "spki", format: "der" })).digest("hex");
console.log(`release public key sha256 fingerprint: ${fingerprint}`);
console.log("(compare it with the fingerprint published in docs/SECURITY.md and the repo's public/release-pubkey.pem)");

if (!verify(null, checksums, pub, sig)) fail("SIGNATURE INVALID — checksums.txt was not signed by this release key.");
console.log("✓ checksums.txt signature verifies under the release key.");

let checked = 0;
for (const line of checksums.toString("utf8").split("\n")) {
  const m = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!m) continue;
  const [, want, name] = m;
  const p = join(dir, name);
  if (!existsSync(p)) fail(`checksums.txt lists ${name} but it is missing from ${dir}.`);
  const got = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (got !== want) fail(`${name}: sha256 mismatch (file ${got} ≠ signed ${want}).`);
  checked++;
  console.log(`✓ ${name}  ${want.slice(0, 16)}…`);
}
if (!checked) fail("checksums.txt carried no file entries.");
console.log(`Release verified: signature valid, ${checked} artifact(s) match the signed checksums.`);
