import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let templatesUnsubscribe = null;
export let runsUnsubscribe = null;

// Subscribe to templates
export function subscribeCandleTemplates() {
  if (!state.currentUser) return;
  const ref = db.collection("users").doc(state.currentUser.uid).collection("candleChecklistTemplates");
  templatesUnsubscribe = ref.onSnapshot((snap) => {
    state.candleChecklistTemplates = [];
    snap.forEach((doc) => {
      state.candleChecklistTemplates.push({ id: doc.id, ...doc.data() });
    });
    window.dispatchEvent(new CustomEvent('candle-templates-updated'));
  }, (err) => {
    console.error("candle templates load error", err);
    showToast("Failed to load candle templates");
  });
}

// Subscribe to runs
export function subscribeCandleRuns() {
  if (!state.currentUser) return;
  const ref = db.collection("users").doc(state.currentUser.uid).collection("candleChecklistRuns")
    .orderBy("createdAt", "desc");
  runsUnsubscribe = ref.onSnapshot((snap) => {
    state.candleChecklistRuns = [];
    snap.forEach((doc) => {
      state.candleChecklistRuns.push({ id: doc.id, ...doc.data() });
    });
    window.dispatchEvent(new CustomEvent('candle-runs-updated'));
  }, (err) => {
    console.error("candle runs load error", err);
    showToast("Failed to load candle checklist runs");
  });
}

export function subscribeCandleChecklists() {
  subscribeCandleTemplates();
  subscribeCandleRuns();
}

// Save template
export function saveCandleTemplate(id, data) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  const ref = db.collection("users").doc(state.currentUser.uid).collection("candleChecklistTemplates");
  const payload = {
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (id) {
    return ref.doc(id).update(payload);
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return ref.add(payload);
  }
}

// Delete template
export function deleteCandleTemplate(id) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  return db.collection("users").doc(state.currentUser.uid)
    .collection("candleChecklistTemplates").doc(id).delete();
}

// Save run
export function saveCandleRun(id, data) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  const ref = db.collection("users").doc(state.currentUser.uid).collection("candleChecklistRuns");
  const payload = {
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (id) {
    return ref.doc(id).update(payload);
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return ref.add(payload);
  }
}

// Delete run
export function deleteCandleRun(id) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  return db.collection("users").doc(state.currentUser.uid)
    .collection("candleChecklistRuns").doc(id).delete();
}

export function unsubscribeCandleChecklists() {
  if (templatesUnsubscribe) {
    templatesUnsubscribe();
    templatesUnsubscribe = null;
  }
  if (runsUnsubscribe) {
    runsUnsubscribe();
    runsUnsubscribe = null;
  }
}
