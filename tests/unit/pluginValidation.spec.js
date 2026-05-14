/**
 * Unit tests for validatePluginConfig() from API/pluginValidation.js.
 *
 * These tests are pure JS — they don't require a running server or
 * browser. They run under Playwright's test runner via
 * `npm run test:unit`.
 */

import { test, expect } from '@playwright/test';

const { validatePluginConfig, validateDependencies } = require(
    '../../API/pluginValidation'
);

test.describe('validatePluginConfig - tool plugins', () => {
    test('valid minimal tool config returns no errors', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'essence/Plugin-Tools-Foo/Foo/FooTool' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors).toEqual([]);
    });

    test('rejects missing name', () => {
        const config = {
            paths: { FooTool: 'essence/Plugin-Tools-Foo/Foo/FooTool' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.includes("'name'"))).toBe(true);
    });

    test('rejects empty-string name', () => {
        const config = {
            name: '',
            paths: { FooTool: 'essence/Plugin-Tools-Foo/Foo/FooTool' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'name'"))).toBe(true);
    });

    test('rejects missing paths', () => {
        const config = { name: 'Foo' };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('rejects non-object paths', () => {
        const config = { name: 'Foo', paths: 'not-an-object' };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('rejects array paths', () => {
        const config = { name: 'Foo', paths: ['a', 'b'] };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('rejects non-string path values', () => {
        const config = { name: 'Foo', paths: { FooTool: 42 } };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes('paths.FooTool'))).toBe(true);
    });

    test('rejects empty paths object', () => {
        const config = { name: 'Foo', paths: {} };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('unknown top-level fields do not cause errors (warned only)', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'essence/Plugin-Tools-Foo/Foo/FooTool' },
            unknownExperimentalField: { foo: 'bar' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors).toEqual([]);
    });

    test('rejects when config is null', () => {
        const errors = validatePluginConfig(null, 'Foo', 'tool');
        expect(errors.length).toBeGreaterThan(0);
    });

    test('rejects when config is an array', () => {
        const errors = validatePluginConfig([], 'Foo', 'tool');
        expect(errors.length).toBeGreaterThan(0);
    });
});

test.describe('validatePluginConfig - component plugins', () => {
    test('valid component config returns no errors', () => {
        const config = {
            name: 'Bar',
            paths: { Bar: 'essence/Components/Bar/Bar' },
        };
        const errors = validatePluginConfig(config, 'Bar', 'component');
        expect(errors).toEqual([]);
    });

    test('missing name rejected for component', () => {
        const errors = validatePluginConfig(
            { paths: { Bar: 'essence/Components/Bar/Bar' } },
            'Bar',
            'component'
        );
        expect(errors.some((e) => e.includes("'name'"))).toBe(true);
    });

    test('missing paths rejected for component', () => {
        const errors = validatePluginConfig({ name: 'Bar' }, 'Bar', 'component');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });
});

test.describe('validatePluginConfig - backend plugins', () => {
    test('minimal backend config (no name, no paths) is allowed', () => {
        // Backends are keyed by their directory name; config.json is optional
        // and primarily used for declaring dependencies.
        const errors = validatePluginConfig({}, 'Foo', 'backend');
        expect(errors).toEqual([]);
    });

    test('backend with non-string name is rejected', () => {
        const errors = validatePluginConfig(
            { name: 123 },
            'Foo',
            'backend'
        );
        expect(errors.some((e) => e.includes("'name'"))).toBe(true);
    });
});

test.describe('validateDependencies', () => {
    test('undefined dependencies is valid', () => {
        expect(validateDependencies(undefined, 'Foo')).toEqual([]);
    });

    test('valid npm + python deps are accepted', () => {
        const errors = validateDependencies(
            {
                npm: { lodash: '^4.17.0' },
                python: { pip: ['requests==2.32.3'], conda: ['gdal==3.12.2'] },
            },
            'Foo'
        );
        expect(errors).toEqual([]);
    });

    test('rejects non-object dependencies', () => {
        const errors = validateDependencies('lodash', 'Foo');
        expect(errors.length).toBeGreaterThan(0);
    });

    test('rejects non-object npm', () => {
        const errors = validateDependencies({ npm: ['lodash'] }, 'Foo');
        expect(errors.some((e) => e.includes('dependencies.npm'))).toBe(true);
    });

    test('rejects non-string npm versions', () => {
        const errors = validateDependencies(
            { npm: { lodash: 4 } },
            'Foo'
        );
        expect(errors.length).toBeGreaterThan(0);
    });

    test('rejects non-array python.pip', () => {
        const errors = validateDependencies(
            { python: { pip: 'requests' } },
            'Foo'
        );
        expect(errors.some((e) => e.includes('python.pip'))).toBe(true);
    });

    test('rejects non-array python.conda', () => {
        const errors = validateDependencies(
            { python: { conda: 'gdal' } },
            'Foo'
        );
        expect(errors.some((e) => e.includes('python.conda'))).toBe(true);
    });

    test('rejects empty string in python.pip', () => {
        const errors = validateDependencies(
            { python: { pip: ['requests', ''] } },
            'Foo'
        );
        expect(errors.length).toBeGreaterThan(0);
    });
});
