import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from './toast.js';
import { getDateKey, todayKey } from './date.js';

export async function recordBackupPerformed() {
  if (!state.currentUser) return;
  try {
    const ref = db.collection("users").doc(state.currentUser.uid).collection("settings").doc("preferences");
    await ref.set({ lastBackupDate: todayKey() }, { merge: true });
    const backupReminderText = document.getElementById("backup-reminder-text");
    if (backupReminderText) {
      backupReminderText.textContent = `💾 Don't forget to back up your data today — last backup: today`;
    }
  } catch (err) {
    console.error("record backup performed error", err);
  }
}

export function getExportDateRange() {
  const range = document.getElementById("export-range-select").value;
  if (range === "all") return null;

  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (range === "month") {
    // Current calendar month (from 1st of month to now)
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "week") {
    // Last 7 days
    start.setDate(now.getDate() - 7);
  } else if (range === "custom") {
    const startStr = document.getElementById("export-start-date").value;
    const endStr = document.getElementById("export-end-date").value;
    if (!startStr || !endStr) return null;
    start = new Date(startStr + "T00:00:00");
    end = new Date(endStr + "T23:59:59");
    return { start, end };
  }

  // Set start to midnight, end to end-of-day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function filterObsByRange(obs, range) {
  if (!range) return obs;
  return obs.filter((o) => {
    if (!o.createdAt) return false;
    const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    return date >= range.start && date <= range.end;
  });
}

export function filterTradesByRange(tradeList, range) {
  if (!range) return tradeList;
  return tradeList.filter((t) => {
    if (!t.date) return false;
    const date = new Date(t.date + "T12:00:00"); // Noon avoids timezone shift on range check
    return date >= range.start && date <= range.end;
  });
}

export function updateExportHintAndPreview() {
  const range = getExportDateRange();
  const format = document.getElementById("export-format-select").value;

  const filteredObs = filterObsByRange(state.observations, range);
  const filteredTrades = filterTradesByRange(state.trades, range);

  const previewEl = document.getElementById("export-preview-count");
  if (previewEl) {
    previewEl.textContent = `Preview: matches ${filteredObs.length} observations, ${filteredTrades.length} trades`;
  }

  const hintEl = document.getElementById("export-format-hint");
  if (!hintEl) return;

  if (format === "json") {
    hintEl.textContent = "JSON preserves all database fields including checklists, priorities, stars, and embedded images. Best for full backups.";
  } else if (format === "csv") {
    hintEl.textContent = "CSV exports observations and trades as two separate sheets in a ZIP archive. Best for reading in spreadsheet apps (Excel, Sheets).";
  } else if (format === "pdf") {
    hintEl.textContent = "PDF creates a printable document containing a clean summary and table view of all matching records. Best for reading/printing.";
  }
}

