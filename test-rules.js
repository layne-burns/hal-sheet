/* Unit tests for the rules layer. Run: node test-rules.js
   These assert Hal's sheet values against 2024 RAW. */

const R = require("./rules.js");
const { CALC, SEED, PALADIN_TABLE, SPELLS, FEATURES, WEAPONS } = R;

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + "\n         got:  " + JSON.stringify(got) +
                             "\n         want: " + JSON.stringify(want)); }
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

console.log("\n=== ABILITY / PROFICIENCY MATH ===");
eq("mod(9) = -1", CALC.mod(9), -1);
eq("mod(10) = 0", CALC.mod(10), 0);
eq("mod(16) = +3", CALC.mod(16), 3);
eq("mod(18) = +4", CALC.mod(18), 4);
eq("prof at level 1-4 = 2", [1,2,3,4].map(CALC.profBonus), [2,2,2,2]);
eq("prof at level 5-8 = 3", [5,6,7,8].map(CALC.profBonus), [3,3,3,3]);
eq("prof at 9/13/17 = 4/5/6", [9,13,17].map(CALC.profBonus), [4,5,6]);
eq("prof at level 20 = 6", CALC.profBonus(20), 6);

const S = clone(SEED);

console.log("\n=== HAL'S DERIVED STATS (level 4) ===");
eq("AC = 16 (scale mail 14 + DEX capped 2)", CALC.armorClass(S).value, 16);
eq("AC flags stealth disadvantage", CALC.armorClass(S).stealthDis, true);
eq("spell save DC = 14", CALC.spellSaveDC(S).value, 14);
eq("spell attack = +6", CALC.spellAttack(S).value, 6);
eq("initiative = +3", CALC.initiative(S).value, 3);
eq("max HP = 35", CALC.maxHP(S).value, 35);
eq("hit dice = 4", CALC.hitDice(S).value, 4);
eq("Lay on Hands max = 20", CALC.layOnHandsMax(S).value, 20);
eq("Channel Divinity max = 2", CALC.channelDivinityMax(S).value, 2);
eq("prepared max = 5", CALC.preparedMax(S).value, 5);
eq("slots = 3x 1st", CALC.slotsMax(S), { 1: 3 });
eq("seeded prepared list has 5", S.preparedSpells.length, 5);

console.log("\n=== SAVING THROWS (the corrected values) ===");
eq("STR save = -1", CALC.savingThrow(S, "str").value, -1);
eq("DEX save = +3", CALC.savingThrow(S, "dex").value, 3);
eq("CON save = +1", CALC.savingThrow(S, "con").value, 1);
eq("INT save = 0", CALC.savingThrow(S, "int").value, 0);
eq("WIS save = +2 (proficient)", CALC.savingThrow(S, "wis").value, 2);
eq("CHA save = +6 (proficient, was +5 on the PDF)", CALC.savingThrow(S, "cha").value, 6);
eq("CHA save provenance names the feat",
   CALC.savingThrow(S, "cha").sources.some(s => /Telepathic/.test(s.label)), true);

console.log("\n=== TOGGLES ===");
const T = clone(S); T.toggles.takeHeart = true;
eq("Take Heart flags advantage on STR saves", CALC.savingThrow(T, "str").advantage, "Take Heart");
eq("Take Heart does not touch DEX saves", CALC.savingThrow(T, "dex").advantage, null);
eq("Take Heart does not change the STR number", CALC.savingThrow(T, "str").value, -1);

const A = clone(S); A.toggles.auraOfProtection = true;
eq("Aura toggle is inert at level 4 (feature is level 6)", CALC.savingThrow(A, "dex").value, 3);
const A6 = clone(S); A6.level = 6; A6.features.push("auraOfProtection"); A6.toggles.auraOfProtection = true;
eq("Aura adds CHA at level 6", CALC.savingThrow(A6, "dex").value, 3 + 4);
eq("Aura appears in provenance at 6",
   CALC.savingThrow(A6, "dex").sources.some(s => /Aura/.test(s.label)), true);
