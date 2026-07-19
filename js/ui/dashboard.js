// import { state } from '../state.js';
// import { db } from '../firebase-init.js';
// import { showToast } from '../utils/toast.js';
// import { getLocalDateKey, formatDateHeader, computeStreak } from '../utils/date.js';
// import { renderTile, escapeHtml, attachImagePaste, resizeImageToBase64, buildLinkPreviewIfApplicable } from '../utils/image.js';
// import { saveObservation, deleteObservation, addCustomFolder, suggestCategory } from '../services/observations.js';
// import { openLightbox } from './common.js';

// // Elements references
// const folderTabs = document.getElementById("folder-tabs");
// const addFolderTab = document.getElementById("add-folder-tab");
// const currentFolderLabel = document.getElementById("current-folder-label");
// const searchInput = document.getElementById("search-input");
// const groupSelect = document.getElementById("group-select");
// const activeTagFilterBtn = document.getElementById("active-tag-filter");
// const imagePendingToggle = document.getElementById("image-pending-toggle");
// const archiveToggle = document.getElementById("archive-toggle");
// const feed = document.getElementById("feed");
// const emptyState = document.getElementById("empty-state");
// const fabAdd = document.getElementById("fab-add");

// const obsModal = document.getElementById("obs-modal");
// const obsModalTitle = document.getElementById("obs-modal-title");
// const obsModalClose = document.getElementById("obs-modal-close");
// const obsSaveBtn = document.getElementById("obs-save-btn");
// const obsCancelBtn = document.getElementById("obs-cancel-btn");
// const obsDeleteBtn = document.getElementById("obs-delete-btn");
// const obsAddAnotherBtn = document.getElementById("obs-add-another-btn");
// const obsArchiveBtn = document.getElementById("obs-archive-btn");

// const copyModal = document.getElementById("copy-modal");
// const copyModalClose = document.getElementById("copy-modal-close");
// const copyFolderSelect = document.getElementById("copy-folder-select");
// const copyPrioritySelect = document.getElementById("copy-priority-select");
// const copyCancelBtn = document.getElementById("copy-cancel-btn");
// const copyConfirmBtn = document.getElementById("copy-confirm-btn");

// const folderModal = document.getElementById("folder-modal");
// const folderModalClose = document.getElementById("folder-modal-close");
// const newFolderName = document.getElementById("new-folder-name");
// const folderCancelBtn = document.getElementById("folder-cancel-btn");
// const folderConfirmBtn = document.getElementById("folder-confirm-btn");

// // Modal internal state
// let modalImages = [];
// let obsSerialMap = {};

// // ===================== Event Listeners =====================
// window.addEventListener('observations-updated', () => {
//   updateStreakBadge();
//   updateDashStats();
//   if (state.activeView === "dashboard") renderFeed();
// });

// window.addEventListener('folders-updated', () => {
//   renderFolderTabs();
//   populateFolderSelects();
// });

// window.addEventListener('view-changed', (e) => {
//   if (e.detail.view === "dashboard") {
//     renderFeed();
//   }
// });

// // Search and filter listeners
// if (searchInput) {
//   searchInput.addEventListener("input", () => {
//     if (state.activeView === "dashboard") renderFeed();
//   });
// }

// if (groupSelect) {
//   groupSelect.addEventListener("change", () => {
//     state.groupMode = groupSelect.value;
//     renderFeed();
//   });
// }

// if (imagePendingToggle) {
//   imagePendingToggle.addEventListener("click", () => {
//     state.imagePendingOnly = !state.imagePendingOnly;
//     imagePendingToggle.classList.toggle("active", state.imagePendingOnly);
//     renderFeed();
//   });
// }

// if (archiveToggle) {
//   archiveToggle.addEventListener("click", () => {
//     state.showArchived = !state.showArchived;
//     archiveToggle.classList.toggle("active", state.showArchived);
//     renderFeed();
//   });
// }

// if (activeTagFilterBtn) {
//   activeTagFilterBtn.addEventListener("click", () => {
//     state.activeTagFilter = null;
//     activeTagFilterBtn.classList.add("hidden");
//     renderFeed();
//   });
// }

// // Folder creation modal triggers
// if (addFolderTab) {
//   addFolderTab.addEventListener("click", () => {
//     if (folderModal) {
//       newFolderName.value = "";
//       folderModal.classList.remove("hidden");
//       setTimeout(() => newFolderName.focus(), 100);
//     }
//   });
// }

// if (folderModalClose) folderModalClose.addEventListener("click", () => folderModal.classList.add("hidden"));
// if (folderCancelBtn) folderCancelBtn.addEventListener("click", () => folderModal.classList.add("hidden"));
// if (folderConfirmBtn) {
//   folderConfirmBtn.addEventListener("click", async () => {
//     const name = newFolderName.value.trim();
//     if (!name) return;
//     if (state.folders.includes(name)) {
//       showToast("Folder already exists");
//       return;
//     }
//     try {
//       await addCustomFolder(name);
//       folderModal.classList.add("hidden");
//       showToast("Folder created");
//     } catch (e) {
//       console.error(e);
//       showToast("Could not create folder");
//     }
//   });
// }

// // Observation Modal triggers
// if (fabAdd) {
//   fabAdd.addEventListener("click", () => openCreateModal());
// }

// if (obsModalClose) obsModalClose.addEventListener("click", () => obsModal.classList.add("hidden"));
// if (obsCancelBtn) obsCancelBtn.addEventListener("click", () => obsModal.classList.add("hidden"));
// if (obsSaveBtn) {
//   obsSaveBtn.addEventListener("click", () => saveModalObservation(false));
// }
// if (obsAddAnotherBtn) {
//   obsAddAnotherBtn.addEventListener("click", () => saveModalObservation(true));
// }
// if (obsDeleteBtn) {
//   obsDeleteBtn.addEventListener("click", async () => {
//     if (!state.editingObsId) return;
//     if (!confirm("Are you sure you want to delete this observation?")) return;
//     try {
//       await deleteObservation(state.editingObsId);
//       obsModal.classList.add("hidden");
//       showToast("Observation deleted");
//     } catch (err) {
//       console.error(err);
//       showToast("Could not delete observation");
//     }
//   });
// }

// if (obsArchiveBtn) {
//   obsArchiveBtn.addEventListener("click", async () => {
//     if (!state.editingObsId) return;
//     const isArchived = obsArchiveBtn.dataset.archived === "true";
//     try {
//       await saveObservation(state.editingObsId, { archived: !isArchived });
//       obsModal.classList.add("hidden");
//       showToast(!isArchived ? "Observation archived" : "Observation unarchived");
//     } catch (err) {
//       console.error(err);
//       showToast("Failed to archive observation");
//     }
//   });
// }

// // Clipboard image pasting support in observation modal
// const obsTextInput = document.getElementById("obs-text");
// if (obsTextInput) {
//   attachImagePaste(obsTextInput, async (file) => {
//     try {
//       showToast("Processing image from clipboard...");
//       const base64 = await resizeImageToBase64(file);
//       modalImages.push(base64);
//       renderEntryImageGrid();
//     } catch (err) {
//       console.error("Paste image error", err);
//       showToast("Failed to process clipboard image");
//     }
//   });
// }

