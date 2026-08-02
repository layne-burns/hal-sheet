/* ============================================================
   BACKUP & SYNC — local redundancy plus optional GitHub Gist cloud
   backup. Loaded LAST, after combat.js. Extends ACT/EXT and wraps
   save() / render() / a couple of ACT methods the same way earlier
   files wrap the layer beneath them.

   Storage boundaries, deliberately kept separate from the character
   sheet itself:
     - hal-briarshade-backup-v1   Token, gist id, sync status. NEVER
                                   part of S, so it can never end up
                                   in Export JSON or a shared file.
     - hal-briarshade-daily-v1    One rolling snapshot per calendar
                                   day, capped, so a bad state doesn't
                                   silently overwrite days of history
                                   unnoticed — the 20-entry undo stack
                                   is per-action and fills up fast.
     - IndexedDB "hal-briarshade-db"   A second, independent mirror of
                                   the same save, updated every save().
                                   Best-effort only; never read back by
                                   the app, just there to recover from
                                   manually if localStorage alone fails.
   ============================================================ */

const BACKUP_KEY = "hal-briarshade-backup-v1";
const DAILY_KEY = "hal-briarshade-daily-v1";
const DAILY_MAX = 14;
const LAST_EXPORT_KEY = "hal-briarshade-last-export";
const GIST_FILENAME = "hal-briarshade-backup.json";

/* ---------- BACKUP CONFIG (token / gist id / status) ----------- */
function backupDefaults() {
  return { token: "", gistId: "", lastSyncedAt: null, lastSyncOk: null, lastError: "", pending: false };
}
function loadBackupCfg() {
  try { return Object.assign(backupDefaults(), JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}")); }
  catch (e) { return backupDefaults(); }
}
function saveBackupCfg(cfg) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(cfg)); }
  catch (e) { /* quota — this blob is tiny, shouldn't happen */ }
}

/* ---------- DAILY ROLLING SNAPSHOTS ----------------------------- */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function loadDaily() {
  try { return JSON.parse(localStorage.getItem(DAILY_KEY)) || []; }
  catch (e) { return []; }
}
function maybeSnapshotDaily() {
  try {
    const daily = loadDaily();
    const today = todayStr();
    if (daily.length && daily[daily.length - 1].date === today) return;
    daily.push({ date: today, at: Date.now(), state: JSON.parse(JSON.stringify(S)) });
    while (daily.length > DAILY_MAX) daily.shift();
    localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  } catch (e) { /* never let a snapshot failure block a real save */ }
}

/* ---------- INDEXEDDB MIRROR ------------------------------------ */
let _idbPromise = null;
function openBackupDB() {
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve(null);
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise(function (resolve) {
    try {
      const req = indexedDB.open("hal-briarshade-db", 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains("snapshot")) req.result.createObjectStore("snapshot");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) { resolve(null); }
  });
  return _idbPromise;
}
function mirrorToIndexedDB() {
  openBackupDB().then(function (db) {
    if (!db) return;
    try {
      const tx = db.transaction("snapshot", "readwrite");
      tx.objectStore("snapshot").put({ at: Date.now(), state: S }, "current");
    } catch (e) { /* best-effort */ }
  });
}

/* ---------- WRAP save() TO FEED BOTH LOCAL LAYERS --------------- */
const _save = save;
save = function () {
  _save();
  mirrorToIndexedDB();
  maybeSnapshotDaily();
};

