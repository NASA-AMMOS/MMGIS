/**
 * Guardrail: core may not ask "which built-in layer type is this?".
 *
 * Type-specific behavior belongs to the layer type's plugin
 * (plugins/core/layertypes/<Type>/) or its attachment
 * (plugins/core/layerattachments/<Attachment>/), reached through
 * LayerInterface; questions core must answer while iterating every layer,
 * before it involves any of them, are declared in plugin.json and read through
 * LayerTypeRegistry / LayerAttachmentRegistry. Either way core carries no list
 * of built-in ids.
 *
 * This test fails on a comparison of a `.type` (or a `type` variable) against a
 * built-in layertype/attachment id anywhere under src/, which is how that
 * property regressed before: individually reasonable branches, added one at a
 * time.
 *
 * It also fails on an attachment reached by its hardcoded name
 * (`attachments[layer].pairings`, `['models'].includes(sub)`) — the same
 * knowledge, spelled as a property key instead of a comparison, which is how
 * attachments stayed in core after their types left.
 *
 * It deliberately looks only at comparisons against those ids, so generic words
 * are still free to be used for other things — GeoJSON geometry (`'Point'`),
 * `time.type`, filter value types, menu-item types, engine primitive kinds
 * (GlobeRenderer records `kind`, not `type`, for what Cesium is holding).
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_ROOT = path.join(REPO_ROOT, 'src')
const PLUGINS_ROOT = path.join(REPO_ROOT, 'plugins')

/**
 * Third-party bundles (src/external) and generated files (src/pre) are not
 * core's code.
 */
const EXCLUDED_DIRS = new Set(['external', 'pre'])

/** Manifests of a plugin category, in discovery order. */
function manifests(category) {
    const categoryPath = path.join(PLUGINS_ROOT, 'core', category)
    return fs
        .readdirSync(categoryPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
            JSON.parse(
                fs.readFileSync(
                    path.join(categoryPath, entry.name, 'plugin.json'),
                    'utf8'
                )
            )
        )
}

/** Every id a plugin claims, gathered from the plugins themselves. */
function builtInIds() {
    const ids = []
    for (const [category, idField] of [
        ['layertypes', 'typeId'],
        ['layerattachments', 'attachmentId'],
    ]) {
        for (const manifest of manifests(category)) {
            if (manifest[idField]) ids.push(manifest[idField])
        }
    }
    return ids
}

/**
 * Every name an attachment is known by: its id and, where they differ, the key
 * it is stored under on its host.
 */
function attachmentNames() {
    const names = []
    for (const manifest of manifests('layerattachments')) {
        if (manifest.attachmentId) names.push(manifest.attachmentId)
        const key = manifest.capabilities?.host?.sublayerKey
        if (key) names.push(key)
    }
    return names
}

function sourceFiles(dir) {
    const out = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue
            out.push(...sourceFiles(full))
        } else if (/\.(js|jsx)$/.test(entry.name)) {
            out.push(full)
        }
    }
    return out
}

/**
 * Comparisons of a type against a literal, in the shapes that actually occur:
 *   x.type === 'vector'      x.type != 'header'      type === 'tile'
 *   'vector' === x.type      case 'labels':  (in a switch on something.type)
 */
function typeComparisons(source, ids) {
    const idAlternation = ids.map((id) => id.replace(/[^\w-]/g, '')).join('|')
    const patterns = [
        // <something>type <op> '<id>'   and the mirrored form
        new RegExp(`\\btype\\s*[=!]==?\\s*['"\`](${idAlternation})['"\`]`, 'g'),
        new RegExp(
            `['"\`](${idAlternation})['"\`]\\s*[=!]==?\\s*[\\w.?[\\]]*\\btype\\b`,
            'g'
        ),
    ]

    const hits = []
    const lines = source.split('\n')
    lines.forEach((line, i) => {
        // Comments describe the contract (they name types on purpose).
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
        for (const pattern of patterns) {
            pattern.lastIndex = 0
            if (pattern.test(code)) {
                hits.push(`${i + 1}: ${line.trim()}`)
                break
            }
        }
    })
    return hits
}

