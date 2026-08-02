/* ============================================================
   HAL BRIARSHADE — RULES LAYER
   Immutable 2024 ruleset + pure derivation math. No DOM access.
   Everything here ships with the app and is never written to
   localStorage. STATE (app.js) holds only what the player changes.
   ============================================================ */

const WIKIA_BASE_URL = "http://dnd2024.wikidot.com/";

/* Link helper. Slugs are centralised here so a wrong URL is a
   one-line fix rather than a hunt through the render code. */
function wiki(slug) { return slug ? WIKIA_BASE_URL + slug : null; }

/* ---------- TAG VOCABULARY ----------------------------------
   Three hue families plus gray, grouped by what the tag means:
     cyan    — helps you or an ally
     magenta — hurts an enemy
     yellow  — a cost or a limit on you
     gray    — neutral descriptor (delivery, shape, range)
   Shade varies inside a family so members stay distinguishable
   without introducing another hue.                             */
const TAGS = {
  /* helps — cyan family */
  support:       { label: "Support",       color: "c1", group: "helps" },
  healing:       { label: "Healing",       color: "c2", group: "helps" },
  defense:       { label: "Defense",       color: "c3", group: "helps" },
  /* hurts — magenta family */
  damage:        { label: "Damage",        color: "m1", group: "hurts" },
  smite:         { label: "Smite",         color: "m2", group: "hurts" },
  control:       { label: "Control",       color: "m3", group: "hurts" },
  /* costs — yellow family */
  concentration: { label: "Concentration", color: "y1", group: "costs" },
  bonus:         { label: "Bonus Action",  color: "y2", group: "costs" },
  reaction:      { label: "Reaction",      color: "y3", group: "costs" },
  ritual:        { label: "Ritual",        color: "y4", group: "costs" },
  /* descriptors — gray */
  ranged:        { label: "Ranged",        color: "g",  group: "how" },
  touch:         { label: "Touch",         color: "g",  group: "how" },
  melee:         { label: "Melee",         color: "g",  group: "how" },
  aoe:           { label: "AoE",           color: "g",  group: "how" },
  utility:       { label: "Utility",       color: "g",  group: "how" },
  selfOnly:      { label: "Self",          color: "g",  group: "how" }
};
const TAG_GROUPS = {
  helps: "Helps you or an ally",
  hurts: "Hurts an enemy",
  costs: "Costs or limits you",
  how:   "How it's delivered"
};

/* ---------- WEAPON MASTERIES -------------------------------- */
const MASTERIES = {
  vex:    { name: "Vex",    slug: "equipment:weapons",
            text: "On a hit, you have Advantage on your next attack roll against that creature before the end of your next turn." },
  nick:   { name: "Nick",   slug: "equipment:weapons",
            text: "When you make the extra attack from the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn." },
  sap:    { name: "Sap",    slug: "equipment:weapons",
            text: "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn." },
  slow:   { name: "Slow",   slug: "equipment:weapons",
            text: "On a hit, the target's Speed is reduced by 10 feet until the start of your next turn. Doesn't stack." },
  topple: { name: "Topple", slug: "equipment:weapons",
            text: "On a hit, the target makes a Constitution save against your spell save DC or has the Prone condition." },
  push:   { name: "Push",   slug: "equipment:weapons",
            text: "On a hit, you can push the target up to 10 feet away if it is Large or smaller." },
  graze:  { name: "Graze",  slug: "equipment:weapons",
            text: "On a miss, the target takes damage equal to your ability modifier. No damage type bonuses apply." },
  cleave: { name: "Cleave", slug: "equipment:weapons",
            text: "On a hit against a creature, you can make one extra attack against a second creature within 5 feet of the first. Once per turn." }
};

/* ---------- WEAPONS ----------------------------------------- */
const WEAPONS = {
  shortsword:   { name: "Shortsword",    slug: "equipment:weapons", die: "1d6", type: "Piercing",
                  mastery: "vex",  props: ["Finesse", "Light"], category: "Martial Melee", range: null },
  scimitar:     { name: "Scimitar",      slug: "equipment:weapons", die: "1d6", type: "Slashing",
                  mastery: "nick", props: ["Finesse", "Light"], category: "Martial Melee", range: null },
  handCrossbow: { name: "Hand Crossbow", slug: "equipment:weapons", die: "1d6", type: "Piercing",
                  mastery: "vex",  props: ["Ammunition", "Light", "Loading"], category: "Martial Ranged",
                  range: "30/120 ft" },
  rapier:       { name: "Rapier",        slug: "equipment:weapons", die: "1d8", type: "Piercing",
                  mastery: "vex",  props: ["Finesse"], category: "Martial Melee", range: null },
  dagger:       { name: "Dagger",        slug: "equipment:weapons", die: "1d4", type: "Piercing",
                  mastery: "nick", props: ["Finesse", "Light", "Thrown"], category: "Simple Melee",
                  range: "20/60 ft" },
  longsword:    { name: "Longsword",     slug: "equipment:weapons", die: "1d8", type: "Slashing",
                  mastery: "sap",  props: ["Versatile (1d10)"], category: "Martial Melee", range: null }
};

/* ---------- ARMOR ------------------------------------------- */
const ARMOR = {
  scaleMail:  { name: "Scale Mail",  slug: "equipment:armor", base: 14, dexCap: 2, stealthDis: true },
  chainMail:  { name: "Chain Mail",  slug: "equipment:armor", base: 16, dexCap: 0, stealthDis: true, strReq: 13 },
  halfPlate:  { name: "Half Plate",  slug: "equipment:armor", base: 15, dexCap: 2, stealthDis: true },
  studded:    { name: "Studded Leather", slug: "equipment:armor", base: 12, dexCap: 99, stealthDis: false },
  none:       { name: "Unarmored",   slug: null, base: 10, dexCap: 99, stealthDis: false }
};

/* ---------- PALADIN PROGRESSION (2024 PHB) ------------------- */
/* prepared = class prepared-spell count; oath spells are free on top.
   slots indexed 1..5. cd = Channel Divinity uses. */
const PALADIN_TABLE = [
  null,
  { lvl:1,  prof:2, prepared:2,  cd:0, slots:{1:2}, feats:["Lay On Hands","Spellcasting","Weapon Mastery"] },
  { lvl:2,  prof:2, prepared:3,  cd:0, slots:{1:2}, feats:["Fighting Style","Paladin's Smite"] },
  { lvl:3,  prof:2, prepared:4,  cd:2, slots:{1:3}, feats:["Channel Divinity","Paladin Subclass"] },
  { lvl:4,  prof:2, prepared:5,  cd:2, slots:{1:3}, feats:["Ability Score Improvement"] },
  { lvl:5,  prof:3, prepared:6,  cd:2, slots:{1:4,2:2}, feats:["Extra Attack","Faithful Steed"] },
  { lvl:6,  prof:3, prepared:6,  cd:2, slots:{1:4,2:2}, feats:["Aura of Protection"] },
  { lvl:7,  prof:3, prepared:7,  cd:2, slots:{1:4,2:3}, feats:["Aura of Warding"] },
  { lvl:8,  prof:3, prepared:7,  cd:2, slots:{1:4,2:3}, feats:["Ability Score Improvement"] },
  { lvl:9,  prof:4, prepared:9,  cd:2, slots:{1:4,2:3,3:2}, feats:["Abjure Foes"] },
  { lvl:10, prof:4, prepared:9,  cd:2, slots:{1:4,2:3,3:2}, feats:["Aura of Courage"] },
  { lvl:11, prof:4, prepared:10, cd:3, slots:{1:4,2:3,3:3}, feats:["Radiant Strikes"] },
  { lvl:12, prof:4, prepared:10, cd:3, slots:{1:4,2:3,3:3}, feats:["Ability Score Improvement"] },
  { lvl:13, prof:5, prepared:11, cd:3, slots:{1:4,2:3,3:3,4:1}, feats:[] },
  { lvl:14, prof:5, prepared:11, cd:3, slots:{1:4,2:3,3:3,4:1}, feats:["Restoring Touch"] },
  { lvl:15, prof:5, prepared:12, cd:3, slots:{1:4,2:3,3:3,4:2}, feats:["Undying Sentinel"] },
  { lvl:16, prof:5, prepared:12, cd:3, slots:{1:4,2:3,3:3,4:2}, feats:["Ability Score Improvement"] },
  { lvl:17, prof:6, prepared:14, cd:3, slots:{1:4,2:3,3:3,4:3,5:1}, feats:[] },
  { lvl:18, prof:6, prepared:14, cd:3, slots:{1:4,2:3,3:3,4:3,5:1}, feats:["Aura Expansion"] },
  { lvl:19, prof:6, prepared:15, cd:3, slots:{1:4,2:3,3:3,4:3,5:2}, feats:["Epic Boon"] },
  { lvl:20, prof:6, prepared:15, cd:3, slots:{1:4,2:3,3:3,4:3,5:2}, feats:["Elder Champion"] }
];

