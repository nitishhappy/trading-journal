// ===================== Firebase setup =====================
const firebaseConfig = {
  apiKey: "AIzaSyDw4UTL7v7sfWf1TnM6SJ92q89-8OxPxJo",
  authDomain: "trade-journal-4271e.firebaseapp.com",
  projectId: "trade-journal-4271e",
  storageBucket: "trade-journal-4271e.firebasestorage.app",
  messagingSenderId: "699891654756",
  appId: "1:699891654756:web:0f57bdd4112183dca0ff71",
  measurementId: "G-LMX876Y9D3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
var db = firebase.firestore();

// ===================== Offline support =====================
// Enables Firestore's local cache so the app keeps working (reading +
// queuing writes) when the connection drops, then syncs automatically once
// back online. Must be called before any other Firestore operation.
let offlineReady = false;
db.enablePersistence({ synchronizeTabs: true })
  .then(() => { offlineReady = true; })
  .catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open — persistence can only run in one at a time.
      console.warn("Offline persistence unavailable: app is open in another tab.");
    } else if (err.code === "unimplemented") {
      // Browser doesn't support the required storage APIs.
      console.warn("Offline persistence unavailable: browser not supported.");
    } else {
      console.error("Offline persistence error:", err);
    }
  });

// Surface connectivity changes to the user via the existing toast system
// and a persistent badge (a one-time toast is easy to miss).
function updateOfflineBadge() {
  const badge = document.getElementById("offline-badge");
  if (!badge) return;
  badge.classList.toggle("hidden", navigator.onLine);
}

window.addEventListener("online", () => {
  updateOfflineBadge();
  showToast("Back online — syncing changes");
});
window.addEventListener("offline", () => {
  updateOfflineBadge();
  showToast("You're offline — changes will sync once reconnected");
});
document.addEventListener("DOMContentLoaded", updateOfflineBadge);

// ===================== State =====================
var currentUser = null;
let observations = [];      // all observations for current user
let folders = ["Behaviour", "Technical", "To Do"]; // default + custom
let activeFolder = "all";
let editingObsId = null;     // set when editing an existing observation
let copyTargetObsId = null;  // set when copying an observation to a folder
var activeView = "dashboard"; // dashboard | summary | tradelog | settings
let groupMode = "date";       // date | priority | tags — current dashboard grouping
let defaultGroupMode = "date"; // persisted user preference
let expandedTileId = null;    // currently expanded tile (only one at a time)
let trades = [];              // trade log entries
let editingTradeId = null;
let showArchived = false;     // dashboard: show archived observations
let imagePendingOnly = false; // dashboard: filter to image-pending observations
let activeTagFilter = null;   // dashboard: filter to a specific tag
let allTags = [];              // distinct list of all tags ever used, for autosuggest

// ---- Revision mode state ----
let revisionQueue = [];        // ordered list of observation ids left to review today
let revisionReviewedIds = [];  // ids marked "reviewed" today (persisted)
let revisionFlaggedIds = [];   // ids marked "needs attention" today (persisted)
let revisionFolderFilter = "all"; // folder filter for revision queue ("all" = no filter)
let revisionStarredOnly = false;  // when true, only starred observations appear in revision
let revisionDragState = null;  // active drag tracking for the top card

// ===================== Element refs =====================
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authError = document.getElementById("auth-error");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");

const folderTabs = document.getElementById("folder-tabs");
const addFolderTab = document.getElementById("add-folder-tab");
const currentFolderLabel = document.getElementById("current-folder-label");
const searchInput = document.getElementById("search-input");
const groupSelect = document.getElementById("group-select");
const activeTagFilterBtn = document.getElementById("active-tag-filter");
const imagePendingToggle = document.getElementById("image-pending-toggle");
const archiveToggle = document.getElementById("archive-toggle");
const feed = document.getElementById("feed");
const emptyState = document.getElementById("empty-state");
const fabAdd = document.getElementById("fab-add");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const metaThemeColor = document.getElementById("meta-theme-color");
const obsEntryTemplate = document.getElementById("obs-entry-template");
const obsModalBody = document.getElementById("obs-modal-body");
const obsAddAnotherBtn = document.getElementById("obs-add-another-btn");
const obsArchiveBtn = document.getElementById("obs-archive-btn");

// Revision view
const revisionStage = document.getElementById("revision-stage");
const revisionEmptyState = document.getElementById("revision-empty-state");
const revisionEmptyText = document.getElementById("revision-empty-text");
const revisionProgressText = document.getElementById("revision-progress-text");
const revisionProgressFill = document.getElementById("revision-progress-fill");
const revisionResetBtn = document.getElementById("revision-reset-btn");
const revisionFolderSelect = document.getElementById("revision-folder-filter");

revisionFolderSelect.addEventListener("change", () => {
  revisionFolderFilter = revisionFolderSelect.value;
  // Reset session reviewed/flagged when switching folders so the new
  // folder's queue starts fresh (users expect a full deck per folder).
  revisionReviewedIds = [];
  revisionFlaggedIds = [];
  if (activeView === "revision") renderRevisionStage();
});

const revisionStarredToggle = document.getElementById("revision-starred-toggle");
revisionStarredToggle.addEventListener("click", () => {
  revisionStarredOnly = !revisionStarredOnly;
  revisionStarredToggle.textContent = revisionStarredOnly ? "★ Starred" : "☆ All";
  revisionStarredToggle.classList.toggle("active", revisionStarredOnly);
  revisionReviewedIds = [];
  revisionFlaggedIds = [];
  if (activeView === "revision") renderRevisionStage();
});

// Main tab navigation
const mainTabs = document.getElementById("main-tabs");
const viewDashboard = document.getElementById("view-dashboard");
const viewRevision = document.getElementById("view-revision");
const viewAiCoach = document.getElementById("view-aicoach");
const viewTradelog = document.getElementById("view-tradelog");
const viewSettings = document.getElementById("view-settings");
const settingsGearBtn = document.getElementById("settings-gear-btn");
const settingsCloseBtn = document.getElementById("settings-close-btn");

// Settings panel: open/close via gear icon (slide-in overlay, not a tab)
settingsGearBtn.addEventListener("click", () => {
  viewSettings.classList.add("settings-open");
  currentFolderLabel.textContent = "Settings";
  loadSettingsKeyStatus();
  renderChecklistManageSelect();
  setTimeout(() => loadTradePasscodeStatus(), 50);
});

settingsCloseBtn.addEventListener("click", () => {
  viewSettings.classList.remove("settings-open");
  // Restore label
  currentFolderLabel.textContent = activeView === "dashboard"
    ? (activeFolder === "all" ? "Dashboard" : activeFolder)
    : activeView.charAt(0).toUpperCase() + activeView.slice(1);
});

// Settings
const defaultSortSelect = document.getElementById("default-sort-select");
const settingsLogoutBtn = document.getElementById("settings-logout-btn");

// (Suggestion banners are now per-entry, queried dynamically within each .obs-entry block)

// Trade log
const tradeSearchInput = document.getElementById("trade-search-input");
const tradeFilterFrom  = document.getElementById("trade-filter-from");
const tradeFilterTo    = document.getElementById("trade-filter-to");
const tradeFilterClear = document.getElementById("trade-filter-clear");
const tradeExportBtn = document.getElementById("trade-export-btn");
const tradeAnalytics = document.getElementById("trade-analytics");
const tradeTableHead = document.getElementById("trade-table-head");
const tradeTableBody = document.getElementById("trade-table-body");
const tradeEmptyState = document.getElementById("trade-empty-state");
const fabAddTrade = document.getElementById("fab-add-trade");

const tradeModal = document.getElementById("trade-modal");
const tradeModalTitle = document.getElementById("trade-modal-title");
const tradeModalClose = document.getElementById("trade-modal-close");
const tradeDate = document.getElementById("trade-date");
const tradeCapital = document.getElementById("trade-capital");
const tradeNum = document.getElementById("trade-num");
const tradeGross = document.getElementById("trade-gross");
const tradeNet = document.getElementById("trade-net");
const tradeDuration = document.getElementById("trade-duration");
const tradeComments = document.getElementById("trade-comments");
const tradeSaveBtn = document.getElementById("trade-save-btn");
const tradeCancelBtn = document.getElementById("trade-cancel-btn");
const tradeDeleteBtn = document.getElementById("trade-delete-btn");

const obsModal = document.getElementById("obs-modal");
const obsModalTitle = document.getElementById("obs-modal-title");
const obsModalClose = document.getElementById("obs-modal-close");
const obsSaveBtn = document.getElementById("obs-save-btn");
const obsCancelBtn = document.getElementById("obs-cancel-btn");
const obsDeleteBtn = document.getElementById("obs-delete-btn");

const copyModal = document.getElementById("copy-modal");
const copyModalClose = document.getElementById("copy-modal-close");
const copyFolderSelect = document.getElementById("copy-folder-select");
const copyPrioritySelect = document.getElementById("copy-priority-select");
const copyCancelBtn = document.getElementById("copy-cancel-btn");
const copyConfirmBtn = document.getElementById("copy-confirm-btn");

const folderModal = document.getElementById("folder-modal");
const folderModalClose = document.getElementById("folder-modal-close");
const newFolderName = document.getElementById("new-folder-name");
const folderCancelBtn = document.getElementById("folder-cancel-btn");
const folderConfirmBtn = document.getElementById("folder-confirm-btn");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");

const toastEl = document.getElementById("toast");

// ===================== Toast =====================
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

// ===================== Auth =====================
authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin();
});

signupBtn.addEventListener("click", () => doSignup());

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

auth.onAuthStateChanged((user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    loadFolders();
    loadSettings();
    loadThemePreference();
    subscribeObservations();
    subscribeTrades();
    subscribeAiSummaries();
    migrateInstaLearningToObservations();
    loadChecklists();
    subscribeChecklistLogs();
    checkBackupReminder();
    loadTradePasscodeStatus();
  } else {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    observations = [];
    trades = [];
    checklistLogs = [];
    cachedGeminiKey = null;
    cachedGoogleApiKey = null;
    tradePasscode = null;
    tradeLocked = true;
    if (obsUnsubscribe) obsUnsubscribe();
    if (folderUnsubscribe) folderUnsubscribe();
    if (tradeUnsubscribe) tradeUnsubscribe();
    if (coachUnsubscribe) coachUnsubscribe();
    if (clLogsUnsubscribe) clLogsUnsubscribe();
  }
});

// ===================== Main tab navigation =====================
mainTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".main-tab");
  if (!tab) return;
  activeView = tab.dataset.view;
  document.querySelectorAll(".main-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");

  [viewDashboard, viewRevision, viewAiCoach, viewTradelog].forEach((v) => v.classList.add("hidden"));

  if (activeView === "dashboard") {
    viewDashboard.classList.remove("hidden");
    currentFolderLabel.textContent = activeFolder === "all" ? "Dashboard" : activeFolder;
    renderFeed();
  } else if (activeView === "revision") {
    viewRevision.classList.remove("hidden");
    currentFolderLabel.textContent = "Revision";
    renderRevisionStage();
  } else if (activeView === "aicoach") {
    viewAiCoach.classList.remove("hidden");
    currentFolderLabel.textContent = "AI Coach";
    renderAiCoachFeed();
  } else if (activeView === "tradelog") {
    viewTradelog.classList.remove("hidden");
    currentFolderLabel.textContent = "Trade Log";
    renderTradeTable();
  }
});

// ===================== Settings =====================
function loadSettings() {
  const ref = db.collection("users").doc(currentUser.uid).collection("settings").doc("preferences");
  ref.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.defaultGroup) {
        defaultGroupMode = data.defaultGroup;
        groupMode = defaultGroupMode;
      } else if (data.defaultSort) {
        // migrate old setting name
        defaultGroupMode = data.defaultSort;
        groupMode = defaultGroupMode;
      }
    }
    defaultSortSelect.value = defaultGroupMode;
    groupSelect.value = groupMode;
    renderFeed();
  }).catch((err) => {
    console.error("settings load error", err);
  });
}

// ===================== Daily backup reminder =====================
// Shown once per calendar day, the first time the app is opened that day —
// not tied to whether a backup actually happened, just a daily nudge.
const backupReminderBanner = document.getElementById("backup-reminder-banner");
const backupReminderText = document.getElementById("backup-reminder-text");
const backupReminderExportBtn = document.getElementById("backup-reminder-export-btn");
const backupReminderDismissBtn = document.getElementById("backup-reminder-dismiss-btn");

function formatLastBackupDate(dateStr) {
  if (!dateStr) return "never";
  const d = new Date(dateStr + "T12:00:00"); // noon avoids local-TZ date-shift on parse
  const today = todayKey();
  if (dateStr === today) return "today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalDateKey({ toDate: () => yesterday })) return "yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

async function checkBackupReminder() {
  try {
    const ref = db.collection("users").doc(currentUser.uid).collection("settings").doc("preferences");
    const doc = await ref.get();
    const data = doc.exists ? doc.data() : {};
    const lastShown = data.lastBackupReminderShown || null;
    const lastBackup = data.lastBackupDate || null;
    const today = todayKey();

    if (backupReminderText) {
      backupReminderText.textContent = `💾 Don't forget to back up your data today — last backup: ${formatLastBackupDate(lastBackup)}`;
    }

    if (lastShown === today) return; // already shown once today
    backupReminderBanner.classList.remove("hidden");
    await ref.set({ lastBackupReminderShown: today }, { merge: true });
  } catch (err) {
    console.error("backup reminder check error", err);
  }
}

// Records that a backup just happened (called by every export format, not
// just the one launched from the reminder banner) so "last backup" reflects
// any export the person does, whenever and however they trigger it.
async function recordBackupPerformed() {
  if (!currentUser) return;
  try {
    const ref = db.collection("users").doc(currentUser.uid).collection("settings").doc("preferences");
    await ref.set({ lastBackupDate: todayKey() }, { merge: true });
    if (backupReminderText) {
      backupReminderText.textContent = `💾 Don't forget to back up your data today — last backup: today`;
    }
  } catch (err) {
    console.error("record backup performed error", err);
  }
}

backupReminderDismissBtn.addEventListener("click", () => {
  backupReminderBanner.classList.add("hidden");
});

backupReminderExportBtn.addEventListener("click", () => {
  backupReminderBanner.classList.add("hidden");
  exportFormatSelect.value = "json";
  exportRangeSelect.value = "all";
  exportCustomRow.classList.add("hidden");
  exportIncludeObs.checked = true;
  exportIncludeTrades.checked = true;
  updateExportHintAndPreview();
  exportModal.classList.remove("hidden");
});

defaultSortSelect.addEventListener("change", async () => {
  defaultGroupMode = defaultSortSelect.value;
  const ref = db.collection("users").doc(currentUser.uid).collection("settings").doc("preferences");
  try {
    await ref.set({ defaultGroup: defaultGroupMode }, { merge: true });
    showToast("Default grouping saved");
  } catch (err) {
    console.error(err);
    showToast("Could not save setting");
  }
});

settingsLogoutBtn.addEventListener("click", () => auth.signOut());

// ===================== Group control =====================
groupSelect.addEventListener("change", () => {
  groupMode = groupSelect.value;
  renderFeed();
});

// ===================== Image-pending / archive toggles =====================
imagePendingToggle.addEventListener("click", () => {
  imagePendingOnly = !imagePendingOnly;
  imagePendingToggle.classList.toggle("active", imagePendingOnly);
  renderFeed();
});

archiveToggle.addEventListener("click", () => {
  showArchived = !showArchived;
  archiveToggle.classList.toggle("active", showArchived);
  renderFeed();
});

// ===================== Tag click filter =====================
activeTagFilterBtn.addEventListener("click", () => {
  activeTagFilter = null;
  activeTagFilterBtn.classList.add("hidden");
  renderFeed();
});

function setTagFilter(tag) {
  activeTagFilter = tag;
  activeTagFilterBtn.textContent = `#${tag} ✕`;
  activeTagFilterBtn.classList.remove("hidden");
  renderFeed();
}

// ===================== Fullscreen toggle =====================
fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      showToast("Fullscreen not available");
    });
  } else {
    document.exitFullscreen();
  }
});

// ===================== Theme (light / dark) =====================
let currentTheme = "dark";

function applyTheme(theme, persist) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeToggleBtn.textContent = isDark ? "🌙" : "☀️";
  themeToggleBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  metaThemeColor.setAttribute("content", isDark ? "#0A0E17" : "#F0F4FA");
  // Sync the settings switch
  const sw = document.getElementById("settings-theme-toggle");
  if (sw) sw.classList.toggle("is-light", !isDark);
  if (persist && currentUser) {
    db.collection("users").doc(currentUser.uid)
      .collection("settings").doc("preferences")
      .set({ theme }, { merge: true })
      .catch((err) => console.error("theme save error", err));
  }
}

// Settings page switch handler (wired up when Settings view loads)
document.getElementById("settings-theme-toggle").addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark", true);
});

function loadThemePreference() {
  // 1. Check Firestore preference
  db.collection("users").doc(currentUser.uid)
    .collection("settings").doc("preferences")
    .get()
    .then((doc) => {
      if (doc.exists && doc.data().theme) {
        applyTheme(doc.data().theme, false);
      } else {
        // 2. Fall back to OS preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        applyTheme(prefersDark ? "dark" : "light", false);
      }
    })
    .catch(() => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light", false);
    });
}

themeToggleBtn.addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark", true);
});

// Apply OS preference immediately before auth loads (avoids flash)
(function() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  if (!prefersDark) metaThemeColor.setAttribute("content", "#F0F4FA");
})();

// ===================== Firestore: folders =====================
let folderUnsubscribe = null;

function loadFolders() {
  const ref = db.collection("users").doc(currentUser.uid).collection("folders");
  folderUnsubscribe = ref.onSnapshot((snap) => {
    const customFolders = [];
    snap.forEach((doc) => customFolders.push(doc.data().name));
    // Merge defaults with any custom ones, preserving order, no duplicates
    const defaults = ["Behaviour", "Technical", "To Do"];
    const merged = [...defaults];
    customFolders.forEach((f) => { if (!merged.includes(f)) merged.push(f); });
    folders = merged;
    renderFolderTabs();
    populateFolderSelects();
  }, (err) => {
    console.error("folders load error", err);
    // fall back to defaults
    renderFolderTabs();
    populateFolderSelects();
  });
}

function addCustomFolder(name) {
  const ref = db.collection("users").doc(currentUser.uid).collection("folders");
  return ref.add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// ===================== Auto-categorization (rule-based, free) =====================
// Maps a target folder name -> list of keywords. Matching is case-insensitive,
// checked against observation text + tags. First folder with the most keyword
// hits wins (ties broken by order below).
const CATEGORY_RULES = {
  "Technical": [
    "support", "resistance", "breakout", "breakdown", "trendline", "indicator",
    "rsi", "macd", "moving average", "ema", "sma", "volume", "chart pattern",
    "candlestick", "fibonacci", "pattern", "setup", "level", "consolidation",
    "divergence", "vwap", "bollinger"
  ],
  "Implementation Issue": [
    "bug", "error", "crash", "delay", "slippage", "missed", "wrong order",
    "execution", "glitch", "freeze", "lag", "didn't trigger", "failed",
    "broker issue", "platform issue", "connectivity", "order rejected", "not working"
  ],
  "Behaviour": [
    "fomo", "fear", "greed", "anxious", "anxiety", "discipline", "impulsive",
    "revenge trade", "overtrading", "patience", "confidence", "hesitation",
    "panic", "emotional", "mindset", "stress", "frustrated", "overconfident"
  ],
  "To Do": [
    "todo", "to-do", "need to", "should check", "follow up", "remember to",
    "plan to", "next time", "review later", "pending", "action item"
  ],
};

// Returns { category, score } for the best matching category, or null if no match.
// category may or may not correspond to an existing folder.
function suggestCategory(text, tags) {
  const haystack = ((text || "") + " " + (tags || []).join(" ")).toLowerCase();
  let best = null;
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    let score = 0;
    keywords.forEach((kw) => {
      if (haystack.includes(kw.toLowerCase())) score++;
    });
    if (score > 0 && (!best || score > best.score)) {
      best = { category, score };
    }
  }
  return best;
}

