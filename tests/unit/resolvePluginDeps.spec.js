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
    winnersByName,
} = require('../../scripts/resolve-plugin-deps');

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

test.describe('winnersByName (override semantics)', () => {
    test('plugin entry with same name overrides standard entry', () => {
        const standard = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.12.10' } } } },
            { name: 'Draw', manifest: { dependencies: null } },
        ];
        const overrides = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.13.0' } } } },
        ];
        const winners = winnersByName(standard, overrides);
        // 'Animation' should now be the override entry (^0.13.0), and
        // 'Draw' (only in standard) should still be present.
        expect(winners.length).toBe(2);
        const animation = winners.find((w) => w.name === 'Animation');
        expect(animation.manifest.dependencies.npm['@ffmpeg/ffmpeg']).toBe('^0.13.0');
        const draw = winners.find((w) => w.name === 'Draw');
        expect(draw).toBeTruthy();
    });

    test('override avoids spurious conflict that concat would produce', () => {
        const standard = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.12.10' } } } },
        ];
        const overrides = [
            { name: 'Animation', manifest: { dependencies: { npm: { '@ffmpeg/ffmpeg': '^0.13.0' } } } },
        ];

        // Naive concat would aggregate both versions and conflict.
        const concatSources = standard.concat(overrides).map((p) => ({
            plugin: `tool:${p.name}`,
            deps: p.manifest.dependencies,
        }));
        const concatResult = mergeNpm(concatSources);
        expect(concatResult.conflicts.length).toBe(1);

        // winnersByName picks only the override; no conflict.
        const winnerSources = winnersByName(standard, overrides).map((p) => ({
            plugin: `tool:${p.name}`,
            deps: p.manifest.dependencies,
        }));
        const winnerResult = mergeNpm(winnerSources);
        expect(winnerResult.conflicts).toEqual([]);
        expect(winnerResult.merged['@ffmpeg/ffmpeg']).toBe('^0.13.0');
    });

    test('entries unique to either side are preserved', () => {
        const standard = [
            { name: 'A', manifest: {} },
            { name: 'B', manifest: {} },
        ];
        const overrides = [
            { name: 'C', manifest: {} },
        ];
        const winners = winnersByName(standard, overrides);
        expect(winners.map((w) => w.name).sort()).toEqual(['A', 'B', 'C']);
    });
});
