/* ============================================================
   CR 0 BEASTS — the eligible forms for Find Familiar
   ------------------------------------------------------------
   "another Beast that has a Challenge Rating of 0" is the whole
   eligibility rule, so this is that list: every CR 0 beast with a real
   entry on dndroll.wikidot.com/creatures:beasts, transcribed as data.
   Generated, not hand-written — see scrape-beasts.js in the scratchpad.

   A familiar uses the chosen form's stat block exactly, except that its
   creature type becomes Celestial, Fey or Fiend, so nothing here is
   derived from Hal.
   ============================================================ */

const CR0_BEASTS = {
  "almiraj": {
    "key": "almiraj",
    "name": "Almiraj",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "3 (1d6)",
    "speed": "50 ft.",
    "skills": "Perception +4, Stealth +5",
    "senses": "darkvision 30 ft., passive Perception 14",
    "languages": "—",
    "cr": "0 (0 or 10 XP)",
    "source": "Tomb of Annihilation",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 14,
        "mod": 2
      },
      "cha": {
        "score": 10,
        "mod": 0
      }
    },
    "traits": [
      {
        "name": "Familiar",
        "text": "With the DM's permission, the Find Familiar spell can summon an almiraj."
      },
      {
        "name": "Keen Senses",
        "text": "The almiraj has advantage on Wisdom (Perception) checks that rely on hearing or sight."
      }
    ],
    "actions": [
      {
        "name": "Horn",
        "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage. Description An almiraj (pronounced AWL-meer-ahj) is a large, timid rabbit with a 1-foot-long spiral horn emerging from its forehead, not unlike the horn of a unicorn. If driven to attack, it tries to spear enemies with its horn. Almiraj were brought to Chult long ago by merchants of the distant land of Zakhara. Skilled at evading predators, these creatures have flourished throughout the tropical peninsula. They live in earthen burrows and can be captured and domesticated. With the DM's permission, the Find Familiar spell can summon an almiraj."
      }
    ],
    "slug": "creatures:almiraj"
  },
  "baboon": {
    "key": "baboon",
    "name": "Baboon",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "3 (1d6)",
    "speed": "30 ft., climb 30 ft.",
    "senses": "Passive Perception 11",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 8,
        "mod": -1
      },
      "dex": {
        "score": 14,
        "mod": 2
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 4,
        "mod": -3
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 6,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Pack Tactics",
        "text": "The baboon has advantage on an attack roll against a creature if at least one of the baboon's allies is within 5 feet of the creature and the ally isn't incapacitated."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +1 to hit, reach 5 ft., one target. Hit: 1 (1d4 − 1) piercing damage."
      }
    ],
    "slug": "creatures:baboon"
  },
  "badger": {
    "key": "badger",
    "name": "Badger",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "3 (1d4 + 1)",
    "speed": "20 ft., burrow 5 ft.",
    "senses": "Darkvision 30 ft., Passive Perception 11",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 4,
        "mod": -3
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 12,
        "mod": 1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Keen Smell",
        "text": "The badger has advantage on Wisdom (Perception) checks that rely on smell."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:badger"
  },
  "bat": {
    "key": "bat",
    "name": "Bat",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "1 (1d4 - 1)",
    "speed": "5 ft., fly 30 ft.",
    "senses": "Blindsight 60 ft., Passive Perception 11",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Echolocation",
        "text": "The bat can't use its blindsight while deafened."
      },
      {
        "name": "Keen Hearing",
        "text": "The bat has advantage on Wisdom (Perception) checks that rely on hearing."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one creature. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:bat"
  },
  "cat": {
    "key": "cat",
    "name": "Cat",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "2 (1d4)",
    "speed": "40 ft., climb 30 ft.",
    "skills": "Perception +3, Stealth +4",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 3,
        "mod": -4
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 3,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 7,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Smell",
        "text": "The cat has advantage on Wisdom (Perception) checks that rely on smell."
      }
    ],
    "actions": [
      {
        "name": "Claws",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 slashing damage."
      }
    ],
    "slug": "creatures:cat"
  },
  "crab": {
    "key": "crab",
    "name": "Crab",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11 (Natural Armor)",
    "hp": "2 (1d4)",
    "speed": "20 ft., swim 20 ft.",
    "skills": "Stealth +2",
    "senses": "Blindsight 30 ft., Passive Perception 9",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 8,
        "mod": -1
      },
      "cha": {
        "score": 2,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Amphibious",
        "text": "The crab can breathe air and water."
      }
    ],
    "actions": [
      {
        "name": "Claw",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 bludgeoning damage."
      }
    ],
    "slug": "creatures:crab"
  },
  "craniumRat": {
    "key": "craniumRat",
    "name": "Cranium Rat",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "lawful evil",
    "ac": "12",
    "hp": "2 (1d4)",
    "speed": "30 ft.",
    "senses": "darkvision 30 ft.",
    "languages": "telepathy 30 ft.",
    "cr": "0 (10 XP)",
    "source": "Volo's Guide to Monsters",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 14,
        "mod": 2
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 4,
        "mod": -3
      },
      "wis": {
        "score": 11,
        "mod": 0
      },
      "cha": {
        "score": 8,
        "mod": -1
      }
    },
    "traits": [
      {
        "name": "Illumination",
        "text": "As a bonus action, the cranium rat can shed dim light from its brain in a 5-foot radius or extinguish the light."
      },
      {
        "name": "Telepathic Shroud",
        "text": "The cranium rat is immune to any effect that would sense its emotions or read its thoughts, as well as to all divination spells."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1 piercing damage. Description Mind flayers create cranium rats by bombarding normal rats with psionic energy."
      },
      {
        "name": "Evil Collectives",
        "text": "Cranium rats are no smarter than ordinary rats and behave as such. However, if enough cranium rats come together to form a swarm, they merge their minds into a single intelligence with the accumulated memories of all the swarm's constituents. The rats become smarter as a result, and they retain their heightened intelligence for as long as the swarm persists. The swarm also awakens latent psionic abilities implanted within each cranium rat by its mind flayer creators, bestowing upon the swarm psionic powers similar to spells. A rat separated from the swarm becomes an ordinary cranium rat with an Intelligence of 15. It loses 1 point of Intelligence each day that it remains separated from the swarm. Its Intelligence can't drop below 4 and becomes 15 again if it rejoins the swarm or another one."
      },
      {
        "name": "Telepathic Vermin",
        "text": "A single, low-intelligence cranium rat uses its natural telepathy to communicate hunger, fear, and other base emotions. A swarm of cranium rats communicating telepathically \"speaks\" as one creature, often referring to itself using the collective pronouns \"we\" and \"us.\""
      },
      {
        "name": "Spies for an Elder Brain",
        "text": "Mind flayer colonies use cranium rats as spies. The rats invade surface communities and act as eyes and ears for the elder brain, transmitting their thoughts when they swarm and are within range of the elder brain's telepathy. Cranium rats occasionally spread beyond the elder brain's range of influence. Whatever these rats do is of no concern to the elder brain, and the illithids can always make more if they so desire."
      }
    ],
    "slug": "creatures:cranium-rat-legacy"
  },
  "deer": {
    "key": "deer",
    "name": "Deer",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "4 (1d8)",
    "speed": "50 ft.",
    "senses": "Passive Perception 12",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 11,
        "mod": 0
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 14,
        "mod": 2
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) piercing damage."
      }
    ],
    "slug": "creatures:deer"
  },
  "eagle": {
    "key": "eagle",
    "name": "Eagle",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "3 (1d6)",
    "speed": "10 ft., fly 60 ft.",
    "skills": "Perception +4",
    "senses": "Passive Perception 14",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 6,
        "mod": -2
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 14,
        "mod": 2
      },
      "cha": {
        "score": 7,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Sight",
        "text": "The eagle has advantage on Wisdom (Perception) checks that rely on sight."
      }
    ],
    "actions": [
      {
        "name": "Talons",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage."
      }
    ],
    "slug": "creatures:eagle"
  },
  "fox": {
    "key": "fox",
    "name": "Fox",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "2 (1d4)",
    "speed": "30 ft., burrow 5 ft.",
    "skills": "Perception +3, Stealth +5",
    "senses": "darkvision 60 ft., passive Perception 13",
    "languages": "-",
    "cr": "0 (10 XP)",
    "source": "Icewind Dale - Rime of the Frostmaiden",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 3,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 6,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Hearing",
        "text": "The fox has advantage on Wisdom (Perception) checks that rely on hearing."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 1 piercing damage. Description The white arctic foxes of Icewind Dale live in burrows and are acclimated to cold weather. They prowl the outskirts of Ten-Towns and nearby forests for food, hunting hares or stealing fish. These timid creatures avoid contact with humanoids, but they are sometimes used as mounts by Chwingas."
      }
    ],
    "slug": "creatures:fox"
  },
  "frog": {
    "key": "frog",
    "name": "Frog",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "1 (1d4 - 1)",
    "speed": "20 ft., swim 20 ft.",
    "skills": "Perception +1, Stealth +3",
    "senses": "Darkvision 30 ft., Passive Perception 11",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 1,
        "mod": -5
      },
      "dex": {
        "score": 13,
        "mod": 1
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 8,
        "mod": -1
      },
      "cha": {
        "score": 3,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Amphibious",
        "text": "The frog can breathe air and water."
      },
      {
        "name": "Standing Leap",
        "text": "The frog's long jump is up to 10 feet and its high jump is up to 5 feet, with or without a running start."
      }
    ],
    "slug": "creatures:frog"
  },
  "giantFireBeetle": {
    "key": "giantFireBeetle",
    "name": "Giant Fire Beetle",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13 (Natural Armor)",
    "hp": "4 (1d6 + 1)",
    "speed": "30 ft.",
    "senses": "Blindsight 30 ft., Passive Perception 8",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 8,
        "mod": -1
      },
      "dex": {
        "score": 10,
        "mod": 0
      },
      "con": {
        "score": 12,
        "mod": 1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 7,
        "mod": -2
      },
      "cha": {
        "score": 3,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Illumination",
        "text": "The beetle sheds bright light in a 10-foot radius and dim light for an additional 10 feet."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +1 to hit, reach 5 ft., one target. Hit: 2 (1d6 − 1) slashing damage. Description A giant fire beetle is a nocturnal creature that takes its name from a pair of glowing glands that give off light. Miners and adventurers prize these creatures, for a giant fire beetle's glands continue to shed light for 1d6 days after the beetle dies. Giant fire beetles are most commonly found underground and in dark forests."
      }
    ],
    "slug": "creatures:giant-fire-beetle"
  },
  "giantFly": {
    "key": "giantFly",
    "name": "Giant Fly",
    "size": "Large",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "19 (3d10+3)",
    "speed": "30 ft., fly 60 ft.",
    "senses": "darkvision 60 ft.",
    "cr": "0 (10 XP)",
    "source": "Dungeon Master's Guide",
    "abilities": {
      "str": {
        "score": 14,
        "mod": 2
      },
      "dex": {
        "score": 13,
        "mod": 1
      },
      "con": {
        "score": 13,
        "mod": 1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 3,
        "mod": -4
      }
    },
    "slug": "creatures:giant-fly"
  },
  "goat": {
    "key": "goat",
    "name": "Goat",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "4 (1d8)",
    "speed": "40 ft.",
    "senses": "Passive Perception 10",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 12,
        "mod": 1
      },
      "dex": {
        "score": 10,
        "mod": 0
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Charge",
        "text": "If the goat moves at least 20 feet straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 2 (1d4) bludgeoning damage. If the target is a creature, it must succeed on a DC 10 Strength saving throw or be knocked prone."
      },
      {
        "name": "Sure-Footed",
        "text": "The goat has advantage on Strength and Dexterity saving throws made against effects that would knock it prone."
      }
    ],
    "actions": [
      {
        "name": "Ram",
        "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 3 (1d4 + 1) bludgeoning damage."
      }
    ],
    "slug": "creatures:goat"
  },
  "hare": {
    "key": "hare",
    "name": "Hare",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "1 (1d4 - 1)",
    "speed": "20 ft., burrow 5 ft.",
    "skills": "Perception +2, Stealth +5",
    "senses": "passive Perception 12",
    "languages": "-",
    "cr": "0 (0 XP)",
    "source": "Icewind Dale - Rime of the Frostmaiden",
    "abilities": {
      "str": {
        "score": 1,
        "mod": -5
      },
      "dex": {
        "score": 17,
        "mod": 3
      },
      "con": {
        "score": 9,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 11,
        "mod": 0
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Escape",
        "text": "The hare can take the Dash, Disengage, or Hide action as a bonus action on each of its turns. Description Snowshoe hares are gentle herbivores that live in burrows throughout Icewind Dale. They have shorter ears than other hares and are acclimated to cold weather."
      }
    ],
    "slug": "creatures:hare"
  },
  "hawk": {
    "key": "hawk",
    "name": "Hawk",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "1 (1d4 - 1)",
    "speed": "10 ft., fly 60 ft.",
    "skills": "Perception +4",
    "senses": "Passive Perception 14",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 5,
        "mod": -3
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 14,
        "mod": 2
      },
      "cha": {
        "score": 6,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Sight",
        "text": "The hawk has advantage on Wisdom (Perception) checks that rely on sight."
      }
    ],
    "actions": [
      {
        "name": "Talons",
        "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 slashing damage."
      }
    ],
    "slug": "creatures:hawk"
  },
  "hyena": {
    "key": "hyena",
    "name": "Hyena",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "5 (1d8 + 1)",
    "speed": "50 ft.",
    "skills": "Perception +3",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 11,
        "mod": 0
      },
      "dex": {
        "score": 13,
        "mod": 1
      },
      "con": {
        "score": 12,
        "mod": 1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Pack Tactics",
        "text": "The hyena has advantage on an attack roll against a creature if at least one of the hyena's allies is within 5 feet of the creature and the ally isn't incapacitated."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 3 (1d6) piercing damage."
      }
    ],
    "slug": "creatures:hyena"
  },
  "kingsport": {
    "key": "kingsport",
    "name": "Kingsport",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "5 (1d8 + 1)",
    "speed": "20 ft., swim 40 ft.",
    "senses": "blindsight 30 ft. (blind beyond this radius), passive Perception 10",
    "languages": "Common",
    "cr": "0 (10 XP)",
    "source": "Icewind Dale - Rime of the Frostmaiden",
    "abilities": {
      "str": {
        "score": 6,
        "mod": -2
      },
      "dex": {
        "score": 12,
        "mod": 1
      },
      "con": {
        "score": 12,
        "mod": 1
      },
      "int": {
        "score": 10,
        "mod": 0
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Hold Breath",
        "text": "Kingsport can hold its breath for 20 minutes."
      }
    ],
    "actions": [
      {
        "name": "Beak",
        "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 3 (1d4 + 1) piercing damage. Description Scrivenscry is an arcanaloth who always refers to itself in the third person. It has a fondness for black licorice, strips of which it keeps in the pockets of its robe. The fiend is attended by Kingsport, a blind, albino giant penguin under the effect of an Awaken spell. Scrivenscry’s anxious penguin servant, Kingsport, was promised a life of enlightenment. The truth is that Kingsport was turned into Scrivenscry’s lackey, who lives in fear of his cruel, unpredictable master. The blind giant penguin hopes to be free of the arcanaloth one day."
      }
    ],
    "slug": "creatures:kingsport"
  },
  "knuckleheadTrout": {
    "key": "knuckleheadTrout",
    "name": "Knucklehead Trout",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "7 (2d6)",
    "speed": "0 ft., swim 30 ft.",
    "senses": "darkvision 60 ft., passive Perception 8",
    "languages": "-",
    "cr": "0 (10 XP)",
    "source": "Icewind Dale - Rime of the Frostmaiden",
    "abilities": {
      "str": {
        "score": 14,
        "mod": 2
      },
      "dex": {
        "score": 14,
        "mod": 2
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 6,
        "mod": -2
      },
      "cha": {
        "score": 1,
        "mod": -5
      }
    },
    "traits": [
      {
        "name": "Water Breathing",
        "text": "The trout can breathe only underwater."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage."
      },
      {
        "name": "Tail",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) bludgeoning damage. Description The tasty and tenacious knucklehead trout can't easily be caught in nets. Moreover, using a line to reel in such a strong fish is a significant undertaking. Incautious fishers who get pulled into freezing water can quickly die, particularly if they're weighed down by heavy furs and cloaks."
      },
      {
        "name": "A male knucklehead trout can weigh 70 pounds or more",
        "text": "The females tend to be smaller, weighing about 50 pounds. Both are prized for their ivory-like bones."
      }
    ],
    "slug": "creatures:knucklehead-trout"
  },
  "jackal": {
    "key": "jackal",
    "name": "Jackal",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "3 (1d6)",
    "speed": "40 ft.",
    "skills": "Perception +3",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 8,
        "mod": -1
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 3,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 6,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Hearing and Smell",
        "text": "The jackal has advantage on Wisdom (Perception) checks that rely on hearing or smell."
      },
      {
        "name": "Pack Tactics",
        "text": "The jackal has advantage on an attack roll against a creature if at least one of the jackal's allies is within 5 feet of the creature and the ally isn't incapacitated."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +1 to hit, reach 5 ft., one target. Hit: 1 (1d4 – 1) piercing damage."
      }
    ],
    "slug": "creatures:jackal"
  },
  "lizard": {
    "key": "lizard",
    "name": "Lizard",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "2 (1d4)",
    "speed": "20 ft., climb 20 ft.",
    "senses": "Darkvision 30 ft., Passive Perception 9",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 8,
        "mod": -1
      },
      "cha": {
        "score": 3,
        "mod": -4
      }
    },
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:lizard"
  },
  "octopus": {
    "key": "octopus",
    "name": "Octopus",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "3 (1d6)",
    "speed": "5 ft., swim 30 ft.",
    "skills": "Perception +2, Stealth +4",
    "senses": "Darkvision 30 ft., Passive Perception 12",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 4,
        "mod": -3
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 3,
        "mod": -4
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Hold Breath",
        "text": "While out of water, the octopus can hold its breath for 30 minutes."
      },
      {
        "name": "Underwater Camouflage",
        "text": "The octopus has advantage on Dexterity (Stealth) checks made while underwater."
      },
      {
        "name": "Water Breathing",
        "text": "The octopus can breathe only underwater."
      }
    ],
    "actions": [
      {
        "name": "Tentacles",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1 bludgeoning damage, and the target is grappled (escape DC 10). Until this grapple ends, the octopus can't use its tentacles on another target."
      },
      {
        "name": "Ink Cloud (Recharges after a Short or Long Rest)",
        "text": "A 5-foot-radius cloud of ink extends all around the octopus if it is underwater. The area is heavily obscured for 1 minute, although a significant current can disperse the ink. After releasing the ink, the octopus can use the Dash action as a bonus action."
      }
    ],
    "slug": "creatures:octopus"
  },
  "onyx": {
    "key": "onyx",
    "name": "Onyx",
    "size": "Huge",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "2 (1d4)",
    "speed": "400 ft., climb 200 ft.",
    "skills": "Perception +3, Stealth +4",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Acquisitions Incorporated",
    "abilities": {
      "str": {
        "score": 3,
        "mod": -4
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 3,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 7,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Keen Smell",
        "text": "The cat has advantage on Wisdom (Perception) checks that rely on smell."
      },
      {
        "name": "Relative Size",
        "text": "Any damage Onyx would take is reduced to 0. She has advantage on ability checks and saving throws."
      },
      {
        "name": "Dealing with Onyx",
        "text": "Onyx cannot be overcome or killed by combat. Any weapon attack against her that hits AC 12 makes contact but deals no lasting damage. However, if the attack would deal 10 or more damage, Onyx has disadvantage on attack rolls until the end of her next turn. If Onyx would take 10 or more damage from spells or other effects, it yields the same result. Spells that impose conditions function normally against Onyx, but those conditions end automatically at the end of the cat's next turn."
      }
    ],
    "actions": [
      {
        "name": "Claws",
        "text": "Melee Weapon Attack: +7 to hit, reach 20 ft., one target. Hit: 11 (2d10) slashing damage."
      }
    ],
    "slug": "creatures:onyx"
  },
  "owl": {
    "key": "owl",
    "name": "Owl",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "1 (1d4 - 1)",
    "speed": "5 ft., fly 60 ft.",
    "skills": "Perception +3, Stealth +3",
    "senses": "Darkvision 120 ft., Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 3,
        "mod": -4
      },
      "dex": {
        "score": 13,
        "mod": 1
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 7,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Flyby",
        "text": "The owl doesn't provoke opportunity attacks when it flies out of an enemy's reach."
      },
      {
        "name": "Keen Hearing and Sight",
        "text": "The owl has advantage on Wisdom (Perception) checks that rely on hearing or sight."
      }
    ],
    "actions": [
      {
        "name": "Talons",
        "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1 slashing damage."
      }
    ],
    "slug": "creatures:owl"
  },
  "pig": {
    "key": "pig",
    "name": "Pig",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10 (Natural Armor)",
    "hp": "5 (1d8 + 1)",
    "speed": "30 ft.",
    "senses": "Passive Perception 9",
    "languages": "—",
    "cr": "0 (0 XP)",
    "source": "Storm King's Thunder",
    "abilities": {
      "str": {
        "score": 13,
        "mod": 1
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 12,
        "mod": 1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 9,
        "mod": -1
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "slug": "creatures:pig"
  },
  "quipper": {
    "key": "quipper",
    "name": "Quipper",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "1 (1d4 - 1)",
    "speed": "0 ft., swim 40 ft.",
    "senses": "Darkvision 60 ft., Passive Perception 8",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 9,
        "mod": -1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 7,
        "mod": -2
      },
      "cha": {
        "score": 2,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Blood Frenzy",
        "text": "The quipper has advantage on melee attack rolls against any creature that doesn't have all its hit points."
      },
      {
        "name": "Water Breathing",
        "text": "The quipper can breathe only underwater."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 piercing damage. Description"
      },
      {
        "name": "A quipper is a carnivorous fish with sharp teeth",
        "text": "Quippers can adapt to any aquatic environment, including cold subterranean lakes. They frequently gather in swarms; the statistics for a swarm of quippers appear later in this appendix."
      }
    ],
    "slug": "creatures:quipper"
  },
  "rat": {
    "key": "rat",
    "name": "Rat",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "1 (1d4 - 1)",
    "speed": "20 ft.",
    "senses": "Darkvision 30 ft., Passive Perception 10",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 9,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Keen Smell",
        "text": "The rat has advantage on Wisdom (Perception) checks that rely on smell."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:rat"
  },
  "raven": {
    "key": "raven",
    "name": "Raven",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "1 (1d4 - 1)",
    "speed": "10 ft., fly 50 ft.",
    "skills": "Perception +3",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 14,
        "mod": 2
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 6,
        "mod": -2
      }
    },
    "traits": [
      {
        "name": "Mimicry",
        "text": "The raven can mimic simple sounds it has heard, such as a person whispering, a baby crying, or an animal chittering. A creature that hears the sounds can tell they are imitations with a successful DC 10 Wisdom (Insight) check."
      }
    ],
    "actions": [
      {
        "name": "Beak",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:raven"
  },
  "scorpion": {
    "key": "scorpion",
    "name": "Scorpion",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11 (Natural Armor)",
    "hp": "1 (1d4 - 1)",
    "speed": "10 ft.",
    "senses": "Blindsight 10 ft., Passive Perception 9",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 11,
        "mod": 0
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 8,
        "mod": -1
      },
      "cha": {
        "score": 2,
        "mod": -4
      }
    },
    "actions": [
      {
        "name": "Sting",
        "text": "Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must make a DC 9 Constitution saving throw, taking 4 (1d8) poison damage on a failed save, or half as much damage on a successful one."
      }
    ],
    "slug": "creatures:scorpion"
  },
  "seaHorse": {
    "key": "seaHorse",
    "name": "Sea Horse",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "11",
    "hp": "1 (1d4 - 1)",
    "speed": "0 ft., swim 20 ft.",
    "senses": "Passive Perception 10",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 1,
        "mod": -5
      },
      "dex": {
        "score": 12,
        "mod": 1
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 2,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Water Breathing",
        "text": "The sea horse can breathe only underwater."
      }
    ],
    "slug": "creatures:sea-horse"
  },
  "sheep": {
    "key": "sheep",
    "name": "Sheep",
    "size": "Small",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "3 (1d6)",
    "speed": "30 ft.",
    "senses": "Passive Perception 10",
    "languages": "—",
    "cr": "0 (0 XP)",
    "source": "Storm King's Thunder",
    "abilities": {
      "str": {
        "score": 12,
        "mod": 1
      },
      "dex": {
        "score": 10,
        "mod": 0
      },
      "con": {
        "score": 11,
        "mod": 0
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 5,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Sure-Footed",
        "text": "The sheep has advantage on Strength and Dexterity saving throws made against effects that would knock it prone."
      }
    ],
    "slug": "creatures:sheep"
  },
  "spider": {
    "key": "spider",
    "name": "Spider",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "12",
    "hp": "1 (1d4 - 1)",
    "speed": "20 ft., climb 20 ft.",
    "skills": "Stealth +4",
    "senses": "Darkvision 30 ft., Passive Perception 10",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 2,
        "mod": -4
      },
      "dex": {
        "score": 14,
        "mod": 2
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 1,
        "mod": -5
      },
      "wis": {
        "score": 10,
        "mod": 0
      },
      "cha": {
        "score": 2,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Spider Climb",
        "text": "The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."
      },
      {
        "name": "Web Sense",
        "text": "While in contact with a web, the spider knows the exact location of any other creature in contact with the same web."
      },
      {
        "name": "Web Walker",
        "text": "The spider ignores movement restrictions caused by webbing."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must succeed on a DC 9 Constitution saving throw or take 2 (1d4) poison damage."
      }
    ],
    "slug": "creatures:spider"
  },
  "tressym": {
    "key": "tressym",
    "name": "Tressym",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "chaotic neutral",
    "ac": "12",
    "hp": "5 (2d4)",
    "speed": "40 ft., climb 30 ft., fly 40 ft.",
    "skills": "Perception +5, Stealth +4",
    "cr": "0 (10 XP)",
    "source": "Storm King's Thunder",
    "abilities": {
      "str": {
        "score": 3,
        "mod": -4
      },
      "dex": {
        "score": 15,
        "mod": 2
      },
      "con": {
        "score": 10,
        "mod": 0
      },
      "int": {
        "score": 11,
        "mod": 0
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 12,
        "mod": 1
      }
    },
    "traits": [
      {
        "name": "Detect Invisibility",
        "text": "Within 50 feet of the tressym, magical invisibility fails to conceal anything from the tressym's sight"
      },
      {
        "name": "Keen Smell",
        "text": "The tressym has advantage on Wisdom (Perception) checks that rely on smell."
      },
      {
        "name": "Poison Sense",
        "text": "The tressym can detect whether a substance is poisonous by taste, touch, or smell."
      }
    ],
    "actions": [
      {
        "name": "Claws",
        "text": "Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 slashing damage."
      }
    ],
    "slug": "creatures:tressym"
  },
  "vulture": {
    "key": "vulture",
    "name": "Vulture",
    "size": "Medium",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "10",
    "hp": "5 (1d8 + 1)",
    "speed": "10 ft., fly 50 ft.",
    "skills": "Perception +3",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 7,
        "mod": -2
      },
      "dex": {
        "score": 10,
        "mod": 0
      },
      "con": {
        "score": 13,
        "mod": 1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 4,
        "mod": -3
      }
    },
    "traits": [
      {
        "name": "Keen Sight and Smell",
        "text": "The vulture has advantage on Wisdom (Perception) checks that rely on sight or smell."
      },
      {
        "name": "Pack Tactics",
        "text": "The vulture has advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally isn't incapacitated."
      }
    ],
    "actions": [
      {
        "name": "Beak",
        "text": "Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) piercing damage."
      }
    ],
    "slug": "creatures:vulture"
  },
  "weasel": {
    "key": "weasel",
    "name": "Weasel",
    "size": "Tiny",
    "creature": "beast",
    "alignment": "unaligned",
    "ac": "13",
    "hp": "1 (1d4 - 1)",
    "speed": "30 ft.",
    "skills": "Perception +3, Stealth +5",
    "senses": "Passive Perception 13",
    "languages": "—",
    "cr": "0 (10 XP)",
    "source": "Monster Manual",
    "abilities": {
      "str": {
        "score": 3,
        "mod": -4
      },
      "dex": {
        "score": 16,
        "mod": 3
      },
      "con": {
        "score": 8,
        "mod": -1
      },
      "int": {
        "score": 2,
        "mod": -4
      },
      "wis": {
        "score": 12,
        "mod": 1
      },
      "cha": {
        "score": 3,
        "mod": -4
      }
    },
    "traits": [
      {
        "name": "Keen Hearing and Smell",
        "text": "The weasel has advantage on Wisdom (Perception) checks that rely on hearing or smell."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 piercing damage."
      }
    ],
    "slug": "creatures:weasel"
  }
};

if (typeof module !== "undefined" && module.exports) { module.exports = { CR0_BEASTS }; }
