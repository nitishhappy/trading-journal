window.dailyPlanSummary = [
  { source: 'AI', text: `Pre-Market NIFTY Analysis & Trading Plan (Aug 19):

1. Market Structure & Sentiment:
• 6-day consecutive red streak — persistent institutional distribution with benchmark closing near session lows at 24,154.90 (-132.75 pts).
• Short-term structure remains strictly bearish with lower highs & lower lows on 15M/1H charts below 20/50 EMAs. However, entering oversold/deep discount macro support.
• GIFT Nifty trading around 24,190–24,200, signaling a flat-to-mild positive opening (+35–45 pts).

2. Key Nifty Levels:
• Major Invalidation Resistance: 24,300–24,350 (Heavy CE writing & structural swing breakdown origin).
• Immediate Supply / Bearish POI: 24,220–24,250 (15M Bearish FVG & broken support turned resistance).
• Immediate Support: 24,100–24,136 (Prior swing consolidation shelf & intraday support).
• Macro Psychological Demand: 24,000 (Psychological round number & unfilled daily FVG).
• HTF Extreme Extensions: 24,500–24,650 (Upside) / 23,850–24,000 (Downside).

3. SMC / Price Action Perspective:
• Liquidity: Sell-side liquidity (SSL) resting below 24,100–24,136. Buy-side liquidity (BSL) resting above 24,250 and 24,350.
• Order Blocks: 1H Bearish OB at 24,220–24,250. 4H/Daily Bullish Demand OB at 24,000–24,050.
• Premium / Discount: Deep discount zone below 24,200 on the weekly swing. Avoid chasing fresh shorts at extreme lows without a premium retracement into supply.

4. 5-Min Intraday Action Plan:
• BUY SETUP (Liquidity Sweep Reversal): Wait for opening sweep of 24,100 lows into 24,050–24,080. If 5-min candle leaves long lower wick + 5-min CHoCH (close above 15-min opening range high), enter ATM CE targeting 24,220 → 24,260. SL below sweep low.
• SELL SETUP (Supply Rejection): If market rallies into 24,220–24,250 supply with a shooting star, wick rejection, or 5-min bearish engulfing, enter ATM PE targeting 24,136 → 24,050 → 24,000. SL above 24,265.
• NO-TRADE ZONE: 24,170–24,220 mid-range chop. Avoid option buying in this zone.
• EXTREME GAP CONTINGENCY: Massive gap-down (<24,050) — do not short blindly; watch for 15M ORB reversal/sweep into 24,000 demand. Massive gap-up (>24,300) — wait for 15M ORB breakout vs rejection at 24,350.

5. Risk Warning:
• Low VIX (~11.0–11.5) causes heavy theta decay during 11:30 AM–1:30 PM consolidation.
• Brent Crude ($91.50+) and elevated USDINR (~93.06) pose strong macro headwinds; avoid holding long positions without tight trailing stops.` },
  { source: 'Combined', text: `Summary for August 19 (AK, BT, CETA, SMU, STL):

Data Bias: Retailers are bullish, while FIIs and Proprietary desks are bearish with call writing and added short contracts. Institutional bias leans bearish.
Nifty Levels:
Resistance / Make-or-Break: 24232 - 24270 (above which longs can be initiated), 24308 (CETA ABC wave completion).
Support / Downside Targets: 24136, 24041, 24000 (Major support/Inefficiency fill), 23980, 23891.
Strategy: The market is in a structural correction. Wait for a clear setup. If the market breaks below 24136, a short trade towards 24041 and 23891 can be taken. If it bounces from the inefficiency zone near 24000-24134 (SMA 50) with a liquidity grab, long positions can be considered. No trade in the chop zone (flat opening and rising immediately). Wait for a close above 24232-24270 for confirmed bullish momentum.` }
];