// // Copy Modal triggers
// if (copyModalClose) copyModalClose.addEventListener("click", () => copyModal.classList.add("hidden"));
// if (copyCancelBtn) copyCancelBtn.addEventListener("click", () => copyModal.classList.add("hidden"));
// if (copyConfirmBtn) {
//   copyConfirmBtn.addEventListener("click", async () => {
//     if (!state.copyTargetObsId) return;
//     const original = state.observations.find((o) => o.id === state.copyTargetObsId);
//     if (!original) return;

//     const folder = copyFolderSelect.value;
//     const priority = copyPrioritySelect.value;

//     const copyData = {
//       text: original.text || "",
//       links: original.links || (original.link ? [original.link] : []),
//       link: original.link || "",
//       tags: original.tags || [],
//       images: original.images || [],
//       imagePending: original.imagePending || false,
//       folder,
//       priority,
//       archived: false,
//       copiedFrom: state.copyTargetObsId
//     };

//     try {
//       await saveObservation(null, copyData);
//       copyModal.classList.add("hidden");
//       showToast(`Copied to ${folder}`);
//     } catch (err) {
//       console.error(err);
//       showToast("Could not copy observation");
//     }
//   });
// }

// // ===================== Business Logic =====================

// export function renderFolderTabs() {
//   if (!folderTabs) return;
//   // Preserve "Add custom folder" tab
//   const addBtn = addFolderTab.cloneNode(true);
//   addBtn.addEventListener("click", () => {
//     newFolderName.value = "";
//     folderModal.classList.remove("hidden");
//     setTimeout(() => newFolderName.focus(), 100);
//   });

//   folderTabs.innerHTML = "";
  
//   // Render "All" folder tab
//   const allBtn = document.createElement("button");
//   allBtn.className = `folder-tab${state.activeFolder === "all" ? " active" : ""}`;
//   allBtn.textContent = "All";
//   allBtn.addEventListener("click", () => selectFolder("all"));
//   folderTabs.appendChild(allBtn);

//   // Custom folder tabs
//   state.folders.forEach((f) => {
//     const btn = document.createElement("button");
//     btn.className = `folder-tab${state.activeFolder === f ? " active" : ""}`;
//     btn.textContent = f;
//     btn.addEventListener("click", () => selectFolder(f));
//     folderTabs.appendChild(btn);
//   });

//   folderTabs.appendChild(addBtn);
// }

// function selectFolder(folder) {
//   state.activeFolder = folder;
//   document.querySelectorAll(".folder-tab").forEach((t) => t.classList.remove("active"));
  
//   // Toggle active class visually
//   const tabs = [...folderTabs.children];
//   const idx = folder === "all" ? 0 : state.folders.indexOf(folder) + 1;
//   if (tabs[idx]) tabs[idx].classList.add("active");

//   currentFolderLabel.textContent = folder === "all" ? "Dashboard" : folder;
//   renderFeed();
// }

// export function populateFolderSelects() {
//   populateFolderSelect("obs-folder", false);
//   populateFolderSelect("copy-folder-select", false);
//   populateFolderSelect("revision-folder-filter", true);
// }

// export function populateFolderSelect(elId, includeAll) {
//   const select = document.getElementById(elId);
//   if (!select) return;
//   const currentVal = select.value;
//   select.innerHTML = "";
//   if (includeAll) {
//     const opt = document.createElement("option");
//     opt.value = "all";
//     opt.textContent = "All Folders";
//     select.appendChild(opt);
//   }
//   state.folders.forEach((f) => {
//     const opt = document.createElement("option");
//     opt.value = f;
//     opt.textContent = f;
//     select.appendChild(opt);
//   });
//   if (currentVal && [...select.options].some((o) => o.value === currentVal)) {
//     select.value = currentVal;
//   }
// }

// export function renderFeed() {
//   if (!feed) return;
//   const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
//   buildObsSerialMap();

//   // Apply filters
//   let filtered = state.observations.filter((o) => {
//     // 1. Archive filter
//     if (!state.showArchived && o.archived) return false;
    
//     // 2. Folder filter
//     if (state.activeFolder !== "all" && o.folder !== state.activeFolder) return false;
    
//     // 3. Image pending filter
//     if (state.imagePendingOnly && !o.imagePending) return false;
    
//     // 4. Tag filter
//     if (state.activeTagFilter && !(o.tags || []).includes(state.activeTagFilter)) return false;
    
//     // 5. Search query matching text, tags, links, and date keys
//     if (q) {
//       const textMatch = (o.text || "").toLowerCase().includes(q);
//       const tagMatch = (o.tags || []).some((t) => t.toLowerCase().includes(q));
//       const linkMatch = (o.links || []).some((l) => l.toLowerCase().includes(q)) || (o.link || "").toLowerCase().includes(q);
//       const dateMatch = o.createdAt 
//         ? getLocalDateKey(o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)).includes(q) 
//         : false;
//       return textMatch || tagMatch || linkMatch || dateMatch;
//     }
//     return true;
//   });

//   if (filtered.length === 0) {
//     feed.innerHTML = "";
//     emptyState.classList.remove("hidden");
//     return;
//   }
  
//   emptyState.classList.add("hidden");

//   // Choose grouping strategy
//   if (state.groupMode === "date") {
//     renderFeedByDate(filtered);
//   } else if (state.groupMode === "priority") {
//     renderFeedByPriority(filtered);
//   } else if (state.groupMode === "tags") {
//     renderFeedByTags(filtered);
//   }

//   // Register interactive events on tiles
//   attachFeedTileListeners();
// }

// function attachFeedTileListeners() {
//   document.querySelectorAll(".tile .tile-serial").forEach((el) => {
//     const id = el.dataset.serialFor;
//     const serial = obsSerialMap[id];
//     el.textContent = serial ? `#${serial}` : "";
//     if (!serial) el.classList.add("hidden");
//   });

//   document.querySelectorAll(".tile .link-preview-mount").forEach((mount) => {
//     const url = mount.dataset.url;
//     const link = mount.previousElementSibling;
//     const hasPreview = buildLinkPreviewIfApplicable(url, mount, () => {
//       if (link) link.classList.remove("hidden");
//     });
//     if (hasPreview && link) {
//       link.classList.add("hidden");
//     } else {
//       mount.remove();
//     }
//   });

//   document.querySelectorAll(".tile .tile-body").forEach((body) => {
//     body.addEventListener("click", (e) => {
//       if (e.target.closest("a") || e.target.closest("button") || e.target.closest(".il-img") || e.target.closest("iframe")) return;
//       const tile = body.closest(".tile");
//       state.expandedTileId = state.expandedTileId === tile.dataset.id ? null : tile.dataset.id;
//       renderFeed();
//     });
//   });

//   // Star button
//   document.querySelectorAll(".tile .starred").forEach((btn) => {
//     btn.addEventListener("click", async (e) => {
//       e.stopPropagation();
//       const id = btn.dataset.id;
//       const original = state.observations.find((o) => o.id === id);
//       if (!original) return;
//       const nextStar = !(original.starred ?? false);
//       try {
//         await saveObservation(id, { starred: nextStar });
//       } catch (err) {
//         console.error(err);
//       }
//     });
//   });

//   // Edit button
//   document.querySelectorAll(".tile .edit-obs-btn").forEach((btn) => {
//     btn.addEventListener("click", (e) => {
//       e.stopPropagation();
//       openEditModal(btn.dataset.id);
//     });
//   });

