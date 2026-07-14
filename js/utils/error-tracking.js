// ===================== Global Error Surfacing =====================
// Catches errors that would otherwise only show up in the browser console
// (which you only see if you happen to have dev tools open). Surfaces them
// as a toast instead, so a broken feature is visible immediately rather
// than days later when it gets reported as "X doesn't work."
//
// Import this once from app.js, near the top, before other UI modules:
//   import './js/utils/error-tracking.js';

import { showToast } from './toast.js';

// Avoid spamming the same error over and over (e.g. a listener that fires
// repeatedly) — only toast a given error message once per short window.
const recentErrors = new Map();
const DEDUPE_WINDOW_MS = 8000;

function reportError(message, detail) {
  console.error("[Global error]", message, detail || "");

  const now = Date.now();
  const lastShown = recentErrors.get(message);
  if (lastShown && now - lastShown < DEDUPE_WINDOW_MS) return;
  recentErrors.set(message, now);

  // Keep the map from growing forever over a long session
  if (recentErrors.size > 50) {
    const oldestKey = recentErrors.keys().next().value;
    recentErrors.delete(oldestKey);
  }

  showToast("Something went wrong — check console for details");
}

window.addEventListener("error", (event) => {
  // Ignore benign cross-origin script errors (e.g. a blocked ad/analytics
  // script) which show up as message: "Script error." with no useful info.
  if (event.message === "Script error." && !event.filename) return;

  reportError(event.message, {
    source: event.filename,
    line: event.lineno,
    col: event.colno,
    error: event.error,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error ? reason.message : String(reason || "Unhandled promise rejection");
  reportError(message, reason);
});