/* ---------- GITHUB GIST SYNC ------------------------------------ */
let _syncing = false;
function syncToGist() {
  const cfg = loadBackupCfg();
  if (!cfg.token) return Promise.resolve();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    cfg.pending = true; cfg.lastError = "Offline — will retry when back online.";
    saveBackupCfg(cfg);
    if (UI.modal && UI.modal.type === "backup") render();
    return Promise.resolve();
  }
  if (_syncing) return Promise.resolve();
  _syncing = true;
  const payload = {
    description: "Hal Briarshade — auto-backup (" + (S.identity.name || "character") + ")",
    public: false,
    files: {}
  };
  payload.files[GIST_FILENAME] = { content: JSON.stringify(S, null, 2) };
  const headers = {
    "Authorization": "Bearer " + cfg.token,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  };
  function fail(msg) {
    cfg.lastSyncOk = false; cfg.lastError = msg; cfg.pending = true;
    saveBackupCfg(cfg);
  }
  function succeed(body) {
    if (body && body.id) cfg.gistId = body.id;
    cfg.lastSyncedAt = Date.now();
    cfg.lastSyncOk = true; cfg.lastError = ""; cfg.pending = false;
    saveBackupCfg(cfg);
  }
  function statusMessage(status) {
    if (status === 401) return "Token rejected — it may be revoked or mistyped.";
    if (status === 403) return "Forbidden — check the token has the 'gist' scope.";
    return "GitHub returned " + status + ".";
  }
  const createNew = function () {
    return fetch("https://api.github.com/gists", {
      method: "POST", headers: headers, body: JSON.stringify(payload)
    });
  };
  const attempt = cfg.gistId
    ? fetch("https://api.github.com/gists/" + cfg.gistId, {
        method: "PATCH", headers: headers, body: JSON.stringify({ files: payload.files })
      }).then(function (res) {
        /* The gist may have been deleted on GitHub's side since we last
           synced — fall back to creating a fresh one instead of just
           failing forever. */
        if (res.status === 404) { cfg.gistId = ""; return createNew(); }
        return res;
      })
    : createNew();
  return attempt
    .then(function (res) {
      if (!res.ok) { fail(statusMessage(res.status)); return null; }
      return res.json();
    })
    .then(function (body) { if (body) succeed(body); })
    .catch(function () { fail("Network error — will retry."); })
    .then(function () {
      _syncing = false;
      if (UI.modal && UI.modal.type === "backup") render();
    });
}

/* Retry automatically once connectivity returns, if a sync is owed. */
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("online", function () {
    const cfg = loadBackupCfg();
    if (cfg.token && cfg.pending) syncToGist();
  });
}

/* ---------- CHECKPOINT TRIGGERS ----------------------------------
   Wrap the existing actions rather than touch their logic. Firing
   the sync is fire-and-forget — it must never delay or block what
   the player is doing at the table. */
["longRest", "levelUpApply"].forEach(function (name) {
  const orig = ACT[name];
  if (typeof orig !== "function") return;
  ACT[name] = function () {
    const r = orig.apply(ACT, arguments);
    syncToGist();
    return r;
  };
});
if (typeof ACT.sessionEnd === "function") {
  const _sessionEnd = ACT.sessionEnd;
  ACT.sessionEnd = function () {
    const r = _sessionEnd.apply(ACT, arguments);
    syncToGist();
    return r;
  };
}
/* Also record every real Export JSON as a manual backup point, whichever
   button triggered it. */
if (typeof ACT.exportJSON === "function") {
  const _exportJSON = ACT.exportJSON;
  ACT.exportJSON = function () {
    try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())); } catch (e) {}
    return _exportJSON.apply(ACT, arguments);
  };
}

