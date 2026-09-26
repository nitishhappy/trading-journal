import json
import re
from pathlib import Path

SCRATCH = Path(r"C:\Nitish\ClaudeApps\trading-journal\scratch\friday_backtest")
files = {
    "1034_as_is": SCRATCH / "output_1034_as_is.md",
    "1034_to_be": SCRATCH / "output_1034_to_be.md",
    "1332_as_is": SCRATCH / "output_1332_as_is.md",
    "1332_to_be": SCRATCH / "output_1332_to_be.md"
}

# Historical Friday levels from nifty_daily_plan.js
historical = {
    "1034": [
        {"setup": "B1", "price": "23065", "tp": "23,140.00 / 23,180.00", "sl": "23,015.00", "logic": "Pullback probe into 23,040–23,055 with 5m close back above 23,065"},
        {"setup": "B2", "price": "23125", "tp": "23,200.00 / 23,250.00", "sl": "23,075.00", "logic": "Sustained 5m close ABOVE 23,125 clearing Day High (23,121.60)"},
        {"setup": "S1", "price": "23065", "tp": "23,015.00 / 22,980.00", "sl": "23,095.00", "logic": "Failure to reclaim 23,100 followed by 5m close BELOW 23,065"},
        {"setup": "S2", "price": "23030", "tp": "22,960.00 / 22,920.00", "sl": "23,070.00", "logic": "Sustained 5m close BELOW Day Low 23,030"}
    ],
    "1332": [
        {"setup": "B1", "price": "23070", "tp": "23,115.00 / 23,145.00", "sl": "23,020.00", "logic": "Absorption probe holding above Day Low followed by 5m close back ABOVE 23,070 reclaiming VWAP"},
        {"setup": "B2", "price": "23125", "tp": "23,180.00 / 23,220.00", "sl": "23,070.00", "logic": "Sustained 5m close ABOVE 23,125 clearing Day High (23,121.60)"},
        {"setup": "S1", "price": "23035", "tp": "22,990.00 / 22,960.00", "sl": "23,075.00", "logic": "Rejection at 23,060–23,070 followed by 5m close below 23,035"},
        {"setup": "S2", "price": "23020", "tp": "22,960.00 / 22,920.00", "sl": "23,060.00", "logic": "Sustained 5m close BELOW Day Low 23,020"}
    ]
}

def parse_md(path):
    txt = path.read_text(encoding="utf-8")
    m = re.search(r'```json:app-data\s*({[\s\S]*?})\s*```', txt)
    if not m:
        return []
    data = json.loads(m.group(1))
    return data.get("levels", [])

results = {}
for name, p in files.items():
    results[name] = parse_md(p)

print("=== PARSE SUMMARY ===")
for name, lvls in results.items():
    print(f"{name}: {len(lvls)} levels parsed")
    for l in lvls:
        print(f"  [{l.get('setup')}] Price: {l.get('price')} | TP: {l.get('tp')} | SL: {l.get('sl')} | Logic: {l.get('logic')[:60]}")

# Save json summary for detailed analysis
with open(SCRATCH / "parsed_summary.json", "w", encoding="utf-8") as f:
    json.dump({"historical": historical, "results": results}, f, indent=2)
