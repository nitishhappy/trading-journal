const { admin, db } = require('./_lib/firebase-admin');

function normalizeTimeframe(tf) {
  if (!tf) return "5m";
  const s = String(tf).trim().toLowerCase();
  if (s === "5" || s === "5m") return "5m";
  if (s === "15" || s === "15m") return "15m";
  if (s === "60" || s === "1h" || s === "60m") return "1h";
  if (s === "d" || s === "1d" || s === "daily" || s === "1440") return "1d";
  return s;
}

// GET /api/sp500Ohlc?token=SECRET&timeframe=5m&limit=200
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  if (!db) return res.status(500).json({ error: "Database not initialized" });

  // Token authentication: query param ?token=... or Header Authorization: Bearer <token>
  let token = req.query.token;
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: "Missing authentication token" });
  }

  try {
    const tokenDoc = await db.collection("webhookTokens").doc(token).get();
    if (!tokenDoc.exists) {
      return res.status(403).json({ success: false, error: "Invalid authentication token" });
    }
  } catch (err) {
    console.error("sp500Ohlc: token validation error", err);
    return res.status(500).json({ success: false, error: "Internal authentication error" });
  }

  try {
    const rawTf = req.query.timeframe || req.query.tf || "5m";
    const timeframe = normalizeTimeframe(rawTf);
    const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);

    const snapshot = await db.collection("sp500_candles")
      .where("timeframe", "==", timeframe)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const candles = [];
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

    // Order ascending for technical analysis engines / charts
    candles.sort((a, b) => a.time - b.time);

    const latestTimestamp = candles.length > 0 ? candles[candles.length - 1].time : 0;
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Stale check: > 1 hour old during market activity
    const stale = latestTimestamp === 0 || (nowSeconds - latestTimestamp) > 3600;

    return res.status(200).json({
      success: true,
      symbol: "SP500",
      source: "TRADINGVIEW",
      timeframe,
      count: candles.length,
      latestTimestamp,
      stale,
      candles
    });
  } catch (err) {
    console.error("sp500Ohlc: query error", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
