import json

with open(r'js\data\daily_plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_youtube_entries = [
  '{ "source": "STL", "price": "24380", "bias": "bullish", "behavior": "Major resistance & Bull Flag breakout trigger; strong buying momentum on candle close above.", "tp": "24450-24500", "sl": "24330", "status": "na" }',
  '{ "source": "STL", "price": "24330", "bias": "bullish", "behavior": "Immediate resistance; closing above confirms intraday strength towards 24380 breakout level.", "tp": "24380", "sl": "24280", "status": "na" }',
  '{ "source": "STL", "price": "24240", "bias": "bullish", "behavior": "Key trendline retest & dip-support zone (21 EMA); look for reversal buy setup on rejection wicks.", "tp": "24330", "sl": "24180", "status": "na" }',
  '{ "source": "STL", "price": "24180", "bias": "bearish", "behavior": "Critical invalidation support; breakdown below negates immediate bull flag breakout structure.", "tp": "24100", "sl": "24240", "status": "na" }',
  '{ "source": "TBT", "price": "24400", "bias": "bearish", "behavior": "Major swing high resistance and primary upside target for all long trades.", "tp": "24300", "sl": "24430", "status": "na" }',
  '{ "source": "TBT", "price": "24210", "bias": "bullish", "behavior": "Fibonacci Golden Zone (0.50-0.618) & 15m FVG demand; flat open reversal trigger on hammer/engulfing candle.", "tp": "24400", "sl": "24170", "status": "na" }',
  '{ "source": "TBT", "price": "24180", "bias": "neutral", "behavior": "Lower boundary of Golden Pocket; double price action breakdown below triggers short trade.", "tp": "24100", "sl": "24220", "status": "na" }',
  '{ "source": "TBT", "price": "24100", "bias": "bullish", "behavior": "Previous swing low liquidity zone (24080-24100); look for SSL liquidity sweep reversal to buy towards PDC.", "tp": "24207", "sl": "24060", "status": "na" }',
  '{ "source": "SMO", "price": "24300", "bias": "bearish", "behavior": "Immediate Call OI wall & overhead resistance level; requires absorption for further rally.", "tp": "24100", "sl": "24360", "status": "na" }',
  '{ "source": "SMO", "price": "24200", "bias": "bullish", "behavior": "Spot support pivot; resilient futures strength indicates low-volume dip buying near current levels.", "tp": "24350", "sl": "24000", "status": "na" }',
  '{ "source": "SMO", "price": "24000", "bias": "bullish", "behavior": "Major structural macro base & regime invalidation floor. Positional bullish outlook active above 24000.", "tp": "24400-24500", "sl": "23950", "status": "na" }',
  '{ "source": "CKZ", "price": "24630", "bias": "bearish", "behavior": "HTF 75-min 5-3-5 Zig-Zag major supply & resistance zone.", "tp": "24350", "sl": "24700", "status": "na" }',
  '{ "source": "CKZ", "price": "24580.40", "bias": "bullish", "behavior": "161.8% Trending Impulse upside extension target for Wave 3.", "tp": "24630", "sl": "24400", "status": "na" }',
  '{ "source": "CKZ", "price": "24402.80", "bias": "bullish", "behavior": "100% Terminal Impulse upside target for Wave 3.", "tp": "24580.40", "sl": "24250", "status": "na" }',
  '{ "source": "CKZ", "price": "24247.05", "bias": "bullish", "behavior": "50% Fibonacci retracement of sub-wave 3. Reclaiming confirms Wave 3 impulse continuation.", "tp": "24402.80", "sl": "24115", "status": "na" }',
  '{ "source": "CKZ", "price": "24215.95", "bias": "neutral", "behavior": "61.8% Fibonacci retracement level of sub-wave 3; late breakdown line needing immediate reclaiming.", "tp": "24402.80", "sl": "24115", "status": "na" }',
  '{ "source": "CKZ", "price": "24115", "bias": "bullish", "behavior": "Crucial Elliott Wave 2 base & mandatory long protective stop. Breakdown triggers complete surrender of bullish count.", "tp": "24402.80", "sl": "24090", "status": "na" }',
  '{ "source": "TMP", "price": "24350", "bias": "bearish", "behavior": "Major resistance / Call writing zone (24300-24400 CE). Watch for rejection or short-covering trigger above.", "tp": "24207", "sl": "24385", "status": "na" }',
  '{ "source": "TMP", "price": "24300", "bias": "bullish", "behavior": "Buy on 15m candle close above 24300 for short-covering rally.", "tp": "24375, 24415", "sl": "24265", "status": "na" }',
  '{ "source": "TMP", "price": "24178", "bias": "bearish", "behavior": "Short breakdown trigger on 15m candle close below 24178.", "tp": "24050, 24000", "sl": "24220", "status": "na" }',
  '{ "source": "TMP", "price": "24100", "bias": "bullish", "behavior": "Gap-down reversal buy zone at daily rising trendline support on double bottom / bullish engulfing.", "tp": "24207, 24265", "sl": "24070", "status": "na" }',
  '{ "source": "MAA", "price": "24500", "bias": "bullish", "behavior": "Major macro resistance & heavy CE OI wall. Daily close above 24500 confirms full positional bull run.", "tp": "24650", "sl": "24420", "status": "na" }',
  '{ "source": "MAA", "price": "24357", "bias": "bullish", "behavior": "Key resistance breakout. Break & sustain above 24357 triggers aggressive momentum long expansion.", "tp": "24459, 24500", "sl": "24320", "status": "na" }',
  '{ "source": "MAA", "price": "24300", "bias": "bullish", "behavior": "Crucial pivot support. Sustaining above 24300 triggers small-quantity longs or pullback bounce.", "tp": "24357", "sl": "24270", "status": "na" }',
  '{ "source": "MAA", "price": "24179", "bias": "bearish", "behavior": "Major demand breakdown. Decisive move below 24200/24179 accelerates shorting momentum.", "tp": "24000", "sl": "24240", "status": "na" }',
  '{ "source": "MAA", "price": "24000", "bias": "bullish", "behavior": "Major psychological macro support zone / PE base. Strong reversal bounce zone if tested.", "tp": "24180", "sl": "23950", "status": "na" }'
]

data_part = content.split('window.dailyPlanData = [')[1]
lines = data_part.split('\n')
valid_lines = []
for line in lines:
    if line.strip() == '];': continue
    if not line.strip(): continue
    if 'source' not in line: continue
    
    if '"source": "AI"' in line and '[Aug 27]' in line:
        valid_lines.append(line.rstrip(','))

new_data_section = "window.dailyPlanData = [\n  " + ",\n  ".join(valid_lines + new_youtube_entries) + "\n];\n"

summary_part = content.split('window.dailyPlanData = [')[0]
summary_blocks = summary_part.split('{')

final_summaries = []
for sb in summary_blocks:
    if '"source": "YT-Videos"' in sb: final_summaries.append('{\n' + sb.strip().rstrip(','))
    if '"source": "AI"' in sb and 'Aug 27, 2026' in sb: final_summaries.append('{\n' + sb.strip().rstrip(','))

new_summary_section = "window.dailyPlanSummary = [\n" + ",\n".join(final_summaries) + "\n];\n\n"

with open(r'js\data\daily_plan.js', 'w', encoding='utf-8') as f:
    f.write(new_summary_section + new_data_section)
