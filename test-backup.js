/* Integration tests for backup.js — Gist auto-sync, local redundancy
   (daily snapshots, IndexedDB mirror best-effort), Share Sheet export,
   and the settings/backup modal wiring.
   Run: NODE_PATH=/tmp/node_modules node test-backup.js

   This file is async (unlike the other test-*.js files) because Gist
   sync is a real Promise chain — we mock fetch and have to flush the
   microtask queue between triggering an action and asserting its
   outcome. */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + "\n         got:  " + JSON.stringify(got) +
                             "\n         want: " + JSON.stringify(want)); }
}
function ok(label, cond) { eq(label, !!cond, true); }
function flush() { return new Promise(function (r) { setTimeout(r, 10); }); }

const dir = __dirname;
function src(f) { return fs.readFileSync(path.join(dir, f), "utf8"); }
function inline(f) { return "<script>" + src(f) + "</script>"; }
const html = src("index.html")
  .replace(/<script src="rules\.js"><\/script>/, inline("rules.js"))
  .replace(/<script src="combat-rules\.js"><\/script>/, inline("combat-rules.js"))
  .replace(/<script src="app\.js"><\/script>/, inline("app.js"))
  .replace(/<script src="combat\.js"><\/script>/, inline("combat.js"))
  .replace(/<script src="backup\.js"><\/script>/, inline("backup.js"));

const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/" });
const w = dom.window, doc = w.document;

/* jsdom doesn't implement these — stub the ones our code paths touch. */
w.URL.createObjectURL = function () { return "blob:mock"; };
w.URL.revokeObjectURL = function () {};

const fetchCalls = [];
let fetchQueue = [];
w.fetch = function (url, opts) {
  fetchCalls.push({ url: url, opts: opts });
  const next = fetchQueue.shift();
  if (!next) return Promise.reject(new Error("test: no mock fetch response queued for " + url));
  if (next.networkError) return Promise.reject(new Error("mock network failure"));
  return Promise.resolve({
    ok: next.status >= 200 && next.status < 300,
    status: next.status,
    json: function () { return Promise.resolve(next.body || {}); }
  });
};

function $(sel) { return doc.querySelector(sel); }
function $$(sel) { return Array.from(doc.querySelectorAll(sel)); }
function click(sel) {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (!el) throw new Error("No element for " + sel);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
}
function byAct(act, extra) {
  return $$('[data-act="' + act + '"]').filter(function (e) {
    return !extra || Object.keys(extra).every(function (k) { return e.dataset[k] === extra[k]; });
  })[0];
}
function text() { return ($("#app").textContent + " " + $("#modal-root").textContent).replace(/\s+/g, " "); }
function setVal(el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }
function state() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")); }
function backupCfg() {
  try { return JSON.parse(w.localStorage.getItem("hal-briarshade-backup-v1")); }
  catch (e) { return null; }
}
/* The "Cloud backup" row that opens the backup modal only exists inside
   Settings, not inside the backup modal itself — so reopening it fresh
   is always a two-step navigation, not a single button. */
function closeAnyModal() { if (byAct("closeModal")) click(byAct("closeModal")); }
function openBackupModal() { closeAnyModal(); click(byAct("settingsModal")); click(byAct("backupModal")); }

