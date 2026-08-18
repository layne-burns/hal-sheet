# hal-sheet — working notes

A D&D 2024 character sheet for Hal Briarshade, played on an **iPad gen 9**.
Vanilla JS, no build step, no runtime dependencies. Open `index.html` and it
works; GitHub Pages plus a service worker make it an offline PWA.

Read this before changing anything. Most of what follows is a decision that
was made for a reason, and the reason is usually "this is read at a table, at
arm's length, mid-turn".

---

## Run it, test it

```bash
npm test
```

```bash
python tools/build-tokens.py
```

`npm test` runs five suites, about 1335 assertions. They run standalone too
(`node test-app.js`). The tests drive the **real UI** in jsdom by dispatching
clicks at `data-act` attributes — integration tests, not unit tests.
`test-combat.js` does not inline `cyrnn-data.js`, so anything touching the Map
tab has to use a different tab in that file.

To see it in a browser, use the preview tools with `.claude/launch.json`
(a no-store dev server). The service worker will happily serve stale code —
unregister it and add a cache-busting query when verifying a change.

---

## Layout of the code

| File | What it owns |
|---|---|
| `rules.js` | 2024 ruleset as data, `CALC` (pure math), `SEED` (Hal, imported from Hal.pdf), `PARTY_DOSSIERS`, `TOOLS_2024`, `COMPANION_ROLES` |
| `combat-rules.js` | Action economy, `SPELL_META`, `ACTION_CATALOG`, `CALC.castables`, turn-order math |
| `app.js` | State, persistence, `render()`, most tabs, the `ACT` action table |
| `combat.js` | Loaded **after** app.js. Wraps `mutate` and `render`, merges into `ACT`, exposes `EXT` |
| `backup.js` | Local redundancy plus optional gist cloud backup |
| `index.html` | All the CSS, inline. Cyberpunk HUD, system fonts only |
| `tools/build-tokens.py` | Slices `portraits/*` into the two sprite sheets |

`beasts-data.js`, `calendar-data.js` and `cyrnn-data.js` are campaign data.

### The two things to understand first

**Everything funnels through `mutate(fn, label)`.** It applies the change,
clamps, saves to localStorage and re-renders. combat.js wraps it so a
*labelled* mutate also pushes undo history and, while a session is running,
writes a line to the session log. An **unlabelled** mutate is bookkeeping and
stays out of both. Passing note text as a label double-logs it — that was a
real bug.

**`render()` rebuilds `#app` and `#modal-root` from scratch every time.**
There is no diffing. Anything transient — scroll position, an in-flight drag —
has to be carried explicitly. `UI` holds ephemeral state and is not persisted;
`S` is the character and is.

