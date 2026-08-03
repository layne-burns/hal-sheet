/* ============================================================
   HAL BRIARSHADE — APP LAYER
   State machine, persistence, rendering, automation.
   Depends on rules.js (RULES + CALC + SEED).
   ============================================================ */

const STORE_KEY = "hal-briarshade-sheet-v1";

/* ---------- STATE ------------------------------------------- */
let S = load();

/* Ephemeral UI state — deliberately NOT persisted, except the rail
   collapse and tab which live on S.toggles / S.ui for convenience. */
const UI = { prov: null, modal: null, alert: null, filter: [], expanded: {} };

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return deepClone(SEED);
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn("Load failed, falling back to seed:", e);
    return deepClone(SEED);
  }
}

function migrate(st) {
  /* Fill in anything a newer schema added, without clobbering player data. */
  const base = deepClone(SEED);
  const out = Object.assign({}, base, st);
  out.toggles = Object.assign({}, base.toggles, st.toggles || {});
  out.resources = Object.assign({}, base.resources, st.resources || {});
  out.resources.slots = Object.assign({}, base.resources.slots, (st.resources || {}).slots || {});
  out.equipment = Object.assign({}, base.equipment, st.equipment || {});
  out.identity = Object.assign({}, base.identity, st.identity || {});
  out.notes = Object.assign({}, base.notes, st.notes || {});
  out.deathSaves = Object.assign({}, base.deathSaves, st.deathSaves || {});
  /* Newer subsystems — merge key-by-key so an older export that predates
     them still picks up the defaults instead of arriving undefined. */
  out.settings = Object.assign({}, base.settings, st.settings || {});
  out.combat = Object.assign({}, base.combat, st.combat || {});
  out.combat.turn = Object.assign({}, base.combat.turn, (st.combat || {}).turn || {});
  out.combat.order = (st.combat || {}).order || [];
  out.combat.currentId = (st.combat || {}).currentId || null;
  out.effects = st.effects || [];
  /* "creatures" replaces the earlier "targets" field; tolerate old saves. */
  out.creatures = st.creatures || st.targets || [];
  out.party = Object.assign({ roster: [] }, st.party || {});
  /* Backfill status on party rosters saved before the status field existed. */
  out.party.roster = (out.party.roster || []).map(function (m) {
    return Object.assign({ status: "healthy" }, m);
  });
  out.session = Object.assign({}, base.session, st.session || {});
  out.session.stats = Object.assign({}, base.session.stats, (st.session || {}).stats || {});
  out.sessionHistory = st.sessionHistory || [];
  out.schemaVersion = base.schemaVersion;
  return out;
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

/* The single write path. Every change funnels through here, so
   autosave is structural rather than something to remember. */
function mutate(fn) {
  fn(S);
  clampState(S);
  save();
  render();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { console.error("Save failed:", e); }
}

/* Auto-flag a significant, table-relevant moment into the session log
   (deaths, going down, stabilizing) — separate from the session-active
   labeled-mutate logging so it fires from any code path, not just ones
   that pass a label. No-op when no session is running. */
function logFlag(st, text) {
  if (st.session && st.session.active) {
    st.session.log.push({ t: Date.now(), label: text, kind: "flag" });
    if (st.session.log.length > 500) st.session.log.shift();
  }
}

/* Keep derived caps honest after any change (level, CON, etc.) */
function clampState(st) {
  const maxHP = CALC.maxHP(st).value;
  const lohMax = CALC.layOnHandsMax(st).value;
  const cdMax = CALC.channelDivinityMax(st).value;
  st.currentHP = Math.max(0, Math.min(st.currentHP, maxHP));
  st.tempHP = Math.max(0, st.tempHP || 0);
  st.resources.layOnHands = Math.max(0, Math.min(st.resources.layOnHands, lohMax));
  st.resources.channelDivinity = Math.max(0, Math.min(st.resources.channelDivinity, cdMax));
  st.hitDiceUsed = Math.max(0, Math.min(st.hitDiceUsed, st.level));
  const slots = CALC.slotsMax(st);
  Object.keys(slots).forEach(function (lv) {
    if (!st.resources.slots[lv]) st.resources.slots[lv] = { used: 0 };
    st.resources.slots[lv].used = Math.max(0, Math.min(st.resources.slots[lv].used, slots[lv]));
  });
  /* Mastery cap of 2 — enforce, never silently exceed */
  if (st.equipment.activeMasteries.length > 2) {
    st.equipment.activeMasteries = st.equipment.activeMasteries.slice(0, 2);
  }
  /* Aura is meaningless before level 6 */
  if (st.level < 6) st.toggles.auraOfProtection = false;
  if (st.currentHP > 0) { st.deathSaves.successes = 0; st.deathSaves.failures = 0; }
  /* If whoever was "current" got removed from the order (a creature
     died, a party member was dropped), fall back cleanly rather than
     pointing at nothing. */
  if (st.combat.currentId && !st.combat.order.some(function (o) { return o.id === st.combat.currentId; })) {
    st.combat.currentId = st.combat.order.length ? st.combat.order[0].id : null;
  }
  /* Defensive: a hand-edited Import JSON shouldn't be able to crash the
     session log or party roster by omitting an array. */
  if (!Array.isArray(st.session.log)) st.session.log = [];
  if (!Array.isArray(st.sessionHistory)) st.sessionHistory = [];
  if (!Array.isArray(st.party.roster)) st.party.roster = [];
}

/* ---------- SMALL HELPERS ----------------------------------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
  });
}
function sign(n) { return (n >= 0 ? "+" : "−") + Math.abs(n); }
function link(slug, label) {
  const u = wiki(slug);
  return u ? '<a href="' + u + '" target="_blank" rel="noopener">' + esc(label) + "</a>" : esc(label);
}
/* A small, separate control for reaching the wiki. Used everywhere a
   name's PRIMARY click now does something useful instead of leaving
   the app — the wiki is one deliberate extra tap away, not the default. */
function wikiBtn(slug) {
  if (!slug) return "";
  return '<button class="wikibtn" data-act="wiki" data-slug="' + esc(slug) +
    '" title="Open on the wiki" aria-label="Open ' + esc(slug) + ' on the wiki">wiki ↗</button>';
}
function tagsOf(id, base) {
  const ov = S.tagOverrides[id];
  return ov ? ov : (base || []);
}
function tagHTML(list, clickable) {
  return (list || []).map(function (t) {
    const def = TAGS[t];
    if (!def) return "";
    return '<span class="tag t-' + def.color + (clickable ? '" data-act="filter" data-tag="' + t : "") +
      '">' + esc(def.label) + "</span>";
  }).join("");
}
function matchesFilter(list) {
  if (!UI.filter.length) return true;
  return UI.filter.every(function (t) { return (list || []).indexOf(t) >= 0; });
}

/* ---------- ACTIONS ----------------------------------------- */
const ACT = {

  /* ---- Display ---- */
  scaleUI(el) {
    const dir = parseInt(el.dataset.dir, 10);
    mutate(function (st) {
      const current = st.settings.uiScale || 100;
      st.settings.uiScale = Math.max(50, Math.min(200, current + dir * 10));
    });
  },
  resetUIScale() {
    mutate(function (st) { st.settings.uiScale = 100; });
  },

  tab(el) { mutate(function (st) { st.ui = st.ui || {}; st.ui.tab = el.dataset.tab; }); },

  /* Wiki is now a deliberate, separate action — never the default
     result of tapping a name. */
  wiki(el) {
    const slug = el.dataset.slug;
    const url = wiki(slug);
    if (url) window.open(url, "_blank", "noopener");
  },
  portraitView() { UI.modal = { type: "portrait" }; render(); },

  toggleRail() { mutate(function (st) { st.toggles.railCollapsed = !st.toggles.railCollapsed; }); },

  toggle(el) {
    const k = el.dataset.key;
    mutate(function (st) { st.toggles[k] = !st.toggles[k]; });
  },

  editMode() { mutate(function (st) { st.toggles.editMode = !st.toggles.editMode; }); },

  prov(el) {
    const k = el.dataset.prov;
    UI.prov = (UI.prov === k) ? null : k;
    render();
  },

  filter(el) {
    const t = el.dataset.tag;
    const i = UI.filter.indexOf(t);
    if (i >= 0) UI.filter.splice(i, 1); else UI.filter.push(t);
    render();
  },
  clearFilter() { UI.filter = []; render(); },

  expand(el) {
    const k = el.dataset.id;
    UI.expanded[k] = !UI.expanded[k];
    render();
  },

  /* ---- Resources ---- */
  loh(el) {
    const d = parseInt(el.dataset.d, 10);
    mutate(function (st) { st.resources.layOnHands += d; });
  },
  lohSet(el) {
    const v = parseInt(el.value, 10) || 0;
    mutate(function (st) { st.resources.layOnHands = v; });
  },
  cd(el) {
    const d = parseInt(el.dataset.d, 10);
    mutate(function (st) { st.resources.channelDivinity += d; });
  },
  slot(el) {
    const lv = el.dataset.lv, d = parseInt(el.dataset.d, 10);
    mutate(function (st) {
      const max = CALC.slotsMax(st)[lv] || 0;
      st.resources.slots[lv].used = Math.max(0, Math.min(max, st.resources.slots[lv].used + d));
    });
  },
  res(el) {
    const k = el.dataset.key, d = parseInt(el.dataset.d, 10);
    mutate(function (st) { st.resources[k] = Math.max(0, Math.min(1, (st.resources[k] || 0) + d)); });
  },

  /* ---- Mastery swap ---- */
  mastery(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      const arr = st.equipment.activeMasteries;
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      else { if (arr.length >= 2) arr.shift(); arr.push(id); }
    });
  },

  /* ---- Damage & concentration ---- */
  damageModal() { UI.modal = { type: "damage" }; render(); },
  applyDamage() {
    const n = parseInt(document.getElementById("dmg-in").value, 10);
    if (!n || n < 0) { UI.modal = null; render(); return; }
    const wasConcentrating = S.toggles.concentrating;
    mutate(function (st) {
      const wasUp = st.currentHP > 0;
      let rem = n;
      if (st.tempHP > 0) {
        const absorbed = Math.min(st.tempHP, rem);
        st.tempHP -= absorbed; rem -= absorbed;
      }
      st.currentHP = Math.max(0, st.currentHP - rem);
      if (st.currentHP === 0 && st.conditions.indexOf("unconscious") < 0) {
        st.conditions.push("unconscious");
      }
      if (wasUp && st.currentHP === 0) logFlag(st, "Hal is down (0 HP)");
    });
    UI.modal = null;
    if (wasConcentrating) {
      UI.alert = { dc: CALC.concentrationDC(n), dmg: n, on: S.toggles.concentratingOn };
    }
    render();
  },
  heal() {
    const n = parseInt(document.getElementById("dmg-in").value, 10) || 0;
    mutate(function (st) {
      const wasDown = st.currentHP === 0;
      st.currentHP = Math.min(CALC.maxHP(st).value, st.currentHP + n);
      if (st.currentHP > 0) {
        const i = st.conditions.indexOf("unconscious");
        if (i >= 0) st.conditions.splice(i, 1);
      }
      if (wasDown && st.currentHP > 0) logFlag(st, "Hal is back up");
    });
    UI.modal = null; render();
  },
  dismissAlert() { UI.alert = null; render(); },

  deathSave(el) {
    const kind = el.dataset.kind, i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const cur = st.deathSaves[kind];
      st.deathSaves[kind] = (cur === i + 1) ? i : i + 1;
      if (kind === "failures" && st.deathSaves.failures >= 3) logFlag(st, "Hal has died (3 failed death saves)");
      if (kind === "successes" && st.deathSaves.successes >= 3) logFlag(st, "Hal has stabilized");
    });
  },

  condition(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      const i = st.conditions.indexOf(k);
      if (i >= 0) st.conditions.splice(i, 1); else st.conditions.push(k);
    });
  },

  /* ---- Rests ---- */
  shortRest() {
    mutate(function (st) {
      /* RAW: regain ONE expended Channel Divinity use on a Short Rest */
      const max = CALC.channelDivinityMax(st).value;
      st.resources.channelDivinity = Math.min(max, st.resources.channelDivinity + 1);
    });
    UI.alert = { info: "Short rest — regained 1 Channel Divinity use. Spend Hit Dice in the Combat tab if you need HP." };
    render();
  },
  longRest() {
    mutate(function (st) {
      st.currentHP = CALC.maxHP(st).value;
      st.tempHP = 0;
      st.resources.layOnHands = CALC.layOnHandsMax(st).value;
      st.resources.channelDivinity = CALC.channelDivinityMax(st).value;
      st.resources.freeSmite = 1;
      st.resources.findFamiliar = 1;
      st.resources.detectThoughts = 1;
      Object.keys(st.resources.slots).forEach(function (lv) { st.resources.slots[lv].used = 0; });
      st.hitDiceUsed = Math.max(0, st.hitDiceUsed - Math.max(1, Math.floor(st.level / 2)));
      st.toggles.concentrating = false;
      st.toggles.concentratingOn = "";
      st.deathSaves = { successes: 0, failures: 0 };
      st.conditions = st.conditions.filter(function (c) { return c !== "unconscious"; });
      if (st.exhaustion > 0) st.exhaustion -= 1;
    });
    UI.modal = { type: "longRest" };
    render();
  },
  hitDiceModal() { UI.modal = { type: "hitDice" }; render(); },
  spendHitDie() {
    const hdLeft = S.level - S.hitDiceUsed;
    const n = Math.max(1, Math.min(parseInt(document.getElementById("hd-count").value, 10) || 1, hdLeft));
    const roll = parseInt(document.getElementById("hd-in").value, 10);
    if (!roll) return;
    mutate(function (st) {
      const con = CALC.mod(st.abilities.con);
      const gained = Math.max(n, roll + con * n);
      st.currentHP = Math.min(CALC.maxHP(st).value, st.currentHP + gained);
      st.hitDiceUsed = Math.min(st.level, st.hitDiceUsed + n);
    });
    UI.modal = null;
    render();
  },

  /* ---- Level up ---- */
  levelUpModal() {
    const p = CALC.levelUpPreview(S);
    if (!p) { UI.alert = { info: "Hal is level 20 — the table ends here." }; render(); return; }
    UI.modal = { type: "levelUp", step: "roll", preview: p, picks: { spells: [], feat: null } };
    render();
  },
  levelUpRoll() {
    const raw = parseInt(document.getElementById("hp-roll").value, 10);
    if (!raw || raw < 1 || raw > 10) {
      UI.modal.err = "Enter the raw d10 result, 1 through 10.";
      render(); return;
    }
    UI.modal.raw = raw;
    UI.modal.adjusted = CALC.adjustHPRoll(raw);
    UI.modal.err = null;
    const p = UI.modal.preview;
    UI.modal.step = p.newSpellCount > 0 ? "spells" : (p.needsFeat ? "feat" : "confirm");
    render();
  },
  pickSpell(el) {
    const k = el.dataset.key;
    const arr = UI.modal.picks.spells;
    const i = arr.indexOf(k);
    if (i >= 0) arr.splice(i, 1);
    else if (arr.length < UI.modal.preview.newSpellCount) arr.push(k);
    render();
  },
  spellsNext() {
    if (UI.modal.picks.spells.length < UI.modal.preview.newSpellCount) {
      UI.modal.err = "Choose " + UI.modal.preview.newSpellCount + " spell(s).";
      render(); return;
    }
    UI.modal.err = null;
    UI.modal.step = UI.modal.preview.needsFeat ? "feat" : "confirm";
    render();
  },
  pickFeat(el) { UI.modal.picks.feat = el.dataset.key; render(); },
  featNext() {
    if (!UI.modal.picks.feat) { UI.modal.err = "Choose a feat."; render(); return; }
    UI.modal.err = null; UI.modal.step = "confirm"; render();
  },
  levelUpApply() {
    const m = UI.modal;
    mutate(function (st) {
      const lohBefore = CALC.layOnHandsMax(st).value;
      st.level = m.preview.nextLevel;
      /* The pool's capacity grows with the level, and you gain the new
         capacity immediately rather than waiting for the next long rest. */
      st.resources.layOnHands += CALC.layOnHandsMax(st).value - lohBefore;
      st.hpEntries.push({ level: st.level, raw: m.raw, adjusted: m.adjusted });
      m.picks.spells.forEach(function (k) {
        if (st.preparedSpells.indexOf(k) < 0) st.preparedSpells.push(k);
      });
      if (m.picks.feat) {
        if (st.feats.indexOf(m.picks.feat) < 0) st.feats.push(m.picks.feat);
        st.abilityNotes = st.abilityNotes || {};
      }
      /* Unlock any class features whose level has arrived */
      Object.keys(FEATURES).forEach(function (k) {
        const f = FEATURES[k];
        if (f.unlockLevel && st.level >= f.unlockLevel && st.features.indexOf(k) < 0) {
          const isPaladinLine = /Paladin|Oath/.test(f.src || "");
          if (isPaladinLine) st.features.push(k);
        }
      });
      /* New HP is gained immediately */
      st.currentHP += m.adjusted + CALC.mod(st.abilities.con);
      /* New slots start unspent */
      const slots = CALC.slotsMax(st);
      Object.keys(slots).forEach(function (lv) {
        if (!st.resources.slots[lv]) st.resources.slots[lv] = { used: 0 };
      });
      if (st.level >= 5) st.resources.faithfulSteed = 1;
    });
    UI.modal = null;
    UI.alert = { info: "Level " + S.level + ". Max HP is now " + CALC.maxHP(S).value +
      ". Check the Features tab for what unlocked." };
    render();
  },
  closeModal() { UI.modal = null; render(); },

  /* ---- Edit mode field writes ---- */
  editField(el) {
    const path = el.dataset.path, val = el.value;
    mutate(function (st) {
      const parts = path.split(".");
      let o = st;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
      const key = parts[parts.length - 1];
      o[key] = (typeof o[key] === "number") ? (parseInt(val, 10) || 0) : val;
    });
  },
  editAbility(el) {
    const k = el.dataset.key, v = parseInt(el.value, 10) || 10;
    mutate(function (st) { st.abilities[k] = Math.max(1, Math.min(30, v)); });
  },
  toggleSkill(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      const i = st.skillProficiencies.indexOf(k);
      if (i >= 0) {
        st.skillProficiencies.splice(i, 1);
        const j = st.skillExpertise.indexOf(k);
        if (j >= 0) st.skillExpertise.splice(j, 1);
      } else st.skillProficiencies.push(k);
    });
  },
  toggleExpertise(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      if (st.skillProficiencies.indexOf(k) < 0) return;
      const i = st.skillExpertise.indexOf(k);
      if (i >= 0) st.skillExpertise.splice(i, 1); else st.skillExpertise.push(k);
    });
  },
  addCustom() {
    mutate(function (st) {
      st.customEntries.push({
        id: "c" + Date.now(), name: "New ability", text: "Describe the mechanics here.",
        src: "Homebrew", tags: [], homebrew: true
      });
    });
  },
  editCustom(el) {
    const id = el.dataset.id, field = el.dataset.field, val = el.value;
    mutate(function (st) {
      const e = st.customEntries.filter(function (c) { return c.id === id; })[0];
      if (e) e[field] = val;
    });
  },
  delCustom(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      st.customEntries = st.customEntries.filter(function (c) { return c.id !== id; });
    });
  },
  addItem() {
    mutate(function (st) {
      st.equipment.inventory.push({ name: "New item", qty: 1, tags: [], note: "" });
    });
  },
  editItem(el) {
    const i = parseInt(el.dataset.i, 10), field = el.dataset.field;
    const val = field === "qty" ? (parseInt(el.value, 10) || 0) : el.value;
    mutate(function (st) { st.equipment.inventory[i][field] = val; });
  },
  delItem(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) { st.equipment.inventory.splice(i, 1); });
  },
  editTags(el) {
    const id = el.dataset.id;
    const list = el.value.split(",").map(function (s) { return s.trim(); })
      .filter(function (s) { return !!TAGS[s]; });
    mutate(function (st) { st.tagOverrides[id] = list; });
  },
  unprepare(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      st.preparedSpells = st.preparedSpells.filter(function (x) { return x !== k; });
    });
  },
  addPrepared() { UI.modal = { type: "addSpell" }; render(); },
  choosePrepared(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      if (st.preparedSpells.indexOf(k) < 0) st.preparedSpells.push(k);
    });
    UI.modal = null; render();
  },

  /* ---- Export / import ---- */
  exportJSON() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "hal-briarshade-" + d + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  },
  importJSON() { document.getElementById("import-file").click(); },
  doImport(el) {
    const f = el.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function (ev) {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.identity || !parsed.abilities) throw new Error("Not a Hal sheet");
        S = migrate(parsed);
        clampState(S); save();
        UI.alert = { info: "Imported " + esc(S.identity.name) + ", level " + S.level + "." };
        render();
      } catch (err) {
        UI.alert = { info: "Import failed: " + err.message };
        render();
      }
    };
    r.readAsText(f);
    el.value = "";
  },
  resetSheet() {
    if (!confirm("Reset to the imported Hal.pdf values? Your current state will be lost unless you exported it.")) return;
    S = deepClone(SEED); save(); render();
  }
};

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  /* Whole-UI zoom, not just text — the stylesheet is all px, so scaling
     root font-size would do nothing; CSS zoom (well-supported in the
     Safari/WebKit this app targets) actually reflows everything. */
  document.body.style.zoom = ((S.settings && S.settings.uiScale) || 100) + "%";
  const app = document.getElementById("app");
  const tab = (S.ui && S.ui.tab) || "combat";
  app.innerHTML =
    topBar() +
    conditionStrip() +
    alertBar() +
    tabBar(tab) +
    '<div class="wrap' + (S.toggles.railCollapsed ? " railoff" : "") + '">' +
      '<div>' + leftRail() + '</div>' +
      '<div>' + tabContent(tab) + '</div>' +
      '<div class="rail">' +
        '<div class="railtab" data-act="toggleRail"><span>Resources</span></div>' +
        '<div class="railbody">' + resourceRail() + '</div>' +
      '</div>' +
    '</div>' +
    '<input type="file" id="import-file" accept="application/json" class="hide" data-act="doImport">';
  document.getElementById("modal-root").innerHTML = modalHTML();
}

