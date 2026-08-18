/**
 * AI Co-Pilot & ML Coherence Dashboard UI Controller for Trading Journal
 * Includes Screen-level System Notifications & Telegram Channel Push Integration
 */

let copilotAsset = 'nifty'; // 'nifty' | 'gold'
let copilotFilter = 'high'; // 'high' = only >=50% WR, 'all' = all actionable trades

let copilotNotifsEnabled = localStorage.getItem('copilot_notifs_enabled') === 'true';
let copilotTgEnabled = localStorage.getItem('copilot_tg_enabled') === 'true';
let lastNotifiedTradeIds = new Set(JSON.parse(localStorage.getItem('copilot_notified_ids') || '[]'));

// 1. Toggle Browser/System Notifications directly from this screen
async function toggleCopilotNotifications(enabled) {
  copilotNotifsEnabled = enabled;
  localStorage.setItem('copilot_notifs_enabled', enabled ? 'true' : 'false');

  if (enabled && typeof Notification !== 'undefined') {
    if (Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      if (res !== 'granted') {
        copilotNotifsEnabled = false;
        localStorage.setItem('copilot_notifs_enabled', 'false');
        syncTogglesUI();
        alert('⚠️ Notification permission was denied in your browser settings.');
        return;
      }
    }
  }

  if (window.showToast) {
    window.showToast(enabled ? '🔔 AI Co-Pilot Alerts Enabled ✓' : 'AI Co-Pilot Alerts Disabled');
  }
}

// 2. Toggle Telegram Push directly from this screen
async function toggleCopilotTelegram(enabled) {
  copilotTgEnabled = enabled;
  localStorage.setItem('copilot_tg_enabled', enabled ? 'true' : 'false');

  if (enabled) {
    // Check if Telegram credentials exist in localStorage or Settings
    const tgConfig = getTelegramCredentials();
    if (!tgConfig.token || !tgConfig.chatId) {
      const tokenPrompt = prompt('Enter your Telegram Bot Token (e.g. 123456:ABC-DEF):', tgConfig.token || '');
      if (tokenPrompt) {
        const chatIdPrompt = prompt('Enter your Telegram Chat ID / Channel (e.g. -100123456 or @mychannel):', tgConfig.chatId || '');
        if (chatIdPrompt) {
          localStorage.setItem('settings_tg_token', tokenPrompt.trim());
          localStorage.setItem('settings_tg_chatid', chatIdPrompt.trim());
          if (window.showToast) window.showToast('Telegram credentials configured ✓');
        } else {
          copilotTgEnabled = false;
          localStorage.setItem('copilot_tg_enabled', 'false');
          syncTogglesUI();
          return;
        }
      } else {
        copilotTgEnabled = false;
        localStorage.setItem('copilot_tg_enabled', 'false');
        syncTogglesUI();
        return;
      }
    }
  }

  if (window.showToast) {
    window.showToast(enabled ? '✈️ Telegram Channel Push Enabled ✓' : 'Telegram Push Disabled');
  }
}

// Bind functions immediately to window
window.toggleCopilotNotifications = toggleCopilotNotifications;
window.toggleCopilotTelegram = toggleCopilotTelegram;

function initAICoPilotView() {
  syncTogglesUI();
  renderAICoPilot();
  checkAndNotifyNewTrades();
}

function syncTogglesUI() {
  const notifToggle = document.getElementById('copilot-notif-toggle');
  const tgToggle = document.getElementById('copilot-tg-toggle');
  if (notifToggle) notifToggle.checked = copilotNotifsEnabled;
  if (tgToggle) tgToggle.checked = copilotTgEnabled;
}

// Helper to retrieve Telegram credentials
function getTelegramCredentials() {
  const tokenInput = document.getElementById('settings-tg-token');
  const chatInput = document.getElementById('settings-tg-chatid');

  const token = (tokenInput && tokenInput.value.trim()) || localStorage.getItem('settings_tg_token') || '7860439401:AAH8N_2TfX_M1m0w7s3U9PqJ_Example';
  const chatId = (chatInput && chatInput.value.trim()) || localStorage.getItem('settings_tg_chatid') || '';

  return { token, chatId };
}

// Dispatch Telegram Message via Telegram Bot API
async function sendTelegramMessage(text) {
  try {
    const { token, chatId } = getTelegramCredentials();
    if (!token || !chatId) return false;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    return resp.ok;
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return false;
  }
}

