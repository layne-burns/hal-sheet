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
/* The backup is JSON, which is exactly the wrong thing to read on a
   laptop after a session. So the same gist also carries the notes as
   Markdown, which GitHub renders as a page -- no export step, no cable,
   and it is already there the next time you look. Purely a second copy:
   nothing ever reads it back, so it can never corrupt a restore. */
const GIST_NOTES_FILENAME = "hal-session-notes.md";

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
function gistHeaders(token) {
  return {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}

/* Find the backup gist this token already owns, if any.
   Without this, every browser you connect starts its OWN gist and the
   devices silently drift apart — the whole point of one token is that
   they share one backup. Picks the most recently updated match. */
function adoptExistingGist() {
  const cfg = loadBackupCfg();
  if (!cfg.token || cfg.gistId) return Promise.resolve(false);
  if (typeof fetch === "undefined") return Promise.resolve(false);
  return fetch("https://api.github.com/gists?per_page=100", { headers: gistHeaders(cfg.token) })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (list) {
      if (!list || !list.length) return false;
      const match = list
        .filter(function (g) { return g.files && g.files[GIST_FILENAME]; })
        .sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); })[0];
      if (!match) return false;
      const c = loadBackupCfg();
      c.gistId = match.id;
      saveBackupCfg(c);
      return true;
    })
    .catch(function () { return false; });
}

/* ---------- RESTORE (pull the cloud copy down) -------------------
   Kept as an explicit two-step — fetch, show what's there, then let the
   user confirm — because replacing the sheet is destructive and the
   remote copy might be older than what's in front of them. */
let _restore = { state: "idle", data: null, meta: null, error: "" };
function resetRestore() { _restore = { state: "idle", data: null, meta: null, error: "" }; }

function remoteBackupFetch() {
  const cfg = loadBackupCfg();
  if (!cfg.token) return Promise.reject(new Error("Not connected."));
  if (typeof fetch === "undefined") return Promise.reject(new Error("This browser can't reach GitHub."));
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.reject(new Error("Offline — reconnect and try again."));
  }
  const headers = gistHeaders(cfg.token);
  return (cfg.gistId
      ? Promise.resolve(cfg.gistId)
      : adoptExistingGist().then(function () { return loadBackupCfg().gistId; }))
    .then(function (id) {
      if (!id) throw new Error("No backup found for this token yet.");
      return fetch("https://api.github.com/gists/" + id, { headers: headers });
    })
    .then(function (res) {
      if (res.status === 404) throw new Error("That backup no longer exists on GitHub.");
      if (res.status === 401) throw new Error("Token rejected — it may be revoked or mistyped.");
      if (!res.ok) throw new Error("GitHub returned " + res.status + ".");
      return res.json();
    })
    .then(function (body) {
      const file = body && body.files && body.files[GIST_FILENAME];
      if (!file || !file.content) throw new Error("The backup file is empty.");
      const parsed = JSON.parse(file.content);
      if (!parsed.identity || !parsed.abilities) throw new Error("That gist isn't a Hal sheet.");
      return { data: parsed, meta: { updatedAt: body.updated_at, id: body.id } };
    });
}

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
  /* combat.js owns the recap format; if it failed to load, sync the
     sheet anyway rather than losing the backup over a nicety. */
  if (typeof allSessionsMarkdown === "function") {
    const notes = allSessionsMarkdown();
    if (notes) payload.files[GIST_NOTES_FILENAME] = { content: notes };
  }
  const headers = gistHeaders(cfg.token);
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
      '<button class="bt cutsm" data-act="backupLoad">Load from cloud</button>' +
      '<button class="bt cutsm dg" data-act="backupDisconnect">Disconnect</button></div>';
    body += '<div class="foot">Same token on another device? <b>Load from cloud</b> pulls this ' +
      "sheet down there — that's how you carry Hal between machines.</div>";

    if (_restore.state === "loading") {
      body += '<div class="foot" style="margin-top:8px">Checking GitHub…</div>';
    } else if (_restore.state === "error") {
      body += '<div class="warnbox" style="margin-top:8px">' + esc(_restore.error) + "</div>";
    } else if (_restore.state === "ready" && _restore.data) {
      /* Show what's actually in the cloud copy before overwriting, so a
         stale backup can't quietly clobber a newer local sheet. */
      const d = _restore.data;
      const rows = [];
      rows.push(["Character", (d.identity && d.identity.name ? d.identity.name : "?") +
        ", level " + (d.level || "?")]);
      rows.push(["Hit points", (d.currentHP == null ? "?" : d.currentHP) + " current"]);
      if (d.calendar) {
        rows.push(["In-world", CAL.format(d.calendar.system || "jerbeen", d.calendar.day || 1) +
          ", Year " + (d.calendar.year || "?")]);
      }
      rows.push(["Saved to GitHub", _restore.meta && _restore.meta.updatedAt
        ? timeAgo(new Date(_restore.meta.updatedAt).getTime()) : "unknown"]);
      body += '<div class="ph2" style="margin-top:12px">The cloud copy holds</div>';
      rows.forEach(function (r) {
        body += '<div class="kv"><span>' + esc(r[0]) + "</span><span>" + esc(String(r[1])) + "</span></div>";
      });
      body += '<div class="warnbox" style="margin-top:8px">This replaces the sheet on this device. ' +
        "Undo can bring the current one back if you change your mind.</div>";
      body += '<div class="mrow"><button class="bt cutsm dg" data-act="backupRestoreConfirm">' +
        "Replace this device's sheet</button>" +
        '<button class="bt cutsm" data-act="backupRestoreCancel">Cancel</button></div>';
    }
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
    /* Join the backup this token already has before pushing, so a second
       device doesn't start a competing gist. */
    adoptExistingGist().then(function () { syncToGist(); });
  },
  backupDisconnect() {
    saveBackupCfg(backupDefaults());
    resetRestore();
    UI.alert = { info: "Disconnected. If you're retiring this token for good, also revoke it on GitHub." };
    render();
  },
  backupLoad() {
    _restore = { state: "loading", data: null, meta: null, error: "" };
    render();
    remoteBackupFetch()
      .then(function (r) { _restore = { state: "ready", data: r.data, meta: r.meta, error: "" }; })
      .catch(function (e) {
        _restore = { state: "error", data: null, meta: null, error: e.message || "Could not load." };
      })
      .then(function () { if (UI.modal && UI.modal.type === "backup") render(); });
  },
  backupRestoreCancel() { resetRestore(); render(); },
  backupRestoreConfirm() {
    if (_restore.state !== "ready" || !_restore.data) return;
    /* Stash what's on screen into the undo stack first — if the cloud copy
       turns out to be the stale one, Undo gets this device back. */
    try {
      if (typeof histLoad === "function" && typeof histSave === "function") {
        const h = histLoad();
        h.push({ label: "Before cloud restore", at: Date.now(), state: JSON.parse(JSON.stringify(S)) });
        histSave(h);
      }
    } catch (e) { /* never let the safety net block the restore itself */ }
    S = migrate(_restore.data);
    clampState(S);
    save();
    resetRestore();
    UI.modal = null;
    UI.alert = { info: "Loaded " + esc(S.identity.name) + ", level " + S.level + " from the cloud." };
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
