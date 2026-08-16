# Putting Hal's sheet on your iPad

No command line anywhere in this guide. Everything happens in a web browser.

You will do three things:

1. Put the files on GitHub (about 10 minutes, once)
2. Turn on GitHub Pages so they become a real website (about 3 minutes, once)
3. Save that website to your iPad Home Screen as an app (about 1 minute, once)

After that, opening Hal is one tap and works with no internet.

---

## Before you start

You need these 18 files. They are all in the `hal-sheet` folder:

| File | What it is |
|---|---|
| `index.html` | The sheet itself |
| `rules.js` | The 2024 ruleset and all the math |
| `calendar-data.js` | The Jerbeen and Common calendars — months, holidays, lore |
| `combat-rules.js` | Action economy, spell effects, and the smite/cast data |
| `app.js` | The buttons, saving, and level-up engine |
| `combat.js` | Combat mode, casting, active effects, undo, settings |
| `backup.js` | Local redundancy and optional automatic cloud backup |
| `sw.js` | Makes it work offline |
| `manifest.json` | Makes it installable as an app |
| `icon-180.png` | Home Screen icon |
| `icon-192.png` | Home Screen icon |
| `icon-512.png` | Home Screen icon |
| `portrait-100.png` | Hal at full HP |
| `portrait-75.png` | Hal, hurt |
| `portrait-50.png` | Hal, wounded |
| `portrait-25.png` | Hal, bloodied |
| `portrait-down.png` | Hal at 0 HP |
| `portrait-gone.png` | Hal, dead (3 failed death saves) |

The five `test-*.js` files are mine, for checking the math and the app's behavior. **Do not upload them** — they aren't needed and would just sit there. (Uploading them wouldn't break anything, they'd just be clutter.)

> **Try it first.** Before doing any of this, double-click `index.html` on your computer. The sheet will open in your browser and fully work. Only the offline-install part needs GitHub. If something looks wrong, tell me now rather than after deploying.

---

## Part 1 — Put the files on GitHub

### Step 1.1 — Sign in

Go to **https://github.com** and sign in. If you don't have an account, click **Sign up** and follow the prompts. A free account is all you need.

### Step 1.2 — Create a new repository

A "repository" (or "repo") is just a folder that lives on GitHub.

1. In the top-right corner, click the **`+`** icon.
2. Choose **New repository**.

### Step 1.3 — Fill in the repository form

Set it up exactly like this:

- **Repository name:** type `hal-sheet`
  (all lowercase, with the hyphen, no spaces)
- **Description:** leave blank, or type anything you like
- **Public / Private:** you **must** choose **Public**
  > GitHub Pages doesn't work on private repositories with a free account. "Public" means someone could read the code if they found the address — it does not mean it's listed anywhere or that anyone will ever see it. Your character data is stored only on your iPad, never on GitHub.
- **Add a README file:** leave this **unchecked**
- **Add .gitignore:** leave as **None**
- **Choose a license:** leave as **None**

Click the green **Create repository** button.

### Step 1.4 — Upload the files

You'll now be on a mostly empty page with setup instructions. Ignore all of it.

1. Find the link that says **uploading an existing file**. It's in the line "…or push an existing repository from the command line" area, near the top. Click it.
   - *If you can't find that link:* go to `https://github.com/YOUR-USERNAME/hal-sheet/upload/main` in your address bar, replacing `YOUR-USERNAME` with your GitHub username.
2. You'll see a large dashed box that says **Drag files here to add them to your repository**.
3. Open the `hal-sheet` folder on your computer.
4. Select the 18 files listed in the table above. (Click the first, then hold **Ctrl** and click each of the others. On a Mac, hold **Cmd**.)
5. Drag all 17 into the dashed box on the GitHub page.
6. Wait for all 17 filenames to appear in a list. **Check the count is 17** before continuing.

### Step 1.5 — Commit the upload

Scroll down to the box titled **Commit changes**.

1. In the first text field, type: `Add Hal character sheet`
2. Leave **Commit directly to the `main` branch** selected.
3. Click the green **Commit changes** button.

You should now see all 18 files listed. **Part 1 is done.**

---

## Part 2 — Turn on GitHub Pages

