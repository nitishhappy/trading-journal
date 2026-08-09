import { state } from '../state.js';
import { updateStock, deleteStock, addStocksBatch, deleteStocksBatch, loadStocksObservations, saveStocksObservations } from '../services/stocks.js';
import { showToast } from '../utils/toast.js';

let hasAutoSynced = false;

// Sorting and grouping state
let currentSortField = "dateOfRun"; // "name" | "dateOfRun" | "source" | "timeframe" | "traded"
let currentSortOrder = "desc"; // "asc" | "desc"
let currentGroupField = "none"; // "none" | "source" | "date"

// Selection state
let selectedStockIds = new Set();

function updateDeleteButtonVisibility() {
  const deleteBtn = document.getElementById("stocks-delete-selected-btn");
  if (deleteBtn) {
    if (selectedStockIds.size > 0) {
      deleteBtn.style.display = "inline-block";
      deleteBtn.textContent = `🗑 Delete (${selectedStockIds.size})`;
    } else {
      deleteBtn.style.display = "none";
    }
  }
}

// Render observations at the top of Stocks page
export function renderStocksObservations() {
  const listEl = document.getElementById("stocks-observations-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const bullets = state.stocksObservations || [];
  if (bullets.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "observation-item empty-obs-item";
    emptyLi.style.color = "var(--text-dim)";
    emptyLi.style.fontStyle = "italic";
    emptyLi.textContent = "No observations added yet. Click '+ Add Bullet' to add your first observation.";
    listEl.appendChild(emptyLi);
    return;
  }

  bullets.forEach((bulletText, index) => {
    const li = document.createElement("li");
    li.className = "observation-item";
    li.dataset.index = index;

    li.innerHTML = `
      <span class="observation-bullet">•</span>
      <span class="observation-text">${escapeHtml(bulletText)}</span>
      <div class="observation-actions">
        <button class="btn-obs-action btn-obs-edit" title="Edit Bullet">✏️</button>
        <button class="btn-obs-action btn-obs-delete" title="Delete Bullet">🗑</button>
      </div>
    `;

    const textEl = li.querySelector(".observation-text");
    const editBtn = li.querySelector(".btn-obs-edit");
    const deleteBtn = li.querySelector(".btn-obs-delete");

    const enterEditMode = () => {
      if (li.classList.contains("editing")) return;
      li.classList.add("editing");

      const currentText = bullets[index];
      const textarea = document.createElement("textarea");
      textarea.className = "observation-input";
      textarea.value = currentText;
      textarea.rows = 1;

      textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      });

      textEl.style.display = "none";
      li.insertBefore(textarea, textEl);
      textarea.focus();

      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";

      let saved = false;
      const saveEdit = () => {
        if (saved) return;
        saved = true;

        const newText = textarea.value.trim();
        li.classList.remove("editing");
        textarea.remove();
        textEl.style.display = "";

        if (newText === "") {
          bullets.splice(index, 1);
          saveStocksObservations(bullets);
        } else if (newText !== currentText) {
          bullets[index] = newText;
          saveStocksObservations(bullets);
        }
      };

      textarea.addEventListener("blur", saveEdit);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          textarea.blur();
        }
      });
    };

    textEl.addEventListener("click", enterEditMode);
    editBtn.addEventListener("click", enterEditMode);

    deleteBtn.addEventListener("click", () => {
      bullets.splice(index, 1);
      saveStocksObservations(bullets);
    });

    listEl.appendChild(li);
  });
}

// Column Visibility Persistence Helpers
export function getColumnVisibilitySettings() {
  const saved = localStorage.getItem("stocksColumnVisibility");
  const defaults = {
    name: true,
    ticker: true,
    sector: true,
    summary: true,
    date: true,
    source: true,
    tf: true,
    notes: true,
    traded: true,
    analyzed: true
  };
  if (!saved) return defaults;
  try {
    return { ...defaults, ...JSON.parse(saved) };
  } catch (e) {
    return defaults;
  }
}

export function applyColumnVisibility() {
  const table = document.getElementById("stocks-table");
  if (!table) return;

  const visibility = getColumnVisibilitySettings();
  Object.entries(visibility).forEach(([col, isVisible]) => {
    table.classList.toggle(`hide-col-${col}`, !isVisible);

    // Sync checkbox in dropdown
    const checkbox = document.querySelector(`#stocks-cols-dropdown input[data-col="${col}"]`);
    if (checkbox) {
      checkbox.checked = isVisible;
    }
  });

  renderStocksTable();
}

