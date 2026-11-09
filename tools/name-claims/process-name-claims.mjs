#!/usr/bin/env node
// Fluid name-claims processor: signed claim → Nostr → names.json.
//
// The app publishes a signed name claim as a Nostr kind-30078 event
// (see buildSignedNameClaim in src/wallet-core.js). This processor
// reads recent claim events from the same public relays and, for
// each claim in created_at order:
//   1. verifies the Nostr event's own Schnorr signature;
//   2. verifies the claim inside it with the app's own rules
//      (verifyNameClaim: name format + every address sanitized +
//      the EIP-191 signature recovering EXACTLY the claimed EVM
//      address — a tampered claim can never verify);
//   3. enforces first-come-first-served: the name must not exist in
//      the published names.json, nor have been won by an earlier
//      valid claim in this or a prior run. An identical re-claim of
//      an already-published entry (same name, same addresses) is an
//      idempotent no-op, never an edit.
// Winners are appended to names.json — the registry is append-only
// in this flow; the processor never edits or removes an entry — and
// the file is committed ALONE (the repo's names-commit pattern) and
// pushed via the working SSH route, after a pull --rebase (hand
// commits may land from elsewhere). New names are capped per run.
// ONE exception to append-only (2026-11-09, native Lightning): a
// SAME-OWNER UPDATE — a verified claim whose EVM equals the
// registered entry's EVM and which does not try to move a
// registered chain address — merges into the published entry (see
// nameUpdateMerge). The claim's EIP-191 signature recovering the
// registered EVM address is the ownership proof, so only the owner
// can ever do this; it exists so a live name can gain or refresh
// its Lightning fields (ln / lnOffer) through the same pipeline
// instead of a hand edit.
// The same names.json is then published to the gh-pages branch:
// the live site (and the registry URL every wallet reads) is served
// from gh-pages, so a main-only names commit never resolves for
// anyone — the old hand pattern paired every names commit with a
// full release for exactly this reason. The sync copies ONLY
// names.json, touches no other artifact, and runs on every run so
// a failed sync heals itself on the next one.
//
// State + a decision log live OUTSIDE the repo, under the Fluid
// goal's hidden_files (override with FLUID_NAME_CLAIMS_STATE_DIR).
// The run refuses to touch git while the working tree has tracked
// changes (a release may be in flight) and reports that as a skip,
// not a failure. Hard failures exit 1; the scheduled job reports
// failures only.
//
// Usage:
//   node tools/name-claims/process-name-claims.mjs [--dry-run]
//   --dry-run: fetch + decide + print, no state writes, no git ops.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { NAME_CLAIM_KIND, NAME_CLAIM_D_PREFIX, NAME_CLAIM_RELAYS, verifyNameClaim, verifyNostrEventSignature, normalizeFluidName } from "../../src/wallet-core.js";
import { queryEvents } from "./relay-client.mjs";

export const MAX_NEW_NAMES_PER_RUN = 10;

const ROOT = new URL("../..", import.meta.url).pathname;
const NAMES_PATH = join(ROOT, "names.json");
const STATE_DIR = process.env.FLUID_NAME_CLAIMS_STATE_DIR
  || join(process.env.HOME || "/home/hatch", "workspace/goals/fluid-universal-wallet-and-ogo-era/hidden_files");
const STATE_PATH = join(STATE_DIR, "name-claims-state.json");
const LOG_PATH = join(STATE_DIR, "name-claims-log.jsonl");
const SSH_ENV = { ...process.env, GIT_SSH_COMMAND: "ssh -F /home/hatch/.ssh/config" };

/** Two registry entries are "the same claim" when every field the
 *  registry carries matches (EVM case-insensitively, the rest
 *  exactly — the same comparison findNameForAddresses documents). */
export function nameEntriesEqual(a, b) {
  if (!a || !b) return false;
  const keys = ["evm", "btc", "ln", "lnOffer", "algo", "sol", "tron", "sui"];
  return keys.every((k) => {
    const x = a[k] || "", y = b[k] || "";
    return k === "evm" || k === "algo" ? String(x).toLowerCase() === String(y).toLowerCase() : x === y;
  });
}

