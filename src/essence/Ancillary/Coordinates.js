//Coordinates sets up a div that displays the cursor's lng lat
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import L_ from '../Basics/Layers_/Layers_'
import Dropy from '../../external/Dropy/dropy'
import UserInterface from '../Basics/UserInterface_/UserInterface_'
import calls from '../../pre/calls'

import tippy from 'tippy.js'

import './Coordinates.css'

// prettier-ignore
const markup = [
    "<div class='mouseLngLat'>",
        "<div id='mouseDesc' style='display: none;'></div>",
        "<div id='changeCoordType'>",
            "<div id='changeCoordTypeDropdown' class='ui dropdown short'></div>",
        "</div>",
        "<div id='mouseLngLat'></div>",
        "<div id='mouseElev'></div>",
    "</div>",
    "<div class='mouseLngLatPicking'>",
        "<div id='mouseDescPicking'></div>",
        "<div id='mouseLngLatPicking'></div>",
        "<div id='mouseGoPicking' title='Go to coordinate.'>",
            "<i class='mdi mdi-arrow-right-thick mdi-18px'></i>",
        "</div>",
    "</div>",
    "<div id='buttonsLngLat' style='display: flex;'>",
        "<div id='pickLngLat'>",
            "<i class='mdi mdi-target mdi-18px'></i>",
        "</div>",
    "</div>",
    "<div id='toggleTimeUI'>",
        "<i class='mdi mdi-clock mdi-18px'></i>",
    "</div>"
].join('\n');

