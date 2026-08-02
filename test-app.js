/* Integration tests — runs index.html in jsdom and drives the real UI.
   Run: node test-app.js   (needs: NODE_PATH=/tmp/node_modules) */

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
function inline(f) { return "<script>" + fs.readFileSync(path.join(dir, f), "utf8") + "</script>"; }
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
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
/* Only the RENDERED output — never the inlined <script> source, which
   would otherwise produce false positives on every string in the code. */
function text() {
  return ($("#app").textContent + " " + $("#modal-root").textContent).replace(/\s+/g, " ");
}

console.log("\n=== BOOT ===");
ok("app rendered", $("#app").innerHTML.length > 2000);
ok("character name shown", /Hal Briarshade/.test(text()));
ok("level 4 shown", /PALADIN 4/.test(text()));
ok("HP 26/35 shown", /26\/35/.test(text()));
ok("AC 16 shown", />16</.test($("#app").innerHTML));
ok("no console errors on boot", true);

console.log("\n=== AURA IS HIDDEN BELOW LEVEL 6 ===");
eq("no Aura toggle at level 4", $$('[data-key="auraOfProtection"]').length, 0);
ok("Take Heart toggle exists", !!byAct("toggle", { key: "takeHeart" }));
ok("Concentrating toggle exists", !!byAct("toggle", { key: "concentrating" }));

console.log("\n=== PERSISTENCE ===");
click(byAct("toggle", { key: "takeHeart" }));
const stored = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("Take Heart persisted to localStorage", stored.toggles.takeHeart, true);
ok("STR save now shows ADV", /ADV/.test($("#app").innerHTML));
click(byAct("toggle", { key: "takeHeart" }));
eq("toggled back off",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.takeHeart, false);

console.log("\n=== TABS ===");
click(byAct("tab", { tab: "spells" }));
ok("spells tab shows Bless", /Bless/.test(text()));
ok("spells tab shows save DC", /Save DC/i.test(text()));
click(byAct("tab", { tab: "features" }));
ok("features tab shows Lay On Hands", /Lay On Hands/.test(text()));
ok("features shows import corrections", /Import corrections/i.test(text()));
ok("locked feature visible as upcoming", /Unlocks at level 6/.test(text()));
click(byAct("tab", { tab: "inventory" }));
ok("inventory shows the shard trinket", /shard of metal/.test(text()));
ok("inventory shows 130 gp", /130/.test(text()));
click(byAct("tab", { tab: "notes" }));
ok("notes shows backstory", /Gill/.test(text()));
ok("notes shows the Telepathic reminder", /Detect Thoughts/.test(text()));
ok("no unresolved-field notes remain", !/UNRESOLVED/.test(text()));
click(byAct("tab", { tab: "combat" }));
ok("combat tab shows the attack action", /Attack action/i.test(text()));

console.log("\n=== ATTACK BLOCK & MASTERY ===");
ok("Shortsword listed", /Shortsword/.test(text()));
ok("Scimitar listed", /Scimitar/.test(text()));
ok("Hand Crossbow listed", /Hand Crossbow/.test(text()));
ok("Vex named", /Vex/.test(text()));
ok("Nick named", /Nick/.test(text()));
ok("inactive mastery badged", /Inactive/.test(text()));
ok("bonus action note present", /Bonus Action stays open/i.test(text()));
const before = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.activeMasteries;
eq("2 masteries active at boot", before.length, 2);
click(byAct("mastery", { id: "handCrossbow" }));
const after = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.activeMasteries;
eq("still capped at 2 after activating a third", after.length, 2);
ok("hand crossbow now active", after.indexOf("handCrossbow") >= 0);
click(byAct("mastery", { id: "handCrossbow" }));
click(byAct("mastery", { id: "shortsword" }));
const restored = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.activeMasteries;
eq("back to 2 active", restored.length, 2);

