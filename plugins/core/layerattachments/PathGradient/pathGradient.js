/**
 * Path-gradient attachment — the host line layer recolored along its length by
 * one of its properties.
 *
 * On the globe this primitive IS the host's geometry drawn differently, so the
 * host layer is not added there as well (capabilities.globe.suppressesHost).
 */
import L_ from '@basics/Layers_/Layers_'

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) {
        // ctx.globeOnly: the host's first toggle deferred only the heavy globe
        // geometry — the map overlay is already there.
        if (ctx.globeOnly !== true) {
            L_.Map_.map.addLayer(attachment.layer)
            ctx.applyOrder()
        }
        L_.addGradientPolyline(attachment)
    } else {
        L_.Map_.rmNotNull(attachment.layer)
        L_.removeGradientPolyline(attachment)
    }
}

export default {
    setVisibility,
}
