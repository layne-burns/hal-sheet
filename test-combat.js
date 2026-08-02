/* Integration tests for combat.js / combat-rules.js — action economy,
   casting, effects, creatures, party, turn order, undo, glow, settings.
   Run: NODE_PATH=/tmp/node_modules node test-combat.js */

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

const dir = __dirname;
function src(f) { return fs.readFileSync(path.join(dir, f), "utf8"); }
function inline(f) { return "<script>" + src(f) + "</script>"; }
const html = src("index.html")
  .replace(/<script src="rules\.js"><\/script>/, inline("rules.js"))
  .replace(/<script src="combat-rules\.js"><\/script>/, inline("combat-rules.js"))
  .replace(/<script src="app\.js"><\/script>/, inline("app.js"))
  .replace(/<script src="combat\.js"><\/script>/, inline("combat.js"));

const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/" });
const w = dom.window, doc = w.document;

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
function state() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")); }
function setVal(el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }
/* Order entries deliberately don't cache a name (it's resolved live off
   the ref, so renames stay in sync) — mirror that lookup here instead
   of asserting against a field that no longer exists. */
function orderName(st, o) {
  if (!o || !o.ref) return "?";
  if (o.ref.type === "hal") return st.identity.name || "Hal";
  if (o.ref.type === "party") {
    const m = st.party.roster.filter(function (x) { return x.id === o.ref.partyId; })[0];
    return m ? m.name : "(removed)";
  }
  if (o.ref.type === "creature") {
    const c = st.creatures.filter(function (x) { return x.id === o.ref.creatureId; })[0];
    return c ? c.name : "(removed)";
  }
  return "?";
}

console.log("\n=== BOOT WITH COMBAT MODULE ===");
ok("app still boots", $("#app").innerHTML.length > 2000);
ok("out-of-combat strip shown", /Out of combat/.test(text()));
ok("Enter combat button present", !!byAct("combatStart"));
ok("What you can do now panel renders", /What you can do now/.test(text()));
ok("Undo button in top bar", !!byAct("undo"));
ok("Settings button in top bar", !!byAct("settingsModal"));

console.log("\n=== TAG PALETTE ===");
click(byAct("tab", { tab: "spells" }));
ok("grouped tag headers render", /Helps you or an ally/.test(text()));
ok("Damage tag present", /Damage/.test(text()));
const tagEls = $$(".tag");
ok("tags use the new 3-hue+gray classes", tagEls.some(function (e) {
  return /t-c1|t-m1|t-y1|t-g/.test(e.className);
}));
ok("no tag uses the old violet/mag/grn classes", !tagEls.some(function (e) {
  return /t-violet|t-mag(?!enta)|t-grn/.test(e.className);
}));

console.log("\n=== SMITE AVAILABILITY (2024: spells, not innate) ===");
const castables = w.eval("CALC.castables(S)");
const smiteIds = ["divineSmite", "searingSmite", "thunderousSmite", "wrathfulSmite", "ensnaringStrike"];
ok("Divine Smite is always offered (free cast + always prepared)",
   castables.some(function (c) { return c.id === "divineSmite"; }));
ok("Ensnaring Strike is always offered (oath spell)",
   castables.some(function (c) { return c.id === "ensnaringStrike"; }));
ok("Searing/Thunderous/Wrathful smite are NOT offered until prepared",
   !castables.some(function (c) { return c.id === "searingSmite" || c.id === "thunderousSmite" || c.id === "wrathfulSmite"; }));
ok("Divine Smite is flagged afterHit", castables.filter(function (c) { return c.id === "divineSmite"; })[0].afterHit);
ok("Divine Smite offers the free-cast resource",
   castables.filter(function (c) { return c.id === "divineSmite"; })[0].free === true);

console.log("\n=== ENTER COMBAT / ACTION ECONOMY ===");
click(byAct("tab", { tab: "combat" }));
click(byAct("combatStart"));
let st = state();
eq("combat active", st.combat.active, true);
eq("round starts at 1", st.combat.round, 1);
eq("fresh turn: nothing spent", st.combat.turn, CALC_snapshot());
function CALC_snapshot() { return { action:false, bonus:false, reaction:false, movementUsed:0, slotUsed:false, hitLanded:false }; }
ok("combat bar shows Round 1", /Round 1/.test(text()));
ok("Action pip shows open", /Action/.test(text()));

