/**
 * Unit tests for validatePluginConfig() from API/pluginValidation.js.
 *
 * These tests are pure JS — they don't require a running server or
 * browser. They run under Playwright's test runner via
 * `npm run test:unit`.
 */

import { test, expect } from '@playwright/test';

const {
    validatePluginConfig,
    validateDependencies,
    validateLayerTypeModuleShape,
    validateLayerCapabilities,
} = require('../../API/pluginValidation');

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
        // Backends are keyed by their directory name; plugin.json is optional
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

test.describe('validatePluginConfig - Phase 2 manifest fields', () => {
    test('accepts valid Phase 2 fields', () => {
        const config = {
            uuid: '550e8400-e29b-41d4-a716-446655440000',
            id: 'core-foo',
            version: '5.1.4-20260616',
            type: 'tool',
            tier: 'core',
            overridable: true,
            name: 'Foo',
            paths: { FooTool: '../plugins/core/tools/Foo/FooTool' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors).toEqual([]);
    });

    test('rejects invalid type value', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            type: 'invalid',
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'type' must be one of"))).toBe(true);
    });

    test('rejects invalid tier value', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            tier: 'premium',
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'tier' must be one of"))).toBe(true);
    });

    test('rejects non-boolean overridable', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            overridable: 'yes',
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'overridable' must be a boolean"))).toBe(true);
    });

    test('rejects non-array aliases', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            aliases: 'foo',
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'aliases' must be an array"))).toBe(true);
    });

    test('rejects non-object engines', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            engines: '>=5.0.0',
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'engines' must be an object"))).toBe(true);
    });

    test('rejects non-object peerDependencies', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            peerDependencies: ['core-draw'],
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors.some((e) => e.includes("'peerDependencies' must be an object"))).toBe(true);
    });

    test('accepts valid engines and peerDependencies objects', () => {
        const config = {
            name: 'Foo',
            paths: { FooTool: 'path' },
            engines: { mmgis: '>=5.0.0' },
            peerDependencies: { 'core-draw': '>=5.0.0' },
        };
        const errors = validatePluginConfig(config, 'Foo', 'tool');
        expect(errors).toEqual([]);
    });
});

test.describe('validatePluginConfig - interaction manifest fields', () => {
    const validInteraction = {
        name: 'TestHook',
        interactionId: 'test:hook',
        paths: { TestHook: './TestHook' },
        phase: 'preamble',
        order: 0,
    };

    test('valid interaction with phase and order returns no errors', () => {
        const errors = validatePluginConfig(validInteraction, 'TestHook', 'interaction');
        expect(errors).toEqual([]);
    });

    test('rejects invalid phase value', () => {
        const config = { ...validInteraction, phase: 'invalid' };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors.some((e) => e.includes("'phase' must be one of"))).toBe(true);
    });

    test('accepts all valid phase values', () => {
        for (const phase of ['preamble', 'postamble', 'main']) {
            const config = { ...validInteraction, phase };
            const errors = validatePluginConfig(config, 'TestHook', 'interaction');
            expect(errors).toEqual([]);
        }
    });

    test('rejects non-numeric order', () => {
        const config = { ...validInteraction, order: 'first' };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors.some((e) => e.includes("'order' must be a number"))).toBe(true);
    });

    test('rejects non-array suppresses', () => {
        const config = { ...validInteraction, suppresses: 'info:silent' };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors.some((e) => e.includes("'suppresses' must be an array"))).toBe(true);
    });

    test('accepts valid suppresses array', () => {
        const config = { ...validInteraction, suppresses: ['info:silent'] };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors).toEqual([]);
    });

    test('rejects non-array kindAlias', () => {
        const config = { ...validInteraction, kindAlias: 'info' };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors.some((e) => e.includes("'kindAlias' must be an array"))).toBe(true);
    });

    test('accepts valid kindAlias array', () => {
        const config = { ...validInteraction, kindAlias: ['info', 'details'] };
        const errors = validatePluginConfig(config, 'TestHook', 'interaction');
        expect(errors).toEqual([]);
    });

    test('phase, order, suppresses, kindAlias are all optional', () => {
        const config = {
            name: 'Minimal',
            interactionId: 'minimal',
            paths: { Minimal: './Minimal' },
        };
        const errors = validatePluginConfig(config, 'Minimal', 'interaction');
        expect(errors).toEqual([]);
    });
});

