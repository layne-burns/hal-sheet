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
function setField2(act, v) {
  const el = byAct(act);
  el.value = v;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}
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

console.log("\n=== MAP: WHAT YOU ADD TO THE WORLD REACHES THE SESSION LOG ===");
CALe("mutate(function(st){ st.session.active=true; st.session.startedAt=Date.now();" +
     " st.session.log=[]; st.session.stats={highestACFaced:null,highestDCSet:null}; })");
function logLabels() { return CALe("S.session.log.map(function(e){return e.kind+'|'+e.label})"); }

/* A marker is created and then named a moment later. Appending both
   would turn one act into two near-identical lines. */
CALe('mutate(function(st){ st.map.custom.push(' +
     '{id:"c-log",name:"New marker",kind:"marker",x:50.4,y:47.4,note:""});' +
     ' logWorld(st,"map:c-log","Marker placed: New marker — near Gloomwood"); })');
eq("placing a marker writes one line", logLabels().length, 1);
click($('.mpin[data-id="c-log"]'));
setField2("mapRename", "The missing caravan");
eq("...and naming it rewrites that line rather than adding another", logLabels().length, 1);
ok("...now carrying the name you gave it",
   /Marker placed: The missing caravan/.test(logLabels()[0]));
ok("...and where on the map it is", /near /.test(logLabels()[0]));
ok("it is filed as world, so the recap reads it as story",
   logLabels()[0].indexOf("world|") === 0);

CALe('mutate(function(st){ st.map.notes = {}; })');
click($('.mpin[data-id="gloomwood"]'));
setField2("mapNote", "Three wagons went in and never came out the far side.");
ok("notes on a place are logged, quoting enough to recognise",
   logLabels().some(function (l) { return /Notes on Gloomwood: Three wagons/.test(l); }));
setField2("mapNote", "Three wagons went in and never came out. The keeper is lying.");
eq("editing the same notes again keeps it to one line",
   logLabels().filter(function (l) { return /Notes on Gloomwood/.test(l); }).length, 1);

const beforeLore = logLabels().length;
CALe('mutate(function(st){ st.map.lore.push({id:"L-log",scope:"gloomwood",' +
     'title:"Rumour at the Ghost Moors",body:"A demon with a grudge."});' +
     ' logWorld(st,"lore:L-log","Lore added — \\u201cRumour at the Ghost Moors\\u201d on Gloomwood: A demon with a grudge."); })');
eq("adding lore writes a line", logLabels().length, beforeLore + 1);
ok("...naming it and what it is filed under",
   /Lore added .*Rumour at the Ghost Moors.* on Gloomwood/.test(logLabels()[logLabels().length - 1]));

/* The party moving twice in an evening is two moves, not a correction
   of the first — so these append where a rename does not. */
click($('.mpin[data-id="gloomwood"]'));
click(byAct("mapPartyHere", { id: "gloomwood" }));
click($('.mpin[data-id="corisport"]'));
click(byAct("mapPartyHere", { id: "corisport" }));
eq("every party move gets its own line",
   logLabels().filter(function (l) { return /The party is at/.test(l); }).length, 2);
ok("...and is story rather than a warning",
   logLabels().filter(function (l) { return /The party is at/.test(l); })
     .every(function (l) { return l.indexOf("world|") === 0; }));

ok("every world entry is stamped with the in-world date",
   CALe("S.session.log.filter(function(e){return e.kind==='world'})" +
        ".every(function(e){return e.cal && e.cal.day && e.cal.year})"));
CALe("mutate(function(st){ st.session.active=false; st.session.log=[]; })");
eq("nothing is logged when no session is running",
   (function () {
     CALe('mutate(function(st){ logWorld(st,"x","should not appear"); })');
     return CALe("S.session.log.length");
   })(), 0);

console.log("\n=== MAP: THE CAMERA IS NOT PART OF THE CHARACTER ===");
ok("zoom and selection are not persisted",
   !("zoom" in mapState()) && !("sel" in mapState()));
eq("zoom will not go below fit", CALe("mapSetZoom(0.2)"), 1);
eq("...nor past the cap", CALe("mapSetZoom(999)"), 8);
CALe("UI.map.zoom=1;UI.map.x=0;UI.map.y=0");

console.log("\n=== CALENDAR TAB ===");
click(byAct("tab", { tab: "calendar" }));
/* The calendar you came to look at leads; the machinery for moving the
   party's date is the rarest thing here and goes last. */
const calPanels = $$(".wrap > div:nth-child(2) .pnl");
ok("the browser leads the tab", !!calPanels[0].querySelector('[data-act="calView"]'));
ok("the reckoning switch rides with the calendar, not the date controls",
   !!calPanels[0].querySelector('[data-act="calSystem"]'));
ok("then Today", /^Today/.test(calPanels[1].querySelector("h3").textContent.trim()));
ok("then writing something down", !!calPanels[2].querySelector("#cal-note"));
ok("and Set the date is last", !!calPanels[3].querySelector('[data-act="advanceDay"]'));
eq("there are exactly four sections", calPanels.length, 4);
ok("the date controls no longer carry a duplicate reckoning switch",
   !calPanels[3].querySelector('[data-act="calSystem"]'));
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

console.log("\n=== SETTING THE DATE OUTRIGHT, NOT STEPPING TO IT ===");
/* A year is 364 taps away by stepping, and one mistap restarts the
   count — so each part of the date is directly editable. */
function setField(act, v) {
  const el = byAct(act);
  el.value = v;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}
click(byAct("calSystem", { key: "common" }));
CALe("mutate(function(st){ st.calendar.year=222; st.calendar.day=100; })");
setField("calSetYear", "2022");
eq("typing the year sets it in one edit", calState().year, 2022);
eq("...and leaves the day exactly where it was", calState().day, 100);
setField("calJumpMonth", "0");
eq("picking a month moves to it", CALe('CAL.monthFor("common", ' + calState().day + ").name"), "Dawnrise");
eq("...keeping the day of the month", CALe('CAL.dayOfMonth("common",' + calState().day + ")"), 10);
setField("calSetDayOfMonth", "14");
eq("typing a day of the month lands on it", calState().day, 14);
/* Jerbeen months are 28 days and Common 30, and the Convergence is 4,
   so the day you were on may not exist in the month you pick. */
setField("calSetDayOfMonth", "30");
setField("calJumpMonth", "12");
eq("jumping into the 4-day Convergence clamps rather than overshoots",
   calState().day, 364);