//   // Copy to folder button
//   document.querySelectorAll(".tile .copy-obs-btn").forEach((btn) => {
//     btn.addEventListener("click", (e) => {
//       e.stopPropagation();
//       openCopyModal(btn.dataset.id);
//     });
//   });

//   // Image grid click -> open lightbox
//   document.querySelectorAll(".tile .il-img").forEach((item) => {
//     item.addEventListener("click", (e) => {
//       e.stopPropagation();
//       const idx = parseInt(item.dataset.index);
//       const grid = item.closest(".il-card-images");
//       const id = grid.dataset.obsId;
//       const obs = state.observations.find((o) => o.id === id);
//       const images = obs && obs.images && obs.images.length > 0 ? obs.images : (obs && obs.imageBase64 ? [obs.imageBase64] : []);
//       if (images.length > 0) {
//         openLightbox(images, idx);
//       }
//     });
//   });

//   // Tag click -> set active filter
//   document.querySelectorAll(".tile .tile-tag").forEach((el) => {
//     el.addEventListener("click", (e) => {
//       e.stopPropagation();
//       const tag = el.dataset.tag;
//       state.activeTagFilter = tag;
//       activeTagFilterBtn.textContent = `#${tag} ✕`;
//       activeTagFilterBtn.classList.remove("hidden");
//       renderFeed();
//     });
//   });
// }

// function renderFeedByDate(filtered) {
//   feed.innerHTML = "";
//   const groups = {};
//   filtered.forEach((o) => {
//     const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date();
//     const dateKey = getLocalDateKey(d);
//     if (!groups[dateKey]) groups[dateKey] = [];
//     groups[dateKey].push(o);
//   });

//   const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
//   sortedDates.forEach((dateKey) => {
//     appendGroup(formatDateHeader(dateKey), groups[dateKey]);
//   });
// }

// function renderFeedByPriority(filtered) {
//   feed.innerHTML = "";
//   const groups = { high: [], medium: [], low: [] };
//   filtered.forEach((o) => {
//     const p = o.priority || "medium";
//     if (groups[p]) groups[p].push(o);
//   });

//   ["high", "medium", "low"].forEach((p) => {
//     if (groups[p].length > 0) {
//       appendGroup(p.toUpperCase() + " PRIORITY", groups[p]);
//     }
//   });
// }

// function renderFeedByTags(filtered) {
//   feed.innerHTML = "";
//   const groups = {};
//   const untagged = [];

//   filtered.forEach((o) => {
//     if (o.tags && o.tags.length > 0) {
//       o.tags.forEach((t) => {
//         if (!groups[t]) groups[t] = [];
//         groups[t].push(o);
//       });
//     } else {
//       untagged.push(o);
//     }
//   });

//   const sortedTags = Object.keys(groups).sort((a, b) => a.localeCompare(b));
//   sortedTags.forEach((tag) => {
//     appendGroup("#" + tag, groups[tag]);
//   });

//   if (untagged.length > 0) {
//     appendGroup("UNTAGGED", untagged);
//   }
// }

// function appendGroup(title, items) {
//   const sec = document.createElement("div");
//   sec.className = "date-group";
//   sec.innerHTML = `<div class="date-header">${escapeHtml(title)}</div><div class="date-group-items"></div>`;
//   const container = sec.querySelector(".date-group-items");
  
//   // Sort items in feed group by priority than date
//   const sorted = [...items].sort((a, b) => {
//     const pVal = { high: 3, medium: 2, low: 1 };
//     const ap = pVal[a.priority || "medium"];
//     const bp = pVal[b.priority || "medium"];
//     if (ap !== bp) return bp - ap;
//     const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date();
//     const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date();
//     return db - da;
//   });

//   sorted.forEach((o) => {
//     const div = document.createElement("div");
//     div.innerHTML = renderTile(o);
//     container.appendChild(div.firstElementChild);
//   });
//   feed.appendChild(sec);
// }

// function buildObsSerialMap() {
//   obsSerialMap = {};
//   [...state.observations]
//     .filter((o) => !o.archived)
//     .sort((a, b) => getCreatedTime(a) - getCreatedTime(b))
//     .forEach((o, idx) => {
//       obsSerialMap[o.id] = idx + 1;
//     });
// }

// function getCreatedTime(o) {
//   if (!o.createdAt) return 0;
//   const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
//   return d.getTime();
// }

// export function updateStreakBadge() {
//   const streak = computeStreak(state.observations);
//   const badge = document.getElementById("streak-badge");
//   if (!badge) return;
//   if (streak > 0) {
//     badge.textContent = `🔥 ${streak} day streak`;
//     badge.classList.remove("hidden");
//   } else {
//     badge.classList.add("hidden");
//   }
// }

// export function updateDashStats() {
//   const stats = { today: 0, week: 0, month: 0, year: 0 };
//   const now = new Date();
  
//   const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
//   const tempWeek = new Date(now);
//   tempWeek.setDate(now.getDate() - now.getDay()); // Sunday
//   const startOfWeek = new Date(tempWeek.getFullYear(), tempWeek.getMonth(), tempWeek.getDate());
  
//   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//   const startOfYear = new Date(now.getFullYear(), 0, 1);

//   state.observations.forEach((o) => {
//     if (o.archived) return;
//     const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
//     if (!d) return;

//     if (d >= startOfToday) stats.today++;
//     if (d >= startOfWeek) stats.week++;
//     if (d >= startOfMonth) stats.month++;
//     if (d >= startOfYear) stats.year++;
//   });

//   const tEl = document.getElementById("dash-stat-today");
//   const wEl = document.getElementById("dash-stat-week");
//   const mEl = document.getElementById("dash-stat-month");
//   const yEl = document.getElementById("dash-stat-year");

//   if (tEl) tEl.textContent = stats.today;
//   if (wEl) wEl.textContent = stats.week;
//   if (mEl) mEl.textContent = stats.month;
//   if (yEl) yEl.textContent = stats.year;
// }

// // ===================== Observation Modal Forms =====================

// export function openCreateModal() {
//   state.editingObsId = null;
//   modalImages = [];
//   obsModalTitle.textContent = "New Observation";
  
//   // Set defaults
//   document.getElementById("obs-text").value = "";
//   document.getElementById("obs-folder").value = state.activeFolder !== "all" ? state.activeFolder : state.folders[0];
//   document.getElementById("obs-priority").value = "medium";
//   document.getElementById("obs-tags").value = "";
//   document.getElementById("obs-image-pending").checked = false;
  
//   // Clean dynamic lists
//   document.getElementById("obs-links-list").innerHTML = "";
//   document.getElementById("obs-image-files").value = "";
  
//   obsDeleteBtn.classList.add("hidden");
//   obsArchiveBtn.classList.add("hidden");
//   obsAddAnotherBtn.classList.remove("hidden");
//   renderEntryImageGrid();
  
//   obsModal.classList.remove("hidden");
//   setTimeout(() => document.getElementById("obs-text").focus(), 100);
// }

// export function openEditModal(id) {
//   state.editingObsId = id;
//   const obs = state.observations.find((o) => o.id === id);
//   if (!obs) return;

//   modalImages = [...(obs.images || [])];
//   obsModalTitle.textContent = "Edit Observation";
  