test.describe('validatePluginConfig - layertype renderer contract', () => {
    const base = (extra) => ({
        name: 'Tile',
        typeId: 'tile',
        ...extra,
    });

    test('declared map renderer without a map module is rejected', () => {
        const config = base({
            capabilities: { renderers: { map: { engines: ['leaflet'] } } },
            modules: { globe: { cesium: './globe/cesium/tile' } },
        });
        const errors = validatePluginConfig(config, 'Tile', 'layertype');
        expect(errors.some((e) => e.includes("no 'modules.map'"))).toBe(true);
    });

    test('map module without a declared map renderer is rejected', () => {
        const config = base({
            capabilities: { renderers: { map: false, globe: false } },
            modules: { map: './map/tile' },
        });
        const errors = validatePluginConfig(config, 'Tile', 'layertype');
        expect(errors.some((e) => e.includes("does not declare a 'map' renderer"))).toBe(true);
    });

    test('declared globe engine without a matching module is rejected', () => {
        const config = base({
            capabilities: { renderers: { globe: { engines: ['cesium'] } } },
            modules: { globe: { lithosphere: './globe/lithosphere/tile' } },
        });
        const errors = validatePluginConfig(config, 'Tile', 'layertype');
        expect(errors.some((e) => e.includes("no 'modules.globe.cesium'"))).toBe(true);
        expect(errors.some((e) => e.includes("does not declare globe engine 'lithosphere'"))).toBe(true);
    });

    test('matching renderers and modules produce no cross-check errors', () => {
        const config = base({
            capabilities: {
                renderers: {
                    map: { engines: ['leaflet'] },
                    globe: { engines: ['cesium', 'lithosphere'] },
                },
            },
            modules: {
                map: './map/tile',
                globe: {
                    cesium: './globe/cesium/tile',
                    lithosphere: './globe/lithosphere/tile',
                },
            },
        });
        const errors = validatePluginConfig(config, 'Tile', 'layertype');
        expect(errors).toEqual([]);
    });

    test('defaultInteractions must map events to string arrays', () => {
        const config = base({
            capabilities: { defaultInteractions: { click: 'identifyPopup' } },
        });
        const errors = validatePluginConfig(config, 'Tile', 'layertype');
        expect(errors.some((e) => e.includes('defaultInteractions.click'))).toBe(true);
    });
});

