//The bottom left text that describes to the user the basic mmgis state
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Dropy from '../../external/Dropy/dropy'
import flat from 'flat'
import { booleanIntersects, bbox } from '@turf/turf'
import calls from '../../pre/calls'
import TimeControl from './TimeControl'

import tippy from 'tippy.js'

import './Description.css'

const NAV_DEFAULT_FIELD = '(Default) Feature Order'

const Description = {
    inited: false,
    waitingOnUpdate: false,
    descCont: null,
    descMission: null,
    descPoint: null,
    tippyDesc: null,
    tippyMenu: null,
    tippyPrevious: null,
    tippyNext: null,
    L_: null,
    navPopoverField: NAV_DEFAULT_FIELD,
    _popoverOpen: false,
    _infoAlreadyGone: false,
    init: function (mission, site, Map_, L_) {
        this.L_ = L_
        this.Map_ = Map_
        this.descCont = d3.select('.mainDescription').attr('title', '')
        this.descInfoCont = d3.select('.mainInfo')
        /*
            this.descMission = descCont
                .append('div')
                .attr('id', 'mainDescMission')
                .style('line-height', '32px')
                .style('padding-left', '8px')
                .style('color', '#EEE')
                .style('font-size', '22px')
                .style('margin', '0')
                .style('cursor', 'default')
                .style('text-align', 'center')
                .style('cursor', 'pointer')
                .html(mission)
            var missionWidth = $('#mainDescMission').width() + 3
        */

        // prettier-ignore
        const navMarkup = [
            `<div id="mainDescNavBar">`,
                `<div id="mainDescNavBarMenu" title="">`,
                    `<i class='mdi mdi-dots-vertical mdi-18px'></i>`,
                `</div>`,
                `<div id="mainDescNavBarPrevious" title="">`,
                    `<i class='mdi mdi-chevron-left mdi-24px'></i>`,
                `</div>`,
                `<div id="mainDescNavBarNext" title="">`,
                    `<i class='mdi mdi-chevron-right mdi-24px'></i>`,
                `</div>`,
            `</div>`
        ].join('\n')

        // prettier-ignore
        const navPopoverMarkup = [
            `<div id="mainDescNavPopover">`,
                `<div id="mainDescNavPopoverTitle">Feature Navigation</div>`,
                `<div id="mainDescNavPopoverField">`,
                    `<div id="mainDescNavPopoverFieldField" class="ui dropdown short"></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverFieldInfo">`,
                    `<div id="mainDescNavPopoverFieldKey">Value</div>`,
                    `<div id="mainDescNavPopoverFieldValue"></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverExtent">`,
                    `<div>Restrict to Map Extent</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp1"/><label for="checkbox_dp1"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverTimeExtent">`,
                    `<div>Restrict to Time Range</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp15"/><label for="checkbox_dp15"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverGeometryType">`,
                    `<div>Restrict to Geometry Type</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp155"/><label for="checkbox_dp155"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverPanTo">`,
                    `<div>Pan To Feature</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp2"/><label for="checkbox_dp2"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverBottom">`,
                    `<div id="mainDescNavPopoverBottomFirst">`,
                        `<i class='mdi mdi-page-first mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomPrevious">`,
                        `<i class='mdi mdi-chevron-left mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomNext">`,
                        `<i class='mdi mdi-chevron-right mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomLast">`,
                        `<i class='mdi mdi-page-last mdi-24px'></i>`,
                    `</div>`,
                `</div>`,
            `</div>`,
        ].join('\n')
        this.descNav = this.descCont
            .append('div')
            .attr('id', 'mainDescNav')
            .html(navMarkup)

        d3.select('body')
            .append('div')
            .attr('id', 'mainDescNavPopover_global')
            .html(navPopoverMarkup)

        document.addEventListener('toolChange', Description.alignNavPopover)

        $(`#mainDescNavBarMenu`).on('click', () => {
            const pop = $(`#mainDescNavPopover`)
            const willOpen = pop.css('display') === 'none'
            pop.css({
                display: willOpen ? 'block' : 'none',
            })
            $(`#mainDescNavBarMenu`).css({
                background: willOpen ? 'var(--color-c)' : 'var(--color-a)',
            })
            if (willOpen) {
                Description._popoverOpen = true
                Description.alignNavPopover()

                Description._updatePopoverDropy()
            } else {
                Description._popoverOpen = false
            }
        })

        $(`#mainDescNavPopoverBottomFirst`).on('click', async () => {
            if (L_.activeFeature) {
                L_.selectFeature(
                    L_.activeFeature.layerName,
                    L_.activeFeature.feature,
                    await Description.getFeatureDistance(
                        L_.activeFeature,
                        Description.navPopoverField,
                        'first'
                    )
                )
                Description.onNextPrev()
            }
        })
        $(`#mainDescNavBarPrevious, #mainDescNavPopoverBottomPrevious`).on(
            'click',
            () => {
                Description.navPrevious()
            }
        )
        $(`#mainDescNavBarNext, #mainDescNavPopoverBottomNext`).on(
            'click',
            () => {
                Description.navNext()
            }
        )
        $(`#mainDescNavPopoverBottomLast`).on('click', async () => {
            if (L_.activeFeature) {
                L_.selectFeature(
                    L_.activeFeature.layerName,
                    L_.activeFeature.feature,
                    await Description.getFeatureDistance(
                        L_.activeFeature,
                        Description.navPopoverField,
                        'last'
                    )
                )
                Description.onNextPrev()
            }
        })

        document.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                Description.navPrevious()
            } else if (event.key === 'ArrowRight') {
                Description.navNext()
            }
        })

        this.descPoint = this.descCont.append('p').attr('id', 'mainDescPoint')

        this.descPointInner = this.descPoint
            .append('div')
            .attr('id', 'mainDescPointInner')
            .attr('tabindex', 300)
            .style('display', 'flex')
            .style('white-space', 'nowrap')
            .style('line-height', '29px')
            .style('color', 'var(--color-mw2)')
            .style('font-weight', 'bold')
            .style('cursor', 'pointer')
            .style('margin', '0')
        this.descPointLinks = this.descPoint
            .append('div')
            .attr('id', 'mainDescPointLinks')
            .style('display', 'flex')
            .style('white-space', 'nowrap')
            .style('line-height', '29px')
            .style('font-size', '14px')
            .style('color', '#AAA')
            .style('font-weight', 'bold')
            .style('cursor', 'pointer')
            .style('margin', '0')
            .style('overflow', 'hidden')

        Description.descPointInner.on('click', function () {
            Description.panToActive()
        })

        this.inited = true
        if (this.waitingOnUpdate) this.updateInfo()

        $(window).on('resize', () => {
            $('#mainDescPointLinks > dl.dropy').removeClass('open')
            $(`#mainDescPointLinks_global`).empty()
        })
    },
    _updatePopoverDropy() {
        // Populate Fields dropdown
        const geojson = Description.L_.layers.layer[
            Description.L_.activeFeature.layerName
        ].toGeoJSON(Description.L_.GEOJSON_PRECISION)
        const properties = [NAV_DEFAULT_FIELD]
        geojson.features.forEach((feature, idx) => {
            const flatProps = flat.flatten(feature.properties)

            for (let p in flatProps) {
                if (
                    properties.indexOf(p) === -1 &&
                    p.indexOf('images') !== 0 &&
                    p.indexOf('style') !== 0 &&
                    p[0] !== '_'
                )
                    properties.push(p)
            }
        })

        properties.sort()
        let propIndex = properties.indexOf(Description.navPopoverField)
        if (propIndex === -1) {
            Description.navPopoverField = NAV_DEFAULT_FIELD
            propIndex = 0
        }

        $('#mainDescNavPopoverFieldField').html(
            Dropy.construct(properties, 'Field to Sort By', propIndex)
        )
        Dropy.init($('#mainDescNavPopoverFieldField'), function (idx, val) {
            Description.navPopoverField = val
            Description._updateFieldValueText()
        })
        Description._updateFieldValueText()
    },
    _updateFieldValueText() {
        $('#mainDescNavPopoverFieldValue').text(
            Description.navPopoverField === NAV_DEFAULT_FIELD
                ? F_.getIn(
                      Description.L_.activeFeature.feature.properties,
                      '_.id',
                      '--'
                  )
                : F_.getIn(
                      Description.L_.activeFeature.feature.properties,
                      Description.navPopoverField,
                      '--'
                  )
        )
    },
    panToActive() {
        if (typeof Description.Map_.activeLayer.getBounds === 'function')
            Description.Map_.map.fitBounds(
                Description.Map_.activeLayer.getBounds()
            )
        else if (Description.Map_.activeLayer._latlng)
            Description.Map_.map.panTo(Description.Map_.activeLayer._latlng)
    },
    navPrevious: async () => {
        if (Description.L_.activeFeature) {
            Description.L_.selectFeature(
                Description.L_.activeFeature.layerName,
                Description.L_.activeFeature.feature,
                await Description.getFeatureDistance(
                    Description.L_.activeFeature,
                    Description.navPopoverField,
                    'previous'
                )
            )
            Description.onNextPrev()
        }
    },
    navNext: async () => {
        if (Description.L_.activeFeature) {
            Description.L_.selectFeature(
                Description.L_.activeFeature.layerName,
                Description.L_.activeFeature.feature,
                await Description.getFeatureDistance(
                    Description.L_.activeFeature,
                    Description.navPopoverField,
                    'next'
                )
            )
            Description.onNextPrev()
        }
    },
    onNextPrev() {
        if (Description.L_.activeFeature) {
            $('#mainDescNavPopoverFieldValue').text(
                Description.navPopoverField === NAV_DEFAULT_FIELD
                    ? F_.getIn(
                          Description.L_.activeFeature.feature.properties,
                          '_.id'
                      )
                    : F_.getIn(
                          Description.L_.activeFeature.feature.properties,
                          Description.navPopoverField
                      )
            )

            if ($('#mainDescNavPopoverPanTo input').is(':checked')) {
                Description.panToActive()
            }
        } else {
            Description.clearDescription()
        }
    },
    alignNavPopover(e) {
        if (e == null) {
            const bcr = $(`#mainDescNavBarMenu`).get(0).getBoundingClientRect()
            $(`#mainDescNavPopover`).css({
                position: 'fixed',
                left: bcr.left,
                right: bcr.right,
                top: bcr.top + 30,
            })
        } else {
            setTimeout(() => {
                Description.alignNavPopover()
            }, 200)
        }
    },
    getFeatureDistance: async (active, field, direction) => {
        return new Promise((resolve, reject) => {
            let passThrough = true

            if (active) {
                const layerName = Description.L_.asLayerUUID(active.layerName)
                const layer = Description.L_.layers.layer[layerName]
                const layerData = Description.L_.layers.data[layerName]

                const isTimeEnabled = layerData.time?.enabled === true
                const isDynamicExtent =
                    isTimeEnabled && layerData.variables.dynamicExtent === true

                let sortedFields = false
                if (layer) {
                    let geojson

                    geojson = Description.L_.layers.layer[layerName].toGeoJSON(
                        Description.L_.GEOJSON_PRECISION
                    )

                    let features = geojson.features

                    let currentIdx = null

                    const activeFeatureGeom = active.layer.toGeoJSON(
                        Description.L_.GEOJSON_PRECISION
                    ).geometry

                    for (let i = 0; i < features.length; i++) {
                        if (
                            F_.isEqual(
                                activeFeatureGeom,
                                features[i].geometry,
                                true
                            )
                        ) {
                            if (
                                F_.isEqual(
                                    active.feature.properties,
                                    features[i].properties,
                                    true
                                )
                            ) {
                                currentIdx = i
                            }
                        }
                        features[i].properties._ =
                            features[i].properties._ || {}
                        features[i].properties._.id = i
                    }
                    if (currentIdx == null) return 0

                    let hasTimeBounds = false
                    if (
                        $('#mainDescNavPopoverTimeExtent input').is(':checked')
                    ) {
                        hasTimeBounds = true
                    }

                    let geomTypeRestriction = false
                    if (
                        $('#mainDescNavPopoverGeometryType input').is(
                            ':checked'
                        )
                    ) {
                        geomTypeRestriction =
                            active?.feature?.geometry?.type || false
                    }
                    if (geomTypeRestriction) {
                        features = features.filter((f) => {
                            return geomTypeRestriction === f?.geometry?.type
                        })
                    }

                    // Limit to current map extent if checkbox is true
                    let hasBounds = false
                    const b = Description.Map_.map.getBounds()
                    const bounds = {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [b._northEast.lng, b._northEast.lat],
                                    [b._southWest.lng, b._northEast.lat],
                                    [b._southWest.lng, b._southWest.lat],
                                    [b._northEast.lng, b._southWest.lat],
                                    [b._northEast.lng, b._northEast.lat],
                                ],
                            ],
                        },
                    }
                    if ($('#mainDescNavPopoverExtent input').is(':checked')) {
                        hasBounds = true
                        features = features.filter((f) => {
                            return booleanIntersects(bounds, f)
                        })
                    }

                    let minIndex = Infinity
                    let maxIndex = -Infinity
                    for (let i = 0; i < features.length; i++) {
                        let idx = features[i].properties._.id
                        if (idx < minIndex) minIndex = idx
                        if (idx > maxIndex) maxIndex = idx
                    }

                    // If time-geodataset layer and we're extending past it's limits in the client
                    if (isTimeEnabled) {
                        let offset = 0
                        if (
                            currentIdx == minIndex &&
                            (direction === 'previous' || direction === 'first')
                        ) {
                            offset = -1
                        } else if (
                            currentIdx === maxIndex &&
                            (direction === 'next' || direction === 'last')
                        ) {
                            offset = 1
                        }

                        if (hasBounds && hasTimeBounds) {
                            // If the user is restricting the query to within the
                            // map and existing time range, then we already have
                            // every feature and don't need to query more data
                        } else if (offset != 0) {
                            let geodatasetName = layerData.url
                            if (
                                geodatasetName.indexOf('geodatasets:') === 0 &&
                                isDynamicExtent
                            ) {
                                passThrough = false
                                geodatasetName = geodatasetName.replace(
                                    'geodatasets:',
                                    ''
                                )
                                const body = {
                                    layer: geodatasetName,
                                    id: active.feature.properties._.idx,
                                    orderBy:
                                        field === NAV_DEFAULT_FIELD
                                            ? null
                                            : field,
                                    offset:
                                        direction === 'first' ||
                                        direction === 'last'
                                            ? direction
                                            : offset,
                                    restrictToGeometryType: geomTypeRestriction,
                                }

                                if (hasBounds) {
                                    const c = bounds.geometry.coordinates
                                    body.minx = c[0][1][0]
                                    body.miny = c[0][2][1]
                                    body.maxx = c[0][0][0]
                                    body.maxy = c[0][0][1]
                                }

                                // Buffer out time
                                calls.api(
                                    'geodatasets_search',
                                    body,
                                    function (d) {
                                        if (d.body && d.body.length > 0) {
                                            Description._featureNavTimeUpdate(
                                                layerName,
                                                d.body[0],
                                                bounds,
                                                (f) => {
                                                    resolve(f)
                                                }
                                            )
                                        }
                                    }
                                )
                            } else {
                                // It's a regular time layer and we have all its data locally

                                // Use full geojson this time and refind currentIndex
                                if (
                                    isTimeEnabled &&
                                    !isDynamicExtent &&
                                    Description.L_._localTimeFilterCache[
                                        layerName
                                    ] != null
                                ) {
                                    features = L.geoJson({
                                        type: 'FeatureCollection',
                                        features:
                                            Description.L_
                                                ._localTimeFilterCache[
                                                layerName
                                            ].features,
                                    }).toGeoJSON(
                                        Description.L_.GEOJSON_PRECISION
                                    ).features

                                    currentIdx = null
                                    const aP = JSON.parse(
                                        JSON.stringify(
                                            active.feature.properties
                                        )
                                    )
                                    if (aP._ != null) delete aP._
                                    for (let i = 0; i < features.length; i++) {
                                        if (
                                            F_.isEqual(
                                                activeFeatureGeom,
                                                features[i].geometry,
                                                true
                                            )
                                        ) {
                                            const fP = features[i].properties
                                            if (fP._ != null) delete fP._
                                            if (F_.isEqual(aP, fP, true)) {
                                                currentIdx = i
                                            }
                                        }
                                        features[i].properties._ =
                                            features[i].properties._ || {}
                                        features[i].properties._.id = i
                                    }

                                    // Reapply restrictions in this case
                                    if (geomTypeRestriction) {
                                        features = features.filter((f) => {
                                            return (
                                                geomTypeRestriction ===
                                                f?.geometry?.type
                                            )
                                        })
                                    }

                                    if (hasBounds) {
                                        features = features.filter((f) => {
                                            return booleanIntersects(bounds, f)
                                        })
                                    }
                                }

                                if (
                                    field != null &&
                                    field != NAV_DEFAULT_FIELD
                                ) {
                                    features.sort((a, b) => {
                                        let sign = 1
                                        if (
                                            direction === 'previous' ||
                                            direction === 'first'
                                        )
                                            sign = -1
                                        const af = F_.getIn(
                                            a,
                                            `properties.${field}`,
                                            0
                                        )
                                        const bf = F_.getIn(
                                            b,
                                            `properties.${field}`,
                                            1
                                        )
                                        if (
                                            typeof af === 'string' ||
                                            typeof bf === 'string'
                                        ) {
                                            return af.localeCompare(bf) * sign
                                        } else return (af - bf) * sign
                                    })
                                    sortedFields = true
                                }

                                if (hasTimeBounds) {
                                    features = features.map((f) => {
                                        let startTime
                                        let endTime
                                        if (layerData.time.startProp) {
                                            startTime = F_.getIn(
                                                f.properties,
                                                layerData.time.startProp
                                            )
                                        }
                                        if (layerData.time.endProp) {
                                            endTime = F_.getIn(
                                                f.properties,
                                                layerData.time.endProp
                                            )
                                        }
                                        const currentStart = new Date(
                                            TimeControl.getStartTime()
                                        ).getTime()
                                        const currentEnd = new Date(
                                            TimeControl.getEndTime()
                                        ).getTime()

                                        startTime =
                                            startTime != null
                                                ? new Date(startTime).getTime()
                                                : null
                                        endTime =
                                            endTime != null
                                                ? new Date(endTime).getTime()
                                                : null

                                        if (
                                            startTime == null &&
                                            endTime == null
                                        ) {
                                            return false
                                        } else if (
                                            startTime == null &&
                                            endTime != null
                                        ) {
                                            if (
                                                endTime >= currentStart &&
                                                endTime <= currentEnd
                                            )
                                                return true
                                        } else if (
                                            startTime != null &&
                                            endTime == null
                                        ) {
                                            if (
                                                startTime >= currentStart &&
                                                startTime <= currentEnd
                                            )
                                                return true
                                        } else if (
                                            startTime != null &&
                                            endTime != null
                                        ) {
                                            if (
                                                !(
                                                    endTime < currentStart ||
                                                    startTime > currentEnd
                                                )
                                            )
                                                return true
                                        }
                                        return false
                                    })
                                }

                                // parse through leaflet to ensure matching precision
                                // Find feature
                                let nextFeature
                                if (direction === 'first')
                                    nextFeature = features[0]
                                else if (direction === 'last')
                                    nextFeature = features[features.length - 1]
                                else {
                                    for (
                                        let i = 0;
                                        i < features.length - 1;
                                        i++
                                    ) {
                                        if (
                                            features[i].properties &&
                                            features[i].properties._.id ===
                                                currentIdx
                                        ) {
                                            nextFeature =
                                                features[
                                                    i +
                                                        (sortedFields
                                                            ? 1
                                                            : direction ===
                                                              'previous'
                                                            ? -1
                                                            : 1)
                                                ]
                                            break
                                        }
                                    }
                                }

                                if (nextFeature) {
                                    Description._featureNavTimeUpdate(
                                        layerName,
                                        nextFeature,
                                        bounds
                                    )
                                }
                            }
                        }
                    }

                    if (passThrough === true) {
                        if (field != null && field != NAV_DEFAULT_FIELD) {
                            features.sort((a, b) => {
                                let sign = 1
                                if (
                                    direction === 'previous' ||
                                    direction === 'first'
                                )
                                    sign = -1
                                const af = F_.getIn(a, `properties.${field}`, 0)
                                const bf = F_.getIn(b, `properties.${field}`, 1)
                                if (
                                    typeof af === 'string' ||
                                    typeof bf === 'string'
                                ) {
                                    return af.localeCompare(bf) * sign
                                } else return (af - bf) * sign
                            })
                            sortedFields = true
                        }

                        let minFieldIndex = minIndex
                        let maxFieldIndex = maxIndex
                        if (sortedFields) {
                            if (
                                direction === 'previous' ||
                                direction === 'first'
                            ) {
                                minFieldIndex =
                                    features[features.length - 1].properties._
                                        .id
                                maxFieldIndex = features[0].properties._.id
                            } else {
                                minFieldIndex = features[0].properties._.id
                                maxFieldIndex =
                                    features[features.length - 1].properties._
                                        .id
                            }
                        }

                        if (
                            hasBounds &&
                            ((currentIdx == minFieldIndex &&
                                (direction === 'previous' ||
                                    direction === 'first')) ||
                                (currentIdx === maxFieldIndex &&
                                    (direction === 'next' ||
                                        direction === 'last')))
                        ) {
                            // Stop the selectFeature function from making a relative selection
                            // if we're already at one of its limits
                            resolve(0)
                            return
                        }
                        if (
                            !hasBounds &&
                            Description.navPopoverField === NAV_DEFAULT_FIELD &&
                            direction === 'previous'
                        ) {
                            resolve(-1)
                            return
                        }
                        if (
                            !hasBounds &&
                            Description.navPopoverField === NAV_DEFAULT_FIELD &&
                            direction === 'next'
                        ) {
                            resolve(1)
                            return
                        }

                        if (direction === 'first') {
                            resolve(minFieldIndex - currentIdx)
                            return
                        } else if (direction === 'last') {
                            resolve(maxFieldIndex - currentIdx)
                            return
                        } else {
                            for (let i = 0; i < features.length; i++) {
                                if (
                                    features[i].properties._.id === currentIdx
                                ) {
                                    const nextFeature =
                                        features[
                                            i +
                                                (sortedFields
                                                    ? 1
                                                    : direction === 'previous'
                                                    ? -1
                                                    : 1)
                                        ]
                                    if (nextFeature != null) {
                                        resolve(
                                            nextFeature.properties._.id -
                                                features[i].properties._.id
                                        )
                                    }
                                    return
                                }
                            }
                        }
                    }
                }
                if (passThrough) resolve(0)
            }
            if (passThrough) resolve(0)
        })
    },
    _featureNavTimeUpdate(layerName, feature, bounds, cb) {
        const f = feature

        const layerData = Description.L_.layers.data[layerName]

        // Make sure feature geometry is within screen bounds,
        // If not, we pan to is regardless of the checkbox
        if (!booleanIntersects(bounds, f)) {
            const bboxf = bbox(f)
            const southWest = new L.LatLng(bboxf[1], bboxf[0])
            const northEast = new L.LatLng(bboxf[3], bboxf[2])
            Description.Map_.map.fitBounds(
                new L.LatLngBounds(southWest, northEast)
            )
        }

        // Next adjust time
        let startTime
        let endTime
        if (layerData.time.startProp) {
            startTime = F_.getIn(f.properties, layerData.time.startProp)
        }
        if (layerData.time.endProp) {
            endTime = F_.getIn(f.properties, layerData.time.endProp)
        }
        const currentStart = new Date(TimeControl.getStartTime()).getTime()
        const currentEnd = new Date(TimeControl.getEndTime()).getTime()

        const desiredStart =
            startTime != null ? new Date(startTime).getTime() : currentStart
        const desiredEnd =
            endTime != null ? new Date(endTime).getTime() : currentEnd

        let nextStart =
            startTime != null && desiredStart < currentStart
                ? startTime
                : TimeControl.getStartTime()
        let nextEnd =
            endTime != null && desiredEnd > currentEnd
                ? endTime
                : TimeControl.getEndTime()

        // If this is an endTime only feature, account for bumping back the start if needed
        if (startTime == null && endTime != null && desiredEnd < currentStart) {
            nextStart = endTime
            nextEnd = TimeControl.getEndTime()
        }
        const popoverOpen = $(`#mainDescNavPopover`).css('display') === 'block'

        Description.L_.subscribeTimeLayerReloadFinish(layerName, () => {
            Description.L_.unsubscribeTimeLayerReloadFinish(layerName)
            // Then reopen popover
            if (popoverOpen) {
                $(`#mainDescNavBarMenu`).css({
                    background: 'var(--color-c)',
                })
                $(`#mainDescNavPopover`).css({
                    display: 'block',
                })
            }
            cb(f)
            return
        })

        // Ignore the next dynamicExtent move thresholds
        if (
            layerData.variables?.dynamicExtent === true &&
            layerData.variables?.dynamicExtentMoveThreshold != null
        )
            layerData._ignoreDynamicExtentMoveThreshold = true
        // Disable active feature so that the layer reload doesn't reselect it
        Description.L_.setActiveFeature(null)
        TimeControl.setTime(nextStart, nextEnd)
    },
    updateInfo(force, forceFeature, skipRequery) {
        if (force !== true) {
            this.waitingOnUpdate = false
            if (!this.inited) {
                this.waitingOnUpdate = true
                return
            }
        }

        this.descInfoCont.html('')

        let infos = []

        for (let layer in this.L_.layers.data) {
            let l = this.L_.layers.data[layer]
            if (
                this.L_.layers.on[layer] === true &&
                this.L_.layers.layer[layer] &&
                l.hasOwnProperty('variables') &&
                l.variables.hasOwnProperty('info') &&
                l.variables.info.hasOwnProperty('length')
            ) {
                let layers = this.L_.layers.layer[layer]._layers

                if (
                    Object.keys(layers).length === 0 &&
                    this.L_.layers.data[layer].variables.dynamicExtent
                ) {
                    let geodatasetName = this.L_.layers.data[layer].url
                    if (
                        skipRequery !== true &&
                        geodatasetName.indexOf('geodatasets:') === 0
                    ) {
                        geodatasetName = geodatasetName.replace(
                            'geodatasets:',
                            ''
                        )

                        calls.api(
                            'geodatasets_search',
                            {
                                layer: geodatasetName,
                                last: true,
                            },
                            function (d) {
                                Description.updateInfo(
                                    false,
                                    d?.body?.[0],
                                    true
                                )
                            },
                            function (d) {}
                        )
                        return
                    }
                }
                let newInfo = ''

                for (let i = 0; i < l.variables.info.length; i++) {
                    let which = 0
                    which =
                        l.variables.info[i].which != null &&
                        !isNaN(l.variables.info[i].which)
                            ? Math.max(
                                  Math.min(
                                      which,
                                      Object.keys(layers).length - 1
                                  ),
                                  0
                              )
                            : Object.keys(layers).length - 1
                    let feature =
                        forceFeature ||
                        layers[Object.keys(layers)[which]]?.feature
                    if (feature == null) {
                        continue
                    }

                    let infoText = F_.bracketReplace(
                        l.variables.info[i].value,
                        feature.properties
                    )
                    let lat = !isNaN(feature.geometry.coordinates[1])
                        ? feature.geometry.coordinates[1]
                        : null
                    let lng = !isNaN(feature.geometry.coordinates[0])
                        ? feature.geometry.coordinates[0]
                        : null

                    newInfo +=
                        '<div lat="' +
                        lat +
                        '" lng="' +
                        lng +
                        '" tabindex="' +
                        (301 + i) +
                        '">'
                    if (l.variables.info[i].icon)
                        newInfo +=
                            "<i class='mdi mdi-" +
                            l.variables.info[i].icon +
                            " mdi-18px'></i>"
                    newInfo += '<div>' + infoText + '</div></div>'

                    // Go initially
                    if (Description._infoAlreadyGone == false) {
                        if (l.variables.info[i].go == true) {
                            if (lat != null && lng != null) {
                                Description.Map_.map.setView(
                                    [lat, lng],
                                    Description.Map_.mapScaleZoom ||
                                        Description.Map_.map.getZoom()
                                )
                            }
                            Description._infoAlreadyGone = true
                        }
                    }
                }
                if (newInfo.length > 0) infos.push(newInfo)
            }
        }
        this.descInfoCont.html(infos.join('\n'))

        this.descInfoCont.style('display', 'flex')
        $('.mainInfo').animate(
            {
                opacity: 1,
            },
            80
        )

        d3.select('.mainInfo > div').on('click', function () {
            let lat = d3.select(this).attr('lat')
            let lng = d3.select(this).attr('lng')

            if (lat != null && lng != null && lat != 'null' && lng != 'null') {
                Description.Map_.map.setView(
                    [lat, lng],
                    Description.Map_.mapScaleZoom ||
                        Description.Map_.map.getZoom()
                )
            }
        })
        Description._infoAlreadyGone = true
    },
    updatePoint: function (activeLayer) {
        if (
            activeLayer == null ||
            Description.L_.layers.data[activeLayer.options.layerName] == null
        )
            return

        if (Description._popoverOpen) {
            Description._updatePopoverDropy()
            $(`#mainDescNavBarMenu`).css({
                background: 'var(--color-c)',
            })
            $(`#mainDescNavPopover`).css({
                display: 'block',
            })
        }
        this.descCont.style('display', 'flex')
        $('.mainDescription').animate(
            {
                opacity: 1,
            },
            80
        )
        if (
            activeLayer != null &&
            activeLayer.feature &&
            activeLayer.hasOwnProperty('options')
        ) {
            var keyAsName
            const links = []

            if (
                this.L_.layers.data[activeLayer.options.layerName] &&
                this.L_.layers.data[activeLayer.options.layerName].variables
            ) {
                let v =
                    this.L_.layers.data[activeLayer.options.layerName].variables

                if (v.links) {
                    for (let i = 0; i < v.links.length; i++) {
                        const link = F_.bracketReplace(
                            v.links[i].link,
                            activeLayer.feature.properties,
                            v.links[i].replace
                        )
                        if (link != null && link != '')
                            links.push({
                                name: `<span style='display: flex; justify-content: space-between;'>${v.links[i].name}<i class='mdi mdi-open-in-new mdi-14px' style='margin-left: 4px; margin-top: 1px;'></i></span>`,
                                link: link,
                                target: F_.cleanString(v.links[i].name),
                            })
                    }
                }

                // check if this is actually a STAC feature
                if (activeLayer.feature.stac_version) {
                    // extract links from feature assets
                    // https://github.com/radiantearth/stac-spec/blob/master/commons/assets.md#assets--
                    if (activeLayer.feature.assets) {
                        const assetKeys = Object.keys(
                            activeLayer.feature.assets
                        )
                        for (let i = 0; i < assetKeys.length; i++) {
                            const asset =
                                activeLayer.feature.assets[assetKeys[i]]
                            const link = asset?.href
                            const title = asset?.title
                            const roles = asset?.roles
                            if (
                                link !== null &&
                                link !== '' &&
                                (!roles || roles.indexOf('data') !== -1)
                            )
                                links.push({
                                    name: `<span style='display: flex; justify-content: space-between;'>${title}<i class='mdi mdi-open-in-new mdi-14px' style='margin-left: 4px; margin-top: 1px;'></i></span>`,
                                    link: link,
                                    target: F_.cleanString(title),
                                })
                        }
                    }
                }
            }

            let key = activeLayer.useKeyAsName || 'name'

            if (
                !(
                    typeof activeLayer.feature.properties[key] === 'string' ||
                    typeof activeLayer.feature.properties[key] === 'number'
                )
            ) {
                const propKeys = Object.keys(activeLayer.feature.properties)
                for (let i = 0; i < propKeys.length; i++) {
                    if (
                        typeof activeLayer.feature.properties[propKeys[i]] ===
                            'string' ||
                        typeof activeLayer.feature.properties[propKeys[i]] ===
                            'number'
                    ) {
                        key = propKeys[i]
                        break
                    }
                }
            }

            keyAsName =
                ` <div style="max-width: 180px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${activeLayer.feature.properties[key]}</div>` +
                ' <div class="mainDescPointInnerType" style="font-size: 11px; padding: 0px 3px; opacity: 0.8;">(' +
                key +
                ')</div>'

            Description.descPointInner.html(
                Description.L_.layers.data[activeLayer.options.layerName]
                    .display_name +
                    ': ' +
                    keyAsName
            )

            $('#mainDescPointLinks_global').remove()
            const globalConstruct = Dropy.construct(
                links.map((l) => l.name),
                `<i class='mdi mdi-link mdi-18px'></i>`,
                null,
                {
                    openUp: false,
                    dark: true,
                }
            )
            $('#mainDescPointLinks').html(globalConstruct)
            Dropy.init(
                $('#mainDescPointLinks'),
                function (idx) {
                    if (links[idx] && links[idx].link)
                        window.open(
                            links[idx].link,
                            links[idx].target || '_blank'
                        )
                },
                null,
                null,
                { dontChange: true, globalConstruct }
            )

            if (Description.tippyDesc && Description.tippyDesc[0])
                Description.tippyDesc[0].setContent(
                    activeLayer.feature.properties[key]
                )
            else
                Description.tippyDesc = tippy('#mainDescPointInner', {
                    content: activeLayer.feature.properties[key],
                    placement: 'bottom',
                    theme: 'blue',
                })

            if (Description.tippyMenu == null)
                Description.tippyMenu = tippy('#mainDescNavBarMenu', {
                    content: 'Feature Navigation',
                    placement: 'bottom',
                    theme: 'blue',
                })
            if (Description.tippyPrevious == null)
                Description.tippyPrevious = tippy('#mainDescNavBarPrevious', {
                    content: 'Previous Feature',
                    placement: 'bottom',
                    theme: 'blue',
                })
            if (Description.tippyNext == null)
                Description.tippyNext = tippy('#mainDescNavBarNext', {
                    content: 'Next Feature',
                    placement: 'bottom',
                    theme: 'blue',
                })

            // Hide/Show feature popover nav time extent check if appropriate
            const popoverTimeExtentDiv = $('#mainDescNavPopoverTimeExtent')
            if (popoverTimeExtentDiv) {
                const ld = this.L_.layers.data[activeLayer.options.layerName]
                if (ld && ld.time && ld.time.enabled === true) {
                    popoverTimeExtentDiv.css('display', 'flex')
                } else {
                    popoverTimeExtentDiv.css('display', 'none')
                }
            }
        }
    },
    clearDescription: function () {
        // Use delay timeout to avoid flickering in the case the next feature needs to be loaded
        clearTimeout(Description._clearDescTimeout)
        Description._clearDescTimeout = setTimeout(() => {
            if (Description.L_.activeFeature == null) {
                // Clear the description
                $('#mainDescPointInner').empty()
                $('#mainDescPointLinks').empty()

                // Reset the style
                this.descCont.attr('style', null)

                // Close Nav Popover
                $(`#mainDescNavBarMenu`).css({
                    background: 'var(--color-a)',
                })
                $(`#mainDescNavPopover`).css({
                    display: 'none',
                })
            }
        }, 1000)
    },
}

export default Description
