// Compass sets up a directional compass for the leafet map
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'

var Compass = {
    CompassSVG: null,
    ScaleBox: null,
    bearing: null,
    prevBearing: null,
    smoothBearing: null,
    init: function (scaleBox) {
        //Reset the scale bars at the end of the user's zooms or pans
        Map_.map.on('zoomend', Compass.update)
        Map_.map.on('moveend', Compass.update)
        // Update at first to so it's initially visible
        Compass.update()
    },
    refresh: function () {
        Compass.update()
    },
    remove: function () {
        Map_.map.off('zoomend', Compass.update)
        Map_.map.off('moveend', Compass.update)
    },
    update: function () {
        const mapRect = document.getElementById('map').getBoundingClientRect()

        // Find center of map
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2

        //Find coordinates at map center and at another point one pixel below the center
        const centerLatLong = Map_.map.containerPointToLatLng([
            wOffset,
            hOffset,
        ])
        const pixelBelowCenterLatLong = Map_.map.containerPointToLatLng([
            wOffset,
            hOffset + 1,
        ])

        Compass.bearing = F_.bearingBetweenTwoLatLngs(
            pixelBelowCenterLatLong.lat,
            pixelBelowCenterLatLong.lng,
            centerLatLong.lat,
            centerLatLong.lng
        )

        Compass.smoothBearing = -Compass.bearing

        if ($('#mmgis-map-compass').length === 0)
            // prettier-ignore
            $('.leaflet-bottom.leaflet-left').append(
            [
                `<div id='mmgis-map-compass'>`,
                    `<div class='spin'>`,
                        `<div class='north'></div>`,
                        `<div class='south'></div>`,
                    `</div>`,
                    `<div class='info'>`,
                        `<div class='angle'></div>`,
                        `<div class='help'><div></div>North</div>`,
                    `</div>`,
                `</div>`
            ].join('\n')
        )
        $('#mmgis-map-compass .info .angle').text(
            `${((360 - Compass.bearing) % 360).toFixed(1)}°`
        )
        $('#mmgis-map-compass .spin').css({
            transform: `rotateZ(${Compass.smoothBearing}deg)`,
        })
    },
}

export default Compass
