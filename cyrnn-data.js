/* ============================================================
   CYRNN — the world: regions, places, powers, and history
   ------------------------------------------------------------
   Everything here comes from "The World of Cyrnn: Players Reference".
   Data only + pure lookups — no DOM, no state. Loaded before app.js.

   Two things to know before editing.

   1. COORDINATES ARE PERCENTAGES of the map image, never pixels. The
      map is a photograph of a hand-drawn map and will get rescanned;
      percentages survive that, pixels do not. x runs left to right,
      y runs top to bottom, both 0-100.

   2. THIS FILE IS CANONICAL AND READ-ONLY AT RUNTIME. The player can
      move, rename, hide and add pins, but those edits live in state as
      deltas against these ids (S.map.edits / S.map.custom), never as a
      copy of this data. That is what lets the world grow: adding a
      place here makes it appear for everyone without disturbing a
      single note or nudge already made.

   Pin positions were read off the map by eye and are close, not
   surveyed. Places the source describes but never draws — Korin'bel,
   Isenbyr, the Black Castle — are placed from their descriptions and
   are marked approximate. Both are meant to be corrected in the app.

   Spelling follows the source's own majority usage, except Hackett's
   Watch / Hackett's Line, which take the possessive because they are
   named for Corvaunus Hackett.
   ============================================================ */

/* Groups are the third kind of scope, alongside a region and a single
   place. They exist because the campaign calendar marks feasts for
   "the Fracture Perimeter" and "the Frontier" — which is not a region
   and not one town, but the three settlements founded after the Demon
   War to watch the abyss. Naming that lets the join stay honest. */
const CYRNN_GROUPS = [
  { id: "perimeter", name: "The Fracture Perimeter",
    lore: "The three towns established around the Fracture after the Demon War to stand guard over what remained inside it: Gorns Rest of Müür, Tel'rens Ridge of Kel'dorel, and Hackett's Watch of Kurst. Three kingdoms, one duty, and a shared calendar of remembrance." }
];

const CYRNN_REGIONS = [
  { id: "frostlands", name: "The Frostlands", x: 29.4, y: 19.0,
    blurb: "Long winters and frigid tundra, sparsely peopled outside one great city.",
    lore: "A land of long winters and frigid tundras, the Frostlands are sparsely populated outside of Cobalt Citadel — by nomadic tribes of Goliath and Orcs in the northern tundra, and by smaller villages of Gnomes and Dwarves in the mountain ranges that divide this area from the rest of Cyrnn." },

  { id: "muur", name: "Müür", x: 47.5, y: 32.9,
    blurb: "The dwarven kingdom. Hard, superstitious, and kingless for 1500 years.",
    lore: "The Kingdom of Müür is the hard and superstitious home to the Dwarves of Cyrnn. Spurred by the death of their most prominent god in the fourth year of the Demon War, 2018 years ago, many Dwarves hold a distaste for non-dwarves and their gods, believing the rest of Cyrnn did not sacrifice as they did. That, with a deep distrust of most magic, has earned them a reputation as rigid and hard to work with.\n\nMüür is made of many walled dwarven towns carved into the mountain ranges — commonly called citadels, where most residents live below ground in the undercity. There has been no central king in well over 1500 years, each citadel ruled by a different lord, and that division has led to several conflicts between citadels since." },

  { id: "kurst", name: "Kurst", x: 74.7, y: 29.2,
    blurb: "The human kingdom, ruled by one family for over a thousand years.",
    lore: "In the lands northeast of the Iceshard mountains lies the human kingdom of Kurst, ruled by the Kurst family for over a thousand years. With protection from the mountains and its great wall, Hackett's Line, these fertile lands prosper on behalf of their security and several ports." },

  { id: "keldorel", name: "Kel'dorel", x: 80.8, y: 48.7,
    blurb: "The elven kingdom — lakes, rivers, and the great forest of Highwood.",
    lore: "While Kel'dorel has some towns and cities, it is a land largely dominated by lakes, rivers, and forests, and is the home of elves." },

  { id: "fracture", name: "The Fracture", x: 61.5, y: 42.4,
    blurb: "An open wound in central Cyrnn, still festering 2022 years on.",
    lore: "Sitting like an open wound in central Cyrnn, the Fracture still festers to this day, even after the demon lord Azar'och and his armies were defeated 2002 years ago. While the great abyss lacks the danger it held during the Demon War, it is still home to many lesser demons, devilish beasts, and the crimson goblins — a larger subspecies of goblin warped by fiendish magic.\n\nThe Black Castle, Azar'och's keep and gateway to the underworld, still exists in the bowels of the Fracture. Despite the continued efforts of warriors and clerics in the years since the war's final battle, the castle and its link to the underworld remain standing." },

  { id: "hearthlands", name: "The Hearthlands", x: 54.9, y: 74.7,
    blurb: "Gentle hills and vast fields — the most plentiful crops in the region.",
    lore: "The Hearthlands encompass much of south Cyrnn and are known for their gentle rolling hills and vast fields, home to the most plentiful crops in the entire region. The area is mostly made up of small farming settlements run by humans, and halfling villages built into some of the larger hills." },

  { id: "eye-of-evil", name: "The Eye of Evil", x: 33.0, y: 52.4,
    blurb: "The second chasm — and the seat of the one archdemon who changed sides.",
    lore: "The location of the second chasm that opened during the long-ago Demon War. The Eye, as it is commonly called, never brought forth hordes of creatures from the abyss like the Fracture did. It brought forth a single arch demon named Yamuuk, who disliked the demon lord Azar'och and decided to offer his services to the people of Cyrnn — building himself a palace on the central precipice at the centre of the new crater. Due to this place being home to a creature like Yamuuk, it was named the Eye of Evil by the people of this world." },

  { id: "red-desert", name: "The Red Desert", x: 75.1, y: 88.6,
    blurb: "A desolate sea of dunes. Little is known of what lies within, or beyond.",
    lore: "Named after the vast and seemingly endless sea of beige red sand dunes, the Red Desert is a desolate land with few inhabitants. While small settlements are known to exist sporadically up its coast, little is known about what exists within it, or on the other side of it." },

  { id: "western-sea", name: "The Western Sea", x: 8.3, y: 46.8,
    blurb: "The waters west of Cyrnn, where the sun touches last.",
    lore: "The open water off Cyrnn's western coast, dominated by Last Light Island and the free ports that cling to it. The campaign calendar keeps Westfall out here, celebrating the final rays of winter sun touching Cyrnn's westernmost cliffs." }
];

