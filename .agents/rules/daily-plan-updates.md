# Daily Plan AI Update Logic

When updating market summaries or levels (e.g., from an AI run), you must use the **dedicated physical JS data file** for the corresponding asset:
1. **First Run of the Day:** Check the dates of the existing entries in the file. If there are no entries for the current day, you must **OVERWRITE / CLEAR** all old entries from previous days before adding the new data.
2. **Subsequent / Ad Hoc Runs:** If the file already contains entries for the current day (e.g., YouTube predictions added earlier, or an afternoon AI tactical update), you must **APPEND** the new data to the existing current-day data. 

**Do not blindly append** without checking the dates of the existing data first.

## MANDATORY ASSET ISOLATION & DATA STRUCTURE CONTRACT (CRITICAL)

When updating market summaries or levels (e.g., from an AI run):
1. **Strict Asset File Mapping**:
   - **NIFTY**: Update `js/data/nifty_daily_plan.js` (`window.dailyPlanSummary` & `window.dailyPlanData`)
   - **GOLD**: Update `js/data/gold_daily_plan.js` (`window.goldDailyPlanSummary` & `window.goldDailyPlanData`)
   - **BTC**: Update `js/data/btc_daily_plan.js` (`window.btcDailyPlanSummary` & `window.btcDailyPlanData`)
   - **S&P 500**: Update `js/data/sp500_daily_plan.js` (`window.sp500DailyPlanSummary` & `window.sp500DailyPlanData`)
2. **Explicit Window Scope**: Every array declaration in these files MUST use an explicit `window.` prefix. NEVER omit `window.` or use naked global variables.
3. **No Cross-Asset Contamination**: NEVER append Gold, BTC, or S&P 500 briefings/levels into `js/data/daily_plan.js` or `js/data/nifty_daily_plan.js`.
4. **Header Title Parsing Safety**: UI header parsers must scan full multi-line text bodies for timestamps `(HH:MM AM/PM IST)` and `Trigger:` fields, bypassing structural banner lines (`====`).
5. **Level Deduplication Key Normalization**: When syncing levels, strip timestamp tags (e.g. `[09:00]`, `[11:56]`) from level descriptions before signature matching to prevent stacking duplicate price level cards on visual maps.

## MANDATORY SYNTAX CHECK (CRITICAL)
You have a strict history of introducing Javascript syntax errors (like duplicate closing brackets ];) when string-replacing or updating these files, which crashes the user's dashboard UI.
Before you are allowed to commit or push any changes to any of the daily plan files, you **MUST** run the corresponding command to verify Javascript syntax:
```bash
node -c js\data\nifty_daily_plan.js
node -c js\data\gold_daily_plan.js
node -c js\data\btc_daily_plan.js
node -c js\data\sp500_daily_plan.js
```
If this command returns any error, you must fix the syntax error immediately. Do not push broken JS to the repository under any circumstances.
