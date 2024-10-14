import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
//jqueryUI
import { center } from '@turf/turf'
import * as d3 from 'd3'

import Dropy from '../../external/Dropy/dropy'
import '../../external/JQuery/jquery.autocomplete'

import calls from '../../pre/calls'

import './Search.css'

// prettier-ignore
var markup = [
  "<div id='Search' class='flexbetween' style='height: 100%; pointer-events: auto; position: relative;'>",
    "<div id='SearchType' class='ui dropdown short searchSelect' tabindex='400'></div>",
    "<div>",
        "<input id='auto_search' class='topBarSearch' type='text' placeholder='Search...' tabindex='401'></input>",
    "</div>",
    "<div id='SearchClear' style='margin-left: 0; mix-blend-mode: difference;'><i class='mdi mdi-close mdi-18px'  tabindex='402'></i></div>",
    "<div id='SearchBoth' style='margin-left: 0; mix-blend-mode: difference;'><i class='mdi mdi-magnify mdi-18px'  tabindex='403'></i></div>",
    /*
    "<div id='SearchGo' class='mmgisButton' style='margin-right: 0;'>Go</div>",
    "<div id='SearchSelect' class='mmgisButton' style='margin-left: 0; margin-right: 0;'>Select</div>",
    */
  "</div>"
  ].join('\n');

let L_ = null
let Viewer_ = null
let Map_ = null
let Globe_ = null

var Search = {
    height: 43,
    width: 700,
    lname: null,
    arrayToSearch: null,
    MMWebGISInterface: null,
    searchvars: {},
    searchFields: {},
    adjustedFieldUUIDs: [],
    adjustedFieldNames: [],
    type: 'geojson',
    lastGeodatasetLayerName: null,
    init: function (classSel, l_, v_, m_, g_) {
        L_ = l_
        Viewer_ = v_
        Map_ = m_
        Globe_ = g_

        //Get search variables
        this.searchvars = {}
        for (let l in L_.layers.data) {
            if (
                L_.layers.data[l].variables &&
                L_.layers.data[l].variables.search
            )
                this.searchvars[l] = L_.layers.data[l].variables.search
        }

        // Nothing configured so don't even render it
        if (Object.keys(this.searchvars).length == 0) return

        this.searchFields = makeSearchFields(this.searchvars)
        if (
            L_.searchStrings != null &&
            L_.searchStrings.length > 0 &&
            L_.searchFile != null
        ) {
            searchWithURLParams()
        }
        this.MMWebGISInterface = new interfaceWithMMWebGIS(classSel)
    },
}

function interfaceWithMMWebGIS(classSel) {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }

    Search.lname = null
    Search.arrayToSearch = []

    var cont = d3.select(classSel)
    if (cont == null) return
    cont.selectAll('*').remove()
    cont.html(markup)

    Search.adjustedFieldUUIDs = []
    Search.adjustedFieldNames = []
    for (let l in Search.searchFields) {
        if (
            L_.layers.data[l] &&
            (L_.layers.data[l].type == 'vector' ||
                L_.layers.data[l].type == 'vectortile')
        ) {
            Search.adjustedFieldUUIDs.push(l)
            Search.adjustedFieldNames.push(L_.layers.data[l].display_name)
        }
    }

    $('#SearchType').html(
        Dropy.construct(Search.adjustedFieldNames, 'Search Layer...', 0)
    )
    Dropy.init($('#SearchType'), function (idx) {
        changeSearchField(Search.adjustedFieldUUIDs[idx])
    })
    changeSearchField(Search.adjustedFieldUUIDs[0])

    d3.select('#SearchGo').on('click', searchGo)
    d3.select('#SearchSelect').on('click', searchSelect)
    d3.select('#SearchClear').on('click', function () {
        $('#auto_search').val('')
    })
    d3.select('#SearchBoth').on('click', searchBoth)

    function separateFromMMWebGIS() {
        d3.select('#SearchGo').on('click', null)
        d3.select('#SearchSelect').on('click', null)
        d3.select('#SearchBoth').on('click', null)
        if ($('#auto_search').hasClass('ui-autocomplete-input')) {
            //MMGIS2 $('#auto_search').autocomplete('destroy')
        }
    }
}

