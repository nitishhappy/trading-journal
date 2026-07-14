import { state } from '../state.js';
import {
  mainTabs, viewDashboard, viewRevision, viewAiCoach, viewTradelog, viewCandleChecklist, currentFolderLabel,
  fullscreenBtn, lightbox, lightboxImg, lightboxClose
} from '../dom.js';

// Setup Main tab navigation
mainTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".main-tab");
  if (!tab) return;
  
  state.activeView = tab.dataset.view;
  document.querySelectorAll(".main-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");

  [viewDashboard, viewRevision, viewAiCoach, viewTradelog, viewCandleChecklist].forEach((v) => {
    if (v) v.classList.add("hidden");
  });

  // Update current title label
  if (state.activeView === "dashboard") {
    viewDashboard.classList.remove("hidden");
    currentFolderLabel.textContent = state.activeFolder === "all" ? "Dashboard" : state.activeFolder;
  } else if (state.activeView === "revision") {
    viewRevision.classList.remove("hidden");
    currentFolderLabel.textContent = "Revision";
  } else if (state.activeView === "aicoach") {
    viewAiCoach.classList.remove("hidden");
    currentFolderLabel.textContent = "AI Coach";
  } else if (state.activeView === "tradelog") {
    viewTradelog.classList.remove("hidden");
    currentFolderLabel.textContent = "Trade Log";
  } else if (state.activeView === "candleChecklist") {
    if (viewCandleChecklist) viewCandleChecklist.classList.remove("hidden");
    currentFolderLabel.textContent = "Candle Checklist";
  }

  // Dispatch custom event when view changes
  window.dispatchEvent(new CustomEvent('view-changed', { detail: { view: state.activeView } }));

  // Toggle FAB visibility: dashboard FAB only on dashboard, candle FAB only on candleChecklist
  const dashboardFab = document.getElementById('checklistFab');
  const candleFab = document.getElementById('candle-checklist-fab');
  const isCandle = state.activeView === 'candleChecklist';
  if (dashboardFab) dashboardFab.classList.toggle('hidden', isCandle);
  if (candleFab)    candleFab.classList.toggle('hidden', !isCandle);

});

// Fullscreen toggle
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        if (window.showToast) window.showToast("Fullscreen not available");
      });
    } else {
      document.exitFullscreen();
    }
  });
}

// ===================== Lightbox Logic =====================
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxRotation = 0;

export function openLightbox(images, startIndex = 0) {
  lightboxImages = images;
  lightboxIndex = startIndex;
  lightboxRotation = 0;
  
  if (lightbox) {
    lightbox.classList.remove("hidden");
  }
  showLightboxImage(lightboxIndex);
}

function showLightboxImage(idx) {
  if (!lightboxImg) return;
  lightboxIndex = idx;
  lightboxRotation = 0;
  lightboxImg.style.transform = "rotate(0deg)";
  lightboxImg.src = lightboxImages[idx];

  const prev = document.getElementById("lightbox-prev");
  const next = document.getElementById("lightbox-next");
  const counter = document.getElementById("lightbox-counter");

  if (lightboxImages.length > 1) {
    if (prev) prev.classList.remove("hidden");
    if (next) next.classList.remove("hidden");
    if (counter) {
      counter.classList.remove("hidden");
      counter.textContent = `${idx + 1} / ${lightboxImages.length}`;
    }
  } else {
    if (prev) prev.classList.add("hidden");
    if (next) next.classList.add("hidden");
    if (counter) counter.classList.add("hidden");
  }
}

function lightboxGoTo(dir) {
  let newIdx = lightboxIndex + dir;
  if (newIdx < 0) newIdx = lightboxImages.length - 1;
  if (newIdx >= lightboxImages.length) newIdx = 0;
  showLightboxImage(newIdx);
}

// Lightbox event handlers
if (lightboxClose) {
  lightboxClose.addEventListener("click", () => {
    if (lightbox) lightbox.classList.add("hidden");
  });
}

const prevBtn = document.getElementById("lightbox-prev");
if (prevBtn) {
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    lightboxGoTo(-1);
  });
}

const nextBtn = document.getElementById("lightbox-next");
if (nextBtn) {
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    lightboxGoTo(1);
  });
}

const rotateBtn = document.getElementById("lightbox-rotate");
if (rotateBtn) {
  rotateBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!lightboxImg) return;
    lightboxRotation = (lightboxRotation + 90) % 360;
    lightboxImg.style.transform = `rotate(${lightboxRotation}deg)`;
  });
}

// Close lightbox on click outside image
if (lightbox) {
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-content")) {
      lightbox.classList.add("hidden");
    }
  });
}

// Keyboard shortcuts for lightbox
window.addEventListener("keydown", (e) => {
  if (lightbox && lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") {
    if (lightbox) lightbox.classList.add("hidden");
  } else if (e.key === "ArrowLeft") {
    lightboxGoTo(-1);
  } else if (e.key === "ArrowRight") {
    lightboxGoTo(1);
  }
});

// Bind to window for global access/compatibility
window.openLightbox = openLightbox;