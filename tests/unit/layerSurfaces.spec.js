/**
 * The `legend` layertype surface, attachment `onConfigChange` and interaction
 * `configPath` — the three surfaces that replaced a hardcoded type list, a
 * rebuild-only config change, and a plugin knowing where its settings live.
 *
 * LayerLegend and sublayers pull in jQuery/L_ and can't be imported under the
 * unit runner, so their dispatch is asserted at the source level (as in
 * globeRendererAddLayer.spec.js); InteractionRunner is importable and is
 * exercised directly.
 */

import { test, expect } from '@playwright/test'
import {
    configForInteraction,
    runInteractions,
} from '../../src/essence/Basics/InteractionRunner/InteractionRunner'

const fs = require('fs')
const path = require('path')

const read = (p) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8')

const LAYER_LEGEND = read('src/essence/Basics/Layers_/legend/LayerLegend.js')
const SUBLAYERS = read('src/essence/Basics/Layers_/display/sublayers.js')
const LEGEND_TOOL = read('plugins/core/tools/Legend/LegendTool.js')
const LAYERS_TOOL = read('plugins/core/tools/Layers/LayersTool.js')
const UPDATE_TOOLS = read('API/updateTools.js')

const emptyConfig = {
    clickPreamble: [],
    clickPostamble: [],
    hoverDefaults: [],
    mouseoutDefaults: [],
    suppressionMap: {},
    kindPipelines: {},
}

test.describe('legend surface', () => {
    test('the legend is asked of the type, not switched on it', () => {
        expect(LAYER_LEGEND).toContain("LayerTypeRegistry.get(layerObj.type)?.legend")
        expect(LAYER_LEGEND).toContain("'derive'")
    })

    test('a type that declares no legend surface takes no responsibility', () => {
        expect(LAYER_LEGEND).toContain("hasOp(legendModule, 'derive')")
    })

    test('both legend call sites dispatch instead of listing types', () => {
        expect(LEGEND_TOOL).toContain('deriveLegend(')
        expect(LEGEND_TOOL).toContain('derivesLegend(')
        expect(LAYERS_TOOL).toContain('deriveLegend(')
        // neither site decides which types have a derived legend any more
        expect(LEGEND_TOOL).not.toContain("['image', 'tile'].includes")
        expect(LEGEND_TOOL).not.toContain('populateCogScale')
        expect(LAYERS_TOOL).not.toContain(
            "F_.getIn(node[i], 'variables.shader.type')"
        )
    })

    test('the types that derive a legend declare the surface', () => {
        for (const type of ['Tile', 'Image', 'Velocity', 'Data']) {
            const manifest = JSON.parse(
                read(`plugins/core/layertypes/${type}/plugin.json`)
            )
            expect(manifest.modules.legend).toBe('./legend')
            expect(read(`plugins/core/layertypes/${type}/legend.js`)).toContain(
                'function derive('
            )
        }
    })

    test('a type whose legend is only ever configured declares none', () => {
        const manifest = JSON.parse(
            read('plugins/core/layertypes/Vector/plugin.json')
        )
        expect(manifest.modules.legend).toBeUndefined()
    })
})

test.describe('attachment onConfigChange', () => {
    test('core writes the new settings at the declared configPath first', () => {
        expect(SUBLAYERS).toContain(
            'LayerAttachmentRegistry.configPath(attachmentId)'
        )
        // the whole point: the live config object is what everything else reads
        expect(SUBLAYERS).toContain('node[keys[keys.length - 1]] = config')
    })

    test('it dispatches onConfigChange with both the new and old settings', () => {
        expect(SUBLAYERS).toContain("'onConfigChange'")
        expect(SUBLAYERS).toContain('prevConfig')
    })

    test("the default is a host rebuild, so omitting it isn't silent", () => {
        expect(SUBLAYERS).toContain('coreDefault: () => L_.Map_?.refreshLayer?.(layerObj)')
    })

    test('it is in the attachment op vocabulary', () => {
        const { ATTACHMENT_OPS } = require('../../API/pluginValidation')
        expect(ATTACHMENT_OPS).toContain('onConfigChange')
    })
})

