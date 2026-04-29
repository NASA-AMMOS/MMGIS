/**
 * ContextMenu — right-click context menu on the map.
 *
 * Migrated from jQuery to native DOM. Same imperative API:
 *   ContextMenu.init()   — binds contextmenu handlers
 *   ContextMenu.remove() — unbinds and hides
 */
import L_ from '../Basics/Layers_/Layers_'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import Coordinates from './Coordinates'

import { geojsonToWKT } from '@terraformer/wkt'

import './ContextMenu.css'

var ContextMenu = {
    init: function () {
        this.remove()
        Map_.map.on('contextmenu', showContextMenuMap)
        const lithoScene = document.getElementById('_lithosphere_scene')
        if (lithoScene) lithoScene.addEventListener('contextmenu', showContextMenuMap)
    },
    remove: function () {
        hideContextMenuMap()
        Map_.map.off('contextmenu', showContextMenuMap)
        const lithoScene = document.getElementById('_lithosphere_scene')
        if (lithoScene) lithoScene.removeEventListener('contextmenu', showContextMenuMap)
    },
}

function showContextMenuMap(e) {
    const contextMenuActions = F_.getIn(
        L_,
        'configData.coordinates.variables.rightClickMenuActions',
        []
    )
    const contextMenuActionsFull = []
    e.latlng = e.latlng || Coordinates.getLatLng(true)

    const featuresAtClick = L_.getFeaturesAtPoint(e, true)
    featuresAtClick.splice(100)

    hideContextMenuMap(true)
    var x = e.originalEvent.clientX
    var y = e.originalEvent.clientY

    // prettier-ignore
    var markup = [
        `<div class='ContextMenuMap' style='left: ${x}px; top: ${y}px; max-height: ${window.innerHeight - y}px;'>`,
            "<div id='contextMenuCursor'>",
                "<div></div>",
                "<div></div>",
            "</div>",
            "<ul>",
                "<li id='contextMenuMapCopyCoords'>Copy Coordinates</li>",
                Object.keys(L_._toolCopyables).map((key, idx) => {
                    const c = L_._toolCopyables[key]
                    const items = []
                    if( c.title && c.copyable)
                    items.push(`<li id='contextMenuCopyable' data-key='${key}'>${c.title}</li>`)
                    return items.join('\n')
                }).join('\n'),
                contextMenuActions.map((a, idx) => {
                    const items = []
                    if(a.for == null) {
                            items.push(`<li id='contextMenuAction_${idx}_0'>${a.name}${a.link != null ? `<div><i class='mdi mdi-open-in-new mdi-18px'></i>` : ''}</li>`)
                            contextMenuActionsFull.push({contextMenuAction: a, idx: idx, idx2: 0})
                    }
                    return items.join('\n')
                } ).join('\n'),
                featuresAtClick.map((f, idx2) => {
                    const items = []
                    const layerName = f.options.layerName
                    const displayName = L_.layers.data[layerName]?.display_name || layerName
                    const pv = L_.getLayersChosenNamePropVal(f.feature, layerName)
                    const key = Object.keys(pv)[0]
                    const val = pv[key]
                    items.push(`<li class='contextMenuHeader' id='contextMenuAction_${'head'}_${idx2}'><span>${f.feature.geometry.type}</span><span>${displayName}</span>-<span>${key}</span>:<span>${val}</span></li>`)
                    contextMenuActionsFull.push({contextMenuAction: { goto: true }, idx: 'head', idx2: idx2, feature: f})
                    contextMenuActions.map((a, idx) => {
                        const forLower = a.for ? a.for.toLowerCase() : null
                        switch(forLower) {
                            case "polygon":
                                    if( f.feature.geometry.type.toLowerCase() === forLower) {
                                        items.push(`<li class='contextMenuFeatureItem' id='contextMenuAction_${idx}_${idx2}'>${a.name}${a.link != null ? `<div><i class='mdi mdi-open-in-new mdi-18px'></i>` : ''}</li>`)
                                        contextMenuActionsFull.push({contextMenuAction: a, idx: idx, idx2: idx2, feature: f})
                                    }
                                break;
                            default:
                        }
                    } )
                    return items.join('\n')
                }).join('\n'),
            "</ul>",
        "</div>"
    ].join('\n');

    // Insert into DOM
    const wrapper = document.createElement('div')
    wrapper.innerHTML = markup
    const menuEl = wrapper.firstElementChild
    document.body.appendChild(menuEl)

    menuEl.addEventListener('mouseleave', function () {
        hideContextMenuMap()
    })

    const copyCoords = document.getElementById('contextMenuMapCopyCoords')
    if (copyCoords) {
        copyCoords.addEventListener('click', function () {
            F_.copyToClipboard(
                JSON.stringify(Coordinates.getAllCoordinates(), null, 2)
            )
            copyCoords.textContent = 'Copied!'
            setTimeout(function () {
                copyCoords.textContent = 'Copy Coordinates'
            }, 2000)
        })
    }

    document.querySelectorAll('#contextMenuCopyable').forEach(function (el) {
        el.addEventListener('click', function () {
            const key = el.getAttribute('data-key')
            const copyable = L_._toolCopyables[key]
            F_.copyToClipboard(JSON.stringify(copyable.copyable, null, 2))
            el.textContent = 'Copied!'
            setTimeout(function () {
                el.textContent = copyable.title
            }, 2000)
        })
    })

    contextMenuActionsFull.forEach((c) => {
        const actionEl = document.getElementById(`contextMenuAction_${c.idx}_${c.idx2}`)
        if (!actionEl) return

        actionEl.addEventListener('click', function () {
            const a = c.contextMenuAction
            const l = featuresAtClick[c.idx2]
            if (a.link) {
                let link = a.link

                const lnglat = Coordinates.getLngLat()
                Object.keys(Coordinates.states).forEach((s) => {
                    if (link.indexOf(`{${s}[`) !== -1) {
                        const converted = Coordinates.convertLngLat(
                            lnglat[0],
                            lnglat[1],
                            s,
                            false,
                            true
                        )
                        link = link.replace(
                            new RegExp(`{${s}\\[0\\]}`, 'gi'),
                            converted[0]
                        )
                        link = link.replace(
                            new RegExp(`{${s}\\[1\\]}`, 'gi'),
                            converted[1]
                        )
                        link = link.replace(
                            new RegExp(`{${s}\\[2\\]}`, 'gi'),
                            converted[2]
                        )
                    }
                })

                let wkt
                if (link.indexOf(`{wkt}`) !== -1) {
                    const geom = F_.simplifyGeometry(l.feature.geometry, 0.0003)
                    wkt = geojsonToWKT(geom)
                    link = link.replace(new RegExp(`{wkt}`, 'gi'), wkt)
                }
                if (link.indexOf(`{wkt_}`) !== -1) {
                    const geom = F_.simplifyGeometry(l.feature.geometry, 0.0003)
                    wkt = geojsonToWKT(geom)
                    link = link.replace(
                        new RegExp(`{wkt_}`, 'gi'),
                        wkt.replace(/,/g, '_')
                    )
                }
                window.open(link, '_blank').focus()
            }
            if (a.goto === true) {
                if (l) {
                    if (typeof l.getBounds === 'function')
                        Map_.map.fitBounds(l.getBounds())
                    else if (l._latlng) Map_.map.panTo(l._latlng)
                }
            }
        })
    })
}

function hideContextMenuMap(immediately) {
    const menus = document.querySelectorAll('.ContextMenuMap')
    menus.forEach((menu) => {
        if (immediately) {
            menu.remove()
        } else {
            menu.style.transition = 'opacity 0.25s ease'
            menu.style.opacity = '0'
            setTimeout(() => menu.remove(), 250)
        }
    })
}

export default ContextMenu
