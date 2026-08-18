import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import {
  markTvNotificationRead,
  deleteTvNotification,
  deleteTvNotificationsByIds,
  clearAllTvNotifications,
  generateToken,
  saveWebhookToken,
  loadWebhookToken,
  buildWebhookUrl,
} from '../services/tvNotifications.js';

// ===================== DOM refs =====================
const notifFeed    = document.querySelector('.tv-pane-left #tv-notif-feed');
const emptyState   = document.querySelector('.tv-pane-left #tv-notif-empty');
const filterBtns   = document.querySelectorAll('.tv-pane-left .tv-filter-btn');
const clearAllBtn  = document.getElementById('tv-clear-all-btn');
const unreadBadge  = document.getElementById('tv-unread-badge');

// Settings elements
const webhookUrlBox       = document.getElementById('tv-webhook-url-box');
const webhookUrlText      = document.getElementById('tv-webhook-url-text');
const copyUrlBtn          = document.getElementById('tv-copy-url-btn');
const generateTokenBtn    = document.getElementById('tv-generate-token-btn');
const regenerateTokenBtn  = document.getElementById('tv-regenerate-token-btn');
const tokenSetupSection   = document.getElementById('tv-token-setup');
const tokenActiveSection  = document.getElementById('tv-token-active');
const tokenRevealBtn      = document.getElementById('tv-token-reveal-btn');

let currentFilter = 'ALL';
let tokenRevealed = false;
let storedToken   = null;
let alertNotifsEnabled = false; // Normal TV alert push notifications (off by default)

// ===================== Live Price Floater Logic =====================
let livePriceInterval = null;
let isViewActive = false;

async function updateLivePrices() {
  const niftyValEl = document.getElementById('tv-floater-nifty-val');
  const xauValEl = document.getElementById('tv-floater-xau-val');
  const titleEl = document.getElementById('tv-floater-title-text');
  const floater = document.getElementById('tv-price-floater');

  if (!floater || floater.classList.contains('hidden')) return;

  try {
    const res = await fetch('/api/livePrices');
    if (!res.ok) throw new Error('Failed to fetch prices');
    const data = await res.json();
    if (data && data.success) {
      // Nifty
      if (data.nifty !== null) {
        const oldVal = parseFloat(niftyValEl.innerText.replace(/,/g, '')) || 0;
        const newVal = data.nifty;
        niftyValEl.innerText = newVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (oldVal && newVal !== oldVal) {
          const cls = newVal > oldVal ? 'tick-up' : 'tick-down';
          niftyValEl.classList.add(cls);
          setTimeout(() => niftyValEl.classList.remove(cls), 1000);
        }
      } else {
        niftyValEl.innerText = '--';
      }

      // XAUUSD
      if (data.xauusd !== null) {
        const oldVal = parseFloat(xauValEl.innerText.replace(/,/g, '')) || 0;
        const newVal = data.xauusd;
        xauValEl.innerText = newVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (oldVal && newVal !== oldVal) {
          const cls = newVal > oldVal ? 'tick-up' : 'tick-down';
          xauValEl.classList.add(cls);
          setTimeout(() => xauValEl.classList.remove(cls), 1000);
        }
      } else {
        xauValEl.innerText = '--';
      }

      // Update minimized attribute
      if (titleEl) {
        const nText = data.nifty ? Math.round(data.nifty).toLocaleString('en-IN') : '--';
        const xText = data.xauusd ? Math.round(data.xauusd).toLocaleString('en-US') : '--';
        titleEl.setAttribute('data-prices', `N: ${nText} | X: ${xText}`);
      }
    }
  } catch (err) {
    console.error('Error fetching live prices:', err);
  }
}

function startLivePrices() {
  stopLivePrices();
  const floater = document.getElementById('tv-price-floater');
  if (floater) {
    floater.classList.remove('hidden');
  }
  updateLivePrices();
  // Poll every 10 seconds
  livePriceInterval = setInterval(updateLivePrices, 10000);
}

function stopLivePrices() {
  if (livePriceInterval) {
    clearInterval(livePriceInterval);
    livePriceInterval = null;
  }
}

