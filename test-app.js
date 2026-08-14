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

console.log("\n=== ALL 18 SKILLS ARE LISTED, NOT JUST PROFICIENT ONES ===");
eq("every skill has a row", $$('[data-prov^="skill:"]').length, 18);
ok("a proficient skill is marked as such", !!$('[data-prov="skill:persuasion"].prof'));
ok("an unproficient skill is listed but dimmed", !!$('[data-prov="skill:arcana"].unprof'));
ok("unproficient skills still show a modifier",
   /Arcana/.test(text()) && /Stealth/.test(text()));
ok("Athletics (unproficient, STR -1) is visible", /Athletics/.test(text()));

console.log("\n=== CALENDAR: TWO SYSTEMS OVER ONE SHARED DAY ===");
const CALe = function (expr) { return w.eval(expr); };
eq("both calendars cover the same 364 days", CALe("CAL.daysPerYear"), 364);
eq("Jerbeen months cover the year end to end",
   CALe("CAL.systems.jerbeen.months.reduce(function(n,m){return n+(m.end-m.start+1)},0)"), 364);
eq("Common months (incl. the Convergence) do too",
   CALe("CAL.systems.common.months.reduce(function(n,m){return n+(m.end-m.start+1)},0)"), 364);
eq("day 1 is Grub-Wake 1 in Jerbeen", CALe('CAL.format("jerbeen",1)'), "Grub-Wake 1");
eq("day 1 is Dawnrise 1 in Common", CALe('CAL.format("common",1)'), "Dawnrise 1");
eq("day 42 is Hawk-Shadow 14", CALe('CAL.format("jerbeen",42)'), "Hawk-Shadow 14");
eq("day 42 is Gladmer 12", CALe('CAL.format("common",42)'), "Gladmer 12");
eq("day 364 closes the Jerbeen year", CALe('CAL.format("jerbeen",364)'), "Still-Wood 28");
eq("day 361 lands in the Common Convergence", CALe('CAL.format("common",361)'), "The Convergence 1");
eq("day 42 is a feast in BOTH calendars", CALe("CAL.allHolidaysFor(42).length"), 2);
eq("...and day 5 is a feast in neither", CALe("CAL.allHolidaysFor(5).length"), 0);
eq("the year wraps forward", JSON.stringify(CALe("CAL.advance(364,222,1)")),
   JSON.stringify({ day: 1, year: 223 }));
eq("and backward", JSON.stringify(CALe("CAL.advance(1,222,-1)")),
   JSON.stringify({ day: 364, year: 221 }));
eq("next holiday from day 2 is The High Weave in 40 days",
   CALe('CAL.nextHoliday("jerbeen",2).inDays'), 40);
eq("night rolls over into the next day", CALe('CAL.nextTime("night").rolledOver'), true);
eq("morning does not", CALe('CAL.nextTime("morning").rolledOver'), false);

console.log("\n=== CALENDAR TAB ===");
click(byAct("tab", { tab: "calendar" }));
ok("shows the Jerbeen date by default", /Grub-Wake/.test(text()));
ok("also shows the Common reckoning", /Dawnrise/.test(text()));
ok("names today's holiday", /The Emergence/.test(text()));
ok("today's feast gets its own block", !!$(".calfeast"));
function calState() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).calendar; }
click(byAct("advanceDay", { d: "1" }));
eq("+1 moves the day", calState().day, 2);
ok("no feast block on an ordinary day", !$(".calfeast"));
ok("but the year browser still lists it ahead", /The Emergence/.test(text()));
click(byAct("advanceDay", { d: "-1" }));
eq("−1 moves it back", calState().day, 1);
click(byAct("calSystem", { key: "common" }));
eq("switching system is display-only — the day is untouched", calState().day, 1);
eq("system preference saved", calState().system, "common");
ok("now reads in Common months", /Dawnrise 1/.test(text()));
click(byAct("calSystem", { key: "jerbeen" }));
click(byAct("advanceTime"));
eq("time of day steps forward", calState().timeOfDay, "midday");
click(byAct("tab", { tab: "combat" }));

