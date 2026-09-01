window.dailyPlanSummary = [
  {
    source: "AI",
    text: `**Data & Market Bias:**
The overall market bias derived from institutional derivative data (FIIs and Proprietary desks) is overwhelmingly **Bearish to Neutral**, while Retailers remain heavily **Bullish** (holding heavy long calls and short puts). Global macro headwinds, including crude oil rising above $92, rising US 10-year bond yields (4.78%), and weak domestic PMI manufacturing data, favor a "Sell on Rise" market structure. However, short-term bounce/gap-up possibilities exist due to overnight Gift Nifty strength (+50 to +90 points). Traders are advised to keep position sizes small until clear directional confirmation or structural breaks occur.

**Key Nifty Levels:**
- **Resistance / Supply Zones:** 24,066, 24,120 – 24,142, 24,200, 24,250, and Today's Day High (PDH). Major trend shift confirmation only above 24,300 (closing) and 24,500.
- **Support / Demand Zones:** 24,000, Today's Day Low (PDL ~24,020 / 23,980), 23,950, 23,891, 23,823, and 23,796.

**Trading Strategies Synthesized Across Channels:**
1. **Bullish Scenario / Long Trades:**
   - **Above 24,066:** If Nifty closes above 24,066 on a 15-minute timeframe, enter long on a retracement targeting 24,142. A break above 24,142 can trigger short-covering towards 24,250 (SMU).
   - **Day High Breakout:** If Nifty opens flat/gap-up and the 1-hour candle closes green (indicating a Change in State of Delivery / CISD), buy above Today's Day High with open targets (BT).
   - **Bounce at Support:** Small-quantity long positions can be taken if bullish price action emerges near 24,000, 24,100, or 24,200 support levels (MAA).
2. **Bearish Scenario / Short Trades:**
   - **Rejection at Resistance:** If Nifty faces rejection near the 24,120 – 24,142 zone or forms a shooting star on the 1-hour chart near PDH, enter short targeting 23,891 (BT, SMU).
   - **Breakdown below Day Low / 23,950:** A 15-minute candle close below Today's Day Low (~24,020) opens shorting opportunities towards 23,891 and 23,823. A breakdown below 23,950 warrants increasing short position sizes towards 23,881 – 23,796 (MAA, SMU, BT).

---`
  }
];

window.dailyPlanData = [
  {"source": "BT", "price": "PDH", "bias": "bullish", "behavior": "Breakout above Today's Day High accompanied by a green 1-hour CISD candle close", "tp": "Open Target", "sl": "Below entry candle low", "status": "na"},
  {"source": "BT", "price": "PDL", "bias": "bearish", "behavior": "15-minute candle close below Today's Day Low on flat or gap-down open", "tp": "Next liquidity area / Gap fill", "sl": "Day High / 1:2 RR", "status": "na"},
  {"source": "MAA", "price": "24000 - 24200", "bias": "bullish", "behavior": "Bullish candle high break or bounce from 24000, 24100, or 24200 (trade with small quantity)", "tp": "24200 / 24300", "sl": "NA", "status": "na"},
  {"source": "MAA", "price": "23950", "bias": "bearish", "behavior": "Breakdown below 23950 (trigger to increase short quantity)", "tp": "23881 - 23796", "sl": "NA", "status": "na"},
  {"source": "MAA", "price": "24300", "bias": "bullish", "behavior": "Daily LTP closing above 24300 gives first signal of structural reversal towards bullishness", "tp": "24500", "sl": "NA", "status": "na"},
  {"source": "SMU", "price": "24066", "bias": "bullish", "behavior": "15-minute candle close above 24066, enter on retracement", "tp": "24142", "sl": "NA", "status": "na"},
  {"source": "SMU", "price": "24142", "bias": "bullish", "behavior": "Breakout above 24142 triggers short-covering move", "tp": "24250", "sl": "NA", "status": "na"},
  {"source": "SMU", "price": "24120 - 24142", "bias": "bearish", "behavior": "Rejection candle formed around 24120 - 24142 zone", "tp": "23891", "sl": "NA", "status": "na"},
  {"source": "SMU", "price": "24020", "bias": "bearish", "behavior": "Breakdown below Today's Day Low (~24020)", "tp": "23891", "sl": "NA", "status": "na"},
  {"source": "SMU", "price": "23891", "bias": "bearish", "behavior": "Breakdown below 23891 level", "tp": "23823", "sl": "NA", "status": "na"}
];
