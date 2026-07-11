import { state } from '../state.js';
import { formatTime } from './date.js';
import { loadGoogleApiKey } from '../services/ai.js';

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

export function extractDriveFileId(url) {
  if (!url) return null;
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (match) return { id: match[1], isFolder: false };
  match = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (match) return { id: match[1], isFolder: true };
  match = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (match) return { id: match[1], isFolder: false };
  return null;
}

export function isGoogleDriveUrl(url) {
  return !!url && /drive\.google\.com|docs\.google\.com/i.test(url);
}

export function isTradingViewUrl(url) {
  return !!url && /tradingview\.com/i.test(url);
}

export function isInstagramUrl(url) {
  return !!url && /instagram\.com\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/i.test(url);
}

export function buildInstagramEmbed(url) {
  const match = url.match(/instagram\.com\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/i);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const code = match[2];

  const wrap = document.createElement("div");
  wrap.className = "instagram-preview-wrap";
  wrap.addEventListener("pointerdown", (e) => e.stopPropagation());
  wrap.addEventListener("click", (e) => e.stopPropagation());

  const iframe = document.createElement("iframe");
  iframe.className = "instagram-embed";
  iframe.src = `https://www.instagram.com/${type === "p" ? "p" : "reel"}/${code}/embed/`;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("allow", "encrypted-media");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.style.pointerEvents = "auto";
  iframe.addEventListener("pointerdown", (e) => e.stopPropagation());
  iframe.addEventListener("click", (e) => e.stopPropagation());

  wrap.appendChild(iframe);
  return wrap;
}

export function extractTradingViewSnapshotUrls(url) {
  if (!url) return [];
  if (/s3\.tradingview\.com\/snapshots\//i.test(url)) return [url];
  const match = url.match(/tradingview\.com\/x\/([a-zA-Z0-9]+)/i);
  if (!match) return [];
  const code = match[1];
  return [`https://s3.tradingview.com/snapshots/${code.charAt(0).toLowerCase()}/${code}.png`];
}

export function buildLiveImagePreview(candidates, container, onLoaded, onFail) {
  container.innerHTML = "";
  container.classList.add("drive-preview-wrap");
  container.addEventListener("pointerdown", (e) => e.stopPropagation());
  container.addEventListener("click", (e) => e.stopPropagation());

  const img = document.createElement("img");
  img.className = "drive-link-preview";
  img.alt = "Link preview";
  img.loading = "lazy";
  img.draggable = false;
  img.referrerPolicy = "no-referrer";
  img.addEventListener("pointerdown", (e) => e.stopPropagation());

  container.appendChild(img);
  tryNext(candidates, 0, img, onLoaded, onFail);
}

export function tryNext(urls, index, imgEl, onLoaded, onFail) {
  if (index >= urls.length) {
    imgEl.classList.add("hidden");
    if (imgEl.parentElement) imgEl.parentElement.style.display = "none";
    if (onFail) onFail();
    return;
  }

  imgEl.src = urls[index];
  imgEl.onload = () => {
    imgEl.classList.remove("hidden");
    if (onLoaded) onLoaded(imgEl.src);
  };
  imgEl.onerror = () => tryNext(urls, index + 1, imgEl, onLoaded, onFail);
}

export function buildDriveVideoEmbed(fileId, container) {
  container.innerHTML = "";
  container.classList.add("drive-preview-wrap", "drive-video-wrap");
  container.addEventListener("pointerdown", (e) => e.stopPropagation());
  container.addEventListener("click", (e) => e.stopPropagation());

  const iframe = document.createElement("iframe");
  iframe.className = "drive-video-embed";
  iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("loading", "lazy");
  // Inline sizing so no extra CSS file changes are required
  iframe.style.width = "100%";
  iframe.style.aspectRatio = "16 / 9";
  iframe.style.minHeight = "220px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "8px";
  iframe.style.display = "block";
  iframe.addEventListener("pointerdown", (e) => e.stopPropagation());
  iframe.addEventListener("click", (e) => e.stopPropagation());

  container.appendChild(iframe);
}

export async function buildDriveFilePreview(fileId, container, onFail) {
  const apiKey = await loadGoogleApiKey();

  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}&fields=mimeType`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.mimeType && data.mimeType.startsWith("video/")) {
          buildDriveVideoEmbed(fileId, container);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not check Drive file type, falling back to image preview", err);
    }
  }

  // No API key set, mimeType check failed, or it's not a video — behave as before.
  buildLiveImagePreview([
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
    `https://lh3.googleusercontent.com/d/${fileId}=s1000`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
  ], container, null, onFail);
}

