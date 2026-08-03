/**
 * Model attachment — a 3D model per host feature, globe only.
 *
 * It has nothing on the 2D map, so its whole visibility story is the globe
 * layer it adds and removes.
 */
import L_ from '@basics/Layers_/Layers_'

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) L_.Globe_.litho.addLayer('model', attachment.modelOptions)
    else L_.Globe_.litho.removeLayer(attachment.layerId)
}

export default {
    setVisibility,
}
