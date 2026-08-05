import { db, auth } from '../firebase-init.js';
import { state } from '../state.js';

const REGISTER_FN = '/api/tvRegisterToken';
const WEBHOOK_BASE = window.location.origin + '/api/tvWebhook';


let unsubscribe = null;
let cleanupIntervalId = null;

// ===================== 4:00 PM IST Daily Cleanup =====================
export async function cleanPreviousDayTvNotifications() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  try {
    const now = new Date();
    const istTimeString = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const istHour = parseInt(istTimeString.split(':')[0], 10);
    const todayIstStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayIstMidnight = new Date(`${todayIstStr}T00:00:00+05:30`);

    let cleanupCutoff;
    if (istHour >= 16) {
      // At or after 4:00 PM IST: purge all alerts received before today (00:00 IST)
      cleanupCutoff = todayIstMidnight;
    } else {
      // Before 4:00 PM IST: purge alerts older than yesterday (00:00 IST)
      cleanupCutoff = new Date(todayIstMidnight.getTime() - 24 * 60 * 60 * 1000);
    }

    const snap = await db.collection('users').doc(uid)
      .collection('tvNotifications')
      .where('receivedAt', '<', cleanupCutoff)
      .get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`[Live Alerts 4 PM Cleanup] Purged ${snap.size} previous day alert(s).`);
    }
  } catch (err) {
    console.error('cleanPreviousDayTvNotifications error:', err);
  }
}

// ===================== Subscription =====================
export function subscribeTvNotifications() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  // Request browser Notification permissions
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Run cleanup check on startup
  cleanPreviousDayTvNotifications();

  // Run periodic check every 60 seconds to trigger immediately at 4:00 PM IST
  if (cleanupIntervalId) clearInterval(cleanupIntervalId);
  cleanupIntervalId = setInterval(() => {
    cleanPreviousDayTvNotifications();
  }, 60000);

  unsubscribe = db
    .collection('users').doc(uid)
    .collection('tvNotifications')
    .orderBy('receivedAt', 'desc')
    .onSnapshot((snap) => {
      state.tvNotifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.dispatchEvent(new CustomEvent('tv-notifications-updated'));
    }, (err) => console.error('tvNotifications listen error', err));

  // Also setup listener for sequence completions to display browser alerts
  db.collection('users').doc(uid)
    .collection('sequenceTriggerLogs')
    .orderBy('triggeredAt', 'desc')
    .limit(1)
    .onSnapshot((snap) => {
      if (snap.empty) return;
      const newestLog = snap.docs[0].data();
      const trigTime = newestLog.triggeredAt?.toDate ? newestLog.triggeredAt.toDate() : new Date();
      if (Date.now() - trigTime.getTime() < 10000) { // Only notify if within 10s
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`🎯 Sequence Triggered: ${newestLog.ruleName}`, {
            body: `${newestLog.symbol} · ${newestLog.timeframe || '—'} · Price: ₹${(newestLog.price || 0).toLocaleString('en-IN')}`
          });
        }
      }
    });
}

export function unsubscribeTvNotifications() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (cleanupIntervalId) { clearInterval(cleanupIntervalId); cleanupIntervalId = null; }
  state.tvNotifications = [];
}

// ===================== Notification actions =====================
function notifRef(id) {
  const uid = state.currentUser.uid;
  return db.collection('users').doc(uid).collection('tvNotifications').doc(id);
}

export async function markTvNotificationRead(id) {
  await notifRef(id).update({ read: true });
}

export async function deleteTvNotification(id) {
  await notifRef(id).delete();
}

export async function clearAllTvNotifications() {
  const uid = state.currentUser?.uid;
  if (!uid) return;
  const snap = await db.collection('users').doc(uid).collection('tvNotifications').get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ===================== Token management =====================
export function generateToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Saves a new token and optionally removes an old one. */
export async function saveWebhookToken(newToken, oldToken = null) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  // Persist token in user's preferences (readable by the app)
  await db.collection('users').doc(uid)
    .collection('settings').doc('preferences')
    .set({ tvWebhookToken: newToken }, { merge: true });

  // Register in webhookTokens via authenticated Cloud Function
  const idToken = await auth.currentUser.getIdToken();
  const resp = await fetch(REGISTER_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ newToken, deleteToken: oldToken }),
  });
  if (!resp.ok) throw new Error(`Token registration failed: ${resp.status}`);
}

export async function loadWebhookToken() {
  const uid = state.currentUser?.uid;
  if (!uid) return null;
  try {
    const doc = await db.collection('users').doc(uid)
      .collection('settings').doc('preferences').get();
    return doc.exists ? (doc.data().tvWebhookToken || null) : null;
  } catch {
    return null;
  }
}

/** Returns the full webhook URL for a given token. */
export function buildWebhookUrl(token) {
  return `${WEBHOOK_BASE}?token=${token}`;
}
