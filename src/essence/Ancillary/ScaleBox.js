import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'

var ScaleBox = {
    box: null,
    popup: null,
    //Whether the scale box is docked (and thus hidden) in the scale bar
    docked: true,
    widthPx: null,
    heightPx: null,
    widthM: 2,
    heightM: 2,
    boxCenterX: null,
    boxCenterY: null,
    dragThreshold: 0,
    threshold: 3,
    mouseIsDown: false,
    init: function () {
        this.box = d3
            .select('#mapScreen')
            .append('div')
            .attr('id', 'scaleBox')
            .attr('class', 'unselectable')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('background', '#EEE')
            .style('border', '1px solid black')
            .style('cursor', 'move')
            .style('opacity', '0.7')
            .style('display', 'none')
            .style('z-index', 1010)

        this.popup = d3
            .select('#mapScreen')
            .append('div')
            .attr('id', 'scaleBoxPopup')
            .attr('class', 'unselectable')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('width', '200px')
            .style('opacity', '0.9')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('z-index', 1011)

        // prettier-ignore
        this.popup.html(
        "<div class='center aligned middle aligned ui padded grid' style='display: flex; justify-content: center;'>" +
          "<div class='ui mini right labeled input' style='display: flex; padding: 0; pointer-events: auto; height: 24px; background: var(--color-a);'>" +
            "<input id='scaleboxX' type='number' placeholder='w' size='4' style='width: 60px; height: 24px; padding: 3px;'>" +
            "<div class='ui basic label' style='padding-left: 4px; padding-right: 4px; line-height: 22px; color: var(--color-f);'>" +
              "m" +
            "</div>" +
          "</div>" +
          "<p style='font-size: 20px; padding: 0px 3px 0px 3px; margin: 0; color: white; line-height: 24px; text-shadow: -1px 1px 2px #000, 1px 1px 2px #000, 1px -1px 0 #000, -1px -1px 0 #000;'>&times;</p>" +
          "<div class='ui mini right labeled input' style='display: flex; padding: 0; pointer-events: auto; height: 24px; background: var(--color-a);'>" +
            "<input id='scaleboxY' type='number' placeholder='h' size='4' style='width: 60px; height: 24px; padding: 3px'>" +
            "<div class='ui basic label' style='padding-left: 4px; padding-right: 4px; line-height: 22px; color: var(--color-f);'>" +
              "m" +
            "</div>" +
          "</div>" +
        "</div>"
      );

        function changeWidth() {
            ScaleBox.widthM = $('#scaleboxX').val()
            ScaleBox.update()
        }
        function changeHeight() {
            ScaleBox.heightM = $('#scaleboxY').val()
            ScaleBox.update()
        }
        $('#scaleboxX').on('change', changeWidth)
        $('#scaleboxY').on('change', changeHeight)

        document
            .getElementById('scaleBarBounds')
            .addEventListener('mousedown', scaleBarMouseDown)
        document
            .getElementById('scaleBox')
            .addEventListener('mousedown', scaleBoxMouseDown)
        document
            .getElementById('mapScreen')
            .addEventListener('mouseup', scaleBoxMouseUp)
        document
            .getElementById('mapScreen')
            .addEventListener('mouseleave', scaleBoxMouseUp)

        //Update width and height on zoom
        Map_.map.on('zoomend', ScaleBox.update)
        Map_.map.on('move', ScaleBox.update)

        function scaleBarMouseDown(e) {
            document
                .getElementById('mapScreen')
                .addEventListener('mousemove', scaleBoxDrag)
            e.preventDefault()
            ScaleBox.widthM = parseInt(50 * getMetersPerPixelLon())
            ScaleBox.heightM = parseInt(50 * getMetersPerPixelLat())
            $('#scaleboxX').val(ScaleBox.widthM)
            $('#scaleboxY').val(ScaleBox.heightM)
            ScaleBox.boxCenterX = e.pageX
            ScaleBox.boxCenterY = e.pageY
            ScaleBox.update()
            ScaleBox.dragThreshold = 0
            ScaleBox.mouseIsDown = true
        }
        function scaleBoxMouseDown() {
            document
                .getElementById('mapScreen')
                .addEventListener('mousemove', scaleBoxDrag)
            ScaleBox.dragThreshold = 0
            ScaleBox.mouseIsDown = true
        }
        function scaleBoxMouseUp(e) {
            if (ScaleBox.mouseIsDown) {
                var bounding = document
                    .getElementById('scaleBarBounds')
                    .getBoundingClientRect()
                if (
                    ScaleBox.boxCenterX > bounding.left &&
                    ScaleBox.boxCenterX < bounding.right &&
                    ScaleBox.boxCenterY > bounding.top &&
                    ScaleBox.boxCenterY < bounding.bottom
                ) {
                    ScaleBox.docked = true
                }
                if (ScaleBox.dragThreshold < ScaleBox.threshold) {
                    if (ScaleBox.popup.style('display') == 'none') {
                        ScaleBox.popup.style('display', 'inherit')
                    } else {
                        ScaleBox.popup.style('display', 'none')
                    }
                }
                ScaleBox.update()
                ScaleBox.mouseIsDown = false
                document
                    .getElementById('mapScreen')
                    .removeEventListener('mousemove', scaleBoxDrag)
            }
        }
        function scaleBoxDrag(e) {
            e.preventDefault()
            if (ScaleBox.dragThreshold > ScaleBox.threshold) {
                ScaleBox.boxCenterX = e.pageX
                ScaleBox.boxCenterY = e.pageY

                if (ScaleBox.docked) {
                    ScaleBox.popup.style('display', 'inherit')
                    ScaleBox.docked = false
                }
                ScaleBox.update()
            }
            if (ScaleBox.mouseIsDown) {
                ScaleBox.dragThreshold++
            }
        }
    },
    update: function () {
        if (!ScaleBox.docked) {
            var offset = $('#mapScreen').offset()
            var containerPt = [
                ScaleBox.boxCenterX - offset.left,
                ScaleBox.boxCenterY - offset.top,
            ]
            ScaleBox.widthPx =
                ScaleBox.widthM / getMetersPerPixelLon(containerPt)
            ScaleBox.heightPx =
                ScaleBox.heightM / getMetersPerPixelLat(containerPt)

            ScaleBox.box
                .style('width', ScaleBox.widthPx + 'px')
                .style('height', ScaleBox.heightPx + 'px')
                .style(
                    'top',
                    ScaleBox.boxCenterY -
                        ScaleBox.heightPx / 2 -
                        offset.top +
                        'px'
                )
                .style(
                    'left',
                    ScaleBox.boxCenterX -
                        ScaleBox.widthPx / 2 -
                        offset.left +
                        'px'
                )

            var popupTop =
                ScaleBox.boxCenterY -
                30 -
                ScaleBox.heightPx / 2 -
                5 -
                offset.top
            if (popupTop < 0) popupTop = 0
            ScaleBox.popup
                .style('top', popupTop + 'px')
                .style(
                    'left',
                    ScaleBox.boxCenterX - 200 / 2 - offset.left + 'px'
                )

            ScaleBox.box.style('display', 'inherit')
        } else {
            ScaleBox.box.style('display', 'none')
            ScaleBox.popup.style('display', 'none')
        }
    },
}

