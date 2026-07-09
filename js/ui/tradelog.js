import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import { saveTrade, deleteTrade } from '../services/trades.js';
import {
  tradeSearchInput, tradeFilterFrom, tradeFilterTo, tradeFilterClear,
  tradeExportBtn, tradeAnalytics, tradeTableHead, tradeTableBody, tradeEmptyState,
  fabAddTrade, tradeModal, tradeModalTitle, tradeModalClose, tradeDate, tradeCapital,
  tradeNum, tradeGross, tradeNet, tradeDuration, tradeComments, tradeSaveBtn,
  tradeCancelBtn, tradeDeleteBtn
} from '../dom.js';

import { exportToCSV, exportToPDF, normalizeForJsonExport, downloadBlob, updateExportHintAndPreview } from '../utils/export.js';
import { escapeHtml } from '../utils/image.js';
import { renderLinkedChecklists } from './checklists.js';

// ===================== Event Listeners =====================

window.addEventListener('trades-updated', () => {
  if (state.activeView === "tradelog") {
    renderTradeTable();
  }
});

window.addEventListener('trades-unlocked', () => {
  renderTradeTable();
});

window.addEventListener('view-changed', (e) => {
  if (e.detail.view === "tradelog") {
    setTimeout(() => {
      if (typeof window.showTradeLock === "function") window.showTradeLock();
      if (!state.tradeLocked) renderTradeTable();
    }, 0);
  }
});

// Setup click on tradelog tab
const tradelogTab = document.querySelector('[data-view="tradelog"]');
if (tradelogTab) {
  tradelogTab.addEventListener("click", () => {
    setTimeout(() => {
      if (state.activeView === "tradelog") {
        if (typeof window.showTradeLock === "function") window.showTradeLock();
        if (!state.tradeLocked) renderTradeTable();
      }
    }, 0);
  });
}

// Search and filter listeners
if (tradeSearchInput) {
  tradeSearchInput.addEventListener("input", () => renderTradeTable());
}
if (tradeFilterFrom) {
  tradeFilterFrom.addEventListener("change", () => renderTradeTable());
}
if (tradeFilterTo) {
  tradeFilterTo.addEventListener("change", () => renderTradeTable());
}
if (tradeFilterClear) {
  tradeFilterClear.addEventListener("click", () => {
    tradeFilterFrom.value = "";
    tradeFilterTo.value = "";
    tradeSearchInput.value = "";
    renderTradeTable();
  });
}

// Add trade button
if (fabAddTrade) {
  fabAddTrade.addEventListener("click", () => openTradeModal());
}

if (tradeModalClose) tradeModalClose.addEventListener("click", () => tradeModal.classList.add("hidden"));
if (tradeCancelBtn) tradeCancelBtn.addEventListener("click", () => tradeModal.classList.add("hidden"));
if (tradeSaveBtn) {
  tradeSaveBtn.addEventListener("click", async () => {
    const date = tradeDate.value;
    const capital = parseFloat(tradeCapital.value) || 0;
    const tNum = parseInt(tradeNum.value) || 0;
    const gross = parseFloat(tradeGross.value) || 0;
    const net = parseFloat(tradeNet.value) || 0;
    const duration = parseInt(tradeDuration.value) || 0;
    const comments = tradeComments.value.trim();

    if (!date) {
      showToast("Date is required.");
      return;
    }

    // Link up checklist config log if chosen in dropdown
    const selectEl = document.getElementById("trade-checklist-select");
    const checklistLogId = selectEl ? selectEl.value || null : null;

    const data = {
      date,
      capital,
      tradeNum: tNum,
      gross,
      net,
      duration,
      comments,
      checklistLogId
    };

    tradeSaveBtn.disabled = true;
    tradeSaveBtn.textContent = "Saving…";

    try {
      await saveTrade(state.editingTradeId, data);
      tradeModal.classList.add("hidden");
      showToast(state.editingTradeId ? "Trade log updated" : "Trade log saved");
      renderTradeTable();
    } catch (err) {
      console.error(err);
      showToast("Could not save trade");
    } finally {
      tradeSaveBtn.disabled = false;
      tradeSaveBtn.textContent = "Save";
    }
  });
}

if (tradeDeleteBtn) {
  tradeDeleteBtn.addEventListener("click", async () => {
    if (!state.editingTradeId) return;
    if (!confirm("Delete this trade log entry?")) return;
    try {
      await deleteTrade(state.editingTradeId);
      tradeModal.classList.add("hidden");
      showToast("Trade deleted");
      renderTradeTable();
    } catch (err) {
      console.error(err);
      showToast("Could not delete trade");
    }
  });
}

// Export modal buttons wiring
const exportCancel = document.getElementById("export-cancel-btn");
const exportConfirm = document.getElementById("export-confirm-btn");
const exportRangeSelect = document.getElementById("export-range-select");
const exportFormatSelect = document.getElementById("export-format-select");

