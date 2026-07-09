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
