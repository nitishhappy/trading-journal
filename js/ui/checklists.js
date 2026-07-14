import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';
import { resizeImageToBase64, attachImagePaste } from '../utils/image.js';
import {
  checklistRef, saveChecklist, deleteChecklist, CHECKLIST_DEFAULT_ID
} from '../services/checklists.js';
import { updateExportHintAndPreview, exportToCSV, exportToPDF, normalizeForJsonExport, downloadBlob } from '../utils/export.js';

// ===================== Module State =====================
let checklists = {}; // { id: { name, items } }
let activeChecklistId = null;
let checklistChecked = new Set();
let checklistLogImageBase64 = null;
let editingChecklistLogId = null;

// ===================== DOM Refs — Checklist Run Modal =====================
const checklistFab        = document.getElementById("checklist-fab");
const checklistModal      = document.getElementById("checklist-modal");
const checklistModalClose = document.getElementById("checklist-modal-close");
const checklistPicker     = document.getElementById("checklist-picker");
const checklistItemsBody  = document.getElementById("checklist-items-body");
const checklistScoreFill  = document.getElementById("checklist-score-fill");
const checklistScoreText  = document.getElementById("checklist-score-text");
const checklistResetBtn   = document.getElementById("checklist-reset-btn");
const checklistLogBtn     = document.getElementById("checklist-log-btn");

// ===================== DOM Refs — Result / Log Modal =====================
const checklistResultModal = document.getElementById("checklist-result-modal");
const clResultClose        = document.getElementById("cl-result-close");
const clResultSummary      = document.getElementById("cl-result-summary");
const clOutcome            = document.getElementById("cl-outcome");
const clPreTrade           = document.getElementById("cl-pre-trade");
const clPostTrade          = document.getElementById("cl-post-trade");
const clChartImage         = document.getElementById("cl-chart-image");
const clChartPreview       = document.getElementById("cl-chart-preview");
const clChartPreviewImg    = document.getElementById("cl-chart-preview-img");
const clChartRemove        = document.getElementById("cl-chart-remove");
const clLinkTrade          = document.getElementById("cl-link-trade");
const clResultDismiss      = document.getElementById("cl-result-dismiss");
const clResultSave         = document.getElementById("cl-result-save");

// ===================== DOM Refs — Settings Management =====================
const clManageSelect  = document.getElementById("cl-manage-select");
const clNewBtn        = document.getElementById("cl-new-btn");
const clDeleteClBtn   = document.getElementById("cl-delete-cl-btn");
const clNameRow       = document.getElementById("cl-name-row");
const clNameInput     = document.getElementById("cl-name-input");
const clNameSaveBtn   = document.getElementById("cl-name-save-btn");
const clItemsEditor   = document.getElementById("cl-items-editor");
const clNewItemInput  = document.getElementById("cl-new-item-input");
const clAddItemBtn    = document.getElementById("cl-add-item-btn");

// ===================== DOM Refs — Export Modal =====================
const exportOpenBtn       = document.getElementById("export-open-btn");
const exportModal         = document.getElementById("export-modal");
const exportModalClose    = document.getElementById("export-modal-close");
const exportFormatSelect  = document.getElementById("export-format-select");
const exportRangeSelect   = document.getElementById("export-range-select");
const exportCustomRow     = document.getElementById("export-custom-range-row");
const exportStartDate     = document.getElementById("export-start-date");
const exportEndDate       = document.getElementById("export-end-date");
const exportIncludeObs    = document.getElementById("export-include-obs");
const exportIncludeTrades = document.getElementById("export-include-trades");
const exportPreviewCount  = document.getElementById("export-preview-count");
const exportCancelBtn     = document.getElementById("export-cancel-btn");
const exportConfirmBtn    = document.getElementById("export-confirm-btn");

