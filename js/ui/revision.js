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
  revisionProgressFill, revisionResetBtn, revisionFolderSelect, revisionStarredToggle,
  revisionTagInput, revisionTagClear, revisionTagDatalist
} from '../dom.js';

// ===================== Event Listeners =====================

// Tracks which revision card (by observation id) is currently expanded to
// show its full content. Kept local to this module (not in global state)
// so it doesn't interfere with the dashboard tile's own expand tracking.
let expandedRevisionId = null;

window.addEventListener('observations-updated', () => {
  if (state.activeView === "revision") renderRevisionStage();
});

window.addEventListener('view-changed', (e) => {
  if (e.detail.view === "revision") {
    populateTagDatalist();
    renderRevisionStage();
  }
});

// Update the list of options when observations change
window.addEventListener('observations-updated', () => {
  if (state.activeView === "revision") {
    populateTagDatalist();
    renderRevisionStage();
  }
});

function populateTagDatalist() {
  if (revisionTagDatalist && state.observations) {
    const allTags = new Set();
    state.observations.forEach(o => {
      if (o.tags && Array.isArray(o.tags)) {
        o.tags.forEach(t => allTags.add(t));
      }
    });
    revisionTagDatalist.innerHTML = [...allTags].sort()
      .map(t => `<option value="${t}">`).join("");
  }
}

// ── Tag filter implementation ──────────────────────────────────────────────
function applyTagFilter(raw) {
  const val = raw.trim().replace(/^#/, "").toLowerCase();
  state.revisionTagFilter = val || "all";
  if (revisionTagClear) revisionTagClear.style.display = val ? "inline" : "none";
  state.revisionReviewedIds = [];
  state.revisionFlaggedIds = [];
  if (state.activeView === "revision") renderRevisionStage();
}

if (revisionTagInput) {
  // Fire on every keystroke for real-time filtering
  revisionTagInput.addEventListener("input", () => applyTagFilter(revisionTagInput.value));
  // Fire on select choice click
  revisionTagInput.addEventListener("change", () => applyTagFilter(revisionTagInput.value));
}

if (revisionTagClear) {
  revisionTagClear.addEventListener("click", () => {
    if (revisionTagInput) revisionTagInput.value = "";
    applyTagFilter("");
  });
}

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
    
    // Tag filter matching
    if (state.revisionTagFilter && state.revisionTagFilter !== "all") {
      const oTags = (o.tags || []).map(t => t.toLowerCase());
      if (!oTags.includes(state.revisionTagFilter)) return false;
    }
    return true;
  });

  // Newest first — most recently created observation shows up first in the stack
  return pool.sort((a, b) => {
    const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return db - da;
  });
}