test.describe('validateLayerCapabilities - classification contract', () => {
    // Capabilities are what core reads while partitioning every layer, so
    // getting one wrong mis-orders or un-picks a layer with no runtime error.
    // These are the errors that replace that silence.
    const caps = (capabilities, type = 'layertype') =>
        validateLayerCapabilities(capabilities, 'X', type);

    test('the full built-in vocabulary passes', () => {
        expect(
            caps({
                renderers: { map: { engines: ['leaflet'] }, globe: false },
                structural: false,
                map: {
                    stacking: 'raster',
                    redrawOnReorder: true,
                    tracksLoad: false,
                    refreshByRemake: true,
                    stacEndpoint: 'tiles',
                    picking: true,
                    styling: false,
                },
                time: { enabled: true, histogram: true },
                filtering: false,
                identify: true,
            })
        ).toEqual([]);
    });

    test('time may be a plain boolean', () => {
        expect(caps({ time: true })).toEqual([]);
        expect(caps({ time: 'yes' }).length).toBe(1);
    });

    test('a wrong leaf type is an error, naming its full path', () => {
        const errors = caps({ map: { picking: 'true' } });
        expect(errors.some((e) => e.includes("'capabilities.map.picking'"))).toBe(true);
    });

    test('a value outside an enum is an error', () => {
        expect(caps({ map: { stacking: 'top' } }).length).toBe(1);
        expect(caps({ map: { stacking: false } })).toEqual([]);
        expect(caps({ map: { stacEndpoint: 'elevation' } }).length).toBe(1);
    });

    test('an unknown capability warns rather than failing', () => {
        // Forward compatibility: a capability this MMGIS doesn't know may be
        // read by a newer one, so a typo is a warning, not a build break.
        expect(caps({ retainOnHide: true })).toEqual([]);
        expect(caps({ map: { stackign: 'raster' } })).toEqual([]);
    });

    test('attachment host capabilities are checked against their own schema', () => {
        expect(
            caps(
                {
                    renderers: { map: { engines: ['leaflet'] } },
                    host: {
                        order: 3,
                        sublayerKey: 'models',
                        buildsAfterSiblings: true,
                        decoratesHost: false,
                    },
                    globe: { suppressesHost: true },
                },
                'layerattachment'
            )
        ).toEqual([]);
        expect(
            caps({ host: { order: 'first' } }, 'layerattachment').length
        ).toBe(1);
        // A layertype has no host, and an attachment no map stacking.
        expect(caps({ host: { order: 3 } })).toEqual([]);
    });

    test('every core layertype and attachment manifest validates', () => {
        const fs = require('fs');
        const path = require('path');
        const root = path.resolve(__dirname, '../../plugins/core');
        for (const [dir, type] of [
            ['layertypes', 'layertype'],
            ['layerattachments', 'layerattachment'],
        ]) {
            for (const name of fs.readdirSync(path.join(root, dir))) {
                const manifestPath = path.join(root, dir, name, 'plugin.json');
                if (!fs.existsSync(manifestPath)) continue;
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                expect(
                    validateLayerCapabilities(manifest.capabilities, name, type)
                ).toEqual([]);
            }
        }
    });
});

test.describe('validateLayerTypeModuleShape - renderer module contract', () => {
    test('valid nested + shorthand module passes', () => {
        const src = `
            import x from '@basics/x'
            export default {
                make: { async main(o, c) {}, after(o) {}, afterCommit(o) {} },
                destroy: (o, c) => {},
                setStyle: fn,
            }`;
        expect(validateLayerTypeModuleShape(src, 'x')).toEqual([]);
    });

    test('shorthand property list passes', () => {
        const src = `export default { make, destroy, setOpacity, timeChange }`;
        expect(validateLayerTypeModuleShape(src, 'x')).toEqual([]);
    });

    test('missing make is rejected', () => {
        const src = `export default { destroy(o, c) {} }`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes("missing required 'make'"))).toBe(true);
    });

    test('typo operation name is rejected', () => {
        const src = `export default { make(o) {}, destory(o) {} }`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes("unknown operation 'destory'"))).toBe(true);
    });

    test('unknown phase is rejected', () => {
        const src = `export default { make: { main() {}, sideways() {} } }`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes("unknown phase 'sideways'"))).toBe(true);
    });

    test('afterCommit outside make is rejected', () => {
        const src = `export default { make() {}, setStyle: { afterCommit() {} } }`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes("unknown phase 'afterCommit' in 'setStyle'"))).toBe(true);
    });

    test('missing export default is reported', () => {
        const src = `const foo = {}; module.exports = foo`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes('no'))).toBe(true);
    });

    test('regex literal with brackets/quotes does not hide a later typo', () => {
        const src = `export default {
            make: {
                main(o, c) {
                    const s = o.url.replace(/["'\\]{}()]/g, '');
                    return s;
                },
            },
            destory(o) {},
        }`;
        const errs = validateLayerTypeModuleShape(src, 'x');
        expect(errs.some((e) => e.includes("unknown operation 'destory'"))).toBe(true);
    });
});