/* kind drives the pin glyph and follows the map's own legend where it
   can: "city" is the circled dot, "town" the plain dot, "road" the
   dashed line. The rest — ranges, forests, seas, ruins — are things the
   map draws but does not mark, and things the text names but the map
   never drew at all. */
const CYRNN_PLACES = [
  /* ---- Kurst ---------------------------------------------- */
  { id: "kurstenport", name: "Kurstenport", kind: "city", region: "kurst",
    x: 61.8, y: 13.6, tags: ["human", "capital", "learning"],
    blurb: "Seat of the ruler and cultural centre of Kurst.",
    lore: "Kurstenport lies in the far north of the human kingdom and is the seat of its ruler and the cultural centre of Kurst. The city is home to many of Kurst's oldest families and boasts the finest universities in the kingdom, as well as the Opal Conservatoire — the famed fighter school which produces some of the finest knights and warriors across the realm." },

  { id: "kurstenberg", name: "Kurstenberg", kind: "city", region: "kurst",
    x: 88.4, y: 26.9, tags: ["human", "trade", "crime"],
    blurb: "The largest city in both Kurst and Cyrnn. You can find anything here.",
    lore: "Sitting on the eastern coast is the largest city in both Kurst and Cyrnn. Kurstenberg is the main trading hub in all of the human kingdom, and one travelling here could find nearly anything they might be looking for. The city is ruled by lord Clovis Thormund-Kurst, but is largely impacted by the city's many wealthy merchants and influential crimelords." },

  { id: "hacketts-watch", name: "Hackett's Watch", kind: "town", region: "kurst",
    x: 69.9, y: 35.9, groups: ["perimeter"], tags: ["human", "prison", "garrison"],
    blurb: "Watch post and prison both — convicts serve their sentences in the Fracture.",
    lore: "Hackett's Watch is the perimeter town manned by the humans of Kurst and, like the great wall Hackett's Line that has long guarded Kurst, draws its name from Corvaunus Hackett, the former high priest of Boralius. The town serves as both a watch post and a prison: criminals in the kingdom are given the option to work as indentured soldiers. These soldiers are often given the most dangerous expeditionary missions into the Fracture, but in payment for that risk work their sentences at three times the rate of a normal prison sentence, and on completion are often offered paid soldier positions.\n\nTown history: following a vision of coming danger from his god, Corvaunus exerted every bit of influence he had to see the creation of Hackett's Line and the walled fortress town of Hackett's Watch. The expeditious construction of these projects taxed the resources of Kurst and alienated them from much of Cyrnn — and believing that only he could plot the human path to salvation, Corvaunus did little to spread the information of coming doom. He gained an overwhelmingly negative image in the six years between the completion of Hackett's Watch and the start of the Demon War, was stripped of the title of High Priest for impoverishing much of Kurst, and was banished from the kingdom to his new town." },

  { id: "korinbel", name: "Korin'bel", kind: "town", region: "kurst",
    x: 53.0, y: 11.0, approx: true, tags: ["frost-elf", "mercenary"],
    blurb: "Villages of the Frost elves, in the frozen tundra northwest of Kurstenport.",
    lore: "The area known as Korin'bel is located in the frozen tundras of Kurst, northwest from Kurstenport, and is home to the villages of the Frost elves. These elves originate from the Drow of Cyrnn's underdark who lived in the area where the Fracture occurred; after having their cities destroyed, they moved to land given to them by the human king. These Drow used extensive magic to manipulate their own genealogy in an effort to adjust to the tundras of Kurst, and within three generations had transformed themselves into the pale-skinned, cold-resistant elves they are today.\n\nLike their Drow cousins, the frost elves value strength and are known for having some of the strongest warriors and wizards in Cyrnn. While their rapid transition from Drow to frost elf unnerves some, they have become the favoured mercenaries of many human lords — particularly a group of frost elf rangers known as Striders." },

  { id: "hacketts-line", name: "Hackett's Line", kind: "wall", region: "kurst",
    x: 76.4, y: 35.1, tags: ["fortification"],
    blurb: "The great wall that has long guarded Kurst.",
    lore: "The great wall built at the insistence of high priest Corvaunus Hackett, following a vision of coming danger from his god. Together with the mountains, it is the reason Kurst's fertile lands have prospered in relative security. Its construction impoverished much of Kurst and cost Corvaunus his title — six years before the Demon War proved him right." },

  { id: "kings-road", name: "The King's Road", kind: "road", region: "kurst",
    x: 69.4, y: 19.2, tags: ["trade", "travel"],
    blurb: "The northern road running between Kurstenport and the east coast.",
    lore: "The road drawn across northern Kurst, linking the seat of the kingdom to its coast and its trade. The map marks roads with a dashed line; this is the one the mapmaker bothered to name." },

  /* ---- The Shade Briar ------------------------------------
     Hal's home warren, and the reason the app carries two calendars
     at all — the Jerbeen year is kept here and nowhere else. */
  { id: "shade-briar", name: "The Shade Briar", kind: "warren", region: "kurst",
    x: 56.2, y: 16.8, approx: true, tags: ["jerbeen", "warren", "home"],
    blurb: "The Jerbeen warren. Keeps its own calendar of thirteen months.",
    lore: "A warren of woven thorn and deep tunnel south-west of Kurstenport, and the home the Jerbeen calendar is written for. Its year runs thirteen months of twenty-eight days against the Common twelve of thirty, and every feast it keeps is a task: sealing entrances against winter predators, listening at the bedrock for the abyss, weaving the canopy against nesting raptors. Where the surface kingdoms mark victories, the Briar marks maintenance.\n\nPosition on the map is where it was pinned by hand rather than drawn by the mapmaker." },

  /* ---- Kel'dorel ------------------------------------------ */
  { id: "salins-cove", name: "Salins Cove", kind: "city", region: "keldorel",
    x: 88.0, y: 44.9, tags: ["high-elf", "art", "music"],
    blurb: "Elven city of flowers, minstrels, and the Emerald Palace.",
    lore: "The high elves who govern over this city have helped make it known for its beauty and culture. Throughout the streets of Salins Cove one would spot flowers and trees from throughout the realm, and hear the voices and instruments of various minstrels from across it — many of whom come to this city to train and perfect their craft at the Emerald Palace, the city's foremost school and performance hall for bards." },

  { id: "silver-grove", name: "Silver Grove", kind: "town", region: "keldorel",
    x: 83.5, y: 53.8, tags: ["wood-elf", "druid", "ranger"],
    blurb: "Wood elf town at the edge of Highwood. Home of the Silver Riders.",
    lore: "Founded by the wood elves, Silver Grove sits at the edge of the great Highwood. The grove is now a place welcome to all who value the natural world, and many of the druids and rangers who call it home watch over Highwood and protect it. The most famous of these forest guardians are the Silver Riders — warriors who tame and ride the silver-scaled wyverns native to the Highwood forest." },

  { id: "lunar-lake", name: "Lunar Lake", kind: "town", region: "keldorel",
    x: 73.2, y: 43.7, tags: ["trade", "diverse", "innovation"],
    blurb: "The most diverse settlement in the elven kingdom, and its trade gateway.",
    lore: "Named after the lake of the same name that it is adjacent to, Lunar Lake is a major trade town, connected to Salins Cove and the western coast by river system, and is the closest elf settlement to the other kingdoms of Cyrnn. Due to its heavy trade focus, Lunar Lake is the most diverse of any town or city within the elven borders, and has gained a reputation as a place of innovation and where all walks of life in Cyrnn can come to share and learn." },

  { id: "telrens-ridge", name: "Tel'rens Ridge", kind: "town", region: "keldorel",
    x: 56.9, y: 46.8, groups: ["perimeter"], tags: ["elf", "garrison", "honour"],
    blurb: "The primary guardian of the Fracture. A posting here is an honour.",
    lore: "Named after an ancient elven knight named Tel'ren Lythel, who was said to have held back the hordes of demons emerging from the Fracture when it first opened, allowing countless people to escape the ensuing chaos. Tel'rens Ridge is a proud town devoted to the safety of the realm and is the primary guardian of the Fracture.\n\nLike Hackett's Watch, the town does use indentured warriors who seek to work off their crimes — but for professional soldiers and knights of Kel'dorel a position here is seen as a great honour, where most humans see a posting in Hackett's Watch as a type of banishment." },

  { id: "highwood", name: "Highwood", kind: "forest", region: "keldorel",
    x: 77.2, y: 57.4, tags: ["forest", "wyvern"],
    blurb: "A vast forest of gargantuan trees standing well over 150ft.",
    lore: "The great forest at whose edge Silver Grove sits — vast, with gargantuan trees standing well over 150ft. Home to the silver-scaled wyverns the Silver Riders tame, and watched over by the druids and rangers of the grove. On the Silver Ascent, handlers cast silver pollen across its canopy to ward against arboreal predators and bless young wyvern clutches." },

  /* ---- Müür ----------------------------------------------- */
  { id: "gorns-rest", name: "Gorns Rest", kind: "town", region: "muur",
    x: 51.1, y: 38.9, groups: ["perimeter"], tags: ["dwarven", "free-city", "trade"],
    blurb: "The Dwarven free state — the one citadel that readily accepts outsiders.",
    lore: "Gorns Rest is the dwarven perimeter town that borders the Fracture. It has the highest population of any settlement within the kingdom and is the only one that readily accepts outsiders. With a population of nearly seven thousand and unrestrictive laws compared to the dwarven homelands, Gorns Rest has become known as the Dwarven free state — a place where mages and clerics can practice without ridicule and fine weapons from the dwarven smiths of Müür are sold. It has gained a reputation as a trade centre and free city, in addition to being a guardian of the abyss." },

  { id: "iceshard-mountains", name: "The Iceshard Mountains", kind: "mountains", region: "muur",
    x: 45.7, y: 16.7, tags: ["mountains", "barrier"],
    blurb: "The great range dividing the north. The Fracture tore a hole through it.",
    lore: "The spine of northern Cyrnn, dividing Kurst from the rest of the world and giving the human kingdom much of its security. Within days of the Great Fracture opening at Isenbyr, the tear had run from these mountains down to the upper Hearthlands, devouring several farming communities in its path." },

  /* ---- The Fracture --------------------------------------- */
  { id: "isenbyr", name: "Isenbyr", kind: "ruin", region: "fracture",
    x: 58.0, y: 38.6, approx: true, tags: ["dwarven", "ruin", "historic"],
    blurb: "The dwarven town where the Great Fracture began. It went down with it.",
    lore: "The Great Fracture started as little more than a rumble in the ground in the dwarven town of Isenbyr, an event that was none too uncommon in the mountain's foothills. But the day quickly turned to chaos as the ground began to crack and tear itself apart, and with it took the dwarves of Isenbyr.\n\nNothing of the town is drawn on the map; this pin marks roughly where it stood. Isenbyr's Lament is kept on day 14 across Müür and the Fracture perimeter, and the citadels ring low bells for it." },

  { id: "black-castle", name: "The Black Castle", kind: "ruin", region: "fracture",
    x: 63.0, y: 41.0, approx: true, tags: ["demonic", "gateway", "dungeon"],
    blurb: "Azar'och's keep and the gateway to the underworld. Still standing.",
    lore: "The fortress of the demon lord and the gateway to Draun-Cyrnn, the underworld of Cyrnn, deep in the bowels of the Fracture. Lyestra descended to its gates in the fourth year of the Demon War and died there. Sixteen years later Gorn Shattersteel led an army through the devil's maw and killed Azar'och inside it.\n\nDespite the continued efforts of warriors and clerics in the years since the war's final battle, the castle and its link to the underworld remain standing." },

  /* ---- The Hearthlands ------------------------------------ */
  { id: "corisport", name: "Corisport", kind: "city", region: "hearthlands",
    x: 53.3, y: 90.9, tags: ["fishing", "sailors", "exploration"],
    blurb: "The largest fishing city in Cyrnn, and where voyages of discovery begin.",
    lore: "The largest fishing city in all of Cyrnn, Corisport sits on the pleasant southern sea of the realm, and its plentiful waters draw sailors from as far as Cobalt Citadel looking to claim its bounty. Apart from fishing, the city is home to many adventurers who seek to sail out to the unknown and find new lands. While not directly under the rule of Kurst, Corisport was long ago founded by members of the human royal family as a colony and still maintains a strong relationship with its homeland." },

  { id: "moonlit-harbour", name: "Moonlit Harbour", kind: "town", region: "hearthlands",
    x: 25.3, y: 73.9, tags: ["merchant", "artist", "self-governed"],
    blurb: "Elected councils, wealthy merchants, and hired guns against pirates.",
    lore: "The largest of a string of small towns along Cyrnn's southwest coast, Moonlit Harbour is a popular home for many wealthy merchants and artists who seek to leave behind the rule of one of the three kingdoms that control much of Cyrnn. Because of this, most of these towns are run by elected councils and employ many former soldiers from across Cyrnn to guard against potential pirate attacks." },

  { id: "gloomwood", name: "Gloomwood", kind: "town", region: "hearthlands",
    x: 50.4, y: 47.4, tags: ["outcasts", "veterans", "home"],
    blurb: "Founded by freed indentured warriors of the Fracture. Where it all begins.",
    lore: "To many passing merchants, Gloomwood may be seen as little more than a convenient place to rest before the hard road through the Ghost Moors. But to many locals it is a hard-won piece of freedom: this town was given to and formed by former indentured warriors from the Fracture 80 years ago, who spent much of their lives fighting the hellbeasts in that same chasm. In the years since its formation the town has diversified some, but still carries on this heritage of fostering outcasts and warriors from all species and all areas of the world.\n\nLately there have been more rumors of caravans not making it to the other side of the moors, and as it begins to affect the number of traders coming through, the town has put out a formal request for some of its local adventurers to investigate and solve the mystery. Rumors swirl about the cause — the spirits of the moors dragging caravans to its murky depths, simple bandits looking for coin, or the work of a vengeful demon whose anger still burns for the village's warriors who once fought in the Fracture." },

  { id: "ghost-moors", name: "The Ghost Moors", kind: "swamp", region: "hearthlands",
    x: 45.7, y: 46.3, tags: ["haunted", "cursed", "hazard"],
    blurb: "A haunted swamp, and the hard road between Gloomwood and the west.",
    lore: "A haunted and mysterious swamp area that separates the settlements of Maelstrom Keep and Storms Rift from central Cyrnn. Restless and angry spirits haunt the moors west of Gorns Rest, and caravans crossing them have lately stopped arriving on the other side.\n\nThe archdevil Thraazipan activated a great curse in the area around the Ghost Moors, which turned many into Lycanthropes — and, unintentionally, gave rise to the Wulven people." },

  { id: "whispering-hills", name: "The Whispering Hills", kind: "hills", region: "hearthlands",
    x: 33.6, y: 60.8, tags: ["hills"],
    blurb: "The hill country between the Eye of Evil and the Hearthlands.",
    lore: "Drawn on the map between the Eye of Evil and the open fields of the Hearthlands. The source names them but says nothing else — a blank worth filling in at the table." },

  /* ---- The Eye of Evil ------------------------------------ */
  { id: "maelstrom-keep", name: "Maelstrom Keep", kind: "town", region: "eye-of-evil",
    x: 37.7, y: 43.3, tags: ["demonic", "blood-magic", "chaos"],
    blurb: "Fewer than 1000 souls behind black stone walls. Spoken of in hushed tones.",
    lore: "With less than 1000 people inside its black stone walls, Maelstrom Keep is a small kingdom but is often spoken of in hushed tones and thought to be a place of pure chaos. This is because this self-proclaimed kingdom of Yamuuk is filled with fanatical followers of the demon lord of the same name — and while this demon lord and his followers have actually done more to help the realm than hurt it since his arrival, the town and its people make most of Cyrnn uneasy with its many users of sangromancy, or blood magic.\n\nAnother key aspect is its Blood Crusade: once every three years, warriors from Maelstrom Keep venture from their town to the abyss with the goal of capturing fiends from the Fracture, the strongest of which are brought back to be sacrificed to Yamuuk — a way to laugh in the face of other demons who send these creatures forth." },

  { id: "storms-rift", name: "Storms Rift", kind: "city", region: "eye-of-evil",
    x: 24.6, y: 46.2, tags: ["dragonborn", "mercenary", "sorcery"],
    blurb: "Ruled by a triad of ancient dragons. Hardened by pirates and raiders both.",
    lore: "Known for its powerful dragonborn mercenaries and powerful ruling council, Storms Rift is a city that has become hardened by its surroundings, as it faces pirates from the west, raiders from the northern mountains, and dark creatures that wander about the Eye of Evil to the East.\n\nApart from these, Storms Rift is known for having many innate magic users such as sorcerers. This is often believed to be somehow linked to the city's ruling council, which is a triad of ancient dragons — where there is always one dragon from each main group, metallic, chromatic, and gem, on the council. Apart from the council it is believed that several other dragons in humanoid form live amongst its inhabitants." },

  { id: "last-light-island", name: "Last Light Island", kind: "island", region: "western-sea",
    x: 8.3, y: 46.8, tags: ["yuan-ti", "pirates", "free-port"],
    blurb: "Two worlds on one island: reclusive Yuan-Ti temples, and lawless free ports.",
    lore: "An island made of two very different worlds. The first is one of dense jungles and ancient temples that house the reclusive and dangerous Yuan-Ti people. The other is of free ports that house pirates, murderers, and thieves, where alcohol never stops flowing and music never seems to stop.\n\nWith both of these two worlds being ones that few in Cyrnn would like to find himself, Last Light is a place for only those with little other option, or who truly wish to travel to the place in Cyrnn where the sun touches last each day." },

  /* ---- The Frostlands ------------------------------------- */
  { id: "cobalt-citadel", name: "Cobalt Citadel", kind: "city", region: "frostlands",
    x: 24.3, y: 34.7, tags: ["gnome", "goliath", "orc", "magic"],
    blurb: "Second largest city in Cyrnn. Sapphire-tipped spires and magic schools.",
    lore: "Originally built as a place for the Gnomes, Goliaths, and Orcs of the region to come together as one, Cobalt Citadel has become the second largest city in all of Cyrnn and stands in stark contrast to the rest of the region. With its great sapphire-tipped towers that stand taller than any building in the realm, and its great walls that protect it from any outside threats, the city is a true marvel. It also houses some of the finest magic schools around and is a hotspot for magical innovation." },

  { id: "frozen-sea", name: "The Frozen Sea", kind: "sea", region: "frostlands",
    x: 21.1, y: 3.6, tags: ["sea", "ice"],
    blurb: "The ice-locked water off Cyrnn's northern coast.",
    lore: "The northern water beyond the Frostlands, drawn frozen at the top of every map of Cyrnn." },

  /* ---- The Red Desert ------------------------------------- */
  { id: "windswept-pass", name: "Windswept Pass", kind: "town", region: "red-desert",
    x: 74.5, y: 72.0, tags: ["gnome", "dwarf", "elemental-earth"],
    blurb: "The last stop before the Red Desert. Squat stone houses against the wind.",
    lore: "Tucked just behind the mountains that divide the rest of Cyrnn from the Red Desert, Windswept Pass is a small quaint town, long ago founded by gnome and dwarf nomads, built of mostly short and sturdy stone houses that can withstand the harsh winds coming off the desert. Apart from being the last stopping point for any adventurers that may be going to the Red Desert, the town also has an enclave for magic users specializing in magic relating to the elemental plane of earth." }
];

