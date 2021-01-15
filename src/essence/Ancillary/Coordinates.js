//Coordinates sets up a div that displays the cursor's lng lat
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import QueryURL from './QueryURL'

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
    init: function () {
        d3.select('.mouseLngLat').remove()
        var mll = d3
            .select('body')
            .append('div')
            .attr('class', 'mouseLngLat')
            //.style( 'background', '#001' )
            .style('position', 'absolute')
            .style('bottom', '0px')
            .style('right', '0px')
            .style('padding', '9px 8px 7px 8px')
            .style('margin', '0')
            .style('cursor', 'pointer')
            .style('z-index', '20')
        mll.append('p')
            .attr('id', 'mouseDesc')
            .style('font-size', '14px')
            .style('margin-bottom', '0')
            .style('margin-right', '6px')
            .style('color', 'white')
            .style('line-height', '24px')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
        mll.append('p')
            .attr('id', 'mouseLngLat')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .style('margin-bottom', '2px')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )

        //true for decimal deg, false for meters
        Coordinates.DDnotM = true

        d3.select('.mouseLngLat').on('click', mouseLngLatClick)
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
        Map_.map.off('mousemove', mouseLngLatMove)

        Map_.map.off('click', urlClick)

        d3.select('.mouseLngLat').on('click', null)
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
    }

    Coordinates.refresh()
}

//Update mouse lat long coordinate display on mouse move
function mouseLngLatMove(e) {
    Coordinates.mouseLngLat = [e.latlng.lng, e.latlng.lat]
    Coordinates.refresh()
}

function urlClick(e) {
    //QueryURL.writeCoordinateURL( e.latlng.lng, e.latlng.lat, Map_.map.getZoom() );
}

export default Coordinates
