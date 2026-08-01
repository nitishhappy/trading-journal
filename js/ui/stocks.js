import { state } from '../state.js';
import { updateStock, deleteStock, addStocksBatch } from '../services/stocks.js';
import { showToast } from '../utils/toast.js';

let hasAutoSynced = false;

// Sorting and grouping state
let currentSortField = "name"; // "name" | "dateOfRun" | "source" | "timeframe" | "traded"
let currentSortOrder = "asc"; // "asc" | "desc"
let currentGroupField = "none"; // "none" | "source" | "date"

// Helper to toggle sort states
function toggleSort(field, defaultOrder = "asc") {
  if (currentSortField === field) {
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
  } else {
    currentSortField = field;
    currentSortOrder = defaultOrder;
  }
  renderStocksTable();
}

// Initialize Stocks view event listeners
export function initStocksUI() {
  const groupSelect = document.getElementById("stocks-group-select");
  const sortSelect = document.getElementById("stocks-sort-select");
  const copyDeltaBtn = document.getElementById("stocks-copy-delta-btn");
  const copyFullBtn = document.getElementById("stocks-copy-full-btn");

  // Sync selectors with state
  if (groupSelect) {
    groupSelect.value = "none";
    groupSelect.addEventListener("change", () => {
      currentGroupField = groupSelect.value;
      renderStocksTable();
    });
  }

  if (sortSelect) {
    sortSelect.value = "name";
    sortSelect.addEventListener("change", () => {
      currentSortField = sortSelect.value === "date" ? "dateOfRun" : "name";
      currentSortOrder = sortSelect.value === "date" ? "desc" : "asc";
      renderStocksTable();
    });
  }

  // Header click listeners
  const thName = document.getElementById("th-stock-name");
  const thDate = document.getElementById("th-date");
  const thSource = document.getElementById("th-source");
  const thTf = document.getElementById("th-tf");
  const thTraded = document.getElementById("th-traded");

  if (thName) {
    thName.addEventListener("click", () => {
      toggleSort("name", "asc");
      if (sortSelect) sortSelect.value = "name";
    });
  }
  if (thDate) {
    thDate.addEventListener("click", () => {
      toggleSort("dateOfRun", "desc");
      if (sortSelect) sortSelect.value = "date";
    });
  }
  if (thSource) {
    thSource.addEventListener("click", () => {
      currentGroupField = currentGroupField === "source" ? "none" : "source";
      if (groupSelect) groupSelect.value = currentGroupField;
      renderStocksTable();
    });
  }
  if (thTf) {
    thTf.addEventListener("click", () => {
      toggleSort("timeframe", "asc");
    });
  }
  if (thTraded) {
    thTraded.addEventListener("click", () => {
      toggleSort("traded", "asc");
    });
  }

  if (copyDeltaBtn) {
    copyDeltaBtn.addEventListener("click", () => copyWatchlist("delta"));
  }

  if (copyFullBtn) {
    copyFullBtn.addEventListener("click", () => copyWatchlist("full"));
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

// Copy tickers formatted for TradingView watchlist to clipboard
function copyWatchlist(type) {
  if (!state.stocks || state.stocks.length === 0) {
    showToast("No stocks to copy", "info");
    return;
  }

  let targetStocks = [];

  if (type === "delta") {
    // Find the latest date of run
    const dates = state.stocks
      .map(s => s.dateOfRun)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));
    
    if (dates.length === 0) {
      showToast("No dates found to determine delta", "error");
      return;
    }
    
    const latestDate = dates[0];
    targetStocks = state.stocks.filter(s => s.dateOfRun === latestDate);
  } else {
    targetStocks = state.stocks;
  }

  if (targetStocks.length === 0) {
    showToast("No tickers found", "info");
    return;
  }

  // Generate TV list: EXCH:TICKER, separated by commas
  const tickers = targetStocks.map(stock => {
    const symbolPrefix = stock.tvLink && stock.tvLink.includes("BSE:") ? "BSE:" : "NSE:";
    return `${symbolPrefix}${stock.ticker}`;
  });

  // Remove duplicates
  const uniqueTickers = [...new Set(tickers)];
  const textToCopy = uniqueTickers.join(",");

  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      showToast(`Copied ${uniqueTickers.length} tickers to clipboard!`, "success");
    })
    .catch(err => {
      console.error("Clipboard copy failed:", err);
      showToast("Failed to copy to clipboard", "error");
    });
}

