/**
 * Labels attachment — per-feature text labels on the 2D map.
 *
 * The label layer is always on the map once made; it draws or clears itself
 * instead of being added to and removed from the map, so it owns setVisibility.
 */

function setVisibility(attachment, ctx = {}) {
    if (attachment.layer == null) return

    if (ctx.visible) attachment.layer.on(false, attachment.layer)
    else attachment.layer.off()
}

export default {
    setVisibility,
}
