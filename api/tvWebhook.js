const { admin, db } = require('./firebase-admin');
const { runSequenceEngine } = require('./sequenceEngine');

// POST /api/tvWebhook?token=SECRET
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  if (!db) return res.status(500).send("Database not initialized");

  const token = req.query.token;
  if (!token) return res.status(401).send("Missing token");

  let uid;
  try {
    const tokenDoc = await db.collection("webhookTokens").doc(token).get();
    if (!tokenDoc.exists) {
      return res.status(403).send("Invalid token");
    }
    uid = tokenDoc.data().uid;
  } catch (err) {
    console.error("tvWebhook: token validation error", err);
    return res.status(500).send("Internal error");
  }

  let data = {};
  let raw = "";
  if (req.headers["content-type"] === "application/json") {
    data = req.body;
    raw = JSON.stringify(req.body);
  } else {
    // Plain text
    raw = req.body || "";
    const parsed = parsePlainTextAlert(raw);
    data = { ...parsed };
  }

  const { symbol, action, price, strategy, interval, keyword, timeframe, ...extra } = data;

  // Resolve timeframe: prefer parsed 'timeframe', fall back to 'interval'
  const resolvedTimeframe = timeframe || interval || null;

  const notifRef = db.collection("users").doc(uid).collection("tvNotifications").doc();
  await notifRef.set({
    raw,
    symbol:    symbol    || null,
    action:    action    || null,
    price:     price !== undefined && price !== null ? price : null,
    strategy:  strategy  || null,
    interval:  resolvedTimeframe,
    keyword:   keyword   || null,
    read:      false,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    extra,
    source: "tradingview",
  });

  // Garbage Collection (delete notifications > 2 days old)
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oldSnaps = await db.collection("users").doc(uid).collection("tvNotifications")
      .where("receivedAt", "<", twoDaysAgo)
      .get();
    
    if (!oldSnaps.empty) {
      const batch = db.batch();
      oldSnaps.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error("tvWebhook: cleanup error", err);
  }

  // Auto-clean sequence trigger logs (> 7 days) if enabled in user preferences
  try {
    const prefsDoc = await db.collection("users").doc(uid).collection("settings").doc("preferences").get();
    const autoCleanEnabled = prefsDoc.exists ? (prefsDoc.data().triggerLogAutoClean !== false) : true;
    if (autoCleanEnabled) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const oldLogsSnaps = await db.collection("users").doc(uid).collection("sequenceTriggerLogs")
        .where("triggeredAt", "<", sevenDaysAgo)
        .get();
      if (!oldLogsSnaps.empty) {
        const batch = db.batch();
        oldLogsSnaps.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    console.error("tvWebhook: trigger logs auto-clean error", err);
  }

  // ── Run sequence engine (awaited to prevent Vercel context termination) ──
  if (keyword) {
    try {
      await runSequenceEngine(db, uid, keyword, symbol, resolvedTimeframe, price);
    } catch (err) {
      console.error("tvWebhook: sequenceEngine error", err);
    }
  }

  return res.status(200).send("OK");
};

// ─── Enhanced plain-text alert parser ────────────────────────────────────────
const NON_SYMBOL_WORDS = new Set([
  'BUY', 'SELL', 'CLOSE', 'EXIT', 'ALERT', 'SIGNAL', 'EQUAL', 'FAIR',
  'NEW', 'BREAK', 'HIGH', 'LOW', 'H/L', 'LESS', 'THAN', 'MORE', 'ABOVE', 'BELOW'
]);

