const cors = require('cors')({ origin: true });
const { admin, db } = require('./firebase-admin');

// POST /api/tvRegisterToken
// Headers: Authorization: Bearer <idToken>
// Body: { newToken: "...", deleteToken: "..." (optional) }
module.exports = async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    if (!db) return res.status(500).send("Database not initialized");

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
    return res.status(200).json({ ok: true });
  });
};
