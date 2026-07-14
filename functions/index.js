const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
const db = admin.firestore();

// ===================== Token Registration =====================
// Called by the client (with Firebase ID token) to register or rotate a webhook token.
// POST /tvRegisterToken
// Headers: Authorization: Bearer <idToken>
// Body: { newToken: "...", deleteToken: "..." (optional) }
exports.tvRegisterToken = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Verify Firebase ID token
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).send("Unauthorized");
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(auth.split("Bearer ")[1]);
    uid = decoded.uid;
  } catch (e) {
    return res.status(403).send("Invalid auth token");
  }

  const { newToken, deleteToken } = req.body || {};
  const batch = db.batch();

  if (deleteToken) {
    // Remove old reverse-lookup entry (only if it belongs to this user)
    const oldDoc = await db.collection("webhookTokens").doc(deleteToken).get();
    if (oldDoc.exists && oldDoc.data().uid === uid) {
      batch.delete(db.collection("webhookTokens").doc(deleteToken));
    }
  }

  if (newToken) {
    batch.set(db.collection("webhookTokens").doc(newToken), {
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  logger.info("tvRegisterToken: updated token for uid", uid);
  return res.status(200).json({ ok: true });
});



// ===================== TradingView Webhook =====================
// POST https://<region>-<project>.cloudfunctions.net/tvWebhook?token=SECRET
// Body: plain text alert message OR JSON object
exports.tvWebhook = onRequest(async (req, res) => {
  // Allow CORS pre-flight (not strictly needed for TV but keeps things clean)
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).send("");

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const token = req.query.token;
  if (!token) {
    logger.warn("tvWebhook: missing token");
    return res.status(401).send("Missing token");
  }

  // Look up user by token
  const tokenDoc = await db.collection("webhookTokens").doc(token).get();
  if (!tokenDoc.exists) {
    logger.warn("tvWebhook: invalid token", token.slice(0, 8) + "...");
    return res.status(403).send("Invalid token");
  }
  const { uid } = tokenDoc.data();

  // Parse body — try JSON first, fallback to raw string
  let raw = "";
  let parsed = null;

  if (typeof req.body === "object" && req.body !== null) {
    // Express already parsed it as JSON
    parsed = req.body;
    raw = JSON.stringify(req.body);
  } else if (typeof req.body === "string") {
    raw = req.body;
    try { parsed = JSON.parse(raw); } catch (_) { /* plain text */ }
  } else {
    raw = String(req.body || "");
  }

  // Extract fields — prefer explicit JSON keys, then regex on raw text
  const extract = (keys, fallback = null) => {
    if (parsed) {
      for (const k of keys) {
        if (parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== "") {
          return String(parsed[k]).trim();
        }
      }
    }
    return fallback;
  };

  // Symbol: look for NSE:NIFTY, NIFTY, BANKNIFTY, etc.
  let symbol = extract(["symbol", "ticker", "sym"]);
  if (!symbol) {
    const symMatch = raw.match(/\b(NSE:[A-Z]+|BSE:[A-Z]+|[A-Z]{3,12}(?=\s*[,|]?\s*\d+m|\s*\d+[mhd]\b))/i);
    if (symMatch) symbol = symMatch[1].toUpperCase();
  }

  // Interval/timeframe
  let interval = extract(["interval", "timeframe", "tf"]);
  if (!interval) {
    const tfMatch = raw.match(/\b(\d+\s*[mhd])\b/i);
    if (tfMatch) interval = tfMatch[1].replace(/\s+/, "");
  }

  // Action: BUY, SELL, LONG, SHORT, CLOSE, ALERT etc.
  let action = extract(["action", "side", "signal", "type"]);
  if (!action) {
    const actMatch = raw.match(/\b(BUY|SELL|LONG|SHORT|CLOSE|EXIT|ENTRY|ALERT)\b/i);
    if (actMatch) action = actMatch[1].toUpperCase();
    else action = "ALERT";
  } else {
    action = action.toUpperCase();
  }

  // Price
  let price = null;
  const priceRaw = extract(["price", "close", "value"]);
  if (priceRaw !== null) {
    const n = parseFloat(priceRaw);
    if (!isNaN(n)) price = n;
  }
  if (price === null) {
    const priceMatch = raw.match(/\b(\d{4,6}(?:\.\d{1,2})?)\b/);
    if (priceMatch) price = parseFloat(priceMatch[1]);
  }

  // Strategy
  const strategy = extract(["strategy", "name", "alert_name"]);

  // Extra fields (everything except known keys)
  let extra = {};
  if (parsed && typeof parsed === "object") {
    const knownKeys = new Set(["symbol", "ticker", "sym", "interval", "timeframe", "tf",
      "action", "side", "signal", "type", "price", "close", "value", "strategy", "name", "alert_name"]);
    for (const [k, v] of Object.entries(parsed)) {
      if (!knownKeys.has(k)) extra[k] = v;
    }
  }

  // Build notification document
  const notifRef = db.collection("users").doc(uid).collection("tvNotifications").doc();
  await notifRef.set({
    raw,
    symbol: symbol || null,
    action: action || null,
    price: price !== null ? price : null,
    strategy: strategy || null,
    interval: interval || null,
    read: false,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    extra,
    source: "tradingview",
  });

  // GC: Delete notifications older than 2 days for this user
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oldSnaps = await db.collection("users").doc(uid).collection("tvNotifications")
      .where("receivedAt", "<", twoDaysAgo)
      .get();
    
    if (!oldSnaps.empty) {
      const batch = db.batch();
      oldSnaps.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      logger.info(`Cleaned up ${oldSnaps.size} old notifications for uid ${uid}`);
    }
  } catch (err) {
    logger.error("tvWebhook: Firestore write failed", err);
    return res.status(500).send("Internal error");
  }
});