/* Levels at which a feat / ASI is granted */
const ASI_LEVELS = [4, 8, 12, 16, 19];

/* ---------- OATH OF THE ANCIENTS SPELLS (always prepared) ---- */
const OATH_SPELLS = {
  3:  ["ensnaringStrike", "speakWithAnimals"],
  5:  ["mistyStep", "moonbeam"],
  9:  ["plantGrowth", "protectionFromEnergy"],
  13: ["iceStorm", "stoneskin"],
  17: ["communeWithNature", "treeStride"]
};

/* ---------- SPELL DATABASE ---------------------------------- */
/* Mechanically complete, flavour text omitted per spec. */
const SPELLS = {
  /* --- Cantrips (from Magic Initiate: Wizard) --- */
  prestidigitation: { name:"Prestidigitation", lvl:0, slug:"spell:prestidigitation", school:"Transmutation",
    time:"Action", range:"10 ft", dur:"Up to 1 hour", comp:"V, S", tags:["utility"],
    text:"Create one of: a harmless sensory effect; light or snuff a small flame; clean or soil a 1-cubic-foot object; chill, warm, or flavor 1 cubic foot of nonliving material; make a mark or symbol appear for 1 hour; create a nonmagical trinket that fits in your hand, lasting until the end of your next turn. Up to three effects active at once." },
  mageHand: { name:"Mage Hand", lvl:0, slug:"spell:mage-hand", school:"Conjuration",
    time:"Action", range:"30 ft", dur:"1 minute", comp:"V, S", tags:["utility"],
    text:"Create a spectral hand. As a Magic action you can move it up to 30 ft and use it to manipulate objects, open unlocked doors or containers, stow or retrieve items, or pour contents. Can't attack, activate magic items, or carry more than 10 lb." },

  /* --- Magic Initiate 1st-level pick --- */
  findFamiliar: { name:"Find Familiar", lvl:1, slug:"spell:find-familiar", school:"Conjuration",
    time:"1 hour", range:"10 ft", dur:"Until dispelled", comp:"V, S, M (10 gp of charcoal, incense, and herbs, consumed)",
    tags:["utility","ritual"], ritual:true,
    text:"Summon a familiar spirit in animal form (Celestial, Fey, or Fiend). It acts on your Initiative but can't attack; it can take other actions. While within 100 ft you can communicate telepathically and see through its senses as a Magic action. As a Magic action you can cast a spell with a range of Touch through it. It vanishes at 0 HP rather than dying; resummon by recasting. Dismiss to a pocket dimension and recall as a Magic action." },

  /* --- Paladin 1st level --- */
  bless: { name:"Bless", lvl:1, slug:"spell:bless", school:"Enchantment",
    time:"Action", range:"30 ft", dur:"Concentration, up to 1 minute", comp:"V, S, M (a Holy Symbol)",
    tags:["support","concentration"],
    text:"Three creatures of your choice each add 1d4 to attack rolls and saving throws. Higher levels: +1 creature per slot level above 1." },
  command: { name:"Command", lvl:1, slug:"spell:command", school:"Enchantment",
    time:"Action", range:"60 ft", dur:"1 round", comp:"V", tags:["control","ranged"],
    text:"One creature makes a Wisdom save or follows a one-word command on its next turn: Approach, Drop, Flee, Grovel, or Halt. Fails if the target is Undead, doesn't understand you, or the command is directly harmful. Higher levels: +1 creature per slot level above 1." },
  compelledDuel: { name:"Compelled Duel", lvl:1, slug:"spell:compelled-duel", school:"Enchantment",
    time:"Bonus Action", range:"30 ft", dur:"Concentration, up to 1 minute", comp:"V",
    tags:["control","concentration","bonus"],
    text:"One creature makes a Wisdom save or has Disadvantage on attacks against anyone but you and can't willingly move within 30 ft of you. Ends if you attack another creature, force another creature to save, or end your turn more than 30 ft from it." },
  cureWounds: { name:"Cure Wounds", lvl:1, slug:"spell:cure-wounds", school:"Abjuration",
    time:"Action", range:"Touch", dur:"Instantaneous", comp:"V, S", tags:["healing","touch"],
    text:"A creature you touch regains 2d8 + your spellcasting modifier HP. Higher levels: +2d8 per slot level above 1." },
  detectEvilAndGood: { name:"Detect Evil and Good", lvl:1, slug:"spell:detect-evil-and-good", school:"Divination",
    time:"Action", range:"Self", dur:"Concentration, up to 10 minutes", comp:"V, S",
    tags:["utility","concentration","selfOnly"],
    text:"Know the location of any Aberration, Celestial, Elemental, Fey, Fiend, or Undead within 30 ft, and whether a place or object within 30 ft is magically consecrated or desecrated. Blocked by 1 ft of stone, 1 inch of metal, or 3 ft of wood or dirt." },
  detectMagic: { name:"Detect Magic", lvl:1, slug:"spell:detect-magic", school:"Divination",
    time:"Action", range:"Self", dur:"Concentration, up to 10 minutes", comp:"V, S",
    tags:["utility","concentration","ritual","selfOnly"], ritual:true,
    text:"Sense the presence of magical effects within 30 ft. As a Magic action, see a faint aura around any visible magical creature or object and learn its school of magic." },
  detectPoisonAndDisease: { name:"Detect Poison and Disease", lvl:1, slug:"spell:detect-poison-and-disease",
    school:"Divination", time:"Action", range:"Self", dur:"Concentration, up to 10 minutes", comp:"V, S, M (a yew leaf)",
    tags:["utility","concentration","ritual","selfOnly"], ritual:true,
    text:"Sense the location of poisons, poisonous creatures, and magical contagions within 30 ft, and identify the kind." },
  divineFavor: { name:"Divine Favour", lvl:1, slug:"spell:divine-favor", school:"Transmutation",
    time:"Bonus Action", range:"Self", dur:"1 minute", comp:"V", tags:["damage","bonus","selfOnly"],
    text:"Your weapon attacks deal an extra 1d4 Radiant damage on a hit. (2024: no longer requires Concentration.)" },
  divineSmite: { name:"Divine Smite", lvl:1, slug:"spell:divine-smite", school:"Evocation",
    time:"Bonus Action", range:"Self", dur:"Instantaneous", comp:"V", tags:["damage","smite","bonus"],
    text:"Cast immediately after hitting with a Melee weapon or Unarmed Strike. The target takes an extra 2d8 Radiant damage, or 3d8 if it is a Fiend or Undead. Higher levels: +1d8 per slot level above 1." },
  heroism: { name:"Heroism", lvl:1, slug:"spell:heroism", school:"Enchantment",
    time:"Action", range:"Touch", dur:"Concentration, up to 1 minute", comp:"V, S",
    tags:["support","concentration","touch"],
    text:"A willing creature is immune to the Frightened condition and gains Temporary HP equal to your spellcasting modifier at the start of each of its turns. Higher levels: +1 creature per slot level above 1." },
  protectionFromEvilAndGood: { name:"Protection from Evil and Good", lvl:1,
    slug:"spell:protection-from-evil-and-good", school:"Abjuration",
    time:"Action", range:"Touch", dur:"Concentration, up to 10 minutes",
    comp:"V, S, M (Holy Water or powdered silver and iron, consumed)", tags:["defense","concentration","touch"],
    text:"Aberrations, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attacks against the target. The target can't be possessed or Charmed or Frightened by them; existing such effects have Advantage to end." },
  purifyFoodAndDrink: { name:"Purify Food and Drink", lvl:1, slug:"spell:purify-food-and-drink",
    school:"Transmutation", time:"Action", range:"10 ft", dur:"Instantaneous", comp:"V, S",
    tags:["utility","ritual","aoe"], ritual:true,
    text:"All nonmagical food and drink in a 5-foot-radius Sphere is purified and rendered free of poison and disease." },
  searingSmite: { name:"Searing Smite", lvl:1, slug:"spell:searing-smite", school:"Evocation",
    time:"Bonus Action", range:"Self", dur:"1 minute", comp:"V", tags:["damage","smite","bonus"],
    text:"Cast after hitting with a Melee weapon. The target takes an extra 1d6 Fire damage and starts burning: at the end of each of its turns it takes 1d6 Fire damage until it or an ally uses an action to make a Constitution save to end it. Higher levels: +1d6 initial per slot level above 1." },
  shieldOfFaith: { name:"Shield of Faith", lvl:1, slug:"spell:shield-of-faith", school:"Abjuration",
    time:"Bonus Action", range:"60 ft", dur:"Concentration, up to 10 minutes", comp:"V, S, M (a Holy Symbol)",
    tags:["defense","support","concentration","ranged","bonus"],
    text:"A creature you can see gains a +2 bonus to Armor Class." },
  thunderousSmite: { name:"Thunderous Smite", lvl:1, slug:"spell:thunderous-smite", school:"Evocation",
    time:"Bonus Action", range:"Self", dur:"Instantaneous", comp:"V", tags:["damage","smite","bonus"],
    text:"Cast after hitting with a Melee weapon. The target takes an extra 2d6 Thunder damage and must succeed on a Strength save or be pushed 10 ft and knocked Prone. Higher levels: +1d6 per slot level above 1." },
  wrathfulSmite: { name:"Wrathful Smite", lvl:1, slug:"spell:wrathful-smite", school:"Necromancy",
    time:"Bonus Action", range:"Self", dur:"Instantaneous", comp:"V", tags:["damage","control","smite","bonus"],
    text:"Cast after hitting with a Melee weapon. The target takes an extra 1d6 Psychic damage and must succeed on a Wisdom save or have the Frightened condition until the end of your next turn. Higher levels: +1d6 per slot level above 1." },
  ensnaringStrike: { name:"Ensnaring Strike", lvl:1, slug:"spell:ensnaring-strike", school:"Conjuration",
    time:"Bonus Action", range:"Self", dur:"Concentration, up to 1 minute", comp:"V",
    tags:["control","concentration","smite","bonus"], oath:true,
    text:"Cast after hitting with a weapon. The target makes a Strength save or has the Restrained condition, taking 1d6 Piercing damage at the start of each of its turns. It repeats the save as an action. Higher levels: +1d6 per slot level above 1." },
  speakWithAnimals: { name:"Speak with Animals", lvl:1, slug:"spell:speak-with-animals",
    school:"Divination", time:"Action", range:"Self", dur:"10 minutes", comp:"V, S",
    tags:["utility","ritual","selfOnly"], ritual:true, oath:true,
    text:"You can comprehend and verbally communicate with Beasts, and can use any of the Influence action's options with them." },

  /* --- Paladin 2nd level (unlocked at Paladin 5) --- */
  aid: { name:"Aid", lvl:2, slug:"spell:aid", school:"Abjuration",
    time:"Action", range:"30 ft", dur:"8 hours", comp:"V, S, M (a strip of white cloth)",
    tags:["support","healing"],
    text:"Three creatures each gain 5 Temporary HP; their HP maximum is unaffected. Higher levels: +5 Temp HP per slot level above 2." },
  findSteed: { name:"Find Steed", lvl:2, slug:"spell:find-steed", school:"Conjuration",
    time:"Action (Ritual)", range:"30 ft", dur:"Until dispelled", comp:"V, S", tags:["utility","ritual"], ritual:true,
    text:"Summon a Celestial spirit as a loyal mount (Warhorse, Pony, Camel, Elk, or Mastiff; Large or Medium). It has your Charisma modifier added to its AC, attack rolls, damage rolls, and saves. While within 1 mile you can communicate telepathically. It vanishes at 0 HP." },
  gentleRepose: { name:"Gentle Repose", lvl:2, slug:"spell:gentle-repose", school:"Necromancy",
    time:"Action", range:"Touch", dur:"10 days", comp:"V, S, M (a copper piece placed on each of the corpse's eyes)",
    tags:["utility","ritual","touch"], ritual:true,
    text:"A corpse is protected from decay and can't become Undead. The duration doesn't count against the time limit of spells that raise the dead." },
  lesserRestoration: { name:"Lesser Restoration", lvl:2, slug:"spell:lesser-restoration",
    school:"Abjuration", time:"Action", range:"Touch", dur:"Instantaneous", comp:"V, S",
    tags:["healing","support","touch"],
    text:"End one condition on a creature you touch: Blinded, Deafened, Paralyzed, or Poisoned." },
  locateObject: { name:"Locate Object", lvl:2, slug:"spell:locate-object", school:"Divination",
    time:"Action", range:"Self", dur:"Concentration, up to 10 minutes", comp:"V, S, M (a forked twig)",
    tags:["utility","concentration","selfOnly"],
    text:"Sense the direction to a familiar object within 1,000 ft, if it is within range. Blocked by 3 ft of stone, 1 inch of metal, or a thin sheet of lead." },
  magicWeapon: { name:"Magic Weapon", lvl:2, slug:"spell:magic-weapon", school:"Transmutation",
    time:"Bonus Action", range:"Touch", dur:"1 hour", comp:"V, S", tags:["support","touch","bonus"],
    text:"A nonmagical weapon becomes magical with a +1 bonus to attack and damage rolls. Higher levels: +2 at slot level 4, +3 at 6." },
  prayerOfHealing: { name:"Prayer of Healing", lvl:2, slug:"spell:prayer-of-healing", school:"Abjuration",
    time:"10 minutes", range:"30 ft", dur:"Instantaneous", comp:"V", tags:["healing","aoe"],
    text:"Up to five creatures each regain 2d8 + your spellcasting modifier HP. Higher levels: +1d8 to each per slot level above 2." },
  protectionFromPoison: { name:"Protection from Poison", lvl:2, slug:"spell:protection-from-poison",
    school:"Abjuration", time:"Action", range:"Touch", dur:"1 hour", comp:"V, S", tags:["defense","healing","touch"],
    text:"Neutralize one poison affecting the target, and for the duration the target has Advantage on saves against being Poisoned and Resistance to Poison damage." },
  shiningSmite: { name:"Shining Smite", lvl:2, slug:"spell:shining-smite", school:"Transmutation",
    time:"Bonus Action", range:"Self", dur:"Concentration, up to 1 minute", comp:"V",
    tags:["damage","smite","concentration","bonus"],
    text:"Cast after hitting with a weapon. The target takes an extra 2d6 Radiant damage, sheds Dim Light in a 5-foot radius, and attack rolls against it have Advantage. Higher levels: +1d6 per slot level above 2." },
  wardingBond: { name:"Warding Bond", lvl:2, slug:"spell:warding-bond", school:"Abjuration",
    time:"Action", range:"Touch", dur:"1 hour", comp:"V, S, M (a pair of platinum rings worth 50+ GP each)",
    tags:["defense","support","touch"],
    text:"The target gains +1 AC, +1 to saves, and Resistance to all damage. Each time it takes damage, you take the same amount. Ends if you drop to 0 HP or are more than 60 ft apart." },
  zoneOfTruth: { name:"Zone of Truth", lvl:2, slug:"spell:zone-of-truth", school:"Enchantment",
    time:"Action", range:"60 ft", dur:"10 minutes", comp:"V, S", tags:["control","utility","aoe"],
    text:"Creatures in a 15-foot-radius Sphere make a Charisma save or can't speak a deliberate lie while in it. You know who succeeded." },
  mistyStep: { name:"Misty Step", lvl:2, slug:"spell:misty-step", school:"Conjuration",
    time:"Bonus Action", range:"Self", dur:"Instantaneous", comp:"V", tags:["utility","bonus","selfOnly"], oath:true,
    text:"Teleport up to 30 feet to an unoccupied space you can see." },
  moonbeam: { name:"Moonbeam", lvl:2, slug:"spell:moonbeam", school:"Evocation",
    time:"Action", range:"120 ft", dur:"Concentration, up to 1 minute",
    comp:"V, S, M (a moonseed leaf)", tags:["damage","concentration","aoe","ranged"], oath:true,
    text:"A 5-foot-radius, 40-foot-high Cylinder of light. A creature that enters or starts its turn there makes a Constitution save, taking 2d10 Radiant damage on a failure, half on a success. Shapechangers have Disadvantage. As a Magic action you can move the beam 60 ft. Higher levels: +1d10 per slot level above 2." },

  /* --- Higher-level oath spells (referenced by the level-up engine) --- */
  plantGrowth: { name:"Plant Growth", lvl:3, slug:"spell:plant-growth", school:"Transmutation",
    time:"Action or 8 hours", range:"150 ft", dur:"Instantaneous", comp:"V, S",
    tags:["control","aoe"], oath:true,
    text:"Action: plants in a 100-foot radius become overgrown and the area is Difficult Terrain. 8 hours: enrich plants in a half-mile radius to yield twice as much food for 365 days." },
  protectionFromEnergy: { name:"Protection from Energy", lvl:3, slug:"spell:protection-from-energy",
    school:"Abjuration", time:"Action", range:"Touch", dur:"Concentration, up to 1 hour", comp:"V, S",
    tags:["defense","concentration","touch"], oath:true,
    text:"The target gains Resistance to one damage type of your choice: Acid, Cold, Fire, Lightning, or Thunder." },
  iceStorm: { name:"Ice Storm", lvl:4, slug:"spell:ice-storm", school:"Evocation",
    time:"Action", range:"300 ft", dur:"Instantaneous", comp:"V, S, M (a pinch of dust and a few drops of water)",
    tags:["damage","aoe","ranged"], oath:true,
    text:"A 20-foot-radius, 40-foot-high Cylinder. Each creature makes a Dexterity save, taking 2d8 Bludgeoning plus 4d6 Cold damage on a failure, half on a success. The area becomes Difficult Terrain until the end of your next turn. Higher levels: +1d8 Bludgeoning per slot level above 4." },
  stoneskin: { name:"Stoneskin", lvl:4, slug:"spell:stoneskin", school:"Transmutation",
    time:"Action", range:"Touch", dur:"Concentration, up to 1 hour",
    comp:"V, S, M (diamond dust worth 100+ GP, consumed)", tags:["defense","concentration","touch"], oath:true,
    text:"A willing creature gains Resistance to Bludgeoning, Piercing, and Slashing damage." },
  communeWithNature: { name:"Commune with Nature", lvl:5, slug:"spell:commune-with-nature",
    school:"Divination", time:"1 minute", range:"Self", dur:"Instantaneous", comp:"V, S",
    tags:["utility","ritual","selfOnly"], ritual:true, oath:true,
    text:"Learn up to three facts about the surrounding area within 3 miles (300 ft underground): terrain and bodies of water, prevalent creatures, powerful Celestials, Fey, Fiends, Elementals, or Undead, other planes of existence, or buildings." },
  treeStride: { name:"Tree Stride", lvl:5, slug:"spell:tree-stride", school:"Conjuration",
    time:"Action", range:"Self", dur:"Concentration, up to 1 minute", comp:"V, S",
    tags:["utility","concentration","selfOnly"], oath:true,
    text:"Once per turn you can use 10 feet of movement to step magically into one Large or larger tree within 5 ft and emerge from a second tree within 500 ft." }
};

