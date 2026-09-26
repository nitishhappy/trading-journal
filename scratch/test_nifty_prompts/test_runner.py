import sys
import subprocess
from pathlib import Path
from datetime import datetime

SCRATCH_DIR = Path(r"C:\Nitish\ClaudeApps\trading-journal\scratch\test_nifty_prompts")
RUN_AGY = Path(r"C:\Nitish\ClaudeApps\Utilities\common_ai_ticker_utilities\run_agy_prompt.py")

# Market parameters from latest Friday close
SpotPrice = "23040.50"
DayHigh = "23121.60"
DayLow = "23020.95"
ORBLow = "23030.00"
ORBHigh = "23116.65"
FutVolRatio = "1.0"
TriggerReason = "Isolated Benchmark Prompt Calibration Test"

now_dt = datetime.now()
timeFormatted = now_dt.strftime("%I:%M %p IST")
fullDateStr = now_dt.strftime("%b %d, %Y")

# 1. AS-IS PROMPT (Exact replica of intraday_briefing.ps1)
prompt_as_is = f"""Generate an Intraday Tactical Update for NIFTY based on the live chart.

**LIVE SPOT MARKET CONTEXT (UPSTOX SPOT INDEX: NSE:NIFTY):**
- Current Spot Price: {SpotPrice}
- Day High: {DayHigh} | Day Low: {DayLow}
- 15M ORB Range: {ORBLow} - {ORBHigh}
- Nifty Future Volume Ratio: {FutVolRatio} x 8-bar avg (Proxied from active Nifty Future)

**CRITICAL PRICE VS VOLUME DESIGN RULES:**
1. **PRICES MUST BE 100% SPOT INDEX (`NSE:NIFTY`):** All levels, strike selection, ORB boundaries, Day High/Low, Chop Zones, Entry Triggers, Stop Losses, and Targets MUST strictly be based on the NIFTY SPOT INDEX. NEVER use Nifty Futures (`NIFTY_F`) or GIFT NIFTY prices for any strike selection or price level.
2. **VOLUME IS PROXIED FROM NIFTY FUTURES:** Spot index has no traded volume, so institutional volume activity ({FutVolRatio} x) is proxied from the active Nifty Future contract.
3. DO NOT output the full 8-point morning briefing. Cut the macro fluff.
4. Output ONLY points 3, 4, and 5 from the standard morning plan (Live Intraday Chop Zone / No-Trade Zone, High Momentum / Explosive Zones, and 5-Min Intraday Action Plan). DO NOT output points 1 and 2 (Market Structure or Key Levels).
5. The Markdown heading MUST include Spot Price, Time of Run, and Trigger Reason:
   `# ⚡ NIFTY 50 Intraday Tactical Update ({timeFormatted} - {fullDateStr} | Spot: {SpotPrice} | Trigger: {TriggerReason})`
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
   Every level in the `levels` array MUST include a compact `setup` code matching Section 5 (`B1`, `B2`, `S1`, `S2`), prefix `logic` with `[B1]`, `[B2]`, `[S1]`, or `[S2]`, AND include `"spread"` field:
   Example format:
   ```json:app-data
   {{
     "bias": "⚪ NEUTRAL",
     "summary": "Full text of the summary here...",
     "levels": [
       {{
         "price": 23070,
         "setup": "B1",
         "type": "VWAP Reclaim Long",
         "logic": "[B1] Absorption probe holding above Day Low followed by 5m close back above 23,070",
         "bias": "bullish",
         "tp": "23,115.00 / 23,145.00",
         "sl": "23,020.00",
         "spread": "Buy 23,050 CE + Sell 23,100 CE (Next Wk) | R:R: ~1.75 | Risk: ~8.0% | TP1: +19.6% | TP2: +35.2%"
       }}
     ]
   }}
   ```
"""

