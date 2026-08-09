# Agent Workflow Requirements

## Pre-Push Checklist (MUST FOLLOW)
1. **Update README.md** — Every feature, bug fix, or functional change must be documented in the changelog section
2. **Run version bump** — Execute `node generate-version.js` before every commit
3. **Push to Git** — Commit and push all changes to the repository

## Platform Preferences
- **Development Environment**: Windows Laptop (PowerShell)
- **Testing Device**: Android Phone (PWA standalone mode)

## Architecture Constraints (MUST KNOW)
- **Hosting**: Vercel (NOT Firebase Hosting)
- **Database**: Firebase Firestore ONLY
- **API Layer**: Vercel Serverless Functions (`/api/`)
- **Client Entry**: `app.js` is client-side, NOT a server file
- **No build step** — Static HTML/CSS/JS, no bundler

## Code Review Checklist
Before marking a task complete:
- [ ] README.md updated with relevant changelog entry
- [ ] `node generate-version.js` executed
- [ ] Git commit and push completed
- [ ] Architecture context (Vercel hosting) was respected