/* Paladin class spell list — what the level-up engine offers */
const PALADIN_SPELL_LIST = {
  1: ["bless","command","compelledDuel","cureWounds","detectEvilAndGood","detectMagic",
      "detectPoisonAndDisease","divineFavor","heroism","protectionFromEvilAndGood",
      "purifyFoodAndDrink","searingSmite","shieldOfFaith","thunderousSmite","wrathfulSmite"],
  2: ["aid","findSteed","gentleRepose","lesserRestoration","locateObject","magicWeapon",
      "prayerOfHealing","protectionFromPoison","shiningSmite","wardingBond","zoneOfTruth"]
};

/* ---------- FEATS ------------------------------------------- */
const FEATS = {
  telepathic: { name:"Telepathic", slug:"feat:telepathic", type:"General", prereq:"Level 4+",
    asi:["int","wis","cha"], tags:["utility"],
    text:"Increase Intelligence, Wisdom, or Charisma by 1 (max 20). You can speak telepathically to any creature you can see within 60 feet; it need not speak back but must understand a language. You can cast Detect Thoughts once per Long Rest without a spell slot, using the same ability as this feat's increase; you can also cast it with spell slots you have." },
  magicInitiateWizard: { name:"Magic Initiate (Wizard)", slug:"feat:magic-initiate", type:"Origin",
    tags:["utility"],
    text:"Learn two cantrips and one level 1 spell from the Wizard spell list. You can cast the level 1 spell once without a spell slot per Long Rest, and also with any spell slots you have. Choose Intelligence, Wisdom, or Charisma as the spellcasting ability. You can replace the level 1 spell when you gain a level." },
  abilityScoreImprovement: { name:"Ability Score Improvement", slug:"feat:ability-score-improvement",
    type:"General", prereq:"Level 4+", tags:["utility"],
    text:"Increase one ability score by 2, or two ability scores by 1 each. Maximum 20. Can be taken more than once." },
  warCaster: { name:"War Caster", slug:"feat:war-caster", type:"General",
    prereq:"Level 4+, Spellcasting or Pact Magic", asi:["int","wis","cha"], tags:["defense","support"],
    text:"Increase Intelligence, Wisdom, or Charisma by 1 (max 20). Advantage on Constitution saves to maintain Concentration. Perform somatic components with weapons or a shield in hand. Cast a spell as an Opportunity Attack instead of making a melee attack, if it targets only that creature and has a casting time of an action." },
  dualWielder: { name:"Dual Wielder", slug:"feat:dual-wielder", type:"General", prereq:"Level 4+",
    asi:["str","dex"], tags:["damage","melee"],
    text:"Increase Strength or Dexterity by 1 (max 20). You can use two-weapon fighting even when the weapons aren't Light. You can draw or stow two weapons when you would normally do one." },
  resilient: { name:"Resilient", slug:"feat:resilient", type:"General", prereq:"Level 4+",
    asi:["str","dex","con","int","wis","cha"], tags:["defense"],
    text:"Increase one ability score by 1 (max 20) and gain saving throw proficiency with that ability." },
  alert: { name:"Alert", slug:"feat:alert", type:"Origin", tags:["utility"],
    text:"Add your Proficiency Bonus to Initiative rolls. When you roll Initiative you can swap your result with a willing ally's." },
  lucky: { name:"Lucky", slug:"feat:lucky", type:"Origin", tags:["utility"],
    text:"You have Luck Points equal to your Proficiency Bonus, regained on a Long Rest. Spend 1 to gain Advantage on a d20 Test, or to impose Disadvantage on an attack roll against you." },
  sentinel: { name:"Sentinel", slug:"feat:sentinel", type:"General", prereq:"Level 4+",
    asi:["str","dex"], tags:["control","melee"],
    text:"Increase Strength or Dexterity by 1 (max 20). When you hit with an Opportunity Attack, the target's Speed becomes 0 for the rest of the turn. You can make an Opportunity Attack when a creature within 5 ft makes an attack against someone other than you." },
  inspiringLeader: { name:"Inspiring Leader", slug:"feat:inspiring-leader", type:"General",
    prereq:"Level 4+", asi:["wis","cha"], tags:["support","healing"],
    text:"Increase Wisdom or Charisma by 1 (max 20). As a Magic action you can grant six creatures within 30 ft Temporary HP equal to your Proficiency Bonus plus the chosen ability modifier. A creature can't gain this again until it finishes a Short or Long Rest." },
  crossbowExpert: { name:"Crossbow Expert", slug:"feat:crossbow-expert", type:"General",
    prereq:"Level 4+, Dexterity 13+", asi:["dex"], tags:["damage","ranged"],
    text:"Increase Dexterity by 1 (max 20). Ignore the Loading property of crossbows with which you have proficiency. You don't have Disadvantage on ranged attacks from being within 5 ft of an enemy. When you make the extra attack from the Light property, it can be with a hand crossbow you're holding." },
  defensiveDuelist: { name:"Defensive Duelist", slug:"feat:defensive-duelist", type:"General",
    prereq:"Level 4+, Dexterity 13+", asi:["dex"], tags:["defense","reaction"],
    text:"Increase Dexterity by 1 (max 20). When you're holding a Finesse weapon you're proficient with and another creature hits you with a melee attack, you can take a Reaction to add your Proficiency Bonus to your AC against that attack, possibly causing it to miss." },
  feyTouched: { name:"Fey-Touched", slug:"feat:fey-touched", type:"General", prereq:"Level 4+",
    asi:["int","wis","cha"], tags:["utility","support"],
    text:"Increase Intelligence, Wisdom, or Charisma by 1 (max 20). Learn Misty Step and one level 1 Divination or Enchantment spell. Cast each once per Long Rest without a slot, and also with spell slots you have." },
  skillExpert: { name:"Skill Expert", slug:"feat:skill-expert", type:"General", prereq:"Level 4+",
    asi:["str","dex","con","int","wis","cha"], tags:["utility"],
    text:"Increase one ability score by 1 (max 20). Gain proficiency in one skill, and Expertise in one skill you're proficient with." }
};