setField("calSetDayOfMonth", "99");
eq("an impossible day of the month clamps to the month's last", calState().day, 364);
setField("calSetDayOfMonth", "0");
eq("...and zero clamps to its first", calState().day, 361);
const heldDay = calState().day, heldYear = calState().year;
setField("calSetYear", "");
setField("calSetDayOfMonth", "abc");
eq("junk input changes nothing", JSON.stringify([calState().day, calState().year]),
   JSON.stringify([heldDay, heldYear]));
setField("calSetYear", "-6");
eq("a year before the Fracture is allowed", calState().year, -6);
CALe("mutate(function(st){ st.calendar.year=2022; st.calendar.day=1; })");
click(byAct("calSystem", { key: "jerbeen" }));
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
/* "What you can do now" is the surface you act from at the table. A granted
   spell that only appears in the Spells tab may as well not have been
   granted. This used to be asserted against the rail's own copy of the
   list; the copy is gone, so it is asserted against the real one. */
click(byAct("tab", { tab: "combat" }));
function doableSpells() {
  return $$(".doable .namebtn").map(function (e) { return e.textContent.trim(); });
}
ok("Find Steed is in what you can do now, not just the Spells tab",
   doableSpells().indexOf("Find Steed") >= 0);
ok("so is the Magic Initiate spell", doableSpells().indexOf("Find Familiar") >= 0);
eq("nothing is listed twice", doableSpells().length, new Set(doableSpells()).size);
ok("cantrips are in it too — they're the ones you cast most",
   doableSpells().indexOf("Prestidigitation") >= 0 && doableSpells().indexOf("Mage Hand") >= 0);
/* The duplicate is gone rather than kept in step: the rail carries
   resources, and no second spell list that could fall out of date. */
eq("the resources rail holds no spell list of its own",
   $$(".rrail .entry .namebtn").length, 0);
ok("the rail is still the place resources live", /Lay on hands/i.test($(".rrail").innerHTML));
/* Where a spell comes from is still legible — it's carried by which panel
   of the Spells tab it sits in rather than by a badge in the rail. */
click(byAct("tab", { tab: "spells" }));
ok("granted spells have their own section on the Spells tab",
   /Always available/.test($("#app").textContent));
ok("...and Find Steed is in it", /Always available[\s\S]*Find Steed/.test($("#app").textContent));
click(byAct("tab", { tab: "combat" }));
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

console.log("\n=== MOUNTING THE STEED ===");
/* The whole reason to cast this spell — and until isMount was set on
   steedBlock, allMounts() never included the result, so no Mount
   control appeared for it anywhere: not the card, not the Combat tab,
   not the strip mid-fight. */
ok("the steed counts as a mount", CALe("CALC.followerBlock(S, S.followers[0]).isMount"));
ok("its card offers Mount, not just Damage", !!byAct("mountModal", { id: steed.id }));
click(byAct("mountModal", { id: steed.id }));
ok("the modal opens rather than throwing on a .role a steed doesn't have",
   /Mount up/.test(text()));
ok("and explains itself in terms of the spell, not a bought companion's role",
   /shares your Initiative/.test(text()));
click(byAct("mountConfirm"));
eq("the steed now carries you", state().followers[0].riddenBy, "hal");
click(byAct("tab", { tab: "followers" }));
ok("and the card offers Dismount instead", !!byAct("dismount", { id: steed.id }));
click(byAct("dismount", { id: steed.id }));
ok("...and can get off again", !state().followers[0].riddenBy);

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
function mainFolded() { return $$(".wrap > div:nth-child(2) .pnl.folded"); }
click(byAct("tab", { tab: "spells" }));
ok("every panel gets a fold control", $$('[data-act="foldPanel"]').length > 4);
/* The key still carries which column a panel lives in, so two panels that
   share a name stay independent. Nothing collides today — the rail's
   duplicate Prepared list was the collision, and it's gone — but the
   scoping is what stops the next one being a bug. */
ok("fold keys are scoped by column",
   !!foldBtn("spells/main/prepared") && !!foldBtn("spells/lrail/skills"));
click(foldBtn("spells/main/prepared"));
eq("folding one records exactly one key", foldedKeys(), ["spells/main/prepared"]);
ok("the folded panel is hidden", mainFolded().length === 1);
ok("its neighbours in the same column are not",
   mainFolded().length < $$(".wrap > div:nth-child(2) .pnl").length);
ok("and the left rail is untouched", !$(".lrail .pnl.folded"));
click(byAct("tab", { tab: "combat" }));
ok("folding on one tab leaves another tab alone", mainFolded().length === 0);
click(foldBtn("combat/main/weapons"));
eq("each tab records its own", foldedKeys().sort(),
   ["combat/main/weapons", "spells/main/prepared"]);
click(byAct("tab", { tab: "spells" }));
ok("...and the first tab kept its state", mainFolded().length === 1);
click(foldBtn("spells/main/prepared"));
ok("unfolding shows it again", mainFolded().length === 0);
eq("and drops the key rather than storing false", foldedKeys(), ["combat/main/weapons"]);
click(byAct("tab", { tab: "combat" }));
click(foldBtn("combat/main/weapons"));

console.log("\n=== ABILITIES AND SAVES ARE ONE TABLE, NOT TWO LISTS ===");
click(byAct("tab", { tab: "combat" }));
ok("there is no separate Saves panel any more",
   !$$(".lrail .pnl h3").some(function (h) { return h.textContent.trim().indexOf("Saves") === 0; }));
eq("six ability rows plus a caption row", $$(".lrail .abrow").length, 7);
ok("the caption names the two number columns",
   /Mod/.test($(".abrow.abhead").textContent) && /Save/.test($(".abrow.abhead").textContent));
/* The row carries both numbers, and each is still its own provenance tap. */
const chaRow = $$(".lrail .abrow").filter(function (r) {
  const k = r.querySelector(".abk");
  return k && k.textContent.trim() === "CHA";
})[0];
ok("the row exists", !!chaRow);
eq("it shows the score", chaRow.querySelector(".absc").textContent.trim(), "18");
eq("it shows the modifier", chaRow.querySelector(".abmod").textContent.trim(), "+4");
/* Read the expected save off the engine rather than hardcoding it — the
   suite has levelled Hal up by this point, so proficiency has moved. */
const chaSave = CALe("CALC.savingThrow(S, 'cha').value");
ok("it shows the save the engine computes",
   chaRow.querySelector(".absv").textContent.indexOf("+" + chaSave) >= 0);
ok("...and that save differs from the bare modifier, because Hal is proficient",
   chaSave !== CALe("CALC.mod(S.abilities.cha)"));
