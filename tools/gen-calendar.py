"""Regenerate the holiday tables in calendar-data.js from the campaign sheet.

    python tools/gen-calendar.py

Reads tools/cyrnn-calendar.csv and rewrites the JERBEEN_HOLIDAYS and
COMMON_HOLIDAYS arrays in place, leaving the rest of calendar-data.js --
the months, the weekdays, the CAL lookups -- untouched.

WHY THIS EXISTS
The holidays are authored in a spreadsheet, not in code. Before this,
they were copied across by hand, which is how the sheet came to say the
Great Fracture was "2,000 years ago" while the app said 2,022: two
copies of the same fact, drifting. Now there is one copy. Export the
sheet over tools/cyrnn-calendar.csv, run this, and commit both -- the
diff shows exactly what changed in the world.

If the sheet lives in Google Sheets, that is the real master: fix
content there and re-export, or the next export undoes it.

CSV QUIRK
The export does not quote its fields, so a comma inside a note splits it
across columns. Rejoining on "," restores the text; the only care needed
is spacing, because the export also drops the space after each comma --
except inside numbers like "2,022", which never had one. Hence: put a
space back only when a letter follows.

CHECKS
The sheet states a weekday for every holiday. It is derivable from the
day number, so this does not store it -- it verifies it, and refuses to
write anything if the sheet and the calendar disagree. Same for region
labels: an unrecognised one is an error rather than a silently dropped
scope, because a holiday nobody observes would just quietly vanish.
"""
import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "cyrnn-calendar.csv")
TARGET = os.path.join(HERE, os.pardir, "calendar-data.js")

# The sheet's region labels are shown verbatim; these are the machine join.
# A scope resolves against a region id, a place id, or a group tag from
# cyrnn-data.js, plus the special "pan-regional".
SCOPES = {
    "Pan-Regional":                        ["pan-regional"],
    "The Shade Briar":                     ["shade-briar"],
    "Kurst":                               ["kurst"],
    "Kel'dorel":                           ["keldorel"],
    "The Eye of Evil":                     ["eye-of-evil"],
    "The Hearthlands":                     ["hearthlands"],
    "Frostlands":                          ["frostlands"],
    "Western Sea":                         ["western-sea"],
    "Müür & Fracture Perimeter":  ["muur", "perimeter"],
    "Müür & Gorns Rest":          ["muur", "gorns-rest"],
    "Müür & Pan-Regional":        ["muur", "pan-regional"],
    "The Hearthlands & Kurst":             ["hearthlands", "kurst"],
    "The Hearthlands & Pan-Regional":      ["hearthlands", "pan-regional"],
    "The Eye of Evil & Fracture":          ["eye-of-evil", "fracture"],
    "Pan-Regional & Frontier":             ["pan-regional", "perimeter"],
    "Kurst & Pan-Regional":                ["kurst", "pan-regional"],
}

WEEKDAYS = {
    "jerbeen": ["Tunnel-Tend", "Cord-Count", "Forage-Wide", "Thorn-Weave",
                "Ear-Turn", "Kin-Gather", "Deep-Still"],
    "common":  ["Firstlight", "Ledgerday", "Anvilday", "Crossway",
                "Hearthday", "Marketmoot", "Stillwane"],
}

HEADER = '''/* Holidays carry the region that observes them, straight from the campaign
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
'''


def rejoin(cells):
    """Undo the unquoted-comma column split."""
    text = ",".join(c for c in cells if c.strip())
    return re.sub(r",(?=[A-Za-z])", ", ", text).strip()


def js(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def emit(name, rows):
    out = ["const %s = [" % name]
    for i, h in enumerate(rows):
        tail = "" if i == len(rows) - 1 else ","
        out.append("  { name: %s, day: %d," % (js(h["name"]), h["day"]))
        out.append("    regionLabel: %s," % js(h["regionLabel"]))
        out.append("    scopes: [%s]," % ", ".join(js(s) for s in h["scopes"]))
        out.append("    lore: %s }%s" % (js(h["lore"]), tail))
    out.append("];")
    return "\n".join(out)


def main():
    rows = list(csv.reader(open(CSV_PATH, encoding="utf-8")))
    holidays = {"jerbeen": [], "common": []}
    problems = []

    for r in rows[1:]:
        if not r or r[0] != "holiday":
            continue
        system, name, day = r[1], r[2].strip(), int(r[5])
        # The export writes u-umlaut as Greek upsilon-with-dialytika in places.
        label = r[9].replace("ϋ", "ü").strip()
        stated = r[8].strip()
        lore = rejoin(r[10:])

        if label not in SCOPES:
            problems.append("unmapped region label %r on %r -- add it to SCOPES"
                            % (label, name))
            continue

        idx = (day - 1) % 7
        derived = "%s / %s" % (WEEKDAYS["jerbeen"][idx], WEEKDAYS["common"][idx])
        if derived != stated:
            problems.append("day %d %r: sheet says %r, the calendar says %r"
                            % (day, name, stated, derived))

        holidays[system].append({
            "name": name, "day": day, "regionLabel": label,
            "scopes": SCOPES[label], "lore": lore,
        })

    for k in holidays:
        holidays[k].sort(key=lambda h: h["day"])

    if problems:
        print("Refusing to write -- the sheet and the calendar disagree:")
        for p in problems:
            print("  " + p)
        return 1

    src = open(TARGET, encoding="utf-8").read()
    src = re.sub(r"(?:/\* Holidays carry.*?\*/\n)?const JERBEEN_HOLIDAYS = \[.*?\n\];",
                 HEADER + emit("JERBEEN_HOLIDAYS", holidays["jerbeen"]), src, flags=re.S)
    src = re.sub(r"const COMMON_HOLIDAYS = \[.*?\n\];",
                 emit("COMMON_HOLIDAYS", holidays["common"]), src, flags=re.S)
    open(TARGET, "w", encoding="utf-8", newline="\n").write(src)

    print("Wrote %d Jerbeen + %d Common holidays to calendar-data.js"
          % (len(holidays["jerbeen"]), len(holidays["common"])))
    print("Every stated weekday agrees with the seven-day cycle.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