/* ---------- CLASS / SPECIES / BACKGROUND FEATURES ------------ */
const FEATURES = {
  layOnHands: { name:"Lay On Hands", slug:"paladin:main", src:"Paladin 1", tags:["healing","bonus","touch"],
    text:"A pool of healing power equal to five times your Paladin level, refreshed on a Long Rest. As a Bonus Action, touch a creature (including yourself) to restore HP up to the amount remaining in the pool. You can instead spend 5 HP from the pool to remove the Poisoned condition; those points don't also restore HP." },
  spellcasting: { name:"Spellcasting", slug:"paladin:main", src:"Paladin 1", tags:["utility"],
    text:"Charisma is your spellcasting ability. A Holy Symbol is your Spellcasting Focus. You regain all expended spell slots on a Long Rest. On a Long Rest you may replace one prepared spell with another Paladin spell for which you have slots." },
  weaponMastery: { name:"Weapon Mastery", slug:"paladin:main", src:"Paladin 1", tags:["damage","melee"],
    text:"You can use the mastery properties of two kinds of weapons of your choice with which you have proficiency. On a Long Rest you can change which two kinds you've chosen." },
  fightingStyleTWF: { name:"Fighting Style: Two-Weapon Fighting", slug:"feat:two-weapon-fighting",
    src:"Paladin 2", tags:["damage","melee"],
    text:"When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren't already adding it." },
  paladinsSmite: { name:"Paladin's Smite", slug:"paladin:main", src:"Paladin 2", tags:["damage","smite","bonus"],
    text:"You always have Divine Smite prepared. You can cast it once without expending a spell slot; you must finish a Long Rest before doing so again." },
  channelDivinity: { name:"Channel Divinity", slug:"paladin:main", src:"Paladin 3", tags:["utility"],
    text:"Two uses, regaining one on a Short Rest and all on a Long Rest. A third use at Paladin 11. Save DC equals your spell save DC." },
  divineSense: { name:"Channel Divinity: Divine Sense", slug:"paladin:main", src:"Paladin 3",
    tags:["utility","bonus","selfOnly"],
    text:"As a Bonus Action, expend one use of Channel Divinity. For 10 minutes or until Incapacitated, you know the location and creature type of any Celestial, Fiend, or Undead within 60 feet, and detect any consecrated or desecrated place or object in that radius." },
  naturesWrath: { name:"Channel Divinity: Nature's Wrath", slug:"paladin:oath-of-the-ancients",
    src:"Oath of the Ancients 3", tags:["control","aoe"],
    text:"As a Magic action, expend one use of Channel Divinity to conjure spectral vines. Each creature of your choice you can see within 15 feet makes a Strength saving throw against your spell save DC or has the Restrained condition for 1 minute. A Restrained creature repeats the save at the end of each of its turns, ending the effect on a success." },
  extraAttack: { name:"Extra Attack", slug:"paladin:main", src:"Paladin 5", tags:["damage","melee"], unlockLevel:5,
    text:"You can attack twice, instead of once, whenever you take the Attack action on your turn." },
  faithfulSteed: { name:"Faithful Steed", slug:"paladin:main", src:"Paladin 5", tags:["utility"], unlockLevel:5,
    text:"You always have Find Steed prepared. You can cast it once without a spell slot, regaining that use on a Long Rest." },
  auraOfProtection: { name:"Aura of Protection", slug:"paladin:main", src:"Paladin 6",
    tags:["defense","support"], unlockLevel:6,
    text:"A 10-foot Emanation, inactive while you have the Incapacitated condition. You and your allies in the aura gain a bonus to saving throws equal to your Charisma modifier (minimum +1). Only one Aura of Protection can benefit a creature at a time." },
  auraOfWarding: { name:"Aura of Warding", slug:"paladin:oath-of-the-ancients",
    src:"Oath of the Ancients 7", tags:["defense","support"], unlockLevel:7,
    text:"You and your allies have Resistance to Necrotic, Psychic, and Radiant damage while in your Aura of Protection." },
  abjureFoes: { name:"Abjure Foes", slug:"paladin:main", src:"Paladin 9", tags:["control"], unlockLevel:9,
    text:"As a Magic action, expend one use of Channel Divinity to target creatures equal to your Charisma modifier (minimum 1) within 60 feet. Each makes a Wisdom save or has the Frightened condition for 1 minute or until it takes damage. While Frightened this way, a target can do only one of the following on its turn: move, take an action, or take a Bonus Action." },
  auraOfCourage: { name:"Aura of Courage", slug:"paladin:main", src:"Paladin 10",
    tags:["defense","support"], unlockLevel:10,
    text:"You and your allies have Immunity to the Frightened condition while in your Aura of Protection." },
  radiantStrikes: { name:"Radiant Strikes", slug:"paladin:main", src:"Paladin 11",
    tags:["damage","melee"], unlockLevel:11,
    text:"When you hit a target with an attack roll using a Melee weapon or an Unarmed Strike, the target takes an extra 1d8 Radiant damage." },
  restoringTouch: { name:"Restoring Touch", slug:"paladin:main", src:"Paladin 14",
    tags:["healing","support"], unlockLevel:14,
    text:"When you use Lay On Hands, you can also remove any of the Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned conditions, spending 5 HP from the pool per condition. Those points don't also restore HP." },
  undyingSentinel: { name:"Undying Sentinel", slug:"paladin:oath-of-the-ancients",
    src:"Oath of the Ancients 15", tags:["defense"], unlockLevel:15,
    text:"When reduced to 0 HP and not killed outright, you can drop to 1 HP instead and regain HP equal to three times your Paladin level. Once per Long Rest. You also can't be aged magically and cease visibly aging." },
  auraExpansion: { name:"Aura Expansion", slug:"paladin:main", src:"Paladin 18",
    tags:["support"], unlockLevel:18,
    text:"Your Aura of Protection is now a 30-foot Emanation." },
  elderChampion: { name:"Elder Champion", slug:"paladin:oath-of-the-ancients",
    src:"Oath of the Ancients 20", tags:["damage","support"], unlockLevel:20,
    text:"As a Bonus Action, imbue your aura with primal power for 1 minute (once per Long Rest, or by expending a level 5 slot). Enemies in the aura have Disadvantage on saves against your spells and Channel Divinity. You regain 10 HP at the start of each of your turns. Spells with a casting time of an action can be cast as a Bonus Action." },

  /* Species — Jerbeen (as played at this table) */
  teamTactics: { name:"Team Tactics", slug:null, src:"Jerbeen", tags:["support","bonus"], homebrew:true,
    text:"You can take the Help action as a Bonus Action." },
  nimbleness: { name:"Nimbleness", slug:null, src:"Jerbeen", tags:["utility"], homebrew:true,
    text:"You can move through the space of any creature that is a size larger than you." },
  takeHeart: { name:"Take Heart", slug:null, src:"Jerbeen", tags:["defense"], homebrew:true,
    text:"You have Advantage on Strength saving throws and on saving throws against being Frightened, provided you can see or hear a non-Incapacitated ally." },

  /* Background */
  abandoned: { name:"Background: Abandoned", slug:null, src:"Background", tags:["utility"], homebrew:true,
    text:"Skill proficiencies from the background, Cook's Utensils proficiency, and Magic Initiate (Wizard) as the origin feat." }
};

