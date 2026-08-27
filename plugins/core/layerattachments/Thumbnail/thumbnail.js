/**
 * Thumbnail attachment — draws each point marker as the feature's own image.
 *
 * A layer of field photos, sample close-ups or site pictures is a layer of
 * identical dots until you click one. Given a property holding an image URL,
 * this draws that image as the marker, so the map shows what is actually there.
 *
 * Like Bearing, it is not a sublayer: there is nothing to add to the map, only
 * a change to how its host draws its own point features. It reports the markup
 * and core builds the marker from it.
 *
 * The marker is ONE shape — a speech-bubble outline whose tail points along the
 * feature's heading — with the image clipped inside it. It is deliberately not
 * a triangle layered behind a square: two stacked shapes show their seam, the
 * overlap has to be hidden by paint order, and the result reads as two things
 * that happen to touch rather than one object. A single filled path with the
 * tail blended into the frame by tangent-continuous curves has no seam to hide.
 *
 * The tail is placed by ANGLE about the marker's centre, never by picking one
 * of the outline's four sides. An earlier version chose a side from the heading
 * and slid the base along it, which had to clamp the base to keep it on a flat
 * run while the apex went on following the true heading. The two decoupled off
 * axis: on a 56px marker the base ended up as much as 13px away from the
 * heading ray, the tip swung between 38 and 50px from the centre, and the tail
 * snapped to a new side four times per revolution. The marker read as pointing
 * AT something rather than showing which way the camera faced. Putting both
 * roots of the base on the outline at a fixed offset either side of the heading
 * ray, and the apex on a circle, makes every heading the same shape in a
 * different orientation — 0px skew, 0% tip-radius spread, no snap.
 */

import F_ from '@basics/Formulae_/Formulae_'

const DEFAULT_SIZE = 56
const DEFAULT_BORDER_WIDTH = 2
const DEFAULT_BORDER_COLOR = '#ffffff'
const DEFAULT_TAIL_LENGTH = 10
const DEFAULT_TAIL_HALF_BASE = 6
/** Corner radius for `shape: 'square'`. A circle is the size's half-width. */
const SQUARE_CORNER_RADIUS = 4
/** Room around the outline for the drop shadow, so the box never clips it. */
const SHADOW_PADDING = 4

/** Distinct clip-path ids per marker; two markers must not share one. */
let uid = 0

/**
 * Selection styling, injected once.
 *
 * The outline is inside marker markup built when the feature is drawn, so
 * recolouring it on selection has to happen in CSS — rebuilding every marker on
 * each selection change would cost far more than a class toggle. Core adds
 * `mmgisSelectedMarker` to the selected marker's element; this rule is what
 * makes that visible.
 */
