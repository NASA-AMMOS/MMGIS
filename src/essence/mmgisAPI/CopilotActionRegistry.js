const ACTION_IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/
const PLUGIN_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,191}$/
const CATEGORY_IDENTIFIER = /^[A-Za-z][A-Za-z0-9._/-]{0,63}$/
const PUBLIC_ACTION_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/
const PUBLIC_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/

const MAX_ACTIONS = 128
const MAX_REGISTRY_BYTES = 512 * 1024
const MAX_DESCRIPTION_LENGTH = 4096
const MAX_ANALYTICS_VALUES = 32
const MAX_ANALYTICS_VALUE_LENGTH = 64
const MAX_AVAILABILITY_REASON_LENGTH = 512
const MAX_RESULT_MESSAGE_LENGTH = 2048
const MAX_VALIDATION_ISSUES = 16
const DEFAULT_AVAILABILITY_TIMEOUT_MS = 2000
const DEFAULT_HANDLER_TIMEOUT_MS = 30000
const MAX_AVAILABILITY_TIMEOUT_MS = 30000
const MAX_HANDLER_TIMEOUT_MS = 120000

const SCHEMA_COPY_LIMITS = Object.freeze({
    maxDepth: 12,
    maxNodes: 2048,
    maxBytes: 32 * 1024,
    maxStringLength: 8192,
    maxArrayLength: 256,
    maxObjectKeys: 256,
})
const ARGUMENT_COPY_LIMITS = Object.freeze({
    maxDepth: 16,
    maxNodes: 4096,
    maxBytes: 64 * 1024,
    maxStringLength: 32768,
    maxArrayLength: 1024,
    maxObjectKeys: 256,
})
const RESULT_COPY_LIMITS = Object.freeze({
    maxDepth: 16,
    maxNodes: 8192,
    maxBytes: 256 * 1024,
    maxStringLength: 131072,
    maxArrayLength: 4096,
    maxObjectKeys: 512,
})

const JSON_SCHEMA_TYPES = new Set([
    'object',
    'array',
    'string',
    'number',
    'integer',
    'boolean',
    'null',
])
const JSON_SCHEMA_KEYWORDS = new Set([
    '$schema',
    '$comment',
    'title',
    'description',
    'type',
    'enum',
    'const',
    'default',
    'examples',
    'properties',
    'required',
    'additionalProperties',
    'items',
    'minLength',
    'maxLength',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
])
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const textEncoder =
    typeof TextEncoder === 'function' ? new TextEncoder() : null

const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key)

class BoundedValueError extends TypeError {
    constructor(message) {
        super(message)
        this.name = 'BoundedValueError'
    }
}

class OperationTimeoutError extends Error {
    constructor(operation) {
        super(`${operation} timed out.`)
        this.name = 'OperationTimeoutError'
    }
}

function isPlainObject(value) {
    if (value == null || typeof value !== 'object') return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function isSafePropertyName(value) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        !UNSAFE_OBJECT_KEYS.has(value)
    )
}

function assertIdentifier(value, field, pattern) {
    if (typeof value !== 'string' || !pattern.test(value.trim())) {
        throw new TypeError(`Copilot action descriptor.${field} is invalid.`)
    }
    return value.trim()
}

function ownDataValue(object, key, label) {
    const property = Object.getOwnPropertyDescriptor(object, key)
    if (!property) return undefined
    if (!hasOwn(property, 'value'))
        throw new TypeError(`${label}.${key} must be a data property.`)
    return property.value
}

function hasUnsafeControlText(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if ((code <= 8 || (code >= 11 && code <= 31)) || code === 127)
            return true
    }
    return false
}

function replaceUnsafeControlText(value) {
    let output = ''
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        output +=
            code <= 8 || (code >= 11 && code <= 31) || code === 127
                ? ' '
                : value[index]
    }
    return output
}

function serializedByteLength(value) {
    const serialized = JSON.stringify(value)
    if (typeof serialized !== 'string')
        throw new BoundedValueError('The value is not JSON serializable.')
    return textEncoder
        ? textEncoder.encode(serialized).byteLength
        : serialized.length * 3
}

