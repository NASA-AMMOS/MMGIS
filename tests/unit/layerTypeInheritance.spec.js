/**
 * Unit tests for the two authoring shortcuts a layer type may use:
 *
 *   extends: "<typeId>"   inherit every surface it doesn't declare from ONE
 *                         parent, so "tile but the url comes from elsewhere"
 *                         doesn't mean forking tile.
 *   module                ship all surfaces in one module instead of a
 *                         directory of six files.
 *
 * Both are resolved at runtime, so a dangling or chained parent would silently
 * become "my plugin does nothing" — hence the cross-plugin validation here.
 */

import { test, expect } from '@playwright/test'
import {
    mergeSurface,
    mergeSurfaces,
} from '../../src/essence/Basics/Layers_/registry/typeInheritance'

const {
    validatePluginConfig,
    validateLayerTypeInheritance,
    surfaceOfModuleKey,
    flattenLayerModules,
    ATTACHMENT_OPS,
} = require('../../API/pluginValidation')

const parent = () => ({
    name: 'Parent',
    type: 'layertype',
    typeId: 'parent',
    version: '1.0.0',
    capabilities: { renderers: { map: { engines: ['leaflet'] }, globe: false } },
    modules: { map: './map/parent' },
})

const child = (extra = {}) => ({
    name: 'Child',
    type: 'layertype',
    typeId: 'child',
    version: '1.0.0',
    extends: 'parent',
    ...extra,
})

test.describe('extends — manifest shape', () => {
    test('a type may inherit everything and declare no modules of its own', () => {
        expect(validatePluginConfig(child(), 'Child', 'layertype')).toEqual([])
    })

    test('an inheriting type may declare capabilities it renders through its parent', () => {
        const errors = validatePluginConfig(
            child({
                capabilities: {
                    renderers: { map: { engines: ['leaflet'] }, globe: false },
                    map: { picking: true },
                },
            }),
            'Child',
            'layertype'
        )
        expect(errors).toEqual([])
    })

    test('extends must be a non-empty string and cannot be itself', () => {
        expect(
            validatePluginConfig(child({ extends: '' }), 'Child', 'layertype')
        ).toEqual([
            "Plugin 'Child' (layertype): 'extends' must be a non-empty typeId string",
        ])
        expect(
            validatePluginConfig(
                child({ extends: 'child' }),
                'Child',
                'layertype'
            )
        ).toEqual([
            "Plugin 'Child' (layertype): 'extends' cannot reference itself ('child')",
        ])
    })

    test('extends is only meaningful for a layer type', () => {
        const errors = validatePluginConfig(
            {
                name: 'Att',
                type: 'layerattachment',
                attachmentId: 'att',
                version: '1.0.0',
                extends: 'labels',
                module: './att',
            },
            'Att',
            'layerattachment'
        )
        expect(errors).toContain(
            "Plugin 'Att' (layerattachment): 'extends' is only valid on a layertype"
        )
    })
})

test.describe('extends — cross-plugin resolution', () => {
    test('a resolvable parent is valid', () => {
        expect(
            validateLayerTypeInheritance({
                parent: parent(),
                child: child(),
            })
        ).toEqual([])
    })

    test('a missing parent fails rather than silently rendering nothing', () => {
        expect(
            validateLayerTypeInheritance({ child: child({ extends: 'ghost' }) })
        ).toEqual([
            "Layer type 'child': extends 'ghost', which no plugin provides",
        ])
    })

    test('inheritance is one level only', () => {
        const errors = validateLayerTypeInheritance({
            parent: parent(),
            child: child(),
            grandchild: {
                ...child({ extends: 'child' }),
                typeId: 'grandchild',
                name: 'Grandchild',
            },
        })
        expect(errors).toEqual([
            "Layer type 'grandchild': extends 'child', which itself extends 'parent' — inheritance is one level only",
        ])
    })
})

test.describe('extends — what a child inherits inside a surface', () => {
    const parentConfig = { expand: () => 'expanded', normalize: () => 'parent' }

    test('declaring one operation of a surface keeps the parent\'s others', () => {
        // The trap this exists for: adding a `normalize` to inherit the rest of
        // vector's `config` used to drop vector's STAC `expand` silently.
        const merged = mergeSurface(parentConfig, { normalize: () => 'child' })
        expect(merged.normalize()).toBe('child')
        expect(merged.expand()).toBe('expanded')
    })

    test('a surface the child says nothing about is the parent\'s', () => {
        expect(mergeSurface(parentConfig, undefined)).toBe(parentConfig)
    })

    test('globe merges per engine, then per operation', () => {
        const merged = mergeSurfaces(
            {
                map: { make: () => 'parent map' },
                globe: {
                    cesium: { make: () => 'parent cesium', destroy: () => 'kept' },
                    lithosphere: { make: () => 'parent litho' },
                },
            },
            { globe: { cesium: { make: () => 'child cesium' } } }
        )
        expect(merged.map.make()).toBe('parent map')
        expect(merged.globe.cesium.make()).toBe('child cesium')
        expect(merged.globe.cesium.destroy()).toBe('kept')
        expect(merged.globe.lithosphere.make()).toBe('parent litho')
    })

    test('a type with no parent is its own modules', () => {
        const own = { map: { make: () => 1 } }
        expect(mergeSurfaces(null, own)).toBe(own)
        expect(mergeSurfaces(null, null)).toBeNull()
    })
})

test.describe('surfaces', () => {
    test('a single-module layer type is not validated against one op vocabulary', () => {
        // It exports { map, globe, config, … } rather than operations, so there
        // is no single surface to check its keys against.
        expect(surfaceOfModuleKey('module', 'layertype')).toBeNull()
        expect(surfaceOfModuleKey('map', 'layertype')).toBe('map')
        expect(surfaceOfModuleKey('globe.cesium', 'layertype')).toBe('globe')
    })

    test('a nested globe declaration flattens to one key per engine', () => {
        expect(
            flattenLayerModules({
                modules: {
                    map: './map',
                    globe: { cesium: './globe/cesium' },
                },
            })
        ).toEqual({ map: './map', 'globe.cesium': './globe/cesium' })
        expect(flattenLayerModules({ module: './x' })).toEqual({
            module: './x',
        })
    })

    test('every attachment module resolves to the one attachment surface', () => {
        // An attachment is one renderable even when it straddles both engines.
        expect(surfaceOfModuleKey('module', 'layerattachment')).toBe(
            'attachment'
        )
        expect(surfaceOfModuleKey('map', 'layerattachment')).toBe('attachment')
        expect(ATTACHMENT_OPS).toContain('setVisibility')
        expect(ATTACHMENT_OPS).toContain('setOpacity')
        // A toggled host reaches its attachments as setVisibility, so there is
        // no separate host-toggle op.
        expect(ATTACHMENT_OPS).not.toContain('onHostToggle')
    })
})
