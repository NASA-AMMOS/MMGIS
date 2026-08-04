/**
 * The `source` surface: a layer type acquires its own data while core keeps the
 * dynamic-extent policy (extent, staleness, move threshold).
 *
 * The policy itself is pure and tested directly. LayerCapturer, which dispatches
 * it, imports jQuery/L_/TimeControl and cannot be imported under the unit
 * runner, so its dispatch is asserted at the source level (as in
 * globeRendererAddLayer.spec.js).
 */

import { test, expect } from '@playwright/test'
import {
    acceptsDynamicResult,
    sourceCtx,
} from '../../src/essence/Basics/Layers_/capture/dynamicExtent'

const fs = require('fs')
const path = require('path')

const CAPTURER = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../src/essence/Basics/Layers_/capture/LayerCapturer.js'
    ),
    'utf8'
)

const layerObj = { name: 'l' }
const view = (lng, lat, zoom = 5, tilt = 0) => ({
    zoom,
    tilt,
    center: { lng, lat },
    minx: lng - 1,
    miny: lat - 1,
    maxx: lng + 1,
    maxy: lat + 1,
})

test.describe('dynamic-extent acceptance', () => {
    test('a superseded response is dropped', () => {
        const stamps = { l: 200 }
        expect(
            acceptsDynamicResult(layerObj, {}, view(0, 0), 100, stamps, {})
        ).toBe(false)
    })

    test('the newest response is accepted and records its location', () => {
        const stamps = { l: 100 }
        const locs = {}
        expect(
            acceptsDynamicResult(layerObj, {}, view(1, 2), 100, stamps, locs)
        ).toBe(true)
        expect(locs.l).toEqual({ lng: 1, lat: 2, zoom: 5, tilt: 0 })
    })

    test('a move below the threshold is dropped', () => {
        const layerData = { variables: { dynamicExtentMoveThreshold: '100' } }
        const locs = { l: { lng: 0, lat: 0, zoom: 5, tilt: 0 } }
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0.0001, 0),
                100,
                { l: 100 },
                locs
            )
        ).toBe(false)
    })

    test('a zoom or tilt change is always accepted', () => {
        const layerData = { variables: { dynamicExtentMoveThreshold: '100' } }
        const locs = { l: { lng: 0, lat: 0, zoom: 5, tilt: 0 } }
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0, 0, 6),
                100,
                { l: 100 },
                locs
            )
        ).toBe(true)
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0, 0, 6, 30),
                101,
                { l: 101 },
                locs
            )
        ).toBe(true)
    })

    test('an empty threshold does not block updates', () => {
        const layerData = { variables: { dynamicExtentMoveThreshold: '' } }
        const locs = { l: { lng: 0, lat: 0, zoom: 5, tilt: 0 } }
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0, 0),
                100,
                { l: 100 },
                locs
            )
        ).toBe(true)
    })

    test('the one-shot override ignores the threshold', () => {
        const layerData = {
            variables: { dynamicExtentMoveThreshold: '100' },
            _ignoreDynamicExtentMoveThreshold: true,
        }
        const locs = { l: { lng: 0, lat: 0, zoom: 5, tilt: 0 } }
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0, 0),
                100,
                { l: 100 },
                locs
            )
        ).toBe(true)
    })

    test("a '/z' threshold shrinks with zoom", () => {
        const layerData = { variables: { dynamicExtentMoveThreshold: '1000/z' } }
        const far = { l: { lng: 0, lat: 0, zoom: 20, tilt: 0 } }
        // At z20 the same 1000 becomes tiny, so a small pan counts as a move.
        expect(
            acceptsDynamicResult(
                layerObj,
                layerData,
                view(0.01, 0, 20),
                100,
                { l: 100 },
                far
            )
        ).toBe(true)
    })
})

test.describe('source.fetch ctx', () => {
    test('carries the view and marks dynamic-extent requests', () => {
        const ctx = sourceCtx({}, 'http://x/items', view(3, 4), 'view')
        expect(ctx.url).toBe('http://x/items')
        expect(ctx.trigger).toBe('view')
        expect(ctx.dynamicExtent).toBe(true)
        expect(ctx.view.maxx).toBe(4)
    })

    test('has no view for a plain make', () => {
        const ctx = sourceCtx({}, 'u', null, 'make')
        expect(ctx.view).toBe(null)
        expect(ctx.dynamicExtent).toBe(false)
    })

    test('exposes the time window only for time-enabled layers', () => {
        expect(sourceCtx({ time: { enabled: false } }, 'u', null, 'make').time).toBe(
            null
        )
        const ctx = sourceCtx(
            {
                time: {
                    enabled: true,
                    type: 'requery',
                    start: 's',
                    end: 'e',
                    startProp: 'sp',
                    endProp: 'ep',
                },
            },
            'u',
            null,
            'make'
        )
        expect(ctx.time).toEqual({
            start: 's',
            end: 'e',
            startProp: 'sp',
            endProp: 'ep',
            requery: true,
        })
    })

    test('passes the encoded filters through', () => {
        const ctx = sourceCtx(
            { _filterEncoded: { filters: 'f', spatialFilter: 's' } },
            'u',
            null,
            'make'
        )
        expect(ctx.filters).toBe('f')
        expect(ctx.spatialFilter).toBe('s')
    })
})

test.describe('LayerCapturer dispatch', () => {
    test('asks the type before falling back to core url transports', () => {
        expect(
            /const sourceModule = LayerTypeRegistry\.get\(layerData\?\.type\)\?\.source/.test(
                CAPTURER
            )
        ).toBe(true)
        // The dispatch precedes the url `switch`es that are core's default.
        expect(CAPTURER.indexOf('_captureFromSource(')).toBeLessThan(
            CAPTURER.indexOf("switch (urlSplit[0])")
        )
    })

    test('dispatches fetch through LayerInterface', () => {
        expect(
            /LayerInterface\.run\(sourceModule, 'fetch', \[layerObj, ctx\]\)/.test(
                CAPTURER
            )
        ).toBe(true)
    })

    test('a source-backed layer may have no url', () => {
        expect(/if \(!hasSourceFetch\) \{\s*cb\(null\)/.test(CAPTURER)).toBe(true)
    })

    test('core still owns the staleness and threshold decision', () => {
        expect(/acceptsDynamicResult\(/.test(CAPTURER)).toBe(true)
        expect(/_commitDynamicGeoJSON\(/.test(CAPTURER)).toBe(true)
    })
})