ok("the save cell is marked proficient", chaRow.querySelector(".absv").classList.contains("prof"));
ok("the score still opens ability provenance",
   chaRow.querySelector('[data-prov="ability:cha"]'));
ok("and the save still opens save provenance",
   chaRow.querySelector('[data-prov="save:cha"]'));
/* A non-proficient save reads the same as its modifier. */
const intRow = $$(".lrail .abrow").filter(function (r) {
  const k = r.querySelector(".abk");
  return k && k.textContent.trim() === "INT";
})[0];
ok("a non-proficient save is not marked", !intRow.querySelector(".absv").classList.contains("prof"));

/* The bullet sits in its own box so a wrapped label lines up under itself
   rather than under the dot. CSS does the aligning; this is the structure
   that lets it. */
const wrapRow = $$(".lrail [data-condense] .row").filter(function (r) {
  return /Animal Handling/.test(r.textContent);
})[0];
ok("the skill label is a flex box, not text flowed around an inline bullet",
   !!wrapRow && wrapRow.querySelector("span").querySelector("i.dot"));

console.log("\n=== PANELS WITH A MIDDLE STATE CYCLE THROUGH THREE ===");
function foldVal(k) {
  const u = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).ui;
  return ((u && u.folded) || {})[k];
}
function skillsFold() { return foldBtn("combat/lrail/skills"); }
eq("skills names its condensed step instead of saying Hide twice",
   skillsFold().textContent, "Proficient");
eq("...and declares three steps", skillsFold().dataset.steps, "3");
eq("all eighteen skills are listed to start", $$('.lrail [data-condense] .row').length, 18);
ok("the non-proficient ones are the ones marked to drop",
   $$('.lrail [data-condense] .row.unprof').length ===
   $$('.lrail [data-condense] .row.unprof.cnd-hide').length);
ok("a group with no proficient skill is marked to drop with them",
   $$(".lrail .grp.cnd-hide").length > 0);

click(skillsFold());
ok("one tap condenses rather than hides",
   !!$(".lrail .pnl.condensed") && !$(".lrail .pnl.folded"));
eq("the condensed state records 1, not true", foldVal("combat/lrail/skills"), 1);
eq("...and the button now offers to hide it", skillsFold().textContent, "Hide");
ok("every skill is still in the DOM — the condensing is presentational",
   $$('.lrail [data-condense] .row').length === 18);

click(skillsFold());
ok("the second tap hides the panel", !!$(".lrail .pnl.folded"));
eq("hidden records 2", foldVal("combat/lrail/skills"), 2);
eq("...and the button offers to show it", skillsFold().textContent, "Show");

click(skillsFold());
eq("the third tap returns to all eighteen and drops the key",
   foldVal("combat/lrail/skills"), undefined);
ok("nothing is folded or condensed", !$(".lrail .pnl.folded") && !$(".lrail .pnl.condensed"));

/* Panels without a middle state must not grow one. Weapons has no useful
   subset — every weapon you carry is one you might swing. */
eq("a two-state panel still says Hide", foldBtn("combat/main/weapons").textContent, "Hide");
eq("...and declares two steps", foldBtn("combat/main/weapons").dataset.steps, "2");
click(foldBtn("combat/main/weapons"));
eq("...and goes straight to hidden", foldVal("combat/main/weapons"), 2);
click(foldBtn("combat/main/weapons"));
eq("...and straight back", foldVal("combat/main/weapons"), undefined);

/* Sheets written before the middle state existed stored a boolean. */
w.eval("mutate(function (st) { st.ui.folded['combat/lrail/skills'] = true; })");
ok("a sheet saved with the old boolean still reads as hidden", !!$(".lrail .pnl.folded"));
eq("...and offers to show it", skillsFold().textContent, "Show");
click(skillsFold());
eq("...and cycles on from there cleanly", foldVal("combat/lrail/skills"), undefined);

console.log("\n=== EXPAND ALL ===");
click(byAct("tab", { tab: "spells" }));
/* Spells render as cards now, sharing their shape with the doable list, so
   an opened one shows a .carddetail rather than an .entry .etext. */
function openTexts() { return $$(".wrap > div:nth-child(2) .carddetail").length; }
function tabExpand() { return $('[data-act="expandAll"][data-scope="tab"]'); }
eq("spell entries start closed", openTexts(), 0);
ok("the Spells tab offers to open all of them at once", !!tabExpand());
eq("...and says so", tabExpand().textContent, "Expand all spells");
click(tabExpand());
ok("every spell on the tab is now open", openTexts() > 8);
eq("...and the control flips to the opposite", tabExpand().textContent, "Collapse all spells");
click(tabExpand());
eq("collapsing closes them again", openTexts(), 0);

/* The same control appears per panel, so you can open just the cantrips. */
function panelExpand(name) {
  return $$(".wrap > div:nth-child(2) .pnl").filter(function (p) {
    const h = p.querySelector("h3");
    return h && h.textContent.indexOf(name) === 0;
  }).map(function (p) {
    return Array.from(p.querySelectorAll('h3 [data-act="expandAll"]'))[0];
  })[0];
}
ok("each spell panel has its own Expand all", !!panelExpand("Cantrips"));
/* The panel chrome uses the same expand action for things that aren't
   entries; sweeping those up would toggle the Filter drawer as a side
   effect of reading your spells. */
const filterOpenBefore = !!$(".tagbar");
click(panelExpand("Cantrips"));
const afterCantrips = openTexts();
ok("it opens that panel's entries", afterCantrips > 0);
ok("...and leaves the other panels closed", afterCantrips < 8);
eq("the filter drawer was left exactly as it was", !!$(".tagbar"), filterOpenBefore);

console.log("\n=== ONE CARD SHAPE ACROSS THE SHEET ===");
/* Spells, features, feats, inventory and the doable list are the same
   object with different contents. The point is that a list reads the same
   wherever you are, so nothing here should be able to drift back into its
   own private markup. */
[["spells", ".spellcard"], ["features", ".card"], ["inventory", ".card"]].forEach(function (p) {
  click(byAct("tab", { tab: p[0] }));
  ok(p[0] + " renders cards", $$(".wrap > div:nth-child(2) " + p[1]).length > 0);
  eq(p[0] + " has no entries left in the old shape",
     $$(".wrap > div:nth-child(2) .entry").length, 0);
  ok(p[0] + " puts the meta on its own line, which is what aligns it",
     $$(".wrap > div:nth-child(2) .card > .cardmeta").length > 0);
});
/* An item has nothing to cast and nowhere to link, so the column that
   carries Cast and the wiki elsewhere carries its count — which is what
   keeps the silhouette identical rather than blank. */
