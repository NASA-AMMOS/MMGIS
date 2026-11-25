/**
 * IdentifierClickGuard.js
 *
 * Whether a map or globe click is the Identifier's to chart (#1159), or
 * belongs to another tool or to feature selection. The Identifier is a
 * separated tool and stays on while toolbar tools come and go, so it must
 * not answer clicks those tools - or a clicked feature - are using.
 *
 * Only signals MMGIS already relies on are read; no other tool is changed:
 *  - `disableLayerInteractions` on the active toolbar tool - the flag a tool
 *    sets to take the map's clicks for itself (Measure; featureDefaultClick
 *    honours it).
 *  - The active toolbar tool's own handlers on the map's 'click' event, found
 *    with Leaflet's public `listens(type, fn)` - since Leaflet 1.8 (MMGIS
 *    pins 1.9.4) that answers for one handler, not for "any listener".
 *    Before relying on it the guard checks it with a probe handler that is
 *    never registered: if that probe reads as registered, `listens` can't
 *    tell handlers apart and only the disableLayerInteractions flag is used. Click-taking tools register a
 *    handler only while they take clicks and remove it after: Sightline and
 *    Viewshed while open, Measure while open, Draw while drawing
 *    (`drawing.<shape>.start`), Animation while drawing
 *    (`drawingHandlers.click`).
 *  - A feature under the pointer: Leaflet gives clickable vector layers and
 *    markers the `leaflet-interactive` class and bubbles their clicks to the
 *    map after the feature's own handler; Cesium picks globe entities.
 */

/** How deep into the active tool's own plain objects to look for handlers. */
const MAX_HANDLER_DEPTH = 3
/** Most values inspected while looking (a tool is a module object). */
const MAX_HANDLER_NODES = 2000

const isPlainObject = (v) => {
    if (v == null || typeof v !== 'object') return false
    const proto = Object.getPrototypeOf(v)
    return proto === Object.prototype || proto === null
}

/**
 * Whether one of the tool's own functions is a live handler for `type`.
 * Walks the tool's own enumerable properties and the plain objects under
 * them (not DOM nodes, class instances or arrays), a few levels deep.
 *
 * @param {object} tool - the active toolbar tool module
 * @param {(type: string, fn: Function) => boolean} listens
 */
export function toolHasHandler(tool, listens, type = 'click') {
    if (!tool || typeof listens !== 'function') return false
    const seen = new Set()
    let nodes = 0
    const visit = (obj, depth) => {
        if (seen.has(obj)) return false
        seen.add(obj)
        for (const key of Object.keys(obj)) {
            if (++nodes > MAX_HANDLER_NODES) return false
            let v
            try {
                v = obj[key]
            } catch (e) {
                continue
            }
            if (typeof v === 'function') {
                if (listens(type, v)) return true
            } else if (depth < MAX_HANDLER_DEPTH && isPlainObject(v)) {
                if (visit(v, depth + 1)) return true
            }
        }
        return false
    }
    return visit(tool, 0)
}

/**
 * Whether `listens(type, fn)` answers for that one handler. A Leaflet older
 * than 1.8 ignores `fn` and answers whether anything listens - with which
 * every tool would seem to own every click.
 */
export function listensIsHandlerSpecific(listens, type = 'click') {
    if (typeof listens !== 'function') return false
    const neverRegistered = function identifierGuardProbe() {}
    try {
        return listens(type, neverRegistered) === false
    } catch (e) {
        return false
    }
}

/**
 * The reason another tool owns map clicks right now, or null.
 * @param {object|null} activeTool - ToolController_.activeTool
 * @param {(type, fn) => boolean} listens - e.g. Map_.map.listens bound to it
 */
export function toolClaimingClicks(activeTool, listens) {
    if (!activeTool) return null
    if (activeTool.disableLayerInteractions === true)
        return 'tool-disables-layer-interactions'
    if (
        listensIsHandlerSpecific(listens, 'click') &&
        toolHasHandler(activeTool, listens, 'click')
    )
        return 'tool-click-handler'
    return null
}

/**
 * Whether a DOM click landed on a clickable Leaflet layer (a vector feature
 * or marker) inside the map container, rather than on the map itself.
 */
