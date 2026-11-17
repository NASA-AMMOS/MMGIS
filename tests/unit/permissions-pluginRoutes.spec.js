/**
 * Unit tests for route-declaration tracking of external backend plugins.
 * Source: API/permissions/authorize.js (pluginScope, undeclaredPluginRoutes)
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const express = require('express');

const {
  authorize,
  registerRouter,
  undeclaredRoutes,
  pluginScope,
  undeclaredPluginRoutes,
} = require(path.resolve(__dirname, '../../API/permissions/authorize.js'));

const noop = (req, res, next) => next();

test.describe('external plugin route tracking', () => {
  const app = express();
  const s = { app, ensureUser: () => noop, registerRouter };

  const legacy = pluginScope(s, { name: 'LegacyPlugin', container: 'ext' });
  legacy.app.set('legacy-setting', 'kept');
  legacy.app.use(noop); // pathless middleware is not a route
  legacy.app.use('/api/legacy', legacy.ensureUser(), express.Router().get('/', noop));
  legacy.app.post('/api/legacy-direct', noop);

  const declared = pluginScope(s, { name: 'DeclaredPlugin', container: 'ext' });
  const router = express.Router();
  router.get('/', authorize('mission.view'), noop);
  declared.app.use('/api/declared', declared.registerRouter('/api/declared', router));
  declared.app.get('/api/declared-inline', authorize.public('plugin health'), noop);

  const partial = pluginScope(s, { name: 'PartialPlugin', container: 'ext' });
  const partialRouter = express.Router();
  partialRouter.get('/ok', authorize('mission.view'), noop);
  partialRouter.post('/missing', noop);
  partial.app.use('/api/partial', partial.registerRouter('/api/partial', partialRouter));

  const warnings = Object.fromEntries(
    undeclaredPluginRoutes().map((w) => [w.plugin, w.routes])
  );

  test('lists routes mounted directly on s.app without s.authorize', () => {
    expect(warnings.LegacyPlugin).toEqual(['USE /api/legacy', 'POST /api/legacy-direct']);
  });

  test('omits plugins whose routes all declare a permission', () => {
    expect(warnings.DeclaredPlugin).toBeUndefined();
  });

  test('lists undeclared routes inside a registered plugin router', () => {
    expect(warnings.PartialPlugin).toContain('POST /api/partial/missing');
    expect(warnings.PartialPlugin).not.toContain('GET /api/partial/ok');
  });

  test('plugin routes never count toward the fatal core check', () => {
    expect(undeclaredRoutes().map((r) => r.path)).not.toContain('/api/partial/missing');
  });

  test('the scoped app still behaves like the real app', () => {
    expect(legacy.app.get('legacy-setting')).toBe('kept');
    expect(app.get('legacy-setting')).toBe('kept');
    const paths = app.router.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).toEqual(expect.arrayContaining(['/api/legacy-direct', '/api/declared-inline']));
  });

  test('external plugins keep the legacy setup helpers', () => {
    expect(legacy.app).not.toBe(app);
    expect(legacy.ensureUser).toBe(s.ensureUser);
  });
});
