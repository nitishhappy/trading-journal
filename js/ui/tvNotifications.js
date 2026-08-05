import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import {
  markTvNotificationRead,
  deleteTvNotification,
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
    }
  });

  // Settings tab token management
  window.addEventListener('settings-opened', () => {
    initTokenSettingsUI();
  });
}

// ===================== Feed Rendering =====================
// Track expanded state per symbol (collapsed by default for a compact view)
const expandedSymbols = new Set();

function renderFeed() {
  if (!notifFeed) return;

  let items = state.tvNotifications || [];

  // Filter by Action if selected
  if (currentFilter !== 'ALL') {
    items = items.filter(n => n.action === currentFilter);
  }

  if (items.length === 0) {
    notifFeed.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  // Group notifications by symbol
  const groups = {};
  items.forEach(notif => {
    const sym = (notif.symbol || 'GENERAL').toUpperCase().trim();
    if (!groups[sym]) groups[sym] = [];
    groups[sym].push(notif);
  });

  notifFeed.innerHTML = '';

  // Render each symbol pane
  Object.keys(groups).forEach(symbol => {
    const symbolItems = groups[symbol];
    const hasUnread = symbolItems.some(n => !n.read);
    const unreadCount = symbolItems.filter(n => !n.read).length;
    const isExpanded = expandedSymbols.has(symbol);

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

    // Build cards inside accordion body
    symbolItems.forEach(notif => {
      bodyEl.appendChild(buildCard(notif));
    });

    // Toggle expand/collapse state on header click
    headerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expandedSymbols.has(symbol)) {
        expandedSymbols.delete(symbol);
        bodyEl.classList.add('collapsed');
        pane.querySelector('.tv-collapse-icon').textContent = '▶';
      } else {
        expandedSymbols.add(symbol);
        bodyEl.classList.remove('collapsed');
        pane.querySelector('.tv-collapse-icon').textContent = '▼';
      }
    });

    notifFeed.appendChild(pane);
  });
}

function formatRelativeTime(receivedAt) {
  if (!receivedAt) return '';
  const ts = receivedAt.toDate ? receivedAt.toDate() : new Date(receivedAt);
  return ts.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function buildCard(notif) {
  const card = document.createElement('div');
  card.className = `tv-notif-card ${notif.read ? 'tv-notif-read' : 'tv-notif-unread'}`;
  card.dataset.action = notif.action || 'ALERT';

  const ts = notif.receivedAt?.toDate ? notif.receivedAt.toDate() : new Date();
  const timeStr = ts.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const dateStr = ts.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short'
  });

  const actionClass = {
    BUY: 'tv-badge-buy', LONG: 'tv-badge-buy',
    SELL: 'tv-badge-sell', SHORT: 'tv-badge-sell',
    CLOSE: 'tv-badge-close', EXIT: 'tv-badge-close',
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

  // Main message
  const mainMsg = notif.strategy || notif.raw?.slice(0, 120) || 'Alert received';

  card.innerHTML = `
    <div class="tv-card-border-bar"></div>
    <div class="tv-card-body">
      <div class="tv-card-top-row">
        <div class="tv-card-badges">
          <span class="tv-action-badge ${actionClass}">${notif.action || 'ALERT'}</span>
          ${symbolHtml}
          ${priceHtml}
        </div>
        <div class="tv-card-time">
          <span>${dateStr}</span>
          <span>${timeStr}</span>
        </div>
      </div>
      <div class="tv-card-message">${mainMsg}</div>
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
