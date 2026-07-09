import { toastEl } from '../dom.js';

let toastTimer = null;

export function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

// Bind to window for global access/compatibility
window.showToast = showToast;
