<!-- Single-commit publish verified end-to-end 2026-11-07: this change shipped through the flow it documents. -->

# Publishing Fluid (hash-checked, single-commit)

The wallet is served from the `gh-pages` branch, and CI guards
`main`. Publishing is done **only** through the checked script —
never by hand-copying files, and never by committing by hand first:

```sh
npm run release -- --message "What changed"   # = node scripts/publish.mjs
node scripts/publish.mjs --dry-run            # checks + staging preview, no push
```

**Leave all changes uncommitted in the working tree** and run the
release. The script lands them on `main` as **one single commit**
(source + freshly built `dist/` together), then publishes `gh-pages`.
Because source and dist are atomic, the `build-check` CI (which
rebuilds from source and fails if committed `dist/` differs) only
ever sees a consistent tree — no more red "build-check failed"
emails for the intermediate state that the old two-commit flow
(source commit, then a separate dist commit) produced every time.

What the script guarantees before anything is pushed:

0. **Preflight.** On `main`, `HEAD == origin/main`, nothing already
   staged, and `names.json` untouched in the working tree (registry
   updates are committed separately — a publish never carries them).
   Anything unexpected in the working tree (e.g. untracked files
   outside the source directories) aborts the publish before commit.
   The cargo `lightning/target/` tree and `research_notes/` are
   never staged.
1. **Tests.** `npm test` — the same suite CI runs — must pass.
2. **Byte-reproducible build.** The bundle is built twice from
   source; both SHA-256 hashes must match. The toolchain is
   lockfile-pinned (esbuild) and the build embeds no timestamps, so
   a mismatch means something non-deterministic crept in —
   publishing stops.
3. **Registry untouched.** `dist/names.json` must be byte-identical
   (md5) to the repo-root `names.json`; a publish can never alter
   the Fluid name registry.
4. **Hash-checked copy.** Artifacts are copied into a fresh
   `gh-pages` worktree and the copied bundle's hash is re-verified
   against the fresh build hash before commit/push.

CI (`.github/workflows/build-check.yml`) rebuilds from source on
every push to `main` and fails if the committed `dist/` differs from
the fresh build, so source and served bundle can never silently
drift.

**Verifying a live deploy:** the page's `<meta name="fluid-build">`
stamp and the `app.bundle.js?v=<stamp>` query are the first 10 hex
chars of the bundle's SHA-256. Anyone can hash the served bundle and
compare it with a local `npm run build` of the same commit.