console.log("\n=== ATTACK, THEN SMITE (the whole point) ===");
ok("smites hidden from 'what can I do' before a hit lands",
   !text().match(/Divine Smite[\s\S]{0,40}Cast/) || (function(){
     /* Divine Smite may appear elsewhere (Spells tab), so check the doable list specifically */
     const doables = $$(".doable .en").map(function(e){return e.textContent;});
     return doables.indexOf("Divine Smite") === -1;
   })());
click(byAct("logHit"));
st = state();
eq("hit logged", st.combat.turn.hitLanded, true);
const doablesAfterHit = $$(".doable .en").map(function (e) { return e.textContent; });
ok("Divine Smite now in the doable list", doablesAfterHit.indexOf("Divine Smite") >= 0);

console.log("\n=== CAST DIVINE SMITE FREE (no slot spent) ===");
const smiteBtn = byAct("use", { kind: "spell", id: "divineSmite" });
ok("cast button for Divine Smite exists", !!smiteBtn);
click(smiteBtn);
st = state();
eq("free smite resource consumed", st.resources.freeSmite, 0);
eq("no spell slot spent for the free cast", st.resources.slots["1"].used, 0);
eq("bonus action spent", st.combat.turn.bonus, true);
eq("slotUsed flag NOT set for a free cast", st.combat.turn.slotUsed, false);
ok("roll prompt shows 2d8 radiant", /2d8/.test(text()));
ok("roll prompt explains the Fiend/Undead rider", /Fiend or Undead/.test(text()));
click(byAct("closeModal"));

console.log("\n=== ONE SLOT PER TURN (2024 RAW) ===");
click(byAct("tab", { tab: "combat" }));
const blessBtn = byAct("use", { kind: "spell", id: "bless" });
ok("Bless is castable", !!blessBtn);
click(blessBtn);
st = state();
eq("Bless spent a level-1 slot", st.resources.slots["1"].used, 1);
eq("slotUsed is now true", st.combat.turn.slotUsed, true);
ok("Bless roll prompt explains itself", /Add 1d4 to the attack roll/.test(text()));
click(byAct("closeModal"));
click(byAct("tab", { tab: "combat" }));

/* A second slot-spender this turn should now be blocked. The "what can
   I do now" panel hides unaffordable items by design, so the cast
   button to test the override lives in the Spells tab instead. */
const cureCastable = w.eval('CALC.castables(S).filter(function(c){return c.id==="cureWounds"})[0]');
ok("Cure Wounds correctly flagged unaffordable", cureCastable && !cureCastable.affordable);
ok("reason cites the 2024 one-slot rule",
   cureCastable.reasons.some(function (r) { return /one spell slot per turn/i.test(r); }));
