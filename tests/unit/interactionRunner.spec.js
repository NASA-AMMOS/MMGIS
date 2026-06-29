/**
 * Unit tests for InteractionRunner — runInteractions(), kindToInteractions(),
 * buildFullPipeline(), and default preamble/postamble behavior.
 *
 * These tests use mock handlers rather than the real interaction plugins
 * to keep them fast and free of browser dependencies.
 */

import { test, expect } from '@playwright/test';

const {
    runInteractions,
    kindToInteractions,
    buildFullPipeline,
    KIND_PIPELINES,
    CLICK_PREAMBLE,
    CLICK_POSTAMBLE,
    DEFAULT_HOVER_PIPELINE,
    DEFAULT_MOUSEOUT_PIPELINE,
} = require('../../src/essence/Basics/InteractionRunner');

test.describe('kindToInteractions', () => {
    test('"none" returns empty click pipeline (defaults are implicit)', () => {
        const result = kindToInteractions('none');
        expect(result.click).toEqual([]);
    });

    test('"info" returns only info:open', () => {
        const result = kindToInteractions('info');
        expect(result.click).toEqual(['info:open']);
    });

    test('"waypoint" returns waypoint:image and waypoint:model', () => {
        const result = kindToInteractions('waypoint');
        expect(result.click).toEqual(['waypoint:image', 'waypoint:model']);
    });

    test('"chemistry_tool" returns chemistry:use', () => {
        const result = kindToInteractions('chemistry_tool');
        expect(result.click).toEqual(['chemistry:use']);
    });

    test('"draw_tool" returns draw:context_menu', () => {
        const result = kindToInteractions('draw_tool');
        expect(result.click).toEqual(['draw:context_menu']);
    });

    test('"viewer_open" returns viewer:open_panel', () => {
        const result = kindToInteractions('viewer_open');
        expect(result.click).toEqual(['viewer:open_panel']);
    });

    test('unknown kind falls back to empty pipeline (same as "none")', () => {
        const result = kindToInteractions('nonexistent_kind');
        expect(result.click).toEqual([]);
    });

    test('always includes hover and mouseout pipelines', () => {
        const result = kindToInteractions('info');
        expect(result.hover).toEqual(DEFAULT_HOVER_PIPELINE);
        expect(result.mouseout).toEqual(DEFAULT_MOUSEOUT_PIPELINE);
    });

    test('hover defaults to cursor:show', () => {
        expect(DEFAULT_HOVER_PIPELINE).toEqual(['cursor:show']);
    });

    test('mouseout defaults to cursor:hide', () => {
        expect(DEFAULT_MOUSEOUT_PIPELINE).toEqual(['cursor:hide']);
    });
});

test.describe('buildFullPipeline', () => {
    test('wraps click pipeline with preamble and postamble', () => {
        const full = buildFullPipeline(['info:open'], 'click');
        expect(full).toEqual([
            ...CLICK_PREAMBLE,
            'info:open',
            ...CLICK_POSTAMBLE.filter((id) => id !== 'info:silent'),
        ]);
    });

    test('empty user pipeline still gets preamble + postamble', () => {
        const full = buildFullPipeline([], 'click');
        expect(full).toEqual([...CLICK_PREAMBLE, ...CLICK_POSTAMBLE]);
    });

    test('preamble starts with select and cleanup_temp', () => {
        expect(CLICK_PREAMBLE[0]).toBe('select');
        expect(CLICK_PREAMBLE[1]).toBe('cleanup_temp');
    });

    test('postamble contains info:silent, viewer:update, search:url, event:notify', () => {
        expect(CLICK_POSTAMBLE).toContain('info:silent');
        expect(CLICK_POSTAMBLE).toContain('viewer:update');
        expect(CLICK_POSTAMBLE).toContain('search:url');
        expect(CLICK_POSTAMBLE).toContain('event:notify');
    });

    test('info:open suppresses info:silent in postamble', () => {
        const full = buildFullPipeline(['info:open'], 'click');
        expect(full).toContain('info:open');
        expect(full).not.toContain('info:silent');
    });

    test('without info:open, postamble includes info:silent', () => {
        const full = buildFullPipeline(['waypoint:image'], 'click');
        expect(full).toContain('info:silent');
        expect(full).not.toContain('info:open');
    });

    test('non-click events pass through without wrapping', () => {
        const hover = buildFullPipeline(['cursor:show'], 'hover');
        expect(hover).toEqual(['cursor:show']);

        const mouseout = buildFullPipeline(['cursor:hide'], 'mouseout');
        expect(mouseout).toEqual(['cursor:hide']);
    });

    test('legacy kind "none" produces correct full pipeline', () => {
        const kind = kindToInteractions('none');
        const full = buildFullPipeline(kind.click, 'click');
        expect(full).toEqual([...CLICK_PREAMBLE, ...CLICK_POSTAMBLE]);
    });

    test('legacy kind "info" produces correct full pipeline', () => {
        const kind = kindToInteractions('info');
        const full = buildFullPipeline(kind.click, 'click');
        expect(full).toEqual([
            'select',
            'cleanup_temp',
            'info:open',
            'viewer:update',
            'search:url',
            'event:notify',
        ]);
    });

    test('legacy kind "waypoint" produces correct full pipeline', () => {
        const kind = kindToInteractions('waypoint');
        const full = buildFullPipeline(kind.click, 'click');
        expect(full).toEqual([
            'select',
            'cleanup_temp',
            'waypoint:image',
            'waypoint:model',
            'info:silent',
            'viewer:update',
            'search:url',
            'event:notify',
        ]);
    });
});

