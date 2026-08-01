import { state } from '../state.js';
import { updateStock, deleteStock, addStocksBatch } from '../services/stocks.js';

let hasAutoSynced = false;

// Initialize Stocks view event listeners
export function initStocksUI() {
  const groupSelect = document.getElementById("stocks-group-select");
  const sortSelect = document.getElementById("stocks-sort-select");

  if (groupSelect) {
    groupSelect.value = "none";
    groupSelect.addEventListener("change", () => renderStocksTable());
  }

  if (sortSelect) {
    sortSelect.value = "name";
    sortSelect.addEventListener("change", () => renderStocksTable());
  }

  // Listen to Firestore updates
  window.addEventListener("stocks-updated", () => {
    // Attempt auto-sync of scanned_stocks.js data exactly once after first DB load
    if (!hasAutoSynced && window.scannedStocksData && Array.isArray(window.scannedStocksData) && window.scannedStocksData.length > 0) {
      hasAutoSynced = true;
      runAutoSync();
    }
    renderStocksTable();
  });
}

// Auto-sync window.scannedStocksData into Firestore
function runAutoSync() {
  const existingKeys = new Set(state.stocks.map(s => `${s.ticker.toUpperCase()}_${s.dateOfRun}`));
  const toAdd = [];

  window.scannedStocksData.forEach(item => {
    const ticker = (item.ticker || "").toUpperCase().trim();
    const dateOfRun = (item.dateOfRun || "").trim();
    if (!ticker || !dateOfRun) return;

    const key = `${ticker}_${dateOfRun}`;
    if (!existingKeys.has(key)) {
      toAdd.push({
        name: item.name || "",
        ticker: ticker,
        tvLink: item.tvLink || `https://www.tradingview.com/chart/?symbol=NSE:${ticker}`,
        summary: item.summary || "",
        dateOfRun: dateOfRun,
        source: item.source || "Afzal",
        timeframe: item.timeframe || "Daily",
        myNotes: item.myNotes || "",
        traded: item.traded || "N"
      });
    }
  });

  if (toAdd.length > 0) {
    console.log(`Auto-syncing ${toAdd.length} new stocks to Firestore...`);
    addStocksBatch(toAdd);
  }
}

// Render the Stocks table
export function renderStocksTable() {
  const tableBody = document.getElementById("stocks-table-body");
  const totalCountEl = document.getElementById("stocks-total-count");
  const emptyStateEl = document.getElementById("stocks-empty-state");

  if (!tableBody) return;

  const groupSelect = document.getElementById("stocks-group-select");
  const sortSelect = document.getElementById("stocks-sort-select");

  const groupMode = groupSelect ? groupSelect.value : "none"; // "none" | "source" | "date"
  const sortMode = sortSelect ? sortSelect.value : "name"; // "name" | "date"

  const stocks = [...state.stocks];

  // Update total count
  if (totalCountEl) {
    totalCountEl.textContent = `${stocks.length} Stock${stocks.length === 1 ? '' : 's'}`;
  }

  // Toggle empty state
  if (emptyStateEl) {
    emptyStateEl.classList.toggle("hidden", stocks.length > 0);
  }

  tableBody.innerHTML = "";

  if (stocks.length === 0) return;

  // 1. Sort the stocks
  stocks.sort((a, b) => {
    if (sortMode === "date") {
      const dateA = a.dateOfRun || "";
      const dateB = b.dateOfRun || "";
      return dateB.localeCompare(dateA); // Newest first
    } else {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB); // Alphabetical
    }
  });

  // 2. Render (Grouped or Ungrouped)
  if (groupMode === "none") {
    stocks.forEach(stock => {
      tableBody.appendChild(createStockRow(stock));
    });
  } else {
    // Grouping logic
    const groups = {};
    stocks.forEach(stock => {
      let key = "Unknown";
      if (groupMode === "source") key = stock.source || "Unknown";
      else if (groupMode === "date") key = stock.dateOfRun || "Unknown";

      if (!groups[key]) groups[key] = [];
      groups[key].push(stock);
    });

    // Sort group headers
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (groupMode === "date") return b.localeCompare(a); // Newest date group first
      return a.localeCompare(b);
    });

    sortedKeys.forEach(groupName => {
      // Inject group header row
      const headerRow = document.createElement("tr");
      headerRow.className = "stocks-group-header";
      headerRow.innerHTML = `<td colspan="9"><strong>${groupName}</strong> (${groups[groupName].length} items)</td>`;
      tableBody.appendChild(headerRow);

      // Inject members of group
      groups[groupName].forEach(stock => {
        tableBody.appendChild(createStockRow(stock));
      });
    });
  }
}

