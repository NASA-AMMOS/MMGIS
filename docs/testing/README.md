# MMGIS Testing Documentation

Welcome to the MMGIS testing documentation. This directory contains comprehensive guides for testing MMGIS at all levels.

## Available Guides

### [Testing Guide](TESTING_GUIDE.md)
Complete overview of the MMGIS testing framework, including:
- Testing philosophy and principles
- Different test types (unit, integration, BDD, E2E)
- Getting started with testing
- Writing effective tests
- CI/CD integration
- Troubleshooting common issues

### [BDD Testing Guide](BDD_TESTING.md)
Detailed guide for Behavior-Driven Development testing, including:
- Jest-cucumber for mock-based BDD tests
- Playwright integration for browser automation
- Infrastructure management (PostgreSQL, services)
- Configuration-driven testing approach
- Test helper functions and utilities
- Environment setup and debugging

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test types
npm run test:bdd     # Mock-based BDD tests
npm run test:e2e     # Browser automation tests

# Debug tests
npm run playwright:debug
```

## Test Organization

```
src/
├── features/                 # Gherkin feature files
│   ├── *.feature            # BDD scenarios
│   ├── *.steps.js           # Jest-cucumber step definitions
│   └── *.playwright.js      # Playwright step definitions
├── test-infrastructure/      # Test utilities
│   ├── setup.js             # Infrastructure management
│   ├── playwright-helpers.js # Browser automation helpers
│   └── playwright-*.js      # Playwright configuration
└── __tests__/               # Traditional Jest unit tests

docs/testing/
├── README.md               # This file
├── TESTING_GUIDE.md        # Comprehensive testing guide
└── BDD_TESTING.md          # BDD-specific documentation
```

## Key Features

- **Automatic Infrastructure**: PostgreSQL and services are automatically detected and launched
- **Dual Testing Approach**: Fast mocks for development, real browsers for validation
- **Configuration-Driven**: Tests use realistic mission configurations
- **Open Source Data**: Tests reference publicly available datasets
- **Container Support**: Works inside and outside Docker environments
- **Comprehensive Helpers**: Reusable functions for common testing tasks

## Contributing

When adding new tests:
1. Write Gherkin scenarios first to define behavior
2. Implement mock-based tests for fast feedback
3. Add browser tests for critical user paths
4. Update documentation as needed

For more details, see the [Testing Guide](TESTING_GUIDE.md) and [BDD Testing Guide](BDD_TESTING.md).