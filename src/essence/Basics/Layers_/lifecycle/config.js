import F_ from '../../Formulae_/Formulae_'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'

import $ from 'jquery'

//Takes in a configData object and does a depth-first search through its
// layers and sets L_ variables
export async function parseConfig(L_, configData, urlOnLayers) {
    //Create parsed configData
    L_.configData = configData

    //find zero resolution
    if (
        L_.configData.projection &&
        L_.configData.projection.resunitsperpixel &&
        L_.configData.projection.reszoomlevel != null
    ) {
        var baseRes =
            L_.configData.projection.resunitsperpixel *
            Math.pow(2, L_.configData.projection.reszoomlevel)
        var res = []
        for (var i = 0; i < 32; i++) {
            res.push(baseRes / Math.pow(2, i))
        }
        L_.configData.projection.res = res
    }
    //Make bounds and origin floats
    if (L_.configData.projection && L_.configData.projection.bounds) {
        for (var i in L_.configData.projection.bounds)
            L_.configData.projection.bounds[i] = parseFloat(
                L_.configData.projection.bounds[i]
            )
    }
    if (L_.configData.projection && L_.configData.projection.origin) {
        for (var i in L_.configData.projection.origin)
            L_.configData.projection.origin[i] = parseFloat(
                L_.configData.projection.origin[i]
            )
    }

    // Use DB mission name for L_.mission (for deeplinks)
    // This will be set from the API response's mission field
    // For now, keep backward compatibility
    L_.mission = L_.configData._dbMissionName || L_.configData.msv.mission
    L_.recentMissions.unshift(L_.mission)
    // Use missionFolderName if available, otherwise fallback to msv.mission
    L_.missionFolderName =
        L_.configData.msv.missionFolderName || L_.configData.msv.mission
    L_.missionPath = 'Missions/' + L_.missionFolderName + '/'
    L_.site = L_.configData.msv.site

    L_.view = [
        parseFloat(L_.configData.msv.view[0]),
        parseFloat(L_.configData.msv.view[1]),
        parseInt(L_.configData.msv.view[2]),
    ]
    if (isNaN(L_.view[0])) L_.view[0] = 0
    if (isNaN(L_.view[1])) L_.view[1] = 0
    if (isNaN(L_.view[2])) L_.view[2] = 0

    L_.radius = L_.configData.msv.radius
    L_.masterdb = L_.configData.msv.masterdb || false

    // Remove tools that start have on: false (on null still allowed)
    L_.tools = []
    L_.configData.tools.forEach((t) => {
        if (t.on !== false) L_.tools.push(t)
    })

    if (L_.configData?.panels?.length != null) {
        L_.hasMap = L_.configData.panels.indexOf('map') > -1
        L_.hasMap = true //Should always have map;
        L_.hasViewer = L_.configData.panels.indexOf('viewer') > -1
        L_.hasGlobe = L_.configData.panels.indexOf('globe') > -1
    } else {
        L_.hasViewer = L_.configData.panels.viewer === true
        L_.hasGlobe = L_.configData.panels.globe === true
    }
    //We only care about the layers now
    const layers = L_.configData.layers

    //Begin recursively going through those layers
    await expandLayers(layers, 0, null)

    async function expandLayers(d, level, prevName) {
        //Iterate over each layer
        for (let i = 0; i < d.length; i++) {
            // If sourceType, prefix onto url
            if (
                d[i].sourceType != null &&
                d[i].sourceType !== 'url' &&
                d[i].url.indexOf(`${d[i].sourceType}:`) !== 0
            ) {
                d[i].url = `${d[i].sourceType}:${d[i].url}`
            }

            // One configured layer may describe more than one layer (a STAC
            // catalog becomes a header with a sublayer per child). Only the
            // layer type knows, so ask it — a type that declares no `expand`
            // keeps its entry unchanged, and parsing stays synchronous (core
            // reads dataFlat as soon as parseConfig resolves).
            const configModule = LayerTypeRegistry.get(d[i].type)?.config
            if (LayerInterface.hasOp(configModule, 'expand'))
                d[i] =
                    (await LayerInterface.run(configModule, 'expand', [
                        d[i],
                    ])) || d[i]

            // Quick hack to use uuid instead of name as main id
            d[i].uuid = d[i].uuid || d[i].name
            if (L_.layers.nameToUUID[d[i].name] == null)
                L_.layers.nameToUUID[d[i].name] = []

            if (!L_.layers.nameToUUID[d[i].name].includes(d[i].uuid)) {
                L_.layers.nameToUUID[d[i].name].push(d[i].uuid)
            }
            d[i] = { display_name: d[i].name, ...d[i] }
            d[i].name = d[i].uuid || d[i].name

            // Create parsed layers named
            L_.layers.data[d[i].name] = d[i]

            if (d[i].display_name === 'TimeCogs') {
                d[i].time.current = '2025-02-12T01:20:55Z'
                d[i].time.start = ''
                d[i].time.end = ''
                d[i].time.startProp = ''
                d[i].time.endProp = ''
                d[i].time.refresh = '1 hours'
                d[i].time.increment = '5 minutes'
            }

            if (
                d[i].time &&
                d[i].time.enabled === true &&
                d[i].time.refreshIntervalEnabled === true
            ) {
                if (L_.layers.refreshIntervals[d[i].name])
                    clearInterval(L_.layers.refreshIntervals[d[i].name])
                L_.layers.refreshIntervals[d[i].name] = setInterval(
                    async () => {
                        if (L_.layers.on[d[i].name] === true) {
                            let savedActiveFeature
                            if (
                                L_.activeFeature &&
                                L_.activeFeature.layerName === d[i].name
                            ) {
                                savedActiveFeature = {
                                    layerName: L_.activeFeature.layerName,
                                    feature: JSON.parse(
                                        JSON.stringify(L_.activeFeature.feature)
                                    ),
                                }
                            }
                            await L_.TimeControl_.reloadLayer(
                                d[i].name,
                                false,
                                false,
                                true,
                                true
                            )
                            // Reselect activeFeature
                            if (
                                savedActiveFeature &&
                                savedActiveFeature.layerName === d[i].name
                            ) {
                                L_.selectFeature(
                                    savedActiveFeature.layerName,
                                    savedActiveFeature.feature
                                )
                            }
                        }
                    },
                    (d[i].time.refreshIntervalAmount || 60) * 1000
                )
            }
            //Save the prevName for easy tracing back
            L_._layersParent[d[i].name] = prevName

            // The layer type fills in its own config defaults (kind, radius,
            // tile format…) — `config.normalize` gets the last word on the
            // config object before core reads it.
            d[i] =
                LayerInterface.runSync(
                    LayerTypeRegistry.get(d[i].type)?.config,
                    'normalize',
                    [d[i]],
                    { coreDefault: (layerObj) => layerObj }
                ) || d[i]
            L_.layers.data[d[i].name] = d[i]

            //Structural layers organize the tree; everything else has data
            if (!LayerTypeRegistry.isStructural(d[i].type)) {
                //Create parsed layers ordered
                L_._layersOrdered.push(d[i].name)
                //Create parsed layers loaded. A type that never loads on the 2D
                //map (globe-only, or progressive) counts as loaded immediately.
                if (LayerTypeRegistry.tracksMapLoad(d[i].type))
                    L_._layersLoaded.push(false)
                else L_._layersLoaded.push(true)

                //relative or full path?
                let legendPath = d[i].legend
                if (d[i]?.variables?.legend) {
                    L_.layers.data[d[i].name]._legend = d[i].variables.legend
                } else if (legendPath != undefined) {
                    if (!F_.isUrlAbsolute(legendPath))
                        legendPath = L_.missionPath + legendPath
                    $.get(
                        legendPath,
                        (function (name) {
                            return function (data) {
                                data = F_.csvToJSON(data)
                                L_.layers.data[name]._legend = data
                            }
                        })(d[i].name)
                    )
                }

                // Set disabled time object if missing
                if (d[i].time == null) {
                    d[i].time = { enabled: false }
                }
            }

            //Create parsed layers data
            L_.layers.dataFlat.push(d[i])

            //Create parsed toggled array based on config layer visibility
            L_.layers.on[d[i].name] =
                d[i].visibility == undefined ? true : d[i].visibility

            // Structural layers (headers) always start as true
            // Toggling header visibility toggles between all-off and previous-on states
            if (LayerTypeRegistry.isStructural(d[i].type))
                L_.layers.on[d[i].name] = true

            //Create parsed opacity array
            let io = d[i].initialOpacity
            L_.layers.opacity[d[i].name] =
                io == null || io < 0 || io > 1 ? 1 : io

            //Set visibility if we have all the on layers listed in the url
            if (urlOnLayers) {
                //this is null if we've no url layers
                let standardId = null
                if (urlOnLayers.onLayers.hasOwnProperty(d[i].name))
                    standardId = d[i].name
                else if (urlOnLayers.onLayers.hasOwnProperty(d[i].display_name))
                    standardId = d[i].display_name
                if (standardId != null) {
                    L_.layers.on[d[i].name] = true
                    L_.layers.opacity[d[i].name] =
                        urlOnLayers.onLayers[standardId].opacity || 1
                } else if (urlOnLayers.method == 'replace') {
                    L_.layers.on[d[i].name] = false
                }
            }
            //Get the current layers sublayers (returns 0 if none)
            var dNext = getSublayers(d[i])
            //If they are sublayers, call this function again and move up a level
            if (dNext != 0) {
                await expandLayers(dNext, level + 1, d[i].name)
            }
        }
    }
    //Get the current layers sublayers (returns 0 if none)
    function getSublayers(d) {
        //If object d has a sublayers property, return it
        if (d.hasOwnProperty('sublayers')) {
            return d.sublayers
        }
        //Otherwise return 0
        return 0
    }

}