//   document.getElementById("obs-text").value = obs.text || "";
//   document.getElementById("obs-folder").value = obs.folder || state.folders[0];
//   document.getElementById("obs-priority").value = obs.priority || "medium";
//   document.getElementById("obs-tags").value = (obs.tags || []).join(", ");
//   document.getElementById("obs-image-pending").checked = !!obs.imagePending;
  
//   const links = obs.links && obs.links.length > 0 ? obs.links : (obs.link ? [obs.link] : []);
//   renderEntryLinksList(links);
  
//   document.getElementById("obs-image-files").value = "";
  
//   obsDeleteBtn.classList.remove("hidden");
//   obsAddAnotherBtn.classList.add("hidden");
  
//   // Archive button label/state toggle
//   obsArchiveBtn.classList.remove("hidden");
//   const isArchived = !!obs.archived;
//   obsArchiveBtn.dataset.archived = isArchived ? "true" : "false";
//   obsArchiveBtn.textContent = isArchived ? "📥 Unarchive" : "📥 Archive";
  
//   renderEntryImageGrid();
//   obsModal.classList.remove("hidden");
//   setTimeout(() => document.getElementById("obs-text").focus(), 100);
// }

// function renderEntryLinksList(links) {
//   const container = document.getElementById("obs-links-list");
//   container.innerHTML = "";
//   links.forEach((url, i) => {
//     const div = document.createElement("div");
//     div.className = "obs-modal-link-row";
//     div.innerHTML = `
//       <span class="obs-modal-link-text">${escapeHtml(url)}</span>
//       <button class="icon-btn remove-link-btn" data-index="${i}">✕</button>
//     `;
//     div.querySelector(".remove-link-btn").addEventListener("click", () => {
//       links.splice(i, 1);
//       renderEntryLinksList(links);
//     });
//     container.appendChild(div);
//   });
// }

// function renderEntryImageGrid() {
//   const container = document.getElementById("obs-modal-images-grid");
//   if (!container) return;
//   container.innerHTML = "";
  
//   modalImages.forEach((imgSrc, idx) => {
//     const div = document.createElement("div");
//     div.className = "obs-modal-image-preview";
//     div.innerHTML = `
//       <img src="${imgSrc}" />
//       <button class="obs-modal-image-remove" data-index="${idx}">✕</button>
//     `;
//     div.querySelector(".obs-modal-image-remove").addEventListener("click", () => {
//       modalImages.splice(idx, 1);
//       renderEntryImageGrid();
//     });
//     container.appendChild(div);
//   });
// }

// // Add link handlers inside obs modal
// const linkInput = document.getElementById("obs-link-input");
// const addLinkBtn = document.getElementById("obs-add-link-btn");
// if (addLinkBtn && linkInput) {
//   const addLink = () => {
//     const url = linkInput.value.trim();
//     if (!url) return;
    
//     // Retrieve current link array from list element DOM
//     const currentLinks = [...document.getElementById("obs-links-list").querySelectorAll(".obs-modal-link-text")].map((el) => el.textContent);
//     currentLinks.push(url);
//     renderEntryLinksList(currentLinks);
//     linkInput.value = "";
//   };
//   addLinkBtn.addEventListener("click", addLink);
//   linkInput.addEventListener("keydown", (e) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       addLink();
//     }
//   });
// }

// // Local image input file upload handler
// const fileInput = document.getElementById("obs-image-files");
// if (fileInput) {
//   fileInput.addEventListener("change", async (e) => {
//     const files = e.target.files;
//     if (!files || files.length === 0) return;
    
//     showToast("Processing images...");
//     for (let i = 0; i < files.length; i++) {
//       try {
//         const base64 = await resizeImageToBase64(files[i]);
//         modalImages.push(base64);
//       } catch (err) {
//         console.error(err);
//         showToast("Failed to resize image");
//       }
//     }
//     renderEntryImageGrid();
//     fileInput.value = ""; // clear
//   });
// }

// async function saveModalObservation(addAnother) {
//   const text = document.getElementById("obs-text").value.trim();
//   const folder = document.getElementById("obs-folder").value;
//   const priority = document.getElementById("obs-priority").value;
//   const tagsStr = document.getElementById("obs-tags").value;
//   const imagePending = document.getElementById("obs-image-pending").checked;

//   const links = [...document.getElementById("obs-links-list").querySelectorAll(".obs-modal-link-text")].map((el) => el.textContent);
  
//   if (!text && links.length === 0 && modalImages.length === 0) {
//     showToast("Enter a note, links, or upload an image.");
//     return;
//   }

//   // Parse comma separated tags
//   const tags = tagsStr.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

//   // Auto category suggestion
//   const bestCat = suggestCategory(text, tags);
//   const category = bestCat ? bestCat.category : null;

//   const data = {
//     text,
//     links,
//     link: links[0] || "", // fallback compatibility
//     tags,
//     folder,
//     priority,
//     imagePending,
//     images: modalImages,
//     category,
//     archived: false
//   };

//   obsSaveBtn.disabled = true;
//   obsSaveBtn.textContent = "Saving…";

//   try {
//     await saveObservation(state.editingObsId, data);
//     showToast(state.editingObsId ? "Observation updated" : "Observation saved");
    
//     if (addAnother) {
//       // Keep folder, clear other fields
//       document.getElementById("obs-text").value = "";
//       document.getElementById("obs-tags").value = "";
//       document.getElementById("obs-image-pending").checked = false;
//       document.getElementById("obs-links-list").innerHTML = "";
//       modalImages = [];
//       renderEntryImageGrid();
//       document.getElementById("obs-text").focus();
//     } else {
//       obsModal.classList.add("hidden");
//     }
//   } catch (err) {
//     console.error(err);
//     showToast("Could not save observation");
//   } finally {
//     obsSaveBtn.disabled = false;
//     obsSaveBtn.textContent = "Save";
//   }
// }

// export function openCopyModal(id) {
//   state.copyTargetObsId = id;
//   const obs = state.observations.find((o) => o.id === id);
//   if (!obs) return;

//   if (copyFolderSelect) {
//     copyFolderSelect.value = obs.folder || state.folders[0];
//   }
//   if (copyPrioritySelect) {
//     copyPrioritySelect.value = obs.priority || "medium";
//   }
//   if (copyModal) {
//     copyModal.classList.remove("hidden");
//   }
// }

// // Bind to window for global access/compatibility
// window.renderFeed = renderFeed;
// window.updateStreakBadge = updateStreakBadge;
// window.updateDashStats = updateDashStats;
// window.openCreateModal = openCreateModal;
// window.openEditModal = openEditModal;
// window.openCopyModal = openCopyModal;
// window.renderFolderTabs = renderFolderTabs;
// window.populateFolderSelects = populateFolderSelects;
import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';
import { getLocalDateKey, formatDateHeader, computeStreak } from '../utils/date.js';
import { renderTile, escapeHtml, attachImagePaste, getImageFromClipboardEvent, resizeImageToBase64, buildLinkPreviewIfApplicable } from '../utils/image.js';
import { saveObservation, deleteObservation, addCustomFolder, suggestCategory } from '../services/observations.js';
import { openLightbox } from './common.js';

