import { toastEl } from '../dom.js';

let toastTimer = null;

export function showToast(msg, duration = 2200) {
  if (typeof msg === "string" && msg.includes("<")) {
    toastEl.innerHTML = msg;
  } else {
    toastEl.textContent = msg;
  }
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), duration);
}

// Bind to window for global access/compatibility
window.showToast = showToast;
