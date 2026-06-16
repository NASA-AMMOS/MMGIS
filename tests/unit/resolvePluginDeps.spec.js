/**
 * Unit tests for scripts/resolve-plugin-deps.js.
 *
 * Tests are pure JS — they exercise the in-memory merge helpers
 * (`mergeNpm`, `mergePython`) directly and verify the conflict
 * detection logic without touching the live source tree.
 */

import { test, expect } from '@playwright/test';

const {
    mergeNpm,
    mergePython,
    checkPeerDependencies,
} = require('../../scripts/resolve-plugin-deps');

// Local dedup helper that mirrors the inline logic in gatherDependencies().
// Used to test override semantics (last entry with same name wins).
function dedup(plugins) {
    const byName = new Map();
    for (const p of plugins) byName.set(p.name, p);
    return Array.from(byName.values());
}

test.describe('mergeNpm', () => {
    test('merges non-conflicting npm deps across plugins', () => {
        const sources = [
            {
                plugin: 'tool:A',
                deps: { npm: { lodash: '^4.17.0', moment: '^2.29.0' } },
            },
            { plugin: 'tool:B', deps: { npm: { chalk: '^5.0.0' } } },
        ];
        const { merged, conflicts } = mergeNpm(sources);
        expect(conflicts).toEqual([]);
        expect(merged).toEqual({
            lodash: '^4.17.0',
            moment: '^2.29.0',
            chalk: '^5.0.0',
        });
    });

    test('identical versions across plugins do not conflict', () => {
        const sources = [
            { plugin: 'tool:A', deps: { npm: { lodash: '^4.17.0' } } },
            { plugin: 'tool:B', deps: { npm: { lodash: '^4.17.0' } } },
        ];
        const { conflicts } = mergeNpm(sources);
        expect(conflicts).toEqual([]);
    });

    test('different versions of the same npm package conflict', () => {
        const sources = [
            { plugin: 'tool:A', deps: { npm: { lodash: '^4.17.0' } } },
            { plugin: 'tool:B', deps: { npm: { lodash: '^3.0.0' } } },
        ];
        const { conflicts } = mergeNpm(sources);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0].package).toBe('lodash');
        expect(conflicts[0].kind).toBe('npm');
        expect(conflicts[0].claims.length).toBe(2);
    });

    test('plugins without npm deps are ignored', () => {
        const sources = [
            { plugin: 'tool:A', deps: null },
            { plugin: 'tool:B', deps: { python: { pip: ['x==1'] } } },
            { plugin: 'tool:C', deps: { npm: { ok: '1.0.0' } } },
        ];
        const { merged } = mergeNpm(sources);
        expect(merged).toEqual({ ok: '1.0.0' });
    });
});

test.describe('mergePython', () => {
    test('merges non-conflicting pip deps', () => {
        const sources = [
            {
                plugin: 'tool:A',
                deps: { python: { pip: ['requests==2.32.3'] } },
            },
            {
                plugin: 'tool:B',
                deps: { python: { pip: ['spiceypy==5.1.2'] } },
            },
        ];
        const { merged, conflicts } = mergePython(sources, 'pip');
        expect(conflicts).toEqual([]);
        expect(merged.sort()).toEqual(['requests==2.32.3', 'spiceypy==5.1.2']);
    });

    test('identical pip entries across plugins do not conflict', () => {
        const sources = [
            { plugin: 'A', deps: { python: { pip: ['requests==2.32.3'] } } },
            { plugin: 'B', deps: { python: { pip: ['requests==2.32.3'] } } },
        ];
        const { conflicts, merged } = mergePython(sources, 'pip');
        expect(conflicts).toEqual([]);
        expect(merged).toEqual(['requests==2.32.3']);
    });

    test('different pip versions of the same package conflict', () => {
        const sources = [
            { plugin: 'A', deps: { python: { pip: ['requests==2.32.3'] } } },
            { plugin: 'B', deps: { python: { pip: ['requests==2.30.0'] } } },
        ];
        const { conflicts } = mergePython(sources, 'pip');
        expect(conflicts.length).toBe(1);
        expect(conflicts[0].package).toBe('requests');
    });

    test('merges conda deps independently from pip deps', () => {
        const sources = [
            {
                plugin: 'A',
                deps: { python: { conda: ['gdal==3.12.2', 'rasterio'] } },
            },
        ];
        const { merged: pipMerged } = mergePython(sources, 'pip');
        const { merged: condaMerged } = mergePython(sources, 'conda');
        expect(pipMerged).toEqual([]);
        expect(condaMerged.sort()).toEqual(['gdal==3.12.2', 'rasterio']);
    });

    test('plugins without python deps are ignored', () => {
        const sources = [
            { plugin: 'A', deps: { npm: { lodash: '^4.0' } } },
            { plugin: 'B', deps: { python: {} } },
            { plugin: 'C', deps: { python: { pip: ['ok==1.0'] } } },
        ];
        const { merged } = mergePython(sources, 'pip');
        expect(merged).toEqual(['ok==1.0']);
    });

    test('package name extraction handles >=, ~, and bare entries', () => {
        const sources = [
            {
                plugin: 'A',
                deps: { python: { pip: ['requests>=2.0', 'flask'] } },
            },
            {
                plugin: 'B',
                deps: { python: { pip: ['requests~=2.30'] } },
            },
        ];
        const { conflicts } = mergePython(sources, 'pip');
        // Both `requests>=2.0` and `requests~=2.30` resolve to the
        // same package name but with different specifiers, so they
        // should conflict.
        expect(conflicts.some((c) => c.package === 'requests')).toBe(true);
    });
});

