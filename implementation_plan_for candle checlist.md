# Add "Candle Checklist" Tab – Implementation Plan

## Goal
Add a new **Candle Checklist** tab to the existing Trading Journal web app. The tab will allow users to create checklist templates (Observatory and Decision categories), run a checklist for a 5‑minute candle, log results, view previous runs, and optionally link to a trade or attach a chart screenshot.

## User Review Required
> [!IMPORTANT]
> This change introduces new storage in `localStorage` under the key `candleChecklist`. It will not affect existing data, but if you already have a large `localStorage` payload, ensure the browser has enough quota.

## Open Questions
> [!IMPORTANT]
> 1. **Colour scheme:** Should the new tab follow the existing dark‑mode glass‑morphism palette, or do you prefer a custom accent colour?
> 2. **Persistence:** Use `localStorage` (simple) or `IndexedDB` (more robust)? The prototype will start with `localStorage`.
> 3. **Trade linking UI:** Do you want a dropdown of recent trades or a free‑text URL field?

## Proposed Changes (Phased)
---
### Phase 1 – UI Skeleton & Imports
- **index.html** – Add a new `<button class="main-tab" data‑view="candlechecklist">Candle Checklist</button>` in the main‑tabs navigation.
- Add a corresponding `<div id="view-candlechecklist" class="view hidden"></div>` container after the Trade Log view.
- **app.js** – Import a new UI module `./js/ui/candleChecklist.js`.
- **js/ui/candleChecklist.js** – Register the view, load template list, and display a placeholder "Coming soon…" message.
- **services/candleChecklist.js** – Stub with functions `loadTemplates()`, `saveTemplate()`, `runChecklist()`, `saveRun()`, `getLastRuns()` that operate on `localStorage`.
- No changes to existing functionality; all new code is self‑contained.
---
### Phase 2 – Template Builder
- UI for creating a template: modal with two sections (Observatory, Decision) and ability to add items.
- Persist templates via `services/candleChecklist.js`.
- Update the checklist selector in the new view.
---
### Phase 3 – Running a Checklist
- When a template is selected, generate a live checklist UI showing the time window (T‑30 s to T + 3.5 min) based on current IST.
- Two columns: **Selected** (green) and **Not Selected** (red); items toggle with smooth animation.
- Show previous two runs on the right side of the same screen.
---
### Phase 4 – Logging & Linking
- Add a "Log result" modal (reuse existing checklist‑result‑modal layout) with fields for:
  - Trade outcome (W/L/CTC).
  - Pre‑trade / post‑trade analysis textareas.
  - Optional chart image upload (base64 stored).
  - Optional link to a trade (dropdown of recent trades).
- Save run data to `localStorage` and update the previous‑runs panel.
---
### Phase 5 – polish & SEO
- Add proper `<title>` and meta description for the new view.
- Ensure all interactive elements have unique IDs.
- Add micro‑animations (fade, colour transition) matching the app’s design language.
- Write unit‑like tests in a temporary `scratch/` script that verifies storage round‑trip.

## Verification Plan
- **Automated:** Simple `node scratch/verify_candle.js` that loads the module, creates a template, runs a checklist, saves a run, and asserts retrieval of the last two runs.
- **Manual:** Load the app in Chrome, open the Candle Checklist tab, create a template, run it, toggle items, save, and verify the previous‑runs panel updates.

---
*Once you approve this plan, I will begin Phase 1 implementation.*