// Elements references
const folderTabs = document.getElementById("folder-tabs");
const addFolderTab = document.getElementById("add-folder-tab");
const currentFolderLabel = document.getElementById("current-folder-label");
const searchInput = document.getElementById("search-input");
const groupSelect = document.getElementById("group-select");
const activeTagFilterBtn = document.getElementById("active-tag-filter");
const imagePendingToggle = document.getElementById("image-pending-toggle");
const archiveToggle = document.getElementById("archive-toggle");
const feed = document.getElementById("feed");
const emptyState = document.getElementById("empty-state");
const fabAdd = document.getElementById("fab-add");

const obsModal = document.getElementById("obs-modal");
const obsModalTitle = document.getElementById("obs-modal-title");
const obsModalBody = document.getElementById("obs-modal-body");
const obsModalClose = document.getElementById("obs-modal-close");
const obsSaveBtn = document.getElementById("obs-save-btn");
const obsCancelBtn = document.getElementById("obs-cancel-btn");
const obsDeleteBtn = document.getElementById("obs-delete-btn");
const obsAddAnotherBtn = document.getElementById("obs-add-another-btn");
const obsArchiveBtn = document.getElementById("obs-archive-btn");

const copyModal = document.getElementById("copy-modal");
const copyModalClose = document.getElementById("copy-modal-close");
const copyFolderSelect = document.getElementById("copy-folder-select");
const copyPrioritySelect = document.getElementById("copy-priority-select");
const copyCancelBtn = document.getElementById("copy-cancel-btn");
const copyConfirmBtn = document.getElementById("copy-confirm-btn");

const folderModal = document.getElementById("folder-modal");
const folderModalClose = document.getElementById("folder-modal-close");
const newFolderName = document.getElementById("new-folder-name");
const folderCancelBtn = document.getElementById("folder-cancel-btn");
const folderConfirmBtn = document.getElementById("folder-confirm-btn");

// Modal internal state
let obsSerialMap = {};

// ===================== Event Listeners =====================
window.addEventListener('observations-updated', () => {
  updateStreakBadge();
  updateDashStats();
  if (state.activeView === "dashboard") renderFeed();
});

window.addEventListener('folders-updated', () => {
  renderFolderTabs();
  populateFolderSelects();
});

window.addEventListener('view-changed', (e) => {
  if (e.detail.view === "dashboard") {
    renderFeed();
  }
});

// Search and filter listeners
if (searchInput) {
  searchInput.addEventListener("input", () => {
    if (state.activeView === "dashboard") renderFeed();
  });
}

if (groupSelect) {
  groupSelect.addEventListener("change", () => {
    state.groupMode = groupSelect.value;
    renderFeed();
  });
}

if (imagePendingToggle) {
  imagePendingToggle.addEventListener("click", () => {
    state.imagePendingOnly = !state.imagePendingOnly;
    imagePendingToggle.classList.toggle("active", state.imagePendingOnly);
    renderFeed();
  });
}

if (archiveToggle) {
  archiveToggle.addEventListener("click", () => {
    state.showArchived = !state.showArchived;
    archiveToggle.classList.toggle("active", state.showArchived);
    renderFeed();
  });
}

if (activeTagFilterBtn) {
  activeTagFilterBtn.addEventListener("click", () => {
    state.activeTagFilter = null;
    activeTagFilterBtn.classList.add("hidden");
    renderFeed();
  });
}

// Folder creation modal triggers
if (addFolderTab) {
  addFolderTab.addEventListener("click", () => {
    if (folderModal) {
      newFolderName.value = "";
      folderModal.classList.remove("hidden");
      setTimeout(() => newFolderName.focus(), 100);
    }
  });
}

if (folderModalClose) folderModalClose.addEventListener("click", () => folderModal.classList.add("hidden"));
if (folderCancelBtn) folderCancelBtn.addEventListener("click", () => folderModal.classList.add("hidden"));
if (folderConfirmBtn) {
  folderConfirmBtn.addEventListener("click", async () => {
    const name = newFolderName.value.trim();
    if (!name) return;
    if (state.folders.includes(name)) {
      showToast("Folder already exists");
      return;
    }
    try {
      await addCustomFolder(name);
      folderModal.classList.add("hidden");
      showToast("Folder created");
    } catch (e) {
      console.error(e);
      showToast("Could not create folder");
    }
  });
}

// Observation Modal triggers
if (fabAdd) {
  fabAdd.addEventListener("click", () => openCreateModal());
}

if (obsModalClose) obsModalClose.addEventListener("click", () => obsModal.classList.add("hidden"));
if (obsCancelBtn) obsCancelBtn.addEventListener("click", () => obsModal.classList.add("hidden"));
if (obsSaveBtn) {
  obsSaveBtn.addEventListener("click", () => saveModalObservation(false));
}
if (obsAddAnotherBtn) {
  obsAddAnotherBtn.addEventListener("click", () => saveModalObservation(true));
}
if (obsDeleteBtn) {
  obsDeleteBtn.addEventListener("click", async () => {
    if (!state.editingObsId) return;
    if (!confirm("Are you sure you want to delete this observation?")) return;
    try {
      await deleteObservation(state.editingObsId);
      obsModal.classList.add("hidden");
      showToast("Observation deleted");
    } catch (err) {
      console.error(err);
      showToast("Could not delete observation");
    }
  });
}

if (obsArchiveBtn) {
  obsArchiveBtn.addEventListener("click", async () => {
    if (!state.editingObsId) return;
    const isArchived = obsArchiveBtn.dataset.archived === "true";
    try {
      await saveObservation(state.editingObsId, { archived: !isArchived });
      obsModal.classList.add("hidden");
      showToast(!isArchived ? "Observation archived" : "Observation unarchived");
    } catch (err) {
      console.error(err);
      showToast("Failed to archive observation");
    }
  });
}

// Copy Modal triggers
if (copyModalClose) copyModalClose.addEventListener("click", () => copyModal.classList.add("hidden"));
if (copyCancelBtn) copyCancelBtn.addEventListener("click", () => copyModal.classList.add("hidden"));
if (copyConfirmBtn) {
  copyConfirmBtn.addEventListener("click", async () => {
    if (!state.copyTargetObsId) return;
    const original = state.observations.find((o) => o.id === state.copyTargetObsId);
    if (!original) return;

    const folder = copyFolderSelect.value;
    const priority = copyPrioritySelect.value;

    const copyData = {
      text: original.text || "",
      links: original.links || (original.link ? [original.link] : []),
      link: original.link || "",
      tags: original.tags || [],
      images: original.images || [],
      imagePending: original.imagePending || false,
      folder,
      priority,
      archived: false,
      copiedFrom: state.copyTargetObsId
    };

    try {
      await saveObservation(null, copyData);
      copyModal.classList.add("hidden");
      showToast(`Copied to ${folder}`);
    } catch (err) {
      console.error(err);
      showToast("Could not copy observation");
    }
  });
}

// ===================== Business Logic =====================

export function renderFolderTabs() {
  if (!folderTabs) return;
  // Preserve "Add custom folder" tab
  const addBtn = addFolderTab.cloneNode(true);
  addBtn.addEventListener("click", () => {
    newFolderName.value = "";
    folderModal.classList.remove("hidden");
    setTimeout(() => newFolderName.focus(), 100);
  });

  folderTabs.innerHTML = "";
  
  // Render "All" folder tab
  const allBtn = document.createElement("button");
  allBtn.className = `tab${state.activeFolder === "all" ? " active" : ""}`;
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => selectFolder("all"));
  folderTabs.appendChild(allBtn);

  // Custom folder tabs
  state.folders.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = `tab${state.activeFolder === f ? " active" : ""}`;
    btn.textContent = f;
    btn.addEventListener("click", () => selectFolder(f));
    folderTabs.appendChild(btn);
  });

  folderTabs.appendChild(addBtn);
}

