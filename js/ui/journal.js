// ============================================================
// js/ui/journal.js — Daily Journal View & Trade Editor
// ============================================================

import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import { getLocalDateKey, todayKey } from '../utils/date.js';
import { escapeHtml, resizeImageToBase64, buildLinkPreviewIfApplicable, openGoogleDocViewer, renderTile } from '../utils/image.js';
import { openLightbox } from './common.js';
import { saveJournalTrade, deleteJournalTrade, getStrategies, getConcepts, getMistakes } from '../services/journal.js';
import { saveObservation } from '../services/observations.js';
import { openCreateModal, openEditModal } from './dashboard.js';
import {
  journalPrevDayBtn, journalDateInput, journalNextDayBtn, journalTodayBtn,
  journalDayTitle, journalDayMeta, journalAddObsBtn, journalAddTradeBtn,
  journalObsList, journalObsEmpty, journalObsCount, journalTradesList,
  journalTradesEmpty, journalTradesCount, journalTradeModal, journalTradeModalTitle,
  journalTradeBookmarkToggle, journalTradeModalClose, journalTradeModalDate,
  journalWysiwygToolbar, journalTradeTextEditor, journalTradeChartInput,
  journalTradeChartPreviewBtn, journalTradeChartPreviewWrap, journalTradeImageZone,
  journalTradeImageFile, journalTradeImageGrid, journalTradeStrategySelect,
  journalTradeAddStrategyBtn, journalTradeStrategyChips, journalTradeConceptSelect,
  journalTradeAddConceptBtn, journalTradeNewConceptBtn, journalTradeConceptChips,
  journalTradeMistakeSelect, journalTradeAddMistakeBtn, journalTradeNewMistakeBtn,
  journalTradeMistakeChips, journalTradeDeleteBtn, journalTradeCancelBtn,
  journalTradeSaveBtn
} from '../dom.js';

let editingTradeId = null;
let modalImages = [];
let selectedStrategies = [];
let selectedConcepts = [];
let selectedMistakes = [];
let isBookmarked = false;

// Initialize selected journal date in IST
export function initJournal() {
  if (!state.selectedJournalDate) {
    state.selectedJournalDate = todayKey();
  }
  if (journalDateInput) {
    journalDateInput.value = state.selectedJournalDate;
  }
  bindJournalEvents();
  renderJournalView();
}