/* ---------- TOP BAR ---------- */
function topBar() {
  const maxHP = CALC.maxHP(S).value;
  const ac = CALC.armorClass(S);
  const dc = CALC.spellSaveDC(S);
  const init = CALC.initiative(S);
  const pct = maxHP ? Math.round((S.currentHP / maxHP) * 100) : 0;
  const cls = pct <= 25 ? "crit" : (pct <= 60 ? "hurt" : "");
  const E = S.toggles.editMode;

  let toggles =
    '<button class="tg cutsm' + (S.toggles.concentrating ? " on y" : "") +
      '" data-act="toggle" data-key="concentrating">Concentrating</button>' +
    '<button class="tg cutsm' + (S.toggles.takeHeart ? " on" : "") +
      '" data-act="toggle" data-key="takeHeart">Take Heart</button>';
  /* Aura of Protection is hidden entirely until level 6 */
  if (S.level >= 6) {
    toggles += '<button class="tg cutsm' + (S.toggles.auraOfProtection ? " on" : "") +
      '" data-act="toggle" data-key="auraOfProtection">Aura</button>';
  }

  const portrait = CALC.portraitFor(S);

  return '<div class="bar cut">' +
    '<button class="portrait" data-act="portraitView" title="' + esc(portrait.label) +
      '" aria-label="View portrait — ' + esc(portrait.label) + '">' +
      '<img src="' + portrait.file + '" alt="Hal, ' + esc(portrait.label) + '">' +
      '<span class="pstate">' + esc(portrait.label) + "</span></button>" +
    '<div><div class="nm">' + esc(S.identity.name) + "</div>" +
      '<div class="nmsub">' + esc(S.identity.species).toUpperCase() + " // " +
      esc(S.identity.class).toUpperCase() + " " + S.level + " // " +
      esc(S.identity.subclass).toUpperCase() + "</div></div>" +

    '<div class="v hpwrap" data-act="prov" data-prov="hp">' +
      '<div class="lbl">Hit points</div>' +
      '<div class="n">' + S.currentHP + "<small>/" + maxHP + "</small>" +
        (S.tempHP ? ' <span class="tmp">+' + S.tempHP + "</span>" : "") + "</div>" +
      '<div class="hpbar"><div class="hpfill ' + cls + '" style="width:' + pct + '%"></div></div>' +
    "</div>" +

    '<div class="v" data-act="prov" data-prov="ac"><div class="lbl">Armor</div>' +
      '<div class="n">' + ac.value + "</div></div>" +
    '<div class="v" data-act="prov" data-prov="dc"><div class="lbl">Save DC</div>' +
      '<div class="n">' + dc.value + "</div></div>" +
    '<div class="v" data-act="prov" data-prov="init"><div class="lbl">Init</div>' +
      '<div class="n">' + sign(init.value) + "</div></div>" +
    '<div class="v"><div class="lbl">Speed</div><div class="n">' + S.identity.speed + "</div></div>" +

    '<div class="sp"></div>' + toggles +
    '<button class="bt dg cutsm" data-act="damageModal">Damage<k>D</k></button>' +
    '<button class="bt cutsm" data-act="shortRest">Short<k>S</k></button>' +
    '<button class="bt cutsm" data-act="longRest">Long<k>L</k></button>' +
    '<button class="bt pri cutsm" data-act="levelUpModal">Level up</button>' +
    '<button class="bt cutsm' + (E ? " pri" : "") + '" data-act="editMode">' +
      (E ? "Editing" : "Edit") + "<k>E</k></button>" +
    '<button class="bt cutsm" data-act="exportJSON">Export</button>' +
    '<button class="bt cutsm" data-act="importJSON">Import</button>' +
  "</div>";
}