// ===================== Utility =====================
function formatNum(n) {
  if (n === undefined || n === null || n === "") return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ===================== Firestore: Load Checklists =====================
export async function loadChecklists() {
  try {
    const snap = await checklistRef().get();
    checklists = {};
    snap.forEach((doc) => { checklists[doc.id] = doc.data(); });
    if (!checklists[CHECKLIST_DEFAULT_ID]) {
      const def = {
        name: "Default",
        items: [
          "Market trend confirmed (H1/H4)",
          "Setup aligns with my strategy",
          "Risk/Reward at least 1:2",
          "Stop loss placed at key level",
          "Position size calculated",
          "No news event in next 30 min",
          "Entry price matches plan",
          "I am in the right mental state",
        ],
      };
      await checklistRef().doc(CHECKLIST_DEFAULT_ID).set(def);
      checklists[CHECKLIST_DEFAULT_ID] = def;
    }
    renderChecklistPicker();
    renderChecklistManageSelect();
  } catch (err) {
    console.error("loadChecklists error", err);
  }
}

async function saveChecklistLocal(id, data) {
  await checklistRef().doc(id).set(data);
  checklists[id] = data;
}

async function deleteChecklistLocal(id) {
  if (id === CHECKLIST_DEFAULT_ID) { showToast("Can'\''t delete the default checklist"); return; }
  await checklistRef().doc(id).delete();
  delete checklists[id];
}

// ===================== Checklist Run Modal =====================
if (checklistFab) checklistFab.addEventListener("click", () => openChecklistModal());

export function openChecklistModal() {
  renderChecklistPicker();
  const firstId = Object.keys(checklists)[0] || CHECKLIST_DEFAULT_ID;
  activeChecklistId = checklistPicker ? (checklistPicker.value || firstId) : firstId;
  checklistChecked = new Set();
  renderChecklistItems();
  if (checklistModal) checklistModal.classList.remove("hidden");
}

if (checklistModalClose) checklistModalClose.addEventListener("click", () => checklistModal.classList.add("hidden"));

if (checklistPicker) {
  checklistPicker.addEventListener("change", () => {
    activeChecklistId = checklistPicker.value;
    checklistChecked = new Set();
    renderChecklistItems();
  });
}

function renderChecklistPicker() {
  if (!checklistPicker) return;
  const prev = checklistPicker.value;
  checklistPicker.innerHTML = "";
  Object.entries(checklists).forEach(([id, cl]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cl.name || id;
    checklistPicker.appendChild(opt);
  });
  if (prev && checklists[prev]) checklistPicker.value = prev;
}

function renderChecklistItems() {
  if (!checklistItemsBody) return;
  const cl = checklists[activeChecklistId];
  if (!cl) { checklistItemsBody.innerHTML = "<p style='color:var(--text-dim);padding:16px'>No items.</p>"; return; }
  checklistItemsBody.innerHTML = "";
  (cl.items || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "checklist-item-row" + (checklistChecked.has(i) ? " checked" : "");
    row.addEventListener("click", () => {
      if (checklistChecked.has(i)) checklistChecked.delete(i);
      else checklistChecked.add(i);
      row.classList.toggle("checked", checklistChecked.has(i));
      updateChecklistScore();
    });
    const circle = document.createElement("div");
    circle.className = "checklist-item-check";
    circle.textContent = checklistChecked.has(i) ? "✓" : "";
    const text = document.createElement("span");
    text.className = "checklist-item-text";
    text.textContent = item;
    row.appendChild(circle);
    row.appendChild(text);
    checklistItemsBody.appendChild(row);
  });
  updateChecklistScore();
}

function updateChecklistScore() {
  if (!checklistScoreFill || !checklistScoreText) return;
  const cl = checklists[activeChecklistId];
  if (!cl) return;
  const total = (cl.items || []).length;
  const passed = checklistChecked.size;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  checklistScoreFill.style.width = pct + "%";
  checklistScoreText.textContent = `${passed} / ${total} passed`;
  checklistScoreFill.style.background =
    pct === 100 ? "var(--grad-green)"
    : pct >= 70 ? "linear-gradient(90deg, var(--medium), #F5AA60)"
    : "linear-gradient(90deg, var(--high), #F08060)";
}

if (checklistResetBtn) {
  checklistResetBtn.addEventListener("click", () => {
    checklistChecked = new Set();
    renderChecklistItems();
  });
}

