const { admin, db } = require('./firebase-admin');

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

  const { symbol, action, price, strategy, interval, ...extra } = data;

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

  return res.status(200).send("OK");
};

// Extremely simple key-value/JSON parsing logic from plain text if needed.
// Tradingview sends plain text by default but users can format as json.
function parsePlainTextAlert(text) {
  let parsed = {};
  
  // Quick attempt to parse as JSON if it looks like JSON but sent as plain text
  try {
    if (text.trim().startsWith('{')) {
      const j = JSON.parse(text);
      return j;
    }
  } catch(e) {}

  // Fallback to simple extraction
  const str = text.toUpperCase();
  if (str.includes("BUY") || str.includes("LONG")) parsed.action = "BUY";
  else if (str.includes("SELL") || str.includes("SHORT")) parsed.action = "SELL";
  else if (str.includes("EXIT") || str.includes("CLOSE")) parsed.action = "CLOSE";
  else parsed.action = "ALERT";
  
  // Extract symbol (e.g. NSE:NIFTY)
  const symbolMatch = text.match(/[A-Z]+:[A-Z0-9_]+/i);
  if (symbolMatch) parsed.symbol = symbolMatch[0];

  return parsed;
}
