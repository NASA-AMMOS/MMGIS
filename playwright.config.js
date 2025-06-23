/**
 * Playwright Configuration for MMGIS BDD Testing
 * 
 * This configuration integrates Playwright with Jest and jest-cucumber
 * for end-to-end testing of MMGIS functionality.
 */

module.exports = {
  // Test directory and patterns
  testDir: './src/features',
  testMatch: '**/*.playwright.js',
  
  // Global setup for infrastructure
  globalSetup: './src/test-infrastructure/playwright-setup.js',
  globalTeardown: './src/test-infrastructure/playwright-teardown.js',
  
  // Test configuration
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  // Retry on CI
  retries: process.env.CI ? 2 : 0,
  
  // Run tests in parallel
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }],
    ['list']
  ],
  
  // Global test settings
  use: {
    // Base URL for MMGIS
    baseURL: process.env.MMGIS_URL || 'http://localhost:8888',
    
    // Browser configuration
    headless: process.env.CI ? true : false,
    viewport: { width: 1280, height: 720 },
    
    // Screenshots and videos
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Tracing for debugging
    trace: 'retain-on-failure',
    
    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: true,
    
    // Action timeout
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 15000
  },
  
  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { 
        ...require('@playwright/test').devices['Desktop Chrome'],
        channel: 'chrome'
      }
    },
    
    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...require('@playwright/test').devices['Desktop Firefox'] }
    // },
    
    // {
    //   name: 'webkit',
    //   use: { ...require('@playwright/test').devices['Desktop Safari'] }
    // }
  ],
  
  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run start:prod',
    port: 8888,
    timeout: 60000,
    reuseExistingServer: !process.env.CI
  }
};