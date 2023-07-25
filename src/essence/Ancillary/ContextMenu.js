import $ from 'jquery'
import * as d3 from 'd3'
import L_ from '../Basics/Layers_/Layers_'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import Coordinates from './Coordinates'

import './ContextMenu.css'

var ContextMenu = {
    init: function () {
        this.remove()
        Map_.map.on('contextmenu', showContextMenuMap)
        $('#_lithosphere_scene').on('contextmenu', showContextMenuMap)
    },
    remove: function () {
        hideContextMenuMap()
        Map_.map.off('contextmenu', showContextMenuMap)
        $('#_lithosphere_scene').off('contextmenu', showContextMenuMap)
    },
}

function showContextMenuMap(e) {
    const contextMenuActions = F_.getIn(
        L_,
        'configData.coordinates.variables.rightClickMenuActions',
        []
    )

    console.log(L_.getFeaturesAtPoint(e))

    hideContextMenuMap(true)
    var x = e.originalEvent.clientX
    var y = e.originalEvent.clientY
    // prettier-ignore
    var markup = [
        "<div class='ContextMenuMap' style='left: " + x + "px; top: " + y + "px;'>",
            "<div id='contextMenuCursor'>",
                "<div></div>",
                "<div></div>",
            "</div>",
            "<ul>",
                "<li id='contextMenuMapCopyCoords'>Copy Coordinates</li>",
                contextMenuActions.map((a, idx) => `<li id='contextMenuAction_${idx}'>${a.name}${a.link != null ? `<div><i class='mdi mdi-open-in-new mdi-18px'></i>` : ''}</li>` ).join('\n'),
            "</ul>",
        "</div>"
    ].join('\n');

    $('body').append(markup)

    $('.ContextMenuMap').on('mouseleave', function () {
        hideContextMenuMap()
    })

    $('#contextMenuMapCopyCoords').on('click', function () {
        F_.copyToClipboard(JSON.stringify(Coordinates.getAllCoordinates()))
        $('#contextMenuMapCopyCoords').text('Copied!')
        setTimeout(function () {
            $('#contextMenuMapCopyCoords').text('Copy Coordinates')
        }, 2000)
    })

    contextMenuActions.forEach((a, idx) => {
        $(`#contextMenuAction_${idx}`).on('click', function () {
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
                window.open(link, '_blank').focus()
            }
        })
    })
}

function hideContextMenuMap(immediately) {
    if (immediately) $('.ContextMenuMap').remove()
    else
        $('.ContextMenuMap').animate(
            {
                opacity: 0,
            },
            250,
            function () {
                $('.ContextMenuMap').remove()
            }
        )
}

export default ContextMenu
