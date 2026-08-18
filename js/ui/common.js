import { state } from '../state.js';
import { saveSessionState } from '../utils/lifecycle.js';
import {
  mainTabs, mainTabsWrapper, tabsScrollLeftBtn, tabsScrollRightBtn,
  viewDashboard, viewRevision, viewStocks, viewAiCoach, viewTradelog, viewCandleChecklist, viewTvNotifications, viewLevels, viewAiCoPilot, currentFolderLabel,
  fullscreenBtn, lightbox, lightboxImg, lightboxClose
} from '../dom.js';

// Scroll main-tabs horizontally
export function scrollMainTabs(amount) {
  const tabs = mainTabs || document.getElementById('main-tabs');
  if (!tabs) return;
  tabs.scrollBy({ left: amount, behavior: 'smooth' });
}

// Update scroll buttons and edge fade indicators based on main-tabs scroll position
export function updateTabsScrollButtons() {
  const tabs = mainTabs || document.getElementById('main-tabs');
  if (!tabs) return;
  const leftBtn = tabsScrollLeftBtn || document.getElementById('tabs-scroll-left');
  const rightBtn = tabsScrollRightBtn || document.getElementById('tabs-scroll-right');
  const wrapper = mainTabsWrapper || document.getElementById('main-tabs-wrapper');

  const scrollLeft = Math.ceil(tabs.scrollLeft);
  const scrollWidth = tabs.scrollWidth;
  const clientWidth = tabs.clientWidth;

  // If container is hidden or not rendered yet, keep buttons active
  if (clientWidth === 0) {
    if (leftBtn) leftBtn.classList.remove('at-edge');
    if (rightBtn) rightBtn.classList.remove('at-edge');
    return;
  }

  const maxScrollLeft = scrollWidth - clientWidth;
  const hasOverflow = scrollWidth > clientWidth + 2;
  const canScrollLeft = hasOverflow && scrollLeft > 2;
  const canScrollRight = hasOverflow && scrollLeft < maxScrollLeft - 2;

  if (leftBtn) {
    leftBtn.classList.toggle('at-edge', !canScrollLeft);
  }

  if (rightBtn) {
    rightBtn.classList.toggle('at-edge', !canScrollRight);
  }

  if (wrapper) {
    wrapper.classList.toggle('can-scroll-left', canScrollLeft);
    wrapper.classList.toggle('can-scroll-right', canScrollRight);
    wrapper.classList.toggle('has-overflow', hasOverflow);
  }
}

// Bulletproof click delegation for scroll buttons
document.addEventListener('click', (e) => {
  const leftBtn = e.target.closest('#tabs-scroll-left, .tabs-nav-left');
  if (leftBtn) {
    e.preventDefault();
    e.stopPropagation();
    scrollMainTabs(-180);
    return;
  }

  const rightBtn = e.target.closest('#tabs-scroll-right, .tabs-nav-right');
  if (rightBtn) {
    e.preventDefault();
    e.stopPropagation();
    scrollMainTabs(180);
    return;
  }
});

// Mouse wheel horizontal scroll on tabs bar
if (mainTabs) {
  mainTabs.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0 && mainTabs.scrollWidth > mainTabs.clientWidth) {
      e.preventDefault();
      mainTabs.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  mainTabs.addEventListener('scroll', updateTabsScrollButtons, { passive: true });
  window.addEventListener('resize', updateTabsScrollButtons);
}

// Listen to app lifecycle events to ensure button states update when views become visible
window.addEventListener('auth-changed', () => {
  setTimeout(updateTabsScrollButtons, 50);
  setTimeout(updateTabsScrollButtons, 300);
});

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => {
    updateTabsScrollButtons();
  });
  if (mainTabs) ro.observe(mainTabs);
  if (mainTabsWrapper) ro.observe(mainTabsWrapper);
}

// Initial checks
setTimeout(updateTabsScrollButtons, 50);
setTimeout(updateTabsScrollButtons, 300);
setTimeout(updateTabsScrollButtons, 1000);

// Setup Main tab navigation
mainTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".main-tab");
  if (!tab) return;
  
  state.activeView = tab.dataset.view;
  document.querySelectorAll(".main-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");

  // Center active tab in scrollable container
  tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  [viewDashboard, viewRevision, viewStocks, viewAiCoach, viewTradelog, viewCandleChecklist, viewTvNotifications, viewLevels, viewAiCoPilot].forEach((v) => {
    if (v) v.classList.add("hidden");
  });

  // Update current title label
  if (state.activeView === "dashboard") {
    viewDashboard.classList.remove("hidden");
    currentFolderLabel.textContent = state.activeFolder === "all" ? "Dashboard" : state.activeFolder;
  } else if (state.activeView === "revision") {
    viewRevision.classList.remove("hidden");
    currentFolderLabel.textContent = "Revision";
  } else if (state.activeView === "stocks") {
    if (viewStocks) viewStocks.classList.remove("hidden");
    currentFolderLabel.textContent = "Stocks";
  } else if (state.activeView === "aicoach") {
    viewAiCoach.classList.remove("hidden");
    currentFolderLabel.textContent = "AI Coach";
  } else if (state.activeView === "tradelog") {
    viewTradelog.classList.remove("hidden");
    currentFolderLabel.textContent = "Trade Log";
  } else if (state.activeView === "candleChecklist") {
    if (viewCandleChecklist) viewCandleChecklist.classList.remove("hidden");
    currentFolderLabel.textContent = "Candle Checklist";
  } else if (state.activeView === "tvNotifications") {
    if (viewTvNotifications) viewTvNotifications.classList.remove("hidden");
    currentFolderLabel.textContent = "TV Alerts";
  } else if (state.activeView === "levels") {
    if (viewLevels) viewLevels.classList.remove("hidden");
    currentFolderLabel.textContent = "Daily Levels";
  } else if (state.activeView === "aico-pilot") {
    if (viewAiCoPilot) viewAiCoPilot.classList.remove("hidden");
    currentFolderLabel.textContent = "AI Co-Pilot & ML";
    if (typeof window.initAICoPilotView === 'function') {
      window.initAICoPilotView();
    }
  }

  // Dispatch custom event when view changes
  window.dispatchEvent(new CustomEvent('view-changed', { detail: { view: state.activeView } }));
  saveSessionState();
  setTimeout(updateTabsScrollButtons, 100);

  // Toggle FAB visibility: dashboard FAB only on dashboard, candle FAB only on candleChecklist
  const dashboardFab = document.getElementById('checklistFab');
  const candleFab = document.getElementById('candle-checklist-fab');
  const isCandle = state.activeView === 'candleChecklist';
  if (dashboardFab) dashboardFab.classList.toggle('hidden', isCandle);
  if (candleFab)    candleFab.classList.toggle('hidden', !isCandle);

  // Hide back-to-tradelog banner when manually switching away from candle checklist
  if (!isCandle) {
    const backBanner = document.getElementById('candle-back-banner');
    if (backBanner) backBanner.classList.add('hidden');
  }

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