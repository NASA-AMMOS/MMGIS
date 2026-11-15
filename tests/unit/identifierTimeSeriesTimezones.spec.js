import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Acquisition times read the same whatever the system timezone (#1159).
 *
 * The parser runs in a real browser set to each timezone below, including a
 * date that is in daylight saving time there and zones with half- and
 * quarter-hour offsets. Every accepted input must give the same instant
 * everywhere; times without a zone - which JavaScript would read in local
 * time - must be rejected everywhere.
 */

const ROOT = path.resolve(__dirname, '../..')
const ORIGIN = 'http://identifier-tz.test'

const ACCEPTED = {
    '2024-07-15T12:00:00Z': Date.UTC(2024, 6, 15, 12),
    '2024-07-15T12:00:00.250Z': Date.UTC(2024, 6, 15, 12, 0, 0, 250),
    '2024-07-15T12:00:00-05:00': Date.UTC(2024, 6, 15, 17),
    '2024-07-15T12:00:00+05:45': Date.UTC(2024, 6, 15, 6, 15),
    '2024-03-10T08:30:00Z': Date.UTC(2024, 2, 10, 8, 30), // US DST change
    '2024-02-29T00:00:00Z': Date.UTC(2024, 1, 29),
    '2024-07-15': Date.UTC(2024, 6, 15),
}
const REJECTED = [
    '2024-07-15T12:00:00',
    '2024-07-15 12:00:00',
    '2024-02-31T00:00:00Z',
    '2023-02-29T00:00:00Z',
]

// Each zone's Date#getTimezoneOffset() on 2024-07-15 (minutes, UTC - local),
// to prove the browser really ran in it.
const ZONES = {
    UTC: 0,
    'America/Chicago': 300, // CDT, UTC-5
    'Asia/Kolkata': -330, // UTC+5:30
    'Asia/Kathmandu': -345, // UTC+5:45
    'Pacific/Kiritimati': -840, // UTC+14
}

for (const [timezoneId, offset] of Object.entries(ZONES)) {
    test.describe(`parseIsoTime in ${timezoneId}`, () => {
        test.use({ timezoneId })

        test('the same instants, and the same rejections', async ({ page }) => {
            await page.route(`${ORIGIN}/**`, (route) => {
                const { pathname } = new URL(route.request().url())
                if (pathname === '/')
                    return route.fulfill({
                        body: '<!doctype html><html><body></body></html>',
                        contentType: 'text/html',
                    })
                const file = path.join(ROOT, decodeURIComponent(pathname))
                if (!file.startsWith(ROOT) || !fs.existsSync(file))
                    return route.fulfill({ status: 404, body: '' })
                route.fulfill({
                    body: fs.readFileSync(file),
                    contentType: 'text/javascript',
                })
            })
            await page.goto(`${ORIGIN}/`)
            const r = await page.evaluate(
                async ([accepted, rejected]) => {
                    const m =
                        await import('/plugins/core/tools/Identifier/IdentifierTimeSeries.js')
                    return {
                        offset: new Date(
                            Date.UTC(2024, 6, 15, 12)
                        ).getTimezoneOffset(),
                        accepted: Object.fromEntries(
                            accepted.map((v) => [v, m.parseIsoTime(v)])
                        ),
                        rejected: rejected.map((v) => m.parseIsoTime(v)),
                        // what Date.parse would have said for a zoneless time
                        naive: Date.parse('2024-07-15T12:00:00'),
                    }
                },
                [Object.keys(ACCEPTED), REJECTED]
            )
            expect(r.offset).toBe(offset)
            expect(r.accepted).toEqual(ACCEPTED)
            expect(r.rejected).toEqual(REJECTED.map(() => null))
            // Date.parse reads a zoneless time locally: this is why it is
            // rejected. Outside UTC it lands somewhere other than 12:00Z.
            if (timezoneId !== 'UTC')
                expect(r.naive).not.toBe(Date.UTC(2024, 6, 15, 12))
        })
    })
}
