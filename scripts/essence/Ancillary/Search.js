define(['jquery', 'jqueryUI', 'd3', 'Formulae_', 'Description'], function(
    $,
    jqueryUI,
    d3,
    F_,
    Description
) {
    // prettier-ignore
    var markup = [
  "<div id='Search' class='flexbetween' style='height: 100%;'>",
    "<select id='SearchType' class='ui dropdown short searchSelect'></select>",
    "<div>",
        "<input id='auto_search' class='topBarSearch' type='text' placeholder='Search...'></input>",
    "</div>",
    "<div id='SearchClear' style='margin-left: 0;'><i class='mdi mdi-close mdi-18px'></i></div>",
    "<div id='SearchBoth' style='margin-left: 0;'><i class='mdi mdi-magnify mdi-18px'></i></div>",
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
        type: 'geojson',
        lastGeodatasetLayerName: null,
        init: function(classSel, l_, v_, m_, g_) {
            L_ = l_
            Viewer_ = v_
            Map_ = m_
            Globe_ = g_

            //Get search variables
            this.searchvars = {}
            for (let l in L_.layersNamed) {
                if (
                    L_.layersNamed[l].variables &&
                    L_.layersNamed[l].variables.search
                )
                    this.searchvars[l] = L_.layersNamed[l].variables.search
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
        this.separateFromMMWebGIS = function() {
            separateFromMMWebGIS()
        }

        Search.lname = null
        Search.arrayToSearch = []

        var cont = d3.select(classSel)
        if (cont == null) return
        cont.selectAll('*').remove()
        cont.html(markup)

        var first = true
        for (l in Search.searchFields) {
            if (
                L_.layersNamed[l] &&
                (L_.layersNamed[l].type == 'vector' ||
                    L_.layersNamed[l].type == 'vectortile')
            ) {
                d3.select('#SearchType')
                    .append('option')
                    .attr('value', l)
                    .html(l)
                if (first) {
                    changeSearchField(l)
                    first = false
                }
            }
        }
        $('#SearchType').dropdown({
            onChange: function(val) {
                changeSearchField(val)
            },
        })

        d3.select('#SearchGo').on('click', searchGo)
        d3.select('#SearchSelect').on('click', searchSelect)
        d3.select('#SearchClear').on('click', function() {
            $('#auto_search').val('')
        })
        d3.select('#SearchBoth').on('click', searchBoth)

        function separateFromMMWebGIS() {
            d3.select('#SearchGo').on('click', null)
            d3.select('#SearchSelect').on('click', null)
            d3.select('#SearchBoth').on('click', null)
            if ($('#auto_search').hasClass('ui-autocomplete-input')) {
                $('#auto_search').autocomplete('destroy')
            }
        }
    }

    function initializeSearch() {
        $(function() {
            $('#auto_search').autocomplete({
                source: function(request, response) {
                    var re = $.ui.autocomplete.escapeRegex(request.term)
                    var matcher = new RegExp('\\b' + re, 'i')
                    var a = $.grep(Search.arrayToSearch, function(item, index) {
                        return matcher.test(item)
                    })
                    response(a)
                },
                select: function(event, ui) {
                    searchBoth(ui.item.value)
                },
            })
            $('.ui-autocomplete')
                .css({
                    'max-height': '60vh',
                    'overflow-y': 'auto',
                    'overflow-x': 'hidden',
                    border: '1px solid var(--color-mmgis)',
                    'border-top': 'none',
                    'background-color': 'var(--color-a)',
                })
                .addClass('mmgisScrollbar')
        })
    }

    function changeSearchField(val) {
        if (Map_ != null) {
            Search.lname = val

            let urlSplit = L_.layersNamed[Search.lname].url.split(':')

            if (urlSplit[0] == 'geodatasets' && urlSplit[1] != null) {
                Search.type = 'geodatasets'
                Search.lastGeodatasetLayerName = urlSplit[1]
                $('#SearchSelect').css({ display: 'none' })
                $('#SearchBoth').css({ display: 'none' })
            } else {
                Search.type = 'geojson'
                $('#SearchSelect').css({ display: 'inherit' })
                $('#SearchBoth').css({ display: 'inherit' })

                var searchFile = L_.layersNamed[Search.lname].url

                $.getJSON(L_.missionPath + searchFile, function(data) {
                    Search.arrayToSearch = []
                    var props
                    for (var i = 0; i < data.features.length; i++) {
                        props = data.features[i].properties
                        Search.arrayToSearch.push(
                            getSearchFieldStringForFeature(Search.lname, props)
                        )
                    }
                    if (Search.arrayToSearch[0]) {
                        if (!isNaN(Search.arrayToSearch[0]))
                            Search.arrayToSearch.sort(function(a, b) {
                                return a - b
                            })
                        else Search.arrayToSearch.sort()
                    }
                    if (document.getElementById('auto_search') != null) {
                        document.getElementById(
                            'auto_search'
                        ).placeholder = getSearchFieldKeys(Search.lname)
                    }
                })
            }
            initializeSearch()
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
        doWithSearch('both', 'false', 'false', false, value)
    }

    function searchGeodatasets() {
        let value = document.getElementById('auto_search').value
        let key =
            Search.searchFields[Search.lname] &&
            Search.searchFields[Search.lname][0]
                ? Search.searchFields[Search.lname][0][1]
                : null
        if (key == null) return

        calls.api(
            'geodatasets_search',
            {
                layer: Search.lastGeodatasetLayerName,
                key: key,
                value: value,
            },
            function(d) {
                var r = d.body[0]
                Map_.map.setView(
                    [r.coordinates[1], r.coordinates[0]],
                    Map_.map.getZoom()
                )
                setTimeout(function() {
                    var vts = L_.layersGroup[Search.lname]._vectorTiles
                    for (var i in vts) {
                        for (var j in vts[i]._features) {
                            var feature = vts[i]._features[j].feature
                            if (feature.properties[key] == value) {
                                L_.layersGroup[
                                    Search.lname
                                ]._events.click[0].fn({ layer: feature })
                                break
                            }
                        }
                    }
                }, 2000)
            },
            function(d) {}
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

        var markers = L_.layersGroup[Search.lname]
        var selectLayers = []
        var gotoLayers = []
        var targetsID

        // Turn the layer on if it's off
        if (!L_.toggledArray[Search.lname])
            L_.toggleLayer(L_.layersNamed[Search.lname])

        if (doX == 'both' || doX == 'select') {
            L_.resetLayerFills()
        }
        if (markers != undefined) {
            markers.eachLayer(function(layer) {
                var props = layer.feature.properties
                var clickI = 0
                var shouldSearch = false
                var comparer = getSearchFieldStringForFeature(
                    Search.lname,
                    props
                )

                for (var i = 0; i < x.length; i++) {
                    if (
                        x.length == 1
                            ? x[i].toLowerCase() == comparer.toLowerCase()
                            : x[i]
                                  .toLowerCase()
                                  .indexOf(comparer.toLowerCase()) > -1 ||
                              comparer
                                  .toLowerCase()
                                  .indexOf(x[i].toLowerCase()) > -1
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
                selectLayers[0].fireEvent('click')
            } else if (selectLayers.length > 1) {
                for (var i = 0; i < selectLayers.length; i++) {
                    selectLayers[i].setStyle({ fillColor: 'red' })
                    selectLayers[i].bringToFront()
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
        for (layerfield in vars) {
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
        var str = ''
        if (Search.searchFields.hasOwnProperty(name)) {
            var sf = Search.searchFields[name] //sf for search field
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
            360,
            180,
            90,
            45,
            22.5,
            11.25,
            5.625,
            2.813,
            1.406,
            0.703,
            0.352,
            0.176,
            0.088,
            0.044,
            0.022,
            0.011,
            0.005,
            0.003,
            0.001,
            0.0005,
            0.0003,
            0.0001,
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
                        boundingBoxWest +
                        (boundingBoxEast - boundingBoxWest) / 2,
                    zoomLevel: i,
                }
            }
        }
    }

    return Search
})