const A6off = clone(A6); A6off.toggles.auraOfProtection = false;
eq("Aura off = no bonus", CALC.savingThrow(A6off, "dex").value, 3);

console.log("\n=== SKILLS (corrected set) ===");
eq("proficient skills", S.skillProficiencies.sort(),
   ["deception","insight","intimidation","persuasion"]);
eq("no expertise", S.skillExpertise, []);
eq("Persuasion = +6 (CHA 4 + prof 2)", CALC.skill(S, "persuasion").value, 6);
eq("Insight = +2 (WIS 0 + prof 2)", CALC.skill(S, "insight").value, 2);
eq("Stealth = +3 (DEX, unproficient)", CALC.skill(S, "stealth").value, 3);
eq("Arcana = 0 (dropped, unproficient)", CALC.skill(S, "arcana").value, 0);

console.log("\n=== HP ROLL HOUSE RULE (+1 unless you rolled a 10) ===");
eq("roll 1 -> 2", CALC.adjustHPRoll(1), 2);
eq("roll 5 -> 6", CALC.adjustHPRoll(5), 6);
eq("roll 9 -> 10", CALC.adjustHPRoll(9), 10);
eq("roll 10 -> 10 (no bonus)", CALC.adjustHPRoll(10), 10);
eq("out-of-range 12 clamps to 10", CALC.adjustHPRoll(12), 10);
eq("out-of-range 0 clamps to 1 then +1 = 2", CALC.adjustHPRoll(0), 2);

console.log("\n=== CONCENTRATION DC (10 or half damage, whichever is higher) ===");
eq("1 damage -> DC 10", CALC.concentrationDC(1), 10);
eq("19 damage -> DC 10", CALC.concentrationDC(19), 10);
eq("20 damage -> DC 10", CALC.concentrationDC(20), 10);
eq("21 damage -> DC 10", CALC.concentrationDC(21), 10);
eq("22 damage -> DC 11", CALC.concentrationDC(22), 11);
eq("25 damage -> DC 12", CALC.concentrationDC(25), 12);
eq("50 damage -> DC 25", CALC.concentrationDC(50), 25);

console.log("\n=== ATTACK ACTION / WEAPON MASTERY ===");
const atk = CALC.attackAction(S);
eq("three weapons listed", atk.rows.length, 3);
eq("shortsword to-hit +5", atk.rows[0].toHit, 5);
eq("shortsword damage 1d6+3", atk.rows[0].damage, "1d6+3");
eq("scimitar to-hit +5", atk.rows[1].toHit, 5);
eq("hand crossbow to-hit +5", atk.rows[2].toHit, 5);
eq("shortsword mastery active", atk.rows[0].masteryActive, true);
eq("scimitar mastery active", atk.rows[1].masteryActive, true);
eq("hand crossbow mastery INACTIVE", atk.rows[2].masteryActive, false);
eq("exactly 2 masteries active", atk.rows.filter(r => r.masteryActive).length, 2);
eq("at level 4, 1 main attack", atk.mainAttacks, 1);
eq("sequence = 1 main + Nick extra", atk.seq.length, 2);
eq("Nick keeps the bonus action free", atk.bonusActionFree, true);
eq("step 2 is the Nick scimitar", atk.seq[1].row.id, "scimitar");

const noNick = clone(S); noNick.equipment.activeMasteries = ["shortsword", "handCrossbow"];
eq("without Nick, bonus action is consumed", CALC.attackAction(noNick).bonusActionFree, false);

const L5 = clone(S); L5.level = 5; L5.features.push("extraAttack");
const atk5 = CALC.attackAction(L5);
eq("level 5 gives 2 main attacks", atk5.mainAttacks, 2);
eq("level 5 sequence = 2 main + Nick = 3", atk5.seq.length, 3);
eq("level 5 to-hit rises to +6 (prof 3)", atk5.rows[0].toHit, 6);

