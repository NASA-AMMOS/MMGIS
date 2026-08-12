import F_ from '../../Formulae_/Formulae_'

import $ from 'jquery'

export function addArrowToMap(
    L_,
    layerId,
    start,
    end,
    style,
    feature,
    index,
    indexedCallback,
    withClass
) {
    const className = withClass ? `mmgisArrow LayerArrow_${index}` : ''
    const classNameOutline = withClass ? ' mmgisArrowOutline' : ''
    let line

    let length
    if (isNaN(style.length)) length = false
    else length = parseInt(style.length)

    line = new L.Polyline([end, start], {
        color: style.color,
        weight: style.width + style.weight,
    })
    let arrowBodyOutline
    if (length === false) {
        arrowBodyOutline = new L.Polyline([start, end], {
            color: style.color,
            weight: style.width + style.weight,
            dashArray: style.dashArray,
            lineCap: style.lineCap,
            lineJoin: style.lineJoin,
            className: className + classNameOutline,
        })
    } else {
        arrowBodyOutline = L.polylineDecorator(line, {
            patterns: [
                {
                    offset: length / 2 + 'px',
                    repeat: 0,
                    symbol: L.Symbol.dash({
                        pixelSize: style.length,
                        polygon: false,
                        pathOptions: {
                            stroke: true,
                            color: style.color,
                            weight: style.width + style.weight,
                            dashArray: style.dashArray,
                            lineCap: style.lineCap,
                            lineJoin: style.lineJoin,
                            className: className + classNameOutline,
                        },
                    }),
                },
            ],
        })
    }
    line = new L.Polyline([start, end], {
        color: style.color,
        weight: style.width + style.weight,
        className: className,
    })
    var arrowHeadOutline = L.polylineDecorator(line, {
        patterns: [
            {
                offset: '100%',
                repeat: 0,
                symbol: L.Symbol.arrowHead({
                    pixelSize: style.radius,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: style.color,
                        weight: style.width + style.weight,
                        lineCap: style.lineCap,
                        lineJoin: style.lineJoin,
                        className: className + classNameOutline,
                    },
                }),
            },
        ],
    })
    line = new L.Polyline([end, start], {
        color: style.fillColor,
        weight: style.width,
        className: className,
    })
    var arrowBody
    if (length === false) {
        arrowBody = new L.Polyline([start, end], {
            color: style.fillColor,
            weight: style.width,
            dashArray: style.dashArray,
            lineCap: style.lineCap,
            lineJoin: style.lineJoin,
            className: className,
        })
    } else {
        arrowBody = L.polylineDecorator(line, {
            patterns: [
                {
                    offset: length / 2 + 'px',
                    repeat: 0,
                    symbol: L.Symbol.dash({
                        pixelSize: style.length,
                        polygon: false,
                        pathOptions: {
                            stroke: true,
                            color: style.fillColor,
                            weight: style.width,
                            dashArray: style.dashArray,
                            lineCap: style.lineCap,
                            lineJoin: style.lineJoin,
                            className: className,
                        },
                    }),
                },
            ],
        })
    }
    line = new L.Polyline([start, end], {
        color: style.fillColor,
        weight: style.width,
        className: className,
    })
    var arrowHead = L.polylineDecorator(line, {
        patterns: [
            {
                offset: '100%',
                repeat: 0,
                symbol: L.Symbol.arrowHead({
                    pixelSize: style.radius,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: style.fillColor,
                        weight: style.width,
                        lineCap: style.lineCap,
                        lineJoin: style.lineJoin,
                        className: className,
                    },
                }),
            },
        ],
    })

    if (layerId == null) {
        const arrowLayer = L.layerGroup([
            arrowBodyOutline,
            arrowHeadOutline,
            arrowBody,
            arrowHead,
        ])
        arrowLayer.start = start
        arrowLayer.end = end
        arrowLayer.feature = feature

        arrowLayer._isArrow = true
        arrowLayer._idx = index
        arrowLayer.toGeoJSON = function () {
            return feature
        }
        return arrowLayer
    } else {
        if (index == null) index = L_.layers.layer[layerId].length
        L_.Map_.rmNotNull(L_.layers.layer[layerId][index])
        L_.layers.layer[layerId][index] = L.layerGroup([
            arrowBodyOutline,
            arrowHeadOutline,
            arrowBody,
            arrowHead,
        ]).addTo(L_.Map_.map)
        L_.layers.layer[layerId][index]._isArrow = true
        L_.layers.layer[layerId][index]._idx = index
        L_.layers.layer[layerId][index].start = start
        L_.layers.layer[layerId][index].end = end
        L_.layers.layer[layerId][index].feature = feature
        if (typeof indexedCallback === 'function') indexedCallback()
    }
}

