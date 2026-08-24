import { test, expect } from '@playwright/test'
import {
    copilotActionId,
    createCopilotActionRegistry,
} from '../../src/essence/mmgisAPI/CopilotActionRegistry.js'

const descriptor = (overrides = {}) => ({
    name: 'summarize_layer',
    plugin: 'example/tools/Analysis',
    category: 'analytics',
    description: 'Summarize values in a configured data layer.',
    parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
            layer: { type: 'string', minLength: 1, maxLength: 64 },
        },
        required: ['layer'],
    },
    ...overrides,
})

function makeRegistry(options = {}) {
    const errors = []
    const registry = createCopilotActionRegistry({
        logger: {
            error(...args) {
                errors.push(args)
            },
        },
        ...options,
    })
    return { registry, errors }
}

test.describe('CopilotActionRegistry', () => {
    test('discovers and invokes a plugin action through immutable descriptors', async () => {
        const { registry } = makeRegistry()
        let availabilityDescriptor
        const id = registry.register(
            descriptor(),
            async (args, context) => ({
                message: `Summarized ${args.layer}.`,
                data: { count: 4, mission: context.mission },
            }),
            ({ descriptor: actionDescriptor }) => {
                availabilityDescriptor = actionDescriptor
                return true
            }
        )

        expect(id).toBe('example_tools_analysis__summarize_layer')
        const discovered = await registry.list()
        expect(discovered).toEqual([
            expect.objectContaining({
                id,
                name: 'summarize_layer',
                plugin: 'example/tools/Analysis',
                category: 'analytics',
                available: true,
            }),
        ])
        expect(Object.isFrozen(discovered)).toBe(true)
        expect(Object.isFrozen(discovered[0])).toBe(true)
        expect(Object.isFrozen(discovered[0].parameters)).toBe(true)
        expect(Object.isFrozen(discovered[0].parameters.properties)).toBe(true)
        expect(Object.isFrozen(availabilityDescriptor)).toBe(true)
        expect(discovered[0].handler).toBeUndefined()
        expect(discovered[0].availability).toBeUndefined()

        await expect(
            registry.execute(id, { layer: 'Temperature' }, { mission: 'Demo' })
        ).resolves.toEqual({
            ok: true,
            message: 'Summarized Temperature.',
            data: { count: 4, mission: 'Demo' },
            error: null,
        })
    })

    test('validates arguments against the advertised JSON Schema subset', async () => {
        const { registry } = makeRegistry()
        let invocations = 0
        const id = registry.register(
            descriptor({
                name: 'configure_analysis',
                parameters: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['layer', 'mode', 'samples'],
                    properties: {
                        layer: { type: 'string', minLength: 1 },
                        mode: { type: 'string', enum: ['point', 'bbox'] },
                        samples: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 10,
                        },
                        bands: {
                            type: 'array',
                            minItems: 1,
                            maxItems: 3,
                            uniqueItems: true,
                            items: { type: 'integer', minimum: 1 },
                        },
                        windows: {
                            type: 'array',
                            uniqueItems: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                required: ['x', 'y'],
                                properties: {
                                    x: { type: 'integer' },
                                    y: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
            }),
            (args) => {
                invocations += 1
                return { data: args }
            }
        )

        const invalid = await registry.execute(id, {
            layer: '',
            mode: 'polygon',
            samples: 11,
            bands: [1, 1],
            windows: [
                { x: 1, y: 2 },
                { y: 2, x: 1 },
            ],
            privateOption: true,
        })
        expect(invalid.ok).toBe(false)
        expect(invalid.error.code).toBe('INVALID_ACTION_ARGUMENTS')
        expect(invalid.error.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '$.layer' }),
                expect.objectContaining({ path: '$.mode' }),
                expect.objectContaining({ path: '$.samples' }),
                expect.objectContaining({ path: '$.bands' }),
                expect.objectContaining({ path: '$.windows' }),
                expect.objectContaining({ path: '$.privateOption' }),
            ])
        )
        expect(invocations).toBe(0)

        const inheritedPropertyName = await registry.execute(id, {
            layer: 'Temperature',
            mode: 'bbox',
            samples: 4,
            toString: 'not advertised',
        })
        expect(inheritedPropertyName.error.issues).toContainEqual(
            expect.objectContaining({ path: '$.toString' })
        )
        expect(invocations).toBe(0)

        const validArgs = {
            layer: 'Temperature',
            mode: 'bbox',
            samples: 4,
            bands: [1, 2],
        }
        const valid = await registry.execute(id, validArgs)
        expect(valid.ok).toBe(true)
        expect(valid.data).toEqual(validArgs)
        expect(invocations).toBe(1)
    })

    test('rejects schemas outside the documented, enforced subset', () => {
        const { registry } = makeRegistry()
        expect(() =>
            registry.register(
                descriptor({
                    parameters: {
                        type: 'object',
                        properties: {
                            layer: { type: 'string', pattern: '^safe$' },
                        },
                    },
                }),
                () => 'done'
            )
        ).toThrow(/unsupported keyword "pattern"/)
        expect(() =>
            registry.register(
                descriptor({ parameters: { properties: {} } }),
                () => 'done'
            )
        ).toThrow(/parameters\.type must be "object"/)
        expect(() =>
            registry.register(
                descriptor({
                    parameters: {
                        type: 'object',
                        properties: { value: { type: ['string', 'null'] } },
                    },
                }),
                () => 'done'
            )
        ).toThrow(/must be one supported JSON type/)
    })

    test('rejects descriptor and analytics accessors without invoking them', () => {
        const { registry } = makeRegistry()
        let descriptorGetterInvoked = false
        const accessorDescriptor = descriptor()
        Object.defineProperty(accessorDescriptor, 'description', {
            enumerable: true,
            get() {
                descriptorGetterInvoked = true
                return 'Unsafe accessor description.'
            },
        })
        expect(() => registry.register(accessorDescriptor, () => 'done')).toThrow(
            /description must be a data property/
        )
        expect(descriptorGetterInvoked).toBe(false)

        let analyticsGetterInvoked = false
        const operations = ['statistics']
        Object.defineProperty(operations, '0', {
            enumerable: true,
            get() {
                analyticsGetterInvoked = true
                return 'statistics'
            },
        })
        expect(() =>
            registry.register(
                descriptor({ analytics: { operations } }),
                () => 'done'
            )
        ).toThrow(/values must be data properties/)
        expect(analyticsGetterInvoked).toBe(false)
    })

    test('bounds schema depth, schema size, arguments, results, and action count', async () => {
        const limited = makeRegistry({ maxActions: 1 }).registry
        limited.register(descriptor(), () => 'done')
        expect(() =>
            limited.register(
                descriptor({ name: 'second_action' }),
                () => 'done'
            )
        ).toThrow(/at most 1 actions/)
        expect(() =>
            makeRegistry({ maxRegistryBytes: 200 }).registry.register(
                descriptor(),
                () => 'done'
            )
        ).toThrow(/serialized descriptor bytes/)

        const { registry } = makeRegistry()
        let nestedSchema = { type: 'string' }
        for (let index = 0; index < 14; index += 1)
            nestedSchema = { type: 'array', items: nestedSchema }
        expect(() =>
            registry.register(
                descriptor({
                    name: 'deep_schema',
                    parameters: {
                        type: 'object',
                        properties: { nested: nestedSchema },
                    },
                }),
                () => 'done'
            )
        ).toThrow(/maximum nesting depth/)
        const largeProperties = Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => [
                `field_${index}`,
                { type: 'string', description: 'x'.repeat(2000) },
            ])
        )
        expect(() =>
            registry.register(
                descriptor({
                    name: 'large_schema',
                    parameters: {
                        type: 'object',
                        properties: largeProperties,
                    },
                }),
                () => 'done'
            )
        ).toThrow(/32768-byte limit/)

        let invoked = false
        const id = registry.register(
            descriptor({ name: 'bounded_values' }),
            () => {
                invoked = true
                return { data: Array(3000).fill('x'.repeat(100)) }
            }
        )
        const oversizedArgs = await registry.execute(id, {
            layer: 'x'.repeat(33000),
        })
        expect(oversizedArgs.error.code).toBe('INVALID_ACTION_ARGUMENTS')
        expect(invoked).toBe(false)

        const oversizedResult = await registry.execute(id, { layer: 'valid' })
        expect(oversizedResult).toEqual({
            ok: false,
            message: 'bounded values returned an invalid result.',
            data: null,
            error: { code: 'ACTION_RESULT_INVALID' },
        })
    })

    test('bounds registry-generated validation failure details', async () => {
        const { registry } = makeRegistry()
        const required = Array.from(
            { length: 16 },
            (_, index) => `field_${index}`
        )
        const properties = Object.fromEntries(
            required.map((name) => [name, { type: 'string' }])
        )
        let invoked = false
        const id = registry.register(
            descriptor({
                name: 'bounded_validation_failure',
                parameters: {
                    type: 'object',
                    additionalProperties: {
                        type: 'object',
                        required,
                        properties,
                    },
                },
            }),
            () => {
                invoked = true
                return 'not invoked'
            }
        )

        const oversizedPath = 'x'.repeat(60000)
        const result = await registry.execute(id, { [oversizedPath]: {} })
        const serializedBytes = new TextEncoder().encode(
            JSON.stringify(result)
        ).byteLength

        expect(result.ok).toBe(false)
        expect(result.error.code).toBe('INVALID_ACTION_ARGUMENTS')
        expect(serializedBytes).toBeLessThanOrEqual(256 * 1024)
        expect(Object.isFrozen(result)).toBe(true)
        expect(Object.isFrozen(result.error)).toBe(true)
        expect(invoked).toBe(false)
    })

    test('rejects circular and non-JSON values without invoking handlers', async () => {
        const { registry } = makeRegistry()
        let invocations = 0
        const id = registry.register(descriptor(), () => {
            invocations += 1
            return 'done'
        })
        const circular = { layer: 'Temperature' }
        circular.self = circular
        expect((await registry.execute(id, circular)).error.code).toBe(
            'INVALID_ACTION_ARGUMENTS'
        )
        expect(
            (
                await registry.execute(id, {
                    layer: 'Temperature',
                    callback() {},
                })
            ).error.code
        ).toBe('INVALID_ACTION_ARGUMENTS')
        let getterInvoked = false
        const accessorArgs = { layer: 'Temperature' }
        Object.defineProperty(accessorArgs, 'callback', {
            enumerable: true,
            get() {
                getterInvoked = true
                return 'not safe JSON data'
            },
        })
        expect((await registry.execute(id, accessorArgs)).error.code).toBe(
            'INVALID_ACTION_ARGUMENTS'
        )
        expect(getterInvoked).toBe(false)
        expect(
            (
                await registry.execute(id, {
                    layer: `Temperature${String.fromCharCode(0)}`,
                })
            ).error.code
        ).toBe('INVALID_ACTION_ARGUMENTS')
        expect(invocations).toBe(0)
    })

    test('times out availability checks and never invokes unavailable handlers', async () => {
        let availabilitySignal
        let invoked = false
        const { registry } = makeRegistry({ availabilityTimeoutMs: 10 })
        const id = registry.register(
            descriptor(),
            () => {
                invoked = true
            },
            ({ signal }) => {
                availabilitySignal = signal
                return new Promise(() => {})
            }
        )

        const listed = await registry.list()
        expect(listed[0]).toMatchObject({
            available: false,
            unavailableReason: 'Capability availability check timed out.',
        })
        expect(availabilitySignal.aborted).toBe(true)
        const result = await registry.execute(id, { layer: 'Temperature' })
        expect(result.error.code).toBe('ACTION_UNAVAILABLE')
        expect(invoked).toBe(false)
    })

    test('times out handlers and provides an abort signal', async () => {
        let handlerSignal
        const { registry } = makeRegistry({ handlerTimeoutMs: 10 })
        const id = registry.register(descriptor(), (args, context, control) => {
            handlerSignal = control.signal
            return new Promise(() => {})
        })

        const result = await registry.execute(id, { layer: 'Temperature' })
        expect(result).toEqual({
            ok: false,
            message: 'summarize layer timed out.',
            data: null,
            error: { code: 'ACTION_EXECUTION_TIMEOUT' },
        })
        expect(handlerSignal.aborted).toBe(true)
    })

    test('redacts thrown errors while retaining raw diagnostics in the logger', async () => {
        const { registry, errors } = makeRegistry()
        const id = registry.register(descriptor(), () => {
            const error = new Error('secret token abc123 at C:\\private\\file')
            error.code = 'ETIMEDOUT'
            throw error
        })

        const result = await registry.execute(id, { layer: 'Temperature' })
        expect(result).toEqual({
            ok: false,
            message: 'summarize layer could not be completed.',
            data: null,
            error: { code: 'ACTION_EXECUTION_FAILED' },
        })
        expect(JSON.stringify(result)).not.toContain('abc123')
        expect(JSON.stringify(result)).not.toContain('private')
        expect(errors).toHaveLength(1)
        expect(errors[0][1].message).toContain('abc123')
    })

    test('keeps only a declared public error code from handler failures', async () => {
        const { registry } = makeRegistry()
        const id = registry.register(descriptor(), () => ({
            ok: false,
            message: 'The configured layer is not available.',
            error: {
                code: 'LAYER_UNAVAILABLE',
                message: 'internal endpoint and credential details',
                stack: 'private stack',
            },
        }))
        expect(await registry.execute(id, { layer: 'Missing' })).toEqual({
            ok: false,
            message: 'The configured layer is not available.',
            data: null,
            error: { code: 'LAYER_UNAVAILABLE' },
        })
    })

    test('infers an expected failure from a non-null error when ok is omitted', async () => {
        const { registry } = makeRegistry()
        const id = registry.register(descriptor(), () => ({
            message: 'The configured layer is not available.',
            error: {
                code: 'LAYER_UNAVAILABLE',
                message: 'internal endpoint and credential details',
            },
        }))

        expect(await registry.execute(id, { layer: 'Missing' })).toEqual({
            ok: false,
            message: 'The configured layer is not available.',
            data: null,
            error: { code: 'LAYER_UNAVAILABLE' },
        })
    })

    test('uses opaque handles for HMR-safe replacement and stale teardown', async () => {
        const { registry } = makeRegistry()
        const first = registry.register(
            descriptor(),
            () => 'first',
            true,
            { returnHandle: true }
        )
        const replacement = registry.register(
            descriptor(),
            () => 'replacement',
            true,
            { replaceExisting: true, returnHandle: true }
        )

        expect(Object.isFrozen(first)).toBe(true)
        expect(first.id).toBe(replacement.id)
        expect(registry.unregister(first)).toBe(false)
        expect(await registry.execute(replacement.id, { layer: 'Test' })).toEqual({
            ok: true,
            message: 'replacement',
            data: null,
            error: null,
        })
        expect(() => registry.unregister({ id: replacement.id })).toThrow(
            /valid Copilot action registration handle/
        )
        expect(registry.unregister(replacement)).toBe(true)
        expect(await registry.list()).toEqual([])
    })

    test('protects legacy unregister ownership and model-id collisions', async () => {
        const { registry } = makeRegistry()
        const id = registry.register(descriptor({ plugin: 'org.plugin' }), () =>
            'one'
        )
        expect(() =>
            registry.register(descriptor({ plugin: 'org/plugin' }), () => 'two')
        ).toThrow(/owned by plugin "org\.plugin"/)
        expect(() => registry.unregister(id, 'another-plugin')).toThrow(
            /cannot unregister/
        )
        expect(registry.unregister(id, 'org.plugin')).toBe(true)
        expect(await registry.list()).toEqual([])
    })

    test('filters unavailable actions and bounds analytics metadata', async () => {
        const { registry } = makeRegistry()
        registry.register(
            descriptor({
                analytics: {
                    operations: ['statistics', ' mean ', 'mean'],
                    dataKinds: ['scalar-raster', 'time-series'],
                    requiresScalar: true,
                },
            }),
            () => 'done',
            () => ({ available: false, reason: 'No scalar source is visible.' })
        )

        const [listed] = await registry.list()
        expect(listed.analytics).toEqual({
            operations: ['statistics', 'mean'],
            dataKinds: ['scalar-raster', 'time-series'],
            requiresScalar: true,
        })
        expect(Object.isFrozen(listed.analytics.operations)).toBe(true)
        expect(await registry.list({ availableOnly: true })).toEqual([])
        expect(() =>
            makeRegistry().registry.register(
                descriptor({
                    analytics: { dataKinds: Array(33).fill('scalar') },
                }),
                () => 'done'
            )
        ).toThrow(/at most 32 values/)
    })

    test('normalizes primitive and empty handler results', async () => {
        const { registry } = makeRegistry()
        const numberId = registry.register(
            descriptor({ name: 'count_features' }),
            () => 7
        )
        const emptyId = registry.register(
            descriptor({ name: 'reset_highlight' }),
            () => undefined
        )

        expect(await registry.execute(numberId, { layer: 'Test' })).toEqual({
            ok: true,
            message: 'count features completed.',
            data: 7,
            error: null,
        })
        expect(await registry.execute(emptyId, { layer: 'Test' })).toEqual({
            ok: true,
            message: 'reset highlight completed.',
            data: null,
            error: null,
        })
    })

    test('uses portable, bounded model-visible ids', () => {
        expect(copilotActionId('NASA/MMGIS.Plugin', 'Run Stats')).toBe(
            'nasa_mmgis_plugin__run_stats'
        )
        expect(copilotActionId('9-labs/tools/Analysis', 'mean')).toBe(
            'action_9-labs_tools_analysis__mean'
        )
        expect(
            copilotActionId(
                'very-long-plugin-name-that-needs-to-be-shortened-for-model-tools',
                'very-long-action-name-that-also-needs-to-be-shortened'
            )
        ).toMatch(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
    })
})
