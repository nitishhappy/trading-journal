# Architecture Context

## Hosting Platform
- **Vercel** is the hosting platform (NOT Firebase Hosting)
- Static files (HTML, CSS, JS, images) are served by Vercel

## Firebase Usage
- **Firebase Firestore** is ONLY used as a database
- **Firebase Admin SDK** is used in Vercel serverless functions (`/api/`) to write to Firestore
- **Firebase Auth** may be used for user authentication

## Application Structure
- `index.html` + `app.js` = Client-side PWA (ES module)
- `/api/` folder = Vercel serverless functions (Node.js, CommonJS)
- Client communicate with Firestore via Firebase JS SDK (browser)
- API routes communicate with Firestore via Firebase Admin SDK (server)

## Key Files
- `vercel.json` — Vercel configuration (rewrites, routing)
- `api/tvWebhook.js` — Vercel serverless function for TradingView webhook
- `api/firebase-admin.js` — Firebase Admin SDK initialization
- `app.js` — Client app entry point (NOT a server file)

## How to Recognize Vercel vs Firebase Hosting
| File/Concept | Vercel | Firebase Hosting |
|--------------|--------|------------------|
| Config file | `vercel.json` | `firebase.json` |
| Static serving | Vercel CDN | Firebase CDN |
| Serverless | `/api/` folders | Cloud Functions |
| Database | Any (Firestore here) | Any (Firestore here) |

---

# Agent Workflow Requirements (ALWAYS FOLLOW)

## Pre-Push Checklist (MUST DO)
1. ✅ **Update README.md** — Every feature/fix must be documented in changelog
2. ✅ **Run version bump** — `node generate-version.js` before every commit
3. ✅ **Push to Git** — Commit AND push after every meaningful change

## Architecture Constraints (CHECK FIRST)
- **Vercel** is the hosting platform
- **Firebase = Firestore only** (no Firebase Hosting)
- `/api/` = Vercel serverless functions
- `app.js` = client entry point (not server)
- No build step — static HTML/CSS/JS

## Code Review Checklist (MUST VERIFY)
- [ ] README.md updated with changelog entry
- [ ] `node generate-version.js` executed
- [ ] Git commit and push completed
- [ ] Architecture context was respected (Vercel, not Firebase Hosting)
