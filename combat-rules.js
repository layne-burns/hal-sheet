/* ============================================================
   COMBAT RULES — action economy, castable metadata, effects.
   Extends rules.js. Still pure data + math, no DOM.
   ============================================================ */

/* ---------- ACTION ECONOMY ---------------------------------- */
/* cost.type: "action" | "bonus" | "reaction" | "free"
   cost.slot: spell level that must be paid with a slot, or null
   cost.res:  a resource key that is decremented, or null
   2024: you may expend only ONE spell slot per turn. That is a
   separate budget from Action / Bonus Action.                  */

const ROUND_SECONDS = 6;
function minutesToRounds(m) { return Math.round((m * 60) / ROUND_SECONDS); }

/* ---------- CASTABLE METADATA ------------------------------
   Keyed by spell id. Anything absent is castable but produces
   no tracked effect.
     effect  — what to add to the active-effects list
     rolls   — prompts raised immediately after casting
     cost    — action economy
   Effect mods the engine understands:
     ac, attackDie, saveDie, weaponDamageDie, tempHPPerTurn,
     acAlly, note                                               */
const SPELL_META = {
  bless: {
    cost: { type: "action", slot: 1 },
    effect: { name: "Bless", conc: true, rounds: minutesToRounds(1),
      mods: { attackDie: "1d4", saveDie: "1d4" },
      note: "You and 2 allies add 1d4 to attack rolls and saving throws." },
    rolls: [{ who: "you", when: "onAttack", dice: "1d4",
      label: "Add 1d4 to the attack roll", why: "Bless" }]
  },
  command: {
    cost: { type: "action", slot: 1 },
    rolls: [{ who: "target", save: "wis",
      label: "Wisdom saving throw", why: "Command — on a failure it obeys a one-word command on its next turn" }]
  },
  compelledDuel: {
    cost: { type: "bonus", slot: 1 },
    effect: { name: "Compelled Duel", conc: true, rounds: minutesToRounds(1),
      note: "Target has Disadvantage attacking anyone but you and can't move away from you." },
    rolls: [{ who: "target", save: "wis",
      label: "Wisdom saving throw", why: "Compelled Duel" }]
  },
  cureWounds: {
    cost: { type: "action", slot: 1 },
    rolls: [{ who: "you", dice: "2d8", mod: "cha",
      label: "Healing restored", why: "Cure Wounds — 2d8 plus your Charisma modifier" }]
  },
  divineFavor: {
    cost: { type: "bonus", slot: 1 },
    effect: { name: "Divine Favour", conc: false, rounds: minutesToRounds(1),
      mods: { weaponDamageDie: "1d4 Radiant" },
      note: "Your weapon attacks deal an extra 1d4 Radiant damage." },
    rolls: [{ who: "you", when: "onHit", dice: "1d4",
      label: "Extra Radiant damage", why: "Divine Favour" }]
  },
  shieldOfFaith: {
    cost: { type: "bonus", slot: 1 },
    effect: { name: "Shield of Faith", conc: true, rounds: minutesToRounds(10),
      mods: { ac: 2 }, note: "+2 AC to the target." }
  },
  heroism: {
    cost: { type: "action", slot: 1 },
    effect: { name: "Heroism", conc: true, rounds: minutesToRounds(1),
      mods: { tempHPPerTurn: "cha" },
      note: "Immune to Frightened; gains Temp HP equal to your CHA modifier at the start of each of its turns." }
  },
  protectionFromEvilAndGood: {
    cost: { type: "action", slot: 1 },
    effect: { name: "Protection from Evil and Good", conc: true, rounds: minutesToRounds(10),
      note: "Aberrations, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attacks against the target." }
  },
  detectMagic: { cost: { type: "action", slot: 1 },
    effect: { name: "Detect Magic", conc: true, rounds: minutesToRounds(10),
      note: "Sense magical effects within 30 ft." } },
  detectEvilAndGood: { cost: { type: "action", slot: 1 },
    effect: { name: "Detect Evil and Good", conc: true, rounds: minutesToRounds(10),
      note: "Know the location of listed creature types within 30 ft." } },
  detectPoisonAndDisease: { cost: { type: "action", slot: 1 },
    effect: { name: "Detect Poison and Disease", conc: true, rounds: minutesToRounds(10),
      note: "Sense poisons and contagions within 30 ft." } },
  purifyFoodAndDrink: { cost: { type: "action", slot: 1 } },
  speakWithAnimals: { cost: { type: "action", slot: 1 },
    effect: { name: "Speak with Animals", conc: false, rounds: minutesToRounds(10),
      note: "Communicate with Beasts." } },

  /* --- Smites: Bonus Action, only after a hit lands --- */
  divineSmite: {
    cost: { type: "bonus", slot: 1 }, afterHit: true, freeRes: "freeSmite",
    rolls: [{ who: "you", dice: "2d8",
      label: "Radiant damage — add 1d8 more if the target is a Fiend or Undead",
      why: "Divine Smite" }]
  },
  searingSmite: {
    cost: { type: "bonus", slot: 1 }, afterHit: true,
    effect: { name: "Searing Smite — burning", conc: false, rounds: minutesToRounds(1),
      note: "Target takes 1d6 Fire at the end of each of its turns until it makes a CON save as an action." },
    rolls: [{ who: "you", dice: "1d6", label: "Fire damage", why: "Searing Smite" },
            { who: "target", save: "con", label: "Constitution save to end the burning",
              why: "Searing Smite — repeats as an action on its turn" }]
  },
  thunderousSmite: {
    cost: { type: "bonus", slot: 1 }, afterHit: true,
    rolls: [{ who: "you", dice: "2d6", label: "Thunder damage", why: "Thunderous Smite" },
            { who: "target", save: "str", label: "Strength save or be pushed 10 ft and knocked Prone",
              why: "Thunderous Smite" }]
  },
  wrathfulSmite: {
    cost: { type: "bonus", slot: 1 }, afterHit: true,
    rolls: [{ who: "you", dice: "1d6", label: "Psychic damage", why: "Wrathful Smite" },
            { who: "target", save: "wis", label: "Wisdom save or be Frightened until the end of your next turn",
              why: "Wrathful Smite" }]
  },
  ensnaringStrike: {
    cost: { type: "bonus", slot: 1 }, afterHit: true,
    effect: { name: "Ensnaring Strike", conc: true, rounds: minutesToRounds(1),
      note: "Target is Restrained and takes 1d6 Piercing at the start of each of its turns." },
    applyToTarget: { condition: "restrained", save: "str", repeat: "action",
      label: "Restrained by Ensnaring Strike" },
    rolls: [{ who: "target", save: "str", label: "Strength save or be Restrained", why: "Ensnaring Strike" }]
  },
  shiningSmite: {
    cost: { type: "bonus", slot: 2 }, afterHit: true,
    effect: { name: "Shining Smite", conc: true, rounds: minutesToRounds(1),
      note: "Target sheds Dim Light and attack rolls against it have Advantage." },
    rolls: [{ who: "you", dice: "2d6", label: "Radiant damage", why: "Shining Smite" }]
  },

  /* --- Level 2 --- */
  aid: { cost: { type: "action", slot: 2 },
    effect: { name: "Aid", conc: false, rounds: minutesToRounds(480),
      note: "Three creatures each gain 5 Temp HP for 8 hours." } },
  lesserRestoration: { cost: { type: "action", slot: 2 } },
  magicWeapon: { cost: { type: "bonus", slot: 2 },
    effect: { name: "Magic Weapon", conc: false, rounds: minutesToRounds(60),
      mods: { attackFlat: 1, damageFlat: 1 }, note: "Weapon gains +1 to attack and damage." } },
  prayerOfHealing: { cost: { type: "action", slot: 2 } },
  protectionFromPoison: { cost: { type: "action", slot: 2 },
    effect: { name: "Protection from Poison", conc: false, rounds: minutesToRounds(60),
      note: "Advantage on saves vs Poisoned; Resistance to Poison damage." } },
  wardingBond: { cost: { type: "action", slot: 2 },
    effect: { name: "Warding Bond", conc: false, rounds: minutesToRounds(60),
      note: "Target gains +1 AC, +1 saves, Resistance to all damage. You take the same damage it takes." } },
  zoneOfTruth: { cost: { type: "action", slot: 2 },
    effect: { name: "Zone of Truth", conc: false, rounds: minutesToRounds(10),
      note: "15-ft Sphere; creatures make a CHA save or can't knowingly lie." },
    rolls: [{ who: "target", save: "cha", label: "Charisma save", why: "Zone of Truth" }] },
  mistyStep: { cost: { type: "bonus", slot: 2 } },
  moonbeam: { cost: { type: "action", slot: 2 },
    effect: { name: "Moonbeam", conc: true, rounds: minutesToRounds(1),
      note: "5-ft radius Cylinder; 2d10 Radiant on a failed CON save, half on a success." },
    rolls: [{ who: "target", save: "con", label: "Constitution save — 2d10 Radiant, half on a success",
      why: "Moonbeam" }] },
  findSteed: { cost: { type: "action", slot: 2 }, freeRes: "faithfulSteed" },
  gentleRepose: { cost: { type: "action", slot: 2 } },
  locateObject: { cost: { type: "action", slot: 2 },
    effect: { name: "Locate Object", conc: true, rounds: minutesToRounds(10),
      note: "Sense the direction to a familiar object within 1,000 ft." } },

  /* --- Cantrips and granted --- */
  prestidigitation: { cost: { type: "action", slot: null } },
  mageHand: { cost: { type: "action", slot: null },
    effect: { name: "Mage Hand", conc: false, rounds: minutesToRounds(1),
      note: "Spectral hand; move and manipulate as a Magic action." } },
  findFamiliar: { cost: { type: "action", slot: 1 }, freeRes: "findFamiliar", ritualOnly: true }
};

