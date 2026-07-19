// ===================== app.js — Entry Point (ES Module) =====================
// This file is the single entry point loaded by index.html as type="module".
// It imports all sub-modules which register their own event listeners and
// side-effects when imported. Order matters where there are dependencies.

// 1. Firebase + offline persistence
import './js/firebase-init.js';

// 2. Global application state (also binds all keys to window for compat)
import './js/state.js';

// 3. Utilities (no side-effects except theme immediate-apply)
import './js/utils/toast.js';
import './js/utils/theme.js';
import './js/utils/date.js';
import './js/utils/image.js';
import './js/utils/export.js';

// 4. Services (Firestore data layer — no side-effects beyond module-level var init)
import './js/services/observations.js';
import './js/services/trades.js';
import './js/services/checklists.js';
import './js/services/ai.js';

import './js/utils/error-tracking.js';

// 5. UI modules — each registers its own DOM event listeners on load
import './js/ui/common.js';       // main tab nav, lightbox, fullscreen
import './js/ui/auth.js';         // Firebase auth state listener + login/signup
import './js/ui/settings.js';     // settings panel, passcode, backup reminder
import './js/ui/dashboard.js';    // observation feed, folder tabs, modal
import './js/ui/revision.js';     // revision mode card swipe UI
import './js/ui/aicoach.js';      // AI Coach feed + Groq key management
import './js/ui/tradelog.js';     // trade log table + modal
import './js/ui/checklists.js';   // pre-trade checklist modal + log editor
import './js/ui/candleChecklist.js'; // candle checklist tab UI module
import './js/ui/tvNotifications.js'; // TradingView notifications UI module

// 6. Sequential trigger system modules
import './js/services/sequenceRules.js';
import './js/ui/sequenceRules.js';