click(byAct("tab", { tab: "spells" }));
const cureBtn = byAct("use", { kind: "spell", id: "cureWounds" });
ok("Cure Wounds still has a (dimmed) cast button in the Spells tab", !!cureBtn);
ok("its button is visually dimmed", cureBtn.className.indexOf("dim") >= 0);
click(cureBtn);
ok("override modal appears for a second slot this same turn",
   /Can't afford that/i.test(text()));
ok("modal reason text cites the one-slot rule", /one spell slot per turn/i.test(text()));
click(byAct("closeModal"));
click(byAct("tab", { tab: "combat" }));

console.log("\n=== CONCENTRATION: NEW CAST DROPS THE OLD ===");
/* End the turn to reset the economy, keep Bless's effect active */
st = state();
eq("Bless is an active concentration effect", st.effects.some(function (e) { return e.name === "Bless" && e.conc; }), true);
eq("toggles.concentrating followed the cast", st.toggles.concentrating, true);
eq("concentratingOn is Bless", st.toggles.concentratingOn, "Bless");
click(byAct("endTurn"));
click(byAct("tab", { tab: "combat" }));
const shieldBtn = byAct("use", { kind: "spell", id: "shieldOfFaith" });
ok("Shield of Faith castable next turn", !!shieldBtn);
click(shieldBtn);
st = state();
eq("only one concentration effect survives", st.effects.filter(function (e) { return e.conc; }).length, 1);
eq("the survivor is Shield of Faith", st.effects.filter(function (e) { return e.conc; })[0].name, "Shield of Faith");
eq("Bless was dropped", st.effects.some(function (e) { return e.name === "Bless"; }), false);
/* Shield of Faith has no roll prompt, so this surfaces as the info
   alert rather than a roll modal — either way, the drop must be named. */
ok("the drop is surfaced to the player", /dropped Bless/.test(text()));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
if (byAct("closeModal")) click(byAct("closeModal"));

console.log("\n=== EFFECTS AUTO-APPLY TO NUMBERS ===");
const acWithShield = w.eval("CALC.armorClass(S).value");
eq("Shield of Faith adds +2 AC automatically", acWithShield, 18);
click(byAct("tab", { tab: "combat" }));
ok("AC shown as 18 in the top bar", />18</.test($(".bar").innerHTML));
click('[data-prov="ac"]');
ok("AC provenance names Shield of Faith", /Shield of Faith/.test(text()));
click('[data-prov="ac"]');

console.log("\n=== END TURN EXPIRES EFFECTS ===");
st = state();
const rounds = st.effects.filter(function (e) { return e.name === "Shield of Faith"; })[0].rounds;
ok("Shield of Faith has a round count", rounds > 1);
/* Fast-forward: tick end turn until it expires */
for (let i = 0; i < rounds + 1; i++) { click(byAct("endTurn")); if (byAct("closeModal")) {} }
st = state();
eq("Shield of Faith expired", st.effects.some(function (e) { return e.name === "Shield of Faith"; }), false);
eq("concentration cleared on expiry", st.toggles.concentrating, false);
eq("AC back to 16 after expiry", w.eval("CALC.armorClass(S).value"), 16);

console.log("\n=== NATURE'S WRATH -> CREATURE TRACKER ===");
click(byAct("combatEnd"));
click(byAct("combatStart"));
click(byAct("tab", { tab: "combat" }));
const nwBtn = byAct("use", { kind: "action", id: "naturesWrath" });
ok("Nature's Wrath is offered (Channel Divinity available)", !!nwBtn);
click(nwBtn);
st = state();
eq("Channel Divinity spent", st.resources.channelDivinity, 1);
ok("a creature auto-created", st.creatures.length >= 1);
ok("creature carries the Restrained condition", st.creatures[st.creatures.length - 1].conditions.some(function (c) {
  return /Nature's Wrath/.test(c.label);
}));
eq("condition repeats at end of turn", st.creatures[st.creatures.length - 1].conditions[0].repeat, "endOfTurn");
ok("roll prompt calls out EACH target", /EACH target/.test(text()));
click(byAct("closeModal"));

click(byAct("tab", { tab: "combat" }));
ok("creature tracker shows the save DC", new RegExp("DC " + CALC_dc()).test(text()));
function CALC_dc() { return w.eval("CALC.spellSaveDC(S).value"); }
const clearBtn = byAct("creatureCondClear", { i: (state().creatures.length - 1) + "", j: "0" });
ok("Broke free control exists", !!clearBtn);
click(clearBtn);
st = state();
eq("condition cleared after breaking free", st.creatures[st.creatures.length - 1].conditions.length, 0);

console.log("\n=== MANUAL CREATURE MANAGEMENT ===");
click(byAct("creatureAdd"));
st = state();
const before = st.creatures.length;
click(byAct("creatureDel", { i: "0" }));
eq("creature removed", state().creatures.length, before - 1);

console.log("\n=== CREATURE AC + HIT TRACKING ===");
click(byAct("creatureAdd"));
st = state();
const cIdx = st.creatures.length - 1;
const acField = byAct("creatureAC", { i: cIdx + "" });
ok("AC input exists on the creature row", !!acField);
setVal(acField, "15");
st = state();
eq("creature AC saved", st.creatures[cIdx].ac, 15);
ok("creature not yet marked hit", st.creatures[cIdx].hit === false);
click(byAct("creatureHit", { i: cIdx + "" }));
st = state();
eq("creature hit toggled on", st.creatures[cIdx].hit, true);
click(byAct("creatureHit", { i: cIdx + "" }));
eq("creature hit toggled back off", state().creatures[cIdx].hit, false);

console.log("\n=== ATTACK ROLL WIRES INTO THE SELECTED CREATURE ===");
click(byAct("tab", { tab: "combat" }));
function shortswordBtn() { return byAct("attackRoll", { id: "shortsword" }); }
click(shortswordBtn());
ok("creature picker appears when creatures exist", !!$("#atk-creature"));
const lastCreature = state().creatures[state().creatures.length - 1];
eq("AC autofilled from the selected creature", $("#atk-ac").value, String(lastCreature.ac || ""));
$("#atk-d20").value = "20";
click(byAct("attackCheck"));
ok("natural 20 is an automatic hit", /automatic hit/i.test(text()));
st = state();
eq("the selected creature is marked hit after a confirmed hit",
   st.creatures[st.creatures.length - 1].hit, true);
click(byAct("closeModal"));

console.log("\n=== SETTINGS TOGGLE THE ENGINE ===");
click(byAct("settingsModal"));
ok("settings modal lists roll prompts", /Roll prompts/.test(text()));
ok("settings modal lists edge glow", /Screen edge glow/.test(text()));
click(byAct("setting", { key: "rollPrompts" }));
st = state();
eq("rollPrompts toggled off", st.settings.rollPrompts, false);
click(byAct("closeModal"));

click(byAct("combatEnd"));
click(byAct("combatStart"));
click(byAct("tab", { tab: "combat" }));
click(byAct("logHit"));
const smiteBtn2 = byAct("use", { kind: "spell", id: "divineSmite" });
if (smiteBtn2) click(smiteBtn2);
ok("no roll modal when rollPrompts is off", !$("#hp-roll") && !/Radiant damage — add 1d8/.test(text()));
/* restore */
click(byAct("settingsModal"));
click(byAct("setting", { key: "rollPrompts" }));
click(byAct("closeModal"));

console.log("\n=== ECONOMY LOCKOUT TOGGLE ===");
click(byAct("settingsModal"));
click(byAct("setting", { key: "economyLockout" }));
st = state();
eq("economyLockout off", st.settings.economyLockout, false);
click(byAct("closeModal"));
click(byAct("combatEnd")); click(byAct("combatStart"));
click(byAct("tab", { tab: "combat" }));
/* Spend the action, then try another action-cost item — should NOT block now */
const dashBtn = byAct("use", { kind: "action", id: "dash" });
if (dashBtn) click(dashBtn);
const dodgeBtn = byAct("use", { kind: "action", id: "dodge" });
if (dodgeBtn) click(dodgeBtn);
ok("no override modal when economyLockout is off", !/Can't afford that/.test(text()));
click(byAct("settingsModal"));
click(byAct("setting", { key: "economyLockout" }));
click(byAct("closeModal"));

console.log("\n=== UNDO ===");
click(byAct("combatEnd"));
const hpBefore = state().currentHP;
click(byAct("damageModal"));
setVal($("#dmg-in"), "10");
click(byAct("applyDamage"));
eq("HP dropped by 10", state().currentHP, hpBefore - 10);
click(byAct("undo"));
eq("undo restored HP", state().currentHP, hpBefore);

console.log("\n=== EDGE GLOW ===");
function glowClass() {
  const g = doc.getElementById("glow-root");
  return g ? g.innerHTML : "";
}
ok("no glow at full HP, not concentrating", !/glow-conc|glow-low|glow-both/.test(glowClass()));
click(byAct("toggle", { key: "concentrating" }));
ok("cyan glow while concentrating", /glow-conc/.test(glowClass()));
click(byAct("toggle", { key: "concentrating" }));
ok("glow clears when concentration toggles off", !/glow-conc/.test(glowClass()));

click(byAct("damageModal"));
const maxHP = w.eval("CALC.maxHP(S).value");
setVal($("#dmg-in"), String(state().currentHP - Math.ceil(maxHP * 0.1)));
click(byAct("applyDamage"));
ok("red glow below 20% HP", /glow-low/.test(glowClass()));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));

