/**
 * Minimal browser globals so a plugin module can be imported in a Node unit test.
 *
 * MMGIS frontend modules read `window`/`document` while they are being evaluated,
 * which throws in Node. Import this **before** the module under test — import
 * order is evaluation order:
 *
 *   import '../../../../../tests/helpers/browser-globals.js'
 *   import MyType from '../map.js'
 *
 * This buys import-time safety only: the stubs are inert, so exercise pure
 * functions and shapes here and leave anything that touches a real map to an E2E
 * test. Engine namespaces (`window.L`, `window.Cesium`, `window.THREE`) are
 * deliberately left undefined — a test that needs one assigns its own, which
 * only works if the module under test reads the global when it runs
 * (`const leaflet = () => window.L`) rather than capturing it at import time
 * (`const L = window.L`, which is undefined no matter what a test assigns).
 *
 * These stubs are **not** a DOM. A module that imports `F_`
 * (`@basics/Formulae_/Formulae_`) or any other MMGIS singleton pulls jQuery,
 * which refuses to load without a real document, and no stub short of jsdom will
 * satisfy it. Keep the logic worth unit testing in a module that imports nothing
 * from `src/essence` — which is also the shape that makes it testable at all —
 * and cover the rest with an E2E spec.
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
        // Enough for the old-style clipboard path (`execCommand('copy')` over a
        // selected element), which a module may take when the async Clipboard
        // API is unavailable.
        execCommand: () => false,
        getSelection: () => ({
            removeAllRanges: noop,
            addRange: noop,
            toString: () => '',
        }),
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
