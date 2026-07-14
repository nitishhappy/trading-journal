import { state } from '../state.js';
import { db, auth } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';
import { todayKey, getLocalDateKey } from '../utils/date.js';
import {
  currentFolderLabel, viewSettings, settingsGearBtn, settingsCloseBtn,
  defaultSortSelect, settingsLogoutBtn
} from '../dom.js';
import { populateDefaultTemplateSelect } from './candleChecklist.js';

// Cache elements for passcode lock/unlock
const tradeLockOverlay = document.getElementById("trade-lock-overlay");
const tradeLockInput = document.getElementById("trade-lock-input");
const tradeLockError = document.getElementById("trade-lock-error");
const tradeLockSetupHint = document.getElementById("trade-lock-setup-hint");
const tradeLockSub = document.getElementById("trade-lock-sub");
const tradeLockUnlockBtn = document.getElementById("trade-lock-unlock-btn");

const tradePasscodeInput = document.getElementById("trade-passcode-input");
const tradePasscodeToggle = document.getElementById("trade-passcode-toggle");
const tradePasscodeSaveBtn = document.getElementById("trade-passcode-save-btn");
const tradePasscodeRemoveBtn = document.getElementById("trade-passcode-remove-btn");
const tradePasscodeStatus = document.getElementById("trade-passcode-status");

// Open settings
if (settingsGearBtn) {
  settingsGearBtn.addEventListener("click", () => {
    viewSettings.classList.add("settings-open");
    currentFolderLabel.textContent = "Settings";
    
    // Dispatch custom event so checklists, keys, and passcodes can refresh
    window.dispatchEvent(new CustomEvent('settings-opened'));
    setTimeout(() => loadTradePasscodeStatus(), 50);

    // Populate default candle template dropdown
    populateDefaultTemplateSelect();
  });
}

// Save default candle template when changed in settings
const defaultCandleTemplateSel = document.getElementById('default-candle-template-select');
if (defaultCandleTemplateSel) {
  defaultCandleTemplateSel.addEventListener('change', () => {
    const val = defaultCandleTemplateSel.value;
    if (val) {
      localStorage.setItem('candleDefaultTemplateId', val);
    } else {
      localStorage.removeItem('candleDefaultTemplateId');
    }
    showToast(val ? 'Default candle template saved' : 'Default template cleared');
  });
}

// Close settings
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => {
    viewSettings.classList.remove("settings-open");
    currentFolderLabel.textContent = state.activeView === "dashboard"
      ? (state.activeFolder === "all" ? "Dashboard" : state.activeFolder)
      : state.activeView.charAt(0).toUpperCase() + state.activeView.slice(1);
  });
}

// Settings logout
if (settingsLogoutBtn) {
  settingsLogoutBtn.addEventListener("click", () => auth.signOut());
}

// Default sort select handler
if (defaultSortSelect) {
  defaultSortSelect.value = state.defaultGroupMode;
  defaultSortSelect.addEventListener("change", async () => {
    state.defaultGroupMode = defaultSortSelect.value;
    const ref = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("preferences");
    try {
      await ref.set({ defaultGroup: state.defaultGroupMode }, { merge: true });
      showToast("Default grouping saved");
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } catch (err) {
      console.error(err);
      showToast("Could not save setting");
    }
  });
}

export function loadSettings() {
  const ref = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("preferences");
  ref.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.defaultGroup) {
        state.defaultGroupMode = data.defaultGroup;
        state.groupMode = state.defaultGroupMode;
      }
    }
    if (defaultSortSelect) defaultSortSelect.value = state.defaultGroupMode;
    const groupSelect = document.getElementById("group-select");
    if (groupSelect) groupSelect.value = state.groupMode;
    
    window.dispatchEvent(new CustomEvent('settings-loaded'));
  }).catch((err) => {
    console.error("settings load error", err);
  });
}

// ===================== Daily Backup Reminder Banner =====================
const backupReminderBanner = document.getElementById("backup-reminder-banner");
const backupReminderText = document.getElementById("backup-reminder-text");
const backupReminderExportBtn = document.getElementById("backup-reminder-export-btn");
const backupReminderDismissBtn = document.getElementById("backup-reminder-dismiss-btn");