# 2. TO-BE PROMPT (Adding Key Trading Levels Summary Table modeled on Bitcoin & S&P 500)
prompt_to_be = f"""Generate an Intraday Tactical Update for NIFTY based on the live chart.

**LIVE SPOT MARKET CONTEXT (UPSTOX SPOT INDEX: NSE:NIFTY):**
- Current Spot Price: {SpotPrice}
- Day High: {DayHigh} | Day Low: {DayLow}
- 15M ORB Range: {ORBLow} - {ORBHigh}
- Nifty Future Volume Ratio: {FutVolRatio} x 8-bar avg (Proxied from active Nifty Future)

**CRITICAL PRICE VS VOLUME DESIGN RULES:**
1. **PRICES MUST BE 100% SPOT INDEX (`NSE:NIFTY`):** All levels, strike selection, ORB boundaries, Day High/Low, Chop Zones, Entry Triggers, Stop Losses, and Targets MUST strictly be based on the NIFTY SPOT INDEX. NEVER use Nifty Futures (`NIFTY_F`) or GIFT NIFTY prices for any strike selection or price level.
2. **VOLUME IS PROXIED FROM NIFTY FUTURES:** Spot index has no traded volume, so institutional volume activity ({FutVolRatio} x) is proxied from the active Nifty Future contract.
3. DO NOT output the full 8-point morning briefing. Cut the macro fluff.
4. Output ONLY points 3, 4, and 5 from the standard morning plan (Live Intraday Chop Zone / No-Trade Zone, High Momentum / Explosive Zones, and 5-Min Intraday Action Plan), followed by the Key Trading Levels Summary table.
5. The Markdown heading MUST include Spot Price, Time of Run, and Trigger Reason:
   `# ⚡ NIFTY 50 Intraday Tactical Update ({timeFormatted} - {fullDateStr} | Spot: {SpotPrice} | Trigger: {TriggerReason})`
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
   Include BOTH the 4 action plan setups (`B1`, `B2`, `S1`, `S2`) AND the 6 key trading levels (`KB1`-`KB4`, `KS1`-`KS2`) in the `levels` array. Prefix `logic` with the corresponding tag. For `B1`-`S2`, include the `"spread"` field:
   Example format:
   ```json:app-data
   {{
     "bias": "⚪ NEUTRAL",
     "summary": "Full text of the summary here...",
     "levels": [
       {{
         "price": 23070,
         "setup": "B1",
         "type": "VWAP Reclaim Long",
         "logic": "[B1] Absorption probe holding above Day Low followed by 5m close back above 23,070",
         "bias": "bullish",
         "tp": "23,115.00 / 23,145.00",
         "sl": "23,020.00",
         "spread": "Buy 23,050 CE + Sell 23,100 CE (Next Wk) | R:R: ~1.75 | Risk: ~8.0% | TP1: +19.6% | TP2: +35.2%"
       }},
       {{
         "price": 23020,
         "setup": "KB2",
         "type": "Support / Day Low",
         "logic": "[KB2] 15M ORB Low & Put defense shelf",
         "bias": "bullish",
         "tp": "23,070.00 / 23,115.00",
         "sl": "22,980.00"
       }}
     ]
   }}
   ```
"""

prompt_as_is_file = SCRATCH_DIR / "prompt_as_is.txt"
prompt_to_be_file = SCRATCH_DIR / "prompt_to_be.txt"
out_as_is_file = SCRATCH_DIR / "output_as_is.md"
out_to_be_file = SCRATCH_DIR / "output_to_be.md"

prompt_as_is_file.write_text(prompt_as_is, encoding="utf-8")
prompt_to_be_file.write_text(prompt_to_be, encoding="utf-8")
print(f"Created prompt files in: {SCRATCH_DIR}")

mode = sys.argv[1] if len(sys.argv) > 1 else "all"

if mode in ("as_is", "all"):
    print("\n[TEST 1] Running AI with AS-IS prompt...")
    subprocess.run(["python", str(RUN_AGY), str(prompt_as_is_file), str(out_as_is_file)], check=True)
    print(f"AS-IS output saved to: {out_as_is_file}")

if mode in ("to_be", "all"):
    print("\n[TEST 2] Running AI with TO-BE prompt...")
    subprocess.run(["python", str(RUN_AGY), str(prompt_to_be_file), str(out_to_be_file)], check=True)
    print(f"TO-BE output saved to: {out_to_be_file}")

print("\nAll isolated test runs complete!")