// Create a single stock table row element
function createStockRow(stock) {
  const tr = document.createElement("tr");
  tr.dataset.id = stock.id;
  tr.className = "stocks-row";

  tr.innerHTML = `
    <td>
      <input type="text" class="stocks-inline-edit stock-name-input" value="${escapeHtml(stock.name)}" data-field="name">
    </td>
    <td>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="text" class="stocks-inline-edit stock-ticker-input" value="${escapeHtml(stock.ticker)}" data-field="ticker" style="width: 80px;">
        <a href="${escapeHtml(stock.tvLink)}" target="_blank" class="stocks-tv-link" title="Open TradingView Chart">📈</a>
      </div>
    </td>
    <td>
      <textarea class="stocks-inline-edit stock-summary-input" data-field="summary" rows="1">${escapeHtml(stock.summary)}</textarea>
    </td>
    <td>
      <input type="date" class="stocks-inline-edit stock-date-input" value="${escapeHtml(stock.dateOfRun)}" data-field="dateOfRun">
    </td>
    <td>
      <input type="text" class="stocks-inline-edit stock-source-input" value="${escapeHtml(stock.source)}" data-field="source" style="width: 80px;">
    </td>
    <td>
      <select class="stocks-inline-edit stock-tf-select" data-field="timeframe" style="width: 80px;">
        <option value="Daily" ${stock.timeframe === 'Daily' ? 'selected' : ''}>Daily</option>
        <option value="Weekly" ${stock.timeframe === 'Weekly' ? 'selected' : ''}>Weekly</option>
      </select>
    </td>
    <td>
      <textarea class="stocks-inline-edit stock-notes-input" data-field="myNotes" placeholder="Add notes..." rows="1">${escapeHtml(stock.myNotes || "")}</textarea>
    </td>
    <td style="text-align: center;">
      <select class="stock-traded-select" data-field="traded">
        <option value="Y" ${stock.traded === 'Y' ? 'selected' : ''}>Y</option>
        <option value="N" ${stock.traded === 'N' ? 'selected' : ''}>N</option>
      </select>
    </td>
    <td style="text-align: center;">
      <button class="stocks-btn-delete" title="Delete Stock">✕</button>
    </td>
  `;

  // Attach Inline Edit Events
  tr.querySelectorAll(".stocks-inline-edit, .stock-traded-select").forEach(input => {
    const saveChanges = () => {
      const field = input.dataset.field;
      let val = input.value;

      // Handle ticker casing/trimming
      if (field === 'ticker') {
        val = val.toUpperCase().trim();
        input.value = val;
        // Update TV link based on new ticker
        const linkEl = tr.querySelector(".stocks-tv-link");
        if (linkEl) linkEl.href = `https://www.tradingview.com/chart/?symbol=NSE:${val}`;
      }

      if (stock[field] !== val) {
        stock[field] = val; // optimistically update local state
        updateStock(stock.id, { [field]: val });
      }
    };

    if (input.tagName === "SELECT") {
      input.addEventListener("change", saveChanges);
    } else {
      input.addEventListener("blur", saveChanges);
      // Auto-resize textareas as user types
      if (input.tagName === "TEXTAREA") {
        input.addEventListener("input", () => {
          input.style.height = "auto";
          input.style.height = input.scrollHeight + "px";
        });
        // initial size trigger
        setTimeout(() => {
          input.style.height = "auto";
          input.style.height = input.scrollHeight + "px";
        }, 10);
      }
    }
  });

  // Attach Delete Event
  tr.querySelector(".stocks-btn-delete").addEventListener("click", () => {
    if (confirm(`Are you sure you want to delete ${stock.name || 'this stock'}?`)) {
      deleteStock(stock.id);
    }
  });

  return tr;
}

// Simple HTML escaping helper
function escapeHtml(str) {
  if (!str) return "";
  return str.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  initStocksUI();
});
