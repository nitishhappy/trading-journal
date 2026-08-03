---
name: stock-scanner-workflow
description: Automates the "Stock Scanner" prompt behavior.
---

# Stock Scanner Prompt Workflow

When the user prompts "Stock Scanner" or provides a "Stock Scanner [URL]", you must act as the automated orchestrator and execute the local scraping scripts on their behalf. You will never ask the user to run a batch file.

## Workflow Triggers

### 1. No URL Provided ("Stock Scanner")
If the user just says "Stock Scanner", immediately use the `run_command` tool to execute the python scraper for their default Telegram channels:
1. `python C:\Nitish\ClaudeApps\Utilities\stock_scanner.py "https://t.me/s/EquiAlpha_stocks"`
2. `python C:\Nitish\ClaudeApps\Utilities\stock_scanner.py "https://t.me/s/ALChampionsClub"`
3. `python C:\Nitish\ClaudeApps\Utilities\stock_scanner.py "https://t.me/s/stockpro_online"`
Once finished, inform the user that their journal has been updated with the latest Telegram stocks.

### 2. Telegram URL Provided
If the user provides a Telegram URL (e.g., "Stock Scanner https://t.me/..."):
1. Execute `python C:\Nitish\ClaudeApps\Utilities\stock_scanner.py "[URL]"`
2. Inform the user that the journal is updated.

### 3. Canva URL Provided
If the user provides a Canva URL:
1. Recommend to the user that uploading screenshots directly is significantly faster and more reliable due to Canva's dynamic canvas rendering.
2. If forced to parse via URL, use the browser subagent to capture slide screenshots.

### 4. Images Attached with "Stock Scanner"
If the user provides one or more images/screenshots with the prompt "Stock Scanner" (or similar):
1. Visually inspect each image/screenshot using vision capabilities to identify the stock names, tickers, chart timeframes, and write-ups/summaries.
2. Formulate the clean JSON records for each stock setup, setting `"source": "Canva_Upload"` and determining the sector automatically using `yfinance` or standard classification.
3. Automatically merge/append these stocks into `C:\Nitish\ClaudeApps\trading-journal\js\data\scanned_stocks.js`, prepending new dates to summaries and marking `highlight: true`.
4. Update `README.md` if any structural changes were made.
5. Commit and push the updated `js/data/scanned_stocks.js` to GitHub (`main`).
6. Inform the user of the newly scanned stocks.