if (checklistLogBtn) {
  checklistLogBtn.addEventListener("click", () => {
    try {
      const cl = checklists[activeChecklistId];
      if (!cl) { showToast("No checklist selected"); return; }
      const total = (cl.items || []).length;
      const passed = checklistChecked.size;
      const failed = (cl.items || []).filter((_, i) => !checklistChecked.has(i));
      const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

      if (clResultSummary) {
        clResultSummary.innerHTML = "";
        const scoreEl = document.createElement("div");
        scoreEl.className = `cl-result-score-big ${pct === 100 ? "all-pass" : pct >= 70 ? "partial" : "low-pass"}`;
        scoreEl.textContent = `${passed} / ${total}`;
        const labelEl = document.createElement("div");
        labelEl.className = "cl-result-label";
        labelEl.textContent = pct === 100 ? "All checks passed ✓" : `${pct}% passed — ${total - passed} item${total - passed !== 1 ? "s" : ""} not confirmed`;
        clResultSummary.appendChild(scoreEl);
        clResultSummary.appendChild(labelEl);
        if (failed.length > 0) {
          const failList = document.createElement("div");
          failList.className = "cl-failed-list";
          failed.forEach((item) => {
            const el = document.createElement("div");
            el.className = "cl-failed-item";
            el.textContent = item;
            failList.appendChild(el);
          });
          clResultSummary.appendChild(failList);
        }
      }

      if (clLinkTrade) {
        clLinkTrade.innerHTML = "<option value=''>— Not linked —</option>";
        const todayStr = new Date().toISOString().slice(0, 10);
        const monthStr = todayStr.slice(0, 7);
        (state.trades || []).forEach((t) => {
          const tDate = typeof t.date === "string" ? t.date : "";
          if (tDate === todayStr || tDate.startsWith(monthStr)) {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = `${tDate || "Undated"} — ${t.numTrades || 0} trades (Net: ${formatNum(t.netPL)})`;
            clLinkTrade.appendChild(opt);
          }
        });
      }

      if (clOutcome) clOutcome.value = "";
      if (clPreTrade) clPreTrade.value = "";
      if (clPostTrade) clPostTrade.value = "";
      if (clChartPreview) clChartPreview.classList.add("hidden");
      checklistLogImageBase64 = null;
      if (clChartImage) clChartImage.value = "";

      if (checklistModal) checklistModal.classList.add("hidden");
      if (checklistResultModal) checklistResultModal.classList.remove("hidden");
    } catch (err) {
      console.error("checklistLogBtn handler error:", err);
      showToast("Could not open log screen: " + err.message);
    }
  });
}

// ===================== Log Editor (opened from trade modal) =====================
export function openChecklistLogEditor(log) {
  editingChecklistLogId = log.id;
  activeChecklistId = log.checklistId || null;

  // Close the trade modal if open
  const tradeModal = document.getElementById("trade-modal");
  if (tradeModal) tradeModal.classList.add("hidden");

  const pct = log.total > 0 ? Math.round((log.passed / log.total) * 100) : 0;
  if (clResultSummary) {
    clResultSummary.innerHTML = "";
    const scoreEl = document.createElement("div");
    scoreEl.className = `cl-result-score-big ${pct === 100 ? "all-pass" : pct >= 70 ? "partial" : "low-pass"}`;
    scoreEl.textContent = `${log.passed} / ${log.total}`;
    const labelEl = document.createElement("div");
    labelEl.className = "cl-result-label";
    labelEl.textContent = `${log.checklistName || "Checklist"} — editing saved log`;
    clResultSummary.appendChild(scoreEl);
    clResultSummary.appendChild(labelEl);
    if ((log.failed || []).length > 0) {
      const failList = document.createElement("ul");
      failList.className = "cl-result-failures";
      (log.failed || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        failList.appendChild(li);
      });
      clResultSummary.appendChild(failList);
    }
  }

  if (clOutcome) clOutcome.value = log.outcome || "";
  if (clPreTrade) clPreTrade.value = log.preTrade || "";
  if (clPostTrade) clPostTrade.value = log.postTrade || "";

  checklistLogImageBase64 = log.chartImage || null;
  if (checklistLogImageBase64 && clChartPreviewImg && clChartPreview) {
    clChartPreviewImg.src = checklistLogImageBase64;
    clChartPreview.classList.remove("hidden");
  } else if (clChartPreview) {
    clChartPreview.classList.add("hidden");
    if (clChartImage) clChartImage.value = "";
  }

  if (clLinkTrade) {
    clLinkTrade.innerHTML = "<option value=''>— Not linked —</option>";
    state.trades.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.date + (t.comments ? ` — ${t.comments.slice(0, 30)}` : "");
      clLinkTrade.appendChild(opt);
    });
    clLinkTrade.value = log.linkedTradeId || "";
  }

  if (clResultSave) clResultSave.textContent = "Update log";
  if (clResultDismiss) clResultDismiss.textContent = "Cancel";
  if (checklistResultModal) checklistResultModal.classList.remove("hidden");
}