/* ---------- CONDITION STRIP / DEATH SAVES ---------- */
function conditionStrip() {
  if (S.currentHP === 0) {
    const d = S.deathSaves;
    let pips = '<span class="lbl">Successes</span><div class="ds">';
    for (let i = 0; i < 3; i++)
      pips += '<button class="dsp' + (d.successes > i ? " on" : "") +
        '" data-act="deathSave" data-kind="successes" data-i="' + i + '"></button>';
    pips += '</div><span class="lbl" style="margin-left:14px">Failures</span><div class="ds">';
    for (let i = 0; i < 3; i++)
      pips += '<button class="dsp f' + (d.failures > i ? " on" : "") +
        '" data-act="deathSave" data-kind="failures" data-i="' + i + '"></button>';
    pips += "</div>";
    const dead = d.failures >= 3, stable = d.successes >= 3;
    return '<div class="strip death cut"><span class="lbl" style="letter-spacing:.18em">' +
      (dead ? "Hal has died" : stable ? "Stable at 0 HP" : "Unconscious — roll death saves") +
      "</span>" + pips +
      '<span style="margin-left:auto;font-family:var(--m);font-size:14.5px;opacity:.85">' +
      "DC 10 · nat 20 revives at 1 HP · nat 1 is two failures</span></div>";
  }
  if (!S.conditions.length && !S.exhaustion) return "";
  let out = '<div class="strip cut"><span class="lbl">Conditions</span>';
  out += S.conditions.map(function (k) {
    const c = CONDITIONS[k];
    return '<span class="cond">' + esc(c ? c.name : k) +
      '<button class="x" data-act="condition" data-key="' + k + '">×</button></span>';
  }).join("");
  if (S.exhaustion) out += '<span class="cond">Exhaustion ' + S.exhaustion + "</span>";
  out += '<span class="lbl" style="margin-left:auto">Details in the Combat tab</span></div>';
  return out;
}

