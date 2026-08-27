const { db } = require('./firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
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
    console.error("latestGoldPrice: token validation error", err);
    return res.status(500).send("Internal error");
  }

  try {
    const snapshot = await db.collection("users").doc(uid).collection("tvNotifications")
      .where("symbol", "==", "XAUUSD")
      .orderBy("receivedAt", "desc")
      .limit(1)
      .get();
      
    if (snapshot.empty) {
      return res.status(404).json({ error: "No XAUUSD price found" });
    }
    
    const data = snapshot.docs[0].data();
    return res.status(200).json({ price: data.price, receivedAt: data.receivedAt });
  } catch (err) {
    console.error("latestGoldPrice: fetch error", err);
    return res.status(500).send("Internal error");
  }
};
