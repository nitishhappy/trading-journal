import https from "https";
import fbAdmin from "./_lib/firebase-admin.js";

const db = fbAdmin ? fbAdmin.db : null;

const fetchUrl = (url) => {
  return new Promise((resolve) => {
    const r = https.get(url, {
      rejectUnauthorized: false,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      },
      timeout: 10000
    }, (resp) => {
      let body = "";
      resp.on("data", chunk => body += chunk);
      resp.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve(null); }
      });
    });
    r.on("error", () => resolve(null));
    r.on("timeout", () => { r.destroy(); resolve(null); });
  });
};

function parseYahooCandles(json, digits = 2) {
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) return [];
  const times = result.timestamp;
  const quote = result.indicators.quote[0];
  const candles = [];
  for (let i = 0; i < times.length; i++) {
    if (quote.open[i] != null && quote.close[i] != null && quote.high[i] != null && quote.low[i] != null) {
      candles.push({
        time: times[i],
        open: Number(quote.open[i].toFixed(digits)),
        high: Number(quote.high[i].toFixed(digits)),
        low: Number(quote.low[i].toFixed(digits)),
        close: Number(quote.close[i].toFixed(digits)),
        volume: quote.volume ? (quote.volume[i] || 0) : 0
      });
    }
  }
  return candles;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=10, s-maxage=10, stale-while-revalidate=30");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const symInput = (req.query.symbol || req.query.asset || "").toUpperCase();
    const queryDate = req.query.date ? req.query.date.trim() : "";
    const instrument = req.query.instrument || "";

    // ── 1. NIFTY 50 CANDLES ────────────────────────────────────────────────
    if (symInput === "NIFTY" || symInput === "NIFTY50" || (instrument && instrument.includes("Nifty"))) {
      const resolvedInstrument = instrument || "NSE_INDEX|Nifty 50";
      const encInst = encodeURIComponent(resolvedInstrument);
      const now = new Date();
      const todayIst = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const targetDate = queryDate || todayIst;

      let candles5m = [];
      const isFullRange = (req.query.range === "1mo" || req.query.range === "30d" || !queryDate);

      // 1. If full range requested (interactive chart mode), fetch 1-month 5m continuous candles from Yahoo ^NSEI
      if (isFullRange) {
        try {
          const yUrl = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=5m&range=1mo";
          const yJson = await fetchUrl(yUrl);
          if (yJson) {
            const parsed = parseYahooCandles(yJson);
            if (parsed && parsed.length > 0) {
              candles5m = parsed;
            }
          }
        } catch (e) {
          console.warn("api/marketCandles Yahoo ^NSEI fetch error:", e);
        }
      }

      // 2. Fetch Upstox candles (for today's live session or specific targetDate)
      const fetchUpstox = (url) => {
        return new Promise((resolve) => {
          const r = https.get(url, {
            rejectUnauthorized: false,
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            timeout: 10000
          }, (resp) => {
            let data = "";
            resp.on("data", chunk => data += chunk);
            resp.on("end", () => {
              try { resolve(JSON.parse(data)?.data?.candles || []); }
              catch (e) { resolve([]); }
            });
          });
          r.on("error", () => resolve([]));
          r.on("timeout", () => { r.destroy(); resolve([]); });
        });
      };

      let rawUpstox = [];
      if (targetDate === todayIst) {
        const intradayUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute`;
        rawUpstox = await fetchUpstox(intradayUrl);
      }

      if ((!rawUpstox || rawUpstox.length === 0) && queryDate) {
        const targetDt = new Date(`${targetDate}T12:00:00+05:30`);
        const lookbackDt = new Date(targetDt.getTime() - 5 * 24 * 60 * 60 * 1000);
        const lookbackDateStr = lookbackDt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

        const histUrl1 = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${targetDate}/${targetDate}`;
        rawUpstox = await fetchUpstox(histUrl1);

        if (!rawUpstox || rawUpstox.length === 0) {
          const histUrl2 = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${targetDate}/${lookbackDateStr}`;
          rawUpstox = await fetchUpstox(histUrl2);
        }
      }

      // If user passed a single date query, filter or resample Upstox for that single session
      if (queryDate && rawUpstox && rawUpstox.length > 0) {
        const filtered1m = rawUpstox
          .filter(c => c && c[0] && c[0].startsWith(queryDate))
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

        if (filtered1m.length > 0) {
          const dayCandles = [];
          for (const c of filtered1m) {
            const ts = c[0];
            const dt = new Date(ts);
            const minutes = dt.getMinutes();
            const bucketMin = Math.floor(minutes / 5) * 5;
            const bucketDt = new Date(dt);
            bucketDt.setMinutes(bucketMin, 0, 0);

            const timeStr = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
            const time12  = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
            const timeSec = Math.floor(bucketDt.getTime() / 1000);

            if (dayCandles.length === 0 || dayCandles[dayCandles.length - 1].timeStr !== timeStr) {
              dayCandles.push({
                time: timeSec,
                timeStr,
                time12,
                timestamp: ts,
                open: Number(c[1]),
                high: Number(c[2]),
                low: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5] || 0)
              });
            } else {
              const last = dayCandles[dayCandles.length - 1];
              last.high = Math.max(last.high, Number(c[2]));
              last.low  = Math.min(last.low, Number(c[3]));
              last.close = Number(c[4]);
              last.volume += Number(c[5] || 0);
            }
          }
          return res.status(200).json({
            success: true,
            symbol: "NIFTY",
            instrument,
            date: queryDate,
            isLatestTradingDay: queryDate === todayIst,
            marketClosed: queryDate !== todayIst,
            count: dayCandles.length,
            dayHigh: Math.max(...dayCandles.map(c => c.high)),
            dayLow: Math.min(...dayCandles.map(c => c.low)),
            candles: dayCandles
          });
        }
      }

      // If Upstox had today's intraday bars, merge newer bars on top of Yahoo history
      if (rawUpstox && rawUpstox.length > 0 && candles5m.length > 0) {
        const lastYahooTime = candles5m[candles5m.length - 1].time;
        for (const c of rawUpstox) {
          const tSec = Math.floor(new Date(c[0]).getTime() / 1000);
          if (tSec > lastYahooTime) {
            candles5m.push({
              time: tSec,
              open: Number(c[1]),
              high: Number(c[2]),
              low: Number(c[3]),
              close: Number(c[4]),
              volume: Number(c[5] || 0)
            });
          }
        }
      }

      if (candles5m.length === 0) {
        return res.status(200).json({
          success: false,
          message: `No NIFTY candles found for ${targetDate}.`,
          date: targetDate,
          candles: []
        });
      }

      return res.status(200).json({
        success: true,
        symbol: "NIFTY",
        instrument,
        date: targetDate,
        isLatestTradingDay: targetDate === todayIst,
        marketClosed: targetDate !== todayIst,
        count: candles5m.length,
        dayHigh: Math.max(...candles5m.map(c => c.high)),
        dayLow: Math.min(...candles5m.map(c => c.low)),
        candles: candles5m
      });
    }

    // ── 2. GOLD / XAUUSD CANDLES ───────────────────────────────────────────
    // ── 2. GOLD / XAUUSD CANDLES (Vantage MT5 & Swissquote Spot) ───────────
    if (symInput === "GOLD" || symInput === "XAUUSD" || symInput === "XAU") {
      let candles = [];
      const reqTf = (req.query.timeframe || req.query.tf || req.query.interval || "5m").toLowerCase();
      const normTf = (reqTf === "15" || reqTf === "15m") ? "15m" : "5m";

      // 1. Try Firestore gold_candles collection (populated by Vantage MT5 sync)
      if (db) {
        try {
          const limit = Math.min(parseInt(req.query.limit || "200", 10), 500);
          const cutoffSec = Math.floor(Date.now() / 1000) - (48 * 3600);
          const rawCandles = [];

          if (fbAdmin?.admin?.firestore?.FieldPath) {
            const startDocId = `GOLD_${normTf}_${cutoffSec}`;
            const endDocId = `GOLD_${normTf}_\uf8ff`;
            const snapshot = await db.collection("gold_candles")
              .where(fbAdmin.admin.firestore.FieldPath.documentId(), ">=", startDocId)
              .where(fbAdmin.admin.firestore.FieldPath.documentId(), "<=", endDocId)
              .get();

            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.timestamp && data.open !== undefined) {
                rawCandles.push({
                  time: data.timestamp,
                  open: data.open,
                  high: data.high,
                  low: data.low,
                  close: data.close,
                  volume: data.volume || 0
                });
              }
            });
          }

          if (rawCandles.length === 0) {
            const legacySnapshot = await db.collection("gold_candles")
              .where("timeframe", "==", normTf)
              .get();
            legacySnapshot.forEach(doc => {
              const data = doc.data();
              if (data.timestamp >= cutoffSec) {
                rawCandles.push({
                  time: data.timestamp,
                  open: data.open,
                  high: data.high,
                  low: data.low,
                  close: data.close,
                  volume: data.volume || 0
                });
              }
            });
          }

          rawCandles.sort((a, b) => b.time - a.time);
          candles = rawCandles.slice(0, limit);
          candles.sort((a, b) => a.time - b.time);
        } catch (e) {
          console.error("api/marketCandles GOLD query error:", e);
        }
      }

      // 2. Fallback: Swissquote BBO Spot Anchor (never synthetic, never Binance PAXG discount)
      if (candles.length === 0) {
        try {
          const sqData = await fetchUrl("https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD");
          if (Array.isArray(sqData) && sqData.length > 0) {
            const prices = sqData[0].spreadProfilePrices || [];
            if (prices.length > 0) {
              const premium = prices[0];
              const spot = Number(((Number(premium.bid) + Number(premium.ask)) / 2).toFixed(2));
              const nowSec = Math.floor(Date.now() / 1000);
              candles = [{
                time: nowSec,
                open: spot,
                high: spot,
                low: spot,
                close: spot,
                volume: 1
              }];
            }
          }
        } catch (e) {
          console.error("api/marketCandles Swissquote fallback error:", e);
        }
      }

      return res.status(200).json({
        success: candles.length > 0,
        symbol: "GOLD",
        source: candles.length === 1 ? "SWISSQUOTE_BBO" : "VANTAGE_MT5",
        timeframe: normTf,
        candles,
        message: candles.length === 0 ? "No Spot Gold candle data available from Vantage MT5 or Swissquote." : undefined
      });
    }

    // ── 3. BTC / BTCUSD CANDLES ────────────────────────────────────────────
    if (symInput === "BTC" || symInput === "BTCUSD" || symInput === "BTCUSDT") {
      let candles = [];
      const reqTf = (req.query.timeframe || req.query.tf || req.query.interval || "15m").toLowerCase();
      const normTf = (reqTf.includes("5m") && !reqTf.includes("15")) ? "5m" : "15m";
      const limit = Math.min(parseInt(req.query.limit || "1000", 10), 1000);
      const binanceJson = await fetchUrl(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${normTf}&limit=${limit}`);
      if (Array.isArray(binanceJson) && binanceJson.length > 0) {
        candles = binanceJson.map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(parseFloat(c[1]).toFixed(2)),
          high: parseFloat(parseFloat(c[2]).toFixed(2)),
          low: parseFloat(parseFloat(c[3]).toFixed(2)),
          close: parseFloat(parseFloat(c[4]).toFixed(2)),
          volume: parseFloat(c[5]) || 0
        }));
      }

      let source = "BINANCE";
      if (candles.length < 500) {
        const yahooJson = await fetchUrl(`https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=${normTf}&range=1mo`);
        if (yahooJson) {
          const yCandles = parseYahooCandles(yahooJson);
          if (yCandles && yCandles.length > 0) {
            candles = yCandles;
            source = "YAHOO_FINANCE";
          }
        }
      }

      return res.status(200).json({
        success: candles.length > 0,
        symbol: "BTC",
        source,
        timeframe: normTf,
        candles,
        message: candles.length === 0 ? "No BTC candle data available." : undefined
      });
    }

    // ── 4. S&P 500 SPOT INDEX CANDLES (^GSPC) ──────────────────────────────
    if (symInput === "SP500" || symInput === "^GSPC" || symInput === "SPX" || symInput === "SPX500") {
      let candles = [];
      let source = "TRADINGVIEW";

      const reqTf = req.query.timeframe || req.query.tf || "5m";
      const normTf = (reqTf === "5" || reqTf === "5m") ? "5m" : (reqTf === "15" || reqTf === "15m") ? "15m" : (reqTf === "60" || reqTf === "1h") ? "1h" : (reqTf === "d" || reqTf === "1d") ? "1d" : "5m";

      if (db) {
        try {
          const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
          const cutoffSec = Math.floor(Date.now() / 1000) - (5 * 24 * 3600);
          const rawCandles = [];

          if (fbAdmin?.admin?.firestore?.FieldPath) {
            const startDocId = `SP500_${normTf}_${cutoffSec}`;
            const endDocId = `SP500_${normTf}_\uf8ff`;
            const snapshot = await db.collection("sp500_candles")
              .where(fbAdmin.admin.firestore.FieldPath.documentId(), ">=", startDocId)
              .where(fbAdmin.admin.firestore.FieldPath.documentId(), "<=", endDocId)
              .get();

            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.timestamp && data.open !== undefined) {
                rawCandles.push({
                  time: data.timestamp,
                  open: data.open,
                  high: data.high,
                  low: data.low,
                  close: data.close,
                  volume: data.volume || 0
                });
              }
            });
          }

          if (rawCandles.length === 0) {
            const legacySnapshot = await db.collection("sp500_candles")
              .where("timeframe", "==", normTf)
              .get();
            legacySnapshot.forEach(doc => {
              const data = doc.data();
              if (data.timestamp >= cutoffSec) {
                rawCandles.push({
                  time: data.timestamp,
                  open: data.open,
                  high: data.high,
                  low: data.low,
                  close: data.close,
                  volume: data.volume || 0
                });
              }
            });
          }

          rawCandles.sort((a, b) => b.time - a.time);
          candles = rawCandles.slice(0, limit);
          candles.sort((a, b) => a.time - b.time);
        } catch (e) {
          console.error("api/marketCandles SP500 query error:", e);
        }
      }

      // Check if Firestore candles are empty or stale (> 45 minutes old)
      const nowSec = Math.floor(Date.now() / 1000);
      const isStale = candles.length === 0 || (nowSec - candles[candles.length - 1].time) > 2700;

      if (isStale) {
        try {
          const yahooInterval = (normTf === "15m") ? "15m" : (normTf === "1h") ? "60m" : (normTf === "1d") ? "1d" : "5m";
          const yahooRange = req.query.range || "1mo";
          const yahooJson = await fetchUrl(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=${yahooInterval}&range=${yahooRange}`);
          if (yahooJson) {
            const yCandles = parseYahooCandles(yahooJson);
            if (yCandles && yCandles.length > 0) {
              candles = yCandles;
              source = "YAHOO_FINANCE";
            }
          }
        } catch (e) {
          console.error("api/marketCandles SP500 Yahoo fallback error:", e);
        }
      }

      if (candles.length === 0) {
        return res.status(200).json({
          success: false,
          status: "DATA_UNAVAILABLE",
          symbol: "SP500",
          source: "TRADINGVIEW",
          message: "S&P 500 candle data is currently unavailable.",
          candles: []
        });
      }

      return res.status(200).json({
        success: true,
        symbol: "SP500",
        source,
        candles
      });
    }

    // ── 5. EUR/USD CANDLES ────────────────────────────────────────────────
    if (symInput === "EURUSD" || symInput === "EUR/USD" || symInput === "EUR_USD") {
      let candles = [];
      let source = "YAHOO_FINANCE";
      const reqTf = (req.query.timeframe || req.query.tf || req.query.interval || "5m").toLowerCase();
      const normTf = (reqTf === "15" || reqTf === "15m") ? "15m" : (reqTf === "60" || reqTf === "1h") ? "60m" : (reqTf === "d" || reqTf === "1d") ? "1d" : "5m";

      // 1. Try Yahoo Finance for EURUSD=X (5-decimal precision)
      try {
        const yahooRange = req.query.range || "1mo";
        const yahooJson = await fetchUrl(`https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=${normTf}&range=${yahooRange}`);
        if (yahooJson) {
          const yCandles = parseYahooCandles(yahooJson, 5);
          if (yCandles && yCandles.length > 0) {
            candles = yCandles;
          }
        }
      } catch (e) {
        console.error("api/marketCandles EURUSD Yahoo error:", e);
      }

      // 2. Fallback: Swissquote spot quote if candles are empty
      if (candles.length === 0) {
        try {
          const sqData = await fetchUrl("https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/EUR/USD");
          if (Array.isArray(sqData) && sqData.length > 0) {
            const prices = sqData[0].spreadProfilePrices || [];
            if (prices.length > 0) {
              const premium = prices[0];
              const spot = Number(((Number(premium.bid) + Number(premium.ask)) / 2).toFixed(5));
              const nowSec = Math.floor(Date.now() / 1000);
              candles = [{
                time: nowSec,
                open: spot,
                high: spot,
                low: spot,
                close: spot,
                volume: 1
              }];
              source = "SWISSQUOTE_BBO";
            }
          }
        } catch (e) {
          console.error("api/marketCandles EURUSD Swissquote fallback error:", e);
        }
      }

      return res.status(200).json({
        success: candles.length > 0,
        symbol: "EURUSD",
        source,
        timeframe: normTf,
        candles,
        message: candles.length === 0 ? "No EURUSD candle data available." : undefined
      });
    }

    return res.status(400).json({
      error: "Invalid or missing 'symbol' parameter. Supported symbols: NIFTY, GOLD, BTC, SP500, EURUSD"
    });

  } catch (err) {
    console.error("api/marketCandles error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