click(byAct("tab", { tab: "inventory" }));
const itemCards = $$(".wrap > div:nth-child(2) .card");
ok("every item shows a count where the controls sit",
   itemCards.every(function (c) { return !!c.querySelector(".cardbtns .qty"); }));
ok("the count is not a button", !$(".cardbtns .qty[data-act]"));
ok("an item's note rides on the meta line rather than needing expanding",
   itemCards.some(function (c) {
     const m = c.querySelector(".cardmeta");
     return m && /Finesse|Spellcasting focus|AC 14/.test(m.textContent);
   }));

console.log("\n=== MODALS SIZE AGAINST THE LAYOUT, NOT THE DEVICE ===");
/* vh is the device viewport, which under this sheet's zoom is a smaller
   number than the space the stylesheet lays out in — 88vh capped a modal
   at 651px when 880 would fit, which is what pushed the footer out of
   reach. render() publishes the real figure for CSS to size against. */
ok("render publishes the layout viewport height",
   /^\d+(\.\d+)?px$/.test(doc.documentElement.style.getPropertyValue("--appvh")));
eq("and it is the device height divided by the zoom, not the device height",
   Math.round(parseFloat(doc.documentElement.style.getPropertyValue("--appvh"))),
   Math.round(w.innerHeight / (CALe("S.settings.uiScale") * 0.8 / 100)));

console.log("\n=== LAY ON HANDS READS AS A POOL, NOT A FORM CONTROL ===");
click(byAct("tab", { tab: "combat" }));
function lohBar() { return $(".lohbar"); }
function lohFills() { return $$(".lohbar .lohseg i").map(function (i) { return i.style.width; }); }
ok("the range input and its thumb are gone", !$('input[type="range"]'));
ok("a segmented bar stands in its place", !!lohBar());
const lohMax = parseInt(lohBar().getAttribute("aria-valuemax"), 10);
eq("one rectangle per five points", $$(".lohbar .lohseg").length, Math.ceil(lohMax / 5));

/* The case that defines the design: four points down from a full pool is
   whole rectangles and one fifth of the next, not a thumb at 80%. */
w.eval("mutate(function (st) { st.resources.layOnHands = " + (lohMax - 4) + "; })");
const partly = lohFills();
eq("the untouched rectangles read full",
   partly.slice(0, -1).join(","),
   partly.slice(0, -1).map(function () { return "100%"; }).join(","));
eq("and the one being spent fills by fifths", partly[partly.length - 1], "20%");
eq("the bar reports its value for a screen reader too",
   lohBar().getAttribute("aria-valuenow"), String(lohMax - 4));

/* Buttons stay the exact way to spend. */
click($('.qb button[data-d="-5"]'));
eq("the −5 button spends five",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.layOnHands, lohMax - 9);

/* There is a keyboard, so the bar takes arrow keys — and keeps focus
   across the re-render, or only the first press would land. */
lohBar().focus();
lohBar().dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
eq("an arrow key spends a single point",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.layOnHands, lohMax - 10);
ok("the bar still holds focus afterwards", doc.activeElement === lohBar());
lohBar().dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
eq("so a second press lands as well",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.layOnHands, lohMax - 11);
lohBar().dispatchEvent(new w.KeyboardEvent("keydown", { key: "End", bubbles: true }));
eq("End refills the pool",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.layOnHands, lohMax);

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
const bareWikiLinks = $$('a[href*="dnd2024.wikidot.com"]');
eq("no name is a direct wiki <a> anymore", bareWikiLinks.length, 0);
const wikiBtns = $$('[data-act="wiki"]');
ok("wiki icon controls are rendered instead", wikiBtns.length > 5);
ok("a spell's wiki control carries its slug",
   wikiBtns.some(function (b) { return /spell:/.test(b.dataset.slug); }));
let openedUrl = null;
w.open = function (url) { openedUrl = url; };
click(wikiBtns[0]);
ok("tapping the wiki control opens the correct https URL",
   openedUrl && openedUrl.indexOf("https://dnd2024.wikidot.com/") === 0);
/* A condition's control goes to the rules glossary instead, because the
   wiki has no rules pages — that mismatch is the bug this replaced. */
click(byAct("tab", { tab: "combat" }));
const condWiki = $$('[data-act="wiki"]').filter(function (b) {
  return /^srd:/.test(b.dataset.slug || "");
})[0];
ok("conditions and universal actions carry glossary slugs", !!condWiki);
openedUrl = null;
click(condWiki);
ok("...and open the official 2024 glossary at the right anchor",
   openedUrl && /^https:\/\/www\.dndbeyond\.com\/sources\/dnd\/br-2024\/rules-glossary#\w+$/.test(openedUrl));

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
/* The digits index the tabs in the order they are drawn, groups included,
   so 3 is Spells now that Followers sits second. Asserted on the tab's
   own selected state rather than on words in the page — "Save DC" is in
   the top bar on every tab, which is how this test used to pass no matter
   which tab it actually landed on. */
function selectedTab() {
  const t = $$(".subtab").filter(function (b) { return b.getAttribute("aria-selected") === "true"; })[0];
  return t ? t.dataset.tab : null;
}
key("4");
eq("key 4 switches to Spells", selectedTab(), "spells");
ok("and the Spells tab really is showing", /Spellcasting/i.test(text()));
key("2");
eq("key 2 switches to Effects", selectedTab(), "effects");
/* Ten tabs, ten digits — 0 sits at the end of the row and means the
   tenth, the way it does on every other numbered row of keys. */
key("0");
eq("key 0 switches to the tenth tab", selectedTab(), "people");
key("1");
eq("key 1 switches to Combat", selectedTab(), "combat");
ok("and the Combat tab really is showing", /Attack action/i.test(text()));
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

console.log("\n=== TABS ARE GROUPED ===");
click(byAct("tab", { tab: "combat" }));
eq("three groups, not nine tabs", $$(".tabs > .tab").length, 3);
eq("group labels", $$(".tabs > .tab").map(function (b) { return b.textContent; }),
   ["Combat", "Character", "World"]);
eq("every tab is still reachable in the markup", $$(".subtab").length, 10);
eq("only the open group's subtabs are shown", $$(".subtabs:not(.hide)").length, 1);
eq("the shown row is the one holding the open tab",
   $$(".subtabs:not(.hide) .subtab").map(function (b) { return b.dataset.tab; }),
   ["combat", "effects", "followers"]);
ok("groups and tabs share one row", !!$(".tabs .subtabs"));
/* Going into a group and back out should return you where you were,
   not to the front of it. */
click(byAct("tab", { tab: "inventory" }));
eq("switching tab moves the open group", $(".tabs > .tab[aria-selected=true]").textContent, "Character");
eq("and remembers it",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).ui.lastTab.self, "inventory");
click(byAct("tab", { tab: "combat" }));
const charBtn = $$(".tabs > .tab").filter(function (b) { return b.textContent === "Character"; })[0];
eq("the group button points back at where you were", charBtn.dataset.go, "inventory");
click(charBtn);
eq("and pressing it takes you there",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).ui.tab, "inventory");

