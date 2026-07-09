import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import { generateCoachSummaryClient, loadGeminiKey, saveGeminiKey, loadGoogleApiKey, saveGoogleApiKey } from '../services/ai.js';

// Cache AI Coach view elements
const coachGenerateBtn = document.getElementById("coach-generate-btn");
const coachGenerating = document.getElementById("coach-generating");
const coachEmpty = document.getElementById("coach-empty");
const coachFeed = document.getElementById("coach-feed");

// Key management elements
const geminiKeyInput = document.getElementById("gemini-key-input");
const geminiKeyToggle = document.getElementById("gemini-key-toggle");
const geminiKeySaveBtn = document.getElementById("gemini-key-save-btn");
const geminiKeyStatus = document.getElementById("gemini-key-status");

const googleKeyInput = document.getElementById("google-key-input");
const googleKeyToggle = document.getElementById("google-key-toggle");
const googleKeySaveBtn = document.getElementById("google-key-save-btn");
const googleKeyStatus = document.getElementById("google-key-status");

// ===================== Event Listeners =====================
window.addEventListener('ai-summaries-updated', () => {
  if (state.activeView === "aicoach") renderAiCoachFeed();
});

window.addEventListener('view-changed', (e) => {
  if (e.detail.view === "aicoach") {
    renderAiCoachFeed();
  }
});

window.addEventListener('settings-opened', () => {
  loadSettingsKeyStatus();
});

// Period toggle listener
const coachControls = document.querySelector(".coach-controls");
if (coachControls) {
  coachControls.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn[data-coach-period]");
    if (!btn) return;
    
    state.coachPeriod = btn.dataset.coachPeriod;
    document.querySelectorAll(".coach-controls .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    
    renderAiCoachFeed();
  });
}

// Generate now button click handler
if (coachGenerateBtn) {
  coachGenerateBtn.addEventListener("click", async () => {
    try {
      const apiKey = await loadGeminiKey();
      if (!apiKey) {
        showToast("Enter a Gemini (Groq) API Key in Settings first.");
        const gear = document.getElementById("settings-gear-btn");
        if (gear) gear.click();
        return;
      }

      setCoachGenerating(true);
      const res = await generateCoachSummaryClient(apiKey, state.coachPeriod);
      if (res.skipped) {
        showToast(`Skipped: ${res.reason}`);
      } else {
        showToast(`✦ AI Summary generated! (${res.entryCount} entries evaluated)`);
      }
    } catch (err) {
      console.error(err);
      showToast("Generation failed: " + err.message);
    } finally {
      setCoachGenerating(false);
      renderAiCoachFeed();
    }
  });
}

// Key toggle hide/show password handlers
if (geminiKeyToggle && geminiKeyInput) {
  geminiKeyToggle.addEventListener("click", () => {
    const isHidden = geminiKeyInput.type === "password";
    geminiKeyInput.type = isHidden ? "text" : "password";
    geminiKeyToggle.textContent = isHidden ? "🙈" : "👁";
  });
}

if (geminiKeySaveBtn && geminiKeyInput) {
  geminiKeySaveBtn.addEventListener("click", async () => {
    const key = geminiKeyInput.value.trim();
    if (!key) { showToast("Please enter your API key"); return; }
    geminiKeySaveBtn.disabled = true;
    geminiKeySaveBtn.textContent = "Saving…";
    try {
      await saveGeminiKey(key);
      if (geminiKeyStatus) geminiKeyStatus.textContent = "✓ Key saved";
      geminiKeyInput.value = "";
      geminiKeyInput.type = "password";
      geminiKeyToggle.textContent = "👁";
      showToast("Gemini API key saved ✦");
    } catch (err) {
      showToast("Could not save key: " + err.message);
    } finally {
      geminiKeySaveBtn.disabled = false;
      geminiKeySaveBtn.textContent = "Save key";
    }
  });
}

if (googleKeyToggle && googleKeyInput) {
  googleKeyToggle.addEventListener("click", () => {
    const isHidden = googleKeyInput.type === "password";
    googleKeyInput.type = isHidden ? "text" : "password";
    googleKeyToggle.textContent = isHidden ? "🙈" : "👁";
  });
}

