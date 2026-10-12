# MMGIS Testing Documentation

This directory contains the Playwright test suite for MMGIS. The tests use a hybrid approach: unit tests for pure JavaScript functions and E2E tests for browser-based functionality and API validation.

## Test Structure

```
tests/
├── unit/                       # Pure JavaScript unit tests (no browser)
│   ├── formulae.spec.js        # Tests for Formulae_ utility functions
│   └── stac-url-transformation.spec.js  # STAC URL handling
├── e2e/                        # End-to-end tests (require browser & server)
│   ├── api/                    # API endpoint tests (HTTP-only, no browser UI)
│   ├── auth/                   # Authentication flow tests (AUTH=local)
│   ├── map/                    # Map UI tests
│   ├── time/                   # Time-control / time-enabled layer tests
│   ├── tools/                  # Tool-specific UI tests
│   ├── configure/              # CMS / Configure page tests
│   ├── security/               # Security tests (injection, bypass, headers)
│   ├── collaboration/          # Multi-user / WebSocket tests
│   ├── performance/            # Performance benchmarks
│   ├── accessibility/          # Accessibility (a11y) tests
│   ├── mobile/                 # Mobile / responsive tests
│   ├── cross-browser/          # Cross-browser rendering (Chromium + Firefox)
│   ├── startup/                # Server startup / healthcheck
│   ├── smoke.spec.js           # Basic smoke test
│   ├── middleware.spec.js      # Express middleware tests
│   └── reference-mission.spec.js  # Reference Mission validation
├── fixtures/                   # Test data and samples
│   ├── coordinate-samples.js
│   ├── geojson-samples.js
│   └── user-credentials.js
├── helpers/                    # Test utilities
│   ├── auth.js                 # Authentication helpers
│   └── map-helpers.js          # Map readiness helpers
├── pages/                      # Page Object Models
│   ├── LayersPanelPage.js
│   └── MissionPage.js
├── global-setup.js             # Global setup & teardown (DB creation, server start, Reference Mission)
└── test-db-clean.js            # Database cleanup utility (npm run test:clean)
```

## Test Levels and Capabilities

Tests are organised on two axes: **level** (how deep) and **capability** (what feature).

| Level | Purpose | Location | Expectation |
|-------|---------|----------|-------------|
| `unit` | Low-level software behaviour; no server or browser | `tests/unit/`, `tests/ci/`, `@unit`-tagged plugin tests | Always pass |
| `api` | Backend routes, plugins, security, startup against the test server | `tests/e2e/api/`, `tests/e2e/security/`, `tests/e2e/startup/`, `plugins/*/backend/*/tests/` | Pass in both `AUTH` modes |
| `flow` | User-visible functional flows and corner cases in the browser | `tests/e2e/<area>/`, `plugins/*/tools/*/tests/`, `plugins/*/layertypes/*/tests/` | Cover every user-visible feature |

[`tests/capabilities.yml`](./capabilities.yml) is the capability catalog. It lists:

- **areas** — `MAP` map & globe, `LYR` layers & data, `UIF` user interaction features, `CFG` configuration, `AUTH` authentication, `API` APIs & integrations, `COL` collaboration, `PLT` platform.
- **capabilities** — e.g. `UIF-LAYERS-FILTER`, with `risk`, the levels it `requires`, the source `paths` it owns and the test files (`tests` globs) that exercise it.
- **scenarios** — user-level behaviours, e.g. `UIF-LAYERS-FILTER-02: Clearing a filter restores all features`. Scenarios marked `source: gherkin/...` were seeded from the `feature/bdd-gherkin-tests` branch.

### Attributing a test to a capability

1. **Tag** the test (preferred for new tests). A scenario tag also credits its capability:
   ```javascript
   test('clear filter restores all features', { tag: ['@UIF-LAYERS-FILTER-02'] }, async ({ page }) => { ... })
   ```
   Add `@unit`, `@api` or `@flow` only when the directory does not already imply the level.
2. Otherwise the file is matched by a capability's `tests` globs.

`tests/ci/capability-catalog.spec.js` (runs with the unit suite) fails if a spec file is not mapped to any capability, a tag references an unknown ID, or a catalog glob matches nothing.

### Adding a feature (example: a new layer filter)

1. Find the capability whose `paths` cover your files — `UIF-LAYERS-FILTER`. If none fits, add one.
2. Add unit tests for the filter logic (`tests/unit/...`).
3. Add a scenario per new user-visible behaviour, e.g. `UIF-LAYERS-FILTER-04: Filtering by date range hides out-of-range features`.
4. Add flow tests tagged with those scenario IDs, including corner cases (no matches, invalid values, layer toggled off/on).
5. List `UIF-LAYERS-FILTER` under "Feature areas impacted" in the PR.

### Capability coverage report

```bash
npm run test:unit            # or any Playwright run; writes playwright-report/results.json
npm run test:capabilities    # writes capability-report/index.html, capability-report.md, capability-report.json
```

Merge several runs by pointing `--results` at a directory of JSON files:

```bash
node tests/reporting/capability-report.js --results capability-results --out capability-report
```

Each capability is reported as **Covered** (every required level has passing tests), **Failing**, **Gap** (a required level has no tests), or **Skipped only**. Scenarios are **Not linked** until a test carries their tag. The report also lists unmapped tests and the top skip reasons.

## Prerequisites

- **PostgreSQL** with **PostGIS** extension
- **Node.js** (v18+)
- Playwright browsers installed: `npx playwright install --with-deps chromium firefox`

The test infrastructure automatically:
1. Creates an isolated `mmgis-test` database (never touches your working DB)
2. Runs `init-db.js` to set up extensions and tables
3. Starts the MMGIS server on **port 18888** (avoids conflicts with dev server on 8888)
4. Creates admin user (`test_admin`) and Reference Mission
5. Tears everything down after tests complete