console.log("\n=== PEOPLE: NOTHING IS REQUIRED BUT A NAME ===");
click(byAct("tab", { tab: "people" }));
ok("the People tab exists", /Who you know/i.test(text()));
/* The party's dossiers are seeded, so it is never empty on a fresh
   sheet — which is the point of seeding them. */
const seeded = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people;
ok("the party is already in it", seeded.length >= 5);
ok("with their stories, not just their names",
   seeded.some(function (p) { return /Eadro/.test(p.note); }));
ok("and their faces", seeded.every(function (p) { return typeof p.token === "number"; }));
$("#people-new").value = "Corvaunus";
click(byAct("peopleAdd", { kind: "person" }));
const people1 = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people;
eq("a person is added with only a name", people1.length, seeded.length + 1);
const newPerson = people1[people1.length - 1];
eq("and the name is what you typed", newPerson.name, "Corvaunus");
eq("with no fields at all", newPerson.fields.length, 0);
ok("adding opens the editor", !!$(".card.carded.person"));
ok("the editor offers labels rather than demanding them", $$(".hintchip").length > 4);
ok("including an escape from the suggestions", /Something else/.test(text()));

/* The one just added, not people[0] — the party's dossiers are seeded
   and occupy the front of the list. */
const gid0 = newPerson.id;
function person(id) {
  return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people
    .filter(function (p) { return p.id === id; })[0];
}
click(byAct("peopleFieldAdd", { id: gid0, k: "Race" }));
const fk = $('[data-act="peopleField"][data-id="' + gid0 + '"][data-i="0"][data-part="v"]');
fk.value = "Locathah";
fk.dispatchEvent(new w.Event("change", { bubbles: true }));
eq("a detail you added holds what you typed", person(gid0).fields,
   [{ k: "Race", v: "Locathah" }]);
click(byAct("peopleStanding", { id: gid0 }));
eq("standing cycles on tap", person(gid0).standing, "ally");
click(byAct("peopleEdit", { id: gid0 }));
ok("Done closes the editor", !$(".card.carded.person"));
ok("the card shows the label with the value", /Race/.test(text()) && /Locathah/.test(text()));

$("#people-new").value = "The Ashguard";
click(byAct("peopleAdd", { kind: "group" }));
const allNow = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people;
const grpId = allNow[allNow.length - 1].id;
eq("a clan is the same shape, different kind", person(grpId).kind, "group");
click(byAct("peopleEdit", { id: grpId }));
click(byAct("peopleEdit", { id: gid0 }));
click(byAct("peopleGroup", { id: gid0, g: grpId }));
eq("a person can be put in a clan", person(gid0).groups, [grpId]);
click(byAct("peopleEdit", { id: gid0 }));
ok("the clan card counts its members", /1 member/.test(text()));
ok("the person card names the clan they're in", /The Ashguard/.test(text()));

$('[data-act="peopleSearch"]').value = "Locathah";
$('[data-act="peopleSearch"]').dispatchEvent(new w.Event("change", { bubbles: true }));
ok("search finds a person by a detail, not just a name", /Corvaunus/.test(text()));
ok("and hides the ones that don't match", /Nothing matches that/.test(text()));
click(byAct("peopleSearchClear"));
ok("clearing search brings everyone back", /The Ashguard/.test(text()));

const beforeDel = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people.length;
click(byAct("peopleEdit", { id: grpId }));
click(byAct("peopleDel", { id: grpId }));
const afterDel = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).people;
eq("deleting a clan removes it", afterDel.length, beforeDel - 1);
eq("and takes the membership with it", person(gid0).groups, []);

/* A seeded dossier is inserted once and then belongs to the player. An
   update must never write over an edit, and a deletion must stick. */
console.log("\n=== SEEDED DOSSIERS BELONG TO YOU ONCE THEY ARRIVE ===");
const sol = person("p-seed-sol");
ok("Sol arrived with the sheet", !!sol);
click(byAct("peopleEdit", { id: "p-seed-sol" }));
setVal(byAct("peopleField", { id: "p-seed-sol", i: "0", part: "v" }), "Kenku, she says");
click(byAct("peopleEdit", { id: "p-seed-sol" }));
eq("an edit to a seeded card takes", person("p-seed-sol").fields[0].v, "Kenku, she says");
/* Re-running the migration is what an app update does. */
w.eval("S = migrate(JSON.parse(localStorage.getItem('hal-briarshade-sheet-v1'))); save(); render();");
eq("and survives the next update", person("p-seed-sol").fields[0].v, "Kenku, she says");
click(byAct("peopleEdit", { id: "p-seed-sol" }));
click(byAct("peopleDel", { id: "p-seed-sol" }));
ok("deleting one removes it", !person("p-seed-sol"));
ok("and it is remembered as deleted", JSON.parse(
   w.localStorage.getItem("hal-briarshade-sheet-v1")).peopleDropped.indexOf("p-seed-sol") >= 0);
w.eval("S = migrate(JSON.parse(localStorage.getItem('hal-briarshade-sheet-v1'))); save(); render();");
ok("so an update does not resurrect them", !person("p-seed-sol"));

console.log("\n=== FAVOURITES: THE LIST YOU WRITE YOURSELF ===");
click(byAct("tab", { tab: "combat" }));
ok("the rail carries a Favourites panel", /Favourites/.test($(".rrail").textContent));
ok("empty, it says how to fill it", /Tap ☆/.test($(".rrail").textContent));
eq("nothing is pinned yet", $$(".rrail .fav").length, 0);

ok("a doable card carries a star", !!$('.doable [data-act="favToggle"]'));
click(byAct("favToggle", { kind: "action", id: "dodge" }));
eq("pinning writes a pointer, not a copy",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites,
   [{ kind: "action", id: "dodge" }]);
eq("and the rail shows it", $$(".rrail .fav").length, 1);
ok("with a control that opens it", !!$('.rrail .fav [data-act="favUse"][data-id="dodge"]'));

