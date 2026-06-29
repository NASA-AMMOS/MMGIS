/**
 * Unit tests for interaction plugin validation in API/pluginValidation.js.
 *
 * Validates that the "interaction" plugin type is properly recognized and
 * its required fields (name, interactionId, paths) are enforced.
 */

import { test, expect } from '@playwright/test';

const { validatePluginConfig } = require('../../API/pluginValidation');

test.describe('validatePluginConfig - interaction plugins', () => {
    test('valid minimal interaction config returns no errors', () => {
        const config = {
            name: 'Select',
            interactionId: 'select',
            paths: { Select: './Select' },
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors).toEqual([]);
    });

    test('valid full interaction config returns no errors', () => {
        const config = {
            uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            id: 'core-interaction-select',
            version: 'core',
            type: 'interaction',
            tier: 'core',
            overridable: true,
            name: 'Select',
            interactionId: 'select',
            description: 'Sets the active feature.',
            applicableLayerTypes: ['vector', 'vectortile', 'query'],
            applicableEvents: ['click'],
            paths: { Select: './Select' },
            author: 'NASA-AMMOS/MMGIS',
            license: 'Apache-2.0',
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors).toEqual([]);
    });

    test('rejects missing name', () => {
        const config = {
            interactionId: 'select',
            paths: { Select: './Select' },
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors.some((e) => e.includes("'name'"))).toBe(true);
    });

    test('rejects missing interactionId', () => {
        const config = {
            name: 'Select',
            paths: { Select: './Select' },
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors.some((e) => e.includes("'interactionId'"))).toBe(true);
    });

    test('rejects empty interactionId', () => {
        const config = {
            name: 'Select',
            interactionId: '',
            paths: { Select: './Select' },
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors.some((e) => e.includes("'interactionId'"))).toBe(true);
    });

    test('rejects missing paths', () => {
        const config = {
            name: 'Select',
            interactionId: 'select',
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('rejects empty paths object', () => {
        const config = {
            name: 'Select',
            interactionId: 'select',
            paths: {},
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors.some((e) => e.includes("'paths'"))).toBe(true);
    });

    test('accepts interaction as valid type value in config.type', () => {
        const config = {
            name: 'Select',
            interactionId: 'select',
            type: 'interaction',
            paths: { Select: './Select' },
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors).toEqual([]);
    });

    test('unknown fields produce warnings, not errors', () => {
        const config = {
            name: 'Select',
            interactionId: 'select',
            paths: { Select: './Select' },
            futureField: 'some value',
        };
        const errors = validatePluginConfig(config, 'Select', 'interaction');
        expect(errors).toEqual([]);
    });

    test('pluginDependencies validated same as other types', () => {
        const config = {
            name: 'DrawContextMenu',
            interactionId: 'draw:context_menu',
            paths: { DrawContextMenu: './DrawContextMenu' },
            pluginDependencies: ['core/tools/Draw'],
        };
        const errors = validatePluginConfig(config, 'DrawContextMenu', 'interaction');
        expect(errors).toEqual([]);
    });

    test('rejects non-array pluginDependencies', () => {
        const config = {
            name: 'DrawContextMenu',
            interactionId: 'draw:context_menu',
            paths: { DrawContextMenu: './DrawContextMenu' },
            pluginDependencies: 'core/tools/Draw',
        };
        const errors = validatePluginConfig(config, 'DrawContextMenu', 'interaction');
        expect(errors.some((e) => e.includes("'pluginDependencies'"))).toBe(true);
    });
});

test.describe('validatePluginConfig - tool providesInteractions field', () => {
    test('accepts providesInteractions as a known tool field', () => {
        const config = {
            name: 'Draw',
            paths: { DrawTool: './DrawTool' },
            providesInteractions: ['core/interactions/DrawContextMenu'],
        };
        const errors = validatePluginConfig(config, 'Draw', 'tool');
        expect(errors).toEqual([]);
    });
});