## Running Tests

### Run All Tests
```bash
npm test              # Unit + E2E (all suites)
npm run test:e2e      # All E2E suites
npm run test:unit     # Unit tests only (fast, no server needed)
```

### Run Targeted E2E Suites
```bash
npm run test:e2e:api           # API endpoint tests
npm run test:e2e:auth-off      # Auth tests with AUTH=off
npm run test:e2e:auth-local    # Auth tests with AUTH=local
npm run test:e2e:security      # Security tests
npm run test:e2e:startup       # Server startup / healthcheck
npm run test:e2e:map           # Map UI tests
npm run test:e2e:time          # Time-control / time-enabled layer tests
npm run test:e2e:tools         # Tool UI tests
npm run test:e2e:configure     # CMS / Configure page tests
npm run test:e2e:collaboration # Multi-user / WebSocket tests
npm run test:e2e:performance   # Performance benchmarks
npm run test:e2e:accessibility # Accessibility tests
npm run test:e2e:mobile        # Mobile / responsive tests
npm run test:e2e:cross-browser # Cross-browser (Chromium + Firefox)
```

### Utility Commands
```bash
npm run test:clean    # Drop the mmgis-test database
npm run test:headed   # Run in headed mode (see browser)
npm run test:debug    # Debug with Playwright Inspector
npm run test:ui       # Interactive Playwright UI mode
npm run test:report   # View HTML test report
```

## Test Database Isolation

Tests use a **hardcoded** database name `mmgis-test` that is separate from your development database. The test infrastructure:

- **Auto-creates** `mmgis-test` if it doesn't exist (reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` from your `.env`)
- **Never touches** your working database (`DB_NAME` in `.env` is ignored for tests)
- **Runs on port 18888** so you can keep your dev server running on 8888

To clean up the test database:
```bash
npm run test:clean
```

## Test Configuration

Tests are configured in `playwright.config.js`:

| Setting | Value |
|---------|-------|
| Base URL | `http://localhost:18888` |
| Test DB | `mmgis-test` (hardcoded) |
| Test port | `18888` |
| Browsers | Chromium (primary), Firefox (cross-browser only) |
| Timeout | 3 minutes per test |
| Retries | 2 in CI, 0 locally |
| Reporters | HTML, JSON, JUnit, List |

## AUTH Modes and Test Skipping

Tests are designed to gracefully skip when their prerequisites aren't met:

- **AUTH=off** (default): API, map, tools, security, configure, performance, accessibility, mobile, cross-browser tests run. Auth-specific tests skip.
- **AUTH=local**: Auth flow tests (login, signup, session, password) run. Most other tests also run.
- **Infrastructure-dependent**: STAC, TiTiler, WebSocket, DEM tileset tests skip when those services aren't available.

Skipped tests show a `SKIP: ...` reason explaining why they were skipped.

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

### E2E Tests

E2E tests run in a browser and test the full application:

```javascript
import { test, expect } from '@playwright/test';

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

test.describe('My E2E Tests', () => {
  test('my test description', async ({ page }) => {
    await page.goto('/?mission=Reference-Mission');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#map')).toBeVisible();
  });
});
```

### Best Practices

- **Always use `/?mission=Reference-Mission`** for map tests (avoids 404 mission-not-found page)
- **Use `page.request`** for authenticated API calls (shares cookies with browser context)
- **Add skip guards** for infrastructure-dependent tests (`test.skip(condition, 'SKIP: reason')`)
- Wait for network idle with `waitForLoadState('networkidle')`
- Use Page Object Models from `tests/pages/` for common interactions
- Use helpers from `tests/helpers/` for auth and map readiness

## Continuous Integration

Tests run automatically on PRs and pushes to `master`/`main`/`development`, and can be started manually from **Actions → Playwright Tests → Run workflow** (`run_flows` toggles the slow browser suites).

CI configuration: `.github/workflows/playwright-tests.yml`

### Jobs

| Job | Runs | AUTH |
|-----|------|------|
| `unit` | `tests/unit`, `tests/ci` | n/a |
| `api` | `tests/e2e/api`, `security`, `startup`, `middleware`, `plugins/core/backend` | `off`, `local` |
| `flow` | Builds the frontend and Configure app, then `tests/e2e/{map,time,tools,ui,configure,auth,collaboration,accessibility,mobile,performance}`, smoke, global search, Reference Mission, `plugins/core/tools`, `plugins/core/layertypes` | `off`, `local` |
| `capability-report` | Joins every job's results with `tests/capabilities.yml` | — |

Not yet in CI: Firefox cross-browser (`tests/e2e/cross-browser`) and suites needing STAC/TiTiler/WebSocket services, which skip with a `SKIP:` reason.

### Artifacts

- `capability-coverage-report` — `index.html` (stakeholder view), `capability-report.md` (also shown as the run's job summary), `capability-report.json` and the raw per-job results. Kept 90 days.
- `playwright-report-<job>` — Playwright HTML/JSON/JUnit reports per job.
- `test-results-<job>` — screenshots, videos and traces for failures.

### CI Features:
- PostgreSQL + PostGIS test database
- Chromium browser
- Retry on failure (2 attempts)

## Debugging Failed Tests

### Local Debugging
```bash
# Run specific test file in headed mode
npx playwright test tests/e2e/map/landing-page.spec.js --headed

# Debug with Playwright Inspector
npm run test:debug -- tests/e2e/map/landing-page.spec.js

# Use UI mode for interactive debugging
npm run test:ui
```

### In CI
- Check test artifacts in GitHub Actions
- View screenshots and videos of failures
- Download HTML report for detailed analysis

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Assertions](https://playwright.dev/docs/test-assertions)
