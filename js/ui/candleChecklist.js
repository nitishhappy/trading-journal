import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import { resizeImageToBase64, attachImagePaste } from '../utils/image.js';
import { saveCandleTemplate, deleteCandleTemplate, saveCandleRun, deleteCandleRun } from '../services/candleChecklist.js';
import { openChecklistModal } from './checklists.js';

// Helper for safe HTML rendering
function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Global variables for active tracking
let activeTemplateId = null;
let currentRunId = null; // Set when editing an existing run
let activeSelections = new Set(); // Stores indices of selected checks: format "category:index" e.g. "obs:2", "dec:0"
let runImageBase64 = null;
let istTimer = null;

// DOM Elements
const templateSelect = document.getElementById("candle-template-select");
const createTemplateBtn = document.getElementById("candle-template-new-btn");
const editTemplateBtn = document.getElementById("candle-template-edit-btn");
const deleteTemplateBtn = document.getElementById("candle-template-delete-btn");
const templateEditorRow = document.getElementById("candle-template-editor-row");
const templateNameInput = document.getElementById("candle-template-name-input");
const saveTemplateBtn = document.getElementById("candle-template-save-btn");
const cancelTemplateBtn = document.getElementById("candle-template-cancel-btn");

const builderObsItems = document.getElementById("builder-obs-items");
const builderDecItems = document.getElementById("builder-dec-items");
const builderAddObsBtn = document.getElementById("builder-add-obs-btn");
const builderAddDecBtn = document.getElementById("builder-add-dec-btn");

const mainChecklistArea = document.getElementById("candle-checklist-main");
const emptyChecklistArea = document.getElementById("candle-checklist-empty");

const runTimeInput = document.getElementById("candle-run-time");
const timeWindowHint = document.getElementById("candle-time-window-hint");

const selectedObsList = document.getElementById("candle-selected-obs-list");
const selectedDecList = document.getElementById("candle-selected-dec-list");
const unselectedObsList = document.getElementById("candle-unselected-obs-list");
const unselectedDecList = document.getElementById("candle-unselected-dec-list");

const selectedCount = document.getElementById("candle-selected-count");
const unselectedCount = document.getElementById("candle-unselected-count");

const linkTradeSelect = document.getElementById("candle-link-trade-select");
const considerFlagInput = document.getElementById("candle-consider-flag");
const runNoteInput = document.getElementById("candle-run-note");
const chartImageFile = document.getElementById("candle-chart-image");
const chartPreview = document.getElementById("candle-chart-preview");
const chartPreviewImg = document.getElementById("candle-chart-preview-img");
const chartRemoveBtn = document.getElementById("candle-chart-remove");

const runResetBtn = document.getElementById("candle-run-reset-btn");
const runSaveBtn = document.getElementById("candle-run-save-btn");

const lastRunsList = document.getElementById("candle-last-runs-list");

const takingTradeYesBtn = document.getElementById("taking-trade-yes");
const takingTradeNoBtn = document.getElementById("taking-trade-no");
const candleChecklistFab = document.getElementById("candle-checklist-fab");
const candleBackBanner = document.getElementById("candle-back-banner");
const candleBackBtn = document.getElementById("candle-back-to-tradelog");

// Tracks the trade ID we came from when clicking "View" from Trade Log
let pendingBackTradeId = null;

// Initialize Candle Checklist View
export function initCandleChecklistUI() {
  setupEventListeners();
  startIstTimer();
  
  // Listen for model state updates
  window.addEventListener('candle-templates-updated', renderTemplateSelect);
  window.addEventListener('candle-runs-updated', () => {
    renderLastRuns();
  });
  window.addEventListener('trades-updated', populateTradesDropdown);
  window.addEventListener('view-changed', (e) => {
    if (e.detail.view === 'candleChecklist') {
      populateTradesDropdown();
      renderTemplateSelect();
      renderLastRuns();
      updateIstField(new Date());
      // Auto-load default template if nothing is selected
      autoLoadDefaultTemplate();
    }
  });

  // Wire back-to-tradelog banner button
  if (candleBackBtn) {
    candleBackBtn.addEventListener('click', () => {
      // Hide the banner
      if (candleBackBanner) candleBackBanner.classList.add('hidden');
      const tradeId = pendingBackTradeId;
      pendingBackTradeId = null;
      // Switch to trade log tab
      const tab = document.querySelector('[data-view="tradelog"]');
      if (tab) tab.click();
      // Re-open the trade modal after tab renders
      setTimeout(() => {
        if (tradeId && typeof window.openTradeModal === 'function') {
          window.openTradeModal(tradeId);
        }
      }, 150);
    });
  }

  // Attach paste handler for screenshot
  if (mainChecklistArea) {
    attachImagePaste(mainChecklistArea, (file) => {
      applyChartImage(file);
      showToast("Chart image pasted from clipboard");
    });
  }
}

