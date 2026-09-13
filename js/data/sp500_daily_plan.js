window.sp500DailyPlanData = [
{
    "source": "SP500-AI",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "price": "5418.50-5434.50",
    "bias": "neutral",
    "behavior": "[MON 00:00] Live Intraday Chop / No-Trade Zone. 50% Equilibrium box; stay flat to avoid rotational whipsaws.",
    "tp": "na",
    "sl": "na",
    "status": "na"
  },
  {
    "source": "SP500-AI",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "price": "5441.50",
    "bias": "bullish",
    "behavior": "[MON 00:00] [SP_B2] High-Momentum BSL Breakout Trigger: Sustained 5m close above 5441.50 targets nan and 5481.50.",
    "tp": "nan",
    "sl": "5431.50",
    "status": "na"
  },
  {
    "source": "SP500-AI",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "price": "nan",
    "bias": "bearish",
    "behavior": "[MON 00:00] [SP_S1] Overhead Supply OB / PDH Liquidity Ceiling: Watch for SFP sweep rejection.",
    "tp": "5441.50",
    "sl": "nan",
    "status": "na"
  },
  {
    "source": "SP500-AI",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "price": "5411.50",
    "bias": "bearish",
    "behavior": "[MON 00:00] [SP_S2] Downside Long-Liquidation Cascade Trigger: Sustained 5m close below 5411.50 targets nan and 5371.50.",
    "tp": "nan",
    "sl": "5421.50",
    "status": "na"
  },
  {
    "source": "SP500-AI",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "price": "nan",
    "bias": "bullish",
    "behavior": "[MON 00:00] [SP_B1] Demand OB Floor & SSL Sweep Zone: Look for lower-wick rejection absorption.",
    "tp": "5411.50",
    "sl": "nan",
    "status": "na"
  }
];

window.sp500DailyPlanSummary = [
{
    "id": "SP500_20260914_000045",
    "timestamp": "2026-09-14T00:00:45+05:30",
    "timeDisplay": "12:00 AM, Sep 14",
    "spot": "5426.50",
    "trigger": "Level Exhaustion Breakdown (SP500 Spot $5426.50 < Min Plan Target $7580.06 - Buffer $5.00",
    "source": "SP500-AI",
    "text": "================================================================================\n🎯 S&P 500 DAILY MARKET BIAS & OUTLOOK\n================================================================================\n• Daily Market Bias: ⚪ NEUTRAL | Bias Score: +1.0 / +6.0 | Confidence: Neutral (Chop)\n• Bias Invalidation Floor: 7591.70 (A 15M close above 7591.70 invalidates bias)\n\n📍 Tactical Directives:\n• Primary Outlook: Rotational Range Chop. S&P 500 is consolidating within 50% equilibrium.\n• Execution: Avoid breakout chasing inside opening range box. Play mean-reversion edge fades at Asian/London High/Low boundaries.\n\nS&P 500 Spot: 5426.50 (12:00 AM IST - Sep 14, 2026) Trigger: Level Exhaustion Breakdown (SP500 Spot $5426.50 < Min Plan Target $7580.06 - Buffer $5.00)\n\n1. Market Structure & Macro Synthesis:\n- S&P 500 Spot (^GSPC) is trading at 5426.50 (ES Futures: 7659.5 | NQ Futures: 29387.0).\n- Market Structure: Operating in Discount Zone (Look for Longs) (Equilibrium: 5426.50 | 48H Swing Range: 5418.00 – 5435.00).\n- Intermarket Drivers: VIX at 15.84 (Moderate Volatility (Balanced)) | DXY at 99.10 (Macro Tailwind (Bullish for Equities)) | 10Y Yield at 4.97%.\n- US Macro News Guard: 🔴 HIGH IMPACT NEWS: Dow Jones Futures: Fed Meeting Ahead; Anthropic's Amodei, OpenAI's Altman, SpaceX's Musk Call For AI Slowdown\n\n2. SMC & Session Liquidity Confluence:\n- Buy-Side Liquidity (BSL): Clustered above PDH (nan), Asian High (5446.50), and London High (5430.00).\n- Sell-Side Liquidity (SSL): Concentrated below PDL (nan), Asian Low (5406.50), and London Low (5418.00).\n- Active FVGs / OBs: 0 Active FVG(s) & 0 Order Block(s) identified in immediate proximity.\n- Session Sweep Status: Inside Prior Session Range\n\n3. Live Chop Zone / No-Trade Zone:\n- Range: 5418.50 – 5434.50 Index Points.\n- Context: Price is consolidating near local equilibrium. Avoid taking unconfirmed entries inside this 16.0-point compression box.\n\n4. High Momentum / Explosive Zones:\n- Upside Short-Covering Squeeze (> 5441.50): Sustained 5m close above 5441.50 clears local supply, targeting nan and 5481.50.\n- Downside Long-Liquidation Cascade (< 5411.50): Sustained 5m close below 5411.50 triggers stop cascades accelerating toward nan and 5371.50.\n\n5. 5-Min / 15-Min Action Plan & Index Triggers (Direct Index Trading):\n\n| Setup ID | Strategy / Bias | Trigger Level | Confirmation Price Action | Take Profit (TP) | Stop Loss (SL) | Risk:Reward |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| **[SP_B1]** | 🟢 **Long (Demand Floor SSL Sweep)** | **nan** Reclaim | Sweep below nan rejected with lower wick, followed by 5m close back ABOVE nan | **TP1:** 5441.50<br>**TP2:** nan | **nan** | 1:2.5 |\n| **[SP_B2]** | 🟢 **Long (High-Momentum Breakout)** | **5441.50** Breakout | Sustained 5m/15m candle close ABOVE 5441.50 with volume confirmation | **TP1:** nan<br>**TP2:** 5481.50 | **5431.50** | 1:3.0 |\n| **[SP_S1]** | 🔴 **Short (Supply OB / PDH Rejection)** | **nan** Rejection | Rejection at nan with upper wick, closing 5m candle back BELOW nan | **TP1:** 5441.50<br>**TP2:** 5411.50 | **nan** | 1:2.5 |\n| **[SP_S2]** | 🔴 **Short (Demand Floor Breakdown)** | **5411.50** Breakdown | Sustained 5m close BELOW 5411.50 with institutional sell displacement | **TP1:** nan<br>**TP2:** 5371.50 | **5421.50** | 1:3.0 |"
  }
];