function bindJournalEvents() {
  // Calendar day navigation
  if (journalPrevDayBtn) {
    journalPrevDayBtn.addEventListener("click", () => changeJournalDate(-1));
  }
  if (journalNextDayBtn) {
    journalNextDayBtn.addEventListener("click", () => changeJournalDate(1));
  }
  if (journalTodayBtn) {
    journalTodayBtn.addEventListener("click", () => {
      state.selectedJournalDate = todayKey();
      if (journalDateInput) journalDateInput.value = state.selectedJournalDate;
      renderJournalView();
    });
  }
  if (journalDateInput) {
    journalDateInput.addEventListener("change", (e) => {
      if (e.target.value) {
        state.selectedJournalDate = e.target.value;
        renderJournalView();
      }
    });
  }

  // Action buttons
  if (journalAddObsBtn) {
    journalAddObsBtn.addEventListener("click", () => {
      openCreateModal({ journalDate: state.selectedJournalDate });
    });
  }
  if (journalAddTradeBtn) {
    journalAddTradeBtn.addEventListener("click", () => {
      openTradeModal(null);
    });
  }

  // WYSIWYG Editor Toolbar
  if (journalWysiwygToolbar) {
    journalWysiwygToolbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".wysiwyg-tool-btn");
      if (!btn) return;
      e.preventDefault();
      const command = btn.dataset.command;
      if (command) {
        document.execCommand(command, false, null);
        if (journalTradeTextEditor) journalTradeTextEditor.focus();
      }
    });
  }

  // Images in Trade Modal
  if (journalTradeImageZone && journalTradeImageFile) {
    journalTradeImageZone.addEventListener("click", (e) => {
      if (e.target !== journalTradeImageFile) {
        journalTradeImageFile.click();
      }
    });

    journalTradeImageFile.addEventListener("change", async () => {
      if (journalTradeImageFile.files && journalTradeImageFile.files.length) {
        await handleTradeImageFiles(journalTradeImageFile.files);
        journalTradeImageFile.value = "";
      }
    });

    // Drag and drop
    journalTradeImageZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      journalTradeImageZone.classList.add("drag-over");
    });
    journalTradeImageZone.addEventListener("dragleave", () => {
      journalTradeImageZone.classList.remove("drag-over");
    });
    journalTradeImageZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      journalTradeImageZone.classList.remove("drag-over");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        await handleTradeImageFiles(e.dataTransfer.files);
      }
    });
  }

  // Clipboard paste inside trade modal
  if (journalTradeModal) {
    journalTradeModal.addEventListener("paste", async (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            showToast("Processing pasted image...");
            try {
              const b64 = await resizeImageToBase64(file);
              modalImages.push(b64);
              renderTradeModalImages();
            } catch (err) {
              console.error(err);
              showToast("Failed to process clipboard image");
            }
          }
          break;
        }
      }
    });
  }

  // Chart link preview button
  if (journalTradeChartPreviewBtn && journalTradeChartInput) {
    journalTradeChartPreviewBtn.addEventListener("click", () => {
      updateChartPreview(journalTradeChartInput.value.trim());
    });
    journalTradeChartInput.addEventListener("blur", () => {
      updateChartPreview(journalTradeChartInput.value.trim());
    });
  }

  // Bookmark toggle in Trade Modal
  if (journalTradeBookmarkToggle) {
    journalTradeBookmarkToggle.addEventListener("click", () => {
      isBookmarked = !isBookmarked;
      journalTradeBookmarkToggle.textContent = isBookmarked ? "★" : "☆";
      journalTradeBookmarkToggle.classList.toggle("active", isBookmarked);
    });
  }

  // Strategy Selector
  if (journalTradeAddStrategyBtn && journalTradeStrategySelect) {
    journalTradeAddStrategyBtn.addEventListener("click", () => {
      const val = journalTradeStrategySelect.value;
      if (val && !selectedStrategies.includes(val)) {
        selectedStrategies.push(val);
        renderSelectedTags();
      }
    });
  }

  // Concept Selector & Quick Add
  if (journalTradeAddConceptBtn && journalTradeConceptSelect) {
    journalTradeAddConceptBtn.addEventListener("click", () => {
      const val = journalTradeConceptSelect.value;
      if (val && !selectedConcepts.includes(val)) {
        selectedConcepts.push(val);
        renderSelectedTags();
      }
    });
  }
  if (journalTradeNewConceptBtn) {
    journalTradeNewConceptBtn.addEventListener("click", async () => {
      const name = prompt("Enter new Concept identifier/name (e.g. C1_Fib_Levels):");
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      try {
        await saveObservation(null, {
          entryType: "concept",
          entryName: cleanName,
          text: `Concept: ${cleanName}`,
          folder: "Technical",
          priority: "medium",
          tags: ["concept", cleanName.toLowerCase()],
          archived: false,
          journalDate: state.selectedJournalDate
        });
        showToast(`Created concept "${cleanName}" in Dashboard`);
        if (!selectedConcepts.includes(cleanName)) {
          selectedConcepts.push(cleanName);
        }
        populateTagSelects();
        renderSelectedTags();
      } catch (err) {
        console.error(err);
        showToast("Failed to create concept");
      }
    });
  }

  // Mistake Selector & Quick Add
  if (journalTradeAddMistakeBtn && journalTradeMistakeSelect) {
    journalTradeAddMistakeBtn.addEventListener("click", () => {
      const val = journalTradeMistakeSelect.value;
      if (val && !selectedMistakes.includes(val)) {
        selectedMistakes.push(val);
        renderSelectedTags();
      }
    });
  }
  if (journalTradeNewMistakeBtn) {
    journalTradeNewMistakeBtn.addEventListener("click", async () => {
      const name = prompt("Enter new Mistake identifier/name (e.g. M1_Chasing_Candles):");
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      try {
        await saveObservation(null, {
          entryType: "mistake",
          entryName: cleanName,
          text: `Mistake: ${cleanName}`,
          folder: "Behaviour",
          priority: "high",
          tags: ["mistake", cleanName.toLowerCase()],
          archived: false,
          journalDate: state.selectedJournalDate
        });
        showToast(`Created mistake "${cleanName}" in Dashboard`);
        if (!selectedMistakes.includes(cleanName)) {
          selectedMistakes.push(cleanName);
        }
        populateTagSelects();
        renderSelectedTags();
      } catch (err) {
        console.error(err);
        showToast("Failed to create mistake");
      }
    });
  }

  // Modal Cancel & Close
  if (journalTradeModalClose) {
    journalTradeModalClose.addEventListener("click", () => closeTradeModal());
  }
  if (journalTradeCancelBtn) {
    journalTradeCancelBtn.addEventListener("click", () => closeTradeModal());
  }
  if (journalTradeModal) {
    journalTradeModal.addEventListener("click", (e) => {
      if (e.target === journalTradeModal) closeTradeModal();
    });
  }

  // Save Trade
  if (journalTradeSaveBtn) {
    journalTradeSaveBtn.addEventListener("click", () => saveCurrentTrade());
  }

  // Delete Trade
  if (journalTradeDeleteBtn) {
    journalTradeDeleteBtn.addEventListener("click", async () => {
      if (!editingTradeId) return;
      if (!confirm("Are you sure you want to delete this journal trade?")) return;
      try {
        await deleteJournalTrade(editingTradeId);
        showToast("Trade deleted");
        closeTradeModal();
      } catch (err) {
        console.error(err);
        showToast("Failed to delete trade");
      }
    });
  }

  // Subscribed data events
  window.addEventListener("observations-updated", () => {
    if (state.activeView === "journal") renderJournalView();
    populateTagSelects();
  });
  window.addEventListener("journal-trades-updated", () => {
    if (state.activeView === "journal") renderJournalView();
  });
}

