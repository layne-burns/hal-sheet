/* ============================================================
   COMBAT UI — turn tracker, casting, effects, party,
   turn order, undo, roll prompts, settings. Extends app.js.
   Loaded AFTER app.js; merges into ACT and exposes EXT.
   ============================================================ */

const EXT = {};

/* ---------- ID / REF HELPERS --------------------------------- */
let _idSeq = 0;
function newId(prefix) { _idSeq += 1; return prefix + Date.now() + "_" + _idSeq; }
/* Turn-order entries use composite ids so Hal, party and foes can't
   collide: "hal", "p:<partyId>", "f:<generated>". A foe's name lives on
   its ref rather than in a roster somewhere — there is no roster, which
   is the point. */
function refFor(id, kind, name, token) {
  if (kind === "hal") return { type: "hal" };
  if (kind === "party") return { type: "party", partyId: id.slice(2) };
  if (kind === "follower") return { type: "follower", followerId: id.slice(2) };
  if (kind === "foe") return { type: "foe", name: name || "Enemy", token: validToken(token) };
  return { type: kind };
}

/* ---------- UNDO STACK -------------------------------------- */
const HIST_KEY = "hal-briarshade-history-v1";
const HIST_MAX = 20;

function histLoad() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; }
  catch (e) { return []; }
}
function histSave(h) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-HIST_MAX))); }
  catch (e) { /* quota — drop silently, undo is a convenience */ }
}
/* Fields that shouldn't count as a real change — switching tabs or
   collapsing the rail must not fill the undo stack. */
function significant(st) {
  const c = JSON.parse(JSON.stringify(st));
  delete c.ui;
  if (c.toggles) { delete c.toggles.railCollapsed; delete c.toggles.editMode; }
  return JSON.stringify(c);
}

/* Wrap mutate so every meaningful change is undoable. The snapshot is
   taken BEFORE the change, so undo restores the prior state.
   It also feeds the session log: any LABELED change, while a session
   is active, gets appended as a timestamped entry. Unlabeled mutate()
   calls (toggles, stat bookkeeping) stay out of the log — they'd just
   be noise — but still count toward undo, matching prior behavior. */
const _mutate = mutate;
mutate = function (fn, label) {
  const before = JSON.parse(JSON.stringify(S));
  const beforeSig = significant(before);
  _mutate(fn);
  const changed = significant(S) !== beforeSig;
  if (changed) {
    const h = histLoad();
    h.push({ label: label || "Change", at: Date.now(), state: before });
    histSave(h);
  }
  if (changed && label && S.session && S.session.active) {
    _mutate(function (st) {
      st.session.log.push({ t: Date.now(), label: label, cal: calStamp(st) });
      if (st.session.log.length > 500) st.session.log.shift();
    });
  }
};

/* ---------- HELPERS ----------------------------------------- */
function costLabel(cost) {
  if (!cost) return "";
  const parts = [];
  if (cost.type === "action") parts.push("Action");
  else if (cost.type === "bonus") parts.push("Bonus Action");
  else if (cost.type === "reaction") parts.push("Reaction");
  else if (cost.type === "free") parts.push("Free");
  if (cost.slot) parts.push("Level " + cost.slot + " slot");
  if (cost.res) parts.push(cost.res.replace(/([A-Z])/g, " $1").toLowerCase());
  return parts.join(" · ");
}
function abilityDie(S, key) {
  const m = CALC.mod(S.abilities[key]);
  return (m >= 0 ? "+" : "−") + Math.abs(m);
}

/* ---------- EDGE GLOW --------------------------------------- */
EXT.glow = function () {
  if (!S.settings.edgeGlow) return "";
  const maxHP = CALC.maxHP(S).value;
  const low = maxHP > 0 && (S.currentHP / maxHP) <= 0.2;
  const conc = S.toggles.concentrating;
  let out = "";
  if (low || conc) {
    let cls = "glow";
    if (conc && low) cls += " glow-both";
    else if (conc) cls += " glow-conc";
    else cls += " glow-low";
    const label = conc && low ? "Concentrating and badly hurt"
      : conc ? "Concentrating" : "Below 20% hit points";
    out += '<div class="' + cls + '" aria-label="' + label + '"></div>';
  }
  /* Inspiration is a standing reminder, not an alarm, so it rides on its
     own quiet layer — slow and gold — instead of competing with the
     colours that mean something is going wrong. */
  if (S.toggles.inspiration) {
    out += '<div class="glow glow-insp" aria-label="You have Inspiration"></div>';
  }
  return out;
};

/* ---------- COMBAT BAR --------------------------------------
   Short labels, always. They started as a fallback for when the strip ran
   out of room, and then the strip was read at a table for a while and the
   long ones turned out to be for nobody: you know what the third pip is,
   and "Exit combat" was never ambiguous as "Exit". What the long form is
   still good for is the tooltip, which is where it lives now.

   Every control carries its long form as a title attribute. */

EXT.combatBar = function () {
  const c = S.combat;
  const orderBtn = '<button class="bt cutsm" data-act="orderModal" title="' +
    (c.order.length ? "Turn order — " + c.order.length + " in the fight" : "Set the turn order") +
    '">' + (c.order.length ? "Order " + c.order.length : "Order") + "</button>";
  if (!c.active) {
    /* Out of combat the strip carries the company and nothing else. It
       used to announce "Out of combat" above every tab in the app, which
       is the absence of news taking a whole band of a 740px screen to
       say so.

       What IS worth carrying everywhere is who is with you — the party,
       the summons, the mounts, and the mule riding on somebody's corner.
       No dimming, because nobody's turn it is, and three quarters the
       size, because nothing here is urgent.

       Entering combat is a control rather than a status, so it stays on
       the Combat tab where you would go looking for it. */
    const onCombatTab = ((S.ui && S.ui.tab) || "combat") === "combat";
    const company = companyStrip();
    if (!onCombatTab && !company) return "";
    return '<div class="strip cut explore">' +
      (onCombatTab
        ? '<button class="bt cutsm pri" data-act="combatStart">Enter combat</button>' +
          (allMounts().length && !allMounts().every(function (f) { return f.riddenBy; })
            ? '<button class="bt cutsm" data-act="mountModal">Mount…</button>' : "") +
          (S.effects.length ? '<span class="lbl">' + S.effects.length +
            " effect(s) — durations pause out of combat</span>" : "")
        : "") +
      company + "</div>";
  }
  const t = c.turn;
  const slotNote = t.slotUsed ? "used" : "open";
  /* One line, no state word. "OPEN" over "ACTION" said the same thing the
     colour was already saying, in a second row of type that made every pip
     twice the height of the buttons beside it. Spent is the strike-through
     and the dimmed border, which is how spent looks everywhere else in the
     app. The long form and the state are both in the tooltip. */
  function pip(used, label, key, short) {
    return '<button class="ecopip' + (used ? " used" : "") + '" data-act="econToggle" data-key="' +
      key + '" title="' + label + " — " + (used ? "spent" : "open") + '">' +
      esc(short || label) + "</button>";
  }
  return '<div class="strip combat cut">' +
    '<span class="rnd" title="Round ' + c.round + '">R' + c.round + "</span>" +
    orderBtn +
    pip(t.action, "Action", "action") +
    pip(t.bonus, "Bonus action", "bonus", "B/A") +
    pip(t.reaction, "Reaction", "reaction") +
    '<span class="ecopip' + (t.slotUsed ? " used" : "") + '" title="Spell slot — ' + slotNote +
      '">Slot</span>' +
    '<span class="mv" title="Movement left this turn"><span class="lbl mvlbl">Move</span> ' +
      (S.identity.speed - t.movementUsed) +
      "/" + S.identity.speed + '<span class="mvft"> ft</span>' +
      '<button class="bt cutsm" data-act="move" data-d="5">−5</button>' +
      '<button class="bt cutsm" data-act="move" data-d="-5">+5</button></span>' +
    (t.hitLanded ? '<span class="hitflag" title="Smites are available">Hit landed</span>'
                 : '<button class="bt cutsm" data-act="logHit" title="Log a hit — arms your smites">Hit</button>') +
    /* Getting on and off a horse costs half your Speed, which is exactly
       the sort of thing that gets forgotten mid-fight — so the control
       lives in the strip, next to the movement it spends. Only when
       there is something to ride; a party with no mounts never sees it. */
    (function () {
      const mounts = allMounts();
      if (!mounts.length) return "";
      const mine = mountRiddenBy("hal");
      if (mine) {
        return '<button class="bt cutsm" data-act="dismount" data-id="' + mine.id +
          '" title="Get off ' + esc(mine.name) + " — half your Speed\">Dismount</button>";
      }
      const free = mounts.filter(function (f) { return !f.riddenBy; });
      if (!free.length) return "";
      return '<button class="bt cutsm" data-act="mountModal" title="Get on — half your Speed">Mount</button>';
    })() +
    /* The table runs its own initiative, so the turns between yours often
       pass without anyone touching the sheet. This catches it up in one
       press instead of four, and says how far it will jump so you can see
       it is about to cross a round before it does. */
    (function () {
      const plan = CALC.peekToMyTurn(S);
      /* Shown whenever there is an order with you in it, even when it is
         one step — a control that comes and goes depending on where the
         marker happens to sit is one you stop trusting is there. */
      if (!plan) return "";
      const skips = plan.steps - 1;
      return '<button class="bt cutsm" data-act="toMyTurn" title="' +
        (skips ? "Skip the " + skips + " turn" + (skips === 1 ? "" : "s") + " between now and yours"
               : "Advance to your next turn") +
        (plan.wraps ? ", crossing into the next round" : "") +
        '">My turn' + (skips ? " <k>" + skips + "</k>" : "") + "</button>";
    })() +
    '<button class="bt cutsm pri" style="margin-left:auto" data-act="endTurn" title="' +
      (c.order.length ? "Next turn" : "End your turn") + '">' +
      (c.order.length ? "Next" : "End turn") + "</button>" +
    '<button class="bt cutsm" data-act="combatEnd" title="Exit combat">Exit</button>' +
    /* A line of its own, under the round counter. Sharing the row with
       the buttons meant it had to shrink to whatever was left over, and
       what was left over on an iPad was not enough to keep it to one
       row. Given the full width it is one row everywhere. */
    orderStrip() +
    "</div>";
};

/* The order, spelled out along the bottom of the combat strip.

   The strip already wrapped to two rows and the second one was mostly
   air, with the one thing you most want to see — whose go it is, and who
   is after them — compressed into the four words "Hal Briarshade's turn".
   That is the same information as "Turn order (7)" and neither answers
   "how long until me".

   Everyone is here and everyone but the current combatant is dimmed, so
   the live one is found by contrast rather than by reading. It is a
   readout, not a control: nothing in it is tappable, because a mis-tap in
   the middle of a fight that silently moved whose turn it was would be
   worse than the problem it solved. Correcting the order is what the
   Turn order button above is for. */
/* ---------- MAKING THE ORDER FIT ----------------------------
   A four-strong fight fits the row at full size and a fourteen-strong one
   does not, and there is no width the stylesheet can pick that is right
   for both. So the row is measured once it exists and the chips are
   stepped down until they fit on one line — the same measure-then-decide
   the layout columns already use, for the same reason: a media query can
   only see the device, and what matters here is how many people are in
   this particular fight.

   Whoever is up never shrinks. It is the one chip you have to be able to
   read from across the table, and it is exactly one chip, so it can
   afford to hold its size while everything around it gives way. */
const ORD_FITS = ["", "fit-1", "fit-2", "fit-3", "fit-4"];

/* The controls above it get the same treatment, for the same reason —
   though there is much less to give up now that the labels are short and
   the pips are one line to begin with. Two steps: tighten the spacing,
   then the type. Both are recoverable; nothing is lost. */
const BAR_FITS = ["", "bfit-1", "bfit-2"];

/* Is a wrapping flex row on one line? Asked of the browser rather than
   predicted by adding widths up.

   Not a plain equality on offsetTop: these rows are centre-aligned and
   their children are different heights, so items on the SAME line
   already sit a few pixels apart. A wrap moves one down by a whole row,
   so anything under half the tallest child is still one line. */
function oneRow(el, skip) {
  let lo = Infinity, hi = -Infinity, tall = 0;
  for (let i = 0; i < el.children.length; i++) {
    const kid = el.children[i];
    if (skip && skip(kid)) continue;
    lo = Math.min(lo, kid.offsetTop);
    hi = Math.max(hi, kid.offsetTop);
    tall = Math.max(tall, kid.offsetHeight);
  }
  return !tall || (hi - lo) < tall * 0.6;
}

/* The steps stack: step three is also step one and step two. Applying
   them one at a time instead would mean step four silently gave back the
   spacing step one took, and the row would get WIDER as it tried to
   shrink. */
function fitClasses(steps, upTo) {
  return steps.slice(1, upTo + 1).join(" ");
}

/* The strip's own controls, ignoring the order strip — that has a line to
   itself by design, so counting it would mean the bar could never be
   judged to fit and would sit at the smallest step forever. */
function fitCombatBar() {
  const bar = document.querySelector(".strip.combat");
  if (!bar) return;
  const skip = function (kid) { return kid.classList.contains("ordstrip"); };
  for (let i = 0; i < BAR_FITS.length; i++) {
    bar.className = ("strip combat cut " + fitClasses(BAR_FITS, i)).trim();
    if (oneRow(bar, skip)) return;
  }
}

function fitOrderStrip() {
  const strip = document.querySelector(".ordstrip");
  if (!strip || strip.children.length < 2) return;
  for (let i = 0; i < ORD_FITS.length; i++) {
    strip.className = ("ordstrip " + fitClasses(ORD_FITS, i)).trim();
    if (oneRow(strip)) return;
  }
  /* Fell through every step: more combatants than a row can hold at any
     size. It wraps, which is the right answer — the alternative is faces
     too small to tell apart. */
}

/* Who is with you, out of combat. Not the turn order — there isn't one —
   just the company: Hal, whoever is present, and every follower that is
   its own creature rather than a badge on somebody's corner.

   Renders nothing at all when it would be Hal on his own, because a
   strip with one face in it is a strip that is only taking up room. */