export function csvEscape(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (/[",\\n\\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(arr) {
  return arr.map(csvEscape).join(",") + "\r\n";
}

export async function exportToCSV(filteredObs, filteredTrades) {
  try {
    // Generate CSV contents
    let obsCSV = csvRow(["Date", "Time", "Folder", "Priority", "Starred", "Archived", "Note", "Links", "Tags", "Checklist Score %"]);
    filteredObs.forEach((o) => {
      const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date();
      obsCSV += csvRow([
        getDateKey(d),
        d.toLocaleTimeString(),
        o.folder || "",
        o.priority || "",
        o.starred ? "true" : "false",
        o.archived ? "true" : "false",
        o.text || "",
        (o.links || []).join("; "),
        (o.tags || []).join(", "),
        o.checklistScore !== undefined ? o.checklistScore : ""
      ]);
    });

    let tradeCSV = csvRow(["Date", "Capital", "Trade Num", "Gross", "Net", "Duration Min", "Comments"]);
    filteredTrades.forEach((t) => {
      tradeCSV += csvRow([
        t.date || "",
        t.capital || "",
        t.tradeNum || "",
        t.gross || "",
        t.net || "",
        t.duration || "",
        t.comments || ""
      ]);
    });

    // Dynamically load JSZip for creating zip file in browser
    if (typeof JSZip === "undefined") {
      showToast("Loading zip library...");
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const zip = new JSZip();
    zip.file("observations.csv", obsCSV);
    zip.file("trades.csv", tradeCSV);

    const blob = await zip.generateAsync({ type: "blob" });
    const filename = `trade_journal_export_${todayKey()}.zip`;
    downloadBlob(blob, filename);

    recordBackupPerformed();
    showToast("Export downloaded successfully");
  } catch (err) {
    console.error("CSV Export error", err);
    showToast("Could not generate ZIP export");
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function timestampToIso(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString();
}

export function normalizeForJsonExport(filteredObs, filteredTrades) {
  // Deep-copy and clean Firestore timestamps to standard ISO strings for portability
  const cleanedObs = filteredObs.map((o) => ({
    ...o,
    id: undefined, // let restoration assign new doc ids
    createdAt: timestampToIso(o.createdAt),
    updatedAt: timestampToIso(o.updatedAt)
  }));

  const cleanedTrades = filteredTrades.map((t) => ({
    ...t,
    id: undefined,
    createdAt: timestampToIso(t.createdAt),
    updatedAt: timestampToIso(t.updatedAt)
  }));

  return {
    version: 2,
    exporter: "Trade Journal Client",
    exportedAt: new Date().toISOString(),
    observations: cleanedObs,
    trades: cleanedTrades
  };
}

export function exportToPDF(filteredObs, filteredTrades) {
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Popup blocked — allow popups to export PDF");
    return;
  }

  // Sort observations chronologically for the printed log
  const cronObs = [...filteredObs].sort((a, b) => {
    const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return da - db;
  });

  // Calculate trade summary metrics
  const tradeCount = filteredTrades.length;
  const grossSum = filteredTrades.reduce((acc, t) => acc + (Number(t.gross) || 0), 0);
  const netSum = filteredTrades.reduce((acc, t) => acc + (Number(t.net) || 0), 0);
  const winTrades = filteredTrades.filter((t) => (Number(t.net) || 0) > 0).length;
  const winRate = tradeCount > 0 ? ((winTrades / tradeCount) * 100).toFixed(1) : "0.0";

  let obsHtml = "";
  if (cronObs.length === 0) {
    obsHtml = `<p style="color: #666; font-style: italic;">No observations matching selected range.</p>`;
  } else {
    cronObs.forEach((o) => {
      const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date();
      const starredBadge = o.starred ? `<span style="color: #f59e0b; margin-left: 8px;">★</span>` : "";
      const imagesCount = o.images && o.images.length > 0 ? ` [📸 ${o.images.length} images]` : "";
      obsHtml += `
        <div class="pdf-obs-card">
          <div class="pdf-obs-header">
            <span><b>${getDateKey(d)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b> | Folder: ${o.folder || "General"}</span>
            <span>Priority: ${o.priority || "medium"}${starredBadge}</span>
          </div>
          <p style="margin: 8px 0; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${o.text || ""}</p>
          ${o.links && o.links.length > 0 ? `<div style="font-size: 11px; color: #3b82f6; margin-top: 4px;">🔗 ${o.links.join(', ')}</div>` : ""}
          ${o.tags && o.tags.length > 0 ? `<div style="font-size: 11px; color: #10b981; margin-top: 4px;">Tags: ${o.tags.map(t => '#' + t).join(' ')}</div>` : ""}
          ${imagesCount ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${imagesCount}</div>` : ""}
        </div>
      `;
    });
  }

  let tradeHtml = "";
  if (filteredTrades.length === 0) {
    tradeHtml = `<p style="color: #666; font-style: italic;">No trade records matching selected range.</p>`;
  } else {
    tradeHtml = `
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Capital</th>
            <th>Trades</th>
            <th>Gross</th>
            <th>Net</th>
            <th>Duration</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTrades.map((t) => `
            <tr>
              <td>${t.date || ""}</td>
              <td>${t.capital || ""}</td>
              <td>${t.tradeNum || ""}</td>
              <td>${t.gross || ""}</td>
              <td class="${Number(t.net) >= 0 ? 'text-green' : 'text-red'}">${t.net || ""}</td>
              <td>${t.duration || ""} m</td>
              <td style="font-size: 11px;">${t.comments || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trade Journal Export - ${todayKey()}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 20px; line-height: 1.4; }
        h1, h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
        .summary-box { display: flex; gap: 20px; margin-bottom: 30px; background: #f3f4f6; padding: 15px; border-radius: 8px; }
        .stat-col { flex: 1; text-align: center; }
        .stat-val { font-size: 20px; font-weight: bold; margin-top: 4px; }
        .pdf-obs-card { border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 12px; border-radius: 6px; page-break-inside: avoid; }
        .pdf-obs-header { display: flex; justify-content: space-between; font-size: 11px; color: #4b5563; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; margin-bottom: 8px; }
        .pdf-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        .pdf-table th, .pdf-table td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        .pdf-table th { background: #f3f4f6; }
        .text-green { color: #047857; font-weight: bold; }
        .text-red { color: #b91c1c; font-weight: bold; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">📈 Trading Journal Log</h1>
        <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save PDF</button>
      </div>
      <p style="font-size: 12px; color: #4b5563; margin-top: -10px; margin-bottom: 25px;">Exported on: ${new Date().toLocaleString()}</p>

      <h2>📊 Trade Performance Summary</h2>
      <div class="summary-box">
        <div class="stat-col"><div>Total Trades</div><div class="stat-val">${tradeCount}</div></div>
        <div class="stat-col"><div>Gross PnL</div><div class="stat-val ${grossSum >= 0 ? 'text-green' : 'text-red'}">$${grossSum.toFixed(2)}</div></div>
        <div class="stat-col"><div>Net PnL</div><div class="stat-val ${netSum >= 0 ? 'text-green' : 'text-red'}">$${netSum.toFixed(2)}</div></div>
        <div class="stat-col"><div>Win Rate</div><div class="stat-val">${winRate}%</div></div>
      </div>

      <h2>📝 Observations log (${cronObs.length})</h2>
      ${obsHtml}

      <h2 style="margin-top: 40px; page-break-before: always;">📊 Trade Log records (${filteredTrades.length})</h2>
      ${tradeHtml}

      <script>
        // Trigger print once DOM completes loading
        window.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => { window.print(); }, 500);
        });
      </script>
    </body>
    </html>
  `);
  win.document.close();

  recordBackupPerformed();
}

export function triggerPrintOnce() {
  window.print();
}
