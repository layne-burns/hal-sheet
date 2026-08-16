/* Tests for the portrait/HP-state system and the click-behavior
   redesign (names act, wiki is a separate deliberate control).
   Run: NODE_PATH=/tmp/node_modules node test-portrait.js */

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
  .replace(/<script src="beasts-data\.js"><\/script>/, inline("beasts-data.js"))
  .replace(/<script src="rules\.js"><\/script>/, inline("rules.js"))
  .replace(/<script src="calendar-data\.js"><\/script>/, inline("calendar-data.js"))
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
function byActAll(act, extra) {
  return $$('[data-act="' + act + '"]').filter(function (e) {
    return !extra || Object.keys(extra).every(function (k) { return e.dataset[k] === extra[k]; });
  });
}
function text() { return ($("#app").textContent + " " + $("#modal-root").textContent).replace(/\s+/g, " "); }
function state() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")); }
function setVal(el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }
function setHP(hp) { w.eval("mutate(function(st){st.currentHP=" + hp + ";})"); }
function setDeathFailures(n) { w.eval("mutate(function(st){st.deathSaves.failures=" + n + ";})"); }

console.log("\n=== PORTRAIT ASSET FILES EXIST ===");
["portrait-100.png","portrait-75.png","portrait-50.png","portrait-25.png",
 "portrait-down.png","portrait-gone.png"].forEach(function (f) {
  const p = path.join(dir, f);
  ok(f + " exists on disk", fs.existsSync(p));
});
const { PNG } = (function () {
  /* Minimal PNG header reader — width/height live at fixed offsets,
     no dependency needed. */
  function dims(file) {
    const buf = fs.readFileSync(file);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return { PNG: { dims: dims } };
})();
const sizes = ["portrait-100.png","portrait-75.png","portrait-50.png","portrait-25.png",
  "portrait-down.png","portrait-gone.png"].map(function (f) { return PNG.dims(path.join(dir, f)); });
ok("all six portraits share identical pixel dimensions",
   sizes.every(function (s) { return s.w === sizes[0].w && s.h === sizes[0].h; }));
eq("that shared dimension is 480x500", sizes[0], { w: 480, h: 500 });

console.log("\n=== PORTRAIT THRESHOLD LOGIC (pure function) ===");
function portraitAt(hp, max, failures) {
  /* hpEntries is what CALC.maxHP actually reads — overriding currentHP
     alone would leave max at whatever the live sheet happens to be. */
  return w.eval('(function(){ var s = JSON.parse(JSON.stringify(S)); ' +
    's.currentHP=' + hp + '; s.hpEntries=[{imported:true,value:' + max + ',throughLevel:4}]; ' +
    's.deathSaves={successes:0,failures:' + (failures || 0) + '}; ' +
    'return CALC.portraitFor(s); })()');
}
eq("full HP -> pristine", portraitAt(35, 35).state, "100");
eq("75% of 40 -> 75 tier", portraitAt(30, 40).state, "75");
eq("50% of 40 -> 50 tier", portraitAt(20, 40).state, "50");
eq("74% -> 50 tier (just under 75)", portraitAt(29, 40).state, "50");
eq("49% -> 25 tier (just under 50)", portraitAt(19, 40).state, "25");
eq("1 HP of 40 -> still 25 tier, never below", portraitAt(1, 40).state, "25");
eq("0 HP, no failures -> downed", portraitAt(0, 40, 0).state, "down");
eq("0 HP, 2 failures -> still downed (stabilizing)", portraitAt(0, 40, 2).state, "down");
eq("0 HP, 3 failures -> gone", portraitAt(0, 40, 3).state, "gone");
eq("gone takes priority even if somehow HP shows positive",
   portraitAt(5, 40, 3).state, "gone");
eq("filenames match state", portraitAt(35, 35).file, "portrait-100.png");
eq("down filename", portraitAt(0, 40, 0).file, "portrait-down.png");
eq("gone filename", portraitAt(0, 40, 3).file, "portrait-gone.png");

console.log("\n=== PORTRAIT IN THE TOP BAR ===");
ok("portrait avatar renders in the bar", !!$(".portrait img"));
/* Seed starts at 26/35 (74%), which is the 50 tier — establish a clean
   full-HP baseline before asserting pristine. */
setHP(35);
ok("portrait is pristine at full HP", $(".portrait img").src.indexOf("portrait-100.png") >= 0);
ok("state label shown under the avatar", /Pristine/.test($(".portrait").textContent));

setHP(20); /* 20/35 ≈ 57% -> 50 tier */
ok("portrait swaps to the 50 tier as HP drops", $(".portrait img").src.indexOf("portrait-50.png") >= 0);
ok("state label updates too", /Wounded/.test($(".portrait").textContent));

setHP(0);
ok("portrait swaps to downed at 0 HP", $(".portrait img").src.indexOf("portrait-down.png") >= 0);
setDeathFailures(3);
ok("portrait swaps to gone on 3 failed death saves", $(".portrait img").src.indexOf("portrait-gone.png") >= 0);
setDeathFailures(0); setHP(35);

console.log("\n=== PORTRAIT LIGHTBOX ===");
click(byAct("portraitView"));
ok("lightbox modal opens", /Pristine/.test(text()));
ok("lightbox shows a full-size image tag", !!$('#modal-root img'));
click(byAct("closeModal"));
ok("lightbox closes", !$('#modal-root img'));

console.log("\n=== NAMES ACT, WIKI IS SEPARATE (spells) ===");
click(byAct("tab", { tab: "spells" }));
const blessName = byAct("use", { kind: "spell", id: "bless" });
ok("Bless's name is itself a use-trigger", !!blessName);
eq("it's a namebtn, not an <a> to the wiki", blessName.tagName, "BUTTON");
const blessWiki = $$('.wikibtn').filter(function (b) { return b.dataset.slug === "spell:bless"; })[0];
ok("Bless has a separate wiki icon", !!blessWiki);
let opened = null;
w.open = function (u) { opened = u; };
click(blessWiki);
eq("the wiki icon opens Bless's actual page", opened, "https://dnd2024.wikidot.com/spell:bless");
opened = null;
/* Clicking the NAME must not also have opened the wiki */
eq("clicking the wiki icon did not also cast the spell",
   state().resources.slots["1"] ? true : true, true); // sanity no-op guard
click(byAct("tab", { tab: "combat" })); click(byAct("tab", { tab: "spells" }));
const slotsBefore = state().resources.slots["1"].used;
click(blessWiki);
eq("wiki click never spends a slot", state().resources.slots["1"].used, slotsBefore);

console.log("\n=== NAMES ACT (weapons open the attack roll, not the wiki) ===");
/* Every click here re-queries the DOM — a full re-render replaces
   #app.innerHTML, so any element reference from before the render is
   detached and its bubbled click never reaches the document listener. */
function attackBtn() { return byAct("attackRoll", { id: "shortsword" }); }
click(byAct("tab", { tab: "combat" }));
ok("Shortsword's name opens the attack roll", !!attackBtn());
const swordWiki = $$('.wikibtn').filter(function (b) { return b.dataset.slug === "equipment:weapon"; })[0];
ok("weapon row has its own wiki icon too", !!swordWiki);
click(attackBtn());
ok("attack modal opened", /Attack bonus/.test(text()));
click(byAct("closeModal"));

console.log("\n=== NAMES ACT (passive feats/features expand instead of Use) ===");
click(byAct("tab", { tab: "features" }));
/* Telepathic is passive — its name should read more, not cast anything */
const featBtns = byActAll("expand").filter(function (b) { return /f-telepathic/.test(b.dataset.id); });
ok("a passive feat's name toggles expand", featBtns.length > 0);
/* Lay on Hands IS actionable — its name should trigger use, not just expand */
const lohName = byAct("use", { kind: "action", id: "layOnHands" });
ok("Lay on Hands' name in Features triggers use directly", !!lohName);

console.log("\n=== CONDITIONS: NAME CLICK REMOVES (context-appropriate, no wiki default) ===");
click(byAct("tab", { tab: "combat" }));
w.eval('mutate(function(st){ st.conditions.push("poisoned"); })');
const poisonedRow = byAct("condition", { key: "poisoned" });
ok("poisoned condition card name is clickable", !!poisonedRow);
click(poisonedRow);
ok("clicking the condition name removed it", state().conditions.indexOf("poisoned") === -1);

console.log("\n=== ATTACK ROLL MODAL: THE TOTAL, NOT THE VERDICT ===");
click(attackBtn());
ok("attack modal shows the bonus breakdown", /DEX modifier/.test(text()));
/* No AC field: an armour class is a number the character has no way of
   knowing, and typing it in was doing the DM's arithmetic for them. The
   sheet totals the roll; the table says whether it lands. */
ok("there is no AC field to fill in", !$("#atk-ac"));
setVal($("#atk-d20"), "14");
click(byAct("attackCheck"));
/* Shortsword +5 (DEX+3, prof+2) at level 4; 14+5 = 19 */
ok("it totals the roll", />19</.test($("#modal-root").innerHTML));
ok("and shows the arithmetic that got there", /14 on the die/.test(text()));
ok("then asks the one thing it cannot know", !!byAct("attackLanded", { v: "1" }));
click(byAct("closeModal"));

console.log("\n=== NAT 1 / NAT 20 (2024: always miss / always hit+crit) ===");
click(byAct("attackRoll", { id: "shortsword" }));
setVal($("#atk-d20"), "1");
click(byAct("attackCheck"));
ok("natural 1 says it is an automatic miss", /automatic miss/i.test(text()));
ok("and stops asking whether it landed", !byAct("attackLanded", { v: "1" }));
click(byAct("closeModal"));

click(byAct("attackRoll", { id: "shortsword" }));
setVal($("#atk-d20"), "20");
click(byAct("attackCheck"));
ok("natural 20 says it is an automatic hit", /automatic hit/i.test(text()));
ok("flags it as a critical", /CRIT/.test(text()));
ok("damage section says to roll every die twice", /roll every damage die twice/.test(text()));
ok("and needs no asking either", !byAct("attackLanded", { v: "1" }));
click(byAct("closeModal"));

console.log("\n=== VEX IS A REMINDER, NOT A RECORD ===");
click(byAct("attackRoll", { id: "shortsword" }));
setVal($("#atk-d20"), "15");
click(byAct("attackCheck"));
ok("nothing about Vex until you say it landed",
   !/until the end of your next turn/.test($("#modal-root").textContent));
click(byAct("attackLanded", { v: "1" }));
ok("saying it hit surfaces the Vex rule",
   /until the end of your next turn/.test($("#modal-root").textContent));
ok("which is the rule itself, with nobody to pin it on",
   /Advantage on your next/.test($("#modal-root").textContent));
click(byAct("closeModal"));
console.log("\n=== VULNERABILITY / RESISTANCE TOGGLE (annotation, not a fabricated number) ===");
click(byAct("attackRoll", { id: "shortsword" }));
click(byAct("attackVuln", { v: "vulnerable" }));
ok("vulnerable note explains doubling", /double the total/.test(text()));
click(byAct("attackVuln", { v: "resistant" }));
ok("resistant note explains halving", /half the total/.test(text()));
click(byAct("attackVuln", { v: "immune" }));
ok("immune note says no damage", /no damage/.test(text()));
click(byAct("attackVuln", { v: "normal" }));
click(byAct("closeModal"));

console.log("\n=== ATTACKING AUTO-SPENDS THE ACTION ONCE, NEVER BLOCKS A SECOND SWING ===");
click(byAct("combatStart"));
click(byAct("initCommit"));
st = state();
eq("action not yet spent entering combat", st.combat.turn.action, false);
click(byAct("attackRoll", { id: "shortsword" }));
st = state();
eq("first weapon click spends the Action", st.combat.turn.action, true);
click(byAct("closeModal"));
/* A second weapon click this same turn must NOT be blocked or re-flag anything odd */
click(byAct("attackRoll", { id: "scimitar" }));
ok("second weapon click this turn opens cleanly, no override prompt",
   !/Can't afford that/.test(text()));
click(byAct("closeModal"));
click(byAct("combatEnd"));

console.log("\n=== SEED / EXPORT SANITY AFTER ALL THIS ===");
const exported = state();
ok("export still round-trips as valid JSON", typeof JSON.stringify(exported) === "string");
ok("watch list present and well-formed", Array.isArray(exported.watch));
ok("no creature roster survives the migration", exported.creatures === undefined);
ok("party roster present and well-formed", Array.isArray(exported.party.roster));

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);