export function isFeatureClickTarget(target, container) {
    let el = target
    while (el && el !== container) {
        if (el.classList && el.classList.contains('leaflet-interactive'))
            return true
        el = el.parentNode
    }
    return false
}

/**
 * Whether the Identifier should chart this Leaflet map click.
 * @param {object} e - Leaflet 'click' event
 * @param {object} ctx - { activeTool, map }
 */
export function shouldChartMapClick(e, ctx) {
    if (!e || !e.latlng) return false
    const map = ctx.map
    if (
        isFeatureClickTarget(
            e.originalEvent && e.originalEvent.target,
            map && map.getContainer ? map.getContainer() : null
        )
    )
        return false
    return (
        toolClaimingClicks(
            ctx.activeTool,
            map && map.listens ? (t, fn) => map.listens(t, fn) : null
        ) == null
    )
}

/**
 * Whether the Identifier should chart this globe click.
 * @param {object} ctx - { activeTool, map, pickedFeature }
 *   pickedFeature: a globe feature was under the pointer (it takes the click)
 */
export function shouldChartGlobeClick(ctx) {
    if (ctx.pickedFeature) return false
    const map = ctx.map
    return (
        toolClaimingClicks(
            ctx.activeTool,
            map && map.listens ? (t, fn) => map.listens(t, fn) : null
        ) == null
    )
}

/**
 * Read the geographic point UNDER THIS pointer event, not a cached globe
 * hover coordinate. Cesium's mouse state only updates on MOUSE_MOVE, so a
 * first stationary touch and a tap after moving the camera can be stale.
 *
 * Reject Cesium UI controls (which share the viewer container) and sky taps.
 * LithoSphere retains its existing mouse-coordinate handling.
 */
export function globeClickPosition(e, litho) {
    if (!e || !litho) return null
    if (litho.rendererType !== 'cesium') {
        const mouse = litho.mouse
        if (
            !mouse ||
            mouse.onSurface === false ||
            !Number.isFinite(mouse.lng) ||
            !Number.isFinite(mouse.lat)
        )
            return null
        return { lng: mouse.lng, lat: mouse.lat }
    }

    const viewer = litho.renderer
    const scene = viewer?.scene
    const canvas = scene?.canvas
    // getContainer() covers link/navigation controls; only canvas owns picks.
    if (!canvas || e.target !== canvas) return null
    const rect = canvas.getBoundingClientRect?.()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > rect.width ||
        y > rect.height
    )
        return null

    try {
        // Same picking API used by GlobeRenderer's coordinate control.
        const ellipsoid = scene.globe?.ellipsoid
        if (!ellipsoid) return null
        const hit = viewer.camera?.pickEllipsoid({ x, y }, ellipsoid)
        if (!hit) return null // off the planet / sky
        const cartographic = ellipsoid.cartesianToCartographic(hit)
        if (!cartographic) return null
        const lng = (cartographic.longitude * 180) / Math.PI
        const lat = (cartographic.latitude * 180) / Math.PI
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
        return { lng: ((((lng + 180) % 360) + 360) % 360) - 180, lat }
    } catch (_) {
        return null
    }
}

/** A longitude in -180..180 (180 stays 180; -180 stays -180). */
export function normalizeLng(lng) {
    if (!Number.isFinite(lng)) return lng
    if (lng >= -180 && lng <= 180) return lng
    return ((((lng + 180) % 360) + 360) % 360) - 180
}

/**
 * The copy of `lng` (by whole turns) nearest `refLng`: where a point chosen
 * on the globe, or by longitude, belongs on a map that has been panned
 * across the antimeridian, so the marker lands in the world copy in view.
 */
export function nearestWorldLng(lng, refLng) {
    if (!Number.isFinite(lng) || !Number.isFinite(refLng)) return lng
    return lng + 360 * Math.round((refLng - lng) / 360)
}

/**
 * The point a map click selects: the normalised longitude for the queries
 * (and the globe), and the clicked longitude itself for the map marker, so
 * the marker stays in the world copy that was clicked (190°E is queried as
 * -170° but marked at 190°).
 */
export function mapClickPoint(latlng) {
    if (!latlng) return null
    const { lat, lng } = latlng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lng: normalizeLng(lng), lat, mapLng: lng }
}