// ===================== One-time migration: InstaLearning -> Observations =====================
// InstaLearning used to be a separate tab/collection (`ilItems`) with the
// same shape as an observation plus multi-image support. The two features
// have been merged — observations now support multiple images too — so any
// remaining ilItems docs get copied into `observations` once, then removed
// from `ilItems` so this never runs twice for the same item.
async function migrateInstaLearningToObservations() {
  try {
    const ilRef = db.collection("users").doc(currentUser.uid).collection("ilItems");
    const snap = await ilRef.get();
    if (snap.empty) return;

    const obsCol = db.collection("users").doc(currentUser.uid).collection("observations");
    let migrated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      await obsCol.add({
        text: data.text || "",
        links: data.link ? [data.link] : [],
        link: data.link || "", // deprecated, kept for backward-compat reads
        tags: (data.tags || []).map((t) => String(t).toLowerCase()),
        folder: data.folder || folders[0],
        priority: data.priority || "medium",
        category: data.category || null,
        images: data.images || (data.imageBase64 ? [data.imageBase64] : []),
        imageBase64: null,
        imagePending: !!data.imagePending,
        archived: !!data.archived,
        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await ilRef.doc(doc.id).delete();
      migrated++;
    }
    if (migrated > 0) {
      showToast(`Merged ${migrated} InstaLearning ${migrated === 1 ? "entry" : "entries"} into Observations`);
    }
  } catch (err) {
    console.error("InstaLearning migration error:", err);
  }
}

// ===================== Firestore: observations =====================
let obsUnsubscribe = null;

function subscribeObservations() {
  const ref = db.collection("users").doc(currentUser.uid).collection("observations")
    .orderBy("createdAt", "desc");
  obsUnsubscribe = ref.onSnapshot((snap) => {
    observations = [];
    snap.forEach((doc) => {
      const data = doc.data();
      observations.push({ id: doc.id, ...data });
    });
    updateAllTags();
    updateStreakBadge();
    updateDashStats();
    if (activeView === "dashboard") renderFeed();
    if (activeView === "revision") renderRevisionStage();
  }, (err) => {
    console.error("observations load error", err);
    showToast("Failed to load observations");
  });
}

function updateAllTags() {
  const set = new Set();
  observations.forEach((o) => (o.tags || []).forEach((t) => set.add(t)));
  allTags = Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ---- Comma-aware tag autocomplete ----
// Native <input list="..."> datalists match against the WHOLE field value,
// so they stop suggesting anything as soon as a comma + a second tag is being
// typed. This builds a small custom dropdown that only looks at the segment
// after the last comma, and inserts the chosen tag back into that position.
function attachTagAutocomplete(input) {
  if (!input || input.dataset.autocompleteAttached) return;
  input.dataset.autocompleteAttached = "1";

  // Wrap the input in a positioned container so the dropdown anchors directly
  // beneath it, regardless of where this input sits in the page/modal.
  const wrapper = document.createElement("div");
  wrapper.className = "tag-autocomplete-wrapper";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const dropdown = document.createElement("div");
  dropdown.className = "tag-autocomplete-dropdown hidden";
  wrapper.appendChild(dropdown);

  let activeIndex = -1;
  let currentMatches = [];

  function getCurrentSegment() {
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const lastComma = upToCaret.lastIndexOf(",");
    return upToCaret.slice(lastComma + 1).trim().toLowerCase();
  }

  function getAlreadyUsedTags() {
    return input.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  function closeDropdown() {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    activeIndex = -1;
    currentMatches = [];
  }

  function openDropdownWithMatches(segment) {
    const used = getAlreadyUsedTags();
    currentMatches = allTags
      .filter((t) => t.toLowerCase().includes(segment) && !used.includes(t.toLowerCase()))
      .slice(0, 8);

    if (segment.length === 0 || currentMatches.length === 0) {
      closeDropdown();
      return;
    }

    dropdown.innerHTML = "";
    currentMatches.forEach((tag, i) => {
      const item = document.createElement("div");
      item.className = "tag-autocomplete-item";
      item.textContent = tag;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus in input
        selectTag(tag);
      });
      dropdown.appendChild(item);
    });
    activeIndex = -1;
    dropdown.classList.remove("hidden");
  }

  function selectTag(tag) {
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const afterCaret = value.slice(caret);
    const lastComma = upToCaret.lastIndexOf(",");

    const before = lastComma === -1 ? "" : value.slice(0, lastComma + 1) + " ";
    const newValue = before + tag + ", " + afterCaret.replace(/^[^,]*/, "").replace(/^,\s*/, "");
    input.value = newValue.replace(/,\s*,/g, ",").trim();
    const newCaret = (before + tag + ", ").length;
    input.focus();
    input.setSelectionRange(newCaret, newCaret);
    closeDropdown();
  }

  input.addEventListener("input", () => {
    const segment = getCurrentSegment();
    openDropdownWithMatches(segment);
  });

  input.addEventListener("keydown", (e) => {
    if (dropdown.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentMatches.length - 1);
      updateActiveHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveHighlight();
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectTag(currentMatches[activeIndex]);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  function updateActiveHighlight() {
    [...dropdown.children].forEach((el, i) => el.classList.toggle("active", i === activeIndex));
  }

  input.addEventListener("blur", () => {
    // Delay so a mousedown-selection on the dropdown can register first
    setTimeout(closeDropdown, 150);
  });
}

function saveObservation(obsData, id) {
  const col = db.collection("users").doc(currentUser.uid).collection("observations");
  if (id) {
    return col.doc(id).update(obsData);
  } else {
    obsData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return col.add(obsData);
  }
}

function deleteObservation(id) {
  return db.collection("users").doc(currentUser.uid).collection("observations").doc(id).delete();
}

// ===================== Folder tabs =====================
function renderFolderTabs() {
  // Remove existing dynamic tabs (keep "All" and the add button)
  const existing = folderTabs.querySelectorAll(".tab:not([data-folder='all']):not(.tab-add)");
  existing.forEach((el) => el.remove());

  folders.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.folder = f;
    btn.textContent = f;
    if (f === activeFolder) btn.classList.add("active");
    folderTabs.insertBefore(btn, addFolderTab);
  });

  // Re-attach "All" active state
  const allTab = folderTabs.querySelector('[data-folder="all"]');
  allTab.classList.toggle("active", activeFolder === "all");

  // Keep the revision folder filter dropdown in sync with the folders list.
  if (revisionFolderSelect) {
    const prev = revisionFolderSelect.value;
    revisionFolderSelect.innerHTML = '<option value="all">All folders</option>';
    folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      revisionFolderSelect.appendChild(opt);
    });
    // Restore previously selected value if it still exists
    revisionFolderSelect.value = prev;
    if (revisionFolderSelect.value !== prev) revisionFolderSelect.value = "all";
  }
}

folderTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab || tab.id === "add-folder-tab") return;
  activeFolder = tab.dataset.folder;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  currentFolderLabel.textContent = activeFolder === "all" ? "Dashboard" : activeFolder;
  renderFeed();
});

addFolderTab.addEventListener("click", () => {
  newFolderName.value = "";
  folderModal.classList.remove("hidden");
  setTimeout(() => newFolderName.focus(), 50);
});

folderModalClose.addEventListener("click", () => folderModal.classList.add("hidden"));
folderCancelBtn.addEventListener("click", () => folderModal.classList.add("hidden"));

folderConfirmBtn.addEventListener("click", async () => {
  const name = newFolderName.value.trim();
  if (!name) return;
  if (folders.includes(name)) {
    showToast("Folder already exists");
    return;
  }
  try {
    await addCustomFolder(name);
    folderModal.classList.add("hidden");
    showToast(`Folder "${name}" created`);
  } catch (err) {
    console.error(err);
    showToast("Could not create folder");
  }
});

// ===================== Search =====================
searchInput.addEventListener("input", () => renderFeed());

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ===================== Render feed =====================
// Serial number map: obs.id → 1-based serial, assigned by creation order
// (oldest = #1). Recomputed on every render so a deleted entry's number
// simply stops existing — remaining numbers don't shift or get reused.
let obsSerialMap = {};

function buildObsSerialMap() {
  obsSerialMap = {};
  const sorted = [...observations]
    .filter((o) => !o.archived)
    .sort((a, b) => getCreatedTime(a) - getCreatedTime(b)); // oldest first = lowest serial
  sorted.forEach((o, i) => { obsSerialMap[o.id] = i + 1; });
}

function renderFeed() {
  feed.innerHTML = "";
  buildObsSerialMap();
  const query = searchInput.value.trim().toLowerCase();

  let filtered = observations.filter((o) => {
    // Archive filter
    const isArchived = !!o.archived;
    if (showArchived) {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
    }

    // Image-pending filter
    if (imagePendingOnly && !o.imagePending) return false;

    // Tag filter (click-to-filter)
    if (activeTagFilter && !(o.tags || []).includes(activeTagFilter)) return false;

    // Folder filter: check primary folder + any extra folders/priorities map
    if (activeFolder !== "all") {
      const inFolders = getObsFolders(o);
      if (!inFolders.includes(activeFolder)) return false;
    }
    if (query) {
      const inText = (o.text || "").toLowerCase().includes(query);
      const inTags = (o.tags || []).some((t) => t.toLowerCase().includes(query));
      if (!inText && !inTags) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  if (groupMode === "priority") {
    renderFeedByPriority(filtered);
  } else if (groupMode === "tags") {
    renderFeedByTags(filtered);
  } else {
    renderFeedByDate(filtered);
  }
}

function getDisplayPriority(o) {
  let p = o.priority || "medium";
  if (activeFolder !== "all" && o.folderPriorities && o.folderPriorities[activeFolder]) {
    p = o.folderPriorities[activeFolder];
  }
  return p;
}

function getCreatedTime(o) {
  return o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().getTime() : 0;
}

// Sort by priority (high -> low), then newest first — used within each date group
function sortByPriorityThenDate(arr) {
  return [...arr].sort((a, b) => {
    const pa = PRIORITY_ORDER[getDisplayPriority(a)] ?? 1;
    const pb = PRIORITY_ORDER[getDisplayPriority(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return getCreatedTime(b) - getCreatedTime(a);
  });
}

function appendGroup(headerText, items) {
  const groupEl = document.createElement("div");
  groupEl.className = "date-group";

  const header = document.createElement("div");
  header.className = "date-header";
  header.textContent = headerText;
  groupEl.appendChild(header);

  const itemsEl = document.createElement("div");
  itemsEl.className = "date-group-items";
  items.forEach((o) => itemsEl.appendChild(renderTile(o)));
  groupEl.appendChild(itemsEl);

  feed.appendChild(groupEl);
}

function renderFeedByDate(filtered) {
  // Group by date (createdAt)
  const groups = {};
  filtered.forEach((o) => {
    const dateKey = getDateKey(o.createdAt);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(o);
  });

  // groups already roughly sorted desc because observations are ordered by createdAt desc.
  // Within each day, sort by priority (high first), then newest first.
  Object.keys(groups).forEach((dateKey) => {
    const items = sortByPriorityThenDate(groups[dateKey]);
    appendGroup(formatDateHeader(dateKey), items);
  });
}

function renderFeedByPriority(filtered) {
  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORITY_ORDER[getDisplayPriority(a)] ?? 1;
    const pb = PRIORITY_ORDER[getDisplayPriority(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return getCreatedTime(b) - getCreatedTime(a);
  });

  const groups = { high: [], medium: [], low: [] };
  sorted.forEach((o) => {
    const p = getDisplayPriority(o);
    if (groups[p]) groups[p].push(o);
  });

  const labels = { high: "High priority", medium: "Medium priority", low: "Low priority" };

  ["high", "medium", "low"].forEach((p) => {
    if (groups[p].length === 0) return;
    appendGroup(labels[p], groups[p]);
  });
}

function renderFeedByTags(filtered) {
  // Group observations by each tag (an observation with multiple tags appears in multiple groups)
  const groups = {}; // tag -> items
  const untagged = [];
  filtered.forEach((o) => {
    const tags = o.tags || [];
    if (tags.length === 0) {
      untagged.push(o);
    } else {
      tags.forEach((t) => {
        if (!groups[t]) groups[t] = [];
        groups[t].push(o);
      });
    }
  });

  // Sort tags alphabetically; within each tag group, sort by priority then date
  Object.keys(groups).sort((a, b) => a.localeCompare(b)).forEach((tag) => {
    const items = sortByPriorityThenDate(groups[tag]);
    appendGroup("#" + tag, items);
  });

  if (untagged.length > 0) {
    appendGroup("Untagged", sortByPriorityThenDate(untagged));
  }
}

function getObsFolders(o) {
  // Primary folder + any folders from folderPriorities map
  const set = new Set();
  if (o.folder) set.add(o.folder);
  if (o.folderPriorities) {
    Object.keys(o.folderPriorities).forEach((f) => set.add(f));
  }
  return Array.from(set);
}

function getDateKey(timestamp) {
  if (!timestamp) return "unknown";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Local-date key (not UTC) — used for the streak so a late-evening entry
// in the user's own timezone counts toward "today" correctly.
function getLocalDateKey(timestamp) {
  if (!timestamp) return null;
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const streakBadge = document.getElementById("streak-badge");

// Computes the current "journaling streak": consecutive calendar days
// (in the user's local timezone), ending today or yesterday, with at
// least one non-archived observation logged.
function computeStreak() {
  const daysWithEntries = new Set();
  observations.forEach((o) => {
    if (o.archived) return;
    const key = getLocalDateKey(o.createdAt);
    if (key) daysWithEntries.add(key);
  });

  if (daysWithEntries.size === 0) return 0;

  const today = new Date();
  const todayKeyLocal = getLocalDateKey({ toDate: () => today });

  // Walk backwards from today. If today has no entry yet, the streak is
  // still considered "alive" as long as yesterday had one — the user just
  // hasn't logged today yet. If yesterday is also missing, streak is 0.
  let cursor = new Date(today);
  if (!daysWithEntries.has(todayKeyLocal)) {
    cursor.setDate(cursor.getDate() - 1);
    const yesterdayKey = getLocalDateKey({ toDate: () => cursor });
    if (!daysWithEntries.has(yesterdayKey)) return 0;
  }

  let streak = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = getLocalDateKey({ toDate: () => cursor });
    if (!daysWithEntries.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function updateStreakBadge() {
  const streak = computeStreak();
  if (streak <= 0) {
    streakBadge.classList.add("hidden");
    return;
  }
  streakBadge.classList.remove("hidden");
  streakBadge.classList.toggle("streak-hot", streak >= 7);
  streakBadge.textContent = `🔥 ${streak} day${streak !== 1 ? "s" : ""}`;
}

// Counts non-archived observations logged today / this week / this month /
// this year, shown as a stat row at the top of the Dashboard. Week starts
// Monday, matching the convention used elsewhere (export date ranges).
function updateDashStats() {
  const elToday = document.getElementById("dash-stat-today");
  const elWeek = document.getElementById("dash-stat-week");
  const elMonth = document.getElementById("dash-stat-month");
  const elYear = document.getElementById("dash-stat-year");
  if (!elToday) return; // dashboard stat row not present (shouldn't happen, but stay safe)

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diffToMonday = (day === 0) ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  let today = 0, week = 0, month = 0, year = 0;
  observations.forEach((o) => {
    if (o.archived) return;
    if (!o.createdAt || !o.createdAt.toDate) return;
    const d = o.createdAt.toDate();
    if (d >= startOfToday) today++;
    if (d >= startOfWeek) week++;
    if (d >= startOfMonth) month++;
    if (d >= startOfYear) year++;
  });

  elToday.textContent = today;
  elWeek.textContent = week;
  elMonth.textContent = month;
  elYear.textContent = year;
}

function formatDateHeader(dateKey) {
  if (dateKey === "unknown") return "Unsorted";
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// ===================== Render tile =====================
// Builds a click-to-zoom image grid (1 = full width, 2-3 = side by side,
// 4+ = grid with "+N more" overflow tile) for a tile's image array. Reuses
// the same CSS classes the old InstaLearning cards used (now the standard
// observation tile image grid since the two features were merged).
// Builds a click-to-zoom image grid. If `sharedGallery` is provided, uploaded
// images are pushed into it so they can navigate alongside Drive/TradingView
// previews from the same observation via the lightbox prev/next arrows.
function buildImageGrid(images, sharedGallery) {
  // Pre-populate the shared gallery with the uploaded images (synchronously,
  // since base64 images are available immediately at render time).
  if (sharedGallery) {
    images.forEach((src) => sharedGallery.push(src));
  }

  const grid = document.createElement("div");
  const countClass = images.length === 1 ? "count-1"
    : images.length === 2 ? "count-2"
    : images.length === 3 ? "count-3" : "count-4plus";
  grid.className = `il-card-images ${countClass}`;

  const show = Math.min(images.length, 4);
  images.slice(0, show).forEach((src, i) => {
    if (i === 3 && images.length > 4) {
      const more = document.createElement("div");
      more.className = "il-img-more";
      more.textContent = `+${images.length - 3}`;
      // Open lightbox with the shared gallery (which will also include live previews
      // once they load) or fall back to just the uploaded images array.
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(src, sharedGallery || images, sharedGallery ? sharedGallery.indexOf(src) : 3);
      });
      grid.appendChild(more);
    } else {
      const img = document.createElement("img");
      img.className = "il-img";
      img.src = src;
      img.alt = "Observation image";
      img.draggable = false; // prevent native browser image-drag from hijacking pointer events (e.g. Revision card swipe)
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        // Use shared gallery if available (includes live preview images);
        // fall back to just the uploaded images array.
        const gallery = sharedGallery || images;
        const idx = sharedGallery ? sharedGallery.indexOf(src) : i;
        openLightbox(src, gallery, idx);
      });
      grid.appendChild(img);
    }
  });
  return grid;
}

function renderTile(o) {
  const tile = document.createElement("div");

  const displayPriority = getDisplayPriority(o);
  const isExpanded = expandedTileId === o.id;

  tile.className = `tile priority-${displayPriority}` + (isExpanded ? " expanded" : "");

  const body = document.createElement("div");
  // Backward-compat: old observations stored a single `imageBase64`; newer
  // ones (and merged-in InstaLearning entries) store an `images` array.
  const obsImages = (o.images && o.images.length > 0) ? o.images : (o.imageBase64 ? [o.imageBase64] : []);
  const hasImage = obsImages.length > 0;
  // Backward-compat: old observations stored a single `link` string; newer
  // ones store a `links` array.
  const hasLink = (o.links && o.links.length > 0) || !!o.link;
  body.className = "tile-body" + (!hasImage && !hasLink ? " fill-text" : "");

  // ---- Collapsed preview content ----
  // Header row: serial number badge + text + chevron
  const headerRow = document.createElement("div");
  headerRow.className = "tile-header-row";

  // Serial number — stable position in creation order, unaffected by filters/sorting.
  const serial = obsSerialMap[o.id];
  if (serial !== undefined) {
    const serialEl = document.createElement("span");
    serialEl.className = "tile-serial";
    serialEl.textContent = `#${serial}`;
    headerRow.appendChild(serialEl);
  }

  if (o.text) {
    const textEl = document.createElement("div");
    textEl.className = "tile-text";
    textEl.textContent = o.text;
    headerRow.appendChild(textEl);
  } else if (!hasImage && !hasLink) {
    const textEl = document.createElement("div");
    textEl.className = "tile-text";
    textEl.textContent = "(no text)";
    headerRow.appendChild(textEl);
  }

  const chevron = document.createElement("span");
  chevron.className = "expand-chevron";
  chevron.textContent = "▾";
  headerRow.appendChild(chevron);

  body.appendChild(headerRow);

  // Status badges (image pending / archived)
  if (o.imagePending || o.archived) {
    const badgeRow = document.createElement("div");
    badgeRow.className = "tile-badge-row";
    if (o.imagePending) {
      const badge = document.createElement("span");
      badge.className = "status-badge pending";
      badge.textContent = "Image pending";
      badgeRow.appendChild(badge);
    }
    if (o.archived) {
      const badge = document.createElement("span");
      badge.className = "status-badge archived";
      badge.textContent = "Archived";
      badgeRow.appendChild(badge);
    }
    body.appendChild(badgeRow);
  }

  // Collapsed image preview + links — share a gallery so all sources are
  // navigable together in the lightbox (uploaded + Drive + TradingView).
  if (!isExpanded && (hasImage || hasLink)) {
    const sharedGallery = [];
    if (hasImage) body.appendChild(buildImageGrid(obsImages, sharedGallery));
    if (hasLink) body.appendChild(buildLinksSection(o, "tile-link", sharedGallery));
  }

  // Meta row: tags + time (always visible)
  const meta = document.createElement("div");
  meta.className = "tile-meta";

  const tagsEl = document.createElement("div");
  tagsEl.className = "tile-tags";
  (o.tags || []).forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip clickable";
    chip.textContent = "#" + t;
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      setTagFilter(t);
    });
    tagsEl.appendChild(chip);
  });
  if (o.category) {
    const catPill = document.createElement("span");
    catPill.className = "category-pill";
    catPill.textContent = o.category;
    tagsEl.appendChild(catPill);
  }
  meta.appendChild(tagsEl);

  const timeEl = document.createElement("div");
  timeEl.className = "tile-time";
  timeEl.textContent = formatTime(o.createdAt);
  meta.appendChild(timeEl);

  body.appendChild(meta);

  // ---- Expanded content ----
  const expandContent = document.createElement("div");
  expandContent.className = "tile-expand-content";

  if (hasImage || hasLink) {
    const sharedGallery = [];
    if (hasImage) expandContent.appendChild(buildImageGrid(obsImages, sharedGallery));
    if (hasLink) expandContent.appendChild(buildLinksSection(o, "tile-link", sharedGallery));
  }

  // Folder/priority details
  const obsFolders = getObsFolders(o);
  if (obsFolders.length > 0) {
    const row = document.createElement("div");
    row.className = "tile-expand-row";
    const folderInfo = obsFolders.map((f) => {
      const p = (f === o.folder) ? (o.priority || "medium") : ((o.folderPriorities && o.folderPriorities[f]) || "medium");
      return `${f} (${p})`;
    }).join(", ");
    row.innerHTML = `<span><b>Folders:</b> ${escapeHtml(folderInfo)}</span>`;
    expandContent.appendChild(row);
  }

  const dateRow = document.createElement("div");
  dateRow.className = "tile-expand-row";
  const fullDate = o.createdAt && o.createdAt.toDate
    ? o.createdAt.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "";
  dateRow.innerHTML = `<span><b>Logged:</b> ${escapeHtml(fullDate)}</span>`;
  expandContent.appendChild(dateRow);

  body.appendChild(expandContent);

  body.addEventListener("click", () => {
    expandedTileId = isExpanded ? null : o.id;
    renderFeed();
  });

  tile.appendChild(body);

  // Actions
  const actions = document.createElement("div");
  actions.className = "tile-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "tile-action-btn";
  editBtn.innerHTML = "✎";
  editBtn.title = "Edit";
  editBtn.addEventListener("click", (e) => { e.stopPropagation(); openEditModal(o); });
  actions.appendChild(editBtn);

  const copyBtn = document.createElement("button");
  copyBtn.className = "tile-action-btn";
  copyBtn.innerHTML = "⧉";
  copyBtn.title = "Copy to folder";
  copyBtn.addEventListener("click", (e) => { e.stopPropagation(); openCopyModal(o); });
  actions.appendChild(copyBtn);

  const tileStarBtn = document.createElement("button");
  tileStarBtn.className = "tile-action-btn" + (o.starred ? " starred" : "");
  tileStarBtn.innerHTML = o.starred ? "★" : "☆";
  tileStarBtn.title = o.starred ? "Unstar" : "Star for revision";
  tileStarBtn.style.color = o.starred ? "#f5c518" : "";
  tileStarBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleObsStar(o);
    tileStarBtn.innerHTML = o.starred ? "★" : "☆";
    tileStarBtn.style.color = o.starred ? "#f5c518" : "";
    tileStarBtn.title = o.starred ? "Unstar" : "Star for revision";
  });
  actions.appendChild(tileStarBtn);

  tile.appendChild(actions);

  // Folder pills (only show in "All" view, and only if observation belongs to >1 folder or non-default)
  if (activeFolder === "all" && obsFolders.length > 1) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    const pillsEl = document.createElement("div");
    pillsEl.className = "folder-pills";
    obsFolders.forEach((f) => {
      const pill = document.createElement("span");
      pill.className = "folder-pill";
      pill.textContent = f;
      pillsEl.appendChild(pill);
    });
    body.insertBefore(pillsEl, expandContent);
  }

  return tile;
}