### Step 2.1 — Open the settings

1. Near the top of your repository page, click the **Settings** tab. (It's on the right-hand end of the row that starts with "Code", "Issues", "Pull requests"… If you don't see it, make sure you're on your own repository.)
2. In the left-hand sidebar, scroll down and click **Pages**.

### Step 2.2 — Set the source

Under the heading **Build and deployment**:

1. Under **Source**, make sure the dropdown says **Deploy from a branch**.
2. Under **Branch**, you'll see a dropdown that probably says **None**. Click it and choose **main**.
3. A second dropdown appears next to it. Leave it on **/ (root)**.
4. Click **Save**.

### Step 2.3 — Wait, then get your address

GitHub now builds your site. **This takes 1 to 3 minutes.**

1. Wait about a minute, then **refresh the page** (F5, or the reload button).
2. At the top you'll see a green box: **Your site is live at https://YOUR-USERNAME.github.io/hal-sheet/**
3. If instead it says "Your site is ready to be published", wait another minute and refresh again.

**Write that address down.** That's Hal's sheet, forever.

### Step 2.4 — Check it works

Click the **Visit site** button, or paste the address into a new tab. You should see Hal's sheet in the cyberpunk HUD.

> **If you get a 404 "File not found" page:** wait two more minutes and refresh — it's usually just slow the first time. If it persists, the most likely cause is that `index.html` didn't upload, or uploaded inside a subfolder. Go back to the **Code** tab and confirm you see `index.html` listed directly, not inside a folder named `hal-sheet`.

---

## Part 3 — Install it on your iPad

**This part must be done in Safari.** Chrome and Firefox on iPad cannot install web apps. This is an Apple restriction, not something I can code around.

### Step 3.1 — Open the site in Safari

1. On your iPad, open **Safari**.
2. Type your address from Step 2.3 into the address bar: `https://YOUR-USERNAME.github.io/hal-sheet/`
3. Wait for the sheet to fully load. Give it a few seconds the first time — it's caching itself for offline use.

### Step 3.2 — Add to Home Screen

1. Tap the **Share** button — the square with an arrow pointing up, in the toolbar.
2. Scroll down the list of options.
3. Tap **Add to Home Screen**.
   - *If you don't see it:* scroll further down, or tap **Edit Actions** at the bottom and enable it.
4. The name field will say **Hal**. Leave it, or change it.
5. Tap **Add** in the top-right.

### Step 3.3 — Use it from the Home Screen

Find the new **Hal** icon on your Home Screen and tap it.

**Important:** from now on, always open Hal using this Home Screen icon, not by typing the address in Safari.

Here's why this matters. Safari has a privacy feature called Intelligent Tracking Prevention that deletes stored website data after 7 days of not visiting. If you used Hal only as a normal Safari tab, **your character data could vanish after a week away from the table.** Installing it to the Home Screen exempts it from that rule. Tapping the icon is what protects your data.

### Step 3.4 — Confirm it works offline

Worth doing once so you trust it:

1. Turn on **Airplane Mode** on your iPad.
2. Tap the **Hal** icon.
3. The sheet should open completely normally.
4. Turn Airplane Mode back off.

The only thing that won't work offline is tapping a spell or feature name to open the wiki — those need internet by definition.

---

## Backing up your character

**One thing to understand first: GitHub is not a backup of your character.** It only hosts the app's code — the empty sheet template. Your actual character (HP, spells, level, party, everything) lives only in your iPad's local storage, under the Hal Home Screen app. Re-uploading files to GitHub, the way you do when I send you an update, never touches your character data at all.

That means your character has exactly one real point of failure — the iPad itself — unless you set up one of the backups below. There are three layers now, from "always on, does nothing extra for you to do" up to "genuinely off-device":

**1. Local redundancy (automatic, no setup).** Every save is mirrored to a second storage system on the iPad, and once a day the app quietly keeps a snapshot of that day's state (the last 14 days, rolling). This protects against a bug or a bad state silently overwriting days of history before you notice — it does **not** protect against losing the iPad itself.

**2. Manual export (always available).** Notes tab → **Export JSON** writes a file, or **Share…** next to it opens iOS's share sheet so you can send it straight to Files, iCloud Drive, Mail, or AirDrop in one tap. Do this after any big session if you haven't set up automatic cloud backup below. **To restore:** Notes tab → **Import JSON**, pick the file — it replaces the current sheet entirely. The export is plain text you can read; if Hal ever gets into a weird state, that file is the source of truth.

**3. Automatic cloud backup (optional, ~2 minutes to set up).** The app can back itself up to a private GitHub Gist automatically after every Long Rest, Level Up, and End Session — a real off-device copy that doesn't rely on you remembering anything. Here's how:

### Setting up automatic cloud backup

1. On any device, go to **github.com/settings/tokens** (or: your GitHub avatar → **Settings** → scroll down to **Developer settings** → **Personal access tokens** → **Tokens (classic)**).
2. Click **Generate new token** → **Generate new token (classic)**.
3. **Note:** type something like `Hal sheet backup`.
4. **Expiration:** your choice. A long expiration (or "No expiration") means less re-setup, but means the token is valid longer if it ever leaked. 1 year is a reasonable middle ground.
5. **Scopes:** check **only** the box labeled `gist`. Leave every other box unchecked — the app never needs anything beyond creating/updating one gist.
6. Scroll down and click **Generate token**.
7. GitHub shows you the token **once**. Copy it now (the `Copy` icon next to it).
8. On your iPad, open Hal → tap **Settings** (top bar) → tap **Cloud backup — not connected**.
9. Paste the token into the field and tap **Connect**. It'll sync immediately — you should see "Last synced: just now" within a few seconds.

That's it. From now on, Long Rest, Level Up, and End Session each quietly push an update in the background — if you're offline at the table, it just queues and retries the next time you're back on wifi. You can also tap **Back up now** in that same screen any time, or **Disconnect** if you want to stop.

**Using the same character on more than one device.** Paste the *same* token into the other browser and tap Connect — it finds the backup that token already owns and joins it, rather than starting a second, separate one. Then tap **Load from cloud** on that device to pull the sheet down.

The two devices don't sync live, so treat it as "hand the sheet over" rather than "edit in both at once": back up on the device you were playing on, then load on the one you're moving to. The preview shows you what the cloud copy holds — character, level, HP, in-world date, and when it was saved — before anything is replaced, and **Undo** restores the device's previous sheet if you load the wrong one.

**A couple of things worth knowing:**
- The token is stored only on your iPad, in a separate place from your character data — it's never included in Export JSON, so sharing that file (with me, or anyone) can't leak it.
- It's stored as plain text in the browser's local storage, not encrypted — normal for a scoped, personal-use token like this, but worth knowing. The `gist` scope can only read/write your gists, nothing else on your account.
- If you ever want to fully revoke it, hit **Disconnect** in the app *and* delete the token at github.com/settings/tokens.
- GitHub keeps its own revision history on gists, so even beyond what the app does, you can see every past version of the backup at the gist's URL (shown in the Backup screen once connected).

---

## Updating the app later

If I send you changed files, or you edit something yourself:

1. Go to your repository on GitHub: `https://github.com/YOUR-USERNAME/hal-sheet`
2. Click **Add file** → **Upload files**.
3. Drag in the new versions of the changed files.
4. Scroll down and click **Commit changes**. Uploading a file with the same name replaces the old one.

### How updates reach the iPad

The app asks the network for its code every time you open it with a signal, so **an update arrives the next time you open the app**. Close it fully (swipe up from the bottom and flick it away) and open it again.

If you have no signal, it opens instantly from the copy it already has, and picks the update up the next time you're online. A bad connection costs about two and a half seconds before it gives up and uses the stored copy.

**Checking which version you're running:** Settings shows it — `Running hal-v22`. That's the same number in `sw.js`, so you can compare against the repository.

**If it's ever stubborn:** Settings → **Force an update now** throws away the stored copy and re-downloads everything. Your character is stored separately and is not touched.

Bump `CACHE_VERSION` in `sw.js` whenever you upload changed files anyway — it's what clears out the old stored copies, and it's how the version readout tells you anything useful:

1. In your repository, click on **`sw.js`**.
2. Click the **pencil icon** (Edit this file) in the top-right of the file view.
3. Find line 6 or so:
   ```
   const CACHE_VERSION = "hal-v22";
   ```
4. Change the number: `"hal-v23"`, then `"hal-v24"` next time, and so on.
5. Scroll down, click **Commit changes**.

> **Your character data survives updates.** It's stored separately from the app files. Updating the code never touches your HP, spells, or level.

---

## Quick reference

**Keyboard shortcuts** (your keyboard case earns its keep):

| Key | Does |
|---|---|
| `1` – `9`, `0` | Switch tabs, numbered left to right: Combat, Effects, Followers, Spells, Features, Inventory, Notes, Map, Calendar, People |
| `D` | Open Take Damage |
| `S` | Short rest |
| `L` | Long rest (asks how many days pass) |
| `E` | Toggle Edit mode |
| `C` | Toggle Concentrating |
| `Esc` | Close any dialog |

**The tabs are grouped.** Three groups sit on the left of the tab row — **Combat**, **Character**, **World** — and the tabs inside the open one follow to their right. Combat holds Combat, Effects and Followers; Character holds Spells, Features, Inventory and Notes; World holds Map, Calendar and People. A group button takes you back to whichever of its tabs you were last on, so leaving the map to check a spell and coming back returns you to the map.

Both side rails collapse by **tapping their header**, and reopen by tapping the "Stats" or "Resources" strip. Edit, Export, and Import live behind the **More** button in the top bar.

**Favourites** is the top panel of the right-hand column, and it's the only list in the app you write yourself. Tap the small **☆** on any spell, action, feature, feat or carried item and it pins there — on every tab, one tap from anything. Tap **Edit** in the panel header to reorder with the arrows or unpin with ×. Pins are pointers, not copies: unprepare a pinned spell and it stays in the list saying "not prepared" rather than quietly disappearing, and it works again the moment you prepare it.

**Tapping a favourite opens a window rather than firing it.** The window carries the full rules text — the reason to look at a pinned spell without casting it — and asks the question the single button in the rail couldn't. Where a free cast exists, **both prices are offered and neither is assumed**: Divine Smite shows "Cast free — no slot" beside "Cast with a level 1 slot", so you can deliberately spend the slot and keep the free one for later. Find Steed and Find Familiar hand off to their own picker instead, which already knows how to charge for what you chose. Everything the window casts goes through the same code the Combat tab does, so the cost and the roll prompt are identical.

A **carried item's** window shows how many you have and does both directions: type a number and press **Use** to spend that many, or **Gain** to add the four healing potions you just bought. For an item to be spendable, mark it **Consumable** on the Inventory tab in Edit mode — potions and scrolls yes, your scimitar no.

**People** (World → People) is where everyone the campaign has introduced goes, alongside the clans, guilds and orders behind them. Nothing is required but a name — and the name can be "the one-eyed innkeeper". Everything else is added a detail at a time: tap **Race**, **Role**, **Where** or any of the other suggestions to add that label, or **Something else** to write your own, and a detail you never add simply doesn't exist on the record. Tap the standing chip to cycle how they regard you (Ally → Friendly → Neutral → Wary → Hostile), which colours the edge of their card, and the fate chip for Alive / Dead / Missing. Add a clan or guild the same way, then open a person and tap the clan to put them in it — the clan's card then counts its members. The search box looks through names, details, notes and clan names at once, so "Gloomwood" or "owes me" finds the right person when the name has gone.

**Tap any number** — a save, AC, the Lay on Hands pool — to see exactly where it comes from. Yellow entries scale automatically with your level; violet entries come from a feat and stay put.

**Tap Hal's portrait** in the top-left of the header for a full-size view. It automatically swaps between six states as HP changes: pristine, hurt, wounded, bloodied, downed, and gone.

**Tapping a name now does the useful thing, not the wiki.** Tap a spell to cast it, a weapon to open its attack roll, an active condition to remove it. The wiki is still one tap away — look for the small `wiki ↗` control next to the name.

**Entering combat rolls initiative.** Pressing **Enter combat** opens a sheet with you and everyone marked Present already on it, plus the enemies you named in the last fight (names only — everyone rolls again). Type what each of them got, add enemy lines with **+ Enemy**, and press **Start the fight**: it sorts highest-first, opens on whoever won, and sets the round to 1. Nothing is written until you press that button, so opening it and thinking better of it leaves no trace. Enemies are **one line each, not one per body** — the table rolls once for the goblins, so the sheet holds one entry for the goblins. Mid-fight, **Turn order** opens the same sheet seeded with the numbers already rolled, so you correct rather than retype.

**Next Turn** then cycles through the order — the round only advances, and your action economy only resets, when it comes back around to Hal. **To my turn** skips the turns nobody pressed through, and costs exactly what walking them one at a time would.

**Party** lives at the bottom of the Combat tab. Add whoever's at the table today (mark them Present/Away — Away drops them from the initiative sheet). Tap a party member's status button to cycle Healthy → Bloodied → Down — we deliberately don't track allies' exact HP, just where they stand.

**The attack roll popup totals, it doesn't judge.** There is no AC field and nobody to point it at: a monster's armour class is a number your character has no way of knowing, and typing it in was doing the DM's arithmetic for them. Enter your d20, it adds your bonus and shows the total; the DM says whether it lands, and you tap **Hit** or **Miss**. Tapping Hit is what arms your smites and surfaces the Vex reminder. A natural 1 or 20 still answers itself.

**Active effects** (Combat → Effects) holds two lists. **On you** is what you have running, counted down for you. **Everyone else** is the one you write: *who*, *concentrating on / affected by / counting down to*, *what*, and what it means underneath — "Enemy mage · concentrating on · Hold Person" with "Qee is Held" beneath it. Break their concentration and you know exactly what it undoes. Add an optional clock in **rounds** or **turns** and it ticks down as the fight advances — rounds on each lap of the order, turns on every single turn. It's not only for spells: "The lair · counting down to · erupts, 10 rounds" is the same shape. A clock that reaches zero **stops there and shouts** rather than deleting itself, because a thing that is due now is the last thing that should vanish. There is no screen glow for any of it — someone else's concentration is a thing to consult, not an alarm.

**Session log** — the **Session** button in the top bar (next to Undo). Tap **Start session** at the table and the app quietly logs what happens: casts, attacks, rests, party changes, and what you noted about the fight, all with a timestamp — it's built from the same short labels the Undo history already uses, so there's nothing extra to maintain. It also tracks the highest save DC you set for someone else. Tap **End session** when you wrap, and it archives into a short history you can revisit later or **Export as Markdown** to save alongside your notes. It's a memory aid, not a transcript — nothing about it changes any of your numbers.

**Backup and cloud sync** live under **Settings** → **Cloud backup**. That's also where you'll see at a glance whether it's connected and synced, or whether the last attempt failed (worth a glance if you haven't opened Hal in a while). See "Backing up your character" above for the full setup walkthrough. The **Share…** button next to Export JSON on the Notes tab is the fastest one-tap way to send a manual copy to Files, iCloud Drive, Mail, or AirDrop.

---

## If something goes wrong

**The sheet is blank or half-broken.**
One of the `.js` files probably didn't upload. Go to the **Code** tab and confirm all 18 files are listed with sensible sizes (`rules.js` and `app.js` should each be tens of KB, not 0; each portrait should be a few hundred KB, not 0).

**Changes aren't saving.**
Check you're not in Safari Private Browsing — it blocks local storage. Open Hal from the Home Screen icon instead.

**"Add to Home Screen" is missing.**
You're not in Safari. Chrome and Firefox on iPad can't do this.

**Everything looks wrong after an update.**
Settings → **Force an update now**. That clears the stored copy and re-downloads everything from GitHub. Your character survives it.

**You want to start over from the original PDF values.**
Notes tab → **Reset to Hal.pdf**. Export first if you might want your current state back.

**Cloud backup says "sync failed" or "Token rejected."**
The token was likely revoked, retyped wrong, or expired. Settings → **Cloud backup** → **Disconnect**, then generate a fresh one following the setup steps above and reconnect. Your character data is never at risk from this — a failed sync just means the off-device copy is stale until you reconnect; nothing local is touched.

**Cloud backup says "Offline."**
Normal at a table with no signal — it queues and retries automatically the next time the iPad has a connection. Nothing to do.
