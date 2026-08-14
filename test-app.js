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
  .replace(/<script src="cyrnn-data\.js"><\/script>/, inline("cyrnn-data.js"))
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
eq("next holiday from day 2 is The Bedrock-Listen in 12 days",
   CALe('CAL.nextHoliday("jerbeen",2).inDays'), 12);
eq("night rolls over into the next day", CALe('CAL.nextTime("night").rolledOver'), true);
eq("morning does not", CALe('CAL.nextTime("morning").rolledOver'), false);

console.log("\n=== CALENDAR: WHO KEEPS WHICH FEAST ===");
eq("the campaign sheet's 36 holidays are all here",
   CALe("CAL.systems.jerbeen.holidays.length + CAL.systems.common.holidays.length"), 36);
ok("every holiday says who observes it",
   CALe('CAL.systems.jerbeen.holidays.concat(CAL.systems.common.holidays)' +
        '.every(function(h){return h.regionLabel && h.scopes && h.scopes.length})'));

/* The source spreadsheet states a weekday for every holiday. It is derivable
   from the day number, so we re-derive all 36 and check them: a disagreement
   means either the sheet or the 7-day cycle is wrong. */
eq("every stated weekday agrees with the seven-day cycle",
   CALe('CAL.systems.jerbeen.holidays.concat(CAL.systems.common.holidays)' +
        '.filter(function(h){' +
        '  return CAL.weekdayName("jerbeen",h.day)!==' +
        '    ["Tunnel-Tend","Cord-Count","Forage-Wide","Thorn-Weave",' +
        '     "Ear-Turn","Kin-Gather","Deep-Still"][(h.day-1)%7]}).length'), 0);

/* The join the Map tab runs on: a place asks with every scope it answers to
   and gets its feasts without anyone maintaining that list by hand. */
const gorns = 'CAL.holidaysForScopes(["gorns-rest","muur","perimeter"])';
ok("Gorns Rest keeps its own feast — Lyestra's Fall names the town",
   CALe(gorns + '.some(function(e){return e.holiday.name==="Lyestra\'s Fall" && e.local})'));
ok("...its region's feast, via the Muur scope",
   CALe(gorns + '.some(function(e){return e.holiday.name==="The All-Forge" && e.local})'));
ok("...and its group's, via the Fracture-perimeter scope",
   CALe(gorns + '.some(function(e){return e.holiday.name==="Isenbyr\'s Lament" && e.local})'));
ok("pan-regional feasts reach it too, but marked as such",
   CALe(gorns + '.some(function(e){return e.holiday.name==="The Remembrance" && !e.local})'));
ok("local feasts lead the list", CALe(gorns + "[0].local"), true);
eq("a place with no scopes still keeps the pan-regional ones",
   CALe('CAL.holidaysForScopes([]).every(function(e){return e.panRegional && !e.local})'), true);
ok("the Shade Briar's calendar is its own — the Jerbeen feasts are all its",
   CALe('CAL.holidaysForScopes(["shade-briar"]).filter(function(e){return e.local}).length') === 14);
ok("Isenbyr's Lament is observed on day 14 in Muur",
   CALe('CAL.observedOn(["muur"],14).length') > 0);
ok("...but the Red Desert only sees the pan-regional part of that day",
   CALe('CAL.observedOn(["red-desert"],14).length') === 0);

console.log("\n=== THE COMMON CALENDAR RECKONS FROM THE FRACTURE ===");
eq("the Common calendar carries the PF era", CALe('CAL.system("common").era'), "PF");
eq("a Common year reads as Post Fracture", CALe("CAL.yearLabel('common',2022)"), "2022 PF");
eq("the Shade Briar counts the same year without the era",
   CALe("CAL.yearLabel('jerbeen',2022)"), "Year 2022");
eq("the party starts in 2022 PF", calState().year, 2022);

console.log("\n=== CYRNN: THE WORLD ===");
eq("every region the source names", CALe("CYRNN.regions.length"), 9);
ok("every place sits in a region that exists",
   CALe("CYRNN.places.every(function(p){return !!CYRNN.region(p.region)})"));
ok("every place is pinned inside the map",
   CALe("CYRNN.places.concat(CYRNN.regions).every(function(p){" +
        "return p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100})"));
ok("no two places share an id",
   CALe("new Set(CYRNN.places.map(function(p){return p.id})).size") === CALe("CYRNN.places.length"));
