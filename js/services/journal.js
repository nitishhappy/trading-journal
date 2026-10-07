import { state } from '../state.js';
import { db } from '../firebase-init.js';
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

export function deleteJournalTrade(id) {
  if (!state.currentUser) return Promise.reject(new Error("User not authenticated"));
  return db.collection("users").doc(state.currentUser.uid).collection("journal_trades").doc(id).delete();
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
