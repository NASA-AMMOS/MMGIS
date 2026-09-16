/**
 * Unit tests for interaction plugin discovery via discoverPlugins().
 *
 * Validates that the "interactions" type is scanned correctly by the
 * existing discovery infrastructure.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { discoverPlugins } = require('../../API/pluginDiscovery');

function makeTmpDir() {
    return fs.mkdtempSync(
        path.join(os.tmpdir(), 'mmgis-interaction-discovery-')
    );
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // best-effort cleanup
    }
}

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

test.describe('discoverPlugins - interactions type', () => {
    test('discovers interaction plugins under plugins/<container>/interactions/', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'interactions', 'Select', 'plugin.json'),
                JSON.stringify({
                    name: 'Select',
                    interactionId: 'select',
                    paths: { Select: './Select' },
                })
            );
            writeFile(
                path.join(root, 'core', 'interactions', 'InfoOpen', 'plugin.json'),
                JSON.stringify({
                    name: 'InfoOpen',
                    interactionId: 'info:open',
                    paths: { InfoOpen: './InfoOpen' },
                })
            );

            const out = discoverPlugins(root, 'interactions', 'plugin.json');
            const names = out.map((p) => p.name).sort();
            expect(names).toEqual(['InfoOpen', 'Select']);
            expect(out[0].container).toBe('core');
        } finally {
            rmDir(root);
        }
    });

    test('external container interactions are discovered after core', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'interactions', 'Select', 'plugin.json'),
                JSON.stringify({
                    name: 'Select',
                    interactionId: 'select',
                    paths: { Select: './Select' },
                })
            );
            writeFile(
                path.join(root, 'mission-x', 'interactions', 'CustomClick', 'plugin.json'),
                JSON.stringify({
                    name: 'CustomClick',
                    interactionId: 'custom:click',
                    paths: { CustomClick: './CustomClick' },
                })
            );

            const out = discoverPlugins(root, 'interactions', 'plugin.json');
            expect(out[0].container).toBe('core');
            expect(out[0].name).toBe('Select');
            expect(out[1].container).toBe('mission-x');
            expect(out[1].name).toBe('CustomClick');
        } finally {
            rmDir(root);
        }
    });

    test('returns empty array when no interactions directory exists', () => {
        const root = makeTmpDir();
        try {
            // Only create a tools directory, no interactions
            writeFile(
                path.join(root, 'core', 'tools', 'Draw', 'plugin.json'),
                JSON.stringify({ name: 'Draw', paths: { D: 'd' } })
            );

            const out = discoverPlugins(root, 'interactions', 'plugin.json');
            expect(out).toEqual([]);
        } finally {
            rmDir(root);
        }
    });

    test('interaction manifest fields are preserved in discovery output', () => {
        const root = makeTmpDir();
        try {
            const manifest = {
                name: 'DrawContextMenu',
                type: 'interaction',
                interactionId: 'draw:context_menu',
                applicableLayerTypes: ['vector'],
                applicableEvents: ['click'],
                pluginDependencies: ['core/tools/Draw'],
                paths: { DrawContextMenu: './DrawContextMenu' },
            };
            writeFile(
                path.join(root, 'core', 'interactions', 'DrawContextMenu', 'plugin.json'),
                JSON.stringify(manifest)
            );

            const out = discoverPlugins(root, 'interactions', 'plugin.json');
            expect(out.length).toBe(1);
            expect(out[0].manifest.interactionId).toBe('draw:context_menu');
            expect(out[0].manifest.pluginDependencies).toEqual(['core/tools/Draw']);
            expect(out[0].manifest.applicableLayerTypes).toEqual(['vector']);
        } finally {
            rmDir(root);
        }
    });
});