console.log("\n=== FEATURE GATING ===");
eq("Extra Attack not available at 4", CALC.hasFeature(S, "extraAttack"), false);
eq("Aura of Protection not available at 4", CALC.hasFeature(S, "auraOfProtection"), false);
eq("Lay on Hands available at 4", CALC.hasFeature(S, "layOnHands"), true);
eq("Nature's Wrath available at 4", CALC.hasFeature(S, "naturesWrath"), true);
eq("active feature list excludes locked ones",
   CALC.activeFeatures(L5).indexOf("auraOfProtection"), -1);

console.log("\n=== LEVEL-UP ENGINE ===");
const up = CALC.levelUpPreview(S);
eq("next level is 5", up.nextLevel, 5);
eq("no feat prompt at 5", up.needsFeat, false);
eq("one new prepared spell at 5", up.newSpellCount, 1);
eq("Extra Attack announced", up.gains.some(g => /Extra Attack/.test(g.text)), true);
eq("Faithful Steed announced", up.gains.some(g => /Faithful Steed/.test(g.text)), true);
eq("Lay on Hands 20 -> 25 announced", up.gains.some(g => /Lay On Hands pool 20 to 25/.test(g.text)), true);
eq("prof +2 -> +3 announced", up.gains.some(g => /Proficiency Bonus \+2 to \+3/.test(g.text)), true);
eq("2nd level slots announced", up.gains.some(g => /Level 2 spell slots 0 to 2/.test(g.text)), true);
eq("oath spells announced", up.gains.some(g => /Misty Step, Moonbeam/.test(g.text)), true);

const S7 = clone(S); S7.level = 7;
eq("feat prompt at 8", CALC.levelUpPreview(S7).needsFeat, true);
const S19 = clone(S); S19.level = 20;
eq("no level-up past 20", CALC.levelUpPreview(S19), null);

console.log("\n=== PALADIN TABLE INTEGRITY (vs 2024 SRD) ===");
eq("level 4 prepared = 5", PALADIN_TABLE[4].prepared, 5);
eq("level 5 prepared = 6", PALADIN_TABLE[5].prepared, 6);
eq("level 9 prepared = 9", PALADIN_TABLE[9].prepared, 9);
eq("level 20 prepared = 15", PALADIN_TABLE[20].prepared, 15);
eq("level 5 slots", PALADIN_TABLE[5].slots, { 1:4, 2:2 });
eq("level 9 slots", PALADIN_TABLE[9].slots, { 1:4, 2:3, 3:2 });
eq("level 17 slots", PALADIN_TABLE[17].slots, { 1:4, 2:3, 3:3, 4:3, 5:1 });
eq("CD is 3 from level 11", PALADIN_TABLE[11].cd, 3);
eq("CD is 2 at level 10", PALADIN_TABLE[10].cd, 2);
eq("table has 21 rows (null + 1-20)", PALADIN_TABLE.length, 21);
let tableOk = true;
for (let i = 1; i <= 20; i++) { if (PALADIN_TABLE[i].lvl !== i) tableOk = false; }
eq("every row's lvl matches its index", tableOk, true);

console.log("\n=== DATA INTEGRITY ===");
eq("every prepared spell exists", S.preparedSpells.every(k => !!SPELLS[k]), true);
eq("every cantrip exists", S.cantrips.every(k => !!SPELLS[k]), true);
eq("magic initiate spell exists", !!SPELLS[S.magicInitiate.spell], true);
eq("every feature key exists", S.features.every(k => !!FEATURES[k]), true);
eq("every weapon key exists", S.equipment.weapons.every(k => !!WEAPONS[k]), true);
eq("active masteries are all owned weapons",
   S.equipment.activeMasteries.every(k => S.equipment.weapons.indexOf(k) >= 0), true);
