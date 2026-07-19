import { auth } from '../firebase-init.js';
import { state } from '../state.js';
import {
  authScreen, appScreen, authForm, emailInput, passwordInput, authError, signupBtn
} from '../dom.js';

import { loadFolders, subscribeObservations, migrateInstaLearningToObservations, unsubscribeObservations } from '../services/observations.js';
import { subscribeTrades, unsubscribeTrades } from '../services/trades.js';
import { subscribeAiSummaries, unsubscribeAiSummaries } from '../services/ai.js';
import { subscribeChecklistLogs, unsubscribeChecklists } from '../services/checklists.js';
import { subscribeCandleChecklists, unsubscribeCandleChecklists } from '../services/candleChecklist.js';
import { subscribeTvNotifications, unsubscribeTvNotifications } from '../services/tvNotifications.js';
import {
  subscribeSequenceRules,
  subscribeSequenceTriggerLogs,
  subscribeSequenceStates,
  unsubscribeSequenceRules,
  unsubscribeSequenceTriggerLogs,
  unsubscribeSequenceStates
} from '../services/sequenceRules.js';
import { loadSettings, checkBackupReminder, loadTradePasscodeStatus } from './settings.js';
import { loadThemePreference } from '../utils/theme.js';

// Setup submit handler for login
authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin();
});

if (signupBtn) {
  signupBtn.addEventListener("click", () => doSignup());
}

function doLogin() {
  authError.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  auth.signInWithEmailAndPassword(email, password)
    .catch((err) => { authError.textContent = friendlyAuthError(err); });
}

function doSignup() {
  authError.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    authError.textContent = "Enter email and password to create an account.";
    return;
  }
  auth.createUserWithEmailAndPassword(email, password)
    .catch((err) => { authError.textContent = friendlyAuthError(err); });
}

function friendlyAuthError(err) {
  switch (err.code) {
    case "auth/invalid-email": return "That email address looks invalid.";
    case "auth/user-not-found": return "No account found with that email.";
    case "auth/wrong-password": return "Incorrect password.";
    case "auth/email-already-in-use": return "An account already exists with that email.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/invalid-credential": return "Invalid email or password.";
    default: return err.message;
  }
}

// Global Auth state handler
auth.onAuthStateChanged((user) => {
  state.currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    
    // Trigger service subscribers & load preferences
    loadFolders();
    loadSettings();
    loadThemePreference();
    subscribeObservations();
    subscribeTrades();
    subscribeAiSummaries();
    migrateInstaLearningToObservations();
    subscribeChecklistLogs();
    subscribeCandleChecklists();
    subscribeTvNotifications();
    subscribeSequenceRules();
    subscribeSequenceTriggerLogs();
    subscribeSequenceStates();
    checkBackupReminder();
    setTimeout(() => loadTradePasscodeStatus(), 50);
    
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: true, user } }));
  } else {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    
    // Clear all states
    state.observations = [];
    state.trades = [];
    state.checklistLogs = [];
    state.candleChecklistTemplates = [];
    state.candleChecklistRuns = [];
    state.sequenceRules = [];
    state.sequenceTriggerLogs = [];
    state.sequenceStates = [];
    state.cachedGeminiKey = null;
    state.cachedGoogleApiKey = null;
    state.tradePasscode = null;
    state.tradeLocked = true;
    
    // Unsubscribe database listeners
    unsubscribeObservations();
    unsubscribeTrades();
    unsubscribeAiSummaries();
    unsubscribeChecklists();
    unsubscribeCandleChecklists();
    unsubscribeTvNotifications();
    unsubscribeSequenceRules();
    unsubscribeSequenceTriggerLogs();
    unsubscribeSequenceStates();
    
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: false } }));
  }
});
