// MapLogo displays a configurable logo on the map
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'

import './MapLogo.css'

var MapLogo = {
    config: null,
    init: function (config) {
        MapLogo.config = config || {}

        // Only initialize if mapLogoUrl is configured
        if (!MapLogo.config.mapLogoUrl) return

        MapLogo.update()
    },
    refresh: function () {
        MapLogo.update()
    },
    remove: function () {
        $('#mmgis-map-logo').remove()
    },
    update: function () {
        // Only show if configured
        if (!MapLogo.config.mapLogoUrl) return

        // Remove existing logo if present
        if ($('#mmgis-map-logo').length > 0) {
            $('#mmgis-map-logo').remove()
        }

        // Process the logo URL - handle both absolute URLs and relative paths
        let logoUrl = MapLogo.config.mapLogoUrl

        // If it's not an absolute URL, prepend the mission path
        // This handles relative paths like "Missions/MyMission/logo.png" or "public/images/logos/logo.png"
        if (!F_.isUrlAbsolute(logoUrl)) {
            // Check if it starts with 'public' (common for shared assets)
            // or if it needs the mission path prefix
            if (!logoUrl.startsWith('public/') && !logoUrl.startsWith('/')) {
                logoUrl = L_.missionPath + logoUrl
            }
        }

        // Map size options to pixel widths
        const sizeMap = {
            small: 64,
            medium: 128,
            large: 192
        }
        const size = MapLogo.config.mapLogoSize || 'medium'
        const width = sizeMap[size] || sizeMap.medium

        const hasLink = MapLogo.config.mapLogoLink && MapLogo.config.mapLogoLink.length > 0

        // Build the logo HTML
        const logoHtml = [
            `<div id='mmgis-map-logo'>`,
                hasLink
                    ? `<a href='${MapLogo.config.mapLogoLink}' target='_blank' rel='noopener noreferrer'>`
                    : '',
                `<img src='${logoUrl}' alt='Map Logo' style='width: ${width}px; height: auto; display: block;' />`,
                hasLink ? `</a>` : '',
            `</div>`
        ].join('\n')

        // Append to the leaflet bottom-right container
        $('.leaflet-bottom.leaflet-right').append(logoHtml)
    },
}

export default MapLogo
