import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import $ from 'jquery'

import LithoSphere from 'lithosphere'

let Globe_ = {
    litho: null,
    id: 'globe',
    controls: {
        link: null,
    },
    init: function () {
        const containerId = this.id
        let initialView = null
        if (L_.FUTURES.globeView != null) {
            initialView = L_.FUTURES.globeView
        } else if (L_.FUTURES.mapView != null) {
            initialView = L_.FUTURES.mapView
        } else {
            initialView = L_.view
        }

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

        // CONSTRUCTOR
        this.litho = new LithoSphere(containerId, lithoConfig)

        if (!L_.hasGlobe) {
            this.litho = this.getMockLitho(this.litho)
            return
        }

        this.litho.addControl('mmgisLithoHome', this.litho.controls.home)
        this.litho.addControl(
            'mmgisLithoExaggerate',
            this.litho.controls.exaggerate
        )
        //this.litho.addControl('mmgisLithoLayers', this.litho.controls.layers)
        this.litho.addControl('mmgisLithoObserve', this.litho.controls.observe)
        this.litho.addControl('mmgisLithoWalk', this.litho.controls.walk)
        this.litho.addControl('mmgisLithoCompass', this.litho.controls.compass)
        this.litho.addControl(
            'mmgisLithoNavigation',
            this.litho.controls.navigation
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
            }
        )

        //console.log(this.litho)
    },
    fina: function (coordinates) {
        // Passes in Coordinates so that LithoSphere can share the same coordinate ui element
        // as the rest of the application
        $(`#${this.id}`).on('mousemove', () => {
            coordinates.hideElevation()
        })

        // Because there might be separated tools, push all the control below them:
        // First find all left justified separated tools
        let numSep = 0
        L_.configData.tools.forEach((t) => {
            if (
                t.separatedTool === true &&
                (t.variables == null || t.variables.justification != 'right')
            )
                numSep++
        })
        $('#_lithosphere_controls_topleft').attr(
            'style',
            function (index, currentStyles) {
                return `${currentStyles} top: ${
                    40 + numSep * 35
                }px !important; left: 7px;`
            }
        )
    },
    getMockLitho: function () {
        return {
            removeLayer: function () {},
            addLayer: function () {},
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
    highlight: function () {},
    findSpriteObject: function () {},
    radargram: function () {},
}

export default Globe_
