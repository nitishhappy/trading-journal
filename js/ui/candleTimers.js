// ===================== candleTimers.js — UI & Countdown Controller =====================
import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import { playSynthesizedSound } from '../utils/audio.js';
import { loadCandleTimerSettings, saveCandleTimerSettings, DEFAULT_CANDLE_TIMER_SETTINGS } from '../services/candleTimers.js';

let timerSettings = { ...DEFAULT_CANDLE_TIMER_SETTINGS };
let timerInterval = null;
let lastTrigger5mMinute = null;
let lastTrigger15mMinute = null;
let lastSpecialTriggerKey = null;

// Helper to get current Date object adjusted to IST (Asia/Kolkata)
function getISTDate() {
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(istString);
}

// Format seconds into MM:SS string
function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format 24h HH:MM to 12h AM/PM string
function format12Hour(hours, minutes) {
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// Format seconds from midnight to 12h AM/PM string
function formatSecondsTo12Hour(sec) {
  let s = sec % 86400;
  if (s < 0) s += 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return format12Hour(h, m);
}

// Check if current IST time falls within active days and operating session hours
function checkSessionActive(istDate) {
  const day = istDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const activeDays = timerSettings.activeDays || [1, 2, 3, 4, 5];
  if (!activeDays.includes(day)) return false;

  const [fromH, fromM] = (timerSettings.fromTime || "09:15").split(":").map(Number);
  const [toH, toM] = (timerSettings.toTime || "15:30").split(":").map(Number);
  const fromSec = fromH * 3600 + fromM * 60;
  const toSec = toH * 3600 + toM * 60;
  const nowSec = istDate.getHours() * 3600 + istDate.getMinutes() * 60 + istDate.getSeconds();

  return nowSec >= fromSec && nowSec <= toSec;
}

// Main countdown loop tick
function tick() {
  const istDate = getISTDate();
  const nowSec = istDate.getHours() * 3600 + istDate.getMinutes() * 60 + istDate.getSeconds();
  const isSessionActive = checkSessionActive(istDate);

  const [ancH, ancM] = (timerSettings.anchorTime || "09:15").split(":").map(Number);
  const ancSec = ancH * 3600 + ancM * 60;

  // 5 Min Timer Calculations (300s interval)
  let diff5 = (nowSec - ancSec) % 300;
  if (diff5 < 0) diff5 += 300;
  // remaining: 300 down to 1
  let remaining5 = 300 - diff5;
  if (remaining5 === 0) remaining5 = 300;
  const progress5 = ((300 - remaining5) / 300) * 100;
  const next5mCloseSec = nowSec + remaining5;

  // 15 Min Timer Calculations (900s interval)
  let diff15 = (nowSec - ancSec) % 900;
  if (diff15 < 0) diff15 += 900;
  let remaining15 = 900 - diff15;
  if (remaining15 === 0) remaining15 = 900;
  const progress15 = ((900 - remaining15) / 900) * 100;
  const next15mCloseSec = nowSec + remaining15;

  // DOM Elements for 5m
  const digits5m = document.getElementById("candle-timer-5m-digits");
  const fill5m = document.getElementById("candle-timer-5m-fill");
  const status5m = document.getElementById("candle-timer-5m-status");
  const card5m = document.getElementById("candle-timer-5m-card");

  // DOM Elements for 15m
  const digits15m = document.getElementById("candle-timer-15m-digits");
  const fill15m = document.getElementById("candle-timer-15m-fill");
  const status15m = document.getElementById("candle-timer-15m-status");
  const card15m = document.getElementById("candle-timer-15m-card");

  if (digits5m && fill5m && status5m) {
    if (timerSettings.enable5m === false) {
      digits5m.textContent = "--:--";
      fill5m.style.width = "0%";
      status5m.textContent = `Disabled`;
      card5m?.classList.toggle("timer-active-session", false);
      card5m?.classList.toggle("timer-standby", true);
    } else if (isSessionActive) {
      digits5m.textContent = formatMMSS(remaining5 === 300 ? 0 : remaining5);
      fill5m.style.width = `${progress5}%`;
      status5m.textContent = `Next Close: ${formatSecondsTo12Hour(next5mCloseSec)}`;
      card5m?.classList.toggle("timer-active-session", true);
      card5m?.classList.toggle("timer-standby", false);
    } else {
      digits5m.textContent = "05:00";
      fill5m.style.width = "0%";
      status5m.textContent = `Standby (${format12Hour(ancH, ancM)})`;
      card5m?.classList.toggle("timer-active-session", false);
      card5m?.classList.toggle("timer-standby", true);
    }
  }

  if (digits15m && fill15m && status15m) {
    if (timerSettings.enable15m === false) {
      digits15m.textContent = "--:--";
      fill15m.style.width = "0%";
      status15m.textContent = `Disabled`;
      card15m?.classList.toggle("timer-active-session", false);
      card15m?.classList.toggle("timer-standby", true);
    } else if (isSessionActive) {
      digits15m.textContent = formatMMSS(remaining15 === 900 ? 0 : remaining15);
      fill15m.style.width = `${progress15}%`;
      status15m.textContent = `Next Close: ${formatSecondsTo12Hour(next15mCloseSec)}`;
      card15m?.classList.toggle("timer-active-session", true);
      card15m?.classList.toggle("timer-standby", false);
    } else {
      digits15m.textContent = "15:00";
      fill15m.style.width = "0%";
      status15m.textContent = `Standby (${format12Hour(ancH, ancM)})`;
      card15m?.classList.toggle("timer-active-session", false);
      card15m?.classList.toggle("timer-standby", true);
    }
  }

  // Check Sound Triggers (Only during active session)
  const currentMinuteId = `${istDate.getFullYear()}-${istDate.getMonth()}-${istDate.getDate()}-${istDate.getHours()}-${istDate.getMinutes()}`;
  const triggerId5m = `5m-${next5mCloseSec}`;
  const triggerId15m = `15m-${next15mCloseSec}`;

  if (isSessionActive) {
    // 5-minute candle trigger (10 seconds early)
    if (remaining5 <= 10 && lastTrigger5mMinute !== triggerId5m) {
      lastTrigger5mMinute = triggerId5m;
      if (!timerSettings.mute5m && timerSettings.enable5m !== false) {
        playSynthesizedSound(timerSettings.sound5m || 'chime', timerSettings.volume5m ?? 0.8);
      }
    }

    // 15-minute candle trigger (5 seconds early)
    if (remaining15 <= 5 && lastTrigger15mMinute !== triggerId15m) {
      lastTrigger15mMinute = triggerId15m;
      if (!timerSettings.mute15m && timerSettings.enable15m !== false) {
        playSynthesizedSound(timerSettings.sound15m || 'radar', timerSettings.volume15m ?? 0.8);
      }
    }
  }

  // Special Times Alert Triggers
  const currentHHMM = `${String(istDate.getHours()).padStart(2, '0')}:${String(istDate.getMinutes()).padStart(2, '0')}`;
  const specialKey = `${currentMinuteId}-${currentHHMM}`;

  if (istDate.getSeconds() === 0 && (timerSettings.specialTimes || []).includes(currentHHMM)) {
    if (lastSpecialTriggerKey !== specialKey) {
      lastSpecialTriggerKey = specialKey;
      if (!timerSettings.specialMute) {
        playSynthesizedSound(timerSettings.specialSound || 'special', timerSettings.specialVolume ?? 0.9);
      }
    }
  }
}

// Start the timer loop
export function startCandleTimers() {
  if (timerInterval) clearInterval(timerInterval);
  tick();
  timerInterval = setInterval(tick, 1000);
}

// Update local state and UI mute buttons
function updateMuteButtonsUI() {
  const mute5mBtn = document.getElementById("candle-timer-5m-mute");
  const mute15mBtn = document.getElementById("candle-timer-15m-mute");
  const enable5mBtn = document.getElementById("candle-timer-5m-enable");
  const enable15mBtn = document.getElementById("candle-timer-15m-enable");

  if (mute5mBtn) {
    mute5mBtn.textContent = timerSettings.mute5m ? "🔇" : "🔊";
    mute5mBtn.title = timerSettings.mute5m ? "Unmute 5m Sound" : "Mute 5m Sound";
    mute5mBtn.classList.toggle("is-muted", !!timerSettings.mute5m);
  }

  if (mute15mBtn) {
    mute15mBtn.textContent = timerSettings.mute15m ? "🔇" : "🔊";
    mute15mBtn.title = timerSettings.mute15m ? "Unmute 15m Sound" : "Mute 15m Sound";
    mute15mBtn.classList.toggle("is-muted", !!timerSettings.mute15m);
  }

  if (enable5mBtn) {
    enable5mBtn.classList.toggle("is-muted", timerSettings.enable5m === false);
  }

  if (enable15mBtn) {
    enable15mBtn.classList.toggle("is-muted", timerSettings.enable15m === false);
  }
}

// Setup Event Listeners for in-bar Quick Mute controls
function setupHUDEventListeners() {
  const mute5mBtn = document.getElementById("candle-timer-5m-mute");
  const mute15mBtn = document.getElementById("candle-timer-15m-mute");
  const enable5mBtn = document.getElementById("candle-timer-5m-enable");
  const enable15mBtn = document.getElementById("candle-timer-15m-enable");

  if (mute5mBtn) {
    mute5mBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      timerSettings.mute5m = !timerSettings.mute5m;
      updateMuteButtonsUI();
      await saveCandleTimerSettings(timerSettings);
      showToast(timerSettings.mute5m ? "5m Timer Muted" : "5m Timer Unmuted");
    });
  }

  if (mute15mBtn) {
    mute15mBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      timerSettings.mute15m = !timerSettings.mute15m;
      updateMuteButtonsUI();
      await saveCandleTimerSettings(timerSettings);
      showToast(timerSettings.mute15m ? "15m Timer Muted" : "15m Timer Unmuted");
    });
  }

  if (enable5mBtn) {
    enable5mBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      timerSettings.enable5m = timerSettings.enable5m === false ? true : false;
      updateMuteButtonsUI();
      await saveCandleTimerSettings(timerSettings);
      showToast(timerSettings.enable5m ? "5m Timer Enabled" : "5m Timer Disabled");
    });
  }

  if (enable15mBtn) {
    enable15mBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      timerSettings.enable15m = timerSettings.enable15m === false ? true : false;
      updateMuteButtonsUI();
      await saveCandleTimerSettings(timerSettings);
      showToast(timerSettings.enable15m ? "15m Timer Enabled" : "15m Timer Disabled");
    });
  }
}

