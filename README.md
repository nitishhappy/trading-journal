# Trade Journal — README

A private, installable (PWA) daily trading journal. Built with vanilla HTML/CSS/JS + Firebase (Auth + Firestore). Designed for Android, installable as a home-screen icon via Chrome's "Add to Home Screen."

---

## How to use

### 1. Sign in
- Single-user email/password auth.
- First time: enter any email + password (6+ chars) and tap **Create account**.
- Next time: tap **Sign in**.

### 2. Dashboard
- Shows **all observations**, sorted by date (newest first), grouped under "Today / Yesterday / [date]" headers.
- Tap **+** (floating button, bottom-right) to add a new observation.

### 3. Adding/editing an observation
Each observation can have:
- **Text** (free-form notes)
- **Web link** (optional)
- **Image** (optional — stored as compressed base64, max ~900KB)
- **Tags** (comma-separated, searchable)
- **Folder** (Behaviour / Technical / To Do / any custom folder)
- **Priority** (Low / Medium / High — default Medium) — sets the colored stripe on the tile (green/amber/red)

If neither image nor link is provided, the **text fills the entire tile**.

Tap the **pencil (✎)** icon on any tile to edit it — all fields are editable, including image and folder/priority. Delete is available from the edit screen.

### 4. Folders
- Default folders: **Behaviour, Technical, To Do**.
- Tap **+** in the folder tab bar to create a custom folder.
- Tap a folder tab to filter the dashboard to that folder.

### 5. Copy to folder (with priority)
- Tap the **copy (⧉)** icon on a tile to add it to another folder.
- Choose the target folder and a priority **for that folder** (default Medium).
- This does **not duplicate** the observation — it's the same entry, now visible in multiple folders, each with its own priority/stripe color. Editing the text/image/etc. in one place updates it everywhere.
- In the "All" view, tiles show small pills indicating which folders they belong to.

### 6. Search
- The search bar filters by observation text or tags (across the currently selected folder).

### 7. Images
- Tap any image to view it full-screen (lightbox).

### 8. Installing as an app (Android)
1. Open the app URL in Chrome on Android.
2. Tap the **⋮** menu → **Add to Home screen** (or Chrome will show an install banner automatically).
3. The app opens full-screen with its own icon, no browser bar.

---

## Setup / Firebase configuration

Firebase project: `trade-journal-4271e`

Required Firebase services:
- **Authentication** → Email/Password provider enabled
- **Firestore Database** → in production mode, with rules from `firestore.rules` deployed

### Deploying Firestore rules
```
firebase deploy --only firestore:rules
```
(or paste contents of `firestore.rules` into Firebase Console → Firestore → Rules)

### Data structure
```
users/{uid}/observations/{obsId}
  - text: string
  - link: string
  - imageBase64: string | null
  - tags: string[]
  - folder: string          // primary folder
  - priority: "low" | "medium" | "high"   // priority in primary folder
  - folderPriorities: { [folderName]: "low"|"medium"|"high" }  // extra folders + their priority
  - createdAt: timestamp
  - updatedAt: timestamp

users/{uid}/folders/{folderId}
  - name: string
  - createdAt: timestamp
```

---

## Hosting

The app is static (HTML/CSS/JS) — no build step. Can be hosted on:
- Firebase Hosting (`firebase deploy --only hosting`)
- GitHub Pages
- Any static host

---

## Changelog

### v1.1 — Trade log, summary & smart categorization
- Added **Trade Log** tab: per-day trade entries (capital, no. of trades, gross/net P/L, duration, comments), CSV export, and analytics (total P/L, win-day rate)
- Added **Summary** tab: weekly/monthly overview with stats on observations, priority breakdown, folder breakdown, category breakdown, top tags, and trade performance
- Added **Settings** tab: configurable default grouping, account info, sign out
- Added rule-based **auto-categorization**: observations are scanned for keywords (e.g. "breakout", "fomo", "bug") and a category suggestion banner appears, which can be accepted (tags + optionally moves to matching folder) or dismissed
- Tiles are now **expandable/collapsible** (tap to expand for full image, link, folder/priority details, and logged timestamp)

### v1.2 — Multi-entry, grouping, archive & layout improvements
1. **Tag autosuggest**: tag input now shows a dropdown of all tags you've used before (HTML datalist), so you can reuse existing tags consistently.
2. **Multiple observations per popup**: the "New Observation" modal now supports adding multiple separate observations in one go via "+ Add another" — each with its own text, link, image, tags, folder, and priority. Edit mode remains single-observation.
3. **Technical as default folder**: new observations default to the "Technical" folder (or the currently active folder tab if one is selected) instead of always defaulting to the first folder.
4. **Responsive grid layout**: on wide screens (≥820px), observations arrange in a multi-column grid instead of a single vertical column. High-priority tiles span 2 columns (larger), making them stand out. On screens ≥1400px, the grid uses larger columns.
5. **Three grouping modes** on the dashboard (replacing the old date/priority sort dropdown):
   - **Date** (default): grouped by day, with observations inside each day sorted by priority (high → low), then newest first.
   - **Priority**: grouped into High / Medium / Low sections.
   - **Tags**: grouped by each tag (an observation with multiple tags appears under each), plus an "Untagged" group.
   The default grouping can be set in Settings.
