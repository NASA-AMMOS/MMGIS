/**
 * Coordinate-markers attachment — a graticule over its host layer.
 *
 * It is an ordinary map layer: core's defaults (add/remove from the map, set
 * opacity on the layer) are already right, so it declares no operations. The
 * empty module is deliberate — it exists so the attachment is registered and
 * discoverable rather than being an unnamed `default` case in core.
 */

export default {}