function companyStrip() {
  const rows = [];
  rows.push({ name: S.identity.name || "Hal", hal: true, token: null, owner: "hal" });
  (S.party.roster || []).filter(function (m) { return m.present; }).forEach(function (m) {
    rows.push({ name: m.name, token: m.token, owner: m.id,
                status: m.status && m.status !== "healthy" ? m.status : "" });
  });
  S.followers.forEach(function (f) {
    const b = CALC.followerBlock(S, f);
    if (!b) return;
    /* A non-combatant rides on its owner's card, not in the line. */
    if (f.source === "companion" && !b.inCombat) return;
    rows.push({ name: f.name, token: f.token, owner: null,
                sub: b.role ? b.role.label : b.type.name,
                ridden: !!f.riddenBy, rider: f.riddenBy });
  });
  if (rows.length < 2 && !S.followers.length) return "";

  return '<div class="ordstrip explore">' + rows.map(function (r) {
    /* A mount already on somebody is drawn chained to them, not twice. */
    if (r.ridden) return "";
    const mount = r.owner ? S.followers.filter(function (f) { return f.riddenBy === r.owner; })[0] : null;
    const short = r.name.split(/\s+/)[0];
    return '<span class="ordc' + (r.status ? " st-" + r.status : "") +
      (mount ? " ridden" : "") + '" title="' + esc(r.name) +
        (r.sub ? " — " + esc(r.sub) : "") +
        (mount ? " · riding " + esc(mount.name) : "") +
        (r.status ? " · " + r.status : "") + '">' +
      tokenFace({ hal: r.hal, token: r.token, name: r.name, cls: "ordface" }) +
      (r.owner ? companionBadges(r.owner) : "") +
      (mount
        ? '<span class="ordlink">+</span>' +
          tokenFace({ token: mount.token, name: mount.name, cls: "ordface mountface" })
        : "") +
      '<span class="ordn">' + esc(short) + "</span></span>";
  }).join("") + "</div>";
}

/* Everything one entry needs to draw itself, in one place so the big chip
   and the small ones can't disagree about who somebody is. */
/* Who this combatant is riding, if anyone. A mounted pair shares a turn,
   so the strip shows them chained rather than as two entries — one of
   which would be a turn that never comes round. */
function ordMount(o) {
  const rider = o.ref.type === "hal" ? "hal"
              : o.ref.type === "party" ? o.ref.partyId : null;
  if (!rider) return null;
  const m = S.followers.filter(function (f) { return f.riddenBy === rider; })[0];
  if (!m) return null;
  const b = CALC.followerBlock(S, m);
  return b ? { name: m.name, token: m.token, kind: b.type.name } : null;
}

function ordInfo(o) {
  const name = CALC.combatantName(S, o.ref);
  let status = "";
  if (o.ref.type === "party") {
    const m = (S.party.roster || []).filter(function (x) { return x.id === o.ref.partyId; })[0];
    if (m && m.status && m.status !== "healthy") status = m.status;
  }
  return {
    name: name,
    /* First names only. Nobody at the table says "Hal Briarshade's turn",
       the face beside it is doing most of the identifying anyway, and a
       surname is the difference between the strip fitting on its row and
       spilling onto one of its own. A lumped enemy keeps its whole label
       — "Goblin archers" is not a first name and cutting it to "Goblin"
       loses the point. */
    short: o.ref.type === "foe" ? name : name.split(/\s+/)[0],
    hal: o.ref.type === "hal",
    token: CALC.combatantToken(S, o.ref),
    status: status,
    mount: ordMount(o),
    init: o.initiative
  };
}

function orderStrip() {
  const order = S.combat.order;
  if (!order.length) {
    return '<div class="ordstrip"><span class="foot" style="margin:0">' +
      "No turn order — Next turn just resets your own budget. " +
      "Set one from Turn order above.</span></div>";
  }
  let curIdx = order.findIndex(function (o) { return o.id === S.combat.currentId; });
  if (curIdx < 0) curIdx = 0;

  /* One row, in initiative order, on a line of its own under the round
     counter. Not a rotation starting from whoever is up: the order is a
     fixed thing the table read out once, and a list that reshuffles every
     time somebody's turn ends is a list you have to re-read every time.
     It stays put and the highlight moves along it.

     Whose go it is gets a bigger face and the name in yellow. Everyone
     else keeps their name too — the same shape on the iPad as on a
     desktop, because the iPad is the screen this is actually read on and
     it has the room. */
  return '<div class="ordstrip">' + order.map(function (o, i) {
    const q = ordInfo(o);
    const on = i === curIdx;
    const next = i === (curIdx + 1) % order.length && order.length > 1;
    return '<span class="ordc' + (on ? " on" : "") + (next ? " next" : "") +
      (q.mount ? " ridden" : "") +
      (q.status ? " st-" + q.status : "") + '" title="' + esc(q.name) +
        (q.init == null ? "" : " · initiative " + q.init) +
        (q.status ? " · " + q.status : "") +
        (q.mount ? " · riding " + esc(q.mount.name) : "") +
        (on ? " · up now" : next ? " · on deck" : "") + '">' +
      tokenFace({ hal: q.hal, token: q.token, name: q.name, cls: "ordface" }) +
      (o.ref.type === "hal" ? companionBadges("hal")
        : o.ref.type === "party" ? companionBadges(o.ref.partyId) : "") +
      /* Chained, not listed twice. The mount moves on this turn, so it
         belongs to this chip — a slot of its own would be a turn that
         never comes round. */
      (q.mount
        ? '<span class="ordlink">+</span>' +
          tokenFace({ token: q.mount.token, name: q.mount.name, cls: "ordface mountface" })
        : "") +
      '<span class="ordn">' + esc(q.short) + "</span>" +
      (q.init == null ? "" : '<span class="ordi">' + q.init + "</span>") +
      "</span>";
  }).join("") + "</div>";
}

/* ---------- ACTIVE EFFECTS ---------------------------------- */
/* Collapsible panel header — same Hide/Show mechanism as the Filter panel,
   so every "fold this away" control in the app works the same way. A busy
   combat can stack eight panels in one column; this lets you close the ones
   you aren't using without losing the count in the header. */
function panelHead(title, count, key) {
  const collapsed = !!UI.expanded[key];
  return {
    collapsed: collapsed,
    html: '<div class="pnl cut"><h3>' + title +
      (count == null ? "" : ' <span class="cnt">' + count + "</span>") +
      /* Same chip as every other panel's fold control — this is the
         same action, so it shouldn't look like a different one. */
      '<button class="pcol" data-act="expand" data-id="' + key + '">' +
      (collapsed ? "Show" : "Hide") + "</button></h3>"
  };
}

/* Yours and everyone else's in one panel, because mid-turn the question
   is "what is running", not "whose". The full editors live on the
   Effects tab; this is the read of the same two lists. */
EXT.effectsPanel = function () {
  if (!S.effects.length && !S.watch.length) return "";
  const total = S.effects.length + S.watch.length;
  const head = panelHead("Active effects", total, "effectsCollapsed");
  if (head.collapsed) return head.html + "</div>";
  const mods = CALC.activeMods(S);
  let out = head.html + ownEffectRows();

  const applied = [];
  if (mods.ac) applied.push((mods.ac > 0 ? "+" : "") + mods.ac + " AC");
  if (mods.attackFlat) applied.push("+" + mods.attackFlat + " attack");
  mods.attackDice.forEach(function (d) { applied.push(d.die + " to attacks (" + d.from + ")"); });
  mods.saveDice.forEach(function (d) { applied.push(d.die + " to saves (" + d.from + ")"); });
  mods.damageDice.forEach(function (d) { applied.push(d.die + " damage (" + d.from + ")"); });
  if (applied.length && S.settings.autoApplyEffects) {
    out += '<div class="seqnote">Applied to your numbers: <b>' + esc(applied.join(" · ")) + "</b></div>";
  }

  if (S.watch.length) {
    out += '<div class="cardgrp">Everyone else <span class="cardgrpn">' + S.watch.length + "</span></div>";
    S.watch.forEach(function (w) { out += watchCard(w, true); });
    out += '<div class="foot"><button class="bt cutsm" data-act="tab" data-tab="effects">' +
      "Open the Effects tab to edit these</button></div>";
  }
  return out + "</div>";
};

/* ---------- PARTY ROSTER ------------------------------------- */
/* We deliberately don't track allies' exact HP — just a coarse status,
   cycled by tapping: healthy -> bloodied (~50%) -> down -> healthy. */
const PARTY_STATUS = ["healthy", "bloodied", "down"];
const PARTY_STATUS_LABEL = { healthy: "Healthy", bloodied: "Bloodied", down: "Down" };
/* forceOpen: the pre-session checklist embeds this panel and collapsing it
   there would defeat the point, so it ignores the collapse flag. */
/* Followers sit with Party rather than with Creatures — they fight on
   your side, and the steed shares your Initiative count rather than
   rolling its own, so it never belongs in the turn order. */
EXT.followersPanel = function () {
  if (!S.followers.length) return "";
  return '<div class="pnl cut"><h3>Followers <span class="cnt">' + S.followers.length + "</span></h3>" +
    S.followers.map(function (f) { return followerCard(f, true); }).join("") +
    '<div class="seqnote">Shares your Initiative count — it acts on your turn, so it is not ' +
    "listed in the turn order.</div></div>";
};

EXT.partyPanel = function (forceOpen) {
  const roster = S.party.roster || [];
  const head = panelHead("Party", roster.length || "none", "partyCollapsed");
  if (head.collapsed && !forceOpen) return head.html + "</div>";
  let out = forceOpen
    ? '<div class="pnl cut"><h3>Party <span class="cnt">' + (roster.length || "none") + "</span></h3>"
    : head.html;
  if (!roster.length) {
    out += '<div class="foot" style="margin:0 0 8px">Add who\'s at the table today — this feeds the turn order. We track their combat status (healthy/bloodied/down), not their exact HP.</div>';
  }
  roster.forEach(function (m, i) {
    const status = m.status || "healthy";
    out += '<div class="tgt"><div class="eh">' +
      /* The face is fixed once set, so it is set here rather than in the
         initiative sheet — you choose it the day they join the party and
         never think about it again. */
      '<button class="facebtn" data-act="tokenModal" data-kind="party" data-id="' + m.id +
        '" title="Pick a face for ' + esc(m.name) + '">' +
        tokenFace({ token: m.token, name: m.name }) + "</button>" +
      '<input class="rowname" value="' + esc(m.name) + '" data-act="partyName" data-i="' + i + '">' +
      '<button class="bt cutsm st-' + status + '" data-act="partyStatus" data-i="' + i + '">' +
      PARTY_STATUS_LABEL[status] + "</button>" +
      '<button class="bt cutsm' + (m.present ? " pri" : "") + '" data-act="partyPresent" data-i="' + i + '">' +
      (m.present ? "Present" : "Away") + "</button>" +
      '<button class="bt cutsm dg" data-act="partyDel" data-i="' + i + '">Remove</button></div></div>';
  });
  out += '<div class="mrow"><button class="bt cutsm" data-act="partyAdd">+ Add party member</button></div>';
  return out + "</div>";
};

/* ---------- WHAT CAN I DO NOW -------------------------------
   The busiest panel in the app, and it used to be one flat run of
   twenty-three cards with the cost buried mid-line between the name and
   the button. Three changes, all aimed at the same thing — being able to
   answer "what have I got left for my bonus action" without reading:

   The list is grouped by what it costs you, so that question is answered
   by looking in one place rather than scanning every row.

   Each card is a fixed shape: name, then cost on its own line so the
   costs align down the column, then tags, with Cast and the wiki link
   stacked at the bottom right. Nothing shifts position between cards.

   Every entry already carried its rules text — spells from SPELLS, the
   universal actions from ACTION_CATALOG — and the panel simply never
   showed it. Tapping a name now opens it, which also means the generic
   Expand all control appears here for free. */

/* The universal actions every character has. They belong in the list —
   you can always Dodge — but they're the ones you stop needing reminding
   of, so the panel's condensed state is what drops them. Attack and Help
   stay: one is most turns, the other is a feat you paid for. */
const BASIC_ACTIONS = ["dash", "disengage", "dodge", "hide", "shove", "grapple", "opportunity"];

const ECONOMY_GROUPS = [
  ["action",   "Action"],
  ["bonus",    "Bonus action"],
  ["reaction", "Reaction"],
  ["free",     "Free"]
];

function doableCard(x) {
  const key = "d-" + x.kind + ":" + x.id;
  const open = !!UI.expanded[key];
  const basic = BASIC_ACTIONS.indexOf(x.id) >= 0;
  const cost = costLabel(x.cost) + (x.free ? " · free" : "");
  return '<div class="card doable' + (basic ? " cnd-hide" : "") + '">' +
    '<button class="namebtn cardname" data-act="expand" data-id="' + key + '">' + esc(x.name) + "</button>" +
    '<span class="cardmeta">' + esc(cost) + "</span>" +
    '<div class="cardtags">' +
      /* Clickable, matching the Spells and Features cards — a tag here is
         the same filter as everywhere else, so tapping it should work the
         same way whichever tab you tapped it from. */
      tagHTML(tagsOf((x.kind === "spell" ? "spell:" : "action:") + x.id, x.tags), true) + "</div>" +
    '<div class="cardbtns">' +
      '<button class="bt cutsm pri" data-act="use" data-kind="' + x.kind + '" data-id="' + x.id + '">' +
      (x.kind === "spell" ? "Cast" : "Use") + "</button>" +
      favBtn(x.kind, x.id) +
      wikiBtn(x.slug) +
    "</div>" +
    (open && x.text ? '<div class="carddetail">' + esc(x.text) + "</div>" : "") +
  "</div>";
}

