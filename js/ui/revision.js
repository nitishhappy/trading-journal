import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';
import { todayKey, getLocalDateKey } from '../utils/date.js';
import { saveObservation } from '../services/observations.js';
import { openLightbox } from './common.js';
import { openEditModal } from './dashboard.js';
import { buildImageGrid, buildLinksSection, buildLinkPreviewIfApplicable, buildLinksFragment, getObservationLinks, escapeHtml } from '../utils/image.js';
import {
  revisionStage, revisionEmptyState, revisionEmptyText, revisionProgressText,
  revisionProgressFill, revisionResetBtn, revisionFolderSelect, revisionStarredToggle
} from '../dom.js';

// ===================== Event Listeners =====================
window.addEventListener('observations-updated', () => {
  if (state.activeView === "revision") renderRevisionStage();
});

window.addEventListener('view-changed', (e) => {
  if (e.detail.view === "revision") {
    renderRevisionStage();
  }
});

if (revisionFolderSelect) {
  revisionFolderSelect.addEventListener("change", () => {
    state.revisionFolderFilter = revisionFolderSelect.value;
    state.revisionReviewedIds = [];
    state.revisionFlaggedIds = [];
    if (state.activeView === "revision") renderRevisionStage();
  });
}

if (revisionStarredToggle) {
  revisionStarredToggle.addEventListener("click", () => {
    state.revisionStarredOnly = !state.revisionStarredOnly;
    revisionStarredToggle.textContent = state.revisionStarredOnly ? "★ Starred" : "☆ All";
    revisionStarredToggle.classList.toggle("active", state.revisionStarredOnly);
    state.revisionReviewedIds = [];
    state.revisionFlaggedIds = [];
    if (state.activeView === "revision") renderRevisionStage();
  });
}

if (revisionResetBtn) {
  revisionResetBtn.addEventListener("click", async () => {
    if (!confirm("Reset today's review progress? All observations will reappear in the revision queue.")) return;
    state.revisionReviewedIds = [];
    state.revisionFlaggedIds = [];
    await saveRevisionState();
    showToast("Revision progress reset");
    renderRevisionStage();
  });
}

// ===================== State Sync & Queue Construction =====================

export async function loadRevisionState() {
  if (!state.currentUser) return;
  try {
    const doc = await db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("revisionProgress").get();
    if (doc.exists) {
      const data = doc.data();
      const today = todayKey();
      if (data.date === today) {
        state.revisionReviewedIds = data.reviewedIds || [];
        state.revisionFlaggedIds = data.flaggedIds || [];
      } else {
        // New calendar day, reset progress list
        state.revisionReviewedIds = [];
        state.revisionFlaggedIds = [];
        await saveRevisionState();
      }
    }
  } catch (err) {
    console.error("loadRevisionState error", err);
  }
}