Modals get painted **twice** per render: app.js writes an empty shell first
(because `modalHTML()` does not know combat.js's modal types), then combat.js
writes the real one. `paintModal()` exists to carry scroll across that gap.

---

## Invariants that bite

- **The zoom lives on `#app`, never on `<body>`.** A `position: fixed` overlay
  inside a zoomed subtree is laid out in the zoomed coordinate space and
  hit-tested against the unzoomed one — that was the iPad modal snap-back. The
  modal takes the same zoom through `--mzoom`, and the layout measurement that
  picks the column count reads `#app.clientWidth`.
- **Layout breakpoints are measured in JS, not media queries.** At 80% zoom a
  1080px iPad lays out at 1350px, and a media query can only see the 1080.
  `render()` sets `body.compact` / `.twocol` / `.onecol`.
- **Fit passes are measured, and their steps are cumulative.**
  `fitCombatBar()` and `fitOrderStrip()` step down until a row holds one line,
  applying `bfit-1 bfit-2 …` together. Non-cumulative classes made the row get
  *wider* as it tried to shrink.
- **`clampState` runs on every mutate.** It prunes favourites pointing at
  nothing, followers with no block, dangling clan memberships, riders who left
  the party. A follower with `maxHP == null` (a mule) must not be deleted for
  having no HP.
- **`load()` always runs `migrate()`**, even on a fresh sheet, so seed fill-ins
  apply to new and played sheets alike.
- **Seed data is inserted once, by id, and never touched again.**
  `PARTY_DOSSIERS` is the only data that arrives from code rather than from the
  player, which makes it the only data an update could destroy.
  `S.peopleDropped` remembers deletions so an update cannot resurrect them.
  Never merge into an existing seeded record.
- **Item ids must be stable** — favourites point at them. `migrate` backfills
  them and boot calls `save()` once so they persist to the next launch.
- **Two sprite sheets, not one.** WebKit subsamples past about 5 MP.
  `TOKEN_SPLIT`, `TOKEN_COLS` and `TOKEN_ROWS_1/2` in app.js must match what
  `tools/build-tokens.py` prints, and no band may straddle the split.
- **Bump `CACHE_VERSION` in `sw.js`** whenever shipping, or Safari serves the
  old files.

## Environment gotchas

- The working tree is **CRLF**. Multi-line Python patch scripts have to
  convert `\n` to `\r\n` before searching, or nothing matches.
- Bash heredocs here eat one level of backslash. An escape inside a quoted
  heredoc can arrive as a real newline and silently corrupt a source line. Use
  the Edit or Write tool for anything containing escapes.
- Do not do line-number surgery on the test files; offsets shift and it
  mangles them. Anchor on text.

---

## House style

Comments explain **why**, in prose, and are worth real space — the existing
ones are the best guide. They name the problem that was actually hit ("a media
query can only see the first number", "an order with the baggage in it is an
order you stop reading"). Match that density and that voice; do not restate
what the code already says.

Commit messages are prose, present tense, explaining the decision and what
went wrong before it. Multi-paragraph is normal here. End with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Tests get sentence-shaped names that state the guarantee ("a lone finger on
the map moves nothing"), not the mechanism.

Push to `main` directly — GitHub Pages deploys from it, and that is how the
sheet reaches the iPad.

---

## State of play

Deployed at `https://layne-burns.github.io/hal-sheet/`. Hal is **level 5 or
higher** on the live sheet even though `SEED.level` is 4 — the seed is the
original import and is not the current character.

Recently landed, in order: the People tab; favourites with a use-window;
grouped tabs (Combat / Character / World, ten tabs, digits `1`–`9` then `0`);
an Active Effects tab that also tracks what *other* people have running;
initiative rolled on entering combat with lumped enemies; 545 portraits in
eleven bands across two sheets; tool proficiencies as rollable 2024 rows;
companions, mounts, and mount/dismount; the party's dossiers; and the iPad
scrolling fix.

### Outstanding

1. **Channel Divinity category and filter.** Add a `"Channel Divinity"` tag to
   the action and feature registries, tag Nature's Wrath, Divine Sense, Turn
   the Faithless and the rest, and add a filter chip across the action lists,
   the Features tab and the resource views.
2. **Extra Attack / Nick at level 5.** `CALC.attackAction` already folds Nick
   into the Attack action and never spends the Bonus Action, and `extraAttack`
   unlocks at Paladin 5 — so one attack at level 4 is correct behaviour. This
   needs checking against an actual level-5 sheet, then fixing whatever is
   genuinely wrong there rather than "fixing" the RAW.
3. **Damage routing for mount versus rider.** They already have separate
   modals (the top-bar Damage for Hal, `followerDamageModal` for a follower
   with HP), so nothing conflates them — but there is no dedicated targeting
   flow from the hit logger. Decide whether one is wanted.
4. **Minor:** a stray `qee.webp` sits untracked in the repo root, byte-identical
   to `portraits/qee.webp` and unused. Safe to delete.

### Decisions already taken — do not relitigate

- Order-strip chips are **display-only**. A mis-tap that silently moved whose
  turn it was would be worse than the problem it solved; correcting the order
  is what the Turn order button is for.
- Mundane mounts have **no HP**, the same way allies have a status rather than
  a number. Only summons get a bar.
- The company strip shows on **every** tab out of combat, but must never say
  "Out of combat" — just the portraits.
- Toolbar labels are **short by default**, with the long form in tooltips.