6. **Archive observations**: the edit modal now has an "Archive"/"Unarchive" button. Archived observations are hidden from the dashboard by default. A "🗄 Archived" toggle in the filter row shows only archived observations.
7. **Image-pending flag**: a new checkbox "Add image later (mark as pending)" in the observation form marks an observation as awaiting an image. These show a "Image pending" badge on their tile. A "📷 Pending" toggle in the filter row filters the dashboard to only these observations.
8. **Tag-click filtering**: tapping any tag chip on a tile filters the dashboard to only observations with that tag. An active filter chip appears in the filter row; tap it to clear the filter.
9. **Revision/swipe mode**: see v1.3 below — now fully built.
10. **Fullscreen toggle**: a new ⛶ button in the top bar toggles the browser's fullscreen mode for an immersive view. The app remains installable as a home-screen icon on Android via Chrome's "Add to Home Screen" (PWA manifest unchanged).
11. **Lightbox centering fix**: tapping an image now opens it centered on screen (previously appeared anchored to the bottom).

#### Updated data model
```
users/{uid}/observations/{obsId}
  ...(existing fields)...
  - archived: boolean        // hidden from dashboard unless "Archived" filter is on
  - imagePending: boolean     // true if image is intended to be added later
```

### v1.3 — Revision (swipe review) mode
A new **Revision** tab provides a Tinder-style swipeable card stack for reviewing your observations:
- **Queue order**: cards are ordered by date (most recent day first), then by priority within that day (High → Medium → Low), then newest-first. Only non-archived observations are included.
- **Swipe right** (or tap "Reviewed"): marks the observation as reviewed for today — it won't reappear in the queue again today.
- **Swipe left** (or tap "Needs attention"): marks the observation as reviewed *and* flags it as needing attention (flag is stored, available for future use e.g. filtering/highlighting).
- **Progress bar**: shows "reviewed / total" for the day at the top of the screen.
- **Reset**: a "↺ Reset" button clears today's reviewed/flagged list, bringing all observations back into the queue. Per your preference, this is **manual only** — there's no automatic midnight reset, so your progress persists across app reloads until you reset it yourself.
- Each card shows the observation's text, image (tap to view full-screen), link, tags, folder(s), and date/time — same content as a dashboard tile, in a focused single-card view.
- When the queue is empty, an "All caught up for today" message is shown (or "No observations to review yet" if you have none at all).

#### New data model
```
users/{uid}/revisionState/{YYYY-MM-DD}
  - reviewed: string[]   // observation ids reviewed today (swiped right or left)
  - flagged: string[]    // observation ids swiped left ("needs attention") today
  - updatedAt: timestamp
```

### v1.4 — AI Coach tab (Gemini-powered psychology summaries)

A new **AI Coach** tab powered by Google Gemini 1.5 Flash, acting as a professional trading psychologist and performance coach.

#### What it does
- **Weekly summary**: every Sunday at 23:59 UTC, a Cloud Function reads all your observations from the past 7 days and sends them to Gemini for deep analysis.
- **Monthly summary**: runs at 23:59 UTC on the 1st of every month for the past 30 days.
- **Manual "Generate now" button**: tap it anytime in the AI Coach tab to generate a summary on demand (useful for testing or mid-week reviews).
- The AI reviews observations in context (date, folder, priority, tags) and produces a structured markdown report covering:
  - **Knowledge Issues** — repeated gaps in market understanding
  - **Execution Issues** — entry/exit problems, hesitation, impulsiveness
  - **New Learnings** — genuine insights and positive adjustments
  - **Discipline** — FOMO, emotional control, rule-following patterns
  - **Stage-wise Patterns** — Pre-market, Analysis, Execution, Trade management

Summaries are stored in Firestore (`users/{uid}/aiSummaries`) and appear in the AI Coach tab instantly via a real-time listener. Past summaries are shown as collapsible cards (most recent expanded by default), filterable by Weekly / Monthly.

#### New data model
```
users/{uid}/aiSummaries/{id}
  - type: "weekly" | "monthly"
  - content: string          // full markdown text from Gemini
  - entryCount: number       // how many observations were analyzed
  - periodStart: timestamp
  - periodEnd: timestamp
  - createdAt: timestamp
```

#### One-time setup (required before deploying)

**Step 1: Get a Gemini API key**
1. Go to https://aistudio.google.com/apikey
2. Create an API key (free tier is sufficient)
3. Copy the key (it starts with `AIza...`)

**Step 2: Store the key as a Firebase secret**
```bash
cd trading-journal
firebase functions:secrets:set GEMINI_API_KEY
# paste your key when prompted, press Enter
```

**Step 3: Upgrade to Blaze (required for Cloud Functions)**
Cloud Functions require the Blaze (pay-as-you-go) plan. At the volume of 1–2 calls per week the costs will be negligible (well within free tier quota). Visit:
https://console.firebase.google.com/project/trade-journal-4271e/usage/details

**Step 4: Deploy functions + hosting**
```bash
cd functions && npm install && cd ..
firebase deploy
```
This deploys both hosting (the UI) and the Cloud Functions in one step.

**Step 5: Verify**
- In Firebase Console → Functions, you should see `weeklyAiCoachSummary`, `monthlyAiCoachSummary`, and `generateAiCoachSummary` listed.
- In the app, go to AI Coach tab → tap "Generate now" → a summary should appear within 30 seconds.

### v1.4.1 — Updated for Google's new AQ. auth key format

Google changed its Gemini API key format in mid-2026. All new keys generated in AI Studio now start with `AQ.` (called "auth keys"). The old `AIza...` standard keys are being phased out.

**Changes made:**
- Switched from the deprecated `@google/generative-ai` SDK (EOL Nov 2025) to `@google/genai` (the new unified SDK that supports `AQ.` keys)
- Updated the API call syntax from `genAI.getGenerativeModel()` to `ai.models.generateContent()`

**Your `AQ.` key will work fine** — just store it as the Firebase secret exactly as-is:
```bash
firebase functions:secrets:set GEMINI_API_KEY
# paste your AQ.xxx key when prompted
```