const TAIL_STYLE_ID = 'thumbnailAttachmentStyle'
function ensureTailStyle() {
    if (typeof document === 'undefined') return
    if (document.getElementById(TAIL_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = TAIL_STYLE_ID
    style.textContent =
        '.mmgisSelectedMarker .thumbnailBubble{' +
        'fill:var(--thumbnail-frame-selected,var(--thumbnail-frame));}'
    document.head.appendChild(style)
}

const round2 = (v) => Math.round(v * 100) / 100
/**
 * Built-in vector glyphs for features with no image.
 *
 * Drawn as geometry inside the marker's own SVG rather than as an icon-font
 * character. Marker markup is generated at runtime, so a webfont class in it
 * depends on that stylesheet surviving the host's CSS build and the font file
 * resolving from wherever the page is served — neither of which this plugin
 * controls, and both of which fail silently as a blank marker. Geometry has no
 * such dependency and scales to any marker size.
 *
 * `emptyIcon` still accepts any Material Design Icons name; anything not
 * listed here falls back to that class, so existing configs keep working.
 */
const BUILTIN_GLYPHS = {
    note: (x, y, s, ink, paper) => {
        const w = s * 0.5
        const h = s * 0.62
        const px = x + (s - w) / 2
        const py = y + (s - h) / 2
        const lh = Math.max(1, s * 0.055)
        const lw = w * 0.62
        const parts = [
            `<rect x="${round2(px)}" y="${round2(py)}" width="${round2(w)}" ` +
                `height="${round2(h)}" rx="${round2(s * 0.06)}" fill="${paper}"/>`,
        ]
        // Three ruled lines, the last one short, which is what makes a blank
        // rounded rectangle read as written-on paper.
        for (let i = 0; i < 3; i++) {
            const width = i === 2 ? lw * 0.6 : lw
            parts.push(
                `<rect x="${round2(px + (w - lw) / 2)}" ` +
                    `y="${round2(py + h * (0.26 + i * 0.22))}" ` +
                    `width="${round2(width)}" height="${round2(lh)}" ` +
                    `rx="${round2(lh / 2)}" fill="${ink}"/>`
            )
        }
        return parts.join('')
    },
}
BUILTIN_GLYPHS['note-text'] = BUILTIN_GLYPHS.note

const pt = (p) => `${round2(p[0])},${round2(p[1])}`
const unit = (a, b) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    return [dx / len, dy / len]
}

/**
 * The marker's outline as a closed curve: four straight runs and four corner
 * arcs, walked clockwise and parameterised by arc length.
 *
 * Every question the tail asks is answered by root-finding on this one
 * function, which is why a square, a rounded square and a circle are the same
 * code path instead of three cases with three sets of edge conditions. A
 * `cornerRadius` of half the size gives a true circle; zero gives a square.
 *
 * Clockwise here means clockwise ON SCREEN: y grows downward, so an arc's angle
 * increasing is a clockwise turn, and the tangent below is the direction of
 * travel rather than the mathematical one.
 */
function outlineOf(size, cornerRadius) {
    const h = size / 2
    // No cap beyond the marker itself. The previous version also capped the
    // radius to leave a flat run for the tail's base, which silently rendered
    // `shape: 'circle'` as a squircle — the corner radius the config asked for
    // was never the one drawn.
    const rr = Math.max(0, Math.min(cornerRadius, h))
    const k = h - rr
    const flat = 2 * k
    const quarter = (Math.PI / 2) * rr

    const line = (a, b) => ({
        line: true,
        a,
        b,
        len: Math.hypot(b[0] - a[0], b[1] - a[1]),
    })
    const arc = (cx, cy, a0) => ({
        line: false,
        c: [cx, cy],
        r: rr,
        a0,
        len: quarter,
    })

    const segs = []
    if (flat > 0) segs.push(line([-k, -h], [k, -h]))
    if (rr > 0) segs.push(arc(k, -k, -Math.PI / 2))
    if (flat > 0) segs.push(line([h, -k], [h, k]))
    if (rr > 0) segs.push(arc(k, k, 0))
    if (flat > 0) segs.push(line([k, h], [-k, h]))
    if (rr > 0) segs.push(arc(-k, k, Math.PI / 2))
    if (flat > 0) segs.push(line([-h, k], [-h, -k]))
    if (rr > 0) segs.push(arc(-k, -k, Math.PI))

    let total = 0
    for (const seg of segs) {
        seg.s0 = total
        total += seg.len
    }
    return { segs, total, rr, maxR: Math.hypot(k, k) + rr }
}

/** Index of the segment containing arc length `s`. */
function segmentAt(o, s) {
    let lo = 0
    let hi = o.segs.length - 1
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (o.segs[mid].s0 <= s) lo = mid
        else hi = mid - 1
    }
    return lo
}

/** Position and clockwise unit tangent at arc length `s`. */
function outlineAt(o, s) {
    s = ((s % o.total) + o.total) % o.total
    const seg = o.segs[segmentAt(o, s)]
    const u = s - seg.s0
    if (seg.line) {
        const t = unit(seg.a, seg.b)
        return { p: [seg.a[0] + t[0] * u, seg.a[1] + t[1] * u], t }
    }
    const a = seg.a0 + u / seg.r
    return {
        p: [seg.c[0] + seg.r * Math.cos(a), seg.c[1] + seg.r * Math.sin(a)],
        t: [-Math.sin(a), Math.cos(a)],
    }
}

/**
 * Where the outline crosses the line `P·n = offset`, taking the crossing that
 * lies furthest along `dir`.
 *
 * The outline is convex, so the line meets it exactly twice and the forward one
 * is the root wanted. Bracketing on a coarse sample and then bisecting keeps
 * this free of per-shape algebra: the corner radius can be anything from a
 * square to a circle without a special case appearing here.
 */