test.describe('interaction configPath', () => {
    test('a declared path resolves to that subtree of the layer', () => {
        const ctx = {
            layerData: { variables: { interactions: { sonify: { hz: 440 } } } },
        }
        expect(
            configForInteraction('sonify', ctx, {
                configPaths: { sonify: 'variables.interactions.sonify' },
            })
        ).toEqual({ hz: 440 })
    })

    test('an unconfigured layer yields null rather than undefined', () => {
        expect(
            configForInteraction('sonify', { layerData: {} }, {
                configPaths: { sonify: 'variables.interactions.sonify' },
            })
        ).toBeNull()
    })

    test('an interaction that declares no path gets nothing', () => {
        expect(
            configForInteraction('select', { layerData: { a: 1 } }, {
                configPaths: {},
            })
        ).toBeNull()
    })

    test('the runner hands it over as ctx.config', async () => {
        const seen = []
        const handlers = {
            sonify: { use: (ctx) => seen.push(ctx.config) },
            select: { use: (ctx) => seen.push(ctx.config) },
        }
        const ctx = {
            eventType: 'click',
            layerData: { variables: { interactions: { sonify: { hz: 440 } } } },
        }
        await runInteractions(['sonify', 'select'], ctx, {
            handlers,
            config: {
                ...emptyConfig,
                configPaths: { sonify: 'variables.interactions.sonify' },
            },
        })
        // sonify gets its settings; select declares no path, so it gets null —
        // the ctx is shared down the pipeline and one interaction's settings are
        // not another's
        expect(seen[0]).toEqual({ hz: 440 })
        expect(seen[1]).toBeNull()
    })

    test('the generator emits the paths the runner reads', () => {
        expect(UPDATE_TOOLS).toContain('INTERACTION_CONFIG_PATHS')
        expect(UPDATE_TOOLS).toContain('configPaths[id] = manifest.configPath')
    })

    test('it must point into a layer\'s variables', () => {
        const { validatePluginConfig } = require('../../API/pluginValidation')
        const manifest = (configPath) => ({
            name: 'Sonify',
            type: 'interaction',
            interactionId: 'sonify',
            configPath,
            paths: { Sonify: './Sonify' },
        })
        expect(
            validatePluginConfig(
                manifest('variables.interactions.sonify'),
                'Sonify',
                'interaction'
            )
        ).toEqual([])
        expect(
            validatePluginConfig(manifest('interactions.sonify'), 'Sonify', 'interaction')
                .join(' ')
        ).toContain("'variables'")
    })

    test('an interaction declares its settings form as rows, like an attachment', () => {
        const { validatePluginConfig } = require('../../API/pluginValidation')
        const { getSettingsRows } = require('../../configure/src/components/Tabs/Layers/Interactions/interactionUtils')
        const manifest = (extra) => ({
            name: 'Sonify',
            type: 'interaction',
            interactionId: 'sonify',
            configPath: 'variables.interactions.sonify',
            paths: { Sonify: './Sonify' },
            ...extra,
        })
        const rows = [
            {
                components: [
                    {
                        type: 'number',
                        field: 'variables.interactions.sonify.hz',
                        name: 'Base Hz',
                    },
                ],
            },
        ]

        expect(
            validatePluginConfig(manifest({ config: { rows } }), 'Sonify', 'interaction')
        ).toEqual([])
        // The form configures the interaction's own subtree and nothing else.
        expect(
            validatePluginConfig(
                manifest({
                    config: {
                        rows: [
                            {
                                components: [
                                    { type: 'number', field: 'variables.elsewhere.hz' },
                                ],
                            },
                        ],
                    },
                }),
                'Sonify',
                'interaction'
            ).join(' ')
        ).toContain('outside')
        // Rows with nowhere to be read from, and a tab with nowhere to go.
        expect(
            validatePluginConfig(
                { ...manifest({ config: { rows } }), configPath: undefined },
                'Sonify',
                'interaction'
            ).join(' ')
        ).toContain("needs a 'configPath'")
        expect(
            validatePluginConfig(
                manifest({ config: { rows, tab: 'Sonify' } }),
                'Sonify',
                'interaction'
            ).join(' ')
        ).toContain('only')

        // Configure renders the rows on the interaction's own card.
        expect(getSettingsRows(manifest({ config: { rows } }))).toEqual(rows)
        expect(getSettingsRows(manifest({}))).toBeNull()
        expect(
            getSettingsRows({ config: { rows } })
        ).toBeNull()
    })

    test("an interaction's settings survive the layer modal trimming a layer to its tabs", () => {
        const {
            interactionConfigPaths,
        } = require('../../configure/src/components/Tabs/Layers/Interactions/interactionUtils')

        expect(
            interactionConfigPaths({
                Sonify: { configPath: 'variables.interactions.sonify' },
                Select: {},
                Broken: { configPath: '' },
            })
        ).toEqual(['variables.interactions.sonify'])
        expect(interactionConfigPaths(null)).toEqual([])
    })
})