// ===================== Linked checklists in Trade Modal =====================
export function renderLinkedChecklists(tradeId) {
  const container = document.getElementById("trade-cl-list");
  const wrapper = document.getElementById("trade-linked-checklists");
  if (!container || !wrapper) return;

  const linked = state.checklistLogs.filter((log) => log.linkedTradeId === tradeId);
  if (linked.length === 0) {
    wrapper.classList.add("hidden");
    return;
  }
  wrapper.classList.remove("hidden");
  container.innerHTML = "";
  linked.forEach((log) => {
    const pct = log.total > 0 ? Math.round((log.passed / log.total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "trade-cl-row";
    row.innerHTML = `
      <span class="trade-cl-name">${log.checklistName || "Checklist"}</span>
      <span class="trade-cl-score ${pct === 100 ? "all-pass" : pct >= 70 ? "partial" : "low-pass"}">${log.passed}/${log.total} (${pct}%)</span>
      ${log.outcome ? `<span class="trade-cl-outcome outcome-${log.outcome}">${log.outcome}</span>` : ""}
      <button class="btn-small trade-cl-edit-btn" data-id="${log.id}">Edit</button>
    `;
    row.querySelector(".trade-cl-edit-btn").addEventListener("click", () => {
      openChecklistLogEditor(log);
    });
    container.appendChild(row);
  });
}

// ===================== Chart Image =====================
function applyChartImageFile(file) {
  resizeImageToBase64(file, 1024, 0.75).then((b) => {
    checklistLogImageBase64 = b;
    if (clChartPreviewImg) clChartPreviewImg.src = b;
    if (clChartPreview) clChartPreview.classList.remove("hidden");
  });
}

if (clChartImage) {
  clChartImage.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    applyChartImageFile(file);
  });
}

if (checklistResultModal) {
  attachImagePaste(checklistResultModal, (file) => {
    applyChartImageFile(file);
    showToast("Chart image pasted from clipboard");
  });
}

if (clChartRemove) {
  clChartRemove.addEventListener("click", () => {
    checklistLogImageBase64 = null;
    if (clChartImage) clChartImage.value = "";
    if (clChartPreview) clChartPreview.classList.add("hidden");
  });
}

// ===================== Result Modal Close/Dismiss/Save =====================
if (clResultClose) {
  clResultClose.addEventListener("click", () => {
    const wasEditing = !!editingChecklistLogId;
    if (checklistResultModal) checklistResultModal.classList.add("hidden");
    editingChecklistLogId = null;
    if (clResultSave) clResultSave.textContent = "Save log";
    if (clResultDismiss) clResultDismiss.textContent = "Dismiss";
    if (!wasEditing && checklistModal) checklistModal.classList.remove("hidden");
  });
}

if (clResultDismiss) {
  clResultDismiss.addEventListener("click", () => {
    const wasEditing = !!editingChecklistLogId;
    if (checklistResultModal) checklistResultModal.classList.add("hidden");
    editingChecklistLogId = null;
    if (clResultSave) clResultSave.textContent = "Save log";
    if (clResultDismiss) clResultDismiss.textContent = "Dismiss";
    if (!wasEditing) showToast("Checklist run dismissed (not logged)");
  });
}