/* ---------- ALERT ---------- */
function alertBar() {
  if (!UI.alert) return "";
  if (UI.alert.info) {
    return '<div class="alert cutsm" style="background:var(--cyan);color:#04141A">' +
      '<span>' + esc(UI.alert.info) + "</span>" +
      '<button class="x" data-act="dismissAlert">×</button></div>';
  }
  const conSave = CALC.savingThrow(S, "con");
  return '<div class="alert cutsm">' +
    "<span>Roll Constitution save</span><b>DC " + UI.alert.dc + "</b>" +
    '<span class="sub">' + UI.alert.dmg + " damage taken" +
      (UI.alert.on ? " · concentrating on " + esc(UI.alert.on) : "") +
      " · your CON save is " + sign(conSave.value) + "</span>" +
    '<button class="x" data-act="dismissAlert">×</button></div>';
}

/* ---------- TABS ---------- */
function tabBar(active) {
  const tabs = [["combat","Combat","1"],["spells","Spells","2"],["features","Features","3"],
                ["inventory","Inventory","4"],["notes","Notes","5"]];
  return '<div class="tabs">' + tabs.map(function (t) {
    return '<button class="tab" aria-selected="' + (active === t[0]) +
      '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + "<k>" + t[2] + "</k></button>";
  }).join("") + "</div>";
}

/* ---------- LEFT RAIL ---------- */
function leftRail() {
  const E = S.toggles.editMode;
  let out = '<div class="pnl cut"><h3>Abilities</h3>';
  ["str","dex","con","int","wis","cha"].forEach(function (k) {
    const m = CALC.mod(S.abilities[k]);
    if (E) {
      out += '<div class="row"><span>' + k.toUpperCase() + "</span>" +
        '<span><input type="number" style="width:56px" value="' + S.abilities[k] +
        '" data-act="editAbility" data-key="' + k + '"> ' + sign(m) + "</span></div>";
    } else {
      out += '<div class="row" data-act="prov" data-prov="ability:' + k + '"><span>' + k.toUpperCase() +
        '</span><span><span class="sc">' + S.abilities[k] + "</span> " + sign(m) + "</span></div>";
    }
  });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Saves</h3>';
  ["str","dex","con","int","wis","cha"].forEach(function (k) {
    const s = CALC.savingThrow(S, k);
    const prof = S.saveProficiencies.indexOf(k) >= 0;
    out += '<div class="row' + (prof ? " prof" : "") + '" data-act="prov" data-prov="save:' + k + '">' +
      "<span>" + (prof ? '<i class="dot"></i>' : '<i class="dot off"></i>') + k.toUpperCase() + "</span>" +
      "<span>" + sign(s.value) +
      (s.advantage ? ' <span class="adv">ADV</span>' : "") + "</span></div>";
  });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Skills</h3>';
  Object.keys(SKILL_NAMES).sort(function (a, b) {
    return SKILL_NAMES[a].localeCompare(SKILL_NAMES[b]);
  }).forEach(function (k) {
    const sk = CALC.skill(S, k);
    if (!E && !sk.proficient) return; /* only show proficient skills unless editing */
    const dotCls = sk.expertise ? "dot exp" : (sk.proficient ? "dot" : "dot off");
    out += '<div class="row' + (sk.proficient ? " prof" : "") + '" ' +
      (E ? 'data-act="toggleSkill" data-key="' + k + '"' : 'data-act="prov" data-prov="skill:' + k + '"') +
      '><span><i class="' + dotCls + '"></i>' + esc(SKILL_NAMES[k]) +
      ' <span class="sc">' + SKILL_ABILITY[k].toUpperCase() + "</span></span>" +
      "<span>" + sign(sk.value) + "</span></div>";
  });
  if (!E) out += '<div class="foot">Tap Edit to change proficiencies</div>';
  out += "</div>";

  if (UI.prov) out += provPanel();
  return out;
}

/* ---------- PROVENANCE PANEL ---------- */
function provPanel() {
  const key = UI.prov;
  let title = "", data = null, fmt = sign;

  if (key === "hp") { title = "Max hit points"; data = CALC.maxHP(S); fmt = String; }
  else if (key === "ac") { title = "Armor class"; data = CALC.armorClass(S); fmt = String; }
  else if (key === "dc") { title = "Spell save DC"; data = CALC.spellSaveDC(S); fmt = String; }
  else if (key === "init") { title = "Initiative"; data = CALC.initiative(S); }
  else if (key === "loh") { title = "Lay on Hands pool"; data = CALC.layOnHandsMax(S); fmt = String; }
  else if (key === "cd") { title = "Channel Divinity uses"; data = CALC.channelDivinityMax(S); fmt = String; }
  else if (key === "prepared") { title = "Prepared spells"; data = CALC.preparedMax(S); fmt = String; }
  else if (key === "hitdice") { title = "Hit dice"; data = CALC.hitDice(S); fmt = String; }
  else if (key.indexOf("save:") === 0) {
    const k = key.split(":")[1];
    title = ABILITY_NAMES[k] + " save"; data = CALC.savingThrow(S, k);
  } else if (key.indexOf("ability:") === 0) {
    const k = key.split(":")[1];
    title = ABILITY_NAMES[k] + " modifier"; data = CALC.abilityMod(S, k);
  } else if (key.indexOf("skill:") === 0) {
    const k = key.split(":")[1];
    title = SKILL_NAMES[k]; data = CALC.skill(S, k);
  } else if (key.indexOf("atk:") === 0) {
    const parts = key.split(":"), id = parts[1], which = parts[2];
    const row = CALC.attackAction(S).rows.filter(function (r) { return r.id === id; })[0];
    if (!row) return "";
    if (which === "hit") { title = row.weapon.name + " attack"; data = { value: row.toHit, sources: row.toHitSources }; }
    else { title = row.weapon.name + " damage"; data = { value: row.damage, sources: row.damageSources }; fmt = String; }
  }
  if (!data) return "";

  let out = '<div class="prov"><div class="ph"><span>' + esc(title) + " · " +
    fmt(data.value) + '</span><button class="x" data-act="prov" data-prov="' + esc(key) + '">×</button></div>';
  data.sources.forEach(function (s) {
    const v = s.value == null ? "" : (typeof s.value === "number" ? sign(s.value) : s.value);
    out += '<div class="pr k-' + s.kind + '"><span>' + esc(s.label) + "</span><b>" + esc(v) + "</b></div>";
  });
  out += '<div class="tot"><span>Total</span><b>' + fmt(data.value) + "</b></div>";
  if (data.advantage) out += '<div class="pr k-feature"><span>Advantage</span><b>' + esc(data.advantage) + "</b></div>";
  if (data.stealthDis) out += '<div class="pr k-item"><span>Stealth</span><b>Disadvantage</b></div>';
  out += '<div class="pr" style="margin-top:6px;color:var(--dimmer)"><span>' +
    "Yellow scales with level · violet is from a feat</span></div>";
  out += "</div>";
  return out;
}

/* ---------- TAB CONTENT ---------- */
function tabContent(tab) {
  if (tab === "spells") return spellsTab();
  if (tab === "features") return featuresTab();
  if (tab === "inventory") return inventoryTab();
  if (tab === "notes") return notesTab();
  return combatTab();
}