// Start live updating of IST candle guide
function startIstTimer() {
  if (istTimer) clearInterval(istTimer);
  istTimer = setInterval(() => {
    // Only update if input is NOT currently focused to avoid annoying user typing
    if (document.activeElement !== runTimeInput && state.activeView === 'candleChecklist') {
      updateIstField(new Date());
    }
  }, 1000);
}

// Compute the T-30s to T+3.5m candle time
function getCandleTimeIST(date) {
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const istStr = date.toLocaleTimeString('en-US', options); // "HH:MM:SS AM/PM"
  
  // Parse elements
  const match = istStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return { display: istStr, windowText: "" };
  
  let hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ss = parseInt(match[3], 10);
  const ampm = match[4].toUpperCase();
  
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  
  const totalSeconds = hh * 3600 + mm * 60 + ss;
  
  // Find a matching 5-minute candle
  for (let min = 0; min < 24 * 60; min += 5) {
    const tSec = min * 60;
    const startSec = tSec - 30;
    const endSec = tSec + 210;
    
    if (totalSeconds >= startSec && totalSeconds < endSec) {
      const targetHour = Math.floor(min / 60) % 24;
      const targetMinute = min % 60;
      const targetDisplay = formatCandleTime(targetHour, targetMinute);
      
      const startDisplay = formatCandleTime(Math.floor((min * 60 - 30) / 3600) % 24, Math.floor(((min * 60 - 30) % 3600) / 60), 30);
      const endDisplay = formatCandleTime(Math.floor((min * 60 + 210) / 3600) % 24, Math.floor(((min * 60 + 210) % 3600) / 60), 30);
      
      return {
        display: targetDisplay,
        windowText: `Active window: ${startDisplay} to ${endDisplay} (logging for ${targetDisplay})`
      };
    }
  }
  
  // Outside any window: round to nearest 5-minute candle
  const nearest5Min = Math.round((hh * 60 + mm + ss / 60) / 5) * 5;
  const targetHour = Math.floor(nearest5Min / 60) % 24;
  const targetMinute = targetHour >= 24 ? 0 : nearest5Min % 60;
  const targetDisplay = formatCandleTime(targetHour, targetMinute);
  
  return {
    display: targetDisplay,
    windowText: `Outside active candle window. Nearest candle: ${targetDisplay}`
  };
}

function formatCandleTime(h, m, s = 0) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  const displayS = s > 0 ? `:${String(s).padStart(2, '0')}` : "";
  return `${displayH}:${displayM}${displayS} ${ampm}`;
}

function updateIstField(date) {
  if (!runTimeInput) return;
  const res = getCandleTimeIST(date);
  runTimeInput.value = res.display;
  timeWindowHint.textContent = res.windowText;
}

