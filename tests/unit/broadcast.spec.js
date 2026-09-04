/**
 * Unit tests for the Broadcast backend plugin helpers.
 * Source: plugins/core/backend/Broadcast/routes/broadcastutils.js
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const {
  websocketsEnabled,
  validateLayerUpdateBody,
  buildRefreshLayerEnvelope,
} = require(path.resolve(
  __dirname,
  '../../plugins/core/backend/Broadcast/routes/broadcastutils.js'
));

test.describe('Broadcast: websocketsEnabled', () => {
  test('is true only when ENABLE_MMGIS_WEBSOCKETS === "true"', () => {
    expect(websocketsEnabled({ ENABLE_MMGIS_WEBSOCKETS: 'true' })).toBe(true);
    expect(websocketsEnabled({ ENABLE_MMGIS_WEBSOCKETS: 'false' })).toBe(false);
    expect(websocketsEnabled({ ENABLE_MMGIS_WEBSOCKETS: '' })).toBe(false);
    expect(websocketsEnabled({ ENABLE_MMGIS_WEBSOCKETS: 'TRUE' })).toBe(false);
    expect(websocketsEnabled({})).toBe(false);
  });
});

test.describe('Broadcast: validateLayerUpdateBody', () => {
  test('accepts a single layerName string', () => {
    expect(
      validateLayerUpdateBody({ mission: 'Test', layerName: 'abc-uuid' })
    ).toBeNull();
  });

  test('accepts an array of layerName strings', () => {
    expect(
      validateLayerUpdateBody({ mission: 'Test', layerName: ['a', 'b'] })
    ).toBeNull();
  });

  test('rejects missing or non-string mission', () => {
    expect(validateLayerUpdateBody({ layerName: 'a' })).toMatch(/mission/);
    expect(validateLayerUpdateBody({ mission: '', layerName: 'a' })).toMatch(/mission/);
    expect(validateLayerUpdateBody({ mission: 42, layerName: 'a' })).toMatch(/mission/);
  });

  test('rejects missing, empty, or malformed layerName', () => {
    expect(validateLayerUpdateBody({ mission: 'Test' })).toMatch(/layerName/);
    expect(validateLayerUpdateBody({ mission: 'Test', layerName: '' })).toMatch(/layerName/);
    expect(validateLayerUpdateBody({ mission: 'Test', layerName: [] })).toMatch(/layerName/);
    expect(validateLayerUpdateBody({ mission: 'Test', layerName: ['a', ''] })).toMatch(/layerName/);
    expect(validateLayerUpdateBody({ mission: 'Test', layerName: ['a', 1] })).toMatch(/layerName/);
    expect(validateLayerUpdateBody({ mission: 'Test', layerName: { a: 1 } })).toMatch(/layerName/);
  });

  test('rejects a missing body', () => {
    expect(validateLayerUpdateBody(undefined)).toMatch(/body/);
    expect(validateLayerUpdateBody(null)).toMatch(/body/);
  });
});

test.describe('Broadcast: buildRefreshLayerEnvelope', () => {
  test('matches the shape the client reads (info.type, info.layerName, body.mission)', () => {
    const envelope = buildRefreshLayerEnvelope('Test', 'abc-uuid');
    expect(envelope).toEqual({
      info: { type: 'refreshLayer', layerName: 'abc-uuid' },
      body: { mission: 'Test' },
    });
  });

  test('passes an array of layer names through unchanged', () => {
    const envelope = buildRefreshLayerEnvelope('Test', ['a', 'b']);
    expect(envelope.info.layerName).toEqual(['a', 'b']);
  });

  test('is notify-only: no config or forceClientUpdate', () => {
    const envelope = buildRefreshLayerEnvelope('Test', 'a');
    expect(envelope).not.toHaveProperty('forceClientUpdate');
    expect(envelope.body).not.toHaveProperty('config');
    expect(Object.keys(envelope).sort()).toEqual(['body', 'info']);
  });
});