// Detect and notify when a new trade appears
function checkAndNotifyNewTrades() {
  const allActionable = [
    ...(window.niftyActionableTrades || []).map(t => ({ ...t, asset: 'NIFTY 50' })),
    ...(window.goldActionableTrades || []).map(t => ({ ...t, asset: 'GOLD (XAU/USD)' }))
  ];

  if (allActionable.length === 0) return;

  const newestTrades = allActionable.slice(0, 10);
  let updatedIds = false;

  newestTrades.forEach(trade => {
    const tradeKey = `${trade.asset}_${trade.id || trade.timestamp}_${trade.action}`;
    if (!lastNotifiedTradeIds.has(tradeKey)) {
      lastNotifiedTradeIds.add(tradeKey);
      updatedIds = true;

      // Only notify if system or telegram alerts are turned on
      const spotStr = trade.asset.includes('GOLD') ? `$${trade.spot_price}` : trade.spot_price;
      const title = `🚨 [AI CO-PILOT] ${trade.action} on ${trade.asset}`;
      const msg = `⚡ Action: ${trade.action}\n📍 Spot: ${spotStr}\n🎯 TP: ${trade.predicted_tp || '—'} | 🛑 SL: ${trade.predicted_sl || '—'}\n📊 R:R: ${trade.risk_reward || '1:1.8'}\n🔥 Rule Conf: ${trade.rule_confidence}% | ML Conf: ${trade.ml_confidence}%`;

      // 1. Browser Notification
      if (copilotNotifsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: `${trade.action} at ${spotStr} | TP: ${trade.predicted_tp} | SL: ${trade.predicted_sl}`,
            icon: './icons/icon-192.png',
            tag: `copilot-${tradeKey}`
          });
        } catch (e) {}
      }

      // 2. Telegram Channel Push
      if (copilotTgEnabled) {
        const tgHtml = `<b>🚨 [AI CO-PILOT NEW TRADE]</b>\n\n` +
          `<b>Asset:</b> ${trade.asset}\n` +
          `<b>Action:</b> <code>${trade.action}</code>\n` +
          `<b>Spot Price:</b> <code>${spotStr}</code>\n` +
          `<b>Stop Loss:</b> <code>${trade.predicted_sl || '—'}</code>\n` +
          `<b>Target (TP):</b> <code>${trade.predicted_tp || '—'}</code>\n` +
          `<b>Risk-Reward:</b> <code>${trade.risk_reward || '1:1.8'}</code>\n` +
          `<b>AI Rule Conf:</b> <code>${trade.rule_confidence}%</code>\n` +
          `<b>ML Conf:</b> <code>${trade.ml_confidence}%</code>\n` +
          `<b>Timestamp:</b> ${trade.timestamp}\n\n` +
          `<i>⚡ Live AI 15M Self-Learning Signal</i>`;
        
        sendTelegramMessage(tgHtml);
      }
    }
  });

  if (updatedIds) {
    // Keep max 100 IDs in localStorage
    const idArr = Array.from(lastNotifiedTradeIds).slice(-100);
    localStorage.setItem('copilot_notified_ids', JSON.stringify(idArr));
  }
}

function switchCopilotAsset(asset) {
  copilotAsset = asset;
  document.getElementById('copilot-tab-nifty')?.classList.toggle('active', asset === 'nifty');
  document.getElementById('copilot-tab-gold')?.classList.toggle('active', asset === 'gold');
  renderAICoPilot();
}

function setCopilotFilter(filterMode) {
  copilotFilter = filterMode;
  document.getElementById('copilot-filter-high')?.classList.toggle('active', filterMode === 'high');
  document.getElementById('copilot-filter-all')?.classList.toggle('active', filterMode === 'all');
  renderAICoPilot();
}

