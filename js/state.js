export const state = {
  currentUser: null,
  observations: [],
  folders: ["Behaviour", "Technical", "To Do"],
  activeFolder: "all",
  editingObsId: null,
  copyTargetObsId: null,
  activeView: "dashboard",
  groupMode: "date",
  defaultGroupMode: "date",
  expandedTileId: null,
  trades: [],
  editingTradeId: null,
  showArchived: false,
  imagePendingOnly: false,
  activeTagFilter: null,
  allTags: [],
  revisionQueue: [],
  revisionReviewedIds: [],
  revisionFlaggedIds: [],
  revisionFolderFilter: "all",
  revisionStarredOnly: false,
  revisionDragState: null,
  checklistLogs: [],
  cachedGeminiKey: null,
  cachedGoogleApiKey: null,
  tradePasscode: null,
  tradeLocked: true,
  tradeInactivityTimer: null,
  _tradePasscodeFailedAttempts: 0,
  _tradePasscodeLockedUntil: null,
  tradePasscodeDocRef: null,
  aiSummaries: [],
  coachPeriod: "weekly",
  candleChecklistTemplates: [],
  candleChecklistRuns: [],
  sequenceRules: [],
  sequenceTriggerLogs: [],
};

// Bind to window for backward compatibility with trade-security.js and legacy code
Object.keys(state).forEach(key => {
  Object.defineProperty(window, key, {
    get() {
      return state[key];
    },
    set(val) {
      state[key] = val;
    },
    configurable: true,
    enumerable: true
  });
});
