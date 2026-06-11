/**
 * A small service worker — enough to make the app installable (so it can launch
 * from the home screen with no address bar) and to let it open offline.
 *
 * Strategy: stale-while-revalidate. We serve from cache instantly when we have
 * it, then refresh the cache in the background. Vite fingerprints its asset
 * filenames, so a new build brings new URLs and the old ones simply fall away.
 * Navigations fall back to the cached app shell when the network is gone.
 */
const CACHE = "prayer-cache-v1";

self.addEventListener("install", (event) => {
  // Take over as soon as we're ready rather than waiting for every tab to close.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add("./")));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      const fresh = cached || (await network);
      if (fresh) return fresh;

      // Offline navigation with nothing cached for this URL: serve the shell.
      if (req.mode === "navigate") {
        const shell = await cache.match("./");
        if (shell) return shell;
      }
      return new Response("", { status: 504, statusText: "Offline" });
    })(),
  );
});