click(byAct("toggle", { key: "concentrating" }));
ok("both glow classes combine under 20% HP + concentrating", /glow-both/.test(glowClass()));

console.log("\n=== SETTINGS: EDGE GLOW OFF ===");
click(byAct("settingsModal"));
click(byAct("setting", { key: "edgeGlow" }));
click(byAct("closeModal"));
ok("glow suppressed entirely when the setting is off", glowClass() === "");

console.log("\n=== UNDO DOES NOT FIRE ON COSMETIC CHANGES ===");
click(byAct("settingsModal"));
click(byAct("setting", { key: "edgeGlow" }));
click(byAct("closeModal"));
const histBefore = JSON.parse(w.localStorage.getItem("hal-briarshade-history-v1") || "[]").length;
click(byAct("tab", { tab: "spells" }));
click(byAct("tab", { tab: "combat" }));
const histAfterTabs = JSON.parse(w.localStorage.getItem("hal-briarshade-history-v1") || "[]").length;
eq("switching tabs does not push undo history", histAfterTabs, histBefore);

console.log("\n=== SEED DATA HAS THE NEW FIELDS ===");
ok("SEED includes settings", !!w.eval("SEED.settings"));
ok("SEED includes combat block", !!w.eval("SEED.combat"));
ok("SEED includes effects array", Array.isArray(w.eval("SEED.effects")));
ok("SEED includes creatures array", Array.isArray(w.eval("SEED.creatures")));
ok("SEED includes a party roster", Array.isArray(w.eval("SEED.party.roster")));
ok("SEED includes a turn order", Array.isArray(w.eval("SEED.combat.order")));

