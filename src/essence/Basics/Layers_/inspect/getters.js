import F_ from '../../Formulae_/Formulae_'

import { transformStacUrl } from '../LayerUtils'

export function getUrl(L_, type, url, layerData) {
    let wasCOG = false

    let nextUrl = url

    // Handle STAC collection URLs using shared transformation function
    if (
        nextUrl != null &&
        nextUrl.toLowerCase().startsWith('stac-collection:')
    ) {
        nextUrl = transformStacUrl(
            nextUrl,
            layerData,
            type,
            window.location
        )
        // After transformation, nextUrl is now an absolute HTTP URL
    }

    if (nextUrl != null && nextUrl.startsWith('COG:')) {
        nextUrl = nextUrl.slice(4)
        wasCOG = true
    }
    if (!F_.isUrlAbsolute(nextUrl)) {
        nextUrl = L_.missionPath + nextUrl
    }
    if (
        type === 'tile' &&
        ((layerData && layerData.throughTileServer === true) ||
            wasCOG == true)
    ) {
        if (
            !F_.isUrlAbsolute(nextUrl) &&
            window.mmgisglobal.IS_DOCKER !== 'true'
        ) {
            nextUrl = `../../${nextUrl}`
        } else if (
            !F_.isUrlAbsolute(nextUrl) &&
            window.mmgisglobal.IS_DOCKER === 'true'
        ) {
            nextUrl = `/${nextUrl}`
        }
    }
    return nextUrl
}

export function hasTool(L_, toolName) {
    for (var i = 0; i < L_.tools.length; i++) {
        if (
            L_.tools[i].hasOwnProperty('name') &&
            L_.tools[i].name.toLowerCase() == toolName
        )
            return true
    }
    return false
}

export function getToolVars(L_, toolName, withVarsFromLayers, showWarnings) {
    let vars = {}
    for (var i = 0; i < L_.tools.length; i++) {
        if (
            L_.tools[i].hasOwnProperty('name') &&
            L_.tools[i].name.toLowerCase() == toolName &&
            L_.tools[i].hasOwnProperty('variables')
        ) {
            vars = L_.tools[i].variables
        }
    }
    if (withVarsFromLayers) {
        vars.__layers = {}
        L_.layers.dataFlat.forEach((d) => {
            if (d.name != null && d?.variables?.tools?.[toolName] != null) {
                vars.__layers[d.name] = d.variables.tools[toolName]
            }
        })
    }
    if (Object.keys(vars).length > 0) return vars
    if (showWarnings)
        console.warn(
            `WARNING: Tried to get ${toolName} Tool's config variables and failed.`
        )
    return { __noVars: true }
}

// Returns any array of all the "fromProp"-like configuration fields for a layer
export function getDynamicProps(L_, layerData) {
    let dynamicProps = []
    if (layerData?.style) {
        Object.keys(layerData.style).forEach((key) => {
            if (key.endsWith('Prop'))
                dynamicProps.push(layerData.style[key])
        })
    }
    if (layerData?.variables?.useKeyAsName) {
        const keyNames = (
            typeof layerData.variables.useKeyAsName === 'string'
                ? [layerData.variables.useKeyAsName]
                : layerData.variables.useKeyAsName
        ).filter((k) => k != null && k !== '')
        dynamicProps = dynamicProps.concat(keyNames)
    }
    return dynamicProps
}

export function asLayerUUID(L_, uuid) {
    if (L_.layers.data[uuid] != null) return uuid
    if (L_.layers.nameToUUID[uuid]?.[0] != null)
        return L_.layers.nameToUUID[uuid][0]
    return null
}

//Specific internal functions likely only to be used once
export function getLayersChosenNamePropVal(L_, feature, layer) {
    //These are what you'd think they'd be (Name could be thought of as key)
    let propertyNames, propertyValues
    let foundThroughVariables = false

    let layerName =
        typeof layer === 'string' ? layer : layer?.options?.layerName
    if (layerName != null) {
        const l = L_.layers.data[layerName]
        if (
            l &&
            l.hasOwnProperty('variables') &&
            l.variables.hasOwnProperty('useKeyAsName')
        ) {
            propertyNames = l.variables['useKeyAsName']
            if (typeof propertyNames === 'string')
                propertyNames = [propertyNames]
            propertyNames = propertyNames.filter(
                (k) => k != null && k !== ''
            )
            propertyValues = Array(propertyNames.length).fill(null)
            propertyNames.forEach((propertyName, idx) => {
                if (
                    feature.properties.hasOwnProperty(propertyName) ||
                    l.getFeaturePropertiesOnClick === true
                ) {
                    propertyValues[idx] = F_.getIn(
                        feature.properties,
                        propertyName
                    )
                    if (propertyValues[idx] != null)
                        foundThroughVariables = true
                }
            })
        }
    }

    // Use first key that is not an object
    if (!foundThroughVariables) {
        for (let key in feature.properties) {
            //Default to show geometry type
            propertyNames = ['Type']
            propertyValues = [feature.geometry.type]

            //Be certain we have that key in the feature
            if (
                feature.properties.hasOwnProperty(key) &&
                (typeof feature.properties[key] === 'string' ||
                    typeof feature.properties[key] === 'number')
            ) {
                //Store the current feature's key
                propertyNames = [key]
                //Store the current feature's value
                propertyValues = [feature.properties[key]]
                //Break out of for loop since we're done
                break
            }
        }
    }
    return F_.stitchArrays(propertyNames, propertyValues)
}

