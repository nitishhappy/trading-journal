import { state } from '../state.js';
import { db, withOptimisticWrite } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let tradeUnsubscribe = null;

export function subscribeTrades() {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("trades")
   .orderBy("createdAt", "desc");
  tradeUnsubscribe = ref.onSnapshot((snap) => {
    state.trades = [];
    snap.forEach((doc) => state.trades.push({ id: doc.id, ...doc.data() }));
    
    // Dispatch custom event to notify trade UI
    window.dispatchEvent(new CustomEvent('trades-updated'));
  }, (err) => {
    console.error("trades load error", err);
    showToast("Failed to load trade log");
  });
}

export function saveTrade(id, data) {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("trades");
  const nowTs = firebase.firestore.Timestamp.now();
  if (id) {
    const payload = {
      ...data,
      updatedAt: nowTs
    };
    const idx = state.trades.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.trades[idx] = { ...state.trades[idx], ...payload };
      window.dispatchEvent(new CustomEvent('trades-updated'));
    }
    return withOptimisticWrite(ref.doc(id).update(payload));
  } else {
    const docRef = ref.doc();
    const payload = {
      ...data,
      createdAt: nowTs,
      updatedAt: nowTs
    };
    if (!state.trades.some((t) => t.id === docRef.id)) {
      state.trades.unshift({ id: docRef.id, ...payload });
      window.dispatchEvent(new CustomEvent('trades-updated'));
    }
    return withOptimisticWrite(docRef.set(payload), docRef);
  }
}

export function deleteTrade(id) {
  state.trades = state.trades.filter((t) => t.id !== id);
  window.dispatchEvent(new CustomEvent('trades-updated'));
  return withOptimisticWrite(
    db.collection("users").doc(state.currentUser.uid).collection("trades").doc(id).delete()
  );
}

export function unsubscribeTrades() {
  if (tradeUnsubscribe) {
    tradeUnsubscribe();
    tradeUnsubscribe = null;
  }
}
