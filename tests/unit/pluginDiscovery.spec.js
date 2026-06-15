/**
 * Unit tests for discoverPlugins() and discoverPluginsUnified()
 * from API/pluginDiscovery.js.
 *
 * Tests build a temporary directory tree and use it as the base path
 * for the discovery functions. Each test cleans up the tree afterwards.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { discoverPlugins, discoverPluginsUnified } = require('../../API/pluginDiscovery');

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
    test('finds plugins under containers matching substring patterns', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'FooTool', 'config.json'),
                JSON.stringify({ name: 'FooTool', paths: { FooTool: 'a' } })
            );
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'BarTool', 'config.json'),
                JSON.stringify({ name: 'BarTool', paths: { BarTool: 'b' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            const names = out.map((p) => p.name).sort();
            expect(names).toEqual(['BarTool', 'FooTool']);
            const fooCfg = out.find((p) => p.name === 'FooTool').manifest;
            expect(fooCfg.name).toBe('FooTool');
        } finally {
            rmDir(root);
        }
    });

    test('skips containers not matching the patterns', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'Random-Other-Directory', 'Foo', 'config.json'),
                JSON.stringify({ name: 'Foo' })
            );
            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out).toEqual([]);
        } finally {
            rmDir(root);
        }
    });

    test('skips underscore-prefixed plugin subdirs', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'My-Plugin-Tools', '_disabled', 'config.json'),
                JSON.stringify({ name: '_disabled' })
            );
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'Active', 'config.json'),
                JSON.stringify({ name: 'Active', paths: { A: 'x' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out.map((p) => p.name)).toEqual(['Active']);
        } finally {
            rmDir(root);
        }
    });

    test('skips dot-prefixed plugin subdirs', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'My-Plugin-Tools', '.hidden', 'config.json'),
                JSON.stringify({ name: '.hidden' })
            );
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'Active', 'config.json'),
                JSON.stringify({ name: 'Active', paths: { A: 'x' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out.map((p) => p.name)).toEqual(['Active']);
        } finally {
            rmDir(root);
        }
    });

    test('skips underscore- and dot-prefixed container dirs', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, '_My-Plugin-Tools', 'A', 'config.json'),
                JSON.stringify({ name: 'A' })
            );
            writeFile(
                path.join(root, '.dot-Plugin-Tools', 'B', 'config.json'),
                JSON.stringify({ name: 'B' })
            );
            writeFile(
                path.join(root, 'OK-Plugin-Tools', 'C', 'config.json'),
                JSON.stringify({ name: 'C', paths: { C: 'x' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out.map((p) => p.name)).toEqual(['C']);
        } finally {
            rmDir(root);
        }
    });

    test('skips plugin subdirs without the requested manifest file', () => {
        const root = makeTmpDir();
        try {
            // Plugin without config.json
            fs.mkdirSync(
                path.join(root, 'My-Plugin-Tools', 'NoConfig'),
                { recursive: true }
            );
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'HasConfig', 'config.json'),
                JSON.stringify({ name: 'HasConfig', paths: { A: 'x' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out.map((p) => p.name)).toEqual(['HasConfig']);
        } finally {
            rmDir(root);
        }
    });

    test('returns empty array gracefully when base path does not exist', () => {
        const out = discoverPlugins(
            '/nonexistent/path/that/should/not/exist-mmgis-test',
            ['Plugin-Tools'],
            'config.json'
        );
        expect(out).toEqual([]);
    });

    test('returns empty array gracefully when container has no plugins', () => {
        const root = makeTmpDir();
        try {
            fs.mkdirSync(path.join(root, 'My-Plugin-Tools'), { recursive: true });
            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            expect(out).toEqual([]);
        } finally {
            rmDir(root);
        }
    });

    test('exact-name patterns require an exact container name match', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'Tools', 'Foo', 'config.json'),
                JSON.stringify({ name: 'Foo', paths: { Foo: 'x' } })
            );
            writeFile(
                path.join(root, 'Plugin-Tools-Extra', 'Bar', 'config.json'),
                JSON.stringify({ name: 'Bar', paths: { Bar: 'y' } })
            );

            const out = discoverPlugins(root, ['__exact:Tools'], 'config.json');
            expect(out.map((p) => p.name)).toEqual(['Foo']);
        } finally {
            rmDir(root);
        }
    });

    test('handles missing manifest gracefully (parse failure)', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'BrokenJson', 'config.json'),
                '{ not: valid json'
            );
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'Good', 'config.json'),
                JSON.stringify({ name: 'Good', paths: { Good: 'x' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            // Broken JSON is skipped, good plugin still returned.
            expect(out.map((p) => p.name)).toEqual(['Good']);
        } finally {
            rmDir(root);
        }
    });

    test('loader=none returns path without parsing', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'My-Plugin-Tools', 'Foo', 'config.json'),
                'arbitrary contents — not parsed'
            );
            const out = discoverPlugins(
                root,
                ['Plugin-Tools'],
                'config.json',
                { loader: 'none' }
            );
            expect(out.length).toBe(1);
            expect(out[0].manifest).toBeNull();
            expect(out[0].manifestPath.endsWith('config.json')).toBe(true);
        } finally {
            rmDir(root);
        }
    });

    test('loader=require can load setup.js modules', () => {
        const root = makeTmpDir();
        try {
            const setupJs = 'module.exports = { priority: 5, marker: "ok" };';
            writeFile(
                path.join(root, 'My-Plugin-Backend', 'Echo', 'setup.js'),
                setupJs
            );
            const out = discoverPlugins(
                root,
                ['Plugin-Backend'],
                'setup.js',
                { loader: 'require' }
            );
            expect(out.length).toBe(1);
            expect(out[0].manifest.marker).toBe('ok');
            expect(out[0].manifest.priority).toBe(5);
        } finally {
            rmDir(root);
        }
    });

    test('reports each container in the `container` field of results', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'Container-Plugin-Tools-A', 'X', 'config.json'),
                JSON.stringify({ name: 'X', paths: { X: 'x' } })
            );
            writeFile(
                path.join(root, 'Container-Plugin-Tools-B', 'Y', 'config.json'),
                JSON.stringify({ name: 'Y', paths: { Y: 'y' } })
            );

            const out = discoverPlugins(root, ['Plugin-Tools'], 'config.json');
            const sorted = out.sort((a, b) => a.name.localeCompare(b.name));
            expect(sorted[0].container).toBe('Container-Plugin-Tools-A');
            expect(sorted[1].container).toBe('Container-Plugin-Tools-B');
        } finally {
            rmDir(root);
        }
    });
});

test.describe('discoverPluginsUnified', () => {
    test('scans plugins/<repo>/<type>/<PluginName>/<configFile> three-level structure', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'tools', 'Draw', 'config.json'),
                JSON.stringify({ name: 'Draw', paths: { DrawTool: 'x' } })
            );
            writeFile(
                path.join(root, 'core', 'tools', 'Info', 'config.json'),
                JSON.stringify({ name: 'Info', paths: { InfoTool: 'y' } })
            );

            const out = discoverPluginsUnified(root, 'tools', 'config.json');
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
                path.join(root, 'zebra-plugin', 'tools', 'ZebraTool', 'config.json'),
                JSON.stringify({ name: 'ZebraTool', paths: { Z: 'z' } })
            );
            writeFile(
                path.join(root, 'core', 'tools', 'CoreTool', 'config.json'),
                JSON.stringify({ name: 'CoreTool', paths: { C: 'c' } })
            );
            writeFile(
                path.join(root, 'alpha-plugin', 'tools', 'AlphaTool', 'config.json'),
                JSON.stringify({ name: 'AlphaTool', paths: { A: 'a' } })
            );

            const out = discoverPluginsUnified(root, 'tools', 'config.json');
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
                path.join(root, 'core', 'tools', 'Draw', 'config.json'),
                JSON.stringify({ name: 'Draw', paths: { D: 'd' } })
            );
            // 'other' has backend/ but not tools/
            writeFile(
                path.join(root, 'other', 'backend', 'Utils', 'setup.js'),
                'module.exports = {};'
            );

            const out = discoverPluginsUnified(root, 'tools', 'config.json');
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
                path.join(root, '_disabled', 'tools', 'X', 'config.json'),
                JSON.stringify({ name: 'X' })
            );
            writeFile(
                path.join(root, '.hidden', 'tools', 'Y', 'config.json'),
                JSON.stringify({ name: 'Y' })
            );
            writeFile(
                path.join(root, 'active', 'tools', 'Z', 'config.json'),
                JSON.stringify({ name: 'Z', paths: { Z: 'z' } })
            );

            const out = discoverPluginsUnified(root, 'tools', 'config.json');
            expect(out.map((p) => p.name)).toEqual(['Z']);
        } finally {
            rmDir(root);
        }
    });

    test('returns empty array when pluginsRoot does not exist', () => {
        const out = discoverPluginsUnified(
            '/nonexistent/path/that/should/not/exist',
            'tools',
            'config.json'
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
            const out = discoverPluginsUnified(root, 'backend', 'setup.js', {
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