### v1.5 — Bug fixes, offline images, and app health tools

This update covers one working session's worth of fixes and additions — mostly things that were broken plus a few tools to catch the next problem faster.

#### What was actually broken, and is now fixed

1. **Adding a new observation was completely broken.** Tapping **+** crashed the app instantly with no visible error. This happened because the "New Observation" popup had been redesigned to support multiple entries, but the code behind the **+** button was never updated to match — it was still looking for old field names that no longer existed. Rewritten so the popup and the code behind it agree with each other again.
2. **Light mode header was unreadable.** Switching to light theme (the sun icon) left the top bar (where it says "Dashboard") almost invisible — dark text on a dark background that never switched to light. Fixed.
3. **Revision (swipe review) mode had a stuck/glitchy animation.** Swiping a card away could leave things looking frozen or show the wrong card flashing in briefly. Root cause: when a card had a link preview (e.g. a Google Drive image/video), the app didn't reserve space for that preview while it was loading, so the card's size jumped around and briefly showed the card behind it. Fixed by reserving the space up front, regardless of how long the image takes to load.
4. **Revision cards now show newest-first** instead of oldest-first.
5. **Trade Log wasn't loading**, showing a Firestore "index required" error. This wasn't a bug in the app's logic — Firestore just needed a one-time index for the trade-sorting query, which is now set up.
6. **Dashboard tiles looked scattered/out of order** on wider screens (tablet/desktop width), with gaps and tiles appearing out of date order. This was a side effect of the "smart-fill" grid layout trying to pack tiles tightly and reordering them to do it. Switched to a layout that fills top-to-bottom in the correct order, like a Pinterest-style layout, with no reordering. Also bumped up the note text size slightly for readability.

#### New capability: offline images

Previously, images (from Google Drive/TradingView links) only ever loaded fresh from the internet — no internet meant no images, even for observations you'd already opened before.

Now, any image or video you've successfully viewed at least once while online gets quietly saved on your device. If you open the app later with no signal (e.g. on the train, in a basement), those previously-viewed images will still show up. New images you've never opened before still need an internet connection the first time.

**Nothing to set up for this — it works automatically** once the updated `sw.js` file is deployed.

#### New tools (for catching problems faster next time)

These don't change how the app looks or behaves day-to-day — they're safety nets for future development.

1. **Error notifications.** If something breaks while you're using the app, you'll now see a small toast message ("Something went wrong — check console for details") instead of the app just silently failing with no feedback. This makes it possible to notice a bug immediately instead of days later.
2. **Automatic cache-version bumping.** Every deploy, the app needs to tell your phone's browser "hey, I've changed, fetch the new version." This used to require manually editing a version number in `sw.js` and remembering to do it every time — easy to forget, which causes the classic "I fixed it but the app still shows the old broken version" problem. There's now a script (`generate-version.js`) that does this automatically based on what actually changed, so it can't be forgotten.
3. **Automated "smoke test."** A script that opens the app, logs in, clicks through every tab, and adds a test observation — the exact same flow that broke in bug #1 above — and reports failure the moment anything goes wrong, instead of only being noticed when actually used. Optional to run, but useful before deploying a change to double check nothing obvious broke.

#### Setup steps for this update

**For the offline images and error notifications (steps 1–2, required):**
1. Replace these files in your project with the updated versions: `styles.css`, `sw.js`, `js/ui/dashboard.js`, `js/ui/revision.js`.
2. Add the new file `js/utils/error-tracking.js`.
3. Open your real `app.js` (the short one that just has a list of `import` lines near the top) and add this one line near the other early imports, before the UI modules:
   ```js
   import './js/utils/error-tracking.js';
   ```
4. Deploy Firestore indexes so the Trade Log works again:
   ```bash
   firebase deploy --only firestore:indexes
   ```
   (merge the provided `firestore.indexes.json` into your existing one if you already have one, rather than replacing it wholesale)
5. Deploy as usual:
   ```bash
   firebase deploy --only hosting
   ```

**For the new dev tools (steps 3, optional, no impact on the live app if skipped):**
1. Put `generate-version.js` in your project's root folder (same level as `index.html`). From now on, run `node generate-version.js` once, right before every `firebase deploy --only hosting`.
2. The smoke test lives in its own separate `smoke-tests` folder so it doesn't interfere with your existing Cloud Functions setup. See the setup instructions provided separately in chat for installing and running it — it needs a one-time `npm install` and a dedicated test login (not your real account) before first use.

### v1.6 — Candle Checklist tab

A completely new **Candle Checklist** tab for structured, repeatable analysis of Nifty 5-minute candles at key times during the trading session.

#### What it does

- **Templates** — Create and edit named checklist templates with two categories of checks:
  - **Observatory**: what you observed in the candle (e.g. "Body > 60%", "Wick rejection high")
  - **Decision**: your decision criteria (e.g. "Risk defined", "Not in consolidation zone")
  - Templates are saved to Firestore and available across sessions.

- **Live candle runner** — When a template is selected, the full checklist renders as two columns:
  - ✅ **Selected (green)** — items you've confirmed as true
  - ❌ **Not Selected (red)** — items you have not confirmed
  - Tap any item to toggle it between columns with a smooth animation.

- **IST candle time auto-guide** — A live clock calculates the correct 5-minute Nifty candle reference time based on IST. Accounts for the standard T−30s to T+3m30s logging window. Updates every second while the tab is active; pauses if you manually edit the field.

- **Run logging** — Each checklist run captures:
  - Logging time (IST)
  - All selected and unselected checks per category
  - Optional: link to a Trade Log entry (dropdown, newest-first)
  - Optional: outcome (W / L / CTC)
  - Optional: chart screenshot (file upload or paste from clipboard with Ctrl+V)

