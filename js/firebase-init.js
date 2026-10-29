import { showToast } from './utils/toast.js';

export const firebaseConfig = {
  apiKey: "AIzaSyDw4UTL7v7sfWf1TnM6SJ92q89-8OxPxJo",
  authDomain: "trade-journal-4271e.firebaseapp.com",
  projectId: "trade-journal-4271e",
  storageBucket: "trade-journal-4271e.firebasestorage.app",
  messagingSenderId: "699891654756",
  appId: "1:699891654756:web:0f57bdd4112183dca0ff71",
  measurementId: "G-LMX876Y9D3"
};

firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const db = firebase.firestore();

// Bind to window for global access/compatibility
window.auth = auth;
window.db = db;

export let offlineReady = false;
db.enablePersistence({ synchronizeTabs: true })
  .then(() => { offlineReady = true; })
  .catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Offline persistence unavailable: app is open in another tab.");
    } else if (err.code === "unimplemented") {
      console.warn("Offline persistence unavailable: browser not supported.");
    } else {
      console.error("Offline persistence error:", err);
    }
  });

/**
 * Wraps a Firestore write promise (.set / .update / .add / .delete) so the UI
 * never hangs indefinitely on "Saving..." when offline or when Firestore hits
 * quota backoff (resource-exhausted). With IndexedDB persistence enabled,
 * Firestore queues the write locally and triggers onSnapshot listeners
 * immediately, while the network promise waits for server acknowledgment.
 */
export function withOptimisticWrite(writePromise, fallbackResult = undefined, timeoutMs = 2000) {
  // Prevent unhandled rejection if the background sync fails later
  writePromise.catch((err) => {
    console.warn("[Firestore] Background write sync warning:", err?.code || err?.message || err);
  });

  const waitMs = navigator.onLine ? timeoutMs : 150;
  return Promise.race([
    writePromise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackResult), waitMs))
  ]);
}

export function updateOfflineBadge() {
  const badge = document.getElementById("offline-badge");
  if (!badge) return;
  badge.classList.toggle("hidden", navigator.onLine);
}

window.addEventListener("online", () => {
  updateOfflineBadge();
  showToast("Back online — syncing changes");
});
window.addEventListener("offline", () => {
  updateOfflineBadge();
  showToast("You're offline — changes will sync once reconnected");
});
document.addEventListener("DOMContentLoaded", updateOfflineBadge);
