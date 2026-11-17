/**
 * `capabilities.defaultInteractions` — a layer type declaring the interactions
 * it comes with, in either form: ids only, or ids with their settings.
 *
 * The settings form is the mirror of `defaultAttachments`, and it exists for the
 * same reason: a type that fetched the data knows the property names its own
 * interaction needs, and without a way to say so an admin has to type them into
 * a second subtree and keep the two in agreement.
 */

import { test, expect } from '@playwright/test'
import {
    normalizeDefaultInteractions,
    resolveInteractionConfig,
} from '../../src/essence/Basics/Layers_/registry/interactionDefaults'

const {
    runInteractions,
    configForInteraction,
    resolveLayerInteractions,
} = require('../../src/essence/Basics/InteractionRunner/InteractionRunner')

const { validatePluginConfig } = require('../../API/pluginValidation')

const manifest = (defaultInteractions) => ({
    name: 'Wind',
    type: 'layertype',
    typeId: 'wind',
    extends: 'vector',
    version: '1.0.0',
    tier: 'community',
    description: '',
    capabilities: { defaultInteractions },
    module: './wind',
})

test.describe('normalizing what a type declares', () => {
    test('the list form yields ids and no settings', () => {
        expect(
            normalizeDefaultInteractions({ click: ['identify:popup'] })
        ).toEqual({ ids: { click: ['identify:popup'] }, settings: {} })
    })

    test('the object form yields the same ids, plus their settings', () => {
        expect(
            normalizeDefaultInteractions({
                click: { 'wind:report': { speedProp: 'windSpeed' } },
                hover: ['cursor:show'],
            })
        ).toEqual({
            ids: { click: ['wind:report'], hover: ['cursor:show'] },
            settings: { 'wind:report': { speedProp: 'windSpeed' } },
        })
    })

    test('object key order is the pipeline order, as the array form is', () => {
        const { ids } = normalizeDefaultInteractions({
            click: { 'a:one': {}, 'b:two': {}, 'c:three': {} },
        })
        expect(ids.click).toEqual(['a:one', 'b:two', 'c:three'])
    })

    test('an empty settings object still puts the interaction in the pipeline', () => {
        // `{}` means "comes with it, nothing to say about it" — it must not read
        // the same as not declaring it.
        const { ids, settings } = normalizeDefaultInteractions({
            click: { 'wind:report': {} },
        })
        expect(ids.click).toEqual(['wind:report'])
        expect(settings['wind:report']).toEqual({})
    })

    test('declaring nothing is distinguishable from declaring an empty pipeline', () => {
        // resolveLayerInteractions treats a null `ids` as "no type defaults",
        // which is not the same as a type declaring `{ click: [] }`.
        expect(normalizeDefaultInteractions(undefined).ids).toBeNull()
        expect(normalizeDefaultInteractions(null).ids).toBeNull()
        expect(normalizeDefaultInteractions(['click']).ids).toBeNull()
        expect(normalizeDefaultInteractions({ click: [] }).ids).toEqual({
            click: [],
        })
    })

    test('a malformed event is dropped rather than passed on', () => {
        expect(normalizeDefaultInteractions({ click: 'identify:popup' })).toEqual(
            { ids: { click: [] }, settings: {} }
        )
        expect(
            normalizeDefaultInteractions({ click: ['ok:one', 7, null] }).ids.click
        ).toEqual(['ok:one'])
        // A non-object setting is not settings; validation errors on it, and the
        // interaction still runs with its own defaults.
        const { ids, settings } = normalizeDefaultInteractions({
            click: { 'wind:report': 'loud' },
        })
        expect(ids.click).toEqual(['wind:report'])
        expect(settings['wind:report']).toBeUndefined()
    })
})

