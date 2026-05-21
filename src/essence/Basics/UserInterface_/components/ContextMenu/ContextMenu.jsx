/**
 * ContextMenu — right-click context menu on the map.
 *
 * Full React component rendered via createRoot. The menu is positioned
 * at click coordinates and renders JSX menu items with proper event handlers.
 *
 * Same imperative API:
 *   ContextMenu.init()   — binds contextmenu handlers
 *   ContextMenu.remove() — unbinds and hides
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import L_ from '../../../Layers_/Layers_'
import F_ from '../../../Formulae_/Formulae_'
import Map_ from '../../../Map_/Map_'
import Coordinates from '../Coordinates/Coordinates'

import { geojsonToWKT } from '@terraformer/wkt'

import styles from './ContextMenu.module.css'

// ── React component ─────────────────────────────────────────────────────

function ContextMenuPopup({ x, y, featuresAtClick, contextMenuActions, onClose }) {
    const menuRef = useRef(null)
    const [copiedCoords, setCopiedCoords] = useState(false)
    const [copiedKeys, setCopiedKeys] = useState({})

    // Track which action items to render
    const actionItems = []

    // Global context menu actions (no "for" filter)
    contextMenuActions.forEach((a, idx) => {
        if (a.for == null) {
            actionItems.push({ type: 'action', action: a, idx, idx2: 0, feature: null })
        }
    })

    // Per-feature items
    featuresAtClick.forEach((f, idx2) => {
        const layerName = f.options.layerName
        const displayName = L_.layers.data[layerName]?.display_name || layerName
        const pv = L_.getLayersChosenNamePropVal(f.feature, layerName)
        const key = Object.keys(pv)[0]
        const val = pv[key]

        actionItems.push({
            type: 'header',
            feature: f,
            idx2,
            geomType: f.feature.geometry.type,
            displayName,
            propKey: key,
            propVal: val,
        })

        contextMenuActions.forEach((a, idx) => {
            const forLower = a.for ? a.for.toLowerCase() : null
            if (forLower === 'polygon' && f.feature.geometry.type.toLowerCase() === forLower) {
                actionItems.push({ type: 'featureAction', action: a, idx, idx2, feature: f })
            }
        })
    })

    const handleCopyCoords = useCallback(() => {
        F_.copyToClipboard(JSON.stringify(Coordinates.getAllCoordinates(), null, 2))
        setCopiedCoords(true)
        setTimeout(() => setCopiedCoords(false), 2000)
    }, [])

    const handleCopyable = useCallback((key, copyable) => {
        F_.copyToClipboard(JSON.stringify(copyable.copyable, null, 2))
        setCopiedKeys((prev) => ({ ...prev, [key]: true }))
        setTimeout(() => {
            setCopiedKeys((prev) => ({ ...prev, [key]: false }))
        }, 2000)
    }, [])

    const handleActionClick = useCallback((action, feature) => {
        if (action.link) {
            let link = action.link
            const lnglat = Coordinates.getLngLat()
            Object.keys(Coordinates.states).forEach((s) => {
                if (link.indexOf(`{${s}[`) !== -1) {
                    const converted = Coordinates.convertLngLat(lnglat[0], lnglat[1], s, false, true)
                    link = link.replace(new RegExp(`{${s}\\[0\\]}`, 'gi'), converted[0])
                    link = link.replace(new RegExp(`{${s}\\[1\\]}`, 'gi'), converted[1])
                    link = link.replace(new RegExp(`{${s}\\[2\\]}`, 'gi'), converted[2])
                }
            })
            if (link.indexOf('{wkt}') !== -1 && feature && feature.feature) {
                const geom = F_.simplifyGeometry(feature.feature.geometry, 0.0003)
                link = link.replace(new RegExp('{wkt}', 'gi'), geojsonToWKT(geom))
            }
            if (link.indexOf('{wkt_}') !== -1 && feature && feature.feature) {
                const geom = F_.simplifyGeometry(feature.feature.geometry, 0.0003)
                link = link.replace(new RegExp('{wkt_}', 'gi'), geojsonToWKT(geom).replace(/,/g, '_'))
            }
            window.open(link, '_blank').focus()
        }
        if (action.goto === true && feature) {
            if (typeof feature.getBounds === 'function') Map_.map.fitBounds(feature.getBounds())
            else if (feature._latlng) Map_.map.panTo(feature._latlng)
        }
    }, [])

    const handleHeaderClick = useCallback((feature) => {
        if (feature) {
            if (typeof feature.getBounds === 'function') Map_.map.fitBounds(feature.getBounds())
            else if (feature._latlng) Map_.map.panTo(feature._latlng)
        }
    }, [])

    return (
        <div
            ref={menuRef}
            className={`${styles.menu} ContextMenuMap`}
            style={{ left: x, top: y, maxHeight: window.innerHeight - y }}
            onMouseLeave={onClose}
        >
            <div className={styles.cursor}>
                <div className={styles.cursorRing} />
                <div className={styles.cursorDot} />
            </div>
            <ul className={styles.list}>
                <li id="contextMenuMapCopyCoords" className={styles.item} onClick={handleCopyCoords}>
                    {copiedCoords ? 'Copied!' : 'Copy Coordinates'}
                </li>

                {Object.keys(L_._toolCopyables).map((key) => {
                    const c = L_._toolCopyables[key]
                    if (!c.title || !c.copyable) return null
                    return (
                        <li
                            key={`copyable-${key}`}
                            className={styles.item}
                            onClick={() => handleCopyable(key, c)}
                        >
                            {copiedKeys[key] ? 'Copied!' : c.title}
                        </li>
                    )
                })}

                {actionItems.map((item, i) => {
                    if (item.type === 'action') {
                        return (
                            <li
                                key={`action-${item.idx}-${item.idx2}`}
                                className={styles.item}
                                onClick={() => handleActionClick(item.action, featuresAtClick[item.idx2])}
                            >
                                {item.action.name}
                                {item.action.link != null && (
                                    <span><i className="mdi mdi-open-in-new mdi-18px" /></span>
                                )}
                            </li>
                        )
                    }
                    if (item.type === 'header') {
                        return (
                            <li
                                key={`header-${item.idx2}`}
                                className={`${styles.item} ${styles.header}`}
                                onClick={() => handleHeaderClick(item.feature)}
                            >
                                <span className={styles.headerGeom}>{item.geomType}</span>
                                <span className={styles.headerName}>{item.displayName}</span>
                                -
                                <span className={styles.headerKey}>{item.propKey}</span>
                                :
                                <span className={styles.headerVal}>{item.propVal}</span>
                            </li>
                        )
                    }
                    if (item.type === 'featureAction') {
                        return (
                            <li
                                key={`featureAction-${item.idx}-${item.idx2}`}
                                className={`${styles.item} ${styles.featureItem}`}
                                onClick={() => handleActionClick(item.action, item.feature)}
                            >
                                {item.action.name}
                                {item.action.link != null && (
                                    <span><i className="mdi mdi-open-in-new mdi-18px" /></span>
                                )}
                            </li>
                        )
                    }
                    return null
                })}
            </ul>
        </div>
    )
}

// ── Imperative service ──────────────────────────────────────────────────

let _menuRoot = null
let _menuContainer = null
let _lithoScene = null
let _lithoHandler = null

function _cleanup() {
    if (_menuRoot) {
        _menuRoot.unmount()
        _menuRoot = null
    }
    if (_menuContainer && _menuContainer.parentNode) {
        _menuContainer.parentNode.removeChild(_menuContainer)
        _menuContainer = null
    }
}

function showContextMenuMap(e) {
    const contextMenuActions = F_.getIn(
        L_,
        'configData.coordinates.variables.rightClickMenuActions',
        []
    )

    const evt = e.originalEvent || e
    e.latlng = e.latlng || Coordinates.getLatLng(true)

    const featuresAtClick = L_.getFeaturesAtPoint(e, true)
    featuresAtClick.splice(100)

    _cleanup()

    const x = evt.clientX
    const y = evt.clientY

    _menuContainer = document.createElement('div')
    _menuContainer.id = 'contextMenuRoot'
    document.body.appendChild(_menuContainer)

    _menuRoot = createRoot(_menuContainer)
    _menuRoot.render(
        <ContextMenuPopup
            x={x}
            y={y}
            featuresAtClick={featuresAtClick}
            contextMenuActions={contextMenuActions}
            onClose={() => _cleanup()}
        />
    )
}

const ContextMenu = {
    init: function () {
        this.remove()
        Map_.map.on('contextmenu', showContextMenuMap)
        _lithoScene = document.getElementById('_lithosphere_scene')
        if (_lithoScene) {
            _lithoHandler = function (nativeEvent) {
                showContextMenuMap({ originalEvent: nativeEvent, latlng: null })
            }
            _lithoScene.addEventListener('contextmenu', _lithoHandler)
        }
    },
    remove: function () {
        _cleanup()
        Map_.map.off('contextmenu', showContextMenuMap)
        if (_lithoScene && _lithoHandler) {
            _lithoScene.removeEventListener('contextmenu', _lithoHandler)
        }
        _lithoScene = null
        _lithoHandler = null
    },
}

export default ContextMenu
