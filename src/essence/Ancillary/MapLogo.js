/**
 * MapLogo — displays a configurable logo on the map.
 *
 * Migrated from jQuery to native DOM. Same imperative API:
 *   MapLogo.init(config) — initializes with mission config
 *   MapLogo.refresh()    — updates the logo
 *   MapLogo.remove()     — removes the logo element
 */
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'

import './MapLogo.css'

var MapLogo = {
    config: null,
    init: function (config) {
        MapLogo.config = config || {}

        if (!MapLogo.config.mapLogoUrl) return

        MapLogo.update()
    },
    refresh: function () {
        MapLogo.update()
    },
    remove: function () {
        const el = document.getElementById('mmgis-map-logo')
        if (el) el.remove()
    },
    update: function () {
        if (!MapLogo.config.mapLogoUrl) return

        // Remove existing logo if present
        const existing = document.getElementById('mmgis-map-logo')
        if (existing) existing.remove()

        let logoUrl = MapLogo.config.mapLogoUrl

        if (!F_.isUrlAbsolute(logoUrl)) {
            if (!logoUrl.startsWith('public/') && !logoUrl.startsWith('/')) {
                logoUrl = L_.missionPath + logoUrl
            }
        }

        const sizeMap = {
            small: 64,
            medium: 128,
            large: 192
        }
        const size = MapLogo.config.mapLogoSize || 'medium'
        const width = sizeMap[size] || sizeMap.medium

        const hasLink = MapLogo.config.mapLogoLink && MapLogo.config.mapLogoLink.length > 0

        const logoEl = document.createElement('div')
        logoEl.id = 'mmgis-map-logo'
        // prettier-ignore
        logoEl.innerHTML = [
            hasLink
                ? `<a href='${MapLogo.config.mapLogoLink}' target='_blank' rel='noopener noreferrer'>`
                : '',
            `<img src='${logoUrl}' alt='Map Logo' style='width: ${width}px; height: auto; display: block;' />`,
            hasLink ? `</a>` : '',
        ].join('\n')

        const container = document.querySelector('.leaflet-bottom.leaflet-right')
        if (container) container.appendChild(logoEl)
    },
}

export default MapLogo