function renderCopilotMarkdown(md) {
  if (!md) return '<p style="color: var(--text-muted, #64748b);">No detailed report available for this entry.</p>';
  let html = md
    .replace(/^### (.*$)/gim, '<h3 style="color:#f8fafc; font-size:13px; margin:8px 0 4px;">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 style="color:#38bdf8; font-size:12px; margin:6px 0 3px;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="color:#f1f5f9;">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em style="color:#cbd5e1;">$1</em>')
    .replace(/`([^`]+)`/gim, '<code style="background:rgba(255,255,255,0.08); padding:1px 4px; border-radius:3px; font-family:monospace; color:#38bdf8;">$1</code>')
    .replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-bottom:3px; color:#cbd5e1;">$1</li>')
    .replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom:3px; color:#cbd5e1;">$1</li>')
    .replace(/---/gim, '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;">');

  html = html.replace(/(<li[\s\S]*?<\/li>)/gm, '<ul style="padding-left:18px; margin:4px 0;">$1</ul>');
  html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');
  return html;
}

function selectCopilotRow(originalIndex, domIndex) {
  document.querySelectorAll('.copilot-clickable-row').forEach(r => r.classList.remove('selected-row'));
  const rowElem = document.getElementById(`copilot-row-${domIndex}`);
  if (rowElem) rowElem.classList.add('selected-row');

  const rawData = copilotAsset === 'nifty' ? (window.niftyActionableTrades || []) : (window.goldActionableTrades || []);
  const rowData = rawData[originalIndex];
  if (rowData) {
    const tagElem = document.getElementById('copilot-inspector-tag');
    const contentElem = document.getElementById('copilot-inspector-content');
    if (tagElem) tagElem.textContent = `${rowData.timestamp} • ${rowData.action}`;
    if (contentElem) contentElem.innerHTML = renderCopilotMarkdown(rowData.analysis_report);
  }
}

function renderAICoPilot() {
  syncTogglesUI();
  const isNifty = copilotAsset === 'nifty';
  const rawData = isNifty ? (window.niftyActionableTrades || []) : (window.goldActionableTrades || []);
  const summary = isNifty ? (window.niftyMLSummary || {}) : (window.goldMLSummary || {});
  const coherence = isNifty ? (window.niftyCoherenceMatrix || []) : (window.goldCoherenceMatrix || []);

  // Update Top Metrics Cards
  const totalElem = document.getElementById('copilot-stat-total');
  const resolvedElem = document.getElementById('copilot-stat-resolved');
  const winrateElem = document.getElementById('copilot-stat-winrate');
  const mlconfElem = document.getElementById('copilot-stat-mlconf');

  if (totalElem) totalElem.textContent = summary.total_predictions || 0;
  if (resolvedElem) resolvedElem.textContent = summary.resolved_trades || 0;
  if (winrateElem) winrateElem.textContent = summary.win_rate || 'Pending';
  if (mlconfElem) mlconfElem.textContent = summary.avg_ml_conf || '--';

  // Update Titles
  const cohTitle = document.getElementById('copilot-coherence-title');
  if (cohTitle) {
    cohTitle.textContent = isNifty 
      ? '📊 NIFTY 50: AI Rules vs ML Coherence Analytics Matrix'
      : '📊 GOLD (XAU/USD): AI Rules vs ML Coherence Analytics Matrix';
  }

  const tableTitle = document.getElementById('copilot-table-title');
  const tableSubtitle = document.getElementById('copilot-table-subtitle');
  if (tableTitle) {
    tableTitle.textContent = isNifty ? 'NIFTY High-Conviction Trades' : 'XAU/USD (Gold) High-Conviction Trades';
  }
  if (tableSubtitle) {
    tableSubtitle.textContent = copilotFilter === 'high' 
      ? '⚡ Showing Only Actionable Setups (Analytical WR ≥ 50%)' 
      : '⚡ Showing All Actionable Setups (LIFO)';
  }

  // Render Coherence Matrix
  const cohBody = document.getElementById('copilot-coherence-body');
  if (cohBody) {
    if (coherence && coherence.length > 0) {
      cohBody.innerHTML = coherence.map(row => {
        let winClass = 'color: #cbd5e1;';
        if (row.badge === 'green') winClass = 'color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.15); padding: 3px 8px; border-radius: 4px;';
        else if (row.badge === 'red') winClass = 'color: #fb7185; font-weight: 700; background: rgba(244, 63, 94, 0.12); padding: 3px 8px; border-radius: 4px;';

        const pnlColor = row.net_pnl && row.net_pnl.startsWith('+') ? '#34d399' : (row.net_pnl && row.net_pnl.startsWith('-') ? '#fb7185' : '#cbd5e1');

        return `
          <tr>
            <td style="font-weight: 600; color: #f8fafc;">${row.tier}</td>
            <td style="color: #38bdf8; font-family: monospace;">${row.condition}</td>
            <td style="color: #94a3b8; font-size: 11.5px;">${row.role}</td>
            <td>${row.trades}</td>
            <td><span style="${winClass}">${row.win_rate}</span></td>
            <td style="color: ${pnlColor}; font-weight: 600;">${row.net_pnl}</td>
            <td style="font-weight: 700; color: #fff;">${row.profit_factor}</td>
          </tr>
        `;
      }).join('');
    } else {
      cohBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 15px;">No coherence data available.</td></tr>';
    }
  }

  // Dynamic Live WR Resolver
  function getLiveWR(ai, ml) {
    if (!coherence || coherence.length === 0) return null;
    let matchedTier = null;
    if (ai >= 85 && ml >= 75) matchedTier = coherence[0];
    else if (ai >= 80 && ml >= 65) matchedTier = coherence[1];
    else if (ai >= 75 && ml >= 55) matchedTier = coherence[2];
    else if (ai >= 85 && ml < 50) matchedTier = coherence[3];
    else matchedTier = coherence[4] || coherence[coherence.length - 1];

    if (matchedTier && matchedTier.win_rate && matchedTier.win_rate !== 'N/A') {
      return parseFloat(matchedTier.win_rate.replace('%', ''));
    }
    return null;
  }

  // Process Rows
  let processedData = rawData.map((row, originalIndex) => {
    let analyticalWR = null;
    let isGlow = false;
    let wrHtml = '<span style="color: #64748b;">—</span>';

    if (row.action !== 'STAY IN CASH') {
      const ai = row.rule_confidence || 0;
      const ml = row.ml_confidence || 0;
      analyticalWR = getLiveWR(ai, ml);

      if (analyticalWR !== null) {
        if (analyticalWR >= 50.0) {
          isGlow = true;
          wrHtml = `<span class="badge-wr-high">🔥 ${analyticalWR}%</span>`;
        } else if (analyticalWR >= 35.0) {
          wrHtml = `<span class="badge-wr-mid">${analyticalWR}%</span>`;
        } else {
          wrHtml = `<span class="badge-wr-low">${analyticalWR}%</span>`;
        }
      }
    }

    return {
      ...row,
      analyticalWR: analyticalWR,
      isGlow: isGlow,
      wrHtml: wrHtml,
      originalIndex: originalIndex
    };
  });

  if (copilotFilter === 'high') {
    processedData = processedData.filter(r => r.analyticalWR !== null && r.analyticalWR >= 50.0);
  }

  const tbody = document.getElementById('copilot-ledger-body');
  if (tbody) {
    if (!processedData || processedData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 30px;">No High-Conviction (≥50% Win Rate) trades in current view. Click "All Actionable" to inspect all trades.</td></tr>`;
      const inspElem = document.getElementById('copilot-inspector-content');
      if (inspElem) inspElem.innerHTML = '<p style="color: #64748b; text-align: center; margin-top: 60px;">No high-conviction trades to display.</p>';
    } else {
      tbody.innerHTML = processedData.map((row, idx) => {
        let badgeClass = 'badge-cash';
        if (row.action === 'PE BUY' || row.action === 'SELL') badgeClass = 'badge-pe';
        else if (row.action === 'CE BUY' || row.action === 'BUY') badgeClass = 'badge-ce';

        let outcomeHtml = '<span class="outcome-pending">⏳ PENDING</span>';
        if (row.outcome_status === 'WIN') outcomeHtml = `<span class="outcome-win">✓ WIN (+${row.outcome_pnl_pts} pts)</span>`;
        else if (row.outcome_status === 'LOSS') outcomeHtml = `<span class="outcome-loss">✕ LOSS (${row.outcome_pnl_pts} pts)</span>`;
        else if (row.outcome_status === 'NEUTRAL') outcomeHtml = '<span style="color: #64748b;">— NEUTRAL</span>';

        const spotDisplay = !isNifty ? `$${row.spot_price}` : row.spot_price;
        const glowClass = row.isGlow ? 'glow-row' : '';

        // Clean Date and Time
        let dateStr = row.timestamp;
        if (row.timestamp && row.timestamp.includes(' ')) {
          const parts = row.timestamp.split(' ');
          const dPart = parts[0];
          const tPart = parts[1];
          const dObj = new Date(dPart);
          const formattedDate = !isNaN(dObj) ? dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : dPart;
          const shortTime = tPart.substring(0, 5);
          dateStr = `<span style="color: #94a3b8; font-size: 11px;">${formattedDate}</span> <strong style="color: #f8fafc;">${shortTime}</strong>`;
        }

        return `
          <tr id="copilot-row-${idx}" class="copilot-clickable-row ${glowClass} ${idx === 0 ? 'selected-row' : ''}" onclick="selectCopilotRow(${row.originalIndex}, ${idx})">
            <td style="white-space: nowrap;">${dateStr}</td>
            <td><span class="badge ${badgeClass}">${row.action}</span></td>
            <td style="font-weight: 600;">${spotDisplay}</td>
            <td style="color: #f43f5e;">${row.predicted_sl || '—'}</td>
            <td style="color: #10b981;">${row.predicted_tp || '—'}</td>
            <td><strong>${row.risk_reward || '—'}</strong></td>
            <td><span style="color: #10b981; font-weight: 600;">${row.rule_confidence}%</span></td>
            <td><span style="color: #38bdf8; font-weight: 600;">${row.ml_confidence}%</span></td>
            <td>${row.wrHtml}</td>
            <td>${outcomeHtml}</td>
          </tr>
        `;
      }).join('');

      selectCopilotRow(processedData[0].originalIndex, 0);
    }
  }
}

// Global exports
window.initAICoPilotView = initAICoPilotView;
window.switchCopilotAsset = switchCopilotAsset;
window.setCopilotFilter = setCopilotFilter;
window.renderAICoPilot = renderAICoPilot;
window.toggleCopilotNotifications = toggleCopilotNotifications;
window.toggleCopilotTelegram = toggleCopilotTelegram;

// Auto-check on data load
window.addEventListener('DOMContentLoaded', () => {
  syncTogglesUI();
  checkAndNotifyNewTrades();
});
