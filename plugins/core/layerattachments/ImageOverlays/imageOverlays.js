/**
 * Image-overlays attachment — images georeferenced onto the 2D map.
 *
 * Visibility rides the core default (added to and removed from the map), but
 * opacity has to be applied to the overlay elements themselves.
 */
import $ from 'jquery'

function setOpacity(attachment, opacity, ctx = {}) {
    $(`.image_overlays_${ctx.hostName}`).css({ opacity })
}

export default {
    setOpacity,
}