/* ---------- CONDITIONS (2024) ------------------------------- */
const CONDITIONS = {
  blinded:      { name:"Blinded",      slug:"condition:blinded",      text:"Can't see and automatically fail sight-based checks. Attacks against you have Advantage; your attacks have Disadvantage." },
  charmed:      { name:"Charmed",      slug:"condition:charmed",      text:"Can't attack the charmer or target them with harmful effects. The charmer has Advantage on ability checks to interact with you socially." },
  deafened:     { name:"Deafened",     slug:"condition:deafened",     text:"Can't hear and automatically fail hearing-based checks." },
  frightened:   { name:"Frightened",   slug:"condition:frightened",   text:"Disadvantage on ability checks and attacks while the source is visible. Can't willingly move closer to it." },
  grappled:     { name:"Grappled",     slug:"condition:grappled",     text:"Speed 0. Disadvantage on attacks against anyone but the grappler. Moves with the grappler." },
  incapacitated:{ name:"Incapacitated",slug:"condition:incapacitated",text:"Can't take actions, Bonus Actions, or Reactions. Can't concentrate or speak. Initiative rolls have Disadvantage." },
  invisible:    { name:"Invisible",    slug:"condition:invisible",    text:"You are Heavily Obscured for the purpose of hiding. Attacks against you have Disadvantage; your attacks have Advantage." },
  paralyzed:    { name:"Paralyzed",    slug:"condition:paralyzed",    text:"Incapacitated, can't move or speak, and auto-fail STR and DEX saves. Attacks against you have Advantage and hits within 5 ft are Critical Hits." },
  petrified:    { name:"Petrified",    slug:"condition:petrified",    text:"Turned to stone. Incapacitated, Resistance to all damage, Immunity to poison and disease, auto-fail STR and DEX saves." },
  poisoned:     { name:"Poisoned",     slug:"condition:poisoned",     text:"Disadvantage on attack rolls and ability checks." },
  prone:        { name:"Prone",        slug:"condition:prone",        text:"You can only crawl unless you stand up. Disadvantage on attacks. Attacks against you have Advantage within 5 ft, Disadvantage beyond." },
  restrained:   { name:"Restrained",   slug:"condition:restrained",   text:"Speed 0. Attacks against you have Advantage; your attacks have Disadvantage. Disadvantage on DEX saves." },
  stunned:      { name:"Stunned",      slug:"condition:stunned",      text:"Incapacitated, can't move, and can speak only falteringly. Auto-fail STR and DEX saves. Attacks against you have Advantage." },
  unconscious:  { name:"Unconscious",  slug:"condition:unconscious",  text:"Incapacitated, can't move or speak, and unaware. Drop what you're holding and fall Prone. Auto-fail STR and DEX saves. Attacks have Advantage; hits within 5 ft are Critical Hits." }
};

