/**
 * Compass — directional compass for the Leaflet map.
 *
 * Migrated from jQuery to native DOM. Same imperative API:
 *   Compass.init()    — binds map events and renders
 *   Compass.refresh() — updates bearing display
 *   Compass.remove()  — unbinds events
 */
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'

var Compass = {
    CompassSVG: null,
    ScaleBox: null,
    bearing: null,
    prevBearing: null,
    smoothBearing: null,
    init: function (scaleBox) {
        Map_.map.on('zoomend', Compass.update)
        Map_.map.on('moveend', Compass.update)
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
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        const mapRect = mapEl.getBoundingClientRect()

        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2

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

        let compassEl = document.getElementById('mmgis-map-compass')
        if (!compassEl) {
            const container = document.querySelector('.leaflet-bottom.leaflet-left')
            if (!container) return
            compassEl = document.createElement('div')
            compassEl.id = 'mmgis-map-compass'
            // prettier-ignore
            compassEl.innerHTML = [
                `<div class='spin'>`,
                    `<div class='north'></div>`,
                    `<div class='south'></div>`,
                `</div>`,
                `<div class='info'>`,
                    `<div class='angle'></div>`,
                    `<div class='help'><div></div>North</div>`,
                `</div>`,
            ].join('\n')
            container.appendChild(compassEl)
        }

        const angleEl = compassEl.querySelector('.info .angle')
        if (angleEl) {
            angleEl.textContent = `${((360 - Compass.bearing) % 360).toFixed(1)}°`
        }

        const spinEl = compassEl.querySelector('.spin')
        if (spinEl) {
            spinEl.style.transform = `rotateZ(${Compass.smoothBearing}deg)`
        }
    },
}

export default Compass
