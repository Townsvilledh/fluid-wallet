// LNURL step-1 emission planner for the name-claims processor.
//
// Pure: given the parsed names.json registry and the files
// currently sitting in the gh-pages worktree under
// `.well-known/lnurlp/`, decide the writes and deletes that make
// the served step-1 files exactly match the registry's opt-ins.
// The processor applies the plan inside its existing gh-pages
// worktree step (same commit as the names.json sync), so a failed
// sync heals on the next run — the same self-healing shape
// syncGhPagesNames already has.
//
// A name is opted in when its registry entry carries
// `lnBridge: true` — a field only the name's owner can set, via a
// same-owner claim update signed by the EVM key the registry binds
// to the name (verifyNameClaim + nameUpdateMerge carry it). The
// file content is derived from the name alone
// (lnurlPayRequestJson in src/wallet-core.js — the same bytes the
// bridge Worker hashes for description_hash), so emission needs
// no secrets and no network.
import { lnurlPayRequestJson, isLnurlName } from "../../src/wallet-core.js";

export const LNURL_DIR = ".well-known/lnurlp";

export function lnurlPathFor(name) {
  return LNURL_DIR + "/" + name;
}

/** Names whose owners have opted in to the external-payments
 *  bridge, per the registry. Charset-gated: a name that cannot be
 *  an LUD-16 name part never gets a file, whatever the flag says. */
export function lnurlOptedInNames(registry) {
  const out = [];
  for (const [name, entry] of Object.entries(registry || {})) {
    if (entry && entry.lnBridge === true && isLnurlName(name)) out.push(name);
  }
  return out.sort();
}

/**
 * @param {object} registry parsed names.json
 * @param {Map<string,string>} currentFiles path -> content for
 *   every file currently under LNURL_DIR in the worktree
 * @returns {{writes: Map<string,string>, deletes: string[]}}
 */
export function planLnurlEmission(registry, currentFiles) {
  const desired = new Map();
  for (const name of lnurlOptedInNames(registry)) {
    desired.set(lnurlPathFor(name), lnurlPayRequestJson(name));
  }
  const writes = new Map();
  for (const [path, content] of desired) {
    if (!currentFiles.has(path) || currentFiles.get(path) !== content) writes.set(path, content);
  }
  const deletes = [];
  for (const path of currentFiles.keys()) {
    if (!desired.has(path)) deletes.push(path);
  }
  return { writes, deletes: deletes.sort() };
}