if (clResultSave) {
  clResultSave.addEventListener("click", async () => {
    clResultSave.disabled = true;
    clResultSave.textContent = editingChecklistLogId ? "Updating…" : "Saving…";
    try {
      const updateData = {
        outcome:      clOutcome ? (clOutcome.value || null) : null,
        preTrade:     clPreTrade ? (clPreTrade.value.trim() || null) : null,
        postTrade:    clPostTrade ? (clPostTrade.value.trim() || null) : null,
        chartImage:   checklistLogImageBase64 || null,
        linkedTradeId: clLinkTrade ? (clLinkTrade.value || null) : null,
      };

      if (editingChecklistLogId) {
        await db.collection("users").doc(state.currentUser.uid)
          .collection("checklistLogs").doc(editingChecklistLogId)
          .update(updateData);
        showToast("Checklist log updated ✓");
      } else {
        const cl = checklists[activeChecklistId];
        const total = (cl?.items || []).length;
        const passed = checklistChecked.size;
        const logData = {
          type: "checklistRun",
          checklistId: activeChecklistId,
          checklistName: cl?.name || "Default",
          total,
          passed,
          failed: (cl?.items || []).filter((_, i) => !checklistChecked.has(i)),
          ...updateData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection("users").doc(state.currentUser.uid).collection("checklistLogs").add(logData);
        showToast("Checklist run logged ✓");
      }

      if (checklistResultModal) checklistResultModal.classList.add("hidden");
      editingChecklistLogId = null;
      if (clResultSave) clResultSave.textContent = "Save log";
      if (clResultDismiss) clResultDismiss.textContent = "Dismiss";
    } catch (err) {
      console.error(err);
      showToast("Could not save log: " + err.message);
    } finally {
      clResultSave.disabled = false;
      clResultSave.textContent = editingChecklistLogId ? "Update log" : "Save log";
    }
  });
}

// ===================== Checklist Management (Settings) =====================
export function renderChecklistManageSelect() {
  if (!clManageSelect) return;
  const prev = clManageSelect.value;
  clManageSelect.innerHTML = "";
  Object.entries(checklists).forEach(([id, cl]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cl.name || id;
    clManageSelect.appendChild(opt);
  });
  if (prev && checklists[prev]) clManageSelect.value = prev;
  renderChecklistItemsEditor();
}

if (clManageSelect) clManageSelect.addEventListener("change", () => renderChecklistItemsEditor());

function renderChecklistItemsEditor() {
  if (!clManageSelect || !clItemsEditor) return;
  const id = clManageSelect.value;
  const cl = checklists[id];
  clItemsEditor.innerHTML = "";
  if (!cl) return;
  (cl.items || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "cl-setting-item";
    const drag = document.createElement("span");
    drag.className = "cl-setting-drag-handle";
    drag.textContent = "⠿";
    const text = document.createElement("span");
    text.className = "cl-setting-item-text";
    text.textContent = item;
    const del = document.createElement("button");
    del.className = "cl-setting-delete";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      const updated = { ...cl, items: cl.items.filter((_, j) => j !== i) };
      await saveChecklistLocal(id, updated);
      renderChecklistManageSelect();
      renderChecklistPicker();
    });
    row.appendChild(drag);
    row.appendChild(text);
    row.appendChild(del);
    clItemsEditor.appendChild(row);
  });
}

if (clNewBtn) {
  clNewBtn.addEventListener("click", () => {
    if (clNameRow) clNameRow.classList.toggle("hidden");
    if (clNameInput) {
      clNameInput.value = "";
      if (clNameRow && !clNameRow.classList.contains("hidden")) clNameInput.focus();
    }
  });
}

if (clNameSaveBtn) {
  clNameSaveBtn.addEventListener("click", async () => {
    const name = clNameInput ? clNameInput.value.trim() : "";
    if (!name) { showToast("Enter a name"); return; }
    const id = "cl_" + Date.now();
    await saveChecklistLocal(id, { name, items: [] });
    if (clManageSelect) clManageSelect.value = id;
    if (clNameRow) clNameRow.classList.add("hidden");
    if (clNameInput) clNameInput.value = "";
    renderChecklistManageSelect();
    renderChecklistPicker();
    showToast(`"${name}" created`);
  });
}

