/* ============================================================
   HAL BRIARSHADE — APP LAYER
   State machine, persistence, rendering, automation.
   Depends on rules.js (RULES + CALC + SEED).
   ============================================================ */

const STORE_KEY = "hal-briarshade-sheet-v1";

/* What the app's "100%" actually renders at. The sheet was always read at
   80% on the iPad it lives on, so that is the size the layout is tuned
   against — the breakpoints, the column widths and the type sizes were all
   chosen for it. Naming that size 100% keeps the setting honest: it means
   "the size this is meant to be", and A+ / A− move around it.

   Declared up here because migrate() needs it, and migrate() runs on the
   very next line. */
const UI_SCALE_BASE = 0.8;

/* ---------- STATE ------------------------------------------- */
let S = load();

/* Ephemeral UI state — deliberately NOT persisted, except the rail
   collapse and tab which live on S.toggles / S.ui for convenience. */
/* `cal` is the browsing cursor for the calendar tab — which day you're
   LOOKING at, deliberately separate from S.calendar, which is the day
   the party is actually living in. null means "follow the current date". */
/* `map` is the map's camera and selection — how far you have zoomed and
   panned, and which pin is open. Deliberately ephemeral, like `cal`:
   where you are LOOKING is not part of the character.

   `drag` is live pointer state during a pan, a pinch, or a pin being
   moved. It never touches S until the gesture ends, because every write
   to S re-renders the page and would yank the map out from under the
   finger doing the dragging. */
/* `people` is how the People tab is being READ right now — what you have
   typed into its search box, which standing you have narrowed to, and
   which records are open for editing. None of it is part of the campaign,
   so none of it is saved; the records themselves live on S.people. */
const UI = { prov: null, modal: null, alert: null, filter: [], expanded: {},
             cal: { day: null, year: null },
             map: { zoom: 1, x: 0, y: 0, sel: null, mode: "look", q: "" },
             people: { q: "", standing: "", edit: {} },
             watch: { edit: {} },
             modalScroll: 0,
             drag: null };

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
  out.watch = st.watch || [];

  /* The creature roster is gone. It carried an AC per enemy, which turned
     "does that hit?" into a number the character has no way of knowing —
     and once the AC went, so did the reason to track enemies one at a
     time, because the table lumps their initiative anyway.

     Anyone who was actually IN a turn order is still in a fight, so they
     survive the change as a plain named entry; the roster behind them
     doesn't. Their conditions come across as watch entries, which is
     where "who is Restrained and until when" now lives. */
  const oldCreatures = st.creatures || st.targets || [];
  if (oldCreatures.length) {
    const byId = {};
    oldCreatures.forEach(function (c) { byId[c.id] = c; });
    out.combat.order = out.combat.order.map(function (o) {
      if (!o.ref || o.ref.type !== "creature") return o;
      const c = byId[o.ref.creatureId];
      return { id: o.id, initiative: o.initiative,
               ref: { type: "foe", name: (c && c.name) || "Enemy" } };
    });
    oldCreatures.forEach(function (c) {
      (c.conditions || []).forEach(function (cond) {
        out.watch.push({ id: "w-" + c.id + "-" + cond.label, who: c.name, what: cond.label,
          kind: "effect", outcome: "Repeats a " + cond.save.toUpperCase() + " save vs DC " + cond.dc,
          left: null, unit: "rounds", note: "" });
      });
    });
  }
  delete out.creatures;
  delete out.targets;
  delete out.settings.creatureTracker;
  out.party = Object.assign({ roster: [] }, st.party || {});
  /* Backfill status on party rosters saved before the status field existed. */
  /* No `token` default: an absent one has to stay absent, because
     clampState reads undefined as "nobody has chosen a face yet" and
     null as "chosen: none". Defaulting it here would make the two
     indistinguishable. */
  out.party.roster = (out.party.roster || []).map(function (m) {
    return Object.assign({ status: "healthy" }, m);
  });
  /* Both arrived after the map did, so an older save simply has neither —
     start them empty rather than letting Object.assign hand back the
     seed's arrays by reference. */
  out.people = st.people || [];
  out.favourites = st.favourites || [];

  /* Tool proficiencies used to be a list of bare names printed on the
     Inventory tab. They are rollable entries now, so an older save's
     names are carried across and given a default ability — Wisdom, which
     is the one most tool checks are called on — rather than dropped. */
  if (!st.tools && Array.isArray(st.toolProficiencies)) {
    out.tools = st.toolProficiencies.map(function (n, i) {
      return { id: "t-" + i + "-" + String(n).toLowerCase().replace(/[^a-z0-9]+/g, ""),
               name: String(n), ability: "wis", expertise: false };
    });
  } else if (st.tools) {
    out.tools = st.tools;
  }
  delete out.toolProficiencies;
  out.session = Object.assign({}, base.session, st.session || {});
  out.session.stats = Object.assign({}, base.session.stats, (st.session || {}).stats || {});
  out.sessionHistory = st.sessionHistory || [];
  out.followers = st.followers || [];
  out.calendar = Object.assign({}, base.calendar, st.calendar || {});
  /* Map edits are deltas against cyrnn-data.js ids, so they merge rather
     than replace — a save made before the map existed simply arrives
     empty, and one made before a place was added keeps every nudge. */
  out.map = Object.assign({}, base.map, st.map || {});
  out.map.edits = Object.assign({}, (st.map || {}).edits || {});
  out.map.notes = Object.assign({}, (st.map || {}).notes || {});
  out.map.custom = (st.map || {}).custom || [];
  out.map.lore = (st.map || {}).lore || [];
  out.map.off = Object.assign({}, (st.map || {}).off || {});

  /* Schema 2 moved the display-size baseline: 100% now renders at what
     used to be 80%. A sheet saved before that stored its size against the
     old baseline, so rescale it once — someone sitting at 80% wanted the
     size they had, not a size 20% smaller than it. Guarded on the version
     so it can only ever happen to a given sheet once. */
  if ((st.schemaVersion || 1) < 2 && st.settings && st.settings.uiScale) {
    out.settings.uiScale = Math.round(st.settings.uiScale / UI_SCALE_BASE);
  }
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
    st.session.log.push({ t: Date.now(), label: text, kind: "flag", cal: calStamp(st) });
    if (st.session.log.length > 500) st.session.log.shift();
  }
}

/* Things you added to the world — a marker, an article, notes on a
   place. Narrative like a flag, but not a warning, so it reads as part
   of the story rather than as something going wrong.

   Upserts on `ref` instead of appending. A marker is created and then
   named a moment later, and notes on a place get edited four times in
   an evening; appending would turn one act into a pile of lines saying
   almost the same thing. Rewriting the entry keeps the log at one line
   per thing you actually did, carrying its latest name. */
function logWorld(st, ref, text) {
  if (!st.session || !st.session.active) return;
  const log = st.session.log;
  /* A null ref always appends: some world events genuinely happen more
     than once and each time is worth a line — the party moving twice in
     an evening is two moves, not a correction of the first. */
  for (let i = ref ? log.length - 1 : -1; i >= 0; i--) {
    if (log[i].ref === ref) {
      log[i].label = text;
      log[i].t = Date.now();
      log[i].cal = calStamp(st);
      return;
    }
  }
  log.push({ t: Date.now(), label: text, kind: "world", ref: ref, cal: calStamp(st) });
  if (log.length > 500) log.shift();
}

/* Where the party was in the story when something happened — the wall
   clock says when you played, this says when it happened. */
function calStamp(st) {
  const c = st.calendar;
  return c ? { day: c.day, year: c.year, time: c.timeOfDay } : null;
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
  /* The free Find Steed cast exists from level 5 on. Seed it here rather
     than only on level-up, so a sheet that arrived at 5 by import or a
     cloud load doesn't show an empty pip it can never explain. */
  if (st.level >= 5) {
    if (typeof st.resources.faithfulSteed !== "number") st.resources.faithfulSteed = 1;
    st.resources.faithfulSteed = Math.max(0, Math.min(1, st.resources.faithfulSteed));
  }
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
  /* Tool entries: a name, an ability the roll uses, and whether it is
     doubled. The ability has to be one of the six or the arithmetic has
     nothing to stand on. */
  if (!Array.isArray(st.tools)) st.tools = [];
  st.tools.forEach(function (t) {
    if (!t.id) t.id = uid("t");
    t.name = typeof t.name === "string" && t.name ? t.name : "Tool";
    if (!ABILITY_NAMES[t.ability]) {
      t.ability = (TOOLS_2024[t.key] && TOOLS_2024[t.key].ability) || "wis";
    }
    t.expertise = !!t.expertise;
  });

  if (!Array.isArray(st.party.roster)) st.party.roster = [];
  /* The party's faces are fixed, so a roster member named for one of them
     gets theirs without being asked — including after a rename, since
     partyAdd names people "Party member 2" and you fix that afterwards.

     The guess only ever fills a blank. `undefined` is "nobody has said",
     which is what keeps guessing; `null` is "no face, thank you", which
     is a decision and is left alone. Without that distinction, clearing
     Gill's face would silently hand it straight back on the next
     keystroke. */
  st.party.roster.forEach(function (m) {
    if (m.token !== undefined && m.token !== null) m.token = validToken(m.token);
    if (m.token === undefined) {
      const known = TOKEN_PARTY.map(function (n) { return n.toLowerCase(); })
        .indexOf(String(m.name || "").trim().toLowerCase());
      if (known >= 0) m.token = known;
    }
  });
  /* Same for anyone in the order: a foe's face rides on its entry,
     because there is no roster behind a foe to hold one. */
  (st.combat.order || []).forEach(function (o) {
    if (o.ref && o.ref.type === "foe") o.ref.token = validToken(o.ref.token);
  });
  if (!Array.isArray(st.followers)) st.followers = [];
  /* A follower's HP is the only number it owns, so it's the only one
     that can go out of range — and a summon at 0 HP is already gone. */
  st.followers = st.followers.filter(function (f) {
    const b = CALC.followerBlock(st, f);
    if (!b) return false;
    f.hp = Math.max(0, Math.min(typeof f.hp === "number" ? f.hp : b.maxHP, b.maxHP));
    f.tempHP = Math.max(0, f.tempHP || 0);
    return f.hp > 0;
  });
  /* Carried gear predates having ids, so anything without one is given
     one here rather than at every call site that might create an item.
     Boot saves once (see the bottom of this file) so the id a favourite
     was pinned against is the same id on the next launch. */
  if (!Array.isArray(st.equipment.inventory)) st.equipment.inventory = [];
  st.equipment.inventory.forEach(function (it) {
    if (!it.id) it.id = uid("i");
  });

  /* People: a record is only ever required to have an id, a kind and a
     name — everything else is optional by design, so the clamp fills
     shape rather than content. */
  if (!Array.isArray(st.people)) st.people = [];
  const peopleIds = {};
  st.people.forEach(function (p) {
    if (!p.id) p.id = uid("p");
    peopleIds[p.id] = p.kind === "group" ? "group" : "person";
    p.kind = peopleIds[p.id];
    p.name = typeof p.name === "string" ? p.name : "";
    p.standing = PEOPLE_STANDING.indexOf(p.standing) >= 0 ? p.standing : "unknown";
    p.status = PEOPLE_STATUS.indexOf(p.status) >= 0 ? p.status : "unknown";
    p.note = typeof p.note === "string" ? p.note : "";
    p.fields = (Array.isArray(p.fields) ? p.fields : []).map(function (f) {
      return { k: String((f && f.k) || ""), v: String((f && f.v) || "") };
    });
    p.groups = Array.isArray(p.groups) ? p.groups : [];
    p.token = validToken(p.token);
  });
  /* A person can't belong to a clan that has since been deleted, and a
     clan can't belong to anything — drop both rather than render a chip
     pointing at nothing. */
  st.people.forEach(function (p) {
    p.groups = p.kind === "person"
      ? p.groups.filter(function (g) { return peopleIds[g] === "group"; })
      : [];
  });

  /* A favourite is a pointer, so it lives exactly as long as what it
     points at. Unprepare a spell and the entry stays — the spell still
     exists and you may prepare it again — but delete the item and the
     pin goes with it. */
  if (!Array.isArray(st.favourites)) st.favourites = [];
  const favSeen = {};
  st.favourites = st.favourites.filter(function (f) {
    if (!f || !f.kind || !f.id) return false;
    const key = f.kind + ":" + f.id;
    if (favSeen[key]) return false;
    favSeen[key] = true;
    if (f.kind === "spell") return !!SPELLS[f.id];
    if (f.kind === "feature") return !!FEATURES[f.id];
    if (f.kind === "feat") return !!FEATS[f.id];
    if (f.kind === "item") {
      return st.equipment.inventory.some(function (it) { return it.id === f.id; });
    }
    if (f.kind === "action") {
      return typeof ACTION_CATALOG !== "undefined" &&
        ACTION_CATALOG.some(function (a) { return a.id === f.id; });
    }
    return false;
  });

  /* Someone else's effect is four sentences and an optional clock, so the
     clamp fills shape and stops the clock at zero. Zero means "now" and is
     a state worth sitting in — it is not an expiry. */
  if (!Array.isArray(st.watch)) st.watch = [];
  st.watch.forEach(function (e) {
    if (!e.id) e.id = uid("w");
    ["who", "what", "outcome", "note"].forEach(function (k) {
      e[k] = typeof e[k] === "string" ? e[k] : "";
    });
    e.kind = WATCH_KINDS.indexOf(e.kind) >= 0 ? e.kind : "effect";
    e.unit = e.unit === "turns" ? "turns" : "rounds";
    e.left = (typeof e.left === "number" && isFinite(e.left)) ? Math.max(0, Math.round(e.left)) : null;
  });

  if (!Array.isArray(st.calendar.events)) st.calendar.events = [];
  if (!Array.isArray(st.calendar.acked)) st.calendar.acked = [];
  /* Acknowledgements are write-once bookkeeping — keep the newest and
     let the rest go, so a long campaign never bloats the save. */
  if (st.calendar.acked.length > 300) {
    st.calendar.acked = st.calendar.acked.slice(-300);
  }
}

/* ============================================================
   CALENDAR EVENTS & REMINDERS
   A dated note fires once, when the party's date reaches it — including
   dates you jumped clean over with a week-long rest, which is exactly
   when you'd otherwise forget the tribute was due. Acknowledging is
   what silences it, not merely seeing it go by.
   ============================================================ */

/* How far back an un-acknowledged reminder keeps asking. Your own notes
   are worth chasing for a while; a holiday you rode past two months ago
   is just history, and the year browser still lists it. */
const REMIND_LOOKBACK_NOTE = 60;
const REMIND_LOOKBACK_HOLIDAY = 7;
/* Holidays have no per-note lead field, so they get a standing one. */
const HOLIDAY_LEAD = 3;

function calNow(st) {
  const c = st.calendar;
  return { day: c.day, year: c.year, time: c.timeOfDay };
}

/* Where the calendar tab is pointed. Falls back to the live date. */
function calCursor() {
  return {
    day: UI.cal.day == null ? S.calendar.day : UI.cal.day,
    year: UI.cal.year == null ? S.calendar.year : UI.cal.year
  };
}
function cursorIsToday() {
  const c = calCursor();
  return c.day === S.calendar.day && c.year === S.calendar.year;
}

function ackKey(year, day, id) { return year + ":" + day + ":" + id; }
function holidayId(systemKey, holiday) { return "holiday:" + systemKey + ":" + holiday.name; }

/* Everything dated, as one list: the player's own notes plus both
   calendars' holidays, normalized to the same shape so the reminder
   engine doesn't care which is which. */
function calAllDated(st) {
  const out = (st.calendar.events || []).map(function (ev) {
    return { id: ev.id, day: ev.day, year: ev.year, timeOfDay: ev.timeOfDay || null,
             title: ev.title, lead: ev.lead || 0, kind: "note", event: ev };
  });
  Object.keys(CAL.systems).forEach(function (k) {
    CAL.systems[k].holidays.forEach(function (h) {
      out.push({ id: holidayId(k, h), day: h.day, year: null, timeOfDay: null,
                 title: h.name, lore: h.lore, lead: HOLIDAY_LEAD,
                 kind: "holiday", system: k, systemLabel: CAL.systems[k].label });
    });
  });
  return out;
}

/* Notes and holidays landing on one specific day, sorted by time of day
   (all-day entries first). Used by every view that draws a day. */
function calEntriesFor(st, day, year) {
  const d = CAL.normalizeDay(day);
  return calAllDated(st).filter(function (e) {
    return CAL.normalizeDay(e.day) === d && (e.year == null || e.year === year);
  }).sort(function (a, b) {
    return CAL.timeIndex(a.timeOfDay) - CAL.timeIndex(b.timeOfDay);
  });
}

/* The two halves of the reminder banner: what has come due and not been
   acknowledged, and what is close enough ahead to warn about. */
function calReminders(st) {
  const now = calNow(st);
  const acked = st.calendar.acked || [];
  const due = [], soon = [];
  calAllDated(st).forEach(function (e) {
    const p = CAL.placeEvent(e, now);
    const lookback = e.kind === "holiday" ? REMIND_LOOKBACK_HOLIDAY : REMIND_LOOKBACK_NOTE;
    /* "Evening, today" hasn't arrived at Midday — it's still a warning,
       not yet a reminder. A note with no time arrives with the day. */
    const arrived = p.past ||
      (p.inDays === 0 && CAL.timeIndex(e.timeOfDay) <= CAL.timeIndex(now.time));
    if (arrived) {
      if (p.inDays < -lookback) return;
      if (acked.indexOf(ackKey(p.stamp.year, p.stamp.day, e.id)) >= 0) return;
      due.push({ entry: e, stamp: p.stamp, inDays: p.inDays });
    } else if (p.inDays === 0 || (e.lead > 0 && p.untilNext <= e.lead)) {
      soon.push({ entry: e, stamp: p.stamp, inDays: p.untilNext });
    }
  });
  /* Oldest first — the thing you rode past longest ago is the thing
     most likely to have been missed. */
  due.sort(function (a, b) { return a.inDays - b.inDays; });
  soon.sort(function (a, b) { return a.inDays - b.inDays; });
  return { due: due, soon: soon };
}

/* ---------- SMALL HELPERS ----------------------------------- */
/* One id generator for everything the player creates. Time plus a little
   randomness: two records made in the same millisecond still differ, and
   the prefix says at a glance what a stray id in a save file belongs to. */
