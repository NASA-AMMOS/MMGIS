/**
 * Minimal browser globals so a plugin module can be imported in a Node unit test.
 *
 * MMGIS frontend modules read `window`/`document` while they are being evaluated
 * (`const L = window.L`), which throws in Node. Import this **before** the module
 * under test — import order is evaluation order:
 *
 *   import '../../../../../tests/helpers/browser-globals.js'
 *   import MyType from '../map.js'
 *
 * This buys import-time safety only: the stubs are inert, so exercise pure
 * functions and shapes here and leave anything that touches a real map to an E2E
 * test. Engine namespaces (`window.L`, `window.Cesium`, `window.THREE`) are
 * deliberately left undefined — a unit test that needs one should assign its own.
 */

const noop = () => {}

const element = () => ({
    style: {},
    classList: { add: noop, remove: noop, contains: () => false },
    appendChild: noop,
    removeChild: noop,
    setAttribute: noop,
    getAttribute: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    children: [],
})

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: element,
        createElementNS: element,
        createTextNode: () => ({}),
        documentElement: element(),
        body: element(),
        head: element(),
        getElementById: () => null,
        getElementsByTagName: () => [],
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: noop,
        removeEventListener: noop,
    }
}

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map()
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    }
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0)
    globalThis.cancelAnimationFrame = clearTimeout
}

export default globalThis.window