// Setup Event Listeners
function setupEventListeners() {
  // Template Select change
  templateSelect.addEventListener("change", () => {
    activeTemplateId = templateSelect.value;
    currentRunId = null;
    activeSelections.clear();
    resetImage();
    
    if (activeTemplateId) {
      editTemplateBtn.classList.remove("hidden");
      deleteTemplateBtn.classList.remove("hidden");
      mainChecklistArea.classList.remove("hidden");
      emptyChecklistArea.classList.add("hidden");
      renderChecklist();
      renderLastRuns();
    } else {
      editTemplateBtn.classList.add("hidden");
      deleteTemplateBtn.classList.add("hidden");
      mainChecklistArea.classList.add("hidden");
      emptyChecklistArea.classList.remove("hidden");
    }
  });

  // Create Template Button click
  createTemplateBtn.addEventListener("click", () => {
    openTemplateEditor(null);
  });

  // Edit Template Button click
  editTemplateBtn.addEventListener("click", () => {
    if (activeTemplateId) {
      openTemplateEditor(activeTemplateId);
    }
  });

  // Delete Template Button click
  deleteTemplateBtn.addEventListener("click", async () => {
    if (!activeTemplateId) return;
    const template = state.candleChecklistTemplates.find(t => t.id === activeTemplateId);
    if (!template) return;
    
    if (confirm(`Are you sure you want to delete the template "${template.name}"? This cannot be undone.`)) {
      try {
        await deleteCandleTemplate(activeTemplateId);
        showToast("Template deleted successfully");
        activeTemplateId = null;
        templateSelect.value = "";
        templateSelect.dispatchEvent(new Event("change"));
      } catch (err) {
        console.error(err);
        showToast("Failed to delete template: " + err.message);
      }
    }
  });

  // Cancel Template Button click
  cancelTemplateBtn.addEventListener("click", () => {
    templateEditorRow.classList.add("hidden");
  });

  // Add items in template builder
  builderAddObsBtn.addEventListener("click", () => {
    addBuilderItemRow(builderObsItems, "");
  });

  builderAddDecBtn.addEventListener("click", () => {
    addBuilderItemRow(builderDecItems, "");
  });

  // Save template definition
  saveTemplateBtn.addEventListener("click", async () => {
    const name = templateNameInput.value.trim();
    if (!name) {
      showToast("Template name is required");
      return;
    }

    const observatory = Array.from(builderObsItems.querySelectorAll("input"))
      .map(i => i.value.trim())
      .filter(Boolean);
    const decision = Array.from(builderDecItems.querySelectorAll("input"))
      .map(i => i.value.trim())
      .filter(Boolean);

    if (observatory.length === 0 && decision.length === 0) {
      showToast("Please add at least one check");
      return;
    }

    const templateId = templateEditorRow.dataset.id || null;
    const templateData = { name, observatory, decision };

    try {
      saveTemplateBtn.disabled = true;
      saveTemplateBtn.textContent = "Saving...";
      await saveCandleTemplate(templateId, templateData);
      showToast("Template saved successfully ✓");
      templateEditorRow.classList.add("hidden");
    } catch (err) {
      console.error(err);
      showToast("Failed to save template: " + err.message);
    } finally {
      saveTemplateBtn.disabled = false;
      saveTemplateBtn.textContent = "Save Template";
    }
  });

  // File selection for chart preview
  chartImageFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) applyChartImage(file);
  });

  // Remove chart image
  chartRemoveBtn.addEventListener("click", () => {
    resetImage();
  });

  // Reset Run
  runResetBtn.addEventListener("click", () => {
    activeSelections.clear();
    currentRunId = null;
    resetImage();
    if (runOutcomeSelect) runOutcomeSelect.value = "";
    if (linkTradeSelect) linkTradeSelect.value = "";
    updateIstField(new Date());
    renderChecklist();
  });

  // Save Run
  runSaveBtn.addEventListener("click", async () => {
    if (!activeTemplateId) return;
    
    const template = state.candleChecklistTemplates.find(t => t.id === activeTemplateId);
    if (!template) return;

    const time = runTimeInput.value.trim();
    if (!time) {
      showToast("Please specify logging time");
      return;
    }

    // Prepare lists of selected / unselected
    const selectedObs = [];
    const selectedDec = [];
    const unselectedObs = [];
    const unselectedDec = [];

    (template.observatory || []).forEach((item, idx) => {
      if (activeSelections.has(`obs:${idx}`)) selectedObs.push(item);
      else unselectedObs.push(item);
    });

    (template.decision || []).forEach((item, idx) => {
      if (activeSelections.has(`dec:${idx}`)) selectedDec.push(item);
      else unselectedDec.push(item);
    });

    const runData = {
      templateId: activeTemplateId,
      templateName: template.name,
      loggingTime: time,
      selected: {
        observatory: selectedObs,
        decision: selectedDec
      },
      unselected: {
        observatory: unselectedObs,
        decision: unselectedDec
      },
      consider: considerFlagInput ? considerFlagInput.checked : false,
      note: runNoteInput ? runNoteInput.value.trim() : "",
      linkedTradeId: linkTradeSelect ? linkTradeSelect.value : "",
      chartImage: runImageBase64
    };

    try {
      runSaveBtn.disabled = true;
      runSaveBtn.textContent = "Saving Run...";
      await saveCandleRun(currentRunId, runData);
      showToast(currentRunId ? "Candle Checklist run updated ✓" : "Candle Checklist run logged successfully ✓");
      
      // Clear after save
      activeSelections.clear();
      currentRunId = null;
      resetImage();
      if (considerFlagInput) considerFlagInput.checked = false;
      if (runNoteInput) runNoteInput.value = "";
      if (linkTradeSelect) linkTradeSelect.value = "";
      updateIstField(new Date());
      renderChecklist();
    } catch (err) {
      console.error(err);
      showToast("Failed to save run: " + err.message);
    } finally {
      runSaveBtn.disabled = false;
      runSaveBtn.textContent = "Save Run";
    }
  });
  // ---- Taking the trade? toggle ----
  if (takingTradeNoBtn && takingTradeYesBtn) {
    const setTakingTrade = (isYes) => {
      takingTradeNoBtn.classList.toggle('active', !isYes);
      takingTradeYesBtn.classList.toggle('active', isYes);
      if (isYes) {
        // open the pre-trade checklist popup immediately
        openChecklistModal();
      }
    };
    takingTradeNoBtn.addEventListener('click', () => setTakingTrade(false));
    takingTradeYesBtn.addEventListener('click', () => setTakingTrade(true));
  }

  // ---- Candle-view FAB → opens pre-trade checklist popup ----
  if (candleChecklistFab) {
    candleChecklistFab.addEventListener('click', () => openChecklistModal());
  }
}