/* ---------- COMBAT ---------- */
function combatTab() {
  const a = CALC.attackAction(S);
  let out = '<div class="pnl cut"><h3>Attack action <span class="cnt">' +
    (a.extraAttack ? "two-weapon · extra attack" : "two-weapon") + "</span></h3>";

  a.seq.forEach(function (s) {
    const r = s.row;
    out += '<div class="atk">' +
      '<div class="stp' + (s.step === "+" ? " g" : "") + '">' + s.step + "</div>" +
      '<div class="wn"><button class="namebtn" data-act="attackRoll" data-id="' + r.id + '">' +
        esc(r.weapon.name) + "</button>" + wikiBtn(r.weapon.slug) +
        (r.weapon.range ? ' <span class="bdg">' + esc(r.weapon.range) + "</span>" : "") + "</div>" +
      '<div class="nu" data-act="prov" data-prov="atk:' + r.id + ':hit">' + sign(r.toHit) + "</div>" +
      '<div class="nu" data-act="prov" data-prov="atk:' + r.id + ':dmg">' + esc(r.damage) + "</div>" +
      '<div class="ms" data-act="expand" data-id="m-' + r.id + '">' +
        esc(MASTERIES[r.mastery].name) + " · " + esc(s.note) + "</div>" +
    "</div>";
    if (UI.expanded["m-" + r.id]) {
      out += '<div class="entry" style="padding-left:31px"><div class="etext">' +
        esc(MASTERIES[r.mastery].text) + "</div></div>";
    }
  });

  out += '<div class="seqnote">' + esc(a.masteryNote) +
    (a.bonusActionFree ? " <b>Bonus Action stays open</b> for Lay on Hands, Divine Smite, or Help (Team Tactics)." : "") +
    "<br><em>Damage type: " + esc(a.seq[0].row.damageType) + " · Two-Weapon Fighting adds your modifier to the off-hand.</em></div>";
  out += "</div>";

  /* All weapons with mastery active/inactive */
  out += '<div class="pnl cut"><h3>Weapons <span class="cnt">masteries active ' +
    S.equipment.activeMasteries.length + " of 2</span></h3>";
  a.rows.forEach(function (r) {
    out += '<div class="atk' + (r.masteryActive ? "" : " off") + '">' +
      '<div class="stp' + (r.masteryActive ? "" : " g") + '">' + (r.masteryActive ? "●" : "○") + "</div>" +
      '<div class="wn"><button class="namebtn" data-act="attackRoll" data-id="' + r.id + '">' +
        esc(r.weapon.name) + "</button>" + wikiBtn(r.weapon.slug) +
        (r.masteryActive ? "" : '<span class="bdg">Inactive</span>') + "</div>" +
      '<div class="nu">' + sign(r.toHit) + "</div>" +
      '<div class="nu">' + esc(r.damage) + "</div>" +
      '<div class="ms"><button class="bt cutsm" data-act="mastery" data-id="' + r.id + '">' +
        esc(MASTERIES[r.mastery].name) + (r.masteryActive ? " — on" : " — off") + "</button></div>" +
    "</div>";
  });
  out += '<div class="seqnote">A Paladin uses the mastery properties of <b>two</b> kinds of weapons. ' +
    "Swap them on a long rest. Inactive masteries are struck through so you don't fire one by mistake.</div></div>";

  /* Hit dice */
  const hdLeft = S.level - S.hitDiceUsed;
  out += '<div class="pnl cut"><h3>Hit dice <span class="cnt">' + hdLeft + " of " + S.level + " d10 left</span></h3>" +
    '<div class="mrow"><span class="lbl">Roll d10s, add CON ' + sign(CALC.mod(S.abilities.con)) + " per die</span>" +
    '<button class="bt cutsm" data-act="hitDiceModal"' + (hdLeft <= 0 ? " disabled" : "") + ">Spend</button></div></div>";

  /* Conditions detail */
  out += '<div class="pnl cut"><h3>Conditions</h3><div class="gridcols">';
  Object.keys(CONDITIONS).forEach(function (k) {
    const c = CONDITIONS[k], on = S.conditions.indexOf(k) >= 0;
    out += '<div class="row' + (on ? " prof" : "") + '" data-act="condition" data-key="' + k + '">' +
      '<span><i class="dot' + (on ? "" : " off") + '"></i>' + esc(c.name) + "</span></div>";
  });
  out += "</div>";
  S.conditions.forEach(function (k) {
    const c = CONDITIONS[k];
    if (!c) return;
    out += '<div class="entry"><div class="eh">' +
      '<button class="namebtn en" data-act="condition" data-key="' + k + '" title="Tap to remove">' +
      esc(c.name) + "</button>" + wikiBtn(c.slug) +
      '</div><div class="etext">' + esc(c.text) + "</div></div>";
  });
  out += "</div>";
  return out;
}

/* ---------- SPELLS ---------- */
function spellsTab() {
  const dc = CALC.spellSaveDC(S).value, atk = CALC.spellAttack(S).value;
  const prepMax = CALC.preparedMax(S);
  const oath = oathSpellKeys();
  const E = S.toggles.editMode;

  const filterCollapsed = !!UI.expanded.filterCollapsed;
  let out = '<div class="pnl cut"><h3>Spellcasting</h3>' +
    '<div class="mrow"><span class="lbl">Save DC</span><b class="mono" style="font-size:22.5px">' + dc + "</b>" +
    '<span class="lbl" style="margin-left:12px">Attack</span><b class="mono" style="font-size:22.5px">' + sign(atk) + "</b>" +
    '<span class="lbl" style="margin-left:12px">Ability</span><b class="mono">Charisma</b>' +
    '<span class="lbl" style="margin-left:12px">Focus</span><b class="mono">Holy Symbol</b></div>' +
    '<div class="ph2" style="margin-top:10px">Filter' +
    '<button class="bt cutsm" style="margin-left:8px" data-act="expand" data-id="filterCollapsed">' +
    (filterCollapsed ? "Show" : "Hide") + "</button></div>" +
    (filterCollapsed ? "" : tagFilterBar()) + "</div>";

  /* Cantrips */
  out += '<div class="pnl cut"><h3>Cantrips <span class="cnt">Magic Initiate (Wizard)</span></h3>';
  S.cantrips.forEach(function (k) { out += spellEntry(k, false); });
  out += "</div>";

  /* Prepared */
  out += '<div class="pnl cut"><h3>Prepared <span class="cnt" data-act="prov" data-prov="prepared">' +
    S.preparedSpells.length + " of " + prepMax.value + "</span></h3>";
  if (S.preparedSpells.length < prepMax.value) {
    out += '<div class="warnbox">You have ' + (prepMax.value - S.preparedSpells.length) +
      " unused prepared-spell slot(s) at level " + S.level + ".</div>";
  }
  S.preparedSpells.forEach(function (k) { out += spellEntry(k, E); });
  if (E) out += '<button class="bt cutsm" data-act="addPrepared">+ Prepare a spell</button>';
  out += "</div>";

  /* Oath — always prepared, free */
  out += '<div class="pnl cut"><h3>Oath spells <span class="cnt">always prepared · do not count against the limit</span></h3>';
  oath.forEach(function (k) { out += spellEntry(k, false); });
  out += "</div>";

  /* Granted */
  out += '<div class="pnl cut"><h3>Always available</h3>' +
    spellEntry("divineSmite", false) + spellEntry(S.magicInitiate.spell, false);
  if (S.level >= 5) out += spellEntry("findSteed", false);
  out += "</div>";
  return out;
}

function oathSpellKeys() {
  const out = [];
  Object.keys(OATH_SPELLS).forEach(function (lv) {
    if (S.level >= parseInt(lv, 10)) out.push.apply(out, OATH_SPELLS[lv]);
  });
  return out;
}

function spellEntry(k, editable) {
  const sp = SPELLS[k];
  if (!sp) return "";
  const tags = tagsOf("spell:" + k, sp.tags);
  if (!matchesFilter(tags)) return "";
  const open = UI.expanded["s-" + k];
  /* Cast button, greyed when unaffordable (combat.js supplies castables).
     The spell NAME carries the identical data-act, so tapping either the
     name or the button casts it — neither goes to the wiki by default. */
  let castBtn = "", nameAct = ' data-act="expand" data-id="s-' + k + '"', nameDim = "";
  if (typeof CALC.castables === "function") {
    const c = CALC.castables(S).filter(function (x) { return x.kind === "spell" && x.id === k; })[0];
    if (c) {
      const blocked = !c.affordable || (c.afterHit && S.combat.active && !S.combat.turn.hitLanded);
      const dim = blocked && S.settings.economyLockout;
      nameAct = ' data-act="use" data-kind="spell" data-id="' + k + '"';
      nameDim = dim ? " dim" : "";
      castBtn = '<button class="bt cutsm ' + (dim ? "dim" : "pri") +
        '" data-act="use" data-kind="spell" data-id="' + k + '" title="' +
        esc(blocked ? c.reasons.join("; ") || "Requires a hit first" : costLabel(c.cost)) + '">' +
        (c.free ? "Cast free" : "Cast") + "</button>";
    }
  }
  let out = '<div class="entry"><div class="eh">' +
    '<button class="namebtn en' + nameDim + '"' + nameAct + '>' + esc(sp.name) + "</button>" + wikiBtn(sp.slug) +
    '<span class="emeta">' + (sp.lvl === 0 ? "Cantrip" : "Level " + sp.lvl) + " · " +
      esc(sp.school) + " · " + esc(sp.time) + " · " + esc(sp.range) + "</span>" +
    castBtn +
    '<button class="bt cutsm" data-act="expand" data-id="s-' + k + '">' + (open ? "Less" : "More") + "</button>" +
    (editable ? '<button class="bt cutsm dg" data-act="unprepare" data-key="' + k + '">Remove</button>' : "") +
    "</div>" +
    '<div>' + tagHTML(tags, true) + "</div>";
  if (open) {
    out += '<div class="etext">' + esc(sp.text) + "</div>" +
      '<div class="emeta" style="margin-top:5px">Duration: ' + esc(sp.dur) +
      " · Components: " + esc(sp.comp) + "</div>";
    if (S.toggles.editMode) {
      out += '<div class="mrow" style="margin-top:7px"><span class="lbl">Tags</span>' +
        '<input style="flex:1" value="' + esc(tags.join(", ")) +
        '" data-act="editTags" data-id="spell:' + k + '"></div>';
    }
  }
  out += "</div>";
  return out;
}

