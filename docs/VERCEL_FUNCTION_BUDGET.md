# Vercel Serverless Function Budget

**Project**: Trade Journal App (`trading-journal`)  
**Deployment Platform**: Vercel Hobby  
**Hard Limit**: 12 Serverless Functions per deployment  
**Last Audit Date**: 2026-09-10  
**Audit Commit**: `7c03676`  

---

## 1. Budget Summary & Thresholds

| Threshold Metric | Value / Rule |
| ---------------- | ------------ |
| **Vercel Plan** | Vercel Hobby |
| **Hard Platform Limit** | 12 Functions |
| **Current Function Count** | 13 / 12 (OVER BUDGET) |
| **Available Capacity** | -1 Functions |
| **Current Risk Status** | 🚨 **BLOCKED** (> 12 Functions) |

### Warning Escalation Scale

* **0 – 8 Functions**: 🟢 **SAFE** — Normal operation & development capacity available.
* **9 Functions**: ⚠️ **WATCH** — Issue warning before adding new serverless entry points.
* **10 Functions**: 🛑 **ARCHITECTURE REVIEW** — Stop & discuss architectural options before proceeding.
* **11 Functions**: ✋ **USER DECISION REQUIRED** — Explicit user approval mandatory before adding functions.
* **12 Functions**: ⛔ **FULL** — Maximum capacity reached. No additional function entry point permitted.
* **> 12 Functions**: 🚨 **BLOCKED** — Deployment limit exceeded. Build/deploy failure.

---

## 2. Serverless Function Inventory & Usage Audit

| # | File Path | Route | Purpose | HTTP Methods | Callers | Essential? | Usage Status | Consolidation / Remediation |
| - | --------- | ----- | ------- | ------------ | ------- | ---------- | ------------ | --------------------------- |
| 1 | `api/btcCandles.js` | `/api/btcCandles` | BTC 5m candles (Binance / Yahoo Finance fallback) | GET, OPTIONS | `btc_interactive_chart.html` | Occasional | B. OCCASIONAL | Consolidate into `/api/marketCandles?symbol=BTC` |
| 2 | `api/firebase-admin.js` | `/api/firebase-admin` | **ACCIDENTAL FUNCTION** — Firebase Admin SDK initializer module | N/A (Module) | Imports in `sendPush.js`, `tvWebhook.js`, `tvRegisterToken.js`, `registerPush.js`, `latestGoldPrice.js` | Helper | D. UNUSED AS ENDPOINT | **SAFE TO MOVE** to `api/_lib/firebase-admin.js` (Reclaims 1 slot) |
| 3 | `api/goldCandles.js` | `/api/goldCandles` | Gold 5m candles (PAXGUSDT / GC=F fallback) | GET, OPTIONS | `gold_interactive_chart.html` | Occasional | B. OCCASIONAL | Consolidate into `/api/marketCandles?symbol=GOLD` |
| 4 | `api/latestGoldPrice.js` | `/api/latestGoldPrice` | Legacy XAUUSD latest alert price query | GET | None (Orphaned/superseded by `livePrices.js`) | No | D. POTENTIALLY UNUSED | **SAFE TO RETIRE** (Reclaims 1 slot) |
| 5 | `api/livePrices.js` | `/api/livePrices` | Multi-asset spot prices (Nifty, Gold, S&P 500, BTC) | GET, OPTIONS | `tvNotifications.js` (10s poll), `levels.js`, `gold_interactive_chart.html`, `btc_interactive_chart.html` | Yes | A. CORE / FREQUENT | Essential Master Live Price Endpoint |
| 6 | `api/niftyCandles.js` | `/api/niftyCandles` | Nifty 50 Upstox 1m to 5m candle aggregator | GET, OPTIONS | `nifty_interactive_chart.html`, `levels.js` | Yes | A. CORE / FREQUENT | Essential / Anchor for `/api/marketCandles?symbol=NIFTY` |
| 7 | `api/registerPush.js` | `/api/registerPush` | Push subscription registration endpoint | POST | None (Redundant with `sendPush.js`) | No | D. POTENTIALLY UNUSED | **SAFE TO CONSOLIDATE** into `sendPush.js` (Reclaims 1 slot) |
| 8 | `api/sendPush.js` | `/api/sendPush` | VAPID Web Push dispatch & subscription registration | POST | `webPush.js`, `settings.js`, `sync_briefing_to_daily_plan.py` | Yes | A. CORE / FREQUENT | Essential Master Push Endpoint (Absorbs `registerPush.js`) |
| 9 | `api/sequenceEngine.js` | `/api/sequenceEngine` | **ACCIDENTAL FUNCTION** — Multi-step sequential signals state machine helper | N/A (Module) | Imported by `tvWebhook.js` | Helper | D. UNUSED AS ENDPOINT | **SAFE TO MOVE** to `api/_lib/sequenceEngine.js` (Reclaims 1 slot) |
| 10 | `api/sp500Candles.js` | `/api/sp500Candles` | S&P 500 5m candles (Yahoo Finance ^GSPC) | GET, OPTIONS | `sp500_interactive_chart.html` | Occasional | B. OCCASIONAL | Consolidate into `/api/marketCandles?symbol=SP500` |
| 11 | `api/tvRegisterToken.js` | `/api/tvRegisterToken` | TradingView webhook token registration & revocation | POST | `tvNotifications.js` | Yes | B. OCCASIONAL | Essential TV Token Endpoint |
| 12 | `api/tvWebhook.js` | `/api/tvWebhook` | Inbound signal webhook listener & push alert trigger | POST | TradingView webhooks, Telegram Watchdog worker, Python Copilot | Yes | A. CORE / FREQUENT | Essential Inbound Signal Gateway |
| 13 | `api/vapidConfig.js` | `/api/vapidConfig` | **ACCIDENTAL FUNCTION** — VAPID keypair configuration helper | N/A (Module) | Imported by `sendPush.js`, `tvWebhook.js` | Helper | D. UNUSED AS ENDPOINT | **SAFE TO MOVE** to `api/_lib/vapidConfig.js` (Reclaims 1 slot) |