// Auto-sync window.scannedStocksData into Firestore
function runAutoSync() {
  const existingMap = new Map(state.stocks.map(s => [`${s.ticker.toUpperCase()}_${s.dateOfRun}`, s]));
  const toAdd = [];
  const toUpdate = [];

  window.scannedStocksData.forEach(item => {
    const ticker = (item.ticker || "").toUpperCase().trim();
    const dateOfRun = (item.dateOfRun || "").trim();
    if (!ticker || !dateOfRun) return;

    const key = `${ticker}_${dateOfRun}`;
    if (!existingMap.has(key)) {
      toAdd.push({
        name: item.name || "",
        ticker: ticker,
        tvLink: item.tvLink || `https://www.tradingview.com/chart/?symbol=NSE:${ticker}`,
        summary: item.summary || "",
        sector: item.sector || "",
        dateOfRun: dateOfRun,
        source: item.source || "Afzal",
        timeframe: item.timeframe || "Daily",
        myNotes: item.myNotes || "",
        traded: item.traded || "N",
        highlight: item.highlight || false
      });
    } else {
      // Sync updates if summary, highlight, or sector changed in the scan file
      const existing = existingMap.get(key);
      const newSummary = item.summary || "";
      const newHighlight = item.highlight || false;
      const newSector = item.sector || "";
      if (existing.summary !== newSummary || existing.highlight !== newHighlight || existing.sector !== newSector) {
        toUpdate.push({
          id: existing.id,
          data: {
            summary: newSummary,
            highlight: newHighlight,
            sector: newSector
          }
        });
      }
    }
  });

  if (toAdd.length > 0) {
    console.log(`Auto-syncing ${toAdd.length} new stocks to Firestore...`);
    addStocksBatch(toAdd);
  }

  if (toUpdate.length > 0) {
    console.log(`Auto-syncing ${toUpdate.length} stock updates to Firestore...`);
    toUpdate.forEach(upd => {
      updateStock(upd.id, upd.data);
    });
  }
}

