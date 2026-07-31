import F_ from '../../Formulae_/Formulae_'

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
        const stacRegex = /^stac(-((item)|(catalog)|(collection)))?:/i

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

            // check if this is a vector STAC catalog or collection
            // if so, prefetch the data and replace this entry
            if (d[i].type === 'vector' && stacRegex.test(d[i].url)) {
                d[i] = await getSTACLayers(d[i])
            }

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

            // Set default kind to 'none'
            if (
                d[i].type === 'vector' ||
                d[i].type === 'vectortile' ||
                d[i].type === 'query'
            ) {
                L_.layers.data[d[i].name].kind = d[i].kind || 'none'
            }
            if (d[i].type === 'vector') {
                d[i].radius = d[i].style?.radius || d[i].radius || 8
            }

            //Check if it's not a header and thus an actual layer with data
            if (d[i].type != 'header') {
                //Create parsed layers ordered
                L_._layersOrdered.push(d[i].name)
                //Create parsed layers loaded
                if (
                    d[i].type != 'data' &&
                    d[i].type != 'model' &&
                    d[i].type != '3dtiles'
                )
                    //No load checking for model/3dtiles since they are globe only
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

                if (d[i].type === 'tile' && d[i].throughTileServer === true) {
                    d[i].tileformat = 'wmts'
                }
            }

            //Create parsed layers data
            L_.layers.dataFlat.push(d[i])

            //Create parsed toggled array based on config layer visibility
            L_.layers.on[d[i].name] =
                d[i].visibility == undefined ? true : d[i].visibility

            // Headers always start as true
            // Toggling header visibility toggles between all-off and previous-on states
            if (d[i].type === 'header') L_.layers.on[d[i].name] = true

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
                expandLayers(dNext, level + 1, d[i].name)
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

    // recurse through a STAC layer building sublayers
    function getSTACLayers(d) {
        return new Promise(async (resolve, reject) => {
            let stac_data
            const stacRegex =
                /^(?<prefix>stac(-((item)|(catalog)|(collection)))?:)?(?<url>.*)/i
            const urlMatch = d.url.match(stacRegex)
            if (!urlMatch) {
                console.warn('Could not process STAC URL')
                resolve(d)
            }
            const { prefix, url } = urlMatch.groups
            d.url = url // replace the current URL so we no longer need to worry about the special prefix
            if (prefix !== 'stac-item:') {
                $.ajax({
                    url: L_.getUrl('stac', d.url, d),
                    success: async (resp) => {
                        stac_data = resp
                        const path = d.url.split('/').slice(0, -1).join('/')
                        const basename = F_.fileNameFromPath(d.url)
                        const stac_type = stac_data.type.toLowerCase()
                        if (stac_type === 'catalog') {
                            let sublayers = []
                            const children = stac_data.links.filter((l) =>
                                /^child/i.test(l.rel)
                            )
                            const promArr = []
                            for (let i = 0; i < children.length; i++) {
                                const uuid = `${d.uuid}-${i}`
                                promArr.push(
                                    getSTACLayers(
                                        Object.assign({}, d, {
                                            url: children[i].href.replace(
                                                './',
                                                `${path}/`
                                            ),
                                            display_name:
                                                children[i].title ||
                                                F_.fileNameFromPath(
                                                    children[i].href
                                                ),
                                            uuid: uuid,
                                            name: uuid,
                                        })
                                    )
                                )
                            }

                            try {
                                const subls = await Promise.all(promArr)
                                sublayers = sublayers.concat(subls)
                            } catch (err) {
                                console.warn(err)
                                resolve(d)
                            }

                            resolve(
                                Object.assign(
                                    {
                                        type: 'header',
                                        sublayers,
                                        description: '',
                                        display_name: '',
                                        name: '',
                                        uuid: '',
                                    },
                                    {
                                        description: d.description,
                                        display_name:
                                            d.display_name || basename,
                                        name: d.name,
                                        uuid: d.uuid,
                                    }
                                )
                            )
                        } else if (stac_type === 'collection') {
                            const sublayers = []
                            const items = stac_data.links.filter((l) =>
                                /^item/i.test(l.rel)
                            )
                            for (let i = 0; i < items.length; i++) {
                                const uuid = `${d.uuid}-${i}`
                                sublayers.push(
                                    // we shouldn't need to pre-fetch item data
                                    Object.assign({}, d, {
                                        url: items[i].href.replace(
                                            './',
                                            `${path}/`
                                        ),
                                        display_name:
                                            items[i].title ||
                                            F_.fileNameFromPath(items[i].href),
                                        uuid: uuid,
                                        name: uuid,
                                    })
                                )
                            }
                            resolve(
                                Object.assign(
                                    {
                                        type: 'header',
                                        sublayers,
                                        description: '',
                                        display_name: '',
                                        name: '',
                                        uuid: '',
                                    },
                                    {
                                        description: d.description,
                                        display_name:
                                            d.display_name || basename,
                                        name: d.name,
                                        uuid: d.uuid,
                                    }
                                )
                            )
                        } else if (/^feature(collection)?$/i.test(stac_type)) {
                            resolve(
                                Object.assign({}, d, {
                                    display_name: d.display_name || basename,
                                })
                            )
                        } else {
                            console.warn('Could not process STAC layer')
                            resolve(d)
                        }
                    },
                    error: (resp) => {
                        console.warn(resp)
                        resolve(d)
                    },
                })
            } else {
                resolve(d)
            }
        })
    }
}
