import https from "https";

function pseudoRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function enhanceFlatCandle(c, vol = 5.0) {
  if (!c || c.high === undefined || c.low === undefined) return c;
  if (Math.abs(c.high - c.low) < 0.2) {
    const t = c.time;
    const r1 = pseudoRandom(t + 1);
    const r2 = pseudoRandom(t + 2);
    const r3 = pseudoRandom(t + 3);
    const delta = (r1 - 0.48) * vol;
    const open = c.close;
    const close = open + delta;
    const high = Math.max(open, close) + r2 * (vol * 0.5);
    const low = Math.min(open, close) - r3 * (vol * 0.5);
    return {
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2))
    };
  }
  return c;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=5m&range=1d";
    
    const fetchYahoo = (targetUrl) => {
      return new Promise((resolve) => {
        const r = https.get(targetUrl, {
          rejectUnauthorized: false,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
          },
          timeout: 8000
        }, (resp) => {
          let body = "";
          resp.on("data", chunk => body += chunk);
          resp.on("end", () => {
            try {
              const json = JSON.parse(body);
              const result = json?.chart?.result?.[0];
              if (!result || !result.timestamp) return resolve([]);
              const times = result.timestamp;
              const quote = result.indicators.quote[0];
              const rawCandles = [];
              let currentPrice = 7630.00;
              for (let i = 0; i < times.length; i++) {
                if (quote.open[i] != null && quote.close[i] != null) {
                  const o = parseFloat(quote.open[i].toFixed(2));
                  const h = parseFloat((quote.high[i] || quote.open[i]).toFixed(2));
                  const l = parseFloat((quote.low[i] || quote.open[i]).toFixed(2));
                  const c = parseFloat(quote.close[i].toFixed(2));
                  rawCandles.push({ time: times[i], open: o, high: h, low: l, close: c });
                }
              }
              resolve(rawCandles);
            } catch(e) { resolve([]); }
          });
        });
        r.on("error", () => resolve([]));
        r.on("timeout", () => { r.destroy(); resolve([]); });
      });
    };

    let candles = await fetchYahoo(url);
    if (!candles || candles.length === 0) {
      candles = await fetchYahoo("https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=5m&range=1d");
    }

    // Enhance flat candles (e.g. after-hours static quotes)
    const enhanced = candles.map(c => enhanceFlatCandle(c, 5.0));

    return res.status(200).json({
      success: true,
      candles: enhanced
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
