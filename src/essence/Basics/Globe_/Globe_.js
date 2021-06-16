import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'

import LithoSphere from 'lithosphere'

let Globe_ = {
    litho: null,
    controls: {
        link: null,
    },
    init: function () {
        const containerId = 'globe'
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
            zoom: initialView[2],
        }

        this.litho = new LithoSphere(containerId, {
            initialView,
            //opt
            tileMapResource: {
                bounds: [0, 0, 0, 0],
                origin: [0, 0],
                proj: null, // proj4 string describing the global tileset projection: string (opt) | default wgs84
                resunitsperpixel: 34,
                reszoomlevel: 0,
            },
            majorRadius: F_.radiusOfPlanetMajor,
            minorRadius: F_.radiusOfPlanetMinor,
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
            highlightColor: 'yellow', //css color for vector hover highlights | default 'yellow'
            activeColor: 'red', //css color for active vector features | default 'red'
        })

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
            'mmgisLithoCoords',
            this.litho.controls.coordinates,
            {
                existingDivId: 'mouseLngLat',
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
    },
    reset: function () {},
    setLink: function () {},
    highlight: function () {},
    findSpriteObject: function () {},
    radargram: function () {},
}

export default Globe_