export function createAnnotation(
    L_,
    feature,
    className,
    layerId,
    id1,
    id2,
    andAddToMap
) {
    if (id2 == null) id2 = 0

    className = className.replace(/ /g, '_')
    //Remove previous annotation if any
    $(`#${className}_${id1}_${id2}`)
        .parent()
        .parent()
        .parent()
        .parent()
        .remove()

    const s = feature.properties.style
    const styleString =
        (s.color != null
            ? 'text-shadow: ' +
              F_.getTextShadowString(s.color, s.strokeOpacity, s.weight) +
              '; '
            : '') +
        (s.fillColor != null ? 'color: ' + s.fillColor + '; ' : '') +
        (s.fontSize != null ? 'font-size: ' + s.fontSize + '; ' : '') +
        (s.rotation != null
            ? 'transform: rotateZ(' +
              parseInt(!isNaN(s.rotation) ? s.rotation : 0) * -1 +
              'deg); '
            : '')

    const id = className + '_' + id1 + '_' + id2
    // prettier-ignore
    const popup = L.popup({
        className: `leaflet-popup-annotation`,
        closeButton: false,
        autoClose: false,
        closeOnEscapeKey: false,
        closeOnClick: false,
        autoPan: false,
        offset: new L.point(0, 3),
        interactive: true,
        bubblingMouseEvents: true
    })
        .setLatLng(
            new L.LatLng(
                feature.geometry.coordinates[1],
                feature.geometry.coordinates[0]
            )
        )
        .setContent(
            "<div>" +
                `<div id='${id}'` +
                ` class='${className === 'DrawToolAnnotation' ? 'drawToolAnnotation' : 'mmgisAnnotation'} ${className}_${id1} blackTextBorder'` +
                " layer='" + id1 +
                "' layerId='" + layerId + 
                (L_.layers.layer[layerId] != null ? "' index='" + L_.layers.layer[layerId].length : '') +
                "' style='" + styleString + "'>" +
                `${feature.properties.name.replace(/[<>;{}]/g, '')}`,
                '</div>' +
            '</div>'
        )

    if (popup?._contentNode?._leaflet_events)
        Object.keys(popup._contentNode._leaflet_events).forEach((ev) => {
            delete popup._contentNode._leaflet_events[ev]
        })

    popup._isAnnotation = true
    popup._annotationParams = {
        feature,
        className,
        layerId,
        id1,
        id2,
        andAddToMap,
    }
    popup.feature = feature
    popup.options = popup.options || {}
    popup.options.layerName = layerId
    popup.toGeoJSON = function () {
        return feature
    }

    if (andAddToMap) {
        popup.addTo(L_.Map_.map)
        L_.removePopupStopPropogationFunctions(popup)
        L_.layers.layer[layerId].push(popup)
    } else {
        setTimeout(() => {
            L_.removePopupStopPropogationFunctions(popup)
        }, 2000)
    }

    return popup
}

export function removePopupStopPropogationFunctions(L_, popup) {
    if (popup?._contentNode?._leaflet_events)
        Object.keys(popup._contentNode._leaflet_events).forEach((ev) => {
            document
                .querySelectorAll('.leaflet-popup-content')
                .forEach(function (elm) {
                    // Now do something with my button
                    elm.removeEventListener(
                        'wheel',
                        popup._contentNode._leaflet_events[ev]
                    )
                })
        })

    if (popup?._container?.children?.[0]?._leaflet_events)
        Object.keys(popup._container.children[0]._leaflet_events).forEach(
            (ev) => {
                document
                    .querySelectorAll('.leaflet-popup-content-wrapper')
                    .forEach(function (elm) {
                        // Now do something with my button
                        elm.removeEventListener(
                            ev.replace(/\d+$/, ''),
                            popup._container.children[0]._leaflet_events[ev]
                        )
                    })
            }
        )
}