function formatLastBackupDate(dateStr) {
  if (!dateStr) return "never";
  const d = new Date(dateStr + "T12:00:00");
  const today = todayKey();
  if (dateStr === today) return "today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalDateKey(yesterday)) return "yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export async function checkBackupReminder() {
  try {
    const ref = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("preferences");
    const doc = await ref.get();
    const data = doc.exists ? doc.data() : {};
    const lastShown = data.lastBackupReminderShown || null;
    const lastBackup = data.lastBackupDate || null;
    const today = todayKey();

    if (backupReminderText) {
      backupReminderText.textContent = `💾 Don't forget to back up your data today — last backup: ${formatLastBackupDate(lastBackup)}`;
    }

    if (lastShown === today) return; // already shown today
    if (backupReminderBanner) backupReminderBanner.classList.remove("hidden");
    await ref.set({ lastBackupReminderShown: today }, { merge: true });
  } catch (err) {
    console.error("backup reminder check error", err);
  }
}

if (backupReminderDismissBtn) {
  backupReminderDismissBtn.addEventListener("click", () => {
    if (backupReminderBanner) backupReminderBanner.classList.add("hidden");
  });
}

if (backupReminderExportBtn) {
  backupReminderExportBtn.addEventListener("click", () => {
    if (backupReminderBanner) backupReminderBanner.classList.add("hidden");
    
    // Prepare export UI modal elements
    const exportFormatSelect = document.getElementById("export-format-select");
    const exportRangeSelect = document.getElementById("export-range-select");
    const exportCustomRow = document.getElementById("export-custom-range-row");
    const exportIncludeObs = document.getElementById("export-include-obs");
    const exportIncludeTrades = document.getElementById("export-include-trades");
    const exportModal = document.getElementById("export-modal");

    if (exportFormatSelect) exportFormatSelect.value = "json";
    if (exportRangeSelect) exportRangeSelect.value = "all";
    if (exportCustomRow) exportCustomRow.classList.add("hidden");
    if (exportIncludeObs) exportIncludeObs.checked = true;
    if (exportIncludeTrades) exportIncludeTrades.checked = true;
    
    if (window.updateExportHintAndPreview) window.updateExportHintAndPreview();
    if (exportModal) exportModal.classList.remove("hidden");
  });
}

// ===================== Passcode lock / unlock & inactivity timers =====================

export function loadTradePasscodeStatus() {
  if (!state.currentUser) return;
  const ref = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("tradePasscode");
  state.tradePasscodeDocRef = ref;
  ref.get().then((doc) => {
    if (doc.exists && doc.data().passcode) {
      state.tradePasscode = doc.data().passcode;
      if (tradePasscodeStatus) {
        tradePasscodeStatus.textContent = "Passcode is set.";
        tradePasscodeStatus.style.color = "var(--low)";
      }
    } else {
      state.tradePasscode = null;
      if (tradePasscodeStatus) {
        tradePasscodeStatus.textContent = "No passcode set.";
        tradePasscodeStatus.style.color = "var(--text-dim)";
      }
    }
  }).catch((err) => {
    console.error("trade passcode load error", err);
  });
}

export function resetTradeInactivityTimer() {
  if (state.tradeLocked || !state.tradePasscode) return;
  clearTimeout(state.tradeInactivityTimer);
  state.tradeInactivityTimer = setTimeout(() => {
    if (state.activeView === "tradelog" && !state.tradeLocked && state.tradePasscode) {
      showTradeLock();
    }
  }, 5000); // 5 seconds inactivity timeout
}

// Reset timer on active log interactions
const tradeLogViewEl = document.getElementById("view-tradelog");
if (tradeLogViewEl) {
  tradeLogViewEl.addEventListener("mousedown", resetTradeInactivityTimer);
  tradeLogViewEl.addEventListener("keydown", resetTradeInactivityTimer);
  tradeLogViewEl.addEventListener("touchstart", resetTradeInactivityTimer);
  tradeLogViewEl.addEventListener("wheel", resetTradeInactivityTimer);
}

// Visibility lock
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.activeView === "tradelog" && !state.tradeLocked && state.tradePasscode) {
    clearTimeout(state.tradeInactivityTimer);
    showTradeLock();
  }
});

// Window blur lock
window.addEventListener("blur", () => {
  if (state.activeView === "tradelog" && !state.tradeLocked && state.tradePasscode) {
    clearTimeout(state.tradeInactivityTimer);
    showTradeLock();
  }
});