EXT.canDoPanel = function () {
  /* Affordability and the tag filter are two different reasons for a card
     to be missing, and the foot note below has to tell them apart —
     "not affordable" on a card you filtered out on purpose is a lie. */
  const affordable = CALC.castables(S).filter(function (x) {
    if (x.afterHit && S.combat.active && !S.combat.turn.hitLanded) return false;
    return x.affordable;
  });
  const list = affordable.filter(function (x) {
    const tags = tagsOf((x.kind === "spell" ? "spell:" : "action:") + x.id, x.tags);
    return matchesFilter(tags);
  });
  /* The same Filter panel Spells and Features use, sharing the one
     UI.filter — a tag picked here stays picked when you flip tabs, so
     "only Bonus Action" doesn't reset itself the moment you go check a
     spell's text. This was the piece missing from the Combat tab: the
     busiest list in the app, with no way to narrow it mid-fight. */
  let out = filterPanel();
  out += '<div class="pnl cut" data-condense="Yours"><h3>What you can do now ' +
    '<span class="cnt">' + list.length + "</span></h3>";
  if (S.combat.active) {
    const t = S.combat.turn;
    out += '<div class="foot" style="margin:0 0 8px">' +
      (t.action ? "Action spent · " : "Action open · ") +
      (t.bonus ? "Bonus spent · " : "Bonus open · ") +
      (t.slotUsed ? "slot spent this turn" : "slot available") + "</div>";
  }

  ECONOMY_GROUPS.forEach(function (g) {
    const inGroup = list.filter(function (x) { return (x.cost && x.cost.type) === g[0]; });
    if (!inGroup.length) return;
    /* A heading whose whole group disappears in the condensed view has to
       disappear with it, the same way the skill groups do. */
    const allBasic = inGroup.every(function (x) { return BASIC_ACTIONS.indexOf(x.id) >= 0; });
    /* Two counts, one shown per state — otherwise a condensed group reads
       "Action 15" over eight cards. */
    const yours = inGroup.filter(function (x) { return BASIC_ACTIONS.indexOf(x.id) < 0; }).length;
    out += '<div class="cardgrp' + (allBasic ? " cnd-hide" : "") + '">' + g[1] +
      ' <span class="cardgrpn cnd-hide">' + inGroup.length + "</span>" +
      '<span class="cardgrpn cnd-show">' + yours + "</span></div>";
    inGroup.forEach(function (x) { out += doableCard(x); });
  });

  /* Anything the engine offers with a cost shape we don't group — belt and
     braces, so a new action can never silently vanish from the panel. */
  const grouped = ECONOMY_GROUPS.map(function (g) { return g[0]; });
  const ungrouped = list.filter(function (x) { return grouped.indexOf(x.cost && x.cost.type) < 0; });
  if (ungrouped.length) {
    out += '<div class="cardgrp">Other <span class="cardgrpn">' + ungrouped.length + "</span></div>";
    ungrouped.forEach(function (x) { out += doableCard(x); });
  }

  const hiddenCost = CALC.castables(S).length - affordable.length;
  const hiddenFilter = affordable.length - list.length;
  const footBits = [];
  if (hiddenCost > 0) footBits.push(hiddenCost + " not affordable right now");
  if (hiddenFilter > 0) footBits.push(hiddenFilter + " filtered out");
  if (footBits.length) out += '<div class="foot">' + footBits.join(" · ") + "</div>";
  return out + "</div>";
};

/* ---------- SETTINGS ---------------------------------------- */
EXT.settingsModal = function () {
  const rows = [
    ["rollPrompts", "Roll prompts", "After you cast or attack, pop a card telling you what to roll and why."],
    ["autoApplyEffects", "Auto-apply effects", "Active effects change your displayed AC and attack numbers."],
    ["economyLockout", "Grey out unaffordable", "In combat, dim what you can't pay for. You can still override."],
    ["confirmOverride", "Warn on override", "Ask before spending action economy you've already used."],
    ["edgeGlow", "Screen edge glow", "Cyan rim while concentrating, red rim below 20% HP."]
  ];
  const scale = (S.settings && S.settings.uiScale) || 100;
  let body = "<h2>Settings</h2><div class=\"msub\">All of these are stored with your sheet.</div>";
  body += '<div class="mrow"><span class="lbl">Display size</span>' +
    '<button class="bt cutsm" data-act="scaleUI" data-dir="-1">A−</button>' +
    '<button class="bt cutsm" data-act="scaleUI" data-dir="1">A+</button>' +
    '<button class="bt cutsm" data-act="resetUIScale">Reset</button>' +
    '<span class="lbl" style="margin-left:12px">' + scale + '%</span></div>';
  /* A preset row rather than a boolean, and rather than a free-typed
     number — "how long before the sheet nudges you" is really a choice
     of pace, not a precise duration, and the old value was a constant
     nobody but a developer could change. */
  const reminderMin = S.settings.noteReminderMinutes || 0;
  body += '<div class="mrow" style="margin-top:9px"><span class="lbl">Note reminder</span>' +
    [15, 30, 45, 60].map(function (m) {
      return '<button class="bt cutsm' + (reminderMin === m ? " pri" : "") +
        '" data-act="setNoteReminder" data-min="' + m + '">' + m + "</button>";
    }).join("") +
    '<button class="bt cutsm' + (reminderMin === 0 ? " pri" : "") +
      '" data-act="setNoteReminder" data-min="0">Off</button></div>' +
    '<div class="foot" style="margin:2px 0 9px">How many minutes into a running session before ' +
    "the sheet nudges you to jot something down. Resets every time you write a note.</div>";
  rows.forEach(function (r) {
    const on = S.settings[r[0]];
    body += '<button class="pick' + (on ? " sel" : "") + '" data-act="setting" data-key="' + r[0] + '">' +
      '<div class="pn">' + r[1] + " — " + (on ? "on" : "off") + "</div>" +
      '<div class="pt">' + r[2] + "</div></button>";
  });
  /* Which build is actually running. The offline cache is the reason an
     update can seem not to have landed, so say so plainly rather than
     leaving you to guess. */
  body += '<div class="seqnote">Running <b>' + esc(UI.swVersion || "checking…") + "</b>. " +
    "The app fetches its code from the network whenever you have signal, so an update arrives " +
    "as soon as you open it. With no signal it falls back to the copy it already has." +
    '<div class="mrow" style="margin-top:9px"><button class="bt cutsm" data-act="forceUpdate">' +
    "Force an update now</button></div></div>";
  body += '<div class="mfoot"><button class="bt cutsm pri" data-act="closeModal">Done</button></div>';
  return body;
};

/* ---------- ROLL PROMPT ------------------------------------- */
EXT.rollModal = function () {
  const m = UI.modal;
  let body = "<h2>" + esc(m.title) + "</h2>" +
    '<div class="msub">' + esc(m.why || "") + "</div>";
  m.rolls.forEach(function (r) {
    const isYou = r.who === "you";
    body += '<div class="rollcard' + (isYou ? " you" : " them") + '">' +
      '<div class="rw">' + (isYou ? "You roll" : "The target rolls") + "</div>" +
      '<div class="rd">' + esc(r.text) + "</div>" +
      '<div class="rwhy">' + esc(r.why) + "</div></div>";
  });
  /* The cost is already paid by the time this card appears, so the way
     out is to put it back — one step of the same history the Undo
     button uses, labelled for what it is. */
  body += '<div class="mfoot"><button class="bt cutsm pri" data-act="closeModal">Done</button>' +
    '<button class="bt cutsm dg" data-act="cancelCast">Cancel — take the cost back</button>' +
    '<button class="bt cutsm" data-act="settingsModal">Settings</button></div>';
  return body;
};

