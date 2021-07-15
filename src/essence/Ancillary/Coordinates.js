//Coordinates sets up a div that displays the cursor's lng lat
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'

import './Coordinates.css'

// prettier-ignore
const markup = [
        "<div class='mouseLngLat'>",
            "<div id='mouseDesc'></div>",
            "<div id='mouseLngLat'></div>",
        "</div>",
        "<div class='mouseLngLatPicking'>",
            "<div id='mouseDescPicking'></div>",
            "<div id='mouseLngLatPicking'></div>",
            "<div id='mouseGoPicking' title='Go to coordinate.'>",
                "<i class='mdi mdi-arrow-right-thick mdi-18px'></i>",
            "</div>",
        "</div>",
        "<div id='buttonsLngLat' style='display: flex;'>",
            "<div id='pickLngLat' title='Pick coordinates.'>",
                "<i class='mdi mdi-target mdi-18px'></i>",
            "</div>",
            "<div id='changeLngLat' title='Change coordinate types.'>",
                "<i class='mdi mdi-cached mdi-18px'></i>",
            "</div>",
        "</div>",
        "<div id='toggleTimeUI'>",
            "<i class='mdi mdi-clock mdi-18px'></i>",
        "</div>"
    ].join('\n');

var Coordinates = {
    //[ lng, lat ]
    mouseLngLat: [0, 0],
    coordOffset: [0, 0],
    //Boolean indicating coords are displayed relative to 0, 0 and not active point
    ZZnotAP: true,
    //Boolean indicating coords are displayed in decimal degrees not meters
    DDnotM: true,
    //00 is ZZnotAP: true and DDnotM: true, 01 is true and false ...
    state: 0,
    damCoordLabel: 'X, Y',
    damCoordSwapped: false,
    tempIndicatorPoint: null,
    init: function () {
        d3.select('#CoordinatesDiv').remove()
        d3.select('body')
            .append('div')
            .attr('id', 'CoordinatesDiv')
            .html(markup)

        //true for decimal deg, false for meters
        Coordinates.DDnotM = true

        $('#changeLngLat').on('click', mouseLngLatClick)
        $('#pickLngLat').on('click', pickLngLat)
        $('#mouseGoPicking').on('click', pickLngLatGo)
        $('#toggleTimeUI').on('click', toggleTimeUI)
        Map_.map.on('mousemove', mouseLngLatMove)
        Map_.map.on('click', urlClick)
    },
    clear: function () {},
    getLngLat: function () {
        return Coordinates.mouseLngLat
    },
    getLatLng: function () {
        return [Coordinates.mouseLngLat[1], Coordinates.mouseLngLat[0]]
    },
    getAllCoordinates: function () {
        return {
            longitude: {
                value: Coordinates.mouseLngLat[0],
                unit: 'degree',
            },
            latitude: {
                value: Coordinates.mouseLngLat[1],
                unit: 'degree',
            },
            easting: {
                value:
                    (Coordinates.mouseLngLat[0] + Coordinates.coordOffset[0]) *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor,
                unit: 'meter',
            },
            northing: {
                value:
                    (Coordinates.mouseLngLat[1] + Coordinates.coordOffset[0]) *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor,
                unit: 'meter',
            },
        }
    },
    //rawLngLat is same type as mouseLngLat and coordsString is whatever
    setCoords: function (rawLngLat, coordsString) {
        Coordinates.mouseLngLat = rawLngLat
        d3.select('#mouseLngLat').html(coordsString)
    },
    setDamCoordLabel: function (label) {
        this.damCoordLabel = label
        this.refresh()
    },
    setDamCoordSwap: function (isSwapped) {
        this.damCoordSwapped = isSwapped
        this.refresh()
    },
    refresh: function () {
        if (F_.dam) {
            d3.select('#mouseDesc').html(Coordinates.damCoordLabel)
            if (!Coordinates.damCoordSwapped) {
                d3.select('#mouseLngLat').html(
                    (
                        Coordinates.mouseLngLat[0] + Coordinates.coordOffset[0]
                    ).toFixed(4) +
                        'm, ' +
                        (
                            Coordinates.mouseLngLat[1] +
                            Coordinates.coordOffset[1]
                        ).toFixed(4) +
                        'm'
                )
            } else {
                d3.select('#mouseLngLat').html(
                    (
                        Coordinates.mouseLngLat[1] + Coordinates.coordOffset[1]
                    ).toFixed(4) +
                        'm, ' +
                        (
                            Coordinates.mouseLngLat[0] +
                            Coordinates.coordOffset[0]
                        ).toFixed(4) +
                        'm'
                )
            }
        } else {
            if (!Coordinates.ZZnotAP) {
                if (Map_.activeLayer != null) {
                    var keyAsName
                    if (Map_.activeLayer.hasOwnProperty('useKeyAsName')) {
                        keyAsName =
                            Map_.activeLayer.feature.properties[
                                Map_.activeLayer.useKeyAsName
                            ]
                    } else {
                        keyAsName = Map_.activeLayer.feature.properties[0]
                    }
                    d3.select('#mouseDesc').html(
                        'Relative to ' +
                            Map_.activeLayer.options.layerName +
                            ': ' +
                            keyAsName +
                            ' (X,Y)'
                    )
                    Coordinates.mouseLngLat[0] -=
                        Map_.activeLayer.feature.geometry.coordinates[0]
                    Coordinates.mouseLngLat[1] -=
                        Map_.activeLayer.feature.geometry.coordinates[1]
                } else {
                    d3.select('#mouseDesc').html('Relative to Map Origin (X,Y)')
                }
            }
            if (Coordinates.DDnotM) {
                d3.select('#mouseDesc').html('Longitude, Latitude')
                d3.select('#mouseLngLat').html(
                    (
                        Coordinates.mouseLngLat[0] + Coordinates.coordOffset[0]
                    ).toFixed(8) +
                        '&deg, ' +
                        (
                            Coordinates.mouseLngLat[1] +
                            Coordinates.coordOffset[1]
                        ).toFixed(8) +
                        '&deg'
                )
            } else {
                if (Coordinates.ZZnotAP) {
                    d3.select('#mouseDesc').html('Easting, Northing')
                }
                d3.select('#mouseLngLat').html(
                    (
                        (Coordinates.mouseLngLat[0] +
                            Coordinates.coordOffset[0]) *
                        (Math.PI / 180) *
                        F_.radiusOfPlanetMajor
                    ).toFixed(3) +
                        'm, ' +
                        (
                            (Coordinates.mouseLngLat[1] +
                                Coordinates.coordOffset[0]) *
                            (Math.PI / 180) *
                            F_.radiusOfPlanetMajor
                        ).toFixed(3) +
                        'm'
                )
            }
        }
    },
    remove: function () {
        //Clear all the stuffes
        $('#changeLngLat').off('click', mouseLngLatClick)
        $('#pickLngLat').off('click', pickLngLat)
        $('#mouseGoPicking').off('click', pickLngLatGo)
        $('#toggleTimeUI').off('click', toggleTimeUI)
        Map_.map.off('mousemove', mouseLngLatMove)
        Map_.map.off('click', urlClick)
    },
}