function copyBounded(value, limits, label) {
    const seen = new WeakSet()
    let nodes = 0

    function visit(current, depth, path) {
        nodes += 1
        if (nodes > limits.maxNodes)
            throw new BoundedValueError(
                `${label} exceeds the ${limits.maxNodes}-value limit.`
            )
        if (depth > limits.maxDepth)
            throw new BoundedValueError(
                `${label} exceeds the maximum nesting depth of ${limits.maxDepth}.`
            )

        if (current === null || typeof current === 'boolean') return current
        if (typeof current === 'string') {
            if (current.length > limits.maxStringLength)
                throw new BoundedValueError(
                    `${label} contains an oversized string at ${path}.`
                )
            if (hasUnsafeControlText(current))
                throw new BoundedValueError(
                    `${label} contains unsafe control text at ${path}.`
                )
            return current
        }
        if (typeof current === 'number') {
            if (!Number.isFinite(current))
                throw new BoundedValueError(
                    `${label} contains a non-finite number at ${path}.`
                )
            return current
        }
        if (typeof current !== 'object')
            throw new BoundedValueError(
                `${label} contains a non-JSON value at ${path}.`
            )
        if (seen.has(current))
            throw new BoundedValueError(
                `${label} contains a circular reference at ${path}.`
            )

        seen.add(current)
        try {
            if (Array.isArray(current)) {
                if (current.length > limits.maxArrayLength)
                    throw new BoundedValueError(
                        `${label} contains an oversized array at ${path}.`
                    )
                const output = []
                for (let index = 0; index < current.length; index += 1) {
                    if (!hasOwn(current, index)) {
                        output.push(null)
                        continue
                    }
                    const property = Object.getOwnPropertyDescriptor(
                        current,
                        String(index)
                    )
                    if (!property || !hasOwn(property, 'value'))
                        throw new BoundedValueError(
                            `${label} contains an accessor at ${path}[${index}].`
                        )
                    output.push(
                        visit(property.value, depth + 1, `${path}[${index}]`)
                    )
                }
                return output
            }

            if (!isPlainObject(current))
                throw new BoundedValueError(
                    `${label} contains a non-plain object at ${path}.`
                )
            const keys = Object.keys(current)
            if (keys.length > limits.maxObjectKeys)
                throw new BoundedValueError(
                    `${label} contains too many object properties at ${path}.`
                )

            const output = {}
            keys.forEach((key) => {
                if (UNSAFE_OBJECT_KEYS.has(key))
                    throw new BoundedValueError(
                        `${label} contains an unsafe property at ${path}.`
                    )
                const property = Object.getOwnPropertyDescriptor(current, key)
                if (!property || !hasOwn(property, 'value'))
                    throw new BoundedValueError(
                        `${label} contains an accessor at ${path}.${key}.`
                    )
                output[key] = visit(
                    property.value,
                    depth + 1,
                    `${path}.${key}`
                )
            })
            return output
        } finally {
            seen.delete(current)
        }
    }

    const copied = visit(value, 0, '$')
    if (serializedByteLength(copied) > limits.maxBytes)
        throw new BoundedValueError(
            `${label} exceeds the ${limits.maxBytes}-byte limit.`
        )
    return copied
}

function deepFreeze(value) {
    if (value == null || typeof value !== 'object' || Object.isFrozen(value))
        return value
    Object.keys(value).forEach((key) => deepFreeze(value[key]))
    return Object.freeze(value)
}