function selectFolder(folder) {
  state.activeFolder = folder;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  
  // Toggle active class visually
  const tabs = [...folderTabs.children];
  const idx = folder === "all" ? 0 : state.folders.indexOf(folder) + 1;
  if (tabs[idx]) tabs[idx].classList.add("active");

  currentFolderLabel.textContent = folder === "all" ? "Dashboard" : folder;
  renderFeed();
}

export function populateFolderSelects() {
  populateFolderSelect("copy-folder-select", false);
  populateFolderSelect("revision-folder-filter", true);
}

export function populateFolderSelect(elOrId, includeAll) {
  const select = typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "All Folders";
    select.appendChild(opt);
  }
  state.folders.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    select.appendChild(opt);
  });
  if (currentVal && [...select.options].some((o) => o.value === currentVal)) {
    select.value = currentVal;
  }
}

export function renderFeed() {
  if (!feed) return;
  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
  buildObsSerialMap();

  // Apply filters
  let filtered = state.observations.filter((o) => {
    // 1. Archive filter
    if (!state.showArchived && o.archived) return false;
    
    // 2. Folder filter
    if (state.activeFolder !== "all" && o.folder !== state.activeFolder) return false;
    
    // 3. Image pending filter
    if (state.imagePendingOnly && !o.imagePending) return false;
    
    // 4. Tag filter
    if (state.activeTagFilter && !(o.tags || []).includes(state.activeTagFilter)) return false;
    
    // 5. Search query matching text, tags, links, and date keys
    if (q) {
      const textMatch = (o.text || "").toLowerCase().includes(q);
      const tagMatch = (o.tags || []).some((t) => t.toLowerCase().includes(q));
      const linkMatch = (o.links || []).some((l) => l.toLowerCase().includes(q)) || (o.link || "").toLowerCase().includes(q);
      const dateMatch = o.createdAt 
        ? getLocalDateKey(o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)).includes(q) 
        : false;
      return textMatch || tagMatch || linkMatch || dateMatch;
    }
    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  
  emptyState.classList.add("hidden");

  // Choose grouping strategy
  if (state.groupMode === "date") {
    renderFeedByDate(filtered);
  } else if (state.groupMode === "priority") {
    renderFeedByPriority(filtered);
  } else if (state.groupMode === "tags") {
    renderFeedByTags(filtered);
  }

  // Register interactive events on tiles
  attachFeedTileListeners();
}

function attachFeedTileListeners() {
  document.querySelectorAll(".tile .tile-serial").forEach((el) => {
    const id = el.dataset.serialFor;
    const serial = obsSerialMap[id];
    el.textContent = serial ? `#${serial}` : "";
    if (!serial) el.classList.add("hidden");
  });

  document.querySelectorAll(".tile .link-preview-mount").forEach((mount) => {
    const url = mount.dataset.url;
    const link = mount.previousElementSibling;
    const hasPreview = buildLinkPreviewIfApplicable(url, mount, () => {
      if (link) link.classList.remove("hidden");
    });
    if (hasPreview && link) {
      link.classList.add("hidden");
    } else {
      mount.remove();
    }
  });

  document.querySelectorAll(".tile .tile-body").forEach((body) => {
    body.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest("button") || e.target.closest(".il-img") || e.target.closest("iframe") || e.target.closest(".link-preview-mount")) return;
      const tile = body.closest(".tile");
      state.expandedTileId = state.expandedTileId === tile.dataset.id ? null : tile.dataset.id;
      renderFeed();
    });
  });

  // Star button
  document.querySelectorAll(".tile .starred").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const original = state.observations.find((o) => o.id === id);
      if (!original) return;
      const nextStar = !(original.starred ?? false);
      try {
        await saveObservation(id, { starred: nextStar });
      } catch (err) {
        console.error(err);
      }
    });
  });

  // Edit button
  document.querySelectorAll(".tile .edit-obs-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });

  // Copy to folder button
  document.querySelectorAll(".tile .copy-obs-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCopyModal(btn.dataset.id);
    });
  });

  // Image grid click -> open lightbox
  document.querySelectorAll(".tile .il-img").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(item.dataset.index);
      const grid = item.closest(".il-card-images");
      const id = grid.dataset.obsId;
      const obs = state.observations.find((o) => o.id === id);
      const images = obs && obs.images && obs.images.length > 0 ? obs.images : (obs && obs.imageBase64 ? [obs.imageBase64] : []);
      if (images.length > 0) {
        openLightbox(images, idx);
      }
    });
  });

  // Tag click -> set active filter
  document.querySelectorAll(".tile .tile-tag").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const tag = el.dataset.tag;
      state.activeTagFilter = tag;
      activeTagFilterBtn.textContent = `#${tag} ✕`;
      activeTagFilterBtn.classList.remove("hidden");
      renderFeed();
    });
  });
}

