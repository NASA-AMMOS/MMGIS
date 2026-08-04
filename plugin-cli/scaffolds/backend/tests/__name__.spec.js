const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('__Name__ backend', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('__Name__')
        expect(manifest.type).toBe('backend')
    })
})
