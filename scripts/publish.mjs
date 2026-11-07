// Hash-checked publish (audit P1, 2026-11-06).
//
// The old flow was: build by hand, copy dist/ into a gh-pages worktree,
// push — with nothing proving the served bundle corresponds to the
// source. This script is now THE publish path:
//
//   1. Build twice from source; the two bundle hashes must match
//      (byte-reproducibility self-check — the build is esbuild with a
//      lockfile-pinned toolchain and no timestamps, so it must be
//      deterministic; if it ever isn't, publishing stops here).
//   2. dist/names.json must be byte-identical to the repo-root
//      names.json (a publish never alters the name registry).
//   3. The artifacts are copied into a fresh gh-pages worktree and the
//      copied bundle's hash is verified against the fresh build hash
//      BEFORE anything is committed or pushed.
//   4. Commit + push gh-pages, remove the worktree.
//
// Usage: node scripts/publish.mjs [--dry-run]
//   --dry-run runs steps 1–2 only (no worktree, no push).
import { execFileSync } from "node:child_process";
import { readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WORKTREE = "/tmp/fluid-gh-pages";
const ARTIFACTS = ["index.html", "app.bundle.js", "recovery.html", "fluid-wallet.html",
  "names.json", "robots.txt", "sitemap.xml", "og-image.png",
  "lightning.chunk.js", "fluid_lightning_bg.wasm", "sw.js"];
const SSH = { ...process.env, GIT_SSH_COMMAND: "ssh -F /home/hatch/.ssh/config" };
const dryRun = process.argv.includes("--dry-run");

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const md5 = (path) => createHash("md5").update(readFileSync(path)).digest("hex");

function buildAndHash() {
  run("node", ["scripts/build.mjs"]);
  return sha256(join(ROOT, "dist/app.bundle.js"));
}

console.log("▶ build 1/2");
const hash1 = buildAndHash();
console.log("▶ build 2/2 (reproducibility check)");
const hash2 = buildAndHash();
if (hash1 !== hash2) {
  console.error(`✗ BUILD IS NOT BYTE-REPRODUCIBLE: ${hash1} ≠ ${hash2}. Refusing to publish.`);
  process.exit(1);
}
const stamp = hash2.slice(0, 10);
console.log(`✓ reproducible build, bundle sha256 ${hash2} (stamp ${stamp})`);

const namesRoot = md5(join(ROOT, "names.json"));
const namesDist = md5(join(ROOT, "dist/names.json"));
if (namesRoot !== namesDist) {
  console.error(`✗ dist/names.json (${namesDist}) differs from repo names.json (${namesRoot}). Refusing to publish.`);
  process.exit(1);
}
console.log(`✓ names.json identical (md5 ${namesRoot})`);

if (dryRun) {
  console.log("✓ dry run complete — nothing pushed.");
  process.exit(0);
}

console.log("▶ preparing gh-pages worktree from origin/gh-pages");
run("git", ["fetch", "origin", "gh-pages"], { env: SSH });
if (existsSync(WORKTREE)) {
  try { run("git", ["worktree", "remove", "--force", WORKTREE]); } catch { rmSync(WORKTREE, { recursive: true, force: true }); }
}
run("git", ["worktree", "add", "--detach", WORKTREE, "origin/gh-pages"]);
try {
  for (const f of ARTIFACTS) copyFileSync(join(ROOT, "dist", f), join(WORKTREE, f));
  const copied = sha256(join(WORKTREE, "app.bundle.js"));
  if (copied !== hash2) {
    console.error(`✗ copied bundle hash ${copied} ≠ fresh build ${hash2}. Aborting before commit.`);
    process.exit(1);
  }
  console.log("✓ copied bundle hash matches the fresh build");
  run("git", ["-C", WORKTREE, "add", "-A"]);
  const status = execFileSync("git", ["-C", WORKTREE, "status", "--porcelain"], { encoding: "utf8" });
  if (!status.trim()) {
    console.log("✓ gh-pages already carries this exact build — nothing to commit.");
  } else {
    run("git", ["-C", WORKTREE, "commit", "-m", `publish ${stamp} (hash-checked)`]);
    run("git", ["-C", WORKTREE, "push", "origin", "HEAD:gh-pages"], { env: SSH });
    console.log(`✓ published stamp ${stamp} to gh-pages`);
  }
} finally {
  try { run("git", ["worktree", "remove", "--force", WORKTREE]); } catch { /* leave it; harmless */ }
}
console.log(`Done. Verify: the live page's fluid-build meta and app.bundle.js?v= must read ${stamp}.`);
