// Hash-checked publish (audit P1, 2026-11-06; single-commit main,
// 2026-11-07).
//
// The wallet is served from gh-pages, but CI (build-check) guards main:
// on every push it runs the tests, rebuilds from source, and FAILS if
// the committed dist/ differs from the fresh build. Landing source and
// dist as two separate main commits therefore always produced a red
// "build-check failed" email for the intermediate state, even though
// the follow-up dist commit turned it green seconds later.
//
// This script is now THE publish path for BOTH branches, and main is
// committed exactly once per publish:
//
//   0. Preflight: on main, HEAD == origin/main, index clean, and
//      names.json untouched in the working tree (registry updates are
//      committed separately, never as part of a release).
//   1. npm test must pass (same suite CI runs — a red suite is never
//      committed).
//   2. Build twice from source; the two bundle hashes must match
//      (byte-reproducibility self-check — the build is esbuild with a
//      lockfile-pinned toolchain and no timestamps, so it must be
//      deterministic; if it ever isn't, publishing stops here).
//   3. dist/names.json must be byte-identical to the repo-root
//      names.json (a publish never alters the name registry).
//   4. Stage source + the freshly built dist/ TOGETHER and land ONE
//      commit on main; push. CI therefore only ever sees a consistent
//      tree. Staging covers tracked changes repo-wide plus new files
//      under the source directories — never names.json, never the
//      cargo lightning/target tree, never research_notes/. Anything
//      else left over aborts the publish before commit.
//   5. The artifacts are copied into a fresh gh-pages worktree and the
//      copied bundle's hash is verified against the fresh build hash
//      BEFORE anything is committed or pushed there.
//   6. Commit + push gh-pages, remove the worktree.
//
// Usage: node scripts/publish.mjs [--dry-run] [--message "subject"]
//   --dry-run runs steps 0–3 and lists what step 4 would stage
//   (no commit, no worktree, no push).
//   --message sets the main commit subject (default: "release: <stamp>").
import { execFileSync } from "node:child_process";
import { readFileSync, copyFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WORKTREE = "/tmp/fluid-gh-pages";
const ARTIFACTS = ["index.html", "app.bundle.js", "recovery.html", "fluid-wallet.html",
  "names.json", "robots.txt", "sitemap.xml", "og-image.png", "_headers", "CNAME",
  "lightning.chunk.js", "fluid_lightning_bg.wasm", "sw.js", "walletconnect.chunk.js",
  "fonts/inter-var.woff2", "fonts/space-grotesk-var.woff2", "favicon.png"];
const SSH = { ...process.env, GIT_SSH_COMMAND: "ssh -F /home/hatch/.ssh/config" };
// Directories whose NEW (untracked) files belong in a release commit.
// Tracked changes are staged repo-wide by `git add -u` regardless.
const SOURCE_DIRS = ["src", "scripts", "test", "docs", "agent", "contracts",
  "tools", "examples", "public", ".github"];
// Working-tree fixtures that are never part of a release: local cargo
// output and research scratch. (Tracked files under lightning/target
// are excluded from staging too — build artifacts, not source.)
const NEVER_STAGE = ["lightning/target/", "research_notes/"];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
let message = null;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--message" || args[i] === "-m") && args[i + 1]) message = args[++i];
  else if (!args[i].startsWith("-") && !message) message = args[i];
}

const run = (cmd, cmdArgs, opts = {}) => execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", ...opts });
const gitOut = (cmdArgs) => execFileSync("git", cmdArgs, { cwd: ROOT, encoding: "utf8" });
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const md5 = (path) => createHash("md5").update(readFileSync(path)).digest("hex");
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

// ---------- 0. Preflight ----------
console.log("▶ preflight: main in sync, index clean, registry untouched");
const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
if (branch !== "main") fail(`on branch '${branch}', not main — refusing to publish.`);
run("git", ["fetch", "origin", "main"], { env: SSH });
const head = gitOut(["rev-parse", "HEAD"]).trim();
const originMain = gitOut(["rev-parse", "origin/main"]).trim();
if (head !== originMain) {
  fail(`local main (${head.slice(0, 10)}) ≠ origin/main (${originMain.slice(0, 10)}). ` +
    "Publish expects all changes UNCOMMITTED in the working tree so it can land them as one commit — resolve the divergence by hand first.");
}
if (gitOut(["diff", "--cached", "--name-only"]).trim()) {
  fail("the git index already has staged changes. Unstage them (git reset) — publish stages the release itself, atomically.");
}
if (gitOut(["status", "--porcelain", "--", "names.json"]).trim()) {
  fail("names.json has uncommitted changes. The name registry is committed separately — a publish never carries it.");
}
console.log("✓ preflight clean");