- **Previous runs panel** — The right-hand panel shows all saved runs for the active template in **LIFO order** (newest first). The panel fills all available vertical space and has a custom smooth scrollbar for older entries. Any run can be reloaded into the runner for editing by clicking **Edit Run**.

- **"Taking the trade?" toggle** — A `No / Yes` toggle at the bottom of the runner. Clicking **Yes** immediately opens the pre-trade checklist popup (the same modal accessible from the dashboard FAB).

- **Pre-trade checklist FAB** — A `✓` floating button appears in the bottom-right corner while on the Candle Checklist tab, giving instant access to the pre-trade checklist popup. The dashboard `+` FAB hides while on this tab (and vice versa) so they never overlap.

- **Trade Log integration** — When you open any trade entry in the Trade Log tab, a new **📈 Candle Checklist Runs** section appears in the modal showing all candle checklist runs that were linked to that trade. Each row shows template name, candle time, pass score (x/y, %), and outcome badge. A **View** button closes the trade modal, switches to the Candle Checklist tab, and reloads that run for editing.

#### New Firestore data model

```
users/{uid}/candleChecklistTemplates/{templateId}
  - name: string
  - observatory: string[]      // list of observatory check labels
  - decision: string[]         // list of decision check labels
  - createdAt: timestamp
  - updatedAt: timestamp

users/{uid}/candleChecklistRuns/{runId}
  - templateId: string
  - templateName: string
  - loggingTime: string        // IST time string e.g. "11:30 AM"
  - selected:
      observatory: string[]    // items the user selected (ticked green)
      decision: string[]
  - unselected:
      observatory: string[]    // items not selected (red)
      decision: string[]
  - outcome: "W" | "L" | "CTC" | ""
  - linkedTradeId: string | null   // Firestore ID of a linked trade log entry
  - chartImage: string | null      // base64 encoded, resized to ≤1024px
  - createdAt: timestamp
  - updatedAt: timestamp
```

#### New files added

| File | Purpose |
|---|---|
| `js/ui/candleChecklist.js` | Full UI controller: template selector, runner, IST timer, image paste, run save/load, FAB wiring, trade modal integration |
| `js/services/candleChecklist.js` | Firestore listeners and CRUD for templates and runs |

#### Files modified

| File | Change |
|---|---|
| `index.html` | New `Candle Checklist` nav tab + full view HTML (runner, columns, previous runs panel, FAB) |
| `styles.css` | Grid layout, green/red column theming, custom scrollbar, FAB-secondary style, "Taking the trade" toggle |
| `js/state.js` | Added `candleChecklistTemplates` and `candleChecklistRuns` arrays |
| `js/dom.js` | Exported `viewCandleChecklist` DOM reference |
| `js/ui/auth.js` | Subscribe/unsubscribe candle Firestore listeners on login/logout |
| `js/ui/common.js` | Tab switching logic for Candle Checklist view + FAB visibility toggle |
| `js/ui/checklists.js` | Exported `openChecklistModal` so candle tab can open the pre-trade popup |
| `js/ui/tradelog.js` | Calls `renderLinkedCandleRuns(tradeId)` when opening a trade entry |
| `app.js` | Imports `js/ui/candleChecklist.js` |
| `sw.js` / `generate-version.js` | Both new files added to precache manifest |

#### Deploy steps

```bash
node generate-version.js
firebase deploy --only hosting
```

### v1.7 — TradingView Webhooks

A new **TV Notifications** tab to receive real-time alerts from TradingView webhooks.

#### What it does
- **Webhook Integration** — Generates a unique secure URL to paste into TradingView alerts.
- **Real-time Feed** — Alerts arrive instantly in the TV Notifications tab and as in-app toast popups when the app is open.
- **Auto Cleanup** — Alerts older than 2 days are automatically deleted by the Cloud Function to save space.
- **Filtering** — Filter alerts by Buy, Sell, Exit, or All.

#### New data model
```
users/{uid}/tvNotifications/{id}
  - raw: string
  - symbol: string
  - action: string
  - price: number
  - strategy: string
  - interval: string
  - read: boolean
  - receivedAt: timestamp

webhookTokens/{token}
  - uid: string
  - createdAt: timestamp
```

#### Setup required for this update
Because we avoided a paid Firebase plan, the webhook is built for **Vercel Serverless Functions**.
1. Import this repository into Vercel.
2. In your Vercel project settings, add an Environment Variable named `FIREBASE_SERVICE_ACCOUNT`.
3. Generate a new Private Key in Firebase Console > Project Settings > Service Accounts.
4. Copy the entire JSON file contents and paste it as the value for `FIREBASE_SERVICE_ACCOUNT` in Vercel.
5. Deploy to Vercel. Your frontend and API will automatically work.

### v2.0+ Updates (Checklists & Logging)

1. **Pre-trade Checklists**: Access your custom checklist templates from the settings or the FAB.
2. **Candle Checklists**: A specialized checklist format for reviewing individual candles.
    - **Templates**: Define checklists with *Positive Decisions* (choose factors), *Negative Decisions* (reject factors), and *Observatory* checks. Now supports template deletion directly from the view.
    - **Runs (Logs)**: Log whether you "Considered" taking the trade, along with any chart image, linked trade, and your textual **Note/Analysis**.
    - **Management**: You can easily delete any previous Pre-trade or Candle Checklist run if needed (just tap "Delete" next to the "Edit" button).