eq("active masteries within the limit of 2", S.equipment.activeMasteries.length <= 2, true);
const allOath = Object.keys(R.OATH_SPELLS).reduce((a, k) => a.concat(R.OATH_SPELLS[k]), []);
eq("every oath spell exists", allOath.every(k => !!SPELLS[k]), true);
eq("every paladin list spell exists",
   [1,2].every(l => R.PALADIN_SPELL_LIST[l].every(k => !!SPELLS[k])), true);
eq("every spell has mechanics text",
   Object.keys(SPELLS).every(k => SPELLS[k].text && SPELLS[k].text.length > 20), true);
eq("every feat has text", Object.keys(R.FEATS).every(k => R.FEATS[k].text.length > 20), true);
eq("Shield of Faith is prepared (the added 5th)", S.preparedSpells.indexOf("shieldOfFaith") >= 0, true);

console.log("\n=== LINKS ===");
eq("base URL points at the 2024 wiki over https", R.WIKIA_BASE_URL, "https://dnd2024.wikidot.com/");
eq("spell link builds correctly", R.wiki(SPELLS.bless.slug), "https://dnd2024.wikidot.com/spell:bless");
eq("null slug yields no link", R.wiki(null), null);
const linkable = Object.keys(SPELLS).filter(k => SPELLS[k].slug);
eq("all spells have slugs", linkable.length, Object.keys(SPELLS).length);
eq("all feats have slugs", Object.keys(R.FEATS).every(k => !!R.FEATS[k].slug), true);

/* The wiki mirror is classes, spells, feats and equipment — it has no
   rules pages, so conditions and the universal actions used to point at
   URLs that had never existed. They resolve against the official 2024
   rules glossary instead, by anchor. Every target below was checked
   against the live page; these assertions are what stop one drifting
   back to a shape that 404s. */
eq("an srd slug resolves against the glossary, not the wiki",
   R.wiki("srd:ProneCondition"),
   "https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#ProneCondition");
eq("every condition points at the glossary",
   Object.keys(R.CONDITIONS).filter(k => R.CONDITIONS[k].slug.indexOf("srd:") !== 0), []);
eq("no condition still points at a rules page the wiki does not have",
   Object.keys(R.CONDITIONS).filter(k => /^condition:/.test(R.CONDITIONS[k].slug)), []);
/* The mastery pages are equipment:weapon, singular — the plural 404s. */
eq("weapon mastery links use the slug the wiki actually has",
   Object.keys(R.MASTERIES).filter(k => R.MASTERIES[k].slug !== "equipment:weapon"), []);
eq("nothing anywhere still points at combat:actions",
   JSON.stringify(R.CONDITIONS).indexOf("combat:actions"), -1);

console.log("\n=== TAGS ===");
eq("Bless is Support + Concentration",
   SPELLS.bless.tags.sort(), ["concentration","support"]);
eq("hand crossbow inventory entry is tagged Ranged",
   S.equipment.inventory.find(i => /Hand Crossbow/.test(i.name)).tags.indexOf("ranged") >= 0, true);
eq("every spell tag is in the vocabulary",
   Object.keys(SPELLS).every(k => SPELLS[k].tags.every(t => !!R.TAGS[t])), true);
eq("every feature tag is in the vocabulary",
   Object.keys(FEATURES).every(k => FEATURES[k].tags.every(t => !!R.TAGS[t])), true);
/* Every feature whose own text says it spends a Channel Divinity use
   should carry the tag that says so — the filter chip is only honest
   if it actually finds all three of them. */
eq("every Channel-Divinity-costing feature is tagged for it",
   Object.keys(FEATURES).filter(k => /expend one use of Channel Divinity/.test(FEATURES[k].text))
     .every(k => FEATURES[k].tags.indexOf("channelDivinity") >= 0), true);

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
console.log("=".repeat(46) + "\n");
process.exit(fail ? 1 : 0);
