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
 */

import F_ from '@basics/Formulae_/Formulae_'

const DEFAULT_SIZE = 56
const DEFAULT_BORDER_WIDTH = 2
const DEFAULT_BORDER_COLOR = '#ffffff'

/**
 * The arrow drawn outside the thumbnail to show which way the feature faces.
 *
 * Only the arrow turns — a photo rotated to match its own heading would be a
 * photo you cannot read. `yaw` is whatever the Bearing attachment worked out
 * for this feature, already corrected for the angle between north and
 * screen-up; this attachment neither repeats that math nor needs to know how
 * it was done.
 */
function bearingArrow(yaw, size, color) {
    const half = size / 2
    return [
        `<div style="position:absolute;top:0;left:0;width:${size}px;height:${size}px;`,
        `transform:rotateZ(${yaw}deg);transform-origin:center;pointer-events:none;">`,
        `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;">`,
        `<path d="M${half},-8L${half - 7},4L${half + 7},4Z" fill="${color}"/>`,
        `</svg>`,
        `</div>`,
    ].join('')
}

/**
 * @param {Object} ctx  { layerObj, feature, latlong, featureStyle, config }
 * @returns {{html: Function, iconSize: number[], className: string}|undefined}
 */
function decorateFeature(ctx = {}) {
    const config = ctx.config
    if (config == null) return
    if (config.enabled !== true && config.enabled != null) return

    const pathProp = config.pathProp
    if (!pathProp) return

    const rawUrl = F_.getIn(ctx.feature?.properties, pathProp, null)
    // A feature with no image is not an error — it keeps the layer's ordinary
    // marker rather than showing a broken one.
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return

    const url = F_.escapeHtml(rawUrl.trim())
    const size = parseInt(config.sizePixels, 10) || DEFAULT_SIZE
    const borderWidth =
        config.borderWidth == null
            ? DEFAULT_BORDER_WIDTH
            : parseInt(config.borderWidth, 10) || 0
    const borderColor = F_.escapeHtml(
        config.borderColor || DEFAULT_BORDER_COLOR
    )
    const radius = config.shape === 'square' ? '3px' : '50%'

    const html = (yaw) => {
        const img = [
            `<img src="${url}" alt="" `,
            `style="width:100%;height:100%;object-fit:cover;border-radius:${radius};`,
            `border:${borderWidth}px solid ${borderColor};`,
            `box-shadow:0 1px 4px rgba(0,0,0,0.5);display:block;"`,
            // A URL that 404s should leave the map clean rather than showing a
            // broken-image glyph at every point.
            ` onerror="this.style.display='none'"`,
            `/>`,
        ].join('')

        const arrow =
            typeof yaw === 'number' && isFinite(yaw)
                ? bearingArrow(yaw, size, borderColor)
                : ''

        return `<div style="position:relative;width:${size}px;height:${size}px;">${arrow}${img}</div>`
    }

    return {
        html,
        iconSize: [size, size],
        className: 'mmgisMarkerThumbnail',
    }
}

export default {
    decorateFeature,
}