/* ---------- NON-SPELL ACTIONS ------------------------------- */
const ACTION_CATALOG = [
  { id: "attack", name: "Attack action", cost: { type: "action" }, tags: ["damage", "melee"],
    slug: "srd:AttackAction", text: "Make your weapon attacks. With Nick active, the off-hand Light attack happens inside this action." },
  { id: "layOnHands", name: "Lay on Hands", cost: { type: "bonus", res: "layOnHands" },
    tags: ["healing", "touch", "bonus"], slug: "paladin:main",
    text: "Touch a creature and restore HP from the pool. Or spend 5 to remove the Poisoned condition." },
  { id: "divineSense", name: "Channel Divinity: Divine Sense",
    cost: { type: "bonus", res: "channelDivinity" }, tags: ["utility", "bonus", "selfOnly", "channelDivinity"],
    slug: "paladin:main",
    text: "Detect Celestials, Fiends, and Undead within 60 ft for 10 minutes.",
    effect: { name: "Divine Sense", conc: false, rounds: minutesToRounds(10),
      note: "Know the location and type of Celestials, Fiends, and Undead within 60 ft." } },
  { id: "naturesWrath", name: "Channel Divinity: Nature's Wrath",
    cost: { type: "action", res: "channelDivinity" }, tags: ["control", "aoe", "channelDivinity"],
    slug: "paladin:oath-of-the-ancients",
    text: "Each creature of your choice within 15 ft makes a Strength save or is Restrained for 1 minute.",
    applyToTarget: { condition: "restrained", save: "str", repeat: "endOfTurn",
      label: "Restrained by Nature's Wrath" },
    rolls: [{ who: "target", save: "str",
      label: "Strength saving throw for EACH target", why: "Nature's Wrath — Restrained on a failure" }] },
  { id: "help", name: "Help (Team Tactics)", cost: { type: "bonus" }, tags: ["support", "bonus"],
    slug: "srd:HelpAction", text: "Aid an ally: they gain Advantage on their next ability check or attack. Team Tactics makes this a Bonus Action for you." },
  { id: "dash", name: "Dash", cost: { type: "action" }, tags: ["utility"], slug: "srd:DashAction",
    text: "Gain extra movement equal to your Speed for this turn." },
  { id: "disengage", name: "Disengage", cost: { type: "action" }, tags: ["utility"], slug: "srd:DisengageAction",
    text: "Your movement doesn't provoke Opportunity Attacks this turn." },
  { id: "dodge", name: "Dodge", cost: { type: "action" }, tags: ["defense"], slug: "srd:DodgeAction",
    text: "Attacks against you have Disadvantage and you have Advantage on DEX saves, until your next turn.",
    effect: { name: "Dodging", conc: false, rounds: 1,
      note: "Attacks against you have Disadvantage; Advantage on DEX saves." } },
  { id: "hide", name: "Hide", cost: { type: "action" }, tags: ["utility"], slug: "srd:HideAction",
    text: "Make a DC 15 Stealth check to gain the Invisible condition.",
    rolls: [{ who: "you", dice: "1d20", mod: "stealth", label: "Stealth check vs DC 15",
      why: "Hide — note scale mail gives Disadvantage" }] },
  { id: "shove", name: "Shove", cost: { type: "action" }, tags: ["control", "melee"], slug: "srd:UnarmedStrike",
    text: "Athletics vs the target's Athletics or Acrobatics. On a success, push 5 ft or knock Prone." },
  { id: "opportunity", name: "Opportunity Attack", cost: { type: "reaction" }, tags: ["damage", "reaction", "melee"],
    slug: "srd:OpportunityAttacks", text: "When a creature you can see leaves your reach, make one melee attack against it." },
  { id: "grapple", name: "Grapple", cost: { type: "action" }, tags: ["control", "melee"], slug: "srd:Grappling",
    text: "Athletics vs the target's Athletics or Acrobatics. On a success it has the Grappled condition." }
];