test.describe("a layer's own settings over its type's", () => {
    test('merging is field by field', () => {
        expect(
            resolveInteractionConfig(
                { speedProp: 'ws' },
                { speedProp: 'windSpeed', unit: 'm/s' }
            )
        ).toEqual({ speedProp: 'ws', unit: 'm/s' })
    })

    test('an untouched form field does not beat the type', () => {
        expect(
            resolveInteractionConfig(
                { speedProp: '', unit: 'kn' },
                { speedProp: 'windSpeed', unit: 'm/s' }
            )
        ).toEqual({ speedProp: 'windSpeed', unit: 'kn' })
    })

    test('either side alone is used as-is', () => {
        expect(resolveInteractionConfig(null, { unit: 'm/s' })).toEqual({
            unit: 'm/s',
        })
        expect(resolveInteractionConfig({ unit: 'kn' }, null)).toEqual({
            unit: 'kn',
        })
        expect(resolveInteractionConfig(null, null)).toBeNull()
        expect(resolveInteractionConfig(null, 'loud')).toBeNull()
    })
})

test.describe('the runner hands them over as ctx.config', () => {
    const config = { configPaths: { 'wind:report': 'variables.wind' } }

    test("a type's settings reach an interaction the layer never configured", () => {
        const ctx = {
            layerData: {},
            typeInteractionConfigs: { 'wind:report': { speedProp: 'windSpeed' } },
        }
        expect(configForInteraction('wind:report', ctx, config)).toEqual({
            speedProp: 'windSpeed',
        })
    })

    test("the layer's own subtree still wins", () => {
        const ctx = {
            layerData: { variables: { wind: { speedProp: 'ws' } } },
            typeInteractionConfigs: {
                'wind:report': { speedProp: 'windSpeed', unit: 'm/s' },
            },
        }
        expect(configForInteraction('wind:report', ctx, config)).toEqual({
            speedProp: 'ws',
            unit: 'm/s',
        })
    })

    test('an interaction with no configPath can still be handed declared settings', () => {
        const ctx = {
            layerData: { variables: { wind: { speedProp: 'ws' } } },
            typeInteractionConfigs: { 'wind:glow': { color: '#ff0' } },
        }
        expect(configForInteraction('wind:glow', ctx, config)).toEqual({
            color: '#ff0',
        })
    })

    test('an interaction nobody configured is still handed null', () => {
        // The ctx is shared down the pipeline, so "no settings" must not mean
        // "the previous interaction's settings".
        expect(
            configForInteraction('other:thing', { layerData: {} }, config)
        ).toBeNull()
    })

    test('end to end: declared ids run and are handed declared settings', async () => {
        const seen = []
        const declared = normalizeDefaultInteractions({
            click: { 'wind:report': { speedProp: 'windSpeed' } },
        })
        const pipeline = resolveLayerInteractions({}, undefined, declared.ids)
            .click
        const ctx = {
            eventType: 'click',
            layerData: {},
            typeInteractionConfigs: declared.settings,
        }
        await runInteractions(pipeline, ctx, {
            handlers: {
                'wind:report': { use: (c) => seen.push(c.config) },
            },
            config: {
                clickPreamble: [],
                clickPostamble: [],
                hoverDefaults: [],
                mouseoutDefaults: [],
                suppressionMap: {},
                kindPipelines: {},
                configPaths: { 'wind:report': 'variables.wind' },
            },
        })
        expect(pipeline).toEqual(['wind:report'])
        expect(seen).toEqual([{ speedProp: 'windSpeed' }])
    })
})

test.describe('manifest validation', () => {
    const validate = (di) =>
        validatePluginConfig(manifest(di), 'Wind', 'layertype')

    test('both forms are valid', () => {
        expect(validate({ click: ['identify:popup'] })).toEqual([])
        expect(
            validate({ click: { 'wind:report': { speedProp: 'ws' } } })
        ).toEqual([])
        expect(validate({ click: { 'wind:report': {} } })).toEqual([])
    })

    test('a malformed declaration is an error, not a silent no-op', () => {
        const cases = [
            { di: { click: 'identify:popup' }, at: 'defaultInteractions.click' },
            { di: { click: [7] }, at: 'defaultInteractions.click' },
            {
                di: { click: { 'wind:report': 'loud' } },
                at: 'defaultInteractions.click.wind:report',
            },
            {
                di: { click: { 'wind:report': ['a'] } },
                at: 'defaultInteractions.click.wind:report',
            },
            { di: ['click'], at: 'defaultInteractions' },
        ]
        for (const { di, at } of cases) {
            const errors = validate(di)
            expect(
                errors.some((e) => e.includes(at)),
                `${JSON.stringify(di)} should be reported at ${at}`
            ).toBe(true)
        }
    })
})