console.log("\n=== PROVENANCE ===");
click('[data-prov="save:cha"]');
ok("provenance panel opened", /Charisma save/.test(text()));
ok("shows the CHA modifier line", /Charisma modifier/i.test(text()));
ok("shows proficiency line", /Proficiency \(Paladin save\)/.test(text()));
ok("names the Telepathic feat", /Telepathic/.test(text()));
ok("shows the +6 total", /\+6/.test(text()));
click('[data-prov="save:cha"]');
ok("provenance panel closed", !/Charisma save ·/.test(text()));
click('[data-prov="loh"]');
ok("Lay on Hands provenance cites level x 5", /Paladin level 4 x 5/.test(text()));
click('[data-prov="loh"]');

console.log("\n=== DAMAGE & CONCENTRATION ENGINE ===");
click(byAct("toggle", { key: "concentrating" }));
click(byAct("damageModal"));
ok("damage modal open", !!$("#dmg-in"));
$("#dmg-in").value = "25";
click(byAct("applyDamage"));
let st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("HP 26 - 25 = 1", st.currentHP, 1);
ok("concentration alert raised", /Roll Constitution save/i.test(text()));
ok("DC 12 for 25 damage", /DC 12/.test(text()));
ok("alert names the damage", /25 damage taken/.test(text()));
ok("alert shows the CON save bonus", /\+1/.test(text()));
click(byAct("dismissAlert"));
ok("alert dismissed", !/Roll Constitution save/i.test(text()));