/* ---- The powers ------------------------------------------
   Gods and devils are kept in one list because the source draws them
   as one subject: they are the beings with power over Cyrnn, split by
   which way they came from. The order field is what actually differs —
   the Divine Gods coexist and take in lesser gods beneath them, while
   every Demonic Lord rose by beating a rival and rarely coexists with
   anything. */
const CYRNN_POWERS = [
  { id: "lyestra", name: "Lyestra", title: "God of the Dwarves", rank: "divine",
    status: "Died in the Black Castle, 4th year of the Demon War",
    scopes: ["muur"],
    blurb: "Mother of the mountains and the forge. Went into the abyss and did not return.",
    lore: "Known to many dwarves as the mother of the mountains and the forge, Lyestra was said to be the one who empowered the weapons of the once revered dwarven cleric smiths. Devoted to her people, it pained Lyestra to see Azar'och's armies ravage Cyrnn, and so during the 4th year of the Demon War she descended from the upper planes to challenge him.\n\nBacked by a host of Dwarven warriors led by Gorn Shattersteel, Lyestra descended deep into the Abyss to the gates of the Black Castle. For many hours the dwarves and their god fought Azar'och and his forces, but in the end the demon was too strong, and only through a final desperate act by Lyestra was a small group of dwarves led by Gorn able to escape.\n\nFollowing the war and their god's defeat, many dwarves developed the belief that the age of gods was over — that any true being worthy of worship showed themselves during the war and died doing so, had already died out sometime before the war, or did nothing and was unworthy of godhood for doing so." },

  { id: "boralius", name: "Boralius", title: "God of the Humans", rank: "divine",
    status: "Silent throughout the Demon War",
    scopes: ["kurst"],
    blurb: "Both the vigilant god and the absent one. Never once appeared.",
    lore: "Having said to have created humans to be a short-lived species that should always be aware of the present, but having scarcely revealed himself, Boralius has earned the titles of both the vigilant god and the absent one. Boralius strengthened these beliefs during the Demon War, when more paladins and clerics drew their power from him than any other god — but throughout the entire 20 year campaign the god never once appeared, and his followers confirmed that the god was silent in almost all attempts to contact him.\n\nHis clerics and paladins keep the Absent Vigil on day 350: altar flames doused, silent unguided meditation, and a day spent on worldly repairs rather than divine aid." },

  { id: "gorn-shattersteel", name: "Gorn Shattersteel", title: "Mankind's Champion", rank: "lesser",
    status: "Ascended at the Black Castle, 20th year of the Demon War",
    scopes: ["muur", "perimeter", "pan-regional"],
    blurb: "Led the dwarves out of the abyss, then went back sixteen years later.",
    lore: "Following the death of his god Lyestra, Gorn swore that he would one day return to the bowels of the Fracture to defeat Azar'och — and sixteen years after his first venture he would do so. After leading an army of Cyrnn's bravest warriors through the devil's maw, Gorn and his party fought the Arch demon in his castle.\n\nIt was during this battle that Gorn was said to have gained divinity, as several other dwarves say that in his fight some of the power of their former god began coursing through their leader, as if a piece of Lyestra had remained in the black castle awaiting Gorn's return.\n\nGorn's Triumph is kept on day 196, pan-regionally and hardest on the frontier: symbolic iron chains shattered, weapon-blessing tournaments, and dark stout." },

  { id: "azaroch", name: "Azar'och", title: "Lord of Shadows and the Demon Lord", rank: "devil",
    status: "Slain by Gorn Shattersteel at the Black Castle",
    scopes: ["fracture"],
    blurb: "Caused the Fracture and began the Demon War. Creator of Shadowsteel.",
    lore: "Known for causing the Fracture and beginning the demon wars, Azar'och gained the largest known influence among any known Devil, and commanded the warship of vast troves of demons. Azar'och gained his power through dark magic and his creation of Shadowsteel — infernal iron that had been tainted further by the Demon lord.\n\nIn Cyrnn, Devils often hold power similar to the level of the world's gods, and while they have always existed, many of the people of Cyrnn could simply ignore their existence — until the Fracture. Unlike the Divine Gods, who coexist and take in or create minor gods in their order, all Demonic lords have risen from lesser demons, gaining power as they defeat rivals and win followers. Even the Demonic Lords of Draun-Cyrnn rarely coexist and often try to dominate one another." },

  { id: "thraazipan", name: "Thraazipan", title: "Archdevil of Beast", rank: "devil",
    status: "One of Azar'och's generals during the Demon War",
    scopes: ["hearthlands"],
    blurb: "Made the demonic beasts — and, by accident, the Wulven people.",
    lore: "Thraazipan was one of Azar'och's generals during the Demon War, using her infernal magic to create and command demonic beasts such as gnolls, which ravaged the lands of mankind. Possibly Thraazipan's greatest influence was the creation of Lycanthropes and the Wulven people.\n\nFollowing the work of several months, the Archdevil activated a great curse in the area around the Ghost Moors. The curse affected many, turning them into Lycanthropes who would transform at unknown times, often killing the ones they held closest. Unknown to Thraazipan's original plans, some of the Lycanthropes would only partially transform and maintain their sanity, or in other cases live for several years carrying on families before transforming." },

  { id: "yamuuk", name: "Yamuuk", title: "Archdevil of Trickery", rank: "devil",
    status: "Living, at the Eye of Evil",
    scopes: ["eye-of-evil"],
    blurb: "Sometimes called the friendly demon. Betrayed Azar'och and stayed.",
    lore: "Sometimes called the friendly demon, Yamuuk, the Archdevil of Trickery, lives and breathes chaotic energy. When a second fracture occurred 8 years into the Demon War and the area east of Storms Rift collapsed and created the Eye of Evil, many feared it to be the end of humanity. But what met the armies of Storms Rift when they approached the eye wasn't a hoard of goblins, ghouls, or demons, but a lone being sitting on a throne of obsidian named Yamuuk.\n\nYamuuk had been a begrudged general of Azar'och who was jealous of their commander's following amongst the demons. Believing that they had a better chance gaining a following among the people of Cyrnn, they betrayed Azar'och, divulging many of the devil's secrets and gaining a significant following throughout the war as some saw him as a saviour from below.\n\nIn the years after the war Yamuuk remained in Cyrnn and carved out a unique place for himself as one with an equal number of followers from Cyrnn and from its realm below." }
];

