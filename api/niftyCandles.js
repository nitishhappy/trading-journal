import https from "https";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const queryDate = req.query.date ? req.query.date.trim() : "";
    const instrument = req.query.instrument || "NSE_INDEX|Nifty 50";
    const encInst = encodeURIComponent(instrument);

    // Determine today in IST (UTC+5:30)
    const now = new Date();
    const todayIst = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const targetDate = queryDate || todayIst;

    let rawCandles = [];

    // Helper fetch with https and SSL tolerance
    const fetchUpstox = (url) => {
      return new Promise((resolve) => {
        const req = https.get(url, {
          rejectUnauthorized: false,
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 10000
        }, (resp) => {
          let data = "";
          resp.on("data", (chunk) => { data += chunk; });
          resp.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed?.data?.candles || []);
            } catch (e) {
              resolve([]);
            }
          });
        });
        req.on("error", () => resolve([]));
        req.on("timeout", () => { req.destroy(); resolve([]); });
      });
    };

    if (targetDate === todayIst) {
      // 1. Try Intraday endpoint first for today
      const intradayUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute`;
      rawCandles = await fetchUpstox(intradayUrl);
    }

    // 2. If historical or intraday was empty, try historical endpoint
    if (!rawCandles || rawCandles.length === 0) {
      // Calculate previous day for range fallback
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
        message: `No candles found for ${targetDate}. (Market might have been closed/holiday).`,
        date: targetDate,
        candles: []
      });
    }

    // Filter raw 1m candles for targetDate only and sort chronologically ascending
    const filtered1m = rawCandles
      .filter(c => {
        const ts = c[0];
        return ts && ts.startsWith(targetDate);
      })
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    if (filtered1m.length === 0) {
      return res.status(200).json({
        success: false,
        message: `No candles found for ${targetDate}.`,
        date: targetDate,
        candles: []
      });
    }

    // Aggregate 1m -> 5m candles
    const candles5m = [];
    for (const c of filtered1m) {
      // c: [timestamp, open, high, low, close, volume, oi]
      const ts = c[0];
      const dt = new Date(ts);
      
      // Calculate 5m bucket
      const minutes = dt.getMinutes();
      const bucketMin = Math.floor(minutes / 5) * 5;
      const bucketDt = new Date(dt);
      bucketDt.setMinutes(bucketMin, 0, 0);

      const timeStr = bucketDt.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

      const time12 = bucketDt.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

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
        last.low = Math.min(last.low, Number(c[3]));
        last.close = Number(c[4]);
        last.volume += Number(c[5] || 0);
      }
    }

    return res.status(200).json({
      success: true,
      instrument,
      date: targetDate,
      count: candles5m.length,
      dayHigh: Math.max(...candles5m.map(c => c.high)),
      dayLow: Math.min(...candles5m.map(c => c.low)),
      candles: candles5m
    });

  } catch (err) {
    console.error("api/niftyCandles error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
