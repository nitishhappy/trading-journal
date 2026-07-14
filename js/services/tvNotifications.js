import { db, auth } from '../firebase-init.js';
import { state } from '../state.js';

const REGISTER_FN = 'https://us-central1-trade-journal-4271e.cloudfunctions.net/tvRegisterToken';
const WEBHOOK_BASE = 'https://us-central1-trade-journal-4271e.cloudfunctions.net/tvWebhook';

let unsubscribe = null;

// ===================== Subscription =====================
export function subscribeTvNotifications() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  unsubscribe = db
    .collection('users').doc(uid)
    .collection('tvNotifications')
    .orderBy('receivedAt', 'desc')
    .onSnapshot((snap) => {
      state.tvNotifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.dispatchEvent(new CustomEvent('tv-notifications-updated'));
    }, (err) => console.error('tvNotifications listen error', err));
}

export function unsubscribeTvNotifications() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
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
