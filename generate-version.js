#!/usr/bin/env node
// ===================== generate-version.js =====================
// Run this before every `firebase deploy --only hosting`.
//
// It hashes the content of every file the service worker caches, and
// writes that hash into sw.js as the cache name. This makes it
// impossible to forget to bump the cache version: if any cached file's
// content changed at all, the hash changes automatically, the service
// worker sees a new CACHE_NAME on activate, and clients get the fresh
// files instead of silently serving stale ones from the old cache.
//
// Usage:
//   node generate-version.js
//
// No dependencies beyond Node's built-ins — this project has no frontend
// build step, so this stays a plain script rather than pulling in a
// bundler just for this one job.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const SW_PATH = path.join(ROOT, "sw.js");
const VERSION_FILE_PATH = path.join(ROOT, "version");

// Same local files sw.js precaches. Keep this list in sync with the
// ASSETS array in sw.js — if you add a new cached file there, add it
// here too so it's included in the hash.
const FILES_TO_HASH = [
  "index.html",
  "styles.css",
  "app.js",
  "trade-security.js",
  "manifest.json",
  "js/state.js",
  "js/dom.js",
  "js/firebase-init.js",
  "js/utils/toast.js",
  "js/utils/theme.js",
  "js/utils/date.js",
  "js/utils/image.js",
  "js/utils/export.js",
  "js/utils/error-tracking.js",
  "js/services/observations.js",
  "js/services/trades.js",
  "js/services/checklists.js",
  "js/services/ai.js",
  "js/services/candleChecklist.js",
  "js/services/tvNotifications.js",
  "js/services/sequenceRules.js",
  "js/ui/common.js",
  "js/ui/auth.js",
  "js/ui/settings.js",
  "js/ui/dashboard.js",
  "js/ui/revision.js",
  "js/ui/aicoach.js",
  "js/ui/tradelog.js",
  "js/ui/checklists.js",
  "js/ui/candleChecklist.js",
  "js/ui/tvNotifications.js",
  "js/ui/sequenceRules.js",
];

function computeHash() {
  const hash = crypto.createHash("sha1");
  let missing = [];

  for (const relPath of FILES_TO_HASH) {
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      missing.push(relPath);
      continue;
    }
    hash.update(relPath); // include the filename so renames also change the hash
    hash.update(fs.readFileSync(fullPath));
  }

  if (missing.length > 0) {
    console.warn(
      "⚠️  generate-version.js: these files are listed but don't exist on disk (skipped):\n  " +
        missing.join("\n  ")
    );
  }

  // Short hash is plenty here — this only needs to change when content
  // changes, not to be cryptographically unguessable.
  return hash.digest("hex").slice(0, 10);
}

function updateServiceWorker(versionHash) {
  if (!fs.existsSync(SW_PATH)) {
    console.error("❌ sw.js not found at " + SW_PATH);
    process.exit(1);
  }

  let swContent = fs.readFileSync(SW_PATH, "utf8");
  const cacheNameRegex = /const CACHE_NAME = "trade-journal-[^"]*";/;

  if (!cacheNameRegex.test(swContent)) {
    console.error(
      '❌ Could not find a line matching: const CACHE_NAME = "trade-journal-...";\n' +
        "   sw.js may have been restructured — update the regex in generate-version.js to match."
    );
    process.exit(1);
  }

  const newLine = `const CACHE_NAME = "trade-journal-${versionHash}";`;
  const oldLine = swContent.match(cacheNameRegex)[0];

  if (oldLine === newLine) {
    console.log(`✓ No changes detected — cache version stays ${versionHash}`);
    return false;
  }

  swContent = swContent.replace(cacheNameRegex, newLine);
  fs.writeFileSync(SW_PATH, swContent);
  console.log(`✓ Updated sw.js cache version:\n  ${oldLine}\n  → ${newLine}`);
  return true;
}

function main() {
  const versionHash = computeHash();
  const changed = updateServiceWorker(versionHash);

  // Also write a plain-text version file, matching the "version" file
  // already present in your project — handy for confirming in prod
  // (e.g. fetch('/version')) exactly which build is actually live.
  fs.writeFileSync(VERSION_FILE_PATH, versionHash + "\n");

  if (changed) {
    console.log("\nNow run: firebase deploy --only hosting");
  }
}

main();
