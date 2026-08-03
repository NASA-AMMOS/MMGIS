/**
 * Pairings attachment — lines between a host layer's features and the features
 * of the layers it pairs with.
 *
 * Like Labels, the pairing layer lives on the map and redraws itself, so
 * showing it means asking it to draw rather than adding it to the map.
 */

function setVisibility(attachment, ctx = {}) {
    if (attachment.layer == null) return

    if (ctx.visible) attachment.layer.on(false, attachment.layer)
    else attachment.layer.off()
}

export default {
    setVisibility,
}
