/**
 * A refresh swaps a rebuilt layer in by hiding and re-showing it with
 * `ignoreToggleStateChange`, which leaves `L_.layers.on` untouched on purpose.
 * Both halves of that pair therefore read the same unchanged state, so if
 * subscribers are notified they are told "off" twice — and the Layers tool's
 * checkbox, which listens for exactly this, shows a still-on layer as off after
 * a time change.
 *
 * visibility.js imports jQuery and the singleton graph, so this is asserted at
 * source level as the other Layers_ specs are.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const read = (p) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')

const VISIBILITY = read('src/essence/Basics/Layers_/display/visibility.js')
const MAP_RENDERER = read('src/essence/Basics/Map_/MapRenderer.js')
const LAYERS_TOOL = read('plugins/core/tools/Layers/LayersTool.js')

test.describe('toggle subscriptions', () => {
    test('a state-preserving toggle notifies nobody', () => {
        const notify = VISIBILITY.indexOf('_onLayerToggleSubscriptions')
        const guard = VISIBILITY.indexOf('if (ignoreToggleStateChange !== true)')
        expect(guard).toBeGreaterThan(-1)
        expect(guard).toBeLessThan(notify)
    })

    test('both halves of a refresh swap are state-preserving', () => {
        // addVector hides the old layer and re-shows the new one; the fourth
        // argument of both is `ignoreToggleStateChange`.
        const swaps = MAP_RENDERER.match(
            /L_\.toggleLayer\(registry\.data\[name\], (?:true|false), true\)/g
        )
        expect(swaps?.length).toBe(2)
    })

    test('the Layers tool checkbox follows the toggle subscription', () => {
        expect(/subscribeOnLayerToggle\('LayersTool'/.test(LAYERS_TOOL)).toBe(true)
    })
})
