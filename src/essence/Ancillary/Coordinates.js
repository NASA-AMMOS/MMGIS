//Coordinates sets up a div that displays the cursor's lng lat
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import L_ from '../Basics/Layers_/Layers_'
import calls from '../../pre/calls'

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
                "<i class='mdi mdi-axis-arrow mdi-18px'></i>",
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
    coordENOffset: [0, 0],
    coordENMultiplier: [1, 1],
    //Boolean indicating coords are displayed relative to 0, 0 and not active point
    ZZnotAP: true,
    //Boolean indicating coords are displayed in decimal degrees not meters
    DDnotM: true,
    state: 0,
    states: [],
    damCoordLabel: 'X, Y',
    damCoordSwapped: false,
    tempIndicatorPoint: null,
    elevQueryTimes: [],
    init: function () {
        d3.select('#CoordinatesDiv').remove()
        d3.select('body')
            .append('div')
            .attr('id', 'CoordinatesDiv')
            .html(markup)

        if (L_.configData.look) {
            if (L_.configData.look.coordll) Coordinates.states.push('ll')
            if (L_.configData.look.coorden) Coordinates.states.push('en')
            if (L_.configData.look.coordrxy) Coordinates.states.push('rxy')
            if (L_.configData.look.coordsite) Coordinates.states.push('site')
            if (
                L_.configData.look.coordlngoffset != null &&
                !isNaN(L_.configData.look.coordlngoffset)
            )
                Coordinates.coordOffset[0] = parseFloat(
                    L_.configData.look.coordlngoffset || 0
                )
            if (
                L_.configData.look.coordlatoffset != null &&
                !isNaN(L_.configData.look.coordlatoffset)
            )
                Coordinates.coordOffset[1] = parseFloat(
                    L_.configData.look.coordlatoffset || 0
                )
            if (
                L_.configData.look.coordeastoffset != null &&
                !isNaN(L_.configData.look.coordeastoffset)
            )
                Coordinates.coordENOffset[0] = parseFloat(
                    L_.configData.look.coordeastoffset || 0
                )
            if (
                L_.configData.look.coordnorthoffset != null &&
                !isNaN(L_.configData.look.coordnorthoffset)
            )
                Coordinates.coordENOffset[1] = parseFloat(
                    L_.configData.look.coordnorthoffset || 0
                )
            if (
                L_.configData.look.coordeastmult != null &&
                !isNaN(L_.configData.look.coordeastmult)
            )
                Coordinates.coordENMultiplier[0] = parseFloat(
                    L_.configData.look.coordeastmult || 1
                )
            if (
                L_.configData.look.coordnorthmult != null &&
                !isNaN(L_.configData.look.coordnorthmult)
            )
                Coordinates.coordENMultiplier[1] = parseFloat(
                    L_.configData.look.coordnorthmult || 1
                )
        }
        if (Coordinates.states.length === 0) Coordinates.states = ['ll', 'en']

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
                value: Coordinates.mouseLngLat[0] + Coordinates.coordOffset[0],
                unit: 'degree',
            },
            latitude: {
                value: Coordinates.mouseLngLat[1] + Coordinates.coordOffset[1],
                unit: 'degree',
            },
            easting: {
                value:
                    Coordinates.mouseLngLat[0] *
                        (Math.PI / 180) *
                        F_.radiusOfPlanetMajor *
                        Coordinates.coordENMultiplier[0] +
                    Coordinates.coordENOffset[0],
                unit: 'meter',
            },
            northing: {
                value:
                    Coordinates.mouseLngLat[1] *
                        (Math.PI / 180) *
                        F_.radiusOfPlanetMajor *
                        Coordinates.coordENMultiplier[1] +
                    Coordinates.coordENOffset[1],
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
    refresh: function (isPartial) {
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
            switch (Coordinates.states[Coordinates.state]) {
                case 'll':
                    d3.select('#mouseDesc').html('Longitude, Latitude')
                    d3.select('#mouseLngLat').html(
                        (
                            Coordinates.mouseLngLat[0] +
                            Coordinates.coordOffset[0]
                        ).toFixed(8) +
                            '&deg, ' +
                            (
                                Coordinates.mouseLngLat[1] +
                                Coordinates.coordOffset[1]
                            ).toFixed(8) +
                            '&deg' +
                            (Coordinates.elevation != null
                                ? `, ${Coordinates.elevation.toFixed(3)}m`
                                : '')
                    )
                    break
                case 'en':
                    if (Coordinates.ZZnotAP) {
                        d3.select('#mouseDesc').html('Easting, Northing')
                    }
                    d3.select('#mouseLngLat').html(
                        (
                            Coordinates.mouseLngLat[0] *
                                (Math.PI / 180) *
                                F_.radiusOfPlanetMajor *
                                Coordinates.coordENMultiplier[0] +
                            Coordinates.coordENOffset[0]
                        ).toFixed(3) +
                            'm, ' +
                            (
                                Coordinates.mouseLngLat[1] *
                                    (Math.PI / 180) *
                                    F_.radiusOfPlanetMajor *
                                    Coordinates.coordENMultiplier[1] +
                                Coordinates.coordENOffset[1]
                            ).toFixed(3) +
                            'm' +
                            (Coordinates.elevation != null
                                ? `, ${Coordinates.elevation.toFixed(3)}m`
                                : '')
                    )
                    break
                case 'rxy':
                    let rzVal = 0
                    if (Map_.activeLayer != null) {
                        let keyAsName
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
                        if (!isPartial) {
                            Coordinates.mouseLngLat[0] -=
                                Map_.activeLayer.feature.geometry.coordinates[0]
                            Coordinates.mouseLngLat[1] -=
                                Map_.activeLayer.feature.geometry.coordinates[1]
                        }
                        rzVal =
                            Map_.activeLayer.feature.geometry.coordinates[2] ||
                            0
                    } else {
                        d3.select('#mouseDesc').html(
                            'Relative to Map Origin (X,Y)'
                        )
                    }
                    d3.select('#mouseLngLat').html(
                        (
                            Coordinates.mouseLngLat[0] *
                            (Math.PI / 180) *
                            F_.radiusOfPlanetMajor
                        ).toFixed(3) +
                            'm, ' +
                            (
                                Coordinates.mouseLngLat[1] *
                                (Math.PI / 180) *
                                F_.radiusOfPlanetMajor
                            ).toFixed(3) +
                            'm' +
                            (Coordinates.elevation != null
                                ? `, ${(Coordinates.elevation - rzVal).toFixed(
                                      3
                                  )}m`
                                : '')
                    )
                    break
                case 'site':
                    let zVal = 0
                    if (Map_.activeLayer != null) {
                        let keyAsName
                        if (Map_.activeLayer.hasOwnProperty('useKeyAsName')) {
                            keyAsName =
                                Map_.activeLayer.feature.properties[
                                    Map_.activeLayer.useKeyAsName
                                ]
                        } else {
                            keyAsName = Map_.activeLayer.feature.properties[0]
                        }
                        d3.select('#mouseDesc').html(
                            'Site Frame - ' +
                                Map_.activeLayer.options.layerName +
                                ': ' +
                                keyAsName +
                                ' (Y,X)'
                        )
                        if (!isPartial) {
                            Coordinates.mouseLngLat[0] -=
                                Map_.activeLayer.feature.geometry.coordinates[0]
                            Coordinates.mouseLngLat[1] -=
                                Map_.activeLayer.feature.geometry.coordinates[1]
                        }
                        zVal =
                            Map_.activeLayer.feature.geometry.coordinates[2] ||
                            0
                    } else {
                        d3.select('#mouseDesc').html(
                            'Site Frame - Map Origin (Y,X)'
                        )
                    }
                    d3.select('#mouseLngLat').html(
                        (
                            Coordinates.mouseLngLat[1] *
                            (Math.PI / 180) *
                            F_.radiusOfPlanetMajor
                        ).toFixed(3) +
                            'm, ' +
                            (
                                Coordinates.mouseLngLat[0] *
                                (Math.PI / 180) *
                                F_.radiusOfPlanetMajor
                            ).toFixed(3) +
                            'm' +
                            (Coordinates.elevation != null
                                ? `, ${(zVal - Coordinates.elevation).toFixed(
                                      3
                                  )}m`
                                : '')
                    )
                    break
                default:
            }
        }
    },
    getElevation: function () {
        clearTimeout(Coordinates.elevationTimeout)

        if (
            L_.configData.look == null ||
            L_.configData.look.coordelevurl == null
        )
            return

        // Let's be fancy and query more quickly the more the user queries
        let delay = 800
        if (Coordinates.elevQueryTimes.length >= 10) delay = 400
        if (Coordinates.elevQueryTimes.length >= 20) delay = 200

        Coordinates.elevationTimeout = setTimeout(() => {
            const now = new Date().getTime()
            Coordinates.elevQueryTimes.push(now)
            Coordinates.elevQueryTimes = Coordinates.elevQueryTimes.filter(
                (v) => v > now - 60000
            )

            let url = L_.configData.look.coordelevurl
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
            calls.api(
                'getbands',
                {
                    type: 'band',
                    x: Coordinates.mouseLngLatRaw[1],
                    y: Coordinates.mouseLngLatRaw[0],
                    xyorll: 'll',
                    bands: '[[1,1]]',
                    path: url,
                },
                function (data) {
                    Coordinates.elevation = null
                    //Convert python's Nones to nulls
                    data = data.replace(/none/gi, 'null')
                    if (data.length > 2) {
                        data = JSON.parse(data)
                        if (data[0] && data[0][1] != null) {
                            Coordinates.elevation = data[0][1]

                            Coordinates.refresh(true)
                        }
                    }
                },
                function () {
                    console.warn('Coordinates: Failed to query elevation.')
                    Coordinates.elevation = null
                }
            )
        }, delay)
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
    Coordinates.state = (Coordinates.state + 1) % Coordinates.states.length
    switch (Coordinates.states[Coordinates.state]) {
        case 'll':
            Coordinates.DDnotM = true
            Coordinates.ZZnotAP = true
            break
        case 'en':
            Coordinates.ZZnotAP = true
            Coordinates.DDnotM = false
            break
        case 'rxy':
            Coordinates.ZZnotAP = false
            Coordinates.DDnotM = false
            break
        case 'site':
            Coordinates.ZZnotAP = false
            Coordinates.DDnotM = false
            break
        default:
    }

    Coordinates.refresh()
}

