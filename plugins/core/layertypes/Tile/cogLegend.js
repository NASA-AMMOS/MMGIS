import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import { evaluate_cmap } from '@external/js-colormaps/js-colormaps.js'

function colorTableLegend(table, units) {
    if (typeof table === 'string') {
        try {
            table = JSON.parse(table)
        } catch (error) {
            return null
        }
    }
    let entries = []
    if (Array.isArray(table)) {
        entries = table
            .filter((entry) => Array.isArray(entry) && Array.isArray(entry[1]))
            .map((entry) => ({
                color: entry[1],
                value: Array.isArray(entry[0])
                    ? `${entry[0][0]} – ${entry[0][1]}${units || ''}`
                    : '',
            }))
    } else if (table && typeof table === 'object') {
        entries = Object.keys(table)
            .filter((key) => Array.isArray(table[key]))
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .map((key) => ({ color: table[key], value: `${key}${units || ''}` }))
    }
    const legend = entries
        .filter((entry) => (entry.color[3] ?? 255) > 0)
        .map(({ color, value }) => ({
            color: `rgba(${color[0] || 0},${color[1] || 0},${color[2] || 0},${
                color[3] == null ? 1 : color[3] / 255
            })`,
            strokecolor: null,
            shape: 'square',
            value,
        }))
    return legend.length ? legend : null
}

export default function buildCogLegend(layer) {
    const rendered = L_.layers.layer[layer.name]
    const url = layer.url || layer.demtileurl || ''
    if (
        !rendered ||
        (typeof url !== 'string') ||
        (!url.startsWith('COG:') &&
            !url.startsWith('stac-collection:') &&
            !['image', 'velocity'].includes(layer.type) &&
            !(layer.type === 'data' && layer.variables?.shader?.ramps))
    )
        return null
    if (
        layer.type === 'image' &&
        rendered.georasters?.[0]?.numberOfRasters !== undefined &&
        rendered.georasters[0].numberOfRasters !== 1
    )
        return null
    if (
        layer.type !== 'data' &&
        layer.cogTransform !== true &&
        layer.cogColormapJson == null &&
        (url.startsWith('COG:') ||
            url.startsWith('stac-collection:') ||
            layer.type === 'image')
    )
        return null

    const units =
        layer.type === 'velocity'
            ? layer.kind === 'particles'
                ? layer.variables?.particles?.units || ''
                : layer.variables?.streamlines?.units || ''
            : layer.type === 'data'
              ? layer.variables?.shader?.units || ''
              : layer.cogUnits || ''
    const tableLegend = colorTableLegend(layer.cogColormapJson, units)
    if (tableLegend) {
        layer._legend = tableLegend
        return tableLegend
    }

    const min =
        layer.type === 'data'
            ? rendered.minValue
            : layer.currentCogMin ??
              layer.cogMin ??
              layer.variables?.streamlines?.minVelocity
    const max =
        layer.type === 'data'
            ? rendered.maxValue
            : layer.currentCogMax ??
              layer.cogMax ??
              layer.variables?.streamlines?.maxVelocity
    const image = document.getElementById(
        `titlerCogColormapImage_${L_.asLayerUUID(layer.name)}`
    )
    let imageContext = null
    let canvas = null
    if (layer.type === 'tile' && image?.complete && image.naturalHeight) {
        canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 1
        imageContext = canvas.getContext('2d')
        imageContext?.drawImage(image, 0, 0, 256, 1)
    }
    const ramp =
        layer.type === 'data'
            ? layer.variables?.shader?.ramps?.[
                  rendered.rampIdx || 0
              ] || layer.variables?.shader?.ramps?.[0]
            : null
    const configuredMap =
        layer.type === 'velocity'
            ? layer.variables?.streamlines?.colorScale
            : layer.cogColormap || 'viridis'
    const reverse = /[_-]r$/.test(configuredMap || '')
    const colorMap = reverse
        ? configuredMap.slice(0, -2)
        : configuredMap || 'viridis'

    const legend = Array.from({ length: 9 }, (_, index) => {
        const value =
            Number.isFinite(min) && Number.isFinite(max)
                ? Math.round((min + ((max - min) * index) / 8) * 100) / 100
                : null
        let color
        if (ramp?.length) {
            const position = (index / 8) * (ramp.length - 1)
            const lower = Math.floor(position)
            const upper = Math.min(lower + 1, ramp.length - 1)
            const fraction = position - lower
            const low = F_.hexToRGB(ramp[lower])
            const high = F_.hexToRGB(ramp[upper])
            if (low && high)
                color = `rgb(${Math.round(low.r + (high.r - low.r) * fraction)},${Math.round(low.g + (high.g - low.g) * fraction)},${Math.round(low.b + (high.b - low.b) * fraction)})`
        } else if (imageContext && layer.type === 'tile') {
            const pixel = imageContext.getImageData(
                Math.round((255 * index) / 8),
                0,
                1,
                1
            ).data
            color = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`
        } else {
            const position =
                value != null && max !== min
                    ? Math.max(0, Math.min(1, (value - min) / (max - min)))
                    : index / 8
            color = `rgb(${evaluate_cmap(position, colorMap, reverse).join(',')})`
        }
        return {
            color,
            strokecolor: null,
            shape: 'continuous',
            value: value == null ? '' : `${value}${units}`,
        }
    }).reverse()
    canvas?.remove()
    layer._legend = legend
    return legend
}
