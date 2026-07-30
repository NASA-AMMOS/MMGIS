/**
 * Unit tests for the layer-type plugin registry.
 *
 *  1. Per-type smoke: every built-in layer type is present in the generated
 *     `configure/public/layerTypeConfigs.json` with a contract-valid manifest
 *     and an embedded metaconfig, keyed by its stable typeId.
 *
 *  2. New-type flow: scaffolding a layer type with the plugin CLI and running
 *     updateLayerTypes() registers it into the generated registry — i.e. a
 *     freshly-created layer type "works" end-to-end through discovery.
 *
 * The second suite regenerates the real registry (like updateTools.spec.js),
 * so it cleans up the fixture container and regenerates the standard set in
 * afterEach to leave the working tree untouched.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { validatePluginConfig } = require('../../API/pluginValidation');
const { updateLayerTypes } = require('../../API/updateTools');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'plugins', 'plugin-cli.js');
const REGISTRY_PATH = path.join(
    REPO_ROOT,
    'configure',
    'public',
    'layerTypeConfigs.json'
);

const BUILT_IN_TYPES = [
    '3dtiles',
    'data',
    'header',
    'image',
    'model',
    'query',
    'tile',
    'vector',
    'vectortile',
    'velocity',
    'video',
];

test.describe('layerTypeConfigs.json — built-in layer type registry', () => {
    test('every built-in type is registered with a valid manifest + metaconfig', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

        for (const typeId of BUILT_IN_TYPES) {
            const entry = registry[typeId];
            expect(entry, `registry entry for '${typeId}'`).toBeDefined();

            // Entry shape: { manifest, metaconfig }.
            expect(entry.manifest, `manifest for '${typeId}'`).toBeDefined();
            expect(entry.metaconfig, `metaconfig for '${typeId}'`).toBeTruthy();

            // Keyed by its own stable id.
            expect(entry.manifest.typeId).toBe(typeId);
            expect(entry.manifest.type).toBe('layertype');

            // Manifest still satisfies the layertype contract validator.
            expect(
                validatePluginConfig(entry.manifest, entry.manifest.name, 'layertype')
            ).toEqual([]);
        }
    });

    test('registry contains no unexpected layer types', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        expect(Object.keys(registry).sort()).toEqual([...BUILT_IN_TYPES].sort());
    });
});

test.describe.serial('updateLayerTypes — a scaffolded layer type registers', () => {
    const CONTAINER = 'mmgis-test';
    const CONTAINER_DIR = path.join(REPO_ROOT, 'plugins', CONTAINER);

    test.afterEach(() => {
        // Remove the fixture container and regenerate the standard registry so
        // the dev tree / subsequent tests see a clean layerTypeConfigs.json.
        fs.rmSync(CONTAINER_DIR, { recursive: true, force: true });
        try {
            updateLayerTypes();
        } catch {
            // swallow — cleanup only
        }
    });

    test('create layertype + updateLayerTypes() adds it to the registry', () => {
        execSync(
            `node "${CLI_PATH}" create layertype ScaffoldSmoke --container ${CONTAINER}`,
            { cwd: REPO_ROOT, encoding: 'utf8' }
        );

        updateLayerTypes();

        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        const entry = registry.scaffoldsmoke;
        expect(entry).toBeDefined();
        expect(entry.manifest.name).toBe('ScaffoldSmoke');
        expect(entry.manifest.typeId).toBe('scaffoldsmoke');
        // The scaffold's metaconfig is embedded so Configure can render its form.
        expect(entry.metaconfig).toBeTruthy();
        expect(entry.metaconfig.tabs).toBeDefined();
        // Built-ins remain registered alongside the new type.
        expect(registry.vector).toBeDefined();
    });
});
