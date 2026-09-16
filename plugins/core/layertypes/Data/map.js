/**
 * Data layer type — map renderer.
 *
 * Renders a numeric raster as WebGL-shaded tiles on the 2D map. Values are
 * decoded client-side (NPY/float-RGBA) and colorized by a DataShaders fragment
 * shader. All URL resolution (COG:/stac-collection: via TiTiler, TMS/WMTS) is
 * engine-neutral plain JS and lives here; the Leaflet `L.tileLayer.gl`
 * construction rides through the MapRenderer escape hatch (`mctx.raw`).
 *
 * Frozen renderer interface:
 *   ctx = { evenIfOff, forceGeoJSON, isRefresh, mapContext, resolvedUrl }
 */
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import { transformStacUrl } from '@basics/Layers_/LayerUtils'
import DataShaders from '@essence/services/DataShaders'

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const L = mctx.raw

    // COG:/stac-collection: prefixes (or demSourceType field) — serve 32-bit float
    // tiles via TiTiler. leaflet.tilelayer.gl decodes client-side (NPY preferred)
    // and encodes as RGBA float so the colorize shader works unchanged.
    // TiTiler uses XYZ (tms: false); non-TiTiler sources use TMS (tms: true).
    const demUrl = layerObj.demtileurl || ''
    const demSourceType = layerObj.demSourceType || ''
    // Detect COG: either explicit prefix or demSourceType field set to 'COG'
    const isCogSource =
        demUrl.startsWith('COG:') ||
        (demSourceType === 'COG' &&
            !demUrl.startsWith('stac-collection:') &&
            !demUrl.startsWith('http'))
    // Detect stac-collection: either explicit prefix or demSourceType field
    const isStacSource =
        demUrl.startsWith('stac-collection:') ||
        demSourceType === 'stac-collection'
    let layerUrl
    let isTiTilerSource = false
    if (isCogSource) {
        isTiTilerSource = true
        // Strip 'COG:' prefix if present, otherwise use the path as-is
        let cogUrl = demUrl.startsWith('COG:') ? demUrl.slice(4) : demUrl
        if (!F_.isUrlAbsolute(cogUrl)) {
            // Prepend mission directory for relative paths (same as L_.getUrl)
            cogUrl = L_.missionPath + cogUrl
        }
        if (!F_.isUrlAbsolute(cogUrl)) {
            // Pass a TiTiler-relative path (../../ reaches the project root
            // where Missions/ lives); in Docker use an absolute /path instead
            cogUrl =
                window.mmgisglobal.IS_DOCKER === 'true'
                    ? `/${cogUrl}`
                    : `../../${cogUrl}`
        }
        const origin = window.location.origin
        const pathname = (window.location.pathname || '').replace(/\/$/g, '')
        const baseUrl = `${origin}${pathname}`
        const bidx = (layerObj.cogBands && layerObj.cogBands[0]) || 1
        const nodata =
            layerObj.cogNodata != null ? `&nodata=${layerObj.cogNodata}` : ''
        const tms = layerObj.tileMatrixSet || 'WebMercatorQuad'
        const parser = layerObj.demparser || 'npy'
        let tileBase
        if (parser === 'terrarium') {
            tileBase = `${baseUrl}/titiler/cog/tiles/${tms}/{z}/{x}/{y}.png?algorithm=terrarium`
        } else if (parser === 'terrainrgb') {
            tileBase = `${baseUrl}/titiler/cog/tiles/${tms}/{z}/{x}/{y}.png?algorithm=terrainrgb`
        } else {
            tileBase = `${baseUrl}/titiler/cog/tiles/${tms}/{z}/{x}/{y}.npy`
        }
        const qsep = tileBase.includes('?') ? '&' : '?'
        layerUrl = `${tileBase}${qsep}url=${encodeURIComponent(cogUrl)}&bidx=${bidx}${nodata}`
    } else if (isStacSource) {
        isTiTilerSource = true
        // For stac-collection without prefix, normalise to stac-collection:{name}
        const normUrl = demUrl.startsWith('stac-collection:')
            ? demUrl
            : `stac-collection:${demUrl}`
        layerUrl = transformStacUrl(normUrl, layerObj, 'terrain', window.location)
    } else {
        layerUrl = L_.getUrl(layerObj.type, demUrl, layerObj)
    }

    let bb = null
    if (layerObj.hasOwnProperty('boundingBox')) {
        bb = L.latLngBounds(
            L.latLng(layerObj.boundingBox[3], layerObj.boundingBox[2]),
            L.latLng(layerObj.boundingBox[1], layerObj.boundingBox[0])
        )
    }

    const shader = { ...(F_.getIn(layerObj, 'variables.shader') || {}) }
    const shaderType = shader.type || 'image'

    // For terrarium tiles, auto-inject -32768 as a no-data sentinel.
    // TiTiler encodes no-data pixels as R=G=B=0 which decodes to exactly -32768 in terrarium.
    // Adding it to noDataValues causes the GLSL nodatavalue check to render those pixels
    // transparent AND causes the JS min/max loop to skip them, keeping the color scale clean.
    if (
        (isCogSource || isStacSource) &&
        (layerObj.demparser || 'npy') === 'terrarium'
    ) {
        const ndv = shader.noDataValues ? shader.noDataValues.map(Number) : []
        if (!ndv.includes(-32768)) ndv.push(-32768)
        shader.noDataValues = ndv
    }
    if (
        (isCogSource || isStacSource) &&
        (layerObj.demparser || 'npy') === 'terrainrgb'
    ) {
        const ndv = shader.noDataValues ? shader.noDataValues.map(Number) : []
        if (!ndv.includes(-10000)) ndv.push(-10000)
        shader.noDataValues = ndv
    }

    var uniforms = {}
    for (let i = 0; i < DataShaders[shaderType].settings.length; i++) {
        uniforms[DataShaders[shaderType].settings[i].parameter] =
            DataShaders[shaderType].settings[i].value
    }

    L_.layers.layer[layerObj.name] = L.tileLayer.gl({
        // Always use standard 256px Leaflet tile grid so {z}/{x}/{y} coordinates
        // stay within the TMS spec. cogTileSize only controls TiTiler's output
        // pixel dimensions (width/height params) — the smaller raster is
        // upscaled to 256px by the WebGL texture sampler.
        bounds: bb,
        options: {
            tms: !isTiTilerSource,
            bounds: bb,
        },
        fragmentShader: DataShaders[shaderType].frag,
        tileUrls: [layerUrl],
        pixelPerfect: true,
        uniforms: uniforms,
    })

    // Time-enabled data/GL layers should never fade
    if (layerObj.time && layerObj.time.enabled === true) {
        L_.layers.layer[layerObj.name]._noFade = true
    }

    if (DataShaders[shaderType].attachImmediateEvents) {
        DataShaders[shaderType].attachImmediateEvents(layerObj.name, shader)
    }

    L_.setLayerOpacity(layerObj.name, L_.layers.opacity[layerObj.name])

    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
    L_.Map_.allLayersLoaded()
}

export default {
    make,
}
