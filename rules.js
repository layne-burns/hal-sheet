/* ============================================================
   HAL BRIARSHADE — RULES LAYER
   Immutable 2024 ruleset + pure derivation math. No DOM access.
   Everything here ships with the app and is never written to
   localStorage. STATE (app.js) holds only what the player changes.
   ============================================================ */

/* https, not http: the sheet is served over https, and a plain-http link
   from it gets downgraded or warned about depending on the browser. */
const WIKIA_BASE_URL = "https://dnd2024.wikidot.com/";

/* The wikidot mirror is a reference for classes, spells, feats and
   equipment — that is the whole of its navigation. It has no rules pages,
   so every condition and every universal action pointed at a URL that had
   never existed: condition:prone, combat:actions and the rest were all
   404. Those live in the official 2024 rules glossary instead, which
   deep-links each one by anchor.

   A slug carries its own home: "srd:ProneCondition" resolves against the
   glossary, anything else against the wiki. */
const SRD_GLOSSARY_URL = "https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#";
const SRD_PREFIX = "srd:";

/* Link helper. Slugs are centralised here so a wrong URL is a
   one-line fix rather than a hunt through the render code. */
function wiki(slug) {
  if (!slug) return null;
  if (slug.indexOf(SRD_PREFIX) === 0) return SRD_GLOSSARY_URL + slug.slice(SRD_PREFIX.length);
  return WIKIA_BASE_URL + slug;
}

/* ---------- TAG VOCABULARY ----------------------------------
   Three hue families plus gray, grouped by what the tag means:
     cyan    — helps you or an ally
     magenta — hurts an enemy
     yellow  — a cost or a limit on you
     gray    — neutral descriptor (delivery, shape, range)
   Shade varies inside a family so members stay distinguishable
   without introducing another hue.                             */
/* Three axes, one question each: what it does, what it costs you, how far
   it reaches. The old fourth group was a grab-bag — Ranged and Melee are
   about reach, but Utility and Summon are kinds of effect, and filing them
   together meant neither group answered a single question.

   Whether something helps an ally or hurts an enemy is still there, carried
   by colour: the cyan family helps, the magenta family hurts. The palette
   said it more clearly than the heading did, and saying it twice cost a
   line of the bar. */
const TAGS = {
  /* effect — helps (cyan) */
  support:       { label: "Support",       color: "c1", group: "effect" },
  healing:       { label: "Healing",       color: "c2", group: "effect" },
  defense:       { label: "Defense",       color: "c3", group: "effect" },
  /* effect — hurts (magenta) */
  damage:        { label: "Damage",        color: "m1", group: "effect" },
  smite:         { label: "Smite",         color: "m2", group: "effect" },
  control:       { label: "Control",       color: "m3", group: "effect" },
  /* effect — neither (gray) */
  utility:       { label: "Utility",       color: "g",  group: "effect" },
  summon:        { label: "Summon",        color: "g",  group: "effect" },
  /* cost — yellow family */
  concentration: { label: "Concentration", color: "y1", group: "cost" },
  bonus:         { label: "Bonus Action",  color: "y2", group: "cost" },
  reaction:      { label: "Reaction",      color: "y3", group: "cost" },
  ritual:        { label: "Ritual",        color: "y4", group: "cost" },
  /* reach — gray */
  melee:         { label: "Melee",         color: "g",  group: "reach" },
  touch:         { label: "Touch",         color: "g",  group: "reach" },
  ranged:        { label: "Ranged",        color: "g",  group: "reach" },
  aoe:           { label: "AoE",           color: "g",  group: "reach" },
  selfOnly:      { label: "Self",          color: "g",  group: "reach" }
};
/* One word each. The old headings were sentences of four different lengths
   wrapping inside a single flex row, which is most of why the bar read as
   a jumble. */
const TAG_GROUPS = {
  effect: "Effect",
  cost:   "Cost",
  reach:  "Reach"
};

