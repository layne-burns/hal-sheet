#!/usr/bin/env python3
"""Build tokens.jpg — the one image every combatant portrait comes from.

Five source grids go in and one sheet comes out. The sheet is twelve tiles
wide and every source grid is thirty-six tiles, which is exactly three
rows of it — so a category always starts on a row boundary and its index
range is arithmetic rather than a table anyone has to maintain:

    row  0      the party, in PARTY order          index   0 -  4
    rows 1-3    Faces        (portrait grid.png)   index  12 - 47
    rows 4-6    Adventurers  (grid2.jpg)           index  48 - 83
    rows 7-9    Kin          (grid3.jpg)           index  84 -119
    rows 10-12  Monsters     (grid4.jpg)           index 120 -155

Seven slots at the end of row 0 are spare. They cost about 9 KB and buy
index arithmetic that needs no lookup table, which is the better trade.
app.js holds the matching TOKEN_COLS / TOKEN_BANDS and must be changed
with this file, never separately.

One file rather than a hundred and fifty is the whole point: it is one
entry in the service worker's cache and one request on a cold open, and
the CSS addresses a tile with a background-position rather than a URL.

Sources live in portraits/ and are not what the app loads — they are the
originals, kept so this can be re-run when a portrait changes.

Run:  python tools/build-tokens.py
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "portraits")
OUT = os.path.join(HERE, "tokens.jpg")
OUT2 = os.path.join(HERE, "tokens2.jpg")

# 545 tiles will not fit in one image an iPad is willing to decode at full
# resolution — WebKit subsamples anything much past 5 megapixels, which
# turns every face to mush. So the sheet is split in two, at a category
# boundary, and each half stays comfortably under that.
TILE = 112          # px per tile; the largest we ever draw one is 55 CSS px
COLS = 12           # tiles per row; every source grid is 3 rows of these
SPLIT_AFTER = 9     # grids in sheet one (plus the party row); rest go to two
BG = (22, 29, 37)   # --panel2, so a portrait with alpha sits on the app's own dark

# The party, in sheet order. `box` is the square crop taken from the
# original — chosen by eye to land the face in the middle of a token that
# is going to be rendered at ~30px in a combat strip, where anything but a
# head is mush.
#
# Pulled back to head-and-shoulders rather than tight on the face: the
# four generic grids are all framed that way, and a party portrait
# cropped closer than the token beside it reads as a different kind of
# object. Matching them is what makes one strip of faces look like one
# set. A box may run off the edge of its source; square() letterboxes
# whatever is missing onto BG.
PARTY = [
    ("qee",    "qee.webp",    (300, -10,  810,  500)),
    ("gill",   "Gil.png",     ( 62,   0,  330,  268)),
    ("dinos",  "Dinos.png",   (170,  40,  880,  750)),
    ("karlie", "Karlie.png",  (405,  95,  745,  435)),
    ("sol",    "sol.png",     (250,  20,  900,  670)),
]

# Each grid is 6x6. `inset` trims the drawn frame and the gutter between
# tiles, as a fraction of the cell — the first grid is seamless and needs
# none, the icon sheets are framed and do.
GRIDS = [
    ("portrait grid.png", 0.000),   # Faces        painted NPC portraits
    ("grid5.jpg",         0.035),   # Soldiers     guards, men-at-arms
    ("grid2.jpg",         0.035),   # Adventurers  class archetypes
    ("grid6.jpg",         0.035),   # Adventurers
    ("grid7.jpg",         0.035),   # Casters      mages, cultists, clergy
    ("grid3.jpg",         0.035),   # Kin          goblinoids, elves, tieflings
    ("grid8.jpg",         0.035),   # Kin
    ("grid9.jpg",         0.035),   # Kin          orcs, gnolls, minotaurs
    ("grid10.jpg",        0.035),   # Kin          drow, dwarves, yuan-ti
    ("grid15.jpg",        0.035),   # Beasts       wolves, horses, big cats
    ("grid14.jpg",        0.035),   # Familiars    the Find Familiar list
    ("grid4.jpg",         0.080),   # Monsters
    ("grid13.jpg",        0.035),   # Monsters     aberrations, constructs
    ("grid11.jpg",        0.080),   # Dragons
    ("grid12.jpg",        0.035),   # Undead
]
GRID_COLS = GRID_ROWS = 6


def square(im, box):
    """Crop to box, then letterbox onto BG so a non-square source can't
    stretch. The boxes above are already square; this is the safety net."""
    cut = im.crop(box)
    w, h = cut.size
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), BG)
    if cut.mode in ("RGBA", "LA"):
        canvas.paste(cut, ((side - w) // 2, (side - h) // 2), cut)
    else:
        canvas.paste(cut.convert("RGB"), ((side - w) // 2, (side - h) // 2))
    return canvas.resize((TILE, TILE), Image.LANCZOS)


def slice_grid(path, inset):
    im = Image.open(path).convert("RGB")
    gw, gh = im.size
    cw, ch = gw / float(GRID_COLS), gh / float(GRID_ROWS)
    dx, dy = cw * inset, ch * inset
    out = []
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            box = (int(c * cw + dx), int(r * ch + dy),
                   int((c + 1) * cw - dx), int((r + 1) * ch - dy))
            out.append(im.crop(box).resize((TILE, TILE), Image.LANCZOS))
    return out


def write_sheet(tiles, path):
    rows = (len(tiles) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TILE, rows * TILE), BG)
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE))
    sheet.save(path, "JPEG", quality=78, optimize=True, progressive=True)
    mp = (sheet.width * sheet.height) / 1e6
    print("  %-14s %dx%d  %d tiles, %d rows, %.1f MP, %.0f KB"
          % (os.path.basename(path), sheet.width, sheet.height, len(tiles), rows,
             mp, os.path.getsize(path) / 1024.0))
    if mp > 5.0:
        print("  WARNING: over 5 MP — WebKit may subsample this on an iPad")
    return rows


def main():
    blank = Image.new("RGB", (TILE, TILE), BG)
    tiles = []

    for name, fn, box in PARTY:
        path = os.path.join(SRC, fn)
        if not os.path.exists(path):
            raise SystemExit("missing party portrait: " + path)
        tiles.append(square(Image.open(path), box))
    # Pad row 0 out so every grid below starts on a row boundary.
    while len(tiles) % COLS:
        tiles.append(blank)

    split_at = None
    for n, (fn, inset) in enumerate(GRIDS):
        path = os.path.join(SRC, fn)
        if not os.path.exists(path):
            raise SystemExit("missing grid: " + path)
        if n == SPLIT_AFTER:
            split_at = len(tiles)
        start = len(tiles)
        tiles.extend(slice_grid(path, inset))
        print("  %-20s index %4d - %4d%s" % (fn, start, len(tiles) - 1,
              "   (sheet 2 starts here)" if n == SPLIT_AFTER else ""))
    if split_at is None:
        split_at = len(tiles)

    print("")
    write_sheet(tiles[:split_at], OUT)
    write_sheet(tiles[split_at:], OUT2)
    print("")
    print("app.js must match:  TOKEN_COLS = %d   TOKEN_SPLIT = %d   total = %d"
          % (COLS, split_at, len(tiles)))


if __name__ == "__main__":
    main()
