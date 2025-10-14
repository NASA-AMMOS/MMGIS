// Attributions displays dataset attributions below the scalebar
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'

import './Attributions.css'

var Attributions = {
    visibleAttributions: [],
    init: function () {
        Attributions.update()
    },
    refresh: function () {
        Attributions.update()
    },
    remove: function () {
        $('#mmgis-attributions').remove()
    },
    update: function () {
        // Collect attributions from all visible layers
        const attributions = []
        const seen = new Set()

        // Check all layers
        if (L_.layers && L_.layers.data) {
            Object.keys(L_.layers.data).forEach((layerName) => {
                const layer = L_.layers.data[layerName]

                // Only include if layer is on and has attribution
                if (
                    L_.layers.on[layerName] === true &&
                    layer.attribution != null
                ) {
                    // Avoid duplicate attributions
                    const key = `${layer.attribution}|${
                        layer.attributionLink || ''
                    }`
                    console.log(key)
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

        // Store current state
        Attributions.visibleAttributions = attributions

        // Remove existing attribution display
        $('#mmgis-attributions').remove()

        // Adjust mapToolBar height and compass position based on attribution presence
        const attributionHeight = 21
        if (attributions.length === 0) {
            // No attributions - restore original heights
            const currentHeight = parseInt($('#mapToolBar').css('height')) || 40
            if (currentHeight > 40) {
                $('#mapToolBar').css('height', '40px')
            }
            // Set compass to base position when no attributions
            $('#mmgis-map-compass').css('bottom', '38px')
            return
        }

        // Build the attribution HTML
        const attributionItems = attributions.map((attr) => {
            if (attr.link && attr.link.length > 0) {
                return `<a href='${attr.link}' target='_blank' rel='noopener noreferrer'>${attr.text}</a>`
            } else {
                return `<span>${attr.text}</span>`
            }
        })

        const attributionsHtml = [
            `<div id='mmgis-attributions'>`,
            `@ ${attributionItems.join(' | ')}`,
            `</div>`,
        ].join('\n')

        // Append to the leaflet bottom-left container (below scalebar)
        $('.leaflet-bottom.leaflet-left').append(attributionsHtml)

        // Increase mapToolBar height to make room for attributions
        $('#mapToolBar').css('height', 40 + attributionHeight + 'px')

        // Set compass position to account for attributions (38px base + 21px attribution height)
        $('#mmgis-map-compass').css('bottom', '59px')
    },
}

export default Attributions