export async function buildDriveFolderPreview(folderId, container, onFail) {
  container.innerHTML = `<div class="drive-folder-loading">Loading Drive folder images...</div>`;

  const apiKey = await loadGoogleApiKey();
  if (!apiKey) {
    container.innerHTML = `
      <div class="drive-folder-no-key">
        <span>Drive folder preview</span>
        <p>Set a Google API Key in Settings to list folder files directly.</p>
      </div>
    `;
    if (onFail) onFail();
    return;
  }

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
  const api = `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=files(id,name)&pageSize=50`;

  try {
    const res = await fetch(api);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      container.innerHTML = `<div class="drive-folder-empty">Folder has no images</div>`;
      if (onFail) onFail();
      return;
    }

    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "drive-folder-grid";
    grid.classList.add(`grid-count-${Math.min(files.length, 4)}`);

    files.forEach((file) => {
      const cell = document.createElement("div");
      cell.className = "drive-preview-wrap folder-item";
      buildLiveImagePreview([
        `https://lh3.googleusercontent.com/d/${file.id}=w1000`,
        `https://lh3.googleusercontent.com/d/${file.id}=s1000`,
        `https://drive.google.com/uc?export=view&id=${file.id}`,
        `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`
      ], cell, null, null);
      grid.appendChild(cell);
    });

    container.appendChild(grid);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="link-preview-error">Could not load folder contents</div>`;
    if (onFail) onFail();
  }
}

export function buildLinkPreviewIfApplicable(url, container, onFail) {
  if (isGoogleDriveUrl(url)) {
    const parsed = extractDriveFileId(url);
    if (!parsed) return false;

    if (parsed.isFolder) {
      buildDriveFolderPreview(parsed.id, container, onFail);
      return true;
    }

    buildDriveFilePreview(parsed.id, container, onFail);
    return true;
  }

  if (isTradingViewUrl(url)) {
    const candidates = extractTradingViewSnapshotUrls(url);
    if (candidates.length === 0) return false;
    buildLiveImagePreview(candidates, container, null, onFail);
    return true;
  }

  if (isInstagramUrl(url)) {
    const embed = buildInstagramEmbed(url);
    if (!embed) return false;
    container.innerHTML = "";
    container.appendChild(embed);
    return true;
  }

  return false;
}

export function buildLinksSection(links) {
  if (!links || links.length === 0) return "";

  return `
    <div class="entry-links-section">
      ${links.map((url) => `
        <div class="entry-link-row">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="entry-link-anchor tile-link">
            Link: ${escapeHtml(url)}
          </a>
          <div class="link-preview-mount" data-url="${escapeHtml(url)}"></div>
        </div>
      `).join("")}
    </div>
  `;
}

export function getObservationLinks(obs) {
  return obs && obs.links && obs.links.length > 0 ? obs.links : (obs && obs.link ? [obs.link] : []);
}

export function buildLinksFragment(obs, linkClass = "tile-link") {
  const frag = document.createDocumentFragment();
  const urls = getObservationLinks(obs);

  urls.forEach((url) => {
    const linkEl = document.createElement("a");
    linkEl.className = linkClass;
    linkEl.href = url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = "Link: " + url;
    linkEl.addEventListener("click", (e) => e.stopPropagation());

    const previewMount = document.createElement("div");
    previewMount.className = "link-preview-mount";
    const hasPreview = buildLinkPreviewIfApplicable(url, previewMount, () => {
      linkEl.classList.remove("hidden");
    });

    if (hasPreview) {
      linkEl.classList.add("hidden");
      frag.appendChild(linkEl);
      frag.appendChild(previewMount);
    } else {
      frag.appendChild(linkEl);
    }
  });

  return frag;
}

export function buildImageGrid(images, obsId, isTile) {
  if (!images || images.length === 0) return "";
  const count = images.length;
  const countClass = count >= 4 ? "count-4plus" : `count-${count}`;
  let html = `<div class="il-card-images ${countClass}" data-obs-id="${escapeHtml(obsId)}">`;

  images.forEach((imgSrc, idx) => {
    if (isTile && idx >= 4) return;
    const badge = isTile && idx === 3 && count > 4
      ? `<div class="il-img-more">+${count - 4}</div>`
      : "";

    html += `
      <img class="il-img" src="${escapeHtml(imgSrc)}" loading="lazy" alt="Observation screenshot ${idx + 1}" data-index="${idx}" />
      ${badge}
    `;
  });

  html += `</div>`;
  return html;
}

export function renderTile(obs) {
  const priority = obs.priority || "medium";
  const createdTime = obs.createdAt
    ? (obs.createdAt.toDate ? obs.createdAt.toDate() : new Date(obs.createdAt))
    : new Date();
  const links = obs.links && obs.links.length > 0 ? obs.links : (obs.link ? [obs.link] : []);
  const images = obs.images && obs.images.length > 0 ? obs.images : (obs.imageBase64 ? [obs.imageBase64] : []);
  const hasImage = images.length > 0;
  const hasLink = links.length > 0;
  const isExpanded = state.expandedTileId === obs.id;
  const mediaHtml = `${hasImage ? buildImageGrid(images, obs.id, true) : ""}${hasLink ? buildLinksSection(links) : ""}`;
  const tagsHtml = (obs.tags || [])
    .map((t) => `<span class="tag-chip clickable tile-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`)
    .join("");
  const categoryHtml = obs.category ? `<span class="category-pill">${escapeHtml(obs.category)}</span>` : "";

  return `
    <div class="tile priority-${escapeHtml(priority)}${isExpanded ? " expanded" : ""}" id="tile-${escapeHtml(obs.id)}" data-id="${escapeHtml(obs.id)}">
      <div class="tile-body${!hasImage && !hasLink ? " fill-text" : ""}">
        <div class="tile-header-row">
          <span class="tile-serial" data-serial-for="${escapeHtml(obs.id)}"></span>
          <div class="tile-text">${escapeHtml(obs.text || "(no text)")}</div>
          <span class="expand-chevron">▾</span>
        </div>
        ${
          obs.imagePending || obs.archived
            ? `<div class="tile-badge-row">${obs.imagePending ? `<span class="status-badge pending">Image pending</span>` : ""}${obs.archived ? `<span class="status-badge archived">Archived</span>` : ""}</div>`
            : ""
        }
        ${!isExpanded ? mediaHtml : ""}
        <div class="tile-meta">
          <div class="tile-tags">${tagsHtml}${categoryHtml}</div>
          <div class="tile-time">${formatTime(createdTime)}</div>
        </div>
        <div class="tile-expand-content">
          ${isExpanded ? mediaHtml : ""}
          <div class="tile-expand-row"><span><b>Folder:</b> ${escapeHtml(obs.folder || "Uncategorized")} (${escapeHtml(priority)})</span></div>
          <div class="tile-expand-row"><span><b>Logged:</b> ${escapeHtml(createdTime.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))}</span></div>
        </div>
      </div>
      <div class="tile-actions">
        <button class="tile-action-btn edit-obs-btn" data-id="${escapeHtml(obs.id)}" title="Edit">✎</button>
        <button class="tile-action-btn copy-obs-btn" data-id="${escapeHtml(obs.id)}" title="Copy to folder">⧉</button>
        <button class="tile-action-btn starred${obs.starred ? " active" : ""}" data-id="${escapeHtml(obs.id)}" title="Toggle star">${obs.starred ? "★" : "☆"}</button>
      </div>
    </div>
  `;
}

export function getImageFromClipboardEvent(e) {
  if (!e.clipboardData) return null;
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      return items[i].getAsFile();
    }
  }
  return null;
}

export function attachImagePaste(input, onImageFound) {
  input.addEventListener("paste", (e) => {
    const file = getImageFromClipboardEvent(e);
    if (file) {
      e.preventDefault();
      onImageFound(file);
    }
  });
}

export function resizeImageToBase64(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}