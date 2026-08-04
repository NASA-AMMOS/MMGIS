const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('__Name__Tool', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('__Name__')
        expect(manifest.type).toBe('tool')
        expect(manifest.paths).toBeDefined()
        expect(manifest.paths['__Name__Tool']).toBeDefined()
    })
})
