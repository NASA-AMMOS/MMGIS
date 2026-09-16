/**
 * Contract guard for GlobeRenderer.addLayer's always-async return shape.
 *
 * GlobeRenderer.js imports the LithoSphere + Cesium engines (and Cesium CSS),
 * so it can't be imported under the unit runner's esbuild loader. Instead we
 * assert the source-level invariants that keep the return contract uniform —
 * the exact regression flagged in review:
 *
 *   - `addLayer` is declared `async`, so EVERY path (gradient short-circuit,
 *     plugin dispatch, legacy fallback) resolves to a Promise<handle> rather
 *     than a bare handle for some types and a Promise for others.
 *   - the plugin-backed path dispatches through LayerInterface.run (async).
 *   - getMockLitho()'s addLayer (used when a mission has no globe panel)
 *     returns a Promise, so the .then()/.catch() call sites don't throw
 *     `undefined.then` and abort toggleLayer.
 *
 * The behavioral half of the async contract (run() always returns a Promise,
 * awaits phases, rejects on throw) is covered in layerInterface.spec.js.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');

const GLOBE_RENDERER = path.resolve(
    __dirname,
    '../../src/essence/Basics/Globe_/GlobeRenderer.js'
);
const GLOBE_ = path.resolve(
    __dirname,
    '../../src/essence/Basics/Globe_/Globe_.js'
);

test('GlobeRenderer.addLayer is declared async (uniform Promise<handle>)', () => {
    const src = fs.readFileSync(GLOBE_RENDERER, 'utf8');
    expect(/\basync\s+addLayer\s*\(/.test(src)).toBe(true);
});

test('the plugin-backed path dispatches through LayerInterface.run', () => {
    const src = fs.readFileSync(GLOBE_RENDERER, 'utf8');
    // Plugin types resolve their make() through the async runner.
    expect(
        /return\s+LayerInterface\.run\(\s*globeModule,\s*'make'/.test(src)
    ).toBe(true);
});

test('getMockLitho().addLayer returns a Promise (no-globe missions)', () => {
    const src = fs.readFileSync(GLOBE_, 'utf8');
    // Grab the getMockLitho() body and assert its addLayer resolves a Promise
    // so chained .then()/.catch() at the gradient_polyline call sites are safe.
    const mockStart = src.indexOf('getMockLitho:');
    expect(mockStart).toBeGreaterThan(-1);
    const mockBody = src.slice(mockStart, mockStart + 1200);
    const addLayerMatch = mockBody.match(/addLayer:\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    expect(addLayerMatch).not.toBeNull();
    expect(/return\s+Promise\.resolve\(/.test(addLayerMatch[1])).toBe(true);
});