// ===================== Live link image preview (Drive + TradingView) =====================
// If a web link points at a public Google Drive file or a TradingView chart
// snapshot, show the image live (fetched fresh each time it's viewed)
// instead of just the plain 🔗 link. Nothing is downloaded or stored —
// Drive blocks that for browser apps (CORS) — this only displays the image
// inline via <img src>, which both services allow.

function extractDriveFileId(url) {
  if (!url) return null;
  // Matches /file/d/{id}/... and /folders/{id} link formats
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { id: m[1], isFolder: false };
  m = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { id: m[1], isFolder: true };
  // Matches ?id={id} style links (uc?id=..., open?id=...)
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return { id: m[1], isFolder: false };
  return null;
}

function isGoogleDriveUrl(url) {
  return !!url && /drive\.google\.com/.test(url);
}

function isTradingViewUrl(url) {
  return !!url && /tradingview\.com/.test(url);
}

function isInstagramUrl(url) {
  return !!url && /instagram\.com\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/i.test(url);
}

function buildInstagramEmbed(url, onFail) {
  const match = url.match(/instagram\.com\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/i);
  if (!match) return null;
  const code = match[2];
  
  const wrap = document.createElement("div");
  wrap.className = "instagram-preview-wrap";
  
  const iframe = document.createElement("iframe");
  iframe.className = "instagram-embed";
  iframe.src = `https://www.instagram.com/reel/${code}/embed/`;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("allow", "encrypted-media");
  
  iframe.addEventListener("click", (e) => e.stopPropagation());
  
  wrap.appendChild(iframe);
  return wrap;
}

// TradingView snapshot links come in two shapes the person might paste:
//   - the viewer page:  https://www.tradingview.com/x/{code}/
//   - the direct image: https://s3.tradingview.com/snapshots/{c}/{code}.png
// Only the second is an actual image URL; the first needs converting.
// Confirmed via TradingView's own og:image meta tag: the snapshot is bucketed
// into a folder named after the snapshot code's first character, lowercased
// (e.g. code "OyhZOd4X" -> folder "o" -> .../snapshots/o/OyhZOd4X.png).
function extractTradingViewSnapshotUrls(url) {
  if (!url) return [];
  // Already a direct S3 snapshot image — use as-is.
  if (/s3\.tradingview\.com\/snapshots\//.test(url)) return [url];
  const m = url.match(/tradingview\.com\/x\/([a-zA-Z0-9]+)/);
  if (m) {
    const code = m[1];
    return [`https://s3.tradingview.com/snapshots/${code.charAt(0).toLowerCase()}/${code}.png`];
  }
  return [];
}

// Builds a live <img> that tries multiple known URL patterns in sequence for
// the given source ("drive" | "tradingview"), falling back automatically if
// one fails to load, and hiding entirely if all candidates fail.
function buildLiveImagePreview(candidates, altText, onFail, sharedGallery) {
  const img = document.createElement("img");
  img.className = "drive-link-preview"; // shared styling for any live link preview
  img.alt = altText;
  img.loading = "lazy";
  img.style.cursor = "pointer";
  img.draggable = false; // prevent native browser image-drag from hijacking pointer events
  let attempt = 0;
  let loaded = false;
  function tryNext() {
    if (attempt >= candidates.length) {
      img.style.display = "none";
      if (img.parentElement) img.parentElement.style.display = "none";
      if (onFail) onFail();
      return;
    }
    img.src = candidates[attempt];
    attempt++;
  }
  img.addEventListener("load", () => {
    loaded = true;
    // Push into the shared gallery once the URL resolves (async), so this
    // live-preview image becomes part of the same navigable set as the
    // observation's uploaded photos.
    if (sharedGallery) {
      sharedGallery.push(img.src);
      // If the lightbox is already open showing the same gallery, refresh
      // the counter so the newly-loaded image shows up immediately.
      if (!lightbox.classList.contains("hidden") && lightboxGallery === sharedGallery) {
        lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxGallery.length}`;
        lightboxCounter.classList.remove("hidden");
        lightboxNextBtn.classList.remove("hidden");
        lightboxPrevBtn.classList.remove("hidden");
      }
    }
  });
  img.addEventListener("error", tryNext);
  img.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!loaded) return;
    if (sharedGallery && sharedGallery.length > 1) {
      // Open in the full shared gallery so user can swipe between all sources.
      const idx = sharedGallery.indexOf(img.src);
      openLightbox(img.src, sharedGallery, idx >= 0 ? idx : sharedGallery.length - 1);
    } else {
      openLightbox(img.src);
    }
  });
  tryNext();
  return img;
}

function buildDriveFolderPreview(folderId, onFail, sharedGallery) {
  const wrap = document.createElement("div");
  wrap.className = "drive-folder-preview-wrap";
  
  const loading = document.createElement("div");
  loading.className = "drive-folder-loading";
  loading.textContent = "⏳ Loading Drive folder images...";
  wrap.appendChild(loading);
  
  loadDriveFolderImages(folderId, wrap, loading, onFail, sharedGallery);
  
  return wrap;
}

async function loadDriveFolderImages(folderId, wrap, loading, onFail, sharedGallery) {
  console.log("loadDriveFolderImages started for folderId:", folderId);
  const apiKey = await loadGoogleApiKey();
  console.log("Loaded Google API key status:", !!apiKey);
  if (!apiKey) {
    loading.innerHTML = `<span style="color:var(--high)">⚠️ Enter Google API Key in Settings to view folder</span>`;
    if (onFail) onFail();
    return;
  }
  
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=files(id,name)&pageSize=50`;
    
    console.log("Fetching files from Google API URL:", url);
    const resp = await fetch(url);
    console.log("API response status:", resp.status);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData.error && errData.error.message ? errData.error.message : `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    
    const data = await resp.json();
    const files = data.files || [];
    
    if (files.length === 0) {
      loading.textContent = "📂 Folder has no images";
      setTimeout(() => {
        wrap.style.display = "none";
        if (onFail) onFail();
      }, 2000);
      return;
    }
    
    loading.remove();
    
    const grid = document.createElement("div");
    grid.className = "drive-folder-grid";
    const count = Math.min(files.length, 4);
    grid.classList.add(`grid-count-${count}`);
    
    files.forEach((file) => {
      const fileId = file.id;
      const candidates = [
        `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
      ];
      
      const imgWrap = document.createElement("div");
      imgWrap.className = "drive-preview-wrap folder-item";
      
      const img = buildLiveImagePreview(candidates, file.name || "Folder Image", null, sharedGallery);
      imgWrap.appendChild(img);
      grid.appendChild(imgWrap);
    });
    
    wrap.appendChild(grid);
    
  } catch (err) {
    console.error("loadDriveFolderImages error:", err);
    loading.innerHTML = `<span style="color:var(--high)">⚠️ Folder load failed: ${err.message}</span>`;
    setTimeout(() => {
      wrap.style.display = "none";
      if (onFail) onFail();
    }, 3000);
  }
}

function buildLinkPreviewIfApplicable(url, onFail, sharedGallery) {
  console.log("buildLinkPreviewIfApplicable url:", url);
  let candidates = null;
  let altText = "";

  if (isGoogleDriveUrl(url)) {
    const parsed = extractDriveFileId(url);
    console.log("Google Drive URL detected. Parsed result:", parsed);
    if (!parsed) return null;
    if (parsed.isFolder) {
      console.log("Google Drive folder detected. ID:", parsed.id);
      return buildDriveFolderPreview(parsed.id, onFail, sharedGallery);
    }
    candidates = [
      `https://drive.google.com/thumbnail?id=${parsed.id}&sz=w1000`,
      `https://lh3.googleusercontent.com/d/${parsed.id}=w1000`,
    ];
    altText = "Image from Google Drive";
  } else if (isTradingViewUrl(url)) {
    candidates = extractTradingViewSnapshotUrls(url);
    altText = "TradingView chart snapshot";
  } else if (isInstagramUrl(url)) {
    return buildInstagramEmbed(url, onFail);
  }

  if (!candidates || candidates.length === 0) return null;
  const wrap = document.createElement("div");
  wrap.className = "drive-preview-wrap";
  wrap.appendChild(buildLiveImagePreview(candidates, altText, onFail, sharedGallery));
  return wrap;
}