export async function saveRevisionState() {
  if (!state.currentUser) return;
  try {
    await db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("revisionProgress")
      .set({
        date: todayKey(),
        reviewedIds: state.revisionReviewedIds,
        flaggedIds: state.revisionFlaggedIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (err) {
    console.error("saveRevisionState error", err);
  }
}

export function buildRevisionQueue() {
  // Construct queue based on filters, excludes items already reviewed/flagged today
  const dailyDone = [...state.revisionReviewedIds, ...state.revisionFlaggedIds];

  const pool = state.observations.filter((o) => {
    if (o.archived) return false;
    if (dailyDone.includes(o.id)) return false;
    if (state.revisionFolderFilter !== "all" && o.folder !== state.revisionFolderFilter) return false;
    if (state.revisionStarredOnly && !o.starred) return false;
    return true;
  });

  // Oldest first for chronological review order
  return pool.sort((a, b) => {
    const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return da - db;
  });
}

export function getRevisionTotalCount() {
  // Total items in current pool configuration (finished + remaining)
  return state.observations.filter((o) => {
    if (o.archived) return false;
    if (state.revisionFolderFilter !== "all" && o.folder !== state.revisionFolderFilter) return false;
    if (state.revisionStarredOnly && !o.starred) return false;
    return true;
  }).length;
}

export function updateRevisionProgress() {
  const total = getRevisionTotalCount();
  const done = state.revisionReviewedIds.length + state.revisionFlaggedIds.length;
  const remaining = total - done;

  if (revisionProgressText) {
    revisionProgressText.textContent = `${done} of ${total} reviewed today (${remaining} left)`;
  }
  if (revisionProgressFill) {
    const pct = total > 0 ? (done / total) * 100 : 0;
    revisionProgressFill.style.width = `${pct}%`;
  }
}

// ===================== Card Renderer =====================

export async function renderRevisionStage() {
  if (!revisionStage || !revisionEmptyState) return;

  await loadRevisionState();
  state.revisionQueue = buildRevisionQueue();
  updateRevisionProgress();

  revisionStage.innerHTML = "";

  if (state.revisionQueue.length === 0) {
    revisionStage.classList.add("hidden");
    revisionEmptyState.classList.remove("hidden");
    const total = getRevisionTotalCount();
    if (total === 0) {
      revisionEmptyText.textContent = "No observations found matching the current filters.";
    } else {
      revisionEmptyText.textContent = "🎉 Awesome! You've reviewed all matching observations for today!";
    }
    return;
  }

  revisionStage.classList.remove("hidden");
  revisionEmptyState.classList.add("hidden");

  // Render top 3 cards in stack for clean layout preview
  const showCount = Math.min(state.revisionQueue.length, 3);
  for (let i = showCount - 1; i >= 0; i--) {
    const obs = state.revisionQueue[i];
    const isTop = i === 0;
    const card = buildRevisionCardFromWorkingBackup(obs, isTop);
    
    // Position/scale stack effect
    card.style.transform = `translateY(${i * 12}px) scale(${1 - i * 0.04})`;
    card.style.zIndex = 100 - i;
    
    revisionStage.appendChild(card);
  }
}

async function toggleObsStar(obs) {
  const newVal = !obs.starred;
  try {
    await saveObservation(obs.id, { starred: newVal });
    obs.starred = newVal;
    const card = revisionStage.querySelector(`[data-id="${obs.id}"]`);
    const btn = card ? card.querySelector(".revision-card-star") : null;
    if (btn) {
      btn.textContent = newVal ? "★" : "☆";
      btn.classList.toggle("starred", newVal);
      btn.title = newVal ? "Unstar" : "Star";
    }
    showToast(newVal ? "Starred" : "Unstarred");
    if (state.activeView === "revision") setTimeout(() => renderRevisionStage(), 300);
  } catch (err) {
    console.error("toggleObsStar error", err);
    showToast("Could not update star");
  }
}

function buildRevisionCardFromWorkingBackup(obs, isTop) {
  const card = document.createElement("div");
  card.className = `revision-card priority-${escapeHtml(obs.priority || "medium")}`;
  card.dataset.id = obs.id;

  if (!isTop) {
    card.style.transform = "scale(0.97) translateY(8px)";
    card.style.opacity = "0.6";
    card.style.zIndex = "1";
    card.style.pointerEvents = "none";
  } else {
    card.classList.add("revision-card-top", "top-card");
    card.style.zIndex = "2";
  }

  const obsImages = obs.images && obs.images.length > 0 ? obs.images : (obs.imageBase64 ? [obs.imageBase64] : []);
  const links = getObservationLinks(obs);
  const hasImage = obsImages.length > 0;
  const hasLink = links.length > 0;
  if (!hasImage && !hasLink) card.classList.add("text-only");

  const starBtn = document.createElement("button");
  starBtn.className = "revision-card-star" + (obs.starred ? " starred" : "");
  starBtn.textContent = obs.starred ? "★" : "☆";
  starBtn.title = obs.starred ? "Unstar" : "Star";
  starBtn.setAttribute("aria-label", obs.starred ? "Unstar" : "Star");
  starBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleObsStar(obs);
  });
  card.appendChild(starBtn);

  const createdTime = obs.createdAt
    ? (obs.createdAt.toDate ? obs.createdAt.toDate() : new Date(obs.createdAt))
    : new Date();
  const meta = document.createElement("div");
  meta.className = "revision-card-meta";

  const dateSpan = document.createElement("span");
  dateSpan.className = "revision-card-date";
  dateSpan.textContent = getLocalDateKey(createdTime);
  meta.appendChild(dateSpan);

  const folderSpan = document.createElement("span");
  folderSpan.className = "revision-card-folder";
  folderSpan.textContent = obs.folder || "General";
  meta.appendChild(folderSpan);

  const prioritySpan = document.createElement("span");
  prioritySpan.className = `priority-badge badge-${obs.priority || "medium"}`;
  prioritySpan.textContent = (obs.priority || "medium").toUpperCase();
  meta.appendChild(prioritySpan);
  card.appendChild(meta);

  if (hasImage) {
    const imageWrap = document.createElement("div");
    imageWrap.innerHTML = buildImageGrid(obsImages, obs.id, true);
    while (imageWrap.firstChild) card.appendChild(imageWrap.firstChild);
  }

  const textEl = document.createElement("div");
  textEl.className = "revision-card-text";
  textEl.textContent = obs.text || "(no text)";
  if (!obs.text) textEl.style.color = "var(--text-dim)";
  card.appendChild(textEl);

  if (hasLink) {
    const linksWrap = document.createElement("div");
    linksWrap.className = "entry-links-section";
    linksWrap.appendChild(buildLinksFragment(obs, "revision-card-link"));
    card.appendChild(linksWrap);
  }

  if ((obs.tags || []).length > 0) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "revision-card-tags";
    (obs.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "revision-card-tag tag-chip";
      chip.textContent = "#" + tag;
      tagsEl.appendChild(chip);
    });
    card.appendChild(tagsEl);
  }

  const hintRight = document.createElement("div");
  hintRight.className = "revision-card-hint right";
  hintRight.textContent = "Reviewed";
  card.appendChild(hintRight);

  const hintLeft = document.createElement("div");
  hintLeft.className = "revision-card-hint left";
  hintLeft.textContent = "Attention";
  card.appendChild(hintLeft);

  card.querySelectorAll(".il-img").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(item.dataset.index, 10);
      if (obsImages.length > 0) openLightbox(obsImages, idx);
    });
  });

  if (isTop) attachSwipeHandlers(card, obs);
  return card;
}