/* ---- Peoples ---------------------------------------------
   The source describes these three in enough detail to be played or
   fought; the rest of Cyrnn's species are left to the core rules. */
const CYRNN_PEOPLES = [
  { id: "frost-elf", name: "Frost Elf", scopes: ["kurst", "korinbel"],
    blurb: "Drow who rewrote themselves for the tundra in three generations.",
    lore: "Frost elves originated from the Drow that were displaced during the great demon war. These elves settled in the frozen western foothills of the Müür mountains and, through extensive magic, have made themselves a distinct and resilient elven species.\n\nCharacteristics: frost elves maintain the short stature of their Drow cousins, but are often more muscular, and have stark white skin and eyes that are usually pale blue or purple.\n\nElven lineage (Frost Elf): at level 1 you have resistance to Cold damage and know the Elementalism cantrip; at level 3, Armor of Agathys; at level 5, Arcane Vigor." },

  { id: "crimson-goblin", name: "Crimson Goblin", scopes: ["fracture"],
    blurb: "Goblins warped by fiendish magic. Still holding the Fracture for a dead lord.",
    lore: "The Crimson Goblins first appeared roughly one year before the fracture, attacking Drow settlements in the vast caverns beneath Cyrnn around the area that would become the Fracture. The Drow, having a long familiarity with the demons of the underworld, believed these red skinned goblins to be escaped slaves who had in turn been captured by some lesser demon in an attempt to gain a foothold in their underworld. In reality several bands of goblins had made a deal with the demons of Azar'och's army to attack and weaken the Drow that safeguarded Cyrnn's underbelly from demonic threats, in exchange for fiendish power and a place in the demons' coming new world. Even years after the demons' defeat many crimson goblins fight on, guarding the Fracture and awaiting their lord's return.\n\nCharacteristic: larger than their surface cousins, crimson goblins stand at 4'6\" on average and roughly 90 lbs, though their size can vary greatly, being largely based on the amount of fiendish energy within them. Crimson goblins also often have horns on their head, and will wear armor made from the shells of Kiwreng Bugs (hard bugs in goblin) in some cases." },

  { id: "wulven", name: "Wulven", scopes: ["hearthlands", "ghost-moors"],
    blurb: "Born of a curse that half-worked. Hated and hunted for resembling what they escaped.",
    lore: "When Thraazipan's curse took the lands around the Ghost Moors, some of those it touched only partially transformed and maintained their sanity — or in other cases lived for several years carrying on families before transforming. It was in these cases that the Wulven people were born: a group only partially affected by the curse, who maintained their minds, but bore a resemblance to the werewolves, wearbears, and other lycanthropes who hunted their world, and thus were often hated and hunted themselves." }
];