/* ---------- BACKUP MODAL ----------------------------------------- */
function timeAgo(t) {
  if (!t) return "never";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
  const d = Math.floor(h / 24);
  return d + " day" + (d === 1 ? "" : "s") + " ago";
}
EXT.backupModal = function () {
  const cfg = loadBackupCfg();
  const lastExport = parseInt(localStorage.getItem(LAST_EXPORT_KEY), 10) || null;
  let body = "<h2>Cloud backup</h2>";
  if (!cfg.token) {
    body += '<div class="msub">Automatically saves your sheet to a private GitHub Gist after Long Rest, ' +
      "Level Up, and End Session — a real off-device copy, using the GitHub account you already have. " +
      'Needs a Personal Access Token scoped ONLY to "gist" — see DEPLOY.md for the exact steps.</div>';
    body += '<div class="mrow"><input type="password" id="backup-token" placeholder="Paste your token here" style="flex:1"></div>';
    body += '<div class="mrow"><button class="bt cutsm pri" data-act="backupConnect">Connect</button></div>';
  } else {
    const statusLine = cfg.lastSyncOk === false
      ? '<span style="color:var(--mag)">Last attempt failed: ' + esc(cfg.lastError) + "</span>"
      : cfg.lastSyncedAt ? "Last synced " + timeAgo(cfg.lastSyncedAt) : "Connected — not yet synced";
    body += '<div class="msub">' + statusLine + "</div>";
    if (cfg.gistId) {
      body += '<div class="foot">Gist: <a href="https://gist.github.com/' + esc(cfg.gistId) +
        '" target="_blank" rel="noopener">gist.github.com/…/' + esc(cfg.gistId.slice(0, 8)) + "…</a></div>";
    }
    body += '<div class="mrow"><button class="bt cutsm pri" data-act="backupNow">Back up now</button>' +
      '<button class="bt cutsm dg" data-act="backupDisconnect">Disconnect</button></div>';
  }
  body += '<div class="ph2" style="margin-top:12px">Manual export</div>';
  body += '<div class="foot">Last manual export: ' + (lastExport ? timeAgo(lastExport) : "never") + "</div>";
  body += '<div class="mrow"><button class="bt cutsm" data-act="shareBackup">Share / save a copy</button></div>';
  body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Close</button></div>';
  return body;
};

Object.assign(ACT, {
  backupModal() { UI.modal = { type: "backup" }; render(); },
  backupConnect() {
    const el = document.getElementById("backup-token");
    const token = el ? el.value.trim() : "";
    if (!token) { UI.alert = { info: "Paste a token first." }; render(); return; }
    const cfg = loadBackupCfg();
    cfg.token = token; cfg.lastSyncOk = null; cfg.lastError = ""; cfg.pending = false;
    saveBackupCfg(cfg);
    render();
    syncToGist();
  },
  backupDisconnect() {
    saveBackupCfg(backupDefaults());
    UI.alert = { info: "Disconnected. If you're retiring this token for good, also revoke it on GitHub." };
    render();
  },
  backupNow() {
    render();
    syncToGist();
  },
  shareBackup() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const filename = "hal-briarshade-" + new Date().toISOString().slice(0, 10) + ".json";
    try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())); } catch (e) {}
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Hal Briarshade backup" }).catch(function () { /* cancelled */ });
        render();
        return;
      }
    }
    ACT.exportJSON();
    render();
  }
});

/* ---------- WRAP settingsModal TO LINK TO BACKUP ----------------- */
const _settingsModalForBackup = EXT.settingsModal;
EXT.settingsModal = function () {
  const body = _settingsModalForBackup();
  const cfg = loadBackupCfg();
  const label = cfg.token
    ? (cfg.lastSyncOk === false ? "Cloud backup — sync failed" : "Cloud backup — connected")
    : "Cloud backup — not connected";
  const nav = '<button class="pick" data-act="backupModal"><div class="pn">' + label + "</div>" +
    '<div class="pt">Automatic off-device backup to a private GitHub Gist, plus manual export/share.</div></button>';
  return body.replace('<div class="mfoot">', nav + '<div class="mfoot">');
};

/* ---------- HOOK THE MODAL INTO THE RENDER CHAIN ----------------- */
const _renderForBackup = render;
render = function () {
  _renderForBackup();
  if (UI.modal && UI.modal.type === "backup") {
    const root = document.getElementById("modal-root");
    root.innerHTML = '<div class="mask"><div class="modal cut">' + EXT.backupModal() + "</div></div>";
  }
};

/* Kick a mirror on boot so the very first load isn't only in localStorage. */
mirrorToIndexedDB();
maybeSnapshotDaily();
