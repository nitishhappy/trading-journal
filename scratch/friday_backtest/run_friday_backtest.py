import os
import sys
import json
import re
import subprocess
from pathlib import Path

SCRATCH_DIR = Path(r"C:\Nitish\ClaudeApps\trading-journal\scratch\friday_backtest")
RUN_AGY = Path(r"C:\Nitish\ClaudeApps\Utilities\common_ai_ticker_utilities\run_agy_prompt.py")

# Historical Snapshots from Friday Sep 25, 2026
SNAPSHOTS = {
    "1034": {
        "timeFormatted": "10:34 AM IST",
        "fullDateStr": "Sep 25, 2026",
        "SpotPrice": "23084.55",
        "DayHigh": "23121.60",
        "DayLow": "23030.00",
        "ORBLow": "23030.00",
        "ORBHigh": "23116.65",
        "FutVolRatio": "1.0",
        "TriggerReason": "Scheduled 10:30 AM Update (True Intraday Option Chain Mapping)"
    },
    "1332": {
        "timeFormatted": "01:32 PM IST",
        "fullDateStr": "Sep 25, 2026",
        "SpotPrice": "23040.50",
        "DayHigh": "23121.60",
        "DayLow": "23020.95",
        "ORBLow": "23030.00",
        "ORBHigh": "23116.65",
        "FutVolRatio": "1.0",
        "TriggerReason": "Scheduled 01:30 PM Update (Pre-Closing Breakout Mapping)"
    }
}

def build_prompt_as_is(ctx):
    return f"""Generate an Intraday Tactical Update for NIFTY based on the live chart.

**LIVE SPOT MARKET CONTEXT (UPSTOX SPOT INDEX: NSE:NIFTY):**
- Current Spot Price: {ctx['SpotPrice']}
- Day High: {ctx['DayHigh']} | Day Low: {ctx['DayLow']}
- 15M ORB Range: {ctx['ORBLow']} - {ctx['ORBHigh']}
- Nifty Future Volume Ratio: {ctx['FutVolRatio']} x 8-bar avg (Proxied from active Nifty Future)

**CRITICAL PRICE VS VOLUME DESIGN RULES:**
1. **PRICES MUST BE 100% SPOT INDEX (`NSE:NIFTY`):** All levels, strike selection, ORB boundaries, Day High/Low, Chop Zones, Entry Triggers, Stop Losses, and Targets MUST strictly be based on the NIFTY SPOT INDEX. NEVER use Nifty Futures (`NIFTY_F`) or GIFT NIFTY prices for any strike selection or price level.
2. **VOLUME IS PROXIED FROM NIFTY FUTURES:** Spot index has no traded volume, so institutional volume activity ({ctx['FutVolRatio']} x) is proxied from the active Nifty Future contract.
3. DO NOT output the full 8-point morning briefing. Cut the macro fluff.
4. Output ONLY points 3, 4, and 5 from the standard morning plan (Live Intraday Chop Zone / No-Trade Zone, High Momentum / Explosive Zones, and 5-Min Intraday Action Plan). DO NOT output points 1 and 2 (Market Structure or Key Levels).
5. The Markdown heading MUST include Spot Price, Time of Run, and Trigger Reason:
   `# ⚡ NIFTY 50 Intraday Tactical Update ({ctx['timeFormatted']} - {ctx['fullDateStr']} | Spot: {ctx['SpotPrice']} | Trigger: {ctx['TriggerReason']})`
6. The update must include:
   - Live Intraday Chop Zone / No-Trade Zone (re-calculated based on current SPOT price action).
   - High Momentum / Explosive Zones (re-calculated in SPOT points).
   - Exact 5-min BUY/SELL confirmation triggers (in SPOT points).

   **CRITICAL FORMATTING RULES FOR SECTIONS (UI TABLE PARSING):**
   - You MUST output the sections with exact numbered headers like `3. Live Chop Zone / No-Trade Zone:`, `4. High Momentum / Explosive Zones:`, and `5. 5-Min / 15-Min Action Plan:` (No Markdown # or ##, use trailing colons).
   - All bullet points MUST strictly start with a hyphen `- ` (do NOT use `*` or emojis at the start).
   - For Section 4 (Momentum), format as: `- [Scenario Type] ([Condition]): [Details]`
   - For Section 5 (Action Plan), format each bullet strictly starting with its compact setup code, including Naked TP/SL AND explicit 50-pt Next Week Option Spread recommendation with R:R and profit targets:
     - `[B1] BUY Setup 1 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] CE + Sell [Strike+50] CE (Next Wk) | R:R: ~1.75 | Risk: ~8.0% | TP1: +19.6% | TP2: +35.2%.`
     - `[B2] BUY Setup 2 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] CE + Sell [Strike+50] CE (Next Wk) | R:R: ~2.50 | Risk: ~7.8% | TP1: +19.6% | TP2: +35.2%.`
     - `[S1] SELL Setup 1 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] PE + Sell [Strike-50] PE (Next Wk) | R:R: ~0.88 | Risk: ~9.3% | TP1: +12.5% | TP2: +25.0%.`
     - `[S2] SELL Setup 2 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] PE + Sell [Strike-50] PE (Next Wk) | R:R: ~2.33 | Risk: ~8.2% | TP1: +19.1% | TP2: +34.5%.`
     Every setup in Section 5 MUST strictly start with `[B1]`, `[B2]`, `[S1]`, or `[S2]`.
7. **OUTPUT BOUNDARY RULE (STRICT):**
   Your markdown output MUST end immediately after the ````json:app-data```` block. DO NOT include any operational status sections.
8. **MANDATORY JSON DATA BLOCK CONTRACT (SECTION 5 TRACEABILITY):** 
   The system uses Python scripts to sync your output to the Trading Journal PWA. At the very bottom of this markdown output, you MUST append a raw JSON block wrapped in ````json:app-data ... ````.
   Every level in the `levels` array MUST include a compact `setup` code matching Section 5 (`B1`, `B2`, `S1`, `S2`), prefix `logic` with `[B1]`, `[B2]`, `[S1]`, or `[S2]`, AND include `"spread"` field.
"""