test.describe('runInteractions', () => {
    test('wraps click pipeline with defaults and runs in order', async () => {
        const callOrder = [];
        const mockHandlers = {
            'select': { use() { callOrder.push('select'); } },
            'cleanup_temp': { use() { callOrder.push('cleanup_temp'); } },
            'info:open': { use() { callOrder.push('info:open'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['info:open'], ctx, mockHandlers);

        expect(callOrder).toEqual([
            'select',
            'cleanup_temp',
            'info:open',
            'viewer:update',
            'search:url',
            'event:notify',
        ]);
    });

    test('hover events pass through without wrapping', async () => {
        const callOrder = [];
        const mockHandlers = {
            'cursor:show': { use() { callOrder.push('cursor:show'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'hover' };
        await runInteractions(['cursor:show'], ctx, mockHandlers);

        expect(callOrder).toEqual(['cursor:show']);
    });

    test('stops pipeline when ctx.stop is set', async () => {
        const callOrder = [];
        const mockHandlers = {
            'select': { use(ctx) { callOrder.push('select'); ctx.stop = true; } },
            'cleanup_temp': { use() { callOrder.push('cleanup_temp'); } },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions([], ctx, mockHandlers);

        expect(callOrder).toEqual(['select']);
    });

    test('skips unknown interaction IDs without throwing', async () => {
        const callOrder = [];
        const mockHandlers = {
            'select': { use() { callOrder.push('select'); } },
            'cleanup_temp': { use() { callOrder.push('cleanup_temp'); } },
            'custom': { use() { callOrder.push('custom'); } },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['custom', 'unknown_handler'], ctx, mockHandlers);

        // unknown_handler skipped, everything else runs
        expect(callOrder).toContain('custom');
        expect(callOrder).not.toContain('unknown_handler');
    });

    test('handles async handlers', async () => {
        const callOrder = [];
        const mockHandlers = {
            'select': { use() { callOrder.push('select'); } },
            'cleanup_temp': { use() { callOrder.push('cleanup_temp'); } },
            'async_handler': {
                async use() {
                    await new Promise((r) => setTimeout(r, 10));
                    callOrder.push('async_handler');
                },
            },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['async_handler'], ctx, mockHandlers);

        expect(callOrder.indexOf('async_handler')).toBeLessThan(
            callOrder.indexOf('info:silent')
        );
    });

    test('runs empty user pipeline (defaults only) without error', async () => {
        const callOrder = [];
        const mockHandlers = {
            'select': { use() { callOrder.push('select'); } },
            'cleanup_temp': { use() { callOrder.push('cleanup_temp'); } },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions([], ctx, mockHandlers);

        expect(callOrder).toEqual([
            'select',
            'cleanup_temp',
            'info:silent',
            'viewer:update',
            'search:url',
            'event:notify',
        ]);
    });

    test('shares mutable state between handlers', async () => {
        const mockHandlers = {
            'select': { use() {} },
            'cleanup_temp': { use() {} },
            'writer': { use(ctx) { ctx.state.value = 42; } },
            'reader': { use(ctx) { ctx.state.readValue = ctx.state.value; } },
            'info:silent': { use() {} },
            'viewer:update': { use() {} },
            'search:url': { use() {} },
            'event:notify': { use() {} },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['writer', 'reader'], ctx, mockHandlers);

        expect(ctx.state.readValue).toBe(42);
    });
});