function getMetersPerPixelLon(pt) {
    var centerLatLng
    if (pt == null) centerLatLng = Map_.map.getCenter()
    // get map center
    else centerLatLng = Map_.map.containerPointToLatLng(pt)

    var pointC = Map_.map.latLngToContainerPoint(centerLatLng) // convert to containerpoint (pixels)
    var pointX = [pointC.x + 1, pointC.y] // add one pixel to x

    // convert containerpoints to latlng's
    var latLngC = Map_.map.containerPointToLatLng(pointC)
    var latLngX = Map_.map.containerPointToLatLng(pointX)

    return F_.lngLatDistBetween(
        latLngC['lng'],
        latLngC['lat'],
        latLngX['lng'],
        latLngX['lat']
    )
}
function getMetersPerPixelLat(pt) {
    var centerLatLng
    if (pt == null) centerLatLng = Map_.map.getCenter()
    // get map center
    else centerLatLng = Map_.map.containerPointToLatLng(pt)

    var pointC = Map_.map.latLngToContainerPoint(centerLatLng) // convert to containerpoint (pixels)
    var pointY = [pointC.x, pointC.y + 1] // add one pixel to y

    // convert containerpoints to latlng's
    var latLngC = Map_.map.containerPointToLatLng(pointC)
    var latLngY = Map_.map.containerPointToLatLng(pointY)

    return F_.lngLatDistBetween(
        latLngC['lng'],
        latLngC['lat'],
        latLngY['lng'],
        latLngY['lat']
    )
}

export default ScaleBox