function buildRevisionCard(obs, isTop) {
  const card = document.createElement("div");
  card.className = "revision-card" + (isTop ? " top-card" : "");

  const note = obs.text || "";
  const createdTime = obs.createdAt 
    ? (obs.createdAt.toDate ? obs.createdAt.toDate() : new Date(obs.createdAt)) 
    : new Date();
  const dateStr = getLocalDateKey(createdTime);

  let priorityClass = "badge-medium";
  if (obs.priority === "high") priorityClass = "badge-high";
  else if (obs.priority === "low") priorityClass = "badge-low";

  // Build Links HTML
  let linksHtml = "";
  const links = obs.links && obs.links.length > 0 ? obs.links : (obs.link ? [obs.link] : []);
  if (links.length > 0) {
    linksHtml = `<div class="revision-links-section">`;
    links.forEach((url) => {
      linksHtml += `
        <div class="entry-link-row">
          <a href="${url}" target="_blank" class="entry-link-anchor">🔗 ${url.length > 40 ? url.slice(0,37) + '...' : url}</a>
        </div>
      `;
    });
    linksHtml += `</div>`;
  }

  const obsImages = obs.images && obs.images.length > 0 ? obs.images : (obs.imageBase64 ? [obs.imageBase64] : []);
  const imagesHtml = obsImages.length > 0 ? buildImageGrid(obsImages, obs.id, true) : "";

  card.innerHTML = `
    <div class="revision-card-meta">
      <span class="revision-card-date">${dateStr}</span>
      <span class="revision-card-folder">${obs.folder || "General"}</span>
      <span class="priority-badge ${priorityClass}">${(obs.priority || "medium").toUpperCase()}</span>
    </div>
    <div class="revision-card-body">
      <p class="revision-card-text">${note.replace(/\n/g, "<br>")}</p>
      ${linksHtml}
      ${imagesHtml}
    </div>
    ${
      obs.tags && obs.tags.length > 0
        ? `<div class="revision-card-tags">${obs.tags.map((t) => `<span class="revision-card-tag">#${t}</span>`).join(" ")}</div>`
        : ""
    }
    <div class="card-action-hints">
      <span class="hint-flag">👈 SWIPE LEFT TO ATTENTION</span>
      <span class="hint-review">SWIPE RIGHT TO REVIEW 👉</span>
    </div>
  `;

  // Image grid click -> Lightbox in Revision Card
  card.querySelectorAll(".il-img").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.index);
      if (obsImages.length > 0) {
        openLightbox(obsImages, idx);
      }
    });
  });

  return card;
}

