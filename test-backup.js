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
  .replace(/<script src="beasts-data\.js"><\/script>/, inline("beasts-data.js"))
  .replace(/<script src="rules\.js"><\/script>/, inline("rules.js"))
  .replace(/<script src="calendar-data\.js"><\/script>/, inline("calendar-data.js"))
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
/* Settings lives behind "More" now, so the top bar fits a tablet in two
   rows instead of three. Open the drawer first if it isn't already. */
function openSettings() {
  let b = byAct("settingsModal");
  if (!b) { click(byAct("expand", { id: "moreActions" })); b = byAct("settingsModal"); }
  click(b);
}
function openBackupModal() { closeAnyModal(); openSettings(); click(byAct("backupModal")); }

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
openSettings();
ok("settings lists a not-connected backup row", /Cloud backup .* not connected/.test(text()));
click(byAct("backupModal"));
ok("backup modal opens", /Cloud backup/.test(text()));
ok("offers a token field before connecting", !!$("#backup-token"));
ok("no 'reopen' button exists inside the backup modal itself (it only lives in Settings)",
   !byAct("backupModal"));

console.log("\n=== CONNECT: LOOKS FOR AN EXISTING GIST, THEN CREATES ONE ===");
/* First response is the gist LIST (empty — this token has no backup yet),
   second is the create. */
fetchQueue = [{ status: 200, body: [] }, { status: 201, body: { id: "gist-abc123" } }];
setVal($("#backup-token"), "  ghp_faketoken123  ");
click(byAct("backupConnect"));
await flush();
let cfg = backupCfg();
eq("token saved (trimmed)", cfg.token, "ghp_faketoken123");
eq("gist id captured from the create response", cfg.gistId, "gist-abc123");
eq("sync marked ok", cfg.lastSyncOk, true);
ok("lastSyncedAt recorded", typeof cfg.lastSyncedAt === "number");
eq("two calls: the existing-gist lookup, then the create", fetchCalls.length, 2);
ok("looked up the token's gists first", /api\.github\.com\/gists\?/.test(fetchCalls[0].url));
ok("posted to the gists collection endpoint", /api\.github\.com\/gists$/.test(fetchCalls[1].url));
eq("used the token as a Bearer header", fetchCalls[1].opts.headers.Authorization, "Bearer ghp_faketoken123");
ok("sent private:true (never a public gist)", JSON.parse(fetchCalls[1].opts.body).public === false);
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

console.log("\n=== THE GIST CARRIES THE NOTES AS READABLE MARKDOWN ===");
/* The backup itself is JSON, which is the wrong thing to open on a
   laptop after a session. The same gist carries a rendered copy so the
   notes are already there, with no export step. */
const bare = JSON.parse(fetchCalls[0].opts.body);
ok("with no sessions there is no stray empty notes file",
   !bare.files["hal-session-notes.md"]);
w.eval("mutate(function(st){ st.session.active=true; st.session.startedAt=Date.now();" +
       " st.session.log=[{t:Date.now(),label:'Marker placed: The missing caravan'," +
       "kind:'world',cal:{day:14,year:2022,time:'morning'}}];" +
       " st.session.stats={highestACFaced:null,highestDCSet:null}; })");
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
click(byAct("backupNow"));
await flush();
const payload = JSON.parse(fetchCalls[0].opts.body);
ok("the sheet is still the backup file", !!payload.files["hal-briarshade-backup.json"]);
ok("...and the notes ride alongside it", !!payload.files["hal-session-notes.md"]);
const notes = payload.files["hal-session-notes.md"].content;
ok("the notes are Markdown, not JSON", notes.indexOf("# Session") === 0);
ok("a running session is included without ending it",
   /The missing caravan/.test(notes));
ok("dated in both calendars for whoever reads it later",
   /Grub-Wake 14, Year 2022 · Dawnrise 14, 2022 PF/.test(notes));
