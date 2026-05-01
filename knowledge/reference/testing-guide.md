# Testing Guide

## Test Framework

- **E2E**: Playwright
- **Unit**: Jest 29 with JSDOM
- **Coverage Target**: 80% overall, 100% for critical paths

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.js

# Playwright E2E tests
npx playwright test
npm run test:headed          # Visible browser
npm run test:debug           # Step-through debugging
npm run test:ui              # Playwright UI mode
npm run test:report          # View test report

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Start server in test mode
npm run start:test           # NODE_ENV=test PORT=8888
```

## Test Locations

- **Unit tests**: Alongside source files (`*.test.js`, `*.spec.js`)
- **Integration tests**: `API/Backend/**/*.test.js`
- **E2E tests**: `tests/e2e/`

## Test Database

- Use dedicated test databases: `mmgis-test` and `mmgis-stac-test`
- Configure via `DB_USER_TEST` and `DB_PASS_TEST` environment variables
- Test DB setup in `tests/global-setup.js`
- Test DB cleanup in `tests/test-db-clean.js`

## Database Safety Rules for Tests

1. NEVER use `DROP DATABASE` except in `tests/test-db-clean.js` against test DBs only
2. NEVER hardcode production database names or credentials
3. ALWAYS use `DB_USER_TEST`/`DB_PASS_TEST` for test credentials
4. NEVER remove `NODE_ENV === 'production'` safety checks
5. NEVER use destructive SQL on non-test databases

## E2E Test Notes

- Accessibility test scans landing page and map for WCAG 2.1 AA violations
- Use `npm run test:headed` to see tests run in visible browser
- Use `npm run test:debug` for interactive debugging

## Writing Tests

- Business logic and utility functions → unit tests
- API endpoints and auth flows → integration tests
- User workflows → E2E tests
- Tests requiring admin access: use `/api/users/first_signup` to create admin on fresh DB
- Tests requiring AUTH=off admin access: set session permission directly or use long-term token