// ===================== Init =====================
export function initTvNotificationsUI() {
  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderFeed();
    });
  });

  // Clear all
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Delete all TradingView notifications?')) return;
      try {
        await clearAllTvNotifications();
        showToast('All notifications cleared');
      } catch (e) {
        showToast('Failed to clear: ' + e.message);
      }
    });
  }

  // Request notification permission early so alerts can show system notifications
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Live updates — show BOTH toast AND system notification for new incoming alerts
  window.addEventListener('tv-notifications-updated', () => {
    renderFeed();
    updateUnreadBadge();
    const newest = state.tvNotifications[0];
    if (newest && !newest.read) {
      const ts = newest.receivedAt?.toDate ? newest.receivedAt.toDate() : new Date();
      const age = Date.now() - ts.getTime();
      if (age < 5000) {
        const label = [newest.symbol, newest.action, newest.strategy].filter(Boolean).join(' · ');
        const alertText = label || newest.raw?.slice(0, 60) || 'New alert';
        
        // In-app toast — always required for all incoming alerts
        showToast(`📡 TradingView alert: ${alertText}`, 6000);

        // System notification (Chrome/Windows notification) — only if user enabled in settings
        if (alertNotifsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const title = `📡 ${newest.symbol || 'Alert'}`;
          const options = {
            body: `${newest.action || 'ALERT'} · ${alertText}`,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: `tv-alert-${newest.id}`,
            vibrate: [100, 50, 100]
          };
          if (navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg) reg.showNotification(title, options);
              else new Notification(title, options);
            }).catch(() => new Notification(title, options));
          } else {
            new Notification(title, options);
          }
        }
      }
    }
  });

  window.addEventListener('view-changed', (e) => {
    if (e.detail.view === 'tvNotifications') {
      renderFeed();
      updateUnreadBadge();
      isViewActive = true;
      startLivePrices();
    } else {
      isViewActive = false;
      stopLivePrices();
      const floater = document.getElementById('tv-price-floater');
      if (floater) floater.classList.add('hidden');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isViewActive) {
      startLivePrices();
    } else {
      stopLivePrices();
    }
  });

  // Initialize Floater Drag & Minimization
  const floater = document.getElementById('tv-price-floater');
  const floaterToggleBtn = document.getElementById('btn-tv-toggle-floater');

  if (floater && floaterToggleBtn) {
    // Restore minimized state
    if (localStorage.getItem('tvFloaterMinimized') === 'true') {
      floater.classList.add('minimized');
      floaterToggleBtn.innerText = '+';
    } else {
      floaterToggleBtn.innerText = '−';
    }

    // Restore position
    const savedLeft = localStorage.getItem('tvFloaterLeft');
    const savedTop = localStorage.getItem('tvFloaterTop');
    if (savedLeft && savedTop) {
      floater.style.right = 'auto';
      floater.style.bottom = 'auto';
      floater.style.left = savedLeft;
      floater.style.top = savedTop;
    }

    // Toggle minimize
    floaterToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      floater.classList.toggle('minimized');
      const isMin = floater.classList.contains('minimized');
      floaterToggleBtn.innerText = isMin ? '+' : '−';
      localStorage.setItem('tvFloaterMinimized', isMin ? 'true' : 'false');
    });

    // Drag-and-drop logic
    const header = floater.querySelector('.floater-header');
    if (header) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      const onMouseMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable && e.type.includes('touch')) e.preventDefault();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        const newLeft = `${initialLeft + dx}px`;
        const newTop = `${initialTop + dy}px`;
        
        floater.style.right = 'auto';
        floater.style.bottom = 'auto';
        floater.style.left = newLeft;
        floater.style.top = newTop;
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        floater.style.transition = '';
        
        // Save final position
        localStorage.setItem('tvFloaterLeft', floater.style.left);
        localStorage.setItem('tvFloaterTop', floater.style.top);

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('touchmove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchend', onMouseUp);
      };

      const onMouseDown = (e) => {
        if (e.target.closest('.btn-close-floater')) return;
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const rect = floater.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        floater.style.transition = 'none';
        floater.style.right = 'auto';
        floater.style.bottom = 'auto';
        floater.style.left = `${initialLeft}px`;
        floater.style.top = `${initialTop}px`;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchend', onMouseUp);
      };

      header.addEventListener('mousedown', onMouseDown);
      header.addEventListener('touchstart', onMouseDown, { passive: false });
    }
  }

  // Active check on load
  const activeView = document.querySelector('.view:not(.hidden)');
  if (activeView && activeView.id === 'view-tvNotifications') {
    isViewActive = true;
    startLivePrices();
  }

  // Settings tab token management
  window.addEventListener('settings-opened', () => {
    initTokenSettingsUI();
  });
}

// ===================== Feed Rendering =====================
// Track expanded state per symbol AND per date
const expandedSymbols = new Set();
const expandedDates = new Set();