// ---------- 1. Tests (the same suite CI runs) ----------
console.log("▶ npm test");
try { run("npm", ["test"]); } catch { fail("test suite is red — refusing to commit or publish."); }

// ---------- 2. Reproducible build ----------
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

// ---------- 3. Registry check ----------
const namesRoot = md5(join(ROOT, "names.json"));
const namesDist = md5(join(ROOT, "dist/names.json"));
if (namesRoot !== namesDist) {
  console.error(`✗ dist/names.json (${namesDist}) differs from repo names.json (${namesRoot}). Refusing to publish.`);
  process.exit(1);
}
console.log(`✓ names.json identical (md5 ${namesRoot})`);

// ---------- 4. One commit on main: source + dist together ----------
function stageAll(dry) {
  const n = dry ? ["-n"] : [];
  // Tracked modifications/deletions repo-wide, except the registry and
  // the cargo target tree.
  run("git", ["add", "-u", ...n, "--", ".", ":(exclude)names.json", ":(exclude)lightning/target"]);
  // New files under the source directories, plus lightning sources
  // (target excluded) and the freshly built dist/.
  for (const d of SOURCE_DIRS) run("git", ["add", "-A", ...n, "--", d]);
  run("git", ["add", "-A", ...n, "--", "lightning", ":(exclude)lightning/target"]);
  run("git", ["add", "-A", ...n, "--", "dist"]);
}

if (dryRun) {
  console.log("▶ dry run — files the single main commit would stage:");
  stageAll(true);
  console.log("✓ dry run complete — nothing committed or pushed.");
  process.exit(0);
}

console.log("▶ staging source + dist for the single main commit");
stageAll(false);
// Anything left over is an unexpected state: refuse BEFORE committing.
const leftovers = [];
for (const line of gitOut(["status", "--porcelain"]).split("\n")) {
  if (!line.trim()) continue;
  const xy = line.slice(0, 2);
  const p = line.slice(3).trim();
  if (NEVER_STAGE.some((pre) => p.startsWith(pre))) continue;
  if (xy === "??") leftovers.push(`${p} (untracked, outside the source directories)`);
  else if (xy[1] !== " ") leftovers.push(`${p} (unstaged change)`);
}
if (leftovers.length) {
  run("git", ["reset"]);
  fail(`unexpected working-tree state — nothing committed. Resolve these first:\n  - ${leftovers.join("\n  - ")}`);
}
const stagedFiles = gitOut(["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
let mainCommit = null;
if (!stagedFiles.length) {
  console.log("✓ main already carries this exact source + dist — no commit needed.");
} else {
  const subject = message || `release: ${stamp}`;
  run("git", ["commit", "-m", subject, "-m",
    `Published via scripts/publish.mjs — source and dist in one commit. Bundle stamp ${stamp} (sha256 ${hash2}).`]);
  mainCommit = gitOut(["rev-parse", "HEAD"]).trim();
  run("git", ["push", "origin", "main"], { env: SSH });
  console.log(`✓ main: ONE commit ${mainCommit.slice(0, 10)} pushed (${stagedFiles.length} files, source + dist together)`);
}

// ---------- 5–6. gh-pages: hash-checked copy, commit, push ----------
console.log("▶ preparing gh-pages worktree from origin/gh-pages");
run("git", ["fetch", "origin", "gh-pages"], { env: SSH });
if (existsSync(WORKTREE)) {
  try { run("git", ["worktree", "remove", "--force", WORKTREE]); } catch { rmSync(WORKTREE, { recursive: true, force: true }); }
}
run("git", ["worktree", "add", "--detach", WORKTREE, "origin/gh-pages"]);
try {
  for (const f of ARTIFACTS) { mkdirSync(join(WORKTREE, f, ".."), { recursive: true }); copyFileSync(join(ROOT, "dist", f), join(WORKTREE, f)); }
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
console.log(`Done. Verify: the live page's fluid-build meta and app.bundle.js?v= must read ${stamp}` +
  (mainCommit ? `; main commit ${mainCommit.slice(0, 10)}.` : "."));