export function propertiesToImages(L_, props, baseUrl) {
    baseUrl = baseUrl || ''
    var images = []
    //Use "images" key first
    if (props.hasOwnProperty('images')) {
        for (var i = 0; i < props.images.length; i++) {
            if (props.images[i].url) {
                var url = baseUrl + props.images[i].url
                if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
                if (props.images[i].isModel) {
                    images.push({
                        url: url,
                        texture: props.images[i].texture,
                        name:
                            (props.images[i].name ||
                                props.images[i].url.match(
                                    /([^\/]*)\/*$/
                                )[1]) + ' [Model]',
                        type: 'model',
                        isPanoramic: false,
                        isModel: true,
                        values: props.images[i].values || {},
                        master: props.images[i].master,
                    })
                } else {
                    // Check if it's a video or gif file
                    const urlLower = url.toLowerCase()
                    const isVideo = urlLower.match(/\.(webm|mp4)$/) != null
                    const isGif = urlLower.match(/\.gif$/) != null

                    if (props.images[i].isPanoramic) {
                        images.push({
                            ...props.images[i],
                            url: url,
                            name:
                                (props.images[i].name ||
                                    props.images[i].url.match(
                                        /([^\/]*)\/*$/
                                    )[1]) + ' [Panoramic]',
                            type: 'photosphere',
                            isPanoramic: true,
                            isModel: false,
                            values: props.images[i].values || {},
                            master: props.images[i].master,
                        })
                    }
                    images.push({
                        url: url,
                        name:
                            (props.images[i].name ||
                                props.images[i].url.match(
                                    /([^\/]*)\/*$/
                                )[1]) +
                            (isVideo ? ' [Video]' : '') +
                            (isGif ? ' [GIF]' : ''),
                        type:
                            props.images[i].type ||
                            (isVideo ? 'video' : 'image'),
                        isPanoramic: false,
                        isModel: false,
                        isVideo: isVideo,
                        isGif: isGif,
                        values: props.images[i].values || {},
                        master: props.images[i].master,
                    })
                }
            }
        }
    }
    //Now search all string valued props for image urls

    for (let p in props) {
        if (
            typeof props[p] === 'string' &&
            props[p].toLowerCase().match(/\.(jpeg|jpg|gif|png|xml)$/) !=
                null
        ) {
            let url = props[p]
            const isGif = url.toLowerCase().match(/\.gif$/) != null
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
            images.push({
                url: url,
                name: p + (isGif ? ' [GIF]' : ''),
                isPanoramic: false,
                isModel: false,
                isGif: isGif,
            })
        } else if (
            typeof props[p] === 'string' &&
            props[p].toLowerCase().match(/\.(pdf)$/) != null
        ) {
            let url = props[p]
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
            images.push({
                url: url,
                name: p,
                type: 'document',
                isPanoramic: false,
                isModel: false,
            })
        } else if (
            typeof props[p] === 'string' &&
            props[p].toLowerCase().match(/\.(webm|mp4)$/) != null
        ) {
            let url = props[p]
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
            images.push({
                url: url,
                name: p + ' [Video]',
                type: 'video',
                isPanoramic: false,
                isModel: false,
                isVideo: true,
            })
        } else if (
            typeof props[p] === 'string' &&
            (props[p].toLowerCase().match(/\.(obj)$/) != null ||
                props[p].toLowerCase().match(/\.(dae)$/) != null)
        ) {
            let url = props[p]
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
            images.push({
                url: url,
                name: p,
                isPanoramic: false,
                isModel: true,
            })
        }
    }

    return images
}

export function getListOfUsedGeoDatasets(L_) {
    const list = []
    Object.keys(L_.layers.data).forEach((key) => {
        const d = L_.layers.data[key]
        if (d.url && d.url.startsWith('geodatasets:'))
            list.push({
                display_name: d.display_name,
                geodataset: d.url.replace('geodatasets:', ''),
            })
    })
    return list
}
