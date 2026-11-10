// Resumable, fingerprint-pinned download of the Lightning node's
// WASM program — the piece of Fluid that has to survive a bad phone
// connection (owner directives 2026-11-10 00:43 + 00:47 WAT).
//
// Security model, in order:
//  1. The expected SHA-256 and byte length arrive from the MAIN app
//     bundle (build-time pins in ln-asset-pins.generated.js, passed
//     in by app.js) — never from a file fetched alongside the asset.
//  2. Downloaded bytes are INERT DATA. They sit in chunk storage and
//     are never executed, imported or instantiated. Only a fully
//     assembled buffer that passes BOTH the length check and the
//     pinned SHA-256 check is returned to the caller.
//  3. A stored chunk that no longer matches the hash recorded when
//     it was downloaded is identified by index, discarded and
//     re-fetched — only that chunk. If the assembled file still
//     fails the pinned hash after repair, the download REFUSES.
//
// Persistence model: chunks + a progress manifest live in the
// injected store (IndexedDB in the browser; a Map in tests), keyed
// by the pinned hash — so a new build (new pin) starts a fresh
// download and the old build's chunks are simply never read again.
// A dropped connection, a closed app or a sleeping phone loses
// nothing already stored: the next attempt continues from the last
// completed chunk, never from zero.

export const LN_CHUNK_BYTES = 1024 * 1024; // 1 MiB

export class LnAssetError extends Error {
  constructor(stage, message) {
    super(message);
    this.name = "LnAssetError";
    this.stage = stage; // "download" | "integrity"
  }
}

const subtle = () => {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new LnAssetError("integrity", "This browser has no WebCrypto — the node download can't be verified, so it won't run.");
  return c.subtle;
};