function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}
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
  /* The arrow is its own element so a card can drop it and keep the word.
     Inside a card the control's position already says what it is, and the
     two characters were the difference between the secondary buttons
     sharing a row and each taking one. */
  return '<button class="wikibtn" data-act="wiki" data-slug="' + esc(slug) +
    '" title="Open on the wiki" aria-label="Open ' + esc(slug) +
    ' on the wiki">wiki<span class="wkar"> ↗</span></button>';
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

  /* Switching tabs also records where you were in that group, so the
     group button can put you back rather than at the front of it. */
  tab(el) {
    const t = el.dataset.tab;
    mutate(function (st) {
      st.ui = st.ui || {};
      st.ui.tab = t;
      st.ui.lastTab = st.ui.lastTab || {};
      st.ui.lastTab[tabGroupOf(t).id] = t;
    });
  },
  tabGroup(el) { ACT.tab({ dataset: { tab: el.dataset.go } }); },

  /* Wiki is now a deliberate, separate action — never the default
     result of tapping a name. */
  wiki(el) {
    const slug = el.dataset.slug;
    const url = wiki(slug);
    if (url) window.open(url, "_blank", "noopener");
  },
  portraitView() { UI.modal = { type: "portrait" }; render(); },

  toggleRail() { mutate(function (st) { st.toggles.railCollapsed = !st.toggles.railCollapsed; }); },
  toggleLeftRail() { mutate(function (st) { st.toggles.leftRailCollapsed = !st.toggles.leftRailCollapsed; }); },

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

  /* Folding is per panel AND per tab, and it outlives a reload.

     Panels that have a meaningful middle ground cycle through three states
     rather than two: full → condensed → hidden → full. Skills is the case
     that asked for it — all eighteen is the right default, but "just the
     ones I'm proficient in" is what you want nine times in ten, and it
     shouldn't cost a second control to get there.

     State 1 is condensed and 2 is hidden, fixed rather than sequential, so
     a two-state panel stores the same 2 a three-state one does. Sheets
     saved before this existed stored `true`; that reads as hidden. */
  foldPanel(el) {
    const k = el.dataset.key;
    const steps = parseInt(el.dataset.steps, 10) === 3 ? 3 : 2;
    mutate(function (st) {
      st.ui = st.ui || {};
      st.ui.folded = st.ui.folded || {};
      const cur = st.ui.folded[k] === true ? 2 : (st.ui.folded[k] || 0);
      const next = steps === 3 ? (cur + 1) % 3 : (cur === 0 ? 2 : 0);
      if (next === 0) delete st.ui.folded[k]; else st.ui.folded[k] = next;
    });
  },

  /* Expand or collapse every entry in one panel, or across the whole
     centre column when scoped to the tab. Entries default closed, which is
     right when you're hunting one spell and wrong when you're reading
     through all of them. */
  expandAll(el) {
    const scope = el.dataset.scope === "tab"
      ? document.querySelector(".wrap > div:nth-child(2)")
      : el.closest(".pnl");
    if (!scope) return;
    const on = el.dataset.on === "1";
    entryToggleIds(scope).forEach(function (id) {
      if (on) UI.expanded[id] = true; else delete UI.expanded[id];
    });
    render();
  },

  /* ---- Resources ---- */
  loh(el) {
    const d = parseInt(el.dataset.d, 10);
    mutate(function (st) { st.resources.layOnHands += d; });
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
  /* ---- Summoned followers ---- */

  /* Casting a summon opens this instead of resolving immediately — the
     spell asks you questions, and nothing is spent until you answer
     them and press Summon. Cancel costs nothing. */
  summonModal(el) {
    const key = el.dataset.spell || "findSteed";
    const src = FOLLOWER_SOURCES[key];
    if (!src) return;
    const steed = key === "findSteed";
    const existing = S.followers.filter(function (f) { return f.source === key; })[0];
    const freeRes = steed ? "faithfulSteed" : "findFamiliar";
    const defaultForm = steed ? STEED_FORMS[0] : "cat";
    UI.modal = {
      type: "summon", source: key,
      pick: {
        /* Recasting offers back what you had — both spells explicitly
           let you bring back the one you lost. */
        form: existing ? existing.form : defaultForm,
        custom: steed && existing && STEED_FORMS.indexOf(existing.form) < 0 ? existing.form : "",
        name: existing ? existing.name : "",
        creatureType: existing ? existing.creatureType : "celestial",
        level: src.baseLevel,
        /* A ritual costs no slot, which makes it the sensible default
           for the one spell that offers it. */
        ritual: !steed && !!SPELLS[src.spell].ritual,
        free: steed && (S.resources[freeRes] || 0) > 0
      }
    };
    render();
  },
  summonType(el) { UI.modal.pick.creatureType = el.dataset.key; render(); },
  summonForm(el) { UI.modal.pick.form = el.value; render(); },
  summonField(el) { UI.modal.pick[el.dataset.field] = el.value; render(); },
  summonPower(el) {
    UI.modal.pick.ritual = el.dataset.ritual === "1";
    UI.modal.pick.free = el.dataset.free === "1";
    UI.modal.pick.level = parseInt(el.dataset.lv, 10) || FOLLOWER_SOURCES[UI.modal.source].baseLevel;
    render();
  },
  summonApply() {
    const m = UI.modal, src = FOLLOWER_SOURCES[m.source];
    const pick = m.pick;
    const steed = m.source === "findSteed";
    /* Read the live fields, so an edit that was never blurred still counts. */
    const el = function (id) { return document.getElementById(id); };
    const custom = steed && el("summon-custom") ? (el("summon-custom").value || "").trim() : "";
    const form = custom || (el("summon-form") ? el("summon-form").value : pick.form);
    const name = ((el("summon-name") ? el("summon-name").value : pick.name) || "").trim() ||
                 src.defaultName;
    const lv = (pick.free || pick.ritual) ? src.baseLevel : pick.level;
    const block = CALC.followerBlock(S, {
      source: m.source, spellLevel: lv, creatureType: pick.creatureType, form: form
    });
    if (!block) return;
    const freeRes = steed ? "faithfulSteed" : "findFamiliar";
    UI.modal = null;
    mutate(function (st) {
      /* Pay for it — the one place a summon costs anything. A ritual
         costs no slot at all, which is the point of casting it that way. */
      if (pick.ritual) { /* nothing spent */ }
      else if (pick.free) {
        st.resources[freeRes] = Math.max(0, (st.resources[freeRes] || 0) - 1);
      } else {
        if (!st.resources.slots[lv]) st.resources.slots[lv] = { used: 0 };
        st.resources.slots[lv].used += 1;
      }
      if (st.combat.active && !pick.ritual) {
        st.combat.turn.action = true;
        if (!pick.free) st.combat.turn.slotUsed = true;
      }
      /* Only one steed, and only one familiar. */
      if (src.unique) {
        st.followers = st.followers.filter(function (f) { return f.source !== m.source; });
      }
      st.followers.push({
        id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        source: m.source, name: name, form: form,
        creatureType: pick.creatureType, spellLevel: lv,
        hp: block.maxHP, tempHP: 0, baUsed: false, stowed: false,
        summoned: calStamp(st)
      });
    }, "Summon " + name);
    UI.alert = { info: name + " answers — " + block.type.name + " " +
      block.formLabel.toLowerCase() + ", AC " + block.ac + ", " + block.maxHP +
      " HP. Undo is in the top bar if that was a misfire." };
    render();
  },
  /* "As a Magic action you can temporarily dismiss the familiar to a
     pocket dimension" — and bring it back the same way. */
  followerStow(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      const f = st.followers.filter(function (x) { return x.id === id; })[0];
      if (f) f.stowed = !f.stowed;
    }, "Stow/recall follower");
  },

  followerDamageModal(el) {
    UI.modal = { type: "followerDamage", id: el.dataset.id };
    render();
  },
  followerDamage(el) {
    const heal = el.dataset.heal === "1";
    const id = UI.modal.id;
    const n = Math.max(0, parseInt(document.getElementById("fol-dmg").value, 10) || 0);
    if (!n) return;
    const f = S.followers.filter(function (x) { return x.id === id; })[0];
    const name = f ? f.name : "The summon";
    UI.modal = null;
    mutate(function (st) {
      const t = st.followers.filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      if (heal) {
        const b = CALC.followerBlock(st, t);
        t.hp = Math.min(b.maxHP, t.hp + n);
      } else {
        const soak = Math.min(t.tempHP || 0, n);
        t.tempHP = (t.tempHP || 0) - soak;
        t.hp = Math.max(0, t.hp - (n - soak));
      }
    }, (heal ? "Heal " : "Damage ") + name);
    /* clampState removes anything that hit 0 — say so rather than
       letting a card silently vanish from the rail. */
    if (!S.followers.some(function (x) { return x.id === id; })) {
      UI.alert = { info: name + " drops to 0 Hit Points and disappears, leaving behind anything it carried." };
    }
    render();
  },
  followerBonus(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      const f = st.followers.filter(function (x) { return x.id === id; })[0];
      if (f) f.baUsed = !f.baUsed;
    }, "Follower bonus action");
  },
  followerName(el) {
    const id = el.dataset.id, v = el.value;
    mutate(function (st) {
      const f = st.followers.filter(function (x) { return x.id === id; })[0];
      if (f) f.name = v;
    });
  },
  followerDismiss(el) {
    const id = el.dataset.id;
    const f = S.followers.filter(function (x) { return x.id === id; })[0];
    mutate(function (st) {
      st.followers = st.followers.filter(function (x) { return x.id !== id; });
    }, "Dismiss " + (f ? f.name : "follower"));
  },

  /* ---- Calendar ---- */
  advanceTime() {
    mutate(function (st) {
      const n = CAL.nextTime(st.calendar.timeOfDay);
      st.calendar.timeOfDay = n.key;
      if (n.rolledOver) {
        const adv = CAL.advance(st.calendar.day, st.calendar.year, 1);
        st.calendar.day = adv.day; st.calendar.year = adv.year;
      }
    });
  },
  advanceDay(el) {
    const d = parseInt(el.dataset.d, 10) || 0;
    mutate(function (st) {
      const adv = CAL.advance(st.calendar.day, st.calendar.year, d);
      st.calendar.day = adv.day; st.calendar.year = adv.year;
    });
  },
  calSystem(el) {
    const k = el.dataset.key;
    mutate(function (st) { st.calendar.system = k; });
  },

  /* Setting the date outright, rather than stepping to it. Each of these
     leaves the other parts of the date alone — changing the year does
     not move the day, and picking a month keeps the day-of-month where
     it can, so correcting one field never quietly rewrites another.

     The browsing cursor is released afterwards: having just set the
     party's date, what you want to look at is that date. */
  calSetYear(el) {
    const y = parseInt(el.value, 10);
    if (isNaN(y)) return;
    mutate(function (st) { st.calendar.year = y; });
    UI.cal.day = null; UI.cal.year = null;
    render();
  },

  calJumpMonth(el) {
    const i = parseInt(el.value, 10);
    mutate(function (st) {
      const mo = CAL.system(st.calendar.system).months[i];
      if (!mo) return;
      /* Jerbeen months are 28 days and Common ones 30, so the day you
         were on may not exist in the month you picked. Land on the last
         day of it rather than overshooting into the next. */
      const dom = CAL.dayOfMonth(st.calendar.system, st.calendar.day);
      st.calendar.day = mo.start + Math.min(dom, mo.end - mo.start + 1) - 1;
    });
    UI.cal.day = null; UI.cal.year = null;
    render();
  },

  calSetDayOfMonth(el) {
    const d = parseInt(el.value, 10);
    if (isNaN(d)) return;
    mutate(function (st) {
      const mo = CAL.monthFor(st.calendar.system, st.calendar.day);
      const len = mo.end - mo.start + 1;
      st.calendar.day = mo.start + Math.max(1, Math.min(len, d)) - 1;
    });
    UI.cal.day = null; UI.cal.year = null;
    render();
  },

  /* ---- Calendar browsing (the cursor, not the date) ---- */
  calView(el) {
    const v = el.dataset.view;
    mutate(function (st) { st.calendar.view = v; });
  },
  /* Step the cursor by whole days. */
  calStep(el) {
    const d = parseInt(el.dataset.d, 10) || 0;
    const c = calCursor();
    const adv = CAL.advance(c.day, c.year, d);
    UI.cal.day = adv.day; UI.cal.year = adv.year;
    render();
  },
  /* Step whole months, whose length varies by system (28, 30, or the
     Convergence's 4) — so ask the calendar rather than assuming. */
  calStepMonth(el) {
    const dir = parseInt(el.dataset.d, 10) || 1;
    const c = calCursor();
    const target = CAL.monthStep(S.calendar.system, c.day, dir);
    /* Landing before where we started means the year rolled. */
    const wrapped = dir < 0 ? target > c.day : target < c.day;
    UI.cal.day = target;
    UI.cal.year = c.year + (wrapped ? dir : 0);
    render();
  },
  calGoto(el) {
    UI.cal.day = parseInt(el.dataset.day, 10);
    UI.cal.year = parseInt(el.dataset.year, 10);
    render();
  },
  /* From a reminder anywhere in the app straight to that day's page. */
  calOpen(el) {
    UI.cal.day = parseInt(el.dataset.day, 10);
    UI.cal.year = parseInt(el.dataset.year, 10);
    mutate(function (st) {
      st.ui = st.ui || {};
      st.ui.tab = "calendar";
      st.calendar.view = "day";
    });
  },
  calToday() { UI.cal.day = null; UI.cal.year = null; render(); },

  /* Move the party's actual date to the day being browsed. The one place
     browsing turns into time passing, so it's an explicit button. */
  calSetDate() {
    const c = calCursor();
    mutate(function (st) { st.calendar.day = c.day; st.calendar.year = c.year; });
    UI.cal.day = null; UI.cal.year = null;
    render();
  },

  /* ---- Dated notes ---- */
  calAddNote() {
    const title = (document.getElementById("cal-note").value || "").trim();
    if (!title) return;
    const time = document.getElementById("cal-note-time").value;
    const repeat = document.getElementById("cal-note-repeat").value;
    const lead = Math.max(0, Math.min(60, parseInt(document.getElementById("cal-note-lead").value, 10) || 0));
    const c = calCursor();
    mutate(function (st) {
      st.calendar.events.push({
        id: "ev" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        day: c.day,
        year: repeat === "yearly" ? null : c.year,
        timeOfDay: time || null,
        title: title,
        lead: lead
      });
    });
  },
  calDeleteNote(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      st.calendar.events = st.calendar.events.filter(function (e) { return e.id !== id; });
      /* Its acknowledgements are dead weight once the note is gone. */
      st.calendar.acked = st.calendar.acked.filter(function (k) {
        return k.slice(k.indexOf(":", k.indexOf(":") + 1) + 1) !== id;
      });
    });
  },

  /* Acknowledging is per occurrence, so a yearly note comes back around
     next year rather than being silenced forever. */
  calAck(el) {
    const key = el.dataset.key;
    mutate(function (st) {
      if (st.calendar.acked.indexOf(key) < 0) st.calendar.acked.push(key);
    });
  },
  calAckAll() {
    const r = calReminders(S);
    mutate(function (st) {
      r.due.forEach(function (d) {
        const key = ackKey(d.stamp.year, d.stamp.day, d.entry.id);
        if (st.calendar.acked.indexOf(key) < 0) st.calendar.acked.push(key);
      });
    });
  },

  /* Resting is where in-world time usually moves, so it asks rather than
     assuming — some rests are "we camp and push on", others skip a week. */
  longRestPrompt() { UI.modal = { type: "restDays" }; render(); },
  longRest() {
    const el = document.getElementById("rest-days");
    const days = el ? Math.max(0, Math.min(365, parseInt(el.value, 10) || 0)) : 0;
    const from = UI.modal && UI.modal.from;
    mutate(function (st) {
      st.currentHP = CALC.maxHP(st).value;
      st.tempHP = 0;
      st.resources.layOnHands = CALC.layOnHandsMax(st).value;
      st.resources.channelDivinity = CALC.channelDivinityMax(st).value;
      st.resources.freeSmite = 1;
      st.resources.findFamiliar = 1;
      st.resources.detectThoughts = 1;
      /* Faithful Steed: "regaining that use on a Long Rest" — it was the
         one once-per-rest resource the rest never gave back. */
      if (st.level >= 5) st.resources.faithfulSteed = 1;
      /* A summon's signature Bonus Action recharges on the same rest.
         The summon itself doesn't expire — Find Steed is Instantaneous,
         so the steed stays until it drops or you do. */
      st.followers.forEach(function (f) { f.baUsed = false; });
      Object.keys(st.resources.slots).forEach(function (lv) { st.resources.slots[lv].used = 0; });
      st.hitDiceUsed = Math.max(0, st.hitDiceUsed - Math.max(1, Math.floor(st.level / 2)));
      st.toggles.concentrating = false;
      st.toggles.concentratingOn = "";
      st.deathSaves = { successes: 0, failures: 0 };
      st.conditions = st.conditions.filter(function (c) { return c !== "unconscious"; });
      if (st.exhaustion > 0) st.exhaustion -= 1;
      if (days > 0) {
        const adv = CAL.advance(st.calendar.day, st.calendar.year, days);
        st.calendar.day = adv.day;
        st.calendar.year = adv.year;
        st.calendar.timeOfDay = "morning";
        logFlag(st, days === 1 ? "A day passes — now " + CAL.format(st.calendar.system, st.calendar.day)
                               : days + " days pass — now " + CAL.format(st.calendar.system, st.calendar.day));
      }
    }, "Long rest");
    UI.modal = { type: "longRest", daysPassed: days, from: from };
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

  /* ---- Map ----
     Camera and selection are UI-only and re-render without a save; the
     things that change the world go through mutate like everything
     else, which is what puts them in the export and the cloud backup. */
  mapPin(el) { UI.map.sel = el.dataset.id; render(); },
  mapMode(el) { UI.map.mode = el.dataset.mode; render(); },
  mapLabels() { mutate(function (st) { st.map.showLabels = !st.map.showLabels; }); },

  mapFilter(el) {
    const k = el.dataset.key;
    mutate(function (st) {
      st.map.off = st.map.off || {};
      if (st.map.off[k]) delete st.map.off[k]; else st.map.off[k] = true;
    });
  },
  mapFilterAll() { mutate(function (st) { st.map.off = {}; }); },
  mapSearch(el) { UI.map.q = el.value; render(); },
  mapSearchClear() { UI.map.q = ""; render(); },

  mapZoom(el) {
    const d = parseInt(el.dataset.d, 10);
    mapSetZoom(UI.map.zoom * (d > 0 ? 1.5 : 1 / 1.5));
    render();
  },
  mapFit() { UI.map.zoom = 1; UI.map.x = 0; UI.map.y = 0; render(); },

  /* Centre the view on a pin without changing the zoom — the "where is
     that?" answer for a place you found in the atlas. */
  mapFocus(el) {
    const p = mapPin(el.dataset.id);
    if (!p) return;
    const view = document.querySelector(".mapview");
    if (view) {
      const w = view.clientWidth, h = view.clientHeight, z = UI.map.zoom;
      UI.map.x = w / 2 - (p.x / 100) * w * z;
      UI.map.y = h / 2 - (p.y / 100) * h * z;
      mapClampPan(w, h);
    }
    UI.map.sel = p.id;
    render();
  },

  mapPartyHere(el) {
    const p = mapPin(el.dataset.id);
    if (!p) return;
    /* Where the party went is worth having in the session log, so the
       export reads as a journey and not just a list of fights. */
    mutate(function (st) {
      st.map.party = { x: p.x, y: p.y };
      logWorld(st, null, "The party is at " + p.name);
    });
  },
  mapClearParty() {
    mutate(function (st) { st.map.party = null; });
    if (UI.map.sel === "__party") UI.map.sel = null;
  },

  mapRename(el) {
    const id = el.dataset.id, name = el.value.trim();
    if (!name) return;
    mutate(function (st) {
      const c = st.map.custom.filter(function (k) { return k.id === id; })[0];
      if (c) {
        c.name = name;
        const near = mapNearest(c.x, c.y, c.id);
        logWorld(st, "map:" + id, "Marker placed: " + name +
          (near ? " — near " + near.name : ""));
        return;
      }
      const was = mapPin(id);
      st.map.edits[id] = Object.assign({}, st.map.edits[id], { name: name });
      logWorld(st, "rename:" + id, "Renamed " + (was ? was.name : id) + " to " + name);
    });
  },

  mapHide(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      st.map.edits[id] = Object.assign({}, st.map.edits[id], { hidden: true });
    });
    if (UI.map.sel === id) UI.map.sel = null;
    render();
  },
  mapRestore(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      if (st.map.edits[id]) delete st.map.edits[id].hidden;
    });
  },
  /* Puts a canonical pin back exactly as the data file has it. */
  mapReset(el) {
    const id = el.dataset.id;
    mutate(function (st) { delete st.map.edits[id]; });
  },
  mapDelete(el) {
    const id = el.dataset.id;
    const gone = mapPin(id);
    mutate(function (st) {
      logWorld(st, "del:" + id, "Marker removed: " + (gone ? gone.name : id));
      st.map.custom = st.map.custom.filter(function (c) { return c.id !== id; });
      st.map.notes[id] && delete st.map.notes[id];
      st.map.lore = st.map.lore.filter(function (l) { return l.scope !== id; });
    });
    if (UI.map.sel === id) UI.map.sel = null;
    render();
  },

  mapNote(el) {
    const id = el.dataset.id, v = el.value;
    const where = mapScopeName(id);
    mutate(function (st) {
      if (v.trim()) {
        st.map.notes[id] = v;
        logWorld(st, "note:" + id, "Notes on " + where + ": " + shortenNote(v));
      } else {
        delete st.map.notes[id];
      }
    });
  },

  mapLoreAdd(el) {
    const scope = el.dataset.scope;
    const tEl = document.querySelector('[data-lore-title="' + scope + '"]');
    const bEl = document.querySelector('[data-lore-body="' + scope + '"]');
    const title = tEl ? tEl.value.trim() : "";
    const body = bEl ? bEl.value.trim() : "";
    if (!title && !body) return;
    const id = newPinId();
    mutate(function (st) {
      st.map.lore.push({ id: id, scope: scope,
                         title: title || "Untitled", body: body });
      logWorld(st, "lore:" + id, "Lore added — “" + (title || "Untitled") +
        "” on " + mapScopeName(scope) +
        (body ? ": " + shortenNote(body) : ""));
    });
  },
  mapLoreDelete(el) {
    const id = el.dataset.id;
    const gone = S.map.lore.filter(function (l) { return l.id === id; })[0];
    mutate(function (st) {
      st.map.lore = st.map.lore.filter(function (l) { return l.id !== id; });
      logWorld(st, "loredel:" + id, "Lore removed — “" +
        (gone ? gone.title : id) + "”");
    });
  },

  /* ---- Watching everyone else's effects ----
     A notebook, so every one of these is one field and a re-render. The
     only judgement anywhere is that adding with nothing typed does
     nothing rather than making a blank row. */
  watchAdd() {
    function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
    const who = val("watch-who").trim(), what = val("watch-what").trim();
    if (!who && !what) return;
    const rawLeft = parseInt(val("watch-left"), 10);
    const id = uid("w");
    const kind = WATCH_KINDS.indexOf(val("watch-kind")) >= 0 ? val("watch-kind") : "effect";
    const unit = val("watch-unit") === "turns" ? "turns" : "rounds";
    const left = isFinite(rawLeft) && rawLeft >= 0 ? rawLeft : null;
    mutate(function (st) {
      st.watch.push({ id: id, who: who, what: what, kind: kind, outcome: "",
                      left: left, unit: unit, note: "" });
    }, "Noted: " + [who, what].filter(Boolean).join(" — "));
    ["watch-who", "watch-what", "watch-left"].forEach(function (k) {
      const el = document.getElementById(k);
      if (el) el.value = "";
    });
    render();
  },
  watchEdit(el) {
    const id = el.dataset.id;
    if (UI.watch.edit[id]) delete UI.watch.edit[id]; else UI.watch.edit[id] = true;
    render();
  },
  watchDel(el) {
    const id = el.dataset.id;
    const gone = S.watch.filter(function (w) { return w.id === id; })[0];
    mutate(function (st) {
      st.watch = st.watch.filter(function (w) { return w.id !== id; });
    }, "Cleared: " + ((gone && (gone.who || gone.what)) || "note"));
    delete UI.watch.edit[id];
    render();
  },
  watchField(el) {
    const id = el.dataset.id, f = el.dataset.f, v = el.value;
    mutate(function (st) {
      const w = st.watch.filter(function (x) { return x.id === id; })[0];
      if (w) w[f] = v;
    });
  },
  watchKind(el) {
    const id = el.dataset.id, k = el.dataset.k;
    mutate(function (st) {
      const w = st.watch.filter(function (x) { return x.id === id; })[0];
      if (w && WATCH_KINDS.indexOf(k) >= 0) w.kind = k;
    });
  },
  watchUnit(el) {
    const id = el.dataset.id, u = el.value === "turns" ? "turns" : "rounds";
    mutate(function (st) {
      const w = st.watch.filter(function (x) { return x.id === id; })[0];
      if (w) w.unit = u;
    });
  },
  watchLeft(el) {
    const id = el.dataset.id;
    const n = el.value === "" ? null : parseInt(el.value, 10);
    mutate(function (st) {
      const w = st.watch.filter(function (x) { return x.id === id; })[0];
      if (w) w.left = (n == null || !isFinite(n)) ? null : Math.max(0, n);
    });
  },
  /* Nudging the clock by hand — and, on an entry that had none, starting
     one. Time passes outside combat too. */
  watchClock(el) {
    const id = el.dataset.id, d = parseInt(el.dataset.d, 10);
    mutate(function (st) {
      const w = st.watch.filter(function (x) { return x.id === id; })[0];
      if (!w) return;
      w.left = w.left == null ? 1 : Math.max(0, w.left + d);
    });
  },

  /* ---- Favourites ----
     Pinning is a pointer in a list, so all three of these are list
     surgery. Nothing here can spend a resource; using a favourite goes
     through the same use() everything else does. */
  favToggle(el) {
    const kind = el.dataset.kind, id = el.dataset.id;
    const i = favIndex(kind, id);
    mutate(function (st) {
      if (i >= 0) st.favourites.splice(i, 1);
      else st.favourites.push({ kind: kind, id: id });
    });
  },
  favEdit() { UI.expanded.favEdit = !UI.expanded.favEdit; render(); },
  favMove(el) {
    const i = parseInt(el.dataset.i, 10), d = parseInt(el.dataset.d, 10);
    mutate(function (st) {
      const j = i + d;
      if (i < 0 || j < 0 || i >= st.favourites.length || j >= st.favourites.length) return;
      const moved = st.favourites.splice(i, 1)[0];
      st.favourites.splice(j, 0, moved);
    });
  },

  /* Spending one of something. Deliberately separate from use(): an item
     has no action economy and no roll to prompt — it just goes down by
     one, which is the whole of what "consume" means here. */
  itemUse(el) {
    const id = el.dataset.id;
    const it = S.equipment.inventory.filter(function (x) { return x.id === id; })[0];
    if (!it || it.qty <= 0) return;
    mutate(function (st) {
      const item = st.equipment.inventory.filter(function (x) { return x.id === id; })[0];
      if (item && item.qty > 0) item.qty -= 1;
    }, "Used " + it.name);
  },

  /* ---- People ----
     Everything here writes one field and re-renders. Adding is the only
     one that does anything clever, and what it does is open the record it
     just made, because you added it in order to type into it. */
  peopleAdd(el) {
    const kind = el.dataset.kind === "group" ? "group" : "person";
    const box = document.getElementById("people-new");
    const name = box ? box.value.trim() : "";
    const id = uid(kind === "group" ? "g" : "p");
    mutate(function (st) {
      st.people.push({ id: id, kind: kind, name: name, standing: "unknown",
                       status: kind === "group" ? "unknown" : "alive",
                       fields: [], groups: [], note: "" });
      logWorld(st, "people:" + id, (kind === "group" ? "Group noted — " : "Person noted — ") +
        (name || "unnamed"));
    });
    /* Straight into the editor, and with the search cleared — a new
       record that a live filter immediately hides looks like a button
       that did nothing. */
    UI.people.edit[id] = true;
    UI.people.q = "";
    UI.people.standing = "";
    render();
  },
  peopleEdit(el) {
    const id = el.dataset.id;
    if (UI.people.edit[id]) delete UI.people.edit[id];
    else UI.people.edit[id] = true;
    render();
  },
  peopleDel(el) {
    const id = el.dataset.id;
    const gone = personById(id);
    mutate(function (st) {
      st.people = st.people.filter(function (p) { return p.id !== id; });
      /* clampState drops the dangling memberships; this is only the log. */
      logWorld(st, "peopledel:" + id, "Removed from your people — " +
        ((gone && gone.name) || id));
    });
    delete UI.people.edit[id];
    render();
  },
  peopleName(el) {
    const id = el.dataset.id, v = el.value;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.name = v;
      logWorld(st, "people:" + id, (p.kind === "group" ? "Group noted — " : "Person noted — ") +
        (v || "unnamed"));
    });
  },
  peopleNote(el) {
    const id = el.dataset.id, v = el.value;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (p) p.note = v;
    });
  },
  peopleField(el) {
    const id = el.dataset.id, i = parseInt(el.dataset.i, 10), part = el.dataset.part, v = el.value;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (p && p.fields[i]) p.fields[i][part] = v;
    });
  },
  peopleFieldAdd(el) {
    const id = el.dataset.id, k = el.dataset.k || "";
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (p) p.fields.push({ k: k, v: "" });
    });
  },
  peopleFieldDel(el) {
    const id = el.dataset.id, i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (p) p.fields.splice(i, 1);
    });
  },
  peopleStanding(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.standing = PEOPLE_STANDING[(PEOPLE_STANDING.indexOf(p.standing) + 1) % PEOPLE_STANDING.length];
    }, "Standing");
  },
  peopleStatus(el) {
    const id = el.dataset.id;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.status = PEOPLE_STATUS[(PEOPLE_STATUS.indexOf(p.status) + 1) % PEOPLE_STATUS.length];
    }, "Status");
  },
  peopleGroup(el) {
    const id = el.dataset.id, g = el.dataset.g;
    mutate(function (st) {
      const p = st.people.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      const i = p.groups.indexOf(g);
      if (i >= 0) p.groups.splice(i, 1); else p.groups.push(g);
    }, "Membership");
  },
  peopleSearch(el) { UI.people.q = el.value; render(); },
  peopleSearchClear() { UI.people.q = ""; render(); },
  /* Tapping a group chip on a person's card searches for that group —
     which lands you on the group itself and everyone else in it. */
  peopleSearchTo(el) { UI.people.q = el.dataset.q || ""; render(); },
  peopleFilter(el) {
    const v = el.dataset.v || "";
    UI.people.standing = (UI.people.standing === v) ? "" : v;
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
  /* ---- Tools ---- */
  toolAdd() {
    const sel = document.getElementById("tool-new");
    const k = sel ? sel.value : "";
    if (!k) return;
    const cat = TOOLS_2024[k];
    const id = uid("t");
    mutate(function (st) {
      st.tools.push(cat
        ? { id: id, key: k, name: cat.name, ability: cat.ability, expertise: false }
        : { id: id, key: null, name: "New proficiency", ability: "wis", expertise: false });
    }, "Add a proficiency");
  },
  toolName(el) {
    const i = parseInt(el.dataset.i, 10), v = el.value;
    mutate(function (st) { if (st.tools[i]) st.tools[i].name = v; });
  },
  toolAbility(el) {
    const i = parseInt(el.dataset.i, 10), v = el.value;
    mutate(function (st) { if (st.tools[i]) st.tools[i].ability = v; });
  },
  toolExpertise(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) { if (st.tools[i]) st.tools[i].expertise = !st.tools[i].expertise; });
  },
  toolDel(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) { st.tools.splice(i, 1); }, "Remove a proficiency");
  },

  addItem() {
    mutate(function (st) {
      st.equipment.inventory.push({ id: uid("i"), name: "New item", qty: 1, tags: [],
                                    note: "", consumable: false });
    });
  },
  itemConsumable(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const it = st.equipment.inventory[i];
      if (it) it.consumable = !it.consumable;
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
     Safari/WebKit this app targets) actually reflows everything.

     100% is the size the sheet is designed to be read at, and that is
     what the stylesheet's own numbers render at times UI_SCALE_BASE. The
     baseline exists because the sheet was always actually used at 80% —
     so 80% is what the layout should be tuned against, and calling that
     size "100%" is the honest way to say it. */
  document.body.style.zoom =
    (((S.settings && S.settings.uiScale) || 100) * UI_SCALE_BASE) + "%";

  /* How much room the layout actually has is the viewport divided by the
     zoom, and a media query cannot see that — it only ever measures the
     device viewport. Left as a media query, the compact chrome fired on a
     1080px iPad that, at this scale, is laying out 1350px wide and has
     room to spare; and it would fail to fire on someone who had scaled
     the sheet up until it was genuinely cramped. So the decision is made
     here, where the real number is available, and carried as a class.
     body.clientWidth is the one measurement that reports post-zoom
     layout width rather than device pixels. */
  /* A zero here means nothing has been laid out yet rather than "no room
     at all", so fall back to the roomy layout instead of collapsing to a
     single column on the strength of a measurement we did not get. */
  /* vh units resolve against the device viewport, which under zoom is a
     different number from the height the stylesheet lays out in — at 80%
     a 740px screen is 925px of layout, so 88vh capped a modal at 651 when
     880 would fit, and pushed its footer into a scroll area. Publish the
     real figure so CSS can size against it. */
  const zoomFactor = (((S.settings && S.settings.uiScale) || 100) * UI_SCALE_BASE) / 100;
  document.documentElement.style.setProperty(
    "--appvh", (window.innerHeight / (zoomFactor || 1)) + "px");

  const layoutWidth = document.body.clientWidth || document.documentElement.clientWidth || 99999;
  document.body.classList.toggle("compact", layoutWidth < 1150);
  /* How many columns there is room for, decided on the same measurement
     and for the same reason. Portrait on this iPad is 810 device pixels
     but lays out at 1012 — a media query would see the 810 and drop to
     the phone stack, when there is comfortably room for the content
     beside its resources. */
  document.body.classList.toggle("twocol", layoutWidth >= 780 && layoutWidth < 1150);
  document.body.classList.toggle("onecol", layoutWidth < 780);
  const app = document.getElementById("app");
  const tab = (S.ui && S.ui.tab) || "combat";
  app.innerHTML =
    topBar() +
    conditionStrip() +
    alertBar() +
    reminderBar() +
    tabBar(tab) +
    '<div class="wrap' + (S.toggles.railCollapsed ? " railoff" : "") +
      (S.toggles.leftRailCollapsed ? " leftoff" : "") + '">' +
      '<div class="rail lrail">' +
        '<div class="railtab" data-act="toggleLeftRail"><span>Stats</span></div>' +
        '<div class="railbody">' + leftRail() + '</div>' +
      '</div>' +
      '<div>' + tabContent(tab) + '</div>' +
      '<div class="rail rrail">' +
        '<div class="railtab" data-act="toggleRail"><span>Resources</span></div>' +
        '<div class="railbody">' + resourceRail() + '</div>' +
      '</div>' +
    '</div>' +
    '<input type="file" id="import-file" accept="application/json" class="hide" data-act="doImport">';
  paintModal(modalHTML());
  applyPanelFolds();
}

