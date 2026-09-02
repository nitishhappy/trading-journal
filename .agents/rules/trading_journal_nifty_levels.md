# Nifty Prediction Level Extraction

When processing Nifty Prediction videos to extract support, resistance, targets, or stoploss levels for the daily plan:
- **DO NOT** consolidate overlapping or adjacent levels into zones.
- **DO NOT** group levels from different analysts (or the same analyst) even if they are very close in value (e.g., 24400 and 24420).
- **DO** include all fine-grained levels as distinct and separate entries in `js/data/nifty_daily_plan.js`.
- The user prefers to see every exact distinct level explicitly listed, rather than a cleaner UI with generalized zones.