//Upon clicking the lnglat bar, swap decimal degrees and meters and recalculate
function mouseLngLatClick() {
    Coordinates.state = (Coordinates.state + 1) % 3
    switch (Coordinates.state) {
        case 0: //00
            Coordinates.DDnotM = true
            Coordinates.ZZnotAP = true
            break
        case 1: //01
            Coordinates.ZZnotAP = true
            Coordinates.DDnotM = false
            break
        case 2: //10
            Coordinates.ZZnotAP = false
            Coordinates.DDnotM = false
            break
        default:
    }

    Coordinates.refresh()
}

//Update mouse lat long coordinate display on mouse move
function mouseLngLatMove(e) {
    Coordinates.mouseLngLat = [e.latlng.lng, e.latlng.lat]
    Coordinates.refresh()
}

function pickLngLat() {
    if ($('#pickLngLat').hasClass('active')) {
        $('.mouseLngLat').css({ display: 'flex' })
        $('.mouseLngLatPicking').removeClass('active')
        $('#pickLngLat').removeClass('active')
    } else {
        $('.mouseLngLat').css({ display: 'none' })
        $('.mouseLngLatPicking').addClass('active')
        $('#pickLngLat').addClass('active')

        const currentDesc = $('#mouseDesc').html()
        $('#mouseDescPicking').html(currentDesc)

        const currentDescSplit = currentDesc.replace(/ /g, '').split(',')

        const currentText = $('#mouseLngLat').html() || '0,0'
        const currentTextSplit = currentText.replace(/ /g, '').split(',')

        const unit = Coordinates.DDnotM ? '°' : 'm'
        // prettier-ignore
        const markup = [
            `<input id='mouseLngLatPickingA' placeholder="${currentDescSplit[0]}" type="number" value="${parseFloat(currentTextSplit[0]).toFixed(4)}"/>`,
            `<div>${unit}</div>`,
            `<input id='mouseLngLatPickingB' placeholder="${currentDescSplit[1]}" type="number" value="${parseFloat(currentTextSplit[1]).toFixed(4)}"/>`,
            `<div>${unit}</div>`
        ].join('\n')

        $('#mouseLngLatPicking').html(markup)
        $('#mouseLngLatPickingA').focus()
    }
}