// Helper: get IST date string from a notification timestamp
function getISTDateKey(receivedAt) {
  if (!receivedAt) return 'Unknown';
  const ts = receivedAt.toDate ? receivedAt.toDate() : new Date(receivedAt);
  return ts.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function getISTDateLabel(dateKey) {
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterdayDate = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const d = new Date(dateKey + 'T00:00:00+05:30');
  const formatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  if (dateKey === todayIST) return `${formatted} · Today`;
  if (dateKey === yesterdayDate) return `${formatted} · Yesterday`;
  return formatted;
}

function renderFeed() {
  if (!notifFeed) return;

  let items = state.tvNotifications || [];

  // Filter by Action if selected
  if (currentFilter !== 'ALL') {
    items = items.filter(n => {
      const act = (n.action || '').toUpperCase();
      if (currentFilter === 'BUY') return ['BUY', 'LONG'].includes(act);
      if (currentFilter === 'SELL') return ['SELL', 'SHORT'].includes(act);
      if (currentFilter === 'EXIT' || currentFilter === 'CLOSE') return ['EXIT', 'CLOSE'].includes(act);
      if (currentFilter === 'CTC') return ['CTC', 'BE', 'BREAKEVEN'].includes(act);
      if (currentFilter === 'SL') return ['SL', 'STOPLOSS', 'STOP LOSS'].includes(act);
      if (currentFilter === 'TP') return ['TP', 'TAKEPROFIT', 'TAKE PROFIT', 'TARGET'].includes(act);
      return act === currentFilter;
    });
  }

  if (items.length === 0) {
    notifFeed.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  // Group by date first, then by symbol within each date
  const dateGroups = {};
  items.forEach(notif => {
    const dateKey = getISTDateKey(notif.receivedAt);
    if (!dateGroups[dateKey]) dateGroups[dateKey] = {};
    const sym = (notif.symbol || 'GENERAL').toUpperCase().trim();
    if (!dateGroups[dateKey][sym]) dateGroups[dateKey][sym] = [];
    dateGroups[dateKey][sym].push(notif);
  });

  notifFeed.innerHTML = '';

  // Sort dates descending (newest first)
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

  // Auto-expand today
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (!expandedDates.has(todayIST) && sortedDates.includes(todayIST)) {
    expandedDates.add(todayIST);
  }

  sortedDates.forEach(dateKey => {
    const symbolGroups = dateGroups[dateKey];
    const allDateNotifs = Object.values(symbolGroups).flat();
    const dateUnread = allDateNotifs.filter(n => !n.read).length;
    const isDateExpanded = expandedDates.has(dateKey);
    const dateLabel = getISTDateLabel(dateKey);

    // Date group container
    const dateSection = document.createElement('div');
    dateSection.className = 'tv-date-group';

    const dateHeader = document.createElement('div');
    dateHeader.className = `tv-date-header ${dateUnread > 0 ? 'has-unread' : ''}`;
    dateHeader.innerHTML = `
      <div class="tv-date-header-left">
        <span class="tv-collapse-icon">${isDateExpanded ? '▼' : '▶'}</span>
        <span class="tv-date-label">${dateLabel}</span>
        <span class="tv-symbol-count-badge">${allDateNotifs.length} ${allDateNotifs.length === 1 ? 'alert' : 'alerts'}</span>
        ${dateUnread > 0 ? `<span class="tv-new-indicator">🔴 ${dateUnread} NEW</span>` : ''}
      </div>
      <div class="tv-date-header-right">
        <button class="btn-small tv-date-clear-btn" title="Clear all alerts for ${dateLabel}">🗑️ Clear</button>
      </div>
    `;

    const dateBody = document.createElement('div');
    dateBody.className = `tv-date-body ${isDateExpanded ? '' : 'collapsed'}`;

    // Toggle date expand/collapse
    dateHeader.querySelector('.tv-date-header-left').addEventListener('click', (e) => {
      e.stopPropagation();
      if (expandedDates.has(dateKey)) {
        expandedDates.delete(dateKey);
        dateBody.classList.add('collapsed');
        dateHeader.querySelector('.tv-collapse-icon').textContent = '▶';
      } else {
        expandedDates.add(dateKey);
        dateBody.classList.remove('collapsed');
        dateHeader.querySelector('.tv-collapse-icon').textContent = '▼';
      }
    });

    // Clear date group button
    dateHeader.querySelector('.tv-date-clear-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const count = allDateNotifs.length;
      if (!confirm(`Delete all ${count} alerts for ${dateLabel}?`)) return;
      try {
        const ids = allDateNotifs.map(n => n.id);
        await deleteTvNotificationsByIds(ids);
        showToast(`Cleared ${count} alerts for ${dateLabel}`);
      } catch (err) {
        showToast('Failed to clear: ' + err.message);
      }
    });

    // Render symbol sub-groups within this date
    Object.keys(symbolGroups).forEach(symbol => {
      const symbolItems = symbolGroups[symbol];
      const hasUnread = symbolItems.some(n => !n.read);
      const unreadCount = symbolItems.filter(n => !n.read).length;
      const symKey = dateKey + '::' + symbol;
      const isExpanded = expandedSymbols.has(symKey);

      const pane = document.createElement('div');
      pane.className = `tv-symbol-group ${hasUnread ? 'has-new-alert' : ''}`;

      pane.innerHTML = `
        <div class="tv-symbol-header">
          <div class="tv-symbol-header-left">
            <span class="tv-collapse-icon">${isExpanded ? '▼' : '▶'}</span>
            <span class="tv-symbol-title">${symbol}</span>
            <span class="tv-symbol-count-badge">${symbolItems.length} ${symbolItems.length === 1 ? 'alert' : 'alerts'}</span>
            ${hasUnread ? `<span class="tv-new-indicator" title="${unreadCount} new alert(s)">🔴 ${unreadCount} NEW</span>` : ''}
          </div>
          <div class="tv-symbol-header-right">
            <span class="tv-latest-time">${formatRelativeTime(symbolItems[0].receivedAt)}</span>
          </div>
        </div>
        <div class="tv-symbol-body ${isExpanded ? '' : 'collapsed'}">
        </div>
      `;

      const bodyEl = pane.querySelector('.tv-symbol-body');
      const headerEl = pane.querySelector('.tv-symbol-header');

      symbolItems.forEach(notif => {
        bodyEl.appendChild(buildCard(notif));
      });

      headerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedSymbols.has(symKey)) {
          expandedSymbols.delete(symKey);
          bodyEl.classList.add('collapsed');
          pane.querySelector('.tv-collapse-icon').textContent = '▶';
        } else {
          expandedSymbols.add(symKey);
          bodyEl.classList.remove('collapsed');
          pane.querySelector('.tv-collapse-icon').textContent = '▼';
        }
      });

      dateBody.appendChild(pane);
    });

    dateSection.appendChild(dateHeader);
    dateSection.appendChild(dateBody);
    notifFeed.appendChild(dateSection);
  });
}

