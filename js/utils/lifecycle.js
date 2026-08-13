import { state } from '../state.js';
import { showToast } from './toast.js';
import { startSilentAudio, stopSilentAudio } from './audio.js';

const SESSION_KEY = 'trade_journal_session_state';
const KEEP_ACTIVE_KEY = 'trade_journal_keep_active';
const MAX_SESSION_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

let wakeLockSentinel = null;
let isRestoring = false;

/**
 * Save current volatile JS state to localStorage
 */
export function saveSessionState() {
  if (isRestoring) return;

  try {
    const sessionData = {
      activeView: state.activeView || 'dashboard',
      activeFolder: state.activeFolder || 'all',
      activeTagFilter: state.activeTagFilter || null,
      groupMode: state.groupMode || 'date',
      revisionFolderFilter: state.revisionFolderFilter || 'all',
      revisionTagFilter: state.revisionTagFilter || 'all',
      revisionStarredOnly: !!state.revisionStarredOnly,
      scrollPosition: window.scrollY || 0,
      savedAt: Date.now()
    };

    // Capture open modal drafts if any
    const tradeModal = document.getElementById('trade-modal');
    if (tradeModal && !tradeModal.classList.contains('hidden')) {
      sessionData.tradeDraft = {
        date: document.getElementById('trade-date')?.value || '',
        capital: document.getElementById('trade-capital')?.value || '',
        num: document.getElementById('trade-num')?.value || '',
        gross: document.getElementById('trade-gross')?.value || '',
        net: document.getElementById('trade-net')?.value || '',
        duration: document.getElementById('trade-duration')?.value || '',
        comments: document.getElementById('trade-comments')?.value || ''
      };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.warn('Failed to save session state:', err);
  }
}

/**
 * Restore session state from localStorage after page load or app wake-up
 */
export function restoreSessionState() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    const sessionData = JSON.parse(raw);
    if (!sessionData || typeof sessionData !== 'object') return;

    // Verify state age (don't restore stale session > 48h)
    if (sessionData.savedAt && (Date.now() - sessionData.savedAt > MAX_SESSION_AGE_MS)) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    isRestoring = true;

    // Restore view/tab if valid
    if (sessionData.activeView && sessionData.activeView !== 'dashboard') {
      const targetTab = document.querySelector(`.main-tab[data-view="${sessionData.activeView}"]`);
      if (targetTab) {
        targetTab.click();
      }
    }

    // Restore active folder / filters if saved
    if (sessionData.activeFolder) {
      state.activeFolder = sessionData.activeFolder;
    }
    if (sessionData.activeTagFilter !== undefined) {
      state.activeTagFilter = sessionData.activeTagFilter;
    }
    if (sessionData.groupMode) {
      state.groupMode = sessionData.groupMode;
    }
    if (sessionData.revisionFolderFilter) {
      state.revisionFolderFilter = sessionData.revisionFolderFilter;
    }
    if (sessionData.revisionTagFilter) {
      state.revisionTagFilter = sessionData.revisionTagFilter;
    }
    if (sessionData.revisionStarredOnly !== undefined) {
      state.revisionStarredOnly = sessionData.revisionStarredOnly;
    }

    // Restore scroll position after DOM renders
    if (sessionData.scrollPosition && sessionData.scrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo({ top: sessionData.scrollPosition, behavior: 'instant' });
      }, 150);
      setTimeout(() => {
        window.scrollTo({ top: sessionData.scrollPosition, behavior: 'instant' });
      }, 400);
    }

    // Restore open draft modal if saved
    if (sessionData.tradeDraft) {
      setTimeout(() => {
        const tradeModal = document.getElementById('trade-modal');
        if (tradeModal) {
          const d = sessionData.tradeDraft;
          if (d.date) document.getElementById('trade-date').value = d.date;
          if (d.capital) document.getElementById('trade-capital').value = d.capital;
          if (d.num) document.getElementById('trade-num').value = d.num;
          if (d.gross) document.getElementById('trade-gross').value = d.gross;
          if (d.net) document.getElementById('trade-net').value = d.net;
          if (d.duration) document.getElementById('trade-duration').value = d.duration;
          if (d.comments) document.getElementById('trade-comments').value = d.comments;
          tradeModal.classList.remove('hidden');
        }
      }, 300);
    }

    setTimeout(() => {
      isRestoring = false;
    }, 500);

  } catch (err) {
    console.warn('Failed to restore session state:', err);
    isRestoring = false;
  }
}

/**
 * Screen Wake Lock API management
 */
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return false;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn('Wake Lock request failed:', err.message);
    return false;
  }
}

export function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

/**
 * Toggle Keep App Active / Keep Open mode.
 * 
 * This now does TWO things:
 * 1. Screen Wake Lock — keeps the screen on while the app is in the foreground.
 * 2. Silent Audio Playback — plays an inaudible looping WAV and registers a
 *    Media Session. Android Chrome treats this as an active "media player"
 *    process, elevating its priority so the Low Memory Killer won't suspend
 *    or terminate it while backgrounded. The lock-screen / notification tray
 *    shows "Trade Journal – Active".
 */
export function setKeepAppActive(enabled, userInitiated = false) {
  state.keepAppActiveMode = !!enabled;
  localStorage.setItem(KEEP_ACTIVE_KEY, enabled ? 'true' : 'false');

  if (enabled) {
    // Start the silent audio keep-alive (the main defense against Android LMK)
    startSilentAudio();

    // Screen Wake Lock (secondary — keeps screen on in foreground)
    requestWakeLock().then(success => {
      if (userInitiated) {
        showToast('Keep Open mode enabled — app will stay active in background');
      }
    });
  } else {
    stopSilentAudio();
    releaseWakeLock();
    if (userInitiated) {
      showToast('Keep Open mode disabled');
    }
  }
}

/**
 * Initialize all lifecycle listeners and settings
 */
export function initLifecycleManager() {
  // Load saved Keep App Active preference
  const savedKeepActive = localStorage.getItem(KEEP_ACTIVE_KEY) === 'true';
  state.keepAppActiveMode = savedKeepActive;
  if (savedKeepActive) {
    // Defer silent audio start until first user interaction (browser autoplay policy)
    const startOnInteraction = () => {
      if (state.keepAppActiveMode) {
        startSilentAudio();
        requestWakeLock();
      }
      window.removeEventListener('click', startOnInteraction);
      window.removeEventListener('touchstart', startOnInteraction);
    };
    window.addEventListener('click', startOnInteraction, { once: false });
    window.addEventListener('touchstart', startOnInteraction, { once: false });
    // Also try immediately (works if returning to an already-interacted page)
    requestWakeLock();
    startSilentAudio();
  }

  // Save session state on visibility change (when user backgrounds/switches apps)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveSessionState();
    } else if (document.visibilityState === 'visible') {
      // When app returns to foreground, re-acquire wake lock and restart
      // silent audio if it was paused by the OS during backgrounding
      if (state.keepAppActiveMode) {
        requestWakeLock();
        startSilentAudio();
      }
    }
  });

  // Save on page unload / hide
  window.addEventListener('pagehide', saveSessionState);
  window.addEventListener('beforeunload', saveSessionState);

  // Periodic debounced save on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(saveSessionState, 300);
  }, { passive: true });
}

// Auto-initialize lifecycle manager when module loads
initLifecycleManager();