// Builds the full link section for a tile/card: one clickable 🔗 row per
// link, plus any live image previews (Drive/TradingView) underneath. Used
// by the Dashboard tile (collapsed + expanded) and the Revision card so all
// three stay in sync as link rendering evolves.
// Builds the full link section for a tile/card. For each link: if it
// resolves to a live image preview (Drive/TradingView), show ONLY the image
// once it loads (click the image to open the original link) and hide the
// raw URL text. If a link has no preview, or the preview fails to load,
// fall back to showing the plain clickable 🔗 row.
function buildLinksSection(o, linkClass, sharedGallery) {
  const frag = document.createDocumentFragment();
  const urls = (o.links && o.links.length > 0) ? o.links : (o.link ? [o.link] : []);

  urls.forEach((url) => {
    const linkEl = document.createElement("a");
    linkEl.className = linkClass;
    linkEl.href = url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = "🔗 " + url;
    linkEl.addEventListener("click", (e) => e.stopPropagation());

    const preview = buildLinkPreviewIfApplicable(url, () => linkEl.classList.remove("hidden"), sharedGallery);
    if (preview) {
      linkEl.classList.add("hidden");
      frag.appendChild(linkEl);
      frag.appendChild(preview);
    } else {
      frag.appendChild(linkEl);
    }
  });

  return frag;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===================== Lightbox (single image + multi-image gallery) =====================
const lightboxRotateBtn = document.getElementById("lightbox-rotate");
const lightboxPrevBtn = document.getElementById("lightbox-prev");
const lightboxNextBtn = document.getElementById("lightbox-next");
const lightboxCounter = document.getElementById("lightbox-counter");
let lightboxRotation = 0;
let lightboxGallery = [];   // current set of image srcs (empty = single-image mode)
let lightboxIndex = 0;

// `src` can be a single image string (single-image mode, no nav arrows),
// or pass `gallery` (array of srcs) + `index` to open in multi-image mode
// with prev/next navigation and a "2 / 5" counter.
function openLightbox(src, gallery, index) {
  if (Array.isArray(gallery) && gallery.length > 0) {
    lightboxGallery = gallery;
    lightboxIndex = index || 0;
  } else {
    lightboxGallery = [];
    lightboxIndex = 0;
  }
  showLightboxImage(lightboxGallery.length > 0 ? lightboxGallery[lightboxIndex] : src);
}

function showLightboxImage(src) {
  lightboxImg.src = src;
  lightboxRotation = 0;
  lightboxImg.style.transform = "rotate(0deg)";
  lightboxImg.style.maxWidth = "";
  lightboxImg.style.maxHeight = "";
  lightbox.classList.remove("hidden");

  const isGallery = lightboxGallery.length > 1;
  lightboxPrevBtn.classList.toggle("hidden", !isGallery);
  lightboxNextBtn.classList.toggle("hidden", !isGallery);
  lightboxCounter.classList.toggle("hidden", !isGallery);
  if (isGallery) {
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxGallery.length}`;
  }
}

function lightboxGoTo(delta) {
  if (lightboxGallery.length === 0) return;
  lightboxIndex = (lightboxIndex + delta + lightboxGallery.length) % lightboxGallery.length;
  showLightboxImage(lightboxGallery[lightboxIndex]);
}

lightboxPrevBtn.addEventListener("click", (e) => { e.stopPropagation(); lightboxGoTo(-1); });
lightboxNextBtn.addEventListener("click", (e) => { e.stopPropagation(); lightboxGoTo(1); });

lightboxClose.addEventListener("click", () => lightbox.classList.add("hidden"));
lightboxRotateBtn.addEventListener("click", () => {
  lightboxRotation = (lightboxRotation + 90) % 360;
  lightboxImg.style.transform = `rotate(${lightboxRotation}deg)`;
  const isSideways = lightboxRotation === 90 || lightboxRotation === 270;
  if (isSideways) {
    lightboxImg.style.maxWidth = "86vh";
    lightboxImg.style.maxHeight = "92vw";
  } else {
    lightboxImg.style.maxWidth = "92vw";
    lightboxImg.style.maxHeight = "86vh";
  }
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.add("hidden");
});

// Keyboard navigation while the lightbox is open
document.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("hidden")) return;
  if (e.key === "ArrowLeft") lightboxGoTo(-1);
  else if (e.key === "ArrowRight") lightboxGoTo(1);
  else if (e.key === "Escape") lightbox.classList.add("hidden");
});

// Touch swipe navigation (mobile) — horizontal swipe moves between images,
// independent of the rotate/close buttons which stop propagation themselves.
(function attachLightboxSwipe() {
  let startX = 0, startY = 0, tracking = false;
  lightboxImg.addEventListener("pointerdown", (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });
  lightboxImg.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      lightboxGoTo(dx > 0 ? -1 : 1);
    }
  });
})();

// ===================== Observation Modal (Create/Edit) =====================
function populateFolderSelects() {
  [copyFolderSelect].forEach((sel) => {
    const currentVal = sel.value;
    sel.innerHTML = "";
    folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      sel.appendChild(opt);
    });
    if (folders.includes(currentVal)) sel.value = currentVal;
  });
}

function populateFolderSelect(sel, preferred) {
  sel.innerHTML = "";
  folders.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  });
  if (preferred && folders.includes(preferred)) {
    sel.value = preferred;
  }
}

fabAdd.addEventListener("click", () => openCreateModal());

// ---- Shared clipboard-paste support (Ctrl+V) for image uploads ----
// Extracts the first image found in a paste event's clipboard data, if any.
// Returns null if the clipboard didn't contain an image (so callers can let
// normal text paste behavior continue uninterrupted).
function getImageFromClipboardEvent(e) {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

// Attaches a paste listener to `container` (any element with focus context —
// typically the modal or a specific field) that intercepts pasted images and
// hands them to `onImage(file)`. Pasting plain text is left untouched.
function attachImagePaste(container, onImage) {
  container.addEventListener("paste", (e) => {
    const file = getImageFromClipboardEvent(e);
    if (!file) return; // not an image — let default paste (text) proceed
    e.preventDefault();
    onImage(file);
  });
}

// Default folder for new observations: current active folder if it's a real folder,
// otherwise "Technical" if it exists, otherwise the first folder.
function getDefaultFolder() {
  if (activeFolder !== "all" && folders.includes(activeFolder)) return activeFolder;
  if (folders.includes("Technical")) return "Technical";
  return folders[0];
}

// ---- Build a single .obs-entry block from the template ----
function buildObsEntry(index) {
  const frag = obsEntryTemplate.content.cloneNode(true);
  const entry = frag.querySelector(".obs-entry");
  entry.dataset.index = index;

  const folderSel = entry.querySelector(".obs-folder");
  populateFolderSelect(folderSel, getDefaultFolder());

  // Remove button (only meaningful when there are multiple entries)
  const removeBtn = entry.querySelector(".obs-entry-remove");
  removeBtn.addEventListener("click", () => {
    entry.remove();
    updateObsEntryHeaders();
  });

  // Web links — multiple per observation, same "add to a list" pattern as
  // images. Each link is checked for a live Drive/TradingView image preview
  // wherever the observation is displayed.
  const linkInput = entry.querySelector(".obs-link-input");
  const linkAddBtn = entry.querySelector(".obs-link-add-btn");
  const linksList = entry.querySelector(".obs-links-list");
  entry._pendingLinks = []; // array of URL strings, lives on the entry node

  function renderEntryLinksList() {
    linksList.innerHTML = "";
    entry._pendingLinks.forEach((url, i) => {
      const row = document.createElement("div");
      row.className = "obs-link-row";
      const text = document.createElement("span");
      text.className = "obs-link-row-text";
      text.textContent = url;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "obs-link-row-remove";
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        entry._pendingLinks.splice(i, 1);
        renderEntryLinksList();
      });
      row.appendChild(text);
      row.appendChild(rm);
      linksList.appendChild(row);
    });
  }
  entry._renderLinksList = renderEntryLinksList; // exposed for openEditModal to reuse

  function addLinkFromInput() {
    const url = linkInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      showToast("Link should start with http:// or https://");
      return;
    }
    entry._pendingLinks.push(url);
    linkInput.value = "";
    renderEntryLinksList();
  }

  linkAddBtn.addEventListener("click", addLinkFromInput);
  linkInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLinkFromInput();
    }
  });

  // Image handling — multiple images per observation, same pattern as the
  // old InstaLearning upload zone (now merged into Observations).
  const imageFile = entry.querySelector(".obs-image-file");
  const imageZone = entry.querySelector(".obs-image-zone");
  const imageGrid = entry.querySelector(".obs-image-grid");
  const imagePending = entry.querySelector(".obs-image-pending");
  entry._pendingImages = []; // array of base64 strings, lives on the entry node

  function renderEntryImageGrid() {
    imageGrid.innerHTML = "";
    entry._pendingImages.forEach((src, i) => {
      const wrap = document.createElement("div");
      wrap.className = "il-thumb-wrap";
      const img = document.createElement("img");
      img.src = src;
      img.alt = "Preview";
      const rm = document.createElement("button");
      rm.className = "il-thumb-remove";
      rm.type = "button";
      rm.textContent = "✕";
      rm.addEventListener("click", () => {
        entry._pendingImages.splice(i, 1);
        renderEntryImageGrid();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      imageGrid.appendChild(wrap);
    });
  }
  entry._renderImageGrid = renderEntryImageGrid; // exposed for openEditModal to reuse

  function applyImageFiles(files) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showToast("Please select an image file");
      return;
    }
    Promise.all(imageFiles.map((f) => resizeImageToBase64(f, 1024, 0.7)))
      .then((bases) => {
        bases.forEach((b) => entry._pendingImages.push(b));
        renderEntryImageGrid();
        // If images are provided, image-pending no longer makes sense
        imagePending.checked = false;
      })
      .catch((err) => {
        console.error(err);
        showToast("Could not process one or more images");
      });
  }

  imageFile.addEventListener("change", (e) => {
    if (!e.target.files.length) return;
    applyImageFiles(e.target.files);
    e.target.value = "";
  });

  imageZone.addEventListener("dragover", (e) => { e.preventDefault(); imageZone.classList.add("drag-over"); });
  imageZone.addEventListener("dragleave", () => imageZone.classList.remove("drag-over"));
  imageZone.addEventListener("drop", (e) => {
    e.preventDefault();
    imageZone.classList.remove("drag-over");
    applyImageFiles(e.dataTransfer.files);
  });

  // Paste an image anywhere in this observation block (Ctrl+V) to attach it —
  // no need to click "choose file" first.
  attachImagePaste(entry, (file) => {
    applyImageFiles([file]);
    showToast("Image pasted from clipboard");
  });

  // Tag-based category suggestion (per entry)
  const textArea = entry.querySelector(".obs-text");
  const tagsInput = entry.querySelector(".obs-tags");
  attachTagAutocomplete(tagsInput);
  const suggestionBanner = entry.querySelector(".suggestion-banner");
  const suggestionText = entry.querySelector(".suggestion-text");
  const suggestionAccept = entry.querySelector(".suggestion-accept");
  const suggestionDismiss = entry.querySelector(".suggestion-dismiss");

  function hideSuggestion() {
    suggestionBanner.classList.add("hidden");
    entry.dataset.suggestedCategory = "";
  }

  function showSuggestion(category) {
    entry.dataset.suggestedCategory = category;
    const folderHint = folders.includes(category) ? ` and move it to that folder` : "";
    suggestionText.textContent = `This looks like a "${category}" observation. Tag it${folderHint}?`;
    suggestionBanner.classList.remove("hidden");
  }

  suggestionAccept.addEventListener("click", () => {
    const cat = entry.dataset.suggestedCategory;
    if (cat) {
      entry.dataset.category = cat;
      entry.dataset.lastDecidedCategory = cat;
      if (folders.includes(cat)) folderSel.value = cat;
      showToast(`Tagged as "${cat}"`);
    }
    hideSuggestion();
  });

  suggestionDismiss.addEventListener("click", () => {
    entry.dataset.lastDecidedCategory = entry.dataset.suggestedCategory || "";
    hideSuggestion();
  });

  let suggestionDebounce = null;
  textArea.addEventListener("input", () => {
    clearTimeout(suggestionDebounce);
    suggestionDebounce = setTimeout(() => {
      const tags = tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean);
      const suggestion = suggestCategory(textArea.value, tags);
      if (suggestion && suggestion.category !== entry.dataset.lastDecidedCategory) {
        showSuggestion(suggestion.category);
      } else {
        hideSuggestion();
      }
    }, 500);
  });

  return entry;
}

function updateObsEntryHeaders() {
  const entries = obsModalBody.querySelectorAll(".obs-entry");
  entries.forEach((entry, i) => {
    const header = entry.querySelector(".obs-entry-header");
    const title = entry.querySelector(".obs-entry-title");
    if (entries.length > 1) {
      header.classList.remove("hidden");
      title.textContent = `Observation ${i + 1}`;
    } else {
      header.classList.add("hidden");
    }
  });
}

obsAddAnotherBtn.addEventListener("click", () => {
  const entries = obsModalBody.querySelectorAll(".obs-entry");
  const entry = buildObsEntry(entries.length);
  obsModalBody.appendChild(entry);
  updateObsEntryHeaders();
  entry.querySelector(".obs-text").focus();
});

function openCreateModal() {
  editingObsId = null;
  obsModalTitle.textContent = "New Observation";
  obsDeleteBtn.classList.add("hidden");
  obsArchiveBtn.classList.add("hidden");
  obsAddAnotherBtn.classList.remove("hidden");
  obsModalBody.innerHTML = "";
  const entry = buildObsEntry(0);
  obsModalBody.appendChild(entry);
  updateObsEntryHeaders();
  obsModal.classList.remove("hidden");
}

function openEditModal(o) {
  editingObsId = o.id;
  obsModalTitle.textContent = "Edit Observation";
  obsDeleteBtn.classList.remove("hidden");
  obsArchiveBtn.classList.remove("hidden");
  obsArchiveBtn.textContent = o.archived ? "Unarchive" : "Archive";
  obsAddAnotherBtn.classList.add("hidden"); // edit mode = single observation only

  obsModalBody.innerHTML = "";
  const entry = buildObsEntry(0);

  entry.querySelector(".obs-text").value = o.text || "";
  entry.querySelector(".obs-tags").value = (o.tags || []).join(", ");

  // Backward-compat: old observations stored a single `link` string; new
  // ones store a `links` array. Normalize to the array form for editing.
  entry._pendingLinks = o.links && o.links.length > 0
    ? [...o.links]
    : (o.link ? [o.link] : []);
  entry._renderLinksList();

  // Backward-compat: old observations stored a single `imageBase64`; new
  // ones store an `images` array. Normalize to the array form for editing.
  entry._pendingImages = o.images && o.images.length > 0
    ? [...o.images]
    : (o.imageBase64 ? [o.imageBase64] : []);
  entry._renderImageGrid();
  entry.querySelector(".obs-image-pending").checked = !!o.imagePending;

  populateFolderSelect(entry.querySelector(".obs-folder"), o.folder || folders[0]);
  entry.querySelector(".obs-priority").value = o.priority || "medium";

  // Category suggestion if not already tagged
  entry.dataset.category = o.category || "";
  entry.dataset.lastDecidedCategory = o.category || "";
  const suggestion = suggestCategory(o.text, o.tags);
  if (suggestion && suggestion.category !== o.category) {
    const folderHint = folders.includes(suggestion.category) ? ` and move it to that folder` : "";
    entry.dataset.suggestedCategory = suggestion.category;
    const banner = entry.querySelector(".suggestion-banner");
    entry.querySelector(".suggestion-text").textContent = `This looks like a "${suggestion.category}" observation. Tag it${folderHint}?`;
    banner.classList.remove("hidden");
  }

  obsModalBody.appendChild(entry);
  updateObsEntryHeaders();
  obsModal.classList.remove("hidden");
}

obsModalClose.addEventListener("click", () => obsModal.classList.add("hidden"));
obsCancelBtn.addEventListener("click", () => obsModal.classList.add("hidden"));

function resizeImageToBase64(file, maxDim, quality) {
  // GIFs must be read as-is (base64 passthrough) — drawing a GIF onto a
  // <canvas> and re-encoding as JPEG keeps only the first frame, killing
  // any animation. JPEG/PNG/WebP still get the resize+compress treatment
  // below to stay well under Firestore's ~1MB document size limit.
  if (file.type === "image/gif") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Build a Firestore-ready obsData object from a .obs-entry element. Returns null (and shows
// a toast) if validation fails.
function entryToObsData(entry) {
  const text = entry.querySelector(".obs-text").value.trim();
  const tags = entry.querySelector(".obs-tags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const folder = entry.querySelector(".obs-folder").value;
  const priority = entry.querySelector(".obs-priority").value;
  const imagePending = entry.querySelector(".obs-image-pending").checked;
  const images = entry._pendingImages || [];
  const category = entry.dataset.category || null;

  // If the person typed a link but never clicked "Add" / pressed Enter,
  // include it anyway rather than silently dropping it on save.
  const links = [...(entry._pendingLinks || [])];
  const linkInputEl = entry.querySelector(".obs-link-input");
  const leftoverLink = linkInputEl ? linkInputEl.value.trim() : "";
  if (leftoverLink) {
    if (!/^https?:\/\//i.test(leftoverLink)) {
      showToast("Link should start with http:// or https://");
      return null;
    }
    links.push(leftoverLink);
    linkInputEl.value = "";
  }

  if (!text && links.length === 0 && images.length === 0) {
    showToast("Add at least text, a link, or an image");
    return null;
  }

  const totalSize = images.reduce((s, b) => s + b.length, 0);
  if (totalSize > 900000) {
    showToast("Total image size too large. Remove some images or use smaller ones.");
    return null;
  }

  return {
    text,
    links,
    link: links[0] || "", // deprecated single-link field, kept for any older code path that still reads it
    tags,
    folder,
    priority,
    category,
    images,
    imageBase64: null, // deprecated single-image field; new saves always use `images`
    imagePending,
  };
}

obsSaveBtn.addEventListener("click", async () => {
  const entries = Array.from(obsModalBody.querySelectorAll(".obs-entry"));
  const obsDataList = [];
  for (const entry of entries) {
    const data = entryToObsData(entry);
    if (!data) return; // validation failed, toast already shown
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    obsDataList.push(data);
  }

  obsSaveBtn.disabled = true;
  obsSaveBtn.textContent = "Saving…";
  try {
    if (editingObsId) {
      // Edit mode: single entry, preserve archived flag and folderPriorities
      const existing = observations.find((o) => o.id === editingObsId) || {};
      const data = obsDataList[0];
      data.archived = !!existing.archived;
      await saveObservation(data, editingObsId);
      obsModal.classList.add("hidden");
      showToast(navigator.onLine ? "Observation updated" : "Observation updated (offline — will sync)");
    } else {
      // Create mode: one or more new observations, each gets its own document
      for (const data of obsDataList) {
        data.archived = false;
        await saveObservation(data, null);
      }
      obsModal.classList.add("hidden");
      const savedMsg = obsDataList.length > 1 ? `${obsDataList.length} observations saved` : "Observation saved";
      showToast(navigator.onLine ? savedMsg : savedMsg + " (offline — will sync)");
    }
  } catch (err) {
    console.error(err);
    showToast("Save failed: " + err.message);
  } finally {
    obsSaveBtn.disabled = false;
    obsSaveBtn.textContent = "Save";
  }
});

obsDeleteBtn.addEventListener("click", async () => {
  if (!editingObsId) return;
  if (!confirm("Delete this observation? This cannot be undone.")) return;
  try {
    await deleteObservation(editingObsId);
    obsModal.classList.add("hidden");
    showToast("Observation deleted");
  } catch (err) {
    console.error(err);
    showToast("Delete failed");
  }
});

obsArchiveBtn.addEventListener("click", async () => {
  if (!editingObsId) return;
  const existing = observations.find((o) => o.id === editingObsId);
  const newArchived = !(existing && existing.archived);
  try {
    await db.collection("users").doc(currentUser.uid).collection("observations")
      .doc(editingObsId).update({ archived: newArchived });
    obsModal.classList.add("hidden");
    showToast(newArchived ? "Observation archived" : "Observation unarchived");
  } catch (err) {
    console.error(err);
    showToast("Could not update archive status");
  }
});

// ===================== Trade Log =====================

function makeStat(value, label, colorClass) {
  const el = document.createElement("div");
  el.className = "summary-stat";
  const valClass = colorClass ? `stat-value ${colorClass}` : "stat-value";
  el.innerHTML = `<div class="${valClass}">${escapeHtml(String(value))}</div><div class="stat-label">${escapeHtml(label)}</div>`;
  return el;
}

function formatNum(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ===================== Trade Log =====================
// ===================== Trade Log =====================
let tradeUnsubscribe = null;

function subscribeTrades() {
  const ref = db.collection("users").doc(currentUser.uid).collection("tradeLogs")
    .orderBy("date", "desc");
  tradeUnsubscribe = ref.onSnapshot((snap) => {
    trades = [];
    snap.forEach((doc) => {
      trades.push({ id: doc.id, ...doc.data() });
    });
    if (activeView === "tradelog") renderTradeTable();
  }, (err) => {
    console.error("trades load error", err);
    showToast("Failed to load trade log");
  });
}

function saveTrade(data, id) {
  const col = db.collection("users").doc(currentUser.uid).collection("tradeLogs");
  if (id) return col.doc(id).update(data);
  return col.add(data);
}

function deleteTrade(id) {
  return db.collection("users").doc(currentUser.uid).collection("tradeLogs").doc(id).delete();
}

const TRADE_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "capital", label: "Capital" },
  { key: "numTrades", label: "No. of Trades" },
  { key: "grossPL", label: "Gross P/L" },
  { key: "netPL", label: "Net P/L" },
  { key: "duration", label: "Duration" },
  { key: "comments", label: "Comments" },
];

tradeSearchInput.addEventListener("input", () => renderTradeTable());
tradeFilterFrom.addEventListener("change", () => renderTradeTable());
tradeFilterTo.addEventListener("change", () => renderTradeTable());
tradeFilterClear.addEventListener("click", () => {
  tradeFilterFrom.value = "";
  tradeFilterTo.value = "";
  renderTradeTable();
});

function renderTradeTable() {
  tradeTableHead.innerHTML = "";
  tradeTableBody.innerHTML = "";

  TRADE_COLUMNS.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    tradeTableHead.appendChild(th);
  });
  const actionTh = document.createElement("th");
  actionTh.textContent = "";
  tradeTableHead.appendChild(actionTh);

  const query    = tradeSearchInput.value.trim().toLowerCase();
  const fromDate = tradeFilterFrom.value; // "YYYY-MM-DD" or ""
  const toDate   = tradeFilterTo.value;   // "YYYY-MM-DD" or ""

  const filtered = trades.filter((t) => {
    if (query && !(t.comments || "").toLowerCase().includes(query)) return false;
    if (fromDate && (t.date || "") < fromDate) return false;
    if (toDate   && (t.date || "") > toDate)   return false;
    return true;
  });

  if (filtered.length === 0) {
    tradeEmptyState.classList.remove("hidden");
  } else {
    tradeEmptyState.classList.add("hidden");
  }

  filtered.forEach((t) => {
    const tr = document.createElement("tr");
    tr.addEventListener("click", () => openTradeModal(t));

    TRADE_COLUMNS.forEach((col) => {
      const td = document.createElement("td");
      let val = t[col.key];
      if (col.key === "comments") {
        td.className = "comments-cell";
        td.textContent = val || "";
      } else if (col.key === "grossPL" || col.key === "netPL") {
        const num = Number(val) || 0;
        td.textContent = formatNum(num);
        td.classList.add(num >= 0 ? "pl-positive" : "pl-negative");
      } else if (col.key === "capital") {
        td.textContent = val != null ? formatNum(val) : "";
      } else {
        td.textContent = val != null ? val : "";
      }
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    actionTd.textContent = "✎";
    actionTd.style.textAlign = "center";
    tr.appendChild(actionTd);

    tradeTableBody.appendChild(tr);
  });

  renderTradeAnalytics(filtered);
}

function renderTradeAnalytics(rows) {
  tradeAnalytics.innerHTML = "";
  if (rows.length === 0) return;

  const netPLs = rows.map((t) => Number(t.netPL) || 0);
  const totalNet = netPLs.reduce((sum, v) => sum + v, 0);
  const totalGross = rows.reduce((sum, t) => sum + (Number(t.grossPL) || 0), 0);
  const totalTrades = rows.reduce((sum, t) => sum + (Number(t.numTrades) || 0), 0);
  const winDays = rows.filter((t) => (Number(t.netPL) || 0) > 0).length;
  const winRate = rows.length > 0 ? Math.round((winDays / rows.length) * 100) : 0;

  // Best and worst single-day net P/L across the visible rows
  const maxProfit = Math.max(...netPLs);
  const minLoss   = Math.min(...netPLs);

  tradeAnalytics.appendChild(makeStat(formatNum(totalNet), "Total Net P/L"));
  tradeAnalytics.appendChild(makeStat(formatNum(totalGross), "Total Gross P/L"));
  tradeAnalytics.appendChild(makeStat(totalTrades, "Total Trades"));
  tradeAnalytics.appendChild(makeStat(`${winRate}%`, "Win-day rate"));
  tradeAnalytics.appendChild(makeStat(formatNum(maxProfit), "Best day",  maxProfit >= 0 ? "stat-positive" : "stat-negative"));
  tradeAnalytics.appendChild(makeStat(formatNum(minLoss),   "Worst day", minLoss  >= 0 ? "stat-positive" : "stat-negative"));
}

// CSV export
tradeExportBtn.addEventListener("click", () => {
  if (trades.length === 0) {
    showToast("No trade logs to export");
    return;
  }
  const headers = TRADE_COLUMNS.map((c) => c.label);
  const rows = trades.map((t) => TRADE_COLUMNS.map((c) => {
    const val = t[c.key];
    const str = val != null ? String(val) : "";
    // Escape CSV: wrap in quotes if it contains comma, quote, or newline
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV downloaded");
});

// Trade modal
fabAddTrade.addEventListener("click", () => openTradeModal(null));

function openTradeModal(t) {
  if (t) {
    editingTradeId = t.id;
    tradeModalTitle.textContent = "Edit Trade Log";
    tradeDeleteBtn.classList.remove("hidden");
    tradeDate.value = t.date || "";
    tradeCapital.value = t.capital != null ? t.capital : "";
    tradeNum.value = t.numTrades != null ? t.numTrades : "";
    tradeGross.value = t.grossPL != null ? t.grossPL : "";
    tradeNet.value = t.netPL != null ? t.netPL : "";
    tradeDuration.value = t.duration || "";
    tradeComments.value = t.comments || "";
    // Show linked checklists panel for existing trades
    document.getElementById("trade-linked-checklists").classList.remove("hidden");
    renderLinkedChecklists(t.id);
  } else {
    editingTradeId = null;
    tradeModalTitle.textContent = "New Trade Log";
    tradeDeleteBtn.classList.add("hidden");
    tradeDate.value = new Date().toISOString().slice(0, 10);
    tradeCapital.value = "";
    tradeNum.value = "";
    tradeGross.value = "";
    tradeNet.value = "";
    tradeDuration.value = "";
    tradeComments.value = "";
    document.getElementById("trade-linked-checklists").classList.add("hidden");
  }
  tradeModal.classList.remove("hidden");
}

function renderLinkedChecklists(tradeId) {
  const list = document.getElementById("trade-cl-list");
  if (!list) return;
  const linked = checklistLogs.filter((cl) => cl.linkedTradeId === tradeId);
  list.innerHTML = "";

  if (linked.length === 0) {
    const empty = document.createElement("p");
    empty.style.cssText = "font-size:12px;color:var(--text-dim);margin:0;font-family:var(--font-mono);";
    empty.textContent = "No checklists linked to this trade yet.";
    list.appendChild(empty);
    return;
  }

  linked.forEach((cl) => {
    const pct = cl.total > 0 ? Math.round((cl.passed / cl.total) * 100) : 0;
    const item = document.createElement("div");
    item.className = "trade-cl-item";

    const header = document.createElement("div");
    header.className = "trade-cl-item-header";

    const name = document.createElement("span");
    name.className = "trade-cl-item-name";
    name.textContent = cl.checklistName || "Checklist";

    const score = document.createElement("span");
    score.className = "trade-cl-item-score" + (pct === 100 ? " score-good" : pct >= 70 ? " score-ok" : " score-bad");
    score.textContent = `${cl.passed}/${cl.total} (${pct}%)`;

    const editBtn = document.createElement("button");
    editBtn.className = "trade-cl-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openChecklistLogEditor(cl);
    });

    header.appendChild(name);
    header.appendChild(score);
    header.appendChild(editBtn);
    item.appendChild(header);

    if (cl.outcome) {
      const outcome = document.createElement("div");
      outcome.className = "trade-cl-item-outcome";
      outcome.textContent = `Outcome: ${cl.outcome}`;
      item.appendChild(outcome);
    }

    if (cl.preTrade || cl.postTrade) {
      const notes = document.createElement("div");
      notes.className = "trade-cl-item-notes";
      notes.textContent = [cl.preTrade && `Pre: ${cl.preTrade}`, cl.postTrade && `Post: ${cl.postTrade}`]
        .filter(Boolean).join("\n");
      item.appendChild(notes);
    }

    if ((cl.failed || []).length > 0) {
      const failed = document.createElement("div");
      failed.className = "trade-cl-item-notes";
      failed.style.color = "var(--high)";
      failed.textContent = `Failed: ${(cl.failed || []).join(", ")}`;
      item.appendChild(failed);
    }

    list.appendChild(item);
  });
}

tradeModalClose.addEventListener("click", () => tradeModal.classList.add("hidden"));
tradeCancelBtn.addEventListener("click", () => tradeModal.classList.add("hidden"));

tradeSaveBtn.addEventListener("click", async () => {
  const date = tradeDate.value;
  if (!date) {
    showToast("Date is required");
    return;
  }

  const data = {
    date,
    capital: tradeCapital.value !== "" ? Number(tradeCapital.value) : null,
    numTrades: tradeNum.value !== "" ? Number(tradeNum.value) : null,
    grossPL: tradeGross.value !== "" ? Number(tradeGross.value) : null,
    netPL: tradeNet.value !== "" ? Number(tradeNet.value) : null,
    duration: tradeDuration.value.trim(),
    comments: tradeComments.value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!editingTradeId) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  tradeSaveBtn.disabled = true;
  tradeSaveBtn.textContent = "Saving…";
  try {
    await saveTrade(data, editingTradeId);
    tradeModal.classList.add("hidden");
    showToast(editingTradeId ? "Trade log updated" : "Trade log saved");
  } catch (err) {
    console.error(err);
    showToast("Save failed: " + err.message);
  } finally {
    tradeSaveBtn.disabled = false;
    tradeSaveBtn.textContent = "Save";
  }
});

tradeDeleteBtn.addEventListener("click", async () => {
  if (!editingTradeId) return;
  if (!confirm("Delete this trade log entry? This cannot be undone.")) return;
  try {
    await deleteTrade(editingTradeId);
    tradeModal.classList.add("hidden");
    showToast("Trade log deleted");
  } catch (err) {
    console.error(err);
    showToast("Delete failed");
  }
});
function openCopyModal(o) {
  copyTargetObsId = o.id;
  populateFolderSelects();
  // Default to first folder that isn't already assigned, else first folder
  const existingFolders = getObsFolders(o);
  const candidate = folders.find((f) => !existingFolders.includes(f)) || folders[0];
  copyFolderSelect.value = candidate;
  copyPrioritySelect.value = "medium";
  copyModal.classList.remove("hidden");
}

copyModalClose.addEventListener("click", () => copyModal.classList.add("hidden"));
copyCancelBtn.addEventListener("click", () => copyModal.classList.add("hidden"));

copyConfirmBtn.addEventListener("click", async () => {
  const targetFolder = copyFolderSelect.value;
  const targetPriority = copyPrioritySelect.value;
  const obs = observations.find((o) => o.id === copyTargetObsId);
  if (!obs) return;

  const folderPriorities = { ...(obs.folderPriorities || {}) };
  folderPriorities[targetFolder] = targetPriority;

  try {
    await db.collection("users").doc(currentUser.uid).collection("observations")
      .doc(copyTargetObsId)
      .update({ folderPriorities });
    copyModal.classList.add("hidden");
    showToast(`Added to "${targetFolder}"`);
  } catch (err) {
    console.error(err);
    showToast("Could not copy to folder");
  }
});

// ===================== Revision mode =====================
// Today's reviewed/flagged ids are persisted in Firestore under
// users/{uid}/revisionState/{YYYY-MM-DD} so progress survives reloads,
// and only resets when the user taps "Reset" (per the chosen design).

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function revisionStateRef() {
  return db.collection("users").doc(currentUser.uid).collection("revisionState").doc(todayKey());
}

let revisionStateLoaded = false;

function loadRevisionState() {
  return revisionStateRef().get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      revisionReviewedIds = data.reviewed || [];
      revisionFlaggedIds = data.flagged || [];
    } else {
      revisionReviewedIds = [];
      revisionFlaggedIds = [];
    }
    revisionStateLoaded = true;
  }).catch((err) => {
    console.error("revision state load error", err);
    revisionReviewedIds = [];
    revisionFlaggedIds = [];
    revisionStateLoaded = true;
  });
}

function saveRevisionState() {
  return revisionStateRef().set({
    reviewed: revisionReviewedIds,
    flagged: revisionFlaggedIds,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }).catch((err) => {
    console.error("revision state save error", err);
  });
}

// Build the ordered queue of observation ids still needing review today:
// non-archived, not yet reviewed today, ordered by date (newest day first)
// then priority (high -> low) then newest-created-first within that.
function buildRevisionQueue() {
  const candidates = observations.filter((o) => {
    if (o.archived) return false;
    if (revisionReviewedIds.includes(o.id)) return false;
    // Starred-only mode
    if (revisionStarredOnly && !o.starred) return false;
    // Folder filter
    if (revisionFolderFilter !== "all") {
      const obsFolders = [o.folder, ...Object.keys(o.folderPriorities || {})].filter(Boolean);
      if (!obsFolders.includes(revisionFolderFilter)) return false;
    }
    return true;
  });

  const sorted = [...candidates].sort((a, b) => {
    // Flagged ("needs attention") items sort to the back, so other cards are
    // seen first before circling back to ones already flagged this session.
    const aFlagged = revisionFlaggedIds.includes(a.id);
    const bFlagged = revisionFlaggedIds.includes(b.id);
    if (aFlagged !== bFlagged) return aFlagged ? 1 : -1;

    const da = getDateKey(a.createdAt);
    const db_ = getDateKey(b.createdAt);
    if (da !== db_) return da < db_ ? 1 : -1; // newest date first
    const pa = PRIORITY_ORDER[getDisplayPriority(a)] ?? 1;
    const pb = PRIORITY_ORDER[getDisplayPriority(b)] ?? 1;
    if (pa !== pb) return pa - pb; // high priority first
    return getCreatedTime(b) - getCreatedTime(a);
  });

  revisionQueue = sorted.map((o) => o.id);
}

function getRevisionTotalCount() {
  return observations.filter((o) => {
    if (o.archived) return false;
    if (revisionStarredOnly && !o.starred) return false;
    if (revisionFolderFilter === "all") return true;
    const obsFolders = [o.folder, ...Object.keys(o.folderPriorities || {})].filter(Boolean);
    return obsFolders.includes(revisionFolderFilter);
  }).length;
}

async function renderRevisionStage() {
  revisionStage.innerHTML = "";

  if (!revisionStateLoaded) {
    await loadRevisionState();
  }

  buildRevisionQueue();
  updateRevisionProgress();

  if (revisionQueue.length === 0) {
    revisionEmptyState.classList.remove("hidden");
    revisionStage.classList.add("hidden");
    const total = getRevisionTotalCount();
    if (total === 0) {
      revisionEmptyText.textContent = "No observations to review yet.";
    } else {
      revisionEmptyText.textContent = "All caught up for today.";
    }
    return;
  }

  revisionEmptyState.classList.add("hidden");
  revisionStage.classList.remove("hidden");

  // Render up to 2 cards (top + peek of next) for a stacked look
  const idsToRender = revisionQueue.slice(0, 2);
  // Render in reverse so the first id ends up on top (last child = topmost via z-index)
  idsToRender.slice().reverse().forEach((id, i) => {
    const obs = observations.find((o) => o.id === id);
    if (!obs) return;
    const isTop = (id === idsToRender[0]);
    const card = buildRevisionCard(obs, isTop);
    revisionStage.appendChild(card);
  });
}

function updateRevisionProgress() {
  const total = getRevisionTotalCount();
  const remaining = revisionQueue.length;
  const done = total - remaining;
  revisionProgressText.textContent = `${done} / ${total}`;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  revisionProgressFill.style.width = pct + "%";
}

// Toggles the `starred` flag on an observation, persisting to Firestore.
// Also mutates the in-memory observation so the card updates without waiting
// for the next Firestore snapshot.
async function toggleObsStar(o) {
  const newVal = !o.starred;
  try {
    await db.collection("users").doc(currentUser.uid)
      .collection("observations").doc(o.id)
      .update({ starred: newVal });
    // Mutate in-memory so UI reflects change immediately
    const obs = observations.find((x) => x.id === o.id);
    if (obs) obs.starred = newVal;
    // Refresh the card's star button without re-building the whole stage
    const card = revisionStage.querySelector(`[data-obs-id="${o.id}"]`);
    if (card) {
      const btn = card.querySelector(".revision-card-star");
      if (btn) {
        btn.textContent = newVal ? "★" : "☆";
        btn.classList.toggle("starred", newVal);
        btn.title = newVal ? "Unstar" : "Star";
      }
    }
    showToast(newVal ? "⭐ Starred — will always appear in starred revision deck" : "☆ Unstarred");
    // Refresh the revision queue so progress count updates immediately,
    // especially relevant in starred-only mode where an unstar removes the card.
    if (activeView === "revision") {
      setTimeout(() => renderRevisionStage(), 300);
    }
  } catch (err) {
    console.error("toggleObsStar error:", err);
    showToast("Could not update star: " + err.message);
  }
}

function buildRevisionCard(o, isTop) {
  const card = document.createElement("div");
  card.className = `revision-card priority-${getDisplayPriority(o)}`;
  card.dataset.obsId = o.id;
  if (!isTop) {
    card.style.transform = "scale(0.97) translateY(8px)";
    card.style.opacity = "0.6";
    card.style.zIndex = "1";
    card.style.pointerEvents = "none";
  } else {
    card.classList.add("revision-card-top");
    card.style.zIndex = "2";
  }

  const obsImages = (o.images && o.images.length > 0) ? o.images : (o.imageBase64 ? [o.imageBase64] : []);
  const hasImage = obsImages.length > 0;
  const hasLink = (o.links && o.links.length > 0) || !!o.link;
  if (!hasImage && !hasLink) card.classList.add("text-only");

  // Star button — top-right of card. Tap to star/unstar this observation.
  // Starred observations can be filtered to in the revision header toggle.
  const starBtn = document.createElement("button");
  starBtn.className = "revision-card-star" + (o.starred ? " starred" : "");
  starBtn.textContent = o.starred ? "★" : "☆";
  starBtn.title = o.starred ? "Unstar (remove from starred revision deck)" : "Star (keep in starred revision deck)";
  starBtn.setAttribute("aria-label", o.starred ? "Unstar" : "Star");
  starBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleObsStar(o);
  });
  card.appendChild(starBtn);

  // Meta row: date + folders
  const meta = document.createElement("div");
  meta.className = "revision-card-meta";
  const dateSpan = document.createElement("span");
  dateSpan.textContent = formatDateHeader(getDateKey(o.createdAt)) + " · " + formatTime(o.createdAt);
  meta.appendChild(dateSpan);

  const obsFolders = getObsFolders(o);
  if (obsFolders.length > 0) {
    const folderSpan = document.createElement("span");
    folderSpan.className = "revision-card-folders";
    folderSpan.textContent = obsFolders.join(", ");
    meta.appendChild(folderSpan);
  }

  if (revisionFlaggedIds.includes(o.id)) {
    const flagSpan = document.createElement("span");
    flagSpan.className = "revision-card-flagged-badge";
    flagSpan.textContent = "⚑ Flagged earlier";
    meta.appendChild(flagSpan);
  }
  card.appendChild(meta);

  // Image(s) + links share a gallery so all image sources are navigable together.
  const sharedGallery = (hasImage || hasLink) ? [] : null;

  if (hasImage) {
    card.appendChild(buildImageGrid(obsImages, sharedGallery));
  }

  // Text
  if (o.text) {
    const textEl = document.createElement("div");
    textEl.className = "revision-card-text";
    textEl.textContent = o.text;
    card.appendChild(textEl);
  } else {
    const textEl = document.createElement("div");
    textEl.className = "revision-card-text";
    textEl.textContent = "(no text)";
    textEl.style.color = "var(--text-dim)";
    card.appendChild(textEl);
  }

  // Link(s)
  if (hasLink) {
    card.appendChild(buildLinksSection(o, "revision-card-link", sharedGallery));
  }

  // Tags
  if ((o.tags || []).length > 0) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "revision-card-tags";
    (o.tags || []).forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = "#" + t;
      tagsEl.appendChild(chip);
    });
    card.appendChild(tagsEl);
  }

  // Swipe hints
  const hintRight = document.createElement("div");
  hintRight.className = "revision-card-hint right";
  hintRight.textContent = "Reviewed";
  card.appendChild(hintRight);

  const hintLeft = document.createElement("div");
  hintLeft.className = "revision-card-hint left";
  hintLeft.textContent = "Attention";
  card.appendChild(hintLeft);

  if (isTop) {
    attachSwipeHandlers(card, o);
  }

  return card;
}

// ---- Swipe gesture handling (pointer events cover touch + mouse) ----
// Also supports long-press to edit the observation without leaving Revision mode.
function attachSwipeHandlers(card, obs) {
  const hintRight = card.querySelector(".revision-card-hint.right");
  const hintLeft = card.querySelector(".revision-card-hint.left");

  let startX = 0, startY = 0, currentX = 0, dragging = false, horizontalIntent = null;
  let longPressTimer = null;
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 10;

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onPointerDown(e) {
    // Links keep their normal click behavior — never start a drag from them.
    if (e.target.closest("a")) return;
    const startedOnImage = !!e.target.closest("img, .il-img-more");

    dragging = true;
    horizontalIntent = null;
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    longPressFired = false;
    card._pointerId = e.pointerId;
    card.classList.add("dragging");
    // Deliberately do NOT call setPointerCapture here. Capturing immediately
    // on press is what broke image clicks on desktop: it redirects the
    // eventual click event to `card` before the <img>'s own listener ever
    // sees it. Capture is instead acquired lazily in onPointerMove, only
    // once real horizontal drag movement is detected — by then a simple
    // click (press + release with no movement) has already safely reached
    // the image underneath.

    // A long-press that started on an image should still let a normal tap
    // open the lightbox rather than fight with the edit modal, so skip the
    // long-press-to-edit timer in that case.
    if (startedOnImage) return;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      // Only fire if the finger/pointer hasn't moved meaningfully (so it doesn't
      // trigger mid-swipe) and no horizontal swipe intent has been established.
      if (dragging && horizontalIntent !== true) {
        longPressFired = true;
        card.classList.remove("dragging");
        card.style.transform = "";
        if (hintRight) hintRight.style.opacity = 0;
        if (hintLeft) hintLeft.style.opacity = 0;
        if (navigator.vibrate) navigator.vibrate(15);
        openEditModal(obs);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Cancel the long-press timer once the pointer has moved beyond a small
    // tolerance — that movement means the user is swiping or scrolling, not holding.
    if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }

    // Decide gesture direction once enough movement has happened.
    // This stops vertical scrolling (long text/images) from being hijacked,
    // while still letting horizontal swipes work for the review action.
    if (horizontalIntent === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      horizontalIntent = Math.abs(dx) > Math.abs(dy);
    }
    if (horizontalIntent === false) return; // let the browser handle vertical scroll natively

    // Only now claim pointer capture — real drag movement has been confirmed,
    // so it's safe to take over without having broken a plain click first.
    if (horizontalIntent === true && card._pointerId !== undefined) {
      card.setPointerCapture && card.setPointerCapture(card._pointerId);
    }

    e.preventDefault();
    currentX = dx;
    const rotate = currentX / 18;
    card.style.transform = `translate(${currentX}px, ${dy * 0.1}px) rotate(${rotate}deg)`;

    const threshold = 60;
    if (currentX > threshold) {
      hintRight.style.opacity = Math.min(1, (currentX - threshold) / 60);
      hintLeft.style.opacity = 0;
    } else if (currentX < -threshold) {
      hintLeft.style.opacity = Math.min(1, (-currentX - threshold) / 60);
      hintRight.style.opacity = 0;
    } else {
      hintRight.style.opacity = 0;
      hintLeft.style.opacity = 0;
    }
  }

  function onPointerUp() {
    clearLongPressTimer();
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");

    if (longPressFired) { horizontalIntent = null; return; } // edit modal already opened
    if (horizontalIntent === false) { horizontalIntent = null; return; }

    const SWIPE_THRESHOLD = 100;
    if (currentX > SWIPE_THRESHOLD) {
      completeSwipe(card, "right");
    } else if (currentX < -SWIPE_THRESHOLD) {
      completeSwipe(card, "left");
    } else {
      // snap back
      card.style.transform = "";
      hintRight.style.opacity = 0;
      hintLeft.style.opacity = 0;
    }
    horizontalIntent = null;
  }

  function onDocPointerMove(e) { if (dragging) onPointerMove(e); }
  function onDocPointerUp(e) {
    if (dragging) {
      onPointerUp(e);
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
    }
  }

  card.addEventListener("pointerdown", (e) => {
    onPointerDown(e);
    // Safety net: once setPointerCapture redirects events to `card`, some
    // browsers handle a capture that started on a replaced element (like an
    // <img>) inconsistently. Listening on the document too, gated by the
    // same `dragging` flag, guarantees move/up are still processed even if
    // the card-level listener misses an event due to a capture quirk.
    // Removed again on pointerup so listeners never stack across re-renders.
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);
  });
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerUp);
}

// direction: "right" = reviewed, "left" = needs attention
async function completeSwipe(card, direction) {
  const obsId = card.dataset.obsId;
  card.classList.add(direction === "right" ? "swipe-right" : "swipe-left");

  if (direction === "right") {
    // Reviewed — clear any "needs attention" flag too, since it's been handled now.
    if (!revisionReviewedIds.includes(obsId)) revisionReviewedIds.push(obsId);
    revisionFlaggedIds = revisionFlaggedIds.filter((id) => id !== obsId);
  } else {
    // Needs attention — do NOT mark as reviewed, so it keeps reappearing in the
    // queue (at the back, see buildRevisionQueue) until it's swiped right.
    if (!revisionFlaggedIds.includes(obsId)) revisionFlaggedIds.push(obsId);
  }

  await saveRevisionState();

  setTimeout(() => {
    if (activeView === "revision") renderRevisionStage();
  }, 300);
}

revisionResetBtn.addEventListener("click", async () => {
  if (!confirm("Reset today's review progress? All observations will reappear in the revision queue.")) return;
  revisionReviewedIds = [];
  revisionFlaggedIds = [];
  await saveRevisionState();
  showToast("Revision progress reset");
  renderRevisionStage();
});

// ===================== AI Coach tab =====================
// Calls Gemini API directly from the browser — no Cloud Functions needed.
// The API key is stored once in Firestore under users/{uid}/settings/apiKeys
// so it never appears in source code. It's protected by your Firestore login rules.
// Using Groq (free forever, no credit card) — get key at console.groq.com
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // best free model on Groq for analysis

const COACH_SYSTEM_INSTRUCTION = `You are my personal trading knowledge architect.

Your job is NOT to evaluate me as a trader.
Your job is to maintain my evolving trading intelligence system.

I am building a personal trading playbook over months and years.

When I provide new observations:

1. Study my previous trading knowledge.
2. Study the new observations.
3. Identify what is genuinely new.
4. Remove only exact repetition, NOT useful details.
5. Expand concepts where my understanding has improved.
6. Preserve examples, market situations, and reasoning.
7. Maintain the history and evolution of my thinking.

IMPORTANT:
Do not create a short summary.
Do not compress important learning into one sentence.
The output should be detailed enough that I can revise it before trading.

Write from my perspective ("I understand...", "I have learned...").


Structure the output:

# 1. New Learning Added
For every new discovery:
- Explain the observation
- Explain why it matters
- Explain the market psychology behind it
- Explain how I should use this knowledge

# 2. Existing Knowledge Updated
Show:
- Previous belief
- New understanding
- How my thinking has evolved

# 3. Trading Principles Library

Maintain detailed sections:

## Market Structure Understanding
(Keep detailed explanations)

## Liquidity and Price Behaviour
(Keep examples and reasoning)

## Setup Recognition
(Entry conditions, confirmation, failures)

## Trade Management Rules
(Stop loss, exits, position sizing)

## Psychology and Execution
(Emotional patterns and solutions)

## Mistakes I Must Avoid

# 4. Contradictions Found
If my new observation conflicts with old beliefs:
- Explain the conflict
- Suggest the refined understanding

# 5. My Current Trading Philosophy
Write a detailed evolving version, not a short summary.

The goal is not fewer words.
The goal is fewer repeated ideas with maximum retained knowledge.`;

let coachPeriod = "weekly";
let aiSummaries = [];
let coachUnsubscribe = null;
let cachedGeminiKey = null; // in-memory cache so we don't re-fetch every time

const coachGenerateBtn = document.getElementById("coach-generate-btn");
const coachGenerating = document.getElementById("coach-generating");
const coachEmpty = document.getElementById("coach-empty");
const coachFeed = document.getElementById("coach-feed");

// ---- API key storage in Firestore ----
async function loadGeminiKey() {
  if (cachedGeminiKey) return cachedGeminiKey;
  try {
    const doc = await db.collection("users").doc(currentUser.uid)
      .collection("settings").doc("apiKeys").get();
    if (doc.exists && doc.data().geminiKey) {
      cachedGeminiKey = doc.data().geminiKey;
      return cachedGeminiKey;
    }
  } catch (e) { console.error("loadGeminiKey", e); }
  return null;
}

async function saveGeminiKey(key) {
  await db.collection("users").doc(currentUser.uid)
    .collection("settings").doc("apiKeys")
    .set({ geminiKey: key }, { merge: true });
  cachedGeminiKey = key;
}

let cachedGoogleApiKey = null;

async function loadGoogleApiKey() {
  if (cachedGoogleApiKey) return cachedGoogleApiKey;
  try {
    const doc = await db.collection("users").doc(currentUser.uid)
      .collection("settings").doc("apiKeys").get();
    if (doc.exists && doc.data().googleApiKey) {
      cachedGoogleApiKey = doc.data().googleApiKey;
      return cachedGoogleApiKey;
    }
  } catch (e) { console.error("loadGoogleApiKey", e); }
  return null;
}

async function saveGoogleApiKey(key) {
  await db.collection("users").doc(currentUser.uid)
    .collection("settings").doc("apiKeys")
    .set({ googleApiKey: key }, { merge: true });
  cachedGoogleApiKey = key;
}

// ---- Period toggle ----
document.querySelector(".coach-controls").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn[data-coach-period]");
  if (!btn) return;
  coachPeriod = btn.dataset.coachPeriod;
  document.querySelectorAll(".seg-btn[data-coach-period]").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderAiCoachFeed();
});

// ---- Generate now button ----
coachGenerateBtn.addEventListener("click", async () => {
  if (!currentUser) return;

  // Check for API key first
  let apiKey = await loadGeminiKey();
  if (!apiKey) {
    apiKey = prompt("Enter your Gemini API key (from aistudio.google.com/apikey).\nIt will be saved securely to your account.");
    if (!apiKey || !apiKey.trim()) return;
    await saveGeminiKey(apiKey.trim());
    apiKey = apiKey.trim();
  }

  setCoachGenerating(true);
  try {
    const result = await generateCoachSummaryClient(apiKey, coachPeriod);
    if (result.skipped) {
      showToast("Nothing to summarise: " + result.reason);
    } else {
      showToast("AI Coach summary generated ✦");
      // Firestore listener auto-refreshes the feed
    }
  } catch (err) {
    console.error("coach generate error:", err);
    // If it looks like an auth error, clear cached key so user can re-enter
    if (err.message && (err.message.includes("Invalid API Key") || err.message.includes("401") || err.message.includes("403") || err.message.includes("api_key"))) {
      cachedGeminiKey = null;
      showToast("Invalid Groq key — go to Settings to update it");
    } else {
      showToast("Error: " + (err.message || "Could not generate summary"));
    }
  } finally {
    setCoachGenerating(false);
  }
});

function setCoachGenerating(on) {
  coachGenerateBtn.disabled = on;
  coachGenerateBtn.textContent = on ? "Generating…" : "✦ Generate now";
  coachGenerating.classList.toggle("hidden", !on);
  if (on) {
    coachFeed.classList.add("hidden");
    coachEmpty.classList.add("hidden");
  } else {
    coachFeed.classList.remove("hidden");
  }
}

// ---- Core: build journal text → call Gemini → save to Firestore ----
async function generateCoachSummaryClient(apiKey, periodType) {
  const now = new Date();
  const endDate = new Date(now);
  const startDate = new Date(now);
  if (periodType === "weekly") {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Filter observations in range, non-archived, with text content
  const inRange = observations.filter((o) => {
    if (o.archived) return false;
    const hasAnyLink = (o.links && o.links.length > 0) || !!o.link;
    if (!o.text && !hasAnyLink) return false;
    const ts = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
    if (!ts) return false;
    return ts >= startDate && ts <= endDate;
  });

  // Sort oldest first for the AI to read chronologically
  inRange.sort((a, b) => getCreatedTime(a) - getCreatedTime(b));

  if (inRange.length === 0) {
    return { skipped: true, reason: `No observations in the past ${periodType === "weekly" ? "7 days" : "30 days"}` };
  }

  const lines = inRange.map((o) => {
    const date = getDateKey(o.createdAt);
    const folder = o.folder || "Uncategorized";
    const priority = o.priority || "medium";
    const tags = (o.tags || []).join(", ");
    let entry = `[${date}] (${folder}, priority: ${priority}${tags ? ", tags: " + tags : ""})\n${o.text || ""}`;
    const obsLinks = (o.links && o.links.length > 0) ? o.links : (o.link ? [o.link] : []);
    if (obsLinks.length > 0) entry += `\nLink${obsLinks.length > 1 ? "s" : ""}: ${obsLinks.join(", ")}`;
    return entry;
  });

  const periodLabel = periodType === "weekly" ? "past 7 days" : "past 30 days";

  // The new prompt explicitly builds on prior knowledge ("study my previous
  // trading knowledge", "Existing Knowledge Updated" section) — so feed in
  // the most recent summary of the same period type as context, if one exists.
  const priorSummary = aiSummaries
    .filter((s) => s.type === periodType)
    .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))[0];

  let prompt = "";
  if (priorSummary && priorSummary.content) {
    prompt += `Here is my existing trading knowledge document from the previous ${periodType === "weekly" ? "week" : "month"}:\n\n${priorSummary.content}\n\n---\n\n`;
  } else {
    prompt += `This is my first entry — I don't have an existing knowledge document yet, so build the initial version.\n\n---\n\n`;
  }
  prompt += `Here are my new trading journal entries from the ${periodLabel} (${startDate.toISOString().slice(0,10)} to ${endDate.toISOString().slice(0,10)}, ${lines.length} entries):\n\n${lines.join("\n---\n")}`;

  // Call Groq API (OpenAI-compatible format)
  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: COACH_SYSTEM_INSTRUCTION },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 6000, // the new knowledge-architect prompt asks for a detailed, growing document; bumped from 2048
  };

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const msg = errBody.error && errBody.error.message ? errBody.error.message : `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  const data = await resp.json();
  const summaryText = data.choices?.[0]?.message?.content;
  if (!summaryText) throw new Error("Empty response from Groq");

  // Save to Firestore
  await db.collection("users").doc(currentUser.uid).collection("aiSummaries").add({
    type: periodType,
    content: summaryText,
    entryCount: lines.length,
    periodStart: firebase.firestore.Timestamp.fromDate(startDate),
    periodEnd: firebase.firestore.Timestamp.fromDate(endDate),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return { skipped: false, entryCount: lines.length };
}

// ---- Subscribe to saved summaries (real-time) ----
function subscribeAiSummaries() {
  if (coachUnsubscribe) coachUnsubscribe();
  if (!currentUser) return;
  const ref = db.collection("users").doc(currentUser.uid).collection("aiSummaries")
    .orderBy("createdAt", "desc").limit(20);
  coachUnsubscribe = ref.onSnapshot((snap) => {
    aiSummaries = [];
    snap.forEach((doc) => aiSummaries.push({ id: doc.id, ...doc.data() }));
    if (activeView === "aicoach") renderAiCoachFeed();
  }, (err) => console.error("aiSummaries subscription error:", err));
}

function renderAiCoachFeed() {
  if (!coachGenerating.classList.contains("hidden")) return;
  coachFeed.classList.remove("hidden");
  const filtered = aiSummaries.filter((s) => s.type === coachPeriod);
  if (filtered.length === 0) {
    coachFeed.innerHTML = "";
    coachEmpty.classList.remove("hidden");
    return;
  }
  coachEmpty.classList.add("hidden");
  coachFeed.innerHTML = "";
  filtered.forEach((s, i) => coachFeed.appendChild(buildCoachCard(s, i === 0)));
}

function buildCoachCard(s, startExpanded) {
  const card = document.createElement("div");
  card.className = "coach-summary-card" + (startExpanded ? " expanded" : "");

  const header = document.createElement("div");
  header.className = "coach-summary-header";
  header.addEventListener("click", () => card.classList.toggle("expanded"));

  const typeBadge = document.createElement("span");
  typeBadge.className = "coach-summary-type";
  typeBadge.textContent = s.type === "weekly" ? "Weekly" : "Monthly";
  header.appendChild(typeBadge);

  const dateEl = document.createElement("span");
  dateEl.className = "coach-summary-date";
  const startDate = s.periodStart && s.periodStart.toDate
    ? s.periodStart.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const endDate = s.periodEnd && s.periodEnd.toDate
    ? s.periodEnd.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const createdDate = s.createdAt && s.createdAt.toDate
    ? s.createdAt.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  dateEl.textContent = startDate && endDate ? `${startDate} – ${endDate}` : createdDate;
  header.appendChild(dateEl);

  const metaEl = document.createElement("span");
  metaEl.className = "coach-summary-meta";
  metaEl.textContent = s.entryCount ? `${s.entryCount} entries` : "";
  header.appendChild(metaEl);

  const chevron = document.createElement("span");
  chevron.className = "coach-summary-chevron";
  chevron.textContent = "▾";
  header.appendChild(chevron);

  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "coach-summary-body";
  body.innerHTML = simpleMarkdownToHtml(s.content || "");
  card.appendChild(body);

  return card;
}

// Lightweight markdown → safe HTML (covers typical Gemini output)
function simpleMarkdownToHtml(md) {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---+$/gm, "<hr>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>[\s\S]*?<\/li>)*/g, (m) => `<ul>${m}</ul>`);
  html = html.split(/\n{2,}/).map((block) => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[23]|ul|ol|hr|li)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}

// ===================== Settings: Gemini API key management =====================
const geminiKeyInput = document.getElementById("gemini-key-input");
const geminiKeyToggle = document.getElementById("gemini-key-toggle");
const geminiKeySaveBtn = document.getElementById("gemini-key-save-btn");
const geminiKeyStatus = document.getElementById("gemini-key-status");

// Show/hide key toggle
geminiKeyToggle.addEventListener("click", () => {
  const isHidden = geminiKeyInput.type === "password";
  geminiKeyInput.type = isHidden ? "text" : "password";
  geminiKeyToggle.textContent = isHidden ? "🙈" : "👁";
});

// Save key to Firestore
geminiKeySaveBtn.addEventListener("click", async () => {
  const key = geminiKeyInput.value.trim();
  if (!key) { showToast("Please enter your API key"); return; }
  geminiKeySaveBtn.disabled = true;
  geminiKeySaveBtn.textContent = "Saving…";
  try {
    await saveGeminiKey(key);
    geminiKeyStatus.textContent = "✓ Key saved";
    geminiKeyInput.value = "";
    geminiKeyInput.type = "password";
    geminiKeyToggle.textContent = "👁";
    showToast("Gemini API key saved ✦");
  } catch (err) {
    showToast("Could not save key: " + err.message);
  } finally {
    geminiKeySaveBtn.disabled = false;
    geminiKeySaveBtn.textContent = "Save key";
  }
});

// ===================== Settings: Google API key management =====================
const googleKeyInput = document.getElementById("google-key-input");
const googleKeyToggle = document.getElementById("google-key-toggle");
const googleKeySaveBtn = document.getElementById("google-key-save-btn");
const googleKeyStatus = document.getElementById("google-key-status");

// Show/hide key toggle
googleKeyToggle.addEventListener("click", () => {
  const isHidden = googleKeyInput.type === "password";
  googleKeyInput.type = isHidden ? "text" : "password";
  googleKeyToggle.textContent = isHidden ? "🙈" : "👁";
});

// Save key to Firestore
googleKeySaveBtn.addEventListener("click", async () => {
  const key = googleKeyInput.value.trim();
  if (!key) { showToast("Please enter your Google API key"); return; }
  googleKeySaveBtn.disabled = true;
  googleKeySaveBtn.textContent = "Saving…";
  try {
    await saveGoogleApiKey(key);
    googleKeyStatus.textContent = "✓ Key saved";
    googleKeyInput.value = "";
    googleKeyInput.type = "password";
    googleKeyToggle.textContent = "👁";
    showToast("Google API key saved ✦");
  } catch (err) {
    showToast("Could not save key: " + err.message);
  } finally {
    googleKeySaveBtn.disabled = false;
    googleKeySaveBtn.textContent = "Save key";
  }
});

// When Settings tab loads, show whether a key is already saved
async function loadSettingsKeyStatus() {
  const key = await loadGeminiKey();
  geminiKeyStatus.textContent = key ? "✓ API key is saved" : "No key saved yet";

  const gKey = await loadGoogleApiKey();
  googleKeyStatus.textContent = gKey ? "✓ API key is saved" : "No key saved yet";
}

// =====================================================================
// PRE-TRADE CHECKLIST MODULE
// =====================================================================
let checklists = {};      // { id: { name, items: [string] } }
let checklistLogs = [];   // array of all saved checklist run logs for this user
let clLogsUnsubscribe = null;

function subscribeChecklistLogs() {
  if (clLogsUnsubscribe) clLogsUnsubscribe();
  clLogsUnsubscribe = db.collection("users").doc(currentUser.uid)
    .collection("checklistLogs")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      checklistLogs = [];
      snap.forEach((doc) => checklistLogs.push({ id: doc.id, ...doc.data() }));
      // If the trade modal is open, refresh its linked-checklists panel.
      if (!tradeModal.classList.contains("hidden") && editingTradeId) {
        renderLinkedChecklists(editingTradeId);
      }
    }, (err) => console.error("checklistLogs subscription error:", err));
}
let activeChecklistId = null;
let checklistChecked = new Set(); // item indices checked in current run
let checklistLogImageBase64 = null;
let editingChecklistLogId = null; // set when editing a saved log; null when creating new

// Opens the checklist result modal pre-populated with a saved log for editing.
// The checklist items themselves can't be re-run from here (we don't have the
// interactive tick-list UI), but outcome, pre/post-trade analysis, and the
// chart image can all be changed and saved back to Firestore.
function openChecklistLogEditor(log) {
  editingChecklistLogId = log.id;
  activeChecklistId = log.checklistId || null;

  // Close the trade modal so the result modal sits on top cleanly
  tradeModal.classList.add("hidden");

  // Build a score summary header
  const pct = log.total > 0 ? Math.round((log.passed / log.total) * 100) : 0;
  const summary = clResultSummary;
  summary.innerHTML = "";

  const scoreEl = document.createElement("div");
  scoreEl.className = `cl-result-score-big ${pct === 100 ? "all-pass" : pct >= 70 ? "partial" : "low-pass"}`;
  scoreEl.textContent = `${log.passed} / ${log.total}`;
  summary.appendChild(scoreEl);

  const labelEl = document.createElement("div");
  labelEl.className = "cl-result-label";
  labelEl.textContent = `${log.checklistName || "Checklist"} — editing saved log`;
  summary.appendChild(labelEl);

  if ((log.failed || []).length > 0) {
    const failList = document.createElement("ul");
    failList.className = "cl-result-failures";
    (log.failed || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      failList.appendChild(li);
    });
    summary.appendChild(failList);
  }

  // Pre-fill editable fields
  clOutcome.value = log.outcome || "";
  clPreTrade.value = log.preTrade || "";
  clPostTrade.value = log.postTrade || "";

  // Chart image
  checklistLogImageBase64 = log.chartImage || null;
  if (checklistLogImageBase64) {
    clChartPreviewImg.src = checklistLogImageBase64;
    clChartPreview.classList.remove("hidden");
  } else {
    clChartPreview.classList.add("hidden");
    clChartImage.value = "";
  }

  // Trade link
  // Rebuild the dropdown so the correct trade is selected
  clLinkTrade.innerHTML = "<option value=''>— Not linked —</option>";
  trades.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.date + (t.comments ? ` — ${t.comments.slice(0, 30)}` : "");
    clLinkTrade.appendChild(opt);
  });
  clLinkTrade.value = log.linkedTradeId || "";

  // Change save button label to make mode clear
  clResultSave.textContent = "Update log";
  clResultDismiss.textContent = "Cancel";

  checklistResultModal.classList.remove("hidden");
}

// Refs — checklist run modal
const checklistFab        = document.getElementById("checklist-fab");
const checklistModal      = document.getElementById("checklist-modal");
const checklistModalClose = document.getElementById("checklist-modal-close");
const checklistPicker     = document.getElementById("checklist-picker");
const checklistItemsBody  = document.getElementById("checklist-items-body");
const checklistScoreFill  = document.getElementById("checklist-score-fill");
const checklistScoreText  = document.getElementById("checklist-score-text");
const checklistResetBtn   = document.getElementById("checklist-reset-btn");
const checklistLogBtn     = document.getElementById("checklist-log-btn");

// Refs — result / log modal
const checklistResultModal = document.getElementById("checklist-result-modal");
const clResultClose        = document.getElementById("cl-result-close");
const clResultSummary      = document.getElementById("cl-result-summary");
const clOutcome            = document.getElementById("cl-outcome");
const clPreTrade           = document.getElementById("cl-pre-trade");
const clPostTrade          = document.getElementById("cl-post-trade");
const clChartImage         = document.getElementById("cl-chart-image");
const clChartPreview       = document.getElementById("cl-chart-preview");
const clChartPreviewImg    = document.getElementById("cl-chart-preview-img");
const clChartRemove        = document.getElementById("cl-chart-remove");
const clLinkTrade          = document.getElementById("cl-link-trade");
const clResultDismiss      = document.getElementById("cl-result-dismiss");
const clResultSave         = document.getElementById("cl-result-save");

// Refs — settings management
const clManageSelect  = document.getElementById("cl-manage-select");
const clNewBtn        = document.getElementById("cl-new-btn");
const clDeleteClBtn   = document.getElementById("cl-delete-cl-btn");
const clNameRow       = document.getElementById("cl-name-row");
const clNameInput     = document.getElementById("cl-name-input");
const clNameSaveBtn   = document.getElementById("cl-name-save-btn");
const clItemsEditor   = document.getElementById("cl-items-editor");
const clNewItemInput  = document.getElementById("cl-new-item-input");
const clAddItemBtn    = document.getElementById("cl-add-item-btn");

// ---- Firestore: load/save checklists ----
const CHECKLIST_DEFAULT_ID = "default";

function checklistRef() {
  return db.collection("users").doc(currentUser.uid).collection("checklists");
}

async function loadChecklists() {
  try {
    const snap = await checklistRef().get();
    checklists = {};
    snap.forEach((doc) => { checklists[doc.id] = doc.data(); });
    // Ensure a "default" checklist exists
    if (!checklists[CHECKLIST_DEFAULT_ID]) {
      const def = {
        name: "Default",
        items: [
          "Market trend confirmed (H1/H4)",
          "Setup aligns with my strategy",
          "Risk/Reward at least 1:2",
          "Stop loss placed at key level",
          "Position size calculated",
          "No news event in next 30 min",
          "Entry price matches plan",
          "I am in the right mental state",
        ],
      };
      await checklistRef().doc(CHECKLIST_DEFAULT_ID).set(def);
      checklists[CHECKLIST_DEFAULT_ID] = def;
    }
    renderChecklistPicker();
    renderChecklistManageSelect();
  } catch (err) {
    console.error("loadChecklists error", err);
  }
}

async function saveChecklist(id, data) {
  await checklistRef().doc(id).set(data);
  checklists[id] = data;
}

async function deleteChecklist(id) {
  if (id === CHECKLIST_DEFAULT_ID) { showToast("Can't delete the default checklist"); return; }
  await checklistRef().doc(id).delete();
  delete checklists[id];
}

// ---- Checklist run modal ----
checklistFab.addEventListener("click", () => openChecklistModal());

function openChecklistModal() {
  renderChecklistPicker();
  const firstId = Object.keys(checklists)[0] || CHECKLIST_DEFAULT_ID;
  activeChecklistId = checklistPicker.value || firstId;
  checklistChecked = new Set();
  renderChecklistItems();
  checklistModal.classList.remove("hidden");
}

checklistModalClose.addEventListener("click", () => checklistModal.classList.add("hidden"));

checklistPicker.addEventListener("change", () => {
  activeChecklistId = checklistPicker.value;
  checklistChecked = new Set();
  renderChecklistItems();
});

function renderChecklistPicker() {
  const prev = checklistPicker.value;
  checklistPicker.innerHTML = "";
  Object.entries(checklists).forEach(([id, cl]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cl.name || id;
    checklistPicker.appendChild(opt);
  });
  if (prev && checklists[prev]) checklistPicker.value = prev;
}

function renderChecklistItems() {
  const cl = checklists[activeChecklistId];
  if (!cl) { checklistItemsBody.innerHTML = "<p style='color:var(--text-dim);padding:16px'>No items.</p>"; return; }
  checklistItemsBody.innerHTML = "";
  (cl.items || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "checklist-item-row" + (checklistChecked.has(i) ? " checked" : "");
    row.addEventListener("click", () => {
      if (checklistChecked.has(i)) checklistChecked.delete(i);
      else checklistChecked.add(i);
      row.classList.toggle("checked", checklistChecked.has(i));
      updateChecklistScore();
    });

    const circle = document.createElement("div");
    circle.className = "checklist-item-check";
    circle.textContent = checklistChecked.has(i) ? "✓" : "";

    const text = document.createElement("span");
    text.className = "checklist-item-text";
    text.textContent = item;

    row.appendChild(circle);
    row.appendChild(text);
    checklistItemsBody.appendChild(row);
  });
  updateChecklistScore();
}

function updateChecklistScore() {
  const cl = checklists[activeChecklistId];
  if (!cl) return;
  const total = (cl.items || []).length;
  const passed = checklistChecked.size;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  checklistScoreFill.style.width = pct + "%";
  checklistScoreText.textContent = `${passed} / ${total} passed`;
  // Colour the fill based on score
  checklistScoreFill.style.background =
    pct === 100 ? "var(--grad-green)"
    : pct >= 70 ? "linear-gradient(90deg, var(--medium), #F5AA60)"
    : "linear-gradient(90deg, var(--high), #F08060)";
}

checklistResetBtn.addEventListener("click", () => {
  checklistChecked = new Set();
  renderChecklistItems();
});

checklistLogBtn.addEventListener("click", () => {
  try {
    const cl = checklists[activeChecklistId];
    if (!cl) {
      showToast("No checklist selected");
      return;
    }
    const total = (cl.items || []).length;
    const passed = checklistChecked.size;
    const failed = (cl.items || []).filter((_, i) => !checklistChecked.has(i));
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

    // Build result summary
    clResultSummary.innerHTML = "";
    const scoreEl = document.createElement("div");
    scoreEl.className = `cl-result-score-big ${pct === 100 ? "all-pass" : pct >= 70 ? "partial" : "low-pass"}`;
    scoreEl.textContent = `${passed} / ${total}`;
    const labelEl = document.createElement("div");
    labelEl.className = "cl-result-label";
    labelEl.textContent = pct === 100 ? "All checks passed ✓" : `${pct}% passed — ${total - passed} item${total - passed !== 1 ? "s" : ""} not confirmed`;
    clResultSummary.appendChild(scoreEl);
    clResultSummary.appendChild(labelEl);

    if (failed.length > 0) {
      const failList = document.createElement("div");
      failList.className = "cl-failed-list";
      failed.forEach((item) => {
        const el = document.createElement("div");
        el.className = "cl-failed-item";
        el.textContent = item;
        failList.appendChild(el);
      });
      clResultSummary.appendChild(failList);
    }

    // Populate trade log link dropdown with today's / this month's trade entries.
    // Defensive: tolerate trades with missing/odd "date" fields without throwing.
    clLinkTrade.innerHTML = "<option value=''>— Not linked —</option>";
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = todayStr.slice(0, 7);
    (trades || []).forEach((t) => {
      const tDate = typeof t.date === "string" ? t.date : "";
      if (tDate === todayStr || tDate.startsWith(monthStr)) {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${tDate || "Undated"} — ${t.numTrades || 0} trades (Net: ${formatNum(t.netPL)})`;
        clLinkTrade.appendChild(opt);
      }
    });

    // Reset log fields
    clOutcome.value = "";
    clPreTrade.value = "";
    clPostTrade.value = "";
    clChartPreview.classList.add("hidden");
    checklistLogImageBase64 = null;
    clChartImage.value = "";

    checklistModal.classList.add("hidden");
    checklistResultModal.classList.remove("hidden");
  } catch (err) {
    console.error("checklistLogBtn handler error:", err);
    showToast("Could not open log screen: " + err.message);
  }
});

