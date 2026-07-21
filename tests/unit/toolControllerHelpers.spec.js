import { test, expect } from '@playwright/test'
import {
    getSeparatedMode,
    resolveToolJs,
} from '../../src/essence/Basics/ToolController_/toolControllerHelpers.js'

/**
 * Unit tests for ToolController_ pure helpers. These back the manifest-driven
 * `separatedTool` resolution and the type-agnostic openTool/closeTool API.
 */

test.describe('getSeparatedMode', () => {
    test('returns true when the manifest declares separatedTool: true', () => {
        const cfg = { Legend: { separatedTool: true } }
        expect(getSeparatedMode(cfg, 'Legend')).toBe(true)
    })

    test('returns "custom" when the manifest declares separatedTool: "custom"', () => {
        const cfg = { Identifier: { separatedTool: 'custom' } }
        expect(getSeparatedMode(cfg, 'Identifier')).toBe('custom')
    })

    test('returns null when the manifest does not declare separatedTool', () => {
        const cfg = { Draw: { paths: {} } }
        expect(getSeparatedMode(cfg, 'Draw')).toBeNull()
    })

    test('returns null for unknown tools (no mission-config fallback)', () => {
        expect(getSeparatedMode({}, 'Nope')).toBeNull()
        expect(getSeparatedMode(undefined, 'Nope')).toBeNull()
    })

    test('does not treat other truthy/string values as separated', () => {
        expect(getSeparatedMode({ A: { separatedTool: false } }, 'A')).toBeNull()
        expect(getSeparatedMode({ A: { separatedTool: 'yes' } }, 'A')).toBeNull()
        expect(getSeparatedMode({ A: { separatedTool: 1 } }, 'A')).toBeNull()
    })
})

test.describe('resolveToolJs', () => {
    const tools = [
        { name: 'Identifier', js: 'IdentifierTool' },
        { name: 'Custom Name', js: 'WeirdModule' },
    ]

    test('returns the tool js when present in the tools list', () => {
        expect(resolveToolJs(tools, 'Identifier')).toBe('IdentifierTool')
        expect(resolveToolJs(tools, 'Custom Name')).toBe('WeirdModule')
    })

    test('falls back to <name>Tool when the tool is absent', () => {
        expect(resolveToolJs(tools, 'Legend')).toBe('LegendTool')
        expect(resolveToolJs([], 'Legend')).toBe('LegendTool')
        expect(resolveToolJs(undefined, 'Legend')).toBe('LegendTool')
    })
})