/* ---------- FEATURES ---------- */
function featuresTab() {
  const E = S.toggles.editMode;
  let out = filterPanel();

  out += '<div class="pnl cut"><h3>Class &amp; subclass</h3>';
  S.features.forEach(function (k) {
    const f = FEATURES[k];
    if (!f || !/Paladin|Oath/.test(f.src || "")) return;
    out += featureEntry(k, f);
  });
  /* Locked, upcoming features so you can see what's ahead */
  Object.keys(FEATURES).forEach(function (k) {
    const f = FEATURES[k];
    if (!f.unlockLevel || S.level >= f.unlockLevel) return;
    if (!/Paladin|Oath/.test(f.src || "")) return;
    const tags = tagsOf("feature:" + k, f.tags);
    if (!matchesFilter(tags)) return;
    out += '<div class="entry locked"><div class="eh"><span class="en">' + esc(f.name) +
      '</span><span class="emeta">Unlocks at level ' + f.unlockLevel +
      '</span><span class="esrc">' + esc(f.src) + "</span></div></div>";
  });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Species &amp; background</h3>';
  S.features.forEach(function (k) {
    const f = FEATURES[k];
    if (!f || /Paladin|Oath/.test(f.src || "")) return;
    out += featureEntry(k, f);
  });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Feats</h3>';
  S.feats.forEach(function (k) {
    const f = FEATS[k];
    if (!f) return;
    const tags = tagsOf("feat:" + k, f.tags);
    if (!matchesFilter(tags)) return;
    const open = UI.expanded["f-" + k];
    /* Feats are passive — tapping the name reads the same as tapping More. */
    out += '<div class="entry"><div class="eh">' +
      '<button class="namebtn en" data-act="expand" data-id="f-' + k + '">' + esc(f.name) + "</button>" +
      wikiBtn(f.slug) +
      '<span class="emeta">' + esc(f.type) + " feat" + (f.prereq ? " · " + esc(f.prereq) : "") + "</span>" +
      '<button class="bt cutsm" data-act="expand" data-id="f-' + k + '">' + (open ? "Less" : "More") + "</button></div>" +
      "<div>" + tagHTML(tags, true) + "</div>" +
      (open ? '<div class="etext">' + esc(f.text) + "</div>" : "") + "</div>";
  });
  if (S.magicInitiate) {
    out += '<div class="entry"><div class="eh"><span class="en">Magic Initiate picks</span></div>' +
      '<div class="etext">Cantrips: ' +
      S.magicInitiate.cantrips.map(function (c) { return SPELLS[c] ? SPELLS[c].name : c; }).join(", ") +
      ". Level 1 spell: " + (SPELLS[S.magicInitiate.spell] || {}).name +
      ", free once per long rest. Spellcasting ability: " +
      ABILITY_NAMES[S.magicInitiate.ability] + ".</div></div>";
  }
  out += "</div>";

  /* Homebrew / custom */
  out += '<div class="pnl cut"><h3>Custom &amp; homebrew</h3>';
  if (!S.customEntries.length && !E) out += '<div class="foot">Turn on Edit to add homebrew abilities</div>';
  S.customEntries.forEach(function (c) {
    if (E) {
      out += '<div class="entry"><div class="mrow">' +
        '<input style="flex:1" value="' + esc(c.name) + '" data-act="editCustom" data-id="' + c.id + '" data-field="name">' +
        '<button class="bt cutsm dg" data-act="delCustom" data-id="' + c.id + '">Delete</button></div>' +
        '<textarea style="width:100%;min-height:64px" data-act="editCustom" data-id="' + c.id +
        '" data-field="text">' + esc(c.text) + "</textarea></div>";
    } else {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(c.name) +
        '</span><span class="hb">Homebrew</span></div><div class="etext">' + esc(c.text) + "</div></div>";
    }
  });
  if (E) out += '<button class="bt cutsm" data-act="addCustom">+ Add ability</button>';
  out += "</div>";

  /* Import log — the audit trail */
  out += '<div class="pnl cut"><h3>Import corrections <span class="cnt">Hal.pdf → 2024 RAW</span></h3>';
  S.importLog.forEach(function (l) { out += '<div class="imp">' + esc(l) + "</div>"; });
  out += "</div>";
  return out;
}

/* Features that correspond to something you can actually DO — tapping
   their name triggers that, exactly like the doable-panel Use button.
   Everything else is passive, so tapping the name just reads more. */
const FEATURE_ACTION_MAP = {
  layOnHands:  { kind: "action", id: "layOnHands" },
  divineSense: { kind: "action", id: "divineSense" },
  naturesWrath:{ kind: "action", id: "naturesWrath" },
  teamTactics: { kind: "action", id: "help" },
  faithfulSteed:{ kind: "spell", id: "findSteed" }
};

function featureEntry(k, f) {
  const tags = tagsOf("feature:" + k, f.tags);
  if (!matchesFilter(tags)) return "";
  const open = UI.expanded["ft-" + k];
  const act = FEATURE_ACTION_MAP[k];
  const nameBtn = act
    ? '<button class="namebtn en" data-act="use" data-kind="' + act.kind + '" data-id="' + act.id + '">' +
        esc(f.name) + "</button>"
    : '<button class="namebtn en" data-act="expand" data-id="ft-' + k + '">' + esc(f.name) + "</button>";
  return '<div class="entry"><div class="eh">' + nameBtn + wikiBtn(f.slug) +
    (f.homebrew ? '<span class="hb">Homebrew</span>' : "") +
    '<button class="bt cutsm" data-act="expand" data-id="ft-' + k + '">' + (open ? "Less" : "More") + "</button>" +
    '<span class="esrc">' + esc(f.src) + "</span></div>" +
    "<div>" + tagHTML(tags, true) + "</div>" +
    (open ? '<div class="etext">' + esc(f.text) + "</div>" : "") + "</div>";
}

/* ---------- INVENTORY ---------- */
function inventoryTab() {
  const E = S.toggles.editMode;
  const c = S.equipment.coins;
  let out = filterPanel();

  out += '<div class="pnl cut"><h3>Carried</h3>';
  S.equipment.inventory.forEach(function (it, i) {
    if (!matchesFilter(it.tags)) return;
    if (E) {
      out += '<div class="entry"><div class="mrow">' +
        '<input style="flex:1" value="' + esc(it.name) + '" data-act="editItem" data-i="' + i + '" data-field="name">' +
        '<input type="number" style="width:60px" value="' + it.qty + '" data-act="editItem" data-i="' + i + '" data-field="qty">' +
        '<button class="bt cutsm dg" data-act="delItem" data-i="' + i + '">Delete</button></div>' +
        '<input style="width:100%;margin-top:4px" placeholder="Note" value="' + esc(it.note || "") +
        '" data-act="editItem" data-i="' + i + '" data-field="note"></div>';
    } else {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(it.name) +
        (it.qty > 1 ? ' <span class="emeta">x' + it.qty + "</span>" : "") + "</span></div>" +
        "<div>" + tagHTML(it.tags, true) + "</div>" +
        (it.note ? '<div class="etext">' + esc(it.note) + "</div>" : "") + "</div>";
    }
  });
  if (E) out += '<button class="bt cutsm" data-act="addItem">+ Add item</button>';
  out += "</div>";

  out += '<div class="pnl cut"><h3>Coin</h3>';
  ["pp","gp","ep","sp","cp"].forEach(function (k) {
    out += '<div class="kv"><span>' + k.toUpperCase() + "</span>" +
      (E ? '<input type="number" style="width:90px" value="' + (c[k] || 0) +
           '" data-act="editField" data-path="equipment.coins.' + k + '">'
         : "<span>" + (c[k] || 0) + "</span>") + "</div>";
  });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Proficiencies</h3>' +
    '<div class="kv"><span>Armor</span><span>' + S.armorTraining.join(", ") + "</span></div>" +
    '<div class="kv"><span>Weapons</span><span>' + S.weaponProficiencies.join(", ") + "</span></div>" +
    '<div class="kv"><span>Tools</span><span>' + S.toolProficiencies.join(", ") + "</span></div>" +
    '<div class="kv"><span>Armor worn</span><span>' + esc((ARMOR[S.equipment.armor] || {}).name || "—") + "</span></div>" +
    "</div>";
  return out;
}

/* ---------- NOTES ---------- */
function notesTab() {
  const E = S.toggles.editMode;
  let out = '<div class="pnl cut"><h3>Character</h3><div class="gridcols">';
  [["name","Name"],["species","Species"],["class","Class"],["subclass","Subclass"],
   ["background","Background"],["age","Age"],["height","Height"],["weight","Weight"],
   ["eyes","Eyes"],["hair","Hair"],["skin","Skin"],["size","Size"]].forEach(function (p) {
    out += '<div class="kv"><span>' + p[1] + "</span>" +
      (E ? '<input style="width:120px" value="' + esc(S.identity[p[0]]) +
           '" data-act="editField" data-path="identity.' + p[0] + '">'
         : "<span>" + esc(S.identity[p[0]]) + "</span>") + "</div>";
  });
  out += "</div></div>";

  out += '<div class="pnl cut"><h3>Backstory</h3>' +
    (E ? '<textarea class="notes" data-act="editField" data-path="notes.backstory">' +
         esc(S.notes.backstory) + "</textarea>"
       : '<div class="etext" style="font-size:19px">' + esc(S.notes.backstory).replace(/\n/g, "<br>") + "</div>") +
    "</div>";

  out += '<div class="pnl cut"><h3>Notes</h3>' +
    (E ? '<textarea class="notes" data-act="editField" data-path="notes.misc">' + esc(S.notes.misc) + "</textarea>"
       : '<div class="etext" style="font-size:19px">' + esc(S.notes.misc).replace(/\n/g, "<br>") + "</div>") +
    "</div>";

  out += '<div class="pnl cut"><h3>Backup</h3>' +
    '<div class="foot" style="margin:0 0 9px">Export writes a JSON file to your iPad. Share sends it straight ' +
    "to Files, iCloud Drive, Mail, or AirDrop. Import replaces the current sheet. See Settings for automatic " +
    "cloud backup.</div>" +
    '<div class="mrow"><button class="bt cutsm pri" data-act="exportJSON">Export JSON</button>' +
    (typeof ACT.shareBackup === "function"
      ? '<button class="bt cutsm" data-act="shareBackup">Share…</button>' : "") +
    '<button class="bt cutsm" data-act="importJSON">Import JSON</button>' +
    '<button class="bt cutsm dg" data-act="resetSheet">Reset to Hal.pdf</button></div></div>';
  return out;
}

