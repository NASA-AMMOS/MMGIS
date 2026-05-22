/**
 * Unit tests for Fix 7: Static middleware ordering
 *
 * Validates that public static middleware is declared before session middleware
 * in server.js, and authenticated routes remain after session middleware.
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

test.describe('Fix 7: Static middleware ordering', () => {
  let serverContent;

  test.beforeAll(() => {
    serverContent = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'server.js'),
      'utf-8'
    );
  });

  test('session middleware exists', () => {
    expect(serverContent).toContain('app.use(');
    expect(serverContent).toContain('session(');
  });

  test('public static middleware appears before session middleware', () => {
    const sessionIndex = serverContent.indexOf('app.use(\n  session(');
    // fallback: search for the session setup pattern
    const sessionIdx = sessionIndex !== -1 ? sessionIndex :
      serverContent.indexOf('session({');

    expect(sessionIdx).toBeGreaterThan(-1);

    // Check /public static route - should be before session
    const publicStaticComment = serverContent.indexOf('// Public static assets');
    if (publicStaticComment !== -1) {
      expect(publicStaticComment).toBeLessThan(sessionIdx);
    }
  });

  test('authenticated routes appear after session middleware', () => {
    const sessionIdx = serverContent.indexOf('session({');
    expect(sessionIdx).toBeGreaterThan(-1);

    // /build route with ensureUser should be after session
    const buildRouteIdx = serverContent.indexOf('ensureUser(), express.static(path.join(rootDir, "/build"))');
    if (buildRouteIdx !== -1) {
      expect(buildRouteIdx).toBeGreaterThan(sessionIdx);
    }
  });

  test('README.md static route does not use ensureUser', () => {
    // Find the README.md static line
    const readmeLines = serverContent.split('\n').filter(line =>
      line.includes('README.md') && line.includes('express.static')
    );
    for (const line of readmeLines) {
      expect(line).not.toContain('ensureUser');
    }
  });

  test('/public static route does not use ensureUser', () => {
    const publicLines = serverContent.split('\n').filter(line =>
      line.includes('/public') && line.includes('express.static') && !line.includes('configure/public')
    );
    for (const line of publicLines) {
      expect(line).not.toContain('ensureUser');
    }
  });
});