function buildRevisionCardWithPreviews(obs, isTop) {
  const card = document.createElement("div");
  card.className = "revision-card" + (isTop ? " top-card" : "");
  card.dataset.id = obs.id;

  const note = obs.text || "";
  const createdTime = obs.createdAt
    ? (obs.createdAt.toDate ? obs.createdAt.toDate() : new Date(obs.createdAt))
    : new Date();
  const dateStr = getLocalDateKey(createdTime);

  let priorityClass = "badge-medium";
  if (obs.priority === "high") priorityClass = "badge-high";
  else if (obs.priority === "low") priorityClass = "badge-low";

  const links = obs.links && obs.links.length > 0 ? obs.links : (obs.link ? [obs.link] : []);
  const linksHtml = links.length > 0 ? buildLinksSection(links) : "";
  const obsImages = obs.images && obs.images.length > 0 ? obs.images : (obs.imageBase64 ? [obs.imageBase64] : []);
  const imagesHtml = obsImages.length > 0 ? buildImageGrid(obsImages, obs.id, true) : "";
  const hasMedia = links.length > 0 || obsImages.length > 0;
  const tagsHtml = obs.tags && obs.tags.length > 0
    ? `<div class="revision-card-tags">${obs.tags.map((t) => `<span class="revision-card-tag">#${escapeHtml(t)}</span>`).join(" ")}</div>`
    : "";
  if (!hasMedia && !tagsHtml) card.classList.add("text-only");

  card.innerHTML = `
    <div class="revision-card-meta">
      <span class="revision-card-date">${escapeHtml(dateStr)}</span>
      <span class="revision-card-folder">${escapeHtml(obs.folder || "General")}</span>
      <span class="priority-badge ${priorityClass}">${escapeHtml((obs.priority || "medium").toUpperCase())}</span>
    </div>
    <div class="revision-card-body">
      <p class="revision-card-text">${escapeHtml(note).replace(/\n/g, "<br>")}</p>
      ${linksHtml}
      ${imagesHtml}
    </div>
    ${tagsHtml}
    <div class="card-action-hints">
      <span class="hint-flag">SWIPE LEFT TO ATTENTION</span>
      <span class="hint-review">SWIPE RIGHT TO REVIEW</span>
    </div>
  `;

  card.querySelectorAll(".link-preview-mount").forEach((mount) => {
    const link = mount.previousElementSibling;
    const hasPreview = buildLinkPreviewIfApplicable(mount.dataset.url, mount, () => {
      if (link) link.classList.remove("hidden");
    });
    if (hasPreview && link) {
      link.classList.add("hidden");
    } else {
      mount.remove();
    }
  });

  card.querySelectorAll(".il-img").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.index);
      if (obsImages.length > 0) {
        openLightbox(obsImages, idx);
      }
    });
  });

  return card;
}

