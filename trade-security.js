// =====================================================================
// trade-security.js — Enhanced security for Trade Log
// Load AFTER app.js in index.html
// =====================================================================
//
// Requires 3 reassignment lines at the end of app.js:
//   showTradeLock = window.showTradeLock;
//   attemptUnlock = window.attemptUnlock;
//   loadTradePasscodeStatus = window.loadTradePasscodeStatus;
//
// Features:
// 1. SECRET TAB HIDE/UNHIDE — Tap topbar title 5 times rapidly
// 2. PASSCODE LOCKOUT — 1 wrong attempt = 1 hour lockout (Firestore persisted)
// 3. PASSCODE CHANGE FROM FIREBASE CONSOLE ONLY
// =====================================================================

(function() {

  // ===================================================================
  // SECTION 1: SECRET TRADE LOG TAB HIDE/UNHIDE (5-tap sequence)
  // ===================================================================
  // Tap the topbar title area 5 times within 2 seconds to toggle.
  // State persists in localStorage.
  // ===================================================================

  const SECRET_TAP_THRESHOLD = 5;
  const SECRET_TAP_RESET_MS = 2000;
  const TRADELOG_HIDDEN_KEY = "tradelog_tab_hidden";

  var secretTapCount = 0;
  var secretTapTimer = null;

  function isTradeLogTabHidden() {
    var val = localStorage.getItem(TRADELOG_HIDDEN_KEY);
    if (val === "false") return false; // explicitly shown by user
    return true; // hidden by default (when null or true)
  }

  function setTradeLogTabHidden(hidden) {
    localStorage.setItem(TRADELOG_HIDDEN_KEY, hidden ? "true" : "false");
  }

  function toggleTradeLogTabVisibility() {
    var tradeLogTab = document.querySelector('.main-tab[data-view="tradelog"]');
    if (!tradeLogTab) return;

    var currentlyHidden = isTradeLogTabHidden();
    var newHidden = !currentlyHidden;

    if (newHidden) {
      tradeLogTab.style.display = "none";
      setTradeLogTabHidden(true);
      showToast("View updated");

      if (window.activeView === "tradelog") {
        var dashboardTab = document.querySelector('.main-tab[data-view="dashboard"]');
        if (dashboardTab) dashboardTab.click();
      }
    } else {
      tradeLogTab.style.display = "";
      setTradeLogTabHidden(false);
      showToast("View updated");
    }
  }

  function initSecretTabToggle() {
    var triggerZone = document.querySelector(".topbar-title");
    if (!triggerZone) {
      setTimeout(initSecretTabToggle, 500);
      return;
    }

    triggerZone.addEventListener("click", function handler(e) {
      if (e.target.closest(".streak-badge") || e.target.closest(".offline-badge")) return;

      secretTapCount++;

      // Subtle visual feedback
      triggerZone.style.transition = "opacity 0.1s";
      triggerZone.style.opacity = "0.5";
      setTimeout(function() { triggerZone.style.opacity = "1"; }, 100);

      clearTimeout(secretTapTimer);

      if (secretTapCount >= SECRET_TAP_THRESHOLD) {
        secretTapCount = 0;
        toggleTradeLogTabVisibility();
      } else {
        secretTapTimer = setTimeout(function() {
          secretTapCount = 0;
        }, SECRET_TAP_RESET_MS);
      }
    });
  }

  // Apply hidden state immediately / on DOMContentLoaded
  function applyTradeLogTabVisibility() {
    if (isTradeLogTabHidden()) {
      var tradeLogTab = document.querySelector('.main-tab[data-view="tradelog"]');
      if (tradeLogTab) tradeLogTab.style.display = "none";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      applyTradeLogTabVisibility();
      initSecretTabToggle();
    });
  } else {
    applyTradeLogTabVisibility();
    initSecretTabToggle();
  }

  // ===================================================================
  // SECTION 2: PASSCODE LOCKOUT (1 wrong attempt = 1 hour)
  // ===================================================================
  // State stored in Firestore: users/{uid}/settings/tradePasscodeLockout
  // ===================================================================

  var PASSCODE_LOCKOUT_MS = 60 * 60 * 1000;

  window._tradePasscodeFailedAttempts = 0;
  window._tradePasscodeLockedUntil = null;

  // ---- Override loadTradePasscodeStatus ----
  window.loadTradePasscodeStatus = function() {
    if (!window.currentUser) return;

    var ref = window.db
      ? window.db.collection("users").doc(window.currentUser.uid).collection("settings").doc("tradePasscode")
      : null;
    if (!ref) return;

    ref.get().then(function(doc) {
      var statusEl = document.getElementById("trade-passcode-status");
      if (doc.exists && doc.data().passcode) {
        window.tradePasscode = doc.data().passcode;
        if (statusEl) {
          statusEl.textContent = "Passcode is set (changeable only from Firebase Console)";
          statusEl.style.color = "var(--low)";
        }
      } else {
        window.tradePasscode = null;
        if (statusEl) {
          statusEl.textContent = "No passcode set. Set from Firebase Console > Firestore > users > settings > tradePasscode";
          statusEl.style.color = "var(--medium)";
        }
      }
    }).catch(function(err) {
      console.error("trade passcode load error (sec):", err);
    });

    // Load lockout state
    var lockoutRef = window.db
      ? window.db.collection("users").doc(window.currentUser.uid).collection("settings").doc("tradePasscodeLockout")
      : null;
    if (lockoutRef) {
      lockoutRef.get().then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          window._tradePasscodeFailedAttempts = data.failedAttempts || 0;
          if (data.lockedUntil && data.lockedUntil.toDate) {
            window._tradePasscodeLockedUntil = data.lockedUntil.toDate();
          } else {
            window._tradePasscodeLockedUntil = null;
          }
        } else {
          window._tradePasscodeFailedAttempts = 0;
          window._tradePasscodeLockedUntil = null;
        }
      }).catch(function(err) {
        console.error("trade lockout load error (sec):", err);
      });
    }
  };

  // ---- Override showTradeLock ----
  window.showTradeLock = function() {
    if (!window.tradePasscode) {
      var overlay = document.getElementById("trade-lock-overlay");
      if (overlay) overlay.classList.add("hidden");
      return;
    }

    window.tradeLocked = true;
    clearTimeout(window.tradeInactivityTimer);

    var overlay = document.getElementById("trade-lock-overlay");
    var input = document.getElementById("trade-lock-input");
    var error = document.getElementById("trade-lock-error");
    var hint = document.getElementById("trade-lock-setup-hint");
    var sub = document.getElementById("trade-lock-sub");
    var unlockBtn = document.getElementById("trade-lock-unlock-btn");

    if (overlay) overlay.classList.remove("hidden");
    if (input) { input.value = ""; input.disabled = false; }
    if (error) error.classList.add("hidden");
    if (hint) hint.classList.add("hidden");

    var now = new Date();
    var lockedUntil = window._tradePasscodeLockedUntil || null;
    var isLocked = lockedUntil && now < lockedUntil;

    if (isLocked) {
      var remainingMs = lockedUntil.getTime() - now.getTime();
      var remainingMin = Math.ceil(remainingMs / 60000);
      if (sub) sub.textContent = "Too many incorrect attempts. Try again in " + remainingMin + " minute" + (remainingMin !== 1 ? "s" : "") + ".";
      if (input) input.disabled = true;
      if (unlockBtn) unlockBtn.disabled = true;
      if (error) {
        error.textContent = "Locked for " + remainingMin + " more minute" + (remainingMin !== 1 ? "s" : "") + ".";
        error.classList.remove("hidden");
      }
    } else {
      // Lockout expired — reset
      if (lockedUntil && now >= lockedUntil) {
        window._tradePasscodeFailedAttempts = 0;
        window._tradePasscodeLockedUntil = null;
        if (window.currentUser) {
          var ref = window.db
            ? window.db.collection("users").doc(window.currentUser.uid).collection("settings").doc("tradePasscodeLockout")
            : null;
          if (ref) {
            ref.set({
              failedAttempts: 0,
              lockedUntil: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(function() {});
          }
        }
      }
      if (sub) sub.textContent = "Enter your 4-digit passcode to access the trade log.";
      if (input) input.disabled = false;
      if (unlockBtn) unlockBtn.disabled = false;
    }

    setTimeout(function() { if (input) input.focus(); }, 100);
  };

  // ---- Override attemptUnlock ----
  window.attemptUnlock = function() {
    var codeInput = document.getElementById("trade-lock-input");
    var errorEl = document.getElementById("trade-lock-error");
    var subEl = document.getElementById("trade-lock-sub");
    var unlockBtn = document.getElementById("trade-lock-unlock-btn");

    if (!codeInput || !errorEl) return;
    var code = codeInput.value.trim();

    var now = new Date();
    var lockedUntil = window._tradePasscodeLockedUntil || null;
    if (lockedUntil && now < lockedUntil) {
      errorEl.textContent = "Still locked. Try again later.";
      errorEl.classList.remove("hidden");
      return;
    }

    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      errorEl.textContent = "Enter a valid 4-digit passcode.";
      errorEl.classList.remove("hidden");
      return;
    }

    if (code === window.tradePasscode) {
      // Correct passcode — reset lockout
      errorEl.classList.add("hidden");
      window._tradePasscodeFailedAttempts = 0;
      window._tradePasscodeLockedUntil = null;

      if (window.currentUser) {
        var ref = window.db
          ? window.db.collection("users").doc(window.currentUser.uid).collection("settings").doc("tradePasscodeLockout")
          : null;
        if (ref) {
          ref.set({
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(function() {});
        }
      }

      var overlay = document.getElementById("trade-lock-overlay");
      if (overlay) overlay.classList.add("hidden");
      window.tradeLocked = false;
      if (typeof window.renderTradeTable === "function") window.renderTradeTable();
      if (typeof window.resetTradeInactivityTimer === "function") window.resetTradeInactivityTimer();
    } else {
      // Wrong passcode — lock out for 1 hour
      window._tradePasscodeFailedAttempts = (window._tradePasscodeFailedAttempts || 0) + 1;
      var lockoutExpiry = new Date(now.getTime() + PASSCODE_LOCKOUT_MS);
      window._tradePasscodeLockedUntil = lockoutExpiry;

      if (window.currentUser) {
        var ref2 = window.db
          ? window.db.collection("users").doc(window.currentUser.uid).collection("settings").doc("tradePasscodeLockout")
          : null;
        if (ref2) {
          ref2.set({
            failedAttempts: window._tradePasscodeFailedAttempts,
            lockedUntil: firebase.firestore.Timestamp.fromDate(lockoutExpiry),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(function() {});
        }
      }

      errorEl.textContent = "Incorrect passcode. Try again in 1 hour.";
      errorEl.classList.remove("hidden");
      codeInput.value = "";
      if (subEl) subEl.textContent = "Too many incorrect attempts. Try again in 1 hour.";
      codeInput.disabled = true;
      if (unlockBtn) unlockBtn.disabled = true;
    }
  };

  // ===================================================================
  // SECTION 3: PASSCODE CHANGE FROM FIREBASE CONSOLE ONLY
  // ===================================================================
  // Disable Save/Remove buttons in Settings; show instruction instead.
  // ===================================================================

  function disablePasscodeChangeInSettings() {
    var checkInterval = setInterval(function() {
      var saveBtn = document.getElementById("trade-passcode-save-btn");
      var removeBtn = document.getElementById("trade-passcode-remove-btn");
      var input = document.getElementById("trade-passcode-input");
      var statusEl = document.getElementById("trade-passcode-status");

      if (saveBtn && removeBtn && statusEl) {
        clearInterval(checkInterval);

        saveBtn.addEventListener("click", function(e) {
          statusEl.textContent = "Passcode can only be changed from Firebase Console > Firestore > users > settings > tradePasscode";
          statusEl.style.color = "var(--medium)";
          if (input) input.value = "";
        });

        removeBtn.addEventListener("click", function(e) {
          statusEl.textContent = "Passcode can only be removed from Firebase Console > Firestore > users > settings > tradePasscode";
          statusEl.style.color = "var(--medium)";
          if (input) input.value = "";
        });

        // Add helper hint
        var hintEl = document.createElement("p");
        hintEl.className = "settings-hint";
        hintEl.style.marginTop = "8px";
        hintEl.style.color = "var(--medium)";
        hintEl.style.fontSize = "11px";
        hintEl.innerHTML = "<b>Firebase Console only:</b> Change passcode at <code>Firestore > users > settings > tradePasscode</code>";
        statusEl.parentNode.insertBefore(hintEl, statusEl.nextSibling);
      }
    }, 300);

    setTimeout(function() { clearInterval(checkInterval); }, 10000);
  }

  if (document.readyState === "complete") {
    disablePasscodeChangeInSettings();
  } else {
    window.addEventListener("load", disablePasscodeChangeInSettings);
  }

})();
