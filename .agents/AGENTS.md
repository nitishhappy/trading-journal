# Workspace Agent Rules — trading-journal

## After Every Feature/Fix Session

1. **Always update README.md** — Add a new versioned changelog entry (`### vX.Y — Feature name`) documenting:
   - What was added or changed, in plain language
   - Any new Firestore data model fields or collections
   - Any new files added and their purpose
   - Any files modified and what changed
   - Deploy steps if they differ from standard

2. **Always commit and push to git** — After completing a session's changes, run these two commands in sequence:
   ```powershell
   git add -A
   git commit -m "feat/fix: short description"
   git push
   ```
   Use a descriptive one-line commit message. Never leave uncommitted work at the end of a session.