export function showTradeLock() {
  if (!state.tradePasscode) {
    if (tradeLockOverlay) tradeLockOverlay.classList.add("hidden");
    return;
  }
  state.tradeLocked = true;
  clearTimeout(state.tradeInactivityTimer);
  if (tradeLockOverlay) tradeLockOverlay.classList.remove("hidden");
  if (tradeLockInput) {
    tradeLockInput.value = "";
    tradeLockError.classList.add("hidden");
    tradeLockSetupHint.classList.add("hidden");
    tradeLockSub.textContent = "Enter your 4-digit passcode to access the trade log.";
    setTimeout(() => tradeLockInput.focus(), 100);
  }
}

export function hideTradeLock() {
  state.tradeLocked = false;
  if (tradeLockOverlay) tradeLockOverlay.classList.add("hidden");
  resetTradeInactivityTimer();
}

export function attemptUnlock() {
  if (!tradeLockInput) return;
  const code = tradeLockInput.value.trim();
  if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
    if (tradeLockError) {
      tradeLockError.textContent = "Enter a valid 4-digit passcode.";
      tradeLockError.classList.remove("hidden");
    }
    return;
  }
  if (code === state.tradePasscode) {
    if (tradeLockError) tradeLockError.classList.add("hidden");
    hideTradeLock();
    // Dispatch event to trigger rendering
    window.dispatchEvent(new CustomEvent('trades-unlocked'));
  } else {
    if (tradeLockError) {
      tradeLockError.classList.remove("hidden");
    }
    tradeLockInput.value = "";
    tradeLockInput.focus();
  }
}

if (tradeLockInput) {
  tradeLockInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      attemptUnlock();
    }
  });
}

if (tradeLockUnlockBtn) {
  tradeLockUnlockBtn.addEventListener("click", () => attemptUnlock());
}

if (tradePasscodeToggle) {
  tradePasscodeToggle.addEventListener("click", () => {
    const type = tradePasscodeInput.type === "password" ? "text" : "password";
    tradePasscodeInput.type = type;
    tradePasscodeToggle.textContent = type === "password" ? "\u{1F441}" : "\u{1F648}";
  });
}

if (tradePasscodeSaveBtn) {
  tradePasscodeSaveBtn.addEventListener("click", async () => {
    const code = tradePasscodeInput.value.trim();
    if (!code) {
      tradePasscodeStatus.textContent = "Enter a 4-digit passcode.";
      tradePasscodeStatus.style.color = "var(--high)";
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      tradePasscodeStatus.textContent = "Passcode must be exactly 4 digits (0-9).";
      tradePasscodeStatus.style.color = "var(--high)";
      return;
    }
    try {
      const ref = state.tradePasscodeDocRef || db.collection("users").doc(state.currentUser.uid).collection("settings").doc("tradePasscode");
      await ref.set({ passcode: code });
      state.tradePasscode = code;
      state.tradePasscodeDocRef = ref;
      tradePasscodeStatus.textContent = "Passcode saved.";
      tradePasscodeStatus.style.color = "var(--low)";
      tradePasscodeInput.value = "";
      showToast("Trade log passcode saved");
    } catch (err) {
      console.error(err);
      tradePasscodeStatus.textContent = "Could not save passcode.";
      tradePasscodeStatus.style.color = "var(--high)";
      showToast("Failed to save passcode");
    }
  });
}

if (tradePasscodeRemoveBtn) {
  tradePasscodeRemoveBtn.addEventListener("click", async () => {
    if (!state.tradePasscode) {
      showToast("No passcode is set.");
      return;
    }
    if (!confirm("Remove the trade log passcode?")) return;
    try {
      const ref = state.tradePasscodeDocRef || db.collection("users").doc(state.currentUser.uid).collection("settings").doc("tradePasscode");
      await ref.delete();
      state.tradePasscode = null;
      tradePasscodeStatus.textContent = "No passcode set.";
      tradePasscodeStatus.style.color = "var(--text-dim)";
      tradePasscodeInput.value = "";
      showToast("Trade log passcode removed");
    } catch (err) {
      console.error(err);
      tradePasscodeStatus.textContent = "Could not remove passcode.";
      tradePasscodeStatus.style.color = "var(--high)";
      showToast("Failed to remove passcode");
    }
  });
}

// Bind to window for compatibility with trade-security.js overrides
window.loadTradePasscodeStatus = loadTradePasscodeStatus;
window.resetTradeInactivityTimer = resetTradeInactivityTimer;
window.showTradeLock = showTradeLock;
window.hideTradeLock = hideTradeLock;
window.attemptUnlock = attemptUnlock;
window.loadSettings = loadSettings;
window.checkBackupReminder = checkBackupReminder;
