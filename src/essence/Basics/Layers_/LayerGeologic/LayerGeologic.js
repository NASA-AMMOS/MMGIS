// LayerGeologic adds support for point, line and polygon geological symbolization
// See https://ngmdb.usgs.gov/fgdc_gds/geolsymstd/download.php
//     https://davenquinn.com/projects/geologic-patterns/

import F_ from '../../Formulae_/Formulae_'

import lineworkJson from './linework.json'
import patternsJson from './patterns.json'
import symbolsJson from './symbols.json'

const geologicJSON = {}
geologicJSON.linework = lineworkJson.linework
geologicJSON.patterns = patternsJson.patterns
geologicJSON.symbols = symbolsJson.symbols

const LayerGeologic = {
    // Manages fill patterns to avoid duplicates
    _fillPatterns: {},
    getFillPattern: function (url, size, fill, map) {
        const id = `${url}_${size}_${fill}`
        if (LayerGeologic._fillPatterns[id] == null) {
            LayerGeologic._fillPatterns[id] = new L.ImagePattern({
                url: url,
                width: 164 * (size || 1),
                height: 164 * (size || 1),
                imageFill: fill,
            })
            LayerGeologic._fillPatterns[id].addTo(map)
        }

        return LayerGeologic._fillPatterns[id]
    },
    getDefinitionGroups: function (type) {
        const t = type === 'linework' ? type : type + 's'
        return geologicJSON[t] ? geologicJSON[t].groups : []
    },
    getDefinition: function (type, tag) {
        if (type == null || tag == null || tag === false) return

        const t = type === 'linework' ? type : type + 's'
        const mainTag = tag.split('-')[0]
        for (let i = 0; i < geologicJSON[t].groups.length; i++) {
            if (geologicJSON[t].groups[i].definitions[mainTag]) {
                return geologicJSON[t].groups[i].definitions[mainTag]
            }
        }
    },
    getBaseUrl: function (type, tag) {
        if (type == null || tag == null || tag === false) return ''

        const t = type === 'linework' ? type : type + 's'
        const mainTag = tag.split('-')[0]
        for (let i = 0; i < geologicJSON[t].groups.length; i++) {
            if (geologicJSON[t].groups[i].definitions[mainTag]) {
                return '/public' + (geologicJSON[t].groups[i].baseUrl || '')
            }
        }
        return ''
    },
    getUrl: function (type, tag) {
        if (tag == null || tag === false) return null

        switch (type) {
            case 'pattern':
                return LayerGeologic.getBaseUrl(type, tag).replace('{tag}', tag)
            default:
                break
        }
        return
    },
    getTag: function (code, color, fallbackCode, fallbackColor) {
        code = code || fallbackCode

        if (code == null || code === false) return null

        if (color == null) color = fallbackColor
        if (
            color === false ||
            color === 'false' ||
            color == null ||
            color === 'null'
        )
            return code

        return `${code}-${color}`
    },
    getLineworkPatterns: function (style) {
        const patterns = []
        const s = style.geologic
        let def = null
        if (s != null) def = LayerGeologic.getDefinition(s.type, s.tag)

        if (s != null && def != null && def.style?.symbols?.[0] != null) {
            const defS = def.style?.symbols?.[0]
            const weight = style.weight || 0
            const weightFactor = 3
            const rep = s.rep || defS.rep || 200
            const size = defS.size * (s.size || 1)
            const color = F_.colorCodeToColor(s.color || defS.color)
            const opacity = style.opacity != null ? style.opacity : 1
            let rot = defS.rot || 0
            let pos = defS.pos || 'center'
            const pos2 = s.pos || pos
            let shouldOffset = false
            if (
                (pos2 === 'left' && pos === 'right') ||
                (pos2 === 'right' && pos === 'left')
            ) {
                rot += 180
                shouldOffset = true
            }
            pos = pos2

            let anchorY =
                pos === 'left'
                    ? 0 - weight / weightFactor
                    : pos === 'right'
                    ? size + weight / weightFactor
                    : size / 2
            if (shouldOffset) {
                if (pos === 'left') anchorY += size + weight / weightFactor
                if (pos === 'right') anchorY -= size
            }
            patterns.push({
                offset: '5%',
                repeat: rep,
                symbol: L.Symbol.marker({
                    rotate: true,
                    angleCorrection: rot,
                    markerOptions: {
                        icon: L.divIcon({
                            className: 'leaflet_FGDCGeoSym',
                            iconSize: [size, size],
                            iconAnchor: [size / 2, anchorY],
                            html: [
                                `<div style="font-family: ${defS.set}; font-size: ${size}px; color: ${color}; opacity: ${opacity};">`,
                                `${defS.key}`,
                                `</div>`,
                            ].join(''),
                        }),
                    },
                }),
            })
        }
        if (patterns.length === 0)
            return [
                {
                    offset: 0,
                    repeat: 0,
                    symbol: L.Symbol.dash({ pixelSize: 0 }),
                },
            ]
        return patterns
    },
    hasGeologicStyle: function (layer) {
        if (layer.shape && layer.shape.isLinework) {
            if (layer.shape._layers) {
                for (let l in layer.shape._layers) {
                    const lineworkLayer = layer.shape._layers[l]
                    if (
                        F_.getIn(
                            lineworkLayer,
                            'feature.properties.style.geologic',
                            false
                        ) !== false
                    )
                        return true
                }
            }
        }
        if (
            F_.getIn(layer, 'feature.properties.style.geologic', false) !==
            false
        )
            return true

        if (F_.getIn(layer, 'properties.style.geologic', false) !== false)
            return true

        if (F_.getIn(layer, 'style.geologic', false) !== false) return true

        return false
    },
    createLinework: function (feature, style) {
        const invertedFeature = F_.invertGeoJSONLatLngs(feature)
        const hasGeologic = style.geologic != null

        if (!hasGeologic) {
            const line = new L.Polyline(invertedFeature.geometry.coordinates, {
                color: style.color,
                weight: style.weight,
                dashArray: style.dashArray,
                lineCap: style.lineCap,
                lineJoin: style.lineJoin,
                opacity: style.opacity,
            })
            line.feature = feature

            return line
        } else {
            const geoColor = F_.getIn(style, 'geologic.color', null)
            const color =
                geoColor != null ? F_.colorCodeToColor(geoColor) : style.color
            const dashArray =
                F_.getIn(style, 'geologic.dashArray', null) || style.dashArray
            const weight =
                F_.getIn(style, 'geologic.weight', null) || style.weight

            // geologic line
            const line = new L.Polyline(invertedFeature.geometry.coordinates, {
                color: color,
                weight: weight,
                dashArray: dashArray,
                lineCap: style.lineCap,
                lineJoin: style.lineJoin,
            })
            const decoratedLine = L.polylineDecorator(line, {
                patterns: LayerGeologic.getLineworkPatterns(style),
            })

            line.feature = feature
            decoratedLine.feature = feature
            decoratedLine.isDecorated = true
            const lineLayer = L.layerGroup([line, decoratedLine])
            lineLayer.feature = feature
            lineLayer.isLinework = true

            return lineLayer
        }
    },
    getSymbolIcon: function (set, key, color, size, rot) {
        const radius = 24 * (size || 1)
        return L.divIcon({
            className: 'leafletMarkerFont',
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
            html: `<div style="color: ${F_.colorCodeToColor(
                color
            )}; font-size: ${
                radius * 1.6
            }px; font-family: ${set}; text-align: center; width: ${
                radius * 2
            }px; height: ${radius * 2}px; transform: rotateZ(${
                rot || 0
            }deg);">${key}<div>`,
        })
    },
    // Will create a regular circleMarker if no geologic style
    createSymbolMarker: function (lat, lng, style) {
        style = style || {}

        const g = style.geologic
        if (g != null) {
            const def = LayerGeologic.getDefinition(g.type, g.tag)
            if (def != null) {
                return L.marker(new L.LatLng(lat, lng), {
                    icon: LayerGeologic.getSymbolIcon(
                        def.style.symbol.set,
                        def.style.symbol.key,
                        g.color,
                        g.size,
                        g.rot
                    ),
                })
            }
        }

        // Else Regular marker
        return L.circleMarker(new L.LatLng(lat, lng), style)
    },
}
export default LayerGeologic
