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

  const { symbol, action, price, strategy, interval, keyword, timeframe, image, imageUrl, sl, targets, summary, source, ...extra } = data;

  // Resolve timeframe: prefer parsed 'timeframe', fall back to 'interval'
  const resolvedTimeframe = timeframe || interval || null;
  const resolvedImage = imageUrl || image || null;

  const notifRef = db.collection("users").doc(uid).collection("tvNotifications").doc();
  await notifRef.set({
    raw,
    symbol:    symbol    || null,
    action:    action    || null,
    price:     price !== undefined && price !== null ? price : null,
    strategy:  strategy  || null,
    interval:  resolvedTimeframe,
    keyword:   keyword   || null,
    image:     resolvedImage,
    sl:        sl        || null,
    targets:   targets   || null,
    summary:   summary   || null,
    read:      false,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    extra,
    source:    source    || "tradingview",
  });

  // Garbage Collection & Daily 4:00 PM IST Cleanup
  try {
    const now = new Date();
    const istTimeString = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const istHour = parseInt(istTimeString.split(':')[0], 10);
    const todayIstStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayIstMidnight = new Date(`${todayIstStr}T00:00:00+05:30`);

    let cleanupCutoff;
    if (istHour >= 16) {
      // At or after 4:00 PM IST: purge all alerts from previous days
      cleanupCutoff = todayIstMidnight;
    } else {
      // Before 4:00 PM IST: purge alerts older than yesterday 00:00 IST
      cleanupCutoff = new Date(todayIstMidnight.getTime() - 24 * 60 * 60 * 1000);
    }

    const oldSnaps = await db.collection("users").doc(uid).collection("tvNotifications")
      .where("receivedAt", "<", cleanupCutoff)
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
  'NEW', 'BREAK', 'HIGH', 'LOW', 'H/L', 'LESS', 'THAN', 'MORE', 'ABOVE', 'BELOW',
  'CROSSING', 'CROSS', 'CROSSED', 'CROSSES', 'UP', 'DOWN', 'PRICE', 'VALUE',
  'IN', 'AT', 'FOR', 'ON', 'WITH', 'AND', 'OR', 'IS', 'TO', 'TF', 'THE', 'OF'
]);

