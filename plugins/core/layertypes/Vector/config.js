import $ from 'jquery'

import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'

const STAC_REGEX = /^stac(-((item)|(catalog)|(collection)))?:/i

/**
 * `config.expand` — one configured layer may describe many layers. A vector
 * layer whose url is a STAC catalog or collection is fetched at parse time and
 * replaced by a structural (header) layer whose sublayers are the STAC
 * children; a STAC item resolves to itself. Any other vector layer is returned
 * untouched.
 *
 * Runs during mission config parsing, before `name` is rewritten to the uuid,
 * so the returned object(s) go through the rest of parsing normally.
 */
async function expand(layerObj) {
    if (!STAC_REGEX.test(layerObj.url || '')) return layerObj
    return expandStac(layerObj)
}

// recurse through a STAC layer building sublayers
function expandStac(d) {
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
                                expandStac(
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

/**
 * `config.normalize` — the type's own config defaults, applied during mission
 * config parsing before core reads the layer object.
 */
function normalize(layerObj) {
    layerObj.kind = layerObj.kind || 'none'
    layerObj.radius = layerObj.style?.radius || layerObj.radius || 8
    return layerObj
}

export default {
    expand,
    normalize,
}
