import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let obsUnsubscribe = null;
export let folderUnsubscribe = null;

export function loadFolders() {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("folders");
  folderUnsubscribe = ref.onSnapshot((snap) => {
    const customFolders = [];
    snap.forEach((doc) => customFolders.push(doc.data().name));
    // Merge defaults with custom, preserving order
    const defaults = ["Behaviour", "Technical", "To Do"];
    const merged = [...defaults];
    customFolders.forEach((f) => { if (!merged.includes(f)) merged.push(f); });
    state.folders = merged;
    
    window.dispatchEvent(new CustomEvent('folders-updated'));
  }, (err) => {
    console.error("folders load error", err);
    window.dispatchEvent(new CustomEvent('folders-updated'));
  });
}

export function addCustomFolder(name) {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("folders");
  return ref.add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}

export const CATEGORY_RULES = {
  "Technical": [
    "support", "resistance", "breakout", "breakdown", "trendline", "indicator",
    "rsi", "macd", "moving average", "ema", "sma", "volume", "chart pattern",
    "candlestick", "fibonacci", "pattern", "setup", "level", "consolidation",
    "divergence", "vwap", "bollinger"
  ],
  "Implementation Issue": [
    "bug", "error", "crash", "delay", "slippage", "missed", "wrong order",
    "execution", "glitch", "freeze", "lag", "didn't trigger", "failed",
    "broker issue", "platform issue", "connectivity", "order rejected", "not working"
  ],
  "Behaviour": [
    "fomo", "fear", "greed", "anxious", "anxiety", "discipline", "impulsive",
    "revenge trade", "overtrading", "patience", "confidence", "hesitation",
    "panic", "emotional", "mindset", "stress", "frustrated", "overconfident"
  ],
  "To Do": [
    "todo", "to-do", "need to", "should check", "follow up", "remember to",
    "plan to", "next time", "review later", "pending", "action item"
  ],
};

export function suggestCategory(text, tags) {
  const haystack = ((text || "") + " " + (tags || []).join(" ")).toLowerCase();
  let best = null;
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    let score = 0;
    keywords.forEach((kw) => {
      if (haystack.includes(kw.toLowerCase())) score++;
    });
    if (score > 0 && (!best || score > best.score)) {
      best = { category, score };
    }
  }
  return best;
}

export async function migrateInstaLearningToObservations() {
  try {
    const ilRef = db.collection("users").doc(state.currentUser.uid).collection("ilItems");
    const snap = await ilRef.get();
    if (snap.empty) return;

    const obsCol = db.collection("users").doc(state.currentUser.uid).collection("observations");
    let migrated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      await obsCol.add({
        text: data.text || "",
        links: data.link ? [data.link] : [],
        link: data.link || "",
        tags: (data.tags || []).map((t) => String(t).toLowerCase()),
        folder: data.folder || state.folders[0],
        priority: data.priority || "medium",
        category: data.category || null,
        images: data.images || (data.imageBase64 ? [data.imageBase64] : []),
        imageBase64: null,
        imagePending: !!data.imagePending,
        archived: !!data.archived,
        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await ilRef.doc(doc.id).delete();
      migrated++;
    }
    if (migrated > 0) {
      showToast(`Merged ${migrated} InstaLearning ${migrated === 1 ? "entry" : "entries"} into Observations`);
    }
  } catch (err) {
    console.error("InstaLearning migration error:", err);
  }
}

export function subscribeObservations() {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("observations")
    .orderBy("createdAt", "desc");
  obsUnsubscribe = ref.onSnapshot((snap) => {
    state.observations = [];
    snap.forEach((doc) => {
      const data = doc.data();
      state.observations.push({ id: doc.id, ...data });
    });
    updateAllTags();
    
    // Dispatch custom event to notify dashboard / revision / etc.
    window.dispatchEvent(new CustomEvent('observations-updated'));

    // Automatically trigger cache preloading for all images in background
    preloadObservationImages();
  }, (err) => {
    console.error("observations load error", err);
    showToast("Failed to load observations");
  });
}

function preloadObservationImages() {
  if (!state.observations || state.observations.length === 0) return;
  
  // Extract all unique image URLs from observations
  const imageUrls = new Set();
  state.observations.forEach((o) => {
    const obsImages = o.images && o.images.length > 0 ? o.images : (o.imageBase64 ? [o.imageBase64] : []);
    obsImages.forEach(img => {
      // Avoid data URIs (Base64 is already saved in Firestore document itself, no fetch needed)
      if (img && img.startsWith("http")) {
        imageUrls.add(img);
      }
    });
  });

  // Pre-fetch images quietly in the background
  // Service Worker's fetch event will capture these and cache them in the IMAGE_CACHE
  imageUrls.forEach(url => {
    fetch(url, { mode: 'no-cors' }).catch(() => {});
  });
}

export function updateAllTags() {
  const set = new Set();
  state.observations.forEach((o) => (o.tags || []).forEach((t) => set.add(t)));
  state.allTags = Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function saveObservation(id, data) {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("observations");
  if (id) {
    return ref.doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    return ref.add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

export function deleteObservation(id) {
  return db.collection("users").doc(state.currentUser.uid).collection("observations").doc(id).delete();
}

export function unsubscribeObservations() {
  if (obsUnsubscribe) {
    obsUnsubscribe();
    obsUnsubscribe = null;
  }
  if (folderUnsubscribe) {
    folderUnsubscribe();
    folderUnsubscribe = null;
  }
}