console.log("\n=== PARTY ROSTER ===");
click(byAct("tab", { tab: "combat" }));
click(byAct("partyAdd"));
st = state();
eq("party member added", st.party.roster.length, 1);
ok("new member defaults to present", st.party.roster[0].present);
const memberNameField = byAct("partyName", { i: "0" });
setVal(memberNameField, "Gill");
eq("party member renamed", state().party.roster[0].name, "Gill");
click(byAct("partyPresent", { i: "0" }));
eq("member marked away", state().party.roster[0].present, false);
click(byAct("partyPresent", { i: "0" }));
eq("member marked present again", state().party.roster[0].present, true);

console.log("\n=== TURN ORDER BUILDER ===");
click(byAct("orderModal"));
ok("order modal opens", /Turn order/.test(text()));
ok("Hal is offered as a candidate", /Hal/.test(text()) || new RegExp(w.eval("SEED.identity.name") || "Hal").test(text()));
click(byAct("orderToggle", { id: "hal" }));
click(byAct("orderToggle", { id: "p:" + state().party.roster[0].id }));
st = state();
eq("two combatants in the order", st.combat.order.length, 2);
ok("Hal is in the order", st.combat.order.some(function (o) { return o.id === "hal"; }));
ok("Gill is in the order", st.combat.order.some(function (o) { return orderName(st, o) === "Gill"; }));
ok("order entries don't cache a name field", st.combat.order.every(function (o) { return !("name" in o); }));
/* Reorder: move the second entry up */
const secondName = orderName(st, st.combat.order[1]);
click(byAct("orderMove", { i: "1", d: "-1" }));
const afterMove = state();
eq("order after moving entry 1 up", orderName(afterMove, afterMove.combat.order[0]), secondName);

console.log("\n=== TURN ORDER STAYS LIVE ACROSS A RENAME ===");
setVal(byAct("partyName", { i: "0" }), "Gilligan");
const renamed = state();
ok("the turn order reflects the rename immediately, no stale snapshot",
   renamed.combat.order.some(function (o) { return orderName(renamed, o) === "Gilligan"; }));
ok("the stale name is gone from the order", !renamed.combat.order.some(function (o) { return orderName(renamed, o) === "Gill"; }));
/* restore the name so later sections that assert on "Gill" still hold */
setVal(byAct("partyName", { i: "0" }), "Gill");
click(byAct("closeModal"));

console.log("\n=== END TURN ADVANCES THROUGH THE ORDER ===");
if (byAct("combatEnd")) click(byAct("combatEnd"));
click(byAct("combatStart"));
st = state();
const orderNames = st.combat.order.map(function (o) { return o.id; });
eq("currentId starts null before the first Next Turn", st.combat.currentId, null);
const roundBefore = st.combat.round;
click(byAct("endTurn"));
st = state();
ok("currentId now points at the first entry in the order", orderNames.indexOf(st.combat.currentId) === 0);
eq("round does not advance on the first Next Turn", st.combat.round, roundBefore);
click(byAct("endTurn"));
st = state();
ok("currentId now points at the second entry", orderNames.indexOf(st.combat.currentId) === 1);
click(byAct("endTurn"));
st = state();
eq("wrapping back to the first entry advances the round", st.combat.round, roundBefore + 1);
eq("currentId wrapped back to the first entry", orderNames.indexOf(st.combat.currentId), 0);

console.log("\n=== A NEW ENCOUNTER RESTARTS THE ORDER FROM THE TOP ===");
ok("currentId is mid-order (not null) before ending this fight", state().combat.currentId !== null);
click(byAct("combatEnd"));
click(byAct("combatStart"));
st = state();
eq("the saved order survives to the next fight", st.combat.order.length, 2);
eq("but currentId resets, so Next Turn starts at the top again", st.combat.currentId, null);