//Update mouse lat long coordinate display on mouse move
function mouseLngLatMove(e) {
    Coordinates.mouseLngLatRaw = [e.latlng.lng, e.latlng.lat]
    Coordinates.mouseLngLat = [e.latlng.lng, e.latlng.lat]
    if (L_.configData.look && L_.configData.look.coordelev === true)
        Coordinates.getElevation()
    Coordinates.refresh()
}

function pickLngLat() {
    if ($('#pickLngLat').hasClass('active')) {
        $('.mouseLngLat').css({ display: 'flex' })
        $('.mouseLngLatPicking').removeClass('active')
        $('#pickLngLat').removeClass('active')

        Map_.rmNotNull(Coordinates.tempIndicatorPoint)
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
    let valA = parseFloat($('#mouseLngLatPickingA').val())
    let valB = parseFloat($('#mouseLngLatPickingB').val())

    let finalLng = valA
    let finalLat = valB

    switch (Coordinates.states[Coordinates.state]) {
        case 'll': //00 lnglat
            finalLng = valA - Coordinates.coordOffset[0]
            finalLat = valB - Coordinates.coordOffset[1]
            break
        case 'en': //01 easting northing
            const valALng =
                ((valA - Coordinates.coordENOffset[0]) * (180 / Math.PI)) /
                F_.radiusOfPlanetMajor
            const valBLat =
                ((valB - Coordinates.coordENOffset[1]) * (180 / Math.PI)) /
                F_.radiusOfPlanetMajor
            finalLng = valALng / Coordinates.coordENMultiplier[0]
            finalLat = valBLat / Coordinates.coordENMultiplier[1]
            break
        case 'rxy': //10 relative easting northing
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
        case 'site': //10 relative easting northing
            let siteRelativeA = 0
            let siteRelativeB = 0
            const valSwap = valA
            valA = valB
            valB = valSwap
            if (Map_.activeLayer != null) {
                siteRelativeA = Map_.activeLayer.feature.geometry.coordinates[0]
                siteRelativeB = Map_.activeLayer.feature.geometry.coordinates[1]
            }
            const valSiteALngRel =
                (valA * (180 / Math.PI)) / F_.radiusOfPlanetMajor +
                siteRelativeA
            const valSiteBLatRel =
                (valB * (180 / Math.PI)) / F_.radiusOfPlanetMajor +
                siteRelativeB

            // Swapped to account for swapped Y, X
            finalLng = valSiteALngRel
            finalLat = valSiteBLatRel
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