function parsePlainTextAlert(text) {
  let parsed = {};
  
  // Quick attempt to parse as JSON if it looks like JSON but sent as plain text
  try {
    if (text.trim().startsWith('{')) {
      const j = JSON.parse(text);
      if (!j.keyword && j.signal) j.keyword = j.signal;
      if (j.keyword) j.keyword = j.keyword.replace(/:$/, "").trim();
      if (j.symbol) j.symbol = cleanSymbol(j.symbol);
      return j;
    }
  } catch(e) {}

  const rawTrimmed = text.trim();
  const parts = rawTrimmed.split(/\s+/);

  // First token is signal keyword — strip trailing colon
  if (parts.length > 0) {
    parsed.keyword = parts[0].replace(/:$/, "").trim();
  }

  // 1. Explicit pattern match for "for {{ticker}} in {{time}} at {{close}}" format
  // e.g. "cemented_candle: SELL signal for XAUUSD in 15 at 4044.770"
  const templateMatch = rawTrimmed.match(/for\s+([A-Z0-9_:-]+)(?:\s+in\s+([A-Z0-9]+))?(?:\s+at\s+([0-9.]+))?/i);
  
  if (templateMatch) {
    parsed.symbol = cleanSymbol(templateMatch[1]);
    if (templateMatch[2]) {
      parsed.timeframe = templateMatch[2].toUpperCase();
      parsed.interval  = parsed.timeframe;
    }
    if (templateMatch[3]) {
      parsed.price = parseFloat(templateMatch[3]);
    }
  }

  // 2. Fallback Symbol Extraction (ad-hoc messages like "NIFTY crossing 1234" or "price_below_ema9 XAUUSD 1H 65432")
  if (!parsed.symbol) {
    const symMatch = rawTrimmed.match(/(?:on|at|for|in|symbol:?)\s+([A-Z0-9_:-]+)/i) ||
                     rawTrimmed.match(/\b([A-Z0-9_]+:[A-Z0-9_]+)\b/i) ||
                     rawTrimmed.match(/\b([A-Z]{3,8}(?:USD|USDT|INR|EUR|GBP)?)\b/i);

    if (symMatch && symMatch[1] && !NON_SYMBOL_WORDS.has(symMatch[1].toUpperCase())) {
      parsed.symbol = cleanSymbol(symMatch[1]);
    } else if (parts.length > 1 && !NON_SYMBOL_WORDS.has(parts[1].toUpperCase())) {
      parsed.symbol = cleanSymbol(parts[1]);
    }
  }

  // Ensure symbol is not a noisy keyword fallback
  if (!parsed.symbol || NON_SYMBOL_WORDS.has(parsed.symbol)) {
    parsed.symbol = "GENERAL";
  }

  // 3. Fallback Timeframe / Interval extraction if not parsed above
  if (!parsed.timeframe) {
    const tfMatch = rawTrimmed.match(/\((\d+[mHhDdWw]?)\)/) || rawTrimmed.match(/\b(\d+[mHhDdWw]?)\b/);
    if (tfMatch) {
      parsed.timeframe = tfMatch[1].toUpperCase();
      parsed.interval  = parsed.timeframe;
    } else if (parts.length > 2 && !isNaN(parseFloat(parts[2]))) {
      parsed.timeframe = parts[2].toUpperCase();
      parsed.interval  = parsed.timeframe;
    }
  }

  // 4. Fallback Price extraction if not parsed above
  if (parsed.price === undefined) {
    const priceMatch = rawTrimmed.match(/(?:at|price:?)\s+([0-9.]+)/i) ||
                       rawTrimmed.match(/\b(\d{3,6}(?:\.\d+)?)\b/);
    if (priceMatch && priceMatch[1] && !isNaN(parseFloat(priceMatch[1]))) {
      parsed.price = parseFloat(priceMatch[1]);
    } else if (parts.length > 3) {
      const p = parseFloat(parts[3]);
      if (!isNaN(p)) parsed.price = p;
    }
  }

  // Action detection
  const kw = (parsed.keyword || '').toLowerCase();
  if (kw.includes("buy") || kw.includes("long"))        parsed.action = "BUY";
  else if (kw.includes("sell") || kw.includes("short")) parsed.action = "SELL";
  else if (kw.includes("exit") || kw.includes("close")) parsed.action = "CLOSE";
  else {
    const str = rawTrimmed.toUpperCase();
    if (str.includes("BUY") || str.includes("LONG"))        parsed.action = "BUY";
    else if (str.includes("SELL") || str.includes("SHORT")) parsed.action = "SELL";
    else if (str.includes("EXIT") || str.includes("CLOSE")) parsed.action = "CLOSE";
    else parsed.action = "ALERT";
  }

  return parsed;
}

function cleanSymbol(sym) {
  if (!sym) return "";
  const cleaned = String(sym)
    .replace(/[\(\),:]/g, " ")  // Remove parens, commas, colons
    .trim()
    .split(/\s+/)[0]            // Take first clean token
    .toUpperCase();
  
  return NON_SYMBOL_WORDS.has(cleaned) ? "GENERAL" : cleaned;
}
