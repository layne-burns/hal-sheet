/* ============================================================
   COMBAT UI — turn tracker, casting, effects, creatures, party,
   turn order, undo, roll prompts, settings. Extends app.js.
   Loaded AFTER app.js; merges into ACT and exposes EXT.
   ============================================================ */

const EXT = {};

/* ---------- ID / REF HELPERS --------------------------------- */
let _idSeq = 0;
function newId(prefix) { _idSeq += 1; return prefix + Date.now() + "_" + _idSeq; }
/* Turn-order entries use composite ids so Hal/party/creatures can't
   collide: "hal", "p:<partyId>", "c:<creatureId>". */
function refFor(id, kind) {
  if (kind === "hal") return { type: "hal" };
  if (kind === "party") return { type: "party", partyId: id.slice(2) };
  if (kind === "creature") return { type: "creature", creatureId: id.slice(2) };
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

/* ---------- COMBAT BAR -------------------------------------- */
EXT.combatBar = function () {
  const c = S.combat;
  const orderBtn = '<button class="bt cutsm" data-act="orderModal">' +
    (c.order.length ? "Turn order (" + c.order.length + ")" : "Set turn order") + "</button>";
  if (!c.active) {
    return '<div class="strip cut"><span class="lbl">Out of combat</span>' +
      '<button class="bt cutsm pri" data-act="combatStart">Enter combat</button>' +
      orderBtn +
      (S.effects.length ? '<span class="lbl" style="margin-left:auto">' + S.effects.length +
        " active effect(s) — durations pause outside combat</span>" : "") + "</div>";
  }
  const t = c.turn;
  const slotNote = t.slotUsed ? "used" : "open";
  function pip(used, label, key) {
    return '<button class="ecopip' + (used ? " used" : "") + '" data-act="econToggle" data-key="' + key + '">' +
      '<span class="ecoi">' + (used ? "spent" : "open") + "</span>" + label + "</button>";
  }
  const cur = CALC.currentCombatant(S);
  const turnLabel = c.order.length ?
    (cur ? esc(CALC.combatantName(S, cur.ref)) + "'s turn" : "Turn order set") : "";
  return '<div class="strip combat cut">' +
    '<span class="rnd">Round ' + c.round + "</span>" +
    (turnLabel ? '<span class="lbl">' + turnLabel + "</span>" : "") +
    orderBtn +
    pip(t.action, "Action", "action") +
    pip(t.bonus, "Bonus", "bonus") +
    pip(t.reaction, "Reaction", "reaction") +
    '<span class="ecopip' + (t.slotUsed ? " used" : "") + '"><span class="ecoi">' + slotNote +
      "</span>Spell slot</span>" +
    '<span class="mv"><span class="lbl">Move</span> ' + (S.identity.speed - t.movementUsed) +
      "/" + S.identity.speed + " ft" +
      '<button class="bt cutsm" data-act="move" data-d="5">−5</button>' +
      '<button class="bt cutsm" data-act="move" data-d="-5">+5</button></span>' +
    (t.hitLanded ? '<span class="hitflag">Hit landed — smites available</span>'
                 : '<button class="bt cutsm" data-act="logHit">Log a hit</button>') +
    '<button class="bt cutsm pri" style="margin-left:auto" data-act="endTurn">' +
      (c.order.length ? "Next turn" : "End turn") + "</button>" +
    '<button class="bt cutsm" data-act="combatEnd">Exit combat</button>' +
    "</div>";
};

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

EXT.effectsPanel = function () {
  if (!S.effects.length) return "";
  const head = panelHead("Active effects", S.effects.length, "effectsCollapsed");
  if (head.collapsed) return head.html + "</div>";
  const mods = CALC.activeMods(S);
  let out = head.html;
  S.effects.forEach(function (e, i) {
    const perm = e.rounds == null;
    out += '<div class="eff' + (e.conc ? " conc" : "") + '">' +
      '<div class="eh"><span class="en">' + esc(e.name) + "</span>" +
      (e.conc ? '<span class="tag t-y1">Concentration</span>' : "") +
      '<span class="emeta">' + (perm ? "until removed" :
        (e.rounds > 100 ? Math.round(e.rounds / 10) + " min" : e.rounds + " rounds")) + "</span>" +
      '<button class="bt cutsm dg" data-act="effectEnd" data-i="' + i + '">End</button></div>' +
      (e.note ? '<div class="etext">' + esc(e.note) + "</div>" : "") + "</div>";
  });
  const applied = [];
  if (mods.ac) applied.push((mods.ac > 0 ? "+" : "") + mods.ac + " AC");
  if (mods.attackFlat) applied.push("+" + mods.attackFlat + " attack");
  mods.attackDice.forEach(function (d) { applied.push(d.die + " to attacks (" + d.from + ")"); });
  mods.saveDice.forEach(function (d) { applied.push(d.die + " to saves (" + d.from + ")"); });
  mods.damageDice.forEach(function (d) { applied.push(d.die + " damage (" + d.from + ")"); });
  if (applied.length && S.settings.autoApplyEffects) {
    out += '<div class="seqnote">Applied to your numbers: <b>' + esc(applied.join(" · ")) + "</b></div>";
  }
  return out + "</div>";
};

/* ---------- CREATURE TRACKER --------------------------------- */
EXT.creaturesPanel = function () {
  if (!S.settings.creatureTracker) return "";
  const head = panelHead("Creatures", S.creatures.length || "none", "creaturesCollapsed");
  if (head.collapsed) return head.html + "</div>";
  let out = head.html;
  if (!S.creatures.length) {
    out += '<div class="foot" style="margin:0 0 8px">Add who you\'re fighting to track AC, hits, and repeating saves.</div>';
  }
  S.creatures.forEach(function (c, i) {
    out += '<div class="tgt' + (c.hit ? " hit" : "") + '"><div class="eh">' +
      '<input class="rowname" value="' + esc(c.name) + '" data-act="creatureName" data-i="' + i + '">' +
      '<input class="acinput" type="number" min="1" placeholder="AC" value="' + (c.ac == null ? "" : c.ac) +
      '" data-act="creatureAC" data-i="' + i + '">' +
      '<button class="bt cutsm' + (c.hit ? " pri" : "") + '" data-act="creatureHit" data-i="' + i + '">' +
      (c.hit ? "Hit" : "No hit yet") + "</button>" +
      (c.vex ? '<span class="tag t-c1">Vex armed</span>' : "") +
      '<button class="bt cutsm dg" data-act="creatureDel" data-i="' + i + '">Clear</button></div>';
    (c.conditions || []).forEach(function (cond, j) {
      out += '<div class="tcond"><span class="tag t-m3">' + esc(cond.label) + "</span>" +
        '<span class="emeta">repeats a ' + esc(ABILITY_NAMES[cond.save]) + " save vs DC " + cond.dc +
        (cond.repeat === "endOfTurn" ? " at the end of each of its turns" : " as an action") + "</span>" +
        '<button class="bt cutsm" data-act="creatureCondClear" data-i="' + i + '" data-j="' + j +
        '">Broke free</button></div>';
    });
    out += "</div>";
  });
  out += '<div class="mrow"><button class="bt cutsm" data-act="creatureAdd">+ Add creature</button></div>';
  if (S.combat.active && S.creatures.some(function (c) {
    return (c.conditions || []).some(function (cond) { return cond.repeat === "endOfTurn"; });
  })) {
    out += '<div class="seqnote">At the end of each creature\'s turn, it repeats its save. Tap <b>Broke free</b> when one succeeds.</div>';
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

/* ---------- WHAT CAN I DO NOW ------------------------------- */
EXT.canDoPanel = function () {
  const list = CALC.castables(S).filter(function (x) {
    if (x.afterHit && S.combat.active && !S.combat.turn.hitLanded) return false;
    return x.affordable;
  });
  let out = '<div class="pnl cut"><h3>What you can do now <span class="cnt">' + list.length + "</span></h3>";
  if (S.combat.active) {
    const t = S.combat.turn;
    out += '<div class="foot" style="margin:0 0 8px">' +
      (t.action ? "Action spent · " : "Action open · ") +
      (t.bonus ? "Bonus spent · " : "Bonus open · ") +
      (t.slotUsed ? "slot spent this turn" : "slot available") + "</div>";
  }
  list.forEach(function (x) {
    out += '<div class="doable"><div class="eh">' +
      '<button class="namebtn en" data-act="use" data-kind="' + x.kind + '" data-id="' + x.id + '">' +
      esc(x.name) + "</button>" + wikiBtn(x.slug) +
      '<span class="emeta">' + esc(costLabel(x.cost)) + (x.free ? " · free cast" : "") + "</span>" +
      '<button class="bt cutsm pri" data-act="use" data-kind="' + x.kind + '" data-id="' + x.id +
      '">' + (x.kind === "spell" ? "Cast" : "Use") + "</button></div>" +
      "<div>" + tagHTML(tagsOf((x.kind === "spell" ? "spell:" : "action:") + x.id, x.tags), false) + "</div>" +
      "</div>";
  });
  const hidden = CALC.castables(S).length - list.length;
  if (hidden > 0) out += '<div class="foot">' + hidden + " option(s) hidden — not affordable right now</div>";
  return out + "</div>";
};

/* ---------- SETTINGS ---------------------------------------- */
EXT.settingsModal = function () {
  const rows = [
    ["rollPrompts", "Roll prompts", "After you cast or attack, pop a card telling you what to roll and why."],
    ["autoApplyEffects", "Auto-apply effects", "Active effects change your displayed AC and attack numbers."],
    ["economyLockout", "Grey out unaffordable", "In combat, dim what you can't pay for. You can still override."],
    ["confirmOverride", "Warn on override", "Ask before spending action economy you've already used."],
    ["edgeGlow", "Screen edge glow", "Cyan rim while concentrating, red rim below 20% HP."],
    ["creatureTracker", "Creature tracker", "Track creatures you've affected and their repeating saves."]
  ];
  const scale = (S.settings && S.settings.uiScale) || 100;
  let body = "<h2>Settings</h2><div class=\"msub\">All of these are stored with your sheet.</div>";
  body += '<div class="mrow"><span class="lbl">Display size</span>' +
    '<button class="bt cutsm" data-act="scaleUI" data-dir="-1">A−</button>' +
    '<button class="bt cutsm" data-act="scaleUI" data-dir="1">A+</button>' +
    '<button class="bt cutsm" data-act="resetUIScale">Reset</button>' +
    '<span class="lbl" style="margin-left:12px">' + scale + '%</span></div>';
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

  const selCreature = S.creatures.filter(function (c) { return c.id === m.creatureId; })[0] || null;
  const acVal = selCreature && selCreature.ac != null ? selCreature.ac : "";
  body += '<div class="mrow" style="margin-top:12px">';
  if (S.creatures.length) {
    body += '<select id="atk-creature" data-act="attackCreature">' +
      '<option value="">— pick who you\'re attacking —</option>' +
      S.creatures.map(function (c) {
        return '<option value="' + c.id + '"' + (m.creatureId === c.id ? " selected" : "") + ">" +
          esc(c.name) + (c.ac != null ? " (AC " + c.ac + ")" : "") + "</option>";
      }).join("") + "</select>";
  } else {
    body += '<button class="bt cutsm" data-act="attackAddCreature">+ Add a creature to target</button>';
  }
  body += "</div>";

  body += '<div class="mrow">' +
    '<input type="number" id="atk-d20" placeholder="Your d20 result" min="1" max="20">' +
    '<input type="number" id="atk-ac" placeholder="Target AC (if known)" min="1" value="' + acVal + '">' +
    '<button class="bt cutsm pri" data-act="attackCheck">Check</button></div>';

  if (m.result) {
    const r = m.result;
    const cls = r.hit ? "hitcard hit" : "hitcard miss";
    body += '<div class="' + cls + '">' +
      '<b>' + (r.hit ? "HIT" : "MISS") + "</b>" +
      '<span>' + esc(r.note) + "</span></div>";
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

  if (m.result && m.result.hit && row.mastery === "vex" && row.masteryActive) {
    body += '<div class="warnbox" style="margin-top:12px">Vex: on this hit, you may arm Advantage on your ' +
      'next attack against this target.</div>' +
      '<button class="bt cutsm pri" data-act="armVex" data-id="' + row.id + '">Arm Vex on target</button>';
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

/* ---------- TURN ORDER BUILDER ------------------------------- */
EXT.orderModal = function () {
  const order = S.combat.order;
  function inOrder(id) { return order.some(function (o) { return o.id === id; }); }
  function candBtn(id, name, ref) {
    const on = inOrder(id);
    return '<button class="pick' + (on ? " sel" : "") + '" data-act="orderToggle" data-id="' + id +
      '" data-ref="' + ref + '"><div class="pn">' + esc(name) +
      (on ? " — in order" : "") + "</div></button>";
  }
  let body = "<h2>Turn order</h2><div class=\"msub\">Pick who's in the fight — Hal, present party members, " +
    "and any creatures you've added. Reorder and set initiative below.</div>";

  body += '<div class="ph2">Available</div>';
  body += candBtn("hal", S.identity.name || "Hal", "hal");
  (S.party.roster || []).filter(function (m) { return m.present; }).forEach(function (m) {
    body += candBtn("p:" + m.id, m.name, "party");
  });
  if (!(S.party.roster || []).some(function (m) { return m.present; })) {
    body += '<div class="foot">No party members marked Present. Add them from the Party panel.</div>';
  }
  S.creatures.forEach(function (c) {
    body += candBtn("c:" + c.id, c.name, "creature");
  });
  if (!S.creatures.length) {
    body += '<div class="foot">No creatures added yet. Add them from the Creatures panel.</div>';
  }

  body += '<div class="ph2" style="margin-top:14px">Order <span class="cnt">' + order.length + "</span></div>";
  if (!order.length) {
    body += '<div class="foot">Nobody added yet. Tap names above.</div>';
  }
  order.forEach(function (o, i) {
    const isCurrent = S.combat.currentId === o.id;
    body += '<div class="ordrow' + (isCurrent ? " cur" : "") + '">' +
      '<span class="oi">' + (i + 1) + "</span>" +
      '<span class="on">' + esc(CALC.combatantName(S, o.ref)) +
      (isCurrent ? ' <span class="tag t-c1">Current</span>' : "") + "</span>" +
      '<input type="number" class="oinit" data-act="orderInit" data-i="' + i + '" placeholder="Init" value="' +
      (o.initiative == null ? "" : o.initiative) + '">' +
      '<button class="bt cutsm" data-act="orderMove" data-i="' + i + '" data-d="-1"' +
      (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button class="bt cutsm" data-act="orderMove" data-i="' + i + '" data-d="1"' +
      (i === order.length - 1 ? " disabled" : "") + ">↓</button>" +
      '<button class="bt cutsm dg" data-act="orderToggle" data-id="' + o.id + '">Remove</button>' +
      "</div>";
  });
  body += '<div class="mrow" style="margin-top:8px">' +
    '<button class="bt cutsm" data-act="orderSort">Sort by initiative</button>' +
    '<button class="bt cutsm dg" data-act="orderClear">Clear all</button></div>';
  body += '<div class="mfoot"><button class="bt cutsm pri" data-act="closeModal">Done</button></div>';
  return body;
};

/* ---------- SESSION LOG ---------------------------------------
   A lightweight, timestamped event feed — not a structured combat
   log. It piggybacks on the labels every mutate() call already
   carries (see the mutate wrapper above), so casting, attacking,
   resting, adding creatures, and so on all show up for free once a
   session is running. `stats` are a couple of running highs, not a
   full breakdown. */
function fmtTime(t) { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(t) { return new Date(t).toLocaleDateString(); }
/* Notes and flags are the story; everything else is bookkeeping the app
   logged for you. Splitting them is what makes a recap readable. */
function isNarrative(e) { return e.kind === "note" || e.kind === "flag"; }

/* In-world date for a log entry, in whichever calendar you're reading. */
function calLabel(e) {
  if (!e.cal) return "";
  return CAL.format(S.calendar.system, e.cal.day) + ", " + CAL.timeLabel(e.cal.time);
}

function sessionToMarkdown(s) {
  const sys = S.calendar.system;
  let out = "# Session — " + fmtDate(s.startedAt) + "\n\n";
  out += "*" + fmtTime(s.startedAt) + " to " + fmtTime(s.endedAt) + "*\n\n";
  if (s.stats.highestACFaced != null) out += "- Toughest AC faced: **" + s.stats.highestACFaced + "**\n";
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
          (e.cal ? CAL.format(sys, e.cal.day) + ", Year " + e.cal.year : "Undated") + "\n\n";
      }
      out += "- **" + (e.cal ? CAL.timeLabel(e.cal.time) : fmtTime(e.t)) + "** — " +
        (e.kind === "flag" ? "⚠ " : "") + e.label + "\n";
    });
  }

  if (tech.length) {
    out += "\n## Technical log\n\n";
    tech.forEach(function (e) {
      out += "- " + fmtTime(e.t) + (e.cal ? " (" + CAL.format(sys, e.cal.day) + ")" : "") +
        " — " + e.label + "\n";
    });
  }
  return out;
}
EXT.sessionModal = function () {
  const s = S.session;
  let body = "<h2>Session log</h2>";
  if (s.active) {
    body += '<div class="msub">Started ' + fmtTime(s.startedAt) + " · " + s.log.length + " event(s) logged</div>";
    const stats = [];
    if (s.stats.highestACFaced != null) stats.push("Toughest AC faced: " + s.stats.highestACFaced);
    if (s.stats.highestDCSet != null) stats.push("Highest save DC set: " + s.stats.highestDCSet);
    if (stats.length) body += '<div class="foot">' + esc(stats.join(" · ")) + "</div>";
    body += '<div class="foot" style="margin-top:2px">In-world it is <b>' +
      esc(CAL.stamp(S.calendar)) + "</b></div>";
    body += '<div class="mrow"><input type="text" id="session-note-in" placeholder="Add a note…" style="flex:1">' +
      '<button class="bt cutsm pri" data-act="addSessionNote">Add</button></div>';

    const story = s.log.filter(isNarrative);
    const tech = s.log.filter(function (e) { return !isNarrative(e); });

    body += '<div class="ph2" style="margin-top:10px">What happened</div>';
    if (!story.length) {
      body += '<div class="foot">No notes yet. Anything you jot lands here, along with the moments worth flagging on their own — going down, dying, coming back.</div>';
    }
    story.slice().reverse().forEach(function (e) {
      const stamp = calLabel(e) || fmtTime(e.t);
      body += '<div class="gain ' + (e.kind === "flag" ? "k-flag" : "k-note") + '">' +
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
    body += '<div class="mfoot"><button class="bt cutsm dg" data-act="sessionEnd">End session</button>' +
      '<button class="bt cutsm" data-act="closeModal">Keep playing</button></div>';
  } else {
    body += '<div class="msub">A lightweight, automatic log of what happens at the table — casts, attacks, rests, and creature/party changes get a timestamped line while a session is running.</div>';
    body += '<div class="mrow"><button class="bt cutsm pri" data-act="preSessionModal">Start session</button></div>';
    if (S.sessionHistory.length) {
      const last = S.sessionHistory[S.sessionHistory.length - 1];
      const lastStats = [];
      if (last.stats.highestACFaced != null) lastStats.push("toughest AC faced " + last.stats.highestACFaced);
      if (last.stats.highestDCSet != null) lastStats.push("highest DC set " + last.stats.highestDCSet);
      body += '<div class="ph2" style="margin-top:10px">Last session</div>';
      body += '<div class="foot">' + fmtDate(last.startedAt) + " · " + last.log.length + " events" +
        (lastStats.length ? " · " + esc(lastStats.join(", ")) : "") + "</div>";
      body += '<div class="mrow"><button class="bt cutsm" data-act="sessionExport">Export last session as Markdown</button></div>';
    }
    body += '<div class="mfoot"><button class="bt cutsm" data-act="closeModal">Close</button></div>';
  }
  return body;
};

/* A gentle reminder strip, visible outside the Session modal, when a
   session is running and it's been a while since the last note (or
   since the session started, if there's no note yet). Lets you jot
   one right there without opening the modal. */
const SESSION_NOTE_REMINDER_MS = 25 * 60 * 1000;
EXT.sessionNudge = function () {
  if (!S.session.active) return "";
  const notes = S.session.log.filter(function (e) { return e.kind === "note"; });
  const last = notes.length ? notes[notes.length - 1].t : S.session.startedAt;
  if (Date.now() - last < SESSION_NOTE_REMINDER_MS) return "";
  /* If today is a feast day, say so — it's usually the thing worth writing
     down, and it saves a trip to the Calendar tab to find out. */
  const feast = CAL.holidayFor(S.calendar.system, S.calendar.day);
  const prompt = feast
    ? "It's " + esc(feast.name) + " — worth a note?"
    : "Been a while since your last note";
  return '<div class="strip cut"><span class="lbl">' + prompt + "</span>" +
    '<input type="text" placeholder="Quick note…" style="flex:1;min-width:120px">' +
    '<button class="bt cutsm pri" data-act="addSessionNote">Add</button></div>';
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
  combatStart() {
    mutate(function (st) {
      st.combat.active = true; st.combat.round = 1;
      st.combat.turn = CALC.freshTurn();
      /* A saved order (party/creatures) carries over between fights, but
         who was "current" doesn't — a new encounter starts back at the
         top of the order instead of resuming mid-list from last time. */
      st.combat.currentId = null;
    }, "Enter combat");
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

    mutate(function (st) {
      st.combat.currentId = peek.nextId;
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

    if (expired.length) {
      UI.alert = { info: "Expired: " + expired.map(function (e) { return e.name; }).join(", ") };
    }
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

  /* ---- Creatures ---- */
  creatureAdd() {
    mutate(function (st) {
      st.creatures.push({ id: newId("c"), name: "Enemy " + (st.creatures.length + 1),
        ac: null, hit: false, conditions: [], vex: false });
    }, "Add creature");
  },
  creatureDel(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) {
      const removed = st.creatures[i];
      st.creatures.splice(i, 1);
      if (removed) {
        const oid = "c:" + removed.id;
        st.combat.order = st.combat.order.filter(function (o) { return o.id !== oid; });
      }
    }, "Clear creature");
  },
  creatureName(el) {
    const i = parseInt(el.dataset.i, 10), v = el.value;
    mutate(function (st) { st.creatures[i].name = v; });
  },
  creatureAC(el) {
    const i = parseInt(el.dataset.i, 10);
    const v = el.value === "" ? null : parseInt(el.value, 10);
    mutate(function (st) { st.creatures[i].ac = (v == null || isNaN(v)) ? null : v; });
  },
  creatureHit(el) {
    const i = parseInt(el.dataset.i, 10);
    mutate(function (st) { st.creatures[i].hit = !st.creatures[i].hit; }, "Toggle hit");
  },
  creatureCondClear(el) {
    const i = parseInt(el.dataset.i, 10), j = parseInt(el.dataset.j, 10);
    mutate(function (st) { st.creatures[i].conditions.splice(j, 1); }, "Creature broke free");
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
  orderModal() { UI.modal = { type: "order" }; render(); },
  orderToggle(el) {
    const id = el.dataset.id;
    /* Figure out the label (and the ref for a new entry) from the
       CURRENT state before mutating — the label argument to mutate()
       is evaluated at call time, so building it inside the mutator
       function itself would be too late. */
    const idx = S.combat.order.findIndex(function (o) { return o.id === id; });
    let label;
    if (idx >= 0) {
      label = "Remove " + CALC.combatantName(S, S.combat.order[idx].ref) + " from turn order";
    } else {
      const ref = refFor(id, el.dataset.ref);
      label = "Add " + CALC.combatantName(S, ref) + " to turn order";
    }
    mutate(function (st) {
      const i = st.combat.order.findIndex(function (o) { return o.id === id; });
      if (i >= 0) {
        st.combat.order.splice(i, 1);
      } else {
        st.combat.order.push({ id: id, ref: refFor(id, el.dataset.ref), initiative: null });
      }
    }, label);
    render();
  },
  orderMove(el) {
    const i = parseInt(el.dataset.i, 10), d = parseInt(el.dataset.d, 10);
    mutate(function (st) {
      const j = i + d;
      if (j < 0 || j >= st.combat.order.length) return;
      const tmp = st.combat.order[i];
      st.combat.order[i] = st.combat.order[j];
      st.combat.order[j] = tmp;
    }, "Reorder turn order");
    render();
  },
  orderInit(el) {
    const i = parseInt(el.dataset.i, 10);
    const v = el.value === "" ? null : parseInt(el.value, 10);
    mutate(function (st) { st.combat.order[i].initiative = (v == null || isNaN(v)) ? null : v; });
  },
  orderSort() {
    mutate(function (st) {
      st.combat.order.sort(function (a, b) {
        const av = a.initiative == null ? -Infinity : a.initiative;
        const bv = b.initiative == null ? -Infinity : b.initiative;
        return bv - av;
      });
    }, "Sort turn order");
    render();
  },
  orderClear() {
    mutate(function (st) { st.combat.order = []; st.combat.currentId = null; }, "Clear turn order");
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
    /* Default to whichever creature was added or picked most recently. */
    const defaultCreature = S.creatures.length ? S.creatures[S.creatures.length - 1].id : null;
    UI.modal = { type: "attack", id: id, result: null, vuln: "normal", creatureId: defaultCreature };
    render();
  },
  attackCreature(el) {
    UI.modal.creatureId = el.value || null;
    render();
  },
  attackAddCreature() {
    mutate(function (st) {
      st.creatures.push({ id: newId("c"), name: "Enemy " + (st.creatures.length + 1),
        ac: null, hit: false, conditions: [], vex: false });
    }, "Add creature");
    UI.modal.creatureId = S.creatures[S.creatures.length - 1].id;
    render();
  },
  attackCheck() {
    const d20 = parseInt(document.getElementById("atk-d20").value, 10);
    const ac = parseInt(document.getElementById("atk-ac").value, 10);
    if (!d20 || d20 < 1 || d20 > 20) {
      UI.modal.result = { hit: false, crit: false, note: "Enter your d20 result, 1 through 20." };
      render(); return;
    }
    const a = CALC.attackAction(S);
    const row = a.rows.filter(function (r) { return r.id === UI.modal.id; })[0];
    const total = d20 + row.toHit;
    const nat20 = d20 === 20, nat1 = d20 === 1;
    let hit, note, crit = nat20;
    if (nat1) { hit = false; note = "Natural 1 — automatic miss, regardless of AC."; }
    else if (nat20) { hit = true; note = "Natural 20 — automatic hit and a critical."; }
    else if (ac) { hit = total >= ac; note = "Total " + total + " vs AC " + ac +
        (hit ? " — beats it by " + (total - ac) : " — short by " + (ac - total)); }
    else { hit = null; note = "Total " + total + ". Enter the target's AC to compare."; }
    UI.modal.result = { hit: hit, crit: crit, note: note };
    /* A confirmed hit marks the selected creature, so the Creatures
       panel shows who's already been hit this fight. */
    if (hit === true && UI.modal.creatureId) {
      const cid = UI.modal.creatureId;
      const c0 = S.creatures.filter(function (x) { return x.id === cid; })[0];
      mutate(function (st) {
        const c = st.creatures.filter(function (x) { return x.id === cid; })[0];
        if (c) c.hit = true;
      }, c0 ? "Mark hit: " + c0.name : "Mark hit");
    }
    /* Session stat: the toughest AC you attacked into this session. This
       is pure bookkeeping, not a player action — it goes through the
       BASE mutate (bypassing the undo/session-log wrapper) so a long
       string of attack rolls doesn't crowd real actions out of the
       20-entry undo ring or spam the log with entries that just say
       "Change". */
    if (ac && S.session.active) {
      _mutate(function (st) {
        if (st.session.stats.highestACFaced == null || ac > st.session.stats.highestACFaced) {
          st.session.stats.highestACFaced = ac;
        }
      });
    }
    render();
  },
  attackVuln(el) {
    UI.modal.vuln = el.dataset.v;
    render();
  },
  armVex(el) {
    const id = el.dataset.id;
    const preselected = UI.modal && UI.modal.creatureId;
    const pre = preselected ? S.creatures.filter(function (x) { return x.id === preselected; })[0] : null;
    /* Figure out (before mutating) what the vexed creature will be
       named, whether it's an existing pick or the "Enemy 1" that's
       about to get auto-created — so the label is meaningful either way. */
    const vexName = pre ? pre.name : (S.creatures.length ? S.creatures[S.creatures.length - 1].name : "Enemy 1");
    mutate(function (st) {
      let c = preselected ? st.creatures.filter(function (x) { return x.id === preselected; })[0] : null;
      if (!c) {
        if (!st.creatures.length) {
          st.creatures.push({ id: newId("c"), name: "Enemy 1", ac: null, hit: false, conditions: [], vex: false });
        }
        c = st.creatures[st.creatures.length - 1];
      }
      c.vex = true;
    }, "Arm Vex: " + vexName);
    UI.alert = { info: "Vex armed on " + vexName + " — Advantage on your next attack against it." };
    UI.modal = null;
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
      st.session.stats = { highestACFaced: null, highestDCSet: null };
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
        log: log, stats: Object.assign({}, st.session.stats)
      };
      st.sessionHistory.push(entry);
      if (st.sessionHistory.length > 30) st.sessionHistory.shift();
      st.session.active = false;
      st.session.startedAt = null;
      st.session.log = [];
      st.session.stats = { highestACFaced: null, highestDCSet: null };
    }, "End session");
    UI.modal = { type: "session" };
    render();
  },
  sessionExport() {
    const s = S.sessionHistory[S.sessionHistory.length - 1];
    if (!s) return;
    const md = sessionToMarkdown(s);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hal-session-" + new Date(s.startedAt).toISOString().slice(0, 10) + ".md";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
  addSessionNote(el) {
    const input = el.parentElement.querySelector('input[type="text"]');
    const text = input && input.value.trim();
    if (!text) return;
    mutate(function (st) {
      st.session.log.push({ t: Date.now(), label: text, kind: "note", cal: calStamp(st) });
      if (st.session.log.length > 500) st.session.log.shift();
    });
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
    /* Apply a tracked condition to a creature */
    if (item.applyToTarget && st.settings.creatureTracker) {
      const dc = CALC.spellSaveDC(st).value;
      if (!st.creatures.length) {
        st.creatures.push({ id: newId("c"), name: "Enemy 1", ac: null, hit: false, conditions: [], vex: false });
      }
      st.creatures[st.creatures.length - 1].conditions.push({
        label: item.applyToTarget.label, save: item.applyToTarget.save,
        dc: dc, repeat: item.applyToTarget.repeat
      });
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
  if (UI.modal && ["roll", "override", "settings", "loh", "history", "attack", "order", "session", "preSession"].indexOf(UI.modal.type) >= 0) {
    let body = "";
    if (UI.modal.type === "roll") body = EXT.rollModal();
    else if (UI.modal.type === "override") body = EXT.overrideModal();
    else if (UI.modal.type === "settings") body = EXT.settingsModal();
    else if (UI.modal.type === "loh") body = EXT.lohModal();
    else if (UI.modal.type === "attack") body = EXT.attackModal();
    else if (UI.modal.type === "order") body = EXT.orderModal();
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
    root.innerHTML = '<div class="mask"><div class="modal cut">' + body + "</div></div>";
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
        EXT.followersPanel() + EXT.partyPanel() + EXT.creaturesPanel());
    }
  } else {
    const centre = app.querySelector(".wrap > div:nth-child(2)");
    if (centre && S.effects.length) centre.insertAdjacentHTML("afterbegin", EXT.effectsPanel());
  }

  /* Undo + session + settings at the end of the top bar */
  if (bar) {
    bar.insertAdjacentHTML("beforeend",
      '<button class="bt cutsm" data-act="undo">Undo</button>' +
      '<button class="bt cutsm' + (S.session.active ? " pri" : "") + '" data-act="sessionModal">' +
      (S.session.active ? "Session ●" : "Session") + "</button>" +
      '<button class="bt cutsm" data-act="settingsModal">Settings</button>');
  }

  /* Panels injected above didn't exist when the base render folded
     things, so fold again now that the DOM is final. */
  applyPanelFolds();
};

/* Re-render once combat.js has patched everything */
render();