const Coordinates = {
    //[ lng, lat ]
    mouseLngLat: [0, 0],
    state: 0,
    //states: [],
    tempIndicatorPoint: null,
    elevQueryTimes: [],
    //
    currentCoords: [],
    currentType: 'll',
    mainType: 'll',
    stateIndices: [], // Will be like ['ll', 'cproj', 'rxy']
    states: {
        ll: {
            ancillaryTitle: 'lon/lat',
            names: ['Longitude', 'Latitude', 'Elevation'],
            units: ['°', '°', 'm'],
            precision: [8, 8, 3],
            available: true,
            coordOffset: [0, 0],
        },
        en: {
            ancillaryTitle: 'east/north',
            names: ['Easting', 'Northing', 'Elevation'],
            units: ['m', 'm', 'm'],
            precision: [3, 3, 3],
            available: false,
            coordENOffset: [0, 0],
            coordENMultiplier: [1, 1],
        },
        cproj: {
            title: 'Projected',
            names: ['Easting', 'Northing', 'Elevation'],
            units: ['m', 'm', 'm'],
            precision: [3, 3, 3],
            available: false,
        },
        sproj: {
            title: 'Secondary Projected',
            names: ['Easting', 'Northing', 'Elevation'],
            units: ['m', 'm', 'm'],
            precision: [3, 3, 3],
            available: false,
            proj: null,
        },
        rxy: {
            title: 'Relative',
            names: ['X', 'Y', 'Z'],
            units: ['m', 'm', 'm'],
            precision: [3, 3, 3],
            available: false,
            coordENMultiplier: [1, 1],
        },
        site: {
            title: 'Local Level',
            names: ['Y', 'X', '-Z'],
            units: ['m', 'm', 'm'],
            precision: [3, 3, 3],
            available: false,
            coordENMultiplier: [1, 1],
        },
    },
    init: function () {
        d3.select('#CoordinatesDiv').remove()
        d3.select('body')
            .append('div')
            .attr('id', 'CoordinatesDiv')
            .html(markup)

        tippy('#pickLngLat', {
            content: 'Pick Coordinates',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#toggleTimeUI', {
            content: 'Time',
            placement: 'top',
            theme: 'blue',
            offset: [0, 20],
        })

        if (
            !(
                L_.configData.time &&
                L_.configData.time.enabled === true &&
                (
                    L_.configData.time.visible === true ||
                    L_.configData.time.liveByDefault === true ||
                    L_.FUTURES.live === true
                )
            )
        ) {
            $('#toggleTimeUI').css({ display: 'none' })
            $('#CoordinatesDiv').css({ marginRight: '0px' })
        }
        if (L_.configData.coordinates) {
            // ll
            if (L_.configData.coordinates.coordll == false)
                Coordinates.states.ll.available = false
            if (
                L_.configData.coordinates.coordlngoffset != null &&
                !isNaN(L_.configData.coordinates.coordlngoffset)
            )
                Coordinates.states.ll.coordOffset[0] = parseFloat(
                    L_.configData.coordinates.coordlngoffset || 0
                )
            if (
                L_.configData.coordinates.coordlatoffset != null &&
                !isNaN(L_.configData.coordinates.coordlatoffset)
            )
                Coordinates.states.ll.coordOffset[1] = parseFloat(
                    L_.configData.coordinates.coordlatoffset || 0
                )

            // en
            if (L_.configData.coordinates.coorden)
                Coordinates.states.en.available = true
            if (
                L_.configData.coordinates.coordeastoffset != null &&
                !isNaN(L_.configData.coordinates.coordeastoffset)
            )
                Coordinates.states.en.coordENOffset[0] = parseFloat(
                    L_.configData.coordinates.coordeastoffset || 0
                )
            if (
                L_.configData.coordinates.coordnorthoffset != null &&
                !isNaN(L_.configData.coordinates.coordnorthoffset)
            )
                Coordinates.states.en.coordENOffset[1] = parseFloat(
                    L_.configData.coordinates.coordnorthoffset || 0
                )
            if (
                L_.configData.coordinates.coordeastmult != null &&
                !isNaN(L_.configData.coordinates.coordeastmult)
            ) {
                Coordinates.states.en.coordENMultiplier[0] = parseFloat(
                    L_.configData.coordinates.coordeastmult || 1
                )
                Coordinates.states.rxy.coordENMultiplier[0] =
                    Coordinates.states.en.coordENMultiplier[0]
                Coordinates.states.site.coordENMultiplier[0] =
                    Coordinates.states.en.coordENMultiplier[0]
            }
            if (
                L_.configData.coordinates.coordnorthmult != null &&
                !isNaN(L_.configData.coordinates.coordnorthmult)
            ) {
                Coordinates.states.en.coordENMultiplier[1] = parseFloat(
                    L_.configData.coordinates.coordnorthmult || 1
                )
                Coordinates.states.rxy.coordENMultiplier[1] =
                    Coordinates.states.en.coordENMultiplier[1]
                Coordinates.states.site.coordENMultiplier[1] =
                    Coordinates.states.en.coordENMultiplier[1]
            }

            // cproj
            if (L_.configData.coordinates.coordcustomproj) {
                if (
                    L_.configData.projection &&
                    L_.configData.projection.custom === true
                )
                    Coordinates.states.cproj.available = true
                else
                    console.warn(
                        'WARNING - Enabled Custom Projection coordinates but no Custom Projection configured.'
                    )
                Coordinates.states.cproj.title =
                    L_.configData.coordinates.coordcustomprojname ||
                    Coordinates.states.cproj.title
                Coordinates.states.cproj.names[0] =
                    L_.configData.coordinates.coordcustomprojnamex ||
                    Coordinates.states.cproj.names[0]
                Coordinates.states.cproj.names[1] =
                    L_.configData.coordinates.coordcustomprojnamey ||
                    Coordinates.states.cproj.names[1]
                Coordinates.states.cproj.names[2] =
                    L_.configData.coordinates.coordcustomprojnamez ||
                    Coordinates.states.cproj.names[2]
            }

            // sproj
            if (L_.configData.coordinates.coordsecondaryproj) {
                Coordinates.states.sproj.available = true
                Coordinates.states.sproj.title =
                    L_.configData.coordinates.coordsecondaryprojname ||
                    Coordinates.states.sproj.title
                Coordinates.states.sproj.proj =
                    L_.configData.coordinates.coordsecondaryprojstr
                Coordinates.states.sproj.names[0] =
                    L_.configData.coordinates.coordsecondaryprojnamex ||
                    Coordinates.states.sproj.names[0]
                Coordinates.states.sproj.names[1] =
                    L_.configData.coordinates.coordsecondaryprojnamey ||
                    Coordinates.states.sproj.names[1]
                Coordinates.states.sproj.names[2] =
                    L_.configData.coordinates.coordsecondaryprojnamez ||
                    Coordinates.states.sproj.names[2]
            }

            // rxy
            if (L_.configData.coordinates.coordrxy)
                Coordinates.states.rxy.available = true

            // site
            if (L_.configData.coordinates.coordsite)
                Coordinates.states.site.available = true
        }
        // Remove all unavailable state
        Object.keys(Coordinates.states).forEach((s) => {
            if (!Coordinates.states[s].available) delete Coordinates.states[s]
            else delete Coordinates.states[s].available
        })
        Coordinates.stateIndices = Object.keys(Coordinates.states)

        // Set main type and, if invalid main type, default back to ll
        Coordinates.mainType = L_.configData.coordinates?.coordmain || 'll'
        if (!Object.keys(Coordinates.states).includes(Coordinates.mainType))
            Coordinates.mainType = 'll'
        Coordinates.currentType = Coordinates.mainType

        // Make mainType first in dropdown list
        Coordinates.stateIndices = Coordinates.stateIndices.filter(
            (item) => item !== Coordinates.mainType
        )
        Coordinates.stateIndices.unshift(Coordinates.mainType)

        // Create dropdown, dropdown is how user will toggle between coord types/states
        Coordinates.refreshDropdown()

        // Event functions
        $('#pickLngLat').on('click', pickLngLat)
        $('#mouseGoPicking').on('click', pickLngLatGo)
        $('#toggleTimeUI').on('click', toggleTimeUI)
        Map_.map.on('mousemove', mouseLngLatMove)
        Map_.map.on('click', urlClick)

        if (
            L_.configData.time &&
            L_.configData.time.enabled === true &&
            (
                L_.FUTURES.live === true ||
                (L_.FUTURES.live == null && (
                    L_.configData.time.initiallyOpen === true ||
                    L_.configData.time.liveByDefault === true
                ))
            )
        ) {
            toggleTimeUI()
        }
    },
    refreshDropdown: function () {
        const names = []
        Coordinates.stateIndices.forEach((state) => {
            const s = Coordinates.states[state]
            let name = ''
            if (s.title) name += `${s.title} (`
            name += `${s.names[0]}, ${s.names[1]}`
            if (Coordinates.elevation != null) name += `, ${s.names[2]}`
            if (s.title) name += ')'
            names.push(name)
        })
        // Only remake dropdown if options changed
        if (
            Coordinates._prevDropdownNames &&
            Coordinates._prevDropdownNames.join('--') === names.join('--')
        )
            return

        Coordinates._prevDropdownNames = names

        const startingIndex = Coordinates.stateIndices.indexOf(
            Coordinates.currentType
        )

        $('#changeCoordTypeDropdown').html(
            Dropy.construct(names, 'Coordinate Type', startingIndex, {
                openUp: true,
                dark: true,
            })
        )
        Dropy.init($('#changeCoordTypeDropdown'), function (idx) {
            changeCoordType(idx)
        })
        // Start on the current type
        changeCoordType(startingIndex)
    },
    clear: function () {},
    getMainTypeName: function () {
        return (
            Coordinates.states[Coordinates.mainType].title ||
            Coordinates.states[Coordinates.mainType].ancillaryTitle ||
            'projected'
        )
    },
    getLngLat: function () {
        return Coordinates.mouseLngLat
    },
    getLatLng: function (asObject) {
        if (asObject)
            return {
                lat: Coordinates.mouseLngLat[1],
                lng: Coordinates.mouseLngLat[0],
            }
        return [Coordinates.mouseLngLat[1], Coordinates.mouseLngLat[0]]
    },
    getAllCoordinates: function () {
        return {
            description: d3
                .select('#changeCoordTypeDropdown .dropy__title > span')
                .html(),
            coordinates: [
                ...d3.select('#mouseLngLat').html().split(','),
                d3.select('#mouseElev').html(),
            ].map((c) => parseFloat(c.replace(/,/g, ''))),
        }
    },
    //rawLngLat is same type as mouseLngLat and coordsString is whatever
    setCoords: function (rawLngLat, coordsString) {
        Coordinates.mouseLngLat = rawLngLat
        d3.select('#mouseLngLat').html(coordsString)
    },
    refresh: function () {
        const newCoords = Coordinates.convertLngLat(
            Coordinates.mouseLngLat[0],
            Coordinates.mouseLngLat[1],
            Coordinates.currentType,
            true,
            true,
            true
        )

        $('#mouseLngLat').text(`${newCoords[0]}, ${newCoords[1]}`)
        $('#mouseElev').text(newCoords[2] != null ? `, ${newCoords[2]}` : '')

        if (Coordinates.elevation != null) $('#mouseElev').css({ opacity: 1 })
    },
    convertLngLat: function (
        lng,
        lat,
        type,
        withPrecisionAndUnits,
        withElevation,
        withDropdownChanges
    ) {
        type = type || Coordinates.mainType
        const currentState = Coordinates.states[type]
        const newCoords = [0, 0]

        switch (type) {
            case 'll':
                newCoords[0] = lng + currentState.coordOffset[0]
                newCoords[1] = lat + currentState.coordOffset[1]
                if (Coordinates.elevation != null)
                    newCoords[2] = Coordinates.elevation
                break
            case 'en':
                newCoords[0] =
                    lng *
                        (Math.PI / 180) *
                        F_.radiusOfPlanetMajor *
                        currentState.coordENMultiplier[0] +
                    currentState.coordENOffset[0]
                newCoords[1] =
                    lat *
                        (Math.PI / 180) *
                        F_.radiusOfPlanetMajor *
                        currentState.coordENMultiplier[1] +
                    currentState.coordENOffset[1]
                if (Coordinates.elevation != null)
                    newCoords[2] = Coordinates.elevation
                break
            case 'cproj':
                if (
                    window.proj4 != null &&
                    window.mmgisglobal.customCRS?.projString
                ) {
                    const converted = window.proj4(
                        window.mmgisglobal.customCRS.projString,
                        [lng, lat]
                    )
                    newCoords[0] = converted[0]
                    newCoords[1] = converted[1]
                    if (Coordinates.elevation != null)
                        newCoords[2] = Coordinates.elevation
                }
                break
            case 'sproj':
                if (
                    window.proj4 != null &&
                    currentState.proj != null &&
                    currentState.proj.length > 0
                ) {
                    const converted = window.proj4(currentState.proj, [
                        lng,
                        lat,
                    ])
                    newCoords[0] = converted[0]
                    newCoords[1] = converted[1]
                    if (Coordinates.elevation != null)
                        newCoords[2] = Coordinates.elevation
                }
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
                    if (withDropdownChanges) {
                        currentState.title =
                            'Relative to ' +
                            L_.layers.data[Map_.activeLayer.options.layerName]
                                .display_name +
                            ': ' +
                            keyAsName
                        Coordinates.refreshDropdown()
                    }

                    lng -= Map_.activeLayer.feature.geometry.coordinates[0]
                    lat -= Map_.activeLayer.feature.geometry.coordinates[1]

                    rzVal =
                        Map_.activeLayer.feature.geometry.coordinates[2] || 0
                } else {
                    if (withDropdownChanges) {
                        currentState.title = 'Relative to Map Origin'
                        Coordinates.refreshDropdown()
                    }
                }
                newCoords[0] =
                    lng *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor *
                    currentState.coordENMultiplier[0]
                newCoords[1] =
                    lat *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor *
                    currentState.coordENMultiplier[1]
                if (Coordinates.elevation != null)
                    newCoords[2] = Coordinates.elevation - rzVal

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
                    if (withDropdownChanges) {
                        currentState.title =
                            'Local Level - ' +
                            L_.layers.data[Map_.activeLayer.options.layerName]
                                .display_name +
                            ': ' +
                            keyAsName
                        Coordinates.refreshDropdown()
                    }

                    lng -= Map_.activeLayer.feature.geometry.coordinates[0]
                    lat -= Map_.activeLayer.feature.geometry.coordinates[1]

                    zVal = Map_.activeLayer.feature.geometry.coordinates[2] || 0
                } else {
                    if (withDropdownChanges) {
                        currentState.title = 'Local Level - Map Origin'
                        Coordinates.refreshDropdown()
                    }
                }
                newCoords[0] =
                    lat *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor *
                    currentState.coordENMultiplier[1]
                newCoords[1] =
                    lng *
                    (Math.PI / 180) *
                    F_.radiusOfPlanetMajor *
                    currentState.coordENMultiplier[0]
                if (Coordinates.elevation != null)
                    newCoords[2] = zVal - Coordinates.elevation
                break
            default:
        }

        if (!withElevation && Coordinates.elevation != null) newCoords.pop()

        if (withPrecisionAndUnits) {
            newCoords[0] = `${newCoords[0].toFixed(currentState.precision[0])}${
                currentState.units[0]
            }`
            newCoords[1] = `${newCoords[1].toFixed(currentState.precision[1])}${
                currentState.units[1]
            }`
            if (newCoords[2] != null)
                newCoords[2] = `${newCoords[2].toFixed(
                    currentState.precision[2]
                )}${currentState.units[2]}`
        }

        return newCoords
    },
    getElevation: function () {
        clearTimeout(Coordinates.elevationTimeout)

        if (
            L_.configData.coordinates == null ||
            L_.configData.coordinates.coordelevurl == null
        )
            return

        // Let's be fancy and query more quickly the more the user queries
        let delay = 800
        if (Coordinates.elevQueryTimes.length >= 10) delay = 400
        if (Coordinates.elevQueryTimes.length >= 20) delay = 200

        Coordinates.showElevation()

        Coordinates.elevationTimeout = setTimeout(() => {
            const now = new Date().getTime()
            Coordinates.elevQueryTimes.push(now)
            Coordinates.elevQueryTimes = Coordinates.elevQueryTimes.filter(
                (v) => v > now - 60000
            )

            let url = L_.configData.coordinates.coordelevurl
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url

            if ($('#mouseElev').css('display') === 'none') return

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
                    if (data[0] && data[0][1] != null) {
                        Coordinates.elevation = data[0][1]
                        Coordinates.refresh()
                    }
                },
                function () {
                    console.warn('Coordinates: Failed to query elevation.')
                    Coordinates.elevation = null
                }
            )
        }, delay)
    },
    hideElevation: function () {
        $('#mouseElev').css({ display: 'none' })
    },
    showElevation: function () {
        $('#mouseElev').css({ display: 'block' })
    },
    remove: function () {
        //Clear all the stuffes
        $('#pickLngLat').off('click', pickLngLat)
        $('#mouseGoPicking').off('click', pickLngLatGo)
        $('#toggleTimeUI').off('click', toggleTimeUI)
        Map_.map.off('mousemove', mouseLngLatMove)
        Map_.map.off('click', urlClick)
    },
}

