// Attributions collects dataset attributions for use in the About modal
import L_ from '../../../Layers_/Layers_'

var Attributions = {
    visibleAttributions: [],
    init: function () {
        Attributions.update()
    },
    refresh: function () {
        Attributions.update()
    },
    remove: function () {
        // No-op: attributions are no longer displayed on the map
    },
    update: function () {
        // Collect attributions from all visible layers
        const attributions = []
        const seen = new Set()

        if (L_.layers && L_.layers.data) {
            Object.keys(L_.layers.data).forEach((layerName) => {
                const layer = L_.layers.data[layerName]

                if (
                    L_.layers.on[layerName] === true &&
                    layer.attribution != null
                ) {
                    const key = `${layer.attribution}|${
                        layer.attributionLink || ''
                    }`
                    if (!seen.has(key)) {
                        seen.add(key)
                        attributions.push({
                            text: layer.attribution,
                            link: layer.attributionLink || null,
                        })
                    }
                }
            })
        }

        Attributions.visibleAttributions = attributions
    },
}

export default Attributions
