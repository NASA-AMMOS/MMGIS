/**
 * Compass — directional compass overlay for the Leaflet map.
 *
 * Full React component rendered via createRoot into the Leaflet
 * bottom-left control container. Updates bearing on map move/zoom.
 *
 * Same imperative API:
 *   Compass.init()    — mounts the component and binds map events
 *   Compass.refresh() — forces a bearing update
 *   Compass.remove()  — unmounts and unbinds
 */
import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import F_ from '../../../Formulae_/Formulae_'
import Map_ from '../../../Map_/Map_'

function CompassWidget() {
    const [bearing, setBearing] = useState(0)

    const update = useCallback(() => {
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        const rect = mapEl.getBoundingClientRect()

        const wOffset = rect.width / 2
        const hOffset = rect.height / 2

        const center = Map_.map.containerPointToLatLng([wOffset, hOffset])
        const below = Map_.map.containerPointToLatLng([wOffset, hOffset + 1])

        const b = F_.bearingBetweenTwoLatLngs(below.lat, below.lng, center.lat, center.lng)
        setBearing(b)
    }, [])

    useEffect(() => {
        Map_.map.on('zoomend', update)
        Map_.map.on('moveend', update)
        update()

        // Expose update for imperative refresh
        Compass._update = update

        return () => {
            Map_.map.off('zoomend', update)
            Map_.map.off('moveend', update)
        }
    }, [update])

    const rotation = -bearing
    const displayAngle = ((360 - bearing) % 360).toFixed(1)

    return (
        <div id="mmgis-map-compass">
            <div className="spin" style={{ transform: `rotateZ(${rotation}deg)` }}>
                <div className="north" />
                <div className="south" />
            </div>
            <div className="info">
                <div className="angle">{displayAngle}°</div>
                <div className="help">
                    <div />
                    North
                </div>
            </div>
        </div>
    )
}

// ── Imperative service ──────────────────────────────────────────────────

let _root = null
let _container = null

const Compass = {
    _update: null,
    bearing: null,

    init: function () {
        Compass.remove()

        const leafletContainer = document.querySelector('.leaflet-bottom.leaflet-left')
        if (!leafletContainer) return

        _container = document.createElement('div')
        _container.id = 'compassRoot'
        leafletContainer.appendChild(_container)

        _root = createRoot(_container)
        _root.render(<CompassWidget />)
    },

    refresh: function () {
        if (Compass._update) Compass._update()
    },

    remove: function () {
        if (_root) {
            _root.unmount()
            _root = null
        }
        if (_container && _container.parentNode) {
            _container.parentNode.removeChild(_container)
            _container = null
        }
    },
}

export default Compass
