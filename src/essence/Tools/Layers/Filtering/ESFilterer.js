// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../../Basics/Formulae_/Formulae_'
import L_ from '../../../Basics/Layers_/Layers_'

const ESFilterer = {
    getAggregations: async function (layerName, config) {
        const results = await ESFilterer.filter(layerName, null, config)
        console.log('RESULTS', results)
        const aggs = {}
        if (results) {
            for (let a in results.aggregations) {
                const flatBuckets = {}
                results.aggregations[a].buckets.forEach((b) => {
                    flatBuckets[b.key] = b.doc_count
                })

                aggs[a] = {
                    aggs: flatBuckets,
                    type: 'string',
                }
            }
        }
        console.log('aggs', aggs)
        return aggs
    },
    filter: async function (layerName, filter, config) {
        return new Promise((resolve, reject) => {
            console.log(layerName, filter, config)

            let aggs = {}
            config.fields = config.fields || {}
            for (let f in config.fields) {
                aggs[f] = {
                    terms: {
                        field: f,
                        size: config.fields[f] || 10,
                    },
                }
            }

            let must = []
            if (config.must) must = must.concat(config.must)
            must = must.concat(ESFilterer.getFilterMust(filter))

            let query = {
                query: {
                    bool: {
                        must: must,
                    },
                },
                aggs: aggs,
                from: 0,
                size: config.size || 500,
                version: true,
            }

            // Spatial Filter
            let spatialFilter
            if (
                config.geoshapeProp &&
                filter.spatial &&
                filter.spatial.center != null &&
                filter.spatial.feature?.geometry?.type != null
            ) {
                if (filter.spatial.radius > 0) {
                    spatialFilter = {
                        geo_shape: {
                            [config.geoshapeProp]: {
                                shape: {
                                    type: filter.spatial.feature.geometry.type.toLowerCase(),
                                    coordinates:
                                        filter.spatial.feature.geometry
                                            .coordinates,
                                    relation: 'intersects',
                                },
                            },
                        },
                    }
                } else {
                    spatialFilter = {
                        geo_shape: {
                            [config.geoshapeProp]: {
                                shape: {
                                    type: 'point',
                                    coordinates: [
                                        filter.spatial.center.lng,
                                        filter.spatial.center.lat,
                                    ],
                                    relation: 'contains',
                                },
                            },
                        },
                    }
                }
            }
            if (spatialFilter) {
                query.query.bool.filter = spatialFilter
            }

            // Format query
            let body = query
            if (config.stringifyBody) body = JSON.stringify(body)

            let finalBody
            if (config.bodyWrapper)
                finalBody = config.bodyWrapper.replace('{BODY}', body)
            else finalBody = body

            // Fetch
            const resp = config.esResponses ? 'responses.' : ''
            fetch(
                `${config.endpoint}?filter_path=${resp}hits.hits._source,${resp}hits.total,${resp}aggregations`,
                {
                    method: 'POST',
                    headers: {
                        accept: 'application/json',
                        ...(config.headers || {}),
                    },
                    credentials: config.withCredentials ? 'include' : '',
                    body: finalBody,
                }
            )
                .then((res) => res.json())
                .then((json) => {
                    console.log(json)
                    const geojson = F_.getBaseGeoJSON()
                    const hits = F_.getIn(json, 'responses.0.hits.hits')
                    hits.forEach((hit) => {
                        const properties = hit._source || {}
                        let geometry
                        for (let p in properties) {
                            if (
                                properties[p] != null &&
                                typeof properties[p] === 'object' &&
                                properties[p].coordinates &&
                                properties[p].type
                            ) {
                                geometry = JSON.parse(
                                    JSON.stringify(properties[p])
                                )
                                delete properties[p]
                                break
                            }
                        }
                        if (geometry)
                            geojson.features.push({
                                type: 'Feature',
                                properties,
                                geometry,
                            })
                    })
                    console.log('geojson', geojson)
                    // Set count
                    $('#layersTool_filtering_count').text(
                        `(${geojson.features.length} out of ${F_.getIn(
                            json,
                            'responses.0.hits.total',
                            0
                        )})`
                    )

                    // Update layer
                    L_.clearVectorLayer(layerName)
                    L_.updateVectorLayer(layerName, geojson)

                    resolve(F_.getIn(json, 'responses.0'))
                })
                .catch((err) => {
                    console.log(err)
                    resolve()
                })
        })
    },
    getFilterMust: function (filter) {
        let must = []
        if (filter && filter.values && filter.values.length > 0) {
            filter.values.forEach((v) => {
                switch (v.op) {
                    case '=':
                        must.push({
                            match: {
                                [v.key]: v.value,
                            },
                        })
                        break
                    case '>':
                        must.push({
                            range: {
                                [v.key]: {
                                    gt: v.value,
                                },
                            },
                        })
                        break
                    case '<':
                        must.push({
                            range: {
                                [v.key]: {
                                    lt: v.value,
                                },
                            },
                        })
                        break
                    default:
                        break
                }
            })
        }
        return must
    },
}

export default ESFilterer
