// @ts-check
const { test, expect } = require("@playwright/test");

// Set these before running:
//   TEST_EMAIL=you@example.com TEST_PASSWORD=yourpassword npx playwright test
// Use a dedicated test account, not your real journal — this test creates
// and leaves behind one real observation each run ("Smoke test <timestamp>").
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

test.beforeEach(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Set TEST_EMAIL and TEST_PASSWORD env vars before running (use a dedicated test account)."
    );
  }
});

test("app loads, logs in, every tab opens, and adding an observation works", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  // ---- Login ----
  await page.goto("/");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("#login-btn");

  // App screen should become visible (auth-screen is swapped for app-screen).
  await expect(page.locator("#app-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#auth-screen")).toBeHidden();

  // ---- Every visible main tab should open without throwing ----
  // Some tabs (e.g. Trade Log) can be intentionally hidden/passcode-locked
  // — that's a deliberate app feature, not a bug, so skip whichever tabs
  // aren't currently visible rather than failing on them.
  const tabs = ["dashboard", "revision", "aicoach", "tradelog"];
  for (const tab of tabs) {
    const tabButton = page.locator(`.main-tab[data-view="${tab}"]`);
    const isVisible = await tabButton.isVisible().catch(() => false);
    if (!isVisible) {
      console.log(`Skipping "${tab}" tab — not visible (hidden/locked).`);
      continue;
    }
    await tabButton.click();
    await expect(tabButton).toHaveClass(/active/);
    // Give any async render (Firestore listener, etc.) a moment to settle
    // and throw before we move to the next tab.
    await page.waitForTimeout(500);
  }

  // Back to dashboard for the add-observation check
  await page.click('.main-tab[data-view="dashboard"]');

  // ---- Add an observation end-to-end ----
  // This is the exact flow that broke silently after the template-based
  // modal refactor (openCreateModal referencing IDs that no longer existed)
  // — a real click-through catches that class of bug before you do.
  await page.click("#fab-add");
  await expect(page.locator("#obs-modal")).toBeVisible();

  const stamp = new Date().toISOString();
  await page.fill(".obs-entry .obs-text", `Smoke test ${stamp}`);
  await page.click("#obs-save-btn");

  await expect(page.locator("#obs-modal")).toBeHidden({ timeout: 10_000 });

  // ---- The actual point of this test ----
  // Fail loudly if anything logged a console error at any point above,
  // instead of only checking that elements were technically visible.
  expect(consoleErrors, `Console errors during smoke test:\n${consoleErrors.join("\n")}`).toEqual(
    []
  );
});