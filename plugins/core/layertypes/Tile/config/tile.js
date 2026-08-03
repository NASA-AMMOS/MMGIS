import F_ from '@basics/Formulae_/Formulae_'

/**
 * `config.normalize` — the type's own config defaults, applied during mission
 * config parsing before core reads the layer object. Tiles served through
 * MMGIS' own tile server are always WMTS regardless of what the config said.
 */
function normalize(layerObj) {
    if (layerObj.throughTileServer === true) layerObj.tileformat = 'wmts'
    return layerObj
}

/**
 * `config.resolveUrl` — the type gets the last word on its resolved url, after
 * core has expanded STAC, stripped `COG:` and made mission-relative paths
 * absolute. Tiles read back out of MMGIS' own tile server are requested
 * relative to the tile endpoint, which sits two levels deeper than the app
 * root (and at the root under Docker).
 */
function resolveUrl(url, layerObj, ctx = {}) {
    const throughTileServer =
        (layerObj && layerObj.throughTileServer === true) || ctx.wasCOG === true
    if (!throughTileServer || F_.isUrlAbsolute(url)) return url

    return window.mmgisglobal.IS_DOCKER === 'true' ? `/${url}` : `../../${url}`
}

export default {
    normalize,
    resolveUrl,
}
