import { test, expect } from '@playwright/test'
import { waitForMapReady } from '../../helpers/map-helpers.js'

/**
 * Separated-tool lifecycle tests.
 *
 * Exercises the type-agnostic `ToolController_.openTool` / `closeTool` API
 * against the Reference Mission, which configures Legend (`separatedTool: true`,
 * framed) and Identifier (manifest `separatedTool: "custom"`, chrome-less).
 *
 * The key regression this guards: closing a separated tool must clear its
 * toolbar button highlight (previously a plugin calling only `destroy()` left
 * the button lit because `activeSeparatedTools` was never updated).
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888'

async function isActive(page, toolModuleName) {
    return page.evaluate(
        (n) => window.ToolController_.activeSeparatedTools.includes(n),
        toolModuleName
    )
}

async function buttonHasActiveClass(page, toolName) {
    return page.evaluate((n) => {
        const el = document.getElementById(`toolButtonSeparated_${n}`)
        return el ? el.classList.contains('active') : null
    }, toolName)
}

test.describe('Separated tools — openTool/closeTool', () => {
    test.beforeEach(async ({ page, request }) => {
        const listRes = await request.get(`${baseURL}/api/configure/missions`)
        const listData = await listRes.json().catch(() => ({}))
        if (
            !listData.missions ||
            !listData.missions.includes('Reference-Mission')
        ) {
            test.skip(true, 'SKIP: Reference-Mission not available in this CI mode')
        }

        await page.goto('/?mission=Reference-Mission')
        await waitForMapReady(page)
        await page.waitForFunction(
            () => !!(window.ToolController_ && window.ToolController_.loaded)
        )
        // Public API must be present.
        const hasApi = await page.evaluate(
            () =>
                typeof window.ToolController_.openTool === 'function' &&
                typeof window.ToolController_.closeTool === 'function'
        )
        expect(hasApi).toBe(true)
    })

    test('framed separated tool (Legend): open lights the button, close clears it', async ({
        page,
    }) => {
        // Baseline: ensure closed.
        await page.evaluate(() => window.ToolController_.closeTool('Legend'))
        expect(await isActive(page, 'LegendTool')).toBe(false)

        // Open registers it and lights the toolbar button.
        await page.evaluate(() => window.ToolController_.openTool('Legend'))
        expect(await isActive(page, 'LegendTool')).toBe(true)
        await expect
            .poll(() => buttonHasActiveClass(page, 'Legend'))
            .toBe(true)

        // Opening again is a no-op (no duplicate registration).
        const count = await page.evaluate(() => {
            window.ToolController_.openTool('Legend')
            return window.ToolController_.activeSeparatedTools.filter(
                (a) => a === 'LegendTool'
            ).length
        })
        expect(count).toBe(1)

        // Close removes it and clears the highlight (the regression).
        await page.evaluate(() => window.ToolController_.closeTool('Legend'))
        expect(await isActive(page, 'LegendTool')).toBe(false)
        await expect
            .poll(() => buttonHasActiveClass(page, 'Legend'))
            .toBe(false)

        // Closing again is a safe no-op.
        await page.evaluate(() => window.ToolController_.closeTool('Legend'))
        expect(await isActive(page, 'LegendTool')).toBe(false)
    })

    test('custom separated tool (Identifier): open/close manages state without a framed header', async ({
        page,
    }) => {
        await page.evaluate(() => window.ToolController_.closeTool('Identifier'))
        expect(await isActive(page, 'IdentifierTool')).toBe(false)

        await page.evaluate(() => window.ToolController_.openTool('Identifier'))
        expect(await isActive(page, 'IdentifierTool')).toBe(true)
        // The content mount target exists for the tool to own.
        const hasContent = await page.evaluate(
            () => !!document.getElementById('toolContentSeparated_Identifier')
        )
        expect(hasContent).toBe(true)
        await expect
            .poll(() => buttonHasActiveClass(page, 'Identifier'))
            .toBe(true)

        await page.evaluate(() => window.ToolController_.closeTool('Identifier'))
        expect(await isActive(page, 'IdentifierTool')).toBe(false)
        await expect
            .poll(() => buttonHasActiveClass(page, 'Identifier'))
            .toBe(false)
    })

    test('regular tool (Draw): openTool/closeTool set and clear the active tool with guards', async ({
        page,
    }) => {
        // Ensure a clean slate.
        await page.evaluate(() => window.ToolController_.closeTool('Draw'))

        await page.evaluate(() => window.ToolController_.openTool('Draw'))
        await expect
            .poll(() =>
                page.evaluate(() => window.ToolController_.activeToolName)
            )
            .toBe('DrawTool')

        // Opening the already-active tool is a no-op (stays open).
        await page.evaluate(() => window.ToolController_.openTool('Draw'))
        expect(
            await page.evaluate(() => window.ToolController_.activeToolName)
        ).toBe('DrawTool')

        await page.evaluate(() => window.ToolController_.closeTool('Draw'))
        await expect
            .poll(() =>
                page.evaluate(() => window.ToolController_.activeToolName)
            )
            .toBeNull()
    })
})