export async function sha256Hex(bytes) {
  const digest = await subtle().digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the pinned asset, resuming from stored chunks.
 * store: { get(key)->Promise<any>, set(key,value)->Promise, del(key)->Promise }
 *   manifest is stored as a JSON string; chunks as Uint8Array.
 * Returns { bytes: ArrayBuffer, fromStore: boolean, resumedBytes: number,
 *           repairedChunks: number[] }.
 * onProgress({ downloadedBytes, totalBytes }) fires after each chunk
 * is DURABLY stored (never before — the number shown is the number kept).
 */
export async function fetchPinnedAsset({
  url, sha256, bytes: totalBytes, store, fetchImpl,
  chunkBytes = LN_CHUNK_BYTES, onProgress = () => {}, sleepImpl = sleep,
}) {
  if (!store) throw new LnAssetError("download", "No chunk storage available.");
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const base = `lnasset:${sha256}`;
  const manifestKey = `${base}:manifest`;
  const chunkKey = (i) => `${base}:chunk:${i}`;
  const nChunks = Math.ceil(totalBytes / chunkBytes);
  const chunkLen = (i) => Math.min(chunkBytes, totalBytes - i * chunkBytes);

  // --- Load + verify stored state. A chunk counts only if its bytes
  // still hash to the value recorded when it was downloaded; anything
  // else (missing, truncated, tampered) is dropped and re-fetched.
  let manifest = null;
  try {
    const raw = await store.get(manifestKey);
    if (raw) manifest = JSON.parse(raw);
  } catch { manifest = null; }
  if (!manifest || manifest.total !== totalBytes || manifest.chunkBytes !== chunkBytes || !Array.isArray(manifest.hashes)) {
    manifest = { total: totalBytes, chunkBytes, hashes: new Array(nChunks).fill(null) };
  }
  const stored = new Array(nChunks).fill(null);
  const repairedChunks = [];
  let storedBytes = 0;
  for (let i = 0; i < nChunks; i++) {
    let chunk = null;
    try { chunk = await store.get(chunkKey(i)); } catch { chunk = null; }
    if (chunk == null) continue;
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    if (u8.length !== chunkLen(i)) { await store.del(chunkKey(i)); manifest.hashes[i] = null; continue; }
    const h = await sha256Hex(u8);
    if (manifest.hashes[i] && h !== manifest.hashes[i]) {
      // Stored bytes changed after download (corruption/tamper):
      // identified by index; only this chunk will be re-fetched.
      repairedChunks.push(i);
      await store.del(chunkKey(i));
      manifest.hashes[i] = null;
      continue;
    }
    manifest.hashes[i] = h;
    stored[i] = u8;
    storedBytes += u8.length;
  }
  const resumedBytes = storedBytes;
  const saveManifest = () => store.set(manifestKey, JSON.stringify(manifest));
  await saveManifest();
  onProgress({ downloadedBytes: storedBytes, totalBytes });

  const storeChunk = async (i, u8) => {
    if (u8.length !== chunkLen(i)) throw new Error(`Chunk ${i} arrived with the wrong size (${u8.length} of ${chunkLen(i)} bytes).`);
    manifest.hashes[i] = await sha256Hex(u8);
    await store.set(chunkKey(i), u8);
    stored[i] = u8;
    storedBytes += u8.length;
    await saveManifest();
    onProgress({ downloadedBytes: storedBytes, totalBytes });
  };

  // --- Fetch whatever is missing, one chunk at a time. A chunk is
  // stored only whole; a drop mid-chunk retries THAT chunk (bounded),
  // never the file.
  const fetchChunk = async (i) => {
    const start = i * chunkBytes;
    const end = start + chunkLen(i) - 1;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await doFetch(url, { headers: { Range: `bytes=${start}-${end}` } });
        if (res.status === 206) {
          const body = new Uint8Array(await res.arrayBuffer());
          // Content-Range, when sent, must agree with the pin's size.
          const cr = res.headers && res.headers.get ? res.headers.get("content-range") : null;
          if (cr) {
            const m = /\/(\d+)\s*$/.exec(cr);
            // A mismatched total is retried like any other drop —
            // the pinned SHA-256 below is the integrity authority,
            // never a header.
            if (m && Number(m[1]) !== totalBytes) throw new Error("The served node program reports a different total size than this app's fingerprint expects.");
          }
          if (body.length !== end - start + 1) throw new Error(`Chunk ${i} arrived short (${body.length} of ${end - start + 1} bytes).`);
          await storeChunk(i, body);
          return;
        }
        if (res.status === 200) {
          // The server ignored Range and sent the whole file: slice
          // it into chunks so everything fetched is still kept.
          const body = new Uint8Array(await res.arrayBuffer());
          if (body.length !== totalBytes) throw new Error("The served node program arrived incomplete (a different size than this app's fingerprint expects).");
          for (let j = 0; j < nChunks; j++) {
            if (!stored[j]) await storeChunk(j, body.subarray(j * chunkBytes, j * chunkBytes + chunkLen(j)));
          }
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        if (e instanceof LnAssetError) throw e;
        lastErr = e;
        if (attempt < 2) await sleepImpl(500 * (attempt + 1));
      }
    }
    throw new LnAssetError("download", `The download stopped at ${(storedBytes / 1048576).toFixed(1)} of ${(totalBytes / 1048576).toFixed(1)} MB — everything fetched so far is kept on your phone and the download continues from there. (${lastErr ? lastErr.message : "network error"})`);
  };
  for (let i = 0; i < nChunks; i++) {
    if (!stored[i]) await fetchChunk(i);
  }

  // --- Assemble + verify. Nothing leaves here unverified.
  const assemble = () => {
    const out = new Uint8Array(totalBytes);
    for (let i = 0; i < nChunks; i++) out.set(stored[i], i * chunkBytes);
    return out;
  };
  let assembled = assemble();
  if (assembled.length !== totalBytes) throw new LnAssetError("integrity", "The assembled node program has the wrong length — refusing to run it.");
  let digest = await sha256Hex(assembled);
  if (digest !== sha256) {
    // Every chunk matched its download-time hash, yet the file fails
    // the pin: a chunk was already wrong when it arrived. Re-fetch
    // chunk by chunk, replacing only chunks whose bytes differ from
    // what is stored; if none differ, the served file simply is not
    // the pinned file — refuse.
    let replaced = false;
    for (let i = 0; i < nChunks; i++) {
      const before = stored[i];
      await store.del(chunkKey(i));
      manifest.hashes[i] = null;
      stored[i] = null;
      storedBytes -= chunkLen(i);
      await fetchChunk(i);
      const after = stored[i];
      if (before && after && (before.length !== after.length || before.some((b, k) => b !== after[k]))) {
        replaced = true;
        if (!repairedChunks.includes(i)) repairedChunks.push(i);
      }
    }
    assembled = assemble();
    digest = await sha256Hex(assembled);
    if (digest !== sha256) {
      throw new LnAssetError("integrity", replaced
        ? "The node program still doesn't match this app's fingerprint after repair — refusing to run it. Nothing was executed."
        : "The served node program doesn't match this app's fingerprint — refusing to run it. Nothing was executed.");
    }
  }
  return { bytes: assembled.buffer, fromStore: resumedBytes === totalBytes, resumedBytes, repairedChunks };
}