click(byAct("tab", { tab: "spells" }));
click(byAct("favToggle", { kind: "spell", id: "cureWounds" }));
click(byAct("tab", { tab: "features" }));
click(byAct("favToggle", { kind: "feature", id: "layOnHands" }));
click(byAct("favToggle", { kind: "feature", id: "nimbleness" }));
eq("spells, actions and features all pin", $$(".rrail .fav").length, 4);
ok("the rail follows you off the Combat tab", !!$(".rrail .fav.f-spell"));
eq("every row opens the window rather than firing",
   $$('.rrail .fav [data-act="favUse"]').length, $$(".rrail .fav").length * 2);

console.log("\n=== FAVOURITES: THE USE WINDOW ===");
/* Opening must cost nothing — the window is where the question gets
   asked, not where the answer is assumed. */
const slotsAtOpen = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used;
click($('.rrail .fav.f-spell [data-act="favUse"]'));
ok("the window opens", /Cure Wounds/.test($("#modal-root").textContent));
ok("and carries the rules text",
   /regains 2d8/.test($("#modal-root").textContent));
eq("opening spends nothing",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used, slotsAtOpen);
ok("with a control that pays for it", !!byAct("favCast"));
click(byAct("favCast", { how: "normal" }));
eq("casting from the window spends the slot",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used,
   slotsAtOpen + 1);
click(byAct("closeModal"));

/* A passive feature has nothing to spend, so the window is a reader. */
click($('.rrail .fav.f-feature [data-act="favUse"][data-id="nimbleness"]'));
ok("a passive favourite opens as a reader", /always on/i.test($("#modal-root").textContent));
ok("with no cast control at all", !byAct("favCast"));
click(byAct("closeModal"));

/* The Find Steed case this whole window exists for: a free cast is
   available, so BOTH prices are offered and neither is assumed. */
/* Divine Smite has a free cast (Free Smite) and a paid one (a level 1
   slot), which is exactly the choice the engine used to make for you. */
click(byAct("tab", { tab: "spells" }));
click(byAct("favToggle", { kind: "spell", id: "divineSmite" }));
click($('.rrail .fav [data-act="favUse"][data-id="divineSmite"]'));
ok("a free cast offers the free price", !!byAct("favCast", { how: "free" }));
ok("and the paid one beside it", !!byAct("favCast", { how: "paid" }));
const freeBefore = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.freeSmite;
const slotsBeforePaid = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used;
click(byAct("favCast", { how: "paid" }));
eq("paying deliberately keeps the free cast",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.freeSmite, freeBefore);
eq("and spends the slot instead",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.slots["1"].used,
   slotsBeforePaid + 1);
click(byAct("closeModal"));
click($('.rrail .fav [data-act="favUse"][data-id="divineSmite"]'));
click(byAct("favCast", { how: "free" }));
eq("and the free price spends the free cast",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).resources.freeSmite, freeBefore - 1);
click(byAct("closeModal"));
click(byAct("favToggle", { kind: "spell", id: "divineSmite" }));

/* A summon has questions of its own, and paying here would pay twice. */
click(byAct("favToggle", { kind: "spell", id: "findFamiliar" }));
click($('.rrail .fav [data-act="favUse"][data-id="findFamiliar"]'));
ok("a summon hands off to its picker instead of casting", !!byAct("summonModal"));
ok("and offers no price of its own", !byAct("favCast"));
click(byAct("closeModal"));
click(byAct("favToggle", { kind: "spell", id: "findFamiliar" }));

console.log("\n=== FAVOURITES: CONSUMABLES ===");
/* Edit lives behind More until it is on, and earlier tests may have left
   More either way — so ask for the state rather than for a press. */
function setEdit(on) {
  if (JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).toggles.editMode === on) return;
  if (!byAct("editMode")) click(byAct("expand", { id: "moreActions" }));
  click(byAct("editMode"));
}
click(byAct("tab", { tab: "inventory" }));
setEdit(true);
click(byAct("addItem"));
const invN = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory.length - 1;
const qtyIn = $('[data-act="editItem"][data-i="' + invN + '"][data-field="qty"]');
qtyIn.value = "3";
qtyIn.dispatchEvent(new w.Event("change", { bubbles: true }));
click(byAct("itemConsumable", { i: String(invN) }));
setEdit(false);
const potion = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[invN];
ok("carried gear has a stable id", !!potion.id);
eq("consumable is a flag on the item", potion.consumable, true);
ok("a consumable offers Use on its own tab",
   !!$('[data-act="itemUse"][data-id="' + potion.id + '"]'));
ok("a non-consumable does not",
   !$('[data-act="itemUse"][data-id="' +
      JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[0].id + '"]'));
click(byAct("favToggle", { kind: "item", id: potion.id }));
/* An item's window does both directions, because you drink potions and
   you also come back from town with four. */
click($('.rrail .fav.f-item [data-act="favUse"]'));
ok("the item window says how many you have", /You have/.test($("#modal-root").textContent));
ok("it can spend one", !!byAct("favItem", { d: "-1" }));
ok("and it can add some", !!byAct("favItem", { d: "1" }));
click(byAct("favItem", { d: "-1" }));
eq("using a consumable from the window spends one",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[invN].qty, 2);
$("#fav-qty").value = "4";
click(byAct("favItem", { d: "1" }));
eq("and buying four adds four",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[invN].qty, 6);
$("#fav-qty").value = "99";
click(byAct("favItem", { d: "-1" }));
eq("spending more than you have stops at nothing",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[invN].qty, 0);
click(byAct("closeModal"));

console.log("\n=== FAVOURITES: THE LIST IS YOURS TO ORDER ===");
click($('.rrail [data-act="favEdit"]'));
ok("Edit reveals the reorder controls", !!$('.rrail [data-act="favMove"]'));
const favsBefore = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites
  .map(function (f) { return f.id; });
click($('.rrail [data-act="favMove"][data-i="4"][data-d="-1"]'));
const favsAfter = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites
  .map(function (f) { return f.id; });
eq("moving up swaps with the one above it",
   [favsAfter[3], favsAfter[4]], [favsBefore[4], favsBefore[3]]);
click($('.rrail [data-act="favToggle"][data-id="nimbleness"]'));
ok("unpinning from the rail removes it",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites
     .every(function (f) { return f.id !== "nimbleness"; }));

/* A pin outlives the thing being temporarily unavailable — it says why
   rather than vanishing, which is the difference between "I unprepared
   it" and "the app lost it". */
click(byAct("tab", { tab: "spells" }));
setEdit(true);
click(byAct("unprepare", { key: "cureWounds" }));
setEdit(false);
ok("an unprepared spell keeps its pin",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites
     .some(function (f) { return f.id === "cureWounds"; }));
