// ===================== candleTimers.js — Firestore Service =====================
import { db } from '../firebase-init.js';
import { state } from '../state.js';

export const DEFAULT_CANDLE_TIMER_SETTINGS = {
  enabled: true,
  activeDays: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  fromTime: "09:15",
  toTime: "15:30",
  anchorTime: "09:15",
  sound5m: "chime",
  sound15m: "radar",
  volume5m: 0.8,
  volume15m: 0.8,
  mute5m: false,
  mute15m: false,
  specialTimes: ["09:15", "10:00", "15:00"],
  specialSound: "special",
  specialVolume: 0.9,
  specialMute: false
};

/**
 * Fetch candle timer settings for the current logged-in user from Firestore
 */
export async function loadCandleTimerSettings() {
  if (!state.currentUser) return { ...DEFAULT_CANDLE_TIMER_SETTINGS };

  try {
    const docRef = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("candleTimers");
    const doc = await docRef.get();
    if (doc.exists) {
      return { ...DEFAULT_CANDLE_TIMER_SETTINGS, ...doc.data() };
    }
  } catch (err) {
    console.warn("Failed to load candle timer settings from Firestore, using defaults:", err);
  }
  return { ...DEFAULT_CANDLE_TIMER_SETTINGS };
}

/**
 * Save candle timer settings for the current logged-in user to Firestore
 * @param {Object} settings 
 */
export async function saveCandleTimerSettings(settings) {
  if (!state.currentUser) return;

  const docRef = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("candleTimers");
  await docRef.set(settings, { merge: true });
}