function escapeRegex(value) {
    if (value == null) return value
    return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
}
function initializeSearch() {
    $('#auto_search').autocomplete({
        lookup: Search.arrayToSearch,
        lookupLimit: 100,
        minChars: 1,
        transformResult: function (response, originalQuery) {
            let resultSuggestions = []
            $.map(response, function (jsonItem) {
                if (typeof jsonItem != 'string') {
                    $.map(jsonItem, function (suggestionItem) {
                        resultSuggestions.push(suggestionItem)
                    })
                }
            })
            resultSuggestions.sort(function (a, b) {
                const aStart = String(a.value).match(
                        new RegExp(originalQuery, 'i')
                    ) || { index: -1 },
                    bStart = String(b.value).match(
                        new RegExp(originalQuery, 'i')
                    ) || { index: -1 }
                if (aStart.index != bStart.index)
                    return aStart.index - bStart.index
                else return a > b ? 1 : -1
            })
            response.suggestions = resultSuggestions
            return response
        },
        onSelect: function (event) {
            searchBoth(event.value)
        },
    })

    $('#auto_search').on('keydown', function (e) {
        if (e.keyCode == 13) searchBoth()
    })

    $('.autocomplete-suggestions').css({
        'max-height': '60vh',
        'overflow-y': 'auto',
        'overflow-x': 'hidden',
        border: '1px solid var(--color-mmgis)',
        'border-top': 'none',
        'background-color': 'var(--color-a)',
    })
}

async function changeSearchField(val, selectedPlaceholder) {
    if (selectedPlaceholder || val == null) {
        // We're on the placeholder
        Search.arrayToSearch = []
        document.getElementById('auto_search').placeholder = ''
        initializeSearch()
        return
    }

    if (Map_ != null) {
        Search.lname = val

        Search.layerType = L_.layers.data[Search.lname].type
        if (L_.layers.on[Search.lname] !== true) {
            await L_.toggleLayer(L_.layers.data[Search.lname])

            const layerCheck = $(
                `#LayersTool${Search.lname.replace(
                    /\s/g,
                    ''
                )} .title .checkboxcont .checkbox`
            )
            if (layerCheck.length > 0) {
                $(layerCheck[0]).removeClass('off')
                $(layerCheck[0]).addClass('on')
            }
        }

        Search.type = 'geojson'
        $('#SearchSelect').css({ display: 'inherit' })
        $('#SearchBoth').css({ display: 'inherit' })

        $('#auto_search').val('')

        Search.arrayToSearch = []
        let data
        try {
            data = L_.layers.layer[Search.lname].toGeoJSON(L_.GEOJSON_PRECISION)
        } catch (err) {
            data = { features: [] }
        }

        let props
        for (let i = 0; i < data.features.length; i++) {
            props = data.features[i].properties
            Search.arrayToSearch.push(
                getSearchFieldStringForFeature(Search.lname, props)
            )
        }

        if (Search.arrayToSearch[0]) {
            if (!isNaN(Search.arrayToSearch[0]))
                Search.arrayToSearch.sort(function (a, b) {
                    return a - b
                })
            else Search.arrayToSearch.sort()
        }
        if (document.getElementById('auto_search') != null) {
            document.getElementById('auto_search').placeholder =
                getSearchFieldKeys(Search.lname)
        }

        initializeSearch()
        //}
    }
}

function searchGo() {
    switch (Search.type) {
        case 'geodatasets':
            searchGeodatasets()
            break
        default:
            doWithSearch('goto', 'false', 'false', false)
    }
}
function searchSelect() {
    doWithSearch('select', 'false', 'false', false)
}
function searchBoth(value) {
    switch (Search.layerType) {
        case 'vectortile':
            searchGeodatasets()
            break
        default:
            doWithSearch('both', 'false', 'false', false, value)
    }
}

