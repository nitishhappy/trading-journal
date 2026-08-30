# Daily Plan AI Update Logic

When updating `daily_plan.js` with new market summaries or levels (e.g., from an AI run):
1. **First Run of the Day:** Check the dates of the existing entries in the file. If there are no entries for the current day, you must **OVERWRITE / CLEAR** all old entries from previous days before adding the new data.
2. **Subsequent / Ad Hoc Runs:** If the file already contains entries for the current day (e.g., YouTube predictions added earlier, or an afternoon AI tactical update), you must **APPEND** the new data to the existing current-day data. 

**Do not blindly append** without checking the dates of the existing data first.

## MANDATORY SYNTAX CHECK (CRITICAL)
You have a strict history of introducing Javascript syntax errors (like duplicate closing brackets ];) when string-replacing or updating this file, which crashes the user's dashboard UI.
Before you are allowed to commit or push any changes to daily_plan.js, you **MUST** run the following command to verify Javascript syntax:
`ash
node -c js\data\daily_plan.js
`
If this command returns any error, you must fix the syntax error immediately. Do not push broken JS to the repository under any circumstances.
