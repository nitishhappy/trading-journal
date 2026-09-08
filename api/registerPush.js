const cors = require('cors')({ origin: true });
const { admin, db } = require('./firebase-admin');

// POST /api/registerPush
// Body: { endpoint, keys, userAgent, uid }
module.exports = async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    if (!db) return res.status(500).send("Database not initialized");

    const { endpoint, keys, userAgent, uid } = req.body || {};
    if (!endpoint || !keys) return res.status(400).send("Missing endpoint or keys");

    const endpointHash = Buffer.from(endpoint).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);

    try {
      const data = {
        uid: uid || "anonymous",
        endpoint,
        keys,
        userAgent: userAgent || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("pushSubscriptions").doc(endpointHash).set(data, { merge: true });

      if (uid && uid !== "anonymous") {
        await db.collection("users").doc(uid).collection("pushSubscriptions").doc(endpointHash).set(data, { merge: true }).catch(() => {});
      }

      return res.status(200).json({ ok: true, subscriptionId: endpointHash });
    } catch (err) {
      console.error("registerPush error:", err);
      return res.status(500).json({ error: err.message || err });
    }
  });
};