// ===================== Gestures Handling =====================

function attachSwipeHandlers(card, obs) {
  const hintRight = card.querySelector(".revision-card-hint.right");
  const hintLeft = card.querySelector(".revision-card-hint.left");

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let dragging = false;
  let horizontalIntent = null;
  let longPressTimer = null;
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 10;

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onPointerDown(e) {
    if (e.target.closest("a") || e.target.closest("button") || e.target.closest("iframe")) return;
    const startedOnImage = !!e.target.closest("img, .il-img-more, .drive-link-preview, .instagram-preview-wrap");

    dragging = true;
    horizontalIntent = null;
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    longPressFired = false;
    card._pointerId = e.pointerId;
    card.classList.add("dragging");

    if (startedOnImage) return;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      if (dragging && horizontalIntent !== true) {
        longPressFired = true;
        card.classList.remove("dragging");
        card.style.transform = "";
        if (hintRight) hintRight.style.opacity = 0;
        if (hintLeft) hintLeft.style.opacity = 0;
        if (navigator.vibrate) navigator.vibrate(15);
        openEditModal(obs.id);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }

    if (horizontalIntent === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      horizontalIntent = Math.abs(dx) > Math.abs(dy);
    }
    if (horizontalIntent === false) return;

    if (horizontalIntent === true && card._pointerId !== undefined) {
      card.setPointerCapture && card.setPointerCapture(card._pointerId);
    }

    e.preventDefault();
    currentX = dx;
    const rotate = currentX / 18;
    card.style.transform = `translate(${currentX}px, ${dy * 0.1}px) rotate(${rotate}deg)`;

    const threshold = 60;
    if (currentX > threshold) {
      if (hintRight) hintRight.style.opacity = Math.min(1, (currentX - threshold) / 60);
      if (hintLeft) hintLeft.style.opacity = 0;
    } else if (currentX < -threshold) {
      if (hintLeft) hintLeft.style.opacity = Math.min(1, (-currentX - threshold) / 60);
      if (hintRight) hintRight.style.opacity = 0;
    } else {
      if (hintRight) hintRight.style.opacity = 0;
      if (hintLeft) hintLeft.style.opacity = 0;
    }
  }

  function onPointerUp() {
    clearLongPressTimer();
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");

    if (longPressFired) {
      horizontalIntent = null;
      return;
    }
    if (horizontalIntent === false) {
      horizontalIntent = null;
      return;
    }

    const SWIPE_THRESHOLD = 100;
    if (currentX > SWIPE_THRESHOLD) {
      completeSwipe(card, "right");
    } else if (currentX < -SWIPE_THRESHOLD) {
      completeSwipe(card, "left");
    } else {
      card.style.transform = "";
      if (hintRight) hintRight.style.opacity = 0;
      if (hintLeft) hintLeft.style.opacity = 0;
    }
    horizontalIntent = null;
  }

  function onDocPointerMove(e) {
    if (dragging) onPointerMove(e);
  }

  function onDocPointerUp(e) {
    if (dragging) {
      onPointerUp(e);
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
    }
  }

  card.addEventListener("pointerdown", (e) => {
    onPointerDown(e);
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);
  });
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerUp);
}

async function completeSwipe(card, direction) {
  const id = card.dataset.id;
  card.classList.add(direction === "right" ? "swipe-right" : "swipe-left");
  await handleSwipeDecision(id, direction === "right" ? "reviewed" : "flagged");
}

async function handleSwipeDecision(id, decision) {
  if (decision === "reviewed") {
    state.revisionReviewedIds.push(id);
    showToast("Reviewed");
  } else if (decision === "flagged") {
    state.revisionFlaggedIds.push(id);
    showToast("Flagged for Attention");
  }

  await saveRevisionState();
  
  // Re-render session queue
  setTimeout(() => {
    renderRevisionStage();
  }, 200);
}

// Bind to window for compatibility
window.renderRevisionStage = renderRevisionStage;