function forwardCrossing(o, n, offset, dir) {
    const STEPS = 180
    const at = (s) => {
        const p = outlineAt(o, s).p
        return p[0] * n[0] + p[1] * n[1] - offset
    }
    const crosses = (a, b) => (a <= 0 && b > 0) || (a >= 0 && b < 0)

    let best = null
    let bestAhead = -Infinity
    let sPrev = 0
    let gPrev = at(0)
    for (let i = 1; i <= STEPS; i++) {
        const s = (i / STEPS) * o.total
        const g = at(s)
        if (crosses(gPrev, g)) {
            let lo = sPrev
            let hi = s
            let gLo = gPrev
            for (let j = 0; j < 24; j++) {
                const mid = (lo + hi) / 2
                const gMid = at(mid)
                if (crosses(gLo, gMid)) hi = mid
                else {
                    lo = mid
                    gLo = gMid
                }
            }
            const root = (lo + hi) / 2
            const p = outlineAt(o, root).p
            const ahead = p[0] * dir[0] + p[1] * dir[1]
            if (ahead > bestAhead) {
                bestAhead = ahead
                best = root
            }
        }
        sPrev = s
        gPrev = g
    }
    return best
}

/**
 * Walk the outline clockwise from `sFrom` to `sTo`, emitting real lines and
 * arcs. `sTo === sFrom` means the whole way round.
 *
 * Stepping by segment index rather than re-locating the segment from a running
 * arc length is deliberate: the accumulated float lands a hair short of the
 * next boundary, which yields zero-length steps and — once the loop guard trips
 * — an outline that silently stops part way round. What that looks like is a
 * marker with a bite taken out of it, or no marker at all.
 */
function walkOutline(o, sFrom, sTo, project) {
    let left = (((sTo - sFrom) % o.total) + o.total) % o.total
    if (left <= 1e-9) left = o.total
    let s = ((sFrom % o.total) + o.total) % o.total
    let i = segmentAt(o, s)

    const out = []
    for (let guard = 0; left > 1e-7 && guard < o.segs.length + 2; guard++) {
        const seg = o.segs[i]
        const step = Math.min(left, seg.s0 + seg.len - s)
        if (step > 1e-9) {
            const end = outlineAt(o, s + step).p
            out.push(
                seg.line
                    ? `L${project(end)}`
                    : `A${round2(seg.r)},${round2(seg.r)} 0 0 1 ${project(end)}`
            )
            left -= step
        }
        i = (i + 1) % o.segs.length
        s = o.segs[i].s0
    }
    return out.join('')
}

/**
 * The marker's path: the outline, plus a tail when the feature has a heading,
 * as one continuous shape.
 *
 * The frame NEVER rotates — a photo turned to match its own heading is a photo
 * you cannot read. Instead the tail travels around the perimeter, exactly as a
 * speech bubble stays upright while its tail moves to point at whoever is
 * speaking. `yaw` is whatever the Bearing attachment worked out for this
 * feature, already corrected for the angle between north and screen-up; this
 * attachment neither repeats that math nor needs to know how it was done.
 *
 * Both roots of the tail sit exactly `halfBase` either side of the heading ray,
 * and the apex sits on a circle of fixed radius about the centre. The tail is
 * therefore symmetric about the direction it claims to point at EVERY heading,
 * and the tip traces a circle as the heading turns rather than swelling towards
 * the corners. Where the frame is not itself a circle the two roots sit at
 * different distances along the ray — that is the tail hugging the frame, and
 * it is the only asymmetry left.
 */
