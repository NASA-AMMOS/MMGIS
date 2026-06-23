import { test, expect } from '@playwright/test'

/**
 * Global Feature Search — Unit Tests
 *
 * Tests the pure utility functions used by the Search component:
 * field parsing, filter encoding, and factory helpers.
 *
 * These are imported directly (no DOM or React needed).
 */

// ---------------------------------------------------------------------------
// makeSearchFields (from Search.jsx)
// ---------------------------------------------------------------------------

// Inline the pure function so we don't pull in React/CSS through the JSX import
function makeSearchFields(vars) {
    let searchfields = {}
    for (let layerfield in vars) {
        let fieldString = vars[layerfield]
        fieldString = fieldString.split(')')
        for (let i = 0; i < fieldString.length; i++) {
            fieldString[i] = fieldString[i].split('(')
            const li = fieldString[i][0].lastIndexOf(' ')
            if (li !== -1) {
                fieldString[i][0] = fieldString[i][0].substring(li + 1)
            }
        }
        fieldString.pop()
        searchfields[layerfield] = fieldString
    }
    return searchfields
}

// ---------------------------------------------------------------------------
// encodeFilters, createFilterRow, createGroupRow (filter encoding utilities)
// ---------------------------------------------------------------------------

let _nextId = 1
function createFilterRow() {
    return { id: _nextId++, key: '', op: '=', value: '', type: 'string' }
}
function createGroupRow() {
    return { id: _nextId++, isGroup: true, op: 'AND' }
}

function encodeFilters(filterValues) {
    const encoded = []
    filterValues.forEach((v) => {
        if (v.value != null && v.key != null && !v.isGroup)
            encoded.push(
                `${v.key}+${v.op === ',' ? 'in' : v.op}+${v.type}+${v.value.replaceAll(',', '$')}`
            )
        else if (v.isGroup === true && v.op != null) encoded.push(`${v.op}`)
    })
    return encoded.join(',')
}

// ===== makeSearchFields =====

test.describe('makeSearchFields', () => {
    test('parses single field', () => {
        const result = makeSearchFields({ layerA: 'name(name)' })
        expect(result).toEqual({
            layerA: [['name', 'name']],
        })
    })

    test('parses multiple fields', () => {
        const result = makeSearchFields({
            layerA: 'name(name) category(category)',
        })
        expect(result).toEqual({
            layerA: [
                ['name', 'name'],
                ['category', 'category'],
            ],
        })
    })

    test('parses function prefixes like round()', () => {
        const result = makeSearchFields({ layerA: 'round(sol)' })
        expect(result).toEqual({
            layerA: [['round', 'sol']],
        })
    })

    test('handles rmunder prefix', () => {
        const result = makeSearchFields({ layerA: 'rmunder(site_name)' })
        expect(result).toEqual({
            layerA: [['rmunder', 'site_name']],
        })
    })

    test('parses multiple layers', () => {
        const result = makeSearchFields({
            layerA: 'name(name)',
            layerB: 'sol(sol) site(site)',
        })
        expect(Object.keys(result)).toHaveLength(2)
        expect(result.layerA).toEqual([['name', 'name']])
        expect(result.layerB).toEqual([
            ['sol', 'sol'],
            ['site', 'site'],
        ])
    })

    test('returns empty for empty input', () => {
        const result = makeSearchFields({})
        expect(result).toEqual({})
    })
})

// ===== encodeFilters =====

test.describe('encodeFilters', () => {
    test('encodes a single filter row', () => {
        const encoded = encodeFilters([
            { key: 'name', op: '=', value: 'Civic Center', type: 'string' },
        ])
        expect(encoded).toBe('name+=+string+Civic Center')
    })

    test('encodes multiple filter rows', () => {
        const encoded = encodeFilters([
            { key: 'name', op: '=', value: 'A', type: 'string' },
            { isGroup: true, op: 'AND' },
            { key: 'sol', op: '>', value: '50', type: 'number' },
        ])
        expect(encoded).toBe('name+=+string+A,AND,sol+>+number+50')
    })

    test('encodes in operator', () => {
        const encoded = encodeFilters([
            { key: 'status', op: ',', value: 'active,complete', type: 'string' },
        ])
        expect(encoded).toBe('status+in+string+active$complete')
    })

    test('replaces commas in values with dollar signs', () => {
        const encoded = encodeFilters([
            { key: 'tags', op: '=', value: 'a,b,c', type: 'string' },
        ])
        expect(encoded).toBe('tags+=+string+a$b$c')
    })

    test('encodes group operators', () => {
        const encoded = encodeFilters([
            { key: 'a', op: '=', value: '1', type: 'number' },
            { isGroup: true, op: 'OR' },
            { key: 'b', op: '=', value: '2', type: 'number' },
        ])
        expect(encoded).toBe('a+=+number+1,OR,b+=+number+2')
    })

    test('encodes NOT_AND and NOT_OR groups', () => {
        const encoded = encodeFilters([
            { key: 'x', op: '!=', value: 'bad', type: 'string' },
            { isGroup: true, op: 'NOT_AND' },
            { key: 'y', op: 'contains', value: 'test', type: 'string' },
        ])
        expect(encoded).toBe('x+!=+string+bad,NOT_AND,y+contains+string+test')
    })

    test('handles contains / beginswith / endswith operators', () => {
        const enc1 = encodeFilters([
            { key: 'name', op: 'contains', value: 'park', type: 'string' },
        ])
        expect(enc1).toBe('name+contains+string+park')

        const enc2 = encodeFilters([
            { key: 'name', op: 'beginswith', value: 'San', type: 'string' },
        ])
        expect(enc2).toBe('name+beginswith+string+San')

        const enc3 = encodeFilters([
            { key: 'name', op: 'endswith', value: 'Bay', type: 'string' },
        ])
        expect(enc3).toBe('name+endswith+string+Bay')
    })

    test('handles less/greater operators', () => {
        const encoded = encodeFilters([
            { key: 'year', op: '<=', value: '2020', type: 'number' },
            { isGroup: true, op: 'AND' },
            { key: 'year', op: '>=', value: '2000', type: 'number' },
        ])
        expect(encoded).toBe('year+<=+number+2020,AND,year+>=+number+2000')
    })

    test('returns empty string for no filters', () => {
        expect(encodeFilters([])).toBe('')
    })

    test('skips filter rows with null key', () => {
        const encoded = encodeFilters([
            { key: null, op: '=', value: 'test', type: 'string' },
        ])
        expect(encoded).toBe('')
    })

    test('skips filter rows with null value', () => {
        const encoded = encodeFilters([
            { key: 'name', op: '=', value: null, type: 'string' },
        ])
        expect(encoded).toBe('')
    })
})

// ===== createFilterRow / createGroupRow =====

test.describe('createFilterRow', () => {
    test('creates a filter row with defaults', () => {
        const row = createFilterRow()
        expect(row).toHaveProperty('id')
        expect(row.key).toBe('')
        expect(row.op).toBe('=')
        expect(row.value).toBe('')
        expect(row.type).toBe('string')
        expect(row.isGroup).toBeUndefined()
    })

    test('creates rows with incrementing ids', () => {
        const r1 = createFilterRow()
        const r2 = createFilterRow()
        expect(r2.id).toBeGreaterThan(r1.id)
    })
})

test.describe('createGroupRow', () => {
    test('creates a group row with AND default', () => {
        const row = createGroupRow()
        expect(row).toHaveProperty('id')
        expect(row.isGroup).toBe(true)
        expect(row.op).toBe('AND')
    })
})
