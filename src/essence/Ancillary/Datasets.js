import F_ from '../Basics/Formulae_/Formulae_'
import calls from '../../pre/calls'

const Datasets = {
    populateFromDataset(layer, cb) {
        if (
            layer.options.layerName &&
            L_.layers.data[layer.options.layerName] &&
            L_.layers.data[layer.options.layerName].variables &&
            L_.layers.data[layer.options.layerName].variables.datasetLinks
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

export default Datasets
