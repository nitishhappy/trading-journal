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

  // Live updates
  window.addEventListener('tv-notifications-updated', () => {
    renderFeed();
    updateUnreadBadge();
    // Toast when new unread arrives (app is open)
    const newest = state.tvNotifications[0];
    if (newest && !newest.read) {
      const ts = newest.receivedAt?.toDate ? newest.receivedAt.toDate() : new Date();
      const age = Date.now() - ts.getTime();
      if (age < 5000) { // only toast if truly just received
        const label = [newest.symbol, newest.action, newest.strategy].filter(Boolean).join(' · ');
        showToast(`📡 TradingView alert: ${label || newest.raw?.slice(0, 60) || 'New alert'}`, 6000);
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
function renderFeed() {
  if (!notifFeed) return;

  let items = state.tvNotifications || [];

  // Filter
  if (currentFilter !== 'ALL') {
    items = items.filter(n => n.action === currentFilter);
  }

  if (items.length === 0) {
    notifFeed.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  notifFeed.innerHTML = '';
  items.forEach(notif => {
    notifFeed.appendChild(buildCard(notif));
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

  const priceHtml = notif.price != null
    ? `<span class="tv-price-pill">₹${Number(notif.price).toLocaleString('en-IN')}</span>`
    : '';

  const strategyHtml = notif.strategy
    ? `<span class="tv-strategy-label">${notif.strategy}</span>`
    : '';

  // Main message: use strategy or raw, truncated
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

  // Mark read on expand or click
  card.addEventListener('click', () => {
    if (!notif.read) markTvNotificationRead(notif.id).catch(() => {});
  });

  card.querySelector('.tv-delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteTvNotification(notif.id).catch(() => {});
  });

  return card;
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

      const doc = await db.collection('users').doc(uid)
        .collection('settings').doc('preferences').get();
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
      }
    } catch (err) {
      console.error('Error loading settings details', err);
    }
  };

  // Bind on startup if user is logged in
  if (state.currentUser?.uid) {
    loadPrefsFromDB(state.currentUser.uid);
  }

  // Reload when auth state changes (crucial for refresh/login loading)
  window.addEventListener('auth-changed', (e) => {
    if (e.detail.loggedIn && e.detail.user?.uid) {
      loadPrefsFromDB(e.detail.user.uid);
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
