/**
 * Template field logic, with no DOM and no dependencies.
 *
 * Split out of `DrawTool_Templater.js` so it can be unit tested: that module
 * pulls in jQuery, Map_, TimeControl, Dropy and a date picker at import time, so
 * nothing inside it can be reached from a test without a browser. Everything
 * here is a pure function over a template entry and a bag of values.
 */

/**
 * Does an entry's `showIf` predicate hold?
 *
 * The grammar is NOT new. It is `passesShowIf` from the Configure app's own form
 * renderer (`configure/src/core/Maker.js`), which already shows and hides fields
 * in the admin UI by exactly these tests. Capture forms and config forms now
 * branch the same way — a second conditional language in the same product would
 * be a worse outcome than no branching at all.
 *
 * One test is `{ field, equals | not | in | notIn | truthy }`. An array of them
 * must ALL pass. An unset field reads as null, so `in: [null, 'Other']` covers a
 * default.
 *
 * `read(field)` is supplied by the caller rather than read from anywhere here,
 * because where an answer lives depends entirely on the context: a rendered form
 * keeps a dropdown's answer as an index in `helperStates` with nothing queryable
 * in the markup, while `enforceTemplate` has only stored properties and no form
 * at all.
 */
export function passesShowIf(t, read) {
    if (t == null || t.showIf == null) return true
    const tests = Array.isArray(t.showIf) ? t.showIf : [t.showIf]
    return tests.every(function (test) {
        if (test == null || typeof test.field !== 'string') return true
        const value = read(test.field)
        const at = value === undefined || value === '' ? null : value
        if (test.in !== undefined) return (test.in || []).indexOf(at) !== -1
        if (test.notIn !== undefined) return (test.notIn || []).indexOf(at) === -1
        if (test.not !== undefined) return at !== test.not
        if (test.truthy !== undefined) return test.truthy ? !!at : !at
        if (test.equals !== undefined) return at === test.equals
        return true
    })
}

/**
 * The question as a person reads it.
 *
 * Stock MMGIS shows the field name, which is also the GeoJSON property key —
 * so the key had to be readable English or the question did. `label` lets the
 * key stay a terse stable identifier while the question stays a question.
 */
export function labelOf(t) {
    return t.label != null && t.label !== '' ? t.label : t.field
}

/**
 * Should this entry hold a value on a feature with these properties?
 *
 * The predicate as everything OUTSIDE the rendered form must ask it —
 * `enforceTemplate` filling in defaults, `getTemplateDefaults` computing them —
 * where there is no DOM and no `helperStates`, only stored properties.
 *
 * A `header` never applies: it asks nothing, so nothing should be stored under
 * its name. Without this it writes `undefined` to a property named after a
 * section heading.
 */
export function appliesTo(t, properties) {
    if (t == null) return false
    if (t.type === 'header') return false
    const props = properties || {}
    return passesShowIf(t, (field) => props[field])
}
