import { state } from '../state.js';
import { db } from '../firebase-init.js';
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

export function deleteTrade(id) {
  return db.collection("users").doc(state.currentUser.uid).collection("trades").doc(id).delete();
}

export function unsubscribeTrades() {
  if (tradeUnsubscribe) {
    tradeUnsubscribe();
    tradeUnsubscribe = null;
  }
}