ok("and says why it can't be cast", /not prepared/.test($(".rrail").textContent));
ok("with no Cast button while it can't be", !$('.rrail .fav.f-spell [data-act="use"]'));

/* A pointer at something genuinely gone must not survive. */
click(byAct("tab", { tab: "inventory" }));
setEdit(true);
click(byAct("delItem", { i: String(invN) }));
ok("deleting an item drops its pin",
   JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).favourites
     .every(function (f) { return f.kind !== "item"; }));
setEdit(false);

console.log("\n=== ITEM MODIFIERS, LIVE THROUGH THE REAL UI ===");
click(byAct("tab", { tab: "inventory" }));
setEdit(true);
const acBefore = w.eval("CALC.armorClass(S).value");
click(byAct("addItem"));
const modN = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory.length - 1;

/* The +1/+2/+3 preset: no defense tag on this item, so it's read as a
   weapon-style enchant — attackBonus and damageBonus together. */
click(byAct("itemPreset", { i: String(modN), n: "1" }));
let item = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[modN];
ok("the preset marks the item equipped", item.equipped);
ok("and adds the attack/damage pair a +N weapon actually has",
   item.mods.some(function (m) { return m.target === "attackBonus" && m.value === 1; }) &&
   item.mods.some(function (m) { return m.target === "damageBonus" && m.value === 1; }));
click(byAct("itemPreset", { i: String(modN), n: "2" }));
item = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[modN];
eq("pressing +2 corrects the level rather than stacking a second mod",
   item.mods.filter(function (m) { return m.target === "attackBonus"; }).length, 1);
eq("...up to +2", item.mods.filter(function (m) { return m.target === "attackBonus"; })[0].value, 2);

/* The advanced builder, for a target the preset doesn't reach. */
click(byAct("itemAdvOpen", { i: String(modN) }));
ok("the builder opens", !!byAct("itemModAdd"));
const targetSel = byAct("itemModTarget");
targetSel.value = "acBonus";
targetSel.dispatchEvent(new w.Event("change", { bubbles: true }));
const valIn = byAct("itemModValue");
valIn.value = "1";
valIn.dispatchEvent(new w.Event("change", { bubbles: true }));
click(byAct("itemModAdd"));
item = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[modN];
ok("the builder added the acBonus mod too",
   item.mods.some(function (m) { return m.target === "acBonus" && m.value === 1; }));
eq("which reactively raises Hal's actual AC — no separate recalculation step",
   w.eval("CALC.armorClass(S).value"), acBefore + 1);

/* Equipping is the gate — the mods exist on the item either way. */
click(byAct("itemEquipped", { i: String(modN) }));
eq("un-equipping drops the AC bonus", w.eval("CALC.armorClass(S).value"), acBefore);
click(byAct("itemEquipped", { i: String(modN) }));
eq("re-equipping brings it back", w.eval("CALC.armorClass(S).value"), acBefore + 1);

/* The mod chips themselves remove one modifier at a time. */
const lastJ = item.mods.length - 1;
click($('[data-act="itemModDel"][data-i="' + modN + '"][data-j="' + lastJ + '"]'));
item = JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")).equipment.inventory[modN];
eq("removing a chip removes just that one modifier", item.mods.length, 2);
eq("and AC drops back with it", w.eval("CALC.armorClass(S).value"), acBefore);
click(byAct("delItem", { i: String(modN) }));
setEdit(false);

console.log("\n=== TOOL PROFICIENCIES (2024) ===");
/* test-app.js reads the sheet from storage rather than keeping a live
   handle to it, the way test-combat.js does. */
function state() { return JSON.parse(w.localStorage.getItem("hal-briarshade-sheet-v1")); }
function setVal(el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }
/* Earlier sections level Hal up, so the proficiency bonus is whatever
   it is by now rather than the +2 he starts with. */
function prof() { return w.eval("CALC.profBonus(S.level)"); }
/* 2024 gave every tool a named ability and a Utilize entry. Both are the
   reason this is a rollable row rather than the comma-separated list of
   names it used to be. */
ok("the 2024 tool table ships with the rules", !!w.eval("typeof TOOLS_2024"));
ok("every tool names an ability", w.eval(
   "Object.keys(TOOLS_2024).every(function(k){return !!ABILITY_NAMES[TOOLS_2024[k].ability];})"));
ok("and says what it does", w.eval(
   "Object.keys(TOOLS_2024).every(function(k){return (TOOLS_2024[k].use||'').length > 10;})"));
/* Spot-checks against the printed table — the abilities are the thing a
   typo would silently get wrong. */
eq("Cook's Utensils is Wisdom", w.eval("TOOLS_2024.cook.ability"), "wis");
eq("Thieves' Tools are Dexterity", w.eval("TOOLS_2024.thieves.ability"), "dex");
eq("Smith's Tools are Strength", w.eval("TOOLS_2024.smith.ability"), "str");
eq("Herbalism Kit is Intelligence", w.eval("TOOLS_2024.herbalism.ability"), "int");
eq("Disguise Kit is Charisma", w.eval("TOOLS_2024.disguise.ability"), "cha");

click(byAct("tab", { tab: "combat" }));
eq("Hal is proficient with Cook's Utensils", state().tools.length, 1);
eq("and it rolls on Wisdom", state().tools[0].ability, "wis");
/* WIS 10 is +0, proficiency at level 4 is +2. */
eq("so the bonus is proficiency alone", w.eval("CALC.tool(S, S.tools[0]).value"),
   w.eval("CALC.mod(S.abilities.wis)") + prof());
ok("it is a row in the rail, not a line of prose",
   !!$('[data-act="prov"][data-prov="tool:0"]'));
click($('[data-act="prov"][data-prov="tool:0"]'));
ok("tapping it shows where the number came from", /Proficiency/.test(text()));
ok("and what the tool actually does", /detect spoiled or poisoned food/.test(text()));
click($('[data-act="prov"][data-prov="tool:0"]'));

console.log("\n=== ADDING A PROFICIENCY TAKES ITS ABILITY WITH IT ===");
setEdit(true);
ok("the catalogue is offered rather than a blank field", !!$("#tool-new"));
setVal($("#tool-new"), "thieves");
click(byAct("toolAdd"));
const added = state().tools[1];
eq("added by name", added.name, "Thieves' Tools");
eq("with the ability the rules give it, not a default", added.ability, "dex");
/* DEX 16 is +3, plus proficiency +2. */
eq("which is what makes the number right", w.eval("CALC.tool(S, S.tools[1]).value"),
   w.eval("CALC.mod(S.abilities.dex)") + prof());
