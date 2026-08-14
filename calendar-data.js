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

const JERBEEN_HOLIDAYS = [
  { name: "The Emergence", day: 1,
    lore: "Following the strict 5-day cycle of cultivating and rinsing subterranean sprout mixes during winter, this day marks a return to high-protein surface foraging. A communal meal restores muscle mass for the upcoming season's labor." },
  { name: "The High Weave", day: 42,
    lore: "A mandatory day of communal labor commemorating the 9th Shift. Adult Jerbeens interlock new briar growth. Aligns perfectly with the Common calendar's Gladmer's Stand." },
  { name: "The Proving", day: 77,
    lore: "Maturity rite for 5-year-olds. Initiates must map the outer perimeter with absolute efficiency, carefully managing their stamina to avoid passive exhaustion while evading territorial predators." },
  { name: "The Still-Tread", day: 98,
    lore: "Structural vibrations are monitored; movement is restricted to prevent cave-ins from heavy migration overhead." },
  { name: "The Cinder Feast", day: 168,
    lore: "Commemorates the 4th Shift. The community inspects broad-leaf water-catchment basins and feasts on final summer yields before tightening the perimeter." },
  { name: "The Deep Harvest", day: 206,
    lore: "A highly coordinated agricultural effort to extract cultivated roots before rooting boars destroy the yield." },
  { name: "The Barricade", day: 252,
    lore: "The outer entrances to the Shade Briar are physically sealed with woven thorns and packed earth." },
  { name: "The Silent Vigil", day: 287,
    lore: "A solemn 24-hour period of absolute silence memorializing the 1st Shift and avoiding acoustic detection by weasels." },
  { name: "The Ceding", day: 364,
    lore: "Administrative planning for the Spring. Once every 40 years, this date concludes the Elder Shift. The central Briar Cord is updated with a carved, dense wooden bead summarizing the era's critical structural or survival achievements." }
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
  { name: "Gladmer's Stand", day: 42,
    lore: "Commemorates a historic victory over monstrous incursions. Lore dictates the victory was secured through rigid cooperative party tactics and the strategic use of throwing weapons to break enemy frontlines from a distance. Celebrated with militia drills and heavily spiced foods." },
  { name: "The Canopy Chorus", day: 75,
    lore: "An ancient elven tradition marking the day ancestral forests were sung into existence. Celebrants hang enchanted glass chimes. Felling timber on this day carries heavy social stigma and, in some districts, legal fines." },
  { name: "The Grand Bake", day: 210,
    lore: "A massive, cross-cultural feasting day originating from halfling traditions. Public thoroughfares host 24-hour continuous ovens. It acts as a socio-economic reset; food is freely distributed, minimizing regional hoarding before winter." },
  { name: "The All-Forge", day: 241,
    lore: "Marks the dwarven sealing of mountain-holds and the ignition of deep-magma forges. Surface cities honor this by simultaneously extinguishing and reigniting all public hearths. Regional infrastructural energy networks are rigorously inspected and recalibrated on this day." },
  { name: "The Remembrance", day: 361,
    lore: "Convergence Day 1. A somber day dedicated to settling ledgers and honoring ancestors. All debts accumulated over the 360-day year must be cleared before sundown." },
  { name: "The Revelry", day: 362,
    lore: "Convergence Day 2. A day of absolute, legally sanctioned excess. Public intoxication laws are suspended, sharply contrasting with the quiet conservation occurring simultaneously in the Shade Briar." },
  { name: "The Concord", day: 363,
    lore: "Convergence Day 3. Celebrates the historical signing of the Concordant Treaty. Treaties are formally renewed, and guild leadership structures are finalized for the new year." },
  { name: "The Dawning Eve", day: 364,
    lore: "Convergence Day 4. A transitional day of preparation. Structures are rigorously cleaned. At midnight, synchronized bells launch the new year, directly paralleling the Jerbeen administrative Ceding." }
];

const CAL_SYSTEMS = {
  jerbeen: { key: "jerbeen", label: "Jerbeen", months: JERBEEN_MONTHS, holidays: JERBEEN_HOLIDAYS },
  common:  { key: "common",  label: "Common",  months: COMMON_MONTHS,  holidays: COMMON_HOLIDAYS }
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