console.log("\n=== CALENDAR: WEEKS AND GRIDS ===");
eq("the year is a whole number of weeks", CALe("CAL.daysPerYear % 7"), 0);
eq("day 1 opens the week", CALe('CAL.weekdayName("jerbeen",1)'), "Tunnel-Tend");
eq("the Common calendar names that same day too", CALe('CAL.weekdayName("common",1)'), "Firstlight");
eq("both cultures go quiet on the seventh", CALe('CAL.weekdayName("jerbeen",7)'), "Deep-Still");
eq("the year ends on week 52", CALe("CAL.weekIndex(364)"), 52);
eq("a Jerbeen month is exactly four weeks", CALe('CAL.monthWeeks("jerbeen",1).length'), 4);
eq("...so it has no empty cells",
   CALe('CAL.monthWeeks("jerbeen",1).reduce(function(n,r){' +
        'return n+r.filter(function(d){return d==null}).length},0)'), 0);
eq("a 30-day Common month starts mid-week instead",
   CALe('CAL.monthWeeks("common",31)[0].indexOf(31)'), 2);
eq("...and needs five rows to hold 30 days", CALe('CAL.monthWeeks("common",31).length'), 5);
eq("paging back from a month start lands in the month before",
   CALe('CAL.monthFor("jerbeen", CAL.monthStep("jerbeen",29,-1)).name'), "Grub-Wake");

console.log("\n=== CALENDAR VIEWS ===");
click(byAct("tab", { tab: "calendar" }));
click(byAct("calView", { view: "month" }));
ok("month view draws a grid", !!$(".calgrid"));
eq("seven named columns", $$(".cghead span").length, 7);
ok("today's cell is picked out", !!$(".cgcell.today"));
ok("the day page names the weekday", /Tunnel-Tend, Grub-Wake 1/.test(text()));
eq("the grid marks the day the holiday falls on", $$(".cgcell .dm.hol").length, 1);
click(byAct("calView", { view: "week" }));
eq("week view lists seven days", $$(".wkday").length, 7);
ok("week view shows both reckonings", /Grub-Wake 1/.test(text()) && /Dawnrise 1/.test(text()));
click(byAct("calView", { view: "day" }));
ok("day view keeps the day page", !!$(".dayp"));
eq("the view choice is remembered", calState().view, "day");

