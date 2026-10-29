import { state } from '../state.js';
import { db, withOptimisticWrite } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let journalTradesUnsubscribe = null;

export function subscribeJournalTrades() {
  if (!state.currentUser) return;
  const ref = db.collection("users").doc(state.currentUser.uid).collection("journal_trades")
    .orderBy("createdAt", "asc");

  journalTradesUnsubscribe = ref.onSnapshot((snap) => {
    state.journalTrades = [];
    snap.forEach((doc) => {
      state.journalTrades.push({ id: doc.id, ...doc.data() });
    });
    window.dispatchEvent(new CustomEvent('journal-trades-updated'));
  }, (err) => {
    console.error("journal trades load error", err);
    showToast("Failed to load journal trades");
  });
}

export function unsubscribeJournalTrades() {
  if (journalTradesUnsubscribe) {
    journalTradesUnsubscribe();
    journalTradesUnsubscribe = null;
  }
}

export function saveJournalTrade(id, data) {
  if (!state.currentUser) return Promise.reject(new Error("User not authenticated"));
  const ref = db.collection("users").doc(state.currentUser.uid).collection("journal_trades");
  const nowTs = firebase.firestore.Timestamp.now();
  if (id) {
    const payload = {
      ...data,
      updatedAt: nowTs
    };
    const idx = state.journalTrades.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.journalTrades[idx] = { ...state.journalTrades[idx], ...payload };
      window.dispatchEvent(new CustomEvent('journal-trades-updated'));
    }
    return withOptimisticWrite(ref.doc(id).update(payload));
  } else {
    const docRef = ref.doc();
    const payload = {
      ...data,
      createdAt: nowTs,
      updatedAt: nowTs
    };
    if (!state.journalTrades.some((t) => t.id === docRef.id)) {
      state.journalTrades.push({ id: docRef.id, ...payload });
      window.dispatchEvent(new CustomEvent('journal-trades-updated'));
    }
    return withOptimisticWrite(docRef.set(payload), docRef);
  }
}

export function deleteJournalTrade(id) {
  if (!state.currentUser) return Promise.reject(new Error("User not authenticated"));
  state.journalTrades = state.journalTrades.filter((t) => t.id !== id);
  window.dispatchEvent(new CustomEvent('journal-trades-updated'));
  return withOptimisticWrite(
    db.collection("users").doc(state.currentUser.uid).collection("journal_trades").doc(id).delete()
  );
}

export function getStrategies() {
  return (state.observations || []).filter(o => o.entryType === 'strategy');
}

export function getConcepts() {
  return (state.observations || []).filter(o => o.entryType === 'concept');
}

export function getMistakes() {
  return (state.observations || []).filter(o => o.entryType === 'mistake');
}
