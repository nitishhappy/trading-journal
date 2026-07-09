const CACHE_NAME = "trade-journal-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./trade-security.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Firebase SDK scripts — precached so the app can boot fully offline
  // even on a visit where the network never responds in time.
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
];

// App-shell files that change frequently during development.
// These use network-first so updates show up immediately on next load,
// instead of waiting for a manual cache-version bump.
const NETWORK_FIRST_FILES = ["index.html", "styles.css", "app.js", "manifest.json", "trade-security.js"];

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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

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
