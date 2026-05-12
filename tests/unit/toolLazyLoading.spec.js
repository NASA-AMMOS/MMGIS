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
});