3. **Delete capability across logs**: Both pre-trade checklist logs (linked to trades) and candle checklist runs can now be freely edited or deleted.
4. **Structured Decision Rules**: Split the Decision category into Positive (choose) and Negative (reject) triggers, ordering them above the Observatory sections for quick validation.

### v1.2.0 — Sequential Signal Trigger System

1. **Sequential Trigger Rules**: Define rules that trigger only when 2 to 5 specific messages arrive in an ordered sequence (e.g. M1 $\rightarrow$ M2 $\rightarrow$ M3).
    - **Timeframe-based Expiry**: The tracking state automatically expires if the next step does not arrive within a configurable multiplier of the M1 chart timeframe (e.g. 1-minute chart alert has a 6-minute window by default).
    - **Casing & Duplicate Handling**: Casing is automatically ignored during matching, and a new M1 alert restarts the tracking sequence, resetting previous in-progress states.
2. **Split-Pane TV Notifications Dashboard**: The TV Notifications tab is now partitioned:
    - **Left Pane**: Live stream of raw incoming alerts from TradingView.
    - **Right Pane**: Setup panel for active rules, progress counters, and final trigger event logs.
3. **Editable Logs & Outcome Filtering**: Completed triggers generate detailed logs capturing symbol, timeframe, date, and price. Outcomes (`Pending`, `Profit`, `Loss`) and custom notes can be edited inline. Logs are filterable by symbol name and outcome.
4. **CSV Exporting**: Easily download filtered log records as a standardized, quoted CSV spreadsheet file.
5. **Telegram Push Notifications**: Push triggers instantly to your Telegram group, private chat, or channel using a custom bot. Set up and test credentials directly in Settings.
6. **Log Auto-Clean**: Auto-cleans logs older than 7 days automatically inside the backend webhook. Can be toggled on/off in the logs list header.
7. **Serverless Execution Safety**: Awaits background promise completion in Vercel Serverless Functions to guarantee reliable Firestore writes and Telegram calls before Vercel freezes the execution thread.

### v2.1.0 — Sequence Rule Toggle, Push Preferences & TV Dashboard UX

1. **Sequence Rule Enable/Disable Toggle**: Added an interactive toggle switch directly on the sequence rule cards in the right pane of the TV Notifications view. Users can easily enable/disable any sequence rule. Disabling a rule automatically clears any active in-progress states in Firestore and stops monitoring incoming TradingView alerts for that rule in the engine.
2. **Push Notification Preferences**: Added a toggle switch under Settings to configure system-level push notifications for *every* incoming TradingView alert (disabled by default to prevent notification fatigue). Important sequence completion notifications remain always-enabled.
3. **Collapsible Live Alerts Feed**: Incoming alerts in the TV Notifications left pane are now automatically grouped into collapsible symbol accordion panes with unread count badges.
4. **Rich Notifications & Audio**: Sequence triggers now display persistent, rich HTML toast cards (showing symbol, timeframe, price, and steps) and play a synthetic dual-tone Web Audio chime.
5. **Vercel Network Stability**: Rewrote the Telegram push engine using Node's native HTTPS module to ensure stable and guaranteed payload delivery before Vercel Serverless Functions freeze execution threads.
6. **Layout Adjustments**: Reordered the TV Notifications right pane: the Trigger Logs panel is now positioned at the top, and the Sequential Rules panel is configured as a compact accordion by default.
### v2.2.0 — 29 Jul 2026 — Daily Levels Tab & Telegram Reliability Fix

#### Daily Levels Tab
A new **Levels** tab for pre-market trade planning, ported from a standalone prototype into the main app.

- **Plan a Trade form**: Enter key price levels/zones, bias direction (Bullish/Bearish/Neutral), expected behavior (Gap Up, Sweep & Reversal, Consolidation, etc.), and TP/SL targets.
- **Visual Chart Map**: All levels auto-plot on a vertical price axis with colored annotations — green for bullish, red for bearish, amber for neutral — with dashed connectors and glowing borders.
- **Mapped Levels list**: Cards showing each planned level with inline-editable fields. Sorted by price (highest first).
- **Collapsible panels**: Both the form and levels list collapse for a cleaner view.
- **Clear All**: One-click button to wipe all levels at end of day. Data stored in browser `localStorage` (no Firestore needed).
- **Responsive**: On narrow screens, the chart appears on top and the form below.

#### New files
| File | Purpose |
|---|---|
| `css/levels.css` | All styling for the Levels tab (layout, chart annotations, cards, responsive) |
| `js/ui/levels.js` | Full UI controller: form handling, card injection, chart rendering, localStorage persistence |

#### Files modified
| File | Change |
|---|---|
| `index.html` | New `Levels` nav tab + full view HTML inside `app-screen` |
| `js/dom.js` | Exported `viewLevels` DOM reference |
| `js/ui/common.js` | Tab switching logic for Levels view |
| `app.js` | Imports `js/ui/levels.js` |

#### Telegram Notification Reliability Fix
Fixed intermittent Telegram notification drops on Vercel. The `sendTelegramNotification()` call in `sequenceEngine.js` was fire-and-forget (`.catch()` only, not `await`ed). On Vercel serverless functions, this meant the function context could freeze/terminate before the Telegram HTTP request completed, silently dropping the notification. Now properly `await`ed so the Telegram API call always completes before the function exits.

### v2.2.2 — 31 Jul 2026 — Automated Daily Plan Push
- Added auto-loading logic to `levels.js` to automatically fetch daily trade plans injected from local AI scripts via `js/data/daily_plan.js`.
- Ignored `daily_plan.js` in Git to keep data pushes strictly local and prevent version history pollution.

### v2.2.1 — 31 Jul 2026 — Alert Parser Fix & Trigger Log Grouping

