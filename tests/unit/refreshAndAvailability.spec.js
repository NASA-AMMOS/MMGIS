/**
 * Two seams a plugin cannot otherwise reach:
 *
 *   ctx.refreshLayer()  — re-acquire a layer whose data a plugin just changed,
 *                         landing in a `source` type as trigger 'refresh'.
 *   time.availability() — a type says when its data exists, so the time bar's
 *                         sparkline stops being discovered by url pattern.
 *
 * The dispatchers (LayerCapturer, TimeUI, LayerConstructors, sublayers) import
 * jQuery/L_ and cannot be imported under the unit runner, so their dispatch is
 * asserted at source level, as layerSource.spec.js does. The pure part —
 * Tile's availability source resolution — is exercised directly.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const read = (p) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')

const CAPTURER = read('src/essence/Basics/Layers_/capture/LayerCapturer.js')
const VECTOR = read('src/essence/Basics/Layers_/commons/vector.js')
const RUNNER = read('src/essence/Basics/InteractionRunner/InteractionRunner.js')
const CONSTRUCTORS = read('src/essence/Basics/Layers_/render/LayerConstructors.js')
const SUBLAYERS = read('src/essence/Basics/Layers_/display/sublayers.js')
const REFRESH = read('src/essence/Basics/Layers_/lifecycle/refresh.js')
const TIMEUI = read('src/essence/Basics/TimeControl_/TimeUI.js')
const TILE_TIME = read('plugins/core/layertypes/Tile/time.js')
const TILE_MANIFEST = JSON.parse(read('plugins/core/layertypes/Tile/plugin.json'))

test.describe('ctx.refreshLayer', () => {
    test('is handed to every interaction, whatever its settings', () => {
        expect(
            /ctx\.refreshLayer = \(\) => refreshLayer\(ctx\.layerData \|\| ctx\.layerName\)/.test(
                RUNNER
            )
        ).toBe(true)
    })

    test('is handed to an attachment on make and on a settings change', () => {
        expect(/refreshLayer: \(\) => refreshLayer\(layerObj\)/.test(CONSTRUCTORS)).toBe(
            true
        )
        expect(/refreshLayer: \(\) => refreshLayer\(layerObj\)/.test(SUBLAYERS)).toBe(
            true
        )
    })

    test('is the one core call, not a second refresh path', () => {
        expect(/L_\.Map_\?\.refreshLayer/.test(REFRESH)).toBe(true)
        // Requiring L_ lazily is what keeps the plugin dispatch paths that
        // import this module importable without the singleton graph.
        expect(REFRESH.indexOf("import L_")).toBe(-1)
        expect(/require\('\.\.\/Layers_'\)/.test(REFRESH)).toBe(true)
    })

    test("a re-acquisition reaches a source type as trigger 'refresh'", () => {
        expect(
            /fetch\(null, isRefresh === true \? 'refresh' : 'make', cb\)/.test(
                CAPTURER
            )
        ).toBe(true)
        // …because the flag core already had for a refresh is threaded in.
        expect(/isRefresh,/.test(VECTOR)).toBe(true)
        expect(/options\.isRefresh/.test(CAPTURER)).toBe(true)
    })
})

test.describe('time.availability', () => {
    test('Tile declares the histogram capability and a time module for it', () => {
        expect(TILE_MANIFEST.capabilities.time.histogram).toBe(true)
        expect(TILE_MANIFEST.modules.time).toBeTruthy()
        expect(/export function availability\(/.test(TILE_TIME)).toBe(true)
    })

    test('the time bar asks the type instead of matching url patterns', () => {
        expect(
            /LayerInterface\.run\(timeModule, 'availability'/.test(TIMEUI)
        ).toBe(true)
        // The two url schemes it used to branch on are the type's business now.
        expect(TIMEUI.indexOf('stac-collection:')).toBe(-1)
        expect(TIMEUI.indexOf('{t}')).toBe(-1)
        expect(TIMEUI.indexOf('query_tileset_times')).toBe(-1)
    })

    test('a type that declares the capability without the op is reported', () => {
        expect(
            /declares capabilities\.time\.histogram but implements no time\.availability/.test(
                TIMEUI
            )
        ).toBe(true)
    })

    test('core does the binning, so a type returns only times and counts', () => {
        expect(/entry\.total == null \? 1 : parseInt\(entry\.total\)/.test(TIMEUI)).toBe(
            true
        )
    })
})

test.describe("Tile's availability sources", () => {
    // The module imports the singletons, so exercise the resolution it does
    // through the shape of the code rather than by importing it.
    test('a local stac collection is asked by name', () => {
        expect(
            /return \{ stacCollection: afterColon\.split\('\?'\)\[0\] \}/.test(
                TILE_TIME
            )
        ).toBe(true)
    })

    test('an external stac url is asked at the other MMGIS', () => {
        expect(/parseExternalStacUrl\(afterColon\)/.test(TILE_TIME)).toBe(true)
        expect(/\/api\/utils\/queryTilesetTimes\?/.test(TILE_TIME)).toBe(true)
    })

    test('a templated url is asked as a path, and anything else not at all', () => {
        expect(/replace\(\/\{t\}\/g, '_time_'\)/.test(TILE_TIME)).toBe(true)
        expect(/if \(layerUrl\.indexOf\('\{t\}'\) === -1\) return null/.test(TILE_TIME)).toBe(
            true
        )
    })
})
