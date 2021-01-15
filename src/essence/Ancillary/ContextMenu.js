import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import Coordinates from './Coordinates'

import './ContextMenu.css'

var ContextMenu = {
    init: function () {
        this.remove()
        Map_.map.on('contextmenu', showContextMenuMap)
    },
    remove: function () {
        hideContextMenuMap()
        Map_.map.off('contextmenu', showContextMenuMap)
    },
}

function showContextMenuMap(e) {
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
                    "<li id='contextMenuMapCopyCoords'>Copy Coordinates</div>",
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