if (tradeExportBtn) {
  tradeExportBtn.addEventListener("click", () => {
    const exportModal = document.getElementById("export-modal");
    if (exportModal) {
      updateExportHintAndPreview();
      exportModal.classList.remove("hidden");
    }
  });
}

if (exportCancel) {
  exportCancel.addEventListener("click", () => {
    const exportModal = document.getElementById("export-modal");
    if (exportModal) exportModal.classList.add("hidden");
  });
}

if (exportRangeSelect) {
  exportRangeSelect.addEventListener("change", () => {
    const customRow = document.getElementById("export-custom-range-row");
    if (exportRangeSelect.value === "custom") {
      customRow.classList.remove("hidden");
    } else {
      customRow.classList.add("hidden");
    }
    updateExportHintAndPreview();
  });
}

if (exportFormatSelect) {
  exportFormatSelect.addEventListener("change", updateExportHintAndPreview);
}

const customStart = document.getElementById("export-start-date");
const customEnd = document.getElementById("export-end-date");
if (customStart) customStart.addEventListener("change", updateExportHintAndPreview);
if (customEnd) customEnd.addEventListener("change", updateExportHintAndPreview);

const includeObs = document.getElementById("export-include-obs");
const includeTrades = document.getElementById("export-include-trades");
if (includeObs) includeObs.addEventListener("change", updateExportHintAndPreview);
if (includeTrades) includeTrades.addEventListener("change", updateExportHintAndPreview);