/* ---------- EXTENDED MATH ----------------------------------- */
Object.assign(CALC, {

  /* Sum of every numeric modifier from currently active effects */
  activeMods(S) {
    const out = { ac: 0, attackFlat: 0, damageFlat: 0, attackDice: [], saveDice: [], damageDice: [] };
    (S.effects || []).forEach(function (e) {
      const m = e.mods || {};
      if (m.ac) out.ac += m.ac;
      if (m.attackFlat) out.attackFlat += m.attackFlat;
      if (m.damageFlat) out.damageFlat += m.damageFlat;
      if (m.attackDie) out.attackDice.push({ die: m.attackDie, from: e.name });
      if (m.saveDie) out.saveDice.push({ die: m.saveDie, from: e.name });
      if (m.weaponDamageDie) out.damageDice.push({ die: m.weaponDamageDie, from: e.name });
    });
    return out;
  },

  /* Is a cost affordable given the current turn's budget? */
  affordable(S, cost) {
    if (!cost) return { ok: true, reasons: [] };
    const reasons = [];
    const c = S.combat || {};
    if (c.active) {
      if (cost.type === "action" && c.turn.action) reasons.push("Action already used this turn");
      if (cost.type === "bonus" && c.turn.bonus) reasons.push("Bonus Action already used this turn");
      if (cost.type === "reaction" && c.turn.reaction) reasons.push("Reaction already used this round");
      if (cost.slot && c.turn.slotUsed) reasons.push("You may expend only one spell slot per turn (2024)");
    }
    if (cost.slot) {
      const max = CALC.slotsMax(S)[cost.slot] || 0;
      const used = (S.resources.slots[cost.slot] || {}).used || 0;
      if (max - used <= 0) reasons.push("No level " + cost.slot + " spell slots remaining");
    }
    if (cost.res) {
      const have = S.resources[cost.res] || 0;
      if (have <= 0) reasons.push("No " + cost.res + " remaining");
    }
    return { ok: reasons.length === 0, reasons: reasons };
  },

  /* Can this smite be cast for free instead of spending a slot? */
  freeCastAvailable(S, key) {
    const meta = SPELL_META[key];
    if (!meta || !meta.freeRes) return false;
    return (S.resources[meta.freeRes] || 0) > 0;
  },

  /* Everything Hal could do right now, with affordability attached */
  castables(S) {
    const out = [];
    const oath = [];
    Object.keys(OATH_SPELLS).forEach(function (lv) {
      if (S.level >= parseInt(lv, 10)) oath.push.apply(oath, OATH_SPELLS[lv]);
    });
    const spellKeys = S.preparedSpells
      .concat(oath).concat(S.cantrips)
      .concat(["divineSmite", S.magicInitiate.spell])
      .concat(S.level >= 5 ? ["findSteed"] : []);

    /* de-duplicate */
    const seen = {};
    spellKeys.forEach(function (k) {
      if (seen[k] || !SPELLS[k]) return;
      seen[k] = true;
      const sp = SPELLS[k];
      const meta = SPELL_META[k] || { cost: { type: "action", slot: sp.lvl || null } };
      const cost = meta.cost || { type: "action", slot: sp.lvl || null };
      const free = CALC.freeCastAvailable(S, k);
      /* A free cast bypasses both the slot and the one-slot-per-turn rule */
      const effCost = free ? { type: cost.type, slot: null, res: meta.freeRes } : cost;
      const aff = CALC.affordable(S, effCost);
      out.push({
        kind: "spell", id: k, name: sp.name, slug: sp.slug, lvl: sp.lvl,
        tags: sp.tags, text: sp.text, cost: effCost, rawCost: cost, free: free,
        afterHit: !!meta.afterHit, affordable: aff.ok, reasons: aff.reasons,
        effect: meta.effect, rolls: meta.rolls, applyToTarget: meta.applyToTarget
      });
    });

    ACTION_CATALOG.forEach(function (a) {
      const aff = CALC.affordable(S, a.cost);
      out.push({
        kind: "action", id: a.id, name: a.name, slug: a.slug, tags: a.tags, text: a.text,
        cost: a.cost, affordable: aff.ok, reasons: aff.reasons,
        effect: a.effect, rolls: a.rolls, applyToTarget: a.applyToTarget
      });
    });
    return out;
  },

  /* Fresh turn budget */
  freshTurn() {
    return { action: false, bonus: false, reaction: false, movementUsed: 0, slotUsed: false, hitLanded: false };
  },

  /* ---- Turn order (party + Hal + creatures) ---- */
  currentCombatant(S) {
    const order = S.combat.order;
    if (!order.length) return null;
    return order.filter(function (o) { return o.id === S.combat.currentId; })[0] || null;
  },

  /* Live name lookup for an order entry's ref. Order entries deliberately
     don't cache a name — if you rename a party member or creature mid
     fight, the turn order should reflect that, not a stale snapshot from
     whenever they were added to it. Returns "(removed)" if whoever it
     pointed at was since deleted, rather than throwing. */
  combatantName(S, ref) {
    if (!ref) return "?";
    if (ref.type === "hal") return S.identity.name || "Hal";
    if (ref.type === "party") {
      const m = (S.party.roster || []).filter(function (x) { return x.id === ref.partyId; })[0];
      return m ? m.name : "(removed)";
    }
    /* A foe carries its own name on the entry. There is no roster behind
       it on purpose: the table rolls one initiative for the goblins, so
       the sheet holds one line for the goblins. */
    if (ref.type === "follower") {
      const f = (S.followers || []).filter(function (x) { return x.id === ref.followerId; })[0];
      return f ? f.name : "(gone)";
    }
    if (ref.type === "foe") return ref.name || "Enemy";
    return "?";
  },

  /* Which face an order entry wears, looked up live for the same reason
     the name is: a party member's portrait belongs to the roster, so
     changing it there has to change it everywhere at once rather than
     leaving a stale copy in whatever fight was running at the time. A
     foe has no roster behind it, so its face rides on the entry. */
  combatantToken(S, ref) {
    if (!ref) return null;
    if (ref.type === "party") {
      const m = (S.party.roster || []).filter(function (x) { return x.id === ref.partyId; })[0];
      return m && typeof m.token === "number" ? m.token : null;
    }
    if (ref.type === "follower") {
      const f = (S.followers || []).filter(function (x) { return x.id === ref.followerId; })[0];
      return f && typeof f.token === "number" ? f.token : null;
    }
    if (ref.type === "foe") return typeof ref.token === "number" ? ref.token : null;
    return null;
  },

  /* Everything between here and your next turn, worked out in one go.

     The table keeps its own initiative, so the sheet's turn order is a
     record of it rather than the thing driving it — which means the turns
     between yours often go by without anyone pressing anything here, and
     you come back to a sheet that thinks it is still the goblin's go.
     Rather than press Next four times to catch up, press this once.

     It walks the same step the single-turn version walks, counting the
     round boundaries it crosses, so the two can't disagree about what a
     lap costs. Returns null when there is nobody to walk to: no order at
     all, or an order Hal isn't in — which would otherwise loop forever. */
  peekToMyTurn(S) {
    const order = S.combat.order;
    if (!order.length) return null;
    if (!order.some(function (o) { return o.ref.type === "hal"; })) return null;

    let curId = S.combat.currentId;
    let wraps = 0, steps = 0;
    /* One full lap is the most it can ever take; the guard above means we
       always hit Hal before the bound, and the bound means a corrupt order
       can't hang the app. */
    for (let i = 0; i <= order.length; i++) {
      const idx = order.findIndex(function (o) { return o.id === curId; });
      const nextIdx = (idx + 1) % order.length;
      /* idx === -1 means the current marker isn't in the order — the same
         case peekNextTurn treats as "start at the top, no wrap". */
      if (idx !== -1 && nextIdx <= idx) wraps += 1;
      curId = order[nextIdx].id;
      steps += 1;
      if (order[nextIdx].ref.type === "hal") break;
    }
    return { nextId: curId, wraps: wraps, steps: steps };
  },

  /* Pure peek at what pressing Next would do, so the caller can snapshot
     expiring effects BEFORE mutating state (same pattern as solo play). */
  peekNextTurn(S) {
    const order = S.combat.order;
    if (!order.length) {
      return { wraps: true, nextId: null, becomesHal: true, name: S.identity.name || "Hal" };
    }
    const idx = order.findIndex(function (o) { return o.id === S.combat.currentId; });
    const nextIdx = (idx + 1) % order.length;
    const wraps = idx === -1 ? false : nextIdx <= idx;
    const next = order[nextIdx];
    return {
      wraps: wraps, nextId: next.id, becomesHal: next.ref.type === "hal",
      name: CALC.combatantName(S, next.ref)
    };
  }
});

