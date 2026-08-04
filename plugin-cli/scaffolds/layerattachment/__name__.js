/**
 * __Name__ attachment — built from its host layer's data.
 *
 * Only `make` is required; every other operation falls back to a core default,
 * so write only what differs. See plugins/core/layerattachments/README.md.
 */

// Leaflet is a global the app sets up before any attachment is built. Read it
// per call rather than at import time, so this module can be imported (and unit
// tested) outside the browser.
const leaflet = () => window.L

/**
 * @param {Object} ctx
 * @param {Object} ctx.geojson  The host's features.
 * @param {Object} ctx.layerObj The host layer's config.
 * @param {Object} ctx.config   This attachment's settings, resolved from the
 *   manifest's `configPath` — never read the host's config directly.
 * @returns {Object|false} The attachment, or false to add nothing.
 */
function make(ctx) {
    // TODO: build something from ctx.geojson.
    const layer = leaflet().geoJson(ctx.geojson)

    return {
        // Initially shown unless the host says otherwise.
        on: ctx.config?.initialVisibility !== false,
        // The attachment id — how core dispatches back to this plugin.
        type: '__snake_name__',
        geojson: ctx.geojson,
        layer,
    }
}

/*
 * The rest of the vocabulary, with the default each one replaces. Uncomment only
 * where the default is wrong — an empty implementation silently overrides a
 * working one.
 *
 * syncData(attachment, ctx)        host data changed. Default: clearLayers, then
 *                                  re-add the host's GeoJSON.
 * onConfigChange(ctx)              these settings changed (ctx.config,
 *                                  ctx.prevConfig, ctx.attachment — null when
 *                                  nothing is built). Default: rebuild the host.
 * setVisibility(attachment, ctx)   shown/hidden, with its host or on its own.
 *                                  Default: add to / remove from the map.
 * setOpacity(attachment, o, ctx)   Default: setOpacity, else setStyle.
 * setStyle(attachment, ctx)        feature styles were reset. Default: no-op.
 * destroy(attachment, ctx)         host layer removed for good — release
 *                                  anything held outside the map. Default: no-op.
 * onPeerToggle(attachment, ctx)    some other layer was toggled. Default: no-op.
 * peerFeaturesFor(attachment, ctx) this feature's related features elsewhere.
 * decorateFeature(ctx)             change how the host draws its own feature
 *                                  (a decoration attachment does only this).
 * globeStyle(ctx)                  merged into the host's globe style.
 * makeForFeature(ctx)              a feature was selected and this attachment is
 * clearForFeature(ctx)             configured show: 'click'.
 */
export default {
    make,
}