function safePublicText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback
    const normalized = replaceUnsafeControlText(value).trim()
    if (!normalized) return fallback
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`
}

function validateAnalyticsList(value, field) {
    if (value === undefined) return undefined
    if (!Array.isArray(value))
        throw new TypeError(
            `Copilot action descriptor.analytics.${field} must be an array.`
        )
    if (value.length > MAX_ANALYTICS_VALUES)
        throw new RangeError(
            `Copilot action descriptor.analytics.${field} may contain at most ${MAX_ANALYTICS_VALUES} values.`
        )

    const output = []
    const seen = new Set()
    for (let index = 0; index < value.length; index += 1) {
        const property = Object.getOwnPropertyDescriptor(value, String(index))
        if (!property || !hasOwn(property, 'value'))
            throw new TypeError(
                `Copilot action descriptor.analytics.${field} values must be data properties.`
            )
        const entry = property.value
        if (typeof entry !== 'string')
            throw new TypeError(
                `Copilot action descriptor.analytics.${field} values must be strings.`
            )
        const normalized = entry.trim()
        if (
            normalized.length === 0 ||
            normalized.length > MAX_ANALYTICS_VALUE_LENGTH ||
            hasUnsafeControlText(normalized)
        )
            throw new TypeError(
                `Copilot action descriptor.analytics.${field} values must be 1 to ${MAX_ANALYTICS_VALUE_LENGTH} safe characters.`
            )
        if (!seen.has(normalized)) {
            seen.add(normalized)
            output.push(normalized)
        }
    }
    return Object.freeze(output)
}

function validateAnalyticsMetadata(value) {
    if (value === undefined) return undefined
    if (!isPlainObject(value))
        throw new TypeError(
            'Copilot action descriptor.analytics must be a plain object.'
        )

    const analytics = {}
    const operations = validateAnalyticsList(
        ownDataValue(
            value,
            'operations',
            'Copilot action descriptor.analytics'
        ),
        'operations'
    )
    const dataKinds = validateAnalyticsList(
        ownDataValue(
            value,
            'dataKinds',
            'Copilot action descriptor.analytics'
        ),
        'dataKinds'
    )
    if (operations !== undefined) analytics.operations = operations
    if (dataKinds !== undefined) analytics.dataKinds = dataKinds
    if (hasOwn(value, 'requiresScalar')) {
        const requiresScalar = ownDataValue(
            value,
            'requiresScalar',
            'Copilot action descriptor.analytics'
        )
        if (typeof requiresScalar !== 'boolean')
            throw new TypeError(
                'Copilot action descriptor.analytics.requiresScalar must be a boolean.'
            )
        analytics.requiresScalar = requiresScalar
    }
    return Object.freeze(analytics)
}

function schemaTypeMatches(value, type) {
    if (type === 'null') return value === null
    if (type === 'array') return Array.isArray(value)
    if (type === 'object') return isPlainObject(value)
    if (type === 'integer') return Number.isInteger(value)
    if (type === 'number')
        return typeof value === 'number' && Number.isFinite(value)
    return typeof value === type
}

function validateNonNegativeInteger(schema, keyword, path) {
    if (!hasOwn(schema, keyword)) return
    if (!Number.isInteger(schema[keyword]) || schema[keyword] < 0)
        throw new TypeError(
            `Copilot action schema ${path}.${keyword} must be a non-negative integer.`
        )
}

function validateFiniteNumber(schema, keyword, path, positive = false) {
    if (!hasOwn(schema, keyword)) return
    if (
        typeof schema[keyword] !== 'number' ||
        !Number.isFinite(schema[keyword]) ||
        (positive && schema[keyword] <= 0)
    )
        throw new TypeError(
            `Copilot action schema ${path}.${keyword} must be a ${
                positive ? 'positive ' : ''
            }finite number.`
        )
}

function validateSchemaDefinition(schema, path = '$', isRoot = false) {
    if (!isPlainObject(schema))
        throw new TypeError(
            `Copilot action schema ${path} must be a plain object.`
        )

    Object.keys(schema).forEach((keyword) => {
        if (!JSON_SCHEMA_KEYWORDS.has(keyword))
            throw new TypeError(
                `Copilot action schema ${path} uses unsupported keyword "${keyword}".`
            )
    })

    const type = schema.type
    if (type !== undefined && !JSON_SCHEMA_TYPES.has(type))
        throw new TypeError(
            `Copilot action schema ${path}.type must be one supported JSON type.`
        )
    if (isRoot && type !== 'object')
        throw new TypeError(
            'Copilot action descriptor.parameters.type must be "object".'
        )

    if (hasOwn(schema, 'enum')) {
        if (
            !Array.isArray(schema.enum) ||
            schema.enum.length === 0 ||
            schema.enum.length > 128
        )
            throw new TypeError(
                `Copilot action schema ${path}.enum must contain 1 to 128 primitive values.`
            )
        const values = new Set()
        schema.enum.forEach((value) => {
            if (
                value !== null &&
                !['string', 'number', 'boolean'].includes(typeof value)
            )
                throw new TypeError(
                    `Copilot action schema ${path}.enum supports primitive values only.`
                )
            if (type && !schemaTypeMatches(value, type))
                throw new TypeError(
                    `Copilot action schema ${path}.enum contains a value outside its type.`
                )
            const serialized = JSON.stringify(value)
            if (values.has(serialized))
                throw new TypeError(
                    `Copilot action schema ${path}.enum contains duplicate values.`
                )
            values.add(serialized)
        })
    }
    if (hasOwn(schema, 'const')) {
        const value = schema.const
        if (
            value !== null &&
            !['string', 'number', 'boolean'].includes(typeof value)
        )
            throw new TypeError(
                `Copilot action schema ${path}.const supports a primitive value only.`
            )
        if (type && !schemaTypeMatches(value, type))
            throw new TypeError(
                `Copilot action schema ${path}.const is outside its type.`
            )
    }

    const objectKeywords = [
        'properties',
        'required',
        'additionalProperties',
        'minProperties',
        'maxProperties',
    ]
    if (objectKeywords.some((keyword) => hasOwn(schema, keyword)) && type !== 'object')
        throw new TypeError(
            `Copilot action schema ${path} uses object keywords without type "object".`
        )
    if (hasOwn(schema, 'properties')) {
        if (!isPlainObject(schema.properties))
            throw new TypeError(
                `Copilot action schema ${path}.properties must be an object.`
            )
        Object.keys(schema.properties).forEach((propertyName) => {
            if (!isSafePropertyName(propertyName))
                throw new TypeError(
                    `Copilot action schema ${path}.properties contains an unsafe property name.`
                )
            validateSchemaDefinition(
                schema.properties[propertyName],
                `${path}.properties.${propertyName}`
            )
        })
    }
    if (hasOwn(schema, 'required')) {
        if (!Array.isArray(schema.required))
            throw new TypeError(
                `Copilot action schema ${path}.required must be an array.`
            )
        const required = new Set()
        schema.required.forEach((propertyName) => {
            if (!isSafePropertyName(propertyName) || required.has(propertyName))
                throw new TypeError(
                    `Copilot action schema ${path}.required must contain unique, safe property names.`
                )
            required.add(propertyName)
        })
    }
    if (hasOwn(schema, 'additionalProperties')) {
        if (
            typeof schema.additionalProperties !== 'boolean' &&
            !isPlainObject(schema.additionalProperties)
        )
            throw new TypeError(
                `Copilot action schema ${path}.additionalProperties must be a boolean or schema.`
            )
        if (isPlainObject(schema.additionalProperties))
            validateSchemaDefinition(
                schema.additionalProperties,
                `${path}.additionalProperties`
            )
    }
    validateNonNegativeInteger(schema, 'minProperties', path)
    validateNonNegativeInteger(schema, 'maxProperties', path)
    if (
        hasOwn(schema, 'minProperties') &&
        hasOwn(schema, 'maxProperties') &&
        schema.minProperties > schema.maxProperties
    )
        throw new TypeError(
            `Copilot action schema ${path}.minProperties exceeds maxProperties.`
        )

    const arrayKeywords = ['items', 'minItems', 'maxItems', 'uniqueItems']
    if (arrayKeywords.some((keyword) => hasOwn(schema, keyword)) && type !== 'array')
        throw new TypeError(
            `Copilot action schema ${path} uses array keywords without type "array".`
        )
    if (hasOwn(schema, 'items')) {
        if (!isPlainObject(schema.items))
            throw new TypeError(
                `Copilot action schema ${path}.items must be a schema object.`
            )
        validateSchemaDefinition(schema.items, `${path}.items`)
    }
    validateNonNegativeInteger(schema, 'minItems', path)
    validateNonNegativeInteger(schema, 'maxItems', path)
    if (
        hasOwn(schema, 'minItems') &&
        hasOwn(schema, 'maxItems') &&
        schema.minItems > schema.maxItems
    )
        throw new TypeError(
            `Copilot action schema ${path}.minItems exceeds maxItems.`
        )
    if (
        hasOwn(schema, 'uniqueItems') &&
        typeof schema.uniqueItems !== 'boolean'
    )
        throw new TypeError(
            `Copilot action schema ${path}.uniqueItems must be a boolean.`
        )

    const stringKeywords = ['minLength', 'maxLength']
    if (stringKeywords.some((keyword) => hasOwn(schema, keyword)) && type !== 'string')
        throw new TypeError(
            `Copilot action schema ${path} uses string keywords without type "string".`
        )
    validateNonNegativeInteger(schema, 'minLength', path)
    validateNonNegativeInteger(schema, 'maxLength', path)
    if (
        hasOwn(schema, 'minLength') &&
        hasOwn(schema, 'maxLength') &&
        schema.minLength > schema.maxLength
    )
        throw new TypeError(
            `Copilot action schema ${path}.minLength exceeds maxLength.`
        )

    const numberKeywords = [
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'multipleOf',
    ]
    if (
        numberKeywords.some((keyword) => hasOwn(schema, keyword)) &&
        type !== 'number' &&
        type !== 'integer'
    )
        throw new TypeError(
            `Copilot action schema ${path} uses numeric keywords without a numeric type.`
        )
    validateFiniteNumber(schema, 'minimum', path)
    validateFiniteNumber(schema, 'maximum', path)
    validateFiniteNumber(schema, 'exclusiveMinimum', path)
    validateFiniteNumber(schema, 'exclusiveMaximum', path)
    validateFiniteNumber(schema, 'multipleOf', path, true)
}

function samePrimitive(left, right) {
    return left === right
}

function appendValidationIssue(issues, path, message) {
    if (issues.length >= MAX_VALIDATION_ISSUES) return
    issues.push({ path, message })
}

function propertyPath(path, key) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`
}

