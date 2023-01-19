import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'
import Description from '../../Ancillary/Description'
import QueryURL from '../../Ancillary/QueryURL'

// prettier-ignore
var markup = [
  "<div id='searchTool' class='flexbetween'>",
    "<div style='padding-right: 8px; color: var(--color-mmgis); line-height: 43px;'>Search</div>",
    "<select id='searchToolType' class='ui dropdown short lower searchToolSelect'>",
    "</select>",
    "<p style='padding-left: 8px; line-height: 43px;'>for</p>",
    "<div class='ui-widget' style='display: inline-block; padding: 9px 8px 8px 8px;'>",
      "<input id='auto_search' style='color: #111;'></input>",
    "</div>",
    "<p style='line-height: 43px;'>and</p>",
    "<div id='searchToolGo' class='mmgisButton' style='margin-right: 0;'>Go</div>",
    "<div id='searchToolSelect' class='mmgisButton' style='margin-left: 0; margin-right: 0;'>Select</div>",
    "<div id='searchToolBoth' class='mmgisButton' style='margin-left: 0;'>Both</div>",
  "</div>"
  ].join('\n');

var SearchTool = {
    height: 43,
    width: 700,
    lname: null,
    arrayToSearch: null,
    MMWebGISInterface: null,
    vars: {},
    searchFields: {},
    type: 'geojson',
    lastGeodatasetLayerName: null,
    initialize: function () {
        //Get tool variables
        this.vars = L_.getToolVars('search')
        this.searchFields = makeSearchFields(this.vars)
        if (
            L_.searchStrings != null &&
            L_.searchStrings.length > 0 &&
            L_.searchFile != null
        ) {
            searchWithURLParams()
        }
    },
    make: function () {
        this.MMWebGISInterface = new interfaceWithMMWebGIS()
    },
    destroy: function () {
        this.MMWebGISInterface.separateFromMMWebGIS()
    },
}

function interfaceWithMMWebGIS() {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }

    SearchTool.lname = null
    SearchTool.arrayToSearch = []

    var tools = d3.select('#tools')
    tools.selectAll('*').remove()
    tools = tools.append('div').style('height', '100%')
    tools.html(markup)

    var first = true
    for (l in SearchTool.searchFields) {
        if (
            L_.layers.data[l] &&
            (L_.layers.data[l].type == 'vector' ||
                L_.layers.data[l].type == 'vectortile') &&
            L_.layers.on[l]
        ) {
            d3.select('#searchToolType')
                .append('option')
                .attr('value', l)
                .html(l)
            if (first) {
                changeSearchField(l)
                first = false
            }
        }
    }
    $('#searchToolType').dropdown({
        onChange: function (val) {
            changeSearchField(val)
        },
        direction: 'upward',
    })

    d3.select('#searchToolGo').on('click', searchGo)
    d3.select('#searchToolSelect').on('click', searchSelect)
    d3.select('#searchToolBoth').on('click', searchBoth)

    function separateFromMMWebGIS() {
        d3.select('#searchToolGo').on('click', null)
        d3.select('#searchToolSelect').on('click', null)
        d3.select('#searchToolBoth').on('click', null)
        if ($('#auto_search').hasClass('ui-autocomplete-input')) {
            $('#auto_search').autocomplete('destroy')
        }
    }
}

function initializeSearch() {
    $(function () {
        $('#auto_search').autocomplete({
            source: function (request, response) {
                var re = $.ui.autocomplete.escapeRegex(request.term)
                var matcher = new RegExp('\\b' + re, 'i')
                var a = $.grep(
                    SearchTool.arrayToSearch,
                    function (item, index) {
                        return matcher.test(item)
                    }
                )
                response(a)
            },
            //drop up
            position: {
                my: 'left bottom',
                at: 'left top',
                collision: 'flip',
            },
        })
        $('.ui-autocomplete')
            .css({
                'max-height': '40vh',
                'overflow-y': 'auto',
                'overflow-x': 'hidden',
                border: 'none',
                'background-color': 'rgba(34,37,38,0.6)',
            })
            .addClass('mmgisScrollbar')
    })
}

function changeSearchField(val) {
    if (Map_ != null) {
        SearchTool.lname = val

        let urlSplit = L_.layers.data[SearchTool.lname].url.split(':')

        if (urlSplit[0] == 'geodatasets' && urlSplit[1] != null) {
            SearchTool.type = 'geodatasets'
            SearchTool.lastGeodatasetLayerName = urlSplit[1]
            $('#searchToolSelect').css({ display: 'none' })
            $('#searchToolBoth').css({ display: 'none' })
        } else {
            SearchTool.type = 'geojson'
            $('#searchToolSelect').css({ display: 'inherit' })
            $('#searchToolBoth').css({ display: 'inherit' })

            var searchFile = L_.layers.data[SearchTool.lname].url

            $.getJSON(L_.missionPath + searchFile, function (data) {
                SearchTool.arrayToSearch = []
                var props
                for (var i = 0; i < data.features.length; i++) {
                    props = data.features[i].properties
                    SearchTool.arrayToSearch.push(
                        getSearchFieldStringForFeature(SearchTool.lname, props)
                    )
                }
                if (SearchTool.arrayToSearch[0]) {
                    if (!isNaN(SearchTool.arrayToSearch[0]))
                        SearchTool.arrayToSearch.sort(function (a, b) {
                            return a - b
                        })
                    else SearchTool.arrayToSearch.sort()
                }
                if (document.getElementById('auto_search') != null) {
                    document.getElementById('auto_search').placeholder =
                        getSearchFieldKeys(SearchTool.lname)
                }
            })
        }
        initializeSearch()
    }
}

