import { db } from '../firebase-init.js';
import { state } from '../state.js';
import { themeToggleBtn, metaThemeColor } from '../dom.js';

let currentTheme = "dark";

export function applyTheme(theme, persist) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "🌙" : "☀️";
    themeToggleBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", isDark ? "#0A0E17" : "#F0F4FA");
  }
  
  // Sync the settings switch
  const sw = document.getElementById("settings-theme-toggle");
  if (sw) sw.classList.toggle("is-light", !isDark);
  
  if (persist && state.currentUser) {
    db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("preferences")
      .set({ theme }, { merge: true })
      .catch((err) => console.error("theme save error", err));
  }
}

export function loadThemePreference() {
  if (!state.currentUser) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light", false);
    return;
  }
  
  db.collection("users").doc(state.currentUser.uid)
    .collection("settings").doc("preferences")
    .get()
    .then((doc) => {
      if (doc.exists && doc.data().theme) {
        applyTheme(doc.data().theme, false);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        applyTheme(prefersDark ? "dark" : "light", false);
      }
    })
    .catch(() => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light", false);
    });
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    applyTheme(currentTheme === "dark" ? "light" : "dark", true);
  });
}

// Apply OS preference immediately before auth loads (avoids flash)
(function() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  const meta = document.getElementById("meta-theme-color");
  if (meta && !prefersDark) meta.setAttribute("content", "#F0F4FA");
})();
