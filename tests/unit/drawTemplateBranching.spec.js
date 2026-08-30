/**
 * Conditional fields in Draw templates, and the label that fronts them.
 *
 * A template used to be a flat list where every question was always asked. That
 * is unusable past about a dozen fields: an in-situ vegetation plot asks canopy
 * closure and canopy height, and asking them of a bare gravel plot is how a form
 * teaches the person filling it to stop reading it.
 *
 * The predicate grammar is deliberately the one the Configure app already uses
 * for its own forms (`configure/src/core/Maker.js`), so there is one conditional
 * language in the product rather than two.
 *
 * WHAT BREAKS IF THIS REGRESSES: nothing throws. Either every question is shown
 * unconditionally again — merely noisy — or, far worse, `appliesTo` starts
 * returning true for a branch that was not taken and `enforceTemplate` writes a
 * default into it. A canopy height then appears on a plot with no canopy, and
 * afterwards it is indistinguishable from an answer somebody actually gave.
 *
 * These are pure functions, so none of this needs a map or a DOM.
 */

import { test, expect } from '@playwright/test'
import { appliesTo, labelOf, passesShowIf } from '../../plugins/core/tools/Draw/templateLogic.js'

/** Read answers out of a plain object, the way a saved feature carries them. */
const from = (props) => (field) => props[field]

test.describe('passesShowIf', () => {
    test('an entry with no showIf is always shown', () => {
        expect(passesShowIf({ field: 'a' }, from({}))).toBe(true)
    })

    test('truthy follows the controlling answer', () => {
        const t = { field: 'canopy_height_m', showIf: { field: 'top_cover', truthy: true } }
        expect(passesShowIf(t, from({ top_cover: true }))).toBe(true)
        expect(passesShowIf(t, from({ top_cover: false }))).toBe(false)
        // Never answered at all is not the same as answered "no", but it must
        // behave the same way here: the branch was not taken.
        expect(passesShowIf(t, from({}))).toBe(false)
    })

    test('truthy:false is the inverse, not a disabled test', () => {
        const t = { field: 'why_not', showIf: { field: 'ok', truthy: false } }
        expect(passesShowIf(t, from({ ok: false }))).toBe(true)
        expect(passesShowIf(t, from({ ok: true }))).toBe(false)
    })

    test('in and notIn match a set of answers', () => {
        const t = { field: 'sward_height_cm', showIf: { field: 'lifeform', in: ['Grass', 'Forb'] } }
        expect(passesShowIf(t, from({ lifeform: 'Grass' }))).toBe(true)
        expect(passesShowIf(t, from({ lifeform: 'Tree' }))).toBe(false)

        const u = { field: 'lai', showIf: { field: 'method', notIn: ['None'] } }
        expect(passesShowIf(u, from({ method: 'Ceptometer' }))).toBe(true)
        expect(passesShowIf(u, from({ method: 'None' }))).toBe(false)
    })

    test('an unset field reads as null, so a default can be matched', () => {
        const t = { field: 'x', showIf: { field: 'style', in: [null, 'fillColor'] } }
        expect(passesShowIf(t, from({}))).toBe(true)
        // Empty string is treated as unset too — a text input the user cleared
        // is not an answer.
        expect(passesShowIf(t, from({ style: '' }))).toBe(true)
        expect(passesShowIf(t, from({ style: 'stroke' }))).toBe(false)
    })

    test('equals and not compare a single answer', () => {
        const t = { field: 'other', showIf: { field: 'kind', equals: 'Other' } }
        expect(passesShowIf(t, from({ kind: 'Other' }))).toBe(true)
        expect(passesShowIf(t, from({ kind: 'Fire' }))).toBe(false)

        const u = { field: 'z', showIf: { field: 'kind', not: 'Other' } }
        expect(passesShowIf(u, from({ kind: 'Fire' }))).toBe(true)
        expect(passesShowIf(u, from({ kind: 'Other' }))).toBe(false)
    })

    test('an array of tests means ALL of them', () => {
        // The real case this exists for: a sub-question of a sub-question. Its
        // parent dropdown keeps its last answer when the checkbox above is
        // cleared, so testing only the dropdown would bring this field back on
        // screen under a question that is switched off.
        const t = {
            field: 'disturbance_other',
            showIf: [
                { field: 'disturbance_observed', truthy: true },
                { field: 'disturbance_type', equals: 'Other' },
            ],
        }
        expect(passesShowIf(t, from({ disturbance_observed: true, disturbance_type: 'Other' }))).toBe(true)
        expect(passesShowIf(t, from({ disturbance_observed: false, disturbance_type: 'Other' }))).toBe(false)
        expect(passesShowIf(t, from({ disturbance_observed: true, disturbance_type: 'Fire' }))).toBe(false)
    })

    test('a malformed test is ignored rather than hiding the field', () => {
        // A template is authored elsewhere and may be older than this code.
        // Failing open keeps the question askable; failing closed would delete
        // it from the form with nothing to say so.
        expect(passesShowIf({ field: 'a', showIf: {} }, from({}))).toBe(true)
        expect(passesShowIf({ field: 'a', showIf: null }, from({}))).toBe(true)
        expect(passesShowIf({ field: 'a', showIf: [null] }, from({}))).toBe(true)
    })
})

test.describe('labelOf', () => {
    test('falls back to the field name, which is stock behaviour', () => {
        expect(labelOf({ field: 'plot_id' })).toBe('plot_id')
        expect(labelOf({ field: 'plot_id', label: '' })).toBe('plot_id')
    })

    test('lets the property key and the question differ', () => {
        // The whole point: `cover_green_veg_pct` is a bad thing to ask a person
        // and `Green vegetation cover (%)` is a bad thing to key a property on.
        expect(labelOf({ field: 'cover_green_veg_pct', label: 'Green vegetation cover (%)' })).toBe(
            'Green vegetation cover (%)'
        )
    })
})

test.describe('appliesTo', () => {
    test('a header never applies', () => {
        // It asks nothing. Without this it stores `undefined` under a property
        // named after a section heading.
        expect(appliesTo({ type: 'header', field: 'sec_cover' }, {})).toBe(false)
    })

    test('an ordinary field with no predicate always applies', () => {
        expect(appliesTo({ type: 'text', field: 'observer' }, {})).toBe(true)
    })

    test('a branch that was not taken does not apply', () => {
        const t = {
            type: 'number',
            field: 'canopy_height_m',
            showIf: { field: 'top_cover_present', truthy: true },
        }
        expect(appliesTo(t, { top_cover_present: true })).toBe(true)
        expect(appliesTo(t, { top_cover_present: false })).toBe(false)
        expect(appliesTo(t, {})).toBe(false)
    })

    test('tolerates missing properties entirely', () => {
        // enforceTemplate reaches this with features that have no properties
        // object at all.
        expect(appliesTo({ type: 'text', field: 'a' }, undefined)).toBe(true)
        expect(appliesTo(null, {})).toBe(false)
    })
})
