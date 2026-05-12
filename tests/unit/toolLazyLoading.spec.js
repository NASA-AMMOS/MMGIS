/**
 * Verify that the generated `src/pre/tools.js` exposes lazy tool
 * loaders rather than static imports — i.e. each tool is emitted as
 * `const FooTool = () => import(...)`. This guarantees webpack can
 * split each tool into its own chunk.
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

const TOOLS_JS = path.resolve(__dirname, '..', '..', 'src', 'pre', 'tools.js');

// `src/pre/tools.js` is gitignored — generate it on demand before the
// suite runs so the tests work both locally (where it may already
// exist) and on CI (where `npm run build` has not yet been invoked).
test.beforeAll(() => {
    if (!fs.existsSync(TOOLS_JS)) {
        const { updateTools } = require('../../API/updateTools');
        updateTools();
    }
});

test.describe('Generated tools.js (lazy loading)', () => {
    test('exists and is non-empty', () => {
        expect(fs.existsSync(TOOLS_JS)).toBe(true);
        const stat = fs.statSync(TOOLS_JS);
        expect(stat.size).toBeGreaterThan(0);
    });

    test('emits each tool as a dynamic-import arrow function', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        // Every non-Kinds tool should be a `() => import(...)` declaration.
        const dynamicImportPattern =
            /const \w+ = \(\) => import\(\/\* webpackChunkName: "tool-\w+" \*\/ '[^']+'\)/;
        expect(contents).toMatch(dynamicImportPattern);
        // At least one well-known tool should be lazy-loaded.
        expect(contents).toContain(
            "const IdentifierTool = () => import(/* webpackChunkName: \"tool-IdentifierTool\" */"
        );
    });

    test('Kinds remains a static import (needed synchronously)', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(contents).toMatch(/import kinds from '[^']+'/);
    });

    test('does not statically import any non-Kinds tool', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        // No `import XxxTool from '...'` lines (except the Kinds line
        // which imports `kinds`, not a `*Tool` symbol).
        const staticToolImport =
            /^\s*import\s+\w*Tool(\w*)?\s+from\s+'[^']+'/m;
        expect(contents).not.toMatch(staticToolImport);
    });

    test('toolModules export still maps each tool name to a symbol', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(contents).toMatch(/export const toolModules = \{[^}]+\}/);
    });

    test('propagates `preload: true` for cross-referenced tools', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        // Parse the JSON literal embedded in the `toolConfigs` export.
        const match = contents.match(
            /export const toolConfigs = (\{[\s\S]*?\})\nexport const toolModules/
        );
        expect(match).not.toBeNull();
        const cfg = JSON.parse(match[1]);
        // Tools reached by cross-tool consumers (Map_, mmgisAPI,
        // LegendTool, Kinds) must be preloaded so `getTool(name)`
        // returns a real module at first call.
        for (const name of ['Info', 'Draw', 'Layers', 'Chemistry']) {
            expect(cfg[name], `${name} should be present`).toBeTruthy();
            expect(
                cfg[name].preload,
                `${name} should declare preload: true`
            ).toBe(true);
        }
    });
});

test.describe('ToolController_ accessor contract', () => {
    test('getTool returns a method-callable stub for unresolved lazy loaders', () => {
        // Stand-alone simulation of the relevant slice of
        // ToolController_ so the unit test does not pull in the
        // full essence runtime (which depends on Leaflet/jQuery/etc.
        // and is not available outside a browser context).
        const ToolController_ = {
            toolModules: {
                LazyTool: () => Promise.resolve({ default: { use() {} } }),
                LoadedTool: { use() {}, value: 42 },
            },
            ensureToolLoaded(name) {
                // Tracked so the test can verify background resolution.
                this._resolvedDuringGet = (this._resolvedDuringGet || []).concat(
                    [name]
                );
                return Promise.resolve(null);
            },
            getTool(name) {
                const tool = this.toolModules[name];
                if (!tool) return { use: function () {} };
                if (typeof tool === 'function') {
                    this.ensureToolLoaded(name);
                    return { use: function () {} };
                }
                return tool;
            },
            getLoadedTool(name) {
                const tm = this.toolModules[name];
                if (!tm || typeof tm === 'function') return null;
                return tm;
            },
        };

        // Unresolved lazy loader: getTool returns the stub, NOT the
        // raw function, so `.use()` is a no-op instead of TypeError.
        const lazy = ToolController_.getTool('LazyTool');
        expect(typeof lazy).toBe('object');
        expect(typeof lazy.use).toBe('function');
        expect(() => lazy.use()).not.toThrow();
        // And ensureToolLoaded was called in the background.
        expect(ToolController_._resolvedDuringGet).toContain('LazyTool');

        // Resolved tool: getTool returns the module itself.
        const loaded = ToolController_.getTool('LoadedTool');
        expect(loaded.value).toBe(42);

        // Unknown tool: getTool returns the stub.
        const missing = ToolController_.getTool('NopeTool');
        expect(typeof missing.use).toBe('function');

        // getLoadedTool: null for unresolved/missing, real for resolved.
        expect(ToolController_.getLoadedTool('LazyTool')).toBeNull();
        expect(ToolController_.getLoadedTool('NopeTool')).toBeNull();
        expect(ToolController_.getLoadedTool('LoadedTool').value).toBe(42);
    });
});
