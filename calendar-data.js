/* ============================================================
   CALENDAR — two systems over one shared 364-day year
   ------------------------------------------------------------
   Both calendars run on the same "global day" axis (1-364), so a
   single S.calendar.day describes the date in BOTH systems at once
   and switching systems is purely a display choice. Global day 1 is
   Grub-Wake 1 (Jerbeen) and Dawnrise 1 (Common); global day 364 puts
   the quiet Jerbeen Ceding opposite the Common Dawning Eve.

   Jerbeen: 13 months x 28 days.
   Common:  12 months x 30 days, plus a 4-day intercalary Convergence.

   Data only + pure lookups — no DOM, no state. Loaded before app.js.
   ============================================================ */

const CAL_DAYS_PER_YEAR = 364;

const TIMES_OF_DAY = [
  { key: "dawn",      label: "Dawn" },
  { key: "morning",   label: "Morning" },
  { key: "midday",    label: "Midday" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening",   label: "Evening" },
  { key: "night",     label: "Night" }
];

/* 364 = 52 x 7 exactly, so the seven-day cycle never drifts: a given
   global day is the same weekday every year, in both systems. A Jerbeen
   month is exactly four weeks; Common months of 30 straddle them, which
   is why the month grid aligns to columns rather than starting each
   month at column 1.

   The two cultures name the same seven days for their own labour cycle,
   and land on the same conclusion about the seventh — the burrow goes
   quiet, the guildhalls close. */
const WEEKDAY_NAMES = {
  jerbeen: ["Tunnel-Tend", "Cord-Count", "Forage-Wide", "Thorn-Weave",
            "Ear-Turn", "Kin-Gather", "Deep-Still"],
  common:  ["Firstlight", "Ledgerday", "Anvilday", "Crossway",
            "Hearthday", "Marketmoot", "Stillwane"]
};

/* Column headings have to fit seven across on a phone, so each name
   also carries the short form the grid actually draws. */
const WEEKDAY_ABBR = {
  jerbeen: ["Tunnel", "Cord", "Forage", "Thorn", "Ear", "Kin", "Deep"],
  common:  ["First", "Ledger", "Anvil", "Cross", "Hearth", "Market", "Still"]
};

const JERBEEN_MONTHS = [
  { name: "Grub-Wake",    start: 1,   end: 28,  season: "Spring",
    lore: "The month of the thaw. Specialized foraging teams break winter rationing to harvest subterranean insects." },
  { name: "Hawk-Shadow",  start: 29,  end: 56,  season: "Spring",
    lore: "Migratory raptors return. The Shade Briar's upper canopy must be strictly maintained." },
  { name: "Fox-Whelp",    start: 57,  end: 84,  season: "Spring",
    lore: "Local predators give birth, resulting in highly aggressive fauna in the surrounding region." },
  { name: "Hoof-Tread",   start: 85,  end: 112, season: "Summer",
    lore: "Migration of large herbivores, posing a severe trampling hazard to burrows." },
  { name: "Coil-Bask",    start: 113, end: 140, season: "Summer",
    lore: "Peak heat. Cold-blooded predators seek the cool roots of the Briar." },
  { name: "Owl-Roost",    start: 141, end: 168, season: "Summer",
    lore: "Nocturnal avian predators reach peak population. Night travel is strictly prohibited." },
  { name: "Buck-Rut",     start: 169, end: 196, season: "Autumn",
    lore: "Large herbivores clash territorially, threatening the outer briar walls." },
  { name: "Boar-Root",    start: 197, end: 224, season: "Autumn",
    lore: "Omnivores forage aggressively for tubers. Subterranean crops must be harvested quickly." },
  { name: "Wolf-Prowl",   start: 225, end: 252, season: "Autumn",
    lore: "Prey thins out, and pack-hunting predators test the defensive weave." },
  { name: "Den-Seal",     start: 253, end: 280, season: "Winter",
    lore: "Large predators hibernate, easing structural threats to the Briar." },
  { name: "Ermine-Stalk", start: 281, end: 308, season: "Winter",
    lore: "The most dangerous month. Winter-adapted burrowing predators actively hunt in the tunnels." },
  { name: "Raven-Call",   start: 309, end: 336, season: "Winter",
    lore: "Scavengers dominate the canopy. Their calls act as an auditory early-warning system." },
  { name: "Still-Wood",   start: 337, end: 364, season: "Winter",
    lore: "Deep winter quiet. Strict caloric conservation and interior communal labor." }
];

/* Holidays carry the region that observes them, straight from the campaign
   sheet. Two fields, because they answer different questions: regionLabel is
   the phrasing as written and is what gets shown, while scopes is what the
   code joins on. A scope matches a region id, a single place id, or a group
   tag ("perimeter" = the three towns founded to watch the Fracture), and
   "pan-regional" means everywhere. So a place can ask "which feasts are kept
   here?" without anyone maintaining that list by hand.

   The sheet also states each holiday's weekday. It is derivable from the day
   number, so it is not stored -- test-app.js re-derives all 36 and checks
   them, which makes the spreadsheet a proof of the calendar math.

   GENERATED from tools/cyrnn-calendar.csv by tools/gen-calendar.py.
   Edit the sheet and re-run rather than editing the arrays below.
   ------------------------------------------------------------ */
const JERBEEN_HOLIDAYS = [
  { name: "The Emergence", day: 1,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Following the strict 5-day cycle of cultivating and rinsing subterranean sprout mixes during winter, this day marks a return to high-protein surface foraging in the lower brush. Burrowers harvest fresh beetle grubs and tender shoots, sharing a communal meal in the central warren to restore muscle mass for spring tunnel-boring." },
  { name: "The Bedrock-Listen", day: 14,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "A mandatory defensive audit where listeners place their ears directly against deep tunnel stone to detect seismic fracturing or clawing vibrations from the abyss. Galleries showing stress fractures or rock shifts are immediately reinforced with cured greenwood braces." },
  { name: "The High Weave", day: 42,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "A mandatory day of communal labor commemorating the 9th Shift when raptors breached the outer thickets. Adult Jerbeens interlock fresh thorny hawthorn runners into the canopy to bolster structural integrity against nesting predators. Aligns directly with the Common calendar's Gladmer's Stand." },
  { name: "The Proving", day: 77,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Maturity rite for five-year-old Jerbeens. Initiates must map the outer perimeter thickets with absolute stealth and speed, avoiding predator dens and managing stamina to evade hunting foxes; those returning before nightfall receive their first carved cord-bead." },
  { name: "The Still-Tread", day: 98,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Observed during heavy surface herbivore migrations overhead. Structural vibrations are monitored continuously and all non-essential movement and heavy digging are forbidden for 24 hours to prevent cave-ins and avoid acoustic detection." },
  { name: "The Root-Chill", day: 126,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Peak summer heat drives cold-blooded reptiles downward toward cool burrow roots. Jerbeen crews pump damp bog-clay through ceiling vents and burn dried bitter-leaf to smoke basking vipers out of primary living galleries." },
  { name: "The Cinder Feast", day: 168,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Commemorates the 4th Shift preservation of burrow cisterns. The community inspects broad-leaf water-catchment basins, dries late-summer berries over smothered hearth embers, and trims perimeter briars before nocturnal owl populations reach peak hunting efficiency." },
  { name: "The Horn-Brace", day: 182,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Clashing rutting stags in the brush above threaten shallow tunnel ceilings. Jerbeen digging crews drive dense hardwood reinforcement stakes into perimeter roofs and pack clay-bound gravel over high-stress support arches to absorb violent ground shocks." },
  { name: "The Iron-Break", day: 196,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Commemorates the historical cessation of upper surface quakes caused by the war against the Black Castle. Burrow artisans re-carve worn directional glyphs into bedrock passageways and distribute an extra ladle of roasted root mash." },
  { name: "The Deep Harvest", day: 206,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "A highly coordinated round-the-clock agricultural effort to extract cultivated tubers and roots from outer plots before rooting boar packs destroy the yield; crops are cleaned and packed in dry sand within deep storage vaults." },
  { name: "The Barricade", day: 252,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "As winter predator packs begin roving, outer entrances to the Shade Briar are physically sealed with woven thorn-faggots and packed clay; the warren enters seasonal isolation, maintaining only concealed watch-holes." },
  { name: "The Silent Vigil", day: 287,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "A solemn 24-hour period of absolute acoustic silence memorializing the lost warrens of the 1st Shift and evading detection by winter-stalking ermines; all forge work and speaking are suspended in favor of paw-sign communication." },
  { name: "The Echo-Listen", day: 322,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Lookouts sit at hollowed root trumpets to listen for scavenger birds in the frozen canopy above. Jerbeen scout masters transcribe raven flocking patterns to pinpoint where wolf packs and wandering beasts are moving on the snowpack." },
  { name: "The Ceding", day: 364,
    regionLabel: "The Shade Briar",
    scopes: ["shade-briar"],
    lore: "Administrative planning for Spring where elders balance winter stores and assign tunnel shifts. Once every 40 years on the Elder Shift, a master-carver attaches a dense ironwood bead to the Great Briar Cord summarizing four decades of communal survival." }
];

const COMMON_MONTHS = [
  { name: "Dawnrise",       start: 1,   end: 30,  season: "Spring",
    lore: "The first month of the year, tracking the melting snows and the initial clearing of major trade routes." },
  { name: "Gladmer",        start: 31,  end: 60,  season: "Spring",
    lore: "Month of planting and heavy rains. Named for the historic floodplains where early human agriculture stabilized." },
  { name: "Seedfall",       start: 61,  end: 90,  season: "Spring",
    lore: "Late spring blooming period, characterized by high winds and pollen drift." },
  { name: "Sunward",        start: 91,  end: 120, season: "Summer",
    lore: "Marks the beginning of the summer solstice cycle and the longest days of the year." },
  { name: "Highcrest",      start: 121, end: 150, season: "Summer",
    lore: "Peak summer heat. Rivers run low, and cross-country travel is typically done at dawn or dusk." },
  { name: "Goldleaf",       start: 151, end: 180, season: "Summer",
    lore: "Late summer transition as the intense heat breaks and leaves begin to dry." },
  { name: "Harvestide",     start: 181, end: 210, season: "Autumn",
    lore: "The primary agricultural harvest. Guilds heavily tax and inventory regional yields." },
  { name: "Hearthfire",     start: 211, end: 240, season: "Autumn",
    lore: "The first frosts arrive. Populations move indoors and rural settlements reinforce their structures." },
  { name: "Frostgate",      start: 241, end: 270, season: "Winter",
    lore: "Mountain passes fill with snow, sealing off overland trade routes." },
  { name: "Deeprime",       start: 271, end: 300, season: "Winter",
    lore: "Mid-winter. The ground freezes solid, and travel is largely restricted to immediate regional networks." },
  { name: "Gloaming",       start: 301, end: 330, season: "Winter",
    lore: "The darkest and coldest month. Social activity drops significantly; focus is on rationing." },
  { name: "Endmark",        start: 331, end: 360, season: "Winter",
    lore: "The final standard month. Preparations begin for the spring thaw and the unblocking of roads." },
  { name: "The Convergence", start: 361, end: 364, season: "Festival",
    lore: "A 4-day intercalary period outside the standard 12 months, aligning with the final four days of the Jerbeen year." }
];

const COMMON_HOLIDAYS = [
  { name: "Isenbyr's Lament", day: 14,
    regionLabel: "Müür & Fracture Perimeter",
    scopes: ["muur", "perimeter"],
    lore: "Marks the catastrophic tearing of the Great Fracture at the dwarven settlement of Isenbyr 2,022 years ago. Dwarven citadels ring solemn low-register bells and inspect deep structural bedrock anchors, while perimeter garrisons at Hackett's Watch, Gorns Rest, and Tel'ren's Ridge hold silent roll calls for fallen settlements." },
  { name: "Gladmer's Stand", day: 42,
    regionLabel: "The Hearthlands & Kurst",
    scopes: ["hearthlands", "kurst"],
    lore: "Commemorates a historic victory over monstrous incursions on the Gladmer floodplains through rigid cooperative militia tactics and long-range throwing spears. Celebrated with disciplined spear drills in municipal plazas followed by feasts of heavily spiced roasted mutton and peppered river-pike." },
  { name: "Lyestra's Fall", day: 56,
    regionLabel: "Müür & Gorns Rest",
    scopes: ["muur", "gorns-rest"],
    lore: "Commemorates the descent and sacrifice of the dwarven mother-goddess Lyestra in the Black Castle during the fourth year of the Demon War. Citadels extinguish all forge fires for 24 hours in cold mourning, whereas in secular Gorns Rest, smiths present polished unworked iron ingots at open-air memorial plinths." },
  { name: "The Canopy Chorus", day: 75,
    regionLabel: "Kel'dorel",
    scopes: ["keldorel"],
    lore: "An ancient elven tradition centered in Salins Cove and Silver Grove marking the day ancestral forests were sung into existence. Minstrels and bards from the Emerald Palace suspend enchanted glass chimes from elder branches to harmonize with dawn breezes; felling living timber on this day carries severe legal fines." },
  { name: "Watcher's Muster", day: 84,
    regionLabel: "Kurst",
    scopes: ["kurst"],
    lore: "Marks the historical banishment of High Priest Corvaunus Hackett and the garrisoning of Hackett's Line. Magistrates across Kurst audit penal registers in Kurstenport, marching newly sentenced convicts to Hackett's Watch to work off sentences at triple speed in indentured frontline companies against Fracture fiends." },
  { name: "The Silver Ascent", day: 106,
    regionLabel: "Kel'dorel",
    scopes: ["keldorel"],
    lore: "The wood elves of Silver Grove inaugurate the summer hunting season with a mass aerial muster of the Silver Riders. Mounted handlers cast silver pollen across the 150-foot canopy of the Highwood to ward against arboreal predators and bless young wyvern clutches." },
  { name: "The Triad Conclave", day: 132,
    regionLabel: "The Eye of Evil",
    scopes: ["eye-of-evil"],
    lore: "Storms Rift commemorates the rule of its governing dragon triad—metallic, chromatic, and gem. Dragonborn mercenary companies muster in public arenas to renew corporate contracts, while arcane academies host resonance trials to test innate sorcerous lineages." },
  { name: "The Obsidian Accord", day: 154,
    regionLabel: "The Eye of Evil",
    scopes: ["eye-of-evil"],
    lore: "Commemorates the emergence of the archdemon Yamuuk at the Eye of Evil crater and his defection against Azar'och. Sangromancers of Maelstrom Keep drink consecrated spiced vitriol before obsidian shrines, while neighboring trade caravans double their outrider escorts and bypass the eastern crater road." },
  { name: "The Opal Bout", day: 174,
    regionLabel: "Kurst",
    scopes: ["kurst"],
    lore: "The Opal Conservatoire in Kurstenport hosts its annual graduation martial tourney. Elite duelists and master tacticians compete in public amphitheaters while noble houses, merchant cartels, and mercenary captains bid heavily on officer retainer commissions." },
  { name: "Gorn's Triumph", day: 196,
    regionLabel: "Pan-Regional & Frontier",
    scopes: ["pan-regional", "perimeter"],
    lore: "Celebrates the slaying of Azar'och and the apotheosis of Gorn Shattersteel at the Black Castle, ending the twenty-year Demon War. In Gorns Rest and frontier settlements, citizens shatter symbolic iron chains, hold weapon-blessing tournaments, and tap barrels of dark stout." },
  { name: "The Grand Bake", day: 210,
    regionLabel: "The Hearthlands & Pan-Regional",
    scopes: ["hearthlands", "pan-regional"],
    lore: "Originating from halfling agrarian traditions in the Hearthlands, public thoroughfares host continuous 24-hour communal brick ovens. Neighborhoods freely bake and distribute breads, pastries, and hardtack, acting as a regional economic reset to eliminate food hoarding before winter." },
  { name: "Strider's Rite", day: 231,
    regionLabel: "Kurst",
    scopes: ["kurst"],
    lore: "Frost elf initiates in Korin'bel plunge into glacial melt pools under elder incantations to affirm cold-hardened vitality before taking their oaths as Strider rangers. Human lords send recruitment envoys bearing silver and high-grade steel to contract elite winter scouts." },
  { name: "The All-Forge", day: 241,
    regionLabel: "Müür & Pan-Regional",
    scopes: ["muur", "pan-regional"],
    lore: "Marks the dwarven sealing of mountain citadels and the rekindling of subterranean deep-magma crucibles. Surface cities honor this by simultaneously extinguishing and reigniting public hearths from smithy coals, followed by municipal heating inspections." },
  { name: "The Blood Crusade", day: 263,
    regionLabel: "The Eye of Evil & Fracture",
    scopes: ["eye-of-evil", "fracture"],
    lore: "Maelstrom Keep dispatches its triennial capture-companies into the Fracture to hunt live fiends for sacrificial offering to Yamuuk. Surrounding farming hamlets bolt their shutters and hold livestock within inner enclosures until the black-armored crusaders return westward." },
  { name: "The Free Charter", day: 294,
    regionLabel: "The Hearthlands",
    scopes: ["hearthlands"],
    lore: "Towns along Moonlit Harbour hold open municipal elections, casting colored porcelain tokens into public urns to seat town councils free from kingdom authority. Veteran coastal militias muster at the piers, firing signal flares over the bay to deter offshore pirate syndicates." },
  { name: "Westfall", day: 314,
    regionLabel: "Western Sea",
    scopes: ["western-sea"],
    lore: "Free ports across Last Light Island throw raucous open-cask carnivals to celebrate the final rays of winter sun touching Cyrnn's westernmost cliffs. Deep within the island's interior jungles, Yuan-Ti temple-keepers conduct quiet obsidian-blade rituals in total isolation from the revelry." },
  { name: "The Sapphire Concourse", day: 336,
    regionLabel: "Frostlands",
    scopes: ["frostlands"],
    lore: "Gnomes, Goliaths, and Orcs gather at Cobalt Citadel to commemorate their unified founding. Arcane academies illuminate the city's sapphire-tipped silver spires with synced magical beacons, while guilds unveil new civic engineering mechanisms." },
  { name: "The Absent Vigil", day: 350,
    regionLabel: "Kurst & Pan-Regional",
    scopes: ["kurst", "pan-regional"],
    lore: "Human clerics and paladins of Boralius douse all altar flames and conduct silent, unguided meditation to reflect upon their god's intentional absence during the Demon War. Communities focus entirely on present worldly responsibilities, repairing municipal tools and settling neighborhood disputes without invoking divine aid." },
  { name: "The Remembrance", day: 361,
    regionLabel: "Pan-Regional",
    scopes: ["pan-regional"],
    lore: "Convergence Day 1. A somber day dedicated to settling ledgers and honoring ancestors. All debts accumulated over the 360-day year must be legally cleared or renegotiated before sundown, while memorial lanterns are placed on ancestral graves." },
  { name: "The Revelry", day: 362,
    regionLabel: "Pan-Regional",
    scopes: ["pan-regional"],
    lore: "Convergence Day 2. A day of absolute, legally sanctioned civic excess where public intoxication and sumptuary laws are temporarily suspended, sharply contrasting with the quiet caloric conservation occurring simultaneously in the Shade Briar." },
  { name: "The Concord", day: 363,
    regionLabel: "Pan-Regional",
    scopes: ["pan-regional"],
    lore: "Convergence Day 3. Celebrates the historic signing of the Concordant Treaty between humans, elves, and dwarves. Treaties are formally renewed, guild leadership structures are finalized, and civic oaths are administered for the upcoming year." },
  { name: "The Dawning Eve", day: 364,
    regionLabel: "Pan-Regional",
    scopes: ["pan-regional"],
    lore: "Convergence Day 4. A transitional day of thorough purification and sweeping of homes and municipal halls. At midnight, synchronized bells, horns, and temple carillons sound across all surface settlements to welcome the new year." }
];

/* Both systems count the same year, because they count the same days —
   only the naming differs. The Common calendar reckons from the Great
   Fracture and says so out loud ("2022 PF", Post Fracture); the Shade
   Briar keeps the count without the era, its history being told in
   Shifts rather than in years since somebody else's disaster. */
const CAL_SYSTEMS = {
  jerbeen: { key: "jerbeen", label: "Jerbeen", era: "",   months: JERBEEN_MONTHS, holidays: JERBEEN_HOLIDAYS },
  common:  { key: "common",  label: "Common",  era: "PF", months: COMMON_MONTHS,  holidays: COMMON_HOLIDAYS }
};

const CAL = {
  daysPerYear: CAL_DAYS_PER_YEAR,
  systems: CAL_SYSTEMS,

  /* Wrap any integer into 1..364 so callers never have to think about it. */
  normalizeDay(day) {
    const d = ((Math.round(day) - 1) % CAL_DAYS_PER_YEAR + CAL_DAYS_PER_YEAR) % CAL_DAYS_PER_YEAR;
    return d + 1;
  },

  /* Advance (or rewind) by whole days, rolling the year over as needed. */
  advance(day, year, delta) {
    const raw = Math.round(day) + Math.round(delta || 0);
    const yearShift = Math.floor((raw - 1) / CAL_DAYS_PER_YEAR);
    return { day: CAL.normalizeDay(raw), year: Math.round(year) + yearShift };
  },

  system(key) { return CAL_SYSTEMS[key] || CAL_SYSTEMS.jerbeen; },

  monthFor(systemKey, day) {
    const d = CAL.normalizeDay(day);
    const months = CAL.system(systemKey).months;
    for (let i = 0; i < months.length; i++) {
      if (d >= months[i].start && d <= months[i].end) return months[i];
    }
    return months[0];
  },

  dayOfMonth(systemKey, day) {
    return CAL.normalizeDay(day) - CAL.monthFor(systemKey, day).start + 1;
  },

  /* "Hawk-Shadow 14" — the date as that system writes it. */
  format(systemKey, day) {
    return CAL.monthFor(systemKey, day).name + " " + CAL.dayOfMonth(systemKey, day);
  },

  holidayFor(systemKey, day) {
    const d = CAL.normalizeDay(day);
    const list = CAL.system(systemKey).holidays;
    for (let i = 0; i < list.length; i++) if (list[i].day === d) return list[i];
    return null;
  },

  /* Every holiday landing on this day, across both systems. Days like 42
     and 364 are deliberately shared between the two calendars, and that
     coincidence is worth surfacing rather than hiding. */
  allHolidaysFor(day) {
    const out = [];
    Object.keys(CAL_SYSTEMS).forEach(function (k) {
      const h = CAL.holidayFor(k, day);
      if (h) out.push({ system: k, label: CAL_SYSTEMS[k].label, holiday: h });
    });
    return out;
  },

  /* The next holiday in this system at or after `day` (wrapping the year). */
  nextHoliday(systemKey, day) {
    const d = CAL.normalizeDay(day);
    const list = CAL.system(systemKey).holidays;
    let best = null, bestIn = Infinity;
    list.forEach(function (h) {
      let diff = h.day - d;
      if (diff < 0) diff += CAL_DAYS_PER_YEAR;
      if (diff < bestIn) { bestIn = diff; best = h; }
    });
    return best ? { holiday: best, inDays: bestIn } : null;
  },

  /* How a year reads in a given system: "2022 PF" in the Common
     reckoning, "Year 2022" in the Jerbeen, which counts the same year
     but does not date itself from somebody else's disaster.

     This returns the whole phrase, prefix included, so callers never
     concatenate a "Year " of their own -- that is how one screen ends
     up saying "Year 2022 PF" and another just "2022". */
  yearLabel(systemKey, year) {
    const era = CAL.system(systemKey).era;
    return era ? year + " " + era : "Year " + year;
  },

  /* ---- Who keeps which feast ---------------------------------
     The map's side of the join. Hand it every scope a place answers to
     -- its own id, its region, any group it belongs to -- and get back
     the feasts kept there, in day order across both calendars.

     Pan-regional holidays are included, because "what is observed here"
     truthfully includes the ones observed everywhere, but each result
     says which kind of match it was so the caller can group them. A
     local feast is the interesting one and should be able to lead. */
  holidaysForScopes(scopes) {
    const want = {};
    (scopes || []).forEach(function (s) { want[s] = true; });
    const out = [];
    Object.keys(CAL_SYSTEMS).forEach(function (k) {
      CAL_SYSTEMS[k].holidays.forEach(function (h) {
        const local = (h.scopes || []).some(function (s) { return want[s]; });
        const everywhere = (h.scopes || []).indexOf("pan-regional") >= 0;
        if (!local && !everywhere) return;
        out.push({ system: k, label: CAL_SYSTEMS[k].label, holiday: h,
                   local: local, panRegional: everywhere });
      });
    });
    /* Local first, then by day, so a place's own feasts lead its list. */
    out.sort(function (a, b) {
      if (a.local !== b.local) return a.local ? -1 : 1;
      return a.holiday.day - b.holiday.day;
    });
    return out;
  },

  /* Does this scope set keep the feast falling on `day`? Used to mark the
     map when the party is somewhere that observes today. */
  observedOn(scopes, day) {
    return CAL.allHolidaysFor(day).filter(function (e) {
      const sc = e.holiday.scopes || [];
      return sc.indexOf("pan-regional") >= 0 ||
        (scopes || []).some(function (s) { return sc.indexOf(s) >= 0; });
    });
  },

  /* ---- Weeks and grids ---------------------------------------
     Everything here is derived from the global day, so the two systems
     share one week structure and only the labels differ. */

  weekdayIndex(day) { return (CAL.normalizeDay(day) - 1) % 7; },

  weekdayName(systemKey, day) {
    return WEEKDAY_NAMES[CAL.system(systemKey).key][CAL.weekdayIndex(day)];
  },

  weekdayShort(systemKey, index) {
    return WEEKDAY_ABBR[CAL.system(systemKey).key][index];
  },

  /* 1-52. */
  weekIndex(day) { return Math.floor((CAL.normalizeDay(day) - 1) / 7) + 1; },

  weekStart(day) { return (CAL.weekIndex(day) - 1) * 7 + 1; },

  /* The seven global days of the week containing `day`. */
  weekDays(day) {
    const start = CAL.weekStart(day);
    const out = [];
    for (let i = 0; i < 7; i++) out.push(start + i);
    return out;
  },

  /* Rows of seven for the month containing `day`, aligned to weekday
     columns. Cells outside the month are null so the grid keeps its
     shape — a Common month can start mid-week, and the Convergence is
     only four days long. */
  monthWeeks(systemKey, day) {
    const m = CAL.monthFor(systemKey, day);
    const rows = [];
    let row = new Array(7).fill(null);
    let col = CAL.weekdayIndex(m.start);
    for (let d = m.start; d <= m.end; d++) {
      row[col] = d;
      col++;
      if (col === 7) { rows.push(row); row = new Array(7).fill(null); col = 0; }
    }
    if (col !== 0) rows.push(row);
    return rows;
  },

  /* First global day of the month before/after the one holding `day`.
     Wraps the year at both ends, so paging never dead-ends. */
  monthStep(systemKey, day, dir) {
    const m = CAL.monthFor(systemKey, day);
    return CAL.normalizeDay(dir < 0 ? m.start - 1 : m.end + 1);
  },

  timeIndex(key) {
    if (!key) return -1;              /* "any time" sorts before Dawn */
    for (let i = 0; i < TIMES_OF_DAY.length; i++) {
      if (TIMES_OF_DAY[i].key === key) return i;
    }
    return -1;
  },

  timesOfDay() { return TIMES_OF_DAY.slice(); },

  /* ---- Point-in-time arithmetic ------------------------------
     A "stamp" is { year, day, time } — the same shape session log
     entries already carry. Signed day distance, so a negative result
     means the moment is behind you. */
  diffDays(from, to) {
    return (to.year - from.year) * CAL_DAYS_PER_YEAR + (to.day - from.day);
  },

  /* <0 if a is earlier than b, 0 if the same moment, >0 if later. */
  compare(a, b) {
    const d = CAL.diffDays(a, b);
    if (d !== 0) return -d;
    return CAL.timeIndex(a.time) - CAL.timeIndex(b.time);
  },

  /* Where a dated thing sits relative to `now`. `ev.year == null` means
     it repeats every year (holidays, and any note marked yearly);
     `ev.timeOfDay` null means "any time that day", which is why it sorts
     ahead of Dawn. Returns the occurrence in the current year — which
     may already be behind you — plus the distance to the NEXT one, so a
     lead-up warning counts toward the one still coming. */
  placeEvent(ev, now) {
    const day = CAL.normalizeDay(ev.day);
    const time = ev.timeOfDay || null;
    const annual = ev.year == null;
    const stamp = { day: day, year: annual ? now.year : ev.year, time: time };
    const past = CAL.compare(stamp, now) < 0;
    const upcoming = (past && annual) ? { day: day, year: stamp.year + 1, time: time } : stamp;
    return {
      stamp: stamp, past: past,
      inDays: CAL.diffDays(now, stamp),
      untilNext: CAL.diffDays(now, upcoming)
    };
  },

  timeLabel(key) {
    for (let i = 0; i < TIMES_OF_DAY.length; i++) {
      if (TIMES_OF_DAY[i].key === key) return TIMES_OF_DAY[i].label;
    }
    return TIMES_OF_DAY[0].label;
  },

  /* Step through the day's phases; rolling past Night moves to the next
     dawn, so "advance time" alone can carry you into tomorrow. */
  nextTime(key) {
    let i = 0;
    for (let n = 0; n < TIMES_OF_DAY.length; n++) if (TIMES_OF_DAY[n].key === key) i = n;
    const next = (i + 1) % TIMES_OF_DAY.length;
    return { key: TIMES_OF_DAY[next].key, rolledOver: next === 0 };
  },

  /* "Hawk-Shadow 14, Morning · Year 222" — used to stamp session notes. */
  stamp(cal) {
    if (!cal) return "";
    return CAL.format(cal.system, cal.day) + ", " + CAL.timeLabel(cal.timeOfDay) +
      " · Year " + cal.year;
  }
};
