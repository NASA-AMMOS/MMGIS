import F_ from '../Formulae_/Formulae_'

export const parseExtendedGeoJSON = (geojson, parsers) => {
    parsers = parsers || []
    parsers.forEach((k) => {
        switch (k) {
            case 'coord_properties':
                geojson = parseCoordProperties(geojson)
                break
        }
    })

    return geojson
}

const parseCoordProperties = (geojson) => {
    const parsedFeatures = []

    let features = []
    if (geojson.features) {
        features = geojson.features
    } else if (geojson.geometry) {
        features = [geojson]
    }

    const globalCoordProps = geojson.coord_properties || null

    for (let i = 0; i < features.length; i++) {
        const coordProps = F_.getIn(
            features[i],
            'properties.coord_properties',
            globalCoordProps
        )
        if (coordProps) {
            let props = JSON.parse(JSON.stringify(features[i].properties))
            delete props.coord_properties

            F_.coordinateDepthTraversal(
                features[i].geometry.coordinates,
                (array) => {
                    parsedFeatures.push({
                        type: 'Feature',
                        properties: {
                            ...props,
                            ...F_.stitchArrays(coordProps, array),
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: array.slice(0, 3),
                        },
                    })
                }
            )
        } else {
            parsedFeatures.push(features[i])
        }
    }

    return F_.getBaseGeoJSON(parsedFeatures)
}

export const getCoordProperties = (geojson, feature, coordArray) => {
    const globalCoordProps = geojson.coord_properties || null
    const coordProps = F_.getIn(
        feature,
        'properties.coord_properties',
        globalCoordProps
    )

    if (coordProps) {
        let props = JSON.parse(JSON.stringify(feature.properties))
        delete props.coord_properties

        return {
            ...props,
            ...F_.stitchArrays(coordProps, coordArray),
        }
    } else {
        return feature.properties
    }
}