/* Rewriting a modal's markup throws away where it was scrolled to, and
   every state change in the app re-renders — so tapping anything inside a
   long modal used to jump it back to the top. On a mouse that is an
   annoyance; on an iPad, where the same gesture is also how you scroll, it
   reads as the modal refusing to scroll at all.

   So the scroll position is carried across the rewrite. Cheap, and it
   makes a modal behave like a document rather than like something being
   rebuilt underneath you. */
function paintModal(html) {
  const root = document.getElementById("modal-root");
  /* A modal that combat.js owns gets painted TWICE in one render: this
     file writes an empty shell first, because modalHTML() doesn't know
     that type, and combat.js writes the real one a moment later. So the
     position cannot be read off the element on the way in — by the second
     paint the element it was on has already been thrown away. It is kept
     here instead, and only forgotten when the modal actually closes. */
  const old = root.querySelector(".mask");
  if (!UI.modal) {
    /* Closing. Forget where it was — the next modal is a different
       document and should open at the top. Written as an else, because
       the mask is still on screen at this moment with its old position
       on it, and saving that would undo the forgetting. */
    UI.modalScroll = 0;
  } else if (old && old.scrollTop) {
    UI.modalScroll = old.scrollTop;
  }

  root.innerHTML = html;

  const mask = root.querySelector(".mask");
  if (!mask || !UI.modalScroll) return;
  /* Reading scrollHeight forces the layout that setting innerHTML just
     invalidated. Without it the element is still zero-height at this
     instant, so assigning scrollTop clamps to 0 and the restore is a
     no-op — which looks exactly like not having written this at all. */
  void mask.scrollHeight;
  mask.scrollTop = UI.modalScroll;
}

/* ---------- PER-TAB PANEL FOLDING ----------
   Every panel folds, and each one remembers its own state per tab: the
   rails render on all seven, so "Prepared" can be shut on Combat and
   open on Spells and stay that way. Done as a pass over the finished
   DOM rather than by touching thirty call sites — which also means
   panels injected later by combat.js are covered for free.

   The key is the panel's heading text, so it survives a re-render but
   not a rename; a renamed panel simply starts open again. */