// Guard: reject ISO-8601 date strings (e.g. "2026-07-30T13") from being treated as symbols
function isIsoDateLike(str) {
  return /^\d{4}-\d{2}/.test(str);
}

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

  // First token is signal keyword — strip trailing colon AND comma
  if (parts.length > 0) {
    parsed.keyword = parts[0].replace(/[:,]+$/, "").trim();
  }

  // 0. TradingView native crossing alert formats:
  //    Format A: "XAUUSD, 5 Crossing Up price 4091.250 in 2026-07-30T13:35:00Z TF"
  //    Format B: "NESTLEIND Crossing 1,475.2" or "NSE:NESTLEIND Crossing Up 1,475.2" or "NIFTY, 1 Crossing 24,500.50"
  const tvNativeWithDateMatch = rawTrimmed.match(
    /^([A-Z0-9_:\-]+),\s*(\d+[A-Za-z]?)\s+(.+?)\s+(?:price\s+)?([0-9,]+(?:\.[0-9]+)?)\s+in\s+\d{4}-/i
  );
  const tvSimpleCrossingMatch = rawTrimmed.match(
    /^([A-Z0-9_:\-]+)(?:,\s*(\d+[A-Za-z]?))?\s+(Crossing(?:\s+(?:Up|Down))?)\s+(?:price\s+)?([0-9,]+(?:\.[0-9]+)?)/i
  );

  if (tvNativeWithDateMatch) {
    parsed.symbol    = cleanSymbol(tvNativeWithDateMatch[1]);
    parsed.timeframe = tvNativeWithDateMatch[2].toUpperCase();
    parsed.interval  = parsed.timeframe;
    parsed.price     = parseFloat(tvNativeWithDateMatch[4].replace(/,/g, ''));
    parsed.keyword   = tvNativeWithDateMatch[3].replace(/\s+/g, '_').toLowerCase();
  } else if (tvSimpleCrossingMatch) {
    parsed.symbol    = cleanSymbol(tvSimpleCrossingMatch[1]);
    if (tvSimpleCrossingMatch[2]) {
      parsed.timeframe = tvSimpleCrossingMatch[2].toUpperCase();
      parsed.interval  = parsed.timeframe;
    }
    parsed.keyword   = tvSimpleCrossingMatch[3].replace(/\s+/g, '_').toLowerCase();
    parsed.price     = parseFloat(tvSimpleCrossingMatch[4].replace(/,/g, ''));
  }

  // 1. Explicit pattern match for "for {{ticker}} in {{time}} at {{close}}" format
  // e.g. "cemented_candle: SELL signal for XAUUSD in 15 at 4044.770"
  if (!parsed.symbol || parsed.symbol === 'GENERAL') {
    const templateMatch = rawTrimmed.match(/for\s+([A-Z0-9_:-]+)(?:\s+in\s+([A-Z0-9]+))?(?:\s+at\s+([0-9,.]+))?/i);
    
    if (templateMatch) {
      parsed.symbol = cleanSymbol(templateMatch[1]);
      if (templateMatch[2]) {
        parsed.timeframe = templateMatch[2].toUpperCase();
        parsed.interval  = parsed.timeframe;
      }
      if (templateMatch[3]) {
        parsed.price = parseFloat(templateMatch[3].replace(/,/g, ''));
      }
    }
  }

  // 2. Fallback Symbol Extraction (ad-hoc messages like "NIFTY crossing 1234" or "price_below_ema9 XAUUSD 1H 65432")
  if (!parsed.symbol || parsed.symbol === 'GENERAL') {
    const symMatch = rawTrimmed.match(/(?:on|at|for|in|symbol:?)\s+([A-Z0-9_:-]+)/i) ||
                     rawTrimmed.match(/\b([A-Z0-9_]+:[A-Z0-9_]+)\b/i) ||
                     rawTrimmed.match(/\b([A-Z0-9_\-]{2,15}(?:USD|USDT|INR|EUR|GBP)?)\b/i);

    if (symMatch && symMatch[1] && !NON_SYMBOL_WORDS.has(symMatch[1].toUpperCase()) && !isIsoDateLike(symMatch[1])) {
      const candidate = cleanSymbol(symMatch[1]);
      if (candidate && candidate !== 'GENERAL') {
        parsed.symbol = candidate;
      }
    } else if (parts.length > 1 && !NON_SYMBOL_WORDS.has(parts[1].toUpperCase()) && !isIsoDateLike(parts[1])) {
      const candidate = cleanSymbol(parts[1]);
      if (candidate && candidate !== 'GENERAL') {
        parsed.symbol = candidate;
      }
    }
  }

  // 2b. If keyword itself looks like a symbol (e.g. first token was "XAUUSD," or "NESTLEIND"), use it
  if (!parsed.symbol || parsed.symbol === 'GENERAL') {
    const kwClean = cleanSymbol(parsed.keyword || '');
    if (kwClean.length >= 2 && !NON_SYMBOL_WORDS.has(kwClean) && !isIsoDateLike(kwClean)) {
      parsed.symbol = kwClean;
    }
  }

  // Ensure symbol is not a noisy keyword fallback
  if (!parsed.symbol || NON_SYMBOL_WORDS.has(parsed.symbol)) {
    parsed.symbol = "GENERAL";
  }

  // 3. Fallback Timeframe / Interval extraction if not parsed above
  if (!parsed.timeframe) {
    const tfMatch = rawTrimmed.match(/\((\d+[mHhDdWw]?)\)/) ||
                    rawTrimmed.match(/\bin\s+(\d+[mHhDdWw]?)\b/i) ||
                    rawTrimmed.match(/\b(\d+[mHhDdWw])\b/);
    if (tfMatch) {
      parsed.timeframe = tfMatch[1].toUpperCase();
      parsed.interval  = parsed.timeframe;
    } else if (parts.length > 2 && /^\d+[mHhDdWw]?$/.test(parts[2])) {
      parsed.timeframe = parts[2].toUpperCase();
      parsed.interval  = parsed.timeframe;
    }
  }

  // 4. Fallback Price extraction if not parsed above
  if (parsed.price === undefined || isNaN(parsed.price)) {
    const priceMatch = rawTrimmed.match(/(?:at|price:?)\s+([0-9,]+(?:\.[0-9]+)?)/i) ||
                       rawTrimmed.match(/\b([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?)\b/) ||
                       rawTrimmed.match(/\b(\d{2,7}(?:\.\d+)?)\b/);
    if (priceMatch && priceMatch[1]) {
      const cleanP = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (!isNaN(cleanP)) parsed.price = cleanP;
    } else if (parts.length > 3) {
      const p = parseFloat(parts[3].replace(/,/g, ''));
      if (!isNaN(p)) parsed.price = p;
    }
  }

  // Action detection
  const kw = (parsed.keyword || '').toLowerCase();
  if (kw.includes("buy") || kw.includes("long"))        parsed.action = "BUY";
  else if (kw.includes("sell") || kw.includes("short")) parsed.action = "SELL";
  else if (kw.includes("exit") || kw.includes("close")) parsed.action = "EXIT";
  else if (kw.includes("ctc") || kw.includes("breakeven")) parsed.action = "CTC";
  else if (kw.includes("sl") || kw.includes("stop"))   parsed.action = "SL";
  else if (kw.includes("tp") || kw.includes("target")) parsed.action = "TP";
  else {
    const str = rawTrimmed.toUpperCase();
    if (str.includes("BUY") || str.includes("LONG"))        parsed.action = "BUY";
    else if (str.includes("SELL") || str.includes("SHORT")) parsed.action = "SELL";
    else if (str.includes("EXIT") || str.includes("CLOSE")) parsed.action = "EXIT";
    else if (str.includes("CTC") || str.includes("COST TO COST") || str.includes("BREAKEVEN")) parsed.action = "CTC";
    else if (/\b(SL|STOP\s*LOSS|STOPLOSS)\b/.test(str))     parsed.action = "SL";
    else if (/\b(TP|TAKE\s*PROFIT|TAKEPROFIT|TARGET)\b/.test(str)) parsed.action = "TP";
    else parsed.action = "ALERT";
  }

  return parsed;
}

function cleanSymbol(sym) {
  if (!sym) return "";
  let s = String(sym).trim();
  // Strip exchange prefixes like NSE: or BSE: or BINANCE: or NASDAQ:
  if (s.includes(':')) {
    const parts = s.split(':');
    s = parts[parts.length - 1];
  }
  s = s.replace(/[\(\),]/g, " ").trim().split(/\s+/)[0].toUpperCase();
  return NON_SYMBOL_WORDS.has(s) ? "GENERAL" : s;
}
