import { state } from '../state.js';
import { db, withOptimisticWrite } from '../firebase-init.js';
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
  const nowTs = firebase.firestore.Timestamp.now();
  const payload = {
    ...data,
    updatedAt: nowTs
  };
  if (id) {
    return withOptimisticWrite(ref.doc(id).update(payload));
  } else {
    const docRef = ref.doc();
    payload.createdAt = nowTs;
    return withOptimisticWrite(docRef.set(payload), docRef);
  }
}

// Delete template
export function deleteCandleTemplate(id) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  return withOptimisticWrite(
    db.collection("users").doc(state.currentUser.uid)
      .collection("candleChecklistTemplates").doc(id).delete()
  );
}

// Save run
export function saveCandleRun(id, data) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  const ref = db.collection("users").doc(state.currentUser.uid).collection("candleChecklistRuns");
  const nowTs = firebase.firestore.Timestamp.now();
  const payload = {
    ...data,
    updatedAt: nowTs
  };
  if (id) {
    return withOptimisticWrite(ref.doc(id).update(payload));
  } else {
    const docRef = ref.doc();
    payload.createdAt = nowTs;
    return withOptimisticWrite(docRef.set(payload), docRef);
  }
}

// Delete run
export function deleteCandleRun(id) {
  if (!state.currentUser) return Promise.reject("No user logged in");
  return withOptimisticWrite(
    db.collection("users").doc(state.currentUser.uid)
      .collection("candleChecklistRuns").doc(id).delete()
  );
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
