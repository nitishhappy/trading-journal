# Daily Plan AI Update Logic

When updating `daily_plan.js` with new market summaries or levels (e.g., from an AI run):
1. **First Run of the Day:** Check the dates of the existing entries in the file. If there are no entries for the current day, you must **OVERWRITE / CLEAR** all old entries from previous days before adding the new data.
2. **Subsequent / Ad Hoc Runs:** If the file already contains entries for the current day (e.g., YouTube predictions added earlier, or an afternoon AI tactical update), you must **APPEND** the new data to the existing current-day data. 

**Do not blindly append** without checking the dates of the existing data first.

## MANDATORY ASSET ISOLATION & DATA STRUCTURE CONTRACT (CRITICAL)

When updating `daily_plan.js` with new market summaries or levels (e.g., from an AI run):
1. **Strict Asset Data Array Mapping**:
   - **NIFTY**: `window.dailyPlanSummary` & `window.dailyPlanData`
   - **GOLD**: `window.goldDailyPlanSummary` & `window.goldDailyPlanData`
   - **BTC**: `window.btcDailyPlanSummary` & `window.btcDailyPlanData`
   - **S&P 500**: `window.sp500DailyPlanSummary` & `window.sp500DailyPlanData`
2. **Explicit Window Scope**: Every array declaration in `daily_plan.js` MUST use an explicit `window.` prefix (e.g., `window.btcDailyPlanSummary = [...]`). NEVER omit `window.` or use naked global variables.
3. **No Cross-Asset Contamination**: NEVER append Gold, BTC, or S&P 500 briefings/levels into `window.dailyPlanSummary` or `window.dailyPlanData`.
4. **Header Title Parsing Safety**: UI header parsers must scan full multi-line text bodies for timestamps `(HH:MM AM/PM IST)` and `Trigger:` fields, bypassing structural banner lines (`====`).
5. **Level Deduplication Key Normalization**: When syncing levels, strip timestamp tags (e.g. `[09:00]`, `[11:56]`) from level descriptions before signature matching to prevent stacking duplicate price level cards on visual maps.

## MANDATORY SYNTAX CHECK (CRITICAL)
You have a strict history of introducing Javascript syntax errors (like duplicate closing brackets ];) when string-replacing or updating this file, which crashes the user's dashboard UI.
Before you are allowed to commit or push any changes to daily_plan.js, you **MUST** run the following command to verify Javascript syntax:
```bash
node -c js\data\daily_plan.js
```
If this command returns any error, you must fix the syntax error immediately. Do not push broken JS to the repository under any circumstances.