/* ---------- WEAPON MASTERIES -------------------------------- */
const MASTERIES = {
  vex:    { name: "Vex",    slug: "equipment:weapon",
            text: "On a hit, you have Advantage on your next attack roll against that creature before the end of your next turn." },
  nick:   { name: "Nick",   slug: "equipment:weapon",
            text: "When you make the extra attack from the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn." },
  sap:    { name: "Sap",    slug: "equipment:weapon",
            text: "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn." },
  slow:   { name: "Slow",   slug: "equipment:weapon",
            text: "On a hit, the target's Speed is reduced by 10 feet until the start of your next turn. Doesn't stack." },
  topple: { name: "Topple", slug: "equipment:weapon",
            text: "On a hit, the target makes a Constitution save against your spell save DC or has the Prone condition." },
  push:   { name: "Push",   slug: "equipment:weapon",
            text: "On a hit, you can push the target up to 10 feet away if it is Large or smaller." },
  graze:  { name: "Graze",  slug: "equipment:weapon",
            text: "On a miss, the target takes damage equal to your ability modifier. No damage type bonuses apply." },
  cleave: { name: "Cleave", slug: "equipment:weapon",
            text: "On a hit against a creature, you can make one extra attack against a second creature within 5 feet of the first. Once per turn." }
};