// Render the Stocks table
export function renderStocksTable() {
  const tableBody = document.getElementById("stocks-table-body");
  const totalCountEl = document.getElementById("stocks-total-count");
  const emptyStateEl = document.getElementById("stocks-empty-state");

  if (!tableBody) return;

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

  if (stocks.length === 0) {
    updateHeaderIndicators();
    return;
  }

  // 1. Sort the stocks
  stocks.sort((a, b) => {
    let valA = a[currentSortField] || "";
    let valB = b[currentSortField] || "";

    if (currentSortField === "dateOfRun") {
      // date comparison
      const dateA = new Date(valA || "1970-01-01");
      const dateB = new Date(valB || "1970-01-01");
      return currentSortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    // text comparison
    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();

    if (currentSortOrder === "asc") {
      return valA.localeCompare(valB);
    } else {
      return valB.localeCompare(valA);
    }
  });

  // 2. Render (Grouped or Ungrouped)
  const groupMode = currentGroupField;
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

  // Update header indicators
  updateHeaderIndicators();
}

// Update direction arrows on headers based on active sort/group state
function updateHeaderIndicators() {
  const indicators = {
    "name": { id: "th-stock-name" },
    "sector": { id: "th-sector" },
    "dateOfRun": { id: "th-date" },
    "source": { id: "th-source" },
    "timeframe": { id: "th-tf" },
    "traded": { id: "th-traded" }
  };

  Object.entries(indicators).forEach(([field, config]) => {
    const el = document.getElementById(config.id);
    if (!el) return;

    const indicatorSpan = el.querySelector(".sort-indicator");
    if (!indicatorSpan) return;

    if (field === "source") {
      // Source column manages grouping state
      if (currentGroupField === "source") {
        indicatorSpan.textContent = " 📁";
        el.style.color = "var(--accent)";
      } else {
        indicatorSpan.textContent = " ⇅";
        el.style.color = "";
      }
    } else {
      // Standard sorting fields
      if (currentSortField === field) {
        indicatorSpan.textContent = currentSortOrder === "asc" ? " ▲" : " ▼";
        el.style.color = "var(--accent)";
      } else {
        indicatorSpan.textContent = " ⇅";
        el.style.color = "";
      }
    }
  });
}

// Create a single stock table row element
function createStockRow(stock) {
  const tr = document.createElement("tr");
  tr.dataset.id = stock.id;
  tr.className = `stocks-row ${stock.highlight ? 'highlighted-row' : ''}`;

  // Clear highlight on click
  tr.addEventListener("click", () => {
    if (stock.highlight) {
      stock.highlight = false;
      tr.classList.remove("highlighted-row");
      updateStock(stock.id, { highlight: false });
    }
  });

  const isWeekly = stock.timeframe === 'Weekly';
  const isTraded = stock.traded === 'Y';

  tr.innerHTML = `
    <td>
      <input type="text" class="stocks-inline-edit stock-name-input" value="${escapeHtml(stock.name)}" data-field="name" placeholder="Enter stock name...">
    </td>
    <td>
      <div class="ticker-badge-cell">
        <input type="text" class="stocks-inline-edit stock-ticker-input" value="${escapeHtml(stock.ticker)}" data-field="ticker">
        <a href="${escapeHtml(stock.tvLink)}" target="_blank" class="stocks-tv-badge" title="Open TradingView Chart">
          <span class="chart-mini-icon">📊</span> TV
        </a>
      </div>
    </td>
    <td>
      <input type="text" class="stocks-inline-edit stock-sector-input" value="${escapeHtml(stock.sector || "")}" data-field="sector" placeholder="Sector">
    </td>
    <td>
      <textarea class="stocks-inline-edit stock-summary-input" data-field="summary" rows="1" placeholder="Add technical summary...">${escapeHtml(stock.summary)}</textarea>
    </td>
    <td>
      <input type="date" class="stocks-inline-edit stock-date-input" value="${escapeHtml(stock.dateOfRun)}" data-field="dateOfRun">
    </td>
    <td>
      <div class="source-tag-wrapper">
        <input type="text" class="stocks-inline-edit stock-source-input" value="${escapeHtml(stock.source)}" data-field="source">
      </div>
    </td>
    <td>
      <div class="tf-badge-wrapper ${isWeekly ? 'tf-weekly' : 'tf-daily'}">
        <select class="stocks-inline-edit stock-tf-select" data-field="timeframe">
          <option value="Daily" ${stock.timeframe === 'Daily' ? 'selected' : ''}>Daily</option>
          <option value="Weekly" ${isWeekly ? 'selected' : ''}>Weekly</option>
        </select>
      </div>
    </td>
    <td>
      <textarea class="stocks-inline-edit stock-notes-input" data-field="myNotes" placeholder="Write trade notes..." rows="1">${escapeHtml(stock.myNotes || "")}</textarea>
    </td>
    <td style="text-align: center;">
      <select class="stock-traded-select status-badge ${isTraded ? 'traded-yes' : 'traded-no'}" data-field="traded">
        <option value="Y" ${isTraded ? 'selected' : ''}>Yes</option>
        <option value="N" ${!isTraded ? 'selected' : ''}>No</option>
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
        const linkEl = tr.querySelector(".stocks-tv-badge");
        if (linkEl) linkEl.href = `https://www.tradingview.com/chart/?symbol=NSE:${val}`;
      }

      // Handle dynamic styling classes on change
      if (field === 'traded') {
        input.className = `stock-traded-select status-badge ${val === 'Y' ? 'traded-yes' : 'traded-no'}`;
      }
      
      if (field === 'timeframe') {
        const wrapper = tr.querySelector(".tf-badge-wrapper");
        if (wrapper) {
          wrapper.className = `tf-badge-wrapper ${val === 'Weekly' ? 'tf-weekly' : 'tf-daily'}`;
        }
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