// Chart image for log
function applyChartImageFile(file) {
  resizeImageToBase64(file, 1024, 0.75).then((b) => {
    checklistLogImageBase64 = b;
    clChartPreviewImg.src = b;
    clChartPreview.classList.remove("hidden");
  });
}

clChartImage.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  applyChartImageFile(file);
});

// Paste a chart screenshot directly (Ctrl+V) anywhere in the result modal.
attachImagePaste(checklistResultModal, (file) => {
  applyChartImageFile(file);
  showToast("Chart image pasted from clipboard");
});

clChartRemove.addEventListener("click", () => {
  checklistLogImageBase64 = null;
  clChartImage.value = "";
  clChartPreview.classList.add("hidden");
});

clResultClose.addEventListener("click", () => {
  const wasEditing = !!editingChecklistLogId;
  checklistResultModal.classList.add("hidden");
  editingChecklistLogId = null;
  clResultSave.textContent = "Save log";
  clResultDismiss.textContent = "Dismiss";
  if (!wasEditing) checklistModal.classList.remove("hidden"); // go back to checklist when not editing
});

clResultDismiss.addEventListener("click", () => {
  const wasEditing = !!editingChecklistLogId;
  checklistResultModal.classList.add("hidden");
  editingChecklistLogId = null;
  clResultSave.textContent = "Save log";
  clResultDismiss.textContent = "Dismiss";
  if (!wasEditing) showToast("Checklist run dismissed (not logged)");
});

