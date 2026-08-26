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
 */

import F_ from '@basics/Formulae_/Formulae_'

const DEFAULT_SIZE = 56
const DEFAULT_BORDER_WIDTH = 2
const DEFAULT_BORDER_COLOR = '#ffffff'
const DEFAULT_RING = 14

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
 * The marker's outline: a rounded square, plus a tail when the feature has a
 * heading, as a single continuous path.
 *
 * The square NEVER rotates — a photo turned to match its own heading is a photo
 * you cannot read. Instead the tail's attachment point travels around the
 * perimeter, exactly as a speech bubble stays upright while its tail moves to
 * point at whoever is speaking. `yaw` is whatever the Bearing attachment worked
 * out for this feature, already corrected for the angle between north and
 * screen-up; this attachment neither repeats that math nor needs to know how it
 * was done.
 *
 * The tail is much wider at the base than it is long. An equilateral triangle
 * reads as ambiguous — with all three sides equal there is no strong cue as to
 * which vertex is the point, so at a glance two markers with different headings
 * can look like they aim the same way. When the base is far wider than the tail
 * is long, only one end can possibly be the tip.
 */
function bubbleOutline(box, size, cornerRadius, tailLength, halfBase, yaw) {
    const x0 = (box - size) / 2
    const y0 = x0
    const x1 = x0 + size
    const y1 = y0 + size
    const c = box / 2

    // The tail's base has to sit on a FLAT run of the outline, so the corner
    // radius is capped to leave one. Applied whether or not this particular
    // feature has a heading, so every marker in a layer is the same shape: a
    // radius that changed with the presence of a compass reading would look
    // like two different layers.
    const rr = Math.max(
        0,
        Math.min(cornerRadius, size / 2 - halfBase - 2, size / 2)
    )

    // Clockwise from the top-left corner. `t` is the direction of travel.
    const edges = [
        { S: [x0 + rr, y0], E: [x1 - rr, y0], t: [1, 0] },
        { S: [x1, y0 + rr], E: [x1, y1 - rr], t: [0, 1] },
        { S: [x1 - rr, y1], E: [x0 + rr, y1], t: [-1, 0] },
        { S: [x0, y1 - rr], E: [x0, y0 + rr], t: [0, -1] },
    ]

    let tail = null
    if (typeof yaw === 'number' && isFinite(yaw)) {
        const th = (yaw * Math.PI) / 180
        // Screen coordinates: yaw 0 is up, and y grows downward.
        const dir = [Math.sin(th), -Math.cos(th)]
        const h = size / 2
        const tx = Math.abs(dir[0]) > 1e-9 ? h / Math.abs(dir[0]) : Infinity
        const ty = Math.abs(dir[1]) > 1e-9 ? h / Math.abs(dir[1]) : Infinity
        const hit = Math.min(tx, ty)

        const idx = ty <= tx ? (dir[1] < 0 ? 0 : 2) : dir[0] > 0 ? 1 : 3
        const e = edges[idx]
        const len = Math.hypot(e.E[0] - e.S[0], e.E[1] - e.S[1])
        const hb = Math.max(2, Math.min(halfBase, len / 2 - 1))

        // Where the heading ray leaves the square, as a distance along that
        // edge, clamped so the whole base stays on the flat run.
        const exit = [c + dir[0] * hit, c + dir[1] * hit]
        let u = (exit[0] - e.S[0]) * e.t[0] + (exit[1] - e.S[1]) * e.t[1]
        u = Math.max(hb, Math.min(len - hb, u))

        tail = {
            idx,
            t: e.t,
            hb,
            B1: [e.S[0] + e.t[0] * (u - hb), e.S[1] + e.t[1] * (u - hb)],
            B2: [e.S[0] + e.t[0] * (u + hb), e.S[1] + e.t[1] * (u + hb)],
            // The apex follows the true heading, not the edge normal, so a
            // marker facing north-east leans its tail into the corner rather
            // than pointing squarely off one side.
            apex: [
                c + dir[0] * (hit + tailLength),
                c + dir[1] * (hit + tailLength),
            ],
        }
    }

    const tailPath = (tl) => {
        const { B1, B2, apex, t, hb } = tl
        const l1 = Math.hypot(apex[0] - B1[0], apex[1] - B1[1])
        const l2 = Math.hypot(B2[0] - apex[0], B2[1] - apex[1])
        // Leaving B1 and arriving at B2 along the edge direction makes the
        // outline tangent-continuous there: the tail flares out of the frame
        // instead of meeting it at a visible corner. This is the join that
        // stacking two shapes can never produce.
        const k = Math.min(hb * 0.6, l1 * 0.5, l2 * 0.5)
        const a1 = unit(apex, B1)
        const a2 = unit(apex, B2)
        // The two curves meet AT the apex with no rounding between them, so the
        // tip is a true corner. Their control points lie on the straight lines
        // back from the apex, which keeps each curve arriving dead straight and
        // makes the corner as sharp as the two edge directions allow.
        return [
            `L${pt(B1)}`,
            `C${pt([B1[0] + t[0] * k, B1[1] + t[1] * k])} ` +
                `${pt([apex[0] + a1[0] * l1 * 0.35, apex[1] + a1[1] * l1 * 0.35])} ` +
                `${pt(apex)}`,
            `C${pt([apex[0] + a2[0] * l2 * 0.35, apex[1] + a2[1] * l2 * 0.35])} ` +
                `${pt([B2[0] - t[0] * k, B2[1] - t[1] * k])} ` +
                `${pt(B2)}`,
        ].join('')
    }

    const d = [`M${pt(edges[0].S)}`]
    for (let i = 0; i < 4; i++) {
        if (tail && tail.idx === i) d.push(tailPath(tail))
        d.push(`L${pt(edges[i].E)}`)
        if (rr > 0) d.push(`A${round2(rr)},${round2(rr)} 0 0 1 ${pt(edges[(i + 1) % 4].S)}`)
    }
    d.push('Z')

    return { d: d.join(''), x0, y0, rr }
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

    // The tail needs room outside the image, so the marker box is larger than
    // the picture it shows.
    const ring = parseInt(config.arrowRingPixels, 10) || DEFAULT_RING
    const box = size + ring * 2
    const tailLength = Math.max(6, ring - 2)
    const halfBase = Math.max(6, Math.min(size * 0.22, size * 0.35))
    const cornerRadius = config.shape === 'square' ? 4 : size / 2
    const builtin = BUILTIN_GLYPHS[glyph] || null

    const html = (yaw) => {
        const { d, x0, y0, rr } = bubbleOutline(
            box,
            size,
            cornerRadius,
            tailLength,
            halfBase,
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
