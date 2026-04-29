/**
 * MapLogo — displays a configurable logo on the map.
 *
 * Full React component rendered via createRoot into the Leaflet
 * bottom-right control container.
 *
 * Same imperative API:
 *   MapLogo.init(config) — initializes with mission config
 *   MapLogo.refresh()    — updates the logo
 *   MapLogo.remove()     — unmounts
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'

import styles from './MapLogo.module.css'

function MapLogoWidget({ config }) {
    if (!config.mapLogoUrl) return null

    let logoUrl = config.mapLogoUrl

    if (!F_.isUrlAbsolute(logoUrl)) {
        if (!logoUrl.startsWith('public/') && !logoUrl.startsWith('/')) {
            logoUrl = L_.missionPath + logoUrl
        }
    }

    const sizeMap = { small: 64, medium: 128, large: 192 }
    const width = sizeMap[config.mapLogoSize] || sizeMap.medium

    const hasLink = config.mapLogoLink && config.mapLogoLink.length > 0

    const img = (
        <img
            src={logoUrl}
            alt="Map Logo"
            className={styles.img}
            style={{ width }}
        />
    )

    return (
        <div id="mmgis-map-logo" className={styles.root}>
            {hasLink ? (
                <a
                    href={config.mapLogoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                >
                    {img}
                </a>
            ) : (
                img
            )}
        </div>
    )
}

// ── Imperative service ──────────────────────────────────────────────────

let _root = null
let _container = null

const MapLogo = {
    config: null,

    init: function (config) {
        MapLogo.config = config || {}
        if (!MapLogo.config.mapLogoUrl) return

        MapLogo.remove()

        const leafletContainer = document.querySelector('.leaflet-bottom.leaflet-right')
        if (!leafletContainer) return

        _container = document.createElement('div')
        _container.id = 'mapLogoRoot'
        leafletContainer.appendChild(_container)

        _root = createRoot(_container)
        _root.render(<MapLogoWidget config={MapLogo.config} />)
    },

    refresh: function () {
        if (_root && MapLogo.config) {
            _root.render(<MapLogoWidget config={MapLogo.config} />)
        }
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

export default MapLogo
