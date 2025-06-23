# MMGIS Testing Guide

This guide provides comprehensive documentation for testing MMGIS, including unit tests, integration tests, and behavior-driven development (BDD) tests.

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Infrastructure](#test-infrastructure)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Overview

MMGIS uses a multi-layered testing approach to ensure code quality and functionality:

1. **Unit Tests** - Fast, isolated tests for individual components
2. **Integration Tests** - Tests for component interactions
3. **BDD Tests** - Behavior-driven tests using Gherkin syntax
4. **E2E Tests** - End-to-end browser automation tests

## Testing Philosophy

Our testing approach follows these principles:

- **Test behaviors, not implementation** - Focus on what the code does, not how
- **Configuration-driven** - Tests should be reproducible with defined configurations
- **Real-world scenarios** - Use actual data sources and realistic workflows
- **Automated infrastructure** - Tests should set up their own prerequisites
- **Clear documentation** - Tests serve as living documentation

## Test Types

### Unit Tests (Jest)

Traditional JavaScript unit tests for individual functions and components.

```javascript
describe('Coordinate conversion', () => {
  it('should convert lat/lon to Web Mercator', () => {
    const result = convertCoordinates([0, 0], 'EPSG:4326', 'EPSG:3857');
    expect(result).toEqual([0, 0]);
  });
});
```

### BDD Unit Tests (Jest-Cucumber)

Behavior-driven tests with mocked dependencies for fast execution.

```gherkin
Feature: Map Navigation
  Scenario: Zooming the map
    Given the map is at zoom level 10
    When I zoom in
    Then the zoom level should be 11
```

### E2E Tests (Playwright)

Real browser automation tests that interact with the full application.

```javascript
test('User can draw a polygon', async ({ page }) => {
  await page.goto('http://localhost:8888');
  await page.click('[data-tool="draw"]');
  // ... perform drawing actions
});
```

## Getting Started

### Prerequisites

1. **Node.js** (v20.11.1+)
2. **PostgreSQL** (v16+ with PostGIS)
3. **Docker** (optional, for containerized testing)

### Installation

```bash
# Install all dependencies
npm install

# Install Playwright browsers (first time only)
npm run playwright:install

# Verify infrastructure setup
npm run test:infrastructure
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm run test:all

# Run unit tests only
npm test

# Run BDD tests only
npm run test:bdd

# Run E2E tests only
npm run test:e2e

# Run specific test file
npm test -- MapNavigation.steps

# Debug mode with browser UI
npm run playwright:debug

# Run tests in watch mode
npm test -- --watch
```

### Test Execution Modes

#### Fast Mode (Mocked)
Best for development and CI pipelines:
```bash
npm run test:bdd
```

#### Full Mode (Real Browser)
Best for release validation:
```bash
npm run test:e2e
```

#### Debug Mode
For troubleshooting failures:
```bash
DEBUG=1 npm run test:e2e
```

## Writing Tests

### BDD Test Structure

1. **Feature File** (`src/features/MyFeature.feature`)
```gherkin
Feature: Layer Management
  As a mission operator
  I want to manage map layers
  So that I can visualize different data types

  Background:
    Given MMGIS is configured with a test mission
    And I have authenticated with long-term API token
    
  Scenario: Toggle layer visibility
    Given the map has multiple layers
    When I toggle the "Elevation" layer
    Then the layer should be hidden
```

2. **Step Definitions** (`src/features/MyFeature.steps.js`)
```javascript
import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('./src/features/MyFeature.feature');

defineFeature(feature, test => {
  test('Toggle layer visibility', ({ given, when, then }) => {
    let layers;
    
    given('the map has multiple layers', () => {
      layers = mockMapInstance.getLayers();
      expect(layers.length).toBeGreaterThan(1);
    });
    
    when(/I toggle the "(.*)" layer/, (layerName) => {
      const layer = layers.find(l => l.name === layerName);
      layer.setVisible(!layer.getVisible());
    });
    
    then('the layer should be hidden', () => {
      const elevationLayer = layers.find(l => l.name === 'Elevation');
      expect(elevationLayer.getVisible()).toBe(false);
    });
  });
});
```

3. **Playwright Implementation** (`src/features/MyFeature.playwright.js`)
```javascript
import { chromium } from 'playwright';
import { MMGISPlaywrightHelpers } from '../test-infrastructure/playwright-helpers';

// ... test setup ...

test('Toggle layer visibility', ({ given, when, then }) => {
  given('the map has multiple layers', async () => {
    await helpers.navigateToMMGIS(baseUrl, 'Test_Mission');
    await helpers.waitForMapReady();
  });
  
  when(/I toggle the "(.*)" layer/, async (layerName) => {
    await helpers.toggleLayer(layerName);
  });
  
  then('the layer should be hidden', async () => {
    const layerVisible = await page.evaluate((name) => {
      // Check layer visibility in the DOM
      const layer = document.querySelector(`[data-layer="${name}"]`);
      return layer && !layer.classList.contains('hidden');
    }, 'Elevation');
    
    expect(layerVisible).toBe(false);
  });
});
```

### Test Data Management

#### Using Open Source Datasets
```javascript
const testDatasets = {
  elevation: 'https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif',
  imagery: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  vectors: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
};
```

#### Mission Configuration
```javascript
const testMissionConfig = {
  msv: {
    mission: 'Test_Mission',
    view: ['0', '0', '5']
  },
  layers: [
    {
      name: 'Base Map',
      type: 'tile',
      url: testDatasets.imagery
    },
    {
      name: 'Elevation',
      type: 'data',
      url: testDatasets.elevation,
      demtileurl: true
    }
  ]
};
```

## Test Infrastructure

### Automatic Service Management

The test framework automatically manages required services:

```javascript
// src/test-infrastructure/setup.js
const infraSetup = new TestInfrastructureSetup();
const services = await infraSetup.setupTestInfrastructure();

// Services managed:
// - PostgreSQL with PostGIS
// - TiTiler (if available)
// - STAC (if available)
// - MMGIS server
```

### Database Management

Tests automatically:
- Check for PostgreSQL availability
- Launch Docker container if needed
- Create test database with PostGIS
- Clean up after tests

### Browser Management

Playwright handles:
- Browser installation
- Context isolation between tests
- Screenshot capture on failure
- Video recording (optional)

## Best Practices

### 1. Use Background Sections
Define common setup in Background sections:
```gherkin
Background:
  Given MMGIS is configured with a test mission
  And the following layers are configured:
    | name       | type | url                    |
    | Elevation  | data | /path/to/elevation.tif |
    | Imagery    | tile | /path/to/imagery       |
```

### 2. Keep Tests Independent
Each test should:
- Set up its own data
- Not depend on other tests
- Clean up after itself

### 3. Use Descriptive Names
```gherkin
# Good
Scenario: User can measure distance between two points on Mars

# Bad
Scenario: Test measurement
```

### 4. Test One Thing
Each scenario should test a single behavior:
```gherkin
# Good
Scenario: Opacity slider changes layer transparency

# Bad
Scenario: Layer controls work
```

### 5. Use Data Tables
For multiple similar tests:
```gherkin
Scenario Outline: Different layer types display correctly
  Given a <type> layer is configured
  When I add it to the map
  Then it should display as <display>
  
  Examples:
    | type     | display        |
    | tile     | raster tiles   |
    | vector   | vector shapes  |
    | data     | color gradient |
```

## Troubleshooting

### Common Issues

#### PostgreSQL Connection Failed
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Manually start PostgreSQL
docker run -d --name mmgis-test-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# Verify connection
psql -h localhost -U postgres -d postgres
```

#### Playwright Timeout
```javascript
// Increase timeout in test
test.setTimeout(60000); // 60 seconds

// Or in config
use: {
  navigationTimeout: 30000,
  actionTimeout: 15000
}
```

#### Test Flakiness
```javascript
// Add explicit waits
await page.waitForSelector('.map-loaded');
await page.waitForLoadState('networkidle');

// Use retry logic
await expect(page.locator('.layer')).toBeVisible({ timeout: 10000 });
```

### Debug Techniques

#### Visual Debugging
```bash
# Run with headed browser
HEADED=1 npm run test:e2e

# Step through test
npm run playwright:debug
```

#### Console Logging
```javascript
page.on('console', msg => console.log('Browser:', msg.text()));
page.on('pageerror', error => console.error('Page error:', error));
```

#### Screenshots
```javascript
await page.screenshot({ path: 'debug.png', fullPage: true });
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Install Playwright
      run: npx playwright install --with-deps chromium
      
    - name: Run unit tests
      run: npm test
      
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        CI: true
        
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: |
          test-results/
          playwright-report/
```

### Docker Testing

```dockerfile
FROM node:20

# Install Playwright dependencies
RUN npx playwright install-deps chromium

# Install PostgreSQL client
RUN apt-get update && apt-get install -y postgresql-client

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run tests
CMD ["npm", "run", "test:all"]
```

### Test Reports

Generate and view test reports:

```bash
# Generate HTML report
npm run test:e2e -- --reporter=html

# View report
npx playwright show-report

# Generate JUnit XML for CI
npm run test:e2e -- --reporter=junit
```

## Advanced Topics

### Custom Test Helpers

Create reusable functions:

```javascript
// src/test-utils/custom-helpers.js
export async function createMissionWithLayers(page, missionName, layers) {
  const helpers = new MMGISPlaywrightHelpers(page);
  await helpers.authenticateWithConfigure(baseUrl);
  await helpers.createMission(missionName);
  
  for (const layer of layers) {
    await helpers.addLayer(layer);
  }
  
  return helpers;
}
```

### Performance Testing

```javascript
test('Map loads within acceptable time', async ({ page }) => {
  const startTime = Date.now();
  await page.goto(`${baseUrl}?mission=Test`);
  await page.waitForSelector('.map-loaded');
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(5000); // 5 seconds
  
  // Log performance metrics
  const metrics = await page.evaluate(() => performance.toJSON());
  console.log('Navigation timing:', metrics.timing);
});
```

### Accessibility Testing

```javascript
test('Map controls are keyboard accessible', async ({ page }) => {
  await page.goto(`${baseUrl}?mission=Test`);
  
  // Tab through controls
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement.tagName);
  expect(focusedElement).not.toBe('BODY');
  
  // Check ARIA labels
  const zoomButton = page.locator('.zoom-in');
  await expect(zoomButton).toHaveAttribute('aria-label', 'Zoom in');
});
```

This comprehensive testing guide ensures that MMGIS maintains high quality through thorough automated testing at all levels.