/* ---------- OVERRIDE CONFIRM -------------------------------- */
EXT.overrideModal = function () {
  const m = UI.modal;
  let body = "<h2>Can't afford that</h2><div class=\"msub\">" + esc(m.name) + "</div>";
  body += '<div class="warnbox" style="border-color:var(--mag);color:var(--mag);background:#1A0008">' +
    m.reasons.map(esc).join("<br>") + "</div>" +
    '<div class="msub">Your DM may have ruled otherwise, or this may be an interaction the app doesn\'t model. You can proceed anyway.</div>' +
    '<div class="mfoot"><button class="bt cutsm dg" data-act="useConfirm">Use anyway</button>' +
    '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ---------- ATTACK ROLL ---------------------------------------
   The primary click target for any weapon, in combat or out. The
   app never generates random numbers — you supply your own d20 and
   (if you know it) the target's AC, and it does the arithmetic and
   the hit/miss comparison, including the 2024 nat-1/nat-20 rules.
   Damage stays a formula plus a vulnerability/resistance note,
   never a fabricated total. */
EXT.attackModal = function () {
  const m = UI.modal;
  const a = CALC.attackAction(S);
  const row = a.rows.filter(function (r) { return r.id === m.id; })[0];
  if (!row) return "<h2>Weapon not found</h2>";
  const w = row.weapon, mast = MASTERIES[row.mastery];
  const riders = (a.riders || []).filter(function (r) { return r.on === "attack" || r.on === "damage"; });

  let body = "<h2>" + esc(w.name) + "</h2>" +
    '<div class="msub">' + esc(row.masteryActive ? mast.name + " active" : mast.name + " — inactive") +
    (w.range ? " · " + esc(w.range) : "") + "</div>";

  body += '<div class="atkbreak">';
  row.toHitSources.forEach(function (s) {
    body += '<div class="pr"><span>' + esc(s.label) + "</span><b>" +
      (typeof s.value === "number" ? sign(s.value) : esc(s.value)) + "</b></div>";
  });
  body += '<div class="tot"><span>Attack bonus</span><b>' + sign(row.toHit) + "</b></div></div>";

  const attackRiders = riders.filter(function (r) { return r.on === "attack"; });
  if (attackRiders.length) {
    body += '<div class="seqnote">Also roll, yourself: ' +
      attackRiders.map(function (r) { return r.die + " (" + r.from + ")"; }).join(", ") + "</div>";
  }

  /* The roll, and what it came to. No AC field and nobody to point it
     at: knowing a monster's armour class is a number the character has
     no way of having, and typing it in turned every swing into a
     calculation the DM was going to do anyway. You roll, the sheet adds
     it up, and the DM says whether it lands.

     What the sheet still owes you is the consequence of it landing —
     Vex, and whether a smite is available — so it asks, once. */
  body += '<div class="mrow" style="margin-top:12px">' +
    '<input type="number" id="atk-d20" placeholder="Your d20 result" min="1" max="20">' +
    '<button class="bt cutsm pri" data-act="attackCheck">Total it</button></div>';

  if (m.result) {
    const r = m.result;
    body += '<div class="atkbreak" style="margin-top:11px">' +
      '<div class="tot"><span>' + esc(r.note) + '</span><b>' + r.total + "</b></div></div>";
    if (r.crit) {
      body += '<div class="hitcard hit" style="margin-top:9px"><b>CRIT</b>' +
        "<span>Natural 20 — roll every damage die twice.</span></div>";
    }
    if (m.landed == null) {
      body += '<div class="mrow" style="margin-top:11px"><span class="lbl">Did it land?</span>' +
        '<button class="bt cutsm pri" data-act="attackLanded" data-v="1">Hit</button>' +
        '<button class="bt cutsm" data-act="attackLanded" data-v="0">Miss</button></div>';
    }
  }

  const dmgRiders = riders.filter(function (r) { return r.on === "damage"; });
  body += '<div class="dmgblock"><div class="ph2">Damage</div>' +
    '<div class="dd">' + esc(row.damage) + " " + esc(row.damageType) +
    (m.result && m.result.crit ? " — <b>critical, roll every damage die twice</b>" : "") + "</div>";
  if (dmgRiders.length) {
    body += '<div class="emeta">Plus, yourself: ' +
      dmgRiders.map(function (r) { return r.die + " (" + r.from + ")"; }).join(", ") + "</div>";
  }
  const vuln = m.vuln || "normal";
  const vulnNote = { normal: "", vulnerable: "Target is Vulnerable — double the total.",
    resistant: "Target is Resistant — half the total, round down.",
    immune: "Target is Immune — no damage." }[vuln];
  body += '<div class="vulnrow">';
  ["normal", "vulnerable", "resistant", "immune"].forEach(function (v) {
    body += '<button class="vpick' + (vuln === v ? " sel" : "") + '" data-act="attackVuln" data-v="' + v +
      '">' + v[0].toUpperCase() + v.slice(1) + "</button>";
  });
  body += "</div>";
  if (vulnNote) body += '<div class="seqnote">' + esc(vulnNote) + "</div>";
  body += "</div>";

  if (m.landed === true && row.mastery === "vex" && row.masteryActive) {
    body += '<div class="warnbox" style="margin-top:12px">Vex — you have Advantage on your next ' +
      'attack roll against that same creature, until the end of your next turn.</div>';
  }

  body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Done</button></div>';
  return body;
};

/* ---------- LAY ON HANDS AMOUNT ----------------------------- */
EXT.lohModal = function () {
  const pool = S.resources.layOnHands;
  let body = "<h2>Lay on Hands</h2><div class=\"msub\">Pool: " + pool +
    " HP. Bonus Action, touch. Spending 5 also removes the Poisoned condition.</div>" +
    '<div class="mrow"><input type="number" id="loh-amt" min="1" max="' + pool +
    '" placeholder="HP to spend" autofocus>' +
    '<button class="bt cutsm pri" data-act="lohSpendSelf">Heal yourself</button>' +
    '<button class="bt cutsm" data-act="lohSpendOther">Heal an ally</button></div>' +
    '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* Who to offer at the top of a fresh fight: you, whoever is present, and
   the enemies you named last time — names only, never their rolls, since
   the whole point is that everyone rolls again. Recycling the names is
   free and usually right: it is often the same goblins. */
function freshInitRows() {
  const rows = [{ key: "hal", kind: "hal", name: S.identity.name || "Hal", init: null, token: null }];
  (S.party.roster || []).filter(function (m) { return m.present; }).forEach(function (m) {
    rows.push({ key: "p:" + m.id, kind: "party", name: m.name, init: null, token: m.token });
  });
  /* Followers that fight roll for themselves. A familiar always does —
     it acts on its own turn, not yours — and so does a mount, but only
     while nobody is on it: a ridden mount moves on its rider's turn and
     a second slot for it would be a turn that never happens.

     A pack animal is not offered at all. An order with the baggage in it
     is an order you stop reading. */
  S.followers.forEach(function (f) {
    const b = CALC.followerBlock(S, f);
    if (!b) return;
    if (f.source === "findSteed" || (b.isMount && f.riddenBy)) return;
    if (f.source !== "findFamiliar" && !b.inCombat) return;
    rows.push({ key: "f:" + f.id, kind: "follower", name: f.name,
                init: null, token: f.token });
  });
  /* Last fight's enemies come back by name AND by face — it is usually
     the same goblins, and re-picking the picture every encounter is the
     kind of chore that stops people using the feature at all. */
  S.combat.order.filter(function (o) { return o.ref && o.ref.type === "foe"; })
    .forEach(function (o) {
      rows.push({ key: newId("f:"), kind: "foe", name: o.ref.name || "",
                  init: null, token: validToken(o.ref.token) });
    });
  return rows;
}

/* The order as it actually stands, for editing mid-fight. */
function rowsFromOrder() {
  return S.combat.order.map(function (o) {
    const kind = o.ref ? o.ref.type : "foe";
    return { key: o.id, kind: kind, name: CALC.combatantName(S, o.ref),
             init: o.initiative, token: CALC.combatantToken(S, o.ref) };
  });
}

/* ---------- GETTING ON A HORSE ------------------------------
   Two questions and a price. Who is getting on, onto what, and — if it
   is Hal and a fight is running — half his Speed, which the 2024 rules
   charge for mounting and which is exactly the sort of thing that gets
   forgotten and then argued about.

   An ally's movement is not deducted. The sheet has never tracked an
   ally's movement and inventing a number for it would be worse than
   leaving it to the person whose turn it is. */
EXT.mountModal = function () {
  const m = UI.modal;
  const free = allMounts().filter(function (f) { return !f.riddenBy || f.id === m.mount; });
  const mount = free.filter(function (f) { return f.id === m.mount; })[0] || free[0];
  if (!mount) return "<h2>Nothing to ride</h2>" +
    '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Close</button></div>';
  const b = CALC.followerBlock(S, mount);
  const riderIsHal = m.rider === "hal";
  const cost = Math.floor(S.identity.speed / 2);
  const left = S.identity.speed - S.combat.turn.movementUsed;

  let body = "<h2>Mount up</h2><div class=\"msub\">The mount acts on its rider's turn.</div>";

  body += '<div class="mrow"><span class="lbl">Rider</span>' +
    '<select data-act="mountRider" style="flex:1;min-width:130px">' +
      ownerOptions().map(function (o) {
        return '<option value="' + o.id + '"' + (m.rider === o.id ? " selected" : "") + ">" +
          esc(o.name) + "</option>";
      }).join("") + "</select></div>";

  body += '<div class="mrow"><span class="lbl">Mount</span>' +
    '<select data-act="mountPick" style="flex:1;min-width:130px">' +
      free.map(function (f) {
        return '<option value="' + f.id + '"' + (m.mount === f.id ? " selected" : "") + ">" +
          esc(f.name) + (f.kind ? " · " + esc(f.kind) : "") + "</option>";
      }).join("") + "</select></div>";

  /* A companion has a role (COMPANION_ROLES); a summoned steed doesn't —
     it has the animal form you picked when you cast the spell, on
     formLabel, and nothing else here assumed a mount could arrive
     without a .role until this modal met one. Its "why" is different
     for the same reason: it shares your Initiative whether you're on it
     or not, which is not the same claim as "stays out of the turn
     order" — that line is true of a companion, not of the spell. */
  const roleLabel = b.role ? b.role.label : b.formLabel;
  const roleWhy = b.source.key === "findSteed"
    ? "shares your Initiative — mounted or not"
    : (b.inCombat ? "takes its own turn when nobody is on it" : "stays out of the turn order");
  body += '<div class="sb"><div class="sbrow"><span>Its speed</span><b>' + esc(b.speed) +
    '</b><span class="sbwhy">what you move at while mounted</span></div>' +
    '<div class="sbrow"><span>Its role</span><b>' + esc(roleLabel) + "</b>" +
    '<span class="sbwhy">' + roleWhy + "</span></div>";
  if (riderIsHal) {
    body += '<div class="sbrow"><span>Costs</span><b>' + cost +
      ' ft</b><span class="sbwhy">half your Speed, 2024 rules</span></div>' +
      '<div class="sbrow"><span>You have</span><b>' + left +
      ' ft</b><span class="sbwhy">' + (S.combat.active ? "left this turn" : "out of combat, nothing is spent") +
      "</span></div>";
  } else {
    body += '<div class="sbrow"><span>Costs</span><b>their half</b>' +
      '<span class="sbwhy">not deducted here — their movement is theirs to spend</span></div>';
  }
  body += "</div>";

  if (riderIsHal && S.combat.active && left < cost) {
    body += '<div class="warnbox" style="margin-top:11px">That is more movement than you have ' +
      "left. You can still do it — the sheet will take you to zero.</div>";
  }

  body += '<div class="mfoot">' +
    '<button class="bt cutsm pri" data-act="mountConfirm">Mount up</button>' +
    '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ---------- PICKING A FACE -----------------------------------
   One picker, two callers. The party panel sets a roster member's face,
   which is fixed once chosen — Gill looks like Gill in every fight. The
   initiative sheet sets a foe's, which is not fixed at all, because "the
   goblins" this week are a different picture from "the goblins" last
   week and the whole point of a lumped entry is that it is disposable.

   `UI.modal.target` says which: {kind:"party", id} or {kind:"row", i}
   for a row of the initiative sheet being filled in. */
EXT.tokenModal = function () {
  const m = UI.modal;
  const cur = validToken(m.current);
  const q = (m.q || "").trim().toLowerCase();

  let body = "<h2>Pick a face</h2><div class=\"msub\">" +
    esc(m.who ? "For " + m.who : "Whoever this is") + "</div>";

  /* A hundred and fifty faces is too many to scroll past, so there is a
     search — and it matches the label, which is the only reason the
     labels exist. */
  body += '<div class="mrow"><input type="text" id="tok-q" placeholder="orc, dragon, cleric…" ' +
    'value="' + esc(m.q || "") + '" data-act="tokenSearch" style="flex:1;min-width:150px">' +
    (q ? '<button class="bt cutsm" data-act="tokenSearchClear">Clear</button>' : "") +
    '<button class="bt cutsm dg" data-act="tokenSet" data-i="">No face</button></div>';

  /* Where the picker was opened FOR something — a familiar, a mount —
     the band that holds those faces comes first. Everything is still
     there below it; this only saves scrolling past four hundred goblins
     to find a horse. */
  const bands = m.band
    ? TOKEN_BANDS.filter(function (b) { return (b.use || []).indexOf(m.band) >= 0; })
        .concat(TOKEN_BANDS.filter(function (b) { return (b.use || []).indexOf(m.band) < 0; }))
    : TOKEN_BANDS;
  let shown = 0;
  bands.forEach(function (band) {
    const hits = [];
    for (let i = band.from; i < band.from + band.count; i++) {
      if (!q || tokenLabel(i).toLowerCase().indexOf(q) >= 0) hits.push(i);
    }
    if (!hits.length) return;
    shown += hits.length;
    body += '<div class="cardgrp">' + esc(band.label) +
      ' <span class="cardgrpn">' + hits.length + "</span></div>";
    if (!q) body += '<div class="foot" style="margin:0 0 6px">' + esc(band.note) + "</div>";
    body += '<div class="tokgrid">';
    hits.forEach(function (i) {
      body += '<button class="tokpick' + (cur === i ? " sel" : "") +
        '" data-act="tokenSet" data-i="' + i + '" title="' + esc(tokenLabel(i)) + '">' +
        '<span class="face tok sh' + tokenSheet(i) + '" style="' + tokenStyle(i) + '"></span>' +
        '<span class="tokname">' + esc(tokenLabel(i)) + "</span></button>";
    });
    body += "</div>";
  });
  if (!shown) body += '<div class="foot">Nothing matches that.</div>';

  body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ---------- THE FAVOURITES USE WINDOW ------------------------
   A rail row is 250px wide and can hold one button, which forces every
   pinned thing into a single unasked question with a single assumed
   answer. Find Steed is the clean example: the engine prefers the free
   Faithful Steed cast whenever one is available, so pinning it meant you
   could never deliberately spend a slot and keep the free one for later.
   A potion is the other shape of the same problem — you drink them, and
   you also buy four of them, and the row could only ever do the first.

   So the window asks. It also carries the rules text, which is the other
   thing the row never had room for and the reason you'd want to look at
   a pinned spell without casting it. */
EXT.favUseModal = function () {
  const m = UI.modal;
  const castables = CALC.castables(S);
  const r = favResolve({ kind: m.kind, id: m.id }, castables);
  if (!r) return "<h2>Not found</h2><div class=\"msub\">This favourite points at something " +
    "that is no longer on the sheet.</div>" +
    '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Close</button></div>';

  let body = "<h2>" + esc(r.name) + "</h2>";
  if (r.meta) body += '<div class="msub">' + esc(r.meta) + "</div>";
  /* An item's one-line note is both its meta and all the text it has, so
     printing both says the same thing twice. */
  if (r.text && r.text !== r.meta) {
    body += '<div class="carddetail" style="border:none;padding:0;margin:0 0 4px">' +
      esc(r.text) + "</div>";
  }

  /* --- Something you carry: spend one, or write down the ones you bought --- */
  if (r.item) {
    const it = r.item;
    body += '<div class="ph2" style="margin-top:14px">You have <b class="mono">' + it.qty + "</b></div>";
    body += '<div class="mrow"><span class="lbl">How many</span>' +
      '<input type="number" id="fav-qty" min="1" value="1" style="width:84px">' +
      '<button class="bt cutsm ' + (it.qty > 0 ? "pri" : "dim") + '" data-act="favItem" data-d="-1"' +
        (it.qty > 0 ? "" : " disabled") + ">Use</button>" +
      '<button class="bt cutsm" data-act="favItem" data-d="1">Gain</button></div>';
    if (!it.consumable) {
      body += '<div class="foot">This isn\'t marked Consumable, so the count is all this changes — ' +
        "nothing is spent anywhere else. Mark it Consumable on the Inventory tab if it should be.</div>";
    }
    body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Done</button></div>';
    return body;
  }

  /* --- A summon has its own questions, and they come first ---
     Find Steed and Find Familiar ask what answers before anything is
     spent, and that picker already knows how to charge for what you
     chose. Casting one from here would pay twice. */
  if (r.c && SPELLS[m.id] && SPELLS[m.id].summons) {
    body += '<div class="foot" style="margin-top:12px">Costs ' +
      esc(costLabel(r.c.rawCost || r.c.cost)) +
      (r.c.free ? ", or nothing — you still have the free cast" : "") +
      ". The picker asks what you're calling before it charges you.</div>";
    body += '<div class="mfoot">' +
      '<button class="bt cutsm pri" data-act="summonModal" data-spell="' +
        esc(SPELLS[m.id].summons) + '">Choose what answers…</button>' +
      '<button class="bt cutsm" data-act="closeModal">Close</button></div>';
    return body;
  }

  /* --- Something you cast or do --- */
  if (r.c) {
    const c = r.c;
    const verb = c.kind === "spell" ? "Cast" : "Use";
    const afterHit = c.afterHit && S.combat.active && !S.combat.turn.hitLanded;

    body += '<div class="ph2" style="margin-top:14px">What it costs</div>';
    body += '<div class="mrow">';
    /* Where a free cast exists, BOTH are offered and neither is assumed.
       The free one leads because it is usually what you want, but the
       whole reason this window exists is that sometimes it isn't. */
    if (c.free) {
      body += '<button class="bt cutsm pri" data-act="favCast" data-how="free">' +
        verb + " free — no slot</button>" +
        '<button class="bt cutsm" data-act="favCast" data-how="paid">' + verb + " with " +
        esc(costLabel(c.rawCost) || "the usual cost") + "</button>";
    } else {
      body += '<button class="bt cutsm ' + (c.affordable && !afterHit ? "pri" : "dim") +
        '" data-act="favCast" data-how="normal">' + verb + " · " +
        esc(costLabel(c.cost) || "no cost") + "</button>";
    }
    body += "</div>";

    if (afterHit) {
      body += '<div class="warnbox" style="margin-top:11px">This one waits on a hit — ' +
        'log one on the combat strip first. You can still use it anyway.</div>';
    } else if (!c.affordable) {
      body += '<div class="warnbox" style="margin-top:11px">' +
        esc((c.reasons || []).join(" · ") || "You can't pay for this right now.") +
        " You can still use it anyway.</div>";
    }
    if (c.effect) {
      body += '<div class="foot">Leaves <b>' + esc(c.effect.name) + "</b> running" +
        (c.effect.conc ? ", and takes your concentration" : "") + ".</div>";
    }
    body += '<div class="mfoot">' +
      '<button class="bt cutsm" data-act="favUnpin" data-kind="' + esc(m.kind) +
        '" data-id="' + esc(m.id) + '">Unpin</button>' +
      '<button class="bt cutsm" data-act="closeModal">Close</button></div>';
    return body;
  }

  /* --- Passive: a feature or feat pinned to be read --- */
  body += '<div class="foot" style="margin-top:12px">Nothing to spend — this one is always on.</div>';
  body += '<div class="mfoot">' +
    '<button class="bt cutsm" data-act="favUnpin" data-kind="' + esc(m.kind) +
      '" data-id="' + esc(m.id) + '">Unpin</button>' +
    '<button class="bt cutsm" data-act="closeModal">Close</button></div>';
  return body;
};

/* ---------- ROLLING INITIATIVE -------------------------------
   A fight starts by everyone rolling, so entering combat asks for the
   numbers rather than assuming last fight's order still means anything.
   That is what it used to do: enter combat, open the builder, clear the
   stale rolls, re-add whoever is here now, retype the numbers. Three
   steps of undoing the last encounter before you could record this one.

   Rows live on the modal, not on the sheet, until you press the button.
   Nothing here writes to S.combat.order — a fight you started asking
   about and then thought better of leaves no trace.

   Enemies are one row each, not one per creature. The table lumps their
   initiative, so "Goblins 14" is the whole of what the sheet needs to
   know, and typing six goblins in to watch them all act at 14 was never
   buying anything. */
/* Does row i share a roll with its neighbour in direction d? A blank is
   not a tie — "we never got their number" is not "they rolled the same
   as you", and two blanks in a row are just two unknowns. */
function tiedWith(rows, i, d) {
  const a = rows[i], b = rows[i + d];
  return !!(a && b && a.init != null && b.init != null && a.init === b.init);
}

EXT.initiativeModal = function () {
  const m = UI.modal;
  const editing = !!m.editing;
  const init = CALC.initiative(S);

  let body = "<h2>" + (editing ? "Turn order" : "Roll for initiative") + "</h2>" +
    '<div class="msub">' + (editing
      ? "Adjust the numbers or who is in the fight. Highest goes first."
      : "Everyone rolls. Type what they got — highest goes first, and anything left blank " +
        "goes to the back.") + "</div>";

  body += '<div class="ph2">Who is in it</div>';
  /* Typing a whole table of rolls is the actual task here, and Tab is how
     you move down it — so the numeric input is the only thing in each row
     that Tab should ever land on. Everything else (the portrait, a foe's
     name, the tie-break arrows, the drop button) gets tabindex="-1": still
     reachable by tap or by Shift+Tab-then-click, just not something the
     roll-then-Tab-then-roll rhythm can stumble into. The input's own
     tabindex is the row number, one-based, so the order survives even if
     a row without a face or a name button changes the DOM's own order. */
  m.rows.forEach(function (r, i) {
    /* Hal wears his own portrait and the party wear the faces set on the
       roster; only a foe gets to choose one here, because only a foe's is
       a fresh decision every fight. */
    const face = tokenFace({ hal: r.kind === "hal", token: r.token, name: r.name });
    body += '<div class="ordrow">' +
      (r.kind === "foe"
        ? '<button class="facebtn" tabindex="-1" data-act="tokenModal" data-kind="row" data-i="' + i +
          '" title="Pick a face for this line">' + face + "</button>"
        : '<span class="facebtn fixed">' + face + "</span>") +
      (r.kind === "foe"
        ? '<input class="on rowname" tabindex="-1" value="' + esc(r.name) +
          '" placeholder="Goblins, the ogre…" data-act="initName" data-i="' + i + '">'
        : '<span class="on">' + esc(r.name) +
          (r.kind === "hal" ? ' <span class="emeta">' + sign(init.value) + " to the roll</span>" : "") +
          "</span>") +
      '<input type="number" class="oinit" tabindex="' + (i + 1) + '" data-act="initValue" data-i="' + i +
        '" placeholder="Roll" value="' + (r.init == null ? "" : r.init) + '">' +
      /* Ties are settled by hand. The rules leave it to the table, and a
         sort cannot know that the rogue goes before the ogre on a 14 —
         so the arrows are here, and they only appear between people who
         actually tied, because nudging anyone else would be undone by
         the sort the moment you commit. */
      (tiedWith(m.rows, i, -1)
        ? '<button class="bt cutsm" tabindex="-1" data-act="initMove" data-i="' + i +
          '" data-d="-1" title="Go before the one above, on the same roll">↑</button>' : "") +
      (tiedWith(m.rows, i, 1)
        ? '<button class="bt cutsm" tabindex="-1" data-act="initMove" data-i="' + i +
          '" data-d="1" title="Go after the one below, on the same roll">↓</button>' : "") +
      '<button class="bt cutsm dg" tabindex="-1" data-act="initDrop" data-i="' + i +
        '" title="Not in this fight">×</button>' +
      "</div>";
  });
  if (!m.rows.length) {
    body += '<div class="foot">Nobody in the fight yet.</div>';
  }

  body += '<div class="mrow" style="margin-top:9px">' +
    '<button class="bt cutsm" tabindex="-1" data-act="initAddFoe">+ Enemy</button>' +
    '<button class="bt cutsm" tabindex="-1" data-act="initAddParty">+ Everyone present</button>' +
    (m.rows.some(function (r) { return r.kind === "hal"; })
      ? "" : '<button class="bt cutsm" tabindex="-1" data-act="initAddHal">+ ' +
        esc(S.identity.name || "Hal") + "</button>") +
    "</div>";

  const away = (S.party.roster || []).filter(function (x) { return !x.present; }).length;
  if (away) {
    body += '<div class="foot">' + away + " party member" + (away === 1 ? " is" : "s are") +
      " marked Away and not offered. Change that on the Combat tab.</div>";
  }

  body += '<div class="mfoot">' +
    '<button class="bt cutsm pri" data-act="initCommit">' +
      (editing ? "Update order" : "Start the fight") + "</button>" +
    '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ---------- SESSION LOG ---------------------------------------
   A lightweight, timestamped event feed — not a structured combat
   log. It piggybacks on the labels every mutate() call already
   carries (see the mutate wrapper above), so casting, attacking,
   resting, noting who is affected, and so on all show up for free once a
   session is running. `stats` are a couple of running highs, not a
   full breakdown. */
function fmtTime(t) { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(t) { return new Date(t).toLocaleDateString(); }
/* Notes and flags are the story; everything else is bookkeeping the app
   logged for you. Splitting them is what makes a recap readable. */
function isNarrative(e) {
  return e.kind === "note" || e.kind === "flag" || e.kind === "world";
}

/* In-world date for a log entry, in whichever calendar you're reading. */
function calLabel(e) {
  if (!e.cal) return "";
  return CAL.format(S.calendar.system, e.cal.day) + ", " + CAL.timeLabel(e.cal.time);
}

function sessionToMarkdown(s) {
  const sys = S.calendar.system;
  let out = "# Session — " + fmtDate(s.startedAt) + "\n\n";
  out += "*" + fmtTime(s.startedAt) + " to " + fmtTime(s.endedAt) + "*\n\n";
  if (s.party && s.party.length) out += "- Party: **" + s.party.join(", ") + "**\n";
  if (s.stats.highestDCSet != null) out += "- Highest save DC set: **" + s.stats.highestDCSet + "**\n";

  const story = s.log.filter(isNarrative);
  const tech = s.log.filter(function (e) { return !isNarrative(e); });

  if (story.length) {
    out += "\n## What happened\n\n";
    /* Grouped by in-world day so the recap reads as a journal rather than
       a flat feed — several real-world hours can be one in-game morning. */
    let lastKey = null;
    story.forEach(function (e) {
      const key = e.cal ? e.cal.year + ":" + e.cal.day : "undated";
      if (key !== lastKey) {
        lastKey = key;
        out += (out.slice(-2) === "\n\n" ? "" : "\n") + "### " +
          (e.cal ? CAL.bothLabel(e.cal.day, e.cal.year) : "Undated") + "\n\n";
      }
      out += "- **" + (e.cal ? CAL.timeLabel(e.cal.time) : fmtTime(e.t)) + "** — " +
        (e.kind === "flag" ? "⚠ " : "") + e.label + "\n";
    });
  }

  if (tech.length) {
    out += "\n## Technical log\n\n";
    tech.forEach(function (e) {
      out += "- " + fmtTime(e.t) +
        (e.cal ? " (" + CAL.bothLabel(e.cal.day, null) + ")" : "") +
        " — " + e.label + "\n";
    });
  }
  return out;
}
/* Every session, newest first, as one document — what the cloud backup
   carries and what "Export all" hands you. The running session is
   included, closed off at now, so you never have to end a session to
   read it back. */
function allSessionsMarkdown() {
  const all = S.sessionHistory.slice();
  if (S.session && S.session.active) {
    all.push(Object.assign({}, S.session, { endedAt: Date.now() }));
  }
  if (!all.length) return "";
  return all.reverse().map(sessionToMarkdown).join("\n\n---\n\n");
}

/* Which session a given export button means. */
function sessionFor(which) {
  if (which === "current") {
    return S.session && S.session.active
      ? Object.assign({}, S.session, { endedAt: Date.now() })
      : null;
  }
  return S.sessionHistory[S.sessionHistory.length - 1] || null;
}

function sessionMarkdownFor(which) {
  if (which === "all") return allSessionsMarkdown();
  const s = sessionFor(which);
  return s ? sessionToMarkdown(s) : "";
}

/* The export block, shown whether or not a session is running. Getting
   the notes off the iPad was the whole point and it used to be reachable
   only after ending a session, from a single button that only ever gave
   you the last one. */
function sessionExportControls() {
  const running = !!(S.session && S.session.active);
  const count = S.sessionHistory.length + (running ? 1 : 0);
  if (!count) return "";
  let out = '<div class="ph2" style="margin-top:14px">Take the notes with you</div><div class="mrow">';
  const which = running ? "current" : "last";
  const label = running ? "this session" : "last session";
  out += '<button class="bt cutsm pri" data-act="sessionCopy" data-which="' + which +
      '">Copy ' + label + "</button>" +
    '<button class="bt cutsm" data-act="sessionExport" data-which="' + which +
      '">Share ' + label + "</button>";
  if (count > 1) {
    out += '<button class="bt cutsm" data-act="sessionExport" data-which="all">Share all ' +
      count + "</button>";
  }
  out += "</div>";
  out += '<div class="foot">Copy puts the Markdown on the clipboard — paste it anywhere. ' +
    "Share opens the iPad share sheet, so it can go to Files, Mail or another device. " +
    "Every cloud sync also writes them to your backup gist as <b>hal-session-notes.md</b>, " +
    "which reads as a formatted page on any computer.</div>";
  return out;
}

EXT.sessionModal = function () {
  const s = S.session;
  let body = "<h2>Session log</h2>";
  if (s.active) {
    body += '<div class="msub">Started ' + fmtTime(s.startedAt) + " · " + s.log.length + " event(s) logged</div>";
    if (s.party && s.party.length) {
      body += '<div class="foot">Party: <b>' + esc(s.party.join(", ")) + "</b></div>";
    }
    const stats = [];
    if (s.stats.highestDCSet != null) stats.push("Highest save DC set: " + s.stats.highestDCSet);
    if (stats.length) body += '<div class="foot">' + esc(stats.join(" · ")) + "</div>";
    body += '<div class="foot" style="margin-top:2px">In-world it is <b>' +
      esc(CAL.stamp(S.calendar)) + "</b></div>";
    /* Through the same composer the nudge opens, rather than a second
       one-line box here. Two ways to write a note is how you end up with
       two kinds of note. */
    body += '<div class="mrow"><button class="bt cutsm pri" data-act="noteModal">' +
      "Write something down…</button></div>";

    const story = s.log.filter(isNarrative);
    const tech = s.log.filter(function (e) { return !isNarrative(e); });

    body += '<div class="ph2" style="margin-top:10px">What happened</div>';
    if (!story.length) {
      body += '<div class="foot">No notes yet. Anything you jot lands here, along with the moments worth flagging on their own — going down, dying, coming back.</div>';
    }
    story.slice().reverse().forEach(function (e) {
      const stamp = calLabel(e) || fmtTime(e.t);
      body += '<div class="gain ' +
        (e.kind === "flag" ? "k-flag" : e.kind === "world" ? "k-proficiency" : "k-note") + '">' +
        '<span class="gk">' + esc(stamp) + "</span><span>" +
        (e.kind === "flag" ? "⚠ " : "") + esc(e.label) + "</span></div>";
    });

    /* The mechanical feed is still captured and still exported — it just
       doesn't get to drown out the notes you actually wrote. */
    const techHidden = !UI.expanded.sessionTechOpen;
    body += '<div class="ph2" style="margin-top:12px">Technical log ' +
      '<span class="sc">' + tech.length + "</span>" +
      '<button class="bt cutsm" style="margin-left:8px" data-act="expand" data-id="sessionTechOpen">' +
      (techHidden ? "Show" : "Hide") + "</button></div>";
    if (!techHidden) {
      if (!tech.length) body += '<div class="foot">Nothing mechanical logged yet.</div>';
      tech.slice().reverse().forEach(function (e) {
        body += '<div class="gain"><span class="gk">' + fmtTime(e.t) + "</span><span>" +
          esc(e.label) + "</span></div>";
      });
    }
    body += sessionExportControls();
    body += '<div class="mfoot"><button class="bt cutsm dg" data-act="sessionEnd">End session</button>' +
      '<button class="bt cutsm" data-act="closeModal">Keep playing</button></div>';
  } else {
    body += '<div class="msub">A lightweight, automatic log of what happens at the table — casts, attacks, rests, and party changes get a timestamped line while a session is running.</div>';
    body += '<div class="mrow"><button class="bt cutsm pri" data-act="preSessionModal">Start session</button></div>';
    if (S.sessionHistory.length) {
      const last = S.sessionHistory[S.sessionHistory.length - 1];
      const lastStats = [];
      if (last.stats.highestDCSet != null) lastStats.push("highest DC set " + last.stats.highestDCSet);
      body += '<div class="ph2" style="margin-top:10px">Last session</div>';
      body += '<div class="foot">' + fmtDate(last.startedAt) + " · " + last.log.length + " events" +
        (lastStats.length ? " · " + esc(lastStats.join(", ")) : "") + "</div>";
      if (last.party && last.party.length) {
        body += '<div class="foot">Party: ' + esc(last.party.join(", ")) + "</div>";
      }
    }
    body += sessionExportControls();
    body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Close</button></div>';
  }
  return body;
};

/* A gentle reminder strip, visible outside the Session modal, when a
   session is running and it's been a while since the last note (or
   since the session started, if there's no note yet). Lets you jot
   one right there without opening the modal.

   The cadence is a Settings field (minutes, 0 = disabled) rather than a
   constant now — everyone's table talks at a different pace, and the
   25-minute default that used to be hardcoded here is just its starting
   value (see SEED.settings.noteReminderMinutes in rules.js). */
EXT.sessionNudge = function () {
  if (!S.session.active) return "";
  const minutes = S.settings.noteReminderMinutes;
  if (!minutes) return "";
  const notes = S.session.log.filter(function (e) { return e.kind === "note"; });
  const last = notes.length ? notes[notes.length - 1].t : S.session.startedAt;
  if (Date.now() - last < minutes * 60 * 1000) return "";
  /* If today is a feast day, say so — it's usually the thing worth writing
     down, and it saves a trip to the Calendar tab to find out. */
  const feast = CAL.holidayFor(S.calendar.system, S.calendar.day);
  const prompt = feast
    ? "It's " + esc(feast.name) + " — worth a note?"
    : "Been a while since your last note";
  /* A prompt, not a form. The text box that used to live here was two
     inches wide at the top of the screen, and what you actually want to
     write down at the table is four things about a person, not a
     sentence — so the whole strip is one tap into somewhere with room.

     Deliberately not opened for you: a window that appears over your turn
     because a timer went off is a window you learn to dismiss. */
  return '<div class="strip cut nudge" data-act="noteModal">' +
    '<span class="lbl">' + prompt + "</span>" +
    '<button class="bt cutsm pri" data-act="noteModal">Write it down</button></div>';
};

/* ---------- WRITING SOMETHING DOWN --------------------------
   One composer, reached from the nudge above and from the session log.

   The old one was a single line of free text, which is fine for a
   sentence and wrong for what a session actually produces: you meet
   somebody, and what you know is a name, a place, and the thing they
   wanted. Three boxes and a heading beats one box every time, because
   the boxes are the questions — you fill them in without having to
   decide what a note should say.

   Every kind composes down to one plain line in the log. The structure
   is scaffolding for writing it, not a schema to read it back with. */
const NOTE_KINDS = [
  { id: "met", label: "Met someone", hint: "Goes to People too, if you want.",
    fields: [["who", "Who"], ["where", "Where"], ["want", "What they wanted"]],
    compose: function (f) {
      return "Met " + f.who + (f.where ? " in " + f.where : "") +
        (f.want ? " — " + f.want : "");
    } },
  { id: "learn", label: "Learned something",
    fields: [["what", "What you learned"], ["from", "From whom"]],
    compose: function (f) {
      return "Learned: " + f.what + (f.from ? " (from " + f.from + ")" : "");
    } },
  { id: "deal", label: "Deal or debt",
    fields: [["who", "With whom"], ["terms", "The terms"]],
    compose: function (f) {
      return "Deal with " + f.who + (f.terms ? ": " + f.terms : "");
    } },
  { id: "fight", label: "A fight",
    fields: [["who", "Against"], ["end", "How it ended"]],
    compose: function (f) {
      return "Fought " + f.who + (f.end ? " — " + f.end : "");
    } },
  { id: "found", label: "Found something",
    fields: [["what", "What"], ["where", "Where"]],
    compose: function (f) {
      return "Found " + f.what + (f.where ? " in " + f.where : "");
    } },
  { id: "place", label: "Somewhere new",
    fields: [["name", "What it's called"], ["what", "What's there"]],
    compose: function (f) {
      return "Reached " + f.name + (f.what ? " — " + f.what : "");
    } },
  { id: "plain", label: "Just a note",
    fields: [["text", "What happened", true]],
    compose: function (f) { return f.text; } }
];

function noteKindOf(id) {
  return NOTE_KINDS.filter(function (k) { return k.id === id; })[0] || NOTE_KINDS[0];
}
/* The line this would write, or "" if the first box is empty — which is
   what both the preview and the Save button key off, so they can't
   disagree about whether there is anything to save. */
function noteCompose(kind, f) {
  const vals = {};
  kind.fields.forEach(function (fd) { vals[fd[0]] = (f[fd[0]] || "").trim(); });
  if (!vals[kind.fields[0][0]]) return "";
  return kind.compose(vals).trim();
}

EXT.noteModal = function () {
  const m = UI.modal;
  const kind = noteKindOf(m.kind);
  const line = noteCompose(kind, m.f);

  let body = "<h2>Write it down</h2>" +
    '<div class="msub">In-world it is <b>' + esc(CAL.stamp(S.calendar)) + "</b></div>";

  const feast = CAL.holidayFor(S.calendar.system, S.calendar.day);
  if (feast) {
    body += '<div class="gain k-note"><span class="gk">Today</span><span>' +
      esc(feast.name) + "</span></div>";
  }

  /* The kinds first: picking one is what fills the form in, so it is the
     first decision and the only one that changes the shape of the page. */
  body += '<div class="phints" style="margin-bottom:4px"><span class="lbl">About</span>' +
    NOTE_KINDS.map(function (k) {
      return '<button class="hintchip' + (k.id === kind.id ? " on" : "") +
        '" data-act="noteKind" data-k="' + k.id + '">' + esc(k.label) + "</button>";
    }).join("") + "</div>";
  if (kind.hint) body += '<div class="foot" style="margin:0 0 8px">' + esc(kind.hint) + "</div>";

  kind.fields.forEach(function (fd, i) {
    const v = m.f[fd[0]] || "";
    body += '<div class="prow" style="margin-top:6px">' +
      (fd[2]
        ? '<textarea class="pnote" style="margin:0" placeholder="' + esc(fd[1]) +
          '" data-act="noteField" data-f="' + fd[0] + '">' + esc(v) + "</textarea>"
        : '<input type="text" style="flex:1;min-width:150px"' + (i === 0 ? " autofocus" : "") +
          ' placeholder="' + esc(fd[1]) + '" value="' + esc(v) +
          '" data-act="noteField" data-f="' + fd[0] + '">') +
      "</div>";
  });

  /* Everything composes to one line in the log, so show the line. It is
     the only way to know what the boxes are about to become. */
  body += '<div class="ph2" style="margin-top:12px">It will read</div>' +
    '<div class="gain k-note"><span class="gk">' + esc(CAL.timeLabel(S.calendar.timeOfDay)) +
    "</span><span>" + (line ? esc(line) : "<em>fill in the first box</em>") + "</span></div>";

  if (kind.id === "met") {
    body += '<div class="phints"><span class="lbl">Also</span>' +
      '<button class="hintchip' + (m.toPeople ? " on" : "") + '" data-act="noteToPeople">' +
      "Add them to People</button></div>";
  }

  body += '<div class="mfoot">' +
    '<button class="bt cutsm ' + (line ? "pri" : "dim") + '" data-act="noteSave">Save it</button>' +
    '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ---------- PRE-SESSION CHECKLIST -------------------------------
   A quick pre-game check-in shown before the session log actually
   starts: who's here tonight, an optional shortcut into a long rest
   for a fresh in-game day, and a heads-up about anything left over
   from last time that might need clearing before you begin. */
EXT.preSessionModal = function () {
  let body = "<h2>Before you start</h2>" +
    '<div class="msub">Mark who\'s here, then begin the session log.</div>';

  /* Open on the in-world date, so the session starts anchored in the story
     rather than only in wall-clock time. */
  const feasts = CAL.allHolidaysFor(S.calendar.day);
  body += '<div class="gain k-level"><span class="gk">Now</span><span>' +
    esc(CAL.stamp(S.calendar)) + "</span></div>";
  feasts.forEach(function (h) {
    body += '<div class="gain k-note"><span class="gk">' + esc(h.label) +
      "</span><span>" + esc(h.holiday.name) + "</span></div>";
  });

  body += EXT.partyPanel(true);
  body += '<div class="ph2" style="margin-top:10px">Rested?</div>' +
    '<div class="mrow"><button class="bt cutsm" data-act="preSessionRest">' +
    "Long rest — advance the calendar</button></div>";
  const stale = [];
  if (S.effects.length) stale.push(S.effects.length + " active effect" + (S.effects.length === 1 ? "" : "s"));
  if (S.toggles.concentrating) stale.push("Concentrating" + (S.toggles.concentratingOn ? " on " + esc(S.toggles.concentratingOn) : ""));
  if (stale.length) {
    body += '<div class="warnbox">Carried over from last time: ' + esc(stale.join(", ")) +
      ". Worth clearing before you begin if that's not intentional.</div>";
  }
  body += '<div class="mfoot"><button class="bt cutsm pri" data-act="sessionStart">Begin session</button>' +
    '<button class="bt cutsm" data-act="closeModal">Cancel</button></div>';
  return body;
};

/* ============================================================
   ACTIONS
   ============================================================ */
Object.assign(ACT, {

  /* ---- Combat mode ---- */
  /* Entering combat is rolling initiative, so it opens the roll sheet
     rather than silently reusing whatever order the last fight left
     behind. Nothing is written until you press the button in it. */
  combatStart() {
    UI.modal = { type: "initiative", editing: false, rows: freshInitRows() };
    render();
  },
  combatEnd() {
    mutate(function (st) {
      st.combat.active = false;
      st.combat.turn = CALC.freshTurn();
    }, "Exit combat");
  },
  endTurn() {
    /* CALC.peekNextTurn is order-aware but degrades exactly to the old
       solo behavior when S.combat.order is empty: it always reports
       wraps=true and becomesHal=true, which is what solo play needs
       every single "End turn" press. Work out what will expire before
       mutating, so nothing temporary ever gets written into saved state. */
    const peek = CALC.peekNextTurn(S);
    const expired = peek.wraps ? S.effects.filter(function (e) {
      return e.rounds != null && e.rounds - 1 <= 0;
    }).map(function (e) { return { name: e.name, conc: e.conc }; }) : [];

    /* One turn has gone by, and a round has if the order wrapped — which
       is exactly the pair the watched clocks tick on. */
    const due = watchDueAfter(S, 1, peek.wraps ? 1 : 0);

    mutate(function (st) {
      st.combat.currentId = peek.nextId;
      tickWatch(st, 1, peek.wraps ? 1 : 0);
      if (peek.wraps) {
        st.combat.round += 1;
        st.effects = st.effects.filter(function (e) {
          if (e.rounds == null) return true;
          e.rounds -= 1;
          return e.rounds > 0;
        });
        if (expired.some(function (e) { return e.conc; })) {
          st.toggles.concentrating = false;
          st.toggles.concentratingOn = "";
        }
      }
      if (peek.becomesHal) {
        st.combat.turn = CALC.freshTurn();
      }
    }, S.combat.order.length ? "Next turn" : "End turn");

    const notes = [];
    if (expired.length) notes.push("Expired: " + expired.map(function (e) { return e.name; }).join(", "));
    /* A clock reaching zero is the loudest thing that can happen on a
       turn advance, so it leads. */
    if (due.length) {
      notes.unshift("DUE NOW — " + due.map(function (w) {
        return [w.who, w.what].filter(Boolean).join(": ");
      }).join(" · "));
    }
    if (notes.length) UI.alert = { info: notes.join(" · ") };
    render();
  },
  /* Skip straight to your next turn, however many other people's turns
     went by without anyone pressing anything. Crossing a round boundary
     has to cost what crossing it the slow way costs — a round on the
     counter, a round off every timed effect — so a lap here decays
     effects by exactly the number of wraps it walked through, and drops
     concentration if what expired was being concentrated on.

     It is one undo step, not one per turn skipped: you pressed it once,
     so pressing Undo once should put it back. */
  toMyTurn() {
    const plan = CALC.peekToMyTurn(S);
    /* Solo, or an order Hal isn't in: a single turn is the whole of it. */
    if (!plan) return ACT.endTurn();

    const expired = plan.wraps ? S.effects.filter(function (e) {
      return e.rounds != null && e.rounds - plan.wraps <= 0;
    }).map(function (e) { return { name: e.name, conc: e.conc }; }) : [];

    /* A lap costs what walking it the slow way costs, and that has to
       include the watched clocks or a countdown would survive being
       skipped past. */
    const due = watchDueAfter(S, plan.steps, plan.wraps);

    mutate(function (st) {
      st.combat.currentId = plan.nextId;
      tickWatch(st, plan.steps, plan.wraps);
      if (plan.wraps) {
        st.combat.round += plan.wraps;
        st.effects = st.effects.filter(function (e) {
          if (e.rounds == null) return true;
          e.rounds -= plan.wraps;
          return e.rounds > 0;
        });
        if (expired.some(function (e) { return e.conc; })) {
          st.toggles.concentrating = false;
          st.toggles.concentratingOn = "";
        }
      }
      /* It is your turn now by construction, so the budget resets. */
      st.combat.turn = CALC.freshTurn();
    }, "To your turn");

    const skipped = plan.steps - 1;
    const notes = [];
    if (due.length) {
      notes.push("DUE NOW — " + due.map(function (w) {
        return [w.who, w.what].filter(Boolean).join(": ");
      }).join(" · "));
    }
    if (skipped > 0) notes.push("Skipped " + skipped + " turn" + (skipped === 1 ? "" : "s"));
    if (expired.length) notes.push("expired: " + expired.map(function (e) { return e.name; }).join(", "));
    if (notes.length) UI.alert = { info: notes.join(" · ") };
    render();
  },
  econToggle(el) {
    const k = el.dataset.key;
    mutate(function (st) { st.combat.turn[k] = !st.combat.turn[k]; }, "Toggle " + k);
  },
  move(el) {
    const d = parseInt(el.dataset.d, 10);
    mutate(function (st) {
      st.combat.turn.movementUsed = Math.max(0,
        Math.min(st.identity.speed, st.combat.turn.movementUsed + d));
    }, "Movement");
  },
  logHit() {
    mutate(function (st) { st.combat.turn.hitLanded = true; }, "Log a hit");
    const smites = CALC.castables(S).filter(function (x) { return x.afterHit && x.affordable; });
    if (S.settings.rollPrompts && smites.length) {
      UI.alert = { info: "Hit landed. Smites available: " +
        smites.map(function (s) { return s.name; }).join(", ") + " — Bonus Action, after the hit." };
    }
    render();
  },

  /* ---- Using anything ---- */
  use(el) {
    const kind = el.dataset.kind, id = el.dataset.id;
    /* A summoning spell has questions to ask first, and asking them is
       free — nothing is spent until its own Summon button. */
    if (kind === "spell" && SPELLS[id] && SPELLS[id].summons) {
      ACT.summonModal({ dataset: { spell: SPELLS[id].summons } });
      return;
    }
    const item = CALC.castables(S).filter(function (x) {
      return x.kind === kind && x.id === id;
    })[0];
    if (!item) return;
    if (!item.affordable && S.settings.economyLockout && S.settings.confirmOverride) {
      UI.modal = { type: "override", name: item.name, reasons: item.reasons, pending: { kind: kind, id: id } };
      render(); return;
    }
    doUse(item);
  },
  useConfirm() {
    const p = UI.modal.pending;
    const item = CALC.castables(S).filter(function (x) {
      return x.kind === p.kind && x.id === p.id;
    })[0];
    UI.modal = null;
    if (item) doUse(item, true);
  },

  /* ---- Effects ---- */
  effectEnd(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const e = st.effects[i];
      if (e && e.conc) { st.toggles.concentrating = false; st.toggles.concentratingOn = ""; }
      st.effects.splice(i, 1);
    }, "End effect");
  },

  /* ---- Party roster ---- */
  partyAdd() {
    mutate(function (st) {
      st.party.roster.push({ id: newId("m"), name: "Party member " + (st.party.roster.length + 1),
        present: true, status: "healthy" });
    }, "Add party member");
  },
  partyStatus(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const m = st.party.roster[i];
      const cur = PARTY_STATUS.indexOf(m.status || "healthy");
      m.status = PARTY_STATUS[(cur + 1) % PARTY_STATUS.length];
    }, "Party status");
  },
  partyDel(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const removed = st.party.roster[i];
      st.party.roster.splice(i, 1);
      if (removed) {
        const oid = "p:" + removed.id;
        st.combat.order = st.combat.order.filter(function (o) { return o.id !== oid; });
      }
    }, "Remove party member");
  },
  partyName(el) {
    const i = parseInt(el.dataset.i, 10), v = el.value;
    mutate(function (st) { st.party.roster[i].name = v; });
  },
  partyPresent(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const m = st.party.roster[i];
      m.present = !m.present;
      if (!m.present) {
        const oid = "p:" + m.id;
        st.combat.order = st.combat.order.filter(function (o) { return o.id !== oid; });
      }
    }, "Toggle present");
  },

  /* ---- Turn order ---- */
  /* Mid-fight edits go through the same sheet, seeded from the order
     that is actually running so the numbers you already typed are
     there to correct rather than to retype. */
  orderModal() {
    UI.modal = { type: "initiative", editing: true, rows: rowsFromOrder() };
    render();
  },
  /* ---- Picking a face ----
     One opener and one setter, told apart by what they were opened
     against. A roster member's face is written to the sheet; a row of the
     initiative sheet's is written to the row, and only reaches the sheet
     if that fight is actually started. */
  tokenModal(el) {
    const kind = el.dataset.kind;
    let current = null, who = "", back = null, band = null;
    if (kind === "party") {
      const m = (S.party.roster || []).filter(function (x) { return x.id === el.dataset.id; })[0];
      current = m ? m.token : null;
      who = m ? m.name : "";
    } else if (kind === "person") {
      const pr = personById(el.dataset.id);
      current = pr ? pr.token : null;
      who = pr ? pr.name : "";
    } else if (kind === "follower") {
      const fo = S.followers.filter(function (x) { return x.id === el.dataset.id; })[0];
      current = fo ? fo.token : null;
      who = fo ? fo.name : "";
      /* A steed wants the Beasts band and a familiar wants Familiars —
         opening on the right one saves scrolling past four hundred
         goblins to find a horse. */
      band = fo ? (fo.source === "findFamiliar" ? "familiar"
                 : (COMPANION_ROLES[fo.role] || {}).mount ? "mount" : "summon") : null;
    } else {
      /* Opening a second modal would throw away the initiative sheet, so
         its rows ride along and are put back on the way out. */
      const r = UI.modal.rows[parseInt(el.dataset.i, 10)];
      current = r ? r.token : null;
      who = r ? (r.name || "this line") : "";
      back = { type: "initiative", editing: UI.modal.editing, rows: UI.modal.rows };
    }
    UI.modal = { type: "token", target: { kind: kind, id: el.dataset.id, i: el.dataset.i },
                 current: current, who: who, q: "", band: band, back: back };
    render();
  },
  tokenSearch(el) { UI.modal.q = el.value; render(); },
  tokenSearchClear() { UI.modal.q = ""; render(); },
  tokenSet(el) {
    const raw = el.dataset.i;
    const v = raw === "" ? null : validToken(parseInt(raw, 10));
    const t = UI.modal.target, back = UI.modal.back;
    if (t.kind === "party" || t.kind === "person" || t.kind === "follower") {
      mutate(function (st) {
        const list = t.kind === "party" ? st.party.roster
                   : t.kind === "person" ? st.people : st.followers;
        const rec = list.filter(function (x) { return x.id === t.id; })[0];
        if (rec) rec.token = v;
      }, "Set a face");
      UI.modal = null;
    } else {
      back.rows[parseInt(t.i, 10)].token = v;
      UI.modal = back;
    }
    render();
  },

  /* ---- The favourites use window ----
     Opening it is free and spends nothing; every button inside goes
     through the same doUse() the rest of the app does. */
  favUse(el) {
    UI.modal = { type: "favUse", kind: el.dataset.kind, id: el.dataset.id };
    render();
  },
  favUnpin(el) {
    UI.modal = null;
    ACT.favToggle(el);
  },
  /* "how" is which price you chose. `rawCost` is what the thing costs
     before any free cast is applied, and it rides on the castable entry
     already, so paying deliberately is a substitution rather than a
     second cost calculation that could drift from the first. */
  favCast(el) {
    const m = UI.modal;
    const r = favResolve({ kind: m.kind, id: m.id }, CALC.castables(S));
    if (!r || !r.c) return;
    const how = el.dataset.how;
    const item = how === "paid"
      ? Object.assign({}, r.c, { cost: r.c.rawCost || r.c.cost, free: false })
      : r.c;
    UI.modal = null;
    doUse(item, true);
  },
  favItem(el) {
    const m = UI.modal;
    const d = parseInt(el.dataset.d, 10);
    const box = document.getElementById("fav-qty");
    const n = Math.max(1, parseInt(box ? box.value : "1", 10) || 1);
    const id = m.id;
    const it = S.equipment.inventory.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    const delta = d > 0 ? n : -Math.min(n, it.qty);
    if (!delta) return;
    mutate(function (st) {
      const x = st.equipment.inventory.filter(function (y) { return y.id === id; })[0];
      if (x) x.qty = Math.max(0, x.qty + delta);
    }, (delta > 0 ? "Gained " : "Used ") + Math.abs(delta) + " × " + it.name);
    render();
  },

  /* ---- Rolling initiative ----
     All of these edit the modal's own rows. Only initCommit touches the
     sheet, which is what makes Cancel mean cancel. */
  initName(el) { UI.modal.rows[parseInt(el.dataset.i, 10)].name = el.value; },
  initValue(el) {
    const v = el.value === "" ? null : parseInt(el.value, 10);
    UI.modal.rows[parseInt(el.dataset.i, 10)].init = (v == null || isNaN(v)) ? null : v;
    /* Re-render, because the tie arrows only exist between rows that
       actually tied and cannot know that until the number is in. Safe to
       do here: these commit on change rather than on every keystroke, so
       the field has already been left by the time this runs. */
    render();
  },
  initDrop(el) { UI.modal.rows.splice(parseInt(el.dataset.i, 10), 1); render(); },
  /* Swapping two rows that rolled the same. The sort on commit is stable,
     so the order they are left in here is the order they act in. */
  initMove(el) {
    const i = parseInt(el.dataset.i, 10), d = parseInt(el.dataset.d, 10);
    const rows = UI.modal.rows, j = i + d;
    if (j < 0 || j >= rows.length) return;
    const tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
    render();
  },
  initAddFoe() {
    UI.modal.rows.push({ key: newId("f:"), kind: "foe", name: "", init: null, token: null });
    render();
  },
  initAddHal() {
    UI.modal.rows.unshift({ key: "hal", kind: "hal", name: S.identity.name || "Hal",
                            init: null, token: null });
    render();
  },
  initAddParty() {
    const have = {};
    UI.modal.rows.forEach(function (r) { have[r.key] = true; });
    (S.party.roster || []).filter(function (m) { return m.present; }).forEach(function (m) {
      if (!have["p:" + m.id]) {
        UI.modal.rows.push({ key: "p:" + m.id, kind: "party", name: m.name,
                             init: null, token: m.token });
      }
    });
    render();
  },
  /* The one write. Sorts by the roll, highest first; a blank goes to the
     back, because "we never got their number" is not "they went first".
     Ties keep the order they were typed in, which is the order you heard
     them called out. */
  initCommit() {
    const rows = UI.modal.rows.filter(function (r) {
      return r.kind !== "foe" || r.name.trim() !== "";
    });
    if (!rows.length) { UI.modal.err = true; render(); return; }
    const sorted = rows.slice().sort(function (a, b) {
      const av = a.init == null ? -Infinity : a.init;
      const bv = b.init == null ? -Infinity : b.init;
      return bv - av;
    });
    const order = sorted.map(function (r) {
      return { id: r.key, initiative: r.init,
               ref: refFor(r.key, r.kind, r.name.trim(), r.token) };
    });
    const editing = !!UI.modal.editing;
    mutate(function (st) {
      st.combat.order = order;
      /* Mid-fight, whoever's turn it is keeps it if they're still in the
         order; otherwise — and always at the start of a fight — the top
         of the order is up. */
      const keep = editing && order.some(function (o) { return o.id === st.combat.currentId; });
      if (!keep) st.combat.currentId = order.length ? order[0].id : null;
      if (!editing) {
        st.combat.active = true;
        st.combat.round = 1;
        st.combat.turn = CALC.freshTurn();
      }
    }, editing ? "Update turn order" : "Roll initiative");
    UI.modal = null;
    render();
  },

  /* ---- Attack roll (the primary weapon click, in or out of combat) ---- */
  attackRoll(el) {
    const id = el.dataset.id;
    /* Attacking commits your Action the first time this turn — further
       swings this turn (Extra Attack, Nick) are already covered by it,
       so this only fires once and never blocks a second weapon click. */
    if (S.combat.active && !S.combat.turn.action) {
      mutate(function (st) { st.combat.turn.action = true; }, "Attack action");
    }
    UI.modal = { type: "attack", id: id, result: null, vuln: "normal", landed: null };
    render();
  },
  attackCheck() {
    const d20 = parseInt(document.getElementById("atk-d20").value, 10);
    if (!d20 || d20 < 1 || d20 > 20) {
      UI.modal.result = { total: 0, crit: false, note: "Enter your d20 result, 1 through 20." };
      render(); return;
    }
    const a = CALC.attackAction(S);
    const row = a.rows.filter(function (r) { return r.id === UI.modal.id; })[0];
    const total = d20 + row.toHit;
    /* Natural 1 and 20 still mean something without an AC to compare
       against — one cannot land whatever the total says, the other
       always does and doubles the dice. */
    const note = d20 === 1 ? "Natural 1 — an automatic miss"
      : d20 === 20 ? "Natural 20 — an automatic hit"
      : d20 + " on the die " + sign(row.toHit);
    UI.modal.result = { total: total, crit: d20 === 20, note: note };
    if (d20 === 1) UI.modal.landed = false;
    if (d20 === 20) { UI.modal.landed = true; ACT.attackLanded({ dataset: { v: "1" } }); return; }
    render();
  },
  /* The DM answers this, not the sheet. It matters because a landed hit
     is what makes a smite available, and Vex arms off it too. */
  attackLanded(el) {
    const hit = el.dataset.v === "1";
    UI.modal.landed = hit;
    if (hit && !S.combat.turn.hitLanded) {
      mutate(function (st) { st.combat.turn.hitLanded = true; }, "Hit landed");
    }
    if (hit && S.settings.rollPrompts) {
      const smites = CALC.castables(S).filter(function (x) { return x.afterHit && x.affordable; });
      if (smites.length) {
        UI.alert = { info: "Hit landed. Smites available: " +
          smites.map(function (x) { return x.name; }).join(", ") + " — Bonus Action, after the hit." };
      }
    }
    render();
  },
  attackVuln(el) {
    UI.modal.vuln = el.dataset.v;
    render();
  },

  /* ---- Lay on Hands ---- */
  lohModal() { UI.modal = { type: "loh" }; render(); },
  lohSpendSelf() {
    const n = parseInt(document.getElementById("loh-amt").value, 10) || 0;
    mutate(function (st) {
      const spend = Math.min(n, st.resources.layOnHands);
      st.resources.layOnHands -= spend;
      st.currentHP = Math.min(CALC.maxHP(st).value, st.currentHP + spend);
      if (st.combat.active) st.combat.turn.bonus = true;
      if (st.currentHP > 0) {
        const k = st.conditions.indexOf("unconscious");
        if (k >= 0) st.conditions.splice(k, 1);
      }
    }, "Lay on Hands (self)");
    UI.modal = null; render();
  },
  lohSpendOther() {
    const n = parseInt(document.getElementById("loh-amt").value, 10) || 0;
    mutate(function (st) {
      st.resources.layOnHands = Math.max(0, st.resources.layOnHands - n);
      if (st.combat.active) st.combat.turn.bonus = true;
    }, "Lay on Hands (ally)");
    UI.modal = null;
    UI.alert = { info: "Spent " + n + " HP from the pool on an ally." };
    render();
  },

  /* ---- Settings ---- */
  settingsModal() {
    UI.modal = { type: "settings" };
    /* Re-ask rather than trust what was true at page load — the worker
       can be replaced under a page that has been open a while. */
    if (typeof window.askSWVersion === "function") window.askSWVersion();
    render();
  },
  setting(el) {
    const k = el.dataset.key;
    mutate(function (st) { st.settings[k] = !st.settings[k]; });
  },
  /* Minutes, or 0 for "don't ask." A preset row rather than a free-typed
     number — the choice is really "often, occasionally, or never", and
     a slider or a text box would spend a tap dialing in a number nobody
     actually needed to be exact. */
  setNoteReminder(el) {
    const min = parseInt(el.dataset.min, 10) || 0;
    mutate(function (st) { st.settings.noteReminderMinutes = min; });
  },

  /* ---- Session log ---- */
  sessionModal() { UI.modal = { type: "session" }; render(); },
  preSessionModal() { UI.modal = { type: "preSession" }; render(); },
  /* Carries `from` so the rest's result modal can hand you back to the
     checklist instead of dead-ending mid-setup. */
  preSessionRest() { UI.modal = { type: "restDays", from: "preSession" }; render(); },
  sessionStart() {
    mutate(function (st) {
      st.session.active = true;
      st.session.startedAt = Date.now();
      st.session.log = [];
      st.session.stats = { highestDCSet: null };
      /* Snapshotted now rather than read live at export time — Present
         is a toggle on the roster and keeps changing after this, so
         "who was at this session" has to be pinned to the moment it
         actually started or a note exported weeks later would credit
         the session with whoever happens to be marked Present today. */
      st.session.party = (st.party.roster || [])
        .filter(function (m) { return m.present; })
        .map(function (m) { return m.name; });
    }, "Start session");
    UI.modal = null;
    render();
  },
  sessionEnd() {
    const endedAt = Date.now();
    mutate(function (st) {
      /* The archived copy gets an explicit closing line — "Start session"
         is already the log's first entry (mutate() logged itself when
         the session began), so this makes the recap read start-to-finish
         instead of trailing off after the last thing that happened. */
      const log = st.session.log.concat([{ t: endedAt, label: "End session" }]);
      const entry = {
        startedAt: st.session.startedAt, endedAt: endedAt,
        log: log, stats: Object.assign({}, st.session.stats),
        party: (st.session.party || []).slice()
      };
      st.sessionHistory.push(entry);
      if (st.sessionHistory.length > 30) st.sessionHistory.shift();
      st.session.active = false;
      st.session.startedAt = null;
      st.session.log = [];
      st.session.stats = { highestDCSet: null };
      st.session.party = [];
    }, "End session");
    UI.modal = { type: "session" };
    render();
  },
  /* Share sheet first, download second. On an iPad a download lands in
     Files and is then your problem; the share sheet can put it straight
     into Mail, Notes, or another device, which is what "read it on the
     PC" actually needs. Same approach as the backup export. */
  sessionExport(el) {
    const which = (el && el.dataset.which) || "last";
    const md = sessionMarkdownFor(which);
    if (!md) return;
    const stamp = which === "all"
      ? new Date().toISOString().slice(0, 10) + "-all"
      : new Date((sessionFor(which) || {}).startedAt || Date.now()).toISOString().slice(0, 10);
    const filename = "hal-session-" + stamp + ".md";
    const blob = new Blob([md], { type: "text/markdown" });

    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: "text/markdown" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Hal — session notes" })
          .catch(function () { /* cancelled */ });
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  /* The most portable option of the lot: no file, no share sheet, just
     the text where anything can paste it. */
  sessionCopy(el) {
    const which = (el && el.dataset.which) || "last";
    const md = sessionMarkdownFor(which);
    if (!md) return;
    const done = function (ok) {
      UI.alert = { info: ok
        ? "Session notes copied — paste them anywhere."
        : "Couldn't reach the clipboard. Use Share instead." };
      render();
    };
    /* Older WebKit, and the retry when the modern call is refused: a
       selected off-screen textarea and execCommand. */
    const legacyCopy = function () {
      try {
        const ta = document.createElement("textarea");
        ta.value = md;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        return !!ok;
      } catch (e) {
        return false;
      }
    };
    /* The modern call can be refused for reasons that have nothing to do
       with support — an unfocused document, a permissions policy — so a
       rejection falls through to the old way rather than giving up. */
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(function () { done(true); },
                                            function () { done(legacyCopy()); });
      return;
    }
    done(legacyCopy());
  },
  /* ---- Writing something down ----
     One composer. Opened from the nudge, or from the session log — in
     which case it remembers to go back there, so writing a note doesn't
     close the thing you were reading. */
  noteModal() {
    const back = UI.modal && UI.modal.type === "session" ? { type: "session" } : null;
    UI.modal = { type: "note", kind: "met", f: {}, toPeople: false, back: back };
    render();
  },
  noteKind(el) {
    /* The boxes change, so what was typed into the old ones is dropped
       rather than silently carried into fields that no longer mean the
       same thing. */
    UI.modal.kind = el.dataset.k;
    UI.modal.f = {};
    render();
  },
  noteField(el) { UI.modal.f[el.dataset.f] = el.value; render(); },
  noteToPeople() { UI.modal.toPeople = !UI.modal.toPeople; render(); },
  noteSave() {
    const m = UI.modal;
    const kind = noteKindOf(m.kind);
    const line = noteCompose(kind, m.f);
    if (!line) return;
    const toPeople = m.kind === "met" && m.toPeople && (m.f.who || "").trim();
    const pid = uid("p");
    mutate(function (st) {
      /* Unlabelled on purpose. A labelled mutate writes its own line into
         the session log, and the note IS the line — labelling it would
         file the same sentence twice, once tagged as a note and once as
         bookkeeping. */
      st.session.log.push({ t: Date.now(), label: line, kind: "note", cal: calStamp(st) });
      if (st.session.log.length > 500) st.session.log.shift();
      /* The one place a note is worth more than a line of text: you have
         just typed a name, a place and what they wanted, which is a
         People record already. */
      if (toPeople) {
        const fields = [];
        if ((m.f.where || "").trim()) fields.push({ k: "Where", v: m.f.where.trim() });
        if ((m.f.want || "").trim()) fields.push({ k: "Wants", v: m.f.want.trim() });
        st.people.push({ id: pid, kind: "person", name: m.f.who.trim(),
                         standing: "unknown", status: "alive", token: null,
                         fields: fields, groups: [], note: "" });
      }
    });
    UI.modal = m.back;
    if (toPeople) UI.alert = { info: "Noted, and " + m.f.who.trim() + " is on the People tab." };
    render();
  },

  /* ---- Undo ---- */
  /* The escape hatch for when the offline copy is stubborn: throw away
     every cache, drop the worker, and reload from the network. Nothing
     of the sheet lives in there — the character is in localStorage. */
  forceUpdate() {
    UI.modal = null;
    render();
    UI.alert = { info: "Fetching a fresh copy…" };
    render();
    const done = function () { location.reload(); };
    if (!("caches" in window)) { done(); return; }
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () {
        if (!navigator.serviceWorker) return null;
        return navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        });
      })
      .then(done, done);
  },

  /* Back out of the cast you just made: the slot, the action, the
     concentration and any effect all go back where they were. */
  cancelCast() {
    UI.modal = null;
    ACT.undo();
  },
  undo() {
    const h = histLoad();
    if (!h.length) { UI.alert = { info: "Nothing to undo." }; render(); return; }
    const last = h.pop();
    histSave(h);
    S = migrate(last.state);
    clampState(S); save();
    UI.alert = { info: "Undid: " + last.label };
    render();
  },
  historyModal() { UI.modal = { type: "history" }; render(); }
});