#### Smart Symbol Detection for TradingView Native Alerts
TradingView's built-in crossing/price alerts use the format `XAUUSD, 5 Crossing Up price 4091.250 in 2026-07-30T13:35:00Z TF`. The old parser misidentified the ISO date string (`2026-07-30T13`) as the symbol because the `in` keyword in the fallback regex matched the datetime. Three fixes applied:
- **New TradingView native format detector** — dedicated regex catches `SYMBOL, TF condition price PRICE in DATETIME` immediately
- **ISO date guard** — `isIsoDateLike()` rejects any string starting with `YYYY-MM` from being treated as a symbol
- **Keyword-as-symbol fallback** — if the first token looks like a symbol (e.g. `XAUUSD,`), strips the comma and uses it
- Also strips trailing commas (not just colons) from the keyword token

#### Trigger Logs Grouped by Date → Symbol
The Trigger Logs section now groups entries by date (IST), then by symbol within each date:
- **Today** is always expanded by default, with a blue accent border and "· Today" label
- **Previous days** are collapsed — click to expand
- **Symbol sub-headers** appear within each date when there are multiple symbols on the same day
- Each card retains full functionality (outcome dropdown, notes, delete)

### v2.3.0 — 1 Aug 2026 — Stocks Tab & Automated Canva Scanner

A new **Stocks** tab to manage and track stock setups scanned from Canva reports.

#### What it does
- **Stocks Dashboard** — A premium, responsive layout showcasing stock names, tickers, summaries, date, source, and timeframe.
- **Zero-Manual-Step Ingestion** — AI scans the Canva presentation and writes to `js/data/scanned_stocks.js`. When the app loads (locally or on Vercel), it automatically syncs any new entries directly into Firestore under `/users/{userId}/stocks`.
- **Compound Database Keys** — Uses `TICKER_dateOfRun` (e.g. `SOLARINDS_2026-07-26`) as the document key to allow scanning the same stock on multiple dates while updating/merging data for the same day.
- **Premium Table UI** — Built custom visual badges:
  - Clickable TradingView badges (`📊 TV` link button).
  - Timeframe status pills (blue for Daily, purple for Weekly).
  - Traded status indicator badges (glowing green for Yes, dim grey for No).
- **Inline Editing** — Every field is editable inline and updates Firestore immediately on blur/change. Ticker and Sector fields are now clean text hyperlinks that open TradingView; simply double-click them to enter edit mode.
- **Sorting & Grouping** — Group entries dynamically by **Source** or **Date of Run**, and sort them alphabetically by **Stock Name** or by **Date of Run** (newest first). **Defaults to Date of Run (Descending)**.
- **Bulk Operations** — Select multiple rows via checkboxes and delete them instantly via the Delete Selected button.
- **Interactive Table Headers** — Click directly on column headers (Stock Name, Date, TF, Traded) to toggle sort order, or click **Source** to toggle grouping. Active sorting/grouping shows directional arrow indicators (`▲`/`▼`/`📁`) highlighted in active blue.
- **Watchlist Copying** — Added **Copy Delta** (latest run date) and **Copy Full** buttons to instantly copy formatted exchange-prefixed tickers (`NSE:TICKER` or `BSE:TICKER`) to your clipboard for bulk copy-pasting into TradingView.
- **Timeline Prepending & Highlighting** — Daily scanner runs prepend updates chronologically at the top of the summary text (e.g. `[Date] Update Text`). Updated stocks get a soft row highlight that automatically clears when clicked/viewed.
- **Tab Layout & Overlap Fixes** — Prevented tab button overlap by shortening names (e.g., `Candle`, `TV Alerts`) and changing nav styling from `flex: 1` to `flex: 0 0 auto` with increased horizontal spacing to enable horizontal scrolling on small screens.
- **Local Scanner Script** — Created `stock_scanner.py` and `run_scanner.bat` inside the `C:\Nitish\ClaudeApps\Utilities\` directory. Supports scanning both Canva presentation URLs and public Telegram channel preview widgets (`t.me/s/...`).
- **Telegram Channel Source Mapping** — The scanner extracts the exact Telegram channel name from the URL (e.g., `EquiAlpha_stocks`) and assigns it directly to the stock's "Source" metadata field.
- **SSL Bypass Support** — Configured unverified SSL contexts for the Python request engine to avoid Windows security cert verification halts on local networks.

#### New files added
- `js/services/stocks.js` — Firestore operations (snapshot subscriptions, batch inserts, updates, deletions).
- `js/ui/stocks.js` — Rendering, group/sort managers, and inline edit logic.
- `js/data/scanned_stocks.js` — Scanned stocks JSON data structure.
- `C:\Nitish\ClaudeApps\Utilities\stock_scanner.py` — Local Python scraper (Canva & Telegram support).
- `C:\Nitish\ClaudeApps\Utilities\run_scanner.bat` — Windows launcher batch file.


### v2.3.1 - 1 Aug 2026 - Smart Dynamic Stock Extraction & automated Sectors
- **Smart Telegram Parsing**: Completely removed the hardcoded `COMMON_TICKERS` list requirement for discovering stocks. The `stock_scanner.py` scraper now extracts stocks dynamically from *any* Telegram channel using three robust methods:
  - **Hyperlink Extraction:** Extracts the stock ticker flawlessly from TradingView anchor tags.
  - **Header Structure Extraction:** Extracts the stock ticker from setup headers like "POSITIONAL RESEARCH" or "SWING TRADE".
  - **Cashtag Extraction:** Matches `$TICKER` or `#TICKER` format in messages containing trade setup keywords.