function searchGeodatasets() {
    let value = document.getElementById('auto_search').value

    let key =
        Search.searchFields[Search.lname] &&
        Search.searchFields[Search.lname][0]
            ? Search.searchFields[Search.lname][0][1]
            : null
    if (key == null) return

    let wasOff = false
    // Turn the layer on if it's off

    calls.api(
        'geodatasets_search',
        {
            layer: Search.lastGeodatasetLayerName,
            key: key,
            value: value,
        },
        function (d) {
            var r = d.body[0]

            let selectTimeout = setTimeout(() => {
                L_.layers.layer[Search.lname].off('load')
                selectFeature()
            }, 1500)

            L_.layers.layer[Search.lname].on('load', function (event) {
                L_.layers.layer[Search.lname].off('load')
                clearTimeout(selectTimeout)
                selectFeature()
            })
            Map_.map.setView(
                [r.coordinates[1], r.coordinates[0]],
                Map_.mapScaleZoom || Map_.map.getZoom()
            )
            if (!L_.layers.on[Search.lname]) {
                wasOff = true
                L_.toggleLayer(L_.layers.data[Search.lname])
                const layerCheck = $(
                    `#LayersTool${Search.lname.replace(
                        /\s/g,
                        ''
                    )} .title .checkboxcont .checkbox`
                )
                if (layerCheck.length > 0) {
                    $(layerCheck[0]).removeClass('off')
                    $(layerCheck[0]).addClass('on')
                }
            }

            function selectFeature() {
                var vts = L_.layers.layer[Search.lname]._vectorTiles
                for (var i in vts) {
                    for (var j in vts[i]._features) {
                        var feature = vts[i]._features[j].feature
                        if (feature.properties[key] == value) {
                            feature._layerName = vts[i].options.layerName
                            feature._layer = feature
                            L_.layers.layer[Search.lname]._events.click[0].fn({
                                layer: feature,
                                sourceTarget: feature,
                            })
                            return
                        }
                    }
                }
            }
        },
        function (d) {}
    )
}

//doX is either "goto", "select" or "both"
//forceX overrides searchbar entry, "false" for default
//forceSTS overrides dropdown, "false" for default
//function doWithSearch( doX, forceX, forceSTS ) {
function doWithSearch(doX, forceX, forceSTS, isURLSearch, value) {
    var x
    var sTS

    if (forceX == 'false' && !isURLSearch) {
        x =
            value != null
                ? [value]
                : [document.getElementById('auto_search').value] //what the user entered in search field
    } else if (forceX == 'false' && isURLSearch) {
        x = L_.searchStrings
    } else x = forceX

    if (forceSTS == 'false') sTS = Search.lname
    else sTS = forceSTS

    var markers = L_.layers.layer[Search.lname]
    var selectLayers = []
    var gotoLayers = []

    // Turn the layer on if it's off
    if (!L_.layers.on[Search.lname]) {
        L_.toggleLayer(L_.layers.data[Search.lname])
        const layerCheck = $(
            `#LayersTool${Search.lname.replace(
                /\s/g,
                ''
            )} .title .checkboxcont .checkbox`
        )
        if (layerCheck.length > 0) {
            $(layerCheck[0]).removeClass('off')
            $(layerCheck[0]).addClass('on')
        }
    }

    if (doX == 'both' || doX == 'select') {
        L_.resetLayerFills()
    }

    if (markers != undefined && typeof markers.eachLayer === 'function') {
        markers.eachLayer(function (layer) {
            var props = layer.feature.properties
            var clickI = 0
            var shouldSearch = false
            var comparer = getSearchFieldStringForFeature(Search.lname, props)

            for (var i = 0; i < x.length; i++) {
                if (
                    x.length == 1
                        ? x[i].toLowerCase() == comparer.toLowerCase()
                        : x[i].toLowerCase().indexOf(comparer.toLowerCase()) >
                              -1 ||
                          comparer.toLowerCase().indexOf(x[i].toLowerCase()) >
                              -1
                ) {
                    shouldSearch = true
                    break
                }
            }

            if (shouldSearch) {
                if (doX == 'both' || doX == 'select') {
                    selectLayers.push(layer)
                }
                if (doX == 'both' || doX == 'goto') {
                    gotoLayers.push(layer)
                }
            }
        })

        if (selectLayers.length == 1) {
            L_.highlight(selectLayers[0])
            selectLayers[0].fireEvent('click')
            if (typeof selectLayers[0].bringToFront === 'function')
                selectLayers[0].bringToFront()
        } else if (selectLayers.length > 1) {
            for (var i = 0; i < selectLayers.length; i++) {
                L_.highlight(selectLayers[i])
                if (typeof selectLayers[i].bringToFront === 'function')
                    selectLayers[i].bringToFront()
            }
        }

        if (gotoLayers.length > 0) {
            var coordinate = getMapZoomCoordinate(gotoLayers)
            Map_.map.setView(
                [coordinate.latitude, coordinate.longitude],
                Map_.mapScaleZoom || Map_.map.getZoom()
            )
        }
    }
}