/* The actual use/cast resolution */
function doUse(item, overridden) {
  const rolls = [];
  /* Which concentration effect (if any) this cast will displace */
  const dropped = (item.effect && item.effect.conc)
    ? S.effects.filter(function (e) { return e.conc; }).map(function (e) { return e.name; })
    : [];

  mutate(function (st) {
    /* Pay the costs */
    if (st.combat.active) {
      if (item.cost.type === "action") st.combat.turn.action = true;
      if (item.cost.type === "bonus") st.combat.turn.bonus = true;
      if (item.cost.type === "reaction") st.combat.turn.reaction = true;
      if (item.cost.slot) st.combat.turn.slotUsed = true;
    }
    if (item.cost.slot) {
      const lv = item.cost.slot;
      if (!st.resources.slots[lv]) st.resources.slots[lv] = { used: 0 };
      st.resources.slots[lv].used += 1;
    }
    if (item.cost.res && item.id !== "layOnHands") {
      st.resources[item.cost.res] = Math.max(0, (st.resources[item.cost.res] || 0) - 1);
    }

    /* Concentration: a new concentration effect drops the old one */
    if (item.effect && item.effect.conc) {
      st.effects = st.effects.filter(function (e) { return !e.conc; });
      st.toggles.concentrating = true;
      st.toggles.concentratingOn = item.effect.name;
    }
    /* Add the effect */
    if (item.effect) {
      st.effects.push({
        key: item.id, name: item.effect.name, conc: !!item.effect.conc,
        rounds: item.effect.rounds == null ? null : item.effect.rounds,
        mods: item.effect.mods || null, note: item.effect.note || ""
      });
    }
    /* Something you just landed on someone else. It used to become a
       condition on a tracked creature; with the roster gone it becomes
       what it always really was — a line in the notebook of what is
       running on whom, which you fill in with the name once the DM says
       who failed. */
    if (item.applyToTarget) {
      const dc = CALC.spellSaveDC(st).value;
      st.watch.push({ id: uid("w"), who: "", what: item.name, kind: "effect",
        outcome: item.applyToTarget.label + " — repeats a " +
          ABILITY_NAMES[item.applyToTarget.save] + " save vs DC " + dc +
          (item.applyToTarget.repeat === "endOfTurn" ? " at the end of each of its turns" : " as an action"),
        left: null, unit: "rounds", note: "" });
    }
  }, (item.kind === "spell" ? "Cast " : "Use ") + item.name);

  /* Build the roll prompts */
  if (S.settings.rollPrompts && item.rolls) {
    const dc = CALC.spellSaveDC(S).value;
    let sawSave = false;
    item.rolls.forEach(function (r) {
      let text;
      if (r.save) {
        text = "DC " + dc + " " + ABILITY_NAMES[r.save] + " saving throw";
        sawSave = true;
      } else {
        text = r.dice + (r.mod === "cha" ? " + " + abilityDie(S, "cha") + " (Charisma)" : "");
      }
      rolls.push({ who: r.who, text: text, why: r.why + (r.label ? " — " + r.label : "") });
    });
    /* Session stat, same reasoning as the AC one above: pure bookkeeping,
       bypasses the wrapper so it doesn't clutter undo history or the log. */
    if (sawSave && S.session.active) {
      _mutate(function (st) {
        if (st.session.stats.highestDCSet == null || dc > st.session.stats.highestDCSet) {
          st.session.stats.highestDCSet = dc;
        }
      });
    }
  }

  if (rolls.length) {
    UI.modal = { type: "roll", title: item.name, rolls: rolls,
      why: (dropped && dropped.length ? "Concentration dropped: " + dropped.join(", ") + ". " : "") +
        costLabel(item.cost) + (item.free ? " · cast free, no slot spent" : "") };
  } else {
    UI.modal = null;
    UI.alert = { info: (item.kind === "spell" ? "Cast " : "Used ") + item.name + " · " +
      costLabel(item.cost) + (item.free ? " (free cast)" : "") +
      (dropped && dropped.length ? " · dropped " + dropped.join(", ") : "") };
  }
  render();
}