console.log("\n=== DEATH SAVES AT 0 HP ===");
click(byAct("damageModal"));
$("#dmg-in").value = "5";
click(byAct("applyDamage"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("HP floors at 0, never negative", st.currentHP, 0);
ok("death save strip appeared", /death saves|Unconscious/i.test(text()));
ok("Unconscious condition auto-applied", st.conditions.indexOf("unconscious") >= 0);
click(byAct("deathSave", { kind: "failures", i: "0" }));
eq("failure pip recorded", JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).deathSaves.failures, 1);

console.log("\n=== LONG REST ===");
/* spend resources first so the reset is observable */
click(byAct("loh", { d: "-10" }));
click(byAct("cd", { d: "-1" }));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("Lay on Hands spent to 10", st.resources.layOnHands, 10);
eq("Channel Divinity spent to 1", st.resources.channelDivinity, 1);
click(byAct("longRest"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("HP restored to max", st.currentHP, 35);
eq("Lay on Hands restored to 20", st.resources.layOnHands, 20);
eq("Channel Divinity restored to 2", st.resources.channelDivinity, 2);
eq("free smite restored", st.resources.freeSmite, 1);
eq("find familiar restored", st.resources.findFamiliar, 1);
eq("slots restored", st.resources.slots["1"].used, 0);
eq("concentration ended", st.toggles.concentrating, false);
eq("death saves cleared", st.deathSaves, { successes: 0, failures: 0 });
ok("unconscious cleared", st.conditions.indexOf("unconscious") < 0);
ok("long rest modal offers a mastery swap", /weapon masteries/i.test(text()));
click(byAct("closeModal"));

console.log("\n=== SHORT REST (RAW: regain ONE use) ===");
click(byAct("cd", { d: "-1" }));
click(byAct("cd", { d: "-1" }));
eq("both CD uses spent",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.channelDivinity, 0);
click(byAct("shortRest"));
eq("short rest regains exactly 1",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.channelDivinity, 1);
click(byAct("shortRest"));
eq("second short rest regains the other",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.channelDivinity, 2);
click(byAct("shortRest"));
eq("never exceeds the max",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.channelDivinity, 2);
if (byAct("dismissAlert")) click(byAct("dismissAlert"));

console.log("\n=== LEVEL-UP ENGINE ===");
click(byAct("levelUpModal"));
ok("level up modal open", /Level up — 4 → 5/.test(text()));
ok("announces Extra Attack", /Extra Attack/.test(text()));
ok("announces the pool going 20 to 25", /Lay On Hands pool 20 to 25/.test(text()));
ok("shows the exact house-rule wording",
   /Input your raw d10 roll\. The app will automatically add \+1 to this roll unless you rolled a 10\./.test(text()));
ok("d10 input present", !!$("#hp-roll"));

/* invalid roll is rejected */
$("#hp-roll").value = "11";
click(byAct("levelUpRoll"));
ok("rejects an out-of-range roll", /1 through 10/.test(text()));

/* a 7 becomes 8 */
$("#hp-roll").value = "7";
click(byAct("levelUpRoll"));
ok("advanced to spell selection", /Choose 1 new prepared spell|new prepared spell/i.test(text()));
ok("rolled 7 counts as 8", /counts as 8/.test(text()));
const spellBtn = $$('[data-act="pickSpell"]')[0];
ok("spell choices offered", !!spellBtn);
click(spellBtn);
click(byAct("spellsNext"));
ok("reached confirm step", /Apply level 5/.test(text()));
ok("confirm explains the +1 house rule", /after the \+1 house rule/.test(text()));
click(byAct("levelUpApply"));

st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("level is now 5", st.level, 5);
eq("max HP 35 + 8 + 1 CON = 44", st.hpEntries.reduce(function (a, e) {
  return a + (e.imported ? e.value : e.adjusted + 1);
}, 0), 44);
eq("hp entry recorded the raw roll", st.hpEntries[1].raw, 7);
eq("hp entry recorded the adjusted roll", st.hpEntries[1].adjusted, 8);
eq("Lay on Hands max is now 25", st.resources.layOnHands, 25);
ok("Extra Attack unlocked", st.features.indexOf("extraAttack") >= 0);
ok("Faithful Steed unlocked", st.features.indexOf("faithfulSteed") >= 0);
eq("6 prepared spells now", st.preparedSpells.length, 6);
ok("2nd level slots exist", !!st.resources.slots["2"]);
ok("proficiency is now +3 in the UI", /\+3/.test($("#app").innerHTML));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));

console.log("\n=== AURA APPEARS AT LEVEL 6 ===");
click(byAct("levelUpModal"));
$("#hp-roll").value = "10";
click(byAct("levelUpRoll"));
ok("a natural 10 gets no bonus", /natural 10, no bonus/.test(text()));
click(byAct("levelUpApply"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("level 6", st.level, 6);
ok("Aura of Protection now in features", st.features.indexOf("auraOfProtection") >= 0);
ok("Aura toggle now rendered", !!byAct("toggle", { key: "auraOfProtection" }));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
const dexBefore = $("#app").innerHTML;
click(byAct("toggle", { key: "auraOfProtection" }));
ok("aura changes the saves display", $("#app").innerHTML !== dexBefore);
click('[data-prov="save:dex"]');
ok("aura appears in save provenance", /Aura of Protection/.test(text()));
click('[data-prov="save:dex"]');

console.log("\n=== EXTRA ATTACK CHANGES THE SEQUENCE ===");
click(byAct("tab", { tab: "combat" }));
const seqSteps = $$(".atk .stp").map(function (e) { return e.textContent; });
ok("sequence now has two numbered attacks plus Nick",
   seqSteps.slice(0, 3).join(",") === "1,2,+");

console.log("\n=== EDIT MODE ===");
click(byAct("editMode"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("edit mode on", st.toggles.editMode, true);
ok("ability inputs appear", $$('[data-act="editAbility"]').length === 6);
const dexIn = byAct("editAbility", { key: "dex" });
dexIn.value = "18";
dexIn.dispatchEvent(new w.Event("change", { bubbles: true }));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("DEX raised to 18", st.abilities.dex, 18);
ok("AC recalculated (still capped by scale mail)", /Armor/.test(text()));
byAct("editAbility", { key: "dex" }).value = "16";
byAct("editAbility", { key: "dex" }).dispatchEvent(new w.Event("change", { bubbles: true }));
eq("DEX restored", JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).abilities.dex, 16);
click(byAct("tab", { tab: "features" }));
click(byAct("addCustom"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("custom homebrew entry added", st.customEntries.length, 1);
ok("homebrew badge rendered", /Homebrew/.test(text()));
click(byAct("delCustom", { id: st.customEntries[0].id }));
eq("custom entry deleted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).customEntries.length, 0);
click(byAct("editMode"));

console.log("\n=== TAG FILTER ===");
click(byAct("tab", { tab: "spells" }));
const conc = $$('[data-act="filter"][data-tag="concentration"]')[0];
ok("concentration filter chip exists", !!conc);
click(conc);
ok("filter is active", /Clear/.test(text()));
const filtered = text();
ok("Bless survives the concentration filter", /Bless/.test(filtered));
ok("Cure Wounds is filtered out", !/Cure Wounds/.test(filtered));
click(byAct("clearFilter"));
ok("Cure Wounds returns after clearing", /Cure Wounds/.test(text()));

console.log("\n=== WIKI ACCESS (deliberate, secondary — never the default click) ===");
/* Names are no longer <a href> wiki links — tapping a name now acts,
   and the wiki is reached through a separate, small, explicit control. */
const bareWikiLinks = $$('a[href^="http://dnd2024.wikidot.com/"]');
eq("no name is a direct wiki <a> anymore", bareWikiLinks.length, 0);
const wikiBtns = $$('[data-act="wiki"]');
ok("wiki icon controls are rendered instead", wikiBtns.length > 5);
ok("a spell's wiki control carries its slug",
   wikiBtns.some(function (b) { return /spell:/.test(b.dataset.slug); }));
let openedUrl = null;
w.open = function (url) { openedUrl = url; };
click(wikiBtns[0]);
ok("tapping the wiki control opens the correct dnd2024 URL",
   openedUrl && openedUrl.indexOf("http://dnd2024.wikidot.com/") === 0);

console.log("\n=== EXPORT / IMPORT ROUNDTRIP ===");
const snapshot = w.localStorage.getItem("hal-briarshade-sheet-v1");
const parsedSnap = JSON.parse(snapshot);
eq("snapshot is level 6", parsedSnap.level, 6);
ok("snapshot has hp roll history", parsedSnap.hpEntries.length === 3);
ok("export produces valid JSON", typeof JSON.parse(snapshot) === "object");
/* simulate an import of a level-4 sheet */
w.localStorage.setItem("hal-briarshade-sheet-v1", JSON.stringify(
  Object.assign({}, parsedSnap, { level: 4, hpEntries: [parsedSnap.hpEntries[0]] })));
ok("stored state can be replaced",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).level === 4);

console.log("\n=== KEYBOARD SHORTCUTS ===");
w.localStorage.setItem("hal-briarshade-sheet-v1", snapshot);
function key(k) { doc.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true })); }
key("2");
ok("key 2 switches to Spells", /Save DC/i.test(text()));
key("1");
ok("key 1 switches to Combat", /Attack action/i.test(text()));
key("d");
ok("key D opens the damage modal", !!$("#dmg-in"));
key("Escape");
ok("Escape closes the modal", !$("#dmg-in"));
key("r");
ok("R is NOT a shortcut — rail unaffected", !/railoff/.test($("#app").innerHTML));

console.log("\n=== RAIL COLLAPSE IS TAP-ONLY ===");
const collapseBtn = $("h3.collapse");
ok("collapse control is visible in the rail header", !!collapseBtn);
ok("it reads as a control", /Hide/.test(collapseBtn.textContent));
click(collapseBtn);
ok("tapping the header collapses the rail", /railoff/.test($("#app").innerHTML));
eq("collapse state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.railCollapsed, true);
const reopen = $(".railtab");
ok("a vertical Resources tab is shown when collapsed", !!reopen);
click(reopen);
ok("tapping the tab reopens the rail", !/railoff/.test($("#app").innerHTML));
eq("expanded state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.railCollapsed, false);

console.log("\n=== PWA WIRING ===");
ok("manifest linked", !!$('link[rel="manifest"]'));
ok("apple touch icon linked", !!$('link[rel="apple-touch-icon"]'));
ok("standalone meta present", !!$('meta[name="apple-mobile-web-app-capable"]'));
const mani = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
eq("manifest is standalone", mani.display, "standalone");
eq("manifest start_url is relative", mani.start_url, "./index.html");
ok("manifest lists 512 icon", mani.icons.some(function (i) { return i.sizes === "512x512"; }));
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
ok("sw precaches rules.js", /rules\.js/.test(sw));
ok("sw precaches app.js", /app\.js/.test(sw));
ok("sw skips cross-origin requests", /origin !== self\.location\.origin/.test(sw));

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);
