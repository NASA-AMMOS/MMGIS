/**
 * Dropdown options a plugin can't know when it writes its manifest.
 *
 * A metaconfig `dropdown`/`searchdropdown` normally lists its `options`
 * literally, which works for "circle | square" and not at all for "a property
 * of this layer's data" — the case every plugin that reads feature properties
 * has, and which therefore ends up as an unchecked free-text field. Such a
 * component names a provider instead:
 *
 *     { "type": "dropdown", "name": "Azimuth property",
 *       "field": "variables.layerAttachments.lookDirection.azimuthProp",
 *       "optionsFrom": "layerProperties" }
 *
 * Providers are async, resolved once per (provider, layer) and cached for the
 * session; `options`, if also given, is what the field shows until (and if) the
 * provider answers.
 *
 * @module optionProviders
 */

const _cache = {}

const _domain = () => {
  const g = window.mmgisglobal || {}
  let domain =
    g.NODE_ENV === "development" ? "http://localhost:8888/" : g.ROOT_PATH || ""
  if (domain.length > 0 && !domain.endsWith("/")) domain += "/"
  return domain
}

const _json = async (url) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Property names of the layer's own features.
 *
 * A `geodatasets:` layer is answered by the geodataset's schema; a file-backed
 * vector layer by sampling the file it points at. Anything else (a tile layer,
 * a `source` type that fetches from somewhere core can't see) has no properties
 * to enumerate and answers with nothing, leaving whatever `options` the
 * component declared.
 */
async function layerProperties({ layer, missionPath }) {
  const url = layer?.url
  if (typeof url !== "string" || url.length === 0) return []

  if (url.toLowerCase().startsWith("geodatasets:")) {
    const name = url.split(":").slice(1).join(":").split("?")[0]
    const data = await _json(
      `${_domain()}api/geodatasets/schema?layers=${encodeURIComponent(name)}`
    )
    return Object.keys(data?.schema || {}).sort()
  }

  const isJson = /\.(geojson|json)(\?.*)?$/i.test(url)
  if (!isJson) return []

  const absolute = /^https?:\/\//i.test(url)
  const data = await _json(absolute ? url : `${_domain()}${missionPath || ""}${url}`)
  const keys = new Set()
  for (const feature of (data?.features || []).slice(0, 50))
    Object.keys(feature?.properties || {}).forEach((k) => keys.add(k))
  return [...keys].sort()
}

/** Every layer in the mission being configured, by name. */
async function layers({ configuration }) {
  const names = []
  const walk = (list) => {
    ;(list || []).forEach((l) => {
      if (l?.name) names.push(l.name)
      if (l?.sublayers) walk(l.sublayers)
    })
  }
  walk(configuration?.layers)
  return names
}

/** Registered layer type ids, including plugin types. */
async function layerTypes({ layerTypeConfiguration }) {
  return Object.keys(layerTypeConfiguration || {}).sort()
}

export const OPTION_PROVIDERS = { layerProperties, layers, layerTypes }

/** Provider names, for validation and for the docs table. */
export const OPTION_PROVIDER_NAMES = Object.keys(OPTION_PROVIDERS)

/**
 * Resolve a named provider. Never throws: a provider that fails logs and
 * answers with nothing, so a settings form still renders.
 *
 * @param {string} name
 * @param {object} ctx { layer, configuration, layerTypeConfiguration, missionPath }
 * @returns {Promise<Array>}
 */
export async function resolveOptions(name, ctx = {}) {
  const provider = OPTION_PROVIDERS[name]
  if (provider == null) {
    console.warn(
      `Maker: unknown optionsFrom '${name}'. Known providers: ${OPTION_PROVIDER_NAMES.join(
        ", "
      )}.`
    )
    return []
  }

  const key = `${name}|${ctx.layer?.uuid || ctx.layer?.name || ""}|${
    ctx.layer?.url || ""
  }`
  if (_cache[key] !== undefined) return _cache[key]

  try {
    const options = (await provider(ctx)) || []
    _cache[key] = options
    return options
  } catch (err) {
    console.warn(`Maker: optionsFrom '${name}' failed`, err)
    return []
  }
}

const optionProviders = {
  OPTION_PROVIDERS,
  OPTION_PROVIDER_NAMES,
  resolveOptions,
}

export default optionProviders