const SKILL_ABILITY = {
  athletics:"str", acrobatics:"dex", sleightOfHand:"dex", stealth:"dex",
  arcana:"int", history:"int", investigation:"int", nature:"int", religion:"int",
  animalHandling:"wis", insight:"wis", medicine:"wis", perception:"wis", survival:"wis",
  deception:"cha", intimidation:"cha", performance:"cha", persuasion:"cha"
};
const SKILL_NAMES = {
  athletics:"Athletics", acrobatics:"Acrobatics", sleightOfHand:"Sleight of Hand", stealth:"Stealth",
  arcana:"Arcana", history:"History", investigation:"Investigation", nature:"Nature", religion:"Religion",
  animalHandling:"Animal Handling", insight:"Insight", medicine:"Medicine", perception:"Perception",
  survival:"Survival", deception:"Deception", intimidation:"Intimidation", performance:"Performance",
  persuasion:"Persuasion"
};
const ABILITY_NAMES = { str:"Strength", dex:"Dexterity", con:"Constitution",
                        int:"Intelligence", wis:"Wisdom", cha:"Charisma" };

/* ============================================================
   PURE DERIVATION MATH
   Functions return { value, sources[] } so the UI can show
   provenance. Source kinds: level | ability | proficiency | feat
   | feature | item | homebrew | imported
   ============================================================ */