clResultSave.addEventListener("click", async () => {
  clResultSave.disabled = true;
  clResultSave.textContent = editingChecklistLogId ? "Updating…" : "Saving…";
  try {
    const updateData = {
      outcome:    clOutcome.value || null,
      preTrade:   clPreTrade.value.trim() || null,
      postTrade:  clPostTrade.value.trim() || null,
      chartImage: checklistLogImageBase64 || null,
      linkedTradeId: clLinkTrade.value || null,
    };

    if (editingChecklistLogId) {
      // Edit mode — update existing doc (don't overwrite score/items fields)
      await db.collection("users").doc(currentUser.uid)
        .collection("checklistLogs").doc(editingChecklistLogId)
        .update(updateData);
      showToast("Checklist log updated ✓");
    } else {
      // Create mode — full new log from current checklist run
      const cl = checklists[activeChecklistId];
      const total = (cl?.items || []).length;
      const passed = checklistChecked.size;
      const logData = {
        type: "checklistRun",
        checklistId: activeChecklistId,
        checklistName: cl?.name || "Default",
        total,
        passed,
        failed: (cl?.items || []).filter((_, i) => !checklistChecked.has(i)),
        ...updateData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(currentUser.uid).collection("checklistLogs").add(logData);
      showToast("Checklist run logged ✓");
    }

    checklistResultModal.classList.add("hidden");
    editingChecklistLogId = null;
    clResultSave.textContent = "Save log";
    clResultDismiss.textContent = "Dismiss";
  } catch (err) {
    console.error(err);
    showToast("Could not save log: " + err.message);
  } finally {
    clResultSave.disabled = false;
    clResultSave.textContent = editingChecklistLogId ? "Update log" : "Save log";
  }
});

// ---- Checklist management in Settings ----
function renderChecklistManageSelect() {
  const prev = clManageSelect.value;
  clManageSelect.innerHTML = "";
  Object.entries(checklists).forEach(([id, cl]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cl.name || id;
    clManageSelect.appendChild(opt);
  });
  if (prev && checklists[prev]) clManageSelect.value = prev;
  renderChecklistItemsEditor();
}

clManageSelect.addEventListener("change", () => renderChecklistItemsEditor());

function renderChecklistItemsEditor() {
  const id = clManageSelect.value;
  const cl = checklists[id];
  clItemsEditor.innerHTML = "";
  if (!cl) return;
  (cl.items || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "cl-setting-item";

    const drag = document.createElement("span");
    drag.className = "cl-setting-drag-handle";
    drag.textContent = "⠿";

    const text = document.createElement("span");
    text.className = "cl-setting-item-text";
    text.textContent = item;

    const del = document.createElement("button");
    del.className = "cl-setting-delete";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      const updated = { ...cl, items: cl.items.filter((_, j) => j !== i) };
      await saveChecklist(id, updated);
      renderChecklistManageSelect();
      renderChecklistPicker();
    });

    row.appendChild(drag);
    row.appendChild(text);
    row.appendChild(del);
    clItemsEditor.appendChild(row);
  });
}