function applyChartImage(file) {
  resizeImageToBase64(file, 1024, 0.75).then((b) => {
    runImageBase64 = b;
    if (chartPreviewImg) chartPreviewImg.src = b;
    if (chartPreview) chartPreview.classList.remove("hidden");
  }).catch(err => {
    console.error("Image resize error", err);
    showToast("Failed to process image");
  });
}

function resetImage() {
  runImageBase64 = null;
  if (chartImageFile) chartImageFile.value = "";
  if (chartPreview) chartPreview.classList.add("hidden");
}

// Populate Template Select Dropdown
function renderTemplateSelect() {
  if (!templateSelect) return;
  const prevValue = templateSelect.value;
  
  templateSelect.innerHTML = `<option value="">— Select Candle Checklist Template —</option>`;
  state.candleChecklistTemplates.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  });

  if (prevValue && state.candleChecklistTemplates.some(t => t.id === prevValue)) {
    templateSelect.value = prevValue;
  } else {
    editTemplateBtn.classList.add("hidden");
    mainChecklistArea.classList.add("hidden");
    emptyChecklistArea.classList.remove("hidden");
  }

  // Keep the settings default-template dropdown in sync
  populateDefaultTemplateSelect();
}

/**
 * Populate the Settings → Candle Checklist default template dropdown.
 * Called whenever templates change and on settings-opened.
 */
