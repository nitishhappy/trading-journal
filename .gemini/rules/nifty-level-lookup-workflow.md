---
name: nifty-level-lookup-workflow
description: Defines the single-command automation workflow when the user requests a Nifty level lookup.
---

# Nifty Level Lookup Workflow

When the user asks to find when a specific Nifty price/level occurred (e.g. "Find when nifty 24620 occurred" or "When did 24600 last happen?"):

1. **Execute Strictly ONE Single Command**:
   Run the unified utility script:
   `python C:\Nitish\ClaudeApps\Utilities\nifty_level_lookup.py <LEVEL> <TOLERANCE>`
   *(Default tolerance is 5 if not specified by user)*

2. **No Ad-Hoc / Multiple Commands**:
   Do NOT run multiple exploratory or follow-up terminal commands. The script handles Upstox sync, database querying, CSV scanning, and formatting in a single run.

3. **Present Results Directly**:
   Output the formatted table with the datetime, relative time ago, candle OHLC, and TradingView chart links.
