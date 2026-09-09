import https from "https";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Primary: Binance PAXGUSDT 5m klines (Gold-backed token, tracks XAU/USD)
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

    // Fallback: Yahoo Finance GC=F (Gold Futures 5m)
    if (candles.length === 0) {
      const yahooJson = await fetchUrl("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=5m&range=1d");
      const result = yahooJson?.chart?.result?.[0];
      if (result && result.timestamp) {
        const times = result.timestamp;
        const quote = result.indicators.quote[0];
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
      }
    }

    if (candles.length === 0) {
      return res.status(200).json({ success: false, candles: [], message: "No Gold candle data available." });
    }

    return res.status(200).json({ success: true, candles });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
