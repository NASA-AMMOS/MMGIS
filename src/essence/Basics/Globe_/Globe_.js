import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import $ from 'jquery'

import TimeControl from '../TimeControl_/TimeControl'
import GlobeRenderer from './GlobeRenderer'

let Globe_ = {
    litho: null,
    id: 'globe',
    renderType: null, // default lithosphere
    controls: {
        link: null,
    },
    hasBeenOpened: false, // Track if Globe panel has been opened before
    init: function () {
        const containerId = this.id

        // Idempotent: if a renderer (real or mock) already exists for this
        // container, just re-sync size and bail. This prevents subsequent
        // init() calls from the toggle path (uiStore setTimeout + TopBar
        // requestAnimationFrame) and any future code from leaking a second
        // GlobeRenderer instance on top of the first.
        if (this.litho) {
            if (typeof this.litho.invalidateSize === 'function') {
                this.litho.invalidateSize()
            }
            return
        }

        let initialView = null
        if (L_.FUTURES.globeView != null) {
            initialView = L_.FUTURES.globeView
        } else if (L_.FUTURES.mapView != null) {
            initialView = L_.FUTURES.mapView
        } else {
            initialView = L_.view
        }

        this.rendererType =
            L_.configData.panelSettings &&
            L_.configData.panelSettings.globeRenderer
                ? L_.configData.panelSettings.globeRenderer
                : 'lithosphere'

        initialView = {
            lat: initialView[0],
            lng: initialView[1],
            zoom: initialView[2] != null ? initialView[2] : L_.view[2],
        }

        const initialCamera = L_.FUTURES.globeCamera
            ? {
                  position: {
                      x: L_.FUTURES.globeCamera[0],
                      y: L_.FUTURES.globeCamera[1],
                      z: L_.FUTURES.globeCamera[2],
                  },
                  target: {
                      x: L_.FUTURES.globeCamera[3],
                      y: L_.FUTURES.globeCamera[4],
                      z: L_.FUTURES.globeCamera[5],
                  },
              }
            : null

        const tmr =
            L_.configData.projection && L_.configData.projection.custom === true
                ? {
                      bounds: L_.configData.projection.bounds,
                      origin: L_.configData.projection.origin,
                      crsCode: L_.configData.projection.epsg,
                      proj: L_.configData.projection.proj,
                      resunitsperpixel: parseFloat(
                          L_.configData.projection.resunitsperpixel
                      ),
                      reszoomlevel: parseInt(
                          L_.configData.projection.reszoomlevel
                      ),
                  }
                : {
                      bounds: [0, 0, 0, 0],
                      origin: [0, 0],
                      proj: null, // proj4 string describing the global tileset projection: string (opt) | default wgs84
                      resunitsperpixel: 32,
                      reszoomlevel: 0,
                  }

        const lithoConfig = {
            initialView,
            //opt
            initialCamera,
            tileMapResource: tmr,
            majorRadius: F_.radiusOfPlanetMajor,
            minorRadius: F_.radiusOfPlanetMinor,
            radiusOfTiles: 5,
            blockInitialAnimate: !L_.hasGlobe,
            //renderOnlyWhenOpen: false, //default true
            //wireframeMode: true, // default false
            //useLOD: true, // default true
            starsphere: {
                url: 'public/images/eso0932a.jpg',
                color: '#444444',
            },
            atmosphere: {
                color: '#0c0c0c',
            },
            canBecomeHighlighted: false,
            highlightColor: 'yellow', //css color for vector hover highlights | default 'yellow'
            canBecomeActive: false,
            activeColor: 'red', //css color for active vector features | default 'red'
        }

        if (
            L_.configData.panelSettings &&
            L_.configData.panelSettings.demFallbackPath
        )
            lithoConfig.demFallback = {
                demPath: !F_.isUrlAbsolute(
                    L_.configData.panelSettings.demFallbackPath
                )
                    ? L_.missionPath +
                      L_.configData.panelSettings.demFallbackPath
                    : L_.configData.panelSettings.demFallbackPath,
                format: L_.configData.panelSettings.demFallbackFormat || 'tms',
                parserType:
                    L_.configData.panelSettings.demFallbackType || 'rgba',
            }

        // CONSTRUCTOR - Use GlobeRenderer abstraction
        this.litho = new GlobeRenderer(
            containerId,
            lithoConfig,
            this.rendererType
        )

        if (!L_.hasGlobe) {
            this.litho = this.getMockLitho(this.litho)
            return
        }

        this.litho.addControl('mmgisLithoHome', this.litho.controls.home, null, 'TopRight')
        this.litho.addControl(
            'mmgisLithoExaggerate',
            this.litho.controls.exaggerate,
            null,
            'TopRight'
        )
        //this.litho.addControl('mmgisLithoLayers', this.litho.controls.layers)
        this.litho.addControl('mmgisLithoObserve', this.litho.controls.observe, null, 'TopRight')
        this.litho.addControl('mmgisLithoWalk', this.litho.controls.walk, null, 'TopRight')
        this.litho.addControl('mmgisLithoCompass', this.litho.controls.compass, null, 'TopRight')
        this.litho.addControl(
            'mmgisLithoNavigation',
            this.litho.controls.navigation,
            null,
            'TopRight'
        )
        this.litho.addControl(
            'mmgisLithoCoords',
            this.litho.controls.coordinates,
            {
                //existingDivId: 'mouseLngLat',
                hideElement: true,
                onChange: (lng, lat, elev) => {
                    if (lng == null || lat == null) {
                        L_.Coordinates.setCoords(
                            [null, null, null],
                            'Outer Space'
                        )
                    } else {
                        const converted = L_.Coordinates.convertLngLat(
                            lng,
                            lat,
                            L_.Coordinates.currentType,
                            true
                        )
                        L_.Coordinates.setCoords(
                            [lng, lat, elev],
                            `${converted[0]}, ${converted[1]}`
                        )
                    }

                    $('#mouseElev')
                        .css({ display: 'block', opacity: 1 })
                        .text(elev != null ? `, ${elev.toFixed(3)}m` : '')
                },
            }
        )

        this.controls.link = this.litho.addControl(
            'mmgisLithoLink',
            this.litho.controls.link,
            {
                initiallyLinked: false,
                // callbacks
                onMove: (lng, lat, height) => {
                    /*React to globe move*/
                    L_.Map_.resetView([lat, lng], true)
                },
                onMouseMove: (lng, lat) => {
                    L_.Map_.setPlayerLookat(lng, lat)
                },
                onMouseOut: () => {
                    L_.Map_.hidePlayer()
                },
                onToggle: (isLinked) => {},
                onFirstPersonUpdate: () => {
                    // Only LithoSphere supports first-person camera mode
                    if (this.rendererType !== 'lithosphere') return

                    const center = this.litho.getCenter()
                    L_.Map_.setPlayerArrow(
                        center.lng,
                        center.lat,
                        (this.litho._.cameras.firstPerson.controls.getObject()
                            .rotation.y %
                            (Math.PI * 2)) +
                            Math.PI
                    )
                    L_.Map_.setPlayerLookat(
                        this.litho.mouse.lng,
                        this.litho.mouse.lat
                    )
                },
                onOrbitalUpdate: () => {
                    L_.Map_.hidePlayer()
                },
            },
            'TopRight'
        )
        // Subscribe to time changes for Cesium renderer
        if (
            this.rendererType === 'cesium' &&
            typeof TimeControl !== 'undefined'
        ) {
            L_.subscribeTimeChange('globe_cesium_time', (timeData) => {
                this.litho.updateAllTimeEnabledLayers(
                    timeData.startTime,
                    timeData.currentTime,
                    timeData.endTime,
                    TimeControl.customTimes
                )
            })
        }

        // Watch globe movement so dynamic-extent layers re-query from the
        // Globe's own viewport (also covers the case where the Map panel is
        // closed and the 2D map can't supply a usable extent).
        this.startDynamicExtentWatcher()

        //console.log(this.litho)
    },
    fina: function (coordinates) {
        // Passes in Coordinates so that LithoSphere can share the same coordinate ui element
        // as the rest of the application
        $(`#${this.id}`).on('mousemove', () => {
            coordinates.hideElevation()
        })

    },
    getMockLitho: function () {
        return {
            removeLayer: function () {},
            // Mirror GlobeRenderer.addLayer's async contract so callers that
            // chain .then()/.catch() work when there is no globe panel.
            addLayer: function () {
                return Promise.resolve()
            },
            toggleLayer: function () {},
            hasLayer: function () {},
            getCenter: function () {},
            setCenter: function () {},
            getCameras: function () {},
            setLayerOpacity: function () {},
            setLayerFilterEffect: function () {},
            orderLayers: function () {},
            invalidateSize: function () {},
            setLayerSpecificOptions: function () {},
            setGradientHoverPoint: function () {},
            clearGradientHoverPoint: function () {},
            getElevationAtLngLat: function () {
                return 0
            },
            projection: this.litho.projection,
            _: {},
            options: {},
        }
    },
    reset: function () {},
    setLink: function () {},
    syncToMapCenter: function () {
        // Sync Globe center to Map's current center on first open
        if (L_.Map_ && L_.Map_.map) {
            const mapCenter = L_.Map_.map.getCenter()
            const mapZoom = L_.Map_.map.getZoom()

            if (this.litho && this.litho.setCenter) {
                this.litho.setCenter({
                    lat: mapCenter.lat,
                    lng: mapCenter.lng,
                    zoom: mapZoom,
                })
            }
        }
    },
    // The globe bbox is padded beyond the strict top-down footprint so tilted
    // views (looking across the terrain toward the horizon) still query the
    // features that are visible but outside the nadir box. The pad scales with
    // camera tilt: GLOBE_EXTENT_PAD_MIN at nadir up to GLOBE_EXTENT_PAD_MAX
    // when looking parallel to the ground (e.g. 1x -> 3x extent at full tilt).
    GLOBE_EXTENT_PAD_MIN: 1.5,
    GLOBE_EXTENT_PAD_MAX: 3,
    // The zoom by which the pad above applies in full. A wider view than this
    // needs little: a perspective camera hides far less beyond the edges of a
    // continent-sized box than of a city-sized one, and padding a wide box
    // runs it into the poles and the antimeridian.
    GLOBE_EXTENT_PAD_FULL_ZOOM: 6,
    // How much a renderer-reported view rectangle is grown, so features right
    // at the edge of the view are still queried.
    GLOBE_EXTENT_RECT_PAD: 1.1,
    // Computes the Globe's current visible extent as a lat/lng bbox
    // (EPSG:4326, what the geodatasets endpoint filters on). Taken from the
    // renderer's own view rectangle where it has one, otherwise derived from
    // the globe center + zoom + panel pixel size. The box is clamped to the
    // poles and to [-180, 180] and never wraps.
    getExtent: function () {
        try {
            if (!this.litho || typeof this.litho.getCenter !== 'function')
                return null
            const center =
                typeof this.litho.getExtentCenter === 'function'
                    ? this.litho.getExtentCenter()
                    : this.litho.getCenter()
            if (!center || center.lng == null || center.lat == null)
                return null

            let zoom = center.zoom
            if (zoom == null || isNaN(zoom))
                zoom = (L_.Map_ && L_.Map_.map && L_.Map_.map.getZoom()) || 0

            const centerLng = center.lng
            const centerLat = center.lat

            // Widen the box with camera tilt so a view looking across the
            // terrain still captures features toward the horizon.
            let tiltFraction = 0
            if (typeof this.litho.getViewTiltFraction === 'function')
                tiltFraction = this.litho.getViewTiltFraction()
            const pad =
                this.GLOBE_EXTENT_PAD_MIN +
                (this.GLOBE_EXTENT_PAD_MAX - this.GLOBE_EXTENT_PAD_MIN) *
                    tiltFraction

            // A renderer that knows its own frustum knows this better than any
            // zoom model can, and has already accounted for the tilt.
            const rect =
                typeof this.litho.getViewRectangle === 'function'
                    ? this.litho.getViewRectangle()
                    : null
            if (rect != null) {
                const grow = this.GLOBE_EXTENT_RECT_PAD
                const halfLng = ((rect.maxx - rect.minx) / 2) * grow
                const halfLat = ((rect.maxy - rect.miny) / 2) * grow
                const midLng = (rect.minx + rect.maxx) / 2
                const midLat = (rect.miny + rect.maxy) / 2
                return Object.assign(
                    {
                        zoom: zoom,
                        tilt: Math.round(tiltFraction * 10),
                        centerLng: centerLng,
                        centerLat: centerLat,
                    },
                    this.clampExtent(
                        midLng - halfLng,
                        midLat - halfLat,
                        midLng + halfLng,
                        midLat + halfLat
                    )
                )
            }

            const el = document.getElementById(this.id)
            const widthPx = (el && el.clientWidth) || 1024
            const heightPx = (el && el.clientHeight) || 768

            // Taper the pad off as the view widens, so a low zoom is not
            // padded into covering the whole body.
            const padScale = Math.max(
                0,
                Math.min(1, zoom / this.GLOBE_EXTENT_PAD_FULL_ZOOM)
            )
            const padded = 1 + (pad - 1) * padScale

            // Leaflet-style zoom: the full 360deg of longitude spans
            // 256 * 2^zoom pixels.
            const worldPx = 256 * Math.pow(2, zoom)
            const degPerPxLng = 360 / worldPx

            const halfWidthDeg = (widthPx / 2) * degPerPxLng * padded
            // Widen the latitude span toward the poles (Mercator stretch) so
            // the box over-approximates rather than clipping edge features.
            const cosLat = Math.max(
                0.15,
                Math.cos((centerLat * Math.PI) / 180)
            )
            const halfHeightDeg =
                (((heightPx / 2) * degPerPxLng) / cosLat) * padded

            return Object.assign(
                {
                    zoom: zoom,
                    // Bucketed so small tilt jitter doesn't spam re-queries but
                    // a meaningful tilt change still retriggers one.
                    tilt: Math.round(tiltFraction * 10),
                    centerLng: centerLng,
                    centerLat: centerLat,
                },
                this.clampExtent(
                    centerLng - halfWidthDeg,
                    centerLat - halfHeightDeg,
                    centerLng + halfWidthDeg,
                    centerLat + halfHeightDeg
                )
            )
        } catch (e) {
            return null
        }
    },
    // Never wrap: a box spanning the world takes the full longitude range,
    // anything else is clamped to the body.
    clampExtent: function (minx, miny, maxx, maxy) {
        if (maxx - minx >= 360) {
            minx = -180
            maxx = 180
        } else {
            if (minx < -180) minx = -180
            if (maxx > 180) maxx = 180
        }
        return {
            minx: minx,
            miny: Math.max(-90, miny),
            maxx: maxx,
            maxy: Math.min(90, maxy),
        }
    },
    _dynamicExtentWatcher: null,
    _dynamicExtentSettleTimeout: null,
    _lastDynamicExtentKey: null,
    // Polls the globe center/zoom and, once movement settles, re-runs every
    // active dynamic-extent layer's query using the Globe's own extent. This
    // is renderer-agnostic (works for LithoSphere and Cesium) and avoids
    // depending on renderer-specific camera-move events.
    startDynamicExtentWatcher: function () {
        if (this._dynamicExtentWatcher != null) return
        this._dynamicExtentWatcher = setInterval(() => {
            if (!this.litho || typeof this.litho.getCenter !== 'function')
                return
            // Skip the (raycast) work while the Globe panel isn't visible.
            const el = document.getElementById(this.id)
            if (el && el.clientWidth === 0 && el.clientHeight === 0) return
            let center
            try {
                center =
                    typeof this.litho.getExtentCenter === 'function'
                        ? this.litho.getExtentCenter()
                        : this.litho.getCenter()
            } catch (e) {
                return
            }
            if (!center || center.lng == null || center.lat == null) return
            let tiltBucket = 0
            if (typeof this.litho.getViewTiltFraction === 'function')
                tiltBucket = Math.round(this.litho.getViewTiltFraction() * 10)
            const key =
                center.lng.toFixed(5) +
                ',' +
                center.lat.toFixed(5) +
                ',' +
                (center.zoom != null ? center.zoom : '') +
                ',' +
                tiltBucket
            if (key === this._lastDynamicExtentKey) return
            this._lastDynamicExtentKey = key
            clearTimeout(this._dynamicExtentSettleTimeout)
            this._dynamicExtentSettleTimeout = setTimeout(() => {
                this._fireDynamicExtentMove()
            }, 300)
        }, 150)
    },
    stopDynamicExtentWatcher: function () {
        if (this._dynamicExtentWatcher != null) {
            clearInterval(this._dynamicExtentWatcher)
            this._dynamicExtentWatcher = null
        }
        clearTimeout(this._dynamicExtentSettleTimeout)
    },
    _fireDynamicExtentMove: function () {
        const subs = L_._onSpecificLayerToggleSubscriptions
        if (!subs) return
        Object.keys(subs).forEach((k) => {
            if (k.indexOf('dynamicextent_') !== 0) return
            const sub = subs[k]
            if (
                sub &&
                L_.layers.on[sub.layer] === true &&
                typeof sub.func === 'function'
            ) {
                sub.func({ fromGlobe: true })
            }
        })
    },
    highlight: function (layerName, feature) {
        if (this.litho && this.litho.highlightFeature) {
            this.litho.highlightFeature(layerName, feature)
        }
    },
    clearHighlight: function () {
        if (this.litho && this.litho.clearHighlight) {
            this.litho.clearHighlight()
        }
    },
    findSpriteObject: function () {},
    radargram: function () {},
}

export default Globe_
