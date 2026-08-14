/* ============================================================
   SERVICE WORKER — offline shell
   Bump CACHE_VERSION whenever you upload changed files, or Safari
   will keep serving the old ones from cache.
   ============================================================ */
const CACHE_VERSION = "hal-v22";
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

/* ------------------------------------------------------------
   Two strategies, split by what the file is.

   The code — the page and the scripts — is fetched from the network
   first, so an update lands the moment you open the app with signal
   instead of the launch after. The network gets NET_TIMEOUT_MS to
   answer; past that we stop waiting and serve the cached copy, so a bad
   connection at the table costs a beat, not the session. The slow fetch
   is left running, and whatever it brings back still updates the cache
   for next time.

   Everything else — the portraits and icons, which are most of the
   bytes and never change — stays cache-first with a quiet background
   refresh. There's no reason to re-download a 340 KB portrait to find
   out it's the same portrait.
   ------------------------------------------------------------ */
const NET_TIMEOUT_MS = 2500;
const IS_CODE = /\.(?:html|js|json)(?:$|\?)|\/$/;

function putInCache(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
  }
  return res;
}

/* Resolves with the network response, or rejects once the clock runs
   out. The request itself is never cancelled — it still refreshes the
   cache if it lands late. */
function networkWithTimeout(req) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = setTimeout(function () {
      settled = true;
      reject(new Error("network timeout"));
    }, NET_TIMEOUT_MS);
    fetch(req).then(function (res) {
      putInCache(req, res);
      if (!settled) { clearTimeout(timer); resolve(res); }
    }).catch(function (err) {
      if (!settled) { clearTimeout(timer); reject(err); }
    });
  });
}

function fromCache(req) {
  return caches.match(req).then(function (hit) {
    /* A navigation can carry a query string the cache has never seen,
       so fall back to the shell rather than to nothing. */
    return hit || caches.match("./index.html");
  });
}

/* Same-origin GETs only — never intercept the wiki links. */
self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (IS_CODE.test(new URL(req.url).pathname + new URL(req.url).search) ||
      req.mode === "navigate") {
    /* With no network at all, don't spend the timeout finding that out —
       open straight from the cache. navigator.onLine lies the other way
       (claims online on a dead connection), which is what the timeout
       below is for. */
    if (self.navigator && self.navigator.onLine === false) {
      e.respondWith(fromCache(req));
      return;
    }
    e.respondWith(networkWithTimeout(req).catch(function () { return fromCache(req); }));
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) { putInCache(req, res); }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) { return putInCache(req, res); })
        .catch(function () { return caches.match("./index.html"); });
    })
  );
});

/* So the app can show which build it is actually running — the whole
   point of the exercise being to know your update landed. */
self.addEventListener("message", function (e) {
  if (e.data === "version" && e.ports && e.ports[0]) {
    e.ports[0].postMessage(CACHE_VERSION);
  }
});