/* ---- History ---------------------------------------------
   Time in Cyrnn is divided into two halves, before and after the Great
   Fracture, so the timeline is anchored to it: year 0 is the tearing,
   and everything is counted from there. The Common calendar reckons in
   PF — Post Fracture — and the present day is 2022 PF, which is what
   every "years ago" in this file is measured back from. The source's
   round "2000 years ago" is that same distance told loosely; here it is
   told exactly, so the two never drift apart as the campaign runs. */
const CYRNN_ERAS = [
  { id: "before", when: "Before 0 PF", year: null,
    name: "The world entire",
    lore: "Devils had always existed and held power similar to the level of the world's gods, but many of the people of Cyrnn could simply ignore their existence. Roughly a year before the tearing, crimson goblins began attacking Drow settlements in the caverns beneath what would become the Fracture — the first move of a bargain nobody above ground yet understood." },

  { id: "hacketts-line", when: "6 PF (pre-reckoning)", year: -6,
    name: "Hackett's Line completed",
    lore: "Following a vision of coming danger from his god, high priest Corvaunus Hackett drove the construction of the great wall and the fortress town of Hackett's Watch. The expense impoverished much of Kurst and alienated it from much of Cyrnn; Corvaunus, believing only he could plot the human path to salvation, did little to spread word of the coming doom. He was stripped of his title and banished to his own town — six years before he was proven right." },

  { id: "fracture", when: "0 PF", year: 0,
    name: "The Great Fracture",
    lore: "It started as little more than a rumble in the ground in the dwarven town of Isenbyr, none too uncommon in the mountain's foothills. Within the day the ground began to crack and tear itself apart, taking the dwarves of Isenbyr with it. Within days the fracture had torn a hole from the Iceshard mountains to the upper Hearthlands, devouring several farming communities in its path. In the following weeks hordes of demons led by Azar'och erupted from the Fracture, leaving a path of destruction in their wake." },

  { id: "lyestras-fall", when: "4 PF", year: 4,
    name: "Lyestra's Fall",
    lore: "Lyestra descended from the upper planes to challenge Azar'och, backed by dwarven warriors led by Gorn Shattersteel, and fought to the gates of the Black Castle. The demon proved too strong; only a final desperate act by their god let Gorn and a small group escape. Many dwarves concluded from it that the age of gods was over." },

  { id: "the-eye", when: "8 PF", year: 8,
    name: "The second fracture — the Eye of Evil",
    lore: "The area east of Storms Rift collapsed and created a second chasm. What met the armies of Storms Rift was not a horde but a single archdemon on an obsidian throne: Yamuuk, a begrudged general of Azar'och, who betrayed his lord, divulged the devils' secrets, and gained a following among the people of Cyrnn as a saviour from below." },

  { id: "gorns-triumph", when: "20 PF", year: 20,
    name: "Gorn's Triumph and the war's end",
    lore: "Sixteen years after his first venture, Gorn Shattersteel led an army of Cyrnn's bravest warriors back through the devil's maw and fought Azar'och in his castle. It was during this battle that Gorn was said to have gained divinity. After 20 years of fighting, the demons were finally pushed back into the abyss." },

  { id: "perimeter", when: "20 PF, after the war", year: 20,
    name: "The perimeter established",
    lore: "Following the fighting, three settlements were erected around the Fracture to stand guard and defeat the remaining beasts. Gorns Rest, Tel'rens Ridge, and Hackett's Watch were established as perimeter towns and as a line of defence between the fiends that still lay within the abyss." },

  { id: "gloomwood", when: "1942 PF", year: 1942,
    name: "Gloomwood founded",
    lore: "A town given to and formed by former indentured warriors from the Fracture, who spent much of their lives fighting hellbeasts in that same chasm. It still carries that heritage of fostering outcasts and warriors from all species and all areas of the world." },

  { id: "now", when: "2022 PF", year: 2022,
    name: "Two thousand years on",
    lore: "The world has known relative peace in the 2002 years since the great war ended, but has not been unburdened. Vestiges of the underworld still haunt the Fracture looking to claw their way out, dangerous beasts stalk the mountains of Müür, and restless spirits haunt the moors west of Gorns Rest — where, lately, caravans have stopped arriving on the other side." }
];

