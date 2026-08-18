window.dailyPlanSummary = [
  { source: 'Combined', text: `Summary for August 18 (SMU & BT):

Data Bias: Market volatility is low (VIX around 11) and institutional bias leans slightly bearish to sideways.
Nifty Levels:
Make-or-Break / Resistance Zone: 24350–24400.
Buy Trigger: If 15-min candle closes above 24370 (Target: 24415).
Short Trigger: If price rejects from 24370 or breaks down below 24320–24325 (Targets: 24250, then 24136).
Liquidity & Extremes: There is a major liquidity sweep target upwards around 24470, and a downside inefficiency target at 24000.
Strategy: Wait to sell on rise near supply areas if market opens flat and drops. If a large gap-down occurs (~1%), do not short blindly; instead, watch for a bullish reversal towards the closing price since price will stray too far from SMA 50.` },
  { source: 'AI', text: `Pre-Market Briefing (Aug 18):

Sentiment: Risk-Off. US markets closed lower (S&P -0.5%, Dow -0.51%). 30-yr Treasury yield at 5.3% (highest since 2007). Asian markets negative.
GIFT Nifty: ~24,296 (-0.32%), signaling gap-down open. 5th consecutive red session.
Gold: $4,427 — strong safe-haven bid. Crude Brent at $91 — headwind for India.
Key Nifty Levels: Resistance 24,350-24,400 (supply zone). Support 24,200-24,220 (critical), 24,000 (structural).
Buy Confirmation: Sweep of 24,200-24,220 lows + 5-min CHoCH above first 15-min high.
Sell Confirmation: Rejection at 24,350-24,370 supply with bearish engulfing/wick.
No Trade Zone: 24,270-24,320 chop territory.
Risk: Weekly expiry day. VIX ~11 = slow grinding after opening flush. Do NOT hold options if first 15-min range doesn't break by 10 AM.` }
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