if (googleKeySaveBtn && googleKeyInput) {
  googleKeySaveBtn.addEventListener("click", async () => {
    const key = googleKeyInput.value.trim();
    if (!key) { showToast("Please enter your Google API key"); return; }
    googleKeySaveBtn.disabled = true;
    googleKeySaveBtn.textContent = "Saving…";
    try {
      await saveGoogleApiKey(key);
      if (googleKeyStatus) googleKeyStatus.textContent = "✓ Key saved";
      googleKeyInput.value = "";
      googleKeyInput.type = "password";
      googleKeyToggle.textContent = "👁";
      showToast("Google API key saved ✦");
    } catch (err) {
      showToast("Could not save key: " + err.message);
    } finally {
      googleKeySaveBtn.disabled = false;
      googleKeySaveBtn.textContent = "Save key";
    }
  });
}

// ===================== Business Logic =====================

export function setCoachGenerating(on) {
  if (coachGenerateBtn) coachGenerateBtn.disabled = on;
  if (coachGenerateBtn) coachGenerateBtn.textContent = on ? "Generating…" : "✦ Generate now";
  if (coachGenerating) coachGenerating.classList.toggle("hidden", !on);
  if (on) {
    if (coachFeed) coachFeed.classList.add("hidden");
    if (coachEmpty) coachEmpty.classList.add("hidden");
  } else {
    if (coachFeed) coachFeed.classList.remove("hidden");
  }
}

export function renderAiCoachFeed() {
  if (!coachFeed || !coachEmpty || !coachGenerating) return;
  if (!coachGenerating.classList.contains("hidden")) return;
  
  coachFeed.classList.remove("hidden");
  const filtered = state.aiSummaries.filter((s) => s.type === state.coachPeriod);
  
  if (filtered.length === 0) {
    coachFeed.innerHTML = "";
    coachEmpty.classList.remove("hidden");
    return;
  }
  
  coachEmpty.classList.add("hidden");
  coachFeed.innerHTML = "";
  filtered.forEach((s, i) => coachFeed.appendChild(buildCoachCard(s, i === 0)));
}

function buildCoachCard(s, startExpanded) {
  const card = document.createElement("div");
  card.className = "coach-summary-card" + (startExpanded ? " expanded" : "");

  const header = document.createElement("div");
  header.className = "coach-summary-header";
  header.addEventListener("click", () => card.classList.toggle("expanded"));

  const typeBadge = document.createElement("span");
  typeBadge.className = "coach-summary-type";
  typeBadge.textContent = s.type === "weekly" ? "Weekly" : "Monthly";
  header.appendChild(typeBadge);

  const dateEl = document.createElement("span");
  dateEl.className = "coach-summary-date";
  const startDate = s.periodStart && s.periodStart.toDate
    ? s.periodStart.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const endDate = s.periodEnd && s.periodEnd.toDate
    ? s.periodEnd.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const createdDate = s.createdAt && s.createdAt.toDate
    ? s.createdAt.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  dateEl.textContent = startDate && endDate ? `${startDate} – ${endDate}` : createdDate;
  header.appendChild(dateEl);

  const metaEl = document.createElement("span");
  metaEl.className = "coach-summary-meta";
  metaEl.textContent = s.entryCount ? `${s.entryCount} entries` : "";
  header.appendChild(metaEl);

  const chevron = document.createElement("span");
  chevron.className = "coach-summary-chevron";
  chevron.textContent = "▾";
  header.appendChild(chevron);

  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "coach-summary-body";
  body.innerHTML = simpleMarkdownToHtml(s.content || "");
  card.appendChild(body);

  return card;
}

export function simpleMarkdownToHtml(md) {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---+$/gm, "<hr>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>[\s\S]*?<\/li>)*/g, (m) => `<ul>${m}</ul>`);
  html = html.split(/\n{2,}/).map((block) => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[23]|ul|ol|hr|li)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}

export async function loadSettingsKeyStatus() {
  const key = await loadGeminiKey();
  if (geminiKeyStatus) geminiKeyStatus.textContent = key ? "✓ API key is saved" : "No key saved yet";

  const gKey = await loadGoogleApiKey();
  if (googleKeyStatus) googleKeyStatus.textContent = gKey ? "✓ API key is saved" : "No key saved yet";
}

// Bind to window for compatibility
window.renderAiCoachFeed = renderAiCoachFeed;
window.loadSettingsKeyStatus = loadSettingsKeyStatus;
