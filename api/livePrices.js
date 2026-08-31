import https from "https";

const fetchUrl = (url) => {
  return new Promise((resolve) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 8000
    }, (resp) => {
      let data = "";
      resp.on("data", (chunk) => { data += chunk; });
      resp.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
};

export default async function handler(req, res) {
  // CORS & Cache-Control
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Fetch Nifty Price
    const instrument = "NSE_INDEX|Nifty 50";
    const encInst = encodeURIComponent(instrument);
    const now = new Date();
    const todayIst = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    let candles = [];
    
    // Try intraday first
    const intradayUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute`;
    const niftyRes = await fetchUrl(intradayUrl);
    if (niftyRes?.data?.candles && niftyRes.data.candles.length > 0) {
      candles = niftyRes.data.candles;
    }

    // Fallback to historical today if intraday was empty
    if (candles.length === 0) {
      const histUrl = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${todayIst}/${todayIst}`;
      const histRes = await fetchUrl(histUrl);
      if (histRes?.data?.candles && histRes.data.candles.length > 0) {
        candles = histRes.data.candles;
      }
    }

    // Fallback to historical yesterday / previous day if today is empty (weekend/holiday)
    if (candles.length === 0) {
      const prevDt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const prevDateStr = prevDt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const histUrl = `https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${prevDateStr}/${prevDateStr}`;
      const histRes = await fetchUrl(histUrl);
      if (histRes?.data?.candles && histRes.data.candles.length > 0) {
        candles = histRes.data.candles;
      }
    }

    let niftyPrice = null;
    if (candles.length > 0) {
      const sorted = candles
        .filter(c => c && c[0])
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
      if (sorted.length > 0) {
        niftyPrice = Number(sorted[sorted.length - 1][4]); // close price is index 4
      }
    }

    // 2. Fetch XAU/USD Price
    const xauUrl = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";
    const xauRes = await fetchUrl(xauUrl);
    
    let xauusdPrice = null;
    if (Array.isArray(xauRes) && xauRes.length > 0) {
      const first = xauRes[0];
      const prices = first.spreadProfilePrices;
      if (Array.isArray(prices) && prices.length > 0) {
        const premium = prices.find(p => p.spreadProfile === 'premium') || prices[0];
        if (premium && premium.bid && premium.ask) {
          xauusdPrice = Number(((premium.bid + premium.ask) / 2).toFixed(2));
        }
      }
    }

    // 3. Fetch S&P 500 Price (^GSPC)
    const spUrl = "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d";
    const spRes = await fetchUrl(spUrl);
    
    let sp500Price = null;
    if (spRes?.chart?.result?.[0]) {
      const result = spRes.chart.result[0];
      if (result.meta && result.meta.regularMarketPrice) {
        sp500Price = Number(result.meta.regularMarketPrice);
      }
      if (!sp500Price && result.indicators?.quote?.[0]?.close) {
        const closes = result.indicators.quote[0].close.filter(c => c !== null && c !== undefined);
        if (closes.length > 0) {
          sp500Price = Number(closes[closes.length - 1]);
        }
      }
    }

    return res.status(200).json({
      success: true,
      nifty: niftyPrice,
      xauusd: xauusdPrice,
      sp500: sp500Price,
      timestamp: Date.now()
    });

  } catch (err) {
    console.error("api/livePrices error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
