const webpush = require('web-push');
const cors = require('cors')({ origin: true });
const { admin, db } = require('./firebase-admin');
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = require('./vapidConfig');

// Configure web-push VAPID details
try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.error("VAPID config error:", e);
}

// POST /api/sendPush
// Query: token=SECRET (optional)
// Body: { title, body, tag, url, category, uid }
module.exports = async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    if (!db) return res.status(500).send("Database not initialized");

    const { title, body, tag, url, category, uid } = req.body || {};

    try {
      let subscriptions = [];

      // 1. Fetch subscriptions for specific uid if provided
      if (uid) {
        const userSubsSnap = await db.collection("users").doc(uid).collection("pushSubscriptions").get();
        userSubsSnap.forEach(doc => {
          subscriptions.push({ id: doc.id, ref: doc.ref, ...doc.data() });
        });
      }

      // 2. Also fetch from top-level pushSubscriptions collection
      const globalSubsSnap = await db.collection("pushSubscriptions").get();
      globalSubsSnap.forEach(doc => {
        const data = doc.data();
        if (!subscriptions.some(s => s.endpoint === data.endpoint)) {
          subscriptions.push({ id: doc.id, ref: doc.ref, ...data });
        }
      });

      if (subscriptions.length === 0) {
        return res.status(200).json({ ok: true, deliveredCount: 0, message: "No active push subscriptions found" });
      }

      const payload = JSON.stringify({
        title: title || "TradeLog Alert",
        body: body || "New market update received",
        tag: tag || category || "tradelog-push",
        url: url || "./",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      });

      let deliveredCount = 0;
      const sendPromises = subscriptions.map(async (sub) => {
        if (!sub.endpoint || !sub.keys) return;

        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: sub.keys
          }, payload);
          deliveredCount++;
        } catch (err) {
          console.warn("WebPush dispatch failed:", sub.endpoint, err.statusCode || err.message);
          // If subscription expired or unsubscribed, delete from Firestore
          if (err.statusCode === 404 || err.statusCode === 410) {
            if (sub.ref) sub.ref.delete().catch(() => {});
            db.collection("pushSubscriptions").doc(sub.id).delete().catch(() => {});
          }
        }
      });

      await Promise.all(sendPromises);

      return res.status(200).json({
        ok: true,
        deliveredCount,
        totalSubscriptions: subscriptions.length
      });

    } catch (err) {
      console.error("sendPush API Error:", err);
      return res.status(500).json({ error: err.message || err });
    }
  });
};
