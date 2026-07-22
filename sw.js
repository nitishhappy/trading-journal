const CACHE_NAME = "trade-journal-53e3a336d8";
// Separate, persistent cache for image/video bytes (Drive, TradingView, etc.).
// Unlike CACHE_NAME above, this is intentionally NOT wiped on every service
// worker update (see activate handler) — an image cached last month should
// still be viewable offline after you've deployed ten unrelated code changes.
const IMAGE_CACHE_NAME = "trade-journal-images-v1";
const MAX_IMAGE_CACHE_ENTRIES = 300;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./trade-security.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Modular JS files
  "./js/state.js",
  "./js/dom.js",
  "./js/firebase-init.js",
  "./js/utils/toast.js",
  "./js/utils/theme.js",
  "./js/utils/date.js",
  "./js/utils/image.js",
  "./js/utils/export.js",
  "./js/utils/keyboard.js",
  "./js/services/observations.js",
  "./js/services/trades.js",
  "./js/services/checklists.js",
  "./js/services/ai.js",
  "./js/services/candleChecklist.js",
  "./js/services/tvNotifications.js",
  "./js/services/sequenceRules.js",
  "./js/ui/common.js",
  "./js/ui/auth.js",
  "./js/ui/settings.js",
  "./js/ui/dashboard.js",
  "./js/ui/revision.js",
  "./js/ui/aicoach.js",
  "./js/ui/tradelog.js",
  "./js/ui/checklists.js",
  "./js/ui/candleChecklist.js",
  "./js/ui/tvNotifications.js",
  "./js/ui/sequenceRules.js",
  "./js/utils/error-tracking.js",
  "./css/tv-notifications.css",
  // Firebase SDK scripts — precached so the app can boot fully offline
  // even on a visit where the network never responds in time.
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
];

// App-shell files that change frequently during development.
// These use network-first so updates show up immediately on next load,
// instead of waiting for a manual cache-version bump.
const NETWORK_FIRST_FILES = [
  "index.html", "styles.css", "app.js", "manifest.json", "trade-security.js",
  "js/state.js", "js/dom.js", "js/firebase-init.js",
  "js/utils/toast.js", "js/utils/theme.js", "js/utils/date.js",
  "js/utils/image.js", "js/utils/export.js", "js/utils/keyboard.js",
  "js/services/observations.js", "js/services/trades.js",
  "js/services/checklists.js", "js/services/ai.js",
  "js/services/candleChecklist.js",
  "js/services/tvNotifications.js", "js/services/sequenceRules.js",
  "js/ui/common.js", "js/ui/auth.js", "js/ui/settings.js",
  "js/ui/dashboard.js", "js/ui/revision.js", "js/ui/aicoach.js",
  "js/ui/tradelog.js", "js/ui/checklists.js", "js/ui/candleChecklist.js",
  "js/ui/tvNotifications.js", "js/ui/sequenceRules.js",
  "js/utils/error-tracking.js", "css/tv-notifications.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each asset individually and tolerate failures (e.g. a CORS
      // hiccup on a cross-origin script) instead of cache.addAll(), which
      // fails the entire install if even one request fails.
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("SW precache failed for", url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Notification click handler ──────────────────────────────────────────────
// When the user taps a push notification on Android, open or focus the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(self.registration.scope);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Any image or video load from a different origin (Drive file content,
  // Drive thumbnails, TradingView snapshots, etc.) — cache it so it's
  // viewable offline later. Checking request.destination instead of
  // matching specific domains means this works for whatever CDN a given
  // link happens to resolve to, without needing to keep a domain list
  // in sync as new link types get added.
  const isCrossOriginMedia =
    (event.request.destination === "image" || event.request.destination === "video") &&
    new URL(url, self.location.href).origin !== self.location.origin;

  if (isCrossOriginMedia) {
    event.respondWith(handleImageRequest(event.request));
    return;
  }

  // Never intercept Firebase, Google APIs, Groq, or Instagram — always go to network
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("identitytoolkit") ||
    url.includes("googleapis.com") ||
    url.includes("api.groq.com") ||
    url.includes("fonts.gstatic.com") ||
    url.includes("fonts.googleapis.com") ||
    url.includes("instagram.com") ||
    url.includes("cdninstagram.com")
  ) {
    return;
  }

  const isAppShellFile = NETWORK_FIRST_FILES.some((f) => url.endsWith(f)) || url.endsWith("/");

  if (isAppShellFile) {
    // Network-first: always try to get the freshest code.
    // Falls back to cache only if the network request fails (offline).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (icons etc.) that rarely change
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Stale-while-revalidate for cross-origin images/videos: serve the cached
// copy instantly if we have one (so it works offline and loads fast even
// online), while a background fetch quietly refreshes the cache for next
// time. If there's no cached copy yet, wait for the network — that's the
// normal "first time viewing this image" case.
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      // Cross-origin no-cors requests come back "opaque" (status 0, body
      // unreadable) — that's expected and still perfectly cacheable/
      // servable for an <img>/<video> tag, just not inspectable by us.
      if (response && (response.status === 200 || response.type === "opaque")) {
        cache.put(request, response.clone());
        trimImageCache(cache);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Don't await it — let it refresh in the background.
    event_safeIgnore(networkFetch);
    return cached;
  }

  const fresh = await networkFetch;
  return fresh || new Response("", { status: 504, statusText: "Offline and not yet cached" });
}

// Prevents an unhandled-rejection warning for the fire-and-forget background
// refresh above without changing its behavior.
function event_safeIgnore(promise) {
  if (promise && typeof promise.catch === "function") promise.catch(() => {});
}

// Keep the image cache from growing forever over months of use. The Cache
// API preserves insertion order in practice, so deleting from the front
// approximates least-recently-added eviction — good enough for a personal
// app's storage housekeeping.
async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_IMAGE_CACHE_ENTRIES) return;
  const excess = keys.length - MAX_IMAGE_CACHE_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}