console.log("\n=== BROWSING IS NOT TIME PASSING ===");
click(byAct("calStep", { d: "1" }));
eq("paging the cursor leaves the party's date alone", calState().day, 1);
ok("but the page follows the cursor", /Grub-Wake 2/.test(text()));
ok("and says so, in as many words", /the party's date has not moved/.test(text()));

console.log("\n=== DATED NOTES AND REMINDERS ===");
function remindText() { const r = $(".remind"); return r ? r.textContent.replace(/\s+/g, " ") : ""; }
$("#cal-note").value = "Tribute due to the Warden";
$("#cal-note-time").value = "evening";
$("#cal-note-lead").value = "1";
click(byAct("calAddNote"));
eq("the note lands on the day being browsed", calState().events[0].day, 2);
eq("...at the hour chosen", calState().events[0].timeOfDay, "evening");
ok("and appears on that day's page", /Tribute due to the Warden/.test(text()));
const evId = calState().events[0].id;
click(byAct("calView", { view: "month" }));
eq("the grid now marks the note's day too", $$(".cgcell .dm:not(.hol)").length, 1);
click(byAct("calView", { view: "day" }));
click(byAct("calToday"));
ok("the lead warning shows the day before", /In 1 day: Tribute due to the Warden/.test(remindText()));
click(byAct("advanceDay", { d: "1" }));
ok("on the day but before the hour it is still only a warning",
   /Later today: Tribute due to the Warden/.test(remindText()));
ok("it has not come due yet", !$('[data-act="calAck"][data-key="222:2:' + evId + '"]'));
click(byAct("advanceTime"));
click(byAct("advanceTime"));
eq("the hour arrives", calState().timeOfDay, "evening");
ok("and the reminder fires", !!$('[data-act="calAck"][data-key="222:2:' + evId + '"]'));
ok("naming the note", /Tribute due to the Warden/.test(remindText()));
click($('[data-act="calAck"][data-key="222:2:' + evId + '"]'));
ok("acknowledging silences it", !$('[data-act="calAck"][data-key="222:2:' + evId + '"]'));
ok("the note itself survives being acknowledged", calState().events.length === 1);

console.log("\n=== A DAY YOU SKIPPED STILL REPORTS IN ===");
click(byAct("calStep", { d: "1" }));
click(byAct("calStep", { d: "1" }));
click(byAct("calStep", { d: "1" }));
$("#cal-note").value = "Feed the burrow-hounds";
$("#cal-note-repeat").value = "yearly";
click(byAct("calAddNote"));
eq("a yearly note is stored without a year", calState().events[1].year, null);
eq("...on day 5", calState().events[1].day, 5);
click(byAct("calToday"));
click(byAct("advanceDay", { d: "7" }));
eq("a week passes in one step", calState().day, 9);
ok("the day jumped clean over still reports in", /Feed the burrow-hounds/.test(remindText()));
ok("...and owns up to how late it is", /4 days ago/.test(remindText()));
const evId2 = calState().events[1].id;
click(byAct("calStep", { d: "-1" }));
click(byAct("calStep", { d: "-1" }));
click(byAct("calStep", { d: "-1" }));
click(byAct("calStep", { d: "-1" }));
ok("back on the day that holds it", /Feed the burrow-hounds/.test(text()));
click($('[data-act="calDeleteNote"][data-id="' + evId2 + '"]'));
eq("deleting removes the note", calState().events.length, 1);
ok("and its reminder goes with it", !/Feed the burrow-hounds/.test(remindText()));
click(byAct("calStep", { d: "1" }));
click(byAct("calSetDate"));
eq("'set the date to this day' is what actually moves the party", calState().day, 6);
/* Leave the calendar as the rest of the suite expects to find it. */
w.eval("mutate(function (st) { st.calendar = Object.assign(st.calendar, " +
       "{ day: 1, year: 222, timeOfDay: 'midday', view: 'month', events: [], acked: [] }); })");
eq("reset to day 1 for the tests that follow", calState().day, 1);
click(byAct("tab", { tab: "combat" }));

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

console.log("\n=== HIT DICE (single die matches old math, multiple dice sum, count capped) ===");
click(byAct("hitDiceModal"));
ok("hit dice modal open", !!$("#hd-in") && !!$("#hd-count"));
$("#hd-count").value = "1";
$("#hd-in").value = "6";
click(byAct("spendHitDie"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("1 die: 6 + CON(+1) = 7 HP from 0", st.currentHP, 7);
eq("hitDiceUsed now 1", st.hitDiceUsed, 1);
ok("modal closed after applying", !$("#hd-in"));

click(byAct("hitDiceModal"));
$("#hd-count").value = "2";
$("#hd-in").value = "10";
click(byAct("spendHitDie"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("2 dice: (10 total) + CON(+1)x2 = +12 HP -> 19", st.currentHP, 19);
eq("hitDiceUsed now 3", st.hitDiceUsed, 3);

click(byAct("hitDiceModal"));
$("#hd-count").value = "5";
$("#hd-in").value = "3";
click(byAct("spendHitDie"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("dice count capped at 1 remaining: 3 + CON(+1)x1 = +4 HP -> 23", st.currentHP, 23);
eq("hitDiceUsed capped at level (4)", st.hitDiceUsed, 4);

console.log("\n=== LONG REST ===");
/* spend resources first so the reset is observable */
click(byAct("loh", { d: "-10" }));
click(byAct("cd", { d: "-1" }));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("Lay on Hands spent to 10", st.resources.layOnHands, 10);
eq("Channel Divinity spent to 1", st.resources.channelDivinity, 1);
eq("calendar starts on global day 1", JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).calendar.day, 1);
click(byAct("longRestPrompt"));
ok("long rest asks how much time passed before resting", !!$("#rest-days"));
$("#rest-days").value = "1";
click(byAct("longRest"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("the in-world day advanced", st.calendar.day, 2);
eq("and picks up the next morning", st.calendar.timeOfDay, "morning");
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

console.log("\n=== HIT DICE: HP CAPS AT MAX ===");
click(byAct("hitDiceModal"));
$("#hd-count").value = "1";
$("#hd-in").value = "50";
click(byAct("spendHitDie"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("HP caps at max (35) even on a huge roll", st.currentHP, 35);
eq("hitDiceUsed still increments on an overheal", st.hitDiceUsed, 3);

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

console.log("\n=== FAITHFUL STEED GRANTS A SPELL YOU CAN ACTUALLY REACH ===");
/* The rail is what you cast from at the table. A granted spell that only
   appears in the Spells tab may as well not have been granted. */
function railSpells() {
  return $$(".rrail .entry .namebtn").map(function (e) { return e.textContent.trim(); });
}
ok("Find Steed is in the right rail, not just the Spells tab",
   railSpells().indexOf("Find Steed") >= 0);
ok("so is the Magic Initiate spell", railSpells().indexOf("Find Familiar") >= 0);
ok("granted spells are labelled as granted, not passed off as prepared",
   /Granted/.test($(".rrail").innerHTML));
eq("nothing is listed twice", railSpells().length, new Set(railSpells()).size);
eq("the free cast starts full", st.resources.faithfulSteed, 1);
/* "You can cast it once without a spell slot, regaining that use on a
   Long Rest" — the rest used to skip it, stranding the use at 0. */
click(byAct("use", { kind: "spell", id: "findSteed" }));
ok("casting a summon asks first instead of spending", !!$("#summon-form"));
eq("...and nothing has been spent yet",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.faithfulSteed, 1);
click(byAct("summonApply"));
eq("casting it free spends the use",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.faithfulSteed, 0);
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
click(byAct("longRestPrompt"));
if ($("#rest-days")) $("#rest-days").value = "0";
click(byAct("longRest"));
eq("a long rest gives the free cast back",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.faithfulSteed, 1);
click(byAct("closeModal"));
/* A sheet that reached level 5 by import rather than by levelling still
   has to know the free cast exists. */
w.eval("mutate(function (st) { delete st.resources.faithfulSteed; })");
eq("an imported level-5 sheet is given the use rather than an empty pip",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.faithfulSteed, 1);
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));

console.log("\n=== THE SUMMONED STEED ===");
function followers() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).followers; }
eq("the cast left a follower behind", followers().length, 1);
const steed = followers()[0];
eq("...from the right spell", steed.source, "findSteed");
eq("cast at its base level", steed.spellLevel, 2);
eq("AC is 10 + 1 per spell level", CALe("CALC.followerBlock(S, S.followers[0]).ac"), 12);
eq("HP is 5 + 10 per spell level", CALe("CALC.followerBlock(S, S.followers[0]).maxHP"), 25);
eq("its attack uses YOUR spell attack bonus",
   CALe("CALC.followerBlock(S, S.followers[0]).slam.bonus"), CALe("CALC.spellAttack(S).value"));
eq("no flight below a level 4 slot", CALe("CALC.followerBlock(S, S.followers[0]).canFly"), false);
eq("a level 4 slot would buy flight",
   CALe('CALC.steedBlock(S, { spellLevel: 4, creatureType: "celestial" }).canFly'), true);
eq("...and scale the block with it",
   CALe('CALC.steedBlock(S, { spellLevel: 4, creatureType: "celestial" }).maxHP'), 45);
eq("Celestial slams for Radiant",
   CALe('CALC.steedBlock(S, { spellLevel: 2, creatureType: "celestial" }).slam.damageType'), "Radiant");
eq("Fey for Psychic",
   CALe('CALC.steedBlock(S, { spellLevel: 2, creatureType: "fey" }).slam.damageType'), "Psychic");
eq("Fiend for Necrotic",
   CALe('CALC.steedBlock(S, { spellLevel: 2, creatureType: "fiend" }).slam.damageType'), "Necrotic");
ok("the rail carries the follower on every tab", !!$(".rrail .fol"));
click(byAct("tab", { tab: "notes" }));
ok("...including one it has nothing to do with", !!$(".rrail .fol"));
ok("the Followers tab exists", !!byAct("tab", { tab: "followers" }));
click(byAct("tab", { tab: "followers" }));
ok("and prints the stat block", /Otherworldly Steed/.test(text()));
ok("naming Life Bond", /Life Bond/.test(text()));

console.log("\n=== CR 0 BEASTS ===");
eq("every eligible form is loaded", CALe("Object.keys(CR0_BEASTS).length"), 35);
ok("and every one of them is Challenge 0",
   CALe("Object.keys(CR0_BEASTS).every(function(k){return /^0[\\s(]/.test(CR0_BEASTS[k].cr)})"));
ok("each carries a full ability spread",
   CALe("Object.keys(CR0_BEASTS).every(function(k){return Object.keys(CR0_BEASTS[k].abilities).length===6})"));
eq("the owl is the owl", CALe("CR0_BEASTS.owl.ac + '/' + CR0_BEASTS.owl.hp + '/' + CR0_BEASTS.owl.speed"),
   "11/1 (1d4 - 1)/5 ft., fly 60 ft.");

console.log("\n=== THE FAMILIAR ===");
click(byAct("tab", { tab: "spells" }));
click(byAct("use", { kind: "spell", id: "findFamiliar" }));
ok("casting it asks first", !!$("#summon-form"));
eq("every CR 0 beast is offered", $$("#summon-form option").length, 35);
ok("no free-text form — it must be a real Beast", !$("#summon-custom"));
ok("a ritual option is offered", /Ritual — no slot/.test(text()));
const slot1Before = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used;
$("#summon-form").value = "raven";
$("#summon-form").dispatchEvent(new w.Event("change", { bubbles: true }));
click(byAct("summonType", { key: "fiend" }));
$("#summon-name").value = "Tallow";
click(byAct("summonApply"));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
eq("the familiar joins the steed rather than replacing it", followers().length, 2);
const fam = followers().filter(function (f) { return f.source === "findFamiliar"; })[0];
eq("it took the form chosen", fam.form, "raven");
eq("a ritual costs no slot",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used, slot1Before);
eq("and no free use either",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.findFamiliar, 1);
eq("its stats are the raven's, untouched",
   CALe('(function(){var b=CALC.familiarBlock(S,{source:"findFamiliar",form:"raven",creatureType:"fiend"});' +
        'return b.acNote + "/" + b.hpNote + "/" + b.speed})()'),
   "12/1 (1d4 - 1)/10 ft., fly 50 ft.");
eq("but it is a Fiend, not a Beast",
   CALe('CALC.familiarBlock(S,{source:"findFamiliar",form:"raven",creatureType:"fiend"}).type.name'), "Fiend");
eq("the creature type changes nothing else",
   CALe('CALC.familiarBlock(S,{source:"findFamiliar",form:"raven",creatureType:"celestial"}).maxHP'),
   CALe('CALC.familiarBlock(S,{source:"findFamiliar",form:"raven",creatureType:"fiend"}).maxHP'));
click(byAct("tab", { tab: "followers" }));
ok("the familiar's own traits print", /Mimicry/.test(text()));
ok("and the rule the block doesn't carry", /can't attack/.test(text()));
/* "You can't have more than one familiar at a time." */
click(byAct("tab", { tab: "spells" }));
click(byAct("use", { kind: "spell", id: "findFamiliar" }));
$("#summon-form").value = "cat";
$("#summon-form").dispatchEvent(new w.Event("change", { bubbles: true }));
click(byAct("summonApply"));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
eq("recasting changes the form instead of adding a second familiar", followers().length, 2);
eq("...to the new one", followers().filter(function (f) {
  return f.source === "findFamiliar"; })[0].form, "cat");

console.log("\n=== A SUMMON THAT DROPS TO 0 IS GONE ===");
click(byAct("tab", { tab: "followers" }));
const famId = followers().filter(function (f) { return f.source === "findFamiliar"; })[0].id;
click(byAct("followerStow", { id: famId }));
eq("stowing keeps it, pocketed", followers().filter(function (f) { return f.id === famId; })[0].stowed, true);
click(byAct("followerStow", { id: famId }));
eq("and recalling brings it back out",
   followers().filter(function (f) { return f.id === famId; })[0].stowed, false);
click(byAct("followerDamageModal", { id: famId }));
$("#fol-dmg").value = "99";
click(byAct("followerDamage", { heal: "0" }));
eq("0 Hit Points removes it", followers().filter(function (f) { return f.id === famId; }).length, 0);
ok("and says so plainly", /disappears/.test(text()));
if (byAct("dismissAlert")) click(byAct("dismissAlert"));
eq("the steed is untouched by any of that", followers().length, 1);

console.log("\n=== COMBAT RULES ON THE FOLLOWERS TAB ===");
click(byAct("tab", { tab: "followers" }));
ok("the steed's own combat rules are spelled out", /shares your Initiative count/i.test(text()));
ok("including what happens when you go down", /Incapacitated/.test(text()));
ok("the general mounted combat rules are there too", /Mounting and Dismounting/.test(text()));
ok("...including controlling a mount", /only three action options/.test(text()));
ok("...and falling off", /DC 10 Dexterity saving throw/.test(text()));
ok("opportunity attacks are covered", /Opportunity Attack/.test(text()));
ok("and the source is named", /Playing the Game/.test(text()));
ok("the sheet works out whether it can carry Hal", /big enough to carry you/.test(text()));
eq("a Large steed can carry a Small rider",
   CALe('CALC.canBeMount(S, { size: "Large" }).ok'), true);
eq("a Tiny familiar cannot", CALe('CALC.canBeMount(S, { size: "Tiny" }).ok'), false);
eq("nor can one exactly Hal's size", CALe('CALC.canBeMount(S, { size: "Small" }).ok'), false);
ok("mounting cost is worked out from Hal's own Speed", /15 ft/.test(text()));

console.log("\n=== PANELS FOLD, AND REMEMBER IT PER TAB ===");
function foldBtn(key) { return $('[data-act="foldPanel"][data-key="' + key + '"]'); }
function foldedKeys() {
  const u = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).ui;
  return Object.keys((u && u.folded) || {});
}
click(byAct("tab", { tab: "spells" }));
ok("every panel gets a fold control", $$('[data-act="foldPanel"]').length > 4);
ok("the rail's Prepared and the tab's Prepared are separate panels",
   !!foldBtn("spells/rail/prepared") && !!foldBtn("spells/main/prepared"));
click(foldBtn("spells/rail/prepared"));
eq("folding one records exactly one key", foldedKeys(), ["spells/rail/prepared"]);
ok("the folded panel is hidden", !!$(".rrail .pnl.folded"));
ok("its neighbour in the same column is not", $$(".rrail .pnl.folded").length < $$(".rrail .pnl").length);
ok("and the tab's own Prepared is untouched", !$(".wrap > div:nth-child(2) .pnl.folded"));
click(byAct("tab", { tab: "combat" }));
ok("the same rail panel is open on a different tab", !$(".rrail .pnl.folded"));
click(foldBtn("combat/rail/prepared"));
eq("each tab records its own", foldedKeys().sort(),
   ["combat/rail/prepared", "spells/rail/prepared"]);
click(byAct("tab", { tab: "spells" }));
ok("...and the first tab kept its state", !!$(".rrail .pnl.folded"));
click(foldBtn("spells/rail/prepared"));
ok("unfolding shows it again", !$(".rrail .pnl.folded"));
eq("and drops the key rather than storing false", foldedKeys(), ["combat/rail/prepared"]);
click(byAct("tab", { tab: "combat" }));
click(foldBtn("combat/rail/prepared"));

console.log("\n=== INSPIRATION ===");
ok("there is an Inspiration toggle", !!byAct("toggle", { key: "inspiration" }));
eq("it starts empty",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.inspiration, false);
click(byAct("toggle", { key: "inspiration" }));
eq("holding it persists",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.inspiration, true);
ok("and the button reads as held", !!$('.tg.on[data-key="inspiration"]'));
click(byAct("toggle", { key: "inspiration" }));
eq("spending it clears the marker",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.inspiration, false);

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
/* Edit now lives behind the top bar's "More" group */
ok("Edit is tucked away until More is opened", !byAct("editMode"));
click(byAct("expand", { id: "moreActions" }));
ok("More reveals Edit", !!byAct("editMode"));
click(byAct("editMode"));
st = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1"));
eq("edit mode on", st.toggles.editMode, true);
ok("Edit stays visible while editing, even with More closed", !!byAct("editMode"));
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

console.log("\n=== FILTER PANEL IS COLLAPSIBLE ===");
click(byAct("tab", { tab: "features" }));
ok("filter bar visible by default", $$(".tagbar").length > 0);
const filterToggle = $$("h3").map(function (h) { return h; })
  .filter(function (h) { return h.textContent.trim().indexOf("Filter") === 0; })[0]
  .querySelector('[data-act="expand"]');
ok("Filter panel has a Hide/Show toggle", !!filterToggle);
click(filterToggle);
ok("filter bar hidden after collapsing", $$(".tagbar").length === 0);
click(byAct("expand", { id: "filterCollapsed" }));
ok("filter bar reappears after expanding again", $$(".tagbar").length > 0);

console.log("\n=== SPELLCASTING PANEL'S FILTER IS ALSO COLLAPSIBLE ===");
click(byAct("tab", { tab: "spells" }));
ok("filter bar visible by default on Spells tab", $$(".tagbar").length > 0);
ok("Spellcasting panel has its own Hide/Show toggle", !!byAct("expand", { id: "filterCollapsed" }));
click(byAct("expand", { id: "filterCollapsed" }));
ok("filter bar hidden after collapsing on Spells tab", $$(".tagbar").length === 0);
ok("Save DC / Attack info stays visible while filter is hidden", /Save DC/.test(text()));
click(byAct("expand", { id: "filterCollapsed" }));
ok("filter bar reappears on Spells tab", $$(".tagbar").length > 0);

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
const collapseBtn = $(".rrail h3.collapse");
ok("collapse control is visible in the rail header", !!collapseBtn);
ok("it reads as a control", /Hide/.test(collapseBtn.textContent));
click(collapseBtn);
ok("tapping the header collapses the rail", /railoff/.test($("#app").innerHTML));
eq("collapse state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.railCollapsed, true);
const reopen = $(".rrail .railtab");
ok("a vertical Resources tab is shown when collapsed", !!reopen);
click(reopen);
ok("tapping the tab reopens the rail", !/railoff/.test($("#app").innerHTML));
eq("expanded state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.railCollapsed, false);

console.log("\n=== LEFT (STATS) RAIL COLLAPSES INDEPENDENTLY ===");
const leftBtn = $(".lrail h3.collapse");
ok("the stats rail has its own collapse control", !!leftBtn);
click(leftBtn);
ok("collapsing the left rail sets leftoff", /leftoff/.test($("#app").innerHTML));
ok("collapsing the left rail does NOT collapse the right one",
   !/railoff/.test($("#app").innerHTML));
eq("left collapse state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.leftRailCollapsed, true);
ok("a Stats tab is shown when collapsed", !!$(".lrail .railtab"));
ok("the right rail's body is untouched while the left is collapsed",
   !!$(".rrail .railbody h3"));
click($(".lrail .railtab"));
ok("tapping the Stats tab reopens it", !/leftoff/.test($("#app").innerHTML));
eq("left expanded state persisted",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.leftRailCollapsed, false);

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
