// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    // Override with: BASE_URL=https://trade-journal-4271e.web.app npx playwright test
    baseURL: process.env.BASE_URL || "http://127.0.0.1:8080",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