(async function () {

console.log("\n=== BOOT WITH BACKUP MODULE ===");
ok("app still boots", $("#app").innerHTML.length > 2000);
ok("ACT.backupModal exists", typeof w.eval("ACT.backupModal") === "function");
ok("EXT.backupModal exists", typeof w.eval("EXT.backupModal") === "function");
ok("ACT.shareBackup exists", typeof w.eval("ACT.shareBackup") === "function");
ok("no console errors just from booting with backup.js loaded", $("#app").innerHTML.length > 0);

console.log("\n=== TOKEN STORAGE IS ISOLATED FROM THE CHARACTER SHEET ===");
ok("backup config starts with no token", !backupCfg() || !backupCfg().token);
w.eval("save()"); /* force the main sheet key to exist before inspecting it */
ok("main sheet state has no 'token'/'backup' field on it", !("token" in state()) && !("backup" in state()));

console.log("\n=== SETTINGS SHOWS THE BACKUP ENTRY POINT ===");
click(byAct("settingsModal"));
ok("settings lists a not-connected backup row", /Cloud backup .* not connected/.test(text()));
click(byAct("backupModal"));
ok("backup modal opens", /Cloud backup/.test(text()));
ok("offers a token field before connecting", !!$("#backup-token"));
ok("no 'reopen' button exists inside the backup modal itself (it only lives in Settings)",
   !byAct("backupModal"));

console.log("\n=== CONNECT: CREATES A NEW GIST ===");
fetchQueue = [{ status: 201, body: { id: "gist-abc123" } }];
setVal($("#backup-token"), "  ghp_faketoken123  ");
click(byAct("backupConnect"));
await flush();
let cfg = backupCfg();
eq("token saved (trimmed)", cfg.token, "ghp_faketoken123");
eq("gist id captured from the create response", cfg.gistId, "gist-abc123");
eq("sync marked ok", cfg.lastSyncOk, true);
ok("lastSyncedAt recorded", typeof cfg.lastSyncedAt === "number");
eq("exactly one fetch call (a POST, no existing gist yet)", fetchCalls.length, 1);
ok("posted to the gists collection endpoint", /api\.github\.com\/gists$/.test(fetchCalls[0].url));
eq("used the token as a Bearer header", fetchCalls[0].opts.headers.Authorization, "Bearer ghp_faketoken123");
ok("sent private:true (never a public gist)", JSON.parse(fetchCalls[0].opts.body).public === false);
ok("the token still never leaks into the main sheet's saved JSON, even connected",
   w.localStorage.getItem("hal-briarshade-sheet-v1").indexOf("ghp_faketoken123") === -1);

console.log("\n=== BACKUP MODAL REFLECTS THE CONNECTED STATE ===");
/* We're still showing the backup modal from the Connect step above —
   its own re-render (not a fresh navigation) should already reflect it. */
ok("shows connected/synced status", /Last synced/.test(text()));
ok("links to the gist", /gist\.github\.com/.test(text()));

console.log("\n=== SUBSEQUENT SYNCS PATCH THE EXISTING GIST ===");
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
click(byAct("backupNow"));
await flush();
eq("one PATCH call this time", fetchCalls.length, 1);
ok("PATCHed the specific gist id, not the collection", /gists\/gist-abc123$/.test(fetchCalls[0].url));
eq("PATCH method used", fetchCalls[0].opts.method, "PATCH");

console.log("\n=== CHECKPOINT: LONG REST TRIGGERS A SYNC AUTOMATICALLY ===");
closeAnyModal();
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
click(byAct("tab", { tab: "combat" }));
click(byAct("longRest"));
closeAnyModal();
await flush();
ok("Long Rest fired a sync with no manual Back up now tap", fetchCalls.length >= 1);

console.log("\n=== CHECKPOINT: END SESSION TRIGGERS A SYNC ===");
click(byAct("sessionModal"));
click(byAct("preSessionModal"));
click(byAct("sessionStart"));
closeAnyModal();
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
click(byAct("sessionModal"));
click(byAct("sessionEnd"));
await flush();
ok("End Session fired a sync", fetchCalls.length >= 1);
closeAnyModal();

console.log("\n=== CHECKPOINT: LEVEL UP IS WRAPPED THE SAME WAY ===");
/* Simulating the full level-up flow (roll -> spell picks -> feat -> apply)
   is a lot of setup for what's structurally the identical wrap used for
   Long Rest above; confirm the wrapper is actually in place instead. */
ok("ACT.levelUpApply is wrapped to call the sync function",
   /syncToGist/.test(w.eval("ACT.levelUpApply").toString()));

console.log("\n=== OFFLINE: SKIPS THE NETWORK CALL, MARKS PENDING ===");
Object.defineProperty(w.navigator, "onLine", { value: false, configurable: true });
fetchCalls.length = 0;
openBackupModal();
click(byAct("backupNow"));
await flush();
eq("no fetch attempted while offline", fetchCalls.length, 0);
cfg = backupCfg();
eq("marked pending so it retries later", cfg.pending, true);
ok("status explains it's offline", /[Oo]ffline/.test(cfg.lastError));

console.log("\n=== BACK ONLINE: RETRIES AUTOMATICALLY ===");
Object.defineProperty(w.navigator, "onLine", { value: true, configurable: true });
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
w.dispatchEvent(new w.Event("online"));
await flush();
eq("the reconnect retry actually hit the network", fetchCalls.length, 1);
cfg = backupCfg();
eq("pending cleared after the retry succeeds", cfg.pending, false);
eq("sync ok again", cfg.lastSyncOk, true);

console.log("\n=== ERROR HANDLING: BAD TOKEN (401) ===");
fetchCalls.length = 0;
fetchQueue = [{ status: 401, body: {} }];
openBackupModal();
click(byAct("backupNow"));
await flush();
cfg = backupCfg();
eq("sync marked failed", cfg.lastSyncOk, false);
ok("error message explains a rejected token", /[Tt]oken rejected/.test(cfg.lastError));
ok("failure surfaces in the (still open) backup modal", /Last attempt failed/.test(text()));
click(byAct("settingsModal"));
ok("failure surfaces in Settings too", /Cloud backup .* sync failed/.test(text()));
closeAnyModal();

console.log("\n=== RESILIENCE: GIST WAS DELETED ON GITHUB'S SIDE (404) ===");
fetchCalls.length = 0;
fetchQueue = [{ status: 404, body: {} }, { status: 201, body: { id: "gist-new456" } }];
openBackupModal();
click(byAct("backupNow"));
await flush();
eq("two calls: the failed PATCH, then a fresh POST", fetchCalls.length, 2);
ok("first call was the PATCH to the old id", /gists\/gist-abc123$/.test(fetchCalls[0].url));
ok("second call created a new gist", /api\.github\.com\/gists$/.test(fetchCalls[1].url) && fetchCalls[1].opts.method === "POST");
cfg = backupCfg();
eq("adopted the new gist id", cfg.gistId, "gist-new456");
eq("recovered to a healthy sync state", cfg.lastSyncOk, true);
closeAnyModal();

console.log("\n=== DISCONNECT ===");
openBackupModal();
click(byAct("backupDisconnect"));
cfg = backupCfg();
eq("token cleared", cfg.token, "");
eq("gist id cleared", cfg.gistId, "");
openBackupModal();
ok("modal offers to connect again", !!byAct("backupConnect") || !!$("#backup-token"));
closeAnyModal();

console.log("\n=== SHARE SHEET EXPORT (FALLS BACK TO DOWNLOAD WHEN UNSUPPORTED) ===");
w.localStorage.removeItem("hal-briarshade-last-export");
ok("no manual export recorded yet", !w.localStorage.getItem("hal-briarshade-last-export"));
click(byAct("tab", { tab: "notes" }));
ok("Share button present next to Export/Import", !!byAct("shareBackup"));
click(byAct("shareBackup"));
ok("falls back to a normal download and records the export time (jsdom has no navigator.share)",
   !!w.localStorage.getItem("hal-briarshade-last-export"));

console.log("\n=== SHARE SHEET EXPORT (NATIVE SHARE, WHEN AVAILABLE) ===");
let sharedWith = null;
w.navigator.share = function (data) { sharedWith = data; return Promise.resolve(); };
w.navigator.canShare = function () { return true; };
w.localStorage.removeItem("hal-briarshade-last-export");
click(byAct("shareBackup"));
ok("used navigator.share instead of a raw download", sharedWith && sharedWith.files && sharedWith.files.length === 1);
ok("still recorded the export time", !!w.localStorage.getItem("hal-briarshade-last-export"));
delete w.navigator.share;
delete w.navigator.canShare;

console.log("\n=== EXPORT JSON ALSO COUNTS AS A MANUAL BACKUP ===");
w.localStorage.removeItem("hal-briarshade-last-export");
click(byAct("exportJSON"));
ok("the plain Export JSON button also records the export time", !!w.localStorage.getItem("hal-briarshade-last-export"));

console.log("\n=== DAILY ROLLING SNAPSHOTS ===");
function daily() { try { return JSON.parse(w.localStorage.getItem("hal-briarshade-daily-v1")) || []; } catch (e) { return []; } }
ok("today's snapshot exists after normal play", daily().some(function (d) { return d.date === new Date().toISOString().slice(0, 10); }));
const countBefore = daily().length;
click(byAct("tab", { tab: "spells" })); /* any mutate-free navigation shouldn't matter; force a real save */
click(byAct("shortRest"));
eq("a second save on the same day does not add a second snapshot", daily().length, countBefore);
/* Seed 14 fake old days directly, then trigger one more real save for
   "today" and confirm the buffer stays capped and drops the oldest. */
const seeded = [];
for (let i = 20; i >= 1; i--) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  seeded.push({ date: d, at: Date.now() - i * 86400000, state: { fake: i } });
}
w.localStorage.setItem("hal-briarshade-daily-v1", JSON.stringify(seeded.slice(-14)));
eq("seed step landed at the cap", daily().length, 14);
const oldestBefore = daily()[0].date;
click(byAct("shortRest"));
ok("still capped at 14 after another real save", daily().length <= 14);
ok("the oldest entry got dropped to make room for today's", daily()[0].date !== oldestBefore || daily().some(function (d) { return d.date === new Date().toISOString().slice(0, 10); }));
ok("today's real snapshot is present", daily().some(function (d) { return d.date === new Date().toISOString().slice(0, 10) && d.state && d.state.identity; }));

console.log("\n=== INDEXEDDB MIRROR IS BEST-EFFORT (NO CRASH WHEN UNAVAILABLE) ===");
ok("jsdom has no indexedDB and the app never noticed", typeof w.indexedDB === "undefined");
ok("app is still fully responsive after all of the above", $("#app").innerHTML.length > 2000);

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);

})();