function formatRelativeTime(receivedAt) {
  if (!receivedAt) return '';
  const ts = receivedAt.toDate ? receivedAt.toDate() : new Date(receivedAt);
  return ts.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function formatMessageWithHighlights(text) {
  if (!text) return '';
  const escaped = escHtml(text);
  return escaped.replace(/\b(gold\s+buy|gold\s+sell|gold\s+exit|gold\s+ctc|gold\s+sl|gold\s+tp|gold\s+long|gold\s+short|buy|sell|exit|close|ctc|sl|tp|long|short)\b/gi, (match) => {
    const lower = match.toLowerCase();
    if (lower.includes('gold')) {
      if (lower.includes('buy') || lower.includes('long')) {
        return `<span class="tv-kw-highlight tv-kw-gold-buy">${match}</span>`;
      }
      if (lower.includes('sell') || lower.includes('short')) {
        return `<span class="tv-kw-highlight tv-kw-gold-sell">${match}</span>`;
      }
      if (lower.includes('exit') || lower.includes('close')) {
        return `<span class="tv-kw-highlight tv-kw-gold-exit">${match}</span>`;
      }
      if (lower.includes('ctc')) {
        return `<span class="tv-kw-highlight tv-kw-gold-ctc">${match}</span>`;
      }
      if (lower.includes('sl')) {
        return `<span class="tv-kw-highlight tv-kw-gold-sl">${match}</span>`;
      }
      if (lower.includes('tp')) {
        return `<span class="tv-kw-highlight tv-kw-gold-tp">${match}</span>`;
      }
    }
    if (lower.includes('buy') || lower.includes('long')) {
      return `<span class="tv-kw-highlight tv-kw-buy">${match}</span>`;
    }
    if (lower.includes('sell') || lower.includes('short')) {
      return `<span class="tv-kw-highlight tv-kw-sell">${match}</span>`;
    }
    if (lower.includes('exit') || lower.includes('close')) {
      return `<span class="tv-kw-highlight tv-kw-exit">${match}</span>`;
    }
    if (lower.includes('ctc')) {
      return `<span class="tv-kw-highlight tv-kw-ctc">${match}</span>`;
    }
    if (lower.includes('sl')) {
      return `<span class="tv-kw-highlight tv-kw-sl">${match}</span>`;
    }
    if (lower.includes('tp')) {
      return `<span class="tv-kw-highlight tv-kw-tp">${match}</span>`;
    }
    return match;
  });
}

function buildCard(notif) {
  // Use original Telegram message timestamp if available; otherwise fallback to receivedAt
  let ts;
  const rawTgDate = notif.telegramDate || notif.telegram_date || notif.extra?.telegram_date || notif.extra?.telegramDate;
  if (rawTgDate) {
    const parsedTg = new Date(rawTgDate);
    if (!isNaN(parsedTg.getTime())) {
      ts = parsedTg;
    }
  }
  if (!ts) {
    ts = notif.receivedAt?.toDate ? notif.receivedAt.toDate() : new Date();
  }

  const timeStr = ts.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const dateStr = ts.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short'
  });

  const actionClass = {
    BUY: 'tv-badge-buy', LONG: 'tv-badge-buy',
    SELL: 'tv-badge-sell', SHORT: 'tv-badge-sell',
    CLOSE: 'tv-badge-close', EXIT: 'tv-badge-exit',
    CTC: 'tv-badge-ctc', BE: 'tv-badge-ctc', BREAKEVEN: 'tv-badge-ctc',
    SL: 'tv-badge-sl', STOPLOSS: 'tv-badge-sl',
    TP: 'tv-badge-tp', TAKEPROFIT: 'tv-badge-tp', TARGET: 'tv-badge-tp',
  }[notif.action] || 'tv-badge-alert';

  const symbolHtml = notif.symbol
    ? `<span class="tv-symbol-badge">${notif.symbol}${notif.interval ? ' · ' + notif.interval : ''}</span>`
    : '';

  const priceVal = notif.price ?? notif.extra?.price;
  const priceHtml = priceVal != null
    ? `<span class="tv-price-pill">${Number(priceVal).toLocaleString('en-IN')}</span>`
    : '';

  const strategyHtml = notif.strategy
    ? `<span class="tv-strategy-label">${notif.strategy}</span>`
    : '';

  // Extract Trade Levels (SL, TP, Summary)
  const slVal = notif.sl ?? notif.extra?.sl;
  const targetsVal = notif.targets ?? notif.extra?.targets;
  const summaryText = notif.summary ?? notif.extra?.summary;
  const imageSrc = notif.image || notif.imageUrl || notif.extra?.image || notif.extra?.imageUrl;

  let levelsHtml = '';
  if (slVal || targetsVal || priceVal != null) {
    const tpStr = Array.isArray(targetsVal) ? targetsVal.join(', ') : (targetsVal || '—');
    
    // Calculate Risk:Reward if numbers exist
    let rrHtml = '';
    if (priceVal && slVal && targetsVal) {
      const p = parseFloat(priceVal);
      const s = parseFloat(slVal);
      const t = Array.isArray(targetsVal) ? parseFloat(targetsVal[0]) : parseFloat(targetsVal);
      if (!isNaN(p) && !isNaN(s) && !isNaN(t) && Math.abs(p - s) > 0) {
        const risk = Math.abs(p - s);
        const reward = Math.abs(t - p);
        const rr = (reward / risk).toFixed(1);
        rrHtml = `<span class="tv-level-pill tv-pill-rr" title="Risk to Reward Ratio">🎯 R:R 1:${rr}</span>`;
      }
    }

    levelsHtml = `
      <div class="tv-card-levels-grid">
        ${priceVal != null ? `<span class="tv-level-pill tv-pill-entry">Entry: <strong>${priceVal}</strong></span>` : ''}
        ${slVal ? `<span class="tv-level-pill tv-pill-sl">SL: <strong>${slVal}</strong></span>` : ''}
        ${targetsVal ? `<span class="tv-level-pill tv-pill-tp">TP: <strong>${tpStr}</strong></span>` : ''}
        ${rrHtml}
      </div>
    `;
  }

  // AI Summary / Insight HTML
  let summaryHtml = '';
  if (summaryText) {
    summaryHtml = `
      <div class="tv-card-insight-box">
        <div class="tv-insight-header">💡 Setup Insight</div>
        <div class="tv-insight-body">${escHtml(summaryText)}</div>
      </div>
    `;
  }

  // Chart Screenshot HTML
  let imageHtml = '';
  if (imageSrc) {
    imageHtml = `
      <div class="tv-card-chart-preview" title="Click to view full chart screenshot">
        <div class="tv-chart-preview-header">📸 Telegram Chart Screenshot</div>
        <img src="${imageSrc}" class="tv-chart-thumbnail" alt="Signal Chart" loading="lazy" />
      </div>
    `;
  }

  // Resolve raw text & cleanly extract main message
  let rawText = notif.raw || '';
  if (typeof rawText === 'string' && rawText.trim().startsWith('{')) {
    try {
      const parsedObj = JSON.parse(rawText);
      if (parsedObj.raw) {
        rawText = parsedObj.raw;
      } else if (parsedObj.summary || parsedObj.keyword || parsedObj.message) {
        rawText = parsedObj.summary || parsedObj.keyword || parsedObj.message || '';
      }
    } catch (e) {}
  }

  // For Telegram source alerts, show the original channel message as the main text
  let mainMsg = '';
  if (notif.source === 'telegram') {
    if (rawText) {
      const dashIdx = rawText.indexOf(' - ');
      mainMsg = dashIdx !== -1 ? rawText.slice(dashIdx + 3).trim() : rawText.trim();
    }
    if (!mainMsg) mainMsg = notif.strategy || 'Telegram Alert';
  } else {
    mainMsg = notif.strategy || (rawText ? rawText.slice(0, 120) : 'Alert received');
  }

  // Signal Classification for Highlighting
  const symUpper = (notif.symbol || '').toUpperCase();
  const actUpper = (notif.action || '').toUpperCase();
  const msgLower = (mainMsg || '').toLowerCase();
  
  const isGold = symUpper.includes('GOLD') || symUpper.includes('XAU') || msgLower.includes('gold');
  const isBuy  = ['BUY', 'LONG'].includes(actUpper) || /\b(buy|long)\b/i.test(mainMsg);
  const isSell = ['SELL', 'SHORT'].includes(actUpper) || /\b(sell|short)\b/i.test(mainMsg);
  const isExit = ['EXIT', 'CLOSE'].includes(actUpper) || /\b(exit|close)\b/i.test(mainMsg);
  const isCtc  = ['CTC', 'BE', 'BREAKEVEN'].includes(actUpper) || /\b(ctc|cost to cost|breakeven)\b/i.test(mainMsg);
  const isSl   = ['SL', 'STOPLOSS', 'STOP LOSS'].includes(actUpper) || /\b(sl|stop\s*loss|sl\s+triggered)\b/i.test(mainMsg);
  const isTp   = ['TP', 'TAKEPROFIT', 'TAKE PROFIT', 'TARGET'].includes(actUpper) || /\b(tp|take\s*profit|tp\s*hit|target\s*hit)\b/i.test(mainMsg);

  let signalClass = '';
  let signalBadgeHtml = '';

  if (isGold) {
    if (isBuy) {
      signalClass = 'tv-card-gold-buy';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-buy-badge">🟢 GOLD BUY</span>';
    } else if (isSell) {
      signalClass = 'tv-card-gold-sell';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-sell-badge">🔴 GOLD SELL</span>';
    } else if (isExit) {
      signalClass = 'tv-card-gold-exit';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-exit-badge">🚪 GOLD EXIT</span>';
    } else if (isCtc) {
      signalClass = 'tv-card-gold-ctc';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-ctc-badge">⚖️ GOLD CTC</span>';
    } else if (isSl) {
      signalClass = 'tv-card-gold-sl';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-sl-badge">🛑 GOLD SL</span>';
    } else if (isTp) {
      signalClass = 'tv-card-gold-tp';
      signalBadgeHtml = '<span class="tv-gold-signal-badge tv-gold-tp-badge">🎯 GOLD TP</span>';
    }
  } else {
    if (isBuy) {
      signalClass = 'tv-card-signal-buy';
    } else if (isSell) {
      signalClass = 'tv-card-signal-sell';
    } else if (isExit) {
      signalClass = 'tv-card-signal-exit';
    } else if (isCtc) {
      signalClass = 'tv-card-signal-ctc';
    } else if (isSl) {
      signalClass = 'tv-card-signal-sl';
    } else if (isTp) {
      signalClass = 'tv-card-signal-tp';
    }
  }

  const card = document.createElement('div');
  card.className = `tv-notif-card ${notif.read ? 'tv-notif-read' : 'tv-notif-unread'} ${signalClass}`;
  card.dataset.action = notif.action || 'ALERT';

  card.innerHTML = `
    <div class="tv-card-border-bar"></div>
    <div class="tv-card-body">
      <div class="tv-card-top-row">
        <div class="tv-card-badges">
          <span class="tv-action-badge ${actionClass}">${notif.action || 'ALERT'}</span>
          ${signalBadgeHtml}
          ${symbolHtml}
          ${priceHtml}
        </div>
        <div class="tv-card-time">
          <span>${dateStr}</span>
          <span>${timeStr}</span>
        </div>
      </div>
      <div class="tv-card-message ${signalClass ? 'tv-signal-message' : ''}">${formatMessageWithHighlights(mainMsg)}</div>
      ${levelsHtml}
      ${summaryHtml}
      ${imageHtml}
      ${strategyHtml}
      <details class="tv-raw-details">
        <summary>Raw message</summary>
        <pre class="tv-raw-pre">${escHtml(notif.raw || '')}</pre>
      </details>
      <div class="tv-card-actions">
        <button class="btn-small tv-delete-btn" data-id="${notif.id}">Delete</button>
      </div>
    </div>
  `;

  // Mark read on click
  card.addEventListener('click', () => {
    if (!notif.read) markTvNotificationRead(notif.id).catch(() => {});
  });

  // Expand image in full popup on click
  const imgEl = card.querySelector('.tv-chart-thumbnail');
  if (imgEl) {
    imgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openImageModal(imageSrc, `${notif.symbol || 'Alert'} ${notif.action || ''} Chart`);
    });
  }

  card.querySelector('.tv-delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteTvNotification(notif.id).catch(() => {});
  });

  return card;
}

