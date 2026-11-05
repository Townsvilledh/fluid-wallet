# Fluid's domain — free route (chosen 2026-11-06: no funds for a paid domain)

## fluid.is-a.dev — AVAILABLE, free forever
Checked 2026-11-06 against the is-a.dev registry repo: no `fluid.json`
exists, so the name is unclaimed. is-a.dev is a free subdomain service
for developers (suffix ".dev", short). Backup option also free:
fluid.js.org (checked free the same day). fluid.eu.org is TAKEN.

### The one step only Ethuram can do (2 minutes, needs his GitHub login)
1. Go to https://register.is-a.dev and sign in with GitHub
   (or fork https://github.com/is-a-dev/register and add `domains/fluid.json`).
2. Register the name **fluid** with this record:
   - Type: `CNAME`
   - Value: `townsvilledh.github.io`
   (JSON form: `{ "owner": { "username": "Townsvilledh", "email": "<his email>" },
   "records": { "CNAME": "townsvilledh.github.io" } }`)
3. Wait for approval/DNS (usually hours to a couple of days).

### Then Muse does the rest (no user action)
- Add a `CNAME` file containing `fluid.is-a.dev` to the gh-pages branch.
- GitHub Pages issues a free HTTPS certificate automatically.
- Result: the wallet lives at **https://fluid.is-a.dev** and the old
  townsvilledh.github.io/fluid-wallet address redirects to it.
- Do NOT add the CNAME file before DNS resolves — Pages would redirect
  the working address to a domain that doesn't answer yet.