- **Automated Sector Backfilling (`yfinance`)**: For dynamically discovered stocks, the scraper now automatically calls the Yahoo Finance API (via `yfinance`) to instantly fetch and map the official sector/industry into the database.
  - **Advanced Text Extraction**: The parser smartly captures the full company phrase before the text "Looks Good" and handles extraction of parenthesized tickers (e.g. SML MAHINDRA (SMLMAH)) or strips spaces for split tickers (e.g. PNB Housing -> PNBHOUSING).

### v2.3.2 — 4 Aug 2026 — Candle Checklist UI Enhancements & Run Folding
- **Active Selection Color Coding**: Selected items in the active runner now reflect their category role:
  - **Positive Decisions**: Rendered in green with green glow and checkmark (`✔`).
  - **Negative Decisions**: Rendered in red with red glow and checkmark (`✔`).
  - **Observatory**: Rendered in yellow/amber with amber glow and checkmark (`✔`).
  - Column headers in the Selected column styled with matching colored accents.
- **Previous Runs Category Tag Coloring**:
  - In the "Previous Runs" sidebar cards, category prefix labels are color-coded: `<strong style="color:var(--low)">Positive Decisions:</strong>` in green, `<strong style="color:var(--high)">Negative Decisions:</strong>` in red, and `<strong style="color:#EAB308">Observatory:</strong>` in yellow.
  - The checked item values remain clean in their standard text color for readability.
- **Collapsed Format for Unconsidered Runs**:
  - Previous runs marked as **Considered** (`consider = true`) remain expanded with the prominent green `Considered` badge.
  - Runs marked as **Not Considered** (`consider = false`) now appear in a compact **collapsed format** with a clickable summary header showing the timestamp, passed score, and `Not Considered` tag. Clicking toggles full card details, notes, and actions.
- **Master "Interesting Candle" Gatekeeper Check**:
  - Pushed the `"Is this an interesting candle?"` evaluation check outside and directly to the top of the runner as a prominent master toggle card.
  - When unchecked, the entire evaluation & action section (parallel columns, trade linking, screenshot upload, notes, and save controls) remains cleanly hidden for maximum focus.
  - When checked, the evaluation form dynamically illuminates and reveals the parallel Selected / Not Selected columns and all logging controls.
  - Automatic template filtering ensures "interesting candle" checks in existing templates are cleanly routed to the master checkbox rather than appearing duplicated inside inner lists.
- **Date Formatting for Older Runs**:
  - In the "Previous Runs" sidebar cards and linked trade modal lists, older runs now clearly show their date alongside the time (e.g. `3 Aug, 6:35 PM`), while today's runs display the concise time (e.g. `6:35 PM`).
- **Trade Taken Highlight & Glow**:
  - If a trade is executed on a candle (`Taking the trade? Yes` or linked to a trade log entry), the run card is highlighted with a vivid **illuminated cyan/blue glow**, gradient background, and a glowing **`⚡ TRADE TAKEN`** badge.

### v2.3.3 — 4 Aug 2026 — Dual Repeat Candle Timers (5m & 15m) & Milestone Alarms

A dedicated **Dual Candle Repeat Timer HUD** and **Audio Alarm Engine** for market sessions.

#### What it does
- **Top HUD Progress Bar**:
  - Positioned prominently below the template selector on the Candle Checklist tab.
  - Dual horizontal progress countdown boxes for **5-Minute** and **15-Minute** candle closes.
  - Real-time IST countdown (`MM:SS`), next candle close target time, dynamic percentage fill bar, and in-bar quick mute buttons (`🔊`/`🔇`).
- **Comprehensive Settings Panel** (inside Settings tab):
  - **Active Days Selector**: Interactive day pills (Mon–Sun) to control operational market days.
  - **Operating Session Hours**: Configurable `From Time` and `To Time` (default: `09:15` to `15:30` IST).
  - **Anchor/Sync Time**: Synchronizes countdown calculations precisely with market open.
  - **Custom Tone Synthesizer**: Choose distinct audio alerts (*Melodic Chime*, *Radar Sonar*, *Resonant Bell*, *Digital Beep*) with instant `▶ Test` previews.
  - **⭐ Special Time Notifications**: Configure custom milestone timestamps (e.g. `09:15 AM`, `10:00 AM`, `03:00 PM`) with dedicated Grand Harmonic Chord sound alerts and dynamic add/remove tags.
  - **Cloud Sync**: All timer settings, active days, sound preferences, and special times are persisted directly in Firebase Firestore.
- **Synthesized Audio Engine**:
  - Offline-capable Web Audio API synthesizer (`js/utils/audio.js`) requiring zero external audio file downloads.

#### New files added
- `js/services/candleTimers.js` — Firestore persistence layer for timer configurations.
- `js/ui/candleTimers.js` — Countdown loop controller, HUD DOM binder, and Settings UI manager.
- `js/utils/audio.js` — Web Audio API multi-frequency sound synthesizer.

### v2.3.5 — 5 Aug 2026 — Live Alerts: Chart Screenshot Previews, Vision AI Levels & Fullscreen Lightbox

Enhanced **Live TV Alerts** webhook handler (`/api/tvWebhook`) and alert notification UI (`tvNotifications.js`) to support embedded chart screenshots, vision-extracted price levels, setup insights, and fullscreen zoom modals.

#### What it does
- **Embedded Chart Screenshot Previews**:
  - Automatically captures and embeds compressed chart screenshots sent via webhooks/MTProto workers directly into alert notification cards.
  - Interactive thumbnail preview with clean header tag.
- **Fullscreen Image Lightbox**:
  - Clicking any chart screenshot opens an overlay modal with high-res zoom view and close controls.