function changeJournalDate(offsetDays) {
  if (!state.selectedJournalDate) state.selectedJournalDate = todayKey();
  const current = new Date(state.selectedJournalDate + "T12:00:00Z");
  current.setDate(current.getDate() + offsetDays);
  state.selectedJournalDate = getLocalDateKey(current);
  if (journalDateInput) journalDateInput.value = state.selectedJournalDate;
  renderJournalView();
}

export function renderJournalView() {
  if (!state.selectedJournalDate) state.selectedJournalDate = todayKey();

  // Update calendar day title
  const dateObj = new Date(state.selectedJournalDate + "T12:00:00Z");
  const isToday = state.selectedJournalDate === todayKey();
  const dateStr = dateObj.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  if (journalDayTitle) {
    journalDayTitle.textContent = isToday ? `Today • ${dateStr}` : dateStr;
  }

  // Filter Observations for this day
  const dayObs = (state.observations || []).filter((o) => {
    if (o.journalDate) return o.journalDate === state.selectedJournalDate;
    if (o.createdAt) {
      const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return getLocalDateKey(d) === state.selectedJournalDate;
    }
    return false;
  });

  // Filter Trades for this day
  const dayTrades = (state.journalTrades || []).filter((t) => {
    if (t.journalDate) return t.journalDate === state.selectedJournalDate;
    if (t.createdAt) {
      const d = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      return getLocalDateKey(d) === state.selectedJournalDate;
    }
    return false;
  });

  // Update counts
  if (journalObsCount) journalObsCount.textContent = dayObs.length;
  if (journalTradesCount) journalTradesCount.textContent = dayTrades.length;
  if (journalDayMeta) {
    journalDayMeta.textContent = `${dayObs.length} Observation${dayObs.length === 1 ? "" : "s"} • ${dayTrades.length} Trade${dayTrades.length === 1 ? "" : "s"}`;
  }

  // Render Observations Section
  if (journalObsList && journalObsEmpty) {
    journalObsList.innerHTML = "";
    if (dayObs.length === 0) {
      journalObsEmpty.classList.remove("hidden");
    } else {
      journalObsEmpty.classList.add("hidden");
      dayObs.forEach((obs, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "journal-obs-wrap";
        wrap.style.position = "relative";
        wrap.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span class="journal-obs-index-badge">O${idx + 1}</span>
            <span style="font-size:12px; color:var(--text-dim);">${obs.entryName ? escapeHtml(obs.entryName) : "Observation"}</span>
          </div>
          ${renderTile(obs)}
        `;
        // Wire up tile action buttons
        wrap.querySelector(".edit-obs-btn")?.addEventListener("click", () => openEditModal(obs.id));
        journalObsList.appendChild(wrap);
      });
    }
  }

  // Render Trades Section
  if (journalTradesList && journalTradesEmpty) {
    journalTradesList.innerHTML = "";
    if (dayTrades.length === 0) {
      journalTradesEmpty.classList.remove("hidden");
    } else {
      journalTradesEmpty.classList.add("hidden");
      dayTrades.forEach((trade, idx) => {
        const card = createTradeCard(trade, idx + 1);
        journalTradesList.appendChild(card);
      });
    }
  }
}

function createTradeCard(trade, index) {
  const card = document.createElement("div");
  card.className = "journal-trade-card";
  card.dataset.id = trade.id;

  const strategiesHtml = (trade.strategies || []).map(s => {
    // Check if strategy has docLink
    const stratObj = (state.observations || []).find(o => o.entryType === "strategy" && o.entryName === s);
    const docLink = stratObj ? stratObj.docLink : null;
    return `
      <span class="journal-tag-pill journal-tag-strategy" data-strat="${escapeHtml(s)}" data-doc="${escapeHtml(docLink || "")}">
        🎯 ${escapeHtml(s)} ${docLink ? "📄" : ""}
      </span>
    `;
  }).join("");

  const conceptsHtml = (trade.concepts || []).map(c => `
    <span class="journal-tag-pill journal-tag-concept">💡 ${escapeHtml(c)}</span>
  `).join("");

  const mistakesHtml = (trade.mistakes || []).map(m => `
    <span class="journal-tag-pill journal-tag-mistake">⚠️ ${escapeHtml(m)}</span>
  `).join("");

  const images = trade.images || [];
  let imagesHtml = "";
  if (images.length > 0) {
    imagesHtml = `
      <div class="il-image-grid" style="margin-top:8px;">
        ${images.map((img, i) => `
          <div class="il-img-wrap" style="position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--border); max-width:140px; cursor:zoom-in;">
            <img src="${img}" class="trade-card-img" data-idx="${i}" style="width:100%; height:90px; object-fit:cover; display:block;" />
          </div>
        `).join("")}
      </div>
    `;
  }

  let chartHtml = "";
  if (trade.chartUrl) {
    chartHtml = `
      <div class="journal-chart-preview-box">
        <a href="${escapeHtml(trade.chartUrl)}" target="_blank" class="journal-chart-link-btn">
          📈 View Chart: ${escapeHtml(trade.chartUrl)} ↗
        </a>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="journal-trade-header">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="journal-trade-index-badge">T${index}</span>
        <button type="button" class="journal-bookmark-btn ${trade.bookmarked ? "active" : ""}" title="Toggle bookmark">
          ${trade.bookmarked ? "★" : "☆"}
        </button>
      </div>
      <div class="journal-card-actions">
        <button class="tile-action-btn trade-edit-btn" title="Edit Trade">✎</button>
        <button class="tile-action-btn trade-delete-btn" title="Delete Trade">✕</button>
      </div>
    </div>

    <div class="journal-trade-content">
      ${trade.textHtml || escapeHtml(trade.plainText || "(No notes entered)")}
    </div>

    ${chartHtml}
    ${imagesHtml}

    <div class="journal-trade-tags">
      ${strategiesHtml}
      ${conceptsHtml}
      ${mistakesHtml}
    </div>
  `;

  // Attach card event listeners
  card.querySelector(".journal-bookmark-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await saveJournalTrade(trade.id, { bookmarked: !trade.bookmarked });
    } catch (err) {
      console.error(err);
    }
  });

  card.querySelector(".trade-edit-btn").addEventListener("click", () => {
    openTradeModal(trade.id);
  });

  card.querySelector(".trade-delete-btn").addEventListener("click", async () => {
    if (!confirm("Delete this trade entry?")) return;
    try {
      await deleteJournalTrade(trade.id);
      showToast("Trade deleted");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete trade");
    }
  });

  // Strategy doc click
  card.querySelectorAll(".journal-tag-strategy").forEach(pill => {
    const doc = pill.dataset.doc;
    const stratName = pill.dataset.strat;
    if (doc) {
      pill.style.cursor = "pointer";
      pill.addEventListener("click", () => {
        openGoogleDocViewer(doc, `Strategy: ${stratName}`);
      });
    }
  });

  // Lightbox for trade images
  card.querySelectorAll(".trade-card-img").forEach(imgEl => {
    imgEl.addEventListener("click", () => {
      const idx = parseInt(imgEl.dataset.idx, 10) || 0;
      openLightbox(images, idx);
    });
  });

  return card;
}

// -------------------------------------------------------------
// Trade Creation / Edit Modal
// -------------------------------------------------------------
export function openTradeModal(id = null) {
  editingTradeId = id;
  modalImages = [];
  selectedStrategies = [];
  selectedConcepts = [];
  selectedMistakes = [];
  isBookmarked = false;

  populateTagSelects();

  if (journalTradeModalDate) {
    journalTradeModalDate.textContent = state.selectedJournalDate || todayKey();
  }

  if (id) {
    const trade = (state.journalTrades || []).find(t => t.id === id);
    if (!trade) return;
    if (journalTradeModalTitle) journalTradeModalTitle.textContent = "Edit Trade Entry";
    if (journalTradeTextEditor) journalTradeTextEditor.innerHTML = trade.textHtml || escapeHtml(trade.plainText || "");
    if (journalTradeChartInput) journalTradeChartInput.value = trade.chartUrl || "";
    modalImages = [...(trade.images || [])];
    selectedStrategies = [...(trade.strategies || [])];
    selectedConcepts = [...(trade.concepts || [])];
    selectedMistakes = [...(trade.mistakes || [])];
    isBookmarked = !!trade.bookmarked;

    if (journalTradeDeleteBtn) journalTradeDeleteBtn.classList.remove("hidden");
  } else {
    if (journalTradeModalTitle) journalTradeModalTitle.textContent = "New Trade Entry";
    if (journalTradeTextEditor) journalTradeTextEditor.innerHTML = "";
    if (journalTradeChartInput) journalTradeChartInput.value = "";
    if (journalTradeDeleteBtn) journalTradeDeleteBtn.classList.add("hidden");
  }

  if (journalTradeBookmarkToggle) {
    journalTradeBookmarkToggle.textContent = isBookmarked ? "★" : "☆";
    journalTradeBookmarkToggle.classList.toggle("active", isBookmarked);
  }

  renderTradeModalImages();
  renderSelectedTags();
  updateChartPreview(journalTradeChartInput ? journalTradeChartInput.value.trim() : "");

  if (journalTradeModal) {
    journalTradeModal.classList.remove("hidden");
    setTimeout(() => {
      if (journalTradeTextEditor) journalTradeTextEditor.focus();
    }, 100);
  }
}

function closeTradeModal() {
  if (journalTradeModal) journalTradeModal.classList.add("hidden");
  editingTradeId = null;
  modalImages = [];
  selectedStrategies = [];
  selectedConcepts = [];
  selectedMistakes = [];
  isBookmarked = false;
}

async function handleTradeImageFiles(files) {
  if (!files || !files.length) return;
  showToast("Processing trade images...");
  for (const file of files) {
    try {
      const base64 = await resizeImageToBase64(file);
      modalImages.push(base64);
    } catch (err) {
      console.error(err);
      showToast("Failed to process image");
    }
  }
  renderTradeModalImages();
}

function renderTradeModalImages() {
  if (!journalTradeImageGrid) return;
  journalTradeImageGrid.innerHTML = "";
  modalImages.forEach((imgSrc, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "obs-modal-image-preview";
    wrap.innerHTML = `
      <img src="${imgSrc}" />
      <button type="button" class="obs-modal-image-remove" data-index="${idx}">✕</button>
    `;
    wrap.querySelector(".obs-modal-image-remove").addEventListener("click", () => {
      modalImages.splice(idx, 1);
      renderTradeModalImages();
    });
    journalTradeImageGrid.appendChild(wrap);
  });
}

function updateChartPreview(url) {
  if (!journalTradeChartPreviewWrap) return;
  if (!url) {
    journalTradeChartPreviewWrap.innerHTML = "";
    journalTradeChartPreviewWrap.classList.add("hidden");
    return;
  }

  journalTradeChartPreviewWrap.classList.remove("hidden");
  journalTradeChartPreviewWrap.innerHTML = `<span style="font-size:12px; color:var(--text-dim);">Generating chart preview...</span>`;

  const rendered = buildLinkPreviewIfApplicable(url, journalTradeChartPreviewWrap, () => {
    journalTradeChartPreviewWrap.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" style="font-size:12px; color:#60a5fa;">Open Chart Link ↗</a>`;
  });

  if (!rendered) {
    journalTradeChartPreviewWrap.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" style="font-size:12px; color:#60a5fa;">Open Chart Link ↗</a>`;
  }
}

function populateTagSelects() {
  // Strategies
  if (journalTradeStrategySelect) {
    const strats = getStrategies();
    journalTradeStrategySelect.innerHTML = `<option value="">-- Select Strategy --</option>`;
    strats.forEach(s => {
      const name = s.entryName || s.text || "Unnamed Strategy";
      journalTradeStrategySelect.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
  }

  // Concepts
  if (journalTradeConceptSelect) {
    const concepts = getConcepts();
    journalTradeConceptSelect.innerHTML = `<option value="">-- Select Concept --</option>`;
    concepts.forEach(c => {
      const name = c.entryName || c.text || "Unnamed Concept";
      journalTradeConceptSelect.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
  }

  // Mistakes
  if (journalTradeMistakeSelect) {
    const mistakes = getMistakes();
    journalTradeMistakeSelect.innerHTML = `<option value="">-- Select Mistake --</option>`;
    mistakes.forEach(m => {
      const name = m.entryName || m.text || "Unnamed Mistake";
      journalTradeMistakeSelect.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
  }
}

function renderSelectedTags() {
  // Strategy chips
  if (journalTradeStrategyChips) {
    journalTradeStrategyChips.innerHTML = selectedStrategies.map((s, idx) => `
      <span class="trade-chip-selected journal-tag-strategy">
        🎯 ${escapeHtml(s)}
        <button type="button" class="trade-chip-remove" data-type="strat" data-index="${idx}">✕</button>
      </span>
    `).join("");
    journalTradeStrategyChips.querySelectorAll(".trade-chip-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index, 10);
        selectedStrategies.splice(i, 1);
        renderSelectedTags();
      });
    });
  }

  // Concept chips
  if (journalTradeConceptChips) {
    journalTradeConceptChips.innerHTML = selectedConcepts.map((c, idx) => `
      <span class="trade-chip-selected journal-tag-concept">
        💡 ${escapeHtml(c)}
        <button type="button" class="trade-chip-remove" data-type="concept" data-index="${idx}">✕</button>
      </span>
    `).join("");
    journalTradeConceptChips.querySelectorAll(".trade-chip-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index, 10);
        selectedConcepts.splice(i, 1);
        renderSelectedTags();
      });
    });
  }

  // Mistake chips
  if (journalTradeMistakeChips) {
    journalTradeMistakeChips.innerHTML = selectedMistakes.map((m, idx) => `
      <span class="trade-chip-selected journal-tag-mistake">
        ⚠️ ${escapeHtml(m)}
        <button type="button" class="trade-chip-remove" data-type="mistake" data-index="${idx}">✕</button>
      </span>
    `).join("");
    journalTradeMistakeChips.querySelectorAll(".trade-chip-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index, 10);
        selectedMistakes.splice(i, 1);
        renderSelectedTags();
      });
    });
  }
}