/** Same-owner update test: decideClaims hands this a REGISTERED
 *  entry and a VERIFIED claim's entry. The claim only qualifies as
 *  an update when its EVM is the registered EVM (verifyNameClaim
 *  has already proven the claim's signature recovers exactly that
 *  EVM — the ownership proof) AND it does not try to move a
 *  registered chain address. Returns the merged entry, or null
 *  when this is not a clean same-owner update (a different wallet,
 *  or a conflicting chain-address value). Merge rules: the claim's
 *  fields win where the claim carries them and registered fields
 *  are kept where the claim is silent — so a republish can ADD a
 *  family field the entry predates and can never silently drop
 *  one; ln/lnOffer, the Lightning identity this update path exists
 *  to manage, may also be REPLACED by the owner; every other field
 *  is additions-only. */
export function nameUpdateMerge(existing, entry) {
  if (!existing || !entry) return null;
  if (String(existing.evm || "").toLowerCase() !== String(entry.evm || "").toLowerCase()) return null;
  const keys = ["evm", "btc", "ln", "lnOffer", "algo", "sol", "tron", "sui"];
  const merged = {};
  for (const k of keys) {
    const x = existing[k] || "", y = entry[k] || "";
    if (x && y && x !== y && k !== "evm" && k !== "ln" && k !== "lnOffer") return null; // a chain address changed value — a conflict, not an update
    const v = y || x;
    if (v) merged[k] = v;
  }
  return merged;
}

/** Pure decision pass — the FCFS heart, unit-tested in
 *  process.test.mjs. `events` are raw Nostr events; `registry` is
 *  the parsed names.json; `state` carries { processed, winners }
 *  from prior runs. Returns { decisions, winners, updates } where
 *  winners are [{ name, entry }] in claim order, capped, and
 *  updates are same-owner merges into already-published entries
 *  (never capped — they are not new names). Decisions for events
 *  deferred by the cap are NOT marked processed — they retry next
 *  run. */
/** Per-relay scan summary (audit P0-1): what each relay actually
 *  returned for this run's bulk query, BEFORE the merge. A relay
 *  that silently returns nothing (outage, policy, pruning) is
 *  otherwise indistinguishable from "no claims existed" — and a
 *  claim accepted only by such a relay is exactly the claim that
 *  used to vanish without a trace. Pure; pinned by the suite. */
export function summarizeRelayScan(perRelayResults, relays) {
  const perRelay = {};
  let total = 0;
  relays.forEach((r, i) => {
    const res = perRelayResults[i];
    const n = res && res.status === "fulfilled" && Array.isArray(res.value) ? res.value.length : 0;
    perRelay[r] = res && res.status === "fulfilled" ? n : -1; // -1 = query failed outright
    if (n > 0) total += n;
  });
  return { perRelay, total };
}

export function decideClaims(events, registry, state, cap = MAX_NEW_NAMES_PER_RUN) {
  const processed = (state && state.processed) || {};
  const priorWinners = (state && state.winners) || {};
  const sorted = [...(events || [])]
    .filter((e) => e && typeof e.id === "string" && !processed[e.id])
    .sort((a, b) => (a.created_at - b.created_at) || String(a.id).localeCompare(String(b.id)));
  const decisions = [];
  const winners = [];
  const updates = [];
  const wonThisRun = new Set();
  for (const event of sorted) {
    // Kind 30078 is Nostr's generic app-data kind — other apps'
    // events arrive in the same query. Everything rejected before
    // the d-tag check is foreign noise: still marked processed (so
    // it is never re-verified), but flagged ours=false so the log
    // stays a record of Fluid claim attempts only.
    let ours = false;
    const decide = (decision, name, reason) => decisions.push({ eventId: event.id, name: name || null, decision, reason: reason || "", created_at: event.created_at || 0, ours });
    if (event.kind !== NAME_CLAIM_KIND) { decide("rejected", null, "wrong kind"); continue; }
    if (!verifyNostrEventSignature(event)) { decide("rejected", null, "bad nostr signature"); continue; }
    let claim;
    try { claim = JSON.parse(event.content); } catch { decide("rejected", null, "content is not JSON"); continue; }
    const name = normalizeFluidName(claim && claim.name);
    const dTag = Array.isArray(event.tags) ? event.tags.find((t) => Array.isArray(t) && t[0] === "d") : null;
    if (!dTag || dTag[1] !== NAME_CLAIM_D_PREFIX + name) { decide("rejected", name, "d-tag does not match the claimed name"); continue; }
    ours = true;
    const check = verifyNameClaim(claim);
    if (!check.ok) { decide("rejected", name, check.reason); continue; }
    const existing = registry ? registry[name] : null;
    if (existing) {
      if (nameEntriesEqual(existing, check.entry)) decide("duplicate", name, "identical claim already published — no-op");
      else {
        const merged = nameUpdateMerge(existing, check.entry);
        if (merged) { updates.push({ name, entry: merged, eventId: event.id }); decide("updated", name, "same-owner update — merged into the published entry"); }
        else decide("rejected", name, "name already registered to a different wallet");
      }
      continue;
    }
    if (wonThisRun.has(name) || priorWinners[name]) { decide("rejected", name, "name won by an earlier valid claim"); continue; }
    if (winners.length >= cap) { decisions.push({ eventId: event.id, name, decision: "deferred", reason: `per-run cap of ${cap} reached`, created_at: event.created_at || 0, deferred: true }); continue; }
    wonThisRun.add(name);
    winners.push({ name, entry: check.entry, eventId: event.id });
    decide("winner", name, "");
  }
  return { decisions, winners, updates };
}