def build_prompt_to_be(ctx):
    return f"""Generate an Intraday Tactical Update for NIFTY based on the live chart.

**LIVE SPOT MARKET CONTEXT (UPSTOX SPOT INDEX: NSE:NIFTY):**
- Current Spot Price: {ctx['SpotPrice']}
- Day High: {ctx['DayHigh']} | Day Low: {ctx['DayLow']}
- 15M ORB Range: {ctx['ORBLow']} - {ctx['ORBHigh']}
- Nifty Future Volume Ratio: {ctx['FutVolRatio']} x 8-bar avg (Proxied from active Nifty Future)

**CRITICAL PRICE VS VOLUME DESIGN RULES:**
1. **PRICES MUST BE 100% SPOT INDEX (`NSE:NIFTY`):** All levels, strike selection, ORB boundaries, Day High/Low, Chop Zones, Entry Triggers, Stop Losses, and Targets MUST strictly be based on the NIFTY SPOT INDEX. NEVER use Nifty Futures (`NIFTY_F`) or GIFT NIFTY prices for any strike selection or price level.
2. **VOLUME IS PROXIED FROM NIFTY FUTURES:** Spot index has no traded volume, so institutional volume activity ({ctx['FutVolRatio']} x) is proxied from the active Nifty Future contract.
3. DO NOT output the full 8-point morning briefing. Cut the macro fluff.
4. Output ONLY points 3, 4, and 5 from the standard morning plan (Live Intraday Chop Zone / No-Trade Zone, High Momentum / Explosive Zones, and 5-Min Intraday Action Plan), followed by the Key Trading Levels Summary table.
5. The Markdown heading MUST include Spot Price, Time of Run, and Trigger Reason:
   `# ⚡ NIFTY 50 Intraday Tactical Update ({ctx['timeFormatted']} - {ctx['fullDateStr']} | Spot: {ctx['SpotPrice']} | Trigger: {ctx['TriggerReason']})`
6. The update must include:
   - Live Intraday Chop Zone / No-Trade Zone (re-calculated based on current SPOT price action).
   - High Momentum / Explosive Zones (re-calculated in SPOT points).
   - Exact 5-min BUY/SELL confirmation triggers (in SPOT points).

   **CRITICAL FORMATTING RULES FOR SECTIONS (UI TABLE PARSING):**
   - You MUST output the sections with exact numbered headers like `3. Live Chop Zone / No-Trade Zone:`, `4. High Momentum / Explosive Zones:`, and `5. 5-Min / 15-Min Action Plan:` (No Markdown # or ##, use trailing colons).
   - All bullet points MUST strictly start with a hyphen `- ` (do NOT use `*` or emojis at the start).
   - For Section 4 (Momentum), format as: `- [Scenario Type] ([Condition]): [Details]`
   - For Section 5 (Action Plan), format each bullet strictly starting with its compact setup code, including Naked TP/SL AND explicit 50-pt Next Week Option Spread recommendation with R:R and profit targets:
     - `[B1] BUY Setup 1 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] CE + Sell [Strike+50] CE (Next Wk) | R:R: ~1.75 | Risk: ~8.0% | TP1: +19.6% | TP2: +35.2%.`
     - `[B2] BUY Setup 2 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] CE + Sell [Strike+50] CE (Next Wk) | R:R: ~2.50 | Risk: ~7.8% | TP1: +19.6% | TP2: +35.2%.`
     - `[S1] SELL Setup 1 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] PE + Sell [Strike-50] PE (Next Wk) | R:R: ~0.88 | Risk: ~9.3% | TP1: +12.5% | TP2: +25.0%.`
     - `[S2] SELL Setup 2 (Description): [Entry Condition]. | TP: [Targets] | SL: [Stop Loss] | 💡 Buy [Strike] PE + Sell [Strike-50] PE (Next Wk) | R:R: ~2.33 | Risk: ~8.2% | TP1: +19.1% | TP2: +34.5%.`
     Every setup in Section 5 MUST strictly start with `[B1]`, `[B2]`, `[S1]`, or `[S2]`.

7. **KEY TRADING LEVELS SUMMARY TABLE (MANDATORY):**
   After Section 5 (Action Plan) and before the json:app-data block, you MUST generate a `### Key Trading Levels Summary` markdown table. Each row MUST have a **unique** level tag:
   - **Key Buy Levels**:
     - `[KB1]`: Immediate dynamic support (VWAP / 15M EMA9 / ORB Midpoint)
     - `[KB2]`: Primary session support shelf (Day Low / 15M ORB Low)
     - `[KB3]`: Heavy Put writer accumulation floor (Key round strike defense)
     - `[KB4]`: Macro higher timeframe structural demand fortress
   - **Key Sell Levels**:
     - `[KS1]`: Immediate overhead resistance (Day High / 15M ORB High / Call Wall)
     - `[KS2]`: Structural breakdown floor below Day Low (liquidation trigger)
   These KB/KS tags are SEPARATE from the Section 5 action plan tags (B1/B2/S1/S2). Every row in the table MUST have a different tag. Do NOT reuse the same tag for multiple rows.
   Table columns: `| Level | Type | Setup | Logic / Significance | Take Profit (TP) | Stop Loss (SL) |`

8. **OUTPUT BOUNDARY RULE (STRICT):**
   Your markdown output MUST end immediately after the ````json:app-data```` block. DO NOT include any operational status sections.
9. **MANDATORY JSON DATA BLOCK CONTRACT:** 
   The system uses Python scripts to sync your output to the Trading Journal PWA. At the very bottom of this markdown output, you MUST append a raw JSON block wrapped in ````json:app-data ... ````.
   Include BOTH the 4 action plan setups (`B1`, `B2`, `S1`, `S2`) AND the 6 key trading levels (`KB1`-`KB4`, `KS1`-`KS2`) in the `levels` array. Prefix `logic` with the corresponding tag. For `B1`-`S2`, include the `"spread"` field.
"""

def execute_run(key, prompt_type):
    ctx = SNAPSHOTS[key]
    prompt_str = build_prompt_as_is(ctx) if prompt_type == "as_is" else build_prompt_to_be(ctx)
    p_file = SCRATCH_DIR / f"prompt_{key}_{prompt_type}.txt"
    o_file = SCRATCH_DIR / f"output_{key}_{prompt_type}.md"
    p_file.write_text(prompt_str, encoding="utf-8")
    print(f"[{key.upper()} - {prompt_type.upper()}] Running AI prompt via agy...")
    subprocess.run(["python", str(RUN_AGY), str(p_file), str(o_file)], check=True)
    print(f"[{key.upper()} - {prompt_type.upper()}] Output saved to: {o_file}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    runs = [
        ("1034", "as_is"),
        ("1034", "to_be"),
        ("1332", "as_is"),
        ("1332", "to_be")
    ]
    for key, p_type in runs:
        if target == "all" or target == f"{key}_{p_type}":
            execute_run(key, p_type)