function panelKey(pnl) {
  const h = pnl.querySelector(":scope > h3");
  if (!h) return null;
  let label = "";
  h.childNodes.forEach(function (n) {
    if (n.nodeType === 3) label += n.textContent;                     /* text only */
    else if (n.tagName === "SPAN" && !n.classList.contains("cnt")) label += n.textContent;
  });
  label = label.replace(/\s+/g, " ").trim().toLowerCase();
  if (!label) return null;
  /* Which column it lives in, because "Prepared" exists both in the rail
     and in the Spells tab and they must fold independently. */
  const scope = pnl.closest(".rrail") ? "rail" : (pnl.closest(".lrail") ? "lrail" : "main");
  return scope + "/" + label.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* Every entry-level "More" toggle inside a scope, deduplicated. A spell row
   carries the same data-id on its name and its More button, and the panel
   chrome (the More drawer, the Filter/Party/Creatures collapses) uses the
   same action for something that isn't an entry — so both get filtered out
   rather than swept up by an Expand all. */
function entryToggleIds(scope) {
  const ids = [];
  Array.prototype.forEach.call(scope.querySelectorAll('[data-act="expand"][data-id]'), function (b) {
    const id = b.dataset.id;
    if (!id || id === "moreActions" || /Collapsed$/.test(id)) return;
    if (ids.indexOf(id) < 0) ids.push(id);
  });
  return ids;
}

function applyPanelFolds() {
  const tab = (S.ui && S.ui.tab) || "combat";
  const folded = (S.ui && S.ui.folded) || {};
  Array.prototype.forEach.call(document.querySelectorAll("#app .pnl"), function (pnl) {
    const h = pnl.querySelector(":scope > h3");
    if (!h) return;
    /* Leave panels that already own a collapse control alone — the rails
       and the calendar browser have their own, with their own meaning. */
    if (h.classList.contains("collapse")) return;
    if (h.querySelector('[data-act="expand"], [data-act="toggleRail"], [data-act="toggleLeftRail"]')) return;
    if (h.querySelector(".pcol")) return;
    const key = panelKey(pnl);
    if (!key) return;
    const full = tab + "/" + key;
    /* A panel opts into the middle state by naming it — the label is what
       the condensed view shows, so the button can say where a tap goes
       instead of the useless "Hide" three times over. */
    const condLabel = pnl.dataset.condense || "";
    const steps = condLabel ? 3 : 2;
    const raw = folded[full];
    const state = raw === true ? 2 : (raw || 0);
    if (state === 2) pnl.classList.add("folded");
    else if (state === 1 && condLabel) pnl.classList.add("condensed");

    /* Expand all rides in the same header, but only where there is
       something to expand and the panel is actually showing. */
    if (state !== 2) {
      const ids = entryToggleIds(pnl);
      if (ids.length >= 2) {
        const anyClosed = ids.some(function (id) { return !UI.expanded[id]; });
        const eb = document.createElement("button");
        eb.className = "pcol";
        eb.dataset.act = "expandAll";
        eb.dataset.on = anyClosed ? "1" : "0";
        eb.textContent = anyClosed ? "Expand all" : "Collapse all";
        eb.title = (anyClosed ? "Open" : "Close") + " all " + ids.length + " entries in this panel";
        h.appendChild(eb);
      }
    }

    const btn = document.createElement("button");
    btn.className = "pcol";
    btn.dataset.act = "foldPanel";
    btn.dataset.key = full;
    btn.dataset.steps = steps;
    btn.textContent = state === 2 ? "Show" : (state === 1 ? "Hide" : (condLabel || "Hide"));
    btn.title = state === 2 ? "Show this panel again"
      : state === 1 ? "Hide this panel on the " + tab + " tab"
      : condLabel ? "Show " + condLabel.toLowerCase() + " only"
      : "Hide this panel on the " + tab + " tab";
    h.appendChild(btn);
  });
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
    '<button class="tg cutsm' + (S.toggles.inspiration ? " on y" : "") +
      '" data-act="toggle" data-key="inspiration" title="' +
      (S.toggles.inspiration ? "You have Inspiration — tap when you spend it"
                             : "Tap when the DM gives you Inspiration") + '">Inspiration' +
      (S.toggles.inspiration ? " ★" : "") + "</button>" +
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

  /* Low-frequency actions live behind "More" so the bar isn't 14 buttons
     wide during play. Damage/rests/level-up stay first-class. */
  const moreOpen = !!UI.expanded.moreActions;
  const editBtn = '<button class="bt cutsm' + (E ? " pri" : "") + '" data-act="editMode">' +
    (E ? "Editing" : "Edit") + "<k>E</k></button>";

  return '<div class="bar cut">' +
    '<button class="portrait" data-act="portraitView" title="' + esc(portrait.label) +
      '" aria-label="View portrait — ' + esc(portrait.label) + '">' +
      '<img src="' + portrait.file + '" alt="Hal, ' + esc(portrait.label) + '">' +
      '<span class="pstate">' + esc(portrait.label) + "</span></button>" +
    '<div class="idblk"><div class="nm">' + esc(S.identity.name) + "</div>" +
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
    '<button class="bt cutsm" data-act="longRestPrompt">Long<k>L</k></button>' +
    '<button class="bt pri cutsm" data-act="levelUpModal">Level up</button>' +
    /* Editing stays visible whenever it's ON — being in edit mode without
       an obvious way out is worse than one extra button. */
    (E ? editBtn : "") +
    '<button class="bt cutsm" data-act="expand" data-id="moreActions">' +
      (moreOpen ? "Less" : "More") + "</button>" +
    (moreOpen ? (E ? "" : editBtn) +
      '<button class="bt cutsm" data-act="exportJSON">Export</button>' +
      '<button class="bt cutsm" data-act="importJSON">Import</button>' : "") +
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

/* ---------- REMINDERS ----------
   Sits under the alert bar on every tab, because the whole point is that
   you find out about the tithe without having opened the calendar. */
function reminderBar() {
  const r = calReminders(S);
  if (!r.due.length && !r.soon.length) return "";
  const sysKey = S.calendar.system;

  let out = '<div class="remind cut">';
  r.due.slice(0, 4).forEach(function (d) {
    const e = d.entry;
    const when = CAL.format(sysKey, d.stamp.day) +
      (e.timeOfDay ? ", " + CAL.timeLabel(e.timeOfDay) : "") +
      (d.inDays < 0 ? " · " + (-d.inDays) + " day" + (d.inDays === -1 ? "" : "s") + " ago" : "");
    out += '<div class="rmrow' + (e.kind === "holiday" ? " hol" : "") + '">' +
      '<span class="rmflag">' + (e.kind === "holiday" ? "❖" : "⚑") + "</span>" +
      '<span class="rmname" data-act="calOpen" data-day="' + d.stamp.day +
        '" data-year="' + d.stamp.year + '">' + esc(e.title) +
        (e.kind === "holiday" ? ' <span class="bdg">' + esc(e.systemLabel) + "</span>" : "") +
        '<span class="rmwhen">' + esc(when) + "</span></span>" +
      '<button class="bt cutsm" data-act="calAck" data-key="' +
        esc(ackKey(d.stamp.year, d.stamp.day, e.id)) + '">Acknowledge</button></div>';
  });
  if (r.due.length > 4) {
    out += '<div class="rmmore">…and ' + (r.due.length - 4) + " more waiting on the calendar.</div>";
  }
  if (r.due.length > 1) {
    out += '<div class="rmall"><button class="bt cutsm" data-act="calAckAll">' +
      "Acknowledge all " + r.due.length + "</button></div>";
  }
  r.soon.slice(0, 3).forEach(function (s) {
    const e = s.entry;
    out += '<div class="rmsoon" data-act="calOpen" data-day="' + s.stamp.day +
      '" data-year="' + s.stamp.year + '">' +
      (s.inDays === 0 ? "Later today" : "In " + s.inDays + " day" + (s.inDays === 1 ? "" : "s")) +
      ": <b>" + esc(e.title) + "</b> · " + esc(CAL.format(sysKey, s.stamp.day)) +
      (e.timeOfDay ? ", " + esc(CAL.timeLabel(e.timeOfDay)) : "") + "</div>";
  });
  return out + "</div>";
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

/* ---------- TABS ----------
   Nine tabs in a row is nine things to read before you can pick one, and
   on the iPad they wrapped to a second line besides — so the row is three
   now, and the tabs themselves are a thinner second row under whichever
   group is open. The split is by the question you're asking: what is
   happening in this fight, what Hal is, and what is outside him.

   Every group's subtab row is rendered every time and the closed ones are
   hidden in CSS rather than left out of the markup. It costs a few dozen
   bytes and buys two things: switching groups needs no extra render pass,
   and a tab is always present in the document to be reached by anything
   that knows its name but not which group it currently sits in. */
const TAB_GROUPS = [
  { id: "fight", label: "Combat",
    tabs: [["combat", "Combat", "1"], ["effects", "Effects", "2"],
           ["followers", "Followers", "3"]] },
  { id: "self", label: "Character",
    tabs: [["spells", "Spells", "4"], ["features", "Features", "5"],
           ["inventory", "Inventory", "6"], ["notes", "Notes", "7"]] },
  { id: "world", label: "World",
    tabs: [["map", "Map", "8"], ["calendar", "Calendar", "9"], ["people", "People", "0"]] }
];

/* Flat, in the order they're drawn — which is what the digit shortcuts
   index, so the number on a tab is always its position on screen. Ten
   tabs and ten digits, with 0 in its usual place at the end of the row
   standing for the tenth. */
const TAB_ORDER = TAB_GROUPS.reduce(function (all, g) {
  return all.concat(g.tabs.map(function (t) { return t[0]; }));
}, []);
const TAB_DIGITS = "1234567890";

function tabGroupOf(tab) {
  return TAB_GROUPS.filter(function (g) {
    return g.tabs.some(function (t) { return t[0] === tab; });
  })[0] || TAB_GROUPS[0];
}

/* Where a group button lands you: wherever you were last time you were in
   it. Coming back to World should return you to the map you were reading,
   not to the front of the group. */
function tabGroupHome(g) {
  const last = (S.ui && S.ui.lastTab && S.ui.lastTab[g.id]) || "";
  return g.tabs.some(function (t) { return t[0] === last; }) ? last : g.tabs[0][0];
}

function tabBar(active) {
  const group = tabGroupOf(active);
  /* Groups and tabs share one line — the point of grouping was to spend
     LESS of a 740px screen on chrome, and a second row would have given
     back everything the first one saved. It reads left to right as one
     narrowing: which part of the sheet, then which page of it. */
  let out = '<div class="tabs">' + TAB_GROUPS.map(function (g) {
    /* The title lists what's inside, so a group you are not in still says
       what it holds rather than only what it is called. */
    const inside = g.tabs.map(function (t) { return t[1]; }).join(" · ");
    return '<button class="tab" aria-selected="' + (g.id === group.id) +
      '" data-act="tabGroup" data-group="' + g.id + '" data-go="' + tabGroupHome(g) +
      '" title="' + esc(inside) + '">' + esc(g.label) + "</button>";
  }).join("");

  out += TAB_GROUPS.map(function (g) {
    /* A group of one has nothing to choose between — its button is
       already the tab, so it gets no second half. */
    if (g.tabs.length < 2) return "";
    return '<div class="subtabs' + (g.id === group.id ? "" : " hide") + '">' +
      g.tabs.map(function (t) {
        return '<button class="subtab" aria-selected="' + (active === t[0]) +
          '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + "<k>" + t[2] + "</k></button>";
      }).join("") + "</div>";
  }).join("");
  return out + "</div>";
}

/* ---------- LEFT RAIL ---------- */
function leftRail() {
  const E = S.toggles.editMode;
  /* Topmost header doubles as the collapse control for the whole stats
     column, mirroring how the Resources rail collapses on the right. */
  /* Abilities and saves were the same six rows listed twice — STR 9 −1,
     then STR −1 again eight inches further down. They're one table now:
     the score and its modifier, then the save that comes from it. The
     heading stays the single word "Abilities" because it doubles as the
     collapse control for the whole column, and a heading that wraps pushes
     that control onto a second line. The columns say what they are. */
  let out = '<div class="pnl cut"><h3 class="collapse" data-act="toggleLeftRail">' +
    '<span>Abilities</span><span class="chev">Hide</span></h3>';
  out += '<div class="abrow abhead"><span></span><span></span>' +
    '<span>Mod</span><span>Save</span></div>';
  ["str","dex","con","int","wis","cha"].forEach(function (k) {
    const m = CALC.mod(S.abilities[k]);
    const sv = CALC.savingThrow(S, k);
    const prof = S.saveProficiencies.indexOf(k) >= 0;
    out += '<div class="abrow"><span class="abk">' + k.toUpperCase() + "</span>";
    out += E
      ? '<span class="absc"><input type="number" value="' + S.abilities[k] +
        '" data-act="editAbility" data-key="' + k + '"></span>'
      : '<span class="absc" data-act="prov" data-prov="ability:' + k + '">' + S.abilities[k] + "</span>";
    out += '<span class="abmod" data-act="prov" data-prov="ability:' + k + '">' + sign(m) + "</span>" +
      '<span class="absv' + (prof ? " prof" : "") + '" data-act="prov" data-prov="save:' + k + '">' +
      '<i class="dot' + (prof ? "" : " off") + '"></i>' + sign(sv.value) +
      (sv.advantage ? '<span class="adv">ADV</span>' : "") + "</span></div>";
  });
  out += "</div>";

  /* All eighteen stays the default — an unproficient check is still a roll
     you make. The condensed state is the second tap, not the first. */
  out += '<div class="pnl cut" data-condense="Proficient"><h3>Skills</h3>';
  /* Grouped by governing ability in ability order, alphabetical within each
     group — the way you actually reach for one ("best WIS check?"). The
     group heading carries the ability, so rows don't repeat it. */
  ["str","dex","con","int","wis","cha"].forEach(function (ab) {
    const keys = Object.keys(SKILL_NAMES).filter(function (k) {
      return SKILL_ABILITY[k] === ab;
    }).sort(function (a, b) { return SKILL_NAMES[a].localeCompare(SKILL_NAMES[b]); });
    if (!keys.length) return;
    /* A group whose skills all vanish in the condensed view has to vanish
       with them, or you get a bare "STR" heading over nothing. */
    const anyProf = keys.some(function (k) { return CALC.skill(S, k).proficient; });
    out += '<div class="grp' + (anyProf ? "" : " cnd-hide") + '">' + ab.toUpperCase() + "</div>";
    keys.forEach(function (k) {
      const sk = CALC.skill(S, k);
      /* Every skill is listed, proficient or not — an unproficient check is
         still a roll you make. Non-proficient rows are dimmed so the ones
         you're actually good at still read at a glance, and they're the
         ones the condensed view drops. */
      const dotCls = sk.expertise ? "dot exp" : (sk.proficient ? "dot" : "dot off");
      out += '<div class="row' + (sk.proficient ? " prof" : " unprof cnd-hide") + '" ' +
        (E ? 'data-act="toggleSkill" data-key="' + k + '"' : 'data-act="prov" data-prov="skill:' + k + '"') +
        '><span><i class="' + dotCls + '"></i>' + esc(SKILL_NAMES[k]) + "</span>" +
        "<span>" + sign(sk.value) + "</span></div>";
    });
  });
  if (!E) out += '<div class="foot">Tap Edit to change proficiencies</div>';
  out += "</div>";

  out += toolPanel(E);

  if (UI.prov) out += provPanel();
  return out;
}

/* ---------- TOOLS AND OTHER PROFICIENCIES ----------
   Sits under Skills because it is the same question — what do I add to
   this roll — and it used to be answered by a comma-separated list on
   the Inventory tab that named the tool and stopped there.

   In the 2024 rules each tool names the ability it uses, so the number
   is derivable and the row can carry it. The ability is still editable:
   the DM can call a Cook's Utensils check on Constitution for a night
   of cooking, and the sheet should follow the table rather than argue
   with it. */
function toolPanel(E) {
  let out = '<div class="pnl cut"><h3>Tools &amp; kits <span class="cnt">' +
    (S.tools.length || "none") + "</span></h3>";
  if (!S.tools.length && !E) {
    out += '<div class="foot" style="margin:0">No tool proficiencies. Tap Edit to add one.</div></div>';
    return out;
  }
  S.tools.forEach(function (t, i) {
    const calc = CALC.tool(S, t);
    const cat = TOOLS_2024[t.key];
    if (E) {
      out += '<div class="toolrow ed">' +
        '<input value="' + esc(t.name) + '" data-act="toolName" data-i="' + i + '">' +
        '<select data-act="toolAbility" data-i="' + i + '">' +
          ["str", "dex", "con", "int", "wis", "cha"].map(function (k) {
            return '<option value="' + k + '"' + (calc.ability === k ? " selected" : "") + ">" +
              k.toUpperCase() + "</option>";
          }).join("") + "</select>" +
        '<button class="tg cutsm' + (t.expertise ? " on" : "") +
          '" data-act="toolExpertise" data-i="' + i + '" title="Double proficiency">2x</button>' +
        '<button class="bt cutsm dg" data-act="toolDel" data-i="' + i + '">×</button></div>';
    } else {
      out += '<div class="row prof" data-act="prov" data-prov="tool:' + i + '" title="' +
        esc(cat ? cat.use : "Your DM sets the ability and the DC.") + '">' +
        '<span><i class="dot' + (t.expertise ? " exp" : "") + '"></i>' + esc(t.name) + "</span>" +
        '<span><span class="sc">' + calc.ability.toUpperCase() + "</span> " +
        sign(calc.value) + "</span></div>";
    }
  });
  if (E) {
    /* Adding from the catalogue rather than by typing is what gets the
       2024 ability right without anyone having to look it up. */
    out += '<div class="mrow" style="margin-top:7px"><select id="tool-new">' +
      '<option value="">Add a tool…</option>' +
      Object.keys(TOOLS_2024).sort(function (a, b) {
        return TOOLS_2024[a].name.localeCompare(TOOLS_2024[b].name);
      }).map(function (k) {
        return '<option value="' + k + '">' + esc(TOOLS_2024[k].name) + " · " +
          TOOLS_2024[k].ability.toUpperCase() + "</option>";
      }).join("") +
      '<option value="__own">Something else…</option></select>' +
      '<button class="bt cutsm pri" data-act="toolAdd">Add</button></div>';
  }
  return out + "</div>";
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
  } else if (key.indexOf("tool:") === 0) {
    const t = S.tools[parseInt(key.split(":")[1], 10)];
    if (!t) return "";
    title = t.name; data = CALC.tool(S, t);
    const cat = TOOLS_2024[t.key];
    if (cat) data = Object.assign({}, data, { note: cat.use });
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
  /* What the 2024 rules say the tool actually does, which is the half of
     a tool proficiency the sheet never used to carry. */
  if (data.note) out += '<div class="pr k-feature" style="margin-top:6px">' +
    '<span style="text-align:left">' + esc(data.note) + "</span></div>";
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
  if (tab === "calendar") return calendarTab();
  if (tab === "followers") return followersTab();
  if (tab === "map") return mapTab();
  if (tab === "people") return peopleTab();
  if (tab === "effects") return effectsTab();
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

  /* Conditions detail. The condensed state shows only what's actually on
     you — which is the whole panel most of the time, since the usual
     number of active conditions is zero. */
  out += '<div class="pnl cut" data-condense="Active"><h3>Conditions</h3><div class="gridcols">';
  Object.keys(CONDITIONS).forEach(function (k) {
    const c = CONDITIONS[k], on = S.conditions.indexOf(k) >= 0;
    out += '<div class="row' + (on ? " prof" : " cnd-hide") + '" data-act="condition" data-key="' + k + '">' +
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
    '<button class="pcol" style="margin-left:8px" data-act="expand" data-id="filterCollapsed">' +
    (filterCollapsed ? "Show" : "Hide") + "</button>" +
    /* Per-panel Expand all is in every panel header already; this is the
       one that does the whole tab at once, because "I'm reading through
       all of them" doesn't stop at the Cantrips panel. */
    '<button class="pcol" style="margin-left:8px" data-act="expandAll" data-scope="tab" data-on="' +
    (spellsAllOpen() ? "0" : "1") + '">' +
    (spellsAllOpen() ? "Collapse all spells" : "Expand all spells") + "</button></div>" +
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
    grantedSpellKeys().map(function (k) { return spellEntry(k, false); }).join("");
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

/* Spells a feature or feat hands you outright — they cost no prepared
   slot and can't be unprepared. Faithful Steed grants Find Steed at 5. */
function grantedSpellKeys() {
  const out = ["divineSmite"];
  if (S.magicInitiate && S.magicInitiate.spell) out.push(S.magicInitiate.spell);
  if (S.level >= 5) out.push("findSteed");
  return out;
}

/* There used to be a castableSpellKeys() here, building the rail's own copy
   of the castable list and kept in step with CALC.castables by a test
   because the two could drift — which is exactly how Find Steed once sat in
   the Spells tab and was missing from the rail you cast from at the table.
   The rail's copy is gone; the engine's list is the only one.

   What follows is not that. It answers "which spells will this tab draw",
   which is a question about presentation, and it decides one thing: whether
   the button reads Expand or Collapse. Nothing casts from it. */
function spellsTabKeys() {
  const seen = {};
  return (S.cantrips || []).concat(S.preparedSpells, oathSpellKeys(), grantedSpellKeys())
    .filter(function (k) {
      if (!SPELLS[k] || seen[k]) return false;
      seen[k] = true;
      return matchesFilter(tagsOf("spell:" + k, SPELLS[k].tags));
    });
}
function spellsAllOpen() {
  const keys = spellsTabKeys();
  return keys.length > 0 && keys.every(function (k) { return UI.expanded["s-" + k]; });
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
  /* Same card as the doable list: name, then one line of meta, then tags,
     with the controls stacked at the bottom right and the wiki link last.
     Putting level/school/casting-time on its own line is what makes them
     align down the column instead of starting wherever the spell's name
     happened to end. */
  let out = '<div class="card spellcard">' +
    '<button class="namebtn cardname' + nameDim + '"' + nameAct + '>' + esc(sp.name) + "</button>" +
    '<span class="cardmeta">' + (sp.lvl === 0 ? "Cantrip" : "Level " + sp.lvl) + " · " +
      esc(sp.school) + " · " + esc(sp.time) + " · " + esc(sp.range) + "</span>" +
    '<div class="cardtags">' + tagHTML(tags, true) + "</div>" +
    '<div class="cardbtns">' + castBtn +
      '<button class="bt cutsm" data-act="expand" data-id="s-' + k + '">' + (open ? "Less" : "More") + "</button>" +
      favBtn("spell", k) +
      (editable ? '<button class="bt cutsm dg" data-act="unprepare" data-key="' + k + '">Remove</button>' : "") +
      wikiBtn(sp.slug) +
    "</div>";
  if (open) {
    out += '<div class="carddetail">' + esc(sp.text) +
      '<div class="cardmeta" style="margin-top:6px">Duration: ' + esc(sp.dur) +
      " · Components: " + esc(sp.comp) + "</div>";
    if (S.toggles.editMode) {
      out += '<div class="mrow" style="margin-top:7px"><span class="lbl">Tags</span>' +
        '<input style="flex:1" value="' + esc(tags.join(", ")) +
        '" data-act="editTags" data-id="spell:' + k + '"></div>';
    }
    out += "</div>";
  }
  out += "</div>";
  return out;
}

/* ---------- FEATURES ---------- */
function featuresTab() {
  const E = S.toggles.editMode;
  let out = filterPanel();

  /* Condensed drops the locked, not-yet-reached features — useful when
     you're reading what you have rather than what's coming. */
  out += '<div class="pnl cut" data-condense="Unlocked"><h3>Class &amp; subclass</h3>';
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
    /* No controls — there is nothing to do with a feature you don't have
       yet — so the card is just its two lines. */
    out += '<div class="card locked cnd-hide"><span class="cardname">' + esc(f.name) +
      '</span><span class="cardmeta">Unlocks at level ' + f.unlockLevel + " · " +
      esc(f.src) + "</span></div>";
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
    out += '<div class="card">' +
      '<button class="namebtn cardname" data-act="expand" data-id="f-' + k + '">' + esc(f.name) + "</button>" +
      '<span class="cardmeta">' + esc(f.type) + " feat" +
        (f.prereq ? " · " + esc(f.prereq) : "") + "</span>" +
      '<div class="cardtags">' + tagHTML(tags, true) + "</div>" +
      '<div class="cardbtns">' +
        '<button class="bt cutsm" data-act="expand" data-id="f-' + k + '">' + (open ? "Less" : "More") + "</button>" +
        favBtn("feat", k) +
        wikiBtn(f.slug) +
      "</div>" +
      (open ? '<div class="carddetail">' + esc(f.text) + "</div>" : "") + "</div>";
  });
  if (S.magicInitiate) {
    out += '<div class="card"><span class="cardname">Magic Initiate picks</span>' +
      '<span class="cardmeta">Wizard</span>' +
      '<div class="carddetail">Cantrips: ' +
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

/* Same card as spells and the doable list: name, one line of meta, tags,
   controls bottom right. Where the feature is something you can actually
   do, the name still does it — that behaviour predates the card and is
   worth more than consistency about what a name does. */
function featureEntry(k, f) {
  const tags = tagsOf("feature:" + k, f.tags);
  if (!matchesFilter(tags)) return "";
  const open = UI.expanded["ft-" + k];
  const act = FEATURE_ACTION_MAP[k];
  const nameBtn = act
    ? '<button class="namebtn cardname" data-act="use" data-kind="' + act.kind + '" data-id="' + act.id + '">' +
        esc(f.name) + "</button>"
    : '<button class="namebtn cardname" data-act="expand" data-id="ft-' + k + '">' + esc(f.name) + "</button>";
  return '<div class="card">' + nameBtn +
    '<span class="cardmeta">' + esc(f.src) +
      (f.homebrew ? ' <span class="hb">Homebrew</span>' : "") + "</span>" +
    '<div class="cardtags">' + tagHTML(tags, true) + "</div>" +
    '<div class="cardbtns">' +
      '<button class="bt cutsm" data-act="expand" data-id="ft-' + k + '">' + (open ? "Less" : "More") + "</button>" +
      favBtn("feature", k) +
      wikiBtn(f.slug) +
    "</div>" +
    (open ? '<div class="carddetail">' + esc(f.text) + "</div>" : "") + "</div>";
}

/* ---------- INVENTORY ---------- */
function inventoryTab() {
  const E = S.toggles.editMode;
  const c = S.equipment.coins;
  let out = filterPanel();

  /* The same card as everywhere else. An item has nothing to cast and
     nowhere to link, so the column that holds Cast and the wiki elsewhere
     holds the count instead — which keeps the silhouette identical down
     the list rather than leaving a blank quarter on every row. The note is
     short enough to be the meta line, so nothing needs expanding. */
  out += '<div class="pnl cut"><h3>Carried</h3>';
  S.equipment.inventory.forEach(function (it, i) {
    if (!matchesFilter(it.tags)) return;
    if (E) {
      /* Consumable is what tells a favourited potion from a favourited
         sword: one offers Use, the other doesn't, because nothing good
         comes of a scimitar that can be pressed down to nothing. */
      out += '<div class="card carded"><div class="mrow">' +
        '<input style="flex:1" value="' + esc(it.name) + '" data-act="editItem" data-i="' + i + '" data-field="name">' +
        '<input type="number" style="width:60px" value="' + it.qty + '" data-act="editItem" data-i="' + i + '" data-field="qty">' +
        '<button class="tg cutsm' + (it.consumable ? " on" : "") + '" data-act="itemConsumable" data-i="' + i +
          '" title="A consumable can be spent from Favourites">Consumable</button>' +
        '<button class="bt cutsm dg" data-act="delItem" data-i="' + i + '">Delete</button></div>' +
        '<input style="width:100%;margin-top:4px" placeholder="Note" value="' + esc(it.note || "") +
        '" data-act="editItem" data-i="' + i + '" data-field="note"></div>';
    } else {
      out += '<div class="card">' +
        '<span class="cardname">' + esc(it.name) + "</span>" +
        '<span class="cardmeta">' + esc(it.note || "") + "</span>" +
        '<div class="cardtags">' + tagHTML(it.tags, true) + "</div>" +
        '<div class="cardbtns">' +
          (it.consumable
            ? '<button class="bt cutsm ' + (it.qty > 0 ? "pri" : "dim") + '" data-act="itemUse" data-id="' +
              esc(it.id) + '" title="' + (it.qty > 0 ? "Spend one" : "None left") + '">Use</button>'
            : "") +
          '<span class="qty">×' + it.qty + "</span>" + favBtn("item", it.id) +
        "</div></div>";
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
    '<div class="kv"><span>Tools</span><span>' +
      (S.tools.length
        ? S.tools.map(function (t) {
            return esc(t.name) + " " + sign(CALC.tool(S, t).value);
          }).join(", ")
        : "—") + "</span></div>" +
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

/* ---------- FOLLOWERS ----------
   A summon is a second creature you are responsible for, so it gets
   treated like one: a card that stays on screen wherever you are, and
   a tab holding the stat block in full. The card is deliberately the
   same component in the rail and in combat — one thing to recognise. */

/* Each creature type gets its own colour so two steeds are never
   mistaken for each other at a glance. */
function followerAccent(f) {
  return { celestial: "cel", fey: "fey", fiend: "fnd" }[f.creatureType] || "cel";
}
function followerGlyph(f) {
  return { celestial: "❖", fey: "✦", fiend: "✸" }[f.creatureType] || "❖";
}

function followerCard(f, full) {
  const b = CALC.followerBlock(S, f);
  if (!b) return "";
  const pct = Math.round((f.hp / b.maxHP) * 100);
  const cls = pct <= 25 ? "crit" : (pct <= 60 ? "hurt" : "");
  /* Only some followers have an ability worth tracking between rests. */
  const tracked = (b.bonusActions || []).filter(function (x) { return x.tracked; })[0];
  return '<div class="fol a-' + followerAccent(f) + (full ? " full" : "") +
    (f.stowed ? " stowed" : "") + '">' +
    '<div class="folhead"><span class="folglyph">' + followerGlyph(f) + "</span>" +
    '<span class="folname" data-act="tab" data-tab="followers">' + esc(f.name) + "</span>" +
    '<span class="foltype">' + esc(b.type.name) + "</span></div>" +
    '<div class="folsub">' + esc(b.formLabel) + " · " + esc(b.source.label) +
      (b.source.key === "findSteed" ? " · spell level " + b.spellLevel : "") +
      (f.stowed ? " · stowed" : "") + "</div>" +
    '<div class="folhp"><span class="lbl">HP</span>' +
      '<div class="hpbar"><div class="hpfill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<span class="folnum">' + f.hp + "<small>/" + b.maxHP + "</small></span>" +
      (f.tempHP ? '<span class="tmp">+' + f.tempHP + "</span>" : "") +
      '<span class="lbl">AC</span><span class="folnum">' + b.ac + "</span></div>" +
    '<div class="folatk">' + esc(b.cardLine) + "</div>" +
    '<div class="folacts">' +
      '<button class="bt cutsm dg" data-act="followerDamageModal" data-id="' + f.id + '">Damage…</button>' +
      (tracked ? '<button class="chip' + (f.baUsed ? " used" : "") + '" data-act="followerBonus" data-id="' +
        f.id + '" title="' + esc(tracked.text) + '">' + esc(tracked.name) +
        (f.baUsed ? " · spent" : "") + "</button>" : "") +
      (b.source.key === "findFamiliar"
        ? '<button class="chip" data-act="followerStow" data-id="' + f.id + '">' +
          (f.stowed ? "Recall" : "Stow") + "</button>" : "") +
      (full ? '<button class="bt cutsm dg" data-act="followerDismiss" data-id="' + f.id +
              '">Dismiss</button>' : "") +
    "</div></div>";
}

/* The right-rail panel. Renders nothing at all when you have no
   followers, so it costs no space until it matters. */
function followerRail() {
  if (!S.followers.length) return "";
  return '<div class="pnl cut"><h3>Followers <span class="cnt">' + S.followers.length + "</span></h3>" +
    S.followers.map(function (f) { return followerCard(f, false); }).join("") + "</div>";
}

function followersTab() {
  let out = "";
  if (!S.followers.length) {
    out += '<div class="pnl cut"><h3>Followers <span class="cnt">none</span></h3>' +
      '<div class="foot" style="margin:0">Nothing summoned. Cast <b>Find Steed</b> from the Spells ' +
      "tab and it will ask you what answers.</div></div>";
  }
  S.followers.forEach(function (f) {
    const b = CALC.followerBlock(S, f);
    out += '<div class="pnl cut a-' + followerAccent(f) + '"><h3>' + esc(b.statName) +
      '<span class="cnt">' + esc(b.size) + " " + esc(b.type.name) + " · " + esc(b.alignment) +
      "</span></h3>" + followerCard(f, true);

    out += '<div class="mrow" style="margin-top:11px"><span class="lbl">Name</span>' +
      '<input type="text" value="' + esc(f.name) + '" data-act="followerName" data-id="' + f.id +
      '" style="flex:1;min-width:140px">' + wikiBtn(b.source.slug) + "</div>";

    /* The block itself, in the order the source prints it. The "why"
       column only has something to say when a number is derived. */
    const derived = b.source.key === "findSteed";
    out += '<div class="sb"><div class="sbrow"><span>Armor Class</span><b>' + esc(b.acNote || b.ac) +
      '</b><span class="sbwhy">' + (derived ? "10 + 1 per spell level" : "") + "</span></div>" +
      '<div class="sbrow"><span>Hit Points</span><b>' + esc(b.hpNote || String(b.maxHP)) +
      '</b><span class="sbwhy">' + (derived ? "5 + 10 per spell level · " + esc(b.hitDice) : "") +
      "</span></div>" +
      '<div class="sbrow"><span>Speed</span><b>' + esc(b.speed) + "</b>" +
      '<span class="sbwhy">' + (derived ? (b.canFly ? "flight from the level 4+ slot"
                                                    : "Fly 60 ft. needs a level 4+ slot") : "") +
      "</span></div>" +
      (derived ? '<div class="sbrow"><span>Proficiency Bonus</span><b>' + sign(b.pb) +
        '</b><span class="sbwhy">equals yours</span></div>' : "") +
      (b.skills ? '<div class="sbrow"><span>Skills</span><b>' + esc(b.skills) + "</b></div>" : "") +
      '<div class="sbrow"><span>Senses</span><b>' +
      esc(derived ? "Passive Perception " + b.passivePerception : b.senses) + "</b></div>" +
      '<div class="sbrow"><span>Languages</span><b>' + esc(b.languages) + "</b></div>" +
      '<div class="sbrow"><span>Challenge</span><b>' + esc(b.cr) + "</b></div></div>";

    out += '<div class="sbabil">';
    ["str","dex","con","int","wis","cha"].forEach(function (k) {
      const a = b.abilities[k];
      out += '<div class="sbab"><span class="lbl">' + k.toUpperCase() + "</span>" +
        "<b>" + a.score + "</b><span class=\"sbwhy\">" + sign(a.mod) +
        " / save " + sign(a.save) + "</span></div>";
    });
    out += "</div>";

    [["Traits", b.traits], ["Actions", b.actions],
     ["Bonus Actions", b.bonusActions], ["Reactions", b.reactions]].forEach(function (sec) {
      if (!sec[1] || !sec[1].length) return;
      out += '<div class="sbsec"><span class="sbk">' + sec[0] + "</span>";
      sec[1].forEach(function (a) {
        out += '<div class="entry"><div class="eh"><b class="en">' + esc(a.name) + "</b>" +
          (a.meta ? '<span class="emeta">' + esc(a.meta) + "</span>" : "") +
          (a.tracked ? '<button class="chip' + (f.baUsed ? " used" : "") +
            '" data-act="followerBonus" data-id="' + f.id + '">' +
            (f.baUsed ? "Spent — tap to restore" : "Available — tap when used") + "</button>" : "") +
          "</div>" +
          '<div class="etext">' + esc(a.text) +
          (a.name === "Fell Glare" ? " (Your spell save DC is " + b.saveDC + ".)" : "") +
          "</div></div>";
      });
      out += "</div>";
    });

    /* The rules that live on the spell rather than in the stat block —
       the ones you actually have to look up mid-fight. */
    if (b.cantAttack) out += '<div class="warnbox">' + esc(b.cantAttack) + "</div>";
    out += '<div class="sbsec"><span class="sbk">In combat</span>';
    (b.combatRules || []).forEach(function (r) {
      out += '<div class="ruleline"><span class="rn">' + esc(r.name) + "</span>" +
        '<span class="rt">' + esc(r.text) + "</span></div>";
    });
    /* Can this one actually carry Hal? The sheet knows both sizes. */
    const mount = CALC.canBeMount(S, b);
    out += '<div class="ruleline' + (mount.ok ? " yes" : " no") + '">' +
      '<span class="rn">As a mount</span><span class="rt">' + esc(mount.why) +
      (mount.ok ? " Mounted Combat is below." : "") + "</span></div></div>";

    if (f.summoned) {
      out += '<div class="seqnote">Summoned ' + esc(CAL.format(S.calendar.system, f.summoned.day)) +
        ", " + CAL.yearLabel(S.calendar.system, f.summoned.year) + ". <em>" + esc(b.ends) + "</em></div>";
    }
    out += "</div>";
  });

  out += combatRulesPanel();
  return out;
}

/* ---------- TOKENS ----------
   Every face in the app comes out of one image. tokens.jpg is a 7-wide
   sheet built by tools/build-tokens.py: the party first, in the order
   below, then the thirty-six generic faces. A tile is addressed by index
   and drawn with a background-position, which is why there is one file to
   cache and one request on a cold open rather than forty-one.

   The party's are fixed — Qee looks like Qee — and everything else is
   assigned by hand, because "which goblin is this" is a question only the
   table can answer.

   TOKEN_COLS/ROWS have to match the sheet. If build-tokens.py ever emits
   a different shape, this is the other half of that change. */
/* Two sheets, not one. Five hundred and fifty faces is more pixels than
   WebKit will decode at full resolution — much past five megapixels it
   subsamples, and a subsampled 112px tile is mush. So they are split at a
   category boundary and each half stays under it. tokenStyle() decides
   which sheet an index belongs to; nothing else has to know.

   TOKEN_SPLIT, the column count and both row counts are printed by
   tools/build-tokens.py. The two files have to agree. */
const TOKEN_COLS = 12;
const TOKEN_SPLIT = 336;          /* first index that lives on sheet two */
const TOKEN_ROWS_1 = 28, TOKEN_ROWS_2 = 18;
const TOKEN_PARTY = ["Qee", "Gill", "Dinos", "Karlie", "Sol"];

/* Five hundred faces is far too many to scroll, so the picker is banded —
   and the bands are the source grids, which were themed to begin with.
   `from` is where each starts; the ranges have gaps (row 0 is the party
   and has seven spare slots) so that every band begins on a row boundary
   and its index stays arithmetic.

   `use` is what the band is FOR, which is how the picker knows to open on
   Familiars when you are naming a familiar and on Beasts when you are
   naming a mount. A band with no `use` is a general one. */
const TOKEN_BANDS = [
  { id: "party",  label: "The party",   from: 0,   count: 5,   use: ["party"],
    note: "Fixed — these are who they are." },
  { id: "faces",  label: "Faces",       from: 12,  count: 36,  use: ["npc"],
    note: "Painted portraits. Innkeepers, captains, the person across the table." },
  { id: "guard",  label: "Soldiers",    from: 48,  count: 36,  use: ["npc"],
    note: "Guards, men-at-arms, the watch, whoever the town sent." },
  { id: "class",  label: "Adventurers", from: 84,  count: 72,  use: ["npc"],
    note: "Rival parties, hired swords, the guild that wants what you want." },
  { id: "caster", label: "Casters",     from: 156, count: 36,  use: ["npc"],
    note: "Mages, cultists, clergy, and the ones who took it too far." },
  { id: "kin",    label: "Kin",         from: 192, count: 144, use: ["foe"],
    note: "Goblins, orcs, gnolls, drow, dwarves, tieflings, snakefolk." },
  { id: "beast",  label: "Beasts",      from: 336, count: 36,  use: ["mount", "summon", "foe"],
    note: "Horses, wolves, bears, big cats — mounts, pack animals and what hunts you." },
  { id: "famil",  label: "Familiars",   from: 372, count: 36,  use: ["familiar", "summon"],
    note: "The Find Familiar list: owls, cats, ravens, rats, frogs, spiders." },
  { id: "mons",   label: "Monsters",    from: 408, count: 72,  use: ["foe"],
    note: "Aberrations, constructs, devils, oozes, things with too many eyes." },
  { id: "drag",   label: "Dragons",     from: 480, count: 36,  use: ["foe"],
    note: "Every colour, and a few that have been dead a while." },
  { id: "dead",   label: "Undead",      from: 516, count: 36,  use: ["foe"],
    note: "Skeletons, zombies, mummies, spectres, liches." }
];

/* Labels, band by band, in sheet order. They name a token in a tooltip
   and give the picker's search something to match; the picture is the
   real identifier, so a label being approximate costs nothing — and a
   band that runs past the names written for it falls back to numbering,
   which is honest about the ones nobody has got round to naming. */
const TOKEN_LABELS = {};
TOKEN_PARTY.forEach(function (n, i) { TOKEN_LABELS[i] = n; });
[
  ["faces", ["Human fighter", "Human veteran", "Orc warrior", "White-haired swordsman",
    "Human rogue", "Orc woman",
    "Human wizard", "Gilded monk", "Human scout", "Burning revenant",
    "Tiefling elder", "Dwarf in a hat",
    "Dwarf warrior", "Armoured knight", "Grey mage", "Red-bearded brawler",
    "Laughing dwarf", "Elder scholar",
    "Storm sage", "Lizardfolk soldier", "Shouting dwarf", "Orc scout",
    "Warrior with locks", "Tiefling sorceress",
    "Frost dwarf", "Duelist", "Tiefling warrior", "Cloaked figure",
    "Bald elder", "White-haired sage",
    "Horned elder", "Red devil", "Northern warrior", "Golden helm captain",
    "Gilded elder", "Old campaigner"]],
  ["guard", ["Knight", "Shieldmaiden", "Guard captain", "Helmed guard",
    "Sergeant", "Woman-at-arms",
    "Spearman", "Standard bearer", "Archer", "Halberdier", "Footman", "Scout",
    "Crossbowman", "Crossbow woman", "Bowman", "Huntress", "Ranger", "Squire",
    "Masked cleric", "Dark priestess", "Swordsman", "Torchbearer",
    "Robed scribe", "Helmed soldier",
    "Bald veteran", "Gilded knight", "Pikeman", "Blonde knight",
    "Grizzled captain", "Young soldier",
    "Bearded warrior", "Duelist", "Eyepatch veteran", "Mace bearer",
    "Old soldier", "Recruit"]],
  ["class", ["Knight", "Woman-at-arms", "Horned warlord", "Helmed knight",
    "Paladin", "Elf paladin",
    "Wizard", "Sorceress", "Old sage", "Warlock", "Death cultist", "Witch",
    "Masked rogue", "Rogue", "Bandit", "Assassin", "Ranger", "Elf ranger",
    "Vampire lord", "Shadow priestess", "Bandit chief", "Braided fighter",
    "Berserker", "Axe maiden",
    "Norse warrior", "Shieldmaiden", "Cleric", "Radiant priestess",
    "Hooded archer", "Elf archer",
    "Antlered druid", "Green druid", "Bard", "Harpist", "Monk", "Martial artist",
    /* second sheet of the same kind */
    "Banner knight", "Red-haired knight", "Horned champion", "Helmed woman",
    "Radiant paladin", "Sword of dawn",
    "Blue mage", "Violet sorceress", "Old wizard", "Storm witch",
    "Skull cultist", "Hat witch",
    "Masked thief", "Veiled assassin", "Hooded bandit", "Twin blades",
    "Green ranger", "Elf hunter",
    "Horned vampire", "Violet warlock", "Bandanna fighter", "Braided archer",
    "Bearded berserker", "Axe woman",
    "Horned raider", "Copper shieldmaiden", "Praying cleric", "Golden saint",
    "Green archer", "Elf scout",
    "Stag druid", "Vine druid", "Lute bard", "Golden singer",
    "Bald monk", "Braided monk"]],
  ["caster", ["Archmage", "Red mage", "Green apprentice", "Old enchantress",
    "Blue sage", "Violet mage",
    "Fire mage", "Ice mage", "Storm mage", "Sand mage", "Lightning adept",
    "Shadow sorceress",
    "Hooded assassin", "Dagger woman", "Masked killer", "Flame cultist",
    "Grey hood", "Violet hood",
    "Bone mage", "Skull priestess", "Gaunt necromancer", "Death acolyte",
    "Green lich", "Pale warlock",
    "War cleric", "Veiled nun", "Priest", "Grey sister", "Old bishop",
    "Golden abbess",
    "Fire cultist", "Vampire lady", "Dark priest", "Violet witch",
    "Pale scholar", "Black warlock"]],
  ["kin", ["Goblin", "Goblin scout", "Black dragonborn", "Hooded dragonborn",
    "Orc", "Half-orc woman",
    "Duergar", "Half-elf", "Gnoll", "Bugbear", "Lizardfolk", "Green lizardfolk",
    "Drow", "Drow noble", "Dwarf", "Braided warrior", "Red tiefling", "Blue tiefling",
    "Vampire", "Vampire lady", "Orc brute", "Kobold", "Orc soldier", "Half-elf warrior",
    "Leopard", "Lioness", "Goliath", "Braided fighter", "Satyr", "Faun",
    "Kenku", "Blue kenku", "Cheetah", "Wildcat", "Frost giant", "Fire genasi",
    /* grid8 */
    "Goblin snarler", "Hobgoblin", "Orc chief", "Orc woman", "Helmed orc", "Goblin elder",
    "Red tiefling", "Bronze soldier", "Grey orc", "Braided orc", "Helmed goblin", "Pale elf",
    "Gnoll", "Hyena-kin", "Bugbear", "Furred brute", "Bearded gnoll", "Black gnoll",
    "Red dragonborn", "Hooded kobold", "Green dragonborn", "Blue dragonborn",
    "Gold dragonborn", "Sand dragonborn",
    "Green lizardfolk", "Feathered lizardfolk", "Grey lizardfolk", "Plumed lizardfolk",
    "Marsh lizardfolk", "Pale lizardfolk",
    "White troglodyte", "Grey troglodyte", "Horned grey", "Bone lizardfolk",
    "Snarling grey", "Pale troglodyte",
    /* grid9 */
    "Orc warrior", "Tiefling raider", "Orc brute", "Orc huntress", "Green orc", "Orc shaman",
    "Gnoll", "Gnoll matriarch", "Gnoll howler", "Gnoll scout", "Grey gnoll", "Red gnoll",
    "Minotaur", "Minotaur woman", "Bull-kin", "Longhorn", "Black minotaur", "Brown minotaur",
    "Half-orc", "Half-orc woman", "Bald brute", "Grey brute", "Scarred brute", "Green brute",
    "Wolf", "Dire wolf", "Brown bear", "Grizzly", "Lynx", "Tiger",
    "Orc raider", "Orc hunter", "Gnoll pack leader", "Bull-kin elder", "Half-orc chief", "Black wolf",
    /* grid10 */
    "Drow", "Drow priestess", "Drow blade", "Drow sorceress", "Drow scout", "Drow noble",
    "Torch elf", "Green elf", "Pale elf", "Hooded elf", "Dark cleric", "Violet elf",
    "Dwarf smith", "Dwarf woman", "Dwarf warrior", "Dwarf archer", "Old dwarf", "Dwarf blade",
    "Torch dwarf", "Grey dwarf", "Blue-flame dwarf", "Duergar", "Duergar archer", "Duergar chief",
    "Blue tiefling", "Fire tiefling", "Violet tiefling", "Red tiefling", "Yuan-ti", "Snake woman",
    "Serpent", "Cobra-kin", "Vampire", "Vampire countess", "Pale noble", "Dark blade"]],
  ["beast", ["Grey wolf", "Snarling wolf", "Brown bear", "Polar bear", "Lion", "Panther",
    "Spider", "Boar", "Horse", "Crocodile", "Eagle", "Hyena",
    "Bear", "Grizzly", "Tiger", "Leopard", "Jaguar", "Cheetah",
    "White wolf", "Howling wolf", "Warhorse", "Lion", "Cougar", "Alligator",
    "Hyena", "Laughing hyena", "Giant spider", "Scorpion", "Giant wasp", "Bald eagle",
    "Lynx", "Bobcat", "Black panther", "Warthog", "Draft horse", "Great owl"]],
  ["famil", ["Bat", "Calico cat", "Barn owl", "Raven", "Rat", "Green frog",
    "Orange cat", "Owl", "Hawk", "Weasel", "Toad", "Snake",
    "Iguana", "Spider", "Horned owl", "Black cat", "Bat", "Hermit crab",
    "White rat", "Ferret", "Crow", "Horned lizard", "Viper", "Frog",
    "Barn owl", "Weasel", "Red hawk", "Tarantula", "Black cat", "Green lizard",
    "Bat", "Tree frog", "Great owl", "Rat", "Raven", "Crab"]],
  ["mons", ["Mind flayer", "Beholder", "Deep fish", "Crab horror", "Carrion crawler", "Ettin",
    "Owl", "Eagle", "Lion", "Basilisk", "Wolf", "Yeti",
    "Dire wolf", "Werewolf", "Bull", "Axe beak", "Medusa", "Griffon",
    "Stone golem", "Iron golem", "Ogre", "Frost ogre", "Devil", "Cockatrice",
    "Red dragon", "Black dragon", "Blue dragon", "Green dragon", "White dragon", "Brass dragon",
    "Skeleton knight", "Zombie", "Lich", "Wraith", "Ghoul", "Death knight",
    /* grid13 */
    "Beholder", "Mind flayer", "Deep one", "Octopoid", "Gibbering mouth", "Eye horror",
    "Stone golem", "Iron sentinel", "Flesh golem", "Clay golem", "Scarecrow", "Brass automaton",
    "Balor", "Fire devil", "Bloated devil", "Vrock", "Succubus", "Imp lord",
    "Lich queen", "Vampire lord", "Mummy lord", "Death knight", "Ghoul lord", "Reaper",
    "Red dragon", "Green wyrm", "Eagle", "Great owl", "Chimera", "Manticore",
    "Hag", "Mimic", "Rust monster", "Green slime", "Chitin horror", "Purple worm"]],
  ["drag", ["Red dragon", "Gold dragon", "Yellow dragon", "Black dragon",
    "Green dragon", "White dragon",
    "Shadow dragon", "Silver dragon", "Bone dragon", "Prismatic dragon",
    "Amber dragon", "Emerald dragon",
    "Blue dragon", "Bronze dragon", "Sapphire dragon", "Copper dragon",
    "Obsidian dragon", "Ice dragon",
    "Jade dragon", "Violet dragon", "Skeletal dragon", "Amethyst dragon",
    "Crimson dragon", "Bleached dragon",
    "Pale dragon", "Void dragon", "Verdant dragon", "Frost dragon",
    "Azure dragon", "Onyx dragon",
    "Ruby dragon", "Scarlet dragon", "Cobalt dragon", "Topaz dragon",
    "Blood dragon", "Brass dragon"]],
  ["dead", ["Red-eyed skull", "Blue-eyed skull", "Green-eyed skull", "Cracked skull",
    "Helmed skull", "Hooded skull",
    "Zombie", "Rotting zombie", "Ghoul", "Plague zombie", "Fresh zombie", "Plague doctor",
    "Ghast", "Wight", "Draugr", "Revenant", "Feral ghoul", "Vampire spawn",
    "Mummy", "Bandaged mummy", "Wrapped mummy", "Ancient mummy",
    "Crowned mummy", "Pharaoh",
    "Spectre", "Banshee", "Wraith", "Phantom", "Wailing spirit", "Poltergeist",
    "Skeleton knight", "Iron skull", "Horned lich", "Crowned lich",
    "Amethyst lich", "Ruby lich"]]
].forEach(function (pair) {
  const band = TOKEN_BANDS.filter(function (b) { return b.id === pair[0]; })[0];
  pair[1].forEach(function (n, i) {
    if (i < band.count) TOKEN_LABELS[band.from + i] = n;
  });
});

/* Only the slots a band actually claims are real. The seven spares at the
   end of row 0 exist on the sheet but must never be chosen — a blank
   token would read as a bug rather than as a choice. */
function tokenBandOf(i) {
  return TOKEN_BANDS.filter(function (b) {
    return i >= b.from && i < b.from + b.count;
  })[0] || null;
}
function tokenLabel(i) {
  if (TOKEN_LABELS[i]) return TOKEN_LABELS[i];
  const b = tokenBandOf(i);
  return b ? b.label + " " + (i - b.from + 1) : "Token " + (i + 1);
}
/* Which sheet a tile is on, and the class that names it. */
function tokenSheet(i) { return i < TOKEN_SPLIT ? 1 : 2; }
/* The inline style that puts tile `i` in a box. Percentages rather than
   pixels so the same declaration works at 24px in a sub-badge and 60px in
   a dossier card. The two sheets are different heights, so the vertical
   percentage is against whichever one this tile is on. */
function tokenStyle(i) {
  const sheet = tokenSheet(i);
  const local = sheet === 1 ? i : i - TOKEN_SPLIT;
  const rows = sheet === 1 ? TOKEN_ROWS_1 : TOKEN_ROWS_2;
  const col = local % TOKEN_COLS, row = Math.floor(local / TOKEN_COLS);
  return "background-position:" +
    (TOKEN_COLS > 1 ? (col / (TOKEN_COLS - 1)) * 100 : 0) + "% " +
    (rows > 1 ? (row / (rows - 1)) * 100 : 0) + "%";
}
function validToken(i) {
  return (typeof i === "number" && tokenBandOf(i)) ? i : null;
}

/* The face for one combatant, at whatever size the caller's CSS says.
   Hal is the exception and always will be: he has six portraits of his
   own that change as he gets hurt, and showing a static token for him
   would throw that away. Everyone else falls back to their initial, which
   is a portrait you never have to assign. */
function tokenFace(opts) {
  const cls = "face" + (opts.cls ? " " + opts.cls : "");
  if (opts.hal) {
    const p = CALC.portraitFor(S);
    return '<span class="' + cls + ' halface"><img src="' + p.file + '" alt="" ' +
      'title="' + esc(p.label) + '"></span>';
  }
  const t = validToken(opts.token);
  if (t == null) {
    const initial = (String(opts.name || "?").trim()[0] || "?").toUpperCase();
    return '<span class="' + cls + ' noface">' + esc(initial) + "</span>";
  }
  return '<span class="' + cls + ' tok sh' + tokenSheet(t) + '" style="' + tokenStyle(t) +
    '" title="' + esc(tokenLabel(t)) + '"></span>';
}

/* ---------- ACTIVE EFFECTS ----------
   The sheet has always known when YOU are concentrating — there is a
   screen-edge glow for it. What decides a fight more often is knowing the
   enemy mage is, and on what, and what breaking it would undo; and the
   sheet had nowhere to put that, because it is not derived from anything
   it owns. The DM says it out loud and it is gone.

   So this is a notebook, not a model. Four plain sentences — who, what,
   what kind of thing it is, and what it means — plus an optional clock.
   No screen glow: someone else's concentration is a thing to consult, not
   an alarm, and the rim is already spoken for by your own.

   The clock counts in rounds or in turns because both come up at the
   table: a spell lasts rounds, a lair action fires in so many turns. It
   ticks down as the fight advances and STOPS at zero rather than
   deleting itself. A thing that is due now is the most important line on
   the screen; disappearing is the one thing it must not do. */
const WATCH_KINDS = ["conc", "effect", "countdown"];
const WATCH_KIND_LABEL = { conc: "Concentrating on", effect: "Affected by", countdown: "Counting down to" };
const WATCH_KIND_SHORT = { conc: "Concentration", effect: "Effect", countdown: "Countdown" };

/* Advance every clock. Turns tick once per turn; rounds tick once per lap
   of the order — the same two numbers the effects list already decays by,
   so a watched countdown and a spell of yours can never disagree about
   how much of the fight has gone by. */
function tickWatch(st, turns, rounds) {
  (st.watch || []).forEach(function (w) {
    if (w.left == null) return;
    const by = w.unit === "turns" ? turns : rounds;
    if (by > 0) w.left = Math.max(0, w.left - by);
  });
}
/* Which clocks this advance would run out, worked out before mutating so
   the alert can name them. */
function watchDueAfter(st, turns, rounds) {
  return (st.watch || []).filter(function (w) {
    if (w.left == null || w.left <= 0) return false;
    return w.left - (w.unit === "turns" ? turns : rounds) <= 0;
  });
}

function watchClock(w) {
  if (w.left == null) return "";
  if (w.left <= 0) return '<span class="wnow">NOW</span>';
  return '<span class="wleft">' + w.left + " " + (w.left === 1 ? w.unit.slice(0, -1) : w.unit) + "</span>";
}

/* Read view. One line you can take in mid-turn: who, then the thing,
   then what it means, then how long. */
function watchCard(w, compact) {
  if (!compact && UI.watch.edit[w.id]) return watchEditor(w);
  return '<div class="watch k-' + w.kind + (w.left === 0 ? " due" : "") + '">' +
    '<div class="wh"><span class="wwho">' + esc(w.who || "Someone") + "</span>" +
      '<span class="wkind">' + esc(WATCH_KIND_LABEL[w.kind]) + "</span>" +
      '<span class="wwhat">' + esc(w.what || "—") + "</span>" +
      watchClock(w) + "</div>" +
    (w.outcome ? '<div class="wout">' + esc(w.outcome) + "</div>" : "") +
    (w.note && !compact ? '<div class="etext">' + esc(w.note) + "</div>" : "") +
    (compact ? "" :
      '<div class="wbtns">' +
        (w.left == null
          ? '<button class="bt cutsm" data-act="watchClock" data-id="' + w.id +
            '" data-d="1" title="Start a countdown on this">+ Clock</button>'
          : '<button class="bt cutsm" data-act="watchClock" data-id="' + w.id + '" data-d="-1">−1</button>' +
            '<button class="bt cutsm" data-act="watchClock" data-id="' + w.id + '" data-d="1">+1</button>') +
        '<button class="bt cutsm" data-act="watchEdit" data-id="' + w.id + '">Edit</button>' +
        '<button class="bt cutsm dg" data-act="watchDel" data-id="' + w.id + '">Clear</button>' +
      "</div>") +
    "</div>";
}

function watchEditor(w) {
  let out = '<div class="watch carded k-' + w.kind + '">' +
    '<div class="prow">' +
      '<input class="wfw" value="' + esc(w.who) + '" placeholder="Who — the mage, the lair, Qee…" ' +
        'data-act="watchField" data-id="' + w.id + '" data-f="who">' +
      '<button class="bt cutsm pri" data-act="watchEdit" data-id="' + w.id + '">Done</button>' +
      '<button class="bt cutsm dg" data-act="watchDel" data-id="' + w.id + '">Clear</button></div>';

  out += '<div class="pstrip">' + WATCH_KINDS.map(function (k) {
    return '<button class="hintchip' + (w.kind === k ? " on" : "") + '" data-act="watchKind" data-id="' +
      w.id + '" data-k="' + k + '">' + esc(WATCH_KIND_SHORT[k]) + "</button>";
  }).join("") + "</div>";

  out += '<div class="prow" style="margin-top:7px">' +
    '<input class="wfv" value="' + esc(w.what) + '" placeholder="' +
      esc(WATCH_KIND_LABEL[w.kind].toLowerCase()) + " what?\" " +
      'data-act="watchField" data-id="' + w.id + '" data-f="what"></div>';
  out += '<div class="prow" style="margin-top:5px">' +
    '<input class="wfv" value="' + esc(w.outcome) + '" placeholder="So what — “Qee is Held”, “the doors open”…" ' +
      'data-act="watchField" data-id="' + w.id + '" data-f="outcome"></div>';

  out += '<div class="prow" style="margin-top:7px"><span class="lbl">Runs out in</span>' +
    '<input type="number" min="0" style="width:74px" value="' + (w.left == null ? "" : w.left) +
      '" placeholder="—" data-act="watchLeft" data-id="' + w.id + '">' +
    '<select data-act="watchUnit" data-id="' + w.id + '">' +
      '<option value="rounds"' + (w.unit === "rounds" ? " selected" : "") + ">rounds</option>" +
      '<option value="turns"' + (w.unit === "turns" ? " selected" : "") + ">turns</option>" +
    "</select>" +
    '<span class="foot" style="margin:0">Leave blank for no clock</span></div>';

  out += '<textarea class="pnote" placeholder="Anything longer…" data-act="watchField" data-id="' +
    w.id + '" data-f="note">' + esc(w.note) + "</textarea>";
  return out + "</div>";
}

/* Your own effects, rendered the same way everywhere. combat.js owns the
   compact copy that rides on the Combat tab; this is the same list. */
function ownEffectRows() {
  return S.effects.map(function (e, i) {
    const perm = e.rounds == null;
    return '<div class="eff' + (e.conc ? " conc" : "") + '">' +
      '<div class="eh"><span class="en">' + esc(e.name) + "</span>" +
      (e.conc ? '<span class="tag t-y1">Concentration</span>' : "") +
      '<span class="emeta">' + (perm ? "until removed" :
        (e.rounds > 100 ? Math.round(e.rounds / 10) + " min" : e.rounds + " rounds")) + "</span>" +
      '<button class="bt cutsm dg" data-act="effectEnd" data-i="' + i + '">End</button></div>' +
      (e.note ? '<div class="etext">' + esc(e.note) + "</div>" : "") + "</div>";
  }).join("");
}

function effectsTab() {
  const mods = typeof CALC.activeMods === "function" ? CALC.activeMods(S)
    : { ac: 0, attackFlat: 0, attackDice: [], saveDice: [], damageDice: [] };

  let out = '<div class="pnl cut"><h3>On you <span class="cnt">' +
    (S.effects.length || "nothing running") + "</span></h3>";
  if (!S.effects.length) {
    out += '<div class="foot" style="margin:0">Nothing running. Casting something with a duration ' +
      "puts it here and counts it down for you.</div>";
  } else {
    out += ownEffectRows();
    const applied = [];
    if (mods.ac) applied.push((mods.ac > 0 ? "+" : "") + mods.ac + " AC");
    if (mods.attackFlat) applied.push("+" + mods.attackFlat + " attack");
    mods.attackDice.forEach(function (d) { applied.push(d.die + " to attacks (" + d.from + ")"); });
    mods.saveDice.forEach(function (d) { applied.push(d.die + " to saves (" + d.from + ")"); });
    mods.damageDice.forEach(function (d) { applied.push(d.die + " damage (" + d.from + ")"); });
    if (applied.length && S.settings.autoApplyEffects) {
      out += '<div class="seqnote">Applied to your numbers: <b>' + esc(applied.join(" · ")) + "</b></div>";
    }
  }
  out += "</div>";

  const due = S.watch.filter(function (w) { return w.left === 0; });
  out += '<div class="pnl cut"><h3>Everyone else <span class="cnt">' +
    (S.watch.length ? S.watch.length + (due.length ? " · " + due.length + " due now" : "") : "nothing noted") +
    "</span></h3>";

  /* Add fast, detail after — the same bargain the People tab makes. What
     you have at the moment you need to write it down is a name and a
     thing, and often a number someone just said out loud. */
  out += '<div class="prow">' +
    '<input type="text" id="watch-who" placeholder="Who" style="flex:1 1 130px;min-width:110px">' +
    '<input type="text" id="watch-what" placeholder="On what" style="flex:2 1 180px;min-width:130px">' +
    '<select id="watch-kind">' +
      WATCH_KINDS.map(function (k) {
        return '<option value="' + k + '">' + esc(WATCH_KIND_SHORT[k]) + "</option>";
      }).join("") + "</select>" +
    '<input type="number" id="watch-left" min="0" placeholder="—" style="width:70px" title="How long, if you know">' +
    '<select id="watch-unit"><option value="rounds">rounds</option><option value="turns">turns</option></select>' +
    '<button class="bt cutsm pri" data-act="watchAdd">+ Note it</button></div>';

  if (!S.watch.length) {
    out += '<div class="foot">Nothing noted. “Mage · concentrating on · Hold Person” with ' +
      "“Qee is Held” underneath is the shape — but a lair that erupts in ten rounds fits it too.</div>";
  }
  S.watch.forEach(function (w) { out += watchCard(w, false); });
  out += "</div>";

  if (!S.combat.active && S.watch.some(function (w) { return w.left != null; })) {
    out += '<div class="pnl cut"><h3>Clocks are stopped</h3><div class="foot" style="margin:0">' +
      "Countdowns tick when you advance a turn, and you are out of combat — so nothing here " +
      "is moving. Adjust them by hand with −1 and +1 if time is passing another way.</div></div>";
  }
  return out;
}

/* ---------- PEOPLE ----------
   A campaign introduces someone in one line — "a Wulven smith in
   Gloomwood, wary of paladins" — and then never repeats it. What you
   need is somewhere to put that line before it's gone, and the thing
   that stops you is a form: a record with a Race field is a record you
   can't finish, because you don't know the race and the blank sits there
   looking like an error.

   So nothing here is required except a name, and even that can be a
   description. What you know is an ordered list of label/value pairs
   rather than fixed columns — Race and Role are offered as one-tap
   suggestions, never as slots — and a pair you never add simply doesn't
   exist. A record with a name and nothing else is a complete record.

   Individuals and groups are the same shape and the same code, split
   only by `kind`, because a guild has a leader and a seat and a grudge
   the same way a person has a face and a trade and a grudge. What a
   person has extra is membership: which clans, guilds or orders they
   belong to, which is the one relation worth modelling, because it is
   the one you actually ask about at the table ("who else is Ashguard?").

   Two colour axes carry the answers you want at a glance, both cycling
   on tap rather than hiding in a dropdown: standing is how they regard
   YOU, status is whether they're still around at all. */
const PEOPLE_STANDING = ["unknown", "ally", "friendly", "neutral", "wary", "hostile"];
const PEOPLE_STANDING_LABEL = { unknown: "Standing unknown", ally: "Ally", friendly: "Friendly",
  neutral: "Neutral", wary: "Wary", hostile: "Hostile" };
const PEOPLE_STATUS = ["unknown", "alive", "dead", "missing"];
const PEOPLE_STATUS_LABEL = { unknown: "Fate unknown", alive: "Alive", dead: "Dead",
  missing: "Missing" };

/* Offered, never required. One tap adds the labelled pair with an empty
   value, which is the whole point: the label is the part you'd have to
   type, and the value is the part you actually know. */
const PEOPLE_FIELD_HINTS = {
  person: ["Race", "Role", "Where", "Age", "Pronouns", "Looks", "Wants", "Owes", "First met"],
  group:  ["Kind", "Seat", "Leader", "Size", "Trade", "Rivals", "Sign", "First met"]
};

function personById(id) {
  return S.people.filter(function (p) { return p.id === id; })[0] || null;
}
function peopleOfKind(kind) {
  return S.people.filter(function (p) { return p.kind === kind; });
}
function membersOf(groupId) {
  return S.people.filter(function (p) {
    return p.kind === "person" && p.groups.indexOf(groupId) >= 0;
  });
}
/* Fields with something in them. A blank value means you added the label
   and haven't filled it yet, which is worth showing while you're editing
   and worth hiding everywhere else. */
function filledFields(p) {
  return p.fields.filter(function (f) { return f.v.trim() !== ""; });
}

/* Search runs over everything the record holds — name, every label, every
   value, the note, and the names of the groups a person is in — because
   the thing you remember about someone is rarely their name. "Smith",
   "Gloomwood" and "owes me" all have to find the same Wulven. */
function personMatches(p, q) {
  if (!q) return true;
  const hay = [p.name, p.note]
    .concat(p.fields.map(function (f) { return f.k + " " + f.v; }))
    .concat(p.groups.map(function (g) {
      const grp = personById(g);
      return grp ? grp.name : "";
    }))
    .join(" ").toLowerCase();
  return hay.indexOf(q.toLowerCase()) >= 0;
}
function peopleVisible(kind) {
  const q = UI.people.q.trim();
  const st = UI.people.standing;
  return peopleOfKind(kind).filter(function (p) {
    if (st && p.standing !== st) return false;
    return personMatches(p, q);
  });
}

function standingChip(p, clickable) {
  return '<span class="stand s-' + p.standing + '"' +
    (clickable ? ' data-act="peopleStanding" data-id="' + p.id +
      '" title="Tap to cycle how they regard you"' : "") +
    ">" + esc(PEOPLE_STANDING_LABEL[p.standing]) + "</span>";
}
function statusChip(p, clickable) {
  /* An unknown fate is the default and says nothing, so it only appears
     where you can change it. */
  if (p.status === "unknown" && !clickable) return "";
  return '<span class="stand w-' + p.status + '"' +
    (clickable ? ' data-act="peopleStatus" data-id="' + p.id +
      '" title="Tap to cycle whether they are still around"' : "") +
    ">" + esc(PEOPLE_STATUS_LABEL[p.status]) + "</span>";
}

/* The meta line: the first three things you know, labelled. Labelled
   because "Wulven · Smith · Gloomwood" is only legible while you still
   remember which of your own labels you used. */
const PEOPLE_META_FIELDS = 3;
function peopleMetaLine(p) {
  const shown = filledFields(p).slice(0, PEOPLE_META_FIELDS);
  if (!shown.length) return p.kind === "group" ? "A group — nothing noted yet"
                                               : "Nothing noted yet";
  return shown.map(function (f) {
    return (f.k ? '<i class="fk">' + esc(f.k) + "</i> " : "") + esc(f.v);
  }).join(" · ");
}

function peopleCard(p) {
  if (UI.people.edit[p.id]) return peopleEditor(p);
  const open = !!UI.expanded["pp-" + p.id];
  const groups = p.kind === "person" ? p.groups.map(personById).filter(Boolean) : [];
  const members = p.kind === "group" ? membersOf(p.id) : [];
  const extra = Math.max(0, filledFields(p).length - PEOPLE_META_FIELDS);

  /* A face on the record is the whole point of a record about a person:
     "the one-eyed innkeeper" is a description you wrote down because you
     could picture him, and a name in a list is not a picture. It's the
     same sheet the combat strip draws from, so somebody you fought is
     already wearing the face you gave them there. */
  let out = '<div class="card person s-' + p.standing + (p.status === "dead" ? " gone" : "") + '">' +
    '<button class="facebtn pface" data-act="tokenModal" data-kind="person" data-id="' + p.id +
      '" title="Pick a face for ' + esc(p.name || "this one") + '">' +
      tokenFace({ token: p.token, name: p.name }) + "</button>" +
    '<button class="namebtn cardname" data-act="expand" data-id="pp-' + p.id + '">' +
      esc(p.name || "(unnamed)") + "</button>" +
    '<span class="cardmeta">' + peopleMetaLine(p) + "</span>" +
    '<div class="cardtags">' + standingChip(p, false) + statusChip(p, false) +
      groups.map(function (g) {
        return '<span class="stand grp-of" data-act="peopleSearchTo" data-q="' + esc(g.name) + '">' +
          esc(g.name) + "</span>";
      }).join("") +
      (members.length ? '<span class="stand grp-of">' + members.length + " member" +
        (members.length === 1 ? "" : "s") + "</span>" : "") + "</div>" +
    '<div class="cardbtns">' +
      '<button class="bt cutsm" data-act="expand" data-id="pp-' + p.id + '">' +
        (open ? "Less" : (extra ? "More +" + extra : "More")) + "</button>" +
      '<button class="bt cutsm" data-act="peopleEdit" data-id="' + p.id + '">Edit</button>' +
    "</div>";

  if (open) {
    out += '<div class="carddetail">';
    const fields = filledFields(p);
    if (fields.length) {
      fields.forEach(function (f) {
        out += '<div class="kv"><span>' + esc(f.k || "—") + "</span><span>" + esc(f.v) + "</span></div>";
      });
    }
    if (members.length) {
      out += '<div class="kv"><span>Members</span><span>' +
        members.map(function (m) { return esc(m.name); }).join(", ") + "</span></div>";
    }
    if (p.note.trim()) {
      out += '<div class="etext" style="margin-top:7px">' +
        esc(p.note).replace(/\n/g, "<br>") + "</div>";
    }
    if (!fields.length && !members.length && !p.note.trim()) {
      out += '<div class="foot" style="margin:0">Only a name so far — tap Edit to add what you know</div>';
    }
    out += "</div>";
  }
  return out + "</div>";
}

/* The editor is the card with its text turned into fields, in place, so
   you never lose sight of what you are editing. */
function peopleEditor(p) {
  const hints = PEOPLE_FIELD_HINTS[p.kind] || PEOPLE_FIELD_HINTS.person;
  const used = p.fields.map(function (f) { return f.k.toLowerCase(); });

  let out = '<div class="card carded person s-' + p.standing + '">' +
    '<div class="prow">' +
    '<button class="facebtn pface" data-act="tokenModal" data-kind="person" data-id="' + p.id +
      '" title="Pick a face">' + tokenFace({ token: p.token, name: p.name }) + "</button>" +
    '<input class="pname" value="' + esc(p.name) +
      '" placeholder="' + (p.kind === "group" ? "Name of the clan, guild or order" : "Name, or what you call them") +
      '" data-act="peopleName" data-id="' + p.id + '">' +
    '<button class="bt cutsm pri" data-act="peopleEdit" data-id="' + p.id + '">Done</button>' +
    '<button class="bt cutsm dg" data-act="peopleDel" data-id="' + p.id + '">Delete</button></div>';

  out += '<div class="pstrip">' + standingChip(p, true) + statusChip(p, true) + "</div>";

  /* What you know, one row each. The label is editable too — the
     suggestions are a shortcut, not a vocabulary. */
  out += '<div class="pfields">';
  p.fields.forEach(function (f, i) {
    out += '<div class="pfield">' +
      '<input class="pfk" value="' + esc(f.k) + '" placeholder="Label" data-act="peopleField" data-id="' +
        p.id + '" data-i="' + i + '" data-part="k">' +
      '<input class="pfv" value="' + esc(f.v) + '" placeholder="What you know" data-act="peopleField" data-id="' +
        p.id + '" data-i="' + i + '" data-part="v">' +
      '<button class="bt cutsm dg" data-act="peopleFieldDel" data-id="' + p.id +
        '" data-i="' + i + '" title="Remove this detail">×</button></div>';
  });
  out += "</div>";

  out += '<div class="phints"><span class="lbl">Add</span>' +
    hints.filter(function (h) { return used.indexOf(h.toLowerCase()) < 0; }).map(function (h) {
      return '<button class="hintchip" data-act="peopleFieldAdd" data-id="' + p.id +
        '" data-k="' + esc(h) + '">' + esc(h) + "</button>";
    }).join("") +
    '<button class="hintchip own" data-act="peopleFieldAdd" data-id="' + p.id +
      '" data-k="">Something else</button></div>';

  if (p.kind === "person") {
    const groups = peopleOfKind("group");
    out += '<div class="phints"><span class="lbl">Belongs to</span>' +
      (groups.length
        ? groups.map(function (g) {
            const on = p.groups.indexOf(g.id) >= 0;
            return '<button class="hintchip' + (on ? " on" : "") + '" data-act="peopleGroup" data-id="' +
              p.id + '" data-g="' + g.id + '">' + esc(g.name || "(unnamed)") + "</button>";
          }).join("")
        : '<span class="foot" style="margin:0">No clans or guilds yet — add one below</span>') +
      "</div>";
  }

  out += '<textarea class="pnote" placeholder="Anything longer — how you met, what they said, what they want…" ' +
    'data-act="peopleNote" data-id="' + p.id + '">' + esc(p.note) + "</textarea>";
  return out + "</div>";
}

function peopleTab() {
  const q = UI.people.q;
  const persons = peopleVisible("person");
  const groups = peopleVisible("group");
  const total = S.people.length;

  let out = '<div class="pnl cut"><h3>Who you know <span class="cnt">' +
    peopleOfKind("person").length + " people · " + peopleOfKind("group").length +
    " clans &amp; guilds</span></h3>";

  /* Add first, and with no ceremony: a name and a button. Everything else
     about a record can be filled in later, or never. */
  out += '<div class="prow">' +
    '<input type="text" id="people-new" placeholder="Name — or “the one-eyed innkeeper”…" style="flex:1;min-width:180px">' +
    '<button class="bt cutsm pri" data-act="peopleAdd" data-kind="person">+ Person</button>' +
    '<button class="bt cutsm pri" data-act="peopleAdd" data-kind="group">+ Clan or guild</button></div>';

  if (total) {
    out += '<div class="prow" style="margin-top:9px">' +
      '<input type="text" placeholder="Search names, details, notes…" value="' + esc(q) +
        '" data-act="peopleSearch" style="flex:1;min-width:170px">' +
      (q ? '<button class="bt cutsm" data-act="peopleSearchClear">Clear</button>' : "") + "</div>";
    out += '<div class="pstrip" style="margin-top:7px"><span class="lbl">Standing</span>' +
      PEOPLE_STANDING.map(function (s) {
        const on = UI.people.standing === s;
        const n = S.people.filter(function (p) { return p.standing === s; }).length;
        if (!n && !on) return "";
        return '<button class="stand s-' + s + (on ? " sel" : " off") +
          '" data-act="peopleFilter" data-v="' + s + '">' +
          esc(PEOPLE_STANDING_LABEL[s]) + " " + n + "</button>";
      }).join("") +
      (UI.people.standing ? '<button class="bt cutsm" data-act="peopleFilter" data-v="">Clear</button>' : "") +
      "</div>";
  } else {
    out += '<div class="foot">Nobody yet. Add the innkeeper before you forget his name — ' +
      "a record needs nothing but that, and everything else can wait.</div>";
  }
  out += "</div>";

  out += '<div class="pnl cut"><h3>People <span class="cnt">' + persons.length +
    (persons.length === peopleOfKind("person").length ? "" : " of " + peopleOfKind("person").length) +
    "</span></h3>";
  if (!persons.length) {
    out += '<div class="foot" style="margin:0">' +
      (peopleOfKind("person").length ? "Nobody matches that." : "No individuals yet.") + "</div>";
  }
  persons.forEach(function (p) { out += peopleCard(p); });
  out += "</div>";

  out += '<div class="pnl cut"><h3>Clans &amp; guilds <span class="cnt">' + groups.length +
    (groups.length === peopleOfKind("group").length ? "" : " of " + peopleOfKind("group").length) +
    "</span></h3>";
  if (!groups.length) {
    out += '<div class="foot" style="margin:0">' +
      (peopleOfKind("group").length ? "Nothing matches that."
        : "No clans, guilds or orders yet. Add one and people can be put in it.") + "</div>";
  }
  groups.forEach(function (p) { out += peopleCard(p); });
  out += "</div>";

  return out;
}

/* The general rules a follower drags in with it. Verbatim from the SRD,
   because half-remembered mounted-combat rules are how a fight stalls. */
/* ---------- MAP: RESOLVING CANON AGAINST YOUR EDITS ----------
   cyrnn-data.js is the world as written; S.map is what you have done to
   it. Nothing draws from either alone — everything goes through here,
   so a pin you nudged is nudged in the atlas and the map at once, and a
   place added to the data file later simply shows up.

   A canonical place keeps its id forever, which is what lets an edit be
   a delta rather than a copy. Your own pins take a "c-" prefix so the
   two id spaces can never collide. */
function mapPins() {
  const M = S.map;
  const out = [];
  CYRNN.places.forEach(function (p) {
    const e = M.edits[p.id] || {};
    if (e.hidden) return;
    out.push({
      id: p.id, name: e.name || p.name, kind: p.kind, region: p.region,
      x: e.x == null ? p.x : e.x, y: e.y == null ? p.y : e.y,
      groups: p.groups || [], tags: p.tags || [], blurb: p.blurb, lore: p.lore,
      approx: !!p.approx, moved: e.x != null, renamed: !!e.name, custom: false
    });
  });
  M.custom.forEach(function (c) {
    out.push({
      id: c.id, name: c.name, kind: c.kind || "marker", region: c.region || null,
      x: c.x, y: c.y, groups: [], tags: [], blurb: "", lore: c.note || "",
      approx: false, moved: false, renamed: false, custom: true
    });
  });
  return out;
}

function mapPin(id) {
  const all = mapPins();
  for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

/* Every scope a pin answers to, for the calendar and lore joins. Your
   own pins answer to themselves, and to a region if you filed them
   under one — so a marker dropped in Müür still picks up Müür's feasts. */
function mapScopes(pin) {
  if (!pin) return [];
  if (!pin.custom) return CYRNN.scopesFor(pin.id);
  return pin.region ? [pin.id, pin.region] : [pin.id];
}

/* Hidden places are recoverable, never destroyed — the count is what the
   Atlas offers to restore. */
function mapHiddenIds() {
  return Object.keys(S.map.edits).filter(function (k) { return S.map.edits[k].hidden; });
}

function newPinId() { return "c-" + Date.now().toString(36) + Math.floor(Math.random() * 1e3); }

/* A log line quotes enough of a note to be recognised later without
   copying the whole thing into the recap — the note itself lives on the
   place, and that is where you go to read it. */
const NOTE_GIST_CHARS = 90;
function shortenNote(text) {
  const one = String(text || "").replace(/\s+/g, " ").trim();
  return one.length > NOTE_GIST_CHARS ? one.slice(0, NOTE_GIST_CHARS - 1) + "…" : one;
}

/* The pin closest to a point, so "where is that?" can be answered in
   place names rather than coordinates. Straight-line distance across
   the image is not a travel time and is never offered as one. */
function mapNearest(x, y, excludeId) {
  let near = null, best = Infinity;
  mapPins().forEach(function (q) {
    if (q.id === excludeId) return;
    const d = Math.pow(q.x - x, 2) + Math.pow(q.y - y, 2);
    if (d < best) { best = d; near = q; }
  });
  return near;
}

/* What a piece of your own lore is filed under, named for the log. */
function mapScopeName(scope) {
  if (!scope || scope === "__world") return "the world";
  const pin = mapPin(scope);
  if (pin) return pin.name;
  const r = CYRNN.region(scope);
  return r ? r.name : scope;
}

/* ---------- MAP TAB ---------- */
function mapTab() {
  return mapPanel() + mapSelectedPanel() + atlasPanel() + worldLorePanel();
}

/* Kinds whose names the mapmaker already wrote on the paper, plus the
   two ruins that would otherwise crowd the Fracture — they are history,
   not somewhere you are trying to walk to. Their pins stay; only the
   label waits for you to zoom in. */
const MAP_QUIET_KINDS = { forest: 1, swamp: 1, hills: 1, mountains: 1, sea: 1,
                          island: 1, road: 1, wall: 1, ruin: 1 };
const MAP_LABEL_ZOOM = 1.8;

/* The legend, and the filter, and the colour families — one list, so
   they can never disagree. Grouped rather than one switch per kind:
   thirteen kinds is a wall of chips, and nobody wants "hide swamps" on
   its own. These six are the distinctions you actually make when
   looking for something on a map. */
const MAP_FILTERS = [
  { id: "cities", label: "Cities", kinds: ["city"] },
  { id: "towns",  label: "Towns",  kinds: ["town", "warren"] },
  { id: "ruins",  label: "Ruins",  kinds: ["ruin"] },
  { id: "wilds",  label: "Wilds",  kinds: ["forest", "swamp", "hills", "mountains", "sea", "island"] },
  { id: "routes", label: "Routes", kinds: ["road", "wall"] },
  { id: "mine",   label: "Yours",  kinds: ["marker"] }
];

function mapGroupOf(pin) {
  if (pin.custom) return "mine";
  for (let i = 0; i < MAP_FILTERS.length; i++) {
    if (MAP_FILTERS[i].kinds.indexOf(pin.kind) >= 0) return MAP_FILTERS[i].id;
  }
  return "towns";   /* an unrecognised kind is still somewhere you go */
}

/* Sparse: only the groups switched OFF are stored, so a group added
   later starts visible rather than silently absent. */
function mapGroupOn(id) { return !(S.map.off || {})[id]; }

function mapVisiblePins() {
  return mapPins().filter(function (p) { return mapGroupOn(mapGroupOf(p)); });
}

const MAP_MODES = [
  ["look",  "Look",       "Tap a pin to read it"],
  ["move",  "Move pins",  "Drag any pin to correct it"],
  ["add",   "Add pin",    "Tap the map to drop your own"],
  ["party", "Party here", "Tap the map to move the party"]
];

function mapPanel() {
  const m = UI.map;
  const pins = mapPins();
  const mode = MAP_MODES.filter(function (r) { return r[0] === m.mode; })[0] || MAP_MODES[0];

  let out = '<div class="pnl cut"><h3 class="headwrap">The Map <span class="cnt">Cyrnn</span>' +
    '<span class="calviews">' +
      '<button class="bt cutsm" data-act="mapZoom" data-d="-1">−</button>' +
      '<button class="bt cutsm" data-act="mapFit">Fit</button>' +
      '<button class="bt cutsm" data-act="mapZoom" data-d="1">+</button>' +
    "</span></h3>";

  out += '<div class="mapmodes">' + MAP_MODES.map(function (r) {
    return '<button class="bt cutsm' + (r[0] === m.mode ? " pri" : "") +
      '" data-act="mapMode" data-mode="' + r[0] + '">' + esc(r[1]) + "</button>";
  }).join("") +
    '<button class="tg' + (S.map.showLabels ? " on" : "") +
      '" data-act="mapLabels">Labels</button>' +
    '<span class="foot" style="margin:0">' + esc(mode[2]) + "</span></div>";

  /* The legend doubles as the filter — each swatch is the pin you are
     looking for, and switching it off takes that class off the map. */
  const counts = {};
  pins.forEach(function (p) {
    const g = mapGroupOf(p);
    counts[g] = (counts[g] || 0) + 1;
  });
  let anyOff = false;
  out += '<div class="maplegend">' + MAP_FILTERS.map(function (f) {
    const n = counts[f.id] || 0;
    const on = mapGroupOn(f.id);
    if (!on) anyOff = true;
    return '<button class="lgd g-' + f.id + (on ? " on" : "") +
      '" data-act="mapFilter" data-key="' + f.id + '"' +
      (n ? "" : ' disabled aria-disabled="true"') + ">" +
      '<i class="mdot"></i>' + esc(f.label) + '<b>' + n + "</b></button>";
  }).join("") +
    (anyOff ? '<button class="bt cutsm" data-act="mapFilterAll">Show all</button>' : "") +
    "</div>";

  /* The stage carries the camera, and --z lets each pin cancel the scale
     so a pin stays the same size on screen however far you zoom in. */
  out += '<div class="mapview" data-act="mapSurface">' +
    '<div class="mapstage' + (m.zoom >= MAP_LABEL_ZOOM ? " zoomed" : "") +
      '" style="--z:' + m.zoom +
      ';transform:translate(' + m.x + "px," + m.y + "px) scale(" + m.zoom + ')">' +
    '<img class="mapimg" src="map-cyrnn.jpg" alt="The world of Cyrnn" draggable="false">';

  const shown = pins.filter(function (p) { return mapGroupOn(mapGroupOf(p)); });
  shown.forEach(function (p) {
    out += '<button class="mpin k-' + esc(p.kind) + (m.sel === p.id ? " sel" : "") +
      (p.custom ? " own" : "") + (MAP_QUIET_KINDS[p.kind] ? " quiet" : "") +
      '" style="left:' + p.x + "%;top:" + p.y + '%" ' +
      'data-act="mapPin" data-id="' + esc(p.id) + '" title="' + esc(p.name) + '">' +
      '<i class="mdot"></i>' +
      (S.map.showLabels ? '<span class="mlab">' + esc(p.name) + "</span>" : "") +
      "</button>";
  });

  if (S.map.party) {
    out += '<button class="mpin party" style="left:' + S.map.party.x + "%;top:" +
      S.map.party.y + '%" data-act="mapPin" data-id="__party" title="The party">' +
      '<i class="mdot"></i><span class="mlab">Party</span></button>';
  }

  out += "</div></div>";

  const hidden = mapHiddenIds().length;
  out += '<div class="foot">' + shown.length +
    (shown.length === pins.length ? " pins" : " of " + pins.length + " pins") +
    (S.map.party ? " · party placed" : " · party not placed") +
    (hidden ? " · " + hidden + " hidden" : "") +
    ' · zoom <b class="mapzoom">' + Math.round(m.zoom * 100) + "%</b></div>";
  return out + "</div>";
}

/* Lore is stored as one string with blank lines between paragraphs,
   the way the source reads. */
function loreHTML(text) {
  return String(text || "").split(/\n\n+/).filter(Boolean).map(function (para) {
    return '<div class="etext">' + esc(para) + "</div>";
  }).join("");
}

function mapSelectedPanel() {
  const id = UI.map.sel;
  if (!id) return "";
  if (id === "__party") return partyPanel();
  const pin = mapPin(id);
  const region = pin ? null : CYRNN.region(id);
  if (!pin && !region) return "";
  return pin ? placePanel(pin) : regionPanel(region);
}

function partyPanel() {
  const p = S.map.party;
  if (!p) return "";
  const near = mapNearest(p.x, p.y);
  return '<div class="pnl cut"><h3>The party</h3>' +
    '<div class="etext">Standing ' +
      (near ? "nearest to <b>" + esc(near.name) + "</b>" : "somewhere in Cyrnn") + ".</div>" +
    '<div class="mrow" style="margin-top:10px">' +
      '<button class="bt cutsm" data-act="mapMode" data-mode="party">Move the party</button>' +
      '<button class="bt cutsm dg" data-act="mapClearParty">Take the party off the map</button>' +
    "</div></div>";
}

function placePanel(p) {
  const scopes = mapScopes(p);
  const region = p.region ? CYRNN.region(p.region) : null;
  const editing = UI.map.mode === "move";

  let out = '<div class="pnl cut"><h3>' + esc(p.name) +
    '<span class="cnt">' + esc(p.kind) + (region ? " · " + esc(region.name) : "") + "</span></h3>";

  if (p.custom) {
    out += '<div class="mrow"><span class="lbl">Name</span>' +
      '<input type="text" value="' + esc(p.name) + '" data-act="mapRename" data-id="' +
      esc(p.id) + '" style="flex:1;min-width:160px"></div>';
  } else if (p.blurb) {
    out += '<div class="advice"><span class="advk">In short</span>' +
      '<span class="advt">' + esc(p.blurb) + "</span></div>";
  }

  if (p.approx) {
    out += '<div class="warnbox">The source describes this place but never draws it. ' +
      'The pin is placed from its description — move it if you know better.</div>';
  }

  out += loreHTML(p.lore);

  if (p.tags.length) out += '<div style="margin-top:8px">' + tagHTML(p.tags, false) + "</div>";

  /* What the calendar says is kept here — the join, drawn. */
  const feasts = CAL.holidaysForScopes(scopes);
  const localFeasts = feasts.filter(function (f) { return f.local; });
  if (localFeasts.length) {
    out += '<div class="sbk">Kept here</div>';
    localFeasts.forEach(function (f) {
      out += calFeastRow(f);
    });
    const also = feasts.length - localFeasts.length;
    if (also) {
      out += '<div class="foot">' + also + " further pan-regional feast" +
        (also === 1 ? " is" : "s are") + " kept here too.</div>";
    }
  } else if (feasts.length) {
    out += '<div class="sbk">Kept here</div>' +
      '<div class="foot">Only the pan-regional feasts — ' + feasts.length + " of them.</div>";
  }

  /* Powers and peoples that answer to the same scopes. */
  const pinned = CYRNN.lorePinnedTo(scopes);
  if (pinned.powers.length || pinned.peoples.length) {
    out += '<div class="sbk">Of this place</div>';
    pinned.powers.forEach(function (e) {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(e.name) +
        '</span><span class="emeta">' + esc(e.title) + "</span></div>" +
        '<div class="etext">' + esc(e.blurb) + "</div></div>";
    });
    pinned.peoples.forEach(function (e) {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(e.name) +
        '</span><span class="emeta">people</span></div>' +
        '<div class="etext">' + esc(e.blurb) + "</div></div>";
    });
  }

  out += yourNotesHTML(p.id);
  out += scopedLoreHTML(p.id);

  /* Actions. Hiding is reversible and says so; only your own pins can
     actually be deleted, because a canonical one would come straight
     back the next time the data file loads. */
  out += '<div class="mrow" style="margin-top:12px;padding-top:11px;border-top:1px solid var(--line)">' +
    '<button class="bt cutsm" data-act="mapPartyHere" data-id="' + esc(p.id) +
      '">Party is here</button>' +
    '<button class="bt cutsm" data-act="mapFocus" data-id="' + esc(p.id) + '">Centre on it</button>' +
    (editing ? "" : '<button class="bt cutsm" data-act="mapMode" data-mode="move">Move pins</button>') +
    (p.custom
      ? '<button class="bt cutsm dg" data-act="mapDelete" data-id="' + esc(p.id) + '">Delete</button>'
      : '<button class="bt cutsm dim" data-act="mapHide" data-id="' + esc(p.id) + '">Hide</button>') +
    (p.moved || p.renamed
      ? '<button class="bt cutsm dim" data-act="mapReset" data-id="' + esc(p.id) +
        '">Undo my changes</button>' : "") +
    "</div>";

  return out + "</div>";
}

function calFeastRow(f) {
  const sysKey = S.calendar.system;
  return '<div class="entry"><div class="eh">' +
    '<span class="en">' + esc(f.holiday.name) + "</span>" +
    '<span class="emeta">' + esc(CAL.format(sysKey, f.holiday.day)) +
      " · day " + f.holiday.day + "</span>" +
    '<span class="esrc">' + esc(f.holiday.regionLabel) + "</span></div>" +
    '<div class="etext">' + esc(f.holiday.lore) + "</div></div>";
}

function regionPanel(r) {
  const scopes = CYRNN.scopesForRegion(r.id);
  let out = '<div class="pnl cut"><h3>' + esc(r.name) + '<span class="cnt">region</span></h3>' +
    '<div class="advice"><span class="advk">In short</span>' +
    '<span class="advt">' + esc(r.blurb) + "</span></div>" +
    loreHTML(r.lore);

  const places = CYRNN.placesIn(r.id);
  if (places.length) {
    out += '<div class="sbk">Places</div>';
    places.forEach(function (p) {
      const live = mapPin(p.id);
      out += '<div class="row" data-act="mapPin" data-id="' + esc(p.id) + '">' +
        "<span>" + esc(live ? live.name : p.name) + "</span>" +
        '<span class="sc">' + esc(p.kind) + (live ? "" : " · hidden") + "</span></div>";
    });
  }

  const feasts = CAL.holidaysForScopes(scopes).filter(function (f) { return f.local; });
  if (feasts.length) {
    out += '<div class="sbk">Kept in ' + esc(r.name) + "</div>";
    feasts.forEach(function (f) { out += calFeastRow(f); });
  }

  const pinned = CYRNN.lorePinnedTo(scopes);
  if (pinned.powers.length || pinned.peoples.length) {
    out += '<div class="sbk">Of this region</div>';
    pinned.powers.concat(pinned.peoples).forEach(function (e) {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(e.name) +
        "</span>" + (e.title ? '<span class="emeta">' + esc(e.title) + "</span>" : "") +
        "</div><div class=\"etext\">" + esc(e.blurb) + "</div></div>";
    });
  }

  out += yourNotesHTML(r.id);
  out += scopedLoreHTML(r.id);
  return out + "</div>";
}

/* Your own text sits under the source's, never over it — so an update to
   cyrnn-data.js can never overwrite something you wrote. */
function yourNotesHTML(id) {
  const val = S.map.notes[id] || "";
  return '<div class="sbk">Your notes</div>' +
    '<textarea class="notes" style="min-height:80px" placeholder="What your table knows about this place…" ' +
    'data-act="mapNote" data-id="' + esc(id) + '">' + esc(val) + "</textarea>";
}

function scopedLoreHTML(id) {
  const mine = S.map.lore.filter(function (l) { return l.scope === id; });
  let out = "";
  if (mine.length) {
    out += '<div class="sbk">Your lore</div>';
    mine.forEach(function (l) {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(l.title) +
        '</span><span class="hb">yours</span>' +
        '<button class="x bt cutsm dim" data-act="mapLoreDelete" data-id="' + esc(l.id) +
        '" style="margin-left:auto">Remove</button></div>' + loreHTML(l.body) + "</div>";
    });
  }
  out += '<div class="daypadd">' +
    '<input type="text" placeholder="Title" data-lore-title="' + esc(id) + '">' +
    '<button class="bt cutsm pri" data-act="mapLoreAdd" data-scope="' + esc(id) +
    '">Add lore</button></div>' +
    '<textarea class="notes" style="min-height:70px;margin-top:6px" placeholder="The entry itself…" ' +
    'data-lore-body="' + esc(id) + '"></textarea>';
  return out;
}

function atlasPanel() {
  const q = UI.map.q || "";
  let out = '<div class="pnl cut"><h3>Atlas <span class="cnt">' +
    CYRNN.places.length + " places · " + CYRNN.regions.length + " regions</span></h3>" +
    '<div class="mrow"><input type="text" placeholder="Search the world…" value="' + esc(q) +
    '" data-act="mapSearch" style="flex:1;min-width:180px">' +
    (q ? '<button class="bt cutsm" data-act="mapSearchClear">Clear</button>' : "") + "</div>";

  if (q) {
    const hits = CYRNN.search(q);
    if (!hits.length) return out + '<div class="foot">Nothing in the world matches that.</div></div>';
    out += '<div class="foot">' + hits.length + " match" + (hits.length === 1 ? "" : "es") + "</div>";
    hits.forEach(function (h) {
      out += '<div class="row" data-act="mapPin" data-id="' + esc(h.entry.id) + '">' +
        "<span>" + esc(h.entry.name) + "</span>" +
        '<span class="sc">' + esc(h.type) + "</span></div>";
    });
    return out + "</div>";
  }

  CYRNN.regions.forEach(function (r) {
    const places = CYRNN.placesIn(r.id);
    out += '<div class="grp">' + esc(r.name) + "</div>" +
      '<div class="row" data-act="mapPin" data-id="' + esc(r.id) + '">' +
      '<span><i class="dot exp"></i>About ' + esc(r.name) + "</span>" +
      '<span class="sc">' + places.length + " place" + (places.length === 1 ? "" : "s") + "</span></div>";
    places.forEach(function (p) {
      const live = mapPin(p.id);
      out += '<div class="row' + (live ? "" : " unprof") + '" data-act="mapPin" data-id="' +
        esc(p.id) + '"><span>' + esc(live ? live.name : p.name) + "</span>" +
        '<span class="sc">' + esc(p.kind) + (live ? "" : " · hidden") + "</span></div>";
    });
  });

  const own = S.map.custom;
  if (own.length) {
    out += '<div class="grp">Your markers</div>';
    own.forEach(function (c) {
      out += '<div class="row prof" data-act="mapPin" data-id="' + esc(c.id) + '">' +
        "<span>" + esc(c.name) + '</span><span class="sc">yours</span></div>';
    });
  }

  const hidden = mapHiddenIds();
  if (hidden.length) {
    out += '<div class="grp">Hidden</div>';
    hidden.forEach(function (id) {
      const p = CYRNN.place(id);
      if (!p) return;
      out += '<div class="row unprof" data-act="mapRestore" data-id="' + esc(id) + '">' +
        "<span>" + esc(p.name) + '</span><span class="sc">restore</span></div>';
    });
  }

  return out + "</div>";
}

function worldLorePanel() {
  let out = '<div class="pnl cut"><h3>The world <span class="cnt">gods, devils, history</span></h3>';

  out += '<div class="sbk">History</div>';
  CYRNN.eras.forEach(function (e) {
    out += '<div class="entry"><div class="eh"><span class="en">' + esc(e.name) +
      '</span><span class="emeta">' + esc(e.when) + "</span></div>" +
      loreHTML(e.lore) + "</div>";
  });

  ["divine", "lesser", "devil"].forEach(function (rank) {
    const list = CYRNN.powers.filter(function (p) { return p.rank === rank; });
    if (!list.length) return;
    out += '<div class="sbk">' +
      (rank === "divine" ? "Divine gods" : rank === "lesser" ? "Lesser gods" : "Devils of Cyrnn") +
      "</div>";
    list.forEach(function (p) {
      out += '<div class="entry"><div class="eh"><span class="en">' + esc(p.name) +
        '</span><span class="emeta">' + esc(p.title) + "</span>" +
        '<span class="esrc">' + esc(p.status) + "</span></div>" +
        loreHTML(p.lore) + "</div>";
    });
  });

  out += '<div class="sbk">Peoples</div>';
  CYRNN.peoples.forEach(function (p) {
    out += '<div class="entry"><div class="eh"><span class="en">' + esc(p.name) + "</span></div>" +
      loreHTML(p.lore) + "</div>";
  });

  /* World-level lore: yours, filed under nothing in particular. */
  out += '<div class="sbk">Your lore</div>' + scopedLoreHTML("__world");
  return out + "</div>";
}

function combatRulesPanel() {
  let out = "";
  COMBAT_RULES.sections.forEach(function (sec) {
    out += '<div class="pnl cut"><h3>' + esc(sec.name) +
      '<span class="cnt">' + esc(COMBAT_RULES.source) + "</span></h3>" +
      '<div class="etext" style="margin-bottom:10px">' + esc(sec.intro) + "</div>";
    sec.parts.forEach(function (p) {
      out += '<div class="ruleline"><span class="rn">' + esc(p.name) + "</span>" +
        '<span class="rt">' + esc(p.text) + "</span></div>";
    });
    if (sec.key === "mounted") {
      out += '<div class="seqnote">Hal is <b>' + esc(S.identity.size) + "</b>, so a mount must be " +
        "<b>" + esc(SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, SIZE_ORDER.indexOf(S.identity.size) + 1)]) +
        "</b> or larger. Half his Speed is <b>" + Math.floor(S.identity.speed / 2) +
        " ft</b>, which is what mounting or dismounting costs.</div>";
    }
    out += "</div>";
  });
  return out;
}

/* ---------- CALENDAR ----------
   Two things at once, kept deliberately separate: the date the party is
   living in (S.calendar — only the "Set the date" controls move it), and
   the date you're looking at (UI.cal — the browsing cursor, which paging
   around the month never confuses with time actually passing). */
function calendarTab() {
  const cal = S.calendar;
  const sysKey = cal.system;
  const sys = CAL.system(sysKey);
  const other = CAL.system(sysKey === "jerbeen" ? "common" : "jerbeen");
  const month = CAL.monthFor(sysKey, cal.day);
  const holidays = CAL.allHolidaysFor(cal.day);
  const next = CAL.nextHoliday(sysKey, cal.day);

  /* The calendar itself leads: it's the thing you came to the tab to look
     at, and the reckoning switch belongs with it rather than filed under
     the date controls at the bottom. Then today, then writing something
     down, then the machinery for moving the party's date — which is the
     rarest thing you do here and so goes last. */
  let out = calBrowser();

  /* ---- Today ---- */
  out += '<div class="pnl cut"><h3>Today <span class="cnt">Day ' + cal.day +
    " of " + CAL.daysPerYear + "</span></h3>" +
    '<div class="calday">' + esc(CAL.format(sysKey, cal.day)) + "</div>" +
    '<div class="calsub">' + esc(CAL.yearLabel(sysKey, cal.year)) + " · " + esc(month.season) +
      " · " + esc(CAL.timeLabel(cal.timeOfDay)) + "</div>" +
    '<div class="calalt">' + esc(other.label) + " reckoning: <b>" +
      esc(CAL.format(other.key, cal.day)) + "</b></div>";

  if (holidays.length) {
    holidays.forEach(function (h) {
      out += '<div class="calfeast"><div class="cfname">' + esc(h.holiday.name) +
        ' <span class="bdg">' + esc(h.label) + "</span></div>" +
        '<div class="etext">' + esc(h.holiday.lore) + "</div></div>";
    });
    if (holidays.length > 1) {
      out += '<div class="seqnote">Both calendars mark this day — a rare alignment.</div>';
    }
  }

  out += '<div class="etext" style="margin-top:9px">' + esc(month.lore) + "</div>";
  if (next) {
    out += '<div class="foot">' + (next.inDays === 0
      ? "Today is " + esc(next.holiday.name) + "."
      : "Next in the " + esc(sys.label) + " calendar: <b>" + esc(next.holiday.name) +
        "</b> in " + next.inDays + " day" + (next.inDays === 1 ? "" : "s") + ".") + "</div>";
  }

  /* Quick note straight from here — the date you're looking at is the date
     the note gets stamped with. */
  if (S.session.active) {
    out += '<div class="mrow" style="margin-top:10px">' +
      '<input type="text" placeholder="Note for ' + esc(CAL.format(sysKey, cal.day)) + '…">' +
      '<button class="bt cutsm pri" data-act="addSessionNote">Add note</button></div>';
  }
  out += "</div>";

  /* ---- Write something down ---- */
  out += calAddNotePanel();

  /* ---- Controls ---- */
  out += '<div class="pnl cut"><h3>Set the date</h3>' +
    '<div class="mrow"><span class="lbl">Time of day</span>' +
    '<button class="bt cutsm" data-act="advanceTime">' +
      esc(CAL.timeLabel(cal.timeOfDay)) + " →</button>" +
    '<span class="foot" style="margin:0">Past Night rolls into the next dawn.</span></div>' +
    '<div class="mrow"><span class="lbl">Day</span>' +
    '<button class="bt cutsm" data-act="advanceDay" data-d="-1">−1</button>' +
    '<button class="bt cutsm" data-act="advanceDay" data-d="1">+1</button>' +
    '<button class="bt cutsm" data-act="advanceDay" data-d="7">+7</button>' +
    '<button class="bt cutsm" data-act="advanceDay" data-d="28">+28</button></div>' +
    /* Stepping is fine for a day or a week, but a year is 364 taps and
       one mistap restarts the count. So the date is also directly
       editable: type the year, pick the month, type the day. */
    '<div class="mrow caljump"><span class="lbl">Jump to</span>' +
    '<span class="cjk">Year</span>' +
    '<input type="number" value="' + cal.year + '" data-act="calSetYear" style="width:104px">' +
    '<span class="cjk">Month</span>' +
    '<select data-act="calJumpMonth">' +
      sys.months.map(function (mo, i) {
        return '<option value="' + i + '"' + (mo.name === month.name ? " selected" : "") +
          ">" + esc(mo.name) + "</option>";
      }).join("") + "</select>" +
    '<span class="cjk">Day</span>' +
    '<input type="number" min="1" max="' + (month.end - month.start + 1) +
      '" value="' + CAL.dayOfMonth(sysKey, cal.day) + '" data-act="calSetDayOfMonth" style="width:78px">' +
    "</div>" +
    '<div class="foot">Editing these moves the party’s date, not just the view. ' +
      "The Common calendar reckons from the Great Fracture, so the campaign opens in 2022 PF.</div>" +
    "</div>";

  return out;
}

/* Month, week and day all draw the same underlying thing at different
   zooms, so they share the cursor, the marks, and the day editor. */
function calBrowser() {
  const cal = S.calendar;
  const sysKey = cal.system;
  const sys = CAL.system(sysKey);
  const view = cal.view || "month";
  const cur = calCursor();
  const month = CAL.monthFor(sysKey, cur.day);

  let title, nav;
  if (view === "day") {
    title = CAL.weekdayName(sysKey, cur.day) + " · " + CAL.format(sysKey, cur.day);
    nav = calNavRow(-1, 1, "calStep", "Today");
  } else if (view === "week") {
    title = "Week " + CAL.weekIndex(cur.day) + " · days " +
      CAL.weekStart(cur.day) + "–" + (CAL.weekStart(cur.day) + 6);
    nav = calNavRow(-7, 7, "calStep", "This week");
  } else if (view === "month") {
    title = month.name + " · " + month.season;
    nav = calNavRow(-1, 1, "calStepMonth", "This month");
  } else {
    title = sys.label + " year " + cur.year;
    nav = calNavRow(-CAL.daysPerYear, CAL.daysPerYear, "calStep", "This year");
  }

  let out = '<div class="pnl cut"><h3 class="headwrap">' + esc(title) +
    '<span class="calviews">' +
    [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]].map(function (v) {
      return '<button class="bt cutsm' + (view === v[0] ? " pri" : "") +
        '" data-act="calView" data-view="' + v[0] + '">' + v[1] + "</button>";
    }).join("") + "</span></h3>" +
    /* Which reckoning you're reading belongs with the calendar you're
       reading it in, not filed under the date controls at the bottom of
       the tab. Both systems count the same 364 days; this only changes
       how they're named. */
    '<div class="mrow calsys"><span class="lbl">Reckoning</span>' +
    Object.keys(CAL.systems).map(function (k) {
      return '<button class="bt cutsm' + (k === sysKey ? " pri" : "") +
        '" data-act="calSystem" data-key="' + k + '">' + esc(CAL.systems[k].label) + "</button>";
    }).join("") +
    '<span class="foot" style="margin:0 0 0 4px">Same 364 days either way — this changes how the date reads.</span>' +
    "</div>" + nav;

  if (view === "month") out += calMonthGrid(cur);
  else if (view === "week") out += calWeekList(cur);
  else if (view === "year") out += calYearList(cur);

  /* Every view except the year overview ends on the selected day's
     page — the grid is for finding a day, this is for using it. */
  if (view !== "year") out += calDayPanel(cur);
  return out + "</div>";
}

function calNavRow(back, fwd, act, todayLabel) {
  const cur = calCursor();
  const onToday = cursorIsToday();
  return '<div class="calnav">' +
    '<button class="bt cutsm" data-act="' + act + '" data-d="' + back + '">‹</button>' +
    '<button class="bt cutsm' + (onToday ? "" : " pri") + '" data-act="calToday">' +
      esc(todayLabel) + "</button>" +
    '<button class="bt cutsm" data-act="' + act + '" data-d="' + fwd + '">›</button>' +
    (onToday ? '<span class="foot" style="margin:0">You are looking at the current date.</span>'
             : '<span class="calaway">Browsing ' + esc(CAL.format(S.calendar.system, cur.day)) +
               ", " + CAL.yearLabel(S.calendar.system, cur.year) + " — the party's date has not moved." +
               '<button class="bt cutsm" data-act="calSetDate">Set the date to this day</button></span>') +
    "</div>";
}

/* Small marks under a day number: what's on it, without the words. */
function calMarks(day, year) {
  const entries = calEntriesFor(S, day, year);
  if (!entries.length) return "";
  return '<span class="dmarks">' + entries.slice(0, 4).map(function (e) {
    return '<i class="dm' + (e.kind === "holiday" ? " hol" : "") + '"></i>';
  }).join("") + "</span>";
}

function calMonthGrid(cur) {
  const sysKey = S.calendar.system;
  const rows = CAL.monthWeeks(sysKey, cur.day);
  let out = '<div class="calgrid"><div class="cghead">';
  for (let i = 0; i < 7; i++) out += "<span>" + esc(CAL.weekdayShort(sysKey, i)) + "</span>";
  out += "</div>";
  rows.forEach(function (row) {
    out += '<div class="cgrow">';
    row.forEach(function (d) {
      if (d == null) { out += '<span class="cgcell empty"></span>'; return; }
      const isToday = d === S.calendar.day && cur.year === S.calendar.year;
      const isSel = d === cur.day;
      out += '<span class="cgcell' + (isToday ? " today" : "") + (isSel ? " sel" : "") +
        '" data-act="calGoto" data-day="' + d + '" data-year="' + cur.year + '">' +
        '<span class="cgnum">' + CAL.dayOfMonth(sysKey, d) + "</span>" +
        calMarks(d, cur.year) + "</span>";
    });
    out += "</div>";
  });
  return out + "</div>";
}

function calWeekList(cur) {
  const sysKey = S.calendar.system;
  const other = sysKey === "jerbeen" ? "common" : "jerbeen";
  let out = '<div class="calweek">';
  CAL.weekDays(cur.day).forEach(function (d) {
    const isToday = d === S.calendar.day && cur.year === S.calendar.year;
    const entries = calEntriesFor(S, d, cur.year);
    out += '<div class="wkday' + (isToday ? " today" : "") + (d === cur.day ? " sel" : "") +
      '" data-act="calGoto" data-day="' + d + '" data-year="' + cur.year + '">' +
      '<div class="wkhead"><span class="wkname">' + esc(CAL.weekdayName(sysKey, d)) + "</span>" +
      '<span class="wkdate">' + esc(CAL.format(sysKey, d)) + ' <span class="sc">' +
        esc(CAL.format(other, d)) + "</span></span></div>";
    if (entries.length) {
      out += '<div class="wkitems">' + entries.map(function (e) {
        return '<span class="wkitem' + (e.kind === "holiday" ? " hol" : "") + '">' +
          (e.timeOfDay ? '<b>' + esc(CAL.timeLabel(e.timeOfDay)) + "</b> " : "") +
          esc(e.title) + "</span>";
      }).join("") + "</div>";
    }
    out += "</div>";
  });
  return out + "</div>";
}

function calYearList(cur) {
  const sysKey = S.calendar.system;
  const sys = CAL.system(sysKey);
  let out = "";
  sys.months.forEach(function (m) {
    const isNow = S.calendar.day >= m.start && S.calendar.day <= m.end &&
                  cur.year === S.calendar.year;
    let noteCount = 0;
    for (let d = m.start; d <= m.end; d++) {
      noteCount += calEntriesFor(S, d, cur.year).filter(function (e) {
        return e.kind === "note";
      }).length;
    }
    out += '<div class="calmonth' + (isNow ? " now" : "") + '" data-act="calGoto" data-day="' +
      m.start + '" data-year="' + cur.year + '">' +
      '<div class="cmhead"><span class="cmname">' + esc(m.name) + "</span>" +
      '<span class="cmmeta">' + esc(m.season) + " · days " + m.start + "–" + m.end +
      (noteCount ? " · " + noteCount + " note" + (noteCount === 1 ? "" : "s") : "") +
      "</span></div>";
    sys.holidays.filter(function (h) { return h.day >= m.start && h.day <= m.end; })
      .forEach(function (h) {
        out += '<div class="cmfeast' + (h.day === S.calendar.day ? " today" : "") + '">' +
          esc(h.name) + ' <span class="sc">' + esc(CAL.format(sys.key, h.day)) + "</span></div>";
      });
    out += "</div>";
  });
  return out;
}

/* The selected day, in full: what the world says about it, what you've
   written on it, and the form for writing more. */
function calDayPanel(cur) {
  const sysKey = S.calendar.system;
  const other = sysKey === "jerbeen" ? "common" : "jerbeen";
  const entries = calEntriesFor(S, cur.day, cur.year);
  const holidayEntries = entries.filter(function (e) { return e.kind === "holiday"; });
  const notes = entries.filter(function (e) { return e.kind === "note"; });

  let out = '<div class="dayp"><div class="dayphead">' +
    '<span class="dayptitle">' + esc(CAL.weekdayName(sysKey, cur.day)) + ", " +
      esc(CAL.format(sysKey, cur.day)) + "</span>" +
    '<span class="daypalt">' + esc(CAL.system(other).label) + ": " +
      esc(CAL.format(other, cur.day)) + " · " + esc(CAL.yearLabel(other, cur.year)) + "</span></div>";

  holidayEntries.forEach(function (e) {
    out += '<div class="calfeast"><div class="cfname">' + esc(e.title) +
      ' <span class="bdg">' + esc(e.systemLabel) + "</span></div>" +
      '<div class="etext">' + esc(e.lore) + "</div></div>";
  });

  if (notes.length) {
    out += '<div class="daynotes">' + notes.map(function (e) {
      const ev = e.event;
      return '<div class="daynote"><span class="dnwhen">' +
        (e.timeOfDay ? esc(CAL.timeLabel(e.timeOfDay)) : "All day") + "</span>" +
        '<span class="dntitle">' + esc(e.title) + "</span>" +
        '<span class="dnmeta">' + (ev.year == null ? "every year" : "once") +
          (ev.lead ? " · warns " + ev.lead + "d ahead" : "") + "</span>" +
        '<button class="x" data-act="calDeleteNote" data-id="' + esc(ev.id) +
        '" title="Delete this note">×</button></div>';
    }).join("") + "</div>";
  } else {
    out += '<div class="foot">Nothing written on this day yet.</div>';
  }

  /* The add form used to sit here, buried at the bottom of the browser.
     It's a section of the tab in its own right now — see calAddNotePanel. */
  return out + "</div>";
}

/* ---------- ADD A NOTE ----------
   Writes to whichever day the browser is pointing at, which is today until
   you go looking somewhere else. Fields are read at click time, so a
   re-render never interrupts typing — same contract as the damage box. */
function calAddNotePanel() {
  const cur = calCursor();
  const sysKey = S.calendar.system;
  return '<div class="pnl cut"><h3>Add a note <span class="cnt">' +
    esc(CAL.format(sysKey, cur.day)) +
    (cursorIsToday() ? " · today" : "") + "</span></h3>" +
    '<div class="daypadd">' +
    '<input type="text" id="cal-note" placeholder="Note for ' +
      esc(CAL.format(sysKey, cur.day)) + '…">' +
    '<select id="cal-note-time"><option value="">All day</option>' +
      CAL.timesOfDay().map(function (t) {
        return '<option value="' + t.key + '">' + esc(t.label) + "</option>";
      }).join("") + "</select>" +
    '<select id="cal-note-repeat"><option value="once">Once</option>' +
      '<option value="yearly">Every year</option></select>' +
    '<span class="lbl">Warn</span>' +
    '<input type="number" id="cal-note-lead" value="0" min="0" max="60" style="width:58px">' +
    '<span class="lbl">days ahead</span>' +
    '<button class="bt cutsm pri" data-act="calAddNote">Add note</button></div>' +
    (cursorIsToday() ? "" :
      '<div class="foot">The browser is on another day — this note lands there, not on today.</div>') +
    "</div>";
}

/* ---------- FILTER PANEL (collapsible) ---------- */
function filterPanel() {
  const collapsed = !!UI.expanded.filterCollapsed;
  let out = '<div class="pnl cut"><h3>Filter' +
    '<button class="pcol" data-act="expand" data-id="filterCollapsed">' +
    (collapsed ? "Show" : "Hide") + "</button></h3>";
  if (!collapsed) out += tagFilterBar();
  return out + "</div>";
}

/* ---------- TAG FILTER BAR ---------- */
function tagFilterBar() {
  /* A row per axis, headings in their own column. The bar used to be one
     wrapping flex line, so a long heading shoved the next group's tags onto
     a ragged new row and the groups stopped reading as groups. In a grid
     the heading column is fixed and the tags wrap within their own cell,
     which makes heading length irrelevant. Colour still carries help vs
     harm inside the Effect row. */
  let out = '<div class="tagbar">';
  Object.keys(TAG_GROUPS).forEach(function (g) {
    const tags = Object.keys(TAGS).filter(function (t) { return TAGS[t].group === g; });
    if (!tags.length) return;
    out += '<span class="taggrp">' + esc(TAG_GROUPS[g]) + "</span><span class=\"tagrow\">";
    tags.forEach(function (t) {
      const on = UI.filter.indexOf(t) >= 0;
      out += '<span class="tag t-' + TAGS[t].color + (on ? " sel" : "") +
        '" data-act="filter" data-tag="' + t + '">' + esc(TAGS[t].label) + "</span>";
    });
    out += "</span>";
  });
  if (UI.filter.length) {
    out += '<span class="taggrp"></span><span class="tagrow">' +
      '<button class="bt cutsm" data-act="clearFilter">Clear ' + UI.filter.length + "</button></span>";
  }
  out += "</div>";
  return out;
}

/* ---------- FAVOURITES ----------
   The sheet knows everything Hal can do, which is the problem: by level
   four that is five prepared spells, two cantrips, four oath spells, a
   dozen universal actions and a pack. "What you can do now" already
   answers "what can I pay for", and the Spells tab answers "what have I
   got" — but neither answers "what do I actually reach for", because
   that question has an answer only the player knows.

   So this is the list you write yourself. A star on any card pins it
   here, the rail carries it on every tab, and pressing it does exactly
   what pressing it on its own tab would do — the same use() the doable
   panel calls, so a favourite can never spend a resource differently
   from the thing it points at.

   Entries are pointers, never copies. That is what stops the list from
   going stale when you unprepare a spell, spend the last charge, or
   level up into a bigger slot. */

function favIndex(kind, id) {
  return S.favourites.findIndex(function (f) { return f.kind === kind && f.id === id; });
}
function isFav(kind, id) { return favIndex(kind, id) >= 0; }

/* The star that pins things. Small and quiet — it sits in the same
   corner as More and the wiki link, and it is never the loudest thing on
   a card, because pinning is something you do once and using is
   something you do every round. */
function favBtn(kind, id) {
  const on = isFav(kind, id);
  return '<button class="favstar' + (on ? " on" : "") + '" data-act="favToggle" data-kind="' +
    esc(kind) + '" data-id="' + esc(id) + '" title="' +
    (on ? "Pinned to Favourites — tap to unpin" : "Pin to Favourites") +
    '" aria-label="' + (on ? "Remove from favourites" : "Add to favourites") + '">' +
    (on ? "★" : "☆") + "</button>";
}

/* Turn a pointer into everything both the rail row and the use window
   need: what to call it, what it costs, what it says, and what pressing
   it would actually do right now. One resolver for both, so the window
   can never offer something the row said was unavailable.

   `c` is the live castable entry where there is one — that is the record
   doUse() spends from, and handing it over whole is what keeps the
   window from re-deriving a cost of its own.

   Returns null only for a pointer clampState hasn't caught up with yet. */
function favResolve(f, castables) {
  if (f.kind === "spell" || f.kind === "action") {
    const c = castables.filter(function (x) { return x.kind === f.kind && x.id === f.id; })[0];
    if (c) {
      const afterHit = c.afterHit && S.combat.active && !S.combat.turn.hitLanded;
      return { name: c.name, kind: f.kind, c: c, text: c.text || "",
        meta: (typeof costLabel === "function" ? costLabel(c.cost) : "") + (c.free ? " · free" : ""),
        label: f.kind === "spell" ? (c.free ? "Cast free" : "Cast") : "Use",
        blocked: !c.affordable || afterHit,
        why: afterHit ? "Requires a hit first" : (c.reasons || []).join("; ") };
    }
    /* A spell you have since unprepared. The pin stays — you will prepare
       it again — but it says why it cannot be cast instead of vanishing
       from the list and leaving you to wonder where it went. */
    if (f.kind === "spell" && SPELLS[f.id]) {
      return { name: SPELLS[f.id].name, kind: "spell", meta: "not prepared",
               text: SPELLS[f.id].text, label: "Read", why: "Not prepared right now" };
    }
    return null;
  }

  if (f.kind === "item") {
    const it = S.equipment.inventory.filter(function (x) { return x.id === f.id; })[0];
    if (!it) return null;
    return { name: it.name, kind: "item", item: it,
      meta: (it.note || "") || (it.consumable ? "consumable" : ""),
      qty: it.qty, text: it.note || "",
      label: it.consumable ? "Use" : "Count",
      blocked: it.consumable && it.qty <= 0, why: "None left" };
  }

  if (f.kind === "feature") {
    const fe = FEATURES[f.id];
    if (!fe) return null;
    /* Some features ARE an action — Lay on Hands, Divine Sense. Those
       resolve through the same catalogue everything else uses, so the
       favourite spends the resource the feature actually costs. */
    const mapped = FEATURE_ACTION_MAP[f.id];
    if (mapped) {
      const c = castables.filter(function (x) {
        return x.kind === mapped.kind && x.id === mapped.id;
      })[0];
      if (c) {
        return { name: fe.name, kind: "feature", c: c, text: fe.text || c.text || "",
          meta: (typeof costLabel === "function" ? costLabel(c.cost) : ""),
          label: mapped.kind === "spell" ? "Cast" : "Use",
          blocked: !c.affordable, why: (c.reasons || []).join("; ") };
      }
    }
    return { name: fe.name, kind: "feature", meta: fe.src || "", text: fe.text, label: "Read" };
  }

  if (f.kind === "feat") {
    const ft = FEATS[f.id];
    if (!ft) return null;
    return { name: ft.name, kind: "feat", meta: (ft.type || "") + " feat",
             text: ft.text, label: "Read" };
  }
  return null;
}

function favouritesRail() {
  const editing = !!UI.expanded.favEdit;
  const castables = typeof CALC.castables === "function" ? CALC.castables(S) : [];

  let out = '<div class="pnl cut"><h3>Favourites <span class="cnt">' + S.favourites.length +
    "</span>" +
    /* Its own action rather than the generic expand: applyPanelFolds
       hands a panel over to whatever expand control its heading already
       carries, and this panel still wants its own fold chip beside
       this one. */
    (S.favourites.length
      ? '<button class="favedit" data-act="favEdit">' +
        (editing ? "Done" : "Edit") + "</button>"
      : "") + "</h3>";

  if (!S.favourites.length) {
    return out + '<div class="foot" style="margin:0">Tap ☆ on any spell, ability or item ' +
      "to pin it here — then use it from this column on any tab.</div></div>";
  }

  /* Both the name and the button open the use window rather than firing
     straight away. The rail is 250px of a column you read at arm's
     length, and the things worth pinning are exactly the ones with a
     question attached — cast Find Steed free or pay the slot, drink a
     potion or write down the three you just bought. The window is where
     those questions have room to be asked, and it carries the rules text
     besides, which the row never had space for. */
  S.favourites.forEach(function (f, i) {
    const r = favResolve(f, castables);
    if (!r) return;
    const dim = r.blocked && S.settings.economyLockout;
    const open = ' data-act="favUse" data-kind="' + esc(f.kind) + '" data-id="' + esc(f.id) + '"';

    out += '<div class="fav f-' + r.kind + (dim ? " off" : "") + '">' +
      '<button class="favn' + (dim ? " dim" : "") + '"' + open + ' title="' +
        esc(dim ? (r.why || "Not available right now") : r.name) + '">' + esc(r.name) + "</button>" +
      '<span class="favm">' + esc(r.meta || "") +
        (typeof r.qty === "number" ? (r.meta ? " · " : "") + "×" + r.qty : "") + "</span>" +
      '<div class="favb">' +
        '<button class="bt cutsm ' + (dim ? "dim" : (r.c || r.item ? "pri" : "")) + '"' + open +
        ' title="' + esc(dim ? r.why : "Open " + r.name) + '">' + esc(r.label) + "</button>";
    if (editing) {
      out += '<div class="favmove">' +
        '<button class="bt cutsm" data-act="favMove" data-i="' + i + '" data-d="-1"' +
          (i === 0 ? " disabled" : "") + ' title="Move up">↑</button>' +
        '<button class="bt cutsm" data-act="favMove" data-i="' + i + '" data-d="1"' +
          (i === S.favourites.length - 1 ? " disabled" : "") + ' title="Move down">↓</button>' +
        '<button class="bt cutsm dg" data-act="favToggle" data-kind="' + esc(f.kind) +
          '" data-id="' + esc(f.id) + '" title="Unpin">×</button></div>';
    }
    out += "</div></div>";
  });

  return out + "</div>";
}

/* ---------- RESOURCE RAIL ---------- */
function resourceRail() {
  const loh = CALC.layOnHandsMax(S).value;
  const cdMax = CALC.channelDivinityMax(S).value;
  const slots = CALC.slotsMax(S);
  /* Favourites lead the column. During a turn the rail's job is "what do
     I press", and this is the only panel in it that the player wrote
     themselves — everything below is what the sheet has to say. Followers
     come next: a summon is a creature you're responsible for on every
     tab, not a resource you spend. */
  let out = favouritesRail() + followerRail();
  /* The whole header is the collapse control — a big, obvious tap target. */
  out += '<div class="pnl cut"><h3 class="collapse" data-act="toggleRail">' +
    '<span>Resources</span><span class="chev">Hide</span></h3>';

  /* One rectangle per five points, filling by fifths, so the pool reads as
     the same kind of object as the pip rows under it instead of as a stray
     form control with a thumb to hunt for. The buttons are the primary way
     to spend — they're exact, and exact is what you want when the cleric
     asks how much you have left — but the bar still drags at full
     granularity, because everything else in this column is direct. */
  const lohSegs = Math.max(1, Math.ceil(loh / 5));
  let lohBar = '<div class="lohbar" role="slider" tabindex="0" aria-label="Lay on Hands pool"' +
    ' aria-valuemin="0" aria-valuemax="' + loh + '" aria-valuenow="' + S.resources.layOnHands + '">';
  for (let i = 0; i < lohSegs; i++) {
    const from = i * 5, span = Math.min(5, loh - from);
    const filled = Math.max(0, Math.min(span, S.resources.layOnHands - from));
    lohBar += '<div class="lohseg"><i style="width:' +
      (span > 0 ? (filled / span) * 100 : 0) + '%"></i></div>';
  }
  lohBar += "</div>";

  out += '<div class="res"><div class="rh"><span class="lbl">Lay on hands</span>' +
    '<span class="rv" data-act="prov" data-prov="loh">' + S.resources.layOnHands +
    "<small>/" + loh + "</small></span></div>" +
    lohBar +
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
  /* The rail used to end with a "Prepared" list as well, which was an
     exact subset of "What you can do now" — same spells, same Cast
     action, 1177px of rail restating the panel beside it. Two lists that
     answer almost the same question is how you end up casting from the
     stale one. They're now split by the question each actually answers:
     "what can I pay for right now" is the Combat tab's doable panel, and
     "what have I got at all" is the Spells tab. The rail does resources,
     which is what its header always said. */
  return out;
}

/* ============================================================
   MODALS
   ============================================================ */

/* Every modal gets one, in the same corner, doing the same thing. The
   footer buttons still say what closing means in context — Done, Cancel,
   Close — but none of them is the only way out, because a long modal put
   its footer behind a scroll and a scroll is a thing that can fail you. */
function modalClose() {
  return '<button class="mx" data-act="closeModal" title="Close" aria-label="Close">×</button>';
}

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

  else if (t === "restDays") {
    const cal = S.calendar;
    body = "<h2>Long rest</h2>" +
      '<div class="msub">Resources come back either way — this is just about the calendar. ' +
      "It's <b>" + esc(CAL.stamp(cal)) + "</b> right now.</div>" +
      '<div class="mrow"><label class="lbl">Days that pass</label>' +
      '<input type="number" id="rest-days" min="0" max="365" value="1"></div>' +
      '<div class="msub">0 rests without turning the day over. Anything more moves the ' +
      "calendar forward and picks up the next morning.</div>" +
      '<div class="mfoot"><button class="bt cutsm pri" data-act="longRest">Take the rest</button>' +
      '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  else if (t === "longRest") {
    const passed = UI.modal.daysPassed || 0;
    body = "<h2>Long rest complete</h2>" +
      (passed > 0
        ? '<div class="gain k-level"><span class="gk">' + passed + " day" + (passed === 1 ? "" : "s") +
          '</span><span>It is now ' + esc(CAL.stamp(S.calendar)) + "</span></div>"
        : '<div class="foot">The date is unchanged — still ' + esc(CAL.stamp(S.calendar)) + ".</div>") +
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
      '<div class="mfoot"><button class="bt cutsm pri" data-act="' +
      (UI.modal.from === "preSession" ? "preSessionModal" : "closeModal") + '">' +
      (UI.modal.from === "preSession" ? "Back to checklist" : "Done") + "</button></div>";
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

  else if (t === "summon") body = summonModalHTML();

  else if (t === "followerDamage") {
    const f = S.followers.filter(function (x) { return x.id === UI.modal.id; })[0];
    if (!f) return "";
    const b = CALC.followerBlock(S, f);
    body = "<h2>" + esc(f.name) + "</h2>" +
      '<div class="msub">' + f.hp + " of " + b.maxHP + " Hit Points. At 0 it disappears, " +
      "leaving behind anything it was carrying.</div>" +
      '<div class="mrow"><input type="number" id="fol-dmg" min="0" placeholder="Amount" autofocus>' +
      '<button class="bt cutsm dg" data-act="followerDamage" data-heal="0">Damage</button>' +
      '<button class="bt cutsm" data-act="followerDamage" data-heal="1">Heal</button></div>' +
      '<div class="msub">Life Bond: when you regain Hit Points from a level 1+ spell, it regains ' +
      "the same number if you're within 5 feet.</div>" +
      '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  }

  if (!body) return "";
  return '<div class="mask"><div class="modal cut">' + modalClose() + body + "</div></div>";
}

/* The spell asks before it spends. Every choice here is one the spell
   actually gives you, and the numbers update live so you can see what a
   bigger slot buys before committing to it. */
function summonModalHTML() {
  const m = UI.modal, p = m.pick;
  const src = FOLLOWER_SOURCES[m.source];
  const sp = SPELLS[src.spell];
  const steed = m.source === "findSteed";
  const preview = CALC.followerBlock(S, {
    source: m.source, spellLevel: p.free ? src.baseLevel : p.level,
    creatureType: p.creatureType, form: p.form
  });

  let body = "<h2>" + esc(sp.name) + "</h2>" +
    '<div class="msub">' + esc(sp.time) + " · " + esc(sp.range) + " · " + esc(sp.comp) +
    " · " + esc(sp.dur) + ". " +
    (steed ? "The animal is description only — it changes no numbers. The creature type does."
           : "The animal you choose IS the stat block. The creature type changes what it counts " +
             "as, not its numbers.") + "</div>";

  /* 1 — the form */
  body += '<div class="sbk">' + (steed ? "The form it takes" : "Which Beast — any with a Challenge Rating of 0") +
    "</div>" + '<div class="mrow"><select id="summon-form" data-act="summonForm">';
  if (steed) {
    body += STEED_FORMS.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === p.form ? " selected" : "") + ">" + esc(o) + "</option>";
    }).join("");
  } else {
    /* Grouped by what you'd want one FOR, with the rest below. Native
       optgroups cost no height in an already-tall modal and the iOS
       picker renders them as section headings, which is exactly the
       filtering you want without another control to tap.

       Names only in the labels: a select sizes itself to its widest
       option, and stat lines in here made the control 700px wide. */
    const opt = function (k) {
      return '<option value="' + esc(k) + '"' + (k === p.form ? " selected" : "") + ">" +
        esc(CR0_BEASTS[k].name) + "</option>";
    };
    const recommended = {};
    FAMILIAR_GUIDE.categories.forEach(function (c) {
      body += '<optgroup label="' + esc(c.name) + '">';
      c.picks.forEach(function (pick) {
        if (!CR0_BEASTS[pick.form]) return;
        recommended[pick.form] = true;
        body += opt(pick.form);
      });
      body += "</optgroup>";
    });
    const rest = Object.keys(CR0_BEASTS).filter(function (k) { return !recommended[k]; })
      .sort(function (a, b) { return CR0_BEASTS[a].name.localeCompare(CR0_BEASTS[b].name); });
    body += '<optgroup label="Every other Beast of CR 0">' + rest.map(opt).join("") + "</optgroup>";
  }
  body += "</select>";
  if (steed) {
    body += '<input type="text" id="summon-custom" data-act="summonField" data-field="custom" ' +
      'placeholder="…or describe your own" value="' + esc(p.custom || "") + '" style="flex:1;min-width:170px">';
  }
  body += '<input type="text" id="summon-name" data-act="summonField" data-field="name" ' +
    'placeholder="Name it" value="' + esc(p.name || "") + '"></div>';
  body += '<div class="foot" style="margin:0 0 12px">' +
    (steed ? "Anything you type in the middle wins over the list."
           : "All " + Object.keys(CR0_BEASTS).length + " Beasts of CR 0 with a published stat " +
             "block, the useful ones grouped by what you'd want one for.") +
    "</div>";

  /* The note for whatever is selected right now — costs nothing when the
     pick has no note, and never adds a control of its own. */
  if (!steed && preview && preview.guide) {
    body += '<div class="advice"><span class="advk">' + esc(preview.guide.category) +
      ' <span class="bdg">' + esc(FAMILIAR_GUIDE.label) + "</span></span>" +
      '<span class="advt">' + esc(preview.guide.why) + "</span></div>";
  }

  /* 2 — creature type */
  body += '<div class="sbk">Creature type' + (steed ? " — this one changes the stat block" : "") + "</div>";
  if (steed) {
    Object.keys(STEED_TYPES).forEach(function (k) {
      const ty = STEED_TYPES[k];
      body += '<button class="pick a-' + ({celestial:"cel",fey:"fey",fiend:"fnd"}[k]) +
        (p.creatureType === k ? " sel" : "") + '" data-act="summonType" data-key="' + k + '">' +
        '<div class="pn">' + esc(ty.name) + "</div>" +
        '<div class="pm">Otherworldly Slam deals <b>' + esc(ty.damage) + "</b> damage · Bonus Action: <b>" +
        esc(ty.ba.name) + "</b></div>" +
        '<div class="pt">' + esc(ty.ba.text) + "</div></button>";
    });
  } else {
    const adv = FAMILIAR_GUIDE.typeAdvice;
    body += '<div class="mrow">' + Object.keys(FAMILIAR_TYPES).map(function (k) {
      return '<button class="bt cutsm' + (p.creatureType === k ? " pri" : "") +
        '" data-act="summonType" data-key="' + k + '">' + esc(FAMILIAR_TYPES[k].name) +
        (k === adv.pick ? " ★" : "") + "</button>";
    }).join("") + "</div>" +
    '<div class="foot" style="margin:0 0 8px">It is a ' +
      esc(FAMILIAR_TYPES[p.creatureType].name) + " instead of a Beast — same numbers either way, " +
      "but it counts as that type for anything that cares.</div>" +
    '<div class="advice"><span class="advk">Why ' + esc(FAMILIAR_TYPES[adv.pick].name) +
      ' <span class="bdg">' + esc(FAMILIAR_GUIDE.label) + "</span></span>" +
      '<span class="advt">' + esc(adv.text) +
      '<em class="advfix">' + esc(adv.correction) + "</em></span></div>";
  }

  /* 3 — what you spend */
  body += '<div class="sbk">Cast it with</div><div class="mrow">';
  const slots = CALC.slotsMax(S);
  const freeRes = steed ? "faithfulSteed" : "findFamiliar";
  const freeLabel = steed ? "Faithful Steed — free" : "Magic Initiate — free";
  if (!steed && sp.ritual) {
    body += '<button class="bt cutsm' + (p.ritual ? " pri" : "") +
      '" data-act="summonPower" data-ritual="1" data-free="0" data-lv="' + src.baseLevel +
      '">Ritual — no slot</button>';
  }
  if ((S.resources[freeRes] || 0) > 0) {
    body += '<button class="bt cutsm' + (p.free && !p.ritual ? " pri" : "") +
      '" data-act="summonPower" data-ritual="0" data-free="1" data-lv="' + src.baseLevel + '">' +
      freeLabel + " (level " + src.baseLevel + ")</button>";
  }
  Object.keys(slots).map(Number).sort(function (a, b) { return a - b; }).forEach(function (lv) {
    if (lv < src.baseLevel) return;
    const left = slots[lv] - ((S.resources.slots[lv] || {}).used || 0);
    body += '<button class="bt cutsm' + (!p.free && !p.ritual && p.level === lv ? " pri" : "") +
      (left <= 0 ? " dim" : "") + '" data-act="summonPower" data-ritual="0" data-free="0" data-lv="' + lv + '">' +
      "Level " + lv + " slot <k>" + left + "</k></button>";
  });
  body += "</div>";

  if (preview) {
    body += '<div class="sb" style="margin-bottom:12px">' +
      '<div class="sbrow"><span>Armor Class</span><b>' + esc(preview.acNote || preview.ac) + "</b></div>" +
      '<div class="sbrow"><span>Hit Points</span><b>' + esc(preview.hpNote || String(preview.maxHP)) + "</b></div>" +
      '<div class="sbrow"><span>Speed</span><b>' + esc(preview.speed) + "</b></div>" +
      (steed ? "" : '<div class="sbrow"><span>Size</span><b>' + esc(preview.size) + "</b></div>") +
      '<div class="sbrow"><span>' + (steed ? "Otherworldly Slam" : "Senses") + "</span><b>" +
        esc(steed ? sign(preview.slam.bonus) + " · " + preview.slam.damage + " " + preview.slam.damageType
                  : preview.senses) + "</b></div>" +
      (steed ? "" : '<div class="sbrow"><span>Traits</span><b>' +
        esc((preview.traits || []).map(function (t) { return t.name; }).join(", ") || "—") + "</b></div>") +
      "</div>";
  }

  const existing = S.followers.filter(function (f) { return f.source === m.source; })[0];
  if (existing) {
    body += '<div class="warnbox">' +
      (steed ? "Casting again replaces <b>" + esc(existing.name) +
               "</b> — a steed from this spell is replaced by the new one."
             : "You can't have more than one familiar. Casting again makes <b>" + esc(existing.name) +
               "</b> adopt the new form instead.") + "</div>";
  }

  body += '<div class="mfoot"><button class="bt cutsm pri" data-act="summonApply">' +
    (existing && !steed ? "Change form" : "Summon") + "</button>" +
    '<button class="bt cutsm" data-act="closeModal">Cancel — spend nothing</button></div>';
  return body;
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
/* ---------- MAP CAMERA ----------
   Zoom 1 means "the map fits the panel", so the stage is exactly the
   width of the view and panning at zoom 1 is meaningless — which is why
   the clamp collapses to zero there rather than being a special case. */
const MAP_ZOOM_MIN = 1, MAP_ZOOM_MAX = 8;

function mapSetZoom(z, anchorX, anchorY) {
  const view = document.querySelector(".mapview");
  const next = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, z));
  if (view) {
    const w = view.clientWidth, h = view.clientHeight, prev = UI.map.zoom;
    /* Keep the point under the fingers (or the centre) still while the
       scale changes, which is what makes zooming feel attached to the
       map rather than to the window. */
    const ax = anchorX == null ? w / 2 : anchorX;
    const ay = anchorY == null ? h / 2 : anchorY;
    const k = next / prev;
    UI.map.x = ax - (ax - UI.map.x) * k;
    UI.map.y = ay - (ay - UI.map.y) * k;
    UI.map.zoom = next;
    mapClampPan(w, h);
  } else {
    UI.map.zoom = next;
  }
  return UI.map.zoom;
}

/* The map may never be dragged off its own frame. */
function mapClampPan(w, h) {
  const z = UI.map.zoom;
  UI.map.x = Math.min(0, Math.max(w * (1 - z), UI.map.x));
  UI.map.y = Math.min(0, Math.max(h * (1 - z), UI.map.y));
}

function mapApplyCamera() {
  const stage = document.querySelector(".mapstage");
  if (!stage) return;
  stage.style.setProperty("--z", UI.map.zoom);
  stage.style.transform = "translate(" + UI.map.x + "px," + UI.map.y +
    "px) scale(" + UI.map.zoom + ")";
  /* Gestures move the camera without a re-render, so everything that
     reads off the zoom has to be maintained here too, not only at
     render time -- the label threshold and the readout both. */
  stage.classList.toggle("zoomed", UI.map.zoom >= MAP_LABEL_ZOOM);
  const out = document.querySelector(".mapzoom");
  if (out) out.textContent = Math.round(UI.map.zoom * 100) + "%";
}

/* Where a screen point falls on the map, as the percentages the data
   uses. Read off the stage's own rect, which already has the transform
   baked into it, so no camera arithmetic is repeated here. */
function mapPct(clientX, clientY) {
  const stage = document.querySelector(".mapstage");
  if (!stage) return null;
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return {
    x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100))
  };
}

/* ---------- MAP GESTURES ----------
   Drag and pinch cannot go through mutate on every frame: mutate
   re-renders the whole page, which would replace the element under the
   finger mid-gesture. So a gesture moves the DOM directly and only
   writes to state when it ends. UI.drag holds the in-flight gesture and
   is never persisted.

   The click handler below is told to swallow the click that follows a
   drag, otherwise dragging a pin would also "tap" it. */
const MAP_TAP_SLOP = 6;   /* px of movement still counted as a tap */
const mapPointers = {};

function mapPinEl(id) {
  return document.querySelector('.mpin[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
}

document.addEventListener("pointerdown", function (e) {
  /* A pending swallow belongs to the gesture that just ended. If a new
     one starts, the click it was waiting for is never coming — a pinch
     or a cancelled drag often ends without one — so drop it here rather
     than let it eat an unrelated tap later. */
  UI.mapSwallowClick = false;
  const view = e.target.closest && e.target.closest(".mapview");
  if (!view) return;
  mapPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const ids = Object.keys(mapPointers);

  if (ids.length === 2) {
    /* Two fingers: pinch AND pan, together. The centroid moving is a pan
       and the distance changing is a zoom, and a real gesture is always
       some of both — treating them as one thing is what makes the map
       feel like paper under your hands rather than two modes. */
    const a = mapPointers[ids[0]], b = mapPointers[ids[1]];
    UI.drag = { kind: "pinch", moved: true,
                dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
                ox: UI.map.x, oy: UI.map.y,
                zoom: UI.map.zoom };
    return;
  }

  const pinEl = e.target.closest(".mpin");
  if (pinEl && UI.map.mode === "move") {
    UI.drag = { kind: "pin", id: pinEl.dataset.id, el: pinEl,
                sx: e.clientX, sy: e.clientY, moved: false };
    return;
  }
  /* One finger no longer pans. It used to, and it meant the map was a
     trap on a touch screen: the gesture for "scroll past this" and the
     gesture for "fling the map" were the same one, so you could not read
     the rest of the tab without shoving the map around first. One finger
     now belongs to the page — the map takes two, which is the same
     bargain every map on a phone makes.

     A mouse has no such problem, so it keeps its drag-to-pan. */
  if (e.pointerType === "mouse") {
    UI.drag = { kind: "pan", sx: e.clientX, sy: e.clientY,
                ox: UI.map.x, oy: UI.map.y, moved: false };
    return;
  }
  /* Touch, one finger: remember where it started so a tap still lands,
     but move nothing. */
  UI.drag = { kind: "tap", sx: e.clientX, sy: e.clientY, moved: false };
}, true);

document.addEventListener("pointermove", function (e) {
  const d = UI.drag;
  if (!d) return;
  if (mapPointers[e.pointerId]) { mapPointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }

  if (d.kind === "pinch") {
    const ids = Object.keys(mapPointers);
    if (ids.length < 2) return;
    const a = mapPointers[ids[0]], b = mapPointers[ids[1]];
    const view = document.querySelector(".mapview");
    const r = view ? view.getBoundingClientRect() : null;
    const now = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    /* Zoom about the point between the fingers, then carry the map by
       however far that point has travelled. Zoom first, because
       mapSetZoom moves the camera to keep the anchor still and the pan
       is measured from where the gesture began, not from after it. */
    mapSetZoom(d.zoom * (now / d.dist),
               r ? (a.x + b.x) / 2 - r.left : null,
               r ? (a.y + b.y) / 2 - r.top : null);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    UI.map.x += cx - d.cx;
    UI.map.y += cy - d.cy;
    d.cx = cx; d.cy = cy;
    if (view) mapClampPan(view.clientWidth, view.clientHeight);
    mapApplyCamera();
    e.preventDefault();
    return;
  }

  /* One touch finger: the page is scrolling, not the map. Track it only
     far enough to know this stopped being a tap. */
  if (d.kind === "tap") {
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > MAP_TAP_SLOP) d.moved = true;
    return;
  }

  if (d.kind === "pin") {
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > MAP_TAP_SLOP) d.moved = true;
    if (!d.moved) return;
    const p = mapPct(e.clientX, e.clientY);
    if (!p || !d.el) return;
    d.at = p;
    d.el.style.left = p.x + "%";
    d.el.style.top = p.y + "%";
    e.preventDefault();
    return;
  }

  if (d.kind === "pan") {
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > MAP_TAP_SLOP) d.moved = true;
    if (!d.moved) return;
    const view = document.querySelector(".mapview");
    UI.map.x = d.ox + dx;
    UI.map.y = d.oy + dy;
    if (view) mapClampPan(view.clientWidth, view.clientHeight);
    mapApplyCamera();
    e.preventDefault();
  }
}, true);

document.addEventListener("pointerup", function (e) {
  delete mapPointers[e.pointerId];
  const d = UI.drag;
  if (!d) return;
  UI.drag = null;

  if (d.kind === "pinch") { UI.mapSwallowClick = true; return; }

  if (d.kind === "pin") {
    if (!d.moved) return;                 /* a tap: let the click select it */
    UI.mapSwallowClick = true;
    const at = d.at;
    if (!at) return;
    const id = d.id;
    mutate(function (st) {
      const c = st.map.custom.filter(function (k) { return k.id === id; })[0];
      if (c) { c.x = at.x; c.y = at.y; return; }
      if (id === "__party") { st.map.party = { x: at.x, y: at.y }; return; }
      st.map.edits[id] = Object.assign({}, st.map.edits[id], { x: at.x, y: at.y });
    });
    return;
  }

  /* A mouse drag and a stationary finger end the same way: either it
     moved, in which case the click that follows is part of the gesture
     and must not also count as a tap, or it didn't, and it was a tap. */
  if (d.kind === "pan" || d.kind === "tap") {
    if (d.moved) { UI.mapSwallowClick = true; return; }
    /* A tap on open map. In the two placing modes that means "here". */
    const at = mapPct(e.clientX, e.clientY);
    if (!at) return;
    if (UI.map.mode === "add") {
      const id = newPinId();
      const near = mapNearest(at.x, at.y);
      mutate(function (st) {
        st.map.custom.push({ id: id, name: "New marker", kind: "marker",
                             x: at.x, y: at.y, note: "" });
        /* Logged unnamed; naming it rewrites this same line rather than
           adding a second one. */
        logWorld(st, "map:" + id, "Marker placed: New marker" +
          (near ? " — near " + near.name : ""));
      });
      UI.map.sel = id;
      render();
    } else if (UI.map.mode === "party") {
      mutate(function (st) { st.map.party = { x: at.x, y: at.y }; });
    }
  }
}, true);

document.addEventListener("pointercancel", function (e) {
  delete mapPointers[e.pointerId];
  UI.drag = null;
});

/* Wheel/trackpad zoom, anchored where the cursor is. */
document.addEventListener("wheel", function (e) {
  const view = e.target.closest && e.target.closest(".mapview");
  if (!view) return;
  e.preventDefault();
  const r = view.getBoundingClientRect();
  mapSetZoom(UI.map.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
             e.clientX - r.left, e.clientY - r.top);
  mapApplyCamera();
  /* The readout in the footer is the only other thing that moves. */
  const foot = view.parentNode.querySelector(".foot");
  if (foot) foot.innerHTML = foot.innerHTML.replace(/zoom \d+%/, "zoom " + Math.round(UI.map.zoom * 100) + "%");
}, { passive: false });

/* Form controls are driven by the change handler below, never by this
   one. A SELECT in particular must be left alone: preventDefault stops
   iOS from opening the picker at all, and firing the action on the tap
   would re-render the dropdown out from under the finger that opened
   it — which looks exactly like a dead control. */
const FORM_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1 };
document.addEventListener("click", function (e) {
  /* A drag on the map ends in a click the browser still delivers. It
     must not also count as a tap, or moving a pin would re-open it and
     panning would select whatever ended up under the finger. */
  if (UI.mapSwallowClick) { UI.mapSwallowClick = false; return; }
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (typeof fn === "function" && !FORM_TAGS[el.tagName]) {
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

/* ---------- LAY ON HANDS BAR ----------
   The bar paints itself while you drag and only commits when you let go.
   Two reasons, both of which you'd feel: mutate() re-renders the whole
   document, which is not something to do sixty times a second on an iPad;
   and it pushes an undo step, so a single drag across the pool would bury
   every earlier move under twenty entries of its own. */
let lohDrag = null;

function lohValueAt(bar, clientX) {
  const r = bar.getBoundingClientRect();
  const max = parseInt(bar.getAttribute("aria-valuemax"), 10) || 0;
  if (!r.width || !max) return 0;
  /* Full granularity: the segments are how it's drawn, not what it steps by. */
  return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * max);
}

function lohPaint(bar, v) {
  const max = parseInt(bar.getAttribute("aria-valuemax"), 10) || 0;
  Array.prototype.forEach.call(bar.querySelectorAll(".lohseg > i"), function (fill, i) {
    const from = i * 5, span = Math.min(5, max - from);
    const filled = Math.max(0, Math.min(span, v - from));
    fill.style.width = (span > 0 ? (filled / span) * 100 : 0) + "%";
  });
  bar.setAttribute("aria-valuenow", v);
  const res = bar.closest(".res");
  const out = res && res.querySelector(".rv");
  if (out && out.firstChild) out.firstChild.nodeValue = v;
}

function lohCommit(v) {
  mutate(function (st) { st.resources.layOnHands = v; });
}

document.addEventListener("pointerdown", function (e) {
  const bar = e.target.closest && e.target.closest(".lohbar");
  if (!bar) return;
  const v = lohValueAt(bar, e.clientX);
  lohDrag = { value: v };
  lohPaint(bar, v);
  e.preventDefault();
});

document.addEventListener("pointermove", function (e) {
  if (!lohDrag) return;
  /* Look the bar up fresh — an unrelated re-render mid-drag would have
     replaced the node the gesture started on. */
  const bar = document.querySelector(".lohbar");
  if (!bar) { lohDrag = null; return; }
  const v = lohValueAt(bar, e.clientX);
  if (v !== lohDrag.value) { lohDrag.value = v; lohPaint(bar, v); }
  e.preventDefault();
});

document.addEventListener("pointerup", function () {
  if (!lohDrag) return;
  const v = lohDrag.value;
  lohDrag = null;
  lohCommit(v);
});
document.addEventListener("pointercancel", function () { lohDrag = null; render(); });

/* There is a keyboard, so the bar takes arrow keys like any other slider. */
document.addEventListener("keydown", function (e) {
  const bar = document.activeElement;
  if (!bar || !bar.classList || !bar.classList.contains("lohbar")) return;
  const max = parseInt(bar.getAttribute("aria-valuemax"), 10) || 0;
  const cur = parseInt(bar.getAttribute("aria-valuenow"), 10) || 0;
  let v = null;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = cur - (e.shiftKey ? 5 : 1);
  else if (e.key === "ArrowRight" || e.key === "ArrowUp") v = cur + (e.shiftKey ? 5 : 1);
  else if (e.key === "Home") v = 0;
  else if (e.key === "End") v = max;
  if (v === null) return;
  e.preventDefault();
  lohCommit(Math.max(0, Math.min(max, v)));
  /* Committing re-renders, which throws away the element the key was
     pressed on — so hold the focus, or only the first arrow press lands. */
  const again = document.querySelector(".lohbar");
  if (again) again.focus();
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
  /* The digits index the tabs in the order they're drawn, groups and all,
     so the hint printed on a tab is always where that tab actually is. */
  if (TAB_DIGITS.indexOf(k) >= 0 && TAB_ORDER[TAB_DIGITS.indexOf(k)]) {
    ACT.tab({ dataset: { tab: TAB_ORDER[TAB_DIGITS.indexOf(k)] } });
    return;
  }
  if (k === "d") { ACT.damageModal(); e.preventDefault(); }
  else if (k === "s") { ACT.shortRest(); }
  else if (k === "l") { ACT.longRestPrompt(); }
  else if (k === "e") { ACT.editMode(); }
  else if (k === "c") { mutate(function (st) { st.toggles.concentrating = !st.toggles.concentrating; }); }
});

/* Boot.

   The save is not redundant. migrate() and clampState() between them fill
   in whatever a newer schema added — and one of those things is now the
   id an item is known by, which a favourite points at. Left unsaved until
   the next change, those ids would be regenerated on the following launch
   and every pinned item would point at nothing. Writing once at boot makes
   a migration a thing that happened, not a thing that keeps happening. */
clampState(S);
save();
render();