function renderFeedByDate(filtered) {
  feed.innerHTML = "";
  const groups = {};
  filtered.forEach((o) => {
    const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date();
    const dateKey = getLocalDateKey(d);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(o);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  sortedDates.forEach((dateKey) => {
    appendGroup(formatDateHeader(dateKey), groups[dateKey]);
  });
}

function renderFeedByPriority(filtered) {
  feed.innerHTML = "";
  const groups = { high: [], medium: [], low: [] };
  filtered.forEach((o) => {
    const p = o.priority || "medium";
    if (groups[p]) groups[p].push(o);
  });

  ["high", "medium", "low"].forEach((p) => {
    if (groups[p].length > 0) {
      appendGroup(p.toUpperCase() + " PRIORITY", groups[p]);
    }
  });
}

function renderFeedByTags(filtered) {
  feed.innerHTML = "";
  const groups = {};
  const untagged = [];

  filtered.forEach((o) => {
    if (o.tags && o.tags.length > 0) {
      o.tags.forEach((t) => {
        if (!groups[t]) groups[t] = [];
        groups[t].push(o);
      });
    } else {
      untagged.push(o);
    }
  });

  const sortedTags = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  sortedTags.forEach((tag) => {
    appendGroup("#" + tag, groups[tag]);
  });

  if (untagged.length > 0) {
    appendGroup("UNTAGGED", untagged);
  }
}

function appendGroup(title, items) {
  const sec = document.createElement("div");
  sec.className = "date-group";
  sec.innerHTML = `<div class="date-header">${escapeHtml(title)}</div><div class="date-group-items"></div>`;
  const container = sec.querySelector(".date-group-items");
  
  // Sort items in feed group by priority than date
  const sorted = [...items].sort((a, b) => {
    const pVal = { high: 3, medium: 2, low: 1 };
    const ap = pVal[a.priority || "medium"];
    const bp = pVal[b.priority || "medium"];
    if (ap !== bp) return bp - ap;
    const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date();
    const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date();
    return db - da;
  });

  sorted.forEach((o) => {
    const div = document.createElement("div");
    div.innerHTML = renderTile(o);
    container.appendChild(div.firstElementChild);
  });
  feed.appendChild(sec);
}

function buildObsSerialMap() {
  obsSerialMap = {};
  [...state.observations]
    .filter((o) => !o.archived)
    .sort((a, b) => getCreatedTime(a) - getCreatedTime(b))
    .forEach((o, idx) => {
      obsSerialMap[o.id] = idx + 1;
    });
}

function getCreatedTime(o) {
  if (!o.createdAt) return 0;
  const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
  return d.getTime();
}

export function updateStreakBadge() {
  const streak = computeStreak(state.observations);
  const badge = document.getElementById("streak-badge");
  if (!badge) return;
  if (streak > 0) {
    badge.textContent = `🔥 ${streak} day streak`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

export function updateDashStats() {
  const stats = { today: 0, week: 0, month: 0, year: 0 };
  const now = new Date();
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const tempWeek = new Date(now);
  tempWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const startOfWeek = new Date(tempWeek.getFullYear(), tempWeek.getMonth(), tempWeek.getDate());
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  state.observations.forEach((o) => {
    if (o.archived) return;
    const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
    if (!d) return;

    if (d >= startOfToday) stats.today++;
    if (d >= startOfWeek) stats.week++;
    if (d >= startOfMonth) stats.month++;
    if (d >= startOfYear) stats.year++;
  });

  const tEl = document.getElementById("dash-stat-today");
  const wEl = document.getElementById("dash-stat-week");
  const mEl = document.getElementById("dash-stat-month");
  const yEl = document.getElementById("dash-stat-year");

  if (tEl) tEl.textContent = stats.today;
  if (wEl) wEl.textContent = stats.week;
  if (mEl) mEl.textContent = stats.month;
  if (yEl) yEl.textContent = stats.year;
}

// ===================== Observation Modal Forms =====================
// The modal body is empty in index.html by design — <!-- One or more
// .obs-entry blocks injected here --> — and #obs-entry-template holds the
// markup for a single entry, using CLASS names (.obs-text, .obs-folder,
// etc.) scoped to that entry rather than fixed page-wide IDs. Everything
// below clones that template and wires up its fields/interactions per
// entry element.

function createObsEntry() {
  const tpl = document.getElementById("obs-entry-template");
  const frag = tpl.content.cloneNode(true);
  const entry = frag.querySelector(".obs-entry");
  entry._images = [];

  populateFolderSelect(entry.querySelector(".obs-folder"), false);

  // Links
  const linksList = entry.querySelector(".obs-links-list");
  const linkInput = entry.querySelector(".obs-link-input");
  const linkAddBtn = entry.querySelector(".obs-link-add-btn");
  const addLink = () => {
    const url = linkInput.value.trim();
    if (!url) return;
    renderEntryLinks(linksList, [...getEntryLinks(linksList), url]);
    linkInput.value = "";
  };
  linkAddBtn.addEventListener("click", addLink);
  linkInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLink();
    }
  });

  // Images — file picker, drag & drop, and clipboard paste
  const imageZone = entry.querySelector(".obs-image-zone");
  const imageFileInput = entry.querySelector(".obs-image-file");
  const imageGrid = entry.querySelector(".obs-image-grid");
  const textArea = entry.querySelector(".obs-text");

  const addImageFiles = async (files) => {
    if (!files || !files.length) return;
    showToast("Processing images...");
    for (const file of files) {
      try {
        const base64 = await resizeImageToBase64(file);
        entry._images.push(base64);
      } catch (err) {
        console.error(err);
        showToast("Failed to resize image");
      }
    }
    renderEntryImages(imageGrid, entry);
  };

  imageZone.addEventListener("click", (e) => {
    if (e.target === imageFileInput) return;
    imageFileInput.click();
  });
  imageFileInput.addEventListener("change", () => {
    addImageFiles(imageFileInput.files);
    imageFileInput.value = "";
  });
  imageZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageZone.classList.add("drag-over");
  });
  imageZone.addEventListener("dragleave", () => imageZone.classList.remove("drag-over"));
  imageZone.addEventListener("drop", (e) => {
    e.preventDefault();
    imageZone.classList.remove("drag-over");
    addImageFiles(e.dataTransfer.files);
  });
  const handleImagePaste = async (file) => {
    try {
      showToast("Processing image from clipboard...");
      const base64 = await resizeImageToBase64(file);
      entry._images.push(base64);
      renderEntryImages(imageGrid, entry);
    } catch (err) {
      console.error("Paste image error", err);
      showToast("Failed to process clipboard image");
    }
  };

  // Attach paste to textarea (focused paste)
  attachImagePaste(textArea, handleImagePaste);

  // Also attach paste to the entire entry container so paste works
  // even when focus is elsewhere (e.g. clicking the image zone or modal backdrop)
  entry.addEventListener("paste", (e) => {
    const file = getImageFromClipboardEvent(e);
    if (file) {
      e.preventDefault();
      handleImagePaste(file);
    }
  });

  attachTagAutocomplete(entry);

  entry.querySelector(".obs-entry-remove").addEventListener("click", () => entry.remove());

  return entry;
}

// ===================== Tag autocomplete (comma-separated, per-tag) =====================
// Finds the tag segment the caret is currently sitting inside — i.e. the
// text between the surrounding commas — so suggestions/replacement only
// ever touch the tag actively being typed, not the whole field.
function getTagSegmentAtCursor(input) {
  const value = input.value;
  const pos = input.selectionStart ?? value.length;
  const before = value.lastIndexOf(",", pos - 1);
  const afterRel = value.slice(pos).indexOf(",");
  const start = before === -1 ? 0 : before + 1;
  const end = afterRel === -1 ? value.length : pos + afterRel;
  return { start, end, text: value.slice(start, end) };
}

// Replaces the tag segment under the caret with the chosen suggestion,
// normalizes it to "tag, " and leaves the caret right after it so typing
// continues straight into the next tag.
function applyTagSuggestion(input, tag) {
  const value = input.value;
  const seg = getTagSegmentAtCursor(input);
  const before = value.slice(0, seg.start).replace(/\s+$/, "");
  const after = value.slice(seg.end).replace(/^[\s,]+/, "");
  const prefix = before ? before + ", " : "";
  const insertion = tag + ", ";
  input.value = prefix + insertion + after;
  const caret = prefix.length + insertion.length;
  input.focus();
  input.setSelectionRange(caret, caret);
}