const CALC = {
  mod(score) { return Math.floor((score - 10) / 2); },

  profBonus(level) { return 2 + Math.floor((level - 1) / 4); },

  abilityMod(S, key) {
    const score = S.abilities[key];
    const srcs = [{ kind:"ability", label:ABILITY_NAMES[key] + " " + score, value:CALC.mod(score) }];
    ((S.abilityNotes && S.abilityNotes[key]) || []).forEach(function (n) {
      srcs.push({ kind:"feat", label:n, value:null });
    });
    return { value: CALC.mod(score), sources: srcs };
  },

  savingThrow(S, key) {
    const m = CALC.mod(S.abilities[key]);
    const prof = S.saveProficiencies.indexOf(key) >= 0 ? CALC.profBonus(S.level) : 0;
    const auraActive = CALC.hasFeature(S, "auraOfProtection") && S.toggles.auraOfProtection;
    const aura = auraActive ? Math.max(1, CALC.mod(S.abilities.cha)) : 0;
    const sources = [{ kind:"ability", label:ABILITY_NAMES[key] + " modifier", value:m }];
    if (prof) sources.push({ kind:"proficiency", label:"Proficiency (Paladin save)", value:prof });
    if (aura) sources.push({ kind:"feature", label:"Aura of Protection (CHA)", value:aura });
    ((S.abilityNotes && S.abilityNotes[key]) || []).forEach(function (n) {
      sources.push({ kind:"feat", label:n, value:null });
    });
    return {
      value: m + prof + aura, sources,
      advantage: (key === "str" && S.toggles.takeHeart) ? "Take Heart" : null
    };
  },

  skill(S, key) {
    const ab = SKILL_ABILITY[key];
    const m = CALC.mod(S.abilities[ab]);
    const p = CALC.profBonus(S.level);
    const isProf = S.skillProficiencies.indexOf(key) >= 0;
    const isExp = S.skillExpertise.indexOf(key) >= 0;
    const bonus = isExp ? p * 2 : (isProf ? p : 0);
    const sources = [{ kind:"ability", label:ABILITY_NAMES[ab] + " modifier", value:m }];
    if (isExp) sources.push({ kind:"proficiency", label:"Expertise (2x proficiency)", value:p * 2 });
    else if (isProf) sources.push({ kind:"proficiency", label:"Proficiency", value:p });
    return { value: m + bonus, sources, proficient:isProf, expertise:isExp };
  },

  armorClass(S) {
    const a = ARMOR[S.equipment.armor] || ARMOR.none;
    const dex = CALC.mod(S.abilities.dex);
    const dexUsed = Math.min(dex, a.dexCap);
    const shield = S.equipment.shield ? 2 : 0;
    const misc = S.equipment.acBonus || 0;
    const sources = [{ kind:"item", label:a.name, value:a.base }];
    if (a.dexCap < 99) sources.push({ kind:"ability", label:"DEX modifier (capped at +" + a.dexCap + ")", value:dexUsed });
    else sources.push({ kind:"ability", label:"DEX modifier", value:dexUsed });
    if (shield) sources.push({ kind:"item", label:"Shield", value:shield });
    if (misc) sources.push({ kind:"item", label:"Misc bonus", value:misc });
    return { value: a.base + dexUsed + shield + misc, sources, stealthDis: a.stealthDis };
  },

  spellSaveDC(S) {
    const p = CALC.profBonus(S.level), c = CALC.mod(S.abilities.cha);
    return { value: 8 + p + c, sources: [
      { kind:"level", label:"Base", value:8 },
      { kind:"proficiency", label:"Proficiency", value:p },
      { kind:"ability", label:"CHA modifier", value:c }
    ]};
  },

  spellAttack(S) {
    const p = CALC.profBonus(S.level), c = CALC.mod(S.abilities.cha);
    return { value: p + c, sources: [
      { kind:"proficiency", label:"Proficiency", value:p },
      { kind:"ability", label:"CHA modifier", value:c }
    ]};
  },

  initiative(S) {
    const d = CALC.mod(S.abilities.dex);
    return { value: d, sources:[{ kind:"ability", label:"DEX modifier", value:d }] };
  },

  layOnHandsMax(S) {
    return { value: S.level * 5, sources: [
      { kind:"level", label:"Paladin level " + S.level + " x 5", value: S.level * 5 }
    ]};
  },

  channelDivinityMax(S) {
    const row = PALADIN_TABLE[S.level];
    const v = row ? row.cd : 0;
    return { value: v, sources: [{ kind:"level", label:"Paladin table, level " + S.level, value:v }] };
  },

  preparedMax(S) {
    const row = PALADIN_TABLE[S.level];
    const v = row ? row.prepared : 0;
    return { value: v, sources: [
      { kind:"level", label:"Paladin table, level " + S.level, value:v },
      { kind:"feature", label:"Oath spells are free on top", value:null }
    ]};
  },

  slotsMax(S) {
    const row = PALADIN_TABLE[S.level];
    return row ? row.slots : {};
  },

  maxHP(S) {
    const con = CALC.mod(S.abilities.con);
    let total = 0;
    const sources = [];
    S.hpEntries.forEach(function (e) {
      if (e.imported) {
        total += e.value;
        sources.push({ kind:"imported", label:e.label || ("Levels 1-" + e.throughLevel + " baseline"), value:e.value });
      } else {
        const gain = e.adjusted + con;
        total += gain;
        sources.push({ kind:"level",
          label:"Level " + e.level + ": d10 rolled " + e.raw + " -> " + e.adjusted + ", +" + con + " CON",
          value:gain });
      }
    });
    return { value: total, sources };
  },

  hitDice(S) {
    return { value: S.level, sources:[{ kind:"level", label:"d10 per Paladin level", value:S.level }] };
  },

  /* House rule: raw d10, +1 unless you rolled a 10 */
  adjustHPRoll(raw) {
    const r = Math.max(1, Math.min(10, Math.floor(raw)));
    return r === 10 ? 10 : r + 1;
  },

  concentrationDC(damage) {
    return Math.max(10, Math.floor(damage / 2));
  },

  /* Which portrait to show. Six frames, same crop and dimensions:
     100/75/50/25 percent of max HP while standing, then down
     (0 HP, stable or making death saves) and gone (3 failed saves). */
  portraitFor(S) {
    if ((S.deathSaves && S.deathSaves.failures) >= 3) {
      return { file: "portrait-gone.png", state: "gone", label: "Gone" };
    }
    if (S.currentHP <= 0) {
      return { file: "portrait-down.png", state: "down", label: "Downed" };
    }
    const max = CALC.maxHP(S).value;
    const pct = max > 0 ? (S.currentHP / max) * 100 : 100;
    if (pct >= 100) return { file: "portrait-100.png", state: "100", label: "Pristine" };
    if (pct >= 75) return { file: "portrait-75.png", state: "75", label: "Hurt" };
    if (pct >= 50) return { file: "portrait-50.png", state: "50", label: "Wounded" };
    return { file: "portrait-25.png", state: "25", label: "Bloodied" };
  },

  hasFeature(S, key) {
    const f = FEATURES[key];
    if (!f) return false;
    if (f.unlockLevel && S.level < f.unlockLevel) return false;
    return S.features.indexOf(key) >= 0;
  },

  activeFeatures(S) {
    return S.features.filter(function (k) {
      const f = FEATURES[k];
      return f && (!f.unlockLevel || S.level >= f.unlockLevel);
    });
  },

  /* ---- The unified Attack Action block ---- */
  attackAction(S) {
    const prof = CALC.profBonus(S.level);
    const dex = CALC.mod(S.abilities.dex);
    const str = CALC.mod(S.abilities.str);
    const extraAttack = CALC.hasFeature(S, "extraAttack");

    const rows = S.equipment.weapons.map(function (id) {
      const w = WEAPONS[id];
      if (!w) return null;
      const finesse = w.props.indexOf("Finesse") >= 0;
      const ranged = w.category.indexOf("Ranged") >= 0;
      const abilMod = (finesse || ranged) ? Math.max(dex, str) : str;
      const abilKey = (finesse || ranged) ? (dex >= str ? "DEX" : "STR") : "STR";
      const magic = (S.equipment.weaponBonuses || {})[id] || 0;
      const masteryActive = S.equipment.activeMasteries.indexOf(id) >= 0;
      const toHitSources = [
        { kind:"ability", label:abilKey + " modifier", value:abilMod },
        { kind:"proficiency", label:"Proficiency", value:prof }
      ];
      const damageSources = [
        { kind:"item", label:w.name + " die", value:w.die },
        { kind:"ability", label:abilKey + " modifier", value:abilMod }
      ];
      if (magic) {
        toHitSources.push({ kind:"item", label:"Magic +" + magic, value:magic });
        damageSources.push({ kind:"item", label:"Magic +" + magic, value:magic });
      }
      return {
        id: id, weapon: w,
        toHit: abilMod + prof + magic, toHitSources: toHitSources,
        damage: w.die + "+" + (abilMod + magic), damageType: w.type, damageSources: damageSources,
        mastery: w.mastery, masteryActive: masteryActive,
        light: w.props.indexOf("Light") >= 0
      };
    }).filter(Boolean);

    /* Does an active Nick weapon fold the Light extra attack into the Attack action? */
    const nickRow = rows.filter(function (r) {
      return r.masteryActive && r.mastery === "nick" && r.light;
    })[0];
    const mainAttacks = extraAttack ? 2 : 1;
    const primary = rows.filter(function (r) { return r.masteryActive && r.mastery !== "nick"; })[0] || rows[0];
    const seq = [];
    for (let i = 0; i < mainAttacks; i++) {
      seq.push({ step: i + 1, row: primary, note: "Attack action" });
    }
    if (nickRow) {
      seq.push({ step: "+", row: nickRow, note: "Nick — extra Light attack, inside the Attack action" });
    }

    return {
      rows: rows, seq: seq, extraAttack: extraAttack, mainAttacks: mainAttacks,
      bonusActionFree: !!nickRow, masteryLimit: 2,
      masteryNote: nickRow
        ? "Nick resolves inside the Attack action — your Bonus Action stays open."
        : "Without Nick active, the off-hand Light attack costs your Bonus Action."
    };
  },

  /* What a level-up grants, computed before it is applied */
  levelUpPreview(S) {
    const next = S.level + 1;
    if (next > 20) return null;
    const cur = PALADIN_TABLE[S.level], row = PALADIN_TABLE[next];
    const gains = [];
    if (row.prof > cur.prof) gains.push({ kind:"proficiency", text:"Proficiency Bonus +" + cur.prof + " to +" + row.prof });
    gains.push({ kind:"level", text:"Lay On Hands pool " + (S.level * 5) + " to " + (next * 5) });
    gains.push({ kind:"level", text:"Hit Dice " + S.level + "d10 to " + next + "d10" });
    if (row.cd > cur.cd) gains.push({ kind:"feature", text:"Channel Divinity " + cur.cd + " to " + row.cd + " uses" });
    if (row.prepared > cur.prepared) {
      gains.push({ kind:"level", text:"Prepared spells " + cur.prepared + " to " + row.prepared +
        " — choose " + (row.prepared - cur.prepared) });
    }
    Object.keys(row.slots).forEach(function (lv) {
      const before = cur.slots[lv] || 0, after = row.slots[lv];
      if (after > before) gains.push({ kind:"level", text:"Level " + lv + " spell slots " + before + " to " + after });
    });
    row.feats.forEach(function (f) { gains.push({ kind:"feature", text:f }); });
    if (OATH_SPELLS[next]) {
      gains.push({ kind:"feature", text:"Oath spells always prepared: " +
        OATH_SPELLS[next].map(function (k) { return SPELLS[k].name; }).join(", ") });
    }
    return {
      nextLevel: next, gains: gains,
      needsFeat: ASI_LEVELS.indexOf(next) >= 0,
      newSpellCount: row.prepared - cur.prepared,
      newSpellLevels: Object.keys(row.slots).map(Number)
    };
  }
};