function searchGo() {
    switch (SearchTool.type) {
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
function searchBoth() {
    doWithSearch('both', 'false', 'false', false)
}

function searchGeodatasets() {
    let value = document.getElementById('auto_search').value
    let key =
        SearchTool.searchFields[SearchTool.lname] &&
        SearchTool.searchFields[SearchTool.lname][0]
            ? SearchTool.searchFields[SearchTool.lname][0][1]
            : null
    if (key == null) return

    calls.api(
        'geodatasets_search',
        {
            layer: SearchTool.lastGeodatasetLayerName,
            key: key,
            value: value,
        },
        function (d) {
            var r = d.body[0]
            Map_.map.setView(
                [r.coordinates[1], r.coordinates[0]],
                Map_.map.getZoom()
            )
            setTimeout(function () {
                var vts = L_.layers.layer[SearchTool.lname]._vectorTiles
                for (var i in vts) {
                    for (var j in vts[i]._features) {
                        var feature = vts[i]._features[j].feature
                        if (feature.properties[key] == value) {
                            L_.layers.layer[
                                SearchTool.lname
                            ]._events.click[0].fn({ layer: feature })
                            break
                        }
                    }
                }
            }, 2000)
        },
        function (d) {}
    )
}

//doX is either "goto", "select" or "both"
//forceX overrides searchbar entry, "false" for default
//forceSTS overrides dropdown, "false" for default
//function doWithSearch( doX, forceX, forceSTS ) {
function doWithSearch(doX, forceX, forceSTS, isURLSearch) {
    var x
    var sTS

    if (forceX == 'false' && !isURLSearch) {
        x = [document.getElementById('auto_search').value] //what the user entered in search field
    } else if (forceX == 'false' && isURLSearch) {
        x = L_.searchStrings
    } else x = forceX

    if (forceSTS == 'false') sTS = SearchTool.lname
    else sTS = forceSTS

    var markers = L_.layers.layer[SearchTool.lname]
    var selectLayers = []
    var gotoLayers = []
    var targetsID
    if (doX == 'both' || doX == 'select') {
        L_.resetLayerFills()
    }
    if (markers != undefined) {
        markers.eachLayer(function (layer) {
            var props = layer.feature.properties
            var clickI = 0
            var shouldSearch = false
            var comparer = getSearchFieldStringForFeature(
                SearchTool.lname,
                props
            )

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
            selectLayers[0].setStyle({ fillColor: 'red' })
            selectLayers[0].bringToFront()
            Map_.activeLayer = selectLayers[0]
            Description.updatePoint(Map_.activeLayer)
            ToolController_.getTool('InfoTool').use(selectLayers[0].feature)
            ToolController_.getTool('ChemistryTool').use(selectLayers[0])
            Globe_.highlight(
                Globe_.findSpriteObject(
                    selectLayers[0].options.layerName,
                    selectLayers[0].feature.properties[
                        selectLayers[0].useKeyAsName
                    ]
                ),
                false
            )
            Viewer_.highlight(selectLayers[0])
            if (!isURLSearch) {
                QueryURL.writeSearchURL(x, SearchTool.lname)
            }
        } else if (selectLayers.length > 1) {
            for (var i = 0; i < selectLayers.length; i++) {
                selectLayers[i].setStyle({ fillColor: 'red' })
                selectLayers[i].bringToFront()
            }

            if (!isURLSearch) {
                QueryURL.writeSearchURL(x, SearchTool.lname)
            }
        }

        if (gotoLayers.length > 0) {
            var coordinate = getMapZoomCoordinate(gotoLayers)
            Map_.map.setView(
                [coordinate.latitude, coordinate.longitude],
                coordinate.zoomLevel
            )
        }
    }
}

//Probably better to use a grammar
function makeSearchFields(vars) {
    searchfields = {}
    if (vars.hasOwnProperty('searchfields')) {
        for (layerfield in vars.searchfields) {
            var fieldString = vars.searchfields[layerfield]
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
    }
    return searchfields
}

function getSearchFieldStringForFeature(name, props) {
    var str = ''
    if (SearchTool.searchFields.hasOwnProperty(name)) {
        var sf = SearchTool.searchFields[name] //sf for search field
        for (var i = 0; i < sf.length; i++) {
            switch (sf[i][0].toLowerCase()) {
                case '': //no function
                    str += props[sf[i][1]]
                    break
                case 'round':
                    str += Math.round(props[sf[i][1]])
                    break
                case 'rmunder':
                    str += props[sf[i][1]].replace('_', ' ')
                    break
            }
            if (i != sf.length - 1) str += ' '
        }
    }
    return str
}

function getSearchFieldKeys(name) {
    var str = ''
    if (SearchTool.searchFields.hasOwnProperty(name)) {
        var sf = SearchTool.searchFields[name] //sf for search field
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
        var latitude = layers[i].feature.geometry.coordinates[1]
        var longitude = layers[i].feature.geometry.coordinates[0]

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

export default SearchTool
