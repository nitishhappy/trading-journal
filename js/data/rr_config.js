// Central Risk:Reward Baseline & Asset Threshold Configuration
// Auto-synced from C:\Nitish\ClaudeApps\Utilities\<Asset Setup>\config_<asset>.txt
window.rrConfig = {
    "btc": 3.5,
    "gold": 2.5,
    "sp500": 2.5,
    "eurusd": 2.5,
    "nifty": 2.5,
    "sensex": 2.5
};
window.assetParamsConfig = {
    "nifty": {
        "LEVEL_PROXIMITY_MARGIN": 15,
        "PRICE_RENDER_DELTA": 5,
        "MIN_VALID_PRICE": 10000,
        "SPREAD_WIDTH": 50,
        "STRIKE_INTERVAL": 50
    },
    "sensex": {
        "LEVEL_PROXIMITY_MARGIN": 50,
        "PRICE_RENDER_DELTA": 15,
        "MIN_VALID_PRICE": 30000,
        "SPREAD_WIDTH": 200,
        "STRIKE_INTERVAL": 100,
        "WATCHDOG_EXHAUSTION_DELTA": 150,
        "WATCHDOG_EXTREME_DELTA": 330
    }
};