clNewBtn.addEventListener("click", () => {
  clNameRow.classList.toggle("hidden");
  clNameInput.value = "";
  if (!clNameRow.classList.contains("hidden")) clNameInput.focus();
});

clNameSaveBtn.addEventListener("click", async () => {
  const name = clNameInput.value.trim();
  if (!name) { showToast("Enter a name"); return; }
  const id = "cl_" + Date.now();
  await saveChecklist(id, { name, items: [] });
  clManageSelect.value = id;
  clNameRow.classList.add("hidden");
  clNameInput.value = "";
  renderChecklistManageSelect();
  renderChecklistPicker();
  showToast(`"${name}" created`);
});

clDeleteClBtn.addEventListener("click", async () => {
  const id = clManageSelect.value;
  if (!id || !checklists[id]) return;
  if (!confirm(`Delete checklist "${checklists[id].name}"? This cannot be undone.`)) return;
  try {
    await deleteChecklist(id);
    renderChecklistManageSelect();
    renderChecklistPicker();
    showToast("Checklist deleted");
  } catch (err) {
    showToast("Could not delete: " + err.message);
  }
});

clAddItemBtn.addEventListener("click", async () => {
  const text = clNewItemInput.value.trim();
  if (!text) return;
  const id = clManageSelect.value;
  const cl = checklists[id];
  if (!cl) return;
  const updated = { ...cl, items: [...(cl.items || []), text] };
  await saveChecklist(id, updated);
  clNewItemInput.value = "";
  renderChecklistItemsEditor();
  renderChecklistPicker();
  showToast("Item added");
});

clNewItemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") clAddItemBtn.click();
});

// =====================================================================
// EXPORT MODULE (CSV / PDF)
// =====================================================================
const exportOpenBtn       = document.getElementById("export-open-btn");
const exportModal         = document.getElementById("export-modal");
const exportModalClose    = document.getElementById("export-modal-close");
const exportFormatSelect  = document.getElementById("export-format-select");
const exportFormatHint    = document.getElementById("export-format-hint");
const exportRangeSelect   = document.getElementById("export-range-select");
const exportCustomRow     = document.getElementById("export-custom-range-row");
const exportStartDate     = document.getElementById("export-start-date");
const exportEndDate       = document.getElementById("export-end-date");
const exportIncludeObs    = document.getElementById("export-include-obs");
const exportIncludeTrades = document.getElementById("export-include-trades");
const exportPreviewCount  = document.getElementById("export-preview-count");
const exportCancelBtn     = document.getElementById("export-cancel-btn");
const exportConfirmBtn    = document.getElementById("export-confirm-btn");

exportOpenBtn.addEventListener("click", () => {
  exportFormatSelect.value = "csv";
  exportRangeSelect.value = "all";
  exportCustomRow.classList.add("hidden");
  exportIncludeObs.checked = true;
  exportIncludeTrades.checked = true;
  updateExportHintAndPreview();
  exportModal.classList.remove("hidden");
});

exportModalClose.addEventListener("click", () => exportModal.classList.add("hidden"));
exportCancelBtn.addEventListener("click", () => exportModal.classList.add("hidden"));

exportFormatSelect.addEventListener("change", updateExportHintAndPreview);
exportRangeSelect.addEventListener("change", () => {
  exportCustomRow.classList.toggle("hidden", exportRangeSelect.value !== "custom");
  updateExportHintAndPreview();
});
exportStartDate.addEventListener("change", updateExportHintAndPreview);
exportEndDate.addEventListener("change", updateExportHintAndPreview);
exportIncludeObs.addEventListener("change", updateExportHintAndPreview);
exportIncludeTrades.addEventListener("change", updateExportHintAndPreview);

function getExportDateRange() {
  const mode = exportRangeSelect.value;
  const now = new Date();
  let start = null, end = null;

  if (mode === "all") {
    return { start: null, end: null };
  } else if (mode === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  } else if (mode === "week") {
    start = new Date(now);
    const day = start.getDay();
    const diffToMonday = (day === 0) ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = now;
  } else if (mode === "custom") {
    if (exportStartDate.value) start = new Date(exportStartDate.value + "T00:00:00");
    if (exportEndDate.value) end = new Date(exportEndDate.value + "T23:59:59");
  }
  return { start, end };
}

