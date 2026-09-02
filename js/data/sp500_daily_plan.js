window.sp500DailyPlanData = [
  { "source": "SP500-AI", "price": "7635.63-7651.63", "bias": "neutral", "behavior": "[07:15] Live Intraday Chop / No-Trade Zone. 50% Equilibrium box; stay flat to avoid rotational whipsaws.", "tp": "na", "sl": "na", "status": "na" },
  { "source": "SP500-AI", "price": "7658.63", "bias": "bullish", "behavior": "[07:15] High-Momentum BSL Breakout Trigger. Sustained 5m close above 7658.63 targets 7771.48 and 7698.63.", "tp": "7771.48", "sl": "7648.63", "status": "na" },
  { "source": "SP500-AI", "price": "7771.48", "bias": "bearish", "behavior": "[07:15] Overhead Supply OB / PDH Liquidity Ceiling. Watch for SFP sweep rejection.", "tp": "7658.63", "sl": "7781.48", "status": "na" },
  { "source": "SP500-AI", "price": "7628.63", "bias": "bearish", "behavior": "[07:15] Downside Long-Liquidation Cascade Trigger. Sustained 5m close below 7628.63 targets 7611.20 and 7588.63.", "tp": "7611.20", "sl": "7638.63", "status": "na" },
  { "source": "SP500-AI", "price": "7611.20", "bias": "bullish", "behavior": "[07:15] Demand OB Floor & SSL Sweep Zone. Look for lower-wick rejection absorption.", "tp": "7628.63", "sl": "7601.20", "status": "na" }
];

window.sp500DailyPlanSummary = [
  {
    "source": "SP500-AI",
    "text": `================================================================================
🎯 S&P 500 DAILY MARKET BIAS & OUTLOOK
================================================================================
• Daily Market Bias: ⚪ NEUTRAL | Bias Score: -0.5 / +6.0 | Confidence: Neutral (Chop)
• Bias Invalidation Floor: 7631.47 (A 15M close above 7631.47 invalidates bias)

📍 Tactical Directives:
• Primary Outlook: Rotational Range Chop. S&P 500 is consolidating within 50% equilibrium.
• Execution: Avoid breakout chasing inside opening range box. Play mean-reversion edge fades at Asian/London High/Low boundaries.

S&P 500 Spot: 7643.63 (07:15 PM IST - Sep 02, 2026) Trigger: 15m Watchdog

1. Market Structure & Macro Synthesis:
- S&P 500 Spot (^GSPC) is trading at 7643.63 (ES Futures: 7649.25 | NQ Futures: 29076.75).
- Market Structure: Operating in Discount Zone (Look for Longs) (Equilibrium: 7691.34 | 48H Swing Range: 7611.20 – 7771.48).
- Intermarket Drivers: VIX at 16.09 (Moderate Volatility (Balanced)) | DXY at 99.61 (Macro Headwind (Bearish for Equities)) | 10Y Yield at 4.79%.
- US Macro News Guard: ⚠️ MARKET NEWS: Stock market today: Dow closes above 52,000 for first time, S&P 500 and Nasdaq rally as tech gains

2. SMC & Session Liquidity Confluence:
- Buy-Side Liquidity (BSL): Clustered above PDH (7771.48), Asian High (7632.60), and London High (7668.63).
- Sell-Side Liquidity (SSL): Concentrated below PDL (7611.20), Asian Low (7611.20), and London Low (7618.63).
- Active FVGs / OBs: 3 Active FVG(s) & 2 Order Block(s) identified in immediate proximity.
- Session Sweep Status: Above Asian High ($7632.6)

3. Live Chop Zone / No-Trade Zone:
- Range: 7635.63 – 7651.63 Index Points.
- Context: Price is consolidating near local equilibrium. Avoid taking unconfirmed entries inside this 16.0-point compression box.

4. High Momentum / Explosive Zones:
- Upside Short-Covering Squeeze (> 7658.63): Sustained 5m close above 7658.63 clears local supply, targeting 7771.48 and 7698.63.
- Downside Long-Liquidation Cascade (< 7628.63): Sustained 5m close below 7628.63 triggers stop cascades accelerating toward 7611.20 and 7588.63.

5. 5-Min / 15-Min Action Plan & Index Triggers (Direct Index Trading):
- BUY Setup 1 (Demand Floor SSL Sweep Reversal Long - SFP / Turtle Soup): Sweep below 7611.20 rejected with lower wick, followed by 5m close back ABOVE 7616.20. TP: 7658.63 / 7771.48. SL: 7601.20. Risk-Reward: ~1:2.5.
- BUY Setup 2 (High-Momentum Breakout Long): Sustained 5m/15m close ABOVE 7658.63 with volume confirmation. TP: 7771.48 / 7698.63. SL: 7648.63. Risk-Reward: ~1:3.
- SELL Setup 1 (Supply OB / PDH Sweep Reversal Short): Rejection at 7771.48 with upper wick, closing 5m candle back BELOW 7766.48. TP: 7658.63 / 7628.63. SL: 7781.48. Risk-Reward: ~1:2.5.
- SELL Setup 2 (Demand Floor Breakdown Continuation Short): Sustained 5m close BELOW 7628.63. TP: 7611.20 / 7588.63. SL: 7638.63. Risk-Reward: ~1:3.`
  }
];