if (exportConfirm) {
  exportConfirm.addEventListener("click", async () => {
    const format = exportFormatSelect.value;
    const rangeOpt = exportRangeSelect.value;
    
    // Retrieve date range filter
    let start = null;
    let end = null;
    if (rangeOpt === "month") {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (rangeOpt === "week") {
      const now = new Date();
      start = new Date();
      start.setDate(now.getDate() - 7);
      end = now;
    } else if (rangeOpt === "custom") {
      const sVal = customStart.value;
      const eVal = customEnd.value;
      if (!sVal || !eVal) { showToast("Enter custom start & end dates"); return; }
      start = new Date(sVal + "T00:00:00");
      end = new Date(eVal + "T23:59:59");
    }

    const range = start && end ? { start, end } : null;

    // Filter observations and trades locally
    const expObs = includeObs.checked 
      ? state.observations.filter((o) => {
          if (!range) return true;
          const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
          return d && d >= range.start && d <= range.end;
        })
      : [];

    const expTrades = includeTrades.checked
      ? state.trades.filter((t) => {
          if (!range) return true;
          const d = t.date ? new Date(t.date + "T12:00:00") : null;
          return d && d >= range.start && d <= range.end;
        })
      : [];

    if (expObs.length === 0 && expTrades.length === 0) {
      showToast("Nothing to export for selected filter");
      return;
    }

    const exportModal = document.getElementById("export-modal");
    if (exportModal) exportModal.classList.add("hidden");

    if (format === "csv") {
      await exportToCSV(expObs, expTrades);
    } else if (format === "json") {
      const normalized = normalizeForJsonExport(expObs, expTrades);
      const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
      downloadBlob(blob, `trade_journal_backup_${new Date().toISOString().slice(0,10)}.json`);
      if (window.recordBackupPerformed) window.recordBackupPerformed();
      showToast("JSON Backup downloaded");
    } else if (format === "pdf") {
      exportToPDF(expObs, expTrades);
    }
  });
}

// ===================== Business Logic =====================

export function renderTradeTable() {
  if (state.tradeLocked && state.tradePasscode) {
    tradeEmptyState.classList.add("hidden");
    tradeAnalytics.classList.add("hidden");
    tradeTableHead.classList.add("hidden");
    tradeTableBody.innerHTML = "";
    return;
  }

  const q = tradeSearchInput.value.toLowerCase().trim();
  const fVal = tradeFilterFrom.value;
  const tVal = tradeFilterTo.value;

  const start = fVal ? new Date(fVal + "T00:00:00") : null;
  const end = tVal ? new Date(tVal + "T23:59:59") : null;

  // Filter local trades list
  const filtered = state.trades.filter((t) => {
    if (start && new Date(t.date + "T12:00:00") < start) return false;
    if (end && new Date(t.date + "T12:00:00") > end) return false;
    if (q) {
      const commentsMatch = (t.comments || "").toLowerCase().includes(q);
      const dateMatch = (t.date || "").toLowerCase().includes(q);
      return commentsMatch || dateMatch;
    }
    return true;
  });

  if (filtered.length === 0) {
    tradeTableBody.innerHTML = "";
    tradeTableHead.classList.add("hidden");
    tradeAnalytics.classList.add("hidden");
    tradeEmptyState.classList.remove("hidden");
    return;
  }

  tradeEmptyState.classList.add("hidden");
  tradeTableHead.classList.remove("hidden");
  tradeAnalytics.classList.remove("hidden");

  // Render rows
  tradeTableBody.innerHTML = "";
  filtered.forEach((t) => {
    const row = document.createElement("tr");
    row.className = "trade-row";
    row.dataset.id = t.id;

    const netVal = Number(t.net) || 0;
    const netClass = netVal > 0 ? "trade-pnl-win" : (netVal < 0 ? "trade-pnl-loss" : "trade-pnl-flat");

    // Checklist linkage description label
    let checklistLabel = "";
    if (t.checklistLogId) {
      const log = state.checklistLogs.find((l) => l.id === t.checklistLogId);
      if (log) {
        checklistLabel = `<span class="trade-checklist-link" title="Checklist score">📋 ${log.score || 0}%</span>`;
      }
    }

    row.innerHTML = `
      <td>${escapeHtml(t.date || "")}</td>
      <td>$${formatNum(t.capital)}</td>
      <td>${escapeHtml(t.tradeNum || 0)}</td>
      <td>$${formatNum(t.gross)}</td>
      <td class="${netClass}">$${formatNum(t.net)}</td>
      <td>${escapeHtml(t.duration || 0)}m</td>
      <td style="font-size: 11px; max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
        ${escapeHtml(t.comments || "")}
        ${checklistLabel}
      </td>
    `;
    
    row.addEventListener("click", () => openTradeModal(t.id));
    tradeTableBody.appendChild(row);
  });

  renderTradeAnalytics(filtered);
}

function formatNum(val) {
  const n = Number(val);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderTradeAnalytics(filtered) {
  const count = filtered.length;
  let grossSum = 0;
  let netSum = 0;
  let wins = 0;
  let losses = 0;
  let winSum = 0;
  let lossSum = 0;

  filtered.forEach((t) => {
    grossSum += Number(t.gross) || 0;
    const n = Number(t.net) || 0;
    netSum += n;
    if (n > 0) {
      wins++;
      winSum += n;
    } else if (n < 0) {
      losses++;
      lossSum += Math.abs(n);
    }
  });

  const winRate = count > 0 ? ((wins / count) * 100).toFixed(1) : "0.0";
  const profitFactor = lossSum > 0 ? (winSum / lossSum).toFixed(2) : (winSum > 0 ? "∞" : "0.00");
  const avgWin = wins > 0 ? (winSum / wins).toFixed(2) : "0.00";
  const avgLoss = losses > 0 ? (lossSum / losses).toFixed(2) : "0.00";

  const netClass = netSum > 0 ? "trade-pnl-win" : (netSum < 0 ? "trade-pnl-loss" : "trade-pnl-flat");

  tradeAnalytics.innerHTML = `
    <div class="dash-stat">
      <span class="dash-stat-value">${count}</span>
      <span class="dash-stat-label">Trades</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-value ${netClass}">$${netSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      <span class="dash-stat-label">Net Profit</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-value">${winRate}%</span>
      <span class="dash-stat-label">Win Rate</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-value">${profitFactor}</span>
      <span class="dash-stat-label">Profit Factor</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-value" style="font-size: 11px;">W: $${avgWin}<br>L: $${avgLoss}</span>
      <span class="dash-stat-label">Avg Win/Loss</span>
    </div>
  `;
}

export function openTradeModal(id = null) {
  state.editingTradeId = id;
  const selectEl = document.getElementById("trade-checklist-select");

  if (id) {
    tradeModalTitle.textContent = "Edit Trade Entry";
    tradeDeleteBtn.classList.remove("hidden");

    const t = state.trades.find((x) => x.id === id);
    if (t) {
      tradeDate.value = t.date || "";
      tradeCapital.value = t.capital || "";
      tradeNum.value = t.tradeNum || "";
      tradeGross.value = t.gross || "";
      tradeNet.value = t.net || "";
      tradeDuration.value = t.duration || "";
      tradeComments.value = t.comments || "";
      
      // Populate and link checklists
      renderLinkedChecklists(t.checklistLogId);
    }
  } else {
    tradeModalTitle.textContent = "Add Trade Entry";
    tradeDeleteBtn.classList.add("hidden");

    // Defaults
    tradeDate.value = new Date().toISOString().slice(0, 10);
    tradeCapital.value = state.trades[0] ? state.trades[0].capital || "" : "";
    tradeNum.value = "";
    tradeGross.value = "";
    tradeNet.value = "";
    tradeDuration.value = "";
    tradeComments.value = "";

    renderLinkedChecklists(null);
  }

  tradeModal.classList.remove("hidden");
  setTimeout(() => tradeGross.focus(), 100);
}

// Bind to window for compatibility with overrides
window.renderTradeTable = renderTradeTable;
window.openTradeModal = openTradeModal;
window.updateExportHintAndPreview = updateExportHintAndPreview;