/**
 * Unit tests for InteractionRunner — runInteractions() and kindToInteractions().
 *
 * These tests use mock handlers rather than the real interaction plugins
 * to keep them fast and free of browser dependencies.
 */

import { test, expect } from '@playwright/test';

const {
    runInteractions,
    kindToInteractions,
    KIND_PIPELINES,
} = require('../../src/essence/Basics/InteractionRunner');

test.describe('kindToInteractions', () => {
    test('translates "none" to default click pipeline', () => {
        const result = kindToInteractions('none');
        expect(result.click).toEqual(KIND_PIPELINES.none);
        expect(result.click).toContain('select');
        expect(result.click).toContain('info:silent');
        expect(result.click).toContain('viewer:update');
        expect(result.click).toContain('search:url');
        expect(result.click).toContain('event:notify');
    });

    test('translates "info" — uses info:open instead of info:silent', () => {
        const result = kindToInteractions('info');
        expect(result.click).toContain('info:open');
        expect(result.click).not.toContain('info:silent');
    });

    test('translates "waypoint" — includes waypoint:image and waypoint:model', () => {
        const result = kindToInteractions('waypoint');
        expect(result.click).toContain('waypoint:image');
        expect(result.click).toContain('waypoint:model');
        expect(result.click).toContain('info:silent');
    });

    test('translates "chemistry_tool" — includes chemistry:use', () => {
        const result = kindToInteractions('chemistry_tool');
        expect(result.click).toContain('chemistry:use');
    });

    test('translates "draw_tool" — includes draw:context_menu', () => {
        const result = kindToInteractions('draw_tool');
        expect(result.click).toContain('draw:context_menu');
    });

    test('translates "viewer_open" — includes viewer:open_panel', () => {
        const result = kindToInteractions('viewer_open');
        expect(result.click).toContain('viewer:open_panel');
    });

    test('unknown kind falls back to "none" pipeline', () => {
        const result = kindToInteractions('nonexistent_kind');
        expect(result.click).toEqual(KIND_PIPELINES.none);
    });

    test('always includes hover and mouseout pipelines', () => {
        const result = kindToInteractions('info');
        expect(result.hover).toEqual(['cursor:show']);
        expect(result.mouseout).toEqual(['cursor:hide']);
    });

    test('all pipeline entries start with select', () => {
        for (const kind of Object.keys(KIND_PIPELINES)) {
            expect(KIND_PIPELINES[kind][0]).toBe('select');
        }
    });

    test('all pipelines contain cleanup_temp after select', () => {
        for (const kind of Object.keys(KIND_PIPELINES)) {
            const pipeline = KIND_PIPELINES[kind];
            const selectIdx = pipeline.indexOf('select');
            const cleanupIdx = pipeline.indexOf('cleanup_temp');
            expect(cleanupIdx).toBeGreaterThan(selectIdx);
        }
    });
});

test.describe('runInteractions', () => {
    test('runs handlers in order and passes context', async () => {
        const callOrder = [];
        const mockHandlers = {
            'a': { use(ctx) { callOrder.push('a'); ctx.state.aRan = true; } },
            'b': { use(ctx) { callOrder.push('b'); expect(ctx.state.aRan).toBe(true); } },
        };

        const ctx = { stop: false, state: {} };
        await runInteractions(['a', 'b'], ctx, mockHandlers);

        expect(callOrder).toEqual(['a', 'b']);
    });

    test('stops pipeline when ctx.stop is set', async () => {
        const callOrder = [];
        const mockHandlers = {
            'a': { use(ctx) { callOrder.push('a'); ctx.stop = true; } },
            'b': { use(ctx) { callOrder.push('b'); } },
        };

        const ctx = { stop: false, state: {} };
        await runInteractions(['a', 'b'], ctx, mockHandlers);

        expect(callOrder).toEqual(['a']);
    });

    test('skips unknown interaction IDs without throwing', async () => {
        const callOrder = [];
        const mockHandlers = {
            'a': { use(ctx) { callOrder.push('a'); } },
        };

        const ctx = { stop: false, state: {} };
        // 'unknown' is not in mockHandlers — should be skipped
        await runInteractions(['a', 'unknown', 'a'], ctx, mockHandlers);

        expect(callOrder).toEqual(['a', 'a']);
    });

    test('handles async handlers', async () => {
        const callOrder = [];
        const mockHandlers = {
            'async_a': {
                async use(ctx) {
                    await new Promise((r) => setTimeout(r, 10));
                    callOrder.push('async_a');
                },
            },
            'sync_b': {
                use(ctx) { callOrder.push('sync_b'); },
            },
        };

        const ctx = { stop: false, state: {} };
        await runInteractions(['async_a', 'sync_b'], ctx, mockHandlers);

        expect(callOrder).toEqual(['async_a', 'sync_b']);
    });

    test('runs with empty pipeline without error', async () => {
        const ctx = { stop: false, state: {} };
        await runInteractions([], ctx, {});
        // No error, no-op
    });

    test('shares mutable state between handlers', async () => {
        const mockHandlers = {
            'writer': { use(ctx) { ctx.state.value = 42; } },
            'reader': { use(ctx) { ctx.state.readValue = ctx.state.value; } },
        };

        const ctx = { stop: false, state: {} };
        await runInteractions(['writer', 'reader'], ctx, mockHandlers);

        expect(ctx.state.readValue).toBe(42);
    });
});