test.describe('dedup override semantics', () => {
    test('later entry with same name overrides earlier entry', () => {
        const all = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.12.10' } } } },
            { name: 'Draw', manifest: { dependencies: null } },
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.13.0' } } } },
        ];
        const winners = dedup(all);
        // 'Animation' should now be the later entry (^0.13.0), and
        // 'Draw' should still be present.
        expect(winners.length).toBe(2);
        const animation = winners.find((w) => w.name === 'Animation');
        expect(animation.manifest.dependencies.npm['@ffmpeg/ffmpeg']).toBe('^0.13.0');
        const draw = winners.find((w) => w.name === 'Draw');
        expect(draw).toBeTruthy();
    });

    test('dedup avoids spurious conflict that raw list would produce', () => {
        const all = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.12.10' } } } },
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.13.0' } } } },
        ];

        // Naive non-deduped list would aggregate both versions and conflict.
        const concatSources = all.map((p) => ({
            plugin: `tool:${p.name}`,
            deps: p.manifest.dependencies,
        }));
        const concatResult = mergeNpm(concatSources);
        expect(concatResult.conflicts.length).toBe(1);

        // dedup picks only the last entry; no conflict.
        const winnerSources = dedup(all).map((p) => ({
            plugin: `tool:${p.name}`,
            deps: p.manifest.dependencies,
        }));
        const winnerResult = mergeNpm(winnerSources);
        expect(winnerResult.conflicts).toEqual([]);
        expect(winnerResult.merged['@ffmpeg/ffmpeg']).toBe('^0.13.0');
    });

    test('entries with unique names are all preserved', () => {
        const all = [
            { name: 'A', manifest: {} },
            { name: 'B', manifest: {} },
            { name: 'C', manifest: {} },
        ];
        const winners = dedup(all);
        expect(winners.map((w) => w.name).sort()).toEqual(['A', 'B', 'C']);
    });
});

test.describe('semver-aware mergeNpm', () => {
    test('compatible ranges do not conflict', () => {
        const sources = [
            { plugin: 'tool:A', deps: { npm: { lodash: '^4.17.0' } } },
            { plugin: 'tool:B', deps: { npm: { lodash: '^4.18.0' } } },
        ];
        const { conflicts } = mergeNpm(sources);
        expect(conflicts).toEqual([]);
    });

    test('incompatible ranges produce a conflict', () => {
        const sources = [
            { plugin: 'tool:A', deps: { npm: { lodash: '^3.0.0' } } },
            { plugin: 'tool:B', deps: { npm: { lodash: '^4.0.0' } } },
        ];
        const { conflicts } = mergeNpm(sources);
        expect(conflicts.length).toBe(1);
        expect(conflicts[0].package).toBe('lodash');
    });

    test('identical versions never conflict', () => {
        const sources = [
            { plugin: 'tool:A', deps: { npm: { chalk: '^5.0.0' } } },
            { plugin: 'tool:B', deps: { npm: { chalk: '^5.0.0' } } },
        ];
        const { conflicts, merged } = mergeNpm(sources);
        expect(conflicts).toEqual([]);
        expect(merged.chalk).toBe('^5.0.0');
    });
});

test.describe('checkPeerDependencies', () => {
    test('returns empty when all peers are satisfied', () => {
        const plugins = [
            { name: 'Draw', manifest: { id: 'core-draw', version: '5.1.4' } },
            { name: 'Sightline', manifest: { id: 'core-sightline', version: '5.1.4', peerDependencies: { 'core-draw': '>=5.0.0' } } },
        ];
        const warnings = checkPeerDependencies(plugins);
        expect(warnings).toEqual([]);
    });

    test('warns when peer plugin is missing', () => {
        const plugins = [
            { name: 'Sightline', manifest: { id: 'core-sightline', version: '5.1.4', peerDependencies: { 'core-draw': '>=5.0.0' } } },
        ];
        const warnings = checkPeerDependencies(plugins);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('not installed');
    });

    test('warns when peer version is incompatible', () => {
        const plugins = [
            { name: 'Draw', manifest: { id: 'core-draw', version: '4.0.0' } },
            { name: 'Sightline', manifest: { id: 'core-sightline', version: '5.1.4', peerDependencies: { 'core-draw': '>=5.0.0' } } },
        ];
        const warnings = checkPeerDependencies(plugins);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('requires peer');
    });
});