// ===================== Settings Panel Integration =====================

let settingsListenersAttached = false;
let activeDaysSet = new Set([1, 2, 3, 4, 5]);

// Synchronize all form elements with current timerSettings
export function populateTimerSettingsForm() {
  const container = document.getElementById("timer-settings-container");
  if (!container) return;

  const fromTimeInput = document.getElementById("timer-setting-from-time");
  const toTimeInput = document.getElementById("timer-setting-to-time");
  const anchorTimeInput = document.getElementById("timer-setting-anchor-time");

  const sound5mSel = document.getElementById("timer-setting-sound-5m");
  const sound15mSel = document.getElementById("timer-setting-sound-15m");
  const specialSoundSel = document.getElementById("timer-setting-sound-special");

  // Inputs
  if (fromTimeInput) fromTimeInput.value = timerSettings.fromTime || "09:15";
  if (toTimeInput) toTimeInput.value = timerSettings.toTime || "15:30";
  if (anchorTimeInput) anchorTimeInput.value = timerSettings.anchorTime || "09:15";

  // Dropdowns
  if (sound5mSel) sound5mSel.value = timerSettings.sound5m || "chime";
  if (sound15mSel) sound15mSel.value = timerSettings.sound15m || "radar";
  if (specialSoundSel) specialSoundSel.value = timerSettings.specialSound || "special";

  // Day Pills
  activeDaysSet = new Set(timerSettings.activeDays || [1, 2, 3, 4, 5]);
  const daysPills = container.querySelectorAll(".day-toggle-pill");
  daysPills.forEach(pill => {
    const dayVal = Number(pill.getAttribute("data-day"));
    pill.classList.toggle("active", activeDaysSet.has(dayVal));
  });

  // Render Special Times
  renderSpecialTimes();
}