function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", env: SSH_ENV, ...opts });
}

const GH_PAGES_WORKTREE = "/tmp/fluid-names-gh-pages";
/** Publish the repo's names.json to the gh-pages branch if the
 *  served copy differs — names.json ONLY, in a throwaway worktree,
 *  mirroring publish.mjs's hash-checked copy scoped to one file. */
function syncGhPagesNames(label) {
  try { git(["worktree", "remove", "--force", GH_PAGES_WORKTREE]); } catch { /* not registered */ }
  rmSync(GH_PAGES_WORKTREE, { recursive: true, force: true });
  try {
    git(["fetch", "origin", "gh-pages"]);
    git(["worktree", "add", "--detach", GH_PAGES_WORKTREE, "origin/gh-pages"]);
    const served = readFileSync(join(GH_PAGES_WORKTREE, "names.json"), "utf8");
    const current = readFileSync(NAMES_PATH, "utf8");
    if (served === current) { console.log("name-claims: gh-pages names.json already current."); return; }
    copyFileSync(NAMES_PATH, join(GH_PAGES_WORKTREE, "names.json"));
    const wt = (args, opts = {}) => execFileSync("git", args, { cwd: GH_PAGES_WORKTREE, encoding: "utf8", env: SSH_ENV, ...opts });
    wt(["add", "names.json"]);
    wt(["commit", "-m", label || "names: sync registry from main"], { stdio: "inherit" });
    wt(["push", "origin", "HEAD:gh-pages"], { stdio: "inherit" });
    console.log("name-claims: gh-pages names.json published.");
  } finally {
    try { git(["worktree", "remove", "--force", GH_PAGES_WORKTREE]); } catch { /* leave for next run's cleanup */ }
    rmSync(GH_PAGES_WORKTREE, { recursive: true, force: true });
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const now = Math.floor(Date.now() / 1000);
  let state = { processed: {}, winners: {}, lastQuerySince: null };
  if (existsSync(STATE_PATH)) {
    try { state = { ...state, ...JSON.parse(readFileSync(STATE_PATH, "utf8")) }; } catch { /* corrupt state must not wedge the run — decisions still enforce registry FCFS */ }
  }

  // Git gate (live runs only): never touch a dirty tree.
  if (!dryRun) {
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]).trim();
    if (dirty) {
      console.log("name-claims: skipped — working tree has tracked changes (a release may be in flight).");
      return;
    }
    git(["fetch", "origin", "main"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const origin = git(["rev-parse", "origin/main"]).trim();
    if (head !== origin) {
      // Behind (hand commits land from elsewhere) or ahead (a prior
      // run's names commit whose push failed): rebase, then make
      // sure the branch is pushed before deciding on stale data.
      git(["pull", "--rebase", "origin", "main"], { stdio: "inherit" });
      git(["push", "origin", "main"], { stdio: "inherit" });
    }
  }

  const since = state.lastQuerySince || now - 14 * 24 * 3600;
  const perRelay = await Promise.allSettled(NAME_CLAIM_RELAYS.map((r) => queryEvents(r, { kinds: [NAME_CLAIM_KIND], since }, 25000)));
  const scan = summarizeRelayScan(perRelay, NAME_CLAIM_RELAYS);
  const byId = new Map();
  for (const res of perRelay) {
    if (res.status !== "fulfilled") continue;
    for (const ev of res.value) if (ev && ev.id && !byId.has(ev.id)) byId.set(ev.id, ev);
  }
  const events = [...byId.values()];

  const registry = JSON.parse(readFileSync(NAMES_PATH, "utf8"));
  const { decisions, winners, updates = [] } = decideClaims(events, registry, state);

  for (const d of decisions) console.log(`name-claims: ${d.decision} ${d.name || "?"} ${d.eventId.slice(0, 12)}… ${d.reason}`.trim());
  console.log(`name-claims: ${events.length} claim event(s) seen, ${winners.length} winner(s), ${updates.length} update(s), ${decisions.filter((d) => d.decision === "rejected").length} rejected.`);
  console.log(`name-claims: relay scan — ${NAME_CLAIM_RELAYS.map((r) => `${r}=${scan.perRelay[r]}`).join(" ")} (pre-merge total ${scan.total}, unique ${events.length}).`);

  if (dryRun) {
    console.log("name-claims: dry run — no state written, no git operations performed.");
    return;
  }

  const commitLabel = [
    winners.length ? `add ${winners.map((w) => w.name).join(", ")}` : "",
    updates.length ? `update ${updates.map((u) => u.name).join(", ")}` : "",
  ].filter(Boolean).join("; ");
  if (winners.length || updates.length) {
    for (const w of winners) registry[w.name] = w.entry;
    for (const u of updates) registry[u.name] = u.entry;
    writeFileSync(NAMES_PATH, JSON.stringify(registry, null, 2) + "\n");
    git(["add", "names.json"]);
    git(["commit", "-m", `names: ${commitLabel} (in-app claim)`], { stdio: "inherit" });
    git(["push", "origin", "main"], { stdio: "inherit" });
    console.log(`name-claims: names.json committed + pushed (${commitLabel}).`);
  }

  // Record FIRST (audit P0-1): decisions, per-relay scan counts and
  // state are written BEFORE the gh-pages sync. The 2026-11-09
  // /tmp-disk incident proved the old order loses the whole run's
  // record when the sync throws — winners already committed to
  // main became invisible in the log, and the app (which reads the
  // registry from gh-pages) kept polling a stale file. A decision
  // record must never depend on a later step succeeding.
  mkdirSync(STATE_DIR, { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify({ type: "scan", at: new Date(now * 1000).toISOString(), perRelay: scan.perRelay, seen: events.length, winners: winners.length, updates: updates.length, rejected: decisions.filter((d) => d.decision === "rejected").length }) + "\n");
  for (const d of decisions) {
    if (d.deferred) continue;
    state.processed[d.eventId] = { decision: d.decision, name: d.name, reason: d.reason, at: now };
    if (d.ours) appendFileSync(LOG_PATH, JSON.stringify({ at: new Date(now * 1000).toISOString(), ...d }) + "\n");
  }
  // Prune processed records older than the query window — they can
  // never be fetched again, and the map must not grow without bound
  // on other apps' kind-30078 traffic.
  const cutoff = now - 14 * 24 * 3600;
  for (const [id, rec] of Object.entries(state.processed)) if (!rec.at || rec.at < cutoff) delete state.processed[id];
  for (const w of winners) state.winners[w.name] = w.eventId;
  state.lastQuerySince = now - 3600; // 1h overlap; the processed set dedupes
  state.lastRunAt = now;
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");

  // The live registry is served from gh-pages — sync the file there
  // on EVERY run (not only winner runs) so a failed sync heals. A
  // sync failure still fails the run (exit 1, reported by the cron)
  // — but the record above is already durable when it does.
  try {
    syncGhPagesNames((winners.length || updates.length) ? `names: ${commitLabel} (in-app claim)` : undefined);
  } catch (e) {
    console.error("name-claims: gh-pages sync FAILED (decisions + state already recorded) —", e.message || e);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("name-claims: FAILED —", e.message || e); process.exit(1); });
}
