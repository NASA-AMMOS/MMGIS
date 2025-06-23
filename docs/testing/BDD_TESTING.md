# MMGIS Behavior-Driven Development (BDD) Testing Guide

This guide covers the comprehensive BDD testing framework for MMGIS, which includes both mock-based unit testing and real browser automation.

## Overview

MMGIS uses a dual-layer BDD testing approach:

1. **Jest-cucumber** for fast unit testing with mocked components
2. **Playwright** for end-to-end testing with real browser automation
3. **Automatic infrastructure setup** for databases and services

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers (first time only)
npm run playwright:install
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run only BDD unit tests (jest-cucumber)
npm run test:bdd

# Run only end-to-end tests (Playwright)
npm run test:e2e

# Debug Playwright tests with browser UI
npm run playwright:debug
```

## Test Infrastructure

### Automatic Service Management

The test framework automatically handles infrastructure setup:

- **PostgreSQL Database**: Auto-detected and launched if not available
- **Docker Integration**: Works inside and outside containers
- **Service Dependencies**: TiTiler, STAC, and other services
- **Browser Management**: Chromium installation and lifecycle

### Environment Detection

The framework detects the runtime environment:

```javascript
// Container detection
if (detectContainerEnvironment()) {
  // Use existing services in Docker network
} else {
  // Launch test services locally
}
```

### Database Setup

PostgreSQL is automatically configured:

```javascript
// Creates test database with PostGIS
await checkPostgreSQL();
await launchPostgreSQL(); // If needed
```

## Test Structure

### Feature Files (Gherkin)

Located in `src/features/*.feature`:

```gherkin
Feature: Map Navigation
  
  Background:
    Given MMGIS is configured with a test mission
    And I have authenticated with long-term API token
    And the following mission configuration exists:
      """
      {
        "msv": { "mission": "Navigation_Test" },
        "layers": [...]
      }
      """
  
  Scenario: Loading a mission with default view
    Given MMGIS is configured with a valid mission
    When I load the application
    Then the 2D map should be displayed
```

### Jest-Cucumber Step Definitions

Located in `src/features/*.steps.js`:

```javascript
import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('./src/features/MapNavigation.feature');

defineFeature(feature, test => {
  test('Loading a mission with default view', ({ given, when, then }) => {
    given('MMGIS is configured with a valid mission', () => {
      // Mock-based testing
      expect(mockConfig).toBeDefined();
    });
  });
});
```

### Playwright Step Definitions

Located in `src/features/*.playwright.js`:

```javascript
import { defineFeature, loadFeature } from 'jest-cucumber';
import { chromium } from 'playwright';

const feature = loadFeature('./src/features/MapNavigation.feature');

defineFeature(feature, test => {
  test('Loading a mission with default view', ({ given, when, then }) => {
    given('MMGIS is configured with a valid mission', async () => {
      // Real browser automation
      await page.goto(baseUrl);
      await helpers.waitForMapReady();
    });
  });
});
```

## Configuration-Driven Testing

### Mission Setup

Each test creates isolated missions:

```javascript
// Authenticate with configure interface
await helpers.authenticateWithConfigure(baseUrl);

// Create test mission
await helpers.createMission('Test_Mission', configData);

// Navigate to mission
await helpers.navigateToMMGIS(baseUrl, 'Test_Mission');
```

### Open Source Data

Tests use publicly accessible datasets:

```javascript
const openSourceDatasets = {
  elevation: {
    srtm: 'https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif'
  },
  imagery: {
    openstreetmap: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  }
};
```

## Available Test Helpers

### MMGISPlaywrightHelpers

```javascript
const helpers = new MMGISPlaywrightHelpers(page);

// Navigation
await helpers.navigateToMMGIS(baseUrl, missionName);
await helpers.waitForMapReady();

// Map Interaction
await helpers.panMap(100, 50);
await helpers.zoomMap('in');
const mapState = await helpers.getMapState();

// Layer Management
await helpers.toggleLayer('Elevation');
await helpers.waitForLayerLoad('Elevation');

// Tools
await helpers.openTool('Info');
await helpers.queryAtCoordinates(100, 200);

// View Switching
await helpers.switchView('3D');

// Authentication
await helpers.authenticateWithConfigure(baseUrl);
await helpers.createMission('Test', configData);
```

### Infrastructure Setup

```javascript
const infraSetup = new TestInfrastructureSetup();

// Setup all services
const services = await infraSetup.setupTestInfrastructure();

// Check service availability
const status = infraSetup.getServiceStatus();

// Cleanup
await infraSetup.cleanup();
```

## Environment Variables

Configure testing behavior:

```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mmgis_test
DB_USER=postgres
DB_PASS=password

# Service endpoints
TITILER_ENDPOINT=http://localhost:8081
STAC_ENDPOINT=http://localhost:8082
MMGIS_URL=http://localhost:8888

# Debug options
DEBUG=1                    # Enable debug logging
CI=true                   # CI mode (headless)
```

## Test Development Guide

### Adding New Tests

1. **Create Feature File**: `src/features/NewFeature.feature`
2. **Add Jest Steps**: `src/features/NewFeature.steps.js`
3. **Add Playwright Steps**: `src/features/NewFeature.playwright.js`

### Testing Patterns

#### Mock Testing (Jest-cucumber)
```javascript
test('Feature behavior', ({ given, when, then }) => {
  given('precondition', () => {
    mockAPI.setup();
  });
  
  when('action', () => {
    const result = performAction();
    expect(result).toBeDefined();
  });
});
```

#### Browser Testing (Playwright)
```javascript
test('Feature behavior', ({ given, when, then }) => {
  given('precondition', async () => {
    await helpers.navigateToMMGIS(baseUrl);
  });
  
  when('action', async () => {
    await page.click('.action-button');
    await page.waitForTimeout(1000);
  });
});
```

### Best Practices

1. **Use Background sections** for consistent setup
2. **Reference open source data** for reproducibility
3. **Test both happy path and error cases**
4. **Use helpers for common interactions**
5. **Include debug screenshots** for failing tests
6. **Clean up test data** after each test

## Troubleshooting

### Common Issues

**PostgreSQL connection failed**
```bash
# Check if PostgreSQL is running
npm run test:infrastructure

# Manual database setup
docker run -d --name mmgis-test-postgres \
  -e POSTGRES_DB=mmgis_test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgis/postgis:16-3.4
```

**Playwright timeout**
```bash
# Increase timeout for slow environments
DEBUG=1 npm run playwright:debug
```

**Browser not found**
```bash
# Reinstall browsers
npm run playwright:install
```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=1 npm run test:e2e
```

This provides:
- Browser console output
- Network request logs
- Test step timing
- Screenshot capture

## Continuous Integration

### GitHub Actions Example

```yaml
- name: Run BDD Tests
  run: |
    npm run test:bdd
    
- name: Setup Playwright
  run: npm run playwright:install

- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
```

### Docker Testing

```dockerfile
# Test container
FROM node:20
RUN npx playwright install --with-deps chromium
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "run", "test:all"]
```

This comprehensive BDD testing framework ensures MMGIS functionality is thoroughly tested at both the unit and integration levels, with automatic infrastructure management for reliable, reproducible testing.