function openImageModal(src, title) {
  let modal = document.getElementById('tv-chart-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tv-chart-modal';
    modal.className = 'tv-chart-modal-overlay';
    modal.innerHTML = `
      <div class="tv-chart-modal-content">
        <div class="tv-chart-modal-header">
          <span id="tv-modal-title" style="font-weight:700; color:var(--text-color);"></span>
          <button id="tv-modal-close" class="tv-modal-close-btn">&times;</button>
        </div>
        <div class="tv-chart-modal-body">
          <img id="tv-modal-img" src="" alt="Full Chart" />
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#tv-modal-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
  modal.querySelector('#tv-modal-title').textContent = title || 'Chart Screenshot';
  modal.querySelector('#tv-modal-img').src = src;
  modal.classList.add('active');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===================== Unread Badge =====================
function updateUnreadBadge() {
  const count = (state.tvNotifications || []).filter(n => !n.read).length;
  if (!unreadBadge) return;
  if (count > 0) {
    unreadBadge.textContent = count > 99 ? '99+' : count;
    unreadBadge.classList.remove('hidden');
  } else {
    unreadBadge.classList.add('hidden');
  }
}

// ===================== Settings — Token Setup =====================
async function initTokenSettingsUI() {
  if (!tokenSetupSection) return;

  let unsubscribePrefs = null;
  const subscribePrefsFromDB = (uid) => {
    if (!uid) return;
    if (unsubscribePrefs) unsubscribePrefs();
    
    unsubscribePrefs = db.collection('users').doc(uid)
      .collection('settings').doc('preferences')
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const tgToken = document.getElementById('settings-tg-token');
          const tgChat  = document.getElementById('settings-tg-chatid');
          const seqMult = document.getElementById('settings-seq-multiplier');
          
          if (tgToken) tgToken.value = data.telegram?.botToken || '';
          if (tgChat) tgChat.value = data.telegram?.chatId || '';
          if (seqMult && data.sequenceTimeoutMultiplier !== undefined) {
            seqMult.value = data.sequenceTimeoutMultiplier;
          }

          // Load alert notification toggle preference
          const alertNotifToggle = document.getElementById('settings-alert-notif-toggle');
          alertNotifsEnabled = data.alertNotificationsEnabled === true;
          if (alertNotifToggle) alertNotifToggle.checked = alertNotifsEnabled;
        }
      }, (err) => {
        console.error('Error listening to preferences updates', err);
      });
  };

  const loadPrefsFromDB = async (uid) => {
    if (!uid) return;
    try {
      storedToken = await loadWebhookToken();
      if (storedToken) {
        tokenSetupSection.classList.add('hidden');
        tokenActiveSection?.classList.remove('hidden');
        renderMaskedUrl(storedToken);
      } else {
        tokenSetupSection.classList.remove('hidden');
        tokenActiveSection?.classList.add('hidden');
      }
    } catch (err) {
      console.error('Error loading token details', err);
    }
  };

  // Bind on startup if user is logged in
  if (state.currentUser?.uid) {
    loadPrefsFromDB(state.currentUser.uid);
    subscribePrefsFromDB(state.currentUser.uid);
  }

  // Reload when auth state changes (crucial for refresh/login loading)
  window.addEventListener('auth-changed', (e) => {
    if (e.detail.loggedIn && e.detail.user?.uid) {
      loadPrefsFromDB(e.detail.user.uid);
      subscribePrefsFromDB(e.detail.user.uid);
    } else {
      if (unsubscribePrefs) {
        unsubscribePrefs();
        unsubscribePrefs = null;
      }
    }
  });

  // Telegram Config Save
  const tgSaveBtn = document.getElementById('settings-tg-save-btn');
  if (tgSaveBtn) {
    tgSaveBtn.onclick = async () => {
      console.log('tgSaveBtn clicked');
      const uid = state.currentUser?.uid;
      if (!uid) {
        showToast('Please login first');
        return;
      }
      const tgToken = document.getElementById('settings-tg-token').value.trim();
      const tgChat  = document.getElementById('settings-tg-chatid').value.trim();
      tgSaveBtn.disabled = true;
      try {
        await db.collection('users').doc(uid)
          .collection('settings').doc('preferences')
          .set({
            telegram: {
              botToken: tgToken || null,
              chatId: tgChat || null
            }
          }, { merge: true });
        showToast('Telegram configuration saved ✓');
      } catch (err) {
        showToast('Failed to save Telegram config');
      } finally {
        tgSaveBtn.disabled = false;
      }
    };
  }

  // Send Telegram Test Message
  const tgTestBtn = document.getElementById('settings-tg-test-btn');
  if (tgTestBtn) {
    tgTestBtn.onclick = async () => {
      console.log('tgTestBtn clicked');
      const tgToken = document.getElementById('settings-tg-token').value.trim();
      const tgChat  = document.getElementById('settings-tg-chatid').value.trim();
      if (!tgToken || !tgChat) {
        showToast('Please enter both token and chat ID first');
        return;
      }
      tgTestBtn.disabled = true;
      try {
        const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChat,
            text: '📡 <b>Trading Journal</b>: This is a test message. Integration successful! 🎯',
            parse_mode: 'HTML'
          })
        });
        if (resp.ok) {
          showToast('Test message sent successfully!');
        } else {
          showToast('Failed to send test. Verify token / chat ID');
        }
      } catch (err) {
        showToast('Test failed: ' + err.message);
      } finally {
        tgTestBtn.disabled = false;
      }
    };
  }

  // Sequence Multiplier Save
  const seqSaveBtn = document.getElementById('settings-seq-save-btn');
  if (seqSaveBtn) {
    seqSaveBtn.onclick = async () => {
      console.log('seqSaveBtn clicked');
      const uid = state.currentUser?.uid;
      if (!uid) {
        showToast('Please login first');
        return;
      }
      const mult = parseInt(document.getElementById('settings-seq-multiplier').value, 10);
      if (isNaN(mult) || mult < 1) {
        showToast('Please enter a valid multiplier >= 1');
        return;
      }
      seqSaveBtn.disabled = true;
      try {
        await db.collection('users').doc(uid)
          .collection('settings').doc('preferences')
          .set({ sequenceTimeoutMultiplier: mult }, { merge: true });
        showToast('Sequence timeout updated ✓');
      } catch (err) {
        showToast('Failed to save timeout');
      } finally {
        seqSaveBtn.disabled = false;
      }
    };
  }

  // Alert Notification Toggle — auto-save on change
  const alertNotifToggle = document.getElementById('settings-alert-notif-toggle');
  if (alertNotifToggle) {
    alertNotifToggle.addEventListener('change', async () => {
      const uid = state.currentUser?.uid;
      if (!uid) { showToast('Please login first'); return; }
      alertNotifsEnabled = alertNotifToggle.checked;

      // Request permission if enabling
      if (alertNotifsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          alertNotifsEnabled = false;
          alertNotifToggle.checked = false;
          showToast('⚠️ Notification permission denied');
          return;
        }
      }

      try {
        await db.collection('users').doc(uid)
          .collection('settings').doc('preferences')
          .set({ alertNotificationsEnabled: alertNotifsEnabled }, { merge: true });
        showToast(alertNotifsEnabled ? 'Alert notifications enabled ✓' : 'Alert notifications disabled');
      } catch (err) {
        showToast('Failed to save preference');
      }
    });
  }

  // Generate first token
  if (generateTokenBtn) {
    generateTokenBtn.onclick = async () => {
      await doGenerateToken(null);
    };
  }

  // Regenerate (rotate) token
  if (regenerateTokenBtn) {
    regenerateTokenBtn.onclick = async () => {
      if (!confirm('Regenerate token? The old webhook URL will stop working immediately.')) return;
      await doGenerateToken(storedToken);
    };
  }

  // Copy URL
  if (copyUrlBtn) {
    copyUrlBtn.onclick = () => {
      const url = buildWebhookUrl(storedToken);
      navigator.clipboard.writeText(url).then(() => showToast('Webhook URL copied!'));
    };
  }

  // Reveal/hide token
  if (tokenRevealBtn) {
    tokenRevealBtn.onclick = () => {
      tokenRevealed = !tokenRevealed;
      renderMaskedUrl(storedToken);
    };
  }
}

async function doGenerateToken(oldToken) {
  const btn = oldToken ? regenerateTokenBtn : generateTokenBtn;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const newToken = generateToken();
    await saveWebhookToken(newToken, oldToken);
    storedToken = newToken;
    tokenSetupSection?.classList.add('hidden');
    tokenActiveSection?.classList.remove('hidden');
    tokenRevealed = true;
    renderMaskedUrl(newToken);
    showToast(oldToken ? 'Token regenerated ✓' : 'Webhook set up ✓');
  } catch (e) {
    console.error(e);
    showToast('Failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldToken ? 'Regenerate Token' : 'Set Up Webhook'; }
  }
}

function renderMaskedUrl(token) {
  if (!webhookUrlText) return;
  const url = buildWebhookUrl(token);
  if (tokenRevealed) {
    webhookUrlText.textContent = url;
    if (tokenRevealBtn) tokenRevealBtn.textContent = 'Hide';
  } else {
    // Show base URL clearly, mask just the token value
    const masked = url.replace(token, '••••••••••••••••');
    webhookUrlText.textContent = masked;
    if (tokenRevealBtn) tokenRevealBtn.textContent = 'Reveal';
  }
}

// Auto-init on import
initTvNotificationsUI();
