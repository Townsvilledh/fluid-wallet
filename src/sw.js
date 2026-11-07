// Fluid service worker — exists for ONE job today: the Lightning
// wake-up (LSPS5 / bLIP-55 style). When a peer holds a payment for the
// user, the notification relay sends a Web Push; this handler turns it
// into a visible notification (Chrome requires userVisibleOnly: every
// push MUST show one) and deep-links the tap into the Lightning panel,
// where the native node reconnects and settles the held payment.
//
// The push payload is a FIXED, generic text — the relay never sees
// amounts, invoices or keys, and this worker never trusts payload
// content beyond the fixed notification shape.

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
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