/* ---------- ARMOR CLASS AND ATTACKS, NOW EFFECT-AWARE -------- */
/* Wrap rather than rewrite, so the base math stays testable alone. */
CALC._baseArmorClass = CALC.armorClass;
CALC.armorClass = function (S) {
  const base = CALC._baseArmorClass(S);
  const mods = CALC.activeMods(S);
  if (!mods.ac) return base;
  const sources = base.sources.slice();
  (S.effects || []).forEach(function (e) {
    if (e.mods && e.mods.ac) sources.push({ kind: "feature", label: e.name, value: e.mods.ac });
  });
  return { value: base.value + mods.ac, sources: sources, stealthDis: base.stealthDis };
};

CALC._baseAttackAction = CALC.attackAction;
CALC.attackAction = function (S) {
  const a = CALC._baseAttackAction(S);
  const mods = CALC.activeMods(S);
  a.riders = [];
  mods.attackDice.forEach(function (d) { a.riders.push({ on: "attack", die: d.die, from: d.from }); });
  mods.damageDice.forEach(function (d) { a.riders.push({ on: "damage", die: d.die, from: d.from }); });
  if (mods.attackFlat || mods.damageFlat) {
    a.rows.forEach(function (r) {
      r.toHit += mods.attackFlat;
      if (mods.damageFlat) {
        r.damage = r.damage.replace(/\+(\d+)$/, function (_, n) {
          return "+" + (parseInt(n, 10) + mods.damageFlat);
        });
      }
    });
  }
  return a;
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SPELL_META, ACTION_CATALOG, minutesToRounds, ROUND_SECONDS };
}
