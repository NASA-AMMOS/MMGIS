/**
 * Uncertainty-ellipses attachment — an overlay on the 2D map plus a curtain and
 * a clamped surface on the globe, which is why one visibility change means
 * three engine layers.
 */
import L_ from '@basics/Layers_/Layers_'

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) {
        L_.Globe_.litho.addLayer('curtain', attachment.curtainOptions)
        L_.Globe_.litho.addLayer('clamped', attachment.clampedOptions)
        L_.Map_.map.addLayer(attachment.layer)
        ctx.applyOrder()
    } else {
        L_.Globe_.litho.removeLayer(attachment.curtainLayerId)
        L_.Globe_.litho.removeLayer(attachment.clampedLayerId)
        L_.Map_.rmNotNull(attachment.layer)
    }
}

export default {
    setVisibility,
}
