import { db, auth } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export const PUBLIC_VAPID_KEY = "BJ6MUAFgyMffeg6HKfdXFhhuzVG6oga2wT4gBuPJgJtsNBIOEQBgIcMUwo-XuRvGjI9Ab48Xicaup4qO7fb5Z4o";

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register current device/browser for Lock-Screen Web Push Notifications
 */
export async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn("Web Push is not supported on this browser.");
    showToast("Web Push Notifications are not supported by this browser");
    return null;
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast("Notification permission denied by browser settings");
      return null;
    }

    // 2. Wait for Service Worker registration
    const registration = await navigator.serviceWorker.ready;

    // 3. Get existing or create new PushSubscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // 4. Save PushSubscription payload to Firestore
    const user = auth.currentUser;
    const subJson = subscription.toJSON();
    const endpointHash = btoa(subJson.endpoint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);

    const timestamp = (typeof window !== 'undefined' && window.firebase?.firestore?.FieldValue?.serverTimestamp)
      ? window.firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();

    if (user && db) {
      await db.collection("users").doc(user.uid).collection("pushSubscriptions").doc(endpointHash).set({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
        updatedAt: timestamp
      }, { merge: true });
    }

    // Also store globally in top-level pushSubscriptions collection for easy server access
    if (db) {
      await db.collection("pushSubscriptions").doc(endpointHash).set({
        uid: user ? user.uid : "anonymous",
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
        updatedAt: timestamp
      }, { merge: true });
    }

    localStorage.setItem("tradelog_webpush_subscribed", "true");
    console.log("Web Push Subscription active:", endpointHash);
    showToast("🟢 Lock-Screen Web Push Activated!");
    return subscription;

  } catch (err) {
    console.error("Failed to subscribe user to Web Push:", err);
    showToast("Web Push subscription failed: " + (err.message || err));
    return null;
  }
}

/**
 * Unsubscribe current device from Web Push
 */
export async function unsubscribeUserFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subJson = subscription.toJSON();
      const endpointHash = btoa(subJson.endpoint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
      await subscription.unsubscribe();

      const user = auth.currentUser;
      if (user && db) {
        await db.collection("users").doc(user.uid).collection("pushSubscriptions").doc(endpointHash).delete().catch(() => {});
      }
      if (db) {
        await db.collection("pushSubscriptions").doc(endpointHash).delete().catch(() => {});
      }
    }

    localStorage.removeItem("tradelog_webpush_subscribed");
    console.log("Web Push Subscription removed");
  } catch (err) {
    console.error("Error unsubscribing from Web Push:", err);
  }
}

/**
 * Check if active PushSubscription exists
 */
export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (err) {
    return false;
  }
}

// Bind to window for debug / inline compatibility
window.subscribeUserToPush = subscribeUserToPush;
window.unsubscribeUserFromPush = unsubscribeUserFromPush;
window.isPushSubscribed = isPushSubscribed;