/* ---------- FILTER PANEL (collapsible) ---------- */
function filterPanel() {
  const collapsed = !!UI.expanded.filterCollapsed;
  let out = '<div class="pnl cut"><h3>Filter' +
    '<button class="bt cutsm" data-act="expand" data-id="filterCollapsed">' +
    (collapsed ? "Show" : "Hide") + "</button></h3>";
  if (!collapsed) out += tagFilterBar();
  return out + "</div>";
}

/* ---------- TAG FILTER BAR ---------- */
function tagFilterBar() {
  /* Grouped so the colour families read as meaning, not decoration */
  let out = '<div class="tagbar">';
  Object.keys(TAG_GROUPS).forEach(function (g) {
    out += '<span class="taggrp">' + esc(TAG_GROUPS[g]) + "</span>";
    Object.keys(TAGS).forEach(function (t) {
      if (TAGS[t].group !== g) return;
      const on = UI.filter.indexOf(t) >= 0;
      out += '<span class="tag t-' + TAGS[t].color + (on ? " sel" : "") +
        '" data-act="filter" data-tag="' + t + '">' + esc(TAGS[t].label) + "</span>";
    });
  });
  if (UI.filter.length) out += '<button class="bt cutsm" style="margin-left:6px" data-act="clearFilter">Clear</button>';
  out += "</div>";
  return out;
}

/* ---------- RESOURCE RAIL ---------- */
function resourceRail() {
  const loh = CALC.layOnHandsMax(S).value;
  const cdMax = CALC.channelDivinityMax(S).value;
  const slots = CALC.slotsMax(S);
  /* The whole header is the collapse control — a big, obvious tap target. */
  let out = '<div class="pnl cut"><h3 class="collapse" data-act="toggleRail">' +
    '<span>Resources</span><span class="chev">Hide ‹‹</span></h3>';

  out += '<div class="res"><div class="rh"><span class="lbl">Lay on hands</span>' +
    '<span class="rv" data-act="prov" data-prov="loh">' + S.resources.layOnHands +
    "<small>/" + loh + "</small></span></div>" +
    '<input class="slider" type="range" min="0" max="' + loh + '" value="' + S.resources.layOnHands +
    '" data-act="lohSet">' +
    '<div class="qb"><button data-act="loh" data-d="-1">−1</button>' +
    '<button data-act="loh" data-d="-5">−5</button>' +
    '<button data-act="loh" data-d="-10">−10</button>' +
    '<button data-act="loh" data-d="1">+1</button></div></div>';

  out += '<div class="res"><div class="rh"><span class="lbl">Channel divinity</span>' +
    '<span class="rv" data-act="prov" data-prov="cd">' + S.resources.channelDivinity +
    "<small>/" + cdMax + "</small></span></div><div class=\"pips\">";
  for (let i = 0; i < cdMax; i++) {
    out += '<button class="pip' + (i < S.resources.channelDivinity ? "" : " sp") +
      '" data-act="cd" data-d="' + (i < S.resources.channelDivinity ? -1 : 1) + '"></button>';
  }
  out += "</div></div>";

  Object.keys(slots).forEach(function (lv) {
    const max = slots[lv], used = (S.resources.slots[lv] || {}).used || 0;
    out += '<div class="res"><div class="rh"><span class="lbl">Spell slots · level ' + lv + "</span>" +
      '<span class="rv">' + (max - used) + "<small>/" + max + "</small></span></div><div class=\"pips\">";
    for (let i = 0; i < max; i++) {
      out += '<button class="pip' + (i < max - used ? "" : " sp") +
        '" data-act="slot" data-lv="' + lv + '" data-d="' + (i < max - used ? 1 : -1) + '"></button>';
    }
    out += "</div></div>";
  });

  [["freeSmite","Free smite"],["findFamiliar","Find familiar"],["detectThoughts","Detect thoughts"]]
    .forEach(function (p) {
      const v = S.resources[p[0]] || 0;
      out += '<div class="res"><div class="rh"><span class="lbl">' + p[1] + "</span>" +
        '<span class="rv">' + v + "<small>/1</small></span></div>" +
        '<div class="pips"><button class="pip y' + (v ? "" : " sp") +
        '" data-act="res" data-key="' + p[0] + '" data-d="' + (v ? -1 : 1) + '"></button></div></div>';
    });
  if (S.level >= 5) {
    const v = S.resources.faithfulSteed || 0;
    out += '<div class="res"><div class="rh"><span class="lbl">Faithful steed</span>' +
      '<span class="rv">' + v + '<small>/1</small></span></div><div class="pips">' +
      '<button class="pip y' + (v ? "" : " sp") + '" data-act="res" data-key="faithfulSteed" data-d="' +
      (v ? -1 : 1) + '"></button></div></div>';
  }
  out += "</div>";

  /* Quick prepared list for at-a-glance casting. Respects the tag
     filter so filtering is global, not just within the Spells tab. */
  out += '<div class="pnl cut"><h3>Prepared' +
    (UI.filter.length ? ' <span class="cnt">filtered</span>' : "") + "</h3>";
  S.preparedSpells.concat(oathSpellKeys()).forEach(function (k) {
    const sp = SPELLS[k];
    if (!sp) return;
    if (!matchesFilter(tagsOf("spell:" + k, sp.tags))) return;
    out += '<div class="entry" style="padding:6px 0"><div class="eh">' +
      '<button class="namebtn en" data-act="use" data-kind="spell" data-id="' + k +
      '">' + esc(sp.name) + "</button>" + wikiBtn(sp.slug) + "</div>" +
      "<div>" + tagHTML(tagsOf("spell:" + k, sp.tags), false) + "</div></div>";
  });
  out += "</div>";
  return out;
}

/* ============================================================
   MODALS
   ============================================================ */