export function populateDefaultTemplateSelect() {
  const sel = document.getElementById('default-candle-template-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— None (pick manually) —</option>';
  state.candleChecklistTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  // Restore saved default
  const saved = localStorage.getItem('candleDefaultTemplateId') || '';
  sel.value = saved && state.candleChecklistTemplates.some(t => t.id === saved) ? saved : current;
}

/** Auto-select the user's default template when the tab opens (if nothing already selected). */
function autoLoadDefaultTemplate() {
  const defaultId = localStorage.getItem('candleDefaultTemplateId');
  if (!defaultId) return;
  if (activeTemplateId) return; // already have something selected
  if (!state.candleChecklistTemplates.some(t => t.id === defaultId)) return;

  templateSelect.value = defaultId;
  // Trigger the same logic as manual select
  activeTemplateId = defaultId;
  currentRunId = null;
  activeSelections.clear();
  resetImage();
  editTemplateBtn.classList.remove('hidden');
  mainChecklistArea.classList.remove('hidden');
  emptyChecklistArea.classList.add('hidden');
  renderChecklist();
  renderLastRuns();
}

// Open Template Builder editor
function openTemplateEditor(templateId) {
  templateEditorRow.classList.remove("hidden");
  builderObsItems.innerHTML = "";
  builderDecItems.innerHTML = "";

  if (templateId) {
    const t = state.candleChecklistTemplates.find(x => x.id === templateId);
    if (!t) return;
    templateEditorRow.dataset.id = templateId;
    templateNameInput.value = t.name || "";
    (t.observatory || []).forEach(item => addBuilderItemRow(builderObsItems, item));
    (t.decision || []).forEach(item => addBuilderItemRow(builderDecItems, item));
  } else {
    delete templateEditorRow.dataset.id;
    templateNameInput.value = "";
    addBuilderItemRow(builderObsItems, "");
    addBuilderItemRow(builderDecItems, "");
  }
  
  templateNameInput.focus();
}

function addBuilderItemRow(container, val) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";
  row.innerHTML = `
    <input type="text" placeholder="Enter check..." value="${val}" style="flex:1;" />
    <button type="button" class="btn-small icon-btn" style="color:var(--high); font-size:16px;">✕</button>
  `;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
  });
  container.appendChild(row);
}

// Render dynamic checklists for current running template
function renderChecklist() {
  if (!activeTemplateId) return;
  const template = state.candleChecklistTemplates.find(t => t.id === activeTemplateId);
  if (!template) return;

  selectedObsList.innerHTML = "";
  selectedDecList.innerHTML = "";
  unselectedObsList.innerHTML = "";
  unselectedDecList.innerHTML = "";

  let selectedCountVal = 0;
  let unselectedCountVal = 0;

  // Render Observatory
  (template.observatory || []).forEach((item, index) => {
    const isSelected = activeSelections.has(`obs:${index}`);
    const el = createCheckItemElement(item, `obs:${index}`, isSelected);
    if (isSelected) {
      selectedObsList.appendChild(el);
      selectedCountVal++;
    } else {
      unselectedObsList.appendChild(el);
      unselectedCountVal++;
    }
  });

  // Render Decision
  (template.decision || []).forEach((item, index) => {
    const isSelected = activeSelections.has(`dec:${index}`);
    const el = createCheckItemElement(item, `dec:${index}`, isSelected);
    if (isSelected) {
      selectedDecList.appendChild(el);
      selectedCountVal++;
    } else {
      unselectedDecList.appendChild(el);
      unselectedCountVal++;
    }
  });

  selectedCount.textContent = selectedCountVal;
  unselectedCount.textContent = unselectedCountVal;
}

function createCheckItemElement(text, key, isSelected) {
  const div = document.createElement("div");
  div.className = "candle-check-item";
  div.style.padding = "8px 12px";
  div.style.borderRadius = "8px";
  div.style.background = isSelected ? "var(--low-glow)" : "var(--high-glow)";
  div.style.border = `1px solid ${isSelected ? "var(--low)" : "var(--high)"}`;
  div.style.color = "var(--text)";
  div.style.cursor = "pointer";
  div.style.fontSize = "13px";
  div.style.display = "flex";
  div.style.justifyContent = "space-between";
  div.style.alignItems = "center";
  div.style.transition = "opacity 0.2s, transform 0.2s";
  
  div.innerHTML = `
    <span>${text}</span>
    <span style="font-size:12px;">${isSelected ? "✔" : "✕"}</span>
  `;

  div.addEventListener("click", () => {
    // Dynamic transition visual feedback
    div.style.opacity = "0.5";
    div.style.transform = "scale(0.95)";
    
    setTimeout(() => {
      if (isSelected) {
        activeSelections.delete(key);
      } else {
        activeSelections.add(key);
      }
      renderChecklist();
    }, 150);
  });

  return div;
}