function filterObsByRange(start, end) {
  return observations.filter((o) => {
    if (!o.createdAt || !o.createdAt.toDate) return false;
    const d = o.createdAt.toDate();
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function filterTradesByRange(start, end) {
  return trades.filter((t) => {
    if (!t.date) return false;
    const d = new Date(t.date + "T12:00:00"); // noon avoids TZ edge issues for date-only strings
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function updateExportHintAndPreview() {
  const format = exportFormatSelect.value;
  if (format === "pdf") {
    exportFormatHint.textContent = "PDF includes images inline and opens your browser's print/save dialog.";
  } else if (format === "json") {
    exportFormatHint.textContent = "JSON is a complete backup — includes full image data, checklists, and checklist logs. Best for restoring or transferring your data, not for reading directly.";
  } else {
    exportFormatHint.textContent = "CSV is a spreadsheet file. Images aren't embedded — a \"Has Image\" column is included instead.";
  }

  const { start, end } = getExportDateRange();
  const obsCount = exportIncludeObs.checked ? filterObsByRange(start, end).length : 0;
  const tradeCount = exportIncludeTrades.checked ? filterTradesByRange(start, end).length : 0;
  exportPreviewCount.textContent = `Will export ${obsCount} observation${obsCount !== 1 ? "s" : ""} and ${tradeCount} trade log entr${tradeCount !== 1 ? "ies" : "y"}.`;
}

exportConfirmBtn.addEventListener("click", async () => {
  if (!exportIncludeObs.checked && !exportIncludeTrades.checked) {
    showToast("Select at least one data type to export");
    return;
  }
  if (exportRangeSelect.value === "custom" && !exportStartDate.value && !exportEndDate.value) {
    showToast("Pick at least a start or end date for the custom range");
    return;
  }

  const { start, end } = getExportDateRange();
  const obsData = exportIncludeObs.checked ? filterObsByRange(start, end) : [];
  const tradeData = exportIncludeTrades.checked ? filterTradesByRange(start, end) : [];

  if (obsData.length === 0 && tradeData.length === 0) {
    showToast("Nothing to export in this range");
    return;
  }

  const format = exportFormatSelect.value;
  if (format === "csv") {
    exportToCSV(obsData, tradeData);
    exportModal.classList.add("hidden");
  } else if (format === "pdf") {
    exportToPDF(obsData, tradeData);
    exportModal.classList.add("hidden");
  } else if (format === "json") {
    exportConfirmBtn.disabled = true;
    exportConfirmBtn.textContent = "Preparing…";
    try {
      await exportToJSON(obsData, tradeData, start, end);
      exportModal.classList.add("hidden");
    } catch (err) {
      console.error("JSON export error:", err);
      showToast("Export failed: " + err.message);
    } finally {
      exportConfirmBtn.disabled = false;
      exportConfirmBtn.textContent = "Export";
    }
  }
});

// ---- CSV export ----
function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvEscape).join(",") + "\r\n";
}

function exportToCSV(obsData, tradeData) {
  let csv = "";

  if (obsData.length > 0) {
    csv += csvRow(["=== OBSERVATIONS ==="]);
    csv += csvRow(["Date", "Time", "Text", "Links", "Tags", "Folder", "Priority", "Category", "Has Image", "Image Pending", "Archived"]);
    // Sort newest first for readability
    const sorted = [...obsData].sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
    sorted.forEach((o) => {
      const d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
      const obsLinks = (o.links && o.links.length > 0) ? o.links : (o.link ? [o.link] : []);
      const hasAnyImage = (o.images && o.images.length > 0) || !!o.imageBase64;
      csv += csvRow([
        d ? getLocalDateKey({ toDate: () => d }) : "",
        d ? d.toLocaleTimeString() : "",
        o.text || "",
        obsLinks.join(" | "),
        (o.tags || []).join("; "),
        o.folder || "",
        o.priority || "medium",
        o.category || "",
        hasAnyImage ? "Yes" : "No",
        o.imagePending ? "Yes" : "No",
        o.archived ? "Yes" : "No",
      ]);
    });
    csv += csvRow([]); // blank separator line
  }

  if (tradeData.length > 0) {
    csv += csvRow(["=== TRADE LOG ==="]);
    csv += csvRow(["Date", "Capital", "No. of Trades", "Gross P/L", "Net P/L", "Duration", "Comments"]);
    const sortedTrades = [...tradeData].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    sortedTrades.forEach((t) => {
      csv += csvRow([
        t.date || "",
        t.capital != null ? t.capital : "",
        t.numTrades != null ? t.numTrades : "",
        t.grossPL != null ? t.grossPL : "",
        t.netPL != null ? t.netPL : "",
        t.duration || "",
        t.comments || "",
      ]);
    });
  }

  // Prepend BOM so Excel correctly detects UTF-8 (important for ₹, emoji, etc.)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `trade-journal-export-${todayKey()}.csv`);
  recordBackupPerformed();
  showToast("CSV exported");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Converts a Firestore Timestamp (has .toDate()) to an ISO 8601 string for a
// portable, human-readable backup. Leaves other values untouched.
function timestampToIso(val) {
  if (val && typeof val.toDate === "function") {
    return val.toDate().toISOString();
  }
  return val;
}

// Deep-converts any Firestore Timestamp fields found in a plain object/array
// to ISO strings, so the result is safe to JSON.stringify and later restore
// from on any platform (not just Firestore).
function normalizeForJsonExport(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForJsonExport);
  }
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return timestampToIso(value);
  }
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = normalizeForJsonExport(value[k]); });
    return out;
  }
  return value;
}

// ---- JSON full-backup export ----
// Unlike CSV/PDF, this is meant for restoring or transferring data, not for
// reading — so it includes full image data (base64), checklist definitions,
// and checklist run logs in the chosen date range, not just observations/trades.
async function exportToJSON(obsData, tradeData, start, end) {
  let checklistLogs = [];
  try {
    const snap = await db.collection("users").doc(currentUser.uid).collection("checklistLogs").get();
    snap.forEach((doc) => {
      const data = doc.data();
      const d = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null;
      if (start && d && d < start) return;
      if (end && d && d > end) return;
      checklistLogs.push({ id: doc.id, ...data });
    });
  } catch (err) {
    console.warn("Could not fetch checklist logs for backup:", err);
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    exportType: "trade-journal-full-backup",
    schemaVersion: 1,
    dateRange: {
      start: start ? start.toISOString() : null,
      end: end ? end.toISOString() : null,
    },
    observations: normalizeForJsonExport(obsData),
    tradeLog: normalizeForJsonExport(tradeData),
    checklists: normalizeForJsonExport(checklists),
    checklistLogs: normalizeForJsonExport(checklistLogs),
    folders,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `trade-journal-backup-${todayKey()}.json`);
  recordBackupPerformed();
  showToast(`Backup saved — ${obsData.length} observations, ${tradeData.length} trades`);
}

// ---- PDF export (via browser print) ----
function exportToPDF(obsData, tradeData) {
  const sortedObs = [...obsData].sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
  const sortedTrades = [...tradeData].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Pop-up blocked — please allow pop-ups for this site to export PDF");
    return;
  }

  const priorityColor = { low: "#1E9E42", medium: "#C06010", high: "#CC2822" };

  let obsHtml = "";
  if (sortedObs.length > 0) {
    obsHtml += `<h1>Observations</h1>`;
    sortedObs.forEach((o) => {
      const d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
      const dateStr = d ? d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString() : "Undated";
      const pColor = priorityColor[o.priority || "medium"];
      const obsImages = (o.images && o.images.length > 0) ? o.images : (o.imageBase64 ? [o.imageBase64] : []);
      const obsLinks = (o.links && o.links.length > 0) ? o.links : (o.link ? [o.link] : []);
      obsHtml += `
        <div class="entry" style="border-left-color:${pColor}">
          <div class="entry-meta">
            <span class="entry-date">${escapeHtml(dateStr)}</span>
            <span class="entry-tags">${escapeHtml(o.folder || "")}${o.priority ? " · " + o.priority.toUpperCase() : ""}</span>
          </div>
          ${o.text ? `<p class="entry-text">${escapeHtml(o.text).replace(/\n/g, "<br>")}</p>` : ""}
          ${obsImages.map((src) => `<img class="entry-img" src="${src}" />`).join("")}
          ${obsLinks.map((url) => `<p class="entry-link">🔗 ${escapeHtml(url)}</p>`).join("")}
          ${(o.tags || []).length ? `<p class="entry-chips">${(o.tags || []).map((t) => `<span class="chip">#${escapeHtml(t)}</span>`).join(" ")}</p>` : ""}
        </div>`;
    });
  }

  let tradeHtml = "";
  if (sortedTrades.length > 0) {
    const totalNet = sortedTrades.reduce((s, t) => s + (Number(t.netPL) || 0), 0);
    const totalGross = sortedTrades.reduce((s, t) => s + (Number(t.grossPL) || 0), 0);
    const totalTrades = sortedTrades.reduce((s, t) => s + (Number(t.numTrades) || 0), 0);
    tradeHtml += `<h1>Trade Log</h1>`;
    tradeHtml += `
      <table class="trade-table">
        <thead>
          <tr><th>Date</th><th>Capital</th><th>Trades</th><th>Gross P/L</th><th>Net P/L</th><th>Duration</th><th>Comments</th></tr>
        </thead>
        <tbody>
          ${sortedTrades.map((t) => `
            <tr>
              <td>${escapeHtml(t.date || "")}</td>
              <td>${t.capital != null ? formatNum(t.capital) : ""}</td>
              <td>${t.numTrades != null ? t.numTrades : ""}</td>
              <td>${t.grossPL != null ? formatNum(t.grossPL) : ""}</td>
              <td class="${Number(t.netPL) >= 0 ? "pos" : "neg"}">${t.netPL != null ? formatNum(t.netPL) : ""}</td>
              <td>${escapeHtml(t.duration || "")}</td>
              <td>${escapeHtml(t.comments || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="trade-summary">Total trades: <b>${totalTrades}</b> &nbsp;|&nbsp; Total gross P/L: <b>${formatNum(totalGross)}</b> &nbsp;|&nbsp; Total net P/L: <b>${formatNum(totalNet)}</b></p>
    `;
  }

  const { start, end } = getExportDateRange();
  const rangeLabel = !start && !end ? "All time"
    : `${start ? start.toLocaleDateString() : "…"} – ${end ? end.toLocaleDateString() : "…"}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Trade Journal Export</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin: 32px 0 16px; }
  h1:first-child { margin-top: 0; }
  .export-header { margin-bottom: 24px; }
  .export-header .title { font-size: 24px; font-weight: 700; margin: 0; }
  .export-header .range { color: #666; font-size: 13px; margin: 4px 0 0; }
  .entry { border-left: 4px solid #999; padding: 10px 14px; margin-bottom: 14px; background: #fafafa; border-radius: 4px; page-break-inside: avoid; }
  .entry-meta { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 6px; font-family: monospace; }
  .entry-text { font-size: 14px; line-height: 1.5; margin: 0 0 8px; white-space: pre-wrap; }
  .entry-img { max-width: 100%; max-height: 320px; display: block; margin: 8px 0; border-radius: 4px; }
  .entry-link { font-size: 12px; color: #1a6fe8; margin: 4px 0; word-break: break-all; }
  .entry-chips { margin: 6px 0 0; }
  .chip { display: inline-block; font-size: 11px; font-family: monospace; color: #1a6fe8; background: #e8f0ff; border-radius: 4px; padding: 2px 7px; margin-right: 4px; }
  .trade-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
  .trade-table th, .trade-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  .trade-table th { background: #f0f0f0; font-weight: 700; }
  .pos { color: #1e9e42; font-weight: 600; }
  .neg { color: #cc2822; font-weight: 600; }
  .trade-summary { font-size: 13px; margin-top: 8px; }
  @media print {
    body { padding: 16px; }
    .entry { background: #fff; border: 1px solid #ccc; border-left-width: 4px; }
  }
</style>
</head>
<body>
  <div class="export-header">
    <p class="title">Trade Journal Export</p>
    <p class="range">${escapeHtml(rangeLabel)} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</p>
  </div>
  ${obsHtml}
  ${tradeHtml}
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();

  // Give images time to load (base64 is instant, but be safe) then trigger print dialog.
  // Guarded so we never call print() twice in browsers where both paths fire.
  let printTriggered = false;
  function triggerPrintOnce() {
    if (printTriggered) return;
    printTriggered = true;
    try { win.print(); } catch (e) { /* window may already be closed */ }
  }
  win.onload = () => setTimeout(triggerPrintOnce, 400);
  setTimeout(triggerPrintOnce, 800); // fallback in case onload doesn't fire after document.write

  recordBackupPerformed();
  showToast("Opening print dialog — choose \"Save as PDF\"");
}

// =====================================================================
// TAG NORMALIZATION (manual one-time cleanup)
// =====================================================================
const normalizeTagsBtn = document.getElementById("normalize-tags-btn");
const normalizeTagsStatus = document.getElementById("normalize-tags-status");

normalizeTagsBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!confirm("This will lowercase and de-duplicate tags across all your observations. Continue?")) return;

  normalizeTagsBtn.disabled = true;
  normalizeTagsBtn.textContent = "Normalizing…";
  normalizeTagsStatus.textContent = "";

  try {
    const col = db.collection("users").doc(currentUser.uid).collection("observations");
    let changedCount = 0;
    let tagsBefore = 0;
    let tagsAfter = 0;

    // Batch in chunks of 400 to stay safely under Firestore's 500-write batch limit.
    const toUpdate = [];
    observations.forEach((o) => {
      const original = o.tags || [];
      tagsBefore += original.length;
      // Lowercase + trim, then de-duplicate while preserving first-seen order.
      const seen = new Set();
      const normalized = [];
      original.forEach((t) => {
        const clean = String(t).trim().toLowerCase();
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          normalized.push(clean);
        }
      });
      tagsAfter += normalized.length;

      const isDifferent = normalized.length !== original.length
        || normalized.some((t, i) => t !== original[i]);
      if (isDifferent) {
        toUpdate.push({ id: o.id, tags: normalized });
      }
    });

    for (let i = 0; i < toUpdate.length; i += 400) {
      const chunk = toUpdate.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach(({ id, tags }) => {
        batch.update(col.doc(id), { tags });
      });
      await batch.commit();
      changedCount += chunk.length;
    }

    if (changedCount === 0) {
      normalizeTagsStatus.textContent = "✓ All tags are already normalized — nothing to change.";
    } else {
      const merged = tagsBefore - tagsAfter;
      normalizeTagsStatus.textContent = `✓ Updated ${changedCount} observation${changedCount !== 1 ? "s" : ""}.` +
        (merged > 0 ? ` Merged ${merged} duplicate tag${merged !== 1 ? "s" : ""}.` : "");
    }
    showToast("Tag cleanup complete");
  } catch (err) {
    console.error("normalize tags error", err);
    normalizeTagsStatus.textContent = "Could not normalize tags: " + err.message;
    showToast("Tag cleanup failed");
  } finally {
    normalizeTagsBtn.disabled = false;
    normalizeTagsBtn.textContent = "Normalize tags now";
  }
});

// ===================== Trade Log passcode lock =====================
var tradeLocked = true;
var tradePasscode = null;

const tradeLockOverlay = document.getElementById("trade-lock-overlay");
const tradeLockInput = document.getElementById("trade-lock-input");
const tradeLockError = document.getElementById("trade-lock-error");
const tradeLockUnlockBtn = document.getElementById("trade-lock-unlock-btn");
const tradeLockSub = document.getElementById("trade-lock-sub");
const tradeLockSetupHint = document.getElementById("trade-lock-setup-hint");

const tradePasscodeInput = document.getElementById("trade-passcode-input");
const tradePasscodeToggle = document.getElementById("trade-passcode-toggle");
const tradePasscodeStatus = document.getElementById("trade-passcode-status");
const tradePasscodeSaveBtn = document.getElementById("trade-passcode-save-btn");
const tradePasscodeRemoveBtn = document.getElementById("trade-passcode-remove-btn");

let tradePasscodeDocRef = null;

function loadTradePasscodeStatus() {
  if (!currentUser) return;
  const ref = db.collection("users").doc(currentUser.uid).collection("settings").doc("tradePasscode");
  tradePasscodeDocRef = ref;
  ref.get().then((doc) => {
    if (doc.exists && doc.data().passcode) {
      tradePasscode = doc.data().passcode;
      tradePasscodeStatus.textContent = "Passcode is set.";
      tradePasscodeStatus.style.color = "var(--low)";
    } else {
      tradePasscode = null;
      tradePasscodeStatus.textContent = "No passcode set.";
      tradePasscodeStatus.style.color = "var(--text-dim)";
    }
  }).catch((err) => {
    console.error("trade passcode load error", err);
  });
}

// Inactivity & visibility timers for auto-lock
var tradeInactivityTimer = null;
const TRADE_LOCK_TIMEOUT_MS = 5000; // 5 seconds

function resetTradeInactivityTimer() {
  if (tradeLocked || !tradePasscode) return;
  clearTimeout(tradeInactivityTimer);
  tradeInactivityTimer = setTimeout(() => {
    // Only lock if we're still on the trade log view
    if (activeView === "tradelog" && !tradeLocked && tradePasscode) {
      showTradeLock();
    }
  }, TRADE_LOCK_TIMEOUT_MS);
}

// Reset timer on any interaction within the trade log view
const tradeLogViewEl = document.getElementById("view-tradelog");
tradeLogViewEl.addEventListener("mousedown", resetTradeInactivityTimer);
tradeLogViewEl.addEventListener("keydown", resetTradeInactivityTimer);
tradeLogViewEl.addEventListener("touchstart", resetTradeInactivityTimer);
tradeLogViewEl.addEventListener("wheel", resetTradeInactivityTimer);

// Page visibility API: lock immediately when user switches browser tabs
document.addEventListener("visibilitychange", () => {
  if (document.hidden && activeView === "tradelog" && !tradeLocked && tradePasscode) {
    clearTimeout(tradeInactivityTimer);
    showTradeLock();
  }
});

// Window blur: lock immediately when user clicks outside the browser window
window.addEventListener("blur", () => {
  if (activeView === "tradelog" && !tradeLocked && tradePasscode) {
    clearTimeout(tradeInactivityTimer);
    showTradeLock();
  }
});

function showTradeLock() {
  if (!tradePasscode) {
    tradeLockOverlay.classList.add("hidden");
    return;
  }
  tradeLocked = true;
  clearTimeout(tradeInactivityTimer);
  tradeLockOverlay.classList.remove("hidden");
  tradeLockInput.value = "";
  tradeLockError.classList.add("hidden");
  tradeLockSetupHint.classList.add("hidden");
  tradeLockSub.textContent = "Enter your 4-digit passcode to access the trade log.";
  setTimeout(() => tradeLockInput.focus(), 100);
}

function hideTradeLock() {
  tradeLocked = false;
  tradeLockOverlay.classList.add("hidden");
  resetTradeInactivityTimer();
}

function attemptUnlock() {
  const code = tradeLockInput.value.trim();
  if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
    tradeLockError.textContent = "Enter a valid 4-digit passcode.";
    tradeLockError.classList.remove("hidden");
    return;
  }
  if (code === tradePasscode) {
    tradeLockError.classList.add("hidden");
    hideTradeLock();
    renderTradeTable();
  } else {
    tradeLockError.classList.remove("hidden");
    tradeLockInput.value = "";
    tradeLockInput.focus();
  }
}

tradeLockInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    attemptUnlock();
  }
});

tradeLockUnlockBtn.addEventListener("click", () => attemptUnlock());

const __origRenderTradeTable = renderTradeTable;
renderTradeTable = function() {
  if (tradeLocked && tradePasscode) return;
  __origRenderTradeTable.call(this);
};

document.querySelector('[data-view="tradelog"]').addEventListener("click", function() {
  setTimeout(() => {
    if (activeView === "tradelog") {
      showTradeLock();
      if (!tradeLocked) renderTradeTable();
    }
  }, 0);
});

tradePasscodeToggle.addEventListener("click", () => {
  const type = tradePasscodeInput.type === "password" ? "text" : "password";
  tradePasscodeInput.type = type;
  tradePasscodeToggle.textContent = type === "password" ? "\u{1F441}" : "\u{1F648}";
});

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
    const ref = tradePasscodeDocRef || db.collection("users").doc(currentUser.uid).collection("settings").doc("tradePasscode");
    await ref.set({ passcode: code });
    tradePasscode = code;
    tradePasscodeDocRef = ref;
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

tradePasscodeRemoveBtn.addEventListener("click", async () => {
  if (!tradePasscode) {
    showToast("No passcode is set.");
    return;
  }
  if (!confirm("Remove the trade log passcode?")) return;
  try {
    const ref = tradePasscodeDocRef || db.collection("users").doc(currentUser.uid).collection("settings").doc("tradePasscode");
    await ref.delete();
    tradePasscode = null;
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


