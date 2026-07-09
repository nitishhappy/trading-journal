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
