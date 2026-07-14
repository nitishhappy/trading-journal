# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> app loads, logs in, every tab opens, and adding an observation works
- Location: tests\smoke.spec.js:19:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.main-tab[data-view="tradelog"]')
    - locator resolved to <button class="main-tab" data-view="tradelog">Trade Log</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    42 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - img "Patient Wolf Trader" [ref=e6]
      - generic [ref=e7]: AI Coach
    - button "Toggle theme" [ref=e8] [cursor=pointer]: ☀️
    - button "Settings" [ref=e9] [cursor=pointer]: ⚙
    - button "Toggle fullscreen" [ref=e10] [cursor=pointer]: ⛶
  - navigation [ref=e11]:
    - button "Dashboard" [ref=e12] [cursor=pointer]
    - button "Revision" [ref=e13] [cursor=pointer]
    - button "AI Coach" [active] [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - generic [ref=e16]: "💾 Don't forget to back up your data today — last backup: never"
    - generic [ref=e17]:
      - button "Export now" [ref=e18] [cursor=pointer]
      - button "Dismiss" [ref=e19] [cursor=pointer]: ✕
  - generic [ref=e20]:
    - generic [ref=e21]:
      - generic [ref=e22]:
        - button "Weekly" [ref=e23] [cursor=pointer]
        - button "Monthly" [ref=e24] [cursor=pointer]
      - button "✦ Generate now" [ref=e25] [cursor=pointer]
    - generic [ref=e26]:
      - paragraph [ref=e27]: ◇
      - paragraph [ref=e28]: No AI Coach summaries yet.
      - paragraph [ref=e29]: Tap "Generate now" to get your first psychology review.
  - generic [ref=e31]:
    - generic [ref=e32]:
      - button "Close settings" [ref=e33] [cursor=pointer]: ←
      - generic [ref=e34]: Settings
    - generic [ref=e35]:
      - heading "🎨 Appearance" [level=3] [ref=e36]
      - generic [ref=e37]:
        - generic [ref=e38]: 🌙 Dark
        - button "Toggle theme" [ref=e39] [cursor=pointer]
        - generic [ref=e41]: ☀️ Light
    - generic [ref=e42]:
      - heading "💾 Export Data" [level=3] [ref=e43]
      - paragraph [ref=e44]: Export your observations and trade log to a file you can keep, share, or open in Excel.
      - button "Export…" [ref=e45] [cursor=pointer]
    - generic [ref=e46]:
      - heading "🧹 Tag Cleanup" [level=3] [ref=e47]
      - paragraph [ref=e48]: New tags are always saved lowercase. If you have older entries with mixed-case tags (e.g. "FOMO" and "fomo" as separate tags), run this once to merge them.
      - button "Normalize tags now" [ref=e49] [cursor=pointer]
      - paragraph
    - generic [ref=e50]:
      - heading "📊 Dashboard" [level=3] [ref=e51]
      - generic [ref=e52]: Default grouping
      - combobox "Default grouping" [ref=e53]:
        - option "Date (newest first, priority within day)" [selected]
        - option "Priority (high first)"
        - option "Tags"
      - paragraph [ref=e54]: Used when the app loads. You can still switch grouping from the Dashboard.
    - generic [ref=e55]:
      - heading "🤖 Categorization" [level=3] [ref=e56]
      - paragraph [ref=e57]: New observations are scanned for keywords and suggested a category/folder. You can accept or dismiss each suggestion from the Dashboard.
    - generic [ref=e58]:
      - heading "📋 Pre-Trade Checklists" [level=3] [ref=e59]
      - paragraph [ref=e60]: Create checklists to run before executing any trade. A "Default" checklist is always available.
      - generic [ref=e61]:
        - combobox [ref=e62]:
          - option "Default" [selected]
        - button "+ New" [ref=e63] [cursor=pointer]
        - button "Delete" [ref=e64] [cursor=pointer]
      - generic [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]: ⠿
          - generic [ref=e68]: Market trend confirmed (H1/H4)
          - button "✕" [ref=e69] [cursor=pointer]
        - generic [ref=e70]:
          - generic [ref=e71]: ⠿
          - generic [ref=e72]: Setup aligns with my strategy
          - button "✕" [ref=e73] [cursor=pointer]
        - generic [ref=e74]:
          - generic [ref=e75]: ⠿
          - generic [ref=e76]: Risk/Reward at least 1:2
          - button "✕" [ref=e77] [cursor=pointer]
        - generic [ref=e78]:
          - generic [ref=e79]: ⠿
          - generic [ref=e80]: Stop loss placed at key level
          - button "✕" [ref=e81] [cursor=pointer]
        - generic [ref=e82]:
          - generic [ref=e83]: ⠿
          - generic [ref=e84]: Position size calculated
          - button "✕" [ref=e85] [cursor=pointer]
        - generic [ref=e86]:
          - generic [ref=e87]: ⠿
          - generic [ref=e88]: No news event in next 30 min
          - button "✕" [ref=e89] [cursor=pointer]
        - generic [ref=e90]:
          - generic [ref=e91]: ⠿
          - generic [ref=e92]: Entry price matches plan
          - button "✕" [ref=e93] [cursor=pointer]
        - generic [ref=e94]:
          - generic [ref=e95]: ⠿
          - generic [ref=e96]: I am in the right mental state
          - button "✕" [ref=e97] [cursor=pointer]
      - generic [ref=e98]:
        - textbox "Add a checklist item…" [ref=e99]
        - button "Add" [ref=e100] [cursor=pointer]
    - generic [ref=e101]:
      - heading "🧠 AI Coach — Groq API Key" [level=3] [ref=e102]
      - paragraph [ref=e103]:
        - text: Free forever, no credit card. Get your key at
        - link "console.groq.com/keys" [ref=e104] [cursor=pointer]:
          - /url: https://console.groq.com/keys
        - text: (sign up with Google, takes 1 minute).
      - generic [ref=e105]: Groq API Key
      - generic [ref=e106]:
        - textbox "Groq API Key" [ref=e107]:
          - /placeholder: gsk_...
        - button "👁" [ref=e108] [cursor=pointer]
      - button "Save key" [ref=e109] [cursor=pointer]
    - generic [ref=e110]:
      - heading "📁 Google Drive Folder" [level=3] [ref=e111]
      - paragraph [ref=e112]: 100% free, no credit card required. Used to list images inside shared Google Drive folders.
      - generic [ref=e113]: Google API Key
      - generic [ref=e114]:
        - textbox "Google API Key" [ref=e115]:
          - /placeholder: AIzaSy...
        - button "👁" [ref=e116] [cursor=pointer]
      - button "Save key" [ref=e117] [cursor=pointer]
    - generic [ref=e118]:
      - heading "🔒 Trade Log Passcode" [level=3] [ref=e119]
      - paragraph [ref=e120]: Set a 4-digit passcode to lock the Trade Log tab. The lock resets each time you navigate away from the tab — re-enter the passcode to view it again.
      - generic [ref=e121]: Passcode
      - generic [ref=e122]:
        - textbox "Passcode" [ref=e123]:
          - /placeholder: 4 digits (e.g. 1234)
        - button "👁" [ref=e124] [cursor=pointer]
      - generic [ref=e125]: No passcode set.
      - paragraph [ref=e126]:
        - text: "Firebase Console only: Change passcode at"
        - code [ref=e127]: Firestore > users > settings > tradePasscode
      - button "Save passcode" [ref=e128] [cursor=pointer]
      - button "Remove passcode" [ref=e129] [cursor=pointer]
    - button "Sign out" [ref=e131] [cursor=pointer]
```

# Test source

```ts
  1  | // @ts-check
  2  | const { test, expect } = require("@playwright/test");
  3  | 
  4  | // Set these before running:
  5  | //   TEST_EMAIL=you@example.com TEST_PASSWORD=yourpassword npx playwright test
  6  | // Use a dedicated test account, not your real journal — this test creates
  7  | // and leaves behind one real observation each run ("Smoke test <timestamp>").
  8  | const EMAIL = process.env.TEST_EMAIL;
  9  | const PASSWORD = process.env.TEST_PASSWORD;
  10 | 
  11 | test.beforeEach(() => {
  12 |   if (!EMAIL || !PASSWORD) {
  13 |     throw new Error(
  14 |       "Set TEST_EMAIL and TEST_PASSWORD env vars before running (use a dedicated test account)."
  15 |     );
  16 |   }
  17 | });
  18 | 
  19 | test("app loads, logs in, every tab opens, and adding an observation works", async ({ page }) => {
  20 |   const consoleErrors = [];
  21 |   page.on("console", (msg) => {
  22 |     if (msg.type() === "error") consoleErrors.push(msg.text());
  23 |   });
  24 |   page.on("pageerror", (err) => {
  25 |     consoleErrors.push(err.message);
  26 |   });
  27 | 
  28 |   // ---- Login ----
  29 |   await page.goto("/");
  30 |   await page.fill("#email", EMAIL);
  31 |   await page.fill("#password", PASSWORD);
  32 |   await page.click("#login-btn");
  33 | 
  34 |   // App screen should become visible (auth-screen is swapped for app-screen).
  35 |   await expect(page.locator("#app-screen")).toBeVisible({ timeout: 15_000 });
  36 |   await expect(page.locator("#auth-screen")).toBeHidden();
  37 | 
  38 |   // ---- Every main tab should open without throwing ----
  39 |   const tabs = ["dashboard", "revision", "aicoach", "tradelog"];
  40 |   for (const tab of tabs) {
> 41 |     await page.click(`.main-tab[data-view="${tab}"]`);
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  42 |     await expect(page.locator(`.main-tab[data-view="${tab}"]`)).toHaveClass(/active/);
  43 |     // Give any async render (Firestore listener, etc.) a moment to settle
  44 |     // and throw before we move to the next tab.
  45 |     await page.waitForTimeout(500);
  46 |   }
  47 | 
  48 |   // Back to dashboard for the add-observation check
  49 |   await page.click('.main-tab[data-view="dashboard"]');
  50 | 
  51 |   // ---- Add an observation end-to-end ----
  52 |   // This is the exact flow that broke silently after the template-based
  53 |   // modal refactor (openCreateModal referencing IDs that no longer existed)
  54 |   // — a real click-through catches that class of bug before you do.
  55 |   await page.click("#fab-add");
  56 |   await expect(page.locator("#obs-modal")).toBeVisible();
  57 | 
  58 |   const stamp = new Date().toISOString();
  59 |   await page.fill(".obs-entry .obs-text", `Smoke test ${stamp}`);
  60 |   await page.click("#obs-save-btn");
  61 | 
  62 |   await expect(page.locator("#obs-modal")).toBeHidden({ timeout: 10_000 });
  63 | 
  64 |   // ---- The actual point of this test ----
  65 |   // Fail loudly if anything logged a console error at any point above,
  66 |   // instead of only checking that elements were technically visible.
  67 |   expect(consoleErrors, `Console errors during smoke test:\n${consoleErrors.join("\n")}`).toEqual(
  68 |     []
  69 |   );
  70 | });
  71 | 
```