/* ============================================================
   SERVICE WORKER — offline shell
   Bump CACHE_VERSION whenever you upload changed files, or Safari
   will keep serving the old ones from cache.
   ============================================================ */
const CACHE_VERSION = "hal-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./beasts-data.js",
  "./rules.js",
  "./calendar-data.js",
  "./combat-rules.js",
  "./app.js",
  "./combat.js",
  "./backup.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./portrait-100.png",
  "./portrait-75.png",
  "./portrait-50.png",
  "./portrait-25.png",
  "./portrait-down.png",
  "./portrait-gone.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) {
      /* addAll fails the whole install if any single file 404s,
         so add individually and tolerate misses. */
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function (err) { console.warn("Precache miss:", u, err); });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE_VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Cache-first: the sheet must open with no network at the table.
   Same-origin GETs only — never intercept the wiki links. */
self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        /* Refresh in the background so a redeploy lands next launch */
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE_VERSION).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html");
      });
    })
  );
});
