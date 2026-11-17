/**
 * Regression coverage for development-server startup logging.
 *
 * Startup output must remain in an interactive terminal's scrollback after
 * the delayed Webpack development server starts.
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

test.describe('Development server startup logs', () => {
  let serverContent;

  test.beforeAll(() => {
    serverContent = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'server.js'),
      'utf-8'
    );
  });

  test('does not clear interactive terminal scrollback', () => {
    const callbackStart = serverContent.indexOf('devServer.startCallback');
    const callbackEnd = serverContent.indexOf('\n  });', callbackStart);
    const startupCallback = serverContent.slice(callbackStart, callbackEnd);

    expect(callbackStart).toBeGreaterThan(-1);
    expect(startupCallback).not.toContain('console.clear()');
  });
});