// Render Special Times Tag Pills
function renderSpecialTimes() {
  const specialTimesList = document.getElementById("timer-special-times-list");
  if (!specialTimesList) return;
  specialTimesList.innerHTML = "";
  const list = timerSettings.specialTimes || [];
  if (list.length === 0) {
    specialTimesList.innerHTML = `<span style="font-size:12px; color:var(--text-dim);">No special times configured.</span>`;
    return;
  }
  list.forEach((t, idx) => {
    const [h, m] = t.split(":").map(Number);
    const tag = document.createElement("span");
    tag.className = "special-time-tag";
    tag.innerHTML = `
      <span>${format12Hour(h, m)} (${t})</span>
      <button type="button" class="special-time-remove" data-idx="${idx}" title="Remove">×</button>
    `;
    tag.querySelector(".special-time-remove").addEventListener("click", () => {
      timerSettings.specialTimes.splice(idx, 1);
      renderSpecialTimes();
    });
    specialTimesList.appendChild(tag);
  });
}

// Setup Event Listeners for the Timer Settings Panel (attached only once)
export function initTimerSettingsUI() {
  populateTimerSettingsForm();

  if (settingsListenersAttached) return;
  settingsListenersAttached = true;

  const container = document.getElementById("timer-settings-container");
  if (!container) return;

  const sound5mSel = document.getElementById("timer-setting-sound-5m");
  const sound15mSel = document.getElementById("timer-setting-sound-15m");
  const specialSoundSel = document.getElementById("timer-setting-sound-special");

  const test5mBtn = document.getElementById("timer-test-sound-5m");
  const test15mBtn = document.getElementById("timer-test-sound-15m");
  const testSpecialBtn = document.getElementById("timer-test-sound-special");

  const addSpecialTimeInput = document.getElementById("timer-add-special-input");
  const addSpecialTimeBtn = document.getElementById("timer-add-special-btn");
  const saveSettingsBtn = document.getElementById("timer-save-settings-btn");

  const fromTimeInput = document.getElementById("timer-setting-from-time");
  const toTimeInput = document.getElementById("timer-setting-to-time");
  const anchorTimeInput = document.getElementById("timer-setting-anchor-time");

  // Day Toggle Pills
  const daysPills = container.querySelectorAll(".day-toggle-pill");
  daysPills.forEach(pill => {
    const dayVal = Number(pill.getAttribute("data-day"));
    pill.addEventListener("click", () => {
      if (activeDaysSet.has(dayVal)) {
        activeDaysSet.delete(dayVal);
      } else {
        activeDaysSet.add(dayVal);
      }
      pill.classList.toggle("active", activeDaysSet.has(dayVal));
      timerSettings.activeDays = Array.from(activeDaysSet).sort();
    });
  });

  // Dropdown Change Handlers (Instant sound preview + state update)
  sound5mSel?.addEventListener("change", () => {
    const selectedSound = sound5mSel.value;
    timerSettings.sound5m = selectedSound;
    playSynthesizedSound(selectedSound, timerSettings.volume5m ?? 0.8);
    saveCandleTimerSettings(timerSettings);
  });

  sound15mSel?.addEventListener("change", () => {
    const selectedSound = sound15mSel.value;
    timerSettings.sound15m = selectedSound;
    playSynthesizedSound(selectedSound, timerSettings.volume15m ?? 0.8);
    saveCandleTimerSettings(timerSettings);
  });

  specialSoundSel?.addEventListener("change", () => {
    const selectedSound = specialSoundSel.value;
    timerSettings.specialSound = selectedSound;
    playSynthesizedSound(selectedSound, timerSettings.specialVolume ?? 0.9);
    saveCandleTimerSettings(timerSettings);
  });

  // Sound Test Buttons
  test5mBtn?.addEventListener("click", () => {
    const snd = sound5mSel?.value || timerSettings.sound5m || "chime";
    playSynthesizedSound(snd, timerSettings.volume5m ?? 0.8);
  });

  test15mBtn?.addEventListener("click", () => {
    const snd = sound15mSel?.value || timerSettings.sound15m || "radar";
    playSynthesizedSound(snd, timerSettings.volume15m ?? 0.8);
  });

  testSpecialBtn?.addEventListener("click", () => {
    const snd = specialSoundSel?.value || timerSettings.specialSound || "special";
    playSynthesizedSound(snd, timerSettings.specialVolume ?? 0.9);
  });

  // Add Special Time Handler
  addSpecialTimeBtn?.addEventListener("click", () => {
    const val = addSpecialTimeInput?.value;
    if (!val) {
      showToast("Please pick a valid time");
      return;
    }
    if (!timerSettings.specialTimes) timerSettings.specialTimes = [];
    if (timerSettings.specialTimes.includes(val)) {
      showToast("Time already in list");
      return;
    }
    timerSettings.specialTimes.push(val);
    timerSettings.specialTimes.sort();
    renderSpecialTimes();
    if (addSpecialTimeInput) addSpecialTimeInput.value = "";
  });

  // Save Settings Button
  saveSettingsBtn?.addEventListener("click", async () => {
    timerSettings.activeDays = Array.from(activeDaysSet).sort();
    timerSettings.fromTime = fromTimeInput?.value || "09:15";
    timerSettings.toTime = toTimeInput?.value || "15:30";
    timerSettings.anchorTime = anchorTimeInput?.value || "09:15";
    timerSettings.sound5m = sound5mSel?.value || "chime";
    timerSettings.sound15m = sound15mSel?.value || "radar";
    timerSettings.specialSound = specialSoundSel?.value || "special";

    try {
      saveSettingsBtn.disabled = true;
      saveSettingsBtn.textContent = "Saving...";
      await saveCandleTimerSettings(timerSettings);
      showToast("Candle timer settings saved ✓");
      tick(); // Immediate recalculation
    } catch (err) {
      console.error(err);
      showToast("Failed to save settings");
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = "Save Timer Settings";
    }
  });
}

// Initialize on App Load
export async function initCandleTimersUI() {
  setupHUDEventListeners();
  startCandleTimers();

  // Load user settings from Firestore and local cache
  const loadUserTimers = async () => {
    timerSettings = await loadCandleTimerSettings();
    updateMuteButtonsUI();
    initTimerSettingsUI();
    tick();
  };

  // Listen for auth state change
  window.addEventListener('auth-state-changed', loadUserTimers);

  // Listen for settings view being opened
  window.addEventListener('settings-opened', () => {
    initTimerSettingsUI();
    populateTimerSettingsForm();
  });

  // Initial load
  loadUserTimers();
}

// Auto-init on script load
initCandleTimersUI();

