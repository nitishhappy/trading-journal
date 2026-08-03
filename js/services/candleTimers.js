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

const LOCAL_STORAGE_KEY = 'candle_timer_settings_cache';

/**
 * Fetch candle timer settings from local cache and Firestore
 */
export async function loadCandleTimerSettings() {
  let cached = { ...DEFAULT_CANDLE_TIMER_SETTINGS };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      cached = { ...DEFAULT_CANDLE_TIMER_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {}

  if (!state.currentUser) return cached;

  try {
    const docRef = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("candleTimers");
    const doc = await docRef.get();
    if (doc.exists) {
      const merged = { ...DEFAULT_CANDLE_TIMER_SETTINGS, ...cached, ...doc.data() };
      try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged)); } catch (e) {}
      return merged;
    }
  } catch (err) {
    console.warn("Failed to load candle timer settings from Firestore, using defaults:", err);
  }
  return cached;
}

/**
 * Save candle timer settings to local cache and Firestore
 * @param {Object} settings 
 */
export async function saveCandleTimerSettings(settings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}

  if (!state.currentUser) return;

  try {
    const docRef = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("candleTimers");
    await docRef.set(settings, { merge: true });
  } catch (err) {
    console.warn("Could not save timer settings to Firestore:", err);
  }
}

