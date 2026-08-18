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
companions, mounts, and mount/dismount; the party's dossiers; the iPad
scrolling fix; a grabbable scrollbar on every modal, since the scrolling
fix above wasn't the last word on that; the tag filter restored to the
Combat tab (it had never had one — the busiest list in the app was the
one you couldn't narrow mid-fight); a summoned steed can now actually be
mounted (`isMount` was never set on it, so no Mount control ever offered
it); and a Channel Divinity filter chip tying the resource to what spends
it.

A second, larger pass followed: the initiative sheet's Tab key now walks
only the numeric rolls, not the portraits and arrows between them; the
"it's been a while" nudge's cadence is a Settings preset instead of a
hardcoded 25 minutes, backed by a once-a-minute render so it actually
fires during genuine idle time rather than waiting for an incidental
interaction; who was present gets snapshotted onto the session the moment
it starts (`S.session.party`), not read live at export time; the note
composer can backdate or forward-date a note to any day/month/year/time
in the active calendar without moving the party's actual clock, and the
export sorts "What Happened" by that in-world clock rather than by typing
order; `CALC.characterSnapshot()` leads every session export, and the old
two-way story/technical split is now three (`## What Happened` /
`## Game Activity` / `## Technical Log`), classified by reading the label
every `mutate()` call already carries (`logKind()` in combat.js) rather
than touching the ~140 call sites; a generic item-modifier engine
(`CALC.itemMods`/`applyMods`, target/op/value/key) that also **built**
`CALC.activeMods` for the first time — it had been referenced in three
places and defined nowhere, so "Active effects change your AC and attack
numbers" in Settings had never actually done anything; and the Notes tab
grew a Session Explorer (every past session, not just "last") and Hal's
Diary, a second record for polished prose kept separate from the
immutable raw log, rendered through a small hand-rolled markdown-to-HTML
step (`mdToHtml()`) since this app has no runtime dependencies to reach
for instead.

### Outstanding

- **Ability-score item mods aren't wired through.** `CALC.itemMods()`
  supports an `abilityScore` target and the advanced builder offers it as
  a menu choice, but nothing reads it yet — `S.abilities.x` is read
  directly in dozens of places (`CALC.mod()` calls throughout), and
  retrofitting all of them is a wider, riskier pass than made sense to
  fold into the item-modifier work. Same story for a mod that targets one
  specific weapon rather than every equipped one.
- **The Session Explorer and Diary UI haven't had a design pass.** They
  work and are tested, but the layout was built to the same visual
  vocabulary as the rest of the app without a specific look-and-feel
  review — worth revisiting once there's more than a session or two of
  real data to look at.

### Decisions already taken — do not relitigate

- Order-strip chips are **display-only**. A mis-tap that silently moved whose
  turn it was would be worse than the problem it solved; correcting the order
  is what the Turn order button is for.
- Mundane mounts have **no HP**, the same way allies have a status rather than
  a number. Only summons get a bar.
- The company strip shows on **every** tab out of combat, but must never say
  "Out of combat" — just the portraits.
- Toolbar labels are **short by default**, with the long form in tooltips.
- **Extra Attack / Nick at level 5 was already correct.** Checked against an
  actual levelled-up sheet (not just a unit test clone): at level 5 the
  Attack action sequence is 2 main attacks plus Nick's folded-in third, and
  the Bonus Action stays open. One attack at level 4 was correct RAW all
  along — nothing needed fixing.
- **No dedicated targeting flow from the hit logger.** `logHit()` just arms
  smites; it has no concept of a target and never has. Hal's top-bar Damage
  and each mount/companion's own `Damage…` button already cover every case
  that matters. A picker that asked "who got hit" on every press would be
  overhead for a question the existing buttons already answer by which one
  you tap.
- **The delta log is label-based, not a generic state-diff observer.**
  `logKind()` classifies by reading the label every `mutate()` call already
  writes, sorted against a short, closed allowlist of what counts as
  Technical (session lifecycle, turn transitions, a portrait pick, an undo,
  who's present, the People tab's NPC-record toggles) — everything else
  non-narrative defaults to Game Activity. A real path-diffing engine that
  auto-describes changes without a hand-written label was considered and
  rejected: much bigger, and the existing label convention already covers
  the app thoroughly.
- **Hal's Diary is manual export → external tool → paste back, not an
  in-app LLM call.** The app has no backend and no API key storage; adding
  either for this would be a bigger architectural change than the feature
  is worth. Copy/Share already hand you the raw markdown; an LLM
  diary-writing skill is something you run yourself.
- **`CALC.characterSnapshot()` is computed fresh, not frozen per session.**
  A level-up or a gear swap mid-session already gets its own line in the
  delta log, so a snapshot showing where Hal ended up is consistent with
  that record. The tradeoff: exporting an *old* session shows current
  stats, not that session's — `sessionToMarkdown()` says so explicitly
  when the session being exported isn't the live one, rather than a
  silent, misleading number.
