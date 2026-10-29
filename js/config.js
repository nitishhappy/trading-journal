/**
 * ==============================================================================
 * CENTRAL CONFIGURATION MASTER — TRADELOG / TRADING JOURNAL
 * ==============================================================================
 * 
 * 📖 WHAT IS THIS FILE?
 * ------------------------------------------------------------------------------
 * This file serves as the Single Source of Truth (SSOT) for all default settings,
 * asset thresholds, execution parameters, timer profiles, and security rules
 * across the entire Trading Journal application and its interactive chart dashboards.
 *
 * ⚙️ HOW THIS FILE WORKS:
 * ------------------------------------------------------------------------------
 * 1. Synchronous Global Evaluation:
 *    When the browser loads this script, it immediately attaches the master object
 *    `APP_CONFIG` to the global `window` scope (`window.APP_CONFIG`).
 * 2. Zero-Latency Startup:
 *    Because this is a pure JavaScript object (rather than an async fetch call),
 *    every chart, service, and UI module can read configurations instantaneously
 *    during boot without race conditions or offline loading failures.
 * 3. Backward-Compatibility Bridges:
 *    For existing charts and legacy modules expecting `window.rrConfig` or
 *    `window.assetParamsConfig`, this file automatically creates top-level aliases
 *    pointing directly to the corresponding sections of `APP_CONFIG`.
 * 4. User Preference Precedence:
 *    The values defined here represent baseline system defaults. If an authenticated
 *    user customizes their settings (via the Settings tab UI), those personal
 *    preferences saved in Firestore (`users/{uid}/settings/preferences`) or
 *    `localStorage` will override these baseline defaults at runtime.
 *
 * 🔗 HOW THIS FILE IS CALLED ACROSS THE PROJECT:
 * ------------------------------------------------------------------------------
 * 1. Main Journal Application (`index.html`):
 *    Loaded in the `<head>` or footer before application modules:
 *      <script src="./js/config.js?v=20261030"></script>
 *    Consumed across ES modules via `window.APP_CONFIG` (or `APP_CONFIG`).
 *
 * 2. Standalone Interactive Charts:
 *    (`nifty_interactive_chart.html`, `gold_interactive_chart.html`,
 *     `btc_interactive_chart.html`, `eurusd_interactive_chart.html`,
 *     `sensex_interactive_chart.html`, `sp500_interactive_chart.html`):
 *    Loaded in `<head>`:
 *      <script src="js/config.js"></script>
 *    Charts read `window.APP_CONFIG.rrConfig[currentAsset]` to evaluate whether
 *    a setup qualifies for a High R:R badge (⭐ strictly TP1 >= baseline R:R).
 *
 * 3. Candle Timers & Alarms (`js/services/candleTimers.js` & `js/ui/candleTimers.js`):
 *    Reads `window.APP_CONFIG.candleTimers` for session operating hours (09:15-15:30),
 *    active trading days (Mon-Fri), chime sounds, and milestone alert times.
 *
 * 4. Security & Privacy (`trade-security.js` & `js/ui/settings.js`):
 *    Reads `window.APP_CONFIG.security` for the 5-tap secret title toggle threshold,
 *    inactivity lock delay (5000ms), and 1-hour wrong passcode lockout duration.
 *
 * 5. Automated Desktop Bridge Sync:
 *    The automated briefing daemon (`C:\Nitish\ClaudeApps\Utilities\sync_briefing_to_daily_plan.py`)
 *    reads desktop configurations (`Utilities\central_config.json` and asset-specific
 *    `config_<asset>.txt` files) and synchronizes them directly into this file.
 * ==============================================================================
 */

