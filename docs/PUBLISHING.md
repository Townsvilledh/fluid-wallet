# Publishing Fluid (hash-checked)

The wallet is served from the `gh-pages` branch. Publishing is done
**only** through the checked script — never by hand-copying files:

```sh
npm run release          # = node scripts/publish.mjs
node scripts/publish.mjs --dry-run   # build + checks only, no push
```

What the script guarantees before anything is pushed:

1. **Byte-reproducible build.** The bundle is built twice from source;
   both SHA-256 hashes must match. The toolchain is lockfile-pinned
   (esbuild) and the build embeds no timestamps, so a mismatch means
   something non-deterministic crept in — publishing stops.
2. **Registry untouched.** `dist/names.json` must be byte-identical
   (md5) to the repo-root `names.json`; a publish can never alter the
   Fluid name registry.
3. **Hash-checked copy.** Artifacts are copied into a fresh `gh-pages`
   worktree and the copied bundle's hash is re-verified against the
   fresh build hash before commit/push.

CI (`.github/workflows/build-check.yml`) rebuilds from source on every
push to `main` and fails if the committed `dist/` differs from the
fresh build, so source and served bundle can never silently drift.

**Verifying a live deploy:** the page's `<meta name="fluid-build">`
stamp and the `app.bundle.js?v=<stamp>` query are the first 10 hex
chars of the bundle's SHA-256. Anyone can hash the served bundle and
compare it with a local `npm run build` of the same commit.
