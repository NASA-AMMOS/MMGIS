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

  // Test directory — root so we can scan both tests/ and plugins/**/tests/
  testDir: ".",

  // Test file patterns — scan both centralized tests and co-located plugin tests
  testMatch: [
    "tests/**/*.spec.js",
    "plugins/**/tests/*.spec.js",
  ],

  // `plugin-cli/scaffolds/**` are templates, not tests: they are the specs a
  // plugin is *created with*, full of `__name__` placeholders and paths that
  // only resolve once copied into a plugin directory.
  testIgnore: ["**/plugin-cli/scaffolds/**"],

  // Timeout per test (3 minutes — E2E tests may need extra time on slower machines)
  timeout: 180 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local default: cap at 4 workers. Playwright's default of `undefined`
  // resolves to ~half the CPU cores, which on higher-core machines
  // (e.g. 16 cores → 8 workers) tends to overload the dev server and
  // actually slows the suite down. CI still runs serially (1 worker).
  workers: process.env.CI ? 1 : 4,

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
    baseURL: process.env.TEST_BASE_URL || "http://localhost:18888",

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
      testMatch: /cross-browser/,
    },
  ],

  // Server lifecycle is managed by globalSetup (tests/global-setup.js).
  // Playwright runs webServer plugins BEFORE globalSetup, which means the
  // DB wouldn't exist yet when the server tries to connect.  By starting
  // the server inside globalSetup we guarantee: create DB → start server
  // → create Reference Mission → run tests → teardown kills server.
});