function attachTagAutocomplete(entry) {
  const input = entry.querySelector(".obs-tags");
  const dropdown = entry.querySelector(".tag-autocomplete-dropdown");
  if (!input || !dropdown) return;

  let items = [];
  let activeIndex = -1;

  const hide = () => {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    items = [];
    activeIndex = -1;
  };

  const setActive = (idx) => {
    [...dropdown.children].forEach((c) => c.classList.remove("active"));
    activeIndex = idx;
    if (idx >= 0 && dropdown.children[idx]) {
      dropdown.children[idx].classList.add("active");
      dropdown.children[idx].scrollIntoView({ block: "nearest" });
    }
  };

  const renderMatches = (matches) => {
    dropdown.innerHTML = "";
    items = matches;
    activeIndex = -1;
    if (matches.length === 0) {
      hide();
      return;
    }
    matches.forEach((tag) => {
      const item = document.createElement("div");
      item.className = "tag-autocomplete-item";
      item.textContent = tag;
      // mousedown fires before the input's blur handler, so the click
      // registers before we hide the dropdown on blur
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applyTagSuggestion(input, tag);
        hide();
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.remove("hidden");
  };

  const updateSuggestions = () => {
    const word = getTagSegmentAtCursor(input).text.trim().toLowerCase();
    if (!word) {
      hide();
      return;
    }
    const alreadyUsed = new Set(
      input.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    );
    const matches = (state.allTags || [])
      .filter((tag) => tag.includes(word) && !alreadyUsed.has(tag))
      .sort((a, b) => {
        const aStarts = a.startsWith(word) ? 0 : 1;
        const bStarts = b.startsWith(word) ? 0 : 1;
        return aStarts !== bStarts ? aStarts - bStarts : a.localeCompare(b);
      })
      .slice(0, 8);
    renderMatches(matches);
  };

  input.addEventListener("input", updateSuggestions);
  input.addEventListener("click", updateSuggestions);
  input.addEventListener("blur", () => setTimeout(hide, 100));
  input.addEventListener("keydown", (e) => {
    if (dropdown.classList.contains("hidden") || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        applyTagSuggestion(input, items[activeIndex]);
        hide();
      }
    } else if (e.key === "Escape") {
      hide();
    }
  });
}

function getEntryLinks(container) {
  return [...container.querySelectorAll(".obs-modal-link-text")].map((el) => el.textContent);
}

function renderEntryLinks(container, links) {
  container.innerHTML = "";
  links.forEach((url, i) => {
    const div = document.createElement("div");
    div.className = "obs-modal-link-row";
    div.innerHTML = `
      <span class="obs-modal-link-text">${escapeHtml(url)}</span>
      <button type="button" class="icon-btn remove-link-btn" data-index="${i}">✕</button>
    `;
    div.querySelector(".remove-link-btn").addEventListener("click", () => {
      links.splice(i, 1);
      renderEntryLinks(container, links);
    });
    container.appendChild(div);
  });
}

function renderEntryImages(container, entry) {
  container.innerHTML = "";
  (entry._images || []).forEach((imgSrc, idx) => {
    const div = document.createElement("div");
    div.className = "obs-modal-image-preview";
    div.innerHTML = `
      <img src="${imgSrc}" />
      <button type="button" class="obs-modal-image-remove" data-index="${idx}">✕</button>
    `;
    div.querySelector(".obs-modal-image-remove").addEventListener("click", () => {
      entry._images.splice(idx, 1);
      renderEntryImages(container, entry);
    });
    container.appendChild(div);
  });
}

export function openCreateModal() {
  state.editingObsId = null;
  obsModalTitle.textContent = "New Observation";
  obsModalBody.innerHTML = "";

  const entry = createObsEntry();
  entry.querySelector(".obs-folder").value = state.activeFolder !== "all" ? state.activeFolder : state.folders[0];
  entry.querySelector(".obs-entry-header").classList.add("hidden");
  obsModalBody.appendChild(entry);

  obsDeleteBtn.classList.add("hidden");
  obsArchiveBtn.classList.add("hidden");
  obsAddAnotherBtn.classList.remove("hidden");

  obsModal.classList.remove("hidden");
  setTimeout(() => entry.querySelector(".obs-text").focus(), 100);
}

export function openEditModal(id) {
  state.editingObsId = id;
  const obs = state.observations.find((o) => o.id === id);
  if (!obs) return;

  obsModalTitle.textContent = "Edit Observation";
  obsModalBody.innerHTML = "";

  const entry = createObsEntry();
  entry.querySelector(".obs-text").value = obs.text || "";
  entry.querySelector(".obs-folder").value = obs.folder || state.folders[0];
  entry.querySelector(".obs-priority").value = obs.priority || "medium";
  entry.querySelector(".obs-tags").value = (obs.tags || []).join(", ");
  entry.querySelector(".obs-image-pending").checked = !!obs.imagePending;
  entry.querySelector(".obs-entry-header").classList.add("hidden");

  const links = obs.links && obs.links.length > 0 ? obs.links : (obs.link ? [obs.link] : []);
  renderEntryLinks(entry.querySelector(".obs-links-list"), links);

  entry._images = [...(obs.images || [])];
  renderEntryImages(entry.querySelector(".obs-image-grid"), entry);

  obsModalBody.appendChild(entry);

  obsDeleteBtn.classList.remove("hidden");
  obsAddAnotherBtn.classList.add("hidden");

  obsArchiveBtn.classList.remove("hidden");
  const isArchived = !!obs.archived;
  obsArchiveBtn.dataset.archived = isArchived ? "true" : "false";
  obsArchiveBtn.textContent = isArchived ? "📥 Unarchive" : "📥 Archive";

  obsModal.classList.remove("hidden");
  setTimeout(() => entry.querySelector(".obs-text").focus(), 100);
}

async function saveModalObservation(addAnother) {
  const entry = obsModalBody.querySelector(".obs-entry");
  if (!entry) return;

  const text = entry.querySelector(".obs-text").value.trim();
  const folder = entry.querySelector(".obs-folder").value;
  const priority = entry.querySelector(".obs-priority").value;
  const tagsStr = entry.querySelector(".obs-tags").value;
  const imagePending = entry.querySelector(".obs-image-pending").checked;
  const links = getEntryLinks(entry.querySelector(".obs-links-list"));
  const images = entry._images || [];

  if (!text && links.length === 0 && images.length === 0) {
    showToast("Enter a note, links, or upload an image.");
    return;
  }

  // Parse comma separated tags
  const tags = tagsStr.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  // Auto category suggestion
  const bestCat = suggestCategory(text, tags);
  const category = bestCat ? bestCat.category : null;

  const data = {
    text,
    links,
    link: links[0] || "", // fallback compatibility
    tags,
    folder,
    priority,
    imagePending,
    images,
    category,
    archived: false
  };

  obsSaveBtn.disabled = true;
  obsSaveBtn.textContent = "Saving…";

  try {
    await saveObservation(state.editingObsId, data);
    showToast(state.editingObsId ? "Observation updated" : "Observation saved");
    
    if (addAnother) {
      // Keep folder, reset everything else with a fresh entry
      obsModalBody.innerHTML = "";
      const newEntry = createObsEntry();
      newEntry.querySelector(".obs-folder").value = folder;
      newEntry.querySelector(".obs-entry-header").classList.add("hidden");
      obsModalBody.appendChild(newEntry);
      newEntry.querySelector(".obs-text").focus();
    } else {
      obsModal.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("Could not save observation");
  } finally {
    obsSaveBtn.disabled = false;
    obsSaveBtn.textContent = "Save";
  }
}

export function openCopyModal(id) {
  state.copyTargetObsId = id;
  const obs = state.observations.find((o) => o.id === id);
  if (!obs) return;

  if (copyFolderSelect) {
    copyFolderSelect.value = obs.folder || state.folders[0];
  }
  if (copyPrioritySelect) {
    copyPrioritySelect.value = obs.priority || "medium";
  }
  if (copyModal) {
    copyModal.classList.remove("hidden");
  }
}

// Bind to window for global access/compatibility
window.renderFeed = renderFeed;
window.updateStreakBadge = updateStreakBadge;
window.updateDashStats = updateDashStats;
window.openCreateModal = openCreateModal;
window.openEditModal = openEditModal;
window.openCopyModal = openCopyModal;
window.renderFolderTabs = renderFolderTabs;
window.populateFolderSelects = populateFolderSelects;