//Upon clicking the lnglat bar, swap decimal degrees and meters and recalculate
function changeCoordType(newCoordIndex) {
    Coordinates.currentType = Coordinates.stateIndices[newCoordIndex]
    Coordinates.refresh()
}

//Update mouse lat long coordinate display on mouse move
function mouseLngLatMove(e) {
    Coordinates.mouseLngLatRaw = [e.latlng.lng, e.latlng.lat]
    Coordinates.mouseLngLat = [e.latlng.lng, e.latlng.lat]
    if (
        L_.configData.coordinates &&
        L_.configData.coordinates.coordelev === true
    )
        Coordinates.getElevation()
    Coordinates.refresh()
    $('#mouseElev').css({ opacity: 0.6 })
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

        const currentState = Coordinates.states[Coordinates.currentType]

        // prettier-ignore
        const markup = [
            `<input id='mouseLngLatPickingA' placeholder="${currentDescSplit[0]}" type="number" value="${parseFloat(currentTextSplit[0]).toFixed(4)}"/>`,
            `<div>${currentState.units[0]}</div>`,
            `<input id='mouseLngLatPickingB' placeholder="${currentDescSplit[1]}" type="number" value="${parseFloat(currentTextSplit[1]).toFixed(4)}"/>`,
            `<div>${currentState.units[1]}</div>`
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

    const currentState = Coordinates.states[Coordinates.currentType]

    switch (Coordinates.currentType) {
        case 'll': //00 lnglat
            finalLng = valA - currentState.coordOffset[0]
            finalLat = valB - currentState.coordOffset[1]
            break
        case 'en': //01 easting northing
            const valALng =
                ((valA - currentState.coordENOffset[0]) * (180 / Math.PI)) /
                F_.radiusOfPlanetMajor
            const valBLat =
                ((valB - currentState.coordENOffset[1]) * (180 / Math.PI)) /
                F_.radiusOfPlanetMajor
            finalLng = valALng / currentState.coordENMultiplier[0]
            finalLat = valBLat / currentState.coordENMultiplier[1]
            break
        case 'cproj':
            if (
                window.proj4 != null &&
                window.mmgisglobal.customCRS?.projString
            ) {
                const converted = window
                    .proj4(window.mmgisglobal.customCRS.projString)
                    .inverse([valA, valB])
                finalLng = converted[0]
                finalLat = converted[1]
            }
            break
        case 'sproj':
            if (
                window.proj4 != null &&
                currentState.proj != null &&
                currentState.proj.length > 0
            ) {
                const converted = window
                    .proj4(currentState.proj)
                    .inverse([valA, valB])
                finalLng = converted[0]
                finalLat = converted[1]
            }
            break
        case 'rxy': //10 relative easting northing
            let relativeA = 0
            let relativeB = 0
            if (Map_.activeLayer != null) {
                relativeA = Map_.activeLayer.feature.geometry.coordinates[0]
                relativeB = Map_.activeLayer.feature.geometry.coordinates[1]
            }
            valA /= currentState.coordENMultiplier[0]
            valB /= currentState.coordENMultiplier[1]
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
            valA /= currentState.coordENMultiplier[0]
            valB /= currentState.coordENMultiplier[1]
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
    const active = $('#toggleTimeUI').hasClass('active')
    $('#toggleTimeUI').toggleClass('active')
    $('#timeUI').toggleClass('active')

    const newBottom = active ? 0 : 40
    const timeBottom = active ? -40 : 0

    Map_.map._fadeAnimated = active

    $('#CoordinatesDiv').css({
        bottom: newBottom + (UserInterface.pxIsTools || 0) + 'px',
    })
    $('#mapToolBar').css({
        bottom: newBottom + (UserInterface.pxIsTools || 0) + 'px',
    })
    $('.leaflet-bottom.leaflet-left').css({
        bottom: newBottom + 'px',
    })
    $('#photosphereAzIndicator').css({
        bottom: newBottom + (UserInterface.pxIsTools || 0) + 'px',
        transition: 'bottom 0.2s ease-in',
    })
    $('#_lithosphere_controls_bottomleft').css({
        bottom: newBottom + (UserInterface.pxIsTools || 0) + 10 + 'px',
        transition: 'bottom 0.2s ease-in',
    })
    $('#timeUI').css({
        bottom: timeBottom + (UserInterface.pxIsTools || 0) + 'px',
    })

    Object.keys(L_._onTimeUIToggleSubscriptions).forEach((k) => {
        L_._onTimeUIToggleSubscriptions[k](!active)
    })
}

export default Coordinates