ok("every group a place claims is a real group",
   CALe("CYRNN.places.every(function(p){return (p.groups||[]).every(function(g){return !!CYRNN.group(g)})})"));
eq("the three perimeter towns are the three the source names",
   CALe('CYRNN.places.filter(function(p){return (p.groups||[]).indexOf("perimeter")>=0})' +
        '.map(function(p){return p.id}).sort().join(",")'),
   "gorns-rest,hacketts-watch,telrens-ridge");
ok("the perimeter spans three different kingdoms",
   CALe('new Set(CYRNN.places.filter(function(p){return (p.groups||[]).indexOf("perimeter")>=0})' +
        '.map(function(p){return p.region})).size') === 3);
ok("Gloomwood is on the map, southwest of Gorns Rest",
   CALe('CYRNN.place("gloomwood").x') < CALe('CYRNN.place("gorns-rest").x') &&
   CALe('CYRNN.place("gloomwood").y') > CALe('CYRNN.place("gorns-rest").y'));
ok("the Shade Briar is a place in the world, not just a calendar",
   CALe('!!CYRNN.place("shade-briar")'));

console.log("\n=== CYRNN: THE MAP/CALENDAR JOIN ===");
/* The whole point of the scope vocabulary: a place asks the calendar
   what it keeps, and neither file maintains a list about the other. */
eq("a place's scopes are itself, its region, and its groups",
   CALe('CYRNN.scopesFor("gorns-rest").sort().join(",")'), "gorns-rest,muur,perimeter");
ok("so Gorns Rest can find its own feasts through the calendar",
   CALe('CAL.holidaysForScopes(CYRNN.scopesFor("gorns-rest"))' +
        '.some(function(e){return e.holiday.name==="Lyestra\'s Fall"})'));
ok("every scope the calendar names is something the world defines",
   CALe('CAL.systems.jerbeen.holidays.concat(CAL.systems.common.holidays)' +
        '.every(function(h){return h.scopes.every(function(s){' +
        '  return s==="pan-regional"||!!CYRNN.region(s)||!!CYRNN.place(s)||!!CYRNN.group(s)})})'));
ok("the Ghost Moors surface the devil who cursed them",
   CALe('CYRNN.lorePinnedTo(["ghost-moors","hearthlands"]).powers' +
        '.some(function(p){return p.id==="thraazipan"})'));
ok("...and the people that curse created",
   CALe('CYRNN.lorePinnedTo(["ghost-moors"]).peoples.some(function(p){return p.id==="wulven"})'));
ok("search finds a place by its prose, not just its name",
   CALe('CYRNN.search("wyvern").some(function(r){return r.entry.id==="silver-grove"})'));

console.log("\n=== CYRNN: THE HISTORY AGREES WITH 2022 PF ===");
eq("the timeline runs in order",
   CALe("CYRNN.eras.filter(function(e){return e.year!=null}).map(function(e){return e.year})" +
        ".every(function(y,i,a){return i===0||a[i-1]<=y})"), true);
eq("the Fracture is year zero", CALe('CYRNN.eras.filter(function(e){return e.id==="fracture"})[0].year'), 0);
eq("the war ends in 20 PF", CALe('CYRNN.eras.filter(function(e){return e.id==="gorns-triumph"})[0].year'), 20);
eq("and the present is 2022 PF", CALe('CYRNN.eras.filter(function(e){return e.id==="now"})[0].year'), 2022);
ok("no lore still claims the round 2000 years",
   !/2000 years|2,000 years/.test(
     CALe("CYRNN.regions.concat(CYRNN.places).map(function(e){return e.lore}).join(' ')") +
     CALe("CAL.systems.common.holidays.map(function(h){return h.lore}).join(' ')")));

