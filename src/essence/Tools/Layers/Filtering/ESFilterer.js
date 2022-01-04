// Part of the LayersTool that deals with filtering

import $ from 'jquery'
import F_ from '../../../Basics/Formulae_/Formulae_'
import L_ from '../../../Basics/Layers_/Layers_'

import flat from 'flat'

const filters = {
    Waypoints: {
        spatial: {
            feature: {},
            operator: 'intersects | contains',
        },
        property: [
            {
                type: 'string | number',
                key: '',
                operator: '<, =, >, []',
                value: '',
            },
        ],
    },
}

const config = {
    type: 'elasticsearch',
    endpoint:
        'https://es-ocs.dev.m20.jpl.nasa.gov/m20-dev-cs3-ocs-es-prod/_msearch',
    bodyFormatter: `{"preference":"site"}\n{BODY}\n`,
    stringifyBody: true,
    headers: {
        'Content-Type': 'application/x-ndjson',
        accept: 'application/json',
    },
    fields: [
        'activity_id_rtt',
        'drive',
        'footprint_derived_from',
        'instrument_id',
        'orbital_index',
        'seq_id_rtt',
        'site',
        'sol',
        'target_id_rtt',
        'target_name_rtt',
        'version',
        'vicar_label.IDENTIFICATION.START_TIME',
    ],
    must: [
        {
            match: {
                ocs_type_name: 'm20-ids-scilo-footprint',
            },
        },
    ],
    size: 1000,
}

const ESFilterer = {
    getAggregations: async function (layerName, config) {
        const results = await ESFilterer.filter(layerName, null, config)

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

        return aggs
    },
    filter: async function (layerName, filter, config) {
        console.log(layerName, filter, config)

        let aggs = {}
        config.fields.forEach((f) => {
            aggs[f] = {
                terms: {
                    field: f,
                    size: 1000,
                },
            }
        })

        let must = []
        if (config.must) must = must.concat(config.must)
        //{ match: { site: 3 } },
        //{ match: { drive: 1374 } },

        let query = {
            query: {
                bool: {
                    must: must,
                },
            },
            aggs: aggs,
            from: 0,
            size: config.size || 1000,
            version: true,
        }

        let body = query
        if (config.stringifyBody) body = JSON.stringify(body)

        let finalBody
        if (config.bodyWrapper)
            finalBody = config.bodyWrapper.replace('{BODY}', body)
        else finalBody = body

        console.log(query, finalBody)
        fetch(config.endpoint, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                credentials: 'include',
                ...(config.headers || {}),
            },
            body: finalBody,
        })
            .then((res) => res.json())
            .then((json) => {
                console.log(json)
                const geojson = F_.getBaseGeoJSON()
                const hits = F_.getIn(json, 'responses.0.hits.hits')
                hits.forEach((hit) => {
                    const properties = hit._source || {}
                    let geometry
                    for (let p in properties) {
                        if (properties[p].coordinates && properties[p].type) {
                            geometry = JSON.parse(JSON.stringify(properties[p]))
                            delete properties[p]
                        }
                    }
                    if (geometry)
                        geojson.features.push({
                            type: 'Feature',
                            properties,
                            geometry,
                        })
                })

                // Set count
                $('#layersTool_filtering_count').text(
                    `${geojson.features.length})`
                )

                // Update layer
                L_.clearVectorLayer(layerName)
                L_.updateVectorLayer(layerName, geojson)
            })
            .catch((err) => {
                console.log(err)
            })

        /*
        // Set count
        $('#layersTool_filtering_count').text(
            `(${filteredGeoJSON.features.length}/${geojson.features.length})`
        )

        // Update layer
        L_.clearVectorLayer(layerName)
        L_.updateVectorLayer(layerName, filteredGeoJSON)
        */
    },
}

export default ESFilterer