function modalHTML() {
  if (!UI.modal) return "";
  const t = UI.modal.type;
  let body = "";

  if (t === "damage") {
    const conSave = CALC.savingThrow(S, "con");
    body = "<h2>Take damage</h2>" +
      '<div class="msub">Temporary HP absorbs first. If Concentrating, the save DC appears automatically.</div>' +
      '<div class="mrow"><input type="number" id="dmg-in" min="0" placeholder="Amount" autofocus>' +
      '<button class="bt cutsm dg" data-act="applyDamage">Apply damage</button>' +
      '<button class="bt cutsm" data-act="heal">Heal instead</button></div>' +
      '<div class="msub">Your Constitution save is ' + sign(conSave.value) +
      ". Concentration DC is 10, or half the damage taken, whichever is higher." +
      (S.toggles.concentrating ? " You are concentrating" +
        (S.toggles.concentratingOn ? " on " + esc(S.toggles.concentratingOn) : "") + "." : "") + "</div>" +
      '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (t === "hitDice") {
    const con = CALC.mod(S.abilities.con);
    const hdLeft = S.level - S.hitDiceUsed;
    body = "<h2>Spend Hit Dice</h2>" +
      '<div class="msub">Each die recovers its roll + CON (' + sign(con) + ") per die, minimum 1 per die.</div>" +
      '<div class="mrow"><label class="lbl">How many dice (up to ' + hdLeft + ')</label>' +
      '<input type="number" id="hd-count" min="1" max="' + hdLeft + '" value="1"></div>' +
      '<div class="mrow"><label class="lbl">Total rolled (sum of all dice)</label>' +
      '<input type="number" id="hd-in" min="' + hdLeft + '" placeholder="Total"></div>' +
      '<div class="mfoot"><button class="bt cutsm dg" data-act="spendHitDie">Apply</button>' +
      '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (t === "longRest") {
    body = "<h2>Long rest complete</h2>" +
      '<div class="msub">HP, spell slots, Lay on Hands, Channel Divinity, the free Divine Smite, ' +
      "Find Familiar, and Detect Thoughts have all been restored. Concentration ended.</div>" +
      '<div class="warnbox">You may swap your two active weapon masteries on a long rest.</div>' +
      '<div style="margin-bottom:10px">';
    CALC.attackAction(S).rows.forEach(function (r) {
      body += '<button class="pick' + (r.masteryActive ? " sel" : "") +
        '" data-act="mastery" data-id="' + r.id + '">' +
        '<div class="pn">' + esc(r.weapon.name) + " — " + esc(MASTERIES[r.mastery].name) +
        (r.masteryActive ? " (active)" : "") + "</div>" +
        '<div class="pt">' + esc(MASTERIES[r.mastery].text) + "</div></button>";
    });
    body += "</div>" +
      '<div class="msub">Active: ' + S.equipment.activeMasteries.length + " of 2</div>" +
      '<div class="mfoot"><button class="bt cutsm pri" data-act="closeModal">Done</button></div>';
  }

  else if (t === "levelUp") {
    body = levelUpModal();
  }

  else if (t === "portrait") {
    const p = CALC.portraitFor(S);
    const maxHP = CALC.maxHP(S).value;
    body = "<h2>" + esc(p.label) + '</h2><div class="msub">' + S.currentHP + " / " + maxHP + " HP</div>" +
      '<img src="' + p.file + '" alt="Hal, ' + esc(p.label) +
      '" style="width:100%;border:1px solid var(--line2);margin:4px 0 14px;display:block">' +
      '<div class="mfoot"><button class="bt cutsm pri" data-act="closeModal">Done</button></div>';
  }

  else if (t === "addSpell") {
    const maxLv = Math.max.apply(null, Object.keys(CALC.slotsMax(S)).map(Number));
    body = "<h2>Prepare a spell</h2>" +
      '<div class="msub">Paladin spells of a level you have slots for (up to level ' + maxLv + ").</div>";
    for (let lv = 1; lv <= maxLv; lv++) {
      (PALADIN_SPELL_LIST[lv] || []).forEach(function (k) {
        if (S.preparedSpells.indexOf(k) >= 0) return;
        const sp = SPELLS[k];
        body += '<button class="pick" data-act="choosePrepared" data-key="' + k + '">' +
          '<div class="pn">' + esc(sp.name) + '</div><div class="pm">Level ' + sp.lvl + " · " +
          esc(sp.time) + " · " + esc(sp.range) + "</div>" +
          '<div class="pt">' + esc(sp.text.slice(0, 150)) + "…</div></button>";
      });
    }
    body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  if (!body) return "";
  return '<div class="mask"><div class="modal cut">' + body + "</div></div>";
}

function levelUpModal() {
  const m = UI.modal, p = m.preview;
  let body = "<h2>Level up — " + S.level + " → " + p.nextLevel + "</h2>";
  const err = m.err ? '<div class="warnbox" style="border-color:var(--mag);color:var(--mag);background:#1A0008">' +
    esc(m.err) + "</div>" : "";

  if (m.step === "roll") {
    body += '<div class="msub">What you gain at level ' + p.nextLevel + ":</div>";
    p.gains.forEach(function (g) {
      body += '<div class="gain k-' + g.kind + '"><span class="gk">' + g.kind + "</span>" +
        "<span>" + esc(g.text) + "</span></div>";
    });
    body += err +
      '<div class="warnbox" style="margin-top:14px">Input your raw d10 roll. ' +
      "The app will automatically add +1 to this roll unless you rolled a 10.</div>" +
      '<div class="mrow"><input type="number" id="hp-roll" min="1" max="10" placeholder="d10" autofocus>' +
      '<span class="lbl">then +' + CALC.mod(S.abilities.con) + " CON per level</span>" +
      '<button class="bt cutsm pri" data-act="levelUpRoll">Continue</button></div>' +
      '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (m.step === "spells") {
    body += '<div class="msub">Rolled ' + m.raw + " → counts as " + m.adjusted +
      ", plus " + CALC.mod(S.abilities.con) + " CON. Choose " + p.newSpellCount +
      " new prepared spell(s). Oath spells are granted free and aren't listed.</div>" + err;
    const maxLv = Math.max.apply(null, Object.keys(PALADIN_TABLE[p.nextLevel].slots).map(Number));
    for (let lv = 1; lv <= maxLv; lv++) {
      (PALADIN_SPELL_LIST[lv] || []).forEach(function (k) {
        if (S.preparedSpells.indexOf(k) >= 0) return;
        const sp = SPELLS[k], sel = m.picks.spells.indexOf(k) >= 0;
        body += '<button class="pick' + (sel ? " sel" : "") + '" data-act="pickSpell" data-key="' + k + '">' +
          '<div class="pn">' + esc(sp.name) + "</div>" +
          '<div class="pm">Level ' + sp.lvl + " · " + esc(sp.time) + " · " + esc(sp.range) +
          " · " + tagsOf("spell:" + k, sp.tags).join(", ") + "</div>" +
          '<div class="pt">' + esc(sp.text.slice(0, 180)) + "…</div></button>";
      });
    }
    body += '<div class="mfoot"><button class="bt cutsm pri" data-act="spellsNext">Continue (' +
      m.picks.spells.length + "/" + p.newSpellCount + ')</button>' +
      '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (m.step === "feat") {
    body += '<div class="msub">Level ' + p.nextLevel +
      " grants a feat or an Ability Score Improvement. Choose one.</div>" + err;
    Object.keys(FEATS).forEach(function (k) {
      if (S.feats.indexOf(k) >= 0 && k !== "abilityScoreImprovement") return;
      if (FEATS[k].type === "Origin") return;
      const f = FEATS[k], sel = m.picks.feat === k;
      body += '<button class="pick' + (sel ? " sel" : "") + '" data-act="pickFeat" data-key="' + k + '">' +
        '<div class="pn">' + esc(f.name) + "</div>" +
        '<div class="pm">' + esc(f.type) + (f.prereq ? " · " + esc(f.prereq) : "") + "</div>" +
        '<div class="pt">' + esc(f.text) + "</div></button>";
    });
    body += '<div class="mfoot"><button class="bt cutsm pri" data-act="featNext">Continue</button>' +
      '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (m.step === "confirm") {
    const con = CALC.mod(S.abilities.con);
    const gain = m.adjusted + con;
    body += '<div class="msub">Confirm level ' + p.nextLevel + ".</div>" +
      '<div class="gain k-level"><span class="gk">HP</span><span>Rolled ' + m.raw +
      (m.raw === 10 ? " — a natural 10, no bonus applied" : " → " + m.adjusted + " after the +1 house rule") +
      ", plus " + con + " CON = <b>+" + gain + " max HP</b></span></div>";
    if (m.picks.spells.length) {
      body += '<div class="gain k-feature"><span class="gk">Spells</span><span>' +
        m.picks.spells.map(function (k) { return SPELLS[k].name; }).join(", ") + "</span></div>";
    }
    if (m.picks.feat) {
      body += '<div class="gain k-feature"><span class="gk">Feat</span><span>' +
        esc(FEATS[m.picks.feat].name) + "</span></div>";
    }
    p.gains.forEach(function (g) {
      body += '<div class="gain k-' + g.kind + '"><span class="gk">' + g.kind + "</span><span>" +
        esc(g.text) + "</span></div>";
    });
    if (m.picks.feat && FEATS[m.picks.feat].asi) {
      body += '<div class="warnbox" style="margin-top:12px">' + esc(FEATS[m.picks.feat].name) +
        " includes an ability score increase. Apply it by hand in Edit mode, then note it so the provenance stays accurate.</div>";
    }
    body += '<div class="mfoot"><button class="bt cutsm pri" data-act="levelUpApply">Apply level ' +
      p.nextLevel + '</button><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }
  return body;
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
document.addEventListener("click", function (e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (typeof fn === "function" && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") {
    e.preventDefault();
    fn(el);
  }
});

/* Text and number fields commit on change (not input) so a full
   re-render never steals focus mid-typing. */
document.addEventListener("change", function (e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.tagName !== "SELECT") return;
  const fn = ACT[el.dataset.act];
  if (typeof fn === "function") fn(el);
});

/* Live slider feedback without a re-render storm */
document.addEventListener("input", function (e) {
  const el = e.target;
  if (el.dataset && el.dataset.act === "lohSet") {
    const out = el.closest(".res").querySelector(".rv");
    if (out) out.firstChild.nodeValue = el.value;
  }
});

/* Keyboard shortcuts — the keyboard case earns its keep */
document.addEventListener("keydown", function (e) {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    if (e.key === "Enter" && document.getElementById("dmg-in") === document.activeElement) ACT.applyDamage();
    if (e.key === "Enter" && document.getElementById("hp-roll") === document.activeElement) ACT.levelUpRoll();
    if (e.key === "Escape") document.activeElement.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "escape") { UI.modal = null; UI.prov = null; UI.alert = null; render(); return; }
  if (["1","2","3","4","5"].indexOf(k) >= 0) {
    const tabs = ["combat","spells","features","inventory","notes"];
    mutate(function (st) { st.ui = st.ui || {}; st.ui.tab = tabs[parseInt(k, 10) - 1]; });
    return;
  }
  if (k === "d") { ACT.damageModal(); e.preventDefault(); }
  else if (k === "s") { ACT.shortRest(); }
  else if (k === "l") { ACT.longRest(); }
  else if (k === "e") { ACT.editMode(); }
  else if (k === "c") { mutate(function (st) { st.toggles.concentrating = !st.toggles.concentrating; }); }
});

/* Boot */
clampState(S);
render();
