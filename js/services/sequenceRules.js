import { db, auth } from '../firebase-init.js';
import { state } from '../state.js';

let unsubscribeRules = null;
let unsubscribeLogs = null;
let unsubscribeStates = null;

// ===================== Sequence Rules CRUD =====================

export function subscribeSequenceRules() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  unsubscribeRules = db
    .collection('users').doc(uid)
    .collection('sequenceRules')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => {
      state.sequenceRules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.dispatchEvent(new CustomEvent('sequence-rules-updated'));
    }, (err) => console.error('sequenceRules listen error', err));
}

export function unsubscribeSequenceRules() {
  if (unsubscribeRules) { unsubscribeRules(); unsubscribeRules = null; }
  state.sequenceRules = [];
}

export async function createSequenceRule(name, steps, enabled = true) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  await db.collection('users').doc(uid)
    .collection('sequenceRules')
    .add({
      name,
      steps,
      enabled,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

export async function updateSequenceRule(id, name, steps, enabled) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  await db.collection('users').doc(uid)
    .collection('sequenceRules').doc(id)
    .update({
      name,
      steps,
      enabled,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

export async function deleteSequenceRule(id) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  // Delete rule
  await db.collection('users').doc(uid)
    .collection('sequenceRules').doc(id)
    .delete();

  // Also clean up any active states associated with this rule
  const statesSnap = await db.collection('users').doc(uid)
    .collection('sequenceStates')
    .where('ruleId', '==', id)
    .get();

  const batch = db.batch();
  statesSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function toggleSequenceRule(id, enabled) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  const batch = db.batch();

  // Update enabled status
  const ruleRef = db.collection('users').doc(uid)
    .collection('sequenceRules').doc(id);
  batch.update(ruleRef, {
    enabled,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // If disabling, clean up any active states associated with this rule
  if (!enabled) {
    const statesSnap = await db.collection('users').doc(uid)
      .collection('sequenceStates')
      .where('ruleId', '==', id)
      .get();
    
    statesSnap.docs.forEach(d => batch.delete(d.ref));
  }

  await batch.commit();
}

// ===================== Sequence Trigger Logs =====================

export function subscribeSequenceTriggerLogs() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  unsubscribeLogs = db
    .collection('users').doc(uid)
    .collection('sequenceTriggerLogs')
    .orderBy('triggeredAt', 'desc')
    .onSnapshot((snap) => {
      state.sequenceTriggerLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.dispatchEvent(new CustomEvent('sequence-logs-updated'));
    }, (err) => console.error('sequenceTriggerLogs listen error', err));
}

export function unsubscribeSequenceTriggerLogs() {
  if (unsubscribeLogs) { unsubscribeLogs(); unsubscribeLogs = null; }
  state.sequenceTriggerLogs = [];
}

export async function updateTriggerLogOutcome(logId, outcome, notes) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  await db.collection('users').doc(uid)
    .collection('sequenceTriggerLogs').doc(logId)
    .update({ outcome, notes });
}

export async function deleteTriggerLog(logId) {
  const uid = state.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');

  await db.collection('users').doc(uid)
    .collection('sequenceTriggerLogs').doc(logId)
    .delete();
}

// ===================== Active Sequence States Tracking =====================

export function subscribeSequenceStates() {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  unsubscribeStates = db
    .collection('users').doc(uid)
    .collection('sequenceStates')
    .onSnapshot((snap) => {
      state.sequenceStates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.dispatchEvent(new CustomEvent('sequence-states-updated'));
    }, (err) => console.error('sequenceStates listen error', err));
}

export function unsubscribeSequenceStates() {
  if (unsubscribeStates) { unsubscribeStates(); unsubscribeStates = null; }
  state.sequenceStates = [];
}
