# Agent Workflow Requirements

## Global Behavioural Rules (Always Active)

### Discussion & Clarification First Rule (Exploratory Q&A / Conceptual Discussions)
- **Trigger**: Prompt containing **"DDC"** (Discuss, Discuss, Confirm), exploratory questions ("why did X happen?", "how is Y calculated?"), or conceptual feature discussions.
- **MANDATORY**: Whenever triggered or when "DDC" is present in a user prompt, **DO NOT make code modifications or edit repository files immediately**.
- You MUST:
  1. Provide a detailed, clear conceptual analysis or explanation in chat.
  2. Discuss potential architectural options or criteria with the user.
  3. Obtain explicit user confirmation/approval BEFORE making any source code, script, or configuration edits.

### Assumption Transparency Rule (Building / Creating / Planning)
- **MANDATORY**: Whenever building anything (new setup, feature, script, service, tool, workflow, or architecture) OR whenever any assumption is made (hardcoded values, estimated prices, approximated parameters, placeholder data, default configurations, etc.), **explicitly include a clearly visible `> ⚠️ ASSUMPTIONS` block at the very start of the chat response** before proceeding with analysis or code.
- Examples: hardcoded option premiums, assumed deltas, estimated charges, placeholder API responses, default session hours, synthetic data, etc.

### Root Cause & Fix Transparency Rule (Fixing / Debugging / Troubleshooting)
- **MANDATORY**: Whenever fixing an issue, debugging an error, patching a bug, or resolving a failure/crash, **explicitly include a clearly visible `> 🛠️ ROOT CAUSE & FIX` block at the very start of the chat response**.
- Must clearly outline:
  - **Category**: Classify the issue type (e.g. `Technical`, `Business Logic`, `Configuration / Environment`, `API / Data Feed`, `Integration / UI`).
  - **Root Cause**: What specifically failed, crashed, or behaved unexpectedly and why.
  - **Fix**: What exact code, script, or configuration changes were made to resolve the root cause.

### Constraint & Skipping Transparency Rule
- **MANDATORY**: Whenever you are unable to complete a specified part of a task due to technical constraints, missing data, timeouts, or tool failures, **DO NOT silently skip it**.
- You must explicitly call out what is being skipped and why, or ask for user intervention, before proceeding with a partial execution.

---

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

## AI Automation Constraints (MUST KNOW)
- **NIFTY FIRST RUN (9:10 AM)**: The automation script must request the full suite of sections from the LLM (Global Market Sentiment, Overnight Moves, News, Analysis, GOLD, SMC, Tactical Trading Plan).
- **NIFTY REST RUN (Ad-Hoc / Watchdog / Tactical)**: The automation script must conditionally truncate the LLM prompt to ONLY request:
  - Section 4: NIFTY Analysis & Key Levels
  - Section 6: SMC / Price Action Perspective (NIFTY)
  - Section 7: Tactical Trading Plan & Action Triggers
