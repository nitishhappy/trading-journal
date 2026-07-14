import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';

export let clLogsUnsubscribe = null;
export const CHECKLIST_DEFAULT_ID = "default";

export function subscribeChecklistLogs() {
  const ref = db.collection("users").doc(state.currentUser.uid)
    .collection("checklistLogs")
    .orderBy("createdAt", "desc");
  clLogsUnsubscribe = ref.onSnapshot((snap) => {
    state.checklistLogs = [];
    snap.forEach((doc) => {
      state.checklistLogs.push({ id: doc.id, ...doc.data() });
    });
    window.dispatchEvent(new CustomEvent('checklists-updated'));
  }, (err) => {
    console.error("checklist logs load error", err);
    showToast("Failed to load checklist sessions");
  });
}

export function checklistRef() {
  return db.collection("users").doc(state.currentUser.uid).collection("checklists");
}

export function saveChecklistLog(id, logData) {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("checklistLogs");
  if (id) {
    return ref.doc(id).update({
      ...logData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    return ref.add({
      ...logData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

export function deleteChecklistLog(id) {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("checklistLogs");
  return ref.doc(id).delete();
}

export function saveChecklist(id, data) {
  return checklistRef().doc(id).set(data);
}

export function deleteChecklist(id) {
  return checklistRef().doc(id).delete();
}

export function unsubscribeChecklists() {
  if (clLogsUnsubscribe) {
    clLogsUnsubscribe();
    clLogsUnsubscribe = null;
  }
}