async function saveCurrentTrade() {
  const textHtml = journalTradeTextEditor ? journalTradeTextEditor.innerHTML.trim() : "";
  const plainText = journalTradeTextEditor ? journalTradeTextEditor.innerText.trim() : "";
  const chartUrl = journalTradeChartInput ? journalTradeChartInput.value.trim() : "";

  if (!plainText && !chartUrl && modalImages.length === 0 && selectedStrategies.length === 0 && selectedConcepts.length === 0 && selectedMistakes.length === 0) {
    showToast("Please enter trade notes, chart link, image, or tags");
    return;
  }

  const tradeData = {
    journalDate: state.selectedJournalDate || todayKey(),
    textHtml,
    plainText,
    chartUrl,
    images: modalImages,
    strategies: selectedStrategies,
    concepts: selectedConcepts,
    mistakes: selectedMistakes,
    bookmarked: isBookmarked
  };

  if (journalTradeSaveBtn) {
    journalTradeSaveBtn.disabled = true;
    journalTradeSaveBtn.textContent = "Saving...";
  }

  try {
    await saveJournalTrade(editingTradeId, tradeData);
    showToast(editingTradeId ? "Trade updated" : "Trade entry saved");
    closeTradeModal();
  } catch (err) {
    console.error(err);
    showToast("Failed to save trade");
  } finally {
    if (journalTradeSaveBtn) {
      journalTradeSaveBtn.disabled = false;
      journalTradeSaveBtn.textContent = "Save Trade";
    }
  }
}

// Bind to window for backwards compatibility
window.initJournal = initJournal;
window.renderJournalView = renderJournalView;
window.openTradeModal = openTradeModal;
