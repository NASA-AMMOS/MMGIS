/**
 * commons/vector — shared, engine-neutral vector-map building logic used by
 * more than one layer-type plugin.
 *
 * Layer-type plugins must be standalone (a plugin must not import another
 * plugin). Both the `vector` and `query` plugins need the same map builder —
 * capture → GeoJSON validation → MapRenderer.addVector — so that logic lives
 * here in core and each plugin imports it from here.
 *
 * `query` reuses this with { useEmptyGeoJSON: true, evenIfOff: false } and no
 * filtering lifecycle; `vector` uses it directly and adds the two-phase
 * filtering hooks in its own module.
 */
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import { captureVector } from '@basics/Layers_/capture/LayerCapturer'
import gjv from 'geojson-validation'

export function makeVectorMap(layerObj, ctx = {}, opts = {}) {
    const {
        evenIfOff,
        forceGeoJSON,
        isRefresh = false,
        mapContext,
        resolvedUrl,
    } = ctx

    const mctx = MapRenderer.context(mapContext)
    const registry = mctx.layerRegistry

    return new Promise((resolve) => {
        if (forceGeoJSON) add(forceGeoJSON)
        else
            captureVector(
                layerObj,
                {
                    evenIfOff:
                        opts.evenIfOff != null ? opts.evenIfOff : evenIfOff,
                    useEmptyGeoJSON: opts.useEmptyGeoJSON,
                    resolvedUrl: resolvedUrl,
                },
                add,
                (f) => {
                    MapRenderer.onViewChange(mctx, f)
                    if (
                        layerObj.time?.enabled === true &&
                        layerObj.controlled !== true
                    )
                        L_.subscribeTimeChange(
                            `dynamicextent_${layerObj.name}`,
                            f
                        )
                    L_.subscribeOnSpecificLayerToggle(
                        `dynamicextent_${layerObj.name}`,
                        layerObj.name,
                        f
                    )
                }
            )

        function add(data, allowInvalid) {
            data = F_.parseIntoGeoJSON(data)

            let invalidGeoJSONTrace = gjv.valid(data, true)
            const allowableErrors = [
                `position must only contain numbers`,
                `coord_properties`,
            ]

            invalidGeoJSONTrace = invalidGeoJSONTrace.filter((t) => {
                if (typeof t !== 'string') return false
                for (let i = 0; i < allowableErrors.length; i++) {
                    if (t.toLowerCase().indexOf(allowableErrors[i]) != -1)
                        return false
                }
                return true
            })
            if (
                data == null ||
                data === 'off' ||
                (invalidGeoJSONTrace.length > 0 && allowInvalid !== true)
            ) {
                if (data != null && data != 'off') {
                    data = null
                    console.warn(
                        `ERROR: ${layerObj.display_name} has invalid GeoJSON!`,
                        invalidGeoJSONTrace
                    )
                }

                // For refresh operations, preserve the existing layer on failure
                // to prevent temporary network issues from marking the layer as
                // "layernotfound".
                if (isRefresh && data === null) {
                    const existingLayer = registry.layer[layerObj.name]
                    if (existingLayer != null && existingLayer !== false) {
                        console.warn(
                            `[${new Date().toISOString()}] Refresh failed for ${
                                layerObj.display_name
                            }, ` +
                                `keeping existing layer. Next refresh in ${
                                    layerObj.time?.refreshIntervalAmount || 60
                                }s`
                        )
                        registry.refreshFailed[layerObj.name] = true
                        document.dispatchEvent(
                            new CustomEvent('layerRefreshStatusChanged', {
                                detail: {
                                    layerName: layerObj.name,
                                    failed: true,
                                },
                            })
                        )
                        resolve()
                        return
                    }
                }

                L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
                registry.layer[layerObj.name] = data == null ? null : false
                L_.Map_.allLayersLoaded()
                resolve()
                return
            }

            MapRenderer.addVector(layerObj, { geojson: data, isRefresh }, mctx)

            resolve()
        }
    })
}
