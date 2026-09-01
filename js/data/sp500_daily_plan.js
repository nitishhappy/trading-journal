window.sp500DailyPlanData = [
  { "source": "SP500-AI", "price": "7678.14-7694.14", "bias": "neutral", "behavior": "[04:57] Live Intraday Chop / No-Trade Zone. 50% Equilibrium box; stay flat to avoid rotational whipsaws.", "tp": "na", "sl": "na", "status": "na" },
  { "source": "SP500-AI", "price": "7701.14", "bias": "bullish", "behavior": "[04:57] High-Momentum BSL Breakout Trigger. Sustained 5m close above 7701.14 targets 7771.48 and 7741.14.", "tp": "7771.48", "sl": "7691.14", "status": "na" },
  { "source": "SP500-AI", "price": "7771.48", "bias": "bearish", "behavior": "[04:57] Overhead Supply OB / PDH Liquidity Ceiling. Watch for SFP sweep rejection.", "tp": "7701.14", "sl": "7781.48", "status": "na" },
  { "source": "SP500-AI", "price": "7671.14", "bias": "bearish", "behavior": "[04:57] Downside Long-Liquidation Cascade Trigger. Sustained 5m close below 7671.14 targets 7650.92 and 7631.14.", "tp": "7650.92", "sl": "7681.14", "status": "na" },
  { "source": "SP500-AI", "price": "7650.92", "bias": "bullish", "behavior": "[04:57] Demand OB Floor & SSL Sweep Zone. Look for lower-wick rejection absorption.", "tp": "7671.14", "sl": "7640.92", "status": "na" }
];

window.sp500DailyPlanSummary = [];


window.sp500DailyPlanSummary = [
  {
    "source": "SP500-AI",
    "text": `# S&P 500 (^GSPC) Pure AI Tactical Briefing

\`\`\`markdown
================================================================================
🎯 S&P 500 DAILY MARKET BIAS & OUTLOOK
================================================================================
• Daily Market Bias: ⚪ NEUTRAL | Bias Score: -1.0 / +6.0 | Confidence: Neutral (Chop)
• Bias Invalidation Floor: 7730.99 (A 15M close above 7730.99 invalidates bias)

📍 Tactical Directives:
• Primary Outlook: Rotational Range Chop. S&P 500 is consolidating within 50% equilibrium.
• Execution: Avoid breakout chasing inside opening range box. Play mean-reversion edge fades at Asian/London High/Low boundaries.

S&P 500 Spot: 7686.14 (12:42 PM IST - Sep 01, 2026) Trigger: US Market Watchdog

1. Market Structure & Macro Synthesis:
- S&P 500 Spot (^GSPC) is trading at 7686.14 (ES Futures: 7703.25 | NQ Futures: 29546.75).
- Market Structure: Operating in Discount Zone (Look for Longs) (Equilibrium: 7704.82 | 48H Swing Range: 7638.17 – 7771.48).
- Intermarket Drivers: VIX at 14.92 (Moderate Volatility (Balanced)) | DXY at 99.50 (Macro Tailwind (Bullish for Equities)) | 10Y Yield at 4.76%.
- US Macro News Guard: ⚠️ MARKET NEWS: Stock market today: Dow closes above 52,000 for first time, S&P 500 and Nasdaq rally as tech gains

2. SMC & Session Liquidity Confluence:
- Buy-Side Liquidity (BSL): Clustered above PDH (7771.48), Asian High (7696.33), and London High (7711.14).
- Sell-Side Liquidity (SSL): Concentrated below PDL (7650.92), Asian Low (7668.32), and London Low (7661.14).
- Active FVGs / OBs: 3 Active FVG(s) & 2 Order Block(s) identified in immediate proximity.
- Session Sweep Status: Inside Prior Session Range

3. Live Chop Zone / No-Trade Zone:
- Range: 7678.14 – 7694.14 Index Points.
- Context: Price is consolidating near local equilibrium. Avoid taking unconfirmed entries inside this 16.0-point compression box.

4. High Momentum / Explosive Zones:
- Upside Short-Covering Squeeze (> 7701.14): Sustained 5m close above 7701.14 clears local supply, targeting 7771.48 and 7741.14.
- Downside Long-Liquidation Cascade (< 7671.14): Sustained 5m close below 7671.14 triggers stop cascades accelerating toward 7650.92 and 7631.14.

5. 5-Min / 15-Min Action Plan & Index Triggers (Direct Index Trading):
- BUY Setup 1 (Demand Floor SSL Sweep Reversal Long - SFP / Turtle Soup): Sweep below 7650.92 rejected with lower wick, followed by 5m close back ABOVE 7655.92. TP: 7701.14 / 7771.48. SL: 7640.92. Risk-Reward: ~1:2.5.
- BUY Setup 2 (High-Momentum Breakout Long): Sustained 5m/15m close ABOVE 7701.14 with volume confirmation. TP: 7771.48 / 7741.14. SL: 7691.14. Risk-Reward: ~1:3.
- SELL Setup 1 (Supply OB / PDH Sweep Reversal Short): Rejection at 7771.48 with upper wick, closing 5m candle back BELOW 7766.48. TP: 7701.14 / 7671.14. SL: 7781.48. Risk-Reward: ~1:2.5.
- SELL Setup 2 (Demand Floor Breakdown Continuation Short): Sustained 5m close BELOW 7671.14. TP: 7650.92 / 7631.14. SL: 7681.14. Risk-Reward: ~1:3.
\`\`\``
  }
];