- **Dynamic Trade Level Badges (Entry, SL, TP, R:R)**:
  - **Entry Price**: Prominent blue pill badge.
  - **Stop Loss (SL)**: Red risk pill.
  - **Take Profit (TP / Targets)**: Green target pill.
  - **Risk-to-Reward (R:R)**: Real-time calculated ratio badge (e.g. `🎯 R:R 1:1.8`).
- **AI Setup Insight Box**:
  - Highlighted golden insight card summarizing technical reasoning, direction, and trade parameters.
- **Automatic 4:00 PM IST Previous Day Alert Cleanup**:
  - Automatically purges all previous day alert notifications at 4:00 PM (16:00 IST) market wrap-up.
  - Keeps the live alert feed focused on today's active trading session while maintaining background garbage collection on both client and webhook endpoints.
- **Updated Cloud & Mobile Worker**:
  - Added Google Gemini 2.0 Flash Vision and Groq 90B Vision fallback in `telegram_cloud_worker/worker.py` for reading TradingView mobile position tools automatically.

### v2.3.6 — 5 Aug 2026 — Levels Tab: 5-Minute First Candle In / Out Reaction Analysis (Upstox Feed)

Added an automated intraday reaction checker to the **Levels Tab** that evaluates 5-minute Nifty 50 candle interactions for any selected date against all marked price levels and zones.

#### What it does
- **Top Reaction Toolbar**:
  - Quick Date Picker defaulting to today's date in IST.
  - Action trigger: `🔍 Check First Candle In/Out`.
- **Automated 5-Minute Candle Aggregation (`/api/niftyCandles`)**:
  - Pulls public 1-minute historical/intraday candles from Upstox and aggregates them into 75 standard 5-minute candles (`09:15` to `15:30` IST).
  - Works seamlessly with zero authentication requirement.
- **Comprehensive Reaction Pop-up Modal**:
  - **🟢 First Candle IN**:
    - Exact timestamp (e.g. `09:50 AM IST`).
    - Approach direction (*Pullback/Drop from Above* vs *Rally/Push from Below*).
    - Touch classification (*Body Entry* vs *Wick Sweep / Pin*).
    - Detailed 5m candle OHLC metrics.
  - **🔴 First Candle OUT**:
    - Exact resolution timestamp (e.g. `09:55 AM IST`).
    - Exit direction (*Broke Out Above 🟢* or *Broke Down Below 🔴*).
    - Exit candle Close & OHLC metrics.
  - **💤 Untouched Status**:
    - Clear indicator if price never entered or reached the marked level during the session, comparing with the day's high/low range.
  - **Plan Context**: Displays planned bias badge, expected behavior, and configured TP/SL targets side-by-side.

#### New files added
- `api/niftyCandles.js` — Upstox 1m to 5m candle aggregation serverless API.

### v2.3.7 — 5 Aug 2026 — Levels Tab: Channel Source Tags, EOD Outcome Reviewer & Performance Scorecard

Added channel source tagging, end-of-day level performance reviewing, and a real-time Worked vs. Failed ratio scorecard table to the **Levels Tab**.

#### What it does
- **Channel / Source Tagging on Every Level Card**:
  - Distinct short source pill (e.g. `BT` for Bengal Trader, `AK` for Ashish Kyal, `SM` for Stock Marketed, `PR` for Power of Stocks, `AT` for Art of Trading, `Self`).
  - Quick channel tag pills in the "Plan a Trade" creation form.
  - Fully editable inline by clicking the source badge on any level card.
  - Highlighted on the Visual Chart Map and First Candle In/Out reaction modal.
- **End-of-Day Outcome Review Mechanism**:
  - Interactive 3-state toggle buttons on each level tile: `[ ✅ Worked ]`, `[ ❌ Failed ]`, `[ ⚪ NA ]`.
  - Visual card states: glowing emerald border for *Worked*, rose red border for *Failed*, neutral for *NA*.
  - Outcome buttons are also accessible directly inside the First Candle In/Out reaction modal for quick reviewing while inspecting price action.
  - Automatically persisted in `localStorage` and synced with memory.
- **Daily Forecast Performance Scorecard Table**:
  - Positioned right below the mapped levels list.
  - Groups performance metrics per channel source (`BT`, `AK`, `SM`, etc.) and calculates an **OVERALL / TOTAL** row.
  - Displays:
    - **Worked (W)** count.
    - **Failed (F)** count.
    - **W : F Ratio** (e.g. `3 : 1`, `5 : 0`).
    - **Win Rate %** with color-coded pills (Green for ≥60%, Amber for 40-59%, Red for <40%).
    - **NA / Ignored** count (untested/untouched levels excluded from win rate calculations).
  - Updates in real-time as you mark predictions.

### v2.3.8 — 5 Aug 2026 — Levels Tab: Multi-Day Persistent Scorecard History

Decoupled the EOD Performance Scorecard from daily trade plan level clears, allowing historical channel win rates to accumulate across days while keeping individual daily plans cleanable.

#### What it does
- **Persistent Multi-Day Tracking**:
  - Scorecard stats persist across days in dedicated local storage (`levelsScorecardHistory` & `levelsLoggedReviews`).
  - Each source channel (`BT`, `AK`, `SM`, `PR`, etc.) maintains a single cumulative entry recording all past evaluated predictions.
- **Independent "Clear All Levels" vs. "Reset Stats"**:
  - Tapping **Clear All** on the Mapped Levels panel clears only the temporary daily plan cards without wiping historical source statistics.
  - Added a dedicated **Reset Stats** button in the Scorecard header for when you explicitly wish to start fresh with a clean slate across all channels.
- **Smart Audit Log**:
  - Re-evaluating or modifying level sources automatically adjusts and recalculates source balances without duplicate counts.
