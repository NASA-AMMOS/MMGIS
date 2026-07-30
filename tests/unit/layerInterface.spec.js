/**
 * Unit tests for LayerInterface — the layer-type plugin renderer contract +
 * dispatcher. Covers normalizeOp/getPhase/hasOp shorthand handling and the
 * run() phase pipeline (before → main ?? coreDefault → after), including the
 * always-async return shape that GlobeRenderer.addLayer/Map_ rely on.
 */

import { test, expect } from '@playwright/test';

const {
    normalizeOp,
    getPhase,
    hasOp,
    run,
    LAYER_OPS,
    OP_PHASES,
    MAKE_EXTRA_PHASES,
} = require('../../src/essence/Basics/Layers_/LayerInterface');

test.describe('LayerInterface constants', () => {
    test('canonical operation + phase vocabulary is stable', () => {
        expect(LAYER_OPS).toEqual([
            'load',
            'make',
            'destroy',
            'setOpacity',
            'setVisibility',
            'setStyle',
            'timeChange',
        ]);
        expect(OP_PHASES).toEqual(['before', 'main', 'after']);
        expect(MAKE_EXTRA_PHASES).toEqual(['afterCommit']);
    });
});

test.describe('normalizeOp / getPhase / hasOp', () => {
    test('a bare function is sugar for { main: fn }', () => {
        const fn = () => {};
        expect(normalizeOp(fn)).toEqual({ main: fn });
    });

    test('a phase object passes through unchanged', () => {
        const op = { before() {}, main() {} };
        expect(normalizeOp(op)).toBe(op);
    });

    test('null/undefined/invalid normalize to null', () => {
        expect(normalizeOp(null)).toBeNull();
        expect(normalizeOp(undefined)).toBeNull();
        expect(normalizeOp(42)).toBeNull();
    });

    test('getPhase resolves shorthand main and named phases', () => {
        const main = () => {};
        const before = () => {};
        const shorthand = { make: main };
        const phased = { make: { before, main } };

        expect(getPhase(shorthand, 'make', 'main')).toBe(main);
        expect(getPhase(shorthand, 'make', 'before')).toBeNull();
        expect(getPhase(phased, 'make', 'before')).toBe(before);
        expect(getPhase(phased, 'make', 'main')).toBe(main);
        // Non-function phase values resolve to null.
        expect(getPhase({ make: { main: 'nope' } }, 'make', 'main')).toBeNull();
        expect(getPhase(null, 'make', 'main')).toBeNull();
    });

    test('hasOp detects any defined operation, including shorthand', () => {
        expect(hasOp({ make: () => {} }, 'make')).toBe(true);
        expect(hasOp({ make: { after() {} } }, 'make')).toBe(true);
        expect(hasOp({ make: () => {} }, 'destroy')).toBe(false);
        expect(hasOp(null, 'make')).toBe(false);
    });
});

test.describe('run() pipeline', () => {
    test('runs before → main → after in order and returns main result', async () => {
        const calls = [];
        const surfaceModule = {
            make: {
                before() {
                    calls.push('before');
                },
                main() {
                    calls.push('main');
                    return 'handle';
                },
                after() {
                    calls.push('after');
                },
            },
        };

        const result = await run(surfaceModule, 'make', ['arg']);
        expect(calls).toEqual(['before', 'main', 'after']);
        expect(result).toBe('handle');
    });

    test('falls back to coreDefault when the plugin defines no main', async () => {
        const calls = [];
        const surfaceModule = {
            make: {
                before() {
                    calls.push('before');
                },
                after() {
                    calls.push('after');
                },
            },
        };

        const result = await run(surfaceModule, 'make', [], {
            coreDefault() {
                calls.push('coreDefault');
                return 'core-handle';
            },
        });

        // before/after still wrap the core default.
        expect(calls).toEqual(['before', 'coreDefault', 'after']);
        expect(result).toBe('core-handle');
    });

    test('plugin main overrides coreDefault (default not called)', async () => {
        let coreCalled = false;
        const result = await run({ make: () => 'plugin' }, 'make', [], {
            coreDefault() {
                coreCalled = true;
                return 'core';
            },
        });
        expect(result).toBe('plugin');
        expect(coreCalled).toBe(false);
    });

    test('always returns a Promise and awaits async phases in order', async () => {
        const calls = [];
        const surfaceModule = {
            make: {
                async before() {
                    await Promise.resolve();
                    calls.push('before');
                },
                async main() {
                    await Promise.resolve();
                    calls.push('main');
                    return 'async-handle';
                },
            },
        };

        const ret = run(surfaceModule, 'make', []);
        expect(typeof ret.then).toBe('function');
        expect(await ret).toBe('async-handle');
        expect(calls).toEqual(['before', 'main']);
    });

    test('with neither main nor coreDefault, resolves undefined but still runs before/after', async () => {
        const calls = [];
        const result = await run(
            {
                setStyle: {
                    before() {
                        calls.push('before');
                    },
                    after() {
                        calls.push('after');
                    },
                },
            },
            'setStyle',
            []
        );
        expect(result).toBeUndefined();
        expect(calls).toEqual(['before', 'after']);
    });

    test('a rejecting phase rejects the returned Promise', async () => {
        const surfaceModule = {
            make() {
                throw new Error('boom');
            },
        };
        await expect(run(surfaceModule, 'make', [])).rejects.toThrow('boom');
    });

    test('afterCommit is NOT run by run() (driven by the caller post-lock)', async () => {
        let afterCommitCalled = false;
        await run(
            {
                make: {
                    main() {
                        return 'h';
                    },
                    afterCommit() {
                        afterCommitCalled = true;
                    },
                },
            },
            'make',
            []
        );
        expect(afterCommitCalled).toBe(false);
    });
});
