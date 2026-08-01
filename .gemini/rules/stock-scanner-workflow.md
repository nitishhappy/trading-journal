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
Once finished, inform the user that their journal has been updated with the latest Telegram stocks.

### 2. Telegram URL Provided
If the user provides a Telegram URL (e.g., "Stock Scanner https://t.me/..."):
1. Execute `python C:\Nitish\ClaudeApps\Utilities\stock_scanner.py "[URL]"`
2. Inform the user that the journal is updated.

### 3. Canva URL Provided
If the user provides a Canva URL:
1. Execute `node C:\Nitish\ClaudeApps\Utilities\scrape_canva.js "[URL]"`
2. Read the resulting `C:\Nitish\ClaudeApps\Utilities\extracted_slides.json` file.
3. Automatically parse the JSON using your internal intelligence to extract the stock names, summaries, and timeframes.
4. Programmatically inject these new stocks into `C:\Nitish\ClaudeApps\trading-journal\js\data\scanned_stocks.js` or write a Python script (like `update_canva.py`) to merge them, ensuring the "Sector" field is assigned based on the `COMMON_TICKERS` logic.
5. Inform the user that the Canva report has been fully extracted and synced.
