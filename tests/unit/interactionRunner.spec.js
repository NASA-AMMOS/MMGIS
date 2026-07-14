/**
 * Unit tests for InteractionRunner — runInteractions(), kindToInteractions(),
 * buildFullPipeline(), and data-driven config behavior.
 *
 * Tests pass explicit config objects to avoid depending on the generated file.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');

const {
    runInteractions,
    kindToInteractions,
    buildFullPipeline,
} = require('../../src/essence/Basics/InteractionRunner/InteractionRunner');

test('generated interactions import resolves from InteractionRunner', () => {
    const runnerPath = path.resolve(
        __dirname,
        '../../src/essence/Basics/InteractionRunner/InteractionRunner.js'
    );
    const runnerSource = fs.readFileSync(runnerPath, 'utf8');
    const importMatch = runnerSource.match(
        /require\(['"]([^'"]*pre\/interactions)['"]\)/
    );

    expect(importMatch).not.toBeNull();
    expect(
        fs.existsSync(
            path.resolve(path.dirname(runnerPath), `${importMatch[1]}.js`)
        )
    ).toBe(true);
});

// Standard config matching what the core plugin.json manifests produce
const CORE_CONFIG = {
    clickPreamble: ['select'],
    clickPostamble: ['info:silent', 'viewer:update', 'search:url', 'event:notify'],
    hoverDefaults: ['cursor:show'],
    mouseoutDefaults: ['cursor:hide'],
    suppressionMap: { 'info:open': ['info:silent'] },
    kindPipelines: {
        none: [],
        info: ['info:open'],
        waypoint: ['waypoint:image', 'waypoint:model'],
        chemistry_tool: ['chemistry:use'],
        draw_tool: ['draw:context_menu'],
        viewer_open: ['viewer:open_panel'],
    },
};

test.describe('kindToInteractions', () => {
    test('"none" returns empty click pipeline', () => {
        const result = kindToInteractions('none', CORE_CONFIG);
        expect(result.click).toEqual([]);
    });

    test('"info" returns only info:open', () => {
        const result = kindToInteractions('info', CORE_CONFIG);
        expect(result.click).toEqual(['info:open']);
    });

    test('"waypoint" returns waypoint:image and waypoint:model', () => {
        const result = kindToInteractions('waypoint', CORE_CONFIG);
        expect(result.click).toEqual(['waypoint:image', 'waypoint:model']);
    });

    test('"chemistry_tool" returns chemistry:use', () => {
        const result = kindToInteractions('chemistry_tool', CORE_CONFIG);
        expect(result.click).toEqual(['chemistry:use']);
    });

    test('"draw_tool" returns draw:context_menu', () => {
        const result = kindToInteractions('draw_tool', CORE_CONFIG);
        expect(result.click).toEqual(['draw:context_menu']);
    });

    test('"viewer_open" returns viewer:open_panel', () => {
        const result = kindToInteractions('viewer_open', CORE_CONFIG);
        expect(result.click).toEqual(['viewer:open_panel']);
    });

    test('unknown kind falls back to empty pipeline', () => {
        const result = kindToInteractions('nonexistent_kind', CORE_CONFIG);
        expect(result.click).toEqual([]);
    });

    test('hover and mouseout return empty (defaults handled by runner)', () => {
        const result = kindToInteractions('info', CORE_CONFIG);
        expect(result.hover).toEqual([]);
        expect(result.mouseout).toEqual([]);
    });
});

test.describe('buildFullPipeline', () => {
    test('wraps click pipeline with preamble and postamble', () => {
        const full = buildFullPipeline(['info:open'], 'click', CORE_CONFIG);
        expect(full).toEqual([
            'select',
            'info:open',
            'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('empty user pipeline gets preamble + postamble', () => {
        const full = buildFullPipeline([], 'click', CORE_CONFIG);
        expect(full).toEqual([
            'select',
            'info:silent', 'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('info:open suppresses info:silent in postamble', () => {
        const full = buildFullPipeline(['info:open'], 'click', CORE_CONFIG);
        expect(full).toContain('info:open');
        expect(full).not.toContain('info:silent');
    });

    test('without info:open, postamble includes info:silent', () => {
        const full = buildFullPipeline(['waypoint:image'], 'click', CORE_CONFIG);
        expect(full).toContain('info:silent');
        expect(full).not.toContain('info:open');
    });

    test('hover prepends defaults', () => {
        const full = buildFullPipeline([], 'hover', CORE_CONFIG);
        expect(full).toEqual(['cursor:show']);
    });

    test('mouseout prepends defaults', () => {
        const full = buildFullPipeline([], 'mouseout', CORE_CONFIG);
        expect(full).toEqual(['cursor:hide']);
    });

    test('hover with custom interactions appends after defaults', () => {
        const full = buildFullPipeline(['custom:hover'], 'hover', CORE_CONFIG);
        expect(full).toEqual(['cursor:show', 'custom:hover']);
    });

    test('non-click/hover/mouseout passes through', () => {
        const full = buildFullPipeline(['custom'], 'dblclick', CORE_CONFIG);
        expect(full).toEqual(['custom']);
    });

    test('legacy kind "none" produces correct full pipeline', () => {
        const kind = kindToInteractions('none', CORE_CONFIG);
        const full = buildFullPipeline(kind.click, 'click', CORE_CONFIG);
        expect(full).toEqual([
            'select',
            'info:silent', 'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('legacy kind "info" produces correct full pipeline', () => {
        const kind = kindToInteractions('info', CORE_CONFIG);
        const full = buildFullPipeline(kind.click, 'click', CORE_CONFIG);
        expect(full).toEqual([
            'select',
            'info:open',
            'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('legacy kind "waypoint" produces correct full pipeline', () => {
        const kind = kindToInteractions('waypoint', CORE_CONFIG);
        const full = buildFullPipeline(kind.click, 'click', CORE_CONFIG);
        expect(full).toEqual([
            'select',
            'waypoint:image', 'waypoint:model',
            'info:silent', 'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('custom suppression map works', () => {
        const customConfig = {
            ...CORE_CONFIG,
            suppressionMap: { 'custom:a': ['info:silent', 'search:url'] },
        };
        const full = buildFullPipeline(['custom:a'], 'click', customConfig);
        expect(full).not.toContain('info:silent');
        expect(full).not.toContain('search:url');
        expect(full).toContain('viewer:update');
        expect(full).toContain('event:notify');
    });
});

test.describe('runInteractions', () => {
    const allHandlers = {
        'select': { use() {} },
        'info:open': { use() {} },
        'info:silent': { use() {} },
        'viewer:update': { use() {} },
        'search:url': { use() {} },
        'event:notify': { use() {} },
        'cursor:show': { use() {} },
        'cursor:hide': { use() {} },
    };

    test('wraps click pipeline with defaults and runs in order', async () => {
        const callOrder = [];
        const handlers = {};
        for (const id of Object.keys(allHandlers)) {
            handlers[id] = { use() { callOrder.push(id); } };
        }

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['info:open'], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder).toEqual([
            'select',
            'info:open',
            'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('hover events prepend defaults', async () => {
        const callOrder = [];
        const handlers = {
            'cursor:show': { use() { callOrder.push('cursor:show'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'hover' };
        await runInteractions([], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder).toEqual(['cursor:show']);
    });

    test('stops pipeline when ctx.stop is set', async () => {
        const callOrder = [];
        const handlers = {
            'select': { use(ctx) { callOrder.push('select'); ctx.stop = true; } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions([], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder).toEqual(['select']);
    });

    test('skips unknown interaction IDs without throwing', async () => {
        const callOrder = [];
        const handlers = {
            'select': { use() { callOrder.push('select'); } },
            'custom': { use() { callOrder.push('custom'); } },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['custom', 'unknown_handler'], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder).toContain('custom');
        expect(callOrder).not.toContain('unknown_handler');
    });

    test('handles async handlers', async () => {
        const callOrder = [];
        const handlers = {
            'select': { use() { callOrder.push('select'); } },
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
        await runInteractions(['async_handler'], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder.indexOf('async_handler')).toBeLessThan(
            callOrder.indexOf('info:silent')
        );
    });

    test('empty pipeline runs defaults only', async () => {
        const callOrder = [];
        const handlers = {
            'select': { use() { callOrder.push('select'); } },
            'info:silent': { use() { callOrder.push('info:silent'); } },
            'viewer:update': { use() { callOrder.push('viewer:update'); } },
            'search:url': { use() { callOrder.push('search:url'); } },
            'event:notify': { use() { callOrder.push('event:notify'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions([], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(callOrder).toEqual([
            'select',
            'info:silent', 'viewer:update', 'search:url', 'event:notify',
        ]);
    });

    test('shares mutable state between handlers', async () => {
        const handlers = {
            'select': { use() {} },
            'writer': { use(ctx) { ctx.state.value = 42; } },
            'reader': { use(ctx) { ctx.state.readValue = ctx.state.value; } },
            'info:silent': { use() {} },
            'viewer:update': { use() {} },
            'search:url': { use() {} },
            'event:notify': { use() {} },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['writer', 'reader'], ctx, {
            handlers,
            config: CORE_CONFIG,
        });

        expect(ctx.state.readValue).toBe(42);
    });

    test('legacy plain-handlers mode runs without wrapping', async () => {
        const callOrder = [];
        const handlers = {
            'a': { use() { callOrder.push('a'); } },
            'b': { use() { callOrder.push('b'); } },
        };

        const ctx = { stop: false, state: {}, eventType: 'click' };
        await runInteractions(['a', 'b'], ctx, handlers);

        // No wrapping — just runs a, b directly
        expect(callOrder).toEqual(['a', 'b']);
    });
});