function pickLngLatGo() {
    const valA = parseFloat($('#mouseLngLatPickingA').val())
    const valB = parseFloat($('#mouseLngLatPickingB').val())

    let finalLng = valA
    let finalLat = valB

    switch (Coordinates.state) {
        case 0: //00 lnglat
            finalLng = valA
            finalLat = valB
            break
        case 1: //01 easting northing
            const valALng = (valA * (180 / Math.PI)) / F_.radiusOfPlanetMajor
            const valBLat = (valB * (180 / Math.PI)) / F_.radiusOfPlanetMajor
            finalLng = valALng
            finalLat = valBLat
            break
        case 2: //10 relative easting northing
            let relativeA = 0
            let relativeB = 0
            if (Map_.activeLayer != null) {
                relativeA = Map_.activeLayer.feature.geometry.coordinates[0]
                relativeB = Map_.activeLayer.feature.geometry.coordinates[1]
            }
            const valALngRel =
                (valA * (180 / Math.PI)) / F_.radiusOfPlanetMajor + relativeA
            const valBLatRel =
                (valB * (180 / Math.PI)) / F_.radiusOfPlanetMajor + relativeB

            finalLng = valALngRel
            finalLat = valBLatRel
            break
        default:
    }

    Map_.map.setView([finalLat, finalLng], Map_.map.getZoom())

    Map_.rmNotNull(Coordinates.tempIndicatorPoint)
    Coordinates.tempIndicatorPoint = new L.circleMarker([finalLat, finalLng], {
        fillColor: '#000',
        fillOpacity: 0,
        color: 'lime',
        weight: 2,
    })
        .setRadius(4)
        .addTo(Map_.map)

    clearTimeout(Coordinates.tempIndicatorPointTimeout)
    Coordinates.tempIndicatorPointTimeout = setTimeout(() => {
        Map_.rmNotNull(Coordinates.tempIndicatorPoint)
    }, 2300)
}

function urlClick(e) {
    //QueryURL.writeCoordinateURL( e.latlng.lng, e.latlng.lat, Map_.map.getZoom() );
}

function toggleTimeUI() {
    const active = $(this).hasClass('active')
    $(this).toggleClass('active')
    const newBottom = active ? 0 : 40
    const timeBottom = active ? -40 : 0

    $('#CoordinatesDiv').css({ bottom: newBottom + 'px' })
    $('#mapToolBar').css({ bottom: newBottom + 'px' })
    $('.leaflet-bottom.leaflet-left').css({ bottom: newBottom + 'px' })
    $('#photosphereAzIndicator').css({
        bottom: newBottom + 'px',
        transition: 'bottom 0.2s ease-in',
    })
    $('#_lithosphere_controls_bottomleft').css({
        bottom: newBottom + 10 + 'px',
        transition: 'bottom 0.2s ease-in',
    })
    $('#timeUI').css({ bottom: timeBottom + 'px' })
}

export default Coordinates
