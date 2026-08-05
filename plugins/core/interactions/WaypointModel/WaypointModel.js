/**
 * Shows the model attachment for the clicked feature on the globe.
 *
 * What the model is and how it is oriented belongs to the model attachment —
 * this only says when to show it.
 */

import L_ from '@basics/Layers_/Layers_'

const WaypointModel = {
    use(ctx) {
        L_.makeFeatureAttachment('model', ctx.layerData, ctx.layer.feature, {
            latlng: ctx.layer._latlng,
        })
    },
}

export default WaypointModel