/* ============================================================
   SEED — Hal Briarshade, extracted from Hal.pdf and reconciled
   against the 2024 rules.
   ============================================================ */
const SEED = {
  schemaVersion: 1,
  identity: {
    name: "Hal Briarshade", species: "Jerbeen", class: "Paladin",
    subclass: "Oath of the Ancients", background: "Abandoned",
    age: "5", height: "2 ft", weight: "25 lbs",
    eyes: "Brown", hair: "Fur", skin: "Brown fur", size: "Small", speed: 30
  },
  level: 4,
  abilities: { str: 9, dex: 16, con: 12, int: 10, wis: 10, cha: 18 },
  abilityNotes: { cha: ["Raised 17 to 18 by Telepathic (level 4 feat)"] },
  saveProficiencies: ["wis", "cha"],
  skillProficiencies: ["deception", "insight", "intimidation", "persuasion"],
  skillExpertise: [],
  toolProficiencies: ["Cook's Utensils"],
  weaponProficiencies: ["Simple", "Martial"],
  armorTraining: ["Light", "Medium", "Heavy", "Shields"],

  hpEntries: [
    { imported: true, value: 35, throughLevel: 4,
      label: "Levels 1-4 baseline (imported from Hal.pdf)" }
  ],
  currentHP: 26,
  tempHP: 0,
  hitDiceUsed: 0,
  deathSaves: { successes: 0, failures: 0 },

  equipment: {
    armor: "scaleMail", shield: false, acBonus: 0,
    weapons: ["shortsword", "scimitar", "handCrossbow"],
    activeMasteries: ["shortsword", "scimitar"],
    weaponBonuses: {},
    inventory: [
      { name: "Shortsword", qty: 1, tags: ["melee","damage"], note: "Finesse, Light — Vex" },
      { name: "Scimitar", qty: 1, tags: ["melee","damage"], note: "Finesse, Light — Nick" },
      { name: "Hand Crossbow", qty: 1, tags: ["ranged","damage"], note: "30/120 ft, Loading — Vex" },
      { name: "Scale Mail", qty: 1, tags: ["defense"], note: "AC 14 + DEX (max 2). Disadvantage on Stealth." },
      { name: "Holy Symbol", qty: 1, tags: ["utility"], note: "Spellcasting focus" },
      { name: "Cook's Utensils", qty: 1, tags: ["utility"], note: "Proficient" },
      { name: "Priest's Pack", qty: 1, tags: ["utility"], note: "" },
      { name: "A shard of metal that doesn't reflect your face", qty: 1, tags: ["utility"],
        note: "Trinket from before Gill found you" }
    ],
    coins: { cp: 0, sp: 0, ep: 0, gp: 130, pp: 0 }
  },

  features: [
    "layOnHands","spellcasting","weaponMastery","fightingStyleTWF","paladinsSmite",
    "channelDivinity","divineSense","naturesWrath",
    "teamTactics","nimbleness","takeHeart","abandoned"
  ],
  feats: ["magicInitiateWizard", "telepathic"],
  magicInitiate: { ability: "cha", cantrips: ["prestidigitation","mageHand"], spell: "findFamiliar" },

  preparedSpells: ["bless","command","cureWounds","divineFavor","shieldOfFaith"],
  cantrips: ["prestidigitation","mageHand"],

  resources: {
    layOnHands: 20,
    channelDivinity: 2,
    freeSmite: 1,
    findFamiliar: 1,
    detectThoughts: 1,
    slots: { 1: { used: 0 } }
  },

  toggles: {
    concentrating: false, concentratingOn: "",
    takeHeart: false, auraOfProtection: false, editMode: false, railCollapsed: false
  },
  conditions: [],
  exhaustion: 0,
  tagOverrides: {},
  customEntries: [],

  /* Who's actually at the table today. Persistent — edit anytime, not
     just at session start. Used to build the turn order. */
  party: { roster: [] },

  /* Combat mode — action economy per turn, plus the 2024
     one-spell-slot-per-turn budget, plus an optional turn order.
     order/currentId stay empty for quick solo play; when order is
     populated, Next Turn cycles through it instead of assuming every
     press is Hal's own turn. */
  combat: {
    active: false, round: 1,
    turn: { action: false, bonus: false, reaction: false, movementUsed: 0, slotUsed: false, hitLanded: false },
    order: [], currentId: null
  },
  /* Active effects with round countdowns. Numeric mods are applied
     automatically by CALC.activeMods. */
  effects: [],
  /* Creatures you're fighting: name, AC if known (autofills the attack
     roll), whether you've hit them yet, conditions with save reminders. */
  creatures: [],

  /* Session log: a lightweight, labeled, timestamped event feed —
     not a structured combat log. Bookended by Start/End Session. It
     reuses the same short labels the undo history already produces,
     so there's no separate instrumentation to maintain. `stats` is a
     couple of running highs (toughest AC you attacked into, highest
     save DC you set for someone else) — a memory aid, not full math.
     Ended sessions get archived into sessionHistory (capped) so past
     recaps stick around without the live log growing forever. */
  session: {
    active: false, startedAt: null, log: [],
    stats: { highestACFaced: null, highestDCSet: null }
  },
  sessionHistory: [],

  settings: {
    rollPrompts: true,      /* pop a "roll this, because of that" card */
    autoApplyEffects: true, /* effects change AC / attack numbers */
    economyLockout: true,   /* grey out what you can't afford */
    edgeGlow: true,         /* concentration and low-HP screen rim */
    creatureTracker: true,
    confirmOverride: true   /* warn before spending economy you don't have */
  },
  notes: {
    backstory: "Found wandering two years ago by a Locathah named Gill. No cohesive memory of origins — only sensory fragments: the ticking of a massive clockwork device, ozone and crushed pine, geometric shadows, the sensation of falling upward. Clings fiercely to chosen family. Gill's reverence for Eadro is casual; Hal's is absolute.",
    misc: "Telepathic feat: speak telepathically to any creature seen within 60 ft; cast Detect Thoughts once per Long Rest."
  },
  importLog: [
    "Lay On Hands 15 to 20 (level x 5; sheet held the level-3 value)",
    "Hit Dice 3 to 4 (equals Paladin level)",
    "CHA save +5 to +6 (CHA 18 + proficiency 2; sheet held the pre-Telepathic value)",
    "Prepared spells 4 to 5 (Paladin table, level 4) — added Shield of Faith",
    "Skills corrected to Deception, Insight, Intimidation, Persuasion; Survival expertise was a mispress",
    "Weapon Mastery capped at 2 active (Shortsword, Scimitar); Hand Crossbow retained but inactive",
    "Nature's Wrath is a Magic action with a Strength save only, targeting each creature of your choice within 15 ft",
    "Aura of Protection hidden until Paladin level 6"
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { WIKIA_BASE_URL, wiki, TAGS, MASTERIES, WEAPONS, ARMOR, PALADIN_TABLE,
    ASI_LEVELS, OATH_SPELLS, SPELLS, PALADIN_SPELL_LIST, FEATS, FEATURES, CONDITIONS,
    SKILL_ABILITY, SKILL_NAMES, ABILITY_NAMES, CALC, SEED };
}
