// Fluid service worker — TWO jobs.
//
// (1) The Lightning wake-up (LSPS5 / bLIP-55 style). When a peer
// holds a payment for the user, the notification relay sends a Web
// Push; this handler turns it into a visible notification (Chrome
// requires userVisibleOnly: every push MUST show one) and deep-links
// the tap into the Lightning panel, where the native node reconnects
// and settles the held payment. The push payload is a FIXED, generic
// text — the relay never sees amounts, invoices or keys, and this
// worker never trusts payload content beyond the fixed notification
// shape.
//
// (2) Loading performance (2026-11-16): cache-first serving of the
// app bundle, and NOTHING else. The bundle is the one asset that is
// both huge (megabytes) and stamp-versioned — index.html references
// it as app.bundle.js?v=<build stamp>, and the stamp changes on
// every release — so a repeat load can serve it from Cache Storage
// with zero network bytes, and the wallet opens even on a connection
// too weak to download it. The cache name carries the build stamp
// (the build script substitutes the stamp for the placeholder
// below); on activate, every older stamp's cache is deleted, so a
// new release is always fetched fresh and never served stale.
// HTML, names.json, this worker itself, the lazy chunks, the WASM
// and every API call are NEVER intercepted — network always.
// Kill switch: shipping an sw.js without the fetch handler below
// as an ordinary release restores network-only behaviour.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Fluid — Lightning payment";
  const body = "Payment received — open Fluid to claim it";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: "fluid-lightning-payment",
    data: { url: "/#lightning" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/#lightning";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if ("focus" in client) {
        try { await client.navigate(url); } catch { /* cross-origin or gone */ }
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  // Stamp-versioned caches: drop every bundle cache from an older
  // build, then take control of open pages.
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith("fluid-bundle-") && name !== BUNDLE_CACHE)
    .map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

// The build stamp, substituted by scripts/build.mjs into dist/sw.js
// (the same stamp that versions the bundle URL in index.html).
const FLUID_BUILD_STAMP = "e31bfd507f";
const BUNDLE_CACHE = "fluid-bundle-" + FLUID_BUILD_STAMP;

// Cache-first for the stamped bundle request ONLY: a GET whose path
// ends in /app.bundle.js and that carries the ?v= stamp. Every other
// request returns without respondWith — the network handles it
// exactly as if this worker were not here.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (!url.pathname.endsWith("/app.bundle.js") || !url.searchParams.has("v")) return;
  event.respondWith((async () => {
    const cache = await caches.open(BUNDLE_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  })());
});