/* ---------- WEAPONS ----------------------------------------- */
const WEAPONS = {
  shortsword:   { name: "Shortsword",    slug: "equipment:weapon", die: "1d6", type: "Piercing",
                  mastery: "vex",  props: ["Finesse", "Light"], category: "Martial Melee", range: null },
  scimitar:     { name: "Scimitar",      slug: "equipment:weapon", die: "1d6", type: "Slashing",
                  mastery: "nick", props: ["Finesse", "Light"], category: "Martial Melee", range: null },
  handCrossbow: { name: "Hand Crossbow", slug: "equipment:weapon", die: "1d6", type: "Piercing",
                  mastery: "vex",  props: ["Ammunition", "Light", "Loading"], category: "Martial Ranged",
                  range: "30/120 ft" },
  rapier:       { name: "Rapier",        slug: "equipment:weapon", die: "1d8", type: "Piercing",
                  mastery: "vex",  props: ["Finesse"], category: "Martial Melee", range: null },
  dagger:       { name: "Dagger",        slug: "equipment:weapon", die: "1d4", type: "Piercing",
                  mastery: "nick", props: ["Finesse", "Light", "Thrown"], category: "Simple Melee",
                  range: "20/60 ft" },
  longsword:    { name: "Longsword",     slug: "equipment:weapon", die: "1d8", type: "Slashing",
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
  /* Transcribed from dnd2024.wikidot.com/spell:find-familiar. The sheet
     had it acting on your Initiative — it rolls its own — and had the
     senses and touch-delivery costs wrong. */
  findFamiliar: { name:"Find Familiar", lvl:1, slug:"spell:find-familiar", school:"Conjuration",
    time:"1 hour or Ritual", range:"10 ft", dur:"Instantaneous",
    comp:"V, S, M (burning incense worth 10+ GP, which the spell consumes)",
    tags:["utility","ritual","summon"], ritual:true, summons:"findFamiliar",
    text:"You gain the service of a familiar, a spirit that takes an animal form you choose: Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel, or another Beast that has a Challenge Rating of 0. The familiar has the statistics of the chosen form, though it is a Celestial, Fey, or Fiend (your choice) instead of a Beast. It acts independently of you, but it obeys your commands. Telepathic Connection: while within 100 feet you can communicate telepathically, and as a Bonus Action you can see through its eyes and hear what it hears until the start of your next turn, gaining the benefits of any special senses it has. When you cast a spell with a range of touch, the familiar can deliver the touch if it is within 100 feet and takes a Reaction to do so. In combat it is an ally, rolls its own Initiative and acts on its own turn; a familiar can't attack, but it can take other actions as normal. When it drops to 0 Hit Points it disappears, reappearing when you cast this spell again. As a Magic action you can temporarily dismiss it to a pocket dimension, or dismiss it forever; as a Magic action while dismissed you can return it to an unoccupied space within 30 feet. You can't have more than one familiar at a time — casting the spell while you have one instead causes it to adopt a new eligible form." },

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
  /* Transcribed from dnd2024.wikidot.com/spell:find-steed. The sheet
     previously carried the 2014 wording — a ritual, "until dispelled",
     five fixed animal forms with their own stat blocks, Charisma added
     to the mount's numbers. None of that survives into 2024: one
     Otherworldly Steed stat block that scales off the spell's level,
     and the animal is description only. */
  findSteed: { name:"Find Steed", lvl:2, slug:"spell:find-steed", school:"Conjuration",
    time:"Action", range:"30 ft", dur:"Instantaneous", comp:"V, S", tags:["utility","summon"],
    summons:"findSteed",
    text:"You summon an otherworldly being that appears as a loyal steed in an unoccupied space of your choice within range. This creature uses the Otherworldly Steed stat block. If you already have a steed from this spell, the steed is replaced by the new one. The steed resembles a Large, rideable animal of your choice, such as a horse, a camel, a dire wolf, or an elk. Whenever you cast the spell, choose the steed's creature type — Celestial, Fey, or Fiend — which determines certain traits in the stat block. In combat it shares your Initiative count and functions as a controlled mount while you ride it. If you have the Incapacitated condition, the steed takes its turn immediately after yours and acts independently, focusing on protecting you. The steed disappears if it drops to 0 Hit Points or if you die. Using a higher-level spell slot: use the slot's level for the spell's level in the stat block." },
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
  blinded:      { name:"Blinded",      slug:"srd:BlindedCondition",      text:"Can't see and automatically fail sight-based checks. Attacks against you have Advantage; your attacks have Disadvantage." },
  charmed:      { name:"Charmed",      slug:"srd:CharmedCondition",      text:"Can't attack the charmer or target them with harmful effects. The charmer has Advantage on ability checks to interact with you socially." },
  deafened:     { name:"Deafened",     slug:"srd:DeafenedCondition",     text:"Can't hear and automatically fail hearing-based checks." },
  frightened:   { name:"Frightened",   slug:"srd:FrightenedCondition",   text:"Disadvantage on ability checks and attacks while the source is visible. Can't willingly move closer to it." },
  grappled:     { name:"Grappled",     slug:"srd:GrappledCondition",     text:"Speed 0. Disadvantage on attacks against anyone but the grappler. Moves with the grappler." },
  incapacitated:{ name:"Incapacitated",slug:"srd:IncapacitatedCondition",text:"Can't take actions, Bonus Actions, or Reactions. Can't concentrate or speak. Initiative rolls have Disadvantage." },
  invisible:    { name:"Invisible",    slug:"srd:InvisibleCondition",    text:"You are Heavily Obscured for the purpose of hiding. Attacks against you have Disadvantage; your attacks have Advantage." },
  paralyzed:    { name:"Paralyzed",    slug:"srd:ParalyzedCondition",    text:"Incapacitated, can't move or speak, and auto-fail STR and DEX saves. Attacks against you have Advantage and hits within 5 ft are Critical Hits." },
  petrified:    { name:"Petrified",    slug:"srd:PetrifiedCondition",    text:"Turned to stone. Incapacitated, Resistance to all damage, Immunity to poison and disease, auto-fail STR and DEX saves." },
  poisoned:     { name:"Poisoned",     slug:"srd:PoisonedCondition",     text:"Disadvantage on attack rolls and ability checks." },
  prone:        { name:"Prone",        slug:"srd:ProneCondition",        text:"You can only crawl unless you stand up. Disadvantage on attacks. Attacks against you have Advantage within 5 ft, Disadvantage beyond." },
  restrained:   { name:"Restrained",   slug:"srd:RestrainedCondition",   text:"Speed 0. Attacks against you have Advantage; your attacks have Disadvantage. Disadvantage on DEX saves." },
  stunned:      { name:"Stunned",      slug:"srd:StunnedCondition",      text:"Incapacitated, can't move, and can speak only falteringly. Auto-fail STR and DEX saves. Attacks against you have Advantage." },
  unconscious:  { name:"Unconscious",  slug:"srd:UnconsciousCondition",  text:"Incapacitated, can't move or speak, and unaware. Drop what you're holding and fall Prone. Auto-fail STR and DEX saves. Attacks have Advantage; hits within 5 ft are Critical Hits." }
};

/* ============================================================
   SUMMONED FOLLOWERS
   Transcribed verbatim from dnd2024.wikidot.com. Nothing here is
   stored on a follower that the sheet can derive: the Otherworldly
   Steed's whole stat block scales off the SPELL's level and off your
   own numbers (spell attack, save DC, proficiency), so a follower
   record only ever holds what you chose and how hurt it is.
   ============================================================ */

/* "The steed resembles a Large, rideable animal of your choice, such as
   a horse, a camel, a dire wolf, or an elk." The form is description
   only — it changes no numbers — so this list is a convenience and
   anything you can name is equally legal. */
const STEED_FORMS = ["Horse", "Warhorse", "Camel", "Dire Wolf", "Elk",
                     "Giant Goat", "Giant Lizard", "Great Stag", "Panther", "Boar"];

/* The one choice that DOES change the stat block. */
const STEED_TYPES = {
  celestial: { key:"celestial", name:"Celestial", damage:"Radiant",
    ba: { name:"Healing Touch", recharge:"Recharges after a Long Rest",
          text:"One creature within 5 feet of the steed regains a number of Hit Points equal to 2d8 plus the spell's level." } },
  fey: { key:"fey", name:"Fey", damage:"Psychic",
    ba: { name:"Fey Step", recharge:"Recharges after a Long Rest",
          text:"The steed teleports, along with its rider, to an unoccupied space of your choice up to 60 feet away from itself." } },
  fiend: { key:"fiend", name:"Fiend", damage:"Necrotic",
    ba: { name:"Fell Glare", recharge:"Recharges after a Long Rest",
          text:"Wisdom Saving Throw: DC equals your spell save DC, one creature within 60 feet the steed can see. Failure: The target has the Frightened condition until the end of your next turn." } }
};

const STEED_ABILITIES = { str:18, dex:12, con:14, int:6, wis:12, cha:8 };

/* What can be summoned, and what stat block it uses. Keyed by the
   `summons` field on the spell, so adding a second summon is data. */
const FOLLOWER_SOURCES = {
  findSteed: {
    key:"findSteed", spell:"findSteed", label:"Find Steed",
    statName:"Otherworldly Steed", slug:"spell:find-steed",
    size:"Large", alignment:"Neutral", baseLevel:2,
    /* "If you already have a steed from this spell, the steed is
       replaced by the new one." */
    unique:true,
    defaultName:"Steed",
    /* The form is flavour; the creature type is what has teeth. */
    formIsFlavour:true
  },
  findFamiliar: {
    key:"findFamiliar", spell:"findFamiliar", label:"Find Familiar",
    slug:"spell:find-familiar", baseLevel:1,
    /* "You can't have more than one familiar at a time." */
    unique:true,
    defaultName:"Familiar",
    /* Here it is the other way round: the form IS the stat block, and
       the creature type only changes what the familiar counts as. */
    formIsFlavour:false
  }
};

/* ------------------------------------------------------------
   Which familiar to pick, and why. Table notes rather than rules —
   badged as such in the UI so it never reads like something out of the
   book. Every stat quoted here is checked against the scraped block by
   the tests, so the advice can't quietly drift from the numbers.
   ------------------------------------------------------------ */
const FAMILIAR_GUIDE = {
  label: "Table notes",
  typeAdvice: {
    pick: "celestial",
    text: "All three are equally exposed to the things that name creature types outright — " +
          "Protection from Evil and Good, Magic Circle — so the tiebreaker is what your own side " +
          "throws around. Effects that single out Fiends are common (Divine Smite's extra damage, " +
          "an ally's Advantage on saves forced by a Fiend); effects that single out Celestials are " +
          "rare. Celestial is the quietest choice.",
    /* The usual argument for this is a 2014 one and worth heading off. */
    correction: "Some guidance says a Paladin's Channel Divinity turns Fey and Fiends. That was " +
                "2014. In 2024 the Ancients' Channel Divinity is Nature's Wrath (a Strength save " +
                "for Restrained, any creature) and Devotion's is Sacred Weapon — no Paladin " +
                "turning survives, so nothing in Hal's own kit would rout his familiar."
  },
  categories: [
    { key:"aerial", name:"Aerial scouts & harassers",
      picks: [
        { form:"owl",
          why:"The best action economy in a fight. Flyby lets it move into a hostile creature's " +
              "reach, take the Help action or deliver a touch spell, and leave again without " +
              "provoking an Opportunity Attack." },
        { form:"bat",
          why:"Sharing its senses costs a Bonus Action, so this hands you 60 ft of Blindsight for " +
              "your Action — targeting through magical darkness, Fog Cloud or invisibility." },
        { form:"raven",
          why:"Mimicry copies simple sounds and voices: distract a patrol, trip something " +
              "listening, or pass a message along without it looking like magic." }
      ] },
    { key:"stealth", name:"Infiltration & stealth",
      picks: [
        { form:"spider",
          why:"Gets into places nothing else does — ceilings, under doors, through a keyhole — and " +
              "nobody in a dungeon looks twice at a spider." },
        { form:"weasel",
          why:"Stealth +5, tied for the best on the list — the fox, hare and almiraj match it if " +
              "you want a different look. The pick when beating a passive Perception is the " +
              "whole problem." },
        { form:"cat",
          why:"The town one. Slightly less Stealth than the weasel, but a cat on a wall or in a " +
              "market draws nothing at all when the roll goes badly." }
      ] },
    { key:"utility", name:"Utility & environment",
      picks: [
        { form:"baboon",
          why:"Hands. The only one on the list that can work a lever, open a door, or set " +
              "something down where you need it." },
        { form:"badger",
          why:"A burrow speed is the point — through loose earth past a blockade, or underground " +
              "mid-fight for full cover so it survives to keep being useful. Three CR 0 beasts " +
              "burrow, and on paper the fox is the best of them (Stealth +5, darkvision 60 ft, " +
              "half again the speed), so take the badger for the look rather than the numbers." },
        { form:"octopus",
          why:"The underwater one. Ink Cloud is an action rather than an attack, so a familiar " +
              "may use it — note the block: it only works while the octopus is underwater." }
      ] }
  ]
};

/* The three creature types a familiar can be. Unlike the steed's, this
   choice changes no numbers — it changes what the familiar IS, which
   matters to anything that keys off creature type. */
const FAMILIAR_TYPES = {
  celestial: { key:"celestial", name:"Celestial" },
  fey:       { key:"fey",       name:"Fey" },
  fiend:     { key:"fiend",     name:"Fiend" }
};

/* ============================================================
   COMBAT RULES THAT FOLLOWERS DEPEND ON
   Transcribed from the 2024 SRD, Playing the Game → Combat. Kept as
   data next to the followers that need it, because looking up whether a
   mount acts on your Initiative shouldn't mean leaving the table.
   ============================================================ */
const COMBAT_RULES = {
  source: "2024 SRD · Playing the Game → Combat",
  url: "https://5e24srd.com/playing-the-game/combat.html",
  sections: [
    { key:"mounted", name:"Mounted Combat",
      intro:"A willing creature that is at least one size larger than a rider and that has an " +
            "appropriate anatomy can serve as a mount, using the following rules.",
      parts: [
        { name:"Mounting and Dismounting",
          text:"During your move, you can mount a creature that is within 5 feet of you or " +
               "dismount. Doing so costs an amount of movement equal to half your Speed (round " +
               "down). For example, if your Speed is 30 feet, you spend 15 feet of movement to " +
               "mount a horse." },
        { name:"Controlling a Mount",
          text:"You can control a mount only if it has been trained to accept a rider. " +
               "Domesticated horses, mules, and similar creatures have such training. The " +
               "Initiative of a controlled mount changes to match yours when you mount it. It " +
               "moves on your turn as you direct it, and it has only three action options during " +
               "that turn: Dash, Disengage, and Dodge. A controlled mount can move and act even " +
               "on the turn that you mount it. In contrast, an independent mount — one that lets " +
               "you ride but ignores your control — retains its place in the Initiative order and " +
               "moves and acts as it likes." },
        { name:"Falling Off",
          text:"If an effect is about to move your mount against its will while you're on it, you " +
               "must succeed on a DC 10 Dexterity saving throw or fall off, landing with the Prone " +
               "condition in an unoccupied space within 5 feet of the mount. While mounted, you " +
               "must make the same save if you're knocked Prone or the mount is." }
      ] },
    { key:"opportunity", name:"Opportunity Attacks",
      intro:"Combatants watch for enemies to drop their guard. If you move heedlessly past your " +
            "foes, you put yourself in danger by provoking an Opportunity Attack.",
      parts: [
        { name:"Making an Opportunity Attack",
          text:"You can make an Opportunity Attack when a creature that you can see leaves your " +
               "reach. To make the attack, take a Reaction to make one melee attack with a weapon " +
               "or an Unarmed Strike against that creature. The attack occurs right before it " +
               "leaves your reach." },
        { name:"Avoiding Opportunity Attacks",
          text:"You can avoid provoking an Opportunity Attack by taking the Disengage action. You " +
               "also don't provoke an Opportunity Attack when you Teleport or when you are moved " +
               "without using your movement, action, Bonus Action, or Reaction." }
      ] },
    { key:"initiative", name:"Initiative",
      intro:"Initiative determines the order of turns during combat. When combat starts, every " +
            "participant rolls Initiative; they make a Dexterity check that determines their " +
            "place in the Initiative order.",
      parts: [
        { name:"Initiative Order",
          text:"A combatant's check total is called their Initiative count. The GM ranks the " +
               "combatants from highest to lowest Initiative. This is the order in which they act " +
               "during each round, and it remains the same from round to round." },
        { name:"Ties",
          text:"If a tie occurs, the GM decides the order among tied monsters, and the players " +
               "decide the order among tied characters. The GM decides the order if the tie is " +
               "between a monster and a player character." }
      ] }
  ]
};

const SIZE_ORDER = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

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

  /* ---- Summoned followers ----
     The Otherworldly Steed stat block, resolved for one follower. Every
     number is derived: AC and HP from the spell's level, the attack and
     the save DC from yours, proficiency shared with you outright. Cast
     with a higher slot and the whole block moves with it. */
  steedBlock(S, f) {
    const src = FOLLOWER_SOURCES.findSteed;
    const lv = Math.max(src.baseLevel, Math.min(9, f.spellLevel || src.baseLevel));
    const type = STEED_TYPES[f.creatureType] || STEED_TYPES.celestial;
    const atk = CALC.spellAttack(S).value;
    const abilities = {};
    Object.keys(STEED_ABILITIES).forEach(function (k) {
      const score = STEED_ABILITIES[k];
      /* The block lists save bonuses equal to the modifiers — the steed
         adds no proficiency to saves, so don't invent one. */
      abilities[k] = { score: score, mod: CALC.mod(score), save: CALC.mod(score) };
    });
    return {
      source: src, statName: src.statName, size: src.size, alignment: src.alignment,
      spellLevel: lv, type: type,
      ac: 10 + lv,
      maxHP: 5 + 10 * lv,
      hitDice: lv + "d10",
      canFly: lv >= 4,
      speed: "60 ft." + (lv >= 4 ? ", Fly 60 ft." : ""),
      abilities: abilities,
      passivePerception: 11,
      languages: "Telepathy 1 mile (works only with you)",
      cr: "None (XP 0; PB equals your Proficiency Bonus)",
      pb: CALC.profBonus(S.level),
      saveDC: CALC.spellSaveDC(S).value,
      formLabel: f.form,
      slam: { name:"Otherworldly Slam", bonus: atk, reach:"5 ft.",
              damage:"1d8 + " + lv, damageType: type.damage },
      cardLine:"Otherworldly Slam " + (atk >= 0 ? "+" : "−") + Math.abs(atk) +
               " · 1d8 + " + lv + " " + type.damage.toLowerCase(),
      /* Normalised so one renderer draws every follower's block. */
      traits: [{ name:"Life Bond",
                 text:"When you regain Hit Points from a level 1+ spell, the steed regains the " +
                      "same number of Hit Points if you're within 5 feet of it." }],
      actions: [{ name:"Otherworldly Slam",
                  meta:(atk >= 0 ? "+" : "−") + Math.abs(atk) + " to hit · 1d8 + " + lv + " " + type.damage,
                  text:"Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. " +
                       "Hit: 1d8 plus the spell's level of " + type.damage + " damage." }],
      bonusActions: [{ name: type.ba.name, meta: type.ba.recharge, text: type.ba.text, tracked: true }],
      reactions: [],
      bonusAction: type.ba,
      combat:"Shares your Initiative count. A controlled mount while you ride it. If you have " +
             "the Incapacitated condition, it takes its turn immediately after yours and acts " +
             "independently, protecting you.",
      ends:"Disappears at 0 Hit Points, or if you die.",
      /* The spell's own combat rules, broken out so each one can be
         found on its own rather than read out of a paragraph. */
      combatRules: [
        { name:"Initiative", text:"The steed shares your Initiative count — it acts on your turn, " +
          "so it never takes a place of its own in the turn order." },
        { name:"A controlled mount", text:"While you ride it, it functions as a controlled mount. " +
          "That means it moves on your turn as you direct it, and on that turn it has only three " +
          "action options: Dash, Disengage, and Dodge." },
        { name:"If you are Incapacitated", text:"The steed takes its turn immediately after yours " +
          "and acts independently, focusing on protecting you." },
        { name:"Disappearance", text:"The steed disappears if it drops to 0 Hit Points or if you " +
          "die. When it disappears it leaves behind anything it was wearing or carrying." },
        { name:"Casting it again", text:"If you already have a steed from this spell, the steed is " +
          "replaced by the new one — and you decide whether you summon back the steed that " +
          "disappeared or a different one." },
        { name:"A higher-level slot", text:"Use the spell slot's level for the spell's level in " +
          "the stat block: +1 AC and +10 Hit Points per level, +1 to the Slam's damage, and a " +
          "Fly Speed of 60 feet from level 4." }
      ]
    };
  },

  /* The familiar takes the chosen beast's stat block whole — nothing is
     derived from Hal — except that its creature type is replaced. The
     one rule the block itself doesn't say: a familiar can't attack, so
     the beast's attack is carried through but marked unusable rather
     than quietly dropped. */
  familiarBlock(S, f) {
    const src = FOLLOWER_SOURCES.findFamiliar;
    const beast = (typeof CR0_BEASTS !== "undefined" && CR0_BEASTS[f.form]) || null;
    if (!beast) return null;
    const type = FAMILIAR_TYPES[f.creatureType] || FAMILIAR_TYPES.celestial;
    const abilities = {};
    Object.keys(beast.abilities).forEach(function (k) {
      const a = beast.abilities[k];
      abilities[k] = { score: a.score, mod: a.mod, save: a.mod };
    });
    return {
      source: src, statName: beast.name, beast: beast,
      size: beast.size, alignment: beast.alignment,
      spellLevel: Math.max(src.baseLevel, f.spellLevel || src.baseLevel),
      type: type,
      ac: parseInt(beast.ac, 10),
      acNote: beast.ac,
      maxHP: parseInt(beast.hp, 10),
      hpNote: beast.hp,
      speed: beast.speed,
      canFly: /fly/i.test(beast.speed),
      abilities: abilities,
      skills: beast.skills || "",
      senses: beast.senses || "—",
      languages: beast.languages || "—",
      cr: beast.cr,
      formLabel: beast.name,
      cardLine: beast.speed + (beast.senses ? " · " + beast.senses : ""),
      /* The table note for this form, if it has one. */
      guide: (function () {
        let hit = null;
        FAMILIAR_GUIDE.categories.forEach(function (c) {
          c.picks.forEach(function (p) {
            if (p.form === f.form) hit = { category: c.name, why: p.why };
          });
        });
        return hit;
      })(),
      traits: beast.traits || [],
      actions: beast.actions || [],
      bonusActions: beast.bonusActions || [],
      reactions: beast.reactions || [],
      cantAttack:"A familiar can't attack, but it can take other actions as normal. " +
                 "Its stat block's attack is listed for reference only.",
      telepathy:"Telepathic Connection. Within 100 feet you can communicate telepathically. " +
                "As a Bonus Action you can see through its eyes and hear what it hears until the " +
                "start of your next turn, gaining the benefits of any special senses it has.",
      touchDelivery:"When you cast a spell with a range of touch, the familiar can deliver it — " +
                    "within 100 feet, using its Reaction.",
      combat:"An ally to you and your allies. Rolls its own Initiative and acts on its own turn.",
      ends:"Disappears at 0 Hit Points, and reappears when you cast the spell again.",
      combatRules: [
        { name:"Initiative", text:"Unlike a steed, the familiar rolls its own Initiative and acts " +
          "on its own turn — so it does belong in the turn order." },
        { name:"It can't attack", text:"A familiar can't attack, but it can take other actions as " +
          "normal. Its stat block's attack is listed here for reference only." },
        { name:"Telepathic Connection", text:"While it is within 100 feet of you, you can " +
          "communicate with it telepathically. As a Bonus Action you can see through its eyes and " +
          "hear what it hears until the start of your next turn, gaining the benefits of any " +
          "special senses it has." },
        { name:"Delivering touch spells", text:"When you cast a spell with a range of touch, the " +
          "familiar can deliver the touch. It must be within 100 feet of you, and it must take a " +
          "Reaction to deliver the touch when you cast the spell." },
        { name:"Disappearance", text:"When it drops to 0 Hit Points it disappears, leaving behind " +
          "anything it was wearing or carrying. It reappears after you cast this spell again." },
        { name:"The pocket dimension", text:"As a Magic action you can temporarily dismiss it to a " +
          "pocket dimension, or dismiss it forever. As a Magic action while it is dismissed, you " +
          "can cause it to reappear in an unoccupied space within 30 feet of you." },
        { name:"One familiar only", text:"You can't have more than one familiar at a time. Casting " +
          "the spell while you have one instead causes it to adopt a new eligible form." }
      ]
    };
  },

  /* "A willing creature that is at least one size larger than a rider…"
     — the sheet knows both sizes, so it can just answer the question
     instead of making you compare them. */
  canBeMount(S, block) {
    const rider = SIZE_ORDER.indexOf(S.identity.size);
    const beast = SIZE_ORDER.indexOf(block.size);
    if (rider < 0 || beast < 0) return { ok: false, why: "Sizes unknown." };
    const steps = beast - rider;
    if (steps >= 1) {
      return { ok: true, why: block.size + " is " + (steps === 1 ? "one size" : steps + " sizes") +
        " larger than " + S.identity.size + " — big enough to carry you." };
    }
    return { ok: false, why: block.size + " is not larger than " + S.identity.size +
      " — a mount has to be at least one size up, so this one can't be ridden." };
  },

  /* One entry point for every follower, whatever summoned it. */
  followerBlock(S, f) {
    if (!f) return null;
    if (f.source === "findSteed") return CALC.steedBlock(S, f);
    if (f.source === "findFamiliar") return CALC.familiarBlock(S, f);
    return null;
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
  /* 2: the display-size baseline changed — 100% now renders at what used
     to be 80%, which is the size this sheet is actually read at. Saved
     sheets have their uiScale rescaled once so nothing changes size under
     anyone; see migrate(). */
  schemaVersion: 2,
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
    takeHeart: false, auraOfProtection: false, editMode: false,
    railCollapsed: false, leftRailCollapsed: false,
    /* Held Inspiration. A toggle rather than a counter: you have it or
       you don't, and the screen edge says so until you spend it. */
    inspiration: false
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

  /* Summoned followers currently in play. A record holds only what you
     chose and how hurt it is — every stat comes from CALC.followerBlock,
     so levelling up or casting from a bigger slot moves the numbers. */
  followers: [],

  /* In-world date. `day` is the shared 1-364 global day both calendars
     run on, so `system` only changes how it's displayed, never the date
     itself. See calendar-data.js.

     `events` are dated notes: { id, day, year, timeOfDay, title, lead }.
     A null `year` repeats every year; a null `timeOfDay` means any time
     that day; `lead` is how many days early to start warning.
     `acked` holds "<year>:<day>:<id>" keys for reminders already seen,
     so a note fires once and then stays quiet. */
  calendar: { day: 1, year: 2022, system: "jerbeen", timeOfDay: "morning",
              view: "month", events: [], acked: [] },

  /* The world map. Nothing here is a copy of cyrnn-data.js — that file
     stays canonical and this holds only what the player has done to it,
     keyed by the ids it defines:

       edits   { placeId: {x,y,name,hidden} } — a nudged pin, a renamed
               one, one taken off the map. Sparse: only what changed.
       notes   { placeId: "..." } — your own text under the source's.
       custom  [ {id,name,x,y,kind,note} ] — pins with no canonical
               entry. Ids are prefixed "c-" so they can never collide.
       lore    [ {id,title,body,scope} ] — your own articles, scoped to
               a place, a region, or nothing at all (world-level).
       party   {x,y} or null — where the party is standing.

     Storing deltas rather than a snapshot is what lets the world grow:
     new places added to cyrnn-data.js simply appear, and nothing you
     have written or moved is disturbed. */
  map: { edits: {}, notes: {}, custom: [], lore: [], party: null,
         showLabels: true, off: {} },

  settings: {
    rollPrompts: true,      /* pop a "roll this, because of that" card */
    autoApplyEffects: true, /* effects change AC / attack numbers */
    economyLockout: true,   /* grey out what you can't afford */
    edgeGlow: true,         /* concentration and low-HP screen rim */
    creatureTracker: true,
    confirmOverride: true,  /* warn before spending economy you don't have */
    uiScale: 100            /* percent — whole-UI zoom, not just font */
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
    STEED_FORMS, STEED_TYPES, STEED_ABILITIES, FOLLOWER_SOURCES, FAMILIAR_TYPES, FAMILIAR_GUIDE,
    COMBAT_RULES, SIZE_ORDER,
    SKILL_ABILITY, SKILL_NAMES, ABILITY_NAMES, CALC, SEED };
}
