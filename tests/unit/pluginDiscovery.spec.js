/**
 * Unit tests for discoverPlugins()
 * from API/pluginDiscovery.js.
 *
 * Tests build a temporary directory tree and use it as the base path
 * for the discovery functions. Each test cleans up the tree afterwards.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { discoverPlugins } = require('../../API/pluginDiscovery');

function makeTmpDir() {
    const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mmgis-plugin-discovery-')
    );
    return tmp;
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // ignore — best-effort cleanup
    }
}

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

test.describe('discoverPlugins', () => {
    test('scans plugins/<repo>/<type>/<PluginName>/<configFile> three-level structure', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'tools', 'Draw', 'plugin.json'),
                JSON.stringify({ name: 'Draw', paths: { DrawTool: 'x' } })
            );
            writeFile(
                path.join(root, 'core', 'tools', 'Info', 'plugin.json'),
                JSON.stringify({ name: 'Info', paths: { InfoTool: 'y' } })
            );

            const out = discoverPlugins(root, 'tools', 'plugin.json');
            const names = out.map((p) => p.name).sort();
            expect(names).toEqual(['Draw', 'Info']);
            expect(out[0].container).toBe('core');
        } finally {
            rmDir(root);
        }
    });

    test('core is always scanned first, then alphabetical', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'zebra-plugin', 'tools', 'ZebraTool', 'plugin.json'),
                JSON.stringify({ name: 'ZebraTool', paths: { Z: 'z' } })
            );
            writeFile(
                path.join(root, 'core', 'tools', 'CoreTool', 'plugin.json'),
                JSON.stringify({ name: 'CoreTool', paths: { C: 'c' } })
            );
            writeFile(
                path.join(root, 'alpha-plugin', 'tools', 'AlphaTool', 'plugin.json'),
                JSON.stringify({ name: 'AlphaTool', paths: { A: 'a' } })
            );

            const out = discoverPlugins(root, 'tools', 'plugin.json');
            // core first, then alpha, then zebra
            expect(out[0].container).toBe('core');
            expect(out[1].container).toBe('alpha-plugin');
            expect(out[2].container).toBe('zebra-plugin');
        } finally {
            rmDir(root);
        }
    });

    test('skips repo dirs without the requested type subdirectory', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'tools', 'Draw', 'plugin.json'),
                JSON.stringify({ name: 'Draw', paths: { D: 'd' } })
            );
            // 'other' has backend/ but not tools/
            writeFile(
                path.join(root, 'other', 'backend', 'Utils', 'setup.js'),
                'module.exports = {};'
            );

            const out = discoverPlugins(root, 'tools', 'plugin.json');
            expect(out.length).toBe(1);
            expect(out[0].name).toBe('Draw');
        } finally {
            rmDir(root);
        }
    });

    test('skips underscore- and dot-prefixed repo dirs', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, '_disabled', 'tools', 'X', 'plugin.json'),
                JSON.stringify({ name: 'X' })
            );
            writeFile(
                path.join(root, '.hidden', 'tools', 'Y', 'plugin.json'),
                JSON.stringify({ name: 'Y' })
            );
            writeFile(
                path.join(root, 'active', 'tools', 'Z', 'plugin.json'),
                JSON.stringify({ name: 'Z', paths: { Z: 'z' } })
            );

            const out = discoverPlugins(root, 'tools', 'plugin.json');
            expect(out.map((p) => p.name)).toEqual(['Z']);
        } finally {
            rmDir(root);
        }
    });

    test('returns empty array when pluginsRoot does not exist', () => {
        const out = discoverPlugins(
            '/nonexistent/path/that/should/not/exist',
            'tools',
            'plugin.json'
        );
        expect(out).toEqual([]);
    });

    test('loader=require works for backend setup.js', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'backend', 'Echo', 'setup.js'),
                'module.exports = { priority: 5, marker: "ok" };'
            );
            const out = discoverPlugins(root, 'backend', 'setup.js', {
                loader: 'require',
            });
            expect(out.length).toBe(1);
            expect(out[0].manifest.marker).toBe('ok');
            expect(out[0].manifest.priority).toBe(5);
        } finally {
            rmDir(root);
        }
    });
});
