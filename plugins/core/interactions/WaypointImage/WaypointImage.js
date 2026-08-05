/**
 * Shows the image overlay attachment for the clicked feature.
 *
 * What the image is and how it is placed belongs to the image_overlays
 * attachment — this only says when to show it.
 */

import L_ from '@basics/Layers_/Layers_'

const WaypointImage = {
    use(ctx) {
        L_.makeFeatureAttachment(
            'image_overlays',
            ctx.layerData,
            ctx.layer.feature,
            { latlng: ctx.layer._latlng }
        )
    },
}

export default WaypointImage
