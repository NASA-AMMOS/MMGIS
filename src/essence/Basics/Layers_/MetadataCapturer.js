import F_ from '../Formulae_/Formulae_'
import calls from '../../../pre/calls'

const MetadataCapturer = {
    populateMetadata(layer, cb) {
        try {
            // Array to hold active promises
            const promises = []

            // Conditionally add functionA's promise
            if (
                layer.options.layerName &&
                L_.layers.data[layer.options.layerName] &&
                L_.layers.data[layer.options.layerName].variables &&
                L_.layers.data[layer.options.layerName].variables
                    .getFeaturePropertiesOnClick === true &&
                L_.layers.data[layer.options.layerName].url.indexOf(
                    'geodatasets:'
                ) != -1 &&
                layer.feature.properties._?.idx != null
            ) {
                promises.push(
                    new Promise((resolve) => {
                        MetadataCapturer.populateFromGeoDataset(layer, resolve)
                    })
                )
            }

            // Conditionally add functionB's promise
            if (
                layer.options.layerName &&
                L_.layers.data[layer.options.layerName] &&
                L_.layers.data[layer.options.layerName].variables &&
                L_.layers.data[layer.options.layerName].variables
                    .datasetLinks &&
                L_.layers.data[layer.options.layerName].variables.datasetLinks
                    .length > 0
            ) {
                promises.push(
                    new Promise((resolve) => {
                        MetadataCapturer.populateFromDataset(layer, resolve)
                    })
                )
            }

            // Wait for all selected promises
            Promise.all(promises)
                .then(() => {
                    cb()
                })
                .catch((err) => {
                    console.error('MetadataCapturer Error (1):', err)
                    cb()
                })
        } catch (err) {
            console.error('MetadataCapturer Error (1):', err)
            cb() // Pass error to callback if needed
        }
    },
    populateFromGeoDataset(layer, cb) {
        const layerData = L_.layers.data[layer.options.layerName]
        if (
            layer.options.layerName &&
            layerData &&
            layerData.variables &&
            layerData.variables.getFeaturePropertiesOnClick === true &&
            layerData.url.indexOf('geodatasets:') != -1 &&
            layer.feature.properties._?.idx != null
        ) {
            const urlSplit = layerData.url.split(':')

            let body = {
                layer: urlSplit[1],
                type: 'geojson',
                group_id: layer.feature.properties.group_id,
                id: layer.feature.properties._.idx,
            }

            // time
            if (layerData.time?.enabled === true) {
                body.starttime = layerData.time.start
                body.startProp = layerData.time.startProp
                body.endtime = layerData.time.end
                body.endProp = layerData.time.endProp
            }

            // filters
            if (layerData._filterEncoded?.filters)
                body.filters = layerData._filterEncoded.filters
            if (layerData._filterEncoded?.spatialFilter)
                body.spatialFilter = layerData._filterEncoded.spatialFilter

            calls.api(
                'geodatasets_get',
                body,
                function (data) {
                    if (data?.features) {
                        const d = data.features
                        const results = []
                        for (let i = 0; i < d.length; i++) {
                            results.push(d[i].properties)
                        }

                        layer.feature.properties._geodataset = {
                            prop: data.feature_id_field || '_.idx',
                            results: results,
                        }
                    }
                    if (cb != null && typeof cb === 'function') cb()
                },
                function (data) {
                    if (cb != null && typeof cb === 'function') cb()
                }
            )
        } else {
            if (cb != null && typeof cb === 'function') cb()
        }
    },
    populateFromDataset(layer, cb) {
        if (
            layer.options.layerName &&
            L_.layers.data[layer.options.layerName] &&
            L_.layers.data[layer.options.layerName].variables &&
            L_.layers.data[layer.options.layerName].variables.datasetLinks &&
            L_.layers.data[layer.options.layerName].variables.datasetLinks
                .length > 0
        ) {
            const dl =
                L_.layers.data[layer.options.layerName].variables.datasetLinks
            let dlFilled = dl
            for (let i = 0; i < dlFilled.length; i++) {
                dlFilled[i].search = F_.getIn(
                    layer.feature.properties,
                    dlFilled[i].prop.split('.')
                )
            }

            calls.api(
                'datasets_get',
                {
                    queries: JSON.stringify(dlFilled),
                },
                function (data) {
                    const d = data.body
                    for (let i = 0; i < d.length; i++) {
                        if (d[i].type == 'images') {
                            layer.feature.properties.images =
                                layer.feature.properties.images || []
                            for (let j = 0; j < d[i].results.length; j++) {
                                layer.feature.properties.images.push(
                                    d[i].results[j]
                                )
                            }
                            //remove duplicates
                            layer.feature.properties.images =
                                F_.removeDuplicatesInArrayOfObjects(
                                    layer.feature.properties.images
                                )
                        } else {
                            layer.feature.properties._dataset = {
                                prop: dlFilled[i].displayProp || d[i].prop,
                                results: d[i].results,
                            }
                        }
                    }
                    if (cb != null && typeof cb === 'function') cb()
                },
                function (data) {
                    if (cb != null && typeof cb === 'function') cb()
                }
            )
        } else {
            if (cb != null && typeof cb === 'function') cb()
        }
    },
}

export default MetadataCapturer
