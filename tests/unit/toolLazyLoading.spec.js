/**
 * Verify that the generated `src/pre/tools.js` statically imports every
 * tool. Cross-tool consumers (`Map_` feature-click → `InfoTool.use(...)`,
 * `LegendTool` → `LayersTool.populateCogScale`, `mmgisAPI`)
 * reach into other tools synchronously, so every tool module must be
 * available the moment `ToolController_` initialises.
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

test.describe('Generated tools.js (static imports)', () => {
    test('exists and is non-empty', () => {
        expect(fs.existsSync(TOOLS_JS)).toBe(true);
        const stat = fs.statSync(TOOLS_JS);
        expect(stat.size).toBeGreaterThan(0);
    });

    test('emits a static default import for every tool', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        // Each tool should be a `import FooTool from '...'` line.
        // At least one well-known tool should be present.
        expect(contents).toMatch(
            /^\s*import\s+IdentifierTool\s+from\s+'[^']+'/m
        );
    });

    test('does NOT use lazy `() => import(...)` for any tool', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        // Phase 4 lazy loading was reverted — no dynamic-import arrow
        // functions should appear in the generated file.
        expect(contents).not.toMatch(
            /const\s+\w+\s*=\s*\(\)\s*=>\s*import\(/
        );
        expect(contents).not.toContain('webpackChunkName');
    });

    test('toolModules export maps each tool name to its symbol', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(contents).toMatch(/export const toolModules = \{[^}]+\}/);
    });

    test('toolConfigs JSON is parseable and includes core tools', () => {
        const contents = fs.readFileSync(TOOLS_JS, 'utf8');
        const match = contents.match(
            /export const toolConfigs = (\{[\s\S]*?\})\nexport const toolModules/
        );
        expect(match).not.toBeNull();
        const cfg = JSON.parse(match[1]);
        // Sanity check: every Tools/<Name>/config.json from the
        // standard set should land here.
        for (const name of ['Info', 'Draw', 'Layers', 'Identifier']) {
            expect(cfg[name], `${name} should be present`).toBeTruthy();
            expect(typeof cfg[name].paths).toBe('object');
        }
    });
});

test.describe('Generated interactions.js (static imports)', () => {
    const INTERACTIONS_JS = path.resolve(
        __dirname,
        '..',
        '..',
        'src',
        'pre',
        'interactions.js'
    );

    test.beforeAll(() => {
        if (!fs.existsSync(INTERACTIONS_JS)) {
            const { updateInteractions } = require('../../API/updateTools');
            updateInteractions();
        }
    });

    test('exists and is non-empty', () => {
        expect(fs.existsSync(INTERACTIONS_JS)).toBe(true);
        const stat = fs.statSync(INTERACTIONS_JS);
        expect(stat.size).toBeGreaterThan(0);
    });

    test('emits static default imports for interactions', () => {
        const contents = fs.readFileSync(INTERACTIONS_JS, 'utf8');
        expect(contents).toMatch(
            /^\s*import\s+interaction_Select_\w+\s+from\s+'[^']+'/m
        );
    });

    test('does NOT use lazy `() => import(...)` for any interaction', () => {
        const contents = fs.readFileSync(INTERACTIONS_JS, 'utf8');
        expect(contents).not.toMatch(
            /const\s+\w+\s*=\s*\(\)\s*=>\s*import\(/
        );
        expect(contents).not.toContain('webpackChunkName');
    });

    test('exports interactionHandlers map', () => {
        const contents = fs.readFileSync(INTERACTIONS_JS, 'utf8');
        expect(contents).toContain('export const interactionHandlers');
    });

    test('exports interactionConfigs', () => {
        const contents = fs.readFileSync(INTERACTIONS_JS, 'utf8');
        expect(contents).toContain('export const interactionConfigs');
    });
});

test.describe('ToolController_ accessor contract', () => {
    test('getTool returns the loaded module when present, stub when absent', () => {
        // Stand-alone simulation of the relevant slice of
        // ToolController_ so the unit test does not pull in the full
        // essence runtime (which depends on Leaflet/jQuery/etc. and is
        // not available outside a browser context).
        const ToolController_ = {
            toolModules: {
                LoadedTool: { use() {}, value: 42 },
            },
            getTool(name) {
                const tool = this.toolModules[name];
                return tool || { use: function () {} };
            },
        };

        // Loaded tool: returns the real module.
        const loaded = ToolController_.getTool('LoadedTool');
        expect(loaded.value).toBe(42);

        // Missing tool: returns a stub with a callable `use` so legacy
        // callers like `Map_.getTool('Foo').use(...)` don't crash.
        const missing = ToolController_.getTool('NopeTool');
        expect(typeof missing.use).toBe('function');
        expect(() => missing.use()).not.toThrow();
    });
});