// Populate Trades Dropdown (latest -> oldest)
function populateTradesDropdown() {
  if (!linkTradeSelect) return;
  linkTradeSelect.innerHTML = `<option value="">— Not linked —</option>`;
  
  // Sort trades: newest first
  const sorted = [...state.trades].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  sorted.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.date} ${t.capital ? `(Cap: ₹${t.capital})` : ""} PL: ${t.net >= 0 ? `+₹${t.net}` : `-₹${Math.abs(t.net)}`} ${t.comments ? `— ${t.comments.slice(0, 20)}` : ""}`;
    linkTradeSelect.appendChild(opt);
  });
}

// Render previous runs for active template (LIFO order)
function renderLastRuns() {
  if (!lastRunsList) return;
  lastRunsList.innerHTML = "";

  if (!activeTemplateId) return;

  const runs = state.candleChecklistRuns
    .filter(r => r.templateId === activeTemplateId && r.consider === true);

  if (runs.length === 0) {
    lastRunsList.innerHTML = `<p style="color:var(--text-dim); font-size:13px; text-align:center;">No previous runs for this template yet.</p>`;
    return;
  }

  runs.forEach(run => {
    const card = document.createElement("div");
    card.style.background = "var(--surface-2)";
    card.style.border = "1px solid var(--border)";
    card.style.borderRadius = "var(--radius)";
    card.style.padding = "12px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "8px";

    const totalSelected = (run.selected?.observatory || []).length + (run.selected?.decision || []).length;
    const totalUnselected = (run.unselected?.observatory || []).length + (run.unselected?.decision || []).length;
    const total = totalSelected + totalUnselected;

    let imageTag = "";
    if (run.chartImage) {
      imageTag = `
        <div style="margin-top:4px;">
          <img src="${run.chartImage}" style="max-width:100%; max-height:80px; border-radius:6px; cursor:zoom-in; border: 1px solid var(--border);" onclick="window.openLightbox(['${run.chartImage}'], 0)" />
        </div>
      `;
    }

    let tradeText = "";
    if (run.linkedTradeId) {
      const tr = state.trades.find(t => t.id === run.linkedTradeId);
      if (tr) {
        tradeText = `<span style="font-size:11px; color:var(--accent); font-family:var(--font-mono);">Linked Trade: ${tr.date}</span>`;
      }
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600; font-size:14px; font-family:var(--font-mono); color:var(--text);">${run.loggingTime}</span>
        ${run.consider ? `<span class="trade-cl-outcome outcome-W" style="margin:0; font-size:10px;">Considered</span>` : ""}
      </div>
      <div style="font-size:12px; color:var(--text-dim);">
        Passed: <span style="color:var(--low); font-weight:600;">${totalSelected}</span> / ${total}
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <div style="font-size:11px; color:var(--text-dim); max-height: 48px; overflow-y: auto;">
          <strong>Selected Observatory:</strong> ${(run.selected?.observatory || []).join(", ") || "None"}
        </div>
        <div style="font-size:11px; color:var(--text-dim); max-height: 48px; overflow-y: auto;">
          <strong>Selected Decision:</strong> ${(run.selected?.decision || []).join(", ") || "None"}
        </div>
      </div>
      ${run.note ? `<div style="font-size:12px; color:var(--text); background:var(--bg); padding:6px 8px; border-radius:6px; border:1px solid var(--border); margin-top:4px;"><strong>Note:</strong> ${escHtml(run.note)}</div>` : ""}
      ${tradeText}
      ${imageTag}
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
        <button class="btn-small btn-secondary edit-run-btn" style="padding: 4px 8px; font-size:11px;">Edit Run</button>
        <button class="btn-small delete-run-btn" style="padding: 4px 8px; font-size:11px; background:rgba(232,60,56,0.1); color:var(--high); border:1px solid rgba(232,60,56,0.3);">Delete</button>
      </div>
    `;

    card.querySelector(".edit-run-btn").addEventListener("click", () => {
      loadRunForEditing(run);
    });

    card.querySelector(".delete-run-btn").addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this candle checklist run?")) {
        try {
          await deleteCandleRun(run.id);
          showToast("Candle checklist run deleted");
        } catch (e) {
          console.error(e);
          showToast("Failed to delete run");
        }
      }
    });

    lastRunsList.appendChild(card);
  });
}

