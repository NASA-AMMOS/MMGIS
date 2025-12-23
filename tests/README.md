# MMGIS Testing Documentation

This directory contains the Playwright test suite for MMGIS. The tests use a hybrid approach: unit tests for pure JavaScript functions and E2E tests for browser-based functionality.

## Test Structure

```
tests/
├── unit/                   # Pure JavaScript unit tests (no browser)
│   └── formulae.spec.js    # Tests for Formulae_ utility functions
├── e2e/                    # End-to-end tests (require browser & server)
│   └── smoke.spec.js       # Basic application smoke tests
├── fixtures/               # Test data and samples
│   ├── coordinate-samples.js  # Geographic test data
│   └── geojson-samples.js     # GeoJSON test samples
└── utils/                  # Test utilities and helpers
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only (Fast)
```bash
npm run test:unit
```

### Run E2E Tests Only
```bash
npm run test:e2e
```

### Run Tests in Headed Mode (See Browser)
```bash
npm run test:headed
```

### Debug Tests
```bash
npm run test:debug
```

### Interactive Test UI
```bash
npm run test:ui
```

### View Test Report
```bash
npm run test:report
```

## Test Configuration

Tests are configured in `playwright.config.js` in the project root. Key settings:

- **Base URL:** `http://localhost:8888`
- **Browsers:** Chromium (primary), Firefox and WebKit available
- **Auto-start server:** Yes (for E2E tests)
- **Timeout:** 30 seconds per test
- **Retries:** 2 retries in CI, 0 locally
- **Reporters:** HTML, JSON, JUnit, List

## Writing Tests

### Unit Tests

Unit tests run without a browser and are ideal for pure JavaScript functions:

```javascript
import { test, expect } from '@playwright/test';
import F_ from '../../src/essence/Basics/Formulae_/Formulae_.js';

test.describe('My Unit Tests', () => {
  test('my test description', () => {
    const result = F_.someFunction(input);
    expect(result).toBe(expected);
  });
});
```

**Best practices for unit tests:**
- Test pure functions directly
- Use test fixtures for complex data
- Group related tests with `test.describe()`
- Use descriptive test names

### E2E Tests

E2E tests run in a browser and test the full application:

```javascript
import { test, expect } from '@playwright/test';

test.describe('My E2E Tests', () => {
  test('my test description', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="my-button"]');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

**Best practices for E2E tests:**
- Wait for network idle with `waitForLoadState('networkidle')`
- Use data-testid attributes for reliable selectors
- Test user workflows, not implementation details
- Handle async operations with `await`

## Test Fixtures

Reusable test data is stored in `tests/fixtures/`:

### Coordinate Samples
```javascript
import { coordinatePairs, bearingTestCases } from '../fixtures/coordinate-samples.js';

// Use in tests
const { start, end, expectedDistanceMeters } = coordinatePairs.shortDistance;
```

### GeoJSON Samples
```javascript
import { validGeoJSON, colorTestCases } from '../fixtures/geojson-samples.js';

// Use in tests
const point = validGeoJSON.point;
const lineString = validGeoJSON.lineString;
```

## Current Test Coverage

### Formulae_ Functions Tested

**String Utilities:**
- ✅ `getExtension()` - Extract file extension
- ✅ `pad()` - Zero-pad numbers
- ✅ `fileNameFromPath()` - Extract filename
- ✅ `cleanString()` - Remove special characters

**GeoJSON Utilities:**
- ✅ `getBaseGeoJSON()` - Create base FeatureCollection
- ✅ `getFeatureLength()` - Calculate LineString length

**Geographic Calculations:**
- ✅ `lngLatDistBetween()` - Haversine distance
- ✅ `bearingBetweenTwoLatLngs()` - Calculate bearing
- ✅ `metersToDegrees()` - Unit conversion
- ✅ `degreesToMeters()` - Unit conversion

**Color Utilities:**
- ✅ `hexToRGB()` - Convert hex to RGB
- ✅ `rgb2hex()` - Convert RGB to hex

**E2E Tests:**
- ✅ Application loads successfully
- ✅ Main container elements present

### Functions to Add Tests For (Priority Order)

**Priority 1: Geographic/Geodetic**
- `destinationFromBearing()` - Calculate destination from bearing
- `inclinationBetweenTwoLatLngs()` - Calculate inclination
- `azElDistBetween()` - Azimuth/elevation/distance

**Priority 2: GeoJSON Utilities**
- `invertGeoJSONLatLngs()` - Swap lat/lng coordinates
- `sortGeoJSONFeatures()` - Sort by geometry type
- `geojsonAddSpatialProperties()` - Add length/area properties
- `getFeatureArea()` - Calculate polygon area

**Priority 3: Color Utilities**
- `parseColor()` - Parse color strings
- `getColorFromRangeByPercent()` - Color interpolation
- `stringToColor()` - Generate color from string

**Priority 4: Array/Object Utilities**
- `getIn()` - Deep object traversal
- `clone()` - Deep clone objects
- `isEqual()` - Deep equality comparison

## Adding New Tests

### 1. Choose Test Type
- **Unit test:** Function doesn't need browser APIs → `tests/unit/`
- **E2E test:** Function needs browser or tests UI → `tests/e2e/`

### 2. Create or Update Test File
- Add to existing file if testing same module
- Create new file for new modules

### 3. Import Dependencies
```javascript
import { test, expect } from '@playwright/test';
import F_ from '../../src/essence/Basics/Formulae_/Formulae_.js';
```

### 4. Write Test
```javascript
test.describe('Feature Name', () => {
  test('specific behavior description', () => {
    // Arrange: Set up test data
    const input = 'test';

    // Act: Call function
    const result = F_.functionName(input);

    // Assert: Verify result
    expect(result).toBe('expected');
  });
});
```

### 5. Run Test
```bash
npm run test:unit -- tests/unit/your-file.spec.js
```

## Continuous Integration

Tests run automatically on:
- Pull requests to `master`
- Pushes to `master`

CI configuration: `.github/workflows/playwright-tests.yml`

### CI Features:
- PostgreSQL test database
- Chromium browser
- Test artifacts uploaded (reports, screenshots, videos)
- Retry on failure (2 attempts)

## Debugging Failed Tests

### Local Debugging
```bash
# Run test in headed mode to see browser
npm run test:headed

# Debug with Playwright Inspector
npm run test:debug -- tests/unit/formulae.spec.js

# Use UI mode for interactive debugging
npm run test:ui
```

### In CI
- Check test artifacts in GitHub Actions
- View screenshots and videos of failures
- Download HTML report for detailed analysis

## Tips for Effective Testing

1. **Test behavior, not implementation**
   - ✅ Test that distance calculation returns correct value
   - ❌ Test internal calculation steps

2. **Use descriptive test names**
   - ✅ `test('calculates distance between same point as zero')`
   - ❌ `test('test1')`

3. **Keep tests independent**
   - Each test should run in isolation
   - Don't rely on test execution order

4. **Use test fixtures for complex data**
   - Store test data in `fixtures/`
   - Reuse across multiple tests

5. **Handle async properly**
   - Always `await` async operations
   - Use Playwright's auto-waiting features

6. **Test edge cases**
   - Zero values
   - Negative numbers
   - Empty arrays/objects
   - Invalid input

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Assertions](https://playwright.dev/docs/test-assertions)

## Questions or Issues?

- Review test failures in CI artifacts
- Check existing tests for patterns
- Consult Playwright documentation
- Ask team members for guidance