function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(',')}]`
    if (isPlainObject(value))
        return `{${Object.keys(value)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
            )
            .join(',')}}`
    return JSON.stringify(value)
}

function validateSchemaValue(value, schema, path, issues) {
    if (issues.length >= MAX_VALIDATION_ISSUES) return

    if (schema.type && !schemaTypeMatches(value, schema.type)) {
        appendValidationIssue(issues, path, `must be ${schema.type}.`)
        return
    }
    if (
        schema.enum &&
        !schema.enum.some((candidate) => samePrimitive(value, candidate))
    )
        appendValidationIssue(issues, path, 'must be one of the advertised values.')
    if (hasOwn(schema, 'const') && !samePrimitive(value, schema.const))
        appendValidationIssue(issues, path, 'must equal the advertised constant.')

    if (schema.type === 'object') {
        const keys = Object.keys(value)
        if (
            hasOwn(schema, 'minProperties') &&
            keys.length < schema.minProperties
        )
            appendValidationIssue(
                issues,
                path,
                `must contain at least ${schema.minProperties} properties.`
            )
        if (
            hasOwn(schema, 'maxProperties') &&
            keys.length > schema.maxProperties
        )
            appendValidationIssue(
                issues,
                path,
                `must contain at most ${schema.maxProperties} properties.`
            )
        ;(schema.required || []).forEach((key) => {
            if (!hasOwn(value, key))
                appendValidationIssue(
                    issues,
                    propertyPath(path, key),
                    'is required.'
                )
        })
        keys.forEach((key) => {
            const propertySchema =
                schema.properties && hasOwn(schema.properties, key)
                    ? schema.properties[key]
                    : null
            if (propertySchema) {
                validateSchemaValue(
                    value[key],
                    propertySchema,
                    propertyPath(path, key),
                    issues
                )
                return
            }
            if (schema.additionalProperties === false) {
                appendValidationIssue(
                    issues,
                    propertyPath(path, key),
                    'is not an advertised property.'
                )
                return
            }
            if (isPlainObject(schema.additionalProperties))
                validateSchemaValue(
                    value[key],
                    schema.additionalProperties,
                    propertyPath(path, key),
                    issues
                )
        })
    }

    if (schema.type === 'array') {
        if (hasOwn(schema, 'minItems') && value.length < schema.minItems)
            appendValidationIssue(
                issues,
                path,
                `must contain at least ${schema.minItems} items.`
            )
        if (hasOwn(schema, 'maxItems') && value.length > schema.maxItems)
            appendValidationIssue(
                issues,
                path,
                `must contain at most ${schema.maxItems} items.`
            )
        if (schema.uniqueItems === true) {
            const seen = new Set()
            value.forEach((item) => {
                const serialized = canonicalJson(item)
                if (seen.has(serialized))
                    appendValidationIssue(issues, path, 'must contain unique items.')
                seen.add(serialized)
            })
        }
        if (schema.items)
            value.forEach((item, index) =>
                validateSchemaValue(item, schema.items, `${path}[${index}]`, issues)
            )
    }

    if (schema.type === 'string') {
        const length = [...value].length
        if (hasOwn(schema, 'minLength') && length < schema.minLength)
            appendValidationIssue(
                issues,
                path,
                `must contain at least ${schema.minLength} characters.`
            )
        if (hasOwn(schema, 'maxLength') && length > schema.maxLength)
            appendValidationIssue(
                issues,
                path,
                `must contain at most ${schema.maxLength} characters.`
            )
    }

    if (schema.type === 'number' || schema.type === 'integer') {
        if (hasOwn(schema, 'minimum') && value < schema.minimum)
            appendValidationIssue(issues, path, `must be at least ${schema.minimum}.`)
        if (hasOwn(schema, 'maximum') && value > schema.maximum)
            appendValidationIssue(issues, path, `must be at most ${schema.maximum}.`)
        if (
            hasOwn(schema, 'exclusiveMinimum') &&
            value <= schema.exclusiveMinimum
        )
            appendValidationIssue(
                issues,
                path,
                `must be greater than ${schema.exclusiveMinimum}.`
            )
        if (
            hasOwn(schema, 'exclusiveMaximum') &&
            value >= schema.exclusiveMaximum
        )
            appendValidationIssue(
                issues,
                path,
                `must be less than ${schema.exclusiveMaximum}.`
            )
        if (hasOwn(schema, 'multipleOf')) {
            const quotient = value / schema.multipleOf
            const tolerance =
                Number.EPSILON * Math.max(1, Math.abs(quotient)) * 8
            if (Math.abs(quotient - Math.round(quotient)) > tolerance)
                appendValidationIssue(
                    issues,
                    path,
                    `must be a multiple of ${schema.multipleOf}.`
                )
        }
    }
}

function hashIdentifier(value) {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36).padStart(7, '0').slice(-7)
}

function safeIdentifierPart(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

/**
 * Return the portable, model-visible id for a plugin capability.
 */
export function copilotActionId(plugin, name) {
    let raw = `${safeIdentifierPart(plugin)}__${safeIdentifierPart(name)}`
    if (!/^[a-z]/.test(raw)) raw = `action_${raw}`
    if (raw.length <= 64) return raw
    return `${raw.slice(0, 56)}_${hashIdentifier(raw)}`
}

function validateDescriptor(input) {
    if (!isPlainObject(input))
        throw new TypeError('Copilot action descriptor must be a plain object.')

    const name = assertIdentifier(
        ownDataValue(input, 'name', 'Copilot action descriptor'),
        'name',
        ACTION_IDENTIFIER
    )
    const plugin = assertIdentifier(
        ownDataValue(input, 'plugin', 'Copilot action descriptor'),
        'plugin',
        PLUGIN_IDENTIFIER
    )
    const category = assertIdentifier(
        ownDataValue(input, 'category', 'Copilot action descriptor'),
        'category',
        CATEGORY_IDENTIFIER
    )
    if (
        plugin.includes('..') ||
        plugin.endsWith('/') ||
        category.includes('..') ||
        category.endsWith('/')
    )
        throw new TypeError('Copilot action descriptor contains an invalid path.')
    const description = ownDataValue(
        input,
        'description',
        'Copilot action descriptor'
    )
    if (typeof description !== 'string')
        throw new TypeError(
            `Copilot action descriptor.description must be a non-empty safe string no longer than ${MAX_DESCRIPTION_LENGTH} characters.`
        )
    if (
        description.trim().length === 0 ||
        description.trim().length > MAX_DESCRIPTION_LENGTH ||
        hasUnsafeControlText(description)
    )
        throw new TypeError(
            `Copilot action descriptor.description must be a non-empty safe string no longer than ${MAX_DESCRIPTION_LENGTH} characters.`
        )
    const inputParameters = ownDataValue(
        input,
        'parameters',
        'Copilot action descriptor'
    )
    if (!isPlainObject(inputParameters))
        throw new TypeError(
            'Copilot action descriptor.parameters must be a plain JSON Schema object.'
        )

    const parameters = copyBounded(
        inputParameters,
        SCHEMA_COPY_LIMITS,
        'Copilot action schema'
    )
    validateSchemaDefinition(parameters, '$', true)
    deepFreeze(parameters)
    const analytics = validateAnalyticsMetadata(
        ownDataValue(input, 'analytics', 'Copilot action descriptor')
    )
    const descriptor = deepFreeze({
        id: copilotActionId(plugin, name),
        name,
        plugin,
        category,
        description: description.trim(),
        parameters,
        ...(analytics === undefined ? {} : { analytics }),
    })
    return {
        descriptor,
        serializedBytes: serializedByteLength(descriptor),
    }
}

function availabilityResult(value) {
    if (value == null || value === true)
        return { available: true, reason: null }
    if (value === false)
        return { available: false, reason: 'Capability is not available.' }
    if (typeof value === 'string')
        return {
            available: false,
            reason: safePublicText(
                value,
                'Capability is not available.',
                MAX_AVAILABILITY_REASON_LENGTH
            ),
        }
    if (isPlainObject(value) && typeof value.available === 'boolean') {
        return {
            available: value.available,
            reason: value.available
                ? null
                : safePublicText(
                      value.reason,
                      'Capability is not available.',
                      MAX_AVAILABILITY_REASON_LENGTH
                  ),
        }
    }
    return {
        available: false,
        reason: 'Capability availability could not be determined.',
    }
}

function operationController() {
    if (typeof AbortController === 'function') return new AbortController()
    const signal = { aborted: false }
    return {
        signal,
        abort() {
            signal.aborted = true
        },
    }
}

async function callWithTimeout(operation, timeoutMs, callback) {
    const controller = operationController()
    let timeoutId
    const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort()
            reject(new OperationTimeoutError(operation))
        }, timeoutMs)
    })
    try {
        return await Promise.race([
            Promise.resolve().then(() => callback(controller.signal)),
            timeout,
        ])
    } finally {
        clearTimeout(timeoutId)
    }
}

function defaultSuccessMessage(descriptor) {
    return `${descriptor.name.replace(/[._-]+/g, ' ')} completed.`
}

function defaultFailureMessage(descriptor) {
    return `${descriptor.name.replace(/[._-]+/g, ' ')} could not be completed.`
}

function publicError(value) {
    const code =
        isPlainObject(value) &&
        typeof value.code === 'string' &&
        PUBLIC_ERROR_CODE.test(value.code)
            ? value.code
            : 'ACTION_REPORTED_FAILURE'
    return Object.freeze({ code })
}

function normalizedResult(descriptor, value) {
    if (typeof value === 'string')
        return deepFreeze({
            ok: true,
            message: safePublicText(
                value,
                defaultSuccessMessage(descriptor),
                MAX_RESULT_MESSAGE_LENGTH
            ),
            data: null,
            error: null,
        })

    const isEnvelope =
        isPlainObject(value) &&
        ['ok', 'message', 'data', 'error'].some((key) => hasOwn(value, key))
    if (isEnvelope) {
        if (hasOwn(value, 'ok') && typeof value.ok !== 'boolean')
            throw new BoundedValueError(
                'Copilot action result.ok must be a boolean.'
            )
        if (
            hasOwn(value, 'message') &&
            value.message != null &&
            typeof value.message !== 'string'
        )
            throw new BoundedValueError(
                'Copilot action result.message must be a string.'
        )
        const reportedError = hasOwn(value, 'error') ? value.error : null
        const ok = hasOwn(value, 'ok')
            ? value.ok
            : reportedError === null || reportedError === undefined
        const data =
            value.data === undefined
                ? null
                : copyBounded(
                      value.data,
                      RESULT_COPY_LIMITS,
                      'Copilot action result data'
                  )
        const result = {
            ok,
            message: safePublicText(
                value.message,
                ok
                    ? defaultSuccessMessage(descriptor)
                    : defaultFailureMessage(descriptor),
                MAX_RESULT_MESSAGE_LENGTH
            ),
            data,
            error: ok ? null : publicError(reportedError),
        }
        if (serializedByteLength(result) > RESULT_COPY_LIMITS.maxBytes)
            throw new BoundedValueError(
                'Copilot action result exceeds the result byte limit.'
            )
        return deepFreeze(result)
    }

    const data =
        value === undefined
            ? null
            : copyBounded(
                  value,
                  RESULT_COPY_LIMITS,
                  'Copilot action result data'
              )
    const result = {
        ok: true,
        message: defaultSuccessMessage(descriptor),
        data,
        error: null,
    }
    if (serializedByteLength(result) > RESULT_COPY_LIMITS.maxBytes)
        throw new BoundedValueError(
            'Copilot action result exceeds the result byte limit.'
        )
    return deepFreeze(result)
}

function failureResult(message, code, additionalError = {}) {
    const publicMessage = safePublicText(
        message,
        'Copilot action could not be completed.',
        MAX_RESULT_MESSAGE_LENGTH
    )
    const publicCode =
        typeof code === 'string' && PUBLIC_ERROR_CODE.test(code)
            ? code
            : 'ACTION_EXECUTION_FAILED'
    let copiedAdditionalError = {}
    try {
        const copied = copyBounded(
            additionalError,
            RESULT_COPY_LIMITS,
            'Copilot action failure details'
        )
        if (isPlainObject(copied)) copiedAdditionalError = copied
    } catch {
        // A stable code is more useful than allowing optional failure details
        // to exceed the same public boundary applied to handler results.
    }

    const result = {
        ok: false,
        message: publicMessage,
        data: null,
        error: { ...copiedAdditionalError, code: publicCode },
    }
    try {
        return deepFreeze(
            copyBounded(
                result,
                RESULT_COPY_LIMITS,
                'Copilot action failure result'
            )
        )
    } catch {
        return deepFreeze({
            ok: false,
            message: publicMessage,
            data: null,
            error: { code: publicCode },
        })
    }
}

function positiveIntegerOption(value, fallback, maximum, name) {
    if (value === undefined) return fallback
    if (!Number.isInteger(value) || value <= 0 || value > maximum)
        throw new RangeError(
            `Copilot registry option ${name} must be an integer from 1 to ${maximum}.`
        )
    return value
}

function registrationOptions(value) {
    if (value === undefined) return { replaceExisting: false, returnHandle: false }
    if (!isPlainObject(value))
        throw new TypeError('Copilot action registration options must be an object.')
    Object.keys(value).forEach((key) => {
        if (!['replaceExisting', 'returnHandle'].includes(key))
            throw new TypeError(
                `Unsupported Copilot action registration option "${key}".`
            )
        if (typeof value[key] !== 'boolean')
            throw new TypeError(
                `Copilot action registration option ${key} must be a boolean.`
            )
    })
    return {
        replaceExisting: value.replaceExisting === true,
        returnHandle: value.returnHandle === true,
    }
}

/**
 * Create an isolated capability registry. The default singleton exported below
 * is wired into window.mmgisAPI.
 */
export function createCopilotActionRegistry(options = {}) {
    if (!isPlainObject(options))
        throw new TypeError('Copilot registry options must be an object.')

    const actions = new Map()
    const handles = new WeakMap()
    const logger = options.logger || console
    const maxActions = positiveIntegerOption(
        options.maxActions,
        MAX_ACTIONS,
        MAX_ACTIONS,
        'maxActions'
    )
    const maxRegistryBytes = positiveIntegerOption(
        options.maxRegistryBytes,
        MAX_REGISTRY_BYTES,
        MAX_REGISTRY_BYTES,
        'maxRegistryBytes'
    )
    const availabilityTimeoutMs = positiveIntegerOption(
        options.availabilityTimeoutMs,
        DEFAULT_AVAILABILITY_TIMEOUT_MS,
        MAX_AVAILABILITY_TIMEOUT_MS,
        'availabilityTimeoutMs'
    )
    const handlerTimeoutMs = positiveIntegerOption(
        options.handlerTimeoutMs,
        DEFAULT_HANDLER_TIMEOUT_MS,
        MAX_HANDLER_TIMEOUT_MS,
        'handlerTimeoutMs'
    )
    let registryBytes = 0

    async function checkAvailability(entry, args, context) {
        try {
            const value =
                typeof entry.availability === 'function'
                    ? await callWithTimeout(
                          'Copilot action availability check',
                          availabilityTimeoutMs,
                          (signal) =>
                              entry.availability({
                                  args,
                                  context,
                                  descriptor: entry.descriptor,
                                  signal,
                              })
                      )
                    : entry.availability
            return availabilityResult(value)
        } catch (error) {
            logger?.error?.(
                `[CopilotActionRegistry] Availability check failed for "${entry.descriptor.id}".`,
                error
            )
            return {
                available: false,
                reason:
                    error instanceof OperationTimeoutError
                        ? 'Capability availability check timed out.'
                        : 'Capability availability could not be determined.',
            }
        }
    }

    function register(descriptor, handler, availability, optionsValue) {
        const validated = validateDescriptor(descriptor)
        const settings = registrationOptions(optionsValue)
        const resolvedHandler =
            handler ||
            ownDataValue(descriptor, 'handler', 'Copilot action descriptor')
        const descriptorAvailability = ownDataValue(
            descriptor,
            'availability',
            'Copilot action descriptor'
        )
        const resolvedAvailability =
            availability !== undefined
                ? availability
                : descriptorAvailability === undefined
                  ? true
                  : descriptorAvailability

        if (typeof resolvedHandler !== 'function')
            throw new TypeError('A Copilot action handler function is required.')
        if (
            typeof resolvedAvailability !== 'function' &&
            typeof resolvedAvailability !== 'boolean'
        )
            throw new TypeError(
                'Copilot action availability must be a function or boolean.'
            )

        const existing = actions.get(validated.descriptor.id)
        if (existing) {
            const owner = existing.descriptor.plugin
            if (owner !== validated.descriptor.plugin)
                throw new Error(
                    `Copilot action id collision: "${validated.descriptor.id}" is owned by plugin "${owner}".`
                )
            if (!settings.replaceExisting)
                throw new Error(
                    `Copilot action "${validated.descriptor.id}" is already registered by plugin "${owner}".`
                )
        } else if (actions.size >= maxActions) {
            throw new RangeError(
                `The Copilot action registry may contain at most ${maxActions} actions.`
            )
        }

        const nextRegistryBytes =
            registryBytes - (existing?.serializedBytes || 0) + validated.serializedBytes
        if (nextRegistryBytes > maxRegistryBytes)
            throw new RangeError(
                `The Copilot action registry may contain at most ${maxRegistryBytes} serialized descriptor bytes.`
            )

        const ownershipToken = Object.freeze({})
        actions.set(validated.descriptor.id, {
            descriptor: validated.descriptor,
            serializedBytes: validated.serializedBytes,
            handler: resolvedHandler,
            availability: resolvedAvailability,
            ownershipToken,
        })
        registryBytes = nextRegistryBytes

        if (!settings.returnHandle) return validated.descriptor.id
        const handle = Object.freeze({ id: validated.descriptor.id })
        handles.set(handle, {
            actionId: validated.descriptor.id,
            ownershipToken,
        })
        return handle
    }

    function unregister(actionOrHandle, plugin) {
        if (isPlainObject(actionOrHandle)) {
            const ownership = handles.get(actionOrHandle)
            if (!ownership)
                throw new TypeError(
                    'A valid Copilot action registration handle is required.'
                )
            handles.delete(actionOrHandle)
            const entry = actions.get(ownership.actionId)
            if (!entry || entry.ownershipToken !== ownership.ownershipToken)
                return false
            actions.delete(ownership.actionId)
            registryBytes -= entry.serializedBytes
            return true
        }

        if (
            typeof actionOrHandle !== 'string' ||
            actionOrHandle.trim().length === 0 ||
            actionOrHandle.trim().length > 128
        )
            throw new TypeError('A Copilot action id is required.')
        const owner = assertIdentifier(plugin, 'plugin', PLUGIN_IDENTIFIER)
        const requestedId = actionOrHandle.trim()
        const resolvedId = actions.has(requestedId)
            ? requestedId
            : copilotActionId(owner, requestedId)
        const entry = actions.get(resolvedId)
        if (!entry) return false
        if (entry.descriptor.plugin !== owner)
            throw new Error(
                `Plugin "${owner}" cannot unregister Copilot action "${resolvedId}" owned by "${entry.descriptor.plugin}".`
            )
        actions.delete(resolvedId)
        registryBytes -= entry.serializedBytes
        return true
    }

    async function list(optionsValue = {}) {
        if (!isPlainObject(optionsValue))
            throw new TypeError('Copilot action list options must be an object.')
        const entries = [...actions.values()].filter((entry) => {
            if (
                optionsValue.plugin &&
                entry.descriptor.plugin !== optionsValue.plugin
            )
                return false
            if (
                optionsValue.category &&
                entry.descriptor.category !== optionsValue.category
            )
                return false
            return true
        })
        const discovered = await Promise.all(
            entries.map(async (entry) => {
                const state = await checkAvailability(
                    entry,
                    null,
                    optionsValue.context || null
                )
                if (optionsValue.availableOnly === true && !state.available)
                    return null
                return deepFreeze({
                    ...entry.descriptor,
                    available: state.available,
                    unavailableReason: state.available ? null : state.reason,
                })
            })
        )
        const output = discovered.filter(Boolean)
        const maximumListBytes =
            maxRegistryBytes + maxActions * (MAX_AVAILABILITY_REASON_LENGTH + 128)
        if (serializedByteLength(output) > maximumListBytes)
            throw new RangeError('Copilot action discovery output is too large.')
        return Object.freeze(output)
    }

    async function execute(actionId, args = {}, context = null) {
        if (
            typeof actionId !== 'string' ||
            !PUBLIC_ACTION_IDENTIFIER.test(actionId)
        )
            return failureResult(
                'A valid Copilot action id is required.',
                'INVALID_ACTION_ID'
            )
        const entry = actions.get(actionId)
        if (!entry)
            return failureResult(
                `Copilot action "${actionId}" is not registered.`,
                'ACTION_NOT_FOUND'
            )
        if (!isPlainObject(args))
            return failureResult(
                'Copilot action arguments must be an object.',
                'INVALID_ACTION_ARGUMENTS'
            )

        let safeArgs
        try {
            safeArgs = deepFreeze(
                copyBounded(
                    args,
                    ARGUMENT_COPY_LIMITS,
                    'Copilot action arguments'
                )
            )
        } catch (error) {
            logger?.error?.(
                `[CopilotActionRegistry] Arguments were rejected for "${actionId}".`,
                error
            )
            return failureResult(
                'Copilot action arguments are not safe bounded JSON.',
                'INVALID_ACTION_ARGUMENTS'
            )
        }

        const issues = []
        validateSchemaValue(safeArgs, entry.descriptor.parameters, '$', issues)
        if (issues.length > 0)
            return failureResult(
                'Copilot action arguments do not match the advertised schema.',
                'INVALID_ACTION_ARGUMENTS',
                { issues: deepFreeze(issues) }
            )

        const state = await checkAvailability(entry, safeArgs, context)
        if (!state.available)
            return failureResult(
                state.reason || 'This capability is currently unavailable.',
                'ACTION_UNAVAILABLE',
                { reason: state.reason || null }
            )

        try {
            const result = await callWithTimeout(
                'Copilot action handler',
                handlerTimeoutMs,
                (signal) =>
                    entry.handler(safeArgs, context, {
                        signal,
                        descriptor: entry.descriptor,
                    })
            )
            return normalizedResult(entry.descriptor, result)
        } catch (error) {
            logger?.error?.(
                `[CopilotActionRegistry] Action "${actionId}" failed.`,
                error
            )
            if (error instanceof OperationTimeoutError)
                return failureResult(
                    `${entry.descriptor.name.replace(/[._-]+/g, ' ')} timed out.`,
                    'ACTION_EXECUTION_TIMEOUT'
                )
            if (error instanceof BoundedValueError)
                return failureResult(
                    `${entry.descriptor.name.replace(/[._-]+/g, ' ')} returned an invalid result.`,
                    'ACTION_RESULT_INVALID'
                )
            return failureResult(
                defaultFailureMessage(entry.descriptor),
                'ACTION_EXECUTION_FAILED'
            )
        }
    }

    return Object.freeze({ register, unregister, list, execute })
}

export const copilotActionRegistry = createCopilotActionRegistry()
