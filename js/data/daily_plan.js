window.dailyPlanSummary = [
  { source: 'Combined', text: `Summary for August 18 (SMU & BT):

Data Bias: Market volatility is low (VIX around 11) and institutional bias leans slightly bearish to sideways.
Nifty Levels:
Make-or-Break / Resistance Zone: 24350–24400.
Buy Trigger: If 15-min candle closes above 24370 (Target: 24415).
Short Trigger: If price rejects from 24370 or breaks down below 24320–24325 (Targets: 24250, then 24136).
Liquidity & Extremes: There is a major liquidity sweep target upwards around 24470, and a downside inefficiency target at 24000.
Strategy: Wait to sell on rise near supply areas if market opens flat and drops. If a large gap-down occurs (~1%), do not short blindly; instead, watch for a bullish reversal towards the closing price since price will stray too far from SMA 50.` },
  { source: 'AI', text: `Pre-Market NIFTY Analysis & Trading Plan (Aug 18):

1. Market Structure & Sentiment:
• 5-day consecutive red streak — persistent distribution, but orderly without panic capitulation.
• Short-term structure: Bearish with lower highs & lower lows on 1H. No bullish CHoCH yet.
• GIFT Nifty at ~24,296 (-0.32%) indicating a gap-down open below yesterday's 24,287 close.

2. Key Nifty Levels:
• Major Resistance: 24,400 (heavy Call writing + prior day high zone; trend invalidation).
• Supply Zone / Gap-Fill: 24,350–24,370 (1H bearish Order Block; prime sell-on-rise area).
• Immediate Support: 24,250 (intraday pivot; sell-side liquidity resting below).
• Critical Support: 24,200–24,220 (breaking opens room to 24,000 structural support).
• Inefficiency Target: 24,000 (psychological round number + unfilled FVG below).

3. SMC / Price Action Perspective:
• Liquidity: Sell-side liquidity (SSL) below 24,250 & 24,200. Buy-side liquidity (BSL) above 24,370–24,400 equal highs.
• Order Blocks: Bearish OB at 24,350–24,370 (origin of 1H down-move). Bullish OB near 24,200–24,220.
• Premium/Discount: Currently in deep discount territory on weekly range — ripe for smart money accumulation if confirmed.

4. 5-Min Intraday Action Plan:
• BUY SETUP: Wait for opening sweep of 24,200–24,220 lows. If 5-min candle leaves long lower wick + 5-min CHoCH (close above first 15-min high) + bullish FVG, enter ATM CE targeting 24,350. SL below sweep low.
• SELL SETUP: If market rallies into 24,350–24,370 supply with a wick rejection or 5-min bearish engulfing, enter ATM PE targeting 24,250 → 24,200. SL above 24,400.
• NO-TRADE ZONE: 24,270–24,320 mid-range chop. Do NOT buy options here.

5. Risk Warning (Expiry Day):
• Today is Nifty Weekly Expiry. Low VIX (~11) means rapid theta decay after initial 30-min flush.
• If first 15-min range doesn't break by 10:00 AM IST, avoid holding options. Trade ONLY at key extremes (24,200 or 24,370).` }
];

window.dailyPlanData = [
  // --- TACTICAL RULES & STRATEGIES ---
  { "source": "MARKET", "price": "TACTICAL RULE: 12:00 PM Wrap Up & Expiry Avoidance", "bias": "neutral", "behavior": "Avoid trading current expiry index options after 12:00 PM IST due to CAS closing auction manipulation and volume drops. Wrap up index trades before noon or switch to next expiry / Crude Oil / Stock Options.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "DATA BIAS", "bias": "bearish", "behavior": "Retailers slightly bullish (put writing heavy). FII/Prop desks bearish. Overall institutional bias is downside/sideways.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "BT", "price": "TACTICAL RULE: VIX 11 & Low Volatility", "bias": "neutral", "behavior": "Market is soothing with less manipulation now. Low VIX means slower moves. Look for liquidity sweeps and supply/demand reactions.", "tp": "-", "sl": "-", "status": "na" },

  // --- SMU LEVELS (Aug 18) - Stock Market Unlimited ---
  { "source": "SMU", "price": "24350 - 24400", "bias": "neutral", "behavior": "Nifty Resistance zone with maximum call writing. PCR at 0.92 (bearish).", "tp": "-", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "24370", "bias": "bullish", "behavior": "Nifty Buy trigger. If 15-min candle closes above 24370, buying opportunity.", "tp": "24415", "sl": "24350", "status": "na" },
  { "source": "SMU", "price": "24320 - 24325", "bias": "bearish", "behavior": "Nifty Short trigger. If flat open and breaks below this zone, short. Or if rejected from 24370.", "tp": "24250", "sl": "24370", "status": "na" },
  { "source": "SMU", "price": "24250", "bias": "bearish", "behavior": "Nifty first downside target.", "tp": "24136", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "24136", "bias": "bearish", "behavior": "Nifty second downside target below 24250.", "tp": "-", "sl": "-", "status": "na" },


  // --- BT LEVELS (Aug 18) - The Bengal Trader ---
  { "source": "BT", "price": "24470", "bias": "neutral", "behavior": "Nifty major liquidity sweep area. Market may proceed here to grab liquidity if it breaks higher.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "BT", "price": "24000", "bias": "bearish", "behavior": "Nifty inefficiency target. Strong round number. Market can proceed here if it breaks down.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "BT", "price": "Sell on Rise", "bias": "bearish", "behavior": "If market opens flat and goes down, short near immediate supply areas.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "BT", "price": "Gap Down Buy", "bias": "bullish", "behavior": "If large gap down (1% ~250-300 pts), wait for bullish hammer/price action and buy towards PTC. Do not short blindly as price will be too far from SMA 50.", "tp": "-", "sl": "-", "status": "na" },

  // --- AI LEVELS (Aug 18) - Pre-Market Briefing ---
  { "source": "AI", "price": "24400", "bias": "bearish", "behavior": "Major resistance. Heavy call writing zone. Needs sustained break above for bullish reversal.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "AI", "price": "24350 - 24370", "bias": "bearish", "behavior": "Supply zone / gap-fill area. Bearish OB origin on 1H. Sell trigger if wick rejection or bearish engulfing here.", "tp": "24250", "sl": "24400", "status": "na" },
  { "source": "AI", "price": "24270 - 24320", "bias": "neutral", "behavior": "NO TRADE ZONE. Chop territory — avoid option buying in this range.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "AI", "price": "24250", "bias": "bearish", "behavior": "Immediate intraday support. SSL resting below. If broken, accelerates to 24,200.", "tp": "24200", "sl": "24320", "status": "na" },
  { "source": "AI", "price": "24200 - 24220", "bias": "bullish", "behavior": "Critical support & liquidity sweep target. If swept with a long wick + 5-min CHoCH above first 15-min high, BUY trigger.", "tp": "24350", "sl": "Below sweep low", "status": "na" },
  { "source": "AI", "price": "24000", "bias": "bearish", "behavior": "Major structural support. Round number + inefficiency target. Only reachable if 24,200 breaks cleanly.", "tp": "-", "sl": "-", "status": "na" }
];