/* ============================================================
   LOOKUPS — pure, no state
   ============================================================ */
const CYRNN = {
  regions: CYRNN_REGIONS,
  places: CYRNN_PLACES,
  groups: CYRNN_GROUPS,
  powers: CYRNN_POWERS,
  peoples: CYRNN_PEOPLES,
  eras: CYRNN_ERAS,

  region(id) {
    for (let i = 0; i < CYRNN_REGIONS.length; i++) {
      if (CYRNN_REGIONS[i].id === id) return CYRNN_REGIONS[i];
    }
    return null;
  },

  place(id) {
    for (let i = 0; i < CYRNN_PLACES.length; i++) {
      if (CYRNN_PLACES[i].id === id) return CYRNN_PLACES[i];
    }
    return null;
  },

  group(id) {
    for (let i = 0; i < CYRNN_GROUPS.length; i++) {
      if (CYRNN_GROUPS[i].id === id) return CYRNN_GROUPS[i];
    }
    return null;
  },

  /* Places of a region, in the order the source introduces them. */
  placesIn(regionId) {
    return CYRNN_PLACES.filter(function (p) { return p.region === regionId; });
  },

  /* Everything a place answers to, for the calendar join: itself, its
     region, and any group it belongs to. Pass the result straight to
     CAL.holidaysForScopes to find out which feasts are kept there. */
  scopesFor(placeId) {
    const p = CYRNN.place(placeId);
    if (!p) return [];
    return [p.id, p.region].concat(p.groups || []);
  },

  /* A region answers to itself, plus every place inside it — so asking
     "what does Müür observe?" catches Lyestra's Fall, which the sheet
     files under Gorns Rest specifically. */
  scopesForRegion(regionId) {
    return [regionId].concat(CYRNN.placesIn(regionId).map(function (p) { return p.id; }));
  },

  /* Powers and peoples tied to a place or region, by the same scope
     vocabulary — so Gorns Rest can surface Lyestra without a hand-kept
     list, and the Ghost Moors can surface Thraazipan and the Wulven. */
  lorePinnedTo(scopes) {
    const want = {};
    (scopes || []).forEach(function (s) { want[s] = true; });
    const hit = function (e) {
      return (e.scopes || []).some(function (s) { return want[s]; });
    };
    return {
      powers: CYRNN_POWERS.filter(hit),
      peoples: CYRNN_PEOPLES.filter(hit)
    };
  },

  /* One flat, case-insensitive search across everything that has prose,
     so the atlas gets a single search box rather than one per section. */
  search(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return [];
    const out = [];
    const scan = function (list, type) {
      list.forEach(function (e) {
        const hay = [e.name, e.title, e.blurb, e.lore, (e.tags || []).join(" ")]
          .filter(Boolean).join(" ").toLowerCase();
        if (hay.indexOf(s) >= 0) out.push({ type: type, entry: e });
      });
    };
    scan(CYRNN_PLACES, "place");
    scan(CYRNN_REGIONS, "region");
    scan(CYRNN_POWERS, "power");
    scan(CYRNN_PEOPLES, "people");
    scan(CYRNN_ERAS, "era");
    return out;
  }
};

/* Node's test harness loads this with require(); the browser just wants
   the globals. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CYRNN: CYRNN };
}