(function (root) {
  'use strict';

  var APP_CONFIG = {
    // --------------------------------------------------------------------------
    // 1. RISK : REWARD (R:R) BASELINE THRESHOLDS
    // --------------------------------------------------------------------------
    // Used by charts and tactical plan engines to award the "⭐ High R:R" star badge.
    // A trade setup must have Strictly TP1 >= baseline to qualify.
    // --------------------------------------------------------------------------
    rrConfig: {
      "btc": 3.5,
      "gold": 2.5,
      "sp500": 2.5,
      "eurusd": 2.5,
      "nifty": 2.5,
      "sensex": 2.5
},

    // --------------------------------------------------------------------------
    // 2. ASSET SPECIFIC EXECUTION & PRICE PARAMETERS
    // --------------------------------------------------------------------------
    // Configurable level proximity margins, option strike intervals, and render deltas.
    // Governed by the "No Hardcoding & Asset Configuration Rule".
    // --------------------------------------------------------------------------
    assetParamsConfig: {
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
},

    // --------------------------------------------------------------------------
    // 3. CANDLE CLOSE TIMERS & REPEAT ALARMS
    // --------------------------------------------------------------------------
    // Governs repeat 5m & 15m candle close chimes, session bounds, and milestone alerts.
    // --------------------------------------------------------------------------
    candleTimers: {
      enabled: true,
      activeDays: [1, 2, 3, 4, 5],     // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
      fromTime: "09:15",               // Market session open (IST)
      toTime: "15:30",                 // Market session close (IST)
      anchorTime: "09:15",             // Candle synchronization anchor time
      sound5m: "chime",                // Audio profile for 5-minute candle close
      sound15m: "radar",               // Audio profile for 15-minute candle close
      volume5m: 0.8,
      volume15m: 0.8,
      mute5m: false,
      mute15m: false,
      enable5m: true,
      enable15m: true,
      specialTimes: ["09:15", "10:00", "15:00"], // Key milestone announcements
      specialSound: "special",
      specialVolume: 0.9,
      specialMute: false
    },

    // --------------------------------------------------------------------------
    // 4. SECURITY & PRIVACY GATES
    // --------------------------------------------------------------------------
    // Used by `trade-security.js` and `js/ui/settings.js` to protect private journals.
    // --------------------------------------------------------------------------
    security: {
      inactivityTimeoutMs: 5000,       // Inactivity delay before locking trade log tab (5s)
      secretTapCount: 5,               // Rapid tap count on topbar title to toggle Trade Log visibility
      secretTapWindowMs: 2000,         // Time window in ms for the 5-tap sequence (2s)
      passcodeLockoutDurationMs: 3600000, // 1 hour lockout upon failed passcode entry
      tradeLogHiddenKey: "tradelog_tab_hidden"
    },

    // --------------------------------------------------------------------------
    // 5. SMC SEQUENCE ENGINE & PATTERN TIMEOUTS
    // --------------------------------------------------------------------------
    // Governs sequence state lifecycles and automated cleanup.
    // --------------------------------------------------------------------------
    sequenceRules: {
      defaultTimeoutMultiplier: 6,     // Max candle bars before pending pattern times out
      autoCleanHours: 24               // Max age in hours before completed/expired states purge
    },

    // --------------------------------------------------------------------------
    // 6. DEFAULT NOTIFICATION PREFERENCES
    // --------------------------------------------------------------------------
    // Initial states for browser pop-up and lock-screen Web Push notifications.
    // --------------------------------------------------------------------------
    notifications: {
      summaryNotificationsEnabled: true,  // Daily briefing / tactical sync pop-ups
      alertNotificationsEnabled: false,    // TradingView & live external alerts
      sequenceNotificationsEnabled: true,  // SMC sequence completion alerts
      copilotNotificationsEnabled: false   // AI Co-Pilot background run notifications
    },

    // --------------------------------------------------------------------------
    // 7. USER INTERFACE & GENERAL PREFERENCES
    // --------------------------------------------------------------------------
    ui: {
      defaultTheme: "dark",            // "dark" or "light"
      defaultGroupMode: "date",        // "date", "priority", or "tags"
      keepAppActiveDefault: false,     // Screen wake lock for mobile PWA
      normalizeTagsToLowercase: true
    }
  };

  // Attach master configuration to the global window
  if (typeof root !== 'undefined') {
    root.APP_CONFIG = APP_CONFIG;

    // Backward-compatibility aliases for legacy scripts and interactive charts
    root.rrConfig = APP_CONFIG.rrConfig;
    root.assetParamsConfig = APP_CONFIG.assetParamsConfig;
  }

  // CommonJS export support if required by Node testing tools
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
  }
})(typeof window !== 'undefined' ? window : globalThis);
