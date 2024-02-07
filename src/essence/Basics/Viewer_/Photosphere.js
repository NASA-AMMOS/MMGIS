import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import Sprites from '../../Ancillary/Sprites'
import Hammer from 'hammerjs'
import WebVR from '../../../external/THREE/WebVR'

import * as THREE from '../../../external/THREE/three118'

import './Photosphere.css'

export default function (domEl, lookupPath, options, Map_) {
    options = options || {}

    var camera,
        controls,
        scene,
        renderer,
        sphere,
        sphereRadius = 100,
        sphereRot = 0,
        loader
    var raycaster = new THREE.Raycaster()
    var mouse = new THREE.Vector2()
    var layers = {}
    var wasInitialized = false
    var isOrbitControls = true
    var orbitControls, orientationControls
    var hammer
    var lastPinchScale

    var azCircle
    var elCircle, elCircleP
    var azIndicator, elIndicator
    var advancedAzElOn = false

    var lastAz = null
    var lastEl = null
    var lastFov = null

    var geometry = null
    var currentImageObj = null
    var lastIntLayerName = null

    var webglSupport = (function () {
        try {
            var canvas = document.createElement('canvas')
            return !!(
                window.WebGLRenderingContext &&
                (canvas.getContext('webgl') ||
                    canvas.getContext('experimental-webgl'))
            )
        } catch (e) {
            return false
        }
    })()

    init()

    function init() {
        // http://threejs.org/docs/#Reference/Cameras/PerspectiveCamera
        camera = new THREE.PerspectiveCamera(
            options.view || 75,
            domEl.offsetWidth / domEl.offsetHeight,
            1,
            1000
        )
        camera.position.x = 0.1
        camera.position.y = options.y || 0
        if (webglSupport) {
            renderer = new THREE.WebGLRenderer()
            renderer.setPixelRatio(window.devicePixelRatio)
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)

            renderer.vr.enabled = true

            if (WebVR) domEl.appendChild(WebVR.createButton(renderer))

            domEl.appendChild(renderer.domElement)

            orbitControls = new THREE.OrbitControls(camera, renderer.domElement)
            orbitControls.enablePan = false
            orbitControls.enableZoom = true
            orbitControls.autoRotate = false
            orbitControls.autoRotateSpeed = options.speed || 0.5
            orbitControls.enableDamping = true
            orbitControls.dampingFactor = 0.27
            orbitControls.rotateSpeed = -0.07

            orientationControls = new THREE.DeviceOrientationControls(camera)

            controls = orbitControls

            //controls.addEventListener( 'change', render );

            domEl.addEventListener('wheel', onMouseWheel, true)
            domEl.addEventListener('DOMMouseScroll', onMouseWheel, true)

            domEl.addEventListener('click', onMouseClick, true)

            //Hammer events
            hammer = new Hammer(domEl, { domEvents: true })
            hammer.get('pinch').set({ enable: true })

            hammer.on('pinch', function (e) {
                e.preventDefault()
                onMouseWheel(e.scale, true)
            })
            hammer.on('pinchend', function () {
                lastPinchScale = null
            })

            scene = new THREE.Scene()

            //Add azel rings
            var radius = 15
            var shape = new THREE.Shape()
            shape.moveTo(radius, 0)
            shape.absarc(0, 0, radius, 0, 2 * Math.PI, false)
            var spacedPoints = shape.createSpacedPointsGeometry(360)

            var vertexColors = [] // array for our vertex colours
            spacedPoints.vertices.forEach(function (vertex) {
                // fill the array
                if (vertex.y < 0) vertexColors.push(new THREE.Color(0xff0000))
                else vertexColors.push(new THREE.Color(0x0000ff))
            })
            spacedPoints.colors = vertexColors // assign the array

            azCircle = new THREE.Line(
                spacedPoints,
                new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors, // set this parameter like it shown here
                })
            )
            azCircle.visible = advancedAzElOn
            scene.add(azCircle)

            var radius = 15
            var shape = new THREE.Shape()
            shape.moveTo(radius, 0)
            shape.absarc(0, 0, radius, 0, 2 * Math.PI, false)
            var spacedPoints = shape.createSpacedPointsGeometry(360)

            var vertexColors = [] // array for our vertex colours
            spacedPoints.vertices.forEach(function (vertex) {
                // fill the array
                if (vertex.y < 0) vertexColors.push(new THREE.Color(0xffff00))
                else vertexColors.push(new THREE.Color(0x00ff00))
            })
            spacedPoints.colors = vertexColors // assign the array

            elCircle = new THREE.Line(
                spacedPoints,
                new THREE.LineBasicMaterial({
                    vertexColors: THREE.VertexColors, // set this parameter like it shown here
                })
            )
            elCircleP = new THREE.Object3D()
            elCircleP.visible = advancedAzElOn
            elCircleP.rotation.x = Math.PI / 2
            elCircleP.add(elCircle)
            scene.add(elCircleP)

            //Add azel indicators
            buildAzElIndicators()

            animate()
            //render();

            wasInitialized = true
        }
    }

    function changeImage(imageObj, feature, layer, callback) {
        if (!wasInitialized) {
            if (typeof callback === 'function')
                callback(
                    "<div style='letter-spacing: 0px; font-size: 18px; text-align: center; font-family: roboto; color: #CCC;'><div style='margin-bottom: 5px;'>Seems like <a target='_blank' href='https://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation'>WebGL</a> isn't supported for you.</div><div>Find out how to get it <a target='_blank' href='https://get.webgl.org/'>here</a>.</div></div>"
                )
        }
        geometry = feature.geometry
        currentImageObj = imageObj

        const url = imageObj.url
        //crop out directory path and extension from image name
        let croppedName = url.substring(0, url.length - 4).split('/')
        croppedName = croppedName[croppedName.length - 1]
        const croppedNameSol = croppedName.split('_')[2]
        //assemble ranges
        const azR = [parseFloat(imageObj.azmin), parseFloat(imageObj.azmax)]
        const elR = [parseFloat(imageObj.elmin), parseFloat(imageObj.elmax)]
        const xyR = [parseInt(imageObj.columns), parseInt(imageObj.rows)]

        clearLayers()
        makeModifiedTexture(url, azR, elR, xyR, () => {
            const layerName = layer.options.layerName

            if (
                feature.geometry.type === 'Point' &&
                L_.layers.on[layerName] &&
                L_.layers.attachments[layerName] &&
                L_.layers.attachments[layerName].pairings &&
                L_.layers.attachments[layerName].pairings.on
            ) {
                let sourceCoords = feature.geometry.coordinates
                let originOffsetOrder =
                    L_.layers.attachments[layerName].pairings.originOffsetOrder
                if (originOffsetOrder)
                    originOffsetOrder = originOffsetOrder.map((o) =>
                        o.toLowerCase()
                    )

                // Allow sourceCoords offset with originOffset and support configurable axis order
                // prettier-ignore
                if( imageObj.originOffset != null ) {
                    const crs = window.mmgisglobal.customCRS
                    const scp = crs.project({lng: sourceCoords[0], lat: sourceCoords[1]})
                    sourceCoords = [scp.x, scp.y, sourceCoords[2]]
                    if(imageObj.originOffset[0] != null) {
                        if( originOffsetOrder != null && originOffsetOrder[0] != null) {
                            const pos = originOffsetOrder[0].includes('z') ? 2 : originOffsetOrder[0].includes('y') ? 1 : 0 
                            const sign = originOffsetOrder[0].includes('-') ? -1 : 1
                            sourceCoords[pos] += sign * imageObj.originOffset[0]
                        }
                        else
                            sourceCoords[0] += imageObj.originOffset[0]
                    }
                    if(imageObj.originOffset[1] != null) {
                        if( originOffsetOrder != null && originOffsetOrder[1] != null) {
                            const pos = originOffsetOrder[1].includes('z') ? 2 : originOffsetOrder[1].includes('y') ? 1 : 0 
                            const sign = originOffsetOrder[1].includes('-') ? -1 : 1
                            sourceCoords[pos] += sign * imageObj.originOffset[1]
                        }
                        else
                            sourceCoords[1] += imageObj.originOffset[1]
                    }
                    if(imageObj.originOffset[2] != null) {
                        if( originOffsetOrder != null && originOffsetOrder[2] != null) {
                            const pos = originOffsetOrder[2].includes('z') ? 2 : originOffsetOrder[2].includes('y') ? 1 : 0 
                            const sign = originOffsetOrder[2].includes('-') ? -1 : 1
                            sourceCoords[pos] += sign * imageObj.originOffset[2]
                        }
                        else
                            sourceCoords[2] += imageObj.originOffset[2]
                    }
                    const scup = crs.unproject({x: sourceCoords[0], y: sourceCoords[1]})
                    sourceCoords = [scup.lng, scup.lat, sourceCoords[2]]
                }

                currentImageObj._center = sourceCoords

                const pairValue = F_.getIn(
                    feature.properties,
                    L_.layers.attachments[layerName].pairings.pairProp,
                    '___null'
                )
                L_.layers.attachments[layerName].pairings.pairedLayers.forEach(
                    (pairedLayerName) => {
                        if (
                            L_.layers.layer[pairedLayerName] &&
                            L_.layers.layer[pairedLayerName]._sourceGeoJSON &&
                            L_.layers.on[pairedLayerName] === true
                        ) {
                            layers[pairedLayerName] = {}
                            L_.layers.layer[
                                pairedLayerName
                            ]._sourceGeoJSON.features.forEach((pairFeature) => {
                                if (
                                    pairFeature.geometry.type === 'Point' &&
                                    F_.getIn(
                                        pairFeature.properties,
                                        L_.layers.attachments[layerName]
                                            .pairings.pairProp,
                                        null
                                    ) === pairValue
                                ) {
                                    const pairCoords =
                                        pairFeature.geometry.coordinates
                                    const azElDist = F_.azElDistBetween(
                                        {
                                            lat: sourceCoords[1],
                                            lng: sourceCoords[0],
                                            el: sourceCoords[2],
                                        },
                                        {
                                            lat: pairCoords[1],
                                            lng: pairCoords[0],
                                            el: pairCoords[2],
                                        }
                                    )

                                    // Prefer az/els already provided with the feature (if any and set up)
                                    if (
                                        L_.layers.attachments[layerName]
                                            .pairings.layersAzProp != null
                                    ) {
                                        const az = F_.getIn(
                                            pairFeature.properties,
                                            L_.layers.attachments[layerName]
                                                .pairings.layersAzProp,
                                            null
                                        )
                                        if (az != null) azElDist.az = az
                                    }
                                    if (
                                        L_.layers.attachments[layerName]
                                            .pairings.layersElProp != null
                                    ) {
                                        const el = F_.getIn(
                                            pairFeature.properties,
                                            L_.layers.attachments[layerName]
                                                .pairings.layersElProp,
                                            null
                                        )
                                        if (el != null) azElDist.el = el
                                    }

                                    addPoint(
                                        pairedLayerName,
                                        azElDist.az,
                                        azElDist.el,
                                        L_.layers.data[pairedLayerName]
                                            .useKeyAsName,
                                        F_.getIn(
                                            pairFeature.properties,
                                            L_.layers.data[pairedLayerName]
                                                .useKeyAsName
                                        ),
                                        L_.layers.data[pairedLayerName].style
                                    )
                                }
                            })
                        }
                    }
                )

                render()
            }
            if (typeof callback === 'function') {
                callback()
            }
        })
    }

    function toggleControls() {
        isOrbitControls = !isOrbitControls
        if (isOrbitControls) controls = orbitControls
        else controls = orientationControls
    }

    let pointId = 0
    function addPoint(layerName, az, el, nameKey, name, style) {
        pointId++

        style = style || {}

        const rot = F_.mod(az - 90, 360, true)

        const mapped = F_.lonLatToVector3nr(rot, -el, sphereRadius / 2)
        const mappedCloser = F_.lonLatToVector3nr(rot, -el, sphereRadius / 1.5)

        const boundingSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1, 12, 12),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                opacity: 0,
                transparent: true,
                depthWrite: false,
            })
        )
        boundingSphere.position.set(mapped.x, mapped.y, mapped.z)
        boundingSphere.layerName = layerName
        boundingSphere.nameKey = nameKey
        boundingSphere.name = name
        boundingSphere.pid = pointId
        scene.add(boundingSphere)

        const fillColor = F_.hexToRGB(F_.rgb2hex(style.fillColor)) || false
        if (fillColor)
            fillColor.a =
                style.fillOpacity != null ? parseFloat(style.fillOpacity) : 1
        const strokeColor = F_.hexToRGB(F_.rgb2hex(style.color)) || false
        if (strokeColor)
            strokeColor.a =
                style.opacity != null ? parseFloat(style.opacity) : 1

        const point = Sprites.makeMarkerSprite({
            radius: style.radius ? style.radius * 8 : 64,
            fillColor,
            strokeWeight: style.weight ? style.weight * 6 : 12,
            strokeColor,
        })
        point.position.set(mappedCloser.x, mappedCloser.y, mappedCloser.z)
        point.layerName = layerName
        point.savedMaterial = point.material
        point.nameKey = nameKey
        point.name = name
        point.pid = pointId
        scene.add(point)

        const text = Sprites.makeTextSprite(name, {
            fontsize: 36,
            fontColor: { r: 255, g: 255, b: 255, a: 1.0 },
            strokeColor: { r: 0, g: 0, b: 0, a: 1.0 },
        })
        text.position.set(mappedCloser.x, mappedCloser.y, mappedCloser.z)
        text.layerName = layerName
        text.nameKey = nameKey
        text.name = name
        text.pid = pointId
        scene.add(text)

        layers[layerName][name] = layers[layerName][name] || {}
        layers[layerName][name][pointId] = {
            boundingSphere: boundingSphere,
            point: point,
            text: text,
        }
    }

    function clearLayers() {
        for (let l in layers) {
            for (let p in layers[l]) {
                for (let i in layers[l][p]) {
                    layers[l][p][i].boundingSphere.geometry.dispose()
                    layers[l][p][i].boundingSphere.material.dispose()
                    layers[l][p][i].point.material.dispose()
                    layers[l][p][i].text.material.dispose()
                    scene.remove(layers[l][p][i].point)
                    scene.remove(layers[l][p][i].text)
                }
            }
        }
        layers = {}
    }

    function render() {
        renderer.render(scene, camera)
    }

    function animate() {
        requestAnimationFrame(animate)
        controls.update()
        azCircle.rotation.y = camera.rotation.y + Math.PI / 2
        elCircleP.rotation.z = -(camera.rotation.y + Math.PI / 2)
        elCircle.rotation.y = camera.rotation.x
        elCircle.rotation.z = camera.rotation.y + Math.PI / 2

        var az = Math.abs(camera.rotation.y * (180 / Math.PI) - 270)
        if (az > 360) az -= 360

        let currentAz = az.toFixed(2)
        let currentEl = (camera.rotation.x * (180 / Math.PI)).toFixed(2)
        let currentFov = camera.fov

        if (advancedAzElOn) {
            azCircle.visible = true
            elCircleP.visible = true
            azIndicator.innerHTML = currentAz + '&deg;'
            elIndicator.innerHTML = currentEl + '&deg;'
        } else {
            azCircle.visible = false
            elCircleP.visible = false
            azIndicator.innerHTML =
                'Az: ' + currentAz + '&deg;, El: ' + currentEl + '&deg;'
            elIndicator.innerHTML = ''
        }

        if (
            currentAz != lastAz ||
            currentEl != lastEl ||
            currentFov != lastFov ||
            geometry == null
        ) {
            lastAz = currentAz
            lastEl = currentEl
            lastFov = currentFov

            if (geometry && currentImageObj) {
                Map_.rmNotNull(Map_.tempPhotosphereWedge)

                let start = [geometry.coordinates[1], geometry.coordinates[0]]
                if (currentImageObj._center != null)
                    start = [
                        currentImageObj._center[1],
                        currentImageObj._center[0],
                    ]

                //==== Get bearing to north (in case north isn't up)
                const contPt = Map_.map.latLngToContainerPoint(start)
                const wOffset = contPt.x
                const hOffset = contPt.y

                //Find coordinates at map center and at another point one pixel below the center
                const centerLatLong = Map_.map.containerPointToLatLng([
                    wOffset,
                    hOffset,
                ])
                const pixelBelowCenterLatLong = Map_.map.containerPointToLatLng(
                    [wOffset, hOffset + 1]
                )
                let bearing = F_.bearingBetweenTwoLatLngs(
                    pixelBelowCenterLatLong.lat,
                    pixelBelowCenterLatLong.lng,
                    centerLatLong.lat,
                    centerLatLong.lng
                )
                bearing = (360 - bearing) % 360

                //
                let end
                let rp
                let line
                let lineLength = Math.min(
                    (parseFloat(currentEl) + 90) * 1.6 + 10,
                    100
                )

                const crs = window.mmgisglobal.customCRS

                let centerLngLat = { lng: start[1], lat: start[0] }
                const centerEN = crs.project(centerLngLat)
                const centerCoordsEN = [centerEN.x, centerEN.y]

                //==== Min-line
                let angleRad =
                    -(parseFloat(lastAz) - parseFloat(lastFov) / 2 + bearing) *
                    (Math.PI / 180)

                rp = F_.rotatePoint(
                    {
                        y: 1,
                        x: 0,
                    },
                    [0, 0],
                    angleRad
                )
                if (crs) {
                    rp = crs.unproject({
                        x: rp.x + centerCoordsEN[0],
                        y: rp.y + centerCoordsEN[1],
                    })
                    rp = { x: rp.lng, y: rp.lat }
                }
                end = [rp.y, rp.x]

                line = new L.Polyline([start, end], {
                    color: 'orange',
                    weight: 5,
                })

                let minLine = L.polylineDecorator(line, {
                    patterns: [
                        {
                            offset: lineLength / 2,
                            repeat: 0,
                            symbol: L.Symbol.dash({
                                pixelSize: lineLength,
                                pathOptions: {
                                    stroke: true,
                                    color: 'lime',
                                    weight: 3,
                                    lineCap: 'square',
                                },
                            }),
                        },
                    ],
                })

                //==== Max-line
                angleRad =
                    -(parseFloat(lastAz) + parseFloat(lastFov) / 2 + bearing) *
                    (Math.PI / 180)

                rp = F_.rotatePoint(
                    {
                        y: 1,
                        x: 0,
                    },
                    [0, 0],
                    angleRad
                )
                if (crs) {
                    rp = crs.unproject({
                        x: rp.x + centerCoordsEN[0],
                        y: rp.y + centerCoordsEN[1],
                    })
                    rp = { x: rp.lng, y: rp.lat }
                }
                end = [rp.y, rp.x]

                line = new L.Polyline([start, end], {
                    color: 'orange',
                    weight: 5,
                })

                let maxLine = L.polylineDecorator(line, {
                    patterns: [
                        {
                            offset: lineLength / 2,
                            repeat: 0,
                            symbol: L.Symbol.dash({
                                pixelSize: lineLength,
                                pathOptions: {
                                    stroke: true,
                                    color: 'lime',
                                    weight: 3,
                                    lineCap: 'square',
                                },
                            }),
                        },
                    ],
                })

                Map_.tempPhotosphereWedge = L.layerGroup([
                    minLine,
                    maxLine,
                ]).addTo(Map_.map)
            }
        }

        render()
    }

    function onMouseWheel(evt, rawScale) {
        if (!rawScale) {
            evt.preventDefault()

            if (evt.wheelDeltaY) {
                // WebKit
                camera.fov -= evt.wheelDeltaY * 0.05
            } else if (evt.wheelDelta) {
                // Opera / IE9
                camera.fov -= evt.wheelDelta * 0.05
            } else if (evt.detail) {
                // Firefox
                camera.fov += evt.detail * 1.0
            }
        } else {
            var last = lastPinchScale || evt
            var dif = last - evt
            camera.fov += dif * 20
            lastPinchScale = evt
        }
        camera.fov = Math.max(20, Math.min(options.view || 75, camera.fov))
        camera.updateProjectionMatrix()
        render()
    }

    function onMouseClick(e) {
        e.preventDefault()
        mouse.x =
            ((e.clientX - renderer.domElement.getBoundingClientRect().left) /
                renderer.domElement.width) *
                2 -
            1
        mouse.y =
            -(
                (e.clientY - renderer.domElement.getBoundingClientRect().top) /
                renderer.domElement.height
            ) *
                2 +
            1
        raycaster.setFromCamera(mouse, camera)

        const intersectArr = []
        for (let l in layers) {
            for (let p in layers[l])
                for (let i in layers[l][p])
                    intersectArr.push(layers[l][p][i].boundingSphere)
        }
        const intersects = raycaster.intersectObjects(intersectArr)

        if (intersects.length > 0) {
            //reset all photosphere point materials
            resetLayerMaterials()
            const intLayerName = intersects[0].object.layerName
            //change clicked point material
            const point =
                layers[intLayerName][intersects[0].object.name][
                    intersects[0].object.pid
                ].point
            point.material = Sprites.makeMarkerMaterial({
                radius: 64,
                fillColor: { r: 102, g: 204, b: 102, a: 0 },
                strokeWeight: 20,
                strokeColor: { r: 255, g: 0, b: 0, a: 0.9 },
            })

            render()

            //Select the point in the map
            const markers = L_.layers.layer[intLayerName]
            if (markers != undefined) {
                markers.eachLayer(function (layer) {
                    if (
                        intersects[0].object.name ==
                        layer.feature.properties[intersects[0].object.nameKey]
                    ) {
                        if (lastIntLayerName)
                            L_.resetLayerFills(lastIntLayerName)
                        L_.highlight(layer)
                        lastIntLayerName = intLayerName
                        //layer.fireEvent('click')
                        return
                    }
                })
            }
        }
    }

    function highlight(layer) {
        if (layers.hasOwnProperty(layer.options.layerName)) {
            let l = layers[layer.options.layerName]

            for (let p in l) {
                for (let i in l[p]) {
                    if (
                        l[p][i].point.name ==
                        layer.feature.properties[l[p][i].point.nameKey]
                    ) {
                        resetLayerMaterials()
                        l[p][i].point.material = Sprites.makeMarkerMaterial({
                            radius: 64,
                            fillColor: { r: 102, g: 204, b: 102, a: 0 },
                            strokeWeight: 20,
                            strokeColor: { r: 255, g: 0, b: 0, a: 0.9 },
                        })
                        render()
                    }
                }
            }
        }
    }

    function resetLayerMaterials() {
        for (let l in layers) {
            for (let p in layers[l]) {
                for (let i in layers[l][p]) {
                    layers[l][p][i].point.material.dispose()
                    layers[l][p][i].point.material =
                        layers[l][p][i].point.savedMaterial
                    layers[l][p][i].point.material.needsUpdate = true
                }
            }
        }
    }

    function resize() {
        if (renderer != undefined) {
            camera.aspect = domEl.offsetWidth / domEl.offsetHeight
            camera.updateProjectionMatrix()
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            render()
        }
    }

    function getAzEl() {
        return [
            Math.abs(camera.rotation.y * (180 / Math.PI) - 270),
            Math.abs(camera.rotation.x * (180 / Math.PI)),
        ]
    }

    function getTarget() {
        return [
            camera.position.x,
            camera.position.y,
            camera.position.z,
            camera.fov,
        ]
    }

    function setTarget(x, y, z, fov) {
        if (isOrbitControls) {
            camera.position.x = x
            camera.position.y = y
            camera.position.z = z
            camera.fov = fov
            controls.update()
        }
    }

    // http://stackoverflow.com/questions/21548247/clean-up-threejs-webgl-contexts
    function remove() {
        if (sphere != null) {
            scene.remove(sphere)
            sphere.geometry.dispose()
            sphere.material.dispose()
        }
        while (domEl.firstChild) {
            domEl.removeChild(domEl.firstChild)
        }

        domEl.removeEventListener('wheel', onMouseWheel, true)
        domEl.removeEventListener('DOMMouseScroll', onMouseWheel, true)
        domEl.removeEventListener('click', onMouseClick, true)
    }

    //
    //az is [min az, max az]
    //el is [min el, max el]
    //dim is [width, height]
    //zero is [x, y] where 0,0 (az,el) falls in pixel space on the image
    //
    function makeModifiedTexture(image, az, el, dim, callback) {
        if (!wasInitialized) return

        var downsizing = F_.isMobile.iPhone()
        var hasDownsized = false
        var oldDim = dim
        //16777216 Canvas too large on iphone
        if (downsizing) {
            dim[0] = Math.floor(dim[0] / 2)
            dim[1] = Math.floor(dim[1] / 2)
            //az[0]  = Math.floor( az[0] / 2 );
            //az[1]  = Math.floor( az[1] / 2 );
            //el[0]  = Math.floor( el[0] / 2 );
            //el[1]  = Math.floor( el[1] / 2 );
        }

        var img = new Image()
        img.onload = createMeshThenRender
        img.src = image

        function createMeshThenRender() {
            if (downsizing && !hasDownsized) {
                hasDownsized = true
                var imgTemp = img
                img = new Image()
                img.onload = createMeshThenRender
                img.src = F_.scaleImageInHalf(imgTemp, oldDim[0], oldDim[1])
            } else {
                var cv = document.createElement('canvas')

                //Calculate which pixel will be at 0az, 0el
                var zero = [0, 0]
                if (az[0] < az[1]) {
                    zero[0] = linearScale(az, [0, dim[0]], 0)
                    sphereRot = F_.mod((az[0] + az[1]) / 2, 360, true)
                } else {
                    zero[0] = linearScale([az[0] - 360, az[1]], [0, dim[0]], 0)
                    sphereRot = F_.mod((az[0] - 360 + az[1]) / 2, 360, true)
                }
                zero[1] = linearScale(el, [dim[1], 0], 0)

                //We want a texture that represents 360deg width and 180deg height to fit our photosphere
                //map el to 0 to 180 (instead of -90 to 90)
                el[0] += 90
                el[1] += 90

                //find the az distance (in degrees)
                var azD = 0
                if (az[0] > az[1]) {
                    //loop through 360
                    azD = 360 - az[0] + az[1]
                } else {
                    azD = az[1] - az[0]
                }

                //calculate how big to make our canvas
                cv.width = (360 / azD) * dim[0]
                cv.height = (180 / (el[1] - el[0])) * dim[1]

                var ctx = cv.getContext('2d')

                //Only wraps on x axis
                var startX = zero[0]
                var startY = cv.height / 2 - zero[1]

                var clippedWidth = Math.min(dim[0] - startX, cv.width)

                ctx.drawImage(
                    img,
                    startX,
                    0,
                    clippedWidth,
                    cv.height,
                    0,
                    startY,
                    clippedWidth,
                    cv.height
                )

                //If we do not fill the canvas
                if (clippedWidth < cv.width) {
                    var remaining = dim[0] - clippedWidth
                    ctx.drawImage(
                        img,
                        0,
                        0,
                        remaining,
                        cv.height,
                        cv.width - remaining,
                        startY,
                        remaining,
                        cv.height
                    )
                }

                var texture = new THREE.Texture(cv)
                texture.needsUpdate = true

                texture.minFilter = THREE.NearestFilter

                if (isOrbitControls) controls.reset()

                if (sphere == null) {
                    //make the new sphere
                    sphere = new THREE.Mesh(
                        new THREE.SphereGeometry(sphereRadius, 60, 60),
                        new THREE.MeshBasicMaterial({
                            map: texture,
                        })
                    )
                    //sphere.material.side = THREE.BackSide;

                    //Invert the sphere
                    sphere.geometry.scale(-1, 1, 1)

                    //sphere.rotation.set( 0, (sphereRot - 180) * (Math.PI/180), 0 );

                    scene.add(sphere)
                } else {
                    //just change the texture
                    sphere.material.dispose()
                    sphere.material.map = texture

                    //sphere.rotation.set( 0, (sphereRot - 180) * (Math.PI/180), 0 );

                    sphere.material.map.needsUpdate = true
                }

                callback()
                //force a render frame
                render()
            }
        }
    }

    function buildAzElIndicators() {
        azIndicator = document.createElement('div')
        azIndicator.id = 'photosphereAzIndicator'
        azIndicator.title = 'Toggle az/el crosshairs'
        domEl.appendChild(azIndicator)

        elIndicator = document.createElement('div')
        elIndicator.id = 'photosphereElIndicator'
        domEl.appendChild(elIndicator)

        azIndicator.addEventListener('click', function () {
            advancedAzElOn = !advancedAzElOn
        })
    }

    function linearScale(domain, range, value) {
        return (
            ((range[1] - range[0]) * (value - domain[0])) /
                (domain[1] - domain[0]) +
            range[0]
        )
    }

    return {
        changeImage: changeImage,
        toggleControls: toggleControls,
        highlight: highlight,
        resize: resize,
        getAzEl: getAzEl,
        getTarget: getTarget,
        setTarget: setTarget,
        remove: remove,
    }
}
