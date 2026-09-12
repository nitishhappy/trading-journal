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

function parseYahooCandles(json) {
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) return [];
  const times = result.timestamp;
  const quote = result.indicators.quote[0];
  const candles = [];
  for (let i = 0; i < times.length; i++) {
    if (quote.open[i] != null && quote.close[i] != null && quote.high[i] != null && quote.low[i] != null) {
      candles.push({
        time: times[i],
        open: Number(quote.open[i].toFixed(2)),
        high: Number(quote.high[i].toFixed(2)),
        low: Number(quote.low[i].toFixed(2)),
        close: Number(quote.close[i].toFixed(2))
      });
    }
  }
  return candles;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const symInput = (req.query.symbol || req.query.asset || "").toUpperCase();
    const queryDate = req.query.date ? req.query.date.trim() : "";
    const instrument = req.query.instrument || "NSE_INDEX|Nifty 50";

    // ── 1. NIFTY 50 CANDLES ────────────────────────────────────────────────
    if (symInput === "NIFTY" || symInput === "NIFTY50" || instrument.includes("Nifty")) {
      const encInst = encodeURIComponent(instrument);
      const now = new Date();
      const todayIst = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const targetDate = queryDate || todayIst;

      let rawCandles = [];
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

      if (targetDate === todayIst) {
        const intradayUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute`;
        rawCandles = await fetchUpstox(intradayUrl);
      }

      if (!rawCandles || rawCandles.length === 0) {
        const targetDt = new Date(`${targetDate}T12:00:00+05:30`);
        const prevDt = new Date(targetDt.getTime() - 24 * 60 * 60 * 1000);
        const prevDateStr = prevDt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

        const histUrl1 = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${targetDate}/${targetDate}`;
        rawCandles = await fetchUpstox(histUrl1);

        if (!rawCandles || rawCandles.length === 0) {
          const histUrl2 = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${targetDate}/${prevDateStr}`;
          rawCandles = await fetchUpstox(histUrl2);
        }
      }

      if (!rawCandles || rawCandles.length === 0) {
        return res.status(200).json({
          success: false,
          message: `No candles found for ${targetDate}.`,
          date: targetDate,
          candles: []
        });
      }

      const filtered1m = rawCandles
        .filter(c => c && c[0] && c[0].startsWith(targetDate))
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

      if (filtered1m.length === 0) {
        return res.status(200).json({
          success: false,
          message: `No candles found for ${targetDate}.`,
          date: targetDate,
          candles: []
        });
      }

      const candles5m = [];
      for (const c of filtered1m) {
        const ts = c[0];
        const dt = new Date(ts);
        const minutes = dt.getMinutes();
        const bucketMin = Math.floor(minutes / 5) * 5;
        const bucketDt = new Date(dt);
        bucketDt.setMinutes(bucketMin, 0, 0);

        const timeStr = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
        const time12  = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

        if (candles5m.length === 0 || candles5m[candles5m.length - 1].timeStr !== timeStr) {
          candles5m.push({
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
          const last = candles5m[candles5m.length - 1];
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
        date: targetDate,
        count: candles5m.length,
        dayHigh: Math.max(...candles5m.map(c => c.high)),
        dayLow: Math.min(...candles5m.map(c => c.low)),
        candles: candles5m
      });
    }

    // ── 2. GOLD / XAUUSD CANDLES ───────────────────────────────────────────
    if (symInput === "GOLD" || symInput === "XAUUSD" || symInput === "XAU") {
      let candles = [];
      const binanceJson = await fetchUrl("https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=5m&limit=100");
      if (Array.isArray(binanceJson) && binanceJson.length > 0) {
        candles = binanceJson.map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(parseFloat(c[1]).toFixed(2)),
          high: parseFloat(parseFloat(c[2]).toFixed(2)),
          low: parseFloat(parseFloat(c[3]).toFixed(2)),
          close: parseFloat(parseFloat(c[4]).toFixed(2))
        }));
      }

      if (candles.length === 0) {
        const yahooJson = await fetchUrl("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=5m&range=1d");
        if (yahooJson) candles = parseYahooCandles(yahooJson);
      }

      return res.status(200).json({
        success: candles.length > 0,
        symbol: "GOLD",
        candles,
        message: candles.length === 0 ? "No Gold candle data available." : undefined
      });
    }

    // ── 3. BTC / BTCUSD CANDLES ────────────────────────────────────────────
    if (symInput === "BTC" || symInput === "BTCUSD" || symInput === "BTCUSDT") {
      let candles = [];
      const binanceJson = await fetchUrl("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100");
      if (Array.isArray(binanceJson) && binanceJson.length > 0) {
        candles = binanceJson.map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(parseFloat(c[1]).toFixed(2)),
          high: parseFloat(parseFloat(c[2]).toFixed(2)),
          low: parseFloat(parseFloat(c[3]).toFixed(2)),
          close: parseFloat(parseFloat(c[4]).toFixed(2))
        }));
      }

      if (candles.length === 0) {
        const yahooJson = await fetchUrl("https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=5m&range=1d");
        if (yahooJson) candles = parseYahooCandles(yahooJson);
      }

      return res.status(200).json({
        success: candles.length > 0,
        symbol: "BTC",
        candles,
        message: candles.length === 0 ? "No BTC candle data available." : undefined
      });
    }

    // ── 4. S&P 500 SPOT INDEX CANDLES (^GSPC) — TRADINGVIEW ONLY ───────────
    if (symInput === "SP500" || symInput === "^GSPC" || symInput === "SPX" || symInput === "SPX500") {
      let candles = [];

      if (db) {
        try {
          const reqTf = req.query.timeframe || req.query.tf || "5m";
          const normTf = (reqTf === "5" || reqTf === "5m") ? "5m" : (reqTf === "15" || reqTf === "15m") ? "15m" : (reqTf === "60" || reqTf === "1h") ? "1h" : (reqTf === "d" || reqTf === "1d") ? "1d" : "5m";
          const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);

          const snapshot = await db.collection("sp500_candles")
            .where("timeframe", "==", normTf)
            .orderBy("timestamp", "desc")
            .limit(limit)
            .get();

          snapshot.forEach(doc => {
            const data = doc.data();
            candles.push({
              time: data.timestamp,
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
              volume: data.volume || 0
            });
          });

          // Order ascending for chart engine
          candles.sort((a, b) => a.time - b.time);
        } catch (e) {
          console.error("api/marketCandles SP500 query error:", e);
        }
      }

      if (candles.length === 0) {
        return res.status(200).json({
          success: false,
          status: "TRADINGVIEW_DATA_UNAVAILABLE",
          symbol: "SP500",
          source: "TRADINGVIEW",
          message: "TradingView S&P 500 candle data is currently unavailable in Firestore.",
          candles: []
        });
      }

      return res.status(200).json({
        success: true,
        symbol: "SP500",
        source: "TRADINGVIEW",
        candles
      });
    }

    return res.status(400).json({
      error: "Invalid or missing 'symbol' parameter. Supported symbols: NIFTY, GOLD, BTC, SP500"
    });

  } catch (err) {
    console.error("api/marketCandles error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
