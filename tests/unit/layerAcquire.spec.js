/**
 * `ctx.acquire(layerName)` — a plugin using another configured layer as an
 * input, by acquiring its data rather than reading what it rendered.
 *
 * The distinction is the whole point of the surface, so it is what's asserted:
 * a headless acquisition draws nothing, doesn't turn the layer on, doesn't
 * cancel the layer's own live acquisition, and isn't bound to the viewport.
 * LayerCapturer imports jQuery/L_/TimeControl and can't be imported under the
 * unit runner, so its dispatch is asserted at the source level, as
 * layerSource.spec.js does.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8')

const CAPTURER = read('src/essence/Basics/Layers_/capture/LayerCapturer.js')
const ACQUIRE = read('src/essence/Basics/Layers_/lifecycle/acquire.js')
const RUNNER = read('src/essence/Basics/InteractionRunner/InteractionRunner.js')
const CONSTRUCTORS = read(
    'src/essence/Basics/Layers_/render/LayerConstructors.js'
)
const SUBLAYERS = read('src/essence/Basics/Layers_/display/sublayers.js')

test.describe('the acquisition itself', () => {
    test('it goes through the layer type\u2019s own acquisition', () => {
        // Not a bespoke fetch: whatever the type does (including its
        // source.fetch) is what an acquisition of it does.
        expect(/captureVector\(\s*\{ \.\.\.layerData, name: uuid \},/.test(CAPTURER)).toBe(
            true
        )
        expect(/\{ headless: true, evenIfOff: true \}/.test(CAPTURER)).toBe(true)
    })

    test('it resolves a display name the way the rest of core does', () => {
        expect(/const uuid = L_\.asLayerUUID\(layerName\)/.test(CAPTURER)).toBe(
            true
        )
        expect(/L_\.layers\.data\[uuid\]/.test(CAPTURER)).toBe(true)
    })

    test('a layer that isn\u2019t in the mission resolves to null, loudly', () => {
        expect(/no such layer in this mission/.test(CAPTURER)).toBe(true)
    })

    test('an off layer is acquired anyway, and never turned on', () => {
        expect(/evenIfOff: true/.test(CAPTURER)).toBe(true)
        // 'off' is captureVector's answer for a layer that is off; acquire must
        // not hand a plugin that string as if it were data.
        expect(/data === 'off' \|\| data == null \? null : data/.test(CAPTURER)).toBe(
            true
        )
    })

    test('nothing is drawn: no dynamic binding, no page painting', () => {
        // The dynamic-extent path subscribes to view changes and clears/updates
        // the real layer — a headless acquisition takes neither.
        expect(
            /!headless && layerData\?\.variables\?\.dynamicExtent === true/.test(
                CAPTURER
            )
        ).toBe(true)
        expect(CAPTURER.match(/!headless && layerData\?\.variables\?\.dynamicExtent === true/g)).toHaveLength(
            2
        )
        expect(/if \(headless\) \{\s*emitted = geojson/.test(CAPTURER)).toBe(true)
    })

    test("it doesn't cancel the layer's own live acquisition", () => {
        expect(
            /headless \? `\$\{layerObj\.name\}::acquire` : layerObj\.name/.test(
                CAPTURER
            )
        ).toBe(true)
    })

    test('a paged source is handed over whole, once', () => {
        expect(/if \(headless\) onData\(emitted\)/.test(CAPTURER)).toBe(true)
        expect(/if \(headless \|\| !painted\) onData\(null\)/.test(CAPTURER)).toBe(
            true
        )
    })

    test('two layers acquiring each other terminate', () => {
        expect(/_acquiring\.has\(uuid\)/.test(CAPTURER)).toBe(true)
        expect(/_acquiring\.add\(uuid\)/.test(CAPTURER)).toBe(true)
        expect(/_acquiring\.delete\(uuid\)/.test(CAPTURER)).toBe(true)
    })
})

test.describe('what plugins are handed', () => {
    test('it is the same named call for every family', () => {
        // lifecycle/acquire is the plugin-facing name, required lazily so the
        // dispatch paths stay importable without the singleton graph.
        expect(/require\('\.\.\/capture\/LayerCapturer'\)/.test(ACQUIRE)).toBe(
            true
        )
        expect(/ctx\.acquire = acquire/.test(RUNNER)).toBe(true)
        expect(/\n        acquire,\n/.test(CONSTRUCTORS)).toBe(true)
        expect(/\n                acquire,\n/.test(SUBLAYERS)).toBe(true)
        // and a source type joining its url against a layer of the mission
        expect(CAPTURER.match(/ctx\.acquire = acquireLayer/g)).toHaveLength(2)
    })

    test('no rendered state comes with it', () => {
        // The one thing this surface must never become: a handle on another
        // plugin's Leaflet objects.
        const body = CAPTURER.slice(CAPTURER.indexOf('export const acquireLayer'))
        expect(/L_\.layers\.layer\[/.test(body)).toBe(false)
        expect(/L_\.layers\.attachments/.test(body)).toBe(false)
    })
})