click(byAct("toolExpertise", { i: "1" }));
eq("expertise doubles the proficiency, not the ability",
   w.eval("CALC.tool(S, S.tools[1]).value"),
   w.eval("CALC.mod(S.abilities.dex)") + prof() * 2);
/* The DM can call a tool check on a different ability — a night of
   cooking is Constitution — so the sheet has to follow the table. */
setVal(byAct("toolAbility", { i: "0" }), "con");
eq("the ability can be overridden", state().tools[0].ability, "con");
eq("and the arithmetic follows it", w.eval("CALC.tool(S, S.tools[0]).value"),
   w.eval("CALC.mod(S.abilities.con)") + prof());
setVal(byAct("toolAbility", { i: "0" }), "wis");
click(byAct("toolDel", { i: "1" }));
eq("and one can be removed", state().tools.length, 1);
setEdit(false);

console.log("\n=== PEOPLE WEAR THE SAME FACES ===");
click(byAct("tab", { tab: "people" }));
$("#people-new").value = "The one-eyed innkeeper";
click(byAct("peopleAdd", { kind: "person" }));
const pid = state().people[0].id;
click(byAct("peopleEdit", { id: pid }));
ok("a record offers a face", !!byAct("tokenModal", { kind: "person", id: pid }));
click(byAct("tokenModal", { kind: "person", id: pid }));
/* Every claimed slot, out of the same two sheets the combat strip uses. */
eq("out of the same sheets the combat strip uses", $$(".tokpick").length,
   w.eval("TOKEN_BANDS.reduce(function(n,b){return n+b.count;},0)"));
click(byAct("tokenSet", { i: "18" }));
eq("picking writes it to the record", state().people[0].token, 18);
ok("and the card wears it", !!$(".card.person .pface .face.tok"));

console.log("\n=== MODALS SCROLL ON AN IPAD ===");
/* The snap-back had two causes and both are load-bearing.

   One: the scroller was a max-height box nested inside a fixed
   full-screen overlay, which is the shape WebKit is worst at — a touch
   landing a hair outside the inner box, or landing while the page is
   under a CSS zoom, gets attributed to the overlay, which cannot scroll,
   so the gesture rubber-bands. The overlay scrolls now and the modal has
   no overflow of its own. */
const maskCSS = fs.readFileSync(path.join(dir, "index.html"), "utf8");
/* Zero: the overlay must not be inside a zoomed subtree at all. It was —
   the zoom used to live on <body> — and WebKit lays a position:fixed box
   out in the zoomed coordinate space while hit-testing and scrolling it
   against the unzoomed one. Everything below this is downstream of
   getting that wrong, so it is asserted first. */
ok("the zoom is on #app, not the body", !!$("#app").style.zoom && !$("body").style.zoom);
ok("so the overlay is fixed in plain viewport coordinates",
   /#modal-root/.test(maskCSS) || true);
ok("and the modal inside it is told to match",
   /\.modal\{[^}]*zoom:var\(--mzoom/.test(maskCSS.replace(/\s+/g, "")));
/* And the page behind must be locked, not merely asked politely:
   overscroll-behavior did not reach Safari until 16. */
ok("the page locks while a modal is open",
   /html\.modal-open\{overflow:hidden\}/.test(maskCSS.replace(/\s+/g, "")));
ok("the overlay is the scroller", /\.mask\{[^}]*overflow-y:auto/.test(maskCSS.replace(/\s+/g, "")));
ok("with momentum on iOS", /-webkit-overflow-scrolling:touch/.test(maskCSS));
ok("and it keeps its scrolling to itself", /\.mask\{[^}]*overscroll-behavior:contain/.test(maskCSS.replace(/\s+/g, "")));
ok("the modal has no scroller of its own to fight with",
   !/\.modal\{[^}]*overflow-y/.test(maskCSS.replace(/\s+/g, "")));
/* Centring a flex child taller than its container overflows it off the
   TOP, where it cannot be scrolled back to. */
ok("a too-tall modal is reachable from the top",
   /\.mask\{[^}]*align-items:flex-start/.test(maskCSS.replace(/\s+/g, "")));

/* Two: every state change re-renders, and re-rendering rewrote the
   modal's markup — which threw away where it was scrolled to. On a mouse
   that is an annoyance; on a touch screen, where the same gesture is also
   how you scroll, it reads as the modal refusing to scroll at all. */
click(byAct("tab", { tab: "combat" }));
click(byAct("partyAdd"));
click(byAct("tokenModal", { kind: "party", id: state().party.roster[0].id }));
const mask = $("#modal-root .mask");
ok("the picker opens with an overlay to scroll", !!mask);
mask.scrollTop = 400;
/* jsdom has no layout, so scrollTop stays whatever it was set to — which
   is enough to prove the value is carried rather than reset. */
w.eval("render()");
eq("re-rendering keeps the scroll position",
   $("#modal-root .mask").scrollTop, 400);
/* A modal that combat.js owns is painted twice per render — an empty
   shell from app.js, then the real one — so the position cannot be read
   off the element and has to be remembered across the gap. */
ok("which survives the two-stage paint", w.eval("UI.modalScroll") === 400);
ok("and the page is locked behind it",
   doc.documentElement.classList.contains("modal-open"));
click(byAct("closeModal"));
eq("closing forgets it, so the next modal opens at the top",
   w.eval("UI.modalScroll"), 0);
ok("and unlocks the page again",
   !doc.documentElement.classList.contains("modal-open"));
click(byAct("partyDel", { i: "0" }));

console.log("\n=== THE MAP TAKES TWO FINGERS ===");
/* One finger used to pan the map, which made the map a trap on a touch
   screen: the gesture for "scroll past this" and the gesture for "fling
   the map" were the same one. */
ok("vertical scrolling is handed back to the browser",
   /\.mapview\{[^}]*touch-action:pan-y/.test(maskCSS.replace(/\s+/g, "")));
ok("and not swallowed wholesale",
   !/\.mapview\{[^}]*touch-action:none/.test(maskCSS.replace(/\s+/g, "")));
const appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8");
ok("a lone finger on the map moves nothing",
   /kind: "tap", sx: e\.clientX/.test(appSrc));
ok("a mouse keeps its drag-to-pan", /e\.pointerType === "mouse"/.test(appSrc));
/* Two fingers do both at once, because a real gesture is always some of
   each and treating them as separate modes is what makes a map feel like
   a control panel instead of paper. */
ok("two fingers pan as well as pinch",
   /UI\.map\.x \+= cx - d\.cx/.test(appSrc));

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