export function getRevisionTotalCount() {
  // Total items in current pool configuration (finished + remaining)
  return state.observations.filter((o) => {
    if (o.archived) return false;
    if (state.revisionFolderFilter !== "all" && o.folder !== state.revisionFolderFilter) return false;
    if (state.revisionStarredOnly && !o.starred) return false;
    
    if (state.revisionTagFilter && state.revisionTagFilter !== "all") {
      const oTags = (o.tags || []).map(t => t.toLowerCase());
      if (!oTags.includes(state.revisionTagFilter)) return false;
    }
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

  if (state.revisionQueue.length === 0) {
    revisionStage.innerHTML = "";
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

  const showCount = Math.min(state.revisionQueue.length, 3);
  const targetObs = state.revisionQueue.slice(0, showCount);
  const targetIds = targetObs.map(o => o.id);

  // Get current DOM card elements
  const currentCards = Array.from(revisionStage.querySelectorAll(".revision-card"));
  const currentIds = currentCards.map(c => c.dataset.id);

  // We perform an incremental update if:
  // 1. There are target observations.
  // 2. The top card (currentIds[0]) was removed/swiped, and the rest match targetIds at the start.
  // 3. The card expansion states of the remaining cards haven't changed.
  let isIncremental = false;
  if (currentIds.length > 0 && targetIds.length > 0) {
    const expectedRemaining = currentIds.slice(1);
    const actualRemaining = targetIds.slice(0, expectedRemaining.length);
    const matchesRemaining = expectedRemaining.length > 0 &&
      expectedRemaining.every((id, idx) => id === actualRemaining[idx]);

    if (matchesRemaining) {
      let expansionMatch = true;
      for (const id of expectedRemaining) {
        const cardEl = currentCards.find(c => c.dataset.id === id);
        if (cardEl) {
          const isCardExpandedInDom = cardEl.classList.contains("expanded");
          const isCardTargetExpanded = (expandedRevisionId === id);
          if (isCardExpandedInDom !== isCardTargetExpanded) {
            expansionMatch = false;
            break;
          }
        }
      }
      if (expansionMatch) {
        isIncremental = true;
      }
    }
  }

  if (isIncremental) {
    // 1. Remove cards that are no longer in targetIds (e.g. Card A which was swiped)
    currentCards.forEach(card => {
      if (!targetIds.includes(card.dataset.id)) {
        card.remove();
      }
    });

    // 2. Update remaining cards in DOM to their correct position and properties
    const remainingCards = Array.from(revisionStage.querySelectorAll(".revision-card"));
    remainingCards.forEach((card) => {
      const id = card.dataset.id;
      const targetIdx = targetIds.indexOf(id);
      if (targetIdx !== -1) {
        const isTop = targetIdx === 0;
        card.style.zIndex = 100 - targetIdx;
        card.style.transform = `translateY(${targetIdx * 12}px) scale(${1 - targetIdx * 0.04})`;
        
        if (isTop) {
          card.classList.add("revision-card-top", "top-card");
          card.style.pointerEvents = "";
          card.style.opacity = "";
        } else {
          card.classList.remove("revision-card-top", "top-card");
          card.style.pointerEvents = "none";
          card.style.opacity = "";
        }
      }
    });

    // 3. Append cards from targets that are not in the DOM yet
    const existingIds = remainingCards.map(c => c.dataset.id);
    for (let i = 0; i < showCount; i++) {
      const obs = targetObs[i];
      if (!existingIds.includes(obs.id)) {
        const card = buildRevisionCardFromWorkingBackup(obs, i === 0);
        card.style.transition = "none";
        card.style.transform = `translateY(${i * 12}px) scale(${1 - i * 0.04})`;
        card.style.zIndex = 100 - i;
        revisionStage.appendChild(card);
        requestAnimationFrame(() => {
          card.style.transition = "";
        });
      }
    }
  } else {
    // Rebuild full stage
    revisionStage.innerHTML = "";
    for (let i = showCount - 1; i >= 0; i--) {
      const obs = targetObs[i];
      const isTop = i === 0;
      const card = buildRevisionCardFromWorkingBackup(obs, isTop);

      card.style.transition = "none";
      card.style.transform = `translateY(${i * 12}px) scale(${1 - i * 0.04})`;
      card.style.zIndex = 100 - i;

      revisionStage.appendChild(card);

      requestAnimationFrame(() => {
        card.style.transition = "";
      });
    }
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
  const isExpanded = expandedRevisionId === obs.id;
  card.className = `revision-card priority-${escapeHtml(obs.priority || "medium")}${isExpanded ? " expanded" : ""}`;
  card.dataset.id = obs.id;

  if (!isTop) {
    card.style.transform = "scale(0.97) translateY(8px)";
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

  // Expand/collapse toggle — button so it's automatically excluded from
  // the swipe/long-press pointer handlers below.
  const expandBtn = document.createElement("button");
  expandBtn.className = "revision-card-expand-btn";
  expandBtn.textContent = isExpanded ? "▴" : "▾";
  expandBtn.title = isExpanded ? "Collapse" : "Expand to see everything";
  expandBtn.setAttribute("aria-label", isExpanded ? "Collapse card" : "Expand card");
  expandBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    expandedRevisionId = isExpanded ? null : obs.id;
    renderRevisionStage();
  });
  meta.appendChild(expandBtn);

  card.appendChild(meta);

  if (hasImage) {
    if (isExpanded) {
      obsImages.forEach((imgSrc, idx) => {
        const imageContainer = document.createElement("div");
        imageContainer.className = "revision-card-image-container expanded";
        
        const img = document.createElement("img");
        img.className = "revision-card-image";
        img.src = imgSrc;
        img.loading = "lazy";
        img.alt = `Observation image ${idx + 1}`;
        imageContainer.appendChild(img);
        
        imageContainer.addEventListener("click", (e) => {
          e.stopPropagation();
          openLightbox(obsImages, idx);
        });
        card.appendChild(imageContainer);
      });
    } else {
      const imageContainer = document.createElement("div");
      imageContainer.className = "revision-card-image-container";
      
      const img = document.createElement("img");
      img.className = "revision-card-image";
      img.src = obsImages[0];
      img.loading = "lazy";
      img.alt = "Observation preview";
      imageContainer.appendChild(img);
      
      if (obsImages.length > 1) {
        const badge = document.createElement("div");
        badge.className = "revision-card-image-badge";
        badge.textContent = `+${obsImages.length - 1} images`;
        imageContainer.appendChild(badge);
      }
      
      imageContainer.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(obsImages, 0);
      });
      card.appendChild(imageContainer);
    }
  }

  const textEl = document.createElement("div");
  textEl.className = "revision-card-text" + (isExpanded ? "" : " revision-card-text-clamped");
  textEl.textContent = obs.text || "(no text)";
  if (!obs.text) textEl.style.color = "var(--text-dim)";
  if (!isExpanded) {
    // Inline clamp so long notes don't blow out card height in the stack view.
    textEl.style.display = "-webkit-box";
    textEl.style.webkitBoxOrient = "vertical";
    textEl.style.webkitLineClamp = "4";
    textEl.style.overflow = "hidden";
  }
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

  if (isExpanded) {
    const expandedMeta = document.createElement("div");
    expandedMeta.className = "revision-card-expanded-meta";
    expandedMeta.textContent = `Logged: ${createdTime.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
    card.appendChild(expandedMeta);
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

  attachSwipeHandlers(card, obs);
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
  let currentY = 0;
  let dragging = false;
  let horizontalIntent = null;
  let longPressTimer = null;
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 10;

  // rAF batching: pointermove can fire far more often than the screen repaints
  // (many devices report 90-120+ events/sec). Writing to card.style.transform
  // directly inside the handler means every one of those events forces a style
  // recalc, and on a card with images that competes with the browser's own
  // paint work — that's what reads as "not smooth" on a real phone even though
  // it looks fine on a fast dev machine. We just record the latest pointer
  // position here and let a single rAF callback apply it once per frame.
  let rafId = null;

  function scheduleFrame() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      applyDragTransform();
    });
  }

  function cancelScheduledFrame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function applyDragTransform() {
    const rotate = currentX / 18;
    card.style.transform = `translate(${currentX}px, ${currentY * 0.1}px) rotate(${rotate}deg)`;

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

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onPointerDown(e) {
    if (!card.classList.contains("top-card")) return;
    if (e.target.closest("a") || e.target.closest("button") || e.target.closest("iframe")) return;
    const startedOnImage = !!e.target.closest("img, .il-img-more, .drive-link-preview, .instagram-preview-wrap");

    dragging = true;
    horizontalIntent = null;
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    currentY = 0;
    longPressFired = false;
    card.classList.add("dragging");

    // Capture the pointer up front so move/up events keep arriving even once
    // the finger strays outside the card's bounds mid-drag. This also means
    // we only need ONE set of listeners, attached to the card itself — the
    // previous version additionally attached a parallel set to `document` to
    // cover that same case, but a captured pointer event still bubbles from
    // the card up to `document`, so both listeners fired for every single
    // pointermove/pointerup. That doubled every style write during the drag,
    // which is exactly the kind of thing that turns into visible stutter on
    // a real device.
    if (card.setPointerCapture) {
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
    }

    if (startedOnImage) return;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      if (dragging && horizontalIntent !== true) {
        longPressFired = true;
        card.classList.remove("dragging");
        cancelScheduledFrame();
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
      // Hint the browser to promote the card to its own compositor layer for
      // the duration of the drag, rather than leaving will-change on all the
      // time (which just wastes memory on cards that are never dragged).
      if (horizontalIntent === true) card.classList.add("swipe-active");
    }
    if (horizontalIntent === false) return;

    e.preventDefault();
    currentX = dx;
    currentY = dy;
    scheduleFrame();
  }

  function onPointerUp() {
    clearLongPressTimer();
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging", "swipe-active");
    cancelScheduledFrame();

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

  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerUp);
}

function waitForTransitionEnd(el, propertyName, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = (e) => {
      if (e.target === el && e.propertyName === propertyName) finish();
    };
    el.addEventListener("transitionend", onTransitionEnd);
    // Fallback in case transitionend doesn't fire (e.g. tab backgrounded)
    setTimeout(finish, timeoutMs);
  });
}

async function completeSwipe(card, direction) {
  const id = card.dataset.id;
  const decision = direction === "right" ? "reviewed" : "flagged";

  // Update local queue membership and fire the toast immediately — these are
  // synchronous/local, no reason to wait on anything for them.
  if (decision === "reviewed") {
    state.revisionReviewedIds.push(id);
    showToast("Reviewed");
  } else {
    state.revisionFlaggedIds.push(id);
    showToast("Flagged for Attention");
  }

  // card.classList.remove("dragging") just happened synchronously in
  // onPointerUp, right before this function was called. If we add the
  // swipe class in the very same tick, some browsers never get a chance
  // to paint the "transition re-enabled" frame in between — they collapse
  // both style changes into one and skip the transition entirely, so the
  // card just jumps to its final state with no visible animation (and
  // transitionend never fires). Forcing a synchronous layout read here
  // flushes that intermediate frame first, guaranteeing the swipe-out
  // actually animates.
  void card.offsetWidth;
  card.classList.add(direction === "right" ? "swipe-right" : "swipe-left");

  // state.revisionQueue still holds the pre-swipe order at this point —
  // buildRevisionQueue() only re-runs inside the eventual renderRevisionStage()
  // call below, so we can safely use it to find the two cards currently
  // stacked underneath the one being swiped.
  const oldQueue = state.revisionQueue;
  const shiftPromises = [];
  for (let i = 1; i < Math.min(oldQueue.length, 3); i++) {
    const obs = oldQueue[i];
    const el = revisionStage.querySelector(`[data-id="${obs.id}"]`);
    if (!el) continue;
    const newIndex = i - 1;
    el.style.transform = `translateY(${newIndex * 12}px) scale(${1 - newIndex * 0.04})`;
    el.style.zIndex = 100 - newIndex;
    shiftPromises.push(waitForTransitionEnd(el, "transform", 380));
  }

  const swipeOutDone = waitForTransitionEnd(card, "transform", 380);

  // The Firestore write is a network round trip with genuinely unpredictable
  // latency — anywhere from ~50ms on wifi to well over a second on a flaky
  // mobile connection. The previous version put this in the same Promise.all
  // the on-screen animation was waiting on, which meant renderRevisionStage()
  // (and therefore the next card becoming interactive) was gated on that
  // network call. The card would visibly finish its swipe-out animation and
  // then the whole stage would just sit there, unresponsive, for however
  // long the save took — an inconsistent stall that reads as "janky" even
  // though the animation itself is fine. The save no longer blocks the
  // re-render; it just runs alongside it, and only surfaces a toast if it
  // actually fails.
  saveRevisionState().catch((err) => {
    console.error("saveRevisionState error", err);
    showToast("Could not save — try again");
  });

  await Promise.all([swipeOutDone, ...shiftPromises]);
  renderRevisionStage();
}

// Bind to window for compatibility
window.renderRevisionStage = renderRevisionStage;