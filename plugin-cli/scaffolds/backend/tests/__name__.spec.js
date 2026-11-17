/**
 * __Name__ backend — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). Backend plugins are CommonJS
 * and server-side, so they import for real here; route behavior against a live
 * server belongs in an E2E spec under `tests/e2e/api`.
 */
const { test, expect } = require('@playwright/test')
const path = require('path')

const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
const setup = require(path.resolve(__dirname, '..', 'plugin.js'))

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('__Name__')
    expect(manifest.type).toBe('backend')
})

test('lifecycle hooks are functions @unit', () => {
    for (const hook of ['onceInit', 'onceStarted', 'onceSynced'])
        expect(typeof setup[hook]).toBe('function')
})

test('onceInit mounts under ROOT_PATH behind an auth gate @unit', () => {
    const mounts = []
    const gate = () => 'gate'
    setup.onceInit({
        app: { use: (route, ...middleware) => mounts.push({ route, middleware }) },
        ROOT_PATH: '/root',
        ensureUser: gate,
        ensureAdmin: gate,
        checkHeadersCodeInjection: 'checkHeaders',
        setContentType: 'setContentType',
    })

    expect(mounts.length).toBe(1)
    // A mount that skips ROOT_PATH breaks every subpath deployment, and one with
    // no ensure* middleware is open to the world whatever AUTH is set to.
    expect(mounts[0].route.startsWith('/root')).toBe(true)
    expect(mounts[0].middleware).toContain('gate')
})