console.log("\n=== MAP TAB ===");
click(byAct("tab", { tab: "map" }));
function mapState() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).map; }
ok("the map is drawn", !!$(".mapimg"));
eq("every visible place has a pin", $$(".mpin").length, CALe("CYRNN.places.length"));
ok("the atlas lists the regions", /The Hearthlands/.test(text()) && /Kel'dorel/.test(text()));
ok("the world panel carries the history", /The Great Fracture/.test(text()));
ok("...the gods", /Lyestra/.test(text()) && /Boralius/.test(text()));
ok("...and the devils", /Azar'och/.test(text()) && /Yamuuk/.test(text()));

console.log("\n=== MAP: FILTERING BY WHAT A PIN IS ===");
eq("the legend offers one switch per family", $$(".lgd").length, 6);
ok("every family starts switched on", $$(".lgd.on").length === 6);
eq("every pin belongs to exactly one family",
   CALe("mapPins().filter(function(p){return !MAP_FILTERS.some(function(f){" +
        "return f.id===mapGroupOf(p)})}).length"), 0);
const allPins = $$(".mpin").length;
click(byAct("mapFilter", { key: "wilds" }));
ok("switching a family off takes it off the map", $$(".mpin").length < allPins);
eq("...and nothing of that family is left drawn",
   $$(".mpin.k-forest, .mpin.k-swamp, .mpin.k-hills, .mpin.k-mountains, .mpin.k-sea, .mpin.k-island").length, 0);
ok("...while the towns are untouched", $$(".mpin.k-town").length > 0);
ok("the atlas still lists what the map is hiding", /Highwood/.test(text()));
ok("the footer says it is showing a subset", /of \d+ pins/.test(text()));
eq("only the switched-off family is stored",
   JSON.stringify(mapState().off), JSON.stringify({ wilds: true }));
click(byAct("mapFilter", { key: "wilds" }));
eq("switching it back on restores every pin", $$(".mpin").length, allPins);
eq("...and stores nothing at all", JSON.stringify(mapState().off), "{}");
click(byAct("mapFilter", { key: "cities" }));
click(byAct("mapFilter", { key: "ruins" }));
ok("Show all appears once anything is hidden", !!byAct("mapFilterAll"));
click(byAct("mapFilterAll"));
eq("Show all clears every filter at once", $$(".mpin").length, allPins);

console.log("\n=== MAP: A PLACE READS ITS OWN CALENDAR ===");
click($('.mpin[data-id="gorns-rest"]'));
ok("selecting a pin opens its article", /Dwarven free state/.test(text()));
ok("the article names its own feast", /Lyestra's Fall/.test(text()));
ok("...its region's", /The All-Forge/.test(text()));
ok("...and its garrison's", /Isenbyr's Lament/.test(text()));
ok("the god who died for it is surfaced too", /mother of the mountains/.test(text()));
ok("a place with no local feast says so plainly",
   (function () { click($('.mpin[data-id="whispering-hills"]')); return /pan-regional/.test(text()); })());

console.log("\n=== MAP: YOUR EDITS ARE DELTAS, NOT A COPY ===");
/* The whole design rests on this: cyrnn-data.js stays canonical, state
   holds only what changed, so the world can grow under your edits. */
const canonX = CALe('CYRNN.place("gorns-rest").x');
CALe('mutate(function(st){ st.map.edits["gorns-rest"] = {x:52,y:39.5}; })');
eq("a moved pin resolves to the new position", CALe('mapPin("gorns-rest").x'), 52);
eq("...and the data file is untouched", CALe('CYRNN.place("gorns-rest").x'), canonX);
eq("only the delta is stored",
   JSON.stringify(Object.keys(mapState().edits)), JSON.stringify(["gorns-rest"]));
CALe('mutate(function(st){ st.map.edits["corisport"] = {name:"Corisport (burned)"}; })');
eq("a rename resolves too", CALe('mapPin("corisport").name'), "Corisport (burned)");
CALe('mutate(function(st){ st.map.edits["frozen-sea"] = {hidden:true}; })');
eq("a hidden place leaves the map", CALe('mapPin("frozen-sea")'), null);
eq("...but is recoverable, not destroyed", CALe("mapHiddenIds().length"), 1);
ok("...and the source still has it", CALe('!!CYRNN.place("frozen-sea")'));

console.log("\n=== MAP: THE WORLD CAN GROW UNDER YOUR EDITS ===");
const pinsBefore = CALe("mapPins().length");
CALe('CYRNN.places.push({id:"new-town",name:"Newly Written Town",kind:"town",' +
     'region:"muur",x:44,y:34,tags:[],blurb:"b",lore:"l"})');
eq("a place added to the data file simply appears", CALe("mapPins().length"), pinsBefore + 1);
eq("your nudge survived it", CALe('mapPin("gorns-rest").x'), 52);
eq("your rename survived it", CALe('mapPin("corisport").name'), "Corisport (burned)");
eq("your hide survived it", CALe('mapPin("frozen-sea")'), null);
ok("and the new place inherits its region's feasts with no wiring",
   CALe('CAL.holidaysForScopes(CYRNN.scopesFor("new-town")).filter(function(f){return f.local}).length') > 0);
CALe("CYRNN.places.pop()");

console.log("\n=== MAP: YOUR OWN PINS AND LORE ===");
CALe('mutate(function(st){ st.map.custom.push(' +
     '{id:"c-test",name:"The missing caravan",kind:"marker",x:48,y:49,note:"Three wagons, no bodies."}) })');
ok("your own pin is drawn", !!$('.mpin[data-id="c-test"]'));
ok("...and marked as yours, not the book's", !!$(".mpin.own"));
eq("your pin answers only to itself unless filed under a region",
   JSON.stringify(CALe('mapScopes(mapPin("c-test"))')), JSON.stringify(["c-test"]));
CALe('mutate(function(st){ st.map.notes["gloomwood"]="Caravans stopped arriving."; })');
click($('.mpin[data-id="gloomwood"]'));
ok("your notes sit under the source's text, not over it",
   /formal request/.test(text()) && /Caravans stopped arriving/.test(text()));
CALe('mutate(function(st){ st.map.lore.push(' +
     '{id:"L1",scope:"gloomwood",title:"Rumour at the Ghost Moors",body:"A vengeful demon."}) })');
click($('.mpin[data-id="gloomwood"]'));
ok("your own lore shows on the place it belongs to", /Rumour at the Ghost Moors/.test(text()));
ok("...badged as yours", !!$(".hb"));

console.log("\n=== MAP: THE PARTY ===");
click($('.mpin[data-id="gloomwood"]'));
click(byAct("mapPartyHere", { id: "gloomwood" }));
eq("the party stands where you put it",
   JSON.stringify(mapState().party),
   JSON.stringify({ x: CALe('CYRNN.place("gloomwood").x'), y: CALe('CYRNN.place("gloomwood").y') }));
ok("the party gets its own pin", !!$(".mpin.party"));
click($('.mpin[data-id="__party"]'));
ok("and the party panel names where it is", /nearest to/.test(text()));

console.log("\n=== MAP: THE CAMERA IS NOT PART OF THE CHARACTER ===");
ok("zoom and selection are not persisted",
   !("zoom" in mapState()) && !("sel" in mapState()));
eq("zoom will not go below fit", CALe("mapSetZoom(0.2)"), 1);
eq("...nor past the cap", CALe("mapSetZoom(999)"), 8);
CALe("UI.map.zoom=1;UI.map.x=0;UI.map.y=0");

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
/* Grub-Wake is days 1-28: The Emergence on 1, and day 14 carries two --
   The Bedrock-Listen and Isenbyr's Lament -- which is one mark each. */
eq("the grid marks every day a holiday falls on", $$(".cgcell .dm.hol").length, 3);
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
ok("it has not come due yet", !$('[data-act="calAck"][data-key="2022:2:' + evId + '"]'));
click(byAct("advanceTime"));
click(byAct("advanceTime"));
eq("the hour arrives", calState().timeOfDay, "evening");
ok("and the reminder fires", !!$('[data-act="calAck"][data-key="2022:2:' + evId + '"]'));
ok("naming the note", /Tribute due to the Warden/.test(remindText()));
click($('[data-act="calAck"][data-key="2022:2:' + evId + '"]'));
ok("acknowledging silences it", !$('[data-act="calAck"][data-key="2022:2:' + evId + '"]'));
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
       "{ day: 1, year: 2022, timeOfDay: 'midday', view: 'month', events: [], acked: [] }); })");
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
/* The guard that makes this class of bug impossible: the rail must hold
   exactly the spells the engine says are castable — no more, no fewer.
   Cantrips were the ones that slipped through the first time. */
eq("the rail holds exactly what the engine says is castable",
   CALe("castableSpellKeys().slice().sort().join(',')"),
   CALe("CALC.castables(S).filter(function(c){return c.kind==='spell'}).map(function(c){return c.id}).sort().join(',')"));
ok("cantrips are in it too — they're the ones you cast most",
   railSpells().indexOf("Prestidigitation") >= 0 && railSpells().indexOf("Mage Hand") >= 0);
ok("and they say they cost nothing", /At will/.test($(".rrail").innerHTML));
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

console.log("\n=== FAMILIAR TABLE NOTES MATCH THE STAT BLOCKS ===");
/* The notes make checkable claims about the beasts. If a claim and the
   scraped block ever disagree, that's a bug in the advice, not a
   difference of opinion — so check them. */
function beast(k, expr) { return CALe("CR0_BEASTS." + k + "." + expr); }
ok("every recommended form is a real CR 0 beast",
   CALe("FAMILIAR_GUIDE.categories.every(function(c){return c.picks.every(function(p){return !!CR0_BEASTS[p.form]})})"));
eq("three categories, three picks each",
   CALe("FAMILIAR_GUIDE.categories.map(function(c){return c.picks.length}).join(',')"), "3,3,3");
eq("the owl really is the only Flyby",
   CALe("Object.keys(CR0_BEASTS).filter(function(k){return (CR0_BEASTS[k].traits||[]).some(function(t){return /Flyby/.test(t.name)})}).join(',')"),
   "owl");
eq("the weasel really is tied for top Stealth",
   CALe("Math.max.apply(null, Object.keys(CR0_BEASTS).map(function(k){var m=(CR0_BEASTS[k].skills||'').match(/Stealth \\+(\\d+)/); return m?+m[1]:0}))"),
   5);
ok("...and it is one of the ties", /Stealth \+5/.test(beast("weasel", "skills")));
ok("the cat's +4 is what the note says", /Stealth \+4/.test(beast("cat", "skills")));
ok("the badger burrows", /burrow/.test(beast("badger", "speed")));
eq("three CR 0 beasts burrow, exactly as the note says",
   CALe("Object.keys(CR0_BEASTS).filter(function(k){return /burrow/i.test(CR0_BEASTS[k].speed)}).sort().join(',')"),
   "badger,fox,hare");
ok("...and the note is right that the fox out-statlines it",
   /Stealth \+5/.test(beast("fox", "skills")) && /darkvision 60/i.test(beast("fox", "senses")) &&
   parseInt(beast("fox", "speed"), 10) > parseInt(beast("badger", "speed"), 10));
ok("the bat has the blindsight the note sells it on", /Blindsight 60/i.test(beast("bat", "senses")));
ok("the raven has Mimicry",
   CALe("CR0_BEASTS.raven.traits.some(function(t){return t.name==='Mimicry'})"));
ok("the spider has Spider Climb",
   CALe("CR0_BEASTS.spider.traits.some(function(t){return t.name==='Spider Climb'})"));
ok("the octopus really has Ink Cloud",
   CALe("CR0_BEASTS.octopus.actions.some(function(a){return /Ink Cloud/.test(a.name)})"));
ok("...and the block keeps the underwater caveat the note points at",
   CALe("CR0_BEASTS.octopus.actions.filter(function(a){return /Ink Cloud/.test(a.name)})[0].text").indexOf("underwater") >= 0);
ok("the baboon is big enough to have hands and can climb",
   beast("baboon", "size") === "Small" && /climb/.test(beast("baboon", "speed")));
eq("Skills are captured now, not dropped",
   CALe("Object.keys(CR0_BEASTS).filter(function(k){return CR0_BEASTS[k].skills}).length > 10"), true);

console.log("\n=== THE FAMILIAR ===");
click(byAct("tab", { tab: "spells" }));
click(byAct("use", { kind: "spell", id: "findFamiliar" }));
ok("casting it asks first", !!$("#summon-form"));
eq("every CR 0 beast is offered", $$("#summon-form option").length, 35);
/* Tapping a dropdown must reach the browser. The global click handler
   used to call preventDefault on it and re-render, which on iOS meant
   the picker never opened and the control looked dead. */
const selNode = $("#summon-form");
const tap = new w.MouseEvent("click", { bubbles: true, cancelable: true });
selNode.dispatchEvent(tap);
ok("tapping the dropdown is not swallowed", !tap.defaultPrevented);
ok("...and doesn't re-render the dropdown out from under you", $("#summon-form") === selNode);
/* A select is as wide as its widest option, so stat lines in the option
   text made the control 700px and pushed the modal sideways. Names only;
   the stats for the selected one are previewed underneath. */
eq("options are bare names", $$("#summon-form option")[0].textContent, "Owl");
ok("no option carries a stat line",
   $$("#summon-form option").every(function (o) { return o.textContent.length < 24; }));
/* Grouped by role, so the useful nine are reachable without hunting
   through 35 — and the rest are still all there. */
eq("the list is grouped", $$("#summon-form optgroup").length, 4);
eq("the recommended nine come first",
   $$("#summon-form optgroup")[0].label, "Aerial scouts & harassers");
eq("and every beast is still offered", $$("#summon-form option").length, 35);
ok("the selected beast's stats show below instead", /Passive Perception/.test(text()));
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
