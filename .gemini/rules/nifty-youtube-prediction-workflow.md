---
name: nifty-youtube-prediction-workflow
description: Automates downloading, transcribing, and extracting Nifty predictions & key levels from YouTube analysis videos into the Daily Trade Plan.
---

# Nifty YouTube Prediction Workflow

When the user provides a YouTube URL with a prompt like **"Nifty Prediction [URL]"**, **"Daily Plan [URL]"**, **"Analyze Prediction [URL]"**, or simply pastes a YouTube video link related to market analysis/predictions:

You must act as the automated orchestrator and execute the local extraction scripts, analyze the transcript, update the Daily Trade Plan data, and commit/push to GitHub.

---

## Workflow Triggers

Any of the following prompts should trigger this workflow:
- `Nifty Prediction <YouTube URL>`
- `Daily Plan <YouTube URL>`
- `Analyze Prediction <YouTube URL>`
- `<YouTube URL>` (when context is Nifty/BankNifty analysis)

---

## Step-by-Step Execution Workflow

### 1. Execute Transcript & Video Fetch Script
Run the dedicated fetch utility:
```bash
python "C:\Nitish\ClaudeApps\Utilities\Nifty Predictions\fetch_youtube_data.py" "<YOUTUBE_URL>"
```
*Outputs generated:*
- Transcript: `C:\Users\chawl\Downloads\Nifty Predictions\YYYY-MM-DD nifty pred trans.txt`
- Video: `C:\Users\chawl\Downloads\Nifty Predictions\YYYY-MM-DD nifty pred video.mp4`

### 2. Read & Analyze Transcript
1. Use `view_file` to read the generated transcript text file (`C:\Users\chawl\Downloads\Nifty Predictions\YYYY-MM-DD nifty pred trans.txt`).
2. Synthesize the analyst's complete breakdown:
   - **Key Price Zones / Levels**: Resistance, support, buy-on-dip zones, breakout trigger lines, and trend invalidation levels.
   - **Elliott Wave / Technical Structure**: Wave counts, Fibonacci retracements/extensions (e.g. 61.8%, 127%, 161.8%), EMA levels.
   - **Bullish / Bearish Scenarios**: Target points (TP), stop loss levels (SL), and actionable trading behavior.
   - **Bank Nifty Levels**: If covered in the video, extract relevant key zones.

### 3. Update Daily Trade Plan
1. Structure the extracted levels into clean JSON objects following the `window.dailyPlanData` schema:
   ```javascript
   {
     "price": "24650 - 24700",
     "bias": "bullish" | "bearish",
     "behavior": "Detailed description of behavior, trigger condition, and action.",
     "tp": "Target price range",
     "sl": "Stop loss or invalidation condition"
   }
   ```
2. Write the updated data directly to `C:\Nitish\ClaudeApps\trading-journal\js\data\daily_plan.js`.
3. Check and update `README.md` if necessary to follow the `update-readme-before-push` rule.

### 4. Commit and Push
Execute:
```bash
git -C "C:\Nitish\ClaudeApps\trading-journal" add js/data/daily_plan.js README.md
git -C "C:\Nitish\ClaudeApps\trading-journal" commit -m "Update Nifty levels and predictions for <DATE> from YouTube analysis"
git -C "C:\Nitish\ClaudeApps\trading-journal" push origin main
```

### 5. Present Results
Present a clear, structured summary to the user:
- Analyst's Core Market Bias (Bullish / Bearish / Rangebound).
- Key Scenarios with formatted table (Zone, Bias, Trade Setup / Behavior, TP, SL).
- Confirmation that `daily_plan.js` has been updated and pushed live.