function bubbleOutline(o, box, size, tailLength, halfBase, apexRadius, yaw) {
    const c = box / 2
    const x0 = (box - size) / 2
    // Geometry is worked out about the origin and moved into the box only as it
    // is written out, so none of the math above has to carry the offset around.
    const project = (p) => pt([p[0] + c, p[1] + c])
    const plain = () => ({
        d: `M${project(outlineAt(o, 0).p)}${walkOutline(o, 0, 0, project)}Z`,
        x0,
        y0: x0,
        rr: o.rr,
    })

    if (typeof yaw !== 'number' || !isFinite(yaw)) return plain()

    const th = (yaw * Math.PI) / 180
    // Screen coordinates: yaw 0 is up, and y grows downward.
    const dir = [Math.sin(th), -Math.cos(th)]
    // Clockwise-positive perpendicular, so the root at -hb is the one reached
    // first travelling clockwise and the walk back closes the shape correctly.
    const nrm = [-dir[1], dir[0]]

    const hb = Math.max(1, Math.min(halfBase, o.maxR - 0.5))
    const sStart = forwardCrossing(o, nrm, -hb, dir)
    const sEnd = forwardCrossing(o, nrm, hb, dir)
    if (sStart == null || sEnd == null) return plain()

    const A = outlineAt(o, sStart)
    const B = outlineAt(o, sEnd)
    const apex = [dir[0] * apexRadius, dir[1] * apexRadius]

    const l1 = Math.hypot(apex[0] - A.p[0], apex[1] - A.p[1])
    const l2 = Math.hypot(B.p[0] - apex[0], B.p[1] - apex[1])
    // Leaving A and arriving at B along the OUTLINE's own tangent there makes
    // the path tangent-continuous at both roots: the tail flares out of the
    // frame instead of meeting it at a visible corner, on a flat run and around
    // a corner alike. This is the join that stacking two shapes cannot produce.
    const k = Math.min(hb * 0.6, l1 * 0.5, l2 * 0.5)
    const a1 = unit(apex, A.p)
    const a2 = unit(apex, B.p)

    // The two curves meet AT the apex with no rounding between them, so the tip
    // is a true corner. Their control points lie on the straight lines back
    // from the apex, which keeps each curve arriving dead straight and makes
    // the corner as sharp as the two directions allow.
    return {
        d: [
            `M${project(A.p)}`,
            `C${project([A.p[0] + A.t[0] * k, A.p[1] + A.t[1] * k])} ` +
                `${project([apex[0] + a1[0] * l1 * 0.35, apex[1] + a1[1] * l1 * 0.35])} ` +
                `${project(apex)}`,
            `C${project([apex[0] + a2[0] * l2 * 0.35, apex[1] + a2[1] * l2 * 0.35])} ` +
                `${project([B.p[0] - B.t[0] * k, B.p[1] - B.t[1] * k])} ` +
                `${project(B.p)}`,
            walkOutline(o, sEnd, sStart, project),
            'Z',
        ].join(''),
        x0,
        y0: x0,
        rr: o.rr,
    }
}

