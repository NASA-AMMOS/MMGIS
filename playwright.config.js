import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for MMGIS
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global setup — safety guard against running tests on production DB
  // Skipped for unit-only runs (unit tests don't touch the database)
  globalSetup: process.env.PLAYWRIGHT_TEST_UNIT_ONLY
    ? undefined
    : "./tests/global-setup.js",

  // Test directory
  testDir: "./tests",

  // Test file patterns
  testMatch: "**/*.spec.js",

  // Timeout per test (3 minutes — E2E tests may need extra time on slower machines)
  timeout: 180 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
    ["list"],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.TEST_BASE_URL || "http://localhost:8888",

    // Collect trace on failure
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Server lifecycle is managed by globalSetup (tests/global-setup.js).
  // Playwright runs webServer plugins BEFORE globalSetup, which means the
  // DB wouldn't exist yet when the server tries to connect.  By starting
  // the server inside globalSetup we guarantee: create DB → start server
  // → create Reference Mission → run tests → teardown kills server.
});