function loadRunForEditing(run) {
  currentRunId = run.id;
  runTimeInput.value = run.loggingTime || "";
  
  if (considerFlagInput) considerFlagInput.checked = !!run.consider;
  if (runNoteInput) runNoteInput.value = run.note || "";
  if (linkTradeSelect) linkTradeSelect.value = run.linkedTradeId || "";
  
  if (run.chartImage) {
    runImageBase64 = run.chartImage;
    if (chartPreviewImg) chartPreviewImg.src = run.chartImage;
    if (chartPreview) chartPreview.classList.remove("hidden");
  } else {
    resetImage();
  }

  // Load selections
  activeSelections.clear();
  const template = state.candleChecklistTemplates.find(t => t.id === activeTemplateId);
  if (template) {
    (template.observatory || []).forEach((item, idx) => {
      if ((run.selected?.observatory || []).includes(item)) {
        activeSelections.add(`obs:${idx}`);
      }
    });

    (template.decision || []).forEach((item, idx) => {
      if ((run.selected?.decision || []).includes(item)) {
        activeSelections.add(`dec:${idx}`);
      }
    });
  }

  renderChecklist();
  showToast(`Loaded checklist run at ${run.loggingTime} for editing`);
}

/**
 * Render candle checklist runs linked to a trade inside the Trade Modal.
 * Called from tradelog.js when a trade entry is opened for editing.
 * @param {string|null} tradeId  - the trade's Firestore document ID
 */
export function renderLinkedCandleRuns(tradeId) {
  const wrapper   = document.getElementById('trade-linked-candle-runs');
  const container = document.getElementById('trade-candle-run-list');
  if (!wrapper || !container) return;

  const linked = (state.candleChecklistRuns || []).filter(r => r.linkedTradeId && r.linkedTradeId === tradeId);

  if (!tradeId || linked.length === 0) {
    wrapper.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  wrapper.classList.remove('hidden');
  container.innerHTML = '';

  // Sort newest first (LIFO)
  const sorted = [...linked].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
    return tb - ta;
  });

  sorted.forEach(run => {
    const template = (state.candleChecklistTemplates || []).find(t => t.id === run.templateId);
    const templateName = run.templateName || template?.name || 'Candle Checklist';
    const selObs = (run.selected?.observatory || []).length;
    const selDec = (run.selected?.decision   || []).length;
    const totObs = selObs + (run.unselected?.observatory || []).length;
    const totDec = selDec + (run.unselected?.decision   || []).length;
    const total  = totObs + totDec;
    const passed = selObs + selDec;
    const pct    = total > 0 ? Math.round((passed / total) * 100) : 0;
    const pctClass = pct === 100 ? 'all-pass' : pct >= 70 ? 'partial' : 'low-pass';

    const outcomeMap = { W: 'outcome-W', L: 'outcome-L', CTC: 'outcome-CTC' };
    const outcomeHtml = run.outcome
      ? `<span class="trade-cl-outcome ${outcomeMap[run.outcome] || ''}">${run.outcome}</span>`
      : '';

    const row = document.createElement('div');
    row.className = 'trade-cl-row';
    row.innerHTML = `
      <span class="trade-cl-name">${templateName}</span>
      <span style="font-size:11px; color:var(--text-dim); font-family:var(--font-mono);">${run.loggingTime || ''}</span>
      <span class="trade-cl-score ${pctClass}">${passed}/${total} (${pct}%)</span>
      ${outcomeHtml}
      <button class="btn-small trade-cl-edit-btn" data-id="${run.id}">View</button>
    `;

    // "View" button — switch to candle checklist tab and load this run
    row.querySelector('.trade-cl-edit-btn').addEventListener('click', () => {
      // Store the originating trade so back-banner can return
      pendingBackTradeId = tradeId;

      // Close trade modal
      const tradeModal = document.getElementById('trade-modal');
      if (tradeModal) tradeModal.classList.add('hidden');

      // Switch to candle checklist tab
      const tab = document.querySelector('[data-view="candleChecklist"]');
      if (tab) tab.click();

      // After tab renders, load the run and show back banner
      setTimeout(() => {
        loadRunForEditing(run);
        if (candleBackBanner) candleBackBanner.classList.remove('hidden');
      }, 150);
    });

    container.appendChild(row);
  });
}

// Auto-initialize UI on import
initCandleChecklistUI();