//Probably better to use a grammar
function makeSearchFields(vars) {
    let searchfields = {}
    for (let layerfield in vars) {
        var fieldString = vars[layerfield]
        fieldString = fieldString.split(')')
        for (var i = 0; i < fieldString.length; i++) {
            fieldString[i] = fieldString[i].split('(')
            var li = fieldString[i][0].lastIndexOf(' ')
            if (li != -1) {
                fieldString[i][0] = fieldString[i][0].substring(li + 1)
            }
        }
        fieldString.pop()
        //0 is function, 1 is parameter
        searchfields[layerfield] = fieldString
    }
    return searchfields
}

function getSearchFieldStringForFeature(name, props) {
    let str = ''
    if (Search.searchFields.hasOwnProperty(name)) {
        const sf = Search.searchFields[name] //sf for search field
        for (let i = 0; i < sf.length; i++) {
            switch (sf[i][0].toLowerCase()) {
                case '': //no function
                    str += F_.getIn(props, sf[i][1])
                    break
                case 'round':
                    str += Math.round(F_.getIn(props, sf[i][1]))
                    break
                case 'rmunder':
                    if (F_.getIn(props, sf[i][1]))
                        str += F_.getIn(props, sf[i][1]).replace('_', ' ')
                    break
            }
            if (i != sf.length - 1) str += ' '
        }
    }
    return str
}

function getSearchFieldKeys(name) {
    var str = ''
    if (Search.searchFields.hasOwnProperty(name)) {
        var sf = Search.searchFields[name] //sf for search field
        for (var i = 0; i < sf.length; i++) {
            str += sf[i][1]
            str += ' '
        }
    }
    return str.substring(0, str.length - 1)
}

function searchWithURLParams() {
    changeSearchField(L_.searchFile)
    doWithSearch('both', 'false', 'false', true)
}

function getMapZoomCoordinate(layers) {
    //The zoom levels are defined at http://wiki.openstreetmap.org/wiki/Zoom_levels
    var zoomLevels = [
        360, 180, 90, 45, 22.5, 11.25, 5.625, 2.813, 1.406, 0.703, 0.352, 0.176,
        0.088, 0.044, 0.022, 0.011, 0.005, 0.003, 0.001, 0.0005, 0.0003, 0.0001,
    ]
    var boundingBoxNorth = 90
    var boundingBoxSouth = -90
    var boundingBoxEast = 180
    var boundingBoxWest = -180
    var latitudeValidRange = [-90, 90]
    var longitudeValidRange = [-180, 180]

    for (var i = 0; i < layers.length; i++) {
        const centerPt = center(layers[i].feature)?.geometry?.coordinates || [
            -1001, -1001,
        ]
        var latitude = centerPt[1]
        var longitude = centerPt[0]

        //make sure latitude and longitude are in [-90, 90] and [-180, 180]
        if (
            latitude < latitudeValidRange[0] ||
            latitude > latitudeValidRange[1] ||
            longitude < longitudeValidRange[0] ||
            longitude > longitudeValidRange[1]
        ) {
            continue
        }

        if (latitude <= boundingBoxNorth) {
            boundingBoxNorth = latitude
        }
        if (latitude >= boundingBoxSouth) {
            boundingBoxSouth = latitude
        }
        if (longitude <= boundingBoxEast) {
            boundingBoxEast = longitude
        }
        if (longitude >= boundingBoxWest) {
            boundingBoxWest = longitude
        }
    }

    var latitudeDiff = Math.abs(boundingBoxNorth - boundingBoxSouth)
    var longitudeDiff = Math.abs(boundingBoxEast - boundingBoxWest)
    if (latitudeDiff == 0 && longitudeDiff == 0) {
        return {
            latitude: boundingBoxNorth,
            longitude: boundingBoxEast,
            zoomLevel: 21,
        }
    } else {
        var maxDiff =
            latitudeDiff >= longitudeDiff ? latitudeDiff : longitudeDiff
        for (var i = 0; i < zoomLevels.length; i++) {
            if (maxDiff < zoomLevels[i] && i != zoomLevels.length - 1) {
                continue
            }

            return {
                latitude:
                    boundingBoxSouth +
                    (boundingBoxNorth - boundingBoxSouth) / 2,
                longitude:
                    boundingBoxWest + (boundingBoxEast - boundingBoxWest) / 2,
                zoomLevel: i,
            }
        }
    }
}

export default Search