/**
 * `switch (x.type)` over built-in ids — the same branching, spelled differently.
 */
function typeSwitches(source, ids) {
    const hits = []
    const lines = source.split('\n')
    const idSet = new Set(ids)
    let inTypeSwitch = 0
    lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '')
        if (/switch\s*\([^)]*\btype\b[^)]*\)/.test(code)) inTypeSwitch = 1
        if (inTypeSwitch) {
            const match = code.match(/case\s+['"`]([\w-]+)['"`]\s*:/)
            if (match && idSet.has(match[1]))
                hits.push(`${i + 1}: ${line.trim()}`)
            // A closing brace at the switch's own indentation ends it; cheap
            // heuristic, and a false "still inside" only widens the check.
            if (/^\s{0,8}\}/.test(code)) inTypeSwitch = 0
        }
    })
    return hits
}

/**
 * An attachment singled out by name rather than reached through the registry:
 *   L_.layers.attachments[name].pairings      sublayers['labels']
 *   sub === 'image_overlays'                  ['models'].includes(sub)
 */
function attachmentNameUses(source, names) {
    const alternation = names.map((n) => n.replace(/[^\w-]/g, '')).join('|')
    const patterns = [
        // an attachment collection indexed by a hardcoded name
        new RegExp(
            `\\b(attachments|sublayers)\\b[\\w.?[\\]'"\`]*(\\.|\\[\\s*['"\`])(${alternation})\\b`,
            'g'
        ),
        // a loop's current attachment compared to a hardcoded name
        new RegExp(
            `\\b(sub|subName|sublayerName|attachmentName|attachmentId)\\s*[=!]==?\\s*['"\`](${alternation})['"\`]`,
            'g'
        ),
        // a hardcoded list of attachment names to test membership in
        new RegExp(`['"\`](${alternation})['"\`]\\s*\\]\\s*\\.includes`, 'g'),
        new RegExp(`\\.includes\\(\\s*['"\`](${alternation})['"\`]`, 'g'),
    ]

    const hits = []
    source.split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
        for (const pattern of patterns) {
            pattern.lastIndex = 0
            if (pattern.test(code)) {
                hits.push(`${i + 1}: ${line.trim()}`)
                break
            }
        }
    })
    return hits
}

test.describe('core carries no built-in layer type branches', () => {
    test('no file under src/ compares a layer or attachment type to a built-in id', () => {
        const ids = builtInIds()
        expect(ids.length).toBeGreaterThan(10)

        const offenders = []
        for (const file of sourceFiles(SRC_ROOT)) {
            const source = fs.readFileSync(file, 'utf8')
            const hits = [
                ...typeComparisons(source, ids),
                ...typeSwitches(source, ids),
            ]
            if (hits.length > 0)
                offenders.push(
                    `${path.relative(REPO_ROOT, file)}\n    ${hits.join('\n    ')}`
                )
        }

        expect(
            offenders,
            `Type-specific behavior belongs to the layer type's plugin (reached through LayerInterface), and questions core asks while iterating all layers belong in plugin.json capabilities (read through LayerTypeRegistry / LayerAttachmentRegistry):\n\n${offenders.join(
                '\n'
            )}`
        ).toEqual([])
    })

    test('no file under src/ singles out an attachment by name', () => {
        const names = attachmentNames()
        expect(names.length).toBeGreaterThan(5)

        const offenders = []
        for (const file of sourceFiles(SRC_ROOT)) {
            const source = fs.readFileSync(file, 'utf8')
            const hits = attachmentNameUses(source, names)
            if (hits.length > 0)
                offenders.push(
                    `${path.relative(REPO_ROOT, file)}\n    ${hits.join('\n    ')}`
                )
        }

        expect(
            offenders,
            `Type-specific behavior belongs to the layer type's plugin (reached through LayerInterface), and questions core asks while iterating all layers belong in plugin.json capabilities (read through LayerTypeRegistry / LayerAttachmentRegistry):\n\n${offenders.join(
                '\n'
            )}`
        ).toEqual([])
    })
})