window.dailyPlanData = [
  // --- TACTICAL RULES & STRATEGIES ---
  { "source": "MARKET", "price": "TACTICAL RULE: 12:00 PM Wrap Up & Expiry Avoidance", "bias": "neutral", "behavior": "Avoid trading current expiry index options after 12:00 PM IST due to CAS closing auction manipulation and volume drops. Wrap up index trades before noon or switch to next expiry / Crude Oil / Stock Options.", "tp": "-", "sl": "-", "status": "na" },

  // --- AI LEVELS (Aug 19) - Pre-Market Briefing ---
  { "source": "AI", "price": "24300 - 24350", "bias": "bearish", "behavior": "Major resistance & trend invalidation. Heavy call writing zone. Needs sustained 15M close above for structural bullish CHoCH.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "AI", "price": "24220 - 24250", "bias": "bearish", "behavior": "Immediate supply zone & 15M bearish FVG. Sell trigger if wick rejection or bearish engulfing occurs.", "tp": "24136", "sl": "24265", "status": "na" },
  { "source": "AI", "price": "24170 - 24220", "bias": "neutral", "behavior": "NO TRADE ZONE. Mid-range chop territory — avoid option buying here due to rapid theta decay.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "AI", "price": "24100 - 24136", "bias": "bearish", "behavior": "Immediate intraday support shelf & SSL. If broken on expanding 15M red volume, accelerates down to 24000.", "tp": "24000", "sl": "24220", "status": "na" },
  { "source": "AI", "price": "24050 - 24080", "bias": "bullish", "behavior": "Liquidity sweep buy zone. If 24100 is swept with lower wick + 5-min CHoCH above 15-min high, enter CE.", "tp": "24220", "sl": "Below sweep low", "status": "na" },
  { "source": "AI", "price": "24000", "bias": "bullish", "behavior": "Major structural HTF psychological demand & unfilled daily FVG target. Watch for strong institutional buying reaction.", "tp": "24150", "sl": "23950", "status": "na" },

  // --- AK LEVELS (Aug 19) ---
  { "source": "AK", "price": "24250 - 24270", "bias": "bullish", "behavior": "Must close above this zone for confirmed bullish momentum and to carry long positions.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "AK", "price": "23980 - 24000", "bias": "bearish", "behavior": "Downside targets if market collapses. Expecting a challenge to these levels but not shorting due to low premium/IV.", "tp": "-", "sl": "-", "status": "na" },

  // --- BT LEVELS (Aug 19) ---
  { "source": "BT", "price": "24134", "bias": "bullish", "behavior": "SMA 50 support on Daily time frame. If market drops flat and shows liquidity grab or bear trap here, initiate long trade.", "tp": "-", "sl": "Below swing low", "status": "na" },
  { "source": "BT", "price": "24000", "bias": "bullish", "behavior": "Inefficiency gap fill zone. Wait for a pullback to fill and buy on second pullback confirmation.", "tp": "-", "sl": "-", "status": "na" },

  // --- CETA LEVELS (Aug 19) ---
  { "source": "CETA", "price": "24308", "bias": "bullish", "behavior": "If price closes above 24308 spot, ABC correction is considered complete and trend shifts to bullish.", "tp": "-", "sl": "-", "status": "na" },
  { "source": "CETA", "price": "24630", "bias": "bullish", "behavior": "Major daily closing resistance. Trend changes completely bullish only above this.", "tp": "-", "sl": "-", "status": "na" },

  // --- SMU LEVELS (Aug 19) ---
  { "source": "SMU", "price": "DATA BIAS", "bias": "bearish", "behavior": "Retailers bullish (put writing), FIIs and Pro desks bearish (call writing, short futures).", "tp": "-", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "24232", "bias": "bullish", "behavior": "Buy trigger. Close above this level initiates long positions.", "tp": "24280", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "24136", "bias": "bearish", "behavior": "Short trigger. Close below this level followed by retracement initiates shorts.", "tp": "24041", "sl": "-", "status": "na" },
  { "source": "SMU", "price": "24136 - 24232", "bias": "neutral", "behavior": "No trade zone. Avoid if market opens and stays in between.", "tp": "-", "sl": "-", "status": "na" }
];