if (clDeleteClBtn) {
  clDeleteClBtn.addEventListener("click", async () => {
    const id = clManageSelect ? clManageSelect.value : null;
    if (!id || !checklists[id]) return;
    if (!confirm(`Delete checklist "${checklists[id].name}"? This cannot be undone.`)) return;
    try {
      await deleteChecklistLocal(id);
      renderChecklistManageSelect();
      renderChecklistPicker();
      showToast("Checklist deleted");
    } catch (err) {
      showToast("Could not delete: " + err.message);
    }
  });
}

if (clAddItemBtn) {
  clAddItemBtn.addEventListener("click", async () => {
    const text = clNewItemInput ? clNewItemInput.value.trim() : "";
    if (!text) return;
    const id = clManageSelect ? clManageSelect.value : null;
    const cl = checklists[id];
    if (!cl) return;
    const updated = { ...cl, items: [...(cl.items || []), text] };
    await saveChecklistLocal(id, updated);
    if (clNewItemInput) clNewItemInput.value = "";
    renderChecklistItemsEditor();
    renderChecklistPicker();
    showToast("Item added");
  });
}

if (clNewItemInput) {
  clNewItemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { if (clAddItemBtn) clAddItemBtn.click(); }
  });
}

// ===================== Export Modal =====================
if (exportOpenBtn) {
  exportOpenBtn.addEventListener("click", () => {
    if (exportFormatSelect) exportFormatSelect.value = "csv";
    if (exportRangeSelect) exportRangeSelect.value = "all";
    if (exportCustomRow) exportCustomRow.classList.add("hidden");
    if (exportIncludeObs) exportIncludeObs.checked = true;
    if (exportIncludeTrades) exportIncludeTrades.checked = true;
    updateExportHintAndPreview();
    if (exportModal) exportModal.classList.remove("hidden");
  });
}

if (exportModalClose) exportModalClose.addEventListener("click", () => { if (exportModal) exportModal.classList.add("hidden"); });
if (exportCancelBtn) exportCancelBtn.addEventListener("click", () => { if (exportModal) exportModal.classList.add("hidden"); });

if (exportFormatSelect) exportFormatSelect.addEventListener("change", updateExportHintAndPreview);
if (exportRangeSelect) {
  exportRangeSelect.addEventListener("change", () => {
    if (exportCustomRow) exportCustomRow.classList.toggle("hidden", exportRangeSelect.value !== "custom");
    updateExportHintAndPreview();
  });
}
if (exportStartDate) exportStartDate.addEventListener("change", updateExportHintAndPreview);

if (exportConfirmBtn) {
  exportConfirmBtn.addEventListener("click", async () => {
    const format = exportFormatSelect ? exportFormatSelect.value : "csv";
    const includeObs = exportIncludeObs ? exportIncludeObs.checked : true;
    const includeTrades = exportIncludeTrades ? exportIncludeTrades.checked : true;
    try {
      if (format === "csv") {
        await exportToCSV(includeObs, includeTrades);
      } else if (format === "pdf") {
        await exportToPDF(includeObs, includeTrades);
      } else if (format === "json") {
        const data = await normalizeForJsonExport(includeObs, includeTrades);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        downloadBlob(blob, `trading-journal-backup-${new Date().toISOString().slice(0,10)}.json`);
        showToast("JSON exported");
      }
      if (exportModal) exportModal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      showToast("Export failed: " + err.message);
    }
  });
}

// ===================== Event Listeners =====================
window.addEventListener("auth-changed", (e) => {
  if (e.detail.loggedIn) {
    loadChecklists();
  } else {
    checklists = {};
  }
});

window.addEventListener("settings-opened", () => {
  renderChecklistManageSelect();
});

window.addEventListener("checklists-updated", () => {
  // Refresh checklist picker when logs update
  renderChecklistPicker();
});

// Bind to window for backward compatibility
window.loadChecklists = loadChecklists;
window.renderChecklistManageSelect = renderChecklistManageSelect;
window.openChecklistLogEditor = openChecklistLogEditor;
window.renderLinkedChecklists = renderLinkedChecklists;