function decorateFeature(ctx = {}) {
    const config = ctx.config
    if (config == null) return
    if (config.enabled !== true && config.enabled != null) return

    const pathProp = config.pathProp
    if (!pathProp) return

    const rawUrl = F_.getIn(ctx.feature?.properties, pathProp, null)
    const hasImage = typeof rawUrl === 'string' && rawUrl.trim() !== ''

    // Accept both 'note-text' and 'mdi-note-text'. The class is built as
    // `mdi mdi-<glyph>`, so a prefixed value silently yields `mdi-mdi-note-text`
    // and draws a bare frame — a config typo that looks exactly like a missing
    // image, which is the one thing this fallback exists to distinguish.
    const glyph = (
        typeof config.emptyIcon === 'string' ? config.emptyIcon.trim() : ''
    ).replace(/^mdi-/, '')

    // A feature with no image still gets a marker when the layer names a
    // fallback glyph — an observation without a photograph is a real thing to
    // put on a map, not an error. Without one, fall through to the layer's
    // ordinary marker.
    if (!hasImage && !glyph) return

    ensureTailStyle()

    const url = hasImage ? F_.escapeHtml(rawUrl.trim()) : ''
    const size = parseInt(config.sizePixels, 10) || DEFAULT_SIZE
    const borderWidth =
        config.borderWidth == null
            ? DEFAULT_BORDER_WIDTH
            : parseInt(config.borderWidth, 10) || 0
    const borderColor = F_.escapeHtml(
        config.borderColor || DEFAULT_BORDER_COLOR
    )
    const fillColor = F_.escapeHtml(ctx.featureStyle?.fillColor || '#ff6400')

    const tailLength = Math.max(
        2,
        parseFloat(config.tailLengthPixels) || DEFAULT_TAIL_LENGTH
    )
    const halfBase = Math.max(
        1,
        parseFloat(config.tailHalfBasePixels) || DEFAULT_TAIL_HALF_BASE
    )
    const cornerRadius =
        config.shape === 'square' ? SQUARE_CORNER_RADIUS : size / 2

    // Worked out once per layer, not once per feature: the outline depends only
    // on the config, and every marker in a layer is the same shape in a
    // different orientation.
    const geom = outlineOf(size, cornerRadius)
    const apexRadius = geom.maxR + tailLength

    // The tail needs room outside the image, so the marker box is larger than
    // the picture it shows. Derived from the geometry rather than configured:
    // a hand-set ring could only ever be too small (a clipped tail) or too
    // large (markers that crowd each other for no reason), and too small shows
    // up as a tail with its tip sliced off at one heading and not others.
    const box = Math.ceil(apexRadius + SHADOW_PADDING) * 2
    const builtin = BUILTIN_GLYPHS[glyph] || null

    const html = (yaw) => {
        const { d, x0, y0, rr } = bubbleOutline(
            geom,
            box,
            size,
            tailLength,
            halfBase,
            apexRadius,
            typeof yaw === 'number' && isFinite(yaw) ? yaw : null
        )

        const id = `thumbClip${++uid}`
        const ix = x0 + borderWidth
        const iy = y0 + borderWidth
        const isize = Math.max(0, size - borderWidth * 2)
        const ir = Math.max(0, rr - borderWidth)

        // The frame is the whole outline, filled. What sits on it — photo or
        // glyph panel — is inset by the border width, so the border is the
        // frame showing through rather than a second stroked shape.
        const inner = hasImage
            ? [
                  `<image href="${url}" x="${round2(ix)}" y="${round2(iy)}" `,
                  `width="${round2(isize)}" height="${round2(isize)}" `,
                  `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" `,
                  // Hide only the image, never the frame under it, and say so —
                  // a silent failure here looks exactly like the layer not
                  // drawing at all.
                  `onerror="this.style.display='none';`,
                  `if(window.console)console.warn('[thumbnail] image failed to load: '+this.getAttribute('href'));"`,
                  `/>`,
              ].join('')
            : [
                  `<rect x="${round2(ix)}" y="${round2(iy)}" `,
                  `width="${round2(isize)}" height="${round2(isize)}" `,
                  `rx="${round2(ir)}" ry="${round2(ir)}" fill="${fillColor}"/>`,
                  // Paper in the frame colour, ruling in the panel colour, so
                  // the glyph is legible whatever the two are set to.
                  builtin ? builtin(ix, iy, isize, fillColor, borderColor) : '',
              ].join('')

        // The glyph stays HTML: it is a webfont icon, and an SVG <text> would
        // have to duplicate the font stack that the mdi class already carries.
        const glyphMarkup = hasImage || builtin
            ? ''
            : [
                  `<div style="position:absolute;top:${round2(iy)}px;left:${round2(ix)}px;`,
                  `width:${round2(isize)}px;height:${round2(isize)}px;display:flex;`,
                  `align-items:center;justify-content:center;color:${borderColor};`,
                  `font-size:${Math.round(size * 0.5)}px;line-height:1;pointer-events:none;">`,
                  `<i class="mdi mdi-${F_.escapeHtml(glyph)}"></i>`,
                  `</div>`,
              ].join('')

        return [
            `<div style="position:relative;width:${box}px;height:${box}px;`,
            // Custom properties rather than a hard-coded fill: the selected
            // colour is per-layer config, and CSS cannot read it any other way.
            `--thumbnail-frame:${borderColor};--thumbnail-frame-selected:${fillColor};">`,
            `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" `,
            `style="position:absolute;top:0;left:0;overflow:visible;">`,
            `<defs><clipPath id="${id}">`,
            `<rect x="${round2(ix)}" y="${round2(iy)}" `,
            `width="${round2(isize)}" height="${round2(isize)}" `,
            `rx="${round2(ir)}" ry="${round2(ir)}"/>`,
            `</clipPath></defs>`,
            `<path class="thumbnailBubble" d="${d}" fill="var(--thumbnail-frame)" `,
            `style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));"/>`,
            inner,
            `</svg>`,
            glyphMarkup,
            `</div>`,
        ].join('')
    }

    return {
        html,
        iconSize: [box, box],
        className: 'mmgisMarkerThumbnail',
    }
}

export default {
    decorateFeature,
}