export function saveColumnVisibilitySetting(col, isVisible) {
  const current = getColumnVisibilitySettings();
  current[col] = isVisible;
  localStorage.setItem("stocksColumnVisibility", JSON.stringify(current));
  applyColumnVisibility();
}

export function getVisibleColsCount() {
  const totalCols = 12; // checkbox, name, ticker, sector, summary, date, source, tf, notes, traded, analyzed, action
  const visibility = getColumnVisibilitySettings();
  let hiddenCount = 0;
  Object.values(visibility).forEach(visible => {
    if (!visible) hiddenCount++;
  });
  return totalCols - hiddenCount;
}

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
  const deleteBtn = document.getElementById("stocks-delete-selected-btn");
  const selectAllCheckbox = document.getElementById("stocks-select-all");

  // Sync selectors with state
  if (groupSelect) {
    groupSelect.value = "none";
    groupSelect.addEventListener("change", () => {
      currentGroupField = groupSelect.value;
      renderStocksTable();
    });
  }

  if (sortSelect) {
    sortSelect.value = "date";
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

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (selectedStockIds.size > 0 && confirm(`Are you sure you want to delete ${selectedStockIds.size} stock(s)?`)) {
        deleteStocksBatch(Array.from(selectedStockIds)).then(() => {
          selectedStockIds.clear();
          updateDeleteButtonVisibility();
          if (selectAllCheckbox) selectAllCheckbox.checked = false;
        });
      }
    });
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const rowCheckboxes = document.querySelectorAll(".stocks-row-checkbox");
      rowCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) {
          selectedStockIds.add(cb.dataset.id);
        } else {
          selectedStockIds.delete(cb.dataset.id);
        }
      });
      updateDeleteButtonVisibility();
    });
  }

  // Handle "+ Add Bullet" button click
  const addObsBtn = document.getElementById("add-stock-obs-btn");
  if (addObsBtn) {
    addObsBtn.addEventListener("click", () => {
      const listEl = document.getElementById("stocks-observations-list");
      if (!listEl) return;

      const emptyItem = listEl.querySelector(".empty-obs-item");
      if (emptyItem) emptyItem.remove();

      const li = document.createElement("li");
      li.className = "observation-item editing";
      li.innerHTML = `
        <span class="observation-bullet">•</span>
        <textarea class="observation-input" placeholder="Type your observation and press Enter..." rows="1"></textarea>
      `;

      listEl.appendChild(li);
      const textarea = li.querySelector(".observation-input");
      textarea.focus();

      let saved = false;
      const saveNew = () => {
        if (saved) return;
        saved = true;
        const text = textarea.value.trim();
        li.remove();

        if (text !== "") {
          const bullets = state.stocksObservations || [];
          bullets.push(text);
          saveStocksObservations(bullets);
        } else {
          renderStocksObservations();
        }
      };

      textarea.addEventListener("blur", saveNew);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          textarea.blur();
        }
      });
    });
  }

  // Column visibility triggers
  const colsBtn = document.getElementById("stocks-cols-btn");
  const colsDropdown = document.getElementById("stocks-cols-dropdown");
  if (colsBtn && colsDropdown) {
    colsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      colsDropdown.classList.toggle("hidden");
    });

    colsDropdown.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const col = e.target.dataset.col;
        const isVisible = e.target.checked;
        saveColumnVisibilitySetting(col, isVisible);
      });
    });

    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("stocks-cols-dropdown-wrapper");
      if (wrapper && !wrapper.contains(e.target)) {
        colsDropdown.classList.add("hidden");
      }
    });
  }

  // Hide analyzed toggle
  const hideAnalyzedCheckbox = document.getElementById("stocks-hide-analyzed");
  if (hideAnalyzedCheckbox) {
    const saved = localStorage.getItem("stocksHideAnalyzed");
    if (saved !== null) {
      hideAnalyzedCheckbox.checked = saved === "true";
    }
    hideAnalyzedCheckbox.addEventListener("change", () => {
      localStorage.setItem("stocksHideAnalyzed", hideAnalyzedCheckbox.checked);
      renderStocksTable();
    });
  }

  // Click handler for sorting by Analyzed status
  const thAnalyzed = document.getElementById("th-analyzed");
  if (thAnalyzed) {
    thAnalyzed.addEventListener("click", () => {
      toggleSort("analyzed", "desc");
    });
  }

  // Listen to Stocks Observations updates
  window.addEventListener("stocks-observations-updated", () => {
    renderStocksObservations();
  });

  // Apply saved column visibility settings on startup
  applyColumnVisibility();

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
      if (existing.summary !== newSummary || existing.highlight !== newHighlight || (newSector && existing.sector !== newSector)) {
        toUpdate.push({
          id: existing.id,
          data: {
            summary: newSummary,
            highlight: newHighlight,
            sector: newSector || existing.sector || ""
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

  let stocks = [...state.stocks];

  // Filter out analyzed stocks if the checkbox is checked
  const hideAnalyzed = document.getElementById("stocks-hide-analyzed")?.checked ?? true;
  if (hideAnalyzed) {
    stocks = stocks.filter(stock => !stock.analyzed);
  }

  // Update total count
  if (totalCountEl) {
    totalCountEl.textContent = `${stocks.length} Stock${stocks.length === 1 ? '' : 's'} (${state.stocks.length} total)`;
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
    let valA = a[currentSortField] ?? "";
    let valB = b[currentSortField] ?? "";

    if (currentSortField === "dateOfRun") {
      // date comparison
      const dateA = new Date(valA || "1970-01-01");
      const dateB = new Date(valB || "1970-01-01");
      return currentSortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (currentSortField === "analyzed") {
      const numA = valA === true ? 1 : 0;
      const numB = valB === true ? 1 : 0;
      return currentSortOrder === "asc" ? numA - numB : numB - numA;
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
      headerRow.innerHTML = `<td colspan="${getVisibleColsCount()}"><strong>${groupName}</strong> (${groups[groupName].length} items)</td>`;
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
    "traded": { id: "th-traded" },
    "analyzed": { id: "th-analyzed" }
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

  let resolvedSector = stock.sector || "";
  if (!resolvedSector && window.scannedStocksData) {
    const found = window.scannedStocksData.find(s => (s.ticker || '').toUpperCase() === (stock.ticker || '').toUpperCase());
    if (found && found.sector) {
      resolvedSector = found.sector;
      stock.sector = resolvedSector;
    }
  }

  let sectorTvLink = "";
  if (resolvedSector && window.sectorData) {
    const matchedKey = Object.keys(window.sectorData).find(k => k.toLowerCase() === resolvedSector.trim().toLowerCase());
    if (matchedKey) {
      sectorTvLink = `https://www.tradingview.com/chart/?symbol=${window.sectorData[matchedKey]}`;
    }
  }

  tr.innerHTML = `
    <td class="col-checkbox" style="text-align: center;">
      <input type="checkbox" class="stocks-row-checkbox stocks-checkbox" data-id="${stock.id}">
    </td>
    <td class="col-name">
      <input type="text" class="stocks-inline-edit stock-name-input" value="${escapeHtml(stock.name)}" data-field="name" placeholder="Enter stock name...">
    </td>
    <td class="col-ticker">
      <div class="double-click-edit-container">
        <a href="${escapeHtml(stock.tvLink)}" target="_blank" class="stocks-hyperlink stocks-ticker-link" title="Double click to edit">${escapeHtml(stock.ticker)}</a>
        <input type="text" class="stocks-inline-edit stock-ticker-input double-click-input" value="${escapeHtml(stock.ticker)}" data-field="ticker" style="display:none; width:100%;">
      </div>
    </td>
    <td class="col-sector">
      <div class="double-click-edit-container">
        <a ${sectorTvLink ? `href="${escapeHtml(sectorTvLink)}" target="_blank"` : ''} class="stocks-hyperlink stocks-sector-link" title="Double click to edit">${escapeHtml(resolvedSector || "Sector")}</a>
        <input type="text" class="stocks-inline-edit stock-sector-input double-click-input" value="${escapeHtml(resolvedSector || "")}" data-field="sector" placeholder="Sector" style="display:none; width:100%;">
      </div>
    </td>
    <td class="col-summary">
      <textarea class="stocks-inline-edit stock-summary-input" data-field="summary" rows="1" placeholder="Add technical summary...">${escapeHtml(stock.summary)}</textarea>
    </td>
    <td class="col-date">
      <input type="date" class="stocks-inline-edit stock-date-input" value="${escapeHtml(stock.dateOfRun)}" data-field="dateOfRun">
    </td>
    <td class="col-source">
      <div class="source-tag-wrapper">
        <input type="text" class="stocks-inline-edit stock-source-input" value="${escapeHtml(stock.source)}" data-field="source">
      </div>
    </td>
    <td class="col-tf">
      <div class="tf-badge-wrapper ${isWeekly ? 'tf-weekly' : 'tf-daily'}">
        <select class="stocks-inline-edit stock-tf-select" data-field="timeframe">
          <option value="Daily" ${stock.timeframe === 'Daily' ? 'selected' : ''}>Daily</option>
          <option value="Weekly" ${isWeekly ? 'selected' : ''}>Weekly</option>
        </select>
      </div>
    </td>
    <td class="col-notes">
      <textarea class="stocks-inline-edit stock-notes-input" data-field="myNotes" placeholder="Write trade notes..." rows="1">${escapeHtml(stock.myNotes || "")}</textarea>
    </td>
    <td class="col-traded" style="text-align: center;">
      <select class="stock-traded-select status-badge ${isTraded ? 'traded-yes' : 'traded-no'}" data-field="traded">
        <option value="Y" ${isTraded ? 'selected' : ''}>Yes</option>
        <option value="N" ${!isTraded ? 'selected' : ''}>No</option>
      </select>
    </td>
    <td class="col-analyzed" style="text-align: center;">
      <input type="checkbox" class="stocks-inline-edit stock-analyzed-checkbox stocks-checkbox" data-field="analyzed" ${stock.analyzed ? 'checked' : ''} style="width: auto; margin: 0; transform: scale(1.1); cursor: pointer;">
    </td>
    <td class="col-action" style="text-align: center;">
      <button class="stocks-btn-delete" title="Delete Stock">✕</button>
    </td>
  `;

  // Attach Inline Edit Events
  tr.querySelectorAll(".stocks-inline-edit, .stock-traded-select").forEach(input => {
    const saveChanges = () => {
      const field = input.dataset.field;
      let val = input.type === 'checkbox' ? input.checked : input.value;

      // Handle ticker casing/trimming
      if (field === 'ticker') {
        val = val.toUpperCase().trim();
        input.value = val;
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
        updateStock(stock.id, { [field]: val }).then(() => {
          if (field === 'analyzed' && document.getElementById("stocks-hide-analyzed")?.checked) {
            renderStocksTable();
          }
        });
      }
    };

    if (input.tagName === "SELECT" || input.type === "checkbox") {
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

  // Handle double-click-to-edit links
  const editContainers = tr.querySelectorAll('.double-click-edit-container');
  editContainers.forEach(container => {
    const linkEl = container.querySelector('.stocks-hyperlink');
    const inputEl = container.querySelector('.double-click-input');
    
    if (linkEl && inputEl) {
      linkEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        linkEl.style.display = 'none';
        inputEl.style.display = 'block';
        inputEl.focus();
      });

      inputEl.addEventListener('blur', () => {
        inputEl.style.display = 'none';
        linkEl.style.display = 'inline-block';
        
        const val = inputEl.value.trim();
        linkEl.textContent = val || (inputEl.dataset.field === 'sector' ? 'Sector' : 'Ticker');
        
        if (inputEl.dataset.field === 'ticker') {
          linkEl.href = `https://www.tradingview.com/chart/?symbol=NSE:${val.toUpperCase()}`;
        } else if (inputEl.dataset.field === 'sector') {
          let foundTvSymbol = "";
          if (val && window.sectorData) {
            const matchedKey = Object.keys(window.sectorData).find(k => k.toLowerCase() === val.toLowerCase());
            if (matchedKey) foundTvSymbol = window.sectorData[matchedKey];
          }
          if (foundTvSymbol) {
            linkEl.href = `https://www.tradingview.com/chart/?symbol=${foundTvSymbol}`;
            linkEl.target = "_blank";
          } else {
            linkEl.removeAttribute('href');
            linkEl.removeAttribute('target');
          }
        }
      });
      
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          inputEl.blur();
        }
      });
    }
  });

  const rowCheckbox = tr.querySelector('.stocks-row-checkbox');
  if (rowCheckbox) {
    // Restore checked state if it was already selected
    if (selectedStockIds.has(stock.id)) {
      rowCheckbox.checked = true;
    }
    
    rowCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedStockIds.add(stock.id);
      } else {
        selectedStockIds.delete(stock.id);
        const selectAllCb = document.getElementById("stocks-select-all");
        if (selectAllCb) selectAllCb.checked = false;
      }
      updateDeleteButtonVisibility();
    });
  }

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