---

## 3. Usage Classification Breakdown

* **A. CORE / FREQUENT (4 functions)**: `livePrices.js`, `niftyCandles.js`, `sendPush.js`, `tvWebhook.js`
* **B. OCCASIONAL (4 functions)**: `btcCandles.js`, `goldCandles.js`, `sp500Candles.js`, `tvRegisterToken.js`
* **C. RARE (0 functions)**
* **D. POTENTIALLY UNUSED / ACCIDENTAL ENTRYPOINTS (5 functions)**:
  - `firebase-admin.js` (Accidental function entrypoint; pure module)
  - `sequenceEngine.js` (Accidental function entrypoint; pure module)
  - `vapidConfig.js` (Accidental function entrypoint; pure module)
  - `registerPush.js` (100% redundant with `sendPush.js`)
  - `latestGoldPrice.js` (Legacy orphan endpoint; superseded by `livePrices.js`)
* **E. UNKNOWN (0 functions)**

---

## 4. Git History & Exceed Origin Analysis

| Commit | Date | Functions Added | Functions Removed | Net Change | Cumulative Count | Key Files |
| ------ | ---- | --------------- | ----------------- | ---------- | ---------------- | --------- |
| `b279806` | Initial | 3 | 0 | +3 | 3 | `firebase-admin.js`, `tvRegisterToken.js`, `tvWebhook.js` |
| `f0fa2fa` | Initial | 1 | 0 | +1 | 4 | `sequenceEngine.js` |
| `12765f3` | Initial | 1 | 0 | +1 | 5 | `niftyCandles.js` |
| `24ee0c3` | Initial | 1 | 0 | +1 | 6 | `livePrices.js` |
| `37462bb` | Initial | 1 | 0 | +1 | 7 | `latestGoldPrice.js` |
| `39bd8bc` | 2026-09-08 | 2 | 0 | +2 | 9 | `sendPush.js`, `vapidConfig.js` |
| `36c4fbb` | 2026-09-08 | 1 | 0 | +1 | 10 | `registerPush.js` |
| `5c5a124` | 2026-09-09 | 1 | 0 | +1 | 11 | `sp500Candles.js` |
| `5c99010` | 2026-09-09 | 2 | 0 | +2 | **13** 🚨 | `btcCandles.js`, `goldCandles.js` |

> 🚨 **Root Cause of Limit Breach**: Commit `5c99010` introduced separate `btcCandles.js` and `goldCandles.js` endpoints alongside existing `sp500Candles.js` and `niftyCandles.js`, raising the function count from **11** to **13**, crossing Vercel Hobby's 12-function limit.

---

## 5. Capacity Optimization Strategy & Recommended Architecture

### Step 1: Relocate Pure Helper Modules (Immediate - Reclaims 3 Slots)
Move helper modules out of root `/api/` into `/api/_lib/` so Vercel does not build them as Serverless Functions:
1. Move `api/firebase-admin.js` ➔ `api/_lib/firebase-admin.js`
2. Move `api/sequenceEngine.js` ➔ `api/_lib/sequenceEngine.js`
3. Move `api/vapidConfig.js` ➔ `api/_lib/vapidConfig.js`

*Count after Step 1*: **10 / 12 Functions** (Reclaims 3 capacity slots)

### Step 2: Retire Unused / Redundant Endpoints (Immediate - Reclaims 2 Slots)
1. Retire `api/latestGoldPrice.js` (Orphaned legacy function)
2. Retire `api/registerPush.js` (Redundant; `sendPush.js` already handles registration)

*Count after Step 2*: **8 / 12 Functions** (Reclaims 2 additional slots ➔ 🟢 **SAFE Status**)

### Step 3: Consolidate Asset Candle APIs (Optional Next Phase - Reclaims 3 Slots)
Consolidate `btcCandles.js`, `goldCandles.js`, `sp500Candles.js`, and `niftyCandles.js` into a single parameterized endpoint:
`/api/marketCandles.js?symbol=NIFTY|GOLD|BTC|SP500`

*Count after Step 3*: **5 / 12 Functions** (Available Capacity: **7 Functions**)

---

## 6. Audit Sign-off

- **Audited By**: Antigravity AI Assistant
- **Status**: Report Generated — Awaiting User Authorization for Remediation Implementation.
