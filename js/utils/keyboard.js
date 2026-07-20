import { state } from '../state.js';
import { renderFeed } from '../ui/dashboard.js';
import { currentFolderLabel, mainTabs } from '../dom.js';

export function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ignore when typing in editable fields
    const active = document.activeElement;
    if (active && (
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable
    )) {
      if (e.key === "Escape") {
        closeAllModals();
      }
      return;
    }

    // Escape - close modals anyway
    if (e.key === "Escape") {
      closeAllModals();
      return;
    }

    // Shift + ? - toggle cheatsheet
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      toggleCheatsheet();
      return;
    }

    // N - New Observation
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      if (window.openCreateModal) window.openCreateModal();
      return;
    }

    // Switch views
    if (e.key.toLowerCase() === "d") {
      e.preventDefault();
      switchView("dashboard");
      return;
    }
    if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      switchView("revision");
      return;
    }
    if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      switchView("tags");
      return;
    }
    if (e.key.toLowerCase() === "l") {
      e.preventDefault();
      switchView("tradelog");
      return;
    }

    // Revision swipe emulation / star toggle (only active when on revision page)
    if (state.activeView === "revision") {
      const topCard = document.querySelector(".revision-card-top");
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (topCard && window.renderRevisionStage) {
          const btn = topCard.querySelector(".revision-card-hint.right") || { click: () => {} };
          // Swipe right -> Reviewed
          const id = topCard.dataset.id;
          state.revisionReviewedIds.push(id);
          saveRevisionStateAndReload();
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (topCard && window.renderRevisionStage) {
          // Swipe left -> Flagged
          const id = topCard.dataset.id;
          state.revisionFlaggedIds.push(id);
          saveRevisionStateAndReload();
        }
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (topCard) {
          const starBtn = topCard.querySelector(".revision-card-star");
          if (starBtn) starBtn.click();
        }
      }
    }
  });
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
}

function switchView(view) {
  state.activeView = view;
  document.querySelectorAll(".main-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === view);
  });

  const views = ["dashboard", "revision", "aicoach", "tradelog", "candleChecklist", "tvNotifications", "tags"];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  });

  if (view === "dashboard") {
    currentFolderLabel.textContent = state.activeFolder === "all" ? "Dashboard" : state.activeFolder;
    renderFeed();
  } else if (view === "revision") {
    currentFolderLabel.textContent = "Revision";
    if (window.renderRevisionStage) window.renderRevisionStage();
  } else if (view === "tags") {
    currentFolderLabel.textContent = "Tag Cloud & Analytics";
    if (window.renderTagsView) window.renderTagsView();
  } else if (view === "tradelog") {
    currentFolderLabel.textContent = "Trade Log";
  }

  window.dispatchEvent(new CustomEvent('view-changed', { detail: { view } }));
}

async function saveRevisionStateAndReload() {
  // Call revision state save if available on window
  try {
    await db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("revisionProgress")
      .set({
        date: todayKey(),
        reviewedIds: state.revisionReviewedIds,
        flaggedIds: state.revisionFlaggedIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch(e) {}
  if (window.renderRevisionStage) window.renderRevisionStage();
}

function toggleCheatsheet() {
  const modal = document.getElementById("shortcuts-modal");
  if (modal) {
    modal.classList.toggle("hidden");
  }
}

// Auto-run keyboard handler
initKeyboardShortcuts();