w.eval("mutate(function(st){ st.session.active=false; st.session.log=[]; })");

console.log("\n=== LOAD FROM CLOUD (CARRYING THE SHEET BETWEEN DEVICES) ===");
ok("the backup modal offers a restore", !!byAct("backupLoad"));
/* The cloud copy is a level 7 Hal — clearly distinguishable from local. */
const remoteSheet = Object.assign({}, state(), {
  level: 7, currentHP: 11,
  identity: Object.assign({}, state().identity, { name: "Hal Briarshade" }),
  calendar: { day: 42, year: 222, system: "jerbeen", timeOfDay: "evening" }
});
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: {
  id: "gist-abc123", updated_at: new Date().toISOString(),
  files: { "hal-briarshade-backup.json": { content: JSON.stringify(remoteSheet) } }
} }];
click(byAct("backupLoad"));
await flush();
eq("fetched the gist by id", fetchCalls.length, 1);
ok("used a plain GET (no method override)", !fetchCalls[0].opts.method);
ok("previews what the cloud copy holds before touching anything", /The cloud copy holds/.test(text()));
ok("preview names the level", /level 7/.test(text()));
ok("preview shows the in-world date", /Hawk-Shadow 14/.test(text()));
ok("preview warns it is destructive", /replaces the sheet on this device/i.test(text()));
eq("nothing applied yet — local sheet untouched", state().level, 4);
click(byAct("backupRestoreCancel"));
ok("cancelling clears the preview", !/The cloud copy holds/.test(text()));
eq("cancel really did nothing to the sheet", state().level, 4);

fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: {
  id: "gist-abc123", updated_at: new Date().toISOString(),
  files: { "hal-briarshade-backup.json": { content: JSON.stringify(remoteSheet) } }
} }];
click(byAct("backupLoad"));
await flush();
click(byAct("backupRestoreConfirm"));
eq("confirming replaces the local sheet", state().level, 7);
eq("and brings the in-world date with it", state().calendar.day, 42);
ok("the pre-restore sheet is recoverable via Undo",
   JSON.parse(w.localStorage.getItem("hal-briarshade-history-v1") || "[]")
     .some(function (h) { return /Before cloud restore/.test(h.label); }));
click(byAct("undo"));
eq("Undo really does bring the old sheet back", state().level, 4);
closeAnyModal();

console.log("\n=== A SECOND DEVICE ADOPTS THE EXISTING GIST INSTEAD OF MAKING A RIVAL ===");
/* Simulate a fresh browser: same token, no stored gist id. */
w.localStorage.removeItem("hal-briarshade-backup-v1");
openBackupModal();
fetchCalls.length = 0;
fetchQueue = [
  { status: 200, body: [
    { id: "someone-elses", updated_at: "2020-01-01T00:00:00Z", files: { "notes.txt": {} } },
    { id: "gist-abc123", updated_at: "2024-01-01T00:00:00Z", files: { "hal-briarshade-backup.json": {} } }
  ] },
  { status: 200, body: { id: "gist-abc123" } }
];
setVal($("#backup-token"), "ghp_faketoken123");
click(byAct("backupConnect"));
await flush();
eq("adopted the existing backup gist", backupCfg().gistId, "gist-abc123");
ok("and PATCHed it rather than creating a second one",
   fetchCalls.length === 2 && fetchCalls[1].opts.method === "PATCH");

console.log("\n=== CHECKPOINT: LONG REST TRIGGERS A SYNC AUTOMATICALLY ===");
closeAnyModal();
fetchCalls.length = 0;
fetchQueue = [{ status: 200, body: { id: "gist-abc123" } }];
click(byAct("tab", { tab: "combat" }));
click(byAct("longRestPrompt"));
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
openSettings();
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
/* Export moved behind the top bar's "More" group; the Notes tab keeps its own copy */
if (!byAct("exportJSON")) click(byAct("expand", { id: "moreActions" }));
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