/* ---------- HOOK INTO THE BASE RENDER ----------------------- */
const _render = render;
render = function () {
  _render();
  const app = document.getElementById("app");

  /* Modals owned by this module — done first, right after the base render,
     so a later throw in the glow/bar/panel steps below can never leave a
     half-open modal shell on screen with no content and no way to close it. */
  const root = document.getElementById("modal-root");
  if (UI.modal && ["roll", "override", "settings", "loh", "history", "attack", "initiative", "favUse", "token", "note", "mount", "session", "preSession"].indexOf(UI.modal.type) >= 0) {
    let body = "";
    if (UI.modal.type === "roll") body = EXT.rollModal();
    else if (UI.modal.type === "override") body = EXT.overrideModal();
    else if (UI.modal.type === "settings") body = EXT.settingsModal();
    else if (UI.modal.type === "loh") body = EXT.lohModal();
    else if (UI.modal.type === "attack") body = EXT.attackModal();
    else if (UI.modal.type === "initiative") body = EXT.initiativeModal();
    else if (UI.modal.type === "favUse") body = EXT.favUseModal();
    else if (UI.modal.type === "token") body = EXT.tokenModal();
    else if (UI.modal.type === "note") body = EXT.noteModal();
    else if (UI.modal.type === "mount") body = EXT.mountModal();
    else if (UI.modal.type === "session") body = EXT.sessionModal();
    else if (UI.modal.type === "preSession") body = EXT.preSessionModal();
    else if (UI.modal.type === "history") {
      const h = histLoad().slice().reverse();
      body = "<h2>Recent changes</h2><div class=\"msub\">Most recent first. Undo steps back one at a time.</div>";
      h.forEach(function (x) {
        body += '<div class="gain k-level"><span class="gk">' +
          new Date(x.at).toLocaleTimeString() + "</span><span>" + esc(x.label) + "</span></div>";
      });
      if (!h.length) body += '<div class="foot">No history yet.</div>';
      body += '<div class="mfoot"><button class="bt cutsm dg" data-act="undo">Undo last</button>' +
        '<button class="bt cutsm" data-act="closeModal">Close</button></div>';
    }
    paintModal(maskWrap(body));
  }

  /* Glow overlay */
  const oldGlow = document.getElementById("glow-root");
  if (oldGlow) oldGlow.remove();
  const g = EXT.glow();
  if (g) {
    const d = document.createElement("div");
    d.id = "glow-root";
    d.innerHTML = g;
    document.body.appendChild(d);
  }

  /* Combat bar goes directly under the top bar */
  const bar = app.querySelector(".bar");
  if (bar) bar.insertAdjacentHTML("afterend", EXT.combatBar() + EXT.sessionNudge());

  /* Extra panels into the centre column of the Combat tab */
  const tab = (S.ui && S.ui.tab) || "combat";
  if (tab === "combat") {
    const centre = app.querySelector(".wrap > div:nth-child(2)");
    if (centre) {
      centre.insertAdjacentHTML("afterbegin", EXT.canDoPanel() + EXT.effectsPanel());
      centre.insertAdjacentHTML("beforeend",
        EXT.followersPanel() + EXT.partyPanel());
    }
  } else {
    const centre = app.querySelector(".wrap > div:nth-child(2)");
    if (centre && S.effects.length) centre.insertAdjacentHTML("afterbegin", EXT.effectsPanel());
  }

  /* Undo + session + settings at the end of the top bar.
     Undo is a mid-turn control and stays first-class. Settings is a
     once-a-month visit and lives behind More. Session sits between the
     two: hidden while idle, but promoted to the bar the moment one is
     running, because a recording session you can't see is a session you
     forget to stop. */
  if (bar) {
    const moreOpen = !!UI.expanded.moreActions;
    let extra = '<button class="bt cutsm" data-act="undo">Undo</button>';
    if (S.session.active || moreOpen) {
      extra += '<button class="bt cutsm' + (S.session.active ? " pri" : "") + '" data-act="sessionModal">' +
        (S.session.active ? "Session ●" : "Session") + "</button>";
    }
    if (moreOpen) extra += '<button class="bt cutsm" data-act="settingsModal">Settings</button>';
    bar.insertAdjacentHTML("beforeend", extra);
  }

  /* Panels injected above didn't exist when the base render folded
     things, so fold again now that the DOM is final. */
  applyPanelFolds();
  /* Same reason, one step later: neither row can be measured until it is
     in the document. The bar goes first — the order strip sits inside it,
     so shrinking the controls changes how much room is left. */
  fitCombatBar();
  fitOrderStrip();
};

/* Re-render once combat.js has patched everything */
render();