console.log("\n=== REMOVING A CREATURE/PARTY MEMBER DROPS IT FROM THE ORDER ===");
click(byAct("orderModal"));
click(byAct("orderClear"));
st = state();
eq("order cleared", st.combat.order.length, 0);
eq("currentId cleared with it", st.combat.currentId, null);
click(byAct("closeModal"));
click(byAct("creatureAdd"));
st = state();
const pruneCreature = st.creatures[st.creatures.length - 1];
click(byAct("orderModal"));
click(byAct("orderToggle", { id: "c:" + pruneCreature.id }));
eq("creature added to the order", state().combat.order.length, 1);
click(byAct("closeModal"));
click(byAct("creatureDel", { i: (state().creatures.length - 1) + "" }));
eq("deleting the creature also drops it from the order", state().combat.order.length, 0);

console.log("\n=== PARTY STATUS (healthy/bloodied/down, no exact HP tracked) ===");
st = state();
eq("new party member starts healthy", st.party.roster[0].status, "healthy");
click(byAct("partyStatus", { i: "0" }));
eq("cycles to bloodied", state().party.roster[0].status, "bloodied");
click(byAct("partyStatus", { i: "0" }));
eq("cycles to down", state().party.roster[0].status, "down");
click(byAct("partyStatus", { i: "0" }));
eq("cycles back to healthy", state().party.roster[0].status, "healthy");

console.log("\n=== SESSION LOG ===");
ok("SEED starts with no active session", !w.eval("SEED.session.active"));
click(byAct("sessionModal"));
ok("session modal offers Start session before one is running", !!byAct("sessionStart"));
click(byAct("sessionStart"));
st = state();
eq("session marked active", st.session.active, true);
ok("session has a start time", typeof st.session.startedAt === "number");
/* Starting itself is a labeled mutate() call, so it's the log's first
   entry — that's a feature, not a bug: the recap opens with "Started". */
eq("log opens with its own Start session entry", st.session.log.length, 1);
ok("that entry says Start session", /Start session/.test(st.session.log[0].label));

/* A labeled action (Add party member) should land in the log; an
   unlabeled one (toggling a setting) should not add log noise. */
click(byAct("partyAdd"));
st = state();
ok("a labeled action is logged while the session is active",
   st.session.log.some(function (e) { return /Add party member/.test(e.label); }));
const logLenBefore = st.session.log.length;
click(byAct("settingsModal"));
click(byAct("setting", { key: "rollPrompts" }));
click(byAct("closeModal"));
eq("an unlabeled toggle does not add a log line", state().session.log.length, logLenBefore);
/* restore */
click(byAct("settingsModal"));
click(byAct("setting", { key: "rollPrompts" }));
click(byAct("closeModal"));

console.log("\n=== SESSION STATS: TOUGHEST AC / HIGHEST DC (BOOKKEEPING, NOT LOGGED) ===");
click(byAct("tab", { tab: "combat" }));
/* Out of combat so attackRoll's own "spend the Action" mutate doesn't
   fire — isolating just the stat bookkeeping this section is about. */
if (byAct("combatEnd")) click(byAct("combatEnd"));
const logLenBeforeAttacks = state().session.log.length;
const histLenBeforeAttacks = JSON.parse(w.localStorage.getItem("hal-briarshade-history-v1") || "[]").length;
[11, 9, 14].forEach(function (ac) {
  click(byAct("attackRoll", { id: "shortsword" }));
  setVal($("#atk-d20"), "11");
  setVal($("#atk-ac"), String(ac));
  click(byAct("attackCheck"));
  click(byAct("closeModal"));
});
eq("toughest AC faced recorded across several checks", state().session.stats.highestACFaced, 14);
eq("stat bookkeeping alone does not add session log lines",
   state().session.log.length, logLenBeforeAttacks);
ok("stat bookkeeping alone does not burn undo-history slots either",
   JSON.parse(w.localStorage.getItem("hal-briarshade-history-v1") || "[]").length <= histLenBeforeAttacks);

console.log("\n=== END SESSION ARCHIVES AND RESETS THE LOG ===");
const histCountBefore = state().sessionHistory.length;
click(byAct("sessionModal"));
click(byAct("sessionEnd"));
st = state();
eq("session no longer active", st.session.active, false);
eq("live log reset after ending", st.session.log.length, 0);
eq("one more entry archived", st.sessionHistory.length, histCountBefore + 1);
const archived = st.sessionHistory[st.sessionHistory.length - 1];
ok("archived entry kept its log", archived.log.length > 0);
eq("archived entry kept the AC stat", archived.stats.highestACFaced, 14);
eq("archived log opens with Start session", archived.log[0].label, "Start session");
eq("archived log closes with End session", archived.log[archived.log.length - 1].label, "End session");
ok("session modal now offers to export the last session", !!byAct("sessionExport"));
click(byAct("closeModal"));

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);
